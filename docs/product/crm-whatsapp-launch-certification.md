# ONEDECORE — CRM + WhatsApp Launch Certification

Final pre-production certification and activation checklist for the ONEDECORE
CRM (2A–2E) + WhatsApp operational path.

- **Branch:** `crm-whatsapp-launch-certification`
- **Certified baseline:** `d48c22698b05beb034264d1b9933a5dc93678c2b`
- **Classification:** `READY_AFTER_LISTED_CONFIGURATION`
- **Scope:** ONEDECORE only. No campaign orchestration, no AI/ML/LLM.

No secret value appears in this document. Every credential is a placeholder.

---

## 1. What is certified

| Launch requirement | Status | Evidence |
| --- | --- | --- |
| CRM 2A–2E is one coherent sales system | Certified | `test:crm-2a-2e`, DB tests 31–38, CRM 2E owner QA 30/30 |
| One canonical WhatsApp identity → one lead, deterministically | Certified | `private.crm_resolve_whatsapp_lead_link`, DB test 39, certification S1 |
| Authorized sales staff see/use the correct conversation | Certified | certification S3 |
| Unauthorized staff gain no conversation or lead access | Certified | certification S2, S3, S4 |
| Send intent governed by consent / session / template rules | Certified | `private.whatsapp_evaluate_service_send_eligibility`, certification S4 |
| Dispatch uses the existing provider boundary only | Certified | single Graph call site in `whatsapp-meta-provider-adapter.ts` |
| Inbound events authenticated, normalized, idempotent, persisted | Certified | certification S1 (real HMAC through the real route) |
| sent/delivered/read/failed status processing coherent | Certified | certification S4 |
| WhatsApp first-response SLA evidence is governed-only | Certified | `private.validate_crm_whatsapp_send_evidence`, certification S5 |
| Timeline/reporting invents no WhatsApp evidence | Certified | certification S7 |
| Quotation / cadence / linkage / inbox do not contradict | Certified | certification S6, S7 |
| Activation is a checklist, not architecture | Certified | this document, §5–§9 |

The certification harness is `scripts/crm-whatsapp-launch-certification-e2e.ts`
(`npm run qa:crm-whatsapp-launch-certification`). It drives the **real** route
handler, a **real** `X-Hub-Signature-256` HMAC over exact raw bytes, the real
service-role admin client, the real send-intent authority and the real SLA
evidence validator against a freshly reset local Supabase. 50/50 checks pass.

---

## 2. Deliberate operational limits at launch

These are design decisions, not defects. Operations must know them before go-live.

1. **Template sending is not implemented.** Outside the 24-hour service window
   `private.whatsapp_evaluate_service_window_at_dispatch` sets
   `template_required` and dispatch is refused with `denied_template_required`.
   Re-engagement outside the window is therefore not possible from ONEDECORE
   until a template path is built. This fails closed, which is correct.
2. **The first-response SLA is inert until its policy is activated.** Until the
   `first_contact` row in `public.crm_sla_policies` is active with business
   hours, an effective-from instant, a valid timezone and a valid hours config,
   every `crm_sla_clocks.sla_due_at` stays `NULL` — SLA compliance reports as
   "no policy", never as a false pass or a false breach. See §5.4.
3. **Ambiguous identities stay unlinked, permanently, until a human resolves
   them.** When one canonical phone maps to more than one live lead, the
   conversation is visible only to manage scope (super admin / sales manager /
   management). There is no in-product manual link action; resolution today is
   merging or closing the duplicate leads. Expect a small unlinked queue.
4. **`CrmLeadScore.signalsAvailable.whatsappLinked` is hard-coded `false`.** It
   is an honest-disclosure field only, is not user-visible, and never feeds the
   score. It under-reports rather than inventing signal, so it is not a launch
   blocker; it is now stale and should be derived in a later change.

---

## 3. Managed Supabase migration status

Repository migrations: **48**, ordered, no duplicate version prefixes, no drift.
Managed project `lpurlfmpvriyvpkujvyl` (ONEDECORE, ap-south-1) has **44**
applied, in identical order with identical names.

**Exactly 4 migrations are pending on managed Supabase:**

| Version | Name |
| --- | --- |
| `20260830140000` | `crm_cadence_playbook_foundation` |
| `20260831140000` | `crm_lead_commercial_read_models` |
| `20260901140000` | `crm_management_analytics_read_model` |
| `20260902140000` | `crm_whatsapp_lead_link_repair` |

