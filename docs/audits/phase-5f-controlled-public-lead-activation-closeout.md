# Phase 5F — Controlled Public Lead Activation Closeout

**Audit state:** READY FOR OWNER MERGE REVIEW  
**Date:** August 4, 2026  
**Implementation merge:** protected main PR #17 — `2e3f3322b35865c7661a0abeeaa7f0823ed8a593`  
**Migration 17:** `20260804140000_controlled_public_lead_activation_hardening.sql`  
**M17 SHA-256:** `B8F5B75AC6EE64DE1E9ABD571A215FF3AABE6F54D98EFE1F8BBEF679871A0FC6`  
**Managed project:** OneDecore (`lpurlfmpvriyvpkujvyl`, ap-south-1)

**Phase 5F closes only when this governance PR merges on protected main.**

---

## A. Scope and closeout objective

Close Phase 5F in repository governance after:

1. Phase 5F-A architecture/evidence preflight
2. Phase 5F-B local implementation and QA
3. H1 real browser/mobile QA
4. Phase 5F-C PR gate (PR #17)
5. Protected-main merge
6. DB-6A physical recovery readiness (Route A)
7. DB-6B managed M17 apply and verification

This closeout PR truth-syncs governance documents only. **No runtime, SQL, test, deployment, managed write, or public activation.**

---

## B. Phase 5F-A freeze

- Architecture/evidence preflight frozen before implementation.
- M9 defect documented: active-only phone lookup on DNC/suppressed re-enquiry.
- `::1` loopback gap documented.
- Public intake confirmed inactive; dual gates `copy-only` / `disabled`.

---

## C. Phase 5F-B implementation

| Item | Value |
| :--- | :--- |
| Migration | M17 `20260804140000_controlled_public_lead_activation_hardening.sql` |
| Private resolver | `private.resolve_lead_intake_contact_by_phone` |
| Public RPC patch | `public.submit_lead_intake` identity integration |
| Runtime | `lead-intake-runtime.ts` loopback hardening |
| pgTAP | `11_controlled_public_lead_activation_test.sql` |
| App tests | `phase-5f-b-controlled-activation.test.ts` (34 tests) |
| DB QA | 482/482 PASS |
| App QA | 430/430 PASS |

---

## D. H1 browser/mobile evidence

| Item | Result |
| :--- | :--- |
| Desktop | 1440×900 PASS |
| Mobile | 390×844 PASS |
| Normal interaction | Zero lead-intake POSTs |
| Disabled endpoint | 503 `LEAD_INTAKE_DISABLED` |

---

## E. PR #17 merge

| Item | Value |
| :--- | :--- |
| PR | #17 |
| Merge SHA | `2e3f3322b35865c7661a0abeeaa7f0823ed8a593` |
| Merge UTC | 2026-08-04T05:25:39Z |
| Post-merge CI | run `30880650145` — Application Quality SUCCESS; Database Quality SUCCESS |

---

## F. DB-6A physical recovery evidence

| Item | Value |
| :--- | :--- |
| Route | **A** — qualifying physical backup |
| Backup ID | `1281893546` |
| inserted_at | `2026-08-03T19:53:32.414Z` |
| Status | COMPLETED (WALG physical) |
| M16 apply completion | `2026-08-03T18:56:22.4376084Z` |
| Qualification | Post-M16; valid **pre-M17** recovery point |

Route B logical checkpoint was **not required**.

---

## G. DB-6B managed M17 apply

| Item | Value |
| :--- | :--- |
| Apply window (UTC) | 2026-08-04T06:41:03.5697230Z – 06:41:13.2499471Z |
| Mechanism | `npx supabase db push --linked --yes` |
| Result | SUCCESS (exit 0) |
| Post-apply migrations | M1–M17 aligned |
| Post dry-run | Up to date |
| M17 objects | Resolver present; submit RPC integrated |

---

## H. Security / RBAC / RLS / data preservation

| Metric | Pre | Post | Match |
| :--- | :--- | :--- | :--- |
| Public application tables | 28 | 28 | YES |
| Row counts (all tables) | baseline | baseline | **28/28** |
| permissions | 29 | 29 | YES |
| role_permissions | 90 | 90 | YES |
| user_roles | 2 | 2 | YES |
| RLS-enabled tables | 28 | 28 | YES |
| RLS policies | 52 | 52 | YES |

Resolver grants: postgres only (no PUBLIC/anon/authenticated/service_role).  
submit_lead_intake grants: postgres + service_role only.  
`npx supabase db lint --linked`: no schema errors.

Security Advisor: catalog-verified PASS post-M17; no new M17-specific issues identified in DB-6B.

---

## I. Public activation boundary

| Control | Status |
| :--- | :--- |
| Browser gate | `copy-only` |
| Server gate | `disabled` |
| Public intake | **INACTIVE** |
| Deployment | **NONE** |

M17 managed presence does **not** authorize public submission or production activation.

---

## J. Phase 10 outstanding production gates

Before production public lead activation:

- Legal/privacy activation evidence
- CAPTCHA/abuse controls evaluation
- Production monitoring
- **Current** fresh physical backup or qualified active PITR (backup `1281893546` is pre-M17 and does not permanently satisfy Phase 10)
- E2E on production domain
- Separate owner production activation authorization

---

## K. Final closeout readiness

| Item | Status |
| :--- | :--- |
| Implementation merged | YES (PR #17) |
| Managed M17 applied | YES (DB-6B) |
| Recovery evidence | YES (DB-6A Route A) |
| Public intake inactive | YES |
| Governance truth-sync PR | **THIS PR** |
| Phase 5F formal COMPLETE | **After this PR merges** |
| Phase 6A | NEXT / NOT STARTED |
| Decisions recorded | DEC-0054, DEC-0055 |

---

## Related documents

- [Phase 5F Audit](phase-5f-controlled-public-lead-activation.md)
- [Project Truth](../00-project-truth.md)
- [Phase Roadmap](../09-phase-roadmap.md)
- [Decision Register](../10-decision-register.md)
