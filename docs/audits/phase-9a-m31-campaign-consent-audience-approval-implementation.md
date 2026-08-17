# Phase 9A M31 — Campaign Consent, Audience & Approval Implementation

**Date:** 2026-08-17  
**Branch:** `phase-9a-m31-campaign-consent-audience-approval`  
**Base main:** `caff9d0864e1546dff38646df4355dafa851a473` (architecture PR #62 true merge; post-merge CI `32024515137` SUCCESS)  
**Architecture:** ADR-0027 / DEC-0077 / OD9A-1–OD9A-6  
**Implementation decision:** DEC-0078  
**Gate:** repository implementation only — **M31 NOT managed-applied**; **PR OPEN / NOT MERGED**; **no production activation**; **Phase 9B/9C not started**

---

## 1. Preflight

- Local HEAD at branch creation = `origin/main` = `caff9d0864e1546dff38646df4355dafa851a473`
- Divergence `0/0`; tracked tree clean; historical stash untouched
- Repository before this gate: M1–M30; M31 absent
- Managed OneDecore `lpurlfmpvriyvpkujvyl`: M1–M30; pending NONE
- CLI pin: `npx supabase@2.109.1`
- Historical Phase 9 prebuild branches were **not** used as the implementation base

## 2. Collision / live-schema audit

| Finding | Action |
|---|---|
| `contacts`, `contact_channels`, append-only `consent_events` (MARKETING already in purpose check) | Reused; no `contact_suppressions` |
| `leads` / `lead_sources` / `lead_source_touchpoints.campaign_reference` opaque | Unchanged; no 9B FK |
| M19 `whatsapp_send_intents` purpose `WHATSAPP_SERVICE` | Unchanged |
| No `campaigns` / versions / audience rule versions / approvals | Created in M31 only |
| No `campaign_runs` / recipient snapshot / landing_pages | Not created |
| No `campaigns.*` or `marketing_consents.manage` permissions | Seeded in M31; SA/SM only |
| No `/admin/campaigns` | Added staff-only routes |
| Migration-independent `src/features/marketing/**` prebuild | Reconciled to ADR-0027 four-state lifecycle |
| Phase 9 HMAC `expiresAt = 2026-08-08T10:00:00.000Z` fixture | **PREEXISTING_DATE_DEPENDENT_TEST_FIXTURE_CORRECTED** (test-only; verifier unchanged) |

## 3. M31

**File:** `supabase/migrations/20260818140000_campaign_consent_audience_approval_foundation.sql`

**Canonical Git blob:** `ea76b214e8b133b5f8cebd437f4a524916fb5bdd`

**Canonical raw SHA-256:** `F4E415901AA7243448DA87449B7E365AB121966B9E4E67A418AE1846E1981E93`

Forward-only. No M1–M30 edits. No campaign or consent business seed rows. RBAC metadata seeds only. No storage bucket. No provider tokens.

Permissions:

- `campaigns.read`
- `campaigns.draft`
- `campaigns.request_approval`
- `campaigns.approve`
- `marketing_consents.manage`

Grants: **super_admin** and **sales_manager** only. No grants to sales_executive, project_manager, designer, management, sales, project_operations, content_manager, or Kriti.

No `campaigns.execute` / `publish` / `schedule` / `pause` / `send` / `provider_manage`.

## 4. Schema

### `public.campaigns`

UUID PK. Immutable server-generated `campaign_reference` `OD-C-{YYYY}-{SEQ6}` (Asia/Kolkata year, `private.campaign_reference_seq`, gaps allowed). Name trimmed 2..160. `created_by` → profiles ON DELETE RESTRICT. No execution status.

### `public.campaign_versions`

Unique `(campaign_id, version_number)` 1..9999. Status exact: `draft` | `pending_approval` | `approved` | `rejected`. Partial unique: at most one draft or pending_approval per campaign. Optimistic `lock_version`. Opaque nullable `destination_reference` (no 9B FK). Budget/creative/window JSON snapshots. `configuration_hash` required once requested.

### `public.campaign_audience_rule_versions`

1:1 with campaign version. V1 grammar: `lead_source` / `lead_stage` / `service_interest` / `locality` × `equals` / `not_equals` / `in` / `not_in`. Bounds 1..20 rules, 1..20 values, 1..120 chars, ≤16 KiB. Canonical SHA-256 `rule_hash`. Frozen on request approval.

### `public.campaign_approvals`

Append-only. One row per version. Decisions `approved` | `rejected`. Copies configuration_hash and rule_hash. Rejection reason 8..1000 required.

### Absent (required)

`contact_suppressions`, recipient/member snapshot tables, `campaign_runs`, landing/experiment tables, provider credential tables.

## 5. Campaign reference

`private.generate_campaign_reference()` → `OD-C-{YYYY}-{SEQ6}`. Client cannot supply the authoritative reference. Immutable after insert.

## 6. Lifecycle

Canonical: `draft` → `pending_approval` → `approved` | `rejected`.

Denied: pending→draft; approved/rejected mutation; scheduled/paused/running/completed/cancelled execution states. New version via `create_next_campaign_version` after a terminal version when no draft/pending exists.

## 7. Approval self-denial

`decide_campaign_version` is database authority.

- Super Admin: any pending version.
- Sales Manager: denied if `created_by = auth.uid()` **or** `requested_by = auth.uid()` (identity shuffle denied).
- UI hides/disables SM self-approve; DB remains authority.

No provider write, run, schedule, recipient list, or WhatsApp send intent on decision.

## 8. MARKETING consent

- Source: existing `public.consent_events`.
- Current state: `private.has_current_marketing_consent` — latest MARKETING event by `occurred_at DESC, created_at DESC, id DESC`; TRUE only if `granted`.
- Staff RPC `record_marketing_consent_event`: SA/SM + `marketing_consents.manage`; `granted`/`withdrawn` only; `actor_type=staff`; `source=staff_marketing_consent`; `lead_id` NULL; public intake unchanged.
- DNC and channel suppression are **not** cleared by a grant.
- Read: `get_contact_marketing_consent_state` plus SELECT policy `consent_events_select_marketing_staff` (requires `marketing_consents.manage` + CRM view of a related lead). SE `consents.read` is **not** broadened.

## 9. Non-PII preview

`preview_campaign_audience` returns aggregates only (no IDs/PII). Label: “Current preview — eligibility will be rechecked before future execution.” Preview counts are **not** part of `configuration_hash`. `broad_public` does not export CRM members. `direct_or_custom` requires current MARKETING; DNC blocks; email/WhatsApp channel activity checked when those intended channels are present. Meta/Google matching is **not** implemented.

## 10. Idempotency / concurrency

`private.marketing_idempotency_requests` unique `(actor_id, operation, idempotency_key)`. Advisory xact lock **before** ledger lookup. Same key/hash replays; same key/different hash → `IDEMPOTENCY_KEY_REUSED`. Draft saves also require exact `lock_version` (`CAMPAIGN_DRAFT_CONFLICT`).

## 11. RLS / ACL

RLS on all four campaign tables. SELECT via `campaigns.read`. Direct authenticated INSERT/UPDATE/DELETE denied. Append-only / immutability triggers on approvals, frozen rules, submitted/terminal version content, campaign root identity fields. Public staff RPCs: authenticated EXECUTE only; anon denied. Private helpers: EXECUTE denied to PUBLIC/anon/authenticated. SECURITY DEFINER `search_path=''`.

## 12. Prebuild reconciliation

- Lifecycle: four states only; `canPublishLater` / `canBulkExecuteCampaign` removed.
- Creative: optional opaque `destinationReference`; no mandatory landing publication/page version refs.
- Capabilities: 9A governance only; `isCampaignSelfApproval` / `canApproveCampaignVersion` unambiguous; SM self-approval denied.
- HMAC tests: `expiresAt: null` for non-expiry cases; dedicated already-expired fixture. **`verifyPublicationContext` production expiry check unchanged.**

## 13. UI

- `/admin/campaigns` and `/admin/campaigns/[campaignId]` — SA/SM (`campaigns.read`); SE/PM/Designer denied.
- Admin nav Campaigns link gated on `campaigns.read`.
- CRM lead detail: `MarketingConsentPanel` for SA/SM only.
- Banner: “Approval governance only — campaign execution is not active.”
- No schedule/pause/publish/bulk execute/provider buttons.

## 14. Boundaries

- No Meta/Google provider writes
- No email send
- No WhatsApp MARKETING send intent
- No n8n campaign authority
- No Phase 9B schema/routes
- No Phase 9C execution
- No-ERP locked
- Public MARKETING capture OFF
- Public lead intake OFF

## 15. Tests / local proof

- Phase 7A 42 / Phase 7B 62
- Phase 8 P0 11 / 8A 48 / 8B 44 / 8C 49 / shell 2
- Phase 9A 51 / Phase 9B 46
- App tests 794
- DB tests 1349
- ESLint 0 errors / 11 warnings
- Typecheck PASS / build PASS
- pgTAP `23_campaign_consent_audience_approval_test.sql` plan(91)

## 16. Managed

Project `lpurlfmpvriyvpkujvyl` remains **M1–M30**. Pending **M31 only**. M31 **not** managed-applied. No managed schema/data/migration/storage write in this gate.

## 17. Blockers

None for repository implementation. Next authorized gate: `PHASE_9A_M31_RECOVERY_MANAGED_APPLY`. Do not merge this PR in this gate.
