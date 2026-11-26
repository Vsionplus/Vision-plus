import { Locale } from '../types';

export interface BilingualMessage {
  ar: string;
  en: string;
}

export const VALIDATION_MESSAGES = {
  bannerCheckoutTitle: (count: number, locale: Locale): string =>
    locale === 'ar'
      ? `ينقصك ${count} بيانات لإتمام الطلب`
      : count === 1
      ? 'You are missing 1 required item to complete your order'
      : `You are missing ${count} required items to complete your order`,

  bannerFormTitle: (count: number, locale: Locale): string =>
    locale === 'ar'
      ? `ينقصك ${count} بيانات لإكمال النموذج`
      : count === 1
      ? 'You are missing 1 required field'
      : `You are missing ${count} required fields`,

  tapToScrollHint: (locale: Locale): string =>
    locale === 'ar' ? 'اضغط للانتقال للحقل' : 'Tap to jump to field',

  // Checkout / Cart
  emailVerifyRequired: {
    ar: 'يرجى تأكيد بريدك الإلكتروني أولاً قبل إتمام الطلب',
    en: 'Please verify your email address before placing your order',
  },
  addressRequired: {
    ar: 'يرجى اختيار عنوان التوصيل',
    en: 'Please select a delivery address',
  },
  deliveryStateRequired: {
    ar: 'يرجى اختيار ولاية التوصيل',
    en: 'Please select a delivery state',
  },
  phoneRequired: {
    ar: 'رقم الهاتف مطلوب',
    en: 'Phone number is required',
  },
  phoneInvalidSudan: {
    ar: 'يرجى إدخال رقم هاتف سوداني صحيح (مثل 0912345678 أو +249912345678)',
    en: 'Please enter a valid Sudan phone number (e.g. 0912345678 or +249912345678)',
  },
  paymentMethodRequired: {
    ar: 'يرجى اختيار طريقة الدفع',
    en: 'Please choose a payment method',
  },
  bankReceiptRequired: {
    ar: 'يرجى رفع صورة إيصال بنكك',
    en: 'Please upload the Bankak transfer receipt image',
  },
  bankRefRequired: {
    ar: 'يرجى كتابة رقم العملية المرجعي لتحويل بنكك',
    en: 'Please enter the Bankak transfer reference ID',
  },
  bankRefTooShort: {
    ar: 'رقم العملية المرجعي يجب أن يكون 4 أحرف/أرقام على الأقل',
    en: 'Transfer reference ID must be at least 4 characters',
  },
  lensOptionIncomplete: {
    ar: 'يرجى إكمال خيارات العدسات أو المقاس الطبي لهذا المنتج',
    en: 'Please complete the required lens options or prescription for this item',
  },
  mirrorColorRequired: {
    ar: 'يرجى اختيار لون العدسة العاكسة',
    en: 'Please choose a mirror lens color',
  },
  productSizeRequired: {
    ar: 'يرجى اختيار المقاس المطلوب قبل الإضافة للسلة',
    en: 'Please select a size / power before adding to cart',
  },
  minimumOrderNotMet: (minFormatted: string, locale: Locale): string =>
    locale === 'ar'
      ? `الحد الأدنى لإتمام الطلب هو ${minFormatted}`
      : `Minimum order total required is ${minFormatted}`,
  couponEmpty: {
    ar: 'يرجى إدخال كود الخصم أولاً',
    en: 'Please enter a coupon code first',
  },

  // Auth / Verify Email / Admin Login
  nameRequired: {
    ar: 'الاسم الكامل مطلوب',
    en: 'Full name is required',
  },
  emailRequired: {
    ar: 'البريد الإلكتروني مطلوب',
    en: 'Email address is required',
  },
  emailInvalid: {
    ar: 'يرجى إدخال بريد إلكتروني صحيح',
    en: 'Please enter a valid email address',
  },
  passwordRequired: {
    ar: 'كلمة المرور مطلوبة',
    en: 'Password is required',
  },
  passwordMinLength: {
    ar: 'كلمة المرور يجب أن تكون 6 أحرف على الأقل',
    en: 'Password must be at least 6 characters',
  },
  confirmPasswordRequired: {
    ar: 'يرجى تأكيد كلمة المرور',
    en: 'Please confirm your password',
  },
  passwordsMismatch: {
    ar: 'كلمتا المرور غير متطابقتين',
    en: 'Passwords do not match',
  },

  // Address Form
  recipientNameRequired: {
    ar: 'اسم المستلم مطلوب',
    en: 'Recipient name is required',
  },
  addressLabelRequired: {
    ar: 'تسمية العنوان مطلوبة (مثل: المنزل أو العمل)',
    en: 'Address label is required (e.g. Home or Work)',
  },
  cityRequired: {
    ar: 'يرجى إدخال المدينة أو المحلية',
    en: 'City / locality is required',
  },
  areaRequired: {
    ar: 'يرجى إدخال الحي أو المنطقة',
    en: 'Neighborhood / area is required',
  },
  streetDetailsRequired: {
    ar: 'يرجى كتابة اسم الشارع وأقرب معلم بارز',
    en: 'Street and nearest landmark details are required',
  },
  mapUrlInvalid: {
    ar: 'يرجى إدخال رابط خرائط يبدأ بـ https:// أو http://',
    en: 'Please enter a valid URL starting with https:// or http://',
  },

  // Prescription Form
  rxLabelRequired: {
    ar: 'يرجى كتابة اسم للوصفة الطبية لحفظها',
    en: 'Please enter a label for this prescription',
  },
  rxImageRequired: {
    ar: 'يرجى رفع صورة أو ملف PDF للوصفة الطبية أو اختيار طريقة أخرى',
    en: 'Please upload a prescription photo or PDF, or choose another method',
  },
  contactBoxesRequired: {
    ar: 'يرجى تحديد علبة واحدة على الأقل لإحدى العينين',
    en: 'Please select at least 1 box for either eye',
  },

  // Consult Optician Form
  consultTopicRequired: {
    ar: 'يرجى اختيار موضوع الاستشارة',
    en: 'Please select a consultation topic',
  },
  consultMessageRequired: {
    ar: 'يرجى كتابة تفاصيل استشارتك للأخصائي',
    en: 'Please describe your question for the optician',
  },

  // Admin Forms
  productTitleArRequired: {
    ar: 'اسم المنتج بالعربية مطلوب',
    en: 'Product name (AR) is required',
  },
  productCategoryRequired: {
    ar: 'يرجى اختيار تصنيف المنتج',
    en: 'Product category is required',
  },
  productPriceInvalid: {
    ar: 'يرجى إدخال سعر صحيح للمنتج أكبر من صفر',
    en: 'Please enter a valid product price greater than 0',
  },
  productStockInvalid: {
    ar: 'كمية المخزون يجب أن تكون رقماً صحيحاً (0 أو أكثر)',
    en: 'Stock must be 0 or greater',
  },
  productImageRequired: {
    ar: 'يرجى إضافة صورة واحدة على الأقل للمنتج',
    en: 'Please upload at least one product image',
  },
  categoryNameArRequired: {
    ar: 'اسم التصنيف بالعربية مطلوب',
    en: 'Category name (AR) is required',
  },
  categoryImageRequired: {
    ar: 'يرجى رفع صورة للتصنيف',
    en: 'Please upload a category image',
  },
  brandNameArRequired: {
    ar: 'اسم العلامة التجارية بالعربية مطلوب',
    en: 'Brand name (AR) is required',
  },
  bannerTitleArRequired: {
    ar: 'عنوان البانر بالعربية مطلوب',
    en: 'Banner title (AR) is required',
  },
  bannerTargetRequired: {
    ar: 'يرجى تحديد الوجهة أو الرابط للبانر',
    en: 'Please specify a target destination or URL for the banner',
  },
  bannerImageRequired: {
    ar: 'يرجى رفع صورة البانر الإعلاني',
    en: 'Please upload a banner image',
  },
  bannerDateRangeInvalid: {
    ar: 'تاريخ النهاية يجب أن يكون بعد أو يساوي تاريخ البداية',
    en: 'End date must be on or after start date',
  },
  couponCodeRequired: {
    ar: 'يرجى إدخال كود الخصم (3 أحرف على الأقل)',
    en: 'Please enter a coupon code (at least 3 characters)',
  },
  couponValueInvalid: {
    ar: 'يرجى إدخال قيمة خصم صحيحة أكبر من صفر',
    en: 'Please enter a valid discount value greater than 0',
  },
  couponPercentMax: {
    ar: 'النسبة المئوية للخصم يجب أن تكون بين 1 و 100',
    en: 'Percentage discount must be between 1 and 100',
  },
  couponMinSubInvalid: {
    ar: 'الحد الأدنى للطلب يجب أن يكون 0 أو أكثر',
    en: 'Minimum subtotal must be 0 or more',
  },
  couponLimitInvalid: {
    ar: 'حد الاستخدام يجب أن يكون 1 على الأقل',
    en: 'Usage limit must be at least 1',
  },
  couponExpiryRequired: {
    ar: 'يرجى تحديد تاريخ انتهاء الكوبون',
    en: 'Please choose an expiry date',
  },
  broadcastTitleRequired: {
    ar: 'عنوان الإشعار بالعربية مطلوب',
    en: 'Notification title (AR) is required',
  },
  broadcastBodyRequired: {
    ar: 'نص الإشعار بالعربية مطلوب',
    en: 'Notification body (AR) is required',
  },
  adminRejectNoteRequired: {
    ar: 'يرجى كتابة سبب رفض طلب الإلغاء للعميل',
    en: 'Please enter a rejection reason for the customer',
  },
  bankakAccountNameRequired: {
    ar: 'اسم صاحب حساب بنكك مطلوب',
    en: 'Bankak account name is required',
  },
  bankakAccountNumberRequired: {
    ar: 'رقم حساب بنكك مطلوب',
    en: 'Bankak account number is required',
  },
  storeNameRequired: {
    ar: 'اسم المتجر بالعربية مطلوب',
    en: 'Store name (AR) is required',
  },
} as const;

export function pickMsg(msg: BilingualMessage, locale: Locale): string {
  return locale === 'ar' ? msg.ar : msg.en;
}
