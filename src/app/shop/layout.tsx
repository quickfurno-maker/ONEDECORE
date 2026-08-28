import type { ReactNode } from "react";
import type { Metadata } from "next";
import { PublicDarkShell } from "@/features/public-site/theme/PublicDarkShell";
import { ShopPublicInactive } from "@/features/commerce/public/components/ShopPublicInactive";
import { CommerceLightShell } from "@/features/commerce/public/shell/CommerceLightShell";
import { buildCommerceNavTree, type CommerceNavNode } from "@/features/commerce/public/shell/commerce-nav";
import { getPublicCommerceCategories } from "@/features/commerce/public/public-cache";
import { isPublicCommerceReadFailure } from "@/features/commerce/public/public-errors";
import { isShopPublicEnabled } from "@/features/commerce/server/shop-public-gate";
import "@/features/commerce/public/shop.css";

export const dynamic = "force-dynamic";

export async function generateMetadata(): Promise<Metadata> {
  if (!isShopPublicEnabled()) {
    return {
      title: "Furniture shop — ONEDECORE",
      robots: { index: false, follow: false },
    };
  }
  return {};
}

/** Nav categories for the retail shell. Only reached once the gate is open. */
async function loadNavTree(): Promise<readonly CommerceNavNode[]> {
  try {
    return buildCommerceNavTree(await getPublicCommerceCategories());
  } catch (error) {
    if (isPublicCommerceReadFailure(error)) {
      return [];
    }
    throw error;
  }
}

export default async function ShopLayout({ children }: Readonly<{ children: ReactNode }>) {
  // Fail closed before any catalogue read: the inactive boundary renders on the
  // existing dark shell and no category query is issued while the gate is off.
  if (!isShopPublicEnabled()) {
    return (
      <PublicDarkShell navCurrent="shop">
        <ShopPublicInactive />
      </PublicDarkShell>
    );
  }

  const nodes = await loadNavTree();

  return <CommerceLightShell nodes={nodes}>{children}</CommerceLightShell>;
}
