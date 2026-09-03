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
-- UUID, so all 130 foreign keys keep working unchanged.
--
-- This migration DOES deliberately harden staff-domain access control. It
-- replaces `private.has_permission`, `private.staff_require_active_actor`,
-- `private.staff_can_view_employment`, `private.staff_can_view_attendance` and
-- `private.salary_can_view`, and it recreates the `leave_requests_select` and
-- `profiles_select_policy` policies. Each is reproduced verbatim apart from a
-- single added access gate — see section E2 for why the gate could not live in
-- `has_permission` alone.
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
  v_raw text;
begin
  if p_raw is null then
    return null;
  end if;

  v_raw := trim(p_raw);

  -- Matches the application contract EXACTLY. Input is never repaired by
  -- stripping punctuation: '74478 63402' and '+91-7447863402' are typos, and
  -- silently fixing one would hand somebody a login they did not type.
  if v_raw ~ '^[6-9][0-9]{9}$' then
    return '+91' || v_raw;
  end if;

  if v_raw ~ '^\+?91[6-9][0-9]{9}$' then
    return '+91' || right(v_raw, 10);
  end if;

  return null;
end;
$$;

comment on function private.staff_normalize_login_phone(text) is
  'Single source of truth for the staff login phone contract. Accepts only ^[6-9][0-9]{9}$ or ^\+?91[6-9][0-9]{9}$ and canonicalizes to +91XXXXXXXXXX. Spaces, hyphens, letters and other punctuation are REJECTED, never repaired.';

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
-- `private.has_permission` is the chokepoint behind `public.authorize`, so
-- denying here disables an ineligible staff member across every permission at
-- once. It is NOT sufficient on its own — the staff-domain policies reach rows
-- through self branches that never consult it, which section E2 closes.
--
-- A user with no employment row (the Super Admin) is unaffected: only an
-- employment row whose access_state is not `active` denies.

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

  -- An employment record that is not cleared for app access denies every
  -- permission, immediately. Checked before the grant lookup so neither a
  -- revoked session nor a JWT minted during an unfinished issuance can act on
  -- any surviving role grant.
  if private.staff_access_denied(v_user_id) then
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

  -- not_activated / credentials_ready: an Auth identity may exist while the
  -- application has not admitted this employee yet.
  if private.staff_access_denied(v_actor) then
    raise exception 'STAFF_ACCESS_NOT_ACTIVE' using errcode = '42501';
  end if;

  return v_actor;
end;
$$;

comment on function private.staff_require_active_actor() is
  'Resolves the authenticated active staff actor. Refuses any employment record whose access_state is not active — revoked, not yet activated, or credentials issued but never used.';

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

-- =============================================================================
-- E2. Revocation must block DIRECT RLS READS, not just authorize()
-- =============================================================================
--
-- `private.has_permission` is NOT sufficient on its own, and claiming otherwise
-- would be wrong. The staff-domain policies reach the row through helpers that
-- inline their own permission joins, or through a bare self branch:
--
--   staff_employment_profiles  private.staff_can_view_employment  -- bare p_viewer = p_staff
--   attendance_days            private.staff_can_view_attendance  -- inlined join
--   attendance_events          private.staff_can_view_attendance
--   attendance_submissions     private.staff_can_view_attendance
--   attendance_submission_events private.staff_can_view_attendance
--   leave_requests             staff_id = auth.uid()              -- bare self branch
--   profiles                   id = auth.uid()                    -- bare self branch
--   salary_*                   private.salary_can_view            -- authorize(), already covered
--
-- None of the first six consults has_permission for the SELF read, so a revoked
-- employee holding a still-valid access token could keep SELECTing their own
-- attendance, leave and employment rows directly. Each is closed below.
--
-- The predicate is always about the VIEWER, never the subject: a Super Admin
-- must still be able to read a revoked employee's records, which is exactly how
-- an offboarding is reviewed.

