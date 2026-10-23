# ONEDECORE — INT-10A–F Final Internal Certification

**Date:** 23 October 2026, IST
**Branch:** `feat/onedecore-int9-final-closure`
**Initial baseline:** `27521f031195a8b749bebeceae0ba22ad475b816`
**Final deployment decision:** **HOLD** pending independently approved DBA/AppSec, managed Staging certification, Meta/number activation, authorized outbound testing and Production release permission.
**Internal source-development decision:** **COMPLETE**, subject to the final committed GitHub quality gate being green and integrity verification on that same commit. This does **not** authorize activation, deployment or external messaging.

## INT-10A — Existing INT-7 evidence reconciliation

A second local/remote inventory found **230 origin branch references** with **no standalone INT-7/INT-8 branch name**, and no local INT-7/8 worktree or reflog entry. The claimed historical patch provenance cannot be independently reconstructed, so **we do not claim an original INT-7 commit was merged**.

Instead, the INT-7 acceptance requirements were checked against the current pinned source and actual tests:

- Security of campaign SQL authorities: worker-only RPCs, staff-only RPCs, search_path and table RLS (INT-10D).
- Competing workers: two simultaneous SQL claim sessions, active lease exclusion, pre-provider expired claim retries and stale-token denial, ambiguous post-provider reconciliation (INT-9B, **11/11 PASS**).
- CRM mobile and keyboard accessibility: authenticated Chrome, four routes at 360/390/768/1366px (INT-10B, **16/16 PASS**).
- Reproducible source/migration SHA-256 inventory; fail-closed activation controls (INT-10F).

**Provenance exception:** original INT-7 source identity unavailable. Functional acceptance replaces missing historical logs; a reviewer should preserve this note, not infer a recovered cherry-pick.

## INT-10B — Authenticated Scheduler/browser

The INT-9 browser finding was genuine: Scheduler root overflow **447px/417px/69px** at **360/390/768px**. The narrow source fix sets the parent grid/calendar shell to shrink while month grid scrolls internally. After the patch, the actual logged-in CRM browser probe produced **16/16 PASS**: Leads, Nurture, Scheduler and Reports at **360, 390, 768 and 1366px**. No root overflow; visible interactive elements have names; first keyboard Tab reaches focusable content on audited keyboard widths. This is functional/browser acceptance, not a claim of a full WCAG audit.

## INT-10C — Sales Executive login and isolation

Root cause of old 90-second transition failure was an **obsolete QA script**, not an authentication bypass: it submitted the Sales Executive *email* to the Super Admin login form. The application enforces distinct portals: Super Admin email, staff **10-digit phone → server-only alias**. Only the **disposable local test fixture** was updated to register executive phone-derived Auth aliases; the browser switched to the **staff** portal. No production authentication rule or permission was changed.

Authenticated CRM 2E owner QA: **30/30 PASS** on dedicated fixture; browser reports: **73/73 PASS**, including Super Admin → Sales Executive login, personal-performance scope, no manager/team metrics, prevention of URL-assisted assignee escalation, no console exceptions or failed requests.

## INT-10D — Governance, consent and workers

Ran `node scripts/int10-governance-audit.mjs` against disposable project `OneDecoreInt10Cert` with both WhatsApp outbound/webhook environment modes disabled.

- **9/9** campaign worker definer RPCs have pinned empty search_path and are executable by `service_role` **only**, not `anon` or `authenticated`.
- **12/12** staff campaign RPCs have pinned search_path and authenticated-only grants, not anonymous.
- **7/7** campaign tables have RLS **enabled and forced**; authenticated direct DML **0**; anonymous SELECT **0**.
- Local synthetic marketing execution policy: **disabled**.
- Independent actual SQL concurrency certification (INT-9B): **11/11 PASS**, zero provider messages.
- Clean pgTAP SQL tests for WhatsApp execution, consent, dynamic send-time audiences, frequency caps, quiet hours, scheduling, nurture, recurrence, sender activation, and revenue attribution all PASS.

The wider 622 definer-function system and 15 anonymous-executable functions still require **independent AppSec review** before managed activation. An existing grant is not automatically a vulnerability; per-function effective authorization must be reviewed externally. There are **three reported moderate** production dependency findings, no unreviewed critical/high findings under the current dependency gate.

## INT-10E — Final isolated regression

- `npm run test:app`: **5,134/5,134 PASS**
- `npm run test:image`: **17/17 PASS**
- `npm run check`: environment/dependency guards, ESLint **0 errors**, TypeScript and Next.js production build **PASS** (warnings recorded)
- Fresh isolated `npm run db:reset`: **PASS**
- `npm run check:db`: **82/82 pgTAP files, 4,351/4,351 assertions PASS**
- Earlier contaminated database suite was **not accepted**: local synthetic browser/worker cohorts collided with SQL-test fixtures. The passing result above is from a fresh reset with no extra synthetic browser data.

## INT-10F — Source certification and release gates

Source manifest: `ops/releases/onedecore-int9-20261023-hold.json`.

Verify with:
```powershell
npm ci
npm run check
npm run test:app
npm run test:image
npm run int9:verify
node --test scripts/int9-release-preflight.test.mjs
```

For DB and rendered tests, use a disposable, never-shared local Supabase instance only. Never run `db:reset` against managed or shared databases. CI's Application and Database quality jobs must both complete successfully on **the final HEAD**. The manifest locks in changed source, final report, regression probes and the full 109-migration inventory. Internal certification flags indicate only local development evidence; independent DBA/AppSec approval, Staging, Meta, outbound messaging and Production authorization **remain false**, and decision remains **HOLD**.

**No managed Staging/Production databases, privileged managed Auth accounts, Meta or live outbound messaging were modified during INT-10.**
