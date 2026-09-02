-- ONEDECORE Workforce V1 — attendance submission & approval lifecycle
--
-- Forward-only. Extends the Phase 6D foundation (M23/M24); edits nothing that
-- already shipped. The Phase 6D tables keep their existing meaning:
--
--   attendance_events  -> RAW, server-timestamped check-in/check-out evidence
--   attendance_days    -> DERIVED wall-clock facts (worked minutes, open session)
--   attendance_*       -> unchanged
--
-- This migration adds the third, separate layer the owner locked:
--
--   attendance_submissions        -> staff submission + Super Admin approval,
--                                    and the FINAL credited attendance category
--   attendance_submission_events  -> append-only audit of every state/category
--                                    change, with previous and new values
--
-- Credited attendance is therefore never inferred from elapsed wall-clock time:
-- `attendance_days.worked_minutes` stays evidence, and `final_category` /
-- `credited_minutes` are what payroll consumes.
--
-- Owner-locked business rules encoded here:
--   * NO fixed weekly-off weekday. `attendance_policies.weekly_off_days` is a
--     recurring-weekday column from M23 and is deliberately NOT consulted for
--     V1 weekly-off decisions. Weekly Off is chosen day-by-day by staff.
--   * Weekly Off is capped at 4 ACTIVE (pending + approved) days per employee
--     per calendar month, keyed on attendance_date in Asia/Kolkata. A rejected
--     or correction-returned Weekly Off frees a slot. The cap is a hard limit
--     for Super Admin approval too, including historical correction.
--   * Categories: ABSENT (0h), WEEKLY_OFF, HALF_DAY_4H (4h), FULL_DAY_8H (8h),
--     FULL_DAY_12H (12h). Staff may NOT submit ABSENT.
--   * 09:00 official start with a 15-minute grace: <= 09:15 on time, >= 09:16
--     late. `late_minutes` is measured from the official start (09:16 -> 16)
--     and is evidence only: lateness never downgrades a category automatically.
--   * Only Super Admin (`attendance.approve`) may approve, reject, return for
--     correction, or set the final category.

-- -----------------------------------------------------------------------------
-- A. Permission
-- -----------------------------------------------------------------------------

insert into public.permissions (code, name, description, is_system, is_active) values
  (
    'attendance.approve',
    'Approve Attendance',
    'Approve, reject, return for correction, and set final attendance category',
    true,
    true
  )
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  is_system = true,
  is_active = true;

-- Super Admin only. Managers keep read-only team visibility via
-- attendance.team.read and are deliberately not granted approval authority.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'super_admin'
  and p.code = 'attendance.approve'
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- A2. Remove the recurring weekly-off requirement
-- -----------------------------------------------------------------------------
--
-- Phase 6D required every attendance policy to declare AT LEAST ONE recurring
-- weekly-off weekday (`array_length(weekly_off_days, 1) >= 1`). Workforce V1
-- locks the opposite rule: there is NO fixed weekly-off weekday, and Weekly Off
-- is chosen day-by-day by the employee. An EMPTY array must therefore be
-- representable, otherwise the schema forces a weekday the business does not
-- have.
--
-- Forward-only constraint relaxation. The element domain (1..7) is unchanged, so
-- every existing policy remains valid; only the non-empty requirement is lifted.

alter table public.attendance_policies
  drop constraint if exists chk_attendance_policies_weekly_off_days;

alter table public.attendance_policies
  add constraint chk_attendance_policies_weekly_off_days
  check (
    weekly_off_days <@ array[1, 2, 3, 4, 5, 6, 7]::smallint[]
  );

comment on column public.attendance_policies.weekly_off_days is
  'Legacy Phase 6D recurring weekly-off weekdays. NOT consulted by Workforce V1: an empty array is the V1 default and Weekly Off is chosen day-by-day, capped at 4 per employee per calendar month.';

-- -----------------------------------------------------------------------------
-- B. Tables
-- -----------------------------------------------------------------------------

