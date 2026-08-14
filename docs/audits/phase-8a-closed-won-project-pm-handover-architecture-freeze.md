# ONEDECORE Phase 8A Architecture Freeze — Closed-Won Project Conversion & PM Handover

**Document Status:** Architecture freeze — **OWNER DECISIONS LOCKED**  
**Authorization:** `LOCK PHASE 8A OWNER DECISIONS AS RECOMMENDED`  
**Date:** August 14, 2026  
**Gate:** Documentation only. **M28 NOT CREATED.** No managed writes. No runtime implementation.

This freeze concretizes [ADR-0020](../ADR/ADR-0020-closed-won-project-handover-invariants.md) for Phase 8A. It does **not** supersede ADR-0020 wholesale. [ADR-0024](../ADR/ADR-0024-phase-8a-project-materialization-pm-handover.md) records the same owner locks as a Phase 8A implementation architecture.

---

## A. Identity

| Item | Value |
| :--- | :--- |
| Repository | `quickfurno-maker/ONEDECORE` |
| Protected main (base) | `a30c733003fb08b3250148c61f7c4f74f11d4c14` |
| Phase 7B | **COMPLETE** — PR #55 MERGED (true merge commit `a30c733…`; parents `864b967…` + `de5e335…`) |
| Post-merge CI | `31785863484` SUCCESS |
| Repository migrations | **M1–M27** |
| Managed project | `lpurlfmpvriyvpkujvyl` |
| Managed migrations | **M1–M27** (latest `20260814140000_quotation_trigger_execute_privilege_hardening`) |
| Pending managed | **NONE** |
| M28 | **ABSENT** — conceptually reserved as `closed_won_project_conversion_pm_handover`; **not created in this freeze** |
| Production activation | **NONE** |
| Public intake / Meta / Groq | Inactive / not activated |

Existing Phase 8 TypeScript prebuild on main (`src/features/projects`) is **not** the database contract. It may be reused later only where consistent with this freeze. Phase 8B/8C prebuild remains disabled and out of M28.

---

## B. Entry truth (Phase 7B Closed-Won; no project)

Authoritative chain already on main and managed M26/M27:

```
public.accept_quotation_by_capability(token, name, email)
  → public.quotation_acceptances
      UNIQUE(lead_id), UNIQUE(quotation_id), UNIQUE(quotation_version_id)
      credited_sales_executive_id snapshot
      taxable_base_paise (GST excluded)
      sales_achievement_month (Asia/Kolkata)
  → private.accepted_quotation_close_won_impl
      leads.status = 'closed_won'
  → lead_events + lead_activities + quotation_events
```

Same-version acceptance is idempotent (`idempotent_replay`). Staff lead-transition RPC still raises `CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE`.

**Phase 7B does not create a project.** Phase 8A must not rewrite that acceptance transaction or falsify Closed-Won if materialization later fails.

---

## C. Owner decisions (OD8A-1 through OD8A-4)

Owner authorization: `LOCK PHASE 8A OWNER DECISIONS AS RECOMMENDED`.

### OD8A-1 — Project number

**LOCKED:** `OD-P-{YYYY}-{SEQ6}`

- Generated server/database-side
- Asia/Kolkata year boundary
- Race-safe monotonic sequence within year
- Gaps permitted
- Immutable after creation
- Unique
- Human-readable identifier only; UUID remains technical PK
- No other numbering format

### OD8A-2 — Project creation initiation

**LOCKED:** Separate Phase 8A idempotent post-Closed-Won materialization boundary.

Normal path:

```
authoritative Phase 7B acceptance
  → Closed-Won committed
  → separate Phase 8A server-side materializer creates/reuses project
```

- Do **not** rewrite the Phase 7B acceptance transaction
- Do **not** create a DB trigger on lead Closed-Won
- Do **not** make manager “Create project” the normal path
- Materialization occurs only **after** Closed-Won is committed
- Automatic server orchestration may call a service-role/internal materializer after successful Phase 7B acceptance
- Super Admin / Sales Manager repair/retry must invoke the **same** canonical private implementation
- Retry is idempotent and must return/reuse the existing project
- Materializer must re-prove: `leads.status = 'closed_won'`; authoritative `quotation_acceptances` row exists; acceptance lead/root/version relationships are valid
- No duplicate project
- Failure to materialize must **never** undo or falsify the already valid quotation acceptance / Closed-Won commercial truth

### OD8A-3 — PM reassignment after handover acceptance

