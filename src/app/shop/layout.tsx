import type { ReactNode } from "react";
import type { Metadata } from "next";
import { PublicDarkShell } from "@/features/public-site/theme/PublicDarkShell";
import { ShopPublicInactive } from "@/features/commerce/public/components/ShopPublicInactive";
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

export default function ShopLayout({ children }: Readonly<{ children: ReactNode }>) {
  if (!isShopPublicEnabled()) {
    return (
      <PublicDarkShell navCurrent="shop">
        <ShopPublicInactive />
      </PublicDarkShell>
    );
  }

  return <PublicDarkShell navCurrent="shop">{children}</PublicDarkShell>;
}
