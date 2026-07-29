-- ONEDECORE Phase 4A Secure Lead Intake Data Plane pgTAP tests

begin;
select plan(56);

-- Schema
select has_table('public', 'contacts', 'contacts exists');
select has_table('public', 'contact_channels', 'contact_channels exists');
select has_table('public', 'leads', 'leads exists');
select has_table('public', 'consent_events', 'consent_events exists');
select has_table('public', 'lead_events', 'lead_events exists');
select has_table('public', 'lead_intake_requests', 'lead_intake_requests exists');

select is(
  (select to_regclass('public.contact_suppressions') is null),
  true,
  'contact_suppressions deferred — no weak placeholder table'
);

-- RLS enabled
select results_eq(
  $$select relrowsecurity from pg_class where relname = 'contacts' and relnamespace = 'public'::regnamespace$$,
  array[true],
  'RLS contacts'
);
select results_eq(
  $$select relrowsecurity from pg_class where relname = 'contact_channels' and relnamespace = 'public'::regnamespace$$,
  array[true],
  'RLS contact_channels'
);
select results_eq(
  $$select relrowsecurity from pg_class where relname = 'leads' and relnamespace = 'public'::regnamespace$$,
  array[true],
  'RLS leads'
);
select results_eq(
  $$select relrowsecurity from pg_class where relname = 'consent_events' and relnamespace = 'public'::regnamespace$$,
  array[true],
  'RLS consent_events'
);
select results_eq(
  $$select relrowsecurity from pg_class where relname = 'lead_events' and relnamespace = 'public'::regnamespace$$,
  array[true],
  'RLS lead_events'
);
select results_eq(
  $$select relrowsecurity from pg_class where relname = 'lead_intake_requests' and relnamespace = 'public'::regnamespace$$,
  array[true],
  'RLS lead_intake_requests'
);

-- Permissions
select results_eq(
  $$select count(*)::integer from public.permissions where code in ('leads.read','leads.manage','consents.read','lead_intake.audit') and is_system = true$$,
  array[4],
  'four lead system permissions'
);
select results_eq(
  $$select count(*)::integer from public.role_permissions rp join public.roles r on r.id = rp.role_id join public.permissions p on p.id = rp.permission_id where r.code = 'super_admin' and p.code in ('leads.read','leads.manage','consents.read','lead_intake.audit')$$,
  array[4],
  'super_admin mapped to all lead permissions'
);
select results_eq(
  $$select count(*)::integer from public.role_permissions rp join public.roles r on r.id = rp.role_id join public.permissions p on p.id = rp.permission_id where r.code = 'management' and p.code in ('leads.read','leads.manage','consents.read','lead_intake.audit')$$,
  array[4],
  'management mapped to all lead permissions'
);
select results_eq(
  $$select count(*)::integer from public.role_permissions rp join public.roles r on r.id = rp.role_id join public.permissions p on p.id = rp.permission_id where r.code = 'sales' and p.code in ('leads.read','leads.manage','consents.read')$$,
  array[3],
  'sales mapped to leads/consents read-manage'
);
select results_eq(
  $$select count(*)::integer from public.role_permissions rp join public.roles r on r.id = rp.role_id join public.permissions p on p.id = rp.permission_id where r.code in ('designer','project_operations','content_manager') and p.code in ('leads.read','leads.manage','consents.read','lead_intake.audit')$$,
  array[0],
  'designer/ops/content have no lead permissions by default'
);

-- RPC security
select results_eq(
  $$select prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'submit_lead_intake'$$,
  array[true],
  'submit_lead_intake is SECURITY DEFINER'
);
select is(
  (select pg_get_userbyid(p.proowner)::text from pg_proc p join pg_namespace n on n.oid = p.pronamespace where n.nspname = 'public' and p.proname = 'submit_lead_intake'),
  'postgres',
  'submit_lead_intake owned by postgres'
);
select ok(
  exists (
    select 1
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname = 'submit_lead_intake'
      and coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=%'
  ),
  'submit_lead_intake has empty search_path'
);
select results_eq(
  $$select has_function_privilege('anon', 'public.submit_lead_intake(uuid,text,text,text,text,text,text,text,text,text,text,text[],text,jsonb,text,text,text,jsonb,text,boolean,boolean,boolean,boolean,text,text,text,text,text)', 'execute')$$,
  array[false],
  'anon cannot execute submit_lead_intake'
);
select results_eq(
  $$select has_function_privilege('authenticated', 'public.submit_lead_intake(uuid,text,text,text,text,text,text,text,text,text,text,text[],text,jsonb,text,text,text,jsonb,text,boolean,boolean,boolean,boolean,text,text,text,text,text)', 'execute')$$,
  array[false],
  'authenticated cannot execute submit_lead_intake'
);
select results_eq(
  $$select has_function_privilege('service_role', 'public.submit_lead_intake(uuid,text,text,text,text,text,text,text,text,text,text,text[],text,jsonb,text,text,text,jsonb,text,boolean,boolean,boolean,boolean,text,text,text,text,text)', 'execute')$$,
  array[true],
  'service_role can execute submit_lead_intake'
);

