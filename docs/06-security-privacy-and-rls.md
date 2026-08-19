# 06 — SECURITY, PRIVACY AND ROW LEVEL SECURITY (RLS) POLICIES

**Document Status:** Locked Security Baseline (truth-synced through Phase 9C architecture freeze, August 19, 2026)
**RLS Target:** 100% Coverage on API-Exposed Application Tables
**Default Access:** Anonymous Access Denied for Private Schemas

---

## 1. Security Architecture & RLS Model

Following mandatory corrections in Phase 1B, RLS policies are applied to all API-exposed Supabase PostgreSQL tables.

```
┌──────────────────────────────────────────────────────────┐
│                   SUPABASE DATABASE                      │
│                                                          │
│  ┌────────────────────────┐  ┌────────────────────────┐  │
│  │ Public Portfolio Tables│  │ CRM & Private Tables   │  │
│  │ (portfolio_projects,   │  │ (leads, quotations,    │  │
│  │  portfolio_media)      │  │  whatsapp_messages)    │  │
│  └───────────┬────────────┘  └───────────┬────────────┘  │
│              │                           │               │
│              ▼                           ▼               │
│  ┌────────────────────────┐  ┌────────────────────────┐  │
│  │ Public Read Allowed    │  │ Anon Access Denied     │  │
│  │ (status = 'published') │  │ (Authenticated Staff   │  │
│  │                        │  │  Only via RBAC)        │  │
│  └────────────────────────┘  └────────────────────────┘  │
└──────────────────────────────────────────────────────────┘
```

---

## 2. Identity & RBAC RLS Contract (Phase 2C1 Baseline)

- **Least-Privilege Privilege Reset:** Explicit `REVOKE ALL ON TABLE ... FROM public, anon, authenticated` executed prior to explicit grants.
- **Column-Level Write Security:**
  - `profiles`: `UPDATE` restricted to (`display_name`, `phone_e164`, `status`). `id`, `created_at`, `updated_at` cannot be updated via Data API.
  - `roles` & `permissions`: `INSERT`/`UPDATE` restricted to non-system records (`is_system = false`) and non-key columns (`name`, `description`, `is_active`).
  - `user_roles`: `INSERT` restricted to (`user_id`, `role_id`). `assigned_by` defaults to `auth.uid()` and cannot be forged.
- **System Record Immutability:** Seeded system roles (`super_admin`, `management`, `sales`, `designer`, `project_operations`, `content_manager`) and permissions are protected from Data API modification or deletion.
- **Platform Helper Hardening (Phase 2C3):** Direct API execution on platform helper `public.rls_auto_enable()` revoked from `public`, `anon`, and `authenticated`. Event trigger `ensure_rls` remains active and owned by `postgres`.
- **Actor Foreign Key Coverage (Phase 2C3):** Added covering index `idx_user_roles_assigned_by` on `public.user_roles(assigned_by)` for actor-based audit query optimization.
- **Public Authorization RPC (Phase 2D1):** `public.authorize(requested_permission text)` wrapper (`SECURITY INVOKER`, `STABLE`, `SET search_path = ''`) delegating to `private.has_permission()`. Granted to `authenticated`, revoked from `anon` and `public`.
- **Active Staff Profile Enforcement (Phase 2D2):** Hardened `private.has_role(text)` and `private.has_permission(text)` to require `public.profiles.status = 'active'`. Pending, suspended, or disabled staff profiles are automatically denied authorization even if active role assignments exist.

## 3. Policy Enforcement Matrix

1. **Anonymous Role (`anon`):**
   - Read access permitted exclusively for `portfolio_projects` and `portfolio_media` where `status = 'published'`.
   - Write access denied on 100% of database tables. Public lead form submissions execute via server-side API endpoints (`/api/leads`), which use sanitized server contexts.
2. **Authenticated Staff Roles (`authenticated`):**
   - Access restricted by assigned user role via helper functions (`auth.jwt() -> role`).
   - Sales reps access owned/assigned leads and quotations.
   - Designers access assigned projects.
   - Operations access assigned site visits and handoff tasks.
   - Content Managers access portfolio CMS tables.
   - Management & Super Admin access broad operational tables.

