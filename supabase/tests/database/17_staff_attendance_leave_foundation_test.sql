-- ONEDECORE Phase 6D — Staff attendance, leave & holidays foundation pgTAP tests

begin;
select plan(50);

-- A. Schema presence (9 public domain tables + private saga ledger)
select ok(to_regclass('public.attendance_policies') is not null, 'attendance_policies exists');
select ok(to_regclass('public.staff_employment_profiles') is not null, 'staff_employment_profiles exists');
select ok(to_regclass('public.staff_admin_events') is not null, 'staff_admin_events exists');
select ok(to_regclass('public.attendance_events') is not null, 'attendance_events exists');
select ok(to_regclass('public.attendance_days') is not null, 'attendance_days exists');
select ok(to_regclass('public.attendance_corrections') is not null, 'attendance_corrections exists');
select ok(to_regclass('public.leave_types') is not null, 'leave_types exists');
select ok(to_regclass('public.leave_requests') is not null, 'leave_requests exists');
select ok(to_regclass('public.holidays') is not null, 'holidays exists');
select ok(to_regclass('private.staff_invite_saga_requests') is not null, 'private staff_invite_saga_requests exists');

-- B. RLS enabled on exposed public tables
select ok(
  (select relrowsecurity from pg_class where relname = 'attendance_policies'),
  'attendance_policies RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'staff_employment_profiles'),
  'staff_employment_profiles RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'staff_admin_events'),
  'staff_admin_events RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'attendance_events'),
  'attendance_events RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'attendance_days'),
  'attendance_days RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'attendance_corrections'),
  'attendance_corrections RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'leave_types'),
  'leave_types RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'leave_requests'),
  'leave_requests RLS enabled'
);
select ok(
  (select relrowsecurity from pg_class where relname = 'holidays'),
  'holidays RLS enabled'
);

select results_eq(
  $$select has_table_privilege('authenticated', 'private.staff_invite_saga_requests', 'SELECT')$$,
  array[false],
  'authenticated cannot read private staff invite saga ledger'
);

-- C. Permissions seeded (12 codes)
select results_eq(
  $$select count(*)::integer from public.permissions
    where code in (
      'staff.manage', 'staff.read',
      'attendance.self', 'attendance.team.read', 'attendance.read.all',
      'attendance.correct.all', 'attendance.correct.team',
      'leave.self', 'leave.team.approve', 'leave.manage',
      'holidays.manage', 'attendance.policies.manage'
    )$$,
  array[12],
  'twelve Phase 6D permission codes seeded'
);

-- D. Anon cannot execute key RPCs
select results_eq(
  $$select has_function_privilege('anon', 'public.create_staff_member(uuid)', 'execute')$$,
  array[false],
  'anon cannot create staff member'
);
select results_eq(
  $$select has_function_privilege('anon', 'public.check_in_attendance(text, text, numeric, numeric, numeric, timestamptz)', 'execute')$$,
  array[false],
  'anon cannot check in attendance'
);
select results_eq(
  $$select has_function_privilege('anon', 'public.create_leave_request(uuid, date, date, text, text)', 'execute')$$,
  array[false],
  'anon cannot create leave request'
);
select results_eq(
  $$select has_function_privilege('anon', 'public.approve_leave_request(uuid, text)', 'execute')$$,
  array[false],
  'anon cannot approve leave request'
);
select results_eq(
  $$select has_function_privilege('anon', 'public.publish_attendance_policy(text, text, text, time, time, integer, integer, time, smallint[], boolean, uuid)', 'execute')$$,
  array[false],
  'anon cannot publish attendance policy'
);

-- E. Synthetic auth.users + profiles + user_roles
insert into auth.users (id, instance_id, email, aud, role) values
  ('6d111111-1111-1111-1111-111111111111', '00000000-0000-0000-0000-000000000000', '6d-sa@example.test', 'authenticated', 'authenticated'),
  ('6d222222-2222-2222-2222-222222222222', '00000000-0000-0000-0000-000000000000', '6d-mgr@example.test', 'authenticated', 'authenticated'),
  ('6d333333-3333-3333-3333-333333333333', '00000000-0000-0000-0000-000000000000', '6d-exec@example.test', 'authenticated', 'authenticated'),
  ('6d444444-4444-4444-4444-444444444444', '00000000-0000-0000-0000-000000000000', '6d-exec2@example.test', 'authenticated', 'authenticated'),
  ('6d555555-5555-5555-5555-555555555555', '00000000-0000-0000-0000-000000000000', '6d-exec3@example.test', 'authenticated', 'authenticated'),
  ('6d666666-6666-6666-6666-666666666666', '00000000-0000-0000-0000-000000000000', '6d-self@example.test', 'authenticated', 'authenticated'),
  ('6d777777-7777-7777-7777-777777777777', '00000000-0000-0000-0000-000000000000', '6d-inactive@example.test', 'authenticated', 'authenticated');

