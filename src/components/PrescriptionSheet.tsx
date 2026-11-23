import React, { useEffect, useMemo, useState } from 'react';
import {
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Eye,
  FileText,
  HelpCircle,
  ImagePlus,
  Loader2,
  LogIn,
  MessageCircle,
  ShieldAlert,
  SkipForward,
  Sparkles,
  Trash2,
  X,
} from 'lucide-react';
import { useStore } from '../store/StoreContext';
import {
  ContactLensEyePrescription,
  ExtraLensOptionId,
  EyePrescription,
  MirrorColorId,
  PrescriptionData,
  Product,
  VisionType,
} from '../types';
import { formatSdg } from '../utils/format';
import {
  ADD_OPTIONS,
  AXIS_OPTIONS,
  BC_OPTIONS,
  CYL_OPTIONS,
  DIA_OPTIONS,
  EXTRA_OPTION_IDS,
  FITTING_HEIGHT_OPTIONS,
  MIRROR_COLOR_OPTIONS,
  PD_DUAL_OPTIONS,
  PD_SINGLE_OPTIONS,
  SPH_OPTIONS,
  VISION_TYPE_IDS,
  calculateLensPricingBreakdown,
  compressPrescriptionImage,
  getExtraOptionLabel,
  getMirrorColorLabel,
  getVisionTypeLabel,
  isContactLensProduct,
  isNonZeroCyl,
  resolveExtraOptions,
  resolveVisionType,
  validateContactEye,
  validateEyeglassesEye,
} from '../utils/prescription';
import { auth, deletePrescriptionImage, uploadPrescriptionImage } from '../lib/firebase';

interface PrescriptionSheetProps {
  open: boolean;
  product: Product;
  initialPrescription?: PrescriptionData;
  onClose: () => void;
  onSave: (rx: PrescriptionData | undefined) => void;
  onRemove?: () => void;
}

const DEFAULT_EYE: EyePrescription = { sph: '0.00', cyl: '0.00', axis: '0', add: '+1.50' };
const DEFAULT_CL_EYE: ContactLensEyePrescription = {
  sph: '-1.00',
  cyl: '0.00',
  axis: '0',
  bc: '8.6',
  dia: '14.2',
  boxes: 1,
};

