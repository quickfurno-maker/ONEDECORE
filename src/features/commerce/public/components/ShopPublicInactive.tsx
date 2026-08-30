import Link from "next/link";

export function ShopPublicInactive() {
  return (
    <main className="od-shop">
      <header className="od-shop__hero">
        <p className="od-shop__kicker">Furniture shop</p>
        <h1 className="od-shop__title">Coming soon</h1>
        <p className="od-shop__lede">
          Our ready-made furniture collection is not open for browsing yet.
          Complete home interiors, modular kitchens and custom wardrobes are
          available now — start with a free design consultation.
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
