-- CRM 2A-2 — Business SLA foundation (forward-only)
-- Inactive first_contact policy scaffold, business-window helpers, per-lead clocks,
-- non-retroactive activation model, crm.sla.manage (super_admin only).
-- Does NOT: activate production policy, seed hours, My Day, assign wiring, attempt marking,
-- breach daemon, payments, managed apply.

-- =============================================================================
-- A. Permission crm.sla.manage (super_admin only)
-- =============================================================================

insert into public.permissions (code, name, description, is_system, is_active)
values (
  'crm.sla.manage',
  'Manage CRM SLA Policy',
  'Configure and activate first-contact business SLA policy (Super Admin only)',
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
where p.code = 'crm.sla.manage'
  and r.code = 'super_admin'
on conflict do nothing;

-- =============================================================================
-- B. public.crm_sla_policies
-- =============================================================================

create table public.crm_sla_policies (
  policy_code text primary key,
  target_business_minutes integer not null,
  timezone text not null,
  business_hours_enabled boolean not null default false,
  business_hours_config jsonb,
  is_active boolean not null default false,
  effective_from timestamptz,
  activated_at timestamptz,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_crm_sla_policies_code
    check (policy_code ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint chk_crm_sla_policies_target_minutes
    check (target_business_minutes > 0 and target_business_minutes <= 10080),
  constraint chk_crm_sla_policies_hours_config_object check (
    business_hours_config is null
    or (
      jsonb_typeof(business_hours_config) = 'object'
      and pg_column_size(business_hours_config) <= 2048
    )
  ),
  constraint chk_crm_sla_policies_active_invariant check (
    is_active = false
    or (
      business_hours_enabled = true
      and business_hours_config is not null
      and effective_from is not null
      and activated_at is not null
    )
  )
);

comment on table public.crm_sla_policies is
  'CRM first-contact SLA policy. Seeded inactive with no hours. Activation is non-retroactive via effective_from/activated_at.';

comment on column public.crm_sla_policies.effective_from is
  'Non-retroactive receipt-scope boundary. Set once on first activation; never silently reset by normal edits.';

comment on column public.crm_sla_policies.activated_at is
  'First successful activation timestamp. Preserved across deactivation/reactivation.';

create trigger trg_crm_sla_policies_updated_at
  before update on public.crm_sla_policies
  for each row execute function private.set_updated_at();

alter table public.crm_sla_policies enable row level security;

revoke all on table public.crm_sla_policies from public, anon, authenticated;
grant select on table public.crm_sla_policies to authenticated;

create policy crm_sla_policies_select
  on public.crm_sla_policies
  for select
  to authenticated
  using (
    (select public.authorize('crm.sla.manage'))
    or (select public.authorize('crm.reporting.read'))
    or (select public.authorize('leads.read_all'))
    or (select public.authorize('leads.read'))
  );

insert into public.crm_sla_policies (
  policy_code,
  target_business_minutes,
  timezone,
  business_hours_enabled,
  business_hours_config,
  is_active,
  effective_from,
  activated_at
) values (
  'first_contact',
  60,
  'Asia/Kolkata',
  false,
  null,
  false,
  null,
  null
)
on conflict (policy_code) do nothing;

-- =============================================================================
-- C. Validators + business-window compute
-- =============================================================================

create or replace function private.crm_sla_timezone_is_valid(p_timezone text)
returns boolean
language sql
stable
set search_path = ''
as $$
  select p_timezone is not null
    and exists (
      select 1 from pg_catalog.pg_timezone_names t where t.name = p_timezone
    );
$$;

revoke all on function private.crm_sla_timezone_is_valid(text) from public, anon, authenticated;

create or replace function private.validate_crm_sla_business_hours_config(p_config jsonb)
returns boolean
language plpgsql
stable
set search_path = ''
as $$
declare
  v_key text;
  v_day jsonb;
  v_start text;
  v_end text;
  v_start_min int;
  v_end_min int;
  v_day_count int := 0;
  v_allowed text[] := array[
    'monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday', 'sunday'
  ];
begin
  if p_config is null or jsonb_typeof(p_config) <> 'object' then
    return false;
  end if;

  if pg_column_size(p_config) > 2048 then
    return false;
  end if;

  for v_key in select jsonb_object_keys(p_config)
  loop
    if not (v_key = any (v_allowed)) then
      return false;
    end if;

    v_day := p_config -> v_key;
    if jsonb_typeof(v_day) <> 'object' then
      return false;
    end if;

    if (select count(*) from jsonb_object_keys(v_day) k(key)) <> 2 then
      return false;
    end if;

    if not (v_day ? 'start' and v_day ? 'end') then
      return false;
    end if;

    if jsonb_typeof(v_day -> 'start') <> 'string' or jsonb_typeof(v_day -> 'end') <> 'string' then
      return false;
    end if;

    v_start := v_day ->> 'start';
    v_end := v_day ->> 'end';

    if v_start !~ '^[0-2][0-9]:[0-5][0-9]$' or v_end !~ '^[0-2][0-9]:[0-5][0-9]$' then
      return false;
    end if;

    v_start_min := (split_part(v_start, ':', 1)::int * 60) + split_part(v_start, ':', 2)::int;
    v_end_min := (split_part(v_end, ':', 1)::int * 60) + split_part(v_end, ':', 2)::int;

    if split_part(v_start, ':', 1)::int > 23 or split_part(v_end, ':', 1)::int > 23 then
      return false;
    end if;

    if v_start_min >= v_end_min then
      return false;
    end if;

    v_day_count := v_day_count + 1;
  end loop;

  if v_day_count < 1 then
    return false;
  end if;

  return true;
end;
$$;

revoke all on function private.validate_crm_sla_business_hours_config(jsonb)
  from public, anon, authenticated;

create or replace function private.crm_sla_weekday_key(p_local_date date)
returns text
language sql
immutable
set search_path = ''
as $$
  select case extract(dow from p_local_date)::integer
    when 0 then 'sunday'
    when 1 then 'monday'
    when 2 then 'tuesday'
    when 3 then 'wednesday'
    when 4 then 'thursday'
    when 5 then 'friday'
    when 6 then 'saturday'
  end;
$$;

revoke all on function private.crm_sla_weekday_key(date) from public, anon, authenticated;

create or replace function private.crm_sla_hhmm_to_minutes(p_hhmm text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select (split_part(p_hhmm, ':', 1)::integer * 60) + split_part(p_hhmm, ':', 2)::integer;
$$;

revoke all on function private.crm_sla_hhmm_to_minutes(text) from public, anon, authenticated;

create or replace function private.compute_business_sla_due_at(
  p_start timestamptz,
  p_target_business_minutes integer,
  p_timezone text,
  p_config jsonb
)
returns timestamptz
language plpgsql
stable
set search_path = ''
as $$
declare
  v_cursor timestamp;
  v_local_date date;
  v_day_key text;
  v_day jsonb;
  v_open timestamp;
  v_close timestamp;
  v_remaining interval;
  v_avail interval;
  v_guard integer := 0;
  v_max_days integer;
  v_weekly_minutes numeric := 0;
  v_key text;
  v_open_min integer;
  v_close_min integer;
begin
  if p_start is null
    or p_target_business_minutes is null
    or p_target_business_minutes <= 0
    or not (select private.crm_sla_timezone_is_valid(p_timezone))
    or not (select private.validate_crm_sla_business_hours_config(p_config))
  then
    return null;
  end if;

  -- Weekly business capacity (minutes) drives a domain-compatible iteration bound.
  for v_key in select jsonb_object_keys(p_config)
  loop
    v_open_min := private.crm_sla_hhmm_to_minutes(p_config -> v_key ->> 'start');
    v_close_min := private.crm_sla_hhmm_to_minutes(p_config -> v_key ->> 'end');
    v_weekly_minutes := v_weekly_minutes + (v_close_min - v_open_min);
  end loop;

  if v_weekly_minutes <= 0 then
    return null;
  end if;

  -- ceil(target / weekly) weeks of calendar days + 14-day mid-week / DST buffer
  v_max_days := (ceil(p_target_business_minutes::numeric / v_weekly_minutes) * 7)::integer + 14;

  -- Preserve exact receipt offset (seconds/fractions); do not round to whole minutes.
  v_remaining := make_interval(mins => p_target_business_minutes);
  v_cursor := timezone(p_timezone, p_start);
  v_local_date := v_cursor::date;

  loop
    v_guard := v_guard + 1;
    if v_guard > v_max_days then
      raise exception 'CRM_SLA_COMPUTE_GUARD' using errcode = 'P0001';
    end if;

    v_day_key := private.crm_sla_weekday_key(v_local_date);
    v_day := p_config -> v_day_key;

    if v_day is null then
      v_local_date := v_local_date + 1;
      v_cursor := v_local_date::timestamp;
      continue;
    end if;

    v_open := v_local_date::timestamp
      + make_interval(mins => private.crm_sla_hhmm_to_minutes(v_day ->> 'start'));
    v_close := v_local_date::timestamp
      + make_interval(mins => private.crm_sla_hhmm_to_minutes(v_day ->> 'end'));

    -- [open, close): at/after close => next day
    if v_cursor >= v_close then
      v_local_date := v_local_date + 1;
      v_cursor := v_local_date::timestamp;
      continue;
    end if;

    -- before open => jump to open (exact open counts immediately)
    if v_cursor < v_open then
      v_cursor := v_open;
    end if;

    v_avail := v_close - v_cursor;

    if v_remaining <= v_avail then
      -- May land exactly on close when the final interval ends at the boundary.
      return timezone(p_timezone, v_cursor + v_remaining);
    end if;

    v_remaining := v_remaining - v_avail;
    v_local_date := v_local_date + 1;
    v_cursor := v_local_date::timestamp;
  end loop;

  -- Unreachable when config validates (≥1 weekday); satisfies fail-closed contract.
  return null;
end;
$$;

comment on function private.compute_business_sla_due_at(timestamptz, integer, text, jsonb) is
  'Add exact business-minute intervals to a UTC receipt using IANA timezone + weekday [start,end) windows. Preserves sub-minute receipt offset. Iteration bound derived from weekly capacity. Returns NULL when inactive/invalid (fail closed).';

revoke all on function private.compute_business_sla_due_at(timestamptz, integer, text, jsonb)
  from public, anon, authenticated;

-- =============================================================================
-- D. public.crm_sla_clocks
-- =============================================================================

create table public.crm_sla_clocks (
  lead_id uuid primary key references public.leads (id) on delete restrict,
  policy_code text not null references public.crm_sla_policies (policy_code) on delete restrict,
  clock_started_at timestamptz not null,
  sla_due_at timestamptz,
  first_contact_attempt_at timestamptz,
  breached_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_crm_sla_clocks_attempt_order check (
    first_contact_attempt_at is null
    or first_contact_attempt_at >= clock_started_at
  ),
  constraint chk_crm_sla_clocks_breached_requires_due check (
    breached_at is null or sla_due_at is not null
  )
);

comment on table public.crm_sla_clocks is
  'Per-lead first-contact SLA clock. clock_started_at = lead receipt. sla_due_at is receipt-time snapshot (Option A); NULL dues are not silently rescoped later.';

comment on column public.crm_sla_clocks.sla_due_at is
  'Immutable operational deadline snapshot once set. Existing NULL remains NULL across later activation/edits.';

comment on column public.crm_sla_clocks.first_contact_attempt_at is
  'First qualifying CONTACT ATTEMPT (not connection). Attempt-marking wired in later CRM 2A-3.';

create index idx_crm_sla_clocks_unsatisfied_due
  on public.crm_sla_clocks (sla_due_at)
  where first_contact_attempt_at is null
    and sla_due_at is not null;

create trigger trg_crm_sla_clocks_updated_at
  before update on public.crm_sla_clocks
  for each row execute function private.set_updated_at();

alter table public.crm_sla_clocks enable row level security;

revoke all on table public.crm_sla_clocks from public, anon, authenticated;
grant select on table public.crm_sla_clocks to authenticated;

create policy crm_sla_clocks_select
  on public.crm_sla_clocks
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.leads l
      where l.id = crm_sla_clocks.lead_id
        and (select private.crm_can_view_lead(l.assigned_to))
    )
  );

-- Existing-lead scaffold: inactive policy => all dues NULL; no attempt inference
insert into public.crm_sla_clocks (
  lead_id,
  policy_code,
  clock_started_at,
  sla_due_at,
  first_contact_attempt_at,
  breached_at
)
select
  l.id,
  'first_contact',
  l.created_at,
  null,
  null,
  null
from public.leads l
on conflict (lead_id) do nothing;

-- =============================================================================
-- E. ensure_first_contact_sla_clock (idempotent; no silent rescope)
-- =============================================================================

create or replace function private.ensure_first_contact_sla_clock(p_lead_id uuid)
returns public.crm_sla_clocks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_created_at timestamptz;
  v_policy public.crm_sla_policies%rowtype;
  v_due timestamptz := null;
  v_row public.crm_sla_clocks%rowtype;
begin
  if p_lead_id is null then
    raise exception 'Lead id required' using errcode = '22023';
  end if;

  select l.created_at into v_created_at
  from public.leads l
  where l.id = p_lead_id;

  if not found then
    raise exception 'Lead % not found', p_lead_id using errcode = 'P0002';
  end if;

  -- Existing row: return as-is (Option A + NULL-due snapshot lock). No policy lock.
  select * into v_row
  from public.crm_sla_clocks c
  where c.lead_id = p_lead_id;

  if found then
    return v_row;
  end if;

  -- New clock: FOR SHARE conflicts with update_crm_sla_policy_impl FOR UPDATE so the
  -- due snapshot serializes cleanly against concurrent policy mutation.
  select * into v_policy
  from public.crm_sla_policies p
  where p.policy_code = 'first_contact'
  for share;

  if found
    and v_policy.is_active
    and v_policy.business_hours_enabled
    and v_policy.effective_from is not null
    and v_created_at >= v_policy.effective_from
    and (select private.validate_crm_sla_business_hours_config(v_policy.business_hours_config))
    and (select private.crm_sla_timezone_is_valid(v_policy.timezone))
  then
    v_due := private.compute_business_sla_due_at(
      v_created_at,
      v_policy.target_business_minutes,
      v_policy.timezone,
      v_policy.business_hours_config
    );
  end if;

  insert into public.crm_sla_clocks (
    lead_id,
    policy_code,
    clock_started_at,
    sla_due_at,
    first_contact_attempt_at,
    breached_at
  ) values (
    p_lead_id,
    'first_contact',
    v_created_at,
    v_due,
    null,
    null
  )
  on conflict (lead_id) do nothing
  returning * into v_row;

  if v_row.lead_id is null then
    select * into v_row
    from public.crm_sla_clocks c
    where c.lead_id = p_lead_id;
  end if;

  return v_row;
end;
$$;

comment on function private.ensure_first_contact_sla_clock(uuid) is
  'Idempotent first-contact SLA clock ensure. New-clock path locks policy FOR SHARE through due compute + insert; never rescopes existing rows.';

revoke all on function private.ensure_first_contact_sla_clock(uuid) from public, anon, authenticated;
alter function private.ensure_first_contact_sla_clock(uuid) owner to postgres;

-- =============================================================================
-- F. update_crm_sla_policy RPC
-- =============================================================================

create or replace function private.update_crm_sla_policy_impl(
  p_policy_code text,
  p_target_business_minutes integer default null,
  p_timezone text default null,
  p_business_hours_enabled boolean default null,
  p_business_hours_config jsonb default null,
  p_clear_business_hours_config boolean default false,
  p_is_active boolean default null
)
returns public.crm_sla_policies
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_now timestamptz := now();
  v_row public.crm_sla_policies%rowtype;
  v_was_activated boolean;
  v_new_target integer;
  v_new_tz text;
  v_new_enabled boolean;
  v_new_config jsonb;
  v_new_active boolean;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not (select public.authorize('crm.sla.manage')) then
    raise exception 'Permission denied to manage CRM SLA policy' using errcode = '42501';
  end if;

  select * into v_row
  from public.crm_sla_policies p
  where p.policy_code = p_policy_code
  for update;

  if not found then
    raise exception 'SLA policy % not found', p_policy_code using errcode = 'P0002';
  end if;

  v_was_activated := v_row.activated_at is not null;

  v_new_target := coalesce(p_target_business_minutes, v_row.target_business_minutes);
  v_new_tz := coalesce(nullif(trim(p_timezone), ''), v_row.timezone);
  v_new_enabled := coalesce(p_business_hours_enabled, v_row.business_hours_enabled);

  if p_clear_business_hours_config then
    v_new_config := null;
  elsif p_business_hours_config is not null then
    v_new_config := p_business_hours_config;
  else
    v_new_config := v_row.business_hours_config;
  end if;

  v_new_active := coalesce(p_is_active, v_row.is_active);

  if v_new_target <= 0 or v_new_target > 10080 then
    raise exception 'CRM_SLA_TARGET_INVALID' using errcode = '22023';
  end if;

  if not (select private.crm_sla_timezone_is_valid(v_new_tz)) then
    raise exception 'CRM_SLA_TIMEZONE_INVALID' using errcode = '22023';
  end if;

  if v_new_config is not null
    and not (select private.validate_crm_sla_business_hours_config(v_new_config))
  then
    raise exception 'CRM_SLA_HOURS_INVALID' using errcode = '22023';
  end if;

  -- Activation / keep-active requires valid hours
  if v_new_active then
    if v_new_enabled is not true
      or v_new_config is null
      or not (select private.validate_crm_sla_business_hours_config(v_new_config))
    then
      raise exception 'CRM_SLA_ACTIVATION_REQUIRES_HOURS' using errcode = '22023';
    end if;
  end if;

  update public.crm_sla_policies p
  set
    target_business_minutes = v_new_target,
    timezone = v_new_tz,
    business_hours_enabled = v_new_enabled,
    business_hours_config = v_new_config,
    is_active = v_new_active,
    activated_at = case
      when v_new_active and not v_was_activated then v_now
      else p.activated_at
    end,
    effective_from = case
      when v_new_active and not v_was_activated then v_now
      else p.effective_from
    end,
    updated_by = v_actor,
    updated_at = v_now
  where p.policy_code = p_policy_code
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function public.update_crm_sla_policy(
  p_policy_code text,
  p_target_business_minutes integer default null,
  p_timezone text default null,
  p_business_hours_enabled boolean default null,
  p_business_hours_config jsonb default null,
  p_clear_business_hours_config boolean default false,
  p_is_active boolean default null
)
returns public.crm_sla_policies
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.update_crm_sla_policy_impl(
    p_policy_code,
    p_target_business_minutes,
    p_timezone,
    p_business_hours_enabled,
    p_business_hours_config,
    p_clear_business_hours_config,
    p_is_active
  );
end;
$$;

alter function private.update_crm_sla_policy_impl(text, integer, text, boolean, jsonb, boolean, boolean)
  owner to postgres;

revoke all on function private.update_crm_sla_policy_impl(text, integer, text, boolean, jsonb, boolean, boolean)
  from public, anon, authenticated;
grant execute on function private.update_crm_sla_policy_impl(text, integer, text, boolean, jsonb, boolean, boolean)
  to authenticated;

revoke all on function public.update_crm_sla_policy(text, integer, text, boolean, jsonb, boolean, boolean)
  from public, anon;
grant execute on function public.update_crm_sla_policy(text, integer, text, boolean, jsonb, boolean, boolean)
  to authenticated;

-- =============================================================================
-- G. Optional lead_activities allowlist prep (no emissions)
-- =============================================================================

alter table public.lead_activities
  drop constraint if exists chk_lead_activities_type;

alter table public.lead_activities
  add constraint chk_lead_activities_type check (
    activity_type in (
      'note.created',
      'follow_up.scheduled',
      'follow_up.completed',
      'follow_up.cancelled',
      'follow_up.sla_breached',
      'status.changed',
      'assignment.changed',
      'lead.manual_created',
      'lead.bulk_imported'
    )
  );

-- =============================================================================
-- H. Postconditions
-- =============================================================================

do $$
declare
  v_lead_count bigint;
  v_clock_count bigint;
  v_due_count bigint;
  v_policy public.crm_sla_policies%rowtype;
begin
  select * into v_policy from public.crm_sla_policies where policy_code = 'first_contact';
  if not found then
    raise exception 'CRM 2A-2 postcondition: first_contact policy missing';
  end if;
  if v_policy.is_active
    or v_policy.business_hours_enabled
    or v_policy.business_hours_config is not null
    or v_policy.effective_from is not null
    or v_policy.activated_at is not null
    or v_policy.target_business_minutes <> 60
    or v_policy.timezone <> 'Asia/Kolkata'
  then
    raise exception 'CRM 2A-2 postcondition: first_contact seed must remain inactive/unconfigured';
  end if;

  select count(*) into v_lead_count from public.leads;
  select count(*) into v_clock_count from public.crm_sla_clocks;
  select count(*) into v_due_count from public.crm_sla_clocks where sla_due_at is not null;

  if v_clock_count <> v_lead_count then
    raise exception 'CRM 2A-2 postcondition: clock count (%) != lead count (%)',
      v_clock_count, v_lead_count;
  end if;
  if v_due_count <> 0 then
    raise exception 'CRM 2A-2 postcondition: expected zero non-null sla_due_at, found %', v_due_count;
  end if;
end;
$$;
