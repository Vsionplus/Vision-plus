import React, { useMemo, useState } from 'react';
import {
  Check,
  X,
  Printer,
  Trash2,
  Plus,
  Send,
  Shield,
  Ban,
  Eye,
  EyeOff,
  Star,
  AlertTriangle,
} from 'lucide-react';
import { useStore } from '../../store/StoreContext';
import { AppUser, Order, OrderStatus, StaffPermission } from '../../types';
import { formatSdg, formatShortDate, getOrderStatusLabel } from '../../utils/format';

export const AdminOrdersModule: React.FC<{ onPrintInvoice: (order: Order) => void }> = ({
  onPrintInvoice,
}) => {
  const { locale, t, orders, updateOrderStatus, approveBankTransfer, rejectBankTransfer } = useStore();
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [paymentFilter, setPaymentFilter] = useState<string>('all');
  const [confirmBankAction, setConfirmBankAction] = useState<{
    orderId: string;
    action: 'approve' | 'reject';
  } | null>(null);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return orders.filter((o) => {
      if (statusFilter !== 'all' && o.status !== statusFilter) return false;
      if (paymentFilter !== 'all' && o.paymentMethod !== paymentFilter) return false;
      if (q) {
        const hay = `${o.id} ${o.customerName} ${o.customerPhone} ${o.bankTransferReference || ''}`.toLowerCase();
        if (!hay.includes(q)) return false;
      }
      return true;
    });
  }, [orders, search, statusFilter, paymentFilter]);

  return (
    <div className="space-y-4 text-xs">
      <div className="flex flex-wrap items-center gap-2">
        <input
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          placeholder={t('بحث برقم الطلب، العميل، الهاتف، أو مرجع بنكك...', 'Search order ID, customer, phone, Bankak ref...')}
          className="flex-1 min-w-[220px] px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E]"
        />
        <select
          value={statusFilter}
          onChange={(e) => setStatusFilter(e.target.value)}
          className="px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E]"
        >
          <option value="all">{t('كل الحالات', 'All Statuses')}</option>
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
          className="px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E]"
        >
          <option value="all">{t('كل طرق الدفع', 'All Payment Methods')}</option>
          <option value="bankak">{t('بنكك / تحويل بنكي', 'Bankak Transfer')}</option>
          <option value="cod">{t('الدفع عند الاستلام', 'Cash on Delivery')}</option>
        </select>
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-10 text-center text-slate-500">
          {t('لا توجد طلبات مطابقة للبحث', 'No matching orders')}
        </div>
      ) : (
        filtered.map((order) => (
          <div
            key={order.id}
            className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-5 space-y-4"
          >
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div>
                <div className="font-mono-num font-extrabold text-sm">{order.id}</div>
                <div className="text-stone-500 dark:text-zinc-400">
                  {order.customerName} · <span className="font-mono-num">{order.customerPhone}</span> ·{' '}
                  {order.city} ({order.area}) · {formatShortDate(order.createdAt, locale)}
                </div>
              </div>

              <div className="flex flex-wrap items-center gap-2">
                <span className="font-mono-num text-sm font-extrabold text-[#11223E] dark:text-[#E2BD5B] tabular-nums">
                  {formatSdg(order.totalSdg)}
                </span>

                <select
                  value={order.status}
                  onChange={(e) => updateOrderStatus(order.id, e.target.value as OrderStatus)}
                  className="px-2.5 py-1.5 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 font-semibold"
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

                <button
                  type="button"
                  onClick={() => onPrintInvoice(order)}
                  className="px-3 py-1.5 rounded-lg border border-stone-200 dark:border-zinc-700 hover:bg-stone-50 dark:hover:bg-zinc-800 font-semibold inline-flex items-center gap-1"
                >
                  <Printer className="w-3.5 h-3.5" />
                  {t('فاتورة', 'Invoice')}
                </button>
              </div>
            </div>

            {order.paymentMethod === 'bankak' && (
              <div className="p-3 rounded-lg bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3">
                <div>
                  <div className="font-bold">
                    {t('إيصال تحويل بنكك:', 'Bankak Receipt:')}{' '}
                    <span className="font-mono-num">{order.bankTransferReference || '—'}</span>
                  </div>
                  {order.bankTransferReceiptUrl && (
                    <img
                      src={order.bankTransferReceiptUrl}
                      alt="Bankak Receipt"
                      className="mt-2 h-16 rounded border border-stone-200 dark:border-zinc-700 object-cover"
                    />
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

            {order.items.some((i) => i.prescription) && (
              <div className="p-3 rounded-lg bg-amber-50/50 dark:bg-amber-950/15 border border-amber-200 dark:border-amber-900/50 space-y-1">
                <div className="font-bold">{t('الوصفة الطبية المرفقة:', 'Attached Prescriptions:')}</div>
                {order.items.map(
                  (it, idx) =>
                    it.prescription && (
                      <div key={idx} className="font-mono-num text-[11px]">
                        {locale === 'ar' ? it.titleAr : it.titleEn} · {it.prescription.lensOption}{' '}
                        {it.prescription.rightEye
                          ? `| OD ${it.prescription.rightEye.sph}/${it.prescription.rightEye.cyl}×${it.prescription.rightEye.axis} | OS ${it.prescription.leftEye?.sph}/${it.prescription.leftEye?.cyl}×${it.prescription.leftEye?.axis} | PD ${it.prescription.pd}`
                          : ''}
                      </div>
                    )
                )}
              </div>
            )}
          </div>
        ))
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
    </div>
  );
};

export const AdminCouponsModule: React.FC = () => {
  const { t, coupons, upsertCoupon, deleteCoupon } = useStore();
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
              <button type="button" onClick={() => deleteCoupon(c.code)} className="p-1.5 text-rose-600">
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const AdminNotificationsModule: React.FC = () => {
  const { locale, t, notifications, sendBroadcastNotification } = useStore();
  const [titleAr, setTitleAr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [bodyAr, setBodyAr] = useState('');
  const [bodyEn, setBodyEn] = useState('');
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
      segment,
      deepLinkType,
      deepLinkId,
    });
    setTitleAr('');
    setTitleEn('');
    setBodyAr('');
    setBodyEn('');
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
        <input required value={titleAr} onChange={(e) => setTitleAr(e.target.value)} placeholder={t('العنوان (عربي)*', 'Title (AR)*')} className="w-full px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900" />
        <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} placeholder={t('العنوان (إنجليزي)', 'Title (EN)')} className="w-full px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900" />
        <textarea required rows={3} value={bodyAr} onChange={(e) => setBodyAr(e.target.value)} placeholder={t('نص الإشعار (عربي)*', 'Body (AR)*')} className="w-full px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900" />
        <textarea rows={2} value={bodyEn} onChange={(e) => setBodyEn(e.target.value)} placeholder={t('نص الإشعار (إنجليزي)', 'Body (EN)')} className="w-full px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900" />
        <div className="grid grid-cols-3 gap-2">
          <select value={segment} onChange={(e) => setSegment(e.target.value as typeof segment)} className="px-2 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900">
            <option value="all">{t('كل المستخدمين', 'All Users')}</option>
            <option value="khartoum">{t('الخرطوم', 'Khartoum')}</option>
            <option value="states">{t('الولايات', 'States')}</option>
            <option value="vip">{t('عملاء VIP', 'VIP')}</option>
          </select>
          <select value={deepLinkType} onChange={(e) => setDeepLinkType(e.target.value as typeof deepLinkType)} className="px-2 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900">
            <option value="category">{t('تصنيف', 'Category')}</option>
            <option value="product">{t('منتج', 'Product')}</option>
            <option value="consult">{t('استشارة', 'Consult')}</option>
            <option value="order">{t('الطلبات', 'Orders')}</option>
          </select>
          <input value={deepLinkId} onChange={(e) => setDeepLinkId(e.target.value)} placeholder="ID" className="px-2 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900 font-mono-num" />
        </div>
        <button type="submit" className="w-full py-2.5 rounded-xl bg-[#D9B24C] text-[#11223E] font-extrabold">
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
  const { t, directoryUsers, upsertStaffOrAdmin, removeAdminRole } = useStore();
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<'admin' | 'staff'>('staff');
  const [perms, setPerms] = useState<StaffPermission[]>(['dashboard', 'orders', 'consults']);

  const allPerms: { id: StaffPermission; ar: string; en: string }[] = [
    { id: 'dashboard', ar: 'لوحة الإحصائيات', en: 'Dashboard' },
    { id: 'products', ar: 'المنتجات', en: 'Products' },
    { id: 'categories', ar: 'التصنيفات والماركات', en: 'Categories & Brands' },
    { id: 'home_builder', ar: 'منشئ الرئيسية', en: 'Home Builder' },
    { id: 'banners', ar: 'البانرات', en: 'Banners' },
    { id: 'content', ar: 'نصوص التطبيق', en: 'App Content' },
    { id: 'appearance', ar: 'المظهر والألوان', en: 'Appearance' },
    { id: 'settings', ar: 'إعدادات المتجر', en: 'Store Settings' },
    { id: 'orders', ar: 'الطلبات وبنكك', en: 'Orders' },
    { id: 'coupons', ar: 'الكوبونات', en: 'Coupons' },
    { id: 'notifications', ar: 'الإشعارات', en: 'Notifications' },
    { id: 'consults', ar: 'الاستشارات', en: 'Consults' },
    { id: 'customers', ar: 'العملاء والتقييمات', en: 'Customers' },
    { id: 'roles', ar: 'الصلاحيات', en: 'Roles' },
  ];

  const adminsAndStaff = directoryUsers.filter((u) => u.role === 'admin' || u.role === 'staff');

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim() || !email.trim()) return;
    const record: AppUser = {
      uid: `usr_${Date.now()}`,
      name: name.trim(),
      email: email.trim(),
      phone: '+249',
      role,
      permissions: role === 'admin' ? allPerms.map((p) => p.id) : perms,
      isBlocked: false,
      favoriteProductIds: [],
      addresses: [],
      prescriptions: [],
    };
    upsertStaffOrAdmin(record);
    setName('');
    setEmail('');
  };

  return (
    <div className="grid lg:grid-cols-12 gap-6 items-start text-xs">
      <form
        onSubmit={handleSave}
        className="lg:col-span-5 bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-5 space-y-3"
      >
        <h2 className="text-base font-bold flex items-center gap-2">
          <Shield className="w-4 h-4 text-[#D9B24C]" />
          {t('إضافة مسؤول أو موظف بصلاحيات محددة', 'Add Admin / Staff Member')}
        </h2>
        <input required value={name} onChange={(e) => setName(e.target.value)} placeholder={t('الاسم الكامل', 'Full Name')} className="w-full px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900" />
        <input required type="email" dir="ltr" value={email} onChange={(e) => setEmail(e.target.value)} placeholder="staff@visionplus.sd" className="w-full px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900" />
        <select value={role} onChange={(e) => setRole(e.target.value as 'admin' | 'staff')} className="w-full px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900">
          <option value="staff">{t('موظف (صلاحيات محددة)', 'Staff (Scoped Permissions)')}</option>
          <option value="admin">{t('مالك / مدير عام (كامل الصلاحيات)', 'Full Admin')}</option>
        </select>

        {role === 'staff' && (
          <div className="grid grid-cols-2 gap-1.5 pt-2">
            {allPerms.map((p) => (
              <label key={p.id} className="flex items-center gap-1.5 cursor-pointer">
                <input
                  type="checkbox"
                  checked={perms.includes(p.id)}
                  onChange={(e) =>
                    setPerms(e.target.checked ? [...perms, p.id] : perms.filter((x) => x !== p.id))
                  }
                  className="accent-[#D9B24C]"
                />
                <span>{t(p.ar, p.en)}</span>
              </label>
            ))}
          </div>
        )}

        <button type="submit" className="w-full py-2.5 rounded-xl bg-[#D9B24C] text-[#11223E] font-extrabold">
          {t('حفظ الصلاحيات', 'Save Member')}
        </button>
      </form>

      <div className="lg:col-span-7 bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl divide-y divide-stone-100 dark:divide-zinc-800">
        {adminsAndStaff.map((u) => (
          <div key={u.uid} className="p-4 flex flex-wrap items-center justify-between gap-3">
            <div>
              <div className="font-bold text-sm">{u.name}</div>
              <div className="text-slate-500 font-mono-num">
                {u.email} · <strong className="uppercase">{u.role}</strong>
              </div>
            </div>
            {u.email !== 'visionplusvisionstore@gmail.com' && (
              <button
                type="button"
                onClick={() => removeAdminRole(u.uid)}
                className="px-3 py-1.5 rounded-lg bg-rose-50 text-rose-700 font-bold"
              >
                {t('إزالة الصلاحية', 'Revoke')}
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
};
