import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Camera,
  Check,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
  Eye,
  FileText,
  Globe,
  Heart,
  HelpCircle,
  ImagePlus,
  Loader2,
  MessageCircle,
  Share2,
  ShoppingBag,
  Sparkles,
  Star,
  Trash2,
  Truck,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import { hasLegacyBrandString, useStore } from '../store/StoreContext';
import { formatSdg, formatShortDate } from '../utils/format';
import { FieldValidationRule, useFormValidation } from '../hooks/useFormValidation';
import { FieldError, ValidationSummaryBanner } from './FormValidationUI';
import { VALIDATION_MESSAGES, pickMsg } from '../utils/validationMessages';
import {
  ContactLensEyePrescription,
  ExtraLensOptionId,
  EyePrescription,
  MirrorColorId,
  PrescriptionData,
  VisionType,
} from '../types';
import {
  ADD_OPTIONS,
  AXIS_OPTIONS,
  CYL_OPTIONS,
  EXTRA_OPTION_IDS,
  FITTING_HEIGHT_OPTIONS,
  MIRROR_COLOR_OPTIONS,
  PD_DUAL_OPTIONS,
  PD_SINGLE_OPTIONS,
  SPH_OPTIONS,
  VISION_TYPE_IDS,
  calculateLensPricingBreakdown,
  getEffectiveProductSizeOptions,
  getExtraOptionLabel,
  getMirrorColorLabel,
  getVisionTypeLabel,
  hasCustomLensOrRx,
  isContactLensProduct,
  isNonZeroCyl,
  isPdfPrescriptionUrl,
  isPrescriptionEligibleProduct,
  isReadingGlassesProduct,
  validateContactEye,
  validateEyeglassesEye,
} from '../utils/prescription';
import { auth, deletePrescriptionImage, uploadPrescriptionDocument } from '../lib/firebase';
import { ResilientImage } from './ResilientImage';

const DEFAULT_EYE: EyePrescription = { sph: '0.00', cyl: '0.00', axis: '0', add: '' };
const DEFAULT_CL_EYE: ContactLensEyePrescription = {
  sph: '-1.00',
  cyl: '0.00',
  axis: '0',
  add: '',
};

const MATERIAL_LABELS: Record<string, { ar: string; en: string }> = {
  acetate: { ar: 'أسيتات فاخر', en: 'Premium Acetate' },
  titanium: { ar: 'تيتانيوم خفيف', en: 'Lightweight Titanium' },
  metal: { ar: 'معدن متين', en: 'Durable Metal' },
  tr90: { ar: 'TR90 مرن', en: 'Flexible TR90' },
  hydrogel: { ar: 'سيليكون هيدروجيل', en: 'Silicone Hydrogel' },
  sterile_solution: { ar: 'محلول معقم', en: 'Sterile Solution' },
  leather: { ar: 'جلد طبيعي', en: 'Genuine Leather' },
};

const SHAPE_LABELS: Record<string, { ar: string; en: string }> = {
  round: { ar: 'إطار دائري', en: 'Round Frame' },
  square: { ar: 'إطار مربع', en: 'Square Frame' },
  aviator: { ar: 'أفياتور', en: 'Aviator' },
  cat_eye: { ar: 'عين القطة', en: 'Cat Eye' },
  rectangle: { ar: 'إطار مستطيل', en: 'Rectangle Frame' },
};

