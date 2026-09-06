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
| `preview_campaign_audience` | A read | filtered | app suite §5 |
| `get_campaign_metrics_board` | A read | filtered | app suite §5 |
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

## Quiescence

A deleted enquiry stops generating work, without losing the record that work
happened:

- open follow-ups move to `cancelled` with `cancelled_at` / `cancelled_by`, and
  lose `is_primary_next_action` — the row stays;
- active or paused cadence enrolments move to `stopped` with
  `stop_reason = 'manual_override'` — the enrolment and its events stay;
- SLA clocks are no longer created or advanced for the lead; existing SLA
  history is untouched;
- WhatsApp conversation and message history is preserved in full. What stops is
  using the deleted enquiry as the target of a **new** lead-scoped send.

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
