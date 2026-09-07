-- ONEDECORE — public-consult-v2: the single-step consultation, at the SQL
-- trust boundary.
--
-- WHAT THIS SUITE EXISTS TO PREVENT
--
-- The homepage form became one card — service, name, mobile, optional locality —
-- and stopped sending a qualifier. The SQL for `public-consult-v1` raises
-- `qualifier_required`. For a moment the two disagreed, and the disagreement was
-- invisible: the application tests validated the relaxed TypeScript contract,
-- the database tests validated the strict SQL one, and both were green while
-- every real lead would have failed at the RPC.
--
-- So v2 is a NEW discriminator rather than a looser v1, and this file asserts
-- the half that TypeScript cannot: that the database itself distinguishes them.
-- Suite 48 still owns v1 and is unchanged.
--
-- NOTE ON THE FILE NUMBER
--
-- The correction brief suggested `49_`. That number is already
-- `49_sales_manager_control_plane_test.sql`, as are 50 and 51, so this is 52.

begin;
select plan(26);

-- ---------------------------------------------------------------------------
-- Privileges. CREATE OR REPLACE preserves them, which is precisely why they
-- are re-checked: a definer function that quietly fell back to the PUBLIC
-- default would be callable by anon.
-- ---------------------------------------------------------------------------
select results_eq(
  $$select has_function_privilege('anon', 'public.submit_lead_intake(uuid,text,text,text,text,text,text,text,text,text,text,text[],text,jsonb,text,text,text,jsonb,text,boolean,boolean,boolean,boolean,text,text,text,text,text,text)', 'execute')$$,
  array[false],
  'anon cannot execute submit_lead_intake'
);
select results_eq(
  $$select has_function_privilege('authenticated', 'public.submit_lead_intake(uuid,text,text,text,text,text,text,text,text,text,text,text[],text,jsonb,text,text,text,jsonb,text,boolean,boolean,boolean,boolean,text,text,text,text,text,text)', 'execute')$$,
  array[false],
  'authenticated cannot execute submit_lead_intake'
);
select results_eq(
  $$select has_function_privilege('service_role', 'public.submit_lead_intake(uuid,text,text,text,text,text,text,text,text,text,text,text[],text,jsonb,text,text,text,jsonb,text,boolean,boolean,boolean,boolean,text,text,text,text,text,text)', 'execute')$$,
  array[true],
  'service_role can execute submit_lead_intake'
);

-- The function is still its own trust boundary.
select is(
  (select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'submit_lead_intake'),
  true,
  'submit_lead_intake is still SECURITY DEFINER'
);
select ok(
  (select array_to_string(proconfig, ',') from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'submit_lead_intake')
    like '%search_path=%',
  'and still pins an empty search_path'
);

-- ---------------------------------------------------------------------------
-- The same caller shape suite 48 uses, so a difference in outcome is a
-- difference in the function rather than in how it was asked.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.try_intake(
  p_seed text,
  p_planner text,
  p_service text,
  p_property text,
  p_timeline text,
  p_rooms text[],
  p_budget text,
  p_estimate jsonb,
  p_qkind text,
  p_qcode text
) returns text
language plpgsql
as $$
declare
  v_outcome text;
begin
  select outcome into v_outcome from public.submit_lead_intake(
    p_idempotency_key => ('00000000-0000-4000-8000-' || lpad(p_seed, 12, '0'))::uuid,
    p_request_hash => repeat(substr(md5(p_seed), 1, 1), 64),
    p_network_fingerprint_hash => repeat(substr(md5(p_seed || 'n'), 1, 1), 64),
    p_phone_fingerprint_hash => repeat(substr(md5(p_seed || 'p'), 1, 1), 64),
    p_planner_version => p_planner,
    p_submitted_name => 'V2 Synthetic Case',
    p_phone_e164 => '+9198' || lpad(p_seed, 8, '0'),
    p_submitted_email => null,
    p_service_code => p_service,
    p_property_code => p_property,
    p_timeline_code => p_timeline,
    p_room_codes => p_rooms,
    p_budget_comfort_code => p_budget,
    p_estimate_snapshot => p_estimate,
    p_locality => null,
    p_message => null,
    p_landing_path => '/',
    p_attribution => '{}'::jsonb,
    p_source => 'local-test',
    p_consent_service_enquiry => true,
    p_consent_service_phone => true,
    p_consent_service_email => false,
    p_consent_whatsapp => false,
    p_copy_service_enquiry => 'service-enquiry-v0.1-draft',
    p_copy_service_communication => 'service-communication-v0.1-draft',
    p_copy_whatsapp => null,
    p_notice_version => 'privacy-notice-v0.1-draft',
    p_qualifier_kind => p_qkind,
    p_qualifier_code => p_qcode
  );
  return v_outcome;
exception when others then
  return 'REJECTED:' || sqlerrm;
end;
$$;

-- ---------------------------------------------------------------------------
-- v2 is accepted at all — the whole point of the migration
-- ---------------------------------------------------------------------------
select is(
  pg_temp.try_intake('201', 'public-consult-v2', 'modular-kitchens', null, null, null, null, null, null, null),
  'created',
  'a single-step v2 request with no qualifier is ACCEPTED'
);
select is(
  pg_temp.try_intake('202', 'public-consult-v2', 'complete-home-interiors', null, null, array[]::text[], null, null, null, null),
  'created',
  'an explicitly empty room array is accepted too'
);

