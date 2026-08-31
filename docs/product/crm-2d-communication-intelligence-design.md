# CRM 2D — Communication + Intelligence (Design + Owner Policy Lock)

**Document status:** **OWNER-LOCKED (Q1–Q10) — IMPLEMENTATION AUTHORIZED** (locks recorded 2026-08-31)
**Repository:** quickfurno-maker/ONEDECORE
**Branch:** `crm-2d-communication-intelligence`
**Baseline audited:** protected `main` @ `5600e02dcf7eb69ad475a18d91b0f0722325fc1f`
**Managed migration tip at audit:** `20260830140000_crm_cadence_playbook_foundation.sql` (45 migrations)
**Database test ledger tip:** `supabase/tests/database/36_crm_cadence_playbook_foundation_test.sql`
**Parent roadmap:** [CRM 2.0 Roadmap](./crm-2.0-roadmap.md) §5 "CRM 2D — Communication + Intelligence"
**Companions:** [CRM 2A design](./crm-2a-follow-up-control-plane-design.md), [CRM 2C design](./crm-2c-sales-playbook-cadences-design.md), [ADR-0019](../ADR/ADR-0019-five-role-crm-authorization-model.md), [ADR-0022](../ADR/ADR-0022-v1-direct-quotation-finalization-and-send.md), [docs/07](../07-crm-and-quotation-boundary.md)

Scope of CRM 2D per approved roadmap, verbatim: *"Unified lead timeline; lead header; quick actions; rule-based scoring; weighted pipeline."* Nothing beyond that is in scope.

---

## A. Baseline identity

| Item | Value | How verified |
|---|---|---|
| Branch | `crm-2d-communication-intelligence` | `git rev-parse --abbrev-ref HEAD` |
| Branch HEAD | `5600e02dcf7eb69ad475a18d91b0f0722325fc1f` | `git rev-parse HEAD` |
| `origin/main` | `5600e02dcf7eb69ad475a18d91b0f0722325fc1f` | `git rev-parse origin/main` |
| Required baseline | `5600e02dcf7eb69ad475a18d91b0f0722325fc1f` | **MATCHES** |
| Worktree | clean | `git status --short` empty; `git diff --check` clean |
| Previous phase | CRM 2C merged via PR #115 (`485f756` → merge `5600e02`) | `git log` |

> The local `main` ref in this worktree reads `ba70a679…`. That is a stale local branch pointer inside an isolated worktree, not a baseline mismatch: `origin/main` and this branch's HEAD both equal the required commit. No stop condition is triggered by it.

**Migration surface at baseline:** 45 files in `supabase/migrations/`. CRM 2B (calendar + premium pipeline) shipped with **zero** migrations — it is pure TypeScript derivation over existing RLS-scoped reads. That precedent is central to §K.

---

## B. Current architecture inventory

### B.1 Lead detail route composition (verified against HEAD)

`src/app/admin/crm/leads/[leadId]/page.tsx` is a server component that resolves `getCrmAccessContext()` + `getLeadDetailForCurrentUser(leadId)` then fans out nine parallel reads (`page.tsx:75-95`) and renders a two-column grid:

| Surface | Component | Anchor |
|---|---|---|
| Page header (title / source / created / status badge) | `CrmPageHeader` + `LeadStatusBadge` | `page.tsx:125` |
| Stage transitions | `LeadStatusTransitionPanel` | `page.tsx:141` |
| Activities (primary next action, open, history, complete/reschedule/transfer dialogs) | `LeadActivityWorkspace` | `page.tsx:159` |
| Cadence | `LeadCadencePanel` | `page.tsx:175` |
| Intake overview | `LeadDetailOverview` | `page.tsx:183` |
| Notes | `LeadDetailNotes` | `page.tsx:184` |
| **Timeline** | `LeadDetailTimeline` | `page.tsx:187` |
| Quotation | `LeadDetailQuotationPanel` | `page.tsx:188` |
| Contact / Assignment / Source / Status summary / Consent / Marketing consent | sidebar (`xl:`) duplicated inline on mobile | `page.tsx:196-232` |

The audit brief's stated baseline is confirmed with two corrections. `LeadDetailFollowUps.tsx`, `LeadFollowUpActions.tsx`, `LeadFollowUpComposer.tsx` and `LeadNoteComposer.tsx` exist on disk but the route composes `LeadActivityWorkspace` and `LeadDetailNotes` instead — the follow-up trio is CRM 2A-superseded surface. `LeadDetailConsentSummary.tsx` exports **two** components (`LeadDetailConsentSummary`, `LeadDetailStatusSummary`).

**Mobile duplication is structural today:** Contact, Assignment, Source, Status summary, Consent and Marketing consent are each rendered twice — once in an `xl:hidden` block and once in a `hidden xl:block` aside. Any header work must not add a third copy of the same facts.

### B.2 Current timeline implementation and its three defects

`getLeadDetailForCurrentUser` (`src/features/crm/server/crm-lead-repository.ts:78-371`) builds `timeline` at `:227-250` by concatenating exactly two sources:

- `lead_activities` (`:177-183`) — fetched **only** when `context.canReadActivities`, mapped as `{ id: "activity:"+id, title: row.summary }`
- `lead_events` (`:185-189`) — fetched unconditionally, mapped as `{ id: "event:"+id, title: row.event_type }`

sorted by `occurredAt` descending with tie-break `right.id.localeCompare(left.id)` (`:248`).

**Defect 1 — raw event codes leak to the user.** `lead_events` rows render `event_type` verbatim: the UI shows `lead.status_changed`, `lead.assigned`, `lead.on_hold`, `lead.duplicate_detected`. `LeadDetailTimeline.tsx:33` prints `entry.title` unformatted. There is no label map, no icon, no category.

**Defect 2 — systematic duplication.** Every canonical CRM write emits a `lead_events` row *and* a `lead_activities` row for the same business action, in the same transaction:

| Business action | `lead_events` row | `lead_activities` row | Write site |
|---|---|---|---|
| Assignment change | `lead.assigned` | `assignment.changed` | `20260730184426:991`, `:1004` |
| Stage change | `lead.status_changed` / `lead.on_hold` / `lead.resumed` | `status.changed` | `20260730184426:1150`, `:1166` |
| Manual lead created | `lead.created` | `lead.manual_created` | `20260801140000:692`, `:709` |
| Bulk import created | `lead.created` | `lead.bulk_imported` | `20260802140000:1079`, `:1095` |
| Closed Won on acceptance | `lead.status_changed` | `status.changed` | `20260813140000:1274`, `:1289` |

A single manual lead creation with assignment therefore produces **five** timeline rows for two real events.

**Defect 3 — non-deterministic ordering on ties.** Both tables declare `occurred_at timestamptz not null default now()` (`20260730184426:449` for `lead_activities`; `lead_events` inherits from `20260729162245`). `now()` is transaction time, so every pair above has a **byte-identical** `occurred_at`. The tie-break is a descending string compare of `"event:<uuid>"` against `"activity:<uuid>"`; `"e" > "a"`, so events always sort above their own summaries, and same-prefix ties resolve on random UUID bytes. The order is stable for a given row-set but semantically arbitrary.

None of these are new to CRM 2D — they are the concrete gap CRM 2D-A must close.

### B.3 Canonical CRM authorities (unchanged, must not be duplicated)

| Concern | Authority | Location |
|---|---|---|
| Stage transitions + CRM 2C gates | `private.transition_lead_status_impl` → `public.transition_lead_status` | `20260830140000:1817+` (forward-only replacement); gates at `:1924-1956` |
| Assignment | `private.assign_lead_impl` → `public.assign_lead` | `20260829140000:290` |
| Activity lifecycle | `create_lead_activity`, `complete_lead_activity`, `reschedule_lead_activity`, `transfer_activity_ownership`, `designate_primary_next_action` | `20260828140000` |
| Closed Won | `private.accepted_quotation_close_won_impl`, reachable only via `public.accept_quotation_by_capability` | `20260813140000:1228`, `:1457` |
| Cadence lifecycle | `enroll_lead_in_cadence`, `pause/resume/cancel_lead_cadence` + template RPCs | `20260830140000` |
| WhatsApp outbound | `create_whatsapp_service_send_intent` → claim → dispatch → `bind_whatsapp_send_intent_dispatch` | `20260805140000`, `20260808140000` |
| Quotation commercial | `create_quotation_draft` … `finalize_quotation_version`, `issue_quotation_access_grant_internal`, `accept_quotation_by_capability` | `20260812140000`, `20260813140000` |
| My Day read model | `public.get_crm_my_day` (SECURITY **INVOKER** wrapper over `private.get_crm_my_day_impl`, also invoker) | `20260829120000` |
| Pipeline board read model | `fetchCrmPipelineBoard` — **TypeScript only, no SQL function** | `src/features/crm/server/crm-pipeline-queries.ts:45` |

`public.get_crm_my_day` is the house pattern for a bounded CRM read model: explicit permission gate, `private.crm_has_broad_lead_read()` scope resolution, refusal to query another owner (`20260829120000:47`), single `clock_timestamp()` capture, limits clamped to `[1,100]`, `jsonb` payload, `revoke all … from public, anon` plus `grant execute … to authenticated`. **It is SECURITY INVOKER and relies on RLS.** CRM 2D follows this exactly.

### B.4 Money and currency truth

| Fact | Value | Evidence |
|---|---|---|
| Money unit | **paise** (`bigint`) across quotations, targets, commerce | `quotation_versions.subtotal_paise` etc. |
| Currency | INR only, enforced | `chk_sales_targets_currency check (currency = 'INR')`, `20260803140000:87` |
| Quotation root cardinality | **exactly one per lead** — `lead_id uuid not null unique` | `20260812140000:37` |
| Version totals | `taxable_base_paise = subtotal_paise - discount_total_paise` (constraint-enforced) | `chk_quotation_versions_taxable_base_eq`, `20260812140000:123` |
| `grand_total_paise` | **nullable** — null until a tax profile is applied | `quotation_versions.grand_total_paise` |
| Realized revenue measure | `quotation_acceptances.taxable_base_paise`, credited to `credited_sales_executive_id` for `sales_achievement_month` | `20260813140000:133-144`, `:1441` |
| Target measure | `sales_targets.revenue_target_paise` | `20260803140000:62` |
| Formatter | `formatInrFromPaise(paise)` | `src/features/crm/contracts/sales-target-contracts.ts:159` |

**Consequence:** the only commercial measure commensurate with sales targets and achievement is **`taxable_base_paise` (ex-tax)**. A weighted pipeline built on `grand_total_paise` would not reconcile with targets and would be null for un-taxed versions.

### B.5 Explicit boundary CRM 2D must not cross

`src/features/crm/contracts/reporting-contracts.ts:1-4` declares: *"Phase 5E-B — non-commercial CRM reporting contracts. No achievement, attainment, forecast, or commercial value metrics."* Forecast and attainment belong to **CRM 2E**. CRM 2D may show weighted value on the **Pipeline** surface (an operating view) but must **not** add commercial metrics to `CrmReportingSnapshot` or the Reports route.

### B.6 Greenfield confirmation

`grep -rniE "\b(score|scoring|probability|weighted|forecast)" src/ supabase/` returns two hits, both disclaimers (`plan-state.ts:114`, `reporting-contracts.ts:3`). There is **no** existing scoring, probability, weighted-value or forecast code, schema, contract or route. CRM 2D is greenfield on the intelligence side.

---

## C. Unified timeline source map

Every candidate chronological source, audited against HEAD.

