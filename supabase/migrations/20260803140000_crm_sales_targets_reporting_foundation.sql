-- Phase 5E-B — CRM sales targets & non-commercial reporting foundation (migration 16)

-- =============================================================================
-- A. Permissions
-- =============================================================================

insert into public.permissions (code, name, description, is_system, is_active)
values
  (
    'sales_targets.read',
    'Read Sales Targets',
    'View sales target configuration and history within role scope',
    true,
    true
  ),
  (
    'sales_targets.manage',
    'Manage Sales Targets',
    'Create, revise, lock, and reopen sales targets (Super Admin only)',
    true,
    true
  ),
  (
    'crm.reporting.read',
    'Read CRM Reporting',
    'View non-commercial CRM reporting within role scope',
    true,
    true
  )
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  is_system = excluded.is_system,
  is_active = excluded.is_active;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where p.code in ('sales_targets.read', 'sales_targets.manage', 'crm.reporting.read')
  and (
    (
      p.code in ('sales_targets.read', 'crm.reporting.read')
      and r.code in ('super_admin', 'sales_manager', 'management', 'sales_executive', 'sales')
    )
    or (p.code = 'sales_targets.manage' and r.code = 'super_admin')
  )
on conflict do nothing;

-- =============================================================================
-- B. Tables
-- =============================================================================

create table public.sales_targets (
  id uuid primary key default gen_random_uuid(),
  target_scope text not null,
  target_month date not null,
  target_user_id uuid references public.profiles (id) on delete restrict,
  revenue_target_paise bigint not null,
  closed_won_count_target integer not null,
  currency text not null default 'INR',
  status text not null default 'open',
  revision integer not null default 1,
  last_reason text not null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_sales_targets_scope check (
    target_scope in ('executive_personal', 'sales_team')
  ),
  constraint chk_sales_targets_month_first_day check (
    target_month = date_trunc('month', target_month)::date
  ),
  constraint chk_sales_targets_scope_user_invariant check (
    (target_scope = 'executive_personal' and target_user_id is not null)
    or (target_scope = 'sales_team' and target_user_id is null)
  ),
  constraint chk_sales_targets_revenue check (
    revenue_target_paise > 0 and revenue_target_paise <= 100000000000
  ),
  constraint chk_sales_targets_closed_won_count check (
    closed_won_count_target > 0 and closed_won_count_target <= 10000
  ),
  constraint chk_sales_targets_currency check (currency = 'INR'),
  constraint chk_sales_targets_status check (status in ('open', 'locked')),
  constraint chk_sales_targets_revision check (revision >= 1),
  constraint chk_sales_targets_last_reason check (
    length(trim(last_reason)) between 10 and 500
  )
);

comment on table public.sales_targets is
  'Monthly sales target configuration. Commercial achievement is not stored; Phase 7B derives accepted-quotation truth at query time.';

create unique index uq_sales_targets_team_month
  on public.sales_targets (target_month)
  where target_scope = 'sales_team';

create unique index uq_sales_targets_executive_month_user
  on public.sales_targets (target_month, target_user_id)
  where target_scope = 'executive_personal';

create index idx_sales_targets_scope_month
  on public.sales_targets (target_scope, target_month desc);

create index idx_sales_targets_user_month
  on public.sales_targets (target_user_id, target_month desc)
  where target_scope = 'executive_personal';

create trigger trg_sales_targets_updated_at
  before update on public.sales_targets
  for each row execute function private.set_updated_at();

create table public.sales_target_events (
  id uuid primary key default gen_random_uuid(),
  target_id uuid not null references public.sales_targets (id) on delete restrict,
  event_type text not null,
  revision integer not null,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  reason text not null,
  before_snapshot jsonb,
  after_snapshot jsonb not null,
  occurred_at timestamptz not null default now(),

  constraint chk_sales_target_events_type check (
    event_type in ('target.created', 'target.revised', 'target.locked', 'target.reopened')
  ),
  constraint chk_sales_target_events_revision check (revision >= 1),
  constraint chk_sales_target_events_reason check (
    length(trim(reason)) between 10 and 500
  ),
  constraint chk_sales_target_events_after_snapshot check (
    jsonb_typeof(after_snapshot) = 'object'
  ),
  constraint chk_sales_target_events_before_snapshot check (
    before_snapshot is null or jsonb_typeof(before_snapshot) = 'object'
  )
);

comment on table public.sales_target_events is
  'Append-only sales target history. No delete path.';

