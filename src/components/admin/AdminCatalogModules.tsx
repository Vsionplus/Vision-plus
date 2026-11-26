import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Plus,
  Trash2,
  Copy,
  Eye,
  EyeOff,
  ArrowUp,
  ArrowDown,
  Upload,
  CheckSquare,
  Square,
  AlertTriangle,
  Star,
  Image as ImageIcon,
  Sparkles,
} from 'lucide-react';
import { useStore } from '../../store/StoreContext';
import { Brand, Category, CategoryId, Product, ProductVariant } from '../../types';
import { formatSdg } from '../../utils/format';
import { IMG_FRAME, PRODUCTS_SEED } from '../../data/seedData';
import { ResilientImage } from '../ResilientImage';
import { useAdminSecurity } from './AdminGuard';
import { uploadAdminImage } from '../../lib/firebase';
import { FieldValidationRule, useFormValidation } from '../../hooks/useFormValidation';
import { FieldError, ValidationSummaryBanner } from '../FormValidationUI';
import { VALIDATION_MESSAGES, pickMsg } from '../../utils/validationMessages';

export const AdminProductsModule: React.FC = () => {
  const {
    locale,
    t,
    products,
    categories,
    brands,
    appearance,
    upsertProduct,
    duplicateProduct,
    deleteProduct,
    bulkUpdateProducts,
    seedDefaultProducts,
    showToast,
  } = useStore();
  const { requireSensitiveReauth } = useAdminSecurity();
  const [seedingDefaults, setSeedingDefaults] = useState(false);

  const missingDefaultCount = useMemo(() => {
    const existingIds = new Set(products.map((p) => p.id));
    return PRODUCTS_SEED.filter((p) => !existingIds.has(p.id)).length;
  }, [products]);

  const [search, setSearch] = useState('');
  const [catFilter, setCatFilter] = useState('all');
  const [brandFilter, setBrandFilter] = useState('all');
  const [statusFilter, setStatusFilter] = useState<'all' | 'visible' | 'hidden' | 'low_stock' | 'deleted'>('all');
  const [sortBy, setSortBy] = useState<'title' | 'price_asc' | 'price_desc' | 'stock_asc'>('title');
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [bulkDiscountPct, setBulkDiscountPct] = useState('15');
  const [bulkMoveCat, setBulkMoveCat] = useState<CategoryId>(categories[0]?.id || 'frames');
  const [confirmDelete, setConfirmDelete] = useState<{ id: string; permanent: boolean } | null>(null);

  // Full Add/Edit Product Form State
  const [editingId, setEditingId] = useState<string | null>(null);
  const [formOpen, setFormOpen] = useState(false);
  const [titleAr, setTitleAr] = useState('');
  const [titleEn, setTitleEn] = useState('');
  const [descAr, setDescAr] = useState('');
  const [descEn, setDescEn] = useState('');
  const [sku, setSku] = useState('');
  const [categoryId, setCategoryId] = useState<CategoryId>('frames');
  const [brandId, setBrandId] = useState('vision_plus');
  const [priceSdg, setPriceSdg] = useState('45000');
  const [oldPriceSdg, setOldPriceSdg] = useState('');
  const [stock, setStock] = useState('10');
  const [gender, setGender] = useState<Product['gender']>('unisex');
  const [frameShape, setFrameShape] = useState<NonNullable<Product['frameShape']>>('square');
  const [material, setMaterial] = useState<NonNullable<Product['material']>>('acetate');
  const [tagsText, setTagsText] = useState('');
  const [images, setImages] = useState<string[]>([IMG_FRAME]);
  const [uploadPct, setUploadPct] = useState<number | null>(null);
  const [variants, setVariants] = useState<ProductVariant[]>([
    { id: 'v1', colorNameAr: 'أسود', colorNameEn: 'Black', colorHex: '#1C1917', stock: 10 },
  ]);
  const [clType, setClType] = useState<'daily' | 'monthly' | 'colored'>('daily');
  const [clBoxQty, setClBoxQty] = useState('30');
  const [clBaseCurve, setClBaseCurve] = useState('8.5 mm');
  const [solVol, setSolVol] = useState('360');
  const [solExp, setSolExp] = useState('2028-04-30');
  const [visible, setVisible] = useState(true);
  const [isFeatured, setIsFeatured] = useState(true);
  const [isNewArrival, setIsNewArrival] = useState(true);
  const [isOnOffer, setIsOnOffer] = useState(false);
  const [isOutOfStock, setIsOutOfStock] = useState(false);
  const [requiresRx, setRequiresRx] = useState(true);
  const productVal = useFormValidation({ formId: 'admin-product' });

  const buildProductRules = useCallback((): FieldValidationRule[] => {
    const numPrice = Number(priceSdg);
    const numStock = Number(stock);
    return [
      {
        field: 'titleAr',
        label: t('اسم المنتج (عربي)', 'Product Name (AR)'),
        error: !titleAr.trim() ? pickMsg(VALIDATION_MESSAGES.productTitleArRequired, locale) : null,
      },
      {
        field: 'categoryId',
        label: t('التصنيف', 'Category'),
        error: !categoryId ? pickMsg(VALIDATION_MESSAGES.productCategoryRequired, locale) : null,
      },
      {
        field: 'priceSdg',
        label: t('السعر (ج.س)', 'Price (SDG)'),
        error:
          !priceSdg.trim() || !Number.isFinite(numPrice) || numPrice <= 0
            ? pickMsg(VALIDATION_MESSAGES.productPriceInvalid, locale)
            : null,
      },
      {
        field: 'stock',
        label: t('المخزون', 'Stock'),
        error:
          stock.trim() === '' || !Number.isFinite(numStock) || numStock < 0
            ? pickMsg(VALIDATION_MESSAGES.productStockInvalid, locale)
            : null,
      },
      {
        field: 'images',
        label: t('صور المنتج', 'Product Images'),
        error:
          images.length === 0 ? pickMsg(VALIDATION_MESSAGES.productImageRequired, locale) : null,
      },
    ];
  }, [titleAr, categoryId, priceSdg, stock, images, locale, t]);

  useEffect(() => {
    if (formOpen && productVal.submitted) {
      productVal.revalidate(buildProductRules());
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [formOpen, productVal.submitted, buildProductRules]);

  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return products
      .filter((p) => {
        if (statusFilter === 'deleted') {
          if (!p.isDeleted) return false;
        } else if (p.isDeleted) {
          return false;
        }
        if (statusFilter === 'visible' && !p.visible) return false;
        if (statusFilter === 'hidden' && p.visible) return false;
        if (statusFilter === 'low_stock' && p.stock > 5) return false;
        if (catFilter !== 'all' && p.categoryId !== catFilter) return false;
        if (brandFilter !== 'all' && p.brandId !== brandFilter) return false;
        if (q) {
          const hay = `${p.titleAr} ${p.titleEn} ${p.sku} ${(p.tags || []).join(' ')}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price_asc') return a.priceSdg - b.priceSdg;
        if (sortBy === 'price_desc') return b.priceSdg - a.priceSdg;
        if (sortBy === 'stock_asc') return a.stock - b.stock;
        return a.titleAr.localeCompare(b.titleAr);
      });
  }, [products, search, catFilter, brandFilter, statusFilter, sortBy]);

  const openNewForm = () => {
    setEditingId(null);
    setTitleAr('');
    setTitleEn('');
    setDescAr('');
    setDescEn('');
    setSku(`VP-${Math.floor(100 + Math.random() * 900)}`);
    setCategoryId(categories[0]?.id || 'frames');
    setBrandId(brands[0]?.id || 'vision_plus');
    setPriceSdg('45000');
    setOldPriceSdg('');
    setStock('12');
    setGender('unisex');
    setFrameShape('square');
    setMaterial('acetate');
    setTagsText('فيجن بلس, جديد');
    setImages([IMG_FRAME]);
    setVariants([{ id: 'v1', colorNameAr: 'أسود', colorNameEn: 'Black', colorHex: '#1C1917', stock: 12 }]);
    setVisible(true);
    setIsFeatured(true);
    setIsNewArrival(true);
    setIsOnOffer(false);
    setIsOutOfStock(false);
    setRequiresRx(true);
    productVal.reset();
    setFormOpen(true);
  };

  const startEdit = (p: Product) => {
    setEditingId(p.id);
    setTitleAr(p.titleAr);
    setTitleEn(p.titleEn);
    setDescAr(p.descriptionAr);
    setDescEn(p.descriptionEn);
    setSku(p.sku);
    setCategoryId(p.categoryId);
    setBrandId(p.brandId);
    setPriceSdg(String(p.priceSdg));
    setOldPriceSdg(p.oldPriceSdg ? String(p.oldPriceSdg) : '');
    setStock(String(p.stock));
    setGender(p.gender);
    setFrameShape(p.frameShape || 'square');
    setMaterial(p.material || 'acetate');
    setTagsText((p.tags || []).join(', '));
    setImages(p.images.length > 0 ? p.images : [IMG_FRAME]);
    setVariants(p.variants.length > 0 ? p.variants : [{ id: 'v1', colorNameAr: 'قياسي', colorNameEn: 'Standard', colorHex: '#11223E', stock: p.stock }]);
    if (p.contactLensSpecs) {
      setClType(p.contactLensSpecs.type);
      setClBoxQty(String(p.contactLensSpecs.quantityPerBox));
      setClBaseCurve(p.contactLensSpecs.baseCurve);
    }
    if (p.lensSolutionSpecs) {
      setSolVol(String(p.lensSolutionSpecs.volumeMl));
      setSolExp(p.lensSolutionSpecs.expiryDate);
    }
    setVisible(p.visible);
    setIsFeatured(p.isFeatured);
    setIsNewArrival(p.isNewArrival);
    setIsOnOffer(Boolean(p.isOnOffer));
    setIsOutOfStock(Boolean(p.isOutOfStock));
    setRequiresRx(Boolean(p.requiresPrescriptionOption));
    productVal.reset();
    setFormOpen(true);
  };

  const handleUploadMultipleImages = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []);
    if (files.length === 0) return;
    setUploadPct(5);
    const uploadedUrls: string[] = [];
    for (let i = 0; i < files.length; i++) {
      const url = await uploadAdminImage('products', files[i], (filePct) => {
        const overall = Math.round(((i + filePct / 100) / files.length) * 100);
        setUploadPct(Math.max(5, Math.min(100, overall)));
      });
      if (url) uploadedUrls.push(url);
    }
    setImages((prev) => [...prev, ...uploadedUrls]);
    window.setTimeout(() => setUploadPct(null), 500);
    showToast(t(`تم رفع ${uploadedUrls.length} صورة بنجاح`, `${uploadedUrls.length} images uploaded`));
  };

  const moveImage = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= images.length) return;
    const next = [...images];
    [next[idx], next[target]] = [next[target], next[idx]];
    setImages(next);
  };

  const handleSave = (e: React.FormEvent) => {
    e.preventDefault();
    if (!productVal.validateAll(buildProductRules())) return;
    const existing = products.find((p) => p.id === editingId);
    const next: Product = {
      id: existing ? existing.id : `p_${Date.now()}`,
      sku: sku.trim() || `VP-${Date.now().toString().slice(-4)}`,
      titleAr: titleAr.trim(),
      titleEn: titleEn.trim() || titleAr.trim(),
      descriptionAr: descAr.trim() || 'منتج بصري أصلي بضمان فيجن بلس.',
      descriptionEn: descEn.trim() || 'Authentic optical item covered by Vision Plus warranty.',
      categoryId,
      brandId,
      priceSdg: Math.max(1, Number(priceSdg) || 10000),
      oldPriceSdg: oldPriceSdg ? Number(oldPriceSdg) : undefined,
      stock: Math.max(0, Number(stock) || 0),
      images: images.length > 0 ? images : [IMG_FRAME],
      gender,
      frameShape,
      material,
      variants,
      contactLensSpecs:
        categoryId === 'contact_lenses'
          ? {
              type: clType,
              sphOptions: existing?.contactLensSpecs?.sphOptions || ['-1.00', '-1.50', '-2.00', '-2.50', '-3.00', '-4.00'],
              cylOptions: existing?.contactLensSpecs?.cylOptions || ['0.00', '-0.75', '-1.25'],
              axisOptions: existing?.contactLensSpecs?.axisOptions || ['0', '90', '180'],
              baseCurve: clBaseCurve,
              quantityPerBox: Number(clBoxQty) || 30,
            }
          : existing?.contactLensSpecs,
      lensSolutionSpecs:
        categoryId === 'contact_lens_solutions'
          ? {
              volumeMl: Number(solVol) || 360,
              expiryDate: solExp || '2028-01-01',
            }
          : existing?.lensSolutionSpecs,
      tags: tagsText
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean),
      visible,
      isFeatured,
      isNewArrival,
      isOnOffer,
      isOutOfStock,
      isDeleted: false,
      requiresPrescriptionOption: requiresRx,
      rating: existing?.rating ?? 4.9,
      reviews: existing?.reviews ?? [],
    };
    upsertProduct(next);
    productVal.reset();
    setFormOpen(false);
    setEditingId(null);
  };

  return (
    <div className="space-y-5 text-xs">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex flex-wrap items-center gap-2 flex-1">
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder={t('بحث بالاسم، SKU، أو الوسوم...', 'Search name, SKU, tags...')}
            className="px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E] min-w-[200px]"
          />
          <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)} className="px-2.5 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E]">
            <option value="all">{t('كل التصنيفات', 'All Categories')}</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>{locale === 'ar' ? c.nameAr : c.nameEn}</option>
            ))}
          </select>
          <select value={brandFilter} onChange={(e) => setBrandFilter(e.target.value)} className="px-2.5 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E]">
            <option value="all">{t('كل الماركات', 'All Brands')}</option>
            {brands.map((b) => (
              <option key={b.id} value={b.id}>{locale === 'ar' ? b.nameAr : b.nameEn}</option>
            ))}
          </select>
          <select value={statusFilter} onChange={(e) => setStatusFilter(e.target.value as typeof statusFilter)} className="px-2.5 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E]">
            <option value="all">{t('الكل (غير محذوف)', 'Active & Hidden')}</option>
            <option value="visible">{t('ظاهر للعملاء', 'Visible Only')}</option>
            <option value="hidden">{t('مخفي', 'Hidden Only')}</option>
            <option value="low_stock">{t('مخزون منخفض (≤5)', 'Low Stock (≤5)')}</option>
            <option value="deleted">{t('الأرشيف (محذوف ناعم)', 'Trash / Archived')}</option>
          </select>
          <select value={sortBy} onChange={(e) => setSortBy(e.target.value as typeof sortBy)} className="px-2.5 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E]">
            <option value="title">{t('ترتيب: أبجدي', 'Sort: Name')}</option>
            <option value="price_asc">{t('الأقل سعراً', 'Price: Low → High')}</option>
            <option value="price_desc">{t('الأعلى سعراً', 'Price: High → Low')}</option>
            <option value="stock_asc">{t('الأقل مخزوناً', 'Lowest Stock')}</option>
          </select>
        </div>

        <div className="flex flex-wrap items-center gap-2">
          {missingDefaultCount > 0 && (
            <button
              type="button"
              disabled={seedingDefaults}
              onClick={async () => {
                setSeedingDefaults(true);
                try {
                  await seedDefaultProducts();
                } finally {
                  setSeedingDefaults(false);
                }
              }}
              className="min-h-[40px] px-3.5 py-2 rounded-xl border border-[#D9B24C] bg-[#D9B24C]/15 text-[#11223E] dark:text-[#E2BD5B] font-extrabold inline-flex items-center gap-1.5 hover:bg-[#D9B24C]/25 disabled:opacity-60"
            >
              <Sparkles className="w-4 h-4" />
              {seedingDefaults
                ? t('جاري الإضافة...', 'Adding...')
                : t(
                    `إضافة المنتجات الافتراضية (+${missingDefaultCount})`,
                    `Add Default Products (+${missingDefaultCount})`
                  )}
            </button>
          )}
          <button
            type="button"
            onClick={openNewForm}
            style={{ backgroundColor: appearance.secondaryColor, color: appearance.primaryColor }}
            className="min-h-[40px] px-4 py-2 rounded-xl font-extrabold inline-flex items-center gap-1.5"
          >
            <Plus className="w-4 h-4" />
            {t('إضافة منتج جديد', 'Add Product')}
          </button>
        </div>
      </div>

      {/* Bulk Action Bar */}
      {selectedIds.length > 0 && (
        <div className="p-3 rounded-xl bg-[#11223E] text-white flex flex-wrap items-center justify-between gap-2">
          <span className="font-bold">
            {t(`تم تحديد ${selectedIds.length} منتج`, `${selectedIds.length} selected`)}
          </span>
          <div className="flex flex-wrap items-center gap-2">
            <button type="button" onClick={() => bulkUpdateProducts(selectedIds, { type: 'show' })} className="px-2.5 py-1 rounded bg-white/15 hover:bg-white/25">
              {t('إظهار الكل', 'Show')}
            </button>
            <button type="button" onClick={() => bulkUpdateProducts(selectedIds, { type: 'hide' })} className="px-2.5 py-1 rounded bg-white/15 hover:bg-white/25">
              {t('إخفاء الكل', 'Hide')}
            </button>
            <div className="flex items-center gap-1 bg-white/10 rounded px-1.5 py-0.5">
              <input value={bulkDiscountPct} onChange={(e) => setBulkDiscountPct(e.target.value)} className="w-10 bg-transparent text-center font-mono-num" />
              <span>%</span>
              <button type="button" onClick={() => bulkUpdateProducts(selectedIds, { type: 'apply_discount', percent: Number(bulkDiscountPct) || 10 })} className="px-2 py-0.5 rounded bg-[#D9B24C] text-[#11223E] font-bold">
                {t('تطبيق خصم', 'Discount')}
              </button>
            </div>
            <div className="flex items-center gap-1 bg-white/10 rounded px-1.5 py-0.5">
              <select value={bulkMoveCat} onChange={(e) => setBulkMoveCat(e.target.value)} className="bg-[#11223E] text-white text-[11px]">
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{locale === 'ar' ? c.nameAr : c.nameEn}</option>
                ))}
              </select>
              <button type="button" onClick={() => bulkUpdateProducts(selectedIds, { type: 'move_category', categoryId: bulkMoveCat })} className="px-2 py-0.5 rounded bg-white/20 font-bold">
                {t('نقل', 'Move')}
              </button>
            </div>
            <button
              type="button"
              onClick={() => {
                const idsSnapshot = [...selectedIds];
                requireSensitiveReauth(
                  t('تأكيد أرشفة المنتجات المحددة', 'Confirm Bulk Product Archive'),
                  () => {
                    bulkUpdateProducts(idsSnapshot, { type: 'delete' });
                    setSelectedIds([]);
                  }
                );
              }}
              className="px-2.5 py-1 rounded bg-rose-600 font-bold"
            >
              {t('أرشفة المحدد', 'Delete')}
            </button>
            <button type="button" onClick={() => setSelectedIds([])} className="px-2 py-1 text-slate-300">
              {t('إلغاء', 'Clear')}
            </button>
          </div>
        </div>
      )}

      {/* Full Add/Edit Product Modal/Panel */}
      {formOpen && (
        <form noValidate onSubmit={handleSave} className="bg-white dark:bg-[#181B1E] border-2 border-[var(--vp-secondary)] rounded-2xl p-5 space-y-5">
          <div className="flex items-center justify-between border-b border-stone-200 dark:border-zinc-800 pb-3">
            <h2 className="text-base font-extrabold">
              {editingId ? t('تعديل تفاصيل المنتج', 'Edit Product') : t('إضافة منتج جديد', 'Create Product')}
            </h2>
            <button type="button" onClick={() => setFormOpen(false)} className="min-h-[44px] px-2 text-slate-500 hover:text-rose-600 font-bold">
              {t('إغلاق ✕', 'Close ✕')}
            </button>
          </div>

          <ValidationSummaryBanner
            errors={productVal.errors}
            onSelectField={productVal.focusField}
            mode="form"
          />

          <div className="grid sm:grid-cols-2 lg:grid-cols-4 gap-3">
            <div {...productVal.getFieldWrapperProps('titleAr')}>
              <label className="block font-semibold mb-1">{t('الاسم (عربي)*', 'Name (AR)*')}</label>
              <input
                value={titleAr}
                onChange={(e) => setTitleAr(e.target.value)}
                {...productVal.getInputA11yProps('titleAr')}
                className={`w-full min-h-[44px] px-3 py-2 rounded-lg ${productVal.getControlClasses(
                  'titleAr',
                  'border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900'
                )}`}
              />
              <FieldError
                id={productVal.getErrorId('titleAr')}
                message={productVal.getError('titleAr')}
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">{t('الاسم (إنجليزي)', 'Name (EN)')}</label>
              <input value={titleEn} onChange={(e) => setTitleEn(e.target.value)} className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900" />
            </div>
            <div>
              <label className="block font-semibold mb-1">SKU</label>
              <input value={sku} onChange={(e) => setSku(e.target.value)} className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 font-mono-num" />
            </div>
            <div>
              <label className="block font-semibold mb-1">{t('الوسوم (مفصولة بفاصلة)', 'Tags (comma-separated)')}</label>
              <input value={tagsText} onChange={(e) => setTagsText(e.target.value)} className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900" />
            </div>

            <div {...productVal.getFieldWrapperProps('categoryId')}>
              <label className="block font-semibold mb-1">{t('التصنيف *', 'Category *')}</label>
              <select
                value={categoryId}
                onChange={(e) => setCategoryId(e.target.value)}
                {...productVal.getInputA11yProps('categoryId')}
                className={`w-full min-h-[44px] px-3 py-2 rounded-lg ${productVal.getControlClasses(
                  'categoryId',
                  'border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900'
                )}`}
              >
                {categories.map((c) => (
                  <option key={c.id} value={c.id}>{locale === 'ar' ? c.nameAr : c.nameEn}</option>
                ))}
              </select>
              <FieldError
                id={productVal.getErrorId('categoryId')}
                message={productVal.getError('categoryId')}
              />
            </div>
            <div>
              <label className="block font-semibold mb-1">{t('الماركة', 'Brand')}</label>
              <select value={brandId} onChange={(e) => setBrandId(e.target.value)} className="w-full min-h-[44px] px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900">
                {brands.map((b) => (
                  <option key={b.id} value={b.id}>{locale === 'ar' ? b.nameAr : b.nameEn}</option>
                ))}
              </select>
            </div>
            <div {...productVal.getFieldWrapperProps('priceSdg')}>
              <label className="block font-semibold mb-1">{t('السعر (ج.س)*', 'Price (SDG)*')}</label>
              <input
                type="number"
                value={priceSdg}
                onChange={(e) => setPriceSdg(e.target.value)}
                {...productVal.getInputA11yProps('priceSdg')}
                className={`w-full min-h-[44px] px-3 py-2 rounded-lg font-mono-num ${productVal.getControlClasses(
                  'priceSdg',
                  'border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900'
                )}`}
              />
              <FieldError
                id={productVal.getErrorId('priceSdg')}
                message={productVal.getError('priceSdg')}
              />
            </div>
            <div className="grid grid-cols-2 gap-2">
              <div>
                <label className="block font-semibold mb-1">{t('السعر القديم', 'Old Price')}</label>
                <input type="number" value={oldPriceSdg} onChange={(e) => setOldPriceSdg(e.target.value)} className="w-full min-h-[44px] px-2.5 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 font-mono-num" />
              </div>
              <div {...productVal.getFieldWrapperProps('stock')}>
                <label className="block font-semibold mb-1">{t('المخزون *', 'Stock *')}</label>
                <input
                  type="number"
                  value={stock}
                  onChange={(e) => setStock(e.target.value)}
                  {...productVal.getInputA11yProps('stock')}
                  className={`w-full min-h-[44px] px-2.5 py-2 rounded-lg font-mono-num ${productVal.getControlClasses(
                    'stock',
                    'border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900'
                  )}`}
                />
                <FieldError
                  id={productVal.getErrorId('stock')}
                  message={productVal.getError('stock')}
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold mb-1">{t('الجنس', 'Gender')}</label>
              <select value={gender} onChange={(e) => setGender(e.target.value as Product['gender'])} className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900">
                <option value="unisex">{t('للجنسين', 'Unisex')}</option>
                <option value="men">{t('رجالي', 'Men')}</option>
                <option value="women">{t('نسائي', 'Women')}</option>
                <option value="kids">{t('أطفال', 'Kids')}</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">{t('شكل الإطار', 'Frame Shape')}</label>
              <select value={frameShape} onChange={(e) => setFrameShape(e.target.value as NonNullable<Product['frameShape']>)} className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900">
                <option value="square">Square</option>
                <option value="round">Round</option>
                <option value="aviator">Aviator</option>
                <option value="cat_eye">Cat Eye</option>
                <option value="rectangle">Rectangle</option>
                <option value="none">None</option>
              </select>
            </div>
            <div>
              <label className="block font-semibold mb-1">{t('الخامة', 'Material')}</label>
              <select value={material} onChange={(e) => setMaterial(e.target.value as NonNullable<Product['material']>)} className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900">
                <option value="acetate">Acetate</option>
                <option value="titanium">Titanium</option>
                <option value="tr90">TR90</option>
                <option value="metal">Metal</option>
                <option value="hydrogel">Hydrogel</option>
                <option value="sterile_solution">Sterile Solution</option>
                <option value="leather">Leather</option>
              </select>
            </div>
          </div>

          <div className="grid sm:grid-cols-2 gap-3">
            <textarea rows={2} value={descAr} onChange={(e) => setDescAr(e.target.value)} placeholder={t('الوصف بالعربية...', 'Description (AR)')} className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900" />
            <textarea rows={2} value={descEn} onChange={(e) => setDescEn(e.target.value)} placeholder={t('الوصف بالإنجليزية...', 'Description (EN)')} className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900" />
          </div>

          {categoryId === 'contact_lenses' && (
            <div className="p-3 rounded-xl bg-stone-50 dark:bg-zinc-900 grid sm:grid-cols-3 gap-3">
              <div>
                <label className="block font-semibold mb-1">{t('نوع العدسة', 'Lens Type')}</label>
                <select value={clType} onChange={(e) => setClType(e.target.value as typeof clType)} className="w-full px-2.5 py-1.5 rounded border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E]">
                  <option value="daily">{t('يومية', 'Daily')}</option>
                  <option value="monthly">{t('شهرية', 'Monthly')}</option>
                  <option value="colored">{t('ملونة', 'Colored')}</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">{t('انحناء القاعدة (BC)', 'Base Curve')}</label>
                <input value={clBaseCurve} onChange={(e) => setClBaseCurve(e.target.value)} className="w-full px-2.5 py-1.5 rounded border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E]" />
              </div>
              <div>
                <label className="block font-semibold mb-1">{t('الكمية في العلبة', 'Qty per Box')}</label>
                <input type="number" value={clBoxQty} onChange={(e) => setClBoxQty(e.target.value)} className="w-full px-2.5 py-1.5 rounded border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E] font-mono-num" />
              </div>
            </div>
          )}

          {categoryId === 'contact_lens_solutions' && (
            <div className="p-3 rounded-xl bg-stone-50 dark:bg-zinc-900 grid sm:grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold mb-1">{t('الحجم (مل)', 'Volume (ml)')}</label>
                <input type="number" value={solVol} onChange={(e) => setSolVol(e.target.value)} className="w-full px-2.5 py-1.5 rounded border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E] font-mono-num" />
              </div>
              <div>
                <label className="block font-semibold mb-1">{t('تاريخ الانتهاء', 'Expiry Date')}</label>
                <input type="date" value={solExp} onChange={(e) => setSolExp(e.target.value)} className="w-full px-2.5 py-1.5 rounded border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E] font-mono-num" />
              </div>
            </div>
          )}

          {/* Product Images Multi-Upload + Compress + Reorder + Main Badge + Preview */}
          <div
            {...productVal.getFieldWrapperProps('images')}
            className={productVal.getControlClasses(
              'images',
              'p-4 rounded-xl bg-stone-50 dark:bg-zinc-900 border border-stone-200 dark:border-zinc-800 space-y-3',
              'p-4 rounded-xl space-y-3'
            )}
          >
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="font-bold flex items-center gap-1.5">
                <ImageIcon className="w-4 h-4 text-[#D9B24C]" />
                {t('صور المنتج (اسحب/رتّب — الأولى هي الرئيسية) *', 'Product Images (compress, reorder, set main) *')}
              </span>
              <label
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.currentTarget.querySelector('input')?.click();
                  }
                }}
                className="min-h-[44px] px-3 py-1.5 rounded-lg bg-[#11223E] text-white font-bold cursor-pointer inline-flex items-center gap-1.5"
              >
                <Upload className="w-3.5 h-3.5" />
                {t('اختيار عدة صور (مع ضغط تلقائي)', 'Upload Multiple Images')}
                <input type="file" multiple accept="image/*" onChange={handleUploadMultipleImages} className="sr-only" />
              </label>
            </div>
            <FieldError
              id={productVal.getErrorId('images')}
              message={productVal.getError('images')}
            />

            {uploadPct !== null && (
              <div className="w-full h-2 rounded-full bg-slate-200 overflow-hidden">
                <div className="h-full bg-[#D9B24C] transition-all" style={{ width: `${uploadPct}%` }} />
              </div>
            )}

            <div className="flex flex-wrap gap-3">
              {images.map((img, i) => (
                <div key={i} className="relative w-28 rounded-xl border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E] p-1.5 space-y-1.5">
                  <div className="aspect-[4/3] rounded-lg overflow-hidden bg-slate-100">
                    <ResilientImage src={img} alt={`Preview ${i + 1}`} className="w-full h-full object-cover" />
                  </div>
                  {i === 0 && (
                    <span className="absolute top-2.5 start-2.5 px-1.5 py-0.5 rounded bg-[#D9B24C] text-[#11223E] text-[10px] font-extrabold">
                      {t('رئيسية', 'Main')}
                    </span>
                  )}
                  <div className="flex items-center justify-between gap-1">
                    <button type="button" onClick={() => moveImage(i, -1)} disabled={i === 0} className="p-1 rounded border disabled:opacity-30">
                      <ArrowUp className="w-3 h-3" />
                    </button>
                    {i !== 0 && (
                      <button
                        type="button"
                        onClick={() => {
                          const next = [img, ...images.filter((_, idx) => idx !== i)];
                          setImages(next);
                        }}
                        className="p-1 rounded border text-[#D9B24C]"
                        title={t('تعيين كرئيسية', 'Set Main')}
                      >
                        <Star className="w-3 h-3 fill-[#D9B24C]" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => setImages(images.filter((_, idx) => idx !== i))}
                      className="p-1 rounded border text-rose-600"
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Variants & Flags */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="font-bold">{t('الألوان / الخيارات المتاحة', 'Color & Box Variants')}</span>
              <button
                type="button"
                onClick={() =>
                  setVariants([...variants, { id: `v_${Date.now()}`, colorNameAr: 'لون جديد', colorNameEn: 'New Color', colorHex: '#11223E', stock: 5 }])
                }
                className="px-2.5 py-1 rounded border border-stone-300 dark:border-zinc-700 font-semibold"
              >
                + {t('خيار لون', 'Add Variant')}
              </button>
            </div>
            <div className="space-y-2">
              {variants.map((v, idx) => (
                <div key={v.id} className="grid grid-cols-2 sm:grid-cols-6 gap-2 items-center p-2 rounded-lg bg-stone-50 dark:bg-zinc-900">
                  <input value={v.colorNameAr} onChange={(e) => setVariants(variants.map((it, i) => (i === idx ? { ...it, colorNameAr: e.target.value } : it)))} placeholder="عربي" className="px-2 py-1 rounded border bg-white dark:bg-[#181B1E]" />
                  <input value={v.colorNameEn} onChange={(e) => setVariants(variants.map((it, i) => (i === idx ? { ...it, colorNameEn: e.target.value } : it)))} placeholder="English" className="px-2 py-1 rounded border bg-white dark:bg-[#181B1E]" />
                  <input type="color" value={v.colorHex} onChange={(e) => setVariants(variants.map((it, i) => (i === idx ? { ...it, colorHex: e.target.value } : it)))} className="h-8 w-full rounded cursor-pointer" />
                  <input type="number" value={v.stock} onChange={(e) => setVariants(variants.map((it, i) => (i === idx ? { ...it, stock: Number(e.target.value) || 0 } : it)))} placeholder="Stock" className="px-2 py-1 rounded border bg-white dark:bg-[#181B1E] font-mono-num" />
                  <label className="text-[11px] px-2 py-1 rounded border bg-white dark:bg-[#181B1E] text-center cursor-pointer truncate">
                    {v.imageUrl ? t('صورة مرفقة ✓', 'Img ✓') : t('صورة للون', 'Color Img')}
                    <input
                      type="file"
                      accept="image/*"
                      className="hidden"
                      onChange={async (ev) => {
                        const f = ev.target.files?.[0];
                        if (!f) return;
                        const uploaded = await uploadAdminImage('products', f);
                        setVariants(variants.map((it, i) => (i === idx ? { ...it, imageUrl: uploaded } : it)));
                      }}
                    />
                  </label>
                  <button type="button" onClick={() => setVariants(variants.filter((_, i) => i !== idx))} className="text-rose-600 justify-self-end">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="flex flex-wrap gap-4 p-3 rounded-xl bg-stone-50 dark:bg-zinc-900">
            {[
              { label: t('ظاهر للعملاء', 'Visible'), val: visible, set: setVisible },
              { label: t('منتج مميز', 'Featured'), val: isFeatured, set: setIsFeatured },
              { label: t('وصل حديثاً', 'New Arrival'), val: isNewArrival, set: setIsNewArrival },
              { label: t('ضمن العروض', 'On Offer'), val: isOnOffer, set: setIsOnOffer },
              { label: t('نفذت الكمية', 'Out of Stock'), val: isOutOfStock, set: setIsOutOfStock },
              { label: t('يتطلب خيار وصفة/عدسات', 'Requires Rx Option'), val: requiresRx, set: setRequiresRx },
            ].map((flag) => (
              <label key={flag.label} className="flex items-center gap-1.5 font-semibold cursor-pointer">
                <input type="checkbox" checked={flag.val} onChange={(e) => flag.set(e.target.checked)} className="accent-[#D9B24C]" />
                <span>{flag.label}</span>
              </label>
            ))}
          </div>

          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setFormOpen(false)} className="px-4 py-2 rounded-xl border border-stone-200 dark:border-zinc-700 font-bold">
              {t('إلغاء', 'Cancel')}
            </button>
            <button type="submit" style={{ backgroundColor: appearance.primaryColor }} className="px-6 py-2 rounded-xl text-white font-extrabold">
              {t('حفظ ونشر التعديلات', 'Save Product')}
            </button>
          </div>
        </form>
      )}

      {/* Products Table */}
      <div className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl divide-y divide-stone-100 dark:divide-zinc-800 overflow-hidden">
        {filtered.length === 0 ? (
          <div className="p-10 text-center text-slate-500">
            {t('لا توجد منتجات مطابقة للتصفية الحالية', 'No products match current filters')}
          </div>
        ) : (
          filtered.map((p) => {
            const isChecked = selectedIds.includes(p.id);
            return (
              <div key={p.id} className="p-3.5 flex flex-wrap items-center justify-between gap-3 hover:bg-stone-50/70 dark:hover:bg-zinc-900/40">
                <div className="flex items-center gap-3 min-w-0 flex-1">
                  <button
                    type="button"
                    onClick={() =>
                      setSelectedIds((prev) =>
                        isChecked ? prev.filter((id) => id !== p.id) : [...prev, p.id]
                      )
                    }
                    className="text-slate-400 hover:text-[#D9B24C]"
                  >
                    {isChecked ? <CheckSquare className="w-4 h-4 text-[#D9B24C]" /> : <Square className="w-4 h-4" />}
                  </button>
                  <div className="w-12 h-10 rounded-lg overflow-hidden bg-slate-100 shrink-0">
                    <ResilientImage src={p.images[0]} alt={p.titleAr} className="w-full h-full object-cover" />
                  </div>
                  <div className="min-w-0">
                    <div className="font-bold truncate">
                      {locale === 'ar' ? p.titleAr : p.titleEn}
                    </div>
                    <div className="text-[11px] text-slate-500 font-mono-num">
                      {p.sku} · {formatSdg(p.priceSdg)} · {t('المخزون:', 'Stock:')} {p.stock}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={() => upsertProduct({ ...p, visible: !p.visible, isDeleted: false })}
                    className={`px-2.5 py-1 rounded-lg font-bold inline-flex items-center gap-1 ${
                      p.visible
                        ? 'bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300'
                        : 'bg-slate-100 text-slate-500 dark:bg-slate-800'
                    }`}
                  >
                    {p.visible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    {p.visible ? t('ظاهر', 'Visible') : t('مخفي', 'Hidden')}
                  </button>
                  <button type="button" onClick={() => duplicateProduct(p.id)} title={t('تكرار', 'Duplicate')} className="p-1.5 rounded-lg border border-stone-200 dark:border-zinc-700 hover:bg-stone-100">
                    <Copy className="w-3.5 h-3.5" />
                  </button>
                  <button type="button" onClick={() => startEdit(p)} className="px-2.5 py-1 rounded-lg border border-stone-200 dark:border-zinc-700 font-semibold">
                    {t('تعديل', 'Edit')}
                  </button>
                  <button type="button" onClick={() => setConfirmDelete({ id: p.id, permanent: Boolean(p.isDeleted) })} className="p-1.5 rounded-lg text-rose-600 hover:bg-rose-50">
                    <Trash2 className="w-4 h-4" />
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>

      {/* Confirmation Dialog for Soft / Permanent Delete */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181B1E] rounded-2xl max-w-sm w-full p-5 space-y-4 border border-stone-200 dark:border-zinc-800 shadow-xl">
            <div className="flex items-center gap-2 text-rose-600 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              {t('تأكيد حذف المنتج', 'Confirm Delete Product')}
            </div>
            <p className="text-slate-600 dark:text-slate-400">
              {t('اختر الحذف للأرشيف (يمكن استعادته) أو الحذف النهائي من القاعدة.', 'Choose soft archive or permanent deletion.')}
            </p>
            <div className="flex flex-wrap justify-end gap-2">
              <button type="button" onClick={() => setConfirmDelete(null)} className="px-3 py-1.5 rounded-lg border font-bold">
                {t('إلغاء', 'Cancel')}
              </button>
              {!confirmDelete.permanent && (
                <button
                  type="button"
                  onClick={() => {
                    const targetId = confirmDelete.id;
                    setConfirmDelete(null);
                    requireSensitiveReauth(
                      t('تأكيد أرشفة المنتج', 'Confirm Product Archive'),
                      () => deleteProduct(targetId, false)
                    );
                  }}
                  className="px-3 py-1.5 rounded-lg bg-amber-600 text-white font-bold"
                >
                  {t('أرشفة (حذف ناعم)', 'Soft Delete')}
                </button>
              )}
              <button
                type="button"
                onClick={() => {
                  const targetId = confirmDelete.id;
                  setConfirmDelete(null);
                  requireSensitiveReauth(
                    t('تأكيد الحذف النهائي للمنتج', 'Confirm Permanent Product Deletion'),
                    () => deleteProduct(targetId, true)
                  );
                }}
                className="px-3 py-1.5 rounded-lg bg-rose-600 text-white font-bold"
              >
                {t('حذف نهائي', 'Permanent Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export const AdminCategoriesBrandsModule: React.FC = () => {
  const {
    locale,
    t,
    categories,
    brands,
    products,
    appearance,
    upsertCategory,
    deleteCategoryAndMove,
    upsertBrand,
    deleteBrand,
    showToast,
  } = useStore();

  const [catNameAr, setCatNameAr] = useState('');
  const [catNameEn, setCatNameEn] = useState('');
  const [catOrder, setCatOrder] = useState('7');
  const [catImage, setCatImage] = useState(IMG_FRAME);
  const [editingCat, setEditingCat] = useState<Category | null>(null);
  const [movePrompt, setMovePrompt] = useState<{ catId: string; count: number; targetId: string } | null>(null);
  const [newSubAr, setNewSubAr] = useState<Record<string, string>>({});

  const [brandNameAr, setBrandNameAr] = useState('');
  const [brandNameEn, setBrandNameEn] = useState('');
  const [brandCountry, setBrandCountry] = useState('');

  const catVal = useFormValidation({ formId: 'admin-category' });
  const brandVal = useFormValidation({ formId: 'admin-brand' });

  const buildCatRules = useCallback((): FieldValidationRule[] => [
    {
      field: 'catNameAr',
      label: t('اسم التصنيف (عربي)', 'Category Name (AR)'),
      error: !catNameAr.trim() ? pickMsg(VALIDATION_MESSAGES.categoryNameArRequired, locale) : null,
    },
    {
      field: 'catImage',
      label: t('صورة التصنيف', 'Category Image'),
      error: !catImage.trim() ? pickMsg(VALIDATION_MESSAGES.categoryImageRequired, locale) : null,
    },
  ], [catNameAr, catImage, locale, t]);

  const buildBrandRules = useCallback((): FieldValidationRule[] => [
    {
      field: 'brandNameAr',
      label: t('اسم العلامة التجارية (عربي)', 'Brand Name (AR)'),
      error: !brandNameAr.trim() ? pickMsg(VALIDATION_MESSAGES.brandNameArRequired, locale) : null,
    },
  ], [brandNameAr, locale, t]);

  useEffect(() => {
    if (catVal.submitted) catVal.revalidate(buildCatRules());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [catVal.submitted, buildCatRules]);

  useEffect(() => {
    if (brandVal.submitted) brandVal.revalidate(buildBrandRules());
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [brandVal.submitted, buildBrandRules]);

  const handleSaveCategory = (e: React.FormEvent) => {
    e.preventDefault();
    if (!catVal.validateAll(buildCatRules())) return;
    upsertCategory({
      id: editingCat ? editingCat.id : `cat_${Date.now()}`,
      nameAr: catNameAr.trim(),
      nameEn: catNameEn.trim() || catNameAr.trim(),
      descriptionAr: editingCat?.descriptionAr || '',
      descriptionEn: editingCat?.descriptionEn || '',
      order: Number(catOrder) || 1,
      image: catImage,
      visible: editingCat?.visible ?? true,
      subcategories: editingCat?.subcategories || [],
    });
    setEditingCat(null);
    setCatNameAr('');
    setCatNameEn('');
    catVal.reset();
  };

  const tryDeleteCategory = (catId: string) => {
    const linkedCount = products.filter((p) => !p.isDeleted && p.categoryId === catId).length;
    if (linkedCount > 0) {
      const other = categories.find((c) => c.id !== catId);
      setMovePrompt({ catId, count: linkedCount, targetId: other?.id || '' });
      return;
    }
    deleteCategoryAndMove(catId);
  };

  return (
    <div className="grid lg:grid-cols-12 gap-6 items-start text-xs">
      {/* Categories & Subcategories */}
      <div className="lg:col-span-7 space-y-4">
        <form noValidate onSubmit={handleSaveCategory} className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-4 space-y-3">
          <h2 className="text-base font-bold">
            {editingCat ? t('تعديل التصنيف', 'Edit Category') : t('إضافة تصنيف جديد', 'Add Category')}
          </h2>
          <ValidationSummaryBanner
            errors={catVal.errors}
            onSelectField={catVal.focusField}
            mode="form"
          />
          <div className="grid sm:grid-cols-3 gap-2">
            <div {...catVal.getFieldWrapperProps('catNameAr')}>
              <input
                value={catNameAr}
                onChange={(e) => setCatNameAr(e.target.value)}
                placeholder={t('الاسم بالعربية *', 'Name (AR) *')}
                {...catVal.getInputA11yProps('catNameAr')}
                className={`w-full min-h-[44px] px-3 py-2 rounded-lg ${catVal.getControlClasses(
                  'catNameAr',
                  'border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900'
                )}`}
              />
              <FieldError
                id={catVal.getErrorId('catNameAr')}
                message={catVal.getError('catNameAr')}
              />
            </div>
            <input value={catNameEn} onChange={(e) => setCatNameEn(e.target.value)} placeholder={t('الاسم بالإنجليزية', 'Name (EN)')} className="min-h-[44px] px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900 self-start" />
            <input type="number" value={catOrder} onChange={(e) => setCatOrder(e.target.value)} placeholder={t('الترتيب', 'Order')} className="min-h-[44px] px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900 font-mono-num self-start" />
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div {...catVal.getFieldWrapperProps('catImage')} className="space-y-1">
              <label
                tabIndex={0}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    e.currentTarget.querySelector('input')?.click();
                  }
                }}
                className={`min-h-[44px] px-3 py-1.5 rounded-lg cursor-pointer font-semibold inline-flex items-center gap-1.5 ${catVal.getControlClasses(
                  'catImage',
                  'border border-stone-200 dark:border-zinc-700'
                )}`}
              >
                <Upload className="w-3.5 h-3.5" />
                {t('رفع صورة التصنيف', 'Upload Image')}
                <input
                  type="file"
                  accept="image/*"
                  className="sr-only"
                  onChange={async (e) => {
                    const f = e.target.files?.[0];
                    if (f) setCatImage(await uploadAdminImage('categories', f));
                  }}
                />
              </label>
              <FieldError
                id={catVal.getErrorId('catImage')}
                message={catVal.getError('catImage')}
              />
            </div>
            <button type="submit" style={{ backgroundColor: appearance.primaryColor }} className="min-h-[44px] px-4 py-1.5 rounded-lg text-white font-bold">
              {editingCat ? t('تحديث', 'Update') : t('إضافة', 'Add')}
            </button>
          </div>
        </form>

        <div className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl divide-y divide-stone-100 dark:divide-zinc-800">
          {categories
            .slice()
            .sort((a, b) => a.order - b.order)
            .map((c) => {
              const prodCount = products.filter((p) => !p.isDeleted && p.categoryId === c.id).length;
              return (
                <div key={c.id} className="p-4 space-y-2.5">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-3">
                      <img src={c.image} alt="" className="w-10 h-10 rounded-lg object-cover border" />
                      <div>
                        <div className="font-bold">
                          #{c.order} · {locale === 'ar' ? c.nameAr : c.nameEn}
                        </div>
                        <div className="text-[11px] text-slate-500 font-mono-num">
                          {prodCount} {t('منتج', 'products')}
                        </div>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => upsertCategory({ ...c, visible: !c.visible })}
                        className={`px-2.5 py-1 rounded-lg font-bold ${c.visible ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                      >
                        {c.visible ? t('ظاهر', 'Visible') : t('مخفي', 'Hidden')}
                      </button>
                      <button
                        type="button"
                        onClick={() => {
                          setEditingCat(c);
                          setCatNameAr(c.nameAr);
                          setCatNameEn(c.nameEn);
                          setCatOrder(String(c.order));
                          setCatImage(c.image);
                        }}
                        className="px-2.5 py-1 rounded border font-semibold"
                      >
                        {t('تعديل', 'Edit')}
                      </button>
                      <button type="button" onClick={() => tryDeleteCategory(c.id)} className="text-rose-600 p-1">
                        <Trash2 className="w-4 h-4" />
                      </button>
                    </div>
                  </div>

                  {/* Subcategories manager */}
                  <div className="ps-4 border-s-2 border-stone-200 dark:border-zinc-700 space-y-1.5">
                    <div className="flex flex-wrap gap-1.5">
                      {(c.subcategories || []).map((sub) => (
                        <span key={sub.id} className="inline-flex items-center gap-1 px-2 py-0.5 rounded bg-stone-100 dark:bg-zinc-900">
                          {locale === 'ar' ? sub.nameAr : sub.nameEn}
                          <button
                            type="button"
                            onClick={() =>
                              upsertCategory({
                                ...c,
                                subcategories: c.subcategories.filter((s) => s.id !== sub.id),
                              })
                            }
                            className="text-rose-600 font-bold"
                          >
                            ×
                          </button>
                        </span>
                      ))}
                    </div>
                    <div className="flex gap-1.5 max-w-xs">
                      <input
                        value={newSubAr[c.id] || ''}
                        onChange={(e) => setNewSubAr({ ...newSubAr, [c.id]: e.target.value })}
                        placeholder={t('إضافة قسم فرعي...', 'Add subcategory...')}
                        className="flex-1 px-2 py-1 rounded border bg-stone-50 dark:bg-zinc-900"
                      />
                      <button
                        type="button"
                        onClick={() => {
                          const txt = (newSubAr[c.id] || '').trim();
                          if (!txt) return;
                          upsertCategory({
                            ...c,
                            subcategories: [...(c.subcategories || []), { id: `sub_${Date.now()}`, nameAr: txt, nameEn: txt, visible: true }],
                          });
                          setNewSubAr({ ...newSubAr, [c.id]: '' });
                        }}
                        className="px-2.5 py-1 rounded bg-stone-800 text-white font-bold"
                      >
                        +
                      </button>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>

      {/* Brands Manager */}
      <div className="lg:col-span-5 space-y-4">
        <form
          noValidate
          onSubmit={(e) => {
            e.preventDefault();
            if (!brandVal.validateAll(buildBrandRules())) return;
            upsertBrand({
              id: `br_${Date.now()}`,
              nameAr: brandNameAr.trim(),
              nameEn: brandNameEn.trim() || brandNameAr.trim(),
              country: brandCountry.trim() || 'Sudan',
              visible: true,
            });
            setBrandNameAr('');
            setBrandNameEn('');
            setBrandCountry('');
            brandVal.reset();
          }}
          className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-4 space-y-3"
        >
          <h2 className="text-base font-bold">{t('إدارة العلامات التجارية', 'Brands Management')}</h2>
          <ValidationSummaryBanner
            errors={brandVal.errors}
            onSelectField={brandVal.focusField}
            mode="form"
          />
          <div {...brandVal.getFieldWrapperProps('brandNameAr')}>
            <input
              value={brandNameAr}
              onChange={(e) => setBrandNameAr(e.target.value)}
              placeholder={t('اسم الماركة (عربي) *', 'Brand Name (AR) *')}
              {...brandVal.getInputA11yProps('brandNameAr')}
              className={`w-full min-h-[44px] px-3 py-2 rounded-lg ${brandVal.getControlClasses(
                'brandNameAr',
                'border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900'
              )}`}
            />
            <FieldError
              id={brandVal.getErrorId('brandNameAr')}
              message={brandVal.getError('brandNameAr')}
            />
          </div>
          <div className="grid grid-cols-2 gap-2">
            <input value={brandNameEn} onChange={(e) => setBrandNameEn(e.target.value)} placeholder={t('الاسم (إنجليزي)', 'Name (EN)')} className="min-h-[44px] px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900" />
            <input value={brandCountry} onChange={(e) => setBrandCountry(e.target.value)} placeholder={t('بلد المنشأ', 'Country')} className="min-h-[44px] px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900" />
          </div>
          <button type="submit" style={{ backgroundColor: appearance.primaryColor }} className="w-full min-h-[44px] py-2 rounded-lg text-white font-bold">
            {t('إضافة علامة تجارية', 'Add Brand')}
          </button>
        </form>

        <div className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl divide-y divide-stone-100 dark:divide-zinc-800">
          {brands.map((b: Brand) => (
            <div key={b.id} className="p-3.5 flex items-center justify-between gap-2">
              <div>
                <div className="font-bold">{locale === 'ar' ? b.nameAr : b.nameEn}</div>
                <div className="text-[11px] text-slate-500">{b.country}</div>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => upsertBrand({ ...b, visible: !b.visible })}
                  className={`px-2 py-1 rounded font-bold ${b.visible ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
                >
                  {b.visible ? t('ظاهرة', 'Visible') : t('مخفية', 'Hidden')}
                </button>
                <button type="button" onClick={() => deleteBrand(b.id)} className="text-rose-600 p-1">
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Category Deletion Safeguard & Migration Modal */}
      {movePrompt && (
        <div className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center p-4">
          <div className="bg-white dark:bg-[#181B1E] rounded-2xl max-w-md w-full p-5 space-y-4 border shadow-xl">
            <div className="flex items-center gap-2 text-amber-600 font-bold text-sm">
              <AlertTriangle className="w-5 h-5" />
              {t('لا يمكن حذف تصنيف يحتوي على منتجات', 'Category Has Active Products')}
            </div>
            <p className="text-slate-600 dark:text-slate-400">
              {t(
                `يوجد ${movePrompt.count} منتج مرتبط بهذا التصنيف. اختر التصنيف البديل لنقل المنتجات إليه قبل الحذف:`,
                `This category has ${movePrompt.count} products. Pick a destination category to move them first:`
              )}
            </p>
            <select
              value={movePrompt.targetId}
              onChange={(e) => setMovePrompt({ ...movePrompt, targetId: e.target.value })}
              className="w-full px-3 py-2 rounded-lg border bg-stone-50 dark:bg-zinc-900"
            >
              {categories
                .filter((c) => c.id !== movePrompt.catId)
                .map((c) => (
                  <option key={c.id} value={c.id}>{locale === 'ar' ? c.nameAr : c.nameEn}</option>
                ))}
            </select>
            <div className="flex justify-end gap-2">
              <button type="button" onClick={() => setMovePrompt(null)} className="px-3 py-1.5 rounded-lg border font-bold">
                {t('إلغاء', 'Cancel')}
              </button>
              <button
                type="button"
                onClick={() => {
                  if (!movePrompt.targetId) {
                    showToast(t('اختر تصنيفاً بديلاً أولاً', 'Select target category'));
                    return;
                  }
                  deleteCategoryAndMove(movePrompt.catId, movePrompt.targetId);
                  setMovePrompt(null);
                }}
                className="px-4 py-1.5 rounded-lg bg-rose-600 text-white font-bold"
              >
                {t('نقل المنتجات ثم الحذف', 'Move Products & Delete')}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
