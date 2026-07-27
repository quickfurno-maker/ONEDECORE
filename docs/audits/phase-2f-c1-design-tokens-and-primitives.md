# Phase 2F-C1 — Design Tokens & Primitives Audit

**Date:** July 27, 2026  
**Gate:** Phase 2F-C1 Design Tokens, Typography & Shared Primitives  
**Status:** `PHASE_2F_C1_HTTP_GATE_CLEAN`

**Branch:** `phase-2f-public-website-experience`

**Implementation HEAD:** `5d5e774aa4a866d1dcbfa292bbede8bf061fbe8b`
**Base HEAD:** `014c9698757945b5264ff54d6437746569ca7ff0`

---

## Implemented paths

| Area | Path |
|---|---|
| Fonts | `src/features/public-site/fonts.ts` |
| Token constants | `src/features/public-site/tokens.ts` |
| Scoped CSS tokens | `src/styles/public-site-tokens.css` |
| Class utility | `src/features/public-site/utils/cn.ts` |
| Reduced motion hook | `src/features/public-site/hooks/useReducedMotion.ts` |
| Primitives | `src/features/public-site/components/primitives/*` |
| Tests | `src/features/public-site/__tests__/*.test.ts` (wired via `public-portfolio.test.ts` import) |

## Font strategy

- Cormorant Garamond + Inter via `next/font/google`
- Weights 400, 500, 600; `display: swap`; latin subset
- CSS variables `--font-cormorant`, `--font-inter`
- **Not** applied to root `layout.tsx` body — scoped via `[data-public-site]` consumers

## Token scope

- `[data-public-site]` attribute activates Direction A tokens
- Admin and homepage unchanged in this slice

## Primitive inventory

Container, Section, EditorialSectionHeading, PrimaryButton, SecondaryLink, ImageFrame, VisuallyHidden, SkipLink, Reveal

## Reveal progressive enhancement

- SSR/default: content fully visible
- Client: IO + classList toggles `ps-reveal-prep` / `ps-reveal-visible`
- `useReducedMotion` via `useSyncExternalStore`
- Transform and opacity only; observer disconnect on cleanup

## Preview note

Gate specifies `src/app/__phase2f-c1-preview` but Next.js App Router excludes `_`-prefixed folders from routing. Browser QA used temporary `/phase2f-c1-preview` (deleted before commit).

## Quality gate

| Check | Result |
|---|---|
| Database pgTAP | 107/107 pass |
| Application/public | 117/117 pass (was 90; +27 C1 contract tests) |
| Image pipeline | 17/17 pass |
| TypeScript | clean |
| ESLint | clean (3 warnings in ignored `onedecore-chatgpt` tooling only) |
| Production build | pass |
| Preview routes | `/__phase2f-c1-preview` and `/phase2f-c1-preview` → HTTP 404 after deletion |
| Production HTTP endpoints | 13/13 pass |
| Deep body assertions | 82/82 pass |
| Migrations | 8 synchronized, 0 new |

## Production HTTP closeout

Executed against `npm run build` + `npm run start -- -p 3100` after deterministic local fixtures (`scripts/seed-local-fixtures.sql` via local Supabase Postgres).

Tooling: `scripts/verify-production-http.ts` (13 endpoints), `onedecore-chatgpt/cursor-handoff/deep-verify.mjs` (82 assertions, ignored handoff evidence).

Initial C1 commit gate recorded 9/13 because fixture seeding was omitted after `db reset`; rerunning the canonical fixture workflow restored 13/13 and 82/82 with no C1 source changes.

## Commit

Message: `feat(public-site): add design tokens and primitives`  
SHA: `5d5e774aa4a866d1dcbfa292bbede8bf061fbe8b`
