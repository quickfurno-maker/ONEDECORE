# Phase 4B2 — Lead activation readiness

## Authority

Capability sprint on `phase-4b2-lead-activation-readiness` from main `bd6e5a5d08616ca73c04e278ab9ac99c978d4077`.

Allowed: migration 10 covering indexes, disabled public form gates, contract hardening, local verification, branch push, managed apply of migration 10 only, ignored synthetic manifest/evidence.

Forbidden: deployment, public enablement, PR/merge, legal publication changes, migrations 1–9 edits, CRM/WhatsApp API/Groq/n8n/campaigns.

## Delivered

### Migration 10

- File: `supabase/migrations/20260730053756_lead_intake_covering_indexes.sql`
- Indexes:
  - `idx_consent_events_intake_request_id`
  - `idx_lead_intake_requests_lead_id`
  - `idx_lead_events_actor_id`
- pgTAP: `supabase/tests/database/04_lead_intake_covering_indexes_test.sql`

### Public form dual gates

- `NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE`: `copy-only` (default) | `preview` | `active`
- Server `ONEDECORE_LEAD_INTAKE_MODE` remains default `disabled`
- Component: `src/features/lead-intake/public/HomeLeadCapture.tsx`
- Integrated in `HomePlan` without redesign; copy-only leaves existing HomePlan behaviour

### Contract hardening

- Explicit `CURRENT_CONSENT_VERSION_IDS` + `getCurrentConsentVersionByPurpose`
- `serviceChannels.email?: true`
- Strict loopback URL (http + port + root path only)
- Encoded attribution path rejection
- HMAC rotation runbook

### Docs

- `docs/runbooks/lead-intake-hmac-secret-rotation.md`
- `docs/runbooks/lead-intake-public-activation.md`
- This audit

## Production truth (unchanged)

- Form copy-only by default
- Server disabled by default
- Legal activation gate incomplete
- No deployment
- No public collection

## Residual blockers before public activation

See `docs/runbooks/lead-intake-public-activation.md`.
