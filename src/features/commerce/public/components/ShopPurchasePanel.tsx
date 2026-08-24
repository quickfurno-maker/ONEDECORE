"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { formatInrFromPaise } from "@/features/crm/contracts/sales-target-contracts";
import type { CommerceCartItem } from "../../cart/cart-types.ts";
import { writeBuyNowToSession } from "../../cart/buy-now-storage.ts";
import { useCommerceCart } from "../../cart/use-commerce-cart.ts";
import type { PublicCommerceProductDetail, PublicCommerceVariant } from "../public-types.ts";

export function ShopPurchasePanel({
  product,
  variant,
}: {
  readonly product: PublicCommerceProductDetail;
  readonly variant: PublicCommerceVariant;
}) {
  const router = useRouter();
  const { addItem } = useCommerceCart();
  const [quantity, setQuantity] = useState(1);
  const [message, setMessage] = useState<string | null>(null);

  const cartItem = (): CommerceCartItem => ({
    sku: variant.sku,
    quantity,
    productSlug: product.slug,
    productName: product.name,
    variantDisplayName: variant.displayName,
    optionValues: { ...variant.optionValues },
    primaryImagePublicPath: product.media[0]?.publicPath ?? null,
    sellingPricePaise: variant.sellingPricePaise,
    compareAtPricePaise: variant.compareAtPricePaise,
    availabilityMode: variant.availabilityMode,
  });

  const onAddToCart = () => {
    if (!variant.isAvailable) {
      setMessage("This variant is currently unavailable.");
      return;
    }
    addItem(cartItem());
    setMessage("Added to cart.");
  };

  const onBuyNow = () => {
    if (!variant.isAvailable) {
      setMessage("This variant is currently unavailable.");
      return;
    }
    writeBuyNowToSession(window.sessionStorage, cartItem());
    router.push("/shop/checkout?mode=buy-now");
  };

  return (
    <div className="od-shop-purchase">
      <p className="od-shop-note">
        SKU <span className="od-shop-purchase__sku">{variant.sku}</span>
      </p>
      <div className="od-shop-purchase__qty">
        <label htmlFor={`qty-${variant.sku}`}>Quantity</label>
        <div className="od-shop-purchase__qtyControls">
          <button
            type="button"
            aria-label="Decrease quantity"
            onClick={() => setQuantity((value) => Math.max(1, value - 1))}
          >
            −
          </button>
          <input
            id={`qty-${variant.sku}`}
            type="number"
            min={1}
            max={20}
            value={quantity}
            onChange={(event) => {
              const next = Number(event.target.value);
              if (Number.isInteger(next)) setQuantity(Math.min(20, Math.max(1, next)));
            }}
          />
          <button
            type="button"
            aria-label="Increase quantity"
            onClick={() => setQuantity((value) => Math.min(20, value + 1))}
          >
            +
          </button>
        </div>
      </div>
      <div className="od-shop-purchase__actions">
        <button type="button" className="od-shop-btn od-shop-btn--ghost" onClick={onAddToCart}>
          Add to Cart
        </button>
        <button type="button" className="od-shop-btn od-shop-btn--gold" onClick={onBuyNow}>
          Buy Now
        </button>
      </div>
      <p className="od-shop-note">
        {formatInrFromPaise(variant.sellingPricePaise)} per unit · GST inclusive · final shipping
        confirmed at checkout
      </p>
      {message ? (
        <p className="od-shop-purchase__status" role="status" aria-live="polite">
          {message}
        </p>
      ) : null}
    </div>
  );
}
