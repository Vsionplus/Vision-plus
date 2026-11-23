import {
  Category,
  ContactLensEyePrescription,
  ExtraLensOptionId,
  EyePrescription,
  LensOptionConfig,
  LensOptionType,
  Locale,
  MirrorColorId,
  PrescriptionData,
  Product,
  VisionType,
} from '../types';

export function formatDiopter(val: number): string {
  if (Math.abs(val) < 0.001) return '0.00';
  const fixed = val.toFixed(2);
  return val > 0 ? `+${fixed}` : fixed;
}

export const SPH_OPTIONS: string[] = (() => {
  const list: string[] = [];
  for (let v = -20; v <= 20.001; v += 0.25) {
    list.push(formatDiopter(Math.round(v * 100) / 100));
  }
  return list;
})();

export const CYL_OPTIONS: string[] = (() => {
  const list: string[] = [];
  for (let v = -6; v <= 6.001; v += 0.25) {
    list.push(formatDiopter(Math.round(v * 100) / 100));
  }
  return list;
})();

export const AXIS_OPTIONS: string[] = Array.from({ length: 181 }, (_, i) => String(i));

export const ADD_OPTIONS: string[] = (() => {
  const list: string[] = [];
  for (let v = 0.75; v <= 3.501; v += 0.25) {
    list.push(formatDiopter(Math.round(v * 100) / 100));
  }
  return list;
})();

export const PD_SINGLE_OPTIONS: string[] = (() => {
  const list: string[] = [];
  for (let v = 50; v <= 80.001; v += 0.5) {
    list.push(Number.isInteger(v) ? String(v) : v.toFixed(1));
  }
  return list;
})();

export const PD_DUAL_OPTIONS: string[] = (() => {
  const list: string[] = [];
  for (let v = 25; v <= 40.001; v += 0.5) {
    list.push(Number.isInteger(v) ? String(v) : v.toFixed(1));
  }
  return list;
})();

export const FITTING_HEIGHT_OPTIONS: string[] = Array.from({ length: 21 }, (_, i) => String(14 + i));

export const BC_OPTIONS: string[] = ['8.2', '8.3', '8.4', '8.5', '8.6', '8.7', '8.8', '8.9', '9.0'];
export const DIA_OPTIONS: string[] = ['13.8', '14.0', '14.2', '14.3', '14.4', '14.5'];

export const VISION_TYPE_IDS: VisionType[] = ['distance', 'near', 'bifocal', 'progressive'];
export const EXTRA_OPTION_IDS: ExtraLensOptionId[] = [
  'photochromic',
  'mirror',
  'blue_cut',
  'uv_protection',
  'anti_glare',
];

export const MIRROR_COLOR_OPTIONS: {
  id: MirrorColorId;
  labelAr: string;
  labelEn: string;
  swatchHex: string;
}[] = [
  { id: 'silver', labelAr: 'فضي', labelEn: 'Silver', swatchHex: '#C0C7D1' },
  { id: 'blue', labelAr: 'أزرق', labelEn: 'Blue', swatchHex: '#2563EB' },
  { id: 'gold', labelAr: 'ذهبي', labelEn: 'Gold', swatchHex: '#D9B24C' },
  { id: 'green', labelAr: 'أخضر', labelEn: 'Green', swatchHex: '#10B981' },
];

export function isContactLensProduct(product?: Product | null, categories?: Category[]): boolean {
  if (!product) return false;
  if (product.categoryId === 'contact_lenses' || Boolean(product.contactLensSpecs)) return true;
  const cat = categories?.find((c) => c.id === product.categoryId);
  if (!cat) return false;
  const en = cat.nameEn.toLowerCase();
  return en.includes('contact lens') && !en.includes('solution');
}

export function isPrescriptionEligibleProduct(
  product?: Product | null,
  categories?: Category[]
): boolean {
  if (!product) return false;
  if (product.requiresPrescriptionOption || product.contactLensSpecs) return true;
  const eligibleIds = new Set(['reading_glasses', 'frames', 'sunglasses', 'contact_lenses']);
  if (eligibleIds.has(product.categoryId)) return true;
  const cat = categories?.find((c) => c.id === product.categoryId);
  if (!cat) return false;
  const en = cat.nameEn.toLowerCase();
  const ar = cat.nameAr;
  if (en.includes('solution') || ar.includes('محاليل') || ar.includes('محلول')) return false;
  return (
    en.includes('reading') ||
    en.includes('frame') ||
    en.includes('sunglass') ||
    en.includes('contact lens') ||
    ar.includes('قراءة') ||
    ar.includes('فريم') ||
    ar.includes('إطار') ||
    ar.includes('شمسي') ||
    ar.includes('عدسات لاصقة')
  );
}