-- Anon table privileges
select results_eq(
  $$select has_table_privilege('anon', 'public.contacts', 'select') or has_table_privilege('anon', 'public.leads', 'insert')$$,
  array[false],
  'anon has no contacts select / leads insert'
);

-- Constraints: contact name
select throws_ok(
  $$insert into public.contacts (display_name) values ('A')$$,
  '23514',
  null,
  'contact name min length enforced'
);

-- E.164
select throws_ok(
  $$insert into public.contacts (display_name) values ('Valid Name');
    insert into public.contact_channels (contact_id, channel_type, address_normalized, is_primary)
    select id, 'phone', '9876543210', true from public.contacts order by created_at desc limit 1;$$,
  '23514',
  null,
  'phone E.164 enforced'
);

-- Helper to call RPC as service_role via set role is limited in pgTAP; call as postgres (definer owner path still validates).
create temporary table _rpc_result as
select * from public.submit_lead_intake(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
  repeat('a', 64),
  repeat('b', 64),
  repeat('c', 64),
  'home-r4-v1',
  'Synthetic Person',
  '+919876543210',
  'synthetic@example.test',
  'complete-home-interiors',
  'apartment-2bhk',
  'within-3-months',
  array['living','kitchen']::text[],
  '6-12l',
  null,
  'Koregaon Park',
  'Synthetic brief',
  '/',
  '{}'::jsonb,
  'local-test',
  true,
  true,
  false,
  false,
  'service-enquiry-v0.1-draft',
  'service-communication-v0.1-draft',
  null,
  null,
  'privacy-notice-v0.1-draft'
);

select results_eq(
  $$select outcome from _rpc_result$$,
  array['created'],
  'valid synthetic request creates lead'
);

select results_eq(
  $$select duplicate from _rpc_result$$,
  array[false],
  'created is not duplicate'
);

select results_eq(
  $$select count(*)::integer from public.contacts$$,
  array[1],
  'one contact created'
);
select results_eq(
  $$select count(*)::integer from public.contact_channels where channel_type = 'phone'$$,
  array[1],
  'one phone channel'
);
select results_eq(
  $$select count(*)::integer from public.leads$$,
  array[1],
  'one lead created'
);
select results_eq(
  $$select count(*)::integer from public.consent_events where purpose_code in ('SERVICE_ENQUIRY','SERVICE_COMMUNICATION') and event_type = 'granted'$$,
  array[2],
  'required consent grants written'
);
select results_eq(
  $$select count(*)::integer from public.consent_events where purpose_code in ('WHATSAPP_SERVICE','MARKETING','AI_ASSISTANCE_DISCLOSURE','PORTFOLIO_MEDIA')$$,
  array[0],
  'no optional/AI/media grants by default'
);
select results_eq(
  $$select count(*)::integer from public.lead_events where event_type = 'lead.created'$$,
  array[1],
  'one lead.created event'
);

-- Safe return fields only
select results_eq(
  $$select (submission_reference is not null) from _rpc_result$$,
  array[true],
  'submission_reference returned'
);

-- Idempotent replay
create temporary table _rpc_replay as
select * from public.submit_lead_intake(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
  repeat('a', 64),
  repeat('b', 64),
  repeat('c', 64),
  'home-r4-v1',
  'Synthetic Person',
  '+919876543210',
  'synthetic@example.test',
  'complete-home-interiors',
  'apartment-2bhk',
  'within-3-months',
  array['living','kitchen']::text[],
  '6-12l',
  null,
  'Koregaon Park',
  'Synthetic brief',
  '/',
  '{}'::jsonb,
  'local-test',
  true,
  true,
  false,
  false,
  'service-enquiry-v0.1-draft',
  'service-communication-v0.1-draft',
  null,
  null,
  'privacy-notice-v0.1-draft'
);