---

## 3. Storage Security & Signed URLs

- **Private Master Assets:** Master high-res portfolio images (`private-portfolio-masters`) and client documents (`private-crm-documents`) reside in non-public storage buckets.
- **Signed URL Access:** Client access to private project documents is restricted to short-lived signed URLs (15-minute expiry).
- **Public Optimized Derivatives:** Public site assets (`public-portfolio-derivatives`) are served via CDN with immutable caching headers.

---

## 4. Privacy & Consent Safeguards

- **CRM consent authority:** `contacts`, `contact_channels`, and append-only `consent_events` are the sole consent store. Purpose codes include `SERVICE_ENQUIRY`, `SERVICE_COMMUNICATION`, `WHATSAPP_SERVICE`, and `MARKETING`. A service enquiry or inbound service-communication message is **not** `MARKETING` consent. Global DNC is `contacts.status = 'do_not_contact'`. Channel suppression is `contact_channels.status = 'suppressed'`. `contact_suppressions` is **not** a Phase 9A table.
- **Phase 6A (M18) boundary:** WhatsApp foundation tables store message/webhook audit data only. M18 does **not** create a parallel WhatsApp consent store, grant `MARKETING` consent, clear DNC, fabricate consent from inbound messages, or auto-create/link CRM contacts or leads.
- **Public lead intake consent:** Opt-in consent logged with timestamp during controlled web form submission when intake is enabled (currently **inactive**). Public MARKETING capture remains **OFF**. Opt-out request (`STOP`) must update CRM consent/suppression truth via governed flows — not inferred by M18 schema alone.
- **PII Protection:** Customer names, phone numbers, and addresses masked in non-essential CRM administrative views.
- **Audit Trails:** All sensitive mutations (role changes, discount overrides, lead status changes) logged to `system_audit_logs`.

---

## 5. Phase 2E1 Portfolio & Storage RLS Policies

- **Portfolio System Permissions:** `portfolio.read` and `portfolio.manage` mapped to system `super_admin` role.
- **Table RLS Enforcement:**
  - `portfolio_projects`: Public `SELECT` allowed when `status = 'published'`. Staff `SELECT` allowed with `portfolio.read` or `portfolio.manage`. Staff mutations (`INSERT`, `UPDATE`, `DELETE`) require `portfolio.manage` with audit anti-spoofing (`created_by = auth.uid()`, `updated_by = auth.uid()`).
  - `portfolio_project_services`: Public `SELECT` allowed when parent project is published. Staff mutations require `portfolio.manage`.
  - `portfolio_media`: Public `SELECT` allowed when `status = 'ready'` and parent project is published. Staff mutations require `portfolio.manage`.
  - `portfolio_media_sources`: Private table. `SELECT`, `INSERT`, `UPDATE`, `DELETE` strictly restricted to staff with `portfolio.manage` and `uploaded_by = auth.uid()`. Inaccessible to anonymous visitors.
- **Storage Bucket RLS Policies:**
  - `portfolio-originals` (Private, 20 MiB limit): `SELECT`, `INSERT`, `UPDATE`, `DELETE` policies on `storage.objects` strictly check `bucket_id = 'portfolio-originals' AND public.authorize('portfolio.manage')`.
  - `portfolio-public` (Public, 8 MiB limit): Direct HTTP GET enabled. `INSERT`, `UPDATE`, `DELETE` policies on `storage.objects` check `bucket_id = 'portfolio-public' AND public.authorize('portfolio.manage')`.

---

## 6. Phase 2E2 / Phase 2E2A Portfolio CMS Publication & RPC Security Contracts

