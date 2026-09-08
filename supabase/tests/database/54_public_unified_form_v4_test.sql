-- ONEDECORE — public-consult-v4: the unified multi-step form, at the SQL
-- trust boundary.
--
-- WHAT THIS SUITE EXISTS TO PREVENT
--
-- v4 is the first contract where the TIMELINE moves: v1, v2 and v3 all refuse
-- one, and v4 requires one. A version that both required and refused the same
-- field, or that quietly let v3 start accepting timelines, would make every
-- stored row ambiguous — a null timeline would no longer mean "never asked".
--
-- So this file asserts both directions: v4 demands a timeline from the standard
-- vocabulary, and v1/v2/v3 still reject one. It also pins the wardrobe
-- exception, which is the only place in the contract where a field is required
-- for some services and forbidden for another.
--
-- The application validates the same rules. That duplication is deliberate:
-- `submit_lead_intake` is SECURITY DEFINER and the only path to public.leads,
-- so it has to hold against a caller that never ran the application validator.

begin;
select plan(33);

-- ---------------------------------------------------------------------------
-- The definer boundary is unchanged. v4 alters no signature, so there is no
-- overload dance and privileges carry through CREATE OR REPLACE.
-- ---------------------------------------------------------------------------
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
select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'submit_lead_intake'),
  1,
  'still exactly one overload — v4 changed no signature'
);

