import React, { useEffect, useMemo, useState } from 'react';
import {
  BarChart3,
  Package,
  ShoppingBag,
  Layers,
  LayoutTemplate,
  Image as ImageIcon,
  FileText,
  Palette,
  Settings,
  Ticket,
  Bell,
  Stethoscope,
  Users,
  ShieldCheck,
  Printer,
  Share2,
  AlertTriangle,
  X,
  LogOut,
  ArrowRight,
  Menu,
} from 'lucide-react';
import { resolveAdminModuleFromLocation, useStore } from '../store/StoreContext';
import { useAdminSecurity } from './admin/AdminGuard';
import { Order, StaffPermission } from '../types';
import { formatSdg, formatShortDate, getOrderStatusLabel } from '../utils/format';
import {
  calculateLensPricingBreakdown,
  formatLensSummaryLine,
  getExtraOptionLabel,
  getMirrorColorLabel,
  getVisionTypeLabel,
  hasCustomLensOrRx,
  resolveExtraOptions,
  resolveVisionType,
} from '../utils/prescription';
import { AdminCategoriesBrandsModule, AdminProductsModule } from './admin/AdminCatalogModules';
import {
  AdminAppearanceModule,
  AdminBannersModule,
  AdminContentTextsModule,
  AdminHomeBuilderModule,
  AdminStoreSettingsModule,
} from './admin/AdminSiteControlModules';
import {
  AdminConsultsModule,
  AdminCouponsModule,
  AdminCustomersReviewsModule,
  AdminNotificationsModule,
  AdminOrdersModule,
  AdminRolesModule,
} from './admin/AdminOperationsModules';

