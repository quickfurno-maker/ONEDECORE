import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { SITE_CONFIG, absoluteUrl } from "@/config/site";
import { ShopProductDetail } from "@/features/commerce/public/components/ShopProductDetail";
import { isPublicCommerceReadFailure } from "@/features/commerce/public/public-errors";
import { getPublicCommerceProduct } from "@/features/commerce/public/public-cache";
import { buildBreadcrumbJsonLd, buildProductJsonLd } from "@/features/commerce/public/product-jsonld";
import type { PublicCommerceProductDetail } from "@/features/commerce/public/public-types";
import { serializeJsonLd, shopOpenGraph } from "@/features/commerce/public/shop-seo";
import { buildCommercePublicUrl } from "@/features/commerce/public/public-url";

interface PageProps {
  params: Promise<{ slug: string }>;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { slug } = await params;
  try {
    const product = await getPublicCommerceProduct(slug);
    if (!product) {
      return { title: `Furniture — ${SITE_CONFIG.name}`, robots: { index: false, follow: true } };
    }
    const title = product.seoTitle ?? `${product.name} — ${SITE_CONFIG.name}`;
    const description =
      product.seoDescription ?? product.shortDescription ?? `View ${product.name} at ONEDECORE.`;
    const url = absoluteUrl(`shop/product/${product.slug}`);
    return {
      title,
      description,
      alternates: { canonical: url },
      robots: { index: true, follow: true },
      openGraph: shopOpenGraph({
        title,
        description,
        url,
        imageUrl: buildCommercePublicUrl(product.media[0]?.publicPath ?? null),
      }),
    };
  } catch {
    return { title: `Furniture — ${SITE_CONFIG.name}`, robots: { index: false, follow: true } };
  }
}

export default async function ShopProductPage({ params }: PageProps) {
  const { slug } = await params;
  let product: PublicCommerceProductDetail | null;
  try {
    product = await getPublicCommerceProduct(slug);
  } catch (error) {
    if (isPublicCommerceReadFailure(error)) {
      return (
        <main className="od-shop">
          <div className="od-shop__error" role="alert">
            This product could not be loaded right now.
          </div>
        </main>
      );
    }
    throw error;
  }

  if (!product) {
    notFound();
  }

  const variant = product.variants[0];
  return (
    <main className="od-shop">
      <p className="od-shop__kicker">
        <Link href="/shop">Shop</Link>
        {" / "}
        <Link href={`/shop/c/${product.category.slug}`}>{product.category.name}</Link>
      </p>
      {variant ? (
        <>
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{ __html: serializeJsonLd(buildProductJsonLd(product, variant)) }}
          />
          <script
            type="application/ld+json"
            dangerouslySetInnerHTML={{
              __html: serializeJsonLd(buildBreadcrumbJsonLd(product)),
            }}
          />
        </>
      ) : null}
      <ShopProductDetail product={product} />
    </main>
  );
}
