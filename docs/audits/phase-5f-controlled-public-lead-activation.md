# Phase 5F — Controlled Public Lead Activation Audit

**Phase:** 5F (implementation + managed apply + closeout)
**Status:** **READY TO CLOSE** — formally COMPLETE after closeout governance PR merges on protected main
**Date:** 2026-08-04
**Public intake:** **INACTIVE** (`copy-only` / `disabled`)

---

## Phase completion summary

| Sub-phase | Status |
| :--- | :--- |
| 5F-A architecture/evidence preflight | **COMPLETE** |
| 5F-B local implementation + QA | **COMPLETE** / merged |
| H1 real browser/mobile QA | **PASS** |
| 5F-C PR gate | **COMPLETE** |
| PR #17 merge | **COMPLETE** (`2e3f3322b35865c7661a0abeeaa7f0823ed8a593`) |
| DB-6A physical recovery readiness | **COMPLETE** (Route A) |
| DB-6B managed M17 apply | **COMPLETE** |
| 5F closeout governance PR | **PENDING MERGE** |

---

## 5F-A findings addressed

| Finding | 5F-B action |
| :--- | :--- |
| M9 active-only phone lookup creates duplicate contacts on DNC/suppressed re-enquiry | M17 `resolve_lead_intake_contact_by_phone` + `submit_lead_intake` patch |
| `::1` loopback host rejected by naive host parsing | `parseLocalTestHostname` / `isLocalTestHost` in `lead-intake-runtime.ts` |

## M17 (managed applied)

**File:** `supabase/migrations/20260804140000_controlled_public_lead_activation_hardening.sql`  
**SHA-256:** `B8F5B75AC6EE64DE1E9ABD571A215FF3AABE6F54D98EFE1F8BBEF679871A0FC6`
**Managed state:** **APPLIED** on `lpurlfmpvriyvpkujvyl` (Phase DB-6B, 2026-08-04)

1. Private helper discovers contact identity by normalized phone E.164 across `active` and `suppressed` phone channels.
2. Preserves `contacts.status = do_not_contact` and suppressed channel state.
3. Fails safely with `contact_identity_conflict` when multiple distinct contacts match.
4. No marketing consent fabrication; no auto-reactivation.

## D1 DNC re-enquiry behavior

- Reuse existing contact when phone channel is suppressed and contact is DNC.
- Create legitimate new lead (`status=new`, `assigned_to=null`).
- DNC remains set; phone channel remains suppressed.
- SERVICE_ENQUIRY + SERVICE_COMMUNICATION (phone) consent only.

## Normalized-phone identity contract

- Exactly one eligible contact → reuse.
- Zero eligible contacts → create contact + active phone channel (unchanged).
- More than one eligible contact → deterministic `contact_identity_conflict`; no lead/contact write.

## Dual gates unchanged

| Gate | Default | 5F change |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE` | `copy-only` | None |
| `ONEDECORE_LEAD_INTAKE_MODE` | `disabled` | None |

## Loopback hardening

Accepted: `localhost`, `127.0.0.1`, `::1`, bracketed `[::1]`, with optional ports.  
Rejected: public hosts, LAN IPs, `localhost.attacker.com`.  
`X-Forwarded-For` does not grant loopback authority.

## PR #17 evidence

| Item | Value |
| :--- | :--- |
| PR | #17 |
| Merge SHA | `2e3f3322b35865c7661a0abeeaa7f0823ed8a593` |
| Merge UTC | 2026-08-04T05:25:39Z |
| Post-merge CI | run `30880650145` — App + DB SUCCESS |

## QA evidence

| Suite | Result |
| :--- | :--- |
| Database (pgTAP + lint) | **482/482** PASS |
| Application (`npm run test:app`) | **430/430** PASS |
| Phase 5F-B app tests | **34/34** PASS |
| H1 browser QA | **PASS** — desktop 1440×900, mobile 390×844; zero normal intake POSTs; disabled endpoint 503 `LEAD_INTAKE_DISABLED` |
| Security (catalog) | **PASS** — no new M17-specific issues; `db lint` clean post-apply |

## DB-6A recovery evidence

| Item | Value |
| :--- | :--- |
| Route | **A** — qualifying physical backup |
| Backup ID | `1281893546` |
| inserted_at | `2026-08-03T19:53:32.414Z` |
| Status | COMPLETED (WALG physical) |
| Qualification | Post-M16 apply (`2026-08-03T18:56:22.4376084Z`); valid **pre-M17** recovery point |

## DB-6B managed apply evidence

| Item | Value |
| :--- | :--- |
| Apply window (UTC) | 2026-08-04T06:41:03.5697230Z – 06:41:13.2499471Z |
| Result | SUCCESS (exit 0) |
| Post-apply migrations | M1–M17 aligned |
| Post dry-run | Up to date |
| Row preservation | **28/28** exact match |
| Permissions | 29 |
| `role_permissions` | 90 |
| `user_roles` | 2 |
| RLS-enabled public tables | 28 |
| RLS policies | 52 |

## Public activation boundary

**Public intake remains INACTIVE.** Production activation requires Phase 10 with separate owner authority, legal/privacy gates, abuse controls, and **current** fresh physical backup or qualified PITR — backup `1281893546` does not permanently satisfy Phase 10.

## Phase 10 outstanding gates

- Legal/privacy activation fields
- CAPTCHA/Turnstile evaluation
- Production abuse monitoring
- **Current** physical backup or qualified PITR at activation time
- E2E on production domain
- Owner production activation authorization

## Regression containment

No changes to sales targets/reporting commercial truth, Closed-Won gate, quotations, projects, WhatsApp, portfolio, Landing Page Lab, deployment, or runtime beyond Phase 5F scope.

## Closeout

Phase 5F becomes formally **COMPLETE** only when the governance closeout PR merges on protected main. See [Phase 5F Closeout Audit](phase-5f-controlled-public-lead-activation-closeout.md).
