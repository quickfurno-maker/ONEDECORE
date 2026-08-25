-- ONEDECORE Phase 9C-C pgTAP — metrics, conversion feedback, grants
begin;
select plan(65);

select ok(exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'campaign_metric_snapshots'), 'metric snapshots exist');
select ok(exists (select 1 from information_schema.tables where table_schema = 'public' and table_name = 'campaign_conversion_feedback_events'), 'feedback events exist');
select ok(
  not exists (
    select 1 from information_schema.tables
    where table_schema = 'public'
      and table_name in ('campaign_attributions', 'lead_run_attributions', 'marketing_attributions')
  ),
  'no parallel attribution table'
);

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'chk_campaign_run_operations_type'
      and pg_get_constraintdef(oid) ilike '%metrics_sync%'
      and pg_get_constraintdef(oid) ilike '%conversion_feedback%'
  ),
  'operation type includes metrics_sync and conversion_feedback'
);

insert into auth.users (id, instance_id, email, aud, role) values
  ('9c111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', 'sa_9c@onedecore.in', 'authenticated', 'authenticated'),
  ('9c333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', 'se_9c@onedecore.in', 'authenticated', 'authenticated')
on conflict (id) do nothing;

update public.profiles set status = 'active', display_name = 'Phase 9C-C ' || id::text
where id in ('9c111111-1111-1111-1111-111111111111', '9c333333-3333-3333-3333-333333333333');

insert into public.user_roles (user_id, role_id)
select '9c111111-1111-1111-1111-111111111111', id from public.roles where code = 'super_admin' on conflict do nothing;
insert into public.user_roles (user_id, role_id)
select '9c333333-3333-3333-3333-333333333333', id from public.roles where code = 'sales_executive' on conflict do nothing;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"9c333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select throws_ok(
  $$insert into public.campaign_metric_snapshots (
      campaign_run_id, campaign_run_target_id, provider_channel, window_start, window_end,
      currency, spend_minor, impressions, clicks, provider_conversions
    ) values (
      '00000000-0000-0000-0000-000000000001', '00000000-0000-0000-0000-000000000002',
      'meta_ads', now(), now() + interval '1 day', 'INR', 0, 0, 0, 0
    )$$,
  '42501',
  NULL,
  'authenticated cannot insert metric snapshots'
);

select throws_ok(
  $$select public.upsert_campaign_metric_snapshot(
    '00000000-0000-0000-0000-000000000001', now(), now() + interval '1 day', 'INR', 0, 0, 0, 0
  )$$,
  '42501',
  NULL,
  'authenticated cannot execute metric upsert'
);

reset role;
set local role postgres;

select is(
  (
    select count(*)::integer from information_schema.routine_privileges
    where specific_schema = 'public'
      and routine_name in ('upsert_campaign_metric_snapshot', 'mark_campaign_conversion_feedback_state', 'enqueue_campaign_metrics_sync', 'verify_campaign_execution_context_binding', 'enqueue_campaign_conversion_feedback')
      and grantee in ('anon', 'authenticated')
  ),
  0,
  'worker/feedback helpers not granted to anon/authenticated'
);

