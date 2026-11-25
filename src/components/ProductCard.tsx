import React from 'react';
import { Heart, Plus, Minus, Trash2 } from 'lucide-react';
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

  const title = locale === 'ar' ? product.titleAr : product.titleEn;
  const brandName = brand ? (locale === 'ar' ? brand.nameAr : brand.nameEn) : '';
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
      selectedOptions: defaultVariant
        ? { color: locale === 'ar' ? defaultVariant.colorNameAr : defaultVariant.colorNameEn }
        : undefined,
      quantity: 1,
      unitPriceSdg: product.priceSdg,
    });
  };

  return (
    <article className="group flex flex-col bg-white dark:bg-[#111927] border border-slate-200/80 dark:border-slate-800 rounded-2xl overflow-hidden transition-colors hover:border-slate-300 dark:hover:border-slate-700">
      {/* Clean Photo Frame — Favorite icon only */}
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

        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            toggleFavorite(product.id);
          }}
          aria-label={t('إضافة للمفضلة', 'Toggle favorite')}
          className="absolute top-2.5 end-2.5 min-h-[40px] min-w-[40px] flex items-center justify-center rounded-full bg-white/90 dark:bg-[#111927]/90 text-[#11223E] dark:text-slate-200 hover:text-rose-600 dark:hover:text-rose-400 transition-colors"
        >
          <Heart
            className={`w-4 h-4 ${isFav ? 'fill-rose-600 text-rose-600 dark:fill-rose-400 dark:text-rose-400' : ''}`}
          />
        </button>

        {isUnavailable && (
          <div className="absolute bottom-2.5 start-2.5 px-2.5 py-1 bg-[#11223E]/90 text-white text-[11px] font-semibold rounded-lg">
            {locale === 'ar' ? appTexts.btnOutOfStockAr : appTexts.btnOutOfStockEn}
          </div>
        )}
      </div>

      {/* Minimalist Card Body */}
      <div className="p-4 flex flex-col flex-1 justify-between gap-3">
        <div className="space-y-1">
          {(brandName || discountPct > 0) && (
            <div className="flex items-center justify-between gap-2 text-xs text-slate-500 dark:text-slate-400">
              <span className="truncate">{brandName}</span>
              {discountPct > 0 && (
                <span className="font-bold text-[#B38B2D] dark:text-[#E2BD5B] shrink-0">
                  {t(`خصم ${discountPct}%`, `${discountPct}% off`)}
                </span>
              )}
            </div>
          )}

          <button
            type="button"
            onClick={() => openProduct(product.id)}
            className="text-start font-bold text-sm sm:text-base text-[#11223E] dark:text-slate-100 hover:text-[#B38B2D] dark:hover:text-[#E2BD5B] transition-colors line-clamp-2 leading-snug"
          >
            {title}
          </button>
        </div>

        <div className="flex items-center justify-between gap-3 pt-1">
          <div className="min-w-0">
            <span className="font-mono-num text-base font-extrabold text-[#11223E] dark:text-white tabular-nums block">
              {formatSdg(product.priceSdg)}
            </span>
            {product.oldPriceSdg && product.oldPriceSdg > product.priceSdg && (
              <span className="font-mono-num text-xs text-slate-400 dark:text-slate-500 line-through tabular-nums block">
                {formatSdg(product.oldPriceSdg)}
              </span>
            )}
          </div>

          {isUnavailable ? (
            <span className="text-xs font-semibold text-slate-400">
              {locale === 'ar' ? appTexts.btnOutOfStockAr : appTexts.btnOutOfStockEn}
            </span>
          ) : primaryCartItem ? (
            <div className="min-h-[42px] flex items-center rounded-xl border border-slate-200 dark:border-slate-700 bg-slate-50 dark:bg-slate-900 overflow-hidden shrink-0">
              <button
                type="button"
                onClick={() => updateCartQty(primaryCartItem.id, -1)}
                aria-label={t('إنقاص', 'Decrease')}
                className="min-w-[38px] min-h-[42px] flex items-center justify-center hover:bg-slate-200/60 dark:hover:bg-slate-800"
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
                className="min-w-[38px] min-h-[42px] flex items-center justify-center hover:bg-slate-200/60 dark:hover:bg-slate-800 disabled:opacity-40"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>
            </div>
          ) : (
            <button
              type="button"
              onClick={handleDirectAdd}
              style={{ backgroundColor: appearance.primaryColor }}
              className="min-h-[42px] px-4 rounded-xl text-white text-xs font-bold hover:opacity-90 transition-opacity whitespace-nowrap shrink-0"
            >
              {locale === 'ar' ? appTexts.btnAddToCartAr : appTexts.btnAddToCartEn}
            </button>
          )}
        </div>
      </div>
    </article>
  );
};
