import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  Camera,
  Check,
  ChevronDown,
  ChevronUp,
  Copy,
  Download,
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
  CYL_OPTIONS,
  EXTRA_OPTION_IDS,
  FITTING_HEIGHT_OPTIONS,
  MIRROR_COLOR_OPTIONS,
  PD_DUAL_OPTIONS,
  PD_SINGLE_OPTIONS,
  SPH_OPTIONS,
  VISION_TYPE_IDS,
  calculateLensPricingBreakdown,
  getExtraOptionLabel,
  getMirrorColorLabel,
  getVisionTypeLabel,
  isContactLensProduct,
  isNonZeroCyl,
  isPdfPrescriptionUrl,
  resolveExtraOptions,
  resolveVisionType,
  validateContactEye,
  validateEyeglassesEye,
} from '../utils/prescription';
import { auth, deletePrescriptionImage, uploadPrescriptionDocument } from '../lib/firebase';
import { FieldValidationRule, useFormValidation } from '../hooks/useFormValidation';
import { FieldError, ValidationSummaryBanner } from './FormValidationUI';
import { VALIDATION_MESSAGES, pickMsg } from '../utils/validationMessages';

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
  add: '',
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
  const [fileName, setFileName] = useState('');
  const [fileType, setFileType] = useState<'image' | 'pdf' | undefined>(undefined);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadError, setUploadError] = useState<string | null>(null);

  const [notes, setNotes] = useState('');
  const [saveToAccount, setSaveToAccount] = useState(false);
  const [rxLabel, setRxLabel] = useState('');
  const [showHowToRead, setShowHowToRead] = useState(false);

  const sheetBodyRef = useRef<HTMLDivElement | null>(null);
  const cameraInputRef = useRef<HTMLInputElement | null>(null);
  const galleryInputRef = useRef<HTMLInputElement | null>(null);
  const rxValidation = useFormValidation({
    containerRef: sheetBodyRef,
    formId: 'prescription-sheet',
  });

  useEffect(() => {
    if (!open) return;
    rxValidation.reset();
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
          setClRight({
            sph: init.values.contactRight.sph || '-1.00',
            cyl: init.values.contactRight.cyl || '0.00',
            axis: init.values.contactRight.axis || '0',
            add: init.values.contactRight.add || '',
          });
          setClLeft({
            sph: init.values.contactLeft.sph || '-1.00',
            cyl: init.values.contactLeft.cyl || '0.00',
            axis: init.values.contactLeft.axis || '0',
            add: init.values.contactLeft.add || '',
          });
          setPdMode(init.values.pdMode || init.pdMode || 'single');
          setPd(init.values.pd || init.pd || '63');
          setPdRight(init.values.pdRight || init.pdRight || '31.5');
          setPdLeft(init.values.pdLeft || init.pdLeft || '31.5');
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
        setFileName('');
        setFileType(undefined);
      } else if (init.type === 'image') {
        setImageUrl(init.imageUrl || '');
        setStoragePath(init.storagePath || '');
        setFileName(init.fileName || '');
        setFileType(
          isPdfPrescriptionUrl(init.imageUrl, init.fileType) ? 'pdf' : init.fileType || 'image'
        );
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
        setFileName('');
        setFileType(undefined);
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
            }
          : { ...DEFAULT_CL_EYE }
      );
      setClLeft(
        product.contactLensSpecs
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

  const isProgressive = !isContact && visionType === 'progressive';
  const isBifocal = !isContact && visionType === 'bifocal';
  const showAddRequired = isBifocal || isProgressive;
  const effectivePdMode = isProgressive ? 'dual' : pdMode;

  const buildRxRules = useCallback((): FieldValidationRule[] => {
    const rules: FieldValidationRule[] = [];

    if (!isContact && extraOptions.includes('mirror')) {
      rules.push({
        field: 'mirrorColor',
        label: t('لون العدسة العاكسة', 'Mirror lens color'),
        error: !mirrorColor ? pickMsg(VALIDATION_MESSAGES.mirrorColorRequired, locale) : null,
      });
    }

    if (choice === 'manual') {
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
            label: t('مقاس العين اليمنى (OD)', 'Right Eye (OD)'),
            error: validateContactEye(normalizedClRight, 'العين اليمنى', 'Right Eye', locale),
          },
          {
            field: 'clLeft',
            label: t('مقاس العين اليسرى (OS)', 'Left Eye (OS)'),
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
            label: t('مقاس العين اليمنى (OD)', 'Right Eye (OD)'),
            error: validateEyeglassesEye(
              normalizedRightEye,
              'العين اليمنى (OD)',
              'Right Eye (OD)',
              locale
            ),
          },
          {
            field: 'osEye',
            label: t('مقاس العين اليسرى (OS)', 'Left Eye (OS)'),
            error: validateEyeglassesEye(
              normalizedLeftEye,
              'العين اليسرى (OS)',
              'Left Eye (OS)',
              locale
            ),
          }
        );
      }

      if (saveToAccount && !isGuest) {
        rules.push({
          field: 'rxLabel',
          label: t('اسم الوصفة الطبية', 'Prescription label'),
          error: !rxLabel.trim() ? pickMsg(VALIDATION_MESSAGES.rxLabelRequired, locale) : null,
        });
      }
    }

    if (choice === 'image') {
      rules.push({
        field: 'rxImage',
        label: t('صورة أو ملف PDF للوصفة الطبية', 'Prescription photo or PDF'),
        error: !imageUrl ? pickMsg(VALIDATION_MESSAGES.rxImageRequired, locale) : null,
      });
    }

    return rules;
  }, [
    isContact,
    extraOptions,
    mirrorColor,
    choice,
    clRight,
    clLeft,
    rightEye,
    leftEye,
    showAddRequired,
    saveToAccount,
    isGuest,
    rxLabel,
    imageUrl,
    locale,
    t,
  ]);

  useEffect(() => {
    if (open && rxValidation.submitted) {
      rxValidation.revalidate(buildRxRules());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, rxValidation.submitted, buildRxRules]);

  if (!open) return null;

  const pricing = isContact
    ? calculateLensPricingBreakdown('none', [], lensOptions)
    : calculateLensPricingBreakdown(visionType, extraOptions, lensOptions);

  const unitTotalWithLens = product.priceSdg + pricing.totalExtraSdg;

  const handleApplySavedRx = (id: string) => {
    const found = user.prescriptions.find((r) => r.id === id);
    if (!found) return;
    setChoice('manual');
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
      setChoice('image');
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
    if (!rxValidation.validateAll(buildRxRules())) {
      return;
    }

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
        const computedPd = effectivePdMode === 'single' ? pd : `${pdRight}/${pdLeft}`;

        if (saveToAccount && !isGuest) {
          savePrescription({
            label: rxLabel.trim() || t('عدسات لاصقة', 'Contact Lens Rx'),
            kind: 'contact_lenses',
            rightEye: normalizedClRight,
            leftEye: normalizedClLeft,
            pd: computedPd,
            pdMode: effectivePdMode,
            pdRight: effectivePdMode === 'dual' ? pdRight : undefined,
            pdLeft: effectivePdMode === 'dual' ? pdLeft : undefined,
            contactRight: normalizedClRight,
            contactLeft: normalizedClLeft,
            notes: notes.trim() || undefined,
          });
        }

        onSave({
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
      onSave({
        type: 'image',
        mode: 'image',
        imageUrl,
        storagePath,
        fileName: fileName || undefined,
        fileType: fileType || (isPdfPrescriptionUrl(imageUrl) ? 'pdf' : 'image'),
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
        <div ref={sheetBodyRef} className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-5 text-xs">
          <ValidationSummaryBanner
            errors={rxValidation.errors}
            onSelectField={rxValidation.focusField}
            mode="form"
          />
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
                    <div
                      {...rxValidation.getFieldWrapperProps('mirrorColor')}
                      className={rxValidation.getControlClasses(
                        'mirrorColor',
                        'p-3 rounded-xl bg-white dark:bg-[#131C2E] border border-[#D9B24C]/60 space-y-2',
                        'p-3 rounded-xl space-y-2'
                      )}
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
                              className={`min-h-[44px] px-3 py-1.5 rounded-xl border flex items-center gap-2 font-bold ${
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
                        id={rxValidation.getErrorId('mirrorColor')}
                        message={rxValidation.getError('mirrorColor')}
                      />
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
              <span>{t('صورة / PDF للروشتة', 'Upload Photo / PDF')}</span>
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
                    const hasEyeErr = rxValidation.hasError(eye.field);
                    return (
                      <div
                        key={eye.key}
                        {...rxValidation.getFieldWrapperProps(eye.field)}
                        className={rxValidation.getControlClasses(
                          eye.field,
                          'p-4 rounded-xl bg-slate-50 dark:bg-slate-900/75 border border-slate-200/80 dark:border-slate-800 space-y-3',
                          'p-4 rounded-xl space-y-3'
                        )}
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
                              aria-invalid={hasEyeErr && axisRequired ? true : undefined}
                              onChange={(e) => eye.setVal({ ...eye.val, axis: e.target.value })}
                              className={`w-full min-h-[44px] px-2 rounded-xl font-mono-num text-sm disabled:opacity-45 ${
                                hasEyeErr && axisRequired
                                  ? 'border-2 border-[#DC2626] bg-[#FEF2F2] dark:bg-rose-950/30'
                                  : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E]'
                              }`}
                            >
                              {AXIS_OPTIONS.map((o) => (
                                <option key={o} value={o}>{o}</option>
                              ))}
                            </select>
                          </div>
                        </div>

                        <div>
                          <label className="block text-[11px] font-bold mb-1">
                            {t('ADD (اختياري)', 'ADD (Optional)')}
                          </label>
                          <select
                            value={eye.val.add || ''}
                            onChange={(e) => eye.setVal({ ...eye.val, add: e.target.value })}
                            className="w-full min-h-[44px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E] font-mono-num text-sm"
                          >
                            <option value="">{t('غير محدد (+1.50 اختياري)', 'None (+1.50 optional)')}</option>
                            {ADD_OPTIONS.map((o) => (
                              <option key={o} value={o}>{o}</option>
                            ))}
                          </select>
                        </div>

                        <FieldError
                          id={rxValidation.getErrorId(eye.field)}
                          message={rxValidation.getError(eye.field)}
                        />
                      </div>
                    );
                  })}
                </div>
              ) : (
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
                    const hasEyeErr = rxValidation.hasError(eye.field);
                    return (
                      <div
                        key={eye.key}
                        {...rxValidation.getFieldWrapperProps(eye.field)}
                        className={rxValidation.getControlClasses(
                          eye.field,
                          'p-4 rounded-xl bg-slate-50 dark:bg-slate-900/75 border border-slate-200/80 dark:border-slate-800 space-y-3',
                          'p-4 rounded-xl space-y-3'
                        )}
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
                              aria-invalid={hasEyeErr && axisRequired ? true : undefined}
                              onChange={(e) => eye.setVal({ ...eye.val, axis: e.target.value })}
                              className={`w-full min-h-[44px] px-2 rounded-xl font-mono-num text-sm disabled:opacity-45 ${
                                hasEyeErr && axisRequired
                                  ? 'border-2 border-[#DC2626] bg-[#FEF2F2] dark:bg-rose-950/30'
                                  : 'border border-slate-200 dark:border-slate-700 bg-white dark:bg-[#131C2E]'
                              }`}
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

                        <FieldError
                          id={rxValidation.getErrorId(eye.field)}
                          message={rxValidation.getError(eye.field)}
                        />
                      </div>
                    );
                  })}
                </div>
              )}

              {/* PD Card with Segmented Control (for both Glasses & Contact Lenses) */}
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
                    <div {...rxValidation.getFieldWrapperProps('rxLabel')} className="space-y-1">
                      <input
                        type="text"
                        value={rxLabel}
                        onChange={(e) => setRxLabel(e.target.value)}
                        placeholder={t('اسم المقاس (مثلاً: نظارة القراءة 2026) *', 'Rx Label *')}
                        {...rxValidation.getInputA11yProps('rxLabel')}
                        className={`w-full min-h-[44px] px-3 rounded-xl text-sm ${rxValidation.getControlClasses(
                          'rxLabel',
                          'border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900'
                        )}`}
                      />
                      <FieldError
                        id={rxValidation.getErrorId('rxLabel')}
                        message={rxValidation.getError('rxLabel')}
                      />
                    </div>
                  )}
                </div>
              )}
            </div>
          )}

          {/* Upload Rx Photo / PDF Section */}
          {choice === 'image' && (
            <div className="space-y-3">
              <div className="flex items-center gap-3">
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
                <span className="text-xs font-semibold text-slate-500 dark:text-slate-400">
                  {t('ارفع صورة أو ملف PDF لوصفة الطبيب', 'Upload doctor prescription photo or PDF')}
                </span>
                <div className="h-px flex-1 bg-slate-200 dark:bg-slate-800" />
              </div>

              <div
                {...rxValidation.getFieldWrapperProps('rxImage')}
                className={rxValidation.getControlClasses(
                  'rxImage',
                  'p-4 rounded-xl border-2 border-dashed border-slate-300 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 text-center space-y-3',
                  'p-4 rounded-xl border-dashed text-center space-y-3'
                )}
              >
                <p className="text-slate-600 dark:text-slate-300 font-semibold">
                  {t(
                    'التقط صورة واضحة للروشتة أو اختر صورة أو ملف PDF من جهازك',
                    'Take a photo or choose an image or PDF file from your device'
                  )}
                </p>

                <input
                  ref={cameraInputRef}
                  type="file"
                  accept="image/*"
                  capture="environment"
                  onChange={handleImagePick}
                  className="hidden"
                />
                <input
                  ref={galleryInputRef}
                  type="file"
                  accept="image/*,application/pdf,.pdf"
                  onChange={handleImagePick}
                  className="hidden"
                />

                <div className="flex flex-wrap justify-center gap-2.5">
                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => cameraInputRef.current?.click()}
                    className="min-h-[46px] px-4 rounded-xl bg-[#11223E] text-white font-bold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <Camera className="w-4 h-4" />
                    <span>{t('فتح الكاميرا', 'Take Photo')}</span>
                  </button>

                  <button
                    type="button"
                    disabled={uploading}
                    onClick={() => galleryInputRef.current?.click()}
                    className="min-h-[46px] px-4 rounded-xl bg-[#D9B24C] hover:bg-[#c9a13c] text-[#11223E] border border-[#b38b2d] shadow-xs font-extrabold inline-flex items-center gap-1.5 cursor-pointer disabled:opacity-50"
                  >
                    <ImagePlus className="w-4 h-4" />
                    <span>{t('رفع صورة أو PDF للمقاس', 'Upload Photo / PDF')}</span>
                  </button>
                </div>

                <FieldError
                  id={rxValidation.getErrorId('rxImage')}
                  message={rxValidation.getError('rxImage')}
                  className="justify-center"
                />

                {uploading && (
                  <div className="space-y-1.5 pt-2">
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
                  <p className="text-rose-600 dark:text-rose-400 font-bold">{uploadError}</p>
                )}

                {imageUrl && (
                  <div className="pt-2 space-y-2.5">
                    {isPdfPrescriptionUrl(imageUrl, fileType) ? (
                      <div className="p-3 rounded-xl bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-700 flex flex-wrap items-center justify-between gap-2 text-start max-w-md mx-auto">
                        <div className="flex items-center gap-2.5 min-w-0">
                          <div className="w-10 h-10 rounded-lg bg-rose-50 dark:bg-rose-950/40 text-rose-600 flex items-center justify-center shrink-0">
                            <FileText className="w-5 h-5" />
                          </div>
                          <div className="min-w-0">
                            <div className="font-bold text-xs text-[#11223E] dark:text-white truncate">
                              {fileName || t('ملف الوصفة الطبية (PDF)', 'Prescription Document (PDF)')}
                            </div>
                            <div className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
                              {t('جاهز للإرفاق مع الطلب', 'Ready to attach')}
                            </div>
                          </div>
                        </div>
                        <a
                          href={imageUrl}
                          download={fileName || 'prescription.pdf'}
                          className="min-h-[36px] px-3 rounded-lg bg-slate-100 dark:bg-slate-800 text-xs font-bold inline-flex items-center gap-1"
                        >
                          <Download className="w-3.5 h-3.5" />
                          <span>{t('تحميل', 'Download')}</span>
                        </a>
                      </div>
                    ) : (
                      <img
                        src={imageUrl}
                        alt={t('معاينة الروشتة', 'Prescription preview')}
                        className="max-h-56 mx-auto rounded-xl border border-slate-200 dark:border-slate-700 object-contain"
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
