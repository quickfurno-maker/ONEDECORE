import Link from "next/link";
import { SITE_CONFIG } from "@/config/site";
import { cn } from "../../utils/cn";

export interface HeaderBrandProps {
  className?: string;
  onDarkSurface?: boolean;
}

export function HeaderBrand({ className, onDarkSurface = false }: HeaderBrandProps) {
  return (
    <Link
      href="/"
      className={cn("ps-header-brand", onDarkSurface && "ps-header-brand--on-dark", className)}
    >
      <span className="ps-header-brand__wordmark">{SITE_CONFIG.name}</span>
    </Link>
  );
}
