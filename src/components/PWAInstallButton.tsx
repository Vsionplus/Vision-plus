import React, { useState } from 'react';
import { Download, Share, X } from 'lucide-react';
import { usePWAInstall } from '../hooks/usePWA';
import { useStore } from '../store/StoreContext';

interface PWAInstallButtonProps {
  variant?: 'profile' | 'footer';
}

export const PWAInstallButton: React.FC<PWAInstallButtonProps> = ({ variant = 'profile' }) => {
  const { isInstallable, isInstalled, isIOS, install } = usePWAInstall();
  const { t, appearance } = useStore();
  const [showIOSGuide, setShowIOSGuide] = useState(false);

  // Hide completely when already installed / running in standalone display mode
  if (isInstalled) return null;

  // Show only when browser install prompt is available or on iOS Safari
  if (!isInstallable && !isIOS) return null;

  const handleClick = () => {
    if (isInstallable) {
      void install();
    } else if (isIOS) {
      setShowIOSGuide(true);
    }
  };

  const buttonClasses =
    variant === 'footer'
      ? 'min-h-[38px] px-3.5 py-1.5 rounded-lg border border-[#D9B24C]/45 bg-[#D9B24C]/15 hover:bg-[#D9B24C] hover:text-[#11223E] text-[#E2BD5B] text-xs font-bold inline-flex items-center gap-1.5 transition-colors'
      : 'px-3.5 py-2 rounded-lg text-xs font-extrabold inline-flex items-center gap-1.5 shadow-xs transition-opacity hover:opacity-90';

  const buttonStyle =
    variant === 'profile'
      ? { backgroundColor: appearance.primaryColor, color: '#ffffff' }
      : undefined;

  return (
    <>
      <button
        type="button"
        onClick={handleClick}
        style={buttonStyle}
        className={buttonClasses}
      >
        <Download className="w-3.5 h-3.5 shrink-0" />
        <span>{t('ثبّت التطبيق', 'Install App')}</span>
      </button>

      {showIOSGuide && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs p-4 flex items-center justify-center">
          <div className="w-full max-w-sm rounded-2xl bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 p-5 text-start shadow-2xl space-y-3 text-[#11223E] dark:text-slate-100">
            <div className="flex items-center justify-between gap-2">
              <h3 className="text-base font-extrabold">
                {t('تثبيت Vision Plus على جهازك', 'Install Vision Plus')}
              </h3>
              <button
                type="button"
                onClick={() => setShowIOSGuide(false)}
                aria-label={t('إغلاق', 'Close')}
                className="p-1.5 rounded-lg hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
            <p className="text-xs text-slate-600 dark:text-slate-300 leading-relaxed">
              {t(
                'لتثبيت التطبيق على iPhone أو iPad:',
                'To install the app on iPhone or iPad:'
              )}
            </p>
            <ol className="text-xs text-slate-700 dark:text-slate-200 space-y-2 list-decimal list-inside leading-relaxed">
              <li className="flex items-center gap-1.5">
                <Share className="w-3.5 h-3.5 shrink-0 text-[#1565C0]" />
                <span>
                  {t(
                    '1. اضغط على زر المشاركة (Share) في شريط المتصفح Safari.',
                    '1. Tap the Share button in the Safari toolbar.'
                  )}
                </span>
              </li>
              <li>
                {t(
                  '2. اختر "إضافة إلى الشاشة الرئيسية" (Add to Home Screen).',
                  '2. Scroll down and tap "Add to Home Screen".'
                )}
              </li>
            </ol>
            <button
              type="button"
              onClick={() => setShowIOSGuide(false)}
              style={{ backgroundColor: appearance.primaryColor }}
              className="w-full py-2.5 rounded-xl text-white text-xs font-bold"
            >
              {t('فهمت', 'Got it')}
            </button>
          </div>
        </div>
      )}
    </>
  );
};