export function resolveVisionType(rx?: PrescriptionData | null): VisionType {
  if (!rx) return 'none';
  if (rx.visionType && rx.visionType !== 'none') return rx.visionType;
  if (rx.lensOption === 'distance' || rx.lensOption === 'single_vision') return 'distance';
  if (rx.lensOption === 'near') return 'near';
  if (rx.lensOption === 'bifocal') return 'bifocal';
  if (rx.lensOption === 'progressive') return 'progressive';
  return 'none';
}

export function resolveExtraOptions(rx?: PrescriptionData | null): ExtraLensOptionId[] {
  if (!rx) return [];
  if (Array.isArray(rx.extraOptions) && rx.extraOptions.length > 0) {
    return rx.extraOptions;
  }
  if (rx.lensOption === 'photochromic') return ['photochromic'];
  if (rx.lensOption === 'mirror') return ['mirror'];
  if (rx.lensOption === 'blue_cut' || rx.lensOption === 'blue_light') return ['blue_cut'];
  if (rx.lensOption === 'uv_protection') return ['uv_protection'];
  if (rx.lensOption === 'anti_glare') return ['anti_glare'];
  return [];
}

export function hasCustomLensOrRx(rx?: PrescriptionData | null): boolean {
  if (!rx) return false;
  if (rx.type !== 'none') return true;
  if (resolveVisionType(rx) !== 'none') return true;
  if (resolveExtraOptions(rx).length > 0) return true;
  if (rx.lensOption && rx.lensOption !== 'none') return true;
  if ((rx.lensExtraPriceSdg || 0) > 0) return true;
  return false;
}

export function getMirrorColorLabel(color: MirrorColorId | undefined, locale: Locale): string {
  const found = MIRROR_COLOR_OPTIONS.find((c) => c.id === color);
  if (!found) return color || '';
  return locale === 'ar' ? found.labelAr : found.labelEn;
}

export function getVisionTypeLabel(
  visionType: VisionType | undefined,
  lensOptions: LensOptionConfig[],
  locale: Locale
): string {
  if (!visionType || visionType === 'none') {
    return locale === 'ar' ? 'بدون عدسات طبية (الإطار فقط)' : 'Frame Only (No Lenses)';
  }
  const found = lensOptions.find((o) => o.id === visionType);
  if (found) return locale === 'ar' ? found.labelAr : found.labelEn;
  const fallback: Record<VisionType, { ar: string; en: string }> = {
    none: { ar: 'بدون عدسات طبية', en: 'Frame Only' },
    distance: { ar: 'نظر بعيد', en: 'Distance Vision' },
    near: { ar: 'نظر قريب', en: 'Near / Reading Vision' },
    bifocal: { ar: 'ثنائية البؤرة (Bifocal)', en: 'Bifocal (Lined)' },
    progressive: { ar: 'تدريجية (Progressive)', en: 'Progressive' },
  };
  return fallback[visionType]?.[locale] || visionType;
}

export function getExtraOptionLabel(
  optionId: ExtraLensOptionId,
  lensOptions: LensOptionConfig[],
  locale: Locale
): string {
  const found = lensOptions.find((o) => o.id === optionId);
  if (found) return locale === 'ar' ? found.labelAr : found.labelEn;
  const fallback: Record<ExtraLensOptionId, { ar: string; en: string }> = {
    photochromic: { ar: 'فوتوكروميك: يتحول لشمسية تلقائياً', en: 'Photochromic (Auto-Tint)' },
    mirror: { ar: 'عدسة عاكسة', en: 'Mirror Lens' },
    blue_cut: { ar: 'قاطع الضوء الأزرق', en: 'Blue-Cut Filter' },
    uv_protection: { ar: 'حماية من الأشعة فوق البنفسجية', en: 'UV Protection' },
    anti_glare: { ar: 'مضاد للانعكاس', en: 'Anti-Glare' },
  };
  return fallback[optionId]?.[locale] || optionId;
}

