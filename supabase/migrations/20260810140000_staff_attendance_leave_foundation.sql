-- =============================================================================
-- ONEDECORE Phase 6D — Staff Administration, Attendance, Leave & Holidays (M23)
-- Repository only. No managed apply. No policy/leave-type seed rows.
-- Depends on M22 (Kriti audit persistence). Contract: phase-6d-implementation-contract-freeze.md
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A. RBAC — 12 permission codes + role matrix (OD-7: no attendance.correct.team grant)
-- -----------------------------------------------------------------------------

insert into public.permissions (code, name, description, is_system, is_active) values
  ('staff.manage', 'Manage Staff', 'Create and administer staff employment records', true, true),
  ('staff.read', 'Read Staff Directory', 'View staff employment within authorized scope', true, true),
  ('attendance.self', 'Self Attendance', 'Check in/out and view own attendance', true, true),
  ('attendance.team.read', 'Read Team Attendance', 'View direct-report attendance summaries', true, true),
  ('attendance.read.all', 'Read All Attendance', 'Organization-wide attendance visibility', true, true),
  ('attendance.correct.all', 'Correct All Attendance', 'Manual attendance corrections for any staff', true, true),
  ('attendance.correct.team', 'Correct Team Attendance', 'Manual attendance corrections for direct reports', true, true),
  ('leave.self', 'Self Leave', 'Create and manage own leave requests', true, true),
  ('leave.team.approve', 'Approve Team Leave', 'Approve or reject direct-report leave requests', true, true),
  ('leave.manage', 'Manage Leave', 'Full leave administration override', true, true),
  ('holidays.manage', 'Manage Holidays', 'Create and archive organization holidays', true, true),
  ('attendance.policies.manage', 'Manage Attendance Policies', 'Publish and activate attendance policies', true, true)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  is_system = true,
  is_active = true;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.is_system = true
  and p.is_system = true
  and p.code in (
    'staff.manage', 'staff.read',
    'attendance.self', 'attendance.team.read', 'attendance.read.all',
    'attendance.correct.all', 'attendance.correct.team',
    'leave.self', 'leave.team.approve', 'leave.manage',
    'holidays.manage', 'attendance.policies.manage'
  )
  and (
    (r.code = 'super_admin')
    or (
      r.code = 'sales_manager'
      and p.code in (
        'staff.read', 'attendance.self', 'attendance.team.read',
        'leave.self', 'leave.team.approve'
      )
    )
    or (
      r.code = 'sales_executive'
      and p.code in ('attendance.self', 'leave.self')
    )
  )
on conflict (role_id, permission_id) do nothing;

-- -----------------------------------------------------------------------------
-- B. Tables — attendance policies first (FK target)
-- -----------------------------------------------------------------------------

create table public.attendance_policies (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  name text not null,
  timezone text not null,
  workday_start_local time not null,
  workday_end_local time not null,
  late_grace_minutes integer not null,
  half_day_threshold_minutes integer not null,
  missing_checkout_cutoff_local time not null,
  weekly_off_days smallint[] not null,
  location_required boolean not null,
  is_current boolean not null default false,
  supersedes_policy_id uuid references public.attendance_policies (id) on delete restrict,
  created_at timestamptz not null default now(),

  constraint chk_attendance_policies_code check (code ~ '^[a-z][a-z0-9_]*$'),
  constraint chk_attendance_policies_name check (length(trim(name)) between 1 and 120),
  constraint chk_attendance_policies_timezone check (timezone = 'Asia/Kolkata'),
  constraint chk_attendance_policies_workday_order check (workday_end_local > workday_start_local),
  constraint chk_attendance_policies_late_grace check (late_grace_minutes between 0 and 240),
  constraint chk_attendance_policies_half_day_threshold check (half_day_threshold_minutes between 0 and 720),
  constraint chk_attendance_policies_weekly_off_days check (
    coalesce(array_length(weekly_off_days, 1), 0) >= 1
    and weekly_off_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
  )
);

create unique index uq_attendance_policies_one_current
  on public.attendance_policies (is_current)
  where is_current = true;

comment on table public.attendance_policies is
  'Versioned immutable attendance policy rows. Content insert-only; is_current toggled via RPC.';

create table public.staff_employment_profiles (
  staff_id uuid primary key references public.profiles (id) on delete restrict,
  employee_code text not null,
  designation text not null,
  joining_date date not null,
  reporting_manager_id uuid references public.profiles (id) on delete restrict,
  attendance_eligible boolean not null default false,
  attendance_policy_id uuid references public.attendance_policies (id) on delete restrict,
  invite_reconciliation_state text not null default 'none',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_staff_employment_profiles_employee_code unique (employee_code),
  constraint chk_staff_employment_profiles_employee_code check (
    employee_code ~ '^[A-Z0-9][A-Z0-9_-]{2,31}$'
  ),
  constraint chk_staff_employment_profiles_designation check (
    length(trim(designation)) between 1 and 120
  ),
  constraint chk_staff_employment_profiles_joining_date check (
    joining_date <= (timezone('Asia/Kolkata', now()))::date
  ),
  constraint chk_staff_employment_profiles_no_self_manager check (
    reporting_manager_id is null or reporting_manager_id <> staff_id
  ),
  constraint chk_staff_employment_profiles_eligible_policy check (
    attendance_eligible = false or attendance_policy_id is not null
  ),
  constraint chk_staff_employment_profiles_reconciliation_state check (
    invite_reconciliation_state in (
      'none', 'auth_created_db_pending', 'db_created_auth_pending'
    )
  )
);

create index idx_staff_employment_profiles_manager
  on public.staff_employment_profiles (reporting_manager_id)
  where reporting_manager_id is not null;

create trigger trg_staff_employment_profiles_updated_at
  before update on public.staff_employment_profiles
  for each row execute function private.set_updated_at();

comment on table public.staff_employment_profiles is
  '1:1 employment extension for profiles. Mutations via staff.manage RPCs only.';

create table public.staff_admin_events (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles (id) on delete restrict,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  event_type text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint chk_staff_admin_events_type check (
    event_type in (
      'staff.created', 'staff.invited', 'staff.invite_resent', 'staff.role_changed',
      'staff.manager_changed', 'staff.status_changed', 'staff.employment_updated',
      'staff.reconciliation_updated'
    )
  ),
  constraint chk_staff_admin_events_details check (pg_column_size(details) <= 2048)
);

create index idx_staff_admin_events_staff_created
  on public.staff_admin_events (staff_id, created_at desc);

create trigger trg_staff_admin_events_no_update
  before update on public.staff_admin_events
  for each row execute function private.forbid_append_only_mutation();

create trigger trg_staff_admin_events_no_delete
  before delete on public.staff_admin_events
  for each row execute function private.forbid_append_only_mutation();

comment on table public.staff_admin_events is
  'Append-only staff administration audit events.';

create table private.staff_invite_saga_requests (
  client_request_id uuid primary key,
  request_digest text not null,
  saga_state text not null,
  intended_email text not null,
  employee_code text not null,
  staff_id uuid references public.profiles (id) on delete restrict,
  created_by uuid not null references public.profiles (id) on delete restrict,
  request_payload jsonb not null,
  result jsonb,
  auth_recorded_at timestamptz,
  completed_at timestamptz,
  last_resend_at timestamptz,
  resend_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_staff_invite_saga_state check (
    saga_state in (
      'db_created_auth_pending',
      'auth_created_db_pending',
      'completed',
      'failed'
    )
  ),
  constraint chk_staff_invite_saga_payload_size check (
    pg_column_size(request_payload) <= 4096
  ),
  constraint chk_staff_invite_saga_email check (
    length(trim(intended_email)) between 3 and 254
  ),
  constraint chk_staff_invite_saga_resend_count check (resend_count between 0 and 32)
);

create index idx_staff_invite_saga_staff_id
  on private.staff_invite_saga_requests (staff_id)
  where staff_id is not null;

create trigger trg_staff_invite_saga_requests_updated_at
  before update on private.staff_invite_saga_requests
  for each row execute function private.set_updated_at();

revoke all on table private.staff_invite_saga_requests from public, anon, authenticated;

comment on table private.staff_invite_saga_requests is
  'Private durable staff invite saga ledger keyed by clientRequestId. Not exposed via PostgREST.';

create table public.attendance_events (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles (id) on delete restrict,
  attendance_date date not null,
  event_type text not null,
  occurred_at timestamptz not null default now(),
  idempotency_key text not null,
  location_category text,
  latitude numeric(9, 6),
  longitude numeric(9, 6),
  location_accuracy_m numeric(8, 2),
  client_reported_at timestamptz,
  attendance_policy_id uuid not null references public.attendance_policies (id) on delete restrict,
  created_at timestamptz not null default now(),

  constraint uq_attendance_events_staff_idempotency unique (staff_id, idempotency_key),
  constraint chk_attendance_events_type check (event_type in ('check_in', 'check_out')),
  constraint chk_attendance_events_idempotency_key check (
    length(idempotency_key) between 1 and 128
  ),
  constraint chk_attendance_events_location_category check (
    location_category is null
    or location_category in ('office', 'field', 'client_site')
  ),
  constraint chk_attendance_events_location_accuracy check (
    location_accuracy_m is null
    or location_accuracy_m between 0 and 5000
  )
);

create index idx_attendance_events_staff_date_occurred
  on public.attendance_events (staff_id, attendance_date, occurred_at);

create index idx_attendance_events_staff_idempotency
  on public.attendance_events (staff_id, idempotency_key);

create trigger trg_attendance_events_no_update
  before update on public.attendance_events
  for each row execute function private.forbid_append_only_mutation();

