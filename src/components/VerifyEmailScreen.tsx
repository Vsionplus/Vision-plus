import React, { useEffect, useState } from 'react';
import {
  MailCheck,
  RefreshCw,
  Send,
  Edit3,
  LogOut,
  AlertCircle,
  CheckCircle2,
  Lock,
} from 'lucide-react';
import { useStore } from '../store/StoreContext';

export const VerifyEmailScreen: React.FC = () => {
  const {
    t,
    appearance,
    firebaseUser,
    user,
    cart,
    refreshEmailVerification,
    resendVerificationEmail,
    changeVerificationEmail,
    closeVerifyEmailScreen,
    logout,
  } = useStore();

  const [checking, setChecking] = useState(false);
  const [resending, setResending] = useState(false);
  const [cooldown, setCooldown] = useState(0);
  const [editingEmail, setEditingEmail] = useState(false);
  const [newEmail, setNewEmail] = useState(firebaseUser?.email || user.email || '');
  const [currentPassword, setCurrentPassword] = useState('');
  const [needsPassword, setNeedsPassword] = useState(false);
  const [changingEmail, setChangingEmail] = useState(false);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // 60-second resend countdown
  useEffect(() => {
    if (cooldown <= 0) return;
    const timer = window.setInterval(() => {
      setCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [cooldown]);

  // Auto-poll every 5 seconds & on window/tab focus
  useEffect(() => {
    let cancelled = false;
    const checkNow = async () => {
      if (cancelled) return;
      try {
        await refreshEmailVerification(true);
      } catch {
        // Silent background check error
      }
    };

    const interval = window.setInterval(() => {
      void checkNow();
    }, 5000);

    const handleFocus = () => {
      void checkNow();
    };
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        void checkNow();
      }
    };

    window.addEventListener('focus', handleFocus);
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      cancelled = true;
      window.clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, [refreshEmailVerification]);

  const handleManualCheck = async () => {
    setErrorMsg(null);
    setStatusMsg(null);
    setChecking(true);
    try {
      const verified = await refreshEmailVerification(false);
      if (!verified) {
        setStatusMsg(
          t(
            'لم يتم تأكيد البريد بعد. افتح الرسالة واضغط الرابط ثم حاول مجدداً، وتأكد من مجلد Spam.',
            'Email not verified yet. Please open the link in your inbox or Spam folder.'
          )
        );
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('تعذر التحقق الآن.', 'Could not check status.'));
    } finally {
      setChecking(false);
    }
  };

  const handleResend = async () => {
    if (cooldown > 0) return;
    setErrorMsg(null);
    setStatusMsg(null);
    setResending(true);
    try {
      await resendVerificationEmail();
      setCooldown(60);
      setStatusMsg(
        t(
          'تم إعادة إرسال رابط التحقق إلى بريدك الإلكتروني.',
          'Verification link resent to your email.'
        )
      );
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('تعذر إعادة إرسال الرابط.', 'Failed to resend link.'));
    } finally {
      setResending(false);
    }
  };

  const handleChangeEmail = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setStatusMsg(null);
    if (!newEmail.trim() || !newEmail.includes('@')) {
      setErrorMsg(t('يرجى إدخال بريد إلكتروني صحيح.', 'Please enter a valid email address.'));
      return;
    }

    setChangingEmail(true);
    try {
      const res = await changeVerificationEmail(newEmail.trim(), currentPassword || undefined);
      if (res.requiresPassword) {
        setNeedsPassword(true);
        setErrorMsg(
          t(
            'يرجى إدخال كلمة المرور الحالية لتأكيد تغيير البريد الإلكتروني.',
            'Please enter your current password to confirm email change.'
          )
        );
      } else {
        setEditingEmail(false);
        setNeedsPassword(false);
        setCurrentPassword('');
        setCooldown(60);
        setStatusMsg(
          t(
            'تم إرسال رابط التحقق إلى البريد الجديد. افتح الرابط لتحديث البريد وتفعيله.',
            'Verification link sent to the new email. Open it to confirm.'
          )
        );
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('تعذر تغيير البريد الإلكتروني.', 'Failed to change email.'));
    } finally {
      setChangingEmail(false);
    }
  };

  const activeEmail = firebaseUser?.email || user.email;

  return (
    <div className="min-h-[100dvh] bg-[#F8F9FA] dark:bg-[#0D131F] text-[#11223E] dark:text-slate-100 flex items-center justify-center p-4">
      <div className="w-full max-w-md bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
        <div
          style={{ backgroundColor: appearance.primaryColor }}
          className="px-6 py-7 text-white text-center space-y-3"
        >
          <div
            style={{ backgroundColor: `${appearance.secondaryColor}26`, color: appearance.secondaryColor }}
            className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center"
          >
            <MailCheck className="w-8 h-8" />
          </div>
          <h1 className="text-xl font-extrabold">
            {t('تأكيد البريد الإلكتروني', 'Verify Your Email')}
          </h1>
          <p className="text-xs sm:text-sm text-slate-200 leading-relaxed">
            {t(
              'أرسلنا رابط التحقق إلى بريدك. افتح الرسالة واضغط الرابط، وتحقق من مجلد Spam.',
              'We sent a verification link to your email. Open the message, tap the link, and check your Spam folder.'
            )}
          </p>
          {activeEmail && (
            <div
              dir="ltr"
              className="inline-block px-3.5 py-1.5 rounded-xl bg-white/10 border border-white/15 font-mono-num text-xs font-bold text-[#E2BD5B]"
            >
              {activeEmail}
            </div>
          )}
        </div>

        <div className="p-6 space-y-4">
          {errorMsg && (
            <div
              role="alert"
              className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs font-semibold flex items-start gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{errorMsg}</span>
            </div>
          )}

          {statusMsg && (
            <div
              role="status"
              className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-900/50 text-amber-800 dark:text-amber-200 text-xs font-semibold flex items-start gap-2"
            >
              <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed">{statusMsg}</span>
            </div>
          )}

          {/* 1. Primary Action: Refresh Verification */}
          <button
            type="button"
            disabled={checking}
            onClick={handleManualCheck}
            style={{
              backgroundColor: appearance.secondaryColor,
              color: appearance.primaryColor,
            }}
            className="w-full min-h-[48px] px-5 py-3 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-60 transition-opacity"
          >
            <RefreshCw className={`w-4 h-4 ${checking ? 'animate-spin' : ''}`} />
            <span>{checking ? t('جارٍ التحقق...', 'Checking...') : t('لقد تحققت، تحديث', 'I Verified, Refresh')}</span>
          </button>

          {/* 2. Resend Verification Link with 60s countdown */}
          <button
            type="button"
            disabled={resending || cooldown > 0}
            onClick={handleResend}
            style={{ backgroundColor: appearance.primaryColor }}
            className="w-full min-h-[46px] px-5 py-2.5 rounded-2xl text-white font-bold text-sm flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-50 transition-opacity"
          >
            <Send className="w-4 h-4" />
            <span>
              {cooldown > 0
                ? t(`إعادة إرسال الرابط (${cooldown} ث)`, `Resend Link (${cooldown}s)`)
                : resending
                ? t('جارٍ الإرسال...', 'Sending...')
                : t('إعادة إرسال الرابط', 'Resend Link')}
            </span>
          </button>

          {/* 3. Change Email */}
          {!editingEmail ? (
            <button
              type="button"
              onClick={() => {
                setEditingEmail(true);
                setErrorMsg(null);
              }}
              className="w-full min-h-[44px] px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0D131F] font-bold text-xs flex items-center justify-center gap-2 hover:border-[var(--vp-secondary)] transition-colors"
            >
              <Edit3 className="w-4 h-4" />
              <span>{t('تغيير البريد', 'Change Email')}</span>
            </button>
          ) : (
            <form
              onSubmit={handleChangeEmail}
              className="p-4 rounded-2xl bg-slate-50 dark:bg-[#0D131F] border border-slate-200 dark:border-slate-800 space-y-3"
            >
              <label className="block text-xs font-bold">
                {t('البريد الإلكتروني الجديد', 'New Email Address')}
              </label>
              <input
                required
                type="email"
                dir="ltr"
                value={newEmail}
                onChange={(e) => setNewEmail(e.target.value)}
                placeholder="new@example.com"
                className="w-full min-h-[44px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] text-sm"
              />

              {needsPassword && (
                <div>
                  <label className="block text-xs font-bold mb-1">
                    {t('كلمة المرور الحالية', 'Current Password')}
                  </label>
                  <div className="relative">
                    <Lock className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" />
                    <input
                      required
                      type="password"
                      dir="ltr"
                      value={currentPassword}
                      onChange={(e) => setCurrentPassword(e.target.value)}
                      placeholder="••••••••"
                      className="w-full min-h-[44px] ps-9 pe-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] text-sm"
                    />
                  </div>
                </div>
              )}

              <div className="flex gap-2">
                <button
                  type="submit"
                  disabled={changingEmail}
                  style={{ backgroundColor: appearance.primaryColor }}
                  className="flex-1 min-h-[44px] px-4 rounded-xl text-white font-bold text-xs disabled:opacity-60"
                >
                  {changingEmail ? t('جارٍ التحديث...', 'Updating...') : t('حفظ وإرسال الرابط', 'Save & Send Link')}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setEditingEmail(false);
                    setNeedsPassword(false);
                    setErrorMsg(null);
                  }}
                  className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold"
                >
                  {t('إلغاء', 'Cancel')}
                </button>
              </div>
            </form>
          )}

          {/* 4. Return to Cart / Storefront (shows unverified email warning in checkout) */}
          <button
            type="button"
            onClick={closeVerifyEmailScreen}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700 text-slate-700 dark:text-slate-200 font-bold text-xs flex items-center justify-center gap-2 hover:border-[var(--vp-secondary)] transition-colors"
          >
            <span>
              {cart.length > 0
                ? t('العودة إلى سلة المشتريات', 'Return to Cart & Checkout')
                : t('متابعة تصفح المتجر', 'Continue Browsing Store')}
            </span>
          </button>

          {/* 5. Sign Out */}
          <button
            type="button"
            onClick={() => void logout()}
            className="w-full min-h-[44px] px-4 py-2.5 rounded-2xl border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 font-bold text-xs flex items-center justify-center gap-2 hover:bg-rose-50 dark:hover:bg-rose-950/30 transition-colors"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('تسجيل الخروج', 'Sign Out')}</span>
          </button>

          <p className="text-center text-[11px] text-slate-400 dark:text-slate-500">
            {t(
              'يتم التحقق تلقائياً كل 5 ثوانٍ وعند عودتك للصفحة',
              'Auto-checking every 5 seconds and when returning to this tab'
            )}
          </p>
        </div>
      </div>
    </div>
  );
};
