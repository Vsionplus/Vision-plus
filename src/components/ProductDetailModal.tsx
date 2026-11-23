import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  Edit3,
  Eye,
  Heart,
  Share2,
  ShoppingBag,
  Sparkles,
  Star,
  Trash2,
  X,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { formatSdg, formatShortDate } from '../utils/format';
import {
  ExtraLensOptionId,
  MirrorColorId,
  PrescriptionData,
  VisionType,
} from '../types';
import {
  EXTRA_OPTION_IDS,
  MIRROR_COLOR_OPTIONS,
  VISION_TYPE_IDS,
  calculateLensPricingBreakdown,
  getExtraOptionLabel,
  getMirrorColorLabel,
  getVisionTypeLabel,
  hasCustomLensOrRx,
  isContactLensProduct,
  isPrescriptionEligibleProduct,
  resolveExtraOptions,
  resolveVisionType,
} from '../utils/prescription';
import { ResilientImage } from './ResilientImage';
import { PrescriptionSheet } from './PrescriptionSheet';

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

  const [draftPrescription, setDraftPrescription] = useState<PrescriptionData | undefined>(
    undefined
  );
  const [rxSheetOpen, setRxSheetOpen] = useState(false);

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  useEffect(() => {
    setImgIdx(0);
    setZoomed(false);
    setVariantId('');
    setQty(1);
    setDraftPrescription(undefined);
    setRxSheetOpen(false);
  }, [selectedProductId]);

  const visibleVisionTypes = useMemo(
    () =>
      lensOptions.filter(
        (o) =>
          o.visible &&
          (o.kind === 'vision_type' || VISION_TYPE_IDS.includes(o.id as VisionType)) &&
          o.id !== 'none'
      ),
    [lensOptions]
  );

  const visibleExtraOptions = useMemo(
    () =>
      lensOptions.filter(
        (o) =>
          o.visible &&
          (o.kind === 'extra_option' || EXTRA_OPTION_IDS.includes(o.id as ExtraLensOptionId))
      ),
    [lensOptions]
  );

  if (!product) return null;

  const isRxEligible = isPrescriptionEligibleProduct(product, categories);
  const isContact = isContactLensProduct(product, categories);
  const approvedReviews = product.reviews.filter((r) => r.status === 'approved');
  const activeVariant =
    product.variants.find((v) => v.id === variantId) || product.variants[0];
  const isFav = user.favoriteProductIds.includes(product.id);
  const brand = brands.find((b) => b.id === product.brandId);
  const category = categories.find((c) => c.id === product.categoryId);
  const title = locale === 'ar' ? product.titleAr : product.titleEn;

  const activeVisionType = isContact ? 'none' : resolveVisionType(draftPrescription);
  const activeExtraOptions = isContact ? [] : resolveExtraOptions(draftPrescription);
  const activeMirrorColor: MirrorColorId = draftPrescription?.mirrorColor || 'silver';

  const pricing = isContact
    ? calculateLensPricingBreakdown('none', [], lensOptions)
    : calculateLensPricingBreakdown(activeVisionType, activeExtraOptions, lensOptions);

  const lensExtraSdg = isContact ? 0 : pricing.totalExtraSdg;
  const unitFinalSdg = product.priceSdg + lensExtraSdg;
  const isUnavailable = Boolean(product.isOutOfStock) || product.stock <= 0;

  const syncInlineLensSelection = (
    nextVision: VisionType,
    nextExtras: ExtraLensOptionId[],
    nextMirror: MirrorColorId
  ) => {
    const nextPricing = calculateLensPricingBreakdown(nextVision, nextExtras, lensOptions);
    const hasEnteredRx = Boolean(
      draftPrescription &&
        (draftPrescription.type === 'manual' ||
          draftPrescription.type === 'image' ||
          draftPrescription.type === 'later' ||
          draftPrescription.notes)
    );

    if (
      nextPricing.visionType === 'none' &&
      nextPricing.extraOptions.length === 0 &&
      !hasEnteredRx
    ) {
      setDraftPrescription(undefined);
      return;
    }

    const base: PrescriptionData = draftPrescription
      ? { ...draftPrescription }
      : {
          type: 'none',
          mode: 'none',
          lensOption: 'none',
          lensExtraPriceSdg: 0,
        };

    setDraftPrescription({
      ...base,
      visionType: nextPricing.visionType,
      visionTypePriceSdg: nextPricing.visionTypePriceSdg,
      extraOptions:
        nextPricing.extraOptions.length > 0 ? nextPricing.extraOptions : undefined,
      extraOptionsPricesSdg:
        nextPricing.extraOptions.length > 0 ? nextPricing.extraOptionsPricesSdg : undefined,
      mirrorColor: nextPricing.extraOptions.includes('mirror') ? nextMirror : undefined,
      lensOption:
        nextPricing.visionType !== 'none'
          ? nextPricing.visionType
          : nextPricing.extraOptions[0] || 'none',
      lensExtraPriceSdg: nextPricing.totalExtraSdg,
    });
  };

  const handleToggleExtra = (id: ExtraLensOptionId) => {
    const nextExtras = activeExtraOptions.includes(id)
      ? activeExtraOptions.filter((x) => x !== id)
      : [...activeExtraOptions, id];
    syncInlineLensSelection(activeVisionType, nextExtras, activeMirrorColor);
  };

  const displayedMainImage =
    activeVariant?.imageUrl && imgIdx === 0
      ? activeVariant.imageUrl
      : product.images[imgIdx] || product.images[0];

  const handleAddToCart = () => {
    if (isUnavailable) return;

    const variantColorLabel = activeVariant
      ? locale === 'ar'
        ? activeVariant.colorNameAr
        : activeVariant.colorNameEn
      : undefined;

    const finalPrescription = hasCustomLensOrRx(draftPrescription)
      ? {
          ...draftPrescription!,
          lensExtraPriceSdg: lensExtraSdg,
        }
      : undefined;

    addToCart({
      productId: product.id,
      variantId: activeVariant?.id,
      variantLabel: variantColorLabel,
      selectedOptions:
        variantColorLabel || product.contactLensSpecs
          ? {
              color: variantColorLabel,
              quantityPerBox: product.contactLensSpecs?.quantityPerBox,
            }
          : undefined,
      quantity: qty,
      unitPriceSdg: product.priceSdg,
      prescription: finalPrescription,
    });
    openProduct(null);
  };

  const hasRxEntered = Boolean(draftPrescription && draftPrescription.type !== 'none');
  const hasAnyLensChoices =
    activeVisionType !== 'none' || activeExtraOptions.length > 0;

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
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800"
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
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800"
              aria-label={t('مشاركة', 'Share')}
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => openProduct(null)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-lg hover:bg-stone-100 dark:hover:bg-zinc-800"
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

          {/* Purchase & Optional Lens / Prescription Column */}
          <div className="lg:col-span-7 space-y-5">
            <div>
              <h2 className="text-xl sm:text-2xl font-extrabold">{title}</h2>
              <div className="mt-2 flex flex-wrap items-baseline gap-3">
                <span className="font-mono-num text-2xl font-extrabold text-[#11223E] dark:text-[#E2BD5B] tabular-nums">
                  {formatSdg(unitFinalSdg)}
                </span>
                {lensExtraSdg > 0 && (
                  <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 font-mono-num">
                    ({t('يشمل العدسات:', 'Incl. lenses:')} +{formatSdg(lensExtraSdg)})
                  </span>
                )}
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
                        className={`min-h-[44px] px-3 py-1.5 rounded-lg border text-xs font-medium flex items-center gap-2 ${
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
              <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs">
                <span className="font-bold">
                  {t('مواصفات العبوة', 'Pack Specs')}: {product.contactLensSpecs.quantityPerBox}{' '}
                  {t('عدسة/علبة', 'lenses/box')}
                </span>
                <span className="font-mono-num text-stone-500 dark:text-zinc-400">
                  BC {product.contactLensSpecs.baseCurve} · DIA {product.contactLensSpecs.diameter || '14.2'}
                </span>
              </div>
            )}

            {/* Pre-Cart Lens Type, Extra Options & Optional Prescription (eligible categories, never blocks Add to Cart) */}
            {isRxEligible && (
              <div className="space-y-3.5">
                {!isContact && (
                  <div className="p-4 rounded-2xl bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 space-y-4 text-xs">
                    {/* 1) Vision Type (Choose One) */}
                    <div className="space-y-2">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-extrabold text-[#11223E] dark:text-white">
                          {t('1) نوع الرؤية (اختياري — اختر واحداً)', '1) Vision Type (Optional — Choose One)')}
                        </span>
                        <button
                          type="button"
                          onClick={() =>
                            syncInlineLensSelection('none', activeExtraOptions, activeMirrorColor)
                          }
                          className={`min-h-[34px] px-2.5 rounded-lg border text-[11px] font-bold transition-colors ${
                            activeVisionType === 'none'
                              ? 'border-[#D9B24C] bg-[#D9B24C]/20 text-[#11223E] dark:text-[#E2BD5B]'
                              : 'border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E] text-stone-500'
                          }`}
                        >
                          {t('بدون عدسات طبية (الإطار فقط)', 'Frame Only')}
                        </button>
                      </div>

                      <div className="grid grid-cols-2 gap-2">
                        {visibleVisionTypes.map((opt) => {
                          const selected = activeVisionType === opt.id;
                          return (
                            <button
                              key={opt.id}
                              type="button"
                              onClick={() =>
                                syncInlineLensSelection(
                                  opt.id as VisionType,
                                  activeExtraOptions,
                                  activeMirrorColor
                                )
                              }
                              className={`min-h-[44px] px-3 py-2 rounded-xl border text-start flex items-center justify-between gap-1.5 transition-colors ${
                                selected
                                  ? 'border-[#D9B24C] bg-[#D9B24C]/15 font-extrabold text-[#11223E] dark:text-white'
                                  : 'border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E] hover:border-stone-300'
                              }`}
                            >
                              <span className="truncate">
                                {locale === 'ar' ? opt.labelAr : opt.labelEn}
                              </span>
                              <span className="font-mono-num text-[11px] font-bold text-[#B38B2D] dark:text-[#E2BD5B] shrink-0">
                                {opt.extraSdg === 0
                                  ? t('مجاني', 'Free')
                                  : `+${formatSdg(opt.extraSdg)}`}
                              </span>
                            </button>
                          );
                        })}
                      </div>
                    </div>

                    {/* 2) Combinable Extra Options */}
                    {visibleExtraOptions.length > 0 && (
                      <div className="space-y-2 pt-3 border-t border-stone-200 dark:border-zinc-800">
                        <div className="font-extrabold text-[#11223E] dark:text-white flex items-center gap-1.5">
                          <Sparkles className="w-3.5 h-3.5 text-[#D9B24C]" />
                          <span>
                            {t(
                              '2) خيارات إضافية للعدسة (اختياري — يمكن دمجها)',
                              '2) Extra Lens Options (Optional — Combinable)'
                            )}
                          </span>
                        </div>
                        <div className="grid sm:grid-cols-2 gap-2">
                          {visibleExtraOptions.map((opt) => {
                            const extId = opt.id as ExtraLensOptionId;
                            const checked = activeExtraOptions.includes(extId);
                            return (
                              <button
                                key={opt.id}
                                type="button"
                                onClick={() => handleToggleExtra(extId)}
                                className={`min-h-[44px] px-3 py-2 rounded-xl border text-start flex items-center justify-between gap-2 transition-colors ${
                                  checked
                                    ? 'border-[#D9B24C] bg-[#D9B24C]/15 font-extrabold text-[#11223E] dark:text-white'
                                    : 'border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E] hover:border-stone-300'
                                }`}
                              >
                                <span className="flex items-center gap-2 min-w-0">
                                  <span
                                    className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                                      checked
                                        ? 'border-[#B38B2D] bg-[#D9B24C] text-[#11223E]'
                                        : 'border-stone-400 bg-white dark:bg-zinc-900'
                                    }`}
                                  >
                                    {checked && <Check className="w-3 h-3 stroke-[3]" />}
                                  </span>
                                  <span className="leading-snug">
                                    {locale === 'ar' ? opt.labelAr : opt.labelEn}
                                  </span>
                                </span>
                                <span className="font-mono-num text-[11px] font-bold text-[#B38B2D] dark:text-[#E2BD5B] shrink-0">
                                  {opt.extraSdg === 0
                                    ? t('مجاني', 'Free')
                                    : `+${formatSdg(opt.extraSdg)}`}
                                </span>
                              </button>
                            );
                          })}
                        </div>

                        {activeExtraOptions.includes('mirror') && (
                          <div className="p-3 rounded-xl bg-white dark:bg-[#181B1E] border border-[#D9B24C]/60 space-y-2">
                            <span className="block text-[11px] font-extrabold text-[#11223E] dark:text-[#E2BD5B]">
                              {t('لون العدسة العاكسة:', 'Mirror Lens Color:')}
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                              {MIRROR_COLOR_OPTIONS.map((c) => {
                                const active = activeMirrorColor === c.id;
                                return (
                                  <button
                                    key={c.id}
                                    type="button"
                                    onClick={() =>
                                      syncInlineLensSelection(
                                        activeVisionType,
                                        activeExtraOptions,
                                        c.id
                                      )
                                    }
                                    className={`min-h-[40px] px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 font-bold ${
                                      active
                                        ? 'border-[#D9B24C] bg-[#D9B24C]/15'
                                        : 'border-stone-200 dark:border-zinc-700'
                                    }`}
                                  >
                                    <span
                                      className="w-3.5 h-3.5 rounded-full border border-black/20 shrink-0"
                                      style={{ backgroundColor: c.swatchHex }}
                                    />
                                    <span>{locale === 'ar' ? c.labelAr : c.labelEn}</span>
                                  </button>
                                );
                              })}
                            </div>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )}

                {/* 3) Optional Prescription Modal Trigger */}
                <button
                  type="button"
                  onClick={() => setRxSheetOpen(true)}
                  className="w-full min-h-[48px] px-4 py-2.5 rounded-xl border-2 border-dashed border-[#D9B24C] bg-[#D9B24C]/10 hover:bg-[#D9B24C]/20 text-[#11223E] dark:text-[#E2BD5B] font-extrabold text-xs sm:text-sm flex items-center justify-between gap-2 transition-colors"
                >
                  <span className="flex items-center gap-2">
                    <Eye className="w-4 h-4 shrink-0" />
                    <span>
                      {hasRxEntered
                        ? t('تم إرفاق مقاس النظر — تعديل المقاس', 'Prescription Added — Edit Rx')
                        : isContact
                        ? t('إضافة مقاس العدسات اللاصقة (اختياري)', 'Add Contact Lens Rx (Optional)')
                        : t('3) إضافة مقاس النظر (اختياري)', '3) Add Prescription (Optional)')}
                    </span>
                  </span>
                  {hasRxEntered ? (
                    <Edit3 className="w-4 h-4 shrink-0" />
                  ) : (
                    <span className="text-[11px] font-semibold opacity-80">
                      {t('يدوي / صورة / واتساب — قابل للتخطي', 'Manual / Photo / WhatsApp')}
                    </span>
                  )}
                </button>

                {/* Live Selection & Prescription Summary */}
                {(hasAnyLensChoices || hasRxEntered) && (
                  <div className="p-3.5 rounded-xl bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 text-xs space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-emerald-700 dark:text-emerald-400 inline-flex items-center gap-1.5">
                        <CheckCircle2 className="w-4 h-4" />
                        {hasRxEntered && draftPrescription?.type === 'manual'
                          ? t('مقاس نظر مُدخل يدوياً', 'Manual Prescription')
                          : hasRxEntered && draftPrescription?.type === 'image'
                          ? t('صورة روشتة مرفقة', 'Prescription Photo Attached')
                          : hasRxEntered && draftPrescription?.type === 'later'
                          ? t('سيُرسل المقاس لاحقاً عبر الواتساب', 'Will Send via WhatsApp Later')
                          : t('تم تحديد مواصفات العدسات (بدون إدخال مقاس)', 'Lens Options Selected (No Rx Entered)')}
                      </span>
                      <button
                        type="button"
                        onClick={() => setDraftPrescription(undefined)}
                        className="text-rose-600 font-bold inline-flex items-center gap-1 hover:underline"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t('حذف الكل', 'Clear')}
                      </button>
                    </div>

                    {!isContact && hasAnyLensChoices && (
                      <div className="space-y-1 text-[11px] text-slate-600 dark:text-slate-300 border-t border-stone-200 dark:border-zinc-800 pt-2">
                        {activeVisionType !== 'none' && (
                          <div className="flex justify-between">
                            <span>
                              {t('نوع الرؤية:', 'Vision Type:')}{' '}
                              <strong>{getVisionTypeLabel(activeVisionType, lensOptions, locale)}</strong>
                            </span>
                            <span className="font-mono-num font-bold text-[#B38B2D]">
                              +{formatSdg(pricing.visionTypePriceSdg)}
                            </span>
                          </div>
                        )}
                        {activeExtraOptions.map((extId) => (
                          <div key={extId} className="flex justify-between">
                            <span>
                              + {getExtraOptionLabel(extId, lensOptions, locale)}
                              {extId === 'mirror'
                                ? ` (${getMirrorColorLabel(activeMirrorColor, locale)})`
                                : ''}
                            </span>
                            <span className="font-mono-num font-bold text-[#B38B2D]">
                              +{formatSdg(pricing.extraOptionsPricesSdg[extId] || 0)}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}

                    {draftPrescription?.type === 'manual' &&
                      draftPrescription.values?.kind === 'contact_lenses' && (
                        <div className="font-mono-num text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">
                          {draftPrescription.values.contactRight && (
                            <div>
                              OD: SPH {draftPrescription.values.contactRight.sph} | CYL{' '}
                              {draftPrescription.values.contactRight.cyl} | AXIS{' '}
                              {draftPrescription.values.contactRight.axis}° | BC{' '}
                              {draftPrescription.values.contactRight.bc} | DIA{' '}
                              {draftPrescription.values.contactRight.dia} ({draftPrescription.values.contactRight.boxes}{' '}
                              {t('علبة', 'box')})
                            </div>
                          )}
                          {draftPrescription.values.contactLeft && (
                            <div>
                              OS: SPH {draftPrescription.values.contactLeft.sph} | CYL{' '}
                              {draftPrescription.values.contactLeft.cyl} | AXIS{' '}
                              {draftPrescription.values.contactLeft.axis}° | BC{' '}
                              {draftPrescription.values.contactLeft.bc} | DIA{' '}
                              {draftPrescription.values.contactLeft.dia} ({draftPrescription.values.contactLeft.boxes}{' '}
                              {t('علبة', 'box')})
                            </div>
                          )}
                        </div>
                      )}

                    {draftPrescription?.type === 'manual' &&
                      draftPrescription.values?.kind !== 'contact_lenses' &&
                      draftPrescription.rightEye && (
                        <div className="font-mono-num text-[11px] text-slate-600 dark:text-slate-300 space-y-0.5">
                          <div>
                            OD: SPH {draftPrescription.rightEye.sph} | CYL{' '}
                            {draftPrescription.rightEye.cyl} | AXIS{' '}
                            {draftPrescription.rightEye.axis}°
                            {draftPrescription.rightEye.add
                              ? ` | ADD ${draftPrescription.rightEye.add}`
                              : ''}
                          </div>
                          {draftPrescription.leftEye && (
                            <div>
                              OS: SPH {draftPrescription.leftEye.sph} | CYL{' '}
                              {draftPrescription.leftEye.cyl} | AXIS{' '}
                              {draftPrescription.leftEye.axis}°
                              {draftPrescription.leftEye.add
                                ? ` | ADD ${draftPrescription.leftEye.add}`
                                : ''}
                            </div>
                          )}
                          {(draftPrescription.pd || draftPrescription.pdRight) && (
                            <div>
                              PD:{' '}
                              {draftPrescription.pdMode === 'dual' && draftPrescription.pdRight
                                ? `OD ${draftPrescription.pdRight} mm / OS ${draftPrescription.pdLeft} mm`
                                : `${draftPrescription.pd} mm`}
                            </div>
                          )}
                          {draftPrescription.fittingHeight && (
                            <div>
                              {t('ارتفاع التركيب (Fitting Height):', 'Fitting Height:')}{' '}
                              {draftPrescription.fittingHeight} mm
                            </div>
                          )}
                        </div>
                      )}

                    {draftPrescription?.type === 'image' && draftPrescription.imageUrl && (
                      <img
                        src={draftPrescription.imageUrl}
                        alt={t('صورة الروشتة', 'Rx thumbnail')}
                        className="h-20 rounded-lg border border-stone-200 dark:border-zinc-700 object-cover"
                      />
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
                  className="min-h-[44px] px-3 text-sm font-bold hover:bg-stone-100 dark:hover:bg-zinc-800"
                >
                  −
                </button>
                <span className="px-4 font-mono-num text-sm font-bold tabular-nums">{qty}</span>
                <button
                  type="button"
                  onClick={() => setQty((q) => Math.min(Math.max(1, product.stock), q + 1))}
                  className="min-h-[44px] px-3 text-sm font-bold hover:bg-stone-100 dark:hover:bg-zinc-800"
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
                className="flex-1 min-h-[48px] py-3 px-6 rounded-xl disabled:opacity-50 font-extrabold text-sm flex items-center justify-center gap-2 transition-opacity hover:opacity-90"
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

      <PrescriptionSheet
        open={rxSheetOpen}
        product={product}
        initialPrescription={draftPrescription}
        onClose={() => setRxSheetOpen(false)}
        onSave={(rx) => setDraftPrescription(rx)}
        onRemove={draftPrescription ? () => setDraftPrescription(undefined) : undefined}
      />
    </div>
  );
};
