begin;
select plan(21);

select has_table('public', 'website_analytics_visitors', 'analytics visitors table exists');
select has_table('public', 'website_analytics_sessions', 'analytics sessions table exists');
select has_table('public', 'website_analytics_events', 'analytics events table exists');
select has_table('public', 'website_analytics_lead_links', 'analytics lead link table exists');

select ok((select relrowsecurity from pg_class where oid='public.website_analytics_visitors'::regclass),
  'visitor table has RLS');
select ok((select relforcerowsecurity from pg_class where oid='public.website_analytics_visitors'::regclass),
  'visitor table forces RLS');
select ok((select relrowsecurity from pg_class where oid='public.website_analytics_sessions'::regclass),
  'session table has RLS');
select ok((select relforcerowsecurity from pg_class where oid='public.website_analytics_sessions'::regclass),
  'session table forces RLS');
select ok((select relrowsecurity from pg_class where oid='public.website_analytics_events'::regclass),
  'event table has RLS');
select ok((select relforcerowsecurity from pg_class where oid='public.website_analytics_events'::regclass),
  'event table forces RLS');

select is(has_table_privilege('anon','public.website_analytics_events','select'), false,
  'anon cannot read analytics events');
select is(has_table_privilege('authenticated','public.website_analytics_events','insert'), false,
  'authenticated users cannot insert analytics events directly');

select is(
  has_function_privilege(
    'anon',
    'public.record_website_analytics_event(uuid,uuid,uuid,text,text,text,text,timestamptz,text,text,text,text,text,text,text,boolean,boolean)',
    'execute'
  ),
  false,
  'anon cannot invoke analytics ingestion RPC'
);
select is(
  has_function_privilege(
    'service_role',
    'public.record_website_analytics_event(uuid,uuid,uuid,text,text,text,text,timestamptz,text,text,text,text,text,text,text,boolean,boolean)',
    'execute'
  ),
  true,
  'service role may invoke analytics ingestion RPC'
);
select is(
  has_function_privilege(
    'anon',
    'public.get_website_analytics_dashboard(date,date)',
    'execute'
  ),
  false,
  'anon cannot read analytics dashboard'
);
select is(
  has_function_privilege(
    'authenticated',
    'public.get_website_analytics_dashboard(date,date)',
    'execute'
  ),
  true,
  'authenticated callers may invoke permission-gated dashboard'
);

select is(private.resolve_website_lead_source_code(
  '{"utmSource":"instagram","utmMedium":"paid_social","fbclid":"x"}'::jsonb
), 'instagram_ads', 'Instagram paid traffic maps to Instagram Ads');
select is(private.resolve_website_lead_source_code(
  '{"utmSource":"facebook","utmMedium":"paid_social","fbclid":"x"}'::jsonb
), 'facebook_ads', 'Facebook paid traffic maps to Facebook Ads');
select is(private.resolve_website_lead_source_code(
  '{"gclid":"x"}'::jsonb
), 'google_ads', 'Google click id maps to Google Ads');
select is(private.resolve_website_lead_source_code(
  '{"fbclid":"x"}'::jsonb
), 'website_planner', 'generic Meta click does not invent Facebook or Instagram');

select ok(position('analyticsSessionId' in pg_get_functiondef(
  'private.trg_website_analytics_link_lead()'::regprocedure
)) > 0, 'lead-link trigger reads only the anonymous analytics session id');

select * from finish();
rollback;
