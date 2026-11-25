import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  CreditCard,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  MailWarning,
  MapPin,
  MessageCircle,
  Plus,
  RefreshCw,
  Send,
  ShoppingBag,
  Tag,
  Trash2,
  Truck,
  Upload,
  X,
} from 'lucide-react';
import { compressImageFileToBlob } from '../lib/firebase';
import { useStore } from '../store/StoreContext';
import {
  CartItem,
  OrderAddressSnapshot,
  PaymentMethod,
  Product,
  SavedAddress,
} from '../types';
import { formatSdg } from '../utils/format';
import {
  MIRROR_COLOR_OPTIONS,
  calculateLensPricingBreakdown,
  formatLensSummaryLine,
  getExtraOptionLabel,
  getMirrorColorLabel,
  getVisionTypeLabel,
  hasCustomLensOrRx,
  isPrescriptionEligibleProduct,
  resolveExtraOptions,
  resolveVisionType,
} from '../utils/prescription';
import { ResilientImage } from './ResilientImage';
import { PrescriptionSheet } from './PrescriptionSheet';
import { AddressSheet } from './AddressSheet';

export const CartCheckoutView: React.FC = () => {
  const {
    locale,
    t,
    cart,
    products,
    categories,
    lensOptions,
    coupons,
    settings,
    appTexts,
    appearance,
    user,
    isGuest,
    isEmailVerified,
    setActiveTab,
    openProduct,
    openAuthModal,
    openVerifyEmailScreen,
    resendVerificationEmail,
    refreshEmailVerification,
    updateCartQty,
    updateCartItemPrescription,
    removeFromCart,
    placeOrder,
    openCatalog,
    showToast,
  } = useStore();

  const [couponInput, setCouponInput] = useState('');
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(null);

  const [expandedItemIds, setExpandedItemIds] = useState<Record<string, boolean>>({});
  const [editingRxTarget, setEditingRxTarget] = useState<{
    cartItem: CartItem;
    product: Product;
  } | null>(null);
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);

  const [selectedAddress, setSelectedAddress] = useState<SavedAddress | null>(null);
  const [addressSheetOpen, setAddressSheetOpen] = useState(false);
  const [editingAddress, setEditingAddress] = useState<SavedAddress | null>(null);

  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bankak');
  const [bankRef, setBankRef] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');
  const [customerNote, setCustomerNote] = useState('');
  const [reviewModalOpen, setReviewModalOpen] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const [resendCooldown, setResendCooldown] = useState(0);
  const [resending, setResending] = useState(false);
  const [checkingVerify, setCheckingVerify] = useState(false);
  const [verifyNotice, setVerifyNotice] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedAddress) {
      const def = user.addresses.find((a) => a.isDefault);
      if (def) setSelectedAddress(def);
      return;
    }
    const updated = user.addresses.find((a) => a.id === selectedAddress.id);
    if (updated) {
      setSelectedAddress(updated);
    }
  }, [user.addresses, selectedAddress]);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const timer = window.setInterval(() => {
      setResendCooldown((prev) => (prev <= 1 ? 0 : prev - 1));
    }, 1000);
    return () => window.clearInterval(timer);
  }, [resendCooldown]);

  const toggleExpandItem = (id: string) => {
    setExpandedItemIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const totalUnitsCount = useMemo(
    () => cart.reduce((sum, item) => sum + item.quantity, 0),
    [cart]
  );

  const itemsSubtotalSdg = useMemo(
    () => cart.reduce((sum, item) => sum + item.unitPriceSdg * item.quantity, 0),
    [cart]
  );

  const lensOptionsTotalSdg = useMemo(
    () =>
      cart.reduce(
        (sum, item) => sum + (item.prescription?.lensExtraPriceSdg || 0) * item.quantity,
        0
      ),
    [cart]
  );

  const subtotalSdg = itemsSubtotalSdg + lensOptionsTotalSdg;

  const today = new Date().toISOString().slice(0, 10);

  const activeCoupon = useMemo(
    () =>
      coupons.find(
        (c) =>
          c.code === appliedCouponCode &&
          c.isActive &&
          c.expiryDate >= today &&
          c.usedCount < c.usageLimit
      ) || null,
    [coupons, appliedCouponCode, today]
  );

  const discountSdg = useMemo(() => {
    if (!activeCoupon || subtotalSdg < activeCoupon.minSubtotalSdg) return 0;
    if (activeCoupon.type === 'percent') return Math.round((subtotalSdg * activeCoupon.value) / 100);
    return Math.min(subtotalSdg, activeCoupon.value);
  }, [activeCoupon, subtotalSdg]);

  const selectedState = useMemo(() => {
    if (!selectedAddress?.stateId) return null;
    return settings.deliveryFees.find((s) => s.id === selectedAddress.stateId) || null;
  }, [selectedAddress, settings.deliveryFees]);

  const deliveryFeeSdg = selectedState ? selectedState.feeSdg : 0;
  const totalSdg = Math.max(0, subtotalSdg - discountSdg + deliveryFeeSdg);

  const requiresEmailVerification = !isGuest && !isEmailVerified;

  const handleApplyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    const found = coupons.find((c) => c.code === code && c.isActive);
    if (!found) {
      showToast(t('كود الخصم غير صالح أو متوقف', 'Invalid or inactive coupon code'));
      return;
    }
    if (found.expiryDate < today) {
      showToast(t('انتهت صلاحية كود الخصم', 'Coupon expired'));
      return;
    }
    if (found.usedCount >= found.usageLimit) {
      showToast(t('تم استنفاد الحد الأقصى لاستخدام الكود', 'Coupon usage limit reached'));
      return;
    }
    if (subtotalSdg < found.minSubtotalSdg) {
      showToast(
        t(
          `الحد الأدنى لاستخدام الكود ${formatSdg(found.minSubtotalSdg)}`,
          `Minimum subtotal required: ${formatSdg(found.minSubtotalSdg)}`
        )
      );
      return;
    }
    setAppliedCouponCode(found.code);
    showToast(t('تم تطبيق كود الخصم بنجاح', 'Coupon applied'));
  };

  const handleReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const { dataUrl } = await compressImageFileToBlob(file, 1000, 0.78);
      if (dataUrl) setReceiptUrl(dataUrl);
    } catch {
      const reader = new FileReader();
      reader.onload = () => {
        if (typeof reader.result === 'string') setReceiptUrl(reader.result);
      };
      reader.readAsDataURL(file);
    }
  };

  const handleResendClick = async () => {
    if (resendCooldown > 0) return;
    setVerifyNotice(null);
    setResending(true);
    try {
      await resendVerificationEmail();
      setResendCooldown(60);
      setVerifyNotice(
        t(
          'تم إرسال رابط التحقق إلى بريدك الإلكتروني. تحقق من البريد الوارد ومجلد Spam.',
          'Verification link sent. Check your inbox and Spam folder.'
        )
      );
    } catch (err) {
      setVerifyNotice(
        err instanceof Error ? err.message : t('تعذر إعادة إرسال الرابط', 'Could not resend link')
      );
    } finally {
      setResending(false);
    }
  };

  const handleRefreshVerified = async () => {
    setVerifyNotice(null);
    setCheckingVerify(true);
    try {
      const ok = await refreshEmailVerification(false);
      if (!ok) {
        setVerifyNotice(
          t(
            'لم يتم تأكيد البريد الإلكتروني بعد. اضغط على الرابط في رسالتك أولاً.',
            'Email is not verified yet. Please tap the verification link first.'
          )
        );
      }
    } catch (err) {
      setVerifyNotice(err instanceof Error ? err.message : t('تعذر التحقق', 'Check failed'));
    } finally {
      setCheckingVerify(false);
    }
  };

  const validateCheckoutReady = (): boolean => {
    if (isGuest) {
      openAuthModal('choice', true);
      return false;
    }

    if (!isEmailVerified) {
      showToast(
        t('يجب تأكيد بريدك الإلكتروني قبل إتمام الطلب', 'Verify your email before placing an order')
      );
      return false;
    }

    if (!selectedAddress || !selectedState) {
      showToast(
        t('يرجى إضافة أو اختيار عنوان التوصيل أولاً', 'Please add or select a delivery address')
      );
      return false;
    }

    if (settings.minimumOrderSdg > 0 && subtotalSdg < settings.minimumOrderSdg) {
      showToast(
        t(
          `الحد الأدنى للطلب هو ${formatSdg(settings.minimumOrderSdg)}`,
          `Minimum order is ${formatSdg(settings.minimumOrderSdg)}`
        )
      );
      return false;
    }

    if (paymentMethod === 'bankak' && !receiptUrl && !bankRef.trim()) {
      showToast(
        t(
          'يرجى رفع صورة إيصال بنكك أو كتابة رقم العملية المرجعي',
          'Upload Bankak receipt screenshot or enter reference ID'
        )
      );
      return false;
    }

    return true;
  };

  const handleOpenOrderReview = (e: React.FormEvent) => {
    e.preventDefault();
    if (!validateCheckoutReady()) return;
    setReviewModalOpen(true);
  };

  const handleConfirmPlaceOrder = async () => {
    if (submitting || !validateCheckoutReady() || !selectedAddress || !selectedState) return;

    const addressSnapshot: OrderAddressSnapshot = {
      id: selectedAddress.id,
      label: selectedAddress.label,
      recipientName: selectedAddress.recipientName || user.name,
      phone: selectedAddress.phone || user.phone,
      stateId: selectedAddress.stateId,
      stateNameAr: selectedState.nameAr,
      stateNameEn: selectedState.nameEn,
      city: selectedAddress.city,
      area: selectedAddress.area,
      details: selectedAddress.details,
      mapUrl: selectedAddress.mapUrl,
      isDefault: selectedAddress.isDefault,
    };

    setSubmitting(true);
    try {
      await placeOrder({
        customerName: addressSnapshot.recipientName,
        customerPhone: addressSnapshot.phone,
        stateId: selectedAddress.stateId,
        city: selectedAddress.city,
        area: selectedAddress.area,
        addressDetails: selectedAddress.details,
        address: addressSnapshot,
        paymentMethod,
        couponCode: activeCoupon?.code,
        discountSdg,
        deliveryFeeSdg,
        bankTransferReference: bankRef.trim() || undefined,
        bankTransferReceiptUrl: receiptUrl || undefined,
        customerNote: customerNote.trim() || undefined,
      });
      setReviewModalOpen(false);
    } catch {
      showToast(
        t(
          'تعذر حفظ الطلب في الخادم. تأكد من تأكيد بريدك الإلكتروني واتصال الشبكة.',
          'Could not save order. Please ensure your email is verified and retry.'
        )
      );
    } finally {
      setSubmitting(false);
    }
  };

  if (cart.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-5">
        <div className="w-20 h-20 rounded-2xl bg-[#11223E] text-[#D9B24C] mx-auto flex items-center justify-center shadow-lg">
          <ShoppingBag className="w-9 h-9" />
        </div>
        <div className="space-y-2">
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#11223E] dark:text-white">
            {locale === 'ar' ? appTexts.emptyCartTitleAr : appTexts.emptyCartTitleEn}
          </h1>
          <p className="text-sm text-slate-500 dark:text-slate-400 max-w-md mx-auto">
            {locale === 'ar' ? appTexts.emptyCartDescAr : appTexts.emptyCartDescEn}
          </p>
        </div>
        <button
          type="button"
          onClick={() => openCatalog('all', '')}
          className="min-h-[48px] px-7 py-3 rounded-2xl bg-[#11223E] text-white dark:bg-[#D9B24C] dark:text-[#11223E] text-sm font-extrabold inline-flex items-center gap-2 shadow-md hover:opacity-95 transition-opacity"
        >
          <span>{locale === 'ar' ? appTexts.btnStartShoppingAr : appTexts.btnStartShoppingEn}</span>
          {locale === 'ar' ? <ArrowLeft className="w-4 h-4" /> : <ArrowRight className="w-4 h-4" />}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-5 pb-8 space-y-6">
      {/* Cart Page Header */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="w-11 h-11 rounded-xl bg-[#11223E] text-[#D9B24C] flex items-center justify-center shrink-0">
            <ShoppingBag className="w-5 h-5" />
          </div>
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold text-[#11223E] dark:text-white">
              {t('سلة التسوق وإتمام الطلب', 'Cart & Checkout')}
            </h1>
            <p className="text-xs text-slate-500 dark:text-slate-400 font-medium">
              {t(`${totalUnitsCount} قطعة في سلتك`, `${totalUnitsCount} items in your bag`)}
            </p>
          </div>
        </div>

        <button
          type="button"
          onClick={() => openCatalog('all', '')}
          className="min-h-[42px] px-3.5 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] text-xs font-bold text-[#11223E] dark:text-slate-200 hover:border-[#D9B24C] transition-colors inline-flex items-center gap-1.5"
        >
          <span>{t('مواصلة التسوق', 'Continue Shopping')}</span>
        </button>
      </div>

      {/* Guest Checkout Informational Banner (dialog triggers on Proceed to Checkout) */}
      {isGuest && (
        <div className="rounded-2xl border border-amber-300 dark:border-amber-800/70 bg-amber-50/90 dark:bg-amber-950/25 p-4 text-xs sm:text-sm font-bold text-[#11223E] dark:text-amber-200">
          {t(
            'أنت تتصفح كضيف — اضغط على "إتمام الطلب" بالأسفل لتسجيل الدخول أو إنشاء حساب وإكمال الشراء مع حفظ سلتك.',
            'You are browsing as a guest — tap "Proceed to Checkout" below to sign in or register while keeping your cart.'
          )}
        </div>
      )}

      {/* Unverified Email Gate Banner */}
      {requiresEmailVerification && (
        <div className="rounded-2xl border-2 border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30 p-5 space-y-3">
          <div className="flex items-start gap-3">
            <MailWarning className="w-6 h-6 text-rose-600 dark:text-rose-400 shrink-0 mt-0.5" />
            <div className="space-y-1">
              <h2 className="text-sm sm:text-base font-extrabold text-rose-800 dark:text-rose-200">
                {t('يجب تأكيد بريدك الإلكتروني قبل إتمام الطلب', 'You must verify your email before placing an order')}
              </h2>
              <p className="text-xs text-rose-700 dark:text-rose-300">
                {t(
                  `أرسلنا رابط التحقق إلى (${user.email}). افتح الرسالة واضغط الرابط ثم اضغط "لقد تحققت، تحديث".`,
                  `Check (${user.email}) and Spam folder for the verification link.`
                )}
              </p>
              {verifyNotice && (
                <p className="text-xs font-bold text-[#11223E] dark:text-amber-300 pt-1">{verifyNotice}</p>
              )}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              disabled={checkingVerify}
              onClick={handleRefreshVerified}
              style={{ backgroundColor: appearance.secondaryColor, color: appearance.primaryColor }}
              className="min-h-[44px] px-4 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 disabled:opacity-60"
            >
              <RefreshCw className={`w-4 h-4 ${checkingVerify ? 'animate-spin' : ''}`} />
              {t('لقد تحققت، تحديث', 'I Verified, Refresh')}
            </button>

            <button
              type="button"
              disabled={resending || resendCooldown > 0}
              onClick={handleResendClick}
              style={{ backgroundColor: appearance.primaryColor }}
              className="min-h-[44px] px-4 rounded-xl text-white text-xs font-bold inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Send className="w-4 h-4" />
              {resendCooldown > 0
                ? t(`إعادة إرسال الرابط (${resendCooldown} ث)`, `Resend (${resendCooldown}s)`)
                : resending
                ? t('جارٍ الإرسال...', 'Sending...')
                : t('إعادة إرسال الرابط', 'Resend Link')}
            </button>

            <button
              type="button"
              onClick={openVerifyEmailScreen}
              className="min-h-[44px] px-4 rounded-xl border border-rose-300 dark:border-rose-800 bg-white dark:bg-[#131C2E] text-xs font-bold"
            >
              {t('تغيير البريد / صفحة التأكيد', 'Change Email / Verify Screen')}
            </button>
          </div>
        </div>
      )}

      <form onSubmit={handleOpenOrderReview} className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Left/Right Column: Cart Item Cards & Optician Help & Payment Method */}
        <div className="lg:col-span-7 space-y-4">
          {cart.map((item) => {
            const prod = products.find((p) => p.id === item.productId);
            if (!prod) return null;

            const lensExtra = item.prescription?.lensExtraPriceSdg || 0;
            const unitTotal = item.unitPriceSdg + lensExtra;
            const lineTotal = unitTotal * item.quantity;
            const isExpanded = Boolean(expandedItemIds[item.id]);
            const isRxEligible = isPrescriptionEligibleProduct(prod, categories);
            const rx = item.prescription;
            const hasCustomLens = hasCustomLensOrRx(rx);
            const hasRxValues = Boolean(rx && rx.type !== 'none');
            const itemVisionType = resolveVisionType(rx);
            const itemExtras = resolveExtraOptions(rx);
            const itemPricing = calculateLensPricingBreakdown(
              itemVisionType,
              itemExtras,
              lensOptions
            );
            const effectiveVisionPrice =
              rx?.visionTypePriceSdg ?? itemPricing.visionTypePriceSdg;
            const mirrorMeta = rx?.mirrorColor
              ? MIRROR_COLOR_OPTIONS.find((m) => m.id === rx.mirrorColor)
              : undefined;
            const lensSummaryLine = formatLensSummaryLine(rx, lensOptions, locale);
            const matchedVariant = prod.variants.find((v) => v.id === item.variantId);
            const itemImage = matchedVariant?.imageUrl || prod.images[0];

            return (
              <div
                key={item.id}
                className="rounded-2xl bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 p-4 space-y-3 shadow-xs"
              >
                <div className="flex gap-3.5 sm:gap-4">
                  <button
                    type="button"
                    onClick={() => openProduct(prod.id)}
                    className="w-20 h-20 sm:w-24 sm:h-24 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 shrink-0 border border-slate-200/75 dark:border-slate-800"
                  >
                    <ResilientImage
                      src={itemImage}
                      alt={locale === 'ar' ? prod.titleAr : prod.titleEn}
                      className="w-full h-full object-cover"
                    />
                  </button>

                  <div className="flex-1 min-w-0 space-y-1.5">
                    <div className="flex items-start justify-between gap-2">
                      <button
                        type="button"
                        onClick={() => openProduct(prod.id)}
                        className="text-start text-sm sm:text-base font-extrabold text-[#11223E] dark:text-white hover:text-[#B38B2D] transition-colors line-clamp-2"
                      >
                        {locale === 'ar' ? prod.titleAr : prod.titleEn}
                      </button>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="text-slate-400 hover:text-rose-600 min-w-[40px] min-h-[40px] flex items-center justify-center rounded-xl hover:bg-rose-50 dark:hover:bg-rose-950/30 shrink-0 transition-colors"
                        aria-label={t('حذف', 'Remove')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {item.variantLabel && (
                      <div className="inline-flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {matchedVariant?.colorHex && (
                          <span
                            className="w-3 h-3 rounded-full border border-black/15 shrink-0"
                            style={{ backgroundColor: matchedVariant.colorHex }}
                          />
                        )}
                        <span>{item.variantLabel}</span>
                      </div>
                    )}

                    {/* Quantity stepper & price */}
                    <div className="pt-1 flex flex-wrap items-center justify-between gap-2">
                      <div className="inline-flex items-center rounded-xl bg-slate-100 dark:bg-slate-900 border border-slate-200 dark:border-slate-800">
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.id, -1)}
                          className="min-w-[40px] min-h-[40px] text-sm font-bold hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-s-xl"
                          aria-label={t('إنقاص', 'Decrease')}
                        >
                          −
                        </button>
                        <span className="px-3 font-mono-num text-xs font-extrabold tabular-nums">
                          {item.quantity}
                        </span>
                        <button
                          type="button"
                          onClick={() => updateCartQty(item.id, 1)}
                          className="min-w-[40px] min-h-[40px] text-sm font-bold hover:bg-slate-200/70 dark:hover:bg-slate-800 rounded-e-xl"
                          aria-label={t('زيادة', 'Increase')}
                        >
                          +
                        </button>
                      </div>

                      <div className="text-end">
                        <span className="font-mono-num text-base font-extrabold text-[#11223E] dark:text-[#E2BD5B] tabular-nums">
                          {formatSdg(lineTotal)}
                        </span>
                        {lensExtra > 0 && (
                          <span className="block text-[10px] font-semibold text-emerald-700 dark:text-emerald-400 font-mono-num">
                            {t('شامل العدسات', 'Incl. lenses')} (+{formatSdg(lensExtra)})
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                </div>

                {/* Compact Prescription & Details Action Strip */}
                <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                  <div className="flex flex-wrap items-center gap-2 min-w-0">
                    {isRxEligible && (
                      <button
                        type="button"
                        onClick={() => setEditingRxTarget({ cartItem: item, product: prod })}
                        className="min-h-[38px] px-3 rounded-xl bg-slate-100 dark:bg-slate-900 hover:border-[#D9B24C] border border-slate-200/80 dark:border-slate-700 font-bold text-[#11223E] dark:text-slate-200 inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Eye className="w-3.5 h-3.5 text-[#B38B2D]" />
                        <span>
                          {hasCustomLens
                            ? t('تعديل المقاس / العدسات', 'Edit Rx / Lenses')
                            : t('إضافة مقاس (اختياري)', 'Add Rx (Optional)')}
                        </span>
                      </button>
                    )}

                    {lensSummaryLine && (
                      <span className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 truncate max-w-[220px] sm:max-w-xs">
                        {lensSummaryLine}
                      </span>
                    )}
                  </div>

                  <button
                    type="button"
                    onClick={() => toggleExpandItem(item.id)}
                    className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold inline-flex items-center gap-1 text-slate-600 dark:text-slate-300 hover:border-[#D9B24C] transition-colors ms-auto"
                  >
                    <span>{isExpanded ? t('إخفاء التفاصيل', 'Hide Details') : t('عرض التفاصيل', 'Show Details')}</span>
                    {isExpanded ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>

                {isExpanded && (
                  <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/75 border border-slate-200/80 dark:border-slate-800 space-y-3 text-xs">
                    {/* Price Breakdown */}
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 pb-2.5 border-b border-slate-200 dark:border-slate-800">
                      <div>
                        <span className="text-[11px] text-slate-500 block">{t('سعر الوحدة', 'Unit Price')}</span>
                        <span className="font-mono-num font-bold">{formatSdg(item.unitPriceSdg)}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 block">{t('إضافات العدسات', 'Lens Extra')}</span>
                        <span className="font-mono-num font-bold">
                          {lensExtra > 0 ? `+${formatSdg(lensExtra)}` : t('مجاني', 'Free')}
                        </span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 block">{t('الكمية', 'Qty')}</span>
                        <span className="font-mono-num font-bold">{item.quantity}</span>
                      </div>
                      <div>
                        <span className="text-[11px] text-slate-500 block">{t('الإجمالي', 'Line Total')}</span>
                        <span className="font-mono-num font-extrabold text-[#B38B2D]">{formatSdg(lineTotal)}</span>
                      </div>
                    </div>

                    {/* Vision Type + Extra Options */}
                    {(itemVisionType !== 'none' || itemExtras.length > 0) && (
                      <div className="p-3 rounded-xl bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-700 space-y-1.5 text-[11px]">
                        {itemVisionType !== 'none' && (
                          <div className="flex items-center justify-between gap-2">
                            <span>
                              <span className="text-slate-500">{t('نوع الرؤية:', 'Vision Type:')}</span>{' '}
                              <strong className="text-[#11223E] dark:text-[#E2BD5B]">
                                {getVisionTypeLabel(itemVisionType, lensOptions, locale)}
                              </strong>
                            </span>
                            <span className="font-mono-num font-bold">
                              {effectiveVisionPrice > 0
                                ? `+${formatSdg(effectiveVisionPrice)}`
                                : t('مجاني', 'Free')}
                            </span>
                          </div>
                        )}

                        {itemExtras.map((extId) => {
                          const extPrice =
                            rx?.extraOptionsPricesSdg?.[extId] ??
                            itemPricing.extraOptionsPricesSdg[extId] ??
                            0;
                          return (
                            <div key={extId} className="flex items-center justify-between gap-2">
                              <span className="inline-flex items-center gap-1.5 flex-wrap">
                                <span>+ {getExtraOptionLabel(extId, lensOptions, locale)}</span>
                                {extId === 'mirror' && rx?.mirrorColor && (
                                  <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-slate-100 dark:bg-slate-800 font-bold">
                                    {mirrorMeta && (
                                      <span
                                        className="w-2.5 h-2.5 rounded-full border border-black/20"
                                        style={{ backgroundColor: mirrorMeta.swatchHex }}
                                      />
                                    )}
                                    {getMirrorColorLabel(rx.mirrorColor, locale)}
                                  </span>
                                )}
                              </span>
                              <span className="font-mono-num font-bold">
                                {extPrice > 0 ? `+${formatSdg(extPrice)}` : t('مجاني', 'Free')}
                              </span>
                            </div>
                          );
                        })}
                      </div>
                    )}

                    {/* Prescription Table / Thumbnail / Later */}
                    {hasCustomLens && rx ? (
                      <div className="space-y-2.5">
                        {hasRxValues && rx.type === 'manual' && rx.values?.kind === 'contact_lenses' && (
                          <div className="overflow-x-auto">
                            <table className="w-full text-[11px] font-mono-num border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-[#131C2E]">
                              <thead className="bg-slate-100 dark:bg-slate-800 font-bold">
                                <tr>
                                  <th className="p-2 text-start">{t('العين', 'Eye')}</th>
                                  <th className="p-2">SPH</th>
                                  <th className="p-2">CYL</th>
                                  <th className="p-2">AXIS</th>
                                  <th className="p-2">BC</th>
                                  <th className="p-2">DIA</th>
                                  <th className="p-2">{t('العلب', 'Boxes')}</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                {rx.values.contactRight && (
                                  <tr>
                                    <td className="p-2 font-bold">OD ({t('يمين', 'R')})</td>
                                    <td className="p-2 text-center">{rx.values.contactRight.sph}</td>
                                    <td className="p-2 text-center">{rx.values.contactRight.cyl}</td>
                                    <td className="p-2 text-center">{rx.values.contactRight.axis}°</td>
                                    <td className="p-2 text-center">{rx.values.contactRight.bc}</td>
                                    <td className="p-2 text-center">{rx.values.contactRight.dia}</td>
                                    <td className="p-2 text-center">{rx.values.contactRight.boxes}</td>
                                  </tr>
                                )}
                                {rx.values.contactLeft && (
                                  <tr>
                                    <td className="p-2 font-bold">OS ({t('يسار', 'L')})</td>
                                    <td className="p-2 text-center">{rx.values.contactLeft.sph}</td>
                                    <td className="p-2 text-center">{rx.values.contactLeft.cyl}</td>
                                    <td className="p-2 text-center">{rx.values.contactLeft.axis}°</td>
                                    <td className="p-2 text-center">{rx.values.contactLeft.bc}</td>
                                    <td className="p-2 text-center">{rx.values.contactLeft.dia}</td>
                                    <td className="p-2 text-center">{rx.values.contactLeft.boxes}</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                          </div>
                        )}

                        {hasRxValues && rx.type === 'manual' && rx.values?.kind !== 'contact_lenses' && rx.rightEye && (
                          <div className="space-y-1.5 overflow-x-auto">
                            <table className="w-full text-[11px] font-mono-num border border-slate-200 dark:border-slate-700 rounded-xl overflow-hidden bg-white dark:bg-[#131C2E]">
                              <thead className="bg-slate-100 dark:bg-slate-800 font-bold">
                                <tr>
                                  <th className="p-2 text-start">{t('العين', 'Eye')}</th>
                                  <th className="p-2">SPH</th>
                                  <th className="p-2">CYL</th>
                                  <th className="p-2">AXIS</th>
                                  <th className="p-2">ADD</th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-slate-100 dark:divide-slate-800">
                                <tr>
                                  <td className="p-2 font-bold">OD ({t('يمين', 'Right')})</td>
                                  <td className="p-2 text-center">{rx.rightEye.sph}</td>
                                  <td className="p-2 text-center">{rx.rightEye.cyl}</td>
                                  <td className="p-2 text-center">{rx.rightEye.axis}°</td>
                                  <td className="p-2 text-center">{rx.rightEye.add || '—'}</td>
                                </tr>
                                {rx.leftEye && (
                                  <tr>
                                    <td className="p-2 font-bold">OS ({t('يسار', 'Left')})</td>
                                    <td className="p-2 text-center">{rx.leftEye.sph}</td>
                                    <td className="p-2 text-center">{rx.leftEye.cyl}</td>
                                    <td className="p-2 text-center">{rx.leftEye.axis}°</td>
                                    <td className="p-2 text-center">{rx.leftEye.add || '—'}</td>
                                  </tr>
                                )}
                              </tbody>
                            </table>
                            {(rx.pd || rx.pdRight) && (
                              <div className="font-mono-num text-[11px] text-slate-600 dark:text-slate-300">
                                PD:{' '}
                                <strong>
                                  {rx.pdMode === 'dual' && rx.pdRight
                                    ? `OD ${rx.pdRight} mm / OS ${rx.pdLeft} mm`
                                    : `${rx.pd} mm`}
                                </strong>
                              </div>
                            )}
                            {rx.fittingHeight && (
                              <div className="font-mono-num text-[11px] text-slate-600 dark:text-slate-300">
                                {t('ارتفاع التركيب (Fitting Height):', 'Fitting Height:')}{' '}
                                <strong>{rx.fittingHeight} mm</strong>
                              </div>
                            )}
                          </div>
                        )}

                        {rx.type === 'image' && rx.imageUrl && (
                          <div className="flex items-center gap-3">
                            <button
                              type="button"
                              onClick={() => setLightboxImage(rx.imageUrl || null)}
                              className="group relative rounded-xl overflow-hidden border border-slate-200 dark:border-slate-700"
                            >
                              <img
                                src={rx.imageUrl}
                                alt={t('صورة الروشتة', 'Rx photo')}
                                className="h-20 w-24 object-cover group-hover:opacity-85"
                              />
                              <span className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] py-0.5 text-center">
                                {t('اضغط للتكبير', 'Tap to enlarge')}
                              </span>
                            </button>
                          </div>
                        )}

                        {rx.type === 'later' && (
                          <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800 text-[#11223E] dark:text-amber-200 font-bold">
                            <MessageCircle className="w-3.5 h-3.5 text-emerald-600" />
                            <span>
                              {t(
                                'لا أعرف مقاسي — سيتواصل معي فريق البصريات لتأكيد المقاس',
                                'Optician team will contact you to confirm prescription'
                              )}
                            </span>
                          </div>
                        )}

                        {rx.type === 'none' && (
                          <div className="text-[11px] text-slate-500 dark:text-slate-400">
                            {t('تم حفظ خيارات العدسة بدون إدخال مقاس نظر', 'Lens options saved without Rx values')}
                          </div>
                        )}

                        {rx.notes && (
                          <p className="text-[11px] text-slate-600 dark:text-slate-400">
                            <strong>{t('ملاحظات:', 'Notes:')}</strong> {rx.notes}
                          </p>
                        )}

                        <div className="flex flex-wrap items-center gap-2 pt-1">
                          <button
                            type="button"
                            onClick={() => setEditingRxTarget({ cartItem: item, product: prod })}
                            className="min-h-[40px] px-3.5 rounded-xl bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-700 font-bold inline-flex items-center gap-1.5"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            {t('تعديل المقاس', 'Edit Prescription')}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateCartItemPrescription(item.id, undefined)}
                            className="min-h-[40px] px-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 font-bold inline-flex items-center gap-1.5"
                          >
                            <Trash2 className="w-3.5 h-3.5" />
                            {t('حذف المقاس', 'Delete Prescription')}
                          </button>
                        </div>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="text-slate-500 dark:text-slate-400 font-semibold text-xs">
                          {t('بدون مقاس طبي حالياً', 'No prescription attached')}
                        </span>
                        {isRxEligible && (
                          <button
                            type="button"
                            onClick={() => setEditingRxTarget({ cartItem: item, product: prod })}
                            className="min-h-[40px] px-3.5 rounded-xl bg-[#11223E] text-white dark:bg-[#D9B24C] dark:text-[#11223E] font-extrabold inline-flex items-center gap-1.5"
                          >
                            <Eye className="w-3.5 h-3.5" />
                            {t('إضافة مقاس', 'Add Prescription')}
                          </button>
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}

          {/* Optician Help CTA Card matching screenshot 2 */}
          <button
            type="button"
            onClick={() => setActiveTab('consult')}
            className="w-full min-h-[52px] rounded-2xl border-2 border-emerald-400/70 dark:border-emerald-700/80 bg-emerald-50/75 hover:bg-emerald-50 dark:bg-emerald-950/25 dark:hover:bg-emerald-950/40 px-4 py-3 flex items-center justify-center gap-2.5 text-sm font-extrabold text-[#11223E] dark:text-emerald-200 transition-colors"
          >
            <span className="w-7 h-7 rounded-full bg-emerald-500 text-white flex items-center justify-center shrink-0">
              <MessageCircle className="w-4 h-4" />
            </span>
            <span>{t('استشر أخصائي البصريات قبل إتمام الطلب', 'Need help with your Rx? Consult Optician')}</span>
          </button>

          {/* Payment Method Card */}
          <div className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-4 shadow-xs">
            <h2 className="text-base font-extrabold text-[#11223E] dark:text-white">
              {t('طريقة الدفع', 'Payment Method')}
            </h2>
            <div className="grid sm:grid-cols-3 gap-3 text-xs">
              <button
                type="button"
                onClick={() => setPaymentMethod('bankak')}
                className={`p-3.5 rounded-xl border-2 text-start space-y-1 transition-colors ${
                  paymentMethod === 'bankak'
                    ? 'border-[#11223E] dark:border-[#D9B24C] bg-[#11223E]/5 dark:bg-[#D9B24C]/10'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <Building2 className="w-5 h-5 text-[#B38B2D]" />
                <div className="font-extrabold">{t('تحويل بنكي (بنكك)', 'Bankak Transfer')}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t('بنك الخرطوم وباقي البنوك', 'Bank of Khartoum & local banks')}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('cod')}
                className={`p-3.5 rounded-xl border-2 text-start space-y-1 transition-colors ${
                  paymentMethod === 'cod'
                    ? 'border-[#11223E] dark:border-[#D9B24C] bg-[#11223E]/5 dark:bg-[#D9B24C]/10'
                    : 'border-slate-200 dark:border-slate-700'
                }`}
              >
                <Banknote className="w-5 h-5 text-[#B38B2D]" />
                <div className="font-extrabold">{t('الدفع عند الاستلام', 'Cash on Delivery')}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t('نقداً لمندوب التوصيل', 'Pay cash on delivery')}
                </div>
              </button>

              <div className="p-3.5 rounded-xl border border-dashed border-slate-200 dark:border-slate-800 text-start space-y-1 opacity-65">
                <CreditCard className="w-5 h-5 text-slate-400" />
                <div className="font-bold">{t('الدفع الإلكتروني', 'Online Card Gateway')}</div>
                <div className="text-[11px] text-slate-500 dark:text-slate-400">
                  {t('بوابة الدفع جاهزة للتفعيل لاحقاً', 'Extensible gateway adapter ready')}
                </div>
              </div>
            </div>

            {paymentMethod === 'bankak' && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-extrabold text-sm">{settings.bankakBranchAr}</div>
                    <div className="text-slate-600 dark:text-slate-400 mt-0.5">
                      {t('اسم الحساب:', 'Account Name:')} {settings.bankakAccountName}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(settings.bankakAccountNumber);
                      showToast(t('تم نسخ رقم حساب بنكك', 'Bankak account copied'));
                    }}
                    className="min-h-[44px] px-3.5 py-1.5 rounded-xl bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-700 font-mono-num font-bold flex items-center gap-1.5"
                  >
                    <span>{settings.bankakAccountNumber}</span>
                    <Copy className="w-3.5 h-3.5 text-[#B38B2D]" />
                  </button>
                </div>

                {settings.otherBankDetailsAr && (
                  <p className="text-[11px] text-slate-500 dark:text-slate-400">
                    {settings.otherBankDetailsAr}
                  </p>
                )}

                <div className="grid sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block font-bold mb-1">
                      {t('رقم العملية المرجعي', 'Transfer Reference ID')}
                    </label>
                    <input
                      value={bankRef}
                      onChange={(e) => setBankRef(e.target.value)}
                      placeholder="BNK-..."
                      className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-sm"
                    />
                  </div>
                  <div>
                    <label className="block font-bold mb-1">
                      {t('صورة إشعار التحويل (بنكك)', 'Upload Transfer Receipt')}
                    </label>
                    <label className="min-h-[44px] flex items-center justify-center gap-2 px-3 py-2 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-[#D9B24C] bg-white dark:bg-[#131C2E] font-bold cursor-pointer">
                      <Upload className="w-4 h-4" />
                      <span>
                        {receiptUrl ? t('تم رفع الإيصال ✓', 'Receipt Uploaded ✓') : t('اختر لقطة الشاشة', 'Select Screenshot')}
                      </span>
                      <input type="file" accept="image/*" onChange={handleReceiptUpload} className="hidden" />
                    </label>
                  </div>
                </div>
              </div>
            )}

            <div className="space-y-1.5 pt-2 border-t border-slate-100 dark:border-slate-800 text-xs">
              <label className="block font-bold">
                {t('ملاحظات إضافية على الطلب (اختياري)', 'Order Notes (optional)')}
              </label>
              <textarea
                rows={2}
                maxLength={600}
                value={customerNote}
                onChange={(e) => setCustomerNote(e.target.value)}
                placeholder={t(
                  'مثال: وقت التوصيل المناسب أو أي تعليمات خاصة بالعدسات أو الاستلام...',
                  'e.g. preferred delivery time or special eyewear instructions...'
                )}
                className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs"
              />
            </div>
          </div>
        </div>

        {/* Order Summary Column */}
        <div className="lg:col-span-5 bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-2xl p-5 space-y-5 lg:sticky lg:top-28 shadow-xs">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-extrabold text-[#11223E] dark:text-white">
              {t('ملخص الطلب', 'Order Summary')}
            </h2>
            {settings.minimumOrderSdg > 0 && (
              <span className="text-[11px] text-slate-500 dark:text-slate-400">
                {t(`الحد الأدنى: ${formatSdg(settings.minimumOrderSdg)}`, `Min: ${formatSdg(settings.minimumOrderSdg)}`)}
              </span>
            )}
          </div>

          {/* Coupon Input */}
          <div className="flex gap-2">
            <div className="relative flex-1">
              <Tag className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
              <input
                type="text"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder={t('كود خصم (جرب NILE10)', 'Coupon code')}
                className="w-full min-h-[44px] ps-9 pe-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-mono-num uppercase"
              />
            </div>
            <button
              type="button"
              onClick={handleApplyCoupon}
              className="min-h-[44px] px-4 py-2 rounded-xl bg-[#11223E] text-white dark:bg-[#D9B24C] dark:text-[#11223E] text-xs font-extrabold"
            >
              {t('تطبيق', 'Apply')}
            </button>
          </div>

          {/* Ordered Breakdown */}
          <div className="space-y-2.5 text-sm border-t border-slate-100 dark:border-slate-800 pt-4">
            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">
                {t('المجموع الفرعي للمنتجات', 'Items Subtotal')}
              </span>
              <span className="font-mono-num font-bold tabular-nums">
                {formatSdg(itemsSubtotalSdg)}
              </span>
            </div>

            <div className="flex justify-between">
              <span className="text-slate-600 dark:text-slate-400">
                {t('إجمالي خيارات العدسات', 'Lens Options Total')}
              </span>
              <span className="font-mono-num font-bold tabular-nums">
                {formatSdg(lensOptionsTotalSdg)}
              </span>
            </div>

            {discountSdg > 0 && (
              <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                <span>
                  {t('الخصم', 'Discount')} ({activeCoupon?.code})
                </span>
                <span className="font-mono-num font-bold tabular-nums">
                  − {formatSdg(discountSdg)}
                </span>
              </div>
            )}

            <div className="flex justify-between gap-2">
              <span className="text-slate-600 dark:text-slate-400 flex items-center gap-1.5">
                <Truck className="w-3.5 h-3.5 text-[#B38B2D]" />
                <span>
                  {selectedState
                    ? `${t('رسوم التوصيل', 'Delivery Fee')} (${locale === 'ar' ? selectedState.nameAr : selectedState.nameEn})`
                    : t('رسوم التوصيل', 'Delivery Fee')}
                </span>
              </span>
              <span className="font-mono-num font-bold tabular-nums text-end">
                {selectedState
                  ? formatSdg(deliveryFeeSdg)
                  : t('اختر الولاية', 'Select state')}
              </span>
            </div>

            <div className="flex justify-between text-base sm:text-lg font-extrabold pt-3 border-t border-slate-200 dark:border-slate-800">
              <span>{t('الإجمالي النهائي', 'Total')}</span>
              <span className="font-mono-num text-[#11223E] dark:text-[#E2BD5B] tabular-nums">
                {formatSdg(totalSdg)}
              </span>
            </div>
          </div>

          {/* Delivery Address Button & Selected Address Card */}
          <div className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={() => {
                setEditingAddress(null);
                setAddressSheetOpen(true);
              }}
              className="w-full min-h-[50px] px-4 py-2.5 rounded-xl border-2 border-[#D9B24C] bg-[#D9B24C]/10 hover:bg-[#D9B24C]/20 text-xs font-extrabold flex items-center justify-between gap-2 transition-colors"
            >
              <span className="flex items-center gap-2 min-w-0 text-start">
                <MapPin className="w-4 h-4 text-[#B38B2D] shrink-0" />
                <span className="truncate">
                  {selectedAddress && selectedState
                    ? `${locale === 'ar' ? selectedState.nameAr : selectedState.nameEn}، ${selectedAddress.city}، ${selectedAddress.area}`
                    : t('إضافة عنوان التوصيل', 'Add Delivery Address')}
                </span>
              </span>
              <span className="shrink-0 text-[#B38B2D] dark:text-[#E2BD5B] inline-flex items-center gap-1">
                {selectedAddress ? (
                  t('تغيير', 'Change')
                ) : (
                  <>
                    <Plus className="w-3.5 h-3.5" />
                    {t('إضافة', 'Add')}
                  </>
                )}
              </span>
            </button>

            {selectedAddress && selectedState && (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/75 border border-slate-200/80 dark:border-slate-800 text-xs space-y-1.5">
                <div className="flex items-center justify-between gap-2">
                  <span className="font-extrabold text-[#11223E] dark:text-white">
                    {selectedAddress.recipientName || user.name}{' '}
                    <span className="font-normal text-slate-500">({selectedAddress.label})</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAddress(selectedAddress);
                      setAddressSheetOpen(true);
                    }}
                    className="text-[#B38B2D] font-bold inline-flex items-center gap-1 hover:underline"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    {t('تعديل', 'Edit')}
                  </button>
                </div>
                <div className="font-mono-num text-slate-600 dark:text-slate-300" dir="ltr">
                  {selectedAddress.phone}
                </div>
                <div className="text-slate-700 dark:text-slate-200 font-semibold">
                  {locale === 'ar' ? selectedState.nameAr : selectedState.nameEn} — {selectedAddress.city}،{' '}
                  {selectedAddress.area}
                </div>
                <div className="text-slate-500 dark:text-slate-400">{selectedAddress.details}</div>
                {selectedAddress.mapUrl && (
                  <a
                    href={selectedAddress.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#B38B2D] hover:underline"
                  >
                    <ExternalLink className="w-3 h-3" />
                    {t('فتح رابط الخريطة', 'Open Map Link')}
                  </a>
                )}
              </div>
            )}
          </div>

          {/* Primary Place Order Button matching screenshot bottom navy bar aesthetic */}
          {isGuest ? (
            <button
              type="button"
              onClick={() => openAuthModal('choice', true)}
              className="w-full min-h-[52px] py-3.5 px-6 rounded-2xl bg-[#11223E] text-white dark:bg-[#D9B24C] dark:text-[#11223E] font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-lg hover:opacity-95 transition-opacity"
            >
              <ShoppingBag className="w-4 h-4 text-[#D9B24C] dark:text-[#11223E]" />
              <span>{t('إتمام الطلب', 'Proceed to Checkout')}</span>
            </button>
          ) : (
            <div className="space-y-2">
              <button
                type="submit"
                disabled={submitting || requiresEmailVerification || !selectedAddress || !selectedState}
                className="w-full min-h-[52px] py-3.5 px-6 rounded-2xl bg-[#11223E] text-white dark:bg-[#D9B24C] dark:text-[#11223E] font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-lg hover:opacity-95 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <CheckCircle2 className="w-4 h-4 text-[#D9B24C] dark:text-[#11223E]" />
                <span>
                  {t('مراجعة الطلب قبل التأكيد', 'Review Order Before Confirming')}
                </span>
              </button>
              {(!selectedAddress || !selectedState) && (
                <p className="text-center text-xs font-bold text-rose-600 dark:text-rose-400">
                  {t('يرجى إضافة أو اختيار عنوان التوصيل لإتمام الطلب', 'Please select a delivery address to place order')}
                </p>
              )}
            </div>
          )}
        </div>
      </form>

      {/* Pre-Submission Order Review Modal */}
      {reviewModalOpen && selectedAddress && selectedState && (
        <div className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-xl w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-[#11223E] dark:text-white">
                  {t('مراجعة تفاصيل الطلب النهائية', 'Final Order Review')}
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {t(
                    'راجع المنتجات والعنوان والدفع قبل إرسال الطلب. يمكنك تعديل الطلب لاحقاً من صفحة طلباتي قبل الشحن.',
                    'Verify items, address & payment before placing. You can also edit before shipping from My Orders.'
                  )}
                </p>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setReviewModalOpen(false)}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Items Recap */}
            <div className="space-y-2">
              <div className="font-extrabold text-[#11223E] dark:text-[#E2BD5B]">
                {t(`المنتجات (${totalUnitsCount})`, `Items (${totalUnitsCount})`)}
              </div>
              <div className="space-y-2 max-h-48 overflow-y-auto">
                {cart.map((item) => {
                  const prod = products.find((p) => p.id === item.productId);
                  if (!prod) return null;
                  const lensExtra = item.prescription?.lensExtraPriceSdg || 0;
                  const lineTotal = (item.unitPriceSdg + lensExtra) * item.quantity;
                  const lensLine = formatLensSummaryLine(item.prescription, lensOptions, locale);
                  return (
                    <div
                      key={item.id}
                      className="p-2.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 flex items-center justify-between gap-2"
                    >
                      <div className="min-w-0">
                        <div className="font-bold truncate">
                          {locale === 'ar' ? prod.titleAr : prod.titleEn} × {item.quantity}
                        </div>
                        {item.variantLabel && (
                          <div className="text-[11px] text-slate-500">{item.variantLabel}</div>
                        )}
                        {lensLine && (
                          <div className="text-[11px] text-emerald-700 dark:text-emerald-400">
                            {lensLine}
                          </div>
                        )}
                      </div>
                      <span className="font-mono-num font-extrabold shrink-0">
                        {formatSdg(lineTotal)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </div>

            {/* Address Recap */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-extrabold text-[#11223E] dark:text-[#E2BD5B]">
                  {t('عنوان التوصيل والمستلم', 'Recipient & Delivery Address')}
                </span>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setReviewModalOpen(false);
                    setEditingAddress(selectedAddress);
                    setAddressSheetOpen(true);
                  }}
                  className="text-[#B38B2D] font-bold hover:underline"
                >
                  {t('تعديل العنوان', 'Edit Address')}
                </button>
              </div>
              <div className="font-bold">
                {selectedAddress.recipientName || user.name} ·{' '}
                <span dir="ltr" className="font-mono-num">{selectedAddress.phone || user.phone}</span>
              </div>
              <div className="text-slate-600 dark:text-slate-300">
                {locale === 'ar' ? selectedState.nameAr : selectedState.nameEn} — {selectedAddress.city}،{' '}
                {selectedAddress.area} — {selectedAddress.details}
              </div>
            </div>

            {/* Payment & Note Recap */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 space-y-1">
              <div className="font-extrabold text-[#11223E] dark:text-[#E2BD5B]">
                {t('طريقة الدفع', 'Payment Method')}
              </div>
              <div className="font-bold">
                {paymentMethod === 'bankak'
                  ? t('تحويل بنكي (بنكك)', 'Bankak Transfer')
                  : t('الدفع عند الاستلام', 'Cash on Delivery')}
                {paymentMethod === 'bankak' && bankRef.trim() ? ` (${bankRef.trim()})` : ''}
              </div>
              {customerNote.trim() && (
                <div className="text-[11px] text-slate-600 dark:text-slate-300 pt-1">
                  <strong>{t('ملاحظتك:', 'Your Note:')}</strong> {customerNote.trim()}
                </div>
              )}
            </div>

            {/* Totals Breakdown */}
            <div className="p-3 rounded-xl border border-[#D9B24C]/50 bg-[#D9B24C]/10 space-y-1.5">
              <div className="flex justify-between">
                <span>{t('المنتجات والعدسات', 'Items & Lenses')}</span>
                <span className="font-mono-num font-bold">{formatSdg(subtotalSdg)}</span>
              </div>
              {discountSdg > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                  <span>{t('الخصم', 'Discount')}</span>
                  <span className="font-mono-num font-bold">− {formatSdg(discountSdg)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span>{t('رسوم التوصيل', 'Delivery Fee')}</span>
                <span className="font-mono-num font-bold">{formatSdg(deliveryFeeSdg)}</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold border-t border-[#D9B24C]/40 pt-1.5">
                <span>{t('الإجمالي النهائي', 'Final Total')}</span>
                <span className="font-mono-num text-[#11223E] dark:text-[#E2BD5B]">
                  {formatSdg(totalSdg)}
                </span>
              </div>
            </div>

            <div className="flex items-center justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setReviewModalOpen(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold disabled:opacity-50"
              >
                {t('تراجع للتعديل', 'Back to Edit')}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleConfirmPlaceOrder()}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-[#11223E] text-white dark:bg-[#D9B24C] dark:text-[#11223E] font-extrabold inline-flex items-center gap-2 disabled:opacity-50"
              >
                <CheckCircle2 className="w-4 h-4" />
                <span>
                  {submitting
                    ? t('جارٍ إرسال الطلب...', 'Submitting Order...')
                    : locale === 'ar'
                    ? appTexts.btnCheckoutAr
                    : appTexts.btnCheckoutEn}
                </span>
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Edit/Add Prescription Sheet from Cart */}
      {editingRxTarget && (
        <PrescriptionSheet
          open={Boolean(editingRxTarget)}
          product={editingRxTarget.product}
          initialPrescription={editingRxTarget.cartItem.prescription}
          onClose={() => setEditingRxTarget(null)}
          onSave={(rx) => {
            updateCartItemPrescription(editingRxTarget.cartItem.id, rx);
          }}
          onRemove={() => {
            updateCartItemPrescription(editingRxTarget.cartItem.id, undefined);
          }}
        />
      )}

      {/* Delivery Address Bottom Sheet */}
      <AddressSheet
        open={addressSheetOpen}
        selectedAddressId={selectedAddress?.id}
        initialEditAddress={editingAddress}
        onClose={() => {
          setAddressSheetOpen(false);
          setEditingAddress(null);
        }}
        onSelectAddress={(addr) => setSelectedAddress(addr)}
      />

      {/* Fullscreen Rx Image Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[80] bg-black/85 flex flex-col items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="max-w-3xl w-full flex justify-between items-center mb-3 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <a
              href={lightboxImage}
              download="prescription.jpg"
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] px-4 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold inline-flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              {t('تحميل الصورة', 'Download')}
            </a>
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/15 hover:bg-white/25"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <img
            src={lightboxImage}
            alt={t('صورة الروشتة', 'Prescription Photo')}
            className="max-h-[82vh] max-w-full rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}
    </div>
  );
};
