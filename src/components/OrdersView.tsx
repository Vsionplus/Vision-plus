import React, { useState } from 'react';
import {
  RotateCcw,
  XCircle,
  Package,
  Lock,
  LogIn,
  Clock,
  CheckCircle2,
  MessageCircle,
  X,
} from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { Order, OrderStatus } from '../types';
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

const CANCELLABLE_STATUSES: OrderStatus[] = [
  'pending',
  'awaiting_payment_verification',
  'confirmed',
  'preparing',
];

const CANCEL_REASONS = [
  { ar: 'غيّرت رأيي', en: 'Changed my mind' },
  { ar: 'طلبت بالخطأ', en: 'Ordered by mistake' },
  { ar: 'تأخر التوصيل', en: 'Delivery delay' },
  { ar: 'وجدت سعراً أفضل', en: 'Found a better price' },
  { ar: 'أخرى', en: 'Other' },
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
    requestOrderCancellation,
    openCatalog,
  } = useStore();

  const [cancelTargetOrder, setCancelTargetOrder] = useState<Order | null>(null);
  const [selectedReason, setSelectedReason] = useState(CANCEL_REASONS[0].ar);
  const [cancelNote, setCancelNote] = useState('');
  const [submittingCancel, setSubmittingCancel] = useState(false);

  const whatsappDigits = (settings.whatsapp || '').replace(/[^\d]/g, '');

  const openCancelDialog = (order: Order) => {
    setCancelTargetOrder(order);
    setSelectedReason(CANCEL_REASONS[0].ar);
    setCancelNote('');
  };

  const handleSubmitCancelRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTargetOrder || !selectedReason.trim() || submittingCancel) return;
    setSubmittingCancel(true);
    try {
      await requestOrderCancellation(
        cancelTargetOrder.id,
        selectedReason,
        cancelNote.trim() || undefined
      );
      setCancelTargetOrder(null);
      setCancelNote('');
    } finally {
      setSubmittingCancel(false);
    }
  };

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
          const isCancellableStatus = CANCELLABLE_STATUSES.includes(order.status);
          const isPostShipped = order.status === 'shipped' || order.status === 'delivered';
          const cancelReq = order.cancelRequest;
          const isCancelPending = cancelReq?.status === 'pending';
          const isCancelRejected = cancelReq?.status === 'rejected';
          const isCancelApproved =
            order.status === 'cancelled' && cancelReq?.status === 'approved';

          return (
            <article
              key={order.id}
              className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-2xl p-5 space-y-5"
            >
              <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 dark:border-zinc-800 pb-4">
                <div>
                  <div className="flex flex-wrap items-center gap-2 text-sm font-bold">
                    <span className="font-mono-num">{order.id}</span>
                    <span aria-hidden="true">·</span>
                    <span className="text-[#B38B2D] dark:text-[#E2BD5B]">
                      {getOrderStatusLabel(order.status, locale)}
                    </span>
                    {isCancelPending && (
                      <span className="px-2.5 py-0.5 rounded-lg bg-amber-100 dark:bg-amber-950/40 border border-amber-300 dark:border-amber-800 text-amber-800 dark:text-amber-300 text-xs font-extrabold inline-flex items-center gap-1">
                        <Clock className="w-3.5 h-3.5" />
                        {t('طلب الإلغاء قيد المراجعة', 'Cancellation Under Review')}
                      </span>
                    )}
                    {isCancelApproved && (
                      <span className="px-2.5 py-0.5 rounded-lg bg-rose-100 dark:bg-rose-950/40 border border-rose-300 dark:border-rose-800 text-rose-700 dark:text-rose-300 text-xs font-extrabold inline-flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" />
                        {t('تمت الموافقة على الإلغاء', 'Cancellation Approved')}
                      </span>
                    )}
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
                  <div className="flex flex-wrap items-center justify-end gap-2 mt-2">
                    <button
                      type="button"
                      onClick={() => reorder(order.id)}
                      className="min-h-[44px] px-3.5 py-2 rounded-xl border border-stone-200 dark:border-zinc-700 text-xs font-semibold hover:bg-stone-50 dark:hover:bg-zinc-800 inline-flex items-center gap-1.5"
                    >
                      <RotateCcw className="w-3.5 h-3.5" />
                      {t('إعادة الطلب', 'Reorder')}
                    </button>

                    {isCancellableStatus && (
                      isCancelPending ? (
                        <button
                          type="button"
                          disabled
                          className="min-h-[44px] px-3.5 py-2 rounded-xl border border-amber-300 dark:border-amber-800 bg-amber-50 dark:bg-amber-950/25 text-amber-800 dark:text-amber-300 text-xs font-bold inline-flex items-center gap-1.5 opacity-80 cursor-not-allowed"
                        >
                          <Clock className="w-3.5 h-3.5" />
                          {t('طلب الإلغاء قيد المراجعة', 'Cancellation Pending')}
                        </button>
                      ) : (
                        <button
                          type="button"
                          onClick={() => openCancelDialog(order)}
                          className="min-h-[44px] px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/30 inline-flex items-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          {t('طلب إلغاء الطلب', 'Request Cancellation')}
                        </button>
                      )
                    )}
                  </div>
                </div>
              </div>

              {/* Post-shipped cancellation guidance */}
              {isPostShipped && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {t('للإلغاء بعد الشحن تواصل معنا', 'To cancel after shipping, please contact us')}
                  </span>
                  {whatsappDigits && (
                    <a
                      href={`https://wa.me/${whatsappDigits}?text=${encodeURIComponent(
                        t(
                          `مرحباً، أود الاستفسار عن إلغاء/تعديل الطلب رقم ${order.id}`,
                          `Hello, I would like to inquire about order ${order.id}`
                        )
                      )}`}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="min-h-[44px] px-4 py-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white font-bold inline-flex items-center gap-1.5"
                    >
                      <MessageCircle className="w-4 h-4" />
                      <span>{t('تواصل عبر واتساب', 'Contact via WhatsApp')}</span>
                    </a>
                  )}
                </div>
              )}

              {/* Cancellation request status banners */}
              {isCancelPending && cancelReq && (
                <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 text-xs space-y-1">
                  <div className="font-extrabold flex items-center gap-1.5">
                    <Clock className="w-4 h-4 shrink-0" />
                    <span>{t('طلب الإلغاء قيد المراجعة', 'Cancellation Request Under Review')}</span>
                  </div>
                  <p>
                    <strong>{t('السبب:', 'Reason:')}</strong> {cancelReq.reason}
                    {cancelReq.note ? ` — ${cancelReq.note}` : ''}
                  </p>
                </div>
              )}

              {isCancelRejected && order.status !== 'cancelled' && cancelReq && (
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-200 text-xs space-y-1">
                  <div className="font-extrabold">
                    {t('تم رفض طلب الإلغاء', 'Cancellation Request Rejected')}
                  </div>
                  {cancelReq.adminNote && (
                    <p>
                      <strong>{t('سبب الرفض:', 'Admin reason:')}</strong> {cancelReq.adminNote}
                    </p>
                  )}
                  <p className="text-[11px] opacity-85">
                    {t('يستمر تجهيز طلبك بشكل طبيعي.', 'Your order continues processing normally.')}
                  </p>
                </div>
              )}

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
                <div className="p-3.5 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs space-y-1">
                  <div className="font-extrabold">
                    {isCancelApproved
                      ? t('تمت الموافقة على الإلغاء', 'Cancellation Approved')
                      : t('تم إلغاء هذا الطلب', 'This order was cancelled')}
                  </div>
                  {cancelReq?.adminNote && (
                    <p>
                      <strong>{t('ملاحظة الإدارة:', 'Admin note:')}</strong> {cancelReq.adminNote}
                    </p>
                  )}
                </div>
              )}

              <div className="space-y-2.5">
                {order.items.map((item, idx) => {
                  const rx = item.prescription;
                  const syntheticRx =
                    rx ||
                    (item.lensOption && item.lensOption !== 'none'
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

      {/* Cancellation Request Modal Dialog */}
      {cancelTargetOrder && (
        <div className="fixed inset-0 z-[70] bg-black/55 backdrop-blur-xs flex items-center justify-center p-4">
          <form
            onSubmit={handleSubmitCancelRequest}
            className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl text-xs"
          >
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-zinc-800 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-[#11223E] dark:text-white">
                  {t('طلب إلغاء الطلب', 'Request Order Cancellation')}
                </h2>
                <p className="text-[11px] text-slate-500 font-mono-num mt-0.5">
                  #{cancelTargetOrder.id}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setCancelTargetOrder(null)}
                aria-label={t('إغلاق', 'Close')}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-1.5">
              <label className="block font-bold">
                {t('سبب طلب الإلغاء *', 'Cancellation Reason *')}
              </label>
              <select
                required
                value={selectedReason}
                onChange={(e) => setSelectedReason(e.target.value)}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-sm"
              >
                {CANCEL_REASONS.map((r) => (
                  <option key={r.ar} value={r.ar}>
                    {locale === 'ar' ? r.ar : r.en}
                  </option>
                ))}
              </select>
            </div>

            <div className="space-y-1.5">
              <label className="block font-bold">
                {t('ملاحظة إضافية (اختياري)', 'Additional Note (optional)')}
              </label>
              <textarea
                rows={3}
                maxLength={500}
                value={cancelNote}
                onChange={(e) => setCancelNote(e.target.value)}
                placeholder={t(
                  'أضف أي تفاصيل تساعد الإدارة في مراجعة طلبك...',
                  'Add any extra details for our team...'
                )}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-sm"
              />
            </div>

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setCancelTargetOrder(null)}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-stone-200 dark:border-zinc-700 font-bold"
              >
                {t('تراجع', 'Back')}
              </button>
              <button
                type="submit"
                disabled={submittingCancel || !selectedReason.trim()}
                className="min-h-[44px] px-5 py-2 rounded-xl bg-rose-600 hover:bg-rose-700 text-white font-extrabold disabled:opacity-50"
              >
                {submittingCancel
                  ? t('جارٍ الإرسال...', 'Submitting...')
                  : t('إرسال طلب الإلغاء', 'Submit Cancellation Request')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};
