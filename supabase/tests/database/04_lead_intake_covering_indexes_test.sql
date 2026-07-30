-- ONEDECORE Phase 4B2 — covering indexes for lead-domain FK columns

begin;
select plan(6);

select results_eq(
  $$
  select count(*)::integer
  from pg_indexes
  where schemaname = 'public'
    and indexname = 'idx_consent_events_intake_request_id'
    and tablename = 'consent_events'
  $$,
  array[1],
  'idx_consent_events_intake_request_id exists'
);

select results_eq(
  $$
  select count(*)::integer
  from pg_indexes
  where schemaname = 'public'
    and indexname = 'idx_lead_intake_requests_lead_id'
    and tablename = 'lead_intake_requests'
  $$,
  array[1],
  'idx_lead_intake_requests_lead_id exists'
);

select results_eq(
  $$
  select count(*)::integer
  from pg_indexes
  where schemaname = 'public'
    and indexname = 'idx_lead_events_actor_id'
    and tablename = 'lead_events'
  $$,
  array[1],
  'idx_lead_events_actor_id exists'
);

select results_eq(
  $$
  select count(*)::integer
  from pg_indexes i
  join pg_class c on c.relname = i.indexname
  join pg_index x on x.indexrelid = c.oid
  where i.schemaname = 'public'
    and i.indexname = 'idx_consent_events_intake_request_id'
    and pg_get_expr(x.indpred, x.indrelid) ilike '%intake_request_id%is%not%null%'
  $$,
  array[1],
  'idx_consent_events_intake_request_id is partial where intake_request_id is not null'
);

select results_eq(
  $$
  select count(*)::integer
  from pg_indexes i
  join pg_class c on c.relname = i.indexname
  join pg_index x on x.indexrelid = c.oid
  where i.schemaname = 'public'
    and i.indexname = 'idx_lead_intake_requests_lead_id'
    and pg_get_expr(x.indpred, x.indrelid) ilike '%lead_id%is%not%null%'
  $$,
  array[1],
  'idx_lead_intake_requests_lead_id is partial where lead_id is not null'
);

select results_eq(
  $$
  select count(*)::integer
  from pg_indexes i
  join pg_class c on c.relname = i.indexname
  join pg_index x on x.indexrelid = c.oid
  where i.schemaname = 'public'
    and i.indexname = 'idx_lead_events_actor_id'
    and pg_get_expr(x.indpred, x.indrelid) ilike '%actor_id%is%not%null%'
  $$,
  array[1],
  'idx_lead_events_actor_id is partial where actor_id is not null'
);

select * from finish();
rollback;
