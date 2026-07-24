# ADR-0004: SERVER-SIDE DATABASE PERSISTENCE BEFORE AUTOMATION DISPATCH

**Status:** Accepted (Corrected in Phase 1B Owner Review)  
**Date:** July 24, 2026  
**Deciders:** Senior Software Architect, Security Architect  
**Technical Scope:** Webhook & Web Form Data Flow Architecture  

---

## Context and Problem Statement

The initial Phase 1B proposal illustrated web form submissions flowing into n8n before being written to Supabase (`Public Web -> n8n -> Supabase`). This created a critical reliability risk where an n8n outage, rate limit, or configuration error could cause permanent lead data loss.

---

## Decision Drivers

- Zero tolerance for lost sales leads or customer inquiries.
- Separation of core database transactions from secondary notification automation.
- Idempotent processing of external webhooks (e.g., Meta WhatsApp Cloud API).

---

## Decision Outcome

**Chosen Architecture:** **Server-side validation and Supabase database persistence *must* complete successfully before triggering external automation or n8n webhooks.**

```text
[Incoming Form / Meta Webhook]
             │
             ▼
[ONEDECORE Server Endpoint] (Validate Payload & Verify Signatures)
             │
             ▼
[Supabase DB Transaction] (Persist Record Idempotently)
             │
             ▼
[Outbox / Async Dispatcher] ──► [n8n Automation Bus] (Staff Alerts & Notifications)
```

### Key Rules

1. Lead form handlers commit lead records to Supabase before triggering external webhooks.
2. Meta WhatsApp webhooks verify HMAC signatures, commit message records idempotently to Supabase, and only then dispatch async events to n8n.
3. An n8n failure or workflow pause must **never** prevent data persistence or crash the user-facing web request.
