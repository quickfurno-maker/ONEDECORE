-- ONEDECORE CRM — manual sales temperature (M56), database contract.
--
-- The salesperson controls the working temperature; the system supplies
-- intelligence, not authority. These tests prove the database enforces that
-- boundary rather than trusting the application to.

begin;
select plan(34);

-- Helpers are defined BEFORE the role switch: once the session is
-- `authenticated` it has no CREATE on schema public, which is correct.
create or replace function public.test_m56_lead_id()
returns uuid language sql security definer set search_path = '' as $$
  select id from public.leads
  where submitted_name = 'M56 Temperature Lead';
$$;

create or replace function public.test_m56_other_lead_id()
returns uuid language sql security definer set search_path = '' as $$
  select id from public.leads
  where submitted_name = 'M56 Other Executive Lead';
$$;

create or replace function public.test_m56_temperature(p_lead_id uuid)
returns text language sql security definer set search_path = '' as $$
  select manual_sales_temperature from public.leads where id = p_lead_id;
$$;

create or replace function public.test_m56_event_count()
returns integer language sql security definer set search_path = '' as $$
  select count(*)::integer from public.lead_events
  where lead_id = public.test_m56_lead_id()
    and event_type = 'lead.sales_temperature_set';
$$;

create or replace function public.test_m56_latest_event()
returns jsonb language sql security definer set search_path = '' as $$
  select event_data from public.lead_events
  where lead_id = public.test_m56_lead_id()
    and event_type = 'lead.sales_temperature_set'
  order by occurred_at desc, created_at desc
  limit 1;
$$;

create or replace function public.test_m56_latest_actor()
returns uuid language sql security definer set search_path = '' as $$
  select actor_id from public.lead_events
  where lead_id = public.test_m56_lead_id()
    and event_type = 'lead.sales_temperature_set'
  order by occurred_at desc, created_at desc
  limit 1;
$$;

-- Parks/closes a lead for the lifecycle-override tests.
--
-- `forbid_direct_lead_owner_status_update` correctly refuses a direct status
-- write; the sanctioned bypass is the same session flag the CRM transition RPCs
-- set. Used here because the SUBJECT is the temperature control's reaction to a
-- lifecycle state, not the transition graph itself.
create or replace function public.test_m56_set_status(p_lead_id uuid, p_status text)
returns void language plpgsql security definer set search_path = '' as $$
begin
  perform set_config('onedecore.crm_transition', '1', true);
  -- `on_hold` carries required parking metadata; the constraint enforces it.
  update public.leads
  set status = p_status,
      on_hold_previous_status = case when p_status = 'on_hold' then 'qualified' else null end,
      on_hold_reason = case when p_status = 'on_hold' then 'M56 lifecycle fixture' else null end,
      on_hold_since = case when p_status = 'on_hold' then now() else null end,
      -- `closed_lost` carries a required reason + note, same as on_hold's
      -- parking metadata. Both invariants are the lifecycle's, not this
      -- feature's, so the fixture satisfies them rather than weakening them.
      closed_lost_reason_id = case
        when p_status = 'closed_lost'
        then (select id from public.lead_closure_reasons order by display_order limit 1)
        else null end,
      closed_lost_note = case
        when p_status = 'closed_lost' then 'M56 lifecycle fixture' else null end
  where id = p_lead_id;
  perform set_config('onedecore.crm_transition', '0', true);
end;
$$;

-- -----------------------------------------------------------------------------
-- A. Schema
-- -----------------------------------------------------------------------------

select has_column('public', 'leads', 'manual_sales_temperature', 'manual_sales_temperature exists');
select has_column('public', 'leads', 'manual_sales_temperature_set_at', 'set_at exists');
select has_column('public', 'leads', 'manual_sales_temperature_set_by', 'set_by exists');
select has_column('public', 'leads', 'manual_sales_temperature_reason', 'reason exists');

select is(
  (select pg_get_constraintdef(oid) from pg_constraint
   where conname = 'chk_leads_manual_sales_temperature'),
  'CHECK (((manual_sales_temperature IS NULL) OR (manual_sales_temperature = ANY (ARRAY[''hot''::text, ''warm''::text, ''cold''::text]))))',
  'only hot/warm/cold may ever be stored'
);

-- -----------------------------------------------------------------------------
-- B. Fixtures
-- -----------------------------------------------------------------------------

insert into auth.users (id, instance_id, email, aud, role) values
  ('46111111-1111-4111-8111-111111111111', '00000000-0000-0000-0000-000000000000', '46-exec@onedecore.in', 'authenticated', 'authenticated'),
  ('46222222-2222-4222-8222-222222222222', '00000000-0000-0000-0000-000000000000', '46-other@onedecore.in', 'authenticated', 'authenticated'),
  ('46333333-3333-4333-8333-333333333333', '00000000-0000-0000-0000-000000000000', '46-manager@onedecore.in', 'authenticated', 'authenticated');

