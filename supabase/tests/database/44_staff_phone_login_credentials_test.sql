-- ONEDECORE Workforce V1 — staff phone login + Super Admin credential control
--
-- `auth.users.phone` values below are stored WITHOUT the leading "+", which is
-- how GoTrue v2.193.1 actually persists them (verified on a live stack:
-- +917447863402 comes back as "917447863402"). The fixtures mirror production
-- rather than an idealised shape, so the uniqueness checks are meaningful.
--
-- Section K is the one that matters most: it sets the REVOKED staff member's
-- JWT and runs DIRECT table SELECTs through RLS. Proving revocation by calling
-- authorize() would prove nothing about the self-read branches, which is
-- exactly where a stale access token could still have read rows.

begin;
select plan(128);

-- -----------------------------------------------------------------------------
-- A. Credential metadata and the private operation ledger
-- -----------------------------------------------------------------------------

select has_column('public', 'staff_employment_profiles', 'login_phone_e164', 'login_phone_e164 exists');
select has_column('public', 'staff_employment_profiles', 'credentials_issued_at', 'credentials_issued_at exists');
select has_column('public', 'staff_employment_profiles', 'credentials_password_set_at', 'credentials_password_set_at exists');
select has_column('public', 'staff_employment_profiles', 'access_revoked_at', 'access_revoked_at exists');

-- NO password material may ever be stored in an application table. A lifecycle
-- TIMESTAMP may legitimately mention the word, so the guard targets columns that
-- could actually hold a secret rather than the name alone.
select is(
  (select count(*)::integer
   from information_schema.columns
   where table_schema = 'public'
     and column_name ~* '(password|passwd|secret|credential_hash)'
     and data_type not in ('timestamp with time zone', 'timestamp without time zone')),
  0,
  'no column capable of holding password material exists in public'
);

select is(
  (select data_type from information_schema.columns
   where table_schema = 'public'
     and table_name = 'staff_employment_profiles'
     and column_name = 'credentials_password_set_at'),
  'timestamp with time zone',
  'the only password-named column is a timestamp, never a value'
);

select ok(
  to_regclass('private.staff_credential_operations') is not null,
  'the credential operation ledger exists'
);

select is(
  (select count(*)::integer from information_schema.columns
   where table_schema = 'private'
     and table_name = 'staff_credential_operations'
     and column_name ~* '(password|passwd|secret|hash|token)'),
  0,
  'the operation ledger has no password, hash or token column'
);

select ok(
  not has_table_privilege('authenticated', 'private.staff_credential_operations', 'SELECT'),
  'authenticated cannot read the operation ledger directly'
);

select ok(
  exists (select 1 from pg_indexes where schemaname = 'private'
          and indexname = 'uq_staff_credential_operations_pending'),
  'one live operation per staff member per kind'
);
select ok(
  exists (select 1 from pg_indexes where schemaname = 'private'
          and indexname = 'uq_staff_credential_operations_phone'),
  'a pending operation reserves its target number'
);

select ok(
  exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'uq_staff_employment_profiles_login_phone'
  ),
  'login phone has a unique index'
);

select is(
  (select pg_get_constraintdef(oid) from pg_constraint
   where conname = 'chk_staff_employment_profiles_access_state'),
  'CHECK ((access_state = ANY (ARRAY[''not_activated''::text, ''credentials_ready''::text, ''active''::text, ''revoked''::text])))',
  'access_state allows exactly the four locked states'
);

-- -----------------------------------------------------------------------------
-- B. Credential administration is its own Super-Admin-only permission
-- -----------------------------------------------------------------------------

select ok(
  exists (select 1 from public.permissions where code = 'staff.credentials.manage' and is_active),
  'staff.credentials.manage permission exists'
);

select is(
  (select string_agg(r.code, ',' order by r.code)
   from public.role_permissions rp
   join public.roles r on r.id = rp.role_id
   join public.permissions p on p.id = rp.permission_id
   where p.code = 'staff.credentials.manage'),
  'super_admin',
  'staff.credentials.manage is granted to super_admin ONLY'
);

