import React from 'react';
import { RotateCcw, XCircle, Package } from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { OrderStatus } from '../types';
import { formatSdg, formatShortDate, getOrderStatusLabel } from '../utils/format';
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
  const { locale, t, orders, settings, appTexts, appearance, reorder, cancelOrder, openCatalog } =
    useStore();

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
          className="px-5 py-2.5 rounded-xl text-white text-sm font-bold"
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
                    {locale === 'ar' ? stateObj?.nameAr : stateObj?.nameEn} — {order.city} ·{' '}
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
                {order.items.map((item, idx) => (
                  <div key={item.productId + idx} className="flex items-center gap-3 text-xs">
                    <div className="w-14 h-12 rounded-lg overflow-hidden bg-stone-100 dark:bg-zinc-900 shrink-0">
                      <ResilientImage
                        src={item.image}
                        alt={locale === 'ar' ? item.titleAr : item.titleEn}
                        className="w-full h-full object-cover"
                      />
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="font-bold truncate">
                        {locale === 'ar' ? item.titleAr : item.titleEn} × {item.quantity}
                      </p>
                      {item.prescription && (
                        <p className="text-[11px] text-stone-500 dark:text-zinc-400">
                          {t('وصفة طبية مرفقة:', 'Prescription attached:')}{' '}
                          {item.prescription.lensOption}{' '}
                          {item.prescription.rightEye
                            ? `| OD ${item.prescription.rightEye.sph} / OS ${item.prescription.leftEye?.sph}`
                            : ''}
                        </p>
                      )}
                    </div>
                    <span className="font-mono-num font-bold tabular-nums">
                      {formatSdg(
                        (item.unitPriceSdg + (item.prescription?.lensExtraPriceSdg || 0)) *
                          item.quantity
                      )}
                    </span>
                  </div>
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
};
