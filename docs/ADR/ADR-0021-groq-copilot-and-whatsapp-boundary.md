# ADR-0021: Provider-Independent Groq Copilot and Official WhatsApp Boundary

**Status:** Accepted  
**Date:** July 30, 2026  
**Deciders:** Business Owner, Senior Product Architect  
**Technical Scope:** Communication & AI Architecture (Phase 5A freeze)

---

## Context and Problem Statement

ONEDECORE will integrate official Meta WhatsApp Cloud API messaging and human-controlled AI assistance. Phase 1B locked database-before-automation and banned unofficial WhatsApp Web scraping. Phase 4B2 explicitly deferred marketing campaigns and live public intake.

This ADR freezes provider boundaries so Phase 6 (WhatsApp) and Phase 6C (Groq copilot) implement consistent, auditable, non-autonomous behaviour.

---

## Decision Drivers

- Meta policy compliance and message deliverability require official Cloud API only.
- AI must assist staff without mutating authoritative business state.
- Consent, suppression, and template eligibility are mandatory before outbound communication.
- n8n remains a notification bus after persistence, not a system of record.

---

## Decision Outcome

### WhatsApp (future — Phase 6A/6B)

**Provider:** Official Meta WhatsApp Cloud API only. Unofficial WhatsApp Web automation is **prohibited**.

**Server contracts (future):**

- Verified ONEDECORE webhook endpoint with signature validation.
- Idempotent persistence to Supabase **before** automation (conversations, messages, delivery states, templates, consent/opt-out records).
- Role-scoped shared inbox.
- Assigned lead replies route to assigned executive; unknown/unassigned routes to manager/admin queue.
- Assigned PM may access project conversations; Lead Designer access may be explicitly permitted; Supporting Designer normally receives internal context only.
- Human takeover and AI-paused states required.
- No executive bulk messaging.

**Not live in Phase 5A.** No webhook routes, message tables, or outbound senders are implemented.

### Groq AI (future — Phase 6C)

**Provider:** Groq is the initial inference provider behind a **provider-independent adapter** (swap without changing business contracts).

**Initial mode:** Human-controlled copilot only.

Permitted draft assistance:

- Conversation summaries, missing-info checks, objection handling suggestions, next-action suggestions.
- Quotation wording drafts, project update drafts, design summaries, campaign-copy drafts.

**Groq must not:**

- Automatically send messages.
- Mutate assignments or pipeline statuses.
- Approve quotations, designs, or campaigns.
- Alter prices, discounts, or targets.
- Close leads.
- Receive direct database credentials.

**Required controls:**

- Structured, schema-validated outputs.
- Human approval before any customer-visible action.
- Append-only audit of AI requests, suggestions, approvals, and rejections.

**Not live in Phase 5A.** No Groq API keys, adapters, or copilot UI are implemented.

### Marketing campaigns (future — Phase 9A/9B)

- Super Admin: create/approve/schedule/send; see all results.
- Sales Manager: create/edit drafts and audiences; Super Admin approval mandatory; cannot approve own campaign.
- Sales Executive: no campaign creation or bulk messaging.
- PM/Designer: no campaign authority.
- Mandatory consent, suppression, opt-out, and template eligibility.
- Replies route to assigned salesperson or manager/admin queue.
- No fabricated consent.

**Not live in Phase 5A.**

### n8n boundary (unchanged)

- n8n dispatches async notifications **after** Supabase persistence.
- n8n does not own lead, message, or project state.

### Public lead intake truth (unchanged)

- Browser form default: `copy-only`.
- Server intake default: `disabled`.
- Legal/owner activation gates incomplete.
- No deployment or public collection without separate explicit authority (Phase 5F).

---

## Consequences

### Positive

- Clear prohibition on scraping and autonomous AI action.
- Adapter pattern allows future model/provider changes.

### Negative / trade-offs

- Official WhatsApp onboarding and template approval remain operational dependencies.
- Human-in-the-loop AI adds staff review latency.

### Implementation phases

- **Phase 6A:** WhatsApp data & webhook foundation.
- **Phase 6B:** Premium shared inbox & controlled outbound messaging.
- **Phase 6C:** Groq human-controlled copilot.
- **Phase 9A/9B:** Campaign consent, audience, approval, execution.

---

## Related Documents

- [ADR-0004: CRM Before n8n Persistence](ADR-0004-crm-before-n8n-persistence.md)
- [WhatsApp & n8n Boundary](../08-whatsapp-and-n8n-boundary.md)
- [ADR-0019: Five-Role CRM Authorization Model](ADR-0019-five-role-crm-authorization-model.md)
