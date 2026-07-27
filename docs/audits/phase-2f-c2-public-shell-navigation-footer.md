# Phase 2F-C2 — Public Shell, Navigation & Footer Audit

**Date:** July 27, 2026

**Gate:** Phase 2F-C2 Header, Mobile Navigation, Footer & Shell

**Status:** `PHASE_2F_C2_SHELL_NAVIGATION_FOOTER_COMPLETE`

**Branch:** `phase-2f-public-website-experience`

**Base HEAD:** `929707569c9df442fed53beb276d59e1a1662721`

---

## Production integration decision

Per frozen `docs/design/phase-2f-implementation-plan.md` §2F-C2, the shell wraps all public marketing routes now via the `(public)` route group (`src/app/(public)/layout.tsx`). URLs are unchanged (`/`, `/portfolio`, `/portfolio/[slug]`).

| Decision | Choice | Rationale |
|---|---|---|
| Shell activation | **Production — active** | Frozen plan stop condition: “Shell wraps all public routes” |
| Header mode (production) | **Solid** | Scaffold homepage has no approved C3 hero; overlay deferred |
| Overlay mode | **Implemented + preview QA only** | Available via `headerMode="overlay"` for C3 handoff |
| Consultation CTA | **Deferred (`cta: null`)** | `/contact` does not exist; no broken production link |
| Navigation destinations | **Home, Portfolio only** | Only routes verified in 2E3B/2F-C1 |
| Admin isolation | **Unchanged** | Admin/auth remain outside `(public)` layout |

---

## Implemented components

| Component | Path | Boundary |
|---|---|---|
| PublicSiteShell | `components/shell/PublicSiteShell.tsx` | Server |
| PublicHeader | `components/header/PublicHeader.tsx` | Client (scroll + mobile state) |
| DesktopNavigation | `components/header/DesktopNavigation.tsx` | Server module in client tree |
| MobileNavigation | `components/header/MobileNavigation.tsx` | Client |
| PublicFooter | `components/footer/PublicFooter.tsx` | Server |
| Navigation config | `config/public-navigation.ts` | Static |

---

## Header modes & scroll

- **Solid (production):** `ps-header--solid`, sticky, `#FDFCFA` surface + border
- **Overlay (C3-ready):** `ps-header--overlay` fixed transparent until scroll
- **Scrolled:** `scrollY > 80px` → `ps-header--scrolled`
- **Hook:** `useScrollHeader` — passive listener, deduped state, cleanup on unmount
- **Reduced motion:** CSS `transition: none` under `prefers-reduced-motion`

---

## Mobile focus management & body scroll lock

- `aria-expanded`, `aria-controls`, dialog `role` + `aria-modal`
- Initial focus into drawer on open; Tab trap; Escape closes
- Link selection and route change close drawer; focus restored to trigger
- `useBodyScrollLock` preserves/restores `overflow` and `paddingRight` (scrollbar compensation)

---

## Safe link / CTA contract

- `PRODUCTION_PUBLIC_NAVIGATION`: `/`, `/portfolio`
- `PRODUCTION_SHELL_CONFIG.cta`: `null`
- Footer: approved brand/tagline, service names (text only), Explore links to existing routes
- No mailto/tel/address, legal links, or social URLs

---

## Quality gate

| Check | Result |
|---|---|
| Database pgTAP | 107/107 |
| Application/public | **140/140** (+23 C2) |
| Image pipeline | 17/17 |
| Production HTTP | 13/13 |
| Deep assertions | 82/82 |
| TypeScript / ESLint / build / check | pass |
| Migrations | 8 synchronized, 0 new |
| Preview routes | `/phase2f-c2-preview`, C1 previews → HTTP 404 |

---

## Figma mismatch ledger (Direction A — fixed)

| # | Area | Figma intent | Initial gap | Resolution |
|---|---|---|---|---|
| 1 | Header height | 72px | — | Matched in CSS |
| 2 | Logo weight | Inter bold 18px | — | `ps-header-brand__wordmark` |
| 3 | Nav spacing | Generous desktop gap | Tight default | `--space-8` list gap |
| 4 | CTA height | 40px header CTA | 44px primitive | Desktop CTA `min-height: 40px` |
| 5 | Solid surface | `#FDFCFA` | — | Token used |
| 6 | Overlay contrast | Light text on hero | Dark text on light preview | `ps-header--on-dark` variant |
| 7 | Mobile drawer width | Full-height panel | — | `min(100%, 24rem)` |
| 8 | Mobile link typography | Editorial serif | Sans default | `ps-font-display` 1.5rem |
| 9 | Footer surface | Dark editorial | — | `ps-footer` dark section |
| 10 | Footer columns | 3-col desktop | — | CSS grid at 1024px |
| 11 | Service list | Names only pre-2F-D | — | Text list, no `/services` links |
| 12 | Focus ring | Bronze 2px offset | — | Existing token `:focus-visible` |
| 13 | Skip link | First focusable | — | Shell composes C1 SkipLink |
| 14 | Scroll threshold | 80px | — | `HEADER_SCROLL_THRESHOLD_PX` |
| 15 | No glassmorphism | Forbidden | — | No blur/backdrop-filter |

---

## Browser QA

Viewports exercised: 1440×1024, 390×844 (mobile emulation). Interactions: overlay header, mobile open/close/Escape, production `/` shell, skip link present, footer landmarks. No console errors observed.

---

## Performance / build

- No new dependencies or fonts
- Client boundaries: `PublicHeader`, `MobileNavigation`, `useScrollHeader`, `useBodyScrollLock`, `useReducedMotion` (existing)
- Production build passes; preview route deleted before final build

---

## Commit

Message: `feat(public-site): add shell navigation and footer`

SHA: _(post-commit)_
