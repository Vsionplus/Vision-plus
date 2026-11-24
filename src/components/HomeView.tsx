import React, { useEffect, useMemo, useState } from 'react';
import {
  Stethoscope,
  ArrowLeft,
  ArrowRight,
  ChevronLeft,
  ChevronRight,
  MessageCircle,
  Megaphone,
  LogIn,
  LogOut,
  UserPlus,
  UserCheck,
  KeyRound,
  User,
} from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { BannerAd, HomeSectionConfig } from '../types';
import { ProductCard } from './ProductCard';
import { ResilientImage } from './ResilientImage';

export const HomeView: React.FC = () => {
  const {
    locale,
    t,
    banners,
    visibleCategories,
    visibleProducts,
    homeSections,
    appTexts,
    appearance,
    settings,
    openCatalog,
    openProduct,
    setActiveTab,
    user,
    isGuest,
    openAuthModal,
    continueAsGuest,
    logout,
  } = useStore();

  const [bannerIndex, setBannerIndex] = useState(0);
  const [guestSwitchBusy, setGuestSwitchBusy] = useState(false);

  const today = new Date().toISOString().slice(0, 10);

  const activeTopBanners = useMemo(
    () =>
      banners
        .filter(
          (b) =>
            b.isActive &&
            b.placement === 'home_top' &&
            b.startDate <= today &&
            b.endDate >= today
        )
        .sort((a, b) => a.order - b.order),
    [banners, today]
  );

  const activeMiddleBanner = useMemo(
    () =>
      banners
        .filter(
          (b) =>
            b.isActive &&
            b.placement === 'home_middle' &&
            b.startDate <= today &&
            b.endDate >= today
        )
        .sort((a, b) => a.order - b.order)[0],
    [banners, today]
  );

  useEffect(() => {
    if (activeTopBanners.length <= 1) return;
    const timer = window.setInterval(() => {
      setBannerIndex((prev) => (prev + 1) % activeTopBanners.length);
    }, 5500);
    return () => window.clearInterval(timer);
  }, [activeTopBanners.length]);

  const handleBannerTap = (b: BannerAd) => {
    if (b.targetType === 'category') openCatalog(b.targetValue, '');
    else if (b.targetType === 'product') openProduct(b.targetValue);
    else if (b.targetType === 'consult') setActiveTab('consult');
    else if (b.targetType === 'url' && b.targetValue)
      window.open(b.targetValue, '_blank', 'noopener,noreferrer');
  };

  const featuredProducts = useMemo(
    () => visibleProducts.filter((p) => p.isFeatured).slice(0, 6),
    [visibleProducts]
  );
  const newArrivalProducts = useMemo(
    () => visibleProducts.filter((p) => p.isNewArrival).slice(0, 6),
    [visibleProducts]
  );
  const offerProducts = useMemo(
    () =>
      visibleProducts
        .filter((p) => p.isOnOffer || (p.oldPriceSdg && p.oldPriceSdg > p.priceSdg))
        .slice(0, 6),
    [visibleProducts]
  );

  const activeBanner = activeTopBanners[bannerIndex % Math.max(1, activeTopBanners.length)];

  const ArrowIcon = locale === 'ar' ? ArrowLeft : ArrowRight;

  const orderedSections = useMemo(
    () =>
      homeSections
        .filter((s) => s.enabled)
        .slice()
        .sort((a, b) => a.order - b.order),
    [homeSections]
  );

  const renderSection = (sec: HomeSectionConfig) => {
    switch (sec.id) {
      case 'announcement': {
        const msg = locale === 'ar' ? appTexts.announcementTextAr : appTexts.announcementTextEn;
        if (!msg.trim()) return null;
        return (
          <div
            key={sec.id}
            style={
              sec.styleVariant === 'highlight'
                ? { backgroundColor: appearance.primaryColor, color: '#FFFFFF' }
                : undefined
            }
            className={`rounded-2xl px-4 py-2.5 text-xs font-bold flex items-center justify-center gap-2 text-center ${
              sec.styleVariant === 'highlight'
                ? ''
                : 'bg-slate-100 dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800'
            }`}
          >
            <Megaphone className="w-4 h-4 shrink-0" style={{ color: appearance.secondaryColor }} />
            <span>{msg}</span>
          </div>
        );
      }

      case 'banners':
        if (!activeBanner) return null;
        return (
          <section key={sec.id} aria-label={locale === 'ar' ? sec.titleAr : sec.titleEn}>
            <div
              className="relative rounded-3xl overflow-hidden border border-slate-200 dark:border-slate-800 min-h-[260px] sm:min-h-[340px] lg:min-h-[380px]"
              style={{ backgroundColor: appearance.primaryColor }}
            >
              <ResilientImage
                src={activeBanner.image}
                alt={locale === 'ar' ? activeBanner.titleAr : activeBanner.titleEn}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t sm:bg-gradient-to-l from-black/80 via-black/45 to-black/20" />

              <div className="relative z-10 h-full min-h-[260px] sm:min-h-[340px] lg:min-h-[380px] p-6 sm:p-10 lg:p-12 flex flex-col justify-between">
                <div className="max-w-xl space-y-2.5 pt-2 sm:pt-4">
                  <p className="text-xs sm:text-sm font-bold" style={{ color: appearance.secondaryColor }}>
                    {locale === 'ar' ? appTexts.welcomeLineAr : appTexts.welcomeLineEn}
                  </p>
                  <h1 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight [text-wrap:balance]">
                    {locale === 'ar' ? activeBanner.titleAr : activeBanner.titleEn}
                  </h1>
                  <p className="text-xs sm:text-base text-slate-200 leading-relaxed max-w-md">
                    {locale === 'ar' ? activeBanner.subtitleAr : activeBanner.subtitleEn}
                  </p>
                </div>

                <div className="pt-6 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => handleBannerTap(activeBanner)}
                    style={{ backgroundColor: appearance.secondaryColor, color: appearance.primaryColor }}
                    className="px-6 py-3 rounded-xl text-sm font-extrabold inline-flex items-center gap-2 shadow-md transition-opacity hover:opacity-90 whitespace-nowrap"
                  >
                    <span>{locale === 'ar' ? activeBanner.ctaAr : activeBanner.ctaEn}</span>
                    <ArrowIcon className="w-4 h-4" />
                  </button>

                  {activeTopBanners.length > 1 && (
                    <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-black/35 backdrop-blur-xs">
                      {activeTopBanners.map((b, i) => (
                        <button
                          key={b.id}
                          type="button"
                          onClick={() => setBannerIndex(i)}
                          aria-label={`Slide ${i + 1}`}
                          style={
                            i === bannerIndex % activeTopBanners.length
                              ? { backgroundColor: appearance.secondaryColor }
                              : undefined
                          }
                          className={`h-2 rounded-full transition-all ${
                            i === bannerIndex % activeTopBanners.length
                              ? 'w-7'
                              : 'w-2 bg-white/55'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>

              {activeTopBanners.length > 1 && (
                <>
                  <button
                    type="button"
                    onClick={() =>
                      setBannerIndex(
                        (prev) => (prev - 1 + activeTopBanners.length) % activeTopBanners.length
                      )
                    }
                    aria-label={t('السابق', 'Previous')}
                    className="hidden sm:flex absolute top-1/2 -translate-y-1/2 start-3 z-20 w-9 h-9 rounded-full bg-black/35 hover:bg-black/55 text-white items-center justify-center backdrop-blur-xs"
                  >
                    <ChevronRight className="w-5 h-5 rtl:rotate-0 ltr:rotate-180" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setBannerIndex((prev) => (prev + 1) % activeTopBanners.length)}
                    aria-label={t('التالي', 'Next')}
                    className="hidden sm:flex absolute top-1/2 -translate-y-1/2 end-3 z-20 w-9 h-9 rounded-full bg-black/35 hover:bg-black/55 text-white items-center justify-center backdrop-blur-xs"
                  >
                    <ChevronLeft className="w-5 h-5 rtl:rotate-0 ltr:rotate-180" />
                  </button>
                </>
              )}
            </div>
          </section>
        );

      case 'categories':
        return (
          <section key={sec.id} aria-labelledby="categories-heading" className="space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 id="categories-heading" className="text-lg sm:text-xl font-extrabold">
                {locale === 'ar' ? sec.titleAr : sec.titleEn}
              </h2>
              <button
                type="button"
                onClick={() => openCatalog('all', '')}
                className="text-xs sm:text-sm font-bold text-[#11223E] dark:text-[#E2BD5B] hover:underline inline-flex items-center gap-1"
              >
                {locale === 'ar' ? sec.ctaAr || 'عرض الكل' : sec.ctaEn || 'View all'}
                <ArrowIcon className="w-4 h-4" />
              </button>
            </div>

            <div
              className={`grid gap-3 ${
                sec.styleVariant === 'compact'
                  ? 'grid-cols-3 sm:grid-cols-6'
                  : 'grid-cols-2 sm:grid-cols-3 lg:grid-cols-6'
              }`}
            >
              {visibleCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => openCatalog(cat.id, '')}
                  className="group text-start bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden hover:border-[var(--vp-secondary)] transition-colors shadow-2xs"
                >
                  <div className="aspect-[4/3] bg-slate-100 dark:bg-slate-900 overflow-hidden">
                    <ResilientImage
                      src={cat.image}
                      alt={locale === 'ar' ? cat.nameAr : cat.nameEn}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <div className="p-3 text-center">
                    <h3 className="text-xs sm:text-sm font-bold text-[#11223E] dark:text-slate-100 truncate">
                      {locale === 'ar' ? cat.nameAr : cat.nameEn}
                    </h3>
                  </div>
                </button>
              ))}
            </div>
          </section>
        );

      case 'consult_card':
        return (
          <section key={sec.id} aria-label={locale === 'ar' ? sec.titleAr : sec.titleEn}>
            <div
              className="text-white rounded-2xl p-6 sm:p-8 flex flex-col md:flex-row items-start md:items-center justify-between gap-6"
              style={{ backgroundColor: appearance.primaryColor }}
            >
              <div className="flex items-start gap-4 max-w-2xl">
                <div
                  className="w-12 h-12 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: `${appearance.secondaryColor}33`,
                    color: appearance.secondaryColor,
                  }}
                >
                  <Stethoscope className="w-6 h-6" />
                </div>
                <div>
                  <h2 className="text-lg sm:text-xl font-bold">
                    {locale === 'ar'
                      ? sec.titleAr || appTexts.consultCardTitleAr
                      : sec.titleEn || appTexts.consultCardTitleEn}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-300 mt-1 leading-relaxed">
                    {locale === 'ar'
                      ? sec.subtitleAr || appTexts.consultCardDescAr
                      : sec.subtitleEn || appTexts.consultCardDescEn}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-3 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('consult')}
                  style={{
                    backgroundColor: appearance.secondaryColor,
                    color: appearance.primaryColor,
                  }}
                  className="px-5 py-2.5 rounded-xl text-sm font-extrabold transition-opacity hover:opacity-90 whitespace-nowrap"
                >
                  {locale === 'ar'
                    ? sec.ctaAr || appTexts.consultCardCtaAr
                    : sec.ctaEn || appTexts.consultCardCtaEn}
                </button>
                {settings.contactVisibility.whatsapp && settings.whatsapp.trim() && (
                  <a
                    href={`https://wa.me/${settings.whatsapp.replace(/[^\d]/g, '')}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="px-4 py-2.5 rounded-xl border border-white/25 hover:bg-white/10 text-sm font-semibold inline-flex items-center gap-2 whitespace-nowrap"
                  >
                    <MessageCircle className="w-4 h-4 text-[#4ADE80]" />
                    {t('واتساب', 'WhatsApp')}
                  </a>
                )}
              </div>
            </div>
          </section>
        );

      case 'featured':
      case 'new_arrivals':
      case 'offers': {
        const list =
          sec.id === 'featured'
            ? featuredProducts
            : sec.id === 'new_arrivals'
            ? newArrivalProducts
            : offerProducts;
        if (list.length === 0) return null;
        return (
          <section key={sec.id} className="space-y-4">
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg sm:text-xl font-extrabold">
                {locale === 'ar' ? sec.titleAr : sec.titleEn}
              </h2>
              <button
                type="button"
                onClick={() => openCatalog('all', '')}
                className="text-xs font-bold text-[#11223E] dark:text-[#E2BD5B] hover:underline inline-flex items-center gap-1"
              >
                {t('عرض الكل', 'View all')}
                <ArrowIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-6">
              {list.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>
          </section>
        );
      }

      case 'mid_banner':
        if (!activeMiddleBanner) return null;
        return (
          <section key={sec.id} aria-label={locale === 'ar' ? sec.titleAr : sec.titleEn}>
            <div className="rounded-2xl overflow-hidden border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131C2E] grid md:grid-cols-12 items-stretch">
              <div className="md:col-span-5 min-h-[200px]">
                <ResilientImage
                  src={activeMiddleBanner.image}
                  alt={locale === 'ar' ? activeMiddleBanner.titleAr : activeMiddleBanner.titleEn}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="md:col-span-7 p-6 sm:p-8 flex flex-col justify-center gap-3">
                <h3 className="text-xl sm:text-2xl font-bold">
                  {locale === 'ar' ? activeMiddleBanner.titleAr : activeMiddleBanner.titleEn}
                </h3>
                <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {locale === 'ar' ? activeMiddleBanner.subtitleAr : activeMiddleBanner.subtitleEn}
                </p>
                <div className="pt-2">
                  <button
                    type="button"
                    onClick={() => handleBannerTap(activeMiddleBanner)}
                    style={{ backgroundColor: appearance.primaryColor }}
                    className="px-5 py-2.5 rounded-xl text-white text-sm font-bold inline-flex items-center gap-2 hover:opacity-90 transition-opacity"
                  >
                    <span>{locale === 'ar' ? activeMiddleBanner.ctaAr : activeMiddleBanner.ctaEn}</span>
                    <ArrowIcon className="w-4 h-4" />
                  </button>
                </div>
              </div>
            </div>
          </section>
        );

      default:
        return null;
    }
  };

  const handleGuestSwitch = async () => {
    setGuestSwitchBusy(true);
    try {
      await continueAsGuest();
    } finally {
      setGuestSwitchBusy(false);
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 space-y-8">
      {/* Customer Auth & Account Control Bar */}
      <section
        aria-label={t('بوابة العميل', 'Customer Account Portal')}
        className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-2xl p-4 sm:p-5 shadow-2xs flex flex-col lg:flex-row lg:items-center lg:justify-between gap-4"
      >
        <div className="flex items-start sm:items-center gap-3">
          <div
            style={{ backgroundColor: appearance.primaryColor, color: appearance.secondaryColor }}
            className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
          >
            <User className="w-5 h-5" />
          </div>
          <div className="min-w-0">
            <div className="flex flex-wrap items-center gap-2">
              <h2 className="text-sm sm:text-base font-extrabold text-[#11223E] dark:text-white">
                {t('تسجيل الدخول للعميل', 'Customer Account')}
              </h2>
              <span
                className={`px-2 py-0.5 rounded-full text-[11px] font-bold ${
                  isGuest
                    ? 'bg-amber-100 text-amber-800 dark:bg-amber-950/50 dark:text-amber-200'
                    : 'bg-emerald-100 text-emerald-800 dark:bg-emerald-950/50 dark:text-emerald-200'
                }`}
              >
                {isGuest
                  ? t('تصفح كضيف', 'Guest Mode')
                  : t(`مرحباً، ${user.name}`, `Welcome, ${user.name}`)}
              </span>
            </div>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
              {isGuest
                ? t(
                    'سجّل دخولك أو أنشئ حساباً جديداً لحفظ طلباتك وعناوينك وإتمام الشراء بسهولة.',
                    'Sign in or register to save orders, addresses, and complete checkout.'
                  )
                : user.email}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => openAuthModal('login', false)}
            style={{ backgroundColor: appearance.primaryColor }}
            className="min-h-[44px] px-4 py-2 rounded-xl text-white text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 hover:opacity-95 transition-opacity whitespace-nowrap"
          >
            <LogIn className="w-4 h-4" />
            <span>{t('تسجيل الدخول', 'Sign In')}</span>
          </button>

          <button
            type="button"
            onClick={() => openAuthModal('register', false)}
            style={{
              backgroundColor: appearance.secondaryColor,
              color: appearance.primaryColor,
            }}
            className="min-h-[44px] px-4 py-2 rounded-xl text-xs sm:text-sm font-extrabold inline-flex items-center gap-1.5 hover:opacity-95 transition-opacity whitespace-nowrap"
          >
            <UserPlus className="w-4 h-4" />
            <span>{t('تسجيل حساب جديد', 'Create Account')}</span>
          </button>

          <button
            type="button"
            disabled={guestSwitchBusy}
            onClick={() => void handleGuestSwitch()}
            className={`min-h-[44px] px-3.5 py-2 rounded-xl border text-xs sm:text-sm font-bold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap disabled:opacity-60 ${
              isGuest
                ? 'border-[#D9B24C] bg-amber-50/70 dark:bg-amber-950/30 text-[#11223E] dark:text-[#E2BD5B]'
                : 'border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-200'
            }`}
          >
            <UserCheck className="w-4 h-4" />
            <span>
              {guestSwitchBusy
                ? t('جارٍ التحويل...', 'Switching...')
                : t('الدخول كضيف', 'Continue as Guest')}
            </span>
          </button>

          <button
            type="button"
            onClick={() => openAuthModal('reset', false)}
            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-bold text-[#B38B2D] dark:text-[#E2BD5B] inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <KeyRound className="w-4 h-4" />
            <span>{t('نسيت كلمة المرور؟', 'Forgot Password?')}</span>
          </button>

          <button
            type="button"
            onClick={() => void logout()}
            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-900/60 bg-rose-50/70 dark:bg-rose-950/30 hover:bg-rose-100 dark:hover:bg-rose-950/50 text-xs sm:text-sm font-bold text-rose-700 dark:text-rose-300 inline-flex items-center gap-1.5 transition-colors whitespace-nowrap"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('تسجيل الخروج', 'Sign Out')}</span>
          </button>
        </div>
      </section>

      {orderedSections.map((sec) => renderSection(sec))}
    </div>
  );
};
