import type { ReactNode } from "react";
import { PublicDarkShell } from "@/features/public-site/theme/PublicDarkShell";
import "@/features/commerce/public/shop.css";

export const dynamic = "force-dynamic";

export default function ShopLayout({ children }: Readonly<{ children: ReactNode }>) {
  return <PublicDarkShell navCurrent="shop">{children}</PublicDarkShell>;
}
