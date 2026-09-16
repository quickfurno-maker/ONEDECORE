"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const links = [
  { href: "/vendor", label: "Dashboard" },
  { href: "/vendor/products", label: "My Products" },
  { href: "/vendor/stock", label: "Stock" },
  { href: "/vendor/products/new", label: "Add Product" },
] as const;

export function VendorNav() {
  const pathname = usePathname();
  return (
    <nav className="space-y-1" aria-label="Vendor navigation">
      {links.map((link) => {
        const active = link.href === "/vendor"
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link key={link.href} href={link.href} aria-current={active ? "page" : undefined}
            className={`flex min-h-11 items-center rounded-lg px-3 text-sm transition ${active ? "bg-[var(--od-hover)] font-medium text-[var(--od-gold)]" : "text-[var(--od-text-2)] hover:bg-[var(--od-hover)] hover:text-[var(--od-text)]"}`}>
            {link.label}
          </Link>
        );
      })}
    </nav>
  );
}
