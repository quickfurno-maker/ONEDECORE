# Deleting an enquiry

Super Admin only. Audit-preserving. Not legal erasure.

## Closed Lost vs Delete

These are different acts with different authorities, and they share no
permission, no code path and no wording.

| | Closed Lost | Delete enquiry |
|---|---|---|
| who | Sales Executive, Sales Manager, Super Admin | Super Admin alone |
| permission | `leads.transition` | `leads.delete` |
| what it means | the customer did not buy | this enquiry should never have been in the CRM |
| stays in reporting | yes | no |
| stays in the audit record | yes | yes |
| reversible | yes, by another transition | not in this phase |

If the customer simply did not buy, Closed Lost is the correct answer. The
delete UI says so out loud, because most people reaching for a delete button
want the lifecycle status instead.

## What deletion actually does

Nothing is physically deleted. `public.leads` gains four columns:

| column | meaning |
|---|---|
| `deleted_at` | when the tombstone was written |
| `deleted_by` | the Super Admin who wrote it |
| `delete_reason` | why, 10–500 characters, required |
| `deletion_reference` | server-generated audit handle |

They are all-or-none by check constraint: a `deleted_at` without a reason is
unrepresentable. The lead's own `status` is **preserved** — deletion is not a
lifecycle state, and `closed_lost_reason_id` / `closed_lost_note` are never
borrowed to carry it.

The columns are RPC-only. `private.forbid_direct_lead_owner_status_update`
refuses a direct write to any of them, exactly as it already refuses a direct
write to `status` or `assigned_to`.

## Authority: the double lock

`public.delete_lead_tombstone` requires **both**:

1. `public.authorize('leads.delete')`, and
2. the canonical `super_admin` role.

The role check is not redundant. If a future migration grants `leads.delete` to
another role by accident, that role still gets nothing — and
`50_crm_super_admin_lead_tombstone_test.sql` proves it by making exactly that
mistake on purpose and showing the call still fails.

`admin.access`, `leads.manage` and `leads.transition` are never substitutes. The
test suite holds a Sales Manager who genuinely has all three and is refused.

## What cannot be deleted

An enquiry is refused if any of these is true:

- `status = 'closed_won'`
- any row in `public.quotations` for the lead
- any row in `public.quotation_acceptances` for the lead
- any row in `public.projects` for the lead

Error: `CRM_LEAD_DELETE_CONVERTED_BLOCKED`.

Deliberately conservative. It is also doing real containment work: because a
lead with a quotation can never be deleted, most of the quotation and project
SECURITY DEFINER functions can never encounter a tombstone at all.

## Concurrency

### Against the first quotation

`create_quotation_draft` decides whether a lead may take a quotation *before* it
acquires the `quotation_root` advisory lock, so without a shared serialization
point it could interleave with a delete: the quotation path passes its check,
the delete commits, and the quotation is then written against a lead that is
already a tombstone — the converted blocker satisfied on both sides and violated
in the result.

Both paths now take `pg_advisory_xact_lock('quotation_root:' || lead_id)`
**first** and the lead row **second**, in that order, and the quotation path
re-reads the lead `FOR UPDATE` with `deleted_at is null` *after* the lock. The
loser of either ordering is refused: the quotation with
`QUOTATION_NOT_FOUND_OR_FORBIDDEN`, the delete with
`CRM_LEAD_DELETE_CONVERTED_BLOCKED`.

`51_crm_lead_delete_quotation_race_test.sql` proves this with two real sessions.

### Against ordinary edits

The caller passes the `updated_at` they were looking at. The row is locked
`FOR UPDATE` while it is checked. If the enquiry moved in the meantime the
delete is refused (`CRM_LEAD_DELETE_STALE`) rather than applied to a lead the
owner has not actually read. The confirmation string `DELETE` is checked
server-side, so a UI that forgets to ask is still refused.

## Operational visibility

The `leads` SELECT policy is `deleted_at is null and <existing CRM predicate>`.
There is deliberately **no** "Super Admin can see deleted" branch: this phase
has no recycle bin, and a branch nobody uses is a branch that gets trusted later
without being re-read.

Every CRM read model queries `leads` through the authenticated client, so the
list, search, pipeline, My Day, calendar, dashboard, reports, analytics and the
mobile read routes all inherit the filter from that one policy rather than
re-implementing it. A tombstoned enquiry opened by direct URL is not found.

## SECURITY DEFINER containment

RLS is not enough on its own: a definer function bypasses the caller's RLS. At
this head **52** SECURITY DEFINER functions reference `public.leads`.