update public.profiles set status = 'active'
where id in (
  '6d111111-1111-1111-1111-111111111111',
  '6d222222-2222-2222-2222-222222222222',
  '6d333333-3333-3333-3333-333333333333',
  '6d444444-4444-4444-4444-444444444444',
  '6d555555-5555-5555-5555-555555555555',
  '6d666666-6666-6666-6666-666666666666'
);

update public.profiles set status = 'suspended'
where id = '6d777777-7777-7777-7777-777777777777';

insert into public.user_roles (user_id, role_id)
select '6d111111-1111-1111-1111-111111111111', id from public.roles where code = 'super_admin';
insert into public.user_roles (user_id, role_id)
select '6d222222-2222-2222-2222-222222222222', id from public.roles where code = 'sales_manager';
insert into public.user_roles (user_id, role_id)
select '6d333333-3333-3333-3333-333333333333', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select '6d444444-4444-4444-4444-444444444444', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select '6d555555-5555-5555-5555-555555555555', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select '6d666666-6666-6666-6666-666666666666', id from public.roles where code = 'sales_executive';
insert into public.user_roles (user_id, role_id)
select '6d777777-7777-7777-7777-777777777777', id from public.roles where code = 'sales_executive';

set local role authenticated;
set local request.jwt.claim.sub = '6d111111-1111-1111-1111-111111111111';

select set_config(
  'onedecore.test_policy_id',
  (select public.publish_attendance_policy(
    'default_6d',
    'Phase 6D Test Policy',
    'Asia/Kolkata',
    '09:00'::time,
    '18:00'::time,
    15,
    240,
    '20:00'::time,
    array[
      ((extract(isodow from (timezone('Asia/Kolkata', now()))::date)::smallint % 7) + 1)
    ]::smallint[],
    false
  ) ->> 'policyId'),
  true
);

select public.set_current_attendance_policy(current_setting('onedecore.test_policy_id')::uuid);

-- Durable saga staff setup helper pattern
select public.prepare_staff_invite_saga(
  '6da11111-1111-1111-1111-111111111111'::uuid,
  'EMP6D001', '6D Active Executive', '6d-exec@example.test', '+919800000301',
  'Sales Executive', current_date, 'sales_executive',
  '6d222222-2222-2222-2222-222222222222'::uuid, true,
  current_setting('onedecore.test_policy_id')::uuid
);
select public.record_staff_invite_auth_success(
  '6da11111-1111-1111-1111-111111111111'::uuid,
  '6d333333-3333-3333-3333-333333333333'::uuid
);
select public.create_staff_member('6da11111-1111-1111-1111-111111111111'::uuid);

select public.prepare_staff_invite_saga(
  '6da22222-2222-2222-2222-222222222222'::uuid,
  'EMP6D002', '6D Executive Two', '6d-exec2@example.test', '+919800000302',
  'Sales Executive', current_date, 'sales_executive',
  '6d333333-3333-3333-3333-333333333333'::uuid, false, null
);
select public.record_staff_invite_auth_success(
  '6da22222-2222-2222-2222-222222222222'::uuid,
  '6d444444-4444-4444-4444-444444444444'::uuid
);
select public.create_staff_member('6da22222-2222-2222-2222-222222222222'::uuid);

select public.prepare_staff_invite_saga(
  '6da33333-3333-3333-3333-333333333333'::uuid,
  'EMP6D003', '6D Executive Three', '6d-exec3@example.test', '+919800000303',
  'Sales Executive', current_date, 'sales_executive',
  '6d333333-3333-3333-3333-333333333333'::uuid, false, null
);
select public.record_staff_invite_auth_success(
  '6da33333-3333-3333-3333-333333333333'::uuid,
  '6d555555-5555-5555-5555-555555555555'::uuid
);
select public.create_staff_member('6da33333-3333-3333-3333-333333333333'::uuid);

select public.prepare_staff_invite_saga(
  '6da44444-4444-4444-4444-444444444444'::uuid,
  'EMP6D004', '6D Inactive Executive', '6d-inactive@example.test', '+919800000304',
  'Sales Executive', current_date, 'sales_executive',
  '6d222222-2222-2222-2222-222222222222'::uuid, true,
  current_setting('onedecore.test_policy_id')::uuid
);
select public.record_staff_invite_auth_success(
  '6da44444-4444-4444-4444-444444444444'::uuid,
  '6d777777-7777-7777-7777-777777777777'::uuid
);
select public.create_staff_member('6da44444-4444-4444-4444-444444444444'::uuid);

