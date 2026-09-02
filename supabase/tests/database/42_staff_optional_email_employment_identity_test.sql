-- ONEDECORE — staff creation without an email: employment identity vs login identity

begin;
select plan(78);

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

-- Simulate the app creating the auth user WITH THE SAME UUID, and the staff
-- member then genuinely signing in. Without that sign-in the day stays
-- "invited" — proven separately in section J.
reset role;
insert into auth.users (id, instance_id, email, aud, role, last_sign_in_at)
select sep.staff_id, '00000000-0000-0000-0000-000000000000',
       'later.activated@example.test', 'authenticated', 'authenticated', now()
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

-- -----------------------------------------------------------------------------
-- G. CORRECTION 1 — access_state persists correctly on BOTH creation paths
-- -----------------------------------------------------------------------------

reset role;

-- The Phase 6D invite saga inserts staff_employment_profiles WITHOUT
-- access_state. The derive trigger must classify it from the login identity, or
-- every newly invited staff member would read "not_activated".
insert into auth.users (id, instance_id, email, aud, role) values
  ('42eeeeee-eeee-4eee-8eee-eeeeeeeeeeee', '00000000-0000-0000-0000-000000000000',
   '42-invited@example.test', 'authenticated', 'authenticated');

insert into public.staff_employment_profiles
  (staff_id, employee_code, designation, joining_date, attendance_eligible)
values ('42eeeeee-eeee-4eee-8eee-eeeeeeeeeeee', 'OE-INV-1', 'Executive', date '2026-03-01', false);

select is(
  (select access_state from public.staff_employment_profiles where employee_code = 'OE-INV-1'),
  'invited',
  'CORRECTION 1: an invite-path row with an auth user is invited, not not_activated'
);

-- A staff member who has actually signed in is active.
insert into auth.users (id, instance_id, email, aud, role, last_sign_in_at) values
  ('42ffffff-ffff-4fff-8fff-ffffffffffff', '00000000-0000-0000-0000-000000000000',
   '42-signedin@example.test', 'authenticated', 'authenticated', now());

insert into public.staff_employment_profiles
  (staff_id, employee_code, designation, joining_date, attendance_eligible)
values ('42ffffff-ffff-4fff-8fff-ffffffffffff', 'OE-ACT-1', 'Executive', date '2026-03-01', false);

select is(
  (select access_state from public.staff_employment_profiles where employee_code = 'OE-ACT-1'),
  'active',
  'CORRECTION 1: a signed-in staff member is active'
);

-- A row with no login identity stays not_activated even when a caller asserts
-- otherwise: the trigger derives the value, it does not trust input.
insert into public.profiles (id, display_name, status)
values ('42999999-9999-4999-8999-999999999999', 'Trigger Probe', 'active');

insert into public.staff_employment_profiles
  (staff_id, employee_code, designation, joining_date, attendance_eligible, access_state)
values ('42999999-9999-4999-8999-999999999999', 'OE-TRG-1', 'Executive', date '2026-03-01', false, 'active');

select is(
  (select access_state from public.staff_employment_profiles where employee_code = 'OE-TRG-1'),
  'not_activated',
  'CORRECTION 1: a claimed access_state cannot outrank the absence of a login identity'
);

-- -----------------------------------------------------------------------------
-- H. CORRECTION 2 — strong clientRequestId idempotency
-- -----------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '42aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select lives_ok(
  $q$select public.create_staff_member_without_invite(
      '42aaabbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
      'OE-IDEM-1', 'Idempotency Probe', null, 'Executive',
      date '2026-04-01', 'designer', null, false, null
    )$q$,
  'CORRECTION 2: first call succeeds'
);

