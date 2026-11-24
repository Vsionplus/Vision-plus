import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  ShoppingCart,
  Search,
  Home,
  LayoutGrid,
  Package,
  User,
  Sun,
  Moon,
  X,
  CheckCheck,
  Globe,
  Heart,
  MessageCircle,
  Wrench,
  RefreshCw,
  LogIn,
  LogOut,
} from 'lucide-react';
import { hasLegacyBrandString, useStore } from '../store/StoreContext';
import { formatShortDate } from '../utils/format';
import { Footer } from './Footer';
import { usePWAUpdate } from '../hooks/usePWA';

export const NavigationShell: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const {
    locale,
    setLocale,
    theme,
    setTheme,
    activeTab,
    setActiveTab,
    openCatalog,
    user,
    isGuest,
    openAuthModal,
    logout,
    settings,
    appearance,
    appTexts,
    cartCount,
    unreadNotificationsCount,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    openProduct,
    t,
    toastMessage,
  } = useStore();

  const [notifOpen, setNotifOpen] = useState(false);
  const [headerSearch, setHeaderSearch] = useState('');
  const [cartBounce, setCartBounce] = useState(false);
  const prevCartCountRef = useRef(cartCount);
  const { needRefresh, reloadApp, dismissUpdate } = usePWAUpdate();

  useEffect(() => {
    if (cartCount > prevCartCountRef.current) {
      setCartBounce(true);
      const timer = window.setTimeout(() => setCartBounce(false), 550);
      prevCartCountRef.current = cartCount;
      return () => window.clearTimeout(timer);
    }
    prevCartCountRef.current = cartCount;
  }, [cartCount]);

  const handleHeaderSearch = (e: React.FormEvent) => {
    e.preventDefault();
    openCatalog('all', headerSearch.trim());
  };

  const showMaintenanceWall = settings.maintenanceMode && activeTab !== 'admin';
  const cartBadgeText = cartCount > 9 ? '9+' : String(cartCount);

  return (
    <>
      <div className="min-h-[100dvh] flex flex-col bg-[#F8F9FA] dark:bg-[#0D131F] text-[#11223E] dark:text-slate-100">
        {/* Top Sticky Header: Order (RTL right to left): Logo/Store Name -> Search -> ... -> Notification Bell -> Cart */}
        <header className="sticky top-0 z-40 bg-white dark:bg-[#131C2E] border-b border-slate-200/80 dark:border-slate-800">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 min-h-[60px] py-2 flex items-center justify-between gap-2 sm:gap-5">
            {/* 1. Start (Right in RTL): Logo / Store Name */}
            <button
              type="button"
              onClick={() => setActiveTab('home')}
              className="flex items-center gap-1.5 sm:gap-2 whitespace-nowrap shrink-0 text-start min-h-[44px]"
            >
              {appearance.logoUrl ? (
                <img
                  src={appearance.logoUrl}
                  alt={appearance.appNameEn || 'Vision Plus'}
                  className="h-7 w-7 sm:h-8 sm:w-8 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                />
              ) : null}
              {(() => {
                const rawWordmark = (appearance.wordmarkText || '').trim();
                const displayWordmark =
                  !rawWordmark || hasLegacyBrandString(rawWordmark) ? 'Vision Plus' : rawWordmark;
                return (
                  <span
                    className="text-base sm:text-xl lg:text-2xl font-extrabold tracking-tight text-[#11223E] dark:text-white whitespace-nowrap"
                    dir="ltr"
                  >
                    {displayWordmark === 'Vision Plus' ? (
                      <>
                        Vision{' '}
                        <span style={{ color: appearance.secondaryColor }}>Plus</span>
                      </>
                    ) : (
                      <>
                        <span style={{ color: appearance.secondaryColor }}>
                          {displayWordmark.slice(0, 1)}
                        </span>
                        {displayWordmark.slice(1)}
                      </>
                    )}
                  </span>
                );
              })()}
              <span className="hidden md:inline text-xs font-bold text-slate-500 dark:text-slate-400">
                {locale === 'ar' ? appearance.appNameAr : appearance.appNameEn}
              </span>
            </button>

            {/* 2. Center: Inline Search + Desktop Links */}
            <div className="flex-1 flex items-center gap-4 min-w-0">
              <form onSubmit={handleHeaderSearch} className="relative flex-1 max-w-md min-w-0">
                <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
                <input
                  type="search"
                  value={headerSearch}
                  onChange={(e) => setHeaderSearch(e.target.value)}
                  placeholder={
                    locale === 'ar' ? appTexts.searchPlaceholderAr : appTexts.searchPlaceholderEn
                  }
                  aria-label={t('بحث', 'Search')}
                  className="w-full min-h-[44px] ps-9 pe-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-[#0D131F] text-xs sm:text-sm text-[#11223E] dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--vp-secondary)]"
                />
              </form>

              <nav
                aria-label={t('القائمة الرئيسية', 'Primary Navigation')}
                className="hidden lg:flex items-center gap-5 text-sm font-semibold text-slate-600 dark:text-slate-300 shrink-0"
              >
                {(
                  [
                    { id: 'home', ar: 'الرئيسية', en: 'Home' },
                    { id: 'catalog', ar: 'التصنيفات', en: 'Categories' },
                    { id: 'consult', ar: 'أخصائي البصريات', en: 'Optician' },
                    { id: 'orders', ar: 'طلباتي', en: 'Orders' },
                  ] as const
                ).map((nav) => (
                  <button
                    key={nav.id}
                    type="button"
                    onClick={() => (nav.id === 'catalog' ? openCatalog('all', '') : setActiveTab(nav.id))}
                    style={activeTab === nav.id ? { borderBottomColor: appearance.secondaryColor } : undefined}
                    className={`whitespace-nowrap shrink-0 pb-1 transition-colors hover:text-[#11223E] dark:hover:text-white ${
                      activeTab === nav.id ? 'text-[#11223E] dark:text-[#E2BD5B] border-b-2' : ''
                    }`}
                  >
                    {t(nav.ar, nav.en)}
                  </button>
                ))}
              </nav>
            </div>

            {/* 3. End (Far LEFT side in RTL): Notification Bell, then Cart Icon */}
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => setNotifOpen(true)}
                aria-label={t('الإشعارات', 'Notifications')}
                className="relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#11223E] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              >
                <Bell className="w-5 h-5" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute top-1.5 end-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-extrabold flex items-center justify-center tabular-nums">
                    {unreadNotificationsCount > 9 ? '9+' : unreadNotificationsCount}
                  </span>
                )}
              </button>

              <button
                type="button"
                onClick={() => setActiveTab('cart')}
                aria-label={t('سلة المشتريات', 'Shopping Cart')}
                className={`relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl transition-colors ${
                  activeTab === 'cart'
                    ? 'bg-[#D9B24C]/20 text-[#11223E] dark:text-[#E2BD5B]'
                    : 'text-[#11223E] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800'
                } ${cartBounce ? 'animate-cart-bounce' : ''}`}
              >
                <ShoppingCart className="w-5 h-5" />
                {cartCount > 0 && (
                  <span className="absolute top-1 end-1 min-w-[19px] h-[19px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-extrabold flex items-center justify-center tabular-nums shadow-xs">
                    {cartBadgeText}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Utility Sub-Bar */}
          <div className="bg-slate-50 dark:bg-[#0F1624] border-t border-slate-200/70 dark:border-slate-800/80">
            <div className="max-w-7xl mx-auto px-3 sm:px-6 py-1.5 flex items-center justify-between gap-2 overflow-x-auto text-xs">
              <div className="flex items-center gap-2 shrink-0">
                {isGuest ? (
                  <button
                    type="button"
                    onClick={() => openAuthModal('login', false)}
                    className="px-2.5 py-1 rounded-lg bg-[#11223E] text-white font-semibold flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <LogIn className="w-3.5 h-3.5" />
                    {t('تسجيل الدخول', 'Sign In')}
                  </button>
                ) : (
                  <button
                    type="button"
                    onClick={() => void logout()}
                    className="px-2.5 py-1 rounded-lg bg-slate-200/80 dark:bg-slate-800 text-[#11223E] dark:text-slate-200 font-semibold flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    {t('تسجيل الخروج', 'Sign Out')}
                  </button>
                )}
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => setActiveTab('favorites')}
                  className="px-2.5 py-1 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 flex items-center gap-1 whitespace-nowrap"
                >
                  <Heart className="w-3.5 h-3.5" style={{ color: appearance.secondaryColor }} />
                  <span>{t('المفضلة', 'Favorites')}</span>
                  <span className="font-mono-num tabular-nums">({user.favoriteProductIds.length})</span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  className="hidden md:flex px-2.5 py-1 rounded-lg text-slate-700 dark:text-slate-300 hover:bg-slate-200/70 dark:hover:bg-slate-800 items-center gap-1 whitespace-nowrap"
                >
                  <User className="w-3.5 h-3.5" />
                  <span>{t('حسابي والوصفات', 'Profile & Rx')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
                  className="px-2 py-1 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1A253A] text-[#11223E] dark:text-slate-100 font-bold flex items-center gap-1 whitespace-nowrap"
                >
                  <Globe className="w-3.5 h-3.5" style={{ color: appearance.secondaryColor }} />
                  <span>{locale === 'ar' ? 'EN' : 'AR'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                  aria-label={t('تبديل المظهر', 'Toggle theme')}
                  className="p-1.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#1A253A] text-[#11223E] dark:text-slate-200"
                >
                  {theme === 'light' ? (
                    <Moon className="w-3.5 h-3.5" />
                  ) : (
                    <Sun className="w-3.5 h-3.5" style={{ color: appearance.secondaryColor }} />
                  )}
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Gentle Guest Banner */}
        {isGuest && activeTab !== 'admin' && !showMaintenanceWall && (
          <div className="bg-amber-50 dark:bg-amber-950/30 border-b border-amber-200 dark:border-amber-900/50">
            <div className="max-w-7xl mx-auto px-3 sm:px-6 py-1.5 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span className="font-bold text-[#11223E] dark:text-amber-200">
                {t('أنت داخل كضيف، سجّل دخولك لإتمام الشراء', 'You are browsing as a guest, sign in to complete purchase')}
              </span>
              <button
                type="button"
                onClick={() => openAuthModal('login', activeTab === 'cart')}
                style={{ backgroundColor: appearance.primaryColor }}
                className="min-h-[44px] px-4 py-1.5 rounded-xl text-white font-bold inline-flex items-center gap-1.5 shrink-0"
              >
                <LogIn className="w-3.5 h-3.5" />
                <span>{t('تسجيل الدخول', 'Sign In')}</span>
              </button>
            </div>
          </div>
        )}

        {/* Scrollable Main Content with safe bottom clearance for fixed mobile bar */}
        <main className="flex-1 pb-[calc(64px+env(safe-area-inset-bottom))] md:pb-12">
          {user.isBlocked && activeTab !== 'admin' ? (
            <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
              <h1 className="text-xl font-extrabold text-rose-600">
                {t('تم تقييد هذا الحساب مؤقتاً', 'Account Temporarily Restricted')}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t('يرجى التواصل مع خدمة عملاء المتجر.', 'Please contact store support.')}
              </p>
            </div>
          ) : showMaintenanceWall ? (
            <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
              <div className="w-16 h-16 rounded-2xl mx-auto flex items-center justify-center bg-amber-100 text-amber-800">
                <Wrench className="w-8 h-8" />
              </div>
              <h1 className="text-2xl font-extrabold">
                {t('المتجر في وضع الصيانة مؤقتاً', 'Store Under Maintenance')}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {locale === 'ar' ? settings.maintenanceMessageAr : settings.maintenanceMessageEn}
              </p>
            </div>
          ) : (
            children
          )}
        </main>

        {/* Reusable Footer on every page */}
        <Footer />
      </div>

      {/* Floating WhatsApp Button positioned safely above the fixed bottom bar (z-40 < z-50) */}
      {activeTab !== 'admin' &&
        !showMaintenanceWall &&
        settings.contactVisibility.whatsapp &&
        settings.whatsapp.trim() && (
          <a
            href={`https://wa.me/${settings.whatsapp.replace(/[^\d]/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('واتساب', 'WhatsApp')}
            className="fixed start-4 bottom-[calc(72px+env(safe-area-inset-bottom))] md:bottom-6 z-40 w-12 h-12 rounded-full bg-[#16A34A] hover:bg-[#15803D] text-white shadow-lg flex items-center justify-center transition-transform hover:scale-105"
          >
            <MessageCircle className="w-5 h-5" />
          </a>
        )}

      {/* Permanently Fixed Mobile Bottom Navigation Bar (root level, solid bg, z-50, safe-area inset) */}
      <nav
        aria-label={t('التنقل السفلي', 'Bottom Navigation')}
        className="md:hidden fixed bottom-0 inset-x-0 w-full z-50 bg-white dark:bg-[#131C2E] border-t border-slate-200 dark:border-slate-800 shadow-[0_-4px_16px_rgba(17,34,62,0.08)] dark:shadow-[0_-4px_16px_rgba(0,0,0,0.45)] pb-[env(safe-area-inset-bottom)]"
      >
        <div className="h-16 grid grid-cols-5 items-center">
          {(
            [
              { id: 'home', icon: Home, ar: 'الرئيسية', en: 'Home' },
              { id: 'catalog', icon: LayoutGrid, ar: 'التصنيفات', en: 'Categories' },
              { id: 'cart', icon: ShoppingCart, ar: 'السلة', en: 'Cart', isCart: true },
              { id: 'orders', icon: Package, ar: 'الطلبات', en: 'Orders' },
              { id: 'profile', icon: User, ar: 'حسابي', en: 'Profile' },
            ] as const
          ).map((tab) => {
            const Icon = tab.icon;
            const isActive = activeTab === tab.id;
            const isCartTab = 'isCart' in tab && tab.isCart;
            return (
              <button
                key={tab.id}
                type="button"
                onClick={() => {
                  if (tab.id === 'catalog') openCatalog('all', '');
                  else setActiveTab(tab.id);
                }}
                className={`relative flex flex-col items-center justify-center min-w-0 px-1 min-h-[44px] h-full text-[10px] sm:text-[11px] font-semibold transition-colors ${
                  isActive ? 'text-[#11223E] dark:text-[#E2BD5B]' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {isActive && (
                  <span
                    style={{ backgroundColor: appearance.secondaryColor }}
                    className="absolute top-0 w-8 h-1 rounded-b-full"
                  />
                )}
                <div className={`relative ${isCartTab && cartBounce ? 'animate-cart-bounce' : ''}`}>
                  <Icon className="w-5 h-5 mb-0.5" strokeWidth={isActive ? 2.2 : 1.75} />
                  {isCartTab && cartCount > 0 && (
                    <span className="absolute -top-1.5 -end-2.5 min-w-[18px] h-[18px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-extrabold flex items-center justify-center tabular-nums">
                      {cartBadgeText}
                    </span>
                  )}
                </div>
                <span className="truncate max-w-full">{t(tab.ar, tab.en)}</span>
              </button>
            );
          })}
        </div>
      </nav>

      {/* Notifications Drawer */}
      {notifOpen && (
        <div className="fixed inset-0 z-[60] bg-black/50 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-white dark:bg-[#131C2E] h-full flex flex-col border-s border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="p-4 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between">
              <div>
                <h2 className="text-base font-bold">{t('الإشعارات', 'Notifications')}</h2>
                <p className="text-xs text-slate-500 dark:text-slate-400">
                  {t(`${unreadNotificationsCount} غير مقروءة`, `${unreadNotificationsCount} unread`)}
                </p>
              </div>
              <div className="flex items-center gap-2">
                {unreadNotificationsCount > 0 && (
                  <button
                    type="button"
                    onClick={markAllNotificationsRead}
                    className="px-2.5 py-1.5 rounded-lg text-xs font-semibold text-[#11223E] dark:text-[#E2BD5B] hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center gap-1"
                  >
                    <CheckCheck className="w-4 h-4" />
                    {t('تحديد الكل كمقروء', 'Mark all read')}
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setNotifOpen(false)}
                  className="p-2 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {notifications.length === 0 ? (
                <div className="p-10 text-center text-sm text-slate-500 dark:text-slate-400">
                  {t('لا توجد إشعارات حالياً', 'No notifications yet')}
                </div>
              ) : (
                notifications.map((n) => (
                  <button
                    key={n.id}
                    type="button"
                    onClick={() => {
                      markNotificationRead(n.id);
                      setNotifOpen(false);
                      if (n.deepLinkType === 'order') setActiveTab('orders');
                      else if (n.deepLinkType === 'consult') setActiveTab('consult');
                      else if (n.deepLinkType === 'product' && n.deepLinkId) openProduct(n.deepLinkId);
                      else if (n.deepLinkType === 'category' && n.deepLinkId) openCatalog(n.deepLinkId, '');
                    }}
                    className={`w-full text-start p-4 hover:bg-slate-50 dark:hover:bg-slate-900/60 transition-colors ${
                      !n.isRead ? 'bg-amber-50/50 dark:bg-amber-950/15' : ''
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2 mb-1">
                      <span className="text-sm font-semibold">
                        {locale === 'ar' ? n.titleAr : n.titleEn}
                      </span>
                      {!n.isRead && (
                        <span className="text-[11px] font-bold text-[#B38B2D] dark:text-[#E2BD5B] shrink-0">
                          {t('جديد', 'New')}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-1.5">
                      {locale === 'ar' ? n.bodyAr : n.bodyEn}
                    </p>
                    <span className="text-[11px] text-slate-400 dark:text-slate-500">
                      {formatShortDate(n.createdAt, locale)}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* Toast Feedback above fixed bottom navigation */}
      {toastMessage && (
        <div
          style={{ backgroundColor: appearance.primaryColor }}
          className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] md:bottom-6 start-1/2 -translate-x-1/2 z-[55] px-4 py-2.5 rounded-xl text-white text-xs sm:text-sm font-bold shadow-xl flex items-center gap-3 whitespace-nowrap"
        >
          <span>{toastMessage}</span>
          {cartCount > 0 && activeTab !== 'cart' && (
            <button
              type="button"
              onClick={() => setActiveTab('cart')}
              style={{
                backgroundColor: appearance.secondaryColor,
                color: appearance.primaryColor,
              }}
              className="px-2.5 py-1 rounded-lg text-xs font-extrabold"
            >
              {t('عرض السلة', 'View Cart')}
            </button>
          )}
        </div>
      )}

      {/* Service Worker "New Version Available" Toast with Reload Button */}
      {needRefresh && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-[calc(80px+env(safe-area-inset-bottom))] md:bottom-6 end-4 z-[56] max-w-sm rounded-2xl bg-[#11223E] text-white border border-[#D9B24C]/40 shadow-2xl px-4 py-3 flex items-center gap-3"
        >
          <RefreshCw className="w-4 h-4 shrink-0 text-[#D9B24C]" />
          <span className="text-xs sm:text-sm font-bold leading-snug">
            {t('يتوفر تحديث جديد للتطبيق', 'New version available')}
          </span>
          <button
            type="button"
            onClick={() => void reloadApp()}
            style={{
              backgroundColor: appearance.secondaryColor,
              color: appearance.primaryColor,
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-extrabold whitespace-nowrap shrink-0 hover:opacity-90 transition-opacity"
          >
            {t('إعادة التحميل', 'Reload')}
          </button>
          <button
            type="button"
            onClick={dismissUpdate}
            aria-label={t('إغلاق', 'Dismiss')}
            className="p-1 rounded-lg text-slate-300 hover:text-white hover:bg-white/10 shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}
    </>
  );
};
