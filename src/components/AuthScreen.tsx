import React, { useEffect, useState } from 'react';
import {
  Mail,
  Lock,
  User,
  Phone,
  LogIn,
  UserPlus,
  UserCheck,
  KeyRound,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  CheckCircle2,
  X,
  AlertCircle,
} from 'lucide-react';
import { useStore } from '../store/StoreContext';

interface AuthScreenProps {
  mode?: 'page' | 'modal';
  initialView?: 'choice' | 'login' | 'register' | 'reset';
  checkoutNotice?: boolean;
  onClose?: () => void;
}

export const AuthScreen: React.FC<AuthScreenProps> = ({
  mode = 'page',
  initialView = 'choice',
  checkoutNotice = false,
  onClose,
}) => {
  const {
    locale,
    t,
    appearance,
    user,
    authReady,
    isGuest,
    loginWithEmail,
    registerWithEmail,
    continueAsGuest,
    sendPasswordReset,
  } = useStore();

  const [view, setView] = useState<'choice' | 'login' | 'register' | 'reset'>(initialView);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+249');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [resetLoading, setResetLoading] = useState(false);
  const [resetCooldown, setResetCooldown] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [resetSuccessMsg, setResetSuccessMsg] = useState<string | null>(null);
  const [showSwitchToLoginHint, setShowSwitchToLoginHint] = useState(false);

  useEffect(() => {
    setView(initialView);
    setErrorMsg(null);
    setResetSuccessMsg(null);
    setShowSwitchToLoginHint(false);
    if (initialView === 'reset' && user.email) {
      setEmail((prev) => prev || user.email);
    }
  }, [initialView, user.email]);

  useEffect(() => {
    if (resetCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResetCooldown((sec) => (sec > 1 ? sec - 1 : 0));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resetCooldown]);

  const BackIcon = locale === 'ar' ? ArrowRight : ArrowLeft;

  const switchView = (nextView: 'choice' | 'login' | 'register' | 'reset') => {
    setErrorMsg(null);
    setResetSuccessMsg(null);
    setShowSwitchToLoginHint(false);
    if (nextView === 'reset' && user.email) {
      setEmail((prev) => prev || user.email);
    }
    setView(nextView);
  };

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setShowSwitchToLoginHint(false);

    if (!email.trim() || !password) {
      setErrorMsg(t('يرجى إدخال البريد الإلكتروني وكلمة المرور.', 'Please enter email and password.'));
      return;
    }

    setLoading(true);
    try {
      await loginWithEmail(email.trim(), password);
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('تعذر تسجيل الدخول.', 'Sign in failed.'));
    } finally {
      setLoading(false);
    }
  };

  const handleRegister = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setShowSwitchToLoginHint(false);

    if (!name.trim()) {
      setErrorMsg(t('يرجى إدخال الاسم الكامل.', 'Please enter your full name.'));
      return;
    }
    if (!email.trim() || !email.includes('@')) {
      setErrorMsg(t('يرجى إدخال بريد إلكتروني صحيح.', 'Please enter a valid email address.'));
      return;
    }
    if (password.length < 6) {
      setErrorMsg(t('كلمة المرور يجب أن تكون 6 أحرف على الأقل.', 'Password must be at least 6 characters.'));
      return;
    }
    if (password !== confirmPassword) {
      setErrorMsg(t('كلمتا المرور غير متطابقتين.', 'Passwords do not match.'));
      return;
    }

    setLoading(true);
    try {
      await registerWithEmail({
        name: name.trim(),
        email: email.trim(),
        password,
        phone: phone.trim(),
      });
    } catch (err) {
      const msg = err instanceof Error ? err.message : t('تعذر إنشاء الحساب.', 'Registration failed.');
      setErrorMsg(msg);
      if (msg.includes('مسجل مسبقاً') || msg.toLowerCase().includes('already registered')) {
        setShowSwitchToLoginHint(true);
      }
    } finally {
      setLoading(false);
    }
  };

  const handleGuest = async () => {
    setErrorMsg(null);
    setResetSuccessMsg(null);
    if (mode === 'modal' && isGuest && onClose) {
      onClose();
      return;
    }
    setGuestLoading(true);
    try {
      await continueAsGuest();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('تعذر الدخول كضيف.', 'Guest sign-in failed.'));
    } finally {
      setGuestLoading(false);
    }
  };

  const handlePasswordReset = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg(null);
    setResetSuccessMsg(null);

    const targetEmail = email.trim();
    if (!targetEmail || !targetEmail.includes('@')) {
      setErrorMsg(t('يرجى إدخال بريد إلكتروني صحيح.', 'Please enter a valid email address.'));
      return;
    }

    setResetLoading(true);
    try {
      await sendPasswordReset(targetEmail);
      setResetCooldown(60);
      setResetSuccessMsg(
        t(
          `تم إرسال رابط استعادة كلمة المرور إلى (${targetEmail}). يرجى فحص البريد الوارد والرسائل غير المرغوب فيها.`,
          `A password reset link has been sent to (${targetEmail}). Please check your inbox and spam folder.`
        )
      );
    } catch (err) {
      setErrorMsg(
        err instanceof Error
          ? err.message
          : t('تعذر إرسال رابط استعادة كلمة المرور.', 'Could not send reset link.')
      );
    } finally {
      setResetLoading(false);
    }
  };

  const cardContent = (
    <div className="w-full max-w-md bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-3xl shadow-2xl overflow-hidden">
      {/* Branded Header */}
      <div
        style={{ backgroundColor: appearance.primaryColor }}
        className="px-6 py-6 text-white relative"
      >
        {mode === 'modal' && onClose && (
          <button
            type="button"
            onClick={onClose}
            aria-label={t('إغلاق', 'Close')}
            className="absolute top-4 end-4 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-xl text-white/80 hover:text-white hover:bg-white/10 transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        )}

        <div className="flex items-center gap-3">
          {appearance.logoUrl ? (
            <img
              src={appearance.logoUrl}
              alt={appearance.appNameEn}
              className="w-11 h-11 rounded-xl object-cover border border-white/20"
            />
          ) : (
            <div
              style={{ backgroundColor: appearance.secondaryColor, color: appearance.primaryColor }}
              className="w-11 h-11 rounded-xl flex items-center justify-center font-extrabold text-lg shrink-0"
              dir="ltr"
            >
              V+
            </div>
          )}
          <div>
            <div className="text-lg font-extrabold tracking-tight">
              {locale === 'ar' ? appearance.appNameAr : appearance.appNameEn}
            </div>
            <div className="text-xs text-slate-300">
              {t('تسجيل الدخول للعميل', 'Customer Account Portal')}
            </div>
          </div>
        </div>

        <h1 className="mt-4 text-xl font-extrabold leading-snug">
          {checkoutNotice
            ? t('سجّل دخولك أو أنشئ حساباً لإتمام الشراء', 'Sign in or register to complete your purchase')
            : view === 'login'
            ? t('تسجيل الدخول للعميل', 'Customer Sign In')
            : view === 'register'
            ? t('تسجيل حساب جديد', 'Create New Account')
            : view === 'reset'
            ? t('استعادة كلمة المرور', 'Reset Password')
            : t('مرحباً بك في متجر فيجن بلس', 'Welcome to Vision Plus')}
        </h1>
        <p className="mt-1 text-xs text-slate-300 leading-relaxed">
          {checkoutNotice
            ? t(
                'سيتم الحفاظ على جميع المنتجات في سلة المشتريات والمفضلة تلقائياً.',
                'All items in your cart and favorites will be preserved.'
              )
            : view === 'reset'
            ? t(
                'أدخل بريدك الإلكتروني وسنرسل لك رابطاً لإعادة تعيين كلمة المرور.',
                'Enter your email address and we will send you a password reset link.'
              )
            : view === 'choice'
            ? t(
                'اختر طريقة الدخول المناسبة للتسوق وطلب النظارات والعدسات.',
                'Choose how you would like to continue.'
              )
            : t(
                'استخدم بريدك الإلكتروني وكلمة المرور للوصول إلى حسابك وطلباتك.',
                'Use your email and password to access your account.'
              )}
        </p>
      </div>

      <div className="p-6 space-y-5">
        {errorMsg && (
          <div
            role="alert"
            className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/60 text-rose-700 dark:text-rose-300 text-xs space-y-2"
          >
            <div className="flex items-start gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 mt-0.5" />
              <span className="leading-relaxed font-semibold">{errorMsg}</span>
            </div>
            {showSwitchToLoginHint && (
              <button
                type="button"
                onClick={() => switchView('login')}
                className="min-h-[44px] w-full px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors"
              >
                {t('الانتقال إلى تسجيل الدخول', 'Switch to Sign In')}
              </button>
            )}
          </div>
        )}

        {resetSuccessMsg && (
          <div
            role="status"
            className="p-3.5 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/60 text-emerald-800 dark:text-emerald-200 text-xs flex items-start gap-2"
          >
            <CheckCircle2 className="w-4 h-4 shrink-0 mt-0.5 text-emerald-600 dark:text-emerald-400" />
            <span className="leading-relaxed font-semibold">{resetSuccessMsg}</span>
          </div>
        )}

        {/* Step 1: Entry / Modal Choice */}
        {view === 'choice' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => switchView('login')}
              style={{ backgroundColor: appearance.primaryColor }}
              className="w-full min-h-[48px] px-5 py-3 rounded-2xl text-white font-extrabold text-sm flex items-center justify-center gap-2.5 hover:opacity-95 transition-opacity"
            >
              <LogIn className="w-5 h-5" />
              <span>{t('تسجيل الدخول', 'Sign In')}</span>
            </button>

            <button
              type="button"
              onClick={() => switchView('register')}
              style={{
                backgroundColor: appearance.secondaryColor,
                color: appearance.primaryColor,
              }}
              className="w-full min-h-[48px] px-5 py-3 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2.5 hover:opacity-95 transition-opacity"
            >
              <UserPlus className="w-5 h-5" />
              <span>{t('تسجيل حساب جديد', 'Create New Account')}</span>
            </button>

            {!checkoutNotice && (
              <button
                type="button"
                disabled={guestLoading}
                onClick={handleGuest}
                className="w-full min-h-[46px] px-5 py-2.5 rounded-2xl border border-slate-200 dark:border-slate-700/80 bg-transparent hover:bg-slate-50 dark:hover:bg-slate-800/50 text-slate-700 dark:text-slate-200 font-bold text-xs sm:text-sm flex items-center justify-center gap-2 transition-colors disabled:opacity-60"
              >
                <UserCheck className="w-4 h-4 shrink-0 text-slate-500 dark:text-slate-400" />
                <span>
                  {guestLoading
                    ? t('جارٍ الدخول كضيف...', 'Entering as Guest...')
                    : t('الدخول كضيف', 'Continue as Guest')}
                </span>
              </button>
            )}

            {mode === 'modal' && onClose && (
              <button
                type="button"
                onClick={onClose}
                className="w-full min-h-[44px] px-4 py-2 rounded-xl text-xs font-semibold text-slate-500 dark:text-slate-400 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                {checkoutNotice
                  ? t('العودة إلى سلة المشتريات', 'Back to Cart')
                  : t('إغلاق ومتابعة التصفح', 'Close & Continue')}
              </button>
            )}

            <div className="pt-2 space-y-1.5 text-center text-[11px] text-slate-500 dark:text-slate-400">
              <div className="flex items-center justify-center gap-2">
                <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: appearance.secondaryColor }} />
                <span>
                  {t(
                    'تأكيد البريد الإلكتروني مطلوب قبل إتمام أي طلب لحماية حسابك',
                    'Email verification is required before placing an order'
                  )}
                </span>
              </div>
              <p className="text-slate-400 dark:text-slate-500">
                {t(
                  'يمكنك التصفح كضيف وتسجيل الدخول عند الشراء',
                  'You can browse as a guest and sign in when checking out'
                )}
              </p>
            </div>
          </div>
        )}

        {/* Step 2A: Login Form (Email + Password only) */}
        {view === 'login' && (
          <form onSubmit={handleLogin} className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-bold mb-1.5">
                {t('البريد الإلكتروني', 'Email Address')}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
                <input
                  required
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full min-h-[46px] ps-10 pe-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0D131F] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--vp-secondary)]"
                />
              </div>
            </div>

            <div>
              <div className="flex items-center justify-between gap-2 mb-1.5">
                <label className="block text-xs font-bold">
                  {t('كلمة المرور', 'Password')}
                </label>
                <button
                  type="button"
                  onClick={() => switchView('reset')}
                  className="text-xs font-bold text-[#B38B2D] dark:text-[#E2BD5B] hover:underline py-1"
                >
                  {t('نسيت كلمة المرور؟', 'Forgot password?')}
                </button>
              </div>
              <div className="relative">
                <Lock className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
                <input
                  required
                  type={showPassword ? 'text' : 'password'}
                  dir="ltr"
                  autoComplete="current-password"
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="••••••••"
                  className="w-full min-h-[46px] ps-10 pe-11 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0D131F] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--vp-secondary)]"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((s) => !s)}
                  aria-label={t('إظهار أو إخفاء كلمة المرور', 'Toggle password visibility')}
                  className="absolute top-1/2 -translate-y-1/2 end-1 min-w-[44px] min-h-[44px] flex items-center justify-center text-slate-400 hover:text-slate-600"
                >
                  {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                </button>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{ backgroundColor: appearance.primaryColor }}
              className="w-full min-h-[48px] px-5 py-3 rounded-2xl text-white font-extrabold text-sm flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-60 transition-opacity"
            >
              <LogIn className="w-4 h-4" />
              <span>{loading ? t('جارٍ تسجيل الدخول...', 'Signing in...') : t('تسجيل الدخول', 'Sign In')}</span>
            </button>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => switchView('choice')}
                className="min-h-[44px] px-2 inline-flex items-center gap-1.5 text-slate-500 hover:text-[#11223E] dark:hover:text-white font-semibold"
              >
                <BackIcon className="w-4 h-4" />
                <span>{t('الرجوع للخيارات', 'Back')}</span>
              </button>

              <button
                type="button"
                onClick={() => switchView('register')}
                className="min-h-[44px] px-2 font-bold text-[#B38B2D] dark:text-[#E2BD5B] hover:underline"
              >
                {t('تسجيل حساب جديد', 'Create new account')}
              </button>
            </div>
          </form>
        )}

        {/* Step 2B: Register Form (Email + Password + Name + Contact Phone) */}
        {view === 'register' && (
          <form onSubmit={handleRegister} className="space-y-3.5 text-sm">
            <div>
              <label className="block text-xs font-bold mb-1">
                {t('الاسم الكامل', 'Full Name')} *
              </label>
              <div className="relative">
                <User className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
                <input
                  required
                  type="text"
                  autoComplete="name"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder={t('مثال: محمد مصطفى عبد الله', 'Full name')}
                  className="w-full min-h-[44px] ps-10 pe-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0D131F] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--vp-secondary)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">
                {t('البريد الإلكتروني', 'Email Address')} *
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
                <input
                  required
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full min-h-[44px] ps-10 pe-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0D131F] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--vp-secondary)]"
                />
              </div>
            </div>

            <div>
              <label className="block text-xs font-bold mb-1">
                {t('رقم الهاتف للتواصل (اختياري، بدون OTP)', 'Contact Phone (optional, no OTP)')}
              </label>
              <div className="relative">
                <Phone className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
                <input
                  type="tel"
                  dir="ltr"
                  autoComplete="tel"
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  placeholder="+249912345678"
                  className="w-full min-h-[44px] ps-10 pe-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0D131F] text-sm font-mono-num focus:outline-none focus:ring-2 focus:ring-[var(--vp-secondary)]"
                />
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-bold mb-1">
                  {t('كلمة المرور', 'Password')} *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" />
                  <input
                    required
                    type={showPassword ? 'text' : 'password'}
                    dir="ltr"
                    minLength={6}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full min-h-[44px] ps-9 pe-9 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0D131F] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--vp-secondary)]"
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword((s) => !s)}
                    aria-label={t('إظهار كلمة المرور', 'Show password')}
                    className="absolute top-1/2 -translate-y-1/2 end-1 min-w-[36px] min-h-[36px] flex items-center justify-center text-slate-400"
                  >
                    {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  </button>
                </div>
              </div>

              <div>
                <label className="block text-xs font-bold mb-1">
                  {t('تأكيد كلمة المرور', 'Confirm Password')} *
                </label>
                <div className="relative">
                  <Lock className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3" />
                  <input
                    required
                    type={showPassword ? 'text' : 'password'}
                    dir="ltr"
                    minLength={6}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    placeholder="••••••"
                    className="w-full min-h-[44px] ps-9 pe-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0D131F] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--vp-secondary)]"
                  />
                </div>
              </div>
            </div>

            <button
              type="submit"
              disabled={loading}
              style={{
                backgroundColor: appearance.secondaryColor,
                color: appearance.primaryColor,
              }}
              className="w-full min-h-[48px] px-5 py-3 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-60 transition-opacity"
            >
              <UserPlus className="w-4 h-4" />
              <span>
                {loading ? t('جارٍ إنشاء الحساب...', 'Creating account...') : t('تسجيل حساب جديد', 'Create Account')}
              </span>
            </button>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => switchView('choice')}
                className="min-h-[44px] px-2 inline-flex items-center gap-1.5 text-slate-500 hover:text-[#11223E] dark:hover:text-white font-semibold"
              >
                <BackIcon className="w-4 h-4" />
                <span>{t('الرجوع للخيارات', 'Back')}</span>
              </button>

              <button
                type="button"
                onClick={() => switchView('login')}
                className="min-h-[44px] px-2 font-bold text-[#B38B2D] dark:text-[#E2BD5B] hover:underline"
              >
                {t('لديك حساب بالفعل؟ تسجيل الدخول', 'Already registered? Sign In')}
              </button>
            </div>
          </form>
        )}

        {/* Step 2C: Forgot Password Form */}
        {view === 'reset' && (
          <form onSubmit={handlePasswordReset} className="space-y-4 text-sm">
            <div>
              <label className="block text-xs font-bold mb-1.5">
                {t('البريد الإلكتروني المسجل', 'Registered Email Address')}
              </label>
              <div className="relative">
                <Mail className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3.5" />
                <input
                  required
                  type="email"
                  dir="ltr"
                  autoComplete="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="name@example.com"
                  className="w-full min-h-[46px] ps-10 pe-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0D131F] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--vp-secondary)]"
                />
              </div>
            </div>

            <button
              type="submit"
              disabled={resetLoading || resetCooldown > 0}
              style={{ backgroundColor: appearance.primaryColor }}
              className="w-full min-h-[48px] px-5 py-3 rounded-2xl text-white font-extrabold text-sm flex items-center justify-center gap-2 hover:opacity-95 disabled:opacity-60 transition-opacity"
            >
              <KeyRound className="w-4 h-4" />
              <span>
                {resetLoading
                  ? t('جارٍ إرسال الرابط...', 'Sending reset link...')
                  : resetCooldown > 0
                  ? t(
                      `إعادة الإرسال بعد ${resetCooldown} ثانية`,
                      `Resend available in ${resetCooldown}s`
                    )
                  : t('إرسال رابط استعادة كلمة المرور', 'Send Password Reset Link')}
              </span>
            </button>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => switchView('choice')}
                className="min-h-[44px] px-2 inline-flex items-center gap-1.5 text-slate-500 hover:text-[#11223E] dark:hover:text-white font-semibold"
              >
                <BackIcon className="w-4 h-4" />
                <span>{t('الرجوع للخيارات', 'Back')}</span>
              </button>

              <button
                type="button"
                onClick={() => switchView('login')}
                className="min-h-[44px] px-2 font-bold text-[#B38B2D] dark:text-[#E2BD5B] hover:underline"
              >
                {t('العودة لتسجيل الدخول', 'Back to Sign In')}
              </button>
            </div>
          </form>
        )}
      </div>
    </div>
  );

  if (mode === 'modal') {
    return (
      <div
        role="dialog"
        aria-modal="true"
        className="fixed inset-0 z-[70] bg-black/65 backdrop-blur-xs overflow-y-auto p-4 flex items-center justify-center"
      >
        {cardContent}
      </div>
    );
  }

  if (!authReady) {
    return (
      <div className="min-h-[100dvh] bg-[#F8F9FA] dark:bg-[#0D131F] text-[#11223E] dark:text-slate-100 flex items-center justify-center p-6">
        <div className="text-center space-y-3">
          <div className="w-8 h-8 mx-auto rounded-full border-[3px] border-slate-200 dark:border-slate-700 border-t-[#D9B24C] animate-spin" />
          <p className="text-sm font-bold">{t('جارٍ التحميل...', 'Loading...')}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-[100dvh] bg-[#F8F9FA] dark:bg-[#0D131F] text-[#11223E] dark:text-slate-100 flex items-center justify-center p-4">
      {cardContent}
    </div>
  );
};