update public.profiles set status = 'active', display_name = 'M56 Exec'
where id = '46111111-1111-4111-8111-111111111111';
update public.profiles set status = 'active', display_name = 'M56 Other Exec'
where id = '46222222-2222-4222-8222-222222222222';
update public.profiles set status = 'active', display_name = 'M56 Manager'
where id = '46333333-3333-4333-8333-333333333333';

insert into public.user_roles (user_id, role_id)
select '46111111-1111-4111-8111-111111111111', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select '46222222-2222-4222-8222-222222222222', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select '46333333-3333-4333-8333-333333333333', id from public.roles where code = 'sales_manager';

insert into public.contacts (id, display_name, status) values
  ('46aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'M56 Client', 'active'),
  ('46bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'M56 Other Client', 'active');

insert into public.contact_channels (contact_id, channel_type, address_normalized, is_primary) values
  ('46aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'phone', '+919812340001', true),
  ('46bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'phone', '+919812340002', true);

insert into public.leads (
  contact_id, status, assigned_to, submitted_name, service_code,
  property_code, timeline_code, primary_source_id, entry_method
)
select
  '46aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'qualified',
  '46111111-1111-4111-8111-111111111111', 'M56 Temperature Lead',
  'complete-home-interiors', 'apartment-2bhk', 'immediate', id, 'manual'
from public.lead_sources where code = 'manual_entry';

insert into public.leads (
  contact_id, status, assigned_to, submitted_name, service_code,
  property_code, timeline_code, primary_source_id, entry_method
)
select
  '46bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'qualified',
  '46222222-2222-4222-8222-222222222222', 'M56 Other Executive Lead',
  'complete-home-interiors', 'apartment-2bhk', 'immediate', id, 'manual'
from public.lead_sources where code = 'manual_entry';

-- Nothing is backfilled: an untouched lead uses the system suggestion.
select is(
  public.test_m56_temperature(public.test_m56_lead_id()),
  null,
  'a new lead carries NO manual temperature'
);

-- -----------------------------------------------------------------------------
-- C. Direct-write constraints
-- -----------------------------------------------------------------------------

select throws_ok(
  $q$update public.leads set manual_sales_temperature = 'lost'
     where id = public.test_m56_lead_id()$q$,
  '23514',
  'new row for relation "leads" violates check constraint "chk_leads_manual_sales_temperature"',
  'LOST can never be stored as a manual temperature'
);
select throws_ok(
  $q$update public.leads set manual_sales_temperature = 'won'
     where id = public.test_m56_lead_id()$q$,
  '23514',
  'new row for relation "leads" violates check constraint "chk_leads_manual_sales_temperature"',
  'WON can never be stored as a manual temperature'
);
select throws_ok(
  $q$update public.leads set manual_sales_temperature = 'on_hold'
     where id = public.test_m56_lead_id()$q$,
  '23514',
  'new row for relation "leads" violates check constraint "chk_leads_manual_sales_temperature"',
  'HOLD can never be stored as a manual temperature'
);
select throws_ok(
  $q$update public.leads set manual_sales_temperature = 'lukewarm'
     where id = public.test_m56_lead_id()$q$,
  '23514',
  'new row for relation "leads" violates check constraint "chk_leads_manual_sales_temperature"',
  'an invented temperature is rejected'
);
-- Metadata coherence: a stored temperature always carries when it was set.
select throws_ok(
  $q$update public.leads
     set manual_sales_temperature = 'hot', manual_sales_temperature_set_at = null
     where id = public.test_m56_lead_id()$q$,
  '23514',
  'new row for relation "leads" violates check constraint "chk_leads_manual_sales_temperature_meta"',
  'a stored temperature without a timestamp is rejected'
);

-- -----------------------------------------------------------------------------
-- D. Unauthenticated
-- -----------------------------------------------------------------------------

select set_config('role', 'authenticated', true);

select throws_ok(
  $q$select public.set_lead_sales_temperature(public.test_m56_lead_id(), 'hot')$q$,
  '42501',
  'Authentication required',
  'UNAUTHENTICATED: the mutation fails closed'
);

-- -----------------------------------------------------------------------------
-- E. The assigned executive
-- -----------------------------------------------------------------------------

select set_config('request.jwt.claim.sub', '46111111-1111-4111-8111-111111111111', true);

select lives_ok(
  $q$select public.set_lead_sales_temperature(public.test_m56_lead_id(), 'hot')$q$,
  'the assigned executive may set HOT'
);
select is(
  public.test_m56_temperature(public.test_m56_lead_id()),
  'hot',
  'the temperature is persisted'
);
select is(public.test_m56_event_count(), 1, 'exactly one audit event was written');
select is(
  public.test_m56_latest_event() ->> 'to', 'hot',
  'the audit records the NEW temperature'
);
select ok(
  (public.test_m56_latest_event() -> 'from') = 'null'::jsonb,
  'the audit records the previous value as an explicit null'
);
select is(
  public.test_m56_latest_actor(),
  '46111111-1111-4111-8111-111111111111',
  'the audit attributes the actor'
);

-- Case is normalized rather than rejected.
select lives_ok(
  $q$select public.set_lead_sales_temperature(public.test_m56_lead_id(), 'WARM')$q$,
  'an uppercase value is normalized'
);
select is(
  public.test_m56_temperature(public.test_m56_lead_id()),
  'warm',
  'WARM stored lowercase'
);
select is(
  public.test_m56_latest_event() ->> 'from', 'hot',
  'the audit records the OLD temperature on a change'
);

-- A no-op must not write misleading history.
select is(public.test_m56_event_count(), 2, 'two events so far');
select lives_ok(
  $q$select public.set_lead_sales_temperature(public.test_m56_lead_id(), 'warm')$q$,
  'setting the SAME temperature is accepted'
);
select is(
  public.test_m56_event_count(), 2,
  'a no-op writes NO duplicate history'
);

-- Invalid input through the RPC.
select throws_ok(
  $q$select public.set_lead_sales_temperature(public.test_m56_lead_id(), 'lost')$q$,
  '22023',
  'INVALID_SALES_TEMPERATURE: expected hot, warm or cold',
  'the RPC refuses a lifecycle word as a temperature'
);

-- Clearing the override returns the lead to the system suggestion.
select lives_ok(
  $q$select public.set_lead_sales_temperature(public.test_m56_lead_id(), null)$q$,
  'the override can be cleared'
);
select is(
  public.test_m56_temperature(public.test_m56_lead_id()),
  null,
  'clearing removes the stored temperature'
);
select ok(
  (select manual_sales_temperature_set_by is null
     and manual_sales_temperature_set_at is null
   from public.leads where id = public.test_m56_lead_id()),
  'clearing also clears the metadata, leaving no stale actor'
);
select is(
  public.test_m56_latest_event() ->> 'source', 'system',
  'clearing is audited as a return to the system suggestion'
);

-- -----------------------------------------------------------------------------
-- F. Scope
-- -----------------------------------------------------------------------------

select throws_ok(
  $q$select public.set_lead_sales_temperature(public.test_m56_other_lead_id(), 'hot')$q$,
  '42501',
  'Lead not visible for sales temperature change',
  'an executive cannot reclassify another executive''s lead'
);

-- A broad-read manager can.
select set_config('request.jwt.claim.sub', '46333333-3333-4333-8333-333333333333', true);
select lives_ok(
  $q$select public.set_lead_sales_temperature(public.test_m56_other_lead_id(), 'cold')$q$,
  'a sales manager may classify a team lead'
);

-- -----------------------------------------------------------------------------
-- G. Lifecycle overrides the temperature
-- -----------------------------------------------------------------------------

reset role;
select public.test_m56_set_status(public.test_m56_lead_id(), 'on_hold');
select set_config('role', 'authenticated', true);
select set_config('request.jwt.claim.sub', '46111111-1111-4111-8111-111111111111', true);

select throws_ok(
  $q$select public.set_lead_sales_temperature(public.test_m56_lead_id(), 'hot')$q$,
  '22023',
  'LIFECYCLE_OVERRIDES_TEMPERATURE: on_hold leads are classified by lifecycle, not temperature',
  'ON HOLD: the temperature control is refused'
);

reset role;
select public.test_m56_set_status(public.test_m56_lead_id(), 'closed_lost');
select set_config('role', 'authenticated', true);

select throws_ok(
  $q$select public.set_lead_sales_temperature(public.test_m56_lead_id(), 'hot')$q$,
  '22023',
  'LIFECYCLE_OVERRIDES_TEMPERATURE: closed_lost leads are classified by lifecycle, not temperature',
  'CLOSED LOST: the temperature control is refused'
);

-- A stored temperature SURVIVES a lifecycle override, so a resumed lead
-- returns to the classification its owner chose.
reset role;
update public.leads
set manual_sales_temperature = 'hot',
    manual_sales_temperature_set_at = now(),
    manual_sales_temperature_set_by = '46111111-1111-4111-8111-111111111111'
where id = public.test_m56_other_lead_id();
select public.test_m56_set_status(public.test_m56_other_lead_id(), 'on_hold');

select is(
  public.test_m56_temperature(public.test_m56_other_lead_id()),
  'hot',
  'a parked lead KEEPS its stored temperature for when it resumes'
);

select * from finish();
rollback;