select ok(
  exists (
    select 1 from information_schema.routine_privileges
    where specific_schema = 'public'
      and routine_name = 'upsert_campaign_metric_snapshot'
      and grantee = 'service_role'
  ),
  'metric upsert granted to service_role'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"9c111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok(
  $$select public.create_campaign_draft(
    'Metrics Meta',
    'Metrics Meta v1',
    'broad_public',
    array['meta_ads'],
    'OD-LP-2026-000001',
    jsonb_build_object('currency','INR','daily_budget_paise',1000,'total_budget_paise',5000),
    jsonb_build_object('headline','H','primary_text','P','call_to_action','C','media_references', jsonb_build_array('m')),
    jsonb_build_object('start_date','2026-09-01','end_date', null),
    jsonb_build_object('logic','and','rules', jsonb_build_array(
      jsonb_build_object('field','lead_stage','operator','equals','values', jsonb_build_array('qualified'))
    )),
    '9c000000-0000-0000-0000-00000000c001'
  )$$,
  'SA draft for 9C-C'
);
select lives_ok(
  $$select public.request_campaign_approval(
    (select id from public.campaign_versions where title = 'Metrics Meta v1' order by created_at desc limit 1),
    (select lock_version from public.campaign_versions where title = 'Metrics Meta v1' order by created_at desc limit 1),
    '9c000000-0000-0000-0000-00000000c002'
  )$$,
  'request approval 9C-C'
);
select lives_ok(
  $$select public.decide_campaign_version(
    (select id from public.campaign_versions where title = 'Metrics Meta v1' order by created_at desc limit 1),
    'approved',
    null,
    '9c000000-0000-0000-0000-00000000c003'
  )$$,
  'approve 9C-C'
);
select lives_ok(
  $$select public.create_campaign_run(
    (select id from public.campaign_versions where title = 'Metrics Meta v1' and status = 'approved' limit 1),
    '9c000000-0000-0000-0000-00000000c010'
  )$$,
  'create run 9C-C'
);

reset role;
set local role postgres;

select is(
  public.verify_campaign_execution_context_binding(
    (select run_reference from public.campaign_runs order by run_reference desc limit 1),
    (select t.run_target_reference from public.campaign_run_targets t order by t.run_target_reference desc limit 1),
    'meta_ads',
    (select c.campaign_reference from public.campaigns c join public.campaign_versions v on v.campaign_id = c.id where v.title = 'Metrics Meta v1' limit 1),
    1,
    'OD-LP-2026-000001'
  ) ->> 'outcome_code',
  'ok',
  'DB-coherent execution context binds'
);

select is(
  public.verify_campaign_execution_context_binding(
    (select run_reference from public.campaign_runs order by run_reference desc limit 1),
    (select t.run_target_reference from public.campaign_run_targets t order by t.run_target_reference desc limit 1),
    'google_ads',
    (select c.campaign_reference from public.campaigns c join public.campaign_versions v on v.campaign_id = c.id where v.title = 'Metrics Meta v1' limit 1),
    1,
    'OD-LP-2026-000001'
  ) ->> 'outcome_code',
  'mismatch',
  'wrong provider is mismatch not a guess'
);

select lives_ok(
  $$select public.upsert_campaign_metric_snapshot(
    (select id from public.campaign_run_targets order by run_target_reference desc limit 1),
    '2026-08-01T00:00:00Z'::timestamptz,
    '2026-08-02T00:00:00Z'::timestamptz,
    'INR',
    150,
    10,
    2,
    1
  )$$,
  'metric upsert lives'
);

select lives_ok(
  $$select public.upsert_campaign_metric_snapshot(
    (select id from public.campaign_run_targets order by run_target_reference desc limit 1),
    '2026-08-01T00:00:00Z'::timestamptz,
    '2026-08-02T00:00:00Z'::timestamptz,
    'INR',
    150,
    10,
    2,
    1
  )$$,
  'metric upsert replay lives'
);

select is(
  (select count(*)::integer from public.campaign_metric_snapshots),
  1,
  'metric window identity is idempotent'
);

select throws_ok(
  $$select public.upsert_campaign_metric_snapshot(
    (select id from public.campaign_run_targets order by run_target_reference desc limit 1),
    '2026-08-03T00:00:00Z'::timestamptz,
    '2026-08-04T00:00:00Z'::timestamptz,
    'INR',
    -1, 0, 0, 0
  )$$,
  '22023',
  NULL,
  'negative spend rejected'
);

select is(
  private.upsert_campaign_conversion_feedback_event(
    'LeadCreated', 'lead', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'lead:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1:LeadCreated',
    null,
    jsonb_build_object(
      'campaign_run_reference', (select run_reference from public.campaign_runs order by run_reference desc limit 1),
      'campaign_run_target_reference', (select run_target_reference from public.campaign_run_targets order by run_target_reference desc limit 1)
    ),
    now(), null, null
  ) is not null,
  true,
  'attributable feedback insert lives'
);

