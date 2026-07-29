# ADR-0018: Secure Lead Intake Data Plane

**Status:** Accepted (Phase 4A — local foundation; managed apply pending)  
**Date:** July 29, 2026  
**Deciders:** Owner / Security Architect  

## Context

ONEDECORE requires CRM-ready lead persistence before public form wiring. Legal activation fields remain incomplete, so production submission must stay disabled.

## Decision

- Supabase PostgreSQL is the source of truth.
- Lead creation is one atomic `SECURITY DEFINER` RPC (`submit_lead_intake`) executable only by `service_role`.
- Browser never receives service-role credentials, HMAC secrets, raw DB errors, or internal IDs.
- Consent is append-only evidence; lead history is append-only events.
- Idempotency and rate limits are enforced inside the RPC.
- Network/phone/request fingerprints are HMAC-SHA-256 only — no raw IP/user-agent storage.
- Public Route Handler defaults to `disabled` (HTTP 503). `local-test` is localhost-only outside production.
- `contact_suppressions` is deferred to Phase 5 / WhatsApp — no weak placeholder.

## Consequences

- LOCAL migrations = 9, REMOTE = 8 until Phase 4B managed review/apply.
- Homepage remains planner/copy-only (“Nothing is submitted”).
- CRM UI, WhatsApp, Groq, n8n, and campaigns are out of scope.
