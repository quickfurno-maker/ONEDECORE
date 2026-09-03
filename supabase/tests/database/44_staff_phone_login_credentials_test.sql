-- ONEDECORE Workforce V1 — staff phone login + Super Admin credential control
--
-- `auth.users.phone` values below are stored WITHOUT the leading "+", which is
-- how GoTrue v2.193.1 actually persists them (verified on a live stack:
-- +917447863402 comes back as "917447863402"). The fixtures mirror production
-- rather than an idealised shape, so the uniqueness checks are meaningful.

begin;
select plan(83);

-- -----------------------------------------------------------------------------
-- A. Credential metadata exists and is constrained
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
  exists (
    select 1 from pg_indexes
    where schemaname = 'public' and indexname = 'uq_staff_employment_profiles_login_phone'
  ),
  'login phone has a unique index'
);

-- The four owner-locked states, and nothing else.
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

-- Everything else is rejected rather than repaired.
select is(private.staff_normalize_login_phone('744786340'), null, '9 digits rejected');
select is(private.staff_normalize_login_phone('74478634021'), null, '11 digits rejected');
select is(private.staff_normalize_login_phone('5447863402'), null, 'non-mobile leading digit rejected');
select is(private.staff_normalize_login_phone('0447863402'), null, 'leading zero rejected');
select is(private.staff_normalize_login_phone(''), null, 'empty rejected');
select is(private.staff_normalize_login_phone(null), null, 'null rejected');
select is(private.staff_normalize_login_phone('+447447863402'), null, 'non-Indian country code rejected');

-- -----------------------------------------------------------------------------
-- D. Fixtures — SM001-shaped employment with no login identity
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

insert into public.staff_employment_profiles
  (staff_id, employee_code, designation, joining_date, attendance_eligible, invite_reconciliation_state, access_state)
