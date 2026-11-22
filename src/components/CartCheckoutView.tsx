import React, { useMemo, useState } from 'react';
import {
  Trash2,
  Tag,
  Banknote,
  Building2,
  CreditCard,
  Copy,
  Upload,
  CheckCircle2,
  ShoppingBag,
} from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { PaymentMethod } from '../types';
import { formatSdg, isValidSudanPhone, normalizeSudanPhone } from '../utils/format';
import { ResilientImage } from './ResilientImage';

export const CartCheckoutView: React.FC = () => {
  const {
    locale,
    t,
    cart,
    products,
    coupons,
    settings,
    appTexts,
    appearance,
    user,
    updateCartQty,
    removeFromCart,
    placeOrder,
    openCatalog,
    showToast,
  } = useStore();

  const [couponInput, setCouponInput] = useState('');
  const [appliedCouponCode, setAppliedCouponCode] = useState<string | null>(null);

  const [customerName, setCustomerName] = useState(user.name);
  const [customerPhone, setCustomerPhone] = useState(user.phone);
  const [stateId, setStateId] = useState(user.addresses[0]?.stateId || 'khartoum');
  const [city, setCity] = useState(user.addresses[0]?.city || 'الخرطوم');
  const [area, setArea] = useState(user.addresses[0]?.area || 'العمارات');
  const [addressDetails, setAddressDetails] = useState(
    user.addresses[0]?.details || 'شارع 15، جوار المستشفى'
  );
  const [paymentMethod, setPaymentMethod] = useState<PaymentMethod>('bankak');
  const [bankRef, setBankRef] = useState('');
  const [receiptUrl, setReceiptUrl] = useState('');

  const subtotalSdg = useMemo(
    () =>
      cart.reduce(
        (sum, item) =>
          sum +
          (item.unitPriceSdg + (item.prescription?.lensExtraPriceSdg || 0)) * item.quantity,
        0
      ),
    [cart]
  );

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

  const selectedState =
    settings.deliveryFees.find((s) => s.id === stateId) || settings.deliveryFees[0];
  const deliveryFeeSdg = selectedState ? selectedState.feeSdg : 3500;
  const totalSdg = Math.max(0, subtotalSdg - discountSdg + deliveryFeeSdg);

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

  const handleReceiptUpload = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setReceiptUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const handleSubmitOrder = (e: React.FormEvent) => {
    e.preventDefault();
    if (!customerName.trim()) {
      showToast(t('يرجى كتابة الاسم الكامل', 'Please enter full name'));
      return;
    }
    if (!isValidSudanPhone(customerPhone)) {
      showToast(
        t('يرجى إدخال رقم هاتف سوداني صحيح بصيغة +249', 'Enter a valid Sudan +249 phone number')
      );
      return;
    }
    if (settings.minimumOrderSdg > 0 && subtotalSdg < settings.minimumOrderSdg) {
      showToast(
        t(
          `الحد الأدنى للطلب هو ${formatSdg(settings.minimumOrderSdg)}`,
          `Minimum order is ${formatSdg(settings.minimumOrderSdg)}`
        )
      );
      return;
    }
    if (paymentMethod === 'bankak' && !receiptUrl && !bankRef.trim()) {
      showToast(
        t(
          'يرجى رفع صورة إيصال بنكك أو كتابة رقم العملية المرجعي',
          'Upload Bankak receipt screenshot or enter reference ID'
        )
      );
      return;
    }

    placeOrder({
      customerName: customerName.trim(),
      customerPhone: normalizeSudanPhone(customerPhone),
      stateId,
      city: city.trim(),
      area: area.trim(),
      addressDetails: addressDetails.trim(),
      paymentMethod,
      couponCode: activeCoupon?.code,
      discountSdg,
      deliveryFeeSdg,
      bankTransferReference: bankRef.trim() || undefined,
      bankTransferReceiptUrl: receiptUrl || undefined,
    });
  };

  if (cart.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <div className="w-16 h-16 rounded-2xl bg-stone-100 dark:bg-zinc-800 mx-auto flex items-center justify-center text-stone-400">
          <ShoppingBag className="w-8 h-8" />
        </div>
        <h1 className="text-xl font-bold">
          {locale === 'ar' ? appTexts.emptyCartTitleAr : appTexts.emptyCartTitleEn}
        </h1>
        <p className="text-sm text-stone-500 dark:text-zinc-400">
          {locale === 'ar' ? appTexts.emptyCartDescAr : appTexts.emptyCartDescEn}
        </p>
        <button
          type="button"
          onClick={() => openCatalog('all', '')}
          style={{ backgroundColor: appearance.primaryColor }}
          className="px-6 py-2.5 rounded-xl text-white text-sm font-bold"
        >
          {locale === 'ar' ? appTexts.btnStartShoppingAr : appTexts.btnStartShoppingEn}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
      <h1 className="text-2xl font-extrabold">{t('سلة التسوق وإتمام الطلب', 'Cart & Checkout')}</h1>

      <form onSubmit={handleSubmitOrder} className="grid lg:grid-cols-12 gap-6 items-start">
        <div className="lg:col-span-7 space-y-6">
          <div className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl divide-y divide-stone-100 dark:divide-zinc-800">
            {cart.map((item) => {
              const prod = products.find((p) => p.id === item.productId);
              if (!prod) return null;
              const unitTotal = item.unitPriceSdg + (item.prescription?.lensExtraPriceSdg || 0);
              return (
                <div key={item.id} className="p-4 flex gap-4">
                  <div className="w-24 h-20 rounded-lg overflow-hidden bg-stone-100 dark:bg-zinc-900 shrink-0">
                    <ResilientImage
                      src={prod.images[0]}
                      alt={locale === 'ar' ? prod.titleAr : prod.titleEn}
                      className="w-full h-full object-cover"
                    />
                  </div>
                  <div className="flex-1 min-w-0 space-y-1">
                    <div className="flex items-start justify-between gap-2">
                      <h3 className="text-sm font-bold truncate">
                        {locale === 'ar' ? prod.titleAr : prod.titleEn}
                      </h3>
                      <button
                        type="button"
                        onClick={() => removeFromCart(item.id)}
                        className="text-stone-400 hover:text-rose-600 p-1"
                        aria-label={t('حذف', 'Remove')}
                      >
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>

                    {item.variantLabel && (
                      <p className="text-xs text-stone-500 dark:text-zinc-400">
                        {t('الخيار:', 'Variant:')} {item.variantLabel}
                      </p>
                    )}

                    {item.contactLensSelection && (
                      <p className="text-[11px] font-mono-num text-[#B38B2D]">
                        OD: {item.contactLensSelection.rightSph} | OS: {item.contactLensSelection.leftSph}
                      </p>
                    )}

                    {item.prescription && (
                      <p className="text-[11px] text-[#B38B2D]">
                        {t('عدسات طبية:', 'Rx Lens:')} {item.prescription.lensOption}{' '}
                        {item.prescription.mode === 'manual' && item.prescription.rightEye
                          ? `(OD ${item.prescription.rightEye.sph} / OS ${item.prescription.leftEye?.sph})`
                          : t('(صورة مرفقة)', '(Photo attached)')}
                      </p>
                    )}

                    <div className="pt-2 flex items-center justify-between">
                      <div className="flex items-center border border-stone-200 dark:border-zinc-700 rounded-lg">
                        <button type="button" onClick={() => updateCartQty(item.id, -1)} className="px-2.5 py-1 text-xs font-bold">
                          −
                        </button>
                        <span className="px-2.5 font-mono-num text-xs font-bold tabular-nums">
                          {item.quantity}
                        </span>
                        <button type="button" onClick={() => updateCartQty(item.id, 1)} className="px-2.5 py-1 text-xs font-bold">
                          +
                        </button>
                      </div>
                      <span className="font-mono-num text-sm font-bold tabular-nums">
                        {formatSdg(unitTotal * item.quantity)}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
          </div>

          <div className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <h2 className="text-base font-bold">{t('عنوان التوصيل في السودان', 'Sudan Delivery Address')}</h2>
              {user.addresses.length > 0 && (
                <select
                  defaultValue=""
                  onChange={(e) => {
                    const addr = user.addresses.find((a) => a.id === e.target.value);
                    if (!addr) return;
                    setStateId(addr.stateId);
                    setCity(addr.city);
                    setArea(addr.area);
                    setAddressDetails(addr.details);
                    setCustomerPhone(addr.phone);
                  }}
                  className="px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-xs"
                >
                  <option value="">{t('اختر عنواناً محفوظاً...', 'Pick saved address...')}</option>
                  {user.addresses.map((a) => (
                    <option key={a.id} value={a.id}>
                      {a.label}
                    </option>
                  ))}
                </select>
              )}
            </div>

            <div className="grid sm:grid-cols-2 gap-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">{t('الاسم الكامل', 'Full Name')}</label>
                <input required value={customerName} onChange={(e) => setCustomerName(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900" />
              </div>
              <div>
                <label className="block font-semibold mb-1">{t('رقم الهاتف (+249)', 'Sudan Phone (+249)')}</label>
                <input required dir="ltr" value={customerPhone} onChange={(e) => setCustomerPhone(e.target.value)} placeholder="+249912345678" className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 font-mono-num" />
              </div>
              <div>
                <label className="block font-semibold mb-1">{t('الولاية', 'Sudan State')}</label>
                <select value={stateId} onChange={(e) => setStateId(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900">
                  {settings.deliveryFees.map((st) => (
                    <option key={st.id} value={st.id}>
                      {locale === 'ar' ? st.nameAr : st.nameEn} ({formatSdg(st.feeSdg)})
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">{t('المدينة / المحلية', 'City / Locality')}</label>
                <input required value={city} onChange={(e) => setCity(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900" />
              </div>
              <div>
                <label className="block font-semibold mb-1">{t('الحي / المنطقة', 'Area / Neighborhood')}</label>
                <input required value={area} onChange={(e) => setArea(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900" />
              </div>
              <div>
                <label className="block font-semibold mb-1">{t('وصف العنوان', 'Street / Landmark')}</label>
                <input required value={addressDetails} onChange={(e) => setAddressDetails(e.target.value)} className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900" />
              </div>
            </div>
          </div>

          <div className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
            <h2 className="text-base font-bold">{t('طريقة الدفع', 'Payment Method')}</h2>
            <div className="grid sm:grid-cols-3 gap-3 text-xs">
              <button
                type="button"
                onClick={() => setPaymentMethod('bankak')}
                className={`p-3 rounded-xl border text-start space-y-1 transition-colors ${
                  paymentMethod === 'bankak'
                    ? 'border-[var(--vp-secondary)] bg-[#D9B24C]/15'
                    : 'border-stone-200 dark:border-zinc-700'
                }`}
              >
                <Building2 className="w-5 h-5" style={{ color: appearance.secondaryColor }} />
                <div className="font-bold">{t('تحويل بنكي (بنكك)', 'Bankak Transfer')}</div>
                <div className="text-[11px] text-stone-500 dark:text-zinc-400">
                  {t('بنك الخرطوم وباقي البنوك', 'Bank of Khartoum & local banks')}
                </div>
              </button>

              <button
                type="button"
                onClick={() => setPaymentMethod('cod')}
                className={`p-3 rounded-xl border text-start space-y-1 transition-colors ${
                  paymentMethod === 'cod'
                    ? 'border-[var(--vp-secondary)] bg-[#D9B24C]/15'
                    : 'border-stone-200 dark:border-zinc-700'
                }`}
              >
                <Banknote className="w-5 h-5" style={{ color: appearance.secondaryColor }} />
                <div className="font-bold">{t('الدفع عند الاستلام', 'Cash on Delivery')}</div>
                <div className="text-[11px] text-stone-500 dark:text-zinc-400">
                  {t('نقداً لمندوب التوصيل', 'Pay cash on delivery')}
                </div>
              </button>

              <div className="p-3 rounded-xl border border-dashed border-stone-200 dark:border-zinc-800 text-start space-y-1 opacity-65">
                <CreditCard className="w-5 h-5 text-stone-400" />
                <div className="font-bold">{t('الدفع الإلكتروني', 'Online Card Gateway')}</div>
                <div className="text-[11px] text-stone-500 dark:text-zinc-400">
                  {t('بوابة الدفع جاهزة للتفعيل لاحقاً', 'Extensible gateway adapter ready')}
                </div>
              </div>
            </div>

            {paymentMethod === 'bankak' && (
              <div className="p-4 rounded-xl bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 space-y-3 text-xs">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-bold text-sm">{settings.bankakBranchAr}</div>
                    <div className="text-stone-600 dark:text-zinc-400 mt-0.5">
                      {t('اسم الحساب:', 'Account Name:')} {settings.bankakAccountName}
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(settings.bankakAccountNumber);
                      showToast(t('تم نسخ رقم حساب بنكك', 'Bankak account copied'));
                    }}
                    className="px-3 py-1.5 rounded-lg bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-700 font-mono-num font-bold flex items-center gap-1.5"
                  >
                    <span>{settings.bankakAccountNumber}</span>
                    <Copy className="w-3.5 h-3.5" style={{ color: appearance.secondaryColor }} />
                  </button>
                </div>

                {settings.otherBankDetailsAr && (
                  <p className="text-[11px] text-stone-500 dark:text-zinc-400">{settings.otherBankDetailsAr}</p>
                )}

                <div className="grid sm:grid-cols-2 gap-3 pt-2">
                  <div>
                    <label className="block font-semibold mb-1">
                      {t('رقم العملية المرجعي', 'Transfer Reference ID')}
                    </label>
                    <input value={bankRef} onChange={(e) => setBankRef(e.target.value)} placeholder="BNK-..." className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E] font-mono-num" />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">
                      {t('صورة إشعار التحويل (بنكك)', 'Upload Transfer Receipt')}
                    </label>
                    <label className="flex items-center justify-center gap-2 px-3 py-2 rounded-lg border border-dashed border-[var(--vp-secondary)] bg-white dark:bg-[#181B1E] font-semibold cursor-pointer">
                      <Upload className="w-4 h-4" />
                      <span>{receiptUrl ? t('تم رفع الإيصال ✓', 'Receipt Uploaded ✓') : t('اختر لقطة الشاشة', 'Select Screenshot')}</span>
                      <input type="file" accept="image/*" onChange={handleReceiptUpload} className="hidden" />
                    </label>
                  </div>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="lg:col-span-5 bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-5 space-y-5 sticky top-28">
          <h2 className="text-base font-bold">{t('ملخص الطلب', 'Order Summary')}</h2>

          {settings.minimumOrderSdg > 0 && (
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {t(`الحد الأدنى للطلب: ${formatSdg(settings.minimumOrderSdg)}`, `Minimum order: ${formatSdg(settings.minimumOrderSdg)}`)}
            </p>
          )}

          <div className="flex gap-2">
            <div className="relative flex-1">
              <Tag className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-stone-400" />
              <input
                type="text"
                value={couponInput}
                onChange={(e) => setCouponInput(e.target.value)}
                placeholder={t('كود خصم (جرب NILE10)', 'Coupon code')}
                className="w-full ps-9 pe-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-xs font-mono-num uppercase"
              />
            </div>
            <button type="button" onClick={handleApplyCoupon} className="px-4 py-2 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-bold">
              {t('تطبيق', 'Apply')}
            </button>
          </div>

          <div className="space-y-2.5 text-sm border-t border-stone-100 dark:border-zinc-800 pt-4">
            <div className="flex justify-between">
              <span className="text-stone-600 dark:text-zinc-400">{t('المجموع الفرعي', 'Subtotal')}</span>
              <span className="font-mono-num font-semibold tabular-nums">{formatSdg(subtotalSdg)}</span>
            </div>
            {discountSdg > 0 && (
              <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                <span>{t('الخصم', 'Discount')} ({activeCoupon?.code})</span>
                <span className="font-mono-num font-semibold tabular-nums">− {formatSdg(discountSdg)}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-stone-600 dark:text-zinc-400">
                {t('رسوم التوصيل', 'Delivery Fee')} ({locale === 'ar' ? selectedState?.nameAr : selectedState?.nameEn})
              </span>
              <span className="font-mono-num font-semibold tabular-nums">{formatSdg(deliveryFeeSdg)}</span>
            </div>
            <div className="flex justify-between text-base font-extrabold pt-3 border-t border-stone-200 dark:border-zinc-800">
              <span>{t('الإجمالي النهائي', 'Total')}</span>
              <span className="font-mono-num text-[#B38B2D] dark:text-[#E2BD5B] tabular-nums">
                {formatSdg(totalSdg)}
              </span>
            </div>
          </div>

          <button
            type="submit"
            style={{ backgroundColor: appearance.secondaryColor, color: appearance.primaryColor }}
            className="w-full py-3.5 px-6 rounded-xl font-extrabold text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
          >
            <CheckCircle2 className="w-4 h-4" />
            <span>{locale === 'ar' ? appTexts.btnCheckoutAr : appTexts.btnCheckoutEn}</span>
          </button>
        </div>
      </form>
    </div>
  );
};