create index idx_sales_target_events_target_occurred
  on public.sales_target_events (target_id, occurred_at desc);

create trigger trg_sales_target_events_no_update
  before update on public.sales_target_events
  for each row execute function private.forbid_append_only_mutation();

create trigger trg_sales_target_events_no_delete
  before delete on public.sales_target_events
  for each row execute function private.forbid_append_only_mutation();

-- =============================================================================
-- C. Reporting index
-- =============================================================================

create index idx_lead_follow_ups_owner_status_due
  on public.lead_follow_ups (owner_id, status, due_at);

-- =============================================================================
-- D. Private helpers
-- =============================================================================

create or replace function private.crm_has_broad_sales_target_read()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = auth.uid()
      and r.is_active = true
      and r.code in ('super_admin', 'sales_manager', 'management')
  );
$$;

create or replace function private.crm_can_view_sales_target(
  p_scope text,
  p_target_user_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select case
    when auth.uid() is null then false
    when not (select private.has_permission('sales_targets.read')) then false
    when (select private.crm_has_broad_sales_target_read()) then true
    when p_scope = 'executive_personal' and p_target_user_id = auth.uid() then true
    else false
  end;
$$;

create or replace function private.crm_sales_target_row_to_snapshot(p_row public.sales_targets)
returns jsonb
language sql
immutable
set search_path = ''
as $$
  select jsonb_build_object(
    'id', p_row.id,
    'target_scope', p_row.target_scope,
    'target_month', p_row.target_month,
    'target_user_id', p_row.target_user_id,
    'revenue_target_paise', p_row.revenue_target_paise,
    'closed_won_count_target', p_row.closed_won_count_target,
    'currency', p_row.currency,
    'status', p_row.status,
    'revision', p_row.revision,
    'last_reason', p_row.last_reason
  );
$$;

create or replace function private.crm_assert_sales_target_reason(p_reason text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_reason text;
begin
  v_reason := trim(p_reason);
  if v_reason is null or length(v_reason) < 10 or length(v_reason) > 500 then
    raise exception 'CRM_SALES_TARGET_INVALID_REASON' using errcode = '22023';
  end if;
  return v_reason;
end;
$$;

create or replace function private.crm_assert_sales_target_month(p_target_month date)
returns date
language plpgsql
stable
set search_path = ''
as $$
begin
  if p_target_month is null then
    raise exception 'CRM_SALES_TARGET_INVALID_MONTH' using errcode = '22023';
  end if;
  if p_target_month <> date_trunc('month', p_target_month)::date then
    raise exception 'CRM_SALES_TARGET_MONTH_NOT_FIRST_DAY' using errcode = '22023';
  end if;
  return p_target_month;
end;
$$;

create or replace function private.crm_assert_sales_target_bounds(
  p_revenue_target_paise bigint,
  p_closed_won_count_target integer
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if p_revenue_target_paise is null
    or p_revenue_target_paise <= 0
    or p_revenue_target_paise > 100000000000 then
    raise exception 'CRM_SALES_TARGET_INVALID_REVENUE' using errcode = '22023';
  end if;
  if p_closed_won_count_target is null
    or p_closed_won_count_target <= 0
    or p_closed_won_count_target > 10000 then
    raise exception 'CRM_SALES_TARGET_INVALID_CLOSED_WON_COUNT' using errcode = '22023';
  end if;
end;
$$;

create or replace function private.crm_append_sales_target_event(
  p_target_id uuid,
  p_event_type text,
  p_revision integer,
  p_actor_id uuid,
  p_reason text,
  p_before_snapshot jsonb,
  p_after_snapshot jsonb
)
returns public.sales_target_events
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.sales_target_events%rowtype;
begin
  insert into public.sales_target_events (
    target_id,
    event_type,
    revision,
    actor_id,
    reason,
    before_snapshot,
    after_snapshot
  ) values (
    p_target_id,
    p_event_type,
    p_revision,
    p_actor_id,
    p_reason,
    p_before_snapshot,
    p_after_snapshot
  )
  returning * into v_row;

  return v_row;
end;
$$;

-- =============================================================================
-- E. Mutation RPC implementations
-- =============================================================================

create or replace function private.create_sales_target_impl(
  p_target_scope text,
  p_target_month date,
  p_target_user_id uuid,
  p_revenue_target_paise bigint,
  p_closed_won_count_target integer,
  p_reason text
)
returns public.sales_targets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_reason text;
  v_month date;
  v_row public.sales_targets%rowtype;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'CRM_SALES_TARGET_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not (select public.authorize('sales_targets.manage')) then
    raise exception 'CRM_SALES_TARGET_PERMISSION_DENIED' using errcode = '42501';
  end if;

  if p_target_scope not in ('executive_personal', 'sales_team') then
    raise exception 'CRM_SALES_TARGET_INVALID_SCOPE' using errcode = '22023';
  end if;

  v_month := private.crm_assert_sales_target_month(p_target_month);
  v_reason := private.crm_assert_sales_target_reason(p_reason);
  perform private.crm_assert_sales_target_bounds(
    p_revenue_target_paise,
    p_closed_won_count_target
  );

  if p_target_scope = 'executive_personal' then
    if p_target_user_id is null then
      raise exception 'CRM_SALES_TARGET_EXECUTIVE_USER_REQUIRED' using errcode = '22023';
    end if;
    if not (select private.crm_is_assignable_sales_user(p_target_user_id)) then
      raise exception 'CRM_SALES_TARGET_INELIGIBLE_EXECUTIVE' using errcode = '22023';
    end if;
  elsif p_target_scope = 'sales_team' then
    if p_target_user_id is not null then
      raise exception 'CRM_SALES_TARGET_TEAM_USER_FORBIDDEN' using errcode = '22023';
    end if;
  end if;

  begin
    insert into public.sales_targets (
      target_scope,
      target_month,
      target_user_id,
      revenue_target_paise,
      closed_won_count_target,
      currency,
      status,
      revision,
      last_reason,
      created_by,
      updated_by
    ) values (
      p_target_scope,
      v_month,
      p_target_user_id,
      p_revenue_target_paise,
      p_closed_won_count_target,
      'INR',
      'open',
      1,
      v_reason,
      v_actor,
      v_actor
    )
    returning * into v_row;
  exception
    when unique_violation then
      raise exception 'CRM_SALES_TARGET_DUPLICATE' using errcode = '23505';
  end;

  perform private.crm_append_sales_target_event(
    v_row.id,
    'target.created',
    v_row.revision,
    v_actor,
    v_reason,
    null,
    private.crm_sales_target_row_to_snapshot(v_row)
  );

  return v_row;
end;
$$;

create or replace function private.revise_sales_target_impl(
  p_target_id uuid,
  p_expected_revision integer,
  p_revenue_target_paise bigint,
  p_closed_won_count_target integer,
  p_reason text
)
returns public.sales_targets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_reason text;
  v_before jsonb;
  v_row public.sales_targets%rowtype;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'CRM_SALES_TARGET_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not (select public.authorize('sales_targets.manage')) then
    raise exception 'CRM_SALES_TARGET_PERMISSION_DENIED' using errcode = '42501';
  end if;

  v_reason := private.crm_assert_sales_target_reason(p_reason);
  perform private.crm_assert_sales_target_bounds(
    p_revenue_target_paise,
    p_closed_won_count_target
  );

  select * into v_row from public.sales_targets where id = p_target_id for update;
  if not found then
    raise exception 'CRM_SALES_TARGET_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_row.status <> 'open' then
    raise exception 'CRM_SALES_TARGET_NOT_OPEN' using errcode = '22023';
  end if;

  if v_row.revision <> p_expected_revision then
    raise exception 'CRM_SALES_TARGET_REVISION_MISMATCH' using errcode = '22023';
  end if;

  if v_row.target_scope = 'executive_personal'
    and not (select private.crm_is_assignable_sales_user(v_row.target_user_id)) then
    raise exception 'CRM_SALES_TARGET_INELIGIBLE_EXECUTIVE' using errcode = '22023';
  end if;

  v_before := private.crm_sales_target_row_to_snapshot(v_row);

  update public.sales_targets
  set
    revenue_target_paise = p_revenue_target_paise,
    closed_won_count_target = p_closed_won_count_target,
    revision = v_row.revision + 1,
    last_reason = v_reason,
    updated_by = v_actor,
    updated_at = now()
  where id = p_target_id
  returning * into v_row;

  perform private.crm_append_sales_target_event(
    v_row.id,
    'target.revised',
    v_row.revision,
    v_actor,
    v_reason,
    v_before,
    private.crm_sales_target_row_to_snapshot(v_row)
  );

  return v_row;
end;
$$;

create or replace function private.lock_sales_target_impl(
  p_target_id uuid,
  p_expected_revision integer,
  p_reason text
)
returns public.sales_targets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_reason text;
  v_before jsonb;
  v_row public.sales_targets%rowtype;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'CRM_SALES_TARGET_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not (select public.authorize('sales_targets.manage')) then
    raise exception 'CRM_SALES_TARGET_PERMISSION_DENIED' using errcode = '42501';
  end if;

  v_reason := private.crm_assert_sales_target_reason(p_reason);

  select * into v_row from public.sales_targets where id = p_target_id for update;
  if not found then
    raise exception 'CRM_SALES_TARGET_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_row.status <> 'open' then
    raise exception 'CRM_SALES_TARGET_NOT_OPEN' using errcode = '22023';
  end if;

  if v_row.revision <> p_expected_revision then
    raise exception 'CRM_SALES_TARGET_REVISION_MISMATCH' using errcode = '22023';
  end if;

  v_before := private.crm_sales_target_row_to_snapshot(v_row);

  update public.sales_targets
  set
    status = 'locked',
    revision = v_row.revision + 1,
    last_reason = v_reason,
    updated_by = v_actor,
    updated_at = now()
  where id = p_target_id
  returning * into v_row;

  perform private.crm_append_sales_target_event(
    v_row.id,
    'target.locked',
    v_row.revision,
    v_actor,
    v_reason,
    v_before,
    private.crm_sales_target_row_to_snapshot(v_row)
  );

  return v_row;
end;
$$;

create or replace function private.reopen_sales_target_impl(
  p_target_id uuid,
  p_expected_revision integer,
  p_reason text
)
returns public.sales_targets
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_reason text;
  v_before jsonb;
  v_row public.sales_targets%rowtype;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'CRM_SALES_TARGET_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not (select public.authorize('sales_targets.manage')) then
    raise exception 'CRM_SALES_TARGET_PERMISSION_DENIED' using errcode = '42501';
  end if;

  v_reason := private.crm_assert_sales_target_reason(p_reason);

  select * into v_row from public.sales_targets where id = p_target_id for update;
  if not found then
    raise exception 'CRM_SALES_TARGET_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_row.status <> 'locked' then
    raise exception 'CRM_SALES_TARGET_NOT_LOCKED' using errcode = '22023';
  end if;

  if v_row.revision <> p_expected_revision then
    raise exception 'CRM_SALES_TARGET_REVISION_MISMATCH' using errcode = '22023';
  end if;

  v_before := private.crm_sales_target_row_to_snapshot(v_row);

  update public.sales_targets
  set
    status = 'open',
    revision = v_row.revision + 1,
    last_reason = v_reason,
    updated_by = v_actor,
    updated_at = now()
  where id = p_target_id
  returning * into v_row;

  perform private.crm_append_sales_target_event(
    v_row.id,
    'target.reopened',
    v_row.revision,
    v_actor,
    v_reason,
    v_before,
    private.crm_sales_target_row_to_snapshot(v_row)
  );

  return v_row;
end;
$$;

-- =============================================================================
-- F. Public INVOKER wrappers
-- =============================================================================

create or replace function public.create_sales_target(
  p_target_scope text,
  p_target_month date,
  p_target_user_id uuid,
  p_revenue_target_paise bigint,
  p_closed_won_count_target integer,
  p_reason text
)
returns public.sales_targets
language sql
security invoker
set search_path = ''
as $$
  select private.create_sales_target_impl(
    p_target_scope,
    p_target_month,
    p_target_user_id,
    p_revenue_target_paise,
    p_closed_won_count_target,
    p_reason
  );
$$;

create or replace function public.revise_sales_target(
  p_target_id uuid,
  p_expected_revision integer,
  p_revenue_target_paise bigint,
  p_closed_won_count_target integer,
  p_reason text
)
returns public.sales_targets
language sql
security invoker
set search_path = ''
as $$
  select private.revise_sales_target_impl(
    p_target_id,
    p_expected_revision,
    p_revenue_target_paise,
    p_closed_won_count_target,
    p_reason
  );
$$;

create or replace function public.lock_sales_target(
  p_target_id uuid,
  p_expected_revision integer,
  p_reason text
)
returns public.sales_targets
language sql
security invoker
set search_path = ''
as $$
  select private.lock_sales_target_impl(p_target_id, p_expected_revision, p_reason);
$$;

create or replace function public.reopen_sales_target(
  p_target_id uuid,
  p_expected_revision integer,
  p_reason text
)
returns public.sales_targets
language sql
security invoker
set search_path = ''
as $$
  select private.reopen_sales_target_impl(p_target_id, p_expected_revision, p_reason);
$$;

-- =============================================================================
-- G. RLS + table ACL hardening
-- =============================================================================

alter table public.sales_targets enable row level security;
alter table public.sales_target_events enable row level security;

revoke all on table public.sales_targets from public, anon, authenticated;
revoke all on table public.sales_target_events from public, anon, authenticated;

grant select on table public.sales_targets to authenticated;
grant select on table public.sales_target_events to authenticated;

create policy sales_targets_select
  on public.sales_targets for select to authenticated
  using (
    (select private.crm_can_view_sales_target(target_scope, target_user_id))
  );

create policy sales_target_events_select
  on public.sales_target_events for select to authenticated
  using (
    exists (
      select 1
      from public.sales_targets st
      where st.id = sales_target_events.target_id
        and (select private.crm_can_view_sales_target(st.target_scope, st.target_user_id))
    )
  );

-- =============================================================================
-- H. Ownership + execute grants
-- =============================================================================

alter function private.crm_has_broad_sales_target_read() owner to postgres;
alter function private.crm_can_view_sales_target(text, uuid) owner to postgres;
alter function private.crm_sales_target_row_to_snapshot(public.sales_targets) owner to postgres;
alter function private.crm_assert_sales_target_reason(text) owner to postgres;
alter function private.crm_assert_sales_target_month(date) owner to postgres;
alter function private.crm_assert_sales_target_bounds(bigint, integer) owner to postgres;
alter function private.crm_append_sales_target_event(uuid, text, integer, uuid, text, jsonb, jsonb) owner to postgres;
alter function private.create_sales_target_impl(text, date, uuid, bigint, integer, text) owner to postgres;
alter function private.revise_sales_target_impl(uuid, integer, bigint, integer, text) owner to postgres;
alter function private.lock_sales_target_impl(uuid, integer, text) owner to postgres;
alter function private.reopen_sales_target_impl(uuid, integer, text) owner to postgres;

alter function public.create_sales_target(text, date, uuid, bigint, integer, text) owner to postgres;
alter function public.revise_sales_target(uuid, integer, bigint, integer, text) owner to postgres;
alter function public.lock_sales_target(uuid, integer, text) owner to postgres;
alter function public.reopen_sales_target(uuid, integer, text) owner to postgres;

revoke all on function private.crm_has_broad_sales_target_read() from public, anon;
revoke all on function private.crm_can_view_sales_target(text, uuid) from public, anon;
revoke all on function private.crm_sales_target_row_to_snapshot(public.sales_targets) from public, anon;
revoke all on function private.crm_assert_sales_target_reason(text) from public, anon;
revoke all on function private.crm_assert_sales_target_month(date) from public, anon;
revoke all on function private.crm_assert_sales_target_bounds(bigint, integer) from public, anon;
revoke all on function private.crm_append_sales_target_event(uuid, text, integer, uuid, text, jsonb, jsonb) from public, anon;
revoke all on function private.create_sales_target_impl(text, date, uuid, bigint, integer, text) from public, anon;
revoke all on function private.revise_sales_target_impl(uuid, integer, bigint, integer, text) from public, anon;
revoke all on function private.lock_sales_target_impl(uuid, integer, text) from public, anon;
revoke all on function private.reopen_sales_target_impl(uuid, integer, text) from public, anon;

grant execute on function private.crm_has_broad_sales_target_read() to authenticated;
grant execute on function private.crm_can_view_sales_target(text, uuid) to authenticated;
grant execute on function private.create_sales_target_impl(text, date, uuid, bigint, integer, text) to authenticated;
grant execute on function private.revise_sales_target_impl(uuid, integer, bigint, integer, text) to authenticated;
grant execute on function private.lock_sales_target_impl(uuid, integer, text) to authenticated;
grant execute on function private.reopen_sales_target_impl(uuid, integer, text) to authenticated;

revoke all on function public.create_sales_target(text, date, uuid, bigint, integer, text) from public, anon;
revoke all on function public.revise_sales_target(uuid, integer, bigint, integer, text) from public, anon;
revoke all on function public.lock_sales_target(uuid, integer, text) from public, anon;
revoke all on function public.reopen_sales_target(uuid, integer, text) from public, anon;

grant execute on function public.create_sales_target(text, date, uuid, bigint, integer, text) to authenticated;
grant execute on function public.revise_sales_target(uuid, integer, bigint, integer, text) to authenticated;
grant execute on function public.lock_sales_target(uuid, integer, text) to authenticated;
grant execute on function public.reopen_sales_target(uuid, integer, text) to authenticated;