values
  ('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'SM001T', 'Executive', date '2026-01-01', false, 'none', 'not_activated');

-- A second employee, used for the uniqueness contract.
insert into public.profiles (id, display_name, status)
values ('44cccccc-cccc-4ccc-8ccc-cccccccccccc', 'Other Staff', 'active');
insert into public.user_roles (user_id, role_id)
select '44cccccc-cccc-4ccc-8ccc-cccccccccccc', id from public.roles where code = 'sales_executive';
insert into public.staff_employment_profiles
  (staff_id, employee_code, designation, joining_date, attendance_eligible, invite_reconciliation_state, access_state)
values
  ('44cccccc-cccc-4ccc-8ccc-cccccccccccc', 'SM002T', 'Executive', date '2026-01-01', false, 'none', 'not_activated');

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
-- E. Only a Super Admin may administer credentials
-- -----------------------------------------------------------------------------

set local role authenticated;
set local request.jwt.claim.sub = '44dddddd-dddd-4ddd-8ddd-dddddddddddd';

select throws_ok(
  $q$select public.issue_staff_credentials('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '7447863402')$q$,
  '42501', 'STAFF_CREDENTIALS_UNAUTHORIZED',
  'a sales manager cannot issue credentials'
);
select throws_ok(
  $q$select public.record_staff_password_reset('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb')$q$,
  '42501', 'STAFF_CREDENTIALS_UNAUTHORIZED',
  'a sales manager cannot reset a password'
);
select throws_ok(
  $q$select public.revoke_staff_access('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'because')$q$,
  '42501', 'STAFF_CREDENTIALS_UNAUTHORIZED',
  'a sales manager cannot revoke access'
);
select throws_ok(
  $q$select public.reactivate_staff_access('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'because')$q$,
  '42501', 'STAFF_CREDENTIALS_UNAUTHORIZED',
  'a sales manager cannot reactivate access'
);
select throws_ok(
  $q$select public.change_staff_login_phone('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '9812345678', 'because')$q$,
  '42501', 'STAFF_CREDENTIALS_UNAUTHORIZED',
  'a sales manager cannot change a login phone'
);

select ok(
  not (select public.authorize('staff.credentials.manage')),
  'a sales manager does not hold staff.credentials.manage'
);

-- -----------------------------------------------------------------------------
-- F. Issuance
-- -----------------------------------------------------------------------------

set local request.jwt.claim.sub = '44aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select throws_ok(
  $q$select public.issue_staff_credentials('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '744786340')$q$,
  'P0001', 'STAFF_LOGIN_PHONE_INVALID',
  'an invalid mobile number is refused'
);

select is(
  (public.issue_staff_credentials('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '7447863402') ->> 'loginUsername'),
  '7447863402',
  'the username shown to staff is the 10 digits they type'
);

select is(
  (select login_phone_e164 from public.staff_employment_profiles where employee_code = 'SM001T'),
  '+917447863402',
  'the canonical +91 value is what gets stored'
);

select is(
  (select access_state from public.staff_employment_profiles where employee_code = 'SM001T'),
  'credentials_ready',
  'issuance moves the state to credentials_ready, NOT active'
);

select isnt(
  (select credentials_issued_at from public.staff_employment_profiles where employee_code = 'SM001T'),
  null,
  'issuance timestamp recorded'
);

-- The permanent identity never moves.
select is(
  (select staff_id from public.staff_employment_profiles where employee_code = 'SM001T'),
  '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
  'the staff UUID is unchanged by issuance'
);

-- Employee code and work email are never login identifiers.
select is(
  (select count(*)::integer from public.staff_employment_profiles
   where login_phone_e164 = employee_code),
  0,
  'employee code is never used as the username'
);

-- -----------------------------------------------------------------------------
-- G. Uniqueness across credential-enabled staff
-- -----------------------------------------------------------------------------

select throws_ok(
  $q$select public.issue_staff_credentials('44cccccc-cccc-4ccc-8ccc-cccccccccccc', '7447863402')$q$,
  'P0001', 'STAFF_LOGIN_PHONE_CONFLICT',
  'a second staff member cannot claim the same login number'
);

select is(
  (select login_phone_e164 from public.staff_employment_profiles where employee_code = 'SM002T'),
  null,
  'the refused issuance wrote nothing'
);

-- Contact phone is NOT constrained: only credential-enabled logins are unique.
reset role;
update public.profiles set phone_e164 = '+919876500001' where id = '44cccccc-cccc-4ccc-8ccc-cccccccccccc';
select is(
  (select count(*)::integer from public.profiles where phone_e164 is not null),
  2,
  'ordinary contact numbers stay ordinary employment data'
);
set local role authenticated;
set local request.jwt.claim.sub = '44aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

-- -----------------------------------------------------------------------------
-- H. Work email stays independent of the login identity
-- -----------------------------------------------------------------------------

select is(
  (select count(*)::integer from public.staff_employment_profiles
   where staff_id = '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  1,
  'the employment record survives credential issuance untouched'
);

reset role;
-- Give the employee an auth identity with the SAME uuid and the canonical phone,
-- exactly as the Auth Admin call does.
insert into auth.users (id, instance_id, phone, aud, role)
values ('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '00000000-0000-0000-0000-000000000000', '917447863402', 'authenticated', 'authenticated');

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

-- -----------------------------------------------------------------------------
-- I. credentials_ready becomes active ONLY after a genuine sign-in
-- -----------------------------------------------------------------------------

select is(
  (select access_state from public.staff_employment_profiles where employee_code = 'SM001T'),
  'credentials_ready',
  'an existing Auth identity alone is not activation'
);

-- The staff member calls this themselves after signing in.
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
-- J. auth.uid() still drives attendance/RLS
-- -----------------------------------------------------------------------------

select is(
  (select auth.uid()),
  '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
  'auth.uid() equals the employment UUID after phone login'
);

select is(
  (select staff_id from public.staff_employment_profiles where staff_id = (select auth.uid())),
  (select auth.uid()),
  'attendance still resolves through auth.uid() = staff_id'
);

select ok(
  (select public.authorize('attendance.self')),
  'a credentialed staff member can use self-attendance'
);

-- -----------------------------------------------------------------------------
-- K. Revocation is enforced in the DATABASE
-- -----------------------------------------------------------------------------

set local request.jwt.claim.sub = '44aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

select throws_ok(
  $q$select public.revoke_staff_access('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'x')$q$,
  'P0001', 'STAFF_REASON_REQUIRED',
  'revocation demands a real reason'
);

select is(
  (public.revoke_staff_access('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Left the company') ->> 'accessState'),
  'revoked',
  'a Super Admin can revoke access'
);

select isnt(
  (select access_revoked_at from public.staff_employment_profiles where employee_code = 'SM001T'),
  null,
  'revocation timestamp recorded'
);

-- Employment is untouched: revoking a LOGIN is not firing someone.
select is(
  (select status from public.profiles where id = '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'),
  'active',
  'employment status is untouched by revocation'
);

-- The revoked staff member, with a perfectly valid session, can do nothing.
set local request.jwt.claim.sub = '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb';

select ok(
  not (select public.authorize('attendance.self')),
  'a revoked staff member loses every permission'
);
select ok(
  not (select public.authorize('leave.self')),
  'revocation is not permission-specific'
);
-- private.* is not executable by `authenticated`, so the guard is proven
-- through a PUBLIC rpc that passes through it — which is how staff reach it.
select throws_ok(
  $q$select public.sync_staff_access_states(null)$q$,
  '42501', 'STAFF_ACCESS_REVOKED',
  'staff RPCs refuse a revoked actor before any permission check'
);

-- Signing in again must never launder a revocation.
select is(
  (public.record_staff_first_login() ->> 'accessState'),
  'revoked',
  'a revoked account cannot re-activate itself by signing in'
);
select is(
  (select access_state from public.staff_employment_profiles where employee_code = 'SM001T'),
  'revoked',
  'the stored state is still revoked'
);

-- -----------------------------------------------------------------------------
-- L. The reconciler must never resurrect a revoked account
-- -----------------------------------------------------------------------------

set local request.jwt.claim.sub = '44aaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';

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
-- M. Reactivation restores capability without touching password or UUID
-- -----------------------------------------------------------------------------

select is(
  (public.reactivate_staff_access('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', 'Rejoined') ->> 'accessState'),
  'active',
  'reactivation restores the state the sign-in evidence supports'
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

select is(
  (select staff_id from public.staff_employment_profiles where employee_code = 'SM001T'),
  '44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb'::uuid,
  'reactivation does not change the UUID'
);

select throws_ok(
  $q$select public.reactivate_staff_access('44cccccc-cccc-4ccc-8ccc-cccccccccccc', 'nope')$q$,
  'P0001', 'STAFF_ACCESS_NOT_REVOKED',
  'reactivation refuses an account that is not revoked'
);

-- -----------------------------------------------------------------------------
-- N. Password reset preserves phone and UUID, and stores no secret
-- -----------------------------------------------------------------------------

select is(
  (public.record_staff_password_reset('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb') ->> 'loginPhone'),
  '+917447863402',
  'reset preserves the login phone'
);

select is(
  (select access_state from public.staff_employment_profiles where employee_code = 'SM001T'),
  'active',
  'reset does not change the access state'
);

select isnt(
  (select credentials_password_set_at from public.staff_employment_profiles where employee_code = 'SM001T'),
  null,
  'only a timestamp is recorded for the reset'
);

select throws_ok(
  $q$select public.record_staff_password_reset('44cccccc-cccc-4ccc-8ccc-cccccccccccc')$q$,
  'P0001', 'STAFF_CREDENTIALS_NOT_ISSUED',
  'a staff member with no credentials cannot have a password reset'
);

-- -----------------------------------------------------------------------------
-- O. Changing the login phone
-- -----------------------------------------------------------------------------

select is(
  (public.change_staff_login_phone('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '9812345678', 'New number') ->> 'loginUsername'),
  '9812345678',
  'the login phone can be changed by a Super Admin'
);

select is(
  (select login_phone_e164 from public.staff_employment_profiles where employee_code = 'SM001T'),
  '+919812345678',
  'the new canonical number is stored'
);

-- The OLD number must no longer identify anybody.
select is(
  (select count(*)::integer from public.staff_employment_profiles
   where login_phone_e164 = '+917447863402'),
  0,
  'the previous number stops being a login identifier'
);

-- Employment contact data moved with it, so the two cannot drift.
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
  $q$select public.change_staff_login_phone('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '9812345678', 'again')$q$,
  'P0001', 'STAFF_LOGIN_PHONE_UNCHANGED',
  'changing to the same number is refused'
);

select throws_ok(
  $q$select public.change_staff_login_phone('44bbbbbb-bbbb-4bbb-8bbb-bbbbbbbbbbbb', '12345', 'bad')$q$,
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

-- A staff member WITHOUT credentials keeps an ordinary editable phone.
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
  'staff.access_reactivated,staff.access_revoked,staff.credentials_issued,staff.credentials_password_reset,staff.login_first_success,staff.login_phone_changed',
  'every credential lifecycle event is audited'
);

select is(
  (select count(*)::integer from public.staff_admin_events
   where details::text ~* '(password|passwd|secret|bearer|authorization|service_role)'),
  0,
  'no audit record contains password material or a service-role token'
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
--
-- The OTP flow is: 10-digit username -> send OTP -> verify -> set password. It
-- needs a CONFIRMED canonical phone on the same identity, and no second
-- username field. Both hold here already.

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