**LOCKED:** Super Admin / Sales Manager **may** reassign the primary PM before **or** after handover acceptance.

On every reassignment:

- Old PM immediately loses current-primary authority
- Previous assignment closes in history
- New PM becomes current primary
- Project state becomes `awaiting_project_manager_acceptance`
- New PM must explicitly accept handover
- No automatic inheritance of previous PM acceptance
- Stale former-PM acceptance attempt is rejected

This applies even if prior state was `handover_accepted`. No direct progression into Phase 8B/8C.

Prebuild rules that permit assignment **only** from `awaiting_project_manager_assignment` must **not** block legitimate reassignment. **OD8A-3 wins.**

### OD8A-4 — PM reassignment request persistence

**LOCKED: DEFER.**

Phase 8A does **not** add a PM reassignment request table, ticket workflow, or request-approval workflow. PM may communicate operationally; only SA/SM performs authoritative reassignment. A future request workflow remains possible.

---

## D. Phase 8A domain model contract

Conceptual lock only. **No tables created in this freeze.**

### `public.projects`

- UUID PK
- `lead_id` UNIQUE NOT NULL — exactly one execution project per Closed-Won lead
- `quotation_acceptance_id` UNIQUE NOT NULL — immutable authoritative acceptance linkage
- Immutable `accepted_quotation_id` and `accepted_quotation_version_id` copied from acceptance (no second editable commercial truth)
- `project_number` UNIQUE — `OD-P-{YYYY}-{SEQ6}`
- `status` — Phase 8A handover states only
- `primary_pm_id` nullable until first assignment (current-primary pointer)
- `created_at`
- `created_by` nullable/system-aware for automatic materialization; **do not fake a zero UUID actor**
- Optional `handover_accepted_at` convenience timestamp; **`project_events` remains authoritative audit**

No editable project monetary fields. No project-value column.

### `public.project_manager_assignments`

Append-only historical assignment records:

- `project_id`
- `project_manager_id` (canonical active `project_manager` at assign time)
- `assigned_by`, `assigned_at`
- `ended_by` / `ended_at` / reason as appropriate
- Exactly one current primary assignment (partial unique where current / `ended_at IS NULL`)

### `public.project_events`

Append-only project audit ledger (`event_type`, actor identity/type, safe details, `occurred_at`). Forbid UPDATE/DELETE.

### `private.project_idempotency_requests`

Separate from `private.quotation_idempotency_requests`. Durable ledger for `materialize` / `assign_pm` / `accept_handover` (actor/system identity, `operation_code`, `idempotency_key`, request hash if consistent with existing ledgers, response snapshot, timestamps).

Do not persist Designer assignments, design stages, execution stages, cancel/archive, or request tickets in M28.

---

## E. Materialization contract

- Separate post-Closed-Won boundary (OD8A-2)
- Automatic normal path after committed Closed-Won
- SA/SM repair/retry of the same private implementation
- No DB trigger; no Phase 7B transaction rewrite
- Structural uniqueness: UNIQUE `lead_id` and UNIQUE `quotation_acceptance_id`
- Durable idempotency via private ledger
- Re-prove Closed-Won + acceptance identity on every call
- Concurrent retries return the existing project

Recommended future permissions (not created here): `projects.read`, `projects.assign_pm`, `projects.accept_handover`. Materialization is primarily internal automatic behavior. SA/SM repair uses existing `public.authorize` / `private.has_role` patterns (`super_admin`, `sales_manager`). Do not invent `projects.admin` unless a later implementation audit proves it is required.

---

## F. State graph

Exactly:

```
awaiting_project_manager_assignment
    →
awaiting_project_manager_acceptance
    →
handover_accepted
```

Reassignment (SA/SM only):

```
awaiting_project_manager_acceptance  -- reassign -->  awaiting_project_manager_acceptance
handover_accepted                    -- reassign -->  awaiting_project_manager_acceptance
```

New project starts at `awaiting_project_manager_assignment`. Canonical docs do not name `ready_for_phase_8b`; terminal Phase 8A state is `handover_accepted`. No 8B/8C states. No skip to execution/design. V1 Phase 8A is **accept-only** (no reject / request-changes). No cancel/archive in 8A.

Handover acceptance is explicit, audited, current-primary-PM only, and idempotent for same-PM replay while already `handover_accepted`. Prebuild evidence-artifact storage is **not** automatically binding; canonical Phase 8A requires audited explicit acceptance, not an evidence storage subsystem.

---

