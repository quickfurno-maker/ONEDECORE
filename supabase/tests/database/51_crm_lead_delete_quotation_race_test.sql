-- ONEDECORE — deleting an enquiry vs. quoting it, run concurrently for real.
--
-- THE RACE THIS EXISTS TO CLOSE
--
-- `create_quotation_draft` decides whether a lead may take a quotation BEFORE
-- it acquires the `quotation_root` advisory lock. `delete_lead_tombstone` locks
-- the lead row and checks for quotations. Without a shared serialization point
-- those two interleave badly:
--
--   Q: passes quotation_can_create_for_lead   (lead is active)
--   D: locks the lead, sees no quotation, tombstones, COMMITS
--   Q: resumes and writes the quotation
--
-- The delete succeeded, the quotation succeeded, and the converted-lead
-- invariant — "a lead with commercial history is never deleted" — is violated
-- after the fact by a lead that now has both.
--
-- Both paths now take `pg_advisory_xact_lock('quotation_root:' || lead_id)`
-- FIRST and the lead row second, and the quotation path re-checks the lead
-- under that lock. This file proves it with two real sessions rather than by
-- reading the SQL.
--
-- `dblink` gives the second session. pgTAP runs each file inside one
-- transaction, so a second connection is the only way to have two.

begin;
select plan(12);

create extension if not exists dblink;

-- =============================================================================
-- Fixtures — f-prefix
-- =============================================================================

insert into auth.users (id, instance_id, email, aud, role) values
  ('f1111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', '51-sa@example.test', 'authenticated', 'authenticated');

update public.profiles set status = 'active'
where id = 'f1111111-1111-1111-1111-111111111111';

insert into public.user_roles (user_id, role_id)
select 'f1111111-1111-1111-1111-111111111111', id from public.roles where code = 'super_admin';

insert into public.contacts (id, display_name, status)
values
  ('f0c00000-0000-4000-8000-000000000001', 'Race Client A', 'active'),
  ('f0c00000-0000-4000-8000-000000000002', 'Race Client B', 'active')
on conflict (id) do nothing;

insert into public.contact_channels (contact_id, channel_type, address_normalized, is_primary)
values
  ('f0c00000-0000-4000-8000-000000000001', 'phone', '+919700000061', true),
  ('f0c00000-0000-4000-8000-000000000002', 'phone', '+919700000062', true)
on conflict do nothing;

-- Two leads: one for each ordering.
insert into public.leads (
  id, submission_reference, contact_id, submitted_name, status, source,
  primary_source_id, entry_method, service_code, property_code, timeline_code,
  planner_version, landing_path
)
values
  (
    'f0aaaaaa-0000-4000-8000-000000000001',
    'f0aaaaaa-0000-4000-8000-000000000001',
    'f0c00000-0000-4000-8000-000000000001',
    'Race Client A', 'new', 'website-planner',
    (select id from public.lead_sources where code = 'website_planner'),
    'public_intake', 'complete-home-interiors', 'apartment-3bhk', 'immediate',
    'v1', '/planner'
  ),
  (
    'f0aaaaaa-0000-4000-8000-000000000002',
    'f0aaaaaa-0000-4000-8000-000000000002',
    'f0c00000-0000-4000-8000-000000000002',
    'Race Client B', 'new', 'website-planner',
    (select id from public.lead_sources where code = 'website_planner'),
    'public_intake', 'complete-home-interiors', 'apartment-3bhk', 'immediate',
    'v1', '/planner'
  );

-- The fixtures live in THIS transaction, so the second session cannot see them.
-- Both orderings are therefore driven from here, with the other session used to
-- hold the serialization point and prove the wait is real.
commit;

begin;

-- =============================================================================
-- A. Both paths take the same lock, in the same order
-- =============================================================================

select set_config('request.jwt.claim.sub', 'f1111111-1111-1111-1111-111111111111', true);
set local role authenticated;

select set_config(
  'test.race_lead_a_updated',
  (select updated_at::text from public.leads where id = 'f0aaaaaa-0000-4000-8000-000000000001'),
  true
);

-- A second session takes the quotation_root lock for lead A and holds it.
select ok(
  (select dblink_connect('race_holder', 'dbname=postgres') = 'OK'),
  'a second session is available to hold the serialization point'
);
select ok(
  (select dblink_exec('race_holder', 'begin') = 'BEGIN'),
  'and it opens a transaction'
);
select ok(
  (
    select (dblink(
      'race_holder',
      'select pg_advisory_xact_lock(hashtextextended(''quotation_root:f0aaaaaa-0000-4000-8000-000000000001'', 0))::text'
    ) as t(r text)).r is not null
  ),
  'the second session holds the quotation_root lock for this lead'
);

/*
 * With that lock held elsewhere, BOTH paths must block on it. A short
 * `lock_timeout` turns "blocks" into an observable error instead of a hung
 * test, and `55P03` (lock_not_available) is the proof that the wait was real
 * rather than the call simply failing for its own reasons.
 */
set local lock_timeout = '900ms';

select throws_ok(
  $$select public.create_quotation_draft(
    'f0aaaaaa-0000-4000-8000-000000000001'::uuid,
    'Race probe quotation',
    'race-probe-quotation-1')$$,
  '55P03',
  NULL,
  'first-quotation creation WAITS on the shared quotation_root lock'
);

