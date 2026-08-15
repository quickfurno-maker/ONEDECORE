# Phase 8B — Designer Assignment & Design Collaboration Architecture Freeze

**Date:** 2026-08-15  
**Branch:** `phase-8b-designer-design-architecture-freeze`  
**Owner authorization:** `LOCK PHASE 8B OWNER DECISIONS AS RECOMMENDED`  
**Architecture:** ADR-0025 / DEC-0073 / OD8B-1–OD8B-8  
**Gate:** docs-only freeze — **no M29**, **no managed write**, **no Phase 8C**, **architecture PR not merged**

---

## A. Identity

| Item | Value |
| :--- | :--- |
| Protected main (branch base) | `db879b5ca27fe9d26543c23d8f130811c7feadab` |
| Phase 8A | **COMPLETE** |
| PR #57 | MERGED 2026-08-15T09:51:36Z — true merge `db879b5ca27fe9d26543c23d8f130811c7feadab` |
| Post-merge CI | `31878059206` SUCCESS |
| Repository migrations | **M1–M28** |
| Managed OneDecore `lpurlfmpvriyvpkujvyl` | **M1–M28**; pending **NONE** |
| M29 | **ABSENT / NOT CREATED** |
| Production activation | **NONE** |
| Phase 8C | **NOT STARTED / EXCLUDED** |

---

## B. Entry audit summary

- Phase 8B database foundation **absent** (no design/designer tables, functions, permissions, or design bucket).
- Migration-independent prebuild **present** on main (`src/features/projects/design`, contracts, unmounted UI, `phase-8b-design.test.ts`).
- No canonical contradiction with ADR-0019 / ADR-0020 / ADR-0024 / ADR-0005 / M28.
- Stale post-merge Phase 8A status headers are truth-synced in this freeze; they were not architecture contradictions.

---

## C. Owner locks (OD8B-1–OD8B-8)

### OD8B-1 — Design workflow start

**LOCK:** `AUTO_CREATE_WORKFLOW_ON_FIRST_LEAD_DESIGNER_ASSIGNMENT`

- Project must already have `public.projects.status = 'handover_accepted'`.
- First current Lead Designer assignment creates/reuses the 1:1 design workflow idempotently.
- Initial state: `brief_received`.
- Supporting Designer assignment does **not** initialize workflow.
- No workflow before `handover_accepted`.
- No explicit V1 “Start Design” step.
- No automatic workflow row merely because handover was accepted.
- Workflow init failure must not falsify Phase 8A handover truth.
- Safe repair/retry through the same canonical implementation if later required.

### OD8B-2 — Ordinary design-state mutation

**LOCK:** `LEAD_DESIGNER_OWNS_ORDINARY_DESIGN_TRANSITIONS`

- Current Lead owns ordinary Phase 8B state advancement.
- Supporting Designers may collaborate and version permitted deliverables; they **must not** independently advance workflow state.
- Current PM has no ordinary design-state advancement.
- SA/SM: staffing/read only; no routine design-state override.
- No persisted V1 blanket `canUpdateDesignWorkflow` for Lead + Supporting.
- Exceptions: OD8B-4 (client approval), OD8B-5 (hold/resume). Production Ready and Design Completed remain current Lead only.

### OD8B-3 — Measurement completion evidence

**LOCK:** `MEASUREMENT_COMPLETED_REQUIRES_CURRENT_MEASUREMENT_SHEET`

- `measurement_pending → measurement_completed` requires at least one **current** versioned `measurement_sheet`.
- Practical PDF/image/scanned sheet is sufficient. No CAD/BIM/structured geometry.
- No text-only completion. Prior versions remain immutable.

### OD8B-4 — Client approval capture

**LOCK:** `CURRENT_LEAD_OR_CURRENT_PM_MAY_RECORD_CLIENT_APPROVAL`

