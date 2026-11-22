import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';
import {
  AppAppearanceConfig,
  AppNotification,
  AppTextsConfig,
  AppUser,
  BannerAd,
  Brand,
  CartItem,
  Category,
  CategoryId,
  ConsultRequest,
  ConsultTopic,
  ConsultTopicConfig,
  Coupon,
  HomeSectionConfig,
  LensOptionConfig,
  Locale,
  Order,
  OrderStatus,
  PaymentMethod,
  Product,
  SavedAddress,
  SavedPrescription,
  StaffPermission,
  StoreSettings,
  ThemeMode,
  UserRole,
} from '../types';
import {
  APP_APPEARANCE_SEED,
  APP_TEXTS_SEED,
  BANNERS_SEED,
  BRANDS_SEED,
  CATEGORIES_SEED,
  CONSULT_TOPICS_SEED,
  COUPONS_SEED,
  CUSTOMERS_AND_STAFF_SEED,
  HOME_SECTIONS_SEED,
  INITIAL_CONSULTS_SEED,
  INITIAL_NOTIFICATIONS_SEED,
  INITIAL_ORDERS_SEED,
  INITIAL_USER_SEED,
  LENS_OPTIONS_SEED,
  PRODUCTS_SEED,
  STORE_SETTINGS_SEED,
} from '../data/seedData';

export type AppTab =
  | 'home'
  | 'catalog'
  | 'cart'
  | 'orders'
  | 'consult'
  | 'profile'
  | 'favorites'
  | 'contact'
  | 'admin';

interface StoreState {
  locale: Locale;
  theme: ThemeMode;
  activeTab: AppTab;
  catalogCategory: CategoryId | 'all';
  catalogSearch: string;
  selectedProductId: string | null;
  user: AppUser;
  directoryUsers: AppUser[];
  products: Product[];
  categories: Category[];
  brands: Brand[];
  banners: BannerAd[];
  coupons: Coupon[];
  cart: CartItem[];
  orders: Order[];
  notifications: AppNotification[];
  consults: ConsultRequest[];
  consultTopics: ConsultTopicConfig[];
  lensOptions: LensOptionConfig[];
  homeSections: HomeSectionConfig[];
  appTexts: AppTextsConfig;
  appearance: AppAppearanceConfig;
  settings: StoreSettings;
  toastMessage: string | null;
}

interface PlaceOrderPayload {
  customerName: string;
  customerPhone: string;
  stateId: string;
  city: string;
  area: string;
  addressDetails: string;
  paymentMethod: PaymentMethod;
  couponCode?: string;
  discountSdg: number;
  deliveryFeeSdg: number;
  bankTransferReference?: string;
  bankTransferReceiptUrl?: string;
}

interface BroadcastPayload {
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  imageUrl?: string;
  segment?: 'all' | 'khartoum' | 'states' | 'vip';
  deepLinkType?: 'order' | 'product' | 'category' | 'consult' | 'url';
  deepLinkId?: string;
}

interface StoreContextValue extends StoreState {
  t: (ar: string, en: string) => string;
  unreadNotificationsCount: number;
  cartCount: number;
  visibleProducts: Product[];
  visibleCategories: Category[];
  visibleBrands: Brand[];
  hasPermission: (perm: StaffPermission) => boolean;
  setLocale: (l: Locale) => void;
  setTheme: (m: ThemeMode) => void;
  setActiveTab: (tab: AppTab) => void;
  openCatalog: (category?: CategoryId | 'all', search?: string) => void;
  setCatalogSearch: (q: string) => void;
  openProduct: (productId: string | null) => void;
  switchRole: (role: UserRole) => void;
  updateProfile: (name: string, phone: string, email: string) => void;
  toggleFavorite: (productId: string) => void;
  addReview: (productId: string, rating: number, comment: string) => void;
  moderateReview: (productId: string, reviewId: string, status: 'approved' | 'hidden' | 'delete') => void;
  addToCart: (item: Omit<CartItem, 'id'>) => void;
  updateCartQty: (cartItemId: string, delta: number) => void;
  removeFromCart: (cartItemId: string) => void;
  placeOrder: (payload: PlaceOrderPayload) => Order | null;
  cancelOrder: (orderId: string) => void;
  reorder: (orderId: string) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  approveBankTransfer: (orderId: string) => void;
  rejectBankTransfer: (orderId: string) => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  sendBroadcastNotification: (payload: BroadcastPayload) => void;
  createConsult: (topic: ConsultTopic, message: string, phone: string, imageUrl?: string) => void;
  replyConsult: (consultId: string, text: string, sender: 'customer' | 'optician') => void;
  closeConsult: (consultId: string) => void;
  updateConsultTopics: (topics: ConsultTopicConfig[]) => void;
  updateLensOptions: (options: LensOptionConfig[]) => void;
  saveAddress: (addr: Omit<SavedAddress, 'id'>) => void;
  deleteAddress: (id: string) => void;
  savePrescription: (rx: Omit<SavedPrescription, 'id' | 'savedAt'>) => void;
  deletePrescription: (id: string) => void;
  upsertProduct: (product: Product) => void;
  duplicateProduct: (id: string) => void;
  deleteProduct: (id: string, permanent?: boolean) => void;
  bulkUpdateProducts: (
    ids: string[],
    action:
      | { type: 'hide' }
      | { type: 'show' }
      | { type: 'delete' }
      | { type: 'move_category'; categoryId: CategoryId }
      | { type: 'apply_discount'; percent: number }
  ) => void;
  upsertCategory: (cat: Category) => void;
  deleteCategoryAndMove: (id: CategoryId, moveToCategoryId?: CategoryId) => boolean;
  upsertBrand: (brand: Brand) => void;
  deleteBrand: (id: string) => void;
  upsertBanner: (banner: BannerAd) => void;
  deleteBanner: (id: string) => void;
  upsertCoupon: (coupon: Coupon) => void;
  deleteCoupon: (code: string) => void;
  updateHomeSections: (sections: HomeSectionConfig[]) => void;
  updateAppTexts: (texts: AppTextsConfig) => void;
  updateAppearance: (appearance: AppAppearanceConfig) => void;
  updateSettings: (settings: StoreSettings) => void;
  toggleBlockUser: (uid: string) => void;
  upsertStaffOrAdmin: (userRecord: AppUser) => void;
  removeAdminRole: (uid: string) => void;
  showToast: (msg: string) => void;
  resetDemoData: () => void;
}

