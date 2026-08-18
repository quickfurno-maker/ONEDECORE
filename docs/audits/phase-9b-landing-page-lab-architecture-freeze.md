# Phase 9B — Landing Page Lab & Experimentation Architecture Freeze

**Date:** 2026-08-18  
**Branch:** `phase-9b-landing-page-lab-architecture-freeze`  
**Owner authorization:** `LOCK PHASE 9B OWNER DECISIONS AS RECOMMENDED`  
**Architecture:** ADR-0029 / DEC-0081 / OD9B-1–OD9B-12  
**Gate:** docs-only freeze — **no M32**, **no managed write**, **no `src/**` change**, **no public activation**

---

## A. Identity

| Item | Value |
| :--- | :--- |
| Protected main base | `083b7384b05199dd4bbed8882cb8e4a585fe2393` |
| Phase 9A | **COMPLETE** — PR #63 merged; managed M31 immutable |
| Repository migrations | **M1–M31** |
| Managed OneDecore `lpurlfmpvriyvpkujvyl` | **M1–M31**, pending NONE |
| M32 | **ABSENT / NOT CREATED** |
| Phase 9B implementation | **NOT STARTED** |
| Phase 9C | **NOT STARTED** |
| Phase 9D | **ROADMAP_LOCKED / NOT STARTED** |
| Production activation | **NONE** |
| Public lead intake | **OFF** / Phase 10 gated |

Protected local stashes observed before the gate and to remain untouched:

- `phase-9d-roadmap-lock-pending-after-pr63`
- `pre-phase-5c local residue 2026-07-31`

---

## B. Entry Audit

`PHASE_9B_ENTRY_AUDIT: PASS`

Repository/managed observations:

- No existing ADR-0029.
- No existing OD9B architecture authority.
- No M32.
- No landing-page database tables.
- No dedicated landing-page permissions.
- No mounted `/admin/landing-pages` route.
- Existing `/admin/campaigns` belongs to Phase 9A governance.
- Existing `/api/public/lead-intake` is the only public lead write boundary.
- Existing `public.leads` atomically stores `landing_path` and `attribution`.
- Existing CRM after-insert trigger creates the first append-only `lead_source_touchpoints` row.
- Existing CRM lifecycle already includes `qualified`, `consultation_scheduled`, `proposal_sent`, and `closed_won`.
- Existing public intake explicitly does not grant MARKETING consent.
- Phase 9A M31 keeps `campaign_versions.destination_reference` opaque; there is no Phase 9B FK.
- Existing Landing Lab prebuild is substantial but explicitly not architecture authority.

### Managed read-only recheck at entry

| Object | Count / state |
| :--- | ---: |
| Managed migration count | 31 |
| Latest managed migration | `20260818140000` |
| `campaigns` | 0 |
| `campaign_versions` | 0 |
| `leads` | 0 |
| `lead_source_touchpoints` | 0 |
| landing permission rows | 0 |
| `landing_pages` table | absent |
| `landing_page_versions` table | absent |
| `landing_publications` table | absent |
| `landing_experiments` table | absent |

Managed writes in this architecture gate: **NONE**.

---

## C. Prebuild Reconciliation Findings

The migration-independent `src/features/landing-lab/**` prebuild remains useful engineering material, but implementation must reconcile it to this architecture.

### C1. Publication lifecycle mismatch

Prebuild publication states: `draft | scheduled | live`.

Locked Phase 9B states:

`draft → live ↔ paused → archived`

`scheduled` is not a 9B publication state; campaign scheduling belongs to Phase 9C.

### C2. Variant-count mismatch

Prebuild permits up to eight experiment variants.

Locked V1 permits only:

- A/B; or
- A/B/C.

Maximum = 3.

### C3. Attribution boundary mismatch

Landing prebuild understands UTM + `fbclid`/`gclid`.

Current live public intake validator only allowlists:

- landing path;
- referrer path;
- UTM source/medium/campaign/term/content.

Phase 9B implementation must add bounded click-ID handling without opening arbitrary attribution keys.

### C4. Trusted landing identity

Client attribution cannot be allowed to self-assert canonical:

- page;
- page version;
- publication;
- experiment;
- variant;
- ONEDECORE campaign identity.

Those values must come from verified server-issued signed publication context.

### C5. Route/RBAC gap

No dedicated Landing Lab admin route or permission exists.

The clean mount is:

- `/admin/landing-pages`;
- `/lp/[slug]`.

### C6. Public route documentation mismatch

Documentation refers to `/consultation`, but the audited current app tree does not expose a dedicated consultation route at this baseline. Phase 9B must not depend on a route merely because documentation names it.

---

## D. Locked Owner Decisions

### OD9B-1
`STRUCTURED_BLOCK_VERSIONING_NO_FREEFORM_HTML`

### OD9B-2
`DRAFT_LIVE_PAUSED_ARCHIVED_NO_SCHEDULER`

### OD9B-3
`DETERMINISTIC_ABC_HUMAN_WINNER`

### OD9B-4
`OPAQUE_CAMPAIGN_LINK_NO_M31_REWRITE`

### OD9B-5
`REUSE_EXISTING_ATOMIC_PUBLIC_INTAKE`

### OD9B-6
`ENRICH_EXISTING_LEAD_SOURCE_TOUCHPOINT_NO_PARALLEL_ATTRIBUTION_TRUTH`

### OD9B-7
`SERVICE_ENQUIRY_ONLY_NO_FABRICATED_MARKETING_CONSENT`

### OD9B-8
`CRM_STAGE_DERIVED_NO_PARALLEL_LEAD_QUALITY_STATUS`