Twenty-one of them resolve through the central CRM predicates, so hardening
those four closes them together:

- `private.crm_can_view_lead_by_id`
- `private.crm_can_mutate_lead`
- `private.crm_user_can_operate_lead`
- `private.crm_can_view_contact`

Each re-created body differs from its original by one local substitution:

```sql
from public.leads l
-- becomes
from (select * from public.leads where deleted_at is null) l
```

Every `l.<column>` reference keeps working and no surrounding logic can be
disturbed, which is what makes each body reviewable by diffing it against the
migration named in the comment above it.

### Review table

| function | category | action | proved by |
|---|---|---|---|
| `crm_can_view_lead_by_id` | A read | filtered | tombstone suite §G |
| `crm_can_mutate_lead` | B mutate | filtered | tombstone suite §G |
| `crm_user_can_operate_lead` | B mutate | filtered | tombstone suite §G |
| `crm_can_view_contact` | A read | filtered | app suite §5 |
| `crm_lead_deal_values` | A read | filtered | app suite §5 |
| `crm_evaluate_manual_lead_duplicate` | C duplicate | filtered | tombstone suite §H |
| `ensure_first_contact_sla_clock` | B mutate | filtered | app suite §5 |
| `ensure_sla_first_contact_primary` | B mutate | filtered | app suite §5 |
| `whatsapp_evaluate_service_send_eligibility` | B mutate | filtered | app suite §5 |
| `whatsapp_inbox_can_use_conversation` | B mutate | filtered | app suite §5 |
| `whatsapp_inbox_actor_can_use_conversation` | B mutate | filtered | app suite §5 |
| `create_quotation_draft` | B mutate | filtered | tombstone suite §G |
| `preview_campaign_audience` | A read | filtered — a deleted enquiry is not a marketing target | app suite §5 |
| `get_campaign_metrics_board` | A read / D audit | **partially** filtered — see below | app suite §5 |
| 21 callers of the central predicates | A/B | closed transitively | tombstone suite §G |
| `whatsapp_inbox_can_view_conversation` | D audit | unchanged — conversation history stays readable; **using** it is closed above | — |
| `create_quotation_revision`, `finalize_quotation_version`, `accept_quotation_by_capability`, `get_quotation_by_capability`, `issue_quotation_access_grant_internal`, `mark_quotation_pdf_document_ready`, `reserve_quotation_pdf_document`, `revoke_quotation_access_grant`, `create_quotation_whatsapp_service_send_intent` | D audit | unreachable — each needs an existing quotation, and a lead with one cannot be deleted | converted blocker |
| `materialize_closed_won_project_impl`, `accepted_quotation_close_won_impl`, `trg_quotation_acceptance_commercial_conversion`, `project_high_level_status_row`, `project_design_whatsapp_belongs_to_project`, `project_execution_whatsapp_belongs_to_project` | D audit | unreachable — each needs an acceptance or a project | converted blocker |
| `trg_leads_after_insert_sla_receipt`, `trg_leads_before_insert_source_enrichment`, `trg_leads_after_insert_touchpoint` | D audit | unreachable — INSERT triggers; a tombstone is an UPDATE | — |
| `trg_leads_campaign_conversion_feedback` | D audit | unreachable — fires on `update of status`, and deletion does not change status | — |
| `create_manual_lead_impl`, `crm_create_imported_lead`, `crm_import_process_row`, `submit_lead_intake` | C create | no change needed — they INSERT and resolve duplicates through the evaluator above | tombstone suite §H |

**Category D is not "skipped".** Each row states the reason a *deletable* lead
cannot reach that function. If the converted blocker is ever relaxed, every
Category D entry has to be re-audited, and this table is where to start.

### Campaign metrics: what is filtered and what is not

`get_campaign_metrics_board` has two kinds of number in it, and they are treated
differently on purpose.

- The **lead-derived** counts read `public.leads` and now read the filtered set,
  so a deleted enquiry stops counting as an active lead.
- The **conversion-feedback** counts read `campaign_conversion_feedback_events`
  directly. Those rows are immutable campaign evidence: they record that a
  campaign produced a conversion at a point in time. They are **retained
  deliberately** and are not filtered by the tombstone.

So: operational audience and active-lead metrics exclude deleted enquiries;
historical campaign attribution does not disappear because an enquiry was later
removed from the CRM workspace. Do not read this feature as "every campaign
conversion count drops when a lead is deleted" — it does not, and that is the
intended behaviour for an audit-preserving tombstone.

## Quiescence

A deleted enquiry stops generating work, without losing the record that work
happened:

