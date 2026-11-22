import React, { useMemo, useState } from 'react';
import { Search, SlidersHorizontal, X } from 'lucide-react';
import { useStore } from '../store/StoreContext';
import { CategoryId } from '../types';
import { formatSdg } from '../utils/format';
import { ProductCard } from './ProductCard';

interface CatalogViewProps {
  favoritesOnly?: boolean;
}

export const CatalogView: React.FC<CatalogViewProps> = ({ favoritesOnly = false }) => {
  const {
    locale,
    t,
    visibleProducts,
    visibleCategories,
    visibleBrands,
    appTexts,
    appearance,
    user,
    catalogCategory,
    catalogSearch,
    openCatalog,
    setCatalogSearch,
  } = useStore();

  const [brandFilter, setBrandFilter] = useState<string>('all');
  const [genderFilter, setGenderFilter] = useState<string>('all');
  const [shapeFilter, setShapeFilter] = useState<string>('all');
  const [materialFilter, setMaterialFilter] = useState<string>('all');
  const [lensTypeFilter, setLensTypeFilter] = useState<string>('all');
  const [maxPriceSdg, setMaxPriceSdg] = useState<number>(150000);
  const [sortBy, setSortBy] = useState<'featured' | 'price_asc' | 'price_desc' | 'rating'>('featured');
  const [page, setPage] = useState(1);
  const [showFiltersMobile, setShowFiltersMobile] = useState(false);

  const pageSize = 6;

  const filteredProducts = useMemo(() => {
    const q = catalogSearch.trim().toLowerCase();
    return visibleProducts
      .filter((p) => {
        if (favoritesOnly && !user.favoriteProductIds.includes(p.id)) return false;
        if (!favoritesOnly && catalogCategory !== 'all' && p.categoryId !== catalogCategory) return false;
        if (brandFilter !== 'all' && p.brandId !== brandFilter) return false;
        if (genderFilter !== 'all' && p.gender !== genderFilter) return false;
        if (shapeFilter !== 'all' && p.frameShape !== shapeFilter) return false;
        if (materialFilter !== 'all' && p.material !== materialFilter) return false;
        if (lensTypeFilter !== 'all' && p.contactLensSpecs?.type !== lensTypeFilter) return false;
        if (p.priceSdg > maxPriceSdg) return false;
        if (q) {
          const hay = `${p.titleAr} ${p.titleEn} ${p.descriptionAr} ${p.descriptionEn} ${(p.tags || []).join(' ')} ${p.sku}`.toLowerCase();
          if (!hay.includes(q)) return false;
        }
        return true;
      })
      .sort((a, b) => {
        if (sortBy === 'price_asc') return a.priceSdg - b.priceSdg;
        if (sortBy === 'price_desc') return b.priceSdg - a.priceSdg;
        if (sortBy === 'rating') return b.rating - a.rating;
        return Number(b.isFeatured) - Number(a.isFeatured);
      });
  }, [
    visibleProducts,
    favoritesOnly,
    user.favoriteProductIds,
    catalogCategory,
    brandFilter,
    genderFilter,
    shapeFilter,
    materialFilter,
    lensTypeFilter,
    maxPriceSdg,
    catalogSearch,
    sortBy,
  ]);

  const totalPages = Math.max(1, Math.ceil(filteredProducts.length / pageSize));
  const safePage = Math.min(page, totalPages);
  const paginatedProducts = filteredProducts.slice((safePage - 1) * pageSize, safePage * pageSize);

  const resetFilters = () => {
    openCatalog('all', '');
    setBrandFilter('all');
    setGenderFilter('all');
    setShapeFilter('all');
    setMaterialFilter('all');
    setLensTypeFilter('all');
    setMaxPriceSdg(150000);
    setPage(1);
  };

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 pt-6 space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-2xl font-extrabold">
            {favoritesOnly ? t('المفضلة', 'Saved Favorites') : t('كتالوج المنتجات', 'Optical Catalog')}
          </h1>
          <p className="text-xs text-stone-500 dark:text-zinc-400 mt-1">
            {t(`عرض ${filteredProducts.length} منتج`, `Showing ${filteredProducts.length} products`)}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <div className="relative flex-1 sm:w-64">
            <Search className="w-4 h-4 absolute top-1/2 -translate-y-1/2 start-3 text-stone-400" />
            <input
              type="text"
              value={catalogSearch}
              onChange={(e) => {
                setCatalogSearch(e.target.value);
                setPage(1);
              }}
              placeholder={locale === 'ar' ? appTexts.searchPlaceholderAr : appTexts.searchPlaceholderEn}
              className="w-full ps-9 pe-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E] text-sm focus:outline-none focus:ring-2 focus:ring-[var(--vp-secondary)]"
            />
          </div>

          <select
            value={sortBy}
            onChange={(e) => setSortBy(e.target.value as typeof sortBy)}
            className="px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E] text-xs font-medium"
          >
            <option value="featured">{t('الأكثر تميزاً', 'Featured')}</option>
            <option value="price_asc">{t('السعر: الأقل للأعلى', 'Price: Low to High')}</option>
            <option value="price_desc">{t('السعر: الأعلى للأقل', 'Price: High to Low')}</option>
            <option value="rating">{t('الأعلى تقييماً', 'Top Rated')}</option>
          </select>

          <button
            type="button"
            onClick={() => setShowFiltersMobile(!showFiltersMobile)}
            className="lg:hidden px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-white dark:bg-[#181B1E] text-xs font-semibold flex items-center gap-1.5"
          >
            <SlidersHorizontal className="w-4 h-4" />
            {t('تصفية', 'Filters')}
          </button>
        </div>
      </div>

      {/* Category Switcher Row */}
      {!favoritesOnly && (
        <div className="flex items-center gap-2 overflow-x-auto pb-1">
          <button
            type="button"
            onClick={() => {
              openCatalog('all', catalogSearch);
              setPage(1);
            }}
            style={
              catalogCategory === 'all'
                ? { backgroundColor: appearance.primaryColor, borderColor: appearance.primaryColor }
                : undefined
            }
            className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors ${
              catalogCategory === 'all'
                ? 'text-white'
                : 'bg-white dark:bg-[#181B1E] border-stone-200 dark:border-zinc-800 text-stone-700 dark:text-zinc-300'
            }`}
          >
            {t('الكل', 'All Categories')}
          </button>
          {visibleCategories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => {
                openCatalog(c.id as CategoryId, catalogSearch);
                setPage(1);
              }}
              style={
                catalogCategory === c.id
                  ? { backgroundColor: appearance.primaryColor, borderColor: appearance.primaryColor }
                  : undefined
              }
              className={`px-3.5 py-2 rounded-lg text-xs font-semibold whitespace-nowrap border transition-colors ${
                catalogCategory === c.id
                  ? 'text-white'
                  : 'bg-white dark:bg-[#181B1E] border-stone-200 dark:border-zinc-800 text-stone-700 dark:text-zinc-300'
              }`}
            >
              {locale === 'ar' ? c.nameAr : c.nameEn}
            </button>
          ))}
        </div>
      )}

      <div className="grid lg:grid-cols-12 gap-6 items-start">
        <aside
          className={`lg:col-span-3 bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-4 space-y-4 ${
            showFiltersMobile ? 'block' : 'hidden lg:block'
          }`}
        >
          <div className="flex items-center justify-between">
            <h2 className="text-sm font-bold">{t('خيارات التصفية', 'Filter Results')}</h2>
            <button
              type="button"
              onClick={resetFilters}
              className="text-xs text-[#B38B2D] hover:underline flex items-center gap-1"
            >
              <X className="w-3.5 h-3.5" />
              {t('إعادة ضبط', 'Reset')}
            </button>
          </div>

          <div className="space-y-1.5">
            <label className="block text-xs font-semibold text-stone-600 dark:text-zinc-400">
              {t('الحد الأقصى للسعر', 'Max Price (SDG)')}:{' '}
              <span className="font-mono-num text-stone-900 dark:text-stone-100">
                {formatSdg(maxPriceSdg)}
              </span>
            </label>
            <input
              type="range"
              min={10000}
              max={150000}
              step={5000}
              value={maxPriceSdg}
              onChange={(e) => {
                setMaxPriceSdg(Number(e.target.value));
                setPage(1);
              }}
              className="w-full accent-[var(--vp-secondary)]"
            />
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-stone-600 dark:text-zinc-400">
              {t('العلامة التجارية', 'Brand')}
            </label>
            <select
              value={brandFilter}
              onChange={(e) => {
                setBrandFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-xs"
            >
              <option value="all">{t('جميع الماركات', 'All Brands')}</option>
              {visibleBrands.map((b) => (
                <option key={b.id} value={b.id}>
                  {locale === 'ar' ? b.nameAr : b.nameEn}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-stone-600 dark:text-zinc-400">
              {t('الفئة العمرية / الجنس', 'Gender')}
            </label>
            <select
              value={genderFilter}
              onChange={(e) => {
                setGenderFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-xs"
            >
              <option value="all">{t('الكل', 'All')}</option>
              <option value="unisex">{t('للجنسين', 'Unisex')}</option>
              <option value="men">{t('رجالي', 'Men')}</option>
              <option value="women">{t('نسائي', 'Women')}</option>
              <option value="kids">{t('أطفال', 'Kids')}</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-stone-600 dark:text-zinc-400">
              {t('شكل الإطار', 'Frame Shape')}
            </label>
            <select
              value={shapeFilter}
              onChange={(e) => {
                setShapeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-xs"
            >
              <option value="all">{t('جميع الأشكال', 'All Shapes')}</option>
              <option value="square">{t('مربع', 'Square')}</option>
              <option value="round">{t('دائري', 'Round')}</option>
              <option value="aviator">{t('أفياتور', 'Aviator')}</option>
              <option value="cat_eye">{t('عين القطة', 'Cat Eye')}</option>
              <option value="rectangle">{t('مستطيل', 'Rectangle')}</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-stone-600 dark:text-zinc-400">
              {t('الخامة', 'Material')}
            </label>
            <select
              value={materialFilter}
              onChange={(e) => {
                setMaterialFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-xs"
            >
              <option value="all">{t('جميع الخامات', 'All Materials')}</option>
              <option value="acetate">{t('أسيتات', 'Acetate')}</option>
              <option value="titanium">{t('تيتانيوم', 'Titanium')}</option>
              <option value="tr90">{t('TR90 مرن', 'Flexible TR90')}</option>
              <option value="metal">{t('معدن', 'Metal')}</option>
              <option value="hydrogel">{t('هيدروجيل', 'Hydrogel')}</option>
            </select>
          </div>

          <div className="space-y-1">
            <label className="block text-xs font-semibold text-stone-600 dark:text-zinc-400">
              {t('نوع العدسة اللاصقة', 'Contact Lens Type')}
            </label>
            <select
              value={lensTypeFilter}
              onChange={(e) => {
                setLensTypeFilter(e.target.value);
                setPage(1);
              }}
              className="w-full px-3 py-2 rounded-lg border border-stone-200 dark:border-zinc-700 bg-stone-50 dark:bg-zinc-900 text-xs"
            >
              <option value="all">{t('الكل', 'All')}</option>
              <option value="daily">{t('يومية', 'Daily')}</option>
              <option value="monthly">{t('شهرية', 'Monthly')}</option>
              <option value="colored">{t('ملونة', 'Colored')}</option>
            </select>
          </div>
        </aside>

        {/* Product Grid */}
        <div className="lg:col-span-9 space-y-6">
          {paginatedProducts.length === 0 ? (
            <div className="bg-white dark:bg-[#181B1E] border border-stone-200 dark:border-zinc-800 rounded-xl p-12 text-center space-y-3">
              <p className="text-base font-semibold">
                {favoritesOnly
                  ? locale === 'ar'
                    ? appTexts.emptyFavoritesAr
                    : appTexts.emptyFavoritesEn
                  : locale === 'ar'
                  ? appTexts.emptyCatalogAr
                  : appTexts.emptyCatalogEn}
              </p>
              <button
                type="button"
                onClick={resetFilters}
                style={{ backgroundColor: appearance.primaryColor }}
                className="px-4 py-2 rounded-lg text-white text-xs font-semibold"
              >
                {locale === 'ar' ? appTexts.btnStartShoppingAr : appTexts.btnStartShoppingEn}
              </button>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-3 gap-5">
                {paginatedProducts.map((p) => (
                  <ProductCard key={p.id} product={p} />
                ))}
              </div>

              {totalPages > 1 && (
                <div className="flex items-center justify-center gap-2 pt-2">
                  {Array.from({ length: totalPages }, (_, idx) => idx + 1).map((num) => (
                    <button
                      key={num}
                      type="button"
                      onClick={() => setPage(num)}
                      style={
                        safePage === num
                          ? { backgroundColor: appearance.primaryColor, borderColor: appearance.primaryColor }
                          : undefined
                      }
                      className={`min-w-[38px] h-[38px] rounded-lg text-xs font-bold font-mono-num border transition-colors ${
                        safePage === num
                          ? 'text-white'
                          : 'bg-white dark:bg-[#181B1E] border-stone-200 dark:border-zinc-800'
                      }`}
                    >
                      {num}
                    </button>
                  ))}
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
