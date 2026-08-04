# Phase 6A — Meta WhatsApp Data & Webhook Foundation Audit

**Status:** H1 corrections complete — PR gate revalidation (NOT marked phase-complete until owner merge + managed M18 apply)  
**Base SHA:** `65fb9946af1e88e267ddf7dfe847ebb18983fed8`  
**Branch:** `phase-6a-meta-whatsapp-webhook-foundation`  
**Date:** 2026-08-04 (H1 owner review corrections)

---

## Objective & exit gate

Phase 6A delivers official Meta WhatsApp Cloud API webhook foundation:

1. GET verification challenge (`hub.mode`, `hub.verify_token`, `hub.challenge`)
2. POST `X-Hub-Signature-256` on exact raw bytes (HMAC-SHA256 with App Secret)
3. Idempotent normalized Supabase persistence via service-role RPCs
4. Consent/suppression boundary preserved — no parallel consent system, no auto-consent

---

## Official Meta documentation reviewed

| Topic | URL | Reviewed |
| --- | --- | --- |
| Webhooks getting started | https://developers.facebook.com/docs/graph-api/webhooks/getting-started | 2026-08-04 |
| Verification query params | same | `hub.mode=subscribe`, `hub.verify_token`, `hub.challenge` |
| POST signature header | same | `X-Hub-Signature-256: sha256=<hex>` |
| WhatsApp Business Accounts webhooks | https://developers.facebook.com/docs/whatsapp/cloud-api/webhooks/components | 2026-08-04 |

Payload object: `whatsapp_business_account`. Logical fields: `messages`, `statuses`.

---

## Route contract

| Item | Value |
| --- | --- |
| Route | `src/app/api/webhooks/meta/whatsapp/route.ts` |
| Runtime | `nodejs`, `force-dynamic` |
| Mode env | `ONEDECORE_WHATSAPP_WEBHOOK_MODE` (`disabled` \| `local-test` \| `enabled`) |
| Default mode | `disabled` |
| Body cap | 512 KiB |

### POST gate order (implemented + tested)

1. **Mode / fail-closed** (`getMetaWebhookMode` → `getMetaWebhookServerEnv` → `assertMetaWebhookPostActive`)
2. **Content-Type** (`validateMetaWebhookJsonContentType` — `application/json` only)
3. **Bounded raw body read** (`readBoundedRawBody`, 512 KiB cap)
4. **Signature verification** (`verifyMetaWebhookSignature` on exact bytes)
5. **JSON parse**
6. **Normalize events**
7. **Service-role RPC persistence** (`handleMetaWebhookSignedBody`)

Disabled mode returns **503** before body consumption. Wrong Content-Type returns **400** before body read.

### GET responses

| Case | Status |
| --- | --- |
| Correct verify | 200 `text/plain` challenge |
| Wrong token | 403 |
| Malformed | 400 |
| Disabled | 503 |

### POST responses

| Case | Status |
| --- | --- |
| Valid persisted / duplicate / signed unsupported | 200 |
| Bad/missing signature | 401 |
| Malformed JSON | 400 |
| Oversize | 413 |
| Transient DB failure | 500 |

---

## Signature & idempotency

- HMAC-SHA256 over exact raw POST bytes; `timingSafeEqual` comparison
- `event_key`: deterministic logical provider identifier (unchanged semantics)
- `event_hash`: SHA-256 of **recursively canonicalized** normalized event JSON (sorted object keys at every nesting level; array order preserved)
- `envelope_hash`: SHA-256 of exact raw webhook body (never canonicalized)
- Same `event_key` + same `event_hash` → duplicate success
- Same `event_key` + different `event_hash` → deterministic conflict (`23505`)
- No raw body logging or persistence

---

## WABA / phone binding invariant (H1-3)

`private.whatsapp_upsert_waba_phone` enforces:

- Existing `phone_number_id` may only be reused with its existing `waba_id`
- Cross-WABA rebinding fails closed (`23505`, `webhook:conflict phone_number_id bound to different waba`)
- No partial conversation/message/webhook ledger on cross-bind failure
- Same-WABA metadata refresh remains idempotent

---

## M18 migration

| Item | Value |
| --- | --- |
| Filename | `supabase/migrations/20260804150000_meta_whatsapp_data_webhook_foundation.sql` |
| Original SHA-256 | `53A601F235E8441CED8D35E3235B1E27A377FF1FA66006C3191B954555D596D4` |
| **Corrected SHA-256** | `43AF93C6CF8CF7067A1CFFED6C1232614E2CA6A4C63C37184B0D6A8B7351F098` |
| Managed apply | **NOT APPLIED** (repository/PR only) |
| M1–M17 | Byte-for-byte unchanged |

### Tables

- `whatsapp_business_accounts`
- `whatsapp_phone_numbers`
- `whatsapp_conversations`
- `whatsapp_messages`
- `whatsapp_message_status_events` (append-only)
- `whatsapp_webhook_events` (append-only)
- `whatsapp_templates` (foundation only)

### RPCs (service_role execute only, SECURITY DEFINER, `search_path = ''`)

- `public.ingest_meta_whatsapp_message`
- `public.ingest_meta_whatsapp_status`
- Private: `private.whatsapp_assert_hash`, `private.whatsapp_check_webhook_replay`, `private.whatsapp_upsert_waba_phone`

### RLS / grants

- RLS enabled on all new public WhatsApp tables
- `REVOKE ALL` from `public`, `anon`, `authenticated`
- No anon/authenticated write paths

---

## Consent / suppression boundary

Reuses existing `contacts`, `contact_channels`, `consent_events` model.

Phase 6A inbound persistence:

- Does **not** create contacts, leads, or `contact_channels`
- Does **not** write `consent_events`
- Does **not** grant `WHATSAPP_SERVICE` or `MARKETING`
- Does **not** clear DNC or reactivate suppressed channels

Outbound eligibility deferred to Phase 6B.

---

## Application test coverage (H1-1)

Permanent `npm run test:app` includes:

- `src/features/lead-intake/__tests__/phase-5f-b-controlled-activation.test.ts` (**Phase 5F**)
- `src/features/whatsapp/__tests__/phase-6a-meta-webhook.test.ts` (**Phase 6A**)

Post-H1 exact result: **503 tests, 503 pass, 0 fail**.

---

## Explicit non-actions

- No live Meta callback registration
- No Meta access token / Graph send API
- No outbound sender
- No shared inbox UI
- No n8n automation
- No Groq
- No deployment
- Public lead intake remains inactive (`copy-only` / `disabled`)

---

## QA evidence (post-H1)

| Gate | Result |
| --- | --- |
| Local `db:reset` M1–M18 | PASS |
| pgTAP | 12 files, **526** assertions, PASS |
| DB lint | No warnings/errors |
| `npm run check` | PASS |
| `npm run test:app` | **503** tests, PASS (Phase 5F + Phase 6A suites execute) |
| Route gate order | Source-order + functional disabled/content-type/413 tests |

---

## Next steps

1. Owner PR merge authorization
2. Separate managed M18 recovery/apply gate (fresh backup/PITR required — backup `1281893546` is pre-M17 and insufficient)
3. Phase 6B: shared inbox + controlled outbound (after 6A merge + M18 apply)

**Phase 6A audit status:** H1 PR READY — not marked COMPLETE until owner merge.