- **Direct Status Column Revocation:** `REVOKE UPDATE (status, published_at) ON public.portfolio_projects FROM authenticated;`
- **Public Wrapper RPC (`public.set_portfolio_project_status`):** Defined as `SECURITY INVOKER` (`set search_path = ''`). Exposed under `/rest/v1/rpc/set_portfolio_project_status`. `EXECUTE` granted to `authenticated` only; revoked from `anon` and `public`. Delegates execution to private definer helper. Resolves Security Advisor warning `authenticated_security_definer_function_executable`.
- **Private Helper (`private.set_portfolio_project_status_impl`):** Defined as `SECURITY DEFINER` (owner `postgres`, `set search_path = ''`). Unexposed in PostgREST. Executable by `authenticated`; revoked from `anon` and `public`. Requires `public.authorize('portfolio.manage')`, non-null `auth.uid()`, locks target row (`FOR UPDATE`), and validates publication prerequisites ($\ge 1$ assigned service, $\ge 1$ ready cover image) before setting `status = 'published'` and `published_at = NOW()`.
- **Atomic Service Replacement RPC (`public.replace_portfolio_project_services`):** Defined as `SECURITY INVOKER` (`set search_path = ''`). `EXECUTE` granted to `authenticated` only. Validates service array bounds ($1 \le count \le 3$) and executes atomic service replacement.
- **Published Cover Guard Trigger (`trg_prevent_published_cover_mutation`):** `BEFORE UPDATE OR DELETE ON public.portfolio_media` (`SECURITY INVOKER`, `set search_path = ''`). Blocks deletion or mutation of ready cover images on `published` projects.
- **Published Final Service Guard Trigger (`trg_prevent_published_service_deletion`):** `BEFORE DELETE ON public.portfolio_project_services` (`SECURITY INVOKER`, `set search_path = ''`). Blocks deletion of the final service on a `published` project.

---

## 7. Phase 5B CRM Security Implementation (Managed — migrations 11–14 applied 2026-08-01/02)

- **Executive isolation:** `leads.read_assigned` + `private.crm_can_view_lead(assigned_to)` row predicates; unassigned leads invisible to executives.
- **Manager breadth:** `leads.read_all` sees all sales leads and unassigned queue.
- **Direct bypass denied:** `REVOKE UPDATE (status, assigned_to)`; trigger blocks pipeline mutation outside RPCs (`onedecore.crm_transition` session flag).
- **RPC pattern:** `public.assign_lead` (six-argument hardened, Phase 5C2A) / `public.transition_lead_status` (INVOKER) → private DEFINER impls; `auth.uid()` actor; `closed_won` raises `P0001`.
- **Append-only:** touchpoints, assignment history, notes, activities protected by triggers.

## 8. Phase 5A CRM Security Contracts (Architecture Reference)

The following security requirements are **locked in architecture** and must be enforced via RLS + server authorization when CRM modules are implemented:

| Requirement | Enforcement |
| :--- | :--- |
| Sales Executive lead isolation | RLS: `assigned_to = auth.uid()` (or equivalent ownership FK) |
| Sales Manager / Super Admin visibility | RLS policy branch on role permission |
| PM project isolation | RLS: assigned PM only |
| Designer project isolation | RLS: explicit designer assignment only |
| No anonymous CRM access | `REVOKE ALL` from `anon`; server routes for public intake only |
| No service-role in browser | Server-only repositories and API routes |
| Append-only audit | Triggers forbidding UPDATE/DELETE on consent, events, target history |
| Active staff only | Existing `profiles.status = 'active'` in `private.has_permission` |
| Private import files | Non-public storage bucket; signed URLs; checksum metadata |
| Duplicate check PII scope | Server-side scoped query; never return other executive's lead rows |
| No PM/Designer access before assignment | RLS denies until assignment row exists |
| No silent assignment/state changes | All mutations via audited server actions/RPCs |
| No hard-delete of business history | Soft-archive or append-only correction pattern |
| Campaign eligibility | Consent + DNC + channel suppression check; freeze **rules** not recipient PII (ADR-0027) |
| AI isolation | No DB credentials to AI provider; structured output validation only |
| Quotation executive scope (planned Phase 7) | RLS + RPC: Sales Executive read/create/edit/finalize/send only for `leads.assigned_to = auth.uid()` |
| Quotation manager/admin scope (planned Phase 7) | Broad sales-scope finalize/send; Super Admin void/admin; **no `quotations.approve` permission** |
| Quotation PM/Designer (planned Phase 7) | Denied Phase 7 quotation mutation/send |
| Quotation send boundary (planned Phase 7B) | Phase 6B `WHATSAPP_SERVICE` controlled outbound only; DNC/consent/template gates independent of quotation domain |

