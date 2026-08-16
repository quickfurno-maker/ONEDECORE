# Phase 8C — Project Execution Workspace Architecture Freeze

**Date:** 2026-08-16  
**Branch:** `phase-8c-execution-architecture-freeze`  
**Owner authorization:** `LOCK PHASE 8C OWNER DECISIONS AS RECOMMENDED WITH THE THREE REFINEMENTS`  
**Architecture:** ADR-0026 / DEC-0075 / OD8C-1–OD8C-12  
**Gate:** docs-only freeze — **no M30**, **no managed write**, **no execution UI mount**, **architecture PR not merged**

---

## A. Identity

| Item | Value |
| :--- | :--- |
| Protected main (branch base) | `6b31052973cf9e50e25803b232ce446308c1fa3a` |
| Phase 8A | **COMPLETE** — PR #57 merged `db879b5ca27fe9d26543c23d8f130811c7feadab` |
| Phase 8B | **COMPLETE** — PR #59 true merge `6b31052973cf9e50e25803b232ce446308c1fa3a` (2026-08-16T13:51:01Z) |
| Merge parents (PR #59) | `b7afef60e41900e7832ea41b249067841aebbaea` + `fb15915db283f9b5a35b142e22607f9ee9b75bad` |
| Post-merge CI | `31950996758` ONEDECORE Quality Gate SUCCESS |
| Repository migrations | **M1–M29** |
| Managed OneDecore `lpurlfmpvriyvpkujvyl` | **M1–M29**; pending **NONE** |
| M29 file | `supabase/migrations/20260816140000_designer_assignment_design_collaboration.sql` |
| M30 | **ABSENT / NOT CREATED** |
| Production activation | **NONE** |
| Phase 8C runtime | **NOT STARTED** (architecture freeze only) |

---

## B. Entry audit summary

- `PHASE_8C_ENTRY_AUDIT: WARN` (2026-08-16): no live 8C schema; historical prebuild + ADR-0020 12-stage graph duplicate M29 design meanings.
- Phase 8C database foundation **absent** (no execution/snag/milestone/delay tables, functions, permissions, or `project-execution-documents` bucket; name-search hits are WhatsApp dispatch only).
- Migration-independent prebuild **present** on main (`src/features/projects/execution/`, contracts, unmounted UI, `phase-8c-execution.test.ts`).
- No live dual-persisted 8C/8B database contradiction. Docs/prebuild vs M29 **is** the contradiction this freeze resolves.
- Stale post-merge Phase 8B status headers (`PR #59 OPEN`, `MANAGED_APPLIED_NOT_MERGED`, next gate `PHASE_8B_PR59_MERGE`) are truth-synced in this freeze; they were not architecture contradictions.
- DEC-0074 remains a historical repository-implementation record (managed M1–M28 / M29 not applied / PR open **as of that row**). Current merge + managed apply live in project truth / roadmap / DEC-0075; DEC-0074’s original authorization is not rewritten.

---

## C. Three refinements (locked with OD8C-1–OD8C-4)

These are the architectural deltas versus historical ADR-0020 / 8C prebuild. They are **not** optional extras on top of the recommended OD8C set.

| # | Refinement | Locked into |
| :--- | :--- | :--- |
| 1 | M29 is authoritative for measurement / design / approval / Production Ready / Design Completed. Do not persist duplicate 8C states. Option A (keep full historical path) **rejected**. Option C aliases may be display-only later, never persisted truth. ADR-0020 8C graph **partially superseded**. | OD8C-2 |
| 2 | Entry = `handover_accepted` **and** `design_completed`. No execution before PM accept. `production_ready` authorizes drawings, does **not** start factory/site execution, must **not** claim production started, must **not** create an 8C row. Auto-create 1:1 execution row on Design Completed; initial state `production`. ADR-0025 §14 remains true for **M29**; later M30 may create 8C after Design Completed. | OD8C-1, OD8C-3 |
| 3 | Drop persisted `material_finalisation` (procurement/PO disguise). Selections already live in 8B. Production/dispatch/delivery/installation are status + evidence tracking only (No-ERP). | OD8C-4 |

---

## D. Owner locks (OD8C-1–OD8C-12)

### OD8C-1 — Execution entry gate

**LOCK:** `HANDOVER_ACCEPTED_AND_DESIGN_COMPLETED`

- Both required. No execution before PM acceptance.
- `production_ready` is not an 8C entry gate.

### OD8C-2 — State graph reconciliation

**LOCK:** `POST_DESIGN_PATH_ONLY`

- Persisted main path: `production → ready_for_dispatch → delivery → installation → snag_resolution → handover → completed`.
- Branches: `on_hold`, `cancelled` (not from `completed`; resume to exact `held_from_state`).
- Drop persisted `project_created`, `site_measurement`, `design_development`, `design_approval`.

### OD8C-3 — Initialization

**LOCK:** `AUTO_CREATE_ON_DESIGN_COMPLETED_INITIAL_PRODUCTION`

- Idempotent 1:1 `public.project_execution_workflows` when Design Completed is recorded on `handover_accepted`.
- Initial state `production`.
- Production Ready does not create the row. Handover alone does not create the row.
- No extra “Start Execution” approval.
- Init failure must not falsify 8A/8B truth.
- Implemented in later M30, not in M29.

### OD8C-4 — Material finalisation

**LOCK:** `REMOVE_PERSISTED_MATERIAL_FINALISATION`

### OD8C-5 — SA/SM execution override

**LOCK:** `DETAILED_READ_NO_ROUTINE_STAGE_MUTATION`

- Exception: cancellation with PM (OD8C-7). No emergency/PM-equivalent routine override in V1.

### OD8C-6 — PM reassignment during execution

**LOCK:** `PRESERVE_STATE_BLOCK_UNTIL_NEW_PM_ACCEPTS`

- Preserve workflow/state/evidence/snags.
- Former PM revoked immediately.
- OD8A-3 still resets handover to `awaiting_project_manager_acceptance`.
- No auto-hold. No execution reset.

### OD8C-7 — Cancellation authority

**LOCK:** `CURRENT_PM_OR_SA_SM`

- Reason ≥10 characters. Terminal. No commercial undo. No V1 reopen. Not from `completed`.

### OD8C-8 — Designer execution visibility

**LOCK:** `ASSIGNED_LEAD_AND_SUPPORTING_HIGH_LEVEL_ONLY`

- Stage / hold / cancelled / completed. No snag/photo/note/ack detail. No mutation. Unassigned Designer denied.

### OD8C-9 — Snag authority

**LOCK:** `CURRENT_PM_ONLY`

- Create / progress / resolve. Resolve requires evidence. Open/`in_progress` block handover and completion. No hard delete. No V1 reopen.

### OD8C-10 — Handover acknowledgement capture

**LOCK:** `CURRENT_PM_M29_STYLE_EVIDENCE`

- Required to **enter** `handover` from `snag_resolution` (zero open snags). Not also required to leave `handover`.
- Sources: upload / inbound WhatsApp / offline note. No portal. No e-signature claim.

### OD8C-11 — Completion gate

**LOCK:** `CURRENT_PM_FROM_HANDOVER_SEPARATE_COMPLETION_ACK`

- Still zero open snags. Separate completion acknowledgement. Terminal. No extra SA/SM approval.

### OD8C-12 — Client update preview

**LOCK:** `DEFERRED`

- No auto-send. No second comms surface in 8C MVP.

---

## E. Domain model (conceptual — not created)

| Concept | Rule |
| :--- | :--- |
| `public.project_execution_workflows` | 1:1 current execution state; initial `production` |
| `public.project_execution_evidence` | Append-only; dedicated; M29 integrity class |
| Execution snags | Append-only status items; PM only |
| `public.project_events` | Reuse; do not split ledger |
| `private.project_idempotency_requests` + `project_idempotency_xact_lock` | Reuse; lock before SELECT |
| Bucket `project-execution-documents` | Private; do not reuse design bucket |
| `project_milestones` / generic `project_files` | **DEFERRED** |

`public.projects.status` stays 8A handover. `project_design_workflows.state` stays 8B.

Hold codes: `client_decision_pending` / `site_access_blocked` / `material_delay` / `weather` / `internal_capacity` / `other`. Reason ≥10. Allowed including snag_resolution/handover; not after completed/cancelled.

---

## F. Authority matrix (conceptual)

| Permission family | SA | SM | Current PM | Other PM | Assigned Designer | SE | Kriti |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| `project_execution.read` (detailed) | Yes | Yes | Yes | No | No | No | No |
| High-level stage only | — | — | — | No | Yes | Own won-origin | No |
| Adjacent transition / hold / snag / handover / complete | No | No | Yes | No | No | No | No |
| Cancel | Yes | Yes | Yes | No | No | No | No |

No `project_execution.manage`. No per-state permission explosion. No legacy-role grants. RPC names **not** locked.

Security freeze: RLS on all public tables; mutations via hardened RPCs; authenticated direct DML denied; SECURITY DEFINER `search_path=''`; private helpers not executable by PUBLIC/anon/authenticated; active profile + canonical role + current assignment checks; PM isolation by current primary PM; Designer isolation by explicit current assignment for high-level read; SE high-level own-origin only; no browser service-role; private storage; bounded signed URLs; immutable evidence; append-only audit; no hard delete of historical evidence/snags.

---

## G. Explicit prebuild corrections (do not persist blindly)

This freeze does **not** edit prebuild runtime files. Future M30 **must not** implement the prebuild as-is.

**Must change in M30:**

1. Rewrite `execution-states.ts` / `execution-state-machine.ts` to the post-design path; drop `project_created` / `site_measurement` / `design_development` / `design_approval` / `material_finalisation`.
2. Retarget evidence map (today requires evidence into `site_measurement` / `design_approval` and uses `production_ready` entering `ready_for_dispatch`).
3. `pm-execution-authority.ts` currently gates only `handover_accepted` via `isHandoverExecutionEligible` and would allow 8C before `design_completed`.
4. `phase-8c-execution.test.ts` locks the stale graph.
5. Keep `ProjectExecutionWorkspace` unmounted until M30 implementation after this architecture PR merges.

**Safe conceptual reuse:** hold/resume with `held_from_state`; cancellation as terminal alternative; snag-resolution → handover → completed; SE high-level own-origin; No-ERP status tracking; later UI reuse where consistent with this freeze.

---

## H. M30 conceptual scope (not created)

**Candidate name:** `project_execution_workspace`

Future M30 should implement, at minimum: recommended permissions; `project_execution_workflows`; execution evidence; snags; private `project-execution-documents` bucket if migration conventions allow; hardened helpers/RPCs; `project_events` reuse; project idempotency reuse; current-PM RLS; signed private file access; minimum project-detail execution workspace **after** `design_completed`; auto-create on Design Completed; **no procurement / PO / inventory / accounting**.

Mutation families (RPC names **not** locked): initialize/repair workflow; adjacent transition; hold/resume; cancel; snag create/progress/resolve; record handover ack; record completion ack.

---

## I. No-ERP / commercial exclusions

No procurement; POs; inventory; warehouse; vendor payment ledger; labour dispatch/attendance coupling; accounting/GST ledger; client portal; CAD/BIM editor; unrestricted file manager; generic project chat; autonomous Kriti mutation; project-value / invoice / payment / profit fields; Gantt/scheduling engine; costing; work orders; warranty/after-sales as required 8C scope.

Accepted quotation remains the immutable commercial baseline. Project-value reconciliation stays deferred (OD8A).

ADR-0005 remains binding.

---

## J. Architecture exit gate

- Owner locks OD8C-1–OD8C-12 captured **with the three refinements**.
- No architecture blocker.
- Implementation only after this docs PR is merged.
- **M30 is not created in this freeze.**
- Next step after independent review: `PHASE_8C_ARCHITECTURE_PR_MERGE`.
- After that merge, next implementation gate: `PHASE_8C_M30_IMPLEMENTATION` (**not started**).
