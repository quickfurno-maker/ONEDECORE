"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const LINKS = [
  { href: "/admin/commerce", label: "Overview" },
  { href: "/admin/commerce/categories", label: "Categories" },
  { href: "/admin/commerce/products", label: "Products" },
  { href: "/admin/commerce/settings", label: "Settings" },
] as const;

function isCurrent(pathname: string, href: string): boolean {
  if (href === "/admin/commerce") {
    return pathname === "/admin/commerce";
  }
  return pathname === href || pathname.startsWith(`${href}/`);
}

export function CommerceAdminLinks() {
  const pathname = usePathname();

  return (
    <nav aria-label="Commerce" className="flex flex-wrap gap-1 border-b border-[var(--od-border)]">
      {LINKS.map((link) => {
        const current = isCurrent(pathname, link.href);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={current ? "page" : undefined}
            className={`relative inline-flex min-h-10 items-center px-3 text-xs font-medium outline-none transition duration-150 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--od-gold)] ${
              current
                ? "text-[var(--od-gold)]"
                : "text-[var(--od-muted)] hover:text-[var(--od-text)]"
            }`}
          >
            {link.label}
            {current ? (
              <span className="absolute inset-x-3 -bottom-px h-0.5 rounded-full bg-[var(--od-gold)]" />
            ) : null}
          </Link>
        );
      })}
    </nav>
  );
}
