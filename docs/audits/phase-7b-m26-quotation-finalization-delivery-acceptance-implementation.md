# ONEDECORE — Phase 7B M26 Implementation Audit + Managed Apply Certification (PR #55)

This document records the repository implementation of Phase 7B on PR #55 **and** the subsequent managed M26 apply. It does **not** authorize merge, Phase 8A, or production activation.

## Identity

| Item | Value |
| :--- | :--- |
| Branch | `phase-7b-m26-quotation-finalization-delivery-acceptance` |
| PR | #55 OPEN / DO NOT MERGE |
| Protected main (base) | `864b96776be756e0bb77b16746313e80460bd524` |
| Certified implementation head | `c354974c7b617e2e6be78983ab72280c610358e0` |
| Migration file | `supabase/migrations/20260813140000_commercial_quotation_finalization_delivery_acceptance.sql` |
| M26 Git blob SHA | `9d2370508bf6c6416205886ece4657ebb49135e4` |
| M26 raw SHA256 (LF-normalized) | `231BFA6216ABA1EBB8615E78C877F4AF7EB896C42F47A9A45A20C50A98C693C1` |
| M26 content changed during apply gate | **NO** |
| Repository migrations | M1–M27 |
| Managed project `lpurlfmpvriyvpkujvyl` | **M1–M27** |
| M26 managed-applied | **YES** |
| M27 managed-applied | **YES** |
| M28 | **ABSENT** |

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

## Explicit non-claims (still in force)

- PR #55 must remain **OPEN / not merged** until a separate merge-certification gate.
- This gate does not start Phase 8A.
- This gate does not activate production quotation send, live Meta dispatch, public intake, or production tax/max-discount seeds.
- Exact-head GitHub CI for the docs-only certification commit must be recorded on the **final pushed SHA**.

## Managed M26 apply certification (2026-08-14)

| Item | Value |
| :--- | :--- |
| Apply command | `npx supabase@2.109.1 db push --linked --yes` |
| Supabase CLI | `2.109.1` |
| APPLY_START_UTC | `2026-08-14T07:34:58.6612956Z` |
| APPLY_END_UTC | `2026-08-14T07:35:06.3394064Z` |
| Apply exit | `0` SUCCESS |
| Version applied | `20260813140000_commercial_quotation_finalization_delivery_acceptance` only |
| Pre-apply managed | M1–M25; pending M26 only; no remote drift; no M27 |
| Post-apply managed | M1–M26; pending NONE; dry-run “Remote database is up to date.” |
| Non-fatal apply note | pg-delta catalog cache warning (same class as M22/M23); `DROP IF EXISTS` notices for first-time M26 objects |

### Recovery

