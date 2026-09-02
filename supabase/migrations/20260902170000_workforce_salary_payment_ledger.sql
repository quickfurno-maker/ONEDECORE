-- ONEDECORE Workforce V1 — salary profiles, monthly statements & payment ledger
--
-- Forward-only. Adds the payroll layer that CONSUMES approved attendance and
-- never mutates it. Nothing here writes to attendance_events, attendance_days
-- or attendance_submissions.
--
-- Owner-locked rules encoded here:
--   * Salary is Super Admin controlled, effective-dated and versioned. A
--     revision creates a NEW version; history is never overwritten.
--   * V1 basis is a monthly base salary only. No tax/TDS/PF/ESI/CTC engine, no
--     statutory computation, no automatic deduction policy.
--   * WEEKLY_OFF is a PAID day and causes no automatic deduction.
--   * Lateness causes no automatic deduction.
--   * ABSENT does not silently deduct money. Every rupee of movement away from
--     base salary is an EXPLICIT Super Admin line item.
--   * Salary payable and payment are separate. Multiple payments may be
--     recorded against one statement, and unpaid / partially paid / paid is
--     DERIVED from the ledger, never stored as a boolean.
--   * Staff may read their own salary and payments and may never mutate them.
--
-- All money is stored in integer paise, matching the commerce convention.

-- -----------------------------------------------------------------------------
-- A. Permissions
-- -----------------------------------------------------------------------------

insert into public.permissions (code, name, description, is_system, is_active) values
  ('salary.manage', 'Manage Salary', 'Set salary, build and finalize statements, record payments', true, true),
  ('salary.self', 'Own Salary', 'View own salary statements and payment history', true, true)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  is_system = true,
  is_active = true;

-- Super Admin decides salary.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'super_admin'
  and p.code in ('salary.manage', 'salary.self')
on conflict do nothing;

-- Every operational staff role can read its own salary.
insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code in ('sales_manager', 'sales_executive', 'project_manager', 'designer')
  and p.code = 'salary.self'
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- B. Tables
-- -----------------------------------------------------------------------------

create table public.salary_profiles (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles (id) on delete cascade,
  monthly_base_salary_paise bigint not null,
  effective_from date not null,
  effective_to date,
  set_by uuid not null references public.profiles (id),
  note text,
  created_at timestamptz not null default now(),

  constraint chk_salary_profiles_amount check (
    monthly_base_salary_paise >= 0 and monthly_base_salary_paise <= 1000000000000
  ),
  constraint chk_salary_profiles_period check (
    effective_to is null or effective_to >= effective_from
  ),
  constraint chk_salary_profiles_note check (
    note is null or length(trim(note)) <= 500
  )
);

comment on table public.salary_profiles is
  'Effective-dated versioned monthly salary. A revision inserts a new row and closes the previous one; rows are never rewritten.';

-- At most one open-ended (current) version per employee.
create unique index uq_salary_profiles_open_version
  on public.salary_profiles (staff_id)
  where effective_to is null;

create index idx_salary_profiles_staff_period
  on public.salary_profiles (staff_id, effective_from desc);

create table public.salary_statements (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles (id) on delete cascade,
  salary_month date not null,
  salary_profile_id uuid not null references public.salary_profiles (id),
  base_salary_paise bigint not null,

  -- Approved-attendance snapshot. Taken at build time from APPROVED days only,
  -- so a statement never silently changes when attendance is later corrected.
  absent_count integer not null default 0,
  weekly_off_count integer not null default 0,
  half_day_4h_count integer not null default 0,
  full_day_8h_count integer not null default 0,
  full_day_12h_count integer not null default 0,
  late_day_count integer not null default 0,
  credited_minutes integer not null default 0,
  approved_day_count integer not null default 0,

  status text not null default 'draft',
  finalized_by uuid references public.profiles (id),
  finalized_at timestamptz,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_salary_statements_staff_month unique (staff_id, salary_month),
  constraint chk_salary_statements_status check (
    status = any (array['draft', 'finalized', 'reopened'])
  ),
  constraint chk_salary_statements_month_start check (
    salary_month = date_trunc('month', salary_month::timestamp)::date
  ),
  constraint chk_salary_statements_base check (base_salary_paise >= 0),
  constraint chk_salary_statements_finalized check (
    status <> 'finalized'
    or (finalized_by is not null and finalized_at is not null)
  )
);

