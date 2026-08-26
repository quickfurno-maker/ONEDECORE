# ONEDECORE CRM 2.0 — Product Roadmap

**Document status:** Approved (owner decisions locked 2026-08-26)  
**Baseline:** protected `main` @ `6f07e08bf349ada2cabc96145585b89506e770d8`  
**Date:** 2026-08-26  
**Companion spec:** [CRM 2A — Follow-up Control Plane](./crm-2a-follow-up-control-plane-design.md)

---

## Owner decision log

| # | Topic | Decision | Status |
| :--- | :--- | :--- | :--- |
| 1 | First-contact SLA (architecture) | **60 business minutes**; **Asia/Kolkata**; UTC; clock from **receipt**; satisfaction = **`first_contact_attempt_at`** (qualifying **attempt**, not connection); **non-retroactive `effective_from`**; fail closed until hours configured | **LOCKED** |
| 2 | Open tasks vs next action | **Multiple open activities allowed**; exactly **one primary next action** per active assigned lead | **LOCKED** |
| 3 | Reassignment | **Primary** transfers to new lead owner; **secondary** retains owner **only if `crm_user_can_operate_lead(target)`**; otherwise transfer/cancel with audit; zero inaccessible open activities | **LOCKED** |
| 4 | SLA management permission | Add **`crm.sla.manage`** — super_admin only in 2A | **LOCKED** |
| 5 | Denormalized `next_action_*` on leads | **Rejected for 2A** | **LOCKED** |
| 6 | My Day time semantics | **Asia/Kolkata** day boundaries; **Overdue = `due_at < now()`**; Due Today = remaining local day after now | **LOCKED** |
| 7 | Closed-Won authority | Exclusive to **`accepted_quotation_close_won_impl`**; complete-activity must **not** manufacture Closed-Won | **LOCKED** |

### Deployment configuration (not product-architecture locks)

| Item | Status | Notes |
| :--- | :--- | :--- |
| Exact business opening/closing times | **Requires explicit owner lock at deployment** | Migration must **not** invent arbitrary schedules. Until configured, SLA reports **policy not active/configured**. Activation is **non-retroactive**. |
| Implementation plan CRM 2A-1 | **Pending** | Must treat operating hours as deployment input before SLA evaluation goes live. |

