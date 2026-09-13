# ADR-0034 — Complete WhatsApp Marketing Control Plane and CRM-Owned Conversation Access

**Status:** Accepted (WM-0 architecture freeze; docs + migration-independent TypeScript contracts + contract tests only; **no migration**; **no managed write**; **no provider call**; **production OFF**)
**Date:** September 13, 2026
**Deciders:** Business Owner, Senior Product Architect
**Depends on:** [ADR-0002](ADR-0002-supabase-source-of-truth.md), [ADR-0004](ADR-0004-crm-before-n8n-persistence.md), [ADR-0019](ADR-0019-five-role-crm-authorization-model.md), [ADR-0021](ADR-0021-groq-copilot-and-whatsapp-boundary.md), [ADR-0027](ADR-0027-phase-9a-campaign-consent-audience-approval.md), [ADR-0031](ADR-0031-phase-9c-campaign-execution-attribution-conversion-feedback.md)
**Extends (does not rewrite):** ADR-0021 (official WhatsApp boundary), ADR-0027 ("WhatsApp marketing requires later design"), ADR-0031 ("WhatsApp MARKETING deferred from 9C MVP")
**Decision register:** [DEC-0100](../10-decision-register.md)
**Master plan:** [docs/product/whatsapp-marketing-control-plane.md](../product/whatsapp-marketing-control-plane.md)

