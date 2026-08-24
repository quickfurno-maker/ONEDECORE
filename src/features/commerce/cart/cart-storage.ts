import {
  COMMERCE_CART_MAX_LINES,
  COMMERCE_CART_MAX_QTY,
  COMMERCE_CART_MIN_QTY,
  COMMERCE_CART_STORAGE_KEY,
  type CommerceCanonicalLine,
  type CommerceCartItem,
  type CommerceCartSnapshot,
} from "./cart-types.ts";

const SKU_RE = /^[a-z0-9._-]{1,64}$/;

function normalizeSku(sku: string): string | null {
  const value = sku.trim().toLowerCase();
  if (!SKU_RE.test(value)) return null;
  return value;
}

function clampQty(quantity: number): number {
  if (!Number.isInteger(quantity)) return COMMERCE_CART_MIN_QTY;
  return Math.min(COMMERCE_CART_MAX_QTY, Math.max(COMMERCE_CART_MIN_QTY, quantity));
}

function sanitizeOptionValues(value: unknown): Record<string, string> | undefined {
  if (value == null || typeof value !== "object" || Array.isArray(value)) return undefined;
  const out: Record<string, string> = {};
  for (const [key, item] of Object.entries(value as Record<string, unknown>)) {
    if (typeof item !== "string") continue;
    const trimmed = item.trim().slice(0, 64);
    if (trimmed) out[key.slice(0, 32)] = trimmed;
  }
  return Object.keys(out).length > 0 ? out : undefined;
}

function sanitizeItem(raw: unknown): CommerceCartItem | null {
  if (raw == null || typeof raw !== "object" || Array.isArray(raw)) return null;
  const row = raw as Record<string, unknown>;
  const sku = normalizeSku(String(row.sku ?? ""));
  if (!sku) return null;
  const quantity = clampQty(Number(row.quantity));
  const item: CommerceCartItem = { sku, quantity };
  if (typeof row.productSlug === "string" && row.productSlug.trim()) {
    item.productSlug = row.productSlug.trim().slice(0, 120);
  }
  if (typeof row.productName === "string" && row.productName.trim()) {
    item.productName = row.productName.trim().slice(0, 200);
  }
  if (typeof row.variantDisplayName === "string") {
    const name = row.variantDisplayName.trim().slice(0, 120);
    item.variantDisplayName = name || null;
  }
  const options = sanitizeOptionValues(row.optionValues);
  if (options) item.optionValues = options;
  if (typeof row.primaryImagePublicPath === "string") {
    item.primaryImagePublicPath = row.primaryImagePublicPath.trim().slice(0, 512) || null;
  }
  if (Number.isInteger(row.sellingPricePaise) && Number(row.sellingPricePaise) >= 0) {
    item.sellingPricePaise = Number(row.sellingPricePaise);
  }
  if (row.compareAtPricePaise == null) {
    item.compareAtPricePaise = null;
  } else if (Number.isInteger(row.compareAtPricePaise) && Number(row.compareAtPricePaise) >= 0) {
    item.compareAtPricePaise = Number(row.compareAtPricePaise);
  }
  if (row.availabilityMode === "ready_stock" || row.availabilityMode === "made_to_order") {
    item.availabilityMode = row.availabilityMode;
  }
  return item;
}

export function emptyCommerceCartSnapshot(): CommerceCartSnapshot {
  return { version: 1, items: [], updatedAt: Date.now() };
}

export function parseCommerceCartSnapshot(raw: string | null): CommerceCartSnapshot {
  if (!raw) return emptyCommerceCartSnapshot();
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (parsed == null || typeof parsed !== "object" || Array.isArray(parsed)) {
      return emptyCommerceCartSnapshot();
    }
    const record = parsed as Record<string, unknown>;
    if (record.version !== 1 || !Array.isArray(record.items)) {
      return emptyCommerceCartSnapshot();
    }
    const items: CommerceCartItem[] = [];
    const seen = new Set<string>();
    for (const entry of record.items.slice(0, COMMERCE_CART_MAX_LINES)) {
      const item = sanitizeItem(entry);
      if (!item || seen.has(item.sku)) continue;
      seen.add(item.sku);
      items.push(item);
    }
    return { version: 1, items, updatedAt: Date.now() };
  } catch {
    return emptyCommerceCartSnapshot();
  }
}

export function serializeCommerceCartSnapshot(snapshot: CommerceCartSnapshot): string {
  return JSON.stringify({
    version: 1,
    items: snapshot.items.slice(0, COMMERCE_CART_MAX_LINES),
    updatedAt: snapshot.updatedAt,
  });
}

export function readCommerceCartFromStorage(storage: Storage | null): CommerceCartSnapshot {
  if (!storage) return emptyCommerceCartSnapshot();
  try {
    return parseCommerceCartSnapshot(storage.getItem(COMMERCE_CART_STORAGE_KEY));
  } catch {
    return emptyCommerceCartSnapshot();
  }
}

export function writeCommerceCartToStorage(
  storage: Storage | null,
  snapshot: CommerceCartSnapshot
): void {
  if (!storage) return;
  try {
    storage.setItem(COMMERCE_CART_STORAGE_KEY, serializeCommerceCartSnapshot(snapshot));
  } catch {
    // ignore quota/private mode
  }
}

export function upsertCommerceCartItem(
  snapshot: CommerceCartSnapshot,
  item: CommerceCartItem
): CommerceCartSnapshot {
  const sanitized = sanitizeItem(item);
  if (!sanitized) return snapshot;
  const items = [...snapshot.items];
  const index = items.findIndex((row) => row.sku === sanitized.sku);
  if (index >= 0) {
    items[index] = { ...items[index], ...sanitized, quantity: clampQty(sanitized.quantity) };
  } else {
    if (items.length >= COMMERCE_CART_MAX_LINES) return snapshot;
    items.push(sanitized);
  }
  return { version: 1, items, updatedAt: Date.now() };
}

export function setCommerceCartQuantity(
  snapshot: CommerceCartSnapshot,
  sku: string,
  quantity: number
): CommerceCartSnapshot {
  const normalized = normalizeSku(sku);
  if (!normalized) return snapshot;
  const qty = clampQty(quantity);
  const items = snapshot.items
    .map((row) => (row.sku === normalized ? { ...row, quantity: qty } : row))
    .filter((row) => row.quantity >= COMMERCE_CART_MIN_QTY);
  return { version: 1, items, updatedAt: Date.now() };
}

export function removeCommerceCartItem(
  snapshot: CommerceCartSnapshot,
  sku: string
): CommerceCartSnapshot {
  const normalized = normalizeSku(sku);
  if (!normalized) return snapshot;
  return {
    version: 1,
    items: snapshot.items.filter((row) => row.sku !== normalized),
    updatedAt: Date.now(),
  };
}

export function commerceCartItemCount(snapshot: CommerceCartSnapshot): number {
  return snapshot.items.reduce((sum, row) => sum + row.quantity, 0);
}

export function commerceCartCanonicalLines(snapshot: CommerceCartSnapshot): CommerceCanonicalLine[] {
  return snapshot.items.map((row) => ({ sku: row.sku, quantity: row.quantity }));
}

export function hasCommerceCartPii(snapshot: CommerceCartSnapshot): boolean {
  const blob = JSON.stringify(snapshot).toLowerCase();
  return blob.includes("@") || blob.includes("+91") || blob.includes("mobile");
}
