# ADR-0029 — Phase 9B Landing Page Lab & Experimentation Architecture

**Status:** ACCEPTED / ARCHITECTURE FROZEN  
**Date:** 2026-08-18  
**Phase:** 9B — Landing Page Lab & Experimentation  
**Owner authorization:** `LOCK PHASE 9B OWNER DECISIONS AS RECOMMENDED`  
**Decision:** DEC-0081 / OD9B-1–OD9B-12  
**Implementation migration:** M32 conceptually reserved; **ABSENT / NOT CREATED in this gate**  
**Production activation:** **NONE**

---

## 1. Context

Phase 9A is complete and managed through immutable M31. ONEDECORE now has campaign-governance truth, but it does not yet have a live landing-page factory, controlled publication lifecycle, experiment routing, privacy-safe exposure denominator, or landing-to-CRM attribution bridge.

A migration-independent Phase 9B prebuild already exists under `src/features/landing-lab/**`. It is useful engineering scaffolding, but prior Phase 9A governance explicitly states that it is **not architecture authority**. Phase 9B therefore reconciles that prebuild to the current roadmap, managed database truth, public lead-intake boundary, CRM attribution model, and Phase 9A campaign boundary before M32 or runtime activation.

Current protected baseline for this freeze:

- protected `main`: `083b7384b05199dd4bbed8882cb8e4a585fe2393`;
- repository migrations: M1–M31;
- managed OneDecore `lpurlfmpvriyvpkujvyl`: M1–M31, pending NONE;
- M31 immutable;
- managed campaign rows: zero at entry;
- managed leads and lead-source touchpoints: zero at entry;
- no landing-page tables or landing permissions;
- public lead intake remains disabled / production activation remains Phase 10;
- Phase 9C campaign execution remains not implemented;
- Phase 9D remains roadmap-locked and not implemented.

---

## 2. Decision Summary

Phase 9B will build a **structured, versioned Landing Page Lab** inside the existing ONEDECORE modular monolith and Supabase data plane.

The design deliberately avoids:

- unrestricted HTML/page-builder execution;
- a parallel lead API;
- a parallel consent store;
- a parallel CRM attribution truth table;
- hard Phase 9A campaign → Phase 9B foreign-key coupling;
- autonomous experiment winners;
- Meta/Google provider execution;
- n8n as source of truth;
- production activation before Phase 10.

---

## 3. Owner Locks

### OD9B-1 — Structured page builder

**LOCK:** `STRUCTURED_BLOCK_VERSIONING_NO_FREEFORM_HTML`

Landing content is persisted as a bounded, validated ordered block document. V1 uses controlled block types such as hero, trust proof, service highlights, process, portfolio preview, testimonials, FAQ, offer CTA, lead form placeholder, and footer.

No arbitrary HTML, script execution, `dangerouslySetInnerHTML`, unrestricted CSS injection, embedded JavaScript, or general-purpose drag-and-drop website builder is allowed in V1.

Draft versions may be edited. Once frozen for publication or experiment use, a version is immutable. Further editing creates a new version.

---

### OD9B-2 — Publication lifecycle

**LOCK:** `DRAFT_LIVE_PAUSED_ARCHIVED_NO_SCHEDULER`

Canonical V1 publication lifecycle:

`draft → live ↔ paused → archived`

Rules:

- `draft`: staff-only configuration/preview; not publicly reachable;
- `live`: publicly routable;
- `paused`: retained but not publicly served; may return to `live`;
- `archived`: terminal for that publication;
- archive never deletes page/version/experiment history;
- no `scheduled` authoritative state in Phase 9B;
- scheduling/provider execution belongs to Phase 9C;
- preview is not publication.

This decision supersedes the migration-independent prebuild's `draft | scheduled | live` publication status for the later implementation gate.

---

### OD9B-3 — Experiments

**LOCK:** `DETERMINISTIC_ABC_HUMAN_WINNER`