export const PrescriptionSheet: React.FC<PrescriptionSheetProps> = ({
  open,
  product,
  initialPrescription,
  onClose,
  onSave,
  onRemove,
}) => {
  const {
    locale,
    t,
    categories,
    lensOptions,
    appearance,
    user,
    isGuest,
    openAuthModal,
    savePrescription,
    showToast,
  } = useStore();

  const isContact = isContactLensProduct(product, categories);

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

  // Vision type & extra coatings state
  const [visionType, setVisionType] = useState<VisionType>('none');
  const [extraOptions, setExtraOptions] = useState<ExtraLensOptionId[]>([]);
  const [mirrorColor, setMirrorColor] = useState<MirrorColorId>('silver');

  // Prescription input method state ('manual' | 'image' | 'later' | 'none')
  const [choice, setChoice] = useState<'manual' | 'image' | 'later' | 'none'>('manual');

  // Eyeglasses / Sunglasses manual state
  const [rightEye, setRightEye] = useState<EyePrescription>({ ...DEFAULT_EYE, add: '' });
  const [leftEye, setLeftEye] = useState<EyePrescription>({ ...DEFAULT_EYE, add: '' });
  const [pdMode, setPdMode] = useState<'single' | 'dual'>('single');
  const [pd, setPd] = useState('63');
  const [pdRight, setPdRight] = useState('31.5');
  const [pdLeft, setPdLeft] = useState('31.5');
  const [fittingHeight, setFittingHeight] = useState('18');

  // Contact lens manual state
  const [clRight, setClRight] = useState<ContactLensEyePrescription>(DEFAULT_CL_EYE);
  const [clLeft, setClLeft] = useState<ContactLensEyePrescription>(DEFAULT_CL_EYE);

  // Image upload state
  const [imageUrl, setImageUrl] = useState('');
  const [storagePath, setStoragePath] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  // Save & guide state
  const [notes, setNotes] = useState('');
  const [saveToAccount, setSaveToAccount] = useState(false);
  const [rxLabel, setRxLabel] = useState('');
  const [showHowToRead, setShowHowToRead] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setValidationError(null);
    setUploadError(null);

    const init = initialPrescription;
    if (init) {
      const initVision = isContact ? 'none' : resolveVisionType(init);
      const initExtras = isContact ? [] : resolveExtraOptions(init);
      setVisionType(initVision);
      setExtraOptions(initExtras);
      setMirrorColor(init.mirrorColor || 'silver');
      setChoice(init.type && init.type !== 'none' ? init.type : 'manual');
      setNotes(init.notes || '');

      if (init.type === 'manual') {
        if (
          init.values?.kind === 'contact_lenses' &&
          init.values.contactRight &&
          init.values.contactLeft
        ) {
          setClRight(init.values.contactRight);
          setClLeft(init.values.contactLeft);
        } else {
          const r = init.values?.rightEye || init.rightEye || DEFAULT_EYE;
          const l = init.values?.leftEye || init.leftEye || DEFAULT_EYE;
          setRightEye({
            sph: r.sph || '0.00',
            cyl: r.cyl || '0.00',
            axis: r.axis || '0',
            add: r.add || (initVision === 'bifocal' || initVision === 'progressive' ? '+1.50' : ''),
          });
          setLeftEye({
            sph: l.sph || '0.00',
            cyl: l.cyl || '0.00',
            axis: l.axis || '0',
            add: l.add || (initVision === 'bifocal' || initVision === 'progressive' ? '+1.50' : ''),
          });
          setPdMode(initVision === 'progressive' ? 'dual' : init.values?.pdMode || init.pdMode || 'single');
          setPd(init.values?.pd || init.pd || '63');
          setPdRight(init.values?.pdRight || init.pdRight || '31.5');
          setPdLeft(init.values?.pdLeft || init.pdLeft || '31.5');
          setFittingHeight(init.values?.fittingHeight || init.fittingHeight || '18');
        }
        setImageUrl('');
        setStoragePath('');
      } else if (init.type === 'image') {
        setImageUrl(init.imageUrl || '');
        setStoragePath(init.storagePath || '');
      } else {
        setRightEye({
          sph: '0.00',
          cyl: '0.00',
          axis: '0',
          add: initVision === 'bifocal' || initVision === 'progressive' ? '+1.50' : '',
        });
        setLeftEye({
          sph: '0.00',
          cyl: '0.00',
          axis: '0',
          add: initVision === 'bifocal' || initVision === 'progressive' ? '+1.50' : '',
        });
        setPdMode(initVision === 'progressive' ? 'dual' : 'single');
        setPd('63');
        setPdRight('31.5');
        setPdLeft('31.5');
        setFittingHeight('18');
        setImageUrl('');
        setStoragePath('');
      }
    } else {
      setVisionType(isContact ? 'none' : visibleVisionTypes[0]?.id ? (visibleVisionTypes[0].id as VisionType) : 'distance');
      setExtraOptions([]);
      setMirrorColor('silver');
      setChoice('manual');
      setRightEye({ sph: '0.00', cyl: '0.00', axis: '0', add: '' });
      setLeftEye({ sph: '0.00', cyl: '0.00', axis: '0', add: '' });
      setPdMode('single');
      setPd('63');
      setPdRight('31.5');
      setPdLeft('31.5');
      setFittingHeight('18');
      setClRight(
        product.contactLensSpecs
          ? {
              ...DEFAULT_CL_EYE,
              sph: product.contactLensSpecs.sphOptions[0] || '-1.00',
              bc: product.contactLensSpecs.baseCurve || '8.6',
              dia: product.contactLensSpecs.diameter || '14.2',
            }
          : DEFAULT_CL_EYE
      );
      setClLeft(
        product.contactLensSpecs
          ? {
              ...DEFAULT_CL_EYE,
              sph: product.contactLensSpecs.sphOptions[0] || '-1.00',
              bc: product.contactLensSpecs.baseCurve || '8.6',
              dia: product.contactLensSpecs.diameter || '14.2',
            }
          : DEFAULT_CL_EYE
      );
      setImageUrl('');
      setStoragePath('');
      setNotes('');
      setSaveToAccount(false);
      setRxLabel('');
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, product.id]);

  // Progressive requires per-eye PD and ADD + Fitting Height; Bifocal requires ADD
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

  const toggleExtraOption = (id: ExtraLensOptionId) => {
    setExtraOptions((prev) =>
      prev.includes(id) ? prev.filter((item) => item !== id) : [...prev, id]
    );
  };

  if (!open) return null;

  const isProgressive = !isContact && visionType === 'progressive';
  const isBifocal = !isContact && visionType === 'bifocal';
  const showAddField = isBifocal || isProgressive;
  const effectivePdMode = isProgressive ? 'dual' : pdMode;

  const pricing = isContact
    ? calculateLensPricingBreakdown('none', [], lensOptions)
    : calculateLensPricingBreakdown(visionType, extraOptions, lensOptions);

  const unitTotalWithLens = product.priceSdg + pricing.totalExtraSdg;

  const handleApplySavedRx = (id: string) => {
    const found = user.prescriptions.find((r) => r.id === id);
    if (!found) return;
    setChoice('manual');
    if (found.kind === 'contact_lenses' && found.contactRight && found.contactLeft && isContact) {
      setClRight(found.contactRight);
      setClLeft(found.contactLeft);
    } else {
      setRightEye(found.rightEye || { ...DEFAULT_EYE, add: '' });
      setLeftEye(found.leftEye || { ...DEFAULT_EYE, add: '' });
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
    if (!file.type.startsWith('image/')) {
      setUploadError(t('يرجى اختيار ملف صورة فقط (JPG أو PNG)', 'Please select an image file only'));
      return;
    }

    const fbUid = auth.currentUser?.uid || user.uid;
    if (!fbUid || fbUid === 'guest_pending') {
      setUploadError(
        t('يرجى الانتظار لحظة أو تسجيل الدخول لرفع الصورة', 'Please sign in first to upload image')
      );
      return;
    }

    setUploadError(null);
    setUploading(true);
    setUploadProgress(5);
    try {
      const compressedBlob = await compressPrescriptionImage(file, 1200);
      if (compressedBlob.size > 5 * 1024 * 1024) {
        setUploadError(t('حجم الصورة يتجاوز الحد الأقصى 5 ميجابايت', 'Image exceeds 5MB limit'));
        setUploading(false);
        return;
      }
      if (storagePath) {
        await deletePrescriptionImage(storagePath);
      }
      const uploaded = await uploadPrescriptionImage(fbUid, compressedBlob, file.name, (pct) =>
        setUploadProgress(pct)
      );
      setImageUrl(uploaded.url);
      setStoragePath(uploaded.path);
      showToast(t('تم رفع صورة الروشتة بنجاح', 'Prescription image uploaded'));
    } catch {
      setUploadError(
        t(
          'تعذر رفع الصورة إلى الخادم. تأكد من الاتصال بالإنترنت وحاول مرة أخرى.',
          'Failed to upload image to Firebase Storage. Please check your connection and try again.'
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
    setUploadProgress(0);
  };

  const buildBaseLensFields = () => ({
    visionType: isContact ? ('none' as const) : pricing.visionType,
    visionTypePriceSdg: isContact ? 0 : pricing.visionTypePriceSdg,
    extraOptions: isContact ? undefined : pricing.extraOptions.length > 0 ? pricing.extraOptions : undefined,
    extraOptionsPricesSdg:
      !isContact && pricing.extraOptions.length > 0 ? pricing.extraOptionsPricesSdg : undefined,
    mirrorColor: !isContact && pricing.extraOptions.includes('mirror') ? mirrorColor : undefined,
    lensOption: isContact
      ? ('none' as const)
      : pricing.visionType !== 'none'
      ? pricing.visionType
      : pricing.extraOptions[0] || ('none' as const),
    lensExtraPriceSdg: isContact ? 0 : pricing.totalExtraSdg,
  });

  const handleConfirm = () => {
    setValidationError(null);
    const lensFields = buildBaseLensFields();

    // If skipped entering prescription values
    if (choice === 'none') {
      if (isContact) {
        onSave(undefined);
        onClose();
        return;
      }
      if (pricing.visionType === 'none' && pricing.extraOptions.length === 0 && !notes.trim()) {
        onSave(undefined);
        onClose();
        return;
      }
      onSave({
        type: 'none',
        mode: 'none',
        ...lensFields,
        notes: notes.trim() || undefined,
      });
      onClose();
      return;
    }

    if (choice === 'manual') {
      if (isContact) {
        const errR = validateContactEye(clRight, 'العين اليمنى', 'Right Eye', locale);
        if (errR) {
          setValidationError(errR);
          return;
        }
        const errL = validateContactEye(clLeft, 'العين اليسرى', 'Left Eye', locale);
        if (errL) {
          setValidationError(errL);
          return;
        }
        if (clRight.boxes === 0 && clLeft.boxes === 0) {
          setValidationError(
            t('يرجى تحديد علبة واحدة على الأقل لإحدى العينين', 'Select at least 1 box for either eye')
          );
          return;
        }

        if (saveToAccount && !isGuest) {
          savePrescription({
            label: rxLabel.trim() || t('عدسات لاصقة', 'Contact Lens Rx'),
            kind: 'contact_lenses',
            rightEye: { sph: clRight.sph, cyl: clRight.cyl, axis: clRight.axis },
            leftEye: { sph: clLeft.sph, cyl: clLeft.cyl, axis: clLeft.axis },
            pd: '63',
            contactRight: clRight,
            contactLeft: clLeft,
            notes: notes.trim() || undefined,
          });
        }

        onSave({
          type: 'manual',
          mode: 'manual',
          ...lensFields,
          rightEye: { sph: clRight.sph, cyl: clRight.cyl, axis: clRight.axis },
          leftEye: { sph: clLeft.sph, cyl: clLeft.cyl, axis: clLeft.axis },
          values: {
            kind: 'contact_lenses',
            contactRight: clRight,
            contactLeft: clLeft,
          },
          notes: notes.trim() || undefined,
        });
        onClose();
        return;
      }

      const normalizedRightEye: EyePrescription = {
        sph: rightEye.sph,
        cyl: rightEye.cyl,
        axis: isNonZeroCyl(rightEye.cyl) ? rightEye.axis : '0',
        add: showAddField ? rightEye.add || '+1.50' : undefined,
      };
      const normalizedLeftEye: EyePrescription = {
        sph: leftEye.sph,
        cyl: leftEye.cyl,
        axis: isNonZeroCyl(leftEye.cyl) ? leftEye.axis : '0',
        add: showAddField ? leftEye.add || '+1.50' : undefined,
      };

      const errR = validateEyeglassesEye(
        normalizedRightEye,
        'العين اليمنى (OD)',
        'Right Eye (OD)',
        locale
      );
      if (errR) {
        setValidationError(errR);
        return;
      }
      const errL = validateEyeglassesEye(
        normalizedLeftEye,
        'العين اليسرى (OS)',
        'Left Eye (OS)',
        locale
      );
      if (errL) {
        setValidationError(errL);
        return;
      }

      const computedPd = effectivePdMode === 'single' ? pd : `${pdRight}/${pdLeft}`;
      const resolvedFittingHeight = isProgressive ? fittingHeight || '18' : undefined;

      if (saveToAccount && !isGuest) {
        savePrescription({
          label: rxLabel.trim() || t('مقاس نظارة', 'Glasses Rx'),
          kind: 'eyeglasses',
          rightEye: normalizedRightEye,
          leftEye: normalizedLeftEye,
          pd: computedPd,
          pdMode: effectivePdMode,
          pdRight: effectivePdMode === 'dual' ? pdRight : undefined,
          pdLeft: effectivePdMode === 'dual' ? pdLeft : undefined,
          notes:
            [
              notes.trim(),
              resolvedFittingHeight
                ? `Fitting Height: ${resolvedFittingHeight} mm`
                : '',
            ]
              .filter(Boolean)
              .join(' | ') || undefined,
        });
      }

      onSave({
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
      });
      onClose();
      return;
    }

    if (choice === 'image') {
      if (!imageUrl) {
        setValidationError(
          t('يرجى رفع صورة الروشتة أولاً أو اختيار طريقة أخرى', 'Please upload the prescription photo first')
        );
        return;
      }
      onSave({
        type: 'image',
        mode: 'image',
        imageUrl,
        storagePath,
        ...lensFields,
        notes: notes.trim() || undefined,
      });
      onClose();
      return;
    }

    // choice === 'later'
    onSave({
      type: 'later',
      mode: 'later',
      ...lensFields,
      notes: notes.trim() || undefined,
    });
    onClose();
  };

  return (
    <div
      className="fixed inset-0 z-[75] bg-black/65 backdrop-blur-xs flex items-end sm:items-center justify-center sm:p-4"
      role="dialog"
      aria-modal="true"
    >
      <div className="w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-3xl bg-white dark:bg-[#131C2E] sm:rounded-2xl border-t sm:border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden shadow-2xl">
        {/* Sticky Header */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-200 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0 bg-white dark:bg-[#131C2E]">
          <div className="flex items-center gap-2 min-w-0">
            <Eye className="w-5 h-5 text-[#D9B24C] shrink-0" />
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-extrabold truncate">
                {isContact
                  ? t('مقاس العدسات اللاصقة (اختياري)', 'Contact Lens Prescription (Optional)')
                  : t('اختيار العدسات ومقاس النظر (اختياري)', 'Lens Options & Prescription (Optional)')}
              </h2>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                {locale === 'ar' ? product.titleAr : product.titleEn}
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label={t('إغلاق', 'Close')}
            className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Scrollable Body */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6 text-xs">
          {/* STEP 1 & 2: Eyeglasses / Sunglasses Vision Type & Extra Options */}
          {!isContact && (
            <div className="space-y-5">
              {/* 1) Vision Type (Choose One) */}
              <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#11223E] dark:text-white">
                      {t('1) نوع الرؤية المطلوب (اختر واحداً)', '1) Vision Type (Choose One)')}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {t(
                        'اختر نوع العدسة المناسب لاستخدامك اليومي أو تخطَّه للإطار فقط',
                        'Select the vision type that matches your eyewear prescription or keep frame only'
                      )}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleSelectVisionType('none')}
                    className={`min-h-[40px] px-3 rounded-xl border text-[11px] font-bold transition-colors ${
                      visionType === 'none'
                        ? 'border-[#D9B24C] bg-[#D9B24C]/20 text-[#11223E] dark:text-[#E2BD5B]'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {t('بدون عدسات طبية (الإطار فقط)', 'Frame Only (No Rx Lenses)')}
                  </button>
                </div>

                <div className="grid sm:grid-cols-2 gap-2.5">
                  {visibleVisionTypes.map((opt) => {
                    const selected = visionType === opt.id;
                    return (
                      <button
                        key={opt.id}
                        type="button"
                        onClick={() => handleSelectVisionType(opt.id as VisionType)}
                        className={`min-h-[52px] p-3 rounded-xl border-2 text-start flex items-center justify-between gap-2 transition-colors ${
                          selected
                            ? 'border-[#D9B24C] bg-[#D9B24C]/15 font-extrabold text-[#11223E] dark:text-white'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] hover:border-slate-300'
                        }`}
                      >
                        <div className="flex items-center gap-2 min-w-0">
                          <span
                            className={`w-4 h-4 rounded-full border-2 flex items-center justify-center shrink-0 ${
                              selected ? 'border-[#B38B2D] bg-[#D9B24C]' : 'border-slate-400'
                            }`}
                          >
                            {selected && <span className="w-1.5 h-1.5 rounded-full bg-[#11223E]" />}
                          </span>
                          <span className="truncate">
                            {locale === 'ar' ? opt.labelAr : opt.labelEn}
                          </span>
                        </div>
                        <span className="font-mono-num text-[11px] font-bold text-[#B38B2D] dark:text-[#E2BD5B] shrink-0">
                          {opt.extraSdg === 0 ? t('مجاني', 'Free') : `+${formatSdg(opt.extraSdg)}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 2) Extra Options (Optional, Combinable) */}
              {visibleExtraOptions.length > 0 && (
                <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3">
                  <div>
                    <h3 className="text-sm font-extrabold text-[#11223E] dark:text-white flex items-center gap-1.5">
                      <Sparkles className="w-4 h-4 text-[#D9B24C]" />
                      {t('2) خيارات وطبقات إضافية (اختياري — يمكن دمج أكثر من خيار)', '2) Extra Lens Options (Optional — Combinable)')}
                    </h3>
                    <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                      {t(
                        'أضف طبقات الحماية التي تناسبك؛ تُجمع أسعار الخيارات المختارة تلقائياً',
                        'Combine any lens treatments below; prices add automatically'
                      )}
                    </p>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-2.5">
                    {visibleExtraOptions.map((opt) => {
                      const extId = opt.id as ExtraLensOptionId;
                      const checked = extraOptions.includes(extId);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => toggleExtraOption(extId)}
                          className={`min-h-[50px] p-3 rounded-xl border-2 text-start flex items-center justify-between gap-2 transition-colors ${
                            checked
                              ? 'border-[#D9B24C] bg-[#D9B24C]/15 font-extrabold text-[#11223E] dark:text-white'
                              : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-center gap-2 min-w-0">
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
                          </div>
                          <span className="font-mono-num text-[11px] font-bold text-[#B38B2D] dark:text-[#E2BD5B] shrink-0">
                            {opt.extraSdg === 0 ? t('مجاني', 'Free') : `+${formatSdg(opt.extraSdg)}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {/* Mirror Lens Color Choice when 'mirror' is selected */}
                  {extraOptions.includes('mirror') && (
                    <div className="p-3.5 rounded-xl bg-white dark:bg-[#131C2E] border border-[#D9B24C]/60 space-y-2.5">
                      <div className="font-extrabold text-[#11223E] dark:text-[#E2BD5B]">
                        {t('اختر لون العدسة العاكسة (Mirror Color):', 'Choose Mirror Lens Color:')}
                      </div>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        {MIRROR_COLOR_OPTIONS.map((c) => {
                          const active = mirrorColor === c.id;
                          return (
                            <button
                              key={c.id}
                              type="button"
                              onClick={() => setMirrorColor(c.id)}
                              className={`min-h-[44px] px-3 py-2 rounded-xl border-2 flex items-center gap-2 font-bold transition-colors ${
                                active
                                  ? 'border-[#D9B24C] bg-[#D9B24C]/15 text-[#11223E] dark:text-white'
                                  : 'border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              <span
                                className="w-4 h-4 rounded-full border border-black/20 shrink-0"
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

          {/* STEP 3: Optional Prescription Method */}
          <div className="space-y-4">
            <div>
              <h3 className="text-sm font-extrabold text-[#11223E] dark:text-white">
                {isContact
                  ? t('مقاس العدسات اللاصقة (اختياري — يمكنك التخطي)', 'Contact Lens Prescription (Optional — Skippable)')
                  : t('3) مقاس النظر (اختياري — يمكنك الإضافة للسلة بدونه)', '3) Prescription Entry (Optional — Skippable)')}
              </h3>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
              <button
                type="button"
                onClick={() => setChoice('manual')}
                className={`min-h-[50px] p-2.5 rounded-xl border text-start flex items-center gap-2 transition-colors ${
                  choice === 'manual'
                    ? 'border-[#D9B24C] bg-[#D9B24C]/15 font-extrabold text-[#11223E] dark:text-[#E2BD5B]'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                }`}
              >
                <FileText className="w-4 h-4 shrink-0" />
                <span>{t('إدخال المقاس يدوياً', 'Enter Manually')}</span>
              </button>

              <button
                type="button"
                onClick={() => setChoice('image')}
                className={`min-h-[50px] p-2.5 rounded-xl border text-start flex items-center gap-2 transition-colors ${
                  choice === 'image'
                    ? 'border-[#D9B24C] bg-[#D9B24C]/15 font-extrabold text-[#11223E] dark:text-[#E2BD5B]'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                }`}
              >
                <Camera className="w-4 h-4 shrink-0" />
                <span>{t('رفع صورة الروشتة', 'Upload Rx Photo')}</span>
              </button>

              <button
                type="button"
                onClick={() => setChoice('later')}
                className={`min-h-[50px] p-2.5 rounded-xl border text-start flex items-center gap-2 transition-colors ${
                  choice === 'later'
                    ? 'border-[#D9B24C] bg-[#D9B24C]/15 font-extrabold text-[#11223E] dark:text-[#E2BD5B]'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                }`}
              >
                <MessageCircle className="w-4 h-4 shrink-0" />
                <span>{t('إرسال لاحقاً بالواتساب', 'WhatsApp Later')}</span>
              </button>

              <button
                type="button"
                onClick={() => setChoice('none')}
                className={`min-h-[50px] p-2.5 rounded-xl border text-start flex items-center gap-2 transition-colors ${
                  choice === 'none'
                    ? 'border-[#D9B24C] bg-[#D9B24C]/15 font-extrabold text-[#11223E] dark:text-[#E2BD5B]'
                    : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                }`}
              >
                <SkipForward className="w-4 h-4 shrink-0" />
                <span>{t('تخطي إدخال المقاس', 'Skip Rx Entry')}</span>
              </button>
            </div>

            {choice === 'none' && (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
                {isContact
                  ? t(
                      'يمكنك الإضافة للسلة الآن بدون إدخال مقاس، وسيتواصل معك فريقنا عند الحاجة.',
                      'You can add to cart directly without entering prescription values.'
                    )
                  : t(
                      'تم تخطي إدخال أرقام الكشف؛ سيتم حفظ نوع الرؤية والخيارات الإضافية المختارة أعلاه فقط.',
                      'Prescription numbers skipped; only your selected vision type and extra lens options will be saved.'
                    )}
              </div>
            )}

            {/* Choice 1: Manual Entry */}
            {choice === 'manual' && (
              <div className="space-y-4">
                {/* Saved Rx Quick Apply (Signed-in vs Guest notice) */}
                {isGuest ? (
                  <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-900/50 flex flex-wrap items-center justify-between gap-2">
                    <span className="font-semibold text-[#11223E] dark:text-amber-200">
                      {t('سجّل دخولك لحفظ المقاس واستخدام مقاساتك المحفوظة', 'Sign in to save or reuse prescriptions')}
                    </span>
                    <button
                      type="button"
                      onClick={() => openAuthModal('login', false)}
                      style={{ backgroundColor: appearance.primaryColor }}
                      className="min-h-[40px] px-3 rounded-lg text-white font-bold inline-flex items-center gap-1"
                    >
                      <LogIn className="w-3.5 h-3.5" />
                      {t('تسجيل الدخول', 'Sign In')}
                    </button>
                  </div>
                ) : (
                  user.prescriptions.length > 0 && (
                    <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
                      <label className="block font-bold">
                        {t('تعبئة من المقاسات المحفوظة في حسابك:', 'Apply a saved prescription:')}
                      </label>
                      <select
                        defaultValue=""
                        onChange={(e) => e.target.value && handleApplySavedRx(e.target.value)}
                        className="w-full min-h-[44px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] text-base"
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
                  /* Contact Lenses Form (SPH, CYL, AXIS, BC, DIA per eye + helper text under EACH field) */
                  <div className="grid sm:grid-cols-2 gap-3.5">
                    {[
                      {
                        key: 'right',
                        title: t('العين اليمنى (OD — Right Eye)', 'Right Eye (OD)'),
                        val: clRight,
                        setVal: setClRight,
                      },
                      {
                        key: 'left',
                        title: t('العين اليسرى (OS — Left Eye)', 'Left Eye (OS)'),
                        val: clLeft,
                        setVal: setClLeft,
                      },
                    ].map((eye) => {
                      const axisRequired = isNonZeroCyl(eye.val.cyl);
                      return (
                        <div
                          key={eye.key}
                          className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3"
                        >
                          <div className="font-extrabold text-sm text-[#11223E] dark:text-[#E2BD5B]">
                            {eye.title}
                          </div>

                          <div className="space-y-3">
                            <div>
                              <label className="block text-[11px] font-bold mb-1">
                                SPH ({t('قوة العدسة', 'Power')})
                              </label>
                              <select
                                value={eye.val.sph}
                                onChange={(e) => eye.setVal({ ...eye.val, sph: e.target.value })}
                                className="w-full min-h-[44px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-base"
                              >
                                {SPH_OPTIONS.map((o) => (
                                  <option key={o} value={o}>{o}</option>
                                ))}
                              </select>
                              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                                {t('قوة النظر: (-) لقصر النظر، (+) لطول النظر', 'Lens power: (-) nearsighted, (+) farsighted')}
                              </p>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold mb-1">
                                CYL ({t('الاستجماتيزم — اختياري', 'Astigmatism — Opt')})
                              </label>
                              <select
                                value={eye.val.cyl}
                                onChange={(e) => eye.setVal({ ...eye.val, cyl: e.target.value })}
                                className="w-full min-h-[44px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-base"
                              >
                                {CYL_OPTIONS.map((o) => (
                                  <option key={o} value={o}>{o}</option>
                                ))}
                              </select>
                              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                                {t('درجة انحراف القرنية؛ اتركه 0.00 للعدسات العادية', 'Astigmatism power; leave 0.00 if none')}
                              </p>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold mb-1">
                                AXIS {axisRequired ? '*' : t('(يتفعل إذا CYL ≠ 0)', '(Active if CYL ≠ 0)')}
                              </label>
                              <select
                                disabled={!axisRequired}
                                value={eye.val.axis}
                                onChange={(e) => eye.setVal({ ...eye.val, axis: e.target.value })}
                                className="w-full min-h-[44px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-base disabled:opacity-45"
                              >
                                {AXIS_OPTIONS.map((o) => (
                                  <option key={o} value={o}>{o}°</option>
                                ))}
                              </select>
                              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                                {t('زاوية الانحراف (0–180)، مطلوبة فقط عند وجود CYL', 'Axis angle (0–180), required only if CYL is not 0')}
                              </p>
                            </div>

                            <div className="grid grid-cols-2 gap-2.5">
                              <div>
                                <label className="block text-[11px] font-bold mb-1">BC</label>
                                <select
                                  value={eye.val.bc}
                                  onChange={(e) => eye.setVal({ ...eye.val, bc: e.target.value })}
                                  className="w-full min-h-[44px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-base"
                                >
                                  {BC_OPTIONS.map((o) => (
                                    <option key={o} value={o}>{o}</option>
                                  ))}
                                </select>
                                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                                  {t('انحناء قاعدة العدسة (غالباً 8.4–8.8)', 'Base curve (typically 8.4–8.8)')}
                                </p>
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold mb-1">DIA</label>
                                <select
                                  value={eye.val.dia}
                                  onChange={(e) => eye.setVal({ ...eye.val, dia: e.target.value })}
                                  className="w-full min-h-[44px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-base"
                                >
                                  {DIA_OPTIONS.map((o) => (
                                    <option key={o} value={o}>{o}</option>
                                  ))}
                                </select>
                                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                                  {t('قطر العدسة الكلي بالملم (غالباً 14.2)', 'Lens diameter in mm (typically 14.2)')}
                                </p>
                              </div>
                            </div>

                            <div>
                              <label className="block text-[11px] font-bold mb-1">
                                {t('عدد العلب لهذه العين', 'Boxes for this eye')}
                              </label>
                              <select
                                value={eye.val.boxes}
                                onChange={(e) =>
                                  eye.setVal({ ...eye.val, boxes: Number(e.target.value) })
                                }
                                className="w-full min-h-[44px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-base"
                              >
                                {Array.from({ length: 13 }, (_, n) => n).map((n) => (
                                  <option key={n} value={n}>{n}</option>
                                ))}
                              </select>
                              <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                                {t('اختر 0 إذا كنت تطلب للعين الأخرى فقط', 'Select 0 if ordering for the other eye only')}
                              </p>
                            </div>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                ) : (
                  /* Eyeglasses & Sunglasses Manual Rx Form (Dynamic based on visionType) */
                  <div className="space-y-4">
                    <div className="grid sm:grid-cols-2 gap-3.5">
                      {[
                        {
                          key: 'od',
                          title: t('العين اليمنى (OD)', 'Right Eye (OD)'),
                          val: rightEye,
                          setVal: setRightEye,
                        },
                        {
                          key: 'os',
                          title: t('العين اليسرى (OS)', 'Left Eye (OS)'),
                          val: leftEye,
                          setVal: setLeftEye,
                        },
                      ].map((eye) => {
                        const axisRequired = isNonZeroCyl(eye.val.cyl);
                        return (
                          <div
                            key={eye.key}
                            className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-3"
                          >
                            <div className="font-extrabold text-sm text-[#11223E] dark:text-[#E2BD5B]">
                              {eye.title}
                            </div>

                            <div className="space-y-3">
                              <div>
                                <label className="block text-[11px] font-bold mb-1">SPH</label>
                                <select
                                  value={eye.val.sph}
                                  onChange={(e) => eye.setVal({ ...eye.val, sph: e.target.value })}
                                  className="w-full min-h-[44px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-base"
                                >
                                  {SPH_OPTIONS.map((o) => (
                                    <option key={o} value={o}>{o}</option>
                                  ))}
                                </select>
                                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                                  {t(
                                    'قوة تصحيح النظر: السالب (-) لقصر النظر والموجب (+) لطول النظر',
                                    'Lens sphere power: (-) nearsighted, (+) farsighted'
                                  )}
                                </p>
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold mb-1">CYL</label>
                                <select
                                  value={eye.val.cyl}
                                  onChange={(e) => eye.setVal({ ...eye.val, cyl: e.target.value })}
                                  className="w-full min-h-[44px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-base"
                                >
                                  {CYL_OPTIONS.map((o) => (
                                    <option key={o} value={o}>{o}</option>
                                  ))}
                                </select>
                                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                                  {t(
                                    'درجة الاستجماتيزم (اللابؤرية)؛ اتركه 0.00 إن لم يكن لديك انحراف',
                                    'Astigmatism degree; leave 0.00 if none'
                                  )}
                                </p>
                              </div>

                              <div>
                                <label className="block text-[11px] font-bold mb-1">
                                  AXIS {axisRequired ? '*' : t('(يتفعل إذا CYL ≠ 0)', '(Active if CYL ≠ 0)')}
                                </label>
                                <select
                                  disabled={!axisRequired}
                                  value={eye.val.axis}
                                  onChange={(e) => eye.setVal({ ...eye.val, axis: e.target.value })}
                                  className="w-full min-h-[44px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-base disabled:opacity-45"
                                >
                                  {AXIS_OPTIONS.map((o) => (
                                    <option key={o} value={o}>{o}°</option>
                                  ))}
                                </select>
                                <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                                  {t(
                                    'زاوية اتجاه الاستجماتيزم (0–180°)، تُطلب فقط عندما لا يساوي CYL صفراً',
                                    'Axis orientation (0–180°), required only when CYL is not 0'
                                  )}
                                </p>
                              </div>

                              {/* ADD per eye for Bifocal and Progressive */}
                              {showAddField && (
                                <div>
                                  <label className="block text-[11px] font-bold mb-1">
                                    ADD ({t('إضافة القراءة', 'Reading Add')})
                                  </label>
                                  <select
                                    value={eye.val.add || '+1.50'}
                                    onChange={(e) => eye.setVal({ ...eye.val, add: e.target.value })}
                                    className="w-full min-h-[44px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-base"
                                  >
                                    {ADD_OPTIONS.map((o) => (
                                      <option key={o} value={o}>{o}</option>
                                    ))}
                                  </select>
                                  <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                                    {t(
                                      'درجة التكبير الإضافية للقراءة والتركيز القريب في العدسات ثنائية البؤرة والتدريجية',
                                      'Additional magnification power for reading in Bifocal & Progressive lenses'
                                    )}
                                  </p>
                                </div>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>

                    {/* PD Section (Progressive enforces per-eye Dual PD; others allow Single or Dual) */}
                    <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2.5">
                      <div className="flex flex-wrap items-center justify-between gap-2">
                        <span className="font-bold">
                          {isProgressive
                            ? t('المسافة بين الحدقتين لكل عين (PD per eye — مطلوب للعدسة التدريجية)', 'Per-Eye Pupillary Distance (PD mm — Progressive)')
                            : t('المسافة بين الحدقتين (PD - مم)', 'Pupillary Distance (PD mm)')}
                        </span>
                        {!isProgressive && (
                          <div className="flex items-center gap-1.5">
                            <button
                              type="button"
                              onClick={() => setPdMode('single')}
                              className={`min-h-[38px] px-3 rounded-lg text-[11px] font-bold border ${
                                pdMode === 'single'
                                  ? 'bg-[#11223E] text-white border-[#11223E]'
                                  : 'bg-white dark:bg-[#131C2E] border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {t('قيمة واحدة', 'Single PD')}
                            </button>
                            <button
                              type="button"
                              onClick={() => setPdMode('dual')}
                              className={`min-h-[38px] px-3 rounded-lg text-[11px] font-bold border ${
                                pdMode === 'dual'
                                  ? 'bg-[#11223E] text-white border-[#11223E]'
                                  : 'bg-white dark:bg-[#131C2E] border-slate-200 dark:border-slate-700'
                              }`}
                            >
                              {t('لكل عين (يمين/يسار)', 'Dual PD')}
                            </button>
                          </div>
                        )}
                      </div>

                      {effectivePdMode === 'single' ? (
                        <div>
                          <select
                            value={pd}
                            onChange={(e) => setPd(e.target.value)}
                            className="w-full min-h-[44px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-base"
                          >
                            {PD_SINGLE_OPTIONS.map((o) => (
                              <option key={o} value={o}>{o} mm</option>
                            ))}
                          </select>
                          <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                            {t(
                              'المسافة بالملم بين مركزي حدقتي العينين لتركيز البؤرة بدقة (غالباً 58–68 مم)',
                              'Distance in mm between pupil centers (usually 58–68 mm)'
                            )}
                          </p>
                        </div>
                      ) : (
                        <div className="grid sm:grid-cols-2 gap-3">
                          <div>
                            <label className="block text-[11px] font-bold mb-1">
                              PD {t('العين اليمنى (OD)', 'Right Eye (OD)')}
                            </label>
                            <select
                              value={pdRight}
                              onChange={(e) => setPdRight(e.target.value)}
                              className="w-full min-h-[44px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-base"
                            >
                              {PD_DUAL_OPTIONS.map((o) => (
                                <option key={o} value={o}>{o} mm</option>
                              ))}
                            </select>
                            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                              {t(
                                'المسافة من منتصف الأنف إلى حدقة العين اليمنى بالملم (غالباً 29–34 مم)',
                                'Half-PD from nose bridge to right pupil center (typically 29–34 mm)'
                              )}
                            </p>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold mb-1">
                              PD {t('العين اليسرى (OS)', 'Left Eye (OS)')}
                            </label>
                            <select
                              value={pdLeft}
                              onChange={(e) => setPdLeft(e.target.value)}
                              className="w-full min-h-[44px] px-2.5 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-base"
                            >
                              {PD_DUAL_OPTIONS.map((o) => (
                                <option key={o} value={o}>{o} mm</option>
                              ))}
                            </select>
                            <p className="mt-1 text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                              {t(
                                'المسافة من منتصف الأنف إلى حدقة العين اليسرى بالملم (غالباً 29–34 مم)',
                                'Half-PD from nose bridge to left pupil center (typically 29–34 mm)'
                              )}
                            </p>
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Fitting Height (Only for Progressive) */}
                    {isProgressive && (
                      <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-[#D9B24C]/50 space-y-2">
                        <label className="block font-bold text-[#11223E] dark:text-[#E2BD5B]">
                          {t('ارتفاع التركيب (Fitting Height — مم)', 'Fitting Height (mm)')}
                        </label>
                        <select
                          value={fittingHeight}
                          onChange={(e) => setFittingHeight(e.target.value)}
                          className="w-full min-h-[44px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-base"
                        >
                          {FITTING_HEIGHT_OPTIONS.map((o) => (
                            <option key={o} value={o}>{o} mm</option>
                          ))}
                        </select>
                        <p className="text-[11px] text-slate-500 dark:text-slate-400 leading-snug">
                          {t(
                            'المسافة العمودية من مركز الحدقة إلى الحافة السفلية الداخلية للإطار بالملم لضبط التدرج البؤري بسلاسة (غالباً 16–22 مم)',
                            'Vertical height from pupil center to lower inner frame rim (mm) to align progressive corridors (typically 16–22 mm)'
                          )}
                        </p>
                      </div>
                    )}
                  </div>
                )}

                {/* Quick "How to read my Rx" toggle */}
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                  <button
                    type="button"
                    onClick={() => setShowHowToRead((prev) => !prev)}
                    className="min-h-[38px] inline-flex items-center gap-1.5 font-extrabold text-[#B38B2D] dark:text-[#E2BD5B]"
                  >
                    <HelpCircle className="w-4 h-4" />
                    <span>{t('كيف أقرأ روشتتي الطبية؟', 'How to read my prescription?')}</span>
                    {showHowToRead ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                  </button>

                  {showHowToRead && (
                    <div className="p-3 rounded-lg bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-700 space-y-1.5 text-[11px] leading-relaxed">
                      <div className="font-bold text-[#11223E] dark:text-[#E2BD5B]">
                        {t('دليل سريع لقراءة كشف النظر:', 'Quick guide to reading your Rx:')}
                      </div>
                      <ul className="space-y-1 list-disc list-inside text-slate-600 dark:text-slate-300">
                        <li>{t('OD تعني العين اليمنى (Right)، وOS تعني العين اليسرى (Left).', 'OD = Right Eye, OS = Left Eye.')}</li>
                        <li>{t('(-) في SPH تعني قصر نظر (للبعد)، و(+) تعني طول نظر (للقرب).', '(-) SPH corrects nearsightedness; (+) corrects farsightedness.')}</li>
                        <li>{t('إذا كانت قيمة CYL تساوي 0.00، فلا يلزم تحديد زاوية AXIS.', 'When CYL is 0.00, AXIS is not needed.')}</li>
                        <li>{t('قيمة ADD وارتفاع التركيب يظهران للعدسات ثنائية البؤرة والتدريجية فقط.', 'ADD and Fitting Height appear for Bifocal/Progressive lenses.')}</li>
                      </ul>
                    </div>
                  )}
                </div>

                {/* Save Rx to Account Option */}
                {!isGuest && (
                  <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                    <label className="flex items-center gap-2 cursor-pointer font-bold">
                      <input
                        type="checkbox"
                        checked={saveToAccount}
                        onChange={(e) => setSaveToAccount(e.target.checked)}
                        className="w-4 h-4 accent-[#D9B24C]"
                      />
                      <span>{t('حفظ هذا المقاس في حسابي للطلبات القادمة', 'Save Rx to my account')}</span>
                    </label>
                    {saveToAccount && (
                      <input
                        type="text"
                        value={rxLabel}
                        onChange={(e) => setRxLabel(e.target.value)}
                        placeholder={t('اسم المقاس (مثلاً: نظارة القراءة 2026)', 'Rx Label')}
                        className="w-full min-h-[44px] px-3 rounded-lg border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-base"
                      />
                    )}
                  </div>
                )}
              </div>
            )}

            {/* Choice 2: Upload Rx Photo */}
            {choice === 'image' && (
              <div className="space-y-4">
                <div className="p-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-center space-y-3">
                  <p className="text-slate-600 dark:text-slate-300 font-semibold">
                    {t(
                      'التقط صورة واضحة للروشتة أو اخترها من المعرض (يتم ضغطها تلقائياً حتى 1200px)',
                      'Take a photo or choose from gallery (auto-compressed to max 1200px)'
                    )}
                  </p>

                  <div className="flex flex-wrap justify-center gap-2.5">
                    <label
                      style={{ backgroundColor: appearance.primaryColor }}
                      className="min-h-[44px] px-4 rounded-xl text-white font-bold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <Camera className="w-4 h-4" />
                      <span>{t('فتح الكاميرا', 'Take Photo')}</span>
                      <input
                        type="file"
                        accept="image/*"
                        capture="environment"
                        onChange={handleImagePick}
                        className="hidden"
                      />
                    </label>

                    <label
                      style={{ backgroundColor: appearance.secondaryColor, color: appearance.primaryColor }}
                      className="min-h-[44px] px-4 rounded-xl font-extrabold inline-flex items-center gap-1.5 cursor-pointer"
                    >
                      <ImagePlus className="w-4 h-4" />
                      <span>{t('اختيار من المعرض', 'From Gallery')}</span>
                      <input
                        type="file"
                        accept="image/*"
                        onChange={handleImagePick}
                        className="hidden"
                      />
                    </label>
                  </div>

                  {uploading && (
                    <div className="space-y-1.5 pt-2">
                      <div className="flex items-center justify-center gap-2 font-bold text-[#B38B2D]">
                        <Loader2 className="w-4 h-4 animate-spin" />
                        <span>{t(`جارٍ رفع الصورة... ${uploadProgress}%`, `Uploading... ${uploadProgress}%`)}</span>
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
                    <p className="text-rose-600 dark:text-rose-400 font-bold">{uploadError}</p>
                  )}

                  {imageUrl && (
                    <div className="pt-2 space-y-2">
                      <img
                        src={imageUrl}
                        alt={t('معاينة الروشتة', 'Prescription preview')}
                        className="max-h-56 mx-auto rounded-xl border border-slate-200 dark:border-slate-700 object-contain"
                      />
                      <button
                        type="button"
                        onClick={() => void handleDeleteUploadedImage()}
                        className="min-h-[40px] px-3 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-400 font-bold inline-flex items-center gap-1"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                        {t('حذف الصورة', 'Delete Photo')}
                      </button>
                    </div>
                  )}
                </div>
              </div>
            )}

            {/* Choice 3: Send Later via WhatsApp */}
            {choice === 'later' && (
              <div className="p-4 rounded-xl bg-emerald-50 dark:bg-emerald-950/25 border border-emerald-200 dark:border-emerald-900/50 space-y-2">
                <div className="flex items-center gap-2 font-extrabold text-emerald-800 dark:text-emerald-300">
                  <MessageCircle className="w-4 h-4" />
                  {t('إرسال المقاس عبر الواتساب بعد الطلب', 'Send Prescription via WhatsApp Later')}
                </div>
                <p className="text-slate-600 dark:text-slate-300 leading-relaxed">
                  {t(
                    'لا تقلق! سيتم حفظ هذا الاختيار مع طلبك، ويمكنك إرسال صورة الكشف أو مقاساتك لفريق البصريات عبر الواتساب فور إتمام الطلب.',
                    'Your choice will be noted on this item so you can share your Rx on WhatsApp right after checkout.'
                  )}
                </p>
              </div>
            )}
          </div>

          {/* Live Price Breakdown */}
          {!isContact && (
            <div className="p-3.5 rounded-xl bg-[#11223E]/5 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="font-extrabold text-[#11223E] dark:text-[#E2BD5B]">
                {t('ملخص تسعير العدسات المختارة:', 'Selected Lens Pricing Breakdown:')}
              </div>
              <div className="flex justify-between">
                <span>{t('نوع الرؤية:', 'Vision Type:')} {getVisionTypeLabel(pricing.visionType, lensOptions, locale)}</span>
                <span className="font-mono-num font-bold">
                  {pricing.visionTypePriceSdg > 0 ? `+${formatSdg(pricing.visionTypePriceSdg)}` : t('مجاني', 'Free')}
                </span>
              </div>
              {pricing.extraOptions.map((extId) => {
                const extPrice = pricing.extraOptionsPricesSdg[extId] || 0;
                return (
                  <div key={extId} className="flex justify-between text-slate-600 dark:text-slate-300">
                    <span>
                      {getExtraOptionLabel(extId, lensOptions, locale)}
                      {extId === 'mirror' ? ` (${getMirrorColorLabel(mirrorColor, locale)})` : ''}
                    </span>
                    <span className="font-mono-num font-bold">
                      {extPrice > 0 ? `+${formatSdg(extPrice)}` : t('مجاني', 'Free')}
                    </span>
                  </div>
                );
              })}
              <div className="flex justify-between pt-1.5 border-t border-slate-200 dark:border-slate-700 font-extrabold">
                <span>{t('سعر المنتج مع العدسات:', 'Unit Price with Lenses:')}</span>
                <span className="font-mono-num text-[#B38B2D] dark:text-[#E2BD5B]">
                  {formatSdg(unitTotalWithLens)}
                </span>
              </div>
            </div>
          )}

          {/* Optional Notes */}
          <div>
            <label className="block font-bold mb-1">
              {t('ملاحظات إضافية لفني البصريات (اختياري)', 'Additional Optician Notes (Optional)')}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t('مثلاً: عدسة مضغوطة رفيعة، أو استخدام للقيادة الليلية...', 'e.g., high-index thin lenses...')}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-base"
            />
          </div>

          {/* Medical Disclaimer */}
          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-400">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <span>
              {t(
                'تنبيه طبي: هذا المقاس يُستخدم لتجهيز عدساتك حسب وصفتك المعتمدة فقط، ولا يغني عن فحص العين الدوري لدى طبيب العيون أو أخصائي البصريات.',
                'Medical Disclaimer: Entered prescription data is used solely to prepare your eyewear per your optometrist prescription and does not replace a clinical eye exam.'
              )}
            </span>
          </div>

          {validationError && (
            <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-300 font-bold">
              {validationError}
            </div>
          )}
        </div>

        {/* Sticky Footer */}
        <div className="px-4 sm:px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131C2E] flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex items-center gap-2">
            {onRemove && (
              <button
                type="button"
                onClick={() => {
                  onRemove();
                  onClose();
                }}
                className="min-h-[44px] px-3 rounded-xl border border-rose-200 dark:border-rose-900 text-rose-700 dark:text-rose-400 font-bold text-xs inline-flex items-center gap-1"
              >
                <Trash2 className="w-3.5 h-3.5" />
                {t('حذف المقاس', 'Remove Rx')}
              </button>
            )}
          </div>

          <div className="flex items-center gap-2 ms-auto">
            <button
              type="button"
              onClick={onClose}
              className="min-h-[44px] px-4 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold"
            >
              {t('إلغاء', 'Cancel')}
            </button>
            <button
              type="button"
              disabled={uploading}
              onClick={handleConfirm}
              style={{ backgroundColor: appearance.secondaryColor, color: appearance.primaryColor }}
              className="min-h-[44px] px-5 rounded-xl text-xs font-extrabold inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4" />
              <span>
                {t('حفظ الاختيارات والمقاس', 'Save Lens & Rx')}
                {pricing.totalExtraSdg > 0 ? ` (+${formatSdg(pricing.totalExtraSdg)})` : ''}
              </span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
