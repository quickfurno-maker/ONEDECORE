-- ONEDECORE — Super Admin enquiry deletion, proved against the real database.
--
-- THE TWO CLAIMS THIS SUITE HAS TO SETTLE
--
-- 1. Only the owner can delete, and no near-miss authority substitutes for it.
--    `admin.access`, `leads.manage` and `leads.transition` are each tried
--    explicitly, and so is a fixture that has been handed `leads.delete` by
--    mistake without being super_admin — because that is the accident the
--    double lock exists for.
--
-- 2. Nothing is actually destroyed. The lead row, the contact, the consent
--    evidence, the notes and the history are all read back AFTER the delete,
--    as postgres, and are still there.
--
-- CLOSED LOST IS NOT DELETE, and the two never share a code path.

begin;
select plan(86);

-- =============================================================================
-- Fixtures — e-prefix, unique to this file
-- =============================================================================

insert into auth.users (id, instance_id, email, aud, role) values
  ('e1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', '50-sa@example.test', 'authenticated', 'authenticated'),
  ('e2222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', '50-mgr@example.test', 'authenticated', 'authenticated'),
  ('e3333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', '50-exec@example.test', 'authenticated', 'authenticated'),
  ('e4444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', '50-pm@example.test', 'authenticated', 'authenticated'),
  ('e5555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', '50-sa-inactive@example.test', 'authenticated', 'authenticated');

update public.profiles set status = 'active'
where id in (
  'e1111111-1111-1111-1111-111111111111',
  'e2222222-2222-2222-2222-222222222222',
  'e3333333-3333-3333-3333-333333333333',
  'e4444444-4444-4444-4444-444444444444',
  'e5555555-5555-5555-5555-555555555555'
);

insert into public.user_roles (user_id, role_id)
select 'e1111111-1111-1111-1111-111111111111', id from public.roles where code = 'super_admin';
insert into public.user_roles (user_id, role_id)
select 'e2222222-2222-2222-2222-222222222222', id from public.roles where code = 'sales_manager';
insert into public.user_roles (user_id, role_id)
select 'e3333333-3333-3333-3333-333333333333', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select 'e4444444-4444-4444-4444-444444444444', id from public.roles where code = 'project_manager';
insert into public.user_roles (user_id, role_id)
select 'e5555555-5555-5555-5555-555555555555', id from public.roles where code = 'super_admin';

-- A Super Admin whose employment is suspended: a valid JWT, no authority.
update public.profiles set status = 'suspended'
where id = 'e5555555-5555-5555-5555-555555555555';

insert into public.contacts (id, display_name, status)
values ('e0c00000-0000-4000-8000-000000000001', 'Tombstone Client', 'active')
on conflict (id) do nothing;

insert into public.contact_channels (contact_id, channel_type, address_normalized, is_primary)
values
  ('e0c00000-0000-4000-8000-000000000001', 'phone', '+919700000050', true),
  ('e0c00000-0000-4000-8000-000000000001', 'email', 'tombstone50@example.com', true)
on conflict do nothing;

-- A SEPARATE contact for the converted enquiry. Sharing one with the deletable
-- enquiry would make the re-entry test meaningless: the returning customer
-- would have a genuinely active second lead, and ACTIVE_DUPLICATE would be the
-- right answer for a reason that has nothing to do with the tombstone.
insert into public.contacts (id, display_name, status)
values ('e0c00000-0000-4000-8000-000000000002', 'Converted Client', 'active')
on conflict (id) do nothing;

insert into public.contact_channels (contact_id, channel_type, address_normalized, is_primary)
values ('e0c00000-0000-4000-8000-000000000002', 'phone', '+919700000051', true)
on conflict do nothing;

-- The deletable enquiry: assigned, worked a little, no commercial record.
insert into public.leads (
  id, submission_reference, contact_id, submitted_name, submitted_email, status, source,
  primary_source_id, entry_method, service_code, property_code, timeline_code,
  planner_version, landing_path, assigned_to
) values (
  'e0aaaaaa-0000-4000-8000-000000000001',
  'e0aaaaaa-0000-4000-8000-000000000001',
  'e0c00000-0000-4000-8000-000000000001',
  'Tombstone Client',
  'tombstone50@example.com',
  'assigned',
  'website-planner',
  (select id from public.lead_sources where code = 'website_planner'),
  'public_intake',
  'complete-home-interiors',
  'apartment-3bhk',
  'immediate',
  'v1',
  '/planner',
  'e3333333-3333-3333-3333-333333333333'
);

