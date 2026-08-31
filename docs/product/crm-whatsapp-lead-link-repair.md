# WhatsApp ↔ CRM Lead-Link Repair

Repairs the missing deterministic writer for `whatsapp_conversations.lead_id`.

## Why this existed

Phase 6A created `whatsapp_conversations` with a nullable `lead_id` and stated
explicitly that "Phase 6A does not auto-link CRM contacts/leads". No later phase
supplied the writer. The column was therefore always `NULL` in production
paths, and every downstream contract that keys off it was unreachable:

- `private.validate_crm_whatsapp_send_evidence` requires
  `whatsapp_conversations.lead_id = p_lead_id`, so a governed WhatsApp send
  could never be accepted as CRM activity evidence.
- `fetchGovernedWhatsappSendIntentsForLead` filters conversations by `lead_id`,
  so lead detail never offered any WhatsApp send evidence.
- `private.whatsapp_inbox_can_view_conversation` / `..._can_use_conversation`
  fall back to manage-scope-only when `lead_id IS NULL`, so an assigned sales
  executive could never reach their own customer's thread.
- Quotation WhatsApp delivery raises `CONVERSATION_LEAD_MISMATCH` unless the
  conversation is linked to the quotation's lead.

## Canonical identity

The E.164 mobile number, and nothing else.

| Domain   | Column                                          | Constraint |
| -------- | ----------------------------------------------- | ---------- |
| WhatsApp | `whatsapp_conversations.customer_e164`           | `chk_whatsapp_conversations_customer_e164` — `^\+[1-9]\d{1,14}$` |
| CRM      | `contact_channels.address_normalized` where `channel_type = 'phone'` | `chk_contact_channels_phone_e164` — same pattern |

`wa_id` → E.164 conversion already exists and is already the source of
`customer_e164`: `normalizeWaIdToE164` in `meta-webhook-contract.ts` maps the
digit-only `wa_id` to `+<digits>` and rejects anything that fails the E.164
pattern. Nothing new was introduced for the conversion.

No second normalizer was created. `private.crm_normalize_phone_e164` remains the
only normalizer and `private.resolve_lead_intake_contact_by_phone` remains the
only phone → contact identity authority; the resolver calls both.

## Matching algorithm

`private.crm_resolve_whatsapp_lead_link(p_customer_e164 text)` →
`(lead_id, contact_id, resolution_code, candidate_lead_count)`

1. Reject any identity that is not canonical E.164 → `invalid_identity`.
2. Canonicalize through `private.crm_normalize_phone_e164`.
3. Resolve phone → contact through
   `private.resolve_lead_intake_contact_by_phone` (active/suppressed channels,
   contacts not merged/archived). More than one live contact raises `P0001`
   there; the resolver maps that to `ambiguous_contact` and stops.
4. Count `public.leads` rows for that contact.
   - `0` → `no_lead_for_contact`
   - `>1` → `ambiguous_lead`
   - `1` → `linked`

Explicitly excluded: last-10-digit matching, substring or fuzzy phone matching,
name or email fallback, and any recency / assignment / status / "most likely"
heuristic. A contact may legally own several leads in ONEDECORE CRM (see
`private.crm_evaluate_manual_lead_duplicate`), so multiple candidates are an
ambiguity to be preserved, not a tie to be broken.

## Behaviour

| Situation                                     | Result |
| --------------------------------------------- | ------ |
| Exactly one candidate                          | `lead_id` set, code `linked` |
| Zero identity matches                          | `lead_id` stays `NULL`, code `no_identity_match` |
| Identity matches, contact has no lead          | `lead_id` stays `NULL`, code `no_lead_for_contact` |
| Two or more contacts on one phone              | `lead_id` stays `NULL`, code `ambiguous_contact` |
| Two or more leads on one contact               | `lead_id` stays `NULL`, code `ambiguous_lead` |
| Non-canonical / absent identity                | `lead_id` stays `NULL`, code `invalid_identity` |
| Existing link that matches the identity        | unchanged, code `existing_link_confirmed` |
| Existing link that contradicts the identity    | **unchanged**, code `existing_link_conflict` |
| Existing link on an unresolvable identity      | unchanged, code `existing_link_preserved` |

