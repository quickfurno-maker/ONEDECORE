-- ONEDECORE Workforce V1 — staff phone login + Super Admin credential control
--
-- Forward-only. M23, M51, M52 and M53 are applied and are NOT edited; the
-- functions this migration replaces are replaced in place with
-- `create or replace`, which is how a correction ships under that discipline.
--
-- OWNER-LOCKED DECISION
-- ---------------------
-- Workforce staff authenticate with their own Indian mobile number.
--
--   staff-visible username : 7447863402        (exactly 10 digits)
--   canonical identifier   : +917447863402     (E.164, stored)
--   password               : Supabase Auth     (never this database)
--   permanent identity     : the existing staff UUID, unchanged forever
--
-- No separate numeric login id, no fabricated email alias, no password storage
-- and no custom session logic. `auth.uid()` continues to equal the employment
-- UUID, so all 130 foreign keys and every existing RLS policy keep working
-- untouched — this migration adds not one policy rewrite.
--
-- EMPLOYMENT vs LOGIN
-- -------------------
-- M52 separated employment identity (`profiles.id`) from login identity
-- (`auth.users.id`). That separation is preserved exactly:
--
--   * `profiles.phone_e164` stays ordinary employment/contact data.
--   * `staff_employment_profiles.login_phone_e164` is the CREDENTIAL username,
--     set only when credentials are issued.
--
-- Once credentials exist the two must not drift, so section F installs a
-- trigger that refuses any ordinary employment edit of the phone. Changing a
-- credentialed staff member's phone is only possible through
-- `change_staff_login_phone`, which updates both sides in one transaction.
--
-- NO PASSWORD MATERIAL — plaintext or hash — IS STORED IN ANY APPLICATION
-- TABLE OR ANY AUDIT PAYLOAD. Only lifecycle timestamps are recorded.

-- -----------------------------------------------------------------------------
-- A. Access-state vocabulary
-- -----------------------------------------------------------------------------
--
-- M52 shipped not_activated / invited / active for the email-invite path.
-- `invited` meant exactly "a login identity exists but nobody has ever signed
-- in", which is the owner's `credentials_ready`. The value is therefore renamed
-- rather than duplicated: two names for one state would force every consumer —
-- and the reconciler in section E — to guess which one to write.
--
--   not_activated    employment exists, no Auth credentials
--   credentials_ready Auth identity exists, staff has NEVER signed in
--   active            a genuine successful sign-in happened, access enabled
--   revoked           Super Admin disabled access

update public.staff_employment_profiles
set access_state = 'credentials_ready'
where access_state = 'invited';

alter table public.staff_employment_profiles
  drop constraint if exists chk_staff_employment_profiles_access_state;

alter table public.staff_employment_profiles
  add constraint chk_staff_employment_profiles_access_state check (
    access_state = any (array['not_activated', 'credentials_ready', 'active', 'revoked'])
  );

comment on column public.staff_employment_profiles.access_state is
  'LOGIN identity state: not_activated (no auth user), credentials_ready (auth identity exists, never signed in), active (genuine sign-in occurred), revoked (Super Admin disabled access). Separate from employment status and from invite_reconciliation_state.';

-- -----------------------------------------------------------------------------
-- B. Credential metadata — lifecycle only, never secrets
-- -----------------------------------------------------------------------------

alter table public.staff_employment_profiles
  add column if not exists login_phone_e164 text,
  add column if not exists credentials_issued_at timestamptz,
  add column if not exists credentials_password_set_at timestamptz,
  add column if not exists access_revoked_at timestamptz;

-- Indian mobile in E.164. The leading digit range is the real mobile range, so
-- landline and malformed input cannot become a login identifier.
alter table public.staff_employment_profiles
  drop constraint if exists chk_staff_employment_profiles_login_phone;

alter table public.staff_employment_profiles
  add constraint chk_staff_employment_profiles_login_phone check (
    login_phone_e164 is null or login_phone_e164 ~ '^\+91[6-9][0-9]{9}$'
  );

-- Uniqueness across credential-enabled staff only. Staff without credentials
-- hold NULL and are therefore not constrained, which is what allows two people
-- to share a contact number while only one of them can log in with it.
create unique index if not exists uq_staff_employment_profiles_login_phone
  on public.staff_employment_profiles (login_phone_e164)
  where login_phone_e164 is not null;

