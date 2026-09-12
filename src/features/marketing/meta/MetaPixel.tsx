"use client";

import { usePathname } from "next/navigation";
import { useEffect, useRef } from "react";
import { useAdConsent } from "./use-ad-consent.ts";
import {
  getMetaPixelId,
  isMetaTrackablePath,
  META_PIXEL_SCRIPT_SRC,
} from "./meta-tracking-config.ts";
import { trackMetaPageView } from "./meta-pixel-events.ts";

/**
 * The Meta Pixel, mounted once and gated per route.
 *
 * WHY IT LIVES IN THE ROOT LAYOUT AND NOT IN A PUBLIC SHELL
 *
 * There is no single public shell. `HomeShell`, `PublicDarkShell`,
 * `CommerceLightShell` and the Landing Lab renderer each wrap a different slice
 * of the public site, so mounting there would mean four copies of this decision
 * and four chances for one of them to drift onto a surface it should not be on.
 *
 * The root layout wraps everything — including `/admin` and `/manager` — which
 * is exactly why the gate is not optional. `isMetaTrackablePath` must say yes
 * before a single byte is loaded, and it is deny-by-default: an unknown path
 * gets nothing. The script is injected by this component, never by the layout,
 * so the server-rendered HTML of an internal page contains no third-party tag
 * at all rather than a tag that happens not to fire.
 *
 * WHY THE LOADER IS HAND-WRITTEN RATHER THAN `next/script`
 *
 * The snippet has to define the `fbq` queue shim BEFORE the remote script
 * arrives, or the first `PageView` is lost to a race on a fast connection.
 * `next/script` owns when the tag is inserted; this owns when the queue exists,
 * which is the part that has to happen first.
 *
 * THREE GATES, ALL REQUIRED
 *
 * A trackable public path, a valid pixel id, AND an explicit advertising
 * consent. The third is the one that holds in production: the pixel id and the
 * Conversions API token are already set there, so "the env is unset" was never
 * going to be the thing protecting anyone. Consent is.
 *
 * WHAT IT DOES NOT DO
 *
 * No automatic advanced matching, and no `init` parameters at all. Meta's
 * advanced matching would hash and send whatever it finds in the page's form
 * fields — the customer's name, phone and email — which is not approved here
 * and is not something a script should decide on a business's behalf.
 */
export function MetaPixel() {
  const pathname = usePathname();
  const pixelId = getMetaPixelId();
  const trackable = isMetaTrackablePath(pathname);
  const consent = useAdConsent();
  const allowed = Boolean(pixelId) && trackable && consent === "granted";

  const initialised = useRef(false);
  const lastReported = useRef<string | null>(null);

  /*
   * Withdrawal takes effect within the page view, not at the next navigation.
   *
   * Clearing `lastReported` is what makes a later re-grant emit a PageView for
   * the page the visitor is still standing on, rather than staying silent
   * because that path was "already reported" before consent was withdrawn.
   */
  useEffect(() => {
    if (consent !== "granted") lastReported.current = null;
  }, [consent]);

  useEffect(() => {
    if (!allowed) return;
    if (initialised.current) return;
    initialised.current = true;

    const w = window as typeof window & { _fbq?: unknown };

    /*
     * Meta's documented loader, with one change: `n.queue` is primed before the
     * remote script is requested, so a `track` call that happens while
     * fbevents.js is still downloading is replayed rather than dropped.
     */
    if (!w.fbq) {
      const stub = function (...args: readonly unknown[]) {
        const self = stub as unknown as {
          callMethod?: (...a: readonly unknown[]) => void;
          queue: unknown[];
        };
        if (self.callMethod) {
          self.callMethod(...args);
          return;
        }
        self.queue.push(args);
      } as unknown as {
        (...args: readonly unknown[]): void;
        push: unknown;
        loaded: boolean;
        version: string;
        queue: unknown[];
      };

      stub.push = stub;
      stub.loaded = true;
      stub.version = "2.0";
      stub.queue = [];

      (w as { fbq?: unknown }).fbq = stub;
      w._fbq = stub;

      const script = document.createElement("script");
      script.async = true;
      script.src = META_PIXEL_SCRIPT_SRC;
      document.head.appendChild(script);
    }

    const fbq = (w as { fbq?: (...a: readonly unknown[]) => void }).fbq;
    if (!fbq) return;

    try {
      /*
       * No second argument. `fbq('init', id, { em: ... })` is where advanced
       * matching would go, and the absence of that object is the whole of the
       * "no PII to Meta" guarantee on the browser side.
       */
      fbq("init", pixelId);
    } catch {
      // A blocked or stubbed global must not break the page.
    }
    /*
     * `allowed`, not `[pixelId, trackable]`.
     *
     * Consent is the input that changes DURING a page view. Depending on the
     * other two would leave this effect un-rerun when a visitor grants — the
     * script would load only at their next navigation, which is both a lost
     * PageView and a confusing "nothing happened" after clicking Allow.
     */
  }, [allowed, pixelId]);

  /*
   * PageView on first paint and on every App Router navigation.
   *
   * Guarded by the last reported path so a re-render — a search param change
   * that leaves the path alone, a Fast Refresh, a parent state update — cannot
   * double-count. Meta's own `init` fires nothing on its own here, so this is
   * the single source of PageView.
   */
  useEffect(() => {
    if (!allowed || !pathname) return;
    if (lastReported.current === pathname) return;
    lastReported.current = pathname;
    trackMetaPageView();
  }, [pathname, allowed]);

  return null;
}
