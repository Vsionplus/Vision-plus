import React, { useMemo, useState } from 'react';
import {
  RotateCcw,
  XCircle,
  Package,
  Lock,
  Clock,
  CheckCircle2,
  MessageCircle,
  X,
  Bell,
  BellRing,
  Check,
  Edit3,
  Plus,
  Minus,
  Trash2,
  Upload,
  Info,
  FileText,
} from 'lucide-react';
import { compressImageFileToBlob } from '../lib/firebase';
import { useStore } from '../store/StoreContext';
import { Order, OrderItem, OrderStatus, PrescriptionData, Product, SavedAddress } from '../types';
import {
  formatSdg,
  formatShortDate,
  getOrderPaymentBreakdown,
  getOrderStatusLabel,
  getPaymentMethodLabel,
  isValidSudanPhone,
  normalizeSudanPhone,
} from '../utils/format';
import {
  formatLensSummaryLine,
  hasCustomLensOrRx,
  isPrescriptionEligibleProduct,
} from '../utils/prescription';
import { ResilientImage } from './ResilientImage';
import { PrescriptionSheet } from './PrescriptionSheet';

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

const FULL_EDIT_STATUSES: OrderStatus[] = ['pending', 'awaiting_payment_verification'];
const CONTACT_EDIT_STATUSES: OrderStatus[] = ['confirmed', 'preparing'];

const CANCEL_REASONS = [
  { ar: 'غيّرت رأيي', en: 'Changed my mind' },
  { ar: 'طلبت بالخطأ', en: 'Ordered by mistake' },
  { ar: 'تأخر التوصيل', en: 'Delivery delay' },
  { ar: 'وجدت سعراً أفضل', en: 'Found a better price' },
  { ar: 'أخرى', en: 'Other' },
];

function getStatusGuidance(status: OrderStatus, locale: 'ar' | 'en'): string {
  const map: Record<OrderStatus, { ar: string; en: string }> = {
    pending: {
      ar: 'طلبك مستلم وفي انتظار المراجعة. يمكنك تعديل المنتجات أو العنوان بحرية قبل التأكيد.',
      en: 'Your order is received and awaiting review. You can edit items or address before confirmation.',
    },
    awaiting_payment_verification: {
      ar: 'نراجع حالياً إيصال تحويل بنكك. يمكنك تحديث الإيصال أو تعديل الطلب حتى يتم الاعتماد.',
      en: 'We are verifying your Bankak transfer receipt. You can still update details before approval.',
    },
    confirmed: {
      ar: 'تم تأكيد طلبك وبدء جدولته. يمكنك تعديل بيانات التواصل وعنوان الشارع قبل الشحن.',
      en: 'Your order is confirmed. You can still update contact and street address details before shipping.',
    },
    preparing: {
      ar: 'يقوم فريق البصريات الآن بتجهيز وفحص نظارتك. لا يزال بإمكانك تعديل العنوان أو رقم الهاتف.',
      en: 'Our opticians are preparing and checking your eyewear. Contact & street details can still be updated.',
    },
    shipped: {
      ar: 'خرج طلبك مع مندوب الشحن وهو في الطريق إليك.',
      en: 'Your order has been handed over to our delivery courier.',
    },
    delivered: {
      ar: 'تم تسليم الطلب بنجاح. نتمنى لك رؤية واضحة ومريحة!',
      en: 'Your order was delivered. Enjoy clear and comfortable vision!',
    },
    cancelled: {
      ar: 'تم إلغاء هذا الطلب ولم يعد قيد التنفيذ.',
      en: 'This order was cancelled and is no longer active.',
    },
  };
  return map[status][locale];
}

