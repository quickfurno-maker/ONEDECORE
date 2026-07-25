-- Ensure platform RLS event-trigger helper exists for local development environment compatibility.
-- On remote Supabase hosted instances, this function and event trigger are provisioned by the platform.
do $$
begin
  if not exists (
    select 1 from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'rls_auto_enable'
  ) then
    create function public.rls_auto_enable()
    returns event_trigger
    language plpgsql
    security definer
    set search_path = pg_catalog
    as $func$
    begin
      null;
    end;
    $func$;

    create event trigger ensure_rls on ddl_command_end
    when tag in ('CREATE TABLE', 'CREATE TABLE AS')
    execute function public.rls_auto_enable();
  end if;
end $$;

-- Prevent direct API invocation of the platform RLS event-trigger helper.
-- The ensure_rls event trigger remains enabled and owned by postgres.
revoke execute on function public.rls_auto_enable()
from public, anon, authenticated;

-- Cover the assigned_by foreign key and actor-based audit lookups.
create index idx_user_roles_assigned_by
on public.user_roles (assigned_by);
