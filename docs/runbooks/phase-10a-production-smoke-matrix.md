# Phase 10A â€” Production Smoke Matrix

**Purpose:** Safe post-deploy verification checklist. Does not create orders or activate deferred features.
**Baseline:** `0a27b2ff26eeeeff4b538841c75cebe89ccd63ed` (pre-10A dependency bump) and subsequent 10A commits when merged.
**Production URL:** https://onedecore.in

Run as unauthenticated browser/curl unless noted. Admin routes expect redirect to login when unauthenticated.

---

## Public routes

| Route | Expected |
| :--- | :--- |
| `/` | 200; homepage loads |
| `/portfolio` | 200; listing loads |
| `/interiors` | 200 or redirect per simplification lock |
| `/privacy` | 200; legal copy |
| `/terms` | 200 |
| `/warranty` | 200 |
| `/api/health` | 200 JSON `{ ok: true, service: "onedecore" }`; no secrets |
| `/robots.txt` | 200 |
| `/sitemap.xml` | 200; **no** `/shop` URLs while gate OFF |

---

## Admin routes (unauthenticated)

| Route | Expected |
| :--- | :--- |
| `/admin` | Redirect to login |
| `/admin/crm/my-day` | Redirect to login |
| `/admin/crm/leads` | Redirect to login |
| `/admin/crm/leads/new` | Redirect to login |
| `/admin/portfolio` | Redirect to login |
| `/admin/commerce` | Redirect to login |

---

## Shop while OFF (`ONEDECORE_SHOP_PUBLIC_ENABLED` â‰  `true`)

| Route | Expected |
| :--- | :--- |
| `/shop` | Inactive / disabled storefront UX (not live COD) |
| `/shop/cart` | Fail-closed / inactive |
| `/shop/checkout` | Reject or inactive |
| `/shop/track` | Reject or inactive |

**Do not** complete a real COD order in smoke.

---

## Lead intake (LIVE)

| Check | Expected |
| :--- | :--- |
| Homepage consultation CTA | Routes to canonical intake (`/#consultation` or configured target) |
| `POST /api/public/lead-intake` | Accepts valid submission when `ONEDECORE_LEAD_INTAKE_MODE=enabled` |

---

## Postâ€“Next 16.3.3 deploy (when merged)

| Check | Expected |
| :--- | :--- |
| Portfolio images | Load via Next image optimizer |
| CRM My Day / Leads | Authenticated staff workflows unchanged |
| Build | `npm run check` passed in CI |

---

## PM2 restart (production)

As Unix user `onedecore` on VPS:

1. `cd /var/www/onedecore`
2. `git fetch` / checkout approved SHA
3. `npm ci`
4. `npm run build`
5. `pm2 restart onedecore --update-env`
6. Verify `curl -sS http://127.0.0.1:3000/api/health`

Do not run git operations as root against `/var/www/onedecore`.
