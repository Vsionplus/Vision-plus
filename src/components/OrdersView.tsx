import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
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
  Printer,
  Copy,
  Truck,
  ChevronDown,
  ChevronUp,
  Eye,
  Receipt,
} from 'lucide-react';
import { compressImageFileToBlob } from '../lib/firebase';
import { useStore } from '../store/StoreContext';
import { Order, OrderItem, OrderStatus, PaymentMethod, PrescriptionData, Product, SavedAddress } from '../types';
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
import { FieldValidationRule, useFormValidation } from '../hooks/useFormValidation';
import { FieldError, ValidationSummaryBanner } from './FormValidationUI';
import { VALIDATION_MESSAGES, pickMsg } from '../utils/validationMessages';

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

function getTrackingSteps(paymentMethod: PaymentMethod): { status: OrderStatus; ar: string; en: string }[] {
  const firstStep =
    paymentMethod === 'bankak' || paymentMethod === 'split'
      ? { status: 'awaiting_payment_verification' as OrderStatus, ar: 'مراجعة التحويل', en: 'Payment' }
      : { status: 'pending' as OrderStatus, ar: 'تم الاستلام', en: 'Received' };
  return [
    firstStep,
    { status: 'confirmed', ar: 'تأكيد الطلب', en: 'Confirmed' },
    { status: 'preparing', ar: 'التجهيز', en: 'Preparing' },
    { status: 'shipped', ar: 'في الطريق', en: 'Shipped' },
    { status: 'delivered', ar: 'تم التسليم', en: 'Delivered' },
  ];
}

