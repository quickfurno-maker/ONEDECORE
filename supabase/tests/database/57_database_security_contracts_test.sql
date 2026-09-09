-- ONEDECORE database security contracts.
--
-- The security model here was strong but partly implicit: correct grants that
-- nothing asserted, an intentional FORCE RLS subset that read as an oversight,
-- and six tables whose protection is the ABSENCE of a policy. Implicit is fine
-- until someone adds a table, inherits Supabase's default GRANT ALL, and
-- nothing objects — which is exactly how `authenticated` came to hold TRUNCATE
-- on every payroll table.
--
-- These assertions are deliberately invariants rather than counts. A count
-- freezes today's schema and fails on the next legitimate table; an invariant
-- keeps holding as the schema grows, which is the only kind of governance that
-- survives contact with a roadmap.

begin;
select plan(40);

-- ===========================================================================
-- A. SECURITY DEFINER privilege governance
-- ===========================================================================

-- A definer function runs as its owner. Without a pinned search_path an
-- attacker who can create objects in a schema earlier on the path can shadow a
-- table or operator the function resolves unqualified, and the function will
-- happily run their version as the owner.
--
-- PRESENCE IS NOT ENOUGH. `search_path=public` is pinned and useless: `public`
-- is exactly the writable schema an attacker would plant a shadowing object in.
-- So the assertion is on the VALUE, against the two forms actually in use:
--
--   search_path=""            428 functions - resolve nothing implicitly
--   search_path=pg_catalog      1 function  - rls_auto_enable(), an event
--                                             trigger helper that needs the
--                                             catalog and nothing else
--
-- Anything else - `public`, `$user`, or any writable schema - fails here.
select is(
  (select count(*)::int
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prosecdef
      and coalesce(array_to_string(p.proconfig, ','), '') not in
          ('search_path=""', 'search_path=pg_catalog')),
  0,
  'every SECURITY DEFINER function uses an approved safe search_path value'
);

-- Stated separately so the failure message says which schema drifted.
select is(
  (select count(*)::int
     from pg_proc p
     join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.prosecdef
      and coalesce(array_to_string(p.proconfig, ','), '') <> 'search_path=""'),
  0,
  'every private SECURITY DEFINER function resolves nothing implicitly'
);

-- The complete anon-executable definer surface. Anything beyond this list is a
-- new public entry point and must be reviewed rather than discovered.
select set_eq(
  $$select (p.oid::regprocedure)::text
      from pg_proc p
      join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public'
       and p.prosecdef
       and has_function_privilege('anon', p.oid, 'EXECUTE')$$,
  array[
    'accept_quotation_by_capability(text,text,text)',
    'check_public_commerce_pincode(text)',
    'get_public_commerce_product(text)',
    'get_quotation_by_capability(text)',
    'list_public_commerce_categories()',
    'list_public_commerce_sitemap()',
    'search_public_commerce_products(text,text,text,bigint,bigint,text,boolean,integer,integer)'
  ],
  'exactly the reviewed set of definer functions is anon-executable'
);

-- `authorize` is the permission oracle every policy calls. It MUST stay
-- INVOKER: as DEFINER it would evaluate the owner's permissions instead of the
-- caller's and answer true for everyone.
select is(
  (select p.prosecdef from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'authorize'),
  false,
  'public.authorize is SECURITY INVOKER'
);

select ok(
  has_function_privilege('authenticated', 'public.authorize(text)', 'EXECUTE'),
  'authenticated may call public.authorize'
);

select ok(
  not has_function_privilege('anon', 'public.authorize(text)', 'EXECUTE'),
  'anon may not call public.authorize'
);

-- Lead intake is service-role only. The public form reaches it through the
-- server route, never directly from a browser session.
select ok(
  not has_function_privilege('anon', (
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'submit_lead_intake'), 'EXECUTE'),
  'anon cannot execute submit_lead_intake'
);

select ok(
  not has_function_privilege('authenticated', (
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'submit_lead_intake'), 'EXECUTE'),
  'authenticated cannot execute submit_lead_intake'
);