Full rationale and implementation detail: [CRM 2A spec §19](./crm-2a-follow-up-control-plane-design.md#19-owner-decisions-locked) and [§20](./crm-2a-follow-up-control-plane-design.md#20-known-tensions--resolution-notes).

---

## 1. Core conclusion

The CRM backend is already materially stronger than the visible UX. RBAC/RLS, audited assignment and pipeline transitions, lead notes, follow-ups, source attribution, reports, quotations, and WhatsApp linkage exist in the repository. The missing layer is **daily sales execution**.

### CRM 2.0 operating rule

**No open lead without a next action.**

Every non-terminal lead should either:

1. Have a designated **primary next action** (open activity on `lead_follow_ups`),
2. Be **On Hold** with a future review activity as the primary next action, or
3. Be **Closed Won** / **Closed Lost**.

This is **not** the same as “only one open activity per lead.” Secondary activities (consultation + prep task, site visit + reminder, etc.) may coexist. The invariant applies to the **primary next action** only.

---

## 2. Current state (baseline audit summary)

Evidence reviewed at baseline `6f07e08`. See the [2A design doc](./crm-2a-follow-up-control-plane-design.md) §2 for file-level inventory.

| Area | Status at baseline |
| :--- | :--- |
| Lead pipeline stages & transition RPC | Live — `transition_lead_status`, assignment-owned `new`/`assigned` |
| Follow-ups (`lead_follow_ups`) | Live — due time, owner, free-text outcome, open/completed/cancelled |
| Follow-up RPCs | Live — `create_lead_follow_up`, `complete_lead_follow_up`, `cancel_lead_follow_up` only |
| Reschedule / activity audit | **Not implemented** |
| Activity log (`lead_activities`) | Live — append-only staff-facing stream |
| CRM workspace UI | Live — Overview, Leads, Targets, Reports, Imports, Assignment Rules |
| Pipeline board | Preview on Leads page — read-only; **retained in 2A** until 2B |
| My Day / Calendar | **Not implemented** |
| First-contact SLA | **Not implemented** |
| Primary next action / structured activities | **Not implemented** |
| Cadences / playbooks | **Not implemented** |
| Unified lead timeline (WhatsApp + quotes) | Partial — separate surfaces |
| Advanced reporting (SLA, velocity, forecast) | Partial — follow-up counts, aging, source mix |

**Latest managed CRM-related migration at baseline:** `20260825170000_crm_lead_notes_insert_privilege_repair.sql` (39 migrations total).

---

## 3. Current gaps

| Gap | Impact |
| :--- | :--- |
| No first-class **My Day** workspace | Reps start on Overview/Leads, not a task queue |
| No **CRM Calendar** | Scheduling is datetime fields on lead detail only |
| Pipeline is preview-only | No urgency ordering, stale control, or safe drag/drop *(2B)* |
| Follow-ups are minimal | No type, title, priority, primary flag, structured outcome, lifecycle audit |
| No business-window first-contact SLA | Inbound leads can sit uncontacted; assignment delay invisible |
| No strict next-action chaining | Completing a follow-up does not require the next primary action |
| No cadences/sequences | Manual follow-up discipline only |
| No notification centre | Attention limited to Overview chips + Reports |
| WhatsApp not unified on lead timeline | Platform exists; not a single sales surface |
| Reporting lacks execution metrics | No first-response SLA, time-in-stage, velocity, forecast |

---

## 4. Recommended CRM navigation

### Target navigation (full CRM 2.0)

| Primary (daily) | Secondary (Settings / admin) |
| :--- | :--- |
| **My Day** | Targets |
| Leads | Imports |
| Pipeline *(2B)* | Sources |
| Calendar *(2B)* | Assignment Rules |
| Reports | Cadences *(2C)* |
| Overview *(managers)* | SLA & business hours *(2A → Settings)* |

### CRM 2A navigation (approved)

**My Day | Leads | Overview | Reports**

- Keep existing **Leads → Pipeline preview/toggle** until CRM 2B.
- Do **not** add dedicated Pipeline or Calendar routes in 2A.
- Settings surfaces (SLA, Targets, Imports, Assignment Rules) remain behind existing/admin paths.

### Role defaults

| Role | Default landing |
| :--- | :--- |
| Sales Executive | My Day |
| Sales Manager | Overview (with team My Day entry) |
| Super Admin | Overview |

### Premium UX rules

- One screen = one decision.
- Desktop: compact tables, side drawers, minimal gold accent.
- Mobile: My Day first; large Call / WhatsApp / Complete / Reschedule controls.
- Red only for overdue/risk; green only for completion/won.
- User-facing language: **Activities** / **Next Action** (physical table remains `lead_follow_ups`).

---

## 5. Release train

### CRM 2A — Follow-up Control Plane **[BUILD FIRST — APPROVED]**

**Goal:** Make follow-up discipline the product spine.

- **My Day** with mutually exclusive **task buckets** (Overdue / Today / Upcoming) and separate **lead-attention sections** (No Next Action / New Uncontacted; managers: Unassigned / SLA Breaches)
- Structured **activities** on evolved `lead_follow_ups`: Call, WhatsApp, Consultation, Site Visit/Measurement, Quotation Follow-up, Internal Task
- **Primary next action** semantics — multiple open activities allowed; one open primary per lead
- Title, priority, duration, reminder, structured outcome, completion note, optional quotation link
- Append-only **`lead_follow_up_events`** for full activity lifecycle audit
- Business-window-aware **first-contact SLA** (60 business minutes initial target; Asia/Kolkata; **policy not active** until owner-configured business hours)
- SLA clock from **lead creation/receipt**; assignment delay visible; no silent overnight breaches
- First-contact auto-creation with safe bulk-import policy
- Atomic **complete-with-next** reusing existing pipeline transition RPCs
- On Hold: reason + review activity as new primary next action
- Manager attention for SLA breach / no-primary-next-action
- Permission **`crm.sla.manage`** (super_admin only)

**Explicitly deferred from 2A:** Calendar, dedicated Pipeline route, stale/rotting, saved views, cadences, notification centre, scoring, AI, payment/commerce changes.

→ Full specification: [crm-2a-follow-up-control-plane-design.md](./crm-2a-follow-up-control-plane-design.md)

---

### CRM 2B — Calendar + Premium Pipeline

**Calendar** — Day / Week / Month; drag reschedule via audited RPC; Google/Outlook sync later.

**Pipeline** — Dedicated `/admin/crm/pipeline`; urgency ordering; safe drag/drop via existing transition RPC; stale/rotting thresholds.

---

### CRM 2C — Sales Playbook + Cadences

Stage gates at transition RPC layer; cadences with stop conditions; no bypass of WhatsApp governance.

---

### CRM 2D — Communication + Intelligence

Unified lead timeline; lead header; quick actions; rule-based scoring; weighted pipeline.

---

### CRM 2E — Management Analytics

First-response SLA compliance, velocity, conversion, forecast, target achievement from commercial data.

---

## 6. Top five next features (priority order)

1. **My Day**
2. **No Open Lead Without a Primary Next Action**
3. **Structured Activities + Outcomes**
4. **Calendar** *(2B)*
5. **Urgency-Driven Pipeline + Stale Lead Control** *(2B)*

---

## 7. Do not overengineer

| Do | Don't |
| :--- | :--- |
| Evolve `lead_follow_ups` as the activity source of truth | Clone Salesforce or add a parallel task system |
| Enforce **primary next action**, not one total open activity | Block legitimate multi-activity workflows |
| Use business-window SLA with configurable policy | Hard-code wall-clock SLA that breaches overnight |
| Use forward-only migrations with auditable backfill | Delete historical open activities during migration |
| Keep existing stage model & transition RPC authority | Create a second pipeline state machine |
| Query/join for next-action display in 2A | Add mutable denormalized columns on `leads` |
| Internal calendar first | Make Google Calendar a hard dependency |

---

## 8. Reference patterns studied

| Product | Patterns adopted |
| :--- | :--- |
| HubSpot | Tasks, queues, reminders, sequences, scoring, calendar sync |
| Pipedrive | Activity-centric pipeline, next-activity prioritization, rotting, calendar |
| Zoho CRM | Cadences, Blueprint mandatory transition actions |
| Salesforce | Pipeline Inspection, Next Step, Days in Stage, forecast patterns |

---

## 9. Final product principle

- Every lead has an owner.
- Every open lead has a **primary next action**.
- Every primary next action has a time.
- Every completed action has an outcome.
- Every outcome creates the next primary action or moves the stage.
- Every stale/overdue lead is visible.
- Managers can measure follow-up discipline.
- Salespeople start every morning from one simple **My Day** screen.

---

## 10. Document map

| Document | Purpose |
| :--- | :--- |
| This roadmap | Full CRM 2.0 phased product plan |
| [CRM 2A design](./crm-2a-follow-up-control-plane-design.md) | Implementation-ready spec for the first slice |
| [ADR-0019](../ADR/ADR-0019-five-role-crm-authorization-model.md) | Five-role authorization model |
| [Phase 5A audit](../audits/phase-5a-crm-architecture-freeze.md) | Historical architecture freeze |
| [Phase 5E audit](../audits/phase-5e-sales-targets-reporting.md) | Reporting foundation |

---

## 11. Revision history

| Date | Change |
| :--- | :--- |
| 2026-08-26 | Initial CRM 2.0 roadmap from expert audit; 2A scoped separately |
| 2026-08-26 | Owner review: roadmap approved; decision log added; primary-next-action & business-window SLA corrections |
| 2026-08-26 | Pre-PR corrections: business hours = deployment config (no migration default schedule); reassignment authorization rules for secondary activities |
| 2026-08-26 | Final pre-merge: overdue=`now()`; Closed-Won commercial-only; owner-aware reassignment helper; SLA attempt + non-retroactive activation |