- Evidence mandatory.
- Current Lead **or** current primary PM may record; atomically supports `client_review → client_approved`.
- Supporting Designer cannot record. SA/SM no routine override.
- Auditable business evidence — **not** cryptographic/e-signature. No client portal.
- Allowed sources: uploaded artifact, inbound WhatsApp message, offline approval note — safe references only.
- Do not fabricate marketing consent.

### OD8B-5 — Design hold / resume

**LOCK:** `CURRENT_LEAD_OR_CURRENT_PM_WITH_MANDATORY_REASON`

- Current Lead or current primary PM may hold and resume.
- Non-empty reason mandatory. No separate evidence file required.
- Hold only from eligible non-terminal main-path states. Cannot hold after `design_completed`.
- Resume only to exact `held_from_state`.
- Audited and idempotent. Supporting Designer cannot hold/resume. SA/SM no routine override.

### OD8B-6 — Lead reassignment after Production Ready

**LOCK:** `PRESERVE_PRIOR_PRODUCTION_READY_APPROVAL`

- Reassignment does not reset design state. Files/evidence/history preserved.
- Prior Production Ready approval remains valid. No automatic re-approval from staffing change alone.
- Old Lead loses current-Lead authority immediately; new Lead gains it immediately.
- If no current Lead exists, further Lead-only transitions are blocked.
- Material package change uses the normal version/revision path; staffing change is not a revision.

### OD8B-7 — Design Completed gate

**LOCK:** `CURRENT_LEAD_SIMPLE_TERMINAL_CLOSEOUT`

- Only current Lead: `production_ready → design_completed`.
- No second Production Ready evidence pack. No PM or SA/SM approval gate.
- `design_completed` is Phase 8B terminal.
- Prebuild reapplication of Production Ready evidence to `design_completed` is **not** persisted V1.

### OD8B-8 — PM designer-assignment request persistence

**LOCK:** `DEFERRED`

- No request/ticket table or approval workflow.
- PM may communicate staffing need operationally. Only SA/SM execute assignment.
- Future request workflow remains possible later.

---

## D. State graph

**Entry:** `public.projects.status = 'handover_accepted'` only. Do not rewrite Phase 8A statuses.

**Main:** `brief_received → measurement_pending → measurement_completed → concept_design → internal_review → client_review → client_approved → production_drawings → production_ready → design_completed`

**Branches:** `revision_required` (from `internal_review` or `client_review` only; return to `concept_design` or `internal_review`; current Lead; non-empty reason); `design_on_hold` (eligible non-terminal main-path; resume to `held_from_state`; Lead or PM; non-empty reason).

**Terminal:** `design_completed`.

`public.projects.status` remains Phase 8A handover truth only. Phase 8B lives in a separate 1:1 workflow row.

---

## E. Authority matrix

| Actor | Read | Staff designers | Ordinary transition | Collaborate / version | Client approval | Hold/resume | Production Ready | Design Completed |
| :--- | :---: | :---: | :---: | :---: | :---: | :---: | :---: | :---: |
| Super Admin | Broad | Yes | No | No | No | No | No | No |
| Sales Manager | Broad | Yes | No | No | No | No | No | No |
| Sales Executive (won-origin) | High-level status only | No | No | No | No | No | No | No |
| Current primary PM | Full assigned workspace | No | No | No (read deliverables) | Yes | Yes | No | No |
| Current Lead Designer | Full assigned workspace | No | Yes | Yes | Yes | Yes | Yes | Yes |
| Current Supporting Designer | Full assigned workspace | No | No | Yes | No | No | No | No |
| Unassigned Designer | None | No | No | No | No | No | No | No |
| Kriti | No authoritative mutation | No | No | No | No | No | No | No |
| Legacy `management` / `sales` / `project_operations` | None | No | No | No | No | No | No | No |

UI hiding is never sufficient. RLS + RPC/domain checks are authoritative.

---

## F. Designer staffing relational contract

Conceptual table `public.project_designer_assignments` (append-only history): `id`, `project_id`, `designer_id`, `assignment_role` (`lead_designer` \| `supporting_designer`), `assigned_by`, `assigned_at`, `ended_by`, `ended_at`, `reason`.

