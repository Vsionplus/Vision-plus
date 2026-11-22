import React, { useState } from 'react';
import {
  Mail,
  Lock,
  User,
  Phone,
  LogIn,
  UserPlus,
  UserCheck,
  Eye,
  EyeOff,
  ArrowRight,
  ArrowLeft,
  ShieldCheck,
  X,
  AlertCircle,
} from 'lucide-react';
import { useStore } from '../store/StoreContext';

interface AuthScreenProps {
  mode?: 'page' | 'modal';
  initialView?: 'choice' | 'login' | 'register';
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
    loginWithEmail,
    registerWithEmail,
    continueAsGuest,
    isGuest,
  } = useStore();

  const [view, setView] = useState<'choice' | 'login' | 'register'>(initialView);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('+249');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [showSwitchToLoginHint, setShowSwitchToLoginHint] = useState(false);

  const BackIcon = locale === 'ar' ? ArrowRight : ArrowLeft;

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
    setGuestLoading(true);
    try {
      await continueAsGuest();
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : t('تعذر الدخول كضيف.', 'Guest sign-in failed.'));
    } finally {
      setGuestLoading(false);
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
              {locale === 'ar' ? appearance.appNameEn : appearance.appNameAr}
            </div>
          </div>
        </div>

        <h1 className="mt-4 text-xl font-extrabold leading-snug">
          {checkoutNotice
            ? t('سجّل دخولك أو أنشئ حساباً لإتمام الشراء', 'Sign in or register to complete your purchase')
            : view === 'login'
            ? t('تسجيل الدخول', 'Sign In')
            : view === 'register'
            ? t('إنشاء حساب جديد', 'Create New Account')
            : t('مرحباً بك في متجر فيجن بلس', 'Welcome to Vision Plus')}
        </h1>
        <p className="mt-1 text-xs text-slate-300 leading-relaxed">
          {checkoutNotice
            ? t(
                'سيتم الحفاظ على جميع المنتجات في سلة المشتريات والمفضلة تلقائياً.',
                'All items in your cart and favorites will be preserved.'
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
                onClick={() => {
                  setErrorMsg(null);
                  setShowSwitchToLoginHint(false);
                  setView('login');
                }}
                className="min-h-[44px] w-full px-3 py-2 rounded-lg bg-rose-600 hover:bg-rose-700 text-white font-bold text-xs transition-colors"
              >
                {t('الانتقال إلى تسجيل الدخول', 'Switch to Sign In')}
              </button>
            )}
          </div>
        )}

        {/* Step 1: Entry / Modal Choice */}
        {view === 'choice' && (
          <div className="space-y-3">
            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setView('login');
              }}
              style={{ backgroundColor: appearance.primaryColor }}
              className="w-full min-h-[48px] px-5 py-3 rounded-2xl text-white font-extrabold text-sm flex items-center justify-center gap-2.5 hover:opacity-95 transition-opacity"
            >
              <LogIn className="w-5 h-5" />
              <span>{t('تسجيل الدخول', 'Sign In')}</span>
            </button>

            <button
              type="button"
              onClick={() => {
                setErrorMsg(null);
                setView('register');
              }}
              style={{
                backgroundColor: appearance.secondaryColor,
                color: appearance.primaryColor,
              }}
              className="w-full min-h-[48px] px-5 py-3 rounded-2xl font-extrabold text-sm flex items-center justify-center gap-2.5 hover:opacity-95 transition-opacity"
            >
              <UserPlus className="w-5 h-5" />
              <span>{t('إنشاء حساب جديد', 'Create New Account')}</span>
            </button>

            {mode === 'page' && !isGuest && !checkoutNotice && (
              <button
                type="button"
                disabled={guestLoading}
                onClick={handleGuest}
                className="w-full min-h-[48px] px-5 py-3 rounded-2xl border-2 border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0D131F] text-[#11223E] dark:text-slate-100 font-bold text-sm flex items-center justify-center gap-2.5 hover:border-[var(--vp-secondary)] transition-colors disabled:opacity-60"
              >
                <UserCheck className="w-5 h-5" style={{ color: appearance.secondaryColor }} />
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
                {t('العودة إلى سلة المشتريات', 'Back to Cart')}
              </button>
            )}

            <div className="pt-2 flex items-center justify-center gap-2 text-[11px] text-slate-500 dark:text-slate-400">
              <ShieldCheck className="w-4 h-4 shrink-0" style={{ color: appearance.secondaryColor }} />
              <span>
                {t(
                  'تأكيد البريد الإلكتروني مطلوب قبل إتمام أي طلب لحماية حسابك',
                  'Email verification is required before placing an order'
                )}
              </span>
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
              <label className="block text-xs font-bold mb-1.5">
                {t('كلمة المرور', 'Password')}
              </label>
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
                onClick={() => {
                  setErrorMsg(null);
                  setView('choice');
                }}
                className="min-h-[44px] px-2 inline-flex items-center gap-1.5 text-slate-500 hover:text-[#11223E] dark:hover:text-white font-semibold"
              >
                <BackIcon className="w-4 h-4" />
                <span>{t('الرجوع للخيارات', 'Back')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setView('register');
                }}
                className="min-h-[44px] px-2 font-bold text-[#B38B2D] dark:text-[#E2BD5B] hover:underline"
              >
                {t('ليس لديك حساب؟ أنشئ حساباً جديداً', 'Create new account')}
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
                {loading ? t('جارٍ إنشاء الحساب...', 'Creating account...') : t('إنشاء حساب جديد', 'Create Account')}
              </span>
            </button>

            <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setView('choice');
                }}
                className="min-h-[44px] px-2 inline-flex items-center gap-1.5 text-slate-500 hover:text-[#11223E] dark:hover:text-white font-semibold"
              >
                <BackIcon className="w-4 h-4" />
                <span>{t('الرجوع للخيارات', 'Back')}</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setErrorMsg(null);
                  setView('login');
                }}
                className="min-h-[44px] px-2 font-bold text-[#B38B2D] dark:text-[#E2BD5B] hover:underline"
              >
                {t('لديك حساب بالفعل؟ تسجيل الدخول', 'Already registered? Sign In')}
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

  return (
    <div className="min-h-[100dvh] bg-[#F8F9FA] dark:bg-[#0D131F] text-[#11223E] dark:text-slate-100 flex items-center justify-center p-4">
      {cardContent}
    </div>
  );
};