**UI hiding is not authorization.** Every CRM surface must assume hostile client manipulation.

### Lead Intake (Phase 4A/4B — current)
- Public route disabled by default (`503 LEAD_INTAKE_DISABLED`).
- Service-role-only `submit_lead_intake` RPC; anon/authenticated denied on lead tables.
- Bounded request body (32 KiB); same-site origin enforcement.

## 9. Phase 6A WhatsApp Foundation Security (Managed — migration 18 applied 2026-08-07)

- **Seven WhatsApp tables:** RLS enabled on all (`whatsapp_business_accounts`, `whatsapp_phone_numbers`, `whatsapp_conversations`, `whatsapp_messages`, `whatsapp_message_status_events`, `whatsapp_webhook_events`, `whatsapp_templates`).
- **Direct client table access denied:** `REVOKE ALL` from `public`, `anon`, and `authenticated` on all seven tables.
- **Ingest RPCs:** `ingest_meta_whatsapp_message` and `ingest_meta_whatsapp_status` are `SECURITY DEFINER`, `SET search_path = ''`, owner `postgres`; `EXECUTE` granted to `service_role` only (revoked from `public`, `anon`, `authenticated`).
- **Private helpers:** `private.whatsapp_assert_hash`, `private.whatsapp_check_webhook_replay`, `private.whatsapp_upsert_waba_phone` hardened with `search_path = ''`; not exposed to browser clients.
- **Append-only audit:** `whatsapp_webhook_events` and `whatsapp_message_status_events` protected by no-update/no-delete triggers.
- **Payload minimization:** Webhook persistence uses hashed/event-key fields per M18 design — raw webhook payloads are not stored as authoritative business fields.
- **No provider secrets in DB:** Meta access tokens and app secrets remain server environment configuration only.
- **Activation boundary:** Managed schema only — no production Meta callback, outbound messaging, or n8n correctness dependency.

## 10. Phase 9A Campaign Governance Security (M31 **managed-applied 2026-08-18**)

- **Consent minimization:** Reuse append-only `consent_events` for MARKETING. No parallel marketing-consent table. No mutable current-consent truth table. Historical rows are never edited/deleted. Staff RPC `record_marketing_consent_event` is Super Admin / Sales Manager only.
- **No recipient PII snapshot** at approval. Audience artifact is a frozen rule version + hash. `broad_public` CRM PII export is **denied**. `direct_or_custom` requires current MARKETING grant; DNC and invalid/suppressed/archived target channels deny. Phase 9C rechecks before any later export/send.
- **Staff MARKETING recording:** Super Admin and Sales Manager only; `actor_type = 'staff'`; insert-only evidence; never fabricate. SE/PM/Designer denied.
- **Campaign RBAC:** `campaigns.read` / `draft` / `request_approval` / `approve` / `marketing_consents.manage`. No 9A execute/publish/schedule/pause/send. Super Admin may approve any pending version. Sales Manager **must not** approve own version at **database** authority. Legacy roles receive no automatic 9A grants. Kriti has no authoritative mutation/approval. Phase 9C adds conceptual `campaigns.execute` / `campaigns.pause` / `campaigns.metrics.read` (ADR-0031) — **not seeded in this freeze**.
- **RLS:** 100% on exposed campaign tables; direct authenticated DML denied; no browser service role; fail closed; no provider tokens in campaign rows.
- **n8n** is not consent, approval, or campaign truth.
- **Approval** has no provider side effect and creates no send intent, schedule, run, or recipient list.

## 11. Phase 9D commerce security (**architecture frozen** — **not implemented**)

Browser cart totals are never authoritative. Online payment success is webhook/server verified; webhooks are signature-checked and **idempotent**. A paid webhook **after** inventory-hold expiry must attempt a fresh stock commit or cancel the order **without overselling**; payment stays `paid` if money was received (`payment_failed` is not used for that case). Guest tracking: POST order reference + mobile; server issues a **15-minute HttpOnly signed cookie** scoped to `/shop/order`. The URL `orderReference` alone never authorizes PII; raw mobile is not placed in query/URL. Commerce SKU stock is not warehouse ERP. No MARKETING consent from purchase. Tax rates are explicit admin configuration (no architecture-seeded statutory GST percentage). See [ADR-0030](ADR/ADR-0030-phase-9d-ready-made-furniture-ecommerce-architecture.md).