/**
 * True when this user holds an employment record that is NOT cleared for app
 * access.
 *
 * `revoked` is the obvious case. `not_activated` and `credentials_ready` matter
 * just as much: the Auth identity is created BEFORE the database finalizes an
 * issuance, so there is a window in which a real JWT exists for an employee the
 * application has not yet admitted. Gating on "state is active" rather than
 * "state is revoked" closes that window by construction — a half-finished
 * issuance grants nothing.
 *
 * A user with no employment row is not a workforce user at all (the Super
 * Admin), and is deliberately unaffected.
 */
create or replace function private.staff_access_denied(p_viewer uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.staff_employment_profiles sep
    where sep.staff_id = p_viewer
      and sep.access_state <> 'active'
  );
$$;

comment on function private.staff_access_denied(uuid) is
  'True when this user has an employment record whose access_state is not active (not_activated, credentials_ready or revoked). Used by every staff-domain RLS helper so an ineligible session is denied at the ROW, not merely at authorize().';

revoke all on function private.staff_access_denied(uuid) from public, anon;
grant execute on function private.staff_access_denied(uuid) to authenticated;
alter function private.staff_access_denied(uuid) owner to postgres;

-- Reproduced verbatim from 20260810140000 apart from the leading revoked guard,
-- so the super_admin and reporting-manager scopes are bit-for-bit unchanged and
-- the existing profiles.status = 'active' protections stay exactly where they
-- were.
create or replace function private.staff_can_view_employment(p_viewer uuid, p_staff uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not private.staff_access_denied(p_viewer)
    and (
      p_viewer = p_staff
      or (
        exists (
          select 1
          from public.user_roles ur
          join public.roles r on r.id = ur.role_id
          where ur.user_id = p_viewer
            and r.code = 'super_admin'
            and r.is_active = true
        )
        and exists (
          select 1
          from public.profiles vp
          where vp.id = p_viewer
            and vp.status = 'active'
        )
      )
      or (
        p_staff in (select private.staff_direct_report_ids(p_viewer))
        and exists (
          select 1
          from public.user_roles ur
          join public.roles r on r.id = ur.role_id
          join public.role_permissions rp on rp.role_id = r.id
          join public.permissions perm on perm.id = rp.permission_id
          join public.profiles vp on vp.id = ur.user_id
          where ur.user_id = p_viewer
            and perm.code = 'staff.read'
            and r.is_active = true
            and perm.is_active = true
            and vp.status = 'active'
        )
      )
    );
$$;

create or replace function private.staff_can_view_attendance(p_viewer uuid, p_staff uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not private.staff_access_denied(p_viewer)
    and (
      (
        p_viewer = p_staff
        and exists (
          select 1
          from public.user_roles ur
          join public.roles r on r.id = ur.role_id
          join public.role_permissions rp on rp.role_id = r.id
          join public.permissions perm on perm.id = rp.permission_id
          join public.profiles vp on vp.id = ur.user_id
          where ur.user_id = p_viewer
            and perm.code = 'attendance.self'
            and r.is_active = true
            and perm.is_active = true
            and vp.status = 'active'
        )
      )
      or (
        exists (
          select 1
          from public.user_roles ur
          join public.roles r on r.id = ur.role_id
          join public.role_permissions rp on rp.role_id = r.id
          join public.permissions perm on perm.id = rp.permission_id
          join public.profiles vp on vp.id = ur.user_id
          where ur.user_id = p_viewer
            and perm.code = 'attendance.read.all'
            and r.is_active = true
            and perm.is_active = true
            and vp.status = 'active'
        )
      )
      or (
        p_staff in (select private.staff_direct_report_ids(p_viewer))
        and exists (
          select 1
          from public.user_roles ur
          join public.roles r on r.id = ur.role_id
          join public.role_permissions rp on rp.role_id = r.id
          join public.permissions perm on perm.id = rp.permission_id
          join public.profiles vp on vp.id = ur.user_id
          where ur.user_id = p_viewer
            and perm.code = 'attendance.team.read'
            and r.is_active = true
            and perm.is_active = true
            and vp.status = 'active'
        )
      )
    );
$$;

-- Salary already routes through authorize(), so has_permission covers it. The
-- guard is repeated here so the invariant is local to the helper and survives a
-- future change to how salary_can_view is written.
create or replace function private.salary_can_view(p_staff_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    not private.staff_access_denied((select auth.uid()))
    and (
      (select public.authorize('salary.manage'))
      or (
        (select public.authorize('salary.self'))
        and p_staff_id = (select auth.uid())
      )
    );
$$;

-- `private.staff_direct_report_ids` is referenced by leave_requests_select but,
-- unlike every sibling helper (staff_can_view_employment, staff_can_view_attendance,
-- salary_can_view), it was never granted to `authenticated`. The self branch
-- short-circuited in the old policy so nobody hit it — but a manager exercising
-- the team branch would have got "permission denied for function
-- staff_direct_report_ids". Granting it matches the siblings and fixes that
-- latent breakage; the function is SECURITY DEFINER and returns only the direct
-- reports of the viewer it is asked about.
grant execute on function private.staff_direct_report_ids(uuid) to authenticated;

-- leave_requests carries the self branch inline in the policy, so the policy
-- itself is replaced. The manager and leave.manage scopes are unchanged.
drop policy if exists leave_requests_select on public.leave_requests;

create policy leave_requests_select on public.leave_requests
for select
using (
  not private.staff_access_denied((select auth.uid()))
  and (
    staff_id = (select auth.uid())
    or (select public.authorize('leave.manage'))
    or (
      (select public.authorize('leave.team.approve'))
      and staff_id in (select private.staff_direct_report_ids((select auth.uid())))
    )
  )
);

-- profiles likewise: the self row is readable through a bare id = auth.uid().
-- A revoked employee must not keep reading employment-sensitive profile data.
drop policy if exists profiles_select_policy on public.profiles;

create policy profiles_select_policy on public.profiles
for select
using (
  not private.staff_access_denied((select auth.uid()))
  and (
    id = (select auth.uid())
    or private.has_permission('users.read')
  )
);

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
      'staff.login_first_success',
      'staff.credential_operation_failed'
    ])
  );