create table public.attendance_submissions (
  staff_id uuid not null references public.profiles (id) on delete cascade,
  attendance_date date not null,
  lifecycle_state text not null default 'NOT_STARTED',
  submitted_category text,
  submitted_at timestamptz,
  final_category text,
  credited_minutes integer,
  late_minutes integer not null default 0,
  is_late boolean not null default false,
  attendance_policy_id uuid references public.attendance_policies (id),
  reviewed_by uuid references public.profiles (id),
  reviewed_at timestamptz,
  review_note text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (staff_id, attendance_date),

  constraint chk_attendance_submissions_lifecycle check (
    lifecycle_state = any (array[
      'NOT_STARTED',
      'CHECKED_IN',
      'CHECKED_OUT',
      'SUBMITTED',
      'PENDING_APPROVAL',
      'APPROVED',
      'REJECTED',
      'CORRECTION_REQUIRED'
    ])
  ),

  -- Staff may never submit ABSENT; only a Super Admin can mark absence.
  constraint chk_attendance_submissions_submitted_category check (
    submitted_category is null
    or submitted_category = any (array[
      'WEEKLY_OFF',
      'HALF_DAY_4H',
      'FULL_DAY_8H',
      'FULL_DAY_12H'
    ])
  ),

  constraint chk_attendance_submissions_final_category check (
    final_category is null
    or final_category = any (array[
      'ABSENT',
      'WEEKLY_OFF',
      'HALF_DAY_4H',
      'FULL_DAY_8H',
      'FULL_DAY_12H'
    ])
  ),

  constraint chk_attendance_submissions_credited_minutes check (
    credited_minutes is null
    or credited_minutes = any (array[0, 240, 480, 720])
  ),

  -- Credited minutes must always agree with the final category.
  constraint chk_attendance_submissions_credit_matches_category check (
    final_category is null
    or (final_category = 'ABSENT' and credited_minutes = 0)
    or (final_category = 'WEEKLY_OFF' and credited_minutes = 0)
    or (final_category = 'HALF_DAY_4H' and credited_minutes = 240)
    or (final_category = 'FULL_DAY_8H' and credited_minutes = 480)
    or (final_category = 'FULL_DAY_12H' and credited_minutes = 720)
  ),

  -- An approved day is final and payroll-valid: it must carry a category,
  -- credited minutes and a reviewer.
  constraint chk_attendance_submissions_approved_complete check (
    lifecycle_state <> 'APPROVED'
    or (
      final_category is not null
      and credited_minutes is not null
      and reviewed_by is not null
      and reviewed_at is not null
    )
  ),

  constraint chk_attendance_submissions_late_minutes check (
    late_minutes >= 0 and late_minutes <= 1440
  ),

  constraint chk_attendance_submissions_review_note check (
    review_note is null or length(trim(review_note)) <= 500
  )
);

comment on table public.attendance_submissions is
  'Workforce V1 attendance submission and Super Admin approval. Final credited attendance; separate from raw attendance_events and derived attendance_days.';
comment on column public.attendance_submissions.credited_minutes is
  'Payroll-valid credited minutes implied by final_category. Never derived from elapsed wall-clock time.';
comment on column public.attendance_submissions.late_minutes is
  'Minutes after the 09:00 official start, in the policy timezone. Evidence only; never downgrades a category.';

create index idx_attendance_submissions_state
  on public.attendance_submissions (lifecycle_state, attendance_date desc);

create index idx_attendance_submissions_date
  on public.attendance_submissions (attendance_date desc, staff_id);

-- Supports the per-employee, per-calendar-month weekly-off quota probe.
create index idx_attendance_submissions_weekly_off
  on public.attendance_submissions (staff_id, attendance_date)
  where submitted_category = 'WEEKLY_OFF' or final_category = 'WEEKLY_OFF';

create table public.attendance_submission_events (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles (id) on delete cascade,
  attendance_date date not null,
  actor_id uuid references public.profiles (id),
  event_type text not null,
  previous_state text,
  new_state text,
  previous_category text,
  new_category text,
  reason text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint chk_attendance_submission_events_type check (
    event_type = any (array[
      'checked_in',
      'checked_out',
      'submitted',
      'approved',
      'rejected',
      'correction_required',
      'correction_requested',
      'final_category_set',
      'times_corrected'
    ])
  ),
  constraint chk_attendance_submission_events_reason check (
    reason is null or length(trim(reason)) <= 500
  ),
  constraint chk_attendance_submission_events_details check (
    pg_column_size(details) <= 2048
  )
);

comment on table public.attendance_submission_events is
  'Append-only audit of attendance lifecycle changes: previous value, new value, actor, timestamp and reason.';

create index idx_attendance_submission_events_staff_date
  on public.attendance_submission_events (staff_id, attendance_date, created_at desc);

-- -----------------------------------------------------------------------------
-- C. Private helpers
-- -----------------------------------------------------------------------------