export const ProductDetailModal: React.FC = () => {
  const {
    locale,
    setLocale,
    t,
    selectedProductId,
    openProduct,
    setActiveTab,
    products,
    brands,
    categories,
    lensOptions,
    settings,
    appTexts,
    appearance,
    user,
    isGuest,
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
  const [selectedSize, setSelectedSize] = useState('');
  const [clSizeMode, setClSizeMode] = useState<'same' | 'separate'>('same');
  const [clRightSize, setClRightSize] = useState('');
  const [clLeftSize, setClLeftSize] = useState('');

  // Inline Lens & Prescription State ("أدخل مقاسك" card)
  const [rxCardOpen, setRxCardOpen] = useState(false);
  const [visionType, setVisionType] = useState<VisionType>('none');
  const [extraOptions, setExtraOptions] = useState<ExtraLensOptionId[]>([]);
  const [mirrorColor, setMirrorColor] = useState<MirrorColorId>('silver');

  const [dontKnowRx, setDontKnowRx] = useState(false);
  const [manualTouched, setManualTouched] = useState(false);

  const [rightEye, setRightEye] = useState<EyePrescription>(DEFAULT_EYE);
  const [leftEye, setLeftEye] = useState<EyePrescription>(DEFAULT_EYE);
  const [pdMode, setPdMode] = useState<'single' | 'dual'>('single');
  const [pd, setPd] = useState('63');
  const [pdRight, setPdRight] = useState('31.5');
  const [pdLeft, setPdLeft] = useState('31.5');
  const [fittingHeight, setFittingHeight] = useState('18');

  const [clRight, setClRight] = useState<ContactLensEyePrescription>(DEFAULT_CL_EYE);
  const [clLeft, setClLeft] = useState<ContactLensEyePrescription>(DEFAULT_CL_EYE);

  const [imageUrl, setImageUrl] = useState('');
  const [storagePath, setStoragePath] = useState('');
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState<'image' | 'pdf' | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [showHowToRead, setShowHowToRead] = useState(false);
  const [notes, setNotes] = useState('');

  const [reviewRating, setReviewRating] = useState(5);
  const [reviewComment, setReviewComment] = useState('');

  const scrollContainerRef = useRef<HTMLDivElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const rxVal = useFormValidation({
    containerRef: scrollContainerRef,
    formId: 'product-detail-rx',
  });
  const reviewVal = useFormValidation({
    containerRef: scrollContainerRef,
    formId: 'product-detail-review',
  });

  const isRxEligible = product ? isPrescriptionEligibleProduct(product, categories) : false;
  const isContact = product ? isContactLensProduct(product, categories) : false;
  const isReading = product ? isReadingGlassesProduct(product, categories) : false;
  const availableSizes = useMemo(
    () => (product ? getEffectiveProductSizeOptions(product, categories) : []),
    [product, categories]
  );
  const isProgressive = !isContact && visionType === 'progressive';
  const isBifocal = !isContact && visionType === 'bifocal';
  const showAddRequired = isBifocal || isProgressive;
  const effectivePdMode = isProgressive ? 'dual' : pdMode;

  useEffect(() => {
    setImgIdx(0);
    setZoomed(false);
    setVariantId('');
    setQty(1);
    setSelectedSize(availableSizes.length === 1 ? availableSizes[0] : '');
    setClSizeMode('same');
    setClRightSize(availableSizes[0] || '');
    setClLeftSize(availableSizes[0] || '');
    setRxCardOpen(false);
    setVisionType('none');
    setExtraOptions([]);
    setMirrorColor('silver');
    setDontKnowRx(false);
    setManualTouched(false);
    setRightEye({ ...DEFAULT_EYE });
    setLeftEye({ ...DEFAULT_EYE });
    setPdMode('single');
    setPd('63');
    setPdRight('31.5');
    setPdLeft('31.5');
    setFittingHeight('18');
    setClRight(
      product?.contactLensSpecs
        ? {
            ...DEFAULT_CL_EYE,
            sph: product.contactLensSpecs.sphOptions[0] || '-1.00',
          }
        : { ...DEFAULT_CL_EYE }
    );
    setClLeft(
      product?.contactLensSpecs
        ? {
            ...DEFAULT_CL_EYE,
            sph: product.contactLensSpecs.sphOptions[0] || '-1.00',
          }
        : { ...DEFAULT_CL_EYE }
    );
    setImageUrl('');
    setStoragePath('');
    setFileName('');
    setFileType(undefined);
    setUploading(false);
    setUploadProgress(0);
    setUploadError(null);
    setShowHowToRead(false);
    setNotes('');
    setReviewComment('');
    rxVal.reset();
    reviewVal.reset();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedProductId, product?.contactLensSpecs, availableSizes]);

  const buildRxRules = useCallback((): FieldValidationRule[] => {
    if (!product) return [];
    const rules: FieldValidationRule[] = [];

    const hasFullRxSelected = dontKnowRx || Boolean(imageUrl) || manualTouched;
    if (availableSizes.length > 0 && !hasFullRxSelected) {
      const hasValidQuickSize =
        isContact && clSizeMode === 'separate'
          ? Boolean(clRightSize && clLeftSize)
          : Boolean(selectedSize);
      rules.push({
        field: 'productSize',
        label: t('المقاس المطلوب', 'Required Size'),
        error: !hasValidQuickSize
          ? pickMsg(VALIDATION_MESSAGES.productSizeRequired, locale)
          : null,
      });
    }

    if (!isRxEligible) return rules;

    if (!isContact && extraOptions.includes('mirror')) {
      rules.push({
        field: 'mirrorColor',
        label: t('لون العدسة العاكسة', 'Mirror Lens Color'),
        error: !mirrorColor
          ? pickMsg(VALIDATION_MESSAGES.mirrorColorRequired, locale)
          : null,
      });
    }

    if (!dontKnowRx && !imageUrl && manualTouched) {
      if (isContact) {
        const normalizedClRight: ContactLensEyePrescription = {
          sph: clRight.sph,
          cyl: clRight.cyl,
          axis: isNonZeroCyl(clRight.cyl) ? clRight.axis : '0',
          add: clRight.add || undefined,
        };
        const normalizedClLeft: ContactLensEyePrescription = {
          sph: clLeft.sph,
          cyl: clLeft.cyl,
          axis: isNonZeroCyl(clLeft.cyl) ? clLeft.axis : '0',
          add: clLeft.add || undefined,
        };
        rules.push(
          {
            field: 'clRight',
            label: t('العين اليمنى (OD)', 'Right Eye (OD)'),
            error: validateContactEye(normalizedClRight, 'العين اليمنى', 'Right Eye', locale),
          },
          {
            field: 'clLeft',
            label: t('العين اليسرى (OS)', 'Left Eye (OS)'),
            error: validateContactEye(normalizedClLeft, 'العين اليسرى', 'Left Eye', locale),
          }
        );
      } else {
        const normalizedRightEye: EyePrescription = {
          sph: rightEye.sph,
          cyl: rightEye.cyl,
          axis: isNonZeroCyl(rightEye.cyl) ? rightEye.axis : '0',
          add: rightEye.add || (showAddRequired ? '+1.50' : undefined),
        };
        const normalizedLeftEye: EyePrescription = {
          sph: leftEye.sph,
          cyl: leftEye.cyl,
          axis: isNonZeroCyl(leftEye.cyl) ? leftEye.axis : '0',
          add: leftEye.add || (showAddRequired ? '+1.50' : undefined),
        };
        rules.push(
          {
            field: 'odEye',
            label: t('العين اليمنى (OD)', 'Right Eye (OD)'),
            error: validateEyeglassesEye(
              normalizedRightEye,
              'العين اليمنى (OD)',
              'Right Eye (OD)',
              locale
            ),
          },
          {
            field: 'osEye',
            label: t('العين اليسرى (OS)', 'Left Eye (OS)'),
            error: validateEyeglassesEye(
              normalizedLeftEye,
              'العين اليسرى (OS)',
              'Left Eye (OS)',
              locale
            ),
          }
        );
      }
    }

    return rules;
  }, [
    product,
    isRxEligible,
    isContact,
    availableSizes.length,
    clSizeMode,
    clRightSize,
    clLeftSize,
    selectedSize,
    extraOptions,
    mirrorColor,
    dontKnowRx,
    imageUrl,
    manualTouched,
    clRight,
    clLeft,
    rightEye,
    leftEye,
    showAddRequired,
    locale,
    t,
  ]);

  const buildReviewRules = useCallback((): FieldValidationRule[] => {
    return [
      {
        field: 'comment',
        label: t('التقييم', 'Review'),
        error: !reviewComment.trim()
          ? t('يرجى كتابة تقييمك للمنتج قبل الإرسال', 'Please enter your review before posting')
          : null,
      },
    ];
  }, [reviewComment, t]);

  useEffect(() => {
    if (rxVal.submitted) {
      rxVal.revalidate(buildRxRules());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [rxVal.submitted, buildRxRules]);

  useEffect(() => {
    if (reviewVal.submitted) {
      reviewVal.revalidate(buildReviewRules());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [reviewVal.submitted, buildReviewRules]);

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

  const deliveryFeeSummary = useMemo(() => {
    const fees = settings.deliveryFees.map((f) => f.feeSdg).filter((n) => Number.isFinite(n));
    if (fees.length === 0) {
      return t('يُحسب التوصيل عند إتمام الطلب', 'Delivery calculated at checkout');
    }
    const minFee = Math.min(...fees);
    const maxFee = Math.max(...fees);
    if (minFee === maxFee) {
      return t(
        `رسوم التوصيل الثابتة: ${formatSdg(minFee)} لجميع المدن`,
        `Flat delivery fee: ${formatSdg(minFee)} for all cities`
      );
    }
    return t(
      `التوصيل لجميع الولايات يبدأ من ${formatSdg(minFee)}`,
      `Nationwide delivery starting from ${formatSdg(minFee)}`
    );
  }, [settings.deliveryFees, t]);

  if (!product) return null;

  const approvedReviews = product.reviews.filter((r) => r.status === 'approved');
  const activeVariant =
    product.variants.find((v) => v.id === variantId) || product.variants[0];
  const isFav = user.favoriteProductIds.includes(product.id);
  const brand = brands.find((b) => b.id === product.brandId);
  const category = categories.find((c) => c.id === product.categoryId);
  const title = locale === 'ar' ? product.titleAr : product.titleEn;

  const pricing = isContact
    ? calculateLensPricingBreakdown('none', [], lensOptions)
    : calculateLensPricingBreakdown(visionType, extraOptions, lensOptions);

  const lensExtraSdg = isContact ? 0 : pricing.totalExtraSdg;
  const unitFinalSdg = product.priceSdg + lensExtraSdg;
  const isUnavailable = Boolean(product.isOutOfStock) || product.stock <= 0;

  const rawWordmark = (appearance.wordmarkText || '').trim();
  const displayWordmark =
    !rawWordmark || hasLegacyBrandString(rawWordmark) ? 'Vision Plus' : rawWordmark;

  const displayedMainImage =
    activeVariant?.imageUrl && imgIdx === 0
      ? activeVariant.imageUrl
      : product.images[imgIdx] || product.images[0];

  const handleSelectVisionType = (nextVt: VisionType) => {
    setVisionType(nextVt);
    if (nextVt === 'progressive') {
      setPdMode('dual');
      setRightEye((prev) => ({ ...prev, add: prev.add || '+1.50' }));
      setLeftEye((prev) => ({ ...prev, add: prev.add || '+1.50' }));
      if (!fittingHeight) setFittingHeight('18');
    } else if (nextVt === 'bifocal') {
      setRightEye((prev) => ({ ...prev, add: prev.add || '+1.50' }));
      setLeftEye((prev) => ({ ...prev, add: prev.add || '+1.50' }));
    }
  };

  const handleToggleExtra = (id: ExtraLensOptionId) => {
    setExtraOptions((prev) =>
      prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]
    );
  };

  const handleCopyRightToLeft = () => {
    if (isContact) {
      setClLeft({ ...clRight });
    } else {
      setLeftEye({ ...rightEye });
    }
    setManualTouched(true);
    showToast(t('تم نسخ مقاس العين اليمنى إلى اليسرى', 'Right eye copied to left eye'));
  };

  const handleApplySavedRx = (id: string) => {
    const found = user.prescriptions.find((r) => r.id === id);
    if (!found) return;
    setDontKnowRx(false);
    setManualTouched(true);
    if (found.kind === 'contact_lenses' && found.contactRight && found.contactLeft && isContact) {
      setClRight({
        sph: found.contactRight.sph || '-1.00',
        cyl: found.contactRight.cyl || '0.00',
        axis: found.contactRight.axis || '0',
        add: found.contactRight.add || '',
      });
      setClLeft({
        sph: found.contactLeft.sph || '-1.00',
        cyl: found.contactLeft.cyl || '0.00',
        axis: found.contactLeft.axis || '0',
        add: found.contactLeft.add || '',
      });
      setPdMode(found.pdMode || 'single');
      setPd(found.pd || '63');
      setPdRight(found.pdRight || '31.5');
      setPdLeft(found.pdLeft || '31.5');
    } else {
      setRightEye({
        sph: found.rightEye?.sph || '0.00',
        cyl: found.rightEye?.cyl || '0.00',
        axis: found.rightEye?.axis || '0',
        add: found.rightEye?.add || '',
      });
      setLeftEye({
        sph: found.leftEye?.sph || '0.00',
        cyl: found.leftEye?.cyl || '0.00',
        axis: found.leftEye?.axis || '0',
        add: found.leftEye?.add || '',
      });
      setPdMode(isProgressive ? 'dual' : found.pdMode || 'single');
      setPd(found.pd || '63');
      setPdRight(found.pdRight || '31.5');
      setPdLeft(found.pdLeft || '31.5');
    }
    if (found.notes) setNotes(found.notes);
    showToast(t('تم تعبئة المقاس المحفوظ بنجاح', 'Saved prescription loaded'));
  };

  const handleImagePick = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    const isImage = file.type.startsWith('image/');
    if (!isImage && !isPdf) {
      setUploadError(
        t('يرجى اختيار صورة (JPG/PNG) أو ملف PDF للوصفة الطبية', 'Please select an image or PDF file')
      );
      return;
    }

    if (isPdf && file.size > 700 * 1024) {
      setUploadError(
        t('حجم ملف PDF يتجاوز الحد الأقصى 700 كيلوبايت', 'PDF file exceeds 700 KB limit')
      );
      return;
    }

    const fbUid = auth.currentUser?.uid || user.uid || 'guest';
    setUploadError(null);
    setUploading(true);
    setUploadProgress(10);
    try {
      if (storagePath) {
        await deletePrescriptionImage(storagePath);
      }
      const uploaded = await uploadPrescriptionDocument(fbUid, file, (pct) =>
        setUploadProgress(pct)
      );
      setImageUrl(uploaded.url);
      setStoragePath(uploaded.path);
      setFileName(uploaded.fileName);
      setFileType(uploaded.fileType);
      setDontKnowRx(false);
      showToast(
        uploaded.fileType === 'pdf'
          ? t('تم رفع ملف PDF للوصفة بنجاح', 'Prescription PDF uploaded')
          : t('تم رفع صورة الروشتة بنجاح', 'Prescription image uploaded')
      );
    } catch {
      setUploadError(
        t(
          'تعذر معالجة أو رفع الملف. يرجى اختيار ملف آخر والمحاولة مرة أخرى.',
          'Failed to process or upload file. Please try again.'
        )
      );
    } finally {
      setUploading(false);
    }
  };

  const handleDeleteUploadedImage = async () => {
    if (storagePath) {
      await deletePrescriptionImage(storagePath);
    }
    setImageUrl('');
    setStoragePath('');
    setFileName('');
    setFileType(undefined);
    setUploadProgress(0);
  };

  const resetAllRx = () => {
    setVisionType('none');
    setExtraOptions([]);
    setMirrorColor('silver');
    setDontKnowRx(false);
    setManualTouched(false);
    setRightEye({ ...DEFAULT_EYE });
    setLeftEye({ ...DEFAULT_EYE });
    setPdMode('single');
    setPd('63');
    setPdRight('31.5');
    setPdLeft('31.5');
    setFittingHeight('18');
    setImageUrl('');
    setStoragePath('');
    setFileName('');
    setFileType(undefined);
    setNotes('');
    rxVal.reset();
  };

  const buildDraftPrescription = (): { rx?: PrescriptionData; error?: string } => {
    if (!isRxEligible) return { rx: undefined };

    const lensFields = {
      visionType: isContact ? ('none' as const) : pricing.visionType,
      visionTypePriceSdg: isContact ? 0 : pricing.visionTypePriceSdg,
      extraOptions:
        !isContact && pricing.extraOptions.length > 0 ? pricing.extraOptions : undefined,
      extraOptionsPricesSdg:
        !isContact && pricing.extraOptions.length > 0 ? pricing.extraOptionsPricesSdg : undefined,
      mirrorColor:
        !isContact && pricing.extraOptions.includes('mirror') ? mirrorColor : undefined,
      lensOption: isContact
        ? ('none' as const)
        : pricing.visionType !== 'none'
        ? pricing.visionType
        : pricing.extraOptions[0] || ('none' as const),
      lensExtraPriceSdg: isContact ? 0 : pricing.totalExtraSdg,
    };

    if (dontKnowRx) {
      return {
        rx: {
          type: 'later',
          mode: 'later',
          ...lensFields,
          notes: notes.trim() || undefined,
        },
      };
    }

    if (imageUrl) {
      return {
        rx: {
          type: 'image',
          mode: 'image',
          imageUrl,
          storagePath,
          fileName: fileName || undefined,
          fileType: fileType || (isPdfPrescriptionUrl(imageUrl) ? 'pdf' : 'image'),
          ...lensFields,
          notes: notes.trim() || undefined,
        },
      };
    }

    if (manualTouched) {
      if (isContact) {
        const normalizedClRight: ContactLensEyePrescription = {
          sph: clRight.sph,
          cyl: clRight.cyl,
          axis: isNonZeroCyl(clRight.cyl) ? clRight.axis : '0',
          add: clRight.add || undefined,
        };
        const normalizedClLeft: ContactLensEyePrescription = {
          sph: clLeft.sph,
          cyl: clLeft.cyl,
          axis: isNonZeroCyl(clLeft.cyl) ? clLeft.axis : '0',
          add: clLeft.add || undefined,
        };
        const errR = validateContactEye(normalizedClRight, 'العين اليمنى', 'Right Eye', locale);
        if (errR) return { error: errR };
        const errL = validateContactEye(normalizedClLeft, 'العين اليسرى', 'Left Eye', locale);
        if (errL) return { error: errL };
        const computedPd = effectivePdMode === 'single' ? pd : `${pdRight}/${pdLeft}`;
        return {
          rx: {
            type: 'manual',
            mode: 'manual',
            ...lensFields,
            rightEye: normalizedClRight,
            leftEye: normalizedClLeft,
            pd: computedPd,
            pdMode: effectivePdMode,
            pdRight: effectivePdMode === 'dual' ? pdRight : undefined,
            pdLeft: effectivePdMode === 'dual' ? pdLeft : undefined,
            values: {
              kind: 'contact_lenses',
              pdMode: effectivePdMode,
              pd: computedPd,
              pdRight: effectivePdMode === 'dual' ? pdRight : undefined,
              pdLeft: effectivePdMode === 'dual' ? pdLeft : undefined,
              contactRight: normalizedClRight,
              contactLeft: normalizedClLeft,
            },
            notes: notes.trim() || undefined,
          },
        };
      }

      const normalizedRightEye: EyePrescription = {
        sph: rightEye.sph,
        cyl: rightEye.cyl,
        axis: isNonZeroCyl(rightEye.cyl) ? rightEye.axis : '0',
        add: rightEye.add || (showAddRequired ? '+1.50' : undefined),
      };
      const normalizedLeftEye: EyePrescription = {
        sph: leftEye.sph,
        cyl: leftEye.cyl,
        axis: isNonZeroCyl(leftEye.cyl) ? leftEye.axis : '0',
        add: leftEye.add || (showAddRequired ? '+1.50' : undefined),
      };

      const errR = validateEyeglassesEye(
        normalizedRightEye,
        'العين اليمنى (OD)',
        'Right Eye (OD)',
        locale
      );
      if (errR) return { error: errR };

      const errL = validateEyeglassesEye(
        normalizedLeftEye,
        'العين اليسرى (OS)',
        'Left Eye (OS)',
        locale
      );
      if (errL) return { error: errL };

      const computedPd = effectivePdMode === 'single' ? pd : `${pdRight}/${pdLeft}`;
      const resolvedFittingHeight = isProgressive ? fittingHeight || '18' : undefined;

      return {
        rx: {
          type: 'manual',
          mode: 'manual',
          ...lensFields,
          rightEye: normalizedRightEye,
          leftEye: normalizedLeftEye,
          pd: computedPd,
          pdMode: effectivePdMode,
          pdRight: effectivePdMode === 'dual' ? pdRight : undefined,
          pdLeft: effectivePdMode === 'dual' ? pdLeft : undefined,
          fittingHeight: resolvedFittingHeight,
          values: {
            kind: 'eyeglasses',
            rightEye: normalizedRightEye,
            leftEye: normalizedLeftEye,
            pdMode: effectivePdMode,
            pd: computedPd,
            pdRight: effectivePdMode === 'dual' ? pdRight : undefined,
            pdLeft: effectivePdMode === 'dual' ? pdLeft : undefined,
            fittingHeight: resolvedFittingHeight,
          },
          notes: notes.trim() || undefined,
        },
      };
    }

    // Skipped Rx values, keep lens choices or notes if any
    if (
      !isContact &&
      (pricing.visionType !== 'none' || pricing.extraOptions.length > 0 || notes.trim())
    ) {
      return {
        rx: {
          type: 'none',
          mode: 'none',
          ...lensFields,
          notes: notes.trim() || undefined,
        },
      };
    }

    if (notes.trim()) {
      return {
        rx: {
          type: 'none',
          mode: 'none',
          ...lensFields,
          notes: notes.trim(),
        },
      };
    }

    return { rx: undefined };
  };

  const handleAddToCart = () => {
    if (isUnavailable || uploading) return;

    const rxRules = buildRxRules();
    if (!rxVal.validateAll(rxRules)) {
      const hasRxCardSpecificError = rxRules.some(
        (r) => r.error && r.field !== 'productSize'
      );
      if (hasRxCardSpecificError && !rxCardOpen) {
        setRxCardOpen(true);
        window.requestAnimationFrame(() => {
          window.requestAnimationFrame(() => {
            rxVal.validateAll(rxRules);
          });
        });
      }
      return;
    }

    const { rx, error } = buildDraftPrescription();
    if (error) {
      setRxCardOpen(true);
      showToast(error);
      return;
    }

    const variantColorLabel = activeVariant
      ? locale === 'ar'
        ? activeVariant.colorNameAr
        : activeVariant.colorNameEn
      : undefined;

    const finalPrescription = hasCustomLensOrRx(rx)
      ? {
          ...rx!,
          lensExtraPriceSdg: lensExtraSdg,
        }
      : undefined;

    const resolvedQuickSize =
      availableSizes.length > 0
        ? isContact && clSizeMode === 'separate'
          ? clRightSize && clLeftSize
            ? t(`يمين ${clRightSize} / يسار ${clLeftSize}`, `OD ${clRightSize} / OS ${clLeftSize}`)
            : undefined
          : selectedSize || undefined
        : undefined;

    const resolvedContactSelection =
      isContact && availableSizes.length > 0 && !finalPrescription && resolvedQuickSize
        ? clSizeMode === 'separate'
          ? { rightSph: clRightSize, leftSph: clLeftSize }
          : { rightSph: selectedSize, leftSph: selectedSize }
        : undefined;

    addToCart({
      productId: product.id,
      variantId: activeVariant?.id,
      variantLabel: variantColorLabel,
      selectedOptions:
        variantColorLabel || resolvedQuickSize || product.contactLensSpecs
          ? {
              ...(variantColorLabel ? { color: variantColorLabel } : {}),
              ...(resolvedQuickSize ? { size: resolvedQuickSize } : {}),
              ...(product.contactLensSpecs?.quantityPerBox
                ? { quantityPerBox: product.contactLensSpecs.quantityPerBox }
                : {}),
            }
          : undefined,
      quantity: qty,
      unitPriceSdg: product.priceSdg,
      prescription: finalPrescription,
      contactLensSelection: resolvedContactSelection,
    });
    openProduct(null);
  };

  const specSummaryParts: string[] = [];
  if (product.frameShape && SHAPE_LABELS[product.frameShape]) {
    specSummaryParts.push(t(SHAPE_LABELS[product.frameShape].ar, SHAPE_LABELS[product.frameShape].en));
  }
  if (product.material && MATERIAL_LABELS[product.material]) {
    specSummaryParts.push(t(MATERIAL_LABELS[product.material].ar, MATERIAL_LABELS[product.material].en));
  }
  if (product.contactLensSpecs) {
    specSummaryParts.push(
      `${product.contactLensSpecs.quantityPerBox} ${t('عدسة/علبة', 'lenses/box')}`,
      `BC ${product.contactLensSpecs.baseCurve}`,
      `DIA ${product.contactLensSpecs.diameter || '14.2'}`
    );
  }
  if (product.lensSolutionSpecs) {
    specSummaryParts.push(
      `${product.lensSolutionSpecs.volumeMl} ml`,
      `${t('ينتهي', 'Exp')} ${formatShortDate(product.lensSolutionSpecs.expiryDate, locale)}`
    );
  }
  for (const tag of product.tags.slice(0, 3)) {
    if (tag && !specSummaryParts.includes(tag)) specSummaryParts.push(tag);
  }

  const hasAnyRxInput =
    dontKnowRx ||
    Boolean(imageUrl) ||
    manualTouched ||
    visionType !== 'none' ||
    extraOptions.length > 0;

  return (
    <div className="fixed inset-0 z-[60] bg-black/55 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4">
      <div className="w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-5xl bg-white dark:bg-[#111927] sm:rounded-2xl border-t sm:border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden shadow-xl">
        {/* Top Navigation Bar matching screenshot */}
        <header className="px-4 sm:px-6 py-3 border-b border-slate-100 dark:border-slate-800 bg-white dark:bg-[#131C2E] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => openProduct(null)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl text-[#11223E] dark:text-slate-100 hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label={t('رجوع', 'Back')}
            >
              {locale === 'ar' ? <ArrowRight className="w-5 h-5" /> : <ArrowLeft className="w-5 h-5" />}
            </button>
            <span
              className="text-base sm:text-lg font-extrabold tracking-tight text-[#11223E] dark:text-white"
              dir="ltr"
            >
              {displayWordmark === 'Vision Plus' ? (
                <>
                  Vision <span style={{ color: appearance.secondaryColor }}>Plus</span>
                </>
              ) : (
                displayWordmark
              )}
            </span>
          </div>

          <div className="flex items-center gap-1.5">
            <button
              type="button"
              onClick={() => toggleFavorite(product.id)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label={t('المفضلة', 'Favorite')}
            >
              <Heart className={`w-5 h-5 ${isFav ? 'fill-rose-600 text-rose-600' : ''}`} />
            </button>
            <button
              type="button"
              onClick={() => {
                if (navigator.clipboard) navigator.clipboard.writeText(window.location.href);
                showToast(t('تم نسخ رابط المنتج', 'Product link copied'));
              }}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 transition-colors"
              aria-label={t('مشاركة', 'Share')}
            >
              <Share2 className="w-4 h-4" />
            </button>
            <button
              type="button"
              onClick={() => setLocale(locale === 'ar' ? 'en' : 'ar')}
              className="min-h-[40px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs font-extrabold flex items-center gap-1.5 hover:border-[#D9B24C] transition-colors"
            >
              <Globe className="w-3.5 h-3.5 text-[#B38B2D] dark:text-[#E2BD5B]" />
              <span>{locale === 'ar' ? 'EN' : 'AR'}</span>
            </button>
          </div>
        </header>

        {/* Scrollable Content */}
        <div ref={scrollContainerRef} className="flex-1 overflow-y-auto">
          <div className="grid lg:grid-cols-12 gap-6 p-4 sm:p-6">
            {/* Gallery Column */}
            <div className="lg:col-span-5 space-y-3">
              <div className="relative aspect-[4/3] rounded-2xl overflow-hidden bg-slate-100 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800">
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
                  className="absolute bottom-3 end-3 min-h-[36px] px-3 py-1.5 rounded-xl bg-white/95 dark:bg-[#131C2E]/95 border border-slate-200 dark:border-slate-700 text-xs font-bold flex items-center gap-1 shadow-xs"
                >
                  {zoomed ? <ZoomOut className="w-3.5 h-3.5" /> : <ZoomIn className="w-3.5 h-3.5" />}
                  {zoomed ? t('تصغير', 'Reset') : t('تكبير', 'Zoom')}
                </button>
              </div>

              {product.images.length > 1 && (
                <div className="flex gap-2.5 overflow-x-auto pb-1">
                  {product.images.map((img, i) => (
                    <button
                      key={img + i}
                      type="button"
                      onClick={() => setImgIdx(i)}
                      className={`w-20 h-20 rounded-xl overflow-hidden bg-slate-100 dark:bg-slate-900 border-2 shrink-0 transition-all ${
                        imgIdx === i
                          ? 'border-[#11223E] dark:border-[#D9B24C] ring-2 ring-[#11223E]/15'
                          : 'border-slate-200 dark:border-slate-800 opacity-80 hover:opacity-100'
                      }`}
                    >
                      <ResilientImage src={img} alt="" className="w-full h-full object-cover" />
                    </button>
                  ))}
                </div>
              )}

              {/* Desktop Reviews Block */}
              <div className="hidden lg:block pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-[#11223E] dark:text-white">
                    {t('تقييمات العملاء', 'Customer Reviews')}
                  </h3>
                  <span className="flex items-center gap-1 text-xs font-bold tabular-nums">
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                    {product.rating.toFixed(1)} ({approvedReviews.length})
                  </span>
                </div>

                <div className="space-y-2 max-h-44 overflow-y-auto">
                  {approvedReviews.length === 0 ? (
                    <p className="text-xs text-slate-500 dark:text-slate-400">
                      {t('كن أول من يقيّم هذا المنتج', 'Be the first to review this product')}
                    </p>
                  ) : (
                    approvedReviews.map((r) => (
                      <div
                        key={r.id}
                        className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 text-xs space-y-1"
                      >
                        <div className="flex items-center justify-between font-bold">
                          <span>{r.userName}</span>
                          <span className="text-amber-600 tabular-nums">{'★'.repeat(r.rating)}</span>
                        </div>
                        <p className="text-slate-600 dark:text-slate-400">{r.comment}</p>
                      </div>
                    ))
                  )}
                </div>

                <form
                  noValidate
                  onSubmit={(e) => {
                    e.preventDefault();
                    if (!reviewVal.validateAll(buildReviewRules())) return;
                    addReview(product.id, reviewRating, reviewComment.trim());
                    setReviewComment('');
                    reviewVal.reset();
                  }}
                  className="space-y-2"
                >
                  <ValidationSummaryBanner
                    errors={reviewVal.errors}
                    onSelectField={reviewVal.focusField}
                    mode="form"
                  />
                  <div className="flex gap-2 items-start">
                    <select
                      value={reviewRating}
                      onChange={(e) => setReviewRating(Number(e.target.value))}
                      className="min-h-[44px] px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs shrink-0"
                    >
                      {[5, 4, 3, 2, 1].map((n) => (
                        <option key={n} value={n}>
                          {n} ★
                        </option>
                      ))}
                    </select>
                    <div {...reviewVal.getFieldWrapperProps('comment')} className="flex-1 min-w-0">
                      <input
                        type="text"
                        value={reviewComment}
                        onChange={(e) => setReviewComment(e.target.value)}
                        placeholder={t('أضف تقييمك...', 'Write a review...')}
                        {...reviewVal.getInputA11yProps('comment')}
                        className={`w-full min-h-[44px] px-3 rounded-xl text-xs ${reviewVal.getControlClasses(
                          'comment',
                          'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                        )}`}
                      />
                      <FieldError
                        id={reviewVal.getErrorId('comment')}
                        message={reviewVal.getError('comment')}
                      />
                    </div>
                    <button
                      type="submit"
                      className="min-h-[44px] px-3.5 rounded-xl bg-[#11223E] text-white text-xs font-bold shrink-0"
                    >
                      {t('إرسال', 'Post')}
                    </button>
                  </div>
                </form>
              </div>
            </div>

            {/* Product Info & Inline Prescription Column */}
            <div className="lg:col-span-7 space-y-5">
              {/* Metadata breadcrumb + Title + Price + Availability */}
              <div className="space-y-2">
                <div className="flex flex-wrap items-center gap-1.5 text-xs font-medium text-slate-500 dark:text-slate-400">
                  {brand && <span>{locale === 'ar' ? brand.nameAr : brand.nameEn}</span>}
                  {brand && category && <span aria-hidden="true">·</span>}
                  {category && <span>{locale === 'ar' ? category.nameAr : category.nameEn}</span>}
                  <span aria-hidden="true">·</span>
                  <span className="font-mono-num">{product.sku}</span>
                </div>

                <h2 className="text-xl sm:text-2xl font-extrabold text-[#11223E] dark:text-white leading-snug">
                  {title}
                </h2>

                <div className="flex flex-wrap items-baseline gap-3 pt-0.5">
                  <span className="font-mono-num text-2xl sm:text-[26px] font-extrabold text-[#11223E] dark:text-[#E2BD5B] tabular-nums">
                    {formatSdg(unitFinalSdg)}
                  </span>
                  {product.oldPriceSdg && product.oldPriceSdg > product.priceSdg && (
                    <span className="font-mono-num text-sm text-slate-400 line-through tabular-nums">
                      {formatSdg(product.oldPriceSdg)}
                    </span>
                  )}
                  {lensExtraSdg > 0 && (
                    <span className="text-xs font-bold text-emerald-700 dark:text-emerald-400 font-mono-num">
                      ({t('يشمل العدسات:', 'Incl. lenses:')} +{formatSdg(lensExtraSdg)})
                    </span>
                  )}
                </div>

                <div className="pt-0.5">
                  {!isUnavailable ? (
                    <div className="inline-flex items-center gap-1.5 text-xs sm:text-sm font-bold text-emerald-600 dark:text-emerald-400">
                      <CheckCircle2 className="w-4 h-4 shrink-0" />
                      <span>
                        {t('متوفر للتوصيل السريع', 'Available for fast delivery')}
                        <span className="text-slate-400 dark:text-slate-500 font-normal ms-1.5 tabular-nums">
                          ({product.stock})
                        </span>
                      </span>
                    </div>
                  ) : (
                    <div className="text-xs sm:text-sm font-bold text-rose-600">
                      {locale === 'ar' ? appTexts.btnOutOfStockAr : appTexts.btnOutOfStockEn}
                    </div>
                  )}
                </div>
              </div>

              {/* Circular Color Swatches (matching screenshot 1) */}
              {product.variants.length > 0 && (
                <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-sm font-extrabold text-[#11223E] dark:text-white">
                      {t('اختر اللون', 'Choose Color')}
                    </span>
                    <span className="text-xs sm:text-sm font-semibold text-slate-500 dark:text-slate-400">
                      {activeVariant
                        ? locale === 'ar'
                          ? activeVariant.colorNameAr
                          : activeVariant.colorNameEn
                        : ''}
                    </span>
                  </div>
                  <div className="flex flex-wrap items-center gap-3">
                    {product.variants.map((v) => {
                      const selected = activeVariant?.id === v.id;
                      const label = locale === 'ar' ? v.colorNameAr : v.colorNameEn;
                      return (
                        <button
                          key={v.id}
                          type="button"
                          onClick={() => {
                            setVariantId(v.id);
                            setImgIdx(0);
                          }}
                          aria-label={label}
                          title={label}
                          className={`w-11 h-11 rounded-full transition-all flex items-center justify-center ${
                            selected
                              ? 'ring-2 ring-[#11223E] dark:ring-[#D9B24C] ring-offset-2 ring-offset-white dark:ring-offset-[#131C2E] scale-105'
                              : 'border-2 border-slate-200 dark:border-slate-700 hover:scale-105'
                          }`}
                          style={{ backgroundColor: v.colorHex }}
                        />
                      );
                    })}
                  </div>
                </div>
              )}

              {!rxCardOpen && rxVal.errors.length > 0 && (
                <ValidationSummaryBanner
                  errors={rxVal.errors}
                  onSelectField={rxVal.focusField}
                  mode="form"
                />
              )}

              {/* Quick Size / Power Picker (Clear & Colored Contact Lenses, Ready-Made Reading Glasses, or Admin-Enabled Products) */}
              {availableSizes.length > 0 && (
                <div
                  {...rxVal.getFieldWrapperProps('productSize')}
                  className={`pt-4 border-t border-slate-100 dark:border-slate-800 rounded-2xl p-3.5 space-y-3 transition-colors ${rxVal.getControlClasses(
                    'productSize',
                    'bg-amber-50/40 dark:bg-amber-950/15 border border-[#D9B24C]/50'
                  )}`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <span className="text-sm font-extrabold text-[#11223E] dark:text-white">
                      {t('اختر المقاس', 'Choose Size / Power')}
                    </span>
                    <span className="text-xs font-extrabold font-mono-num text-[#B38B2D] dark:text-[#E2BD5B]">
                      {isContact && clSizeMode === 'separate'
                        ? t(`يمين ${clRightSize} / يسار ${clLeftSize}`, `OD ${clRightSize} / OS ${clLeftSize}`)
                        : selectedSize || t('يرجى الاختيار', 'Please select')}
                    </span>
                  </div>

                  {isContact && (
                    <div className="bg-white dark:bg-[#131C2E] p-1 rounded-xl border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1">
                      <button
                        type="button"
                        onClick={() => setClSizeMode('same')}
                        className={`min-h-[36px] px-3 rounded-lg text-xs font-bold transition-colors ${
                          clSizeMode === 'same'
                            ? 'bg-[#11223E] text-white dark:bg-[#D9B24C] dark:text-[#11223E]'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {t('نفس المقاس للعينين', 'Same for Both Eyes')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setClSizeMode('separate')}
                        className={`min-h-[36px] px-3 rounded-lg text-xs font-bold transition-colors ${
                          clSizeMode === 'separate'
                            ? 'bg-[#11223E] text-white dark:bg-[#D9B24C] dark:text-[#11223E]'
                            : 'text-slate-600 dark:text-slate-300'
                        }`}
                      >
                        {t('مقاس مختلف لكل عين', 'Different per Eye')}
                      </button>
                    </div>
                  )}

                  {isContact && clSizeMode === 'separate' ? (
                    <div className="grid grid-cols-2 gap-2.5">
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                          {t('مقاس العين اليمنى (OD)', 'Right Eye (OD)')}
                        </label>
                        <select
                          value={clRightSize}
                          onChange={(e) => setClRightSize(e.target.value)}
                          className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-sm font-bold"
                        >
                          {availableSizes.map((sz) => (
                            <option key={`r_${sz}`} value={sz}>
                              {sz}
                            </option>
                          ))}
                        </select>
                      </div>
                      <div>
                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                          {t('مقاس العين اليسرى (OS)', 'Left Eye (OS)')}
                        </label>
                        <select
                          value={clLeftSize}
                          onChange={(e) => setClLeftSize(e.target.value)}
                          className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-sm font-bold"
                        >
                          {availableSizes.map((sz) => (
                            <option key={`l_${sz}`} value={sz}>
                              {sz}
                            </option>
                          ))}
                        </select>
                      </div>
                    </div>
                  ) : (
                    <div className="flex flex-wrap gap-2">
                      {availableSizes.map((sz) => {
                        const active = selectedSize === sz;
                        return (
                          <button
                            key={sz}
                            type="button"
                            onClick={() => setSelectedSize(sz)}
                            className={`min-h-[44px] min-w-[68px] px-3.5 py-2 rounded-xl border font-mono-num text-xs sm:text-sm font-extrabold transition-all ${
                              active
                                ? 'bg-[#11223E] text-white border-[#11223E] dark:bg-[#D9B24C] dark:text-[#11223E] dark:border-[#D9B24C] shadow-xs scale-[1.02]'
                                : 'bg-white dark:bg-[#131C2E] text-[#11223E] dark:text-slate-200 border-slate-200 dark:border-slate-700 hover:border-[#D9B24C]'
                            }`}
                          >
                            {sz}
                          </button>
                        );
                      })}
                    </div>
                  )}

                  {(isReading || isContact) && (
                    <p className="text-[11px] text-slate-500 dark:text-slate-400">
                      {isContact
                        ? t(
                            'اختر درجة العدسة المناسبة أعلاه أو استخدم "أدخل مقاسك" بالأسفل لرفع وصفة طبيب.',
                            'Pick your lens power above or use "Enter Your Prescription" below to upload a full Rx.'
                          )
                        : t(
                            'اختر درجة القراءة الجاهزة أعلاه أو أدخل وصفة طبية مفصلة بالأسفل.',
                            'Choose your ready-made reading power above or enter a custom Rx below.'
                          )}
                    </p>
                  )}

                  <FieldError
                    id={rxVal.getErrorId('productSize')}
                    message={rxVal.getError('productSize')}
                  />
                </div>
              )}

              {/* Description & Specs */}
              <div className="pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3 text-xs sm:text-sm">
                <div>
                  <h3 className="font-extrabold text-[#11223E] dark:text-white mb-1">
                    {t('الوصف', 'Description')}
                  </h3>
                  <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                    {locale === 'ar' ? product.descriptionAr : product.descriptionEn}
                  </p>
                </div>

                {specSummaryParts.length > 0 && (
                  <div>
                    <h3 className="font-extrabold text-[#11223E] dark:text-white mb-1">
                      {t('المواصفات', 'Specifications')}
                    </h3>
                    <p className="text-slate-500 dark:text-slate-400 leading-relaxed">
                      {specSummaryParts.join(' · ')}
                    </p>
                  </div>
                )}
              </div>

              {/* Delivery Fee Info Strip (matching screenshot 1 & 2) */}
              <div className="rounded-xl bg-slate-100/90 dark:bg-slate-900 border border-slate-200/70 dark:border-slate-800 px-4 py-3 flex items-center gap-2.5 text-xs sm:text-sm font-semibold text-[#11223E] dark:text-slate-200">
                <Truck className="w-4 h-4 text-[#B38B2D] dark:text-[#E2BD5B] shrink-0" />
                <span>{deliveryFeeSummary}</span>
              </div>

              {/* Optician Consult Link Row */}
              <button
                type="button"
                onClick={() => {
                  openProduct(null);
                  setActiveTab('consult');
                }}
                className="w-full min-h-[46px] rounded-xl border border-slate-200 dark:border-slate-800 bg-slate-50/70 hover:bg-slate-100 dark:bg-slate-900/60 dark:hover:bg-slate-900 px-4 py-2.5 flex items-center justify-center gap-2 text-xs sm:text-sm font-bold text-[#11223E] dark:text-slate-200 transition-colors"
              >
                <MessageCircle className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{t('استشر أخصائي البصريات قبل الطلب', 'Consult an Optician')}</span>
              </button>

              {/* Inline Collapsible "أدخل مقاسك" Card */}
              {isRxEligible && (
                <div className="rounded-2xl border-2 border-[#D9B24C]/70 bg-white dark:bg-[#131C2E] shadow-xs overflow-hidden">
                  {/* Collapsible Header */}
                  <button
                    type="button"
                    onClick={() => setRxCardOpen((prev) => !prev)}
                    className="w-full px-4 py-3.5 flex items-center justify-between gap-3 text-start bg-amber-50/40 dark:bg-amber-950/15 hover:bg-amber-50/70 dark:hover:bg-amber-950/25 transition-colors"
                  >
                    <div className="flex items-center gap-3 min-w-0">
                      <div className="w-11 h-11 rounded-xl bg-[#11223E] text-[#D9B24C] flex items-center justify-center shrink-0">
                        <Eye className="w-5 h-5" />
                      </div>
                      <div className="min-w-0">
                        <div className="text-sm sm:text-base font-extrabold text-[#11223E] dark:text-white flex items-center gap-2">
                          <span>{t('أدخل مقاسك', 'Enter Your Prescription')}</span>
                          {hasAnyRxInput && (
                            <span className="text-[11px] font-bold text-emerald-600 dark:text-emerald-400">
                              · {t('محدد', 'Selected')}
                            </span>
                          )}
                        </div>
                        <p className="text-xs text-slate-600 dark:text-slate-300 truncate">
                          {isContact
                            ? t('مقاسات العدسات اللاصقة (اختياري)', 'Contact lens measurements (optional)')
                            : t('مقاسات النظارة الطبية (OD / OS)', 'Eyewear prescription (OD / OS)')}
                        </p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2 shrink-0">
                      <span className="min-h-[36px] px-3 py-1.5 rounded-xl bg-[#D9B24C] text-[#11223E] border border-[#b38b2d] shadow-xs text-xs font-extrabold inline-flex items-center gap-1">
                        <span>{hasAnyRxInput ? t('تعديل المقاس', 'Edit Rx') : t('إضافة مقاس', 'Add Rx')}</span>
                        {rxCardOpen ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                      </span>
                    </div>
                  </button>

                  {rxCardOpen && (
                    <div className="px-4 pb-4 pt-3 space-y-4 text-xs border-t border-slate-100 dark:border-slate-800/80">
                      <ValidationSummaryBanner
                        errors={rxVal.errors}
                        onSelectField={rxVal.focusField}
                        mode="form"
                      />

                      {/* Vision Type & Combinable Extra Lens Options (for Glasses / Sunglasses) */}
                      {!isContact && (
                        <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/75 border border-slate-200/75 dark:border-slate-800 space-y-3.5">
                          <div className="space-y-2">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="font-extrabold text-[#11223E] dark:text-white">
                                {t('نوع الرؤية (اختياري)', 'Vision Type (Optional)')}
                              </span>
                              <button
                                type="button"
                                onClick={() => handleSelectVisionType('none')}
                                className={`min-h-[34px] px-2.5 rounded-lg border text-[11px] font-bold transition-colors ${
                                  visionType === 'none'
                                    ? 'border-[#11223E] bg-[#11223E] text-white dark:border-[#D9B24C] dark:bg-[#D9B24C] dark:text-[#11223E]'
                                    : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] text-slate-600 dark:text-slate-300'
                                }`}
                              >
                                {t('بدون عدسات (الإطار فقط)', 'Frame Only')}
                              </button>
                            </div>

                            <div className="grid grid-cols-2 gap-2">
                              {visibleVisionTypes.map((opt) => {
                                const selected = visionType === opt.id;
                                return (
                                  <button
                                    key={opt.id}
                                    type="button"
                                    onClick={() => handleSelectVisionType(opt.id as VisionType)}
                                    className={`min-h-[44px] px-3 py-2 rounded-xl border text-start flex items-center justify-between gap-1.5 transition-colors ${
                                      selected
                                        ? 'border-[#D9B24C] bg-[#D9B24C]/15 font-extrabold text-[#11223E] dark:text-white'
                                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] hover:border-slate-300'
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

                          {visibleExtraOptions.length > 0 && (
                            <div className="space-y-2 pt-3 border-t border-slate-200/80 dark:border-slate-800">
                              <div className="font-extrabold text-[#11223E] dark:text-white flex items-center gap-1.5">
                                <Sparkles className="w-3.5 h-3.5 text-[#D9B24C]" />
                                <span>
                                  {t('خيارات إضافية للعدسة (يمكن دمجها)', 'Extra Lens Options (Combinable)')}
                                </span>
                              </div>
                              <div className="grid sm:grid-cols-2 gap-2">
                                {visibleExtraOptions.map((opt) => {
                                  const extId = opt.id as ExtraLensOptionId;
                                  const checked = extraOptions.includes(extId);
                                  return (
                                    <button
                                      key={opt.id}
                                      type="button"
                                      onClick={() => handleToggleExtra(extId)}
                                      className={`min-h-[44px] px-3 py-2 rounded-xl border text-start flex items-center justify-between gap-2 transition-colors ${
                                        checked
                                          ? 'border-[#D9B24C] bg-[#D9B24C]/15 font-extrabold text-[#11223E] dark:text-white'
                                          : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] hover:border-slate-300'
                                      }`}
                                    >
                                      <span className="flex items-center gap-2 min-w-0">
                                        <span
                                          className={`w-4 h-4 rounded flex items-center justify-center border shrink-0 ${
                                            checked
                                              ? 'border-[#B38B2D] bg-[#D9B24C] text-[#11223E]'
                                              : 'border-slate-400 bg-white dark:bg-slate-900'
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

                              {extraOptions.includes('mirror') && (
                                <div
                                  {...rxVal.getFieldWrapperProps('mirrorColor')}
                                  className={`p-3 rounded-xl space-y-2 ${rxVal.getControlClasses(
                                    'mirrorColor',
                                    'bg-white dark:bg-[#131C2E] border border-[#D9B24C]/60'
                                  )}`}
                                >
                                  <span className="block text-[11px] font-extrabold text-[#11223E] dark:text-[#E2BD5B]">
                                    {t('لون العدسة العاكسة:', 'Mirror Lens Color:')}
                                  </span>
                                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                                    {MIRROR_COLOR_OPTIONS.map((c) => {
                                      const active = mirrorColor === c.id;
                                      return (
                                        <button
                                          key={c.id}
                                          type="button"
                                          onClick={() => setMirrorColor(c.id)}
                                          className={`min-h-[44px] px-2.5 py-1.5 rounded-lg border flex items-center gap-1.5 font-bold ${
                                            active
                                              ? 'border-[#D9B24C] bg-[#D9B24C]/15'
                                              : 'border-slate-200 dark:border-slate-700'
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
                                  <FieldError
                                    id={rxVal.getErrorId('mirrorColor')}
                                    message={rxVal.getError('mirrorColor')}
                                  />
                                </div>
                              )}
                            </div>
                          )}
                        </div>
                      )}

                      {/* Amber Checkbox Banner: "لا أعرف مقاسي، تواصلوا معي" (Screenshot 2) */}
                      <label className="rounded-xl bg-amber-50/90 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800/60 p-3.5 flex items-start gap-3 cursor-pointer">
                        <input
                          type="checkbox"
                          checked={dontKnowRx}
                          onChange={(e) => {
                            setDontKnowRx(e.target.checked);
                          }}
                          className="w-5 h-5 mt-0.5 rounded border-slate-300 accent-[#11223E] shrink-0"
                        />
                        <div className="space-y-0.5">
                          <div className="text-sm font-extrabold text-[#11223E] dark:text-amber-200">
                            {t('لا أعرف مقاسي، تواصلوا معي', "I don't know my prescription, contact me")}
                          </div>
                          <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                            {t(
                              'سيقوم فريقنا أو أخصائي البصريات بالتواصل معك لتأكيد المقاس المناسب قبل التجهيز.',
                              'Our team or optician will contact you (including WhatsApp) to confirm your prescription before preparation.'
                            )}
                          </p>
                        </div>
                      </label>

                      {!dontKnowRx && (
                        <>
                          {/* Saved Prescriptions Quick Fill */}
                          {isGuest ? (
                            <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/75 border border-slate-200/75 dark:border-slate-800 text-slate-600 dark:text-slate-300 font-semibold">
                              {t('المقاسات المحفوظة متاحة للحسابات المسجلة فقط — يمكنك إدخال مقاسك الآن يدوياً.', 'Saved prescriptions are for registered accounts — you can enter your Rx below.')}
                            </div>
                          ) : (
                            user.prescriptions.length > 0 && (
                              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900/75 border border-slate-200/75 dark:border-slate-800 space-y-1.5">
                                <label className="block font-bold text-[#11223E] dark:text-slate-200">
                                  {t('تعبئة سريعة من مقاساتك المحفوظة:', 'Quick-fill from saved prescriptions:')}
                                </label>
                                <select
                                  defaultValue=""
                                  onChange={(e) => e.target.value && handleApplySavedRx(e.target.value)}
                                  className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] text-sm"
                                >
                                  <option value="">{t('اختر مقاساً محفوظاً...', 'Select saved Rx...')}</option>
                                  {user.prescriptions.map((rx) => (
                                    <option key={rx.id} value={rx.id}>
                                      {rx.label} (OD {rx.rightEye?.sph} / OS {rx.leftEye?.sph})
                                    </option>
                                  ))}
                                </select>
                              </div>
                            )
                          )}

                          {isContact ? (
                            /* Contact Lens OD / OS Cards (SPH, CYL, AXIS, ADD) */
                            <div className="space-y-3">
                              {[
                                {
                                  key: 'right',
                                  field: 'clRight',
                                  title: t('العين اليمنى (OD)', 'Right Eye (OD)'),
                                  val: clRight,
                                  setVal: setClRight,
                                  showCopy: false,
                                },
                                {
                                  key: 'left',
                                  field: 'clLeft',
                                  title: t('العين اليسرى (OS)', 'Left Eye (OS)'),
                                  val: clLeft,
                                  setVal: setClLeft,
                                  showCopy: true,
                                },
                              ].map((eye) => {
                                const axisRequired = isNonZeroCyl(eye.val.cyl);
                                return (
                                  <div
                                    key={eye.key}
                                    {...rxVal.getFieldWrapperProps(eye.field)}
                                    className={`rounded-xl p-3.5 sm:p-4 space-y-3 ${rxVal.getControlClasses(
                                      eye.field,
                                      'bg-slate-50 dark:bg-slate-900/75 border border-slate-200/75 dark:border-slate-800'
                                    )}`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-sm font-extrabold text-[#11223E] dark:text-white">
                                        {eye.title}
                                      </span>
                                      {eye.showCopy && (
                                        <button
                                          type="button"
                                          onClick={handleCopyRightToLeft}
                                          className="min-h-[34px] px-2.5 rounded-lg text-xs font-bold text-[#11223E] dark:text-[#E2BD5B] hover:bg-white dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
                                        >
                                          <Copy className="w-3.5 h-3.5" />
                                          <span>{t('نسخ اليمنى إلى اليسرى', 'Copy Right to Left')}</span>
                                        </button>
                                      )}
                                    </div>

                                    <div className="grid grid-cols-3 gap-2">
                                      <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                                          SPH ({t('القوة', 'Power')})
                                        </label>
                                        <select
                                          value={eye.val.sph}
                                          onChange={(e) => {
                                            setManualTouched(true);
                                            eye.setVal({ ...eye.val, sph: e.target.value });
                                          }}
                                          className="w-full min-h-[44px] px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-sm"
                                        >
                                          {SPH_OPTIONS.map((o) => (
                                            <option key={o} value={o}>{o}</option>
                                          ))}
                                        </select>
                                      </div>

                                      <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                                          CYL ({t('الانحراف', 'Cyl')})
                                        </label>
                                        <select
                                          value={eye.val.cyl}
                                          onChange={(e) => {
                                            setManualTouched(true);
                                            eye.setVal({ ...eye.val, cyl: e.target.value });
                                          }}
                                          className="w-full min-h-[44px] px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-sm"
                                        >
                                          {CYL_OPTIONS.map((o) => (
                                            <option key={o} value={o}>{o}</option>
                                          ))}
                                        </select>
                                      </div>

                                      <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                                          AXIS ({t('المحور', 'Axis')})
                                        </label>
                                        <select
                                          disabled={!axisRequired}
                                          value={eye.val.axis}
                                          onChange={(e) => {
                                            setManualTouched(true);
                                            eye.setVal({ ...eye.val, axis: e.target.value });
                                          }}
                                          className="w-full min-h-[44px] px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-sm disabled:opacity-45"
                                        >
                                          {AXIS_OPTIONS.map((o) => (
                                            <option key={o} value={o}>{o}</option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>

                                    <div>
                                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                                        {t('ADD (اختياري)', 'ADD (Optional)')}
                                      </label>
                                      <select
                                        value={eye.val.add || ''}
                                        onChange={(e) => {
                                          setManualTouched(true);
                                          eye.setVal({ ...eye.val, add: e.target.value });
                                        }}
                                        className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-sm"
                                      >
                                        <option value="">{t('غير محدد (+1.50 اختياري)', 'None (+1.50 optional)')}</option>
                                        {ADD_OPTIONS.map((o) => (
                                          <option key={o} value={o}>{o}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <FieldError
                                      id={rxVal.getErrorId(eye.field)}
                                      message={rxVal.getError(eye.field)}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          ) : (
                            /* Eyeglasses / Sunglasses OD / OS / PD Cards matching Screenshots 2 & 3 */
                            <div className="space-y-3">
                              {[
                                {
                                  key: 'od',
                                  field: 'odEye',
                                  title: t('العين اليمنى (OD)', 'Right Eye (OD)'),
                                  val: rightEye,
                                  setVal: setRightEye,
                                  showCopy: false,
                                },
                                {
                                  key: 'os',
                                  field: 'osEye',
                                  title: t('العين اليسرى (OS)', 'Left Eye (OS)'),
                                  val: leftEye,
                                  setVal: setLeftEye,
                                  showCopy: true,
                                },
                              ].map((eye) => {
                                const axisRequired = isNonZeroCyl(eye.val.cyl);
                                return (
                                  <div
                                    key={eye.key}
                                    {...rxVal.getFieldWrapperProps(eye.field)}
                                    className={`rounded-xl p-3.5 sm:p-4 space-y-3 ${rxVal.getControlClasses(
                                      eye.field,
                                      'bg-slate-50 dark:bg-slate-900/75 border border-slate-200/75 dark:border-slate-800'
                                    )}`}
                                  >
                                    <div className="flex items-center justify-between gap-2">
                                      <span className="text-sm font-extrabold text-[#11223E] dark:text-white">
                                        {eye.title}
                                      </span>
                                      {eye.showCopy && (
                                        <button
                                          type="button"
                                          onClick={handleCopyRightToLeft}
                                          className="min-h-[34px] px-2.5 rounded-lg text-xs font-bold text-[#11223E] dark:text-[#E2BD5B] hover:bg-white dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
                                        >
                                          <Copy className="w-3.5 h-3.5" />
                                          <span>{t('نسخ اليمنى إلى اليسرى', 'Copy Right to Left')}</span>
                                        </button>
                                      )}
                                    </div>

                                    <div className="grid grid-cols-3 gap-2">
                                      <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                                          SPH ({t('القوة', 'Power')})
                                        </label>
                                        <select
                                          value={eye.val.sph}
                                          onChange={(e) => {
                                            setManualTouched(true);
                                            eye.setVal({ ...eye.val, sph: e.target.value });
                                          }}
                                          className="w-full min-h-[44px] px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-sm"
                                        >
                                          {SPH_OPTIONS.map((o) => (
                                            <option key={o} value={o}>{o}</option>
                                          ))}
                                        </select>
                                      </div>

                                      <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                                          CYL ({t('الانحراف', 'Cyl')})
                                        </label>
                                        <select
                                          value={eye.val.cyl}
                                          onChange={(e) => {
                                            setManualTouched(true);
                                            eye.setVal({ ...eye.val, cyl: e.target.value });
                                          }}
                                          className="w-full min-h-[44px] px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-sm"
                                        >
                                          {CYL_OPTIONS.map((o) => (
                                            <option key={o} value={o}>{o}</option>
                                          ))}
                                        </select>
                                      </div>

                                      <div>
                                        <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                                          AXIS ({t('المحور', 'Axis')})
                                        </label>
                                        <select
                                          disabled={!axisRequired}
                                          value={eye.val.axis}
                                          onChange={(e) => {
                                            setManualTouched(true);
                                            eye.setVal({ ...eye.val, axis: e.target.value });
                                          }}
                                          className="w-full min-h-[44px] px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-sm disabled:opacity-45"
                                        >
                                          {AXIS_OPTIONS.map((o) => (
                                            <option key={o} value={o}>{o}</option>
                                          ))}
                                        </select>
                                      </div>
                                    </div>

                                    <div>
                                      <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                                        {showAddRequired
                                          ? t('ADD (إضافة القراءة)', 'ADD (Reading Add)')
                                          : t('ADD (اختياري)', 'ADD (Optional)')}
                                      </label>
                                      <select
                                        value={eye.val.add || (showAddRequired ? '+1.50' : '')}
                                        onChange={(e) => {
                                          setManualTouched(true);
                                          eye.setVal({ ...eye.val, add: e.target.value });
                                        }}
                                        className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-sm"
                                      >
                                        {!showAddRequired && (
                                          <option value="">{t('غير محدد (+1.50 اختياري)', 'None (+1.50 optional)')}</option>
                                        )}
                                        {ADD_OPTIONS.map((o) => (
                                          <option key={o} value={o}>{o}</option>
                                        ))}
                                      </select>
                                    </div>
                                    <FieldError
                                      id={rxVal.getErrorId(eye.field)}
                                      message={rxVal.getError(eye.field)}
                                    />
                                  </div>
                                );
                              })}
                            </div>
                          )}

                          {/* PD Card with Segmented Toggle [قيمة واحدة | عينين منفصلتين] (Glasses & Contact Lenses) */}
                          <div className="rounded-xl bg-slate-50 dark:bg-slate-900/75 border border-slate-200/75 dark:border-slate-800 p-3.5 sm:p-4 space-y-3">
                            <div className="flex flex-wrap items-center justify-between gap-2">
                              <span className="text-sm font-extrabold text-[#11223E] dark:text-white">
                                {t('المسافة الحدقية (PD)', 'Pupillary Distance (PD)')}
                              </span>
                              {!isProgressive && (
                                <div className="bg-white dark:bg-[#131C2E] p-1 rounded-xl border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setManualTouched(true);
                                      setPdMode('single');
                                    }}
                                    className={`min-h-[34px] px-3 rounded-lg text-xs font-bold transition-colors ${
                                      pdMode === 'single'
                                        ? 'bg-[#11223E] text-white dark:bg-[#D9B24C] dark:text-[#11223E]'
                                        : 'text-slate-600 dark:text-slate-300'
                                    }`}
                                  >
                                    {t('قيمة واحدة', 'Single')}
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => {
                                      setManualTouched(true);
                                      setPdMode('dual');
                                    }}
                                    className={`min-h-[34px] px-3 rounded-lg text-xs font-bold transition-colors ${
                                      pdMode === 'dual'
                                        ? 'bg-[#11223E] text-white dark:bg-[#D9B24C] dark:text-[#11223E]'
                                        : 'text-slate-600 dark:text-slate-300'
                                    }`}
                                  >
                                    {t('عينين منفصلتين', 'Dual Eyes')}
                                  </button>
                                </div>
                              )}
                            </div>

                            {effectivePdMode === 'single' ? (
                              <select
                                value={pd}
                                onChange={(e) => {
                                  setManualTouched(true);
                                  setPd(e.target.value);
                                }}
                                className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-sm"
                              >
                                {PD_SINGLE_OPTIONS.map((o) => (
                                  <option key={o} value={o}>{o}</option>
                                ))}
                              </select>
                            ) : (
                              <div className="grid grid-cols-2 gap-2.5">
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                                    PD {t('العين اليمنى (OD)', 'Right (OD)')}
                                  </label>
                                  <select
                                    value={pdRight}
                                    onChange={(e) => {
                                      setManualTouched(true);
                                      setPdRight(e.target.value);
                                    }}
                                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-sm"
                                  >
                                    {PD_DUAL_OPTIONS.map((o) => (
                                      <option key={o} value={o}>{o} mm</option>
                                    ))}
                                  </select>
                                </div>
                                <div>
                                  <label className="block text-[11px] font-bold text-slate-600 dark:text-slate-300 mb-1">
                                    PD {t('العين اليسرى (OS)', 'Left (OS)')}
                                  </label>
                                  <select
                                    value={pdLeft}
                                    onChange={(e) => {
                                      setManualTouched(true);
                                      setPdLeft(e.target.value);
                                    }}
                                    className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-sm"
                                  >
                                    {PD_DUAL_OPTIONS.map((o) => (
                                      <option key={o} value={o}>{o} mm</option>
                                    ))}
                                  </select>
                                </div>
                              </div>
                            )}

                            {isProgressive && (
                              <div>
                                <label className="block text-[11px] font-bold text-[#11223E] dark:text-[#E2BD5B] mb-1">
                                  {t('ارتفاع التركيب (Fitting Height — مم)', 'Fitting Height (mm)')}
                                </label>
                                <select
                                  value={fittingHeight}
                                  onChange={(e) => {
                                    setManualTouched(true);
                                    setFittingHeight(e.target.value);
                                  }}
                                  className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-sm"
                                >
                                  {FITTING_HEIGHT_OPTIONS.map((o) => (
                                    <option key={o} value={o}>{o} mm</option>
                                  ))}
                                </select>
                              </div>
                            )}
                          </div>

                          {/* Divider: "أو ارفع صورة أو ملف PDF لوصفة الطبيب" */}
                          <div className="flex items-center gap-3 pt-1">
                            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                            <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                              {t('أو ارفع صورة أو ملف PDF لوصفة الطبيب', 'Or upload doctor prescription photo or PDF')}
                            </span>
                            <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                          </div>

                          {/* Photo / PDF Upload & Camera Buttons */}
                          <div className="space-y-3">
                            <input
                              ref={galleryInputRef}
                              type="file"
                              accept="image/*,application/pdf,.pdf"
                              onChange={handleImagePick}
                              className="hidden"
                            />
                            <input
                              ref={cameraInputRef}
                              type="file"
                              accept="image/*"
                              capture="environment"
                              onChange={handleImagePick}
                              className="hidden"
                            />

                            <div className="grid sm:grid-cols-2 gap-2">
                              <button
                                type="button"
                                disabled={uploading}
                                onClick={() => galleryInputRef.current?.click()}
                                className="min-h-[52px] px-4 py-2.5 rounded-xl bg-[#D9B24C] hover:bg-[#c9a13c] text-[#11223E] border border-[#b38b2d] shadow-xs flex items-center justify-center gap-2 font-extrabold text-sm cursor-pointer transition-colors disabled:opacity-50"
                              >
                                <Camera className="w-4 h-4 shrink-0" />
                                <span>{t('رفع صورة أو PDF للمقاس', 'Upload Photo / PDF')}</span>
                              </button>

                              <button
                                type="button"
                                disabled={uploading}
                                onClick={() => cameraInputRef.current?.click()}
                                className="min-h-[52px] px-4 py-2.5 rounded-xl bg-[#11223E] hover:opacity-95 text-white flex items-center justify-center gap-2 font-bold text-xs cursor-pointer transition-colors disabled:opacity-50"
                              >
                                <ImagePlus className="w-4 h-4 text-[#D9B24C] shrink-0" />
                                <span>{t('التقاط مباشر بالكاميرا', 'Take Photo Now')}</span>
                              </button>
                            </div>

                            {uploading && (
                              <div className="space-y-1.5">
                                <div className="flex items-center justify-center gap-2 font-bold text-[#B38B2D]">
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                  <span>{t(`جارٍ رفع الملف... ${uploadProgress}%`, `Uploading... ${uploadProgress}%`)}</span>
                                </div>
                                <div className="h-2 rounded-full bg-slate-200 dark:bg-slate-800 overflow-hidden max-w-xs mx-auto">
                                  <div
                                    className="h-full bg-[#D9B24C] transition-all duration-200"
                                    style={{ width: `${uploadProgress}%` }}
                                  />
                                </div>
                              </div>
                            )}

                            {uploadError && (
                              <p className="text-rose-600 dark:text-rose-400 font-bold text-center">
                                {uploadError}
                              </p>
                            )}

                            {imageUrl && (
                              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 flex flex-wrap items-center justify-between gap-3">
                                {isPdfPrescriptionUrl(imageUrl, fileType) ? (
                                  <div className="flex items-center gap-2.5 min-w-0 flex-1">
                                    <div className="w-11 h-11 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center shrink-0">
                                      <FileText className="w-5 h-5" />
                                    </div>
                                    <div className="min-w-0">
                                      <div className="font-bold text-xs text-[#11223E] dark:text-white truncate">
                                        {fileName || t('ملف الوصفة الطبية (PDF)', 'Prescription PDF')}
                                      </div>
                                      <a
                                        href={imageUrl}
                                        download={fileName || 'prescription.pdf'}
                                        className="text-[11px] font-bold text-[#B38B2D] hover:underline inline-flex items-center gap-1 mt-0.5"
                                      >
                                        <Download className="w-3 h-3" />
                                        <span>{t('معاينة / تحميل PDF', 'Download PDF')}</span>
                                      </a>
                                    </div>
                                  </div>
                                ) : (
                                  <img
                                    src={imageUrl}
                                    alt={t('معاينة الروشتة', 'Prescription preview')}
                                    className="h-20 w-24 rounded-lg border border-slate-200 dark:border-slate-700 object-cover"
                                  />
                                )}
                                <button
                                  type="button"
                                  onClick={() => void handleDeleteUploadedImage()}
                                  className="min-h-[40px] px-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 font-bold inline-flex items-center gap-1"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                  {isPdfPrescriptionUrl(imageUrl, fileType)
                                    ? t('حذف الملف', 'Delete File')
                                    : t('حذف الصورة', 'Delete Photo')}
                                </button>
                              </div>
                            )}
                          </div>
                        </>
                      )}

                      {/* Optional Notes + Guide + Clear */}
                      <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-2.5">
                        <input
                          type="text"
                          value={notes}
                          onChange={(e) => setNotes(e.target.value)}
                          placeholder={t(
                            'ملاحظات إضافية لفني البصريات (اختياري)...',
                            'Optional notes for optician...'
                          )}
                          className="w-full min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-xs sm:text-sm"
                        />

                        <div className="flex flex-wrap items-center justify-between gap-2">
                          <button
                            type="button"
                            onClick={() => setShowHowToRead((prev) => !prev)}
                            className="min-h-[36px] inline-flex items-center gap-1.5 font-bold text-[#B38B2D] dark:text-[#E2BD5B]"
                          >
                            <HelpCircle className="w-3.5 h-3.5" />
                            <span>{t('كيف أقرأ روشتتي الطبية؟', 'How to read my Rx?')}</span>
                          </button>

                          {hasAnyRxInput && (
                            <button
                              type="button"
                              onClick={resetAllRx}
                              className="min-h-[36px] inline-flex items-center gap-1 text-rose-600 dark:text-rose-400 font-bold hover:underline"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              <span>{t('إلغاء تحديد المقاس', 'Reset / Skip Rx')}</span>
                            </button>
                          )}
                        </div>

                        {showHowToRead && (
                          <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-700 space-y-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                            <div>• {t('OD تعني العين اليمنى، وOS تعني العين اليسرى.', 'OD = Right Eye, OS = Left Eye.')}</div>
                            <div>• {t('(-) في SPH تعني قصر نظر، و(+) تعني طول نظر.', '(-) SPH = nearsighted, (+) = farsighted.')}</div>
                            <div>• {t('إذا كانت قيمة CYL تساوي 0.00، فلا يلزم تحديد زاوية AXIS.', 'When CYL is 0.00, AXIS is disabled.')}</div>
                            <div>• {t('تخطي المقاس مسموح دائماً — لن يعيق إضافة المنتج للسلة.', 'Skipping prescription never blocks adding to cart.')}</div>
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Mobile Reviews Section */}
              <div className="lg:hidden pt-4 border-t border-slate-100 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between">
                  <h3 className="text-sm font-extrabold text-[#11223E] dark:text-white">
                    {t('تقييمات العملاء', 'Customer Reviews')}
                  </h3>
                  <span className="flex items-center gap-1 text-xs font-bold tabular-nums">
                    <Star className="w-3.5 h-3.5 fill-amber-500 text-amber-500" />
                    {product.rating.toFixed(1)} ({approvedReviews.length})
                  </span>
                </div>
                {approvedReviews.slice(0, 3).map((r) => (
                  <div
                    key={r.id}
                    className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200/60 dark:border-slate-800 text-xs space-y-1"
                  >
                    <div className="flex items-center justify-between font-bold">
                      <span>{r.userName}</span>
                      <span className="text-amber-600 tabular-nums">{'★'.repeat(r.rating)}</span>
                    </div>
                    <p className="text-slate-600 dark:text-slate-400">{r.comment}</p>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Clean Sticky Bottom Bar (Screenshot 1/2/3 — zero overlap!) */}
        <div className="sticky bottom-0 z-20 bg-white/95 dark:bg-[#131C2E]/95 backdrop-blur-md border-t border-slate-200 dark:border-slate-800 px-4 sm:px-6 py-3 pb-[calc(12px+env(safe-area-inset-bottom))] flex items-center justify-between gap-3 shrink-0">
          <div className="flex items-center gap-2 sm:gap-3 flex-1 min-w-0">
            <div className="flex items-center border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 rounded-xl shrink-0">
              <button
                type="button"
                onClick={() => setQty((q) => Math.max(1, q - 1))}
                className="min-h-[46px] px-3 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-s-xl"
                aria-label={t('إنقاص الكمية', 'Decrease quantity')}
              >
                −
              </button>
              <span className="px-3 font-mono-num text-sm font-extrabold tabular-nums">{qty}</span>
              <button
                type="button"
                onClick={() => setQty((q) => Math.min(Math.max(1, product.stock), q + 1))}
                className="min-h-[46px] px-3 text-sm font-bold hover:bg-slate-100 dark:hover:bg-slate-800 rounded-e-xl"
                aria-label={t('زيادة الكمية', 'Increase quantity')}
              >
                +
              </button>
            </div>

            <button
              type="button"
              disabled={isUnavailable || uploading}
              onClick={handleAddToCart}
              className="flex-1 sm:flex-none sm:min-w-[200px] min-h-[50px] px-5 py-3 rounded-2xl bg-[#11223E] text-white dark:bg-[#D9B24C] dark:text-[#11223E] font-extrabold text-sm flex items-center justify-center gap-2.5 shadow-lg hover:opacity-95 active:scale-[0.99] transition-all disabled:opacity-50"
            >
              <ShoppingBag className="w-4 h-4 text-[#D9B24C] dark:text-[#11223E] shrink-0" />
              <span className="truncate">
                {isUnavailable
                  ? locale === 'ar'
                    ? appTexts.btnOutOfStockAr
                    : appTexts.btnOutOfStockEn
                  : locale === 'ar'
                  ? appTexts.btnAddToCartAr
                  : appTexts.btnAddToCartEn}
              </span>
            </button>
          </div>

          <div className="text-end shrink-0">
            <div className="font-mono-num text-lg sm:text-xl font-extrabold text-[#11223E] dark:text-[#E2BD5B] tabular-nums">
              {formatSdg(unitFinalSdg * qty)}
            </div>
            {(qty > 1 || lensExtraSdg > 0) && (
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 tabular-nums">
                {qty > 1
                  ? `${qty} × ${formatSdg(unitFinalSdg)}`
                  : t('شامل العدسات المختارة', 'Includes selected lenses')}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
