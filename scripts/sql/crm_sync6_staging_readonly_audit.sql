-- CRM-SYNC-6 INDEPENDENT DBA READ-ONLY EVIDENCE QUERIES.
-- Run only against explicitly approved isolated ONEDECORE STAGING.
-- Requires a read-only reviewer connection; never paste credentials into reports.
-- NO DDL, mutation, permission changes, trigger execution or provider calls.
-- 1. Applied migration truth. Compare against 109 source migration versions.
SELECT version
FROM supabase_migrations.schema_migrations
ORDER BY version;

-- 2. CRM table RLS posture and policy counts.
SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS force_rls,
       count(p.oid)::integer AS policy_count
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND (
    c.relname = 'leads'
    OR c.relname LIKE 'crm_%'
    OR c.relname LIKE 'whatsapp_%'
  )
GROUP BY n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
ORDER BY c.relname;

-- 3. Privileged CRM function invocation surfaces. Return metadata only.
SELECT n.nspname AS schema_name,
       p.proname AS function_name,
       p.prosecdef AS security_definer,
       has_schema_privilege('anon', n.oid, 'USAGE') AS anonymous_schema_usage,
       has_function_privilege('anon', p.oid, 'EXECUTE') AS anonymous_function_execute,
       has_schema_privilege('authenticated', n.oid, 'USAGE') AS authenticated_schema_usage,
       has_function_privilege('authenticated', p.oid, 'EXECUTE') AS authenticated_function_execute
FROM pg_proc p
JOIN pg_namespace n ON n.oid = p.pronamespace
WHERE n.nspname IN ('public','private')
  AND (
    p.proname LIKE 'crm_%'
    OR p.proname LIKE '%whatsapp%'
    OR p.proname LIKE '%nurture%'
  )
ORDER BY n.nspname, p.proname;

-- 4. Policies for the direct lead and WhatsApp access surface.
-- Expressions contain policy logic but no customer row data.
SELECT schemaname, tablename, policyname, permissive, roles, cmd, qual, with_check
FROM pg_policies
WHERE schemaname = 'public'
  AND tablename IN ('leads','whatsapp_conversations','whatsapp_messages','whatsapp_campaign_recipients')
ORDER BY tablename, policyname;
