# ONEDECORE — CHANGELOG

All notable changes to the ONEDECORE project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [Unreleased]

### Added - Phase 5F Closeout (August 4, 2026)
- Phase 5F **READY TO CLOSE** (formally COMPLETE after this closeout PR merges): controlled public lead activation hardening implemented; PR #17 merged; managed migration 17 applied and verified (Phase DB-6B).
- Protected-main merge SHA `2e3f3322b35865c7661a0abeeaa7f0823ed8a593`; M17 `20260804140000_controlled_public_lead_activation_hardening.sql` SHA `B8F5B75AC6EE64DE1E9ABD571A215FF3AABE6F54D98EFE1F8BBEF679871A0FC6`.
- Managed Supabase aligned **M1–M17** on OneDecore (`lpurlfmpvriyvpkujvyl`); normalized-phone identity reuses active/suppressed contact identity; DNC preserved; suppressed phone state preserved; ambiguous identity fails safely (`contact_identity_conflict`); IPv6 loopback `::1` hardening completed.
- DB-6A physical recovery Route A: backup ID `1281893546` (`2026-08-03T19:53:32.414Z`, COMPLETED, WALG) — valid pre-M17 recovery point; **does not permanently satisfy Phase 10** (fresh physical backup or qualified PITR required before production activation).
- DB-6B apply window 2026-08-04T06:41:03Z–06:41:13Z; 28/28 public application table row counts unchanged; RBAC 29/90/2; RLS 28 tables / 52 policies unchanged.
- H1 browser/mobile QA PASS (desktop 1440×900, mobile 390×844; zero normal intake POSTs; disabled endpoint 503 `LEAD_INTAKE_DISABLED`).
- Closeout audit: `docs/audits/phase-5f-controlled-public-lead-activation-closeout.md`; decisions DEC-0054, DEC-0055.
- **No production deployment**; public intake remains inactive (`copy-only` / `disabled`); Closed-Won blocked until Phase 7B; Phase 6A next (not started).