comment on column public.staff_employment_profiles.login_phone_e164 is
  'Canonical staff login username in E.164 (+91XXXXXXXXXX). Staff type the last 10 digits. NULL until credentials are issued. Unique among credential-enabled staff. Never the employee code and never the work email.';
comment on column public.staff_employment_profiles.credentials_issued_at is
  'When a Super Admin first issued phone/password credentials. Lifecycle audit only — no password or hash is ever stored here or anywhere else in this database.';
comment on column public.staff_employment_profiles.credentials_password_set_at is
  'When the password was last set or reset through Supabase Auth. Timestamp only.';
comment on column public.staff_employment_profiles.access_revoked_at is
  'When a Super Admin revoked application access. Cleared on reactivation.';

-- -----------------------------------------------------------------------------
-- C. Permission — credential administration is Super Admin ONLY
-- -----------------------------------------------------------------------------
--
-- A dedicated permission rather than reusing `staff.manage`: credential control
-- must never widen by accident if `staff.manage` is granted to another role
-- later. Sales Manager holds `staff.read` and does not receive this.

insert into public.permissions (code, name, description, is_active)
values (
  'staff.credentials.manage',
  'Manage staff login credentials',
  'Issue, reset, revoke, reactivate and re-point staff phone login credentials. Super Admin only.',
  true
)
on conflict (code) do update set is_active = true;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.code = 'super_admin'
  and p.code = 'staff.credentials.manage'
on conflict do nothing;

-- -----------------------------------------------------------------------------
-- D. Canonical phone contract, validated in ONE place
-- -----------------------------------------------------------------------------

create or replace function private.staff_normalize_login_phone(p_raw text)
returns text
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_digits text;
begin
  if p_raw is null then
    return null;
  end if;

  v_digits := regexp_replace(p_raw, '[^0-9]', '', 'g');

  -- Accept the 10-digit form staff type, and the canonical/pasted 12-digit
  -- +91 form. Nothing else: a 9- or 11-digit value is a typo, not a number to
  -- guess at.
  if length(v_digits) = 12 and left(v_digits, 2) = '91' then
    v_digits := right(v_digits, 10);
  end if;

  if v_digits !~ '^[6-9][0-9]{9}$' then
    return null;
  end if;

  return '+91' || v_digits;
end;
$$;

comment on function private.staff_normalize_login_phone(text) is
  'Single source of truth for the staff login phone contract: 10 Indian mobile digits (or the +91 12-digit form) canonicalized to +91XXXXXXXXXX. Returns NULL for anything else.';

revoke all on function private.staff_normalize_login_phone(text) from public, anon, authenticated;
alter function private.staff_normalize_login_phone(text) owner to postgres;

/** Raises unless the caller may administer staff credentials. */
create or replace function private.staff_require_credential_admin()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
begin
  v_actor := private.staff_require_active_actor();

  if not (select public.authorize('staff.credentials.manage')) then
    raise exception 'STAFF_CREDENTIALS_UNAUTHORIZED' using errcode = '42501';
  end if;

  return v_actor;
end;
$$;

revoke all on function private.staff_require_credential_admin() from public, anon, authenticated;
alter function private.staff_require_credential_admin() owner to postgres;

-- -----------------------------------------------------------------------------
-- E. Revocation is enforced in the DATABASE, not the UI
-- -----------------------------------------------------------------------------
--
-- `private.has_permission` is the single chokepoint behind `public.authorize`
-- and every RLS policy that uses it, so denying there disables a revoked staff
-- member everywhere at once with no policy rewrite. A staff member with no
-- employment row (the Super Admin) is unaffected: only an explicit `revoked`
-- row denies.

