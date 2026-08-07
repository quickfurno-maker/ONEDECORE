# Phase 6B-B1 — Shared Inbox Authorization & Send-Intent Foundation Audit

**Status:** Repository foundation (M19) — pending managed apply  
**Migration:** `20260805140000_whatsapp_shared_inbox_send_intent_foundation.sql`  
**Managed OneDecore:** Remains M1–M18 until explicit owner authorization and DEC-0053 recovery readiness for M19

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

1. Migration-specific DEC-0053 recovery readiness for M19  
2. Separate explicit owner authorization  
3. Apply exactly M19 to managed OneDecore  
4. Continue Phase 6B runtime (B2/B3)
