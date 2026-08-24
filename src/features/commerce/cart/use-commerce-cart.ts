"use client";

import { useCallback, useMemo, useSyncExternalStore } from "react";
import {
  commerceCartCanonicalLines,
  commerceCartItemCount,
  emptyCommerceCartSnapshot,
  readCommerceCartFromStorage,
  removeCommerceCartItem,
  setCommerceCartQuantity,
  upsertCommerceCartItem,
  writeCommerceCartToStorage,
} from "./cart-storage.ts";
import { COMMERCE_CART_STORAGE_KEY, type CommerceCartItem, type CommerceCartSnapshot } from "./cart-types.ts";

const listeners = new Set<() => void>();
const SERVER_SNAPSHOT = emptyCommerceCartSnapshot();

let cachedRaw: string | null = null;
let cachedSnapshot: CommerceCartSnapshot = SERVER_SNAPSHOT;

function emitCartChange() {
  for (const listener of listeners) {
    listener();
  }
}

function subscribeCart(onStoreChange: () => void) {
  const onStorage = (event: StorageEvent) => {
    if (event.key === COMMERCE_CART_STORAGE_KEY || event.key === null) {
      onStoreChange();
    }
  };
  listeners.add(onStoreChange);
  window.addEventListener("storage", onStorage);
  return () => {
    listeners.delete(onStoreChange);
    window.removeEventListener("storage", onStorage);
  };
}

function getCartSnapshot(): CommerceCartSnapshot {
  let raw: string | null = null;
  try {
    raw = window.localStorage.getItem(COMMERCE_CART_STORAGE_KEY);
  } catch {
    raw = null;
  }
  if (raw === cachedRaw) {
    return cachedSnapshot;
  }
  cachedRaw = raw;
  cachedSnapshot = readCommerceCartFromStorage(window.localStorage);
  return cachedSnapshot;
}

function getServerCartSnapshot(): CommerceCartSnapshot {
  return SERVER_SNAPSHOT;
}

function getHydratedClientSnapshot(): boolean {
  return true;
}

function getHydratedServerSnapshot(): boolean {
  return false;
}

export function useCommerceCart() {
  const snapshot = useSyncExternalStore(subscribeCart, getCartSnapshot, getServerCartSnapshot);
  const hydrated = useSyncExternalStore(
    subscribeCart,
    getHydratedClientSnapshot,
    getHydratedServerSnapshot
  );

  const persist = useCallback((next: CommerceCartSnapshot) => {
    writeCommerceCartToStorage(window.localStorage, next);
    // Invalidate cache so the next getSnapshot returns the new object once.
    cachedRaw = null;
    emitCartChange();
  }, []);

  const addItem = useCallback(
    (item: CommerceCartItem) => {
      persist(upsertCommerceCartItem(snapshot, item));
    },
    [persist, snapshot]
  );

  const setQuantity = useCallback(
    (sku: string, quantity: number) => {
      persist(setCommerceCartQuantity(snapshot, sku, quantity));
    },
    [persist, snapshot]
  );

  const removeItem = useCallback(
    (sku: string) => {
      persist(removeCommerceCartItem(snapshot, sku));
    },
    [persist, snapshot]
  );

  const clearCart = useCallback(() => {
    persist(emptyCommerceCartSnapshot());
  }, [persist]);

  const itemCount = useMemo(() => commerceCartItemCount(snapshot), [snapshot]);
  const canonicalLines = useMemo(() => commerceCartCanonicalLines(snapshot), [snapshot]);

  return {
    snapshot,
    hydrated,
    itemCount,
    canonicalLines,
    addItem,
    setQuantity,
    removeItem,
    clearCart,
  };
}
