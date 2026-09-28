"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";

/**
 * Inbox freshness has two independent paths:
 *   1. authenticated Supabase Postgres Changes for low-latency refresh;
 *   2. a bounded 30-second poll as a safety net when a socket drops silently.
 *
 * The manual Refresh button always remains. Realtime never replaces the
 * server-side RLS-scoped repository read: an event only asks Next to re-run the
 * existing Server Component query.
 */
const FALLBACK_POLL_MS = 30_000;
const REFRESH_DEBOUNCE_MS = 250;

type InboxFreshnessState = "connecting" | "live" | "fallback";

export function InboxManualRefreshButton() {
  const router = useRouter();
  const [auto, setAuto] = useState(true);
  const [freshness, setFreshness] = useState<InboxFreshnessState>("connecting");
  const refreshTimer = useRef<number | null>(null);

  useEffect(() => {
    if (!auto) return;

    const supabase = createClient();
    let closed = false;

    const refreshVisible = () => {
      if (document.visibilityState !== "visible") return;
      if (refreshTimer.current !== null) return;
      refreshTimer.current = window.setTimeout(() => {
        refreshTimer.current = null;
        router.refresh();
      }, REFRESH_DEBOUNCE_MS);
    };

    const channel = supabase
      .channel("onedecore-whatsapp-inbox-v1")
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_messages" },
        refreshVisible
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_message_status_events" },
        refreshVisible
      )
      .on(
        "postgres_changes",
        { event: "*", schema: "public", table: "whatsapp_conversations" },
        refreshVisible
      )
      .subscribe((status) => {
        if (closed) return;
        if (status === "SUBSCRIBED") {
          setFreshness("live");
        } else if (
          status === "CHANNEL_ERROR" ||
          status === "TIMED_OUT" ||
          status === "CLOSED"
        ) {
          setFreshness("fallback");
        }
      });

    const fallbackId = window.setInterval(refreshVisible, FALLBACK_POLL_MS);
    const onVisible = () => {
      if (document.visibilityState === "visible") refreshVisible();
    };
    document.addEventListener("visibilitychange", onVisible);

    return () => {
      closed = true;
      window.clearInterval(fallbackId);
      document.removeEventListener("visibilitychange", onVisible);
      if (refreshTimer.current !== null) {
        window.clearTimeout(refreshTimer.current);
        refreshTimer.current = null;
      }
      void supabase.removeChannel(channel);
    };
  }, [auto, router]);

  const label = !auto
    ? "Auto off"
    : freshness === "live"
      ? "Live · 30s safety"
      : freshness === "fallback"
        ? "Fallback · 30s"
        : "Connecting…";

  return (
    <div className="od-wa__refresh">
      <label
        className="od-wa__toggle"
        title="Realtime refreshes on WhatsApp database changes. A 30-second visible-tab poll remains as a safety fallback."
      >
        <input
          type="checkbox"
          checked={auto}
          onChange={(event) => {
            const nextAuto = event.currentTarget.checked;
            setAuto(nextAuto);
            if (nextAuto) setFreshness("connecting");
          }}
        />
        <span>{label}</span>
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
