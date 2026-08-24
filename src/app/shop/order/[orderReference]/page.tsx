import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { SITE_CONFIG } from "@/config/site";
import { getPublicCommerceOrderTrackingSnapshot } from "@/features/commerce/orders/order-queries.ts";
import { readCommerceTrackProofForReference } from "@/features/commerce/server/commerce-track-cookie.ts";
import { ShopOrderSnapshotView } from "@/features/commerce/public/components/ShopOrderSnapshotView";

interface PageProps {
  readonly params: Promise<{ orderReference: string }>;
}

function normalizeOrderReference(value: string): string | null {
  const trimmed = decodeURIComponent(value).trim().toUpperCase();
  if (!/^OD-O-[0-9]{4}-[0-9]{6}$/.test(trimmed)) return null;
  return trimmed;
}

export async function generateMetadata({ params }: PageProps): Promise<Metadata> {
  const { orderReference } = await params;
  const normalized = normalizeOrderReference(orderReference);
  return {
    title: normalized ? `Order ${normalized} — ${SITE_CONFIG.name}` : `Order — ${SITE_CONFIG.name}`,
    robots: { index: false, follow: false },
  };
}

export default async function ShopOrderPage({ params }: PageProps) {
  const { orderReference } = await params;
  const normalized = normalizeOrderReference(orderReference);
  if (!normalized) {
    redirect("/shop/track");
  }
  const hasProof = await readCommerceTrackProofForReference(normalized);
  if (!hasProof) {
    redirect(`/shop/track?order=${encodeURIComponent(normalized)}`);
  }
  const snapshot = await getPublicCommerceOrderTrackingSnapshot({ orderReference: normalized });
  return (
    <main className="od-shop">
      <section className="od-shop__section od-shop__section--narrow">
        <ShopOrderSnapshotView snapshot={snapshot} />
      </section>
    </main>
  );
}