-- ---------------------------------------------------------------------------
-- v1 is untouched. If these ever start passing without a qualifier, v1 has
-- been redefined underneath the rows that already depend on it.
-- ---------------------------------------------------------------------------
select matches(
  pg_temp.try_intake('203', 'public-consult-v1', 'modular-kitchens', null, null, null, null, null, null, null),
  '^REJECTED:validation: qualifier_required',
  'v1 STILL requires a qualifier'
);
select is(
  pg_temp.try_intake('204', 'public-consult-v1', 'modular-kitchens', null, null, null, null, null, 'kitchen-scope', 'new-kitchen'),
  'created',
  'and v1 with its qualifier is still accepted'
);
select matches(
  pg_temp.try_intake('205', 'public-consult-v1', 'custom-wardrobes', null, null, null, null, null, 'home-size', 'apartment-3bhk'),
  '^REJECTED:validation: qualifier_service_mismatch',
  'a wardrobe enquiry still cannot carry a BHK under v1'
);
select matches(
  pg_temp.try_intake('206', 'public-consult-v1', 'modular-kitchens', null, 'immediate', null, null, null, 'kitchen-scope', 'new-kitchen'),
  '^REJECTED:validation: timeline_not_asked',
  'v1 still refuses a timeline it never asked for'
);
select matches(
  pg_temp.try_intake('207', 'public-consult-v1', 'modular-kitchens', null, null, array['kitchen']::text[], null, null, 'kitchen-scope', 'new-kitchen'),
  '^REJECTED:validation: rooms_not_asked',
  'v1 still refuses rooms'
);
select matches(
  pg_temp.try_intake('208', 'public-consult-v1', 'modular-kitchens', null, null, null, '6-12l', null, 'kitchen-scope', 'new-kitchen'),
  '^REJECTED:validation: budget_not_asked',
  'v1 still refuses a budget band'
);
select matches(
  pg_temp.try_intake('209', 'public-consult-v1', 'modular-kitchens', null, null, null, null, '{"total": 1}'::jsonb, 'kitchen-scope', 'new-kitchen'),
  '^REJECTED:validation: estimate_not_asked',
  'v1 still refuses an estimate'
);

-- ---------------------------------------------------------------------------
-- v2 refuses EVERY answer its form never showed.
--
-- Rejected rather than ignored: a value that was never on screen came from a
-- stale or tampered client, and silently dropping it would let the caller
-- believe it was stored.
-- ---------------------------------------------------------------------------
select matches(
  pg_temp.try_intake('210', 'public-consult-v2', 'modular-kitchens', null, null, null, null, null, 'kitchen-scope', 'new-kitchen'),
  '^REJECTED:validation: qualifier_not_asked',
  'v2 refuses a qualifier — even a perfectly valid one'
);
select matches(
  pg_temp.try_intake('211', 'public-consult-v2', 'complete-home-interiors', 'apartment-3bhk', null, null, null, null, null, null),
  '^REJECTED:validation: property_not_asked',
  'v2 refuses a property'
);
select matches(
  pg_temp.try_intake('212', 'public-consult-v2', 'modular-kitchens', null, 'immediate', null, null, null, null, null),
  '^REJECTED:validation: timeline_not_asked',
  'v2 refuses a timeline'
);
select matches(
  pg_temp.try_intake('213', 'public-consult-v2', 'modular-kitchens', null, null, array['kitchen']::text[], null, null, null, null),
  '^REJECTED:validation: rooms_not_asked',
  'v2 refuses rooms'
);
select matches(
  pg_temp.try_intake('214', 'public-consult-v2', 'modular-kitchens', null, null, null, '6-12l', null, null, null),
  '^REJECTED:validation: budget_not_asked',
  'v2 refuses a budget band'
);
select matches(
  pg_temp.try_intake('215', 'public-consult-v2', 'modular-kitchens', null, null, null, null, '{"total": 1}'::jsonb, null, null),
  '^REJECTED:validation: estimate_not_asked',
  'v2 refuses an estimate'
);

-- The service is still required and still allowlisted.
select matches(
  pg_temp.try_intake('216', 'public-consult-v2', 'made-up-service', null, null, null, null, null, null, null),
  '^REJECTED:validation: service_code',
  'v2 refuses a service outside the allowlist'
);
-- A NULL service does not trip the `not in (...)` allowlist — `null not in (…)`
-- is NULL, not true — so it is refused further down instead. What matters is
-- that it never becomes a row, so the assertion is on the refusal rather than
-- on which line catches it.
select matches(
  pg_temp.try_intake('217', 'public-consult-v2', null, null, null, null, null, null, null, null),
  '^REJECTED:',
  'v2 refuses a missing service'
);

-- An unknown version is still refused, so v2 was ADDED rather than the
-- allowlist being opened.
select matches(
  pg_temp.try_intake('218', 'public-consult-v3', 'modular-kitchens', null, null, null, null, null, null, null),
  '^REJECTED:validation: planner_version',
  'an unknown planner version is still refused'
);

-- ---------------------------------------------------------------------------
-- What a v2 row actually stores. Nothing fabricated.
-- ---------------------------------------------------------------------------
select results_eq(
  $$select planner_version, property_code, timeline_code, qualifier_kind, qualifier_code
      from public.leads
     where submitted_name = 'V2 Synthetic Case'
       and planner_version = 'public-consult-v2'
       and service_code = 'modular-kitchens'$$,
  $$values ('public-consult-v2'::text, null::text, null::text, null::text, null::text)$$,
  'a v2 row stores its service and NOTHING invented'
);
select results_eq(
  $$select coalesce(cardinality(room_codes), 0) from public.leads
     where submitted_name = 'V2 Synthetic Case'
       and planner_version = 'public-consult-v2'
       and service_code = 'modular-kitchens'$$,
  array[0],
  'and no rooms were conjured to fill the column'
);
select is(
  (select count(*)::integer from public.leads
    where submitted_name = 'V2 Synthetic Case'
      and planner_version = 'public-consult-v2'),
  2,
  'both accepted v2 requests landed as real rows'
);

select * from finish();
rollback;
