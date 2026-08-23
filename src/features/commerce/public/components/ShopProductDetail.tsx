"use client";

import Image from "next/image";
import { useMemo, useState } from "react";
import { formatInrFromPaise } from "@/features/crm/contracts/sales-target-contracts";
import { COMMERCE_OPTION_KEYS } from "../../domain/option-values.ts";
import { buildCommercePublicUrl } from "../public-url.ts";
import type { PublicCommerceProductDetail, PublicCommerceVariant } from "../public-types.ts";
import { ShopPincodeChecker } from "./ShopPincodeChecker.tsx";
import { ShopRecentlyViewedRecorder, ShopWishlistButton } from "./ShopWishlistButton.tsx";
import { ShopProductCard } from "./ShopProductCard.tsx";

function matches(
  variant: PublicCommerceVariant,
  selected: Readonly<Record<string, string>>
): boolean {
  return Object.entries(selected).every(([key, value]) => variant.optionValues[key] === value);
}

function optionChoices(product: PublicCommerceProductDetail): readonly string[] {
  const present = new Set<string>();
  for (const variant of product.variants) {
    for (const key of Object.keys(variant.optionValues)) {
      present.add(key);
    }
  }
  return COMMERCE_OPTION_KEYS.filter((key) => present.has(key));
}

function valuesFor(
  product: PublicCommerceProductDetail,
  key: string,
  selected: Readonly<Record<string, string>>
): string[] {
  const others = { ...selected };
  delete others[key];
  const values = new Set<string>();
  for (const variant of product.variants) {
    if (!matches(variant, others)) continue;
    const value = variant.optionValues[key];
    if (value) values.add(value);
  }
  return [...values];
}

export function ShopProductDetail({ product }: { readonly product: PublicCommerceProductDetail }) {
  const keys = optionChoices(product);
  const [selected, setSelected] = useState<Record<string, string>>(() => ({
    ...product.variants[0]?.optionValues,
  }));
  const [activePath, setActivePath] = useState(product.media[0]?.publicPath ?? null);

  const variant = useMemo(() => {
    return (
      product.variants.find((row) => matches(row, selected)) ??
      product.variants[0] ??
      null
    );
  }, [product.variants, selected]);

  const media = product.media;
  const activeUrl = buildCommercePublicUrl(activePath);
  const activeAlt =
    media.find((row) => row.publicPath === activePath)?.altText || product.name;

  if (!variant) {
    return <p className="od-shop__empty">This product has no public variants.</p>;
  }

  return (
    <div className="od-shop-pdp">
      <ShopRecentlyViewedRecorder
        slug={product.slug}
        name={product.name}
        imagePath={product.media[0]?.publicPath ?? null}
      />
      <div className="od-shop-gallery">
        <div className="od-shop-gallery__main">
          {activeUrl ? (
            <Image src={activeUrl} alt={activeAlt} fill sizes="(max-width: 720px) 100vw, 50vw" />
          ) : (
            <div className="od-shop-card__fallback">Image being prepared</div>
          )}
        </div>
        {media.length > 1 ? (
          <div className="od-shop-gallery__strip">
            {media.map((row) => {
              const url = buildCommercePublicUrl(row.publicPath);
              return (
                <button
                  key={row.publicPath}
                  type="button"
                  aria-label={row.altText || "Show image"}
                  aria-pressed={row.publicPath === activePath}
                  onClick={() => setActivePath(row.publicPath)}
                >
                  {url ? (
                    <Image src={url} alt="" width={72} height={72} />
                  ) : (
                    "—"
                  )}
                </button>
              );
            })}
          </div>
        ) : null}
      </div>

      <div>
        <p className="od-shop__kicker">{product.category.name}</p>
        <h1 className="od-shop__title">{product.name}</h1>
        <p>
          <strong>{formatInrFromPaise(variant.sellingPricePaise)}</strong>
          {variant.compareAtPricePaise ? (
            <>
              {" "}
              <span className="od-shop-card__compare">
                {formatInrFromPaise(variant.compareAtPricePaise)}
              </span>
            </>
          ) : null}
          <span className="od-shop-note"> · GST inclusive</span>
        </p>
        <p className="od-shop-note">
          {variant.isAvailable ? "Available" : "Currently unavailable"} ·{" "}
          {variant.availabilityMode === "made_to_order" ? "Made to order" : "Ready stock"}
        </p>
        {product.shortDescription ? <p>{product.shortDescription}</p> : null}

        <div className="od-shop-pdp__options">
          {keys.map((key) => (
            <fieldset key={key}>
              <legend>{key}</legend>
              <div className="od-shop-pdp__chips">
                {valuesFor(product, key, selected).map((value) => (
                  <button
                    key={value}
                    type="button"
                    aria-pressed={selected[key] === value}
                    onClick={() => setSelected((prev) => ({ ...prev, [key]: value }))}
                  >
                    {value}
                  </button>
                ))}
              </div>
            </fieldset>
          ))}
        </div>

        <p className="od-shop-note">Ordering will be enabled at launch.</p>
        <ShopWishlistButton
          slug={product.slug}
          name={product.name}
          imagePath={product.media[0]?.publicPath ?? null}
        />

        {product.fullDescription ? (
          <section>
            <h2>Details</h2>
            <p>{product.fullDescription}</p>
          </section>
        ) : null}

        {product.specifications.length > 0 ? (
          <section>
            <h2>Specifications</h2>
            <table className="od-shop-specs">
              <tbody>
                {product.specifications.map((row) => (
                  <tr key={row.key}>
                    <th scope="row">{row.key}</th>
                    <td>{row.value}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </section>
        ) : null}

        {product.hsnSacCode ? <p className="od-shop-note">HSN {product.hsnSacCode}</p> : null}

        <section>
          <h2>Pincode</h2>
          <ShopPincodeChecker />
        </section>
      </div>

      {product.related.length > 0 ? (
        <section className="od-shop__section" style={{ gridColumn: "1 / -1" }}>
          <h2>Related furniture</h2>
          <div className="od-shop__grid">
            {product.related.map((card) => (
              <ShopProductCard key={card.slug} card={card} />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