comment on table public.salary_statements is
  'One monthly salary statement per employee per month, bound to the salary profile version in force. Attendance counts are an approved-only snapshot.';

create index idx_salary_statements_month on public.salary_statements (salary_month desc, staff_id);

create table public.salary_statement_lines (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.salary_statements (id) on delete cascade,
  line_type text not null,
  direction text not null,
  amount_paise bigint not null,
  note text,
  created_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),

  constraint chk_salary_lines_type check (
    line_type = any (array[
      'bonus', 'incentive', 'overtime', 'advance_recovery',
      'absence_deduction', 'other_addition', 'other_deduction'
    ])
  ),
  constraint chk_salary_lines_direction check (
    direction = any (array['addition', 'deduction'])
  ),
  -- Direction is implied by the type; storing both keeps totals readable while
  -- the constraint stops the two from disagreeing.
  constraint chk_salary_lines_direction_matches_type check (
    (line_type in ('bonus', 'incentive', 'overtime', 'other_addition') and direction = 'addition')
    or (line_type in ('advance_recovery', 'absence_deduction', 'other_deduction') and direction = 'deduction')
  ),
  constraint chk_salary_lines_amount check (
    amount_paise > 0 and amount_paise <= 1000000000000
  ),
  constraint chk_salary_lines_note check (note is null or length(trim(note)) <= 500)
);

comment on table public.salary_statement_lines is
  'Admin-controlled additions and deductions. V1 has no automatic deduction formula: absence, lateness and Weekly Off never move money on their own.';

create index idx_salary_statement_lines_statement
  on public.salary_statement_lines (statement_id);

create table public.salary_payments (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.salary_statements (id) on delete restrict,
  staff_id uuid not null references public.profiles (id) on delete cascade,
  amount_paise bigint not null,
  payment_date date not null,
  method text not null,
  reference text,
  note text,
  recorded_by uuid not null references public.profiles (id),
  created_at timestamptz not null default now(),

  constraint chk_salary_payments_amount check (
    amount_paise > 0 and amount_paise <= 1000000000000
  ),
  constraint chk_salary_payments_method check (
    method = any (array['bank', 'upi', 'cash', 'other'])
  ),
  constraint chk_salary_payments_reference check (
    reference is null or length(trim(reference)) <= 120
  ),
  constraint chk_salary_payments_note check (note is null or length(trim(note)) <= 500)
);

comment on table public.salary_payments is
  'Payment ledger. Multiple payments may settle one statement; unpaid/partially paid/paid is derived from the sum, never stored as a boolean.';

create index idx_salary_payments_statement on public.salary_payments (statement_id);
create index idx_salary_payments_staff on public.salary_payments (staff_id, payment_date desc);

create table public.salary_statement_events (
  id uuid primary key default gen_random_uuid(),
  statement_id uuid not null references public.salary_statements (id) on delete cascade,
  actor_id uuid references public.profiles (id),
  event_type text not null,
  previous_status text,
  new_status text,
  reason text,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint chk_salary_statement_events_type check (
    event_type = any (array[
      'created', 'line_added', 'line_removed', 'finalized', 'reopened', 'payment_recorded'
    ])
  ),
  constraint chk_salary_statement_events_reason check (
    reason is null or length(trim(reason)) <= 500
  ),
  constraint chk_salary_statement_events_details check (pg_column_size(details) <= 2048)
);

comment on table public.salary_statement_events is
  'Append-only audit of statement lifecycle: creation, line changes, finalize, reopen and payments.';

create index idx_salary_statement_events_statement
  on public.salary_statement_events (statement_id, created_at desc);

-- -----------------------------------------------------------------------------
-- C. Private helpers
-- -----------------------------------------------------------------------------

