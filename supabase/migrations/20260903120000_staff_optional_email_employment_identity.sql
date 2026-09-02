-- ONEDECORE Workforce V1 — staff creation without an email address
--
-- Forward-only. Separates EMPLOYMENT identity from LOGIN identity with the
-- smallest change that makes an employment record possible before (or without)
-- app access.
--
-- ARCHITECTURE
-- ------------
-- Before this migration the chain was hard-welded:
--
--   staff_employment_profiles.staff_id -> profiles.id -> auth.users.id
--
-- `profiles.id` had a NOT NULL foreign key to `auth.users(id)`, so an employment
-- record could not exist until an auth user existed, and an auth user cannot be
-- created without an email or phone (GoTrue v2.193.1 rejects it outright:
-- "Cannot create a user without either an email or phone"). Email was therefore
-- structurally mandatory, not merely required by the form.
--
-- 130 foreign keys point at `profiles.id`, so that column MUST remain the stable
-- workforce key. This migration therefore keeps `profiles.id` exactly where it
-- is and only removes its dependency on `auth.users`:
--
--   * `profiles.id` becomes the EMPLOYMENT identity, allocated by ONEDECORE and
--     stable for the life of the employee.
--   * `auth.users.id` becomes the LOGIN identity, created later WITH THE SAME
--     UUID when app access is activated. GoTrue honours an explicit `id` on
--     admin user creation, so the two identities converge without ever changing
--     `profiles.id` and without touching a single foreign key or RLS policy.
--
-- Consequences, deliberately chosen:
--
--   * A staff member with no app access has NO row in `auth.users`. `auth.uid()`
--     can therefore never equal their `profiles.id`, so every existing RLS
--     policy that compares the two denies them by construction. Access is
--     fail-closed with no policy rewrite.
--   * `public.authorize`, all 130 foreign keys, and every existing policy are
--     left untouched.
--   * Dropping `profiles_id_fkey` also drops its ON DELETE CASCADE. Deleting an
--     auth user no longer deletes the employment record. For an HR system that
--     is the safer behaviour: employment history, attendance and salary survive
--     the removal of a login. Staff are retired through `profiles.status`
--     (`suspended` / `disabled`), never by deleting rows.
--
-- NO placeholder or generated email address is ever produced.

-- -----------------------------------------------------------------------------
-- A. Employment identity no longer requires a login identity
-- -----------------------------------------------------------------------------

alter table public.profiles
  drop constraint if exists profiles_id_fkey;

comment on column public.profiles.id is
  'Stable EMPLOYMENT identity allocated by ONEDECORE. Equals auth.users.id once app access is activated; until then no auth user exists and auth.uid() can never match, so access is fail-closed.';

comment on column public.profiles.status is
  'EMPLOYMENT status (pending/active/suspended/disabled). Independent of app access, which is tracked by staff_employment_profiles.access_state.';

-- Roles attach to the EMPLOYMENT identity, not the login identity: a staff
-- member without app access still holds an operational role. `user_roles.user_id`
-- pointed at auth.users, which made that impossible, so it is repointed at
-- profiles. Every existing row is unaffected because profiles.id equals
-- auth.users.id for all currently-provisioned staff.
--
-- `user_roles.assigned_by` is deliberately left pointing at auth.users: the
-- actor performing an assignment is always a signed-in user.
alter table public.user_roles
  drop constraint if exists user_roles_user_id_fkey;

alter table public.user_roles
  add constraint user_roles_user_id_fkey
  foreign key (user_id) references public.profiles (id) on delete cascade;

-- -----------------------------------------------------------------------------
-- B. Explicit app-access state
-- -----------------------------------------------------------------------------

alter table public.staff_employment_profiles
  add column if not exists access_state text not null default 'not_activated';

alter table public.staff_employment_profiles
  drop constraint if exists chk_staff_employment_profiles_access_state;

alter table public.staff_employment_profiles
  add constraint chk_staff_employment_profiles_access_state check (
    access_state = any (array['not_activated', 'invited', 'active'])
  );

comment on column public.staff_employment_profiles.access_state is
  'LOGIN identity state: not_activated (no auth user), invited (email attached, invite sent), active (has signed in). Separate from employment status and from invite_reconciliation_state, which stays the saga reconciliation marker.';

-- Every staff record that exists today came through the email invite saga and
-- therefore already owns an auth user.
update public.staff_employment_profiles sep
set access_state = case
  when exists (select 1 from auth.users u where u.id = sep.staff_id) then 'active'
  else 'invited'
end;

create index if not exists idx_staff_employment_profiles_access_state
  on public.staff_employment_profiles (access_state);

-- -----------------------------------------------------------------------------
-- B2. Audit vocabulary for the no-invite lifecycle
-- -----------------------------------------------------------------------------

alter table public.staff_admin_events
  drop constraint if exists chk_staff_admin_events_type;

