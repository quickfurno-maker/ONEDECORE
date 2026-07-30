# 08 — META WHATSAPP, GROQ AI AND N8N AUTOMATION BOUNDARY

**Document Status:** Locked Integration Baseline (reconciled Phase 5A, July 30, 2026)
**WhatsApp API:** Official Meta WhatsApp Cloud API Only (planned Phase 6)
**AI Provider:** Groq behind provider-independent adapter (planned Phase 6C)
**n8n Role:** Stateless Async Event Bus & Notification Relay
**Implementation Status:** **Not live** — architecture frozen only

---

## 1. Meta WhatsApp Cloud API Architecture (Planned)

```
                   ┌────────────────────────────┐
                   │  Meta WhatsApp Cloud API   │
                   └─────────────┬──────────────┘
                                 │ Inbound Webhook (verified)
                                 ▼
                   ┌────────────────────────────┐
                   │  ONEDECORE Server Endpoint │
                   │  (src/app/api/webhooks/...)│
                   └─────────────┬──────────────┘
                                 │ 1. Verify Signature
                                 │ 2. Persist Idempotently
                                 ▼
                   ┌────────────────────────────┐
                   │  Supabase PostgreSQL       │
                   │  (conversations, messages) │
                   └─────────────┬──────────────┘
                                 │ 3. Optional n8n / staff alert
                                 ▼
                   ┌────────────────────────────┐
                   │  n8n Async Workflow Bus    │
                   └────────────────────────────┘
```

### 1.1 Future Contracts (Phase 6A/6B)
- Verified ONEDECORE webhook with HMAC signature validation.
- Idempotent persistence **before** automation (conversations, messages, delivery states, templates, consent/opt-out records).
- Role-scoped shared inbox.
- Assigned lead replies → assigned executive; unknown/unassigned → manager/admin queue.
- Assigned PM: project conversation access; Lead Designer: may be explicitly permitted; Supporting Designer: internal context only by default.
- Human takeover and AI-paused states.
- **No executive bulk messaging.**

### 1.2 Prohibited
- Unofficial WhatsApp Web scraping or browser automation.
- Sending without consent, suppression check, and template eligibility.
- Fabricating consent records.

---

## 2. Groq Human-Controlled Copilot (Planned — Phase 6C)

### 2.1 Architecture
- **Provider-independent adapter** with Groq as initial inference provider.
- **Human-controlled copilot mode only** in V1.

### 2.2 Permitted Draft Assistance
Conversation summaries, missing-info checks, objection handling, next-action suggestions, quotation wording, project updates, design summaries, campaign-copy drafts.

### 2.3 Prohibited Autonomous Actions
Groq must **not** automatically send messages, mutate assignments or statuses, approve quotations/designs/campaigns, alter prices/discounts/targets, close leads, or receive direct database credentials.

### 2.4 Required Controls
- Structured, schema-validated outputs.
- Human approval before customer-visible action.
- Append-only audit of requests, suggestions, approvals, rejections.

---

## 3. Marketing Campaigns (Planned — Phase 9)

| Role | Authority |
| :--- | :--- |
| Super Admin | Create, approve, schedule, send; view all results |
| Sales Manager | Create/edit drafts and audiences; **Super Admin approval mandatory**; cannot approve own campaign |
| Sales Executive | No campaign creation or bulk messaging |
| PM / Designer | No campaign authority |

- Mandatory consent, suppression, opt-out, template eligibility.
- Replies route to assigned salesperson or manager/admin queue.
- No fabricated consent.

---

## 4. n8n Integration Rules (Unchanged)

1. **Database-Before-Automation:** n8n triggers only after Supabase persistence succeeds.
2. **n8n is not a system of record** for leads, messages, or projects.
3. An n8n outage must never cause data loss.
4. Version-controlled workflow exports in `automation/n8n/` when implemented.

---

## 5. Public Lead Intake (Unchanged — Not Active)

| Control | Default |
| :--- | :--- |
| Form mode | `copy-only` |
| Server mode | `disabled` |
| Public collection | Off |
| Activation | Phase 5F with separate owner authority |

Do not conflate disabled intake with future WhatsApp or campaign capabilities.

---

## 6. Related Governance Documents

- [ADR-0004: Server-Side Persistence Before n8n](ADR/ADR-0004-crm-before-n8n-persistence.md)
- [ADR-0021: Groq Copilot and WhatsApp Boundary](ADR/ADR-0021-groq-copilot-and-whatsapp-boundary.md)
- [Security, Privacy & RLS](06-security-privacy-and-rls.md)
- [Runbook: Lead Intake Public Activation](runbooks/lead-intake-public-activation.md)
