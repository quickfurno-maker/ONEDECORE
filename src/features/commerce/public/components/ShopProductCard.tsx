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

/**
 * Badge text is derived only from catalogue fields. Nothing here implies a
 * discount, rating, stock count or deadline that the data does not carry.
 */
function badgeLabel(card: PublicCommerceProductCard): string | null {
  if (!card.isAvailable) return "Unavailable";
  if (card.featured) return "Featured";
  if (card.availabilityMode === "made_to_order") return "Made to order";
  return null;
}

export function ShopProductCard({
  card,
  showWishlist = true,
}: {
  readonly card: PublicCommerceProductCard;
  readonly showWishlist?: boolean;
}) {
  const imageUrl = buildCommercePublicUrl(card.primaryImagePath);
  const badge = badgeLabel(card);
  // The parser drops compare-at values that are not above the selling price,
  // so a surviving value is a genuine saving.
  const hasCompareAt =
    card.compareAtPricePaise != null && card.compareAtPricePaise > card.startingPricePaise;

  return (
    <article className="od-shop-card odc-product">
      <Link href={`/shop/product/${card.slug}`} className="odc-product__link">
        <div className="od-shop-card__media odc-product__media">
          {imageUrl ? (
            <Image
              src={imageUrl}
              alt={card.primaryImageAlt || card.name}
              fill
              sizes="(max-width: 560px) 50vw, (max-width: 1100px) 33vw, 25vw"
            />
          ) : (
            <div className="od-shop-card__fallback">Image being prepared</div>
          )}
          {badge ? <span className="odc-product__badge">{badge}</span> : null}
        </div>

        <div className="od-shop-card__body odc-product__body">
          <p className="od-shop-card__cat odc-product__cat">{card.categoryName}</p>
          <h3 className="odc-product__name">{card.name}</h3>
          {card.shortDescription ? (
            <p className="odc-product__desc">{card.shortDescription}</p>
          ) : null}

          <p className="od-shop-card__price odc-product__price">
            <strong>{formatInrFromPaise(card.startingPricePaise)}</strong>
            {hasCompareAt ? (
              <span className="od-shop-card__compare">
                {formatInrFromPaise(card.compareAtPricePaise!)}
              </span>
            ) : null}
            <span className="odc-product__gst">GST incl.</span>
          </p>

          <p className="od-shop-card__meta odc-product__meta">
            {availabilityLabel(card)}
            {card.variantCount > 1 ? ` · ${card.variantCount} options` : ""}
          </p>

          <span className="od-shop-card__cta odc-product__cta">
            View Product<span aria-hidden="true"> →</span>
          </span>
        </div>
      </Link>

      {showWishlist ? (
        <div className="odc-product__save">
          <ShopWishlistButton
            slug={card.slug}
            name={card.name}
            imagePath={card.primaryImagePath}
          />
        </div>
      ) : null}
    </article>
  );
}