function getShortStatusHint(status: OrderStatus, locale: 'ar' | 'en'): string {
  const map: Record<OrderStatus, { ar: string; en: string }> = {
    pending: {
      ar: 'تم استلام طلبك وبانتظار التأكيد.',
      en: 'Order received and awaiting confirmation.',
    },
    awaiting_payment_verification: {
      ar: 'جارٍ مراجعة إشعار تحويل بنكك.',
      en: 'Verifying your Bankak transfer receipt.',
    },
    confirmed: {
      ar: 'تم تأكيد طلبك وجارٍ جدولته للتجهيز.',
      en: 'Your order is confirmed and queued.',
    },
    preparing: {
      ar: 'يقوم فريق البصريات بتجهيز وفحص نظارتك.',
      en: 'Our opticians are preparing your eyewear.',
    },
    shipped: {
      ar: 'طلبك في الطريق مع مندوب التوصيل.',
      en: 'Your order is on the way with the courier.',
    },
    delivered: {
      ar: 'تم تسليم الطلب بنجاح.',
      en: 'Order delivered successfully.',
    },
    cancelled: {
      ar: 'تم إلغاء هذا الطلب.',
      en: 'This order was cancelled.',
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
    showToast,
  } = useStore();

  const [expandedOlderIds, setExpandedOlderIds] = useState<Record<string, boolean>>({});
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);

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

  const editOrderModalRef = useRef<HTMLFormElement | null>(null);
  const editVal = useFormValidation({
    containerRef: editOrderModalRef,
    formId: 'customer-edit-order',
  });
  const cancelModalRef = useRef<HTMLFormElement | null>(null);
  const cancelVal = useFormValidation({
    containerRef: cancelModalRef,
    formId: 'customer-cancel-order',
  });

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

  const toggleOlderOrder = (id: string) => {
    setExpandedOlderIds((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const copyInvoiceSummary = (order: Order) => {
    const breakdown = getOrderPaymentBreakdown(order);
    const lines = [
      `${locale === 'ar' ? settings.storeNameAr : settings.storeNameEn} — ${t('فاتورة طلب', 'Order Invoice')}`,
      `${t('رقم الطلب:', 'Order #')}: ${order.id}`,
      `${t('التاريخ:', 'Date')}: ${formatShortDate(order.createdAt, locale)}`,
      `${t('الحالة:', 'Status')}: ${getOrderStatusLabel(order.status, locale)}`,
      `${t('العميل:', 'Customer')}: ${order.customerName} (${order.customerPhone})`,
      ...order.items.map((it) => {
        const extra = it.lensExtraPriceSdg ?? it.prescription?.lensExtraPriceSdg ?? 0;
        return `- ${locale === 'ar' ? it.titleAr : it.titleEn} × ${it.quantity}: ${formatSdg((it.unitPriceSdg + extra) * it.quantity)}`;
      }),
      `${t('التوصيل:', 'Delivery')}: ${formatSdg(order.deliveryFeeSdg)}`,
      ...(order.discountSdg > 0 ? [`${t('الخصم:', 'Discount')}: -${formatSdg(order.discountSdg)}`] : []),
      `${t('الإجمالي النهائي:', 'Total')}: ${formatSdg(order.totalSdg)}`,
      ...(order.paymentMethod === 'split'
        ? [
            `${t('عربون بنكك:', 'Bankak Deposit')}: ${formatSdg(breakdown.bankakSdg)}`,
            `${t('المتبقي عند الاستلام:', 'Remaining COD')}: ${formatSdg(breakdown.codSdg)}`,
          ]
        : []),
    ];
    navigator.clipboard?.writeText(lines.join('\n'));
    showToast(t('تم نسخ ملخص الفاتورة', 'Invoice summary copied'));
  };

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
    editVal.reset();
  };

  const closeEditDialog = () => {
    if (savingEdit || uploadingReceipt) return;
    setEditTargetOrder(null);
    setEditError(null);
    setRxEditIndex(null);
    editVal.reset();
  };

  const buildEditOrderRules = useCallback((): FieldValidationRule[] => {
    if (!editTargetOrder) return [];
    return [
      {
        field: 'name',
        label: t('اسم المستلم', 'Recipient Name'),
        error: !editName.trim()
          ? pickMsg(VALIDATION_MESSAGES.recipientNameRequired, locale)
          : null,
      },
      {
        field: 'phone',
        label: t('رقم الهاتف', 'Phone'),
        error: !editPhone.trim()
          ? pickMsg(VALIDATION_MESSAGES.phoneRequired, locale)
          : !isValidSudanPhone(editPhone)
          ? pickMsg(VALIDATION_MESSAGES.phoneInvalidSudan, locale)
          : null,
      },
      {
        field: 'city',
        label: t('المدينة', 'City'),
        error: !editCity.trim()
          ? pickMsg(VALIDATION_MESSAGES.cityRequired, locale)
          : null,
      },
      {
        field: 'area',
        label: t('المنطقة / الحي', 'Area / District'),
        error: !editArea.trim()
          ? pickMsg(VALIDATION_MESSAGES.areaRequired, locale)
          : null,
      },
      {
        field: 'details',
        label: t('تفاصيل الشارع', 'Street & Landmark'),
        error: !editDetails.trim()
          ? pickMsg(VALIDATION_MESSAGES.streetDetailsRequired, locale)
          : null,
      },
      ...(isFullEditMode
        ? [
            {
              field: 'items',
              label: t('المنتجات والعدسات', 'Items & Prescriptions'),
              error:
                editItems.length === 0
                  ? t('يجب أن يحتوي الطلب على منتج واحد على الأقل.', 'At least one item is required.')
                  : null,
            },
          ]
        : []),
    ];
  }, [
    editTargetOrder,
    editName,
    editPhone,
    editCity,
    editArea,
    editDetails,
    isFullEditMode,
    editItems.length,
    locale,
    t,
  ]);

  useEffect(() => {
    if (editTargetOrder && editVal.submitted) {
      editVal.revalidate(buildEditOrderRules());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editTargetOrder, editVal.submitted, buildEditOrderRules]);

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

    if (!editVal.validateAll(buildEditOrderRules())) {
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
      editVal.reset();
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
    cancelVal.reset();
  };

  const closeCancelDialog = () => {
    if (submittingCancel) return;
    setCancelTargetOrder(null);
    setCancelError(null);
    cancelVal.reset();
  };

  const buildCancelRules = useCallback((): FieldValidationRule[] => {
    if (!cancelTargetOrder) return [];
    return [
      {
        field: 'reason',
        label: t('سبب طلب الإلغاء', 'Cancellation Reason'),
        error: !selectedReason.trim()
          ? t('يرجى اختيار سبب طلب الإلغاء أولاً.', 'Please select a cancellation reason first.')
          : null,
      },
      {
        field: 'confirmAck',
        label: t('تأكيد شروط الإلغاء', 'Cancellation Acknowledgment'),
        error: !confirmCancelAck
          ? t(
              'يرجى تأكيد فهمك أن الإلغاء يتطلب موافقة الإدارة.',
              'Please confirm that cancellation requires admin approval.'
            )
          : null,
      },
    ];
  }, [cancelTargetOrder, selectedReason, confirmCancelAck, t]);

  useEffect(() => {
    if (cancelTargetOrder && cancelVal.submitted) {
      cancelVal.revalidate(buildCancelRules());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [cancelTargetOrder, cancelVal.submitted, buildCancelRules]);

  const handleSubmitCancelRequest = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!cancelTargetOrder || submittingCancel) return;
    if (!cancelVal.validateAll(buildCancelRules())) {
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
      cancelVal.reset();
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

  const latestOrder = orders[0];
  const previousOrders = orders.slice(1);

  const renderOrderCard = (order: Order, isLatest: boolean) => {
    const stateObj = settings.deliveryFees.find((s) => s.id === order.stateId);
    const trackingSteps = getTrackingSteps(order.paymentMethod);
    let stepIndex = trackingSteps.findIndex((s) => s.status === order.status);
    if (stepIndex < 0 && order.status !== 'cancelled') {
      stepIndex = TIMELINE_STEPS.indexOf(order.status) > 1 ? 1 : 0;
    }
    const isExpanded = isLatest || Boolean(expandedOlderIds[order.id]);
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
    const unreadMatchedNotif = orderNotifications.find(
      (n) => n.deepLinkId === order.id && !n.isRead
    );
    const { bankakSdg, codSdg } = getOrderPaymentBreakdown(order);
    const itemsAndLensSubtotal =
      order.itemsSubtotalSdg !== undefined
        ? order.itemsSubtotalSdg + (order.lensOptionsTotalSdg || 0)
        : order.subtotalSdg;

    return (
      <article
        key={order.id}
        className={`bg-white dark:bg-[#131C2E] border rounded-2xl overflow-hidden transition-colors ${
          isLatest
            ? 'border-[#D9B24C]/70 shadow-sm'
            : 'border-slate-200 dark:border-slate-800'
        }`}
      >
        {/* Clean Card Header */}
        <div
          className={`p-4 sm:p-5 flex flex-wrap items-center justify-between gap-3 ${
            isExpanded ? 'border-b border-slate-100 dark:border-slate-800' : ''
          }`}
        >
          <div className="space-y-1 min-w-0">
            <div className="flex flex-wrap items-center gap-2 text-xs sm:text-sm font-extrabold">
              {isLatest && (
                <span className="text-[#B38B2D] dark:text-[#E2BD5B]">
                  {t('آخر طلب', 'Latest Order')} ·
                </span>
              )}
              <span className="font-mono-num text-[#11223E] dark:text-white">{order.id}</span>
              <span aria-hidden="true" className="text-slate-300 dark:text-slate-700">·</span>
              <span
                className={
                  order.status === 'cancelled'
                    ? 'text-rose-600 dark:text-rose-400'
                    : order.status === 'delivered'
                    ? 'text-emerald-700 dark:text-emerald-400'
                    : 'text-[#B38B2D] dark:text-[#E2BD5B]'
                }
              >
                {getOrderStatusLabel(order.status, locale)}
              </span>
            </div>
            <p className="text-[11px] text-slate-500 dark:text-slate-400">
              {formatShortDate(order.createdAt, locale)} · {getPaymentMethodLabel(order.paymentMethod, locale)}
            </p>
          </div>

          <div className="flex items-center gap-2.5 shrink-0">
            <div className="text-end">
              <div className="font-mono-num text-base sm:text-lg font-extrabold text-[#11223E] dark:text-white tabular-nums">
                {formatSdg(order.totalSdg)}
              </div>
              {order.paymentMethod === 'split' && (
                <div className="text-[10px] font-bold text-emerald-700 dark:text-emerald-400">
                  {t('المتبقي عند الاستلام:', 'COD:')} {formatSdg(codSdg)}
                </div>
              )}
            </div>

            {!isLatest && (
              <button
                type="button"
                onClick={() => toggleOlderOrder(order.id)}
                className="min-h-[38px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold inline-flex items-center gap-1 hover:border-[#D9B24C]"
              >
                <span>{isExpanded ? t('إخفاء', 'Hide') : t('التفاصيل', 'Details')}</span>
                {isExpanded ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
              </button>
            )}
          </div>
        </div>

        {isExpanded && (
          <div className="p-4 sm:p-5 space-y-4">
            {/* Unread Status Update Alert (shown only when unread) */}
            {unreadMatchedNotif && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/30 border border-amber-300 dark:border-amber-700 flex flex-wrap items-center justify-between gap-2 text-xs">
                <div className="flex items-start gap-2 min-w-0 flex-1">
                  <BellRing className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                  <div className="min-w-0">
                    <div className="font-extrabold text-[#11223E] dark:text-amber-100">
                      {locale === 'ar' ? unreadMatchedNotif.titleAr : unreadMatchedNotif.titleEn}
                    </div>
                    <p className="text-[11px] text-slate-700 dark:text-amber-200/80">
                      {locale === 'ar' ? unreadMatchedNotif.bodyAr : unreadMatchedNotif.bodyEn}
                    </p>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => markNotificationRead(unreadMatchedNotif.id)}
                  className="min-h-[34px] px-3 rounded-lg bg-[#11223E] text-white text-[11px] font-bold inline-flex items-center gap-1 shrink-0"
                >
                  <Check className="w-3.5 h-3.5" />
                  <span>{t('تم', 'OK')}</span>
                </button>
              </div>
            )}

            {/* Simple Visual Order Tracking Stepper */}
            {order.status !== 'cancelled' ? (
              <div className="p-3.5 rounded-xl bg-slate-50 dark:bg-slate-900/70 border border-slate-200/70 dark:border-slate-800 space-y-3">
                <div className="flex items-center justify-between gap-2 text-xs">
                  <span className="font-extrabold text-[#11223E] dark:text-white inline-flex items-center gap-1.5">
                    <Truck className="w-4 h-4 text-[#B38B2D]" />
                    {t('تتبع حالة الطلب', 'Order Tracking')}
                  </span>
                  <span className="text-[11px] font-bold text-[#B38B2D] dark:text-[#E2BD5B]">
                    {getOrderStatusLabel(order.status, locale)}
                  </span>
                </div>

                {/* 5-Step Progress Dots */}
                <div className="grid grid-cols-5 gap-1">
                  {trackingSteps.map((st, idx) => {
                    const done = idx < stepIndex;
                    const current = idx === stepIndex;
                    return (
                      <div key={st.status} className="flex flex-col items-center text-center gap-1.5">
                        <div className="w-full flex items-center">
                          <div
                            className={`h-0.5 flex-1 ${
                              idx === 0
                                ? 'bg-transparent'
                                : idx <= stepIndex
                                ? 'bg-[#D9B24C]'
                                : 'bg-slate-200 dark:bg-slate-700'
                            }`}
                          />
                          <div
                            className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-extrabold shrink-0 transition-colors ${
                              done
                                ? 'bg-[#D9B24C] text-[#11223E]'
                                : current
                                ? 'bg-[#11223E] text-white dark:bg-[#D9B24C] dark:text-[#11223E] ring-4 ring-[#D9B24C]/25'
                                : 'bg-slate-200 dark:bg-slate-800 text-slate-400'
                            }`}
                          >
                            {done ? <Check className="w-3.5 h-3.5" /> : idx + 1}
                          </div>
                          <div
                            className={`h-0.5 flex-1 ${
                              idx === trackingSteps.length - 1
                                ? 'bg-transparent'
                                : idx < stepIndex
                                ? 'bg-[#D9B24C]'
                                : 'bg-slate-200 dark:bg-slate-700'
                            }`}
                          />
                        </div>
                        <span
                          className={`text-[10px] leading-tight ${
                            current
                              ? 'font-extrabold text-[#11223E] dark:text-[#E2BD5B]'
                              : done
                              ? 'font-bold text-slate-700 dark:text-slate-300'
                              : 'text-slate-400 dark:text-slate-500'
                          }`}
                        >
                          {locale === 'ar' ? st.ar : st.en}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <p className="text-[11px] text-slate-600 dark:text-slate-300 text-center">
                  {getShortStatusHint(order.status, locale)}
                </p>
              </div>
            ) : (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs space-y-1">
                <div className="font-extrabold">
                  {isCancelApproved
                    ? t('تمت الموافقة على إلغاء الطلب', 'Order Cancellation Approved')
                    : t('تم إلغاء هذا الطلب', 'This order was cancelled')}
                </div>
                {cancelReq?.adminNote && (
                  <p className="text-[11px]">
                    <strong>{t('ملاحظة المتجر:', 'Store note:')}</strong> {cancelReq.adminNote}
                  </p>
                )}
              </div>
            )}

            {/* Simple Cancellation Review Notices */}
            {isCancelPending && cancelReq && (
              <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/20 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 text-xs flex items-center gap-2">
                <Clock className="w-4 h-4 shrink-0" />
                <span>
                  {t('طلب الإلغاء قيد المراجعة', 'Cancellation Under Review')} — {cancelReq.reason}
                </span>
              </div>
            )}

            {isCancelRejected && order.status !== 'cancelled' && cancelReq && (
              <div className="p-3 rounded-xl bg-rose-50 dark:bg-rose-950/20 border border-rose-200 dark:border-rose-900/50 text-rose-800 dark:text-rose-200 text-xs">
                <strong>{t('تم رفض طلب الإلغاء:', 'Cancellation Rejected:')}</strong>{' '}
                {cancelReq.adminNote || t('يستمر تجهيز طلبك.', 'Order continues normally.')}
              </div>
            )}

            {/* Simple Invoice Receipt Block */}
            <div className="rounded-xl border border-slate-200/80 dark:border-slate-800 p-3.5 sm:p-4 space-y-3 text-xs">
              <div className="flex flex-wrap items-center justify-between gap-2 pb-2 border-b border-slate-100 dark:border-slate-800">
                <span className="font-extrabold text-[#11223E] dark:text-white inline-flex items-center gap-1.5">
                  <Receipt className="w-4 h-4 text-[#B38B2D]" />
                  {t('ملخص الفاتورة', 'Invoice Summary')}
                </span>
                <span className="text-[11px] text-slate-500 dark:text-slate-400">
                  {order.customerName} ·{' '}
                  {locale === 'ar'
                    ? stateObj?.nameAr || order.address?.stateNameAr
                    : stateObj?.nameEn || order.address?.stateNameEn}
                  {order.city ? ` — ${order.city}` : ''}
                </span>
              </div>

              {/* Clean Item Lines */}
              <div className="space-y-2">
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

                  return (
                    <div key={item.productId + idx} className="flex items-center gap-3">
                      <div className="w-11 h-10 rounded-lg overflow-hidden bg-slate-100 dark:bg-slate-900 shrink-0">
                        <ResilientImage
                          src={item.image}
                          alt={locale === 'ar' ? item.titleAr : item.titleEn}
                          className="w-full h-full object-cover"
                        />
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold truncate text-[#11223E] dark:text-slate-100">
                          {locale === 'ar' ? item.titleAr : item.titleEn} × {item.quantity}
                        </p>
                        {(item.variantLabel || item.options?.size) && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {[
                              item.variantLabel,
                              item.options?.size ? `${t('المقاس:', 'Size:')} ${item.options.size}` : '',
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </p>
                        )}
                        {hasCustomLens && lensSummary && (
                          <p className="text-[11px] text-slate-500 dark:text-slate-400 truncate">
                            {lensSummary}
                          </p>
                        )}
                      </div>
                      <span className="font-mono-num font-bold tabular-nums shrink-0">
                        {formatSdg((item.unitPriceSdg + extraPrice) * item.quantity)}
                      </span>
                    </div>
                  );
                })}
              </div>

              {/* Simple Totals Table */}
              <div className="pt-2.5 border-t border-slate-100 dark:border-slate-800 space-y-1">
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>{t('المنتجات والعدسات', 'Items & Lenses')}</span>
                  <span className="font-mono-num font-semibold">{formatSdg(itemsAndLensSubtotal)}</span>
                </div>
                {order.discountSdg > 0 && (
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                    <span>{t('الخصم', 'Discount')}</span>
                    <span className="font-mono-num font-semibold">− {formatSdg(order.discountSdg)}</span>
                  </div>
                )}
                <div className="flex justify-between text-slate-600 dark:text-slate-400">
                  <span>{t('رسوم التوصيل', 'Delivery Fee')}</span>
                  <span className="font-mono-num font-semibold">{formatSdg(order.deliveryFeeSdg)}</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold pt-1.5 border-t border-slate-100 dark:border-slate-800 text-[#11223E] dark:text-[#E2BD5B]">
                  <span>{t('الإجمالي النهائي', 'Final Total')}</span>
                  <span className="font-mono-num tabular-nums">{formatSdg(order.totalSdg)}</span>
                </div>

                {order.paymentMethod === 'split' && (
                  <div className="mt-2 p-2.5 rounded-lg bg-[#D9B24C]/10 border border-[#D9B24C]/35 grid grid-cols-2 gap-2 text-[11px]">
                    <div>
                      <span className="text-slate-500 dark:text-slate-400 block">
                        {t('عربون بنكك', 'Bankak Paid')}
                        {order.bankTransferVerified ? ' ✓' : ''}
                      </span>
                      <span className="font-mono-num font-extrabold text-[#11223E] dark:text-[#E2BD5B]">
                        {formatSdg(bankakSdg)}
                      </span>
                    </div>
                    <div className="text-end">
                      <span className="text-slate-500 dark:text-slate-400 block">
                        {t('المتبقي عند الاستلام', 'Due on Delivery')}
                      </span>
                      <span className="font-mono-num font-extrabold text-emerald-700 dark:text-emerald-400">
                        {formatSdg(codSdg)}
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {(order.customerNote || order.adminNote) && (
                <div className="pt-2 border-t border-slate-100 dark:border-slate-800 space-y-1 text-[11px]">
                  {order.customerNote && (
                    <p className="text-slate-600 dark:text-slate-300">
                      <strong>{t('ملاحظتك:', 'Your note:')}</strong> {order.customerNote}
                    </p>
                  )}
                  {order.adminNote && (
                    <p className="text-sky-700 dark:text-sky-300">
                      <strong>{t('ملاحظة المتجر:', 'Store note:')}</strong> {order.adminNote}
                    </p>
                  )}
                </div>
              )}
            </div>

            {/* Clean Action Row */}
            <div className="flex flex-wrap items-center gap-2 pt-1">
              <button
                type="button"
                onClick={() => setInvoiceOrder(order)}
                className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#11223E] text-white dark:bg-[#D9B24C] dark:text-[#11223E] text-xs font-extrabold inline-flex items-center gap-1.5"
              >
                <FileText className="w-3.5 h-3.5" />
                <span>{t('عرض / طباعة الفاتورة', 'View / Print Invoice')}</span>
              </button>

              {isEditableStatus && (
                <button
                  type="button"
                  onClick={() => openEditDialog(order)}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold hover:border-[#D9B24C] inline-flex items-center gap-1.5"
                >
                  <Edit3 className="w-3.5 h-3.5" />
                  <span>{t('تعديل', 'Edit')}</span>
                </button>
              )}

              <button
                type="button"
                onClick={() => reorder(order.id)}
                className="min-h-[40px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-semibold hover:bg-slate-50 dark:hover:bg-slate-800 inline-flex items-center gap-1.5"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>{t('إعادة الطلب', 'Reorder')}</span>
              </button>

              {isCancellableStatus && !cancelReq && (
                <button
                  type="button"
                  onClick={() => openCancelDialog(order)}
                  className="min-h-[40px] px-3.5 py-2 rounded-xl border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-400 text-xs font-bold hover:bg-rose-50 dark:hover:bg-rose-950/30 inline-flex items-center gap-1.5"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  <span>{t('إلغاء الطلب', 'Cancel')}</span>
                </button>
              )}

              {isPostShipped && whatsappDigits && (
                <a
                  href={`https://wa.me/${whatsappDigits}?text=${encodeURIComponent(
                    t(
                      `مرحباً، أود الاستفسار عن الطلب رقم ${order.id}`,
                      `Hello, I would like to inquire about order ${order.id}`
                    )
                  )}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="min-h-[40px] px-3.5 py-2 rounded-xl bg-[#16A34A] hover:bg-[#15803D] text-white text-xs font-bold inline-flex items-center gap-1.5"
                >
                  <MessageCircle className="w-3.5 h-3.5" />
                  <span>{t('واتساب', 'WhatsApp')}</span>
                </a>
              )}
            </div>
          </div>
        )}
      </article>
    );
  };

  return (
    <div className="max-w-4xl mx-auto px-4 sm:px-6 pt-5 pb-8 space-y-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl font-extrabold text-[#11223E] dark:text-white">
            {t('طلباتي وفواتيري', 'My Orders & Invoices')}
          </h1>
          <p className="text-xs text-slate-500 dark:text-slate-400 mt-0.5">
            {t('تتبع حالة طلبك وعرض الفاتورة النهائية بسهولة', 'Track your order progress and view simplified invoices')}
          </p>
        </div>

        {unreadOrderNotifications.length > 0 && (
          <button
            type="button"
            onClick={markAllNotificationsRead}
            className="min-h-[40px] px-3.5 py-1.5 rounded-xl border border-amber-300 dark:border-amber-700 bg-amber-50 dark:bg-amber-950/30 text-amber-900 dark:text-amber-200 text-xs font-bold inline-flex items-center gap-1.5"
          >
            <Check className="w-3.5 h-3.5" />
            <span>
              {t(`تحديثات جديدة (${unreadOrderNotifications.length})`, `Mark updates read (${unreadOrderNotifications.length})`)}
            </span>
          </button>
        )}
      </div>

      {/* Latest Order Highlight */}
      {latestOrder && renderOrderCard(latestOrder, true)}

      {/* Previous Orders */}
      {previousOrders.length > 0 && (
        <section className="space-y-3">
          <h2 className="text-sm font-extrabold text-slate-600 dark:text-slate-300">
            {t(`الطلبات السابقة (${previousOrders.length})`, `Previous Orders (${previousOrders.length})`)}
          </h2>
          <div className="space-y-3">{previousOrders.map((ord) => renderOrderCard(ord, false))}</div>
        </section>
      )}

      {/* Simple Printable / Screenshot-Ready Invoice Modal */}
      {invoiceOrder && (() => {
        const invState = settings.deliveryFees.find((s) => s.id === invoiceOrder.stateId);
        const invBreakdown = getOrderPaymentBreakdown(invoiceOrder);
        const invItemsSubtotal =
          invoiceOrder.itemsSubtotalSdg !== undefined
            ? invoiceOrder.itemsSubtotalSdg + (invoiceOrder.lensOptionsTotalSdg || 0)
            : invoiceOrder.subtotalSdg;
        return (
          <div className="fixed inset-0 z-[75] bg-black/60 backdrop-blur-xs flex items-center justify-center p-4 overflow-y-auto">
            <div className="bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-2xl max-w-md w-full p-5 sm:p-6 space-y-4 shadow-2xl text-xs">
              <div className="flex items-start justify-between gap-3 border-b border-slate-200 dark:border-slate-800 pb-3">
                <div>
                  <div className="font-extrabold text-base text-[#11223E] dark:text-white">
                    {locale === 'ar' ? settings.storeNameAr : settings.storeNameEn}
                  </div>
                  <div className="text-[11px] text-slate-500 dark:text-slate-400">
                    {t('فاتورة طلب العميل', 'Customer Order Invoice')}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInvoiceOrder(null)}
                  aria-label={t('إغلاق', 'Close')}
                  className="min-h-[38px] min-w-[38px] flex items-center justify-center rounded-xl hover:bg-slate-100 dark:hover:bg-slate-800 print:hidden"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="grid grid-cols-2 gap-2 p-3 rounded-xl bg-slate-50 dark:bg-slate-900/70">
                <div>
                  <span className="text-slate-500 block">{t('رقم الفاتورة', 'Invoice #')}</span>
                  <span className="font-mono-num font-extrabold">{invoiceOrder.id}</span>
                </div>
                <div className="text-end">
                  <span className="text-slate-500 block">{t('التاريخ', 'Date')}</span>
                  <span className="font-bold">{formatShortDate(invoiceOrder.createdAt, locale)}</span>
                </div>
                <div>
                  <span className="text-slate-500 block">{t('العميل', 'Customer')}</span>
                  <span className="font-bold">{invoiceOrder.customerName}</span>
                </div>
                <div className="text-end">
                  <span className="text-slate-500 block">{t('الهاتف', 'Phone')}</span>
                  <span dir="ltr" className="font-mono-num font-bold">{invoiceOrder.customerPhone}</span>
                </div>
                <div className="col-span-2 pt-1 border-t border-slate-200/70 dark:border-slate-800">
                  <span className="text-slate-500">{t('العنوان:', 'Address:')} </span>
                  <span className="font-semibold">
                    {locale === 'ar'
                      ? invState?.nameAr || invoiceOrder.address?.stateNameAr
                      : invState?.nameEn || invoiceOrder.address?.stateNameEn}
                    {invoiceOrder.city ? ` — ${invoiceOrder.city}` : ''}
                    {invoiceOrder.area ? `، ${invoiceOrder.area}` : ''}
                  </span>
                </div>
              </div>

              <div className="divide-y divide-slate-100 dark:divide-slate-800">
                {invoiceOrder.items.map((it, idx) => {
                  const extra = it.lensExtraPriceSdg ?? it.prescription?.lensExtraPriceSdg ?? 0;
                  return (
                    <div key={`${it.productId}_${idx}`} className="py-2 flex items-center justify-between gap-2">
                      <div className="min-w-0">
                        <span className="font-bold truncate block">
                          {locale === 'ar' ? it.titleAr : it.titleEn} × {it.quantity}
                        </span>
                        {(it.variantLabel || it.options?.size) && (
                          <span className="text-[11px] text-slate-500 dark:text-slate-400 block truncate">
                            {[
                              it.variantLabel,
                              it.options?.size ? `${t('المقاس:', 'Size:')} ${it.options.size}` : '',
                            ]
                              .filter(Boolean)
                              .join(' · ')}
                          </span>
                        )}
                      </div>
                      <span className="font-mono-num font-bold shrink-0">
                        {formatSdg((it.unitPriceSdg + extra) * it.quantity)}
                      </span>
                    </div>
                  );
                })}
              </div>

              <div className="p-3 rounded-xl bg-[#D9B24C]/10 border border-[#D9B24C]/40 space-y-1">
                <div className="flex justify-between">
                  <span>{t('المنتجات والعدسات', 'Items & Lenses')}</span>
                  <span className="font-mono-num font-bold">{formatSdg(invItemsSubtotal)}</span>
                </div>
                {invoiceOrder.discountSdg > 0 && (
                  <div className="flex justify-between text-emerald-700 dark:text-emerald-400">
                    <span>{t('الخصم', 'Discount')}</span>
                    <span className="font-mono-num font-bold">− {formatSdg(invoiceOrder.discountSdg)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span>{t('رسوم التوصيل', 'Delivery Fee')}</span>
                  <span className="font-mono-num font-bold">{formatSdg(invoiceOrder.deliveryFeeSdg)}</span>
                </div>
                <div className="flex justify-between text-sm font-extrabold pt-1.5 border-t border-[#D9B24C]/40">
                  <span>{t('الإجمالي النهائي', 'Final Total')}</span>
                  <span className="font-mono-num text-[#11223E] dark:text-[#E2BD5B]">
                    {formatSdg(invoiceOrder.totalSdg)}
                  </span>
                </div>
                {invoiceOrder.paymentMethod === 'split' && (
                  <div className="pt-1.5 border-t border-[#D9B24C]/30 space-y-1 text-[11px]">
                    <div className="flex justify-between font-bold">
                      <span>{t('عربون بنكك:', 'Bankak Paid:')}</span>
                      <span className="font-mono-num">{formatSdg(invBreakdown.bankakSdg)}</span>
                    </div>
                    <div className="flex justify-between font-bold text-emerald-700 dark:text-emerald-400">
                      <span>{t('المتبقي عند الاستلام:', 'Due on Delivery:')}</span>
                      <span className="font-mono-num">{formatSdg(invBreakdown.codSdg)}</span>
                    </div>
                  </div>
                )}
              </div>

              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>
                  {t('الدفع:', 'Payment:')} {getPaymentMethodLabel(invoiceOrder.paymentMethod, locale)}
                </span>
                <span className="font-bold text-[#B38B2D]">
                  {getOrderStatusLabel(invoiceOrder.status, locale)}
                </span>
              </div>

              <div className="flex items-center gap-2 pt-2 border-t border-slate-100 dark:border-slate-800 print:hidden">
                <button
                  type="button"
                  onClick={() => copyInvoiceSummary(invoiceOrder)}
                  className="flex-1 min-h-[42px] px-3 rounded-xl border border-slate-200 dark:border-slate-700 font-bold inline-flex items-center justify-center gap-1.5"
                >
                  <Copy className="w-3.5 h-3.5" />
                  <span>{t('نسخ الفاتورة', 'Copy Invoice')}</span>
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="flex-1 min-h-[42px] px-3 rounded-xl bg-[#11223E] text-white dark:bg-[#D9B24C] dark:text-[#11223E] font-extrabold inline-flex items-center justify-center gap-1.5"
                >
                  <Printer className="w-3.5 h-3.5" />
                  <span>{t('طباعة', 'Print')}</span>
                </button>
              </div>
            </div>
          </div>
        );
      })()}

      {/* Customer Post-Order Edit Modal */}
      {editTargetOrder && (
        <div className="fixed inset-0 z-[70] bg-black/60 backdrop-blur-xs flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
          <form
            ref={editOrderModalRef}
            noValidate
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

            <ValidationSummaryBanner
              errors={editVal.errors}
              onSelectField={editVal.focusField}
              mode="form"
            />

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
              <div {...editVal.getFieldWrapperProps('name')} className="space-y-1">
                <label className="block font-bold">{t('اسم المستلم *', 'Recipient Name *')}</label>
                <input
                  maxLength={120}
                  value={editName}
                  onChange={(e) => setEditName(e.target.value)}
                  {...editVal.getInputA11yProps('name')}
                  className={`w-full min-h-[44px] px-3 py-2 rounded-xl text-sm ${editVal.getControlClasses(
                    'name',
                    'border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900'
                  )}`}
                />
                <FieldError
                  id={editVal.getErrorId('name')}
                  message={editVal.getError('name')}
                />
              </div>

              <div {...editVal.getFieldWrapperProps('phone')} className="space-y-1">
                <label className="block font-bold">{t('رقم الهاتف *', 'Phone *')}</label>
                <input
                  dir="ltr"
                  maxLength={32}
                  value={editPhone}
                  onChange={(e) => setEditPhone(e.target.value)}
                  {...editVal.getInputA11yProps('phone')}
                  className={`w-full min-h-[44px] px-3 py-2 rounded-xl text-sm font-mono-num ${editVal.getControlClasses(
                    'phone',
                    'border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900'
                  )}`}
                />
                <FieldError
                  id={editVal.getErrorId('phone')}
                  message={editVal.getError('phone')}
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

              <div {...editVal.getFieldWrapperProps('city')} className="space-y-1">
                <label className="block font-bold">{t('المدينة *', 'City *')}</label>
                <input
                  maxLength={80}
                  value={editCity}
                  onChange={(e) => setEditCity(e.target.value)}
                  {...editVal.getInputA11yProps('city')}
                  className={`w-full min-h-[44px] px-3 py-2 rounded-xl text-sm ${editVal.getControlClasses(
                    'city',
                    'border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900'
                  )}`}
                />
                <FieldError
                  id={editVal.getErrorId('city')}
                  message={editVal.getError('city')}
                />
              </div>

              <div {...editVal.getFieldWrapperProps('area')} className="space-y-1">
                <label className="block font-bold">{t('المنطقة / الحي *', 'Area / District *')}</label>
                <input
                  maxLength={120}
                  value={editArea}
                  onChange={(e) => setEditArea(e.target.value)}
                  {...editVal.getInputA11yProps('area')}
                  className={`w-full min-h-[44px] px-3 py-2 rounded-xl text-sm ${editVal.getControlClasses(
                    'area',
                    'border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900'
                  )}`}
                />
                <FieldError
                  id={editVal.getErrorId('area')}
                  message={editVal.getError('area')}
                />
              </div>

              <div {...editVal.getFieldWrapperProps('details')} className="space-y-1 sm:col-span-2">
                <label className="block font-bold">{t('تفاصيل الشارع وأقرب معلم *', 'Street & Landmark *')}</label>
                <input
                  maxLength={400}
                  value={editDetails}
                  onChange={(e) => setEditDetails(e.target.value)}
                  {...editVal.getInputA11yProps('details')}
                  className={`w-full min-h-[44px] px-3 py-2 rounded-xl text-sm ${editVal.getControlClasses(
                    'details',
                    'border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900'
                  )}`}
                />
                <FieldError
                  id={editVal.getErrorId('details')}
                  message={editVal.getError('details')}
                />
              </div>
            </div>

            {/* Editable Items & Rx (Pre-Confirmation Only) */}
            {isFullEditMode && (
              <div
                {...editVal.getFieldWrapperProps('items')}
                className={`space-y-3 pt-2 border-t border-stone-100 dark:border-zinc-800 rounded-xl ${
                  editVal.hasError('items')
                    ? 'p-3 border-2 border-[#DC2626] dark:border-rose-500 bg-[#FEF2F2] dark:bg-rose-950/30'
                    : ''
                }`}
              >
                <h3 className="font-extrabold text-sm">{t('المنتجات والعدسات', 'Items & Prescriptions')}</h3>
                <FieldError
                  id={editVal.getErrorId('items')}
                  message={editVal.getError('items')}
                />
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
                              className="min-h-[40px] px-3.5 py-1.5 rounded-xl bg-[#D9B24C] hover:bg-[#c9a13c] text-[#11223E] border border-[#b38b2d] shadow-xs font-extrabold text-xs inline-flex items-center gap-1.5 transition-colors"
                            >
                              <Eye className="w-3.5 h-3.5 shrink-0" />
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
            ref={cancelModalRef}
            noValidate
            onSubmit={handleSubmitCancelRequest}
            className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-2xl max-w-md w-full max-h-[90vh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-2xl text-xs"
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

            <ValidationSummaryBanner
              errors={cancelVal.errors}
              onSelectField={cancelVal.focusField}
              mode="form"
            />

            <div className="p-3 rounded-xl bg-amber-50 dark:bg-amber-950/25 border border-amber-200 dark:border-amber-900/50 text-amber-900 dark:text-amber-200 text-[11px] leading-relaxed">
              {t(
                'تنبيه: إرسال هذا النموذج يرفع طلب إلغاء للإدارة فقط، ويظل الطلب فعالاً حتى تتم مراجعته والموافقة عليه من إدارة المتجر (يمكن تقديم طلب إلغاء واحد فقط لكل طلب).',
                'Notice: This submits a cancellation request for review. Your order remains active until approved by store management (one request allowed per order).'
              )}
            </div>

            <div {...cancelVal.getFieldWrapperProps('reason')} className="space-y-1.5">
              <label className="block font-bold">
                {t('سبب طلب الإلغاء *', 'Cancellation Reason *')}
              </label>
              <select
                value={selectedReason}
                onChange={(e) => {
                  setSelectedReason(e.target.value);
                  setCancelError(null);
                }}
                {...cancelVal.getInputA11yProps('reason')}
                className={`w-full min-h-[44px] px-3 py-2 rounded-xl text-sm ${cancelVal.getControlClasses(
                  'reason',
                  'border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900'
                )}`}
              >
                <option value="">
                  {t('— اختر سبب طلب الإلغاء —', '— Select cancellation reason —')}
                </option>
                {CANCEL_REASONS.map((r) => (
                  <option key={r.ar} value={r.ar}>
                    {locale === 'ar' ? r.ar : r.en}
                  </option>
                ))}
              </select>
              <FieldError
                id={cancelVal.getErrorId('reason')}
                message={cancelVal.getError('reason')}
              />
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

            <div {...cancelVal.getFieldWrapperProps('confirmAck')}>
              <label
                className={`flex items-start gap-2.5 p-3 rounded-xl cursor-pointer ${cancelVal.getControlClasses(
                  'confirmAck',
                  'border border-stone-200 dark:border-zinc-700 bg-stone-50/70 dark:bg-zinc-900/70'
                )}`}
              >
                <input
                  type="checkbox"
                  checked={confirmCancelAck}
                  onChange={(e) => {
                    setConfirmCancelAck(e.target.checked);
                    setCancelError(null);
                  }}
                  {...cancelVal.getInputA11yProps('confirmAck')}
                  className="w-4 h-4 mt-0.5 accent-[#11223E] shrink-0"
                />
                <span className="text-[11px] font-bold text-slate-700 dark:text-slate-200 leading-relaxed">
                  {t(
                    'أعلم أن هذا الطلب سيُعرض على الإدارة للموافقة أو الرفض ولا يُلغى الطلب تلقائياً.',
                    'I understand this request will be reviewed by management for approval or rejection and does not cancel the order automatically.'
                  )}
                </span>
              </label>
              <FieldError
                id={cancelVal.getErrorId('confirmAck')}
                message={cancelVal.getError('confirmAck')}
              />
            </div>

            {cancelError && (
              <div
                role="alert"
                className="p-2.5 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-800 text-rose-700 dark:text-rose-300 font-bold"
              >
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
                disabled={submittingCancel}
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

