# 11 — ACCELERATED CLOSEOUT ROADMAP (CURRENT EXECUTION AUTHORITY)

**Document Status:** Owner-Locked Current Execution Authority
**Owner lock date:** 2026-09-02
**Supersedes as current-execution authority:** [09 — Phase Implementation Roadmap](09-phase-roadmap.md) (retained as historical implementation roadmap + evidence ledger) and [CRM 2.0 Product Roadmap](product/crm-2.0-roadmap.md) (retained as historical approved CRM product plan)
**Governing decision:** **DEC-0097** — `ACCELERATED_CLOSEOUT_SEQUENCING_LOCK`

This document is the single authoritative statement of **what ONEDECORE executes next and in what order**. Historical documents remain valid as *evidence*; they are no longer valid as *sequencing instructions*.

---

## 1. Exact baseline

| Item | Value |
| :--- | :--- |
| Repository | `quickfurno-maker/ONEDECORE` |
| Protected branch | `main` (protected; direct writes prohibited) |
| Protected `main` baseline at lock | `27bcee1f36468175e1509e5ec10a0b3533f9c7d7` |
| Last merged PR | **#121** — CRM SLA admin settings |
| PR #121 exact certified head | `0a42534213c817b05b48c96fb6fa6e6c7761cd85` |
| Repository migrations | **49** (through `20260902140000_crm_whatsapp_lead_link_repair`) |
| Managed Supabase (`lpurlfmpvriyvpkujvyl`) migrations applied | **49** — aligned with repository |
| Pending managed migration batch | **NONE** |

### PR #121 certification recorded at lock

| Gate | Result |
| :--- | :--- |
| Focused SLA tests | **51 / 51 PASS** |
| Application test suite | **1543 / 1543 PASS** |
| Database quality | **2401 PASS** |
| Lint / typecheck / build | **PASS** |
| Desktop + mobile owner QA | **PASS** |

### Managed migration tail at lock

```
20260830140000_crm_cadence_playbook_foundation
20260831140000_crm_lead_commercial_read_models
20260831174021_crm_lead_notes_insert_privilege_redrift_repair
20260901140000_crm_management_analytics_read_model
20260902140000_crm_whatsapp_lead_link_repair
```

---

## 2. Acceleration rule

> **Accelerate completion. Never bypass quality.**

Acceleration is authorized to remove **stale planning, duplicated work, and re-litigation of already-certified capability**. It is not authorized to remove **verification**.

**Acceleration MAY:**

- retire stale planning documents and superseded "next phase" markers;
- skip rebuilding a capability that is already merged and certified, unless a **real defect** is proven;
- collapse ceremonial sub-phases into a single certified gate where the evidence produced is equivalent;
- close a phase on existing certification evidence when that evidence is exact-head and current.

**Acceleration MUST NOT:**

- bypass protected `main`;
- bypass **exact-head** CI (`Application Quality` **and** `Database Quality` both required);
- bypass forward-only migration discipline or the pre-apply recovery-point gate;
- weaken RLS, FORCE RLS, RBAC (`public.authorize`), or the five-role CRM model;
- weaken consent / DNC / suppression boundaries;
- weaken fail-closed feature gates (activation is always an explicit, separate owner act);
- skip production smoke / E2E certification before declaring a phase live;
- edit or reorder an already-applied migration;
- self-authorize an activation the owner has not granted.

**Do not over-engineer.** Build the smallest correct thing that passes the gate.

---

## 3. Locked completion sequence

```
P1 ─► P2 ─► P3 ─► P4 ─► P5 ─► P6 ─► P7 ─► P8 ─► P9
                                            │      │
                                            │      └── FINAL PHASE
                                            └───────── SECOND-LAST
```

| Phase | Scope | Lock class |
| :--- | :--- | :--- |
| **P1** | Governance truth sync & release freeze (**docs-only**) | **Owner-locked position — CURRENT** |
| **P2** | Production exact-SHA alignment & smoke verification | **Owner-locked position — NEXT** |
| **P3** | CRM 2A–2E + first-contact SLA production operational certification | Derived operational fill |
| **P4** | Quotation → Closed-Won → project / design / execution production certification | Derived operational fill |
| **P5** | Staff administration, attendance & leave operational activation | Derived operational fill |
| **P6** | Landing Lab + campaign production activation | Derived operational fill |
| **P7** | Kriti provider production activation | Derived operational fill |
| **P8** | **E-commerce production activation (Shop)** | **Owner-locked position — SECOND-LAST** |
| **P9** | **Meta WhatsApp + n8n production activation** | **Owner-locked position — FINAL** |