select ok(
  has_function_privilege('service_role', (
    select p.oid::regprocedure from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.proname = 'submit_lead_intake'), 'EXECUTE'),
  'service_role can execute submit_lead_intake'
);

-- The two capability RPCs are the whole point of the quotation acceptance
-- flow: a customer with a link and no account.
select ok(
  has_function_privilege('anon', 'public.get_quotation_by_capability(text)', 'EXECUTE'),
  'quotation capability lookup stays anon-callable'
);

select ok(
  has_function_privilege('anon', 'public.accept_quotation_by_capability(text,text,text)', 'EXECUTE'),
  'quotation capability acceptance stays anon-callable'
);

-- WHY THERE IS NO "NO PRIVATE HELPER IS AUTHENTICATED-EXECUTABLE" RULE.
--
-- 94 of the 320 private functions ARE executable by authenticated, and that is
-- the design rather than a leak. Two distinct reasons:
--
--   1. RLS policy helpers. private.crm_can_view_lead is called from inside the
--      consent policies. A policy expression runs with the caller's privileges,
--      so if authenticated could not execute it, every policy using it would
--      error instead of filtering.
--
--   2. The *_impl bodies self-authorize. private.assign_lead_impl opens with
--      auth.uid() and authorize('leads.assign') and raises 42501 on either, so
--      reaching it directly is equivalent to reaching it through its wrapper.
--
-- The boundary that matters is therefore not the schema. It is which privileged
-- routines stay closed, which is what follows.

-- The service-role-only surface: 30 public definer functions anon and
-- authenticated must never reach - campaign run operations, WhatsApp ingest and
-- dispatch, COD order creation, landing publication verification, lead intake,
-- quotation grant issuance, project materialization.
--
-- Frozen as an exact set on purpose. If one gains authenticated EXECUTE it
-- drops out and this fails; if a new backend RPC appears it is added and this
-- fails until somebody classifies it. Both are the review this contract exists
-- to force.
select set_eq(
  $CONTRACT$select (p.oid::regprocedure)::text
      from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'public' and p.prosecdef
       and has_function_privilege('service_role', p.oid, 'EXECUTE')
       and not has_function_privilege('authenticated', p.oid, 'EXECUTE')$CONTRACT$,
  array[
    'bind_campaign_run_operation(uuid,text,text,text,text)',
    'bind_whatsapp_send_intent_dispatch(uuid,text,timestamp with time zone)',
    'claim_campaign_run_operation(text,integer)',
    'claim_whatsapp_send_intent_for_dispatch(uuid,text,text)',
    'complete_campaign_run_operation(uuid,text,jsonb)',
    'consume_commerce_public_rate_limit(text,text,text)',
    'create_public_commerce_cod_order(jsonb,jsonb,jsonb,uuid)',
    'enqueue_campaign_conversion_feedback(uuid)',
    'enqueue_campaign_metrics_sync(uuid,date)',
    'enqueue_pending_attributable_campaign_conversion_feedback()',
    'fail_campaign_run_operation(uuid,text,boolean)',
    'get_campaign_run_operation_for_reconcile(uuid)',
    'get_live_landing_publication(text)',
    'get_public_commerce_order_tracking_snapshot(text)',
    'ingest_meta_whatsapp_message(text,text,text,text,text,text,text,text,text,text,text,text,text,jsonb,text,timestamp with time zone)',
    'ingest_meta_whatsapp_status(text,text,text,text,text,text,text,text,timestamp with time zone,jsonb)',
    'issue_quotation_access_grant_internal(uuid,uuid,uuid,text,text,boolean)',
    'mark_campaign_conversion_feedback_state(uuid,text,text,text)',
    'mark_campaign_run_operation_needs_reconcile(uuid,text)',
    'materialize_closed_won_project_internal(uuid,text)',
    'quote_public_commerce_cart(jsonb,text,text)',
    'reconcile_whatsapp_dispatch_attempt(uuid,text)',
    'record_landing_exposure(uuid,uuid,text,text,text)',
    'record_whatsapp_dispatch_attempt_outcome(uuid,text,text,integer,jsonb)',
    'resolve_campaign_run_create_reconcile_found(uuid,text,text,text,text)',
    'submit_lead_intake(uuid,text,text,text,text,text,text,text,text,text,text,text[],text,jsonb,text,text,text,jsonb,text,boolean,boolean,boolean,boolean,text,text,text,text,text,text,text,text)',
    'upsert_campaign_metric_snapshot(uuid,timestamp with time zone,timestamp with time zone,text,bigint,bigint,bigint,bigint,text,text)',
    'verify_campaign_execution_context_binding(text,text,text,text,integer,text)',
    'verify_live_landing_publication_context(text,text,integer,text,text)',
    'verify_public_commerce_order_tracking_identity(text,text)'
  ],
  'the service-role-only RPC surface is exactly the reviewed set'
);

