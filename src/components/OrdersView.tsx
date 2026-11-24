import React from 'react';
import { RotateCcw, XCircle, Package, Lock, LogIn } from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { OrderStatus } from '../types';
import { formatSdg, formatShortDate, getOrderStatusLabel } from '../utils/format';
import { formatLensSummaryLine, hasCustomLensOrRx } from '../utils/prescription';
import { ResilientImage } from './ResilientImage';

const TIMELINE_STEPS: OrderStatus[] = [
  'pending',
  'awaiting_payment_verification',
  'confirmed',
  'preparing',
  'shipped',
  'delivered',
];

export const OrdersView: React.FC = () => {
  const {
    locale,
    t,
    isGuest,
    openAuthModal,
    orders,
    settings,
    lensOptions,
    appTexts,
    appearance,
    reorder,
    cancelOrder,
    openCatalog,
  } = useStore();

  if (isGuest) {
    return (
      <div className="max-w-xl mx-auto px-4 py-16">
        <div className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-2xl p-6 sm:p-8 text-center space-y-4 shadow-xs">
          <div
            style={{ backgroundColor: `${appearance.secondaryColor}26`, color: appearance.primaryColor }}
            className="w-14 h-14 rounded-2xl mx-auto flex items-center justify-center dark:text-[#E2BD5B]"
          >
            <Lock className="w-7 h-7" />
          </div>
          <div className="space-y-1.5">
            <h1 className="text-lg sm:text-xl font-extrabold text-[#11223E] dark:text-white">
              {t('سجل الطلبات وتتبع الشحن', 'Orders & Order History')}
            </h1>
            <p className="text-sm font-bold text-slate-600 dark:text-slate-300">
              {t('سجّل دخولك لاستخدام هذه الميزة', 'Sign in to use this feature')}
            </p>
          </div>
          <button
            type="button"
            onClick={() => openAuthModal('login', false)}
            style={{ backgroundColor: appearance.primaryColor }}
            className="min-h-[44px] px-6 py-2.5 rounded-xl text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 hover:opacity-95 transition-opacity"
          >
            <LogIn className="w-4 h-4" />
            <span>{t('تسجيل الدخول', 'Sign In')}</span>
          </button>
        </div>
      </div>
    );
  }

  if (orders.length === 0) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-16 text-center space-y-4">
        <Package className="w-10 h-10 mx-auto text-stone-400" />
        <h1 className="text-xl font-bold">
          {locale === 'ar' ? appTexts.emptyOrdersAr : appTexts.emptyOrdersEn}
        </h1>
        <button
          type="button"
          onClick={() => openCatalog('all', '')}
          style={{ backgroundColor: appearance.primaryColor }}
          className="min-h-[44px] px-5 py-2.5 rounded-xl text-white text-sm font-bold"
        >
          {locale === 'ar' ? appTexts.btnStartShoppingAr : appTexts.btnStartShoppingEn}
        </button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
      <div>
        <h1 className="text-2xl font-extrabold">{t('سجل الطلبات وتتبع الشحن', 'Orders & Tracking')}</h1>
        <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">
          {t('تابع حالة تجهيز نظارتك وتأكيد تحويلات بنكك خطوة بخطوة', 'Track prescription preparation and Bankak verification live')}
        </p>
      </div>

      <div className="space-y-5">
        {orders.map((order) => {
          const stateObj = settings.deliveryFees.find((s) => s.id === order.stateId);
          const stepIndex = TIMELINE_STEPS.indexOf(order.status);
          const canCancel =
            order.status === 'pending' || order.status === 'awaiting_payment_verification';

          return (
            <article
              key={order.id}
              className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-2xl p-5 space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 dark:border-zinc-800 pb-4">
                <div>
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <span className="font-mono-num">{order.id}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#B38B2D] dark:text-[#E2BD5B]">
                      {getOrderStatusLabel(order.status, locale)}
                    </span>
                  </div>
                  <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">
                    {formatShortDate(order.createdAt, locale)} ·{' '}
                    {locale === 'ar'
                      ? stateObj?.nameAr || order.address?.stateNameAr
                      : stateObj?.nameEn || order.address?.stateNameEn}{' '}
                    — {order.city} ({order.area}) ·{' '}
                    {order.paymentMethod === 'bankak'
                      ? t('تحويل بنكك', 'Bankak Transfer')
                      : t('الدفع عند الاستلام', 'Cash on Delivery')}
                  </p>
                </div>

                <div className="text-end">
                  <div className="font-mono-num text-lg font-extrabold tabular-nums">
                    {formatSdg(order.totalSdg)}
                  </div>
                  <div className="flex items-center gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => reorder(order.id)}
                      className="px-3 py-1.5 rounded-lg border border-stone-200 dark:border-zinc-700 text-xs font-semibold hover:bg-stone-50 dark:hover:bg-zinc-800 inline-flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      {t('إعادة الطلب', 'Reorder')}
                    </button>
                    {canCancel && (
                      <button
                        type="button"
                        onClick={() => cancelOrder(order.id)}
                        className="px-3 py-1.5 rounded-lg border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 text-xs font-semibold hover:bg-rose-50 dark:hover:bg-rose-950/30 inline-flex items-center gap-1.5"
                      >
                        <XCircle className="w-3.5 h-3.5" />
                        {t('إلغاء', 'Cancel')}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              {order.status !== 'cancelled' ? (
                <div className="grid grid-cols-2 sm:grid-cols-6 gap-2 text-[11px]">
                  {TIMELINE_STEPS.map((st, idx) => {
                    const reached = idx <= stepIndex;
                    return (
                      <div
                        key={st}
                        className={`p-2 rounded-lg border ${
                          reached
                            ? 'border-[var(--vp-secondary)] bg-[#D9B24C]/15 font-semibold'
                            : 'border-stone-200 dark:border-zinc-800 text-stone-400 dark:text-zinc-500'
                        }`}
                      >
                        <span className="font-mono-num block text-[10px]">0{idx + 1}</span>
                        <span className="line-clamp-1">{getOrderStatusLabel(st, locale)}</span>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <div className="p-3 rounded-lg bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-400 text-xs font-semibold">
                  {t('تم إلغاء هذا الطلب', 'This order was cancelled')}
                </div>
              )}

              <div className="space-y-2.5">
                {order.items.map((item, idx) => {
                  const rx = item.prescription;
                  const syntheticRx = rx || (item.lensOption && item.lensOption !== 'none'
                    ? {
                        type: 'none' as const,
                        visionType: item.visionType,
                        extraOptions: item.extraOptions,
                        mirrorColor: item.mirrorColor,
                        lensOption: item.lensOption,
                        lensExtraPriceSdg: item.lensExtraPriceSdg || 0,
                      }
                    : undefined);
                  const hasCustomLens = hasCustomLensOrRx(syntheticRx);
                  const lensSummary = formatLensSummaryLine(syntheticRx, lensOptions, locale);
                  const extraPrice = item.lensExtraPriceSdg ?? rx?.lensExtraPriceSdg ?? 0;
                  const pdText =
                    rx?.pdMode === 'dual' && rx?.pdRight
                      ? `PD OD ${rx.pdRight}/${rx.pdLeft}mm`
                      : rx?.pd
                      ? `PD ${rx.pd}mm`
                      : '';
                  const fittingText = rx?.fittingHeight
                    ? ` · ${t('ارتفاع التركيب', 'FH')} ${rx.fittingHeight}mm`
                    : '';

                  return (
                    <div key={item.productId + idx} className="flex items-center gap-3 text-xs">
                      <div className="w-14 h-12 rounded-lg overflow-hidden bg-stone-100 dark:bg-zinc-900 shrink-0">
                        <ResilientImage
                          src={item.image}
                          alt={locale === 'ar' ? item.titleAr : item.titleEn}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0 space-y-0.5">
                        <p className="font-bold truncate">
                          {locale === 'ar' ? item.titleAr : item.titleEn} × {item.quantity}
                        </p>
                        {hasCustomLens && (
                          <p className="text-[11px] text-stone-500 dark:text-zinc-400">
                            {lensSummary ? `${lensSummary} · ` : ''}
                            {rx?.type === 'manual' && rx.values?.kind === 'contact_lenses'
                              ? `OD ${rx.values.contactRight?.sph || '-'} BC ${rx.values.contactRight?.bc || '-'} DIA ${rx.values.contactRight?.dia || '-'} | OS ${rx.values.contactLeft?.sph || '-'}`
                              : rx?.type === 'manual' && rx.rightEye
                              ? `OD ${rx.rightEye.sph}/${rx.rightEye.cyl}×${rx.rightEye.axis}°${rx.rightEye.add ? ` ADD ${rx.rightEye.add}` : ''} | OS ${rx.leftEye?.sph}/${rx.leftEye?.cyl}×${rx.leftEye?.axis}°${rx.leftEye?.add ? ` ADD ${rx.leftEye.add}` : ''}${pdText ? ` · ${pdText}` : ''}${fittingText}`
                              : rx?.type === 'image'
                              ? t('صورة روشتة مرفقة', 'Prescription photo attached')
                              : rx?.type === 'later'
                              ? t('سيتم الإرسال عبر الواتساب', 'Send via WhatsApp later')
                              : t('مواصفات العدسات مختارة', 'Lens options selected')}
                          </p>
                        )}
                      </div>
                      <span className="font-mono-num font-bold tabular-nums">
                        {formatSdg((item.unitPriceSdg + extraPrice) * item.quantity)}
                      </span>
                    </div>
                  );
                })}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