Invariants: active canonical `designer` only; at most one **current** Lead; no duplicate current Supporting; no simultaneous current Lead+Supporting for the same person; history not hard-deleted; SA/SM mutation via hardened RPC only.

Before first Lead: zero current Lead allowed; Supporting may exist after `handover_accepted`; **no workflow** until first Lead. During non-terminal workflow, absent Lead freezes Lead-only progression without resetting work.

---

## G. Separate 1:1 design workflow contract

Conceptual `public.project_design_workflows`: `project_id` unique/1:1, `state`, `held_from_state`, `revision_return_state`, timestamps. Current Lead is **derived from assignments**, not duplicated.

Initialized only on first Lead assignment after `handover_accepted`; initial `brief_received`. One row per project. Transition history via `public.project_events`, not a second transition table unless later implementation proves one essential. No Phase 8C state.

---

## H. Measurement-sheet gate

`measurement_pending → measurement_completed` requires a current `measurement_sheet` deliverable version. Practical document sufficient. No CAD/BIM. No text-only skip.

---

## I. Client-approval evidence / capture

Prefer a single generic immutable `public.project_design_evidence` table: project/workflow identity, `evidence_type`, `source_type` (`uploaded_artifact` \| `whatsapp_message` \| `offline_note`), `source_reference`, `captured_by`, `captured_at`, optional note, optional deliverable/version linkage. Immutable metadata.

Dedicated controlled action/RPC binds evidence and `client_review → client_approved` atomically. Staff note is not a client signature. No portal.

---

## J. Versioned deliverables and storage

Prefer single append-only `public.project_design_deliverable_versions`: `project_id`, stable `deliverable_key`, `kind`, monotonic `version_number` from 1, label, immutable storage path, file metadata, uploader, timestamps, supersedes ref, exactly one current version per logical deliverable.

Suggested V1 kinds (not an exhaustive forever catalogue): `concept_board`, `measurement_sheet`, `client_presentation`, `production_drawing`, `approval_pack`.

**Storage:** dedicated private bucket `project-design-documents`. Path includes project identity + deliverable key + version. Bounded signed URLs after server authorization. No browser service-role. No public design files. Do **not** reuse `quotation-documents` or `portfolio-public`. No silent overwrite.

Supporting Designer and Lead may register permitted versions. PM reads deliverables only.

---

## K. Production Ready contract

To enter `production_ready`: handover remains `handover_accepted`; valid transition; exact current Lead exists; actor is that Lead; `client_approved` already recorded with evidence; at least one current `production_drawing` **or** `approval_pack` version; `production_ready` evidence required; event appended; durable idempotency. **No Phase 8C row.**

---

## L. Design Completed contract

Current Lead only, from `production_ready` only, simple terminal closeout. No second evidence pack. No PM acknowledgement. No automatic Phase 8C creation.

---

## M. Lead reassignment continuity

Preserve state, files, evidence, and prior Production Ready approval. Authority transfers immediately. Absent Lead blocks Lead-only transitions. Staffing change is not a design revision.

---

## N. Event / idempotency reuse

**Events:** reuse `public.project_events` (`domain.action`). Do not create a second ledger. Candidate families: `project.designer_assigned`, `project.designer_reassigned`, `project.designer_removed`, `project.design_started`, `project.design_state_changed`, `project.design_revision_required`, `project.design_hold_started`, `project.design_hold_resumed`, `project.client_approval_recorded`, `project.design_deliverable_version_added`, `project.production_ready_approved`, `project.design_completed`. Exact names may be refined in M29 if grammar requires.

**Idempotency:** reuse `private.project_idempotency_requests` and `private.project_idempotency_xact_lock`. Candidate operations: `assign_designer`, `transition_design`, `register_deliverable_version`, `record_client_approval`, `approve_production_ready`. Binding: request hash, durable replay, **transaction advisory lock before ledger lookup**, structural uniqueness, row locks on current-state rows. M28 concurrency correction is binding precedent.

---

