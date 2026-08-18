# 08 — META WHATSAPP, GROQ AI AND N8N AUTOMATION BOUNDARY

**Document Status:** Locked Integration Baseline (truth-synced through Phase 9B architecture freeze, August 18, 2026)
**WhatsApp API:** Official Meta WhatsApp Cloud API Only
**AI Provider:** Groq behind provider-independent adapter (planned Phase 6C)
**n8n Role:** Stateless Async Event Bus & Notification Relay
**Implementation Status:** **M18–M21 foundation managed** — **not production-activated** (no Meta callback/token/outbound; no n8n/Kriti runtime)

---

## 1. Meta WhatsApp Cloud API Architecture

**Phase 6A (COMPLETE — foundation managed):** Migration 18 applied managed August 7, 2026. Seven RLS-enabled tables, service-role-only ingest RPCs, private hardened helpers, append-only webhook/status events. **No production Meta callback, token, outbound messaging, or deployment.**

**Phase 6B (COMPLETE — managed foundation; not production-activated):** M19–M21 applied managed August 8, 2026. Role-scoped inbox read model, durable `WHATSAPP_SERVICE` send-intent/idempotency, service-role-only provider dispatch boundary. Repository admin inbox UI and local-test dispatch exist; **no production Meta callback/token; no real customer outbound; no deployment.**

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

### 1.1 Contracts (Phase 6A + 6B managed foundations)
- **Phase 6A (managed):** Idempotent webhook/message persistence foundation; hash/event-key replay protection; cross-WABA fail-closed phone binding; **CRM consent not fabricated** — `consent_events` purposes (`SERVICE_ENQUIRY`, `SERVICE_COMMUNICATION`, `WHATSAPP_SERVICE`, `MARKETING`) remain authoritative on CRM tables.
- **Phase 6B (managed):** Current-assignment inbox access resolver; scoped authenticated SELECT on conversations/messages; durable send-intent with idempotency; `WHATSAPP_SERVICE` only (MARKETING blocked); DNC/consent/service-window/template gates on dispatch path; service-role-only claim/bind/outcome/reconcile RPCs. **Production webhook route activation and real outbound remain Phase 10 gated.**

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

## 3. Marketing Campaigns (Phase 9A M31 **managed-applied 2026-08-18**)

| Role | Phase 9A authority |
| :--- | :--- |
| Super Admin | Create/edit drafts; request approval; approve any pending version; staff MARKETING consent recording |
| Sales Manager | Create/edit drafts and audiences; request approval; **may approve other versions; MUST NOT approve own**; staff MARKETING consent recording |
| Sales Executive | No campaign creation, approval, or bulk messaging |
| PM / Designer | No campaign authority |
| Kriti | No authoritative campaign approval or execution |

- MARKETING consent lives in existing append-only `consent_events`. WHATSAPP_SERVICE does **not** imply MARKETING.
- DNC (`contacts.status = 'do_not_contact'`) and channel suppression (`contact_channels.status = 'suppressed'`) are the suppression foundation. No `contact_suppressions` table in 9A.
- Audience approval freezes **rules**, not a PII recipient list. Phase 9C rechecks eligibility before any later export/send.
- Intended channels are **metadata only**. M19 send-intent purpose remains **WHATSAPP_SERVICE**. MARKETING consent does **not** authorize the current send-intent RPC. Phase 9A approval creates **no** send intent. WhatsApp marketing requires later 9C design.
- n8n cannot decide consent or approval truth.
- No fabricated consent. Public MARKETING capture remains OFF.

Phase 9D may add a public “Need Help? Chat with ONEDECORE” WhatsApp support CTA on `/shop`. That chat is **not** order, payment, or inventory truth (OD9D-10). Storefront purchase does **not** grant MARKETING consent. Architecture freeze: [ADR-0030](ADR/ADR-0030-phase-9d-ready-made-furniture-ecommerce-architecture.md).

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
- [ADR-0027: Phase 9A Campaign Consent, Audience & Approval](ADR/ADR-0027-phase-9a-campaign-consent-audience-approval.md)
- [ADR-0028: Phase 9D Ready-Made Furniture E-commerce](ADR/ADR-0028-phase-9d-ready-made-furniture-ecommerce.md)
- [ADR-0030: Phase 9D architecture freeze](ADR/ADR-0030-phase-9d-ready-made-furniture-ecommerce-architecture.md)
- [Security, Privacy & RLS](06-security-privacy-and-rls.md)
- [Runbook: Lead Intake Public Activation](runbooks/lead-intake-public-activation.md)

<!-- PHASE_9B_ARCHITECTURE_FREEZE_START -->
## Phase 9B Automation Boundary

n8n and WhatsApp are not Landing Page Lab truth.

Phase 9B canonical persistence occurs in ONEDECORE/Supabase before any optional automation. n8n must not:

- decide canonical experiment routing;
- create a lead before the existing atomic intake;
- own publication state;
- own campaign approval;
- grant MARKETING consent;
- mutate CRM stage as analytics;
- become attribution/conversion truth.

WhatsApp MARKETING execution remains outside Phase 9B. Existing WHATSAPP_SERVICE boundaries remain unchanged. Provider/campaign execution belongs to Phase 9C and production activation remains Phase 10 gated.
<!-- PHASE_9B_ARCHITECTURE_FREEZE_END -->
