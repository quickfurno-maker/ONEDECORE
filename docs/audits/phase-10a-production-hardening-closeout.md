# Phase 10A â€” Production Hardening, Dependency Security & Operational Readiness

**Status:** `PHASE_10A_LOCAL_PASS` (owner review pending â€” **no commit/push/deploy**)
**Date:** 2026-08-28
**Branch / worktree:** `phase-10a-production-hardening` / `OneDecore-phase10a-production-hardening`
**Starting SHA:** `0a27b2ff26eeeeff4b538841c75cebe89ccd63ed` (= `origin/main`, production baseline)
**Production:** https://onedecore.in Â· VPS `91.108.105.192` Â· app `/var/www/onedecore` Â· PM2 `onedecore` Â· Node bind `127.0.0.1:3000`

---

## 1. Entry certification

| Check | Result |
| :--- | :--- |
| Branch | `phase-10a-production-hardening` |
| HEAD | `0a27b2ff26eeeeff4b538841c75cebe89ccd63ed` (pre-change) |
| `origin/main` | `0a27b2ff26eeeeff4b538841c75cebe89ccd63ed` |
| Working tree at entry | **clean** |
| Node | v24.18.0 |
| npm | 11.16.0 |
| Git | 2.54.0.windows.1 |

CRM 2B-1 (PR #107) is merged on this baseline; production smoke passed per owner handoff.

---

## 2. npm audit BEFORE (8 vulnerabilities: 2 moderate, 6 high)

| Package | Severity | Path | Exposure |
| :--- | :--- | :--- | :--- |
| `postcss` â‰¤8.5.22 | high | `next@16.2.11` â†’ nested `postcss@8.4.31` | Build / Next image pipeline |
| `sharp` <0.35.0 | high | `next@16.2.11` â†’ nested `sharp@0.34.5` | Next image optimization (direct `sharp@0.35.3` already present) |
| `brace-expansion` â‰¤5.0.8 | high | `eslint-config-next` â†’ `typescript-eslint` â†’ `minimatch` | **Dev/lint only** |
| `js-yaml` 4.0.0â€“4.3.0 | high | `eslint` â†’ `@eslint/eslintrc` | **Dev/lint only** |
| `nanoid` <3.3.18 | high | `postcss@8.5.22` (tailwind + next) | **Build toolchain** |
| `uuid` <11.1.1 | moderate | `exceljs@4.4.0` â†’ `uuid@8.3.2` | CRM bulk import (server-only XLSX parse) |

npm `audit fix --force` proposed `next@16.3.3` and `exceljs@3.4.0` (breaking downgrade). **Neither was run.**

---

## 3. Safe fixes implemented

| Change | Rationale |
| :--- | :--- |
| `next` **16.2.11 â†’ 16.3.3** | Removes vulnerable nested `postcss@8.4.31` and `sharp@0.34.5`; aligns with npm advisory remediation path without `--force` |
| `eslint-config-next` **16.2.11 â†’ 16.3.3** | Keeps ESLint config aligned with Next |
| `package-lock.json` regenerated via `npm install` | Deterministic lockfile; **not** hand-edited |

**Not changed:** React 19.2.4, `sharp@0.35.3` direct dep, `exceljs@4.4.0`, schema, RLS, env, feature gates.

---

## 4. npm audit AFTER (5 vulnerabilities: 2 moderate, 3 high)

| Package | Severity | Status |
| :--- | :--- | :--- |
| `postcss` nested under Next | â€” | **RESOLVED** (`next` now dedupes `postcss@8.5.23`) |
| `sharp` nested under Next | â€” | **RESOLVED** (`next` now dedupes `sharp@0.35.3`) |
| `brace-expansion` | high | **DEFER** â€” dev-only ESLint tree |
| `js-yaml` | high | **DEFER** â€” dev-only ESLint tree |
| `nanoid` | high | **DEFER** â€” build-only via PostCSS 8.5.23 (still 3.3.16) |
| `uuid` | moderate | **DEFER_WITH_RATIONALE** â€” ExcelJS transitive; no safe non-breaking fix |

**Dependency tree after upgrade:**

```
next@16.3.3 â†’ postcss@8.5.23, sharp@0.35.3 (deduped)
sharp@0.35.3 (direct)
exceljs@4.4.0 â†’ uuid@8.3.2
```

---

## 5. Next.js 16.3.3 decision

**Implemented.** React 19.2.4 remains compatible (Next peer range includes `^19.0.0`). Lockfile delta is bounded (+2 packages, âˆ’4 packages net install). All application tests, lint, typecheck, and production build pass. Nested Sharp/PostCSS advisories tied to Next 16.2.11 are cleared.

---

## 6. Sharp finding

Direct dependency already `sharp@0.35.3` (patched). Problem was **duplicate nested** `sharp@0.34.5` under Next 16.2.11. Next 16.3.3 dedupes to 0.35.3. No Sharp downgrade or separate bump required.

---

## 7. ExcelJS / UUID finding

- Installed: `exceljs@4.4.0` â†’ `uuid@8.3.2`
- Advisory GHSA-w5hq-g745-h8pq affects **uuid v3/v5/v6 when caller supplies `buf`** â€” ExcelJS uses uuid for internal workbook/stream identifiers during XLSX read (`lead-import-file-parser.ts`); ONEDECORE does not call uuid v3/v5/v6 with attacker-controlled buffers directly.
- No compatible ExcelJS release on main line pins uuid â‰¥11.1.1 without major ecosystem change.
- **Recommendation:** `DEFER_WITH_RATIONALE` â€” server-only staff bulk import; low practical remote exploitability; monitor ExcelJS releases.

---

## 8. Deprecated transitive packages

All traced to **ExcelJS** archive/unzip chain:

| Package | Top path |
| :--- | :--- |
| `glob@7.2.3`, `inflight@1.0.6` | `exceljs` â†’ `archiver` |
| `lodash.isequal@4.5.0` | `exceljs` â†’ `fast-csv` |
| `fstream@1.0.12`, `rimraf@2.7.1` | `exceljs` â†’ `unzipper` |

**Recommendation:** Document only. Replacing ExcelJS is a separate upgrade phase; not required for 10A.

---

## 9. Install-script / supply-chain

- `npm ci` succeeds deterministically after lockfile update.
- npm warns `unrs-resolver@1.12.2` postinstall not in allowScripts â€” **eslint/unrs toolchain**; builds complete without `npm approve-scripts`.
- `sharp` install scripts run via direct dependency (required for portfolio/commerce image pipeline per DEC-0030).
- **No** broad `allow-scripts` configuration added.

---

## 10. Security headers review

Existing `next.config.ts` applies globally:

- `X-Content-Type-Options: nosniff`
- `Referrer-Policy: strict-origin-when-cross-origin`
- `X-Frame-Options: DENY`
- `Permissions-Policy: camera=(), microphone=(), geolocation=()`

**CSP:** **DEFERRED** â€” no CSP added. A strict CSP would require broad browser QA across Supabase auth, portfolio images, CRM, lead forms, and admin shells; risk of breaking production MVP outweighs benefit in this gate.

Cookies/session: Supabase SSR cookie handling unchanged. HTTPS assumed at Nginx edge.

---

## 11. Feature-gate / env safety matrix (names only)

| Variable | Purpose | Prod expectation | Fail-closed default | Restart? | Owner auth? |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public Supabase API | Managed HTTPS URL | Build fails if missing | Yes | Yes |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Anon key | Publishable only | Build fails if missing | Yes | Yes |
| `SUPABASE_SERVICE_ROLE_KEY` | Server privileged ops | Set server-only | Throws on commerce/lead paths | Yes | Yes |
| `ONEDECORE_COMMERCE_PUBLIC_RUNTIME_SECRET` | COD tracking HMAC | â‰¥32 chars when shop used | Throws if shop paths need it | Yes | Yes |
| `ONEDECORE_SHOP_PUBLIC_ENABLED` | Public `/shop` gate | **`false` / unset** | Inactive shop + sitemap omit | Yes | **Yes â€” DEC-0095** |
| `ONEDECORE_LEAD_INTAKE_MODE` | Public lead API | **`enabled`** (live site) | `disabled` | Yes | Was Phase 10 launch |
| `NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE` | Form UI mode | `active` or per launch | `copy-only` | Yes | Yes |
| `ONEDECORE_WHATSAPP_*` | WhatsApp outbound | Disabled / no live tokens | Fail-closed | Yes | Yes |
| `ONEDECORE_CAMPAIGN_EXECUTION_MODE` | Campaign spend | `disabled` | No live Ads writes | Yes | Yes |
| `ONEDECORE_PROVIDER_DATA_SHARING_ENABLED` | Ads PII sharing | Off / unset | Fail-closed | Yes | Yes |
| `ONEDECORE_LANDING_LAB_PUBLIC_ENABLED` | `/lp` public | Off / unset | `notFound()` | Yes | Yes |
| `NEXT_PUBLIC_APP_URL` | Canonical site URL | `https://onedecore.in` | Mislinks if wrong | Yes | Yes |
| `ONEDECORE_TRUST_PROXY` | Rate-limit / IP trust | `true` behind Nginx | Conservative if false | Yes | Yes |

**Immutable locks preserved:** Shop OFF, payments deferred, CRM SLA OFF, campaign live spend OFF, Landing Lab public OFF, WhatsApp live outbound not activated.

---

## 12. Lead-intake production truth

Per `docs/09-phase-roadmap.md` and `LEAD_INTAKE_ACTIVATION` in code: **canonical public website lead intake is LIVE** on production (`ONEDECORE_LEAD_INTAKE_MODE=enabled` when owner activated). Phase 10A does **not** revert intake. Stale docs that say intake is disabled refer to preâ€“Phase 10 launch state.

Manual CRM New Lead phone rule (2B-1): staff enter **10-digit Indian mobile**; server canonicalizes to `+91XXXXXXXXXX` for duplicate/create.

---

## 13. Health / PM2 / deployment

- `GET /api/health` â†’ `{ ok: true, service: "onedecore" }` â€” minimal, no DB/secrets/versions. **No change required.**
- Production ops: Unix user `onedecore`, PM2 home `/home/onedecore/.pm2`, env file `/var/www/onedecore/.env.production.local`, Nginx â†’ `127.0.0.1:3000`.
- Git on server: operations as `onedecore` user (not root `safe.directory`).

---

## 14. Backup / recovery

Documented strategy (no destructive testing in 10A):

1. Git rollback to prior certified SHA on `main`
2. `npm ci` on Node 24
3. `npm run build`
4. PM2 restart as `onedecore`
5. Smoke: `/api/health`, public home, admin redirect
6. Database: forward-only migrations; rollback = restore Supabase backup + align app SHA

**Supabase PITR:** Historical audits report PITR **disabled**; WALG physical backups documented for managed applies. **OWNER/DASHBOARD VERIFICATION REQUIRED** for current backup/PITR state before next managed apply.

---

## 15. Production smoke matrix

See [phase-10a-production-smoke-matrix.md](../runbooks/phase-10a-production-smoke-matrix.md). Scripted local verification of route contracts; live production re-smoke recommended after owner merges/deploys dependency update.

---

## 16. CI quality gate

`.github/workflows/quality-gate.yml` retains **Application Quality** (npm ci, check, test:app, test:image) and **Database Quality** (supabase start, db:reset, check:db, commerce concurrency). **No weakening.**

---

## 17. Validation results

| Gate | Result |
| :--- | :--- |
| `npm ci` | PASS |
| `npm run test:app` | **1156 / 1156 PASS** |
| `npm run check` (lint + typecheck + build) | **PASS** (0 lint errors; pre-existing warnings only) |
| `git diff --check` | **PASS** |
| Database tests | Not re-run locally (Supabase not started in this gate); CI job unchanged |

---

## 18. Files changed (this gate)

| File | Change |
| :--- | :--- |
| `package.json` | `next` + `eslint-config-next` â†’ 16.3.3 |
| `package-lock.json` | Regenerated lockfile |
| `next-env.d.ts` | Next 16.3.3 TypeScript route refs (build-generated) |
| `docs/audits/phase-10a-production-hardening-closeout.md` | This audit |
| `docs/runbooks/phase-10a-production-smoke-matrix.md` | Smoke matrix |
| `docs/00-project-truth.md` | Truth sync (CRM 2B-1 live, 10A, baseline SHA) |
| `docs/09-phase-roadmap.md` | Phase 10A entry |
| `docs/10-decision-register.md` | DEC-0096 |
| `docs/audits/phase-10-cod-production-readiness.md` | Next baseline note |

**No** migrations, RLS, RPC, `.env`, Shop activation, or payment code changes.

---

## 19. Recommended next owner action

1. Review this closeout and dependency diff.
2. If approved: commit on `phase-10a-production-hardening`, PR to `main`, run CI, deploy to VPS as `onedecore`, PM2 restart, execute smoke matrix on production.
3. Re-confirm Supabase backup window before any future managed migration.
4. **Do not** start Phase 10B (COD shop activation) until explicitly authorized; keep `ONEDECORE_SHOP_PUBLIC_ENABLED` OFF.

**Possible follow-up (separate phase):** ExcelJS/uuid deferral review; ESLint toolchain bumps for js-yaml/brace-expansion; nanoid via PostCSS/Tailwind upstream; CSP with dedicated browser QA.