create trigger trg_attendance_events_no_delete
  before delete on public.attendance_events
  for each row execute function private.forbid_append_only_mutation();

comment on table public.attendance_events is
  'Append-only attendance check-in/out evidence.';

create table public.attendance_days (
  staff_id uuid not null references public.profiles (id) on delete restrict,
  attendance_date date not null,
  primary_status text not null,
  first_check_in_at timestamptz,
  last_check_out_at timestamptz,
  worked_minutes integer not null default 0,
  is_late boolean not null default false,
  is_early_checkout boolean not null default false,
  is_missing_checkout boolean not null default false,
  has_manual_adjustment boolean not null default false,
  open_session boolean not null default false,
  attendance_policy_id uuid not null references public.attendance_policies (id) on delete restrict,
  derived_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  primary key (staff_id, attendance_date),
  constraint chk_attendance_days_primary_status check (
    primary_status in (
      'present', 'absent', 'half_day', 'leave', 'weekly_off', 'holiday'
    )
  ),
  constraint chk_attendance_days_worked_minutes check (worked_minutes between 0 and 1440)
);

create unique index uq_attendance_days_one_open_session
  on public.attendance_days (staff_id)
  where open_session = true;

create trigger trg_attendance_days_updated_at
  before update on public.attendance_days
  for each row execute function private.set_updated_at();

comment on table public.attendance_days is
  'Authoritative derived attendance day summary per staff and business date.';

create table public.attendance_corrections (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles (id) on delete restrict,
  attendance_date date not null,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  reason text not null,
  correction_type text not null,
  before_digest text not null,
  after_digest text not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint chk_attendance_corrections_reason check (length(trim(reason)) between 1 and 500),
  constraint chk_attendance_corrections_type check (
    correction_type in (
      'set_primary_status', 'clear_missing_checkout',
      'adjust_worked_minutes', 'void_open_session'
    )
  ),
  constraint chk_attendance_corrections_details check (pg_column_size(details) <= 2048),
  constraint chk_attendance_corrections_before_digest check (char_length(before_digest) = 64),
  constraint chk_attendance_corrections_after_digest check (char_length(after_digest) = 64)
);

create index idx_attendance_corrections_staff_date
  on public.attendance_corrections (staff_id, attendance_date, created_at desc);

create trigger trg_attendance_corrections_no_update
  before update on public.attendance_corrections
  for each row execute function private.forbid_append_only_mutation();

create trigger trg_attendance_corrections_no_delete
  before delete on public.attendance_corrections
  for each row execute function private.forbid_append_only_mutation();

comment on table public.attendance_corrections is
  'Append-only manual attendance correction audit trail.';

create table public.leave_types (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  display_name text not null,
  allows_half_day boolean not null default false,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),

  constraint uq_leave_types_code unique (code),
  constraint chk_leave_types_code check (code ~ '^[a-z][a-z0-9_]*$'),
  constraint chk_leave_types_display_name check (length(trim(display_name)) between 1 and 80)
);

comment on table public.leave_types is
  'Configurable leave type catalogue. No seed rows in M23.';

create table public.leave_requests (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles (id) on delete restrict,
  leave_type_id uuid not null references public.leave_types (id) on delete restrict,
  start_date date not null,
  end_date date not null,
  half_day_part text,
  reason text not null,
  status text not null default 'pending',
  reviewed_by uuid references public.profiles (id) on delete set null,
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_leave_requests_date_range check (end_date >= start_date),
  constraint chk_leave_requests_half_day_part check (
    half_day_part is null or half_day_part in ('am', 'pm')
  ),
  constraint chk_leave_requests_reason check (length(trim(reason)) between 1 and 500),
  constraint chk_leave_requests_status check (
    status in ('pending', 'approved', 'rejected', 'cancelled')
  ),
  constraint chk_leave_requests_review_note check (
    review_note is null or length(trim(review_note)) <= 500
  )
);

create index idx_leave_requests_staff_status
  on public.leave_requests (staff_id, status, start_date desc);

create trigger trg_leave_requests_updated_at
  before update on public.leave_requests
  for each row execute function private.set_updated_at();

comment on table public.leave_requests is
  'Staff leave requests with manager/SA approval lifecycle.';

create table public.holidays (
  id uuid primary key default gen_random_uuid(),
  holiday_date date not null,
  name text not null,
  is_active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_holidays_name check (length(trim(name)) between 1 and 120)
);

create unique index uq_holidays_active_date
  on public.holidays (holiday_date)
  where is_active = true;

create trigger trg_holidays_updated_at
  before update on public.holidays
  for each row execute function private.set_updated_at();

comment on table public.holidays is
  'Organization holiday calendar. Archive via is_active = false.';

-- -----------------------------------------------------------------------------
-- C. Private helpers
-- -----------------------------------------------------------------------------

create or replace function private.staff_require_active_actor()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'ATTENDANCE_UNAUTHORIZED' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_actor
      and p.status = 'active'
  ) then
    raise exception 'ATTENDANCE_INACTIVE_STAFF' using errcode = '42501';
  end if;

  return v_actor;
end;
$$;

comment on function private.staff_require_active_actor() is
  'Resolves authenticated active staff actor for Phase 6D RPCs.';

create or replace function private.staff_attendance_business_date(p_ts timestamptz default now())
returns date
language sql
immutable
set search_path = ''
as $$
  select (timezone('Asia/Kolkata', coalesce(p_ts, now())))::date;
$$;

create or replace function private.staff_direct_report_ids(p_manager_id uuid)
returns setof uuid
language sql
stable
security definer
set search_path = ''
as $$
  select sep.staff_id
  from public.staff_employment_profiles sep
  where sep.reporting_manager_id = p_manager_id;
$$;

