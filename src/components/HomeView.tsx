import React, { useEffect, useMemo, useState } from 'react';
import { Stethoscope, ArrowLeft, ArrowRight, MessageCircle } from 'lucide-react';
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
  } = useStore();

  const [bannerIndex, setBannerIndex] = useState(0);

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
    }, 6000);
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
          <p
            key={sec.id}
            className="text-center text-xs font-semibold text-slate-600 dark:text-slate-300 py-2 border-b border-slate-200/70 dark:border-slate-800/70"
          >
            {msg}
          </p>
        );
      }

      case 'banners':
        if (!activeBanner) return null;
        return (
          <section key={sec.id} aria-label={locale === 'ar' ? sec.titleAr : sec.titleEn}>
            <div
              className="relative rounded-2xl overflow-hidden min-h-[240px] sm:min-h-[320px]"
              style={{ backgroundColor: appearance.primaryColor }}
            >
              <ResilientImage
                src={activeBanner.image}
                alt={locale === 'ar' ? activeBanner.titleAr : activeBanner.titleEn}
                className="absolute inset-0 w-full h-full object-cover"
              />
              <div className="absolute inset-0 bg-gradient-to-t sm:bg-gradient-to-l from-black/75 via-black/40 to-black/15" />

              <div className="relative z-10 h-full min-h-[240px] sm:min-h-[320px] p-6 sm:p-10 flex flex-col justify-between">
                <div className="max-w-lg space-y-2 pt-2">
                  <h1 className="text-2xl sm:text-4xl font-extrabold text-white leading-tight [text-wrap:balance]">
                    {locale === 'ar' ? activeBanner.titleAr : activeBanner.titleEn}
                  </h1>
                  <p className="text-xs sm:text-sm text-slate-200 leading-relaxed max-w-md">
                    {locale === 'ar' ? activeBanner.subtitleAr : activeBanner.subtitleEn}
                  </p>
                </div>

                <div className="pt-6 flex items-center justify-between gap-4">
                  <button
                    type="button"
                    onClick={() => handleBannerTap(activeBanner)}
                    style={{ backgroundColor: appearance.secondaryColor, color: appearance.primaryColor }}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl text-sm font-extrabold inline-flex items-center gap-2 hover:opacity-90 transition-opacity whitespace-nowrap"
                  >
                    <span>{locale === 'ar' ? activeBanner.ctaAr : activeBanner.ctaEn}</span>
                    <ArrowIcon className="w-4 h-4" />
                  </button>

                  {activeTopBanners.length > 1 && (
                    <div className="flex items-center gap-1.5">
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
                              ? 'w-6'
                              : 'w-2 bg-white/55'
                          }`}
                        />
                      ))}
                    </div>
                  )}
                </div>
              </div>
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

            <div className="grid grid-cols-3 sm:grid-cols-6 gap-3 sm:gap-4">
              {visibleCategories.map((cat) => (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => openCatalog(cat.id, '')}
                  className="group text-center space-y-2"
                >
                  <div className="aspect-[4/3] rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200/80 dark:border-slate-800 overflow-hidden group-hover:border-[var(--vp-secondary)] transition-colors">
                    <ResilientImage
                      src={cat.image}
                      alt={locale === 'ar' ? cat.nameAr : cat.nameEn}
                      className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-105"
                    />
                  </div>
                  <h3 className="text-xs sm:text-sm font-bold text-[#11223E] dark:text-slate-100 truncate">
                    {locale === 'ar' ? cat.nameAr : cat.nameEn}
                  </h3>
                </button>
              ))}
            </div>
          </section>
        );

      case 'consult_card':
        return (
          <section
            key={sec.id}
            aria-label={locale === 'ar' ? sec.titleAr : sec.titleEn}
            className="border-t border-slate-200/70 dark:border-slate-800/70 pt-8"
          >
            <div className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-6 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-5">
              <div className="flex items-start gap-3.5 max-w-xl">
                <div
                  className="w-11 h-11 rounded-xl flex items-center justify-center shrink-0"
                  style={{
                    backgroundColor: `${appearance.secondaryColor}22`,
                    color: appearance.secondaryColor,
                  }}
                >
                  <Stethoscope className="w-5 h-5" />
                </div>
                <div>
                  <h2 className="text-base sm:text-lg font-extrabold">
                    {locale === 'ar'
                      ? sec.titleAr || appTexts.consultCardTitleAr
                      : sec.titleEn || appTexts.consultCardTitleEn}
                  </h2>
                  <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 mt-1 leading-relaxed">
                    {locale === 'ar'
                      ? sec.subtitleAr || appTexts.consultCardDescAr
                      : sec.subtitleEn || appTexts.consultCardDescEn}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('consult')}
                  style={{ backgroundColor: appearance.primaryColor }}
                  className="min-h-[44px] px-5 py-2.5 rounded-xl text-white text-xs sm:text-sm font-bold hover:opacity-90 transition-opacity whitespace-nowrap"
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
                    className="min-h-[44px] px-4 py-2.5 rounded-xl border border-slate-200 dark:border-slate-700 hover:bg-slate-50 dark:hover:bg-slate-800 text-xs sm:text-sm font-semibold inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <MessageCircle className="w-4 h-4 text-emerald-600" />
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
          <section
            key={sec.id}
            className="space-y-4 border-t border-slate-200/70 dark:border-slate-800/70 pt-8"
          >
            <div className="flex items-baseline justify-between">
              <h2 className="text-lg sm:text-xl font-extrabold">
                {locale === 'ar' ? sec.titleAr : sec.titleEn}
              </h2>
              <button
                type="button"
                onClick={() => openCatalog('all', '')}
                className="text-xs sm:text-sm font-bold text-[#11223E] dark:text-[#E2BD5B] hover:underline inline-flex items-center gap-1"
              >
                {t('عرض الكل', 'View all')}
                <ArrowIcon className="w-4 h-4" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5 sm:gap-6">
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
          <section
            key={sec.id}
            aria-label={locale === 'ar' ? sec.titleAr : sec.titleEn}
            className="border-t border-slate-200/70 dark:border-slate-800/70 pt-8"
          >
            <div className="rounded-2xl overflow-hidden border border-slate-200/80 dark:border-slate-800 bg-white dark:bg-[#111927] grid md:grid-cols-12 items-stretch">
              <div className="md:col-span-5 min-h-[190px]">
                <ResilientImage
                  src={activeMiddleBanner.image}
                  alt={locale === 'ar' ? activeMiddleBanner.titleAr : activeMiddleBanner.titleEn}
                  className="w-full h-full object-cover"
                />
              </div>
              <div className="md:col-span-7 p-6 flex flex-col justify-center gap-2.5">
                <h3 className="text-lg sm:text-xl font-extrabold">
                  {locale === 'ar' ? activeMiddleBanner.titleAr : activeMiddleBanner.titleEn}
                </h3>
                <p className="text-xs sm:text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                  {locale === 'ar' ? activeMiddleBanner.subtitleAr : activeMiddleBanner.subtitleEn}
                </p>
                <div className="pt-1.5">
                  <button
                    type="button"
                    onClick={() => handleBannerTap(activeMiddleBanner)}
                    style={{ backgroundColor: appearance.primaryColor }}
                    className="min-h-[44px] px-5 py-2.5 rounded-xl text-white text-xs sm:text-sm font-bold inline-flex items-center gap-2 hover:opacity-90 transition-opacity"
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

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-6 space-y-8 sm:space-y-10">
      {orderedSections.map((sec) => renderSection(sec))}
    </div>
  );
};