### OD9B-9
`SA_SM_LANDING_LAB_MANAGEMENT_ONLY`

### OD9B-10
`ADMIN_LANDING_PAGES_PLUS_PUBLIC_LP_SLUG`

### OD9B-11
`PRIVACY_SAFE_EXPOSURE_EVENTS`

### OD9B-12
`PHASE10_PRODUCTION_GATE_NO_9C_EXECUTION`

Full rationale and implementation constraints are authoritative in ADR-0029.

---

## E. Conceptual M32 Persistence

M32 is conceptually reserved as:

`landing_page_lab_experimentation_foundation`

Conceptual public domain:

- `landing_pages`;
- `landing_page_versions`;
- `landing_publications`;
- `landing_experiments`;
- `landing_experiment_variants`;
- `landing_exposures`.

Existing data reused:

- `leads.landing_path`;
- `leads.attribution`;
- `lead_source_touchpoints`;
- existing CRM lead stages;
- Phase 9A campaign identity as optional opaque snapshot only.

Not created:

- parallel leads;
- landing consent table;
- landing attribution truth table;
- campaign recipient table;
- provider campaign-run table;
- provider spend table;
- generic CDP/event warehouse.

---

## F. Canonical Lifecycle

### Page versions

`editable draft → frozen immutable`

Any later content change = new version.

### Publication

`draft → live ↔ paused → archived`

Archive terminal.

### Experiment

`draft → running → concluded`

Running configuration frozen. Human winner only.

---

## G. Public Lead Flow

Canonical future `/lp/[slug]` flow:

1. server resolves current live publication;
2. server resolves deterministic variant;
3. server records privacy-safe exposure/assignment;
4. server signs publication context;
5. form submits through `/api/public/lead-intake`;
6. server verifies same-origin + signed publication context;
7. existing intake validation/identity/rate/idempotency/consent rules run;
8. existing atomic `submit_lead_intake` persists contact/lead/consent;
9. `leads.landing_path` + `leads.attribution` hold intake snapshot;
10. existing CRM first touchpoint is enriched forward-only with campaign/landing metadata;
11. analytics derive qualification from existing CRM status;
12. n8n/provider feedback, if any later, happens after truth persistence.

---

## H. RBAC

Conceptual Landing Lab permissions:

- `landing_pages.read`;
- `landing_pages.manage`;
- `landing_pages.publish`;
- `landing_experiments.manage`;
- `landing_analytics.read`.

V1 roles with authority:

- Super Admin;
- Sales Manager.

No Landing Lab management authority:

- Sales Executive;
- Project Manager;
- Designer;
- Kriti;
- anonymous/public.

---

## I. Security & Privacy

- Structured blocks only; no arbitrary HTML/script.
- Database immutability for frozen versions.
- Database transition guards for publication/experiment states.
- RLS on all API-exposed M32 tables.
- No anonymous direct mutations.
- Service role never in browser.
- Signed publication context required for Landing Lab submissions.
- Exposure denominator contains no PII/raw IP/raw visitor cookie.
- MARKETING consent is never fabricated.
- DNC/suppression preserved.
- Public campaign pages default `noindex, nofollow`.
- Unknown/paused/archived pages fail without leaking internal state.

---

## J. Boundaries

### Included in 9B implementation

- structured editor;
- immutable versions;
- preview;
- publish/pause/archive;
- A/B/C deterministic experiments;
- human winner;
- signed context;
- privacy-safe exposures;
- intake attribution bridge;
- CRM-derived quality analytics;
- dedicated SA/SM RBAC.

### Excluded

- Meta/Google mutations;
- spend/cost reporting;
- provider conversion feedback;
- WhatsApp MARKETING execution;
- audience export;
- autonomous AI optimization;
- production activation;
- Phase 9D commerce.

---

## K. Docs-Only Changed Files

Expected in this architecture freeze:

- `docs/00-project-truth.md`
- `docs/01-product-requirements.md`
- `docs/02-architecture.md`
- `docs/03-public-site-and-sitemap.md`
- `docs/05-supabase-data-domains.md`
- `docs/06-security-privacy-and-rls.md`
- `docs/07-crm-and-quotation-boundary.md`
- `docs/08-whatsapp-and-n8n-boundary.md`
- `docs/09-phase-roadmap.md`
- `docs/10-decision-register.md`
- `docs/ADR/ADR-0029-phase-9b-landing-page-lab.md`
- `docs/audits/phase-9b-landing-page-lab-architecture-freeze.md`

Forbidden in this gate:

- `supabase/**`;
- `src/**`;
- `package.json`;
- lockfile;
- env/config/secrets;
- deployment/provider configuration.

---

## L. Validation Gate

Before opening the architecture PR:

- branch base must remain exact protected main `083b7384...`;
- changed-file containment must match Section K;
- `git diff --check` must pass;
- M32 must remain absent;
- no managed write;
- no protected stash mutation;
- exact-head ONEDECORE Quality Gate required on PR;
- passing existing `test:phase-9b` is not required to redefine architecture, because prebuild reconciliation belongs to implementation;
- no public route activation in this docs-only PR.

---

## M. Exit State

After merge of this architecture PR:

- Phase 9B = `ARCHITECTURE_FROZEN`;
- M32 = absent;
- managed DB = still M1–M31;
- production = inactive;
- next formal gate = `PHASE_9B_M32_IMPLEMENTATION_PREFLIGHT`.

This freeze authorizes architecture only. It does not authorize M32 creation, managed apply, Phase 9C execution, Phase 9D implementation, or production activation.