const STORAGE_KEY = 'vision_plus_sudan_v2';

const StoreContext = createContext<StoreContextValue | null>(null);

function normalizeSocialLinks(raw?: Partial<StoreSettings['socialLinks']>): StoreSettings['socialLinks'] {
  const def = STORE_SETTINGS_SEED.socialLinks;
  if (!raw) return def;
  const pick = (key: keyof StoreSettings['socialLinks']) => {
    const val = raw[key] as unknown;
    if (typeof val === 'string') return { url: val, visible: val.trim().length > 0 };
    if (val && typeof val === 'object' && 'url' in val) {
      return val as { url: string; visible: boolean };
    }
    return def[key];
  };
  return {
    facebook: pick('facebook'),
    instagram: pick('instagram'),
    whatsapp: pick('whatsapp'),
    tiktok: pick('tiktok'),
    telegram: pick('telegram'),
    snapchat: pick('snapchat'),
    youtube: pick('youtube'),
    x: pick('x'),
  };
}

function normalizeHomeSections(raw?: HomeSectionConfig[]): HomeSectionConfig[] {
  if (!Array.isArray(raw)) return HOME_SECTIONS_SEED;
  const validIds = new Set(HOME_SECTIONS_SEED.map((s) => s.id));
  const filtered = raw.filter((s) => validIds.has(s.id));
  return filtered.length > 0 ? filtered : HOME_SECTIONS_SEED;
}

