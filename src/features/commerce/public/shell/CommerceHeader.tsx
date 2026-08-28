import Link from "next/link";
import { OneDecoreWordmark } from "@/features/public-site/home-r4/OneDecoreWordmark";
import { ShopCartLink } from "../components/ShopCartLink.tsx";
import { CommerceMegaNav } from "./CommerceMegaNav.tsx";
import { CommerceMobileDrawer } from "./CommerceMobileDrawer.tsx";
import type { CommerceNavNode } from "./commerce-nav.ts";

/**
 * Search-first retail header. Actions are limited to routes that exist:
 * furniture search and the cart. No account control is rendered because the
 * storefront is guest-only checkout with no customer account route.
 */
export function CommerceHeader({ nodes }: { readonly nodes: readonly CommerceNavNode[] }) {
  return (
    <header className="odc-header">
      <div className="odc-header__bar">
        <div className="odc-header__lead">
          {nodes.length > 0 ? <CommerceMobileDrawer nodes={nodes} /> : null}
          <OneDecoreWordmark size="nav" className="odc-header__mark" />
        </div>

        <form className="odc-search" action="/shop/search" method="get" role="search">
          <label className="od-sr-only" htmlFor="odc-search-input">
            Search furniture
          </label>
          <input
            id="odc-search-input"
            className="odc-search__input"
            type="search"
            name="q"
            maxLength={80}
            autoComplete="off"
            placeholder="Search sofas, beds, wardrobes…"
          />
          <button type="submit" className="odc-search__submit">
            <span aria-hidden="true">⌕</span>
            <span className="odc-search__submitLabel">Search</span>
          </button>
        </form>

        <div className="odc-header__actions">
          <Link href="/shop/search" className="odc-header__action odc-header__action--searchIcon">
            <span aria-hidden="true">⌕</span>
            <span className="od-sr-only">Search furniture</span>
          </Link>
          <ShopCartLink className="odc-header__action odc-header__action--cart" />
        </div>
      </div>

      {nodes.length > 0 ? (
        <div className="odc-header__navRow">
          <CommerceMegaNav nodes={nodes} />
        </div>
      ) : null}
    </header>
  );
}
