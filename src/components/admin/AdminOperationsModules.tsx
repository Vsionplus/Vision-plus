import React, { useEffect, useMemo, useState } from 'react';
import {
  Check,
  X,
  Printer,
  Trash2,
  Plus,
  Minus,
  Edit3,
  Send,
  Shield,
  Ban,
  Eye,
  EyeOff,
  Star,
  AlertTriangle,
  Phone,
  MessageCircle,
  MapPin,
  ExternalLink,
  Download,
  ChevronDown,
  ChevronUp,
  Clock,
  RotateCcw,
} from 'lucide-react';
import { useStore } from '../../store/StoreContext';
import { Order, OrderItem, OrderStatus, PaymentMethod } from '../../types';
import { useAdminSecurity } from './AdminGuard';
import {
  calculateSplitAmounts,
  formatSdg,
  formatShortDate,
  getOrderPaymentBreakdown,
  getOrderStatusLabel,
  getPaymentMethodLabel,
  isValidSudanPhone,
  normalizeSudanPhone,
} from '../../utils/format';
import {
  calculateLensPricingBreakdown,
  getExtraOptionLabel,
  getMirrorColorLabel,
  getVisionTypeLabel,
  hasCustomLensOrRx,
  resolveExtraOptions,
  resolveVisionType,
} from '../../utils/prescription';

function toWhatsappDigits(phone: string): string {
  const digits = phone.replace(/[^\d]/g, '');
  if (digits.startsWith('249')) return digits;
  if (digits.startsWith('0')) return `249${digits.slice(1)}`;
  return `249${digits}`;
}