| # | Source | Order key | Lead linkage | Actor identity | Authorization to read | Mutability | Dedupe key | Include? | Category | Collapse? |
|---|---|---|---|---|---|---|---|---|---|---|
| 1 | `lead_activities` | `occurred_at` | `lead_id` FK | `actor_id` → `profiles` | RLS `lead_activities_select`: `authorize('crm.activities.read')` **AND** `crm_can_view_lead` | append-only | `(lead_id, activity_type, reference_id)` unique where `reference_id not null` | **YES — primary spine** | per `activity_type` (13 codes) | no |
| 2 | `lead_events` | `occurred_at` | `lead_id` FK | `actor_id`, `actor_type` | RLS `lead_events_select_crm_scoped`: `crm_can_view_lead` only | append-only | none (no `reference_id`) | **YES — only types with no `lead_activities` twin** | see C.2 | yes |
| 3 | `lead_follow_ups` | `due_at` / `completed_at` / `cancelled_at` | `lead_id` FK | `owner_id`, `completed_by`, `cancelled_by` | RLS: `crm_can_view_lead` | **mutable** (status/outcome updated in place) | `id` | **NO** — already rendered by `LeadActivityWorkspace`; `lead_activities.follow_up.*` carries the chronology | — | — |
| 4 | `lead_follow_up_events` | **`created_at`** (no `occurred_at`) | `lead_id` FK | `actor_id` | RLS: `crm_can_view_lead`, no extra permission | append-only | `id` | **NO for MVP** — 10 event types per activity is micro-audit already summarised by `lead_activities.follow_up.*` | — | — |
| 5 | `lead_notes` | `created_at` | `lead_id` FK | `created_by` | RLS: `crm_can_view_lead` | append-only (insert grant on `(lead_id, body)` only) | `id` | **NO** — represented by `lead_activities.note.created` via trigger `trg_lead_notes_after_insert_activity` (`20260730184426:886`), which carries `reference_id = note.id` and a 120-char excerpt | `Note` | truncated at source |
| 6 | `lead_assignment_history` | `occurred_at` | `lead_id` FK | `actor_id`, prev/new assignee | RLS: `crm_can_view_lead` | append-only | `id` | **NO** — represented by `lead_activities.assignment.changed` with `reference_id = history.id` | `Assignment` | — |
| 7 | `lead_source_touchpoints` | `occurred_at` | `lead_id` FK | `recorded_by` (nullable) | RLS: `crm_can_view_lead` | append-only | `id` | **NO for MVP** — attribution, not sales execution; already in `LeadDetailSourcePanel` | — | — |
| 8 | `consent_events` | `occurred_at` | `lead_id` (nullable) + `contact_id` | **`actor_type` only — no `actor_id`** | RLS: `authorize('consents.read')` **AND** `crm_can_view_lead` | append-only | `id` | **YES — restricted subset** (C.3) | `Consent` | one row per (purpose, channel) change |
| 9 | `crm_sla_clocks` | `first_contact_attempt_at`, `breached_at` | `lead_id` PK | none | RLS: `crm_can_view_lead` | **mutable** (one row per lead) | `lead_id` | **NO as rows — YES as header + score signals** | — | — |
| 10 | `crm_cadence_enrollment_events` | `created_at` | `lead_id` FK + consistency trigger | `actor_id` | RLS `crm_cadence_enrollment_events_select`: `crm_can_view_lead` | append-only | `id` | **NO** — `lead_activities` already carries `cadence.enrolled` / `cadence.completed` / `cadence.stopped`; `step_materialized` is visible as the activity itself | — | — |
| 11 | `quotation_events` | `occurred_at` | **`lead_id` column present** | `actor_id` not null | RLS `p_quotation_events_select`: `private.quotation_can_view(quotation_id)` = `authorize('quotations.read')` AND `crm_can_view_lead` | append-only | `id` | **YES — filtered subset** (C.4) | `Quotation` | yes — draft churn excluded |
| 12 | `quotation_versions` | `created_at`, `finalized_at` | via `quotations.lead_id` (unique) | `created_by`, `finalized_by` | `p_quotation_versions_select` | mutable while draft, frozen when finalized | `id` | **NO as rows — YES as enrichment** (version number, `taxable_base_paise`) on `quotation.*` rows | — | — |
| 13 | `quotation_access_grants` | `created_at`, `revoked_at` | via version → quotation | `created_by`, `revoked_by` | **RLS enabled with ZERO select policies for `authenticated`** (`20260813140000:125-127`) — staff cannot read it at all | mutable (`revoked_at`) | `id` | **NO directly** — use `quotation_events.capability_issued` / `capability_revoked`; live-grant state via the DEFINER helper of §K | `Quotation` | — |
| 14 | `quotation_acceptances` | `accepted_at` | `lead_id` column, `unique(lead_id)` | `accepted_by_name` (client, not staff) | `quotation_acceptances_staff_read`: `quotation_can_view` | append-only | `lead_id` | **YES — one row, terminal** | `Quotation — Accepted` | no |
| 15 | `quotation_pdf_documents` | `created_at`, `ready_at` | via version | `created_by` | `quotation_pdf_documents_staff_read` | mutable until ready | `id` | **NO** — internal artefact state | — | — |
| 16 | `whatsapp_messages` | **`provider_timestamp`** (provider clock) | via `whatsapp_conversations.lead_id` — **see C.5 BLOCKER** | none (inbound: client; outbound: `send_intent.requested_by`) | `whatsapp_messages_select_scoped` → `private.whatsapp_inbox_can_view_conversation` | append-only | `provider_message_id` (unique) | **BLOCKED — owner decision Q6** | `WhatsApp in` / `WhatsApp out` | thread-collapse |
| 17 | `whatsapp_send_intents` / `_events`, `whatsapp_provider_dispatch_attempts`, `whatsapp_message_status_events` | `created_at` / `provider_timestamp` | via conversation | `requested_by` / `actor_id` | conversation-scoped RLS | append-only | `id` | **NO** — transport detail; delivery state is denormalised onto `whatsapp_messages.latest_status` | — | — |
| 18 | `projects` / `project_events` | `occurred_at` | `projects.lead_id` (Closed-Won materialization) | varies | project-domain RLS (`can_view_project_*`), **disjoint from CRM sales roles** | append-only | `id` | **NO** — post-sale execution; a sales executive holds no project permissions, so the join would either leak or render empty | — | — |
| 19 | `campaigns` / `campaign_*` | varies | attribution only | — | campaign-domain RLS | — | — | **NO** — Phase 9B CRM attribution boundary (docs/07); already in `LeadDetailSourcePanel` | — | — |

### C.1 The dedupe rule (the core of CRM 2D-A)

**`lead_activities` is the timeline spine. `lead_events` contributes only the event types that have no `lead_activities` counterpart.**

This is not a preference — it is what the schema comment already asserts: *"Staff-facing interaction log. System/intake events remain in `lead_events`; `reference_id` links domain rows without duplicate truth."* (`20260730184426:470`). The current repository ignores that contract; CRM 2D-A restores it.

### C.2 `lead_events` inclusion decision, type by type

`chk_lead_events_type` allows 8 types (`20260730184426:481-492`).