`20260902140000` contains the historical backfill that links existing
conversations. It reuses the single writer, so it inherits the identity lock:
only `lead_id IS NULL` rows are considered, only an exact single-candidate match
is written, and no existing link can be overwritten. It is idempotent.

Verified read-only. **No managed migration was applied during certification.**

---

## 4. Production environment contract

Never expose any of these to the client bundle except `NEXT_PUBLIC_*`.

### 4.1 Inbound webhook — code-complete, deployment configuration only

| Variable | Value at launch | Notes |
| --- | --- | --- |
| `ONEDECORE_WHATSAPP_WEBHOOK_MODE` | `enabled` | `local-test` is force-disabled when `NODE_ENV=production` |
| `NEXT_PUBLIC_SUPABASE_URL` | `https://<managed-onedecore-ref>.supabase.co` | `enabled` mode rejects any host but the managed ONEDECORE project |
| `SUPABASE_SERVICE_ROLE_KEY` | `<service-role-key>` | server-only; a `sb_publishable_*` key or a value equal to the publishable key is rejected |
| `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN` | `<verify-token>` | 8–256 chars, required in `enabled` |
| `META_WHATSAPP_APP_SECRET` | `<meta-app-secret>` | 16–256 chars, required in `enabled` |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` | `<publishable-key>` | already set; used as a negative check on the service-role slot |

### 4.2 Outbound provider dispatch — code-complete, deployment configuration only

| Variable | Value at launch | Notes |
| --- | --- | --- |
| `ONEDECORE_WHATSAPP_OUTBOUND_MODE` | `enabled` | `disabled` is the dispatch kill switch |
| `META_WHATSAPP_ACCESS_TOKEN` | `<system-user-token>` | ≥16 chars, required in `enabled` |
| `META_WHATSAPP_PHONE_NUMBER_ID` | `<phone-number-id>` | digits only, required in `enabled` |
| `META_WHATSAPP_GRAPH_API_VERSION` | optional | defaults to `v22.0` |

`NEXT_PUBLIC_SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are shared with §4.1
and are validated identically by the outbound env module.

### 4.3 Quotation secure delivery

| Variable | Value at launch | Notes |
| --- | --- | --- |
| `NEXT_PUBLIC_APP_URL` | `https://<production-host>` | dispatch fails closed with `MISSING_APP_URL` if absent or non-http(s) |

### 4.4 Missing code

None. Every variable above is already read, validated fail-closed and covered by
tests. Nothing in §4 requires new code.

---

## 5. Activation checklist

### 5.1 Managed Supabase

- [ ] Take a managed database backup / restore checkpoint before any apply.
- [ ] Confirm remote migration status still ends at `20260829140000`.
- [ ] Apply **only** the four migrations listed in §3, in version order.
- [ ] Re-verify after apply: `private.crm_resolve_whatsapp_lead_link` and
      `private.crm_apply_whatsapp_conversation_lead_link` exist and are owned by
      `postgres`; `public.ingest_meta_whatsapp_message` executes as
      `service_role` only; RLS remains enabled on `whatsapp_conversations`,
      `whatsapp_messages`, `whatsapp_send_intents`, `crm_sla_clocks`.
- [ ] Confirm no service-role widening: `crm_sla_clocks` grants `SELECT` to
      `authenticated` and nothing to `service_role`; the quotation tables grant
      `service_role` no `SELECT`/`INSERT`.
- [ ] Spot-check the backfill result: every non-null `whatsapp_conversations.lead_id`
      still equals `private.crm_resolve_whatsapp_lead_link(customer_e164)`.

### 5.2 Application environment

- [ ] Set every variable in §4.1, §4.2 and §4.3 on the production deployment.
- [ ] Confirm `SUPABASE_SERVICE_ROLE_KEY`, `META_WHATSAPP_APP_SECRET`,
      `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN` and `META_WHATSAPP_ACCESS_TOKEN` are
      server-only and absent from the client bundle.
- [ ] Confirm `NEXT_PUBLIC_SUPABASE_URL` points at the managed ONEDECORE project.
- [ ] Deploy with `ONEDECORE_WHATSAPP_WEBHOOK_MODE=disabled` and
      `ONEDECORE_WHATSAPP_OUTBOUND_MODE=disabled` first, then flip to `enabled`
      once §5.3 is complete.

