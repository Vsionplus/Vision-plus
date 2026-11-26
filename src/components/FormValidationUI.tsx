import React from 'react';
import { AlertCircle, AlertTriangle, ArrowDownLeft, ArrowDownRight } from 'lucide-react';
import { FieldErrorItem } from '../hooks/useFormValidation';
import { useStore } from '../store/StoreContext';
import { VALIDATION_MESSAGES } from '../utils/validationMessages';

interface FieldErrorProps {
  id: string;
  message?: string | null;
  className?: string;
}

export const FieldError: React.FC<FieldErrorProps> = ({ id, message, className = '' }) => {
  if (!message) return null;

  return (
    <div
      id={id}
      role="alert"
      aria-live="polite"
      className={`mt-1.5 flex items-start gap-1.5 text-[11px] sm:text-xs font-bold text-[#DC2626] dark:text-rose-400 leading-snug ${className}`}
    >
      <AlertCircle className="w-3.5 h-3.5 shrink-0 mt-0.5" aria-hidden="true" />
      <span>{message}</span>
    </div>
  );
};

interface ValidationSummaryBannerProps {
  errors: FieldErrorItem[];
  onSelectField: (field: string) => void;
  title?: string;
  mode?: 'checkout' | 'form';
  className?: string;
}

export const ValidationSummaryBanner: React.FC<ValidationSummaryBannerProps> = ({
  errors,
  onSelectField,
  title,
  mode = 'form',
  className = '',
}) => {
  const { locale } = useStore();

  if (errors.length === 0) return null;

  const heading =
    title ||
    (mode === 'checkout'
      ? VALIDATION_MESSAGES.bannerCheckoutTitle(errors.length, locale)
      : VALIDATION_MESSAGES.bannerFormTitle(errors.length, locale));

  const JumpIcon = locale === 'ar' ? ArrowDownLeft : ArrowDownRight;

  return (
    <div
      role="alert"
      aria-live="assertive"
      className={`rounded-2xl border-2 border-[#DC2626] dark:border-rose-500 bg-[#FEF2F2] dark:bg-rose-950/35 p-3.5 sm:p-4 space-y-2.5 text-xs text-[#991B1B] dark:text-rose-200 shadow-sm ${className}`}
    >
      <div className="flex items-start gap-2.5">
        <AlertTriangle
          className="w-5 h-5 text-[#DC2626] dark:text-rose-400 shrink-0 mt-0.5"
          aria-hidden="true"
        />
        <div className="min-w-0 flex-1">
          <div className="text-xs sm:text-sm font-extrabold text-[#991B1B] dark:text-rose-100 leading-snug">
            {heading}
          </div>
          <p className="text-[11px] text-[#B91C1C] dark:text-rose-300 mt-0.5 font-semibold">
            {VALIDATION_MESSAGES.tapToScrollHint(locale)}
          </p>
        </div>
      </div>

      <ul className="space-y-1.5" aria-label={heading}>
        {errors.map((err) => (
          <li key={err.field}>
            <button
              type="button"
              onClick={() => onSelectField(err.field)}
              className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-rose-200 dark:border-rose-800/80 bg-white/90 dark:bg-[#181B1E]/90 hover:bg-rose-100/80 dark:hover:bg-rose-900/40 text-start flex items-center justify-between gap-2 transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[#DC2626]"
            >
              <span className="flex items-start gap-2 min-w-0">
                <AlertCircle
                  className="w-4 h-4 text-[#DC2626] dark:text-rose-400 shrink-0 mt-0.5"
                  aria-hidden="true"
                />
                <span className="min-w-0 leading-snug">
                  <strong className="font-extrabold text-[#991B1B] dark:text-rose-200">
                    {err.label}:
                  </strong>{' '}
                  <span className="font-semibold text-[#B91C1C] dark:text-rose-300">
                    {err.message}
                  </span>
                </span>
              </span>
              <JumpIcon
                className="w-4 h-4 text-[#DC2626] dark:text-rose-400 shrink-0"
                aria-hidden="true"
              />
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};
