create function public.authorize(requested_permission text)
returns boolean
language sql
stable
security invoker
set search_path = ''
as $$
  select private.has_permission(requested_permission);
$$;

comment on function public.authorize(text)
is 'Returns whether the current authenticated user has the requested active permission.';

revoke execute on function public.authorize(text)
from public, anon;

grant execute on function public.authorize(text)
to authenticated;
