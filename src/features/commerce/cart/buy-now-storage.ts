import {
  COMMERCE_BUY_NOW_STORAGE_KEY,
  type CommerceCartItem,
  type CommerceCartSnapshot,
} from "./cart-types.ts";
import {
  emptyCommerceCartSnapshot,
  parseCommerceCartSnapshot,
  serializeCommerceCartSnapshot,
} from "./cart-storage.ts";

export function readBuyNowFromSession(storage: Storage | null): CommerceCartSnapshot {
  if (!storage) return emptyCommerceCartSnapshot();
  try {
    const parsed = parseCommerceCartSnapshot(storage.getItem(COMMERCE_BUY_NOW_STORAGE_KEY));
    return parsed.items.length > 0 ? parsed : emptyCommerceCartSnapshot();
  } catch {
    return emptyCommerceCartSnapshot();
  }
}

export function writeBuyNowToSession(storage: Storage | null, item: CommerceCartItem): void {
  if (!storage) return;
  const snapshot: CommerceCartSnapshot = {
    version: 1,
    items: [item],
    updatedAt: Date.now(),
  };
  try {
    storage.setItem(COMMERCE_BUY_NOW_STORAGE_KEY, serializeCommerceCartSnapshot(snapshot));
  } catch {
    // ignore
  }
}

export function clearBuyNowSession(storage: Storage | null): void {
  if (!storage) return;
  try {
    storage.removeItem(COMMERCE_BUY_NOW_STORAGE_KEY);
  } catch {
    // ignore
  }
}