create or replace function private.has_permission(requested_permission text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_user_id uuid;
begin
  v_user_id := (select auth.uid());
  if v_user_id is null or requested_permission is null or trim(requested_permission) = '' then
    return false;
  end if;

  -- Revoked application access denies every permission, immediately, for as
  -- long as the state stands. Checked before the grant lookup so a revoked
  -- session cannot act on any surviving role grant.
  if exists (
    select 1
    from public.staff_employment_profiles sep
    where sep.staff_id = v_user_id
      and sep.access_state = 'revoked'
  ) then
    return false;
  end if;

  -- Reproduced VERBATIM from 20260725020833_enforce_active_staff_authorization,
  -- including the profiles join and `prof.status = 'active'`. That join is the
  -- hardening which stops a pending, suspended or disabled profile holding any
  -- permission, and replacing this function without it would silently undo it.
  return exists (
    select 1
    from public.user_roles ur
    join public.roles r on r.id = ur.role_id
    join public.role_permissions rp on rp.role_id = r.id
    join public.permissions p on p.id = rp.permission_id
    join public.profiles prof on prof.id = ur.user_id
    where ur.user_id = v_user_id
      and p.code = trim(requested_permission)
      and r.is_active = true
      and p.is_active = true
      and prof.status = 'active'
  );
end;
$$;

comment on function private.has_permission(text) is
  'Checks if current authenticated user with an active profile possesses a specific active permission code. Returns false outright for staff whose application access is revoked.';

-- Self-service staff RPCs (check-in, attendance submission) gate on the active
-- actor rather than on a permission, so revocation is enforced here too. This
-- keeps EMPLOYMENT status and APPLICATION ACCESS separate: a revoked staff
-- member is still employed, still paid, and still has attendance history.
create or replace function private.staff_require_active_actor()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
begin
  if v_actor is null then
    raise exception 'ATTENDANCE_UNAUTHORIZED' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_actor
      and p.status = 'active'
  ) then
    raise exception 'ATTENDANCE_INACTIVE_STAFF' using errcode = '42501';
  end if;

  if exists (
    select 1
    from public.staff_employment_profiles sep
    where sep.staff_id = v_actor
      and sep.access_state = 'revoked'
  ) then
    raise exception 'STAFF_ACCESS_REVOKED' using errcode = '42501';
  end if;

  return v_actor;
end;
$$;

comment on function private.staff_require_active_actor() is
  'Resolves the authenticated active staff actor. Refuses staff whose application access has been revoked.';

-- The BEFORE INSERT derivation must speak the new vocabulary.
create or replace function private.staff_derive_access_state()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  new.access_state := case
    when exists (
      select 1 from auth.users u
      where u.id = new.staff_id and u.last_sign_in_at is not null
    ) then 'active'
    when exists (select 1 from auth.users u where u.id = new.staff_id) then 'credentials_ready'
    else 'not_activated'
  end;
  return new;
end;
$$;

/**
 * Reconciles stored access_state with authoritative Auth sign-in evidence.
 *
 * Two rules matter here and both are security-relevant:
 *
 *   * `revoked` is NEVER overwritten. Without this a revoked staff member who
 *     had previously signed in would be silently restored to `active` by the
 *     next read, quietly undoing the revocation.
 *   * Activation is only ever MIRRORED from `auth.users.last_sign_in_at`. This
 *     function never invents activation and is not a second auth system.
 */
create or replace function public.sync_staff_access_states(p_staff_id uuid default null)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_updated integer;
begin
  perform private.staff_require_active_actor();

  if not (select public.authorize('staff.read')) then
    raise exception 'ATTENDANCE_UNAUTHORIZED' using errcode = '42501';
  end if;

  with derived as (
    select
      sep.staff_id,
      case
        when sep.access_state = 'revoked' then 'revoked'
        when exists (
          select 1 from auth.users u
          where u.id = sep.staff_id and u.last_sign_in_at is not null
        ) then 'active'
        when exists (select 1 from auth.users u where u.id = sep.staff_id) then 'credentials_ready'
        else 'not_activated'
      end as truth
    from public.staff_employment_profiles sep
    where p_staff_id is null or sep.staff_id = p_staff_id
  )
  update public.staff_employment_profiles sep
  set access_state = derived.truth, updated_at = now()
  from derived
  where derived.staff_id = sep.staff_id
    and sep.access_state is distinct from derived.truth;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

