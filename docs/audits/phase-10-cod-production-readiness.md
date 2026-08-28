# Phase 10 — COD-only production readiness

**Status:** `PHASE_10_COD_PRODUCTION_READINESS_LOCAL_PASS`  
**Date:** 2026-08-24  
**Branch / worktree:** `phase-10-cod-production-readiness` / `OneDecore-phase10-cod-production-readiness`  
**Starting main:** `7e4391a15f36028f2f7059ad6288c419d4c25b24` (PR #87 merge — 9D-F)  
**PR #87 source HEAD:** `863b8f5c41aff298ae1f69cefdc829d8d4b18dff`  
**Authority:** ADR-0033 / DEC-0094 / **DEC-0095** (shop public gate)  
**Latest migration:** M37 · **M38 absent**  
**Online payments:** DEFERRED (`phase-9d-e-online-payments` @ `b2ea05c…` untouched)  
**Production activation:** **OFF** (this gate does not deploy or enable the shop)

---

## 1. Entry truth

| Item | Evidence |
| :--- | :--- |
| `origin/main` | `7e4391a15f36028f2f7059ad6288c419d4c25b24` |
| PR #87 | Merged — 9D-F COD certification |
| Repo migrations | 37 files; latest `20260824140000_commerce_order_cod_checkout_foundation.sql` |
| M38 | Absent |
| 9D-E | Preserved at `b2ea05c243d03d3e88385189b8a7098a8ffe20c8`; clean; not on main |
| Managed M1–M37 | **Documented closeout evidence** (D1/D2 / project truth). Live dashboard re-confirm required before owner activate. |
| Payment provider on main | None |

---

## 2. Topology (discovered)

| Layer | Finding |
| :--- | :--- |
| Hosting target | Hostinger VPS (docs/README); **no repo PM2/systemd/Docker/nginx** |
| Runtime | Node **24** (`package.json` engines, `.nvmrc`) |
| App | Next.js **16.3.3** after Phase 10A merge (baseline **16.2.11** at `0a27b2f`); `npm run build` / `npm run start` |
| Process manager | **Not in repo** — owner must use Hostinger/PM2/systemd of record |
| Reverse proxy | **Not in repo** — terminate TLS at proxy; proxy to Node port |
| App port | Next default **3000** (or `PORT` if process manager sets it) |
| Health | `GET /api/health` → `{ ok: true, service: "onedecore" }` |
| Domain | `https://onedecore.in` (`SITE_CONFIG.url`) |
| Current production commit | **NOT_CHECKED** (no server access this gate) |

**DEPLOYMENT_AND_ACTIVATION_WERE_SAME_BOUNDARY (pre-fix):** `/shop` was publicly routable with no env kill-switch.  
**After DEC-0095:** deploy can ship with `ONEDECORE_SHOP_PUBLIC_ENABLED` unset/false; public shop stays inactive until owner sets `true`.

---

## 3. Shop activation mechanism

| Action | Effect |
| :--- | :--- |
| Deploy app + secrets with gate **false/absent** | Site live; `/shop*` shows inactive page; checkout/track reject; sitemap omits shop |
| Set `ONEDECORE_SHOP_PUBLIC_ENABLED=true` + restart | Public COD storefront ON |
| Leave payment env unset | Online payments remain impossible on main |
| Campaign / WhatsApp / lead / Landing Lab gates | Independent; unchanged; stay fail-closed |

**This gate leaves the shop gate OFF.** Owner activation is a separate explicit step.

---

## 4. Environment matrix (names only)

### Required public
| Name | Notes |
| :--- | :--- |
| `NEXT_PUBLIC_SUPABASE_URL` | Managed HTTPS project URL |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | Anon/publishable only |

### Required server (COD shop)
| Name | Notes |
| :--- | :--- |
| `SUPABASE_SERVICE_ROLE_KEY` | Never `NEXT_PUBLIC_` |
| `ONEDECORE_COMMERCE_PUBLIC_RUNTIME_SECRET` | ≥32 chars; tracking/quote HMAC |
| `ONEDECORE_SHOP_PUBLIC_ENABLED` | Must be exactly `true` to activate shop; default `false` |

### Optional / fail-closed (must stay off for COD launch)
| Name | Default intent |
| :--- | :--- |
| `ONEDECORE_LEAD_INTAKE_MODE` | disabled |
| `NEXT_PUBLIC_ONEDECORE_LEAD_FORM_MODE` | copy-only |
| `ONEDECORE_WHATSAPP_*` / Meta tokens | disabled |
| `ONEDECORE_CAMPAIGN_EXECUTION_MODE` | disabled |
| `ONEDECORE_PROVIDER_DATA_SHARING_ENABLED` | false |
| `ONEDECORE_LANDING_LAB_PUBLIC_ENABLED` | absent ≠ true |
| `ONEDECORE_TRUST_PROXY` | true only behind rewriting proxy |
| `NEXT_PUBLIC_APP_URL` | `https://onedecore.in` when absolute app links needed |

### Deferred payment
| Name | Status |
| :--- | :--- |
| Razorpay/Stripe/etc. | **Must be ABSENT** |

Production secret values: **NOT printed**. Owner verifies PRESENT/ABSENT on the VPS without pasting values into chat.

---

## 5. Security hardening shipped here

1. Fail-closed shop public gate (layout + checkout + track + sitemap).
2. Shop listing/PDP `generateMetadata` respects the gate (noindex when OFF — child metadata no longer overrides layout).
3. `sitemap.ts` is `force-dynamic` so gate flips apply on restart without rebuild.
4. Baseline security headers in `next.config.ts` (nosniff, referrer-policy, DENY framing, permissions-policy). **No CSP** (would risk Next/Supabase breakage).
5. `GET /api/health` for process probes.
6. Admin banner + footer copy aligned with gate truth.
7. DEC-0095 recorded.

Tracking cookie already: HttpOnly, SameSite=Lax, `secure` when `NODE_ENV=production`.

---

## 6. Supabase / commerce operations checklist (owner)

Before activation:

1. Confirm managed project `lpurlfmpvriyvpkujvyl` schema **M1–M37**, **no M38**.
2. Auth Site URL / redirect allowlist: `https://onedecore.in`, `https://onedecore.in/auth/callback` (exact Supabase dashboard values).
3. Storage: `commerce-product-public` public; originals private; published product media present.
4. Admin `/admin/commerce`:
   - ≥1 active category
   - ≥1 published product + variant SKU
   - tax rate linked
   - serviceable pincode(s) (e.g. Pune)
   - shipping settings coherent
   - COD path only (no payment UI)
5. Staff with `commerce.orders` manage for fulfilment.
6. Confirm unrelated gates remain off (lead/WhatsApp/campaigns/Landing Lab).

**Do not seed managed production from this worktree.**

---

## 7. Deployment runbook (Hostinger VPS template)

> Exact PM2/systemd/nginx paths are **owner-specific** (not in Git). Substitute your process manager.

### PRE-DEPLOY

```bash
# On VPS (read-only discovery)
git -C /path/to/onedecore rev-parse HEAD   # record CURRENT_PROD_COMMIT
node -v   # expect v24.x
# Confirm env names PRESENT without printing values:
# NEXT_PUBLIC_SUPABASE_URL, NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY,
# SUPABASE_SERVICE_ROLE_KEY, ONEDECORE_COMMERCE_PUBLIC_RUNTIME_SECRET,
# ONEDECORE_SHOP_PUBLIC_ENABLED must be false/absent for deploy-only
# Confirm payment provider env ABSENT
# Confirm managed M37 in Supabase dashboard; M38 absent
```

Approved readiness commit: **this branch HEAD after merge to main**.

### DEPLOY (no migration)

```bash
cd /path/to/onedecore
git fetch origin --prune
git checkout <APPROVED_MAIN_SHA>
npm ci
npm run build
# restart via your process manager, e.g.:
# pm2 restart onedecore
# OR systemctl restart onedecore
# Reload reverse proxy only if config changed (usually not)
```

**Do not run** `supabase db push`, managed SQL, or payment setup.

### POST-DEPLOY SMOKE (gate still OFF)

- `https://onedecore.in/` → 200
- `/interiors` → 200
- `/shop` → inactive page (not catalogue)
- `/api/health` → `{"ok":true,...}`
- `/admin/commerce` → login redirect if unauthenticated
- `/robots.txt` / `/sitemap.xml` → HTTPS `onedecore.in`; sitemap **omits** shop while gate OFF
- Response headers include `X-Content-Type-Options: nosniff`
- Logs: no secret dumps

### OWNER ACTIVATION (separate gate — not this prompt)

1. Re-confirm catalogue/pincode/tax/ops checklist.
2. Set `ONEDECORE_SHOP_PUBLIC_ENABLED=true` on VPS only.
3. Restart app process.
4. Smoke `/shop`, category, PDP, cart, checkout (**COD only**), track.
5. Confirm sitemap now includes `/shop` + published URLs.
6. Confirm still **no** payment UI/routes/env.

### CONTROLLED COD TRANSACTION (activation gate only)

- Internal test SKU, known stock, serviceable pincode, internal customer.
- Place **one** COD order; verify stock decrement; tracking proof; admin transition.
- Cancel/restock if operationally appropriate.
- **Never** online payment.

### ROLLBACK (no DB rollback expected)

```bash
cd /path/to/onedecore
git checkout <CURRENT_PROD_COMMIT>
npm ci
npm run build
# restart process manager
# smoke /, /interiors, /shop, /api/health, /admin login
# leave ONEDECORE_SHOP_PUBLIC_ENABLED unchanged or set false if incident is shop-related
```

---

## 8. Local regression (this gate)

| Gate | Result |
| :--- | :--- |
| db:reset / db:test | PASS (1782 tests) |
| B / C1 / C2 / D1 / D1-concurrency / D2 / 9D-F / phase-10 | PASS |
| typecheck / lint / build / check / git diff --check | PASS (lint: 0 errors, pre-existing warnings only) |
| Production-mode smoke | PASS — gate OFF inactive+noindex+sitemap omits shop; gate ON COD path+sitemap includes shop; `/api/health`; security headers; no payment UI |

---

## 9. Blockers / non-blockers

**Non-blockers**
- No in-repo PM2/nginx (owner infra)
- Production commit NOT_CHECKED without VPS access
- Managed M37 from closeout docs (re-confirm live before activate)
- M37 schema still allows `online` payment_method value without create path

**Resolved for readiness**
- Deploy≠activate via DEC-0095 gate
- Metadata/sitemap runtime correctness for the gate
- Baseline security headers + health probe
- Payment absence preserved

---

## 10. Recommendation

**LOCAL readiness PASS.** Owner may merge this branch, deploy with shop gate **OFF**, then run a separate **activation** gate setting `ONEDECORE_SHOP_PUBLIC_ENABLED=true` + process restart for COD-only. Do **not** activate online payments.