-- History that must survive the delete.
--
-- `trg_lead_notes_set_creator` resolves the author from auth.uid(), so the
-- fixture has to say who it is even though it runs as the test owner.
select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);

insert into public.lead_notes (lead_id, created_by, body)
values (
  'e0aaaaaa-0000-4000-8000-000000000001',
  'e1111111-1111-1111-1111-111111111111',
  'A note written before the enquiry was deleted.'
);

insert into public.lead_follow_ups (
  lead_id, owner_id, due_at, status, created_by, is_primary_next_action
)
values (
  'e0aaaaaa-0000-4000-8000-000000000001',
  'e3333333-3333-3333-3333-333333333333',
  now() + interval '2 days',
  'open',
  'e1111111-1111-1111-1111-111111111111',
  -- Primary, so the delete has to produce a `primary_cleared` event too.
  true
);

-- An active cadence enrolment, so the delete has to stop it through the
-- canonical system path and leave the evidence that path writes.
insert into public.crm_cadence_templates (
  id, name, description, status, created_by, published_at, published_by
)
values (
  'e0dddddd-0000-4000-8000-000000000001',
  'Tombstone Probe Cadence',
  'Fixture cadence for the deletion suite.',
  'published',
  'e1111111-1111-1111-1111-111111111111',
  now(),
  'e1111111-1111-1111-1111-111111111111'
)
on conflict (id) do nothing;

insert into public.crm_lead_cadence_enrollments (
  id, lead_id, template_id, status, enrolled_by
)
values (
  'e0eeeeee-0000-4000-8000-000000000001',
  'e0aaaaaa-0000-4000-8000-000000000001',
  'e0dddddd-0000-4000-8000-000000000001',
  'active',
  'e1111111-1111-1111-1111-111111111111'
);

-- A lead-linked WhatsApp conversation. `contact_id` is populated ON PURPOSE:
-- the first version of the eligibility filter only consulted the lead when the
-- contact was missing, so this is the shape that stayed eligible after a delete.
insert into public.whatsapp_business_accounts (id, waba_id, status)
values ('e0fabbbb-0000-4000-8000-000000000001', '900000000000050', 'active')
on conflict (id) do nothing;

insert into public.whatsapp_phone_numbers (
  id, business_account_id, phone_number_id, display_phone_number, status
)
values (
  'e0fa1111-0000-4000-8000-000000000001'::uuid,
  'e0fabbbb-0000-4000-8000-000000000001',
  '900000000000051',
  '+919700000099',
  'active'
)
on conflict (id) do nothing;

insert into public.whatsapp_conversations (
  id, phone_number_id, customer_e164, contact_id, lead_id, last_inbound_at
)
values (
  'e0fbcccc-0000-4000-8000-000000000001',
  'e0fa1111-0000-4000-8000-000000000001'::uuid,
  '+919700000050',
  'e0c00000-0000-4000-8000-000000000001',
  'e0aaaaaa-0000-4000-8000-000000000001',
  now() - interval '1 hour'
);

-- A second enquiry that reached a quotation: never deletable.
insert into public.leads (
  id, submission_reference, contact_id, submitted_name, status, source,
  primary_source_id, entry_method, service_code, property_code, timeline_code,
  planner_version, landing_path
) values (
  'e0bbbbbb-0000-4000-8000-000000000002',
  'e0bbbbbb-0000-4000-8000-000000000002',
  'e0c00000-0000-4000-8000-000000000002',
  'Converted Client',
  'new',
  'website-planner',
  (select id from public.lead_sources where code = 'website_planner'),
  'public_intake',
  'complete-home-interiors',
  'apartment-3bhk',
  'immediate',
  'v1',
  '/planner'
);

insert into public.quotations (id, lead_id, quotation_number, status, created_by)
values (
  'e0999999-0000-4000-8000-000000000002',
  'e0bbbbbb-0000-4000-8000-000000000002',
  'OD-Q-2026-950002',
  'active',
  'e1111111-1111-1111-1111-111111111111'
);

select set_config(
  'test.tombstone_updated_at',
  (select updated_at::text from public.leads where id = 'e0aaaaaa-0000-4000-8000-000000000001'),
  true
);

