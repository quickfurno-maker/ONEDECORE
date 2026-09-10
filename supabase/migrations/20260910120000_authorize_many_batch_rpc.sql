-- Answer many permission questions in one round trip.
--
-- WHAT THE MEASUREMENT SAID
--
-- `pg_stat_statements` on the managed project, accumulated since 2026-07-24:
--
--   public.authorize(text)   65,586 calls   220,276 ms   3.36 ms mean
--   every PostgREST request  78,938 calls
--
-- Eighty-three per cent of every database round trip this application has ever
-- made was an authorization check. Not a slow one — 3.36 ms for a five-table
-- EXISTS under RLS is unremarkable, and `role_permissions` and `permissions`
-- show ~200,000 index scans each, so the plan is already index-driven. The cost
-- is the count.
--
-- Instrumenting one real path made the shape concrete: resolving the CRM access
-- context for a single request issues TWENTY-ONE `authorize` calls, every one
-- for a different permission, none duplicated. The admin layout's navigation
-- flags add roughly forty more before the page itself runs. The page genuinely
-- needs to know all of those things; it does not need twenty-one network round
-- trips to find out.
--
-- WHY THIS IS SAFE
--
-- It is a loop over `public.authorize`, not a reimplementation of it. Every code
-- is answered by the same function, which calls the same
-- `private.has_permission`, which still checks `auth.uid()`,
-- `private.staff_access_denied`, the active role, the active permission and the
-- active profile. There is no second copy of the access rules to drift.
--
-- That property is the whole design. A batch endpoint that inlined the join —
-- one query returning every granted code — would be faster still and would be a
-- second implementation of the authorization matrix, which is exactly the thing
-- this repository has spent five lanes removing.
--
-- WHAT IT DOES NOT DO
--
-- It does not cache. It does not persist. It is `stable`, so within a single
-- statement the planner may reuse a result, and across statements it re-reads —
-- the same guarantee `authorize` already gives. Nothing here changes who may do
-- what; it changes how many times the client has to ask.

create function public.authorize_many(requested_permissions text[])
returns jsonb
language sql
stable
security invoker
set search_path = ''
as $$
  select coalesce(
    jsonb_object_agg(code, public.authorize(code)),
    '{}'::jsonb
  )
  from (
    /*
     * DISTINCT because asking twice costs twice and answers the same, and
     * bounded because an unbounded array is a way to spend the server's time
     * cheaply. Fifty is comfortably above the largest real fan-out measured
     * (twenty-one for the CRM context) and far below anything worth worrying
     * about.
     */
    select distinct trim(code) as code
    from unnest(requested_permissions) as code
    where code is not null and trim(code) <> ''
    limit 50
  ) as codes;
$$;

comment on function public.authorize_many(text[])
is 'Returns a JSON object mapping each requested permission code to whether the current authenticated user holds it. Delegates to public.authorize per code; the access rules live there and nowhere else.';

revoke execute on function public.authorize_many(text[])
from public, anon;

grant execute on function public.authorize_many(text[])
to authenticated;
