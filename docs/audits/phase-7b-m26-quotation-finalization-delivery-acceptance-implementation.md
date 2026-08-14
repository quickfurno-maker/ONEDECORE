# ONEDECORE — Phase 7B M26 Implementation Audit (PR #55 final A–W correction)

This document records the **repository** implementation of Phase 7B on PR #55. It is not a managed-apply certificate and does not authorize merge.

## Identity

| Item | Value |
| :--- | :--- |
| Branch | `phase-7b-m26-quotation-finalization-delivery-acceptance` |
| PR | #55 OPEN / DO NOT MERGE |
| Protected main (base) | `864b96776be756e0bb77b16746313e80460bd524` |
| Starting head (this gate) | `457a0c53a3fe2fb593652d5f3d78c66adaf1eb8b` |
| Migration file | `supabase/migrations/20260813140000_commercial_quotation_finalization_delivery_acceptance.sql` |
| M26 Git blob SHA | `9d2370508bf6c6416205886ece4657ebb49135e4` |
| M26 raw SHA256 (LF-normalized) | `231BFA6216ABA1EBB8615E78C877F4AF7EB896C42F47A9A45A20C50A98C693C1` |
| Repository migrations | M1–M26 |
| Managed project `lpurlfmpvriyvpkujvyl` | M1–M25 only |
| M26 managed-applied | **NO** |
| Managed schema/data/migration/storage writes this gate | **NONE** |

If M26 is edited again, recompute blob SHA and SHA256 before recording the final head.

## Grant authority model (A–C, W)

1. Authenticated `sendQuotationAction` resolves the real actor via `auth.getUser()`.
2. The server mints `grantId = crypto.randomUUID()` and a 32-byte hex nonce, derives HMAC-SHA256(`QUOTATION_CAPABILITY_SECRET`, `odq-capability-v1|<grantId>|<versionId>|<nonce>`), and stores `sha256(token)`.
3. Persistence is **only** through `public.issue_quotation_access_grant_internal` (SECURITY DEFINER, `search_path = ''`, **service_role EXECUTE only**). The caller-supplied `p_grant_id` is the row primary key.
4. Public `issue_quotation_access_grant(uuid,text,text)` is dropped. Authenticated callers cannot choose nonce/hash.
5. At most one active grant per `quotation_version_id` (`UNIQUE` where `revoked_at IS NULL`). Normal send reuses the active grant. Explicit reissue revokes the prior grant, appends `quotation.capability_revoked`, then issues the new id and `quotation.capability_issued`.
6. `quotation_access_grants` has RLS enabled and **no** authenticated SELECT/DML. Database may persist grant id, nonce, and token hash only. Plaintext token and `/q/<token>` are never written to grants, send intents, messages, dispatch snapshots, quotation events, or lead ledgers.

## Canonical Phase 6B send path (D–J)

- Direct service-role insert into `whatsapp_send_intents` is removed from quotation send.
- Ordinary inbox send still goes through `public.create_whatsapp_service_send_intent` → `private.create_whatsapp_service_send_intent_impl_v2` with **NULL** secure fields (previous 4-field request hash).
- Quotation send uses `public.create_quotation_whatsapp_service_send_intent` (authenticated, actor permission + OD7B-6 scope, active grant, finalized version, PDF READY, real conversation with matching `lead_id`, `whatsapp_inbox_can_use_conversation`, `whatsapp_evaluate_service_send_eligibility`).
- Purpose is exactly `WHATSAPP_SERVICE`. Persisted body is redacted. `secure_content_kind = quotation_link`, `secure_content_ref = grant id`, `requested_by = auth.uid()`, `eligibility_code` is the canonical Phase 6B code (`eligible` or deny).
- Stable idempotency: `quotation-send:<versionId>:<grantId>`.
- `quotation.send_requested` is appended in the same DB transaction with `send_intent_id`, `grant_id`, `version_number` only.
- `sendQuotationAction` uses `dispatchWhatsappSendIntent` return values. Provider-bound is **not** delivered. Only webhook evidence may say delivered/read. Missing conversation fails closed. No fake conversation or random `phone_number_id`.