export function getLensOptionLabel(
  lensOption: LensOptionType | undefined,
  lensOptions: LensOptionConfig[],
  locale: Locale
): string {
  if (!lensOption || lensOption === 'none') {
    return locale === 'ar' ? 'بدون عدسات إضافية' : 'No extra lens option';
  }
  if (lensOption === 'single_vision') {
    return getVisionTypeLabel('distance', lensOptions, locale);
  }
  if (lensOption === 'blue_light') {
    return getExtraOptionLabel('blue_cut', lensOptions, locale);
  }
  const found = lensOptions.find((o) => o.id === lensOption);
  if (found) return locale === 'ar' ? found.labelAr : found.labelEn;
  const fallback: Record<string, { ar: string; en: string }> = {
    none: { ar: 'بدون عدسات إضافية', en: 'Frame Only' },
    distance: { ar: 'نظر بعيد', en: 'Distance Vision' },
    near: { ar: 'نظر قريب', en: 'Near / Reading Vision' },
    bifocal: { ar: 'ثنائية البؤرة (Bifocal)', en: 'Bifocal' },
    progressive: { ar: 'تدريجية (Progressive)', en: 'Progressive' },
    photochromic: { ar: 'فوتوكروميك: يتحول لشمسية تلقائياً', en: 'Photochromic' },
    mirror: { ar: 'عدسة عاكسة', en: 'Mirror Lens' },
    blue_cut: { ar: 'قاطع الضوء الأزرق', en: 'Blue-Cut' },
    uv_protection: { ar: 'حماية من الأشعة فوق البنفسجية', en: 'UV Protection' },
    anti_glare: { ar: 'مضاد للانعكاس', en: 'Anti-Glare' },
  };
  return fallback[lensOption]?.[locale] || lensOption;
}

export interface LensPricingBreakdown {
  visionType: VisionType;
  visionTypePriceSdg: number;
  extraOptions: ExtraLensOptionId[];
  extraOptionsPricesSdg: Record<string, number>;
  extrasSubtotalSdg: number;
  totalExtraSdg: number;
}

export function calculateLensPricingBreakdown(
  visionType: VisionType,
  extraOptions: ExtraLensOptionId[],
  lensOptions: LensOptionConfig[]
): LensPricingBreakdown {
  const visionOpt =
    visionType !== 'none' ? lensOptions.find((o) => o.id === visionType && o.visible) : undefined;
  const visionTypePriceSdg = visionOpt ? Math.max(0, Number(visionOpt.extraSdg) || 0) : 0;

  const extraOptionsPricesSdg: Record<string, number> = {};
  let extrasSubtotalSdg = 0;

  for (const extId of extraOptions) {
    const extOpt = lensOptions.find((o) => o.id === extId && o.visible);
    const price = extOpt ? Math.max(0, Number(extOpt.extraSdg) || 0) : 0;
    extraOptionsPricesSdg[extId] = price;
    extrasSubtotalSdg += price;
  }

  return {
    visionType,
    visionTypePriceSdg,
    extraOptions,
    extraOptionsPricesSdg,
    extrasSubtotalSdg,
    totalExtraSdg: visionTypePriceSdg + extrasSubtotalSdg,
  };
}

export function formatLensSummaryLine(
  rx: PrescriptionData | undefined | null,
  lensOptions: LensOptionConfig[],
  locale: Locale
): string {
  if (!rx) return '';
  const parts: string[] = [];
  const vt = resolveVisionType(rx);
  if (vt !== 'none') {
    parts.push(getVisionTypeLabel(vt, lensOptions, locale));
  }
  const extras = resolveExtraOptions(rx);
  for (const ext of extras) {
    let label = getExtraOptionLabel(ext, lensOptions, locale);
    if (ext === 'mirror' && rx.mirrorColor) {
      label = `${label} (${getMirrorColorLabel(rx.mirrorColor, locale)})`;
    }
    parts.push(label);
  }
  return parts.join(' + ');
}

export function isNonZeroCyl(cyl?: string): boolean {
  if (!cyl) return false;
  const n = Number(cyl);
  return Number.isFinite(n) && Math.abs(n) > 0.001;
}

