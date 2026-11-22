import { Locale, OrderStatus } from '../types';

/**
 * Formats Sudanese Pound (SDG) values with thousands separators and NO decimals:
 * e.g., 12500 -> "12,500 ج.س"
 */
export function formatSdg(amount: number): string {
  const rounded = Math.round(amount || 0);
  const formatted = new Intl.NumberFormat('en-US', {
    maximumFractionDigits: 0,
    minimumFractionDigits: 0,
  }).format(rounded);
  return `${formatted} ج.س`;
}

/**
 * Validates and normalizes Sudan +249 phone numbers.
 */
export function normalizeSudanPhone(raw: string): string {
  const digits = raw.replace(/[^\d]/g, '');
  if (digits.startsWith('249') && digits.length === 12) {
    return `+${digits}`;
  }
  if (digits.startsWith('0') && digits.length === 10) {
    return `+249${digits.slice(1)}`;
  }
  if (digits.length === 9 && (digits.startsWith('9') || digits.startsWith('1'))) {
    return `+249${digits}`;
  }
  return raw.startsWith('+249') ? raw : `+249${digits}`;
}

export function isValidSudanPhone(raw: string): boolean {
  const normalized = normalizeSudanPhone(raw);
  return /^\+249[19]\d{8}$/.test(normalized);
}

export function formatShortDate(iso: string, locale: Locale): string {
  try {
    const d = new Date(iso);
    return new Intl.DateTimeFormat(locale === 'ar' ? 'ar-SD' : 'en-GB', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
    }).format(d);
  } catch {
    return iso.slice(0, 10);
  }
}

export function getOrderStatusLabel(status: OrderStatus, locale: Locale): string {
  const labels: Record<OrderStatus, { ar: string; en: string }> = {
    pending: { ar: 'قيد الانتظار', en: 'Pending' },
    awaiting_payment_verification: {
      ar: 'بانتظار تأكيد التحويل البنكي',
      en: 'Awaiting Payment Verification',
    },
    confirmed: { ar: 'تم التأكيد', en: 'Confirmed' },
    preparing: { ar: 'جاري تجهيز النظارة', en: 'Preparing' },
    shipped: { ar: 'تم الشحن', en: 'Shipped' },
    delivered: { ar: 'تم التسليم', en: 'Delivered' },
    cancelled: { ar: 'ملغي', en: 'Cancelled' },
  };
  return labels[status][locale];
}
