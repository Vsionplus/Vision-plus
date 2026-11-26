import React, { useCallback, useId, useMemo, useRef, useState } from 'react';

export interface FieldValidationRule {
  field: string;
  label: string;
  error: string | null | undefined | false;
}

export interface FieldErrorItem {
  field: string;
  label: string;
  message: string;
}

function prefersReducedMotion(): boolean {
  if (typeof window === 'undefined' || !window.matchMedia) return false;
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
}

function findScrollableAncestor(el: HTMLElement, stopAt?: HTMLElement | null): HTMLElement | null {
  let curr: HTMLElement | null = el.parentElement;
  while (curr && curr !== document.body && curr !== document.documentElement) {
    const style = window.getComputedStyle(curr);
    const overflowY = style.overflowY;
    const isScrollable =
      (overflowY === 'auto' || overflowY === 'scroll' || overflowY === 'overlay') &&
      curr.scrollHeight > curr.clientHeight + 2;
    if (isScrollable) return curr;
    if (stopAt && curr === stopAt) break;
    curr = curr.parentElement;
  }
  return null;
}

function findFocusableTarget(wrapper: HTMLElement): HTMLElement {
  const selector = [
    'input:not([type="hidden"]):not([disabled])',
    'select:not([disabled])',
    'textarea:not([disabled])',
    'button:not([disabled])',
    'a[href]',
    'label[for]',
    '[tabindex]:not([tabindex="-1"])',
  ].join(', ');

  if (wrapper.matches(selector)) return wrapper;
  const inner = wrapper.querySelector<HTMLElement>(selector);
  if (inner) return inner;
  if (!wrapper.hasAttribute('tabindex')) {
    wrapper.setAttribute('tabindex', '-1');
  }
  return wrapper;
}