## G. Authority matrix

Canonical operating roles only: `super_admin`, `sales_manager`, `sales_executive`, `project_manager`, `designer`. Legacy seeds `management` / `sales` / `project_operations` are **not** Phase 8A operating roles.

| Action | Super Admin | Sales Manager | Sales Executive | Project Manager | Designer | Kriti |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: |
| Automatic materialize (orchestration) | — | — | — | — | — | — |
| Repair/retry materialize | ✓ | ✓ | — | — | — | — |
| Assign / reassign primary PM | ✓ | ✓ | — | — | — | — |
| Accept handover | — | — | — | ✓ current primary only | — | — |
| High-level project read | ✓ broad | ✓ broad handover | ✓ own won-origin only | ✓ assigned current | — 8A | — |
| Project mutation | via RPC | via RPC | — | accept only | — | — |
| Designer assignment | Phase 8B | Phase 8B | — | — | — | — |
| Execution stages | Phase 8C | — | — | Phase 8C | — | — |

Sales Executive visibility: read-only high-level handover/status for the project originating from own won lead / canonical authorized sales relationship (`credited_sales_executive_id` or equivalent). No mutation, no PM assignment, no handover acceptance.

PM commercial/PDF visibility for assigned handover is Phase 8A-governed read of the **accepted** quotation baseline (no `quotations.edit` / `finalize` / `send`).

---

## H. Commercial boundary

- `public.quotation_acceptances` remains the authoritative acceptance ledger
- Accepted quotation/version remains the immutable commercial baseline
- Phase 8A must not create a second editable commercial truth
- Sales achievement remains `quotation_acceptances.taxable_base_paise` (GST excluded)
- **Project-value reconciliation is DEFERRED**
- No double counting

---

## I. Security / RLS direction

- Table reads role-scoped via RLS
- Mutations through hardened SECURITY DEFINER RPCs (`search_path = ''`)
- Active-role / active-profile checks
- No browser service-role credentials
- No ordinary direct DML for materialize / assignment / handover
- Append-only assignment history and `project_events`
- Target PM must be active canonical `project_manager` (private helper analogous to `crm_is_assignable_sales_user`; **do not invent a new role code**)
- PUBLIC/anon/authenticated EXECUTE must not be left on privileged helpers (M27 lesson)

---

## J. M28 concept

Reserved descriptive name: `closed_won_project_conversion_pm_handover`.

**M28 is NOT CREATED in this architecture freeze.** Implementation may proceed only after this architecture PR merges and a separate owner-authorized M28 implementation gate.

Future M28 must prove:

**Materialize:** only authoritative Closed-Won; exact acceptance linkage; one project per lead; one project per acceptance; automatic server-side normal path; safe retry; no Phase 7B mutation/rewrite.

**Number:** `OD-P-{YYYY}-{SEQ6}`; race-safe; Asia/Kolkata year; immutable.

**Assign PM:** SA/SM only; active canonical `project_manager` only; current assignment uniqueness; pre-accept and post-accept reassignment; stale PM loses authority; state reset to `awaiting_project_manager_acceptance`.

**Accept:** current PM only; `awaiting_project_manager_acceptance` only; idempotent same-PM replay; audited; moves to `handover_accepted`.

**Read:** SA broad; SM broad handover; SE own won-origin high-level; PM current assigned; Designer no 8A operational mutation; Kriti no authoritative mutation.

**Exclusions:** no designer assignment; no design stages; no execution stages; no project-value reconciliation; no cancellation/archive; no PM request tickets; no ERP.

---

## K. Explicit Phase 8A exclusions

- Lead Designer / Supporting Designer assignment (Phase 8B)
- Design state machine, measurement, production drawings (Phase 8B)
- Execution-stage state machine, progress, snags, holds (Phase 8C)
- Project cancellation / archive
- Handover reject / request-changes
- PM reassignment request tickets (OD8A-4)
- Project-value reconciliation
- Accounting ledger, GST filing, procurement, purchase orders, inventory/warehouse, vendor payment ledger, labour dispatch, autonomous operations (ADR-0005)

---

## L. Architecture freeze exit gate

- Owner decisions OD8A-1 through OD8A-4 **LOCKED**
- No unresolved architecture blocker for M28 design
- Docs-only PR; **do not merge in the freeze authoring gate**
- Implementation (M28 + runtime) may proceed **only after** the architecture PR merges
- This freeze does not authorize managed DDL/DML, production deployment, or Meta/Groq/public-intake activation