**Baseline at acceptance:** `origin/main` `9a782ad5bed148d4e0ee92b26c76193d4fe5a995` (PR #186 merge — premium WhatsApp inbox).

---

## 1. Context

ONEDECORE already holds a governed WhatsApp service channel:

- signed, idempotent Meta webhook ingestion (M18) into `whatsapp_conversations`, `whatsapp_messages`, `whatsapp_message_status_events`;
- a shared inbox whose RLS scope is the **current** CRM assignment (M19–M20, hardened by the lead link repair and the lead tombstone migration);
- durable `WHATSAPP_SERVICE` send intents, a server-only Meta adapter with an outbound kill switch, claim/bind/outcome/reconcile RPCs (M21);
- the premium inbox workspace (PR #186).

It also holds generic campaign governance: `campaigns` → `campaign_versions` → `campaign_audience_rule_versions` → append-only `campaign_approvals` (M31), and paid-ads execution in `campaign_runs` (M33/M34), whose provider CHECK is `meta_ads | google_ads`. MARKETING consent is recorded on append-only `consent_events`.

What does not exist: template sync or template sends, marketing sends of any kind, recipient queues, staff read state, opt-out handling, frequency/quiet-hour policy, click/reply attribution, automations, Flows, or Click-to-WhatsApp attribution.

The owner has decided to build a complete in-house WhatsApp environment. Built without a frozen architecture, that work would be tempted to (a) widen the service send intent into a bulk sender, (b) reuse `campaign_runs`, (c) add a conversation owner column, and (d) infer consent. This ADR forbids those shortcuts before any code exists.

## 2. Decision

### A. Provider

1. **Official Meta WhatsApp Business Platform (Cloud API) only.** No WhatsApp Web, browser automation, QR pairing or unofficial library, ever (DEC-0043 restated).
2. Template messages use official `type=template` semantics. A template is never simulated with a text send.
3. The Graph API version is configuration (`META_WHATSAPP_GRAPH_API_VERSION`), verified against current Meta documentation at the start of each phase that adds a provider capability.
4. The provider port grows through **typed, server-only capabilities** (`dispatchTemplateMessage`, `dispatchMediaMessage`, `fetchMedia`, template list/create/edit, Flow operations, health reads). No generic untyped "call Graph" method. `dispatchTextMessage` is preserved unchanged.
5. Tokens and app secrets are server-only. They never reach a client bundle, a `NEXT_PUBLIC_*` variable, a database snapshot, or a log line.

### B. CRM-owned conversation access

1. **`public.leads.assigned_to` is the only authority** for which Sales Executive may see and act on a lead-linked conversation. No `whatsapp_conversations.assigned_sales_rep` or equivalent field may be added, cached or denormalised onto a read model as authority.
2. A Sales Executive reaches **only** conversations linked to a live lead currently assigned to them. Unrelated conversations are indistinguishable from non-existent ones (no existence oracle).
3. **Reassignment is immediate by construction**: the old assignee loses access, the new assignee gains it, the conversation's lead link and history do not change, and manage scope is unaffected.
4. Unlinked and ambiguous conversations are manager / Super Admin triage only.
5. Access is enforced by authenticated RLS and `SECURITY DEFINER` predicates with `set search_path = ''`. User-facing reads never use the service role to widen staff scope, and never fetch broadly then filter in React.

### C. Service path stays non-marketing

1. `create_whatsapp_service_send_intent`, `whatsapp_send_intents` (CHECK `purpose_code = 'WHATSAPP_SERVICE'`) and `rejectMarketingPurpose` keep rejecting `MARKETING`. They are never turned into a bulk sender.
2. A one-to-one **UTILITY** template send may extend the service path (WM-2). A one-to-one **MARKETING**-category template send uses the marketing governance path, with MARKETING consent, preference, suppression and frequency checks, even in an assigned chat. **AUTHENTICATION** templates are not staff-sendable.
3. Template category is re-read at send time; Meta may recategorise an approved template.

### D. Marketing execution is separate from paid ads

1. Campaign identity, versioning, audience rules and approvals are **reused** from Phase 9A, including the database-enforced Sales Manager self-approval denial.
2. A WhatsApp campaign version has `intended_channels = ['whatsapp']` and `targeting_mode = 'direct_or_custom'`, plus a 1:1 **`whatsapp_campaign_specs`** row frozen when the version is submitted.
3. Execution lives in new tables: `whatsapp_campaign_runs`, `whatsapp_campaign_recipients`, `whatsapp_campaign_dispatch_jobs`, append-only `whatsapp_campaign_dispatch_events`, append-only `whatsapp_message_campaign_attributions`.
4. **`public.campaign_runs` and its satellites remain paid-ads only.** They are never widened to `whatsapp`.
5. A bulk campaign cannot execute without an approved version, a frozen spec, an approved immutable template snapshot, an open outbound kill switch and an open marketing-execution gate.

### E. Templates

1. The existing `public.whatsapp_templates` (M18) is extended forward-only as the registry; no competing registry.
2. Approved templates are captured as immutable, content-addressed **snapshots**. Campaign specs and one-to-one sends bind to a snapshot; the live registry is re-read only to prove the snapshot is still `APPROVED` and in the same category.
3. Provider enums are open: unknown category/status values are stored raw-safe (bounded) and are never sendable.
4. Missing, blank or invalid variables fail closed. A saved snippet is not a template and cannot bypass the template-required rule outside the 24-hour window.

### F. Consent, suppression and just-in-time eligibility

1. MARKETING consent stays in append-only `consent_events`. `WHATSAPP_SERVICE`, `SERVICE_COMMUNICATION` and consultation consent never imply MARKETING. No consent is fabricated or backfilled.
2. Suppression truth stays `contacts.status = 'do_not_contact'` and `contact_channels.status IN ('suppressed','invalid')`.
3. Preference categories (`design_inspiration`, `offers`, `project_updates`, `referral`, `educational_content`) **narrow** a MARKETING grant and are append-only evidence.
4. Every marketing recipient is re-evaluated **inside the claim transaction, immediately before the provider call**: run active, template approved and MARKETING, not already bound, contact active and not DNC, WhatsApp channel active, latest MARKETING event is `granted`, category preference allowed, variables valid, send policy configured, frequency cap not reached, quiet hours (defer, not skip).
5. **There is no override.** No role, flag or UI action sends to a DNC, suppressed, invalid, unconsented or opted-out recipient.
6. Opt-out keywords are matched as whole normalised messages (STOP, UNSUBSCRIBE, REMOVE ME, NO MARKETING, OPT OUT …), never as substrings. Opt-out is idempotent and restrictive only; a Sales Executive may record one within their scope but may never grant or clear consent.
7. Frequency caps and quiet hours are versioned configuration, not constants. An unconfigured policy fails closed. Default timezone Asia/Kolkata.

### G. Queue, idempotency and reconciliation

1. Recipients are materialised once per run with minimum necessary data and a unique `(run, contact_channel)` key.
2. Jobs are claimed with `FOR UPDATE SKIP LOCKED`, a claim TTL, bounded attempts and bounded exponential backoff.
3. A definite transient failure may retry. **An ambiguous outcome becomes `needs_reconcile` and is never automatically retried.** Resolution is by provider evidence (webhook status carrying the job correlation key where the official API supports echoing it) or an audited human decision.
4. A claimed job is never cancelled; pausing or cancelling a run stops new claims only.
5. Provider response snapshots keep an allowlist of non-secret keys.

### H. Campaign messages enter canonical history

A bound marketing send deterministically finds or creates the canonical `whatsapp_conversations` row (business phone + customer E.164, linked through the existing single lead-link writer), inserts the outbound `whatsapp_messages` evidence, and records `whatsapp_message_campaign_attributions`. The assigned salesperson therefore sees the campaign message, and any reply, in their inbox through the unchanged ownership rule.

### I. Staff read state is not provider read

Per-staff `whatsapp_conversation_staff_state` (last read message, last opened) drives Unread. Provider `read` status events drive delivery analytics. They are never merged, and staff read state is never sent to Meta. Unread, Needs Reply, Waiting on Customer, Follow-up Due and Recently Active are defined over database evidence and implemented in SQL within RLS scope.

### J. Authority matrix

| Actor | Frozen authority |
| :--- | :--- |
| Super Admin | Everything below, subject to permission; unlinked triage; settings; cancel runs; exports |
| Sales Manager / management | Broad sales conversations and unlinked triage; templates; segments; campaign drafting; approval **except own versions**; execute runs approved by someone else; pause |
| Sales Executive | Assigned-lead conversations only; service replies; approved template use in assigned chats; opt-out recording in scope; CRM actions per existing CRM permissions. **No** bulk draft/approve/execute/pause, global contacts, segments, exports, settings, or consent grant/clear |
| Project Manager / Designer | None |
| Kriti / AI | Draft assistance only; never sends, approves, or mutates authoritative state |
| n8n | Notification relay after persistence; never consent, approval, retry, attribution or delivery truth |

The full permission matrix (existing codes reused, new codes and their phases) is frozen in the master plan and in `src/features/whatsapp-marketing/contracts/capability-matrix.ts`. New codes are inserted only by their phase's migration.

### K. Module boundary

- `src/features/whatsapp/` remains the **channel core**: webhook, conversations/messages, inbox, conversation access, service send, provider port, template registry, staff read state.
- `src/features/whatsapp-marketing/` is the **marketing control plane**: specs, runs, recipients, dispatch, eligibility, preferences/policy, segments, automations, Flows, analytics, capability matrix.
- Dependency direction is one-way: `whatsapp-marketing → whatsapp`, `→ marketing`, `→ crm`. The channel core never imports the marketing control plane, so no marketing code can reach the service send path.
- Conversation components stay route-shell independent so the same governed conversation mounts later in a dedicated sales dashboard without changing access rules.

### L. Phasing

WM-0 architecture freeze → WM-1 CRM ownership + inbox completeness → WM-2 template studio + one-to-one template messaging → WM-3 contacts/consent/preferences/segments → WM-4 bulk campaign engine → WM-5 analytics/clicks/replies/conversion → WM-6 automations/Flows/CTWA → WM-7 production certification. Each phase is its own PR, its own forward-only migration where needed, and stops for review.

**Repository build is not activation.** Production Meta callback/token/outbound activation remains owner-gated (P9 in [docs/11](../11-accelerated-closeout-roadmap.md)). Every WM capability ships fail-closed.

## 3. Consequences

**Positive:** no second ownership authority; no path from marketing code to the service RPC; paid-ads run semantics unchanged; ambiguous sends cannot duplicate; consent is evidence, not assumption; the future sales dashboard is a mount, not a redesign.

**Trade-offs:** more tables than reusing `campaign_runs`; Sales Executives cannot send bulk campaigns; one-to-one marketing templates in assigned chats need MARKETING consent even when the customer is actively chatting; the marketing path cannot ship until WM-3 policy configuration exists.

**Risks carried forward:** Meta pricing/category changes, template recategorisation, per-number messaging limits and quality ratings must be observed in WM-2/WM-4 health checks; the correlation-echo mechanism for reconciliation must be verified against current official documentation in WM-4.

## 4. Explicitly not decided here

Exact column lists, RPC signatures, RLS policy text, UI layout of Template Studio / Campaigns / sales dashboard, Meta pricing handling, and n8n notification workflow content. Those are decided in the phase that implements them, inside the boundaries above.

## 5. Related

- [08 — WhatsApp & n8n Boundary](../08-whatsapp-and-n8n-boundary.md)
- [CRM + WhatsApp launch certification](../product/crm-whatsapp-launch-certification.md)
- [ADR-0027](ADR-0027-phase-9a-campaign-consent-audience-approval.md), [ADR-0031](ADR-0031-phase-9c-campaign-execution-attribution-conversion-feedback.md)