-- The M52 email-invite path wrote the old name. Replaced so both issuance
-- channels converge on one vocabulary.
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
  v_identity auth.users%rowtype;
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

  -- Revoked access is restored by reactivation, never by re-attaching.
  if v_sep.access_state = 'revoked' then
    raise exception 'STAFF_ACCESS_REVOKED' using errcode = 'P0001';
  end if;

  if v_sep.access_state = 'active' or exists (
    select 1 from auth.users u
    where u.id = p_staff_id and u.last_sign_in_at is not null
  ) then
    raise exception 'STAFF_ACCESS_ALREADY_ACTIVE' using errcode = 'P0001';
  end if;

  select * into v_identity from auth.users u where u.id = p_staff_id;

  if found then
    if lower(coalesce(v_identity.email, '')) <> v_email then
      raise exception 'STAFF_IDENTITY_CONFLICT' using errcode = 'P0001';
    end if;
  end if;

  if exists (
    select 1 from auth.users u
    where lower(coalesce(u.email, '')) = v_email and u.id <> p_staff_id
  ) then
    raise exception 'STAFF_IDENTITY_CONFLICT' using errcode = 'P0001';
  end if;

  update public.staff_employment_profiles
  set access_state = 'credentials_ready', updated_at = now()
  where staff_id = p_staff_id;

  perform private.staff_append_admin_event(
    p_staff_id, v_actor, 'staff.app_access_attached',
    jsonb_build_object(
      'accessState', 'credentials_ready',
      'identityExisted', v_identity.id is not null
    )
  );

  return jsonb_build_object(
    'staffId', p_staff_id,
    'accessState', 'credentials_ready',
    'email', v_email,
    'identityExists', v_identity.id is not null
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- F. Employment edits can never move the login identity
-- -----------------------------------------------------------------------------
--
-- `update_staff_employment` writes `profiles.phone_e164`. Once credentials
-- exist, letting an ordinary employment edit through would silently desync the
-- application from Supabase Auth — the exact drift the owner ruled out. A
-- trigger covers EVERY write path, not just the one RPC, so a future screen
-- cannot reintroduce the hole.
--
-- `change_staff_login_phone` sets a transaction-local flag before it writes,
-- which is why it is the only sanctioned route.

create or replace function private.staff_guard_login_phone_drift()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if coalesce(current_setting('onedecore.login_phone_change', true), '') = 'on' then
    return new;
  end if;

  if exists (
    select 1
    from public.staff_employment_profiles sep
    where sep.staff_id = new.id
      and sep.login_phone_e164 is not null
  ) then
    raise exception 'STAFF_LOGIN_PHONE_LOCKED' using errcode = 'P0001';
  end if;

  return new;
end;
$$;

comment on function private.staff_guard_login_phone_drift() is
  'Refuses an ordinary employment edit of profiles.phone_e164 once login credentials exist. Only change_staff_login_phone may move a credentialed phone, and it updates Supabase Auth in the same operation.';

drop trigger if exists trg_profiles_guard_login_phone_drift on public.profiles;

create trigger trg_profiles_guard_login_phone_drift
before update of phone_e164 on public.profiles
for each row
when (old.phone_e164 is distinct from new.phone_e164)
execute function private.staff_guard_login_phone_drift();

revoke all on function private.staff_guard_login_phone_drift() from public, anon, authenticated;
alter function private.staff_guard_login_phone_drift() owner to postgres;

-- -----------------------------------------------------------------------------
-- G. Audit vocabulary
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
      'staff.created_without_invite',
      'staff.app_access_attached',
      'staff.app_access_activated',
      -- Phone-login credential lifecycle. Payloads carry timestamps, states,
      -- reasons and phone numbers only — never password material.
      'staff.credentials_issued',
      'staff.credentials_password_reset',
      'staff.access_revoked',
      'staff.access_reactivated',
      'staff.login_phone_changed',
      'staff.login_first_success'
    ])
  );

-- -----------------------------------------------------------------------------
-- H. Credential lifecycle RPCs
-- -----------------------------------------------------------------------------
--
-- Every one of these records INTENT and AUDIT. None of them touches a password:
-- the password is handed straight to Supabase Auth by the server action and is
-- never seen by Postgres.
--
-- Order is deliberately database-first, mirroring the M52 invite saga. Claiming
-- `login_phone_e164` inside the transaction is what makes uniqueness real under
-- concurrency — two simultaneous issuances for the same number cannot both win
-- the unique index. If the Auth call then fails, the row sits at
-- `credentials_ready` with no auth user and `sync_staff_access_states` pulls it
-- back to `not_activated`, so a failed attempt is self-healing and retryable.

/**
 * Claims a login phone and marks credentials ready to be created in Auth.
 */
