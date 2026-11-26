import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Banknote,
  Building2,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  Eye,
  FileText,
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
import {
  calculateSplitAmounts,
  formatSdg,
  getPaymentMethodLabel,
  isValidSudanPhone,
} from '../utils/format';
import {
  MIRROR_COLOR_OPTIONS,
  calculateLensPricingBreakdown,
  formatLensSummaryLine,
  getExtraOptionLabel,
  getMirrorColorLabel,
  getVisionTypeLabel,
  hasCustomLensOrRx,
  isContactLensProduct,
  isPdfPrescriptionUrl,
  isPrescriptionEligibleProduct,
  resolveExtraOptions,
  resolveVisionType,
  validateContactEye,
  validateEyeglassesEye,
} from '../utils/prescription';
import { ResilientImage } from './ResilientImage';
import { PrescriptionSheet } from './PrescriptionSheet';
import { AddressSheet } from './AddressSheet';
import { FieldValidationRule, useFormValidation } from '../hooks/useFormValidation';
import { FieldError, ValidationSummaryBanner } from './FormValidationUI';
import { VALIDATION_MESSAGES, pickMsg } from '../utils/validationMessages';

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
  const [couponError, setCouponError] = useState<string | null>(null);
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

  const checkoutValidation = useFormValidation({ formId: 'checkout' });

  useEffect(() => {
    if (!selectedAddress) {
      const def = user.addresses.find((a) => a.isDefault);
      if (def) setSelectedAddress(def);
      return;
    }
    const updated = user.addresses.find((a) => a.id === selectedAddress.id);
    if (updated) {
      setSelectedAddress(updated);
    } else {
      setSelectedAddress(null);
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
  const totalSdg = Math.max(0, Math.round(subtotalSdg - discountSdg + deliveryFeeSdg));
  const splitEnabled = settings.splitPaymentEnabled ?? true;
  const splitBreakdown = useMemo(
    () => calculateSplitAmounts(totalSdg, settings),
    [totalSdg, settings]
  );

  useEffect(() => {
    if (!splitEnabled && paymentMethod === 'split') {
      setPaymentMethod('bankak');
    }
  }, [splitEnabled, paymentMethod]);

  const requiresEmailVerification = !isGuest && !isEmailVerified;

  const incompleteLensItemIds = useMemo(() => {
    const errorsById: Record<string, string> = {};
    for (const item of cart) {
      const prod = products.find((p) => p.id === item.productId);
      if (!prod || !isPrescriptionEligibleProduct(prod, categories)) continue;
      const rx = item.prescription;
      if (!rx) continue;

      const isContact = isContactLensProduct(prod, categories);
      const itemExtras = resolveExtraOptions(rx);
      if (!isContact && itemExtras.includes('mirror') && !rx.mirrorColor) {
        errorsById[item.id] = pickMsg(VALIDATION_MESSAGES.mirrorColorRequired, locale);
        continue;
      }
      if (rx.type === 'image' && !rx.imageUrl) {
        errorsById[item.id] = pickMsg(VALIDATION_MESSAGES.rxImageRequired, locale);
        continue;
      }
      if (rx.type === 'manual') {
        if (isContact && rx.values?.kind === 'contact_lenses') {
          const rEye = rx.values.contactRight;
          const lEye = rx.values.contactLeft;
          const rErr = rEye ? validateContactEye(rEye, 'العين اليمنى', 'Right Eye', locale) : null;
          const lErr = lEye ? validateContactEye(lEye, 'العين اليسرى', 'Left Eye', locale) : null;
          if (rErr || lErr) {
            errorsById[item.id] = rErr || lErr || pickMsg(VALIDATION_MESSAGES.lensOptionIncomplete, locale);
          }
        } else if (!isContact && rx.rightEye) {
          const rErr = validateEyeglassesEye(rx.rightEye, 'العين اليمنى (OD)', 'Right Eye (OD)', locale);
          const lErr = rx.leftEye
            ? validateEyeglassesEye(rx.leftEye, 'العين اليسرى (OS)', 'Left Eye (OS)', locale)
            : null;
          if (rErr || lErr) {
            errorsById[item.id] = rErr || lErr || pickMsg(VALIDATION_MESSAGES.lensOptionIncomplete, locale);
          }
        }
      }
    }
    return errorsById;
  }, [cart, products, categories, locale]);

  const buildCheckoutRules = useCallback((): FieldValidationRule[] => {
    const firstLensErrorEntry = Object.entries(incompleteLensItemIds)[0];
    const effectivePhone = selectedAddress ? (selectedAddress.phone || user.phone || '').trim() : '';

    return [
      {
        field: 'emailVerification',
        label: t('تأكيد البريد الإلكتروني', 'Email Verification'),
        error: requiresEmailVerification ? pickMsg(VALIDATION_MESSAGES.emailVerifyRequired, locale) : null,
      },
      {
        field: 'address',
        label: t('عنوان التوصيل', 'Delivery Address'),
        error: !selectedAddress ? pickMsg(VALIDATION_MESSAGES.addressRequired, locale) : null,
      },
      {
        field: 'deliveryState',
        label: t('ولاية التوصيل', 'Delivery State'),
        error: selectedAddress && !selectedState ? pickMsg(VALIDATION_MESSAGES.deliveryStateRequired, locale) : null,
      },
      {
        field: 'phone',
        label: t('رقم الهاتف', 'Phone Number'),
        error: selectedAddress
          ? !effectivePhone
            ? pickMsg(VALIDATION_MESSAGES.phoneRequired, locale)
            : !isValidSudanPhone(effectivePhone)
            ? pickMsg(VALIDATION_MESSAGES.phoneInvalidSudan, locale)
            : null
          : null,
      },
      {
        field: 'lensOptions',
        label: t('خيارات العدسات والمقاس', 'Lens Options & Rx'),
        error: firstLensErrorEntry ? firstLensErrorEntry[1] : null,
      },
      {
        field: 'paymentMethod',
        label: t('طريقة الدفع', 'Payment Method'),
        error: !paymentMethod ? pickMsg(VALIDATION_MESSAGES.paymentMethodRequired, locale) : null,
      },
      {
        field: 'bankReceipt',
        label: t('صورة إيصال بنكك', 'Bankak Receipt Image'),
        error:
          (paymentMethod === 'bankak' || paymentMethod === 'split') && !receiptUrl
            ? pickMsg(VALIDATION_MESSAGES.bankReceiptRequired, locale)
            : null,
      },
      {
        field: 'bankRef',
        label: t('رقم العملية المرجعي', 'Transfer Reference ID'),
        error:
          (paymentMethod === 'bankak' || paymentMethod === 'split') &&
          bankRef.trim().length > 0 &&
          bankRef.trim().length < 4
            ? pickMsg(VALIDATION_MESSAGES.bankRefTooShort, locale)
            : null,
      },
      {
        field: 'minimumOrder',
        label: t('الحد الأدنى للطلب', 'Minimum Order'),
        error:
          settings.minimumOrderSdg > 0 && subtotalSdg < settings.minimumOrderSdg
            ? VALIDATION_MESSAGES.minimumOrderNotMet(formatSdg(settings.minimumOrderSdg), locale)
            : null,
      },
    ];
  }, [
    incompleteLensItemIds,
    selectedAddress,
    user.phone,
    t,
    requiresEmailVerification,
    locale,
    selectedState,
    paymentMethod,
    receiptUrl,
    bankRef,
    settings.minimumOrderSdg,
    subtotalSdg,
  ]);

  useEffect(() => {
    if (checkoutValidation.submitted) {
      checkoutValidation.revalidate(buildCheckoutRules());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [checkoutValidation.submitted, buildCheckoutRules]);

  const handleApplyCoupon = () => {
    const code = couponInput.trim().toUpperCase();
    if (!code) {
      setCouponError(pickMsg(VALIDATION_MESSAGES.couponEmpty, locale));
      return;
    }
    const found = coupons.find((c) => c.code === code && c.isActive);
    if (!found) {
      setCouponError(t('كود الخصم غير صالح أو متوقف', 'Invalid or inactive coupon code'));
      return;
    }
    if (found.expiryDate < today) {
      setCouponError(t('انتهت صلاحية كود الخصم', 'Coupon expired'));
      return;
    }
    if (found.usedCount >= found.usageLimit) {
      setCouponError(t('تم استنفاد الحد الأقصى لاستخدام الكود', 'Coupon usage limit reached'));
      return;
    }
    if (subtotalSdg < found.minSubtotalSdg) {
      setCouponError(
        t(
          `الحد الأدنى لاستخدام الكود ${formatSdg(found.minSubtotalSdg)}`,
          `Minimum subtotal required: ${formatSdg(found.minSubtotalSdg)}`
        )
      );
      return;
    }
    setCouponError(null);
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
    return checkoutValidation.validateAll(buildCheckoutRules());
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

      {/* Guest Checkout Prompt Banner */}
      {isGuest && (
        <div className="rounded-2xl border border-[#D9B24C]/50 bg-[#D9B24C]/10 p-4 flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-0.5 text-xs">
            <div className="font-extrabold text-[#11223E] dark:text-[#E2BD5B]">
              {t('أنت تتصفح كضيف حالياً', 'You are currently browsing as a guest')}
            </div>
            <p className="text-slate-600 dark:text-slate-300">
              {t(
                'سجّل دخولك أو أنشئ حساباً لإتمام الطلب وحفظ سلتك تلقائياً.',
                'Sign in or create an account to complete checkout — your cart is saved automatically.'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => openAuthModal('choice', true)}
            style={{ backgroundColor: appearance.primaryColor }}
            className="min-h-[40px] px-4 rounded-xl text-white text-xs font-extrabold shrink-0"
          >
            {t('تسجيل الدخول / حساب جديد', 'Sign In / Register')}
          </button>
        </div>
      )}

      {/* Unverified Email Gate Banner */}
      {requiresEmailVerification && (
        <div
          {...checkoutValidation.getFieldWrapperProps('emailVerification')}
          tabIndex={-1}
          {...checkoutValidation.getInputA11yProps('emailVerification')}
          className={`rounded-2xl p-5 space-y-3 transition-colors ${checkoutValidation.getControlClasses(
            'emailVerification',
            'border-2 border-rose-300 dark:border-rose-900 bg-rose-50 dark:bg-rose-950/30'
          )}`}
        >
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

          <FieldError
            id={checkoutValidation.getErrorId('emailVerification')}
            message={checkoutValidation.getError('emailVerification')}
          />
        </div>
      )}

      <form
        noValidate
        onSubmit={handleOpenOrderReview}
        className="grid lg:grid-cols-12 gap-6 items-start"
      >
        <ValidationSummaryBanner
          mode="checkout"
          errors={checkoutValidation.errors}
          onSelectField={checkoutValidation.focusField}
          className="lg:col-span-12"
        />

        {/* Left/Right Column: Cart Item Cards & Optician Help & Payment Method */}
        <div className="lg:col-span-7 space-y-4">
          {cart.map((item) => {
            const firstInvalidLensItemId = Object.keys(incompleteLensItemIds)[0];
            const itemLensError =
              checkoutValidation.submitted || checkoutValidation.hasError('lensOptions')
                ? incompleteLensItemIds[item.id]
                : undefined;
            const isFirstInvalidLensItem = item.id === firstInvalidLensItemId;
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
                {...(isFirstInvalidLensItem ? checkoutValidation.getFieldWrapperProps('lensOptions') : {})}
                className={`rounded-2xl p-4 space-y-3 shadow-xs transition-colors ${
                  itemLensError
                    ? `border-2 border-[#DC2626] dark:border-rose-500 bg-[#FEF2F2] dark:bg-rose-950/30 ${
                        isFirstInvalidLensItem && checkoutValidation.isShaking('lensOptions')
                          ? 'vp-field-shake'
                          : ''
                      }`
                    : 'bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800'
                }`}
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

                    {(item.variantLabel || item.selectedOptions?.size) && (
                      <div className="flex flex-wrap items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-medium">
                        {item.variantLabel && (
                          <span className="inline-flex items-center gap-1.5">
                            {matchedVariant?.colorHex && (
                              <span
                                className="w-3 h-3 rounded-full border border-black/15 shrink-0"
                                style={{ backgroundColor: matchedVariant.colorHex }}
                              />
                            )}
                            <span>{item.variantLabel}</span>
                          </span>
                        )}
                        {item.selectedOptions?.size && (
                          <span className="px-2 py-0.5 rounded-md bg-amber-50 dark:bg-amber-950/30 border border-[#D9B24C]/50 text-[#11223E] dark:text-[#E2BD5B] font-mono-num font-extrabold text-[11px]">
                            {t('المقاس:', 'Size:')} {item.selectedOptions.size}
                          </span>
                        )}
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
                        className="min-h-[42px] px-3.5 rounded-xl bg-[#D9B24C] hover:bg-[#c9a13c] text-[#11223E] border border-[#b38b2d] shadow-sm font-extrabold inline-flex items-center gap-1.5 transition-colors"
                      >
                        <Eye className="w-4 h-4 shrink-0" />
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

                {itemLensError && (
                  <FieldError
                    id={isFirstInvalidLensItem ? checkoutValidation.getErrorId('lensOptions') : `lens-err-${item.id}`}
                    message={itemLensError}
                  />
                )}

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
                                {rx.values.contactRight && (
                                  <tr>
                                    <td className="p-2 font-bold">OD ({t('يمين', 'R')})</td>
                                    <td className="p-2 text-center">{rx.values.contactRight.sph}</td>
                                    <td className="p-2 text-center">{rx.values.contactRight.cyl}</td>
                                    <td className="p-2 text-center">{rx.values.contactRight.axis}°</td>
                                    <td className="p-2 text-center">{rx.values.contactRight.add || '—'}</td>
                                  </tr>
                                )}
                                {rx.values.contactLeft && (
                                  <tr>
                                    <td className="p-2 font-bold">OS ({t('يسار', 'L')})</td>
                                    <td className="p-2 text-center">{rx.values.contactLeft.sph}</td>
                                    <td className="p-2 text-center">{rx.values.contactLeft.cyl}</td>
                                    <td className="p-2 text-center">{rx.values.contactLeft.axis}°</td>
                                    <td className="p-2 text-center">{rx.values.contactLeft.add || '—'}</td>
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
                          <div className="flex flex-wrap items-center gap-3">
                            {isPdfPrescriptionUrl(rx.imageUrl, rx.fileType) ? (
                              <div className="p-2.5 rounded-xl bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-700 flex items-center gap-2.5">
                                <div className="w-9 h-9 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center shrink-0">
                                  <FileText className="w-4 h-4" />
                                </div>
                                <span className="font-bold text-xs max-w-[180px] truncate">
                                  {rx.fileName || t('وصفة طبية (PDF)', 'Prescription (PDF)')}
                                </span>
                                <a
                                  href={rx.imageUrl}
                                  download={rx.fileName || 'prescription.pdf'}
                                  className="min-h-[34px] px-2.5 rounded-lg bg-[#11223E] text-white text-[11px] font-bold inline-flex items-center gap-1"
                                >
                                  <Download className="w-3.5 h-3.5" />
                                  <span>{t('تحميل PDF', 'Download PDF')}</span>
                                </a>
                              </div>
                            ) : (
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
                            )}
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
                            className="min-h-[42px] px-3.5 rounded-xl bg-[#D9B24C] hover:bg-[#c9a13c] text-[#11223E] border border-[#b38b2d] shadow-xs font-extrabold inline-flex items-center gap-1.5 transition-colors"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            {t('تعديل المقاس', 'Edit Prescription')}
                          </button>
                          <button
                            type="button"
                            onClick={() => updateCartItemPrescription(item.id, undefined)}
                            className="min-h-[42px] px-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 font-bold inline-flex items-center gap-1.5"
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
                            className="min-h-[42px] px-4 rounded-xl bg-[#D9B24C] hover:bg-[#c9a13c] text-[#11223E] border border-[#b38b2d] shadow-sm font-extrabold inline-flex items-center gap-1.5 transition-colors"
                          >
                            <Eye className="w-4 h-4" />
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

          {/* Optician Help Link */}
          <button
            type="button"
            onClick={() => setActiveTab('consult')}
            className="w-full min-h-[46px] rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-[#111927] hover:bg-slate-50 dark:hover:bg-slate-900 px-4 py-2.5 flex items-center justify-center gap-2 text-xs sm:text-sm font-bold text-[#11223E] dark:text-slate-200 transition-colors"
          >
            <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{t('هل تحتاج مساعدة في المقاس؟ استشر أخصائي البصريات', 'Need help with your Rx? Consult Optician')}</span>
          </button>

          {/* Payment Method Card */}
          <div className="bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-4">
            <div {...checkoutValidation.getFieldWrapperProps('paymentMethod')} className="space-y-3">
              <h2 className="text-base font-extrabold text-[#11223E] dark:text-white">
                {t('طريقة الدفع', 'Payment Method')}
              </h2>
              <div
                className={`grid ${splitEnabled ? 'sm:grid-cols-3' : 'sm:grid-cols-2'} gap-3 text-xs rounded-xl ${
                  checkoutValidation.hasError('paymentMethod')
                    ? `p-2 border-2 border-[#DC2626] bg-[#FEF2F2] dark:bg-rose-950/30 ${
                        checkoutValidation.isShaking('paymentMethod') ? 'vp-field-shake' : ''
                      }`
                    : ''
                }`}
              >
                <button
                  type="button"
                  onClick={() => setPaymentMethod('bankak')}
                  className={`min-h-[44px] p-3.5 rounded-xl border-2 text-start space-y-1 transition-colors ${
                    paymentMethod === 'bankak'
                      ? 'border-[#11223E] dark:border-[#D9B24C] bg-[#11223E]/5 dark:bg-[#D9B24C]/10'
                      : 'border-slate-200 dark:border-slate-700'
                  }`}
                >
                  <Building2 className="w-5 h-5 text-[#B38B2D]" />
                  <div className="font-extrabold">{t('تحويل بنكي (بنكك)', 'Bankak Transfer')}</div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t('دفع كامل المبلغ مقدماً', 'Pay full amount upfront')}
                  </div>
                </button>

                {splitEnabled && (
                  <button
                    type="button"
                    onClick={() => setPaymentMethod('split')}
                    className={`min-h-[44px] p-3.5 rounded-xl border-2 text-start space-y-1 transition-colors ${
                      paymentMethod === 'split'
                        ? 'border-[#11223E] dark:border-[#D9B24C] bg-[#11223E]/5 dark:bg-[#D9B24C]/10'
                        : 'border-slate-200 dark:border-slate-700'
                    }`}
                  >
                    <div className="flex items-center gap-1.5 text-[#B38B2D]">
                      <Building2 className="w-4 h-4" />
                      <span className="font-bold">+</span>
                      <Banknote className="w-4 h-4" />
                    </div>
                    <div className="font-extrabold">
                      {t('دفع مقسّم (بنكك + عند الاستلام)', 'Split (Bankak + COD)')}
                    </div>
                    <div className="text-[11px] text-slate-500 dark:text-slate-400">
                      {settings.splitPaymentMode === 'fixed'
                        ? t(
                            `عربون ${formatSdg(settings.splitPaymentFixedSdg ?? 15000)} والباقي عند الاستلام`,
                            `${formatSdg(settings.splitPaymentFixedSdg ?? 15000)} deposit + COD`
                          )
                        : t(
                            `${settings.splitPaymentPercent ?? 50}% ببنكك والباقي عند الاستلام`,
                            `${settings.splitPaymentPercent ?? 50}% Bankak + COD`
                          )}
                    </div>
                  </button>
                )}

                <button
                  type="button"
                  onClick={() => setPaymentMethod('cod')}
                  className={`min-h-[44px] p-3.5 rounded-xl border-2 text-start space-y-1 transition-colors ${
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
              </div>
              <FieldError
                id={checkoutValidation.getErrorId('paymentMethod')}
                message={checkoutValidation.getError('paymentMethod')}
              />
            </div>

            {(paymentMethod === 'bankak' || paymentMethod === 'split') && (
              <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/75 border border-slate-200 dark:border-slate-800 space-y-3 text-xs">
                {paymentMethod === 'split' && (
                  <div className="grid sm:grid-cols-2 gap-2.5 p-3 rounded-xl bg-[#D9B24C]/12 border border-[#D9B24C]/40">
                    <div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
                        {t('المبلغ المطلوب تحويله الآن (بنكك):', 'Pay Now via Bankak:')}
                      </div>
                      <div className="font-mono-num text-base font-extrabold text-[#11223E] dark:text-[#E2BD5B]">
                        {formatSdg(splitBreakdown.bankakAmount)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-300 font-semibold">
                        {t('المتبقي للدفع نقداً عند الاستلام:', 'Remaining Cash on Delivery:')}
                      </div>
                      <div className="font-mono-num text-base font-extrabold text-emerald-700 dark:text-emerald-400">
                        {formatSdg(splitBreakdown.codAmount)}
                      </div>
                    </div>
                  </div>
                )}

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
                  <div {...checkoutValidation.getFieldWrapperProps('bankRef')}>
                    <label htmlFor="checkout-bank-ref" className="block font-bold mb-1">
                      {t('رقم العملية المرجعي', 'Transfer Reference ID')}
                    </label>
                    <input
                      id="checkout-bank-ref"
                      value={bankRef}
                      onChange={(e) => setBankRef(e.target.value)}
                      placeholder="BNK-..."
                      {...checkoutValidation.getInputA11yProps('bankRef')}
                      className={`w-full min-h-[44px] px-3 py-2 rounded-xl font-mono-num text-sm transition-colors ${checkoutValidation.getControlClasses(
                        'bankRef',
                        'border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E]'
                      )}`}
                    />
                    <FieldError
                      id={checkoutValidation.getErrorId('bankRef')}
                      message={checkoutValidation.getError('bankRef')}
                    />
                  </div>
                  <div {...checkoutValidation.getFieldWrapperProps('bankReceipt')}>
                    <label htmlFor="checkout-bank-receipt" className="block font-bold mb-1">
                      {t('صورة إشعار التحويل (بنكك)', 'Upload Transfer Receipt')} *
                    </label>
                    <label
                      htmlFor="checkout-bank-receipt"
                      tabIndex={0}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter' || e.key === ' ') {
                          e.preventDefault();
                          document.getElementById('checkout-bank-receipt')?.click();
                        }
                      }}
                      {...checkoutValidation.getInputA11yProps('bankReceipt')}
                      className={`min-h-[44px] flex items-center justify-center gap-2 px-3 py-2 rounded-xl font-bold cursor-pointer transition-colors ${checkoutValidation.getControlClasses(
                        'bankReceipt',
                        'border-2 border-dashed border-slate-300 dark:border-slate-700 hover:border-[#D9B24C] bg-white dark:bg-[#131C2E]'
                      )}`}
                    >
                      <Upload className="w-4 h-4 shrink-0" />
                      <span>
                        {receiptUrl ? t('تم رفع الإيصال ✓', 'Receipt Uploaded ✓') : t('اختر لقطة الشاشة', 'Select Screenshot')}
                      </span>
                      <input
                        id="checkout-bank-receipt"
                        type="file"
                        accept="image/*"
                        onChange={handleReceiptUpload}
                        className="sr-only"
                      />
                    </label>
                    <FieldError
                      id={checkoutValidation.getErrorId('bankReceipt')}
                      message={checkoutValidation.getError('bankReceipt')}
                    />
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
        <div className="lg:col-span-5 bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800 rounded-2xl p-5 space-y-5 lg:sticky lg:top-28">
          <div {...checkoutValidation.getFieldWrapperProps('minimumOrder')} className="space-y-1">
            <div className="flex items-center justify-between gap-2">
              <h2 className="text-base font-extrabold text-[#11223E] dark:text-white">
                {t('ملخص الطلب', 'Order Summary')}
              </h2>
              {settings.minimumOrderSdg > 0 && (
                <span
                  className={`text-[11px] font-semibold ${
                    checkoutValidation.hasError('minimumOrder')
                      ? 'text-[#DC2626] dark:text-rose-400 font-extrabold'
                      : 'text-slate-500 dark:text-slate-400'
                  }`}
                >
                  {t(`الحد الأدنى: ${formatSdg(settings.minimumOrderSdg)}`, `Min: ${formatSdg(settings.minimumOrderSdg)}`)}
                </span>
              )}
            </div>
            <FieldError
              id={checkoutValidation.getErrorId('minimumOrder')}
              message={checkoutValidation.getError('minimumOrder')}
            />
          </div>

          {/* Coupon Input */}
          <div className="space-y-1">
            <div className="flex gap-2">
              <div className="relative flex-1">
                <Tag className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-slate-400" />
                <input
                  type="text"
                  value={couponInput}
                  onChange={(e) => {
                    setCouponInput(e.target.value);
                    if (couponError) setCouponError(null);
                  }}
                  aria-invalid={couponError ? true : undefined}
                  aria-describedby={couponError ? 'checkout-coupon-error' : undefined}
                  placeholder={t('كود خصم (جرب NILE10)', 'Coupon code')}
                  className={`w-full min-h-[44px] ps-9 pe-3 py-2 rounded-xl text-xs font-mono-num uppercase transition-colors ${
                    couponError
                      ? 'border-2 border-[#DC2626] dark:border-rose-500 bg-[#FEF2F2] dark:bg-rose-950/30 vp-field-shake'
                      : 'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                  }`}
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
            <FieldError id="checkout-coupon-error" message={couponError} />
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

            {paymentMethod === 'split' && (
              <div className="p-3 rounded-xl bg-[#D9B24C]/10 border border-[#D9B24C]/35 space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    {t('يُدفع الآن عبر بنكك', 'Due Now (Bankak)')}
                  </span>
                  <span className="font-mono-num font-extrabold text-[#11223E] dark:text-[#E2BD5B]">
                    {formatSdg(splitBreakdown.bankakAmount)}
                  </span>
                </div>
                <div className="flex justify-between">
                  <span className="font-bold text-slate-700 dark:text-slate-200">
                    {t('المتبقي عند الاستلام', 'Due on Delivery (COD)')}
                  </span>
                  <span className="font-mono-num font-extrabold text-emerald-700 dark:text-emerald-400">
                    {formatSdg(splitBreakdown.codAmount)}
                  </span>
                </div>
              </div>
            )}
          </div>

          {/* Delivery Address Button & Selected Address Card */}
          <div
            {...checkoutValidation.getFieldWrapperProps('address')}
            className="space-y-3 pt-2 border-t border-slate-100 dark:border-slate-800"
          >
            <button
              type="button"
              onClick={() => {
                setEditingAddress(null);
                setAddressSheetOpen(true);
              }}
              {...checkoutValidation.getInputA11yProps('address')}
              className={`w-full min-h-[50px] px-4 py-2.5 rounded-xl text-xs font-extrabold flex items-center justify-between gap-2 transition-colors ${
                checkoutValidation.hasError('address')
                  ? checkoutValidation.getControlClasses(
                      'address',
                      'border-2 border-[#D9B24C] bg-[#D9B24C]/10 hover:bg-[#D9B24C]/20'
                    )
                  : checkoutValidation.hasError('deliveryState')
                  ? checkoutValidation.getControlClasses(
                      'deliveryState',
                      'border-2 border-[#D9B24C] bg-[#D9B24C]/10 hover:bg-[#D9B24C]/20'
                    )
                  : checkoutValidation.hasError('phone')
                  ? checkoutValidation.getControlClasses(
                      'phone',
                      'border-2 border-[#D9B24C] bg-[#D9B24C]/10 hover:bg-[#D9B24C]/20'
                    )
                  : 'border-2 border-[#D9B24C] bg-[#D9B24C]/10 hover:bg-[#D9B24C]/20'
              }`}
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

            <FieldError
              id={checkoutValidation.getErrorId('address')}
              message={checkoutValidation.getError('address')}
            />

            {selectedAddress && (
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
                    className="min-h-[36px] px-2 text-[#B38B2D] font-bold inline-flex items-center gap-1 hover:underline"
                  >
                    <Edit3 className="w-3.5 h-3.5" />
                    {t('تعديل', 'Edit')}
                  </button>
                </div>

                <div {...checkoutValidation.getFieldWrapperProps('phone')}>
                  <div
                    className={`font-mono-num px-2 py-1 rounded-lg transition-colors ${
                      checkoutValidation.hasError('phone')
                        ? 'border-2 border-[#DC2626] bg-[#FEF2F2] dark:bg-rose-950/30 text-[#991B1B] dark:text-rose-200 font-bold'
                        : 'text-slate-600 dark:text-slate-300'
                    }`}
                    dir="ltr"
                  >
                    {selectedAddress.phone || user.phone || t('لا يوجد رقم هاتف', 'No phone number')}
                  </div>
                  <FieldError
                    id={checkoutValidation.getErrorId('phone')}
                    message={checkoutValidation.getError('phone')}
                  />
                </div>

                <div {...checkoutValidation.getFieldWrapperProps('deliveryState')}>
                  <div
                    className={`px-2 py-1 rounded-lg font-semibold transition-colors ${
                      checkoutValidation.hasError('deliveryState')
                        ? 'border-2 border-[#DC2626] bg-[#FEF2F2] dark:bg-rose-950/30 text-[#991B1B] dark:text-rose-200'
                        : 'text-slate-700 dark:text-slate-200'
                    }`}
                  >
                    {selectedState
                      ? locale === 'ar'
                        ? selectedState.nameAr
                        : selectedState.nameEn
                      : t('الولاية غير محددة', 'State not selected')}{' '}
                    — {selectedAddress.city}، {selectedAddress.area}
                  </div>
                  <FieldError
                    id={checkoutValidation.getErrorId('deliveryState')}
                    message={checkoutValidation.getError('deliveryState')}
                  />
                </div>

                <div className="text-slate-500 dark:text-slate-400 px-2">{selectedAddress.details}</div>
                {selectedAddress.mapUrl && (
                  <a
                    href={selectedAddress.mapUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="inline-flex items-center gap-1 text-[11px] font-bold text-[#B38B2D] hover:underline px-2"
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
              <span>{t('تسجيل الدخول لإتمام الطلب', 'Sign In to Checkout')}</span>
            </button>
          ) : (
            <button
              type="submit"
              disabled={submitting}
              className="w-full min-h-[52px] py-3.5 px-6 rounded-2xl bg-[#11223E] text-white dark:bg-[#D9B24C] dark:text-[#11223E] font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-lg hover:opacity-95 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <CheckCircle2 className="w-4 h-4 text-[#D9B24C] dark:text-[#11223E]" />
              <span>
                {t('مراجعة الطلب قبل التأكيد', 'Review Order Before Confirming')}
              </span>
            </button>
          )}
        </div>
      </form>

      {/* Simplified Final Invoice Review Modal */}
      {reviewModalOpen && selectedAddress && selectedState && (
        <div className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
          <div className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 space-y-4 shadow-2xl text-xs">
            <div className="flex items-center justify-between border-b border-slate-100 dark:border-slate-800 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-[#11223E] dark:text-white">
                  {t('ملخص الفاتورة النهائية', 'Final Invoice Summary')}
                </h2>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {t('راجع بياناتك ثم أكّد إرسال الطلب', 'Review your details and confirm order')}
                </p>
              </div>
              <button
                type="button"
                disabled={submitting}
                onClick={() => setReviewModalOpen(false)}
                aria-label={t('إغلاق', 'Close')}
                className="min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Delivery & Payment 2-Line Summary */}
            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/80 dark:border-slate-800 space-y-1.5">
              <div className="flex items-center justify-between gap-2">
                <span className="font-extrabold text-[#11223E] dark:text-white">
                  {selectedAddress.recipientName || user.name}
                </span>
                <span dir="ltr" className="font-mono-num text-slate-600 dark:text-slate-300">
                  {selectedAddress.phone || user.phone}
                </span>
              </div>
              <div className="flex items-center justify-between gap-2 text-slate-600 dark:text-slate-300">
                <span className="truncate">
                  {locale === 'ar' ? selectedState.nameAr : selectedState.nameEn} — {selectedAddress.city}،{' '}
                  {selectedAddress.area}
                </span>
                <button
                  type="button"
                  disabled={submitting}
                  onClick={() => {
                    setReviewModalOpen(false);
                    setEditingAddress(selectedAddress);
                    setAddressSheetOpen(true);
                  }}
                  className="text-[#B38B2D] font-bold hover:underline shrink-0"
                >
                  {t('تعديل', 'Edit')}
                </button>
              </div>
              <div className="pt-1 border-t border-slate-200/70 dark:border-slate-800 flex items-center justify-between text-[11px]">
                <span className="text-slate-500">{t('طريقة الدفع:', 'Payment:')}</span>
                <span className="font-bold text-[#11223E] dark:text-[#E2BD5B]">
                  {getPaymentMethodLabel(paymentMethod, locale)}
                </span>
              </div>
            </div>

            {/* Clean Receipt Items */}
            <div className="divide-y divide-slate-100 dark:divide-slate-800 border-y border-slate-100 dark:border-slate-800 max-h-44 overflow-y-auto">
              {cart.map((item) => {
                const prod = products.find((p) => p.id === item.productId);
                if (!prod) return null;
                const lensExtra = item.prescription?.lensExtraPriceSdg || 0;
                const lineTotal = (item.unitPriceSdg + lensExtra) * item.quantity;
                const lensLine = formatLensSummaryLine(item.prescription, lensOptions, locale);
                return (
                  <div key={item.id} className="py-2 flex items-center justify-between gap-3">
                    <div className="min-w-0">
                      <div className="font-bold truncate text-[#11223E] dark:text-slate-100">
                        {locale === 'ar' ? prod.titleAr : prod.titleEn} × {item.quantity}
                      </div>
                      {(item.variantLabel || item.selectedOptions?.size || lensLine) && (
                        <div className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                          {[
                            item.variantLabel,
                            item.selectedOptions?.size
                              ? `${t('المقاس:', 'Size:')} ${item.selectedOptions.size}`
                              : '',
                            lensLine,
                          ]
                            .filter(Boolean)
                            .join(' · ')}
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

            {/* Clean Receipt Totals */}
            <div className="p-3.5 rounded-xl border border-[#D9B24C]/45 bg-[#D9B24C]/10 space-y-1.5">
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-300">
                  {t('المنتجات والعدسات', 'Items & Lenses')}
                </span>
                <span className="font-mono-num font-bold">{formatSdg(subtotalSdg)}</span>
              </div>
              {discountSdg > 0 && (
                <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                  <span>{t('الخصم', 'Discount')}</span>
                  <span className="font-mono-num font-bold">− {formatSdg(discountSdg)}</span>
                </div>
              )}
              <div className="flex justify-between">
                <span className="text-slate-600 dark:text-slate-300">
                  {t('رسوم التوصيل', 'Delivery Fee')}
                </span>
                <span className="font-mono-num font-bold">{formatSdg(deliveryFeeSdg)}</span>
              </div>
              <div className="flex justify-between text-sm font-extrabold border-t border-[#D9B24C]/40 pt-2">
                <span>{t('الإجمالي النهائي', 'Total')}</span>
                <span className="font-mono-num text-[#11223E] dark:text-[#E2BD5B]">
                  {formatSdg(totalSdg)}
                </span>
              </div>
              {paymentMethod === 'split' && (
                <div className="pt-1.5 border-t border-[#D9B24C]/30 space-y-1 text-[11px]">
                  <div className="flex justify-between font-bold">
                    <span>{t('المدفوع الآن (بنكك):', 'Bankak Deposit:')}</span>
                    <span className="font-mono-num text-[#11223E] dark:text-[#E2BD5B]">
                      {formatSdg(splitBreakdown.bankakAmount)}
                    </span>
                  </div>
                  <div className="flex justify-between font-bold text-emerald-700 dark:text-emerald-400">
                    <span>{t('المتبقي عند الاستلام:', 'Due on Delivery:')}</span>
                    <span className="font-mono-num">{formatSdg(splitBreakdown.codAmount)}</span>
                  </div>
                </div>
              )}
            </div>

            {customerNote.trim() && (
              <p className="text-[11px] text-slate-500 dark:text-slate-400 px-1">
                <strong>{t('ملاحظتك:', 'Note:')}</strong> {customerNote.trim()}
              </p>
            )}

            <div className="flex items-center gap-2 pt-1">
              <button
                type="button"
                disabled={submitting}
                onClick={() => setReviewModalOpen(false)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-slate-200 dark:border-slate-700 font-bold disabled:opacity-50"
              >
                {t('رجوع', 'Back')}
              </button>
              <button
                type="button"
                disabled={submitting}
                onClick={() => void handleConfirmPlaceOrder()}
                className="flex-1 min-h-[44px] px-5 py-2 rounded-xl bg-[#11223E] text-white dark:bg-[#D9B24C] dark:text-[#11223E] font-extrabold inline-flex items-center justify-center gap-2 disabled:opacity-50"
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