select throws_ok(
  $$select public.delete_lead_tombstone(
    'f0aaaaaa-0000-4000-8000-000000000001'::uuid,
    'Race probe deletion while the lock is held elsewhere',
    current_setting('test.race_lead_a_updated')::timestamptz,
    'DELETE')$$,
  '55P03',
  NULL,
  'and so does deletion — the same lock, so they cannot interleave'
);

set local lock_timeout = 0;

select ok(
  (select dblink_exec('race_holder', 'rollback') = 'ROLLBACK'),
  'the holder releases the lock'
);
select ok(
  (select dblink_disconnect('race_holder') = 'OK'),
  'and disconnects'
);

-- =============================================================================
-- B. DELETE WINS — the quotation that arrives second is refused
-- =============================================================================
--
-- The delete commits first. What matters is that the quotation path re-reads
-- the lead AFTER the serialization point rather than trusting the answer it got
-- before: without that re-read it would happily write a quotation against a
-- lead that is already a tombstone.

select lives_ok(
  $$select public.delete_lead_tombstone(
    'f0aaaaaa-0000-4000-8000-000000000001'::uuid,
    'Deletion wins the race against the first quotation',
    current_setting('test.race_lead_a_updated')::timestamptz,
    'DELETE')$$,
  'the deletion succeeds'
);

select throws_ok(
  $$select public.create_quotation_draft(
    'f0aaaaaa-0000-4000-8000-000000000001'::uuid,
    'Quotation that lost the race',
    'race-probe-quotation-2')$$,
  '42501',
  'QUOTATION_NOT_FOUND_OR_FORBIDDEN',
  'and the quotation that arrives after it is refused'
);

set local role postgres;
select is(
  (select count(*)::integer from public.quotations
    where lead_id = 'f0aaaaaa-0000-4000-8000-000000000001'),
  0,
  'THE FINAL STATE IS NEVER a tombstoned lead holding a new quotation'
);
set local role authenticated;

-- =============================================================================
-- C. QUOTATION WINS — the delete that arrives second is refused
-- =============================================================================

select set_config(
  'test.race_lead_b_updated',
  (select updated_at::text from public.leads where id = 'f0aaaaaa-0000-4000-8000-000000000002'),
  true
);

select lives_ok(
  $$select public.create_quotation_draft(
    'f0aaaaaa-0000-4000-8000-000000000002'::uuid,
    'Quotation that wins the race',
    'race-probe-quotation-3')$$,
  'the quotation succeeds'
);

select throws_ok(
  $$select public.delete_lead_tombstone(
    'f0aaaaaa-0000-4000-8000-000000000002'::uuid,
    'Deletion that lost the race against the first quotation',
    current_setting('test.race_lead_b_updated')::timestamptz,
    'DELETE')$$,
  '42501',
  'CRM_LEAD_DELETE_CONVERTED_BLOCKED',
  'and the deletion that arrives after it is refused as converted'
);

set local role postgres;
select is(
  (select count(*)::integer from public.leads
    where id = 'f0aaaaaa-0000-4000-8000-000000000002' and deleted_at is null),
  1,
  'the lead stays active, with its quotation'
);

select * from finish();
rollback;

-- The fixtures were committed so a second session could exist, so they are
-- cleaned up explicitly rather than by the rollback above.
begin;
delete from public.quotation_versions
  where quotation_id in (
    select id from public.quotations
    where lead_id in (
      'f0aaaaaa-0000-4000-8000-000000000001',
      'f0aaaaaa-0000-4000-8000-000000000002'
    )
  );
delete from public.quotations
  where lead_id in (
    'f0aaaaaa-0000-4000-8000-000000000001',
    'f0aaaaaa-0000-4000-8000-000000000002'
  );
delete from private.quotation_idempotency_requests
  where actor_id = 'f1111111-1111-1111-1111-111111111111';
delete from public.lead_events
  where lead_id in (
    'f0aaaaaa-0000-4000-8000-000000000001',
    'f0aaaaaa-0000-4000-8000-000000000002'
  );
delete from public.lead_activities
  where lead_id in (
    'f0aaaaaa-0000-4000-8000-000000000001',
    'f0aaaaaa-0000-4000-8000-000000000002'
  );
delete from public.lead_source_touchpoints
  where lead_id in (
    'f0aaaaaa-0000-4000-8000-000000000001',
    'f0aaaaaa-0000-4000-8000-000000000002'
  );
delete from public.leads
  where id in (
    'f0aaaaaa-0000-4000-8000-000000000001',
    'f0aaaaaa-0000-4000-8000-000000000002'
  );
delete from public.contact_channels
  where contact_id in (
    'f0c00000-0000-4000-8000-000000000001',
    'f0c00000-0000-4000-8000-000000000002'
  );
delete from public.contacts
  where id in (
    'f0c00000-0000-4000-8000-000000000001',
    'f0c00000-0000-4000-8000-000000000002'
  );
delete from public.user_roles where user_id = 'f1111111-1111-1111-1111-111111111111';
delete from auth.users where id = 'f1111111-1111-1111-1111-111111111111';
commit;
