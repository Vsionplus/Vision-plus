import React, { useEffect, useRef, useState } from 'react';
import {
  Bell,
  BellRing,
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
  LogOut,
  ArrowLeft,
  ArrowRight,
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
    goBack,
    openCatalog,
    authReady,
    firebaseUser,
    guestSession,
    user,
    orders,
    logout,
    settings,
    appearance,
    appTexts,
    cartCount,
    unreadNotificationsCount,
    notifications,
    liveOrderAlert,
    dismissLiveOrderAlert,
    markNotificationRead,
    markAllNotificationsRead,
    openProduct,
    t,
    toastMessage,
  } = useStore();

  const [notifOpen, setNotifOpen] = useState(false);
  const [confirmLogoutOpen, setConfirmLogoutOpen] = useState(false);
  const [loggingOut, setLoggingOut] = useState(false);
  const [headerSearch, setHeaderSearch] = useState('');
  const [cartBounce, setCartBounce] = useState(false);
  const prevCartCountRef = useRef(cartCount);
  const { needRefresh, reloadApp, dismissUpdate } = usePWAUpdate();
  const hasSessionForSignOut = authReady && (Boolean(firebaseUser) || guestSession);

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

  const showMaintenanceWall = settings.maintenanceMode;
  const cartBadgeText = cartCount > 9 ? '9+' : String(cartCount);

  const rawWordmark = (appearance.wordmarkText || '').trim();
  const displayWordmark =
    !rawWordmark || hasLegacyBrandString(rawWordmark) ? 'Vision Plus' : rawWordmark;

  return (
    <>
      <div className="min-h-[100dvh] flex flex-col bg-[#F9FAFB] dark:bg-[#0B111C] text-[#11223E] dark:text-slate-100">
        {/* Clean Single-Surface Sticky Header */}
        <header className="sticky top-0 z-40 bg-white/95 dark:bg-[#111927]/95 backdrop-blur-sm border-b border-slate-200/80 dark:border-slate-800/80">
          <div className="max-w-7xl mx-auto px-3 sm:px-6 h-14 flex items-center justify-between gap-3 sm:gap-5">
            {/* Brand Wordmark */}
            <button
              type="button"
              onClick={() => setActiveTab('home')}
              className="flex items-center gap-2 whitespace-nowrap shrink-0 text-start min-h-[44px]"
            >
              {appearance.logoUrl ? (
                <img
                  src={appearance.logoUrl}
                  alt={appearance.appNameEn || 'Vision Plus'}
                  className="h-7 w-7 rounded-lg object-cover border border-slate-200 dark:border-slate-700 shrink-0"
                />
              ) : null}
              <span
                className="text-lg sm:text-xl font-extrabold tracking-tight text-[#11223E] dark:text-white whitespace-nowrap"
                dir="ltr"
              >
                {displayWordmark === 'Vision Plus' ? (
                  <>
                    Vision <span style={{ color: appearance.secondaryColor }}>Plus</span>
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
            </button>

            {/* Search & Primary Desktop Navigation */}
            <div className="flex-1 flex items-center gap-5 min-w-0">
              <form onSubmit={handleHeaderSearch} className="relative flex-1 max-w-sm min-w-0">
                <Search className="w-4 h-4 text-slate-400 absolute top-1/2 -translate-y-1/2 start-3 pointer-events-none" />
                <input
                  type="search"
                  value={headerSearch}
                  onChange={(e) => setHeaderSearch(e.target.value)}
                  placeholder={
                    locale === 'ar' ? appTexts.searchPlaceholderAr : appTexts.searchPlaceholderEn
                  }
                  aria-label={t('بحث', 'Search')}
                  className="w-full h-10 ps-9 pe-3 rounded-xl border border-slate-200 dark:border-slate-700/80 bg-slate-50/80 dark:bg-[#0B111C] text-xs sm:text-sm text-[#11223E] dark:text-slate-100 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-[var(--vp-secondary)]"
                />
              </form>

              <nav
                aria-label={t('القائمة الرئيسية', 'Primary Navigation')}
                className="hidden lg:flex items-center gap-5 text-sm font-semibold text-slate-600 dark:text-slate-300 shrink-0"
              >
                {(
                  [
                    { id: 'home', ar: 'الرئيسية', en: 'Home' },
                    { id: 'catalog', ar: 'المتجر', en: 'Catalog' },
                    { id: 'consult', ar: 'أخصائي البصريات', en: 'Optician' },
                    { id: 'orders', ar: 'طلباتي', en: 'Orders' },
                  ] as const
                ).map((nav) => (
                  <button
                    key={nav.id}
                    type="button"
                    onClick={() => (nav.id === 'catalog' ? openCatalog('all', '') : setActiveTab(nav.id))}
                    style={activeTab === nav.id ? { borderBottomColor: appearance.secondaryColor } : undefined}
                    className={`whitespace-nowrap shrink-0 py-1 transition-colors hover:text-[#11223E] dark:hover:text-white ${
                      activeTab === nav.id ? 'text-[#11223E] dark:text-[#E2BD5B] border-b-2 font-bold' : ''
                    }`}
                  >
                    {t(nav.ar, nav.en)}
                  </button>
                ))}
              </nav>
            </div>

            {/* Bell & Cart */}
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => setNotifOpen(true)}
                aria-label={t('الإشعارات', 'Notifications')}
                className="relative min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#11223E] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/70 transition-colors"
              >
                <Bell className="w-5 h-5" />
                {unreadNotificationsCount > 0 && (
                  <span className="absolute top-2 end-2 min-w-[16px] h-[16px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
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
                    ? 'bg-slate-100 dark:bg-slate-800 text-[#11223E] dark:text-[#E2BD5B]'
                    : 'text-[#11223E] dark:text-slate-200 hover:bg-slate-100 dark:hover:bg-slate-800/70'
                } ${cartBounce ? 'animate-cart-bounce' : ''}`}
              >
                <ShoppingCart className="w-5 h-5" />
                {cartCount > 0 && (
                  <span className="absolute top-1.5 end-1.5 min-w-[17px] h-[17px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
                    {cartBadgeText}
                  </span>
                )}
              </button>
            </div>
          </div>

          {/* Slim Utility Row (keeps My Orders, Favorites, Profile & Rx, Language, Dark Mode, and single Sign Out) */}
          <div className="border-t border-slate-100 dark:border-slate-800/70">
            <div className="max-w-7xl mx-auto px-3 sm:px-6 py-1 flex flex-wrap sm:flex-nowrap items-center justify-between gap-1.5 sm:gap-2 text-xs text-slate-600 dark:text-slate-300">
              <div className="flex items-center shrink-0">
                {!authReady ? (
                  <span className="inline-flex items-center px-2 py-1 text-slate-400">
                    <span className="w-3.5 h-3.5 rounded-full border-2 border-slate-300 border-t-[#D9B24C] animate-spin" />
                  </span>
                ) : hasSessionForSignOut ? (
                  <button
                    type="button"
                    onClick={() => setConfirmLogoutOpen(true)}
                    className="min-h-[34px] px-2.5 py-1 rounded-lg hover:bg-rose-50 dark:hover:bg-rose-950/30 hover:text-rose-700 dark:hover:text-rose-300 font-semibold inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
                  >
                    <LogOut className="w-3.5 h-3.5" />
                    <span>{t('تسجيل الخروج', 'Sign Out')}</span>
                  </button>
                ) : null}
              </div>

              <div className="flex flex-wrap sm:flex-nowrap items-center gap-1 sm:gap-2">
                <button
                  type="button"
                  onClick={() => setActiveTab('orders')}
                  className={`min-h-[34px] px-2.5 py-1 rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap transition-colors font-bold ${
                    activeTab === 'orders'
                      ? 'bg-[#11223E] text-white dark:bg-[#D9B24C] dark:text-[#11223E]'
                      : 'bg-[#D9B24C]/15 text-[#11223E] dark:text-[#E2BD5B] hover:bg-[#D9B24C]/25'
                  }`}
                >
                  <Package className="w-3.5 h-3.5" />
                  <span>{t('طلباتي', 'My Orders')}</span>
                  {orders.length > 0 && (
                    <span className="font-mono-num tabular-nums text-[11px] opacity-90">
                      ({orders.length})
                    </span>
                  )}
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('favorites')}
                  className={`min-h-[34px] px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 whitespace-nowrap transition-colors ${
                    activeTab === 'favorites' ? 'text-[#11223E] dark:text-[#E2BD5B] font-bold' : ''
                  }`}
                >
                  <Heart className="w-3.5 h-3.5" style={{ color: appearance.secondaryColor }} />
                  <span>{t('المفضلة', 'Favorites')}</span>
                  <span className="font-mono-num tabular-nums text-[11px] opacity-80">
                    ({user.favoriteProductIds.length})
                  </span>
                </button>

                <button
                  type="button"
                  onClick={() => setActiveTab('profile')}
                  className={`min-h-[34px] px-2.5 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 inline-flex items-center gap-1 whitespace-nowrap transition-colors ${
                    activeTab === 'profile' ? 'text-[#11223E] dark:text-[#E2BD5B] font-bold' : ''
                  }`}
                >
                  <User className="w-3.5 h-3.5" />
                  <span>{t('حسابي والوصفات', 'Profile & Rx')}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
                  className="min-h-[34px] px-2 py-1 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 font-bold inline-flex items-center gap-1 whitespace-nowrap transition-colors"
                >
                  <Globe className="w-3.5 h-3.5" style={{ color: appearance.secondaryColor }} />
                  <span>{locale === 'ar' ? 'EN' : 'AR'}</span>
                </button>

                <button
                  type="button"
                  onClick={() => setTheme(theme === 'light' ? 'dark' : 'light')}
                  aria-label={t('تبديل المظهر', 'Toggle theme')}
                  className="min-h-[34px] min-w-[34px] p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800 flex items-center justify-center transition-colors"
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

        {/* Live In-App Order Status Notification Alert */}
        {liveOrderAlert && (
          <div
            role="status"
            aria-live="polite"
            className="bg-[#11223E] text-white border-b border-[#D9B24C]/50 px-4 py-2.5"
          >
            <div className="max-w-7xl mx-auto flex flex-wrap items-center justify-between gap-3 text-xs sm:text-sm">
              <div className="flex items-start gap-2.5 min-w-0">
                <BellRing className="w-4 h-4 text-[#D9B24C] shrink-0 mt-0.5" />
                <div className="space-y-0.5 min-w-0">
                  <div className="font-bold text-[#E2BD5B]">
                    {locale === 'ar' ? liveOrderAlert.titleAr : liveOrderAlert.titleEn}
                  </div>
                  <p className="text-xs text-slate-200 leading-relaxed">
                    {locale === 'ar' ? liveOrderAlert.bodyAr : liveOrderAlert.bodyEn}
                  </p>
                </div>
              </div>
              <div className="flex items-center gap-2 shrink-0">
                <button
                  type="button"
                  onClick={() => {
                    markNotificationRead(liveOrderAlert.id);
                    dismissLiveOrderAlert();
                    setActiveTab('orders');
                  }}
                  style={{ backgroundColor: appearance.secondaryColor, color: appearance.primaryColor }}
                  className="min-h-[36px] px-3 py-1 rounded-lg text-xs font-extrabold"
                >
                  {t('عرض في طلباتي', 'View in My Orders')}
                </button>
                <button
                  type="button"
                  onClick={dismissLiveOrderAlert}
                  aria-label={t('إغلاق', 'Close')}
                  className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg bg-white/10 hover:bg-white/20"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        )}

        {/* Main Content */}
        <main className="flex-1 pb-[calc(72px+env(safe-area-inset-bottom))] md:pb-12">
          {user.isBlocked ? (
            <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-3">
              <h1 className="text-xl font-extrabold text-rose-600">
                {t('تم تقييد هذا الحساب مؤقتاً', 'Account Temporarily Restricted')}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400">
                {t('يرجى التواصل مع خدمة عملاء المتجر.', 'Please contact store support.')}
              </p>
            </div>
          ) : showMaintenanceWall ? (
            <div className="max-w-xl mx-auto px-4 py-20 text-center space-y-4">
              <div className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center bg-amber-100 text-amber-800">
                <Wrench className="w-7 h-7" />
              </div>
              <h1 className="text-2xl font-extrabold">
                {t('المتجر في وضع الصيانة مؤقتاً', 'Store Under Maintenance')}
              </h1>
              <p className="text-sm text-slate-600 dark:text-slate-400 leading-relaxed">
                {locale === 'ar' ? settings.maintenanceMessageAr : settings.maintenanceMessageEn}
              </p>
            </div>
          ) : (
            <>
              {activeTab !== 'home' && (
                <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-3 -mb-2 flex items-center gap-2.5 text-xs">
                  <button
                    type="button"
                    onClick={goBack}
                    aria-label={t('رجوع', 'Back')}
                    className="min-h-[40px] px-3 py-1.5 rounded-xl bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 hover:border-[#D9B24C] text-[#11223E] dark:text-slate-100 font-extrabold inline-flex items-center gap-1.5 shadow-2xs transition-colors"
                  >
                    {locale === 'ar' ? (
                      <ArrowRight className="w-4 h-4 text-[#B38B2D]" />
                    ) : (
                      <ArrowLeft className="w-4 h-4 text-[#B38B2D]" />
                    )}
                    <span>{t('رجوع', 'Back')}</span>
                  </button>
                  <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">
                    ·
                  </span>
                  <span className="font-bold text-slate-500 dark:text-slate-400 truncate">
                    {activeTab === 'catalog'
                      ? t('المتجر', 'Catalog')
                      : activeTab === 'favorites'
                      ? t('المفضلة', 'Favorites')
                      : activeTab === 'cart'
                      ? t('سلة التسوق', 'Cart & Checkout')
                      : activeTab === 'orders'
                      ? t('طلباتي', 'My Orders')
                      : activeTab === 'consult'
                      ? t('أخصائي البصريات', 'Optician')
                      : activeTab === 'profile'
                      ? t('حسابي والوصفات', 'Profile & Rx')
                      : t('من نحن والسياسات', 'About & Policies')}
                  </span>
                </div>
              )}
              {children}
            </>
          )}
        </main>

        <Footer />
      </div>

      {/* Floating WhatsApp Quick Link */}
      {!showMaintenanceWall &&
        settings.contactVisibility.whatsapp &&
        settings.whatsapp.trim() && (
          <a
            href={`https://wa.me/${settings.whatsapp.replace(/[^\d]/g, '')}`}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={t('واتساب', 'WhatsApp')}
            className="fixed start-4 bottom-[calc(76px+env(safe-area-inset-bottom))] md:bottom-6 z-40 w-11 h-11 rounded-full bg-[#16A34A] hover:bg-[#15803D] text-white shadow-md flex items-center justify-center transition-transform hover:scale-105"
          >
            <MessageCircle className="w-5 h-5" />
          </a>
        )}

      {/* Clean Mobile Bottom Navigation */}
      <nav
        aria-label={t('التنقل السفلي', 'Bottom Navigation')}
        className="md:hidden fixed bottom-0 inset-x-0 w-full z-50 bg-white/95 dark:bg-[#111927]/95 backdrop-blur-sm border-t border-slate-200 dark:border-slate-800 pb-[env(safe-area-inset-bottom)]"
      >
        <div className="h-16 grid grid-cols-5 items-center">
          {(
            [
              { id: 'home', icon: Home, ar: 'الرئيسية', en: 'Home' },
              { id: 'catalog', icon: LayoutGrid, ar: 'المتجر', en: 'Shop' },
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
                className={`relative flex flex-col items-center justify-center min-w-0 px-1 min-h-[44px] h-full text-[11px] font-semibold transition-colors ${
                  isActive ? 'text-[#11223E] dark:text-[#E2BD5B]' : 'text-slate-500 dark:text-slate-400'
                }`}
              >
                {isActive && (
                  <span
                    style={{ backgroundColor: appearance.secondaryColor }}
                    className="absolute top-0 w-7 h-0.5 rounded-b-full"
                  />
                )}
                <div className={`relative ${isCartTab && cartBounce ? 'animate-cart-bounce' : ''}`}>
                  <Icon className="w-5 h-5 mb-0.5" strokeWidth={isActive ? 2.2 : 1.75} />
                  {isCartTab && cartCount > 0 && (
                    <span className="absolute -top-1.5 -end-2.5 min-w-[16px] h-[16px] px-1 rounded-full bg-rose-600 text-white text-[10px] font-bold flex items-center justify-center tabular-nums">
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
        <div className="fixed inset-0 z-[60] bg-black/45 backdrop-blur-xs flex justify-end">
          <div className="w-full max-w-md bg-white dark:bg-[#111927] h-full flex flex-col border-s border-slate-200 dark:border-slate-800 shadow-2xl">
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
                  aria-label={t('إغلاق', 'Close')}
                  className="min-w-[40px] min-h-[40px] flex items-center justify-center rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto divide-y divide-slate-100 dark:divide-slate-800">
              {notifications.length === 0 ? (
                <div className="p-12 text-center text-sm text-slate-500 dark:text-slate-400">
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
                      !n.isRead ? 'bg-amber-50/40 dark:bg-amber-950/15' : ''
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
                    {n.imageUrl && (
                      <img
                        src={n.imageUrl}
                        alt=""
                        className="w-full h-28 object-cover rounded-lg mb-2 border border-slate-200 dark:border-slate-700"
                      />
                    )}
                    <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed mb-1">
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

      {/* Toast Feedback */}
      {toastMessage && (
        <div
          style={{ backgroundColor: appearance.primaryColor }}
          className="fixed bottom-[calc(76px+env(safe-area-inset-bottom))] md:bottom-6 start-1/2 -translate-x-1/2 z-[55] px-4 py-2.5 rounded-xl text-white text-xs sm:text-sm font-bold shadow-lg flex items-center gap-3 whitespace-nowrap"
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

      {/* Service Worker Update Prompt */}
      {needRefresh && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-[calc(80px+env(safe-area-inset-bottom))] md:bottom-6 end-4 z-[56] max-w-sm rounded-xl bg-[#11223E] text-white border border-white/15 shadow-lg px-4 py-3 flex items-center gap-3"
        >
          <RefreshCw className="w-4 h-4 shrink-0 text-[#D9B24C]" />
          <span className="text-xs sm:text-sm font-semibold leading-snug">
            {t('يتوفر تحديث جديد للتطبيق', 'New version available')}
          </span>
          <button
            type="button"
            onClick={() => void reloadApp()}
            style={{
              backgroundColor: appearance.secondaryColor,
              color: appearance.primaryColor,
            }}
            className="px-3 py-1.5 rounded-lg text-xs font-bold whitespace-nowrap shrink-0"
          >
            {t('إعادة التحميل', 'Reload')}
          </button>
          <button
            type="button"
            onClick={dismissUpdate}
            aria-label={t('إغلاق', 'Dismiss')}
            className="p-1 rounded-lg text-slate-300 hover:text-white"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
      )}

      {/* Logout Confirmation Dialog */}
      {confirmLogoutOpen && (
        <div
          role="dialog"
          aria-modal="true"
          className="fixed inset-0 z-[75] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4"
        >
          <div className="w-full max-w-sm bg-white dark:bg-[#111927] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 shadow-xl space-y-4">
            <h2 className="text-base font-extrabold text-[#11223E] dark:text-white">
              {t('هل تريد تسجيل الخروج؟', 'Do you want to sign out?')}
            </h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 leading-relaxed">
              {t(
                'سيتم تسجيل خروجك والعودة إلى شاشة الدخول والترحيب.',
                'You will be signed out and returned to the welcome screen.'
              )}
            </p>
            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={loggingOut}
                onClick={() => setConfirmLogoutOpen(false)}
                className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold text-slate-700 dark:text-slate-200 hover:bg-slate-50 dark:hover:bg-slate-800"
              >
                {t('إلغاء', 'Cancel')}
              </button>
              <button
                type="button"
                disabled={loggingOut}
                onClick={async () => {
                  setLoggingOut(true);
                  try {
                    await logout();
                  } finally {
                    setLoggingOut(false);
                    setConfirmLogoutOpen(false);
                  }
                }}
                className="min-h-[44px] px-4 rounded-xl bg-rose-600 hover:bg-rose-700 text-white text-xs font-extrabold inline-flex items-center gap-1.5 disabled:opacity-60"
              >
                <LogOut className="w-4 h-4" />
                <span>{loggingOut ? t('جارٍ الخروج...', 'Signing out...') : t('تسجيل الخروج', 'Sign Out')}</span>
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  );
};
