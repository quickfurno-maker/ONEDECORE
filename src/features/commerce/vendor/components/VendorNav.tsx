"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { VendorIcon, type VendorIconName } from "./VendorIcon";

const links: readonly { href: string; label: string; icon: VendorIconName }[] = [
  { href: "/vendor", label: "Dashboard", icon: "dashboard" },
  { href: "/vendor/products", label: "My Products", icon: "products" },
  { href: "/vendor/products/new", label: "Add Product", icon: "add" },
  { href: "/vendor/stock", label: "Stock & Availability", icon: "stock" },
  { href: "/vendor/orders", label: "Orders", icon: "orders" },
];

export function VendorNav() {
  const pathname = usePathname();
  return (
    <nav className="flex gap-2 overflow-x-auto pb-1 lg:block lg:space-y-1.5 lg:overflow-visible lg:pb-0" aria-label="Vendor navigation">
      {links.map((link) => {
        const active = link.href === "/vendor"
          ? pathname === link.href
          : pathname === link.href || pathname.startsWith(`${link.href}/`);
        return (
          <Link
            key={link.href}
            href={link.href}
            aria-current={active ? "page" : undefined}
            className={`flex min-h-11 shrink-0 items-center gap-3 rounded-xl px-3.5 text-sm font-medium transition lg:w-full ${
              active
                ? "bg-[#eee4da] text-[#27382d] shadow-[inset_0_0_0_1px_rgba(181,111,60,.08)]"
                : "text-[var(--od-text-2)] hover:bg-[#f3ede6] hover:text-[var(--od-text)]"
            }`}
          >
            <VendorIcon name={link.icon} className="h-[19px] w-[19px] shrink-0" />
            <span>{link.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}