export function validateEyeglassesEye(
  eye: EyePrescription | undefined,
  eyeLabelAr: string,
  eyeLabelEn: string,
  locale: Locale
): string | null {
  if (!eye) return null;
  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  if (eye.sph) {
    const n = Number(eye.sph);
    if (!Number.isFinite(n) || n < -20 || n > 20) {
      return t(
        `${eyeLabelAr}: قيمة SPH يجب أن تكون بين -20.00 و +20.00`,
        `${eyeLabelEn}: SPH must be between -20.00 and +20.00`
      );
    }
  }
  if (eye.cyl) {
    const n = Number(eye.cyl);
    if (!Number.isFinite(n) || n < -6 || n > 6) {
      return t(
        `${eyeLabelAr}: قيمة CYL يجب أن تكون بين -6.00 و +6.00`,
        `${eyeLabelEn}: CYL must be between -6.00 and +6.00`
      );
    }
    if (isNonZeroCyl(eye.cyl)) {
      if (eye.axis === '' || eye.axis === undefined) {
        return t(
          `${eyeLabelAr}: قيمة المحور (AXIS) مطلوبة عندما تكون قيمة CYL غير صفرية`,
          `${eyeLabelEn}: AXIS is required when CYL is not 0`
        );
      }
      const ax = Number(eye.axis);
      if (!Number.isFinite(ax) || ax < 0 || ax > 180) {
        return t(
          `${eyeLabelAr}: قيمة AXIS يجب أن تكون بين 0 و 180`,
          `${eyeLabelEn}: AXIS must be between 0 and 180`
        );
      }
    }
  }
  if (eye.axis) {
    const ax = Number(eye.axis);
    if (!Number.isFinite(ax) || ax < 0 || ax > 180) {
      return t(
        `${eyeLabelAr}: قيمة AXIS يجب أن تكون بين 0 و 180`,
        `${eyeLabelEn}: AXIS must be between 0 and 180`
      );
    }
  }
  if (eye.add) {
    const addN = Number(eye.add);
    if (!Number.isFinite(addN) || addN < 0.75 || addN > 3.5) {
      return t(
        `${eyeLabelAr}: قيمة ADD يجب أن تكون بين +0.75 و +3.50`,
        `${eyeLabelEn}: ADD must be between +0.75 and +3.50`
      );
    }
  }
  return null;
}

export function validateContactEye(
  eye: ContactLensEyePrescription | undefined,
  eyeLabelAr: string,
  eyeLabelEn: string,
  locale: Locale
): string | null {
  if (!eye) return null;
  const err = validateEyeglassesEye(
    { sph: eye.sph, cyl: eye.cyl, axis: eye.axis },
    eyeLabelAr,
    eyeLabelEn,
    locale
  );
  if (err) return err;
  const t = (ar: string, en: string) => (locale === 'ar' ? ar : en);
  if (eye.bc) {
    const bcN = Number(eye.bc);
    if (!Number.isFinite(bcN) || bcN < 7.5 || bcN > 9.8) {
      return t(`${eyeLabelAr}: قيمة BC غير صالحة`, `${eyeLabelEn}: Invalid BC value`);
    }
  }
  if (eye.dia) {
    const diaN = Number(eye.dia);
    if (!Number.isFinite(diaN) || diaN < 12.5 || diaN > 15.5) {
      return t(`${eyeLabelAr}: قيمة DIA غير صالحة`, `${eyeLabelEn}: Invalid DIA value`);
    }
  }
  if (eye.boxes < 0 || eye.boxes > 24) {
    return t(`${eyeLabelAr}: عدد العلب غير صالح`, `${eyeLabelEn}: Invalid boxes count`);
  }
  return null;
}

export async function compressPrescriptionImage(file: File, maxWidth = 1200): Promise<Blob> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image file'));
    reader.onload = () => {
      const dataUrl = typeof reader.result === 'string' ? reader.result : '';
      const img = new Image();
      img.onerror = () => reject(new Error('Invalid image file'));
      img.onload = () => {
        let { width, height } = img;
        if (width > maxWidth) {
          height = Math.round((height * maxWidth) / width);
          width = maxWidth;
        }
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, width);
        canvas.height = Math.max(1, height);
        const ctx = canvas.getContext('2d');
        if (!ctx) {
          resolve(file);
          return;
        }
        ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        canvas.toBlob(
          (blob) => {
            if (blob) resolve(blob);
            else resolve(file);
          },
          'image/jpeg',
          0.84
        );
      };
      img.src = dataUrl;
    };
    reader.readAsDataURL(file);
  });
}