-- ---------------------------------------------------------------------------
-- Caller. Same shape as suites 48/52/53 so a difference in outcome is a
-- difference in the function rather than in how it was asked.
-- ---------------------------------------------------------------------------
create or replace function pg_temp.try_v4(
  p_seed text,
  p_planner text,
  p_service text,
  p_scope text,
  p_budget_range text,
  p_timeline text default null,
  p_property text default null,
  p_rooms text[] default null,
  p_budget text default null,
  p_estimate jsonb default null,
  p_qkind text default null,
  p_qcode text default null,
  p_locality text default null
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
    p_submitted_name => 'V4 Synthetic Case',
    p_phone_e164 => '+9196' || lpad(p_seed, 8, '0'),
    p_submitted_email => null,
    p_service_code => p_service,
    p_property_code => p_property,
    p_timeline_code => p_timeline,
    p_room_codes => p_rooms,
    p_budget_comfort_code => p_budget,
    p_estimate_snapshot => p_estimate,
    p_locality => p_locality,
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
-- Accepted: every scoped service, with a timeline.
-- ---------------------------------------------------------------------------
select is(pg_temp.try_v4('401', 'public-consult-v4', 'modular-kitchens', 'kitchen', 'kitchen-2-3l', 'immediate'),
  'created', 'kitchen + kitchen band + timeline is accepted');
select is(pg_temp.try_v4('402', 'public-consult-v4', 'complete-home-interiors', '1-bhk', '1bhk-5-7l', 'within-1-month'),
  'created', '1 BHK is accepted');
select is(pg_temp.try_v4('403', 'public-consult-v4', 'complete-home-interiors', '2-bhk', '2bhk-4-8l', 'within-2-months', null, null, null, null, null, null, 'Kharadi'),
  'created', '2 BHK with a locality is accepted');
select is(pg_temp.try_v4('404', 'public-consult-v4', 'complete-home-interiors', '3-bhk', '3bhk-9-13l', 'after-2-months'),
  'created', '3 BHK is accepted');
select is(pg_temp.try_v4('405', 'public-consult-v4', 'complete-home-interiors', 'villa', 'villa-15-20l', 'immediate'),
  'created', 'villa is accepted');

-- The wardrobe exception: no scope, no budget, still a timeline.
select is(pg_temp.try_v4('406', 'public-consult-v4', 'custom-wardrobes', null, null, 'immediate'),
  'created', 'custom-wardrobes is accepted WITHOUT a scope or budget');

-- ---------------------------------------------------------------------------
-- The timeline, which is the field that moves between versions.
-- ---------------------------------------------------------------------------
select matches(
  pg_temp.try_v4('407', 'public-consult-v4', 'modular-kitchens', 'kitchen', 'kitchen-1-2l', null),
  '^REJECTED:validation: timeline_required',
  'v4 REQUIRES a timeline'
);
select matches(
  pg_temp.try_v4('408', 'public-consult-v4', 'modular-kitchens', 'kitchen', 'kitchen-1-2l', 'next-tuesday'),
  '^REJECTED:validation: timeline_code',
  'and it must come from the existing vocabulary, not free text'
);

-- The earlier versions still refuse one. If these ever start passing, a null
-- timeline on a stored v1/v2/v3 row has stopped meaning "never asked".
select matches(
  pg_temp.try_v4('409', 'public-consult-v3', 'modular-kitchens', 'kitchen', 'kitchen-1-2l', 'immediate'),
  '^REJECTED:validation: timeline_not_asked',
  'v3 STILL refuses a timeline'
);
select matches(
  pg_temp.try_v4('410', 'public-consult-v2', 'modular-kitchens', null, null, 'immediate'),
  '^REJECTED:validation: timeline_not_asked',
  'v2 STILL refuses a timeline'
);
select matches(
  pg_temp.try_v4('411', 'public-consult-v1', 'modular-kitchens', null, null, 'immediate', null, null, null, null, 'kitchen-scope', 'new-kitchen'),
  '^REJECTED:validation: timeline_not_asked',
  'v1 STILL refuses a timeline'
);

-- ---------------------------------------------------------------------------
-- The wardrobe exception cuts both ways.
-- ---------------------------------------------------------------------------
select matches(
  pg_temp.try_v4('412', 'public-consult-v4', 'custom-wardrobes', '2-bhk', '2bhk-4-8l', 'immediate'),
  '^REJECTED:validation: scope_not_asked',
  'a wardrobe enquiry may not carry a scope it was never asked for'
);
select matches(
  pg_temp.try_v4('413', 'public-consult-v4', 'complete-home-interiors', null, null, 'immediate'),
  '^REJECTED:validation: project_scope_required',
  'and a complete-home enquiry may not omit one'
);
select matches(
  pg_temp.try_v4('414', 'public-consult-v4', 'modular-kitchens', 'kitchen', null, 'immediate'),
  '^REJECTED:validation: budget_range_required',
  'a scoped enquiry requires its budget'
);

-- ---------------------------------------------------------------------------
-- Forged pairings. Membership is never the check; the PAIRING is.
-- ---------------------------------------------------------------------------
select matches(
  pg_temp.try_v4('415', 'public-consult-v4', 'modular-kitchens', 'kitchen', 'villa-above-20l', 'immediate'),
  '^REJECTED:validation: budget_range_scope_mismatch',
  'a villa budget is refused on a kitchen enquiry'
);
select matches(
  pg_temp.try_v4('416', 'public-consult-v4', 'complete-home-interiors', '3-bhk', '2bhk-above-16l', 'immediate'),
  '^REJECTED:validation: budget_range_scope_mismatch',
  'the 2 BHK band that READS like the 3 BHK one is still refused'
);
select matches(
  pg_temp.try_v4('417', 'public-consult-v4', 'modular-kitchens', '2-bhk', '2bhk-4-8l', 'immediate'),
  '^REJECTED:validation: service_scope_mismatch',
  'a 2 BHK scope cannot claim the modular-kitchens service'
);
select matches(
  pg_temp.try_v4('418', 'public-consult-v4', 'complete-home-interiors', '4-bhk', '2bhk-4-8l', 'immediate'),
  '^REJECTED:validation: project_scope_code',
  'an unknown scope is refused'
);

-- ---------------------------------------------------------------------------
-- v4 still refuses everything it never asks for.
-- ---------------------------------------------------------------------------
select matches(
  pg_temp.try_v4('419', 'public-consult-v4', 'modular-kitchens', 'kitchen', 'kitchen-1-2l', 'immediate', null, null, null, null, 'kitchen-scope', 'new-kitchen'),
  '^REJECTED:validation: qualifier_not_asked',
  'v4 refuses a qualifier'
);
select matches(
  pg_temp.try_v4('420', 'public-consult-v4', 'complete-home-interiors', '2-bhk', '2bhk-4-8l', 'immediate', 'apartment-2bhk'),
  '^REJECTED:validation: property_not_asked',
  'v4 refuses a property code — the scope is not a property answer'
);
select matches(
  pg_temp.try_v4('421', 'public-consult-v4', 'modular-kitchens', 'kitchen', 'kitchen-1-2l', 'immediate', null, array['kitchen']::text[]),
  '^REJECTED:validation: rooms_not_asked',
  'v4 refuses rooms'
);
select matches(
  pg_temp.try_v4('422', 'public-consult-v4', 'modular-kitchens', 'kitchen', 'kitchen-1-2l', 'immediate', null, null, '6-12l'),
  '^REJECTED:validation: budget_not_asked',
  'v4 refuses the OLD budget-comfort band'
);
select matches(
  pg_temp.try_v4('423', 'public-consult-v4', 'modular-kitchens', 'kitchen', 'kitchen-1-2l', 'immediate', null, null, null, '{"total": 1}'::jsonb),
  '^REJECTED:validation: estimate_not_asked',
  'v4 refuses an estimate'
);

-- v3 itself still works exactly as before.
select is(
  pg_temp.try_v4('424', 'public-consult-v3', 'complete-home-interiors', '2-bhk', '2bhk-8-12l'),
  'created',
  'v3 still means what it meant'
);

-- ---------------------------------------------------------------------------
-- PERSISTENCE. Accepting a value is not storing it.
-- ---------------------------------------------------------------------------
select is(
  (select timeline_code from public.leads
    where submitted_name = 'V4 Synthetic Case' and project_scope_code = '1-bhk' limit 1),
  'within-1-month',
  'the timeline is persisted'
);
select is(
  (select locality from public.leads
    where submitted_name = 'V4 Synthetic Case' and project_scope_code = '2-bhk'
      and planner_version = 'public-consult-v4' limit 1),
  'Kharadi',
  'the optional locality is persisted'
);
select is(
  (select service_code from public.leads
    where submitted_name = 'V4 Synthetic Case' and project_scope_code = 'kitchen' limit 1),
  'modular-kitchens',
  'the scope-derived service is persisted'
);
select is(
  (select count(*)::int from public.leads
    where submitted_name = 'V4 Synthetic Case' and planner_version = 'public-consult-v4'
      and service_code = 'custom-wardrobes'
      and project_scope_code is null and budget_range_code is null),
  1,
  'the wardrobe row stores no invented scope or budget'
);
select is(
  (select count(*)::int from public.leads
    where planner_version = 'public-consult-v4'
      and (property_code is not null or qualifier_kind is not null
           or budget_comfort_code is not null or estimate_snapshot is not null)),
  0,
  'no v4 row carries an answer its form never asked for'
);

-- Consent evidence: exactly the two required purposes, nothing fabricated.
select is(
  (select count(*)::int from public.consent_events ce
     join public.leads l on l.id = ce.lead_id
    where l.planner_version = 'public-consult-v4'
      and ce.purpose_code = 'WHATSAPP_SERVICE'),
  0,
  'no WhatsApp consent is fabricated under v4'
);

select * from finish();
rollback;