export const OrdersView: React.FC = () => {
  const {
    locale,
    t,
    isGuest,
    user,
    orders,
    products,
    notifications,
    markNotificationRead,
    markAllNotificationsRead,
    settings,
    lensOptions,
    appTexts,
    appearance,
    reorder,
    requestOrderCancellation,
    updateOrderByCustomer,
    openCatalog,
  } = useStore();

  const [cancelTargetOrder, setCancelTargetOrder] = useState<Order | null>(null);
  const [selectedReason, setSelectedReason] = useState('');
  const [cancelNote, setCancelNote] = useState('');
  const [confirmCancelAck, setConfirmCancelAck] = useState(false);
  const [cancelError, setCancelError] = useState<string | null>(null);
  const [submittingCancel, setSubmittingCancel] = useState(false);

  // Customer post-order edit modal state
  const [editTargetOrder, setEditTargetOrder] = useState<Order | null>(null);
  const [editName, setEditName] = useState('');
  const [editPhone, setEditPhone] = useState('');
  const [editStateId, setEditStateId] = useState('');
  const [editCity, setEditCity] = useState('');
  const [editArea, setEditArea] = useState('');
  const [editDetails, setEditDetails] = useState('');
  const [editItems, setEditItems] = useState<OrderItem[]>([]);
  const [editBankRef, setEditBankRef] = useState('');
  const [editBankReceiptUrl, setEditBankReceiptUrl] = useState<string | undefined>(undefined);
  const [editNote, setEditNote] = useState('');
  const [editError, setEditError] = useState<string | null>(null);
  const [savingEdit, setSavingEdit] = useState(false);
  const [uploadingReceipt, setUploadingReceipt] = useState(false);
  const [rxEditIndex, setRxEditIndex] = useState<number | null>(null);

  const whatsappDigits = (settings.whatsapp || '').replace(/[^\d]/g, '');

  const orderNotifications = useMemo(
    () =>
      notifications
        .filter((n) => n.deepLinkType === 'order')
        .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    [notifications]
  );

  const unreadOrderNotifications = useMemo(
    () => orderNotifications.filter((n) => !n.isRead),
    [orderNotifications]
  );

  const isFullEditMode = editTargetOrder
    ? FULL_EDIT_STATUSES.includes(editTargetOrder.status)
    : false;

  const editPricing = useMemo(() => {
    if (!editTargetOrder) {
      return { itemsSubtotal: 0, lensTotal: 0, deliveryFee: 0, total: 0 };
    }
    const itemsSubtotal = editItems.reduce((s, it) => s + it.unitPriceSdg * it.quantity, 0);
    const lensTotal = editItems.reduce(
      (s, it) => s + (it.lensExtraPriceSdg ?? it.prescription?.lensExtraPriceSdg ?? 0) * it.quantity,
      0
    );
    const stateObj = settings.deliveryFees.find((st) => st.id === editStateId);
    const deliveryFee = isFullEditMode && stateObj ? stateObj.feeSdg : editTargetOrder.deliveryFeeSdg;
    const total = Math.max(0, itemsSubtotal + lensTotal - editTargetOrder.discountSdg + deliveryFee);
    return { itemsSubtotal, lensTotal, deliveryFee, total };
  }, [editTargetOrder, editItems, editStateId, settings.deliveryFees, isFullEditMode]);

  const openEditDialog = (order: Order) => {
    setEditTargetOrder(order);
    setEditName(order.address?.recipientName || order.customerName);
    setEditPhone(order.address?.phone || order.customerPhone);
    setEditStateId(order.stateId);
    setEditCity(order.address?.city || order.city);
    setEditArea(order.address?.area || order.area);
    setEditDetails(order.address?.details || order.addressDetails);
    setEditItems(order.items.map((it) => ({ ...it })));
    setEditBankRef(order.bankTransferReference || '');
    setEditBankReceiptUrl(order.bankTransferReceiptUrl);
    setEditNote(order.customerNote || '');
    setEditError(null);
    setRxEditIndex(null);
  };

  const closeEditDialog = () => {
    if (savingEdit || uploadingReceipt) return;
    setEditTargetOrder(null);
    setEditError(null);
    setRxEditIndex(null);
  };

  const applySavedAddress = (addr: SavedAddress) => {
    if (addr.recipientName) setEditName(addr.recipientName);
    if (addr.phone) setEditPhone(addr.phone);
    if (isFullEditMode && addr.stateId) {
      setEditStateId(addr.stateId);
    }
    setEditCity(addr.city);
    setEditArea(addr.area);
    setEditDetails(addr.details);
    setEditError(null);
  };

  const handleEditReceiptUpload = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingReceipt(true);
    setEditError(null);
    try {
      const { dataUrl } = await compressImageFileToBlob(file, 1000, 0.78);
      setEditBankReceiptUrl(dataUrl);
    } catch {
      setEditError(
        t('تعذر معالجة صورة الإيصال، يرجى اختيار صورة أخرى.', 'Failed to process receipt image.')
      );
    } finally {
      setUploadingReceipt(false);
    }
  };

  const handleUpdateEditQty = (idx: number, delta: number) => {
    setEditItems((prev) =>
      prev.map((it, i) =>
        i === idx
          ? { ...it, quantity: Math.max(1, Math.min(99, it.quantity + delta)) }
          : it
      )
    );
  };

  const handleRemoveEditItem = (idx: number) => {
    setEditItems((prev) => (prev.length <= 1 ? prev : prev.filter((_, i) => i !== idx)));
  };

  const handleSaveEditRx = (rx: PrescriptionData | undefined) => {
    if (rxEditIndex === null) return;
    setEditItems((prev) =>
      prev.map((it, i) => {
        if (i !== rxEditIndex) return it;
        return {
          ...it,
          prescription: rx,
          lensOption: rx?.lensOption || rx?.visionType || 'none',
          visionType: rx?.visionType,
          extraOptions: rx?.extraOptions,
          mirrorColor: rx?.mirrorColor,
          lensExtraPriceSdg: rx?.lensExtraPriceSdg || 0,
        };
      })
    );
    setRxEditIndex(null);
  };

  const handleSubmitEditOrder = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!editTargetOrder || savingEdit || uploadingReceipt) return;

    if (!editName.trim()) {
      setEditError(t('يرجى إدخال اسم المستلم.', 'Please enter recipient name.'));
      return;
    }
    if (!isValidSudanPhone(editPhone)) {
      setEditError(
        t(
          'يرجى إدخال رقم هاتف سوداني صحيح (مثال: 0912345678).',
          'Please enter a valid Sudan phone number.'
        )
      );
      return;
    }
    if (!editCity.trim() || !editArea.trim() || !editDetails.trim()) {
      setEditError(
        t(
          'يرجى إكمال بيانات المدينة والمنطقة والشارع.',
          'Please complete city, area, and street details.'
        )
      );
      return;
    }
    if (editItems.length === 0) {
      setEditError(t('يجب أن يحتوي الطلب على منتج واحد على الأقل.', 'At least one item is required.'));
      return;
    }

    const normalizedPhone = normalizeSudanPhone(editPhone);
    const stateObj = settings.deliveryFees.find((st) => st.id === editStateId);

    setEditError(null);
    setSavingEdit(true);
    try {
      await updateOrderByCustomer(editTargetOrder.id, {
        customerName: editName.trim(),
        customerPhone: normalizedPhone,
        stateId: editStateId,
        city: editCity.trim(),
        area: editArea.trim(),
        addressDetails: editDetails.trim(),
        address: {
          recipientName: editName.trim(),
          phone: normalizedPhone,
          stateId: editStateId,
          stateNameAr: stateObj?.nameAr || editTargetOrder.address?.stateNameAr || editStateId,
          stateNameEn: stateObj?.nameEn || editTargetOrder.address?.stateNameEn || editStateId,
          city: editCity.trim(),
          area: editArea.trim(),
          details: editDetails.trim(),
          label: editTargetOrder.address?.label,
          mapUrl: editTargetOrder.address?.mapUrl,
        },
        items: isFullEditMode ? editItems : undefined,
        bankTransferReference:
          isFullEditMode &&
          (editTargetOrder.paymentMethod === 'bankak' || editTargetOrder.paymentMethod === 'split')
            ? editBankRef.trim() || undefined
            : undefined,
        bankTransferReceiptUrl:
          isFullEditMode &&
          (editTargetOrder.paymentMethod === 'bankak' || editTargetOrder.paymentMethod === 'split')
            ? editBankReceiptUrl
            : undefined,
        customerNote: editNote.trim() || undefined,
      });
      setEditTargetOrder(null);
    } catch {
      setEditError(
        t(
          'تعذر حفظ تعديلات الطلب. يرجى التأكد من البيانات والمحاولة مرة أخرى.',
          'Could not save order changes. Please check your details and try again.'
        )
      );
    } finally {
      setSavingEdit(false);
    }
  };

  const openCancelDialog = (order: Order) => {
    if (order.cancelRequest) return;
    setCancelTargetOrder(order);
    setSelectedReason('');
    setCancelNote('');
    setConfirmCancelAck(false);
    setCancelError(null);
  };

  const closeCancelDialog = () => {
    if (submittingCancel) return;
    setCancelTargetOrder(null);
    setCancelError(null);
  };

  const handleSubmitCancelRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTargetOrder || submittingCancel) return;
    if (!selectedReason.trim()) {
      setCancelError(t('يرجى اختيار سبب طلب الإلغاء أولاً.', 'Please select a cancellation reason first.'));
      return;
    }
    if (!confirmCancelAck) {
      setCancelError(
        t(
          'يرجى تأكيد فهمك أن الإلغاء يتطلب موافقة الإدارة.',
          'Please confirm that cancellation requires admin approval.'
        )
      );
      return;
    }
    setCancelError(null);
    setSubmittingCancel(true);
    try {
      await requestOrderCancellation(
        cancelTargetOrder.id,
        selectedReason,
        cancelNote.trim() || undefined
      );
      setCancelTargetOrder(null);
      setCancelNote('');
      setConfirmCancelAck(false);
    } catch {
      setCancelError(
        t(
          'تعذر إرسال طلب الإلغاء حالياً. يرجى المحاولة مرة أخرى.',
          'Could not submit cancellation request. Please try again.'
        )
      );
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
              {t(
                'سجل الطلبات متاح لأصحاب الحسابات المسجلة. يمكنك التسوق كضيف وسيُطلب منك الدخول عند إتمام الطلب.',
                'Order history is available for registered accounts. Sign in during checkout to save and track orders.'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => openCatalog('all', '')}
            style={{ backgroundColor: appearance.primaryColor }}
            className="min-h-[44px] px-6 py-2.5 rounded-xl text-white text-sm font-extrabold inline-flex items-center justify-center gap-2 hover:opacity-95 transition-opacity"
          >
            <span>{t('تصفح المنتجات', 'Browse Catalog')}</span>
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

  const rxTargetItem = rxEditIndex !== null ? editItems[rxEditIndex] : undefined;
  const rxTargetProduct: Product | null = rxTargetItem
    ? products.find((p) => p.id === rxTargetItem.productId) || {
        id: rxTargetItem.productId,
        sku: rxTargetItem.productId,
        titleAr: rxTargetItem.titleAr,
        titleEn: rxTargetItem.titleEn,
        descriptionAr: '',
        descriptionEn: '',
        categoryId: 'eyeglasses',
        brandId: 'vision-plus',
        priceSdg: rxTargetItem.unitPriceSdg,
        stock: 10,
        images: [rxTargetItem.image],
        gender: 'unisex',
        variants: [],
        tags: [],
        visible: true,
        isFeatured: false,
        isNewArrival: false,
        requiresPrescriptionOption: true,
        rating: 5,
        reviews: [],
      }
    : null;

  return (
    <div className="max-w-5xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-extrabold">{t('سجل الطلبات وتتبع الشحن', 'Orders & Tracking')}</h1>
          <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">
            {t('تابع حالة تجهيز نظارتك وتأكيد تحويلات بنكك خطوة بخطوة', 'Track prescription preparation and Bankak verification live')}
          </p>
        </div>
        {unreadOrderNotifications.length > 0 && (
          <button
            type="button"
            onClick={markAllNotificationsRead}
            className="min-h-[44px] px-4 py-2 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-xs font-extrabold inline-flex items-center gap-1.5 hover:bg-amber-100 dark:hover:bg-amber-950/50"
          >
            <Check className="w-4 h-4" />
            <span>
              {t(
                `تحديد إشعارات الطلبات كمقروءة (${unreadOrderNotifications.length})`,
                `Mark order alerts read (${unreadOrderNotifications.length})`
              )}
            </span>
          </button>
        )}
      </div>

      {/* In-Page Order Status Notification Center */}
      {orderNotifications.length > 0 && (
        <section
          aria-label={t('تنبيهات تحديث حالة الطلبات', 'Order Status Alerts')}
          className={`rounded-2xl border p-4 space-y-2.5 ${
            unreadOrderNotifications.length > 0
              ? 'bg-amber-50/80 dark:bg-amber-950/20 border-amber-300 dark:border-amber-800'
              : 'bg-white dark:bg-[#181B1E] border-stone-200 dark:border-zinc-800'
          }`}
        >
          <div className="flex items-center justify-between gap-2">
            <div className="flex items-center gap-2 text-xs font-extrabold text-[#11223E] dark:text-[#E2BD5B]">
              {unreadOrderNotifications.length > 0 ? (
                <BellRing className="w-4 h-4 text-amber-600" />
              ) : (
                <Bell className="w-4 h-4" />
              )}
              <span>{t('آخر إشعارات طلباتك', 'Latest Updates on Your Orders')}</span>
              {unreadOrderNotifications.length > 0 && (
                <span className="px-2 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-extrabold tabular-nums">
                  {unreadOrderNotifications.length} {t('جديد', 'new')}
                </span>
              )}
            </div>
          </div>

          <div className="space-y-2">
            {orderNotifications.slice(0, 3).map((notif) => (
              <div
                key={notif.id}
                className={`p-3 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs ${
                  !notif.isRead
                    ? 'bg-white dark:bg-[#131C2E] border-amber-300 dark:border-amber-700 shadow-xs'
                    : 'bg-stone-50/80 dark:bg-zinc-900/70 border-stone-200 dark:border-zinc-800 opacity-85'
                }`}
              >
                <div className="space-y-0.5 min-w-0 flex-1">
                  <div className="font-extrabold flex items-center gap-1.5">
                    {!notif.isRead && <span className="w-2 h-2 rounded-full bg-rose-600 shrink-0" />}
                    <span>{locale === 'ar' ? notif.titleAr : notif.titleEn}</span>
                    <span className="text-[10px] font-normal text-stone-400">
                      · {formatShortDate(notif.createdAt, locale)}
                    </span>
                  </div>
                  <p className="text-[11px] text-stone-600 dark:text-zinc-300 leading-relaxed">
                    {locale === 'ar' ? notif.bodyAr : notif.bodyEn}
                  </p>
                </div>
                {!notif.isRead && (
                  <button
                    type="button"
                    onClick={() => markNotificationRead(notif.id)}
                    className="min-h-[36px] px-3 py-1 rounded-lg bg-[#11223E] text-white text-[11px] font-bold inline-flex items-center gap-1 shrink-0"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>{t('تم الاطلاع', 'Dismiss')}</span>
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      <div className="space-y-5">
        {orders.map((order) => {
          const stateObj = settings.deliveryFees.find((s) => s.id === order.stateId);
          const stepIndex = TIMELINE_STEPS.indexOf(order.status);
          const isCancellableStatus = CANCELLABLE_STATUSES.includes(order.status);
          const isEditableStatus =
            (FULL_EDIT_STATUSES.includes(order.status) ||
              CONTACT_EDIT_STATUSES.includes(order.status)) &&
            order.cancelRequest?.status !== 'approved';
          const isPostShipped = order.status === 'shipped' || order.status === 'delivered';
          const cancelReq = order.cancelRequest;
          const isCancelPending = cancelReq?.status === 'pending';
          const isCancelRejected = cancelReq?.status === 'rejected';
          const isCancelApproved =
            order.status === 'cancelled' && cancelReq?.status === 'approved';
          const matchedOrderNotifs = orderNotifications.filter((n) => n.deepLinkId === order.id);
          const latestMatchedNotif = matchedOrderNotifs[0];
          const unreadMatchedCount = matchedOrderNotifs.filter((n) => !n.isRead).length;

          return (
            <article
              key={order.id}
              className={`bg-white dark:bg-[#181B1E] border rounded-2xl p-5 space-y-4 transition-colors ${
                unreadMatchedCount > 0
                  ? 'border-amber-400 dark:border-amber-700 ring-1 ring-amber-300/60 dark:ring-amber-800/50'
                  : 'border-stone-200 dark:border-zinc-800'
              }`}
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
                    {order.lastEditedAt && (
                      <span className="px-2 py-0.5 rounded-md bg-slate-100 dark:bg-zinc-800 text-slate-600 dark:text-slate-300 text-[11px] font-semibold">
                        {t('مُعدّل', 'Edited')} · {formatShortDate(order.lastEditedAt, locale)}
                      </span>
                    )}
                  </div>
                  <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">
                    {formatShortDate(order.createdAt, locale)} ·{' '}
                    {locale === 'ar'
                      ? stateObj?.nameAr || order.address?.stateNameAr
                      : stateObj?.nameEn || order.address?.stateNameEn}{' '}
                    — {order.city} ({order.area}) · {getPaymentMethodLabel(order.paymentMethod, locale)}
                  </p>
                </div>

                <div className="text-end">
                  <div className="font-mono-num text-lg font-extrabold tabular-nums">
                    {formatSdg(order.totalSdg)}
                  </div>
                  <div className="flex flex-wrap items-center justify-end gap-2 mt-2">
                    {isEditableStatus && (
                      <button
                        type="button"
                        onClick={() => openEditDialog(order)}
                        className="min-h-[44px] px-3.5 py-2 rounded-xl border border-[#11223E]/30 dark:border-[#E2BD5B]/40 bg-[#11223E]/5 dark:bg-[#E2BD5B]/10 text-[#11223E] dark:text-[#E2BD5B] text-xs font-extrabold hover:bg-[#11223E]/10 inline-flex items-center gap-1.5"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                        {t('تعديل الطلب', 'Edit Order')}
                      </button>
                    )}

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
                      ) : isCancelRejected ? (
                        <button
                          type="button"
                          disabled
                          className="min-h-[44px] px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-900/50 bg-rose-50 dark:bg-rose-950/20 text-rose-700 dark:text-rose-300 text-xs font-bold inline-flex items-center gap-1.5 opacity-80 cursor-not-allowed"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          {t('تم رفض طلب الإلغاء', 'Cancellation Rejected')}
                        </button>
                      ) : !cancelReq ? (
                        <button
                          type="button"
                          onClick={() => openCancelDialog(order)}
                          className="min-h-[44px] px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/30 inline-flex items-center gap-1.5"
                        >
                          <XCircle className="w-3.5 h-3.5" />
                          {t('طلب إلغاء الطلب', 'Request Cancellation')}
                        </button>
                      ) : null
                    )}
                  </div>
                </div>
              </div>

              {order.paymentMethod === 'split' && (() => {
                const { bankakSdg, codSdg } = getOrderPaymentBreakdown(order);
                return (
                  <div className="grid sm:grid-cols-2 gap-2.5 p-3 rounded-xl bg-amber-50/70 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 text-xs">
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {t('عربون بنكك:', 'Bankak Deposit:')}
                      </span>
                      <span className="font-mono-num font-extrabold text-[#11223E] dark:text-[#E2BD5B]">
                        {formatSdg(bankakSdg)}{' '}
                        {order.bankTransferVerified ? t('(مؤكد ✓)', '(Verified ✓)') : ''}
                      </span>
                    </div>
                    <div className="flex items-center justify-between gap-2">
                      <span className="font-bold text-slate-700 dark:text-slate-300">
                        {t('المتبقي عند الاستلام:', 'Remaining COD:')}
                      </span>
                      <span className="font-mono-num font-extrabold text-emerald-700 dark:text-emerald-400">
                        {formatSdg(codSdg)}
                      </span>
                    </div>
                  </div>
                );
              })()}

              {/* Latest matched order notification inside card */}
              {latestMatchedNotif && (
                <div
                  className={`p-3.5 rounded-xl border flex flex-wrap items-center justify-between gap-2 text-xs ${
                    !latestMatchedNotif.isRead
                      ? 'bg-amber-50 dark:bg-amber-950/30 border-amber-300 dark:border-amber-700 text-amber-950 dark:text-amber-100'
                      : 'bg-slate-50 dark:bg-zinc-900 border-slate-200 dark:border-zinc-800 text-slate-700 dark:text-slate-300'
                  }`}
                >
                  <div className="space-y-0.5 flex-1 min-w-0">
                    <div className="font-extrabold flex items-center gap-1.5">
                      <BellRing className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>{locale === 'ar' ? latestMatchedNotif.titleAr : latestMatchedNotif.titleEn}</span>
                    </div>
                    <p className="text-[11px] leading-relaxed">
                      {locale === 'ar' ? latestMatchedNotif.bodyAr : latestMatchedNotif.bodyEn}
                    </p>
                  </div>
                  {!latestMatchedNotif.isRead && (
                    <button
                      type="button"
                      onClick={() => markNotificationRead(latestMatchedNotif.id)}
                      className="min-h-[36px] px-3 py-1 rounded-lg bg-[#11223E] text-white text-[11px] font-bold inline-flex items-center gap-1 shrink-0"
                    >
                      <Check className="w-3.5 h-3.5" />
                      <span>{t('تم الاطلاع', 'Mark Read')}</span>
                    </button>
                  )}
                </div>
              )}

              {/* Clear Order Status Guidance */}
              <div className="px-3.5 py-2.5 rounded-xl bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 text-[11px] text-slate-700 dark:text-slate-300 flex items-start gap-2">
                <Info className="w-4 h-4 text-[#B38B2D] shrink-0 mt-0.5" />
                <span>{getStatusGuidance(order.status, locale)}</span>
              </div>

              {/* Order Notes (Customer & Management) */}
              {(order.customerNote || order.adminNote) && (
                <div className="grid sm:grid-cols-2 gap-2.5 text-xs">
                  {order.customerNote && (
                    <div className="p-3 rounded-xl bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 space-y-0.5">
                      <div className="font-bold text-[11px] text-slate-500 flex items-center gap-1">
                        <FileText className="w-3.5 h-3.5" />
                        <span>{t('ملاحظتك على الطلب:', 'Your Order Note:')}</span>
                      </div>
                      <p className="text-slate-800 dark:text-slate-200">{order.customerNote}</p>
                    </div>
                  )}
                  {order.adminNote && (
                    <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/25 border border-sky-200 dark:border-sky-900/50 space-y-0.5">
                      <div className="font-bold text-[11px] text-sky-700 dark:text-sky-300">
                        {t('ملاحظة المتجر على الطلب:', 'Store Note:')}
                      </div>
                      <p className="text-sky-950 dark:text-sky-100">{order.adminNote}</p>
                    </div>
                  )}
                </div>
              )}

              {/* Post-shipped cancellation/edit guidance */}
              {isPostShipped && (
                <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-zinc-900 border border-slate-200 dark:border-zinc-800 flex flex-wrap items-center justify-between gap-3 text-xs">
                  <span className="font-bold text-slate-700 dark:text-slate-300">
                    {t('للإلغاء أو التعديل بعد الشحن تواصل معنا', 'To cancel or edit after shipping, please contact us')}
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
                      <strong>{t('سبب الرفض:', 'Reason:')}</strong> {cancelReq.adminNote}
                    </p>
                  )}
                  <p className="text-[11px] opacity-85">
                    {t('يستمر تجهيز طلبك بشكل طبيعي.', 'Your order continues processing normally.')}
                  </p>
                </div>
              )}

              {order.status !== 'cancelled' ? (
                <div className="space-y-2 pt-1">
                  <div className="h-1.5 rounded-full bg-slate-100 dark:bg-zinc-800 overflow-hidden">
                    <div
                      className="h-full rounded-full transition-all"
                      style={{
                        backgroundColor: appearance.secondaryColor,
                        width: `${Math.max(15, ((stepIndex + 1) / TIMELINE_STEPS.length) * 100)}%`,
                      }}
                    />
                  </div>
                  <div className="flex flex-wrap items-center justify-between gap-2 text-[11px] text-slate-500 dark:text-zinc-400">
                    {TIMELINE_STEPS.map((st, idx) => {
                      const reached = idx <= stepIndex;
                      const current = idx === stepIndex;
                      return (
                        <span
                          key={st}
                          className={
                            current
                              ? 'font-extrabold text-[#11223E] dark:text-[#E2BD5B]'
                              : reached
                              ? 'font-semibold text-slate-700 dark:text-zinc-300'
                              : ''
                          }
                        >
                          {getOrderStatusLabel(st, locale)}
                        </span>
                      );
                    })}
                  </div>
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
                      <strong>{t('ملاحظة المتجر:', 'Store note:')}</strong> {cancelReq.adminNote}
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

      {/* Customer Post-Order Edit Modal */}
      {editTargetOrder && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <form
            onSubmit={handleSubmitEditOrder}
            className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 space-y-5 shadow-2xl text-xs"
          >
            <div className="flex items-center justify-between border-b border-stone-100 dark:border-zinc-800 pb-3">
              <div>
                <h2 className="text-base font-extrabold text-[#11223E] dark:text-white">
                  {t('تعديل تفاصيل الطلب', 'Edit Order Details')}
                </h2>
                <p className="text-[11px] text-slate-500 font-mono-num mt-0.5">
                  #{editTargetOrder.id} · {getOrderStatusLabel(editTargetOrder.status, locale)}
                </p>
              </div>
              <button
                type="button"
                onClick={closeEditDialog}
                aria-label={t('إغلاق', 'Close')}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-sky-50 dark:bg-sky-950/25 border border-sky-200 dark:border-sky-900/50 text-sky-900 dark:text-sky-200 text-[11px] leading-relaxed">
              {isFullEditMode
                ? t(
                    'يمكنك تعديل المنتجات، الكميات، مقاسات العدسات، عنوان التوصيل، وبيانات تحويل بنكك لأن الطلب لم يُؤكد بعد.',
                    'You can edit items, quantities, lens Rx, delivery address, and Bankak details before confirmation.'
                  )
                : t(
                    'الطلب مؤكد/قيد التجهيز: يمكنك تعديل اسم المستلم، رقم الهاتف، تفاصيل الشارع، وملاحظة الطلب فقط.',
                    'Order is confirmed/preparing: you can update recipient contact info, street details, and your note.'
                  )}
            </div>

            {/* Saved Addresses Quick Fill */}
            {user.addresses.length > 0 && (
              <div className="space-y-1.5">
                <span className="block font-bold text-slate-500">
                  {t('تعبئة سريعة من عناوينك المحفوظة:', 'Quick fill from saved addresses:')}
                </span>
                <div className="flex flex-wrap gap-2">
                  {user.addresses.map((addr) => (
                    <button
                      key={addr.id}
                      type="button"
                      onClick={() => applySavedAddress(addr)}
                      className="min-h-[36px] px-3 py-1 rounded-lg border border-stone-200 dark:border-zinc-700 hover:border-[#D9B24C] bg-stone-50 dark:bg-zinc-900 font-bold"
                    >
                      {addr.label} — {addr.city}
                    </button>
                  ))}
                </div>
              </div>
            )}

            {/* Contact & Address Fields */}
            <div className="grid sm:grid-cols-2 gap-3">
              <div className="space-y-1">
                <label className="block font-bold">{t('اسم المستلم *', 'Recipient Name *')}</label>
                <input
                  required
                  maxLength={120}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold">{t('رقم الهاتف *', 'Phone *')}</label>
                <input
                  required
                  dir="ltr"
                  maxLength={32}
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-sm font-mono-num"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold">{t('الولاية', 'State')}</label>
                <select
                  value={editStateId}
                  disabled={!isFullEditMode}
                  onChange={(e) => setEditStateId(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-sm disabled:opacity-60"
                >
                  {settings.deliveryFees.map((st) => (
                    <option key={st.id} value={st.id}>
                      {locale === 'ar' ? st.nameAr : st.nameEn} ({formatSdg(st.feeSdg)})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="block font-bold">{t('المدينة *', 'City *')}</label>
                <input
                  required
                  maxLength={80}
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="block font-bold">{t('المنطقة / الحي *', 'Area / District *')}</label>
                <input
                  required
                  maxLength={120}
                  value={editArea}
                  onChange={(e) => setEditArea(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-sm"
                />
              </div>

              <div className="space-y-1 sm:col-span-2">
                <label className="block font-bold">{t('تفاصيل الشارع وأقرب معلم *', 'Street & Landmark *')}</label>
                <input
                  required
                  maxLength={400}
                  value={editDetails}
                  onChange={(e) => setEditDetails(e.target.value)}
                  className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-sm"
                />
              </div>
            </div>

            {/* Editable Items & Rx (Pre-Confirmation Only) */}
            {isFullEditMode && (
              <div className="space-y-3 pt-2 border-t border-stone-100 dark:border-zinc-800">
                <h3 className="font-extrabold text-sm">{t('المنتجات والعدسات', 'Items & Prescriptions')}</h3>
                <div className="space-y-2.5">
                  {editItems.map((it, idx) => {
                    const catalogProduct = products.find((p) => p.id === it.productId);
                    const rxEligible = catalogProduct
                      ? isPrescriptionEligibleProduct(catalogProduct)
                      : Boolean(it.prescription);
                    const extraPrice = it.lensExtraPriceSdg ?? it.prescription?.lensExtraPriceSdg ?? 0;

                    return (
                      <div
                        key={`${it.productId}_${idx}`}
                        className="p-3 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/70 dark:bg-zinc-900/70 flex flex-wrap items-center justify-between gap-3"
                      >
                        <div className="flex items-center gap-3 min-w-0 flex-1">
                          <ResilientImage
                            src={it.image}
                            alt={locale === 'ar' ? it.titleAr : it.titleEn}
                            className="w-12 h-10 rounded-lg object-cover shrink-0"
                          />
                          <div className="min-w-0">
                            <div className="font-bold truncate">
                              {locale === 'ar' ? it.titleAr : it.titleEn}
                            </div>
                            <div className="text-[11px] text-stone-500 font-mono-num">
                              {formatSdg(it.unitPriceSdg + extraPrice)}
                            </div>
                          </div>
                        </div>

                        <div className="flex flex-wrap items-center gap-2">
                          {rxEligible && (
                            <button
                              type="button"
                              onClick={() => setRxEditIndex(idx)}
                              className="min-h-[36px] px-2.5 py-1 rounded-lg border border-stone-300 dark:border-zinc-700 bg-white dark:bg-[#181B1E] font-bold text-[11px]"
                            >
                              {it.prescription
                                ? t('تعديل المقاس/العدسات', 'Edit Rx/Lens')
                                : t('إضافة مقاس', 'Add Rx')}
                            </button>
                          )}

                          <div className="inline-flex items-center border border-stone-200 dark:border-zinc-700 rounded-lg bg-white dark:bg-[#181B1E]">
                            <button
                              type="button"
                              onClick={() => handleUpdateEditQty(idx, -1)}
                              disabled={it.quantity <= 1}
                              aria-label={t('تقليل الكمية', 'Decrease quantity')}
                              className="min-h-[36px] min-w-[36px] flex items-center justify-center disabled:opacity-40"
                            >
                              <Minus className="w-3.5 h-3.5" />
                            </button>
                            <span className="px-2.5 font-mono-num font-bold">{it.quantity}</span>
                            <button
                              type="button"
                              onClick={() => handleUpdateEditQty(idx, 1)}
                              aria-label={t('زيادة الكمية', 'Increase quantity')}
                              className="min-h-[36px] min-w-[36px] flex items-center justify-center"
                            >
                              <Plus className="w-3.5 h-3.5" />
                            </button>
                          </div>

                          {editItems.length > 1 && (
                            <button
                              type="button"
                              onClick={() => handleRemoveEditItem(idx)}
                              aria-label={t('حذف المنتج', 'Remove item')}
                              className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg text-rose-600 hover:bg-rose-50 dark:hover:bg-rose-950/30"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>

                {/* Live Recalculated Totals */}
                <div className="p-3 rounded-xl bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 space-y-1 text-[11px]">
                  <div className="flex justify-between">
                    <span>{t('المنتجات والعدسات', 'Items & Lenses')}</span>
                    <span className="font-mono-num font-bold">
                      {formatSdg(editPricing.itemsSubtotal + editPricing.lensTotal)}
                    </span>
                  </div>
                  {editTargetOrder.discountSdg > 0 && (
                    <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                      <span>{t('الخصم', 'Discount')}</span>
                      <span className="font-mono-num font-bold">-{formatSdg(editTargetOrder.discountSdg)}</span>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <span>{t('رسوم التوصيل', 'Delivery Fee')}</span>
                    <span className="font-mono-num font-bold">{formatSdg(editPricing.deliveryFee)}</span>
                  </div>
                  <div className="flex justify-between text-sm font-extrabold pt-1.5 border-t border-stone-200 dark:border-zinc-700 text-[#11223E] dark:text-[#E2BD5B]">
                    <span>{t('الإجمالي الجديد', 'Updated Total')}</span>
                    <span className="font-mono-num">{formatSdg(editPricing.total)}</span>
                  </div>
                  {editTargetOrder.paymentMethod === 'split' && (() => {
                    const lockedBankak = Math.min(editPricing.total, editTargetOrder.bankakPaidSdg ?? 0);
                    const updatedCod = Math.max(0, editPricing.total - lockedBankak);
                    return (
                      <div className="pt-1.5 border-t border-stone-200 dark:border-zinc-700 space-y-1">
                        <div className="flex justify-between">
                          <span>{t('عربون بنكك:', 'Bankak Deposit:')}</span>
                          <span className="font-mono-num font-bold">{formatSdg(lockedBankak)}</span>
                        </div>
                        <div className="flex justify-between text-emerald-700 dark:text-emerald-400 font-bold">
                          <span>{t('المتبقي عند الاستلام:', 'Remaining COD:')}</span>
                          <span className="font-mono-num">{formatSdg(updatedCod)}</span>
                        </div>
                      </div>
                    );
                  })()}
                </div>

                {/* Bankak Details Update (if Bankak or Split) */}
                {(editTargetOrder.paymentMethod === 'bankak' ||
                  editTargetOrder.paymentMethod === 'split') && (
                  <div className="p-3 rounded-xl border border-stone-200 dark:border-zinc-700 space-y-2.5">
                    <div className="font-bold">{t('تحديث بيانات تحويل بنكك', 'Update Bankak Transfer')}</div>
                    <div className="space-y-1">
                      <label className="block text-[11px] font-semibold">
                        {t('رقم مرجع العملية', 'Transaction Reference')}
                      </label>
                      <input
                        dir="ltr"
                        maxLength={120}
                        value={editBankRef}
                        onChange={(e) => setEditBankRef(e.target.value)}
                        className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-sm font-mono-num"
                      />
                    </div>
                    <div className="flex flex-wrap items-center gap-3">
                      <label className="min-h-[44px] px-3.5 py-2 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 font-bold inline-flex items-center gap-1.5 cursor-pointer">
                        <Upload className="w-4 h-4" />
                        <span>
                          {uploadingReceipt
                            ? t('جارٍ معالجة الصورة...', 'Processing...')
                            : t('تغيير صورة الإيصال', 'Replace Receipt Image')}
                        </span>
                        <input
                          type="file"
                          accept="image/*"
                          disabled={uploadingReceipt}
                          onChange={(e) => void handleEditReceiptUpload(e)}
                          className="hidden"
                        />
                      </label>
                      {editBankReceiptUrl && (
                        <img
                          src={editBankReceiptUrl}
                          alt="Bankak receipt preview"
                          className="h-12 rounded-lg border border-stone-200 dark:border-zinc-700 object-cover"
                        />
                      )}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Customer Note */}
            <div className="space-y-1.5">
              <label className="block font-bold">{t('ملاحظات إضافية للطلب', 'Order Note (optional)')}</label>
              <textarea
                rows={2}
                maxLength={600}
                value={editNote}
                onChange={(e) => setEditNote(e.target.value)}
                placeholder={t('أضف أي توجيهات للتوصيل أو التجهيز...', 'Add delivery or preparation instructions...')}
                className="w-full px-3 py-2 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-sm"
              />
            </div>

            {editError && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold">
                {editError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100 dark:border-zinc-800">
              <button
                type="button"
                disabled={savingEdit || uploadingReceipt}
                onClick={closeEditDialog}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-stone-200 dark:border-zinc-700 font-bold disabled:opacity-50"
              >
                {t('تراجع', 'Cancel')}
              </button>
              <button
                type="submit"
                disabled={savingEdit || uploadingReceipt}
                style={{ backgroundColor: appearance.primaryColor }}
                className="min-h-[44px] px-5 py-2 rounded-xl text-white font-extrabold disabled:opacity-50"
              >
                {savingEdit ? t('جارٍ الحفظ...', 'Saving...') : t('حفظ التعديلات', 'Save Changes')}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Nested Prescription Sheet for editing item Rx */}
      {rxTargetProduct && rxTargetItem && (
        <PrescriptionSheet
          open={rxEditIndex !== null}
          product={rxTargetProduct}
          initialPrescription={rxTargetItem.prescription}
          onClose={() => setRxEditIndex(null)}
          onSave={handleSaveEditRx}
        />
      )}

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
                onClick={closeCancelDialog}
                aria-label={t('إغلاق', 'Close')}
                className="min-h-[44px] min-w-[44px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 text-[11px] leading-relaxed">
              {t(
                'تنبيه: إرسال هذا النموذج يرفع طلب إلغاء للإدارة فقط، ويظل الطلب فعالاً حتى تتم مراجعته والموافقة عليه من إدارة المتجر (يمكن تقديم طلب إلغاء واحد فقط لكل طلب).',
                'Notice: This submits a cancellation request for review. Your order remains active until approved by store management (one request allowed per order).'
              )}
            </div>

            <div className="space-y-1.5">
              <label className="block font-bold">
                {t('سبب طلب الإلغاء *', 'Cancellation Reason *')}
              </label>
              <select
                required
                value={selectedReason}
                onChange={(e) => {
                  setSelectedReason(e.target.value);
                  setCancelError(null);
                }}
                className="w-full min-h-[44px] px-3 py-2 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-sm"
              >
                <option value="" disabled>
                  {t('— اختر سبب طلب الإلغاء —', '— Select cancellation reason —')}
                </option>
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

            <label className="flex items-start gap-2.5 p-3 rounded-xl border border-stone-200 dark:border-zinc-700 bg-stone-50/70 dark:bg-zinc-900/70 cursor-pointer">
              <input
                type="checkbox"
                checked={confirmCancelAck}
                onChange={(e) => {
                  setConfirmCancelAck(e.target.checked);
                  setCancelError(null);
                }}
                className="w-4 h-4 mt-0.5 accent-[#11223E] shrink-0"
              />
              <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 leading-relaxed">
                {t(
                  'أعلم أن هذا الطلب سيُعرض على الإدارة للموافقة أو الرفض ولا يُلغى الطلب تلقائياً.',
                  'I understand this request will be reviewed by management for approval or rejection and does not cancel the order automatically.'
                )}
              </span>
            </label>

            {cancelError && (
              <div className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold">
                {cancelError}
              </div>
            )}

            <div className="flex items-center justify-end gap-2 pt-2">
              <button
                type="button"
                disabled={submittingCancel}
                onClick={closeCancelDialog}
                className="min-h-[44px] px-4 py-2 rounded-xl border border-stone-200 dark:border-zinc-700 font-bold disabled:opacity-50"
              >
                {t('تراجع', 'Back')}
              </button>
              <button
                type="submit"
                disabled={submittingCancel || !selectedReason.trim() || !confirmCancelAck}
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