| `lead_events.event_type` | `lead_activities` twin? | Decision |
|---|---|---|
| `lead.created` | `lead.manual_created` / `lead.bulk_imported` — **only for those two entry methods** | **INCLUDE, conditionally**: render `lead.created` only when no `lead.manual_created` / `lead.bulk_imported` activity exists. Web-planner and intake leads would otherwise have **no** timeline origin row. |
| `lead.status_changed` | `status.changed` | **EXCLUDE** |
| `lead.on_hold` | `status.changed` | **EXCLUDE** (the summary already states on-hold) |
| `lead.resumed` | `status.changed` | **EXCLUDE** |
| `lead.assigned` | `assignment.changed` | **EXCLUDE** |
| `lead.note_added` | `note.created` | **EXCLUDE** — and note that **no code path writes it**; it is an allowlist entry with no producer |
| `lead.duplicate_detected` | none | **INCLUDE** — manager-relevant, low volume |
| `lead.consent_updated` | none | **INCLUDE only when the actor holds `consents.read`** (aligned with source #8) |

`lead_events` therefore contributes at most three row kinds. Duplication is eliminated by construction, not by heuristic matching.

### C.3 `consent_events` inclusion

Include only grant/withdraw transitions a salesperson can act on (WhatsApp service and marketing purposes). `consent_events` has **no `actor_id`**, only `actor_type` — render the actor as "Client" or "System", never as a staff name. Gate the whole category on `context.canReadConsents`. Omission is silent (no "N hidden entries" counter), per §J.

### C.4 `quotation_events` inclusion

`quotation_events.event_type` has 15 values. Include the six representing client-visible or decision-grade commercial progress:

`quotation.created` · `quotation.finalized` · `quotation.capability_issued` · `quotation.capability_revoked` · `quotation.accepted` · `quotation.revision_created`

Exclude the nine editorial/internal ones (`draft_created`, `draft_updated`, `draft_archived`, `version_created`, `discount_changed`, `tax_profile_changed`, `payment_schedule_changed`, `pdf_generated`, `send_requested`) — high-frequency draft churn.

`send_requested` is deliberately excluded in favour of `capability_issued`, because CRM 2C already established that **a finalized version alone is an internal freeze, never a delivery** (`20260830140000:1945`): the live capability grant is the delivery evidence.

Enrich each included row with `version_number` and `taxable_base_paise` from `quotation_versions` — one extra keyed read, since a lead has exactly one quotation root.

### C.5 BLOCKER — WhatsApp cannot join the lead timeline at this baseline

**`whatsapp_conversations.lead_id` is never written by any code path in the repository.**

- The table declares `lead_id uuid references public.leads (id) on delete set null` with the comment *"Phase 6A does not auto-link CRM contacts/leads."* (`20260804150000:64`, `:86`).
- The only `insert into public.whatsapp_conversations` is the webhook ingest at `20260804150000:562`; its column list is `(phone_number_id, customer_e164, display_name_snapshot, last_message_at, last_inbound_at)` — neither `lead_id` nor `contact_id` is supplied, and the `on conflict … do update` at `:576` does not set them.
- The only `update public.whatsapp_conversations` is `20260808140000:574`, setting `last_message_at, updated_at` only.
- No linking RPC, server action or admin UI exists. `grep -rn "lead_id" supabase/migrations/20260804150000*.sql` returns exactly one hit: the column definition.

Three verifiable consequences:

1. **`private.whatsapp_inbox_can_view_conversation`** (`20260805140000:166`) grants a `sales_executive` visibility only when `c.lead_id is not null and l.assigned_to = auth.uid()`. With `lead_id` permanently null, **no sales executive can view any WhatsApp conversation**; only `super_admin` / `sales_manager` / `management` see them, via `whatsapp_inbox_has_manage_scope()`.
2. **`fetchGovernedWhatsappSendIntentsForLead`** (`src/features/crm/server/crm-whatsapp-evidence-queries.ts:29`) filters `whatsapp_conversations` by `lead_id` and therefore returns `[]` for every lead. The WhatsApp evidence picker in `CompleteActivityDialog` is permanently empty.
3. **`private.validate_crm_whatsapp_send_evidence`** (`20260828140000:142`) hard-requires `v_conversation_lead is not null and v_conversation_lead = p_lead_id` (`:176-180`). The CRM 2A `whatsapp` + `whatsapp_sent` first-contact path is therefore **unreachable**, which means the CRM 2C gate `assigned → contacted` can currently be satisfied only by a completed **call** activity.

This is a **pre-existing latent gap, not caused by CRM 2D**, but the CRM 2D unified timeline, the header's WhatsApp fact and the engagement scoring axis all depend on the same missing edge. It is escalated as **owner decision Q6** with a recommended deferral.

CRM 2D must **not** invent a linkage rule. Matching `whatsapp_conversations.customer_e164` against `contact_channels.address_normalized` is an identity-resolution decision with duplicate-contact, contact-merge (`contacts.merged_into`) and consent implications far outside this phase.

### C.6 Ordering, tie-breaking and pagination

**Normalized order key.** One `occurredAt` (`timestamptz`, ISO-8601 UTC) per row: `occurred_at` where the source has it, `created_at` for `created_at`-only sources, `accepted_at` for acceptances, `provider_timestamp` for WhatsApp if ever unblocked. Provider clock skew must be disclosed on the row, never silently merged.

**Total order (no ties possible):**
1. `occurredAt` **descending**
2. then **source rank** ascending — a fixed integer per source kind, so a stage change and its consent side-effect always order identically: `1 quotation` · `2 activity` · `3 event` · `4 consent`
3. then row `id` **ascending** (`localeCompare`) — not the current descending compare

Rank-before-id makes same-transaction rows both stable *and* meaningful, and is reproducible from data alone.

**Pagination — keyset, not offset.** Cursor = `(occurredAt, sourceRank, id)` of the last rendered row. Each source is queried with `limit = pageSize + 1` and `.lt("<ts column>", cursor.occurredAt)`; results are k-way merged and truncated to `pageSize`. Default `pageSize = 25`, hard ceiling 100. Every source CRM 2D uses already carries a `(lead_id, <ts> desc)` index (§C.7), so each page is an index scan. "Load more" is a `searchParam` round trip on the existing `force-dynamic` route — no client-side infinite scroll, consistent with `LeadListPagination`.

**Filters.** MVP ships **one** control: a category chip row (`All · Activity · Quotation · Notes · System`) applied client-side to the already-fetched page. No server-side filter parameters, no saved views. Anything more is CRM 2E.

### C.7 Index readiness

| Table | Index | Status |
|---|---|---|
| `lead_activities` | `idx_lead_activities_lead (lead_id, occurred_at desc)` | present, `20260730184426:478` |
| `lead_events` | `idx_lead_events_lead (lead_id, occurred_at desc)` | present, `:425` |
| `lead_notes` | `idx_lead_notes_lead (lead_id, created_at desc)` | present, `:414` |
| `lead_assignment_history` | `idx_lead_assignment_history_lead (lead_id, occurred_at desc)` | present, `:395` |
| `lead_source_touchpoints` | `idx_lead_source_touchpoints_lead (lead_id, occurred_at desc)` | present, `:350` |
| `consent_events` | `idx_consent_events_lead (lead_id, occurred_at desc) where lead_id is not null` | present, `:366` |
| `quotation_events` | `idx_quotation_events_lead (lead_id, occurred_at desc)` | present, `20260812140000:235` |
| `lead_follow_up_events` | `(lead_id, created_at desc)` | present, `20260826120000:385` |
| `crm_cadence_enrollment_events` | `(lead_id, created_at desc)` | present, `20260830140000` |
| `whatsapp_conversations` | **`(lead_id)` — MISSING** | only `uq (phone_number_id, customer_e164)` and `(last_message_at desc)` exist |

**Every source CRM 2D actually needs is already indexed.** The single gap sits on the blocked WhatsApp path and would only be added if Q6 unblocks it.

### C.8 Notes: panel *and* timeline?

Notes appear twice today: as `LeadDetailNotes` (full body + composer) and, via the insert trigger, as `lead_activities.note.created` rows carrying `left(trim(body), 120)`.

**LOCKED (Q6): notes are first-class timeline entries and the separate note *history* list is removed.** The Notes panel is reduced to its composer.

To avoid losing information, the timeline reads **`lead_notes` directly** (full body, author, timestamp) rather than relying on the 120-char `lead_activities.note.created` excerpt, and suppresses the `note.created` twin whose `reference_id` matches a fetched note id. Where a `note.created` activity has no matching fetched note row, **both are shown** — per the "if a pair cannot be proven duplicate, show both" rule. `lead_notes` therefore becomes timeline source #5 with `include = YES`, superseding the row in the §C table.

---

## D. Lead command header design

### D.1 What the header must answer, and where each fact already exists

| Question | Canonical source | Already fetched on the route? |
|---|---|---|
| Who is this client? | `leads.submitted_name`, `contacts.display_name`, `contact_channels` (primary phone/email) | yes — `lead.overview`, `lead.contact` |
| What service / property / locality? | `leads.service_code`, `property_code`, `locality` | yes — `lead.overview` |
| What stage? | `leads.status` | yes |
| Who owns the lead? | `leads.assigned_to` → `fetchCrmAssigneeDirectory` label | yes — `lead.assignment` |
| Primary next action and when? | `lead_follow_ups` where `status='open' and is_primary_next_action` | yes — `lead.followUps` |
| Overdue? | `due_at < now()` (roadmap decision #6: overdue is wall-clock `now()`) | derivable |
| SLA risk? | `crm_sla_clocks.sla_due_at`, `first_contact_attempt_at`, `breached_at` | **NO — not fetched by `getLeadDetailForCurrentUser`** |
| Stale? | `max(lead_activities.occurred_at)` vs now | derivable from timeline page 1 |
| Cadence active? | `crm_lead_cadence_enrollments.status` | yes — `leadCadence` |
| Latest quotation / commercial state? | see §H | **PARTIAL** — only the current draft, via `getQuotationDraftByLeadId` |
| WhatsApp / consent state? | `consent_events` latest per purpose; WhatsApp thread | consent yes; WhatsApp **blocked** (C.5) |
| Lead score / priority? | derived (§G) | new |
| Deal value / weighted value? | derived (§H, §I) | new |

Two genuine data gaps for the header: **SLA clock** and **full commercial state**. Both are covered by §K with one extra bounded read each.

### D.2 Primary vs secondary facts

**Primary (must be visible without scrolling, on every viewport):**
1. Client name
2. Stage badge
3. Primary next action — type icon, title, relative due (`Overdue 2d` / `Due today 16:00` / `Tue 4 Sep`), or the **No next action** warning
4. Owner
5. Priority score + band chip
6. Risk chips (only when set): `Overdue` · `No next action` · `SLA breach` · `Stale`

**Secondary (visible on desktop, one tap behind a "Details" disclosure on mobile):**
7. Service · property · locality · client timeline code
8. Commercial state chip (`No quotation` / `Draft` / `Finalized` / `Issued` / `Accepted`) with deal value or `Value unknown`
9. Cadence chip (`Cadence: Proposal Follow-up · step 2/5`)
10. WhatsApp/consent chip (`WhatsApp: consent granted` / `no consent` / `not linked`)
11. Created / last updated

**Explicitly not in the header:** raw intake message, room codes, budget comfort code, attribution JSON, submitted email, note bodies, assignment history. Those stay in their existing panels. The header is a decision surface, not a data dump.

### D.3 Controls that belong in the header vs elsewhere

| Control | Header? | Why |
|---|---|---|
| Quick actions bar (§E) | **YES** | The whole point of the phase |
| Stage transition select + confirm | **NO** | Stays in `LeadStatusTransitionPanel`; the header's "Move stage" quick action scrolls to and focuses it |
| Assign / reassign | **NO** | Manager-only, needs a directory picker; stays in `LeadDetailAssignmentPanel` |
| Cadence enrol/pause/resume/cancel | **NO** | Stays in `LeadCadencePanel`; header shows state only |
| On Hold / Closed Lost | **NO** | Require a reason; existing dialogs are the authority |
| Back to leads | **YES** | Already present at `page.tsx:118`; folds into the header |

### D.4 Layout

**Desktop (≥1024px)** — a single `crm-surface` card replacing the current `CrmPageHeader` block, three rows:

```
[← Leads]                                                    [Updated 31 Aug 14:02]
Anita Sharma                       [Negotiation]  [HOT 78]  [Overdue]  [SLA breach]
Complete Home Interiors · 3 BHK · Kondapur   |   Owner: R. Menon   |   Immediate
▸ Call — "Discuss revised scope"  ·  Overdue by 2 days (29 Aug 11:00)
[ Log call ] [ Complete next action ] [ Add note ] [ Move stage ] [ Quotation ▸ ]
—————————————————————————————————————————————————————————————————
Quotation: Issued v3 · ₹8,40,000     Cadence: Proposal Follow-up 2/5     WhatsApp: consent granted
```

**Sticky:** yes, but **only the compressed row** (name + stage + score + primary-action due + quick actions), via `position: sticky; top: <admin chrome height>` on a container that collapses rows 3 and 5 once the page scrolls past the card. Never sticky on mobile — vertical space is the scarce resource there.

**Mobile (360–430px)** — vertical stack, no horizontal scroll:

```
← Leads
Anita Sharma
[Negotiation] [HOT 78]
[Overdue] [SLA breach]
▸ Call — Discuss revised scope
  Overdue by 2 days
[ Log call ]  [ Complete ]
[ Note ]      [ Stage ]
[ Details ▾ ]        ← discloses service/property/locality/quotation/cadence/consent
```

Quick actions are a 2-column grid of ≥44px targets (the existing `crm-btn` min-height convention, cf. `page.tsx:120` `min-h-10`). Risk chips wrap; they never truncate.

### D.5 Relationship to existing components

The header **replaces** the `page.tsx:116-131` block (back-link + `CrmPageHeader` + updated line). It does **not** replace `LeadStatusTransitionPanel`, `LeadDetailAssignmentPanel`, `LeadDetailContact`, `LeadCadencePanel` or `LeadDetailQuotationPanel` — it summarises them and links to them. `CrmPageHeader` remains the shared header for every other CRM route and is not modified.

To avoid a *third* copy of sidebar facts on mobile, the header's "Details" disclosure shows the **derived summary chips only**, never the full panels.

---

## E. Quick action authority map

### E.1 Complete inventory of existing lead-scoped authorities

| Action | Server action | Service / adapter | DB authority | Permission |
|---|---|---|---|---|
| Create activity (call, whatsapp, consultation, site_visit, quotation_follow_up, internal_task) | `createLeadActivityAction` (`crm-activity-actions.ts:99`) | `crm-activity-service.ts` | `public.create_lead_activity` | `crm.follow_ups.manage` + `crm_user_can_operate_lead` |
| Complete activity (+ NEXT_PRIMARY / CADENCE_NEXT / ON_HOLD / CLOSED_LOST resolutions) | `completeLeadActivityAction` (`:252`) | idem | `public.complete_lead_activity` | idem |
| Reschedule activity | `rescheduleLeadActivityAction` (`:144`) | idem | `public.reschedule_lead_activity` | idem |
| Transfer activity ownership | `transferActivityOwnershipAction` (`:183`) | idem | `public.transfer_activity_ownership` | idem |
| Designate primary next action | `designatePrimaryNextActionAction` (`:221`) | idem | `public.designate_primary_next_action` | idem |
| Add note | `addLeadNoteAction` (`crm-lifecycle-actions.ts:106`) | `crm-lifecycle-service.ts` | direct RLS `insert (lead_id, body)` on `lead_notes` | `crm.notes.manage` + `crm_can_mutate_lead` |
| Transition stage / On Hold / Closed Lost | `transitionLeadStatusAction` (`crm-lifecycle-actions.ts:62`) | `crm-lifecycle-service.ts:101` | `public.transition_lead_status` (+ CRM 2C gates) | `leads.transition` + `crm_can_mutate_lead` |
| Assign / reassign / unassign | `assignLeadAction` (`crm-assignment-actions.ts:65`) | `crm-assignment-service.ts` | `public.assign_lead` | `leads.assign` |
| Cadence enrol / pause / resume / cancel | `enrollLeadInCadenceAction`, `pause/resume/cancelLeadCadenceAction` (`crm-cadence-actions.ts:201-247`) | `crm-cadence-service.ts` | `enroll_lead_in_cadence`, `pause/resume/cancel_lead_cadence` | `crm.follow_ups.manage` |
| Create quotation draft | `createQuotationDraftAction` (`quotations/server/quotation-draft-actions.ts`) | — | `public.create_quotation_draft` | `quotations.create` |
| Edit / finalize / send quotation | `quotation-draft-actions.ts`, `quotation-finalization-actions.ts`, `quotation-send-actions.ts` | — | `update_quotation_draft`, `finalize_quotation_version`, `issue_quotation_access_grant_internal` | `quotations.edit`, `quotations.send` |
| WhatsApp governed send | `createWhatsappServiceSendIntentAction` (`whatsapp/server/whatsapp-send-actions.ts:43`) | `whatsapp-dispatch-service.ts` | `public.create_whatsapp_service_send_intent` | `whatsapp.inbox.use` + conversation scope |

**No browser component writes any of these tables directly.** Grants from `20260730184426:1614` onward are `select`-only for `authenticated`, with the single exception of `insert (lead_id, body)` on `lead_notes` (`20260825170000`), which is itself RLS-guarded. CRM 2D preserves this without exception.

### E.2 Recommended MVP quick-action set (five, plus one conditional)

| # | Action | Kind | Reuses | Permission | Terminal-stage behaviour | Mobile | Confirmation | Error mapping |
|---|---|---|---|---|---|---|---|---|
| 1 | **Log call** | inline mutation | If an open primary `call` activity exists → open `CompleteActivityDialog` for it. Else → open `CreateActivityForm` prefilled `activityType='call'`, `isPrimary` = true when no primary exists. Both are existing components. | `crm.follow_ups.manage` | **hidden** on `closed_won` / `closed_lost` (mirrors `showComposer={!isTerminal}`, `page.tsx:166`) | full-width button; the phone number is a separate `tel:` link on the contact chip, never fused into the mutation | none (the dialog is the confirmation) | existing `fieldErrorsForDbCode` (`crm-activity-actions.ts:60`) |
| 2 | **Complete next action** | inline mutation | `CompleteActivityDialog` bound to the primary activity | `crm.follow_ups.manage` | hidden when terminal; hidden when no open primary | full-width | dialog | existing |
| 3 | **Add note** | inline mutation | `addLeadNoteAction` in a compact textarea popover; identical validation to `LeadDetailNotes` | `crm.notes.manage` | hidden when terminal (`showComposer={!isTerminal}`, `page.tsx:186`) | popover becomes a full-width sheet | none | `VALIDATION_FAILED` → inline field error |
| 4 | **Move stage** | **navigation within page** | Scrolls to and focuses `LeadStatusTransitionPanel` | `leads.transition` | hidden when terminal | full-width | none | n/a — panel owns errors, including CRM 2C gate refusals |
| 5 | **Quotation** | navigation | Existing draft → `Link` to `/admin/quotations/{id}/draft`. No draft → `createQuotationDraftAction` then `router.push` (exactly `LeadDetailQuotationPanel.tsx:36-49`) | `quotations.edit` / `quotations.create` | **visible** when `closed_won` (read-only view of the accepted quotation); hidden on `closed_lost` | full-width | none | reuse `LeadDetailQuotationPanel` error surface |
| 6c | **Open WhatsApp thread** | navigation | `Link` to `/admin/whatsapp/inbox/{conversationId}` | `whatsapp.inbox.read` **and** `whatsapp_inbox_can_view_conversation` | visible when terminal (history is legitimate) | full-width | none | n/a | 

Action 6c ships **only if owner decision Q6 unblocks lead↔conversation linkage**. Until then it renders as a disabled chip reading "WhatsApp not linked", or is omitted entirely (owner's choice within Q6).

### E.3 Deliberately excluded from the MVP quick-action bar

| Excluded | Reason |
|---|---|
| Assign / reassign | Manager-only, needs a directory picker; a header button that opens a modal picker is a worse affordance than the existing panel |
| On Hold / Closed Lost | Both require a bounded reason; the existing `LeadOnHoldDialog` / `LeadClosedLostDialog` are the authority and are reached through "Move stage" |
| Cadence enrol / pause / resume | Needs template selection and shows step state; `LeadCadencePanel` is the right surface |
| **Send WhatsApp message** | Would place a governed outbound send behind a one-tap header button, on a lead whose conversation cannot currently be resolved (C.5). Sending stays in the WhatsApp inbox, where consent state and the service-window eligibility snapshot are visible. **This is a governance decision, not a scope cut.** |
| Reschedule | Already one tap inside `PrimaryNextActionCard` |
| Create quotation revision | Belongs to the quotation editor |

Six controls maximum, four of them stage-conditional: no button wall.

### E.4 Hard rules

- No quick action introduces a new RPC, a new server action, or a new validation path. Every one binds to a symbol in §E.1.
- No quick action bypasses `crm_user_can_operate_lead` / `crm_can_mutate_lead`.
- Permission-denied actions are **omitted**, not disabled-with-tooltip — consistent with `canManageLeadFollowUps` gating throughout `LeadActivityWorkspace`.
- Every action revalidates through the existing `revalidateActivityPaths` / `revalidateLeadPaths` helpers so the header, timeline and score refresh together.

---

## F. Scoring signal inventory

Every candidate signal, with whether it is trustworthy, universally present, and cheap enough for both lead detail and pipeline cards.

| Signal | Source | Universal? | Trustworthy? | Fetch cost | Verdict |
|---|---|---|---|---|---|
| Stage | `leads.status` | yes (`not null`, `chk_leads_status`) | canonical | free | **USE** — maturity axis |
| Assigned / unassigned | `leads.assigned_to` | yes | canonical | free | **USE** — risk axis |
| Age since receipt | `leads.created_at` | yes | canonical | free | **USE** — risk axis (staleness) |
| First-contact attempt made | `crm_sla_clocks.first_contact_attempt_at` | **yes** — a clock row exists for every lead, independent of SLA activation (`20260827140000:714` asserts `clock_count = lead_count`) | canonical; immutable once set (`mark_first_contact_attempt_if_qualifying`, `20260828140000:220`) | 1 keyed read | **USE** — engagement axis |
| SLA breach | `crm_sla_clocks.sla_due_at < now()` and `first_contact_attempt_at is null` | **conditional** — `sla_due_at` is NULL until an owner activates business hours | canonical when present | same read | **USE as a risk FLAG only**, never as score points, and only when `sla_due_at is not null` |
| Primary next action exists | `lead_follow_ups` `status='open' and is_primary_next_action` | yes (unique index `uq_lead_follow_ups_one_primary_open`) | canonical | 1 indexed read | **USE** — risk axis |
| Primary overdue | `due_at < now()` | yes | canonical (roadmap #6) | same read | **USE** — risk axis |
| Completed activities count / recency | `lead_follow_ups` `status='completed'`, `completed_at` | yes | canonical | same read | **USE** — engagement axis |
| Successful contact outcome | `lead_follow_ups.outcome_code` joined to `lead_activity_outcome_codes` (`connected`, `consultation_booked`) | yes | canonical, seeded catalogue (`20260826120000:33`) | +1 small read (or a static code list) | **USE** — engagement axis |
| Consultation / site visit evidence | `lead_follow_ups.activity_type in ('consultation','site_visit')` and `status in ('open','completed')` | yes | canonical — same predicate CRM 2C gate G3 uses (`20260830140000:1936`) | same read | **USE** — engagement axis |
| Cadence status | `crm_lead_cadence_enrollments.status` | yes (nullable) | canonical | 1 keyed read | **USE** — risk flag only (`cadence stopped`), not score points: a cadence is an internal discipline signal, not client intent |
| Commercial state (draft / finalized / issued / accepted) | see §H | yes | canonical; `issued` needs the DEFINER helper | 1 RPC | **USE** — maturity axis |
| Time since last meaningful engagement | `max(lead_follow_ups.completed_at, lead_notes.created_at, lead_activities.occurred_at)` | yes | canonical | derivable from data already read | **USE** — risk axis (staleness) |
| Client timeline urgency | `leads.timeline_code` (`immediate` / `within-1-month` / `within-2-months` / `after-2-months`) | **yes** — `not null` at intake, allowlist enforced (`20260825163000:9`) | client self-declared, but recorded once at intake and immutable in practice | free | **USE** — fit axis. The single genuinely discriminating fit signal available. |
| Declared budget | `leads.budget_comfort_code` | **no** — nullable | self-declared | free on detail, **not fetched on list/pipeline** | **EXCLUDE** — see F.1 |
| Service / property type | `leads.service_code`, `property_code` | yes | canonical | free | **EXCLUDE for MVP** — a `single-room` job is not a worse lead, only a smaller one; size belongs in deal value, not in priority |
| Locality | `leads.locality` | mostly | free text | free | **EXCLUDE — hard rule.** See F.2 |
| Lead source / attribution | `leads.primary_source_id`, `attribution` | yes | canonical | free | **EXCLUDE for MVP** — no conversion-rate evidence exists in the repository to justify per-source weights; inventing them would be unapproved business policy (stop condition). Revisit in CRM 2E once `quotation_acceptances` history supports it. |
| Inbound WhatsApp recency | `whatsapp_conversations.last_inbound_at` | **NO — unreachable** (C.5) | — | — | **EXCLUDE — blocked** |
| Outbound WhatsApp delivery / reply | `whatsapp_messages.latest_status`, `direction` | **NO — unreachable** (C.5) | — | — | **EXCLUDE — blocked** |
| `leads.estimate_snapshot` | intake planner estimate | **no** — null for manual, imported and non-planner leads | server-recomputed against `ESTIMATOR_SERVICES` (`lead-intake-validation.ts:216-278`), so not client-forged, but it is a **public marketing range in rupees**, not a sales-qualified value | free | **EXCLUDE from scoring** — see §H.4 |

### F.1 Why declared budget is excluded

`budget_comfort_code` is listed in `CRM_LEAD_LIST_FORBIDDEN_FIELDS` (`src/features/crm/contracts/lead-dtos.ts:59-74`) and asserted absent from the list DTO by `phase-5b-crm-foundation.test.ts:310-330`. It is therefore available on lead detail but deliberately **not** on the lead list or pipeline card.

If budget contributed to the score, the same lead would score differently on detail than on the pipeline board. That breaks the "stable under identical data" and "reconstructable" requirements. Excluding it keeps one score definition across every surface, and preserves the Phase 5B data-minimization invariant without weakening a test.

### F.2 Non-discrimination rule (hard, non-negotiable)

The score must never read: `locality`, `submitted_name`, `submitted_email`, phone number or number range, `contacts.display_name`, or any free-text field. Locality in particular is a proxy for socio-economic and community status in an Indian residential-interiors market, and scoring on it would encode redlining into the sales queue.

No protected-attribute column (age, gender, religion, caste, disability) exists anywhere in the schema, and CRM 2D adds none. The scoring contract will carry this rule as a comment and a test asserting the derivation function's input type contains no such field.

### F.3 Fetch-cost summary

Beyond what the lead detail route already reads, the score needs exactly:
- `crm_sla_clocks` for the lead (1 keyed read) — **new on lead detail**, already fetched on pipeline (`crm-pipeline-queries.ts:187`)
- commercial state (1 RPC, §K)

On the pipeline board, both are batched across the fetched head exactly as `fetchSlaSignals` already does.

---

## G. Deterministic scoring policy — **OWNER-LOCKED**

### G.1 Shape: score **plus** explicit risk flags (LOCKED, Q1)

A single number cannot carry both "how good is this lead" and "how badly are we handling it". A hot lead that is two days overdue and a lukewarm lead that is on track would collapse to the same number, and the salesperson would learn nothing.

**Recommendation:**

```ts
interface CrmLeadScore {
  readonly priorityScore: number;              // integer 0..100, positive signals only
  readonly band: CrmLeadScoreBand;             // derived from priorityScore
  readonly reasons: readonly CrmLeadScoreReason[]; // every contributing rule, with its points
  readonly riskFlags: readonly CrmLeadRiskFlag[];  // orthogonal, never folded into the number
  readonly computedAt: string;                 // ISO, the single `now` used
  readonly signalsAvailable: {                 // honesty about what could not be read
    readonly slaPolicyActive: boolean;
    readonly whatsappLinked: boolean;
    readonly commercialStateReadable: boolean;
  };
}
```

`reasons` is what makes the score explainable: the header shows the band, a hover/tap panel lists `+18 Consultation held`, `+12 Client timeline: Immediate`, `+25 Quotation issued`. Nothing is hidden.

**Alternative A — single blended score** (risk subtracts points). Simpler UI, but "why is this 42?" becomes unanswerable at a glance and at-risk leads sink in a sorted list precisely when they need attention. **Not recommended.**

**Alternative B — no score, risk flags only.** Honest and cheap, but delivers nothing for prioritisation and does not satisfy the roadmap line "rule-based lead scoring". **Not recommended.**

### G.2 Locked factor table (Q3)

Two components, 100 points total. **No FIT component ships in CRM 2D** — the audit found no trustworthy discriminating fit signal that is safe and consistent across lead detail and pipeline (`timeline_code` was proposed and is **not** locked; `budget_comfort_code` and `estimate_snapshot` are excluded outright). FIT is reserved for future owner-approved data.

All day-boundary arithmetic is Asia/Kolkata-relative, reusing `CRM_CALENDAR_UTC_OFFSET_MINUTES` (`calendar-contracts.ts:19`).

**MATURITY — verified pipeline progress (max 60), from `leads.status` alone**

| Stage | Points |
|---|---|
| `new` | 0 |
| `assigned` | 5 |
| `contacted` | 15 |
| `qualified` | 25 |
| `consultation_scheduled` | 35 |
| `proposal_sent` | 50 |
| `negotiation` | 60 |
| `closed_won` | 60 *(before terminal override to 100)* |
| `closed_lost` | 0 |
| `on_hold` | 0 |

**ENGAGEMENT — verified client interaction (max 40). Each factor awards once only.**

| Rule | Points | Source |
|---|---|---|
| Qualifying first-contact attempt exists | +5 | `crm_sla_clocks.first_contact_attempt_at is not null` |
| Meaningful contact outcome (`connected` **or** `callback_requested`) | +10 | `lead_follow_ups.outcome_code` on a completed activity |
| Non-cancelled `consultation` / `site_visit` exists | +10 | `lead_follow_ups.activity_type in ('consultation','site_visit') and status <> 'cancelled'` |
| Live issued finalized quotation access grant exists | +10 | §H commercial state ∈ {`issued`, `accepted`} |
| Meaningful non-internal activity completed in the last 7 calendar days | +5 | `lead_follow_ups.status='completed'`, `activity_type <> 'internal_task'`, `completed_at` within 7 days |

**Overrides, applied after summation and clamping to `[0,100]`:**

| Lead status | Final score |
|---|---|
| `closed_won` | **100** — excluded from active-priority ranking |
| `closed_lost` | **0** |
| `on_hold` | **0** + `PARKED` flag — excluded from active-priority ranking |

**Excluded from scoring by lock:** WhatsApp reply/inbound signals (blocked by the §C.5 contradiction), `budget_comfort_code`, `estimate_snapshot`, and every attribute barred by §F.2.

**RISK FLAGS — orthogonal, zero points, never alter the number**

| Flag | Predicate | Status |
|---|---|---|
| `SLA_BREACH` | `sla_due_at is not null and first_contact_attempt_at is null and sla_due_at < now()` | **shipped** |
| `OVERDUE_NEXT_ACTION` | open primary with `due_at < now()` | **shipped** |
| `NO_PRIMARY_NEXT_ACTION` | active, assigned lead with no open primary | **shipped** |
| `UNASSIGNED` | active lead with `assigned_to is null` | **shipped** |
| `PARKED` | `status = 'on_hold'` | **shipped** |
| `STALE` | active, non-parked lead where `now >= latestMeaningfulSalesTouchAt + 168h`; `latestMeaningfulSalesTouchAt = MAX(completed non-`internal_task` activity `completed_at`, lead note `created_at`, client-visible quotation event `occurred_at`)`, falling back to `leads.created_at` | **shipped (Q11 lock)** |

The first four reuse the CRM 2B urgency vocabulary (`CRM_PIPELINE_URGENCY_CODES`, `pipeline-contracts.ts:59-72`) verbatim; `resolvePipelineUrgency` remains the single ordering authority on the board. CRM 2D defines **no second threshold** and **no second urgency vocabulary**.

### G.3 Locked bands (Q2)

| Band | Range |
|---|---|
| `HOT` | 70–100 |
| `WARM` | 45–69 |
| `NURTURE` | 20–44 |
| `COLD` | 0–19 |

**"AT RISK" is not a band.** It is expressed by risk flags. A HOT lead can carry `OVERDUE_NEXT_ACTION`, and that is the most important row in the queue.

### G.4 Terminal and parked behaviour (Q2)

| Lead status | Score | Band | Active-priority ranking | Risk flags |
|---|---|---|---|---|
| `closed_won` | **100** | `HOT` | **excluded** | none |
| `closed_lost` | **0** | `COLD` | excluded (terminal) | none |
| `on_hold` | **0** | `COLD` | **excluded** | `PARKED`, plus `OVERDUE_NEXT_ACTION` when the on-hold review activity is overdue. `NO_PRIMARY_NEXT_ACTION` is suppressed because `ON_HOLD_PRIMARY_RESERVED` (`20260828140000:401`) guarantees the review activity is the primary |

`isActivePriorityRankable` is exposed on the score object so no surface has to re-derive the exclusion rule.

### G.5 Guarantees

| Requirement | How it is met |
|---|---|
| Deterministic | Pure function of `(signals, nowMs)`; single `now` captured once per render, threaded in — the same pattern as `sortPipelineCards(cards, now)` (`pipeline-contracts.ts:206`) |
| Bounded | `priorityScore` clamped to `[0,100]`; each axis has a hard cap |
| Reconstructable | Every input is a canonical column; `reasons[]` is emitted with the score |
| Accompanied by reasons | `reasons: { code, label, points }[]` is part of the return type, not a debug extra |
| Stable under identical data | No randomness, no `Date.now()` inside the function, no locale dependence |
| Testable at DB/service level | Pure TS → unit-testable with fixture signal objects; the pipeline aggregate is separately pgTAP-testable |
| Non-discriminatory | §F.2 hard rule + a test asserting the input type has no name/locality/contact field |
| Not based on sensitive attributes | No such column exists in the schema |

### G.6 Where scoring lives — **pure TypeScript derivation** (LOCKED)

`src/features/crm/contracts/lead-score-contracts.ts`, a pure module with no `server-only` import, mirroring `pipeline-contracts.ts`.

**Why not SQL, a view, or a persisted snapshot:**

| Option | Verdict |
|---|---|
| Pure TypeScript contract | **RECOMMENDED.** Zero schema surface, unit-testable, identical on lead detail and pipeline card, matches the CRM 2B precedent (zero migrations) |
| SQL read function | Unnecessary for display. Would duplicate the rules in two languages and create drift risk |
| View / materialized view | Requires the score rules in SQL and a refresh policy; a materialized view would also serve stale bands |
| Persisted snapshot + recompute events | Needs a trigger on ~8 tables or a scheduler. **CRM 2C explicitly rejected adding any scheduler/worker/queue** (`crm-2c…design.md` §A.15). Rejected on the same grounds |

**The one thing TypeScript derivation cannot do: server-side sorting or filtering of the lead list by score.** `queryLeadListPage` is server-paginated at 25/page (max 50), ordered `updated_at desc` (`crm-lead-queries.ts:289-291`). A derived score only exists for the current page, so "sort all leads by score" is impossible without a SQL score.

**Recommendation: do not offer score sorting on the lead list in CRM 2D.** Score is displayed on lead detail and on pipeline cards (where the bounded head is already fully enriched and already sorted by the canonical urgency ladder). If the owner later requires score-sorted lead lists, that is a scoped CRM 2E addition with its own SQL function — see decision **Q10**.

### G.7 Freshness, query cost, history

- **Freshness:** computed per request on a `force-dynamic` route. Always current; never stale.
- **Query cost:** lead detail adds 1 keyed `crm_sla_clocks` read + 1 commercial-state RPC. Pipeline adds 1 batched commercial-state RPC across ≤240 fetched leads (8 columns × 30). No per-card queries — the same discipline as `crm-pipeline-queries.ts:83-88`.
- **History:** **defer to CRM 2E.** Score history is a management-analytics concern (band migration, velocity). Persisting it now would require the snapshot machinery rejected above, and CRM 2E will want a different grain (daily snapshot, not per-change). Nothing in CRM 2D forecloses it: because the score is a pure function of canonical, append-only data, any future backfill can reconstruct historical scores exactly. Owner decision **Q10**.

---

## H. Canonical deal-value analysis — **OWNER-LOCKED (Q4)**

### H.1 What monetary sources exist

| Candidate | Column | Verdict |
|---|---|---|
| Accepted quotation | `quotation_acceptances.taxable_base_paise` | **CANONICAL.** `unique(lead_id)`, `unique(quotation_id)`, `unique(quotation_version_id)` (`20260813140000:133-137`). Written only by `private.accepted_quotation_close_won_impl`. Already the sales-achievement measure |
| Quotation version totals | `quotation_versions.taxable_base_paise` | **CANONICAL** per version. `not null default 0`, constraint-checked as `subtotal - discount` |
| Quotation version grand total | `quotation_versions.grand_total_paise` | **NULLABLE** until a tax profile is applied. Not commensurate with `sales_targets.revenue_target_paise` |
| Trusted deal-value field on `leads` | — | **DOES NOT EXIST.** `leads` has no amount, value, estimate-paise or currency column |
| Manual estimated value | — | **DOES NOT EXIST.** No such field, RPC or UI |
| Intake planner estimate | `leads.estimate_snapshot` (jsonb) | **REJECTED** — see H.4 |
| Currency | — | INR only, enforced on `sales_targets`; quotations carry no currency column (INR implied) |

### H.2 Which measure — taxable base or grand total?

**Recommendation: `taxable_base_paise` (ex-tax).** Three reasons, all evidenced:

1. It is what `quotation_acceptances` records as the realized value (`20260813140000:1441-1452`).
2. It is what is credited to `credited_sales_executive_id` for `sales_achievement_month`, so a weighted pipeline in taxable base reconciles directly against `sales_targets.revenue_target_paise`.
3. `grand_total_paise` is nullable, so a grand-total pipeline would show unknown for every version without a tax profile — including most drafts.

Every monetary figure CRM 2D renders must be labelled **"ex-tax"** so it is never confused with a client-facing total.

### H.3 Locked deterministic precedence (Q4)

A lead has **at most one** quotation root (`quotations.lead_id … unique`, `20260812140000:37`), so the question is only which *version* is authoritative.

| Rank | State | Rule | Value | Confidence label |
|---|---|---|---|---|
| 1 | `accepted` | `quotation_acceptances` row exists for the lead | `quotation_acceptances.taxable_base_paise` | Accepted |
| 2 | `issued` | Highest `version_number` where `status='finalized'` **and** a `quotation_access_grants` row exists with `revoked_at is null` | that version's `taxable_base_paise` | Issued to client |
| 3 | `finalized` | Highest `version_number` where `status='finalized'` (no live grant) | that version's `taxable_base_paise` | Finalized, not sent |
| 4 | `draft` | `is_current_draft = true` **and** `taxable_base_paise > 0` | that version's `taxable_base_paise` | Draft — indicative |
| 5 | `unknown` | anything else, including a zero-value draft and no quotation at all | **`null`** | Value unknown |

Rank 2 uses exactly the predicate CRM 2C gate G4 already treats as proof of delivery (`20260830140000:1945-1953`): `quotation_access_grants` joined to a `finalized` version with `revoked_at is null`. Using a different definition of "issued" in CRM 2D would create two commercial truths.

**Rank 4 is the one genuinely debatable tier** and is put to the owner as **Q4**: including drafts makes the pipeline complete but lets an unreviewed number into a forecast-shaped figure; excluding them makes most `proposal_sent`-and-earlier leads read "unknown".

**`unknown` is never rendered as `₹0`.** Zero is a real, distinct value (a fully discounted quotation). The UI shows the literal string `Value unknown`, and pipeline aggregates report a known-value count alongside every total (§I.4).

### H.4 Why `leads.estimate_snapshot` is rejected as a deal value

It is not client-forgeable — `validateEstimate` (`src/features/lead-intake/server/lead-intake-validation.ts:216-278`) recomputes `min`/`max` from `ESTIMATOR_SERVICES` × `ESTIMATOR_FINISHES` and stores `null` on any mismatch. But it is still unusable as a deal value:

1. **Not universal.** Null for every manual lead (`create_manual_lead` never sets it), every bulk-imported lead, and every planner session where the visitor skipped the estimator.
2. **A range, not a value.** `{ min, max, openEnded }` — `openEnded: true` for villas means the max is a floor, not a ceiling (`budget-config.ts:62`).
3. **Wrong unit.** Rupees (`350_000` = ₹3.5L, `budget-config.ts:55`), while every other monetary column is paise. A silent 100× error waiting to happen.
4. **A marketing range, not a sales figure.** It is the public website's budget estimator output, computed before any consultation.
5. **The CRM is architecturally forbidden to read it on list surfaces.** `estimate_snapshot` is in `CRM_LEAD_LIST_FORBIDDEN_FIELDS` (`lead-dtos.ts:63`) and `phase-5b-crm-foundation.test.ts:341` asserts `crm-lead-queries.ts` does not mention it. Weighted pipeline aggregates run over exactly that surface.

**Recommendation: do not use `estimate_snapshot` for deal value, weighting, or scoring, in CRM 2D or later.** If the owner wants a pre-quotation value, the correct answer is an explicit, permissioned, audited "expected value" field — which is **new business policy, out of CRM 2D scope**, and is offered as an explicit alternative under **Q4**.

---

## I. Weighted-pipeline policy — **OWNER-LOCKED (Q5, Q7)**

### I.1 Definition

```
weighted_value_paise = canonical_deal_value_paise × stage_probability
```

with `canonical_deal_value_paise` from §H.3 and `stage_probability` from the locked table below. Rounding: `round-half-up` to whole paise, applied **per lead**, then summed — never sum-then-multiply, so a card's displayed weighted value always adds up to the column total.

### I.2 Hard rules

- **Weighted pipeline is a read interpretation. It never mutates `leads.status`.** No probability change causes a transition; no hidden stage moves exist. `transition_lead_status` remains the only stage authority.
- Probability is a function of **stage alone**, not of the lead score. Blending the two would make the forecast circular (score already contains maturity points) and would let a subjective priority model move a revenue number. Owner decision **Q3** records this explicitly.
- Terminal values are fixed by the schema, not by policy: `closed_won = 100%` (an acceptance exists, so the deal value is the accepted value), `closed_lost = 0%`.
- A lead with `unknown` deal value contributes **nothing** to any total and is counted separately. It is never treated as zero.

### I.3 Locked stage-probability table (Q7)

| Stage | Proposed probability | Rationale from repository evidence |
|---|---|---|
| `new` | 5% | Unassigned or just received; no contact evidence exists |
| `assigned` | 10% | Owner exists; CRM 2C gate G1 has not yet been satisfied |
| `contacted` | 20% | Gate G1 passed — a real first-contact attempt is recorded on `crm_sla_clocks` |
| `qualified` | 35% | Manual qualification judgement |
| `consultation_scheduled` | 50% | Gate G3 passed — a consultation or site visit exists |
| `proposal_sent` | 65% | Gate G4 passed — a **live capability grant** on a finalized version, i.e. the client actually has the quotation |
| `negotiation` | 80% | Commercial discussion underway; the only remaining exit is acceptance or loss |
| `on_hold` | **0% — PARKED** | See I.5; excluded from active weighted totals |
| `closed_won` | 100% | `quotation_acceptances` row exists |
| `closed_lost` | 0% | Terminal |

These are **proposals grounded in what each stage provably requires**, not industry defaults. ONEDECORE has no historical conversion data yet (`quotation_acceptances` is young), so no empirical calibration is possible. The table must be revisited in CRM 2E once acceptance history exists — recorded as a known limitation, not hidden.

### I.4 Presentation — where weighted value appears, and where it must not

| Surface | Show | Why |
|---|---|---|
| **Pipeline column header** | `12 leads · ₹42.6L weighted · 9 valued` | The single most useful place. The "valued" count makes unknown-value leads visible instead of silently deflating the total |
| **Pipeline board total** | `Open pipeline ₹1.24Cr weighted (ex-tax) · 61 of 78 leads valued` | One line, above the board |
| **Pipeline card** | Deal value only when known, small and secondary; **no per-card weighted figure** | A per-card weighted number is noise — nobody acts on "₹4.2L × 65%". The column total is the decision-grade figure |
| **Lead header** | Deal value + commercial state chip; weighted value **only** behind the "Details" disclosure | The salesperson acts on the deal, not on its probability-adjusted share |
| **Reports route** | **NO** | `reporting-contracts.ts:3` forbids commercial value metrics; forecast is CRM 2E |
| **Lead list table/cards** | **NO** | Would require reading quotation totals into the minimized list DTO |

### I.5 On Hold — LOCKED to 0% / PARKED (Q5)

`on_hold` is a *pause*, not a stage in the funnel: `on_hold_previous_status` is retained and the lead resumes to a reconciled stage (`private.crm_resolve_on_hold_resume_stage`, `20260730184426:645`). Three defensible options:

| Option | Behaviour | Consequence |
|---|---|---|
| **A — 0%, shown separately — LOCKED** | On-hold leads contribute nothing to weighted pipeline; the board shows `On hold: 4 leads · ₹9.1L parked (ex-tax)` under the column | Honest forecast; parked value stays visible instead of vanishing |
| B — inherit `on_hold_previous_status` probability | The deal keeps the weight it had | Overstates a forecast for leads with no scheduled activity beyond an on-hold review |
| C — half the previous stage probability | A middle path | Arbitrary; no evidence supports the 0.5 factor |

### I.6 Aggregation feasibility — why one SQL function is genuinely required

`fetchCrmPipelineBoard` fetches at most `CRM_PIPELINE_STAGE_FETCH_LIMIT = 30` leads per column while reporting an **exact** `count` (`crm-pipeline-queries.ts:57-79`). A weighted total computed over only the fetched head would be wrong whenever a column exceeds 30 leads, and would silently change as cards reorder.

A correct total requires aggregating `leads × quotations × quotation_versions × quotation_acceptances × quotation_access_grants` with precedence logic, across every lead in scope. That cannot be expressed in PostgREST, and `quotation_access_grants` has **zero select policies for `authenticated`** (`20260813140000:125-127`) so the "issued" tier is not readable from the client at all.

**This is the one place in CRM 2D where a SQL function is proven necessary, not merely convenient.** See §K.2.

---

## J. Authorization / privacy matrix

### J.1 Effective role capabilities at baseline

From `CRM_ROLE_PERMISSIONS` (`src/features/crm/contracts/permissions.ts:75+`, mirroring `20260730184426`), the WhatsApp grant block (`20260805140000:38-53`) and the quotation grant block (`20260812140000`):

| Permission | super_admin | sales_manager | sales_executive | project_manager | designer | management (legacy) | sales (legacy) |
|---|---|---|---|---|---|---|---|
| `leads.read_all` | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `leads.read_assigned` | ✅ | ❌ | ✅ | ❌ | ❌ | ❌ | ✅ |
| `leads.transition` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `leads.assign` | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |
| `crm.follow_ups.manage` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `crm.notes.manage` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `crm.activities.read` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `consents.read` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `crm.reporting.read` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `crm.cadences.manage` | ✅ | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `crm.sla.manage` | ✅ | ❌ | ❌ | ❌ | ❌ | ❌ | ❌ |
| `quotations.read` / `.create` / `.edit` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `whatsapp.inbox.read` / `.use` | ✅ | ✅ | ✅ | ❌ | ❌ | ✅ | ✅ |
| `whatsapp.inbox.manage` | ✅ | ✅ | ❌ | ❌ | ❌ | ✅ | ❌ |

`project_manager` and `designer` hold **no** CRM permissions (`permissions.ts:172-174`), so `hasCrmLeadReadAccess` is false and they are redirected by `requireCrmReadAccess`. They cannot reach any CRM 2D surface. This is why §C excludes project events: there is no role that can see both a lead timeline and project execution detail except `super_admin`.

### J.2 Per-surface authorization decision

| CRM 2D surface | Gate | Cross-team leakage risk | Mitigation |
|---|---|---|---|
| Unified timeline — `lead_activities` rows | `crm.activities.read` + `crm_can_view_lead` (existing RLS) | none | reuse `context.canReadActivities` exactly as `crm-lead-repository.ts:177` does today |
| Unified timeline — `lead_events` rows | `crm_can_view_lead` (existing RLS) | none | unchanged |
| Unified timeline — `consent_events` rows | `consents.read` + `crm_can_view_lead` | none | reuse `context.canReadConsents` (`:202`) |
| Unified timeline — `quotation_events` / acceptance rows | `quotations.read` + `crm_can_view_lead` via `private.quotation_can_view` | **none** — `quotation_can_view` already composes CRM lead scope (`20260812140000:296-303`) | no new predicate |
| Unified timeline — WhatsApp rows | `whatsapp.inbox.read` + `whatsapp_inbox_can_view_conversation` | **blocked entirely** (C.5) | deferred |
| Lead command header | Same as lead detail — `crm_can_view_lead_by_id` via the route | none | header renders a subset of already-authorized data |
| Lead score | Derived from data the actor already read | **A permission-scoped omission must not change the score.** If `consents.read` were an input, two roles would see different scores for the same lead | §F excludes every permission-variable signal from the score; the only conditional input is `slaPolicyActive`, which is a global policy flag, not a per-actor one |
| Pipeline weighted totals | New RPC, §K.2 | **highest risk in the phase** | the RPC is SECURITY INVOKER over RLS-scoped `leads`; see J.3 |
| Quick actions | Each binds to an existing action whose service re-checks its own permission | none | no new authorization path |

### J.3 The DEFINER question

Two DEFINER decisions arise. They are answered differently, and the difference matters.

**(a) The pipeline value summary — SECURITY INVOKER, no DEFINER.** Following `get_crm_my_day` exactly: the function selects from `public.leads` as the invoker, so `leads_select_crm_scoped` (`crm_can_view_lead`) already restricts a `sales_executive` to owned leads and a `sales_manager` to the full queue. `quotations`, `quotation_versions` and `quotation_acceptances` are likewise RLS-filtered through `private.quotation_can_view`, which itself composes `crm_can_view_lead`. No RLS widening is needed and none is proposed.

**(b) The live-grant "issued" tier — one narrowly scoped DEFINER helper, justified.** `quotation_access_grants` has RLS enabled with **zero** select policies for `authenticated`, deliberately (`20260813140000:127`: *"NOTE: 0 direct SELECT/DML policies for anon or authenticated"*), because the row holds `capability_token_hash` and `derivation_nonce`. Determining whether a live grant exists therefore cannot be done as invoker.

Requirements this helper must satisfy — all of them:

- `security definer` with `set search_path = ''`;
- takes `p_lead_id uuid`; **first statement** re-asserts `auth.uid() is not null`, then `public.authorize('quotations.read')`, then `private.crm_can_view_lead_by_id(p_lead_id)`, raising `42501` on failure — so it cannot be used to probe leads outside the caller's scope;
- returns **only** a non-secret projection: `(state text, version_number int, taxable_base_paise bigint, occurred_at timestamptz)`. It never returns `capability_token_hash`, `derivation_nonce`, grant id, or any row identity;
- `alter function … owner to postgres`; `revoke all … from public, anon`; `grant execute … to authenticated`;
- lives in `private.`, exposed only through a `security invoker` `public.` wrapper — the `get_crm_my_day` / `transition_lead_status` shape;
- pgTAP proves: a `sales_executive` calling it for an unowned lead raises `42501`; the returned record contains no token/nonce column; a revoked grant downgrades `issued` → `finalized`.

This is strictly narrower than widening RLS on `quotation_access_grants`, which is the alternative and is rejected.

### J.4 Invariants CRM 2D must not violate

- No manager gains anything reserved to `super_admin`. `crm.sla.manage` and `leads.assignment_rules.manage` stay `super_admin`-only; CRM 2D reads no SLA policy configuration, only the per-lead clock, which is already manager- and owner-readable.
- No `sales_executive` gains cross-team visibility. Every new read is filtered by `crm_can_view_lead`, `quotation_can_view` or the DEFINER helper's explicit `crm_can_view_lead_by_id` re-check.
- **No new permission code is introduced by CRM 2D.** Every surface fits inside the existing 23 CRM codes + `quotations.read` + `whatsapp.inbox.read`.
- No RLS policy is widened, dropped, or replaced.
- Permission-scoped omission is **silent**. The timeline never renders "3 entries hidden" — that would leak the existence and volume of data the actor may not see.

---

## K. Data model / read-model recommendation

### K.1 Recommendation summary

| Concern | Recommendation | New schema? |
|---|---|---|
| Unified timeline | **Server-side TypeScript assembly** in a new `crm-lead-timeline-queries.ts`, over existing RLS-scoped PostgREST reads, with the §C.1 dedupe rule, §C.6 total order and keyset pagination | **none** |
| Lead command header | Composition of data the route already fetches + 1 keyed `crm_sla_clocks` read + the commercial-state RPC | **none** |
| Quick actions | Binding to existing server actions | **none** |
| Lead score | **Pure TypeScript contract** — `lead-score-contracts.ts` | **none** |
| Commercial state / deal value per lead | **1 new read RPC** (`private` DEFINER helper + `public` invoker wrapper) — required because `quotation_access_grants` is unreadable by `authenticated` | 2 functions |
| Pipeline weighted totals | **1 new read RPC** (SECURITY INVOKER aggregate) — required because PostgREST cannot express the aggregate and the head-only fetch would be wrong | 1–2 functions |

**No new table. No new column. No new enum. No new permission. No trigger. No scheduler. No materialized view.** Total new schema surface: one migration containing three-to-four functions and their grants.

### K.2 Proposed functions

**1. `private.crm_lead_commercial_state_impl(p_lead_id uuid) returns jsonb`** — SECURITY DEFINER, `search_path = ''`, per §J.3(b). Returns:

```json
{
  "state": "unknown|draft|finalized|issued|accepted",
  "quotationId": "uuid|null",
  "quotationNumber": "OD-Q-2026-000123|null",
  "versionNumber": 3,
  "taxableBasePaise": 840000,
  "at": "2026-08-24T09:12:00Z"
}
```

**2. `public.get_crm_lead_commercial_state(p_lead_id uuid) returns jsonb`** — SECURITY INVOKER thin wrapper.

**3. `public.get_crm_pipeline_value_summary(p_owner_id uuid default null) returns jsonb`** — SECURITY INVOKER, following `get_crm_my_day` line for line: `auth.uid()` assertion, permission gate, `private.crm_has_broad_lead_read()` scope resolution, refusal when a non-broad actor passes a foreign `p_owner_id`, single `clock_timestamp()`. Returns per board stage: `leadCount`, `valuedLeadCount`, `dealValuePaise`, `weightedValuePaise`, plus an `onHold` block and a `probabilities` echo of the locked table so the UI never hardcodes it. Reads `leads`/`quotations`/`quotation_versions`/`quotation_acceptances` as invoker under RLS, and calls helper (1) for the `issued` tier.

The stage-probability table is **encoded once, in the migration**, and echoed to the client. TypeScript must not carry a second copy.

### K.3 Why not a timeline read-model function, view, or projection

| Option | Verdict |
|---|---|
| **TypeScript assembly (RECOMMENDED)** | Every source is indexed on `(lead_id, ts desc)` (§C.7). The route already performs 8 parallel reads; the timeline needs 4. Label/category mapping belongs in the UI layer. Zero schema surface. Directly matches the CRM 2B precedent |
| SQL read function returning merged rows | Would move label and category policy into SQL, duplicate the dedupe rule away from the tests that cover it, and gain nothing — no aggregate is involved and no unreadable table is touched |
| View | Same objections, plus RLS composition across seven tables in one view is harder to reason about than four separately-policied reads |
| Materialized projection / event store | A second copy of append-only truth, needing a refresh policy or triggers on seven tables. Directly violates "no parallel event store" |

### K.4 Contracts to be added (TypeScript)

| File | Contents |
|---|---|
| `src/features/crm/contracts/lead-timeline-contracts.ts` | `CrmTimelineCategory`, `CrmTimelineEntry`, `CRM_TIMELINE_SOURCE_RANK`, `compareTimelineEntries`, `CRM_TIMELINE_PAGE_SIZE`, label maps for the 13 `lead_activities` types + 3 included `lead_events` types + 6 `quotation_events` types |
| `src/features/crm/contracts/lead-score-contracts.ts` | `CrmLeadScoreSignals`, `CrmLeadScore`, `CrmLeadScoreBand`, `CrmLeadRiskFlag`, `deriveLeadScore(signals, nowMs)`, weight constants |
| `src/features/crm/contracts/deal-value-contracts.ts` | `CrmCommercialState`, `CrmLeadDealValue`, `CRM_STAGE_PROBABILITY` (typed mirror of the DB echo, used only for display formatting), `formatWeightedValue` |

`CrmLeadDetailTimelineEntry` in `lead-detail-dtos.ts:79` is **replaced** by `CrmTimelineEntry`; `CrmLeadDetail.timeline` (`:149`) becomes the first page of the unified timeline.

---

## L. UX / mobile design

### L.1 Premium UX rules inherited from the roadmap (§4)

One screen = one decision · compact tables and side drawers on desktop · large Call/WhatsApp/Complete/Reschedule controls on mobile · red only for overdue and risk · green only for completion and won · user-facing language is **Activities** and **Next Action**, never `lead_follow_ups`.

CRM 2D adds one word to that vocabulary: **Priority** (never "AI score", never "rating", never "grade").

### L.2 Timeline presentation

- Vertical rail with a category icon per row; icon and colour derive from `CrmTimelineCategory`, never from a raw code.
- Row: **title** (human label) · actor · relative time (`2h ago`, `Yesterday 14:30`, `24 Aug`) with the absolute value in `title=`.
- Quotation rows carry version and ex-tax amount inline: `Quotation issued — v3 · ₹8,40,000 ex-tax`.
- Activity rows carry outcome and cadence provenance: `Call completed — Connected · Cadence: Proposal Follow-up step 2`.
- Note rows show the 120-char excerpt with an anchor link to the Notes panel.
- Consent rows show `Client` or `System` as actor, never a staff name.
- Category chip filter (`All · Activity · Quotation · Notes · System`) applied to the loaded page.
- `Load more` button; never infinite scroll.
- Empty state: "No timeline entries yet." (unchanged copy).

### L.3 Responsive behaviour at the certified widths

| Width | Header | Timeline | Quick actions | Pipeline weighted |
|---|---|---|---|---|
| 360 / 390 / 430 | stacked, no sticky, "Details" disclosure | single column, rail at 16px inset, amounts wrap below title | 2-column grid, ≥44px targets | column totals stack under the column title |
| 768 | stacked, sticky compressed row | single column, wider rail | single row, may wrap to two | column totals inline |
| 1024 | 3-row card, sticky compressed row | single column inside the main grid column | single row | column totals inline |
| 1366 / 1440 | full 5-row card | as 1024 | single row | board total line + per-column totals |

**No horizontal overflow at any width.** Long client names truncate with `text-ellipsis` and a `title` attribute; the quick-action bar wraps rather than scrolling; monetary values use `formatInrFromPaise` with `maximumFractionDigits: 0` and are additionally abbreviated (`₹8.4L`, `₹1.24Cr`) on pipeline column headers only, with the exact value in `title=`.

### L.4 Accessibility

- Quick actions are `<button>` / `<a>`, reachable and operable by keyboard, in visual order.
- The score chip is not colour-only: it always carries its band text (`HOT 78`).
- Risk chips carry text, not just a red dot.
- The timeline is an `<ol>` (as today), each entry an `<li>`; the category filter is a radio group with a visible label.
- The sticky header must not trap focus or obscure the focused element — `scroll-margin-top` on all anchor targets, including `LeadStatusTransitionPanel` (the "Move stage" quick-action target).
- No dialog triggered by a quick action may open on page load.

---

## M. Implementation slices

**Owner-locked fast-track: THREE blocks on the existing branch**, mapping onto the five audited slices as follows.

| Block | Absorbs | Migration? |
|---|---|---|
| **2D-1 — Sales Command Centre** | 2D-A (unified timeline) + 2D-B (quick actions) + command header + note-history consolidation | no |
| **2D-2 — Deterministic Intelligence** | 2D-C (score + reasons + risk flags) + 2D-D (deal value, stage probability, weighted card values, weighted aggregate) | **yes — the only one** |
| **2D-3 — Certification + Closeout** | 2D-E | no |

The original five-slice breakdown is retained below as the work inventory inside those blocks. Only 2D-2 carries a migration.

### CRM 2D-A — Unified timeline read model + lead command header

| Aspect | Content |
|---|---|
| Schema | **none** |
| RPC / read model | none new; new server module `src/features/crm/server/crm-lead-timeline-queries.ts` |
| TypeScript contracts | `lead-timeline-contracts.ts` (new); `lead-detail-dtos.ts` — replace `CrmLeadDetailTimelineEntry` with `CrmTimelineEntry`, add `CrmLeadHeaderModel` |
| Server | `crm-lead-repository.ts` — remove the `:227-250` merge, delegate to the timeline module, add the keyed `crm_sla_clocks` read |
| UI | `LeadCommandHeader.tsx` (new), `LeadDetailTimeline.tsx` (rewritten), `page.tsx` (compose header, pass cursor searchParam) |
| Regression tests | dedupe (no `lead.status_changed` beside `status.changed`), conditional `lead.created`, total order with identical timestamps, keyset pagination stability, permission-scoped omission is silent |
| DB tests | none |
| Owner / browser QA | lead detail at all 7 widths; a lead with 5 same-transaction rows renders 2 entries |

### CRM 2D-B — Quick actions

| Aspect | Content |
|---|---|
| Schema | **none** |
| Server | none new — binds to `createLeadActivityAction`, `completeLeadActivityAction`, `addLeadNoteAction`, `createQuotationDraftAction` |
| UI | `LeadQuickActions.tsx` (new); `LeadActivityWorkspace` gains imperative open handles for its existing dialogs; `page.tsx` wires the panel refs |
| Regression tests | each action maps to the correct existing action; terminal-stage visibility matrix; permission omission (not disable); no direct table write introduced |
| Owner / browser QA | keyboard traversal; 44px targets at 360px; dialog focus return |

### CRM 2D-C — Deterministic scoring + score reasons

| Aspect | Content |
|---|---|
| Schema | **none** |
| TypeScript contracts | `lead-score-contracts.ts` (new) |
| Server | signal assembly in `crm-lead-repository.ts` (detail) and `crm-pipeline-queries.ts` (board) |
| UI | `LeadScoreChip.tsx` + `LeadScoreBreakdown.tsx` (new); rendered in `LeadCommandHeader` and `PipelineLeadCard` |
| Regression tests | determinism across repeated calls with a fixed `now`; bounds `[0,100]`; every non-zero contribution appears in `reasons`; terminal suppression; on-hold rules; **input type contains no name/locality/contact/budget field**; identical score from detail signals and pipeline signals for the same lead |
| Owner / browser QA | breakdown panel readable at 360px |

### CRM 2D-D — Canonical deal value + weighted pipeline  *(the only slice with a migration)*

| Aspect | Content |
|---|---|
| Schema | `supabase/migrations/20260831140000_crm_lead_commercial_read_models.sql` — 3–4 functions, grants/revokes, comments. **No table, column, enum, trigger or policy change** |
| RPC | `private.crm_lead_commercial_state_impl` (DEFINER), `public.get_crm_lead_commercial_state` (INVOKER), `public.get_crm_pipeline_value_summary` (INVOKER) |
| TypeScript contracts | `deal-value-contracts.ts` (new) |
| Server | `crm-lead-commercial-queries.ts` (new); `crm-pipeline-queries.ts` gains the summary read |
| UI | `CrmPipelineBoard` column headers + board total; commercial chip in `LeadCommandHeader` |
| DB tests | `supabase/tests/database/37_crm_lead_commercial_read_models_test.sql` |
| Regression tests | precedence ladder; unknown ≠ zero; per-lead round-then-sum; terminal probabilities; probability table echoed from DB not hardcoded |

### CRM 2D-E — Certification and closeout

| Aspect | Content |
|---|---|
| Work | Register `crm-2d-*.test.ts` in `test:app`; **also register the three pre-existing unregistered CRM tests** (§P.4); full lint / typecheck / build / `test:app` / `check:db`; browser QA at 7 widths; owner QA script if the 2C/2E precedent requires one |
| Schema | none |

**Ordering rationale:** A and B are independent of the migration and deliver the visible half of the phase first. C depends on A only for the header slot. D is last among the build slices because it is the only one that touches the database, so the migration lands against an otherwise-stable branch.

---

## N. Migration plan

**Exactly one migration in the entire phase.**

| Item | Value |
|---|---|
| Filename | `supabase/migrations/20260831140000_crm_lead_commercial_read_models.sql` |
| Convention | `YYYYMMDDHHMMSS_snake_case_subject.sql`; `HHMMSS = 140000` is the day's primary CRM lane (`120000` reserved for a same-day second lane) |
| Predecessor | `20260830140000_crm_cadence_playbook_foundation.sql` |
| Companion pgTAP | `supabase/tests/database/37_crm_lead_commercial_read_models_test.sql` |
| Forward-only | yes (ADR-0007). No `drop table`, no `drop column`, no data migration, no backfill |
| Rollback posture | Forward-only. Because the migration adds only functions, a defect is repaired by a subsequent forward migration issuing `create or replace function` (the pattern `20260830140000` used to replace `transition_lead_status_impl`). No destructive rollback is ever required |
| Contents | 3–4 `create or replace function`, `alter function … owner to postgres`, `revoke all … from public, anon`, `grant execute … to authenticated`, `comment on function` for each |
| Does NOT | create tables, add columns, alter constraints, alter RLS policies, add permissions, add triggers, add indexes on CRM tables, seed data, activate SLA, configure business hours, or touch WhatsApp/quotation/cadence authorities |
| Conditional addition | `create index idx_whatsapp_conversations_lead on public.whatsapp_conversations (lead_id) where lead_id is not null;` — **only** if owner decision Q6 unblocks WhatsApp linkage, and then in that slice's own migration, not this one |

Managed apply, deployment and any Supabase interaction remain out of scope until the owner approves both this design and the implementation PR.

---

## O. Test / certification plan

### O.1 Database tests — `37_crm_lead_commercial_read_models_test.sql` (pgTAP)

| # | Assertion |
|---|---|
| 1 | All three functions exist with the expected signatures |
| 2 | `private.crm_lead_commercial_state_impl` is `security definer` with `search_path = ''` and owner `postgres` |
| 3 | Both `public.` wrappers are `security invoker` |
| 4 | `revoke`/`grant` state: no `execute` for `public` or `anon`; `execute` for `authenticated` on the two `public.` functions only |
| 5 | Unauthenticated call raises `42501` |
| 6 | `sales_executive` calling `get_crm_lead_commercial_state` for an **unowned** lead raises `42501` (no existence oracle) |
| 7 | `sales_executive` calling `get_crm_pipeline_value_summary` with a foreign `p_owner_id` raises `42501` (mirrors `get_crm_my_day`) |
| 8 | Returned commercial-state JSON contains **no** `capability_token_hash`, `derivation_nonce` or grant id |
| 9 | Precedence: accepted > issued > finalized > draft > unknown, one fixture per tier |
| 10 | A revoked grant downgrades `issued` → `finalized` |
| 11 | A lead with no quotation returns `state='unknown'` and `taxableBasePaise = null` (**not 0**) |
| 12 | A zero-value current draft returns `unknown`, not `draft` |
| 13 | Pipeline summary: `valuedLeadCount ≤ leadCount`; `weightedValuePaise` equals the per-lead round-then-sum for the fixture |
| 14 | `closed_won` → 100%, `closed_lost` → 0%, exactly |
| 15 | `sales_manager` sees the team total; `sales_executive` sees only owned leads |
| 16 | The probability table echoed by the RPC matches the locked owner table |
| 17 | **Invariance:** `transition_lead_status`, `complete_lead_activity`, `assign_lead`, `enroll_lead_in_cadence`, `create_whatsapp_service_send_intent` and `accept_quotation_by_capability` definitions are unchanged by this migration (the `pg_get_functiondef` fingerprint pattern used at `20260830140000:2975`) |
| 18 | No new permission row; `permissions` count unchanged (guards `01_identity_rbac_test.sql:58`) |
| 19 | No RLS policy added, dropped or altered on any pre-existing table |

Existing suites `31`–`36` must pass unchanged. **No existing assertion may be weakened.**

### O.2 Application tests — `src/features/crm/__tests__/crm-2d-communication-intelligence.test.ts`

**Timeline**
- `lead.status_changed` + `status.changed` at an identical timestamp yields exactly one entry
- likewise `lead.assigned`/`assignment.changed`, `lead.created`/`lead.manual_created`, `lead.created`/`lead.bulk_imported`
- `lead.created` **is** rendered when no manual/import activity exists
- `lead.note_added`, `lead.on_hold`, `lead.resumed` never render as separate entries
- total order is stable across shuffled input; ties resolve rank-then-id-ascending
- keyset pagination: page 2 begins exactly where page 1 ended, no gap, no repeat
- `canReadActivities === false` and `canReadConsents === false` omit silently — no count, no placeholder
- excluded `quotation_events` types never appear; the six included ones do
- WhatsApp entries are absent while the linkage gap stands

**Header**
- required facts render at every breakpoint fixture
- overdue / SLA-risk / stale / no-next-action states each render their chip
- terminal leads hide mutating quick actions
- header adds no third mobile copy of sidebar panels

**Quick actions**
- each maps to the expected existing server action symbol
- terminal-stage visibility matrix
- permission-denied actions are omitted, not disabled
- no component imports a Supabase client or writes a table directly

**Scoring**
- determinism: 100 repeated calls with fixed `now` are byte-identical
- bounds and per-axis caps
- every non-zero contribution appears in `reasons`
- `closed_won`/`closed_lost` suppress; `on_hold` follows §G.4
- band boundary values (19/20, 44/45, 69/70)
- `CrmLeadScoreSignals` has **no** `locality`, `submittedName`, `submittedEmail`, `phone`, `contactName` or `budgetComfortCode` member (static type + runtime key assertion)
- detail-derived and pipeline-derived signals for the same fixture produce an identical score
- risk flags reuse `CRM_PIPELINE_URGENCY_CODES` values where they overlap

**Deal value / weighted pipeline**
- precedence ladder mirrors the pgTAP fixtures
- `null` deal value never becomes `0`; the UI string is `Value unknown`
- weighted arithmetic: round per lead, then sum
- the probability table used by the UI comes from the RPC payload, not a TS constant
- no commercial field is added to `CrmReportingSnapshot` (asserts §B.5)

**Invariance guards (source-level, following the `crm-2c` precedent)**
- `crm-lead-queries.ts` still does not mention `attribution`, `estimate_snapshot` or `contact_id`
- `CRM_LEAD_LIST_ITEM_PUBLIC_KEYS` is unchanged
- no CRM 2D module imports from `src/features/projects` or `src/features/marketing`
- no CRM 2D module references Jarvis or QuickFurno

### O.3 Certification gates (all must pass, none may be weakened)

`npm run lint` · `npm run typecheck` · `npm run build` · `npm run test:app` (with the CRM 2D suite **and** the three previously unregistered CRM suites added) · `npm run db:lint` · `npm run db:test`.

### O.4 Browser / owner QA

At **360, 390, 430, 768, 1024, 1366, 1440**: lead detail (header + timeline + quick actions), pipeline board with weighted totals.

Checks: no horizontal overflow; no clipped or overlapped control; sticky header never obscures a focused element; full keyboard traversal of quick actions and the timeline filter; **zero console exceptions**; **zero failed network requests**; score breakdown legible at 360px; `Value unknown` rendered wherever no quotation exists; a manual lead created with an assignment shows **two** timeline entries, not five.

---

## P. Risks, contradictions and deferred work

### P.1 PRE-LAUNCH BLOCKER — WhatsApp conversation lead-link has no canonical writer *(highest severity)*

> **STATUS: OPEN. PRODUCTION CRM WHATSAPP ACTIVATION IS BLOCKED.**
> CRM 2D ships with **no** WhatsApp timeline entries and **no** WhatsApp quick action. CRM WhatsApp timeline/quick-action support is **not** complete and must not be described as such.
> Production CRM WhatsApp activation remains blocked until deterministic lead-to-conversation identity resolution is designed and certified as a separate repair — after CRM 2D, or before WhatsApp production activation, whichever comes first.
> This does **not** block the non-WhatsApp CRM 2D MVP.


Fully evidenced in §C.5. `whatsapp_conversations.lead_id` has no writer. Consequences: sales executives can see no WhatsApp conversation; `fetchGovernedWhatsappSendIntentsForLead` always returns `[]`; the CRM 2A `whatsapp_sent` first-contact evidence chain and therefore that route to CRM 2C gate G1 are unreachable.

*Impact on CRM 2D:* WhatsApp timeline entries, the header's WhatsApp fact, the WhatsApp quick action and the WhatsApp engagement signals are all undeliverable as specified. **Recommendation: deliver CRM 2D without WhatsApp and record the linkage as a separate, properly scoped phase** (it is an identity-resolution problem touching contact merge and consent, not a CRM 2D sub-task). Owner decision **Q6**.

### P.2 CONTRADICTION — two quotation lifecycle vocabularies

`src/features/quotations/contracts/lifecycle.ts:6-16` declares nine `QUOTATION_LIFECYCLE_STATES` (`draft, finalized, sent, viewed, accepted, rejected, revision_requested, expired, superseded`). The physical schema supports far fewer: `quotations.status in ('active','archived')` (`20260812140000:45`) and `quotation_versions.status in ('draft','finalized','archived')` (`20260813140000:185`). `sent`, `viewed`, `accepted`, `rejected`, `expired` and `superseded` exist only as events, grants and the `quotation_acceptances` row.

*Impact:* CRM 2D must derive commercial state from **events, grants and acceptances** (§H.3) and must not treat `QUOTATION_LIFECYCLE_STATES` as a column vocabulary. Flagged, not resolved here — reconciling the TS contract with the schema is a quotations-domain concern.

### P.3 RISK — bounded pipeline head vs exact weighted totals

`fetchCrmPipelineBoard` fetches 30 leads per column but reports an exact count. Any weighted total derived from the fetched head would be wrong past 30 leads. Mitigated by computing totals in `get_crm_pipeline_value_summary` over the full RLS-scoped set (§I.6), and by reporting `valuedLeadCount` beside every total so unknown-value leads are never silently absorbed.

### P.4 RISK — three CRM test files are not in the `test:app` suite

`crm-activity-ui.test.ts`, `crm-datetime-field.test.ts` and `phone-e164.test.ts` exist under `src/features/crm/__tests__/` but do not appear in `package.json` `test:app`. They therefore do not run in Application Quality.

Pre-existing, not caused by CRM 2D, but CRM 2D adds UI tests to the same directory and would inherit the same silent gap. **Recommendation: register all four (the three existing plus the new CRM 2D suite) in slice CRM 2D-E.** This is suite registration only — no test is modified or weakened.

### P.5 RISK — SLA-dependent signals are inert until an owner configures business hours

`crm_sla_policies` ships inactive by design (roadmap: *"policy not active until owner-configured business hours"*), so `crm_sla_clocks.sla_due_at` is NULL for every lead. `first_contact_attempt_at` **is** populated regardless (`20260827140000:714`), so the engagement signal works; only the `sla_breach` risk flag is inert. Mitigated by `signalsAvailable.slaPolicyActive` and by never showing an SLA chip when `sla_due_at is null` — exactly the `slaSignalAvailable` discipline already in `CrmPipelineBoard` (`pipeline-contracts.ts:130`).

### P.6 RISK — no historical data to calibrate stage probabilities

`quotation_acceptances` is young; there is no conversion history. The §I.3 table is reasoned from what each stage provably requires, not measured. Must be re-derived in CRM 2E from acceptance history. Stated as a limitation on the surface itself, not hidden.

### P.7 RISK — clock-tie ordering depends on `now()` semantics

Same-transaction rows share a `now()` timestamp exactly. The §C.6 total order removes the ambiguity, but any future writer that uses `clock_timestamp()` instead of `now()` will interleave differently. The ordering test uses identical-timestamp fixtures precisely to pin this.

### P.9 RESOLVED — `STALE` threshold owner-locked at 168 hours

**Original finding (kept for the record).** Owner lock Q3 asked for `STALE` to "reuse the existing CRM 2B stale/rotting policy". No such policy existed: CRM 2B shipped stage age as an *unthresholded* descriptive label (`pipelineStageAgeDays` / `formatPipelineStageAgeLabel`, `pipeline-contracts.ts:229-245`) and locked that decision with an active assertion (`crm-2b-calendar-pipeline.test.ts:801-812` — no `STALE_DAYS`/`ROTTING_DAYS` in `pipeline-contracts.ts`, no `is_stale`/`is_rotting` in `crm-pipeline-queries.ts`). Choosing a number would have been inventing the *first* threshold, i.e. unapproved business policy, so the flag was withheld pending an owner lock.

**Resolution (Q11, locked 2026-08-31).** `CRM_STALE_AFTER_HOURS = 168`.

- The constant lives in `lead-score-contracts.ts`, **not** in `pipeline-contracts.ts`, so CRM 2B's assertion is untouched and still passes. CRM 2D adds a *sales-touch recency* rule, not a second *stage-age* rule — the two measure different things and do not conflict.
- `STALE` is orthogonal: it changes neither the priority score, the stage probability, nor the weighted value. Certified by a test that holds every input constant except the touch instant and asserts identical `priorityScore`, `band` and `reasons`.
- Terminal leads return no flags at all; `on_hold` is excluded because a parked lead is deliberately not being worked.
- No schema, migration, column or persisted state was added for the threshold.

Boundary behaviour certified: 167h59m59s → not stale; exactly 168h → stale; a recent note, a recent qualifying completed activity, or a recent client-visible quotation event each clear it; an `internal_task` alone does not; with no touch at all the window runs from `leads.created_at`.

### P.8 Deferred out of CRM 2D

Score history and score-sorted lead lists (CRM 2E) · forecast and attainment reporting (CRM 2E) · WhatsApp lead linkage (separate phase) · `lead_follow_up_events` micro-audit in the timeline · source/attribution weighting in the score · timeline saved views and server-side filters · project-execution events on the lead timeline · reconciling `QUOTATION_LIFECYCLE_STATES` with the schema.

---

## Q. Owner decisions — **LOCKED 2026-08-31**

| # | Decision | **LOCKED OUTCOME** | Where implemented |
|---|---|---|---|
| **Q1** | Scoring philosophy | One deterministic **0–100 priority score + orthogonal risk flags**. Flags never alter the number. Every score returns `reasons[]` and a factor breakdown. No sensitive/protected attributes. No AI/ML/external enrichment | §G.1, `lead-score-contracts.ts` |
| **Q2** | Score bands | **HOT 70–100 · WARM 45–69 · NURTURE 20–44 · COLD 0–19.** "AT RISK" is not a band. `closed_won` → 100, excluded from active ranking; `closed_lost` → 0; `on_hold` → 0 + `PARKED`, excluded from active ranking | §G.3, §G.4 |
| **Q3** | Factors and weights | **No FIT component.** Maturity max 60 (stage ladder 0/5/15/25/35/50/60). Engagement max 40 (+5 first contact, +10 meaningful outcome, +10 consultation/site visit, +10 live issued grant, +5 recent non-internal activity). Award once; clamp 0–100; terminal overrides. No WhatsApp signals, no `budget_comfort_code`, no `estimate_snapshot`. Risk flags carry canonical evidence only | §G.2 |
| **Q4** | Canonical deal value | **`taxable_base_paise`, INR.** accepted > issued(live grant) > latest finalized > latest draft where `> 0` > unknown. Unknown stays null — never ₹0. No `estimate_snapshot`. No manual deal-value field | §H.3 |
| **Q5** | On Hold weighted pipeline | **0%, displayed as PARKED**, excluded from active weighted totals. Stage and historical value unchanged | §I.5 |
| **Q6** | Unified timeline policy | Notes are **first-class timeline entries**; the separate note history list is removed and the composer stays. Default **All**; no filter system — category styling/labels only. Suppress systematic duplicate twins. No raw codes in UI. Deterministic default ordering. Permission-aware omission preserved. **WhatsApp entries excluded**; defect documented as a pre-launch blocker | §C.1, §C.2, §C.8, §P.1 |
| **Q7** | Stage probabilities | **5 / 10 / 20 / 35 / 50 / 65 / 80 / 100 / 0 / 0(PARKED).** Integer-safe paise arithmetic. Unknown value → unknown weighted value. Probability never derived from the score; stage never mutated from score or probability | §I.3 |
| **Q8** | Quick actions | **Five:** Call · Complete Next Action · Add Activity · Add Note · Quotation. **No WhatsApp quick action.** Stage transition stays in its control; cadence stays in its panel; assignment stays in its permissioned control | §E.2 |
| **Q9** | Lead command header | Desktop primary: name · stage · owner · priority band/score · risk flags. Secondary: service · property · locality · next action + due · cadence. Commercial strip: quotation state · deal value · stage probability · weighted value. Consent secondary unless blocked/denied → warning. Mobile compact, no horizontal overflow | §D |
| **Q10** | Score history / sorting | **No score persistence in CRM 2D**; history deferred to CRM 2E. Current score + reasons display on lead detail and pipeline cards. No score-based list sorting. **Weighted pipeline aggregate IS in CRM 2D** | §G.6, §G.7 |

### Q.11 `STALE` threshold — **LOCKED 2026-08-31**

| Decision | **LOCKED OUTCOME** | Where implemented |
|---|---|---|
| **Q11** | `STALE_AFTER_HOURS = 168`. Stale when the lead is active/rankable, not `closed_won` / `closed_lost` / `on_hold`, and `now >= latestMeaningfulSalesTouchAt + 168h`, where the touch is `MAX(completed non-internal_task activity, lead note, client-visible quotation event)` falling back to `leads.created_at`. Orthogonal risk flag only — no score, probability, weighted-value, CRM 2B contract, schema or migration change | `CRM_STALE_AFTER_HOURS` in `lead-score-contracts.ts`; touch assembly in `crm-lead-score-signals.ts` and `crm-pipeline-queries.ts`; §G.2, §P.9 |

---

## R. Explicit non-goals

CRM 2D will **not** deliver, and its implementation PR must not contain:

- Any AI, LLM, Jarvis, embedding, vector store, external scoring API, autonomous agent, or predictive/ML model. Scoring is a pure deterministic function of canonical columns.
- Any external enrichment or third-party data API.
- Email automation, Google Calendar sync, or Outlook sync.
- A new WhatsApp transport, provider adapter, send path, template model, or any change to consent/eligibility governance. CRM 2D reads WhatsApp state at most; it never sends.
- A new cadence scheduler, worker, queue, cron job, `pg_cron`, `pg_net` or edge function. CRM 2C's synchronous, transaction-local model is preserved.
- A second CRM state machine, activity system, quotation system or event store.
- Any new lead stage, or any mutation of `leads.status` outside `transition_lead_status` / `assign_lead` / `accepted_quotation_close_won_impl`.
- Payment, commerce, project-execution or design-workflow changes.
- CRM 2E management analytics: forecast reporting, attainment, velocity, first-response SLA compliance dashboards, score history.
- A generic BI platform, saved views, custom dashboards or a report builder.
- Any RLS widening, any new permission code, any change to the five-role model.
- Any reference to, import from, or design for **Jarvis** or **QuickFurno**.

---

## S. Exact files likely to change during implementation

Nothing in this list is modified in this phase. It is the projected surface for owner review.

### New files

| File | Slice |
|---|---|
| `src/features/crm/contracts/lead-timeline-contracts.ts` | 2D-A |
| `src/features/crm/server/crm-lead-timeline-queries.ts` | 2D-A |
| `src/features/crm/components/leads/LeadCommandHeader.tsx` | 2D-A |
| `src/features/crm/components/leads/LeadHeaderFacts.tsx` | 2D-A |
| `src/features/crm/components/leads/LeadQuickActions.tsx` | 2D-B |
| `src/features/crm/contracts/lead-score-contracts.ts` | 2D-C |
| `src/features/crm/components/leads/LeadScoreChip.tsx` | 2D-C |
| `src/features/crm/components/leads/LeadScoreBreakdown.tsx` | 2D-C |
| `src/features/crm/contracts/deal-value-contracts.ts` | 2D-D |
| `src/features/crm/server/crm-lead-commercial-queries.ts` | 2D-D |
| `supabase/migrations/20260831140000_crm_lead_commercial_read_models.sql` | 2D-D |
| `supabase/tests/database/37_crm_lead_commercial_read_models_test.sql` | 2D-D |
| `src/features/crm/__tests__/crm-2d-communication-intelligence.test.ts` | 2D-A…E |

### Modified files

| File | Change | Slice |
|---|---|---|
| `src/features/crm/contracts/lead-detail-dtos.ts` | replace `CrmLeadDetailTimelineEntry` with `CrmTimelineEntry`; add `CrmLeadHeaderModel`, SLA and commercial fields | A, D |
| `src/features/crm/server/crm-lead-repository.ts` | remove the `:227-250` merge; delegate to the timeline module; add the keyed `crm_sla_clocks` read; assemble score signals | A, C |
| `src/features/crm/components/leads/LeadDetailTimeline.tsx` | rewritten — categories, labels, actors, amounts, filter, load-more | A |
| `src/app/admin/crm/leads/[leadId]/page.tsx` | compose `LeadCommandHeader` + `LeadQuickActions` in place of the `:116-131` block; thread the timeline cursor searchParam | A, B |
| `src/features/crm/components/activities/LeadActivityWorkspace.tsx` | expose imperative open handles for its existing dialogs so quick actions can drive them; **no change to any mutation path** | B |
| `src/features/crm/server/crm-pipeline-queries.ts` | add the value-summary read and score-signal enrichment | C, D |
| `src/features/crm/contracts/pipeline-contracts.ts` | extend `CrmPipelineCard` with deal value and score; **reuse, do not replace, `CRM_PIPELINE_URGENCY_CODES`** | C, D |
| `src/features/crm/components/pipeline/CrmPipelineBoard.tsx` | column and board weighted totals | D |
| `src/features/crm/components/pipeline/PipelineLeadCard.tsx` | score chip + deal value | C, D |
| `src/features/crm/contracts/crm-labels.ts` | timeline category and event labels | A |
| `src/features/crm/server/crm-errors.ts` | error codes for the two new read RPCs | D |
| `src/types/database.generated.ts` | regenerate for the three new functions | D |
| `package.json` | register the CRM 2D suite **and** the three unregistered CRM suites (§P.4) in `test:app` | E |
| `docs/product/crm-2.0-roadmap.md` | mark CRM 2D delivered; record the owner locks | E |

### Files that must NOT change

`supabase/migrations/*` (all 45 existing) · `src/features/crm/server/crm-activity-actions.ts` · `crm-activity-service.ts` · `crm-lifecycle-actions.ts` · `crm-lifecycle-service.ts` · `crm-transition-adapters.ts` · `crm-assignment-*.ts` · `crm-cadence-*.ts` · `crm-whatsapp-evidence-queries.ts` · `src/features/whatsapp/**` · `src/features/quotations/server/**` · `src/features/crm/contracts/permissions.ts` · `lead-stages.ts` · `lifecycle-contracts.ts` · `activity-contracts.ts` · `cadence-contracts.ts` · `reporting-contracts.ts` · `crm-auth.ts` · `crm-permissions.ts` · `supabase/tests/database/01`–`36`.

---

## Revision history

| Date | Change |
|---|---|
| 2026-08-31 | Initial CRM 2D baseline audit and design at `main` @ `5600e02`. Design/policy-lock only — no implementation, migration, commit, push, PR or deployment. |
| 2026-08-31 | **Owner locks Q1–Q10 recorded; implementation authorized.** §G rewritten to the locked factor table (no FIT; maturity 60 / engagement 40; terminal overrides). §G.3/§G.4 to locked bands and parked behaviour. §C.8 to locked note consolidation (timeline reads `lead_notes` directly). §H.3, §I.3, §I.5 marked locked. §M restructured into the three-block fast-track train. §P.1 escalated to a stated PRE-LAUNCH BLOCKER. **§P.9 added: the `STALE` risk flag cannot reuse a CRM 2B policy that does not exist — flag deferred, enum member reserved, one owner number required.** |

---

## T. Implementation status (2026-08-31)

Implemented on branch `crm-2d-communication-intelligence`, baseline `main` @ `5600e02`. **Not committed, not pushed, no PR, no managed migration applied, not deployed.**

| Block | Scope | Status |
|---|---|---|
| **2D-1 Sales Command Centre** | Unified timeline, command header, five quick actions, note-history consolidation | **Complete** |
| **2D-2 Deterministic Intelligence** | Score + reasons + risk flags, canonical deal value, stage probability, weighted card values and aggregate | **Complete** |
| **2D-3 Certification + Closeout** | Suite registration, lint/typecheck/build, full app suite, db reset/lint/pgTAP | **Complete except authenticated browser QA — see below** |

**Certification results:** lint 0 errors (13 pre-existing warnings, none in CRM 2D files) · typecheck clean · production build clean · `test:app` **1395/1395** across 328 suites · `db:reset` applies all 46 migrations · `db:lint` clean · `db:test` **37 files / 2290 tests PASS**.

**Migration:** exactly one — `20260831140000_crm_lead_commercial_read_models.sql`. Functions only; no table, column, constraint, index, trigger, permission, role grant or RLS policy created, altered or dropped. One SECURITY DEFINER (`private.crm_lead_deal_values`, minimal non-secret projection, re-applies `private.crm_can_view_lead`); three SECURITY INVOKER public read surfaces.

**Authorization delta: none.** No new permission code, no role grant change, no RLS policy touched. `quotation_access_grants` still carries zero SELECT policies for `authenticated` (asserted in pgTAP).

### T.1 Outstanding — authenticated browser QA at the seven widths

Responsive verification at 360/390/430/768/1024/1366/1440 on the lead detail and pipeline surfaces requires a signed-in staff session. Completing it would mean entering a password into the login form, which the assistant does not do, so **this item is handed to the owner**. Everything is staged: local Supabase running with all 46 migrations, seeded lead `QA Anita Sharma` carrying an overdue primary next action, a note, and an ISSUED finalized quotation at ₹84,00,000 ex-tax.

Unauthenticated checks that were completed: `/admin/crm/leads/{id}` fail-closes to `/auth/login?next=…` for an anonymous visitor, and the login route produced no console errors.

### T.2 Deviations from the owner locks, and why

| Item | Lock | Delivered | Reason |
|---|---|---|---|
| `STALE` risk flag | Q3 named it but no CRM 2B policy existed to reuse | Withheld pending an owner number, then **shipped under the Q11 lock at 168 hours** | See §P.9. The constant lives in `lead-score-contracts.ts`, leaving CRM 2B's unthresholded stage-age policy and its assertion untouched. |
| Timeline pagination | 2D-1 allowed "a clear bounded MVP result with an explicit tested limit" | Bounded: 60 rows/source, 120 entries max, `truncated` surfaced in the contract and disclosed in the UI | The permitted MVP option; avoids a projection or event store. |
| Note history | Q6 | Timeline reads `lead_notes` directly (full body), not the 120-char activity excerpt | Consolidating onto the excerpt would have lost note content. |

---

## U. Revision — STALE lock applied (2026-08-31)

Owner lock **Q11** received and implemented: `CRM_STALE_AFTER_HOURS = 168`.

| Change | File |
|---|---|
| Threshold constant, touch-window doc, `STALE` emission, `STALE` added to the emitted-flag set | `src/features/crm/contracts/lead-score-contracts.ts` |
| `latestMeaningfulSalesTouchAt` + `receivedAt` added to `CrmLeadScoreSignals` | same |
| Detail-surface touch assembly (activity / note / quotation-event MAX) and shared `latestIso` helper | `src/features/crm/server/crm-lead-score-signals.ts` |
| Pipeline-surface batched touch assembly (`fetchSalesTouchSignals`: newest note + newest client-visible quotation event per lead, both index-backed) | `src/features/crm/server/crm-pipeline-queries.ts` |
| Signal wiring | `src/app/admin/crm/leads/[leadId]/page.tsx` |
| 10 new boundary/orthogonality tests | `src/features/crm/__tests__/crm-2d-communication-intelligence.test.ts` |
| Fixture updated for the two new required signal fields | `src/features/crm/__tests__/crm-2b-calendar-pipeline.test.ts` |

**No schema, migration, permission, RLS or CRM 2B contract change.** Certification after the lock: focused CRM 2D **86/86**, full `test:app` **1404/1404**, lint **0 errors**, typecheck clean.
