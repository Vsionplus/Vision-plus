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
import { AdminDashboardView } from './components/AdminDashboardView';

const AppRouter: React.FC = () => {
  const { activeTab, user } = useStore();

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
      {activeTab === 'admin' &&
        (user.role === 'admin' || user.role === 'staff' ? <AdminDashboardView /> : <HomeView />)}
      <ProductDetailModal />
    </NavigationShell>
  );
};

export default function App() {
  return (
    <StoreProvider>
      <AppRouter />
    </StoreProvider>
  );
}