`private.crm_apply_whatsapp_conversation_lead_link(p_conversation_id uuid)` is
the single writer. It locks the conversation row, never overwrites a non-null
`lead_id`, writes only under `lead_id IS NULL`, is idempotent, and **never
raises** — an unresolved or ambiguous identity can therefore never abort inbound
ingest and drop a customer message.

The returned resolution code is the whole manual-resolution hook. No conflict
table, no conflict UI, no new status column.

## Integration points

Both entry points call the same writer; nothing else writes the column.

- **Inbound** — `public.ingest_meta_whatsapp_message`, immediately after the
  `whatsapp_conversations` upsert. Duplicate webhook deliveries short-circuit
  before this point, so replay resolves to the same conversation and the same
  link.
- **Outbound** — `private.create_whatsapp_service_send_intent_impl_v2`, the
  active governed-send authority behind both
  `public.create_whatsapp_service_send_intent` and the quotation secure-send
  wrapper. The call sits **after** the pre-existing
  `private.whatsapp_inbox_can_use_conversation` check, so linking can never
  grant a caller access they did not already hold; the conversation and its
  newly linked lead are then re-locked before eligibility evaluation.

Conversations are only ever created by the inbound webhook ingest, so there is
no third creation site to cover.

## Historical backfill

The migration runs the same writer over `whatsapp_conversations` rows where
`lead_id IS NULL`, ordered by `created_at`. It therefore inherits the identity
lock exactly: NULL rows only, exact single-candidate matches only, ambiguous and
unmatched rows stay NULL, existing links untouched. Re-running is a no-op.

## Authorization and RLS

No policy, grant or role privilege changed. Neither new function is
`SECURITY DEFINER`; both pin an empty `search_path`, are owned by `postgres`,
and are revoked from `public`, `anon` and `authenticated`. They are reached only
from inside the existing `SECURITY DEFINER` entry points.

Visibility moves only through the policies that were already written for it:
a linked conversation becomes readable/usable by the lead's assignee via
`private.whatsapp_inbox_can_view_conversation` / `..._can_use_conversation`;
an unrelated executive gains nothing; manager, management and super-admin scope
is unchanged; an unresolved conversation still exposes no CRM lead data.

## Consent and governance

Linking is an identity fact, not a permission. It records no consent event,
mutates no lead stage, creates no send intent, and fabricates no provider
message. Template rules, the service session window, DNC and the
`WHATSAPP_SERVICE` consent gate in
`private.whatsapp_evaluate_service_send_eligibility` are untouched, as is
send-intent → dispatch governance. No direct Meta send path was introduced.

## SLA and first contact

`private.validate_crm_whatsapp_send_evidence` becomes *reachable* rather than
relaxed. Every other precondition still holds: the intent must be
`dispatch_bound` with a bound outbound message, the message must carry a
provider id and timestamp, and a matching succeeded dispatch attempt must
exist. Governed WhatsApp first contact therefore flows through the existing
`whatsapp_sent` outcome gate and the existing SLA clock, with no new SLA logic.

`CrmLeadScore.signalsAvailable.whatsappLinked` stays `false`: the score pipeline
still does not read the link on either the lead-detail or pipeline-board
surface, and both surfaces must produce identical signals. Wiring it is a
separate CRM change, not part of this repair.

## Campaign compatibility

Nothing about campaigns is implemented here, and the future path needs no second
mechanism:

```
Marketing campaign → governed send intent → existing dispatch → conversation
  → customer reply → Meta webhook → ingest_meta_whatsapp_message
  → same (phone_number_id, customer_e164) conversation
  → private.crm_apply_whatsapp_conversation_lead_link → CRM lead
```

A campaign reply is an ordinary inbound webhook event. It converges on the same
conversation through the existing
`uq_whatsapp_conversations_phone_customer` unique key and on the same lead
through the single writer. A campaign that created its own lead link would be a
second authority and must not be built.

## Files

- `supabase/migrations/20260902140000_crm_whatsapp_lead_link_repair.sql`
- `supabase/tests/database/39_crm_whatsapp_lead_link_repair_test.sql`
- `src/features/crm/__tests__/crm-whatsapp-lead-link-identity.test.ts`
- `package.json` (registers the focused test)
- this document
