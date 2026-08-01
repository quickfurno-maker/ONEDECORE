# Phase CI-1 Audit — GitHub Actions Quality-Gate Foundation

> **Current note (August 1, 2026):** Phase CI-1 and Phase 5C2A (PR #7) are merged. Protected `main` requires **ONEDECORE Quality Gate**; PR #7 head CI and merge-commit `01254ee` CI both **PASS**. Managed OneDecore Supabase is at migrations **1–13** (Phase DB-2). CI uses local Supabase only; it does not connect to managed Supabase.

**Date:** July 31, 2026
**Branch:** `phase-ci-1-github-actions-foundation`
**Baseline:** `4edda152bf8ed6ef3911b0e17e620f626c77dc7f`
**Status:** Owner review and PR (July 31, 2026)

## Reason for CI introduction

Phase 5C2A preflight (`PHASE 5C2A PREFLIGHT: GO`) mandated **CI REQUIRED BEFORE 5C2A PR/MERGE**. The repository previously had zero GitHub Actions workflows. Phase CI-1 adds a minimal, isolated quality gate so CRM mutation work cannot merge without automated verification.

Phase CI-1 is independent from Phase 5C2A implementation. No CRM mutations, migrations, or managed Supabase changes are included.

## Workflow

| Property | Value |
|---|---|
| Path | `.github/workflows/quality-gate.yml` |
| Name | `ONEDECORE Quality Gate` |

### Triggers

- `pull_request` targeting `main`
- `push` to `main`
- `workflow_dispatch` (manual)

### Permissions

- `contents: read` only — no write, packages, deployments, or pull-request mutation permissions

### Concurrency

- Group: `quality-gate-${{ github.workflow }}-${{ github.ref }}`
- `cancel-in-progress: true` — superseded commits cancel in-flight runs

## Jobs

### Application Quality

| Step | Command |
|---|---|
| Install | `npm ci` |
| Lint + typecheck + build | `npm run check` |
| Application tests | `npm run test:app` |
| Image pipeline tests | `npm run test:image` |

**Node:** 24 (matches `package.json` `engines`)
**Timeout:** 25 minutes

### Database Quality

| Step | Command |
|---|---|
| Install | `npm ci` |
| Supabase CLI | `supabase/setup-cli@v1` version `2.109.1` (matches `package.json` devDependency) |
| Start local stack | `supabase start` |
| Reset + migrate | `npm run db:reset` |
| Lint + pgTAP | `npm run check:db` |
| Cleanup | `supabase stop --no-backup` (`if: always()`) |

**Timeout:** 30 minutes
**Runner:** `ubuntu-latest` (Docker available for local Supabase containers)

## Commands enforced in CI

| Script | Enforced |
|---|---|
| `npm ci` | Yes (both jobs) |
| `npm run check` | Application job |
| `npm run test:app` | Application job |
| `npm run test:image` | Application job |
| `npm run db:reset` | Database job |
| `npm run check:db` | Database job (`db:lint` + `db:test`) |

## Commands not enforced in CI

| Script | Reason |
|---|---|
| `npm run dev` | Interactive local server |
| `npm run start` | Runtime server — not a quality gate |
| Owner browser QA (`scripts/phase-5c1-*.mjs`) | Requires local passwords, six-role accounts, manual verification |
| Phase 5C2A mutation browser QA | Out of scope for CI-1 |
| `npm run db:start` / `db:stop` | Wrapped by workflow steps directly |
| Deployment, managed migration apply | Explicitly forbidden |

## Local Supabase isolation

The database job:

- Starts **local** Supabase via Docker on the GitHub runner only
- Applies migrations **1–12** through `supabase db reset` (local)
- Does **not** run `supabase link`, `supabase db push`, or any remote operation
- Does **not** use a project ref or managed credentials
- Stops and removes local containers in an `always()` cleanup step
- Does not persist database volumes between workflow runs

Migration 12+ is applied **locally in CI only** via `db reset`. At CI-1 implementation time managed Supabase was unchanged; managed migrations 11–13 were applied separately in Phase DB-2 (August 1, 2026).

## Environment variables (application job only)

| Variable | Value | Why safe |
|---|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | `http://127.0.0.1:54321` | Standard local Supabase API URL; loopback only |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Supabase CLI demo anon JWT | Public local demo key shipped with Supabase CLI; not a managed project secret |

These satisfy `getPublicSupabaseEnv()` during `next build` without weakening production validation. No service-role key, managed URL, or Hostinger credentials are used.

## Secrets boundary

**No GitHub secrets required.** The workflow uses:

- Default `GITHUB_TOKEN` with `contents: read` only (checkout)
- No `SUPABASE_ACCESS_TOKEN`, `SUPABASE_SERVICE_ROLE_KEY`, database passwords, or third-party API keys

## CI vs owner browser QA

| Concern | CI | Owner browser QA |
|---|---|---|
| ESLint / TypeScript / build | Automated | Manual optional |
| Unit / contract tests | Automated | Manual optional |
| pgTAP / RLS | Automated (local Docker) | `phase-5c1-owner-rls-qa.sql` |
| Six-role UI flows | Not covered | `phase-5c1-browser-qa.mjs` |
| Mobile 360/390 layout | Not covered | Manual |
| Managed Supabase state | Not touched | Not touched |

## Relationship to Phase 5C2A

- Phase 5C2A preflight requires this CI foundation **before 5C2A PR merge**
- Phase 5C2A implementation may proceed locally in parallel
- Branch `phase-5c2a-lead-assignment-mutations` was not modified during CI-1

## Action supply chain

| Action | Version | Notes |
|---|---|---|
| `actions/checkout` | `@v4` | Official GitHub action |
| `actions/setup-node` | `@v4` | Official GitHub action with `cache: npm` |
| `supabase/setup-cli` | `@v1` | Official Supabase action; CLI pinned to `2.109.1` |

**Remaining hardening (low risk):** Pin actions to immutable commit SHAs with release-tag comments when SHAs are verified against GitHub releases.

## No managed service changes

- No managed Supabase migration application
- No deployment
- No public lead intake activation
- No branch protection changes (owner action after merge)

## Recommended next action

Owner review → commit on `phase-ci-1-github-actions-foundation` → push → open PR → merge to `main` → enable branch protection requiring `ONEDECORE Quality Gate` before Phase 5C2A merge.

## First remote run (PR #6)

| Item | Result |
|---|---|
| Run ID | `30627241612` |
| Tested SHA | `4fa7e2154dc234f55d16c1b935acd01b0698bec9` |
| Database Quality | **PASS** — local Supabase start, `db:reset`, `check:db`, cleanup |
| Application Quality | **FAIL** — `npm run check` passed; application tests 346/347 |

**Root cause:** `r5-5-2-final-a11y.test.ts` (imported by `public-portfolio.test.ts`) required `onedecore-chatgpt/phase-2f-r5-5-2-final-a11y/03-evidence-truth-ledger.md`, which exists only in the owner's ignored local workspace and is not present in a clean Git checkout.

**Correction (repository reproducibility, not workflow weakening):**

- Canonical ledger tracked at `docs/audits/phase-2f-r5-5-2-final-a11y-evidence-truth-ledger.md`
- Test updated to resolve the tracked path only (no conditional skip, no CI bypass)
- Focused assertion that the canonical path exists and does not reference `onedecore-chatgpt`

**Rerun result:** Recorded after correction commit push and new workflow completion.