## O. RLS / security / permissions

Recommended minimum `domain.action` set for M29 (not created here):

| Permission | SA | SM | SE | PM | Designer (role) | Notes |
| :--- | :---: | :---: | :---: | :---: | :---: | :--- |
| `project_design.read` | Yes | Yes | No (high-level via project read only) | Yes | Yes | Row scope still assignment/origin |
| `project_design.staff` | Yes | Yes | No | No | No | |
| `project_design.collaborate` | No | No | No | No | Yes | Lead vs Supporting still from assignment |
| `project_design.transition` | No | No | No | No | Yes | Ordinary + PR + completed: current-Lead domain check |
| `project_design.client_approval` | No | No | No | Yes | Yes | Lead or current PM domain check |
| `project_design.hold` | No | No | No | Yes | Yes | Lead or current PM domain check |

No `project_design.manage`. No per-state permission explosion. No legacy-role grants.

Security freeze: RLS on all public tables; mutations via hardened RPCs; authenticated direct DML denied; SECURITY DEFINER `search_path=''`; private helpers not executable by PUBLIC/anon/authenticated; active profile + canonical role + current assignment checks; Designer isolation by explicit current assignment; PM isolation by current primary PM; SE high-level own-origin only; no browser service-role; private storage; bounded signed URLs; immutable evidence/file history; append-only audit; no hard delete of historical staffing/evidence/versions.

---

## P. Explicit prebuild corrections (do not persist blindly)

**Safe / canonical reuse:** state set, main path, revision source/return, hold concept, one Lead + N Supporting, SA/SM staffing, client-approval evidence requirement, Lead-only Production Ready, versioned deliverables / no overwrite, later UI reuse where consistent.

**Must change in M29:**

1. Blanket Lead+Supporting `canUpdateDesignWorkflow` → ordinary transitions current-Lead only.
2. Production Ready validator applying evidence to `design_completed` → evidence gate on `production_ready` only; completed is simple Lead closeout.
3. Measurement sheet as optional kind only → current `measurement_sheet` required for `measurement_completed`.
4. Designer denied/unmounted on Phase 8A project detail → authorize explicitly assigned designers.

**Keep unmounted / unpersisted:** `canUpdateExecutionStages`, Phase 8C state machine, snag/cancellation/completion execution evidence types, execution workspace, procurement/inventory/dispatch/install/snags.

This freeze does **not** edit prebuild runtime files.

---

## Q. M29 conceptual scope (not created)

**Candidate name:** `designer_assignment_design_collaboration`

Future M29 should implement, at minimum: recommended permissions; `project_designer_assignments`; `project_design_workflows`; generic immutable design evidence; `project_design_deliverable_versions`; private `project-design-documents` bucket if migration conventions allow; hardened helpers/RPCs; `project_events` reuse; project idempotency reuse; assigned-designer RLS; signed private file access; minimum project-detail design workspace; **no Phase 8C persistence**.

Mutation families (RPC names **not** locked): assign/reassign/remove designer; initialize workflow on first Lead; ordinary transition; measurement completion with current sheet; record client approval; register deliverable version; hold/resume; revision require/return; approve Production Ready; complete design.

---

## R. Phase 8C / No-ERP exclusions

No execution-stage persistence; production logistics; dispatch; delivery; installation; snag-resolution execution; project-completion execution; procurement; POs; inventory; warehouse; vendor payment ledger; labour dispatch/attendance coupling; accounting/GST ledger; client portal; CAD/BIM editor; unrestricted file manager; generic project chat; designer request-ticket workflow; autonomous Kriti mutation.

`production_ready` and `design_completed` must **not** auto-create or activate Phase 8C rows. ADR-0005 No-ERP remains binding.

---

## S. Architecture exit gate

- Owner locks OD8B-1–OD8B-8 captured.
- No architecture blocker.
- Implementation only after this docs PR is merged.
- **M29 is not created in this freeze.**
- Next step after independent review: `PHASE_8B_ARCHITECTURE_PR_MERGE`.