-- =============================================================================
-- A. The schema
-- =============================================================================

select has_column('public', 'leads', 'deleted_at', 'deleted_at exists');
select has_column('public', 'leads', 'deleted_by', 'deleted_by exists');
select has_column('public', 'leads', 'delete_reason', 'delete_reason exists');
select has_column('public', 'leads', 'deletion_reference', 'deletion_reference exists');
select col_is_null('public', 'leads', 'deleted_at', 'deleted_at is nullable — most leads are alive');

-- All-or-none. A tombstone without a reason is a lead that is invisible and
-- unexplained, which is worse than either state alone.
select is(
  (select count(*)::integer from pg_constraint
    where conname = 'chk_leads_tombstone_all_or_none'),
  1,
  'the all-or-none tombstone constraint exists'
);
select is(
  (select count(*)::integer from pg_constraint
    where conname = 'chk_leads_delete_reason'),
  1,
  'the reason-length constraint exists'
);

-- And the columns are RPC-only: the guard trigger refuses a direct write before
-- the constraint is even consulted, which is the stronger of the two locks.
select throws_ok(
  $$update public.leads set deleted_at = now()
     where id = 'e0aaaaaa-0000-4000-8000-000000000001'$$,
  '42501',
  NULL,
  'a direct tombstone write is refused by the guard trigger'
);

-- =============================================================================
-- B. Authorization — the owner alone
-- =============================================================================

set local role authenticated;

select set_config('request.jwt.claim.sub', '', true);
select throws_ok(
  $$select public.delete_lead_tombstone(
    'e0aaaaaa-0000-4000-8000-000000000001'::uuid,
    'Unauthenticated attempt at deletion',
    current_setting('test.tombstone_updated_at')::timestamptz,
    'DELETE'
  )$$,
  '42501',
  'CRM_LEAD_DELETE_AUTH_REQUIRED',
  'an unauthenticated caller is refused'
);

select set_config('request.jwt.claim.sub', 'e2222222-2222-2222-2222-222222222222', true);
select throws_ok(
  $$select public.delete_lead_tombstone(
    'e0aaaaaa-0000-4000-8000-000000000001'::uuid,
    'Sales manager attempting to delete an enquiry',
    current_setting('test.tombstone_updated_at')::timestamptz,
    'DELETE'
  )$$,
  '42501',
  'CRM_LEAD_DELETE_PERMISSION_DENIED',
  'the Sales Manager is refused'
);

select set_config('request.jwt.claim.sub', 'e3333333-3333-3333-3333-333333333333', true);
select throws_ok(
  $$select public.delete_lead_tombstone(
    'e0aaaaaa-0000-4000-8000-000000000001'::uuid,
    'Sales executive attempting to delete an enquiry',
    current_setting('test.tombstone_updated_at')::timestamptz,
    'DELETE'
  )$$,
  '42501',
  'CRM_LEAD_DELETE_PERMISSION_DENIED',
  'the Sales Executive is refused'
);

select set_config('request.jwt.claim.sub', 'e4444444-4444-4444-4444-444444444444', true);
select throws_ok(
  $$select public.delete_lead_tombstone(
    'e0aaaaaa-0000-4000-8000-000000000001'::uuid,
    'Project manager attempting to delete an enquiry',
    current_setting('test.tombstone_updated_at')::timestamptz,
    'DELETE'
  )$$,
  '42501',
  'CRM_LEAD_DELETE_PERMISSION_DENIED',
  'the Project Manager is refused'
);

-- The near-miss authorities, one at a time. Each of these roles genuinely holds
-- the permission named, and none of them is enough.
select set_config('request.jwt.claim.sub', 'e2222222-2222-2222-2222-222222222222', true);
select results_eq(
  $$select (select public.authorize('admin.access'))$$,
  array[true],
  'the refused manager really does hold admin.access'
);
select results_eq(
  $$select (select public.authorize('leads.manage'))$$,
  array[true],
  'and leads.manage'
);
select results_eq(
  $$select (select public.authorize('leads.transition'))$$,
  array[true],
  'and leads.transition — none of which is delete'
);
select results_eq(
  $$select (select public.authorize('leads.delete'))$$,
  array[false],
  'and NOT leads.delete'
);

