import React, { createContext, useCallback, useContext, useEffect, useRef, useState } from 'react';
import { EmailAuthProvider, reauthenticateWithCredential } from 'firebase/auth';
import { doc, getDoc, getDocFromServer } from 'firebase/firestore';
import { AlertTriangle, Clock, Lock, LogOut, ShieldCheck } from 'lucide-react';
import { auth, db, getFirebaseAuthErrorCode } from '../../lib/firebase';
import { useStore } from '../../store/StoreContext';
import { AppUser } from '../../types';
import { ADMIN_IDLE_TIMEOUT_MS, ADMIN_IDLE_WARNING_BEFORE_MS } from '../../utils/adminAuth';

interface AdminSecurityContextValue {
  requireSensitiveReauth: (actionTitle: string, onAuthorized: () => void | Promise<void>) => void;
  requestAdminLogout: () => void;
}

const AdminSecurityContext = createContext<AdminSecurityContextValue>({
  requireSensitiveReauth: (_title, onAuthorized) => {
    void onAuthorized();
  },
  requestAdminLogout: () => {},
});

export function useAdminSecurity(): AdminSecurityContextValue {
  return useContext(AdminSecurityContext);
}

interface PendingReauthState {
  title: string;
  onAuthorized: () => void | Promise<void>;
}

