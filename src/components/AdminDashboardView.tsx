import React, { useMemo, useState } from 'react';
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
  AlertTriangle,
  X,
} from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { Order, StaffPermission } from '../types';
import { formatSdg } from '../utils/format';
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
  const { locale, t, products, orders, settings, hasPermission } = useStore();
  const [activeModule, setActiveModule] = useState<StaffPermission>('dashboard');
  const [period, setPeriod] = useState<'today' | 'week' | 'month'>('month');
  const [invoiceOrder, setInvoiceOrder] = useState<Order | null>(null);

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

  const analytics = useMemo(() => {
    const now = Date.now();
    const dayMs = 86400000;
    const cutoff =
      period === 'today' ? now - dayMs : period === 'week' ? now - 7 * dayMs : now - 30 * dayMs;

    const nonCancelled = orders.filter((o) => o.status !== 'cancelled');
    const periodOrders = nonCancelled.filter((o) => new Date(o.createdAt).getTime() >= cutoff);
    const revenueSdg = periodOrders.reduce((s, o) => s + o.totalSdg, 0);
    const pendingBankak = orders.filter((o) => o.status === 'awaiting_payment_verification').length;
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
          sdg: prev.sdg + it.unitPriceSdg * it.quantity,
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
      lowStock,
      topProducts,
    };
  }, [orders, products, period, locale]);

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6">
      <div className="grid lg:grid-cols-12 gap-6 items-start">
        {/* Sidebar Navigation */}
        <aside className="lg:col-span-3 bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-2xl p-3 flex lg:flex-col gap-1 overflow-x-auto">
          <div className="hidden lg:block px-3 py-2 border-b border-slate-100 dark:border-slate-800 mb-1">
            <h1 className="text-base font-extrabold">{t('لوحة تحكم المالك', 'Owner Control Panel')}</h1>
            <p className="text-[11px] text-slate-500">
              {locale === 'ar' ? settings.storeNameAr : settings.storeNameEn}
            </p>
          </div>
          {allowedNav.map((item) => {
            const Icon = item.icon;
            const active = activeModule === item.id;
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => setActiveModule(item.id)}
                className={`px-3 py-2.5 rounded-xl text-xs font-bold flex items-center gap-2 whitespace-nowrap transition-colors text-start ${
                  active
                    ? 'bg-[#11223E] text-white dark:bg-[#D9B24C] dark:text-[#11223E]'
                    : 'text-slate-600 dark:text-slate-300 hover:bg-slate-100 dark:hover:bg-slate-800'
                }`}
              >
                <Icon className="w-4 h-4 shrink-0" />
                <span>{t(item.ar, item.en)}</span>
              </button>
            );
          })}
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

              <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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

      {/* Printable Invoice Modal */}
      {invoiceOrder && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4">
          <div className="bg-white text-stone-900 rounded-2xl max-w-lg w-full p-6 space-y-4 shadow-2xl">
            <div className="flex items-center justify-between border-b border-stone-200 pb-3">
              <div>
                <h3 className="font-extrabold text-base">
                  {locale === 'ar' ? settings.storeNameAr : settings.storeNameEn} — Vision Plus
                </h3>
                <p className="text-xs text-stone-500 font-mono-num">{invoiceOrder.id}</p>
              </div>
              <button type="button" onClick={() => setInvoiceOrder(null)} className="p-1">
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="text-xs space-y-1">
              <div><strong>{t('العميل:', 'Customer:')}</strong> {invoiceOrder.customerName}</div>
              <div><strong>{t('الهاتف:', 'Phone:')}</strong> {invoiceOrder.customerPhone}</div>
              <div><strong>{t('العنوان:', 'Address:')}</strong> {invoiceOrder.city} — {invoiceOrder.area}</div>
            </div>
            <div className="border-t border-b border-stone-200 py-3 space-y-2 text-xs">
              {invoiceOrder.items.map((it, idx) => (
                <div key={idx} className="flex justify-between">
                  <span>{locale === 'ar' ? it.titleAr : it.titleEn} × {it.quantity}</span>
                  <span className="font-mono-num font-bold">
                    {formatSdg((it.unitPriceSdg + (it.prescription?.lensExtraPriceSdg || 0)) * it.quantity)}
                  </span>
                </div>
              ))}
            </div>
            <div className="flex justify-between font-extrabold text-sm">
              <span>{t('الإجمالي (شامل التوصيل)', 'Total (incl. delivery)')}</span>
              <span className="font-mono-num">{formatSdg(invoiceOrder.totalSdg)}</span>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => window.print()}
                className="px-4 py-2 rounded-lg bg-[#11223E] text-white text-xs font-bold inline-flex items-center gap-1.5"
              >
                <Printer className="w-4 h-4" />
                {t('طباعة الفاتورة', 'Print Invoice')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