### 5.3 Meta Developer / WhatsApp Manager

- [ ] Confirm the production WABA and phone number identity are the ones ONEDECORE
      will send from, and that `META_WHATSAPP_PHONE_NUMBER_ID` matches.
- [ ] Set the webhook callback URL to
      `https://<production-host>/api/webhooks/meta/whatsapp`.
- [ ] Set the verify token to the same value as
      `META_WHATSAPP_WEBHOOK_VERIFY_TOKEN`.
- [ ] Subscribe the app to the **`messages`** webhook field on the production WABA.
- [ ] Confirm app-secret payload signing is on so `X-Hub-Signature-256` arrives;
      unsigned and mis-signed requests are rejected `401`.
- [ ] Confirm the system-user access token carries `whatsapp_business_messaging`
      and `whatsapp_business_management`, and note its expiry.

### 5.4 CRM policy activation (required for SLA reporting)

**Verified on managed production during this certification (read-only):** the
`first_contact` policy row exists with `is_active = false`,
`business_hours_enabled = false`, `effective_from = null`,
`timezone = 'Asia/Kolkata'`, `target_business_minutes = 60`. First-response SLA
is therefore **inert in production today** and will stay inert after activation
of WhatsApp until this policy is turned on. This is the single item that holds
the launch classification at `READY_AFTER_LISTED_CONFIGURATION` rather than
`READY_FOR_PRODUCTION_ACTIVATION`.

- [ ] Activate the `first_contact` SLA policy: set `is_active`,
      `business_hours_enabled`, an `effective_from` instant, and a valid
      business-hours config (timezone and target minutes are already set).
      Until then all SLA dues stay `NULL` by design (see §2.2).
- [ ] Configure the month's sales targets through `public.create_sales_target`.
      No migration seeds a production target.

### 5.5 Operational templates

At launch ONEDECORE sends **no** template messages: only in-session
(`service_window_text`) messages are dispatchable, so **no approved template is
required to go live**. If re-engagement outside the 24-hour window is wanted,
that needs a template send path first — it is not in this branch.

### 5.6 Post-deployment smoke tests

- [ ] Meta webhook verification handshake succeeds (challenge echoed).
- [ ] Inbound text from a controlled number returns `200`.
- [ ] The conversation row is created.
- [ ] The conversation is linked to the correct lead deterministically.
- [ ] The assigned sales executive sees it in the inbox.
- [ ] A different sales executive does not see it.
- [ ] A governed in-session service message sends and binds a provider id.
- [ ] A send attempted after 24 hours of silence is refused
      (`denied_template_required`), not silently dropped.
- [ ] `delivered` then `read` statuses land on that outbound message.
- [ ] Quotation secure send delivers on the lead's own linked conversation.
- [ ] Completing a WhatsApp activity with that send intent records the
      first-contact SLA attempt at the provider timestamp.
- [ ] A `do_not_contact` contact is refused (`denied_dnc`).

### 5.7 Rollback / kill switches

- [ ] **Inbound stop:** `ONEDECORE_WHATSAPP_WEBHOOK_MODE=disabled` → `GET` and
      `POST` both return `503` before any database call. Meta will retry, so
      inbound evidence is recoverable rather than lost.
- [ ] **Outbound stop:** `ONEDECORE_WHATSAPP_OUTBOUND_MODE=disabled` → send
      intents are still recorded and governed, but no provider call is made.
      This is the safe partial stop: CRM keeps working, Meta traffic ceases.
- [ ] **Never delete history to roll back.** Conversations, messages, send
      intents, dispatch attempts and webhook events are the evidence chain the
      SLA and quotation paths depend on. Roll back with the mode switches.
- [ ] Meta-side stop of last resort: unsubscribe the `messages` field on the WABA.

---

## 6. Certification commands

```
npm ci
npm run db:reset
npm run db:lint && npm run db:test
npm run test:app
npm run lint && npm run typecheck && npm run build
PHASE_5C1_QA_PASSWORD='<local-only>' npm run qa:crm-whatsapp-launch-certification
PHASE_5C1_QA_PASSWORD='<local-only>' npm run qa:crm-whatsapp-lead-link
PHASE_5C1_QA_PASSWORD='<local-only>' node scripts/crm-2b-owner-qa.mjs
PHASE_5C1_QA_PASSWORD='<local-only>' node scripts/crm-2e-owner-qa.mjs
```
