# CRM 2C — Sales Playbook + Cadences (Design + Owner Policy Lock)

**Document status:** DESIGN / POLICY-LOCK ONLY — no implementation authorized
**Repository:** quickfurno-maker/ONEDECORE
**Branch:** `crm-2c-sales-playbook-cadences`
**Baseline audited:** protected `main` @ `86692f3c4fd07f4e3795693c2f2480611f07c0f0`
**Managed migration tip at audit:** `20260829140000_crm_assignment_first_contact_automation.sql` (44 migrations)
**Parent roadmap:** [CRM 2.0 Roadmap](./crm-2.0-roadmap.md) §5 "CRM 2C — Sales Playbook + Cadences"
**Companion:** [CRM 2A design](./crm-2a-follow-up-control-plane-design.md), [ADR-0019](../ADR/ADR-0019-five-role-crm-authorization-model.md)

Scope of CRM 2C per approved roadmap, verbatim: *"Stage gates at transition RPC layer; cadences with stop conditions; no bypass of WhatsApp governance."* Nothing beyond that is in scope.

---

## A. Baseline audit (verified evidence only)

### A.1 Lead stage graph and every allowed manual transition

Stage vocabulary — `chk_leads_status`, `supabase/migrations/20260730184426_crm_identity_core_foundation.sql:218`:
`new, assigned, contacted, qualified, consultation_scheduled, proposal_sent, negotiation, closed_won, closed_lost, on_hold`.

Mirrored in app contract `src/features/crm/contracts/lead-stages.ts:12` (`LEAD_STAGE_CODES`, `LEAD_STAGE_TRANSITIONS`).

Manual transition authority — `private.transition_lead_status_impl`, `20260730184426_crm_identity_core_foundation.sql:1022`:

| From | Allowed manual targets | Evidence |
|---|---|---|
| `new` | `closed_lost`, `on_hold` | line 1100 (`v_allowed` case); on-hold branch line 1088 |
| `assigned` | `contacted`, `closed_lost`, `on_hold` | line 1101 |
| `contacted` | `qualified`, `closed_lost`, `on_hold` | line 1102 |
| `qualified` | `consultation_scheduled`, `closed_lost`, `on_hold` | line 1103 |
| `consultation_scheduled` | `proposal_sent`, `closed_lost`, `on_hold` | line 1104 |
| `proposal_sent` | `negotiation`, `closed_lost`, `on_hold` | line 1105 |
| `negotiation` | `closed_lost`, `on_hold` | line 1106 |
| `on_hold` | exactly the stage returned by `private.crm_resolve_on_hold_resume_stage(on_hold_previous_status, assigned_to)` | lines 1070–1086 |
| `closed_won` / `closed_lost` | none — `'Terminal lead status cannot be changed in Phase 5B'` | line 1068 |

Hard rejections inside the same function, before graph evaluation:
- `p_new_status = 'closed_won'` → `CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE` (line 1047).
- `p_new_status in ('new','assigned')` while `v_old <> 'on_hold'` → `'Status % must be changed via assign_lead only'` (line 1063).
- `public.authorize('leads.transition')` required (line 1042); `private.crm_can_mutate_lead(p_lead_id)` required (line 1057).

`site_visit_scheduled` is **not** a stage. The legacy value list at `20260729162245_lead_intake_data_plane.sql:208` was superseded at `20260730184426:217`.

### A.2 Assignment-owned transitions

`new` and `assigned` only. Owned by `private.assign_lead_impl` (current definition `20260829140000_crm_assignment_first_contact_automation.sql:290`), which sets
`status = case when p_assignee_id is not null and status='new' then 'assigned' when p_assignee_id is null and status='assigned' then 'new' else status end`.
Reinforced by `chk_leads_status_assignment_invariant` (`20260730184426:233`) and by the app constants `ASSIGNMENT_OWNED_STAGES` / `PHASE_5B_BLOCKED_TARGET_STAGES` (`lead-stages.ts:33`, `:36`), enforced again in `crm-lifecycle-service.ts:47` (`rejectBlockedTargetStatus`).

### A.3 Closed Lost and On Hold behaviour

**Closed Lost** (`transition_lead_status_impl:1113`): free-text `p_reason` required, trimmed length ≥ 3, else `CLOSED_LOST_REQUIRES_REASON`. `p_closure_reason_code` validated against `public.lead_closure_reasons` where `is_active`, else falls back to code `other`. Writes `closed_lost_reason_id`, `closed_lost_note`. Terminal.

**On Hold** (`:1085`): bounded reason required. Reachable from `new, assigned, contacted, qualified, consultation_scheduled, proposal_sent, negotiation`. Writes `on_hold_previous_status`, `on_hold_reason`, `on_hold_since`. Emits `lead_events.event_type = 'lead.on_hold'`; resume emits `'lead.resumed'`. Resume target is single-valued and reconciled against assignment (`resume='new'` requires `assigned_to IS NULL`; `resume='assigned'` requires `assigned_to IS NOT NULL`).

Activity-layer On Hold semantics (`20260828140000_crm_activity_rpc_workflows.sql:1330`, `ON_HOLD` branch): any other open primary is **cancelled** (`private.cancel_open_primary_for_on_hold`, `:61`), a new `internal_task` / `'On-hold review'` primary is created with `source='on_hold_review'` owned by `leads.assigned_to`, and only then is `private.transition_lead_status_impl(..., 'on_hold', ...)` called. Manual creation of a primary on an on-hold lead is refused: `ON_HOLD_PRIMARY_RESERVED` (`:401`).

### A.4 Closed Won commercial authority

Exclusive. `private.accepted_quotation_close_won_impl(uuid, timestamptz, uuid, uuid)` — `20260813140000_commercial_quotation_finalization_delivery_acceptance.sql:1228`; `revoke all ... from public, anon, authenticated` at `:1314`. Its only caller is `public.accept_quotation_by_capability` at `:1457`. Acceptance is recorded in `public.quotation_acceptances` (`:133`; `unique(lead_id)`, `unique(quotation_id)`, `unique(quotation_version_id)`).

Both other paths refuse to manufacture it:
- `transition_lead_status_impl:1047` → `CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE`.
- `complete_lead_activity_impl:985` traps `p_resolution = 'CLOSED_WON'` before any other resolution mapping → same error.

### A.5 Canonical transition RPC / service / action and all callers

