import React, { useEffect, useState } from 'react';
import { Eye, EyeOff, Lock, Mail, ShieldAlert, ArrowRight } from 'lucide-react';
import { AdminLoginError, useStore } from '../../store/StoreContext';
import {
  ADMIN_LOCKOUT_MAX_ATTEMPTS,
  AdminLoginAttemptStatus,
  LAST_ATTEMPT_KEY_STORAGE,
  getAdminAttemptStatusByEmail,
  getAdminAttemptStatusById,
} from '../../utils/adminAuth';

function formatCountdown(ms: number): string {
  const totalSeconds = Math.max(0, Math.ceil(ms / 1000));
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
}

export const AdminLoginView: React.FC = () => {
  const {
    firebaseUser,
    user,
    appearance,
    loginAdminWithEmail,
    navigateToAdminPanel,
    navigateToHome,
  } = useStore();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [attemptStatus, setAttemptStatus] = useState<AdminLoginAttemptStatus | null>(null);
  const [remainingMs, setRemainingMs] = useState(0);

  // If already authenticated as non-blocked admin/staff, transition directly into admin panel
  useEffect(() => {
    if (
      firebaseUser &&
      !firebaseUser.isAnonymous &&
      (user.role === 'admin' || user.role === 'staff') &&
      !user.isBlocked &&
      !user.blocked
    ) {
      navigateToAdminPanel(user.role === 'staff' ? 'orders' : 'dashboard');
    }
  }, [firebaseUser, user.role, user.isBlocked, user.blocked, navigateToAdminPanel]);

  // Restore server-side lockout status from last attempted email hash on mount
  useEffect(() => {
    let active = true;
    const loadLastAttempt = async () => {
      try {
        const lastKey = localStorage.getItem(LAST_ATTEMPT_KEY_STORAGE);
        if (!lastKey) return;
        const status = await getAdminAttemptStatusById(lastKey);
        if (!active) return;
        if (status.failedCount > 0 || status.isLocked) {
          setAttemptStatus(status);
          setRemainingMs(status.remainingMs);
        }
      } catch {
        // Ignore storage errors
      }
    };
    void loadLastAttempt();
    return () => {
      active = false;
    };
  }, []);

  // Countdown tick while locked
  useEffect(() => {
    if (!attemptStatus?.isLocked || !attemptStatus.lockedUntilMs) {
      setRemainingMs(0);
      return;
    }

    const updateRemaining = () => {
      const diff = Math.max(0, (attemptStatus.lockedUntilMs || 0) - Date.now());
      setRemainingMs(diff);
      if (diff <= 0) {
        setAttemptStatus((prev) =>
          prev ? { ...prev, isLocked: false, failedCount: 0, lockedUntilMs: null, remainingMs: 0 } : null
        );
      }
    };

    updateRemaining();
    const timer = window.setInterval(updateRemaining, 1000);
    return () => window.clearInterval(timer);
  }, [attemptStatus?.isLocked, attemptStatus?.lockedUntilMs]);

  const handleEmailBlur = async () => {
    const clean = email.trim().toLowerCase();
    if (!clean || !clean.includes('@')) return;
    const status = await getAdminAttemptStatusByEmail(clean);
    if (status.failedCount > 0 || status.isLocked) {
      setAttemptStatus(status);
      setRemainingMs(status.remainingMs);
    } else if (!attemptStatus?.isLocked) {
      setAttemptStatus(null);
    }
  };

  const isLocked = Boolean(attemptStatus?.isLocked && remainingMs > 0);
  const failedCount = attemptStatus?.failedCount || 0;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading || isLocked) return;

    const cleanEmail = email.trim();
    if (!cleanEmail || !password) {
      setErrorMessage('يرجى إدخال البريد الإلكتروني وكلمة المرور');
      return;
    }

    setLoading(true);
    setErrorMessage(null);
    try {
      await loginAdminWithEmail(cleanEmail, password);
    } catch (err) {
      if (err instanceof AdminLoginError) {
        setErrorMessage(err.message);
        if (err.attemptStatus) {
          setAttemptStatus(err.attemptStatus);
          setRemainingMs(err.attemptStatus.remainingMs);
        }
      } else {
        setErrorMessage('بيانات الدخول غير صحيحة');
      }
    } finally {
      setLoading(false);
    }
  };

  return (
    <div
      dir="rtl"
      className="min-h-[100dvh] flex flex-col items-center justify-center p-4 sm:p-6 bg-[#F8F9FA] dark:bg-[#0D131F] text-[#11223E] dark:text-slate-100"
    >
      <div className="w-full max-w-md bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-2xl shadow-xl p-6 sm:p-8 space-y-6">
        <div className="text-center space-y-2">
          <div
            style={{ backgroundColor: appearance.primaryColor, color: appearance.secondaryColor }}
            className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center shadow-md"
          >
            <Lock className="w-6 h-6" />
          </div>
          <h1 className="text-xl font-extrabold">دخول لوحة الإدارة</h1>
          <p className="text-xs text-slate-500 dark:text-slate-400">
            فيجن بلس — Vision Plus
          </p>
        </div>

        {isLocked && (
          <div
            role="alert"
            className="p-4 rounded-xl bg-rose-50 dark:bg-rose-950/35 border border-rose-200 dark:border-rose-900/60 text-rose-800 dark:text-rose-200 space-y-2 text-center"
          >
            <div className="flex items-center justify-center gap-2 font-extrabold text-sm">
              <ShieldAlert className="w-5 h-5 shrink-0" />
              <span>تم قفل تسجيل الدخول مؤقتاً</span>
            </div>
            <p className="text-xs">
              محاولات خاطئة {ADMIN_LOCKOUT_MAX_ATTEMPTS} من {ADMIN_LOCKOUT_MAX_ATTEMPTS}
            </p>
            <div className="text-xs font-semibold">
              يرجى الانتظار قبل إعادة المحاولة:{' '}
              <span dir="ltr" className="font-mono-num font-extrabold text-sm tabular-nums">
                {formatCountdown(remainingMs)}
              </span>
            </div>
          </div>
        )}

        {!isLocked && errorMessage && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-bold space-y-1"
          >
            <div>{errorMessage}</div>
            {failedCount > 0 && failedCount < ADMIN_LOCKOUT_MAX_ATTEMPTS && (
              <div className="text-[11px] font-extrabold">
                محاولات خاطئة {failedCount} من {ADMIN_LOCKOUT_MAX_ATTEMPTS}
              </div>
            )}
          </div>
        )}

        {!isLocked && !errorMessage && failedCount > 0 && failedCount < ADMIN_LOCKOUT_MAX_ATTEMPTS && (
          <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-200 text-xs font-bold text-center">
            محاولات خاطئة {failedCount} من {ADMIN_LOCKOUT_MAX_ATTEMPTS}
          </div>
        )}

        <form onSubmit={handleSubmit} className="space-y-4 text-xs">
          <div>
            <label htmlFor="vp-admin-email" className="block font-bold mb-1.5">
              البريد الإلكتروني
            </label>
            <div className="relative">
              <Mail className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
              <input
                id="vp-admin-email"
                type="email"
                dir="ltr"
                required
                autoComplete="email"
                disabled={isLocked || loading}
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                onBlur={() => void handleEmailBlur()}
                placeholder="admin@visionplus.sd"
                className="w-full min-h-[44px] ps-9 pe-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0D131F] text-base disabled:opacity-50"
              />
            </div>
          </div>

          <div>
            <label htmlFor="vp-admin-password" className="block font-bold mb-1.5">
              كلمة المرور
            </label>
            <div className="relative">
              <Lock className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
              <input
                id="vp-admin-password"
                type={showPassword ? 'text' : 'password'}
                dir="ltr"
                required
                autoComplete="current-password"
                disabled={isLocked || loading}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full min-h-[44px] ps-9 pe-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0D131F] text-base disabled:opacity-50"
              />
              <button
                type="button"
                disabled={isLocked || loading}
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? 'إخفاء كلمة المرور' : 'إظهار كلمة المرور'}
                className="absolute top-1/2 -translate-y-1/2 end-1 min-h-[40px] min-w-[40px] flex items-center justify-center text-slate-500 hover:text-[#11223E] dark:hover:text-white"
              >
                {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isLocked || loading}
            style={{ backgroundColor: appearance.primaryColor }}
            className="w-full min-h-[46px] rounded-xl text-white text-sm font-extrabold shadow-md hover:opacity-95 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'جارٍ التحقق...' : 'تسجيل الدخول للإدارة'}
          </button>
        </form>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 text-center">
          <button
            type="button"
            onClick={navigateToHome}
            className="min-h-[44px] px-4 inline-flex items-center justify-center gap-1.5 text-xs font-bold text-slate-500 hover:text-[#11223E] dark:text-slate-400 dark:hover:text-white transition-colors"
          >
            <ArrowRight className="w-4 h-4" />
            <span>العودة إلى المتجر</span>
          </button>
        </div>
      </div>
    </div>
  );
};
