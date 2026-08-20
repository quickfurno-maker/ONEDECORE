import Link from "next/link";

const linkClass =
  "inline-flex min-h-10 items-center text-xs font-medium text-[var(--od-gold)] hover:text-[var(--od-text)]";

export function CommerceAdminLinks() {
  return (
    <nav aria-label="Commerce" className="flex flex-wrap gap-4">
      <Link href="/admin/commerce" className={linkClass}>
        Overview
      </Link>
      <Link href="/admin/commerce/categories" className={linkClass}>
        Categories
      </Link>
      <Link href="/admin/commerce/products" className={linkClass}>
        Products
      </Link>
      <Link href="/admin/commerce/settings" className={linkClass}>
        Settings
      </Link>
    </nav>
  );
}