-- The ledger, not the audit log, is the idempotency record. It is revoked from
-- `authenticated` by design, so these are asserted as the owner.
reset role;
select is(
  (select count(*)::integer from private.staff_direct_create_requests
   where client_request_id = '42aaabbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  1,
  'CORRECTION 2: the request id is claimed in the ledger'
);

select ok(
  (select result is not null from private.staff_direct_create_requests
   where client_request_id = '42aaabbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  'CORRECTION 2: the real result is persisted for replay'
);

select ok(
  (select staff_id is not null from private.staff_direct_create_requests
   where client_request_id = '42aaabbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  'CORRECTION 2: the ledger records which staff record the request produced'
);
set local role authenticated;
set local request.jwt.claim.sub = '42aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

-- Replay with an identical payload returns the SAME staff id.
select is(
  (public.create_staff_member_without_invite(
      '42aaabbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
      'OE-IDEM-1', 'Idempotency Probe', null, 'Executive',
      date '2026-04-01', 'designer', null, false, null
   ) ->> 'staffId'),
  (select sep.staff_id::text from public.staff_employment_profiles sep
   where sep.employee_code = 'OE-IDEM-1'),
  'CORRECTION 2: replay returns the original staff id'
);

select is(
  (public.create_staff_member_without_invite(
      '42aaabbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
      'OE-IDEM-1', 'Idempotency Probe', null, 'Executive',
      date '2026-04-01', 'designer', null, false, null
   ) ->> 'idempotentReplay')::boolean,
  true,
  'CORRECTION 2: replay is flagged as a replay'
);

select is(
  (select count(*)::integer from public.staff_employment_profiles
   where employee_code = 'OE-IDEM-1'),
  1,
  'CORRECTION 2: replay created no second employment record'
);

-- Replay reports the ACTUAL stored access state, not a hardcoded guess.
select is(
  (public.create_staff_member_without_invite(
      '42aaabbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
      'OE-IDEM-1', 'Idempotency Probe', null, 'Executive',
      date '2026-04-01', 'designer', null, false, null
   ) ->> 'accessState'),
  (select access_state from public.staff_employment_profiles where employee_code = 'OE-IDEM-1'),
  'CORRECTION 2: replay reports the stored access state'
);

-- Same request id with a DIFFERENT payload is a hard conflict, matching the
-- invite saga contract, rather than silently returning the earlier record.
select throws_ok(
  $q$select public.create_staff_member_without_invite(
      '42aaabbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
      'OE-IDEM-2', 'Different Payload', null, 'Executive',
      date '2026-04-01', 'designer', null, false, null
    )$q$,
  'STAFF_IDEMPOTENCY_CONFLICT',
  'CORRECTION 2: same request id with a different payload is refused'
);

-- A DIFFERENT request id reusing the same employee code is still a duplicate.
select throws_ok(
  $q$select public.create_staff_member_without_invite(
      '42aaaccc-cccc-4ccc-8ccc-cccccccccccc'::uuid,
      'OE-IDEM-1', 'Idempotency Probe', null, 'Executive',
      date '2026-04-01', 'designer', null, false, null
    )$q$,
  'employee_code already exists',
  'CORRECTION 2: a new request id cannot duplicate an employee code'
);

-- The ledger primary key is what makes concurrent replay safe.
reset role;
select ok(
  exists (
    select 1 from pg_constraint
    where conrelid = 'private.staff_direct_create_requests'::regclass
      and contype = 'p'
  ),
  'CORRECTION 2: client_request_id is a primary key, so concurrent submits cannot both insert'
);

-- -----------------------------------------------------------------------------
-- I. CORRECTION 3 — app-access attachment exists in the database
-- -----------------------------------------------------------------------------

select ok(
  exists (
    select 1 from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and p.proname = 'attach_staff_app_access'
  ),
  'CORRECTION 3: attach_staff_app_access exists'
);

-- -----------------------------------------------------------------------------
-- J. FINAL CORRECTION — invited becomes active only on genuine sign-in
-- -----------------------------------------------------------------------------

reset role;

-- An auth identity that has NEVER signed in.
insert into auth.users (id, instance_id, email, aud, role) values
  ('42a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', '00000000-0000-0000-0000-000000000000',
   '42-never@example.test', 'authenticated', 'authenticated');

insert into public.profiles (id, display_name, status)
values ('42a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', 'Never Signed In', 'active')
on conflict (id) do update set display_name = excluded.display_name;

insert into public.staff_employment_profiles
  (staff_id, employee_code, designation, joining_date, attendance_eligible)
values ('42a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1', 'OE-NEVER-1', 'Executive', date '2026-05-01', false);

select is(
  (select access_state from public.staff_employment_profiles where employee_code = 'OE-NEVER-1'),
  'invited',
  'FINAL: auth identity exists but never signed in -> invited'
);

set local role authenticated;
set local request.jwt.claim.sub = '42aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

-- Confirming before a real sign-in must be refused.
select throws_ok(
  $q$select public.confirm_staff_app_access('42a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1')$q$,
  'STAFF_ACCESS_NOT_ACTIVATED',
  'FINAL: confirm before sign-in is refused'
);

select is(
  (select access_state from public.staff_employment_profiles where employee_code = 'OE-NEVER-1'),
  'invited',
  'FINAL: a refused confirm leaves the state at invited'
);

-- Syncing must not promote a never-signed-in identity either.
select lives_ok(
  $q$select public.sync_staff_access_states('42a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1')$q$,
  'FINAL: sync runs for a specific staff member'
);
select is(
  (select access_state from public.staff_employment_profiles where employee_code = 'OE-NEVER-1'),
  'invited',
  'FINAL: sync cannot invent activation'
);

-- Now record genuine sign-in evidence, exactly as GoTrue would.
reset role;
update auth.users set last_sign_in_at = now()
where id = '42a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1';

set local role authenticated;
set local request.jwt.claim.sub = '42aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

-- The stored cache is still stale until it is reconciled: a later sign-in
-- cannot retroactively fire the INSERT trigger. This is the defect the
-- synchroniser fixes.
select is(
  (select access_state from public.staff_employment_profiles where employee_code = 'OE-NEVER-1'),
  'invited',
  'FINAL: a later sign-in does not update the cache by itself'
);

select is(
  public.sync_staff_access_states('42a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1'),
  1,
  'FINAL: sync reconciles exactly the one stale row'
);

select is(
  (select access_state from public.staff_employment_profiles where employee_code = 'OE-NEVER-1'),
  'active',
  'FINAL: genuine sign-in evidence -> active'
);

-- And confirm now succeeds because the evidence is real.
select lives_ok(
  $q$select public.confirm_staff_app_access('42a1a1a1-a1a1-4a1a-8a1a-a1a1a1a1a1a1')$q$,
  'FINAL: confirm succeeds once a real sign-in exists'
);

-- A staff member with no auth identity is never promoted by the synchroniser.
select lives_ok(
  $q$select public.sync_staff_access_states(null)$q$,
  'FINAL: bulk sync runs'
);
select is(
  (select access_state from public.staff_employment_profiles where employee_code = 'OE-EXEC-1'),
  'active',
  'FINAL: the earlier activated staff member stays active after bulk sync'
);
select is(
  (select access_state from public.staff_employment_profiles where employee_code = 'OE-IDEM-1'),
  'not_activated',
  'FINAL: no auth identity stays not_activated through bulk sync'
);

-- The synchroniser is read-gated, not open.
set local request.jwt.claim.sub = '42bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
select lives_ok(
  $q$select public.sync_staff_access_states(null)$q$,
  'FINAL: a sales manager holding staff.read may reconcile'
);

-- -----------------------------------------------------------------------------
-- K. RETRY SAFETY — partial activation must stay recoverable
-- -----------------------------------------------------------------------------

reset role;

-- Employment record with no login identity yet.
insert into public.profiles (id, display_name, status)
values ('42b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', 'Partial Activation', 'active');

insert into public.staff_employment_profiles
  (staff_id, employee_code, designation, joining_date, attendance_eligible)
values ('42b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', 'OE-PART-1', 'Executive', date '2026-06-01', false);

set local role authenticated;
set local request.jwt.claim.sub = '42aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select lives_ok(
  $q$select public.attach_staff_app_access(
      '42b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', 'partial@onedecore.in')$q$,
  'RETRY: first attach marks the day invited'
);

select is(
  (select access_state from public.staff_employment_profiles where employee_code = 'OE-PART-1'),
  'invited',
  'RETRY: state is invited before the identity exists'
);

-- Simulate the partial failure: the exact-id identity WAS created, but the
-- setup email never went out.
reset role;
insert into auth.users (id, instance_id, email, aud, role) values
  ('42b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', '00000000-0000-0000-0000-000000000000',
   'partial@onedecore.in', 'authenticated', 'authenticated');

set local role authenticated;
set local request.jwt.claim.sub = '42aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

-- The old behaviour refused here, stranding the staff member forever.
select lives_ok(
  $q$select public.attach_staff_app_access(
      '42b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', 'partial@onedecore.in')$q$,
  'RETRY: an existing matching identity is a resend, not a refusal'
);

select is(
  (public.attach_staff_app_access(
     '42b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', 'partial@onedecore.in') ->> 'identityExists')::boolean,
  true,
  'RETRY: the caller is told the identity already exists so it will not recreate'
);

select is(
  (select access_state from public.staff_employment_profiles where employee_code = 'OE-PART-1'),
  'invited',
  'RETRY: an existing identity never counts as active'
);

-- Wrong address for this employment identity is an explicit conflict.
select throws_ok(
  $q$select public.attach_staff_app_access(
      '42b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', 'someone.else@onedecore.in')$q$,
  'STAFF_IDENTITY_CONFLICT',
  'RETRY: an existing identity under a different email fails closed'
);

-- The address already belonging to a different employment identity is also a
-- conflict, so activation can never hijack another account. A fresh, still
-- not_activated employee is used so the terminal check cannot mask it.
reset role;
insert into public.profiles (id, display_name, status)
values ('42c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', 'Hijack Probe', 'active');

insert into public.staff_employment_profiles
  (staff_id, employee_code, designation, joining_date, attendance_eligible)
values ('42c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', 'OE-HIJACK-1', 'Executive', date '2026-06-01', false);

set local role authenticated;
set local request.jwt.claim.sub = '42aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select is(
  (select access_state from public.staff_employment_profiles where employee_code = 'OE-HIJACK-1'),
  'not_activated',
  'RETRY: the hijack probe starts not_activated'
);

select throws_ok(
  $q$select public.attach_staff_app_access(
      '42c3c3c3-c3c3-4c3c-8c3c-c3c3c3c3c3c3', 'partial@onedecore.in')$q$,
  'STAFF_IDENTITY_CONFLICT',
  'RETRY: an email owned by another identity fails closed'
);

select is(
  (select access_state from public.staff_employment_profiles where employee_code = 'OE-HIJACK-1'),
  'not_activated',
  'RETRY: a refused hijack leaves the record untouched'
);

-- Once genuinely signed in, activation is terminal.
reset role;
update auth.users set last_sign_in_at = now()
where id = '42b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2';

set local role authenticated;
set local request.jwt.claim.sub = '42aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select throws_ok(
  $q$select public.attach_staff_app_access(
      '42b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2', 'partial@onedecore.in')$q$,
  'STAFF_ACCESS_ALREADY_ACTIVE',
  'RETRY: a genuinely signed-in staff member refuses re-activation'
);

select is(
  public.sync_staff_access_states('42b2b2b2-b2b2-4b2b-8b2b-b2b2b2b2b2b2'),
  1,
  'RETRY: sign-in evidence reconciles the cached state'
);
select is(
  (select access_state from public.staff_employment_profiles where employee_code = 'OE-PART-1'),
  'active',
  'RETRY: only a real sign-in produces active'
);

reset role;

select * from finish();
rollback;
