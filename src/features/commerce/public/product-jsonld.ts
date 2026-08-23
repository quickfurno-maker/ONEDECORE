import { SITE_CONFIG, absoluteUrl } from "../../../config/site.ts";
import { buildCommercePublicUrl } from "./public-url.ts";
import type { PublicCommerceProductDetail, PublicCommerceVariant } from "./public-types.ts";

function availabilityUrl(isAvailable: boolean): string {
  return isAvailable
    ? "https://schema.org/InStock"
    : "https://schema.org/OutOfStock";
}

export function buildProductJsonLd(
  product: PublicCommerceProductDetail,
  variant: PublicCommerceVariant
): Record<string, unknown> {
  const image = product.media
    .map((row) => buildCommercePublicUrl(row.publicPath))
    .filter((url): url is string => url != null);

  return {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    description: product.seoDescription ?? product.shortDescription ?? product.name,
    sku: variant.sku,
    url: absoluteUrl(`shop/product/${product.slug}`),
    image,
    brand: { "@type": "Brand", name: SITE_CONFIG.name },
    offers: {
      "@type": "Offer",
      priceCurrency: "INR",
      price: (variant.sellingPricePaise / 100).toFixed(2),
      availability: availabilityUrl(variant.isAvailable),
      url: absoluteUrl(`shop/product/${product.slug}`),
    },
  };
}

export function buildBreadcrumbJsonLd(product: PublicCommerceProductDetail): Record<string, unknown> {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: [
      { "@type": "ListItem", position: 1, name: "Shop", item: absoluteUrl("shop") },
      {
        "@type": "ListItem",
        position: 2,
        name: product.category.name,
        item: absoluteUrl(`shop/c/${product.category.slug}`),
      },
      {
        "@type": "ListItem",
        position: 3,
        name: product.name,
        item: absoluteUrl(`shop/product/${product.slug}`),
      },
    ],
  };
}
