-- ONEDECORE Workforce V1 — attendance submission & approval lifecycle pgTAP tests

begin;
select plan(59);

-- -----------------------------------------------------------------------------
-- A. Schema presence and hardening
-- -----------------------------------------------------------------------------

select ok(to_regclass('public.attendance_submissions') is not null, 'attendance_submissions exists');
select ok(to_regclass('public.attendance_submission_events') is not null, 'attendance_submission_events exists');

select ok(
  (select relrowsecurity from pg_class where relname = 'attendance_submissions'),
  'attendance_submissions RLS enabled'
);
select ok(
  (select relforcerowsecurity from pg_class where relname = 'attendance_submissions'),
  'attendance_submissions FORCE RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'attendance_submission_events'),
  'attendance_submission_events RLS enabled'
);
select ok(
  (select relforcerowsecurity from pg_class where relname = 'attendance_submission_events'),
  'attendance_submission_events FORCE RLS enabled'
);

-- Every new function must pin an empty search_path.
select is(
  (
    select count(*)::integer
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where p.proname in (
        'workforce_category_credited_minutes', 'workforce_month_start',
        'workforce_weekly_off_active_count', 'workforce_compute_late',
        'workforce_append_submission_event', 'workforce_ensure_submission',
        'workforce_sync_submission_from_event', 'workforce_require_approver',
        'submit_attendance_day', 'request_attendance_correction',
        'approve_attendance_day', 'reject_attendance_day',
        'return_attendance_for_correction', 'get_attendance_approval_inbox',
        'get_attendance_monthly_summary'
      )
      and n.nspname in ('public', 'private')
      and not (coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=%')
  ),
  0,
  'all workforce functions pin search_path'
);

select ok(
  exists (select 1 from public.permissions where code = 'attendance.approve' and is_active),
  'attendance.approve permission exists'
);

-- Approval authority is Super Admin only; managers stay read-only in V1.
select is(
  (
    select string_agg(r.code, ',' order by r.code)
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where p.code = 'attendance.approve'
  ),
  'super_admin',
  'attendance.approve granted to super_admin only'
);

-- -----------------------------------------------------------------------------
-- B. Deterministic category credit mapping
-- -----------------------------------------------------------------------------

select is(private.workforce_category_credited_minutes('ABSENT'), 0, 'ABSENT credits 0');
select is(private.workforce_category_credited_minutes('WEEKLY_OFF'), 0, 'WEEKLY_OFF credits 0');
select is(private.workforce_category_credited_minutes('HALF_DAY_4H'), 240, 'HALF_DAY_4H credits 4h');
select is(private.workforce_category_credited_minutes('FULL_DAY_8H'), 480, 'FULL_DAY_8H credits 8h');
select is(private.workforce_category_credited_minutes('FULL_DAY_12H'), 720, 'FULL_DAY_12H credits 12h');
select is(private.workforce_category_credited_minutes('NOT_A_CATEGORY'), null, 'unknown category credits null');

-- -----------------------------------------------------------------------------
-- C. Fixtures
-- -----------------------------------------------------------------------------

insert into auth.users (id, instance_id, email, aud, role) values
  ('40aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', '40-sa@example.test', 'authenticated', 'authenticated'),
  ('40bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', '40-exec@example.test', 'authenticated', 'authenticated'),
  ('40cccccc-cccc-4ccc-8ccc-cccccccccccc', '00000000-0000-0000-0000-000000000000', '40-exec2@example.test', 'authenticated', 'authenticated'),
  ('40dddddd-dddd-4ddd-8ddd-dddddddddddd', '00000000-0000-0000-0000-000000000000', '40-mgr@example.test', 'authenticated', 'authenticated');

update public.profiles set status = 'active'
where id in (
  '40aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '40bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '40cccccc-cccc-4ccc-8ccc-cccccccccccc',
  '40dddddd-dddd-4ddd-8ddd-dddddddddddd'
);

insert into public.user_roles (user_id, role_id)
select '40aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', id from public.roles where code = 'super_admin';
insert into public.user_roles (user_id, role_id)
select '40bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select '40cccccc-cccc-4ccc-8ccc-cccccccccccc', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select '40dddddd-dddd-4ddd-8ddd-dddddddddddd', id from public.roles where code = 'sales_manager';

-- Workforce V1 reference policy. The 09:00 start and 15-minute grace are a
-- DEPLOYMENT configuration, so the tests below pin the lifecycle logic against
-- a policy carrying the owner-locked values rather than assuming a seed.
-- weekly_off_days is deliberately EMPTY: V1 has no fixed weekly-off weekday.
insert into public.attendance_policies (
  code, name, timezone, workday_start_local, workday_end_local,
  late_grace_minutes, half_day_threshold_minutes, missing_checkout_cutoff_local,
  weekly_off_days, location_required, is_current
) values (
  'wf_v1_test', 'Workforce V1 test policy', 'Asia/Kolkata',
  time '09:00', time '18:00', 15, 240, time '23:59',
  array[]::smallint[], false, true
);

-- Attendance-eligible employment for both executives.
insert into public.staff_employment_profiles
  (staff_id, employee_code, designation, joining_date, attendance_eligible, attendance_policy_id)
select
  u.id, u.code, 'Executive', date '2026-01-01', true,
  (select id from public.attendance_policies where is_current = true limit 1)
from (values
  ('40bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid, 'WF-EXEC-1'),
  ('40cccccc-cccc-4ccc-8ccc-cccccccccccc'::uuid, 'WF-EXEC-2')
) as u(id, code)
on conflict (staff_id) do update set
  attendance_eligible = true,
  attendance_policy_id = excluded.attendance_policy_id;

-- -----------------------------------------------------------------------------
-- D. Late evidence — 09:00 start, 15-minute grace, measured from official start
-- -----------------------------------------------------------------------------

-- The seeded current policy is the reference; assert its locked shape first.
select is(
  (select workday_start_local from public.attendance_policies where is_current = true limit 1),
  time '09:00',
  'reference policy official start is 09:00'
);
select is(
  (select late_grace_minutes from public.attendance_policies where is_current = true limit 1),
  15,
  'reference policy grace is 15 minutes'
);
select is(
  (select timezone from public.attendance_policies where is_current = true limit 1),
  'Asia/Kolkata',
  'reference policy timezone is Asia/Kolkata'
);

-- The owner lock: no recurring weekly-off weekday drives V1 decisions.
select is(
  (select cardinality(weekly_off_days) from public.attendance_policies where is_current = true limit 1),
  0,
  'V1 reference policy declares no fixed weekly-off weekday'
);

-- 09:10 IST -> 10 late minutes, on time.
select is(
  (private.workforce_compute_late(
    (select id from public.attendance_policies where is_current = true limit 1),
    timestamptz '2026-09-07 09:10:00+05:30'
  ) ->> 'lateMinutes')::integer,
  10,
  '09:10 records 10 late minutes'
);
select is(
  (private.workforce_compute_late(
    (select id from public.attendance_policies where is_current = true limit 1),
    timestamptz '2026-09-07 09:10:00+05:30'
  ) ->> 'isLate')::boolean,
  false,
  '09:10 is on time'
);

-- 09:15 is the last on-time minute.
select is(
  (private.workforce_compute_late(
    (select id from public.attendance_policies where is_current = true limit 1),
    timestamptz '2026-09-07 09:15:00+05:30'
  ) ->> 'isLate')::boolean,
  false,
  '09:15 is on time'
);

-- 09:16 is the first late minute, and counts 16 from the official start.
select is(
  (private.workforce_compute_late(
    (select id from public.attendance_policies where is_current = true limit 1),
    timestamptz '2026-09-07 09:16:00+05:30'
  ) ->> 'isLate')::boolean,
  true,
  '09:16 is late'
);
select is(
  (private.workforce_compute_late(
    (select id from public.attendance_policies where is_current = true limit 1),
    timestamptz '2026-09-07 09:16:00+05:30'
  ) ->> 'lateMinutes')::integer,
  16,
  '09:16 records 16 late minutes from official start'
);
select is(
  (private.workforce_compute_late(
    (select id from public.attendance_policies where is_current = true limit 1),
    timestamptz '2026-09-07 10:00:00+05:30'
  ) ->> 'lateMinutes')::integer,
  60,
  '10:00 records 60 late minutes'
);

-- Timezone determinism: the same instant expressed in UTC must agree.
select is(
  (private.workforce_compute_late(
    (select id from public.attendance_policies where is_current = true limit 1),
    timestamptz '2026-09-07 03:46:00+00'
  ) ->> 'lateMinutes')::integer,
  16,
  'late minutes are computed in Asia/Kolkata regardless of input offset'
);

-- -----------------------------------------------------------------------------
-- E. Staff submission
-- -----------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '40bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

-- Staff may not mark themselves absent.
select throws_ok(
  $$select public.submit_attendance_day(current_date, 'ABSENT')$$,
  'ATTENDANCE_CATEGORY_INVALID',
  'staff cannot submit ABSENT'
);

select throws_ok(
  $$select public.submit_attendance_day(current_date, 'FULL_DAY_16H')$$,
  'ATTENDANCE_CATEGORY_INVALID',
  'unknown category rejected'
);

select lives_ok(
  $$select public.submit_attendance_day(current_date, 'FULL_DAY_8H')$$,
  'staff can submit FULL_DAY_8H'
);

select is(
  (select lifecycle_state from public.attendance_submissions
   where staff_id = '40bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and attendance_date = current_date),
  'PENDING_APPROVAL',
  'submission moves day to PENDING_APPROVAL'
);

-- Submission alone is never payroll-valid.
select is(
  (select final_category from public.attendance_submissions
   where staff_id = '40bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and attendance_date = current_date),
  null,
  'submission does not set a final category'
);

-- Staff cannot approve, even their own day.
select throws_ok(
  $$select public.approve_attendance_day('40bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', current_date, 'FULL_DAY_8H', null)$$,
  'ATTENDANCE_APPROVAL_DENIED',
  'staff cannot approve attendance'
);

-- Staff cannot write the tables directly.
select throws_ok(
  $$update public.attendance_submissions set final_category = 'FULL_DAY_12H'
    where staff_id = '40bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'$$,
  '42501',
  'permission denied for table attendance_submissions',
  'staff cannot update attendance submissions directly'
);

-- Staff cannot see another employee's submissions.
set local request.jwt.claim.sub = '40cccccc-cccc-4ccc-8ccc-cccccccccccc';
select is(
  (select count(*)::integer from public.attendance_submissions
   where staff_id = '40bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  0,
  'executive cannot read another executive submission'
);

-- -----------------------------------------------------------------------------
-- F. Weekly Off monthly cap
-- -----------------------------------------------------------------------------

set local request.jwt.claim.sub = '40bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

-- Four weekly-off days inside one calendar month are allowed.
select lives_ok(
  $$select public.submit_attendance_day(date_trunc('month', current_date - interval '2 months')::date, 'WEEKLY_OFF')$$,
  'weekly off 1 of 4 allowed'
);
select lives_ok(
  $$select public.submit_attendance_day(date_trunc('month', current_date - interval '2 months')::date + 1, 'WEEKLY_OFF')$$,
  'weekly off 2 of 4 allowed'
);
select lives_ok(
  $$select public.submit_attendance_day(date_trunc('month', current_date - interval '2 months')::date + 2, 'WEEKLY_OFF')$$,
  'weekly off 3 of 4 allowed'
);
select lives_ok(
  $$select public.submit_attendance_day(date_trunc('month', current_date - interval '2 months')::date + 3, 'WEEKLY_OFF')$$,
  'weekly off 4 of 4 allowed'
);

-- The fifth active weekly off in the same month is refused.
select throws_ok(
  $$select public.submit_attendance_day(date_trunc('month', current_date - interval '2 months')::date + 4, 'WEEKLY_OFF')$$,
  'ATTENDANCE_WEEKLY_OFF_QUOTA_EXCEEDED',
  'fifth weekly off in a month is refused'
);

reset role;
select is(
  private.workforce_weekly_off_active_count(
    '40bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', date_trunc('month', current_date - interval '2 months')::date
  ),
  4,
  'four weekly off days consume the quota'
);
set local role authenticated;

-- A rejected weekly off frees its slot.
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '40aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select lives_ok(
  $$select public.reject_attendance_day(
      '40bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      date_trunc('month', current_date - interval '2 months')::date,
      'QA: freeing a weekly off slot'
    )$$,
  'super admin can reject a weekly off'
);

reset role;
select is(
  private.workforce_weekly_off_active_count(
    '40bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', date_trunc('month', current_date - interval '2 months')::date
  ),
  3,
  'rejected weekly off frees a slot'
);
set local role authenticated;

set local request.jwt.claim.sub = '40bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select lives_ok(
  $$select public.submit_attendance_day(date_trunc('month', current_date - interval '2 months')::date + 4, 'WEEKLY_OFF')$$,
  'freed slot allows a new weekly off'
);

-- Month boundary: the next calendar month has its own quota.
select lives_ok(
  $$select public.submit_attendance_day(
      (date_trunc('month', current_date - interval '2 months') + interval '1 month')::date, 'WEEKLY_OFF'
    )$$,
  'next month has an independent weekly off quota'
);

-- -----------------------------------------------------------------------------
-- G. Super Admin approval authority
-- -----------------------------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '40aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select lives_ok(
  $$select public.approve_attendance_day(
      '40bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', current_date, null, 'QA approve'
    )$$,
  'super admin approves the submitted category'
);

select is(
  (select final_category from public.attendance_submissions
   where staff_id = '40bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and attendance_date = current_date),
  'FULL_DAY_8H',
  'approval promotes the submitted category to final'
);
select is(
  (select credited_minutes from public.attendance_submissions
   where staff_id = '40bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and attendance_date = current_date),
  480,
  'approved FULL_DAY_8H credits 480 minutes'
);

-- Edit + Approve: the admin may override the submitted category.
select lives_ok(
  $$select public.approve_attendance_day(
      '40cccccc-cccc-4ccc-8ccc-cccccccccccc', current_date, 'ABSENT', 'QA: marked absent by admin'
    )$$,
  'super admin can set ABSENT as final category'
);
select is(
  (select credited_minutes from public.attendance_submissions
   where staff_id = '40cccccc-cccc-4ccc-8ccc-cccccccccccc' and attendance_date = current_date),
  0,
  'ABSENT credits zero minutes'
);

-- Approval is audited with previous and new values.
select ok(
  exists (
    select 1 from public.attendance_submission_events
    where staff_id = '40bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      and attendance_date = current_date
      and event_type = 'approved'
      and new_state = 'APPROVED'
      and actor_id = '40aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  'approval is recorded in the append-only audit'
);

-- Self-approval is refused even for Super Admin.
reset role;
insert into public.staff_employment_profiles
  (staff_id, employee_code, designation, joining_date, attendance_eligible, attendance_policy_id)
values (
  '40aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', 'WF-SA-1', 'Owner', date '2026-01-01', true,
  (select id from public.attendance_policies where is_current = true limit 1)
)
on conflict (staff_id) do update set attendance_eligible = true;
set local role authenticated;
set local request.jwt.claim.sub = '40aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select throws_ok(
  $$select public.approve_attendance_day(
      '40aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', current_date, 'FULL_DAY_8H', null
    )$$,
  'ATTENDANCE_SELF_APPROVAL_DENIED',
  'super admin cannot approve their own attendance'
);

-- A fifth APPROVED weekly off is impossible, not merely discouraged.
select lives_ok(
  $$select public.approve_attendance_day(
      '40bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      date_trunc('month', current_date - interval '2 months')::date + 1, 'WEEKLY_OFF', 'QA'
    )$$,
  'approving weekly off within quota succeeds'
);

-- The freed slot was already consumed by a later submission, so re-approving
-- the rejected day would be a fifth active Weekly Off. The cap holds even when
-- the Super Admin is correcting history.
select throws_ok(
  $$select public.approve_attendance_day(
      '40bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      date_trunc('month', current_date - interval '2 months')::date, 'WEEKLY_OFF', 'QA restore slot 1'
    )$$,
  'ATTENDANCE_WEEKLY_OFF_QUOTA_EXCEEDED',
  'a freed slot already taken cannot be reclaimed by historical correction'
);

select throws_ok(
  $$select public.approve_attendance_day(
      '40bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
      date_trunc('month', current_date - interval '2 months')::date + 10, 'WEEKLY_OFF', 'QA fifth'
    )$$,
  'ATTENDANCE_WEEKLY_OFF_QUOTA_EXCEEDED',
  'super admin cannot approve a fifth weekly off in a month'
);

-- Manager has read-only team visibility but no approval authority.
set local request.jwt.claim.sub = '40dddddd-dddd-4ddd-8ddd-dddddddddddd';
select throws_ok(
  $$select public.approve_attendance_day(
      '40bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', current_date, 'FULL_DAY_12H', null
    )$$,
  'ATTENDANCE_APPROVAL_DENIED',
  'sales manager cannot approve attendance in V1'
);
select throws_ok(
  $$select public.get_attendance_approval_inbox(null, null, 10)$$,
  'ATTENDANCE_APPROVAL_DENIED',
  'sales manager cannot open the approval inbox'
);

-- -----------------------------------------------------------------------------
-- H. Missing attendance is never auto-finalised as ABSENT
-- -----------------------------------------------------------------------------

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '40aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select is(
  (select count(*)::integer
   from public.attendance_submissions
   where final_category = 'ABSENT'
     and reviewed_by is null),
  0,
  'no ABSENT day exists without an explicit reviewer'
);

-- Approved-only monthly summary; undecided days are reported separately.
select is(
  (public.get_attendance_monthly_summary(
    '40bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', current_date
  ) ->> 'fullDay8hCount')::integer,
  1,
  'monthly summary counts the approved 8h day'
);

select ok(
  (public.get_attendance_monthly_summary(
    '40bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', current_date
  ) ? 'unresolvedCount'),
  'monthly summary reports unresolved days separately'
);

reset role;

select * from finish();
rollback;