alter table public.staff_admin_events
  add constraint chk_staff_admin_events_type check (
    event_type = any (array[
      'staff.created',
      'staff.invited',
      'staff.invite_resent',
      'staff.role_changed',
      'staff.manager_changed',
      'staff.status_changed',
      'staff.employment_updated',
      'staff.reconciliation_updated',
      -- Workforce V1: employment created with no login identity, and the
      -- later attach/confirm of app access.
      'staff.created_without_invite',
      'staff.app_access_attached',
      'staff.app_access_activated'
    ])
  );

-- -----------------------------------------------------------------------------
-- C. Direct creation without an invitation
-- -----------------------------------------------------------------------------

/**
 * Creates an employment record with NO email and NO auth user.
 *
 * Mirrors the validation performed by `prepare_staff_invite_saga` so the two
 * creation paths cannot diverge, but completes in a single transaction because
 * there is no external auth call to coordinate. Idempotent on employee code.
 */
create or replace function public.create_staff_member_without_invite(
  p_client_request_id uuid,
  p_employee_code text,
  p_display_name text,
  p_phone_e164 text,
  p_designation text,
  p_joining_date date,
  p_role_code text,
  p_reporting_manager_id uuid,
  p_attendance_eligible boolean,
  p_attendance_policy_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_staff_id uuid;
  v_role_id uuid;
  v_normalized_code text;
  v_existing uuid;
begin
  v_actor := private.staff_require_active_actor();

  if not (select public.authorize('staff.manage')) then
    raise exception 'ATTENDANCE_UNAUTHORIZED' using errcode = '42501';
  end if;

  if p_client_request_id is null then
    raise exception 'validation: client_request_id required' using errcode = '22023';
  end if;

  v_normalized_code := upper(trim(p_employee_code));

  if v_normalized_code is null or length(v_normalized_code) < 3 then
    raise exception 'validation: employee_code required' using errcode = '22023';
  end if;

  -- Idempotent replay: the same employee code returns the existing record
  -- rather than raising, so a retried submit cannot create a duplicate.
  select sep.staff_id into v_existing
  from public.staff_employment_profiles sep
  where sep.employee_code = v_normalized_code;

  if v_existing is not null then
    if exists (
      select 1 from public.staff_admin_events e
      where e.staff_id = v_existing
        and e.event_type = 'staff.created_without_invite'
        and e.details ->> 'clientRequestId' = p_client_request_id::text
    ) then
      return jsonb_build_object(
        'staffId', v_existing,
        'employeeCode', v_normalized_code,
        'accessState', 'not_activated',
        'invitationState', 'not_activated',
        'reconciliationState', 'none',
        'idempotentReplay', true
      );
    end if;
    raise exception 'employee_code already exists' using errcode = 'P0001';
  end if;

  if coalesce(p_attendance_eligible, false) and p_attendance_policy_id is null then
    raise exception 'ATTENDANCE_POLICY_MISSING' using errcode = 'P0001';
  end if;

  if p_role_code = 'sales_executive' and p_reporting_manager_id is null then
    raise exception 'sales_executive requires reporting manager' using errcode = 'P0001';
  end if;

  select r.id into v_role_id
  from public.roles r
  where r.code = p_role_code
    and r.is_active = true
    and r.code in ('sales_manager', 'sales_executive', 'project_manager', 'designer');

  if v_role_id is null then
    raise exception 'invalid role for staff assignment' using errcode = 'P0001';
  end if;

  if p_reporting_manager_id is not null and not exists (
    select 1 from public.profiles mp
    where mp.id = p_reporting_manager_id and mp.status = 'active'
  ) then
    raise exception 'reporting manager must be active' using errcode = 'P0001';
  end if;

  -- Fresh employment identity. Guaranteed not to collide with a login identity.
  loop
    v_staff_id := gen_random_uuid();
    exit when not exists (select 1 from auth.users u where u.id = v_staff_id)
          and not exists (select 1 from public.profiles p where p.id = v_staff_id);
  end loop;

  perform private.assert_no_reporting_cycle(v_staff_id, p_reporting_manager_id);

  -- Employment is active immediately; app access is not.
  insert into public.profiles (id, display_name, phone_e164, status)
  values (
    v_staff_id,
    trim(p_display_name),
    nullif(trim(coalesce(p_phone_e164, '')), ''),
    'active'
  );

  insert into public.user_roles (user_id, role_id, assigned_by)
  values (v_staff_id, v_role_id, v_actor);

  insert into public.staff_employment_profiles (
    staff_id, employee_code, designation, joining_date,
    reporting_manager_id, attendance_eligible, attendance_policy_id,
    invite_reconciliation_state, access_state
  )
  values (
    v_staff_id, v_normalized_code, trim(p_designation), p_joining_date,
    p_reporting_manager_id, coalesce(p_attendance_eligible, false),
    p_attendance_policy_id, 'none', 'not_activated'
  );

  perform private.staff_append_admin_event(
    v_staff_id, v_actor, 'staff.created_without_invite',
    jsonb_build_object(
      'clientRequestId', p_client_request_id,
      'employeeCode', v_normalized_code,
      'roleCode', p_role_code,
      'accessState', 'not_activated'
    )
  );

  return jsonb_build_object(
    'staffId', v_staff_id,
    'employeeCode', v_normalized_code,
    'accessState', 'not_activated',
    'invitationState', 'not_activated',
    'reconciliationState', 'none',
    'idempotentReplay', false
  );
end;
$$;

comment on function public.create_staff_member_without_invite(uuid, text, text, text, text, date, text, uuid, boolean, uuid) is
  'Creates an employment record with no email and no auth user. App access remains not_activated until a Super Admin attaches an identity.';

-- -----------------------------------------------------------------------------
-- D. Activating app access later
-- -----------------------------------------------------------------------------

/**
 * Marks a not-activated employee as invited.
 *
 * The caller then creates the auth user WITH THE SAME UUID as `p_staff_id`, so
 * the employment identity and the login identity converge and every existing
 * policy keeps working. Marking intent before the external call mirrors the
 * existing invite saga and keeps a failed attempt retryable.
 */
create or replace function public.attach_staff_app_access(
  p_staff_id uuid,
  p_email text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_sep public.staff_employment_profiles%rowtype;
  v_email text;
begin
  v_actor := private.staff_require_active_actor();

  if not (select public.authorize('staff.manage')) then
    raise exception 'ATTENDANCE_UNAUTHORIZED' using errcode = '42501';
  end if;

  v_email := lower(trim(coalesce(p_email, '')));

  if v_email = '' or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'STAFF_EMAIL_INVALID' using errcode = 'P0001';
  end if;

  select * into v_sep
  from public.staff_employment_profiles
  where staff_id = p_staff_id
  for update;

  if not found then
    raise exception 'employment profile not found' using errcode = 'P0002';
  end if;

  if v_sep.access_state = 'active' then
    raise exception 'STAFF_ACCESS_ALREADY_ACTIVE' using errcode = 'P0001';
  end if;

  -- A login identity must not already exist for this employment identity.
  if exists (select 1 from auth.users u where u.id = p_staff_id) then
    raise exception 'STAFF_ACCESS_ALREADY_ACTIVE' using errcode = 'P0001';
  end if;

  update public.staff_employment_profiles
  set access_state = 'invited', updated_at = now()
  where staff_id = p_staff_id;

  perform private.staff_append_admin_event(
    p_staff_id, v_actor, 'staff.app_access_attached',
    jsonb_build_object('accessState', 'invited')
  );

  return jsonb_build_object(
    'staffId', p_staff_id,
    'accessState', 'invited',
    'email', v_email
  );
end;
$$;

/** Confirms the login identity now exists and matches the employment identity. */
create or replace function public.confirm_staff_app_access(p_staff_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
begin
  v_actor := private.staff_require_active_actor();

  if not (select public.authorize('staff.manage')) then
    raise exception 'ATTENDANCE_UNAUTHORIZED' using errcode = '42501';
  end if;

  if not exists (select 1 from auth.users u where u.id = p_staff_id) then
    raise exception 'STAFF_ACCESS_NOT_PROVISIONED' using errcode = 'P0001';
  end if;

  update public.staff_employment_profiles
  set access_state = 'active', updated_at = now()
  where staff_id = p_staff_id;

  perform private.staff_append_admin_event(
    p_staff_id, v_actor, 'staff.app_access_activated',
    jsonb_build_object('accessState', 'active')
  );

  return jsonb_build_object('staffId', p_staff_id, 'accessState', 'active');
end;
$$;

-- -----------------------------------------------------------------------------
-- E. Grants
-- -----------------------------------------------------------------------------

revoke all on function public.create_staff_member_without_invite(uuid, text, text, text, text, date, text, uuid, boolean, uuid) from public, anon;
revoke all on function public.attach_staff_app_access(uuid, text) from public, anon;
revoke all on function public.confirm_staff_app_access(uuid) from public, anon;

grant execute on function public.create_staff_member_without_invite(uuid, text, text, text, text, date, text, uuid, boolean, uuid) to authenticated;
grant execute on function public.attach_staff_app_access(uuid, text) to authenticated;
grant execute on function public.confirm_staff_app_access(uuid) to authenticated;

alter function public.create_staff_member_without_invite(uuid, text, text, text, text, date, text, uuid, boolean, uuid) owner to postgres;
alter function public.attach_staff_app_access(uuid, text) owner to postgres;
alter function public.confirm_staff_app_access(uuid) owner to postgres;
