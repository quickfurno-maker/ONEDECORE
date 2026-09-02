-- ONEDECORE — staff creation without an email: employment identity vs login identity

begin;
select plan(38);

-- -----------------------------------------------------------------------------
-- A. Employment identity is no longer welded to a login identity
-- -----------------------------------------------------------------------------

select ok(
  not exists (
    select 1 from pg_constraint
    where conrelid = 'public.profiles'::regclass
      and contype = 'f'
      and confrelid = 'auth.users'::regclass
  ),
  'profiles.id no longer requires an auth.users row'
);

select ok(
  to_regclass('public.staff_employment_profiles') is not null,
  'staff_employment_profiles still exists'
);

select has_column('public', 'staff_employment_profiles', 'access_state',
  'access_state column exists');

select ok(
  exists (
    select 1 from pg_constraint
    where conname = 'chk_staff_employment_profiles_access_state'
  ),
  'access_state is constrained'
);

-- profiles.id must remain the stable workforce key: everything else points at it.
select cmp_ok(
  (select count(*)::integer from pg_constraint
   where contype = 'f' and confrelid = 'public.profiles'::regclass),
  '>=',
  100,
  'profiles.id is still the workforce key for 100+ foreign keys'
);

select is(
  (
    select count(*)::integer
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where p.proname in (
        'create_staff_member_without_invite', 'attach_staff_app_access',
        'confirm_staff_app_access'
      )
      and n.nspname = 'public'
      and not (coalesce(array_to_string(p.proconfig, ','), '') like '%search_path=%')
  ),
  0,
  'new staff functions pin search_path'
);

-- -----------------------------------------------------------------------------
-- B. Fixtures
-- -----------------------------------------------------------------------------

insert into auth.users (id, instance_id, email, aud, role) values
  ('42aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', '42-sa@example.test', 'authenticated', 'authenticated'),
  ('42bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', '42-mgr@example.test', 'authenticated', 'authenticated');

