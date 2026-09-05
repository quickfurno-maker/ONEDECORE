-- ONEDECORE - public consultation qualifier: the SQL trust boundary.
--
-- `submit_lead_intake` is SECURITY DEFINER, so it is its own trust boundary and
-- must enforce the planner-version discriminator itself rather than rely on the
-- TypeScript route that normally calls it.
--
-- Making property_code/timeline_code nullable is what the public form needs.
-- The risk is that the same change quietly lets the LEGACY planner omit answers
-- it really does collect, or lets the public variant carry answers it never
-- asked for. These tests hold both halves.

begin;
select plan(27);

-- ---------------------------------------------------------------------------
-- Privileges (kept from the previous definition through drop/recreate)
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

-- ---------------------------------------------------------------------------
-- Schema: truthful absence
-- ---------------------------------------------------------------------------
select col_is_null('public', 'leads', 'property_code', 'property_code is nullable');
select col_is_null('public', 'leads', 'timeline_code', 'timeline_code is nullable');
select has_column('public', 'leads', 'qualifier_kind', 'qualifier_kind exists');
select has_column('public', 'leads', 'qualifier_code', 'qualifier_code exists');

-- ---------------------------------------------------------------------------
-- A reusable caller. Each case gets its own idempotency key / hashes / phone so
-- the intake dedupe never masks a validation result.
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
    p_submitted_name => 'Synthetic Case',
    p_phone_e164 => '+9199' || lpad(p_seed, 8, '0'),
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
-- Planner version allowlist
-- ---------------------------------------------------------------------------
select matches(
  pg_temp.try_intake('101', 'made-up-v9', 'modular-kitchens', null, null, null, null, null, 'kitchen-scope', 'new-kitchen'),
  '^REJECTED:validation: planner_version',
  'an unknown planner version is refused'
);

-- ---------------------------------------------------------------------------
-- LEGACY home-r4-v1 stays strict
-- ---------------------------------------------------------------------------
select matches(
  pg_temp.try_intake('102', 'home-r4-v1', 'modular-kitchens', null, 'immediate', array['kitchen']::text[], null, null, null, null),
  '^REJECTED:validation: property_code',
  'legacy with a null property is refused'
);
select matches(
  pg_temp.try_intake('103', 'home-r4-v1', 'modular-kitchens', 'apartment-2bhk', null, array['kitchen']::text[], null, null, null, null),
  '^REJECTED:validation: timeline_code',
  'legacy with a null timeline is refused'
);
select matches(
  pg_temp.try_intake('104', 'home-r4-v1', 'modular-kitchens', 'apartment-2bhk', 'immediate', array['kitchen']::text[], null, null, 'kitchen-scope', 'new-kitchen'),
  '^REJECTED:validation: qualifier_not_allowed',
  'legacy carrying a qualifier is refused'
);
select is(
  pg_temp.try_intake('105', 'home-r4-v1', 'modular-kitchens', 'apartment-2bhk', 'immediate', array['kitchen']::text[], null, null, null, null),
  'created',
  'a valid legacy request is still accepted'
);

