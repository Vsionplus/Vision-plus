import React from 'react';
import { Heart, Star, Plus, Minus, Trash2, ShoppingCart } from 'lucide-react';
import { Product } from '../types';
import { useStore } from '../store/StoreContext';
import { formatSdg } from '../utils/format';
import { ResilientImage } from './ResilientImage';

interface ProductCardProps {
  product: Product;
}

export const ProductCard: React.FC<ProductCardProps> = ({ product }) => {
  const {
    locale,
    t,
    visibleBrands,
    visibleCategories,
    appTexts,
    appearance,
    user,
    cart,
    toggleFavorite,
    openProduct,
    addToCart,
    updateCartQty,
  } = useStore();
  const isFav = user.favoriteProductIds.includes(product.id);
  const brand = visibleBrands.find((b) => b.id === product.brandId);
  const category = visibleCategories.find((c) => c.id === product.categoryId);

  const title = locale === 'ar' ? product.titleAr : product.titleEn;
  const brandName = brand ? (locale === 'ar' ? brand.nameAr : brand.nameEn) : '';
  const catName = category ? (locale === 'ar' ? category.nameAr : category.nameEn) : '';

  const isUnavailable = Boolean(product.isOutOfStock) || product.stock <= 0;

  const discountPct =
    product.oldPriceSdg && product.oldPriceSdg > product.priceSdg
      ? Math.round(((product.oldPriceSdg - product.priceSdg) / product.oldPriceSdg) * 100)
      : 0;

  const cartMatches = cart.filter((c) => c.productId === product.id);
  const primaryCartItem = cartMatches[0];
  const qtyInCart = cartMatches.reduce((sum, c) => sum + c.quantity, 0);

  const handleDirectAdd = (e?: React.MouseEvent) => {
    e?.stopPropagation();
    if (isUnavailable) return;

    const defaultVariant = product.variants[0];
    addToCart({
      productId: product.id,
      variantId: defaultVariant?.id,
      variantLabel: defaultVariant
        ? locale === 'ar'
          ? defaultVariant.colorNameAr
          : defaultVariant.colorNameEn
        : undefined,
      quantity: 1,
      unitPriceSdg: product.priceSdg,
      ...(product.contactLensSpecs
        ? {
            contactLensSelection: {
              rightSph: product.contactLensSpecs.sphOptions[0] || '-1.00',
              leftSph: product.contactLensSpecs.sphOptions[0] || '-1.00',
            },
          }
        : {}),
    });
  };

  return (
    <article className="group flex flex-col bg-white dark:bg-[#131C2E] border border-slate-200 dark:border-slate-800 rounded-2xl overflow-hidden transition-transform duration-200 hover:-translate-y-0.5 hover:border-[var(--vp-secondary)]">
      <div className="relative aspect-[4/3] bg-slate-100 dark:bg-slate-900 overflow-hidden">
        <button
          type="button"
          onClick={() => openProduct(product.id)}
          className="w-full h-full block text-start focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--vp-secondary)]"
        >
          <ResilientImage
            src={product.images[0]}
            alt={title}
            className="w-full h-full object-cover transition-transform duration-300 group-hover:scale-[1.03]"
          />
        </button>

        {/* Favorite heart top-end */}
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(product.id);
          }}
          aria-label={t('إضافة للمفضلة', 'Toggle favorite')}
          className="absolute top-3 end-3 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-xl bg-white/95 dark:bg-[#131C2E]/95 border border-slate-200 dark:border-slate-700 text-[#11223E] dark:text-slate-200 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
        >
          <Heart
            className={`w-4 h-4 ${isFav ? 'fill-rose-600 text-rose-600 dark:fill-rose-400 dark:text-rose-400' : ''}`}
          />
        </button>

        {/* Direct Add-to-Cart icon mark on image bottom-end */}
        {!isUnavailable && (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              if (primaryCartItem) {
                if (qtyInCart < product.stock) updateCartQty(primaryCartItem.id, 1);
              } else {
                handleDirectAdd(e);
              }
            }}
            style={{ backgroundColor: appearance.secondaryColor, color: appearance.primaryColor }}
            aria-label={t('إضافة مباشرة للسلة', 'Add directly to cart')}
            title={t('إضافة مباشرة للسلة', 'Add directly to cart')}
            className="absolute bottom-3 end-3 min-h-[42px] min-w-[42px] px-2.5 flex items-center justify-center gap-1 rounded-full shadow-md font-extrabold text-xs transition-transform active:scale-95"
          >
            <ShoppingCart className="w-4 h-4" />
            <Plus className="w-3.5 h-3.5 stroke-[2.5]" />
            {qtyInCart > 0 && (
              <span
                style={{ backgroundColor: appearance.primaryColor }}
                className="font-mono-num ms-0.5 px-1.5 py-0.5 rounded-full text-white text-[10px] tabular-nums"
              >
                {qtyInCart}
              </span>
            )}
          </button>
        )}

        {isUnavailable && (
          <div className="absolute bottom-3 start-3 px-2.5 py-1 bg-[#11223E]/90 text-white text-xs font-semibold rounded-lg">
            {locale === 'ar' ? appTexts.btnOutOfStockAr : appTexts.btnOutOfStockEn}
          </div>
        )}
      </div>

      <div className="p-4 flex flex-col flex-1 justify-between gap-3">
        <div>
          <div className="flex items-center gap-1.5 text-xs text-slate-500 dark:text-slate-400 mb-1.5">
            {brandName && <span className="truncate">{brandName}</span>}
            {brandName && catName && <span aria-hidden="true">·</span>}
            {catName && <span className="truncate">{catName}</span>}
            {discountPct > 0 && (
              <>
                <span aria-hidden="true">·</span>
                <span className="font-bold text-[#B38B2D] dark:text-[#E2BD5B]">
                  {t(`خصم ${discountPct}%`, `${discountPct}% off`)}
                </span>
              </>
            )}
          </div>

          <button
            type="button"
            onClick={() => openProduct(product.id)}
            className="text-start font-bold text-base text-[#11223E] dark:text-slate-100 hover:text-[#B38B2D] dark:hover:text-[#E2BD5B] transition-colors line-clamp-2"
          >
            {title}
          </button>
        </div>

        <div className="pt-2 border-t border-slate-100 dark:border-slate-800 flex items-center justify-between gap-2">
          <div className="flex flex-col">
            <span className="font-mono-num text-base font-extrabold text-[#11223E] dark:text-white tabular-nums">
              {formatSdg(product.priceSdg)}
            </span>
            <div className="flex items-center gap-2">
              {product.oldPriceSdg && product.oldPriceSdg > product.priceSdg && (
                <span className="font-mono-num text-xs text-slate-400 dark:text-slate-500 line-through tabular-nums">
                  {formatSdg(product.oldPriceSdg)}
                </span>
              )}
              <span className="flex items-center gap-0.5 text-[11px] text-slate-500 dark:text-slate-400 tabular-nums">
                <Star className="w-3 h-3 fill-[#D9B24C] text-[#D9B24C]" />
                {product.rating.toFixed(1)}
              </span>
            </div>
          </div>

          {isUnavailable ? (
            <button
              type="button"
              disabled
              className="min-h-[44px] px-3 rounded-xl bg-slate-200 dark:bg-slate-800 text-slate-500 text-xs font-bold cursor-not-allowed"
            >
              {locale === 'ar' ? appTexts.btnOutOfStockAr : appTexts.btnOutOfStockEn}
            </button>
          ) : primaryCartItem ? (
            <div className="min-h-[44px] flex items-center rounded-xl border-2 border-[var(--vp-secondary)] bg-[#D9B24C]/15 overflow-hidden">
              <button
                type="button"
                onClick={() => updateCartQty(primaryCartItem.id, -1)}
                aria-label={t('إنقاص', 'Decrease')}
                className="min-w-[38px] min-h-[44px] flex items-center justify-center hover:bg-[#D9B24C]/25"
              >
                {primaryCartItem.quantity === 1 ? (
                  <Trash2 className="w-3.5 h-3.5 text-rose-600" />
                ) : (
                  <Minus className="w-3.5 h-3.5" />
                )}
              </button>
              <span className="px-2 font-mono-num text-xs font-extrabold tabular-nums">
                {qtyInCart}
              </span>
              <button
                type="button"
                disabled={qtyInCart >= product.stock}
                onClick={() => updateCartQty(primaryCartItem.id, 1)}
                aria-label={t('زيادة', 'Increase')}
                className="min-w-[38px] min-h-[44px] flex items-center justify-center hover:bg-[#D9B24C]/25 disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleDirectAdd}
              style={{ backgroundColor: appearance.primaryColor }}
              className="min-h-[44px] px-3.5 rounded-xl text-white text-xs font-bold flex items-center gap-1.5 hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
            >
              <ShoppingCart className="w-3.5 h-3.5" />
              <span>{locale === 'ar' ? appTexts.btnAddToCartAr : appTexts.btnAddToCartEn}</span>
            </button>
          )}
        </div>
      </div>
    </article>
  );
};
