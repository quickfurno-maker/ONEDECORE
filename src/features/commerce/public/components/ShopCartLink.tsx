"use client";

import Link from "next/link";
import { useCommerceCart } from "../../cart/use-commerce-cart.ts";

export function ShopCartLink({ className }: { readonly className?: string }) {
  const { itemCount, hydrated } = useCommerceCart();
  const label = hydrated && itemCount > 0 ? `Cart (${itemCount})` : "Cart";
  return (
    <Link href="/shop/cart" className={className} aria-label={label}>
      Cart{hydrated && itemCount > 0 ? ` (${itemCount})` : ""}
    </Link>
  );
}