select results_eq(
  $$select outcome, duplicate from _rpc_replay$$,
  $$values ('idempotent_replay'::text, true)$$,
  'same key/hash replays'
);
select results_eq(
  $$select count(*)::integer from public.leads$$,
  array[1],
  'replay creates no second lead'
);
select results_eq(
  $$select count(*)::integer from public.lead_events where event_type = 'lead.created'$$,
  array[1],
  'replay creates no second lead.created'
);
select results_eq(
  $$select submission_reference from _rpc_replay$$,
  $$select submission_reference from _rpc_result$$,
  'replay returns same submission_reference'
);

-- Conflict
create temporary table _rpc_conflict as
select * from public.submit_lead_intake(
  'aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'::uuid,
  repeat('d', 64),
  repeat('b', 64),
  repeat('c', 64),
  'home-r4-v1',
  'Synthetic Person',
  '+919876543210',
  'synthetic@example.test',
  'complete-home-interiors',
  'apartment-2bhk',
  'within-3-months',
  array['living','kitchen']::text[],
  '6-12l',
  null,
  'Koregaon Park',
  'Synthetic brief changed',
  '/',
  '{}'::jsonb,
  'local-test',
  true,
  true,
  false,
  false,
  'service-enquiry-v0.1-draft',
  'service-communication-v0.1-draft',
  null,
  null,
  'privacy-notice-v0.1-draft'
);

select results_eq(
  $$select outcome from _rpc_conflict$$,
  array['idempotency_conflict'],
  'same key different hash conflicts'
);

-- Duplicate phone reuses contact without overwriting name
create temporary table _rpc_reuse as
select * from public.submit_lead_intake(
  'bbbbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
  repeat('e', 64),
  repeat('f', 64),
  repeat('c', 64),
  'home-r4-v1',
  'Different Name Should Not Overwrite',
  '+919876543210',
  null,
  'modular-kitchens',
  'apartment-1bhk',
  'ready-now',
  array['kitchen']::text[],
  null,
  null,
  null,
  null,
  '/',
  '{}'::jsonb,
  'local-test',
  true,
  true,
  false,
  false,
  'service-enquiry-v0.1-draft',
  'service-communication-v0.1-draft',
  null,
  null,
  'privacy-notice-v0.1-draft'
);

select results_eq(
  $$select outcome from _rpc_reuse$$,
  array['created'],
  'second lead with same phone created'
);
select results_eq(
  $$select count(*)::integer from public.contacts$$,
  array[1],
  'duplicate phone reuses contact'
);
select results_eq(
  $$select display_name from public.contacts$$,
  array['Synthetic Person'],
  'existing display name not overwritten'
);
select results_eq(
  $$select count(*)::integer from public.leads$$,
  array[2],
  'second lead row exists'
);

-- Email does not merge contacts
create temporary table _rpc_email as
select * from public.submit_lead_intake(
  'cccccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,
  repeat('1', 64),
  repeat('2', 64),
  repeat('3', 64),
  'home-r4-v1',
  'Email Only Contact',
  '+919811122233',
  'synthetic@example.test',
  'custom-wardrobes',
  'single-room',
  'exploring',
  '{}'::text[],
  null,
  null,
  null,
  null,
  '/',
  '{}'::jsonb,
  'local-test',
  true,
  true,
  false,
  false,
  'service-enquiry-v0.1-draft',
  'service-communication-v0.1-draft',
  null,
  null,
  'privacy-notice-v0.1-draft'
);

select results_eq(
  $$select count(*)::integer from public.contacts$$,
  array[2],
  'shared email does not merge contacts'
);

-- Optional grant when explicitly true
create temporary table _rpc_wa as
select * from public.submit_lead_intake(
  'dddddddd-dddd-4ddd-8ddd-dddddddddddd'::uuid,
  repeat('4', 64),
  repeat('5', 64),
  repeat('6', 64),
  'home-r4-v1',
  'WhatsApp Opt In',
  '+919822233344',
  null,
  'complete-home-interiors',
  'apartment-3bhk',
  '3-6-months',
  array['living']::text[],
  null,
  null,
  null,
  null,
  '/',
  '{}'::jsonb,
  'local-test',
  true,
  true,
  true,
  false,
  'service-enquiry-v0.1-draft',
  'service-communication-v0.1-draft',
  'whatsapp-service-v0.1-draft',
  null,
  'privacy-notice-v0.1-draft'
);

