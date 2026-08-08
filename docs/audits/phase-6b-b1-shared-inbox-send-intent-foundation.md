# Phase 6B-B1 — Shared Inbox Authorization & Send-Intent Foundation Audit

**Status:** Managed apply **COMPLETE** (August 8, 2026)
**Migration:** `20260805140000_whatsapp_shared_inbox_send_intent_foundation.sql`  
**Managed OneDecore:** M1–M21 aligned (`lpurlfmpvriyvpkujvyl`)

## Scope delivered (B1)

- `whatsapp.inbox.read` / `whatsapp.inbox.use` / `whatsapp.inbox.manage` permissions with role grants
- Linked conversation access from current `leads.assigned_to` at action time
- Unlinked triage fail-closed for Sales Executive; Sales Manager / Super Admin manage scope
- Durable `whatsapp_send_intents` + append-only `whatsapp_send_intent_events`
- `WHATSAPP_SERVICE` purpose only; MARKETING hard-blocked on service send path
- CRM consent/DNC/channel suppression eligibility checks (no parallel consent store)
- Idempotency key + deterministic request hash with conflict detection
- Pre-dispatch lifecycle only (`eligible`); no provider message fabrication

## Explicitly not in B1

- Meta outbound dispatch / Graph API
- Shared inbox UI / composer
- n8n / Kriti / Groq
- Managed migration apply
- Public activation / deployment

## Next step

Phase 6B managed alignment complete. See `phase-6b-managed-alignment-closeout.md`.
