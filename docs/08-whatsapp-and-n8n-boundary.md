# 08 — META WHATSAPP AND N8N AUTOMATION BOUNDARY

**Document Status:** Locked Integration Baseline  
**WhatsApp API:** Official Meta WhatsApp Cloud API Only  
**n8n Role:** Stateless Async Event Bus & Notification Relay  

---

## 1. Meta WhatsApp Cloud API Architecture

Following mandatory corrections in Phase 1B, Meta WhatsApp webhooks terminate directly at a verified ONEDECORE server endpoint.

```
                   ┌────────────────────────────┐
                   │  Meta WhatsApp Cloud API   │
                   └─────────────┬──────────────┘
                                 │ Inbound Webhook
                                 ▼
                   ┌────────────────────────────┐
                   │  ONEDECORE Server Endpoint │
                   │  (src/app/api/webhooks/...)│
                   └─────────────┬──────────────┘
                                 │ 1. Verify Signature & Validate
                                 │ 2. Persist Idempotently
                                 ▼
                   ┌────────────────────────────┐
                   │  Supabase PostgreSQL DB    │
                   │  (Primary Message Store)   │
                   └─────────────┬──────────────┘
                                 │ 3. Dispatch Event Outbox
                                 ▼
                   ┌────────────────────────────┐
                   │  n8n Async Workflow Bus    │
                   │  (Staff Alerts & Triggers) │
                   └────────────────────────────┘
```

---

## 2. Integration & Persistence Rules

1. **Webhook Authentication:** All incoming Meta webhooks verify HMAC signatures before payload processing.
2. **Idempotent Storage:** Inbound messages and status updates (`sent`, `delivered`, `read`) are committed to Supabase idempotently using Meta message IDs.
3. **n8n Boundary:** n8n acts exclusively as an async notification bus. An n8n outage or pause must **never** result in lost lead or message data.
4. **Consent & Opt-in:** Outbound messaging requires explicit opt-in consent captured during web form submission. Opt-out keyword `STOP` immediately revokes consent.
5. **No Scraping:** Unofficial WhatsApp Web scraping or browser automation hacks are strictly banned.

---

## 3. Related Governance Documents

- [Architecture & Repository Structure](02-architecture.md)
- [ADR-0004: Server-Side Persistence Before n8n](ADR/ADR-0004-crm-before-n8n-persistence.md)