-- A suspended owner: valid JWT, no authority.
select set_config('request.jwt.claim.sub', 'e5555555-5555-5555-5555-555555555555', true);
select throws_ok(
  $$select public.delete_lead_tombstone(
    'e0aaaaaa-0000-4000-8000-000000000001'::uuid,
    'Suspended super admin attempting deletion',
    current_setting('test.tombstone_updated_at')::timestamptz,
    'DELETE'
  )$$,
  '42501',
  NULL,
  'a suspended Super Admin is refused'
);

-- =============================================================================
-- C. THE DOUBLE LOCK — the accident this exists for
-- =============================================================================
--
-- A future migration grants `leads.delete` to the Sales Manager by mistake. The
-- role check is what stops that being enough.

set local role postgres;
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r cross join public.permissions p
where r.code = 'sales_manager' and p.code = 'leads.delete'
on conflict do nothing;

set local role authenticated;
select set_config('request.jwt.claim.sub', 'e2222222-2222-2222-2222-222222222222', true);
select results_eq(
  $$select (select public.authorize('leads.delete'))$$,
  array[true],
  'the accidental grant really did take effect'
);
select throws_ok(
  $$select public.delete_lead_tombstone(
    'e0aaaaaa-0000-4000-8000-000000000001'::uuid,
    'Manager with an accidental leads.delete grant',
    current_setting('test.tombstone_updated_at')::timestamptz,
    'DELETE'
  )$$,
  '42501',
  'CRM_LEAD_DELETE_SUPER_ADMIN_REQUIRED',
  'and the role lock still refuses the deletion'
);

set local role postgres;
delete from public.role_permissions rp
using public.roles r, public.permissions p
where rp.role_id = r.id and rp.permission_id = p.id
  and r.code = 'sales_manager' and p.code = 'leads.delete';
set local role authenticated;

-- =============================================================================
-- D. Validation and concurrency
-- =============================================================================

select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);

select throws_ok(
  $$select public.delete_lead_tombstone(
    null::uuid, 'A perfectly good reason for deletion',
    current_setting('test.tombstone_updated_at')::timestamptz, 'DELETE')$$,
  '22023', 'CRM_LEAD_DELETE_INVALID_INPUT', 'a null lead id is rejected'
);
select throws_ok(
  $$select public.delete_lead_tombstone(
    'e0aaaaaa-0000-4000-8000-000000000001'::uuid, '   ',
    current_setting('test.tombstone_updated_at')::timestamptz, 'DELETE')$$,
  '22023', 'CRM_LEAD_DELETE_REASON_INVALID', 'a blank reason is rejected'
);
select throws_ok(
  $$select public.delete_lead_tombstone(
    'e0aaaaaa-0000-4000-8000-000000000001'::uuid, 'too short',
    current_setting('test.tombstone_updated_at')::timestamptz, 'DELETE')$$,
  '22023', 'CRM_LEAD_DELETE_REASON_INVALID', 'a reason under ten characters is rejected'
);
select throws_ok(
  $$select public.delete_lead_tombstone(
    'e0aaaaaa-0000-4000-8000-000000000001'::uuid, repeat('x', 501),
    current_setting('test.tombstone_updated_at')::timestamptz, 'DELETE')$$,
  '22023', 'CRM_LEAD_DELETE_REASON_INVALID', 'a reason over five hundred characters is rejected'
);
select throws_ok(
  $$select public.delete_lead_tombstone(
    'e0aaaaaa-0000-4000-8000-000000000001'::uuid, 'A perfectly good reason for deletion',
    current_setting('test.tombstone_updated_at')::timestamptz, 'delete')$$,
  '22023', 'CRM_LEAD_DELETE_CONFIRMATION_REQUIRED', 'the confirmation is case sensitive'
);
select throws_ok(
  $$select public.delete_lead_tombstone(
    'e0aaaaaa-0000-4000-8000-000000000001'::uuid, 'A perfectly good reason for deletion',
    now() - interval '1 day', 'DELETE')$$,
  '40001', 'CRM_LEAD_DELETE_STALE', 'a stale expected timestamp is refused'
);
select throws_ok(
  $$select public.delete_lead_tombstone(
    '00000000-0000-4000-8000-000000009999'::uuid, 'A perfectly good reason for deletion',
    current_setting('test.tombstone_updated_at')::timestamptz, 'DELETE')$$,
  'P0002', 'CRM_LEAD_DELETE_NOT_FOUND', 'an unknown enquiry is not found'
);