export function scrollToAndFocusField(
  field: string,
  options?: {
    container?: HTMLElement | null;
    fieldEl?: HTMLElement | null;
  }
): void {
  if (typeof document === 'undefined') return;

  const escaped =
    typeof CSS !== 'undefined' && typeof CSS.escape === 'function'
      ? CSS.escape(field)
      : field.replace(/"/g, '\\"');

  const container = options?.container || null;
  const target =
    options?.fieldEl ||
    container?.querySelector<HTMLElement>(`[data-field="${escaped}"]`) ||
    document.querySelector<HTMLElement>(`[data-field="${escaped}"]`);

  if (!target) return;

  const behavior: ScrollBehavior = prefersReducedMotion() ? 'auto' : 'smooth';
  const scrollAncestor = findScrollableAncestor(target, container);

  if (scrollAncestor) {
    const targetRect = target.getBoundingClientRect();
    const containerRect = scrollAncestor.getBoundingClientRect();
    const relativeTop = targetRect.top - containerRect.top + scrollAncestor.scrollTop;
    const centeredTop =
      relativeTop - Math.max(16, (scrollAncestor.clientHeight - targetRect.height) / 2);
    const maxScroll = Math.max(0, scrollAncestor.scrollHeight - scrollAncestor.clientHeight);
    scrollAncestor.scrollTo({
      top: Math.max(0, Math.min(maxScroll, centeredTop)),
      behavior,
    });
  } else {
    const targetRect = target.getBoundingClientRect();
    const headerOffset = 128;
    const bottomNavOffset = 88;
    const usableHeight = Math.max(180, window.innerHeight - headerOffset - bottomNavOffset);
    const centeredOffset = Math.max(0, (usableHeight - targetRect.height) / 2);
    const targetY = window.scrollY + targetRect.top - headerOffset - centeredOffset;
    const maxY = Math.max(
      0,
      (document.documentElement.scrollHeight || document.body.scrollHeight) - window.innerHeight
    );

    if (typeof window.scrollTo === 'function') {
      window.scrollTo({
        top: Math.max(0, Math.min(maxY, targetY)),
        behavior,
      });
    } else {
      target.scrollIntoView({ behavior, block: 'center', inline: 'nearest' });
    }
  }

  const focusEl = findFocusableTarget(target);
  try {
    focusEl.focus({ preventScroll: true });
  } catch {
    focusEl.focus();
  }
}

export function collectValidationErrors(rules: FieldValidationRule[]): FieldErrorItem[] {
  const seen = new Set<string>();
  const collected: FieldErrorItem[] = [];
  for (const r of rules) {
    if (!r.error || seen.has(r.field)) continue;
    seen.add(r.field);
    collected.push({
      field: r.field,
      label: r.label,
      message: r.error,
    });
  }
  return collected;
}

export function validateAndScroll(
  rules: FieldValidationRule[],
  options?: {
    container?: HTMLElement | null;
    getFieldElement?: (field: string) => HTMLElement | null;
  }
): { isValid: boolean; errors: FieldErrorItem[] } {
  const errors = collectValidationErrors(rules);
  if (errors.length === 0) {
    return { isValid: true, errors: [] };
  }
  const first = errors[0];
  scrollToAndFocusField(first.field, {
    container: options?.container,
    fieldEl: options?.getFieldElement?.(first.field),
  });
  return { isValid: false, errors };
}

function areErrorsEqual(a: FieldErrorItem[], b: FieldErrorItem[]): boolean {
  if (a.length !== b.length) return false;
  for (let i = 0; i < a.length; i++) {
    if (
      a[i].field !== b[i].field ||
      a[i].label !== b[i].label ||
      a[i].message !== b[i].message
    ) {
      return false;
    }
  }
  return true;
}

export function useFormValidation(options?: {
  containerRef?: React.RefObject<HTMLElement | null>;
  formId?: string;
}) {
  const reactId = useId();
  const baseId = options?.formId || reactId.replace(/:/g, '');
  const internalContainerRef = useRef<HTMLDivElement | null>(null);
  const fieldRefs = useRef<Record<string, HTMLElement | null>>({});
  const shakeTimerRef = useRef<number | null>(null);

  const [errors, setErrors] = useState<FieldErrorItem[]>([]);
  const [submitted, setSubmitted] = useState(false);
  const [shakingField, setShakingField] = useState<string | null>(null);

  const errorMap = useMemo(() => {
    const map: Record<string, string> = {};
    for (const item of errors) {
      map[item.field] = item.message;
    }
    return map;
  }, [errors]);

  const triggerShake = useCallback((field: string) => {
    if (shakeTimerRef.current !== null) {
      window.clearTimeout(shakeTimerRef.current);
      shakeTimerRef.current = null;
    }
    setShakingField(null);
    window.requestAnimationFrame(() => {
      setShakingField(field);
      shakeTimerRef.current = window.setTimeout(() => {
        setShakingField(null);
        shakeTimerRef.current = null;
      }, 450);
    });
  }, []);

  const getActiveContainer = useCallback((): HTMLElement | null => {
    return options?.containerRef?.current ?? internalContainerRef.current ?? null;
  }, [options?.containerRef]);

  const focusField = useCallback(
    (field: string) => {
      scrollToAndFocusField(field, {
        container: getActiveContainer(),
        fieldEl: fieldRefs.current[field] || null,
      });
      triggerShake(field);
    },
    [getActiveContainer, triggerShake]
  );

  const validateAll = useCallback(
    (rules: FieldValidationRule[]): boolean => {
      setSubmitted(true);
      const nextErrors = collectValidationErrors(rules);
      setErrors(nextErrors);
      if (nextErrors.length > 0) {
        const firstField = nextErrors[0].field;
        window.requestAnimationFrame(() => {
          focusField(firstField);
        });
        return false;
      }
      setShakingField(null);
      return true;
    },
    [focusField]
  );

  const revalidate = useCallback((rules: FieldValidationRule[]) => {
    const nextErrors = collectValidationErrors(rules);
    setErrors((prev) => (areErrorsEqual(prev, nextErrors) ? prev : nextErrors));
  }, []);

  const clearField = useCallback((field: string) => {
    setErrors((prev) => {
      if (!prev.some((e) => e.field === field)) return prev;
      return prev.filter((e) => e.field !== field);
    });
  }, []);

  const reset = useCallback(() => {
    if (shakeTimerRef.current !== null) {
      window.clearTimeout(shakeTimerRef.current);
      shakeTimerRef.current = null;
    }
    setErrors([]);
    setSubmitted(false);
    setShakingField(null);
  }, []);

  const registerField = useCallback(
    (field: string) => (el: HTMLElement | null) => {
      fieldRefs.current[field] = el;
    },
    []
  );

  const getError = useCallback((field: string) => errorMap[field], [errorMap]);
  const hasError = useCallback((field: string) => Boolean(errorMap[field]), [errorMap]);
  const getErrorId = useCallback((field: string) => `vp-err-${baseId}-${field}`, [baseId]);
  const isShaking = useCallback((field: string) => shakingField === field, [shakingField]);

  const getFieldWrapperProps = useCallback(
    (field: string) => ({
      'data-field': field,
      ref: registerField(field),
    }),
    [registerField]
  );

  const getInputA11yProps = useCallback(
    (field: string) => {
      const invalid = Boolean(errorMap[field]);
      return {
        'aria-invalid': invalid ? (true as const) : undefined,
        'aria-describedby': invalid ? `vp-err-${baseId}-${field}` : undefined,
      };
    },
    [baseId, errorMap]
  );

  const getControlClasses = useCallback(
    (field: string, validClasses: string, extraInvalidClasses = '') => {
      if (!errorMap[field]) return validClasses;
      const shakeCls = shakingField === field ? 'vp-field-shake' : '';
      return `border-2 border-[#DC2626] dark:border-rose-500 bg-[#FEF2F2] dark:bg-rose-950/30 focus:outline-none focus:ring-2 focus:ring-red-500/40 ${shakeCls} ${extraInvalidClasses}`.trim();
    },
    [errorMap, shakingField]
  );

  return {
    containerRef: internalContainerRef,
    errors,
    errorMap,
    submitted,
    shakingField,
    validateAll,
    revalidate,
    clearField,
    reset,
    focusField,
    registerField,
    getError,
    hasError,
    getErrorId,
    isShaking,
    getFieldWrapperProps,
    getInputA11yProps,
    getControlClasses,
  };
}
