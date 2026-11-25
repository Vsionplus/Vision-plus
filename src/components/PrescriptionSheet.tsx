import React, { useEffect, useMemo, useState } from 'react';
import {
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Eye,
  FileText,
  HelpCircle,
  ImagePlus,
  Loader2,
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

const DEFAULT_EYE: EyePrescription = { sph: '0.00', cyl: '0.00', axis: '0', add: '' };
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

  const [visionType, setVisionType] = useState<VisionType>('none');
  const [extraOptions, setExtraOptions] = useState<ExtraLensOptionId[]>([]);
  const [mirrorColor, setMirrorColor] = useState<MirrorColorId>('silver');

  const [choice, setChoice] = useState<'manual' | 'image' | 'later' | 'none'>('manual');

  const [rightEye, setRightEye] = useState<EyePrescription>({ ...DEFAULT_EYE });
  const [leftEye, setLeftEye] = useState<EyePrescription>({ ...DEFAULT_EYE });
  const [pdMode, setPdMode] = useState<'single' | 'dual'>('single');
  const [pd, setPd] = useState('63');
  const [pdRight, setPdRight] = useState('31.5');
  const [pdLeft, setPdLeft] = useState('31.5');
  const [fittingHeight, setFittingHeight] = useState('18');

  const [clRight, setClRight] = useState<ContactLensEyePrescription>(DEFAULT_CL_EYE);
  const [clLeft, setClLeft] = useState<ContactLensEyePrescription>(DEFAULT_CL_EYE);

  const [imageUrl, setImageUrl] = useState('');
  const [storagePath, setStoragePath] = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

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
          setPdMode(
            initVision === 'progressive' ? 'dual' : init.values?.pdMode || init.pdMode || 'single'
          );
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
      setVisionType(
        isContact
          ? 'none'
          : visibleVisionTypes[0]?.id
          ? (visibleVisionTypes[0].id as VisionType)
          : 'distance'
      );
      setExtraOptions([]);
      setMirrorColor('silver');
      setChoice('manual');
      setRightEye({ ...DEFAULT_EYE });
      setLeftEye({ ...DEFAULT_EYE });
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

  const handleCopyRightToLeft = () => {
    if (isContact) {
      setClLeft({ ...clRight });
    } else {
      setLeftEye({ ...rightEye });
    }
    showToast(t('تم نسخ مقاس العين اليمنى إلى اليسرى', 'Right eye copied to left eye'));
  };

  if (!open) return null;

  const isProgressive = !isContact && visionType === 'progressive';
  const isBifocal = !isContact && visionType === 'bifocal';
  const showAddRequired = isBifocal || isProgressive;
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
      setRightEye(found.rightEye || { ...DEFAULT_EYE });
      setLeftEye(found.leftEye || { ...DEFAULT_EYE });
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
      setChoice('image');
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
    extraOptions:
      isContact ? undefined : pricing.extraOptions.length > 0 ? pricing.extraOptions : undefined,
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
              resolvedFittingHeight ? `Fitting Height: ${resolvedFittingHeight} mm` : '',
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
      <div className="w-full h-full sm:h-auto sm:max-h-[92vh] sm:max-w-3xl bg-white dark:bg-[#131C2E] sm:rounded-3xl border-t sm:border border-slate-200 dark:border-slate-800 flex flex-col overflow-hidden shadow-2xl">
        {/* Sticky Header matching "أدخل مقاسك" aesthetic */}
        <div className="px-4 sm:px-6 py-3.5 border-b border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2 shrink-0 bg-white dark:bg-[#131C2E]">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-10 h-10 rounded-xl bg-[#11223E] text-[#D9B24C] flex items-center justify-center shrink-0">
              <Eye className="w-5 h-5" />
            </div>
            <div className="min-w-0">
              <h2 className="text-sm sm:text-base font-extrabold text-[#11223E] dark:text-white truncate">
                {isContact
                  ? t('مقاس العدسات اللاصقة (اختياري)', 'Contact Lens Prescription (Optional)')
                  : t('أدخل مقاسك وخيارات العدسات', 'Enter Prescription & Lens Options')}
              </h2>
              <p className="text-xs text-slate-500 dark:text-slate-400 truncate">
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
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs">
          {/* 1 & 2: Vision Type & Extra Lens Options */}
          {!isContact && (
            <div className="p-4 rounded-2xl bg-slate-50 dark:bg-slate-900/75 border border-slate-200/80 dark:border-slate-800 space-y-4">
              <div className="space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <span className="text-sm font-extrabold text-[#11223E] dark:text-white">
                    {t('1) نوع الرؤية (اختياري)', '1) Vision Type (Optional)')}
                  </span>
                  <button
                    type="button"
                    onClick={() => handleSelectVisionType('none')}
                    className={`min-h-[36px] px-3 rounded-xl border text-[11px] font-bold transition-colors ${
                      visionType === 'none'
                        ? 'border-[#11223E] bg-[#11223E] text-white dark:border-[#D9B24C] dark:bg-[#D9B24C] dark:text-[#11223E]'
                        : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] text-slate-600 dark:text-slate-300'
                    }`}
                  >
                    {t('بدون عدسات طبية (الإطار فقط)', 'Frame Only')}
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
                        className={`min-h-[48px] p-3 rounded-xl border text-start flex items-center justify-between gap-2 transition-colors ${
                          selected
                            ? 'border-[#D9B24C] bg-[#D9B24C]/15 font-extrabold text-[#11223E] dark:text-white'
                            : 'border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] hover:border-slate-300'
                        }`}
                      >
                        <span className="truncate">{locale === 'ar' ? opt.labelAr : opt.labelEn}</span>
                        <span className="font-mono-num text-[11px] font-bold text-[#B38B2D] dark:text-[#E2BD5B] shrink-0">
                          {opt.extraSdg === 0 ? t('مجاني', 'Free') : `+${formatSdg(opt.extraSdg)}`}
                        </span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {visibleExtraOptions.length > 0 && (
                <div className="space-y-2.5 pt-3 border-t border-slate-200 dark:border-slate-800">
                  <div className="text-sm font-extrabold text-[#11223E] dark:text-white flex items-center gap-1.5">
                    <Sparkles className="w-4 h-4 text-[#D9B24C]" />
                    <span>{t('2) خيارات إضافية للعدسة (يمكن دمجها)', '2) Extra Lens Options (Combinable)')}</span>
                  </div>

                  <div className="grid sm:grid-cols-2 gap-2">
                    {visibleExtraOptions.map((opt) => {
                      const extId = opt.id as ExtraLensOptionId;
                      const checked = extraOptions.includes(extId);
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => toggleExtraOption(extId)}
                          className={`min-h-[46px] p-3 rounded-xl border text-start flex items-center justify-between gap-2 transition-colors ${
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
                            {opt.extraSdg === 0 ? t('مجاني', 'Free') : `+${formatSdg(opt.extraSdg)}`}
                          </span>
                        </button>
                      );
                    })}
                  </div>

                  {extraOptions.includes('mirror') && (
                    <div className="p-3 rounded-xl bg-white dark:bg-[#131C2E] border border-[#D9B24C]/60 space-y-2">
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
                              className={`min-h-[42px] px-3 py-1.5 rounded-xl border flex items-center gap-2 font-bold ${
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
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Amber Checkbox: "لا أعرف مقاسي، تواصلوا معي" */}
          <label className="rounded-xl bg-amber-50/90 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-800/60 p-3.5 flex items-start gap-3 cursor-pointer">
            <input
              type="checkbox"
              checked={choice === 'later'}
              onChange={(e) => setChoice(e.target.checked ? 'later' : 'manual')}
              className="w-5 h-5 mt-0.5 rounded accent-[#11223E] shrink-0"
            />
            <div className="space-y-0.5">
              <div className="text-sm font-extrabold text-[#11223E] dark:text-amber-200">
                {t('لا أعرف مقاسي، تواصلوا معي', "I don't know my prescription, contact me")}
              </div>
              <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
                {t(
                  'سيقوم فريقنا أو أخصائي البصريات بالتواصل معك لتأكيد المقاس المناسب قبل التجهيز.',
                  'Our team or optician will contact you via WhatsApp or phone to confirm your Rx before preparation.'
                )}
              </p>
            </div>
          </label>

          {/* Method Switcher Tabs */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
            <button
              type="button"
              onClick={() => setChoice('manual')}
              className={`min-h-[46px] p-2.5 rounded-xl border text-start flex items-center gap-2 transition-colors ${
                choice === 'manual'
                  ? 'border-[#11223E] bg-[#11223E] text-white dark:border-[#D9B24C] dark:bg-[#D9B24C] dark:text-[#11223E] font-extrabold'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
              }`}
            >
              <FileText className="w-4 h-4 shrink-0" />
              <span>{t('إدخال يدوي', 'Manual Rx')}</span>
            </button>

            <button
              type="button"
              onClick={() => setChoice('image')}
              className={`min-h-[46px] p-2.5 rounded-xl border text-start flex items-center gap-2 transition-colors ${
                choice === 'image'
                  ? 'border-[#11223E] bg-[#11223E] text-white dark:border-[#D9B24C] dark:bg-[#D9B24C] dark:text-[#11223E] font-extrabold'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
              }`}
            >
              <Camera className="w-4 h-4 shrink-0" />
              <span>{t('صورة الروشتة', 'Upload Photo')}</span>
            </button>

            <button
              type="button"
              onClick={() => setChoice('later')}
              className={`min-h-[46px] p-2.5 rounded-xl border text-start flex items-center gap-2 transition-colors ${
                choice === 'later'
                  ? 'border-[#11223E] bg-[#11223E] text-white dark:border-[#D9B24C] dark:bg-[#D9B24C] dark:text-[#11223E] font-extrabold'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
              }`}
            >
              <MessageCircle className="w-4 h-4 shrink-0" />
              <span>{t('تواصلوا معي', 'WhatsApp Later')}</span>
            </button>

            <button
              type="button"
              onClick={() => setChoice('none')}
              className={`min-h-[46px] p-2.5 rounded-xl border text-start flex items-center gap-2 transition-colors ${
                choice === 'none'
                  ? 'border-[#11223E] bg-[#11223E] text-white dark:border-[#D9B24C] dark:bg-[#D9B24C] dark:text-[#11223E] font-extrabold'
                  : 'border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
              }`}
            >
              <SkipForward className="w-4 h-4 shrink-0" />
              <span>{t('تخطي المقاس', 'Skip Rx')}</span>
            </button>
          </div>

          {choice === 'none' && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 text-slate-600 dark:text-slate-300">
              {isContact
                ? t(
                    'يمكنك المتابعة بدون إدخال مقاس، وسيتواصل معك فريقنا عند الحاجة.',
                    'You can proceed without entering prescription values.'
                  )
                : t(
                    'تم تخطي إدخال أرقام الكشف؛ سيتم حفظ نوع الرؤية والخيارات الإضافية المختارة أعلاه فقط.',
                    'Prescription numbers skipped; selected vision type and extra lens options will be saved.'
                  )}
            </div>
          )}

          {/* Manual Input Cards (matching OD/OS + Copy button + PD segmented toggle) */}
          {choice === 'manual' && (
            <div className="space-y-4">
              {isGuest ? (
                <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 font-semibold text-slate-600 dark:text-slate-300">
                  {t('المقاسات المحفوظة متاحة للحسابات المسجلة فقط — يمكنك إدخال مقاسك الآن يدوياً.', 'Saved prescriptions are for registered accounts — enter your Rx below.')}
                </div>
              ) : (
                user.prescriptions.length > 0 && (
                  <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
                    <label className="block font-bold">
                      {t('تعبئة من المقاسات المحفوظة:', 'Apply saved prescription:')}
                    </label>
                    <select
                      defaultValue=""
                      onChange={(e) => e.target.value && handleApplySavedRx(e.target.value)}
                      className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] text-sm"
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
                <div className="space-y-3">
                  {[
                    {
                      key: 'right',
                      title: t('العين اليمنى (OD)', 'Right Eye (OD)'),
                      val: clRight,
                      setVal: setClRight,
                      showCopy: false,
                    },
                    {
                      key: 'left',
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
                        className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/75 border border-slate-200/80 dark:border-slate-800 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-extrabold text-sm text-[#11223E] dark:text-white">
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
                            <label className="block text-[11px] font-bold mb-1">
                              SPH ({t('القوة', 'Power')})
                            </label>
                            <select
                              value={eye.val.sph}
                              onChange={(e) => eye.setVal({ ...eye.val, sph: e.target.value })}
                              className="w-full min-h-[44px] px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-sm"
                            >
                              {SPH_OPTIONS.map((o) => (
                                <option key={o} value={o}>{o}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold mb-1">
                              CYL ({t('الانحراف', 'Cyl')})
                            </label>
                            <select
                              value={eye.val.cyl}
                              onChange={(e) => eye.setVal({ ...eye.val, cyl: e.target.value })}
                              className="w-full min-h-[44px] px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-sm"
                            >
                              {CYL_OPTIONS.map((o) => (
                                <option key={o} value={o}>{o}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold mb-1">
                              AXIS ({t('المحور', 'Axis')})
                            </label>
                            <select
                              disabled={!axisRequired}
                              value={eye.val.axis}
                              onChange={(e) => eye.setVal({ ...eye.val, axis: e.target.value })}
                              className="w-full min-h-[44px] px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-sm disabled:opacity-45"
                            >
                              {AXIS_OPTIONS.map((o) => (
                                <option key={o} value={o}>{o}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div className="grid grid-cols-3 gap-2">
                          <div>
                            <label className="block text-[11px] font-bold mb-1">BC</label>
                            <select
                              value={eye.val.bc}
                              onChange={(e) => eye.setVal({ ...eye.val, bc: e.target.value })}
                              className="w-full min-h-[44px] px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-sm"
                            >
                              {BC_OPTIONS.map((o) => (
                                <option key={o} value={o}>{o}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold mb-1">DIA</label>
                            <select
                              value={eye.val.dia}
                              onChange={(e) => eye.setVal({ ...eye.val, dia: e.target.value })}
                              className="w-full min-h-[44px] px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-sm"
                            >
                              {DIA_OPTIONS.map((o) => (
                                <option key={o} value={o}>{o}</option>
                              ))}
                            </select>
                          </div>
                          <div>
                            <label className="block text-[11px] font-bold mb-1">
                              {t('عدد العلب', 'Boxes')}
                            </label>
                            <select
                              value={eye.val.boxes}
                              onChange={(e) =>
                                eye.setVal({ ...eye.val, boxes: Number(e.target.value) })
                              }
                              className="w-full min-h-[44px] px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-sm"
                            >
                              {Array.from({ length: 13 }, (_, n) => n).map((n) => (
                                <option key={n} value={n}>{n}</option>
                              ))}
                            </select>
                          </div>
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="space-y-3">
                  {[
                    {
                      key: 'od',
                      title: t('العين اليمنى (OD)', 'Right Eye (OD)'),
                      val: rightEye,
                      setVal: setRightEye,
                      showCopy: false,
                    },
                    {
                      key: 'os',
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
                        className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/75 border border-slate-200/80 dark:border-slate-800 space-y-3"
                      >
                        <div className="flex items-center justify-between gap-2">
                          <span className="font-extrabold text-sm text-[#11223E] dark:text-white">
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
                            <label className="block text-[11px] font-bold mb-1">
                              SPH ({t('القوة', 'Power')})
                            </label>
                            <select
                              value={eye.val.sph}
                              onChange={(e) => eye.setVal({ ...eye.val, sph: e.target.value })}
                              className="w-full min-h-[44px] px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-sm"
                            >
                              {SPH_OPTIONS.map((o) => (
                                <option key={o} value={o}>{o}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold mb-1">
                              CYL ({t('الانحراف', 'Cyl')})
                            </label>
                            <select
                              value={eye.val.cyl}
                              onChange={(e) => eye.setVal({ ...eye.val, cyl: e.target.value })}
                              className="w-full min-h-[44px] px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-sm"
                            >
                              {CYL_OPTIONS.map((o) => (
                                <option key={o} value={o}>{o}</option>
                              ))}
                            </select>
                          </div>

                          <div>
                            <label className="block text-[11px] font-bold mb-1">
                              AXIS ({t('المحور', 'Axis')})
                            </label>
                            <select
                              disabled={!axisRequired}
                              value={eye.val.axis}
                              onChange={(e) => eye.setVal({ ...eye.val, axis: e.target.value })}
                              className="w-full min-h-[44px] px-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-sm disabled:opacity-45"
                            >
                              {AXIS_OPTIONS.map((o) => (
                                <option key={o} value={o}>{o}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold mb-1">
                            {showAddRequired
                              ? t('ADD (إضافة القراءة)', 'ADD (Reading Add)')
                              : t('ADD (اختياري)', 'ADD (Optional)')}
                          </label>
                          <select
                            value={eye.val.add || (showAddRequired ? '+1.50' : '')}
                            onChange={(e) => eye.setVal({ ...eye.val, add: e.target.value })}
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
                      </div>
                    );
                  })}

                  {/* PD Card with Segmented Control */}
                  <div className="p-4 rounded-xl bg-slate-50 dark:bg-slate-900/75 border border-slate-200/80 dark:border-slate-800 space-y-3">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <span className="text-sm font-extrabold text-[#11223E] dark:text-white">
                        {isProgressive
                          ? t('المسافة الحدقية لكل عين (PD — للعدسة التدريجية)', 'Per-Eye PD (Progressive)')
                          : t('المسافة الحدقية (PD)', 'Pupillary Distance (PD)')}
                      </span>
                      {!isProgressive && (
                        <div className="bg-white dark:bg-[#131C2E] p-1 rounded-xl border border-slate-200 dark:border-slate-700 inline-flex items-center gap-1">
                          <button
                            type="button"
                            onClick={() => setPdMode('single')}
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
                            onClick={() => setPdMode('dual')}
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
                        onChange={(e) => setPd(e.target.value)}
                        className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-sm"
                      >
                        {PD_SINGLE_OPTIONS.map((o) => (
                          <option key={o} value={o}>{o}</option>
                        ))}
                      </select>
                    ) : (
                      <div className="grid grid-cols-2 gap-2.5">
                        <div>
                          <label className="block text-[11px] font-bold mb-1">
                            PD {t('العين اليمنى (OD)', 'Right (OD)')}
                          </label>
                          <select
                            value={pdRight}
                            onChange={(e) => setPdRight(e.target.value)}
                            className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-sm"
                          >
                            {PD_DUAL_OPTIONS.map((o) => (
                              <option key={o} value={o}>{o} mm</option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-[11px] font-bold mb-1">
                            PD {t('العين اليسرى (OS)', 'Left (OS)')}
                          </label>
                          <select
                            value={pdLeft}
                            onChange={(e) => setPdLeft(e.target.value)}
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
                          onChange={(e) => setFittingHeight(e.target.value)}
                          className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-sm"
                        >
                          {FITTING_HEIGHT_OPTIONS.map((o) => (
                            <option key={o} value={o}>{o} mm</option>
                          ))}
                        </select>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Quick guide + Save Rx */}
              <div className="p-3 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-2">
                <button
                  type="button"
                  onClick={() => setShowHowToRead((prev) => !prev)}
                  className="min-h-[36px] inline-flex items-center gap-1.5 font-extrabold text-[#B38B2D] dark:text-[#E2BD5B]"
                >
                  <HelpCircle className="w-4 h-4" />
                  <span>{t('كيف أقرأ روشتتي الطبية؟', 'How to read my prescription?')}</span>
                  {showHowToRead ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
                </button>

                {showHowToRead && (
                  <div className="p-3 rounded-xl bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-700 space-y-1 text-[11px] leading-relaxed text-slate-600 dark:text-slate-300">
                    <div>• {t('OD تعني العين اليمنى، وOS تعني العين اليسرى.', 'OD = Right Eye, OS = Left Eye.')}</div>
                    <div>• {t('(-) في SPH تعني قصر نظر، و(+) تعني طول نظر.', '(-) SPH = nearsighted, (+) = farsighted.')}</div>
                    <div>• {t('إذا كانت قيمة CYL تساوي 0.00، فلا يلزم تحديد زاوية AXIS.', 'When CYL is 0.00, AXIS is disabled.')}</div>
                  </div>
                )}
              </div>

              {!isGuest && (
                <div className="p-3 rounded-xl border border-slate-200 dark:border-slate-800 space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer font-bold">
                    <input
                      type="checkbox"
                      checked={saveToAccount}
                      onChange={(e) => setSaveToAccount(e.target.checked)}
                      className="w-4 h-4 accent-[#11223E]"
                    />
                    <span>{t('حفظ هذا المقاس في حسابي للطلبات القادمة', 'Save Rx to my account')}</span>
                  </label>
                  {saveToAccount && (
                    <input
                      type="text"
                      value={rxLabel}
                      onChange={(e) => setRxLabel(e.target.value)}
                      placeholder={t('اسم المقاس (مثلاً: نظارة القراءة 2026)', 'Rx Label')}
                      className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
                    />
                  )}
                </div>
              )}
            </div>
          )}

          {/* Upload Rx Photo Section */}
          {choice === 'image' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {t('ارفع صورة وصفة الطبيب', 'Upload doctor prescription photo')}
                </span>
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              </div>

              <div className="p-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-center space-y-3">
                <p className="text-slate-600 dark:text-slate-300 font-semibold">
                  {t(
                    'التقط صورة واضحة للروشتة أو اخترها من المعرض (تُضغط تلقائياً حتى 1200px)',
                    'Take a photo or choose from gallery (auto-compressed up to 1200px)'
                  )}
                </p>

                <div className="flex flex-wrap justify-center gap-2.5">
                  <label className="min-h-[46px] px-4 rounded-xl bg-[#11223E] text-white font-bold inline-flex items-center gap-1.5 cursor-pointer">
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

                  <label className="min-h-[46px] px-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-600 bg-white dark:bg-[#131C2E] font-extrabold inline-flex items-center gap-1.5 cursor-pointer">
                    <ImagePlus className="w-4 h-4" />
                    <span>{t('رفع صورة المقاس / الوصفة', 'From Gallery')}</span>
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

          {/* Price Breakdown */}
          {!isContact && (
            <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900 border border-slate-200 dark:border-slate-800 space-y-1.5">
              <div className="font-extrabold text-[#11223E] dark:text-[#E2BD5B]">
                {t('ملخص تسعير العدسات المختارة:', 'Selected Lens Pricing Breakdown:')}
              </div>
              <div className="flex justify-between">
                <span>
                  {t('نوع الرؤية:', 'Vision Type:')}{' '}
                  {getVisionTypeLabel(pricing.visionType, lensOptions, locale)}
                </span>
                <span className="font-mono-num font-bold">
                  {pricing.visionTypePriceSdg > 0
                    ? `+${formatSdg(pricing.visionTypePriceSdg)}`
                    : t('مجاني', 'Free')}
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

          {/* Notes */}
          <div>
            <label className="block font-bold mb-1">
              {t('ملاحظات إضافية لفني البصريات (اختياري)', 'Additional Optician Notes (Optional)')}
            </label>
            <textarea
              rows={2}
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder={t(
                'مثلاً: عدسة مضغوطة رفيعة، أو استخدام للقيادة الليلية...',
                'e.g., high-index thin lenses...'
              )}
              className="w-full px-3 py-2 rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-sm"
            />
          </div>

          <div className="p-3 rounded-xl bg-slate-100 dark:bg-slate-900/80 border border-slate-200 dark:border-slate-800 flex items-start gap-2 text-[11px] text-slate-600 dark:text-slate-400">
            <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600" />
            <span>
              {t(
                'تنبيه طبي: هذا المقاس يُستخدم لتجهيز عدساتك حسب وصفتك المعتمدة فقط، ولا يغني عن فحص العين الدوري.',
                'Medical Disclaimer: Prescription data is used solely to prepare your lenses and does not replace regular eye exams.'
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
        <div className="px-4 sm:px-6 py-3.5 border-t border-slate-200 dark:border-slate-800 bg-white dark:bg-[#131C2E] pb-[calc(14px+env(safe-area-inset-bottom))] flex flex-wrap items-center justify-between gap-2 shrink-0">
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
              style={{ backgroundColor: appearance.primaryColor }}
              className="min-h-[46px] px-5 rounded-xl text-white dark:bg-[#D9B24C] dark:text-[#11223E] text-xs font-extrabold inline-flex items-center gap-1.5 disabled:opacity-50"
            >
              <Check className="w-4 h-4 text-[#D9B24C] dark:text-[#11223E]" />
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