V1 experiment scope is deliberately limited to **2 or 3 variants** (A/B or A/B/C).

Each running experiment:

- binds only frozen page versions;
- has unique bounded variant keys;
- uses integer allocation percentages summing exactly to 100;
- routes deterministically from a stable first-party visitor key;
- never uses `Math.random()` as allocation authority;
- becomes immutable once running except for controlled conclude/winner fields;
- has a human-selected winner;
- does not use adaptive allocation, autonomous AI optimization, or provider-side experiment truth.

The existing prebuild allowance of up to 8 variants is not canonical and must be reconciled during implementation.

---

### OD9B-4 — Phase 9A campaign coupling

**LOCK:** `OPAQUE_CAMPAIGN_LINK_NO_M31_REWRITE`

M31 is immutable.

`campaign_versions.destination_reference` remains a bounded opaque Phase 9A field. Phase 9B does not retrofit a landing-page FK into M31 and does not modify campaign approval semantics.

A landing publication may persist an optional **snapshot** of:

- `campaign_reference`;
- `campaign_version_number`.

That snapshot is for navigation/analytics only. It is not a bidirectional FK contract and cannot mutate campaign approval state.

UTM `utm_campaign` remains separate from ONEDECORE's canonical `OD-C-*` campaign identity.

---

### OD9B-5 — Lead intake boundary

**LOCK:** `REUSE_EXISTING_ATOMIC_PUBLIC_INTAKE`

`/api/public/lead-intake` remains the only public lead-creation boundary.

Phase 9B must preserve existing:

- same-origin enforcement;
- bounded request body handling;
- normalized-phone identity;
- DNC/suppressed-channel preservation;
- idempotency;
- rate limiting;
- service-enquiry consent semantics;
- service-role-only atomic RPC persistence;
- production disabled-by-default activation gate.

No `/api/public/landing-lead`, campaign-specific lead API, browser Supabase insert, or n8n-first lead path is allowed.

For `/lp/*` submissions, the server verifies signed publication context and then augments the existing validated intake attribution before calling the existing atomic persistence boundary.

---

### OD9B-6 — Attribution truth

**LOCK:** `ENRICH_EXISTING_LEAD_SOURCE_TOUCHPOINT_NO_PARALLEL_ATTRIBUTION_TRUTH`

Existing authoritative intake/CRM stores are reused:

- `public.leads.landing_path`;
- `public.leads.attribution`;
- `public.lead_source_touchpoints`.

Phase 9B does **not** create `landing_attribution_touchpoints`, `campaign_leads`, or another lead/conversion truth table.

For a valid Landing Lab submission, server-trusted attribution may include:

- landing page reference;
- page version number;
- publication reference;
- experiment reference;
- variant key;
- optional canonical `OD-C-*` campaign reference/version snapshot;
- UTM source/medium/campaign/content/term;
- `fbclid`;
- `gclid`.

M32 may forward-only replace/enrich the existing lead-after-insert touchpoint trigger so the automatically created first `lead_source_touchpoints` row captures canonical campaign reference and bounded landing attribution metadata. Historical M11/M17 migrations are never edited.

Client-supplied landing identity is not trusted. Publication/page/version/experiment/variant/canonical campaign identity comes only from verified server-issued publication context.

---

### OD9B-7 — Consent

**LOCK:** `SERVICE_ENQUIRY_ONLY_NO_FABRICATED_MARKETING_CONSENT`

Landing Page Lab forms collect a service enquiry under the existing consent contract.

Phase 9B must not:

- grant MARKETING consent;
- infer MARKETING from UTM/click IDs/campaign association;
- infer MARKETING from a service enquiry;
- change WHATSAPP_SERVICE semantics;
- reactivate DNC/suppressed channels.

Phase 9A `consent_events` remains the only MARKETING-consent authority.

---

### OD9B-8 — Qualified conversion analytics

**LOCK:** `CRM_STAGE_DERIVED_NO_PARALLEL_LEAD_QUALITY_STATUS`