export const AdminOrdersModule: React.FC<{
  onPrintInvoice: (order: Order) => void;
  initialStatusFilter?: string;
}> = ({ onPrintInvoice, initialStatusFilter = 'all' }) => {
  const {
    locale,
    t,
    orders,
    products,
    settings,
    lensOptions,
    updateOrderStatus,
    updateOrderByAdmin,
    approveBankTransfer,
    rejectBankTransfer,
    approveOrderCancellation,
    rejectOrderCancellation,
    toggleOrderRefunded,
  } = useStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>(initialStatusFilter);
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [collapsedOrderIds, setCollapsedOrderIds] = useState<Record<string, boolean>>({});
  const [lightboxImage, setLightboxImage] = useState<string | null>(null);
  const [confirmBankAction, setConfirmBankAction] = useState<{
    orderId: string;
    action: 'approve' | 'reject';
  } | null>(null);
  const [cancelReviewModal, setCancelReviewModal] = useState<{
    order: Order;
    action: 'approve' | 'reject';
  } | null>(null);
  const [cancelAdminNote, setCancelAdminNote] = useState('');
  const [cancelReviewError, setCancelReviewError] = useState<string | null>(null);
  const [submittingCancelReview, setSubmittingCancelReview] = useState(false);

  // Admin Edit Order Modal state
  const [editOrder, setEditOrder] = useState<Order | null>(null);
  const [adminEditName, setAdminEditName] = useState('');
  const [adminEditPhone, setAdminEditPhone] = useState('');
  const [adminEditStateId, setAdminEditStateId] = useState('');
  const [adminEditCity, setAdminEditCity] = useState('');
  const [adminEditArea, setAdminEditArea] = useState('');
  const [adminEditDetails, setAdminEditDetails] = useState('');
  const [adminEditItems, setAdminEditItems] = useState<OrderItem[]>([]);
  const [adminEditDiscount, setAdminEditDiscount] = useState(0);
  const [adminEditDelivery, setAdminEditDelivery] = useState(0);
  const [adminEditPayment, setAdminEditPayment] = useState<PaymentMethod>('cod');
  const [adminEditBankakPaid, setAdminEditBankakPaid] = useState(0);
  const [adminEditBankRef, setAdminEditBankRef] = useState('');
  const [adminEditNote, setAdminEditNote] = useState('');
  const [addProductId, setAddProductId] = useState('');
  const [adminEditError, setAdminEditError] = useState<string | null>(null);
  const [savingAdminEdit, setSavingAdminEdit] = useState(false);

  useEffect(() => {
    setStatusFilter(initialStatusFilter);
  }, [initialStatusFilter]);

  const pendingCancelRequests = useMemo(
    () => orders.filter((o) => o.cancelRequest?.status === 'pending'),
    [orders]
  );

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter === 'cancel_requests') {
        if (o.cancelRequest?.status !== 'pending') return false;
      } else if (statusFilter !== 'all' && o.status !== statusFilter) {
        return false;
      }
      if (paymentFilter !== 'all' && o.paymentMethod !== paymentFilter) return false;
      if (q) {
        const hay = `${o.id} ${o.customerName} ${o.customerPhone} ${o.bankTransferReference || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, search, statusFilter, paymentFilter]);

  const openCancelReview = (order: Order, action: 'approve' | 'reject') => {
    setCancelReviewModal({ order, action });
    setCancelAdminNote('');
    setCancelReviewError(null);
  };

  const openAdminEditModal = (order: Order) => {
    setEditOrder(order);
    setAdminEditName(order.address?.recipientName || order.customerName);
    setAdminEditPhone(order.address?.phone || order.customerPhone);
    setAdminEditStateId(order.stateId);
    setAdminEditCity(order.address?.city || order.city);
    setAdminEditArea(order.address?.area || order.area);
    setAdminEditDetails(order.address?.details || order.addressDetails);
    setAdminEditItems(order.items.map((it) => ({ ...it })));
    setAdminEditDiscount(order.discountSdg);
    setAdminEditDelivery(order.deliveryFeeSdg);
    setAdminEditPayment(order.paymentMethod);
    setAdminEditBankakPaid(
      order.paymentMethod === 'split'
        ? getOrderPaymentBreakdown(order).bankakSdg
        : calculateSplitAmounts(order.totalSdg, settings).bankakAmount
    );
    setAdminEditBankRef(order.bankTransferReference || '');
    setAdminEditNote(order.adminNote || '');
    setAddProductId('');
    setAdminEditError(null);
  };

  const adminEditPricing = useMemo(() => {
    const itemsSubtotal = adminEditItems.reduce((s, it) => s + it.unitPriceSdg * it.quantity, 0);
    const lensTotal = adminEditItems.reduce(
      (s, it) => s + (it.lensExtraPriceSdg ?? it.prescription?.lensExtraPriceSdg ?? 0) * it.quantity,
      0
    );
    const subtotal = itemsSubtotal + lensTotal;
    const total = Math.max(0, subtotal - Math.max(0, adminEditDiscount) + Math.max(0, adminEditDelivery));
    return { itemsSubtotal, lensTotal, subtotal, total };
  }, [adminEditItems, adminEditDiscount, adminEditDelivery]);

  const handleAdminAddItem = () => {
    if (!addProductId) return;
    const p = products.find((prod) => prod.id === addProductId && !prod.isDeleted);
    if (!p) return;
    setAdminEditItems((prev) => {
      const existingIdx = prev.findIndex((it) => it.productId === p.id && !it.prescription);
      if (existingIdx >= 0) {
        return prev.map((it, i) =>
          i === existingIdx ? { ...it, quantity: Math.min(99, it.quantity + 1) } : it
        );
      }
      return [
        ...prev,
        {
          productId: p.id,
          titleAr: p.titleAr,
          titleEn: p.titleEn,
          image: p.images[0] || '',
          unitPriceSdg: p.priceSdg,
          quantity: 1,
        },
      ];
    });
    setAddProductId('');
  };

  const handleConfirmAdminEdit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editOrder || savingAdminEdit) return;
    if (!adminEditName.trim()) {
      setAdminEditError(t('يرجى إدخال اسم المستلم.', 'Recipient name is required.'));
      return;
    }
    if (!isValidSudanPhone(adminEditPhone)) {
      setAdminEditError(t('رقم الهاتف غير صالح.', 'Valid Sudan phone number required.'));
      return;
    }
    if (!adminEditCity.trim() || !adminEditArea.trim() || !adminEditDetails.trim()) {
      setAdminEditError(t('يرجى إكمال بيانات العنوان.', 'City, area, and street details are required.'));
      return;
    }
    if (adminEditItems.length === 0) {
      setAdminEditError(t('يجب وجود منتج واحد على الأقل في الطلب.', 'Order must contain at least one item.'));
      return;
    }
    const normalizedPhone = normalizeSudanPhone(adminEditPhone);
    const stateObj = settings.deliveryFees.find((st) => st.id === adminEditStateId);
    setAdminEditError(null);
    setSavingAdminEdit(true);
    try {
      await updateOrderByAdmin(editOrder.id, {
        customerName: adminEditName.trim(),
        customerPhone: normalizedPhone,
        stateId: adminEditStateId,
        city: adminEditCity.trim(),
        area: adminEditArea.trim(),
        addressDetails: adminEditDetails.trim(),
        address: {
          recipientName: adminEditName.trim(),
          phone: normalizedPhone,
          stateId: adminEditStateId,
          stateNameAr: stateObj?.nameAr || editOrder.address?.stateNameAr || adminEditStateId,
          stateNameEn: stateObj?.nameEn || editOrder.address?.stateNameEn || adminEditStateId,
          city: adminEditCity.trim(),
          area: adminEditArea.trim(),
          details: adminEditDetails.trim(),
          label: editOrder.address?.label,
          mapUrl: editOrder.address?.mapUrl,
        },
        items: adminEditItems,
        discountSdg: Math.max(0, Math.round(adminEditDiscount || 0)),
        deliveryFeeSdg: Math.max(0, Math.round(adminEditDelivery || 0)),
        paymentMethod: adminEditPayment,
        bankakPaidSdg:
          adminEditPayment === 'split'
            ? Math.min(adminEditPricing.total, Math.max(0, Math.round(adminEditBankakPaid || 0)))
            : undefined,
        bankTransferReference:
          adminEditPayment === 'bankak' || adminEditPayment === 'split'
            ? adminEditBankRef.trim() || undefined
            : undefined,
        adminNote: adminEditNote.trim() || undefined,
      });
      setEditOrder(null);
    } catch {
      setAdminEditError(t('تعذر حفظ تعديلات الطلب.', 'Failed to save order updates.'));
    } finally {
      setSavingAdminEdit(false);
    }
  };

  const handleConfirmCancelReview = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelReviewModal || submittingCancelReview) return;
    if (cancelReviewModal.action === 'reject' && !cancelAdminNote.trim()) {
      setCancelReviewError(t('يرجى كتابة سبب الرفض للعميل.', 'Please enter a rejection reason.'));
      return;
    }
    setCancelReviewError(null);
    setSubmittingCancelReview(true);
    try {
      if (cancelReviewModal.action === 'approve') {
        await approveOrderCancellation(
          cancelReviewModal.order.id,
          cancelAdminNote.trim() || undefined
        );
      } else {
        await rejectOrderCancellation(cancelReviewModal.order.id, cancelAdminNote.trim());
      }
      setCancelReviewModal(null);
      setCancelAdminNote('');
    } catch {
      setCancelReviewError(
        t('تعذر تنفيذ القرار حالياً. يرجى المحاولة مرة أخرى.', 'Action failed. Please try again.')
      );
    } finally {
      setSubmittingCancelReview(false);
    }
  };

  return (
    <div className="space-y-4 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('بحث برقم الطلب، العميل، الهاتف، أو مرجع بنكك...', 'Search order ID, customer, phone, Bankak ref...')}
          className="flex-1 min-w-[220px] min-h-[44px] px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E]"
        />
        <button
          type="button"
          onClick={() =>
            setStatusFilter((prev) => (prev === 'cancel_requests' ? 'all' : 'cancel_requests'))
          }
          className={`min-h-[44px] px-3.5 py-2 rounded-lg border font-extrabold inline-flex items-center gap-1.5 transition-colors ${
            statusFilter === 'cancel_requests'
              ? 'bg-rose-600 text-white border-rose-600'
              : 'bg-white dark:bg-[#181B1E] border-stone-200 dark:border-zinc-700 hover:border-rose-400'
          }`}
        >
          <Clock className="w-3.5 h-3.5" />
          <span>{t(`طلبات إلغاء (${pendingCancelRequests.length})`, `Cancel Requests (${pendingCancelRequests.length})`)}</span>
          {pendingCancelRequests.length > 0 && (
            <span
              className={`px-1.5 py-0.5 rounded-full text-[10px] font-extrabold tabular-nums ${
                statusFilter === 'cancel_requests'
                  ? 'bg-white text-rose-600'
                  : 'bg-rose-600 text-white'
              }`}
            >
              {pendingCancelRequests.length}
            </span>
          )}
        </button>
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="min-h-[44px] px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E]"
        >
          <option value="all">{t('كل الحالات', 'All Statuses')}</option>
          <option value="cancel_requests">
            {t(`طلبات إلغاء معلقة (${pendingCancelRequests.length})`, `Cancel Requests (${pendingCancelRequests.length})`)}
          </option>
          {(
            [
              'awaiting_payment_verification',
              'pending',
              'confirmed',
              'preparing',
              'shipped',
              'delivered',
              'cancelled',
            ] as OrderStatus[]
          ).map((st) => (
            <option key={st} value={st}>
              {getOrderStatusLabel(st, locale)}
            </option>
          ))}
        </select>
        <select
          value={paymentFilter}
          onChange={(e) => setPaymentFilter(e.target.value)}
          className="min-h-[44px] px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E]"
        >
          <option value="all">{t('كل طرق الدفع', 'All Payment Methods')}</option>
          <option value="bankak">{t('بنكك / تحويل بنكي', 'Bankak Transfer')}</option>
          <option value="split">{t('دفع مقسّم (بنكك + عند الاستلام)', 'Split (Bankak + COD)')}</option>
          <option value="cod">{t('الدفع عند الاستلام', 'Cash on Delivery')}</option>
        </select>
      </div>

      {/* Dedicated Pending Cancellation Requests Section */}
      {pendingCancelRequests.length > 0 && statusFilter !== 'cancel_requests' && (
        <div className="bg-rose-50/70 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 rounded-xl p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div className="font-extrabold text-sm text-rose-800 dark:text-rose-300 flex items-center gap-2">
              <AlertTriangle className="w-4 h-4 shrink-0" />
              <span>
                {t(
                  `طلبات إلغاء بانتظار المراجعة (${pendingCancelRequests.length})`,
                  `Pending Cancellation Requests (${pendingCancelRequests.length})`
                )}
              </span>
            </div>
            <button
              type="button"
              onClick={() => setStatusFilter('cancel_requests')}
              className="min-h-[36px] px-3 py-1 rounded-lg bg-rose-600 text-white font-bold"
            >
              {t('عرض هذه الطلبات فقط', 'Filter Cancel Requests')}
            </button>
          </div>
          <div className="grid md:grid-cols-2 gap-2.5">
            {pendingCancelRequests.map((reqOrder) => (
              <div
                key={reqOrder.id}
                className="bg-white dark:bg-[#181B1E] border border-rose-200 dark:border-rose-900/40 rounded-lg p-3 flex flex-wrap items-center justify-between gap-2"
              >
                <div className="min-w-0 space-y-0.5">
                  <div className="font-bold flex items-center gap-1.5">
                    <span className="font-mono-num">#{reqOrder.id}</span>
                    <span>·</span>
                    <span className="truncate">{reqOrder.address?.recipientName || reqOrder.customerName}</span>
                  </div>
                  <div className="text-[11px] text-slate-600 dark:text-slate-300">
                    <strong>{t('السبب:', 'Reason:')}</strong> {reqOrder.cancelRequest?.reason}
                    {reqOrder.cancelRequest?.note ? ` (${reqOrder.cancelRequest.note})` : ''}
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => openCancelReview(reqOrder, 'approve')}
                    className="min-h-[36px] px-2.5 py-1 rounded-lg bg-emerald-700 text-white font-bold"
                  >
                    {t('الموافقة على الإلغاء', 'Approve')}
                  </button>
                  <button
                    type="button"
                    onClick={() => openCancelReview(reqOrder, 'reject')}
                    className="min-h-[36px] px-2.5 py-1 rounded-lg bg-rose-700 text-white font-bold"
                  >
                    {t('رفض الطلب', 'Reject')}
                  </button>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-10 text-center text-slate-500">
          {t('لا توجد طلبات مطابقة للبحث', 'No matching orders')}
        </div>
      ) : (
        filtered.map((order) => {
          const stateObj = settings.deliveryFees.find((s) => s.id === order.stateId);
          const phone = order.address?.phone || order.customerPhone;
          const recipient = order.address?.recipientName || order.customerName;
          const isDetailsOpen = !collapsedOrderIds[order.id];

          return (
            <div
              key={order.id}
              className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-5 space-y-4"
            >
              <div className="flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-mono-num font-extrabold text-sm">{order.id}</span>
                    {order.cancelRequest?.status === 'pending' && (
                      <span className="px-2 py-0.5 rounded-md bg-amber-100 dark:bg-amber-950/50 border border-amber-300 dark:border-amber-700 text-amber-900 dark:text-amber-300 text-[11px] font-extrabold inline-flex items-center gap-1">
                        <Clock className="w-3 h-3" />
                        {t('طلب إلغاء معلق', 'Pending Cancel Request')}
                      </span>
                    )}
                    {order.cancelRequest?.status === 'rejected' && (
                      <span className="px-2 py-0.5 rounded-md bg-stone-100 dark:bg-zinc-800 border border-stone-300 dark:border-zinc-700 text-slate-600 dark:text-slate-300 text-[11px] font-bold">
                        {t('تم رفض الإلغاء', 'Cancel Rejected')}
                      </span>
                    )}
                    {order.lastEditedAt && (
                      <span className="px-2 py-0.5 rounded-md bg-sky-100 dark:bg-sky-950/40 border border-sky-200 dark:border-sky-800 text-sky-800 dark:text-sky-300 text-[11px] font-bold">
                        {t('مُعدّل', 'Edited')} · {formatShortDate(order.lastEditedAt, locale)}
                      </span>
                    )}
                  </div>
                  <div className="text-stone-500 dark:text-zinc-400">
                    {recipient} · <span className="font-mono-num" dir="ltr">{phone}</span> ·{' '}
                    {locale === 'ar'
                      ? stateObj?.nameAr || order.address?.stateNameAr
                      : stateObj?.nameEn || order.address?.stateNameEn}{' '}
                    — {order.city} ({order.area}) · {formatShortDate(order.createdAt, locale)}
                  </div>
                </div>

                <div className="flex flex-wrap items-center gap-2">
                  <span className="font-mono-num text-sm font-extrabold text-[#11223E] dark:text-[#E2BD5B] tabular-nums">
                    {formatSdg(order.totalSdg)}
                  </span>

                  <a
                    href={`tel:${phone}`}
                    className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-[#11223E] text-white font-bold inline-flex items-center gap-1"
                  >
                    <Phone className="w-3.5 h-3.5" />
                    <span>{t('اتصال', 'Call')}</span>
                  </a>

                  <a
                    href={`https://wa.me/${toWhatsappDigits(phone)}?text=${encodeURIComponent(
                      t(
                        `مرحباً ${recipient}، بخصوص طلبك رقم ${order.id} من Vision Plus`,
                        `Hello ${recipient}, regarding your Vision Plus order ${order.id}`
                      )
                    )}`}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="min-h-[36px] px-2.5 py-1.5 rounded-lg bg-emerald-700 text-white font-bold inline-flex items-center gap-1"
                  >
                    <MessageCircle className="w-3.5 h-3.5" />
                    <span>{t('واتساب', 'WhatsApp')}</span>
                  </a>

                  <select
                    value={order.status}
                    onChange={(e) => {
                      const nextStatus = e.target.value as OrderStatus;
                      if (nextStatus === 'cancelled' && order.status !== 'cancelled') {
                        openCancelReview(order, 'approve');
                        return;
                      }
                      updateOrderStatus(order.id, nextStatus);
                    }}
                    className="min-h-[36px] px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 font-semibold"
                  >
                    {(
                      [
                        'pending',
                        'awaiting_payment_verification',
                        'confirmed',
                        'preparing',
                        'shipped',
                        'delivered',
                        'cancelled',
                      ] as OrderStatus[]
                    ).map((st) => (
                      <option key={st} value={st}>
                        {getOrderStatusLabel(st, locale)}
                      </option>
                    ))}
                  </select>

                  {order.status !== 'cancelled' && (
                    <button
                      type="button"
                      onClick={() => openAdminEditModal(order)}
                      className="min-h-[36px] px-3 py-1.5 rounded-lg border border-[#11223E]/30 dark:border-[#E2BD5B]/40 bg-[#11223E]/5 dark:bg-[#E2BD5B]/10 text-[#11223E] dark:text-[#E2BD5B] font-bold inline-flex items-center gap-1"
                    >
                      <Edit3 className="w-3.5 h-3.5" />
                      {t('تعديل الطلب', 'Edit Order')}
                    </button>
                  )}

                  <button
                    type="button"
                    onClick={() => onPrintInvoice(order)}
                    className="min-h-[36px] px-3 py-1.5 rounded-lg border border-stone-200 dark:border-zinc-700 hover:bg-stone-50 dark:hover:bg-zinc-800 font-semibold inline-flex items-center gap-1"
                  >
                    <Printer className="w-3.5 h-3.5" />
                    {t('فاتورة PDF', 'Invoice')}
                  </button>

                  <button
                    type="button"
                    onClick={() =>
                      setCollapsedOrderIds((prev) => ({ ...prev, [order.id]: !prev[order.id] }))
                    }
                    className="min-h-[36px] px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-zinc-700 font-semibold inline-flex items-center gap-1"
                  >
                    <span>{t('التفاصيل', 'Details')}</span>
                    {isDetailsOpen ? (
                      <ChevronUp className="w-3.5 h-3.5" />
                    ) : (
                      <ChevronDown className="w-3.5 h-3.5" />
                    )}
                  </button>
                </div>
              </div>

              {order.paymentMethod === 'split' && (() => {
                const { bankakSdg, codSdg } = getOrderPaymentBreakdown(order);
                return (
                  <div className="grid sm:grid-cols-3 gap-2.5 p-3 rounded-lg bg-amber-50/80 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-900/50 text-xs">
                    <div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-300">
                        {t('طريقة الدفع:', 'Payment:')}
                      </div>
                      <div className="font-extrabold text-[#11223E] dark:text-white">
                        {getPaymentMethodLabel(order.paymentMethod, locale)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-300">
                        {t('المدفوع عبر بنكك:', 'Paid via Bankak:')}
                      </div>
                      <div className="font-mono-num font-extrabold text-[#11223E] dark:text-[#E2BD5B]">
                        {formatSdg(bankakSdg)}
                      </div>
                    </div>
                    <div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-300">
                        {t('المتبقي للتحصيل عند الاستلام:', 'Collect on Delivery (COD):')}
                      </div>
                      <div className="font-mono-num font-extrabold text-emerald-700 dark:text-emerald-400">
                        {formatSdg(codSdg)}
                      </div>
                    </div>
                  </div>
                );
              })()}

              {(order.paymentMethod === 'bankak' || order.paymentMethod === 'split') && (
                <div className="p-3 rounded-lg bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="font-bold">
                      {order.paymentMethod === 'split'
                        ? t('إيصال عربون بنكك:', 'Bankak Deposit Receipt:')
                        : t('إيصال تحويل بنكك:', 'Bankak Receipt:')}{' '}
                      <span className="font-mono-num">{order.bankTransferReference || '—'}</span>
                    </div>
                    {order.bankTransferReceiptUrl && (
                      <button
                        type="button"
                        onClick={() => setLightboxImage(order.bankTransferReceiptUrl || null)}
                        className="mt-2 block"
                      >
                        <img
                          src={order.bankTransferReceiptUrl}
                          alt="Bankak Receipt"
                          className="h-16 rounded border border-stone-200 dark:border-zinc-700 object-cover"
                        />
                      </button>
                    )}
                  </div>

                  {order.status === 'awaiting_payment_verification' && (
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setConfirmBankAction({ orderId: order.id, action: 'approve' })}
                        className="px-3 py-1.5 rounded-lg bg-emerald-700 text-white font-bold inline-flex items-center gap-1"
                      >
                        <Check className="w-3.5 h-3.5" />
                        {t('اعتماد التحويل', 'Approve')}
                      </button>
                      <button
                        type="button"
                        onClick={() => setConfirmBankAction({ orderId: order.id, action: 'reject' })}
                        className="px-3 py-1.5 rounded-lg bg-rose-700 text-white font-bold inline-flex items-center gap-1"
                      >
                        <X className="w-3.5 h-3.5" />
                        {t('رفض', 'Reject')}
                      </button>
                    </div>
                  )}
                </div>
              )}

              {/* Cancellation Request Management & History */}
              {(order.cancelRequest || (order.cancelRequestHistory && order.cancelRequestHistory.length > 0)) && (
                <div
                  className={`p-3.5 rounded-xl border space-y-2 ${
                    order.cancelRequest?.status === 'pending'
                      ? 'bg-amber-50 dark:bg-amber-950/25 border-amber-300 dark:border-amber-800'
                      : order.cancelRequest?.status === 'approved'
                      ? 'bg-rose-50 dark:bg-rose-950/20 border-rose-200 dark:border-rose-900/50'
                      : 'bg-stone-50 dark:bg-zinc-900 border-stone-200 dark:border-zinc-800'
                  }`}
                >
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="font-extrabold flex items-center gap-1.5">
                        <RotateCcw className="w-3.5 h-3.5" />
                        <span>
                          {order.cancelRequest?.status === 'pending'
                            ? t('طلب إلغاء قيد المراجعة', 'Cancellation Request Pending')
                            : order.cancelRequest?.status === 'approved'
                            ? t('تمت الموافقة على الإلغاء', 'Cancellation Approved')
                            : t('تم رفض طلب الإلغاء', 'Cancellation Rejected')}
                        </span>
                        {order.cancelRequest?.requestedAt && (
                          <span className="font-mono-num text-[11px] font-normal text-slate-500">
                            · {formatShortDate(order.cancelRequest.requestedAt, locale)}
                          </span>
                        )}
                      </div>
                      {order.cancelRequest && (
                        <div className="text-[11px] space-y-0.5">
                          <div>
                            <strong>{t('سبب العميل:', 'Reason:')}</strong> {order.cancelRequest.reason}
                          </div>
                          {order.cancelRequest.note && (
                            <div>
                              <strong>{t('ملاحظة العميل:', 'Customer Note:')}</strong> {order.cancelRequest.note}
                            </div>
                          )}
                          {order.cancelRequest.adminNote && (
                            <div>
                              <strong>{t('رد الإدارة:', 'Admin Note:')}</strong> {order.cancelRequest.adminNote}
                            </div>
                          )}
                        </div>
                      )}
                    </div>

                    {order.cancelRequest?.status === 'pending' && (
                      <div className="flex flex-wrap items-center gap-2 shrink-0">
                        <button
                          type="button"
                          onClick={() => openCancelReview(order, 'approve')}
                          className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-emerald-700 hover:bg-emerald-800 text-white font-extrabold inline-flex items-center gap-1"
                        >
                          <Check className="w-3.5 h-3.5" />
                          {t('الموافقة على الإلغاء', 'Approve Cancellation')}
                        </button>
                        <button
                          type="button"
                          onClick={() => openCancelReview(order, 'reject')}
                          className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-rose-700 hover:bg-rose-800 text-white font-extrabold inline-flex items-center gap-1"
                        >
                          <X className="w-3.5 h-3.5" />
                          {t('رفض الطلب', 'Reject Request')}
                        </button>
                      </div>
                    )}
                  </div>

                  {order.cancelRequestHistory && order.cancelRequestHistory.length > 1 && (
                    <div className="pt-2 border-t border-black/10 dark:border-white/10 space-y-1 text-[11px] text-slate-600 dark:text-slate-400">
                      <div className="font-bold">
                        {t(
                          `سجل طلبات الإلغاء (${order.cancelRequestHistory.length})`,
                          `Cancellation History (${order.cancelRequestHistory.length})`
                        )}
                      </div>
                      {order.cancelRequestHistory.map((hist, hIdx) => (
                        <div key={`${hist.requestedAt}_${hIdx}`}>
                          • [{hist.status}] {hist.reason}
                          {hist.adminNote ? ` — ${hist.adminNote}` : ''} ({formatShortDate(hist.requestedAt, locale)})
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* Bankak Refund Tracking for Cancelled Verified Bankak / Split Orders */}
              {order.status === 'cancelled' &&
                (order.paymentMethod === 'bankak' || order.paymentMethod === 'split') &&
                (order.refundRequired || order.bankTransferVerified) && (
                  <div className="p-3.5 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-800 flex flex-wrap items-center justify-between gap-3">
                    <div className="space-y-0.5">
                      <div className="font-extrabold text-amber-900 dark:text-amber-200 flex items-center gap-1.5">
                        <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                        <span>
                          {t(
                            `يجب إرجاع المبلغ للعميل (${formatSdg(getOrderPaymentBreakdown(order).bankakSdg)})`,
                            `Refund Required (${formatSdg(getOrderPaymentBreakdown(order).bankakSdg)})`
                          )}
                        </span>
                      </div>
                      {order.refunded && order.refundedAt && (
                        <p className="text-[11px] text-emerald-700 dark:text-emerald-300 font-semibold">
                          {t('تم الاسترجاع بتاريخ:', 'Refunded on:')} {formatShortDate(order.refundedAt, locale)}
                        </p>
                      )}
                    </div>
                    <label className="min-h-[40px] px-3 py-1.5 rounded-lg bg-white dark:bg-[#181B1E] border border-amber-300 dark:border-amber-700 flex items-center gap-2 cursor-pointer font-extrabold">
                      <input
                        type="checkbox"
                        checked={Boolean(order.refunded)}
                        onChange={(e) => void toggleOrderRefunded(order.id, e.target.checked)}
                        className="w-4 h-4 accent-emerald-600"
                      />
                      <span>{t('تم الاسترجاع', 'Refunded')}</span>
                    </label>
                  </div>
                )}

              {isDetailsOpen && (
                <div className="space-y-3 pt-2 border-t border-stone-100 dark:border-zinc-800">
                  {(order.customerNote || order.adminNote) && (
                    <div className="grid sm:grid-cols-2 gap-2.5 text-[11px]">
                      {order.customerNote && (
                        <div className="p-2.5 rounded-lg bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 space-y-0.5">
                          <div className="font-extrabold text-amber-800 dark:text-amber-300">
                            {t('ملاحظة العميل:', 'Customer Note:')}
                          </div>
                          <div>{order.customerNote}</div>
                        </div>
                      )}
                      {order.adminNote && (
                        <div className="p-2.5 rounded-lg bg-sky-50/70 dark:bg-sky-950/20 border border-sky-200 dark:border-sky-900/50 space-y-0.5">
                          <div className="font-extrabold text-sky-800 dark:text-sky-300">
                            {t('ملاحظة الإدارة:', 'Admin Note:')}
                          </div>
                          <div>{order.adminNote}</div>
                        </div>
                      )}
                    </div>
                  )}

                  {/* Full Delivery Address Snapshot */}
                  <div className="p-3 rounded-lg bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-0.5">
                      <div className="font-bold flex items-center gap-1.5 text-[#11223E] dark:text-[#E2BD5B]">
                        <MapPin className="w-3.5 h-3.5" />
                        <span>{t('عنوان التوصيل الكامل:', 'Delivery Address:')}</span>
                      </div>
                      <div>
                        <strong>{recipient}</strong>
                        {order.address?.label ? ` (${order.address.label})` : ''} ·{' '}
                        <span className="font-mono-num" dir="ltr">{phone}</span>
                      </div>
                      <div className="text-stone-600 dark:text-zinc-300">
                        {locale === 'ar'
                          ? stateObj?.nameAr || order.address?.stateNameAr
                          : stateObj?.nameEn || order.address?.stateNameEn}{' '}
                        — {order.city}، {order.area} — {order.addressDetails}
                      </div>
                    </div>
                    {order.address?.mapUrl && (
                      <a
                        href={order.address.mapUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="px-2.5 py-1 rounded border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E] font-bold text-[#B38B2D] inline-flex items-center gap-1"
                      >
                        <ExternalLink className="w-3.5 h-3.5" />
                        {t('فتح الخريطة', 'Map')}
                      </a>
                    )}
                  </div>

                  {/* Items & Complete Prescription Tables */}
                  <div className="space-y-2.5">
                    {order.items.map((it, idx) => {
                      const rx = it.prescription;
                      const syntheticRx = rx || (it.lensOption && it.lensOption !== 'none'
                        ? {
                            type: 'none' as const,
                            visionType: it.visionType,
                            extraOptions: it.extraOptions,
                            mirrorColor: it.mirrorColor,
                            lensOption: it.lensOption,
                            lensExtraPriceSdg: it.lensExtraPriceSdg || 0,
                          }
                        : undefined);
                      const hasCustomLens = hasCustomLensOrRx(syntheticRx);
                      const hasRxValues = Boolean(rx && rx.type !== 'none');
                      const vt = resolveVisionType(syntheticRx);
                      const extras = resolveExtraOptions(syntheticRx);
                      const pricing = calculateLensPricingBreakdown(vt, extras, lensOptions);
                      const vtPrice = rx?.visionTypePriceSdg ?? pricing.visionTypePriceSdg;
                      const lensExtra = rx?.lensExtraPriceSdg ?? it.lensExtraPriceSdg ?? 0;
                      const pdMode = rx?.values?.pdMode || rx?.pdMode;
                      const pdSingle = rx?.values?.pd || rx?.pd;
                      const pdRight = rx?.values?.pdRight || rx?.pdRight;
                      const pdLeft = rx?.values?.pdLeft || rx?.pdLeft;
                      const fittingH = rx?.values?.fittingHeight || rx?.fittingHeight;
                      const mirrorClr = rx?.mirrorColor || it.mirrorColor;

                      return (
                        <div
                          key={idx}
                          className="p-3 rounded-lg bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 space-y-2"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="font-bold">
                              {locale === 'ar' ? it.titleAr : it.titleEn}
                              {(it.options?.color || it.variantLabel) && (
                                <span className="text-stone-500 font-normal ms-1.5">
                                  ({it.options?.color || it.variantLabel})
                                </span>
                              )}{' '}
                              × <span className="font-mono-num">{it.quantity}</span>
                            </div>
                            <div className="font-mono-num font-bold text-[#11223E] dark:text-[#E2BD5B]">
                              {formatSdg((it.unitPriceSdg + lensExtra) * it.quantity)}
                            </div>
                          </div>

                          {hasCustomLens ? (
                            <div className="space-y-2 pt-1.5 border-t border-stone-200/70 dark:border-zinc-800">
                              {(vt !== 'none' || extras.length > 0) && (
                                <div className="p-2 rounded bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-700 space-y-1 text-[11px]">
                                  {vt !== 'none' && (
                                    <div className="flex justify-between gap-2">
                                      <span>
                                        <strong>{t('نوع الرؤية:', 'Vision Type:')}</strong>{' '}
                                        {getVisionTypeLabel(vt, lensOptions, locale)}
                                      </span>
                                      <span className="font-mono-num font-bold">
                                        {vtPrice > 0 ? `+${formatSdg(vtPrice)}` : t('مجاني', 'Free')}
                                      </span>
                                    </div>
                                  )}
                                  {extras.map((extId) => {
                                    const extP =
                                      rx?.extraOptionsPricesSdg?.[extId] ??
                                      pricing.extraOptionsPricesSdg[extId] ??
                                      0;
                                    return (
                                      <div key={extId} className="flex justify-between gap-2">
                                        <span>
                                          + {getExtraOptionLabel(extId, lensOptions, locale)}
                                          {extId === 'mirror' && mirrorClr
                                            ? ` (${getMirrorColorLabel(mirrorClr, locale)})`
                                            : ''}
                                        </span>
                                        <span className="font-mono-num font-bold">
                                          {extP > 0 ? `+${formatSdg(extP)}` : t('مجاني', 'Free')}
                                        </span>
                                      </div>
                                    );
                                  })}
                                </div>
                              )}

                              {hasRxValues && rx && rx.type === 'manual' && rx.values?.kind === 'contact_lenses' && (
                                <div className="overflow-x-auto">
                                  <table className="w-full text-[11px] font-mono-num border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E]">
                                    <thead className="bg-stone-100 dark:bg-zinc-800 font-bold">
                                      <tr>
                                        <th className="p-1.5 text-start">{t('العين', 'Eye')}</th>
                                        <th className="p-1.5">SPH</th>
                                        <th className="p-1.5">CYL</th>
                                        <th className="p-1.5">AXIS</th>
                                        <th className="p-1.5">BC</th>
                                        <th className="p-1.5">DIA</th>
                                        <th className="p-1.5">{t('العلب', 'Boxes')}</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                      {rx.values.contactRight && (
                                        <tr>
                                          <td className="p-1.5 font-bold">OD</td>
                                          <td className="p-1.5 text-center">{rx.values.contactRight.sph}</td>
                                          <td className="p-1.5 text-center">{rx.values.contactRight.cyl}</td>
                                          <td className="p-1.5 text-center">{rx.values.contactRight.axis}°</td>
                                          <td className="p-1.5 text-center">{rx.values.contactRight.bc}</td>
                                          <td className="p-1.5 text-center">{rx.values.contactRight.dia}</td>
                                          <td className="p-1.5 text-center">{rx.values.contactRight.boxes}</td>
                                        </tr>
                                      )}
                                      {rx.values.contactLeft && (
                                        <tr>
                                          <td className="p-1.5 font-bold">OS</td>
                                          <td className="p-1.5 text-center">{rx.values.contactLeft.sph}</td>
                                          <td className="p-1.5 text-center">{rx.values.contactLeft.cyl}</td>
                                          <td className="p-1.5 text-center">{rx.values.contactLeft.axis}°</td>
                                          <td className="p-1.5 text-center">{rx.values.contactLeft.bc}</td>
                                          <td className="p-1.5 text-center">{rx.values.contactLeft.dia}</td>
                                          <td className="p-1.5 text-center">{rx.values.contactLeft.boxes}</td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                </div>
                              )}

                              {hasRxValues && rx && rx.type === 'manual' && rx.values?.kind !== 'contact_lenses' && rx.rightEye && (
                                <div className="space-y-1 overflow-x-auto">
                                  <table className="w-full text-[11px] font-mono-num border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E]">
                                    <thead className="bg-stone-100 dark:bg-zinc-800 font-bold">
                                      <tr>
                                        <th className="p-1.5 text-start">{t('العين', 'Eye')}</th>
                                        <th className="p-1.5">SPH</th>
                                        <th className="p-1.5">CYL</th>
                                        <th className="p-1.5">AXIS</th>
                                        <th className="p-1.5">ADD</th>
                                      </tr>
                                    </thead>
                                    <tbody className="divide-y divide-stone-100 dark:divide-zinc-800">
                                      <tr>
                                        <td className="p-1.5 font-bold">OD ({t('يمين', 'Right')})</td>
                                        <td className="p-1.5 text-center">{rx.rightEye.sph}</td>
                                        <td className="p-1.5 text-center">{rx.rightEye.cyl}</td>
                                        <td className="p-1.5 text-center">{rx.rightEye.axis}°</td>
                                        <td className="p-1.5 text-center">{rx.rightEye.add || '—'}</td>
                                      </tr>
                                      {rx.leftEye && (
                                        <tr>
                                          <td className="p-1.5 font-bold">OS ({t('يسار', 'Left')})</td>
                                          <td className="p-1.5 text-center">{rx.leftEye.sph}</td>
                                          <td className="p-1.5 text-center">{rx.leftEye.cyl}</td>
                                          <td className="p-1.5 text-center">{rx.leftEye.axis}°</td>
                                          <td className="p-1.5 text-center">{rx.leftEye.add || '—'}</td>
                                        </tr>
                                      )}
                                    </tbody>
                                  </table>
                                  {(pdSingle || pdRight) && (
                                    <div className="font-mono-num text-[11px]">
                                      PD:{' '}
                                      <strong>
                                        {pdMode === 'dual' && pdRight
                                          ? `OD ${pdRight} mm / OS ${pdLeft} mm`
                                          : `${pdSingle} mm`}
                                      </strong>
                                    </div>
                                  )}
                                  {fittingH && (
                                    <div className="font-mono-num text-[11px]">
                                      {t('ارتفاع التركيب (Fitting Height):', 'Fitting Height:')}{' '}
                                      <strong>{fittingH} mm</strong>
                                    </div>
                                  )}
                                </div>
                              )}

                              {hasRxValues && rx && rx.type === 'image' && rx.imageUrl && (
                                <div className="flex flex-wrap items-center gap-3">
                                  <button
                                    type="button"
                                    onClick={() => setLightboxImage(rx.imageUrl || null)}
                                    className="rounded-lg overflow-hidden border border-stone-200 dark:border-zinc-700"
                                  >
                                    <img
                                      src={rx.imageUrl}
                                      alt="Rx"
                                      className="h-20 w-28 object-cover"
                                    />
                                  </button>
                                  <div className="flex flex-wrap gap-2">
                                    <button
                                      type="button"
                                      onClick={() => setLightboxImage(rx.imageUrl || null)}
                                      className="px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E] font-bold"
                                    >
                                      {t('تكبير الروشتة', 'Enlarge Rx')}
                                    </button>
                                    <a
                                      href={rx.imageUrl}
                                      download={`rx-${order.id}.jpg`}
                                      target="_blank"
                                      rel="noopener noreferrer"
                                      className="px-2.5 py-1.5 rounded-lg bg-[#11223E] text-white font-bold inline-flex items-center gap-1"
                                    >
                                      <Download className="w-3.5 h-3.5" />
                                      {t('تحميل الصورة', 'Download')}
                                    </a>
                                  </div>
                                </div>
                              )}

                              {hasRxValues && rx && rx.type === 'later' && (
                                <span className="inline-block px-2.5 py-1 rounded bg-emerald-100 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 font-bold text-[11px]">
                                  {t('سيرسل العميل المقاس عبر الواتساب', 'Customer will send Rx via WhatsApp')}
                                </span>
                              )}

                              {rx && rx.type === 'none' && (
                                <span className="inline-block text-[11px] text-stone-500 dark:text-zinc-400">
                                  {t('مواصفات العدسات مختارة بدون إدخال مقاس نظر', 'Lens options selected without Rx entry')}
                                </span>
                              )}

                              {rx?.notes && (
                                <div className="text-[11px] text-stone-600 dark:text-zinc-400">
                                  <strong>{t('ملاحظات العميل:', 'Notes:')}</strong> {rx.notes}
                                </div>
                              )}
                            </div>
                          ) : (
                            <span className="inline-block px-2 py-0.5 rounded bg-stone-200/80 dark:bg-zinc-800 text-stone-600 dark:text-zinc-300 text-[10px] font-bold">
                              {t('بدون مقاس نظر', 'No Prescription')}
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>
          );
        })
      )}

      {/* Fullscreen Rx / Receipt Image Lightbox */}
      {lightboxImage && (
        <div
          className="fixed inset-0 z-[80] bg-black/85 flex flex-col items-center justify-center p-4"
          onClick={() => setLightboxImage(null)}
        >
          <div
            className="max-w-3xl w-full flex justify-between items-center mb-3 text-white"
            onClick={(e) => e.stopPropagation()}
          >
            <a
              href={lightboxImage}
              download="vision-plus-image.jpg"
              target="_blank"
              rel="noopener noreferrer"
              className="min-h-[44px] px-4 rounded-xl bg-white/15 hover:bg-white/25 text-xs font-bold inline-flex items-center gap-1.5"
            >
              <Download className="w-4 h-4" />
              {t('تحميل الصورة', 'Download')}
            </a>
            <button
              type="button"
              onClick={() => setLightboxImage(null)}
              className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl bg-white/15 hover:bg-white/25"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
          <img
            src={lightboxImage}
            alt="Zoomed preview"
            className="max-h-[82vh] max-w-full rounded-xl object-contain"
            onClick={(e) => e.stopPropagation()}
          />
        </div>
      )}

      {confirmBankAction && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181B1E] rounded-2xl max-w-sm w-full p-5 space-y-4 border border-stone-200 dark:border-zinc-800 shadow-xl">
            <div className="flex items-center gap-2 font-bold text-sm">
              <AlertTriangle className="w-5 h-5 text-amber-600" />
              {confirmBankAction.action === 'approve'
                ? t('تأكيد اعتماد تحويل بنكك', 'Confirm Bankak Approval')
                : t('تأكيد رفض الإيصال', 'Confirm Receipt Rejection')}
            </div>
            <p className="text-slate-600 dark:text-slate-400">
              {confirmBankAction.action === 'approve'
                ? t('سيتم تأكيد الطلب وإرسال إشعار للعميل.', 'Order will be confirmed and customer notified.')
                : t('سيتم إلغاء الطلب وإرسال إشعار للعميل.', 'Order will be cancelled and customer notified.')}
            </p>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setConfirmBankAction(null)} className="px-3 py-1.5 rounded-lg border font-bold">
                {t('إلغاء', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (confirmBankAction.action === 'approve') {
                    approveBankTransfer(confirmBankAction.orderId);
                  } else {
                    rejectBankTransfer(confirmBankAction.orderId);
                  }
                  setConfirmBankAction(null);
                }}
                className={`px-4 py-1.5 rounded-lg text-white font-bold ${
                  confirmBankAction.action === 'approve' ? 'bg-emerald-700' : 'bg-rose-600'
                }`}
              >
                {t('تأكيد', 'Confirm')}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Confirm Cancellation Approve / Reject Modal */}
      {cancelReviewModal && (
        <div className="fixed inset-0 z-50 bg-black/55 flex items-center justify-center p-4">
          <form
            onSubmit={handleConfirmCancelReview}
            className="bg-white dark:bg-[#181B1E] rounded-2xl max-w-md w-full p-5 space-y-4 border border-stone-200 dark:border-zinc-800 shadow-2xl"
          >
            <div className="flex items-center gap-2 font-extrabold text-sm">
              <AlertTriangle
                className={`w-5 h-5 ${
                  cancelReviewModal.action === 'approve' ? 'text-emerald-600' : 'text-rose-600'
                }`}
              />
              <span>
                {cancelReviewModal.action === 'approve'
                  ? t('تأكيد الموافقة على إلغاء الطلب', 'Confirm Approve Cancellation')
                  : t('تأكيد رفض طلب الإلغاء', 'Confirm Reject Cancellation')}
              </span>
            </div>

            <div className="p-3 rounded-xl bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 space-y-1 text-[11px]">
              <div className="font-mono-num font-bold">#{cancelReviewModal.order.id}</div>
              <div>
                <strong>{t('سبب العميل:', 'Reason:')}</strong>{' '}
                {cancelReviewModal.order.cancelRequest?.reason}
              </div>
              {cancelReviewModal.order.cancelRequest?.note && (
                <div>
                  <strong>{t('ملاحظة:', 'Note:')}</strong>{' '}
                  {cancelReviewModal.order.cancelRequest.note}
                </div>
              )}
            </div>

            {cancelReviewModal.action === 'approve' ? (
              <p className="text-slate-600 dark:text-slate-400">
                {t(
                  'سيتم تحويل حالة الطلب إلى "ملغي"، وإعادة الكميات للمخزون تلقائياً، وإرسال إشعار للعميل.',
                  'Order will be marked cancelled, product stock restored automatically, and customer notified.'
                )}
              </p>
            ) : (
              <p className="text-slate-600 dark:text-slate-400">
                {t(
                  'سيبقى الطلب في حالته الحالية ويستمر تجهيزه، وسيصل سبب الرفض للعميل في الإشعارات وتفاصيل الطلب.',
                  'Order will stay in its current status and the rejection reason will be shown to the customer.'
                )}
              </p>
            )}

            <div className="space-y-1">
              <label className="block font-bold">
                {cancelReviewModal.action === 'reject'
                  ? t('سبب الرفض (مطلوب) *', 'Rejection Reason (required) *')
                  : t('ملاحظة الإدارة للعميل (اختياري)', 'Admin Note to Customer (optional)')}
              </label>
              <textarea
                rows={3}
                required={cancelReviewModal.action === 'reject'}
                value={cancelAdminNote}
                onChange={(e) => {
                  setCancelAdminNote(e.target.value);
                  setCancelReviewError(null);
                }}
                placeholder={
                  cancelReviewModal.action === 'reject'
                    ? t('اكتب سبب رفض طلب الإلغاء بوضوح...', 'Write rejection reason clearly...')
                    : t('ملاحظة اختيارية للعميل...', 'Optional note...')
                }
                className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900"
              />
            </div>

            {cancelReviewError && (
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold">
                {cancelReviewError}
              </div>
            )}

              <div className="flex justify-end gap-2">
                <button
                  type="button"
                  disabled={submittingCancelReview}
                  onClick={() => setCancelReviewModal(null)}
                  className="min-h-[40px] px-4 py-1.5 rounded-lg border font-bold disabled:opacity-50"
                >
                  {t('تراجع', 'Cancel')}
                </button>
                <button
                  type="submit"
                  disabled={
                    submittingCancelReview ||
                    (cancelReviewModal.action === 'reject' && !cancelAdminNote.trim())
                  }
                  className={`min-h-[40px] px-4 py-1.5 rounded-lg text-white font-extrabold disabled:opacity-50 ${
                    cancelReviewModal.action === 'approve' ? 'bg-emerald-700' : 'bg-rose-600'
                  }`}
                >
                  {submittingCancelReview
                    ? t('جارٍ التنفيذ...', 'Processing...')
                    : cancelReviewModal.action === 'approve'
                    ? t('الموافقة على الإلغاء', 'Approve Cancellation')
                    : t('رفض الطلب', 'Reject Request')}
                </button>
              </div>
          </form>
        </div>
      )}

      {/* Admin Edit Order Modal */}
      {editOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <form
            onSubmit={handleConfirmAdminEdit}
            className="bg-white dark:bg-[#181B1E] rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 space-y-4 border border-stone-200 dark:border-zinc-800 shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-zinc-800 pb-3">
              <div>
                <h3 className="text-base font-extrabold text-[#11223E] dark:text-white">
                  {t('تعديل الطلب إدارياً', 'Admin Edit Order')}
                </h3>
                <p className="text-[11px] text-slate-500 font-mono-num">
                  #{editOrder.id} · {getOrderStatusLabel(editOrder.status, locale)}
                </p>
              </div>
              <button
                type="button"
                onClick={() => !savingAdminEdit && setEditOrder(null)}
                aria-label={t('إغلاق', 'Close')}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-stone-100 dark:hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block font-bold">{t('اسم العميل / المستلم *', 'Customer Name *')}</label>
                <input
                  required
                  maxLength={120}
                  value={adminEditName}
                  onChange={(e) => setAdminEditName(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900"
                />
              </div>
              <div className="space-y-1">
                <label className="block font-bold">{t('رقم الهاتف *', 'Phone *')}</label>
                <input
                  required
                  dir="ltr"
                  maxLength={32}
                  value={adminEditPhone}
                  onChange={(e) => setAdminEditPhone(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 font-mono-num"
                />
              </div>
              <div className="space-y-1">
                <label className="block font-bold">{t('الولاية', 'State')}</label>
                <select
                  value={adminEditStateId}
                  onChange={(e) => {
                    const nextId = e.target.value;
                    setAdminEditStateId(nextId);
                    const found = settings.deliveryFees.find((st) => st.id === nextId);
                    if (found) setAdminEditDelivery(found.feeSdg);
                  }}
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900"
                >
                  {settings.deliveryFees.map((st) => (
                    <option key={st.id} value={st.id}>
                      {locale === 'ar' ? st.nameAr : st.nameEn}
                    </option>
                  ))}
                </select>
              </div>
              <div className="space-y-1">
                <label className="block font-bold">{t('المدينة *', 'City *')}</label>
                <input
                  required
                  maxLength={80}
                  value={adminEditCity}
                  onChange={(e) => setAdminEditCity(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900"
                />
              </div>
              <div className="space-y-1">
                <label className="block font-bold">{t('المنطقة *', 'Area *')}</label>
                <input
                  required
                  maxLength={120}
                  value={adminEditArea}
                  onChange={(e) => setAdminEditArea(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900"
                />
              </div>
              <div className="space-y-1">
                <label className="block font-bold">{t('طريقة الدفع', 'Payment Method')}</label>
                <select
                  value={adminEditPayment}
                  onChange={(e) => {
                    const nextPm = e.target.value as PaymentMethod;
                    setAdminEditPayment(nextPm);
                    if (nextPm === 'split' && adminEditPayment !== 'split') {
                      setAdminEditBankakPaid(
                        calculateSplitAmounts(adminEditPricing.total, settings).bankakAmount
                      );
                    }
                  }}
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900"
                >
                  <option value="cod">{t('الدفع عند الاستلام', 'Cash on Delivery')}</option>
                  <option value="bankak">{t('تحويل بنكك', 'Bankak Transfer')}</option>
                  <option value="split">{t('دفع مقسّم (بنكك + عند الاستلام)', 'Split (Bankak + COD)')}</option>
                </select>
              </div>
              <div className="space-y-1 sm:col-span-2">
                <label className="block font-bold">{t('العنوان التفصيلي *', 'Street Details *')}</label>
                <input
                  required
                  maxLength={400}
                  value={adminEditDetails}
                  onChange={(e) => setAdminEditDetails(e.target.value)}
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900"
                />
              </div>
            </div>

            {(adminEditPayment === 'bankak' || adminEditPayment === 'split') && (
              <div className="grid sm:grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="block font-bold">{t('رقم مرجع بنكك', 'Bankak Reference')}</label>
                  <input
                    dir="ltr"
                    maxLength={120}
                    value={adminEditBankRef}
                    onChange={(e) => setAdminEditBankRef(e.target.value)}
                    className="w-full min-h-[40px] px-3 py-1.5 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 font-mono-num"
                  />
                </div>
                {adminEditPayment === 'split' && (
                  <div className="space-y-1">
                    <label className="block font-bold">
                      {t('المدفوع عبر بنكك (ج.س)', 'Bankak Deposit Amount (SDG)')}
                    </label>
                    <input
                      type="number"
                      min={0}
                      max={adminEditPricing.total}
                      value={adminEditBankakPaid}
                      onChange={(e) =>
                        setAdminEditBankakPaid(
                          Math.min(adminEditPricing.total, Math.max(0, Number(e.target.value) || 0))
                        )
                      }
                      className="w-full min-h-[40px] px-3 py-1.5 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 font-mono-num"
                    />
                    <div className="text-[11px] text-emerald-700 dark:text-emerald-400 font-bold">
                      {t('المتبقي عند الاستلام:', 'Remaining COD:')}{' '}
                      {formatSdg(
                        Math.max(0, adminEditPricing.total - Math.min(adminEditPricing.total, Math.max(0, adminEditBankakPaid || 0)))
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Order Items Management */}
            <div className="space-y-2.5 pt-2 border-t border-stone-100 dark:border-zinc-800">
              <div className="font-extrabold text-sm">{t('منتجات الطلب', 'Order Items')}</div>
              <div className="space-y-2">
                {adminEditItems.map((it, idx) => (
                  <div
                    key={`${it.productId}_${idx}`}
                    className="p-2.5 rounded-lg bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2"
                  >
                    <div className="min-w-0 flex-1">
                      <div className="font-bold truncate">{locale === 'ar' ? it.titleAr : it.titleEn}</div>
                      <div className="text-[11px] text-slate-500">
                        {t('العدسات:', 'Lens:')} {formatSdg(it.lensExtraPriceSdg ?? it.prescription?.lensExtraPriceSdg ?? 0)}
                      </div>
                    </div>

                    <div className="flex flex-wrap items-center gap-2">
                      <input
                        type="number"
                        min={0}
                        value={it.unitPriceSdg}
                        onChange={(e) => {
                          const val = Math.max(0, Number(e.target.value) || 0);
                          setAdminEditItems((prev) =>
                            prev.map((row, rIdx) => (rIdx === idx ? { ...row, unitPriceSdg: val } : row))
                          );
                        }}
                        aria-label={t('سعر الوحدة', 'Unit Price')}
                        className="w-24 min-h-[36px] px-2 py-1 rounded border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E] font-mono-num"
                      />

                      <div className="inline-flex items-center border border-stone-200 dark:border-zinc-700 rounded bg-white dark:bg-[#181B1E]">
                        <button
                          type="button"
                          disabled={it.quantity <= 1}
                          onClick={() =>
                            setAdminEditItems((prev) =>
                              prev.map((row, rIdx) =>
                                rIdx === idx ? { ...row, quantity: Math.max(1, row.quantity - 1) } : row
                              )
                            )
                          }
                          className="min-h-[36px] min-w-[32px] flex items-center justify-center disabled:opacity-40"
                        >
                          <Minus className="w-3 h-3" />
                        </button>
                        <span className="px-2 font-mono-num font-bold">{it.quantity}</span>
                        <button
                          type="button"
                          onClick={() =>
                            setAdminEditItems((prev) =>
                              prev.map((row, rIdx) =>
                                rIdx === idx ? { ...row, quantity: Math.min(99, row.quantity + 1) } : row
                              )
                            )
                          }
                          className="min-h-[36px] min-w-[32px] flex items-center justify-center"
                        >
                          <Plus className="w-3 h-3" />
                        </button>
                      </div>

                      {adminEditItems.length > 1 && (
                        <button
                          type="button"
                          onClick={() =>
                            setAdminEditItems((prev) => prev.filter((_, rIdx) => rIdx !== idx))
                          }
                          aria-label={t('حذف', 'Remove')}
                          className="min-h-[36px] min-w-[36px] flex items-center justify-center text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30 rounded"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                        </button>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              {/* Add Product from Catalog */}
              <div className="flex flex-wrap gap-2">
                <select
                  value={addProductId}
                  onChange={(e) => setAddProductId(e.target.value)}
                  className="flex-1 min-w-[180px] min-h-[40px] px-3 py-1.5 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900"
                >
                  <option value="">{t('— إضافة منتج للطلب —', '— Add product to order —')}</option>
                  {products
                    .filter((p) => !p.isDeleted)
                    .map((p) => (
                      <option key={p.id} value={p.id}>
                        {locale === 'ar' ? p.titleAr : p.titleEn} ({formatSdg(p.priceSdg)})
                      </option>
                    ))}
                </select>
                <button
                  type="button"
                  disabled={!addProductId}
                  onClick={handleAdminAddItem}
                  className="min-h-[40px] px-3.5 py-1.5 rounded-lg bg-[#11223E] text-white font-bold disabled:opacity-40 inline-flex items-center gap-1"
                >
                  <Plus className="w-3.5 h-3.5" />
                  {t('إضافة', 'Add')}
                </button>
              </div>
            </div>

            {/* Pricing Overrides & Admin Note */}
            <div className="grid sm:grid-cols-2 gap-3 pt-2 border-t border-stone-100 dark:border-zinc-800">
              <div className="space-y-1">
                <label className="block font-bold">{t('الخصم (ج.س)', 'Discount (SDG)')}</label>
                <input
                  type="number"
                  min={0}
                  value={adminEditDiscount}
                  onChange={(e) => setAdminEditDiscount(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 font-mono-num"
                />
              </div>
              <div className="space-y-1">
                <label className="block font-bold">{t('رسوم التوصيل (ج.س)', 'Delivery Fee (SDG)')}</label>
                <input
                  type="number"
                  min={0}
                  value={adminEditDelivery}
                  onChange={(e) => setAdminEditDelivery(Math.max(0, Number(e.target.value) || 0))}
                  className="w-full min-h-[40px] px-3 py-1.5 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 font-mono-num"
                />
              </div>
            </div>

            <div className="p-3 rounded-xl bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-2 text-xs">
              <span>{t('الإجمالي الجديد بعد التعديل:', 'Updated Order Total:')}</span>
              <span className="font-mono-num text-base font-extrabold text-[#11223E] dark:text-[#E2BD5B]">
                {formatSdg(adminEditPricing.total)}
              </span>
            </div>

            <div className="space-y-1">
              <label className="block font-bold">
                {t('ملاحظة الإدارة للعميل (ستظهر في الطلب والإشعارات)', 'Admin Note (visible to customer)')}
              </label>
              <textarea
                rows={2}
                maxLength={600}
                value={adminEditNote}
                onChange={(e) => setAdminEditNote(e.target.value)}
                placeholder={t('اكتب توضيحاً للتعديل ليظهر للعميل...', 'Explain edit for customer...')}
                className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900"
              />
            </div>

            {adminEditError && (
              <div className="p-2.5 rounded-lg bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold">
                {adminEditError}
              </div>
            )}

            <div className="flex justify-end gap-2 pt-2 border-t border-stone-100 dark:border-zinc-800">
              <button
                type="button"
                disabled={savingAdminEdit}
                onClick={() => setEditOrder(null)}
                className="min-h-[40px] px-4 py-1.5 rounded-lg border font-bold disabled:opacity-50"
              >
                {t('إلغاء', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={savingAdminEdit}
                className="min-h-[40px] px-5 py-1.5 rounded-lg bg-[#11223E] text-white font-extrabold disabled:opacity-50"
              >
                {savingAdminEdit ? t('جارٍ الحفظ...', 'Saving...') : t('حفظ وإشعار العميل', 'Save & Notify Customer')}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
};

export const AdminCouponsModule: React.FC = () => {
  const { t, coupons, upsertCoupon, deleteCoupon } = useStore();
  const [confirmDeleteCode, setConfirmDeleteCode] = useState<string | null>(null);
  const [code, setCode] = useState('');
  const [type, setType] = useState<'percent' | 'fixed'>('percent');
  const [value, setValue] = useState('15');
  const [minSub, setMinSub] = useState('20000');
  const [limit, setLimit] = useState('100');
  const [expiry, setExpiry] = useState('2027-12-31');

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!code.trim()) return;
    upsertCoupon({
      code: code.trim().toUpperCase(),
      type,
      value: Math.max(1, Number(value) || 10),
      minSubtotalSdg: Math.max(0, Number(minSub) || 0),
      usageLimit: Math.max(1, Number(limit) || 100),
      usedCount: 0,
      isActive: true,
      expiryDate: expiry,
    });
    setCode('');
  };

  return (
    <div className="grid lg:grid-cols-12 gap-6 items-start text-xs">
      <form
        onSubmit={handleAdd}
        className="lg:col-span-5 bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-5 space-y-3"
      >
        <h2 className="text-base font-bold">{t('إنشاء كود خصم جديد', 'Create Coupon')}</h2>
        <input
          required
          value={code}
          onChange={(e) => setCode(e.target.value.toUpperCase())}
          placeholder="VISION20"
          className="w-full px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900 font-mono-num"
        />
        <div className="grid grid-cols-2 gap-2">
          <select value={type} onChange={(e) => setType(e.target.value as 'percent' | 'fixed')} className="px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900">
            <option value="percent">{t('نسبة مئوية %', 'Percentage %')}</option>
            <option value="fixed">{t('مبلغ ثابت (ج.س)', 'Fixed Amount (SDG)')}</option>
          </select>
          <input type="number" value={value} onChange={(e) => setValue(e.target.value)} placeholder={t('القيمة', 'Value')} className="px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900 font-mono-num" />
        </div>
        <div className="grid grid-cols-3 gap-2">
          <div>
            <label className="block text-[11px] mb-0.5">{t('الحد الأدنى (ج.س)', 'Min Order')}</label>
            <input type="number" value={minSub} onChange={(e) => setMinSub(e.target.value)} className="w-full px-2 py-1.5 rounded border bg-stone-50 dark:bg-zinc-900 font-mono-num" />
          </div>
          <div>
            <label className="block text-[11px] mb-0.5">{t('حد الاستخدام', 'Usage Limit')}</label>
            <input type="number" value={limit} onChange={(e) => setLimit(e.target.value)} className="w-full px-2 py-1.5 rounded border bg-stone-50 dark:bg-zinc-900 font-mono-num" />
          </div>
          <div>
            <label className="block text-[11px] mb-0.5">{t('الانتهاء', 'Expiry')}</label>
            <input type="date" value={expiry} onChange={(e) => setExpiry(e.target.value)} className="w-full px-2 py-1.5 rounded border bg-stone-50 dark:bg-zinc-900 font-mono-num" />
          </div>
        </div>
        <button type="submit" className="w-full py-2.5 rounded-xl bg-[#D9B24C] text-[#11223E] font-extrabold inline-flex items-center justify-center gap-1">
          <Plus className="w-4 h-4" />
          {t('حفظ الكوبون', 'Save Coupon')}
        </button>
      </form>

      <div className="lg:col-span-7 bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl divide-y divide-stone-100 dark:divide-zinc-800">
        {coupons.map((c) => (
          <div key={c.code} className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-mono-num font-extrabold text-sm">{c.code}</div>
              <div className="text-slate-500 font-mono-num">
                {c.type === 'percent' ? `${c.value}%` : formatSdg(c.value)} ·{' '}
                {t('الحد الأدنى:', 'Min:')} {formatSdg(c.minSubtotalSdg)} · {c.usedCount}/{c.usageLimit} · {c.expiryDate}
              </div>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => upsertCoupon({ ...c, isActive: !c.isActive })}
                className={`px-2.5 py-1 rounded-lg font-bold ${
                  c.isActive ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {c.isActive ? t('نشط', 'Active') : t('معطل', 'Off')}
              </button>
              <button type="button" onClick={() => setConfirmDeleteCode(c.code)} className="p-1.5 text-rose-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>

      {confirmDeleteCode && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181B1E] rounded-2xl max-w-sm w-full p-5 space-y-4 border border-stone-200 dark:border-zinc-800 shadow-xl">
            <h3 className="font-bold text-sm text-rose-600">
              {t('تأكيد حذف الكوبون', 'Confirm Delete Coupon')}
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              {t(`هل تريد حذف كود الخصم ${confirmDeleteCode}؟`, `Delete coupon ${confirmDeleteCode}?`)}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteCode(null)}
                className="min-h-[40px] px-3.5 py-1.5 rounded-lg border font-bold"
              >
                {t('إلغاء', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteCoupon(confirmDeleteCode);
                  setConfirmDeleteCode(null);
                }}
                className="min-h-[40px] px-4 py-1.5 rounded-lg bg-rose-600 text-white font-bold"
              >
                {t('حذف', 'Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const AdminNotificationsModule: React.FC = () => {
  const { locale, t, notifications, sendBroadcastNotification, showToast } = useStore();
  const [titleAr, setTitleAr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [bodyAr, setBodyAr] = useState('');
  const [bodyEn, setBodyEn] = useState('');
  const [imageUrl, setImageUrl] = useState('');
  const [segment, setSegment] = useState<'all' | 'khartoum' | 'states' | 'vip'>('all');
  const [deepLinkType, setDeepLinkType] = useState<'order' | 'product' | 'category' | 'consult'>('category');
  const [deepLinkId, setDeepLinkId] = useState('frames');

  const handleSend = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleAr.trim() || !bodyAr.trim()) return;
    sendBroadcastNotification({
      titleAr: titleAr.trim(),
      titleEn: titleEn.trim() || titleAr.trim(),
      bodyAr: bodyAr.trim(),
      bodyEn: bodyEn.trim() || bodyAr.trim(),
      imageUrl: imageUrl.trim() || undefined,
      segment,
      deepLinkType,
      deepLinkId,
    });
    setTitleAr('');
    setTitleEn('');
    setBodyAr('');
    setBodyEn('');
    setImageUrl('');
  };

  return (
    <div className="grid lg:grid-cols-12 gap-6 items-start text-xs">
      <form
        onSubmit={handleSend}
        className="lg:col-span-5 bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-5 space-y-3"
      >
        <h2 className="text-base font-bold flex items-center gap-2">
          <Send className="w-4 h-4 text-[#D9B24C]" />
          {t('إرسال إشعار ترويجي للعملاء', 'Send Push Notification')}
        </h2>
        <input required value={titleAr} onChange={(e) => setTitleAr(e.target.value)} placeholder={t('العنوان (عربي)*', 'Title (AR)*')} className="w-full min-h-[44px] px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900" />
        <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} placeholder={t('العنوان (إنجليزي)', 'Title (EN)')} className="w-full min-h-[44px] px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900" />
        <textarea required rows={3} value={bodyAr} onChange={(e) => setBodyAr(e.target.value)} placeholder={t('نص الإشعار (عربي)*', 'Body (AR)*')} className="w-full px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900" />
        <textarea rows={2} value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} placeholder={t('نص الإشعار (إنجليزي)', 'Body (EN)')} className="w-full px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900" />
        <div className="flex flex-wrap items-center gap-2">
          <input
            dir="ltr"
            value={imageUrl}
            onChange={(e) => setImageUrl(e.target.value)}
            placeholder={t('رابط صورة الإشعار (اختياري)', 'Notification image URL (optional)')}
            className="flex-1 min-h-[44px] px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900"
          />
          {imageUrl && (
            <button
              type="button"
              onClick={() => setImageUrl('')}
              className="min-h-[44px] px-3 rounded-lg border text-rose-600 font-bold"
            >
              {t('مسح', 'Clear')}
            </button>
          )}
        </div>
        <div className="grid grid-cols-3 gap-2">
          <select value={segment} onChange={(e) => setSegment(e.target.value as typeof segment)} className="min-h-[44px] px-2 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900">
            <option value="all">{t('كل المستخدمين', 'All Users')}</option>
            <option value="khartoum">{t('الخرطوم', 'Khartoum')}</option>
            <option value="states">{t('الولايات', 'States')}</option>
            <option value="vip">{t('عملاء VIP', 'VIP')}</option>
          </select>
          <select value={deepLinkType} onChange={(e) => setDeepLinkType(e.target.value as typeof deepLinkType)} className="min-h-[44px] px-2 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900">
            <option value="category">{t('تصنيف', 'Category')}</option>
            <option value="product">{t('منتج', 'Product')}</option>
            <option value="consult">{t('استشارة', 'Consult')}</option>
            <option value="order">{t('الطلبات', 'Orders')}</option>
          </select>
          <input value={deepLinkId} onChange={(e) => setDeepLinkId(e.target.value)} placeholder="ID" className="min-h-[44px] px-2 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900 font-mono-num" />
        </div>
        <button type="submit" onClick={() => { if (!titleAr.trim() || !bodyAr.trim()) showToast(t('أدخل العنوان والنص', 'Enter title and body')); }} className="w-full min-h-[44px] py-2.5 rounded-xl bg-[#D9B24C] text-[#11223E] font-extrabold">
          {t('إرسال الإشعار الآن', 'Send Broadcast')}
        </button>
      </form>

      <div className="lg:col-span-7 bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-bold">{t('سجل الإشعارات المرسلة', 'Sent Notifications History')}</h3>
        <div className="divide-y divide-stone-100 dark:divide-zinc-800">
          {notifications.map((n) => (
            <div key={n.id} className="py-3 space-y-1">
              <div className="flex items-center justify-between gap-2">
                <span className="font-bold">{locale === 'ar' ? n.titleAr : n.titleEn}</span>
                <span className="text-[11px] text-slate-500 font-mono-num">
                  {n.segment || 'all'} · {formatShortDate(n.createdAt, locale)}
                </span>
              </div>
              {n.imageUrl && (
                <img src={n.imageUrl} alt="" className="w-24 h-14 object-cover rounded-lg border border-stone-200 dark:border-zinc-700" />
              )}
              <p className="text-slate-600 dark:text-slate-400">{locale === 'ar' ? n.bodyAr : n.bodyEn}</p>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const AdminConsultsModule: React.FC = () => {
  const { t, consults, consultTopics, replyConsult, closeConsult, updateConsultTopics } = useStore();
  const [filter, setFilter] = useState<'all' | 'open' | 'answered' | 'closed'>('all');
  const [replies, setReplies] = useState<Record<string, string>>({});
  const [topicAr, setTopicAr] = useState('');
  const [topicEn, setTopicEn] = useState('');

  const visibleConsults = consults.filter((c) => (filter === 'all' ? true : c.status === filter));

  return (
    <div className="space-y-6 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        {(['all', 'open', 'answered', 'closed'] as const).map((st) => (
          <button
            key={st}
            type="button"
            onClick={() => setFilter(st)}
            className={`px-3 py-1.5 rounded-lg font-bold ${
              filter === st ? 'bg-[#11223E] text-white' : 'bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800'
            }`}
          >
            {st}
          </button>
        ))}
      </div>

      <div className="space-y-4">
        {visibleConsults.map((c) => (
          <div key={c.id} className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-5 space-y-3">
            <div className="flex items-center justify-between">
              <div>
                <span className="font-bold text-sm">{c.customerName}</span>
                <span className="font-mono-num text-stone-500 ms-2">{c.phone}</span>
                <span className="text-stone-400 ms-2">· {c.topic}</span>
              </div>
              <div className="flex items-center gap-2">
                <span className="font-bold text-[#B38B2D]">{c.status}</span>
                {c.status !== 'closed' && (
                  <button type="button" onClick={() => closeConsult(c.id)} className="px-2.5 py-1 rounded border">
                    {t('إغلاق التذكرة', 'Close')}
                  </button>
                )}
              </div>
            </div>
            <div className="space-y-2">
              {c.messages.map((m) => (
                <div key={m.id} className="p-2.5 rounded-lg bg-stone-50 dark:bg-zinc-900">
                  <span className="font-bold">{m.senderName}: </span>
                  <span>{m.text}</span>
                </div>
              ))}
            </div>
            {c.status !== 'closed' && (
              <div className="flex gap-2">
                <input
                  value={replies[c.id] || ''}
                  onChange={(e) => setReplies((prev) => ({ ...prev, [c.id]: e.target.value }))}
                  placeholder={t('اكتب رد أخصائي البصريات...', 'Optician reply...')}
                  className="flex-1 px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900"
                />
                <button
                  type="button"
                  onClick={() => {
                    const txt = (replies[c.id] || '').trim();
                    if (!txt) return;
                    replyConsult(c.id, txt, 'optician');
                    setReplies((prev) => ({ ...prev, [c.id]: '' }));
                  }}
                  className="px-4 py-2 rounded-lg bg-[#11223E] text-white font-bold"
                >
                  {t('إرسال الرد', 'Reply')}
                </button>
              </div>
            )}
          </div>
        ))}
      </div>

      {/* Consult Topics Editor */}
      <div className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-5 space-y-3">
        <h3 className="text-sm font-bold">{t('تعديل مواضيع الاستشارة الظاهرة للعملاء', 'Manage Consult Topics')}</h3>
        <div className="flex flex-wrap gap-2">
          {consultTopics.map((tp, idx) => (
            <div key={tp.id} className="px-3 py-1.5 rounded-lg bg-stone-50 dark:bg-zinc-900 border flex items-center gap-2">
              <span>{tp.labelAr}</span>
              <button
                type="button"
                onClick={() =>
                  updateConsultTopics(consultTopics.map((it, i) => (i === idx ? { ...it, visible: !it.visible } : it)))
                }
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  tp.visible ? 'bg-emerald-600 text-white' : 'bg-slate-300 text-slate-700'
                }`}
              >
                {tp.visible ? t('ظاهر', 'On') : t('مخفي', 'Off')}
              </button>
            </div>
          ))}
        </div>
        <div className="grid sm:grid-cols-3 gap-2 pt-2">
          <input value={topicAr} onChange={(e) => setTopicAr(e.target.value)} placeholder={t('موضوع جديد (عربي)', 'New Topic (AR)')} className="px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900" />
          <input value={topicEn} onChange={(e) => setTopicEn(e.target.value)} placeholder={t('موضوع جديد (إنجليزي)', 'New Topic (EN)')} className="px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900" />
          <button
            type="button"
            onClick={() => {
              if (!topicAr.trim()) return;
              updateConsultTopics([
                ...consultTopics,
                { id: `topic_${Date.now()}`, labelAr: topicAr.trim(), labelEn: topicEn.trim() || topicAr.trim(), visible: true },
              ]);
              setTopicAr('');
              setTopicEn('');
            }}
            className="px-4 py-2 rounded-lg bg-[#D9B24C] text-[#11223E] font-extrabold"
          >
            {t('إضافة موضوع', 'Add Topic')}
          </button>
        </div>
      </div>
    </div>
  );
};

export const AdminCustomersReviewsModule: React.FC = () => {
  const { locale, t, directoryUsers, orders, products, toggleBlockUser, moderateReview } = useStore();
  const customers = directoryUsers.filter((u) => u.role === 'customer');
  const allReviews = products.flatMap((p) =>
    p.reviews.map((r) => ({ ...r, productTitle: locale === 'ar' ? p.titleAr : p.titleEn, productId: p.id }))
  );

  return (
    <div className="space-y-6 text-xs">
      <div className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-5 space-y-3">
        <h2 className="text-base font-bold">{t('قائمة العملاء والطلبات والحظر', 'Customers Directory')}</h2>
        <div className="divide-y divide-stone-100 dark:divide-zinc-800">
          {customers.map((c) => {
            const custOrders = orders.filter((o) => o.customerUid === c.uid);
            const totalSpent = custOrders.reduce((s, o) => s + o.totalSdg, 0);
            return (
              <div key={c.uid} className="py-3 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-sm">{c.name}</div>
                  <div className="text-slate-500 font-mono-num">
                    {c.phone} · {c.email} · {custOrders.length} {t('طلبات', 'orders')} · {formatSdg(totalSpent)}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => toggleBlockUser(c.uid)}
                  className={`px-3 py-1.5 rounded-lg font-bold inline-flex items-center gap-1 ${
                    c.isBlocked ? 'bg-emerald-600 text-white' : 'bg-rose-600 text-white'
                  }`}
                >
                  <Ban className="w-3.5 h-3.5" />
                  {c.isBlocked ? t('إلغاء الحظر', 'Unblock') : t('حظر العميل', 'Block')}
                </button>
              </div>
            );
          })}
        </div>
      </div>

      <div className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-5 space-y-3">
        <h2 className="text-base font-bold flex items-center gap-2">
          <Star className="w-4 h-4 text-[#D9B24C]" />
          {t('مراجعة تقييمات العملاء', 'Review Moderation')}
        </h2>
        <div className="divide-y divide-stone-100 dark:divide-zinc-800">
          {allReviews.map((r) => (
            <div key={r.id} className="py-3 flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-bold">
                  {r.userName} · <span className="text-slate-500">{r.productTitle}</span> · {r.rating}/5
                </div>
                <p className="text-slate-600 dark:text-slate-400">{r.comment}</p>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() =>
                    moderateReview(r.productId, r.id, r.status === 'approved' ? 'hidden' : 'approved')
                  }
                  className={`px-2.5 py-1 rounded-lg font-bold inline-flex items-center gap-1 ${
                    r.status === 'approved' ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-700'
                  }`}
                >
                  {r.status === 'approved' ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  {r.status === 'approved' ? t('معتمد', 'Approved') : t('مخفي', 'Hidden')}
                </button>
                <button
                  type="button"
                  onClick={() => moderateReview(r.productId, r.id, 'delete')}
                  className="p-1.5 text-rose-600"
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

export const AdminRolesModule: React.FC = () => {
  const { t, user, directoryUsers, addOrUpdateAdminByEmail, removeAdminRole } = useStore();
  const { requireSensitiveReauth } = useAdminSecurity();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'staff'>('admin');
  const [submitting, setSubmitting] = useState(false);
  const [feedback, setFeedback] = useState<{ type: 'error' | 'success'; text: string } | null>(null);

  const adminsAndStaff = directoryUsers.filter((u) => u.role === 'admin' || u.role === 'staff');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    const cleanEmail = email.trim();
    if (!cleanEmail) return;
    setFeedback(null);

    requireSensitiveReauth(
      t('تأكيد تعديل صلاحيات الإدارة', 'Confirm Admin Role Update'),
      async () => {
        setSubmitting(true);
        try {
          const res = await addOrUpdateAdminByEmail(cleanEmail, role);
          if (!res.ok) {
            setFeedback({
              type: 'error',
              text: res.error || t('تعذر تحديث الصلاحيات', 'Failed to update role'),
            });
            return;
          }
          setFeedback({
            type: 'success',
            text:
              role === 'admin'
                ? t(`تم تعيين ${cleanEmail} كمدير عام`, `${cleanEmail} assigned as Admin`)
                : t(`تم تعيين ${cleanEmail} كموظف للطلبات فقط`, `${cleanEmail} assigned as Staff (Orders only)`),
          });
          setEmail('');
        } finally {
          setSubmitting(false);
        }
      }
    );
  };

  const handleRemove = (targetUid: string, targetEmail: string) => {
    setFeedback(null);
    requireSensitiveReauth(
      t('تأكيد إزالة صلاحية الإدارة', 'Confirm Admin Role Removal'),
      async () => {
        await removeAdminRole(targetUid);
        setFeedback({
          type: 'success',
          text: t(`تمت إزالة صلاحية ${targetEmail}`, `Removed role for ${targetEmail}`),
        });
      }
    );
  };

  return (
    <div className="grid lg:grid-cols-12 gap-6 items-start text-xs">
      <form
        onSubmit={handleSave}
        className="lg:col-span-5 bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-5 space-y-3"
      >
        <h2 className="text-base font-bold flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#D9B24C]" />
          {t('إدارة المديرين والموظفين بالبريد الإلكتروني', 'Manage Admins & Staff by Email')}
        </h2>
        <p className="text-[11px] text-slate-500 leading-relaxed">
          {t(
            'أدخل البريد الإلكتروني لحساب مسجل مسبقاً في المتجر لمنحه صلاحية مدير كامل أو موظف طلبات فقط.',
            'Enter the email of an existing registered user to grant Full Admin or Orders-only Staff access.'
          )}
        </p>

        {feedback && (
          <div
            className={`p-3 rounded-xl font-bold border ${
              feedback.type === 'error'
                ? 'bg-rose-50 dark:bg-rose-950/30 border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300'
                : 'bg-emerald-50 dark:bg-emerald-950/30 border-emerald-200 dark:border-emerald-900/50 text-emerald-700 dark:text-emerald-300'
            }`}
          >
            {feedback.text}
          </div>
        )}

        <div>
          <label className="block font-bold mb-1">{t('البريد الإلكتروني', 'Email Address')}</label>
          <input
            required
            type="email"
            dir="ltr"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            placeholder="admin@visionplus.sd"
            className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-base"
          />
        </div>

        <div>
          <label className="block font-bold mb-1">{t('الدور الوظيفي', 'Role')}</label>
          <select
            value={role}
            onChange={(e) => setRole(e.target.value as 'admin' | 'staff')}
            className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-base"
          >
            <option value="admin">{t('مدير عام (كامل الصلاحيات)', 'Full Admin (All Modules)')}</option>
            <option value="staff">{t('موظف (إدارة الطلبات فقط)', 'Staff (Orders Only)')}</option>
          </select>
        </div>

        <button
          type="submit"
          disabled={submitting}
          className="w-full min-h-[44px] py-2.5 rounded-xl bg-[#D9B24C] text-[#11223E] font-extrabold disabled:opacity-50"
        >
          {submitting ? t('جارٍ الحفظ...', 'Saving...') : t('حفظ الصلاحيات', 'Save Role')}
        </button>
      </form>

      <div className="lg:col-span-7 bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl divide-y divide-stone-100 dark:divide-zinc-800">
        {adminsAndStaff.length === 0 ? (
          <div className="p-6 text-center text-slate-500">
            {t('لا يوجد مشرفون مسجلون حالياً', 'No admin or staff members found')}
          </div>
        ) : (
          adminsAndStaff.map((u) => {
            const isSelf = u.uid === user.uid;
            return (
              <div key={u.uid} className="p-4 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-bold text-sm flex items-center gap-2">
                    <span>{u.name || u.email}</span>
                    {isSelf && (
                      <span className="px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-800 text-[10px] font-bold">
                        {t('حسابك الحالي', 'You')}
                      </span>
                    )}
                  </div>
                  <div className="text-slate-500 font-mono-num text-xs mt-0.5">
                    {u.email} ·{' '}
                    <strong className="uppercase">
                      {u.role === 'admin' ? t('مدير عام', 'ADMIN') : t('موظف طلبات', 'STAFF (ORDERS)')}
                    </strong>
                  </div>
                </div>
                {!isSelf && (
                  <button
                    type="button"
                    onClick={() => handleRemove(u.uid, u.email)}
                    className="min-h-[44px] px-3.5 py-2 rounded-lg bg-rose-50 dark:bg-rose-950/30 text-rose-700 dark:text-rose-300 font-bold hover:bg-rose-100 dark:hover:bg-rose-950/50"
                  >
                    {t('إزالة الصلاحية', 'Remove Role')}
                  </button>
                )}
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
