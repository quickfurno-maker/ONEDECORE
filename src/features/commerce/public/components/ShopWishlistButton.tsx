"use client";

import { useCallback, useEffect, useSyncExternalStore } from "react";
import {
  RECENT_STORAGE_KEY,
  WISHLIST_STORAGE_KEY,
  WISHLIST_CAP,
  RECENT_CAP,
  pushRecentlyViewed,
  readLocalSnapshots,
  toggleWishlist,
  type LocalProductSnapshot,
} from "../wishlist-storage.ts";

const WISHLIST_EVENT = "onedecore-shop-wishlist";
const RECENT_EVENT = "onedecore-shop-recent";

function subscribeKey(key: string, eventName: string) {
  return (onStoreChange: () => void) => {
    const onStorage = (event: StorageEvent) => {
      if (event.key === key || event.key === null) onStoreChange();
    };
    window.addEventListener("storage", onStorage);
    window.addEventListener(eventName, onStoreChange);
    return () => {
      window.removeEventListener("storage", onStorage);
      window.removeEventListener(eventName, onStoreChange);
    };
  };
}

function getSnapshot(key: string): string | null {
  return window.localStorage.getItem(key);
}

function writeSnapshots(key: string, eventName: string, value: string): void {
  window.localStorage.setItem(key, value);
  window.dispatchEvent(new Event(eventName));
}

export function ShopWishlistButton(item: LocalProductSnapshot) {
  const raw = useSyncExternalStore(
    subscribeKey(WISHLIST_STORAGE_KEY, WISHLIST_EVENT),
    () => getSnapshot(WISHLIST_STORAGE_KEY),
    () => null
  );
  const saved = readLocalSnapshots(raw, WISHLIST_CAP).some((row) => row.slug === item.slug);

  const onToggle = useCallback(() => {
    const current = readLocalSnapshots(window.localStorage.getItem(WISHLIST_STORAGE_KEY), WISHLIST_CAP);
    const next = toggleWishlist(current, item);
    writeSnapshots(WISHLIST_STORAGE_KEY, WISHLIST_EVENT, JSON.stringify(next));
  }, [item]);

  return (
    <button
      type="button"
      className="od-shop-heart"
      aria-pressed={saved}
      aria-label={saved ? `Remove ${item.name} from wishlist` : `Save ${item.name} to wishlist`}
      onClick={onToggle}
    >
      {saved ? "Saved" : "Save"}
    </button>
  );
}

export function ShopRecentlyViewedRecorder(item: LocalProductSnapshot) {
  useEffect(() => {
    const current = readLocalSnapshots(window.localStorage.getItem(RECENT_STORAGE_KEY), RECENT_CAP);
    const next = pushRecentlyViewed(current, item);
    writeSnapshots(RECENT_STORAGE_KEY, RECENT_EVENT, JSON.stringify(next));
  }, [item]);
  return null;
}

export function ShopRecentlyViewedList() {
  const raw = useSyncExternalStore(
    subscribeKey(RECENT_STORAGE_KEY, RECENT_EVENT),
    () => getSnapshot(RECENT_STORAGE_KEY),
    () => null
  );
  const rows = readLocalSnapshots(raw, RECENT_CAP);

  if (rows.length === 0) return null;

  return (
    <section className="od-shop__section" aria-labelledby="recent-heading">
      <h2 id="recent-heading">Recently viewed</h2>
      <ul>
        {rows.map((row) => (
          <li key={row.slug}>
            <a href={`/shop/product/${row.slug}`}>{row.name}</a>
          </li>
        ))}
      </ul>
    </section>
  );
}
