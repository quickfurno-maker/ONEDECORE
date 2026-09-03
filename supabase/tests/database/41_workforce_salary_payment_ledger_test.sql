-- ONEDECORE Workforce V1 — salary profiles, statements & payment ledger pgTAP tests

begin;
select plan(61);

-- -----------------------------------------------------------------------------
-- A. Schema presence and hardening
-- -----------------------------------------------------------------------------

select ok(to_regclass('public.salary_profiles') is not null, 'salary_profiles exists');
select ok(to_regclass('public.salary_statements') is not null, 'salary_statements exists');
select ok(to_regclass('public.salary_statement_lines') is not null, 'salary_statement_lines exists');
select ok(to_regclass('public.salary_payments') is not null, 'salary_payments exists');
select ok(to_regclass('public.salary_statement_events') is not null, 'salary_statement_events exists');

select is(
  (
    select count(*)::integer
    from pg_class c join pg_namespace n on n.oid = c.relnamespace
    where n.nspname = 'public'
      and c.relname in ('salary_profiles','salary_statements','salary_statement_lines','salary_payments','salary_statement_events')
      and (not c.relrowsecurity or not c.relforcerowsecurity)
  ),
  0,
  'all salary tables have RLS and FORCE RLS'
);

select is(
  (
    select count(*)::integer
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where p.proname in (
        'salary_require_manager','salary_can_view','salary_append_event',
        'salary_profile_for_date','salary_statement_totals',
        'set_salary_profile','create_salary_statement','add_salary_statement_line',
        'remove_salary_statement_line','finalize_salary_statement',
        'reopen_salary_statement','record_salary_payment',
        'get_salary_statement','list_salary_statements'
      )
      and n.nspname in ('public','private')
      and not (coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=%')
  ),
  0,
  'all salary functions pin search_path'
);

select ok(
  exists (select 1 from public.permissions where code = 'salary.manage' and is_active),
  'salary.manage permission exists'
);
select is(
  (
    select string_agg(r.code, ',' order by r.code)
    from public.role_permissions rp
    join public.roles r on r.id = rp.role_id
    join public.permissions p on p.id = rp.permission_id
    where p.code = 'salary.manage'
  ),
  'super_admin',
  'salary.manage granted to super_admin only'
);

-- -----------------------------------------------------------------------------
-- B. No automatic deduction policy exists anywhere
-- -----------------------------------------------------------------------------

-- The only money movement is base plus explicit lines. Absence, lateness and
-- Weekly Off must not appear in any arithmetic.
select ok(
  pg_get_functiondef(
    (select p.oid from pg_proc p join pg_namespace n on n.oid = p.pronamespace
     where n.nspname = 'private' and p.proname = 'salary_statement_totals')
  ) !~ 'absent_count|late_day_count|weekly_off_count',
  'net payable arithmetic never reads absence, lateness or weekly off counts'
);

-- -----------------------------------------------------------------------------
-- C. Fixtures
-- -----------------------------------------------------------------------------

-- last_sign_in_at is set so the access-state derivation yields 'active':
-- these fixtures act AS staff, and a staff member exercising the app has
-- signed in. An employment record whose access_state is not active is
-- denied staff-domain reads by design (see M54 section E2).
insert into auth.users (id, instance_id, email, aud, role, last_sign_in_at) values
  ('41aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', '41-sa@example.test', 'authenticated', 'authenticated', now()),
  ('41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', '41-exec@example.test', 'authenticated', 'authenticated', now()),
  ('41cccccc-cccc-4ccc-8ccc-cccccccccccc', '00000000-0000-0000-0000-000000000000', '41-exec2@example.test', 'authenticated', 'authenticated', now());

update public.profiles set status = 'active'
where id in (
  '41aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa',
  '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
  '41cccccc-cccc-4ccc-8ccc-cccccccccccc'
);

insert into public.user_roles (user_id, role_id)
select '41aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', id from public.roles where code = 'super_admin';
insert into public.user_roles (user_id, role_id)
select '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select '41cccccc-cccc-4ccc-8ccc-cccccccccccc', id from public.roles where code = 'sales_executive';

set local role authenticated;
set local request.jwt.claim.sub = '41aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

-- -----------------------------------------------------------------------------
-- D. Effective-dated salary profiles
-- -----------------------------------------------------------------------------

select lives_ok(
  $$select public.set_salary_profile(
      '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 5000000, date '2026-01-01', 'Initial'
    )$$,
  'super admin sets an initial salary version'
);

select is(
  (select monthly_base_salary_paise from public.salary_profiles
   where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and effective_to is null),
  5000000::bigint,
  'the open version carries the set amount'
);

select lives_ok(
  $$select public.set_salary_profile(
      '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 6000000, date '2026-06-01', 'Revision'
    )$$,
  'a revision creates a new version'
);

select is(
  (select count(*)::integer from public.salary_profiles
   where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  2,
  'salary history is preserved, not overwritten'
);

select is(
  (select monthly_base_salary_paise from public.salary_profiles
   where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and effective_from = date '2026-01-01'),
  5000000::bigint,
  'the historical amount is unchanged after a revision'
);

select is(
  (select effective_to from public.salary_profiles
   where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and effective_from = date '2026-01-01'),
  date '2026-05-31',
  'the previous version is closed the day before the new one starts'
);

select is(
  (select count(*)::integer from public.salary_profiles
   where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb' and effective_to is null),
  1,
  'exactly one open version remains'
);

-- Backdating over the current version is refused.
select throws_ok(
  $$select public.set_salary_profile(
      '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 7000000, date '2026-03-01', null
    )$$,
  'SALARY_EFFECTIVE_FROM_NOT_AFTER_CURRENT',
  'a new version cannot start on or before the current version'
);

select throws_ok(
  $$select public.set_salary_profile(
      '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', -1, date '2027-01-01', null
    )$$,
  'SALARY_AMOUNT_INVALID',
  'a negative salary is refused'
);

-- The profile in force resolves by date. Private helpers are revoked from
-- `authenticated` by design, so assert them as the owner.
reset role;
select is(
  (select monthly_base_salary_paise from private.salary_profile_for_date(
     '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', date '2026-03-15')),
  5000000::bigint,
  'March 2026 resolves to the first version'
);
select is(
  (select monthly_base_salary_paise from private.salary_profile_for_date(
     '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', date '2026-07-15')),
  6000000::bigint,
  'July 2026 resolves to the revised version'
);
set local role authenticated;
set local request.jwt.claim.sub = '41aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

-- -----------------------------------------------------------------------------
-- E. Statement built from approved attendance only
-- -----------------------------------------------------------------------------

reset role;
insert into public.attendance_policies (
  code, name, timezone, workday_start_local, workday_end_local,
  late_grace_minutes, half_day_threshold_minutes, missing_checkout_cutoff_local,
  weekly_off_days, location_required, is_current
) values (
  'wf_salary_test', 'Salary test policy', 'Asia/Kolkata',
  time '09:00', time '18:00', 15, 240, time '23:59',
  array[]::smallint[], false, true
);

insert into public.staff_employment_profiles
  (staff_id, employee_code, designation, joining_date, attendance_eligible, attendance_policy_id)
values (
  '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'SAL-EXEC-1', 'Executive', date '2026-01-01', true,
  (select id from public.attendance_policies where is_current = true limit 1)
)
on conflict (staff_id) do update set attendance_eligible = true;

-- One APPROVED 8h day and one PENDING day in the same month. Only the approved
-- day may reach the statement.
insert into public.attendance_submissions (
  staff_id, attendance_date, lifecycle_state, submitted_category,
  final_category, credited_minutes, is_late, reviewed_by, reviewed_at
) values
  ('41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', date '2026-07-01', 'APPROVED', 'FULL_DAY_8H',
   'FULL_DAY_8H', 480, true, '41aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', now()),
  ('41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', date '2026-07-02', 'APPROVED', 'WEEKLY_OFF',
   'WEEKLY_OFF', 0, false, '41aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', now()),
  ('41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', date '2026-07-03', 'PENDING_APPROVAL', 'FULL_DAY_8H',
   null, null, false, null, null);

set local role authenticated;
set local request.jwt.claim.sub = '41aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select lives_ok(
  $$select public.create_salary_statement('41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', date '2026-07-01')$$,
  'super admin builds the July statement'
);

select is(
  (select approved_day_count from public.salary_statements
   where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  2,
  'only approved days are snapshotted'
);
select is(
  (select full_day_8h_count from public.salary_statements
   where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  1,
  'the approved 8h day is counted'
);
select is(
  (select weekly_off_count from public.salary_statements
   where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  1,
  'the approved weekly off is counted'
);
select is(
  (select base_salary_paise from public.salary_statements
   where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  6000000::bigint,
  'the statement binds the salary version in force for the month'
);

-- Weekly Off is PAID: it must not reduce the base.
select is(
  (public.get_salary_statement(
    (select id from public.salary_statements where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
  ) ->> 'netPayablePaise')::bigint,
  6000000::bigint,
  'weekly off and lateness cause no automatic deduction'
);

select throws_ok(
  $$select public.create_salary_statement('41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', date '2026-07-01')$$,
  'SALARY_STATEMENT_EXISTS',
  'one statement per employee per month'
);

-- Payroll must never mutate attendance.
select is(
  (select count(*)::integer from public.attendance_submissions
   where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
     and lifecycle_state = 'APPROVED'),
  2,
  'building a statement does not change attendance'
);

-- -----------------------------------------------------------------------------
-- F. Explicit line items
-- -----------------------------------------------------------------------------

select lives_ok(
  $$select public.add_salary_statement_line(
      (select id from public.salary_statements where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      'bonus', 100000, 'Festival bonus'
    )$$,
  'a bonus line is added'
);

select lives_ok(
  $$select public.add_salary_statement_line(
      (select id from public.salary_statements where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      'absence_deduction', 50000, 'Agreed absence deduction'
    )$$,
  'an explicit absence deduction line is added'
);

select is(
  (select direction from public.salary_statement_lines where line_type = 'bonus'),
  'addition',
  'bonus is an addition'
);
select is(
  (select direction from public.salary_statement_lines where line_type = 'absence_deduction'),
  'deduction',
  'absence deduction is a deduction'
);

select is(
  (public.get_salary_statement(
    (select id from public.salary_statements where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
  ) ->> 'netPayablePaise')::bigint,
  6050000::bigint,
  'net payable is base plus additions minus deductions'
);

select throws_ok(
  $$select public.add_salary_statement_line(
      (select id from public.salary_statements where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      'not_a_type', 1000, null
    )$$,
  'SALARY_LINE_TYPE_INVALID',
  'an unknown line type is refused'
);

select throws_ok(
  $$select public.add_salary_statement_line(
      (select id from public.salary_statements where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      'bonus', 0, null
    )$$,
  'SALARY_AMOUNT_INVALID',
  'a zero amount line is refused'
);

-- -----------------------------------------------------------------------------
-- G. Finalize, payment ledger, derived status
-- -----------------------------------------------------------------------------

-- Money cannot move before the owner finalizes.
select throws_ok(
  $$select public.record_salary_payment(
      (select id from public.salary_statements where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      100000, current_date, 'bank', null, null
    )$$,
  'SALARY_STATEMENT_NOT_FINALIZED',
  'payment against a draft statement is refused'
);

select lives_ok(
  $$select public.finalize_salary_statement(
      (select id from public.salary_statements where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 'Approved'
    )$$,
  'super admin finalizes the statement'
);

select is(
  (select status from public.salary_statements where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  'finalized',
  'statement is finalized'
);

-- A finalized statement is immutable until explicitly reopened.
select throws_ok(
  $$select public.add_salary_statement_line(
      (select id from public.salary_statements where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      'bonus', 1000, null
    )$$,
  'SALARY_STATEMENT_FINALIZED',
  'a finalized statement cannot be silently edited'
);

select is(
  (public.get_salary_statement(
    (select id from public.salary_statements where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
  ) ->> 'paymentStatus'),
  'unpaid',
  'a finalized statement with no payment is unpaid'
);

select lives_ok(
  $$select public.record_salary_payment(
      (select id from public.salary_statements where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      2000000, current_date, 'upi', 'UPI-REF-1', 'part payment'
    )$$,
  'a partial payment is recorded'
);

select is(
  (public.get_salary_statement(
    (select id from public.salary_statements where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
  ) ->> 'paymentStatus'),
  'partially_paid',
  'partial payment derives partially_paid'
);
select is(
  (public.get_salary_statement(
    (select id from public.salary_statements where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
  ) ->> 'balancePaise')::bigint,
  4050000::bigint,
  'balance remaining is net minus paid'
);

select lives_ok(
  $$select public.record_salary_payment(
      (select id from public.salary_statements where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      4050000, current_date, 'bank', 'NEFT-REF-2', 'final settlement'
    )$$,
  'a second payment settles the statement'
);

select is(
  (public.get_salary_statement(
    (select id from public.salary_statements where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')
  ) ->> 'paymentStatus'),
  'paid',
  'full settlement derives paid'
);
select is(
  (select count(*)::integer from public.salary_payments
   where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  2,
  'multiple payments settle one statement'
);

select throws_ok(
  $$select public.record_salary_payment(
      (select id from public.salary_statements where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      1, current_date, 'cash', null, null
    )$$,
  'SALARY_PAYMENT_EXCEEDS_BALANCE',
  'overpayment beyond the balance is refused'
);

select throws_ok(
  $$select public.record_salary_payment(
      (select id from public.salary_statements where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      100, current_date, 'crypto', null, null
    )$$,
  'SALARY_PAYMENT_METHOD_INVALID',
  'an unsupported payment method is refused'
);

-- Controlled amendment rather than silent overwrite.
select lives_ok(
  $$select public.reopen_salary_statement(
      (select id from public.salary_statements where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      'Correcting an agreed bonus'
    )$$,
  'a finalized statement can be reopened with a reason'
);

select ok(
  exists (
    select 1 from public.salary_statement_events
    where event_type = 'reopened' and reason is not null
      and actor_id = '41aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  'reopening is audited with a reason and actor'
);

select throws_ok(
  $$select public.reopen_salary_statement(
      (select id from public.salary_statements where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), ''
    )$$,
  'SALARY_REASON_REQUIRED',
  'reopening without a reason is refused'
);

-- -----------------------------------------------------------------------------
-- H. Staff read-only isolation
-- -----------------------------------------------------------------------------

set local request.jwt.claim.sub = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select is(
  (select count(*)::integer from public.salary_statements
   where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  1,
  'staff can read their own statement'
);
select is(
  (select count(*)::integer from public.salary_payments
   where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  2,
  'staff can read their own payments'
);

select throws_ok(
  $$update public.salary_statements set base_salary_paise = 99999999
    where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'$$,
  '42501',
  'permission denied for table salary_statements',
  'staff cannot mutate their own salary statement'
);

select throws_ok(
  $$select public.set_salary_profile(
      '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 99999999, date '2028-01-01', null
    )$$,
  'SALARY_PERMISSION_DENIED',
  'staff cannot set their own salary'
);

select throws_ok(
  $$select public.record_salary_payment(
      (select id from public.salary_statements where staff_id = '41bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
      100, current_date, 'cash', null, null
    )$$,
  'SALARY_PERMISSION_DENIED',
  'staff cannot record a payment to themselves'
);

-- No cross-staff salary visibility.
set local request.jwt.claim.sub = '41cccccc-cccc-4ccc-8ccc-cccccccccccc';

select is(
  (select count(*)::integer from public.salary_statements),
  0,
  'an executive cannot see another employee salary statement'
);
select is(
  (select count(*)::integer from public.salary_payments),
  0,
  'an executive cannot see another employee payments'
);
select is(
  (select count(*)::integer from public.salary_profiles),
  0,
  'an executive cannot see another employee salary profile'
);
select is(
  (select count(*)::integer from public.salary_statement_events),
  0,
  'the management audit trail is not employee-facing'
);

reset role;

select * from finish();
rollback;