select public.set_staff_profile_status(
  '6d333333-3333-3333-3333-333333333333'::uuid,
  'active',
  'activate for attendance tests'
);

-- F. employee_code unique constraint at prepare time
select throws_ok(
  $$select public.prepare_staff_invite_saga(
    '6da55555-5555-5555-5555-555555555555'::uuid,
    'EMP6D001', 'Duplicate Code Staff', 'dup@example.test', '+919800000305',
    'Sales Executive', current_date, 'sales_executive',
    '6d222222-2222-2222-2222-222222222222'::uuid, false, null
  )$$,
  'P0001',
  'employee_code already exists',
  'employee_code unique constraint enforced'
);

-- G. self manager rejected
select throws_ok(
  $$select public.set_staff_reporting_manager(
    '6d666666-6666-6666-6666-666666666666'::uuid,
    '6d666666-6666-6666-6666-666666666666'::uuid,
    'self manager test'
  )$$,
  'P0001',
  'staff reporting manager cannot be self',
  'self reporting manager rejected'
);

-- H. reporting hierarchy cycle rejected
select throws_ok(
  $$select public.set_staff_reporting_manager(
    '6d333333-3333-3333-3333-333333333333'::uuid,
    '6d444444-4444-4444-4444-444444444444'::uuid,
    'cycle test'
  )$$,
  'P0001',
  'staff reporting hierarchy cycle detected',
  'reporting hierarchy cycle rejected'
);

reset role;

-- I. staff_admin_events append-only
select throws_ok(
  $$update public.staff_admin_events set event_type = 'staff.status_changed' where staff_id = '6d333333-3333-3333-3333-333333333333'::uuid$$,
  '55000',
  'staff_admin_events is append-only',
  'staff_admin_events cannot be updated'
);

select throws_ok(
  $$delete from public.staff_admin_events where staff_id = '6d333333-3333-3333-3333-333333333333'::uuid$$,
  '55000',
  'staff_admin_events is append-only',
  'staff_admin_events cannot be deleted'
);

-- J. invite saga failure survives auth marker and reconciles
set local role authenticated;
set local request.jwt.claim.sub = '6d111111-1111-1111-1111-111111111111';

select public.prepare_staff_invite_saga(
  '6da66666-6666-6666-6666-666666666666'::uuid,
  'EMP6D666', 'Saga Retry Staff', '6d-self@example.test', null,
  'Sales Executive', current_date, 'sales_executive',
  '6d222222-2222-2222-2222-222222222222'::uuid, false, null
);
select public.record_staff_invite_auth_success(
  '6da66666-6666-6666-6666-666666666666'::uuid,
  '6d666666-6666-6666-6666-666666666666'::uuid
);

update public.profiles set status = 'suspended'
where id = '6d222222-2222-2222-2222-222222222222';

select throws_ok(
  $$select public.create_staff_member('6da66666-6666-6666-6666-666666666666'::uuid)$$,
  'P0001',
  'reporting manager must be active',
  'finalize failure leaves durable auth marker'
);

reset role;
set local role postgres;

select results_eq(
  $$select saga_state from private.staff_invite_saga_requests
    where client_request_id = '6da66666-6666-6666-6666-666666666666'::uuid$$,
  array['auth_created_db_pending'::text],
  'auth_created_db_pending survives finalize failure'
);

select results_eq(
  $$select count(*)::integer from public.staff_employment_profiles
    where staff_id = '6d666666-6666-6666-6666-666666666666'::uuid$$,
  array[0],
  'no employment row after failed finalize'
);

set local role authenticated;
set local request.jwt.claim.sub = '6d111111-1111-1111-1111-111111111111';

update public.profiles set status = 'active'
where id = '6d222222-2222-2222-2222-222222222222';

select lives_ok(
  $$select public.reconcile_staff_invite('6da66666-6666-6666-6666-666666666666'::uuid)$$,
  'reconcile completes after finalize failure'
);

select results_eq(
  $$select count(*)::integer from public.staff_employment_profiles
    where staff_id = '6d666666-6666-6666-6666-666666666666'::uuid$$,
  array[1],
  'exactly one employment row after reconcile'
);

