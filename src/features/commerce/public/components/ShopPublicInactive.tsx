import Link from "next/link";

export function ShopPublicInactive() {
  return (
    <main className="od-shop">
      <header className="od-shop__hero">
        <p className="od-shop__kicker">Furniture shop</p>
        <h1 className="od-shop__title">Not activated yet</h1>
        <p className="od-shop__lede">
          The public furniture storefront remains gated until the owner enables
          production activation. Interiors consultation is available now.
        </p>
      </header>
      <section className="od-shop__section">
        <p>
          <Link href="/interiors" className="od-shop-btn od-shop-btn--gold">
            Explore interiors
          </Link>{" "}
          <Link href="/portfolio" className="od-shop-btn od-shop-btn--ghost">
            View portfolio
          </Link>
        </p>
      </section>
    </main>
  );
}
