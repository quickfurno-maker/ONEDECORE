export const COMMERCE_CART_STORAGE_KEY = "onedecore.commerce.cart.v1";
export const COMMERCE_BUY_NOW_STORAGE_KEY = "onedecore.commerce.buy-now.v1";

export const COMMERCE_CART_MAX_LINES = 20;
export const COMMERCE_CART_MIN_QTY = 1;
export const COMMERCE_CART_MAX_QTY = 20;

export type CommerceCartAvailabilityMode = "ready_stock" | "made_to_order";

export type CommerceCartItem = {
  sku: string;
  quantity: number;
  productSlug?: string;
  productName?: string;
  variantDisplayName?: string | null;
  optionValues?: Record<string, string>;
  primaryImagePublicPath?: string | null;
  sellingPricePaise?: number;
  compareAtPricePaise?: number | null;
  availabilityMode?: CommerceCartAvailabilityMode;
};

export type CommerceCartSnapshot = {
  version: 1;
  items: CommerceCartItem[];
  updatedAt: number;
};

export type CommerceCanonicalLine = {
  sku: string;
  quantity: number;
};