select is(
  (
    select attribution_state from public.campaign_conversion_feedback_events
    where source_event_key = 'lead:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1:LeadCreated'
  ),
  'attributable',
  'trusted run/target is attributable'
);

select is(
  (
    select count(*)::integer from public.campaign_run_operations
    where operation_type = 'conversion_feedback'
      and operation_key = 'conversion_feedback:' || (
        select id::text from public.campaign_conversion_feedback_events
        where source_event_key = 'lead:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1:LeadCreated'
      )
  ),
  1,
  'attributable pending event enqueues conversion_feedback once'
);

select is(
  (
    select provider_submission_state from public.campaign_conversion_feedback_events
    where source_event_key = 'lead:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1:LeadCreated'
  ),
  'pending',
  'attributable events are pending not auto-submitted'
);

select lives_ok(
  $$select private.upsert_campaign_conversion_feedback_event(
      'QualifiedLead', 'lead', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
      'lead:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2:QualifiedLead',
      null, '{}'::jsonb, now(), null, null
    )$$,
  'unattributed feedback insert lives'
);
select is(
  (
    select attribution_state from public.campaign_conversion_feedback_events
    where source_event_key = 'lead:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2:QualifiedLead'
  ),
  'not_attributable',
  'no trusted target is not_attributable'
);

select is(
  (
    select provider_submission_state from public.campaign_conversion_feedback_events
    where source_event_key = 'lead:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2:QualifiedLead'
  ),
  'not_applicable',
  'unattributed events are never submitted'
);

select is(
  (
    select count(*)::integer from public.campaign_run_operations
    where operation_key = 'conversion_feedback:' || (
      select id::text from public.campaign_conversion_feedback_events
      where source_event_key = 'lead:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2:QualifiedLead'
    )
  ),
  0,
  'unattributed events never enqueue conversion_feedback'
);

select is(
  private.upsert_campaign_conversion_feedback_event(
    'LeadCreated', 'lead', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
    'lead:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1:LeadCreated',
    null, '{}'::jsonb, now(), null, null
  ),
  (
    select id from public.campaign_conversion_feedback_events
    where source_event_key = 'lead:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1:LeadCreated'
  ),
  'source_event_key replay does not duplicate'
);

select is(
  (
    select count(*)::integer from public.campaign_conversion_feedback_events
    where source_event_key = 'lead:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1:LeadCreated'
  ),
  1,
  'exactly one row per source event'
);

select lives_ok(
  $$select public.enqueue_campaign_metrics_sync(
    (select id from public.campaign_runs order by run_reference desc limit 1),
    '2026-08-01'
  )$$,
  'enqueue metrics_sync'
);

select is(
  (
    select count(*)::integer from public.campaign_run_operations
    where operation_type = 'metrics_sync'
      and campaign_run_id = (select id from public.campaign_runs order by run_reference desc limit 1)
      and operation_key like '%:2026-08-01'
  ),
  1,
  'metrics_sync unique per target window'
);

select lives_ok(
  $$select public.enqueue_campaign_metrics_sync(
    (select id from public.campaign_runs order by run_reference desc limit 1),
    '2026-08-01'
  )$$,
  'metrics_sync same window replay'
);

select is(
  (
    select count(*)::integer from public.campaign_run_operations
    where operation_type = 'metrics_sync'
      and campaign_run_id = (select id from public.campaign_runs order by run_reference desc limit 1)
  ),
  1,
  'metrics_sync same window does not duplicate'
);

select lives_ok(
  $$select public.enqueue_campaign_metrics_sync(
    (select id from public.campaign_runs order by run_reference desc limit 1),
    '2026-08-02'
  )$$,
  'metrics_sync next window'
);