function getInitialState(): StoreState {
  const baseAppearance = APP_APPEARANCE_SEED;
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      return {
        locale: parsed.locale || 'ar',
        theme: parsed.theme || parsed.appearance?.defaultTheme || baseAppearance.defaultTheme,
        activeTab: 'home',
        catalogCategory: 'all',
        catalogSearch: '',
        selectedProductId: null,
        user: parsed.user || INITIAL_USER_SEED,
        directoryUsers: parsed.directoryUsers || CUSTOMERS_AND_STAFF_SEED,
        products: parsed.products || PRODUCTS_SEED,
        categories: parsed.categories || CATEGORIES_SEED,
        brands: parsed.brands || BRANDS_SEED,
        banners: parsed.banners || BANNERS_SEED,
        coupons: parsed.coupons || COUPONS_SEED,
        cart: parsed.cart || [],
        orders: parsed.orders || INITIAL_ORDERS_SEED,
        notifications: parsed.notifications || INITIAL_NOTIFICATIONS_SEED,
        consults: parsed.consults || INITIAL_CONSULTS_SEED,
        consultTopics: parsed.consultTopics || CONSULT_TOPICS_SEED,
        lensOptions: parsed.lensOptions || LENS_OPTIONS_SEED,
        homeSections: normalizeHomeSections(parsed.homeSections),
        appTexts: { ...APP_TEXTS_SEED, ...(parsed.appTexts || {}) },
        appearance: { ...APP_APPEARANCE_SEED, ...(parsed.appearance || {}) },
        settings: {
          ...STORE_SETTINGS_SEED,
          ...(parsed.settings || {}),
          email: parsed.settings?.email ?? STORE_SETTINGS_SEED.email,
          contactVisibility: {
            ...STORE_SETTINGS_SEED.contactVisibility,
            ...(parsed.settings?.contactVisibility || {}),
          },
          socialLinks: normalizeSocialLinks(parsed.settings?.socialLinks),
        },
        toastMessage: null,
      };
    }
  } catch {
    // Fallback to seed offline cache
  }
  return {
    locale: 'ar',
    theme: baseAppearance.defaultTheme,
    activeTab: 'home',
    catalogCategory: 'all',
    catalogSearch: '',
    selectedProductId: null,
    user: INITIAL_USER_SEED,
    directoryUsers: CUSTOMERS_AND_STAFF_SEED,
    products: PRODUCTS_SEED,
    categories: CATEGORIES_SEED,
    brands: BRANDS_SEED,
    banners: BANNERS_SEED,
    coupons: COUPONS_SEED,
    cart: [],
    orders: INITIAL_ORDERS_SEED,
    notifications: INITIAL_NOTIFICATIONS_SEED,
    consults: INITIAL_CONSULTS_SEED,
    consultTopics: CONSULT_TOPICS_SEED,
    lensOptions: LENS_OPTIONS_SEED,
    homeSections: HOME_SECTIONS_SEED,
    appTexts: APP_TEXTS_SEED,
    appearance: baseAppearance,
    settings: STORE_SETTINGS_SEED,
    toastMessage: null,
  };
}

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<StoreState>(getInitialState);

  useEffect(() => {
    document.documentElement.lang = state.locale;
    document.documentElement.dir = state.locale === 'ar' ? 'rtl' : 'ltr';
  }, [state.locale]);

  useEffect(() => {
    if (state.theme === 'dark') {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, [state.theme]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--vp-primary', state.appearance.primaryColor || '#11223E');
    root.style.setProperty('--vp-secondary', state.appearance.secondaryColor || '#D9B24C');
    document.title =
      state.locale === 'ar'
        ? `${state.appearance.appNameAr} — ${state.appearance.appNameEn}`
        : `${state.appearance.appNameEn} — ${state.appearance.appNameAr}`;
  }, [state.appearance, state.locale]);

  useEffect(() => {
    try {
      const persist = {
        locale: state.locale,
        theme: state.theme,
        user: state.user,
        directoryUsers: state.directoryUsers,
        products: state.products,
        categories: state.categories,
        brands: state.brands,
        banners: state.banners,
        coupons: state.coupons,
        cart: state.cart,
        orders: state.orders,
        notifications: state.notifications,
        consults: state.consults,
        consultTopics: state.consultTopics,
        lensOptions: state.lensOptions,
        homeSections: state.homeSections,
        appTexts: state.appTexts,
        appearance: state.appearance,
        settings: state.settings,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(persist));
    } catch {
      // Offline cache quota safe fallback
    }
  }, [
    state.locale,
    state.theme,
    state.user,
    state.directoryUsers,
    state.products,
    state.categories,
    state.brands,
    state.banners,
    state.coupons,
    state.cart,
    state.orders,
    state.notifications,
    state.consults,
    state.consultTopics,
    state.lensOptions,
    state.homeSections,
    state.appTexts,
    state.appearance,
    state.settings,
  ]);

  const showToast = (msg: string) => {
    setState((prev) => ({ ...prev, toastMessage: msg }));
    window.setTimeout(() => {
      setState((prev) => (prev.toastMessage === msg ? { ...prev, toastMessage: null } : prev));
    }, 3200);
  };

  const t = (ar: string, en: string) => (state.locale === 'ar' ? ar : en);

  const unreadNotificationsCount = useMemo(
    () => state.notifications.filter((n) => !n.isRead).length,
    [state.notifications]
  );

  const cartCount = useMemo(
    () => state.cart.reduce((acc, item) => acc + item.quantity, 0),
    [state.cart]
  );

  const visibleProducts = useMemo(
    () => state.products.filter((p) => p.visible && !p.isDeleted),
    [state.products]
  );

  const visibleCategories = useMemo(
    () =>
      state.categories
        .filter((c) => c.visible)
        .slice()
        .sort((a, b) => a.order - b.order),
    [state.categories]
  );

  const visibleBrands = useMemo(
    () => state.brands.filter((b) => b.visible),
    [state.brands]
  );

  const hasPermission = (perm: StaffPermission) => {
    if (state.user.role === 'admin') return true;
    if (state.user.role === 'staff') {
      return Boolean(state.user.permissions?.includes(perm));
    }
    return false;
  };

  const value: StoreContextValue = {
    ...state,
    t,
    unreadNotificationsCount,
    cartCount,
    visibleProducts,
    visibleCategories,
    visibleBrands,
    hasPermission,
    setLocale: (locale) => setState((prev) => ({ ...prev, locale })),
    setTheme: (theme) => setState((prev) => ({ ...prev, theme })),
    setActiveTab: (activeTab) => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setState((prev) => ({ ...prev, activeTab, selectedProductId: null }));
    },
    openCatalog: (category = 'all', search = '') => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setState((prev) => ({
        ...prev,
        activeTab: 'catalog',
        catalogCategory: category,
        catalogSearch: search,
        selectedProductId: null,
      }));
    },
    setCatalogSearch: (catalogSearch) => setState((prev) => ({ ...prev, catalogSearch })),
    openProduct: (selectedProductId) => setState((prev) => ({ ...prev, selectedProductId })),
    switchRole: (role) => {
      setState((prev) => ({
        ...prev,
        user: {
          ...prev.user,
          role,
          permissions:
            role === 'admin'
              ? [
                  'dashboard', 'products', 'categories', 'home_builder', 'banners',
                  'content', 'appearance', 'settings', 'orders', 'coupons',
                  'notifications', 'consults', 'customers', 'roles',
                ]
              : role === 'staff'
              ? ['dashboard', 'orders', 'consults']
              : undefined,
        },
        activeTab: role === 'admin' || role === 'staff' ? 'admin' : 'home',
      }));
      showToast(
        role === 'admin'
          ? t('تم التبديل إلى لوحة الإدارة الكاملة', 'Switched to Full Admin Panel')
          : role === 'staff'
          ? t('تم التبديل إلى وضع موظف الطلبات', 'Switched to Staff Role')
          : t('تم التبديل إلى متجر العملاء', 'Switched to Customer Storefront')
      );
    },
    updateProfile: (name, phone, email) => {
      setState((prev) => ({ ...prev, user: { ...prev.user, name, phone, email } }));
      showToast(t('تم تحديث بيانات الحساب', 'Profile updated'));
    },
    toggleFavorite: (productId) => {
      setState((prev) => {
        const exists = prev.user.favoriteProductIds.includes(productId);
        const favoriteProductIds = exists
          ? prev.user.favoriteProductIds.filter((id) => id !== productId)
          : [...prev.user.favoriteProductIds, productId];
        return { ...prev, user: { ...prev.user, favoriteProductIds } };
      });
    },
    addReview: (productId, rating, comment) => {
      setState((prev) => {
        const products = prev.products.map((p) => {
          if (p.id !== productId) return p;
          const nextReviews = [
            {
              id: `rev_${Date.now()}`,
              productId,
              userId: prev.user.uid,
              userName: prev.user.name,
              rating,
              comment,
              status: 'approved' as const,
              createdAt: new Date().toISOString(),
            },
            ...p.reviews,
          ];
          const approved = nextReviews.filter((r) => r.status === 'approved');
          const avg =
            approved.reduce((s, r) => s + r.rating, 0) / Math.max(1, approved.length);
          return { ...p, reviews: nextReviews, rating: Number(avg.toFixed(1)) };
        });
        return { ...prev, products };
      });
      showToast(t('شكراً لك، تم إضافة تقييمك', 'Review submitted'));
    },
    moderateReview: (productId, reviewId, action) => {
      setState((prev) => ({
        ...prev,
        products: prev.products.map((p) => {
          if (p.id !== productId) return p;
          const nextReviews =
            action === 'delete'
              ? p.reviews.filter((r) => r.id !== reviewId)
              : p.reviews.map((r) => (r.id === reviewId ? { ...r, status: action } : r));
          const approved = nextReviews.filter((r) => r.status === 'approved');
          const avg =
            approved.length > 0
              ? approved.reduce((s, r) => s + r.rating, 0) / approved.length
              : p.rating;
          return { ...p, reviews: nextReviews, rating: Number(avg.toFixed(1)) };
        }),
      }));
      showToast(t('تم تحديث حالة التقييم', 'Review moderation saved'));
    },
    addToCart: (item) => {
      setState((prev) => {
        const hasCustomSpecs = Boolean(item.prescription || item.contactLensSelection);
        const existingIndex = !hasCustomSpecs
          ? prev.cart.findIndex(
              (c) =>
                c.productId === item.productId &&
                c.variantId === item.variantId &&
                !c.prescription &&
                !c.contactLensSelection
            )
          : -1;
        let nextCart: CartItem[];
        if (existingIndex >= 0) {
          nextCart = prev.cart.map((c, idx) =>
            idx === existingIndex ? { ...c, quantity: c.quantity + item.quantity } : c
          );
        } else {
          nextCart = [
            ...prev.cart,
            { ...item, id: `ci_${Date.now()}_${Math.random().toString(36).slice(2, 6)}` },
          ];
        }
        return { ...prev, cart: nextCart };
      });
      showToast(t('تمت الإضافة إلى السلة', 'Added to cart'));
    },
    updateCartQty: (cartItemId, delta) => {
      setState((prev) => ({
        ...prev,
        cart: prev.cart
          .map((c) => (c.id === cartItemId ? { ...c, quantity: c.quantity + delta } : c))
          .filter((c) => c.quantity > 0),
      }));
    },
    removeFromCart: (cartItemId) => {
      setState((prev) => ({
        ...prev,
        cart: prev.cart.filter((c) => c.id !== cartItemId),
      }));
    },
    placeOrder: (payload) => {
      const subtotalSdg = state.cart.reduce(
        (sum, item) =>
          sum +
          (item.unitPriceSdg + (item.prescription?.lensExtraPriceSdg || 0)) * item.quantity,
        0
      );
      if (state.settings.minimumOrderSdg > 0 && subtotalSdg < state.settings.minimumOrderSdg) {
        showToast(
          t(
            `الحد الأدنى للطلب هو ${state.settings.minimumOrderSdg} ج.س`,
            `Minimum order is ${state.settings.minimumOrderSdg} SDG`
          )
        );
        return null;
      }
      const totalSdg = Math.max(0, subtotalSdg - payload.discountSdg + payload.deliveryFeeSdg);
      const initialStatus: OrderStatus =
        payload.paymentMethod === 'bankak' ? 'awaiting_payment_verification' : 'pending';
      const orderId = `ORD-2026-${Math.floor(1050 + Math.random() * 8900)}`;

      const items = state.cart.map((ci) => {
        const prod = state.products.find((p) => p.id === ci.productId);
        return {
          productId: ci.productId,
          titleAr: prod?.titleAr || 'منتج بصري',
          titleEn: prod?.titleEn || 'Optical Item',
          image: prod?.images[0] || '',
          variantLabel: ci.variantLabel,
          quantity: ci.quantity,
          unitPriceSdg: ci.unitPriceSdg,
          prescription: ci.prescription,
          contactLensSelection: ci.contactLensSelection,
        };
      });

      const newOrder: Order = {
        id: orderId,
        customerUid: state.user.uid,
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        stateId: payload.stateId,
        city: payload.city,
        area: payload.area,
        addressDetails: payload.addressDetails,
        items,
        subtotalSdg,
        discountSdg: payload.discountSdg,
        deliveryFeeSdg: payload.deliveryFeeSdg,
        totalSdg,
        couponCode: payload.couponCode,
        paymentMethod: payload.paymentMethod,
        bankTransferReference: payload.bankTransferReference,
        bankTransferReceiptUrl: payload.bankTransferReceiptUrl,
        status: initialStatus,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      const notif: AppNotification = {
        id: `n_${Date.now()}`,
        titleAr:
          initialStatus === 'awaiting_payment_verification'
            ? `تم استلام طلبك #${orderId} وإشعار بنكك`
            : `تم تأكيد استلام طلبك #${orderId}`,
        titleEn:
          initialStatus === 'awaiting_payment_verification'
            ? `Order #${orderId} & Bankak Receipt Received`
            : `Order #${orderId} Received`,
        bodyAr:
          initialStatus === 'awaiting_payment_verification'
            ? 'سيقوم فريقنا بمراجعة إيصال التحويل البنكي وتأكيد الطلب قريباً.'
            : 'طلبك الآن قيد المراجعة وسيتواصل معك المندوب.',
        bodyEn:
          initialStatus === 'awaiting_payment_verification'
            ? 'Our team is verifying your Bankak transfer receipt.'
            : 'Your COD order is pending confirmation.',
        isRead: false,
        createdAt: new Date().toISOString(),
        deepLinkType: 'order',
        deepLinkId: orderId,
      };

      setState((prev) => ({
        ...prev,
        orders: [newOrder, ...prev.orders],
        cart: [],
        notifications: [notif, ...prev.notifications],
        coupons: payload.couponCode
          ? prev.coupons.map((c) =>
              c.code === payload.couponCode ? { ...c, usedCount: c.usedCount + 1 } : c
            )
          : prev.coupons,
        products: prev.products.map((p) => {
          const orderedQty = prev.cart
            .filter((c) => c.productId === p.id)
            .reduce((acc, c) => acc + c.quantity, 0);
          return orderedQty > 0 ? { ...p, stock: Math.max(0, p.stock - orderedQty) } : p;
        }),
        activeTab: 'orders',
      }));
      showToast(t(`تم إنشاء الطلب #${orderId} بنجاح`, `Order #${orderId} placed`));
      return newOrder;
    },
    cancelOrder: (orderId) => {
      setState((prev) => ({
        ...prev,
        orders: prev.orders.map((o) =>
          o.id === orderId ? { ...o, status: 'cancelled', updatedAt: new Date().toISOString() } : o
        ),
      }));
      showToast(t('تم إلغاء الطلب', 'Order cancelled'));
    },
    reorder: (orderId) => {
      const order = state.orders.find((o) => o.id === orderId);
      if (!order) return;
      const itemsToAdd: CartItem[] = order.items.map((item, idx) => ({
        id: `ci_re_${Date.now()}_${idx}`,
        productId: item.productId,
        variantLabel: item.variantLabel,
        quantity: item.quantity,
        unitPriceSdg: item.unitPriceSdg,
        prescription: item.prescription,
        contactLensSelection: item.contactLensSelection,
      }));
      setState((prev) => ({
        ...prev,
        cart: [...prev.cart, ...itemsToAdd],
        activeTab: 'cart',
      }));
      showToast(t('تمت إعادة إضافة منتجات الطلب للسلة', 'Order items added to cart'));
    },
    updateOrderStatus: (orderId, status) => {
      const notif: AppNotification = {
        id: `n_${Date.now()}`,
        titleAr: `تحديث حالة الطلب #${orderId}`,
        titleEn: `Order #${orderId} Updated`,
        bodyAr: `أصبحت حالة طلبك الآن: ${status}`,
        bodyEn: `Your order status is now: ${status}`,
        isRead: false,
        createdAt: new Date().toISOString(),
        deepLinkType: 'order',
        deepLinkId: orderId,
      };
      setState((prev) => ({
        ...prev,
        orders: prev.orders.map((o) =>
          o.id === orderId ? { ...o, status, updatedAt: new Date().toISOString() } : o
        ),
        notifications: [notif, ...prev.notifications],
      }));
      showToast(t('تم تحديث حالة الطلب وإشعار العميل', 'Order status updated'));
    },
    approveBankTransfer: (orderId) => {
      const notif: AppNotification = {
        id: `n_${Date.now()}`,
        titleAr: `تم اعتماد تحويل بنكك للطلب #${orderId}`,
        titleEn: `Bankak Transfer Approved for #${orderId}`,
        bodyAr: 'تم تأكيد استلام المبلغ بنجاح، وطلبك الآن في مرحلة التجهيز.',
        bodyEn: 'Your transfer has been verified and your order is confirmed.',
        isRead: false,
        createdAt: new Date().toISOString(),
        deepLinkType: 'order',
        deepLinkId: orderId,
      };
      setState((prev) => ({
        ...prev,
        orders: prev.orders.map((o) =>
          o.id === orderId
            ? { ...o, status: 'confirmed', updatedAt: new Date().toISOString() }
            : o
        ),
        notifications: [notif, ...prev.notifications],
      }));
      showToast(t('تم اعتماد الدفع عبر بنكك وتأكيد الطلب', 'Bankak transfer approved'));
    },
    rejectBankTransfer: (orderId) => {
      const notif: AppNotification = {
        id: `n_${Date.now()}`,
        titleAr: `تعذر التحقق من إيصال الطلب #${orderId}`,
        titleEn: `Transfer Verification Failed for #${orderId}`,
        bodyAr: 'يرجى التواصل مع خدمة العملاء أو إعادة إرسال إيصال التحويل الصحيح.',
        bodyEn: 'Please contact support regarding your bank transfer receipt.',
        isRead: false,
        createdAt: new Date().toISOString(),
        deepLinkType: 'order',
        deepLinkId: orderId,
      };
      setState((prev) => ({
        ...prev,
        orders: prev.orders.map((o) =>
          o.id === orderId
            ? { ...o, status: 'cancelled', updatedAt: new Date().toISOString() }
            : o
        ),
        notifications: [notif, ...prev.notifications],
      }));
      showToast(t('تم رفض الإيصال وإشعار العميل', 'Transfer rejected'));
    },
    markNotificationRead: (id) => {
      setState((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      }));
    },
    markAllNotificationsRead: () => {
      setState((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) => ({ ...n, isRead: true })),
      }));
    },
    sendBroadcastNotification: (payload) => {
      const notif: AppNotification = {
        id: `n_${Date.now()}`,
        titleAr: payload.titleAr,
        titleEn: payload.titleEn,
        bodyAr: payload.bodyAr,
        bodyEn: payload.bodyEn,
        imageUrl: payload.imageUrl,
        segment: payload.segment || 'all',
        deepLinkType: payload.deepLinkType,
        deepLinkId: payload.deepLinkId,
        isRead: false,
        createdAt: new Date().toISOString(),
      };
      setState((prev) => ({
        ...prev,
        notifications: [notif, ...prev.notifications],
      }));
      showToast(t('تم إرسال الإشعار وحفظه في السجل', 'Notification sent & logged'));
    },
    createConsult: (topic, message, phone, imageUrl) => {
      const now = new Date().toISOString();
      const req: ConsultRequest = {
        id: `c_${Date.now()}`,
        customerUid: state.user.uid,
        customerName: state.user.name,
        phone,
        topic,
        status: 'open',
        createdAt: now,
        updatedAt: now,
        messages: [
          {
            id: `m_${Date.now()}`,
            sender: 'customer',
            senderName: state.user.name,
            text: message,
            imageUrl,
            createdAt: now,
          },
        ],
      };
      setState((prev) => ({
        ...prev,
        consults: [req, ...prev.consults],
      }));
      showToast(t('تم إرسال استشارتك لأخصائي البصريات', 'Consultation request sent'));
    },
    replyConsult: (consultId, text, sender) => {
      const now = new Date().toISOString();
      setState((prev) => {
        const nextNotifs =
          sender === 'optician'
            ? [
                {
                  id: `n_${Date.now()}`,
                  titleAr: 'رد جديد من أخصائي البصريات',
                  titleEn: 'New Optician Reply',
                  bodyAr: text.slice(0, 90),
                  bodyEn: text.slice(0, 90),
                  isRead: false,
                  createdAt: now,
                  deepLinkType: 'consult' as const,
                  deepLinkId: consultId,
                },
                ...prev.notifications,
              ]
            : prev.notifications;
        return {
          ...prev,
          notifications: nextNotifs,
          consults: prev.consults.map((c) =>
            c.id === consultId
              ? {
                  ...c,
                  status: sender === 'optician' ? 'answered' : 'open',
                  updatedAt: now,
                  messages: [
                    ...c.messages,
                    {
                      id: `m_${Date.now()}`,
                      sender,
                      senderName:
                        sender === 'optician'
                          ? prev.locale === 'ar'
                            ? `أخصائي البصريات — ${prev.appearance.appNameAr}`
                            : `Lead Optician — ${prev.appearance.appNameEn}`
                          : prev.user.name,
                      text,
                      createdAt: now,
                    },
                  ],
                }
              : c
          ),
        };
      });
      if (sender === 'optician') {
        showToast(t('تم إرسال الرد وإشعار العميل', 'Reply sent & customer notified'));
      }
    },
    closeConsult: (consultId) => {
      setState((prev) => ({
        ...prev,
        consults: prev.consults.map((c) =>
          c.id === consultId ? { ...c, status: 'closed', updatedAt: new Date().toISOString() } : c
        ),
      }));
    },
    updateConsultTopics: (consultTopics) => {
      setState((prev) => ({ ...prev, consultTopics }));
      showToast(t('تم تحديث مواضيع الاستشارة', 'Consult topics updated'));
    },
    updateLensOptions: (lensOptions) => {
      setState((prev) => ({ ...prev, lensOptions }));
      showToast(t('تم تحديث خيارات العدسات والأسعار', 'Lens options updated'));
    },
    saveAddress: (addr) => {
      setState((prev) => ({
        ...prev,
        user: {
          ...prev.user,
          addresses: [...prev.user.addresses, { ...addr, id: `addr_${Date.now()}` }],
        },
      }));
      showToast(t('تم حفظ العنوان', 'Address saved'));
    },
    deleteAddress: (id) => {
      setState((prev) => ({
        ...prev,
        user: {
          ...prev.user,
          addresses: prev.user.addresses.filter((a) => a.id !== id),
        },
      }));
    },
    savePrescription: (rx) => {
      setState((prev) => ({
        ...prev,
        user: {
          ...prev.user,
          prescriptions: [
            { ...rx, id: `rx_${Date.now()}`, savedAt: new Date().toISOString() },
            ...prev.user.prescriptions,
          ],
        },
      }));
      showToast(t('تم حفظ الوصفة الطبية في ملفك', 'Prescription saved to profile'));
    },
    deletePrescription: (id) => {
      setState((prev) => ({
        ...prev,
        user: {
          ...prev.user,
          prescriptions: prev.user.prescriptions.filter((p) => p.id !== id),
        },
      }));
    },
    upsertProduct: (product) => {
      setState((prev) => {
        const exists = prev.products.some((p) => p.id === product.id);
        const products = exists
          ? prev.products.map((p) => (p.id === product.id ? product : p))
          : [product, ...prev.products];
        return { ...prev, products };
      });
      showToast(t('تم حفظ المنتج ونشره في المتجر', 'Product saved & live'));
    },
    duplicateProduct: (id) => {
      setState((prev) => {
        const src = prev.products.find((p) => p.id === id);
        if (!src) return prev;
        const copy: Product = {
          ...src,
          id: `p_copy_${Date.now()}`,
          sku: `${src.sku}-COPY`,
          titleAr: `${src.titleAr} (نسخة)`,
          titleEn: `${src.titleEn} (Copy)`,
          visible: false,
          reviews: [],
        };
        return { ...prev, products: [copy, ...prev.products] };
      });
      showToast(t('تم نسخ المنتج كمسودة مخفية', 'Product duplicated as draft'));
    },
    deleteProduct: (id, permanent = false) => {
      setState((prev) => ({
        ...prev,
        products: permanent
          ? prev.products.filter((p) => p.id !== id)
          : prev.products.map((p) => (p.id === id ? { ...p, isDeleted: true, visible: false } : p)),
      }));
      showToast(
        permanent
          ? t('تم حذف المنتج نهائياً', 'Product permanently deleted')
          : t('تم أرشفة المنتج (حذف ناعم)', 'Product soft-deleted')
      );
    },
    bulkUpdateProducts: (ids, action) => {
      setState((prev) => {
        let products = prev.products;
        if (action.type === 'hide') {
          products = products.map((p) => (ids.includes(p.id) ? { ...p, visible: false } : p));
        } else if (action.type === 'show') {
          products = products.map((p) =>
            ids.includes(p.id) ? { ...p, visible: true, isDeleted: false } : p
          );
        } else if (action.type === 'delete') {
          products = products.map((p) =>
            ids.includes(p.id) ? { ...p, isDeleted: true, visible: false } : p
          );
        } else if (action.type === 'move_category') {
          products = products.map((p) =>
            ids.includes(p.id) ? { ...p, categoryId: action.categoryId } : p
          );
        } else if (action.type === 'apply_discount') {
          const pct = Math.max(1, Math.min(90, action.percent));
          products = products.map((p) => {
            if (!ids.includes(p.id)) return p;
            const base = p.oldPriceSdg && p.oldPriceSdg > p.priceSdg ? p.oldPriceSdg : p.priceSdg;
            return {
              ...p,
              oldPriceSdg: base,
              priceSdg: Math.round((base * (100 - pct)) / 100),
              isOnOffer: true,
            };
          });
        }
        return { ...prev, products };
      });
      showToast(t(`تم تنفيذ الإجراء الجماعي على ${ids.length} منتج`, `Bulk action applied to ${ids.length} items`));
    },
    upsertCategory: (cat) => {
      setState((prev) => {
        const exists = prev.categories.some((c) => c.id === cat.id);
        const categories = exists
          ? prev.categories.map((c) => (c.id === cat.id ? cat : c))
          : [...prev.categories, cat];
        return { ...prev, categories };
      });
      showToast(t('تم حفظ الفئة', 'Category saved'));
    },
    deleteCategoryAndMove: (id, moveToCategoryId) => {
      const linked = state.products.filter((p) => !p.isDeleted && p.categoryId === id);
      if (linked.length > 0 && !moveToCategoryId) {
        return false;
      }
      setState((prev) => ({
        ...prev,
        products:
          linked.length > 0 && moveToCategoryId
            ? prev.products.map((p) =>
                p.categoryId === id ? { ...p, categoryId: moveToCategoryId } : p
              )
            : prev.products,
        categories: prev.categories.filter((c) => c.id !== id),
      }));
      showToast(t('تم حذف الفئة', 'Category deleted'));
      return true;
    },
    upsertBrand: (brand) => {
      setState((prev) => {
        const exists = prev.brands.some((b) => b.id === brand.id);
        const brands = exists
          ? prev.brands.map((b) => (b.id === brand.id ? brand : b))
          : [...prev.brands, brand];
        return { ...prev, brands };
      });
      showToast(t('تم حفظ العلامة التجارية', 'Brand saved'));
    },
    deleteBrand: (id) => {
      setState((prev) => ({
        ...prev,
        brands: prev.brands.filter((b) => b.id !== id),
      }));
      showToast(t('تم حذف العلامة التجارية', 'Brand deleted'));
    },
    upsertBanner: (banner) => {
      setState((prev) => {
        const exists = prev.banners.some((b) => b.id === banner.id);
        const banners = exists
          ? prev.banners.map((b) => (b.id === banner.id ? banner : b))
          : [...prev.banners, banner];
        return { ...prev, banners };
      });
      showToast(t('تم حفظ البانر الإعلاني', 'Banner saved'));
    },
    deleteBanner: (id) => {
      setState((prev) => ({
        ...prev,
        banners: prev.banners.filter((b) => b.id !== id),
      }));
    },
    upsertCoupon: (coupon) => {
      setState((prev) => {
        const exists = prev.coupons.some((c) => c.code === coupon.code);
        const coupons = exists
          ? prev.coupons.map((c) => (c.code === coupon.code ? coupon : c))
          : [coupon, ...prev.coupons];
        return { ...prev, coupons };
      });
      showToast(t('تم حفظ كود الخصم', 'Coupon saved'));
    },
    deleteCoupon: (code) => {
      setState((prev) => ({
        ...prev,
        coupons: prev.coupons.filter((c) => c.code !== code),
      }));
    },
    updateHomeSections: (homeSections) => {
      setState((prev) => ({ ...prev, homeSections }));
      showToast(t('تم تحديث تصميم الصفحة الرئيسية فوراً', 'Home layout updated live'));
    },
    updateAppTexts: (appTexts) => {
      setState((prev) => ({ ...prev, appTexts }));
      showToast(t('تم تحديث نصوص وسياسات التطبيق فوراً', 'App content & policies updated'));
    },
    updateAppearance: (appearance) => {
      setState((prev) => ({ ...prev, appearance, theme: appearance.defaultTheme }));
      showToast(t('تم تحديث مظهر وألوان التطبيق فوراً', 'App appearance updated live'));
    },
    updateSettings: (settings) => {
      setState((prev) => ({ ...prev, settings }));
      showToast(t('تم حفظ إعدادات المتجر ورسوم الولايات', 'Store settings updated'));
    },
    toggleBlockUser: (uid) => {
      setState((prev) => ({
        ...prev,
        directoryUsers: prev.directoryUsers.map((u) =>
          u.uid === uid ? { ...u, isBlocked: !u.isBlocked } : u
        ),
        user: prev.user.uid === uid ? { ...prev.user, isBlocked: !prev.user.isBlocked } : prev.user,
      }));
      showToast(t('تم تحديث حالة حساب العميل', 'Customer status updated'));
    },
    upsertStaffOrAdmin: (userRecord) => {
      setState((prev) => {
        const exists = prev.directoryUsers.some((u) => u.uid === userRecord.uid || u.email === userRecord.email);
        const directoryUsers = exists
          ? prev.directoryUsers.map((u) =>
              u.uid === userRecord.uid || u.email === userRecord.email ? userRecord : u
            )
          : [userRecord, ...prev.directoryUsers];
        return { ...prev, directoryUsers };
      });
      showToast(t('تم حفظ صلاحيات المسؤول/الموظف', 'Admin/Staff permissions saved'));
    },
    removeAdminRole: (uid) => {
      setState((prev) => ({
        ...prev,
        directoryUsers: prev.directoryUsers.map((u) =>
          u.uid === uid ? { ...u, role: 'customer', permissions: undefined } : u
        ),
      }));
      showToast(t('تمت إزالة صلاحية الإدارة', 'Admin role removed'));
    },
    showToast,
    resetDemoData: () => {
      localStorage.removeItem(STORAGE_KEY);
      window.location.reload();
    },
  };

  return <StoreContext.Provider value={value}>{children}</StoreContext.Provider>;
};

export function useStore(): StoreContextValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore must be used inside StoreProvider');
  return ctx;
}
