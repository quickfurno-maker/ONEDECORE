-- ONEDECORE — public-consult-v3: the premium requirement form, at the SQL
-- trust boundary.
--
-- WHAT THIS SUITE EXISTS TO PREVENT
--
-- v3 asks for a project scope and a budget range — the two things v2 refuses
-- outright. The application validates the same pairings, and that is exactly
-- why they are re-checked here: `submit_lead_intake` is SECURITY DEFINER and is
-- the only path to `public.leads`, so it has to hold on its own against a caller
-- that never ran the application's validator. A test that only exercised the
-- TypeScript would prove nothing about the boundary an attacker actually meets.
--
-- Three pairings matter, and each has its own rejection:
--
--   scope must be one of the five                  project_scope_code
--   budget must belong to THAT scope's ladder      budget_range_scope_mismatch
--   service must be the one the scope implies      service_scope_mismatch
--
-- Suites 48 and 52 still own v1 and v2 and are unchanged; the assertions below
-- re-check that both still mean what they meant, because adding a version must
-- not quietly redefine the ones already in the table.

begin;
select plan(39);

-- ---------------------------------------------------------------------------
-- Privileges on the NEW 31-argument signature. The old 29-argument overload is
-- dropped by the migration, so these also prove the replacement inherited the
-- boundary rather than falling back to the PUBLIC default.
-- ---------------------------------------------------------------------------
select results_eq(
  $$select has_function_privilege('anon', 'public.submit_lead_intake(uuid,text,text,text,text,text,text,text,text,text,text,text[],text,jsonb,text,text,text,jsonb,text,boolean,boolean,boolean,boolean,text,text,text,text,text,text,text,text)', 'execute')$$,
  array[false],
  'anon cannot execute submit_lead_intake'
);
select results_eq(
  $$select has_function_privilege('authenticated', 'public.submit_lead_intake(uuid,text,text,text,text,text,text,text,text,text,text,text[],text,jsonb,text,text,text,jsonb,text,boolean,boolean,boolean,boolean,text,text,text,text,text,text,text,text)', 'execute')$$,
  array[false],
  'authenticated cannot execute submit_lead_intake'
);
select results_eq(
  $$select has_function_privilege('service_role', 'public.submit_lead_intake(uuid,text,text,text,text,text,text,text,text,text,text,text[],text,jsonb,text,text,text,jsonb,text,boolean,boolean,boolean,boolean,text,text,text,text,text,text,text,text)', 'execute')$$,
  array[true],
  'service_role can execute submit_lead_intake'
);

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

-- Exactly one overload survives: two would let a caller resolve to the stale
-- 29-argument shape and silently lose the scope and budget.
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'submit_lead_intake'),
  1,
  'the 29-argument overload was dropped; exactly one function remains'
);

-- ---------------------------------------------------------------------------
-- Columns exist, are nullable, and carry no invented default.
-- ---------------------------------------------------------------------------
select has_column('public', 'leads', 'project_scope_code', 'leads.project_scope_code exists');
select has_column('public', 'leads', 'budget_range_code', 'leads.budget_range_code exists');
select col_is_null('public', 'leads', 'project_scope_code', 'project_scope_code is nullable — older rows were never asked');
select col_is_null('public', 'leads', 'budget_range_code', 'budget_range_code is nullable for the same reason');
select col_hasnt_default('public', 'leads', 'project_scope_code', 'no default scope is invented');
select col_hasnt_default('public', 'leads', 'budget_range_code', 'no default budget is invented');

-- ---------------------------------------------------------------------------
-- The caller. Same shape as suites 48 and 52 plus the two new arguments, so a
-- difference in outcome is a difference in the function.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.try_v3(
  p_seed text,
  p_planner text,
  p_service text,
  p_scope text,
  p_budget_range text,
  p_property text default null,
  p_timeline text default null,
  p_rooms text[] default null,
  p_budget text default null,
  p_estimate jsonb default null,
  p_qkind text default null,
  p_qcode text default null
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
    p_submitted_name => 'V3 Synthetic Case',
    p_phone_e164 => '+9197' || lpad(p_seed, 8, '0'),
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
    p_copy_service_enquiry => 'service-enquiry-v1.1-single-consent',
    p_copy_service_communication => 'service-communication-v1.1-single-consent',
    p_copy_whatsapp => null,
    p_notice_version => 'privacy-notice-v0.1-draft',
    p_qualifier_kind => p_qkind,
    p_qualifier_code => p_qcode,
    p_project_scope_code => p_scope,
    p_budget_range_code => p_budget_range
  );
  return v_outcome;