-- ---------------------------------------------------------------------------
-- PUBLIC public-consult-v1 asks one question and refuses the rest
-- ---------------------------------------------------------------------------
select matches(
  pg_temp.try_intake('106', 'public-consult-v1', 'modular-kitchens', null, null, null, null, null, null, null),
  '^REJECTED:validation: qualifier_required',
  'public consult without a qualifier is refused'
);
select matches(
  pg_temp.try_intake('107', 'public-consult-v1', 'modular-kitchens', null, null, null, null, null, 'home-size', 'apartment-2bhk'),
  '^REJECTED:validation: qualifier_service_mismatch',
  'a kitchen enquiry carrying a BHK qualifier is refused'
);
select matches(
  pg_temp.try_intake('108', 'public-consult-v1', 'custom-wardrobes', null, null, null, null, null, 'kitchen-scope', 'new-kitchen'),
  '^REJECTED:validation: qualifier_service_mismatch',
  'a wardrobe enquiry carrying a kitchen qualifier is refused'
);
select matches(
  pg_temp.try_intake('109', 'public-consult-v1', 'modular-kitchens', null, 'immediate', null, null, null, 'kitchen-scope', 'new-kitchen'),
  '^REJECTED:validation: timeline_not_asked',
  'public consult carrying a timeline is refused'
);
select matches(
  pg_temp.try_intake('110', 'public-consult-v1', 'modular-kitchens', null, null, array['kitchen']::text[], null, null, 'kitchen-scope', 'new-kitchen'),
  '^REJECTED:validation: rooms_not_asked',
  'public consult carrying rooms is refused'
);
select matches(
  pg_temp.try_intake('111', 'public-consult-v1', 'modular-kitchens', null, null, null, '6-12l', null, 'kitchen-scope', 'new-kitchen'),
  '^REJECTED:validation: budget_not_asked',
  'public consult carrying a budget is refused'
);
select matches(
  pg_temp.try_intake('112', 'public-consult-v1', 'modular-kitchens', null, null, null, null, '{"x":1}'::jsonb, 'kitchen-scope', 'new-kitchen'),
  '^REJECTED:validation: estimate_not_asked',
  'public consult carrying an estimate is refused'
);

-- ---------------------------------------------------------------------------
-- property_code must be exactly what the qualifier implies
-- ---------------------------------------------------------------------------
select is(
  pg_temp.try_intake('113', 'public-consult-v1', 'complete-home-interiors', 'apartment-3bhk', null, null, null, null, 'home-size', 'apartment-3bhk'),
  'created',
  'complete-home BHK qualifier with the MATCHING property is accepted'
);
select matches(
  pg_temp.try_intake('114', 'public-consult-v1', 'complete-home-interiors', 'apartment-1bhk', null, null, null, null, 'home-size', 'apartment-3bhk'),
  '^REJECTED:validation: property_qualifier_mismatch',
  'complete-home property disagreeing with its qualifier is refused'
);
select matches(
  pg_temp.try_intake('115', 'public-consult-v1', 'complete-home-interiors', 'apartment-2bhk', null, null, null, null, 'home-size', 'unsure'),
  '^REJECTED:validation: property_qualifier_mismatch',
  'an UNSURE home size carrying a property is refused'
);
select matches(
  pg_temp.try_intake('116', 'public-consult-v1', 'modular-kitchens', 'apartment-2bhk', null, null, null, null, 'kitchen-scope', 'new-kitchen'),
  '^REJECTED:validation: property_qualifier_mismatch',
  'a kitchen enquiry carrying a property is refused'
);
select is(
  pg_temp.try_intake('117', 'public-consult-v1', 'modular-kitchens', null, null, null, null, null, 'kitchen-scope', 'renovate-existing'),
  'created',
  'a kitchen enquiry with a null property is accepted'
);
select is(
  pg_temp.try_intake('118', 'public-consult-v1', 'custom-wardrobes', null, null, null, null, null, 'wardrobe-count', 'three'),
  'created',
  'a wardrobe enquiry with a null property is accepted'
);

-- ---------------------------------------------------------------------------
-- What was actually stored
-- ---------------------------------------------------------------------------
select results_eq(
  $$select service_code, property_code, timeline_code, qualifier_kind, qualifier_code
      from public.leads where submitted_name = 'Synthetic Case'
       and qualifier_code = 'renovate-existing'$$,
  $$values ('modular-kitchens', null::text, null::text, 'kitchen-scope', 'renovate-existing')$$,
  'a kitchen lead stores its real answer and NO invented property or timeline'
);
select results_eq(
  $$select property_code, qualifier_code from public.leads
      where submitted_name = 'Synthetic Case' and qualifier_kind = 'home-size'$$,
  $$values ('apartment-3bhk'::text, 'apartment-3bhk'::text)$$,
  'a complete-home lead stores the property the customer actually chose'
);

select * from finish();
rollback;
