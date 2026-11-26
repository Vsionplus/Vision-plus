import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import {
  EmailAuthProvider,
  User,
  createUserWithEmailAndPassword,
  linkWithCredential,
  onAuthStateChanged,
  reauthenticateWithCredential,
  sendEmailVerification,
  sendPasswordResetEmail,
  signInAnonymously,
  signInWithEmailAndPassword,
  signOut,
  updateProfile as firebaseUpdateProfile,
  verifyBeforeUpdateEmail,
} from 'firebase/auth';
import {
  collection,
  deleteDoc,
  deleteField,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  limit,
  onSnapshot,
  query,
  runTransaction,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from 'firebase/firestore';
import {
  AppAppearanceConfig,
  AppNotification,
  AppTextsConfig,
  AppUser,
  BannerAd,
  Brand,
  CancelRequest,
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
  OrderAddressSnapshot,
  OrderItem,
  OrderStatus,
  PaymentMethod,
  PrescriptionData,
  Product,
  SavedAddress,
  SavedPrescription,
  StaffPermission,
  StoreSettings,
  ThemeMode,
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
  INITIAL_NOTIFICATIONS_SEED,
  LENS_OPTIONS_SEED,
  PRODUCTS_SEED,
  STORE_SETTINGS_SEED,
} from '../data/seedData';
import {
  OperationType,
  auth,
  db,
  getFirebaseAuthErrorCode,
  handleFirestoreError,
  mapFirebaseAuthError,
  stripUndefined,
} from '../lib/firebase';
import { hasCustomLensOrRx, resolveExtraOptions, resolveVisionType } from '../utils/prescription';
import { calculateSplitAmounts, formatSdg, getOrderStatusLabel } from '../utils/format';
import {
  AdminLoginAttemptStatus,
  clearAdminAttempts,
  getAdminAttemptStatusByEmail,
  isOwnerAdminUid,
  recordAdminFailedAttempt,
} from '../utils/adminAuth';

export type AppTab =
  | 'home'
  | 'catalog'
  | 'cart'
  | 'orders'
  | 'consult'
  | 'profile'
  | 'favorites'
  | 'contact';

export type AdminRouteMode = 'store' | 'admin_login' | 'admin_panel';

export class AdminLoginError extends Error {
  attemptStatus?: AdminLoginAttemptStatus;
  debugInfo?: string;
  constructor(message: string, attemptStatus?: AdminLoginAttemptStatus, debugInfo?: string) {
    super(message);
    this.name = 'AdminLoginError';
    this.attemptStatus = attemptStatus;
    this.debugInfo = debugInfo;
  }
}

export type AuthScreenMode = 'none' | 'entry' | 'verify_email';

export interface AuthModalState {
  open: boolean;
  view: 'choice' | 'login' | 'register' | 'reset';
  checkoutNotice: boolean;
}

const ALL_ADMIN_PERMS: StaffPermission[] = [
  'dashboard',
  'products',
  'categories',
  'home_builder',
  'banners',
  'content',
  'appearance',
  'settings',
  'orders',
  'coupons',
  'notifications',
  'consults',
  'customers',
  'roles',
];

const GUEST_SESSION_KEY = 'vp_guest_session';

function readGuestSessionFlag(): boolean {
  try {
    return typeof sessionStorage !== 'undefined' && sessionStorage.getItem(GUEST_SESSION_KEY) === '1';
  } catch {
    return false;
  }
}

function writeGuestSessionFlag(active: boolean) {
  try {
    if (typeof sessionStorage === 'undefined') return;
    if (active) {
      sessionStorage.setItem(GUEST_SESSION_KEY, '1');
    } else {
      sessionStorage.removeItem(GUEST_SESSION_KEY);
    }
  } catch {
    // Ignore storage quota errors
  }
}

function createEmptyUser(uid = 'guest_pending'): AppUser {
  return {
    uid,
    name: 'ضيف فيجن بلس',
    email: '',
    phone: '',
    role: 'customer',
    isBlocked: false,
    isAnonymous: true,
    emailVerified: false,
    favoriteProductIds: [],
    addresses: [],
    prescriptions: [],
  };
}

interface StoreState {
  locale: Locale;
  theme: ThemeMode;
  activeTab: AppTab;
  tabHistory: AppTab[];
  adminRoute: AdminRouteMode;
  catalogCategory: CategoryId | 'all';
  catalogSearch: string;
  selectedProductId: string | null;
  authReady: boolean;
  firebaseUser: User | null;
  guestSession: boolean;
  authScreenMode: AuthScreenMode;
  authModal: AuthModalState;
  pendingCheckoutReturn: boolean;
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
  liveOrderAlert: AppNotification | null;
}

interface PlaceOrderPayload {
  customerName: string;
  customerPhone: string;
  stateId: string;
  city: string;
  area: string;
  addressDetails: string;
  address: OrderAddressSnapshot;
  paymentMethod: PaymentMethod;
  couponCode?: string;
  discountSdg: number;
  deliveryFeeSdg: number;
  bankTransferReference?: string;
  bankTransferReceiptUrl?: string;
  customerNote?: string;
}

export interface CustomerEditOrderPayload {
  customerName: string;
  customerPhone: string;
  stateId: string;
  city: string;
  area: string;
  addressDetails: string;
  address: OrderAddressSnapshot;
  items?: OrderItem[];
  bankTransferReference?: string;
  bankTransferReceiptUrl?: string;
  customerNote?: string;
}

export interface AdminEditOrderPayload {
  customerName: string;
  customerPhone: string;
  stateId: string;
  city: string;
  area: string;
  addressDetails: string;
  address: OrderAddressSnapshot;
  items: OrderItem[];
  discountSdg: number;
  deliveryFeeSdg: number;
  paymentMethod: PaymentMethod;
  bankakPaidSdg?: number;
  codRemainingSdg?: number;
  bankTransferReference?: string;
  adminNote?: string;
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

interface RegisterPayload {
  name: string;
  email: string;
  password: string;
  phone?: string;
}

interface StoreContextValue extends StoreState {
  t: (ar: string, en: string) => string;
  isGuest: boolean;
  isEmailVerified: boolean;
  unreadNotificationsCount: number;
  cartCount: number;
  visibleProducts: Product[];
  visibleCategories: Category[];
  visibleBrands: Brand[];
  hasPermission: (perm: StaffPermission) => boolean;
  setLocale: (l: Locale) => void;
  setTheme: (m: ThemeMode) => void;
  setActiveTab: (tab: AppTab) => void;
  goBack: () => void;
  navigateToAdminPanel: (module?: StaffPermission) => void;
  navigateToHome: () => void;
  openCatalog: (category?: CategoryId | 'all', search?: string) => void;
  setCatalogSearch: (q: string) => void;
  openProduct: (productId: string | null) => void;
  openAuthEntry: () => void;
  openVerifyEmailScreen: () => void;
  closeVerifyEmailScreen: () => void;
  openAuthModal: (view?: 'choice' | 'login' | 'register' | 'reset', checkoutNotice?: boolean) => void;
  closeAuthModal: () => void;
  goToAccountSignIn: (fromCheckout?: boolean) => void;
  continueAsGuest: () => Promise<void>;
  loginWithEmail: (email: string, password: string) => Promise<void>;
  loginAdminWithEmail: (email: string, password: string) => Promise<void>;
  registerWithEmail: (payload: RegisterPayload) => Promise<void>;
  sendPasswordReset: (email: string) => Promise<void>;
  refreshEmailVerification: (silent?: boolean) => Promise<boolean>;
  resendVerificationEmail: () => Promise<void>;
  changeVerificationEmail: (
    newEmail: string,
    currentPassword?: string
  ) => Promise<{ requiresPassword?: boolean }>;
  logout: () => Promise<void>;
  updateProfile: (name: string, phone: string, email: string) => void;
  toggleFavorite: (productId: string) => void;
  addReview: (productId: string, rating: number, comment: string) => void;
  moderateReview: (productId: string, reviewId: string, status: 'approved' | 'hidden' | 'delete') => void;
  addToCart: (item: Omit<CartItem, 'id'>) => void;
  updateCartQty: (cartItemId: string, delta: number) => void;
  updateCartItemPrescription: (cartItemId: string, prescription?: PrescriptionData) => void;
  removeFromCart: (cartItemId: string) => void;
  placeOrder: (payload: PlaceOrderPayload) => Promise<Order | null>;
  updateOrderByCustomer: (orderId: string, payload: CustomerEditOrderPayload) => Promise<void>;
  updateOrderByAdmin: (orderId: string, payload: AdminEditOrderPayload) => Promise<void>;
  requestOrderCancellation: (orderId: string, reason: string, note?: string) => Promise<void>;
  approveOrderCancellation: (orderId: string, adminNote?: string) => Promise<void>;
  rejectOrderCancellation: (orderId: string, adminNote: string) => Promise<void>;
  toggleOrderRefunded: (orderId: string, refunded: boolean) => Promise<void>;
  reorder: (orderId: string) => void;
  updateOrderStatus: (orderId: string, status: OrderStatus) => void;
  approveBankTransfer: (orderId: string) => void;
  rejectBankTransfer: (orderId: string) => void;
  dismissLiveOrderAlert: () => void;
  markNotificationRead: (id: string) => void;
  markAllNotificationsRead: () => void;
  sendBroadcastNotification: (payload: BroadcastPayload) => void;
  createConsult: (topic: ConsultTopic, message: string, phone: string, imageUrl?: string) => void;
  replyConsult: (consultId: string, text: string, sender: 'customer' | 'optician') => void;
  closeConsult: (consultId: string) => void;
  updateConsultTopics: (topics: ConsultTopicConfig[]) => void;
  updateLensOptions: (options: LensOptionConfig[]) => void;
  saveAddress: (addr: Omit<SavedAddress, 'id'>) => SavedAddress;
  updateAddress: (addr: SavedAddress) => void;
  setDefaultAddress: (id: string) => void;
  deleteAddress: (id: string) => void;
  savePrescription: (rx: Omit<SavedPrescription, 'id' | 'savedAt'>) => SavedPrescription;
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
  addOrUpdateAdminByEmail: (
    email: string,
    role: 'admin' | 'staff'
  ) => Promise<{ ok: boolean; error?: string }>;
  removeAdminRole: (uid: string) => Promise<void>;
  showToast: (msg: string) => void;
  seedDefaultProducts: () => Promise<number>;
  resetDemoData: () => void;
}

const STORAGE_KEY = 'vision_plus_sudan_v2';
const CATALOG_SEED_VERSION_KEY = 'vp_catalog_seed_version';
const CATALOG_SEED_VERSION = '2026-11-26-24items';

const LEGACY_AR_WORD = '\u0627\u0644\u0646\u0648\u0631';
const LEGACY_AR_FULL = `${LEGACY_AR_WORD} \u0644\u0644\u0628\u0635\u0631\u064a\u0627\u062a`;
const LEGACY_EN_STORE_SUDAN = ['Optical', 'Store', 'Sudan'].join(' ');
const LEGACY_EN_STORE = ['Optical', 'Store'].join(' ');
const LEGACY_EN_SPACED = ['Al', 'Nour'].join(' ');
const LEGACY_EN_JOINED = ['al', 'nour'].join('');
const LEGACY_WORDMARK = `${String.fromCharCode(43)}Vision`;

export function hasLegacyBrandString(value?: string | null): boolean {
  if (!value) return false;
  const trimmed = value.trim();
  if (!trimmed) return false;
  if (trimmed === LEGACY_WORDMARK) return true;
  const lower = trimmed.toLowerCase();
  return (
    trimmed.includes(LEGACY_AR_FULL) ||
    trimmed.includes(LEGACY_AR_WORD) ||
    lower.includes(LEGACY_EN_STORE_SUDAN.toLowerCase()) ||
    lower.includes(LEGACY_EN_STORE.toLowerCase()) ||
    lower.includes(LEGACY_EN_SPACED.toLowerCase()) ||
    lower.includes(LEGACY_EN_JOINED)
  );
}

export function sanitizeBrandString(value: string | undefined, target: 'ar' | 'en', fallback?: string): string {
  if (!value || !value.trim()) return fallback ?? '';
  let next = value;
  const arReplacement = 'فيجن بلس';
  const enReplacement = 'Vision Plus';

  next = next.split(LEGACY_AR_FULL).join(arReplacement);
  next = next.split(LEGACY_AR_WORD).join(arReplacement);

  const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  const enPatterns = [LEGACY_EN_STORE_SUDAN, LEGACY_EN_STORE, LEGACY_EN_SPACED, LEGACY_EN_JOINED];
  for (const pat of enPatterns) {
    next = next.replace(new RegExp(escapeRe(pat), 'gi'), target === 'ar' ? arReplacement : enReplacement);
  }
  if (next.trim() === LEGACY_WORDMARK) {
    next = enReplacement;
  }
  return next.trim() || fallback || '';
}

function normalizeAppearanceConfig(raw?: Partial<AppAppearanceConfig>): AppAppearanceConfig {
  const merged: AppAppearanceConfig = {
    ...APP_APPEARANCE_SEED,
    ...(raw || {}),
  };
  const appNameAr = sanitizeBrandString(merged.appNameAr, 'ar', 'فيجن بلس');
  const appNameEn = sanitizeBrandString(merged.appNameEn, 'en', 'Vision Plus');
  const rawWm = (merged.wordmarkText || '').trim();
  const wordmarkText =
    !rawWm || rawWm === LEGACY_WORDMARK || hasLegacyBrandString(rawWm)
      ? 'Vision Plus'
      : rawWm;
  return {
    ...merged,
    appNameAr: hasLegacyBrandString(appNameAr) ? 'فيجن بلس' : appNameAr,
    appNameEn: hasLegacyBrandString(appNameEn) ? 'Vision Plus' : appNameEn,
    wordmarkText,
  };
}

export function normalizeStoreSettings(raw?: Partial<StoreSettings>): StoreSettings {
  const merged: StoreSettings = {
    ...STORE_SETTINGS_SEED,
    ...(raw || {}),
    requireEmailVerification: raw?.requireEmailVerification ?? true,
    splitPaymentEnabled: raw?.splitPaymentEnabled ?? true,
    splitPaymentMode: raw?.splitPaymentMode === 'fixed' ? 'fixed' : 'percent',
    splitPaymentPercent: Math.max(1, Math.min(99, Math.round(raw?.splitPaymentPercent ?? 50))),
    splitPaymentFixedSdg: Math.max(0, Math.round(raw?.splitPaymentFixedSdg ?? 15000)),
    email: raw?.email ?? STORE_SETTINGS_SEED.email,
    contactVisibility: {
      ...STORE_SETTINGS_SEED.contactVisibility,
      ...(raw?.contactVisibility || {}),
    },
    socialLinks: normalizeSocialLinks(raw?.socialLinks),
  };
  return {
    ...merged,
    storeNameAr: sanitizeBrandString(merged.storeNameAr, 'ar', 'فيجن بلس'),
    storeNameEn: sanitizeBrandString(merged.storeNameEn, 'en', 'Vision Plus'),
    bankakAccountName: sanitizeBrandString(
      merged.bankakAccountName,
      'ar',
      STORE_SETTINGS_SEED.bankakAccountName
    ),
    otherBankDetailsAr: sanitizeBrandString(
      merged.otherBankDetailsAr,
      'ar',
      STORE_SETTINGS_SEED.otherBankDetailsAr
    ),
  };
}

function normalizeAppTextsConfig(raw?: Partial<AppTextsConfig>): AppTextsConfig {
  const merged: AppTextsConfig = {
    ...APP_TEXTS_SEED,
    ...(raw || {}),
  };
  return {
    ...merged,
    splashTextAr: sanitizeBrandString(merged.splashTextAr, 'ar', APP_TEXTS_SEED.splashTextAr),
    splashTextEn: sanitizeBrandString(merged.splashTextEn, 'en', APP_TEXTS_SEED.splashTextEn),
    welcomeLineAr: sanitizeBrandString(merged.welcomeLineAr, 'ar', APP_TEXTS_SEED.welcomeLineAr),
    welcomeLineEn: sanitizeBrandString(merged.welcomeLineEn, 'en', APP_TEXTS_SEED.welcomeLineEn),
    announcementTextAr: sanitizeBrandString(merged.announcementTextAr, 'ar', APP_TEXTS_SEED.announcementTextAr),
    announcementTextEn: sanitizeBrandString(merged.announcementTextEn, 'en', APP_TEXTS_SEED.announcementTextEn),
    consultCardDescAr: sanitizeBrandString(merged.consultCardDescAr, 'ar', APP_TEXTS_SEED.consultCardDescAr),
    consultCardDescEn: sanitizeBrandString(merged.consultCardDescEn, 'en', APP_TEXTS_SEED.consultCardDescEn),
    aboutUsAr: sanitizeBrandString(merged.aboutUsAr, 'ar', APP_TEXTS_SEED.aboutUsAr),
    aboutUsEn: sanitizeBrandString(merged.aboutUsEn, 'en', APP_TEXTS_SEED.aboutUsEn),
    privacyPolicyAr: sanitizeBrandString(merged.privacyPolicyAr, 'ar', APP_TEXTS_SEED.privacyPolicyAr),
    privacyPolicyEn: sanitizeBrandString(merged.privacyPolicyEn, 'en', APP_TEXTS_SEED.privacyPolicyEn),
  };
}

function normalizeBrandList(items: Brand[]): Brand[] {
  return items.map((b) =>
    b.id === LEGACY_EN_JOINED
      ? {
          ...b,
          id: 'vision_plus',
          nameAr: sanitizeBrandString(b.nameAr, 'ar', 'فيجن بلس'),
          nameEn: sanitizeBrandString(b.nameEn, 'en', 'Vision Plus'),
        }
      : {
          ...b,
          nameAr: sanitizeBrandString(b.nameAr, 'ar', b.nameAr),
          nameEn: sanitizeBrandString(b.nameEn, 'en', b.nameEn),
        }
  );
}

function normalizeProductList(items: Product[]): Product[] {
  return items.map((p) => (p.brandId === LEGACY_EN_JOINED ? { ...p, brandId: 'vision_plus' } : p));
}

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

export function resolveAdminRouteFromLocation(): AdminRouteMode {
  if (typeof window === 'undefined') return 'store';
  const pathname = window.location.pathname.toLowerCase();
  const hash = window.location.hash.replace(/^#\/?/, '').split('?')[0].toLowerCase();
  if (
    pathname === '/vp-admin/login' ||
    pathname.startsWith('/vp-admin/login/') ||
    hash === 'vp-admin/login'
  ) {
    return 'admin_login';
  }
  if (
    pathname === '/vp-admin' ||
    pathname.startsWith('/vp-admin/') ||
    hash === 'vp-admin' ||
    hash.startsWith('vp-admin/') ||
    hash === 'admin'
  ) {
    return 'admin_panel';
  }
  return 'store';
}

const VALID_ADMIN_MODULES: StaffPermission[] = [
  'dashboard',
  'products',
  'categories',
  'home_builder',
  'banners',
  'content',
  'appearance',
  'settings',
  'orders',
  'coupons',
  'notifications',
  'consults',
  'customers',
  'roles',
];

export function resolveAdminModuleFromLocation(): StaffPermission | null {
  if (typeof window === 'undefined') return null;
  const pathname = window.location.pathname.toLowerCase();
  const hash = window.location.hash.replace(/^#\/?/, '').split('?')[0].toLowerCase();
  let segment = '';
  if (pathname.startsWith('/vp-admin/')) {
    segment = pathname.slice('/vp-admin/'.length).split('/')[0];
  } else if (hash.startsWith('vp-admin/')) {
    segment = hash.slice('vp-admin/'.length).split('/')[0];
  }
  if (segment && segment !== 'login' && (VALID_ADMIN_MODULES as string[]).includes(segment)) {
    return segment as StaffPermission;
  }
  return null;
}

function resolveTabFromHash(): AppTab {
  if (typeof window === 'undefined') return 'home';
  const raw = window.location.hash.replace(/^#\/?/, '').split('?')[0].toLowerCase();
  if (raw === 'categories' || raw === 'catalog') return 'catalog';
  if (raw === 'cart') return 'cart';
  if (raw === 'orders') return 'orders';
  if (raw === 'consult') return 'consult';
  if (raw === 'profile') return 'profile';
  if (raw === 'favorites') return 'favorites';
  if (raw === 'contact') return 'contact';
  return 'home';
}

function getReadBroadcastKey(uid: string): string {
  return `vp_read_broadcasts_${uid}`;
}

function readBroadcastIds(uid: string): Set<string> {
  try {
    const raw = localStorage.getItem(getReadBroadcastKey(uid));
    if (!raw) return new Set();
    const parsed = JSON.parse(raw);
    return new Set(Array.isArray(parsed) ? parsed : []);
  } catch {
    return new Set();
  }
}

function saveBroadcastReadId(uid: string, ids: string[]): void {
  try {
    const existing = readBroadcastIds(uid);
    ids.forEach((id) => existing.add(id));
    localStorage.setItem(getReadBroadcastKey(uid), JSON.stringify(Array.from(existing).slice(-200)));
  } catch {
    // Ignore storage quota issues
  }
}

function hashForTab(tab: AppTab): string {
  return tab === 'catalog' ? '#/categories' : `#/${tab}`;
}

function normalizeLensOptions(raw?: LensOptionConfig[]): LensOptionConfig[] {
  if (!Array.isArray(raw) || raw.length === 0) return LENS_OPTIONS_SEED;
  const byId = new Map<string, LensOptionConfig>();
  raw.forEach((item) => {
    if (item && item.id) byId.set(item.id, item);
  });

  return LENS_OPTIONS_SEED.map((seedItem) => {
    let existing = byId.get(seedItem.id);
    if (!existing && seedItem.id === 'distance') {
      existing = byId.get('single_vision');
    }
    if (!existing && seedItem.id === 'blue_cut') {
      existing = byId.get('blue_light');
    }
    if (!existing) return seedItem;
    return {
      ...seedItem,
      labelAr: existing.labelAr || seedItem.labelAr,
      labelEn: existing.labelEn || seedItem.labelEn,
      extraSdg: typeof existing.extraSdg === 'number' ? existing.extraSdg : seedItem.extraSdg,
      visible: typeof existing.visible === 'boolean' ? existing.visible : seedItem.visible,
      kind: seedItem.kind,
    };
  });
}

function mergeCartItems(existingCart: CartItem[], incomingCart: CartItem[]): CartItem[] {
  const merged = [...existingCart];
  for (const item of incomingCart) {
    const hasCustomSpecs = Boolean(hasCustomLensOrRx(item.prescription) || item.contactLensSelection);
    const matchIdx = !hasCustomSpecs
      ? merged.findIndex(
          (c) =>
            c.productId === item.productId &&
            c.variantId === item.variantId &&
            !hasCustomLensOrRx(c.prescription) &&
            !c.contactLensSelection
        )
      : -1;
    if (matchIdx >= 0) {
      merged[matchIdx] = {
        ...merged[matchIdx],
        quantity: merged[matchIdx].quantity + item.quantity,
      };
    } else {
      merged.push(item);
    }
  }
  return merged;
}

function getInitialState(): StoreState {
  const baseAppearance = APP_APPEARANCE_SEED;
  const initialAdminRoute = resolveAdminRouteFromLocation();
  const initialTab = resolveTabFromHash();
  const initialGuestSession = readGuestSessionFlag();
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const parsed = JSON.parse(raw);
      const baseUser = createEmptyUser();
      return {
        locale: parsed.locale || 'ar',
        theme: parsed.theme || parsed.appearance?.defaultTheme || baseAppearance.defaultTheme,
        activeTab: initialTab,
        tabHistory: [],
        adminRoute: initialAdminRoute,
        catalogCategory: 'all',
        catalogSearch: '',
        selectedProductId: null,
        authReady: false,
        firebaseUser: null,
        guestSession: initialGuestSession,
        authScreenMode: 'none',
        authModal: { open: false, view: 'choice', checkoutNotice: false },
        pendingCheckoutReturn: false,
        user: {
          ...baseUser,
          favoriteProductIds: Array.isArray(parsed.favoriteProductIds)
            ? parsed.favoriteProductIds
            : [],
        },
        directoryUsers: parsed.directoryUsers || CUSTOMERS_AND_STAFF_SEED,
        products: (() => {
          const cached: Product[] = Array.isArray(parsed.products)
            ? normalizeProductList(parsed.products)
            : PRODUCTS_SEED;
          let storedSeedVer = '';
          try {
            storedSeedVer = localStorage.getItem(CATALOG_SEED_VERSION_KEY) || '';
          } catch {
            storedSeedVer = '';
          }
          if (storedSeedVer !== CATALOG_SEED_VERSION) {
            const existingIds = new Set(cached.map((p) => p.id));
            const seedById = new Map(PRODUCTS_SEED.map((p) => [p.id, p]));
            const upgradedExisting = cached.map((p) => {
              const seedMatch = seedById.get(p.id);
              if (!seedMatch) return p;
              // Refresh default catalog photos & stock if matching seed entry
              return {
                ...p,
                images: seedMatch.images,
                variants: seedMatch.variants.length > p.variants.length ? seedMatch.variants : p.variants,
                isFeatured: p.isFeatured || seedMatch.isFeatured,
                isNewArrival: p.isNewArrival || seedMatch.isNewArrival,
              };
            });
            const missingDefaults = PRODUCTS_SEED.filter((p) => !existingIds.has(p.id));
            try {
              localStorage.setItem(CATALOG_SEED_VERSION_KEY, CATALOG_SEED_VERSION);
            } catch {
              // Ignore quota error
            }
            return [...upgradedExisting, ...missingDefaults];
          }
          return cached;
        })(),
        categories: parsed.categories || CATEGORIES_SEED,
        brands: normalizeBrandList(parsed.brands || BRANDS_SEED),
        banners: parsed.banners || BANNERS_SEED,
        coupons: parsed.coupons || COUPONS_SEED,
        cart: Array.isArray(parsed.cart) ? parsed.cart : [],
        orders: [],
        notifications: parsed.notifications || INITIAL_NOTIFICATIONS_SEED,
        consults: [],
        consultTopics: parsed.consultTopics || CONSULT_TOPICS_SEED,
        lensOptions: normalizeLensOptions(parsed.lensOptions),
        homeSections: normalizeHomeSections(parsed.homeSections),
        appTexts: normalizeAppTextsConfig(parsed.appTexts),
        appearance: normalizeAppearanceConfig(parsed.appearance),
        settings: normalizeStoreSettings(parsed.settings),
        toastMessage: null,
        liveOrderAlert: null,
      };
    }
  } catch {
    // Fallback to seed offline cache
  }
  return {
    locale: 'ar',
    theme: baseAppearance.defaultTheme,
    activeTab: initialTab,
    tabHistory: [],
    adminRoute: initialAdminRoute,
    catalogCategory: 'all',
    catalogSearch: '',
    selectedProductId: null,
    authReady: false,
    firebaseUser: null,
    guestSession: initialGuestSession,
    authScreenMode: 'none',
    authModal: { open: false, view: 'choice', checkoutNotice: false },
    pendingCheckoutReturn: false,
    user: createEmptyUser(),
    directoryUsers: CUSTOMERS_AND_STAFF_SEED,
    products: PRODUCTS_SEED,
    categories: CATEGORIES_SEED,
    brands: BRANDS_SEED,
    banners: BANNERS_SEED,
    coupons: COUPONS_SEED,
    cart: [],
    orders: [],
    notifications: INITIAL_NOTIFICATIONS_SEED,
    consults: [],
    consultTopics: CONSULT_TOPICS_SEED,
    lensOptions: LENS_OPTIONS_SEED,
    homeSections: HOME_SECTIONS_SEED,
    appTexts: APP_TEXTS_SEED,
    appearance: baseAppearance,
    settings: STORE_SETTINGS_SEED,
    toastMessage: null,
    liveOrderAlert: null,
  };
}

export const StoreProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [state, setState] = useState<StoreState>(getInitialState);
  const stateRef = useRef(state);
  stateRef.current = state;
  const notifSnapshotUidRef = useRef<string | null>(null);
  const knownNotifIdsRef = useRef<Set<string>>(new Set());
  const enteringGuestRef = useRef(false);
  const adminLoginInProgressRef = useRef(false);

  const showToast = useCallback((msg: string) => {
    setState((prev) => ({ ...prev, toastMessage: msg }));
    window.setTimeout(() => {
      setState((prev) => (prev.toastMessage === msg ? { ...prev, toastMessage: null } : prev));
    }, 3400);
  }, []);

  const t = useCallback(
    (ar: string, en: string) => (state.locale === 'ar' ? ar : en),
    [state.locale]
  );

  // Persist lightweight storefront cache in localStorage
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
    const syncLocation = () => {
      const nextAdminRoute = resolveAdminRouteFromLocation();
      const nextTab = resolveTabFromHash();
      setState((prev) =>
        prev.adminRoute === nextAdminRoute && prev.activeTab === nextTab
          ? prev
          : { ...prev, adminRoute: nextAdminRoute, activeTab: nextTab, selectedProductId: null }
      );
    };
    window.addEventListener('hashchange', syncLocation);
    window.addEventListener('popstate', syncLocation);
    return () => {
      window.removeEventListener('hashchange', syncLocation);
      window.removeEventListener('popstate', syncLocation);
    };
  }, []);

  useEffect(() => {
    if (state.adminRoute !== 'store') return;
    const targetHash = hashForTab(state.activeTab);
    if (window.location.hash !== targetHash && !(state.activeTab === 'home' && !window.location.hash)) {
      window.history.replaceState(null, '', targetHash);
    }
  }, [state.activeTab, state.adminRoute]);

  useEffect(() => {
    const root = document.documentElement;
    root.style.setProperty('--vp-primary', state.appearance.primaryColor || '#11223E');
    root.style.setProperty('--vp-secondary', state.appearance.secondaryColor || '#D9B24C');
    document.title =
      state.appearance.appNameEn && !hasLegacyBrandString(state.appearance.appNameEn)
        ? state.appearance.appNameEn
        : 'Vision Plus';
  }, [state.appearance]);

  useEffect(() => {
    try {
      const persist = {
        locale: state.locale,
        theme: state.theme,
        cart: state.cart,
        favoriteProductIds: state.user.favoriteProductIds,
        products: state.products,
        categories: state.categories,
        brands: state.brands,
        banners: state.banners,
        coupons: state.coupons,
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
    state.cart,
    state.user.favoriteProductIds,
    state.products,
    state.categories,
    state.brands,
    state.banners,
    state.coupons,
    state.consultTopics,
    state.lensOptions,
    state.homeSections,
    state.appTexts,
    state.appearance,
    state.settings,
  ]);

  const syncUserDocFields = useCallback(async (uid: string, patch: Record<string, unknown>) => {
    if (!uid || uid === 'guest_pending') return;
    const path = `users/${uid}`;
    try {
      await updateDoc(
        doc(db, 'users', uid),
        stripUndefined({
          ...patch,
          updatedAt: new Date().toISOString(),
          updatedAtServer: serverTimestamp(),
        })
      );
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, path);
    }
  }, []);

  // Helper to resolve Firebase User -> AppUser document in Firestore
  const ensureUserDocument = useCallback(async (fbUser: User): Promise<AppUser> => {
    const path = `users/${fbUser.uid}`;
    let op = OperationType.GET;

    try {
      let snap;
      try {
        snap = await getDocFromServer(doc(db, 'users', fbUser.uid));
      } catch {
        snap = await getDoc(doc(db, 'users', fbUser.uid));
      }

      if (snap.exists()) {
        const data = snap.data() as Partial<AppUser>;
        const resolvedBlocked = Boolean(data.isBlocked || data.blocked);
        const resolvedRole =
          isOwnerAdminUid(fbUser.uid) && !resolvedBlocked ? 'admin' : (data.role || 'customer');
        const appUser: AppUser = {
          uid: fbUser.uid,
          name:
            data.name ||
            fbUser.displayName ||
            (fbUser.isAnonymous ? 'ضيف فيجن بلس' : 'عميل فيجن بلس'),
          email: fbUser.email || data.email || '',
          phone: data.phone || '',
          role: resolvedRole,
          permissions:
            resolvedRole === 'admin'
              ? ALL_ADMIN_PERMS
              : resolvedRole === 'staff'
              ? ['orders']
              : data.permissions,
          isBlocked: resolvedBlocked,
          blocked: Boolean(data.blocked),
          isAnonymous: fbUser.isAnonymous,
          emailVerified: fbUser.emailVerified,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          favoriteProductIds: Array.isArray(data.favoriteProductIds) ? data.favoriteProductIds : [],
          addresses: Array.isArray(data.addresses) ? data.addresses : [],
          prescriptions: Array.isArray(data.prescriptions) ? data.prescriptions : [],
        };
        return appUser;
      }

      const nowIso = new Date().toISOString();
      const initialDoc = {
        uid: fbUser.uid,
        name: fbUser.displayName || (fbUser.isAnonymous ? 'ضيف فيجن بلس' : 'عميل فيجن بلس'),
        email: fbUser.email || '',
        phone: '',
        role: 'customer' as const,
        isBlocked: false,
        blocked: false,
        isAnonymous: fbUser.isAnonymous,
        emailVerified: fbUser.emailVerified,
        favoriteProductIds: stateRef.current.user.favoriteProductIds || [],
        cart: stateRef.current.cart || [],
        addresses: [],
        prescriptions: [],
        createdAt: nowIso,
        updatedAt: nowIso,
      };
      op = OperationType.CREATE;
      await setDoc(
        doc(db, 'users', fbUser.uid),
        stripUndefined({
          ...initialDoc,
          createdAtServer: serverTimestamp(),
          updatedAtServer: serverTimestamp(),
        })
      );

      return initialDoc;
    } catch (error) {
      handleFirestoreError(error, op, path);
    }
  }, []);

  // Primary Firebase Auth listener
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (fbUser) => {
      if (!fbUser) {
        if (adminLoginInProgressRef.current) {
          return;
        }
        const hasGuestFlag = readGuestSessionFlag();
        setState((prev) => ({
          ...prev,
          authReady: true,
          firebaseUser: null,
          guestSession: hasGuestFlag,
          authScreenMode: hasGuestFlag ? 'none' : 'entry',
          user: {
            ...createEmptyUser(),
            favoriteProductIds: prev.user.favoriteProductIds,
          },
          orders: [],
          consults: [],
        }));
        return;
      }

      if (adminLoginInProgressRef.current) {
        return;
      }

      if (!fbUser.isAnonymous) {
        writeGuestSessionFlag(false);
      } else {
        writeGuestSessionFlag(true);
      }

      try {
        const appUser = await ensureUserDocument(fbUser);
        setState((prev) => ({
          ...prev,
          authReady: true,
          firebaseUser: fbUser,
          guestSession: fbUser.isAnonymous,
          user: appUser,
          authScreenMode:
            prev.authScreenMode === 'verify_email' && !fbUser.isAnonymous && !fbUser.emailVerified
              ? 'verify_email'
              : 'none',
        }));
      } catch {
        setState((prev) => ({
          ...prev,
          authReady: true,
          firebaseUser: fbUser,
          guestSession: fbUser.isAnonymous,
          user: fbUser.isAnonymous
            ? {
                ...createEmptyUser(fbUser.uid),
                favoriteProductIds: prev.user.favoriteProductIds,
              }
            : prev.user,
          authScreenMode: 'none',
        }));
      }
    });

    return () => unsub();
  }, [ensureUserDocument]);

  // Firestore real-time listeners (authenticated users + guest browsing sessions)
  useEffect(() => {
    if (!state.authReady || (!state.firebaseUser && !state.guestSession)) return;
    const fbUser = state.firebaseUser;
    const isBlockedAccount = Boolean(fbUser && (state.user.isBlocked || state.user.blocked));
    const isVerifiedAdmin = Boolean(fbUser && !fbUser.isAnonymous && !isBlockedAccount && state.user.role === 'admin');
    const isVerifiedStaff = Boolean(fbUser && !fbUser.isAnonymous && !isBlockedAccount && state.user.role === 'staff');
    const unsubs: (() => void)[] = [];

    // 1. User document (cart, favorites, profile, role, block status)
    if (fbUser) {
      unsubs.push(
        onSnapshot(
          doc(db, 'users', fbUser.uid),
          (snap) => {
            if (!snap.exists()) return;
            const data = snap.data() as Partial<AppUser> & { cart?: CartItem[] };
            const resolvedBlocked = Boolean(data.isBlocked || data.blocked);
            const resolvedRole =
              isOwnerAdminUid(fbUser.uid) && !resolvedBlocked ? 'admin' : (data.role || 'customer');
            setState((prev) => ({
              ...prev,
              cart: Array.isArray(data.cart) ? data.cart : prev.cart,
              user: {
                ...prev.user,
                uid: fbUser.uid,
                name: data.name || fbUser.displayName || prev.user.name,
                email: fbUser.email || data.email || prev.user.email,
                phone: data.phone ?? prev.user.phone,
                role: resolvedRole,
                permissions:
                  resolvedRole === 'admin'
                    ? ALL_ADMIN_PERMS
                    : resolvedRole === 'staff'
                    ? ['orders']
                    : data.permissions,
                isBlocked: resolvedBlocked,
                blocked: Boolean(data.blocked),
                isAnonymous: fbUser.isAnonymous,
                emailVerified: fbUser.emailVerified,
                favoriteProductIds: Array.isArray(data.favoriteProductIds)
                  ? data.favoriteProductIds
                  : prev.user.favoriteProductIds,
                addresses:
                  prev.user.addresses.length > 0
                    ? prev.user.addresses
                    : Array.isArray(data.addresses)
                    ? data.addresses
                    : prev.user.addresses,
                prescriptions:
                  prev.user.prescriptions.length > 0
                    ? prev.user.prescriptions
                    : Array.isArray(data.prescriptions)
                    ? data.prescriptions
                    : prev.user.prescriptions,
              },
            }));
          },
          (err) => {
            if (!fbUser.isAnonymous) {
              handleFirestoreError(err, OperationType.GET, `users/${fbUser.uid}`);
            }
          }
        )
      );
    }

    // 1b. User subcollections: addresses and prescriptions (for signed-in accounts)
    if (fbUser && !fbUser.isAnonymous) {
      unsubs.push(
        onSnapshot(
          collection(db, 'users', fbUser.uid, 'addresses'),
          (snap) => {
            if (snap.empty) return;
            const list = snap.docs
              .map((d) => d.data() as SavedAddress)
              .sort((a, b) => Number(Boolean(b.isDefault)) - Number(Boolean(a.isDefault)));
            setState((prev) => ({
              ...prev,
              user: { ...prev.user, addresses: list },
            }));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, `users/${fbUser.uid}/addresses`)
        )
      );

      unsubs.push(
        onSnapshot(
          collection(db, 'users', fbUser.uid, 'prescriptions'),
          (snap) => {
            if (snap.empty) return;
            const list = snap.docs
              .map((d) => d.data() as SavedPrescription)
              .sort((a, b) => (b.savedAt || '').localeCompare(a.savedAt || ''));
            setState((prev) => ({
              ...prev,
              user: { ...prev.user, prescriptions: list },
            }));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, `users/${fbUser.uid}/prescriptions`)
        )
      );
    }

    // 2. Store public config documents (individual gets, zero blanket list)
    const configIds = [
      'settings',
      'appearance',
      'texts',
      'homeSections',
      'lensOptions',
      'consultTopics',
    ] as const;

    const migratedConfigs = new Set<string>();

    configIds.forEach((configId) => {
      unsubs.push(
        onSnapshot(
          doc(db, 'store_config', configId),
          (snap) => {
            if (!snap.exists()) return;
            const val = snap.data();

            if (isVerifiedAdmin && !migratedConfigs.has(configId)) {
              if (configId === 'settings') {
                const rawSettings = val as Partial<StoreSettings>;
                if (
                  hasLegacyBrandString(rawSettings.storeNameAr) ||
                  hasLegacyBrandString(rawSettings.storeNameEn) ||
                  hasLegacyBrandString(rawSettings.bankakAccountName) ||
                  hasLegacyBrandString(rawSettings.otherBankDetailsAr)
                ) {
                  migratedConfigs.add(configId);
                  const cleaned = normalizeStoreSettings(rawSettings);
                  void setDoc(doc(db, 'store_config', 'settings'), stripUndefined({ id: 'settings', ...cleaned })).catch(
                    () => undefined
                  );
                }
              } else if (configId === 'appearance') {
                const rawApp = val as Partial<AppAppearanceConfig>;
                if (
                  hasLegacyBrandString(rawApp.appNameAr) ||
                  hasLegacyBrandString(rawApp.appNameEn) ||
                  hasLegacyBrandString(rawApp.wordmarkText)
                ) {
                  migratedConfigs.add(configId);
                  const cleaned = normalizeAppearanceConfig(rawApp);
                  void setDoc(doc(db, 'store_config', 'appearance'), stripUndefined({ id: 'appearance', ...cleaned })).catch(
                    () => undefined
                  );
                }
              } else if (configId === 'texts') {
                const rawTexts = val as Partial<AppTextsConfig>;
                if (
                  hasLegacyBrandString(rawTexts.welcomeLineAr) ||
                  hasLegacyBrandString(rawTexts.welcomeLineEn) ||
                  hasLegacyBrandString(rawTexts.aboutUsAr) ||
                  hasLegacyBrandString(rawTexts.aboutUsEn) ||
                  hasLegacyBrandString(rawTexts.privacyPolicyAr) ||
                  hasLegacyBrandString(rawTexts.privacyPolicyEn)
                ) {
                  migratedConfigs.add(configId);
                  const cleaned = normalizeAppTextsConfig(rawTexts);
                  void setDoc(doc(db, 'store_config', 'texts'), stripUndefined({ id: 'texts', ...cleaned })).catch(
                    () => undefined
                  );
                }
              }
            }

            setState((prev) => {
              const next = { ...prev };
              if (configId === 'settings') {
                next.settings = normalizeStoreSettings({
                  ...prev.settings,
                  ...(val as Partial<StoreSettings>),
                });
              } else if (configId === 'appearance') {
                next.appearance = normalizeAppearanceConfig({
                  ...prev.appearance,
                  ...(val as Partial<AppAppearanceConfig>),
                });
              } else if (configId === 'texts') {
                next.appTexts = normalizeAppTextsConfig({
                  ...prev.appTexts,
                  ...(val as Partial<AppTextsConfig>),
                });
              } else if (configId === 'homeSections' && Array.isArray(val.items)) {
                next.homeSections = normalizeHomeSections(val.items as HomeSectionConfig[]);
              } else if (configId === 'lensOptions' && Array.isArray(val.items)) {
                next.lensOptions = normalizeLensOptions(val.items as LensOptionConfig[]);
              } else if (configId === 'consultTopics' && Array.isArray(val.items)) {
                next.consultTopics = val.items as ConsultTopicConfig[];
              }
              return next;
            });
          },
          (err) => {
            if (fbUser && !fbUser.isAnonymous) {
              handleFirestoreError(err, OperationType.GET, `store_config/${configId}`);
            } else {
              console.warn(`Guest store_config/${configId} read warning:`, err);
            }
          }
        )
      );
    });

    const productsQ = isVerifiedAdmin
      ? collection(db, 'products')
      : query(collection(db, 'products'), where('visible', '==', true));
    let adminAutoSeededProducts = false;
    unsubs.push(
      onSnapshot(
        productsQ,
        (snap) => {
          if (snap.empty) {
            if (isVerifiedAdmin && !adminAutoSeededProducts) {
              adminAutoSeededProducts = true;
              PRODUCTS_SEED.forEach((p) => {
                void setDoc(doc(db, 'products', p.id), stripUndefined(p)).catch(() => undefined);
              });
            }
            return;
          }
          const items = normalizeProductList(snap.docs.map((d) => d.data() as Product));
          setState((prev) => ({ ...prev, products: items }));
        },
        (err) => {
          if (fbUser && !fbUser.isAnonymous) {
            handleFirestoreError(err, OperationType.LIST, 'products');
          } else {
            console.warn('Guest products list read warning:', err);
          }
        }
      )
    );

    const categoriesQ = isVerifiedAdmin
      ? collection(db, 'categories')
      : query(collection(db, 'categories'), where('visible', '==', true));
    unsubs.push(
      onSnapshot(
        categoriesQ,
        (snap) => {
          if (snap.empty) return;
          const items = snap.docs.map((d) => d.data() as Category);
          setState((prev) => ({ ...prev, categories: items }));
        },
        (err) => {
          if (fbUser && !fbUser.isAnonymous) {
            handleFirestoreError(err, OperationType.LIST, 'categories');
          } else {
            console.warn('Guest categories list read warning:', err);
          }
        }
      )
    );

    const brandsQ = isVerifiedAdmin
      ? collection(db, 'brands')
      : query(collection(db, 'brands'), where('visible', '==', true));
    unsubs.push(
      onSnapshot(
        brandsQ,
        (snap) => {
          if (snap.empty) return;
          const items = normalizeBrandList(snap.docs.map((d) => d.data() as Brand));
          setState((prev) => ({ ...prev, brands: items }));
        },
        (err) => {
          if (fbUser && !fbUser.isAnonymous) {
            handleFirestoreError(err, OperationType.LIST, 'brands');
          } else {
            console.warn('Guest brands list read warning:', err);
          }
        }
      )
    );

    const bannersQ = isVerifiedAdmin
      ? collection(db, 'banners')
      : query(collection(db, 'banners'), where('isActive', '==', true));
    unsubs.push(
      onSnapshot(
        bannersQ,
        (snap) => {
          if (snap.empty) return;
          const items = snap.docs.map((d) => d.data() as BannerAd);
          setState((prev) => ({ ...prev, banners: items }));
        },
        (err) => {
          if (fbUser && !fbUser.isAnonymous) {
            handleFirestoreError(err, OperationType.LIST, 'banners');
          } else {
            console.warn('Guest banners list read warning:', err);
          }
        }
      )
    );

    if (fbUser) {
      const couponsQ = isVerifiedAdmin
        ? collection(db, 'coupons')
        : query(collection(db, 'coupons'), where('isActive', '==', true));
      unsubs.push(
        onSnapshot(
          couponsQ,
          (snap) => {
            if (snap.empty) return;
            const items = snap.docs.map((d) => d.data() as Coupon);
            setState((prev) => ({ ...prev, coupons: items }));
          },
          (err) => {
            if (!fbUser.isAnonymous) {
              handleFirestoreError(err, OperationType.LIST, 'coupons');
            }
          }
        )
      );
    }

    // 3. Orders (non-anonymous accounts only; guests cannot use order history)
    if (fbUser && !fbUser.isAnonymous) {
      const ordersQ =
        isVerifiedAdmin || isVerifiedStaff
          ? collection(db, 'orders')
          : query(collection(db, 'orders'), where('customerUid', '==', fbUser.uid));
      unsubs.push(
        onSnapshot(
          ordersQ,
          (snap) => {
            const items = snap.docs
              .map((d) => d.data() as Order)
              .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            setState((prev) => ({ ...prev, orders: items }));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'orders')
        )
      );
    } else {
      setState((prev) => (prev.orders.length > 0 ? { ...prev, orders: [] } : prev));
    }

    // 4. Consultations (scoped to customerUid or all for verified admin)
    if (fbUser) {
      const consultsQ = isVerifiedAdmin
        ? collection(db, 'consults')
        : query(collection(db, 'consults'), where('customerUid', '==', fbUser.uid));
      unsubs.push(
        onSnapshot(
          consultsQ,
          (snap) => {
            const items = snap.docs
              .map((d) => d.data() as ConsultRequest)
              .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));
            setState((prev) => ({ ...prev, consults: items }));
          },
          (err) => {
            if (!fbUser.isAnonymous) {
              handleFirestoreError(err, OperationType.LIST, 'consults');
            }
          }
        )
      );
    }

    // 5. Notifications (broadcast 'all' + customer-targeted for signed-in users, or all for verified admin)
    if (fbUser) {
      const notifQ = isVerifiedAdmin
        ? collection(db, 'notifications')
        : !fbUser.isAnonymous
        ? query(collection(db, 'notifications'), where('customerUid', 'in', ['all', fbUser.uid]))
        : query(collection(db, 'notifications'), where('customerUid', '==', 'all'));
      unsubs.push(
        onSnapshot(
          notifQ,
          (snap) => {
            const readSet = readBroadcastIds(fbUser.uid);
            const remote = snap.docs
              .map((d) => {
                const data = d.data() as AppNotification;
                if (data.customerUid === 'all' && readSet.has(data.id)) {
                  return { ...data, isRead: true };
                }
                return data;
              })
              .sort((a, b) => (b.createdAt || '').localeCompare(a.createdAt || ''));

            const isInitialForUser = notifSnapshotUidRef.current !== fbUser.uid;
            let newlyArrivedOrderAlert: AppNotification | null = null;
            if (isInitialForUser) {
              notifSnapshotUidRef.current = fbUser.uid;
              knownNotifIdsRef.current = new Set(remote.map((n) => n.id));
            } else {
              const incomingUnread = remote.filter(
                (n) => !n.isRead && !knownNotifIdsRef.current.has(n.id)
              );
              remote.forEach((n) => knownNotifIdsRef.current.add(n.id));
              newlyArrivedOrderAlert =
                incomingUnread.find((n) => n.deepLinkType === 'order') || incomingUnread[0] || null;
            }

            if (remote.length > 0 || !fbUser.isAnonymous) {
              setState((prev) => ({
                ...prev,
                notifications: remote,
                liveOrderAlert:
                  newlyArrivedOrderAlert && prev.adminRoute === 'store'
                    ? newlyArrivedOrderAlert
                    : prev.liveOrderAlert,
              }));
            }

            if (newlyArrivedOrderAlert && stateRef.current.adminRoute === 'store') {
              const title =
                stateRef.current.locale === 'ar'
                  ? newlyArrivedOrderAlert.titleAr
                  : newlyArrivedOrderAlert.titleEn;
              showToast(title);
            }
          },
          (err) => {
            if (!fbUser.isAnonymous) {
              handleFirestoreError(err, OperationType.LIST, 'notifications');
            }
          }
        )
      );
    }

    // 6. Admin-only customers & staff directory
    if (isVerifiedAdmin) {
      unsubs.push(
        onSnapshot(
          collection(db, 'users'),
          (snap) => {
            if (snap.empty) return;
            const list = snap.docs.map((d) => d.data() as AppUser);
            setState((prev) => ({ ...prev, directoryUsers: list }));
          },
          (err) => handleFirestoreError(err, OperationType.LIST, 'users')
        )
      );
    }

    return () => {
      unsubs.forEach((fn) => fn());
    };
  }, [
    state.authReady,
    state.firebaseUser,
    state.guestSession,
    state.user.role,
    state.user.isBlocked,
    state.user.blocked,
    showToast,
  ]);

  // Auth Methods
  const continueAsGuest = useCallback(async () => {
    enteringGuestRef.current = true;
    writeGuestSessionFlag(true);
    try {
      const current = auth.currentUser;
      if (current?.isAnonymous) {
        try {
          await ensureUserDocument(current);
        } catch {
          // Local guest session still works seamlessly if Firestore user creation fails
        }
        setState((prev) => ({
          ...prev,
          guestSession: true,
          activeTab: 'home',
          authScreenMode: 'none',
          authModal: { open: false, view: 'choice', checkoutNotice: false },
        }));
        showToast(t('أنت تتصفح الآن كضيف', 'You are browsing as Guest'));
        return;
      }

      if (current && !current.isAnonymous) {
        await signOut(auth).catch(() => undefined);
        setState((prev) => ({
          ...prev,
          cart: [],
          orders: [],
          consults: [],
          directoryUsers: [],
          pendingCheckoutReturn: false,
          adminRoute: 'store',
        }));
      }

      try {
        const cred = await signInAnonymously(auth);
        try {
          await ensureUserDocument(cred.user);
        } catch {
          // Keep browsing cleanly with guest profile even if Firestore write fails
        }
        setState((prev) => ({
          ...prev,
          firebaseUser: cred.user,
          guestSession: true,
          activeTab: 'home',
          authScreenMode: 'none',
          authModal: { open: false, view: 'choice', checkoutNotice: false },
        }));
        showToast(t('أهلاً بك! تتصفح الآن كضيف', 'Welcome! Browsing as Guest'));
      } catch {
        // Fallback: Anonymous Auth may be disabled in Firebase Console (auth/admin-restricted-operation)
        // Enter local guest session so visitors can browse products, cart, and favorites smoothly.
        setState((prev) => ({
          ...prev,
          firebaseUser: null,
          guestSession: true,
          user: {
            ...createEmptyUser(),
            favoriteProductIds: prev.user.favoriteProductIds,
          },
          activeTab: 'home',
          authScreenMode: 'none',
          authModal: { open: false, view: 'choice', checkoutNotice: false },
        }));
        showToast(t('أهلاً بك! تتصفح الآن كضيف', 'Welcome! Browsing as Guest'));
      }
    } finally {
      enteringGuestRef.current = false;
    }
  }, [ensureUserDocument, showToast, t]);

  const registerWithEmail = useCallback(
    async ({ name, email, password, phone }: RegisterPayload) => {
      const current = auth.currentUser;
      const guestCart = [...stateRef.current.cart];
      const guestFavs = [...stateRef.current.user.favoriteProductIds];
      const cleanEmail = email.trim();
      const cleanName = name.trim();
      const cleanPhone = (phone || '').trim();

      try {
        let userCredUser: User;

        if (current?.isAnonymous) {
          // Link anonymous guest account to Email/Password so cart & favorites stay on the same UID
          const credential = EmailAuthProvider.credential(cleanEmail, password);
          const linked = await linkWithCredential(current, credential);
          userCredUser = linked.user;
        } else {
          const created = await createUserWithEmailAndPassword(auth, cleanEmail, password);
          userCredUser = created.user;
        }

        await firebaseUpdateProfile(userCredUser, { displayName: cleanName });
        // Force-refresh ID token so Firestore sees non-anonymous provider immediately after linkWithCredential
        await userCredUser.getIdToken(true);
        await sendEmailVerification(userCredUser);

        const nowIso = new Date().toISOString();
        const existingSnap = await getDoc(doc(db, 'users', userCredUser.uid));
        const userPayload = {
          uid: userCredUser.uid,
          name: cleanName,
          email: cleanEmail,
          phone: cleanPhone,
          role: 'customer' as const,
          isBlocked: false,
          isAnonymous: false,
          emailVerified: false,
          favoriteProductIds: guestFavs,
          cart: guestCart,
          addresses: stateRef.current.user.addresses || [],
          prescriptions: stateRef.current.user.prescriptions || [],
          createdAt: stateRef.current.user.createdAt || nowIso,
          updatedAt: nowIso,
        };

        if (existingSnap.exists()) {
          await updateDoc(
            doc(db, 'users', userCredUser.uid),
            stripUndefined({
              name: cleanName,
              email: cleanEmail,
              phone: cleanPhone,
              isAnonymous: false,
              emailVerified: false,
              favoriteProductIds: guestFavs,
              cart: guestCart,
              updatedAt: nowIso,
              updatedAtServer: serverTimestamp(),
            })
          );
        } else {
          await setDoc(
            doc(db, 'users', userCredUser.uid),
            stripUndefined({
              ...userPayload,
              createdAtServer: serverTimestamp(),
              updatedAtServer: serverTimestamp(),
            })
          );
        }

        writeGuestSessionFlag(false);
        setState((prev) => ({
          ...prev,
          firebaseUser: userCredUser,
          guestSession: false,
          user: { ...prev.user, ...userPayload },
          cart: guestCart,
          pendingCheckoutReturn:
            prev.pendingCheckoutReturn || prev.activeTab === 'cart' || guestCart.length > 0,
          authModal: { open: false, view: 'choice', checkoutNotice: false },
          authScreenMode: 'verify_email',
        }));
        showToast(t('تم إنشاء الحساب وإرسال رابط التحقق إلى بريدك', 'Account created! Verification email sent'));
      } catch (error) {
        const code = getFirebaseAuthErrorCode(error);
        if (code === 'auth/credential-already-in-use' || code === 'auth/email-already-in-use') {
          throw new Error(mapFirebaseAuthError(error, stateRef.current.locale));
        }
        throw new Error(mapFirebaseAuthError(error, stateRef.current.locale));
      }
    },
    [showToast, t]
  );

  const loginWithEmail = useCallback(
    async (email: string, password: string) => {
      const wasGuest = Boolean(!auth.currentUser || auth.currentUser.isAnonymous);
      const guestCart = wasGuest ? [...stateRef.current.cart] : [];
      const guestFavs = wasGuest ? [...stateRef.current.user.favoriteProductIds] : [];

      try {
        const cred = await signInWithEmailAndPassword(auth, email.trim(), password);
        const signedUser = cred.user;
        const userSnap = await getDoc(doc(db, 'users', signedUser.uid));
        const existingData = userSnap.exists()
          ? (userSnap.data() as Partial<AppUser> & { cart?: CartItem[] })
          : {};

        const accountCart = Array.isArray(existingData.cart) ? existingData.cart : [];
        const mergedCart = guestCart.length > 0 ? mergeCartItems(accountCart, guestCart) : accountCart;

        const accountFavs = Array.isArray(existingData.favoriteProductIds)
          ? existingData.favoriteProductIds
          : [];
        const mergedFavs = Array.from(new Set([...accountFavs, ...guestFavs]));

        const resolvedRole = existingData.role || ('customer' as const);
        const resolvedBlocked = Boolean(existingData.isBlocked || existingData.blocked);

        const nowIso = new Date().toISOString();
        const syncedUserDoc = {
          uid: signedUser.uid,
          name: existingData.name || signedUser.displayName || 'عميل فيجن بلس',
          email: signedUser.email || existingData.email || email.trim(),
          phone: existingData.phone || '',
          role: resolvedRole,
          isBlocked: resolvedBlocked,
          blocked: Boolean(existingData.blocked),
          isAnonymous: false,
          emailVerified: signedUser.emailVerified,
          favoriteProductIds: mergedFavs,
          cart: mergedCart,
          addresses: Array.isArray(existingData.addresses) ? existingData.addresses : [],
          prescriptions: Array.isArray(existingData.prescriptions) ? existingData.prescriptions : [],
          createdAt: existingData.createdAt || nowIso,
          updatedAt: nowIso,
        };

        if (userSnap.exists()) {
          await updateDoc(
            doc(db, 'users', signedUser.uid),
            stripUndefined({
              email: syncedUserDoc.email,
              isAnonymous: false,
              emailVerified: signedUser.emailVerified,
              favoriteProductIds: mergedFavs,
              cart: mergedCart,
              updatedAt: nowIso,
              updatedAtServer: serverTimestamp(),
            })
          );
        } else {
          await setDoc(
            doc(db, 'users', signedUser.uid),
            stripUndefined({
              ...syncedUserDoc,
              role: 'customer',
              isBlocked: false,
              blocked: false,
              createdAtServer: serverTimestamp(),
              updatedAtServer: serverTimestamp(),
            })
          );
        }

        writeGuestSessionFlag(false);
        setState((prev) => {
          const goToCheckout = prev.pendingCheckoutReturn || prev.activeTab === 'cart';
          return {
            ...prev,
            firebaseUser: signedUser,
            guestSession: false,
            user: {
              ...syncedUserDoc,
              permissions:
                resolvedRole === 'admin'
                  ? ALL_ADMIN_PERMS
                  : resolvedRole === 'staff'
                  ? ['orders']
                  : existingData.permissions,
            },
            cart: mergedCart,
            authModal: { open: false, view: 'choice', checkoutNotice: false },
            authScreenMode: 'none',
            activeTab: goToCheckout
              ? 'cart'
              : prev.activeTab === 'orders' || prev.activeTab === 'profile'
              ? prev.activeTab
              : 'home',
            pendingCheckoutReturn: goToCheckout ? !signedUser.emailVerified : false,
          };
        });

        showToast(
          guestCart.length > 0
            ? t('تم تسجيل الدخول ودمج سلة المشتريات بنجاح', 'Signed in & cart merged')
            : t('تم تسجيل الدخول بنجاح', 'Signed in successfully')
        );
      } catch (error) {
        throw new Error(mapFirebaseAuthError(error, stateRef.current.locale));
      }
    },
    [showToast, t]
  );

  const sendPasswordReset = useCallback(
    async (email: string) => {
      const cleanEmail = email.trim();
      if (!cleanEmail || !cleanEmail.includes('@')) {
        throw new Error(
          stateRef.current.locale === 'ar'
            ? 'يرجى إدخال بريد إلكتروني صحيح.'
            : 'Please enter a valid email address.'
        );
      }
      try {
        auth.languageCode = stateRef.current.locale;
        await sendPasswordResetEmail(auth, cleanEmail);
        showToast(
          t(
            'تم إرسال رابط استعادة كلمة المرور إلى بريدك الإلكتروني',
            'Password reset link sent to your email'
          )
        );
      } catch (error) {
        throw new Error(mapFirebaseAuthError(error, stateRef.current.locale));
      }
    },
    [showToast, t]
  );

  const loginAdminWithEmail = useCallback(
    async (email: string, password: string) => {
      const cleanEmail = email.trim().toLowerCase();

      // Step 4 (pre-check): Read failed attempts — errors are logged and never block a valid login
      const attemptStatus = await getAdminAttemptStatusByEmail(cleanEmail);
      if (attemptStatus.isLocked) {
        throw new AdminLoginError(
          'تم قفل تسجيل الدخول مؤقتاً لمدة 15 دقيقة بسبب تكرار المحاولات الخاطئة',
          attemptStatus,
          `Step 4 (adminLoginAttempts): locked until ${new Date(attemptStatus.lockedUntilMs || Date.now()).toISOString()}`
        );
      }

      adminLoginInProgressRef.current = true;
      try {
        // Step 1: Firebase Auth sign-in
        let signedUser: User;
        try {
          const cred = await signInWithEmailAndPassword(auth, cleanEmail, password);
          signedUser = cred.user;
        } catch (error) {
          const code =
            getFirebaseAuthErrorCode(error) ||
            (error instanceof Error ? error.message : 'unknown');
          console.error('[AdminLogin Step 1: signInWithEmailAndPassword]', code, error);

          if (code === 'auth/too-many-requests') {
            throw new AdminLoginError(
              'تم إرسال طلبات كثيرة مؤقتاً. يرجى الانتظار قليلاً ثم المحاولة مرة أخرى.',
              attemptStatus,
              `Step 1 (signInWithEmailAndPassword): ${code}`
            );
          }
          if (code === 'auth/network-request-failed') {
            throw new AdminLoginError(
              'تعذر الاتصال بالشبكة. تحقق من اتصال الإنترنت وحاول مجدداً.',
              attemptStatus,
              `Step 1 (signInWithEmailAndPassword): ${code}`
            );
          }

          const shouldCountAttempt =
            code === 'auth/invalid-credential' ||
            code === 'auth/wrong-password' ||
            code === 'auth/user-not-found' ||
            code === 'auth/invalid-email';
          const nextStatus = shouldCountAttempt
            ? await recordAdminFailedAttempt(cleanEmail)
            : attemptStatus;

          throw new AdminLoginError(
            'بيانات الدخول غير صحيحة',
            nextStatus,
            `Step 1 (signInWithEmailAndPassword): ${code}`
          );
        }

        // Step 2: Fresh Firestore users/{uid} lookup (never cached, never auto-creates admin doc)
        let userSnap;
        try {
          try {
            userSnap = await getDocFromServer(doc(db, 'users', signedUser.uid));
          } catch (serverErr) {
            const serverCode =
              (serverErr as { code?: string })?.code ||
              getFirebaseAuthErrorCode(serverErr) ||
              '';
            if (serverCode === 'unavailable' || serverCode === 'failed-precondition') {
              userSnap = await getDoc(doc(db, 'users', signedUser.uid));
            } else {
              throw serverErr;
            }
          }
        } catch (err) {
          const code =
            (err as { code?: string })?.code ||
            getFirebaseAuthErrorCode(err) ||
            'unknown';
          console.error(
            `[AdminLogin Step 2: getDoc users/${signedUser.uid}]`,
            code,
            err
          );
          await signOut(auth).catch(() => undefined);

          // Do not count permission-denied or network failures as a failed login attempt
          const isNetwork =
            code === 'unavailable' ||
            code === 'failed-precondition' ||
            code === 'auth/network-request-failed';
          throw new AdminLoginError(
            isNetwork
              ? 'تعذر الاتصال بالشبكة. تحقق من اتصال الإنترنت وحاول مجدداً.'
              : 'بيانات الدخول غير صحيحة',
            attemptStatus,
            `Step 2 (getDoc users/${signedUser.uid}): ${code}`
          );
        }

        if (!userSnap.exists()) {
          console.error(
            `[AdminLogin Step 2: getDoc users/${signedUser.uid}] document missing`,
            `users document missing for uid ${signedUser.uid}`
          );
          await signOut(auth).catch(() => undefined);
          throw new AdminLoginError(
            'بيانات الدخول غير صحيحة',
            attemptStatus,
            `Step 2 (getDoc users/${signedUser.uid}): document missing`
          );
        }

        // Step 3: Role & block verification (recognizes owner UID safety net matching firestore.rules isAdmin())
        const data = userSnap.data() as Partial<AppUser>;
        const blocked = Boolean(data.isBlocked || data.blocked);
        const isSafetyNetOwner = isOwnerAdminUid(signedUser.uid);
        const role = isSafetyNetOwner && !blocked ? 'admin' : data.role;

        if ((role !== 'admin' && role !== 'staff') || blocked) {
          console.error('[AdminLogin Step 3: role check]', {
            uid: signedUser.uid,
            role: role ?? null,
            blocked,
          });
          await signOut(auth).catch(() => undefined);
          const nextStatus = await recordAdminFailedAttempt(cleanEmail);
          throw new AdminLoginError(
            'بيانات الدخول غير صحيحة',
            nextStatus,
            `Step 3 (role check): role=${String(role ?? 'none')}${blocked ? ', blocked=true' : ''}`
          );
        }

        // Sync existing owner doc role to 'admin' in Firestore if it was previously created as 'customer' on storefront
        if (isSafetyNetOwner && !blocked && data.role !== 'admin') {
          try {
            await updateDoc(
              doc(db, 'users', signedUser.uid),
              stripUndefined({
                role: 'admin',
                permissions: ALL_ADMIN_PERMS,
                updatedAt: new Date().toISOString(),
                updatedAtServer: serverTimestamp(),
              })
            );
          } catch (syncErr) {
            console.error('[AdminLogin Step 3: sync owner role]', syncErr);
          }
        }

        console.info('[AdminLogin Step 3: role check]', {
          uid: signedUser.uid,
          role,
          blocked,
        });

        // Step 4 (reset): Reset attempts counter on successful login (non-blocking)
        await clearAdminAttempts(cleanEmail);

        const resolvedUser: AppUser = {
          uid: signedUser.uid,
          name: data.name || signedUser.displayName || 'مشرف فيجن بلس',
          email: signedUser.email || data.email || cleanEmail,
          phone: data.phone || '',
          role,
          permissions: role === 'admin' ? ALL_ADMIN_PERMS : ['orders'],
          isBlocked: false,
          blocked: false,
          isAnonymous: false,
          emailVerified: signedUser.emailVerified,
          createdAt: data.createdAt || new Date().toISOString(),
          updatedAt: new Date().toISOString(),
          favoriteProductIds: Array.isArray(data.favoriteProductIds) ? data.favoriteProductIds : [],
          addresses: Array.isArray(data.addresses) ? data.addresses : [],
          prescriptions: Array.isArray(data.prescriptions) ? data.prescriptions : [],
        };

        const targetUrl = role === 'staff' ? '/vp-admin/orders' : '/vp-admin';
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', targetUrl);
        }

        writeGuestSessionFlag(false);
        setState((prev) => ({
          ...prev,
          authReady: true,
          firebaseUser: signedUser,
          guestSession: false,
          user: resolvedUser,
          authScreenMode: 'none',
          authModal: { open: false, view: 'choice', checkoutNotice: false },
          adminRoute: 'admin_panel',
          activeTab: 'home',
        }));

        showToast(t('مرحباً بك في لوحة التحكم', 'Welcome to Admin Panel'));
      } finally {
        adminLoginInProgressRef.current = false;
      }
    },
    [showToast, t]
  );

  const refreshEmailVerification = useCallback(
    async (silent = false): Promise<boolean> => {
      const current = auth.currentUser;
      if (!current) return false;
      await current.reload();
      if (current.emailVerified) {
        await current.getIdToken(true);
        await syncUserDocFields(current.uid, {
          emailVerified: true,
          email: current.email || stateRef.current.user.email,
        });
        setState((prev) => {
          const returnToCart = prev.pendingCheckoutReturn || prev.cart.length > 0;
          return {
            ...prev,
            firebaseUser: auth.currentUser,
            user: {
              ...prev.user,
              emailVerified: true,
              email: current.email || prev.user.email,
            },
            authScreenMode: 'none',
            authModal: { open: false, view: 'choice', checkoutNotice: false },
            pendingCheckoutReturn: false,
            activeTab: returnToCart ? 'cart' : prev.activeTab,
          };
        });
        if (!silent) {
          showToast(t('تم تأكيد بريدك الإلكتروني بنجاح!', 'Email verified successfully!'));
        }
        return true;
      }
      return false;
    },
    [showToast, syncUserDocFields, t]
  );

  const resendVerificationEmail = useCallback(async () => {
    const current = auth.currentUser;
    if (!current) return;
    try {
      await sendEmailVerification(current);
      showToast(t('تم إرسال رابط التحقق إلى بريدك', 'Verification email sent'));
    } catch (error) {
      throw new Error(mapFirebaseAuthError(error, stateRef.current.locale));
    }
  }, [showToast, t]);

  const changeVerificationEmail = useCallback(
    async (newEmail: string, currentPassword?: string): Promise<{ requiresPassword?: boolean }> => {
      const current = auth.currentUser;
      if (!current) return {};
      try {
        if (currentPassword && current.email) {
          const cred = EmailAuthProvider.credential(current.email, currentPassword);
          await reauthenticateWithCredential(current, cred);
        }
        await verifyBeforeUpdateEmail(current, newEmail.trim());
        await syncUserDocFields(current.uid, { email: newEmail.trim(), emailVerified: false });
        setState((prev) => ({
          ...prev,
          user: { ...prev.user, email: newEmail.trim(), emailVerified: false },
        }));
        return {};
      } catch (error) {
        const code = getFirebaseAuthErrorCode(error);
        if (code === 'auth/requires-recent-login') {
          return { requiresPassword: true };
        }
        throw new Error(mapFirebaseAuthError(error, stateRef.current.locale));
      }
    },
    [syncUserDocFields]
  );

  const logout = useCallback(async () => {
    enteringGuestRef.current = false;
    writeGuestSessionFlag(false);
    await signOut(auth).catch(() => undefined);
    if (typeof window !== 'undefined' && stateRef.current.adminRoute !== 'store') {
      window.history.replaceState(null, '', '/#/home');
    }
    setState((prev) => ({
      ...prev,
      firebaseUser: null,
      guestSession: false,
      user: createEmptyUser(),
      cart: [],
      orders: [],
      consults: [],
      directoryUsers: [],
      authScreenMode: 'entry',
      authModal: { open: false, view: 'choice', checkoutNotice: false },
      pendingCheckoutReturn: false,
      adminRoute: 'store',
      activeTab: 'home',
      tabHistory: [],
    }));
    showToast(t('تم تسجيل الخروج', 'Signed out'));
  }, [showToast, t]);

  const navigateToAdminPanel = useCallback((module?: StaffPermission) => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    const targetUrl = module && module !== 'dashboard' ? `/vp-admin/${module}` : '/vp-admin';
    if (typeof window !== 'undefined') {
      window.history.pushState(null, '', targetUrl);
    }
    setState((prev) => ({
      ...prev,
      adminRoute: 'admin_panel',
      activeTab: 'home',
      selectedProductId: null,
    }));
  }, []);

  const navigateToHome = useCallback(() => {
    window.scrollTo({ top: 0, behavior: 'smooth' });
    if (typeof window !== 'undefined') {
      window.history.replaceState(null, '', '/#/home');
    }
    setState((prev) => ({
      ...prev,
      adminRoute: 'store',
      activeTab: 'home',
      tabHistory: [],
      selectedProductId: null,
    }));
  }, []);

  const isGuest = !state.firebaseUser || state.firebaseUser.isAnonymous;
  const isEmailVerified = Boolean(state.firebaseUser && !state.firebaseUser.isAnonymous && state.firebaseUser.emailVerified);

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
    if (state.user.isBlocked || state.user.blocked) return false;
    if (state.user.role === 'admin') return true;
    if (state.user.role === 'staff') {
      return perm === 'orders';
    }
    return false;
  };

  const writeConfigDoc = async (configId: string, data: Record<string, unknown>) => {
    try {
      await setDoc(doc(db, 'store_config', configId), stripUndefined({ id: configId, ...data }));
    } catch (error) {
      handleFirestoreError(error, OperationType.WRITE, `store_config/${configId}`);
    }
  };

  const value: StoreContextValue = {
    ...state,
    t,
    isGuest,
    isEmailVerified,
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
      if (stateRef.current.adminRoute !== 'store' && typeof window !== 'undefined') {
        window.history.replaceState(null, '', `/${hashForTab(activeTab)}`);
      }
      setState((prev) => {
        const nextHistory =
          activeTab === 'home'
            ? []
            : prev.activeTab !== activeTab &&
              prev.tabHistory[prev.tabHistory.length - 1] !== prev.activeTab
            ? [...prev.tabHistory.slice(-11), prev.activeTab]
            : prev.tabHistory;
        return {
          ...prev,
          adminRoute: 'store',
          activeTab,
          tabHistory: nextHistory,
          selectedProductId: null,
        };
      });
    },
    goBack: () => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setState((prev) => {
        if (prev.selectedProductId) {
          return { ...prev, selectedProductId: null };
        }
        const hist = [...prev.tabHistory];
        let target: AppTab = 'home';
        while (hist.length > 0) {
          const candidate = hist.pop()!;
          if (candidate !== prev.activeTab) {
            target = candidate;
            break;
          }
        }
        if (typeof window !== 'undefined') {
          window.history.replaceState(null, '', `/${hashForTab(target)}`);
        }
        return {
          ...prev,
          adminRoute: 'store',
          activeTab: target,
          tabHistory: target === 'home' ? [] : hist,
          selectedProductId: null,
        };
      });
    },
    navigateToAdminPanel,
    navigateToHome,
    openCatalog: (category = 'all', search = '') => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      if (stateRef.current.adminRoute !== 'store' && typeof window !== 'undefined') {
        window.history.replaceState(null, '', '/#/categories');
      }
      setState((prev) => {
        const nextHistory =
          prev.activeTab !== 'catalog' &&
          prev.tabHistory[prev.tabHistory.length - 1] !== prev.activeTab
            ? [...prev.tabHistory.slice(-11), prev.activeTab]
            : prev.tabHistory;
        return {
          ...prev,
          adminRoute: 'store',
          activeTab: 'catalog',
          tabHistory: nextHistory,
          catalogCategory: category,
          catalogSearch: search,
          selectedProductId: null,
        };
      });
    },
    setCatalogSearch: (catalogSearch) => setState((prev) => ({ ...prev, catalogSearch })),
    openProduct: (selectedProductId) => setState((prev) => ({ ...prev, selectedProductId })),
    openAuthEntry: () => setState((prev) => ({ ...prev, authScreenMode: 'entry' })),
    openVerifyEmailScreen: () => setState((prev) => ({ ...prev, authScreenMode: 'verify_email' })),
    closeVerifyEmailScreen: () =>
      setState((prev) => ({
        ...prev,
        authScreenMode: 'none',
        activeTab: prev.pendingCheckoutReturn || prev.cart.length > 0 ? 'cart' : prev.activeTab,
      })),
    openAuthModal: (view = 'choice', checkoutNotice = false) =>
      setState((prev) => ({
        ...prev,
        pendingCheckoutReturn:
          checkoutNotice || prev.activeTab === 'cart' ? true : prev.pendingCheckoutReturn,
        authModal: { open: true, view, checkoutNotice },
      })),
    closeAuthModal: () =>
      setState((prev) => ({
        ...prev,
        authModal: { ...prev.authModal, open: false },
      })),
    goToAccountSignIn: (fromCheckout = false) => {
      window.scrollTo({ top: 0, behavior: 'smooth' });
      setState((prev) => {
        const nextHistory =
          prev.activeTab !== 'profile' &&
          prev.tabHistory[prev.tabHistory.length - 1] !== prev.activeTab
            ? [...prev.tabHistory.slice(-11), prev.activeTab]
            : prev.tabHistory;
        return {
          ...prev,
          adminRoute: 'store',
          activeTab: 'profile',
          tabHistory: nextHistory,
          selectedProductId: null,
          pendingCheckoutReturn:
            fromCheckout || prev.activeTab === 'cart' ? true : prev.pendingCheckoutReturn,
        };
      });
      if (fromCheckout) {
        showToast(
          t(
            'يرجى تسجيل الدخول من صفحة حسابي لإتمام الطلب',
            'Please sign in from My Account to complete your order'
          )
        );
      }
    },
    continueAsGuest,
    loginWithEmail,
    loginAdminWithEmail,
    registerWithEmail,
    sendPasswordReset,
    refreshEmailVerification,
    resendVerificationEmail,
    changeVerificationEmail,
    logout,
    updateProfile: (name, phone, email) => {
      const current = auth.currentUser;
      if (!current || current.isAnonymous) {
        showToast(t('سجّل دخولك لاستخدام هذه الميزة', 'Sign in to use this feature'));
        return;
      }
      setState((prev) => ({ ...prev, user: { ...prev.user, name, phone, email } }));
      void syncUserDocFields(current.uid, { name, phone, email });
      showToast(t('تم تحديث بيانات الحساب', 'Profile updated'));
    },
    toggleFavorite: (productId) => {
      const exists = state.user.favoriteProductIds.includes(productId);
      const favoriteProductIds = exists
        ? state.user.favoriteProductIds.filter((id) => id !== productId)
        : [...state.user.favoriteProductIds, productId];
      setState((prev) => ({
        ...prev,
        user: { ...prev.user, favoriteProductIds },
      }));
      if (auth.currentUser) {
        void syncUserDocFields(auth.currentUser.uid, { favoriteProductIds });
      }
    },
    addReview: (productId, rating, comment) => {
      let updatedProduct: Product | undefined;
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
          const avg = approved.reduce((s, r) => s + r.rating, 0) / Math.max(1, approved.length);
          updatedProduct = { ...p, reviews: nextReviews, rating: Number(avg.toFixed(1)) };
          return updatedProduct;
        });
        return { ...prev, products };
      });
      if (updatedProduct && state.user.role === 'admin') {
        void setDoc(doc(db, 'products', productId), stripUndefined(updatedProduct)).catch((err) =>
          handleFirestoreError(err, OperationType.WRITE, `products/${productId}`)
        );
      }
      showToast(t('شكراً لك، تم إضافة تقييمك', 'Review submitted'));
    },
    moderateReview: (productId, reviewId, action) => {
      let updatedProduct: Product | undefined;
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
          updatedProduct = { ...p, reviews: nextReviews, rating: Number(avg.toFixed(1)) };
          return updatedProduct;
        }),
      }));
      if (updatedProduct) {
        void setDoc(doc(db, 'products', productId), stripUndefined(updatedProduct)).catch((err) =>
          handleFirestoreError(err, OperationType.WRITE, `products/${productId}`)
        );
      }
      showToast(t('تم تحديث حالة التقييم', 'Review moderation saved'));
    },
    addToCart: (item) => {
      const prevCart = stateRef.current.cart;
      const hasCustomSpecs = Boolean(
        hasCustomLensOrRx(item.prescription) || item.contactLensSelection
      );
      const existingIndex = !hasCustomSpecs
        ? prevCart.findIndex(
            (c) =>
              c.productId === item.productId &&
              c.variantId === item.variantId &&
              !hasCustomLensOrRx(c.prescription) &&
              !c.contactLensSelection
          )
        : -1;
      const nextCart =
        existingIndex >= 0
          ? prevCart.map((c, idx) =>
              idx === existingIndex ? { ...c, quantity: c.quantity + item.quantity } : c
            )
          : [
              ...prevCart,
              stripUndefined({
                ...item,
                id: `ci_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
              }),
            ];
      setState((prev) => ({ ...prev, cart: nextCart }));
      if (auth.currentUser) {
        void syncUserDocFields(auth.currentUser.uid, { cart: nextCart });
      }
      showToast(t('تمت الإضافة إلى السلة', 'Added to cart'));
    },
    updateCartQty: (cartItemId, delta) => {
      const nextCart = stateRef.current.cart
        .map((c) => (c.id === cartItemId ? { ...c, quantity: c.quantity + delta } : c))
        .filter((c) => c.quantity > 0);
      setState((prev) => ({ ...prev, cart: nextCart }));
      if (auth.currentUser) {
        void syncUserDocFields(auth.currentUser.uid, { cart: nextCart });
      }
    },
    updateCartItemPrescription: (cartItemId, prescription) => {
      const hasRxOrLens = hasCustomLensOrRx(prescription);
      const nextCart = stateRef.current.cart.map((c) => {
        if (c.id !== cartItemId) return c;
        if (!hasRxOrLens) {
          const rest = { ...c };
          delete rest.prescription;
          return rest;
        }
        return stripUndefined({ ...c, prescription });
      });
      setState((prev) => ({ ...prev, cart: nextCart }));
      if (auth.currentUser) {
        void syncUserDocFields(auth.currentUser.uid, { cart: nextCart });
      }
      showToast(
        hasRxOrLens
          ? t('تم تحديث خيارات العدسات ومقاس النظر', 'Lens options & prescription updated')
          : t('تم حذف مقاس النظر وخيارات العدسات', 'Prescription & lens options removed')
      );
    },
    removeFromCart: (cartItemId) => {
      const nextCart = stateRef.current.cart.filter((c) => c.id !== cartItemId);
      setState((prev) => ({ ...prev, cart: nextCart }));
      if (auth.currentUser) {
        void syncUserDocFields(auth.currentUser.uid, { cart: nextCart });
      }
    },
    placeOrder: async (payload) => {
      const current = auth.currentUser;
      if (!current || current.isAnonymous) {
        setState((prev) => ({
          ...prev,
          pendingCheckoutReturn: true,
          authModal: { open: true, view: 'choice', checkoutNotice: true },
        }));
        return null;
      }

      await current.reload();
      if (!current.emailVerified) {
        setState((prev) => ({ ...prev, pendingCheckoutReturn: true }));
        showToast(
          t(
            'يجب تأكيد بريدك الإلكتروني قبل إتمام الطلب',
            'You must verify your email before placing an order'
          )
        );
        return null;
      }

      // Refresh ID token so request.auth.token.email_verified is true in Firestore Rules
      await current.getIdToken(true);

      const itemsSubtotalSdg = stateRef.current.cart.reduce(
        (sum, item) => sum + item.unitPriceSdg * item.quantity,
        0
      );
      const lensOptionsTotalSdg = stateRef.current.cart.reduce(
        (sum, item) => sum + (item.prescription?.lensExtraPriceSdg || 0) * item.quantity,
        0
      );
      const subtotalSdg = itemsSubtotalSdg + lensOptionsTotalSdg;

      if (state.settings.minimumOrderSdg > 0 && subtotalSdg < state.settings.minimumOrderSdg) {
        showToast(
          t(
            `الحد الأدنى للطلب هو ${state.settings.minimumOrderSdg} ج.س`,
            `Minimum order is ${state.settings.minimumOrderSdg} SDG`
          )
        );
        return null;
      }

      const totalSdg = Math.max(0, Math.round(subtotalSdg - payload.discountSdg + payload.deliveryFeeSdg));
      const hasBankakPart = payload.paymentMethod === 'bankak' || payload.paymentMethod === 'split';
      const initialStatus: OrderStatus = hasBankakPart
        ? 'awaiting_payment_verification'
        : 'pending';
      const splitCalc =
        payload.paymentMethod === 'split'
          ? calculateSplitAmounts(totalSdg, stateRef.current.settings)
          : payload.paymentMethod === 'bankak'
          ? { bankakAmount: totalSdg, codAmount: 0 }
          : { bankakAmount: 0, codAmount: totalSdg };
      const orderId = `ORD-2026-${Math.floor(1050 + Math.random() * 8900)}`;
      const nowIso = new Date().toISOString();

      const items = stateRef.current.cart.map((ci) => {
        const prod = stateRef.current.products.find((p) => p.id === ci.productId);
        const resolvedVision = resolveVisionType(ci.prescription);
        const resolvedExtras = resolveExtraOptions(ci.prescription);
        return {
          productId: ci.productId,
          name: prod?.titleAr || prod?.titleEn || 'منتج بصري',
          titleAr: prod?.titleAr || 'منتج بصري',
          titleEn: prod?.titleEn || 'Optical Item',
          image: prod?.images[0] || '',
          variantLabel: ci.variantLabel,
          options: ci.selectedOptions,
          quantity: ci.quantity,
          unitPriceSdg: ci.unitPriceSdg,
          lensOption: ci.prescription?.lensOption || resolvedVision || 'none',
          visionType: resolvedVision,
          extraOptions: resolvedExtras.length > 0 ? resolvedExtras : undefined,
          mirrorColor: resolvedExtras.includes('mirror') ? ci.prescription?.mirrorColor : undefined,
          lensExtraPriceSdg: ci.prescription?.lensExtraPriceSdg || 0,
          prescription: ci.prescription,
          contactLensSelection: ci.contactLensSelection,
        };
      });

      const newOrder: Order = {
        id: orderId,
        customerUid: current.uid,
        customerName: payload.customerName,
        customerPhone: payload.customerPhone,
        stateId: payload.stateId,
        city: payload.city,
        area: payload.area,
        addressDetails: payload.addressDetails,
        address: payload.address,
        items,
        itemsSubtotalSdg,
        lensOptionsTotalSdg,
        subtotalSdg,
        discountSdg: payload.discountSdg,
        deliveryFeeSdg: payload.deliveryFeeSdg,
        totalSdg,
        couponCode: payload.couponCode,
        paymentMethod: payload.paymentMethod,
        bankakPaidSdg: splitCalc.bankakAmount,
        codRemainingSdg: splitCalc.codAmount,
        bankTransferReference: payload.bankTransferReference,
        bankTransferReceiptUrl: payload.bankTransferReceiptUrl,
        customerNote: payload.customerNote?.trim() || undefined,
        status: initialStatus,
        createdAt: nowIso,
        updatedAt: nowIso,
      };

      try {
        await setDoc(
          doc(db, 'orders', orderId),
          stripUndefined({
            ...newOrder,
            createdAtServer: serverTimestamp(),
            updatedAtServer: serverTimestamp(),
          })
        );
        await syncUserDocFields(current.uid, { cart: [] });
      } catch (error) {
        handleFirestoreError(error, OperationType.CREATE, `orders/${orderId}`);
      }

      const notif: AppNotification = {
        id: `n_${Date.now()}`,
        customerUid: current.uid,
        titleAr:
          initialStatus === 'awaiting_payment_verification'
            ? payload.paymentMethod === 'split'
              ? `تم استلام طلبك #${orderId} وعربون بنكك`
              : `تم استلام طلبك #${orderId} وإشعار بنكك`
            : `تم تأكيد استلام طلبك #${orderId}`,
        titleEn:
          initialStatus === 'awaiting_payment_verification'
            ? payload.paymentMethod === 'split'
              ? `Order #${orderId} & Bankak Deposit Received`
              : `Order #${orderId} & Bankak Receipt Received`
            : `Order #${orderId} Received`,
        bodyAr:
          initialStatus === 'awaiting_payment_verification'
            ? payload.paymentMethod === 'split'
              ? `نراجع الآن إيصال عربون بنكك (${formatSdg(splitCalc.bankakAmount)})، والمتبقي عند الاستلام ${formatSdg(splitCalc.codAmount)}.`
              : 'سيقوم فريقنا بمراجعة إيصال التحويل البنكي وتأكيد الطلب قريباً.'
            : 'طلبك الآن قيد المراجعة وسيتواصل معك المندوب.',
        bodyEn:
          initialStatus === 'awaiting_payment_verification'
            ? payload.paymentMethod === 'split'
              ? `We are verifying your Bankak deposit (${formatSdg(splitCalc.bankakAmount)}). Remaining COD: ${formatSdg(splitCalc.codAmount)}.`
              : 'Our team is verifying your Bankak transfer receipt.'
            : 'Your COD order is pending confirmation.',
        isRead: false,
        createdAt: nowIso,
        deepLinkType: 'order',
        deepLinkId: orderId,
      };

      setState((prev) => ({
        ...prev,
        orders: [newOrder, ...prev.orders.filter((o) => o.id !== orderId)],
        cart: [],
        pendingCheckoutReturn: false,
        notifications: [notif, ...prev.notifications],
        activeTab: 'orders',
        tabHistory: ['home'],
      }));
      showToast(t(`تم إنشاء الطلب #${orderId} بنجاح`, `Order #${orderId} placed`));
      return newOrder;
    },
    updateOrderByCustomer: async (orderId, payload) => {
      const current = auth.currentUser;
      if (!current || current.isAnonymous || !current.emailVerified) {
        showToast(t('يجب تسجيل الدخول وتأكيد البريد الإلكتروني أولاً', 'Verified account required'));
        return;
      }
      const order = stateRef.current.orders.find((o) => o.id === orderId);
      if (!order || order.customerUid !== current.uid) return;
      if (order.cancelRequest?.status === 'approved') return;

      const isPreConfirm =
        order.status === 'pending' || order.status === 'awaiting_payment_verification';
      const isPreShipContactOnly =
        order.status === 'confirmed' || order.status === 'preparing';

      if (!isPreConfirm && !isPreShipContactOnly) {
        showToast(t('لا يمكن تعديل الطلب بعد الشحن', 'Orders cannot be edited after shipping'));
        return;
      }

      const nowIso = new Date().toISOString();
      const prevOrders = stateRef.current.orders;

      if (isPreConfirm) {
        const nextItems = (payload.items && payload.items.length > 0 ? payload.items : order.items).map(
          (item) => {
            const catalogProduct = stateRef.current.products.find((p) => p.id === item.productId);
            const authoritativeUnitPrice = catalogProduct ? catalogProduct.priceSdg : item.unitPriceSdg;
            const cleanQty = Math.max(1, Math.min(99, Math.round(item.quantity || 1)));
            const resolvedVision = resolveVisionType(item.prescription);
            const resolvedExtras = resolveExtraOptions(item.prescription);
            return stripUndefined({
              ...item,
              quantity: cleanQty,
              unitPriceSdg: authoritativeUnitPrice,
              lensOption: item.prescription?.lensOption || resolvedVision || item.lensOption || 'none',
              visionType: resolvedVision,
              extraOptions: resolvedExtras.length > 0 ? resolvedExtras : item.extraOptions,
              mirrorColor: resolvedExtras.includes('mirror')
                ? item.prescription?.mirrorColor || item.mirrorColor
                : undefined,
              lensExtraPriceSdg:
                item.prescription?.lensExtraPriceSdg ?? item.lensExtraPriceSdg ?? 0,
            });
          }
        );

        const stateObj = stateRef.current.settings.deliveryFees.find((s) => s.id === payload.stateId);
        const deliveryFeeSdg = stateObj ? stateObj.feeSdg : order.deliveryFeeSdg;
        const itemsSubtotalSdg = nextItems.reduce(
          (sum, it) => sum + it.unitPriceSdg * it.quantity,
          0
        );
        const lensOptionsTotalSdg = nextItems.reduce(
          (sum, it) =>
            sum + (it.lensExtraPriceSdg ?? it.prescription?.lensExtraPriceSdg ?? 0) * it.quantity,
          0
        );
        const subtotalSdg = itemsSubtotalSdg + lensOptionsTotalSdg;
        const totalSdg = Math.max(0, Math.round(subtotalSdg - order.discountSdg + deliveryFeeSdg));
        const hasBankakPart = order.paymentMethod === 'bankak' || order.paymentMethod === 'split';
        const nextBankakPaidSdg =
          order.paymentMethod === 'bankak'
            ? totalSdg
            : order.paymentMethod === 'split'
            ? Math.min(
                totalSdg,
                Math.max(
                  0,
                  Math.round(
                    order.bankakPaidSdg ??
                      calculateSplitAmounts(totalSdg, stateRef.current.settings).bankakAmount
                  )
                )
              )
            : 0;
        const nextCodRemainingSdg = Math.max(0, totalSdg - nextBankakPaidSdg);

        const patch: Partial<Order> = stripUndefined({
          customerName: payload.customerName.trim(),
          customerPhone: payload.customerPhone.trim(),
          stateId: payload.stateId,
          city: payload.city.trim(),
          area: payload.area.trim(),
          addressDetails: payload.addressDetails.trim(),
          address: stripUndefined({
            ...payload.address,
            recipientName: payload.customerName.trim(),
            phone: payload.customerPhone.trim(),
            stateId: payload.stateId,
            stateNameAr: stateObj?.nameAr || payload.address.stateNameAr,
            stateNameEn: stateObj?.nameEn || payload.address.stateNameEn,
            city: payload.city.trim(),
            area: payload.area.trim(),
            details: payload.addressDetails.trim(),
          }),
          items: nextItems,
          itemsSubtotalSdg,
          lensOptionsTotalSdg,
          subtotalSdg,
          deliveryFeeSdg,
          totalSdg,
          bankakPaidSdg: nextBankakPaidSdg,
          codRemainingSdg: nextCodRemainingSdg,
          bankTransferReference: hasBankakPart
            ? payload.bankTransferReference?.trim() || order.bankTransferReference
            : order.bankTransferReference,
          bankTransferReceiptUrl: hasBankakPart
            ? payload.bankTransferReceiptUrl || order.bankTransferReceiptUrl
            : order.bankTransferReceiptUrl,
          customerNote: payload.customerNote?.trim() || undefined,
          lastEditedAt: nowIso,
          lastEditedBy: current.uid,
          updatedAt: nowIso,
        });

        setState((prev) => ({
          ...prev,
          orders: prev.orders.map((o) => (o.id === orderId ? { ...o, ...patch } : o)),
        }));

        try {
          await updateDoc(
            doc(db, 'orders', orderId),
            stripUndefined({
              ...patch,
              bankTransferReference: hasBankakPart
                ? payload.bankTransferReference?.trim()
                  ? payload.bankTransferReference.trim()
                  : order.bankTransferReference
                  ? deleteField()
                  : undefined
                : undefined,
              customerNote: payload.customerNote?.trim()
                ? payload.customerNote.trim()
                : order.customerNote
                ? deleteField()
                : undefined,
              updatedAtServer: serverTimestamp(),
            })
          );
          showToast(t('تم حفظ تعديلات الطلب بنجاح', 'Order changes saved'));
        } catch (err) {
          setState((prev) => ({ ...prev, orders: prevOrders }));
          handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
        }
        return;
      }

      // Confirmed / preparing: allow safe contact, street address & customerNote updates
      const contactPatch: Partial<Order> = stripUndefined({
        customerName: payload.customerName.trim(),
        customerPhone: payload.customerPhone.trim(),
        city: payload.city.trim(),
        area: payload.area.trim(),
        addressDetails: payload.addressDetails.trim(),
        address: stripUndefined({
          ...(order.address || payload.address),
          recipientName: payload.customerName.trim(),
          phone: payload.customerPhone.trim(),
          stateId: order.stateId,
          city: payload.city.trim(),
          area: payload.area.trim(),
          details: payload.addressDetails.trim(),
        }),
        customerNote: payload.customerNote?.trim() || undefined,
        lastEditedAt: nowIso,
        lastEditedBy: current.uid,
        updatedAt: nowIso,
      });

      setState((prev) => ({
        ...prev,
        orders: prev.orders.map((o) => (o.id === orderId ? { ...o, ...contactPatch } : o)),
      }));

      try {
        await updateDoc(
          doc(db, 'orders', orderId),
          stripUndefined({
            ...contactPatch,
            customerNote: payload.customerNote?.trim()
              ? payload.customerNote.trim()
              : order.customerNote
              ? deleteField()
              : undefined,
            updatedAtServer: serverTimestamp(),
          })
        );
        showToast(t('تم تحديث بيانات التوصيل للطلب', 'Delivery details updated'));
      } catch (err) {
        setState((prev) => ({ ...prev, orders: prevOrders }));
        handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
      }
    },
    updateOrderByAdmin: async (orderId, payload) => {
      const current = auth.currentUser;
      const role = stateRef.current.user.role;
      if (!current || (role !== 'admin' && role !== 'staff')) return;
      const order = stateRef.current.orders.find((o) => o.id === orderId);
      if (!order) return;

      const cleanItems = payload.items
        .filter((it) => it && it.productId && (it.quantity || 0) >= 1)
        .map((it) =>
          stripUndefined({
            ...it,
            quantity: Math.max(1, Math.min(99, Math.round(it.quantity))),
            unitPriceSdg: Math.max(0, Math.round(it.unitPriceSdg || 0)),
            lensExtraPriceSdg: Math.max(
              0,
              Math.round(it.lensExtraPriceSdg ?? it.prescription?.lensExtraPriceSdg ?? 0)
            ),
          })
        );
      if (cleanItems.length === 0) return;

      const nowIso = new Date().toISOString();
      const stateObj = stateRef.current.settings.deliveryFees.find((s) => s.id === payload.stateId);
      const itemsSubtotalSdg = cleanItems.reduce(
        (sum, it) => sum + it.unitPriceSdg * it.quantity,
        0
      );
      const lensOptionsTotalSdg = cleanItems.reduce(
        (sum, it) => sum + (it.lensExtraPriceSdg || 0) * it.quantity,
        0
      );
      const subtotalSdg = itemsSubtotalSdg + lensOptionsTotalSdg;
      const cleanDiscount = Math.max(0, Math.round(payload.discountSdg || 0));
      const cleanDelivery = Math.max(0, Math.round(payload.deliveryFeeSdg || 0));
      const totalSdg = Math.max(0, Math.round(subtotalSdg - cleanDiscount + cleanDelivery));
      const cleanAdminNote = payload.adminNote?.trim() || undefined;
      const adminBankakPaidSdg =
        payload.paymentMethod === 'bankak'
          ? totalSdg
          : payload.paymentMethod === 'split'
          ? Math.min(
              totalSdg,
              Math.max(
                0,
                Math.round(
                  payload.bankakPaidSdg ??
                    calculateSplitAmounts(totalSdg, stateRef.current.settings).bankakAmount
                )
              )
            )
          : 0;
      const adminCodRemainingSdg = Math.max(0, totalSdg - adminBankakPaidSdg);

      const patch: Partial<Order> = stripUndefined({
        customerName: payload.customerName.trim(),
        customerPhone: payload.customerPhone.trim(),
        stateId: payload.stateId,
        city: payload.city.trim(),
        area: payload.area.trim(),
        addressDetails: payload.addressDetails.trim(),
        address: stripUndefined({
          ...payload.address,
          recipientName: payload.customerName.trim(),
          phone: payload.customerPhone.trim(),
          stateId: payload.stateId,
          stateNameAr: stateObj?.nameAr || payload.address.stateNameAr,
          stateNameEn: stateObj?.nameEn || payload.address.stateNameEn,
          city: payload.city.trim(),
          area: payload.area.trim(),
          details: payload.addressDetails.trim(),
        }),
        items: cleanItems,
        itemsSubtotalSdg,
        lensOptionsTotalSdg,
        subtotalSdg,
        discountSdg: cleanDiscount,
        deliveryFeeSdg: cleanDelivery,
        totalSdg,
        paymentMethod: payload.paymentMethod,
        bankakPaidSdg: adminBankakPaidSdg,
        codRemainingSdg: adminCodRemainingSdg,
        bankTransferReference: payload.bankTransferReference?.trim() || undefined,
        adminNote: cleanAdminNote,
        lastEditedAt: nowIso,
        lastEditedBy: current.uid,
        updatedAt: nowIso,
      });

      const notif: AppNotification | null = order.customerUid
        ? {
            id: `n_${Date.now()}`,
            customerUid: order.customerUid,
            titleAr: `تم تحديث تفاصيل الطلب #${orderId}`,
            titleEn: `Order #${orderId} Details Updated`,
            bodyAr: cleanAdminNote
              ? `تم تعديل الطلب من قِبل الإدارة: ${cleanAdminNote}`
              : 'تم تعديل تفاصيل طلبك ومراجعته من قِبل الإدارة.',
            bodyEn: cleanAdminNote
              ? `Order updated by management: ${cleanAdminNote}`
              : 'Your order details were updated by management.',
            isRead: false,
            createdAt: nowIso,
            deepLinkType: 'order',
            deepLinkId: orderId,
          }
        : null;

      const prevOrders = stateRef.current.orders;
      const prevNotifications = stateRef.current.notifications;

      setState((prev) => ({
        ...prev,
        orders: prev.orders.map((o) => (o.id === orderId ? { ...o, ...patch } : o)),
        notifications: notif ? [notif, ...prev.notifications] : prev.notifications,
      }));

      try {
        await updateDoc(
          doc(db, 'orders', orderId),
          stripUndefined({
            ...patch,
            bankTransferReference: payload.bankTransferReference?.trim()
              ? payload.bankTransferReference.trim()
              : order.bankTransferReference
              ? deleteField()
              : undefined,
            adminNote: cleanAdminNote
              ? cleanAdminNote
              : order.adminNote
              ? deleteField()
              : undefined,
            updatedAtServer: serverTimestamp(),
          })
        );
      } catch (err) {
        setState((prev) => ({
          ...prev,
          orders: prevOrders,
          notifications: prevNotifications,
        }));
        handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
      }

      if (notif) {
        void setDoc(doc(db, 'notifications', notif.id), stripUndefined(notif)).catch((err) =>
          handleFirestoreError(err, OperationType.CREATE, `notifications/${notif.id}`)
        );
      }

      showToast(t('تم حفظ تعديلات الطلب وإشعار العميل', 'Order edited & customer notified'));
    },
    requestOrderCancellation: async (orderId, reason, note) => {
      const current = auth.currentUser;
      if (!current || current.isAnonymous) {
        showToast(t('سجّل دخولك لاستخدام هذه الميزة', 'Sign in to use this feature'));
        return;
      }
      const order = stateRef.current.orders.find((o) => o.id === orderId);
      if (!order || order.customerUid !== current.uid) return;
      const allowedStatuses: OrderStatus[] = [
        'pending',
        'awaiting_payment_verification',
        'confirmed',
        'preparing',
      ];
      if (!allowedStatuses.includes(order.status) || Boolean(order.cancelRequest)) {
        showToast(
          t(
            'تم إرسال طلب إلغاء مسبقاً لهذا الطلب أو لم يعد متاحاً للإلغاء.',
            'A cancellation request was already submitted or this order can no longer be cancelled.'
          )
        );
        return;
      }
      const cleanReason = reason.trim();
      if (!cleanReason) return;
      const nowIso = new Date().toISOString();
      const cancelReq: CancelRequest = stripUndefined({
        status: 'pending',
        reason: cleanReason,
        note: note?.trim() || undefined,
        requestedAt: nowIso,
        requestedBy: current.uid,
      });
      const nextHistory = [...(order.cancelRequestHistory || []), cancelReq];
      const prevOrders = stateRef.current.orders;

      setState((prev) => ({
        ...prev,
        orders: prev.orders.map((o) =>
          o.id === orderId
            ? {
                ...o,
                cancelRequest: cancelReq,
                cancelRequestHistory: nextHistory,
                updatedAt: nowIso,
              }
            : o
        ),
      }));

      try {
        await updateDoc(
          doc(db, 'orders', orderId),
          stripUndefined({
            cancelRequest: cancelReq,
            cancelRequestHistory: nextHistory,
            updatedAt: nowIso,
            updatedAtServer: serverTimestamp(),
          })
        );
        showToast(
          t(
            'تم إرسال طلب الإلغاء وهو الآن قيد المراجعة',
            'Cancellation request sent and under review'
          )
        );
      } catch (err) {
        setState((prev) => ({
          ...prev,
          orders: prevOrders,
        }));
        handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
      }
    },
    approveOrderCancellation: async (orderId, adminNote) => {
      const current = auth.currentUser;
      const role = stateRef.current.user.role;
      if (!current || (role !== 'admin' && role !== 'staff')) return;
      const nowIso = new Date().toISOString();
      const cleanAdminNote = adminNote?.trim() || undefined;

      let customerUid = '';
      let wasVerifiedBankak = false;
      let approvedReq: CancelRequest | undefined;
      let nextHistory: CancelRequest[] = [];
      const updatedProductsMap = new Map<string, { stock: number; isOutOfStock: boolean; variants: Product['variants'] }>();

      try {
        await runTransaction(db, async (tx) => {
          const orderRef = doc(db, 'orders', orderId);
          const orderSnap = await tx.get(orderRef);
          if (!orderSnap.exists()) {
            throw new Error('Order not found');
          }
          const orderData = orderSnap.data() as Order;
          if (orderData.status === 'cancelled') {
            throw new Error('Order already cancelled');
          }
          customerUid = orderData.customerUid;

          const uniqueProductIds = Array.from(
            new Set(orderData.items.map((it) => it.productId).filter(Boolean))
          );
          const productDocs = new Map<string, Product>();
          for (const pid of uniqueProductIds) {
            const pSnap = await tx.get(doc(db, 'products', pid));
            if (pSnap.exists()) {
              productDocs.set(pid, pSnap.data() as Product);
            }
          }

          wasVerifiedBankak =
            (orderData.paymentMethod === 'bankak' || orderData.paymentMethod === 'split') &&
            (orderData.bankTransferVerified === true ||
              orderData.status === 'confirmed' ||
              orderData.status === 'preparing');

          const baseReq: CancelRequest = orderData.cancelRequest || {
            status: 'pending',
            reason: 'إلغاء إداري',
            requestedAt: nowIso,
            requestedBy: orderData.customerUid,
          };

          approvedReq = stripUndefined({
            ...baseReq,
            status: 'approved',
            reviewedAt: nowIso,
            reviewedBy: current.uid,
            adminNote: cleanAdminNote,
          });

          const existingHistory = Array.isArray(orderData.cancelRequestHistory)
            ? [...orderData.cancelRequestHistory]
            : [];
          const pendingIdx = existingHistory.findIndex((h) => h.status === 'pending');
          if (pendingIdx >= 0) {
            existingHistory[pendingIdx] = approvedReq;
            nextHistory = existingHistory;
          } else {
            nextHistory = [...existingHistory, approvedReq];
          }

          for (const pid of uniqueProductIds) {
            const pData = productDocs.get(pid);
            if (!pData) continue;
            const matchingItems = orderData.items.filter((it) => it.productId === pid);
            const totalQty = matchingItems.reduce((sum, it) => sum + (it.quantity || 0), 0);
            const nextStock = Math.max(0, (pData.stock || 0) + totalQty);
            const nextVariants = (pData.variants || []).map((v) => {
              const variantQty = matchingItems
                .filter(
                  (it) =>
                    it.variantLabel &&
                    (it.variantLabel === v.colorNameAr || it.variantLabel === v.colorNameEn)
                )
                .reduce((s, it) => s + (it.quantity || 0), 0);
              return variantQty > 0 ? { ...v, stock: Math.max(0, (v.stock || 0) + variantQty) } : v;
            });
            updatedProductsMap.set(pid, {
              stock: nextStock,
              isOutOfStock: nextStock <= 0,
              variants: nextVariants,
            });
            tx.update(
              doc(db, 'products', pid),
              stripUndefined({
                stock: nextStock,
                isOutOfStock: nextStock <= 0,
                variants: nextVariants,
              })
            );
          }

          tx.update(
            orderRef,
            stripUndefined({
              status: 'cancelled',
              cancelRequest: approvedReq,
              cancelRequestHistory: nextHistory,
              refundRequired: wasVerifiedBankak,
              updatedAt: nowIso,
              updatedAtServer: serverTimestamp(),
            })
          );
        });
      } catch (err) {
        handleFirestoreError(err, OperationType.WRITE, `orders/${orderId}`);
      }

      const notif: AppNotification = {
        id: `n_${Date.now()}`,
        customerUid,
        titleAr: `تمت الموافقة على إلغاء الطلب #${orderId}`,
        titleEn: `Cancellation Approved for #${orderId}`,
        bodyAr: wasVerifiedBankak
          ? 'تم إلغاء الطلب وإعادة المخزون. سيتم إرجاع المبلغ لحسابك عبر بنكك.'
          : cleanAdminNote || 'تم إلغاء طلبك بنجاح بناءً على طلبك.',
        bodyEn: wasVerifiedBankak
          ? 'Order cancelled and Bankak refund initiated.'
          : cleanAdminNote || 'Your order cancellation request was approved.',
        isRead: false,
        createdAt: nowIso,
        deepLinkType: 'order',
        deepLinkId: orderId,
      };

      setState((prev) => ({
        ...prev,
        orders: prev.orders.map((o) =>
          o.id === orderId
            ? {
                ...o,
                status: 'cancelled',
                cancelRequest: approvedReq,
                cancelRequestHistory: nextHistory,
                refundRequired: wasVerifiedBankak,
                updatedAt: nowIso,
              }
            : o
        ),
        products: prev.products.map((p) => {
          const patched = updatedProductsMap.get(p.id);
          return patched ? { ...p, ...patched } : p;
        }),
        notifications: [notif, ...prev.notifications],
      }));

      if (customerUid) {
        void setDoc(doc(db, 'notifications', notif.id), stripUndefined(notif)).catch((err) =>
          handleFirestoreError(err, OperationType.CREATE, `notifications/${notif.id}`)
        );
      }

      showToast(
        t(
          'تمت الموافقة على الإلغاء وإعادة المخزون وإشعار العميل',
          'Cancellation approved, stock restored & customer notified'
        )
      );
    },
    rejectOrderCancellation: async (orderId, adminNote) => {
      const current = auth.currentUser;
      const role = stateRef.current.user.role;
      const cleanNote = adminNote.trim();
      if (!current || !cleanNote || (role !== 'admin' && role !== 'staff')) return;
      const order = stateRef.current.orders.find((o) => o.id === orderId);
      if (!order || !order.cancelRequest || order.cancelRequest.status !== 'pending') return;
      const nowIso = new Date().toISOString();

      const rejectedReq: CancelRequest = stripUndefined({
        ...order.cancelRequest,
        status: 'rejected',
        reviewedAt: nowIso,
        reviewedBy: current.uid,
        adminNote: cleanNote,
      });

      const existingHistory = Array.isArray(order.cancelRequestHistory)
        ? [...order.cancelRequestHistory]
        : [];
      const pendingIdx = existingHistory.findIndex((h) => h.status === 'pending');
      const nextHistory =
        pendingIdx >= 0
          ? existingHistory.map((h, i) => (i === pendingIdx ? rejectedReq : h))
          : [...existingHistory, rejectedReq];

      const notif: AppNotification = {
        id: `n_${Date.now()}`,
        customerUid: order.customerUid,
        titleAr: `تم رفض طلب إلغاء الطلب #${orderId}`,
        titleEn: `Cancellation Request Rejected for #${orderId}`,
        bodyAr: `السبب: ${cleanNote}`,
        bodyEn: `Reason: ${cleanNote}`,
        isRead: false,
        createdAt: nowIso,
        deepLinkType: 'order',
        deepLinkId: orderId,
      };

      const prevOrders = stateRef.current.orders;
      const prevNotifications = stateRef.current.notifications;

      setState((prev) => ({
        ...prev,
        orders: prev.orders.map((o) =>
          o.id === orderId
            ? {
                ...o,
                cancelRequest: rejectedReq,
                cancelRequestHistory: nextHistory,
                updatedAt: nowIso,
              }
            : o
        ),
        notifications: [notif, ...prev.notifications],
      }));

      try {
        await updateDoc(
          doc(db, 'orders', orderId),
          stripUndefined({
            cancelRequest: rejectedReq,
            cancelRequestHistory: nextHistory,
            updatedAt: nowIso,
            updatedAtServer: serverTimestamp(),
          })
        );
      } catch (err) {
        setState((prev) => ({
          ...prev,
          orders: prevOrders,
          notifications: prevNotifications,
        }));
        handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
      }

      if (order.customerUid) {
        void setDoc(doc(db, 'notifications', notif.id), stripUndefined(notif)).catch((err) =>
          handleFirestoreError(err, OperationType.CREATE, `notifications/${notif.id}`)
        );
      }

      showToast(t('تم رفض طلب الإلغاء وإشعار العميل', 'Cancellation request rejected & customer notified'));
    },
    toggleOrderRefunded: async (orderId, refunded) => {
      const current = auth.currentUser;
      if (!current) return;
      const nowIso = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        orders: prev.orders.map((o) =>
          o.id === orderId
            ? {
                ...o,
                refunded,
                refundedAt: refunded ? nowIso : undefined,
                refundedBy: refunded ? current.uid : undefined,
                updatedAt: nowIso,
              }
            : o
        ),
      }));
      try {
        await updateDoc(doc(db, 'orders', orderId), {
          refunded,
          refundedAt: refunded ? nowIso : deleteField(),
          refundedBy: refunded ? current.uid : deleteField(),
          updatedAt: nowIso,
          updatedAtServer: serverTimestamp(),
        });
        showToast(
          refunded
            ? t('تم تأكيد إرجاع المبلغ للعميل', 'Refund marked as completed')
            : t('تم إلغاء علامة الاسترجاع', 'Refund status cleared')
        );
      } catch (err) {
        handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
      }
    },
    reorder: (orderId) => {
      const current = auth.currentUser;
      if (!current || current.isAnonymous) {
        showToast(t('سجّل دخولك لاستخدام هذه الميزة', 'Sign in to use this feature'));
        return;
      }
      const order = state.orders.find((o) => o.id === orderId);
      if (!order) return;
      const itemsToAdd: CartItem[] = order.items.map((item, idx) =>
        stripUndefined({
          id: `ci_re_${Date.now()}_${idx}`,
          productId: item.productId,
          variantLabel: item.variantLabel,
          selectedOptions: item.options,
          quantity: item.quantity,
          unitPriceSdg: item.unitPriceSdg,
          prescription: item.prescription,
          contactLensSelection: item.contactLensSelection,
        })
      );
      const nextCart = [...stateRef.current.cart, ...itemsToAdd];
      setState((prev) => ({
        ...prev,
        cart: nextCart,
        activeTab: 'cart',
      }));
      void syncUserDocFields(current.uid, { cart: nextCart });
      showToast(t('تمت إعادة إضافة منتجات الطلب للسلة', 'Order items added to cart'));
    },
    updateOrderStatus: (orderId, status) => {
      const role = stateRef.current.user.role;
      if (role !== 'admin' && role !== 'staff') return;
      const nowIso = new Date().toISOString();
      const targetOrder = stateRef.current.orders.find((o) => o.id === orderId);
      const statusLabelAr = getOrderStatusLabel(status, 'ar');
      const statusLabelEn = getOrderStatusLabel(status, 'en');
      const detailArMap: Record<OrderStatus, string> = {
        pending: 'طلبك قيد المراجعة الأولية من فريقنا.',
        awaiting_payment_verification: 'بانتظار مراجعة إيصال التحويل البنكي.',
        confirmed: 'تم تأكيد طلبك بنجاح وجارٍ إدخاله لقسم التجهيز.',
        preparing: 'يعمل فريق البصريات الآن على تجهيز وفحص نظارتك.',
        shipped: 'تم شحن طلبك وهو الآن في طريقه إلى عنوان التوصيل.',
        delivered: 'تم تسليم طلبك بنجاح. نتمنى لك رؤية واضحة ومريحة!',
        cancelled: 'تم إلغاء هذا الطلب.',
      };
      const detailEnMap: Record<OrderStatus, string> = {
        pending: 'Your order is pending initial review.',
        awaiting_payment_verification: 'Awaiting Bankak transfer verification.',
        confirmed: 'Your order has been confirmed.',
        preparing: 'Our optical team is preparing your eyewear.',
        shipped: 'Your order has been shipped and is on the way.',
        delivered: 'Your order has been delivered.',
        cancelled: 'This order was cancelled.',
      };

      const notif: AppNotification | null =
        targetOrder?.customerUid
          ? {
              id: `n_${Date.now()}`,
              customerUid: targetOrder.customerUid,
              titleAr: `تحديث حالة الطلب #${orderId}: ${statusLabelAr}`,
              titleEn: `Order #${orderId} Updated: ${statusLabelEn}`,
              bodyAr: `أصبحت حالة طلبك الآن "${statusLabelAr}" — ${detailArMap[status]}`,
              bodyEn: `Your order status is now "${statusLabelEn}" — ${detailEnMap[status]}`,
              isRead: false,
              createdAt: nowIso,
              deepLinkType: 'order',
              deepLinkId: orderId,
            }
          : null;

      const prevOrders = stateRef.current.orders;
      const prevNotifications = stateRef.current.notifications;

      setState((prev) => ({
        ...prev,
        orders: prev.orders.map((o) => (o.id === orderId ? { ...o, status, updatedAt: nowIso } : o)),
        notifications: notif ? [notif, ...prev.notifications] : prev.notifications,
      }));
      void updateDoc(doc(db, 'orders', orderId), {
        status,
        updatedAt: nowIso,
        updatedAtServer: serverTimestamp(),
      }).catch((err) => {
        setState((prev) => ({
          ...prev,
          orders: prevOrders,
          notifications: prevNotifications,
        }));
        handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`);
      });
      if (notif) {
        void setDoc(doc(db, 'notifications', notif.id), stripUndefined(notif)).catch((err) =>
          handleFirestoreError(err, OperationType.CREATE, `notifications/${notif.id}`)
        );
      }
      showToast(t('تم تحديث حالة الطلب وإشعار العميل', 'Order status updated & customer notified'));
    },
    approveBankTransfer: (orderId) => {
      const role = stateRef.current.user.role;
      if (role !== 'admin' && role !== 'staff') return;
      const nowIso = new Date().toISOString();
      const targetOrder = stateRef.current.orders.find((o) => o.id === orderId);
      const isSplitOrder = targetOrder?.paymentMethod === 'split';
      const splitRemaining = targetOrder
        ? Math.max(0, targetOrder.codRemainingSdg ?? targetOrder.totalSdg - (targetOrder.bankakPaidSdg ?? 0))
        : 0;
      const notif: AppNotification | null =
        targetOrder?.customerUid
          ? {
              id: `n_${Date.now()}`,
              customerUid: targetOrder.customerUid,
              titleAr: isSplitOrder
                ? `تم اعتماد عربون بنكك للطلب #${orderId}`
                : `تم اعتماد تحويل بنكك للطلب #${orderId}`,
              titleEn: isSplitOrder
                ? `Bankak Deposit Approved for #${orderId}`
                : `Bankak Transfer Approved for #${orderId}`,
              bodyAr: isSplitOrder
                ? `تم تأكيد استلام عربون بنكك، وطلبك الآن في مرحلة التجهيز. المتبقي عند الاستلام: ${formatSdg(splitRemaining)}.`
                : 'تم تأكيد استلام المبلغ بنجاح، وطلبك الآن في مرحلة التجهيز.',
              bodyEn: isSplitOrder
                ? `Your Bankak deposit is verified and your order is confirmed. Remaining COD: ${formatSdg(splitRemaining)}.`
                : 'Your transfer has been verified and your order is confirmed.',
              isRead: false,
              createdAt: nowIso,
              deepLinkType: 'order',
              deepLinkId: orderId,
            }
          : null;
      setState((prev) => ({
        ...prev,
        orders: prev.orders.map((o) =>
          o.id === orderId
            ? { ...o, status: 'confirmed', bankTransferVerified: true, updatedAt: nowIso }
            : o
        ),
        notifications: notif ? [notif, ...prev.notifications] : prev.notifications,
      }));
      void updateDoc(doc(db, 'orders', orderId), {
        status: 'confirmed',
        bankTransferVerified: true,
        updatedAt: nowIso,
        updatedAtServer: serverTimestamp(),
      }).catch((err) => handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`));
      if (notif) {
        void setDoc(doc(db, 'notifications', notif.id), stripUndefined(notif)).catch((err) =>
          handleFirestoreError(err, OperationType.CREATE, `notifications/${notif.id}`)
        );
      }
      showToast(t('تم اعتماد الدفع عبر بنكك وتأكيد الطلب', 'Bankak transfer approved'));
    },
    rejectBankTransfer: (orderId) => {
      const role = stateRef.current.user.role;
      if (role !== 'admin' && role !== 'staff') return;
      const nowIso = new Date().toISOString();
      const targetOrder = stateRef.current.orders.find((o) => o.id === orderId);
      const notif: AppNotification | null =
        targetOrder?.customerUid
          ? {
              id: `n_${Date.now()}`,
              customerUid: targetOrder.customerUid,
              titleAr: `تعذر التحقق من إيصال الطلب #${orderId}`,
              titleEn: `Transfer Verification Failed for #${orderId}`,
              bodyAr: 'يرجى التواصل مع خدمة العملاء أو إعادة إرسال إيصال التحويل الصحيح.',
              bodyEn: 'Please contact support regarding your bank transfer receipt.',
              isRead: false,
              createdAt: nowIso,
              deepLinkType: 'order',
              deepLinkId: orderId,
            }
          : null;
      setState((prev) => ({
        ...prev,
        orders: prev.orders.map((o) =>
          o.id === orderId
            ? { ...o, status: 'cancelled', bankTransferVerified: false, updatedAt: nowIso }
            : o
        ),
        notifications: notif ? [notif, ...prev.notifications] : prev.notifications,
      }));
      void updateDoc(doc(db, 'orders', orderId), {
        status: 'cancelled',
        bankTransferVerified: false,
        updatedAt: nowIso,
        updatedAtServer: serverTimestamp(),
      }).catch((err) => handleFirestoreError(err, OperationType.UPDATE, `orders/${orderId}`));
      if (notif) {
        void setDoc(doc(db, 'notifications', notif.id), stripUndefined(notif)).catch((err) =>
          handleFirestoreError(err, OperationType.CREATE, `notifications/${notif.id}`)
        );
      }
      showToast(t('تم رفض الإيصال وإشعار العميل', 'Transfer rejected'));
    },
    dismissLiveOrderAlert: () => {
      setState((prev) => ({ ...prev, liveOrderAlert: null }));
    },
    markNotificationRead: (id) => {
      const current = auth.currentUser;
      const target = stateRef.current.notifications.find((n) => n.id === id);
      setState((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) => (n.id === id ? { ...n, isRead: true } : n)),
      }));
      if (current && target) {
        if (target.customerUid === 'all' || !target.customerUid) {
          saveBroadcastReadId(current.uid, [id]);
        } else if (target.customerUid === current.uid && !current.isAnonymous) {
          void updateDoc(doc(db, 'notifications', id), { isRead: true }).catch(() => undefined);
        }
      }
    },
    markAllNotificationsRead: () => {
      const current = auth.currentUser;
      const currentNotifs = stateRef.current.notifications;
      setState((prev) => ({
        ...prev,
        notifications: prev.notifications.map((n) => ({ ...n, isRead: true })),
      }));
      if (current) {
        const broadcastIds = currentNotifs
          .filter((n) => n.customerUid === 'all' || !n.customerUid)
          .map((n) => n.id);
        if (broadcastIds.length > 0) {
          saveBroadcastReadId(current.uid, broadcastIds);
        }
        if (!current.isAnonymous) {
          currentNotifs
            .filter((n) => !n.isRead && n.customerUid === current.uid)
            .forEach((n) => {
              void updateDoc(doc(db, 'notifications', n.id), { isRead: true }).catch(() => undefined);
            });
        }
      }
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
      void setDoc(
        doc(db, 'notifications', notif.id),
        stripUndefined({ ...notif, customerUid: 'all' })
      ).catch((err) =>
        handleFirestoreError(err, OperationType.CREATE, `notifications/${notif.id}`)
      );
      showToast(t('تم إرسال الإشعار وحفظه في السجل', 'Notification sent & logged'));
    },
    createConsult: (topic, message, phone, imageUrl) => {
      const current = auth.currentUser;
      if (!current) {
        setState((prev) => ({
          ...prev,
          authModal: { open: true, view: 'choice', checkoutNotice: false },
        }));
        showToast(t('سجّل دخولك أو أنشئ حساباً لإرسال الاستشارة للأخصائي', 'Sign in to send a consultation'));
        return;
      }
      const uid = current.uid;
      const now = new Date().toISOString();
      const req: ConsultRequest = {
        id: `c_${Date.now()}`,
        customerUid: uid,
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
      void setDoc(
        doc(db, 'consults', req.id),
        stripUndefined({
          ...req,
          createdAtServer: serverTimestamp(),
          updatedAtServer: serverTimestamp(),
        })
      ).catch((err) => handleFirestoreError(err, OperationType.CREATE, `consults/${req.id}`));
      showToast(t('تم إرسال استشارتك لأخصائي البصريات', 'Consultation request sent'));
    },
    replyConsult: (consultId, text, sender) => {
      if (sender === 'customer' && !auth.currentUser) {
        setState((prev) => ({
          ...prev,
          authModal: { open: true, view: 'choice', checkoutNotice: false },
        }));
        showToast(t('سجّل دخولك لإرسال الرد في الاستشارة', 'Sign in to reply in consultation'));
        return;
      }
      const now = new Date().toISOString();
      const targetConsult = stateRef.current.consults.find((c) => c.id === consultId);
      const notifId = `n_${Date.now()}`;
      const opticianNotif: AppNotification | null =
        sender === 'optician' && targetConsult
          ? {
              id: notifId,
              customerUid: targetConsult.customerUid,
              titleAr: 'رد جديد من أخصائي البصريات',
              titleEn: 'New Optician Reply',
              bodyAr: text.slice(0, 90),
              bodyEn: text.slice(0, 90),
              isRead: false,
              createdAt: now,
              deepLinkType: 'consult',
              deepLinkId: consultId,
            }
          : null;

      let updatedConsult: ConsultRequest | undefined;
      setState((prev) => {
        const nextNotifs = opticianNotif ? [opticianNotif, ...prev.notifications] : prev.notifications;
        const nextConsults = prev.consults.map((c) => {
          if (c.id !== consultId) return c;
          updatedConsult = {
            ...c,
            status: sender === 'optician' ? ('answered' as const) : ('open' as const),
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
          };
          return updatedConsult;
        });
        return {
          ...prev,
          notifications: nextNotifs,
          consults: nextConsults,
        };
      });
      if (updatedConsult && auth.currentUser) {
        void updateDoc(
          doc(db, 'consults', consultId),
          stripUndefined({
            status: updatedConsult.status,
            messages: updatedConsult.messages,
            updatedAt: now,
            updatedAtServer: serverTimestamp(),
          })
        ).catch((err) => handleFirestoreError(err, OperationType.UPDATE, `consults/${consultId}`));
      }
      if (opticianNotif && opticianNotif.customerUid && auth.currentUser) {
        void setDoc(doc(db, 'notifications', opticianNotif.id), stripUndefined(opticianNotif)).catch((err) =>
          handleFirestoreError(err, OperationType.CREATE, `notifications/${opticianNotif.id}`)
        );
      }
      if (sender === 'optician') {
        showToast(t('تم إرسال الرد وإشعار العميل', 'Reply sent & customer notified'));
      }
    },
    closeConsult: (consultId) => {
      const nowIso = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        consults: prev.consults.map((c) =>
          c.id === consultId ? { ...c, status: 'closed', updatedAt: nowIso } : c
        ),
      }));
      void updateDoc(doc(db, 'consults', consultId), {
        status: 'closed',
        updatedAt: nowIso,
        updatedAtServer: serverTimestamp(),
      }).catch((err) => handleFirestoreError(err, OperationType.UPDATE, `consults/${consultId}`));
    },
    updateConsultTopics: (consultTopics) => {
      setState((prev) => ({ ...prev, consultTopics }));
      void writeConfigDoc('consultTopics', { items: consultTopics });
      showToast(t('تم تحديث مواضيع الاستشارة', 'Consult topics updated'));
    },
    updateLensOptions: (lensOptions) => {
      setState((prev) => ({ ...prev, lensOptions }));
      void writeConfigDoc('lensOptions', { items: lensOptions });
      showToast(t('تم تحديث خيارات العدسات والأسعار', 'Lens options updated'));
    },
    saveAddress: (addr) => {
      const id = `addr_${Date.now()}`;
      const isDefault = Boolean(addr.isDefault) || stateRef.current.user.addresses.length === 0;
      const created: SavedAddress = stripUndefined({ ...addr, id, isDefault });
      const current = auth.currentUser;
      if (!current || current.isAnonymous) {
        showToast(t('سجّل دخولك لاستخدام هذه الميزة', 'Sign in to use this feature'));
        return created;
      }
      const prevCleared = isDefault
        ? stateRef.current.user.addresses.map((a) => ({ ...a, isDefault: false }))
        : stateRef.current.user.addresses;
      const nextAddresses = isDefault ? [created, ...prevCleared] : [...prevCleared, created];
      setState((prev) => ({
        ...prev,
        user: { ...prev.user, addresses: nextAddresses },
      }));
      if (isDefault) {
        prevCleared.forEach((a) => {
          void setDoc(
            doc(db, 'users', current.uid, 'addresses', a.id),
            stripUndefined({ ...a, uid: current.uid, updatedAtServer: serverTimestamp() }),
            { merge: true }
          ).catch((err) =>
            handleFirestoreError(err, OperationType.WRITE, `users/${current.uid}/addresses/${a.id}`)
          );
        });
      }
      void setDoc(
        doc(db, 'users', current.uid, 'addresses', id),
        stripUndefined({
          ...created,
          uid: current.uid,
          createdAtServer: serverTimestamp(),
          updatedAtServer: serverTimestamp(),
        })
      ).catch((err) =>
        handleFirestoreError(err, OperationType.CREATE, `users/${current.uid}/addresses/${id}`)
      );
      void syncUserDocFields(current.uid, { addresses: nextAddresses });
      showToast(t('تم حفظ العنوان بنجاح', 'Address saved'));
      return created;
    },
    updateAddress: (addr) => {
      const current = auth.currentUser;
      if (!current || current.isAnonymous) {
        showToast(t('سجّل دخولك لاستخدام هذه الميزة', 'Sign in to use this feature'));
        return;
      }
      const prevAddresses = stateRef.current.user.addresses;
      const nextAddresses = prevAddresses.map((a) => {
        if (a.id === addr.id) return stripUndefined(addr);
        return addr.isDefault ? { ...a, isDefault: false } : a;
      });
      setState((prev) => ({
        ...prev,
        user: { ...prev.user, addresses: nextAddresses },
      }));
      if (addr.isDefault) {
        prevAddresses
          .filter((a) => a.id !== addr.id && a.isDefault)
          .forEach((a) => {
            void setDoc(
              doc(db, 'users', current.uid, 'addresses', a.id),
              stripUndefined({
                ...a,
                isDefault: false,
                uid: current.uid,
                updatedAtServer: serverTimestamp(),
              }),
              { merge: true }
            ).catch((err) =>
              handleFirestoreError(err, OperationType.WRITE, `users/${current.uid}/addresses/${a.id}`)
            );
          });
      }
      void setDoc(
        doc(db, 'users', current.uid, 'addresses', addr.id),
        stripUndefined({
          ...addr,
          uid: current.uid,
          updatedAtServer: serverTimestamp(),
        }),
        { merge: true }
      ).catch((err) =>
        handleFirestoreError(err, OperationType.WRITE, `users/${current.uid}/addresses/${addr.id}`)
      );
      void syncUserDocFields(current.uid, { addresses: nextAddresses });
      showToast(t('تم تحديث العنوان', 'Address updated'));
    },
    setDefaultAddress: (id) => {
      const current = auth.currentUser;
      if (!current || current.isAnonymous) {
        showToast(t('سجّل دخولك لاستخدام هذه الميزة', 'Sign in to use this feature'));
        return;
      }
      const nextAddresses = stateRef.current.user.addresses.map((a) => ({
        ...a,
        isDefault: a.id === id,
      }));
      setState((prev) => ({
        ...prev,
        user: { ...prev.user, addresses: nextAddresses },
      }));
      nextAddresses.forEach((a) => {
        void setDoc(
          doc(db, 'users', current.uid, 'addresses', a.id),
          stripUndefined({ ...a, uid: current.uid, updatedAtServer: serverTimestamp() }),
          { merge: true }
        ).catch((err) =>
          handleFirestoreError(err, OperationType.WRITE, `users/${current.uid}/addresses/${a.id}`)
        );
      });
      void syncUserDocFields(current.uid, { addresses: nextAddresses });
      showToast(t('تم تعيين العنوان الافتراضي', 'Default address updated'));
    },
    deleteAddress: (id) => {
      const current = auth.currentUser;
      if (!current || current.isAnonymous) {
        showToast(t('سجّل دخولك لاستخدام هذه الميزة', 'Sign in to use this feature'));
        return;
      }
      const nextAddresses = stateRef.current.user.addresses.filter((a) => a.id !== id);
      setState((prev) => ({
        ...prev,
        user: { ...prev.user, addresses: nextAddresses },
      }));
      void deleteDoc(doc(db, 'users', current.uid, 'addresses', id)).catch((err) =>
        handleFirestoreError(err, OperationType.DELETE, `users/${current.uid}/addresses/${id}`)
      );
      void syncUserDocFields(current.uid, { addresses: nextAddresses });
    },
    savePrescription: (rx) => {
      const id = `rx_${Date.now()}`;
      const created: SavedPrescription = stripUndefined({
        ...rx,
        id,
        savedAt: new Date().toISOString(),
      });
      const current = auth.currentUser;
      if (!current || current.isAnonymous) {
        showToast(t('سجّل دخولك لاستخدام هذه الميزة', 'Sign in to use this feature'));
        return created;
      }
      const nextRx = [created, ...stateRef.current.user.prescriptions];
      setState((prev) => ({
        ...prev,
        user: { ...prev.user, prescriptions: nextRx },
      }));
      void setDoc(
        doc(db, 'users', current.uid, 'prescriptions', id),
        stripUndefined({
          ...created,
          uid: current.uid,
          createdAtServer: serverTimestamp(),
          updatedAtServer: serverTimestamp(),
        })
      ).catch((err) =>
        handleFirestoreError(err, OperationType.CREATE, `users/${current.uid}/prescriptions/${id}`)
      );
      void syncUserDocFields(current.uid, { prescriptions: nextRx });
      showToast(t('تم حفظ الوصفة الطبية في ملفك', 'Prescription saved to profile'));
      return created;
    },
    deletePrescription: (id) => {
      const current = auth.currentUser;
      if (!current || current.isAnonymous) {
        showToast(t('سجّل دخولك لاستخدام هذه الميزة', 'Sign in to use this feature'));
        return;
      }
      const nextRx = stateRef.current.user.prescriptions.filter((p) => p.id !== id);
      setState((prev) => ({
        ...prev,
        user: { ...prev.user, prescriptions: nextRx },
      }));
      void deleteDoc(doc(db, 'users', current.uid, 'prescriptions', id)).catch((err) =>
        handleFirestoreError(err, OperationType.DELETE, `users/${current.uid}/prescriptions/${id}`)
      );
      void syncUserDocFields(current.uid, { prescriptions: nextRx });
    },
    upsertProduct: (product) => {
      setState((prev) => {
        const exists = prev.products.some((p) => p.id === product.id);
        const products = exists
          ? prev.products.map((p) => (p.id === product.id ? product : p))
          : [product, ...prev.products];
        return { ...prev, products };
      });
      void setDoc(doc(db, 'products', product.id), stripUndefined(product)).catch((err) =>
        handleFirestoreError(err, OperationType.WRITE, `products/${product.id}`)
      );
      showToast(t('تم حفظ المنتج ونشره في المتجر', 'Product saved & live'));
    },
    duplicateProduct: (id) => {
      const src = state.products.find((p) => p.id === id);
      if (!src) return;
      const copy: Product = {
        ...src,
        id: `p_copy_${Date.now()}`,
        sku: `${src.sku}-COPY`,
        titleAr: `${src.titleAr} (نسخة)`,
        titleEn: `${src.titleEn} (Copy)`,
        visible: false,
        reviews: [],
      };
      setState((prev) => ({ ...prev, products: [copy, ...prev.products] }));
      void setDoc(doc(db, 'products', copy.id), stripUndefined(copy)).catch((err) =>
        handleFirestoreError(err, OperationType.WRITE, `products/${copy.id}`)
      );
      showToast(t('تم نسخ المنتج كمسودة مخفية', 'Product duplicated as draft'));
    },
    deleteProduct: (id, permanent = false) => {
      setState((prev) => ({
        ...prev,
        products: permanent
          ? prev.products.filter((p) => p.id !== id)
          : prev.products.map((p) => (p.id === id ? { ...p, isDeleted: true, visible: false } : p)),
      }));
      if (permanent) {
        void deleteDoc(doc(db, 'products', id)).catch((err) =>
          handleFirestoreError(err, OperationType.DELETE, `products/${id}`)
        );
      } else {
        void updateDoc(doc(db, 'products', id), { isDeleted: true, visible: false }).catch((err) =>
          handleFirestoreError(err, OperationType.UPDATE, `products/${id}`)
        );
      }
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
        products
          .filter((p) => ids.includes(p.id))
          .forEach((p) => {
            void setDoc(doc(db, 'products', p.id), stripUndefined(p)).catch((err) =>
              handleFirestoreError(err, OperationType.WRITE, `products/${p.id}`)
            );
          });
        return { ...prev, products };
      });
      showToast(
        t(`تم تنفيذ الإجراء الجماعي على ${ids.length} منتج`, `Bulk action applied to ${ids.length} items`)
      );
    },
    upsertCategory: (cat) => {
      setState((prev) => {
        const exists = prev.categories.some((c) => c.id === cat.id);
        const categories = exists
          ? prev.categories.map((c) => (c.id === cat.id ? cat : c))
          : [...prev.categories, cat];
        return { ...prev, categories };
      });
      void setDoc(doc(db, 'categories', cat.id), stripUndefined(cat)).catch((err) =>
        handleFirestoreError(err, OperationType.WRITE, `categories/${cat.id}`)
      );
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
      void deleteDoc(doc(db, 'categories', id)).catch((err) =>
        handleFirestoreError(err, OperationType.DELETE, `categories/${id}`)
      );
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
      void setDoc(doc(db, 'brands', brand.id), stripUndefined(brand)).catch((err) =>
        handleFirestoreError(err, OperationType.WRITE, `brands/${brand.id}`)
      );
      showToast(t('تم حفظ العلامة التجارية', 'Brand saved'));
    },
    deleteBrand: (id) => {
      setState((prev) => ({
        ...prev,
        brands: prev.brands.filter((b) => b.id !== id),
      }));
      void deleteDoc(doc(db, 'brands', id)).catch((err) =>
        handleFirestoreError(err, OperationType.DELETE, `brands/${id}`)
      );
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
      void setDoc(doc(db, 'banners', banner.id), stripUndefined(banner)).catch((err) =>
        handleFirestoreError(err, OperationType.WRITE, `banners/${banner.id}`)
      );
      showToast(t('تم حفظ البانر الإعلاني', 'Banner saved'));
    },
    deleteBanner: (id) => {
      setState((prev) => ({
        ...prev,
        banners: prev.banners.filter((b) => b.id !== id),
      }));
      void deleteDoc(doc(db, 'banners', id)).catch((err) =>
        handleFirestoreError(err, OperationType.DELETE, `banners/${id}`)
      );
    },
    upsertCoupon: (coupon) => {
      setState((prev) => {
        const exists = prev.coupons.some((c) => c.code === coupon.code);
        const coupons = exists
          ? prev.coupons.map((c) => (c.code === coupon.code ? coupon : c))
          : [coupon, ...prev.coupons];
        return { ...prev, coupons };
      });
      void setDoc(doc(db, 'coupons', coupon.code), stripUndefined(coupon)).catch((err) =>
        handleFirestoreError(err, OperationType.WRITE, `coupons/${coupon.code}`)
      );
      showToast(t('تم حفظ كود الخصم', 'Coupon saved'));
    },
    deleteCoupon: (code) => {
      setState((prev) => ({
        ...prev,
        coupons: prev.coupons.filter((c) => c.code !== code),
      }));
      void deleteDoc(doc(db, 'coupons', code)).catch((err) =>
        handleFirestoreError(err, OperationType.DELETE, `coupons/${code}`)
      );
    },
    updateHomeSections: (homeSections) => {
      setState((prev) => ({ ...prev, homeSections }));
      void writeConfigDoc('homeSections', { items: homeSections });
      showToast(t('تم تحديث تصميم الصفحة الرئيسية فوراً', 'Home layout updated live'));
    },
    updateAppTexts: (appTexts) => {
      setState((prev) => ({ ...prev, appTexts }));
      void writeConfigDoc('texts', { ...appTexts });
      showToast(t('تم تحديث نصوص وسياسات التطبيق فوراً', 'App content & policies updated'));
    },
    updateAppearance: (appearance) => {
      setState((prev) => ({ ...prev, appearance, theme: appearance.defaultTheme }));
      void writeConfigDoc('appearance', { ...appearance });
      showToast(t('تم تحديث مظهر وألوان التطبيق فوراً', 'App appearance updated live'));
    },
    updateSettings: (settings) => {
      setState((prev) => ({ ...prev, settings }));
      void writeConfigDoc('settings', { ...settings });
      showToast(t('تم حفظ إعدادات المتجر ورسوم الولايات', 'Store settings updated'));
    },
    toggleBlockUser: (uid) => {
      const target = stateRef.current.directoryUsers.find((u) => u.uid === uid);
      const nextBlocked = !(target?.isBlocked || target?.blocked);
      setState((prev) => ({
        ...prev,
        directoryUsers: prev.directoryUsers.map((u) =>
          u.uid === uid ? { ...u, isBlocked: nextBlocked, blocked: nextBlocked } : u
        ),
        user:
          prev.user.uid === uid
            ? { ...prev.user, isBlocked: nextBlocked, blocked: nextBlocked }
            : prev.user,
      }));
      void updateDoc(doc(db, 'users', uid), {
        isBlocked: nextBlocked,
        blocked: nextBlocked,
        updatedAt: new Date().toISOString(),
        updatedAtServer: serverTimestamp(),
      }).catch((err) => handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`));
      showToast(t('تم تحديث حالة حساب العميل', 'Customer status updated'));
    },
    upsertStaffOrAdmin: (userRecord) => {
      const resolvedPerms: StaffPermission[] =
        userRecord.role === 'admin' ? ALL_ADMIN_PERMS : ['orders'];
      const nextRec: AppUser = { ...userRecord, permissions: resolvedPerms };
      setState((prev) => {
        const exists = prev.directoryUsers.some(
          (u) => u.uid === nextRec.uid || u.email === nextRec.email
        );
        const directoryUsers = exists
          ? prev.directoryUsers.map((u) =>
              u.uid === nextRec.uid || u.email === nextRec.email ? nextRec : u
            )
          : [nextRec, ...prev.directoryUsers];
        return { ...prev, directoryUsers };
      });
      void setDoc(
        doc(db, 'admins', nextRec.uid),
        stripUndefined({
          uid: nextRec.uid,
          role: nextRec.role,
          email: nextRec.email,
        })
      ).catch((err) => handleFirestoreError(err, OperationType.WRITE, `admins/${nextRec.uid}`));
      showToast(t('تم حفظ صلاحيات المسؤول/الموظف', 'Admin/Staff permissions saved'));
    },
    addOrUpdateAdminByEmail: async (email, role) => {
      const cleanEmail = email.trim();
      const lowerEmail = cleanEmail.toLowerCase();
      if (!cleanEmail) {
        return { ok: false, error: t('يرجى إدخال البريد الإلكتروني', 'Please enter an email address') };
      }

      let targetUser: AppUser | undefined = stateRef.current.directoryUsers.find(
        (u) => (u.email || '').trim().toLowerCase() === lowerEmail
      );

      if (!targetUser) {
        try {
          const exactSnap = await getDocs(
            query(collection(db, 'users'), where('email', '==', cleanEmail), limit(1))
          );
          if (!exactSnap.empty) {
            targetUser = exactSnap.docs[0].data() as AppUser;
          } else if (lowerEmail !== cleanEmail) {
            const lowerSnap = await getDocs(
              query(collection(db, 'users'), where('email', '==', lowerEmail), limit(1))
            );
            if (!lowerSnap.empty) {
              targetUser = lowerSnap.docs[0].data() as AppUser;
            }
          }
        } catch (err) {
          handleFirestoreError(err, OperationType.LIST, 'users');
        }
      }

      if (!targetUser || !targetUser.uid) {
        return {
          ok: false,
          error: t(
            'لا يوجد حساب مسجل بهذا البريد الإلكتروني. يجب على المستخدم إنشاء حساب في المتجر أولاً.',
            'No registered user found with this email. The user must create an account first.'
          ),
        };
      }

      if (targetUser.isAnonymous) {
        return {
          ok: false,
          error: t('لا يمكن منح صلاحيات لحساب ضيف', 'Cannot assign roles to a guest account'),
        };
      }

      const nextPerms: StaffPermission[] = role === 'admin' ? ALL_ADMIN_PERMS : ['orders'];
      const nowIso = new Date().toISOString();

      await updateDoc(
        doc(db, 'users', targetUser.uid),
        stripUndefined({
          role,
          permissions: nextPerms,
          updatedAt: nowIso,
          updatedAtServer: serverTimestamp(),
        })
      );

      await setDoc(
        doc(db, 'admins', targetUser.uid),
        stripUndefined({
          uid: targetUser.uid,
          role,
          email: targetUser.email || cleanEmail,
        })
      );

      const updatedTarget: AppUser = {
        ...targetUser,
        role,
        permissions: nextPerms,
        updatedAt: nowIso,
      };

      setState((prev) => ({
        ...prev,
        directoryUsers: prev.directoryUsers.some((u) => u.uid === targetUser!.uid)
          ? prev.directoryUsers.map((u) => (u.uid === targetUser!.uid ? updatedTarget : u))
          : [updatedTarget, ...prev.directoryUsers],
        user: prev.user.uid === targetUser!.uid ? { ...prev.user, role, permissions: nextPerms } : prev.user,
      }));

      showToast(
        role === 'admin'
          ? t('تمت إضافة المدير بنجاح', 'Admin added successfully')
          : t('تمت إضافة الموظف (الطلبات فقط) بنجاح', 'Staff (orders only) added successfully')
      );
      return { ok: true };
    },
    removeAdminRole: async (uid) => {
      if (uid === stateRef.current.user.uid) {
        showToast(t('لا يمكنك إزالة صلاحيتك الحالية', 'Cannot revoke your own admin role'));
        return;
      }
      const nowIso = new Date().toISOString();
      setState((prev) => ({
        ...prev,
        directoryUsers: prev.directoryUsers.map((u) =>
          u.uid === uid ? { ...u, role: 'customer', permissions: [] } : u
        ),
      }));
      await updateDoc(doc(db, 'users', uid), {
        role: 'customer',
        permissions: [],
        updatedAt: nowIso,
        updatedAtServer: serverTimestamp(),
      }).catch((err) => handleFirestoreError(err, OperationType.UPDATE, `users/${uid}`));
      await deleteDoc(doc(db, 'admins', uid)).catch(() => undefined);
      showToast(t('تمت إزالة صلاحية الإدارة', 'Admin role removed'));
    },
    showToast,
    seedDefaultProducts: async () => {
      const existingIds = new Set(stateRef.current.products.map((p) => p.id));
      const missingProducts = PRODUCTS_SEED.filter((p) => !existingIds.has(p.id));
      const existingCatIds = new Set(stateRef.current.categories.map((c) => c.id));
      const missingCats = CATEGORIES_SEED.filter((c) => !existingCatIds.has(c.id));
      const existingBrandIds = new Set(stateRef.current.brands.map((b) => b.id));
      const missingBrands = BRANDS_SEED.filter((b) => !existingBrandIds.has(b.id));

      if (missingProducts.length === 0 && missingCats.length === 0 && missingBrands.length === 0) {
        showToast(t('جميع المنتجات الافتراضية مضافة بالفعل', 'All default products are already present'));
        return 0;
      }

      setState((prev) => ({
        ...prev,
        categories: [...prev.categories, ...missingCats],
        brands: [...prev.brands, ...missingBrands],
        products: [...prev.products, ...missingProducts],
      }));

      const isAdminSession =
        Boolean(auth.currentUser && !auth.currentUser.isAnonymous) &&
        stateRef.current.user.role === 'admin';

      if (isAdminSession) {
        await Promise.all([
          ...missingCats.map((c) =>
            setDoc(doc(db, 'categories', c.id), stripUndefined(c)).catch((err) =>
              handleFirestoreError(err, OperationType.WRITE, `categories/${c.id}`)
            )
          ),
          ...missingBrands.map((b) =>
            setDoc(doc(db, 'brands', b.id), stripUndefined(b)).catch((err) =>
              handleFirestoreError(err, OperationType.WRITE, `brands/${b.id}`)
            )
          ),
          ...missingProducts.map((p) =>
            setDoc(doc(db, 'products', p.id), stripUndefined(p)).catch((err) =>
              handleFirestoreError(err, OperationType.WRITE, `products/${p.id}`)
            )
          ),
        ]);
      }

      try {
        localStorage.setItem(CATALOG_SEED_VERSION_KEY, CATALOG_SEED_VERSION);
      } catch {
        // Ignore quota error
      }

      showToast(
        t(
          `تمت إضافة ${missingProducts.length} منتج افتراضي إلى المتجر`,
          `Added ${missingProducts.length} default products to the catalog`
        )
      );
      return missingProducts.length;
    },
    resetDemoData: () => {
      localStorage.removeItem(STORAGE_KEY);
      localStorage.removeItem(CATALOG_SEED_VERSION_KEY);
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
