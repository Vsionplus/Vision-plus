/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { StoreProvider, useStore } from './store/StoreContext';
import { NavigationShell } from './components/NavigationShell';
import { HomeView } from './components/HomeView';
import { CatalogView } from './components/CatalogView';
import { ProductDetailModal } from './components/ProductDetailModal';
import { CartCheckoutView } from './components/CartCheckoutView';
import { OrdersView } from './components/OrdersView';
import { ConsultView } from './components/ConsultView';
import { ContactAboutView, ProfileView } from './components/ProfileContactView';
import { AuthScreen } from './components/AuthScreen';
import { VerifyEmailScreen } from './components/VerifyEmailScreen';

const LazyAdminLoginView = React.lazy(() =>
  import('./components/admin/AdminLoginView').then((m) => ({ default: m.AdminLoginView }))
);
const LazyAdminGuard = React.lazy(() =>
  import('./components/admin/AdminGuard').then((m) => ({ default: m.AdminGuard }))
);
const LazyAdminDashboardView = React.lazy(() =>
  import('./components/AdminDashboardView').then((m) => ({ default: m.AdminDashboardView }))
);

interface ErrorBoundaryState {
  hasError: boolean;
  message: string;
}

class AppErrorBoundary extends React.Component<{ children: React.ReactNode }, ErrorBoundaryState> {
  constructor(props: { children: React.ReactNode }) {
    super(props);
    this.state = { hasError: false, message: '' };
  }

  static getDerivedStateFromError(error: Error): ErrorBoundaryState {
    return { hasError: true, message: error.message || 'Unexpected error' };
  }

  render() {
    if (this.state.hasError) {
      return (
        <div
          dir="rtl"
          className="min-h-[100dvh] flex items-center justify-center p-6 bg-[#F8F9FA] dark:bg-[#0D131F] text-[#11223E] dark:text-slate-100"
        >
          <div className="max-w-md w-full bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 text-center space-y-4 shadow-xl">
            <h1 className="text-lg font-extrabold text-rose-600">حدث خطأ غير متوقع</h1>
            <p className="text-xs text-slate-600 dark:text-slate-400 leading-relaxed">
              يرجى إعادة تحميل التطبيق والمحاولة مجدداً.
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="min-h-[44px] px-5 py-2.5 rounded-xl bg-[#11223E] text-white text-xs font-extrabold"
            >
              إعادة التحميل
            </button>
          </div>
        </div>
      );
    }
    return this.props.children;
  }
}

const AdminRouteFallback: React.FC = () => (
  <div
    dir="rtl"
    className="min-h-[100dvh] flex flex-col items-center justify-center gap-3 bg-[#F8F9FA] dark:bg-[#0D131F] text-[#11223E] dark:text-slate-100 p-6"
  >
    <div className="w-10 h-10 rounded-full border-4 border-slate-200 dark:border-slate-700 border-t-[#D9B24C] animate-spin" />
    <p className="text-sm font-bold">جارٍ التحميل...</p>
  </div>
);

const AppRouter: React.FC = () => {
  const {
    authReady,
    firebaseUser,
    guestSession,
    authScreenMode,
    authModal,
    closeAuthModal,
    activeTab,
    adminRoute,
    appearance,
    t,
  } = useStore();

  if (!authReady) {
    return (
      <div className="min-h-[100dvh] flex items-center justify-center bg-[#F8F9FA] dark:bg-[#0D131F] text-[#11223E] dark:text-slate-100 p-6">
        <div className="text-center space-y-3">
          <div
            style={{ backgroundColor: appearance.primaryColor, color: appearance.secondaryColor }}
            className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center font-extrabold text-xl shadow-md"
            dir="ltr"
          >
            V+
          </div>
          <div className="w-7 h-7 mx-auto rounded-full border-[3px] border-slate-200 dark:border-slate-700 border-t-[#D9B24C] animate-spin" />
          <p className="text-sm font-bold">{t('جارٍ التحميل...', 'Loading Vision Plus...')}</p>
        </div>
      </div>
    );
  }

  if (adminRoute === 'admin_login') {
    return (
      <React.Suspense fallback={<AdminRouteFallback />}>
        <LazyAdminLoginView />
      </React.Suspense>
    );
  }

  if (adminRoute === 'admin_panel') {
    return (
      <React.Suspense fallback={<AdminRouteFallback />}>
        <LazyAdminGuard>
          <LazyAdminDashboardView />
        </LazyAdminGuard>
      </React.Suspense>
    );
  }

  if ((!firebaseUser && !guestSession) || authScreenMode === 'entry') {
    return <AuthScreen mode="page" initialView="choice" />;
  }

  if (
    firebaseUser &&
    authScreenMode === 'verify_email' &&
    !firebaseUser.isAnonymous &&
    !firebaseUser.emailVerified
  ) {
    return <VerifyEmailScreen />;
  }

  return (
    <NavigationShell>
      {activeTab === 'home' && <HomeView />}
      {activeTab === 'catalog' && <CatalogView />}
      {activeTab === 'favorites' && <CatalogView favoritesOnly />}
      {activeTab === 'cart' && <CartCheckoutView />}
      {activeTab === 'orders' && <OrdersView />}
      {activeTab === 'consult' && <ConsultView />}
      {activeTab === 'profile' && <ProfileView />}
      {activeTab === 'contact' && <ContactAboutView />}
      <ProductDetailModal />
      {authModal.open && (
        <AuthScreen
          mode="modal"
          initialView={authModal.view}
          checkoutNotice={authModal.checkoutNotice}
          onClose={closeAuthModal}
        />
      )}
    </NavigationShell>
  );
};

export default function App() {
  return (
    <AppErrorBoundary>
      <StoreProvider>
        <AppRouter />
      </StoreProvider>
    </AppErrorBoundary>
  );
}
