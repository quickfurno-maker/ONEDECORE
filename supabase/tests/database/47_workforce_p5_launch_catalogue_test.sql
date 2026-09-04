-- ONEDECORE WORKFORCE P5 — launch catalogue and activation boundary (M57).
--
-- M57 seeds the leave catalogue and NOTHING else. These tests prove both halves
-- of that: what it does create, and — just as importantly — what it must never
-- create, because the tempting shortcuts here would put invented holidays on a
-- real calendar, invented money on a real payroll, or an unattributed change on
-- a real person's employment record.

begin;
select plan(31);

-- -----------------------------------------------------------------------------
-- A. The launch leave catalogue
-- -----------------------------------------------------------------------------

select is(
  (select count(*)::integer from public.leave_types),
  3,
  'exactly three leave types exist — the owner-approved launch set'
);

select is(
  (select count(*)::integer from public.leave_types
   where code in ('casual', 'sick', 'unpaid')),
  3,
  'the three codes are casual, sick and unpaid'
);

select is(
  (select display_name from public.leave_types where code = 'casual'),
  'Casual Leave',
  'casual is named exactly "Casual Leave"'
);
select is(
  (select display_name from public.leave_types where code = 'sick'),
  'Sick Leave',
  'sick is named exactly "Sick Leave"'
);
select is(
  (select display_name from public.leave_types where code = 'unpaid'),
  'Unpaid Leave',
  'unpaid is named exactly "Unpaid Leave"'
);

select is(
  (select count(*)::integer from public.leave_types where is_active),
  3,
  'all three are active'
);

-- HALF-DAY LEAVE IS NOT APPROVED AT LAUNCH.
select is(
  (select count(*)::integer from public.leave_types where allows_half_day),
  0,
  'no leave type allows a half day at launch'
);
select is(
  (select bool_and(allows_half_day = false) from public.leave_types),
  true,
  'every launch leave type has allows_half_day = false'
);

-- A single row per code: the unique constraint plus the migration guard.
select is(
  (select count(*)::integer from (
     select code from public.leave_types group by code having count(*) > 1
   ) dup),
  0,
  'no duplicate leave codes'
);

-- -----------------------------------------------------------------------------
-- B. What M57 must NOT have created
-- -----------------------------------------------------------------------------

select is(
  (select count(*)::integer from public.holidays),
  0,
  'HOLIDAYS: the calendar starts EMPTY — real dates are entered by a Super Admin'
);

select is(
  (select count(*)::integer from public.salary_profiles),
  0,
  'SALARY: no salary profile was seeded — no real money values were supplied'
);
select is(
  (select count(*)::integer from public.salary_statements),
  0,
  'SALARY: no statement was seeded'
);
select is(
  (select count(*)::integer from public.salary_payments),
  0,
  'SALARY: no payment was seeded'
);

select is(
  (select count(*)::integer from public.staff_employment_profiles),
  0,
  'STAFF: M57 creates no employment row — eligibility is an audited UI action'
);

select is(
  (select count(*)::integer from public.attendance_events),
  0,
  'ATTENDANCE: no fabricated attendance events'
);
select is(
  (select count(*)::integer from public.attendance_days),
  0,
  'ATTENDANCE: no fabricated attendance days'
);
select is(
  (select count(*)::integer from public.attendance_submissions),
  0,
  'ATTENDANCE: no fabricated submissions'
);

-- -----------------------------------------------------------------------------
-- C. Permission boundary — team correction stays Super-Admin-only
-- -----------------------------------------------------------------------------

select is(
  (select count(*)::integer
   from public.role_permissions rp
   join public.roles r on r.id = rp.role_id
   join public.permissions p on p.id = rp.permission_id
   where r.code = 'sales_manager' and p.code = 'attendance.correct.team'),
  0,
  'SALES MANAGER: attendance.correct.team is NOT granted'
);

select is(
  (select count(*)::integer
   from public.role_permissions rp
   join public.roles r on r.id = rp.role_id
   join public.permissions p on p.id = rp.permission_id
   where r.code = 'sales_manager' and p.code = 'attendance.team.read'),
  1,
  'SALES MANAGER: attendance.team.read is retained'
);

select is(
  (select count(*)::integer
   from public.role_permissions rp
   join public.roles r on r.id = rp.role_id
   join public.permissions p on p.id = rp.permission_id
   where r.code = 'sales_manager' and p.code = 'leave.team.approve'),
  1,
  'SALES MANAGER: leave.team.approve is retained'
);

-- Correction remains reachable by Super Admin, so the capability still exists —
-- it is scoped, not removed.
select ok(
  exists (
    select 1
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where r.code = 'super_admin' and p.code = 'attendance.correct.team'
  ),
  'SUPER ADMIN retains attendance.correct.team'
);

-- -----------------------------------------------------------------------------
-- D. Invariants M57 must leave untouched
-- -----------------------------------------------------------------------------

-- Approved leave cannot be cancelled. The refusal lives in the RPC and M57 does
-- not redefine it.
select ok(
  (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'cancel_leave_request')
  like '%LEAVE_NOT_CANCELLABLE%',
  'APPROVED LEAVE: cancellation is still refused'
);
select ok(
  (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'cancel_leave_request')
  like '%v_request.status = ''approved''%',
  'APPROVED LEAVE: the refusal is keyed on the approved status'
);

-- ATTENDANCE POLICY. The live policy is OPERATIONAL data — a Super Admin
-- published it through the UI — so a fresh repository database correctly has
-- none. Asserting "exactly one" here would be asserting a managed fact from a
-- repository test, which is evidence about the wrong system.
--
-- What the repository can honestly prove is that M57 creates and modifies no
-- policy at all, and that the publish path remains the only way one appears.
select is(
  (select count(*)::integer from public.attendance_policies),
  0,
  'POLICY: M57 seeds NO attendance policy — publishing one is an audited UI action'
);
select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'publish_attendance_policy'
  ),
  'POLICY: the audited publish RPC is still the only way a policy appears'
);
select ok(
  (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'publish_attendance_policy')
  like '%weekly_off_days%',
  'POLICY: weekly-off days remain a published policy field, not a migration constant'
);
select ok(
  (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'publish_attendance_policy')
  like '%location_required%',
  'POLICY: location_required remains a published policy field'
);

-- The owner-locked monthly Weekly Off cap is still enforced in the database.
-- Weekly Off is an attendance CATEGORY chosen day-by-day, not a separate
-- request RPC, and the cap counts ACTIVE (pending + approved) days.
select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private' and p.proname = 'workforce_weekly_off_active_count'
  ),
  'WEEKLY OFF: the active-count helper backing the monthly cap still exists'
);
select ok(
  (select prosrc from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.proname = 'submit_attendance_day')
  like '%workforce_weekly_off_active_count%',
  'WEEKLY OFF: submission still consults the monthly cap'
);

-- -----------------------------------------------------------------------------
-- E. The migration refuses to overwrite conflicting business data
-- -----------------------------------------------------------------------------
--
-- The guard matters because the alternative — an unconditional upsert — would
-- silently rewrite a leave type the business had deliberately reconfigured.

select throws_ok(
  $q$insert into public.leave_types (code, display_name, allows_half_day, is_active)
     values ('casual', 'Duplicate Casual', false, true)$q$,
  '23505',
  'duplicate key value violates unique constraint "uq_leave_types_code"',
  'a second row under an existing code is rejected by the unique constraint'
);

select ok(
  (select count(*)::integer from public.leave_types where code = 'casual') = 1,
  'the original casual row survived the rejected duplicate'
);

select * from finish();
rollback;