Quiescence runs through the **canonical lifecycle paths**, not by writing the
child lifecycle columns directly, because those paths are where the evidence is
written. It happens *before* the tombstone, while the lead is still operational:
`cancel_lead_follow_up_impl` resolves through `crm_can_view_lead_by_id`, which
refuses a tombstoned lead.

- open follow-ups are cancelled through `private.cancel_lead_follow_up_impl`,
  which sets `cancelled_at` / `cancelled_by`, clears `is_primary_next_action`,
  and appends the `cancelled` follow-up event, the `primary_cleared` event when
  the follow-up was someone's next action, and the `follow_up.cancelled`
  activity — the row stays;
- active or paused cadence enrolments are stopped through
  `private.stop_lead_cadence_for_system` with `stop_reason = 'lead_deleted'`,
  which appends the `auto_stopped` enrolment event and the `cadence.stopped`
  activity. `lead_deleted` is a new value on that constraint: `manual_override`
  would have told a later reader the wrong story;
- SLA clocks are no longer created or advanced for the lead; existing SLA
  history is untouched;
- WhatsApp conversation and message history is preserved in full and stays
  **readable**. What stops is every **use / send / dispatch** path: a
  lead-scoped conversation requires its linked lead to still be operational
  before any of them proceeds.

  Both inbox predicates take that as a prerequisite ahead of every role branch,
  so `whatsapp.inbox.manage` is a wider audience rather than a way past a
  deleted enquiry, and the named-actor form the provider dispatch uses answers
  the same way — a send intent created before the deletion cannot be dispatched
  after it. Send eligibility checks the lead **before** it resolves the contact,
  so a conversation that already carries a `contact_id` cannot bypass the check
  either; it returns `denied_lead_deleted`.

## Duplicate and re-entry

A tombstone must never lock a customer out. The duplicate evaluator reads the
filtered lead set, so a deleted enquiry is not an `ACTIVE_DUPLICATE` and not a
`RECENT_SIMILAR`. The same person can enquire again the next day and get a fresh
lead on the same contact.

Consent and DNC live on the **contact**, are untouched by deletion, and remain
authoritative.

## Audit

Exactly one `lead.deleted` event per lead, append-only, carrying
`deletionReference`, `reason`, `previousStatus`, `previousAssignee`,
`expectedUpdatedAt` and `version: lead_delete_v1`. A second delete attempt
returns `CRM_LEAD_ALREADY_DELETED` and writes nothing.

The contact, its channels, consent history, notes, activities, assignment
history, import and intake provenance, campaign attribution and WhatsApp
messages all survive. The tombstone suite reads every one of them back **after**
the delete, as `postgres`, and finds them.

## Error contract

| code | shown to the user |
|---|---|
| `CRM_LEAD_DELETE_AUTH_REQUIRED` | Sign in to continue. |
| `CRM_LEAD_DELETE_PERMISSION_DENIED` | You are not allowed to delete enquiries. |
| `CRM_LEAD_DELETE_SUPER_ADMIN_REQUIRED` | (same message — the distinction is for logs, not the caller) |
| `CRM_LEAD_DELETE_INVALID_INPUT` | Reload the enquiry and try again. |
| `CRM_LEAD_DELETE_CONFIRMATION_REQUIRED` | Type DELETE exactly to confirm. |
| `CRM_LEAD_DELETE_REASON_INVALID` | Give a reason between 10 and 500 characters. |
| `CRM_LEAD_DELETE_NOT_FOUND` | This enquiry is no longer available. |
| `CRM_LEAD_DELETE_STALE` | This enquiry changed while you were reading it. Reload and check it again before deleting. |
| `CRM_LEAD_DELETE_CONVERTED_BLOCKED` | This enquiry has quotation or project history and cannot be deleted… |
| `CRM_LEAD_ALREADY_DELETED` | This enquiry has already been deleted. |

No table name, policy name, SQL fragment or grant ever reaches the browser.

## Privacy and legal semantics

This is an **operational** tombstone. It is not GDPR erasure and must not be
described as one. Consent evidence, contact identity, communication audit,
quotation and project history and campaign attribution are all retained
deliberately.

The UI says: *"This removes the enquiry from normal CRM workspaces while
preserving the audit record."*

## Not in this phase

- no bulk delete
- no restore / undelete
- no mobile delete endpoint (mobile **reads** do respect the tombstone)
- no recycle bin, and therefore no Super Admin branch in the lead SELECT policy

## Rollout

The migration is forward-only and has not been applied to managed Supabase. It
must be reviewed before it is applied. Applying it is a schema change plus a
policy change on `public.leads`; there is no data backfill, because every
existing lead is active by definition.
