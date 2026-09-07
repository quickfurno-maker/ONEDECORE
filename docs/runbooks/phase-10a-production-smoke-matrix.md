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

## Production restart (current lifecycle)

The production app is a systemd-managed PM2 service. The lifecycle facts that
decide every command below:

| Fact | Value |
| :--- | :--- |
| VPS | `91.108.105.192` |
| App directory | `/var/www/onedecore` |
| Runtime user | `onedecore` |
| PM2 process | `onedecore` |
| PM2 home | `/home/onedecore/.pm2` |
| systemd lifecycle unit | `pm2-onedecore.service` |

As root/operator on the VPS:

1. `cd /var/www/onedecore`
2. `git fetch` / checkout the approved merged SHA
3. `npm ci`
4. `npm run build`
5. `systemctl restart pm2-onedecore`
6. `systemctl is-active pm2-onedecore`
7. `sudo -iu onedecore pm2 status`
8. `curl -sS http://127.0.0.1:3000/api/health`

**Restart through systemd. Do NOT run `pm2 restart onedecore` as root.** Root's
PM2 daemon and the runtime user's PM2 home (`/home/onedecore/.pm2`) are separate
process universes: a restart issued from root's daemon talks to a daemon that
does not own the production process, so it either does nothing visible or starts
a second, unmanaged copy. The `pm2-onedecore.service` unit owns the lifecycle,
and `systemctl restart` is the only command that acts on the process serving
traffic.

Step 7 is the check that catches the wrong-universe mistake: `pm2 status` run as
the runtime user must show `onedecore` `online` with a fresh uptime. If it shows
a stale uptime while `systemctl is-active` says `active`, the restart did not
reach the process you think it did.

Steps 2–4 run as the operator, so the checked-out tree and the build output are
operator-owned. Confirm the runtime user can still read what it has to serve
before declaring the deploy good — a green `systemctl is-active` with an
unreadable `.next` is a service that is up and failing.