Phase 9B does not add a competing lead-quality lifecycle.

Variant quality is derived from existing CRM truth:

1. lead created;
2. `qualified`;
3. `consultation_scheduled`;
4. `proposal_sent`;
5. later `closed_won` when commercial prerequisites are satisfied.

Phase 9B dashboards may report counts/rates by publication/experiment/variant, but cannot mutate or reinterpret CRM pipeline state.

Provider conversion feedback and spend/cost attribution remain Phase 9C.

---

### OD9B-9 — RBAC

**LOCK:** `SA_SM_LANDING_LAB_MANAGEMENT_ONLY`

Phase 9B introduces dedicated Landing Lab permissions rather than silently reusing Campaign permissions.

Conceptual V1 permissions:

- `landing_pages.read`;
- `landing_pages.manage`;
- `landing_pages.publish`;
- `landing_experiments.manage`;
- `landing_analytics.read`.

V1 grants are limited to active:

- `super_admin`;
- `sales_manager`.

Sales Executive, Project Manager, Designer, Kriti, anonymous users, and ordinary authenticated clients receive no Landing Lab management authority.

Public serving is via bounded server-side publication reads, not anonymous direct mutation access.

---

### OD9B-10 — Route model and SEO

**LOCK:** `ADMIN_LANDING_PAGES_PLUS_PUBLIC_LP_SLUG`

Admin workspace:

- `/admin/landing-pages`;
- optional nested editor/detail routes beneath it.

Public Landing Lab route:

- `/lp/[slug]`.

Rules:

- only a `live` publication is publicly served;
- `draft`, `paused`, `archived`, malformed, or unknown publication resolves through a non-enumerating unavailable/not-found path;
- campaign landing pages are **`noindex, nofollow` by default**;
- canonical public site/portfolio SEO remains separate;
- Phase 9B must not pretend the documented `/consultation` path exists unless a real route is separately implemented.

---

### OD9B-11 — Privacy-safe experiment denominator

**LOCK:** `PRIVACY_SAFE_EXPOSURE_EVENTS`

Experiment conversion rates require a real denominator.

Phase 9B may persist a minimal exposure/assignment fact containing only:

- publication reference/id;
- experiment reference/id if applicable;
- variant key if applicable;
- server-side HMAC/hash of the first-party visitor key;
- bounded timestamp/assignment epoch.

Do not store raw visitor cookie IDs, IP addresses, phone/email, CRM identity, unrestricted user agent, or arbitrary referrer text in the exposure table.

V1 analytics should use privacy-safe unique routed visitor/assignment counts rather than refresh-inflated raw pageview counts.

The raw first-party visitor key remains client-cookie material only and should be Secure/HttpOnly/SameSite-bounded in production.

---

### OD9B-12 — Activation boundary

**LOCK:** `PHASE10_PRODUCTION_GATE_NO_9C_EXECUTION`

Phase 9B may implement:

- landing persistence;
- structured editor;
- preview;
- publication state;
- deterministic experiments;
- signed publication context;
- privacy-safe exposure facts;
- intake attribution bridge;
- role-aware internal analytics.

Phase 9B does **not** activate:

- production public lead intake;
- production Landing Lab traffic;
- Meta Ads mutations;
- Google Ads mutations;
- campaign runs;
- provider spend;
- server-side provider conversion feedback;
- WhatsApp MARKETING sends;
- autonomous optimization;
- n8n campaign truth.

Phase 10 remains the production activation gate. Phase 9C owns approved provider execution and conversion feedback.

---

## 4. Canonical Domain Model for M32

M32 is conceptually reserved as:

`landing_page_lab_experimentation_foundation`

No migration is created in this architecture-freeze gate.

### 4.1 `public.landing_pages`

Stable landing-page identity.

Conceptual fields:

- UUID primary key;
- immutable `OD-LP-{YYYY}-{SEQ}` reference;
- stable unique bounded slug;
- title;
- creator/audit timestamps.

