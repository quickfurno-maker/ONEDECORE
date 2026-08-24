# ONEDECORE

> **One Vision. Complete Interiors.**

ONEDECORE is a premium interior-business operating system for Pune, India — public website, portfolio, CRM, quotations, projects, WhatsApp foundations, marketing foundations, and COD-ready furniture commerce.

**Current phase:** Phase 10 — COD-only **production readiness** (owner activation pending).
**Previous:** Phase 9D-F COD storefront certification (PR #87). Online payments remain **deferred** (9D-E local only).
**Public shop gate:** fail-closed `ONEDECORE_SHOP_PUBLIC_ENABLED` (default off). **Deploy ≠ activate.**

---

## 1. Locked Project Identity

- **Brand:** ONEDECORE
- **Tagline:** One Vision. Complete Interiors.
- **Domain:** `onedecore.in`
- **Initial Launch Market:** Pune, India
- **Core Services:** Complete Home Interiors · Modular Kitchens · Custom Wardrobes · Ready-made furniture (COD)
- **Deployment Target:** Hostinger VPS — readiness documented; **not activated in this gate**
- **Repository:** Independent from QuickFurno and Jarvis

---

## 2. Production posture (truth)

| Item | Status |
| :--- | :--- |
| Repository migrations | **M1–M37** (no M38) |
| Managed Supabase (`lpurlfmpvriyvpkujvyl`) | **M1–M37** per D1/D2 closeout evidence (re-confirm in dashboard before activate) |
| Online payments | **DEFERRED** — no provider on `main` |
| Public `/shop` | **OFF** until `ONEDECORE_SHOP_PUBLIC_ENABLED=true` |
| Lead intake / WhatsApp / campaigns / Landing Lab | Separate fail-closed gates (unchanged) |

Authoritative docs: [Project Truth](docs/00-project-truth.md), [Roadmap](docs/09-phase-roadmap.md), [Phase 10 readiness audit](docs/audits/phase-10-cod-production-readiness.md).

---

## 3. Local development

```bash
npm ci
# copy .env.example → .env.local; set local Supabase keys + secrets
# For full shop QA locally: ONEDECORE_SHOP_PUBLIC_ENABLED=true
npm run db:start
npm run db:reset
npm run dev
```

Node **24** (`engines` / `.nvmrc`).

---

## 4. Quality scripts

- `npm run check` — lint + typecheck + build
- `npm run db:test` — pgTAP
- `npm run test:phase-9d-f` / `npm run test:phase-10` — commerce certification contracts

---

## 5. Documentation

| Document | Purpose |
| :--- | :--- |
| [docs/00-project-truth.md](docs/00-project-truth.md) | Governance baseline |
| [docs/09-phase-roadmap.md](docs/09-phase-roadmap.md) | Phase plan |
| [docs/10-decision-register.md](docs/10-decision-register.md) | DEC register (through DEC-0095) |
| [docs/audits/phase-10-cod-production-readiness.md](docs/audits/phase-10-cod-production-readiness.md) | Deploy/activate/rollback runbook |