select is(
  (select count(*)::int
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.prosecdef
      and has_function_privilege('service_role', p.oid, 'EXECUTE')
      and not has_function_privilege('authenticated', p.oid, 'EXECUTE')
      and has_function_privilege('anon', p.oid, 'EXECUTE')),
  0,
  'no service-role-only RPC is executable by anon'
);

-- The privileged private helpers. These do NOT self-authorize the way the
-- *_impl bodies do - they are the internals those bodies call once a permission
-- check has already passed - so reaching them directly would skip the check.
select is(
  (select count(*)::int
     from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and p.proname in (
        'salary_append_event', 'salary_require_manager', 'salary_profile_for_date',
        'salary_statement_totals', 'staff_append_admin_event',
        'staff_require_credential_admin', 'staff_finalize_invite_from_saga',
        'staff_guard_login_phone_drift', 'derive_attendance_day'
      )
      and (has_function_privilege('authenticated', p.oid, 'EXECUTE')
        or has_function_privilege('anon', p.oid, 'EXECUTE'))),
  0,
  'privileged private helpers stay closed to anon and authenticated'
);

-- anon cannot even resolve a name inside private, which is what makes any stray
-- ACL there moot rather than merely unused.
select ok(
  not has_schema_privilege('anon', 'private', 'USAGE'),
  'anon has no USAGE on the private schema'
);

-- ===========================================================================
-- B. Table privilege governance
-- ===========================================================================

-- TRUNCATE IS NOT SUBJECT TO RLS. Neither is the right to attach a trigger.
-- Granting either to the end-user role puts a hole straight through every
-- policy on the table, which is how a logged-in user came to be able to empty
-- the payroll ledger. These two assertions are the reason this file exists.
select is(
  (select count(*)::int
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and has_table_privilege('authenticated', c.oid, 'TRUNCATE')),
  0,
  'authenticated holds TRUNCATE on no public table'
);

select is(
  (select count(*)::int
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and has_table_privilege('authenticated', c.oid, 'TRIGGER')),
  0,
  'authenticated holds TRIGGER on no public table'
);

-- REFERENCES was revoked alongside the other two and belongs to the same
-- invariant. Relational shape is owned by migrations and the trusted backend;
-- an end-user runtime role has no business creating foreign keys against
-- application tables, and a key it owns can pin rows another role is entitled
-- to delete. Asserted dynamically like its siblings so a future table cannot
-- reintroduce it by inheriting Supabase's default GRANT ALL.
select is(
  (select count(*)::int
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and has_table_privilege('authenticated', c.oid, 'REFERENCES')),
  0,
  'authenticated holds REFERENCES on no public table'
);

select is(
  (select count(*)::int
     from pg_class c
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and (has_table_privilege('anon', c.oid, 'INSERT')
        or has_table_privilege('anon', c.oid, 'UPDATE')
        or has_table_privilege('anon', c.oid, 'DELETE')
        or has_table_privilege('anon', c.oid, 'TRUNCATE')
        or has_table_privilege('anon', c.oid, 'TRIGGER'))),
  0,
  'anon can only ever read, never write or truncate'
);