The root is identity, not mutable public content.

### 4.2 `public.landing_page_versions`

Versioned structured content.

Conceptual fields:

- page FK;
- positive version number unique per page;
- ordered blocks JSON;
- canonical content hash;
- label;
- `frozen_at`;
- creator/audit timestamps.

Rules:

- unfrozen draft version can be edited through authorized RPC;
- frozen version is immutable;
- publication/experiment binding requires frozen version;
- no hard delete of frozen history.

### 4.3 `public.landing_publications`

Public route/publication authority.

Conceptual fields:

- immutable publication reference;
- page + exact page-version binding;
- slug snapshot/path identity;
- status `draft | live | paused | archived`;
- optional opaque campaign reference/version snapshot;
- publish/pause/archive actor/timestamps;
- lock version / idempotent mutation support.

At most one public live publication may own a given public slug at one time.

### 4.4 `public.landing_experiments`

Experiment root/state.

Conceptual fields:

- immutable experiment reference;
- publication binding;
- status `draft | running | concluded`;
- winner variant key nullable until concluded;
- start/conclude actor/timestamps.

Running configuration is frozen. Concluded experiment is immutable.

### 4.5 `public.landing_experiment_variants`

Two or three frozen-version assignments.

Conceptual fields:

- experiment FK;
- bounded unique variant key;
- frozen page-version binding;
- integer allocation percent;
- label.

Allocation sum = 100.

### 4.6 `public.landing_exposures`

Minimal privacy-safe denominator.

Conceptual fields:

- publication FK/reference;
- experiment/variant nullable;
- visitor-key HMAC/hash;
- assignment epoch / first-exposure timestamp.

No PII.

A uniqueness contract prevents page refresh from creating unlimited denominator inflation for the same assignment epoch.

### 4.7 Private retry/idempotency ledger

Landing management mutations follow the existing durable retry-safe RPC pattern. Exact private object naming is finalized in M32 implementation, but it must not become a public business table.

---

## 5. Signed Publication Context

The existing migration-independent HMAC publication-context pattern is retained in principle, but implementation must bind the signed payload to current canonical M32 publication state.

Server-issued context must include at minimum:

- publication reference;
- page reference;
- page version;
- experiment reference nullable;
- variant key nullable;
- issue time;
- expiry/bounded validity;
- optional canonical campaign reference/version snapshot when server-resolved.

Requirements:

- HMAC secret is server-only;
- deterministic canonical serialization;
- constant-time signature comparison;
- expiry enforced;
- any client tampering fails closed;
- a `/lp/*` lead submission requires a valid context;
- homepage/non-Landing-Lab intake remains backward compatible without a fabricated Landing Lab context.

---

## 6. Public Rendering & Variant Routing

The server resolves `/lp/[slug]` as follows:

1. resolve current `live` publication by slug;
2. resolve exact frozen control page version;
3. if no running experiment, render control;
4. if a running experiment exists, obtain/create bounded first-party visitor key;
5. deterministically allocate among 2–3 variants;
6. persist privacy-safe exposure/assignment fact;
7. sign the resolved publication context;
8. render the selected frozen version and lead form;
9. never expose service-role credentials or management RPCs to the browser.

Paused/archived/draft publications do not render publicly.

---

## 7. Existing Lead-Intake Reconciliation

The current atomic intake already persists:

- `public.leads.landing_path`;
- `public.leads.attribution`.

The current server validator accepts standard UTM fields but not `fbclid`/`gclid`, and rejects unknown attribution keys. Phase 9B implementation must extend this validation deliberately.

M32/runtime reconciliation must:

- add bounded `fbclid`/`gclid` normalization;
- accept/construct trusted landing identity only after signed-context verification;
- keep arbitrary unknown attribution keys rejected;
- keep request hashing/idempotency stable and deterministic;
- preserve generic homepage intake compatibility;
- enrich the existing CRM first-touchpoint projection forward-only.