-- -----------------------------------------------------------------------------
-- C. The canonical phone contract
-- -----------------------------------------------------------------------------

select is(private.staff_normalize_login_phone('7447863402'), '+917447863402',
  'the 10 digits staff type normalize to +917447863402');
select is(private.staff_normalize_login_phone('+917447863402'), '+917447863402',
  'the canonical form is idempotent');
select is(private.staff_normalize_login_phone('917447863402'), '+917447863402',
  'the pasted 12-digit form unwraps');

select is(private.staff_normalize_login_phone('744786340'), null, '9 digits rejected');
select is(private.staff_normalize_login_phone('74478634021'), null, '11 digits rejected');
select is(private.staff_normalize_login_phone('5447863402'), null, 'non-mobile leading digit rejected');
select is(private.staff_normalize_login_phone('0447863402'), null, 'leading zero rejected');
select is(private.staff_normalize_login_phone(''), null, 'empty rejected');
select is(private.staff_normalize_login_phone(null), null, 'null rejected');
select is(private.staff_normalize_login_phone('+447447863402'), null, 'non-Indian country code rejected');

-- -----------------------------------------------------------------------------
-- D. Fixtures — SM001-shaped employment plus real staff-domain rows
-- -----------------------------------------------------------------------------

insert into auth.users (id, instance_id, email, aud, role) values
  ('44aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '00000000-0000-0000-0000-000000000000', '44-sa@example.test', 'authenticated', 'authenticated'),
  ('44dddddd-dddd-4ddd-8ddd-dddddddddddd', '00000000-0000-0000-0000-000000000000', '44-mgr@example.test', 'authenticated', 'authenticated');

update public.profiles set status = 'active'
where id in ('44aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', '44dddddd-dddd-4ddd-8ddd-dddddddddddd');

insert into public.user_roles (user_id, role_id)
select '44aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa', id from public.roles where code = 'super_admin';
insert into public.user_roles (user_id, role_id)
select '44dddddd-dddd-4ddd-8ddd-dddddddddddd', id from public.roles where code = 'sales_manager';

-- Employment WITHOUT any auth user: exactly the SM001 production shape.
insert into public.profiles (id, display_name, phone_e164, status)
values ('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Anjali Sharma', '+917447863402', 'active');

insert into public.user_roles (user_id, role_id)
select '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', id from public.roles where code = 'sales_executive';

insert into public.attendance_policies (
  code, name, timezone, workday_start_local, workday_end_local,
  late_grace_minutes, half_day_threshold_minutes, missing_checkout_cutoff_local,
  weekly_off_days, location_required, is_current
) values (
  'cred_test', 'Credential test policy', 'Asia/Kolkata',
  time '09:00', time '18:00', 15, 240, time '23:59',
  array[]::smallint[], false, true
);

insert into public.staff_employment_profiles
  (staff_id, employee_code, designation, joining_date, attendance_eligible,
   attendance_policy_id, invite_reconciliation_state, access_state)
values
  ('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'SM001T', 'Executive', date '2026-01-01', true,
   (select id from public.attendance_policies where code = 'cred_test'), 'none', 'not_activated');

-- A second employee, used for the uniqueness contract.
insert into public.profiles (id, display_name, phone_e164, status)
values ('44cccccc-cccc-4ccc-8ccc-cccccccccccc', 'Other Staff', '+919876500001', 'active');
insert into public.user_roles (user_id, role_id)
select '44cccccc-cccc-4ccc-8ccc-cccccccccccc', id from public.roles where code = 'sales_executive';
insert into public.staff_employment_profiles
  (staff_id, employee_code, designation, joining_date, attendance_eligible, invite_reconciliation_state, access_state)
values
  ('44cccccc-cccc-4ccc-8ccc-cccccccccccc', 'SM002T', 'Executive', date '2026-01-01', false, 'none', 'not_activated');

-- Real staff-domain rows, so section K denies actual data rather than nothing.
insert into public.attendance_days
  (staff_id, attendance_date, primary_status, attendance_policy_id)
values
  ('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', date '2026-02-02', 'present',
   (select id from public.attendance_policies where code = 'cred_test'));

insert into public.attendance_events
  (staff_id, attendance_date, event_type, idempotency_key, attendance_policy_id)
values
  ('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', date '2026-02-02', 'check_in', 'cred-test-key-1',
   (select id from public.attendance_policies where code = 'cred_test'));

-- attendance_submissions and attendance_submission_events are produced by the
-- lifecycle trigger on attendance_events, so they are NOT inserted here; the
-- assertions below confirm the rows genuinely exist before revocation.

insert into public.leave_types (code, display_name) values ('cred_test_casual', 'Casual');

insert into public.leave_requests (staff_id, leave_type_id, start_date, end_date, reason)
values ('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb',
        (select id from public.leave_types where code = 'cred_test_casual'),
        date '2026-02-10', date '2026-02-10', 'Personal');

insert into public.salary_profiles (staff_id, monthly_base_salary_paise, effective_from, set_by)
values ('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 5000000, date '2026-01-01',
        '44aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa');

select is(
  (select access_state from public.staff_employment_profiles where employee_code = 'SM001T'),
  'not_activated',
  'employment exists with no credentials'
);
select is(
  (select login_phone_e164 from public.staff_employment_profiles where employee_code = 'SM001T'),
  null,
  'no login phone before issuance'
);

-- -----------------------------------------------------------------------------
-- E. Only a Super Admin may run a credential operation
-- -----------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '44dddddd-dddd-4ddd-8ddd-dddddddddddd';

select throws_ok(
  $q$select public.begin_staff_credential_operation('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'issue')$q$,
  '42501', 'STAFF_CREDENTIALS_UNAUTHORIZED',
  'a sales manager cannot begin an issuance'
);
select throws_ok(
  $q$select public.begin_staff_credential_operation('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'revoke', 'because')$q$,
  '42501', 'STAFF_CREDENTIALS_UNAUTHORIZED',
  'a sales manager cannot revoke access'
);
select throws_ok(
  $q$select public.complete_staff_credential_operation('00000000-0000-0000-0000-000000000000')$q$,
  '42501', 'STAFF_CREDENTIALS_UNAUTHORIZED',
  'a sales manager cannot finalize an operation'
);
select throws_ok(
  $q$select public.get_staff_credential_operation('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')$q$,
  '42501', 'STAFF_CREDENTIALS_UNAUTHORIZED',
  'a sales manager cannot read the operation ledger'
);
select ok(
  not (select public.authorize('staff.credentials.manage')),
  'a sales manager does not hold staff.credentials.manage'
);

-- -----------------------------------------------------------------------------
-- F. Issuance publishes NOTHING until Auth has succeeded
-- -----------------------------------------------------------------------------

set local request.jwt.claim.sub = '44aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

-- The username is derived from the employment record, never from the caller.
select is(
  (public.begin_staff_credential_operation(
     '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'issue', null, '9999999999') ->> 'loginUsername'),
  '7447863402',
  'issuance derives the username from the staff record and IGNORES a supplied phone'
);

select is(
  (select access_state from public.staff_employment_profiles where employee_code = 'SM001T'),
  'not_activated',
  'begin publishes no access state'
);
select is(
  (select login_phone_e164 from public.staff_employment_profiles where employee_code = 'SM001T'),
  null,
  'begin publishes no login phone'
);
select is(
  (select count(*)::integer from public.staff_admin_events
   where staff_id = '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
     and event_type = 'staff.credentials_issued'),
  0,
  'begin writes NO success audit'
);

-- Auth failure: nothing published, and the operation stays retryable.
select is(
  (public.fail_staff_credential_operation(
     (public.get_staff_credential_operation('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') ->> 'operationId')::uuid,
     'auth refused') ->> 'retryable'),
  'true',
  'a failed Auth step is recorded as retryable'
);
select is(
  (select access_state from public.staff_employment_profiles where employee_code = 'SM001T'),
  'not_activated',
  'a failed issuance leaves the staff member with no credentials'
);
select is(
  (select login_phone_e164 from public.staff_employment_profiles where employee_code = 'SM001T'),
  null,
  'a failed issuance reserves no published login phone'
);
select is(
  (public.get_staff_credential_operation('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') ->> 'status'),
  'failed',
  'the failure is durable and visible for retry'
);

select is(
  (public.begin_staff_credential_operation('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'issue') ->> 'loginUsername'),
  '7447863402',
  'issuance can simply be retried'
);

-- Simulate the Auth identity the server would have created, with the SAME uuid.
reset role;
insert into auth.users (id, instance_id, phone, aud, role)
values ('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', '917447863402', 'authenticated', 'authenticated');
set local role authenticated;
set local request.jwt.claim.sub = '44aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select is(
  (public.complete_staff_credential_operation(
     (public.get_staff_credential_operation('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') ->> 'operationId')::uuid
   ) ->> 'accessState'),
  'credentials_ready',
  'finalize publishes credentials_ready'
);

select is(
  (select login_phone_e164 from public.staff_employment_profiles where employee_code = 'SM001T'),
  '+917447863402',
  'the canonical +91 value is published only on finalize'
);
select isnt(
  (select credentials_issued_at from public.staff_employment_profiles where employee_code = 'SM001T'),
  null,
  'issuance timestamp recorded on finalize'
);
select is(
  (select staff_id from public.staff_employment_profiles where employee_code = 'SM001T'),
  '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
  'the staff UUID is unchanged by issuance'
);
-- auth.users is not readable by `authenticated`, so these two are asserted as
-- the owner. They are facts about the identity, not about RLS.
reset role;
select is(
  (select id from auth.users where phone = '917447863402'),
  '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
  'the Auth user carries the EXACT existing staff UUID'
);
select is(
  (select email from auth.users where id = '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  null,
  'a phone login needs no email — no alias is fabricated'
);
set local role authenticated;
set local request.jwt.claim.sub = '44aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select is(
  public.get_staff_credential_operation('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  null,
  'a completed operation is no longer outstanding'
);

select is(
  (select count(*)::integer from public.staff_admin_events
   where staff_id = '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
     and event_type = 'staff.credentials_issued'),
  1,
  'exactly one issuance audit record exists'
);

-- -----------------------------------------------------------------------------
-- G. Uniqueness and the missing-phone instruction
-- -----------------------------------------------------------------------------

reset role;
update public.profiles set phone_e164 = '+917447863402'
where id = '44cccccc-cccc-4ccc-8ccc-cccccccccccc';
set local role authenticated;
set local request.jwt.claim.sub = '44aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select throws_ok(
  $q$select public.begin_staff_credential_operation('44cccccc-cccc-4ccc-8ccc-cccccccccccc', 'issue')$q$,
  'P0001', 'STAFF_LOGIN_PHONE_CONFLICT',
  'a second staff member cannot claim the same login number'
);

reset role;
update public.profiles set phone_e164 = null where id = '44cccccc-cccc-4ccc-8ccc-cccccccccccc';
set local role authenticated;
set local request.jwt.claim.sub = '44aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select throws_ok(
  $q$select public.begin_staff_credential_operation('44cccccc-cccc-4ccc-8ccc-cccccccccccc', 'issue')$q$,
  'P0001', 'STAFF_LOGIN_PHONE_MISSING',
  'issuance refuses when the employment record has no valid mobile number'
);

-- -----------------------------------------------------------------------------
-- H. credentials_ready becomes active ONLY after a genuine sign-in
-- -----------------------------------------------------------------------------

set local request.jwt.claim.sub = '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select is(
  (public.record_staff_first_login() ->> 'accessState'),
  'credentials_ready',
  'with no sign-in evidence the state does not move'
);

reset role;
update auth.users set last_sign_in_at = now() where id = '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';
set local role authenticated;
set local request.jwt.claim.sub = '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select is(
  (public.record_staff_first_login() ->> 'accessState'),
  'active',
  'a genuine sign-in promotes credentials_ready to active'
);

reset role;
select ok(
  exists (
    select 1 from public.staff_admin_events
    where staff_id = '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
      and event_type = 'staff.login_first_success'
  ),
  'first successful login is audited'
);
set local role authenticated;
set local request.jwt.claim.sub = '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

-- -----------------------------------------------------------------------------
-- I. An ACTIVE staff member really can read their own staff-domain rows
-- -----------------------------------------------------------------------------
--
-- Asserted first so section K proves a change in behaviour rather than a
-- permission that never worked.

select ok((select count(*) from public.attendance_days) > 0,
  'active staff can read their own attendance days');
select ok((select count(*) from public.attendance_events) > 0,
  'active staff can read their own attendance events');
select ok((select count(*) from public.attendance_submissions) > 0,
  'active staff can read their own attendance submissions');
select ok((select count(*) from public.attendance_submission_events) > 0,
  'active staff can read their own submission events');
select ok((select count(*) from public.leave_requests) > 0,
  'active staff can read their own leave requests');
select ok((select count(*) from public.staff_employment_profiles) > 0,
  'active staff can read their own employment record');
select is((select count(*)::integer from public.profiles where id = (select auth.uid())), 1,
  'active staff can read their own profile');
select ok((select count(*) from public.salary_profiles) > 0,
  'active staff can read their own salary profile');

select is(
  (select auth.uid()),
  '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
  'auth.uid() equals the employment UUID after phone login'
);
select ok(
  (select public.authorize('attendance.self')),
  'a credentialed staff member can use self-attendance'
);

-- -----------------------------------------------------------------------------
-- J. Revoke denies IMMEDIATELY, before the Auth step
-- -----------------------------------------------------------------------------

set local request.jwt.claim.sub = '44aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select throws_ok(
  $q$select public.begin_staff_credential_operation('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'revoke', 'x')$q$,
  'P0001', 'STAFF_REASON_REQUIRED',
  'revocation demands a real reason'
);

select is(
  (public.begin_staff_credential_operation(
     '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'revoke', 'Left the company') ->> 'accessState'),
  'revoked',
  'revocation denies at BEGIN, without waiting for Auth'
);

select isnt(
  (select access_revoked_at from public.staff_employment_profiles where employee_code = 'SM001T'),
  null,
  'revocation timestamp recorded'
);

select is(
  (select status from public.profiles where id = '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  'active',
  'employment status is untouched by revocation'
);

select is(
  (public.fail_staff_credential_operation(
     (public.get_staff_credential_operation('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') ->> 'operationId')::uuid,
     'ban refused') ->> 'accessState'),
  'revoked',
  'a failed ban leaves access revoked, never restored'
);
select is(
  (select count(*)::integer from public.staff_admin_events
   where staff_id = '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
     and event_type = 'staff.access_revoked'
     and details ->> 'sessionsInvalidated' = 'true'),
  0,
  'no audit record claims sessions were invalidated when the ban failed'
);

-- -----------------------------------------------------------------------------
-- K. THE CORE PROOF — a revoked staff member with a valid JWT reads NOTHING
-- -----------------------------------------------------------------------------
--
-- Direct table SELECTs through RLS, with the revoked staff member's own claim
-- set. This is the path a stale access token would take.

set local request.jwt.claim.sub = '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select is((select count(*)::integer from public.attendance_days), 0,
  'REVOKED: direct SELECT on attendance_days returns nothing');
select is((select count(*)::integer from public.attendance_events), 0,
  'REVOKED: direct SELECT on attendance_events returns nothing');
select is((select count(*)::integer from public.attendance_submissions), 0,
  'REVOKED: direct SELECT on attendance_submissions returns nothing');
select is((select count(*)::integer from public.attendance_submission_events), 0,
  'REVOKED: direct SELECT on attendance_submission_events returns nothing');
select is((select count(*)::integer from public.leave_requests), 0,
  'REVOKED: direct SELECT on leave_requests returns nothing');
select is((select count(*)::integer from public.staff_employment_profiles), 0,
  'REVOKED: direct SELECT on staff_employment_profiles returns nothing');
select is((select count(*)::integer from public.profiles), 0,
  'REVOKED: direct SELECT on profiles returns nothing, including their own row');
select is((select count(*)::integer from public.salary_profiles), 0,
  'REVOKED: direct SELECT on salary_profiles returns nothing');

select ok(
  not (select public.authorize('attendance.self')),
  'REVOKED: every permission is denied as well'
);
select ok(
  not (select public.authorize('leave.self')),
  'REVOKED: revocation is not permission-specific'
);
select throws_ok(
  $q$select public.sync_staff_access_states(null)$q$,
  '42501', 'STAFF_ACCESS_REVOKED',
  'REVOKED: staff RPCs refuse the actor before any permission check'
);

select is(
  (public.record_staff_first_login() ->> 'accessState'),
  'revoked',
  'REVOKED: signing in cannot re-activate the account'
);

-- -----------------------------------------------------------------------------
-- L. A Super Admin must still see the revoked employee
-- -----------------------------------------------------------------------------

set local request.jwt.claim.sub = '44aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select is((select count(*)::integer from public.staff_employment_profiles
           where staff_id = '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 1,
  'a Super Admin still reads the revoked employee employment record');
select is((select count(*)::integer from public.attendance_days
           where staff_id = '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 1,
  'a Super Admin still reads the revoked employee attendance');
select is((select count(*)::integer from public.salary_profiles
           where staff_id = '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'), 1,
  'a Super Admin still reads the revoked employee salary profile');

select lives_ok(
  $q$select public.sync_staff_access_states(null)$q$,
  'the access-state reconciler runs'
);
select is(
  (select access_state from public.staff_employment_profiles where employee_code = 'SM001T'),
  'revoked',
  'sync does NOT flip a revoked account back to active on sign-in evidence'
);

-- -----------------------------------------------------------------------------
-- M. Reactivation: DB stays revoked until Auth has been re-enabled
-- -----------------------------------------------------------------------------

select is(
  (public.begin_staff_credential_operation(
     '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'reactivate', 'Rejoined') ->> 'accessState'),
  'revoked',
  'reactivation publishes nothing at begin'
);

select is(
  (public.fail_staff_credential_operation(
     (public.get_staff_credential_operation('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') ->> 'operationId')::uuid,
     'unban refused') ->> 'accessState'),
  'revoked',
  'a failed Auth re-enable leaves the account revoked'
);

select is(
  (select count(*)::integer from public.staff_admin_events
   where staff_id = '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
     and event_type = 'staff.access_reactivated'),
  0,
  'a failed reactivation writes no reactivation audit'
);

select lives_ok(
  $q$select public.begin_staff_credential_operation(
      '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'reactivate', 'Rejoined')$q$,
  'reactivation can be retried'
);
select is(
  (public.complete_staff_credential_operation(
     (public.get_staff_credential_operation('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') ->> 'operationId')::uuid
   ) ->> 'accessState'),
  'active',
  'finalize restores the state the sign-in evidence supports'
);
select is(
  (select access_revoked_at from public.staff_employment_profiles where employee_code = 'SM001T'),
  null,
  'the revocation timestamp is cleared'
);
select is(
  (select login_phone_e164 from public.staff_employment_profiles where employee_code = 'SM001T'),
  '+917447863402',
  'reactivation does not change the login number'
);

-- -----------------------------------------------------------------------------
-- N. Password reset writes nothing until Auth accepts it
-- -----------------------------------------------------------------------------

reset role;
update public.staff_employment_profiles set credentials_password_set_at = null
where employee_code = 'SM001T';
set local role authenticated;
set local request.jwt.claim.sub = '44aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select lives_ok(
  $q$select public.begin_staff_credential_operation(
      '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'password_reset')$q$,
  'a password reset can be prepared'
);
select is(
  (select credentials_password_set_at from public.staff_employment_profiles where employee_code = 'SM001T'),
  null,
  'begin writes NO password-set timestamp'
);

select lives_ok(
  $q$select public.fail_staff_credential_operation(
      (public.get_staff_credential_operation('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') ->> 'operationId')::uuid,
      'auth rejected the new value')$q$,
  'a refused password reset is recorded'
);
select is(
  (select credentials_password_set_at from public.staff_employment_profiles where employee_code = 'SM001T'),
  null,
  'a FAILED reset leaves no password-set timestamp'
);
select is(
  (select count(*)::integer from public.staff_admin_events
   where staff_id = '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
     and event_type = 'staff.credentials_password_reset'),
  0,
  'a FAILED reset writes no audit claiming the password changed'
);

select lives_ok(
  $q$select public.begin_staff_credential_operation(
      '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'password_reset')$q$,
  'the reset can be retried'
);
select lives_ok(
  $q$select public.complete_staff_credential_operation(
      (public.get_staff_credential_operation('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') ->> 'operationId')::uuid)$q$,
  'a successful reset is finalized'
);
select isnt(
  (select credentials_password_set_at from public.staff_employment_profiles where employee_code = 'SM001T'),
  null,
  'only a successful reset records the timestamp'
);
select is(
  (select access_state from public.staff_employment_profiles where employee_code = 'SM001T'),
  'active',
  'a reset does not change the access state'
);
select is(
  (select login_phone_e164 from public.staff_employment_profiles where employee_code = 'SM001T'),
  '+917447863402',
  'a reset preserves the login phone'
);

-- -----------------------------------------------------------------------------
-- O. Changing the login phone cannot drift
-- -----------------------------------------------------------------------------

select is(
  (public.begin_staff_credential_operation(
     '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'change_phone', 'New number', '9812345678') ->> 'loginUsername'),
  '9812345678',
  'a phone change can be prepared'
);
select is(
  (select login_phone_e164 from public.staff_employment_profiles where employee_code = 'SM001T'),
  '+917447863402',
  'begin does NOT publish the new number while Auth still has the old one'
);

select is(
  (public.fail_staff_credential_operation(
     (public.get_staff_credential_operation('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') ->> 'operationId')::uuid,
     'ban refused') ->> 'failClosed'),
  'true',
  'an incomplete phone change fails closed'
);
select is(
  (select access_state from public.staff_employment_profiles where employee_code = 'SM001T'),
  'revoked',
  'access is revoked rather than left ambiguous between old and new numbers'
);
select is(
  (select count(*)::integer from public.staff_admin_events
   where staff_id = '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'
     and event_type = 'staff.login_phone_changed'),
  0,
  'a failed phone change writes no success audit'
);

select lives_ok(
  $q$select public.begin_staff_credential_operation(
      '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'reactivate', 'Recovered')$q$,
  'the account can be reactivated after a failed phone change'
);
select lives_ok(
  $q$select public.complete_staff_credential_operation(
      (public.get_staff_credential_operation('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') ->> 'operationId')::uuid)$q$,
  'reactivation completes'
);

select lives_ok(
  $q$select public.begin_staff_credential_operation(
      '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'change_phone', 'New number', '9812345678')$q$,
  'the phone change can be retried'
);
select lives_ok(
  $q$select public.complete_staff_credential_operation(
      (public.get_staff_credential_operation('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') ->> 'operationId')::uuid)$q$,
  'the phone change is finalized'
);

select is(
  (select login_phone_e164 from public.staff_employment_profiles where employee_code = 'SM001T'),
  '+919812345678',
  'the new canonical number is published on finalize'
);
select is(
  (select count(*)::integer from public.staff_employment_profiles
   where login_phone_e164 = '+917447863402'),
  0,
  'the previous number stops being a login identifier'
);
select is(
  (select phone_e164 from public.profiles where id = '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  '+919812345678',
  'the employment phone follows the login phone in the same transaction'
);
select is(
  (select staff_id from public.staff_employment_profiles where employee_code = 'SM001T'),
  '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
  'changing the number does not change the UUID'
);

select throws_ok(
  $q$select public.begin_staff_credential_operation(
      '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'change_phone', 'again', '9812345678')$q$,
  'P0001', 'STAFF_LOGIN_PHONE_UNCHANGED',
  'changing to the same number is refused'
);
select throws_ok(
  $q$select public.begin_staff_credential_operation(
      '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'change_phone', 'bad', '12345')$q$,
  'P0001', 'STAFF_LOGIN_PHONE_INVALID',
  'an invalid new number is refused'
);

-- -----------------------------------------------------------------------------
-- P. Ordinary employment edits can never move a credentialed login
-- -----------------------------------------------------------------------------

reset role;

select throws_ok(
  $q$update public.profiles set phone_e164 = '+919999999999'
     where id = '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'$q$,
  'P0001', 'STAFF_LOGIN_PHONE_LOCKED',
  'an ordinary employment edit cannot silently move the login identity'
);

select is(
  (select phone_e164 from public.profiles where id = '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  '+919812345678',
  'the blocked edit changed nothing'
);

select lives_ok(
  $q$update public.profiles set phone_e164 = '+919876500002'
     where id = '44cccccc-cccc-4ccc-8ccc-cccccccccccc'$q$,
  'phone stays ordinary employment data while no login exists'
);

-- -----------------------------------------------------------------------------
-- Q. Audit trail: complete, and free of secrets
-- -----------------------------------------------------------------------------

select is(
  (select string_agg(distinct event_type, ',' order by event_type)
   from public.staff_admin_events
   where staff_id = '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  'staff.access_reactivated,staff.access_revoked,staff.credential_operation_failed,staff.credentials_issued,staff.credentials_password_reset,staff.login_first_success,staff.login_phone_changed',
  'every credential lifecycle event, including failures, is audited'
);

select is(
  (select count(*)::integer from public.staff_admin_events
   where details::text ~* '(passwd|secret|bearer|authorization|service_role)'),
  0,
  'no audit record contains password material or a service-role token'
);

select is(
  (select count(*)::integer from private.staff_credential_operations
   where coalesce(last_error, '') ~* '(passwd|secret|bearer|authorization|service_role)'),
  0,
  'no ledger row contains password material or a service-role token'
);

select ok(
  exists (
    select 1 from public.staff_admin_events
    where event_type = 'staff.access_revoked'
      and details ->> 'reason' = 'Left the company'
  ),
  'the revocation reason is recorded'
);

-- -----------------------------------------------------------------------------
-- R. Future self-service OTP needs no schema replacement
-- -----------------------------------------------------------------------------

select is(
  (select right(sep.login_phone_e164, 10)
   from public.staff_employment_profiles sep
   where sep.employee_code = 'SM001T'),
  '9812345678',
  'the OTP username is derived from the same canonical phone, not a second field'
);

select is(
  (select count(*)::integer
   from information_schema.columns
   where table_schema = 'public'
     and table_name = 'staff_employment_profiles'
     and column_name ~* '(login_id|username|login_code)'),
  0,
  'no separate numeric login id column was introduced'
);

select * from finish();
rollback;