-- Nothing above wrote anything.
set local role postgres;
select is(
  (select count(*)::integer from public.leads
    where id = 'e0aaaaaa-0000-4000-8000-000000000001' and deleted_at is not null),
  0,
  'every refused attempt left the enquiry untouched'
);
set local role authenticated;

-- =============================================================================
-- E. Materially converted — fail closed
-- =============================================================================

select set_config(
  'test.converted_updated_at',
  (select updated_at::text from public.leads where id = 'e0bbbbbb-0000-4000-8000-000000000002'),
  true
);
select throws_ok(
  $$select public.delete_lead_tombstone(
    'e0bbbbbb-0000-4000-8000-000000000002'::uuid,
    'Attempting to delete an enquiry that has a quotation',
    current_setting('test.converted_updated_at')::timestamptz,
    'DELETE')$$,
  '42501', 'CRM_LEAD_DELETE_CONVERTED_BLOCKED',
  'an enquiry with a quotation cannot be deleted'
);

set local role postgres;
select is(
  (select count(*)::integer from public.leads
    where id = 'e0bbbbbb-0000-4000-8000-000000000002' and deleted_at is null),
  1,
  'and the blocked enquiry is not tombstoned'
);
select is(
  (select count(*)::integer from public.quotations
    where lead_id = 'e0bbbbbb-0000-4000-8000-000000000002'),
  1,
  'and its quotation is untouched'
);
set local role authenticated;

-- =============================================================================
-- F. The deletion itself
-- =============================================================================

select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);
select lives_ok(
  $$select public.delete_lead_tombstone(
    'e0aaaaaa-0000-4000-8000-000000000001'::uuid,
    'Duplicate enquiry created in error by the website form',
    current_setting('test.tombstone_updated_at')::timestamptz,
    'DELETE')$$,
  'the owner can delete an ordinary enquiry'
);

set local role postgres;

select is(
  (select count(*)::integer from public.leads where id = 'e0aaaaaa-0000-4000-8000-000000000001'),
  1,
  'THE LEAD ROW STILL PHYSICALLY EXISTS'
);
select isnt(
  (select deleted_at from public.leads where id = 'e0aaaaaa-0000-4000-8000-000000000001'),
  null,
  'deleted_at is set'
);
select is(
  (select deleted_by from public.leads where id = 'e0aaaaaa-0000-4000-8000-000000000001'),
  'e1111111-1111-1111-1111-111111111111'::uuid,
  'deleted_by is the acting owner'
);
select is(
  (select delete_reason from public.leads where id = 'e0aaaaaa-0000-4000-8000-000000000001'),
  'Duplicate enquiry created in error by the website form',
  'the reason is stored'
);
select isnt(
  (select deletion_reference from public.leads where id = 'e0aaaaaa-0000-4000-8000-000000000001'),
  null,
  'a deletion reference was generated server-side'
);
select is(
  (select status from public.leads where id = 'e0aaaaaa-0000-4000-8000-000000000001'),
  'assigned',
  'the lead lifecycle status is PRESERVED, not overwritten with a delete state'
);
select is(
  (select closed_lost_reason_id from public.leads where id = 'e0aaaaaa-0000-4000-8000-000000000001'),
  null,
  'and closed-lost is not borrowed to represent deletion'
);

-- The audit event, exactly once.
select is(
  (select count(*)::integer from public.lead_events
    where lead_id = 'e0aaaaaa-0000-4000-8000-000000000001' and event_type = 'lead.deleted'),
  1,
  'exactly one lead.deleted event'
);
select is(
  (select actor_id from public.lead_events
    where lead_id = 'e0aaaaaa-0000-4000-8000-000000000001' and event_type = 'lead.deleted'),
  'e1111111-1111-1111-1111-111111111111'::uuid,
  'the event names the acting owner'
);
select is(
  (select event_data ->> 'previousStatus' from public.lead_events
    where lead_id = 'e0aaaaaa-0000-4000-8000-000000000001' and event_type = 'lead.deleted'),
  'assigned',
  'the event records the status the enquiry had'
);
select is(
  (select event_data ->> 'version' from public.lead_events
    where lead_id = 'e0aaaaaa-0000-4000-8000-000000000001' and event_type = 'lead.deleted'),
  'lead_delete_v1',
  'the event is versioned'
);
select is(
  (select (event_data ->> 'deletionReference') from public.lead_events
    where lead_id = 'e0aaaaaa-0000-4000-8000-000000000001' and event_type = 'lead.deleted'),
  (select deletion_reference::text from public.leads
    where id = 'e0aaaaaa-0000-4000-8000-000000000001'),
  'the event carries the same deletion reference as the row'
);

