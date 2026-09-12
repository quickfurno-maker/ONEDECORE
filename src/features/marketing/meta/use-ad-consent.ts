"use client";

import { useSyncExternalStore } from "react";
import {
  AD_CONSENT_CHANGE_EVENT,
  readAdConsent,
  type AdConsentState,
} from "./ad-consent.ts";

/**
 * The visitor's advertising decision, as a subscribable store.
 *
 * WHY A STORE AND NOT STATE-IN-AN-EFFECT
 *
 * The decision lives in a cookie, which is external to React and can change
 * from three directions: this component's own buttons, the reopener elsewhere
 * on the page, and another tab. `useSyncExternalStore` reads it at render time
 * and re-reads on notification, so no `setState` runs inside an effect and no
 * cascading render is scheduled just to learn something that was already
 * knowable synchronously.
 *
 * The server snapshot is `unknown` because the server genuinely does not know:
 * this file's reader is `document.cookie`. That is also the safe answer — every
 * gate in this system treats `unknown` exactly as it treats `denied`.
 */
function subscribeToAdConsent(onChange: () => void): () => void {
  if (typeof window === "undefined") return () => {};
  window.addEventListener(AD_CONSENT_CHANGE_EVENT, onChange);
  // Another tab deciding is this tab's decision too.
  window.addEventListener("focus", onChange);
  return () => {
    window.removeEventListener(AD_CONSENT_CHANGE_EVENT, onChange);
    window.removeEventListener("focus", onChange);
  };
}

export function useAdConsent(): AdConsentState {
  return useSyncExternalStore(
    subscribeToAdConsent,
    readAdConsent,
    () => "unknown" as const
  );
}

/**
 * True once the client has taken over from the server-rendered markup.
 *
 * WHY THIS EXISTS AT ALL
 *
 * The banner must not be part of the server-rendered HTML. The server cannot
 * read the cookie, so it would render the banner for everyone — including the
 * visitor who answered months ago — and the client would then remove it. That
 * flash is both ugly and misleading: it suggests the question is being asked
 * again when it is not.
 *
 * Expressed as a store rather than the usual `useState(false)` + effect for the
 * same reason as above: it is a fact about the environment, not a piece of
 * component state, and writing it through an effect schedules a second render
 * pass that the React Compiler correctly flags.
 */
const subscribeToNothing = () => () => {};

export function useHydrated(): boolean {
  return useSyncExternalStore(
    subscribeToNothing,
    () => true,
    () => false
  );
}