-- The public website reads published portfolio content directly; everything
-- else anon might touch goes through a reviewed RPC.
select set_eq(
  $$select c.relname::text
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r','p')
       and has_table_privilege('anon', c.oid, 'SELECT')$$,
  array[
    'portfolio_media',
    'portfolio_project_categories',
    'portfolio_project_services',
    'portfolio_projects'
  ],
  'anon reads exactly the four public portfolio tables'
);

-- ===========================================================================
-- C. RLS is mandatory; FORCE RLS is a reviewed subset
-- ===========================================================================

select is(
  (select count(*)::int
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r', 'p')
      and not c.relrowsecurity),
  0,
  'every public table has row level security enabled'
);

-- FORCE RLS additionally binds the TABLE OWNER. It is required where a definer
-- function owned by that role must not become a way around the policies:
-- money, payroll, attendance records and campaign metrics. It is deliberately
-- NOT universal — elsewhere owner-side definer workflows are the intended
-- mechanism — so this asserts the protected set is present, not that it is the
-- whole schema.
select is(
  (select count(*)::int
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p')
      and c.relname like 'salary\_%'
      and not c.relforcerowsecurity),
  0,
  'every salary table forces RLS against the owner'
);

select is(
  (select count(*)::int
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relkind in ('r','p')
      and c.relname like 'commerce\_%'
      and not c.relforcerowsecurity),
  0,
  'every commerce table forces RLS against the owner'
);

select ok(
  (select bool_and(c.relforcerowsecurity)
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('attendance_submissions', 'attendance_submission_events')),
  'attendance submissions force RLS against the owner'
);

-- Campaign metrics are the fourth member of the reviewed FORCE set and were
-- described as such without being pinned. They are written by service-role
-- ingestion and read by the owner's reporting, so owner bypass here would put
-- spend and conversion figures outside the policies that scope them.
select ok(
  (select bool_and(c.relforcerowsecurity)
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('campaign_metric_snapshots',
                        'campaign_conversion_feedback_events')),
  'campaign metric tables force RLS against the owner'
);

-- ===========================================================================
-- D. Service-only tables: the protection IS the absent policy
-- ===========================================================================

-- RLS enabled with no policy is default-deny. These six are reachable only
-- through postgres-owned definer routines, so listing them makes the design a
-- decision on the record rather than something a reader has to infer from an
-- empty pg_policy result.
select set_eq(
  $$select c.relname::text
      from pg_class c join pg_namespace n on n.oid = c.relnamespace
     where n.nspname = 'public' and c.relkind in ('r','p') and c.relrowsecurity
       and (select count(*) from pg_policy pol where pol.polrelid = c.oid) = 0$$,
  array[
    'quotation_access_grants',
    'whatsapp_business_accounts',
    'whatsapp_message_status_events',
    'whatsapp_phone_numbers',
    'whatsapp_templates',
    'whatsapp_webhook_events'
  ],
  'exactly the reviewed service-only tables carry no policy'
);

-- Belt and braces: they are also unreachable at the GRANT layer, so the
-- default-deny does not rest on the policy layer alone.
select is(
  (select count(*)::int
     from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('quotation_access_grants', 'whatsapp_business_accounts',
                        'whatsapp_message_status_events', 'whatsapp_phone_numbers',
                        'whatsapp_templates', 'whatsapp_webhook_events')
      and (has_table_privilege('anon', c.oid, 'SELECT')
        or has_table_privilege('authenticated', c.oid, 'SELECT')
        or has_table_privilege('authenticated', c.oid, 'INSERT')
        or has_table_privilege('authenticated', c.oid, 'UPDATE')
        or has_table_privilege('authenticated', c.oid, 'DELETE'))),
  0,
  'service-only tables grant nothing to anon or authenticated'
);

-- ===========================================================================
-- E. Consent: visibility and write authority
-- ===========================================================================