-- NOTHING WAS DESTROYED.
select is(
  (select count(*)::integer from public.contacts where id = 'e0c00000-0000-4000-8000-000000000001'),
  1,
  'the contact survives'
);
select is(
  (select count(*)::integer from public.contact_channels
    where contact_id = 'e0c00000-0000-4000-8000-000000000001'),
  2,
  'the contact channels survive'
);
select is(
  (select count(*)::integer from public.lead_notes
    where lead_id = 'e0aaaaaa-0000-4000-8000-000000000001'),
  1,
  'the note survives'
);
select ok(
  (select count(*)::integer from public.lead_events
    where lead_id = 'e0aaaaaa-0000-4000-8000-000000000001') >= 1,
  'the event history survives'
);

/*
 * QUIESCENCE — through the canonical lifecycle paths, with their evidence.
 *
 * The first version of this feature updated the child rows directly. That
 * produced the right final state and none of the audit the follow-up and
 * cadence paths normally write, which is not acceptable in a feature whose
 * defining claim is that it preserves the audit record.
 */
select is(
  (select status from public.lead_follow_ups
    where lead_id = 'e0aaaaaa-0000-4000-8000-000000000001'),
  'cancelled',
  'the open follow-up is cancelled rather than deleted'
);
select is(
  (select count(*)::integer from public.lead_follow_ups
    where lead_id = 'e0aaaaaa-0000-4000-8000-000000000001'),
  1,
  'and the follow-up row is still there'
);
select is(
  (select count(*)::integer from public.lead_follow_ups
    where lead_id = 'e0aaaaaa-0000-4000-8000-000000000001'
      and is_primary_next_action = true),
  0,
  'and it is no longer anyone primary next action'
);
select is(
  (select cancelled_by from public.lead_follow_ups
    where lead_id = 'e0aaaaaa-0000-4000-8000-000000000001'),
  'e1111111-1111-1111-1111-111111111111'::uuid,
  'the cancellation names the owner who deleted the enquiry'
);
select isnt(
  (select cancelled_at from public.lead_follow_ups
    where lead_id = 'e0aaaaaa-0000-4000-8000-000000000001'),
  null,
  'and when it happened'
);

select is(
  (select count(*)::integer from public.lead_follow_up_events
    where lead_id = 'e0aaaaaa-0000-4000-8000-000000000001'
      and event_type = 'cancelled'),
  1,
  'the follow-up cancellation event was appended'
);
select is(
  (select count(*)::integer from public.lead_follow_up_events
    where lead_id = 'e0aaaaaa-0000-4000-8000-000000000001'
      and event_type = 'primary_cleared'),
  1,
  'and the primary_cleared event, because it WAS the next action'
);
select is(
  (select count(*)::integer from public.lead_activities
    where lead_id = 'e0aaaaaa-0000-4000-8000-000000000001'
      and activity_type = 'follow_up.cancelled'),
  1,
  'and the follow_up.cancelled activity'
);

select is(
  (select status from public.crm_lead_cadence_enrollments
    where lead_id = 'e0aaaaaa-0000-4000-8000-000000000001'),
  'stopped',
  'the cadence is stopped'
);
select is(
  (select stop_reason from public.crm_lead_cadence_enrollments
    where lead_id = 'e0aaaaaa-0000-4000-8000-000000000001'),
  'lead_deleted',
  'with a reason that says what actually happened, not manual_override'
);
select is(
  (select count(*)::integer from public.crm_lead_cadence_enrollments
    where lead_id = 'e0aaaaaa-0000-4000-8000-000000000001'),
  1,
  'and the enrolment row survives'
);
select is(
  (select count(*)::integer from public.crm_cadence_enrollment_events
    where lead_id = 'e0aaaaaa-0000-4000-8000-000000000001'
      and event_type = 'auto_stopped'),
  1,
  'the auto_stopped enrolment event was appended'
);
select is(
  (select count(*)::integer from public.lead_activities
    where lead_id = 'e0aaaaaa-0000-4000-8000-000000000001'
      and activity_type = 'cadence.stopped'),
  1,
  'and the cadence.stopped activity'
);

