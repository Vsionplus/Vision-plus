export type Locale = 'ar' | 'en';
export type ThemeMode = 'light' | 'dark';
export type UserRole = 'customer' | 'admin' | 'staff';

export type StaffPermission =
  | 'dashboard'
  | 'products'
  | 'categories'
  | 'home_builder'
  | 'banners'
  | 'content'
  | 'appearance'
  | 'settings'
  | 'orders'
  | 'coupons'
  | 'notifications'
  | 'consults'
  | 'customers'
  | 'roles';

export type CategoryId = string;

export interface SubCategory {
  id: string;
  nameAr: string;
  nameEn: string;
  visible: boolean;
}

export interface Category {
  id: CategoryId;
  nameAr: string;
  nameEn: string;
  descriptionAr: string;
  descriptionEn: string;
  order: number;
  image: string;
  iconName?: string;
  visible: boolean;
  subcategories: SubCategory[];
}

export interface Brand {
  id: string;
  nameAr: string;
  nameEn: string;
  country: string;
  logoUrl?: string;
  visible: boolean;
}

export interface ProductVariant {
  id: string;
  colorNameAr: string;
  colorNameEn: string;
  colorHex: string;
  stock: number;
  imageUrl?: string;
  lensPower?: string;
  quantityPerBox?: number;
}

export interface ContactLensSpecs {
  type: 'daily' | 'monthly' | 'colored';
  sphOptions: string[];
  cylOptions: string[];
  axisOptions: string[];
  baseCurve: string;
  quantityPerBox: number;
}

export interface LensSolutionSpecs {
  volumeMl: number;
  expiryDate: string; // YYYY-MM-DD
}

export interface ProductReview {
  id: string;
  productId?: string;
  userId?: string;
  userName: string;
  rating: number;
  comment: string;
  status: 'approved' | 'hidden' | 'pending';
  createdAt: string;
}

export interface Product {
  id: string;
  sku: string;
  titleAr: string;
  titleEn: string;
  descriptionAr: string;
  descriptionEn: string;
  categoryId: CategoryId;
  subcategoryId?: string;
  brandId: string;
  priceSdg: number;
  oldPriceSdg?: number;
  stock: number;
  images: string[];
  gender: 'unisex' | 'men' | 'women' | 'kids';
  frameShape?: 'round' | 'square' | 'aviator' | 'cat_eye' | 'rectangle' | 'none';
  material?: 'acetate' | 'titanium' | 'metal' | 'tr90' | 'hydrogel' | 'sterile_solution' | 'leather';
  variants: ProductVariant[];
  contactLensSpecs?: ContactLensSpecs;
  lensSolutionSpecs?: LensSolutionSpecs;
  tags: string[];
  visible: boolean;
  isFeatured: boolean;
  isNewArrival: boolean;
  isOnOffer?: boolean;
  isOutOfStock?: boolean;
  isDeleted?: boolean;
  requiresPrescriptionOption?: boolean;
  rating: number;
  reviews: ProductReview[];
}

export type LensOptionType =
  | 'none'
  | 'single_vision'
  | 'progressive'
  | 'blue_light'
  | 'anti_glare'
  | 'photochromic';

export interface LensOptionConfig {
  id: LensOptionType;
  labelAr: string;
  labelEn: string;
  extraSdg: number;
  visible: boolean;
}

export interface EyePrescription {
  sph: string;
  cyl: string;
  axis: string;
}

export interface PrescriptionData {
  id?: string;
  label?: string;
  mode: 'manual' | 'image';
  rightEye?: EyePrescription;
  leftEye?: EyePrescription;
  pd?: string;
  imageUrl?: string;
  lensOption: LensOptionType;
  lensExtraPriceSdg: number;
}

export interface ContactLensSelection {
  rightSph: string;
  rightCyl?: string;
  rightAxis?: string;
  leftSph: string;
  leftCyl?: string;
  leftAxis?: string;
}

export interface CartItem {
  id: string;
  productId: string;
  variantId?: string;
  variantLabel?: string;
  quantity: number;
  unitPriceSdg: number;
  prescription?: PrescriptionData;
  contactLensSelection?: ContactLensSelection;
}

export type OrderStatus =
  | 'pending'
  | 'awaiting_payment_verification'
  | 'confirmed'
  | 'preparing'
  | 'shipped'
  | 'delivered'
  | 'cancelled';

export type PaymentMethod = 'cod' | 'bankak';

export interface OrderItem {
  productId: string;
  titleAr: string;
  titleEn: string;
  image: string;
  variantLabel?: string;
  quantity: number;
  unitPriceSdg: number;
  prescription?: PrescriptionData;
  contactLensSelection?: ContactLensSelection;
}

export interface Order {
  id: string;
  customerUid: string;
  customerName: string;
  customerPhone: string;
  stateId: string;
  city: string;
  area: string;
  addressDetails: string;
  items: OrderItem[];
  subtotalSdg: number;
  discountSdg: number;
  deliveryFeeSdg: number;
  totalSdg: number;
  couponCode?: string;
  paymentMethod: PaymentMethod;
  bankTransferReceiptUrl?: string;
  bankTransferReference?: string;
  status: OrderStatus;
  createdAt: string;
  updatedAt: string;
}

export interface BannerAd {
  id: string;
  titleAr: string;
  titleEn: string;
  subtitleAr: string;
  subtitleEn: string;
  ctaAr: string;
  ctaEn: string;
  image: string;
  placement: 'home_top' | 'home_middle';
  targetType: 'product' | 'category' | 'url' | 'consult';
  targetValue: string;
  order: number;
  isActive: boolean;
  startDate: string;
  endDate: string;
}

