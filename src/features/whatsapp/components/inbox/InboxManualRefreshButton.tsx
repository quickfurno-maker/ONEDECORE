"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

/**
 * Keeping the inbox current, and saying honestly how.
 *
 * THIS IS POLLING. IT IS NOT REAL TIME, AND IT DOES NOT SAY IT IS.
 *
 * Supabase Realtime is not available to this application: `connect-src` in
 * `http-security.ts` lists no websocket scheme, no table is in the
 * `supabase_realtime` publication, and nothing in `src/` opens a channel.
 * Turning that on is a change to the production security header and to the
 * database publication — not a change to an admin screen — so this lane does
 * not make it.
 *
 * What is left is a server round-trip on a timer. `router.refresh()` re-runs
 * the server component and reconciles the result, so client state survives:
 * a half-typed reply is still in the composer afterwards, because the textarea
 * is uncontrolled and its DOM node is not replaced.
 *
 * The label says "Auto · 10s" and the title says polling, because a reader who
 * believes this is a live socket will trust a silent pane to mean a silent
 * customer. Every ten seconds, with the tab in front of them, is the actual
 * guarantee.
 *
 * WHEN IT DOES NOT RUN.
 *
 * A hidden tab polls nothing. Staff leave the inbox open all day beside other
 * work, and a background tab hitting the database every ten seconds for nobody
 * is pure cost. Becoming visible refreshes once immediately, so coming back to
 * the tab shows current data rather than whatever was on screen at lunchtime.
 */

const POLL_MS = 10_000;

export function InboxManualRefreshButton() {
  const router = useRouter();
  const [auto, setAuto] = useState(true);

  useEffect(() => {
    if (!auto) return;

    const tick = () => {
      /*
       * A hidden tab is skipped rather than unscheduled. The interval is cheap
       * and a skipped tick costs nothing; tearing the timer down and building
       * it again on every visibility change is more moving parts for the same
       * result.
       */
      if (document.visibilityState !== "visible") return;
      router.refresh();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") router.refresh();
    };

    const id = window.setInterval(tick, POLL_MS);
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      window.clearInterval(id);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [auto, router]);

  return (
    <div className="od-wa__refresh">
      <label
        className="od-wa__toggle"
        title={`Polls the server every ${POLL_MS / 1000} seconds while this tab is in front. This is not a live connection.`}
      >
        <input
          type="checkbox"
          checked={auto}
          onChange={(event) => setAuto(event.currentTarget.checked)}
        />
        <span>Auto · {POLL_MS / 1000}s</span>
      </label>
      <button
        type="button"
        className="od-wa__btn"
        onClick={() => router.refresh()}
      >
        Refresh
      </button>
    </div>
  );
}
