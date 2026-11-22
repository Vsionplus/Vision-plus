import React, { useMemo, useState } from 'react';
import {
  X,
  ZoomIn,
  ZoomOut,
  Heart,
  Share2,
  Star,
  Upload,
  ShoppingBag,
} from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { formatSdg, formatShortDate } from '../utils/format';
import { ContactLensSelection, LensOptionType, PrescriptionData } from '../types';
import { ResilientImage } from './ResilientImage';

export const ProductDetailModal: React.FC = () => {
  const {
    locale,
    t,
    selectedProductId,
    openProduct,
    products,
    brands,
    categories,
    lensOptions,
    appTexts,
    appearance,
    user,
    toggleFavorite,
    addReview,
    addToCart,
    savePrescription,
    showToast,
  } = useStore();

  const product = useMemo(
    () => products.find((p) => p.id === selectedProductId) || null,
    [products, selectedProductId]
  );

  const [imgIdx, setImgIdx] = useState(0);
  const [zoomed, setZoomed] = useState(false);
  const [variantId, setVariantId] = useState<string>('');
  const [qty, setQty] = useState(1);

  // Contact lens separate right/left eye powers
  const [clRightSph, setClRightSph] = useState('-1.00');
  const [clRightCyl, setClRightCyl] = useState('0.00');
  const [clRightAxis, setClRightAxis] = useState('0');
  const [clLeftSph, setClLeftSph] = useState('-1.00');
  const [clLeftCyl, setClLeftCyl] = useState('0.00');
  const [clLeftAxis, setClLeftAxis] = useState('0');

  // Prescription options for frames/reading
  const [lensOption, setLensOption] = useState<LensOptionType>('none');
  const [rxMode, setRxMode] = useState<'manual' | 'image'>('manual');
  const [odSph, setOdSph] = useState('-1.25');
  const [odCyl, setOdCyl] = useState('-0.50');
  const [odAxis, setOdAxis] = useState('90');
  const [osSph, setOsSph] = useState('-1.50');
  const [osCyl, setOsCyl] = useState('-0.25');
  const [osAxis, setOsAxis] = useState('85');
  const [pd, setPd] = useState('63');
  const [rxImageUrl, setRxImageUrl] = useState('');
  const [saveRxToProfile, setSaveRxToProfile] = useState(false);
  const [rxLabel, setRxLabel] = useState('');

  // Reviews
  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  if (!product) return null;

  const visibleLensOptions = lensOptions.filter((o) => o.visible);
  const approvedReviews = product.reviews.filter((r) => r.status === 'approved');
  const activeVariant =
    product.variants.find((v) => v.id === variantId) || product.variants[0];
  const isFav = user.favoriteProductIds.includes(product.id);
  const brand = brands.find((b) => b.id === product.brandId);
  const category = categories.find((c) => c.id === product.categoryId);
  const title = locale === 'ar' ? product.titleAr : product.titleEn;

  const selectedLensObj =
    visibleLensOptions.find((l) => l.id === lensOption) || visibleLensOptions[0];
  const unitFinalSdg =
    product.priceSdg + (product.requiresPrescriptionOption ? selectedLensObj?.extraSdg || 0 : 0);

  const isUnavailable = Boolean(product.isOutOfStock) || product.stock <= 0;

  const displayedMainImage =
    activeVariant?.imageUrl && imgIdx === 0
      ? activeVariant.imageUrl
      : product.images[imgIdx] || product.images[0];

  const handleRxFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      if (typeof reader.result === 'string') setRxImageUrl(reader.result);
    };
    reader.readAsDataURL(file);
  };

  const applySavedPrescription = (id: string) => {
    const found = user.prescriptions.find((p) => p.id === id);
    if (!found) return;
    setRxMode('manual');
    setOdSph(found.rightEye.sph);
    setOdCyl(found.rightEye.cyl);
    setOdAxis(found.rightEye.axis);
    setOsSph(found.leftEye.sph);
    setOsCyl(found.leftEye.cyl);
    setOsAxis(found.leftEye.axis);
    setPd(found.pd);
    if (lensOption === 'none') setLensOption('single_vision');
    showToast(t('تم تعبئة الوصفة المحفوظة', 'Saved prescription applied'));
  };

  const handleAddToCart = () => {
    if (isUnavailable) return;
    let prescription: PrescriptionData | undefined;
    if (product.requiresPrescriptionOption && lensOption !== 'none') {
      if (rxMode === 'image' && !rxImageUrl) {
        showToast(t('يرجى رفع صورة الوصفة الطبية أولاً', 'Please upload your prescription photo'));
        return;
      }
      prescription = {
        mode: rxMode,
        lensOption,
        lensExtraPriceSdg: selectedLensObj?.extraSdg || 0,
        ...(rxMode === 'manual'
          ? {
              rightEye: { sph: odSph, cyl: odCyl, axis: odAxis },
              leftEye: { sph: osSph, cyl: osCyl, axis: osAxis },
              pd,
            }
          : { imageUrl: rxImageUrl }),
      };

      if (saveRxToProfile && rxMode === 'manual') {
        savePrescription({
          label: rxLabel.trim() || t('وصفة محفوظة', 'Saved Rx'),
          rightEye: { sph: odSph, cyl: odCyl, axis: odAxis },
          leftEye: { sph: osSph, cyl: osCyl, axis: osAxis },
          pd,
        });
      }
    }

    let contactLensSelection: ContactLensSelection | undefined;
    if (product.contactLensSpecs) {
      contactLensSelection = {
        rightSph: clRightSph,
        rightCyl: clRightCyl,
        rightAxis: clRightAxis,
        leftSph: clLeftSph,
        leftCyl: clLeftCyl,
        leftAxis: clLeftAxis,
      };
    }

    addToCart({
      productId: product.id,
      variantId: activeVariant?.id,
      variantLabel: activeVariant
        ? locale === 'ar'
          ? activeVariant.colorNameAr
          : activeVariant.colorNameEn
        : undefined,
      quantity: qty,
      unitPriceSdg: product.priceSdg,
      prescription,
      contactLensSelection,
    });
    openProduct(null);
  };

  return (
    <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-xs overflow-y-auto p-3 sm:p-6 flex justify-center items-start">
      <div className="w-full max-w-5xl bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-2xl overflow-hidden shadow-2xl my-4">
        <div className="px-5 py-3.5 border-b border-stone-200 dark:border-zinc-800 flex items-center justify-between">
          <div className="flex items-center gap-2 text-xs text-stone-500 dark:text-zinc-400">
            <span>{brand ? (locale === 'ar' ? brand.nameAr : brand.nameEn) : ''}</span>
            <span aria-hidden="true">·</span>
            <span>{category ? (locale === 'ar' ? category.nameAr : category.nameEn) : ''}</span>
            <span aria-hidden="true">·</span>
            <span className="font-mono-num">{product.sku}</span>
          </div>
          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => toggleFavorite(product.id)}
              className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800"
              aria-label={t('المفضلة', 'Favorite')}
            >
              <Heart className={`w-4 h-4 ${isFav ? 'fill-rose-600 text-rose-600' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => {
                if (navigator.clipboard) navigator.clipboard.writeText(window.location.href);
                showToast(t('تم نسخ رابط المنتج', 'Product link copied'));
              }}
              className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800"
              aria-label={t('مشاركة', 'Share')}
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => openProduct(null)}
              className="p-2 rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800"
              aria-label={t('إغلاق', 'Close')}
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="grid lg:grid-cols-12 gap-6 p-5 sm:p-7">
          {/* Gallery Column */}
          <div className="lg:col-span-5 space-y-3">
            <div className="relative aspect-[4/3] rounded-xl overflow-hidden bg-stone-100 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800">
              <ResilientImage
                src={displayedMainImage}
                alt={title}
                className={`w-full h-full object-cover transition-transform duration-300 ${
                  zoomed ? 'scale-150 cursor-zoom-out' : 'cursor-zoom-in'
                }`}
              />
              <button
                type="button"
                onClick={() => setZoomed(!zoomed)}
                className="absolute bottom-3 end-3 px-2.5 py-1.5 rounded-lg bg-white/90 dark:bg-zinc-900/90 border border-stone-200 dark:border-zinc-700 text-xs font-medium flex items-center gap-1"
              >
                {zoomed ? <ZoomOut className="w-3.5 h-3.5" /> : <ZoomIn className="w-3.5 h-3.5" />}
                {zoomed ? t('تصغير', 'Reset') : t('تكبير', 'Zoom')}
              </button>
            </div>

            {product.images.length > 1 && (
              <div className="flex gap-2">
                {product.images.map((img, i) => (
                  <button
                    key={img + i}
                    type="button"
                    onClick={() => setImgIdx(i)}
                    className={`w-20 aspect-[4/3] rounded-lg overflow-hidden border-2 ${
                      imgIdx === i ? 'border-[var(--vp-secondary)]' : 'border-transparent'
                    }`}
                  >
                    <ResilientImage src={img} alt="" className="w-full h-full object-cover" />
                  </button>
                ))}
              </div>
            )}

            {/* Approved Reviews Section */}
            <div className="pt-4 border-t border-stone-200 dark:border-zinc-800 space-y-3">
              <div className="flex items-center justify-between">
                <h3 className="text-sm font-bold">{t('تقييمات العملاء', 'Customer Reviews')}</h3>
                <span className="flex items-center gap-1 text-xs font-semibold tabular-nums">
                  <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                  {product.rating.toFixed(1)} ({approvedReviews.length})
                </span>
              </div>

              <div className="space-y-2 max-h-40 overflow-y-auto">
                {approvedReviews.length === 0 ? (
                  <p className="text-xs text-stone-500 dark:text-zinc-400">
                    {t('كن أول من يقيّم هذا المنتج', 'Be the first to review this product')}
                  </p>
                ) : (
                  approvedReviews.map((r) => (
                    <div key={r.id} className="p-2.5 rounded-lg bg-stone-50 dark:bg-zinc-900 text-xs space-y-1">
                      <div className="flex items-center justify-between font-semibold">
                        <span>{r.userName}</span>
                        <span className="text-amber-600 tabular-nums">{'★'.repeat(r.rating)}</span>
                      </div>
                      <p className="text-stone-600 dark:text-zinc-400">{r.comment}</p>
                    </div>
                  ))
                )}
              </div>

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (!reviewComment.trim()) return;
                  addReview(product.id, reviewRating, reviewComment.trim());
                  setReviewComment('');
                }}
                className="flex gap-2"
              >
                <select
                  value={reviewRating}
                  onChange={(e) => setReviewRating(Number(e.target.value))}
                  className="px-2 py-1.5 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-xs"
                >
                  {[5, 4, 3, 2, 1].map((n) => (
                    <option key={n} value={n}>
                      {n} ★
                    </option>
                  ))}
                </select>
                <input
                  type="text"
                  value={reviewComment}
                  onChange={(e) => setReviewComment(e.target.value)}
                  placeholder={t('أضف تقييمك...', 'Write a review...')}
                  className="flex-1 px-3 py-1.5 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-xs"
                />
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900 text-xs font-semibold"
                >
                  {t('إرسال', 'Post')}
                </button>
              </form>
            </div>
          </div>

          {/* Purchase & Clinical Options Column */}
          <div className="lg:col-span-7 space-y-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold">{title}</h2>
              <div className="mt-2 flex items-baseline gap-3">
                <span className="font-mono-num text-2xl font-extrabold text-[#11223E] dark:text-[#E2BD5B] tabular-nums">
                  {formatSdg(unitFinalSdg)}
                </span>
                {product.oldPriceSdg && product.oldPriceSdg > product.priceSdg && (
                  <span className="font-mono-num text-sm text-stone-400 line-through tabular-nums">
                    {formatSdg(product.oldPriceSdg)}
                  </span>
                )}
                <span className="text-xs font-medium text-stone-500 dark:text-zinc-400">
                  {!isUnavailable
                    ? t(`متوفر (${product.stock} قطعة)`, `In stock (${product.stock})`)
                    : locale === 'ar'
                    ? appTexts.btnOutOfStockAr
                    : appTexts.btnOutOfStockEn}
                </span>
              </div>
              <p className="mt-3 text-sm text-stone-600 dark:text-zinc-300 leading-relaxed">
                {locale === 'ar' ? product.descriptionAr : product.descriptionEn}
              </p>
            </div>

            {product.variants.length > 0 && (
              <div className="space-y-2">
                <span className="block text-xs font-bold text-stone-700 dark:text-zinc-300">
                  {t('اللون / الخيار', 'Color Variant')}:{' '}
                  {activeVariant && (locale === 'ar' ? activeVariant.colorNameAr : activeVariant.colorNameEn)}
                </span>
                <div className="flex flex-wrap gap-2">
                  {product.variants.map((v) => {
                    const selected = activeVariant?.id === v.id;
                    return (
                      <button
                        key={v.id}
                        type="button"
                        onClick={() => {
                          setVariantId(v.id);
                          setImgIdx(0);
                        }}
                        className={`px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-2 ${
                          selected
                            ? 'border-[var(--vp-secondary)] bg-[#D9B24C]/15 font-bold'
                            : 'border-stone-200 dark:border-zinc-700'
                        }`}
                      >
                        <span
                          className="w-3.5 h-3.5 rounded-full border border-black/15"
                          style={{ backgroundColor: v.colorHex }}
                        />
                        {locale === 'ar' ? v.colorNameAr : v.colorNameEn}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}

            {product.lensSolutionSpecs && (
              <div className="p-4 rounded-xl bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 grid grid-cols-2 gap-4 text-xs">
                <div>
                  <span className="text-stone-500 dark:text-zinc-400 block">{t('حجم العبوة', 'Volume')}</span>
                  <span className="font-mono-num font-bold text-sm">{product.lensSolutionSpecs.volumeMl} ml</span>
                </div>
                <div>
                  <span className="text-stone-500 dark:text-zinc-400 block">{t('تاريخ الانتهاء', 'Expiry Date')}</span>
                  <span className="font-mono-num font-bold text-sm">
                    {formatShortDate(product.lensSolutionSpecs.expiryDate, locale)}
                  </span>
                </div>
              </div>
            )}

            {product.contactLensSpecs && (
              <div className="p-4 rounded-xl bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2 text-xs">
                  <span className="font-bold">
                    {t('مقاسات العدسات اللاصقة (لكل عين)', 'Contact Lens Power (OD & OS)')}
                  </span>
                  <span className="text-stone-500 dark:text-zinc-400 font-mono-num">
                    BC {product.contactLensSpecs.baseCurve} · {product.contactLensSpecs.quantityPerBox}{' '}
                    {t('عدسة/علبة', 'lenses/box')}
                  </span>
                </div>

                <div className="grid sm:grid-cols-2 gap-3 text-xs">
                  <div className="p-3 rounded-lg bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 space-y-2">
                    <span className="font-bold block text-[#11223E] dark:text-[#E2BD5B]">
                      {t('العين اليمنى (OD)', 'Right Eye (OD)')}
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      <div>
                        <label className="text-[11px] text-stone-500">SPH</label>
                        <select
                          value={clRightSph}
                          onChange={(e) => setClRightSph(e.target.value)}
                          className="w-full p-1.5 rounded border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 font-mono-num"
                        >
                          {product.contactLensSpecs.sphOptions.map((o) => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-stone-500">CYL</label>
                        <select
                          value={clRightCyl}
                          onChange={(e) => setClRightCyl(e.target.value)}
                          className="w-full p-1.5 rounded border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 font-mono-num"
                        >
                          {product.contactLensSpecs.cylOptions.map((o) => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-stone-500">AXIS</label>
                        <select
                          value={clRightAxis}
                          onChange={(e) => setClRightAxis(e.target.value)}
                          className="w-full p-1.5 rounded border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 font-mono-num"
                        >
                          {product.contactLensSpecs.axisOptions.map((o) => (
                            <option key={o} value={o}>{o}°</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>

                  <div className="p-3 rounded-lg bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 space-y-2">
                    <span className="font-bold block text-[#11223E] dark:text-[#E2BD5B]">
                      {t('العين اليسرى (OS)', 'Left Eye (OS)')}
                    </span>
                    <div className="grid grid-cols-3 gap-1.5">
                      <div>
                        <label className="text-[11px] text-stone-500">SPH</label>
                        <select
                          value={clLeftSph}
                          onChange={(e) => setClLeftSph(e.target.value)}
                          className="w-full p-1.5 rounded border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 font-mono-num"
                        >
                          {product.contactLensSpecs.sphOptions.map((o) => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-stone-500">CYL</label>
                        <select
                          value={clLeftCyl}
                          onChange={(e) => setClLeftCyl(e.target.value)}
                          className="w-full p-1.5 rounded border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 font-mono-num"
                        >
                          {product.contactLensSpecs.cylOptions.map((o) => (
                            <option key={o} value={o}>{o}</option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="text-[11px] text-stone-500">AXIS</label>
                        <select
                          value={clLeftAxis}
                          onChange={(e) => setClLeftAxis(e.target.value)}
                          className="w-full p-1.5 rounded border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 font-mono-num"
                        >
                          {product.contactLensSpecs.axisOptions.map((o) => (
                            <option key={o} value={o}>{o}°</option>
                          ))}
                        </select>
                      </div>
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Admin-editable Lens Options */}
            {product.requiresPrescriptionOption && visibleLensOptions.length > 0 && (
              <div className="p-4 rounded-xl bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 space-y-4">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-xs font-bold">
                    {t('خيارات العدسات والوصفة الطبية (Rx)', 'Lens Options & Prescription')}
                  </span>

                  {user.prescriptions.length > 0 && (
                    <select
                      defaultValue=""
                      onChange={(e) => e.target.value && applySavedPrescription(e.target.value)}
                      className="px-2.5 py-1 rounded-md border border-[var(--vp-secondary)]/50 bg-white dark:bg-[#181B1E] text-xs font-medium"
                    >
                      <option value="">{t('استخدم وصفة محفوظة...', 'Use saved Rx...')}</option>
                      {user.prescriptions.map((rx) => (
                        <option key={rx.id} value={rx.id}>
                          {rx.label}
                        </option>
                      ))}
                    </select>
                  )}
                </div>

                <div className="grid sm:grid-cols-2 gap-2">
                  {visibleLensOptions.map((opt) => (
                    <button
                      key={opt.id}
                      type="button"
                      onClick={() => setLensOption(opt.id)}
                      className={`p-2.5 rounded-lg border text-start text-xs flex items-center justify-between gap-2 transition-colors ${
                        lensOption === opt.id
                          ? 'border-[var(--vp-secondary)] bg-[#D9B24C]/15 font-semibold'
                          : 'border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E]'
                      }`}
                    >
                      <span>{locale === 'ar' ? opt.labelAr : opt.labelEn}</span>
                      <span className="font-mono-num text-[11px] text-[#B38B2D] dark:text-[#E2BD5B] shrink-0">
                        {opt.extraSdg === 0 ? t('مجاني', 'Free') : `+${formatSdg(opt.extraSdg)}`}
                      </span>
                    </button>
                  ))}
                </div>

                {lensOption !== 'none' && (
                  <div className="space-y-3 pt-2 border-t border-stone-200 dark:border-zinc-800">
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setRxMode('manual')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold ${
                          rxMode === 'manual'
                            ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900'
                            : 'bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700'
                        }`}
                      >
                        {t('إدخال القيم يدوياً', 'Enter Values Manually')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setRxMode('image')}
                        className={`px-3 py-1.5 rounded-lg text-xs font-semibold flex items-center gap-1.5 ${
                          rxMode === 'image'
                            ? 'bg-stone-900 dark:bg-stone-100 text-white dark:text-stone-900'
                            : 'bg-white dark:bg-zinc-800 border border-stone-200 dark:border-zinc-700'
                        }`}
                      >
                        <Upload className="w-3.5 h-3.5" />
                        {t('رفع صورة الكشف', 'Upload Rx Photo')}
                      </button>
                    </div>

                    {rxMode === 'manual' ? (
                      <div className="space-y-3 text-xs">
                        <div className="grid grid-cols-4 gap-2 items-center">
                          <span className="font-bold">OD ({t('يمين', 'Right')})</span>
                          <input value={odSph} onChange={(e) => setOdSph(e.target.value)} placeholder="SPH" className="p-2 rounded border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E] font-mono-num" />
                          <input value={odCyl} onChange={(e) => setOdCyl(e.target.value)} placeholder="CYL" className="p-2 rounded border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E] font-mono-num" />
                          <input value={odAxis} onChange={(e) => setOdAxis(e.target.value)} placeholder="AXIS" className="p-2 rounded border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E] font-mono-num" />
                        </div>
                        <div className="grid grid-cols-4 gap-2 items-center">
                          <span className="font-bold">OS ({t('يسار', 'Left')})</span>
                          <input value={osSph} onChange={(e) => setOsSph(e.target.value)} placeholder="SPH" className="p-2 rounded border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E] font-mono-num" />
                          <input value={osCyl} onChange={(e) => setOsCyl(e.target.value)} placeholder="CYL" className="p-2 rounded border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E] font-mono-num" />
                          <input value={osAxis} onChange={(e) => setOsAxis(e.target.value)} placeholder="AXIS" className="p-2 rounded border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E] font-mono-num" />
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <label className="flex items-center gap-2">
                            <span className="font-bold">PD (mm)</span>
                            <input value={pd} onChange={(e) => setPd(e.target.value)} className="w-20 p-1.5 rounded border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E] font-mono-num" />
                          </label>
                          <label className="flex items-center gap-1.5 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={saveRxToProfile}
                              onChange={(e) => setSaveRxToProfile(e.target.checked)}
                              className="accent-[var(--vp-secondary)]"
                            />
                            <span>{t('حفظ الوصفة في حسابي لإعادة الاستخدام', 'Save Rx to profile')}</span>
                          </label>
                          {saveRxToProfile && (
                            <input
                              type="text"
                              value={rxLabel}
                              onChange={(e) => setRxLabel(e.target.value)}
                              placeholder={t('اسم الوصفة', 'Rx Label')}
                              className="px-2.5 py-1 rounded border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E]"
                            />
                          )}
                        </div>
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <label className="block p-4 rounded-lg border border-dashed border-stone-300 dark:border-zinc-700 text-center cursor-pointer hover:bg-white dark:hover:bg-[#181B1E]">
                          <input type="file" accept="image/*" onChange={handleRxFileChange} className="hidden" />
                          <span className="text-xs font-medium text-[#B38B2D]">
                            {rxImageUrl
                              ? t('تم اختيار صورة الوصفة بنجاح (اضغط للتغيير)', 'Rx photo attached')
                              : t('اختر صورة كشف النظر من جهازك', 'Choose prescription image')}
                          </span>
                        </label>
                        {rxImageUrl && (
                          <img src={rxImageUrl} alt="Rx Preview" className="h-24 rounded-lg object-cover border" />
                        )}
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}

            <div className="flex items-center gap-3 pt-2">
              <div className="flex items-center border border-stone-300 dark:border-zinc-700 rounded-lg">
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.max(1, q - 1))}
                  className="px-3 py-2.5 text-sm font-bold hover:bg-stone-100 dark:hover:bg-zinc-800"
                >
                  −
                </button>
                <span className="px-4 font-mono-num text-sm font-bold tabular-nums">{qty}</span>
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.min(Math.max(1, product.stock), q + 1))}
                  className="px-3 py-2.5 text-sm font-bold hover:bg-stone-100 dark:hover:bg-zinc-800"
                >
                  +
                </button>
              </div>

              <button
                type="button"
                disabled={isUnavailable}
                onClick={handleAddToCart}
                style={{
                  backgroundColor: appearance.secondaryColor,
                  color: appearance.primaryColor,
                }}
                className="flex-1 py-3 px-6 rounded-xl disabled:opacity-50 font-extrabold text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
              >
                <ShoppingBag className="w-4 h-4" />
                <span>
                  {isUnavailable
                    ? locale === 'ar'
                      ? appTexts.btnOutOfStockAr
                      : appTexts.btnOutOfStockEn
                    : `${locale === 'ar' ? appTexts.btnAddToCartAr : appTexts.btnAddToCartEn} · ${formatSdg(unitFinalSdg * qty)}`}
                </span>
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
