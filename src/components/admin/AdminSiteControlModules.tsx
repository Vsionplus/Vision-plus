import React, { useEffect, useRef, useState } from 'react';
import {
  ArrowUp,
  ArrowDown,
  Plus,
  Trash2,
  Upload,
  Palette,
  LayoutTemplate,
  Image as ImageIcon,
  FileText,
  Settings,
} from 'lucide-react';
import { doc, getDoc } from 'firebase/firestore';
import { db, uploadAdminImage } from '../../lib/firebase';
import { hasLegacyBrandString, normalizeStoreSettings, useStore } from '../../store/StoreContext';
import { BannerAd, HomeSectionConfig, StoreSettings } from '../../types';
import { IMG_HERO_BOUTIQUE } from '../../data/seedData';
import { EXTRA_OPTION_IDS, VISION_TYPE_IDS } from '../../utils/prescription';
import { ResilientImage } from '../ResilientImage';
import { useAdminSecurity } from './AdminGuard';

export const AdminHomeBuilderModule: React.FC = () => {
  const { locale, t, homeSections, updateHomeSections } = useStore();
  const [draft, setDraft] = useState<HomeSectionConfig[]>(
    homeSections.slice().sort((a, b) => a.order - b.order)
  );

  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= draft.length) return;
    const next = [...draft];
    [next[idx], next[target]] = [next[target], next[idx]];
    setDraft(next.map((s, i) => ({ ...s, order: i + 1 })));
  };

  return (
    <div className="space-y-4 text-xs">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2 font-bold text-sm">
          <LayoutTemplate className="w-4 h-4 text-[#D9B24C]" />
          {t('منشئ أقسام الصفحة الرئيسية (تشغيل/إيقاف وإعادة ترتيب)', 'Home Page Section Builder')}
        </div>
        <button
          type="button"
          onClick={() => updateHomeSections(draft)}
          className="px-5 py-2 rounded-xl bg-[#D9B24C] text-[#11223E] font-extrabold"
        >
          {t('حفظ وتطبيق على المتجر', 'Save Home Layout')}
        </button>
      </div>

      <div className="space-y-3">
        {draft.map((sec, idx) => (
          <div key={sec.id} className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-4 space-y-3">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2">
                <span className="font-mono-num px-2 py-0.5 rounded bg-slate-100 dark:bg-zinc-900 font-bold">
                  0{idx + 1}
                </span>
                <span className="font-extrabold text-sm">{locale === 'ar' ? sec.titleAr : sec.titleEn}</span>
              </div>

              <div className="flex items-center gap-2">
                <button type="button" onClick={() => move(idx, -1)} disabled={idx === 0} className="p-1.5 rounded border disabled:opacity-30">
                  <ArrowUp className="w-3.5 h-3.5" />
                </button>
                <button type="button" onClick={() => move(idx, 1)} disabled={idx === draft.length - 1} className="p-1.5 rounded border disabled:opacity-30">
                  <ArrowDown className="w-3.5 h-3.5" />
                </button>
                <select
                  value={sec.styleVariant}
                  onChange={(e) =>
                    setDraft(draft.map((s, i) => (i === idx ? { ...s, styleVariant: e.target.value as HomeSectionConfig['styleVariant'] } : s)))
                  }
                  className="px-2 py-1 rounded border bg-stone-50 dark:bg-zinc-900"
                >
                  <option value="default">{t('نمط قياسي', 'Default Style')}</option>
                  <option value="compact">{t('نمط مضغوط', 'Compact Style')}</option>
                  <option value="highlight">{t('نمط مميز', 'Highlight Style')}</option>
                </select>
                <button
                  type="button"
                  onClick={() =>
                    setDraft(draft.map((s, i) => (i === idx ? { ...s, enabled: !s.enabled } : s)))
                  }
                  className={`px-3 py-1 rounded-lg font-bold ${
                    sec.enabled ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                  }`}
                >
                  {sec.enabled ? t('مفعل', 'Enabled') : t('معطل', 'Off')}
                </button>
              </div>
            </div>

            <div className="grid sm:grid-cols-2 gap-2">
              <input
                value={sec.titleAr}
                onChange={(e) => setDraft(draft.map((s, i) => (i === idx ? { ...s, titleAr: e.target.value } : s)))}
                placeholder={t('عنوان القسم (عربي)', 'Title (AR)')}
                className="px-3 py-1.5 rounded-lg border bg-stone-50 dark:bg-zinc-900"
              />
              <input
                value={sec.titleEn}
                onChange={(e) => setDraft(draft.map((s, i) => (i === idx ? { ...s, titleEn: e.target.value } : s)))}
                placeholder={t('عنوان القسم (إنجليزي)', 'Title (EN)')}
                className="px-3 py-1.5 rounded-lg border bg-stone-50 dark:bg-zinc-900"
              />
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export const AdminBannersModule: React.FC = () => {
  const { locale, t, banners, categories, products, upsertBanner, deleteBanner, showToast } = useStore();
  const [editingBannerId, setEditingBannerId] = useState<string | null>(null);
  const [confirmDeleteBannerId, setConfirmDeleteBannerId] = useState<string | null>(null);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [titleAr, setTitleAr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [subAr, setSubAr] = useState('');
  const [ctaAr, setCtaAr] = useState('تسوق الآن');
  const [placement, setPlacement] = useState<'home_top' | 'home_middle'>('home_top');
  const [targetType, setTargetType] = useState<BannerAd['targetType']>('category');
  const [targetValue, setTargetValue] = useState('frames');
  const [image, setImage] = useState(IMG_HERO_BOUTIQUE);
  const [startDate, setStartDate] = useState('2026-01-01');
  const [endDate, setEndDate] = useState('2027-12-31');
  const [order, setOrder] = useState('1');

  const resetForm = () => {
    setEditingBannerId(null);
    setTitleAr('');
    setTitleEn('');
    setSubAr('');
    setCtaAr('تسوق الآن');
    setPlacement('home_top');
    setTargetType('category');
    setTargetValue('frames');
    setImage(IMG_HERO_BOUTIQUE);
    setStartDate('2026-01-01');
    setEndDate('2027-12-31');
    setOrder('1');
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!titleAr.trim()) return;
    const existing = banners.find((b) => b.id === editingBannerId);
    upsertBanner({
      id: existing ? existing.id : `b_${Date.now()}`,
      titleAr: titleAr.trim(),
      titleEn: titleEn.trim() || titleAr.trim(),
      subtitleAr: subAr.trim(),
      subtitleEn: subAr.trim(),
      ctaAr: ctaAr.trim() || 'تصفح',
      ctaEn: ctaAr.trim() || 'Explore',
      image,
      placement,
      targetType,
      targetValue,
      order: Number(order) || 1,
      isActive: existing ? existing.isActive : true,
      startDate,
      endDate,
    });
    resetForm();
  };

  return (
    <div className="grid lg:grid-cols-12 gap-6 items-start text-xs">
      <form onSubmit={handleSave} className="lg:col-span-6 bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-5 space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 className="text-base font-bold flex items-center gap-2">
            <ImageIcon className="w-4 h-4 text-[#D9B24C]" />
            {editingBannerId
              ? t('تعديل البانر الإعلاني + معاينة مباشرة', 'Edit Banner + Live Preview')
              : t('إضافة بانر إعلاني + معاينة مباشرة', 'Add Banner + Live Preview')}
          </h2>
          {editingBannerId && (
            <button type="button" onClick={resetForm} className="text-rose-600 font-bold">
              {t('إلغاء التعديل', 'Cancel Edit')}
            </button>
          )}
        </div>

        {/* Live Banner Preview */}
        <div className="relative h-36 rounded-2xl overflow-hidden bg-[#11223E]">
          <ResilientImage src={image} alt="Banner Preview" className="w-full h-full object-cover opacity-75" />
          <div className="absolute inset-0 p-4 flex flex-col justify-between bg-gradient-to-t from-black/75 to-transparent text-white">
            <div>
              <div className="font-extrabold text-sm">{titleAr || t('عنوان البانر يظهر هنا', 'Banner Headline Preview')}</div>
              <div className="text-[11px] text-slate-200 line-clamp-1">{subAr || t('الوصف الفرعي للإعلان', 'Campaign subtitle')}</div>
            </div>
            <span className="self-start px-3 py-1 rounded-lg bg-[#D9B24C] text-[#11223E] font-extrabold text-[11px]">
              {ctaAr}
            </span>
          </div>
        </div>

        <div className="grid sm:grid-cols-2 gap-2">
          <input required value={titleAr} onChange={(e) => setTitleAr(e.target.value)} placeholder={t('العنوان (عربي)*', 'Title (AR)*')} className="px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900" />
          <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} placeholder={t('العنوان (إنجليزي)', 'Title (EN)')} className="px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900" />
          <input value={subAr} onChange={(e) => setSubAr(e.target.value)} placeholder={t('الوصف الفرعي', 'Subtitle')} className="px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900" />
          <input value={ctaAr} onChange={(e) => setCtaAr(e.target.value)} placeholder={t('نص الزر', 'CTA Button Label')} className="px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900" />
        </div>

        <div className="grid sm:grid-cols-3 gap-2">
          <select value={placement} onChange={(e) => setPlacement(e.target.value as typeof placement)} className="px-2.5 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900">
            <option value="home_top">{t('بانر أعلى الرئيسية', 'Top Hero Carousel')}</option>
            <option value="home_middle">{t('بانر منتصف الصفحة', 'Mid-Page Slot')}</option>
          </select>
          <select value={targetType} onChange={(e) => setTargetType(e.target.value as BannerAd['targetType'])} className="px-2.5 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900">
            <option value="category">{t('يفتح تصنيف', 'Open Category')}</option>
            <option value="product">{t('يفتح منتج', 'Open Product')}</option>
            <option value="consult">{t('يفتح الاستشارات', 'Open Consult')}</option>
            <option value="url">{t('رابط خارجي', 'External URL')}</option>
          </select>
          {targetType === 'category' ? (
            <select value={targetValue} onChange={(e) => setTargetValue(e.target.value)} className="px-2.5 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900">
              {categories.map((c) => <option key={c.id} value={c.id}>{locale === 'ar' ? c.nameAr : c.nameEn}</option>)}
            </select>
          ) : targetType === 'product' ? (
            <select value={targetValue} onChange={(e) => setTargetValue(e.target.value)} className="px-2.5 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900">
              {products.map((p) => <option key={p.id} value={p.id}>{locale === 'ar' ? p.titleAr : p.titleEn}</option>)}
            </select>
          ) : (
            <input value={targetValue} onChange={(e) => setTargetValue(e.target.value)} placeholder="https://..." className="px-2.5 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900" />
          )}
        </div>

        <div className="grid sm:grid-cols-3 gap-2">
          <input type="date" value={startDate} onChange={(e) => setStartDate(e.target.value)} className="px-2.5 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900 font-mono-num" />
          <input type="date" value={endDate} onChange={(e) => setEndDate(e.target.value)} className="px-2.5 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900 font-mono-num" />
          <input type="number" value={order} onChange={(e) => setOrder(e.target.value)} placeholder={t('الترتيب', 'Order')} className="px-2.5 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900 font-mono-num" />
        </div>

        {uploadPct !== null && (
          <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
            <div className="h-full bg-[#D9B24C] transition-all" style={{ width: `${uploadPct}%` }} />
          </div>
        )}

        <div className="flex items-center justify-between pt-2">
          <label className="min-h-[44px] px-3 py-2 rounded-lg border font-bold cursor-pointer inline-flex items-center gap-1.5">
            <Upload className="w-3.5 h-3.5" />
            {t('رفع صورة البانر', 'Upload Banner Image')}
            <input
              type="file"
              accept="image/*"
              className="hidden"
              onChange={async (e) => {
                const f = e.target.files?.[0];
                if (!f) return;
                setUploadPct(10);
                const url = await uploadAdminImage('banners', f, (pct) => setUploadPct(Math.max(10, pct)));
                setImage(url);
                window.setTimeout(() => setUploadPct(null), 500);
                showToast(t('تم رفع صورة البانر', 'Banner image uploaded'));
              }}
            />
          </label>
          <button type="submit" className="min-h-[44px] px-5 py-2 rounded-xl bg-[#D9B24C] text-[#11223E] font-extrabold">
            {editingBannerId ? t('تحديث البانر', 'Update Banner') : t('حفظ البانر', 'Save Banner')}
          </button>
        </div>
      </form>

      <div className="lg:col-span-6 space-y-3">
        {banners
          .slice()
          .sort((a, b) => a.order - b.order)
          .map((b, idx, sortedArr) => {
            const moveBanner = (dir: -1 | 1) => {
              const target = idx + dir;
              if (target < 0 || target >= sortedArr.length) return;
              const swapWith = sortedArr[target];
              upsertBanner({ ...b, order: swapWith.order });
              upsertBanner({ ...swapWith, order: b.order });
            };
            return (
              <div key={b.id} className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-3 flex flex-wrap items-center justify-between gap-3">
                <div className="flex items-center gap-3 min-w-0">
                  <img src={b.image} alt="" className="w-16 h-12 rounded-lg object-cover shrink-0" />
                  <div className="min-w-0">
                    <div className="font-bold truncate">{locale === 'ar' ? b.titleAr : b.titleEn}</div>
                    <div className="text-[11px] text-slate-500 font-mono-num">
                      {b.placement} · #{b.order} · {b.startDate} → {b.endDate}
                    </div>
                  </div>
                </div>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    disabled={idx === 0}
                    onClick={() => moveBanner(-1)}
                    aria-label={t('تحريك لأعلى', 'Move up')}
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border disabled:opacity-30"
                  >
                    <ArrowUp className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    disabled={idx === sortedArr.length - 1}
                    onClick={() => moveBanner(1)}
                    aria-label={t('تحريك لأسفل', 'Move down')}
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center rounded-lg border disabled:opacity-30"
                  >
                    <ArrowDown className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => upsertBanner({ ...b, isActive: !b.isActive })}
                    className={`min-h-[36px] px-2.5 py-1 rounded-lg font-bold ${b.isActive ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}
                  >
                    {b.isActive ? t('نشط', 'Active') : t('متوقف', 'Paused')}
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setEditingBannerId(b.id);
                      setTitleAr(b.titleAr);
                      setTitleEn(b.titleEn);
                      setSubAr(b.subtitleAr);
                      setCtaAr(b.ctaAr);
                      setPlacement(b.placement);
                      setTargetType(b.targetType);
                      setTargetValue(b.targetValue);
                      setImage(b.image);
                      setStartDate(b.startDate);
                      setEndDate(b.endDate);
                      setOrder(String(b.order));
                    }}
                    className="min-h-[36px] px-2.5 py-1 rounded-lg border font-bold"
                  >
                    {t('تعديل', 'Edit')}
                  </button>
                  <button
                    type="button"
                    onClick={() => setConfirmDeleteBannerId(b.id)}
                    className="min-h-[36px] min-w-[36px] flex items-center justify-center text-rose-600"
                  >
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })}
      </div>

      {confirmDeleteBannerId && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181B1E] rounded-2xl max-w-sm w-full p-5 space-y-4 border border-stone-200 dark:border-zinc-800 shadow-xl">
            <h3 className="font-bold text-sm text-rose-600">
              {t('تأكيد حذف البانر', 'Confirm Delete Banner')}
            </h3>
            <p className="text-slate-600 dark:text-slate-400">
              {t('هل أنت متأكد من حذف هذا البانر الإعلاني نهائياً؟', 'Are you sure you want to permanently delete this banner?')}
            </p>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setConfirmDeleteBannerId(null)}
                className="min-h-[40px] px-3.5 py-1.5 rounded-lg border font-bold"
              >
                {t('إلغاء', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  deleteBanner(confirmDeleteBannerId);
                  if (editingBannerId === confirmDeleteBannerId) resetForm();
                  setConfirmDeleteBannerId(null);
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

export const AdminContentTextsModule: React.FC = () => {
  const { locale, t, appTexts, lensOptions, updateAppTexts, updateLensOptions } = useStore();
  const [draft, setDraft] = useState(appTexts);
  const [lensDraft, setLensDraft] = useState(lensOptions);
  const [newFaqQAr, setNewFaqQAr] = useState('');
  const [newFaqAAr, setNewFaqAAr] = useState('');

  useEffect(() => {
    setDraft(appTexts);
  }, [appTexts]);

  useEffect(() => {
    setLensDraft(lensOptions);
  }, [lensOptions]);

  const textFields: { key: keyof typeof draft; labelAr: string; labelEn: string; multiline?: boolean }[] = [
    { key: 'welcomeLineAr', labelAr: 'سطر الترحيب (عربي)', labelEn: 'Welcome Line (AR)' },
    { key: 'welcomeLineEn', labelAr: 'سطر الترحيب (إنجليزي)', labelEn: 'Welcome Line (EN)' },
    { key: 'announcementTextAr', labelAr: 'شريط الإعلانات العلوي (عربي)', labelEn: 'Announcement Bar (AR)' },
    { key: 'announcementTextEn', labelAr: 'شريط الإعلانات العلوي (إنجليزي)', labelEn: 'Announcement Bar (EN)' },
    { key: 'splashTextAr', labelAr: 'نص شاشة البداية (عربي)', labelEn: 'Splash Text (AR)' },
    { key: 'splashTextEn', labelAr: 'نص شاشة البداية (إنجليزي)', labelEn: 'Splash Text (EN)' },
    { key: 'btnAddToCartAr', labelAr: 'زر الإضافة للسلة (عربي)', labelEn: 'Add to Cart Label (AR)' },
    { key: 'btnAddToCartEn', labelAr: 'زر الإضافة للسلة (إنجليزي)', labelEn: 'Add to Cart Label (EN)' },
    { key: 'btnCheckoutAr', labelAr: 'زر إتمام الطلب (عربي)', labelEn: 'Checkout Button (AR)' },
    { key: 'emptyCartTitleAr', labelAr: 'عنوان السلة الفارغة (عربي)', labelEn: 'Empty Cart Text (AR)' },
    { key: 'emptyOrdersAr', labelAr: 'نص لا توجد طلبات (عربي)', labelEn: 'Empty Orders Text (AR)' },
    { key: 'aboutUsAr', labelAr: 'من نحن (عربي)', labelEn: 'About Us (AR)', multiline: true },
    { key: 'privacyPolicyAr', labelAr: 'سياسة الخصوصية (عربي)', labelEn: 'Privacy Policy (AR)', multiline: true },
    { key: 'termsConditionsAr', labelAr: 'الشروط والأحكام (عربي)', labelEn: 'Terms & Conditions (AR)', multiline: true },
    { key: 'returnPolicyAr', labelAr: 'سياسة الإرجاع (عربي)', labelEn: 'Return Policy (AR)', multiline: true },
  ];

  return (
    <div className="space-y-6 text-xs">
      <div className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="text-base font-bold flex items-center gap-2">
            <FileText className="w-4 h-4 text-[#D9B24C]" />
            {t('تعديل نصوص التطبيق والسياسات والأزرار', 'App Content, Buttons & Legal Policies')}
          </h2>
          <button
            type="button"
            onClick={() => updateAppTexts(draft)}
            className="px-5 py-2 rounded-xl bg-[#D9B24C] text-[#11223E] font-extrabold"
          >
            {t('حفظ كافة النصوص', 'Save App Content')}
          </button>
        </div>

        <div className="grid md:grid-cols-2 gap-3">
          {textFields.map((f) => (
            <div key={String(f.key)} className={f.multiline ? 'md:col-span-2' : ''}>
              <label className="block font-semibold mb-1">{locale === 'ar' ? f.labelAr : f.labelEn}</label>
              {f.multiline ? (
                <textarea
                  rows={2}
                  value={String(draft[f.key] || '')}
                  onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900"
                />
              ) : (
                <input
                  value={String(draft[f.key] || '')}
                  onChange={(e) => setDraft({ ...draft, [f.key]: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900"
                />
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Lens Types & Extra Coatings Pricing */}
      <div className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-5 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <h3 className="font-bold text-sm">{t('أسعار وخيارات العدسات الطبية (Rx)', 'Lens Options & Extra Prices (SDG)')}</h3>
          <button type="button" onClick={() => updateLensOptions(lensDraft)} className="min-h-[38px] px-4 py-1.5 rounded-lg bg-[#11223E] text-white font-bold">
            {t('حفظ أسعار العدسات', 'Save Lens Prices')}
          </button>
        </div>

        <div className="space-y-2">
          <div className="font-bold text-[#11223E] dark:text-[#E2BD5B]">
            {t('1) أنواع الرؤية (Vision Types)', '1) Vision Types')}
          </div>
          <div className="grid md:grid-cols-2 gap-2.5">
            {lensDraft
              .filter(
                (o) =>
                  o.id !== 'none' &&
                  (o.kind === 'vision_type' || VISION_TYPE_IDS.includes(o.id as never))
              )
              .map((opt) => (
                <div key={opt.id} className="p-2.5 rounded-lg bg-stone-50 dark:bg-zinc-900 flex items-center gap-2">
                  <input
                    value={opt.labelAr}
                    onChange={(e) =>
                      setLensDraft(
                        lensDraft.map((o) => (o.id === opt.id ? { ...o, labelAr: e.target.value } : o))
                      )
                    }
                    className="flex-1 px-2 py-1 rounded border bg-white dark:bg-[#181B1E]"
                  />
                  <input
                    type="number"
                    min={0}
                    value={opt.extraSdg}
                    onChange={(e) =>
                      setLensDraft(
                        lensDraft.map((o) =>
                          o.id === opt.id ? { ...o, extraSdg: Math.max(0, Number(e.target.value) || 0) } : o
                        )
                      )
                    }
                    className="w-24 px-2 py-1 rounded border bg-white dark:bg-[#181B1E] font-mono-num"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setLensDraft(
                        lensDraft.map((o) => (o.id === opt.id ? { ...o, visible: !o.visible } : o))
                      )
                    }
                    className={`px-2 py-1 rounded font-bold ${opt.visible ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}
                  >
                    {opt.visible ? t('مفعل', 'On') : t('معطل', 'Off')}
                  </button>
                </div>
              ))}
          </div>
        </div>

        <div className="space-y-2 pt-2 border-t border-stone-100 dark:border-zinc-800">
          <div className="font-bold text-[#11223E] dark:text-[#E2BD5B]">
            {t('2) الخيارات الإضافية القابلة للدمج (Extra Options)', '2) Combinable Extra Options')}
          </div>
          <div className="grid md:grid-cols-2 gap-2.5">
            {lensDraft
              .filter(
                (o) =>
                  o.id !== 'none' &&
                  (o.kind === 'extra_option' || EXTRA_OPTION_IDS.includes(o.id as never))
              )
              .map((opt) => (
                <div key={opt.id} className="p-2.5 rounded-lg bg-stone-50 dark:bg-zinc-900 flex items-center gap-2">
                  <input
                    value={opt.labelAr}
                    onChange={(e) =>
                      setLensDraft(
                        lensDraft.map((o) => (o.id === opt.id ? { ...o, labelAr: e.target.value } : o))
                      )
                    }
                    className="flex-1 px-2 py-1 rounded border bg-white dark:bg-[#181B1E]"
                  />
                  <input
                    type="number"
                    min={0}
                    value={opt.extraSdg}
                    onChange={(e) =>
                      setLensDraft(
                        lensDraft.map((o) =>
                          o.id === opt.id ? { ...o, extraSdg: Math.max(0, Number(e.target.value) || 0) } : o
                        )
                      )
                    }
                    className="w-24 px-2 py-1 rounded border bg-white dark:bg-[#181B1E] font-mono-num"
                  />
                  <button
                    type="button"
                    onClick={() =>
                      setLensDraft(
                        lensDraft.map((o) => (o.id === opt.id ? { ...o, visible: !o.visible } : o))
                      )
                    }
                    className={`px-2 py-1 rounded font-bold ${opt.visible ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'}`}
                  >
                    {opt.visible ? t('مفعل', 'On') : t('معطل', 'Off')}
                  </button>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* FAQ Editor */}
      <div className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-5 space-y-3">
        <h3 className="font-bold text-sm">{t('إدارة الأسئلة الشائعة (FAQ)', 'FAQ Manager')}</h3>
        <div className="space-y-2">
          {draft.faq.map((f, idx) => (
            <div key={f.id} className="p-3 rounded-lg bg-stone-50 dark:bg-zinc-900 flex items-start justify-between gap-2">
              <div>
                <div className="font-bold">{f.questionAr}</div>
                <div className="text-slate-500">{f.answerAr}</div>
              </div>
              <button
                type="button"
                onClick={() => setDraft({ ...draft, faq: draft.faq.filter((_, i) => i !== idx) })}
                className="text-rose-600"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
        <div className="grid sm:grid-cols-3 gap-2">
          <input value={newFaqQAr} onChange={(e) => setNewFaqQAr(e.target.value)} placeholder={t('السؤال...', 'Question...')} className="px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900" />
          <input value={newFaqAAr} onChange={(e) => setNewFaqAAr(e.target.value)} placeholder={t('الإجابة...', 'Answer...')} className="px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900" />
          <button
            type="button"
            onClick={() => {
              if (!newFaqQAr.trim()) return;
              const next = { ...draft, faq: [...draft.faq, { id: `faq_${Date.now()}`, questionAr: newFaqQAr, questionEn: newFaqQAr, answerAr: newFaqAAr, answerEn: newFaqAAr, visible: true }] };
              setDraft(next);
              updateAppTexts(next);
              setNewFaqQAr('');
              setNewFaqAAr('');
            }}
            className="px-4 py-2 rounded-lg bg-[#11223E] text-white font-bold inline-flex items-center justify-center gap-1"
          >
            <Plus className="w-4 h-4" />
            {t('إضافة سؤال', 'Add FAQ')}
          </button>
        </div>
      </div>
    </div>
  );
};

export const AdminAppearanceModule: React.FC = () => {
  const { t, appearance, updateAppearance, showToast } = useStore();
  const [draft, setDraft] = useState(appearance);
  const [logoUploadPct, setLogoUploadPct] = useState<number | null>(null);

  useEffect(() => {
    setDraft(appearance);
  }, [appearance]);

  return (
    <div className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-5 space-y-5 text-xs">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold flex items-center gap-2">
          <Palette className="w-4 h-4 text-[#D9B24C]" />
          {t('مظهر التطبيق والشعار والألوان', 'App Appearance, Logo & Colors')}
        </h2>
        <button
          type="button"
          onClick={() => updateAppearance(draft)}
          className="px-5 py-2 rounded-xl bg-[#D9B24C] text-[#11223E] font-extrabold"
        >
          {t('تطبيق المظهر فوراً', 'Apply Appearance')}
        </button>
      </div>

      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-4">
        <div>
          <label className="block font-semibold mb-1">{t('اسم التطبيق (عربي)', 'App Name (AR)')}</label>
          <input value={draft.appNameAr} onChange={(e) => setDraft({ ...draft, appNameAr: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900" />
        </div>
        <div>
          <label className="block font-semibold mb-1">{t('اسم التطبيق (إنجليزي)', 'App Name (EN)')}</label>
          <input value={draft.appNameEn} onChange={(e) => setDraft({ ...draft, appNameEn: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900" />
        </div>
        <div>
          <label className="block font-semibold mb-1">{t('نص الشعار (Wordmark)', 'Wordmark Text')}</label>
          <input value={draft.wordmarkText} onChange={(e) => setDraft({ ...draft, wordmarkText: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900 font-mono-num" />
        </div>
        <div>
          <label className="block font-semibold mb-1">{t('اللون الأساسي (Primary)', 'Primary Color')}</label>
          <div className="flex items-center gap-2">
            <input type="color" value={draft.primaryColor} onChange={(e) => setDraft({ ...draft, primaryColor: e.target.value })} className="h-9 w-14 rounded cursor-pointer" />
            <input value={draft.primaryColor} onChange={(e) => setDraft({ ...draft, primaryColor: e.target.value })} className="flex-1 px-2 py-2 rounded border font-mono-num" />
          </div>
        </div>
        <div>
          <label className="block font-semibold mb-1">{t('اللون الثانوي (Secondary)', 'Secondary Color')}</label>
          <div className="flex items-center gap-2">
            <input type="color" value={draft.secondaryColor} onChange={(e) => setDraft({ ...draft, secondaryColor: e.target.value })} className="h-9 w-14 rounded cursor-pointer" />
            <input value={draft.secondaryColor} onChange={(e) => setDraft({ ...draft, secondaryColor: e.target.value })} className="flex-1 px-2 py-2 rounded border font-mono-num" />
          </div>
        </div>
        <div>
          <label className="block font-semibold mb-1">{t('الثيم الافتراضي', 'Default Theme')}</label>
          <select value={draft.defaultTheme} onChange={(e) => setDraft({ ...draft, defaultTheme: e.target.value as 'light' | 'dark' })} className="w-full px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900">
            <option value="light">{t('نهاري فاتح', 'Light Mode')}</option>
            <option value="dark">{t('ليلي داكن', 'Dark Mode')}</option>
          </select>
        </div>
      </div>

      {logoUploadPct !== null && (
        <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
          <div className="h-full bg-[#D9B24C] transition-all" style={{ width: `${logoUploadPct}%` }} />
        </div>
      )}

      <div className="flex flex-wrap gap-4 items-center">
        <label className="min-h-[44px] px-3 py-2 rounded-lg border cursor-pointer font-semibold inline-flex items-center gap-1.5">
          <Upload className="w-4 h-4" />
          {t('رفع شعار المتجر (Logo)', 'Upload App Logo')}
          <input
            type="file"
            accept="image/*"
            className="hidden"
            onChange={async (e) => {
              const f = e.target.files?.[0];
              if (!f) return;
              setLogoUploadPct(15);
              const url = await uploadAdminImage('branding', f, (pct) => setLogoUploadPct(Math.max(15, pct)));
              setDraft({ ...draft, logoUrl: url });
              window.setTimeout(() => setLogoUploadPct(null), 500);
              showToast(t('تم رفع الشعار بنجاح', 'Logo uploaded'));
            }}
          />
        </label>
        {draft.logoUrl && (
          <button type="button" onClick={() => setDraft({ ...draft, logoUrl: '' })} className="text-rose-600 font-bold">
            {t('إزالة الشعار', 'Clear Logo')}
          </button>
        )}
      </div>
    </div>
  );
};

export const AdminStoreSettingsModule: React.FC = () => {
  const { locale, t, settings, lensOptions, updateSettings, updateLensOptions } = useStore();
  const { requireSensitiveReauth } = useAdminSecurity();
  const [draft, setDraft] = useState(settings);
  const [lensDraft, setLensDraft] = useState(lensOptions);
  const [brandMigrated, setBrandMigrated] = useState(false);
  const migrationRanRef = useRef(false);

  useEffect(() => {
    setDraft(settings);
  }, [settings]);

  useEffect(() => {
    setLensDraft(lensOptions);
  }, [lensOptions]);

  // One-time Firestore migration: replace any old storeName with "فيجن بلس" / "Vision Plus"
  useEffect(() => {
    if (migrationRanRef.current) return;
    migrationRanRef.current = true;

    let cancelled = false;
    const runBrandMigration = async () => {
      try {
        const snap = await getDoc(doc(db, 'store_config', 'settings'));
        const source: Partial<StoreSettings> = snap.exists()
          ? (snap.data() as Partial<StoreSettings>)
          : settings;

        const needsMigration =
          hasLegacyBrandString(source.storeNameAr) ||
          hasLegacyBrandString(source.storeNameEn) ||
          hasLegacyBrandString(source.bankakAccountName) ||
          hasLegacyBrandString(source.otherBankDetailsAr);

        if (needsMigration && !cancelled) {
          const normalized = normalizeStoreSettings({
            ...settings,
            ...source,
          });
          setDraft(normalized);
          updateSettings(normalized);
          setBrandMigrated(true);
        }
      } catch {
        // Fallback: migrate in-memory state if needed
        const needsLocalMigration =
          hasLegacyBrandString(settings.storeNameAr) ||
          hasLegacyBrandString(settings.storeNameEn);
        if (needsLocalMigration && !cancelled) {
          const normalized = normalizeStoreSettings(settings);
          setDraft(normalized);
          updateSettings(normalized);
          setBrandMigrated(true);
        }
      }
    };

    void runBrandMigration();
    return () => {
      cancelled = true;
    };
  }, [settings, updateSettings]);

  const socialKeys = ['facebook', 'instagram', 'whatsapp', 'tiktok', 'telegram', 'snapchat', 'youtube', 'x'] as const;

  const toggleContact = (field: keyof typeof draft.contactVisibility) => {
    setDraft({
      ...draft,
      contactVisibility: {
        ...draft.contactVisibility,
        [field]: !draft.contactVisibility[field],
      },
    });
  };

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault();
        const bankDetailsChanged =
          draft.bankakAccountName !== settings.bankakAccountName ||
          draft.bankakAccountNumber !== settings.bankakAccountNumber ||
          draft.bankakBranchAr !== settings.bankakBranchAr ||
          draft.otherBankDetailsAr !== settings.otherBankDetailsAr;

        const commitSettings = () => {
          updateSettings(draft);
          updateLensOptions(lensDraft);
        };

        if (bankDetailsChanged) {
          requireSensitiveReauth(
            t('تأكيد تعديل بيانات الحساب البنكي', 'Confirm Bank Details Update'),
            commitSettings
          );
          return;
        }
        commitSettings();
      }}
      className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-5 space-y-6 text-xs"
    >
      {brandMigrated && (
        <div className="p-3 rounded-xl bg-emerald-50 dark:bg-emerald-950/30 border border-emerald-200 dark:border-emerald-900/50 text-emerald-800 dark:text-emerald-200 font-bold">
          {t(
            'تم تحديث اسم المتجر المحفوظ تلقائياً إلى "فيجن بلس / Vision Plus" وحفظه في قاعدة البيانات.',
            'Stored storeName was automatically migrated to "فيجن بلس / Vision Plus".'
          )}
        </div>
      )}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h2 className="text-base font-bold flex items-center gap-2">
          <Settings className="w-4 h-4 text-[#D9B24C]" />
          {t('إعدادات المتجر والتواصل بالفوتر وبنكك والصيانة', 'Store Settings, Footer Contacts, Bankak & Maintenance')}
        </h2>
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() =>
              setDraft({
                ...draft,
                requireEmailVerification: !(draft.requireEmailVerification ?? true),
              })
            }
            className={`min-h-[40px] px-3.5 py-1.5 rounded-lg font-extrabold ${
              (draft.requireEmailVerification ?? true)
                ? 'bg-emerald-600 text-white'
                : 'bg-slate-200 text-slate-700'
            }`}
          >
            {(draft.requireEmailVerification ?? true)
              ? t('اشتراط تأكيد البريد قبل الطلب: مفعل ✓', 'Require Email Verification: ON')
              : t('اشتراط تأكيد البريد قبل الطلب: متوقف', 'Require Email Verification: OFF')}
          </button>
          <button
            type="button"
            onClick={() => setDraft({ ...draft, maintenanceMode: !draft.maintenanceMode })}
            className={`min-h-[40px] px-3.5 py-1.5 rounded-lg font-extrabold ${
              draft.maintenanceMode ? 'bg-rose-600 text-white' : 'bg-slate-200 text-slate-700'
            }`}
          >
            {draft.maintenanceMode ? t('وضع الصيانة: مفعل ✓', 'Maintenance Mode: ON') : t('وضع الصيانة: متوقف', 'Maintenance Mode: OFF')}
          </button>
        </div>
      </div>

      {draft.maintenanceMode && (
        <div className="grid sm:grid-cols-2 gap-2">
          <input
            value={draft.maintenanceMessageAr}
            onChange={(e) => setDraft({ ...draft, maintenanceMessageAr: e.target.value })}
            placeholder={t('رسالة وضع الصيانة (عربي)...', 'Maintenance message (AR)...')}
            className="w-full px-3 py-2 rounded-lg border border-rose-300 bg-rose-50/40"
          />
          <input
            value={draft.maintenanceMessageEn}
            onChange={(e) => setDraft({ ...draft, maintenanceMessageEn: e.target.value })}
            placeholder={t('رسالة وضع الصيانة (إنجليزي)...', 'Maintenance message (EN)...')}
            className="w-full px-3 py-2 rounded-lg border border-rose-300 bg-rose-50/40"
          />
        </div>
      )}

      {/* Footer Contact Visibility Toggles & Values */}
      <div className="p-4 rounded-xl bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 space-y-3">
        <h3 className="text-sm font-bold">
          {t('بيانات التواصل في الفوتر (تعديل القيم + إظهار/إخفاء كل عنصر)', 'Footer Contact Details & Visibility Toggles')}
        </h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {/* Phone */}
          <div className="p-2.5 rounded-lg bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold">{t('رقم الهاتف', 'Phone Call')}</span>
              <button
                type="button"
                onClick={() => toggleContact('phone')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  draft.contactVisibility.phone ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {draft.contactVisibility.phone ? t('ظاهر', 'Visible') : t('مخفي', 'Hidden')}
              </button>
            </div>
            <input dir="ltr" value={draft.phone} onChange={(e) => setDraft({ ...draft, phone: e.target.value })} className="w-full px-2.5 py-1.5 rounded border bg-stone-50 dark:bg-zinc-900 font-mono-num" />
          </div>

          {/* WhatsApp */}
          <div className="p-2.5 rounded-lg bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold">{t('رقم واتساب', 'WhatsApp Number')}</span>
              <button
                type="button"
                onClick={() => toggleContact('whatsapp')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  draft.contactVisibility.whatsapp ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {draft.contactVisibility.whatsapp ? t('ظاهر', 'Visible') : t('مخفي', 'Hidden')}
              </button>
            </div>
            <input dir="ltr" value={draft.whatsapp} onChange={(e) => setDraft({ ...draft, whatsapp: e.target.value })} className="w-full px-2.5 py-1.5 rounded border bg-stone-50 dark:bg-zinc-900 font-mono-num" />
          </div>

          {/* Email */}
          <div className="p-2.5 rounded-lg bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold">{t('البريد الإلكتروني', 'Email')}</span>
              <button
                type="button"
                onClick={() => toggleContact('email')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  draft.contactVisibility.email ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {draft.contactVisibility.email ? t('ظاهر', 'Visible') : t('مخفي', 'Hidden')}
              </button>
            </div>
            <input dir="ltr" type="email" value={draft.email} onChange={(e) => setDraft({ ...draft, email: e.target.value })} className="w-full px-2.5 py-1.5 rounded border bg-stone-50 dark:bg-zinc-900" />
          </div>

          {/* Address & Map */}
          <div className="sm:col-span-2 p-2.5 rounded-lg bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold">{t('العنوان ورابط الخريطة', 'Address & Map Link')}</span>
              <button
                type="button"
                onClick={() => toggleContact('address')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  draft.contactVisibility.address ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {draft.contactVisibility.address ? t('ظاهر', 'Visible') : t('مخفي', 'Hidden')}
              </button>
            </div>
            <div className="grid sm:grid-cols-3 gap-2">
              <input value={draft.addressAr} onChange={(e) => setDraft({ ...draft, addressAr: e.target.value })} placeholder={t('العنوان (عربي)', 'Address (AR)')} className="px-2.5 py-1.5 rounded border bg-stone-50 dark:bg-zinc-900" />
              <input value={draft.addressEn} onChange={(e) => setDraft({ ...draft, addressEn: e.target.value })} placeholder={t('العنوان (إنجليزي)', 'Address (EN)')} className="px-2.5 py-1.5 rounded border bg-stone-50 dark:bg-zinc-900" />
              <input dir="ltr" value={draft.mapUrl} onChange={(e) => setDraft({ ...draft, mapUrl: e.target.value })} placeholder="https://maps.google.com/..." className="px-2.5 py-1.5 rounded border bg-stone-50 dark:bg-zinc-900" />
            </div>
          </div>

          {/* Working Hours */}
          <div className="p-2.5 rounded-lg bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 space-y-1.5">
            <div className="flex items-center justify-between">
              <span className="font-bold">{t('ساعات العمل', 'Working Hours')}</span>
              <button
                type="button"
                onClick={() => toggleContact('workingHours')}
                className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                  draft.contactVisibility.workingHours ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                }`}
              >
                {draft.contactVisibility.workingHours ? t('ظاهر', 'Visible') : t('مخفي', 'Hidden')}
              </button>
            </div>
            <input value={draft.workingHoursAr} onChange={(e) => setDraft({ ...draft, workingHoursAr: e.target.value })} placeholder={t('ساعات العمل (عربي)', 'Hours (AR)')} className="w-full px-2.5 py-1.5 rounded border bg-stone-50 dark:bg-zinc-900 mb-1" />
            <input value={draft.workingHoursEn} onChange={(e) => setDraft({ ...draft, workingHoursEn: e.target.value })} placeholder={t('ساعات العمل (إنجليزي)', 'Hours (EN)')} className="w-full px-2.5 py-1.5 rounded border bg-stone-50 dark:bg-zinc-900" />
          </div>
        </div>
      </div>

      {/* Store Name, Bankak & Minimum Order */}
      <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-3">
        <div>
          <label className="block font-semibold mb-1">{t('اسم المتجر (عربي)', 'Store Name (AR)')}</label>
          <input value={draft.storeNameAr} onChange={(e) => setDraft({ ...draft, storeNameAr: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900" />
        </div>
        <div>
          <label className="block font-semibold mb-1">{t('اسم المتجر (إنجليزي)', 'Store Name (EN)')}</label>
          <input value={draft.storeNameEn} onChange={(e) => setDraft({ ...draft, storeNameEn: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900" />
        </div>
        <div>
          <label className="block font-semibold mb-1">{t('الحد الأدنى للطلب (ج.س)', 'Minimum Order (SDG)')}</label>
          <input type="number" value={draft.minimumOrderSdg} onChange={(e) => setDraft({ ...draft, minimumOrderSdg: Number(e.target.value) || 0 })} className="w-full px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900 font-mono-num" />
        </div>
        <div>
          <label className="block font-semibold mb-1">{t('اسم صاحب حساب بنكك', 'Bankak Account Name')}</label>
          <input value={draft.bankakAccountName} onChange={(e) => setDraft({ ...draft, bankakAccountName: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900" />
        </div>
        <div>
          <label className="block font-semibold mb-1">{t('رقم حساب بنكك', 'Bankak Account Number')}</label>
          <input value={draft.bankakAccountNumber} onChange={(e) => setDraft({ ...draft, bankakAccountNumber: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900 font-mono-num" />
        </div>
        <div>
          <label className="block font-semibold mb-1">{t('فرع بنكك', 'Bankak Branch')}</label>
          <input value={draft.bankakBranchAr} onChange={(e) => setDraft({ ...draft, bankakBranchAr: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900" />
        </div>
        <div>
          <label className="block font-semibold mb-1">{t('بنك آخر / فوري', 'Other Bank Details')}</label>
          <input value={draft.otherBankDetailsAr} onChange={(e) => setDraft({ ...draft, otherBankDetailsAr: e.target.value })} className="w-full px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900" />
        </div>
      </div>

      {/* Social Links with individual visibility switches */}
      <div className="space-y-2">
        <h3 className="text-sm font-bold">{t('أيقونات التواصل الاجتماعي في الفوتر (رابط + زر إظهار/إخفاء لكل منصة)', 'Footer Social Icons & Visibility')}</h3>
        <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-2.5">
          {socialKeys.map((key) => {
            const item = draft.socialLinks[key];
            return (
              <div key={key} className="p-2.5 rounded-lg bg-stone-50 dark:bg-zinc-900 space-y-1.5">
                <div className="flex items-center justify-between">
                  <span className="font-bold uppercase text-[11px]">{key}</span>
                  <button
                    type="button"
                    onClick={() =>
                      setDraft({
                        ...draft,
                        socialLinks: { ...draft.socialLinks, [key]: { ...item, visible: !item.visible } },
                      })
                    }
                    className={`px-2 py-0.5 rounded text-[10px] font-bold ${
                      item.visible ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                    }`}
                  >
                    {item.visible ? t('ظاهر', 'Visible') : t('مخفي', 'Hidden')}
                  </button>
                </div>
                <input
                  dir="ltr"
                  value={item.url}
                  onChange={(e) =>
                    setDraft({
                      ...draft,
                      socialLinks: { ...draft.socialLinks, [key]: { ...item, url: e.target.value } },
                    })
                  }
                  placeholder="https://..."
                  className="w-full px-2 py-1 rounded border bg-white dark:bg-[#181B1E] text-[11px]"
                />
              </div>
            );
          })}
        </div>
      </div>

      {/* Lens Options & Extra Prices (SDG) */}
      <div className="p-4 rounded-xl bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 space-y-4">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <h3 className="text-sm font-bold">
              {t('أسعار وخيارات العدسات الطبية (ج.س)', 'Lens Options & Extra Prices (SDG)')}
            </h3>
            <p className="text-[11px] text-slate-500 mt-0.5">
              {t(
                'حدد السعر الإضافي لكل نوع رؤية ولكل خيار إضافي بالجنيه السوداني — ينعكس فوراً في صفحة المنتج والسلة والطلبات',
                'Set SDG extra pricing for every vision type and extra option — updates live across products, cart, and orders'
              )}
            </p>
          </div>
          <button
            type="button"
            onClick={() => updateLensOptions(lensDraft)}
            className="min-h-[38px] px-3.5 py-1.5 rounded-lg bg-[#11223E] text-white font-bold"
          >
            {t('حفظ أسعار العدسات', 'Save Lens Prices')}
          </button>
        </div>

        {/* 1) Vision Types */}
        <div className="space-y-2">
          <div className="font-extrabold text-[#11223E] dark:text-[#E2BD5B]">
            {t('1) أنواع الرؤية (Vision Types)', '1) Vision Types')}
          </div>
          <div className="grid md:grid-cols-2 gap-2.5">
            {lensDraft
              .filter(
                (o) =>
                  o.id !== 'none' &&
                  (o.kind === 'vision_type' || VISION_TYPE_IDS.includes(o.id as never))
              )
              .map((opt) => (
                <div
                  key={opt.id}
                  className="p-2.5 rounded-lg bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      value={opt.labelAr}
                      onChange={(e) =>
                        setLensDraft(
                          lensDraft.map((o) =>
                            o.id === opt.id ? { ...o, labelAr: e.target.value } : o
                          )
                        )
                      }
                      placeholder={t('الاسم (عربي)', 'Label (AR)')}
                      className="flex-1 px-2.5 py-1.5 rounded border bg-stone-50 dark:bg-zinc-900"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setLensDraft(
                          lensDraft.map((o) =>
                            o.id === opt.id ? { ...o, visible: !o.visible } : o
                          )
                        )
                      }
                      className={`px-2.5 py-1.5 rounded font-bold ${
                        opt.visible ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {opt.visible ? t('مفعل', 'On') : t('معطل', 'Off')}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={opt.labelEn}
                      onChange={(e) =>
                        setLensDraft(
                          lensDraft.map((o) =>
                            o.id === opt.id ? { ...o, labelEn: e.target.value } : o
                          )
                        )
                      }
                      placeholder={t('الاسم (إنجليزي)', 'Label (EN)')}
                      className="flex-1 px-2.5 py-1.5 rounded border bg-stone-50 dark:bg-zinc-900"
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-slate-500">{t('السعر:', 'SDG:')}</span>
                      <input
                        type="number"
                        min={0}
                        value={opt.extraSdg}
                        onChange={(e) =>
                          setLensDraft(
                            lensDraft.map((o) =>
                              o.id === opt.id
                                ? { ...o, extraSdg: Math.max(0, Number(e.target.value) || 0) }
                                : o
                            )
                          )
                        }
                        className="w-24 px-2 py-1.5 rounded border bg-stone-50 dark:bg-zinc-900 font-mono-num"
                      />
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>

        {/* 2) Extra Options */}
        <div className="space-y-2 pt-2 border-t border-stone-200 dark:border-zinc-800">
          <div className="font-extrabold text-[#11223E] dark:text-[#E2BD5B]">
            {t('2) الخيارات الإضافية القابلة للدمج (Extra Options)', '2) Combinable Extra Options')}
          </div>
          <div className="grid md:grid-cols-2 gap-2.5">
            {lensDraft
              .filter(
                (o) =>
                  o.id !== 'none' &&
                  (o.kind === 'extra_option' || EXTRA_OPTION_IDS.includes(o.id as never))
              )
              .map((opt) => (
                <div
                  key={opt.id}
                  className="p-2.5 rounded-lg bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 space-y-2"
                >
                  <div className="flex items-center gap-2">
                    <input
                      value={opt.labelAr}
                      onChange={(e) =>
                        setLensDraft(
                          lensDraft.map((o) =>
                            o.id === opt.id ? { ...o, labelAr: e.target.value } : o
                          )
                        )
                      }
                      placeholder={t('الاسم (عربي)', 'Label (AR)')}
                      className="flex-1 px-2.5 py-1.5 rounded border bg-stone-50 dark:bg-zinc-900"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        setLensDraft(
                          lensDraft.map((o) =>
                            o.id === opt.id ? { ...o, visible: !o.visible } : o
                          )
                        )
                      }
                      className={`px-2.5 py-1.5 rounded font-bold ${
                        opt.visible ? 'bg-emerald-600 text-white' : 'bg-slate-200 text-slate-600'
                      }`}
                    >
                      {opt.visible ? t('مفعل', 'On') : t('معطل', 'Off')}
                    </button>
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      value={opt.labelEn}
                      onChange={(e) =>
                        setLensDraft(
                          lensDraft.map((o) =>
                            o.id === opt.id ? { ...o, labelEn: e.target.value } : o
                          )
                        )
                      }
                      placeholder={t('الاسم (إنجليزي)', 'Label (EN)')}
                      className="flex-1 px-2.5 py-1.5 rounded border bg-stone-50 dark:bg-zinc-900"
                    />
                    <div className="flex items-center gap-1">
                      <span className="text-[11px] text-slate-500">{t('السعر:', 'SDG:')}</span>
                      <input
                        type="number"
                        min={0}
                        value={opt.extraSdg}
                        onChange={(e) =>
                          setLensDraft(
                            lensDraft.map((o) =>
                              o.id === opt.id
                                ? { ...o, extraSdg: Math.max(0, Number(e.target.value) || 0) }
                                : o
                            )
                          )
                        }
                        className="w-24 px-2 py-1.5 rounded border bg-stone-50 dark:bg-zinc-900 font-mono-num"
                      />
                    </div>
                  </div>
                </div>
              ))}
          </div>
        </div>
      </div>

      {/* 18 Sudan States */}
      <div>
        <h3 className="text-sm font-bold mb-3">
          {t('رسوم التوصيل حسب ولايات السودان الـ 18 (ج.س)', 'Delivery Fees for 18 Sudan States (SDG)')}
        </h3>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {draft.deliveryFees.map((st, idx) => (
            <div key={st.id}>
              <label className="block text-[11px] font-medium mb-1 truncate">
                {locale === 'ar' ? st.nameAr : st.nameEn}
              </label>
              <input
                type="number"
                value={st.feeSdg}
                onChange={(e) => {
                  const nextFees = draft.deliveryFees.map((item, i) =>
                    i === idx ? { ...item, feeSdg: Number(e.target.value) || 0 } : item
                  );
                  setDraft({ ...draft, deliveryFees: nextFees });
                }}
                className="w-full px-2.5 py-1.5 rounded-lg border bg-stone-50 dark:bg-zinc-900 font-mono-num"
              />
            </div>
          ))}
        </div>
      </div>

      <button type="submit" className="px-6 py-2.5 rounded-xl bg-[#D9B24C] text-[#11223E] font-extrabold">
        {t('حفظ جميع إعدادات المتجر والعدسات', 'Save All Store & Lens Settings')}
      </button>
    </form>
  );
};