update public.profiles set status = 'active'
where id in ('42aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '42bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb');

insert into public.user_roles (user_id, role_id)
select '42aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', id from public.roles where code = 'super_admin';
insert into public.user_roles (user_id, role_id)
select '42bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', id from public.roles where code = 'sales_manager';

insert into public.staff_employment_profiles
  (staff_id, employee_code, designation, joining_date, attendance_eligible)
values ('42bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'OE-MGR-1', 'Manager', date '2026-01-01', false);

set local role authenticated;
set local request.jwt.claim.sub = '42aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

-- -----------------------------------------------------------------------------
-- C. Creating staff with no email
-- -----------------------------------------------------------------------------

select lives_ok(
  $$select public.create_staff_member_without_invite(
      '42111111-1111-4111-8111-111111111111',
      'OE-EXEC-1', 'No Email Executive', '+919876500001', 'Executive',
      date '2026-02-01', 'sales_executive',
      '42bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', false, null
    )$$,
  'staff can be created with no email at all'
);

select is(
  (select count(*)::integer from public.staff_employment_profiles where employee_code = 'OE-EXEC-1'),
  1,
  'the employment record exists'
);

select is(
  (select access_state from public.staff_employment_profiles where employee_code = 'OE-EXEC-1'),
  'not_activated',
  'app access is not activated'
);

-- The employment identity owns no login identity. auth.users is not readable
-- by `authenticated`, so this is asserted as the owner.
reset role;
select is(
  (select count(*)::integer
   from auth.users u
   join public.staff_employment_profiles sep on sep.staff_id = u.id
   where sep.employee_code = 'OE-EXEC-1'),
  0,
  'no auth user was created'
);
set local role authenticated;
set local request.jwt.claim.sub = '42aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

-- Employment data is fully preserved.
select is(
  (select designation from public.staff_employment_profiles where employee_code = 'OE-EXEC-1'),
  'Executive',
  'designation preserved'
);
select is(
  (select joining_date from public.staff_employment_profiles where employee_code = 'OE-EXEC-1'),
  date '2026-02-01',
  'joining date preserved'
);
select is(
  (select reporting_manager_id from public.staff_employment_profiles where employee_code = 'OE-EXEC-1'),
  '42bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
  'reporting manager preserved'
);
select is(
  (select p.phone_e164 from public.profiles p
   join public.staff_employment_profiles sep on sep.staff_id = p.id
   where sep.employee_code = 'OE-EXEC-1'),
  '+919876500001',
  'phone preserved when supplied'
);
select is(
  (select p.status from public.profiles p
   join public.staff_employment_profiles sep on sep.staff_id = p.id
   where sep.employee_code = 'OE-EXEC-1'),
  'active',
  'employment status is active even though login is not'
);
select is(
  (select count(*)::integer from public.user_roles ur
   join public.staff_employment_profiles sep on sep.staff_id = ur.user_id
   where sep.employee_code = 'OE-EXEC-1'),
  1,
  'role assignment preserved'
);

-- No fabricated email anywhere.
reset role;
select is(
  (select count(*)::integer from auth.users
   where email ilike '%example.invalid%'
      or email ilike '%noreply%'
      or email ilike '%placeholder%'
      or email ilike '%no-email%'),
  0,
  'no placeholder email address was generated'
);
set local role authenticated;
set local request.jwt.claim.sub = '42aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

-- Creation is audited.
select ok(
  exists (
    select 1 from public.staff_admin_events e
    join public.staff_employment_profiles sep on sep.staff_id = e.staff_id
    where sep.employee_code = 'OE-EXEC-1'
      and e.event_type = 'staff.created_without_invite'
      and e.actor_id = '42aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa'
  ),
  'creation without invite is audited with the actor'
);

-- Attendance eligibility still validated.
select throws_ok(
  $$select public.create_staff_member_without_invite(
      '42222222-2222-4222-8222-222222222222',
      'OE-EXEC-2', 'Bad Attendance', null, 'Executive',
      date '2026-02-01', 'sales_executive',
      '42bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', true, null
    )$$,
  'ATTENDANCE_POLICY_MISSING',
  'attendance eligibility still requires a policy'
);

-- Reporting manager rule still enforced.
select throws_ok(
  $$select public.create_staff_member_without_invite(
      '42333333-3333-4333-8333-333333333333',
      'OE-EXEC-3', 'No Manager', null, 'Executive',
      date '2026-02-01', 'sales_executive', null, false, null
    )$$,
  'sales_executive requires reporting manager',
  'sales executive still requires a reporting manager'
);

-- Employee code stays unique.
select throws_ok(
  $$select public.create_staff_member_without_invite(
      '42444444-4444-4444-8444-444444444444',
      'OE-EXEC-1', 'Duplicate Code', null, 'Executive',
      date '2026-02-01', 'sales_executive',
      '42bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', false, null
    )$$,
  'employee_code already exists',
  'employee code remains unique'
);

-- Idempotent replay of the same request returns the same record.
select lives_ok(
  $$select public.create_staff_member_without_invite(
      '42111111-1111-4111-8111-111111111111',
      'OE-EXEC-1', 'No Email Executive', '+919876500001', 'Executive',
      date '2026-02-01', 'sales_executive',
      '42bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', false, null
    )$$,
  'replaying the same client request id is idempotent'
);
select is(
  (select count(*)::integer from public.staff_employment_profiles where employee_code = 'OE-EXEC-1'),
  1,
  'replay did not create a second record'
);

-- -----------------------------------------------------------------------------
-- D. Authentication is impossible until access is genuinely activated
-- -----------------------------------------------------------------------------

-- The decisive property: no auth.users row means auth.uid() can never equal the
-- employment identity, so every existing RLS policy denies by construction.
reset role;
select is(
  (select count(*)::integer
   from auth.users u
   where u.id = (select sep.staff_id from public.staff_employment_profiles sep
                 where sep.employee_code = 'OE-EXEC-1')),
  0,
  'the not-activated employment identity has no login identity to authenticate with'
);
set local role authenticated;
set local request.jwt.claim.sub = '42aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select ok(
  (select sep.staff_id from public.staff_employment_profiles sep
   where sep.employee_code = 'OE-EXEC-1') <> (select auth.uid()),
  'a not-activated staff id is not the current auth.uid()'
);

-- -----------------------------------------------------------------------------
-- E. Activating app access later
-- -----------------------------------------------------------------------------

select throws_ok(
  $$select public.attach_staff_app_access(
      (select staff_id from public.staff_employment_profiles where employee_code = 'OE-EXEC-1'),
      'not-an-email'
    )$$,
  'STAFF_EMAIL_INVALID',
  'attaching an invalid email is refused'
);

select throws_ok(
  $$select public.attach_staff_app_access(
      (select staff_id from public.staff_employment_profiles where employee_code = 'OE-EXEC-1'),
      '   '
    )$$,
  'STAFF_EMAIL_INVALID',
  'attaching a blank email is refused'
);

select lives_ok(
  $$select public.attach_staff_app_access(
      (select staff_id from public.staff_employment_profiles where employee_code = 'OE-EXEC-1'),
      'later.activated@example.test'
    )$$,
  'a Super Admin can attach a login identity later'
);

select is(
  (select access_state from public.staff_employment_profiles where employee_code = 'OE-EXEC-1'),
  'invited',
  'attaching moves app access to invited'
);

-- Confirmation requires the login identity to actually exist.
select throws_ok(
  $$select public.confirm_staff_app_access(
      (select staff_id from public.staff_employment_profiles where employee_code = 'OE-EXEC-1')
    )$$,
  'STAFF_ACCESS_NOT_PROVISIONED',
  'access cannot be confirmed before the auth user exists'
);

-- Simulate the app creating the auth user WITH THE SAME UUID.
reset role;
insert into auth.users (id, instance_id, email, aud, role)
select sep.staff_id, '00000000-0000-0000-0000-000000000000',
       'later.activated@example.test', 'authenticated', 'authenticated'
from public.staff_employment_profiles sep
where sep.employee_code = 'OE-EXEC-1';

-- The on_auth_user_created trigger must NOT clobber the employment record.
select is(
  (select p.display_name from public.profiles p
   join public.staff_employment_profiles sep on sep.staff_id = p.id
   where sep.employee_code = 'OE-EXEC-1'),
  'No Email Executive',
  'creating the auth user preserves the existing employment profile'
);
select is(
  (select p.status from public.profiles p
   join public.staff_employment_profiles sep on sep.staff_id = p.id
   where sep.employee_code = 'OE-EXEC-1'),
  'active',
  'employment status survives auth user creation'
);
select is(
  (select count(*)::integer from public.staff_employment_profiles where employee_code = 'OE-EXEC-1'),
  1,
  'no duplicate employment record was created'
);

set local role authenticated;
set local request.jwt.claim.sub = '42aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select lives_ok(
  $$select public.confirm_staff_app_access(
      (select staff_id from public.staff_employment_profiles where employee_code = 'OE-EXEC-1')
    )$$,
  'access is confirmed once the login identity exists'
);
select is(
  (select access_state from public.staff_employment_profiles where employee_code = 'OE-EXEC-1'),
  'active',
  'app access becomes active'
);

-- -----------------------------------------------------------------------------
-- F. RBAC stays fail-closed
-- -----------------------------------------------------------------------------

set local request.jwt.claim.sub = '42bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select throws_ok(
  $$select public.create_staff_member_without_invite(
      '42555555-5555-4555-8555-555555555555',
      'OE-EXEC-9', 'Manager Attempt', null, 'Executive',
      date '2026-02-01', 'designer', null, false, null
    )$$,
  'ATTENDANCE_UNAUTHORIZED',
  'a sales manager cannot create staff'
);

select throws_ok(
  $$select public.attach_staff_app_access(
      (select staff_id from public.staff_employment_profiles where employee_code = 'OE-EXEC-1'),
      'someone@example.test'
    )$$,
  'ATTENDANCE_UNAUTHORIZED',
  'a sales manager cannot attach app access'
);

select throws_ok(
  $$select public.confirm_staff_app_access(
      (select staff_id from public.staff_employment_profiles where employee_code = 'OE-EXEC-1')
    )$$,
  'ATTENDANCE_UNAUTHORIZED',
  'a sales manager cannot confirm app access'
);

reset role;

select * from finish();
rollback;