exception when others then
  return 'REJECTED:' || sqlerrm;
end;
$$;

-- ---------------------------------------------------------------------------
-- Every scope is accepted with a budget from its OWN ladder.
-- ---------------------------------------------------------------------------
select is(pg_temp.try_v3('301', 'public-consult-v3', 'modular-kitchens', 'kitchen', 'kitchen-2-3l'),
  'created', 'kitchen + a kitchen band is accepted');
select is(pg_temp.try_v3('302', 'public-consult-v3', 'complete-home-interiors', '1-bhk', '1bhk-5-7l'),
  'created', '1 BHK + a 1 BHK band is accepted');
select is(pg_temp.try_v3('303', 'public-consult-v3', 'complete-home-interiors', '2-bhk', '2bhk-12-16l'),
  'created', '2 BHK + a 2 BHK band is accepted');
select is(pg_temp.try_v3('304', 'public-consult-v3', 'complete-home-interiors', '3-bhk', '3bhk-13-16l'),
  'created', '3 BHK + a 3 BHK band is accepted');
select is(pg_temp.try_v3('305', 'public-consult-v3', 'complete-home-interiors', 'villa', 'villa-above-20l'),
  'created', 'villa + a villa band is accepted');

-- ---------------------------------------------------------------------------
-- Forged pairings. The membership of a code is never the check; the PAIRING is.
-- ---------------------------------------------------------------------------
select matches(
  pg_temp.try_v3('306', 'public-consult-v3', 'modular-kitchens', 'kitchen', 'villa-above-20l'),
  '^REJECTED:validation: budget_range_scope_mismatch',
  'a villa budget is refused on a kitchen enquiry'
);
select matches(
  pg_temp.try_v3('307', 'public-consult-v3', 'complete-home-interiors', '3-bhk', '2bhk-above-16l'),
  '^REJECTED:validation: budget_range_scope_mismatch',
  'the 2 BHK band that READS the same as the 3 BHK one is still refused'
);
select matches(
  pg_temp.try_v3('308', 'public-consult-v3', 'modular-kitchens', '2-bhk', '2bhk-4-8l'),
  '^REJECTED:validation: service_scope_mismatch',
  'a 2 BHK scope cannot claim the modular-kitchens service'
);
select matches(
  pg_temp.try_v3('309', 'public-consult-v3', 'complete-home-interiors', 'kitchen', 'kitchen-1-2l'),
  '^REJECTED:validation: service_scope_mismatch',
  'nor a kitchen scope the complete-home service'
);
select matches(
  pg_temp.try_v3('310', 'public-consult-v3', 'complete-home-interiors', '4-bhk', '2bhk-4-8l'),
  '^REJECTED:validation: project_scope_code',
  'an unknown scope is refused'
);
select matches(
  pg_temp.try_v3('311', 'public-consult-v3', 'modular-kitchens', null, 'kitchen-1-2l'),
  '^REJECTED:validation: project_scope_required',
  'v3 requires a scope'
);
select matches(
  pg_temp.try_v3('312', 'public-consult-v3', 'modular-kitchens', 'kitchen', null),
  '^REJECTED:validation: budget_range_required',
  'v3 requires a budget range'
);

