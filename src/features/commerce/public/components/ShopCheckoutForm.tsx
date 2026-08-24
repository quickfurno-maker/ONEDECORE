"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useSearchParams } from "next/navigation";
import { formatInrFromPaise } from "@/features/crm/contracts/sales-target-contracts";
import {
  placeCodOrder,
  reviewCheckoutQuote,
  type CheckoutQuoteState,
  type PlaceCodOrderState,
} from "../../server/checkout-actions.ts";
import { commerceCartCanonicalLines, readCommerceCartFromStorage } from "../../cart/cart-storage.ts";
import { clearBuyNowSession, readBuyNowFromSession } from "../../cart/buy-now-storage.ts";
import { useCommerceCart } from "../../cart/use-commerce-cart.ts";

const INITIAL_QUOTE: CheckoutQuoteState = { status: "idle" };
const INITIAL_PLACE: PlaceCodOrderState = { status: "idle" };

export function ShopCheckoutForm() {
  const searchParams = useSearchParams();
  const mode = searchParams.get("mode") === "buy-now" ? "buy-now" : "cart";
  const { clearCart, hydrated: cartHydrated } = useCommerceCart();
  const [quoteState, setQuoteState] = useState<CheckoutQuoteState>(INITIAL_QUOTE);
  const [placeState, setPlaceState] = useState<PlaceCodOrderState>(INITIAL_PLACE);
  const [pincode, setPincode] = useState("");
  const [sameAsCustomer, setSameAsCustomer] = useState(true);
  const [pending, setPending] = useState(false);
  const idempotencyRef = useRef<string>(crypto.randomUUID());

  const lines = useMemo(() => {
    if (!cartHydrated) return [];
    if (mode === "buy-now") {
      return readBuyNowFromSession(window.sessionStorage).items.map((row) => ({
        sku: row.sku,
        quantity: row.quantity,
      }));
    }
    return commerceCartCanonicalLines(readCommerceCartFromStorage(window.localStorage));
  }, [mode, cartHydrated]);

  const linesJson = JSON.stringify(lines);

  async function onReview(formData: FormData) {
    setPending(true);
    formData.set("lines", linesJson);
    const next = await reviewCheckoutQuote(quoteState, formData);
    setQuoteState(next);
    setPending(false);
  }

  async function onPlace(formData: FormData) {
    if (quoteState.status !== "ok") return;
    setPending(true);
    if (sameAsCustomer) {
      formData.set("recipientName", String(formData.get("customerName") ?? "").trim());
      formData.set("deliveryMobile", String(formData.get("customerMobile") ?? "").trim());
    }
    formData.set("lines", linesJson);
    formData.set("reviewToken", quoteState.reviewToken);
    formData.set("idempotencyKey", idempotencyRef.current);
    formData.set("checkoutMode", mode);
    const next = await placeCodOrder(placeState, formData);
    if (next.status === "price_changed") {
      setQuoteState({
        status: "ok",
        quote: next.quote,
        reviewToken: next.reviewToken,
        reviewExpiresAt: Date.now() + 5 * 60 * 1000,
      });
      setPlaceState({ status: "error", message: next.message, code: "PRICE_OR_AVAILABILITY_CHANGED" });
      setPending(false);
      return;
    }
    if (next.status === "ok") {
      if (next.checkoutMode === "buy-now") {
        clearBuyNowSession(window.sessionStorage);
      } else {
        clearCart();
      }
      idempotencyRef.current = crypto.randomUUID();
    }
    setPlaceState(next);
    setPending(false);
  }

  useEffect(() => {
    idempotencyRef.current = crypto.randomUUID();
  }, [linesJson, pincode]);

  if (!cartHydrated && mode === "cart") {
    return <p className="od-shop-note">Loading checkout…</p>;
  }

  if (lines.length === 0) {
    return (
      <div className="od-shop__empty">
        <p>No items to checkout.</p>
        <a href="/shop" className="od-shop-btn od-shop-btn--ghost">
          Continue Shopping
        </a>
      </div>
    );
  }

  return (
    <div className="od-shop-checkout">
      <p className="od-shop-note">
        {mode === "buy-now" ? "Buy Now checkout (one item)." : "Cart checkout."} Cash on delivery only.
      </p>
      <form action={onReview} className="od-shop-form">
        <fieldset>
          <legend>Delivery pincode</legend>
          <label htmlFor="pincode">Pincode</label>
          <input
            id="pincode"
            name="pincode"
            inputMode="numeric"
            pattern="[0-9]{6}"
            maxLength={6}
            required
            value={pincode}
            onChange={(event) => setPincode(event.target.value.replace(/\D/g, "").slice(0, 6))}
          />
        </fieldset>
        <button type="submit" className="od-shop-btn od-shop-btn--ghost" disabled={pending}>
          Review order total
        </button>
      </form>

      {quoteState.status === "error" ? (
        <p className="od-shop__error" role="alert">
          {quoteState.message}
        </p>
      ) : null}

      {quoteState.status === "ok" ? (
        <section aria-live="polite" className="od-shop-checkout__review">
          <h2>Order review</h2>
          <ul>
            {quoteState.quote.lines.map((line) => (
              <li key={line.sku}>
                {line.productName} × {line.quantity} — {formatInrFromPaise(line.lineTotalPaise)}
              </li>
            ))}
          </ul>
          <p>
            Shipping {formatInrFromPaise(quoteState.quote.shippingPaise)} · Tax (included){" "}
            {formatInrFromPaise(quoteState.quote.taxPaise)}
          </p>
          <p>
            <strong>Total {formatInrFromPaise(quoteState.quote.totalPaise)}</strong>
          </p>
          <p className="od-shop-note">
            ETA {quoteState.quote.etaMinDays}–{quoteState.quote.etaMaxDays} days
            {quoteState.quote.assemblyInstallNote
              ? ` · ${quoteState.quote.assemblyInstallNote}`
              : ""}
          </p>
        </section>
      ) : null}

      <form action={onPlace} className="od-shop-form">
        <input type="hidden" name="pincode" value={pincode} />
        <fieldset>
          <legend>Customer</legend>
          <label htmlFor="customerName">Name</label>
          <input id="customerName" name="customerName" required maxLength={120} />
          <label htmlFor="customerMobile">Mobile</label>
          <input id="customerMobile" name="customerMobile" required inputMode="tel" maxLength={20} />
          <label htmlFor="customerEmail">Email (optional)</label>
          <input id="customerEmail" name="customerEmail" type="email" maxLength={120} />
        </fieldset>
        <label>
          <input
            type="checkbox"
            checked={sameAsCustomer}
            onChange={(event) => setSameAsCustomer(event.target.checked)}
          />
          Delivery contact same as customer
        </label>
        <fieldset>
          <legend>Delivery</legend>
          <label htmlFor="recipientName">Recipient name</label>
          <input
            id="recipientName"
            name="recipientName"
            required
            maxLength={120}
            disabled={sameAsCustomer}
          />
          <label htmlFor="deliveryMobile">Mobile</label>
          <input
            id="deliveryMobile"
            name="deliveryMobile"
            required
            inputMode="tel"
            maxLength={20}
            disabled={sameAsCustomer}
          />
          <label htmlFor="addressLine1">Address line 1</label>
          <input id="addressLine1" name="addressLine1" required maxLength={160} />
          <label htmlFor="addressLine2">Address line 2 (optional)</label>
          <input id="addressLine2" name="addressLine2" maxLength={160} />
          <label htmlFor="locality">Locality</label>
          <input id="locality" name="locality" required maxLength={120} />
          <label htmlFor="city">City</label>
          <input id="city" name="city" required maxLength={80} />
          <label htmlFor="state">State</label>
          <input id="state" name="state" required maxLength={80} />
        </fieldset>
        <button
          type="submit"
          className="od-shop-btn od-shop-btn--gold"
          disabled={pending || quoteState.status !== "ok"}
          aria-busy={pending}
        >
          Place COD order
        </button>
      </form>

      {placeState.status === "error" || placeState.status === "invalid" ? (
        <p className="od-shop__error" role="alert">
          {"message" in placeState ? placeState.message : "Please check your details."}
        </p>
      ) : null}

      {placeState.status === "ok" ? (
        <div className="od-shop-checkout__success" role="status" aria-live="polite">
          <p>
            Order <strong>{placeState.orderReference}</strong> confirmed ·{" "}
            {formatInrFromPaise(placeState.totalPaise)} COD
          </p>
          <a
            href={`/shop/track?order=${encodeURIComponent(placeState.orderReference)}`}
            className="od-shop-btn od-shop-btn--ghost"
          >
            Track order
          </a>
        </div>
      ) : null}
    </div>
  );
}
