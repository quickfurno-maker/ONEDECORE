import type { Metadata } from "next";
import { Suspense } from "react";
import { SITE_CONFIG } from "@/config/site";
import { ShopTrackForm } from "@/features/commerce/public/components/ShopTrackForm";

export const metadata: Metadata = {
  title: `Track order — ${SITE_CONFIG.name}`,
  robots: { index: false, follow: false },
};

export default function ShopTrackPage() {
  return (
    <main className="od-shop">
      <header className="od-shop__hero">
        <p className="od-shop__kicker">Order tracking</p>
        <h1 className="od-shop__title">Verify your order</h1>
        <p className="od-shop__lede">
          Enter your order reference and mobile number. We use the same details you provided at
          checkout.
        </p>
      </header>
      <section className="od-shop__section od-shop__section--narrow">
        <Suspense fallback={<p className="od-shop-note">Loading…</p>}>
          <ShopTrackForm />
        </Suspense>
      </section>
    </main>
  );
}