create or replace function private.salary_require_manager()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.staff_require_active_actor();
begin
  if not (select public.authorize('salary.manage')) then
    raise exception 'SALARY_PERMISSION_DENIED' using errcode = '42501';
  end if;
  return v_actor;
end;
$$;

/** Own salary, or any salary for a Super Admin. */
create or replace function private.salary_can_view(p_staff_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select public.authorize('salary.manage'))
    or (
      (select public.authorize('salary.self'))
      and p_staff_id = (select auth.uid())
    );
$$;

create or replace function private.salary_append_event(
  p_statement_id uuid,
  p_actor_id uuid,
  p_event_type text,
  p_previous_status text,
  p_new_status text,
  p_reason text,
  p_details jsonb default '{}'::jsonb
)
returns void
language sql
security definer
set search_path = ''
as $$
  insert into public.salary_statement_events (
    statement_id, actor_id, event_type, previous_status, new_status, reason, details
  )
  values (
    p_statement_id, p_actor_id, p_event_type, p_previous_status, p_new_status,
    nullif(trim(coalesce(p_reason, '')), ''), coalesce(p_details, '{}'::jsonb)
  );
$$;

/** Salary profile version in force on a given date. */
create or replace function private.salary_profile_for_date(p_staff_id uuid, p_date date)
returns public.salary_profiles
language sql
stable
security definer
set search_path = ''
as $$
  select *
  from public.salary_profiles
  where staff_id = p_staff_id
    and effective_from <= p_date
    and (effective_to is null or effective_to >= p_date)
  order by effective_from desc
  limit 1;
$$;

/**
 * Derived money for one statement.
 *
 * net_payable = base + additions - deductions. Nothing is inferred from
 * attendance: absence, lateness and Weekly Off contribute zero unless a Super
 * Admin added an explicit line.
 */