### Added - Phase 5F (August 4, 2026 — implementation)
- Migration 17 (`20260804140000_controlled_public_lead_activation_hardening.sql`): `private.resolve_lead_intake_contact_by_phone`; `submit_lead_intake` identity hardening for DNC/suppressed-phone re-enquiry; loopback `::1` runtime hardening.
- pgTAP `11_controlled_public_lead_activation_test.sql`; app tests `phase-5f-b-controlled-activation.test.ts`.
- QA: DB 482/482, app 430/430 + 34 Phase 5F-B tests, H1 browser/mobile PASS.
- **Merged to protected main (PR #17)** — merge commit `2e3f3322b35865c7661a0abeeaa7f0823ed8a593`; M17 applied managed August 4, 2026 (Phase DB-6B).
- Audit: `docs/audits/phase-5f-controlled-public-lead-activation.md`.

### Added - Phase 5E Closeout (August 3, 2026)
- Phase 5E **COMPLETE**: sales target configuration, immutable target history, role-scoped reads, non-commercial CRM reporting; implementation merged (PR #15); managed migration 16 applied (Phase DB-5B).
- Protected-main merge SHA `4340a669e6dcf107081097c1edc2b79a113e36cd`; M16 `20260803140000_crm_sales_targets_reporting_foundation.sql` SHA `777A0DDB77910B7BB9A069048B10B40CE48144D5FB1D34E714875CFF0F972A58`.
- Managed Supabase aligned **M1–M16** on OneDecore (`lpurlfmpvriyvpkujvyl`); SA-only target mutation; achievement inactive until Phase 7B; no stored achieved/attainment/forecast/variance fields.
- Routes: `/admin/crm/targets`, `/admin/crm/reports`; QA DB 458/458, app 430/430, owner 19/19, browser 31/31.
- DB-5A-L verified logical recovery checkpoint accepted for M16 (fresh capture; 26/26 public application table row-count match); physical backup still delayed — fresh physical backup or active PITR mandatory before Phase 10 production activation.
- Closeout audit: `docs/audits/phase-5e-sales-targets-reporting-closeout.md`; decisions DEC-0052, DEC-0053.
- **No production deployment**; public intake inactive; Closed-Won blocked until Phase 7B; Phase 5F next (not started).

### Added - Phase 5E (August 3, 2026 — implementation)
- Migration 16 (`20260803140000_crm_sales_targets_reporting_foundation.sql`): `sales_targets`, `sales_target_events`, permissions, RLS, four public INVOKER RPC wrappers, reporting index.
- Application layer: target/reporting contracts, services, actions, queries, `/admin/crm/targets` and `/admin/crm/reports` UI.
- QA: DB 458/458, app 430/430, owner 19/19, browser 31/31.
- **Merged to protected main (PR #15)** — merge commit `4340a669e6dcf107081097c1edc2b79a113e36cd`; M16 applied managed August 3, 2026 (Phase DB-5B).
- Audit: `docs/audits/phase-5e-sales-targets-reporting.md`.

### Added - Phase 5D Closeout (August 3, 2026)
- Phase 5D **COMPLETE**: bulk import approval chain + deterministic source-based assignment; implementation merged (PR #13); managed migration 15 applied (Phase DB-4B).
- Managed Supabase aligned **M1–M15** on OneDecore (`lpurlfmpvriyvpkujvyl`); post-apply dry-run up to date; managed lint clean.
- One-time M15 logical recovery checkpoint (DB-4A-X) documented; scheduled physical backup still delayed — exception M15-only; M16+ resumes normal physical-backup gate.
- Closeout audit: `docs/audits/phase-5d-bulk-import-source-assignment-closeout.md`; decisions DEC-0050, DEC-0051 (Landing Page Lab roadmap lock).
- **No production deployment**; public intake inactive; Closed-Won blocked until Phase 7B; Phase 5E-B next (not started).

### Added - Phase 5D (August 2, 2026 — implementation)
- Migration 15 (`20260802140000_crm_bulk_import_source_assignment_foundation.sql`): bulk import batches/rows/events, assignment rules, 13 public RPCs, RLS hardening.
- Application layer: import contracts/parser/services/actions/queries, assignment rule contracts/services/actions, extended CRM auth/permissions/errors.
- CRM UI: `/admin/crm/imports` (list, wizard, detail), `/admin/crm/settings/assignment-rules`, nav capability flags.
- Owner corrections: imported leads use `entry_method=import`, `source=bulk-import`.
- QA: app 418/418, image 17/17, DB 434/434, owner 24/24, browser 32/32.
- Audit: `docs/audits/phase-5d-bulk-import-source-assignment.md`.

### Added - Phase 5C Closeout (August 2, 2026)
- Integrated closeout audit (`docs/audits/phase-5c-closeout.md`): role matrix, assignment, manual-lead/duplicate, lifecycle, and cross-slice integration verified against local migrations 1–14.
- Truth-sync: managed Supabase at migrations **1–14** (M14 applied Phase DB-3B); 5C2A/5C2B/5C2C merged to protected main; Phase 5C **COMPLETE**.
- Closeout gates: app **397/397**, image **17/17**, DB **350/350**, 5C2B Owner QA **20/20**, 5C2C Owner QA **19/19**, 5C2B Browser QA **21/21**, 5C2C Browser QA **14/14**.
- **No deployment**; public intake inactive; Closed-Won blocked until Phase 7B; Phase 5D in progress (local only).

### Added - Phase 5C2C (August 2, 2026)
- Lifecycle collaboration mutations: controlled status transitions, on-hold/resume, closed-lost, notes, follow-up create/complete/cancel (`crm-lifecycle-*`, lead detail UI islands).
- Application tests `phase-5c2c-lifecycle-collaboration.test.ts` (+20); Owner QA `phase-5c2c-owner-qa.mjs`; Browser QA `phase-5c2c-browser-qa.mjs`.
- **Merged to protected main (PR #11)** — merge commit `095358ef5ad6552c45e9f533da2fb07bcb079b03`; push-to-main CI SUCCESS; no new migration.

### Changed - Phase DB-3B (August 2, 2026)
- Migration 14 (`20260801140000_crm_manual_lead_duplicate_safe_flow.sql`) applied to managed OneDecore Supabase (`lpurlfmpvriyvpkujvyl`).
- Remote migration history aligned **1–14**; post-apply dry-run up to date; remote schema lint clean.
- Fresh WALG backup gate passed (DB-3A); **no production application deployment**; public lead intake remains inactive.

### Added - Phase 5C2B (August 1, 2026)
- Migration 14 (`20260801140000_crm_manual_lead_duplicate_safe_flow.sql`): `leads.create` and `leads.duplicate_override` permissions; conditional manual-entry schema relaxations; `check_manual_lead_duplicate` and `create_manual_lead` RPCs with concurrency-safe duplicate enforcement and privacy-safe preview.
- Manual lead server layer (`manual-lead-contracts.ts`, `crm-manual-lead-service.ts`, `crm-manual-lead-actions.ts`), UI (`/admin/crm/leads/new`, `ManualLeadForm`, `ManualLeadDuplicateNotice`), and leads list "New lead" action.
- pgTAP `08_crm_manual_lead_duplicate_safe_flow_test.sql` (61 tests); application tests `phase-5c2b-manual-lead.test.ts`; local QA scripts `phase-5c2b-owner-qa.mjs` and `phase-5c2b-browser-qa.mjs`.
- **Merged to protected main (PR #10 + H1 hotfix)** — historical note at merge time: migration 14 was repository-only; M14 applied managed August 2, 2026 (Phase DB-3B).

### Changed — Phase DB-2 / CRM Managed Database Alignment (August 1, 2026)
- Phase 5C2A PR #7 merged to protected main (`01254ee2ffde65a4e410361663aba2fb55e9dbe4`).
- Managed migrations 11, 12, and 13 applied to OneDecore Supabase (`lpurlfmpvriyvpkujvyl`) in timestamp order.
- Remote migration history aligned **1–13**; post-apply dry-run reports up to date; remote schema lint clean.
- **No production application deployment**; public lead intake remains inactive.

### Added - Phase 5C2A (July 31, 2026)
- Migration 13 (`20260731143050_crm_assignment_mutation_hardening.sql`): hardened `assign_lead` with visibility, expected-state concurrency, safe unassign lifecycle, terminal guard, and open-follow-up ownership safety.
- Assignment server layer (`assignment-contracts.ts`, `crm-assignment-service.ts`, `crm-assignment-actions.ts`), `LeadAssignmentDialog`, and authorized controls on `LeadDetailAssignmentPanel`.
- pgTAP `07_crm_assignment_mutations_test.sql` (16 tests); application tests `phase-5c2a-assignment-mutations.test.ts`; local QA scripts `phase-5c2a-owner-qa.mjs` and `phase-5c2a-browser-qa.mjs`.
- **Merged to protected main (PR #7)** — historical note at merge time: managed Supabase was at migrations 1–10; migrations 11–13 applied managed August 1, 2026 (Phase DB-2).

### Fixed - Phase CI-1 reproducibility (July 31, 2026)
- Track canonical R5.5.2 accessibility evidence ledger at `docs/audits/phase-2f-r5-5-2-final-a11y-evidence-truth-ledger.md`; update `r5-5-2-final-a11y.test.ts` to use the tracked path so clean CI checkouts pass without ignored `onedecore-chatgpt` artifacts.

### Added - Phase CI-1 (July 31, 2026)
- GitHub Actions workflow `.github/workflows/quality-gate.yml` (`ONEDECORE Quality Gate`): application job (`npm run check`, `test:app`, `test:image`) and database job (local `supabase start` → `db:reset` → `check:db` → `supabase stop`).
- Triggers on `pull_request` to `main`, `push` to `main`, and `workflow_dispatch`; `contents: read` only; no secrets or managed Supabase connectivity.
- Phase CI-1 audit (`docs/audits/phase-ci-1-github-actions-foundation.md`).
- Satisfies Phase 5C2A merge-gate prerequisite once merged; no deployment or managed migration application.

### Added - Phase 5C1 (July 31, 2026)
- Migration 12 (`20260731120000_crm_workspace_access_foundation.sql`): grants `admin.access` to canonical `sales_manager` and `sales_executive`; adds narrow `list_crm_assignable_executives()` RPC without relaxing `profiles` RLS.
- Premium read-only CRM workspace under `/admin/crm` with role-aware navigation, lead list filters/pagination, and lead detail sections (overview, contact, source, assignment, timeline, notes, follow-ups, consent summary).
- CRM server authorization (`crm-auth.ts`), query layer, contracts, components, pgTAP `06_crm_workspace_access_foundation_test.sql` (15 tests), and application tests `phase-5c1-crm-workspace.test.ts`.
- **Merged to protected main (PR #5)** — historical note at merge time: managed Supabase was at migrations 1–10; migration 12 applied managed August 1, 2026 with 11–13 (Phase DB-2).

### Fixed - Phase 5B final pre-integration hardening (July 31, 2026)
- Follow-up permission separation (`crm.follow_ups.manage` required for complete/cancel); follow-up owner eligibility helper; inactive-source write rejection; fail-closed legacy lead-state precondition; Closed-Lost table invariant; On-Hold `on_hold_previous_status` resume model; note column-level INSERT hardening.
- Expanded pgTAP `05_crm_identity_core_foundation_test.sql` to 76 tests (259 total); updated lead stage contracts.
- **Local only** — managed Supabase remains at migrations 1–10; no PR merge, deployment, or public lead activation.

### Fixed - Phase 5B security correction (July 31, 2026)
- Corrected migration 11 in place: `crm_can_mutate_lead` cross-lead authorization bug; follow-up lifecycle RPCs; source catalogue historical resolution and Super Admin mutation RPCs; assignment method derivation; `new`/`assigned` invariants; activity log completeness.
- Expanded pgTAP `05_crm_identity_core_foundation_test.sql` to 39 tests (222 total); updated CRM contracts/adapters and generated types.
- **Local only** — managed Supabase remains at migrations 1–10; no PR merge, deployment, or public lead activation.

### Added - Phase 5B (July 31, 2026)
- Migration 11 (`20260730184426_crm_identity_core_foundation.sql`): five-role RBAC extension, controlled lead-source catalogue (21 seeds), pipeline status reconciliation, assignment/status RPCs, collaboration tables, assignment-scoped RLS.
- pgTAP `05_crm_identity_core_foundation_test.sql` (39 tests after security correction); updated identity/lead intake regression expectations.
- Server-only CRM foundation under `src/features/crm/` (permissions, stages, DTOs, repository, transition adapters, tests).
- Phase 5B audit and governance doc updates.
- **Local only** — managed Supabase remains at migrations 1–10; no PR merge, deployment, or public lead activation.

### Added - Phase 5A (July 30, 2026)
- Froze CRM & Operations architecture: five-role authorization model, lead sources, manual/bulk import rules, source-based assignment (no round-robin), sales targets, quotation lifecycle, Closed-Won → PM handover invariants, design workflow, project execution stages, WhatsApp/Groq/campaign boundaries.
- Added ADR-0019 (five-role CRM authorization), ADR-0020 (Closed-Won handover), ADR-0021 (Groq copilot and WhatsApp boundary).
- Reconciled roadmap through Phase 10 with completed Phases 1A–4B2 baseline and forward phases 5B–10.
- Updated governance docs (`00`–`10`), README, decision register (DEC-0037–0044), and Phase 5A audit.
- **Documentation only** — no application code, migrations, Supabase changes, deployment, or public lead activation.
- **Independent review correction:** State-graph semantics for lead/quotation/design/project workflows; Phase 5E achievement dependency corrected to Phase 7B/8A.

### Added - Phase 4B2 (July 30, 2026)
- Migration 10: lead intake covering indexes + pgTAP `04_lead_intake_covering_indexes_test.sql`.
- Dual-gated public lead form (`copy-only` default); server intake remains `disabled`.
- `HomeLeadCapture`, consent selector hardening, plan adapter, idempotency client, runbooks, Phase 4B2 tests.
- Merged to `main`; public activation still disabled.

### Added - Phase 2E3 (July 27, 2026)
- Delivered public Portfolio experience: homepage featured section, paginated listing (`/portfolio`), dynamic detail routes (`/portfolio/[slug]`), `robots.ts`, and `sitemap.ts` (`205cb8deb081f68802589ab420bbb67b3f62e885`).
- Added central site identity (`src/config/site.ts`) with canonical domain `https://onedecore.in` (no invented legal name).
- Implemented server-only anonymous Supabase public repository layer with strict public DTOs, exact WebP derivative path validation, and `unstable_cache` tag-based revalidation wired into CMS server actions and media route handlers.
- Fixed true HTTP 404 behaviour by removing whole-route `loading.tsx` Suspense boundary that masked 404 status codes.
- Fixed database-side displayable filtering before pagination so malformed projects do not occupy listing page slots.
- Added deterministic local fixtures (`scripts/seed-local-fixtures.sql`) and production HTTP verification tooling (`scripts/verify-production-http.ts`).
- Expanded automated test suite: 107 pgTAP database tests, 90 application/public tests, 17 image/WebP tests; production HTTP gate 13/13 endpoints and 82/82 deep assertions.
- Completed controlled remote CMS-to-public E2E on official Supabase project with full zero-state cleanup (`phase-2e3c-remote-portfolio-e2e.md`).
- No schema migration; reuses existing anonymous RLS (Outcome A).
- Accepted npm audit exception: 3 high / 0 critical in Next.js nested dependencies; direct `sharp@0.35.3` unaffected.

### Added - Phase 2E2A (July 25, 2026)
- Identified and purged 15 orphaned storage objects across `portfolio-originals` and `portfolio-public` storage buckets via authenticated owner Storage API `.remove()` (0 storage objects and 0 portfolio database rows remaining).
- Created forward migration `supabase/migrations/<timestamp>_harden_portfolio_status_rpc_exposure.sql` implementing a two-tier RPC status transition architecture:
  - Re-created `public.set_portfolio_project_status(uuid, text)` as `SECURITY INVOKER` (`set search_path = ''`), resolving Supabase Security Advisor alert `authenticated_security_definer_function_executable`.
  - Created internal `private.set_portfolio_project_status_impl(uuid, text)` as `SECURITY DEFINER` (owner `postgres`, `set search_path = ''`), unexposed in PostgREST and restricted from anonymous execution.
- Extended pgTAP database test suite (`02_portfolio_media_test.sql`) to 88 subtests verifying SECURITY INVOKER/DEFINER flags, function ownership, and search_path isolation.
- Added REST exposure and RPC privilege unit tests in `portfolio-media.test.ts`.
- Created ADR-0015 (`docs/ADR/ADR-0015-private-definer-status-transition-helper.md`) and audit report (`docs/audits/phase-2e2a-status-rpc-exposure-hardening.md`).

- Applied forward-only migration `20260725044930_portfolio_cms_publication_workflow.sql` (SHA-256: `46B9E5DC248B5087018EBA5513667EA5EF150BC4FDAC4FF0A930FE1E73EFECEE`) to official remote project `lpurlfmpvriyvpkujvyl` in Mumbai (`ap-south-1`).
- Implemented Admin Portfolio CMS UI (`/admin/portfolio`, `/admin/portfolio/new`, `/admin/portfolio/[projectId]`) with React 19 server forms, `useActionState`, and server actions (`createProjectAction`, `updateProjectAction`, `setProjectStatusAction`, `deleteProjectAction`, `reorderMediaAction`).
- Created server-side Sharp 0.35.3 image processing pipeline (`src/features/portfolio/server/portfolio-image-pipeline.ts`) enforcing:
  - 20 MiB max input file size, 12,000 px max dimension, 50 MP max pixels.
  - MIME spoofing detection and rejection of animated/multi-page images (`ANIMATED_IMAGE_NOT_ALLOWED`).
  - Auto-orientation via `.rotate()` and 100% EXIF/GPS metadata stripping on private masters and public WebP derivatives.
  - Public WebP derivatives: Cover max 1600px width (quality 82), Gallery max 1200px width (quality 82), Thumbnail max 480px width (quality 78).
  - Immutable UUID-only object storage path bounds (`${projectId}/${mediaId}/${filename}`).
- Implemented multi-phase upload compensation cleanup in media upload Route Handler (`/api/admin/portfolio/media`).
- Implemented database-controlled publication workflow:
  - Revoked direct `UPDATE (status, published_at)` on `public.portfolio_projects` from `authenticated`.
  - Created status management RPC `public.set_portfolio_project_status(uuid, text)` (`SECURITY DEFINER`, owner `postgres`, `set search_path = ''`). Enforces `public.authorize('portfolio.manage')`, row lock (`FOR UPDATE`), and publication prerequisites ($\ge 1$ service, $\ge 1$ ready cover image).
  - Created service replacement RPC `public.replace_portfolio_project_services(uuid, text[])` (`SECURITY INVOKER`, `set search_path = ''`).
  - Added trigger guards: `trg_prevent_published_cover_mutation` and `trg_prevent_published_service_deletion`.
- Expanded test suite: 87 pgTAP database subtests, 11 application logic subtests, 17 image pipeline/WebP subtests. All 100% passing.
- Conducted controlled temporary remote E2E test on live project `lpurlfmpvriyvpkujvyl`, verifying end-to-end creation, image upload, RPC publishing, direct update denial, trigger guards, return to draft, and 100% zero-state cleanup.
- Created ADR-0013, ADR-0014, and Phase 2E2 audit documentation (`docs/audits/phase-2e2-portfolio-admin-cms.md`).

- Enabled Leaked Password Protection in Supabase Cloud Dashboard under Authentication → Providers → Email → Password security, resolving Security Advisor warning `auth_leaked_password_protection`.
- Applied forward-only migration `20260725033329_harden_portfolio_rls_and_audit_privileges.sql` (SHA-256: `6f0a9fd28f88c4ac58012956cb1bc74f6cf9e30b0efdf88841e0f029e199d59b`) to remote project `lpurlfmpvriyvpkujvyl` in Mumbai.
- Revoked broad table-level write privileges on all four portfolio tables and granted explicit column-level `INSERT` and `UPDATE` privileges to `authenticated` staff.
- Rendered audit fields (`id`, `created_by`, `created_at`, `updated_at`, `uploaded_by`) immutable by excluding them from column-level `UPDATE` grants.
- Consolidated `SELECT` RLS policies to eliminate `multiple_permissive_policies` warnings on `portfolio_projects`, `portfolio_project_services`, and `portfolio_media`.
- Wrapped `(select auth.uid())` and `(select public.authorize(...))` in subqueries across all table and `storage.objects` RLS policies to eliminate `auth_rls_initplan` performance warnings.
- Expanded pgTAP database test suite (`02_portfolio_media_test.sql`) to 80 subtests verifying column privilege boundaries, audit immutability, and policy consolidation.

### Added - Phase 2E1 (July 25, 2026)
- Corrected owner email redaction domain pattern in `docs/audits/phase-2d2-first-super-admin-bootstrap.md` (`o***@gmail.com` verified).
- Merged Phase 2D2 active staff authorization & initial Super Admin bootstrap into `main` with non-fast-forward merge (`56bd79f874581f1484ffbde1ee9bca2cbfdd0429`).
- Applied forward-only migration `20260725031137_portfolio_media_foundation.sql` (SHA-256: `5196de49a49c985c21df01c0042f14ebb1fbafe43a54f108e8468ef46b70e229`) to remote project `lpurlfmpvriyvpkujvyl` in Mumbai.
- Created four core portfolio tables: `portfolio_projects`, `portfolio_project_services`, `portfolio_media`, and `portfolio_media_sources`.
- Added system permissions `portfolio.read` and `portfolio.manage`, mapped to active system `super_admin` role.
- Created two Storage buckets: private `portfolio-originals` (20 MiB file limit) and public `portfolio-public` (8 MiB file limit), restricted to JPEG/PNG/WebP.
- Provisioned least-privilege RLS policies on all four portfolio tables and `storage.objects` table.
- Added updated-at triggers, foreign key indexes, check constraints, and partial unique index enforcing single active cover image per project.
- Expanded pgTAP database test suite (`02_portfolio_media_test.sql`) to 70 total subtests verifying publication state filters, audit anti-spoofing, and bucket policies.
- Generated TypeScript types (`src/types/database.generated.ts`) and created typed server repository (`getPublishedProjects`, `getPublishedProjectBySlug`, `getStaffProjects`).

### Added - Phase 2D2 (July 25, 2026)
- Merged Phase 2D1 staff authentication foundation into `main` with non-fast-forward merge (`cf734c692c087646fde618fd19674e79089dc4e9`).
- Applied forward-only active staff authorization hardening migration `20260725020833_enforce_active_staff_authorization.sql` (SHA-256: `193d7780ab27480d27c4b8a350de5804c177e9ff6b0710fcbddf36cf58e1b832`) to remote project `lpurlfmpvriyvpkujvyl` in Mumbai.
- Hardened `private.has_role(text)` and `private.has_permission(text)` database functions to require `public.profiles.status = 'active'`.
- Expanded pgTAP database test suite (`supabase/tests/database/01_identity_rbac_test.sql`) to 44 subtests verifying pending/active/suspended/disabled profile statuses.
- Completed manual owner Auth user creation and guarded one-time operational Super Admin bootstrap in Supabase Dashboard.
- Verified manual end-to-end authentication flow on `http://localhost:3000` (Login, Admin Shell, Sign-Out, Proxy Protection, Generic Invalid Password Error).
- Updated audit log (`docs/audits/phase-2d2-first-super-admin-bootstrap.md`) and governance documentation.

### Added - Phase 2D1 (July 25, 2026)
- Merged Phase 2C identity and RBAC foundation into `main` with non-fast-forward merge.
- Applied forward-only migration `20260725013043_staff_authorization_rpc.sql` (SHA-256: `ead1c5413b097c615188558db76d8ca850982e5eab8ae6a29e8823ffa2237296`) to remote project `lpurlfmpvriyvpkujvyl` in Mumbai.
- Provisioned public `SECURITY INVOKER` authorization RPC wrapper `public.authorize(requested_permission text)` delegating to `private.has_permission()`.
- Implemented staff-only email/password login route (`/auth/login`), Server Action (`loginAction`), and client form with accessible warm-luxury styling.
- Implemented POST-only sign-out handler (`/auth/signout`) returning 405 Method Not Allowed for GET.
- Implemented access forbidden page (`/auth/forbidden`) for authenticated users lacking `admin.access` permission.
- Implemented server-side authorization helpers (`getStaffClaims`, `checkPermission`, `requireStaffPermission`) in `src/server/auth/`.
- Updated Next.js 16 Proxy in `src/lib/supabase/proxy.ts` and `src/proxy.ts` to protect `/admin/:path*` routes using `getClaims()`.
- Implemented minimal internal admin layout (`src/app/admin/layout.tsx`) and dashboard shell (`src/app/admin/page.tsx`) with `force-dynamic` rendering.
- Expanded pgTAP database test suite (`supabase/tests/database/01_identity_rbac_test.sql`) to 37 subtests.
- Updated ADRs (`ADR-0009`, `ADR-0010`) and audit log (`docs/audits/phase-2d1-staff-auth-foundation.md`).

### Added - Phase 2C3 (July 24, 2026)
- Applied forward-only hardening migration `20260724192233_secure_rls_event_trigger_and_index_assignment_actor.sql` (SHA-256: `3ef8512a50a26610d8ee2960661dcf21f8bf8a0142064fea0bd02e75ba0c4c1b`) to remote project `lpurlfmpvriyvpkujvyl` in Mumbai.
- Revoked direct `EXECUTE` privileges on platform helper `public.rls_auto_enable()` from `public`, `anon`, and `authenticated` while retaining active `ensure_rls` event trigger owned by `postgres`.
- Added covering index `idx_user_roles_assigned_by` on `public.user_roles(assigned_by)`.
- Expanded pgTAP database test suite (`supabase/tests/database/01_identity_rbac_test.sql`) to 27 subtests.
- Verified Security Advisor and Performance Advisor findings resolved with zero schema drift and 0 business data/user mutations.

### Added - Phase 2C2 (July 24, 2026)
- Applied reviewed migration `20260724174648_identity_rbac_foundation.sql` (SHA-256: `a19dc6d497401b6cdd1df7bee6f8c5bc1e5f1aa354135debebfab4a659e1a9dd`) to remote Supabase project `lpurlfmpvriyvpkujvyl` in Mumbai (`ap-south-1`).
- Verified 1:1 local and remote migration history match via `npx supabase migration list`.
- Executed linked database linting (`npx supabase db lint --linked --level warning`) with 0 schema errors.
- Verified remote TypeScript type generation matching local database type contract.
- Verified remote object inventory (1 private schema, 5 public tables, 6 system roles, 6 system permissions, 100% RLS coverage, 0 Auth users, 0 Storage buckets, 0 business tables).

### Added - Phase 2C1 (July 24, 2026)
- Hardened foundation migration `20260724174648_identity_rbac_foundation.sql`:
  - Removed `IF NOT EXISTS` from schema, table, and index DDL to fail loudly on unexpected schema drift.
  - Added explicit `REVOKE ALL ON TABLE ... FROM public, anon, authenticated` before least-privilege grants.
  - Configured strict column-level write privileges for `profiles`, `roles`, `permissions`, and `user_roles`.
  - Enforced system RBAC record immutability (`is_system = true`) via RLS policies.
  - Restricted `user_roles` assignment attribution (`assigned_by = auth.uid()`).
  - Added display name metadata normalization (max 120 chars) in `private.handle_new_auth_user()`.
  - Removed `SECURITY DEFINER` from `private.set_updated_at()`.
- Expanded pgTAP database test suite (`01_identity_rbac_test.sql`) to 19 subtests.
- Established Shared-Docker Desktop policy with strict project isolation and zero global prune commands.
- Regenerated TypeScript types (`src/types/database.generated.ts`).

### Added - Phase 2C (July 24, 2026)
- Installed `supabase@2.109.1` devDependency and initialized local CLI configuration (`supabase/config.toml`).
- Created identity & RBAC migration `20260724174648_identity_rbac_foundation.sql` (`private` schema, `profiles`, `roles`, `permissions`, `role_permissions`, `user_roles`).
- Implemented `private.has_role()` and `private.has_permission()` security-definer helper functions.
- Seeded 6 foundation roles and 6 permissions with role-permission mappings.
- Configured 100% RLS policies and revoked table privileges from `anon`.
- Created pgTAP database tests (`supabase/tests/database/01_identity_rbac_test.sql`).
- Added package scripts (`db:start`, `db:stop`, `db:reset`, `db:lint`, `db:test`, `check:db`).
- Generated typed database interfaces (`src/types/database.generated.ts`) and updated Supabase client wrappers.
- Created ADRs `ADR-0007` and `ADR-0008` and audit log `docs/audits/phase-2c-identity-rbac-foundation.md`.

### Added - Phase 2B (July 24, 2026)
- Connected Next.js App Router to Mumbai Supabase project (`lpurlfmpvriyvpkujvyl.supabase.co`).
- Installed `@supabase/supabase-js@2.110.8` and `@supabase/ssr@0.12.3`.
- Created browser-safe environment validator `src/config/env.ts` requiring HTTPS and `sb_publishable_` prefix.
- Built ONEDECORE client wrappers (`src/lib/supabase/client.ts`, `src/lib/supabase/server.ts`, `src/lib/supabase/proxy.ts`).
- Configured Next.js 16 Proxy in `src/proxy.ts` matched to `/admin/:path*` and `/auth/:path*`.
- Created audit log `docs/audits/phase-2b-supabase-ssr-foundation.md`.

### Added - Phase 2A (July 24, 2026)
- Scaffolded Next.js 16.2.11 with TypeScript, ESLint, and Tailwind CSS v4 in `src/` directory.
- Established Node.js 24 LTS and npm 11.16.0 engine contracts (`.nvmrc`, `.node-version`, `.npmrc`).
- Added package quality scripts (`dev`, `build`, `start`, `lint`, `typecheck`, `check`).
- Added `.env.example` with Supabase key placeholders and security guidance.
- Created minimal application shell (`layout.tsx`, `page.tsx`, `globals.css`, `error.tsx`, `not-found.tsx`).
- Created audit log `docs/audits/phase-2a-engineering-scaffold.md`.

### Added - Phase 1C (July 24, 2026)
- Established formal repository governance documentation baseline in `docs/`.
- Created Architecture Decision Records (`ADR-0001` through `ADR-0006`).
- Created baseline audits (`phase-1a-baseline-audit.md` and `phase-1b-owner-review.md`).
- Added workspace governance files (`.editorconfig`, `.gitignore`, `README.md`, `CHANGELOG.md`, `CONTRIBUTING.md`, `SECURITY.md`).
- Formally recorded mandatory corrections (Next.js 16.x release targeting, Supabase-before-n8n lead persistence, Meta webhook verified endpoint, `/admin` route prefix, private portfolio master storage vs public optimized derivatives).
- Initialized local Git repository on branch `main` with baseline commit.

---

## [0.1.0-phase1b] - 2026-07-24

### Added
- Completed Phase 1B Architecture Freeze and decision matrix.
- Defined locked product scope, sitemap, homepage information architecture, portfolio lifecycle, Supabase data domains, CRM pipeline, and n8n boundaries.

---

## [0.0.1-phase1a] - 2026-07-24

### Added
- Completed Phase 1A read-only baseline audit confirming empty directory state and zero external project contamination.
