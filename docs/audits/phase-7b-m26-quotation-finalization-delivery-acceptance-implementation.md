# ONEDECORE — Phase 7B Commercial Quotation Finalization, Premium PDF, Secure WhatsApp Delivery & Client Acceptance Audit

## Executive Summary
This document provides the authoritative implementation audit for **Phase 7B PR #55 M26 Correction Gate**. Every database schema construct, server action, security definer RPC, capability token mechanism, and test assertion has been audited and certified strictly against canonical M25, CRM pipeline invariants, and locked architecture decisions OD7B-1 through OD7B-6.

---

## 1. Schema & Migration Parity Certification (M26)

### Canonical Table Structure & M25 Alignment
- **`public.permissions` & `public.roles`**: Standard system permissions `quotations.finalize` and `quotations.send` registered and linked via `public.role_permissions` to `super_admin`, `sales_manager`, `sales_executive`, `management`, and `sales`. 0 permissions granted to PM, Designer, or Kriti.
- **`private.quotation_idempotency_requests`**: Exactly aligns with M25 columns `(actor_id, operation_code, idempotency_key, request_hash, quotation_id, quotation_version_id, response_snapshot, created_at)`.
- **`public.quotation_versions`**: Extends version table with `finalized_at`, `finalized_by`, `finalized_content_sha256`, and `tax_profile_snapshot`. Uses canonical M25 snapshot and money columns (`client_name_snapshot`, `client_email_snapshot`, `client_phone_snapshot`, `property_address_snapshot`, `scope_summary`, `subtotal_paise`, `discount_type`, `discount_value_paise`, `discount_percentage`, `discount_total_paise`, `taxable_base_paise`, `tax_profile_id`, `tax_rate_percentage`, `tax_total_paise`, `grand_total_paise`, `terms_and_conditions`, `inclusions`, `exclusions`).
- **`public.quotation_tax_profiles`**: Uses canonical column `rate_percentage`.
- **`public.quotation_sections` & `public.quotation_payment_schedules`**: Joined directly to `quotation_version_id`.
- **`public.quotation_items`**: Joined via `section_id -> quotation_sections.id`.
- **`public.quotation_events`**: Canonical schema `(quotation_id, quotation_version_id, lead_id, event_type, actor_id, details, occurred_at)`.

---

## 2. Server-Authoritative Governance & Security Definer RPCs

### Finalization RPC (`public.finalize_quotation_version`)
- **Advisory Lock & Idempotency**: Locks user idempotency key using `pg_advisory_xact_lock`. Returns identical `response_snapshot` on idempotent replay. Throws `IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH` on payload mismatch.
- **RBAC & Lead Scope**: Requires `quotations.finalize`. Super Admin / Sales Manager have broad scope; Sales Executive requires active lead assignment (`v_lead.assigned_to = v_user_id`). PM, Designer, Kriti denied.
- **Recalculation & Validation**: Executes `private.recalculate_quotation_totals`. Re-verifies line items, payment schedule percentages (sum = 100.00%) or amounts (sum = grand total), and tax profile status.
- **Max Discount Enforcement**: Evaluates percentage or flat discount effective rate `(discount_total_paise * 100.0) / subtotal_paise` against `max_discount_percentage` in `public.quotation_commercial_settings`.
- **Server-Authoritative Content Hash**: Computes deterministic SHA-256 inside PostgreSQL over canonical JSON (`private.compute_canonical_quotation_sha256`).

### Client Capability Token & Access Grants
- **Token Non-Persistence**: Plaintext bearer token `/q/[token]` is NEVER saved to database tables, logs, or events.
- **`public.quotation_access_grants`**: Stores `derivation_nonce` + `capability_token_hash = sha256(token)`.
- **Timing-Safe Digest Verification**: Provider dispatch verifies token timing-safely (`crypto.timingSafeEqual`).
- **Fail-Closed Dispatch**: `dispatchWhatsappSendIntent` validates active grant, non-expired grant, finalized version status, PDF status === `'ready'` with valid SHA-256 and size > 0, and non-empty `NEXT_PUBLIC_APP_URL`.

---

## 3. CRM Closed-Won Milestone & Client Acceptance

### Private Helper `private.accepted_quotation_close_won_impl`
- **Session Config Guard**: Sets `set_config('onedecore.crm_transition', '1', true)` to bypass `trg_leads_no_direct_pipeline_update` direct UPDATE guard.
- **Lead Mutation**: Updates `public.leads.status = 'closed_won'`.
- **Audit Logging**: Inserts `public.lead_events` (`lead.status_changed`) and `public.lead_activities` (`status.changed`).

### Client Acceptance RPC (`public.accept_quotation_by_capability`)
- **Single Acceptance per Lead**: Accepts quotation and snapshots `credited_sales_executive_id` (from `leads.assigned_to`), `taxable_base_paise` (GST excluded revenue basis), and `Asia/Kolkata` sales month (`YYYY-MM`).
- **Idempotency Replay**: Re-submitting acceptance for the SAME version returns `{ success: true, idempotent_replay: true }`. Attempting acceptance on another version throws `QUOTATION_ALREADY_ACCEPTED`.

---

## 4. Pre-Acceptance Revision RPC (`public.create_quotation_revision`)
- Clones version, sections, items, and payment schedules.
- Revokes active capability grants for previous versions.
- Post-acceptance revision attempts throw `QUOTATION_ACCEPTED_IMMUTABLE`.

---

## 5. Automated Quality & Verification Matrix

| Test Suite | Result | Assertion Count |
| :--- | :--- | :--- |
| **Phase 7A Unit Tests** (`npm run test:phase-7a`) | **PASS** | 42/42 |
| **Phase 7B Unit Tests** (`npm run test:phase-7b`) | **PASS** | 47/47 |
| **Application Matrix Tests** (`npm run test:app`) | **PASS** | 598/598 |
| **Local Verification** (`npm run check`) | **PASS** | ESLint 0 errors, `tsc --noEmit` 0 errors, Next.js build clean |

---

## 6. PR #55 Mandatory Body SHA Update

The exact head SHA of branch `phase-7b-m26-quotation-finalization-delivery-acceptance` must be recorded in PR #55 body metadata upon final push.
