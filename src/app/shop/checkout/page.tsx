import type { Metadata } from "next";
import { Suspense } from "react";
import { SITE_CONFIG } from "@/config/site";
import { ShopCheckoutForm } from "@/features/commerce/public/components/ShopCheckoutForm";

export const metadata: Metadata = {
  title: `Checkout — ${SITE_CONFIG.name}`,
  robots: { index: false, follow: false },
};

export default function ShopCheckoutPage() {
  return (
    <main className="od-shop">
      <header className="od-shop__hero">
        <p className="od-shop__kicker">Guest checkout</p>
        <h1 className="od-shop__title">Cash on delivery</h1>
        <p className="od-shop__lede">
          No account required. Order totals are confirmed on the server before you place your COD
          order.
        </p>
      </header>
      <section className="od-shop__section">
        <Suspense fallback={<p className="od-shop-note">Loading checkout…</p>}>
          <ShopCheckoutForm />
        </Suspense>
      </section>
    </main>
  );
}