| Item | Value |
| :--- | :--- |
| Package | `C:\Users\KESHAV SHARMA\Desktop\ONEDECORE_RECOVERY\M26_PREAPPLY_20260814T073145Z\` |
| Mechanism | Established M25 logical dump (`db dump --linked` schema/data/roles + `supabase_migrations`) plus physical/WALG Route A |
| Qualified physical backup | ID `1365327606` (`2026-08-13T19:54:05.338Z`, COMPLETED, `is_physical_backup=true`) |
| WALG | enabled |
| PITR | disabled |
| Supplementary post-M25 backup | ID `1356076246` (`2026-08-12T19:54:29.024Z`, COMPLETED) |

`data.sql` is sensitive and remains outside the repository. Do not print PII.

### Pre/post row preservation (non-PII)

| Table | Pre | Post |
| :--- | ---: | ---: |
| quotations | 0 | 0 |
| quotation_versions | 0 | 0 |
| quotation_tax_profiles | 0 | 0 |
| whatsapp_send_intents | 0 | 0 |
| leads | 0 | 0 |
| quotation_commercial_settings | n/a (absent) | 0 |
| quotation_pdf_documents | n/a (absent) | 0 |
| quotation_access_grants | n/a (absent) | 0 |
| quotation_acceptances | n/a (absent) | 0 |

M26 did not create business quotations, send intents, tax-profile seeds, max-discount seeds, or mutate leads. Intentional metadata writes are schema/permissions/role mappings and the private `quotation-documents` bucket row (`public=false`).

### Post-apply security / RLS / privilege proof

| Control | Result |
| :--- | :--- |
| New tables present + RLS | PASS (`quotation_commercial_settings`, `quotation_pdf_documents`, `quotation_access_grants`, `quotation_acceptances`) |
| `quotations.finalize` / `quotations.send` | PASS present |
| `quotations.approve` | ABSENT |
| Staff `quotations.accept` | ABSENT |
| Grant table broad authenticated SELECT | ABSENT (RLS on, 0 policies) |
| Grant direct anon/auth DML | ABSENT |
| One-active-grant unique index | PASS `uq_quotation_access_grants_one_active_per_version` |
| Internal grant mint | PASS service_role EXECUTE yes; anon/authenticated no; 3-arg public mint absent |
| `quotation-documents` bucket | PASS exists, `public=false`, no public-read storage policy |
| PDF READY integrity constraint | PASS `chk_quotation_pdf_ready_integrity` |
| PDF READY immutability + finalized-version triggers | PASS `trg_prevent_ready_quotation_pdf_mutation`, `trg_enforce_quotation_pdf_document_invariants` |
| Authenticated PDF direct mutation | ABSENT (no INSERT/UPDATE/DELETE policies) |
| SECURITY DEFINER M26 functions | HARDENED_ALL `search_path=""`; PUBLIC EXECUTE removed on intended RPCs |
| WhatsApp secure_content_kind/ref + pair constraint + FK | PASS |
| Phase 6B inbox permissions | intact (`whatsapp.inbox.read/use/manage`) |
| `leads.status` canonical / `leads.stage` | status present; stage ABSENT |
| Production tax-profile seed from M26 | NONE |
| Production max-discount seed | NONE |

### Security advisors (read-only)

43 WARN findings total. None are ERROR. `issue_quotation_access_grant_internal` is **not** flagged (service_role only).

M26-introduced WARNs are the same class as prior managed applies: intentional client capability RPCs (`get_quotation_by_capability`, `accept_quotation_by_capability` granted to anon/authenticated), intentional authenticated staff SECURITY DEFINER RPCs, and default EXECUTE on trigger function `prevent_finalized_quotation_mutation`. **No material M26 security blocker.**

### Local post-apply regression (docs-only working tree, M26 unchanged)

| Suite | Result |
| :--- | :--- |
| `git diff --check` | PASS |
| `npm run test:phase-7a` | 42/42 |
| `npm run test:phase-7b` | 62/62 |
| `npm run test:app` | 613/613 |
| `npm run check:db` | 845/845 (pgTAP 19 = 97/97) |
| Lint | 0 errors, 11 pre-existing warnings |
| Typecheck | PASS |
| Build | PASS |

### Writes this gate

| Class | Scope |
| :--- | :--- |
| Managed schema write | M26_ONLY |
| Managed data write | INTENTIONAL_M26_METADATA_ONLY |
| Managed migration write | M26_ONLY |
| Managed storage write | QUOTATION_DOCUMENTS_BUCKET_METADATA_ONLY |
| Repository write after apply | docs-only certification |

Next step after exact-head CI on the docs certification commit: **PR #55 merge certification**. Do not merge in this gate.

## M27 forward-only trigger EXECUTE privilege repair (managed-applied)

Independent live advisor/ACL inspection after M26 managed apply found one real privilege defect:

`public.prevent_finalized_quotation_mutation()` is SECURITY DEFINER and remained directly executable by PUBLIC, anon, and authenticated.

Observed managed ACL before repair:

`{=X/postgres,postgres=X/postgres,anon=X/postgres,authenticated=X/postgres,service_role=X/postgres}`

Sibling M26 trigger helpers `prevent_ready_quotation_pdf_mutation()` and `enforce_quotation_pdf_document_invariants()` were already `{postgres=X/postgres,service_role=X/postgres}`.

M26 is immutable because it is already managed-applied. This is a tiny forward-only privilege revoke. No function body change, no trigger change, no architecture change, no OD7B decision change, no weakening of public capability read/accept or authenticated commercial RPCs.

| Item | Value |
| :--- | :--- |
| File | `supabase/migrations/20260814140000_quotation_trigger_execute_privilege_hardening.sql` |
| M27 Git blob SHA | `98305849555fb1b513dc295372cd499ad5d87a97` |
| M27 raw SHA256 (LF) | `A0A90F913C63F174F8D9CA0B9C759E246561A725D96370D07C8C83950B45F257` |
| SQL | `revoke all on function public.prevent_finalized_quotation_mutation() from public, anon, authenticated;` |
| M26 changed | **NO** |
| Pre-apply exact-head CI | SUCCESS run `31783498817` on `2e48894f444663b1bde7154ec6fd96da66368f02` |
| Recovery package | `C:\Users\KESHAV SHARMA\Desktop\ONEDECORE_RECOVERY\M27_PREAPPLY_20260814T082040Z\` |
| Apply command | `npx supabase@2.109.1 db push --linked --yes` |
| APPLY_START_UTC | `2026-08-14T08:25:21.9387124Z` |
| APPLY_END_UTC | `2026-08-14T08:25:27.4127507Z` |
| Apply exit | `0` SUCCESS |
| M27 managed-applied | **YES** |
| Post-apply managed | M1–M27; pending NONE |
| Post-apply ACL | `{postgres=X/postgres,service_role=X/postgres}` |
| PUBLIC / anon / authenticated EXECUTE | **NO / NO / NO** |
| Trigger helper advisor warnings | **REMOVED** (43 → 41 WARNs; `prevent_finalized_quotation_mutation` absent) |
| Intentional advisor WARNs remaining | `get_quotation_by_capability` and `accept_quotation_by_capability` (anon/authenticated client capability path); authenticated commercial RPCs such as `finalize_quotation_version` and `create_quotation_whatsapp_service_send_intent` |
| Row mutation by M27 | NONE (quotations/versions/leads/send-intents remain 0) |
| Phase 8A / production activation | NOT_STARTED / NONE |

Local post-apply regression: pgTAP 19 **100/100**; DB tests **848/848**; phase-7a **42/42**; phase-7b **62/62**; app **613/613**; lint 0 errors / 11 warnings; typecheck PASS; build PASS. Trigger immutability assertions remain in plan 100.