-- Deterministic category -> credited minutes. Single source of truth; the table
-- constraint above mirrors it so no code path can disagree.
create or replace function private.workforce_category_credited_minutes(p_category text)
returns integer
language sql
immutable
set search_path = ''
as $$
  select case p_category
    when 'ABSENT' then 0
    when 'WEEKLY_OFF' then 0
    when 'HALF_DAY_4H' then 240
    when 'FULL_DAY_8H' then 480
    when 'FULL_DAY_12H' then 720
    else null
  end;
$$;

comment on function private.workforce_category_credited_minutes(text) is
  'Workforce V1 credited minutes for a final attendance category.';

-- Calendar-month anchor for the weekly-off quota, in attendance-date space
-- (attendance_date is already an Asia/Kolkata business date from M23).
create or replace function private.workforce_month_start(p_date date)
returns date
language sql
immutable
set search_path = ''
as $$
  select date_trunc('month', p_date::timestamp)::date;
$$;

-- Counts ACTIVE weekly-off days for one employee in the calendar month of
-- p_date. Active = still consuming quota: anything not rejected and not
-- returned for correction. Optionally excludes one date so a re-submission of
-- the same day does not count itself.
create or replace function private.workforce_weekly_off_active_count(
  p_staff_id uuid,
  p_date date,
  p_exclude_date date default null
)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select count(*)::integer
  from public.attendance_submissions s
  where s.staff_id = p_staff_id
    and private.workforce_month_start(s.attendance_date)
        = private.workforce_month_start(p_date)
    and (p_exclude_date is null or s.attendance_date <> p_exclude_date)
    and s.lifecycle_state not in ('REJECTED', 'CORRECTION_REQUIRED')
    and coalesce(s.final_category, s.submitted_category) = 'WEEKLY_OFF';
$$;

comment on function private.workforce_weekly_off_active_count(uuid, date, date) is
  'Weekly Off days consuming quota for the employee in the calendar month. Rejected or correction-returned days free their slot.';