select is(
  (
    select count(*)::integer from public.campaign_run_operations
    where operation_type = 'metrics_sync'
      and campaign_run_id = (select id from public.campaign_runs order by run_reference desc limit 1)
  ),
  2,
  'metrics_sync new window creates new operation'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"9c111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok(
  $$select public.get_campaign_metrics_board(
    (select campaign_id from public.campaign_versions where title = 'Metrics Meta v1' limit 1)
  )$$,
  'SA can read metrics board'
);

select set_config('request.jwt.claims', '{"sub":"9c333333-3333-3333-3333-333333333333","role":"authenticated"}', true);
select throws_ok(
  $$select public.get_campaign_metrics_board(
    (select campaign_id from public.campaign_versions where title = 'Metrics Meta v1' limit 1)
  )$$,
  '42501',
  NULL,
  'SE cannot read metrics board'
);

reset role;
set local role postgres;

insert into public.contacts (id, display_name, status) values
  ('9ccaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1', '9C-C Lead', 'active')
on conflict (id) do nothing;

insert into public.leads (
  id, submission_reference, contact_id, submitted_name, submitted_email, status, source,
  primary_source_id, entry_method, service_code, property_code, timeline_code, planner_version, landing_path, locality,
  attribution
) values (
  '9ccb1111-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
  '9ccb1111-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
  '9ccaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa1',
  '9C-C Lead',
  'lead9cc@example.com',
  'new',
  'website-planner',
  (select id from public.lead_sources where code = 'website_planner'),
  'local_test',
  'complete-home-interiors',
  'apartment-3bhk',
  'immediate',
  'v1',
  '/planner',
  'Pune',
  jsonb_build_object(
    'campaign_run_reference', (select run_reference from public.campaign_runs order by run_reference desc limit 1),
    'campaign_run_target_reference', (select run_target_reference from public.campaign_run_targets order by run_target_reference desc limit 1)
  )
);

select is(
  (
    select count(*)::integer from public.campaign_conversion_feedback_events
    where source_event_key = 'lead:9ccb1111-bbbb-bbbb-bbbb-bbbbbbbbbbb1:LeadCreated'
  ),
  1,
  'LeadCreated once on lead insert'
);

