# Phase 5F — Controlled Public Lead Activation Audit

**Phase:** 5F-B (local implementation + local QA)  
**Status:** Local hardening complete; **Phase 5F not closed**; public intake **inactive**  
**Date:** 2026-08-04

## 5F-A findings addressed

| Finding | 5F-B action |
| :--- | :--- |
| M9 active-only phone lookup creates duplicate contacts on DNC/suppressed re-enquiry | M17 `resolve_lead_intake_contact_by_phone` + `submit_lead_intake` patch |
| `::1` loopback host rejected by naive host parsing | `parseLocalTestHostname` / `isLocalTestHost` in `lead-intake-runtime.ts` |

## M17 purpose (local only)

**File:** `supabase/migrations/20260804140000_controlled_public_lead_activation_hardening.sql`  
**Managed state:** LOCAL only — not applied to `lpurlfmpvriyvpkujvyl` in 5F-B

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

| Gate | Default | 5F-B change |
| :--- | :--- | :--- |
| `NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE` | `copy-only` | None |
| `ONEDECORE_LEAD_INTAKE_MODE` | `disabled` | None |

## Loopback hardening

Accepted: `localhost`, `127.0.0.1`, `::1`, bracketed `[::1]`, with optional ports.  
Rejected: public hosts, LAN IPs, `localhost.attacker.com`.  
`X-Forwarded-For` does not grant loopback authority.

## Public activation

**Prohibited in 5F-B.** Production activation remains Phase 10 only.

## Phase 10 unresolved evidence

- Legal/privacy activation fields
- CAPTCHA/Turnstile evaluation
- Production abuse monitoring
- Physical backup / PITR verification
- E2E on production domain
- Owner activation authorization

## Local QA evidence

- Local DB reset M1–M17 from zero
- pgTAP: `supabase/tests/database/11_controlled_public_lead_activation_test.sql`
- App: `src/features/lead-intake/__tests__/phase-5f-b-controlled-activation.test.ts`
- `npm run check` and full established test suites (see Phase 5F-B closeout report)

## Regression containment

No changes to sales targets/reporting, Closed-Won gate, quotations, projects, WhatsApp, portfolio, Landing Page Lab, deployment, or governance docs (README/roadmap/decision register).