export interface Coupon {
  code: string;
  type: 'percent' | 'fixed';
  value: number;
  minSubtotalSdg: number;
  usageLimit: number;
  usedCount: number;
  isActive: boolean;
  expiryDate: string;
}

export interface AppNotification {
  id: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
  imageUrl?: string;
  segment?: 'all' | 'khartoum' | 'states' | 'vip';
  isRead: boolean;
  createdAt: string;
  deepLinkType?: 'order' | 'product' | 'category' | 'consult' | 'url';
  deepLinkId?: string;
}

export type ConsultTopic = string;

export interface ConsultTopicConfig {
  id: string;
  labelAr: string;
  labelEn: string;
  visible: boolean;
}

export interface ConsultMessage {
  id: string;
  sender: 'customer' | 'optician';
  senderName: string;
  text: string;
  imageUrl?: string;
  createdAt: string;
}

export interface ConsultRequest {
  id: string;
  customerUid: string;
  customerName: string;
  phone: string;
  topic: ConsultTopic;
  status: 'open' | 'answered' | 'closed';
  messages: ConsultMessage[];
  createdAt: string;
  updatedAt: string;
}

export interface SudanStateFee {
  id: string;
  nameAr: string;
  nameEn: string;
  feeSdg: number;
}

export interface SocialLinkItem {
  url: string;
  visible: boolean;
}

export interface SocialLinks {
  facebook: SocialLinkItem;
  instagram: SocialLinkItem;
  whatsapp: SocialLinkItem;
  tiktok: SocialLinkItem;
  telegram: SocialLinkItem;
  snapchat: SocialLinkItem;
  youtube: SocialLinkItem;
  x: SocialLinkItem;
}

export type HomeSectionType =
  | 'announcement'
  | 'banners'
  | 'categories'
  | 'consult_card'
  | 'featured'
  | 'new_arrivals'
  | 'offers'
  | 'mid_banner';

export interface HomeSectionConfig {
  id: HomeSectionType;
  enabled: boolean;
  order: number;
  titleAr: string;
  titleEn: string;
  subtitleAr?: string;
  subtitleEn?: string;
  ctaAr?: string;
  ctaEn?: string;
  styleVariant: 'default' | 'compact' | 'highlight';
}

export interface FaqItem {
  id: string;
  questionAr: string;
  questionEn: string;
  answerAr: string;
  answerEn: string;
  visible: boolean;
}

export interface OnboardingSlide {
  id: string;
  titleAr: string;
  titleEn: string;
  bodyAr: string;
  bodyEn: string;
}

export interface AppTextsConfig {
  splashTextAr: string;
  splashTextEn: string;
  welcomeLineAr: string;
  welcomeLineEn: string;
  announcementTextAr: string;
  announcementTextEn: string;
  searchPlaceholderAr: string;
  searchPlaceholderEn: string;
  consultCardTitleAr: string;
  consultCardTitleEn: string;
  consultCardDescAr: string;
  consultCardDescEn: string;
  consultCardCtaAr: string;
  consultCardCtaEn: string;
  aboutUsAr: string;
  aboutUsEn: string;
  privacyPolicyAr: string;
  privacyPolicyEn: string;
  termsConditionsAr: string;
  termsConditionsEn: string;
  returnPolicyAr: string;
  returnPolicyEn: string;
  emptyCartTitleAr: string;
  emptyCartTitleEn: string;
  emptyCartDescAr: string;
  emptyCartDescEn: string;
  emptyOrdersAr: string;
  emptyOrdersEn: string;
  emptyFavoritesAr: string;
  emptyFavoritesEn: string;
  emptyCatalogAr: string;
  emptyCatalogEn: string;
  btnAddToCartAr: string;
  btnAddToCartEn: string;
  btnStartShoppingAr: string;
  btnStartShoppingEn: string;
  btnCheckoutAr: string;
  btnCheckoutEn: string;
  btnOutOfStockAr: string;
  btnOutOfStockEn: string;
  faq: FaqItem[];
  onboarding: OnboardingSlide[];
}

export interface AppAppearanceConfig {
  appNameAr: string;
  appNameEn: string;
  wordmarkText: string;
  logoUrl: string;
  splashImageUrl: string;
  primaryColor: string;
  secondaryColor: string;
  defaultTheme: ThemeMode;
}

export interface ContactVisibility {
  phone: boolean;
  whatsapp: boolean;
  email: boolean;
  address: boolean;
  workingHours: boolean;
}

export interface StoreSettings {
  storeNameAr: string;
  storeNameEn: string;
  phone: string;
  whatsapp: string;
  email: string;
  addressAr: string;
  addressEn: string;
  mapUrl: string;
  workingHoursAr: string;
  workingHoursEn: string;
  contactVisibility: ContactVisibility;
  bankakAccountName: string;
  bankakAccountNumber: string;
  bankakBranchAr: string;
  otherBankDetailsAr: string;
  minimumOrderSdg: number;
  maintenanceMode: boolean;
  maintenanceMessageAr: string;
  maintenanceMessageEn: string;
  socialLinks: SocialLinks;
  deliveryFees: SudanStateFee[];
}

export interface SavedAddress {
  id: string;
  label: string;
  stateId: string;
  city: string;
  area: string;
  details: string;
  phone: string;
}

export interface SavedPrescription {
  id: string;
  label: string;
  rightEye: EyePrescription;
  leftEye: EyePrescription;
  pd: string;
  savedAt: string;
}

export interface AppUser {
  uid: string;
  name: string;
  email: string;
  phone: string;
  role: UserRole;
  permissions?: StaffPermission[];
  isBlocked?: boolean;
  createdAt?: string;
  favoriteProductIds: string[];
  addresses: SavedAddress[];
  prescriptions: SavedPrescription[];
}
