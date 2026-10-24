-- CRM-SYNC-9 protected STAGING reviewer only. READ-ONLY; no client rows.
-- Export returned JSON objects into a sanitized array file; DO NOT run
-- against production as a substitute for genuine staging RLS certification.
SELECT n.nspname AS schema_name,
       c.relname AS table_name,
       c.relrowsecurity AS rls_enabled,
       c.relforcerowsecurity AS forced_rls,
       COALESCE(
         json_agg(json_build_object(
           'name', p.polname,
           'cmd', p.polcmd,
           'permissive', p.polpermissive,
           'roles', ARRAY(SELECT rolname FROM pg_roles WHERE oid = ANY(p.polroles)),
           'predicate', pg_get_expr(p.polqual, p.polrelid)
         )) FILTER (WHERE p.oid IS NOT NULL),
         '[]'::json
       ) AS policies
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
LEFT JOIN pg_policy p ON p.polrelid = c.oid
WHERE n.nspname = 'public'
  AND c.relkind = 'r'
  AND c.relname IN ('leads','whatsapp_conversations','whatsapp_messages')
GROUP BY n.nspname, c.relname, c.relrowsecurity, c.relforcerowsecurity
ORDER BY c.relname;
