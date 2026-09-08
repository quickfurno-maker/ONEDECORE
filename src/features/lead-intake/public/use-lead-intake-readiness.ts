"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/**
 * Asks the running server whether a lead can be submitted at all.
 *
 * WHY THE BROWSER HAS TO ASK
 *
 * The page it is running in may have been built hours ago, when the backend was
 * healthy. A build-time public flag cannot know anything about the server as it
 * is now, and trusting one is how a real enquiry was lost: the form said active,
 * the server was not, and the visitor completed four steps into nothing.
 *
 * WHEN IT ASKS
 *
 * On open, not on mount. Nothing is spent on a visitor who never touches a CTA,
 * and a sheet opened twenty minutes into a session gets a fresh answer rather
 * than one from page load.
 *
 * FAIL CLOSED
 *
 * A network error, a timeout, a non-JSON body, a 500 — all of them mean
 * "unavailable". The one thing this must never do is fall back to "available"
 * and hand somebody a form with nowhere to send it, which is the exact failure
 * being repaired.
 */

export type LeadIntakeReadinessState = "idle" | "checking" | "available" | "unavailable";

const CHECK_TIMEOUT_MS = 6000;

export function useLeadIntakeReadiness() {
  const [state, setState] = useState<LeadIntakeReadinessState>("idle");
  const inFlight = useRef<AbortController | null>(null);

  useEffect(() => {
    return () => inFlight.current?.abort();
  }, []);

  const check = useCallback(async () => {
    inFlight.current?.abort();
    const controller = new AbortController();
    inFlight.current = controller;

    setState("checking");

    /*
     * Bounded. A hung request would otherwise leave the sheet on its checking
     * state indefinitely, which reads as a broken page rather than an honest
     * "we cannot take this right now".
     */
    const timeout = setTimeout(() => controller.abort(), CHECK_TIMEOUT_MS);

    try {
      const res = await fetch("/api/public/lead-intake/readiness", {
        method: "GET",
        cache: "no-store",
        headers: { accept: "application/json" },
        signal: controller.signal,
      });

      if (!res.ok) {
        setState("unavailable");
        return;
      }

      const data: unknown = await res.json();
      const available =
        typeof data === "object" &&
        data !== null &&
        (data as { available?: unknown }).available === true;

      setState(available ? "available" : "unavailable");
    } catch {
      // Aborted, offline, timed out, or malformed. None of those is a reason to
      // show an editable form.
      setState("unavailable");
    } finally {
      clearTimeout(timeout);
      if (inFlight.current === controller) inFlight.current = null;
    }
  }, []);

  return { state, check } as const;
}
