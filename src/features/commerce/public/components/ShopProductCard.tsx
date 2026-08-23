import Image from "next/image";
import Link from "next/link";
import { formatInrFromPaise } from "@/features/crm/contracts/sales-target-contracts";
import { buildCommercePublicUrl } from "../public-url.ts";
import type { PublicCommerceProductCard } from "../public-types.ts";
import { ShopWishlistButton } from "./ShopWishlistButton.tsx";

function availabilityLabel(card: PublicCommerceProductCard): string {
  if (!card.isAvailable) return "Currently unavailable";
  if (card.availabilityMode === "made_to_order") return "Made to order";
  if (card.availabilityMode === "ready_stock") return "Ready stock";
  if (card.availabilityMode === "mixed") return "Ready stock and made to order";
  return "Available";
}

export function ShopProductCard({
  card,
  showWishlist = true,
}: {
  readonly card: PublicCommerceProductCard;
  readonly showWishlist?: boolean;
}) {
  const imageUrl = buildCommercePublicUrl(card.primaryImagePath);

  return (
    <article className="od-shop-card">
      <Link href={`/shop/product/${card.slug}`} className="od-shop-card">
        <div className="od-shop-card__media">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={card.primaryImageAlt || card.name}
              fill
              sizes="(max-width: 720px) 50vw, (max-width: 1100px) 33vw, 25vw"
            />
          ) : (
            <div className="od-shop-card__fallback">Image being prepared</div>
          )}
        </div>
        <div className="od-shop-card__body">
          <div className="od-shop-card__cat">{card.categoryName}</div>
          <h3>{card.name}</h3>
          <div className="od-shop-card__price">
            <strong>{formatInrFromPaise(card.startingPricePaise)}</strong>
            {card.compareAtPricePaise ? (
              <span className="od-shop-card__compare">
                {formatInrFromPaise(card.compareAtPricePaise)}
              </span>
            ) : null}
          </div>
          <p className="od-shop-card__meta">
            {availabilityLabel(card)}
            {card.variantCount > 1 ? ` · ${card.variantCount} variants` : ""}
          </p>
          <span className="od-shop-card__cta">View Product</span>
        </div>
      </Link>
      {showWishlist ? (
        <ShopWishlistButton
          slug={card.slug}
          name={card.name}
          imagePath={card.primaryImagePath}
        />
      ) : null}
    </article>
  );
}