export const AdminGuard: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const { authReady, firebaseUser, user, appearance, logout, navigateToHome } = useStore();

  const [guardStatus, setGuardStatus] = useState<'checking' | 'allowed' | 'denied'>('checking');
  const lastActivityRef = useRef<number>(Date.now());

  // Idle timeout warning state
  const [idleWarningOpen, setIdleWarningOpen] = useState(false);
  const [idleRemainingSec, setIdleRemainingSec] = useState(60);

  // Sensitive action password re-auth modal
  const [pendingReauth, setPendingReauth] = useState<PendingReauthState | null>(null);
  const [reauthPassword, setReauthPassword] = useState('');
  const [reauthError, setReauthError] = useState<string | null>(null);
  const [reauthLoading, setReauthLoading] = useState(false);

  // Logout confirmation modal
  const [logoutConfirmOpen, setLogoutConfirmOpen] = useState(false);
  const [logoutLoading, setLogoutLoading] = useState(false);

  // 1) Server-side Firestore verification of role & non-blocked status
  useEffect(() => {
    let active = true;

    const verifyAccess = async () => {
      if (!authReady) {
        if (active) setGuardStatus('checking');
        return;
      }

      if (!firebaseUser || firebaseUser.isAnonymous) {
        if (active) setGuardStatus('denied');
        return;
      }

      if (active) setGuardStatus('checking');
      try {
        let snap;
        try {
          snap = await getDocFromServer(doc(db, 'users', firebaseUser.uid));
        } catch {
          snap = await getDoc(doc(db, 'users', firebaseUser.uid));
        }

        if (!active) return;
        if (!snap.exists()) {
          setGuardStatus('denied');
          return;
        }

        const data = snap.data() as Partial<AppUser>;
        const role = data.role;
        const blocked = Boolean(data.isBlocked || data.blocked);
        if ((role === 'admin' || role === 'staff') && !blocked) {
          lastActivityRef.current = Date.now();
          setGuardStatus('allowed');
        } else {
          setGuardStatus('denied');
        }
      } catch {
        if (active) setGuardStatus('denied');
      }
    };

    void verifyAccess();
    return () => {
      active = false;
    };
  }, [authReady, firebaseUser]);

  // Also revoke immediately if reactive user state becomes non-admin or blocked
  useEffect(() => {
    if (
      guardStatus === 'allowed' &&
      ((user.role !== 'admin' && user.role !== 'staff') || user.isBlocked || user.blocked)
    ) {
      setGuardStatus('denied');
    }
  }, [guardStatus, user.role, user.isBlocked, user.blocked]);

  // Redirect unauthorized visitors back to Home
  useEffect(() => {
    if (guardStatus === 'denied') {
      navigateToHome();
    }
  }, [guardStatus, navigateToHome]);

  // 2) 30-minute inactivity auto-logout with 1-minute warning dialog
  useEffect(() => {
    if (guardStatus !== 'allowed') return;

    const recordActivity = () => {
      if (!idleWarningOpen) {
        lastActivityRef.current = Date.now();
      }
    };

    const events: (keyof WindowEventMap)[] = [
      'mousemove',
      'mousedown',
      'keydown',
      'touchstart',
      'scroll',
      'click',
    ];
    events.forEach((ev) => window.addEventListener(ev, recordActivity, { passive: true }));

    const timer = window.setInterval(() => {
      const elapsed = Date.now() - lastActivityRef.current;
      const timeLeftMs = ADMIN_IDLE_TIMEOUT_MS - elapsed;

      if (timeLeftMs <= 0) {
        window.clearInterval(timer);
        setIdleWarningOpen(false);
        void logout().finally(() => {
          navigateToHome();
        });
        return;
      }

      if (timeLeftMs <= ADMIN_IDLE_WARNING_BEFORE_MS) {
        setIdleRemainingSec(Math.max(1, Math.ceil(timeLeftMs / 1000)));
        setIdleWarningOpen(true);
      } else if (idleWarningOpen) {
        setIdleWarningOpen(false);
      }
    }, 1000);

    return () => {
      window.clearInterval(timer);
      events.forEach((ev) => window.removeEventListener(ev, recordActivity));
    };
  }, [guardStatus, idleWarningOpen, logout, navigateToHome]);

  const handleStaySignedIn = () => {
    lastActivityRef.current = Date.now();
    setIdleWarningOpen(false);
  };

  const handleConfirmLogout = async () => {
    setLogoutLoading(true);
    try {
      await logout();
      setLogoutConfirmOpen(false);
      navigateToHome();
    } finally {
      setLogoutLoading(false);
    }
  };

  const requireSensitiveReauth = useCallback(
    (actionTitle: string, onAuthorized: () => void | Promise<void>) => {
      setReauthPassword('');
      setReauthError(null);
      setPendingReauth({ title: actionTitle, onAuthorized });
    },
    []
  );

  const requestAdminLogout = useCallback(() => {
    setLogoutConfirmOpen(true);
  }, []);

  const handleSubmitReauth = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!pendingReauth || reauthLoading) return;

    const current = auth.currentUser;
    const currentEmail = current?.email || user.email;
    if (!current || !currentEmail) {
      setReauthError('انتهت صلاحية الجلسة، يرجى إعادة تسجيل الدخول');
      return;
    }

    if (!reauthPassword) {
      setReauthError('يرجى إدخال كلمة المرور الحالية');
      return;
    }

    setReauthLoading(true);
    setReauthError(null);
    try {
      const cred = EmailAuthProvider.credential(currentEmail, reauthPassword);
      await reauthenticateWithCredential(current, cred);
      const callback = pendingReauth.onAuthorized;
      setPendingReauth(null);
      setReauthPassword('');
      await callback();
    } catch (err) {
      const code = getFirebaseAuthErrorCode(err);
      if (code === 'auth/wrong-password' || code === 'auth/invalid-credential') {
        setReauthError('كلمة المرور غير صحيحة');
      } else if (code === 'auth/too-many-requests') {
        setReauthError('تم إرسال طلبات كثيرة مؤقتاً. يرجى الانتظار قليلاً ثم المحاولة.');
      } else if (code === 'auth/network-request-failed') {
        setReauthError('تعذر الاتصال بالشبكة. تحقق من اتصال الإنترنت.');
      } else {
        setReauthError('تعذر التحقق من كلمة المرور. حاول مرة أخرى.');
      }
    } finally {
      setReauthLoading(false);
    }
  };

  if (guardStatus === 'checking') {
    return (
      <div
        dir="rtl"
        className="min-h-[100dvh] flex flex-col items-center justify-center gap-3 bg-[#F8F9FA] dark:bg-[#0D131F] text-[#11223E] dark:text-slate-100 p-6"
      >
        <div className="w-12 h-12 rounded-2xl border-4 border-slate-200 dark:border-slate-700 border-t-[#D9B24C] animate-spin" />
        <p className="text-sm font-bold">جارٍ التحقق من صلاحيات الإدارة...</p>
      </div>
    );
  }

  if (guardStatus === 'denied') {
    return null;
  }

  return (
    <AdminSecurityContext.Provider value={{ requireSensitiveReauth, requestAdminLogout }}>
      <div
        dir="rtl"
        className="min-h-[100dvh] bg-[#F8F9FA] dark:bg-[#0D131F] text-[#11223E] dark:text-slate-100 pb-12"
      >
        {children}
      </div>

      {/* 1-Minute Inactivity Warning Modal */}
      {idleWarningOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[80] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-300">
              <Clock className="w-6 h-6" />
            </div>
            <h2 className="text-base font-extrabold">تنبيه انتهاء الجلسة</h2>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              سيتم تسجيل خروجك تلقائياً خلال{' '}
              <span dir="ltr" className="font-mono-num font-extrabold text-rose-600 tabular-nums">
                {idleRemainingSec}
              </span>{' '}
              ثانية بسبب عدم النشاط.
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                onClick={handleStaySignedIn}
                style={{ backgroundColor: appearance.primaryColor }}
                className="flex-1 min-h-[44px] px-4 rounded-xl text-white text-xs font-extrabold"
              >
                البقاء
              </button>
              <button
                type="button"
                onClick={() => void handleConfirmLogout()}
                className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold"
              >
                تسجيل الخروج
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Password Re-Authentication Modal before Sensitive Actions */}
      {pendingReauth && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[85] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <form
            onSubmit={handleSubmitReauth}
            className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-xs"
          >
            <div className="flex items-center gap-2.5 text-sm font-extrabold">
              <ShieldCheck className="w-5 h-5 text-[#D9B24C] shrink-0" />
              <span>{pendingReauth.title}</span>
            </div>
            <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
              حمايةً للبيانات الحساسة، يرجى إعادة إدخال كلمة مرور الإدارة الحالية للمتابعة.
            </p>

            {reauthError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 font-bold">
                {reauthError}
              </div>
            )}

            <div>
              <label htmlFor="vp-reauth-pw" className="block font-bold mb-1.5">
                كلمة المرور الحالية
              </label>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
                <input
                  id="vp-reauth-pw"
                  type="password"
                  dir="ltr"
                  autoFocus
                  required
                  value={reauthPassword}
                  onChange={(e) => setReauthPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full min-h-[44px] ps-9 pe-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0D131F] text-base"
                />
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={reauthLoading}
                onClick={() => {
                  setPendingReauth(null);
                  setReauthPassword('');
                  setReauthError(null);
                }}
                className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 font-bold"
              >
                إلغاء
              </button>
              <button
                type="submit"
                disabled={reauthLoading}
                style={{ backgroundColor: appearance.primaryColor }}
                className="min-h-[44px] px-5 rounded-xl text-white font-extrabold disabled:opacity-50"
              >
                {reauthLoading ? 'جارٍ التحقق...' : 'تأكيد وتنفيذ'}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Logout Confirmation Modal */}
      {logoutConfirmOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[85] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-sm w-full p-6 space-y-4 shadow-2xl text-center">
            <div className="w-12 h-12 rounded-2xl mx-auto flex items-center justify-center bg-rose-100 text-rose-700 dark:bg-rose-950/50 dark:text-rose-300">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <h2 className="text-base font-extrabold">هل تريد تسجيل الخروج؟</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400">
              سيتم إنهاء جلسة الإدارة الحالية والعودة إلى واجهة المتجر.
            </p>
            <div className="flex items-center justify-center gap-2 pt-1">
              <button
                type="button"
                disabled={logoutLoading}
                onClick={() => setLogoutConfirmOpen(false)}
                className="flex-1 min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold"
              >
                إلغاء
              </button>
              <button
                type="button"
                disabled={logoutLoading}
                onClick={() => void handleConfirmLogout()}
                className="flex-1 min-h-[44px] px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold inline-flex items-center justify-center gap-1.5 disabled:opacity-50"
              >
                <LogOut className="w-4 h-4" />
                <span>{logoutLoading ? 'جارٍ الخروج...' : 'تسجيل الخروج'}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </AdminSecurityContext.Provider>
  );
};