## PDF immutable workflow (K–P)

- READY requires status, 64-hex SHA-256, size > 0, `ready_at`, non-empty path, bucket `quotation-documents`.
- Version must be finalized; `quotation_id` must match the version root.
- READY rows reject mutation of identity/bytes/`created_by`/`created_at`/`ready_at`.
- `ensureQuotationPdfArtifact`: authenticate via reserve RPC, skip render if already READY, render frozen PDFKit metadata, upload `upsert: false`, mark READY only after upload, `created_by` is the real actor. Upload failure does not mark READY. Binding failure after upload is `PDF_READY_BINDING_AMBIGUOUS` / recovery required.
- Byte determinism: two renders of the same frozen payload must `Buffer.equals` and share SHA-256.

## Tax resnapshot and semantic hash (T, U)

Finalization locks the selected active tax profile, writes live `rate_percentage` and exact `tax_profile_snapshot` while the version is still draft, then `recalculate_quotation_totals`, then validates money, then computes `private.compute_canonical_quotation_sha256`.

The digest binds quotation number, version number, title, client/property snapshots, scope, ordered sections/items (qty/UOM/rates/line totals), money columns, tax profile identity + rate, payment schedule mode/rows, inclusions, exclusions, and terms. Volatile send/PDF/audit fields are excluded.

## Acceptance (V)

`accept_quotation_by_capability` requires `private.crm_is_assignable_sales_user(leads.assigned_to)` before snapshotting `credited_sales_executive_id`. Unassigned, inactive, or non-sales owners fail closed. Duplicate same version is idempotent. Status becomes `closed_won`. Revenue basis is `taxable_base_paise`. Month is Asia/Kolkata. No Phase 8A project creation.

## Service-role helper and settings UI

- `src/lib/supabase/service-role.ts` fails closed if URL or `SUPABASE_SERVICE_ROLE_KEY` is missing/invalid. No dummy key. Independent of `NODE_ENV`.
- `QuotationCommercialSettingsAdmin` is mounted at `/admin/quotations/settings` (Super Admin only) for tax profile create/update/activate/deactivate and max-discount configuration. No production tax or max-discount seeds.

## Behavioral test counts (local certification)

Recorded after `supabase db reset` on this M26 file. Re-run before treating a later head as certified.

| Suite | Local result |
| :--- | :--- |
| pgTAP `19_quotation_finalization_delivery_acceptance_test.sql` | 97/97 |
| Database tests total (`npx supabase test db`) | 845/845 |
| `npm run test:phase-7a` | 42/42 |
| `npm run test:phase-7b` | 62/62 |
| `npm run test:app` | 613/613 |
| Lint | 0 errors (11 pre-existing warnings) |
| Typecheck | PASS |
| Build | PASS |

## Local security matrix (pgTAP 19 + M26 grants)

| Control | Result |
| :--- | :--- |
| `quotation_access_grants` RLS | enabled; no authenticated SELECT/DML |
| Internal grant mint | service_role EXECUTE yes; authenticated/anon/PUBLIC no |
| Quotation secure send RPC | authenticated EXECUTE yes; actor/scope inside function |
| `quotation_pdf_documents` | no authenticated DML; staff SELECT scoped |
| SECURITY DEFINER 7B functions | `search_path = ''` |
| `quotations.approve` / staff `quotations.accept` | absent |
| `quotation-documents` bucket | private; not public |
| Production tax / max-discount seed | none |

## Explicit non-claims

- Managed M26 is **not** applied.
- PR #55 must remain **OPEN / not merged**.
- This gate does not activate production quotation send or live Meta dispatch.
- Exact-head GitHub CI must be recorded on the **final pushed SHA**, not this working tree.
