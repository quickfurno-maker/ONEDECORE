import "server-only";

import { getLeadIntakeServerEnv } from "../../../config/server-env.ts";

/**
 * Can the server actually accept a lead right now?
 *
 * WHY THIS EXISTS — A REAL INCIDENT
 *
 * A homepage enquiry was submitted and never arrived. The browser had been told
 * the form was active by `NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE`, a build-time
 * public flag; whether the SERVER could accept anything was decided separately
 * by `ONEDECORE_LEAD_INTAKE_MODE` and the credential checks around it. The two
 * could disagree, and when they did the visitor filled in four steps of a form
 * that had nowhere to go.
 *
 * A public flag baked into static HTML cannot know the state of the running
 * server. So it no longer gets to decide. This module asks the same function
 * the submission path asks — `getLeadIntakeServerEnv`, which validates the
 * mode, the managed Supabase URL, the service-role credential, the hash secret,
 * the proxy requirement and the legal/processor gates — and reports one bit.
 *
 * WHAT IT DELIBERATELY DOES NOT SAY
 *
 * Only whether submission is available. Not which check failed, not which
 * variable is missing, not how long a secret is, not the mode name. A public
 * endpoint that explains its own misconfiguration is a reconnaissance tool: it
 * tells an attacker which credential to go looking for. The operator has logs
 * and a runbook; the visitor needs one boolean.
 *
 * THIS IS NOT A SUBMISSION GATE
 *
 * It decides what the UI OFFERS, not what the server accepts. `POST
 * /api/public/lead-intake` re-checks everything for itself and remains the only
 * authority on whether a lead is real — readiness can go stale between the
 * check and the submit, and the submit has to survive that.
 */

export type LeadIntakeAvailability = "available" | "unavailable";

export interface LeadIntakeReadiness {
  readonly available: boolean;
  readonly state: LeadIntakeAvailability;
}

const UNAVAILABLE: LeadIntakeReadiness = {
  available: false,
  state: "unavailable",
};

/**
 * Fail closed, always.
 *
 * `getLeadIntakeServerEnv` throws for every unusable configuration — an invalid
 * mode, a missing secret, a non-loopback URL under `local-test`, an incomplete
 * activation gate. Catching the throw and reporting "unavailable" is the point:
 * an unreadable configuration is not a reason to let somebody fill in a form.
 */
export function getLeadIntakeReadiness(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): LeadIntakeReadiness {
  try {
    const resolved = getLeadIntakeServerEnv(env);

    if (resolved.mode === "disabled") {
      return UNAVAILABLE;
    }

    /*
     * `local-test` is a real, submitting mode — it is how the whole chain is
     * certified against a loopback Supabase before anything reaches production.
     * `getLeadIntakeServerEnv` already refuses it under a production
     * `NODE_ENV` and already insists the URL is loopback, so reaching here
     * means the configuration is one the server will genuinely accept.
     */
    return { available: true, state: "available" };
  } catch {
    return UNAVAILABLE;
  }
}