-- Deterministic on a second attempt: no second event, no change.
--
-- Read as postgres: the enquiry is invisible to every authenticated caller now,
-- which is the point, so asking as one would return an empty setting.
select set_config(
  'test.tombstone_updated_at2',
  (select updated_at::text from public.leads where id = 'e0aaaaaa-0000-4000-8000-000000000001'),
  true
);

set local role authenticated;
select throws_ok(
  $$select public.delete_lead_tombstone(
    'e0aaaaaa-0000-4000-8000-000000000001'::uuid,
    'A second deletion attempt on the same enquiry',
    current_setting('test.tombstone_updated_at2')::timestamptz,
    'DELETE')$$,
  '22023', 'CRM_LEAD_ALREADY_DELETED', 'deleting twice is deterministic'
);
set local role postgres;
select is(
  (select count(*)::integer from public.lead_events
    where lead_id = 'e0aaaaaa-0000-4000-8000-000000000001' and event_type = 'lead.deleted'),
  1,
  'and writes no second event'
);
set local role authenticated;

-- =============================================================================
-- G. Operational containment
-- =============================================================================

-- The owner, who can see everything, cannot see this.
select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);
select is(
  (select count(*)::integer from public.leads where id = 'e0aaaaaa-0000-4000-8000-000000000001'),
  0,
  'the owner no longer reads the deleted enquiry through the ordinary policy'
);
select is(
  (select private.crm_can_view_lead_by_id('e0aaaaaa-0000-4000-8000-000000000001'::uuid)),
  false,
  'crm_can_view_lead_by_id is false'
);
select is(
  (select private.crm_can_mutate_lead('e0aaaaaa-0000-4000-8000-000000000001'::uuid)),
  false,
  'crm_can_mutate_lead is false'
);
select is(
  (select private.crm_lead_is_operational('e0aaaaaa-0000-4000-8000-000000000001'::uuid)),
  false,
  'crm_lead_is_operational is false'
);

-- The assigned executive cannot see it either.
select set_config('request.jwt.claim.sub', 'e3333333-3333-3333-3333-333333333333', true);
select is(
  (select count(*)::integer from public.leads where id = 'e0aaaaaa-0000-4000-8000-000000000001'),
  0,
  'the assigned Sales Executive no longer reads it'
);
select is(
  (select private.crm_user_can_operate_lead(
    'e3333333-3333-3333-3333-333333333333'::uuid,
    'e0aaaaaa-0000-4000-8000-000000000001'::uuid,
    'leads.transition')),
  false,
  'crm_user_can_operate_lead is false for the former assignee'
);

-- Every operational mutation is refused.
select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);
select throws_ok(
  $$select public.transition_lead_status(
    'e0aaaaaa-0000-4000-8000-000000000001'::uuid, 'contacted', 'note', null)$$,
  NULL, NULL, 'a status transition is refused after deletion'
);
select throws_ok(
  $$select public.assign_lead(
    'e0aaaaaa-0000-4000-8000-000000000001'::uuid,
    'e3333333-3333-3333-3333-333333333333'::uuid, 'manual', null)$$,
  NULL, NULL, 'assignment is refused after deletion'
);
select throws_ok(
  $$select public.create_quotation_draft(
    'e0aaaaaa-0000-4000-8000-000000000001'::uuid, null)$$,
  NULL, NULL, 'quotation creation is refused after deletion'
);

-- =============================================================================
-- H. WhatsApp — history stays readable, the lead stops being operable
-- =============================================================================
--
-- The conversation below has BOTH `lead_id` and `contact_id` populated. That is
-- the shape the first version of the filtering missed twice over: the inbox
-- predicates' manage-scope branch never checked whether the filtered join found
-- a lead, and the eligibility function only consulted the lead when the contact
-- was absent.

set local role postgres;
select is(
  (select count(*)::integer from public.whatsapp_conversations
    where id = 'e0fbcccc-0000-4000-8000-000000000001'),
  1,
  'the conversation row survives the deletion'
);
select is(
  (select lead_id from public.whatsapp_conversations
    where id = 'e0fbcccc-0000-4000-8000-000000000001'),
  'e0aaaaaa-0000-4000-8000-000000000001'::uuid,
  'and still points at the deleted enquiry, as history'
);
select isnt(
  (select contact_id from public.whatsapp_conversations
    where id = 'e0fbcccc-0000-4000-8000-000000000001'),
  null,
  'with its contact_id populated — the case that used to slip through'
);
set local role authenticated;