**P1, P2, P8 and P9 positions are owner-locked and may not be reordered.** P3–P7 are the operational fill inside the locked envelope; the owner may resequence P3–P7 among themselves without breaking the lock, but may not promote P8 or P9 ahead of them.

Online payments / **M38** remain **DEFERRED** outside this sequence (ADR-0033 / DEC-0094). P8 activates **COD-only** commerce. Online payments require separate 9D-E certification plus explicit owner activation.

---

## 4. Mandatory gates (every phase, no exceptions)

### 4.1 Quality gate

1. Branch from current protected `origin/main`; never write to `main`.
2. Local: `npm ci` → `npm run lint` → `npm run typecheck` → `npm run test:app` → `npm run build` → `git diff --check`.
3. **Exact PR head** must pass both required checks: **Application Quality** and **Database Quality**.
4. No merge while any required check is red, pending, or stale relative to the head.
5. One focused PR per phase; the PR body records starting `main` SHA, final head SHA, files changed, validation results, and the phase verdict.

### 4.2 Security gate

- RLS + FORCE RLS on every exposed table; no anon/authenticated privilege widening without an ADR.
- RBAC through `public.authorize`; five-role CRM model (ADR-0019) unchanged.
- Service-role-only RPCs stay service-role-only.
- Consent purposes (`SERVICE_ENQUIRY`, `SERVICE_COMMUNICATION`, `WHATSAPP_SERVICE`, `MARKETING`), DNC (`contacts.status`) and channel suppression (`contact_channels.status`) remain the single authority. No parallel consent store.
- Secrets never committed; `.env*` never modified by a phase that does not own activation.

### 4.3 Migration & recovery gate

- Forward-only. An applied migration is immutable; corrections ship as a new forward migration.
- Repository migration count and managed migration count must be reconciled and stated before and after any apply.
- Before any managed apply: a **current** verified physical backup or qualified active PITR recovery point appropriate to then-current managed state (DEC-0053, per migration).
- Managed apply requires explicit owner authorization naming the migration.

### 4.4 Activation gate

Every production capability is **fail-closed by default**. Deploy ≠ activate. Activation requires an explicit owner act plus the phase's own smoke/E2E certification. No phase may activate a capability belonging to a later phase.

---

## 5. Current completed foundations (at lock)