select results_eq(
  $$select count(*)::integer from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    where ur.user_id = '6d666666-6666-6666-6666-666666666666'::uuid
      and r.code in ('sales_manager', 'sales_executive', 'project_manager', 'designer')$$,
  array[1],
  'exactly one operational role after reconcile'
);

select results_eq(
  $$select count(*)::integer from public.staff_admin_events
    where staff_id = '6d666666-6666-6666-6666-666666666666'::uuid
      and event_type = 'staff.created'$$,
  array[1],
  'exactly one staff.created audit event'
);

select results_eq(
  $$select (public.reconcile_staff_invite('6da66666-6666-6666-6666-666666666666'::uuid) ->> 'idempotentReplay')::boolean$$,
  array[true],
  'reconcile replay is idempotent'
);

-- K. inactive staff denied for check_in
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '6d777777-7777-7777-7777-777777777777';

select throws_ok(
  $$select public.check_in_attendance('6d-inactive-checkin-001')$$,
  '42501',
  'ATTENDANCE_INACTIVE_STAFF',
  'inactive staff denied for check_in'
);

-- L. check_in idempotency replay
reset role;
set local role authenticated;
set local request.jwt.claim.sub = '6d333333-3333-3333-3333-333333333333';

select lives_ok(
  $$select public.check_in_attendance('6d-idem-checkin-001')$$,
  'active attendance-eligible staff can check in'
);

select results_eq(
  $$select (public.check_in_attendance('6d-idem-checkin-001') ->> 'idempotentReplay')::boolean$$,
  array[true],
  'check_in idempotency replay returns idempotentReplay true'
);

select throws_ok(
  $$select public.check_in_attendance('6d-idem-checkin-002')$$,
  'P0001',
  'ATTENDANCE_ALREADY_CHECKED_IN',
  'distinct idempotency key denied while open session exists'
);

select lives_ok(
  $$select public.check_out_attendance('6d-idem-checkout-001')$$,
  'active staff can check out open session'
);

select results_eq(
  $$select (public.check_out_attendance('6d-idem-checkout-001') ->> 'idempotentReplay')::boolean$$,
  array[true],
  'check_out idempotency replay returns idempotentReplay true after session closed'
);

-- M. attendance_events append-only
reset role;

select throws_ok(
  $$update public.attendance_events set event_type = 'check_out' where staff_id = '6d333333-3333-3333-3333-333333333333'::uuid$$,
  '55000',
  'attendance_events is append-only',
  'attendance_events cannot be updated'
);

select throws_ok(
  $$delete from public.attendance_events where staff_id = '6d333333-3333-3333-3333-333333333333'::uuid$$,
  '55000',
  'attendance_events is append-only',
  'attendance_events cannot be deleted'
);

-- N. leave overlap rejection and self approval denied
insert into public.leave_types (code, display_name, allows_half_day, is_active)
values ('casual_6d', 'Casual Leave 6D', false, true);

select set_config(
  'onedecore.test_leave_type_id',
  (select id::text from public.leave_types where code = 'casual_6d' limit 1),
  true
);

set local role authenticated;
set local request.jwt.claim.sub = '6d333333-3333-3333-3333-333333333333';

select set_config(
  'onedecore.test_leave_request_id',
  (select public.create_leave_request(
    current_setting('onedecore.test_leave_type_id')::uuid,
    current_date + 10,
    current_date + 12,
    'planned leave for overlap test'
  ) ->> 'requestId'),
  true
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '6d222222-2222-2222-2222-222222222222';

select lives_ok(
  $$select public.approve_leave_request(current_setting('onedecore.test_leave_request_id')::uuid, 'approved for overlap test')$$,
  'manager can approve direct-report leave'
);

reset role;
set local role authenticated;
set local request.jwt.claim.sub = '6d333333-3333-3333-3333-333333333333';

select throws_ok(
  $$select public.create_leave_request(
    current_setting('onedecore.test_leave_type_id')::uuid,
    current_date + 11,
    current_date + 13,
    'overlapping leave'
  )$$,
  'P0001',
  'LEAVE_OVERLAP',
  'leave overlap rejection'
);

select set_config(
  'onedecore.test_pending_leave_id',
  (select public.create_leave_request(
    current_setting('onedecore.test_leave_type_id')::uuid,
    current_date + 20,
    current_date + 21,
    'pending leave for self approval test'
  ) ->> 'requestId'),
  true
);

select throws_ok(
  $$select public.approve_leave_request(current_setting('onedecore.test_pending_leave_id')::uuid, 'self approve')$$,
  'P0001',
  'LEAVE_SELF_APPROVAL_DENIED',
  'self approval denied for leave'
);

reset role;

select * from finish();
rollback;