| Layer | Symbol | Location |
|---|---|---|
| DB impl (DEFINER) | `private.transition_lead_status_impl(uuid,text,text,text)` | `20260730184426:1022` |
| DB wrapper (INVOKER) | `public.transition_lead_status(uuid,text,text,text)` | `20260730184426:1455` (grant execute → `authenticated`, `:1586`) |
| Adapter | `callTransitionLeadStatus` | [crm-transition-adapters.ts:191](src/features/crm/server/crm-transition-adapters.ts#L191) |
| Service | `transitionLeadStatusForCurrentUser` | [crm-lifecycle-service.ts:101](src/features/crm/server/crm-lifecycle-service.ts#L101) |
| Server action | `transitionLeadStatusAction` | [crm-lifecycle-actions.ts:62](src/features/crm/server/crm-lifecycle-actions.ts#L62) |

UI callers of the server action — **one path only, shared by both surfaces**:
[LeadStatusTransitionPanel.tsx:41](src/features/crm/components/leads/LeadStatusTransitionPanel.tsx#L41), [LeadOnHoldDialog.tsx:23](src/features/crm/components/leads/LeadOnHoldDialog.tsx#L23), [LeadClosedLostDialog.tsx:30](src/features/crm/components/leads/LeadClosedLostDialog.tsx#L30), [CrmPipelineBoard.tsx:113](src/features/crm/components/pipeline/CrmPipelineBoard.tsx#L113).

In-database caller: `private.complete_lead_activity_impl` invokes `private.transition_lead_status_impl` at `20260828140000:1421` (on_hold) and `:1436` (closed_lost). No other callers exist. No browser path writes `public.leads` — grants from `20260730184426:1614` onward are `select` only for `authenticated`.

### A.6 Existing data that can support stage gates

| Candidate evidence | Canonical? | Exact source |
|---|---|---|
| First-contact attempt | **YES** | `public.crm_sla_clocks.first_contact_attempt_at` (`20260827140000:367`). Set **only** by `private.mark_first_contact_attempt_if_qualifying` (`20260828140000:220`) from (a) a completed `call` activity whose outcome has `closes_contact_attempt = true`, or (b) a completed `whatsapp` activity with outcome `whatsapp_sent` **and** a fully validated governed-send evidence chain. Immutable once set. A clock row exists for every lead (`20260827140000:714` postcondition asserts `clock_count = lead_count`) and clock creation is independent of SLA policy activation, so this evidence is available **while SLA remains inactive**. |
| Activity types / outcomes | **YES** | `chk_lead_follow_ups_activity_type` (`20260826120000:92`); `public.lead_activity_outcome_codes` (`:10`) |
| Consultation / site visit scheduled or held | **YES** | `public.lead_follow_ups` rows with `activity_type in ('consultation','site_visit')`, `status in ('open','completed')` |
| Quotation existence / status | **YES** | `public.quotations` (`status in ('active','archived')`); `public.quotation_versions` (`status in ('draft','finalized','archived')`, `finalized_at`, `finalized_by`) |
| Quotation **issued/sent** to client | **YES** | `public.quotation_access_grants` (`20260813140000:103`) — issued only by `public.issue_quotation_access_grant_internal` (`:903`), which requires `quotations.send`, a `finalized` version and a `ready` PDF; `revoked_at is null` = live grant; `uq_quotation_access_grants_one_active_per_version` |
| Accepted quotation | **YES** | `public.quotation_acceptances` (`20260813140000:133`) |
| Lead requirements | **YES but non-discriminating** | `leads.service_code`, `property_code`, `timeline_code` are `NOT NULL` at intake (`20260729162245`), so they are present on 100% of leads and cannot gate anything |
| Primary next action | **YES** | `lead_follow_ups.is_primary_next_action` + `uq_lead_follow_ups_one_primary_open` (`20260826120000:329`) |

### A.7 Existing activity types and structured outcomes

Types (6): `call, whatsapp, consultation, site_visit, quotation_follow_up, internal_task`.

Outcome catalogue `public.lead_activity_outcome_codes`, seeded `20260826120000:33`:
`connected, no_answer, busy, callback_requested, voicemail, not_interested` (all `closes_contact_attempt = true`, all types); `whatsapp_sent` (restricted to `whatsapp`, `closes_contact_attempt = false`); `consultation_booked` (true); `needs_manager`, `completed`, `rescheduled` (false); `quotation_sent` (restricted to `quotation_follow_up`, false).

### A.8 Existing lifecycle event types

- `public.lead_events.event_type` (`20260730184426:481`): `lead.created, lead.status_changed, lead.assigned, lead.note_added, lead.duplicate_detected, lead.consent_updated, lead.on_hold, lead.resumed`.
- `public.lead_activities.activity_type` (current allowlist, `20260829140000:9`): `note.created, follow_up.scheduled, follow_up.auto_created, follow_up.completed, follow_up.cancelled, follow_up.sla_breached, status.changed, assignment.changed, lead.manual_created, lead.bulk_imported`. Append-only, with `uq_lead_activities_dedupe (lead_id, activity_type, reference_id) where reference_id is not null`.
- `public.lead_follow_up_events.event_type` (`20260826120000:354`): `created, rescheduled, ownership_transferred, priority_changed, primary_designated, primary_cleared, completed, cancelled, outcome_recorded, reminder_changed`. Append-only via `private.forbid_append_only_mutation` triggers.

### A.9 Can activities link to quotations?

Yes. `lead_follow_ups.quotation_id` FK → `public.quotations` `on delete restrict` (`20260826120000:193`), plus same-lead integrity trigger `private.trg_lead_follow_ups_quotation_same_lead` (`:217`). Accepted by `create_lead_activity` (`p_quotation_id`) and by the `NEXT_PRIMARY` chain (`p_next_quotation_id`).

### A.10 Safe provenance for automation / cadence origin?

Partially. `lead_follow_ups.source` exists with `chk_lead_follow_ups_source in ('manual','sla_auto','completion_chain','on_hold_review','import')` (`20260826120000:176`). Values in live use: `manual` (create RPC hardcodes it, `20260828140000:432`), `completion_chain` (`:1272`), `on_hold_review` (`:1359`), `sla_auto` (first-contact automation, `20260829140000`).

There is **no** value for cadence origin and **no** column linking an activity to a cadence enrolment or step. This is the one genuine provenance gap CRM 2C must close.

### A.11 Existing cadence / sequence / playbook code or schema

**None.** `grep -rli "cadence|playbook|sequence_step"` over `src/` and `supabase/` returns only documentation (`crm-2.0-roadmap.md`, `crm-2a*`) and one unrelated hit in `src/features/legal/retention-matrix.ts`. No routes, tables, RPCs or contracts exist. Greenfield.

### A.12 Current permissions closest to cadence management / enrolment

| Permission | Why it is the closest analogue |
|---|---|
| `crm.follow_ups.manage` | The only permission that authorises creating/completing/cancelling activities. Every cadence step materialises as an activity, so enrolment is already permission-covered at the mutation level. |
| `leads.assignment_rules.manage` | Nearest *configuration-object* analogue (`super_admin` only) — the template-lifecycle precedent. |
| `crm.sla.manage` | Nearest *policy-object* analogue, `super_admin` only, added `20260827140000:11`. |
| `crm.activities.read` | Read-side analogue for activity data. |

### A.13 Five-role CRM authorization model relevant to 2C

Roles (ADR-0019): `super_admin`, `sales_manager`, `sales_executive`, `project_manager`, `designer`. Legacy retained: `management`, `sales`.

Relevant grants (`src/features/crm/contracts/permissions.ts:75`, mirroring `20260730184426`):

| Permission | super_admin | sales_manager | sales_executive | management | sales | PM / designer |
|---|---|---|---|---|---|---|
| `leads.transition` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `crm.follow_ups.manage` | ✅ | ✅ | ✅ | ✅ | ✅ | ❌ |
| `leads.read_all` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `leads.read_assigned` | ✅ | ❌ | ✅ | ❌ | ✅ | ❌ |
| `leads.assign` | ✅ | ✅ | ❌ | ✅ | ❌ | ❌ |
| `leads.assignment_rules.manage` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `crm.sla.manage` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |

Scope helpers already in place: `private.crm_can_view_lead`, `private.crm_can_mutate_lead` (`20260730184426`), `private.crm_has_broad_lead_read`, `private.crm_user_can_operate_lead(user, lead, capability)` (`20260826120000:449`), `private.crm_is_eligible_follow_up_owner`.

### A.14 WhatsApp consent / opt-out / outbound boundaries

- Consent truth: `public.consent_events`; latest event for purpose `WHATSAPP_SERVICE` resolved by `private.whatsapp_latest_consent_event_type(contact_id, purpose)` (`20260805140000:280`). A send intent is refused unless the latest event is `granted` → outcome `denied_missing_consent` (`:405–413`).
- Send-intent creation is **consent-mutation-free**: `20260805140000:609` raises `consent_mutation_forbidden` if the `consent_events` row count changed during the call.
- Outbound authority: `public.create_whatsapp_service_send_intent` → `whatsapp_send_intents` (`lifecycle_status in ('eligible','ineligible','cancelled','dispatch_pending','dispatch_bound')`) → `public.claim_whatsapp_send_intent_for_dispatch` → provider dispatch → `public.bind_whatsapp_send_intent_dispatch` → `whatsapp_provider_dispatch_attempts` + `whatsapp_messages`.
- CRM's only read of that chain is `private.validate_crm_whatsapp_send_evidence` (`20260828140000:142`), which is *evidence validation*, never sending.
- CRM read surface: [LeadDetailConsentSummary.tsx](src/features/crm/components/leads/LeadDetailConsentSummary.tsx), `consents.read` permission.

### A.15 Is any existing scheduler / worker appropriate?

**No scheduler exists and none should be added.** Verified absence of `pg_cron`, `cron.schedule`, `pg_net` and any `supabase/functions/` directory (`supabase/` contains only `config.toml`, `migrations`, `tests`). Every CRM automation to date is *synchronous and transaction-local*: the first-contact primary is created inside `assign_lead_impl`; the next primary is created inside `complete_lead_activity_impl`. Introducing a queue, cron job or worker for cadences would be the single largest unnecessary architecture change in this phase and is rejected — see §C.4.

### A.16 Next safe migration filename

Convention: `YYYYMMDDHHMMSS_snake_case_subject.sql`, forward-only (ADR-0007), one migration per implementation slice, `HHMMSS = 140000` for the day's primary CRM lane (`120000` used for a same-day second lane).

Managed tip: `20260829140000_crm_assignment_first_contact_automation.sql`.

**Next safe filename:** `supabase/migrations/20260830140000_crm_cadence_playbook_foundation.sql`
**Companion pgTAP:** `supabase/tests/database/36_crm_cadence_playbook_foundation_test.sql`

---

## B. Stage-gate design

All gates are enforced **inside `private.transition_lead_status_impl`**, after the existing authorization and graph checks and before `perform set_config('onedecore.crm_transition','1',true)`. This is the single point both the lead-detail panel and the Pipeline board reach (§A.5), so behaviour is identical by construction — no second state machine, no duplicated rule in TypeScript. The app layer may *pre-flight* a gate to render an explanation, but the pre-flight is advisory only; the RPC remains the authority.

Because `complete_lead_activity_impl` calls the same `transition_lead_status_impl`, the complete-with-next On Hold / Closed Lost paths inherit gate behaviour automatically.

### B.1 Classification of every active-stage transition

| # | Transition | Classification | Note |
|---|---|---|---|
| 1 | `* → new` / `* → assigned` | **ALREADY_CANONICAL** | Assignment-owned; refused at `:1063` |
| 2 | `* → closed_won` | **ALREADY_CANONICAL** | Refused at `:1047`; commercial authority only |
| 3 | `new → closed_lost` | **DO_NOT_GATE** | Loss must always be recordable |
| 4 | `new → on_hold` | **ALREADY_CANONICAL** | Bounded reason required |
| 5 | **`assigned → contacted`** | **RECOMMENDED_OWNER_LOCK** | Gate G1 |
| 6 | `assigned → closed_lost` | **DO_NOT_GATE** | |
| 7 | `assigned → on_hold` | **ALREADY_CANONICAL** | |
| 8 | `contacted → qualified` | **DO_NOT_GATE** | Gate G2 assessed and **REJECTED** below |
| 9 | `contacted → closed_lost` / `→ on_hold` | **DO_NOT_GATE** / **ALREADY_CANONICAL** | |
| 10 | **`qualified → consultation_scheduled`** | **RECOMMENDED_OWNER_LOCK** | Gate G3 |
| 11 | `qualified → closed_lost` / `→ on_hold` | **DO_NOT_GATE** / **ALREADY_CANONICAL** | |
| 12 | **`consultation_scheduled → proposal_sent`** | **RECOMMENDED_OWNER_LOCK** | Gate G4 |
| 13 | `consultation_scheduled → closed_lost` / `→ on_hold` | **DO_NOT_GATE** / **ALREADY_CANONICAL** | |
| 14 | `proposal_sent → negotiation` | **ALREADY_CANONICAL** | Gate G5 assessed and **REJECTED** below |
| 15 | `proposal_sent → closed_lost` / `→ on_hold` | **DO_NOT_GATE** / **ALREADY_CANONICAL** | |
| 16 | `negotiation → closed_lost` / `→ on_hold` | **DO_NOT_GATE** / **ALREADY_CANONICAL** | |
| 17 | `on_hold → <resume stage>` | **ALREADY_CANONICAL** | Single-valued resume, assignment-reconciled |

### B.2 Gate G1 — `assigned → contacted` requires first-contact evidence

- **Proposed rule:** refuse unless `crm_sla_clocks.first_contact_attempt_at IS NOT NULL` for the lead.
- **Canonical evidence checked:** `public.crm_sla_clocks.first_contact_attempt_at` (`20260827140000:367`), writable only by `private.mark_first_contact_attempt_if_qualifying` (`20260828140000:220`). No new column, no denormalised flag.
- **Typed failure:** `raise exception 'CONTACTED_REQUIRES_FIRST_CONTACT_EVIDENCE' using errcode = '22023'` → new `CrmErrorCode` `CONTACTED_REQUIRES_FIRST_CONTACT_EVIDENCE`, HTTP 422, mapped in `crm-errors.ts` alongside the existing activity tokens.
- **User-facing explanation:** *"Log a call outcome (or a governed WhatsApp send) on this lead before moving it to Contacted."*
- **Risk of blocking legitimate work:** **Moderate.** A rep who genuinely spoke to the client but recorded nothing is blocked. Mitigations: the required action is one click in the existing Complete Activity dialog; the First Contact primary activity is already auto-created on assignment (`20260829140000`); every seeded call outcome except `whatsapp_sent`/`needs_manager`/`completed`/`rescheduled` satisfies it, including `no_answer` and `voicemail` — this is an *attempt* gate, not a *connection* gate, exactly matching locked owner decision #1. Independent of SLA activation.
- **Recommendation: APPROVE.**

### B.3 Gate G2 — `contacted → qualified` requires qualification evidence

- **Proposed rule:** none viable.
- **Evidence check:** `leads.service_code`, `property_code`, `timeline_code` are `NOT NULL` on 100% of leads; `room_codes` defaults `'{}'`; `budget_comfort_code` is optional and unvalidated. There is no qualification form, no scoring column and no "qualified by" record anywhere in the schema.
- Any gate here would require either inventing a qualification artefact (new state machine / mutable flag — forbidden) or AI qualification (explicitly forbidden).
- **Recommendation: REJECT.** Classification stays **DO_NOT_GATE**.

### B.4 Gate G3 — `qualified → consultation_scheduled` requires a scheduled consultation / site visit

- **Proposed rule:** refuse unless there exists a `lead_follow_ups` row for the lead with `activity_type in ('consultation','site_visit')` and `status in ('open','completed')`.
- **Canonical evidence:** `public.lead_follow_ups` — already the single activity source of truth. `status='completed'` is included so a same-day walk-in consultation that was logged and closed before the stage move is not refused.
- **Typed failure:** `CONSULTATION_STAGE_REQUIRES_SCHEDULED_VISIT`, errcode `22023`, HTTP 422.
- **User-facing explanation:** *"Schedule the consultation or site visit as an activity first — the stage follows the appointment."*
- **Risk of blocking legitimate work:** **Low.** The stage name literally asserts the appointment exists, and creating it is the work the stage represents; CRM 2B Calendar already makes it a first-class action. Residual risk: an appointment agreed verbally and recorded only in a note.
- **Recommendation: APPROVE.**

### B.5 Gate G4 — `consultation_scheduled → proposal_sent` requires issued-quotation evidence

- **Proposed rule:** refuse unless there exists `quotation_access_grants g` join `quotation_versions v on v.id = g.quotation_version_id` join `quotations q on q.id = v.quotation_id` where `q.lead_id = <lead>`, `v.status = 'finalized'`, `g.revoked_at is null`.
- **Canonical evidence:** grants are issued only through `public.issue_quotation_access_grant_internal` (`20260813140000:903`), which itself requires `quotations.send`, `status='finalized'` and a `ready` PDF (`PDF_NOT_READY`). This is the strongest "the client can actually see a proposal" evidence in the system. `quotation_versions.status='finalized'` alone is **insufficient** — finalisation is an internal freeze, not a send.
- **Typed failure:** `PROPOSAL_SENT_REQUIRES_ISSUED_QUOTATION`, errcode `22023`, HTTP 422.
- **User-facing explanation:** *"Finalize and send the quotation to the client before moving this lead to Proposal Sent."*
- **Risk of blocking legitimate work:** **Moderate–high, and asymmetric.** A proposal delivered outside the platform (printed, emailed manually, hand-carried) has no grant and would be blocked. Counter-argument: ADR-0022 makes the controlled send path the *only* authoritative delivery route in V1, and `proposal_sent` is the stage that later drives conversion reporting; allowing it without send evidence makes CRM 2E analytics unauditable. If the owner rejects this gate, the honest fallback is a weaker gate requiring only a `finalized` version, or no gate at all — **not** a manual override flag.
- **Recommendation: APPROVE** (owner decision D1 also offers the weaker `finalized`-only variant and the no-gate variant).

### B.6 Gate G5 — `negotiation` requires prior proposal evidence

- **Proposed rule:** none needed.
- **Evidence:** `negotiation` has exactly one inbound edge, `proposal_sent → negotiation` (`transition_lead_status_impl:1105`). If G4 is approved, negotiation inherits proposal evidence transitively. A second identical check at the negotiation edge would be duplicated policy with zero added protection and one more place to drift.
- **Recommendation: REJECT** (redundant). Classification **ALREADY_CANONICAL**.

### B.7 Hard rules — compliance statement

| Hard rule | How this design satisfies it |
|---|---|
| Server-side inside / reachable from canonical transition authority | All gates live inside `private.transition_lead_status_impl`; nothing is enforced only in TypeScript |
| Same behaviour from lead detail and Pipeline | Both surfaces reach the RPC through the single `transitionLeadStatusAction` → `transitionLeadStatusForCurrentUser` → `callTransitionLeadStatus` path (§A.5) |
| No second state machine | The graph `case` expression is untouched; gates are additional predicates on an *already-approved* edge, never new edges |
| No denormalised mutable gate flags | Every gate reads existing canonical rows (`crm_sla_clocks`, `lead_follow_ups`, `quotation_access_grants`). Zero new columns on `leads` |
| No AI qualification | G2 rejected outright |
| Closed Won cannot be manufactured | Untouched; `:1047` and `complete_lead_activity_impl:985` both stand |
| Assignment-owned transitions remain protected | `:1063` untouched; no gate applies to `new`/`assigned` |
| Failure atomicity | Gates raise before `set_config('onedecore.crm_transition','1')` and before any `update public.leads`, so a refused transition performs no partial mutation |

---

## C. Cadence model

**Product principle (binding):** a cadence guides *human* sales follow-up by scheduling canonical CRM Activities on `lead_follow_ups`. It is not marketing automation. It never sends anything.

### C.1 Cadence template

`crm_cadence_templates` — minimal fields: `name`, optional `description`, `status`, audit columns.

Lifecycle: `draft → published → archived`.
- `draft`: steps freely editable; not enrollable.
- `published`: steps **frozen** by trigger (mirrors `public.prevent_finalized_quotation_mutation`, `20260813140000:199`); enrollable. Editing a published template = clone to a new draft (mirrors `public.create_quotation_revision`).
- `archived`: not enrollable; existing enrolments continue unaffected. No deletion — history is preserved (ADR-0019 append-only discipline).

Publishing requires ≥ 1 step, checked in the publish RPC rather than as a table constraint.

### C.2 Ordered cadence steps

`crm_cadence_steps`, unique on `(template_id, step_order)`:

| Field | Type / rule | Canonical basis |
|---|---|---|
| `step_order` | `smallint`, 1..50, contiguous from 1 (validated at publish) | — |
| `delay_hours` | `integer`, 0..2160 (90 days). Step 1 = offset from enrolment; step *n* = offset from completion of step *n−1* | matches progression model B |
| `activity_type` | same 6 values as `chk_lead_follow_ups_activity_type` | `20260826120000:92` |
| `title` | 1..120 chars | mirrors `chk_lead_follow_ups_title` |
| `priority` | `low/normal/high/urgent` | mirrors `chk_lead_follow_ups_priority` |
| `duration_minutes` | null or 1..1440 | mirrors `chk_lead_follow_ups_duration_minutes` |
| `reminder_offset_minutes` | null or ≥ 0; materialises as `reminder_at = due_at - offset`, always ≤ `due_at` | mirrors `chk_lead_follow_ups_reminder_at` |
| primary/secondary | **not a column in MVP** — every cadence step is the primary next action (see D10) | preserves `uq_lead_follow_ups_one_primary_open` trivially |

Deliberately absent: branching, conditions, channel templates, message bodies, JSON DSL.

### C.3 Lead enrolment

- **Manual only in MVP.** No automatic stage-triggered enrolment (see D9).
- Authorisation: enrolment creates an activity, so it requires `crm.follow_ups.manage` **and** `private.crm_can_mutate_lead(lead_id)`. A `sales_executive` can therefore enrol only their own assigned leads; a `sales_manager` / `super_admin` (broad read) can enrol any lead — exactly the CRM 2A owner-aware rule, reused rather than re-invented.
- Owner of every materialised step = `leads.assigned_to` (identical to the `NEXT_PRIMARY` and `on_hold_review` chains, `20260828140000:1256`), validated with `private.crm_is_eligible_follow_up_owner` + `private.crm_user_can_operate_lead`.
- **One active enrolment per lead** (see D5), enforced by partial unique index.
- Refused when: the lead is terminal; the lead is `on_hold`; the lead is unassigned; the template is not `published`; an active/paused enrolment already exists.

### C.4 Progression model — comparison and recommendation

| Option | Mechanism | Assessment |
|---|---|---|
| **A. Materialise all steps upfront** | Enrolment inserts every step as a `lead_follow_ups` row | **Rejected.** Only one may be primary, so the rest sit open-but-secondary and pollute My Day, Calendar and the Pipeline open-activity count. Rescheduling one step invalidates every downstream due date. Stop conditions must then bulk-cancel N rows. Directly contradicts "no parallel task queue". |
| **B. Materialise one step at a time on completion** | Enrolment creates step 1 as primary; completing a cadence activity creates step *n+1* as the new primary in the same transaction | **Recommended.** Exactly one open row per enrolment at all times, so the primary-next-action invariant holds by construction. Reuses `complete_lead_activity_impl`'s existing chain machinery and its single `v_now` / lock discipline. Stop conditions are evaluated at the one moment progression happens. Zero new infrastructure. Cost: due dates are relative to completion rather than absolute from enrolment — which is the correct semantic for human follow-up anyway. |
| **C. Background scheduler** | cron/worker materialises steps on a timer | **Rejected.** No `pg_cron`, no `pg_net`, no edge functions exist (§A.15). Adds an availability dependency, a second write path into `lead_follow_ups` outside a user transaction, retry/idempotency surface, and a new failure mode for the primary invariant. Grossly disproportionate for a template of ≤ 50 human tasks. |

**Recommendation: Option B.**

Concretely: `complete_lead_activity_impl` gains one new resolution value, `CADENCE_NEXT`. When the completed activity carries `cadence_enrollment_id`, `CADENCE_NEXT` derives the next step from the enrolment instead of from `p_next_*` parameters, computes `due_at = v_now + step.delay_hours`, and inserts it with `source='cadence'`. When the cadence is exhausted or a stop condition fires, `CADENCE_NEXT` is refused and the rep must supply `NEXT_PRIMARY` / `ON_HOLD` / `CLOSED_LOST` as today — so `NEXT_ACTION_REQUIRED` still guarantees the invariant.

### C.5 Stop conditions

**Mandatory (not configurable):**

| Condition | Canonical evidence | Behaviour |
|---|---|---|
| Closed Won | `leads.status = 'closed_won'` (reachable only via `accepted_quotation_close_won_impl`) | enrolment → `completed`; no further steps |
| Accepted quotation | `public.quotation_acceptances` row for the lead | subsumed by Closed Won in the same transaction — **no separate check**; recording it twice would be duplicated truth |
| Closed Lost | `leads.status = 'closed_lost'` | enrolment → `stopped` (`reason='lead_closed_lost'`) |
| Lead inaccessible / owner ineligible | `private.crm_user_can_operate_lead(assigned_to, lead, 'crm.follow_ups.manage')` false, or `assigned_to is null` | enrolment → `stopped` (`reason='owner_not_operable'`); no orphan activity is created |
| Template archived **and** steps exhausted | `crm_cadence_templates.status` | natural completion only; archiving never mid-stops a live enrolment |

**Configurable (owner-locked at template level):**

| Condition | Evidence | Default recommendation |
|---|---|---|
| On Hold | `leads.status='on_hold'` | **Pause** (D6). The `on_hold_review` primary already replaces the queue; resume re-materialises the current step |
| Reassignment | `assign_lead_impl` | **Continue, transferred** (D7) — reuses `private.sync_open_activities_on_assignment` (`20260829140000:205`) unchanged |
| Stage reached | `leads.status` reaches a template-configured `stop_at_stage` | Optional per template; default null |

**Assessed and excluded from MVP:**

- **Customer response.** Canonical evidence *does* exist (`whatsapp_messages.direction='inbound'` on a `whatsapp_conversations` row with `lead_id`). But under pull-based progression it could only be evaluated at completion time, which delivers the opposite of the expected semantics ("stop the moment they reply"). Honouring it properly requires polling — i.e. option C. **Deferred**; surfaced in the UI as an indicator instead.
- **Consent / STOP.** `private.whatsapp_latest_consent_event_type` is canonical, but CRM 2C sends nothing, so a WhatsApp cadence step is an internal reminder to a human who is separately blocked from sending by the send-intent consent gate (`20260805140000:405`). Adding a consent stop here would duplicate a control that already exists at the only place it matters. Recommend: display consent state on the step; do not stop the cadence.

### C.6 Interaction with complete-with-next and stage transitions

- `CADENCE_NEXT` is a peer of the existing `NEXT_PRIMARY` / `ON_HOLD` / `CLOSED_LOST` / `NONE` resolutions inside the *same* function and the *same* transaction. No new completion path.
- `CLOSED_WON` remains trapped at `complete_lead_activity_impl:985`.
- Choosing `ON_HOLD` while enrolled: existing code cancels the open primary and creates the `on_hold_review` primary; the enrolment is marked `paused` in the same transaction.
- Choosing `CLOSED_LOST`: existing code clears open primaries; the enrolment is `stopped`.
- Choosing `NEXT_PRIMARY` manually while enrolled: the manual activity becomes the primary and the enrolment is **stopped** with `reason='manual_override'` — a rep who takes manual control is not silently re-queued later.
- Stage transitions via `transition_lead_status` do not themselves advance or create cadence steps. The only interaction is the configured `stop_at_stage` check, evaluated when the next step would be materialised.

### C.7 Reassignment

No new rules. `private.sync_open_activities_on_assignment` (`20260829140000:205`) already transfers the open primary to the new assignee and re-homes secondaries whose owner fails `crm_user_can_operate_lead`. A cadence step is an ordinary primary activity, so it is transferred by existing code with an `ownership_transferred` audit row. Future steps take their owner from `leads.assigned_to` at materialisation time, so they follow automatically. **Zero new reassignment logic.**

### C.8 Smallest necessary enrolment lifecycle

`active → paused → active` (On Hold pause/resume) and terminal `completed | stopped`.

`stop_reason` code set: `lead_closed_won, lead_closed_lost, owner_not_operable, stage_reached, manual_override, cancelled_by_user`.

### C.9 Invariant guarantee

**NO OPEN LEAD WITHOUT A PRIMARY NEXT ACTION** is preserved because:
1. Enrolment creates step 1 as primary in the same transaction that clears any prior primary (reusing `private.clear_open_primary_for_lead`).
2. Every completion of a cadence activity must resolve to `CADENCE_NEXT`, `NEXT_PRIMARY`, `ON_HOLD` or `CLOSED_LOST`; `NONE` remains refused with `NEXT_ACTION_REQUIRED` for a primary.
3. When a stop condition fires, `CADENCE_NEXT` is **refused** rather than silently ending — the rep must supply a real next action or a terminal resolution.
4. Cancelling an enrolment never cancels its currently open activity; the activity stays open and primary.
5. Steps are never materialised outside a user transaction, so `uq_lead_follow_ups_one_primary_open` is the only arbiter and can never be raced by a background writer.

---

## D. UX design

**Navigation.** Add `Cadences` as a **secondary/admin** link in [CrmNav.tsx](src/features/crm/components/shell/CrmNav.tsx), permission-gated exactly like `Assignment Rules` (the `showAssignmentRules` pattern). Primary nav (`My Day | Leads | Pipeline | Calendar | Overview`) is unchanged — matching roadmap §4, which places Cadences in the Settings/admin column.

**`/admin/crm/cadences`** — list: name, status chip (Draft / Published / Archived), step count, **active enrolment count** (one bounded aggregate, nothing more), last updated. No charts, no funnel, no conversion analytics.

**`/admin/crm/cadences/new` and `/admin/crm/cadences/[cadenceId]`** — draft editor: name, description, ordered step editor (add / remove / reorder; per step: delay, activity type, title, priority, optional duration and reminder). Published templates render read-only with a **Duplicate to draft** action. Publish and Archive are explicit confirmed actions.

**Lead detail** — a compact Cadence block inside the existing activity workspace ([LeadActivityWorkspace.tsx](src/features/crm/components/activities/LeadActivityWorkspace.tsx)): current cadence name + step *n* of *m*, the upcoming step, `Enroll` / `Pause` / `Resume` / `Cancel`, and a short enrolment history. When not enrolled and eligible, a single `Enroll in cadence` control.

**My Day and Calendar** — **no change required**. Cadence activities are ordinary `lead_follow_ups` rows, so `get_crm_my_day` (`20260829120000:9`) and `fetchCrmCalendarEvents` pick them up automatically. A small "Cadence" chip on the activity row is the entire visual delta. **There is no separate cadence task queue.**

**Pipeline** — one small indicator on `PipelineLeadCard` only if genuinely useful; the recommendation is a single dot/label "In cadence", no counts, and no extra query if it can ride the existing card projection. If it cannot, **omit it** rather than add a query.

---

## E. Data model

Naming conventions verified against the repo: `snake_case`, plural table names, `public` schema for tables, `private` schema for `SECURITY DEFINER` impls with `public` `SECURITY INVOKER` wrappers, `chk_<table>_<column>` constraints, `uq_`/`idx_` index prefixes, `revoke all ... from public, anon, authenticated` followed by narrow `grant`s, RLS on every table, append-only audit via `private.forbid_append_only_mutation`.

### E.1 `public.crm_cadence_templates`

- **Purpose:** the reusable playbook definition.
- **Key columns:** `id uuid pk default gen_random_uuid()`, `name text not null`, `description text`, `status text not null default 'draft'`, `created_by uuid not null references profiles(id) on delete restrict`, `published_at timestamptz`, `published_by uuid references profiles(id) on delete set null`, `archived_at timestamptz`, `archived_by uuid`, `created_at`, `updated_at`.
- **Constraints:** `chk_..._status check (status in ('draft','published','archived'))`; `chk_..._name check (length(trim(name)) between 2 and 120)`; `chk_..._description` (null or ≤ 500); `chk_..._publish_stamp check ((status='draft' and published_at is null) or (status in ('published','archived') and published_at is not null))`.
- **Indexes:** `uq_crm_cadence_templates_name_active` on `(lower(name)) where status <> 'archived'`; `idx_crm_cadence_templates_status` on `(status, name)`.
- **FKs:** `created_by`, `published_by`, `archived_by` → `public.profiles`.
- **RLS:** enabled. `select` policy: `authorize('crm.follow_ups.manage') or authorize('crm.cadences.manage') or authorize('crm.activities.read')`. No `insert/update/delete` policies — mutation exclusively through `SECURITY DEFINER` RPCs.
- **Grants:** `revoke all from public, anon, authenticated`; `grant select to authenticated`.
- **Lifecycle:** draft → published → archived. Never deleted.
- **Audit:** publish/archive stamped on the row; no separate table needed (each event happens at most once).

### E.2 `public.crm_cadence_steps`

- **Purpose:** the ordered human tasks a template schedules.
- **Key columns:** `id`, `template_id uuid not null references crm_cadence_templates(id) on delete cascade`, `step_order smallint not null`, `delay_hours integer not null`, `activity_type text not null`, `title text not null`, `priority text not null default 'normal'`, `duration_minutes smallint`, `reminder_offset_minutes integer`, `created_at`, `updated_at`.
- **Constraints:** `chk_..._step_order check (step_order between 1 and 50)`; `chk_..._delay_hours check (delay_hours between 0 and 2160)`; `chk_..._activity_type` (identical 6-value list to `chk_lead_follow_ups_activity_type`); `chk_..._title check (length(trim(title)) between 1 and 120)`; `chk_..._priority`; `chk_..._duration_minutes check (duration_minutes is null or duration_minutes between 1 and 1440)`; `chk_..._reminder_offset check (reminder_offset_minutes is null or reminder_offset_minutes between 0 and 10080)`.
- **Indexes:** `uq_crm_cadence_steps_order unique (template_id, step_order)`.
- **Immutability:** `before insert/update/delete` trigger refusing any change when the parent template `status <> 'draft'` — the same pattern as `public.prevent_finalized_quotation_mutation`.
- **RLS / grants:** as E.1.
- **Audit:** frozen at publish; content is immutable thereafter, so per-row audit is unnecessary.

### E.3 `public.crm_lead_cadence_enrollments`

- **Purpose:** binds one lead to one published template and records progress.
- **Key columns:** `id`, `lead_id uuid not null references leads(id) on delete restrict`, `template_id uuid not null references crm_cadence_templates(id) on delete restrict`, `status text not null default 'active'`, `current_step_order smallint`, `last_step_order smallint`, `stop_reason text`, `enrolled_by uuid not null references profiles(id) on delete restrict`, `enrolled_at timestamptz not null default now()`, `paused_at`, `completed_at`, `stopped_at`, `created_at`, `updated_at`.
- **Constraints:** `chk_..._status check (status in ('active','paused','completed','stopped'))`; `chk_..._stop_reason check (stop_reason is null or stop_reason in ('lead_closed_won','lead_closed_lost','owner_not_operable','stage_reached','manual_override','cancelled_by_user'))`; `chk_..._terminal_stamp` (a `stopped` row has `stopped_at` and `stop_reason`; a `completed` row has `completed_at`).
- **Indexes:** `uq_crm_lead_cadence_enrollments_one_live unique (lead_id) where status in ('active','paused')` — the enforcement point for "one active cadence per lead"; `idx_crm_lead_cadence_enrollments_template on (template_id) where status in ('active','paused')` for the list-page usage count; `idx_..._lead_created on (lead_id, created_at desc)`.
- **RLS:** `select` policy scoped by lead visibility, identical in shape to `lead_follow_up_events_select`: `exists (select 1 from public.leads l where l.id = ...lead_id and (select private.crm_can_view_lead(l.assigned_to)))`.
- **Grants:** `grant select to authenticated`; no DML grants.
- **Lifecycle:** §C.8.
- **Audit:** E.4 plus `lead_activities` summaries.

### E.4 `public.crm_cadence_enrollment_events` — **required, not optional**

Existing audit mechanisms are insufficient, verified:
- `lead_follow_up_events.follow_up_id` is `not null` and FK-bound to a follow-up row, so enrolment-level events (enrol, pause, resume, stop) have no valid row to attach to.
- `lead_activities` carries `uq_lead_activities_dedupe (lead_id, activity_type, reference_id) where reference_id is not null`, which makes a *repeatable* event such as pause → resume → pause on the same enrolment id a unique violation. Emitting it with `reference_id = null` to dodge the index would deliberately weaken timeline linkage.

- **Purpose:** append-only enrolment lifecycle audit.
- **Key columns:** `id`, `enrollment_id uuid not null references crm_lead_cadence_enrollments(id) on delete restrict`, `lead_id uuid not null references leads(id) on delete restrict`, `actor_id uuid references profiles(id) on delete set null`, `event_type text not null`, `previous_values jsonb not null default '{}'`, `new_values jsonb not null default '{}'`, `reason_code text`, `created_at timestamptz not null default now()`.
- **Constraints:** `chk_..._event_type check (event_type in ('enrolled','step_materialized','paused','resumed','completed','stopped'))`; jsonb object + `pg_column_size <= 2048` checks copied from `lead_follow_up_events`.
- **Indexes:** `idx_..._enrollment_created (enrollment_id, created_at desc)`; `idx_..._lead_created (lead_id, created_at desc)`.
- **Triggers:** same-lead integrity trigger (mirrors `private.trg_lead_follow_up_events_same_lead`); `before update` and `before delete` → `private.forbid_append_only_mutation`.
- **RLS / grants:** lead-visibility `select` only.

### E.5 Provenance on `public.lead_follow_ups` (minimal, additive)

- Extend `chk_lead_follow_ups_source` with `'cadence'` (drop-and-recreate, forward-only — the established pattern, used four times for `chk_lead_activities_type`).
- Add `cadence_enrollment_id uuid references crm_lead_cadence_enrollments(id) on delete restrict`.
- Add `cadence_step_id uuid references crm_cadence_steps(id) on delete restrict`.
- `chk_lead_follow_ups_cadence_provenance check ((cadence_enrollment_id is null and cadence_step_id is null and source <> 'cadence') or (cadence_enrollment_id is not null and cadence_step_id is not null and source = 'cadence'))`.
- `uq_lead_follow_ups_cadence_step unique (cadence_enrollment_id, cadence_step_id) where cadence_enrollment_id is not null` — gives **replay idempotency** for free: a step can be materialised at most once per enrolment.
- `idx_lead_follow_ups_cadence_open on (cadence_enrollment_id) where status = 'open'`.

These are immutable provenance columns, not mutable gate flags, and they live on the canonical activity row — not on `leads`.

### E.6 `public.lead_activities` allowlist extension

Add `cadence.enrolled`, `cadence.completed`, `cadence.stopped` (each at most once per enrolment, so dedupe-safe with `reference_id = enrollment_id`). Pause/resume are **not** added — they are repeatable and live in `crm_cadence_enrollment_events`.

### E.7 Explicitly avoided

No JSON workflow DSL. No generic rule builder. No BPMN. No cron/queue/worker. No parallel task table. No denormalised cadence flags on `public.leads`.

---

## F. Permissions

**Smallest sufficient set: one new permission.**

Proposed: **`crm.cadences.manage`** — template lifecycle (create/edit draft, publish, archive). Enrolment, pause, resume and cancel deliberately reuse **`crm.follow_ups.manage`** + `private.crm_can_mutate_lead(lead_id)`, because those operations only create or stop canonical activities on a lead the actor may already mutate. Introducing a second enrolment permission would add a role-matrix axis with no security gain.

| Capability | super_admin | sales_manager | sales_executive | project_manager | designer | Enforced by |
|---|---|---|---|---|---|---|
| View cadence templates | ✅ | ✅ | ✅ | ❌ | ❌ | RLS select on `crm_cadence_templates` |
| Create / edit drafts | ✅ | **D3** | ❌ | ❌ | ❌ | `crm.cadences.manage` |
| Publish / archive | ✅ | **D3** | ❌ | ❌ | ❌ | `crm.cadences.manage` (or `crm.cadences.publish` if D3 chooses the split) |
| Enrol own assigned lead | ✅ | ✅ | ✅ | ❌ | ❌ | `crm.follow_ups.manage` + `crm_can_mutate_lead` |
| Enrol team / any lead | ✅ | ✅ | ❌ | ❌ | ❌ | `crm.follow_ups.manage` + `crm_has_broad_lead_read` |
| Pause / cancel enrolment | ✅ | ✅ | ✅ (own) | ❌ | ❌ | same as enrol |
| View cadence audit | ✅ | ✅ | ✅ (own leads) | ❌ | ❌ | RLS via `crm_can_view_lead` |
| Perform gated transitions | ✅ | ✅ | ✅ (own) | ❌ | ❌ | `leads.transition` + `crm_can_mutate_lead` + gates B.2 / B.4 / B.5 |

`project_manager` and `designer` hold no CRM lead permissions at all (`permissions.ts:154`), so they are excluded everywhere by existing rules.

---

## G. WhatsApp governance

**What CRM can currently read:** conversation/message read model under `whatsapp.inbox.read`; consent state on lead detail under `consents.read` ([LeadDetailConsentSummary.tsx](src/features/crm/components/leads/LeadDetailConsentSummary.tsx)); and, for evidence validation only, `whatsapp_send_intents`, `whatsapp_messages` and `whatsapp_provider_dispatch_attempts` via `private.validate_crm_whatsapp_send_evidence` (`20260828140000:142`).

**Canonical consent / opt-out evidence:** `public.consent_events`, resolved by `private.whatsapp_latest_consent_event_type(contact_id, 'WHATSAPP_SERVICE')` (`20260805140000:280`). Anything other than `granted` blocks send-intent creation with `denied_missing_consent` (`:405`).

**Outbound authority:** `public.create_whatsapp_service_send_intent` → `public.claim_whatsapp_send_intent_for_dispatch` → provider dispatch → `public.bind_whatsapp_send_intent_dispatch` / `public.record_whatsapp_dispatch_attempt_outcome`. This chain is the *only* outbound authority and is unchanged by CRM 2C.

**What CRM 2C must never call:** `create_whatsapp_service_send_intent`, `create_quotation_whatsapp_service_send_intent`, `claim_whatsapp_send_intent_for_dispatch`, `bind_whatsapp_send_intent_dispatch`, `record_whatsapp_dispatch_attempt_outcome`, `reconcile_whatsapp_dispatch_attempt` — and it must never write `consent_events`.

**LOCK: `WHATSAPP_AUTOMATION_IN_CRM2C=NO`.**

A cadence step with `activity_type = 'whatsapp'` is an **internal human task** — a reminder for a person to open the governed inbox — and nothing else. Cadence code paths perform no send-intent creation and no consent mutation. If a human then sends through the governed path and completes the activity with `whatsapp_sent`, the pre-existing evidence chain at `complete_lead_activity_impl:1103` applies unchanged. Automated sending remains available only to a future, separately authorized phase.

---

## H. Starter playbooks — OWNER REVIEW ONLY (nothing seeded)

**Every timing below is `OWNER_POLICY_NOT_YET_LOCKED`.** No seed data is proposed for the migration; templates are created through the UI after the owner locks timings.

### H.1 New Interior Enquiry Follow-up
- **Intended stages:** `assigned` → `contacted` → `qualified`
- **Steps:**
  1. `call` — "First contact call" — priority `urgent` — delay **0 h** `OWNER_POLICY_NOT_YET_LOCKED`
  2. `whatsapp` — "Send intro + portfolio (governed inbox)" — `high` — delay **4 h** `OWNER_POLICY_NOT_YET_LOCKED`
  3. `call` — "Second attempt" — `high` — delay **24 h** `OWNER_POLICY_NOT_YET_LOCKED`
  4. `call` — "Third attempt" — `normal` — delay **72 h** `OWNER_POLICY_NOT_YET_LOCKED`
  5. `internal_task` — "Decide: qualify or close lost" — `normal` — delay **120 h** `OWNER_POLICY_NOT_YET_LOCKED`
- **Stop conditions:** mandatory set; `stop_at_stage = consultation_scheduled`
- **Rationale:** interior enquiries are high-intent but highly contested; the value is a bounded, auditable attempt ladder that ends in an explicit decision rather than silent decay.

### H.2 Consultation / Site Visit Follow-up
- **Intended stages:** `consultation_scheduled`
- **Steps:**
  1. `whatsapp` — "Confirm appointment (governed inbox)" — `high` — delay **0 h from enrolment** `OWNER_POLICY_NOT_YET_LOCKED`
  2. `internal_task` — "Prepare requirement notes and reference designs" — `normal` — delay **2 h** `OWNER_POLICY_NOT_YET_LOCKED`
  3. `call` — "Post-visit debrief call" — `high` — delay **24 h** `OWNER_POLICY_NOT_YET_LOCKED`
  4. `quotation_follow_up` — "Prepare and finalize quotation" — `high` — delay **48 h** `OWNER_POLICY_NOT_YET_LOCKED`
- **Stop conditions:** mandatory set; `stop_at_stage = proposal_sent`
- **Rationale:** the measurement/consultation visit is where interior deals are won or lost; the cadence protects the debrief and the quotation turnaround, the two steps most often dropped.
- **Note:** with progression model B, delays are relative to the previous step's completion, so a "24 h *before* the visit" reminder must be expressed as a step scheduled at enrolment. Absolute anchoring to an appointment datetime is **not** in MVP scope.

### H.3 Proposal / Quotation Follow-up
- **Intended stages:** `proposal_sent` → `negotiation`
- **Steps:**
  1. `call` — "Confirm quotation received" — `high` — delay **24 h** `OWNER_POLICY_NOT_YET_LOCKED`
  2. `call` — "Walk through scope and pricing" — `high` — delay **72 h** `OWNER_POLICY_NOT_YET_LOCKED`
  3. `whatsapp` — "Share revised options (governed inbox)" — `normal` — delay **120 h** `OWNER_POLICY_NOT_YET_LOCKED`
  4. `call` — "Decision check-in" — `high` — delay **168 h** `OWNER_POLICY_NOT_YET_LOCKED`
  5. `internal_task` — "Escalate to manager or close lost" — `normal` — delay **240 h** `OWNER_POLICY_NOT_YET_LOCKED`
- **Stop conditions:** mandatory set (Closed Won fires automatically on quotation acceptance)
- **Rationale:** post-proposal silence is the largest leak in interior sales; the cadence ends in an explicit escalate-or-close decision rather than an indefinitely open lead.

---

## I. Owner decision table

| ID | Topic | Options | Recommended | Reason | Risk if wrong | Blocks implementation |
|---|---|---|---|---|---|---|
| **D1** | Exact stage gates | (a) G1+G3+G4 (b) G1+G3 only (c) G1+G3 + weaker G4 requiring only a `finalized` version (d) no gates | **(a)** | All three read canonical evidence with zero new state; G4 on issued-grant evidence is what makes `proposal_sent` auditable for CRM 2E | Too strict → reps blocked on legitimate offline delivery and start mis-staging leads; too loose → stage data stays unverifiable | **YES** |
| **D2** | Progression model | (a) materialise all upfront (b) one step at a time on completion (c) background scheduler | **(b)** | Preserves the one-open-primary invariant by construction, reuses `complete_lead_activity_impl`, adds no infrastructure (§C.4) | (a) floods My Day/Calendar with secondary rows; (c) introduces a scheduler the platform has never needed | **YES** |
| **D3** | Template manage / publish permission | (a) `crm.cadences.manage` → super_admin only (b) super_admin + sales_manager (c) split `manage` (both) / `publish` (super_admin only) | **(b)** | Sales managers own playbook content; precedent sits between `leads.assignment_rules.manage` (super_admin) and the sales-operational surfaces — cadences are sales-operational, not commercial truth | Too tight → the owner becomes a bottleneck for every wording change; too loose → unreviewed playbooks reach the whole team | **YES** |
| **D4** | Enrolment permission | (a) reuse `crm.follow_ups.manage` + `crm_can_mutate_lead` (b) new `crm.cadences.enroll` | **(a)** | Enrolment only creates activities the actor may already create on a lead they may already mutate; a second permission adds a matrix axis with no security gain | If the owner later wants managers-only enrolment, (a) cannot express it without a migration | **YES** |
| **D5** | One active cadence vs multiple | (a) exactly one active/paused per lead (b) multiple concurrent | **(a)** | Multiple concurrent cadences produce competing claims on the single primary next action; enforced cheaply by a partial unique index | Overlapping playbooks (e.g. nurture + proposal) cannot run together; the workaround is sequential enrolment | **YES** |
| **D6** | On Hold behaviour | (a) pause, resume on lead resume (b) hard stop | **(a)** | On Hold is explicitly non-terminal and already carries its own `on_hold_review` primary; discarding cadence progress on a temporary pause loses real work | (b) forces manual re-enrolment after every hold and silently loses step position | **YES** |
| **D7** | Reassignment behaviour | (a) continue, ownership transfers with the lead (b) stop | **(a)** | Reuses `private.sync_open_activities_on_assignment` verbatim; the playbook belongs to the lead, not the rep | (b) would strand leads mid-playbook on every territory change | **YES** |
| **D8** | Starter cadence timings | (a) adopt §H as-is (b) owner-revised values (c) no starter templates | **(b)** | Timings are commercial policy, not architecture; §H values are drafting proposals only and are all marked `OWNER_POLICY_NOT_YET_LOCKED` | Wrong intervals produce either harassment or decay; both damage brand and conversion | **NO** (templates are created via UI post-ship) |
| **D9** | Automatic stage-triggered enrolment | (a) deferred — manual only in MVP (b) auto-enrol on stage entry | **(a)** | Auto-enrolment needs a trigger inside the transition path, silently creates primaries, interacts with the D1 gates and multiplies the stop-condition surface — disproportionate for MVP | Manual enrolment depends on rep discipline; adoption may be uneven at first | **YES** |
| **D10** | Primary/secondary behaviour of steps | (a) every step is primary (b) per-step primary/secondary flag | **(a)** | Guarantees the invariant with no extra logic and keeps My Day clean; a secondary step would sit open with nothing driving its completion | Cannot express "prep task alongside the call"; the rep adds that manually, as today | **YES** |

---

## J. Implementation plan (post-decision, three slices)

### CRM 2C-1 — Stage gates
- **Goal:** enforce D1's approved gates inside the canonical transition authority.
- **DB:** one migration; `create or replace private.transition_lead_status_impl` adding the approved gate predicates after the graph check and before `set_config`. No table changes, no new columns.
- **App:** new `CrmErrorCode` values + `crm-errors.ts` token mapping; user-facing copy in `crm-labels.ts`; optional advisory pre-flight so `LeadStatusTransitionPanel` and `PipelineMoveStageDialog` can disable a target with an explanation. No new server action.
- **Tests:** pgTAP per §L; app tests asserting both surfaces call the same action and that the token map is complete.
- **Dependencies:** D1.
- **Forward-only safety:** `create or replace` of an existing function; no data migration; no backfill; refusals occur before any mutation.

### CRM 2C-2 — Cadence data model + template management
- **Goal:** templates, steps, enrolments, enrolment audit, provenance columns and template lifecycle RPCs.
- **DB:** the same migration file as 2C-1 if shipped together, otherwise the next sequential file. Tables E.1–E.4; `lead_follow_ups` additions E.5; `lead_activities` allowlist E.6; permission `crm.cadences.manage` + role grants per D3; RLS, grants, triggers; `private.*_impl` + `public.*` wrappers for create/update/publish/archive and step editing.
- **App:** `src/features/crm/contracts/cadence-contracts.ts`; `src/features/crm/server/crm-cadence-{service,actions,queries,adapters}.ts`; routes `/admin/crm/cadences`, `/new`, `/[cadenceId]`; `CrmNav` secondary link; regenerate `src/types/database.generated.ts`.
- **Tests:** §L cadence auth / lifecycle / RLS blocks.
- **Dependencies:** D3, D5, D10.
- **Forward-only safety:** all new objects plus additive nullable columns and drop-and-recreate of two `check` constraints whose value sets only widen — existing rows stay valid; no backfill.

### CRM 2C-3 — Enrolment, progression and stop conditions
- **Goal:** make cadences actually run.
- **DB:** `private.enroll_lead_in_cadence_impl` plus `pause` / `resume` / `cancel` impls with `public` wrappers; `create or replace private.complete_lead_activity_impl` adding the `CADENCE_NEXT` resolution and the stop-condition evaluation.
- **App:** lead-detail cadence block; `CompleteActivityDialog` gains the cadence-next resolution; optional Pipeline indicator.
- **Tests:** §L progression, stop, On Hold, reassignment, terminal, idempotency and regression blocks.
- **Dependencies:** 2C-2, plus D2, D4, D6, D7, D9.
- **Forward-only safety:** `create or replace` on an existing function preserving every current resolution path and signature-compatible defaults; new behaviour reachable only when the completed activity carries cadence provenance.

**No new infrastructure service is introduced in any slice.**

---

## K. Migration plan (planned only — no files created)

| Slice | Planned migration filename | Planned pgTAP file |
|---|---|---|
| 2C-1 + 2C-2 (preferred: one file) | `supabase/migrations/20260830140000_crm_cadence_playbook_foundation.sql` | `supabase/tests/database/36_crm_cadence_playbook_foundation_test.sql` |
| 2C-3 | `supabase/migrations/20260831140000_crm_cadence_enrollment_progression.sql` | `supabase/tests/database/37_crm_cadence_enrollment_progression_test.sql` |

If the owner prefers gates isolated from the data model, the alternative split is `20260830120000_crm_stage_gates.sql` + `20260830140000_crm_cadence_playbook_foundation.sql`, matching the same-day `120000` / `140000` precedent set by CRM 2A-6 / 2A-7.

**Impact inventory:**
- **RLS:** four new select-only policies on `crm_cadence_templates`, `crm_cadence_steps`, `crm_lead_cadence_enrollments`, `crm_cadence_enrollment_events`. No existing policy is modified.
- **Grants:** `revoke all from public, anon, authenticated` then `grant select to authenticated` on all four tables; `grant execute` to `authenticated` on the new `private.*_impl` and `public.*` wrapper pairs, following `20260828140000:1527`.
- **Functions:** new template/enrolment impls + wrappers; `create or replace` on `private.transition_lead_status_impl` and `private.complete_lead_activity_impl` (both keep their existing signatures, so no `drop function` and no grant churn); new append-only and immutability triggers.
- **pgTAP:** files 36 (and 37); existing files 05, 31, 33 and 35 gain assertions for the new gates and the widened `source` / `lead_activities` allowlists.
- **Generated types:** `src/types/database.generated.ts` must be regenerated (new tables, new columns on `lead_follow_ups`, changed function signatures).
- **Managed apply:** **none.** No Supabase MCP `apply_migration`, no `execute_sql` against project `lpurlfmpvriyvpkujvyl`, no branch operations. Local `supabase db reset` / `supabase test db` only, at implementation time.

---

## L. Test plan

### L.1 Stage gates (pgTAP `36_…`, extending `05_…`)
1. `assigned → contacted` **succeeds** when `crm_sla_clocks.first_contact_attempt_at` is set by a qualifying completed call.
2. `assigned → contacted` **rejected** (`CONTACTED_REQUIRES_FIRST_CONTACT_EVIDENCE`) when it is null.
3. Gate evidence via governed WhatsApp send also satisfies G1.
4. `qualified → consultation_scheduled` succeeds with an open consultation activity; succeeds with a completed one; rejected with neither.
5. `consultation_scheduled → proposal_sent` succeeds with a finalized version + live grant; rejected with a finalized version and no grant; rejected when the only grant is revoked.
6. Identical behaviour from lead detail and Pipeline — app test asserting both components call `transitionLeadStatusAction`, plus a DB test that the RPC is surface-agnostic.
7. Unauthorized caller (`leads.transition` absent, or lead outside `crm_can_mutate_lead`) rejected with `42501` **before** any gate evaluation.
8. **No partial mutation:** after every rejection, `leads.status`, the `lead_events` count and the `lead_activities` count are unchanged.
9. Closed Won still refused from `transition_lead_status` and from `complete_lead_activity`.
10. On Hold from every permitted stage still succeeds and still requires a reason; gates never apply to `on_hold` or `closed_lost`.
11. `new` / `assigned` still refused as manual targets.
12. Gates never applied on the `on_hold → resume` edge.

### L.2 Cadences (pgTAP `36_…` / `37_…` + app tests)
13. Draft create/edit allowed only with `crm.cadences.manage`; publish/archive likewise; a `sales_executive` is refused.
14. Published template steps are immutable (insert / update / delete all refused).
15. Deterministic ordering: `(template_id, step_order)` unique; publish refuses a template with zero steps or a non-contiguous order.
16. Enrolment authorization: own assigned lead succeeds for an executive; another rep's lead refused; broad-read roles succeed.
17. Enrolment refused on terminal, on-hold and unassigned leads, and on non-published templates.
18. Enrolment creates exactly one activity — step 1, `source='cadence'`, `is_primary_next_action = true`, owner `= leads.assigned_to`, provenance columns populated.
19. **Primary-next-action invariant:** after enrol, after each progression, after pause, after resume, after cancel and after every stop condition — the lead has exactly one open primary or is terminal.
20. Progression: completing a cadence activity with `CADENCE_NEXT` creates step *n+1* with `due_at = completion + delay_hours`; the final step exhausts the cadence and `CADENCE_NEXT` is then refused.
21. Stop conditions: Closed Won (via quotation acceptance), Closed Lost, owner-not-operable, `stop_at_stage`, manual override — each sets the right `status` / `stop_reason` and creates no further step.
22. On Hold: completing with `ON_HOLD` pauses the enrolment, cancels the prior primary and leaves the `on_hold_review` primary; resuming the lead re-materialises the current step.
23. Reassignment: `assign_lead` transfers the open cadence primary to the new assignee with an `ownership_transferred` event; the enrolment survives; the next step is owned by the new assignee.
24. Terminal lead: enrolment refused; an existing enrolment stops without creating an activity.
25. Cancellation: enrolment → `stopped` / `cancelled_by_user`; the currently open activity **stays open and primary**.
26. RLS: an executive cannot select another rep's enrolment or enrolment events; templates are readable per §F.
27. Audit: every enrol / pause / resume / stop / complete writes `crm_cadence_enrollment_events`; the table refuses `update` and `delete`; `cadence.enrolled|completed|stopped` appear in `lead_activities` without violating `uq_lead_activities_dedupe`.
28. **WhatsApp:** a `whatsapp` cadence step creates no `whatsapp_send_intents` row, no `whatsapp_provider_dispatch_attempts` row and no `consent_events` row — asserted by before/after counts across enrol and progression.
29. **Replay / idempotency:** re-running enrolment or step materialisation cannot double-insert — `uq_lead_follow_ups_cadence_step (cadence_enrollment_id, cadence_step_id)` violation, matching the repo's idempotency-by-constraint convention.

### L.3 Regression
30. **My Day** (`get_crm_my_day`) buckets cadence activities identically to manual ones; counts unchanged for unenrolled leads.
31. **Calendar** renders cadence activities with no contract change.
32. **Pipeline** board and drag/drop behaviour unchanged except for approved gate refusals.
33. **Lead detail** activity workspace, complete-with-next, reschedule and transfer unchanged.
34. **Quotations / Closed Won** path untouched; `accepted_quotation_close_won_impl` remains the sole authority.
35. **Assignment** open-follow-up guards and unassign fail-closed discipline unchanged.
36. **SLA inactive:** `crm_sla_policies.first_contact` remains `is_active=false`, `business_hours_config` null, and every `crm_sla_clocks.sla_due_at` stays null — asserted post-migration exactly as `20260827140000:714` does.
37. **Shop OFF** and commerce/payment surfaces untouched.

---

## M. Explicit deferrals (not in CRM 2C MVP)

Automatic WhatsApp/email sending · AI playbooks, qualification or scoring · dynamic workflow builders · campaign integration · notification centre · weighted pipeline / forecasting · Google / Outlook sync · CRM 2D unified communication · CRM 2E analytics. Additionally deferred by this design: customer-response auto-stop, absolute appointment-anchored step timing, and automatic stage-triggered enrolment (D9).

---

## N. Safety flags

```
NO_CODE_IMPLEMENTED=YES
NO_MIGRATION_CREATED=YES
NO_COMMIT_PUSH_PR_MERGE=YES
NO_MANAGED_DB_APPLY=YES
NO_PRODUCTION_WRITE=YES
SHOP_REMAINS_OFF=YES
ONLINE_PAYMENTS_UNTOUCHED=YES
M38_UNTOUCHED=YES
CRM_SLA_ACTIVATION_UNTOUCHED=YES
WHATSAPP_AUTOMATION_IN_CRM2C=NO
GOOGLE_OUTLOOK_UNTOUCHED=YES
CRM_2D_2E_SCOPE_UNTOUCHED=YES
```

---

## O. Final verdict

```
CRM_2C_ARCHITECTURE_AUDITED=YES
CRM_2C_OWNER_DECISIONS_READY=YES
READY_FOR_CRM_2C_OWNER_LOCK=YES
```

Transition authority (§A.5), stage graph (§A.1), primary-next-action interaction (§C.4, §C.9), the WhatsApp boundary (§G), permissions (§F) and the data model (§E) are each resolved against exact file / function / table evidence. Nine of the ten decisions in §I block implementation and must be locked before any code is written.
