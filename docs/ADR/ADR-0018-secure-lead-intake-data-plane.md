# ADR-0018: Secure Lead Intake Data Plane

**Status:** Accepted (Phase 4A — local foundation; Phase 4A.1 pre-apply security correction; managed apply pending)
**Date:** July 29, 2026 (corrected July 30, 2026 — Phase 4A.1)
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
- Public Route Handler defaults to `disabled` (HTTP 503). `local-test` requires loopback Supabase URL only (`127.0.0.1` / `localhost` / `::1`); managed hosts are rejected before admin-client creation. `enabled` requires the managed HTTPS project host plus completed legal activation and trusted-proxy approval.
- Request bodies are read with a **bounded stream** (32 KiB UTF-8 bytes); Content-Length alone is never trusted.
- Staff FKs (`leads.assigned_to`, `lead_events.actor_id`) use `ON DELETE SET NULL`.
- Consent / notice versions and planner IDs derive from the legal registry and planner allowlists — not duplicated independent strings.
- Attribution paths are same-site hardened (`/` only; reject `//`, `\`, schemes, control characters).
- Phase 4A RPC is **not** complete suppression enforcement. Production remains blocked until Phase 5 defines how `contacts.status = do_not_contact` interacts with a new explicit service enquiry. No WhatsApp/campaign send may rely only on contact status. `contact_suppressions` remains deferred — no weak placeholder.

## Consequences

- LOCAL migrations = 9, REMOTE = 8 until Phase 4B managed review/apply.
- Homepage remains planner/copy-only (“Nothing is submitted”).
- CRM UI, WhatsApp API, Groq, n8n, and campaigns are out of scope.
- Phase 4A.1 edits the unapplied ninth migration in place; no migration 10.