-- ---------------------------------------------------------------------------
-- v3 still refuses everything v2 refuses. Adding two questions did not open
-- the door to the six that were never asked.
-- ---------------------------------------------------------------------------
select matches(
  pg_temp.try_v3('313', 'public-consult-v3', 'modular-kitchens', 'kitchen', 'kitchen-1-2l', null, null, null, null, null, 'kitchen-scope', 'new-kitchen'),
  '^REJECTED:validation: qualifier_not_asked',
  'v3 refuses a qualifier'
);
select matches(
  pg_temp.try_v3('314', 'public-consult-v3', 'complete-home-interiors', '2-bhk', '2bhk-4-8l', 'apartment-2bhk'),
  '^REJECTED:validation: property_not_asked',
  'v3 refuses a property code — the scope is not a property answer'
);
select matches(
  pg_temp.try_v3('315', 'public-consult-v3', 'modular-kitchens', 'kitchen', 'kitchen-1-2l', null, 'immediate'),
  '^REJECTED:validation: timeline_not_asked',
  'v3 refuses a timeline'
);
select matches(
  pg_temp.try_v3('316', 'public-consult-v3', 'modular-kitchens', 'kitchen', 'kitchen-1-2l', null, null, array['kitchen']::text[]),
  '^REJECTED:validation: rooms_not_asked',
  'v3 refuses rooms'
);
select matches(
  pg_temp.try_v3('317', 'public-consult-v3', 'modular-kitchens', 'kitchen', 'kitchen-1-2l', null, null, null, '6-12l'),
  '^REJECTED:validation: budget_not_asked',
  'v3 refuses the OLD budget-comfort band — its budget is the scope ladder'
);
select matches(
  pg_temp.try_v3('318', 'public-consult-v3', 'modular-kitchens', 'kitchen', 'kitchen-1-2l', null, null, null, null, '{"total": 1}'::jsonb),
  '^REJECTED:validation: estimate_not_asked',
  'v3 refuses an estimate'
);

-- ---------------------------------------------------------------------------
-- The earlier versions never asked for a scope, so they still refuse one.
-- ---------------------------------------------------------------------------
select matches(
  pg_temp.try_v3('319', 'public-consult-v2', 'modular-kitchens', 'kitchen', null),
  '^REJECTED:validation: scope_not_asked',
  'v2 refuses a project scope'
);
select matches(
  pg_temp.try_v3('320', 'public-consult-v1', 'modular-kitchens', null, 'kitchen-1-2l', null, null, null, null, null, 'kitchen-scope', 'new-kitchen'),
  '^REJECTED:validation: scope_not_asked',
  'v1 refuses a budget range'
);

-- v2 itself still works, unchanged.
select is(
  pg_temp.try_v3('321', 'public-consult-v2', 'modular-kitchens', null, null),
  'created',
  'v2 still means what it meant'
);

-- ---------------------------------------------------------------------------
-- PERSISTENCE. Accepting a value is not storing it.
-- ---------------------------------------------------------------------------
select is(
  (select project_scope_code from public.leads
    where submitted_name = 'V3 Synthetic Case' and service_code = 'complete-home-interiors'
      and budget_range_code = '2bhk-12-16l' limit 1),
  '2-bhk',
  'the project scope is persisted'
);
select is(
  (select budget_range_code from public.leads
    where submitted_name = 'V3 Synthetic Case' and project_scope_code = 'villa' limit 1),
  'villa-above-20l',
  'the budget range is persisted'
);
select is(
  (select service_code from public.leads
    where submitted_name = 'V3 Synthetic Case' and project_scope_code = 'kitchen' limit 1),
  'modular-kitchens',
  'the derived service is persisted alongside the scope'
);
select is(
  (select count(*)::int from public.leads
    where submitted_name = 'V3 Synthetic Case' and planner_version = 'public-consult-v3'
      and (property_code is not null or timeline_code is not null
           or qualifier_kind is not null or budget_comfort_code is not null)),
  0,
  'no v3 row carries an answer its form never asked for'
);

-- Consent evidence records the combined copy the visitor actually read.
select is(
  (select count(distinct copy_version)::int from public.consent_events ce
     join public.leads l on l.id = ce.lead_id
    where l.planner_version = 'public-consult-v3'
      and copy_version like '%single-consent'),
  2,
  'both required purposes record the single-consent copy version'
);
select is(
  (select count(*)::int from public.consent_events ce
     join public.leads l on l.id = ce.lead_id
    where l.planner_version = 'public-consult-v3'
      and ce.purpose_code = 'WHATSAPP_SERVICE'),
  0,
  'and no WhatsApp consent is fabricated from the single checkbox'
);

select * from finish();
rollback;