create or replace function private.salary_statement_totals(p_statement_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_base bigint;
  v_additions bigint;
  v_deductions bigint;
  v_net bigint;
  v_paid bigint;
begin
  select base_salary_paise into v_base
  from public.salary_statements where id = p_statement_id;

  if v_base is null then
    return null;
  end if;

  select
    coalesce(sum(amount_paise) filter (where direction = 'addition'), 0),
    coalesce(sum(amount_paise) filter (where direction = 'deduction'), 0)
  into v_additions, v_deductions
  from public.salary_statement_lines
  where statement_id = p_statement_id;

  v_net := v_base + v_additions - v_deductions;

  select coalesce(sum(amount_paise), 0) into v_paid
  from public.salary_payments
  where statement_id = p_statement_id;

  return jsonb_build_object(
    'basePaise', v_base,
    'additionsPaise', v_additions,
    'deductionsPaise', v_deductions,
    'netPayablePaise', v_net,
    'totalPaidPaise', v_paid,
    'balancePaise', v_net - v_paid,
    'paymentStatus', case
      when v_paid <= 0 then 'unpaid'
      when v_net > 0 and v_paid < v_net then 'partially_paid'
      when v_net <= 0 then 'paid'
      else 'paid'
    end
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- D. Salary profile RPCs
-- -----------------------------------------------------------------------------

/**
 * Sets a new effective-dated salary version.
 *
 * The previous open version is CLOSED (its `effective_to` is set to the day
 * before the new period starts). No historical amount is ever rewritten.
 */
create or replace function public.set_salary_profile(
  p_staff_id uuid,
  p_monthly_base_salary_paise bigint,
  p_effective_from date,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.salary_require_manager();
  v_open public.salary_profiles%rowtype;
  v_new_id uuid;
begin
  if p_monthly_base_salary_paise is null or p_monthly_base_salary_paise < 0 then
    raise exception 'SALARY_AMOUNT_INVALID' using errcode = 'P0001';
  end if;

  if p_effective_from is null then
    raise exception 'SALARY_EFFECTIVE_FROM_REQUIRED' using errcode = 'P0001';
  end if;

  if not exists (select 1 from public.profiles where id = p_staff_id) then
    raise exception 'SALARY_STAFF_NOT_FOUND' using errcode = 'P0001';
  end if;

  select * into v_open
  from public.salary_profiles
  where staff_id = p_staff_id and effective_to is null
  for update;

  if found then
    if p_effective_from <= v_open.effective_from then
      raise exception 'SALARY_EFFECTIVE_FROM_NOT_AFTER_CURRENT' using errcode = 'P0001';
    end if;

    update public.salary_profiles
    set effective_to = p_effective_from - 1
    where id = v_open.id;
  end if;

  insert into public.salary_profiles (
    staff_id, monthly_base_salary_paise, effective_from, set_by, note
  )
  values (
    p_staff_id, p_monthly_base_salary_paise, p_effective_from, v_actor,
    nullif(trim(coalesce(p_note, '')), '')
  )
  returning id into v_new_id;

  return jsonb_build_object(
    'salaryProfileId', v_new_id,
    'staffId', p_staff_id,
    'monthlyBaseSalaryPaise', p_monthly_base_salary_paise,
    'effectiveFrom', p_effective_from,
    'closedPreviousVersion', v_open.id
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- E. Statement RPCs
-- -----------------------------------------------------------------------------

/**
 * Builds the monthly statement from APPROVED attendance only.
 *
 * This function READS attendance and never writes to it: payroll consumes
 * attendance, it does not own it.
 */
create or replace function public.create_salary_statement(
  p_staff_id uuid,
  p_salary_month date
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.salary_require_manager();
  v_month date := date_trunc('month', p_salary_month::timestamp)::date;
  v_month_end date := (v_month + interval '1 month' - interval '1 day')::date;
  v_profile public.salary_profiles%rowtype;
  v_id uuid;
  v_counts record;
begin
  select * into v_profile from private.salary_profile_for_date(p_staff_id, v_month);

  if v_profile.id is null then
    raise exception 'SALARY_PROFILE_MISSING' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.salary_statements
    where staff_id = p_staff_id and salary_month = v_month
  ) then
    raise exception 'SALARY_STATEMENT_EXISTS' using errcode = 'P0001';
  end if;

  select
    count(*) filter (where final_category = 'ABSENT') as absent_count,
    count(*) filter (where final_category = 'WEEKLY_OFF') as weekly_off_count,
    count(*) filter (where final_category = 'HALF_DAY_4H') as half_day_4h_count,
    count(*) filter (where final_category = 'FULL_DAY_8H') as full_day_8h_count,
    count(*) filter (where final_category = 'FULL_DAY_12H') as full_day_12h_count,
    count(*) filter (where is_late) as late_day_count,
    coalesce(sum(credited_minutes), 0) as credited_minutes,
    count(*) as approved_day_count
  into v_counts
  from public.attendance_submissions
  where staff_id = p_staff_id
    and attendance_date between v_month and v_month_end
    and lifecycle_state = 'APPROVED';

  insert into public.salary_statements (
    staff_id, salary_month, salary_profile_id, base_salary_paise,
    absent_count, weekly_off_count, half_day_4h_count, full_day_8h_count,
    full_day_12h_count, late_day_count, credited_minutes, approved_day_count,
    status, created_by
  )
  values (
    p_staff_id, v_month, v_profile.id, v_profile.monthly_base_salary_paise,
    v_counts.absent_count, v_counts.weekly_off_count, v_counts.half_day_4h_count,
    v_counts.full_day_8h_count, v_counts.full_day_12h_count, v_counts.late_day_count,
    v_counts.credited_minutes, v_counts.approved_day_count,
    'draft', v_actor
  )
  returning id into v_id;

  perform private.salary_append_event(
    v_id, v_actor, 'created', null, 'draft', null,
    jsonb_build_object('salaryMonth', v_month, 'salaryProfileId', v_profile.id)
  );

  return jsonb_build_object(
    'salaryStatementId', v_id,
    'staffId', p_staff_id,
    'salaryMonth', v_month,
    'status', 'draft',
    'basePaise', v_profile.monthly_base_salary_paise
  );
end;
$$;

create or replace function public.add_salary_statement_line(
  p_statement_id uuid,
  p_line_type text,
  p_amount_paise bigint,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.salary_require_manager();
  v_statement public.salary_statements%rowtype;
  v_direction text;
  v_line_id uuid;
begin
  select * into v_statement from public.salary_statements where id = p_statement_id for update;

  if not found then
    raise exception 'SALARY_STATEMENT_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- A finalized statement is immutable until it is explicitly reopened.
  if v_statement.status = 'finalized' then
    raise exception 'SALARY_STATEMENT_FINALIZED' using errcode = 'P0001';
  end if;

  v_direction := case
    when p_line_type in ('bonus', 'incentive', 'overtime', 'other_addition') then 'addition'
    when p_line_type in ('advance_recovery', 'absence_deduction', 'other_deduction') then 'deduction'
    else null
  end;

  if v_direction is null then
    raise exception 'SALARY_LINE_TYPE_INVALID' using errcode = 'P0001';
  end if;

  if p_amount_paise is null or p_amount_paise <= 0 then
    raise exception 'SALARY_AMOUNT_INVALID' using errcode = 'P0001';
  end if;

  insert into public.salary_statement_lines (
    statement_id, line_type, direction, amount_paise, note, created_by
  )
  values (
    p_statement_id, p_line_type, v_direction, p_amount_paise,
    nullif(trim(coalesce(p_note, '')), ''), v_actor
  )
  returning id into v_line_id;

  perform private.salary_append_event(
    p_statement_id, v_actor, 'line_added', v_statement.status, v_statement.status, p_note,
    jsonb_build_object('lineType', p_line_type, 'direction', v_direction, 'amountPaise', p_amount_paise)
  );

  return jsonb_build_object('salaryStatementLineId', v_line_id, 'direction', v_direction);
end;
$$;

create or replace function public.remove_salary_statement_line(p_line_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.salary_require_manager();
  v_line public.salary_statement_lines%rowtype;
  v_status text;
begin
  select * into v_line from public.salary_statement_lines where id = p_line_id;

  if not found then
    raise exception 'SALARY_LINE_NOT_FOUND' using errcode = 'P0001';
  end if;

  select status into v_status from public.salary_statements where id = v_line.statement_id;

  if v_status = 'finalized' then
    raise exception 'SALARY_STATEMENT_FINALIZED' using errcode = 'P0001';
  end if;

  delete from public.salary_statement_lines where id = p_line_id;

  perform private.salary_append_event(
    v_line.statement_id, v_actor, 'line_removed', v_status, v_status, null,
    jsonb_build_object('lineType', v_line.line_type, 'amountPaise', v_line.amount_paise)
  );

  return jsonb_build_object('removed', true);
end;
$$;

create or replace function public.finalize_salary_statement(
  p_statement_id uuid,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.salary_require_manager();
  v_statement public.salary_statements%rowtype;
  v_totals jsonb;
begin
  select * into v_statement from public.salary_statements where id = p_statement_id for update;

  if not found then
    raise exception 'SALARY_STATEMENT_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_statement.status = 'finalized' then
    raise exception 'SALARY_STATEMENT_FINALIZED' using errcode = 'P0001';
  end if;

  v_totals := private.salary_statement_totals(p_statement_id);

  if (v_totals ->> 'netPayablePaise')::bigint < 0 then
    raise exception 'SALARY_NET_NEGATIVE' using errcode = 'P0001';
  end if;

  update public.salary_statements
  set status = 'finalized',
      finalized_by = v_actor,
      finalized_at = now(),
      updated_at = now()
  where id = p_statement_id;

  perform private.salary_append_event(
    p_statement_id, v_actor, 'finalized', v_statement.status, 'finalized', p_note, v_totals
  );

  return jsonb_build_object('salaryStatementId', p_statement_id, 'status', 'finalized')
         || v_totals;
end;
$$;

/**
 * Controlled amendment. A finalized statement is reopened with an audited
 * reason rather than being silently edited.
 */
create or replace function public.reopen_salary_statement(
  p_statement_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.salary_require_manager();
  v_statement public.salary_statements%rowtype;
begin
  if p_reason is null or length(trim(p_reason)) < 1 then
    raise exception 'SALARY_REASON_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_statement from public.salary_statements where id = p_statement_id for update;

  if not found then
    raise exception 'SALARY_STATEMENT_NOT_FOUND' using errcode = 'P0001';
  end if;

  if v_statement.status <> 'finalized' then
    raise exception 'SALARY_STATEMENT_NOT_FINALIZED' using errcode = 'P0001';
  end if;

  update public.salary_statements
  set status = 'reopened',
      updated_at = now()
  where id = p_statement_id;

  perform private.salary_append_event(
    p_statement_id, v_actor, 'reopened', 'finalized', 'reopened', p_reason, '{}'::jsonb
  );

  return jsonb_build_object('salaryStatementId', p_statement_id, 'status', 'reopened');
end;
$$;

-- -----------------------------------------------------------------------------
-- F. Payment RPCs
-- -----------------------------------------------------------------------------

create or replace function public.record_salary_payment(
  p_statement_id uuid,
  p_amount_paise bigint,
  p_payment_date date,
  p_method text,
  p_reference text default null,
  p_note text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := private.salary_require_manager();
  v_statement public.salary_statements%rowtype;
  v_payment_id uuid;
  v_totals jsonb;
begin
  select * into v_statement from public.salary_statements where id = p_statement_id for update;

  if not found then
    raise exception 'SALARY_STATEMENT_NOT_FOUND' using errcode = 'P0001';
  end if;

  -- Money only moves against a statement the owner has actually approved.
  if v_statement.status <> 'finalized' then
    raise exception 'SALARY_STATEMENT_NOT_FINALIZED' using errcode = 'P0001';
  end if;

  if p_amount_paise is null or p_amount_paise <= 0 then
    raise exception 'SALARY_AMOUNT_INVALID' using errcode = 'P0001';
  end if;

  if p_method is null or p_method not in ('bank', 'upi', 'cash', 'other') then
    raise exception 'SALARY_PAYMENT_METHOD_INVALID' using errcode = 'P0001';
  end if;

  v_totals := private.salary_statement_totals(p_statement_id);

  if p_amount_paise > (v_totals ->> 'balancePaise')::bigint then
    raise exception 'SALARY_PAYMENT_EXCEEDS_BALANCE' using errcode = 'P0001';
  end if;

  insert into public.salary_payments (
    statement_id, staff_id, amount_paise, payment_date, method, reference, note, recorded_by
  )
  values (
    p_statement_id, v_statement.staff_id, p_amount_paise,
    coalesce(p_payment_date, current_date), p_method,
    nullif(trim(coalesce(p_reference, '')), ''),
    nullif(trim(coalesce(p_note, '')), ''),
    v_actor
  )
  returning id into v_payment_id;

  perform private.salary_append_event(
    p_statement_id, v_actor, 'payment_recorded', v_statement.status, v_statement.status, p_note,
    jsonb_build_object('amountPaise', p_amount_paise, 'method', p_method)
  );

  return jsonb_build_object('salaryPaymentId', v_payment_id)
         || private.salary_statement_totals(p_statement_id);
end;
$$;

-- -----------------------------------------------------------------------------
-- G. Read models
-- -----------------------------------------------------------------------------

create or replace function public.get_salary_statement(p_statement_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_statement public.salary_statements%rowtype;
begin
  select * into v_statement from public.salary_statements where id = p_statement_id;

  if not found then
    return null;
  end if;

  if not private.salary_can_view(v_statement.staff_id) then
    raise exception 'SALARY_PERMISSION_DENIED' using errcode = '42501';
  end if;

  return jsonb_build_object(
    'salaryStatementId', v_statement.id,
    'staffId', v_statement.staff_id,
    'salaryMonth', v_statement.salary_month,
    'salaryProfileId', v_statement.salary_profile_id,
    'status', v_statement.status,
    'finalizedAt', v_statement.finalized_at,
    'attendance', jsonb_build_object(
      'absentCount', v_statement.absent_count,
      'weeklyOffCount', v_statement.weekly_off_count,
      'halfDay4hCount', v_statement.half_day_4h_count,
      'fullDay8hCount', v_statement.full_day_8h_count,
      'fullDay12hCount', v_statement.full_day_12h_count,
      'lateDayCount', v_statement.late_day_count,
      'creditedMinutes', v_statement.credited_minutes,
      'approvedDayCount', v_statement.approved_day_count
    ),
    'lines', coalesce((
      select jsonb_agg(jsonb_build_object(
        'salaryStatementLineId', l.id,
        'lineType', l.line_type,
        'direction', l.direction,
        'amountPaise', l.amount_paise,
        'note', l.note
      ) order by l.created_at)
      from public.salary_statement_lines l
      where l.statement_id = v_statement.id
    ), '[]'::jsonb),
    'payments', coalesce((
      select jsonb_agg(jsonb_build_object(
        'salaryPaymentId', pay.id,
        'amountPaise', pay.amount_paise,
        'paymentDate', pay.payment_date,
        'method', pay.method,
        'reference', pay.reference,
        'note', pay.note
      ) order by pay.payment_date, pay.created_at)
      from public.salary_payments pay
      where pay.statement_id = v_statement.id
    ), '[]'::jsonb)
  ) || private.salary_statement_totals(v_statement.id);
end;
$$;

create or replace function public.list_salary_statements(
  p_staff_id uuid default null,
  p_limit integer default 50
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_is_manager boolean := (select public.authorize('salary.manage'));
  v_scope uuid := coalesce(p_staff_id, (select auth.uid()));
  v_limit integer := least(greatest(coalesce(p_limit, 50), 1), 200);
begin
  -- A non-manager may only ever scope to themselves.
  if not v_is_manager then
    if not (select public.authorize('salary.self')) then
      raise exception 'SALARY_PERMISSION_DENIED' using errcode = '42501';
    end if;
    v_scope := (select auth.uid());
  end if;

  return coalesce((
    select jsonb_agg(row_to_json(t)::jsonb order by t.salary_month desc)
    from (
      select
        s.id as salary_statement_id,
        s.staff_id,
        p.display_name as employee_name,
        s.salary_month,
        s.status,
        s.base_salary_paise,
        s.approved_day_count,
        (private.salary_statement_totals(s.id) ->> 'netPayablePaise')::bigint as net_payable_paise,
        (private.salary_statement_totals(s.id) ->> 'totalPaidPaise')::bigint as total_paid_paise,
        (private.salary_statement_totals(s.id) ->> 'balancePaise')::bigint as balance_paise,
        private.salary_statement_totals(s.id) ->> 'paymentStatus' as payment_status
      from public.salary_statements s
      join public.profiles p on p.id = s.staff_id
      where (v_is_manager and (p_staff_id is null or s.staff_id = p_staff_id))
         or s.staff_id = v_scope
      order by s.salary_month desc
      limit v_limit
    ) t
  ), '[]'::jsonb);
end;
$$;

-- -----------------------------------------------------------------------------
-- H. RLS
-- -----------------------------------------------------------------------------

alter table public.salary_profiles enable row level security;
alter table public.salary_statements enable row level security;
alter table public.salary_statement_lines enable row level security;
alter table public.salary_payments enable row level security;
alter table public.salary_statement_events enable row level security;

alter table public.salary_profiles force row level security;
alter table public.salary_statements force row level security;
alter table public.salary_statement_lines force row level security;
alter table public.salary_payments force row level security;
alter table public.salary_statement_events force row level security;

revoke all on table
  public.salary_profiles,
  public.salary_statements,
  public.salary_statement_lines,
  public.salary_payments,
  public.salary_statement_events
from public, anon;

-- Staff read their own salary; every mutation goes through the RPCs above.
revoke insert, update, delete on table
  public.salary_profiles,
  public.salary_statements,
  public.salary_statement_lines,
  public.salary_payments,
  public.salary_statement_events
from authenticated;

create policy salary_profiles_select
  on public.salary_profiles for select to authenticated
  using (private.salary_can_view(staff_id));

create policy salary_statements_select
  on public.salary_statements for select to authenticated
  using (private.salary_can_view(staff_id));

create policy salary_statement_lines_select
  on public.salary_statement_lines for select to authenticated
  using (
    exists (
      select 1 from public.salary_statements s
      where s.id = statement_id and private.salary_can_view(s.staff_id)
    )
  );

create policy salary_payments_select
  on public.salary_payments for select to authenticated
  using (private.salary_can_view(staff_id));

-- The lifecycle audit is a management record, not employee-facing.
create policy salary_statement_events_select
  on public.salary_statement_events for select to authenticated
  using ((select public.authorize('salary.manage')));

grant select on table
  public.salary_profiles,
  public.salary_statements,
  public.salary_statement_lines,
  public.salary_payments,
  public.salary_statement_events
to authenticated;

-- -----------------------------------------------------------------------------
-- I. Function grants & ownership
-- -----------------------------------------------------------------------------

revoke all on function private.salary_require_manager() from public, anon, authenticated;
revoke all on function private.salary_can_view(uuid) from public, anon, authenticated;
revoke all on function private.salary_append_event(uuid, uuid, text, text, text, text, jsonb) from public, anon, authenticated;
revoke all on function private.salary_profile_for_date(uuid, date) from public, anon, authenticated;
revoke all on function private.salary_statement_totals(uuid) from public, anon, authenticated;

revoke all on function public.set_salary_profile(uuid, bigint, date, text) from public, anon;
revoke all on function public.create_salary_statement(uuid, date) from public, anon;
revoke all on function public.add_salary_statement_line(uuid, text, bigint, text) from public, anon;
revoke all on function public.remove_salary_statement_line(uuid) from public, anon;
revoke all on function public.finalize_salary_statement(uuid, text) from public, anon;
revoke all on function public.reopen_salary_statement(uuid, text) from public, anon;
revoke all on function public.record_salary_payment(uuid, bigint, date, text, text, text) from public, anon;
revoke all on function public.get_salary_statement(uuid) from public, anon;
revoke all on function public.list_salary_statements(uuid, integer) from public, anon;

grant execute on function private.salary_can_view(uuid) to authenticated;

grant execute on function public.set_salary_profile(uuid, bigint, date, text) to authenticated;
grant execute on function public.create_salary_statement(uuid, date) to authenticated;
grant execute on function public.add_salary_statement_line(uuid, text, bigint, text) to authenticated;
grant execute on function public.remove_salary_statement_line(uuid) to authenticated;
grant execute on function public.finalize_salary_statement(uuid, text) to authenticated;
grant execute on function public.reopen_salary_statement(uuid, text) to authenticated;
grant execute on function public.record_salary_payment(uuid, bigint, date, text, text, text) to authenticated;
grant execute on function public.get_salary_statement(uuid) to authenticated;
grant execute on function public.list_salary_statements(uuid, integer) to authenticated;

alter function private.salary_require_manager() owner to postgres;
alter function private.salary_can_view(uuid) owner to postgres;
alter function private.salary_append_event(uuid, uuid, text, text, text, text, jsonb) owner to postgres;
alter function private.salary_profile_for_date(uuid, date) owner to postgres;
alter function private.salary_statement_totals(uuid) owner to postgres;
alter function public.set_salary_profile(uuid, bigint, date, text) owner to postgres;
alter function public.create_salary_statement(uuid, date) owner to postgres;
alter function public.add_salary_statement_line(uuid, text, bigint, text) owner to postgres;
alter function public.remove_salary_statement_line(uuid) owner to postgres;
alter function public.finalize_salary_statement(uuid, text) owner to postgres;
alter function public.reopen_salary_statement(uuid, text) owner to postgres;
alter function public.record_salary_payment(uuid, bigint, date, text, text, text) owner to postgres;
alter function public.get_salary_statement(uuid) owner to postgres;
alter function public.list_salary_statements(uuid, integer) owner to postgres;
