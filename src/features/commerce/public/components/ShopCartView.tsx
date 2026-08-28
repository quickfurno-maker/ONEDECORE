"use client";

import Image from "next/image";
import Link from "next/link";
import { formatInrFromPaise } from "@/features/crm/contracts/sales-target-contracts";
import { buildCommercePublicUrl } from "../public-url.ts";
import { useCommerceCart } from "../../cart/use-commerce-cart.ts";

export function ShopCartView() {
  const { snapshot, hydrated, setQuantity, removeItem } = useCommerceCart();

  if (!hydrated) {
    return <p className="od-shop-note">Loading cart…</p>;
  }

  if (snapshot.items.length === 0) {
    return (
      <div className="od-shop__empty odc-cart__empty">
        <p>Your cart is empty.</p>
        <Link href="/shop" className="od-shop-btn od-shop-btn--ghost">
          Continue Shopping
        </Link>
      </div>
    );
  }

  // Display-only estimate from the prices captured at product view. Shown only
  // when every line carries one, so a partial sum can never look authoritative.
  const everyLinePriced = snapshot.items.every((item) => item.sellingPricePaise != null);
  const estimatePaise = everyLinePriced
    ? snapshot.items.reduce((sum, item) => sum + (item.sellingPricePaise ?? 0) * item.quantity, 0)
    : null;

  return (
    <div className="od-shop-cart odc-cart">
      <ul className="od-shop-cart__list">
        {snapshot.items.map((item) => {
          const imageUrl = buildCommercePublicUrl(item.primaryImagePublicPath ?? null);
          return (
            <li key={item.sku} className="od-shop-cart__item odc-cart__item">
              <div className="od-shop-cart__media odc-cart__media">
                {imageUrl ? (
                  <Image src={imageUrl} alt="" width={88} height={88} />
                ) : (
                  <div className="od-shop-card__fallback">—</div>
                )}
              </div>
              <div className="od-shop-cart__body">
                <p className="od-shop-cart__name">{item.productName ?? item.sku}</p>
                {item.variantDisplayName ? (
                  <p className="od-shop-note">{item.variantDisplayName}</p>
                ) : null}
                {item.sellingPricePaise != null ? (
                  <p className="od-shop-note odc-cart__price">
                    Estimate {formatInrFromPaise(item.sellingPricePaise)} · GST inclusive
                  </p>
                ) : null}
                <div className="od-shop-purchase__qtyControls odc-cart__qty">
                  <button
                    type="button"
                    aria-label={`Decrease quantity for ${item.productName ?? item.sku}`}
                    onClick={() => setQuantity(item.sku, item.quantity - 1)}
                  >
                    −
                  </button>
                  <span aria-live="polite">{item.quantity}</span>
                  <button
                    type="button"
                    aria-label={`Increase quantity for ${item.productName ?? item.sku}`}
                    onClick={() => setQuantity(item.sku, item.quantity + 1)}
                  >
                    +
                  </button>
                  <button
                    type="button"
                    className="odc-cart__remove"
                    aria-label={`Remove ${item.productName ?? item.sku} from cart`}
                    onClick={() => removeItem(item.sku)}
                  >
                    Remove
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      <aside className="odc-cart__summary" aria-label="Order summary">
        {estimatePaise != null ? (
          <p className="odc-cart__summaryRow">
            <span>Estimated subtotal</span>
            <strong>{formatInrFromPaise(estimatePaise)}</strong>
          </p>
        ) : null}
        <p className="od-shop-note">
          Displayed prices are estimates from your last product view. Final price, GST, shipping, and
          COD availability are confirmed at checkout.
        </p>
        <Link href="/shop/checkout" className="od-shop-btn od-shop-btn--gold odc-cart__cta">
          Proceed to Checkout
        </Link>
        <Link href="/shop" className="odc-cart__continue">
          Continue shopping
        </Link>
      </aside>
    </div>
  );
}
