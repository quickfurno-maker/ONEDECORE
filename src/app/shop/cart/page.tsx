import type { Metadata } from "next";
import Link from "next/link";
import { SITE_CONFIG } from "@/config/site";
import { ShopCartView } from "@/features/commerce/public/components/ShopCartView";

export const metadata: Metadata = {
  title: `Cart — ${SITE_CONFIG.name}`,
  robots: { index: false, follow: false },
};

export default function ShopCartPage() {
  return (
    <main className="od-shop">
      <header className="od-shop__hero">
        <p className="od-shop__kicker">Your cart</p>
        <h1 className="od-shop__title">Furniture cart</h1>
        <p className="od-shop__lede">
          Prices shown are estimates from your last product view. Final GST, shipping, and COD
          availability are confirmed at checkout.
        </p>
      </header>
      <section className="od-shop__section">
        <ShopCartView />
        <p className="od-shop-note">
          <Link href="/shop/track">Track an existing order</Link>
        </p>
      </section>
    </main>
  );
}