-- -----------------------------------------------------------------------------
-- H. Credential lifecycle — prepare / Auth / finalize
-- -----------------------------------------------------------------------------
--
-- The naive ordering (write the DB, then call Auth) publishes a FINAL state and
-- a success audit before the Auth mutation has succeeded. A failure then leaves
-- the application claiming something that never happened: credentials "ready"
-- with no Auth user, a password "reset" that was refused, a new login number
-- Auth has never heard of.
--
-- So coordination lives in a PRIVATE ledger instead, and the four public access
-- states keep their plain meaning. A pending operation is invisible to the
-- access-state machine; only `complete` publishes final state and success audit.
--
--   begin_staff_credential_operation   validate + reserve, publish nothing
--   <Auth Admin call by the server>
--   complete_staff_credential_operation  final state + success audit
--   fail_staff_credential_operation      durable, visibly retryable, fail closed
--
-- Revoke is the deliberate exception: DB denial is applied at BEGIN so access
-- dies immediately, and the ledger row tracks whether session invalidation
-- actually completed.
--
-- THE LEDGER HOLDS NO PASSWORD AND NO HASH. Only phone numbers, reasons,
-- timestamps and a truncated error string, which the server scrubs first.

create table if not exists private.staff_credential_operations (
  id uuid primary key default gen_random_uuid(),
  staff_id uuid not null references public.profiles (id) on delete restrict,
  operation text not null,
  status text not null default 'pending',
  requested_by uuid not null references public.profiles (id) on delete restrict,
  target_phone_e164 text,
  previous_phone_e164 text,
  -- What to restore on finalize, for operations that close access at begin.
  previous_access_state text,
  reason text,
  last_error text,
  -- clock_timestamp(), not now(): `get_staff_credential_operation` orders by
  -- updated_at to find the latest operation, and now() is the TRANSACTION
  -- timestamp, so two rows touched in one transaction would tie and the
  -- "latest" would be arbitrary.
  created_at timestamptz not null default clock_timestamp(),
  updated_at timestamptz not null default clock_timestamp(),
  completed_at timestamptz,

  constraint chk_staff_credential_operations_operation check (
    operation = any (array['issue', 'password_reset', 'revoke', 'reactivate', 'change_phone'])
  ),
  constraint chk_staff_credential_operations_status check (
    status = any (array['pending', 'completed', 'failed'])
  ),
  constraint chk_staff_credential_operations_error_size check (
    last_error is null or length(last_error) <= 300
  )
);