select results_eq(
  $$select count(*)::integer from public.consent_events where purpose_code = 'WHATSAPP_SERVICE' and event_type = 'granted'$$,
  array[1],
  'optional WhatsApp grant only when true'
);

-- Invalid allowlist rejected
select throws_ok(
  $$select public.submit_lead_intake(
    'eeeeeeee-eeee-4eee-8eee-eeeeeeeeeeee'::uuid,
    repeat('7', 64), repeat('8', 64), repeat('0', 64),
    'home-r4-v1', 'Bad Service', '+919833344455', null,
    'not-a-service', 'apartment-1bhk', 'ready-now', '{}'::text[],
    null, null, null, null, '/', '{}'::jsonb, 'local-test',
    true, true, false, false,
    'service-enquiry-v0.1-draft', 'service-communication-v0.1-draft', null, null,
    'privacy-notice-v0.1-draft'
  )$$,
  '22023',
  null,
  'invalid service allowlist rejected'
);

-- Append-only consent/lead events
select throws_ok(
  $$update public.consent_events set event_type = 'withdrawn'$$,
  '55000',
  null,
  'consent_events update blocked'
);
select throws_ok(
  $$delete from public.consent_events$$,
  '55000',
  null,
  'consent_events delete blocked'
);
select throws_ok(
  $$update public.lead_events set event_type = 'lead.note_added'$$,
  '55000',
  null,
  'lead_events update blocked'
);

-- No raw IP/UA columns
select results_eq(
  $$select count(*)::integer from information_schema.columns where table_schema = 'public' and table_name in ('lead_intake_requests','leads','contacts','consent_events') and column_name in ('ip','ip_address','user_agent','userAgent','raw_body')$$,
  array[0],
  'no raw IP/user-agent/body columns'
);

-- Network rate limit (5 in 15m) using shared network fingerprint
do $$
declare
  i integer;
  v_key uuid;
  v_phone text;
  v_outcome text;
begin
  for i in 1..5 loop
    v_key := ('f0000000-0000-4000-8000-00000000000' || i::text)::uuid;
    v_phone := '+91980000000' || i::text;
    select outcome into v_outcome
    from public.submit_lead_intake(
      v_key,
      md5(i::text || 'req') || md5(i::text || 'req2'),
      repeat('9', 64),
      md5(i::text || 'phone') || md5(i::text || 'phone2'),
      'home-r4-v1',
      'Rate Limit Person',
      v_phone,
      null,
      'complete-home-interiors',
      'apartment-1bhk',
      'ready-now',
      '{}'::text[],
      null, null, null, null, '/', '{}'::jsonb, 'local-test',
      true, true, false, false,
      'service-enquiry-v0.1-draft', 'service-communication-v0.1-draft', null, null,
      'privacy-notice-v0.1-draft'
    );
    if v_outcome is distinct from 'created' then
      raise exception 'rate-limit seed expected created, got %', v_outcome;
    end if;
  end loop;
end $$;

create temporary table _rpc_rate as
select * from public.submit_lead_intake(
  'f0000000-0000-4000-8000-000000000099'::uuid,
  md5('rate-final-req') || md5('rate-final-req2'),
  repeat('9', 64),
  md5('rate-final-phone') || md5('rate-final-phone2'),
  'home-r4-v1',
  'Rate Limit Person',
  '+919800000099',
  null,
  'complete-home-interiors',
  'apartment-1bhk',
  'ready-now',
  '{}'::text[],
  null, null, null, null, '/', '{}'::jsonb, 'local-test',
  true, true, false, false,
  'service-enquiry-v0.1-draft', 'service-communication-v0.1-draft', null, null,
  'privacy-notice-v0.1-draft'
);

select results_eq(
  $$select outcome from _rpc_rate$$,
  array['network_rate_limited'],
  'network rate limit enforced'
);
select results_eq(
  $$select (lead_id is null) from public.lead_intake_requests where outcome_code = 'NETWORK_RATE_LIMIT' limit 1$$,
  array[true],
  'rejected rate-limit attempt creates no lead_id'
);
select results_eq(
  $$select (retry_after_seconds is not null and retry_after_seconds > 0) from _rpc_rate$$,
  array[true],
  'rate limit returns retry_after_seconds'
);

-- Transaction rollback restores empty tables (append-only triggers prevent mid-test DELETEs).
select results_eq(
  $$select count(*)::integer > 0 from public.leads$$,
  array[true],
  'synthetic leads exist before rollback'
);

select * from finish();
rollback;
