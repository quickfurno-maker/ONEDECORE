# ADR-0018: Secure Lead Intake Data Plane

**Status:** Accepted (Phase 4A foundation; Phase 4A.1 pre-apply correction; Phase 4B1 managed migration 9 applied; Phase 4B2 activation readiness — public form gated disabled)
**Date:** July 29, 2026 (corrected July 30, 2026 — Phase 4A.1; Phase 4B2 July 30, 2026)
**Deciders:** Owner / Security Architect


## Context

ONEDECORE requires CRM-ready lead persistence before public form wiring. Legal activation fields remain incomplete, so production submission must stay disabled.

## Decision

- Supabase PostgreSQL is the source of truth.
- Lead creation is one atomic `SECURITY DEFINER` RPC (`submit_lead_intake`) executable only by `service_role`.
- Browser never receives service-role credentials, HMAC secrets, raw DB errors, or internal IDs.
- Consent is append-only, **channel-specific** evidence:
  - `SERVICE_ENQUIRY` → `website-form`
  - `SERVICE_COMMUNICATION` → `phone` (required) and optional `email` when explicitly consented with a valid email
  - `WHATSAPP_SERVICE` → `whatsapp` channel row + event when explicit WhatsApp service consent is true
  - Never write generic `SERVICE_COMMUNICATION` on `website-form`
  - Channel-agnostic **marketing** capture is deferred; `MARKETING` remains in the purpose allowlist for a later reviewed phase
- Lead history is append-only events.
- Idempotency and rate limits are enforced inside the RPC under a fixed advisory-lock order: **idempotency → network → phone** (deadlock-safe).
- Network/phone/request fingerprints are HMAC-SHA-256 only — no raw IP/user-agent storage.
- Public Route Handler defaults to `disabled` (HTTP 503). `local-test` requires a **strict** loopback Supabase URL: protocol `http:`, host `127.0.0.1` / `localhost` / `::1`, explicit valid port, root path only, no credentials/query/fragment. Managed hosts are rejected before admin-client creation. `enabled` requires the managed HTTPS project host plus completed legal activation and trusted-proxy approval.
- Request bodies are read with a **bounded stream** (32 KiB UTF-8 bytes); Content-Length alone is never trusted.
- Staff FKs (`leads.assigned_to`, `lead_events.actor_id`) use `ON DELETE SET NULL`.
- Consent / notice versions use an **explicit current-version map** (`CURRENT_CONSENT_VERSION_IDS`) — not first-array-match selection. Status may remain `draft-review`.
- `serviceChannels.email` is typed `email?: true` (omit or true only).
- Attribution paths are same-site hardened (`/` only; reject `//`, `\`, schemes, control characters, malformed percent-encoding, encoded `/` and `\`).
- Phase 4B2 adds covering indexes for advisor FK findings and a dual-gated public form (`NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE` default `copy-only`; server remains default `disabled`).
- Phase 4A RPC is **not** complete suppression enforcement. Production remains blocked until Phase 5 defines how `contacts.status = do_not_contact` interacts with a new explicit service enquiry. No WhatsApp/campaign send may rely only on contact status. `contact_suppressions` remains deferred — no weak placeholder.

## Consequences

- After Phase 4B2 managed apply: LOCAL migrations = 10, REMOTE = 10.
- Homepage default remains planner/copy-only (“Nothing is submitted”).
- CRM UI, WhatsApp API, Groq, n8n, and campaigns are out of scope.
- Public collection stays disabled until owner/legal activation runbook gates are complete.
