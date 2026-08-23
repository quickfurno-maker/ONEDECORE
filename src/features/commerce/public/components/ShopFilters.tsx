import type { PublicCommerceSearchInput } from "../public-types.ts";

export function ShopFilters({
  action,
  input,
  includeQuery = false,
}: {
  readonly action: string;
  readonly input: PublicCommerceSearchInput;
  readonly includeQuery?: boolean;
}) {
  return (
    <form className="od-shop__filters" action={action} method="get">
      {includeQuery ? (
        <label>
          Search
          <input
            name="q"
            defaultValue={input.query ?? ""}
            maxLength={80}
            autoComplete="off"
          />
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
  );
}