export const AdminDashboardView: React.FC = () => {
  const { locale, t, user, products, orders, settings, lensOptions, showToast, hasPermission, navigateToHome } = useStore();
  const { requestAdminLogout } = useAdminSecurity();
  const [activeModule, setActiveModule] = useState<StaffPermission>(() => {
    const fromUrl = resolveAdminModuleFromLocation();
    if (fromUrl && hasPermission(fromUrl)) return fromUrl;
    return user.role === 'staff' ? 'orders' : 'dashboard';
  });
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('month');
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);
  const [mobileNavOpen, setMobileNavOpen] = useState(false);

  const navItems: { id: StaffPermission; icon: React.ComponentType<{ className?: string }>; ar: string; en: string }[] = [
    { id: 'dashboard', icon: BarChart3, ar: 'لوحة الإحصائيات', en: 'Dashboard' },
    { id: 'products', icon: ShoppingBag, ar: 'المنتجات', en: 'Products' },
    { id: 'categories', icon: Layers, ar: 'التصنيفات والماركات', en: 'Categories & Brands' },
    { id: 'home_builder', icon: LayoutTemplate, ar: 'منشئ الرئيسية', en: 'Home Builder' },
    { id: 'banners', icon: ImageIcon, ar: 'البانرات الإعلانية', en: 'Banners' },
    { id: 'content', icon: FileText, ar: 'النصوص والسياسات', en: 'App Content' },
    { id: 'appearance', icon: Palette, ar: 'الشعار والألوان', en: 'Appearance' },
    { id: 'settings', icon: Settings, ar: 'إعدادات المتجر والفوتر', en: 'Store Settings' },
    { id: 'orders', icon: Package, ar: 'الطلبات وبنكك', en: 'Orders & Bankak' },
    { id: 'coupons', icon: Ticket, ar: 'الكوبونات', en: 'Coupons' },
    { id: 'notifications', icon: Bell, ar: 'الإشعارات', en: 'Notifications' },
    { id: 'consults', icon: Stethoscope, ar: 'الاستشارات البصرية', en: 'Consults' },
    { id: 'customers', icon: Users, ar: 'العملاء والتقييمات', en: 'Customers & Reviews' },
    { id: 'roles', icon: ShieldCheck, ar: 'الصلاحيات والمشرفون', en: 'Admin & Staff' },
  ];

  const allowedNav = navItems.filter((item) => hasPermission(item.id));

  useEffect(() => {
    if (!hasPermission(activeModule) && allowedNav.length > 0) {
      setActiveModule(allowedNav[0].id);
    }
  }, [activeModule, allowedNav, hasPermission]);

  const handleSelectModule = (id: StaffPermission) => {
    setActiveModule(id);
    setMobileNavOpen(false);
    if (typeof window !== 'undefined') {
      const targetUrl = id === 'dashboard' ? '/vp-admin' : `/vp-admin/${id}`;
      window.history.replaceState(null, '', targetUrl);
    }
  };

  const analytics = useMemo(() => {
    const now = Date.now();
    const dayMs = 86400000;
    const cutoff =
      period === 'today' ? now - dayMs : period === 'week' ? now - 7 * dayMs : now - 30 * dayMs;

    const nonCancelled = orders.filter((o) => o.status !== 'cancelled');
    const periodOrders = nonCancelled.filter((o) => new Date(o.createdAt).getTime() >= cutoff);
    const revenueSdg = periodOrders.reduce((s, o) => s + o.totalSdg, 0);
    const pendingBankak = orders.filter((o) => o.status === 'awaiting_payment_verification').length;
    const pendingCancelRequests = orders.filter((o) => o.cancelRequest?.status === 'pending').length;
    const lowStock = products.filter((p) => !p.isDeleted && p.stock <= 5);

    const productSales = new Map<string, { title: string; qty: number; sdg: number }>();
    nonCancelled.forEach((o) => {
      o.items.forEach((it) => {
        const prev = productSales.get(it.productId) || {
          title: locale === 'ar' ? it.titleAr : it.titleEn,
          qty: 0,
          sdg: 0,
        };
        productSales.set(it.productId, {
          title: prev.title,
          qty: prev.qty + it.quantity,
          sdg: prev.sdg + (it.unitPriceSdg + (it.lensExtraPriceSdg ?? it.prescription?.lensExtraPriceSdg ?? 0)) * it.quantity,
        });
      });
    });

    const topProducts = Array.from(productSales.values())
      .sort((a, b) => b.qty - a.qty)
      .slice(0, 5);

    return {
      revenueSdg,
      ordersCount: periodOrders.length,
      pendingBankak,
      pendingCancelRequests,
      lowStock,
      topProducts,
    };
  }, [orders, products, period, locale]);

  const handleShareInvoice = async (order: Order) => {
    const stateLabel =
      order.address?.stateNameAr ||
      settings.deliveryFees.find((s) => s.id === order.stateId)?.nameAr ||
      order.stateId;
    const lines = [
      `${settings.storeNameAr} — فاتورة #${order.id}`,
      `العميل: ${order.address?.recipientName || order.customerName} (${order.address?.phone || order.customerPhone})`,
      `العنوان: ${stateLabel} - ${order.address?.city || order.city} - ${order.address?.area || order.area}`,
      `المنتجات:`,
      ...order.items.map((it) => {
        const lensExtra = it.lensExtraPriceSdg ?? it.prescription?.lensExtraPriceSdg ?? 0;
        const lineTotal = (it.unitPriceSdg + lensExtra) * it.quantity;
        const rx = it.prescription;
        const lensLine = formatLensSummaryLine(rx, lensOptions, 'ar');
        const rightE = rx?.values?.rightEye || rx?.rightEye;
        const leftE = rx?.values?.leftEye || rx?.leftEye;
        const fh = rx?.values?.fittingHeight || rx?.fittingHeight;
        const lensTag = lensLine ? ` | العدسات: ${lensLine}` : '';
        const rxSummary =
          rx?.type === 'manual'
            ? rx.values?.kind === 'contact_lenses'
              ? ` | عدسات OD ${rx.values.contactRight?.sph || '-'} / OS ${rx.values.contactLeft?.sph || '-'}`
              : ` | نظارة OD ${rightE?.sph || '-'}/${rightE?.cyl || '0'} / OS ${leftE?.sph || '-'}/${leftE?.cyl || '0'}${fh ? ` | ارتفاع ${fh}mm` : ''}`
            : rx?.type === 'image'
            ? ' | روشتة مصورة'
            : rx?.type === 'later'
            ? ' | سيتم إرسال المقاس عبر الواتساب'
            : '';
        return `- ${it.titleAr} × ${it.quantity}: ${formatSdg(lineTotal)}${lensTag}${rxSummary}`;
      }),
      `الإجمالي: ${formatSdg(order.totalSdg)}`,
    ];
    const text = lines.join('\n');

    if (typeof navigator !== 'undefined' && navigator.share) {
      try {
        await navigator.share({
          title: `فاتورة ${order.id}`,
          text,
        });
        return;
      } catch {
        // User cancelled or share unsupported, fall through to clipboard
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      showToast(t('تم نسخ ملخص الفاتورة للمشاركة', 'Invoice summary copied to clipboard'));
    } catch {
      showToast(t('استخدم زر الطباعة لحفظ الفاتورة PDF', 'Use Print button to save PDF'));
    }
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
      {/* Top Admin Session Bar */}
      <div className="mb-4 bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-2xl px-4 py-3 flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-2.5">
          <button
            type="button"
            onClick={() => setMobileNavOpen(true)}
            aria-label={t('فتح قائمة الإدارة', 'Open Admin Menu')}
            className="lg:hidden min-h-[44px] min-w-[44px] rounded-xl border border-slate-200 dark:border-slate-700 flex items-center justify-center hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <Menu className="w-5 h-5" />
          </button>
          <div>
            <h1 className="text-base font-extrabold">{t('لوحة تحكم الإدارة', 'Admin Control Panel')}</h1>
            <p className="text-[11px] text-slate-500">
              {locale === 'ar' ? settings.storeNameAr : settings.storeNameEn} · {user.email}
            </p>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={navigateToHome}
            className="min-h-[44px] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-700 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-slate-50 dark:hover:bg-slate-800"
          >
            <ArrowRight className="w-4 h-4" />
            <span>{t('العودة إلى المتجر', 'Back to Store')}</span>
          </button>
          <button
            type="button"
            onClick={requestAdminLogout}
            className="min-h-[44px] px-3.5 py-2 rounded-xl bg-rose-50 dark:bg-rose-950/30 border border-rose-200 dark:border-rose-900/50 text-rose-700 dark:text-rose-300 text-xs font-extrabold inline-flex items-center gap-1.5 hover:bg-rose-100 dark:hover:bg-rose-950/50"
          >
            <LogOut className="w-4 h-4" />
            <span>{t('تسجيل الخروج', 'Sign Out')}</span>
          </button>
        </div>
      </div>

      {/* Mobile Slide-in Navigation Drawer */}
      {mobileNavOpen && (
        <div className="lg:hidden fixed inset-0 z-[70] bg-black/55 backdrop-blur-xs flex">
          <div className="w-72 max-w-[85vw] bg-white dark:bg-[#131C2E] h-full p-4 flex flex-col gap-1.5 overflow-y-auto border-e border-slate-200 dark:border-slate-800 shadow-2xl">
            <div className="flex items-center justify-between pb-3 mb-2 border-b border-slate-100 dark:border-slate-800">
              <div>
                <h2 className="text-sm font-extrabold">{t('أقسام الإدارة', 'Admin Modules')}</h2>
                <p className="text-[11px] text-slate-500">
                  {user.role === 'staff' ? t('صلاحية موظف: الطلبات فقط', 'Staff: Orders Only') : t('مدير عام', 'Full Admin')}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setMobileNavOpen(false)}
                aria-label={t('إغلاق القائمة', 'Close Menu')}
                className="min-h-[44px] min-w-[44px] rounded-xl flex items-center justify-center hover:bg-slate-100 dark:hover:bg-slate-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            {allowedNav.map((item) => {
              const Icon = item.icon;
              const active = activeModule === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => handleSelectModule(item.id)}
                  className={`min-h-[44px] px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between gap-2 text-start ${
                    active
                      ? 'bg-[#11223E] text-white dark:bg-[#D9B24C] dark:text-[#11223E]'
                      : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                  }`}
                >
                  <span className="flex items-center gap-2">
                    <Icon className="w-4 h-4 shrink-0" />
                    <span>{t(item.ar, item.en)}</span>
                  </span>
                  {item.id === 'orders' && analytics.pendingCancelRequests > 0 && (
                    <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-extrabold tabular-nums">
                      {analytics.pendingCancelRequests}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
          <button
            type="button"
            aria-label={t('إغلاق', 'Close backdrop')}
            onClick={() => setMobileNavOpen(false)}
            className="flex-1 h-full"
          />
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Desktop Sidebar Navigation */}
        <aside className="hidden lg:flex lg:col-span-3 bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex-col gap-1">
          <div className="px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
            <h2 className="text-sm font-extrabold">{t('أقسام الإدارة', 'Admin Modules')}</h2>
            <p className="text-[11px] text-slate-500">
              {user.role === 'staff' ? t('صلاحية موظف: الطلبات فقط', 'Staff: Orders Only') : t('مدير عام', 'Full Admin')}
            </p>
          </div>
          {allowedNav.map((item) => {
            const Icon = item.icon;
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => handleSelectModule(item.id)}
                className={`min-h-[44px] px-3 py-2.5 rounded-xl text-xs font-bold flex items-center justify-between gap-2 whitespace-nowrap transition-colors text-start ${
                  active
                    ? 'bg-[#11223E] text-white dark:bg-[#D9B24C] dark:text-[#11223E]'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <span className="flex items-center gap-2">
                  <Icon className="w-4 h-4 shrink-0" />
                  <span>{t(item.ar, item.en)}</span>
                </span>
                {item.id === 'orders' && analytics.pendingCancelRequests > 0 && (
                  <span className="px-1.5 py-0.5 rounded-full bg-rose-600 text-white text-[10px] font-extrabold tabular-nums">
                    {analytics.pendingCancelRequests}
                  </span>
                )}
              </button>
            );
          })}
          <div className="flex flex-col gap-1.5 pt-3 mt-2 border-t border-slate-100 dark:border-slate-800">
            <button
              type="button"
              onClick={requestAdminLogout}
              className="min-h-[44px] px-3 py-2 rounded-xl text-xs font-extrabold text-rose-700 dark:text-rose-300 hover:bg-rose-50 dark:hover:bg-rose-950/30 flex items-center gap-2 text-start"
            >
              <LogOut className="w-4 h-4 shrink-0" />
              <span>{t('تسجيل الخروج', 'Sign Out')}</span>
            </button>
          </div>
        </aside>

        {/* Active Admin Module */}
        <section className="lg:col-span-9 min-w-0 space-y-6">
          {activeModule === 'dashboard' && (
            <div className="space-y-6">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="text-xl font-extrabold">{t('ملخص المبيعات والأداء', 'Analytics Dashboard')}</h2>
                <div className="flex items-center gap-1 p-1 rounded-xl bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 text-xs">
                  {(['today', 'week', 'month'] as const).map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPeriod(p)}
                      className={`px-3 py-1.5 rounded-lg font-bold ${
                        period === p ? 'bg-[#11223E] text-white' : 'text-slate-600 dark:text-slate-300'
                      }`}
                    >
                      {p === 'today' ? t('اليوم', 'Today') : p === 'week' ? t('أسبوع', '7 Days') : t('شهر', '30 Days')}
                    </button>
                  ))}
                </div>
              </div>

              <div className="grid grid-cols-2 lg:grid-cols-5 gap-4">
                <div className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-4">
                  <span className="text-xs text-slate-500">{t('مبيعات الفترة (ج.س)', 'Period Sales')}</span>
                  <div className="font-mono-num text-xl font-extrabold text-[#11223E] dark:text-[#E2BD5B] mt-1 tabular-nums">
                    {formatSdg(analytics.revenueSdg)}
                  </div>
                </div>
                <div className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-4">
                  <span className="text-xs text-slate-500">{t('الطلبات', 'Orders')}</span>
                  <div className="font-mono-num text-xl font-extrabold mt-1 tabular-nums">
                    {analytics.ordersCount}
                  </div>
                </div>
                <div className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-4">
                  <span className="text-xs text-slate-500">{t('تحويلات بنكك معلقة', 'Pending Bankak')}</span>
                  <div className="font-mono-num text-xl font-extrabold text-amber-600 mt-1 tabular-nums">
                    {analytics.pendingBankak}
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => handleSelectModule('orders')}
                  className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-4 text-start hover:border-rose-400 transition-colors"
                >
                  <span className="text-xs text-slate-500">{t('طلبات إلغاء معلقة', 'Pending Cancellations')}</span>
                  <div className="font-mono-num text-xl font-extrabold text-rose-600 mt-1 tabular-nums">
                    {analytics.pendingCancelRequests}
                  </div>
                </button>
                <div className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-4">
                  <span className="text-xs text-slate-500">{t('نواقص المخزون', 'Low Stock')}</span>
                  <div className="font-mono-num text-xl font-extrabold text-rose-600 mt-1 tabular-nums">
                    {analytics.lowStock.length}
                  </div>
                </div>
              </div>

              <div className="grid md:grid-cols-2 gap-6">
                <div className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-5 space-y-3 text-xs">
                  <h3 className="text-sm font-bold">{t('الأكثر مبيعاً', 'Top Selling Products')}</h3>
                  <div className="divide-y divide-stone-100 dark:divide-zinc-800">
                    {analytics.topProducts.map((tp, idx) => (
                      <div key={idx} className="py-2.5 flex items-center justify-between gap-2">
                        <span className="font-semibold truncate">{tp.title}</span>
                        <span className="font-mono-num font-bold shrink-0 tabular-nums">
                          {tp.qty} × ({formatSdg(tp.sdg)})
                        </span>
                      </div>
                    ))}
                  </div>
                </div>

                <div className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-5 space-y-3 text-xs">
                  <h3 className="text-sm font-bold flex items-center gap-2">
                    <AlertTriangle className="w-4 h-4 text-amber-600" />
                    {t('تنبيهات نفاد المخزون (≤ 5)', 'Low Stock Alerts (≤ 5)')}
                  </h3>
                  <div className="divide-y divide-stone-100 dark:divide-zinc-800">
                    {analytics.lowStock.map((p) => (
                      <div key={p.id} className="py-2.5 flex items-center justify-between gap-2">
                        <span className="font-semibold truncate">{locale === 'ar' ? p.titleAr : p.titleEn}</span>
                        <span className="font-mono-num font-bold text-rose-600 shrink-0 tabular-nums">
                          {p.stock} {t('متبقي', 'left')}
                        </span>
                      </div>
                    ))}
                  </div>
                </div>
              </div>
            </div>
          )}

          {activeModule === 'products' && <AdminProductsModule />}
          {activeModule === 'categories' && <AdminCategoriesBrandsModule />}
          {activeModule === 'home_builder' && <AdminHomeBuilderModule />}
          {activeModule === 'banners' && <AdminBannersModule />}
          {activeModule === 'content' && <AdminContentTextsModule />}
          {activeModule === 'appearance' && <AdminAppearanceModule />}
          {activeModule === 'settings' && <AdminStoreSettingsModule />}
          {activeModule === 'orders' && <AdminOrdersModule onPrintInvoice={setInvoiceOrder} />}
          {activeModule === 'coupons' && <AdminCouponsModule />}
          {activeModule === 'notifications' && <AdminNotificationsModule />}
          {activeModule === 'consults' && <AdminConsultsModule />}
          {activeModule === 'customers' && <AdminCustomersReviewsModule />}
          {activeModule === 'roles' && <AdminRolesModule />}
        </section>
      </div>

      {/* Printable Invoice Modal (includes full Rx specs, address & SDG breakdown) */}
      {invoiceOrder && (() => {
        const invItemsSubtotal =
          invoiceOrder.itemsSubtotalSdg ??
          invoiceOrder.items.reduce((s, it) => s + it.unitPriceSdg * it.quantity, 0);
        const invLensTotal =
          invoiceOrder.lensOptionsTotalSdg ??
          invoiceOrder.items.reduce(
            (s, it) => s + (it.lensExtraPriceSdg ?? it.prescription?.lensExtraPriceSdg ?? 0) * it.quantity,
            0
          );
        const stateObj = settings.deliveryFees.find((st) => st.id === invoiceOrder.stateId);
        const stateLabel =
          locale === 'ar'
            ? invoiceOrder.address?.stateNameAr || stateObj?.nameAr || invoiceOrder.stateId
            : invoiceOrder.address?.stateNameEn || stateObj?.nameEn || invoiceOrder.stateId;

        return (
          <div className="fixed inset-0 z-50 bg-black/65 flex items-center justify-center p-3 sm:p-4 overflow-y-auto">
            <div
              id="vp-printable-invoice"
              className="bg-white text-stone-900 rounded-2xl max-w-2xl w-full max-h-[92vh] overflow-y-auto p-5 sm:p-6 space-y-4 shadow-2xl"
            >
              {/* Header */}
              <div className="flex items-start justify-between border-b border-stone-200 pb-3 gap-3">
                <div>
                  <h3 className="font-extrabold text-lg text-[#11223E]">
                    {settings.storeNameAr || 'فيجن بلس'} — {settings.storeNameEn || 'Vision Plus'}
                  </h3>
                  <p className="text-[11px] text-stone-500">
                    {settings.phone} · {locale === 'ar' ? settings.addressAr : settings.addressEn}
                  </p>
                  <div className="mt-1 flex flex-wrap items-center gap-2 text-xs">
                    <span className="font-mono-num font-bold bg-stone-100 px-2 py-0.5 rounded">
                      #{invoiceOrder.id}
                    </span>
                    <span className="text-stone-500 font-mono-num">
                      {formatShortDate(invoiceOrder.createdAt, locale)}
                    </span>
                    <span className="px-2 py-0.5 rounded bg-stone-100 font-semibold">
                      {getOrderStatusLabel(invoiceOrder.status, locale)}
                    </span>
                  </div>
                </div>
                <button
                  type="button"
                  onClick={() => setInvoiceOrder(null)}
                  className="no-print min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl hover:bg-stone-100"
                  aria-label={t('إغلاق', 'Close')}
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              {/* Customer & Address Block */}
              <div className="grid sm:grid-cols-2 gap-3 p-3 rounded-xl bg-stone-50 border border-stone-200 text-xs">
                <div className="space-y-1">
                  <div>
                    <strong>{t('المستلم:', 'Recipient:')}</strong>{' '}
                    {invoiceOrder.address?.recipientName || invoiceOrder.customerName}
                  </div>
                  <div>
                    <strong>{t('الهاتف:', 'Phone:')}</strong>{' '}
                    <span dir="ltr" className="font-mono-num">
                      {invoiceOrder.address?.phone || invoiceOrder.customerPhone}
                    </span>
                  </div>
                  <div>
                    <strong>{t('طريقة الدفع:', 'Payment:')}</strong>{' '}
                    {invoiceOrder.paymentMethod === 'bankak'
                      ? t('تحويل بنكك', 'Bankak Transfer')
                      : t('الدفع عند الاستلام', 'Cash on Delivery')}
                    {invoiceOrder.bankTransferReference
                      ? ` (${invoiceOrder.bankTransferReference})`
                      : ''}
                  </div>
                </div>
                <div className="space-y-1">
                  <div>
                    <strong>{t('الولاية / المدينة:', 'State / City:')}</strong> {stateLabel} —{' '}
                    {invoiceOrder.address?.city || invoiceOrder.city}
                  </div>
                  <div>
                    <strong>{t('المنطقة:', 'Area:')}</strong>{' '}
                    {invoiceOrder.address?.area || invoiceOrder.area}
                  </div>
                  <div>
                    <strong>{t('الشارع / المعلم:', 'Street / Landmark:')}</strong>{' '}
                    {invoiceOrder.address?.details || invoiceOrder.addressDetails}
                  </div>
                </div>
              </div>

              {/* Line Items & Prescriptions */}
              <div className="border-t border-b border-stone-200 py-3 space-y-3 text-xs">
                {invoiceOrder.items.map((it, idx) => {
                  const lensExtra = it.lensExtraPriceSdg ?? it.prescription?.lensExtraPriceSdg ?? 0;
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
                  const vt = resolveVisionType(syntheticRx);
                  const extras = resolveExtraOptions(syntheticRx);
                  const pricing = calculateLensPricingBreakdown(vt, extras, lensOptions);
                  const vtPrice = rx?.visionTypePriceSdg ?? pricing.visionTypePriceSdg;
                  const mirrorClr = rx?.mirrorColor || it.mirrorColor;
                  const lensLine = formatLensSummaryLine(syntheticRx, lensOptions, locale);
                  const hasCustomLens = hasCustomLensOrRx(syntheticRx);
                  const lineTotal = (it.unitPriceSdg + lensExtra) * it.quantity;
                  const optEntries = Object.entries(it.options || {}).filter(([, val]) => Boolean(val));
                  const rightEye = rx?.values?.rightEye || rx?.rightEye;
                  const leftEye = rx?.values?.leftEye || rx?.leftEye;
                  const pdMode = rx?.values?.pdMode || rx?.pdMode;
                  const pdSingle = rx?.values?.pd || rx?.pd;
                  const pdRight = rx?.values?.pdRight || rx?.pdRight;
                  const pdLeft = rx?.values?.pdLeft || rx?.pdLeft;
                  const fittingHeight = rx?.values?.fittingHeight || rx?.fittingHeight;

                  return (
                    <div
                      key={idx}
                      className="p-3 rounded-xl border border-stone-200 bg-white space-y-2"
                    >
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <div className="font-bold text-sm">
                            {locale === 'ar' ? it.titleAr : it.titleEn}
                          </div>
                          <div className="text-[11px] text-stone-500 flex flex-wrap gap-2 mt-0.5">
                            {it.variantLabel && <span>{it.variantLabel}</span>}
                            {optEntries.map(([k, v]) => (
                              <span key={k}>
                                {k}: {String(v)}
                              </span>
                            ))}
                            <span>
                              {t('سعر الوحدة:', 'Unit:')} {formatSdg(it.unitPriceSdg)}
                            </span>
                            {lensExtra > 0 && (
                              <span>
                                · {lensLine || t('إضافات العدسات', 'Lens Options')} (+{formatSdg(lensExtra)})
                              </span>
                            )}
                            <span>
                              · {t('الكمية:', 'Qty:')} ×{it.quantity}
                            </span>
                          </div>
                        </div>
                        <span className="font-mono-num font-extrabold text-sm shrink-0">
                          {formatSdg(lineTotal)}
                        </span>
                      </div>

                      {(vt !== 'none' || extras.length > 0) && (
                        <div className="p-2 rounded-lg bg-stone-50 border border-stone-200 space-y-1 text-[11px]">
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

                      {/* Prescription Details in Invoice */}
                      {rx && rx.type === 'manual' && (rx.values?.kind === 'contact_lenses' || rightEye || leftEye) && (
                        <div className="p-2.5 rounded-lg bg-stone-50 border border-stone-200 space-y-1.5 text-[11px]">
                          <div className="font-bold text-[#11223E]">
                            {rx.values?.kind === 'contact_lenses'
                              ? t('مقاس العدسات اللاصقة (Rx)', 'Contact Lens Prescription')
                              : t('مقاس النظارة الطبية (Rx)', 'Eyeglasses Prescription')}
                            {lensLine ? ` · ${lensLine}` : ''}
                          </div>

                          {rx.values?.kind === 'contact_lenses' ? (
                            <table className="w-full text-center font-mono-num border border-stone-300 border-collapse">
                              <thead className="bg-stone-200/70">
                                <tr>
                                  <th className="p-1 border border-stone-300">{t('العين', 'Eye')}</th>
                                  <th className="p-1 border border-stone-300">SPH</th>
                                  <th className="p-1 border border-stone-300">CYL</th>
                                  <th className="p-1 border border-stone-300">AXIS</th>
                                  <th className="p-1 border border-stone-300">BC</th>
                                  <th className="p-1 border border-stone-300">DIA</th>
                                  <th className="p-1 border border-stone-300">{t('العلب', 'Boxes')}</th>
                                </tr>
                              </thead>
                              <tbody>
                                <tr>
                                  <td className="p-1 border border-stone-300 font-bold">OD (R)</td>
                                  <td className="p-1 border border-stone-300">{rx.values.contactRight?.sph || '-'}</td>
                                  <td className="p-1 border border-stone-300">{rx.values.contactRight?.cyl || '-'}</td>
                                  <td className="p-1 border border-stone-300">{rx.values.contactRight?.axis || '-'}</td>
                                  <td className="p-1 border border-stone-300">{rx.values.contactRight?.bc || '-'}</td>
                                  <td className="p-1 border border-stone-300">{rx.values.contactRight?.dia || '-'}</td>
                                  <td className="p-1 border border-stone-300">{rx.values.contactRight?.boxes ?? '-'}</td>
                                </tr>
                                <tr>
                                  <td className="p-1 border border-stone-300 font-bold">OS (L)</td>
                                  <td className="p-1 border border-stone-300">{rx.values.contactLeft?.sph || '-'}</td>
                                  <td className="p-1 border border-stone-300">{rx.values.contactLeft?.cyl || '-'}</td>
                                  <td className="p-1 border border-stone-300">{rx.values.contactLeft?.axis || '-'}</td>
                                  <td className="p-1 border border-stone-300">{rx.values.contactLeft?.bc || '-'}</td>
                                  <td className="p-1 border border-stone-300">{rx.values.contactLeft?.dia || '-'}</td>
                                  <td className="p-1 border border-stone-300">{rx.values.contactLeft?.boxes ?? '-'}</td>
                                </tr>
                              </tbody>
                            </table>
                          ) : (
                            <div className="space-y-1">
                              <table className="w-full text-center font-mono-num border border-stone-300 border-collapse">
                                <thead className="bg-stone-200/70">
                                  <tr>
                                    <th className="p-1 border border-stone-300">{t('العين', 'Eye')}</th>
                                    <th className="p-1 border border-stone-300">SPH</th>
                                    <th className="p-1 border border-stone-300">CYL</th>
                                    <th className="p-1 border border-stone-300">AXIS</th>
                                    <th className="p-1 border border-stone-300">ADD</th>
                                    <th className="p-1 border border-stone-300">PD</th>
                                  </tr>
                                </thead>
                                <tbody>
                                  <tr>
                                    <td className="p-1 border border-stone-300 font-bold">OD (R)</td>
                                    <td className="p-1 border border-stone-300">{rightEye?.sph || '-'}</td>
                                    <td className="p-1 border border-stone-300">{rightEye?.cyl || '0.00'}</td>
                                    <td className="p-1 border border-stone-300">{rightEye?.axis || '-'}</td>
                                    <td className="p-1 border border-stone-300">{rightEye?.add || '-'}</td>
                                    <td className="p-1 border border-stone-300">
                                      {pdMode === 'dual' ? pdRight || '-' : pdSingle || '-'}
                                    </td>
                                  </tr>
                                  <tr>
                                    <td className="p-1 border border-stone-300 font-bold">OS (L)</td>
                                    <td className="p-1 border border-stone-300">{leftEye?.sph || '-'}</td>
                                    <td className="p-1 border border-stone-300">{leftEye?.cyl || '0.00'}</td>
                                    <td className="p-1 border border-stone-300">{leftEye?.axis || '-'}</td>
                                    <td className="p-1 border border-stone-300">{leftEye?.add || '-'}</td>
                                    <td className="p-1 border border-stone-300">
                                      {pdMode === 'dual' ? pdLeft || '-' : pdSingle || '-'}
                                    </td>
                                  </tr>
                                </tbody>
                              </table>
                              {fittingHeight && (
                                <div className="font-mono-num text-[11px] font-semibold">
                                  {t('ارتفاع التركيب (Fitting Height):', 'Fitting Height:')} {fittingHeight} mm
                                </div>
                              )}
                            </div>
                          )}

                          {rx.notes && (
                            <p className="text-stone-600">
                              <strong>{t('ملاحظة:', 'Note:')}</strong> {rx.notes}
                            </p>
                          )}
                        </div>
                      )}

                      {rx && rx.type === 'image' && rx.imageUrl && (
                        <div className="p-2 rounded-lg bg-stone-50 border border-stone-200 flex items-center gap-3">
                          <img
                            src={rx.imageUrl}
                            alt={t('صورة الروشتة', 'Prescription image')}
                            className="w-16 h-16 object-cover rounded border border-stone-300"
                          />
                          <div className="text-[11px] space-y-0.5">
                            <div className="font-bold text-[#11223E]">
                              {t('صورة الروشتة الطبية مرفقة', 'Prescription photo attached')}
                            </div>
                            {lensLine && <div>{lensLine}</div>}
                            {rx.notes && <div className="text-stone-600">{rx.notes}</div>}
                          </div>
                        </div>
                      )}

                      {rx && rx.type === 'later' && (
                        <div className="text-[11px] text-amber-800 bg-amber-50 px-2.5 py-1.5 rounded-lg border border-amber-200 font-semibold">
                          {t('سيتم إرسال مقاس النظر لاحقاً عبر الواتساب', 'Rx will be sent later via WhatsApp')}
                          {lensLine ? ` · ${lensLine}` : ''}
                        </div>
                      )}

                      {!hasCustomLens && (
                        <div className="text-[11px] text-stone-500">
                          {t('بدون مقاس نظر مرفق', 'No prescription attached')}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>

              {/* Totals Summary */}
              <div className="space-y-1.5 text-xs">
                <div className="flex justify-between">
                  <span className="text-stone-600">{t('مجموع المنتجات', 'Items Subtotal')}</span>
                  <span className="font-mono-num font-bold">{formatSdg(invItemsSubtotal)}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-stone-600">{t('إضافات العدسات', 'Lens Options')}</span>
                  <span className="font-mono-num font-bold">{formatSdg(invLensTotal)}</span>
                </div>
                {invoiceOrder.discountSdg > 0 && (
                  <div className="flex justify-between text-emerald-700">
                    <span>
                      {t('خصم الكوبون', 'Coupon Discount')}
                      {invoiceOrder.couponCode ? ` (${invoiceOrder.couponCode})` : ''}
                    </span>
                    <span className="font-mono-num font-bold">-{formatSdg(invoiceOrder.discountSdg)}</span>
                  </div>
                )}
                <div className="flex justify-between">
                  <span className="text-stone-600">
                    {t('رسوم التوصيل', 'Delivery Fee')} ({stateLabel})
                  </span>
                  <span className="font-mono-num font-bold">{formatSdg(invoiceOrder.deliveryFeeSdg)}</span>
                </div>
                <div className="flex justify-between font-extrabold text-base pt-2 border-t border-stone-200 text-[#11223E]">
                  <span>{t('الإجمالي النهائي', 'Total Amount')}</span>
                  <span className="font-mono-num">{formatSdg(invoiceOrder.totalSdg)}</span>
                </div>
              </div>

              {/* Actions */}
              <div className="no-print flex flex-wrap justify-end gap-2 pt-2 border-t border-stone-200">
                <button
                  type="button"
                  onClick={() => void handleShareInvoice(invoiceOrder)}
                  className="min-h-[44px] px-4 py-2 rounded-xl border border-stone-300 text-stone-800 text-xs font-bold inline-flex items-center gap-1.5 hover:bg-stone-50"
                >
                  <Share2 className="w-4 h-4" />
                  {t('مشاركة الفاتورة', 'Share Invoice')}
                </button>
                <button
                  type="button"
                  onClick={() => window.print()}
                  className="min-h-[44px] px-5 py-2 rounded-xl bg-[#11223E] text-white text-xs font-bold inline-flex items-center gap-1.5 hover:opacity-90"
                >
                  <Printer className="w-4 h-4" />
                  {t('طباعة / حفظ PDF', 'Print / Save PDF')}
                </button>
              </div>
            </div>
          </div>
        );
      })()}
    </div>
  );
};
