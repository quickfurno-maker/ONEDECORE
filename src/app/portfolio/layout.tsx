import type { ReactNode } from "react";
import { PublicDarkShell } from "@/features/public-site/theme/PublicDarkShell";

export default function PortfolioLayout({
  children,
}: Readonly<{ children: ReactNode }>) {
  return <PublicDarkShell>{children}</PublicDarkShell>;
}