| Domain | State at 2026-09-02 |
| :--- | :--- |
| Premium public website, homepage, portfolio | **Built / LIVE** |
| Public website lead intake | **Built / LIVE in production** |
| CRM through **2E** (follow-up control plane, calendar + premium pipeline, cadences, communication intelligence, management analytics) | **Built / merged / production live** |
| CRM first-contact SLA | **ACTIVE in managed Supabase** — 60 business minutes, Asia/Kolkata, Mon–Sat, 09:00–19:00, non-retroactive activation |
| CRM SLA admin settings | **Built / merged** (PR #121) |
| Commercial quotation system (7A/7B) | **Built** |
| Projects / design collaboration / execution workspace (8A/8B/8C) | **Built** |
| Kriti copilot foundation | **Built** — production provider activation **PENDING P7** |
| Landing Lab + campaign foundations (9A/9B/9C) | **Built** — production activation **PENDING P6**; live spend **OFF** |
| Commerce / e-commerce foundation (9D-A…9D-F, COD) | **Built** — public Shop gate **OFF**; activation **PENDING P8** |
| Meta WhatsApp foundation (6A/6B) + n8n boundary | **Built** — live callback/token/outbound **OFF**; n8n **DEFERRED**; activation **PENDING P9** |
| Staff administration / attendance / leave (6D) | **Built**; schema applied to managed; P5 owner values **RESOLVED** (DEC-0099). Remaining: M57 apply, deploy, owner-private credential issuance, first real login, production attendance E2E |
| Online payments / **M38** | **DEFERRED** — not on `main`, not managed |

---

## 6. Per-phase objective and exit gate

### P1 — Governance truth sync & release freeze **(CURRENT)**

- **Objective:** Make repository governance/documentation match actual merged reality. Establish this document as current execution authority. **Documentation/governance only.**
- **Scope:** create this document; truth-sync `00-project-truth.md`; reclassify `09-phase-roadmap.md` as historical ledger; reclassify `product/crm-2.0-roadmap.md` as historical approved plan; append **DEC-0097**.
- **Explicit non-actions:** no migration add/edit/delete; no RLS / RPC / function / table change; no `.env*` change; no dependency change; no Shop, payments, Meta WhatsApp, n8n, campaign spend, or Landing Lab activation; no SLA configuration change; no production deploy; no CI weakening.
- **Exit gate:** docs merged to `main` via one focused PR; exact head green on **Application Quality** + **Database Quality**; zero runtime diff.
- **Verdict token:** `P1_COMPLETE_READY_FOR_P2`

### P2 — Production exact-SHA alignment & smoke verification **(NEXT)**

- **Objective:** Prove the deployed Hostinger VPS production runtime is running the exact certified `main` head, and that live surfaces behave correctly at that head.
- **Scope:** deployed-SHA verification; PM2/Nginx health; production smoke matrix across public site, portfolio, lead intake, CRM login, My Day, pipeline, SLA display; confirm all fail-closed gates still read OFF.
- **Migration expectation:** **no managed migration apply required**, unless repository/remote migration state changes after the P1 audit.
- **Exit gate:** production served SHA equals the certified `main` head; smoke matrix PASS with evidence; every OFF gate verified still OFF.

### P3 — CRM 2A–2E + SLA operational certification

- **Objective:** Certify the full CRM daily-execution loop in production, including the already-active first-contact SLA, without rebuilding certified capability.
- **Scope:** My Day, follow-up control plane, calendar + pipeline, cadences, communication intelligence, management analytics, SLA measurement and admin settings; role isolation proof across all five roles.
- **Exit gate:** role-scoped E2E PASS; SLA satisfaction computed from `first_contact_attempt_at` and non-retroactive; zero executive cross-visibility; no open lead without a next action; defects (if any) fixed forward with tests.

### P4 — Quotation → Closed-Won → project / design / execution certification

- **Objective:** Certify the commercial and delivery chain end to end in production.
- **Scope:** quotation draft → finalize → deliver → accept; Closed-Won invariant; project materialization and PM handover; designer assignment and design collaboration; execution workspace.
- **Exit gate:** Closed-Won provable only from an accepted quotation (ADR-0020 / ADR-0022); no double-counted value against Phase 5E targets; document/storage access proven RLS-scoped and signed-URL only.

### P5 — Staff administration, attendance & leave activation

- **Objective:** Resolve the outstanding owner-value gaps and activate attendance/leave operationally.
- **Scope:** attendance policy values, holiday calendar, leave types, `attendance.correct.team` grant decision; idempotent check-in/check-out verified in production. Workforce V1 attendance lifecycle, salary and payment rules are locked in [docs/12](12-workforce-v1-attendance-salary.md) (**DEC-0098**).
- **Owner values RESOLVED** and recorded in **DEC-0099** / [docs/12 §13.1](12-workforce-v1-attendance-salary.md): Sales Manager attendance tracked **YES**; Sales Manager direct-report correction **NO** (`attendance.correct.team` stays Super-Admin-only); launch leave types **casual / sick / unpaid**; half-day **leave** **not approved** at launch; approved leave cancellation **NO**; holidays start **EMPTY** and manual; location **optional**; **no** fixed weekly-off weekday; salary/payment values **not supplied**.
- **Repository state:** attendance lifecycle, salary/payment ledger and staff phone-login schema are **merged and already applied to managed**. The attendance policy is **published on managed**. M57 `20260904170000` adds the launch leave catalogue and nothing else.
- **Remaining gate is OWNER-ONLY and LIVE**, in this order: apply M57 to managed → deploy → Super Admin sets SM001 attendance eligibility with a reason → Super Admin issues credentials against the staff member's **own** mobile with an owner-chosen private password → staff performs a **first real login** → **real attendance E2E** on production.
- **Exit gate:** owner values recorded in governance (**done**); correction authority explicitly withheld (**done**); M57 applied; real attendance E2E **PASS** on production with no fabricated schedules, no invented salary values and no seeded holidays. **The E2E is NOT complete and must not be reported as such until a real staff member has checked in, checked out, submitted and been approved on production.**

### P6 — Landing Lab + campaign production activation

- **Objective:** Activate the Landing Lab public surface and campaign execution under consent-safe controls.
- **Scope:** `/lp/[slug]` public gate; deterministic A/B/C with human winner selection; campaign runs against immutable approved 9A versions; provider metrics as evidence only.
- **Exit gate:** MARKETING consent + DNC + suppression rechecked at export time; CRM touchpoints remain attribution truth; one Ads provider per run (dual paid channels fail closed); **live spend remains a separate explicit owner authorization** and stays OFF until granted.

### P7 — Kriti provider production activation

- **Objective:** Activate the Kriti copilot provider in production as a human-controlled assist.
- **Scope:** provider enablement, `kriti_runs` / `kriti_events` audit persistence under load, staff-authorized inbox assist.
- **Exit gate:** no autonomous send; no status change; no direct DB mutation by the copilot; every run and event audited; the provider-disabled default path proven to still fail closed.

### P8 — E-commerce production activation **(SECOND-LAST)**

- **Objective:** Activate the public COD storefront.
- **Scope:** set `ONEDECORE_SHOP_PUBLIC_ENABLED=true`; publish catalogue; guest cart → COD checkout → order tracking; admin orders operations; sitemap inclusion.
- **Exit gate:** guest COD E2E PASS in production; pincode serviceability enforced; inventory decrement correct and idempotent; admin order lifecycle PASS.
- **Hard boundary:** P8 **MUST NOT** activate online payments. **M38 stays absent.** Online payments remain deferred pending separate 9D-E certification and explicit owner activation (ADR-0033 / DEC-0094).

### P9 — Meta WhatsApp + n8n production activation **(FINAL)**

- **Objective:** Activate the official Meta WhatsApp Cloud API live callback and outbound, and the controlled n8n automation bus. Final phase of ONEDECORE completion.
- **Scope:** verified production webhook/callback; token activation; approved-template outbound on the `WHATSAPP_SERVICE` purpose; dispatch reconciliation; n8n as async notification bus only.
- **Exit gate:** database-before-automation proven (persist first, notify second); `MARKETING` outbound remains blocked on the service path; DNC and channel suppression enforced pre-send; idempotent dispatch with no duplicate customer messages; n8n never holds consent, attribution, retry, or lead truth; unofficial WhatsApp Web automation absent.
- **On completion:** ONEDECORE is feature-complete against this roadmap. Remaining deferred item: online payments / M38.

---

## 7. Branch hygiene rule

Stale branch inspection happens **after** a phase's documentation/implementation work is complete, never bundled into it.

A branch is **not** deletable merely because it is old. Deletion requires proof that every unique commit on that branch is already superseded on protected `main`, and that evidence must be recorded. Deletion is **optional**. If deletion creates any risk, do not bundle it — leave the branch.

`phase-9d-e-online-payments` @ `b2ea05c243d03d3e88385189b8a7098a8ffe20c8` is **deliberately preserved** and must not be deleted.

---

## 8. Related governance documents

- [00 — Project Truth & Governance Baseline](00-project-truth.md) — current-state truth
- [09 — Phase Implementation Roadmap](09-phase-roadmap.md) — **historical** implementation roadmap + evidence ledger
- [10 — Decision Register](10-decision-register.md) — DEC-0097 governs this document
- [CRM 2.0 Product Roadmap](product/crm-2.0-roadmap.md) — **historical** approved CRM product plan (implemented through 2E)
- [06 — Security, Privacy & RLS](06-security-privacy-and-rls.md)
- [08 — WhatsApp & n8n Boundary](08-whatsapp-and-n8n-boundary.md)
- [12 — Workforce V1: Attendance, Salary & Payment Lock](12-workforce-v1-attendance-salary.md) — DEC-0098
- [ADR-0019: Five-Role CRM Authorization Model](ADR/ADR-0019-five-role-crm-authorization-model.md)
- [ADR-0021: Groq Copilot and WhatsApp Boundary](ADR/ADR-0021-groq-copilot-and-whatsapp-boundary.md)
- [ADR-0033: COD-first launch and online payment deferral](ADR/ADR-0033-phase-9d-cod-first-launch-and-online-payment-deferral.md)

---

## 9. Revision history

| Date | Change |
| :--- | :--- |
| 2026-09-02 | Owner lock. Accelerated closeout roadmap created as current execution authority at protected `main` `27bcee1f36468175e1509e5ec10a0b3533f9c7d7`. P1–P9 sequence locked; P8 e-commerce second-last; P9 Meta WhatsApp + n8n final. DEC-0097 recorded. |