create or replace function private.assert_no_reporting_cycle(
  p_staff_id uuid,
  p_manager_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_manager_id is null then
    return;
  end if;

  if p_staff_id = p_manager_id then
    raise exception 'staff reporting manager cannot be self' using errcode = 'P0001';
  end if;

  if exists (
    with recursive chain as (
      select sep.staff_id, sep.reporting_manager_id, 1 as depth
      from public.staff_employment_profiles sep
      where sep.staff_id = p_manager_id

      union all

      select sep.staff_id, sep.reporting_manager_id, chain.depth + 1
      from public.staff_employment_profiles sep
      join chain on sep.staff_id = chain.reporting_manager_id
      where chain.depth < 64
    )
    select 1
    from chain
    where staff_id = p_staff_id
  ) then
    raise exception 'staff reporting hierarchy cycle detected' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function private.staff_can_view_employment(p_viewer uuid, p_staff uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_viewer = p_staff
    or (
      exists (
        select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        where ur.user_id = p_viewer
          and r.code = 'super_admin'
          and r.is_active = true
      )
      and exists (
        select 1
        from public.profiles vp
        where vp.id = p_viewer
          and vp.status = 'active'
      )
    )
    or (
      p_staff in (select private.staff_direct_report_ids(p_viewer))
      and exists (
        select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        join public.role_permissions rp on rp.role_id = r.id
        join public.permissions perm on perm.id = rp.permission_id
        join public.profiles vp on vp.id = ur.user_id
        where ur.user_id = p_viewer
          and perm.code = 'staff.read'
          and r.is_active = true
          and perm.is_active = true
          and vp.status = 'active'
      )
    );
$$;

create or replace function private.staff_can_view_attendance(p_viewer uuid, p_staff uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (
      p_viewer = p_staff
      and exists (
        select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        join public.role_permissions rp on rp.role_id = r.id
        join public.permissions perm on perm.id = rp.permission_id
        join public.profiles vp on vp.id = ur.user_id
        where ur.user_id = p_viewer
          and perm.code = 'attendance.self'
          and r.is_active = true
          and perm.is_active = true
          and vp.status = 'active'
      )
    )
    or (
      exists (
        select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        join public.role_permissions rp on rp.role_id = r.id
        join public.permissions perm on perm.id = rp.permission_id
        join public.profiles vp on vp.id = ur.user_id
        where ur.user_id = p_viewer
          and perm.code = 'attendance.read.all'
          and r.is_active = true
          and perm.is_active = true
          and vp.status = 'active'
      )
    )
    or (
      p_staff in (select private.staff_direct_report_ids(p_viewer))
      and exists (
        select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        join public.role_permissions rp on rp.role_id = r.id
        join public.permissions perm on perm.id = rp.permission_id
        join public.profiles vp on vp.id = ur.user_id
        where ur.user_id = p_viewer
          and perm.code = 'attendance.team.read'
          and r.is_active = true
          and perm.is_active = true
          and vp.status = 'active'
      )
    );
$$;

create or replace function private.staff_current_attendance_policy_id(p_staff_id uuid)
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select coalesce(
    (
      select sep.attendance_policy_id
      from public.staff_employment_profiles sep
      where sep.staff_id = p_staff_id
    ),
    (
      select ap.id
      from public.attendance_policies ap
      where ap.is_current = true
      order by ap.created_at desc
      limit 1
    )
  );
$$;

create or replace function private.staff_append_admin_event(
  p_staff_id uuid,
  p_actor_id uuid,
  p_event_type text,
  p_details jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event_id uuid := gen_random_uuid();
begin
  insert into public.staff_admin_events (id, staff_id, actor_id, event_type, details)
  values (v_event_id, p_staff_id, p_actor_id, p_event_type, coalesce(p_details, '{}'::jsonb));
  return v_event_id;
end;
$$;

create or replace function private.staff_digest_json(p_payload jsonb)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(
    extensions.digest(convert_to(coalesce(p_payload, '{}'::jsonb)::text, 'UTF8'), 'sha256'),
    'hex'
  );
$$;

create or replace function private.derive_attendance_day(
  p_staff_id uuid,
  p_attendance_date date
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_policy_id uuid;
  v_policy public.attendance_policies%rowtype;
  v_day public.attendance_days%rowtype;
  v_first_check_in timestamptz;
  v_last_check_out timestamptz;
  v_open_session boolean := false;
  v_worked_minutes integer := 0;
  v_is_late boolean := false;
  v_is_early_checkout boolean := false;
  v_is_missing_checkout boolean := false;
  v_primary_status text := 'absent';
  v_has_manual boolean := false;
  v_latest_correction public.attendance_corrections%rowtype;
  v_correction_found boolean := false;
  v_day_found boolean := false;
  v_check_in_count integer := 0;
  v_check_out_count integer := 0;
  v_local_start timestamptz;
  v_local_end timestamptz;
  v_local_cutoff timestamptz;
  v_local_grace_end timestamptz;
  v_dow smallint;
begin
  v_policy_id := private.staff_current_attendance_policy_id(p_staff_id);
  if v_policy_id is null then
    raise exception 'ATTENDANCE_POLICY_MISSING' using errcode = 'P0001';
  end if;

  select * into v_policy
  from public.attendance_policies
  where id = v_policy_id;

  select * into v_day
  from public.attendance_days
  where staff_id = p_staff_id
    and attendance_date = p_attendance_date
  for update;

  v_day_found := found;
  if v_day_found then
    v_has_manual := v_day.has_manual_adjustment;
  end if;

  select *
  into v_latest_correction
  from public.attendance_corrections
  where staff_id = p_staff_id
    and attendance_date = p_attendance_date
  order by created_at desc
  limit 1;

  v_correction_found := found;

  if not v_has_manual then
    if exists (
      select 1
      from public.leave_requests lr
      where lr.staff_id = p_staff_id
        and lr.status = 'approved'
        and p_attendance_date between lr.start_date and lr.end_date
    ) then
      v_primary_status := 'leave';
    elsif exists (
      select 1
      from public.holidays h
      where h.is_active = true
        and h.holiday_date = p_attendance_date
    ) then
      v_primary_status := 'holiday';
    else
      v_dow := extract(isodow from p_attendance_date)::smallint;
      if v_dow = any (v_policy.weekly_off_days) then
        v_primary_status := 'weekly_off';
      else
        select
          min(ae.occurred_at) filter (where ae.event_type = 'check_in'),
          max(ae.occurred_at) filter (where ae.event_type = 'check_out'),
          count(*) filter (where ae.event_type = 'check_in'),
          count(*) filter (where ae.event_type = 'check_out')
        into v_first_check_in, v_last_check_out, v_check_in_count, v_check_out_count
        from public.attendance_events ae
        where ae.staff_id = p_staff_id
          and ae.attendance_date = p_attendance_date;

        v_open_session := coalesce(v_check_in_count, 0) > coalesce(v_check_out_count, 0);

        if v_first_check_in is not null and v_last_check_out is not null and not v_open_session then
          v_worked_minutes := greatest(
            0,
            least(1440, floor(extract(epoch from (v_last_check_out - v_first_check_in)) / 60)::integer)
          );
        elsif v_first_check_in is not null and v_open_session then
          v_worked_minutes := greatest(
            0,
            least(
              1440,
              floor(extract(epoch from (now() - v_first_check_in)) / 60)::integer
            )
          );
        end if;

        v_local_start := timezone(
          v_policy.timezone,
          p_attendance_date::timestamp + v_policy.workday_start_local
        );
        v_local_grace_end := v_local_start + make_interval(mins => v_policy.late_grace_minutes);
        v_local_end := timezone(
          v_policy.timezone,
          p_attendance_date::timestamp + v_policy.workday_end_local
        );
        v_local_cutoff := timezone(
          v_policy.timezone,
          p_attendance_date::timestamp + v_policy.missing_checkout_cutoff_local
        );

        if v_first_check_in is null then
          v_primary_status := 'absent';
        else
          v_is_late := v_first_check_in > v_local_grace_end;
          if v_last_check_out is not null and not v_open_session then
            v_is_early_checkout := v_last_check_out < v_local_end;
          end if;
          if v_open_session and now() >= v_local_cutoff then
            v_is_missing_checkout := true;
          end if;

          if v_worked_minutes < v_policy.half_day_threshold_minutes then
            v_primary_status := 'half_day';
          else
            v_primary_status := 'present';
          end if;
        end if;
      end if;
    end if;
  else
    if not v_day_found then
      select * into v_day
      from public.attendance_days
      where staff_id = p_staff_id
        and attendance_date = p_attendance_date;
      v_day_found := found;
    end if;

    v_primary_status := coalesce(v_day.primary_status, 'absent');
    v_first_check_in := v_day.first_check_in_at;
    v_last_check_out := v_day.last_check_out_at;
    v_worked_minutes := coalesce(v_day.worked_minutes, 0);
    v_is_late := coalesce(v_day.is_late, false);
    v_is_early_checkout := coalesce(v_day.is_early_checkout, false);
    v_is_missing_checkout := coalesce(v_day.is_missing_checkout, false);
    v_open_session := coalesce(v_day.open_session, false);
    v_has_manual := true;
  end if;

  if v_correction_found then
    if v_latest_correction.correction_type = 'set_primary_status'
      and v_latest_correction.details ? 'primaryStatus' then
      v_primary_status := v_latest_correction.details ->> 'primaryStatus';
      v_has_manual := true;
    elsif v_latest_correction.correction_type = 'clear_missing_checkout' then
      v_is_missing_checkout := false;
      v_has_manual := true;
    elsif v_latest_correction.correction_type = 'adjust_worked_minutes'
      and v_latest_correction.details ? 'workedMinutes' then
      v_worked_minutes := (v_latest_correction.details ->> 'workedMinutes')::integer;
      v_has_manual := true;
    elsif v_latest_correction.correction_type = 'void_open_session' then
      v_open_session := false;
      v_has_manual := true;
    end if;
  end if;

  insert into public.attendance_days (
    staff_id,
    attendance_date,
    primary_status,
    first_check_in_at,
    last_check_out_at,
    worked_minutes,
    is_late,
    is_early_checkout,
    is_missing_checkout,
    has_manual_adjustment,
    open_session,
    attendance_policy_id,
    derived_at
  )
  values (
    p_staff_id,
    p_attendance_date,
    v_primary_status,
    v_first_check_in,
    v_last_check_out,
    v_worked_minutes,
    v_is_late,
    v_is_early_checkout,
    v_is_missing_checkout,
    v_has_manual,
    v_open_session,
    v_policy_id,
    now()
  )
  on conflict (staff_id, attendance_date) do update set
    primary_status = excluded.primary_status,
    first_check_in_at = excluded.first_check_in_at,
    last_check_out_at = excluded.last_check_out_at,
    worked_minutes = excluded.worked_minutes,
    is_late = excluded.is_late,
    is_early_checkout = excluded.is_early_checkout,
    is_missing_checkout = excluded.is_missing_checkout,
    has_manual_adjustment = excluded.has_manual_adjustment,
    open_session = excluded.open_session,
    attendance_policy_id = excluded.attendance_policy_id,
    derived_at = excluded.derived_at,
    updated_at = now();
end;
$$;

-- -----------------------------------------------------------------------------
-- -----------------------------------------------------------------------------
-- D. Staff RPCs — durable invite saga (private ledger)
-- -----------------------------------------------------------------------------

create or replace function private.staff_finalize_invite_from_saga(
  p_client_request_id uuid,
  p_actor uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row private.staff_invite_saga_requests%rowtype;
  v_payload jsonb;
  v_role_id uuid;
  v_staff_id uuid;
  v_normalized_code text;
  v_role_code text;
  v_reporting_manager_id uuid;
  v_attendance_eligible boolean;
  v_attendance_policy_id uuid;
  v_result jsonb;
  v_is_retry boolean;
begin
  select * into v_row
  from private.staff_invite_saga_requests
  where client_request_id = p_client_request_id
  for update;

  if not found then
    raise exception 'reconciliation request not found' using errcode = 'P0002';
  end if;

  if v_row.saga_state = 'completed' then
    return coalesce(v_row.result, '{}'::jsonb)
      || jsonb_build_object('idempotentReplay', true);
  end if;

  if v_row.saga_state <> 'auth_created_db_pending' or v_row.staff_id is null then
    raise exception 'staff invite saga not ready for finalization' using errcode = 'P0001';
  end if;

  v_payload := v_row.request_payload;
  v_staff_id := v_row.staff_id;
  v_normalized_code := upper(trim(v_payload ->> 'employeeCode'));
  v_role_code := v_payload ->> 'roleCode';
  v_reporting_manager_id := nullif(v_payload ->> 'reportingManagerId', '')::uuid;
  v_attendance_eligible := coalesce((v_payload ->> 'attendanceEligible')::boolean, false);
  v_attendance_policy_id := nullif(v_payload ->> 'attendancePolicyId', '')::uuid;

  if v_attendance_eligible and v_attendance_policy_id is null then
    raise exception 'ATTENDANCE_POLICY_MISSING' using errcode = 'P0001';
  end if;

  if v_role_code = 'sales_executive' and v_reporting_manager_id is null then
    raise exception 'sales_executive requires reporting manager' using errcode = 'P0001';
  end if;

  perform private.assert_no_reporting_cycle(v_staff_id, v_reporting_manager_id);

  if v_reporting_manager_id is not null and not exists (
    select 1 from public.profiles mp
    where mp.id = v_reporting_manager_id and mp.status = 'active'
  ) then
    raise exception 'reporting manager must be active' using errcode = 'P0001';
  end if;

  select r.id into v_role_id
  from public.roles r
  where r.code = v_role_code
    and r.is_active = true
    and r.code in ('sales_manager', 'sales_executive', 'project_manager', 'designer');

  if v_role_id is null then
    raise exception 'invalid role for staff assignment' using errcode = 'P0001';
  end if;

  v_is_retry := exists (
    select 1 from public.staff_employment_profiles sep where sep.staff_id = v_staff_id
  );

  if not v_is_retry then
    insert into public.profiles (id, display_name, phone_e164, status)
    values (
      v_staff_id,
      trim(v_payload ->> 'displayName'),
      nullif(v_payload ->> 'phoneE164', ''),
      'pending'
    )
    on conflict (id) do update set
      display_name = excluded.display_name,
      phone_e164 = coalesce(excluded.phone_e164, public.profiles.phone_e164);

    insert into public.staff_employment_profiles (
      staff_id, employee_code, designation, joining_date,
      reporting_manager_id, attendance_eligible, attendance_policy_id,
      invite_reconciliation_state
    )
    values (
      v_staff_id,
      v_normalized_code,
      trim(v_payload ->> 'designation'),
      (v_payload ->> 'joiningDate')::date,
      v_reporting_manager_id,
      v_attendance_eligible,
      v_attendance_policy_id,
      'auth_created_db_pending'
    );

    delete from public.user_roles ur
    using public.roles r
    where ur.user_id = v_staff_id
      and ur.role_id = r.id
      and r.code in ('sales_manager', 'sales_executive', 'project_manager', 'designer');

    insert into public.user_roles (user_id, role_id, assigned_by)
    values (v_staff_id, v_role_id, p_actor);

    perform private.staff_append_admin_event(
      v_staff_id, p_actor, 'staff.created',
      jsonb_build_object(
        'employeeCode', v_normalized_code,
        'roleCode', v_role_code,
        'attendanceEligible', v_attendance_eligible,
        'clientRequestId', p_client_request_id
      )
    );
  else
    update public.staff_employment_profiles
    set
      employee_code = v_normalized_code,
      designation = trim(v_payload ->> 'designation'),
      joining_date = (v_payload ->> 'joiningDate')::date,
      reporting_manager_id = v_reporting_manager_id,
      attendance_eligible = v_attendance_eligible,
      attendance_policy_id = v_attendance_policy_id,
      invite_reconciliation_state = 'auth_created_db_pending'
    where staff_id = v_staff_id;
  end if;

  update public.staff_employment_profiles
  set invite_reconciliation_state = 'none'
  where staff_id = v_staff_id;

  v_result := jsonb_build_object(
    'staffId', v_staff_id,
    'employeeCode', v_normalized_code,
    'profileStatus', 'pending',
    'invitationState', 'completed',
    'reconciliationState', 'none',
    'idempotentReplay', false
  );

  update private.staff_invite_saga_requests
  set
    saga_state = 'completed',
    result = v_result,
    completed_at = now()
  where client_request_id = p_client_request_id;

  if v_is_retry then
    perform private.staff_append_admin_event(
      v_staff_id, p_actor, 'staff.reconciliation_updated',
      jsonb_build_object('clientRequestId', p_client_request_id, 'finalized', true)
    );
  end if;

  return v_result;
exception
  when unique_violation then
    raise exception 'employee_code already exists' using errcode = 'P0001';
end;
$$;

create or replace function public.prepare_staff_invite_saga(
  p_client_request_id uuid,
  p_employee_code text,
  p_display_name text,
  p_email text,
  p_phone_e164 text,
  p_designation text,
  p_joining_date date,
  p_role_code text,
  p_reporting_manager_id uuid,
  p_attendance_eligible boolean,
  p_attendance_policy_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_row private.staff_invite_saga_requests%rowtype;
  v_payload jsonb;
  v_digest text;
  v_normalized_code text;
  v_email text;
begin
  v_actor := private.staff_require_active_actor();

  if not (select public.authorize('staff.manage')) then
    raise exception 'ATTENDANCE_UNAUTHORIZED' using errcode = '42501';
  end if;

  if p_client_request_id is null then
    raise exception 'validation: client_request_id required' using errcode = '22023';
  end if;

  v_normalized_code := upper(trim(p_employee_code));
  v_email := lower(trim(p_email));

  v_payload := jsonb_build_object(
    'employeeCode', v_normalized_code,
    'displayName', trim(p_display_name),
    'email', v_email,
    'phoneE164', nullif(trim(coalesce(p_phone_e164, '')), ''),
    'designation', trim(p_designation),
    'joiningDate', p_joining_date::text,
    'roleCode', p_role_code,
    'reportingManagerId', p_reporting_manager_id,
    'attendanceEligible', coalesce(p_attendance_eligible, false),
    'attendancePolicyId', p_attendance_policy_id
  );

  v_digest := private.staff_digest_json(v_payload);

  select * into v_row
  from private.staff_invite_saga_requests
  where client_request_id = p_client_request_id;

  if found then
    if v_row.request_digest <> v_digest then
      raise exception 'STAFF_IDEMPOTENCY_CONFLICT' using errcode = 'P0001';
    end if;

    if v_row.saga_state = 'completed' then
      return coalesce(v_row.result, '{}'::jsonb)
        || jsonb_build_object('idempotentReplay', true, 'needsAuth', false, 'sagaState', 'completed');
    end if;

    return jsonb_build_object(
      'clientRequestId', p_client_request_id,
      'sagaState', v_row.saga_state,
      'needsAuth', v_row.saga_state = 'db_created_auth_pending' and v_row.staff_id is null,
      'staffId', v_row.staff_id,
      'reconciliationState', case
        when v_row.saga_state = 'auth_created_db_pending' then 'auth_created_db_pending'
        when v_row.saga_state = 'db_created_auth_pending' then 'db_created_auth_pending'
        else 'none'
      end,
      'invitationState', case
        when v_row.saga_state = 'auth_created_db_pending' then 'reconciliation_required'
        when v_row.saga_state = 'db_created_auth_pending' then 'invited'
        else 'completed'
      end,
      'idempotentReplay', true
    );
  end if;

  if coalesce(p_attendance_eligible, false) and p_attendance_policy_id is null then
    raise exception 'ATTENDANCE_POLICY_MISSING' using errcode = 'P0001';
  end if;

  if p_role_code = 'sales_executive' and p_reporting_manager_id is null then
    raise exception 'sales_executive requires reporting manager' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.staff_employment_profiles sep
    where sep.employee_code = v_normalized_code
  ) then
    raise exception 'employee_code already exists' using errcode = 'P0001';
  end if;

  insert into private.staff_invite_saga_requests (
    client_request_id, request_digest, saga_state, intended_email, employee_code,
    created_by, request_payload
  )
  values (
    p_client_request_id, v_digest, 'db_created_auth_pending', v_email, v_normalized_code,
    v_actor, v_payload
  );

  return jsonb_build_object(
    'clientRequestId', p_client_request_id,
    'sagaState', 'db_created_auth_pending',
    'needsAuth', true,
    'staffId', null,
    'reconciliationState', 'db_created_auth_pending',
    'invitationState', 'invited',
    'idempotentReplay', false
  );
end;
$$;

create or replace function public.record_staff_invite_auth_success(
  p_client_request_id uuid,
  p_staff_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_row private.staff_invite_saga_requests%rowtype;
begin
  v_actor := private.staff_require_active_actor();

  if not (select public.authorize('staff.manage')) then
    raise exception 'ATTENDANCE_UNAUTHORIZED' using errcode = '42501';
  end if;

  if p_client_request_id is null or p_staff_id is null then
    raise exception 'validation: client_request_id and staff_id required' using errcode = '22023';
  end if;

  select * into v_row
  from private.staff_invite_saga_requests
  where client_request_id = p_client_request_id
  for update;

  if not found then
    raise exception 'reconciliation request not found' using errcode = 'P0002';
  end if;

  if v_row.saga_state = 'completed' then
    return coalesce(v_row.result, '{}'::jsonb)
      || jsonb_build_object('idempotentReplay', true, 'reconciliationState', 'none');
  end if;

  if v_row.staff_id is not null and v_row.staff_id <> p_staff_id then
    raise exception 'STAFF_IDEMPOTENCY_CONFLICT' using errcode = 'P0001';
  end if;

  update private.staff_invite_saga_requests
  set
    staff_id = p_staff_id,
    saga_state = 'auth_created_db_pending',
    auth_recorded_at = coalesce(auth_recorded_at, now())
  where client_request_id = p_client_request_id;

  return jsonb_build_object(
    'clientRequestId', p_client_request_id,
    'staffId', p_staff_id,
    'sagaState', 'auth_created_db_pending',
    'reconciliationState', 'auth_created_db_pending',
    'invitationState', 'reconciliation_required',
    'idempotentReplay', v_row.auth_recorded_at is not null
  );
end;
$$;

create or replace function public.create_staff_member(p_client_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
begin
  v_actor := private.staff_require_active_actor();

  if not (select public.authorize('staff.manage')) then
    raise exception 'ATTENDANCE_UNAUTHORIZED' using errcode = '42501';
  end if;

  if p_client_request_id is null then
    raise exception 'validation: client_request_id required' using errcode = '22023';
  end if;

  return private.staff_finalize_invite_from_saga(p_client_request_id, v_actor);
end;
$$;

create or replace function public.reconcile_staff_invite(p_client_request_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_row private.staff_invite_saga_requests%rowtype;
begin
  v_actor := private.staff_require_active_actor();

  if not (select public.authorize('staff.manage')) then
    raise exception 'ATTENDANCE_UNAUTHORIZED' using errcode = '42501';
  end if;

  select * into v_row
  from private.staff_invite_saga_requests
  where client_request_id = p_client_request_id;

  if not found then
    raise exception 'reconciliation request not found' using errcode = 'P0002';
  end if;

  if v_row.saga_state = 'completed' then
    return coalesce(v_row.result, '{}'::jsonb)
      || jsonb_build_object('idempotentReplay', true, 'reconciliationState', 'none');
  end if;

  if v_row.saga_state = 'db_created_auth_pending' then
    raise exception 'staff invite auth pending' using errcode = 'P0001';
  end if;

  return private.staff_finalize_invite_from_saga(p_client_request_id, v_actor);
end;
$$;

create or replace function public.resend_staff_invite(
  p_staff_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_row private.staff_invite_saga_requests%rowtype;
  v_profile_status text;
begin
  v_actor := private.staff_require_active_actor();

  if not (select public.authorize('staff.manage')) then
    raise exception 'ATTENDANCE_UNAUTHORIZED' using errcode = '42501';
  end if;

  if p_staff_id is null or p_reason is null or length(trim(p_reason)) < 1 then
    raise exception 'validation: staff_id and reason required' using errcode = '22023';
  end if;

  select status into v_profile_status
  from public.profiles
  where id = p_staff_id;

  if v_profile_status is distinct from 'pending' then
    raise exception 'staff invite resend not permitted for profile status' using errcode = 'P0001';
  end if;

  select * into v_row
  from private.staff_invite_saga_requests
  where staff_id = p_staff_id
  order by created_at desc
  limit 1;

  if not found then
    raise exception 'staff invite saga not found' using errcode = 'P0002';
  end if;

  if v_row.saga_state = 'completed' then
    raise exception 'staff invite already completed' using errcode = 'P0001';
  end if;

  if v_row.resend_count >= 5 then
    raise exception 'staff invite resend limit reached' using errcode = 'P0001';
  end if;

  update private.staff_invite_saga_requests
  set
    resend_count = resend_count + 1,
    last_resend_at = now()
  where client_request_id = v_row.client_request_id;

  perform private.staff_append_admin_event(
    p_staff_id, v_actor, 'staff.invite_resent',
    jsonb_build_object(
      'clientRequestId', v_row.client_request_id,
      'reason', left(trim(p_reason), 500),
      'resendCount', v_row.resend_count + 1
    )
  );

  return jsonb_build_object(
    'staffId', p_staff_id,
    'clientRequestId', v_row.client_request_id,
    'email', v_row.intended_email,
    'displayName', v_row.request_payload ->> 'displayName',
    'sagaState', v_row.saga_state,
    'resendCount', v_row.resend_count + 1
  );
end;
$$;
create or replace function public.set_staff_profile_status(
  p_staff_id uuid,
  p_status text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_old_status text;
begin
  v_actor := private.staff_require_active_actor();

  if not (select public.authorize('staff.manage')) then
    raise exception 'ATTENDANCE_UNAUTHORIZED' using errcode = '42501';
  end if;

  if p_status not in ('pending', 'active', 'suspended', 'disabled') then
    raise exception 'invalid profile status' using errcode = 'P0001';
  end if;

  if p_reason is null or length(trim(p_reason)) < 1 then
    raise exception 'reason required' using errcode = '22023';
  end if;

  select status into v_old_status
  from public.profiles
  where id = p_staff_id
  for update;

  if not found then
    raise exception 'staff profile not found' using errcode = 'P0002';
  end if;

  if v_old_status = 'disabled' and p_status = 'active' then
    raise exception 'disabled to active denied in V1; use rehire path' using errcode = 'P0001';
  end if;

  update public.profiles
  set status = p_status
  where id = p_staff_id;

  perform private.staff_append_admin_event(
    p_staff_id, v_actor, 'staff.status_changed',
    jsonb_build_object('fromStatus', v_old_status, 'toStatus', p_status, 'reason', left(trim(p_reason), 500))
  );

  return jsonb_build_object('staffId', p_staff_id, 'status', p_status);
end;
$$;

create or replace function public.set_staff_reporting_manager(
  p_staff_id uuid,
  p_manager_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_old_manager uuid;
begin
  v_actor := private.staff_require_active_actor();

  if not (select public.authorize('staff.manage')) then
    raise exception 'ATTENDANCE_UNAUTHORIZED' using errcode = '42501';
  end if;

  if p_reason is null or length(trim(p_reason)) < 1 then
    raise exception 'reason required' using errcode = '22023';
  end if;

  perform private.assert_no_reporting_cycle(p_staff_id, p_manager_id);

  if p_manager_id is not null and not exists (
    select 1 from public.profiles mp
    where mp.id = p_manager_id and mp.status = 'active'
  ) then
    raise exception 'reporting manager must be active' using errcode = 'P0001';
  end if;

  select reporting_manager_id into v_old_manager
  from public.staff_employment_profiles
  where staff_id = p_staff_id
  for update;

  if not found then
    raise exception 'employment profile not found' using errcode = 'P0002';
  end if;

  update public.staff_employment_profiles
  set reporting_manager_id = p_manager_id
  where staff_id = p_staff_id;

  perform private.staff_append_admin_event(
    p_staff_id, v_actor, 'staff.manager_changed',
    jsonb_build_object(
      'fromManagerId', v_old_manager,
      'toManagerId', p_manager_id,
      'reason', left(trim(p_reason), 500)
    )
  );

  return jsonb_build_object('staffId', p_staff_id, 'reportingManagerId', p_manager_id);
end;
$$;

create or replace function public.update_staff_employment(
  p_staff_id uuid,
  p_employee_code text default null,
  p_designation text default null,
  p_joining_date date default null,
  p_phone_e164 text default null,
  p_display_name text default null,
  p_attendance_eligible boolean default null,
  p_attendance_policy_id uuid default null,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_profile public.staff_employment_profiles%rowtype;
  v_new_eligible boolean;
  v_new_policy uuid;
begin
  v_actor := private.staff_require_active_actor();

  if not (select public.authorize('staff.manage')) then
    raise exception 'ATTENDANCE_UNAUTHORIZED' using errcode = '42501';
  end if;

  select * into v_profile
  from public.staff_employment_profiles
  where staff_id = p_staff_id
  for update;

  if not found then
    raise exception 'employment profile not found' using errcode = 'P0002';
  end if;

  v_new_eligible := coalesce(p_attendance_eligible, v_profile.attendance_eligible);
  v_new_policy := coalesce(p_attendance_policy_id, v_profile.attendance_policy_id);

  if v_new_eligible and v_new_policy is null then
    raise exception 'ATTENDANCE_POLICY_MISSING' using errcode = 'P0001';
  end if;

  if p_display_name is not null or p_phone_e164 is not null then
    update public.profiles
    set
      display_name = coalesce(trim(p_display_name), display_name),
      phone_e164 = coalesce(p_phone_e164, phone_e164)
    where id = p_staff_id;
  end if;

  update public.staff_employment_profiles
  set
    employee_code = coalesce(upper(trim(p_employee_code)), employee_code),
    designation = coalesce(trim(p_designation), designation),
    joining_date = coalesce(p_joining_date, joining_date),
    attendance_eligible = v_new_eligible,
    attendance_policy_id = v_new_policy
  where staff_id = p_staff_id;

  perform private.staff_append_admin_event(
    p_staff_id, v_actor, 'staff.employment_updated',
    jsonb_build_object('reason', left(trim(coalesce(p_reason, '')), 500))
  );

  return jsonb_build_object('staffId', p_staff_id, 'attendanceEligible', v_new_eligible);
end;
$$;

-- -----------------------------------------------------------------------------
-- E. Attendance RPCs
-- -----------------------------------------------------------------------------

create or replace function private.staff_assert_attendance_eligible(p_staff_id uuid)
returns public.staff_employment_profiles
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_profile public.staff_employment_profiles%rowtype;
begin
  select * into v_profile
  from public.staff_employment_profiles
  where staff_id = p_staff_id;

  if not found or not v_profile.attendance_eligible then
    raise exception 'ATTENDANCE_NOT_ELIGIBLE' using errcode = 'P0001';
  end if;

  return v_profile;
end;
$$;

create or replace function private.staff_validate_attendance_location(
  p_policy public.attendance_policies,
  p_location_category text,
  p_latitude numeric,
  p_longitude numeric,
  p_location_accuracy_m numeric
)
returns void
language plpgsql
immutable
set search_path = ''
as $$
begin
  if not p_policy.location_required then
    return;
  end if;

  if p_location_category is null then
    raise exception 'ATTENDANCE_LOCATION_REQUIRED' using errcode = 'P0001';
  end if;

  if p_location_category not in ('office', 'field', 'client_site') then
    raise exception 'ATTENDANCE_LOCATION_INVALID' using errcode = 'P0001';
  end if;

  if p_location_accuracy_m is not null
    and (p_location_accuracy_m < 0 or p_location_accuracy_m > 5000) then
    raise exception 'ATTENDANCE_LOCATION_INVALID' using errcode = 'P0001';
  end if;
end;
$$;

create or replace function public.check_in_attendance(
  p_idempotency_key text,
  p_location_category text default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_location_accuracy_m numeric default null,
  p_client_reported_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_profile public.staff_employment_profiles%rowtype;
  v_policy public.attendance_policies%rowtype;
  v_attendance_date date;
  v_existing public.attendance_events%rowtype;
  v_event_id uuid;
  v_day public.attendance_days%rowtype;
begin
  v_actor := private.staff_require_active_actor();

  if not (select public.authorize('attendance.self')) then
    raise exception 'ATTENDANCE_UNAUTHORIZED' using errcode = '42501';
  end if;

  v_profile := private.staff_assert_attendance_eligible(v_actor);

  select * into v_policy
  from public.attendance_policies
  where id = v_profile.attendance_policy_id;

  if not found then
    raise exception 'ATTENDANCE_POLICY_MISSING' using errcode = 'P0001';
  end if;

  perform private.staff_validate_attendance_location(
    v_policy, p_location_category, p_latitude, p_longitude, p_location_accuracy_m
  );

  v_attendance_date := private.staff_attendance_business_date(now());

  select * into v_existing
  from public.attendance_events
  where staff_id = v_actor
    and idempotency_key = p_idempotency_key;

  if found then
    v_attendance_date := v_existing.attendance_date;
    perform private.derive_attendance_day(v_actor, v_attendance_date);
    select * into v_day
    from public.attendance_days
    where staff_id = v_actor and attendance_date = v_attendance_date;

    return jsonb_build_object(
      'staffId', v_actor,
      'attendanceDate', v_attendance_date,
      'primaryStatus', v_day.primary_status,
      'eventId', v_existing.id,
      'openSession', v_day.open_session,
      'idempotentReplay', true,
      'occurredAt', v_existing.occurred_at
    );
  end if;

  if exists (
    select 1 from public.attendance_days ad
    where ad.staff_id = v_actor and ad.open_session = true
  ) then
    raise exception 'ATTENDANCE_ALREADY_CHECKED_IN' using errcode = 'P0001';
  end if;

  perform 1
  from public.attendance_days
  where staff_id = v_actor
    and attendance_date = v_attendance_date
  for update;

  v_event_id := gen_random_uuid();

  insert into public.attendance_events (
    id, staff_id, attendance_date, event_type, idempotency_key,
    location_category, latitude, longitude, location_accuracy_m,
    client_reported_at, attendance_policy_id
  )
  values (
    v_event_id, v_actor, v_attendance_date, 'check_in', p_idempotency_key,
    p_location_category,
    case when p_latitude is null then null else round(p_latitude::numeric, 3) end,
    case when p_longitude is null then null else round(p_longitude::numeric, 3) end,
    p_location_accuracy_m,
    p_client_reported_at,
    v_policy.id
  );

  perform private.derive_attendance_day(v_actor, v_attendance_date);

  select * into v_day
  from public.attendance_days
  where staff_id = v_actor and attendance_date = v_attendance_date;

  return jsonb_build_object(
    'staffId', v_actor,
    'attendanceDate', v_attendance_date,
    'primaryStatus', v_day.primary_status,
    'eventId', v_event_id,
    'openSession', v_day.open_session,
    'idempotentReplay', false,
    'occurredAt', now()
  );
end;
$$;

create or replace function public.check_out_attendance(
  p_idempotency_key text,
  p_location_category text default null,
  p_latitude numeric default null,
  p_longitude numeric default null,
  p_location_accuracy_m numeric default null,
  p_client_reported_at timestamptz default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_profile public.staff_employment_profiles%rowtype;
  v_policy public.attendance_policies%rowtype;
  v_attendance_date date;
  v_existing public.attendance_events%rowtype;
  v_event_id uuid;
  v_day public.attendance_days%rowtype;
begin
  v_actor := private.staff_require_active_actor();

  if not (select public.authorize('attendance.self')) then
    raise exception 'ATTENDANCE_UNAUTHORIZED' using errcode = '42501';
  end if;

  v_profile := private.staff_assert_attendance_eligible(v_actor);

  select * into v_policy
  from public.attendance_policies
  where id = v_profile.attendance_policy_id;

  if not found then
    raise exception 'ATTENDANCE_POLICY_MISSING' using errcode = 'P0001';
  end if;

  perform private.staff_validate_attendance_location(
    v_policy, p_location_category, p_latitude, p_longitude, p_location_accuracy_m
  );

  select * into v_existing
  from public.attendance_events
  where staff_id = v_actor
    and idempotency_key = p_idempotency_key;

  if found then
    v_attendance_date := v_existing.attendance_date;
    perform private.derive_attendance_day(v_actor, v_attendance_date);
    select * into v_day
    from public.attendance_days
    where staff_id = v_actor and attendance_date = v_attendance_date;

    return jsonb_build_object(
      'staffId', v_actor,
      'attendanceDate', v_attendance_date,
      'primaryStatus', v_day.primary_status,
      'eventId', v_existing.id,
      'openSession', v_day.open_session,
      'idempotentReplay', true,
      'occurredAt', v_existing.occurred_at
    );
  end if;

  if not exists (
    select 1 from public.attendance_days ad
    where ad.staff_id = v_actor and ad.open_session = true
  ) then
    raise exception 'ATTENDANCE_NOT_CHECKED_IN' using errcode = 'P0001';
  end if;

  select attendance_date into v_attendance_date
  from public.attendance_days
  where staff_id = v_actor and open_session = true
  limit 1;

  perform 1
  from public.attendance_days
  where staff_id = v_actor
    and attendance_date = v_attendance_date
  for update;

  v_event_id := gen_random_uuid();

  insert into public.attendance_events (
    id, staff_id, attendance_date, event_type, idempotency_key,
    location_category, latitude, longitude, location_accuracy_m,
    client_reported_at, attendance_policy_id
  )
  values (
    v_event_id, v_actor, v_attendance_date, 'check_out', p_idempotency_key,
    p_location_category,
    case when p_latitude is null then null else round(p_latitude::numeric, 3) end,
    case when p_longitude is null then null else round(p_longitude::numeric, 3) end,
    p_location_accuracy_m,
    p_client_reported_at,
    v_policy.id
  );

  perform private.derive_attendance_day(v_actor, v_attendance_date);

  select * into v_day
  from public.attendance_days
  where staff_id = v_actor and attendance_date = v_attendance_date;

  return jsonb_build_object(
    'staffId', v_actor,
    'attendanceDate', v_attendance_date,
    'primaryStatus', v_day.primary_status,
    'eventId', v_event_id,
    'openSession', v_day.open_session,
    'idempotentReplay', false,
    'occurredAt', now()
  );
end;
$$;

create or replace function public.correct_attendance_day(
  p_staff_id uuid,
  p_attendance_date date,
  p_correction_type text,
  p_reason text,
  p_details jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_before jsonb;
  v_after jsonb;
  v_correction_id uuid := gen_random_uuid();
  v_day public.attendance_days%rowtype;
  v_can_correct boolean := false;
begin
  v_actor := private.staff_require_active_actor();

  v_can_correct :=
    (select public.authorize('attendance.correct.all'))
    or (
      (select public.authorize('attendance.correct.team'))
      and p_staff_id in (select private.staff_direct_report_ids(v_actor))
    );

  if not v_can_correct then
    raise exception 'ATTENDANCE_MANAGER_SCOPE_DENIED' using errcode = '42501';
  end if;

  if p_reason is null or length(trim(p_reason)) < 1 or length(trim(p_reason)) > 500 then
    raise exception 'ATTENDANCE_INVALID_CORRECTION' using errcode = 'P0001';
  end if;

  if p_correction_type not in (
    'set_primary_status', 'clear_missing_checkout',
    'adjust_worked_minutes', 'void_open_session'
  ) then
    raise exception 'ATTENDANCE_INVALID_CORRECTION' using errcode = 'P0001';
  end if;

  select to_jsonb(ad.*) into v_before
  from public.attendance_days ad
  where ad.staff_id = p_staff_id
    and ad.attendance_date = p_attendance_date;

  insert into public.attendance_corrections (
    id, staff_id, attendance_date, actor_id, reason,
    correction_type, before_digest, after_digest, details
  )
  values (
    v_correction_id, p_staff_id, p_attendance_date, v_actor, trim(p_reason),
    p_correction_type,
    private.staff_digest_json(v_before),
    private.staff_digest_json(coalesce(p_details, '{}'::jsonb)),
    coalesce(p_details, '{}'::jsonb)
  );

  perform private.derive_attendance_day(p_staff_id, p_attendance_date);

  update public.attendance_days
  set has_manual_adjustment = true
  where staff_id = p_staff_id
    and attendance_date = p_attendance_date;

  select * into v_day
  from public.attendance_days
  where staff_id = p_staff_id
    and attendance_date = p_attendance_date;

  v_after := to_jsonb(v_day);

  return jsonb_build_object(
    'correctionId', v_correction_id,
    'staffId', p_staff_id,
    'attendanceDate', p_attendance_date,
    'primaryStatus', v_day.primary_status
  );
end;
$$;

create or replace function public.publish_attendance_policy(
  p_code text,
  p_name text,
  p_timezone text,
  p_workday_start_local time,
  p_workday_end_local time,
  p_late_grace_minutes integer,
  p_half_day_threshold_minutes integer,
  p_missing_checkout_cutoff_local time,
  p_weekly_off_days smallint[],
  p_location_required boolean,
  p_supersedes_policy_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_policy_id uuid;
begin
  v_actor := private.staff_require_active_actor();

  if not (select public.authorize('attendance.policies.manage')) then
    raise exception 'ATTENDANCE_UNAUTHORIZED' using errcode = '42501';
  end if;

  if p_timezone <> 'Asia/Kolkata' then
    raise exception 'ATTENDANCE_POLICY_NOT_CONFIGURED' using errcode = 'P0001';
  end if;

  if p_weekly_off_days is null
    or coalesce(array_length(p_weekly_off_days, 1), 0) < 1
    or p_weekly_off_days <> (
      select coalesce(array_agg(distinct d order by d), '{}'::smallint[])
      from unnest(p_weekly_off_days) as d
    ) then
    raise exception 'ATTENDANCE_POLICY_NOT_CONFIGURED' using errcode = 'P0001';
  end if;

  insert into public.attendance_policies (
    code, name, timezone,
    workday_start_local, workday_end_local,
    late_grace_minutes, half_day_threshold_minutes,
    missing_checkout_cutoff_local, weekly_off_days,
    location_required, is_current, supersedes_policy_id
  )
  values (
    lower(trim(p_code)), trim(p_name), p_timezone,
    p_workday_start_local, p_workday_end_local,
    p_late_grace_minutes, p_half_day_threshold_minutes,
    p_missing_checkout_cutoff_local, p_weekly_off_days,
    coalesce(p_location_required, false), false, p_supersedes_policy_id
  )
  returning id into v_policy_id;

  return jsonb_build_object('policyId', v_policy_id, 'code', lower(trim(p_code)));
end;
$$;

create or replace function public.set_current_attendance_policy(p_policy_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
begin
  v_actor := private.staff_require_active_actor();

  if not (select public.authorize('attendance.policies.manage')) then
    raise exception 'ATTENDANCE_UNAUTHORIZED' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.attendance_policies where id = p_policy_id
  ) then
    raise exception 'ATTENDANCE_POLICY_NOT_CONFIGURED' using errcode = 'P0001';
  end if;

  update public.attendance_policies
  set is_current = false
  where is_current = true;

  update public.attendance_policies
  set is_current = true
  where id = p_policy_id;

  return jsonb_build_object('policyId', p_policy_id, 'isCurrent', true);
end;
$$;

-- -----------------------------------------------------------------------------
-- F. Leave RPCs
-- -----------------------------------------------------------------------------

create or replace function public.create_leave_request(
  p_leave_type_id uuid,
  p_start_date date,
  p_end_date date,
  p_reason text,
  p_half_day_part text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_type public.leave_types%rowtype;
  v_request_id uuid := gen_random_uuid();
begin
  v_actor := private.staff_require_active_actor();

  if not (select public.authorize('leave.self')) then
    raise exception 'LEAVE_UNAUTHORIZED' using errcode = '42501';
  end if;

  if p_end_date < p_start_date then
    raise exception 'LEAVE_INVALID_RANGE' using errcode = 'P0001';
  end if;

  select * into v_type
  from public.leave_types
  where id = p_leave_type_id and is_active = true;

  if not found then
    raise exception 'LEAVE_INVALID_RANGE' using errcode = 'P0001';
  end if;

  if p_half_day_part is not null and not v_type.allows_half_day then
    raise exception 'LEAVE_HALF_DAY_NOT_ALLOWED' using errcode = 'P0001';
  end if;

  if exists (
    select 1
    from public.leave_requests lr
    where lr.staff_id = v_actor
      and lr.status = 'approved'
      and daterange(lr.start_date, lr.end_date, '[]')
          && daterange(p_start_date, p_end_date, '[]')
  ) then
    raise exception 'LEAVE_OVERLAP' using errcode = 'P0001';
  end if;

  insert into public.leave_requests (
    id, staff_id, leave_type_id, start_date, end_date,
    half_day_part, reason, status
  )
  values (
    v_request_id, v_actor, p_leave_type_id, p_start_date, p_end_date,
    p_half_day_part, trim(p_reason), 'pending'
  );

  return jsonb_build_object('requestId', v_request_id, 'status', 'pending');
end;
$$;

create or replace function public.cancel_leave_request(
  p_request_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_request public.leave_requests%rowtype;
begin
  v_actor := private.staff_require_active_actor();

  select * into v_request
  from public.leave_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'leave request not found' using errcode = 'P0002';
  end if;

  if not (
    (v_request.staff_id = v_actor and (select public.authorize('leave.self')))
    or (select public.authorize('leave.manage'))
  ) then
    raise exception 'LEAVE_UNAUTHORIZED' using errcode = '42501';
  end if;

  if v_request.status = 'approved' then
    raise exception 'LEAVE_NOT_CANCELLABLE' using errcode = 'P0001';
  end if;

  if v_request.status in ('cancelled', 'rejected') then
    return jsonb_build_object('requestId', p_request_id, 'status', v_request.status);
  end if;

  update public.leave_requests
  set status = 'cancelled',
      review_note = left(trim(coalesce(p_reason, '')), 500),
      reviewed_by = v_actor,
      reviewed_at = now()
  where id = p_request_id;

  return jsonb_build_object('requestId', p_request_id, 'status', 'cancelled');
end;
$$;

create or replace function public.approve_leave_request(
  p_request_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_request public.leave_requests%rowtype;
  v_can_approve boolean := false;
  v_d date;
begin
  v_actor := private.staff_require_active_actor();

  select * into v_request
  from public.leave_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'leave request not found' using errcode = 'P0002';
  end if;

  if v_request.staff_id = v_actor then
    raise exception 'LEAVE_SELF_APPROVAL_DENIED' using errcode = 'P0001';
  end if;

  v_can_approve :=
    (select public.authorize('leave.manage'))
    or (
      (select public.authorize('leave.team.approve'))
      and v_request.staff_id in (select private.staff_direct_report_ids(v_actor))
    );

  if not v_can_approve then
    raise exception 'LEAVE_MANAGER_SCOPE_DENIED' using errcode = '42501';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'LEAVE_INVALID_RANGE' using errcode = 'P0001';
  end if;

  update public.leave_requests
  set status = 'approved',
      reviewed_by = v_actor,
      reviewed_at = now(),
      review_note = left(trim(coalesce(p_note, '')), 500)
  where id = p_request_id;

  for v_d in
    select generate_series(v_request.start_date, v_request.end_date, interval '1 day')::date
  loop
    perform private.derive_attendance_day(v_request.staff_id, v_d);
  end loop;

  return jsonb_build_object('requestId', p_request_id, 'status', 'approved');
end;
$$;

create or replace function public.reject_leave_request(
  p_request_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_request public.leave_requests%rowtype;
  v_can_reject boolean := false;
begin
  v_actor := private.staff_require_active_actor();

  select * into v_request
  from public.leave_requests
  where id = p_request_id
  for update;

  if not found then
    raise exception 'leave request not found' using errcode = 'P0002';
  end if;

  if v_request.staff_id = v_actor then
    raise exception 'LEAVE_SELF_APPROVAL_DENIED' using errcode = 'P0001';
  end if;

  v_can_reject :=
    (select public.authorize('leave.manage'))
    or (
      (select public.authorize('leave.team.approve'))
      and v_request.staff_id in (select private.staff_direct_report_ids(v_actor))
    );

  if not v_can_reject then
    raise exception 'LEAVE_MANAGER_SCOPE_DENIED' using errcode = '42501';
  end if;

  if v_request.status <> 'pending' then
    raise exception 'LEAVE_INVALID_RANGE' using errcode = 'P0001';
  end if;

  update public.leave_requests
  set status = 'rejected',
      reviewed_by = v_actor,
      reviewed_at = now(),
      review_note = left(trim(coalesce(p_note, '')), 500)
  where id = p_request_id;

  return jsonb_build_object('requestId', p_request_id, 'status', 'rejected');
end;
$$;

-- -----------------------------------------------------------------------------
-- G. Holiday RPCs
-- -----------------------------------------------------------------------------

create or replace function public.create_holiday(
  p_holiday_date date,
  p_name text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_holiday_id uuid;
begin
  v_actor := private.staff_require_active_actor();

  if not (select public.authorize('holidays.manage')) then
    raise exception 'ATTENDANCE_UNAUTHORIZED' using errcode = '42501';
  end if;

  if p_name is null or length(trim(p_name)) < 1 then
    raise exception 'validation: holiday name required' using errcode = '22023';
  end if;

  insert into public.holidays (holiday_date, name, is_active)
  values (p_holiday_date, trim(p_name), true)
  returning id into v_holiday_id;

  perform private.derive_attendance_day(sep.staff_id, p_holiday_date)
  from public.staff_employment_profiles sep
  where sep.attendance_eligible = true
    and sep.attendance_policy_id is not null;

  return jsonb_build_object('holidayId', v_holiday_id, 'holidayDate', p_holiday_date);
exception
  when unique_violation then
    raise exception 'active holiday already exists for date' using errcode = 'P0001';
end;
$$;

create or replace function public.archive_holiday(p_holiday_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_holiday public.holidays%rowtype;
begin
  v_actor := private.staff_require_active_actor();

  if not (select public.authorize('holidays.manage')) then
    raise exception 'ATTENDANCE_UNAUTHORIZED' using errcode = '42501';
  end if;

  select * into v_holiday
  from public.holidays
  where id = p_holiday_id
  for update;

  if not found then
    raise exception 'holiday not found' using errcode = 'P0002';
  end if;

  update public.holidays
  set is_active = false
  where id = p_holiday_id;

  perform private.derive_attendance_day(sep.staff_id, v_holiday.holiday_date)
  from public.staff_employment_profiles sep
  where sep.attendance_eligible = true
    and sep.attendance_policy_id is not null;

  return jsonb_build_object('holidayId', p_holiday_id, 'isActive', false);
end;
$$;

-- -----------------------------------------------------------------------------
-- H. RLS
-- -----------------------------------------------------------------------------

alter table public.attendance_policies enable row level security;
alter table public.staff_employment_profiles enable row level security;
alter table public.staff_admin_events enable row level security;
alter table public.attendance_events enable row level security;
alter table public.attendance_days enable row level security;
alter table public.attendance_corrections enable row level security;
alter table public.leave_types enable row level security;
alter table public.leave_requests enable row level security;
alter table public.holidays enable row level security;

revoke all on table
  public.attendance_policies,
  public.staff_employment_profiles,
  public.staff_admin_events,
  public.attendance_events,
  public.attendance_days,
  public.attendance_corrections,
  public.leave_types,
  public.leave_requests,
  public.holidays
from public, anon;

revoke insert, update, delete on table public.attendance_policies from authenticated;

create policy staff_employment_profiles_select
  on public.staff_employment_profiles
  for select
  to authenticated
  using (private.staff_can_view_employment((select auth.uid()), staff_id));

create policy attendance_policies_select
  on public.attendance_policies
  for select
  to authenticated
  using (
    (select public.authorize('attendance.policies.manage'))
    or (
      is_current = true
      and exists (
        select 1
        from public.profiles vp
        where vp.id = (select auth.uid())
          and vp.status = 'active'
      )
    )
  );

create policy staff_admin_events_select_sa
  on public.staff_admin_events
  for select
  to authenticated
  using ((select public.authorize('staff.manage')));

create policy attendance_events_select
  on public.attendance_events
  for select
  to authenticated
  using (private.staff_can_view_attendance((select auth.uid()), staff_id));

create policy attendance_days_select
  on public.attendance_days
  for select
  to authenticated
  using (private.staff_can_view_attendance((select auth.uid()), staff_id));

create policy attendance_corrections_select
  on public.attendance_corrections
  for select
  to authenticated
  using (
    (select public.authorize('attendance.correct.all'))
    or (
      (select public.authorize('attendance.correct.team'))
      and staff_id in (select private.staff_direct_report_ids((select auth.uid())))
    )
  );

create policy leave_types_select_active
  on public.leave_types
  for select
  to authenticated
  using (
    is_active = true
    or (select public.authorize('leave.manage'))
  );

create policy leave_requests_select
  on public.leave_requests
  for select
  to authenticated
  using (
    staff_id = (select auth.uid())
    or (select public.authorize('leave.manage'))
    or (
      (select public.authorize('leave.team.approve'))
      and staff_id in (select private.staff_direct_report_ids((select auth.uid())))
    )
  );

create policy holidays_select_active
  on public.holidays
  for select
  to authenticated
  using (
    is_active = true
    or (select public.authorize('holidays.manage'))
  );

grant select on table
  public.attendance_policies,
  public.staff_employment_profiles,
  public.staff_admin_events,
  public.attendance_events,
  public.attendance_days,
  public.attendance_corrections,
  public.leave_types,
  public.leave_requests,
  public.holidays
to authenticated;

-- -----------------------------------------------------------------------------
-- I. Function grants & ownership
-- -----------------------------------------------------------------------------

revoke all on function private.staff_require_active_actor() from public, anon, authenticated;
revoke all on function private.staff_attendance_business_date(timestamptz) from public, anon, authenticated;
revoke all on function private.staff_direct_report_ids(uuid) from public, anon, authenticated;
revoke all on function private.assert_no_reporting_cycle(uuid, uuid) from public, anon, authenticated;
revoke all on function private.staff_can_view_employment(uuid, uuid) from public, anon, authenticated;
revoke all on function private.staff_can_view_attendance(uuid, uuid) from public, anon, authenticated;
revoke all on function private.staff_current_attendance_policy_id(uuid) from public, anon, authenticated;
revoke all on function private.staff_append_admin_event(uuid, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function private.staff_digest_json(jsonb) from public, anon, authenticated;
revoke all on function private.derive_attendance_day(uuid, date) from public, anon, authenticated;
revoke all on function private.staff_assert_attendance_eligible(uuid) from public, anon, authenticated;
revoke all on function private.staff_validate_attendance_location(public.attendance_policies, text, numeric, numeric, numeric) from public, anon, authenticated;

revoke all on function private.staff_finalize_invite_from_saga(uuid, uuid) from public, anon, authenticated;

revoke all on function public.prepare_staff_invite_saga(uuid, text, text, text, text, text, date, text, uuid, boolean, uuid) from public, anon;
revoke all on function public.record_staff_invite_auth_success(uuid, uuid) from public, anon;
revoke all on function public.create_staff_member(uuid) from public, anon;
revoke all on function public.reconcile_staff_invite(uuid) from public, anon;
revoke all on function public.resend_staff_invite(uuid, text) from public, anon;
revoke all on function public.set_staff_profile_status(uuid, text, text) from public, anon;
revoke all on function public.set_staff_reporting_manager(uuid, uuid, text) from public, anon;
revoke all on function public.update_staff_employment(uuid, text, text, date, text, text, boolean, uuid, text) from public, anon;
revoke all on function public.check_in_attendance(text, text, numeric, numeric, numeric, timestamptz) from public, anon;
revoke all on function public.check_out_attendance(text, text, numeric, numeric, numeric, timestamptz) from public, anon;
revoke all on function public.correct_attendance_day(uuid, date, text, text, jsonb) from public, anon;
revoke all on function public.publish_attendance_policy(text, text, text, time, time, integer, integer, time, smallint[], boolean, uuid) from public, anon;
revoke all on function public.set_current_attendance_policy(uuid) from public, anon;
revoke all on function public.create_leave_request(uuid, date, date, text, text) from public, anon;
revoke all on function public.cancel_leave_request(uuid, text) from public, anon;
revoke all on function public.approve_leave_request(uuid, text) from public, anon;
revoke all on function public.reject_leave_request(uuid, text) from public, anon;
revoke all on function public.create_holiday(date, text) from public, anon;
revoke all on function public.archive_holiday(uuid) from public, anon;

grant execute on function private.staff_can_view_employment(uuid, uuid) to authenticated;
grant execute on function private.staff_can_view_attendance(uuid, uuid) to authenticated;

grant execute on function public.prepare_staff_invite_saga(uuid, text, text, text, text, text, date, text, uuid, boolean, uuid) to authenticated;
grant execute on function public.record_staff_invite_auth_success(uuid, uuid) to authenticated;
grant execute on function public.create_staff_member(uuid) to authenticated;
grant execute on function public.reconcile_staff_invite(uuid) to authenticated;
grant execute on function public.resend_staff_invite(uuid, text) to authenticated;
grant execute on function public.set_staff_profile_status(uuid, text, text) to authenticated;
grant execute on function public.set_staff_reporting_manager(uuid, uuid, text) to authenticated;
grant execute on function public.update_staff_employment(uuid, text, text, date, text, text, boolean, uuid, text) to authenticated;
grant execute on function public.check_in_attendance(text, text, numeric, numeric, numeric, timestamptz) to authenticated;
grant execute on function public.check_out_attendance(text, text, numeric, numeric, numeric, timestamptz) to authenticated;
grant execute on function public.correct_attendance_day(uuid, date, text, text, jsonb) to authenticated;
grant execute on function public.publish_attendance_policy(text, text, text, time, time, integer, integer, time, smallint[], boolean, uuid) to authenticated;
grant execute on function public.set_current_attendance_policy(uuid) to authenticated;
grant execute on function public.create_leave_request(uuid, date, date, text, text) to authenticated;
grant execute on function public.cancel_leave_request(uuid, text) to authenticated;
grant execute on function public.approve_leave_request(uuid, text) to authenticated;
grant execute on function public.reject_leave_request(uuid, text) to authenticated;
grant execute on function public.create_holiday(date, text) to authenticated;
grant execute on function public.archive_holiday(uuid) to authenticated;

alter function private.staff_require_active_actor() owner to postgres;
alter function private.derive_attendance_day(uuid, date) owner to postgres;
alter function private.staff_finalize_invite_from_saga(uuid, uuid) owner to postgres;
alter function public.prepare_staff_invite_saga(uuid, text, text, text, text, text, date, text, uuid, boolean, uuid) owner to postgres;
alter function public.record_staff_invite_auth_success(uuid, uuid) owner to postgres;
alter function public.create_staff_member(uuid) owner to postgres;
alter function public.reconcile_staff_invite(uuid) owner to postgres;
alter function public.resend_staff_invite(uuid, text) owner to postgres;
alter function public.set_staff_profile_status(uuid, text, text) owner to postgres;
alter function public.set_staff_reporting_manager(uuid, uuid, text) owner to postgres;
alter function public.update_staff_employment(uuid, text, text, date, text, text, boolean, uuid, text) owner to postgres;
alter function public.check_in_attendance(text, text, numeric, numeric, numeric, timestamptz) owner to postgres;
alter function public.check_out_attendance(text, text, numeric, numeric, numeric, timestamptz) owner to postgres;
alter function public.correct_attendance_day(uuid, date, text, text, jsonb) owner to postgres;
alter function public.publish_attendance_policy(text, text, text, time, time, integer, integer, time, smallint[], boolean, uuid) owner to postgres;
alter function public.set_current_attendance_policy(uuid) owner to postgres;
alter function public.create_leave_request(uuid, date, date, text, text) owner to postgres;
alter function public.cancel_leave_request(uuid, text) owner to postgres;
alter function public.approve_leave_request(uuid, text) owner to postgres;
alter function public.reject_leave_request(uuid, text) owner to postgres;
alter function public.create_holiday(date, text) owner to postgres;
alter function public.archive_holiday(uuid) owner to postgres;