## 12. Related Governance Documents

- [Supabase Data Domains](05-supabase-data-domains.md)
- [ADR-0019: Five-Role CRM Authorization](ADR/ADR-0019-five-role-crm-authorization-model.md)
- [ADR-0027: Phase 9A Campaign Consent, Audience & Approval](ADR/ADR-0027-phase-9a-campaign-consent-audience-approval.md)
- [ADR-0031: Phase 9C Campaign Execution Architecture Freeze](ADR/ADR-0031-phase-9c-campaign-execution-attribution-conversion-feedback.md)
- [ADR-0028: Phase 9D Ready-Made Furniture E-commerce](ADR/ADR-0028-phase-9d-ready-made-furniture-ecommerce.md)
- [ADR-0030: Phase 9D architecture freeze](ADR/ADR-0030-phase-9d-ready-made-furniture-ecommerce-architecture.md)
- [Phase 5A Audit](audits/phase-5a-crm-architecture-freeze.md)
- [ADR-0011: Portfolio Publication Model](ADR/ADR-0011-portfolio-publication-model.md)
- [ADR-0012: Two-Bucket Media Architecture](ADR/ADR-0012-private-originals-public-derivatives.md)
- [ADR-0013: Server-Side Portfolio Image Processing Pipeline](ADR/ADR-0013-server-side-portfolio-image-processing.md)
- [ADR-0014: Database-Controlled Portfolio Publication](ADR/ADR-0014-database-controlled-portfolio-publication.md)
- [ADR-0015: Private Definer Status Transition Helper Pattern](ADR/ADR-0015-private-definer-status-transition-helper.md)
- [Phase 2E2 Audit Report](audits/phase-2e2-portfolio-admin-cms.md)
- [Phase 2E2A Audit Report](audits/phase-2e2a-status-rpc-exposure-hardening.md)

<!-- PHASE_9B_ARCHITECTURE_FREEZE_START -->
## Phase 9B Security, Privacy & RLS Contract

- RLS required on every API-exposed M32 table.
- Landing management authority is dedicated and limited in V1 to active Super Admin / Sales Manager.
- Frozen page versions are database-immutable.
- Publication and experiment transitions are RPC/DB guarded.
- No arbitrary HTML, JavaScript, CSS injection, or `dangerouslySetInnerHTML`.
- `/lp/*` form submissions require server-verified signed publication context.
- Canonical page/publication/experiment/variant/campaign identity is never trusted from raw client fields.
- Exposure denominator stores only a server HMAC/hash visitor key plus publication/experiment/variant/timestamp data — no phone, email, IP, raw cookie ID, or unrestricted user agent.
- Public intake DNC/suppression and consent behavior remains unchanged.
- Landing forms must not fabricate MARKETING consent.
- Campaign landing pages default `noindex, nofollow`.
- Service-role credentials remain server-only.
- Production activation remains Phase 10 gated.
<!-- PHASE_9B_ARCHITECTURE_FREEZE_END -->

<!-- PHASE_9C_ARCHITECTURE_FREEZE_START -->
## Phase 9C Security, Privacy & RLS Contract

- Future run/target/event/metric/feedback tables: 100% RLS; no anon writes; no authenticated direct DML.
- Provider secrets never in campaign rows, Git, or the browser.
- Execution-time MARKETING / DNC / suppression recheck before any CRM export.
- No persistent raw PII recipient snapshot; hashed matching only when the provider requires it.
- Conversion feedback does not roll back CRM on provider rejection.
- Logs exclude tokens, raw PII, and unredacted provider payloads.
- Production live spend remains Phase 10 gated (`ONEDECORE_CAMPAIGN_EXECUTION_MODE` default disabled).
<!-- PHASE_9C_ARCHITECTURE_FREEZE_END -->