update public.leads set locality = 'Pune West' where id = '9ccb1111-bbbb-bbbb-bbbb-bbbbbbbbbbb1';
select is(
  (
    select count(*)::integer from public.campaign_conversion_feedback_events
    where lead_id = '9ccb1111-bbbb-bbbb-bbbb-bbbbbbbbbbb1' and conversion_type = 'QualifiedLead'
  ),
  0,
  'unrelated field change does not emit QualifiedLead'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"9c111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok(
  $$select public.assign_lead(
    '9ccb1111-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
    '9c333333-3333-3333-3333-333333333333',
    '9c-c assign'
  )$$,
  'SA assigns lead for CRM transitions'
);
select lives_ok(
  $$select public.transition_lead_status('9ccb1111-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'contacted', null, null)$$,
  'contacted'
);
select lives_ok(
  $$select public.transition_lead_status('9ccb1111-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'qualified', null, null)$$,
  'qualified'
);
reset role;
set local role postgres;

select is(
  (
    select count(*)::integer from public.campaign_conversion_feedback_events
    where source_event_key = 'lead:9ccb1111-bbbb-bbbb-bbbb-bbbbbbbbbbb1:QualifiedLead'
  ),
  1,
  'QualifiedLead once on transition into qualified'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"9c111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok(
  $$select public.transition_lead_status('9ccb1111-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'consultation_scheduled', null, null)$$,
  'consultation_scheduled'
);
select lives_ok(
  $$select public.transition_lead_status('9ccb1111-bbbb-bbbb-bbbb-bbbbbbbbbbb1', 'proposal_sent', null, null)$$,
  'proposal_sent'
);
reset role;
set local role postgres;

select is(
  (
    select count(*)::integer from public.campaign_conversion_feedback_events
    where source_event_key = 'lead:9ccb1111-bbbb-bbbb-bbbb-bbbbbbbbbbb1:ConsultationScheduled'
  ),
  1,
  'ConsultationScheduled once'
);
select is(
  (
    select count(*)::integer from public.campaign_conversion_feedback_events
    where source_event_key = 'lead:9ccb1111-bbbb-bbbb-bbbb-bbbbbbbbbbb1:ProposalSent'
  ),
  1,
  'ProposalSent once'
);

select lives_ok(
  $$select private.upsert_campaign_conversion_feedback_event(
      'CommercialConversion', 'quotation_acceptance', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa9',
      'quotation_acceptance:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa9',
      '9ccb1111-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
      (select attribution from public.leads where id = '9ccb1111-bbbb-bbbb-bbbb-bbbbbbbbbbb1'),
      now(), 12345, 'INR'
    )$$,
  'CommercialConversion insert lives'
);
select is(
  (
    select value_minor from public.campaign_conversion_feedback_events
    where source_event_key = 'quotation_acceptance:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa9'
  ),
  12345::bigint,
  'CommercialConversion stores taxable_base_paise'
);

select is(
  private.upsert_campaign_conversion_feedback_event(
    'CommercialConversion', 'quotation_acceptance', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa9',
    'quotation_acceptance:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa9',
    '9ccb1111-bbbb-bbbb-bbbb-bbbbbbbbbbb1',
    '{}'::jsonb, now(), 99999, 'INR'
  ),
  (
    select id from public.campaign_conversion_feedback_events
    where source_event_key = 'quotation_acceptance:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa9'
  ),
  'CommercialConversion keyed exactly once by quotation_acceptance_id'
);

select lives_ok(
  $$select private.upsert_campaign_conversion_feedback_event(
      'LeadCreated', 'lead', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa8',
      'lead:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa8:LeadCreated',
      null,
      jsonb_build_object(
        'campaign_run_reference', (select run_reference from public.campaign_runs order by run_reference desc limit 1),
        'campaign_run_target_reference', 'OD-CRT-2099-000099'
      ),
      now(), null, null
    )$$,
  'ambiguous feedback insert lives'
);
select is(
  (
    select attribution_state from public.campaign_conversion_feedback_events
    where source_event_key = 'lead:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa8:LeadCreated'
  ),
  'ambiguous_target',
  'conflicting trusted target is ambiguous_target'
);

select is(
  (
    select count(*)::integer from public.campaign_run_operations
    where operation_key = 'conversion_feedback:' || (
      select id::text from public.campaign_conversion_feedback_events
      where source_event_key = 'lead:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa8:LeadCreated'
    )
  ),
  0,
  'ambiguous events never enqueue conversion_feedback'
);

select lives_ok(
  $$select public.upsert_campaign_metric_snapshot(
    (select id from public.campaign_run_targets order by run_target_reference desc limit 1),
    '2026-08-02T00:00:00Z'::timestamptz,
    '2026-08-03T00:00:00Z'::timestamptz,
    'INR',
    50,
    4,
    1,
    0
  )$$,
  'second non-overlapping INR window'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"9c111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is(
  public.get_campaign_metrics_board(
    (select campaign_id from public.campaign_versions where title = 'Metrics Meta v1' limit 1)
  ) -> 'provider' ->> 'spend_minor',
  '200',
  'non-overlapping same-currency windows aggregate'
);
select is(
  public.get_campaign_metrics_board(
    (select campaign_id from public.campaign_versions where title = 'Metrics Meta v1' limit 1)
  ) -> 'provider' ->> 'mixed_currency',
  'false',
  'same-currency board is not mixed'
);
reset role;
set local role postgres;

select lives_ok(
  $$select public.upsert_campaign_metric_snapshot(
    (select id from public.campaign_run_targets order by run_target_reference desc limit 1),
    '2026-08-04T00:00:00Z'::timestamptz,
    '2026-08-05T00:00:00Z'::timestamptz,
    'USD',
    10,
    1,
    1,
    0
  )$$,
  'USD snapshot insert'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"9c111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is(
  public.get_campaign_metrics_board(
    (select campaign_id from public.campaign_versions where title = 'Metrics Meta v1' limit 1)
  ) -> 'provider' ->> 'mixed_currency',
  'true',
  'mixed currency is flagged'
);
select is(
  public.get_campaign_metrics_board(
    (select campaign_id from public.campaign_versions where title = 'Metrics Meta v1' limit 1)
  ) -> 'provider' -> 'spend_minor',
  'null'::jsonb,
  'mixed currency suppresses combined spend'
);
reset role;
set local role postgres;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"9c111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select lives_ok(
  $$select public.create_campaign_draft(
    'Board Isolation B',
    'Board Isolation B v1',
    'broad_public',
    array['google_ads'],
    'OD-LP-2026-000002',
    jsonb_build_object('currency','INR','daily_budget_paise',1000,'total_budget_paise',5000),
    jsonb_build_object('headline','H','primary_text','P','call_to_action','C','media_references', jsonb_build_array('m')),
    jsonb_build_object('start_date','2026-09-01','end_date', null),
    jsonb_build_object('logic','and','rules', jsonb_build_array(
      jsonb_build_object('field','lead_stage','operator','equals','values', jsonb_build_array('qualified'))
    )),
    '9c000000-0000-0000-0000-00000000c101'
  )$$,
  'SA draft campaign B'
);
select lives_ok(
  $$select public.request_campaign_approval(
    (select id from public.campaign_versions where title = 'Board Isolation B v1' order by created_at desc limit 1),
    (select lock_version from public.campaign_versions where title = 'Board Isolation B v1' order by created_at desc limit 1),
    '9c000000-0000-0000-0000-00000000c102'
  )$$,
  'request approval B'
);
select lives_ok(
  $$select public.decide_campaign_version(
    (select id from public.campaign_versions where title = 'Board Isolation B v1' order by created_at desc limit 1),
    'approved',
    null,
    '9c000000-0000-0000-0000-00000000c103'
  )$$,
  'approve B'
);
reset role;
set local role postgres;

insert into public.contacts (id, display_name, status) values
  ('9ccaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2', '9C-C Lead B', 'active')
on conflict (id) do nothing;

insert into public.leads (
  id, submission_reference, contact_id, submitted_name, submitted_email, status, source,
  primary_source_id, entry_method, service_code, property_code, timeline_code, planner_version, landing_path, locality,
  attribution
) values (
  '9ccb2222-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
  '9ccb2222-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
  '9ccaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaa2',
  '9C-C Lead B',
  'lead9ccb@example.com',
  'new',
  'website-planner',
  (select id from public.lead_sources where code = 'website_planner'),
  'local_test',
  'complete-home-interiors',
  'apartment-3bhk',
  'immediate',
  'v1',
  '/planner',
  'Pune',
  jsonb_build_object(
    'campaign_reference', (select c.campaign_reference from public.campaigns c join public.campaign_versions v on v.campaign_id = c.id where v.title = 'Board Isolation B v1' limit 1)
  )
);

select lives_ok(
  $$select private.upsert_campaign_conversion_feedback_event(
      'QualifiedLead', 'lead', 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa10',
      'lead:aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaa10:QualifiedLead',
      '9ccb2222-bbbb-bbbb-bbbb-bbbbbbbbbbb2',
      '{}'::jsonb, now(), null, null
    )$$,
  'campaign B unattributed event'
);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub":"9c111111-1111-1111-1111-111111111111","role":"authenticated"}', true);
select is(
  public.get_campaign_metrics_board(
    (select campaign_id from public.campaign_versions where title = 'Metrics Meta v1' limit 1)
  ) ->> 'unattributed',
  '1',
  'campaign A unattributed is scoped to A identity'
);
select is(
  public.get_campaign_metrics_board(
    (select campaign_id from public.campaign_versions where title = 'Board Isolation B v1' limit 1)
  ) ->> 'unattributed',
  '2',
  'campaign B unattributed does not leak onto A'
);
reset role;

select lives_ok(
  $$select public.enqueue_pending_attributable_campaign_conversion_feedback()$$,
  'pending feedback sweep is replay-safe'
);

select finish();
rollback;