-- Deterministic lateness in the policy timezone. late_minutes counts from the
-- official start; is_late only becomes true past the grace window.
create or replace function private.workforce_compute_late(
  p_policy_id uuid,
  p_first_check_in timestamptz
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_policy public.attendance_policies%rowtype;
  v_local_time time;
  v_start time;
  v_grace integer;
  v_minutes integer;
begin
  if p_first_check_in is null then
    return jsonb_build_object('lateMinutes', 0, 'isLate', false);
  end if;

  select * into v_policy from public.attendance_policies where id = p_policy_id;

  if not found then
    select * into v_policy from public.attendance_policies where is_current = true limit 1;
  end if;

  if not found then
    return jsonb_build_object('lateMinutes', 0, 'isLate', false);
  end if;

  v_start := v_policy.workday_start_local;
  v_grace := coalesce(v_policy.late_grace_minutes, 0);
  v_local_time := (timezone(v_policy.timezone, p_first_check_in))::time;

  v_minutes := greatest(
    0,
    (extract(epoch from (v_local_time - v_start)) / 60)::integer
  );

  return jsonb_build_object(
    'lateMinutes', v_minutes,
    -- <= grace is on time; the first minute past grace is late.
    'isLate', v_minutes > v_grace
  );
end;
$$;

comment on function private.workforce_compute_late(uuid, timestamptz) is
  'Deterministic late evidence in the policy timezone: minutes past official start, and whether the grace window was exceeded.';

create or replace function private.workforce_append_submission_event(
  p_staff_id uuid,
  p_attendance_date date,
  p_actor_id uuid,
  p_event_type text,
  p_previous_state text,
  p_new_state text,
  p_previous_category text,
  p_new_category text,
  p_reason text,
  p_details jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.attendance_submission_events (
    staff_id, attendance_date, actor_id, event_type,
    previous_state, new_state, previous_category, new_category,
    reason, details
  )
  values (
    p_staff_id, p_attendance_date, p_actor_id, p_event_type,
    p_previous_state, p_new_state, p_previous_category, p_new_category,
    nullif(trim(coalesce(p_reason, '')), ''), coalesce(p_details, '{}'::jsonb)
  );
$$;

-- Ensures a submission row exists for the day and returns it locked.
create or replace function private.workforce_ensure_submission(
  p_staff_id uuid,
  p_attendance_date date
)
returns public.attendance_submissions
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.attendance_submissions%rowtype;
begin
  insert into public.attendance_submissions (staff_id, attendance_date, attendance_policy_id)
  values (
    p_staff_id,
    p_attendance_date,
    private.staff_current_attendance_policy_id(p_staff_id)
  )
  on conflict (staff_id, attendance_date) do nothing;

  select * into v_row
  from public.attendance_submissions
  where staff_id = p_staff_id and attendance_date = p_attendance_date
  for update;

  return v_row;
end;
$$;

-- -----------------------------------------------------------------------------
-- D. Raw-evidence bridge
-- -----------------------------------------------------------------------------

-- Advances the lifecycle from raw check-in/check-out events without touching
-- the M23 RPCs. Never regresses an already submitted or decided day.
create or replace function private.workforce_sync_submission_from_event()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.attendance_submissions%rowtype;
  v_next text;
  v_late jsonb;
  v_first_in timestamptz;
begin
  v_row := private.workforce_ensure_submission(new.staff_id, new.attendance_date);

  if v_row.lifecycle_state in ('SUBMITTED', 'PENDING_APPROVAL', 'APPROVED', 'REJECTED') then
    -- A decided or submitted day keeps its state; the event is still recorded
    -- as raw evidence by the M23 tables.
    return new;
  end if;

  v_next := case new.event_type
    when 'check_in' then 'CHECKED_IN'
    when 'check_out' then 'CHECKED_OUT'
    else v_row.lifecycle_state
  end;

  -- A correction-returned day may re-progress, but never backwards from
  -- CHECKED_OUT to CHECKED_IN.
  if v_row.lifecycle_state = 'CHECKED_OUT' and v_next = 'CHECKED_IN' then
    v_next := 'CHECKED_OUT';
  end if;

  select min(occurred_at) into v_first_in
  from public.attendance_events
  where staff_id = new.staff_id
    and attendance_date = new.attendance_date
    and event_type = 'check_in';

  v_late := private.workforce_compute_late(
    coalesce(v_row.attendance_policy_id, new.attendance_policy_id),
    v_first_in
  );

  update public.attendance_submissions
  set lifecycle_state = v_next,
      late_minutes = (v_late ->> 'lateMinutes')::integer,
      is_late = (v_late ->> 'isLate')::boolean,
      updated_at = now()
  where staff_id = new.staff_id and attendance_date = new.attendance_date;

  perform private.workforce_append_submission_event(
    new.staff_id,
    new.attendance_date,
    new.staff_id,
    case new.event_type when 'check_in' then 'checked_in' else 'checked_out' end,
    v_row.lifecycle_state,
    v_next,
    null,
    null,
    null,
    jsonb_build_object('eventId', new.id)
  );

  return new;
end;
$$;

create trigger trg_workforce_sync_submission_from_event
after insert on public.attendance_events
for each row
execute function private.workforce_sync_submission_from_event();

-- -----------------------------------------------------------------------------
-- E. Staff RPCs
-- -----------------------------------------------------------------------------

-- Staff submits ONE daily category. Weekly Off is capped per calendar month.
create or replace function public.submit_attendance_day(
  p_attendance_date date,
  p_category text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.staff_require_active_actor();
  v_row public.attendance_submissions%rowtype;
  v_active integer;
begin
  if not (select public.authorize('attendance.self')) then
    raise exception 'ATTENDANCE_PERMISSION_DENIED' using errcode = '42501';
  end if;

  perform private.staff_assert_attendance_eligible(v_actor);

  if p_attendance_date is null or p_attendance_date > private.staff_attendance_business_date() then
    raise exception 'ATTENDANCE_DATE_INVALID' using errcode = 'P0001';
  end if;

  -- ABSENT is deliberately absent from this list: staff cannot mark themselves
  -- absent as a shortcut.
  if p_category is null or p_category not in
     ('WEEKLY_OFF', 'HALF_DAY_4H', 'FULL_DAY_8H', 'FULL_DAY_12H') then
    raise exception 'ATTENDANCE_CATEGORY_INVALID' using errcode = 'P0001';
  end if;

  v_row := private.workforce_ensure_submission(v_actor, p_attendance_date);

  -- An approved day is final; only an audited Super Admin correction changes it.
  if v_row.lifecycle_state = 'APPROVED' then
    raise exception 'ATTENDANCE_ALREADY_APPROVED' using errcode = 'P0001';
  end if;

  if v_row.lifecycle_state = 'PENDING_APPROVAL' and v_row.submitted_category = p_category then
    -- Idempotent re-submission of the same category.
    return jsonb_build_object(
      'staffId', v_actor,
      'attendanceDate', p_attendance_date,
      'lifecycleState', v_row.lifecycle_state,
      'submittedCategory', v_row.submitted_category,
      'idempotent', true
    );
  end if;

  if p_category = 'WEEKLY_OFF' then
    v_active := private.workforce_weekly_off_active_count(
      v_actor, p_attendance_date, p_attendance_date
    );
    if v_active >= 4 then
      raise exception 'ATTENDANCE_WEEKLY_OFF_QUOTA_EXCEEDED' using errcode = 'P0001';
    end if;
  end if;

  update public.attendance_submissions
  set submitted_category = p_category,
      submitted_at = now(),
      lifecycle_state = 'PENDING_APPROVAL',
      -- A fresh submission clears any earlier decision on the same day.
      reviewed_by = null,
      reviewed_at = null,
      review_note = null,
      updated_at = now()
  where staff_id = v_actor and attendance_date = p_attendance_date;

  perform private.workforce_append_submission_event(
    v_actor, p_attendance_date, v_actor, 'submitted',
    v_row.lifecycle_state, 'PENDING_APPROVAL',
    v_row.submitted_category, p_category, null,
    jsonb_build_object('selfSubmitted', true)
  );

  return jsonb_build_object(
    'staffId', v_actor,
    'attendanceDate', p_attendance_date,
    'lifecycleState', 'PENDING_APPROVAL',
    'submittedCategory', p_category,
    'idempotent', false
  );
end;
$$;

comment on function public.submit_attendance_day(date, text) is
  'Staff submits one daily attendance category. ABSENT is not submittable. Weekly Off is capped at 4 active days per calendar month.';

-- Staff asks for a correction when check-in/out evidence is wrong or missing.
create or replace function public.request_attendance_correction(
  p_attendance_date date,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.staff_require_active_actor();
  v_row public.attendance_submissions%rowtype;
begin
  if not (select public.authorize('attendance.self')) then
    raise exception 'ATTENDANCE_PERMISSION_DENIED' using errcode = '42501';
  end if;

  if p_note is null or length(trim(p_note)) < 1 or length(trim(p_note)) > 500 then
    raise exception 'ATTENDANCE_REASON_REQUIRED' using errcode = 'P0001';
  end if;

  v_row := private.workforce_ensure_submission(v_actor, p_attendance_date);

  perform private.workforce_append_submission_event(
    v_actor, p_attendance_date, v_actor, 'correction_requested',
    v_row.lifecycle_state, v_row.lifecycle_state,
    null, null, p_note, '{}'::jsonb
  );

  return jsonb_build_object(
    'staffId', v_actor,
    'attendanceDate', p_attendance_date,
    'lifecycleState', v_row.lifecycle_state,
    'correctionRequested', true
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- F. Super Admin RPCs
-- -----------------------------------------------------------------------------

create or replace function private.workforce_require_approver()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.staff_require_active_actor();
begin
  if not (select public.authorize('attendance.approve')) then
    raise exception 'ATTENDANCE_APPROVAL_DENIED' using errcode = '42501';
  end if;
  return v_actor;
end;
$$;

-- Approve a day, optionally overriding the category (Edit + Approve). This is
-- the ONLY path that produces payroll-valid attendance.
create or replace function public.approve_attendance_day(
  p_staff_id uuid,
  p_attendance_date date,
  p_final_category text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.workforce_require_approver();
  v_row public.attendance_submissions%rowtype;
  v_category text;
  v_minutes integer;
  v_active integer;
begin
  -- Self-approval is not an attendance authority.
  if p_staff_id = v_actor then
    raise exception 'ATTENDANCE_SELF_APPROVAL_DENIED' using errcode = '42501';
  end if;

  v_row := private.workforce_ensure_submission(p_staff_id, p_attendance_date);

  v_category := coalesce(nullif(trim(coalesce(p_final_category, '')), ''), v_row.submitted_category);

  if v_category is null then
    raise exception 'ATTENDANCE_CATEGORY_REQUIRED' using errcode = 'P0001';
  end if;

  v_minutes := private.workforce_category_credited_minutes(v_category);
  if v_minutes is null then
    raise exception 'ATTENDANCE_CATEGORY_INVALID' using errcode = 'P0001';
  end if;

  -- The monthly Weekly Off cap is a hard limit for approval too, including
  -- historical correction. A fifth approved Weekly Off is impossible.
  if v_category = 'WEEKLY_OFF' then
    v_active := private.workforce_weekly_off_active_count(
      p_staff_id, p_attendance_date, p_attendance_date
    );
    if v_active >= 4 then
      raise exception 'ATTENDANCE_WEEKLY_OFF_QUOTA_EXCEEDED' using errcode = 'P0001';
    end if;
  end if;

  update public.attendance_submissions
  set lifecycle_state = 'APPROVED',
      final_category = v_category,
      credited_minutes = v_minutes,
      reviewed_by = v_actor,
      reviewed_at = now(),
      review_note = nullif(trim(coalesce(p_note, '')), ''),
      updated_at = now()
  where staff_id = p_staff_id and attendance_date = p_attendance_date;

  perform private.workforce_append_submission_event(
    p_staff_id, p_attendance_date, v_actor,
    case when v_row.final_category is distinct from v_category and v_row.final_category is not null
         then 'final_category_set' else 'approved' end,
    v_row.lifecycle_state, 'APPROVED',
    coalesce(v_row.final_category, v_row.submitted_category), v_category,
    p_note,
    jsonb_build_object('creditedMinutes', v_minutes)
  );

  return jsonb_build_object(
    'staffId', p_staff_id,
    'attendanceDate', p_attendance_date,
    'lifecycleState', 'APPROVED',
    'finalCategory', v_category,
    'creditedMinutes', v_minutes
  );
end;
$$;

comment on function public.approve_attendance_day(uuid, date, text, text) is
  'Super Admin approval. Only path producing payroll-valid attendance. Enforces the 4-per-month Weekly Off cap and forbids self-approval.';

create or replace function public.reject_attendance_day(
  p_staff_id uuid,
  p_attendance_date date,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.workforce_require_approver();
  v_row public.attendance_submissions%rowtype;
begin
  if p_staff_id = v_actor then
    raise exception 'ATTENDANCE_SELF_APPROVAL_DENIED' using errcode = '42501';
  end if;

  if p_note is null or length(trim(p_note)) < 1 then
    raise exception 'ATTENDANCE_REASON_REQUIRED' using errcode = 'P0001';
  end if;

  v_row := private.workforce_ensure_submission(p_staff_id, p_attendance_date);

  -- Rejecting clears the final category, which is what frees a Weekly Off slot.
  update public.attendance_submissions
  set lifecycle_state = 'REJECTED',
      final_category = null,
      credited_minutes = null,
      reviewed_by = v_actor,
      reviewed_at = now(),
      review_note = trim(p_note),
      updated_at = now()
  where staff_id = p_staff_id and attendance_date = p_attendance_date;

  perform private.workforce_append_submission_event(
    p_staff_id, p_attendance_date, v_actor, 'rejected',
    v_row.lifecycle_state, 'REJECTED',
    coalesce(v_row.final_category, v_row.submitted_category), null,
    p_note, '{}'::jsonb
  );

  return jsonb_build_object(
    'staffId', p_staff_id,
    'attendanceDate', p_attendance_date,
    'lifecycleState', 'REJECTED'
  );
end;
$$;

create or replace function public.return_attendance_for_correction(
  p_staff_id uuid,
  p_attendance_date date,
  p_note text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.workforce_require_approver();
  v_row public.attendance_submissions%rowtype;
begin
  if p_staff_id = v_actor then
    raise exception 'ATTENDANCE_SELF_APPROVAL_DENIED' using errcode = '42501';
  end if;

  if p_note is null or length(trim(p_note)) < 1 then
    raise exception 'ATTENDANCE_REASON_REQUIRED' using errcode = 'P0001';
  end if;

  v_row := private.workforce_ensure_submission(p_staff_id, p_attendance_date);

  update public.attendance_submissions
  set lifecycle_state = 'CORRECTION_REQUIRED',
      final_category = null,
      credited_minutes = null,
      reviewed_by = v_actor,
      reviewed_at = now(),
      review_note = trim(p_note),
      updated_at = now()
  where staff_id = p_staff_id and attendance_date = p_attendance_date;

  perform private.workforce_append_submission_event(
    p_staff_id, p_attendance_date, v_actor, 'correction_required',
    v_row.lifecycle_state, 'CORRECTION_REQUIRED',
    coalesce(v_row.final_category, v_row.submitted_category), null,
    p_note, '{}'::jsonb
  );

  return jsonb_build_object(
    'staffId', p_staff_id,
    'attendanceDate', p_attendance_date,
    'lifecycleState', 'CORRECTION_REQUIRED'
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- G. Read models
-- -----------------------------------------------------------------------------

-- Super Admin approval inbox. Joins raw evidence, derived facts and submission
-- state into the row the owner specified, including exception flags.
create or replace function public.get_attendance_approval_inbox(
  p_from date default null,
  p_to date default null,
  p_limit integer default 200
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_from date := coalesce(p_from, private.staff_attendance_business_date() - 30);
  v_to date := coalesce(p_to, private.staff_attendance_business_date());
  v_limit integer := least(greatest(coalesce(p_limit, 200), 1), 500);
  v_rows jsonb;
begin
  perform private.workforce_require_approver();

  select coalesce(jsonb_agg(row_to_json(t)::jsonb order by t.attendance_date desc, t.employee_code), '[]'::jsonb)
  into v_rows
  from (
    select
      s.staff_id,
      p.display_name as employee_name,
      ep.employee_code,
      s.attendance_date,
      d.first_check_in_at as in_time,
      d.last_check_out_at as out_time,
      d.worked_minutes as elapsed_minutes,
      s.submitted_category,
      s.final_category,
      s.credited_minutes,
      s.late_minutes,
      s.is_late,
      s.lifecycle_state,
      s.review_note,
      s.reviewed_at,
      -- Exception flags, computed rather than stored so they can never drift.
      (
        select coalesce(jsonb_agg(f), '[]'::jsonb)
        from (
          select 'LATE'::text as f where s.is_late
          union all
          select 'MISSING_CHECK_IN' where d.first_check_in_at is null
            and s.lifecycle_state not in ('NOT_STARTED')
          union all
          select 'MISSING_CHECK_OUT' where d.first_check_in_at is not null
            and d.last_check_out_at is null
          union all
          select 'VERY_SHORT_ATTENDANCE' where coalesce(d.worked_minutes, 0) > 0
            and d.worked_minutes < 120
          union all
          select 'WEEKLY_OFF_QUOTA_ISSUE' where
            coalesce(s.final_category, s.submitted_category) = 'WEEKLY_OFF'
            and private.workforce_weekly_off_active_count(
                  s.staff_id, s.attendance_date, s.attendance_date
                ) >= 4
          union all
          select 'UNAPPROVED' where s.lifecycle_state <> 'APPROVED'
          union all
          select 'MANUALLY_EDITED' where coalesce(d.has_manual_adjustment, false)
          union all
          select 'MISSING_ATTENDANCE' where s.lifecycle_state = 'NOT_STARTED'
            and s.attendance_date < private.staff_attendance_business_date()
        ) flags(f)
      ) as exception_flags
    from public.attendance_submissions s
    join public.profiles p on p.id = s.staff_id
    left join public.staff_employment_profiles ep on ep.staff_id = s.staff_id
    left join public.attendance_days d
      on d.staff_id = s.staff_id and d.attendance_date = s.attendance_date
    where s.attendance_date between v_from and v_to
    order by s.attendance_date desc, ep.employee_code
    limit v_limit
  ) t;

  return jsonb_build_object('from', v_from, 'to', v_to, 'rows', v_rows);
end;
$$;

comment on function public.get_attendance_approval_inbox(date, date, integer) is
  'Super Admin attendance approval inbox with computed exception flags.';

-- Monthly attendance summary. Counts only APPROVED days so payroll can never
-- consume an undecided day.
create or replace function public.get_attendance_monthly_summary(
  p_staff_id uuid,
  p_month date
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_month_start date := private.workforce_month_start(p_month);
  v_month_end date := (v_month_start + interval '1 month' - interval '1 day')::date;
begin
  if not private.staff_can_view_attendance((select auth.uid()), p_staff_id) then
    raise exception 'ATTENDANCE_PERMISSION_DENIED' using errcode = '42501';
  end if;

  return (
    select jsonb_build_object(
      'staffId', p_staff_id,
      'monthStart', v_month_start,
      'monthEnd', v_month_end,
      'absentCount', count(*) filter (where final_category = 'ABSENT'),
      'weeklyOffCount', count(*) filter (where final_category = 'WEEKLY_OFF'),
      'halfDay4hCount', count(*) filter (where final_category = 'HALF_DAY_4H'),
      'fullDay8hCount', count(*) filter (where final_category = 'FULL_DAY_8H'),
      'fullDay12hCount', count(*) filter (where final_category = 'FULL_DAY_12H'),
      'lateDayCount', count(*) filter (where is_late),
      'creditedMinutes', coalesce(sum(credited_minutes), 0),
      'approvedDayCount', count(*),
      'weeklyOffRemaining', greatest(
        0, 4 - private.workforce_weekly_off_active_count(p_staff_id, v_month_start)
      ),
      'unresolvedCount', (
        select count(*)
        from public.attendance_submissions u
        where u.staff_id = p_staff_id
          and u.attendance_date between v_month_start and v_month_end
          and u.lifecycle_state <> 'APPROVED'
      )
    )
    from public.attendance_submissions s
    where s.staff_id = p_staff_id
      and s.attendance_date between v_month_start and v_month_end
      and s.lifecycle_state = 'APPROVED'
  );
end;
$$;

comment on function public.get_attendance_monthly_summary(uuid, date) is
  'Approved-only monthly attendance summary. Undecided days are reported separately as unresolvedCount and never credited.';

-- -----------------------------------------------------------------------------
-- H. RLS
-- -----------------------------------------------------------------------------

alter table public.attendance_submissions enable row level security;
alter table public.attendance_submission_events enable row level security;

alter table public.attendance_submissions force row level security;
alter table public.attendance_submission_events force row level security;

revoke all on table
  public.attendance_submissions,
  public.attendance_submission_events
from public, anon;

-- All mutations flow through the SECURITY DEFINER RPCs above; no direct writes.
revoke insert, update, delete on table
  public.attendance_submissions,
  public.attendance_submission_events
from authenticated;

create policy attendance_submissions_select
  on public.attendance_submissions
  for select
  to authenticated
  using (private.staff_can_view_attendance((select auth.uid()), staff_id));

create policy attendance_submission_events_select
  on public.attendance_submission_events
  for select
  to authenticated
  using (private.staff_can_view_attendance((select auth.uid()), staff_id));

grant select on table
  public.attendance_submissions,
  public.attendance_submission_events
to authenticated;

-- -----------------------------------------------------------------------------
-- I. Function grants & ownership
-- -----------------------------------------------------------------------------

revoke all on function private.workforce_category_credited_minutes(text) from public, anon, authenticated;
revoke all on function private.workforce_month_start(date) from public, anon, authenticated;
revoke all on function private.workforce_weekly_off_active_count(uuid, date, date) from public, anon, authenticated;
revoke all on function private.workforce_compute_late(uuid, timestamptz) from public, anon, authenticated;
revoke all on function private.workforce_append_submission_event(uuid, date, uuid, text, text, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function private.workforce_ensure_submission(uuid, date) from public, anon, authenticated;
revoke all on function private.workforce_sync_submission_from_event() from public, anon, authenticated;
revoke all on function private.workforce_require_approver() from public, anon, authenticated;

revoke all on function public.submit_attendance_day(date, text) from public, anon;
revoke all on function public.request_attendance_correction(date, text) from public, anon;
revoke all on function public.approve_attendance_day(uuid, date, text, text) from public, anon;
revoke all on function public.reject_attendance_day(uuid, date, text) from public, anon;
revoke all on function public.return_attendance_for_correction(uuid, date, text) from public, anon;
revoke all on function public.get_attendance_approval_inbox(date, date, integer) from public, anon;
revoke all on function public.get_attendance_monthly_summary(uuid, date) from public, anon;

grant execute on function public.submit_attendance_day(date, text) to authenticated;
grant execute on function public.request_attendance_correction(date, text) to authenticated;
grant execute on function public.approve_attendance_day(uuid, date, text, text) to authenticated;
grant execute on function public.reject_attendance_day(uuid, date, text) to authenticated;
grant execute on function public.return_attendance_for_correction(uuid, date, text) to authenticated;
grant execute on function public.get_attendance_approval_inbox(date, date, integer) to authenticated;
grant execute on function public.get_attendance_monthly_summary(uuid, date) to authenticated;

alter function private.workforce_weekly_off_active_count(uuid, date, date) owner to postgres;
alter function private.workforce_compute_late(uuid, timestamptz) owner to postgres;
alter function private.workforce_append_submission_event(uuid, date, uuid, text, text, text, text, text, text, jsonb) owner to postgres;
alter function private.workforce_ensure_submission(uuid, date) owner to postgres;
alter function private.workforce_sync_submission_from_event() owner to postgres;
alter function private.workforce_require_approver() owner to postgres;
alter function public.submit_attendance_day(date, text) owner to postgres;
alter function public.request_attendance_correction(date, text) owner to postgres;
alter function public.approve_attendance_day(uuid, date, text, text) owner to postgres;
alter function public.reject_attendance_day(uuid, date, text) owner to postgres;
alter function public.return_attendance_for_correction(uuid, date, text) owner to postgres;
alter function public.get_attendance_approval_inbox(date, date, integer) owner to postgres;
alter function public.get_attendance_monthly_summary(uuid, date) owner to postgres;