-- Two PERMISSIVE SELECT policies are OR-combined, so each must be safe alone.
select is(
  (select count(*)::int from pg_policy pol
     join pg_class c on c.oid = pol.polrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'consent_events'),
  2,
  'consent_events carries exactly the two reviewed policies'
);

select is(
  (select count(*)::int from pg_policy pol
     join pg_class c on c.oid = pol.polrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'consent_events'
      and pol.polcmd <> 'r'),
  0,
  'no policy permits writing consent through the table'
);

-- The narrower policy is lead-scoped: the row''s OWN lead must be visible.
select ok(
  (select pg_get_expr(pol.polqual, pol.polrelid) like '%crm_can_view_lead%'
     from pg_policy pol join pg_class c on c.oid = pol.polrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'consent_events'
      and pol.polname = 'consent_events_select_crm_scoped'),
  'CRM consent visibility is bounded by lead visibility'
);

select ok(
  (select pg_get_expr(pol.polqual, pol.polrelid) like '%consents.read%'
     from pg_policy pol join pg_class c on c.oid = pol.polrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'consent_events'
      and pol.polname = 'consent_events_select_crm_scoped'),
  'CRM consent visibility requires the consents.read permission'
);

-- The wider policy is contact-scoped, which is deliberate: marketing consent
-- belongs to the PERSON, and someone managing it must see every consent that
-- person has given or withdrawn, or they will message somebody who said no.
-- Its blast radius is held by three conditions at once, and the MARKETING
-- restriction is the one that keeps service-purpose rows out of it.
select ok(
  (select pg_get_expr(pol.polqual, pol.polrelid) like '%MARKETING%'
     from pg_policy pol join pg_class c on c.oid = pol.polrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'consent_events'
      and pol.polname = 'consent_events_select_marketing_staff'),
  'the marketing policy exposes MARKETING rows only'
);

select ok(
  (select pg_get_expr(pol.polqual, pol.polrelid) like '%marketing_consents.manage%'
     from pg_policy pol join pg_class c on c.oid = pol.polrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'consent_events'
      and pol.polname = 'consent_events_select_marketing_staff'),
  'the marketing policy requires the marketing_consents.manage permission'
);

select ok(
  (select pg_get_expr(pol.polqual, pol.polrelid) like '%crm_can_view_lead%'
     from pg_policy pol join pg_class c on c.oid = pol.polrelid
     join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public' and c.relname = 'consent_events'
      and pol.polname = 'consent_events_select_marketing_staff'),
  'the marketing policy still requires a visible lead for that contact'
);

-- Consent is append-only from outside: no role may write the table directly,
-- so every row is produced by a postgres-owned definer routine.
select ok(
  not (has_table_privilege('authenticated', 'public.consent_events', 'INSERT')
    or has_table_privilege('authenticated', 'public.consent_events', 'UPDATE')
    or has_table_privilege('authenticated', 'public.consent_events', 'DELETE')),
  'authenticated cannot write consent rows directly'
);

select ok(
  not (has_table_privilege('service_role', 'public.consent_events', 'INSERT')
    or has_table_privilege('service_role', 'public.consent_events', 'UPDATE')
    or has_table_privilege('service_role', 'public.consent_events', 'DELETE')),
  'not even service_role writes consent rows directly'
);

select ok(
  not has_table_privilege('anon', 'public.consent_events', 'SELECT'),
  'anon cannot read consent rows'
);

-- ===========================================================================
-- F. Behaviour, not just catalogue: anon really is refused
-- ===========================================================================

set local role anon;

select throws_ok(
  $$select 1 from public.consent_events limit 1$$,
  '42501',
  NULL,
  'anon selecting consent_events is refused outright'
);

select throws_ok(
  $$select 1 from public.salary_statements limit 1$$,
  '42501',
  NULL,
  'anon selecting payroll is refused outright'
);

select throws_ok(
  $$select 1 from public.whatsapp_webhook_events limit 1$$,
  '42501',
  NULL,
  'anon selecting a service-only table is refused outright'
);

reset role;

select * from finish();
rollback;