-- The owner, who has manage scope over the whole inbox.
select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);
select is(
  (select private.whatsapp_inbox_can_use_conversation(
    'e0fbcccc-0000-4000-8000-000000000001'::uuid)),
  false,
  'manage scope does NOT let the owner act on a deleted enquiry conversation'
);

-- The Sales Manager, who also has manage scope.
select set_config('request.jwt.claim.sub', 'e2222222-2222-2222-2222-222222222222', true);
select is(
  (select private.whatsapp_inbox_can_use_conversation(
    'e0fbcccc-0000-4000-8000-000000000001'::uuid)),
  false,
  'nor the Sales Manager'
);

-- The executive the enquiry was assigned to.
select set_config('request.jwt.claim.sub', 'e3333333-3333-3333-3333-333333333333', true);
select is(
  (select private.whatsapp_inbox_can_use_conversation(
    'e0fbcccc-0000-4000-8000-000000000001'::uuid)),
  false,
  'nor the former assignee'
);

-- The named-actor form the provider dispatch path uses.
select is(
  (select private.whatsapp_inbox_actor_can_use_conversation(
    'e1111111-1111-1111-1111-111111111111'::uuid,
    'e0fbcccc-0000-4000-8000-000000000001'::uuid)),
  false,
  'the dispatch predicate refuses the owner too'
);
select is(
  (select private.whatsapp_inbox_actor_can_use_conversation(
    'e2222222-2222-2222-2222-222222222222'::uuid,
    'e0fbcccc-0000-4000-8000-000000000001'::uuid)),
  false,
  'and the Sales Manager — so a pre-existing intent cannot be dispatched'
);

-- Eligibility, which is what a send is actually gated on.
select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);
select results_eq(
  $$select eligibility_code
      from private.whatsapp_evaluate_service_send_eligibility(
        'e0fbcccc-0000-4000-8000-000000000001'::uuid)$$,
  $$values ('denied_lead_deleted'::text)$$,
  'service-send eligibility is denied because the enquiry is gone'
);

select throws_ok(
  $$select public.create_whatsapp_service_send_intent(
    'e0fbcccc-0000-4000-8000-000000000001'::uuid,
    'tombstone-intent-50',
    'WHATSAPP_SERVICE',
    'An attempted message after the enquiry was deleted.',
    null)$$,
  NULL, NULL,
  'and a new lead-scoped send intent is refused'
);

-- =============================================================================
-- I. Duplicate / re-entry — the tombstone must not block the customer
-- =============================================================================
--
-- The same contact comes back with a genuine new enquiry. Its old, deleted
-- enquiry is history and must not read as an active duplicate.

select set_config('request.jwt.claim.sub', 'e1111111-1111-1111-1111-111111111111', true);
select results_eq(
  $$select outcome_code
      from public.check_manual_lead_duplicate(
        '+919700000050', null, 'complete-home-interiors', 'apartment-3bhk', null
      )$$,
  $$values ('REUSABLE_CONTACT'::text)$$,
  'the deleted enquiry does not make the returning customer a duplicate'
);

select lives_ok(
  $$select public.create_manual_lead(
    'Tombstone Client Returns',
    '+919700000050',
    null,
    'complete-home-interiors',
    'apartment-3bhk',
    'immediate',
    (select id from public.lead_sources where code = 'phone_call'),
    'Whitefield',
    null, '{}'::text[], null, null,
    null, false, null)$$,
  'and a fresh enquiry can be created for the same contact'
);

set local role postgres;
select is(
  (select count(*)::integer from public.leads
    where contact_id = 'e0c00000-0000-4000-8000-000000000001' and deleted_at is null),
  1,
  'the returning customer has exactly one live enquiry: the new one'
);
select is(
  (select count(*)::integer from public.leads
    where contact_id = 'e0c00000-0000-4000-8000-000000000001' and deleted_at is not null),
  1,
  'and the tombstone is still on the record'
);
select is(
  (select count(*)::integer from public.contacts where id = 'e0c00000-0000-4000-8000-000000000001'),
  1,
  'with the contact identity intact throughout'
);

select * from finish();
rollback;