create or replace function public.issue_staff_credentials(
  p_staff_id uuid,
  p_phone text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_sep public.staff_employment_profiles%rowtype;
  v_phone text;
begin
  v_actor := private.staff_require_credential_admin();

  v_phone := private.staff_normalize_login_phone(p_phone);
  if v_phone is null then
    raise exception 'STAFF_LOGIN_PHONE_INVALID' using errcode = 'P0001';
  end if;

  select * into v_sep
  from public.staff_employment_profiles
  where staff_id = p_staff_id
  for update;

  if not found then
    raise exception 'STAFF_EMPLOYMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_sep.access_state = 'revoked' then
    raise exception 'STAFF_ACCESS_REVOKED' using errcode = 'P0001';
  end if;

  -- Already signed in at least once: use reset password, not re-issue.
  if v_sep.access_state = 'active' then
    raise exception 'STAFF_ACCESS_ALREADY_ACTIVE' using errcode = 'P0001';
  end if;

  -- The number must not already be a DIFFERENT staff member's login.
  if exists (
    select 1 from public.staff_employment_profiles other
    where other.login_phone_e164 = v_phone
      and other.staff_id <> p_staff_id
  ) then
    raise exception 'STAFF_LOGIN_PHONE_CONFLICT' using errcode = 'P0001';
  end if;

  -- Nor may it belong to another Auth identity.
  if exists (
    select 1 from auth.users u
    where u.phone = replace(v_phone, '+', '') and u.id <> p_staff_id
  ) then
    raise exception 'STAFF_LOGIN_PHONE_CONFLICT' using errcode = 'P0001';
  end if;

  update public.staff_employment_profiles
  set login_phone_e164 = v_phone,
      access_state = 'credentials_ready',
      credentials_issued_at = coalesce(credentials_issued_at, now()),
      credentials_password_set_at = now(),
      access_revoked_at = null,
      updated_at = now()
  where staff_id = p_staff_id;

  -- Employment contact phone follows the login phone, under the drift flag so
  -- the section F guard permits this one sanctioned write.
  perform set_config('onedecore.login_phone_change', 'on', true);
  update public.profiles set phone_e164 = v_phone, updated_at = now()
  where id = p_staff_id and phone_e164 is distinct from v_phone;
  perform set_config('onedecore.login_phone_change', 'off', true);

  perform private.staff_append_admin_event(
    p_staff_id, v_actor, 'staff.credentials_issued',
    jsonb_build_object(
      'accessState', 'credentials_ready',
      'loginPhone', v_phone,
      'reissued', v_sep.login_phone_e164 is not null
    )
  );

  return jsonb_build_object(
    'staffId', p_staff_id,
    'loginPhone', v_phone,
    'loginUsername', right(v_phone, 10),
    'accessState', 'credentials_ready'
  );
end;
$$;

/** Records that a Super Admin reset the password through Supabase Auth. */
create or replace function public.record_staff_password_reset(p_staff_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_sep public.staff_employment_profiles%rowtype;
begin
  v_actor := private.staff_require_credential_admin();

  select * into v_sep
  from public.staff_employment_profiles
  where staff_id = p_staff_id
  for update;

  if not found then
    raise exception 'STAFF_EMPLOYMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_sep.login_phone_e164 is null then
    raise exception 'STAFF_CREDENTIALS_NOT_ISSUED' using errcode = 'P0001';
  end if;

  update public.staff_employment_profiles
  set credentials_password_set_at = now(), updated_at = now()
  where staff_id = p_staff_id;

  -- A reset never changes the state: a staff member who had signed in stays
  -- active, one who had not stays credentials_ready.
  perform private.staff_append_admin_event(
    p_staff_id, v_actor, 'staff.credentials_password_reset',
    jsonb_build_object('accessState', v_sep.access_state)
  );

  return jsonb_build_object(
    'staffId', p_staff_id,
    'accessState', v_sep.access_state,
    'loginPhone', v_sep.login_phone_e164
  );
end;
$$;

/** Disables application access. Employment, history and salary are untouched. */
create or replace function public.revoke_staff_access(
  p_staff_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_sep public.staff_employment_profiles%rowtype;
  v_reason text;
begin
  v_actor := private.staff_require_credential_admin();

  v_reason := trim(coalesce(p_reason, ''));
  if length(v_reason) < 3 then
    raise exception 'STAFF_REASON_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_sep
  from public.staff_employment_profiles
  where staff_id = p_staff_id
  for update;

  if not found then
    raise exception 'STAFF_EMPLOYMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_sep.access_state = 'not_activated' then
    raise exception 'STAFF_CREDENTIALS_NOT_ISSUED' using errcode = 'P0001';
  end if;

  update public.staff_employment_profiles
  set access_state = 'revoked', access_revoked_at = now(), updated_at = now()
  where staff_id = p_staff_id;

  perform private.staff_append_admin_event(
    p_staff_id, v_actor, 'staff.access_revoked',
    jsonb_build_object(
      'accessState', 'revoked',
      'previousState', v_sep.access_state,
      'reason', v_reason
    )
  );

  return jsonb_build_object('staffId', p_staff_id, 'accessState', 'revoked');
end;
$$;

/**
 * Restores capability without changing the password or the UUID.
 *
 * The restored state is derived from Auth sign-in evidence, so a staff member
 * who had genuinely signed in returns to `active` and one who never did returns
 * to `credentials_ready`. Reactivation never fabricates an activation.
 */
create or replace function public.reactivate_staff_access(
  p_staff_id uuid,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_sep public.staff_employment_profiles%rowtype;
  v_reason text;
  v_state text;
begin
  v_actor := private.staff_require_credential_admin();

  v_reason := trim(coalesce(p_reason, ''));
  if length(v_reason) < 3 then
    raise exception 'STAFF_REASON_REQUIRED' using errcode = 'P0001';
  end if;

  select * into v_sep
  from public.staff_employment_profiles
  where staff_id = p_staff_id
  for update;

  if not found then
    raise exception 'STAFF_EMPLOYMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_sep.access_state <> 'revoked' then
    raise exception 'STAFF_ACCESS_NOT_REVOKED' using errcode = 'P0001';
  end if;

  v_state := case
    when exists (
      select 1 from auth.users u
      where u.id = p_staff_id and u.last_sign_in_at is not null
    ) then 'active'
    when exists (select 1 from auth.users u where u.id = p_staff_id) then 'credentials_ready'
    else 'not_activated'
  end;

  update public.staff_employment_profiles
  set access_state = v_state, access_revoked_at = null, updated_at = now()
  where staff_id = p_staff_id;

  perform private.staff_append_admin_event(
    p_staff_id, v_actor, 'staff.access_reactivated',
    jsonb_build_object('accessState', v_state, 'reason', v_reason)
  );

  return jsonb_build_object('staffId', p_staff_id, 'accessState', v_state);
end;
$$;

/**
 * Re-points the login username at a new mobile number.
 *
 * Updates the employment phone and the credential phone in one transaction; the
 * caller updates Supabase Auth and revokes sessions immediately afterwards, so
 * the old number stops authenticating.
 */
create or replace function public.change_staff_login_phone(
  p_staff_id uuid,
  p_phone text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_sep public.staff_employment_profiles%rowtype;
  v_phone text;
  v_reason text;
begin
  v_actor := private.staff_require_credential_admin();

  v_reason := trim(coalesce(p_reason, ''));
  if length(v_reason) < 3 then
    raise exception 'STAFF_REASON_REQUIRED' using errcode = 'P0001';
  end if;

  v_phone := private.staff_normalize_login_phone(p_phone);
  if v_phone is null then
    raise exception 'STAFF_LOGIN_PHONE_INVALID' using errcode = 'P0001';
  end if;

  select * into v_sep
  from public.staff_employment_profiles
  where staff_id = p_staff_id
  for update;

  if not found then
    raise exception 'STAFF_EMPLOYMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_sep.login_phone_e164 is null then
    raise exception 'STAFF_CREDENTIALS_NOT_ISSUED' using errcode = 'P0001';
  end if;

  if v_sep.login_phone_e164 = v_phone then
    raise exception 'STAFF_LOGIN_PHONE_UNCHANGED' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from public.staff_employment_profiles other
    where other.login_phone_e164 = v_phone
      and other.staff_id <> p_staff_id
  ) then
    raise exception 'STAFF_LOGIN_PHONE_CONFLICT' using errcode = 'P0001';
  end if;

  if exists (
    select 1 from auth.users u
    where u.phone = replace(v_phone, '+', '') and u.id <> p_staff_id
  ) then
    raise exception 'STAFF_LOGIN_PHONE_CONFLICT' using errcode = 'P0001';
  end if;

  update public.staff_employment_profiles
  set login_phone_e164 = v_phone, updated_at = now()
  where staff_id = p_staff_id;

  -- The one sanctioned employment-phone write.
  perform set_config('onedecore.login_phone_change', 'on', true);
  update public.profiles set phone_e164 = v_phone, updated_at = now()
  where id = p_staff_id;
  perform set_config('onedecore.login_phone_change', 'off', true);

  perform private.staff_append_admin_event(
    p_staff_id, v_actor, 'staff.login_phone_changed',
    jsonb_build_object(
      'previousLoginPhone', v_sep.login_phone_e164,
      'loginPhone', v_phone,
      'reason', v_reason
    )
  );

  return jsonb_build_object(
    'staffId', p_staff_id,
    'loginPhone', v_phone,
    'loginUsername', right(v_phone, 10),
    'previousLoginPhone', v_sep.login_phone_e164
  );
end;
$$;

/**
 * Promotes credentials_ready -> active after a GENUINE sign-in.
 *
 * Self-service by design: it acts only on `auth.uid()`, so it cannot be aimed
 * at another staff member, and it refuses unless `auth.users.last_sign_in_at`
 * carries real evidence. Creating credentials never activates anything.
 */
create or replace function public.record_staff_first_login()
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_sep public.staff_employment_profiles%rowtype;
begin
  if v_actor is null then
    raise exception 'ATTENDANCE_UNAUTHORIZED' using errcode = '42501';
  end if;

  select * into v_sep
  from public.staff_employment_profiles
  where staff_id = v_actor
  for update;

  if not found then
    -- Super Admin and any non-workforce login: nothing to record.
    return jsonb_build_object('staffId', v_actor, 'accessState', null);
  end if;

  -- Revoked stays revoked. Signing in must never launder a revocation.
  if v_sep.access_state = 'revoked' then
    return jsonb_build_object('staffId', v_actor, 'accessState', 'revoked');
  end if;

  if v_sep.access_state = 'active' then
    return jsonb_build_object('staffId', v_actor, 'accessState', 'active');
  end if;

  if not exists (
    select 1 from auth.users u
    where u.id = v_actor and u.last_sign_in_at is not null
  ) then
    return jsonb_build_object('staffId', v_actor, 'accessState', v_sep.access_state);
  end if;

  update public.staff_employment_profiles
  set access_state = 'active', updated_at = now()
  where staff_id = v_actor;

  perform private.staff_append_admin_event(
    v_actor, v_actor, 'staff.login_first_success',
    jsonb_build_object('accessState', 'active', 'previousState', v_sep.access_state)
  );

  return jsonb_build_object('staffId', v_actor, 'accessState', 'active');
end;
$$;

-- -----------------------------------------------------------------------------
-- I. Grants
-- -----------------------------------------------------------------------------

revoke all on function public.issue_staff_credentials(uuid, text) from public, anon;
revoke all on function public.record_staff_password_reset(uuid) from public, anon;
revoke all on function public.revoke_staff_access(uuid, text) from public, anon;
revoke all on function public.reactivate_staff_access(uuid, text) from public, anon;
revoke all on function public.change_staff_login_phone(uuid, text, text) from public, anon;
revoke all on function public.record_staff_first_login() from public, anon;

grant execute on function public.issue_staff_credentials(uuid, text) to authenticated;
grant execute on function public.record_staff_password_reset(uuid) to authenticated;
grant execute on function public.revoke_staff_access(uuid, text) to authenticated;
grant execute on function public.reactivate_staff_access(uuid, text) to authenticated;
grant execute on function public.change_staff_login_phone(uuid, text, text) to authenticated;
grant execute on function public.record_staff_first_login() to authenticated;

alter function public.issue_staff_credentials(uuid, text) owner to postgres;
alter function public.record_staff_password_reset(uuid) owner to postgres;
alter function public.revoke_staff_access(uuid, text) owner to postgres;
alter function public.reactivate_staff_access(uuid, text) owner to postgres;
alter function public.change_staff_login_phone(uuid, text, text) owner to postgres;
alter function public.record_staff_first_login() owner to postgres;
