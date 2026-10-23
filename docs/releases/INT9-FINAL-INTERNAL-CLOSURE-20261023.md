# ONEDECORE INT-9 — Final Internal Closure review candidate (HOLD)

Date: 2026-10-23 (IST)
Branch: `feat/onedecore-int9-final-closure`
Baseline: `27521f031195a8b749bebeceae0ba22ad475b816`.

## Verified on JARVIS

- The previously described INT-7 branch and finished INT-8 evidence were **not present** on the connected PC or in available published GitHub branches. Their completion cannot be inferred from the narrative alone.
- Initial source application tests: **5,133/5,133 PASS**. Image pipeline: **17/17 PASS**.
- Critical Next.js and high Sharp production advisories patched. Production dependency verifier: **0 critical, 0 high, 3 moderate**. Moderates still require review, and the wider dev-dependency audit is separate.
- Updated `npm run check`: PASS (env/test/dependency checks, lint with 0 errors and warnings, TypeScript and production build).
- Unique disposable Supabase instance `OneDecoreInt9Cert`, ports 5932x: reset PASS; `npm run check:db` PASS, **82 SQL test files / 4,351 assertions**.
- PostgreSQL catalog in this disposable lab: **622 SECURITY DEFINER functions**, all **622** with explicit search_path; **15** callable by anon, **333** by authenticated. Permission counts are not approval of each exposed function.
- This branch adds a deterministic hash manifest, tampering-negative tests and an immutable HOLD decision, plus a CI verification step.

## INT-7/8 remaining acceptance evidence

| Track | Verified | Not yet certified |
| --- | --- | --- |
| INT-7A privileged functions | Catalog inventory and existing pgTAP PASS | Independent role-by-role AppSec/RLS decisions |
| INT-7B competing workers | Code uses service-role guards and `FOR UPDATE SKIP LOCKED`; existing pgTAP PASS | Real two-worker contention with synthetic dispatch jobs and replay/reconcile evidence |
| INT-7C CRM accessibility | Source application tests PASS | Manual/automated mobile browser checks for keyboard, focus, scrolling and assistive labels |
| INT-7D release integrity | Digest manifest and explicit HOLD refusal | Post-commit frozen SHA, external review and release signatures |
| INT-8 regression | 5,133/5,133 app tests **rerun after patch**, 17/17 image tests, 4,351 SQL assertions, production build | Final browser/concurrency evidence |

## Review commands

```powershell
npm ci
npm run check
npm run test:app
npm run test:image
npm run int9:verify
node --test scripts/int9-release-preflight.test.mjs
```

Database verification requires an **exclusively disposable** local Supabase project. Never reset managed Staging/Production or another shared local project.

Fingerprint: `ops/releases/onedecore-int9-20261023-hold.json` (canonical LF text hashes, portable across Windows/Linux Git checkout). Approval flags and `internalDevelopmentComplete` are **false**. This is source-integrity evidence, not independent security approval, a deploy credential, or provider send authority.

**Final state: HOLD. Do not declare Internal Development Complete until missing evidence is independently verified. Production, Meta, and outbound messaging remain unchanged.**