No M17 rewrite.

---

## 8. Analytics

Phase 9B internal analytics may expose:

- routed unique visitors;
- lead count;
- lead conversion rate;
- qualified count/rate;
- consultation scheduled count/rate;
- proposal sent count/rate;
- later closed-won count/rate when available;
- winner comparison across variants;
- publication/experiment history.

Analytics are computed from:

- `landing_exposures` denominator;
- existing `leads` + CRM stage;
- existing `lead_source_touchpoints` and lead attribution.

No provider spend/cost calculations in 9B.

---

## 9. Security & RLS

- 100% RLS on API-exposed new tables.
- No anonymous direct table writes.
- Staff mutations through permission-checked RPC/server boundaries.
- Frozen page versions immutable at database level.
- Publication/experiment terminal constraints enforced at database level.
- No raw PII in exposure store.
- Service-role key server-only.
- Public content DTOs expose only safe rendered data.
- All URLs/text remain bounded and sanitized.
- No arbitrary HTML execution.
- No marketing consent fabrication.
- No direct browser mutation of CRM/campaign truth.

---

## 10. n8n Boundary

n8n may later receive post-persistence events for notifications/analytics operations, but:

- it never chooses authoritative experiment variant;
- it never creates the canonical lead before Supabase persistence;
- it never owns publication state;
- it never owns campaign approval;
- it never grants consent;
- it never becomes conversion truth.

---

## 11. Prebuild Reconciliation Required During Implementation

The existing `src/features/landing-lab/**` prebuild is retained until the M32 implementation gate. Implementation must reconcile, not blindly promote, it.

Known reconciliations:

1. publication `scheduled` state → canonical `draft | live | paused | archived`;
2. experiment max 8 → canonical max 3;
3. route/admin mount currently absent;
4. dedicated landing permissions currently absent;
5. public intake validator currently does not accept `fbclid`/`gclid`;
6. client cannot be trusted to self-assert landing/variant identity;
7. prebuild form-success/touchpoint contracts must reuse current CRM/intake persistence instead of creating parallel truth.

---

## 12. Explicitly Deferred

Deferred to Phase 9C:

- Meta/Google campaign execution;
- campaign runs;
- spend ingestion;
- provider conversion APIs;
- cost-per-lead/qualified/commercial metrics;
- provider audience upload;
- WhatsApp MARKETING execution.

Deferred to Phase 10:

- production route activation;
- production public intake activation;
- production environment secrets/cookie hardening certification;
- full deployment/performance/security certification.

Out of V1:

- unrestricted visual website builder;
- arbitrary code embeds;
- AI-autonomous page publishing;
- AI-autonomous winner selection;
- multi-tenant landing domains;
- full CDP/marketing data warehouse;
- ERP.

---

## 13. Consequences

### Positive

- Preserves ONEDECORE's single CRM/intake truth.
- Reuses Phase 9A without coupling M31 to future tables.
- Gives Meta/Google campaigns measurable variant quality later.
- Enables qualified-outcome optimization rather than vanity clicks.
- Keeps V1 implementation small enough for fast launch.
- Maintains strong security/privacy and immutable history.

### Trade-offs

- V1 is less flexible than Webflow/Unbounce-style unrestricted builders.
- Only A/B/C experiments are supported.
- Provider spend/ROAS is unavailable until 9C.
- Production traffic remains blocked until Phase 10.

These are intentional scope controls, not missing architecture.

---

## 14. Implementation Gate

After this docs-only freeze is merged:

1. run Phase 9B M32 implementation preflight;
2. reconcile prebuild contracts/tests;
3. create forward-only M32;
4. implement RLS/RPC/server/admin/public route changes;
5. prove local DB + application tests;
6. open separate implementation PR;
7. managed apply only after separate recovery/apply authorization;
8. no production activation.

This ADR does not authorize M32 creation, managed writes, provider execution, or production activation.