comment on table private.staff_credential_operations is
  'Coordination ledger for staff credential operations. A pending row publishes NO public state, so a failed Auth call can never leave a success audit behind. Contains no password or hash.';

-- ONE live operation per staff member, whatever its kind. Credential mutations
-- for one employee are serialized: overlapping operations are what produce
-- DB/Auth ordering races, and a retry reuses the row rather than racing a
-- second one.
create unique index if not exists uq_staff_credential_operations_pending
  on private.staff_credential_operations (staff_id)
  where status = 'pending';

-- Reserves the number while the operation is in flight, so two concurrent
-- issuances cannot both target it even though neither has published state yet.
create unique index if not exists uq_staff_credential_operations_phone
  on private.staff_credential_operations (target_phone_e164)
  where status = 'pending' and target_phone_e164 is not null;

revoke all on table private.staff_credential_operations from public, anon, authenticated;

/**
 * Validates and reserves. Publishes no public state except for `revoke`, which
 * must deny immediately.
 */
create or replace function public.begin_staff_credential_operation(
  p_staff_id uuid,
  p_operation text,
  p_reason text default null,
  p_phone text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_sep public.staff_employment_profiles%rowtype;
  v_profile public.profiles%rowtype;
  v_phone text;
  v_reason text;
  v_op private.staff_credential_operations%rowtype;
begin
  v_actor := private.staff_require_credential_admin();

  if p_operation is null or p_operation not in
     ('issue', 'password_reset', 'revoke', 'reactivate', 'change_phone') then
    raise exception 'STAFF_CREDENTIAL_OPERATION_INVALID' using errcode = 'P0001';
  end if;

  select * into v_sep
  from public.staff_employment_profiles
  where staff_id = p_staff_id
  for update;

  if not found then
    raise exception 'STAFF_EMPLOYMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_profile from public.profiles where id = p_staff_id;

  v_reason := nullif(trim(coalesce(p_reason, '')), '');

  if p_operation in ('revoke', 'reactivate', 'change_phone')
     and (v_reason is null or length(v_reason) < 3) then
    raise exception 'STAFF_REASON_REQUIRED' using errcode = 'P0001';
  end if;

  -- ---------------------------------------------------------------------
  -- Serialize: at most ONE unresolved credential operation per employee.
  -- ---------------------------------------------------------------------
  --
  -- Overlapping operations are precisely what produce DB/Auth ordering races.
  -- A single unresolved row per staff member makes the next request either a
  -- retry of that same operation or a deterministic refusal — never a second
  -- concurrent mutation.
  --
  -- This is also what stops an unresolved `change_phone` being escaped by a
  -- generic `reactivate`: Supabase Auth may already hold the NEW number while
  -- the application still shows the old, so the only way forward is to finish
  -- (or retry) that phone change.
  select * into v_op
  from private.staff_credential_operations
  where staff_id = p_staff_id and status <> 'completed'
  order by updated_at desc
  limit 1
  for update;

  if found and v_op.operation <> p_operation then
    raise exception 'STAFF_CREDENTIAL_OPERATION_BLOCKED' using errcode = 'P0001';
  end if;

  -- ---------------------------------------------------------------------
  -- Per-operation preconditions and the target number
  -- ---------------------------------------------------------------------
  if p_operation = 'issue' then
    if v_sep.access_state = 'revoked' then
      raise exception 'STAFF_ACCESS_REVOKED' using errcode = 'P0001';
    end if;
    if v_sep.access_state = 'active' then
      raise exception 'STAFF_ACCESS_ALREADY_ACTIVE' using errcode = 'P0001';
    end if;

    -- The username is the employee's OWN number, taken from the authoritative
    -- staff record. A caller-supplied alternative is never trusted, so a
    -- tampered form cannot point a login at a different phone.
    v_phone := private.staff_normalize_login_phone(v_profile.phone_e164);
    if v_phone is null then
      raise exception 'STAFF_LOGIN_PHONE_MISSING' using errcode = 'P0001';
    end if;

  elsif p_operation = 'change_phone' then
    if v_sep.login_phone_e164 is null then
      raise exception 'STAFF_CREDENTIALS_NOT_ISSUED' using errcode = 'P0001';
    end if;
    v_phone := private.staff_normalize_login_phone(p_phone);
    if v_phone is null then
      raise exception 'STAFF_LOGIN_PHONE_INVALID' using errcode = 'P0001';
    end if;
    if v_phone = v_sep.login_phone_e164 then
      raise exception 'STAFF_LOGIN_PHONE_UNCHANGED' using errcode = 'P0001';
    end if;

  elsif p_operation = 'password_reset' then
    if v_sep.login_phone_e164 is null then
      raise exception 'STAFF_CREDENTIALS_NOT_ISSUED' using errcode = 'P0001';
    end if;
    if v_sep.access_state = 'revoked' then
      raise exception 'STAFF_ACCESS_REVOKED' using errcode = 'P0001';
    end if;

  elsif p_operation = 'revoke' then
    if v_sep.access_state = 'not_activated' then
      raise exception 'STAFF_CREDENTIALS_NOT_ISSUED' using errcode = 'P0001';
    end if;

  elsif p_operation = 'reactivate' then
    if v_sep.access_state <> 'revoked' then
      raise exception 'STAFF_ACCESS_NOT_REVOKED' using errcode = 'P0001';
    end if;
  end if;

  -- Uniqueness, checked against published logins, live reservations and Auth.
  if v_phone is not null then
    if exists (
      select 1 from public.staff_employment_profiles other
      where other.login_phone_e164 = v_phone and other.staff_id <> p_staff_id
    ) or exists (
      select 1 from private.staff_credential_operations o
      where o.target_phone_e164 = v_phone
        and o.status = 'pending'
        and o.staff_id <> p_staff_id
    ) or exists (
      select 1 from auth.users u
      where u.phone = replace(v_phone, '+', '') and u.id <> p_staff_id
    ) then
      raise exception 'STAFF_LOGIN_PHONE_CONFLICT' using errcode = 'P0001';
    end if;
  end if;

  -- ---------------------------------------------------------------------
  -- Claim or reuse the operation. Retrying is idempotent by construction.
  -- ---------------------------------------------------------------------
  -- A superseded FAILED row is reused rather than left behind: a retry is the
  -- same operation, and a dangling failure would keep telling the Super Admin
  -- that something is outstanding after it has been fixed. `v_op` is already
  -- held under lock by the serialization check above.
  if v_op.id is not null then
    update private.staff_credential_operations
    set status = 'pending',
        target_phone_e164 = v_phone,
        previous_phone_e164 = coalesce(v_op.previous_phone_e164, v_sep.login_phone_e164),
        previous_access_state = coalesce(v_op.previous_access_state, v_sep.access_state),
        reason = v_reason,
        last_error = null,
        updated_at = clock_timestamp()
    where id = v_op.id
    returning * into v_op;
  else
    insert into private.staff_credential_operations
      (staff_id, operation, status, requested_by, target_phone_e164,
       previous_phone_e164, previous_access_state, reason)
    values
      (p_staff_id, p_operation, 'pending', v_actor, v_phone,
       v_sep.login_phone_e164, v_sep.access_state, v_reason)
    returning * into v_op;
  end if;

  -- ---------------------------------------------------------------------
  -- Operations that must close access BEFORE the Auth call
  -- ---------------------------------------------------------------------
  --
  -- `revoke` is obvious: waiting would leave the account usable.
  --
  -- `change_phone` closes for a subtler reason. The Auth call moves the number
  -- part-way through, so a SECOND failure — a dropped connection while
  -- recording the outcome, say — must not be what stands between the two
  -- systems and a silent split. Closing at BEGIN means the fail-closed state is
  -- already durable before Auth is touched at all, so safety does not depend on
  -- any later call succeeding. `complete` restores the prior state.
  if p_operation in ('revoke', 'change_phone') and v_sep.access_state <> 'revoked' then
    update public.staff_employment_profiles
    set access_state = 'revoked', access_revoked_at = now(), updated_at = now()
    where staff_id = p_staff_id;

    if p_operation = 'revoke' then
      perform private.staff_append_admin_event(
        p_staff_id, v_actor, 'staff.access_revoked',
        jsonb_build_object(
          'accessState', 'revoked',
          'previousState', v_sep.access_state,
          'reason', v_reason,
          'sessionsInvalidated', false
        )
      );
    end if;
  end if;

  return jsonb_build_object(
    'operationId', v_op.id,
    'staffId', p_staff_id,
    'operation', p_operation,
    'targetPhone', v_phone,
    'loginUsername', case when v_phone is null then null else right(v_phone, 10) end,
    'previousPhone', v_sep.login_phone_e164,
    'accessState', (
      select sep.access_state from public.staff_employment_profiles sep
      where sep.staff_id = p_staff_id
    )
  );
end;
$$;

/**
 * Publishes final state and the success audit. Called only after the Auth
 * mutation has actually succeeded. Completing twice is a no-op that returns the
 * same answer, so a retry after a lost response cannot double-apply.
 */
create or replace function public.complete_staff_credential_operation(p_operation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_op private.staff_credential_operations%rowtype;
  v_sep public.staff_employment_profiles%rowtype;
  v_state text;
begin
  v_actor := private.staff_require_credential_admin();

  select * into v_op
  from private.staff_credential_operations
  where id = p_operation_id
  for update;

  if not found then
    raise exception 'STAFF_CREDENTIAL_OPERATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_op.status = 'completed' then
    return jsonb_build_object(
      'operationId', v_op.id,
      'staffId', v_op.staff_id,
      'operation', v_op.operation,
      'alreadyCompleted', true,
      'accessState', (
        select sep.access_state from public.staff_employment_profiles sep
        where sep.staff_id = v_op.staff_id
      )
    );
  end if;

  select * into v_sep
  from public.staff_employment_profiles
  where staff_id = v_op.staff_id
  for update;

  if v_op.operation = 'issue' then
    update public.staff_employment_profiles
    set login_phone_e164 = v_op.target_phone_e164,
        access_state = 'credentials_ready',
        credentials_issued_at = coalesce(credentials_issued_at, now()),
        credentials_password_set_at = now(),
        access_revoked_at = null,
        updated_at = now()
    where staff_id = v_op.staff_id;

    perform private.staff_append_admin_event(
      v_op.staff_id, v_actor, 'staff.credentials_issued',
      jsonb_build_object(
        'accessState', 'credentials_ready',
        'loginPhone', v_op.target_phone_e164
      )
    );

  elsif v_op.operation = 'password_reset' then
    update public.staff_employment_profiles
    set credentials_password_set_at = now(), updated_at = now()
    where staff_id = v_op.staff_id;

    perform private.staff_append_admin_event(
      v_op.staff_id, v_actor, 'staff.credentials_password_reset',
      jsonb_build_object('accessState', v_sep.access_state)
    );

  elsif v_op.operation = 'revoke' then
    -- State was already denied at begin. Completion records that sessions were
    -- actually invalidated, which is the part that could fail.
    perform private.staff_append_admin_event(
      v_op.staff_id, v_actor, 'staff.access_revoked',
      jsonb_build_object(
        'accessState', 'revoked',
        'reason', v_op.reason,
        'sessionsInvalidated', true
      )
    );

  elsif v_op.operation = 'reactivate' then
    v_state := case
      when exists (
        select 1 from auth.users u
        where u.id = v_op.staff_id and u.last_sign_in_at is not null
      ) then 'active'
      when exists (select 1 from auth.users u where u.id = v_op.staff_id) then 'credentials_ready'
      else 'not_activated'
    end;

    update public.staff_employment_profiles
    set access_state = v_state, access_revoked_at = null, updated_at = now()
    where staff_id = v_op.staff_id;

    perform private.staff_append_admin_event(
      v_op.staff_id, v_actor, 'staff.access_reactivated',
      jsonb_build_object('accessState', v_state, 'reason', v_op.reason)
    );

  elsif v_op.operation = 'change_phone' then
    -- Publish the new number AND restore the access the begin step closed. The
    -- prior state is replayed from the ledger, so a staff member who was
    -- already revoked before the change stays revoked.
    update public.staff_employment_profiles
    set login_phone_e164 = v_op.target_phone_e164,
        access_state = coalesce(v_op.previous_access_state, access_state),
        access_revoked_at = case
          when coalesce(v_op.previous_access_state, 'revoked') = 'revoked'
            then access_revoked_at
          else null
        end,
        updated_at = now()
    where staff_id = v_op.staff_id;

    perform set_config('onedecore.login_phone_change', 'on', true);
    update public.profiles set phone_e164 = v_op.target_phone_e164, updated_at = now()
    where id = v_op.staff_id;
    perform set_config('onedecore.login_phone_change', 'off', true);

    perform private.staff_append_admin_event(
      v_op.staff_id, v_actor, 'staff.login_phone_changed',
      jsonb_build_object(
        'previousLoginPhone', v_op.previous_phone_e164,
        'loginPhone', v_op.target_phone_e164,
        'reason', v_op.reason
      )
    );
  end if;

  update private.staff_credential_operations
  set status = 'completed', completed_at = clock_timestamp(), updated_at = clock_timestamp(), last_error = null
  where id = v_op.id;

  return jsonb_build_object(
    'operationId', v_op.id,
    'staffId', v_op.staff_id,
    'operation', v_op.operation,
    'alreadyCompleted', false,
    'loginUsername', case
      when v_op.target_phone_e164 is null then null
      else right(v_op.target_phone_e164, 10)
    end,
    'accessState', (
      select sep.access_state from public.staff_employment_profiles sep
      where sep.staff_id = v_op.staff_id
    )
  );
end;
$$;

/**
 * Records a failed Auth step, durably and visibly.
 *
 * This does NOT create the fail-closed state. `revoke` and `change_phone` close
 * access at BEGIN, before Supabase Auth is touched, precisely so that safety
 * never depends on a best-effort call made after the number may already have
 * moved. A second failure here leaves the account closed and the operation
 * unresolved, which is the safe outcome.
 *
 * The unresolved row is what blocks every other credential operation for this
 * employee until the phone change is retried to completion.
 */
create or replace function public.fail_staff_credential_operation(
  p_operation_id uuid,
  p_error text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_op private.staff_credential_operations%rowtype;
  v_error text;
  v_fail_closed boolean := false;
begin
  v_actor := private.staff_require_credential_admin();

  select * into v_op
  from private.staff_credential_operations
  where id = p_operation_id
  for update;

  if not found then
    raise exception 'STAFF_CREDENTIAL_OPERATION_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_op.status = 'completed' then
    raise exception 'STAFF_CREDENTIAL_OPERATION_COMPLETED' using errcode = 'P0001';
  end if;

  v_error := left(nullif(trim(coalesce(p_error, '')), ''), 300);

  -- `revoke` and `change_phone` already closed access at BEGIN, so nothing here
  -- is load-bearing for safety: this call records WHY, it does not create the
  -- fail-closed state. If it never runs at all the account is still closed.
  v_fail_closed := exists (
    select 1 from public.staff_employment_profiles sep
    where sep.staff_id = v_op.staff_id and sep.access_state = 'revoked'
  );

  update private.staff_credential_operations
  set status = 'failed', last_error = v_error, updated_at = clock_timestamp()
  where id = v_op.id;

  perform private.staff_append_admin_event(
    v_op.staff_id, v_actor, 'staff.credential_operation_failed',
    jsonb_build_object(
      'operation', v_op.operation,
      'failClosed', v_fail_closed,
      'retryable', true
    )
  );

  return jsonb_build_object(
    'operationId', v_op.id,
    'staffId', v_op.staff_id,
    'operation', v_op.operation,
    'retryable', true,
    'failClosed', v_fail_closed,
    'accessState', (
      select sep.access_state from public.staff_employment_profiles sep
      where sep.staff_id = v_op.staff_id
    )
  );
end;
$$;

/** The unfinished operation for a staff member, so the UI can show a retry. */
create or replace function public.get_staff_credential_operation(p_staff_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_op private.staff_credential_operations%rowtype;
begin
  perform private.staff_require_credential_admin();

  select * into v_op
  from private.staff_credential_operations
  where staff_id = p_staff_id and status <> 'completed'
  order by updated_at desc
  limit 1;

  if not found then
    return null;
  end if;

  return jsonb_build_object(
    'operationId', v_op.id,
    'operation', v_op.operation,
    'status', v_op.status,
    'targetLoginUsername', case
      when v_op.target_phone_e164 is null then null
      else right(v_op.target_phone_e164, 10)
    end,
    'updatedAt', v_op.updated_at
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

  -- ONLY credentials_ready may be promoted. `not_activated` means the
  -- application never finished issuing credentials, so an Auth identity created
  -- during that window must not be able to admit itself by signing in.
  if v_sep.access_state <> 'credentials_ready' then
    return jsonb_build_object('staffId', v_actor, 'accessState', v_sep.access_state);
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

revoke all on function public.begin_staff_credential_operation(uuid, text, text, text) from public, anon;
revoke all on function public.complete_staff_credential_operation(uuid) from public, anon;
revoke all on function public.fail_staff_credential_operation(uuid, text) from public, anon;
revoke all on function public.get_staff_credential_operation(uuid) from public, anon;
revoke all on function public.record_staff_first_login() from public, anon;

grant execute on function public.begin_staff_credential_operation(uuid, text, text, text) to authenticated;
grant execute on function public.complete_staff_credential_operation(uuid) to authenticated;
grant execute on function public.fail_staff_credential_operation(uuid, text) to authenticated;
grant execute on function public.get_staff_credential_operation(uuid) to authenticated;
grant execute on function public.record_staff_first_login() to authenticated;

alter function public.begin_staff_credential_operation(uuid, text, text, text) owner to postgres;
alter function public.complete_staff_credential_operation(uuid) owner to postgres;
alter function public.fail_staff_credential_operation(uuid, text) owner to postgres;
alter function public.get_staff_credential_operation(uuid) owner to postgres;
alter function public.record_staff_first_login() owner to postgres;

alter function private.staff_can_view_employment(uuid, uuid) owner to postgres;
alter function private.staff_can_view_attendance(uuid, uuid) owner to postgres;
alter function private.salary_can_view(uuid) owner to postgres;
