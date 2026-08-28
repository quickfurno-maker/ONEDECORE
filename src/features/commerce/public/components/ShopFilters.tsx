"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type { PublicCommerceSearchInput } from "../public-types.ts";

/**
 * Listing controls. On desktop this is an inline filter bar; on mobile the same
 * form is presented as a dismissible sheet. The markup is a plain GET form, so
 * filtering still works before hydration.
 */
export function ShopFilters({
  action,
  input,
  includeQuery = false,
  resultCount,
}: {
  readonly action: string;
  readonly input: PublicCommerceSearchInput;
  readonly includeQuery?: boolean;
  readonly resultCount?: number;
}) {
  const [open, setOpen] = useState(false);
  const panelRef = useRef<HTMLDivElement | null>(null);
  const triggerRef = useRef<HTMLButtonElement | null>(null);

  const close = useCallback(() => {
    setOpen(false);
    triggerRef.current?.focus();
  }, []);

  useEffect(() => {
    if (!open) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    panelRef.current?.querySelector<HTMLElement>("select, input, button")?.focus();

    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === "Escape") {
        event.preventDefault();
        close();
      }
    };
    document.addEventListener("keydown", onKeyDown);
    return () => {
      document.body.style.overflow = previousOverflow;
      document.removeEventListener("keydown", onKeyDown);
    };
  }, [close, open]);

  const activeCount =
    (input.availabilityMode ? 1 : 0) +
    (input.minPricePaise != null ? 1 : 0) +
    (input.maxPricePaise != null ? 1 : 0) +
    (input.sort !== "featured" ? 1 : 0);

  return (
    <div className="odc-filters">
      <div className="odc-filters__bar">
        {typeof resultCount === "number" ? (
          <p className="odc-filters__count">
            {resultCount} {resultCount === 1 ? "product" : "products"}
          </p>
        ) : (
          <span />
        )}
        <button
          ref={triggerRef}
          type="button"
          className="odc-filters__trigger"
          aria-expanded={open}
          onClick={() => setOpen(true)}
        >
          Filters &amp; sort
          {activeCount > 0 ? <span className="odc-filters__pill">{activeCount}</span> : null}
        </button>
      </div>

      <div
        className="odc-filters__scrim"
        data-open={open ? "" : undefined}
        aria-hidden="true"
        onClick={close}
      />

      <div
        ref={panelRef}
        className="odc-filters__panel"
        data-open={open ? "" : undefined}
        role={open ? "dialog" : undefined}
        aria-modal={open ? true : undefined}
        aria-label="Filters and sort"
      >
        <div className="odc-filters__panelHead">
          <p className="odc-filters__panelTitle">Filters &amp; sort</p>
          <button type="button" className="odc-filters__close" onClick={close}>
            Close
          </button>
        </div>

        <form className="od-shop__filters" action={action} method="get">
          {includeQuery ? (
            <label>
              Search
              <input name="q" defaultValue={input.query ?? ""} maxLength={80} autoComplete="off" />
            </label>
          ) : input.query ? (
            <input type="hidden" name="q" value={input.query} />
          ) : null}
          <label>
            Sort
            <select name="sort" defaultValue={input.sort}>
              <option value="featured">Featured</option>
              <option value="newest">Newest</option>
              <option value="price_low_high">Price: low to high</option>
              <option value="price_high_low">Price: high to low</option>
            </select>
          </label>
          <label>
            Availability
            <select name="availability" defaultValue={input.availabilityMode ?? ""}>
              <option value="">Any</option>
              <option value="ready_stock">Ready stock</option>
              <option value="made_to_order">Made to order</option>
            </select>
          </label>
          <label>
            Min ₹
            <input
              name="min"
              inputMode="numeric"
              defaultValue={input.minPricePaise != null ? String(input.minPricePaise / 100) : ""}
            />
          </label>
          <label>
            Max ₹
            <input
              name="max"
              inputMode="numeric"
              defaultValue={input.maxPricePaise != null ? String(input.maxPricePaise / 100) : ""}
            />
          </label>
          <button type="submit">Apply</button>
          <a href={action}>Reset</a>
        </form>
      </div>
    </div>
  );
}
