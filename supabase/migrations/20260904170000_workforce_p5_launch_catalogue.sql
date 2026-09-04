-- ONEDECORE WORKFORCE P5 — LAUNCH LEAVE CATALOGUE (M57)
--
-- This migration seeds ONE thing: the three owner-approved leave types the
-- business launches with. Nothing else in P5 is configuration — it is
-- OPERATION, and operations do not belong in a migration:
--
--   holidays              real company dates, entered by a Super Admin in the
--                         Holiday admin. Seeding invented dates would put fake
--                         non-working days on a real payroll calendar.
--   salary / payments     no real money values have been supplied. An invented
--                         CTC or payment is worse than an empty table.
--   staff eligibility     turning attendance on for a named employee is an
--                         audited UI action with an actor and a reason. Doing it
--                         here would produce an unattributed change to a real
--                         person's employment record.
--   credentials           the staff password is owner-private and is never
--                         generated, transmitted or stored by tooling.
--
-- OWNER-LOCKED LAUNCH VALUES (see docs/10-decision-register.md, DEC-0099):
--   casual  -> Casual Leave    allows_half_day = false
--   sick    -> Sick Leave      allows_half_day = false
--   unpaid  -> Unpaid Leave    allows_half_day = false
--
-- HALF-DAY LEAVE IS NOT APPROVED AT LAUNCH. `allows_half_day = false` on all
-- three. This is a LEAVE capability only and has no relationship to the
-- attendance category HALF_DAY_4H, which is derived from worked minutes against
-- the policy threshold and is untouched here.
--
-- Forward-only. No applied migration is edited. No permission is granted or
-- revoked — in particular `attendance.correct.team` remains absent from
-- sales_manager, so team attendance correction stays Super-Admin-only.

-- -----------------------------------------------------------------------------
-- Launch leave catalogue
-- -----------------------------------------------------------------------------

do $$
declare
  v_expected constant jsonb := jsonb_build_array(
    jsonb_build_object('code', 'casual', 'display_name', 'Casual Leave'),
    jsonb_build_object('code', 'sick',   'display_name', 'Sick Leave'),
    jsonb_build_object('code', 'unpaid', 'display_name', 'Unpaid Leave')
  );
  v_entry jsonb;
  v_existing public.leave_types%rowtype;
begin
  for v_entry in select * from jsonb_array_elements(v_expected) loop
    select * into v_existing
    from public.leave_types
    where code = (v_entry->>'code');

    if not found then
      insert into public.leave_types (code, display_name, allows_half_day, is_active)
      values (v_entry->>'code', v_entry->>'display_name', false, true);

    elsif v_existing.display_name = (v_entry->>'display_name')
      and v_existing.allows_half_day = false
      and v_existing.is_active = true then
      -- Already exactly the launch shape. Idempotent re-run, nothing to do.
      null;

    else
      -- A row exists under this code that is NOT the launch shape. It was put
      -- there by the business, and silently rewriting it would destroy a real
      -- configuration decision without anyone noticing. Fail loudly instead and
      -- let a human reconcile it.
      raise exception
        'WORKFORCE_P5_LEAVE_TYPE_CONFLICT: leave_types.% already exists with a different configuration (display_name=%, allows_half_day=%, is_active=%). Refusing to overwrite existing business data.',
        v_existing.code,
        v_existing.display_name,
        v_existing.allows_half_day,
        v_existing.is_active
        using errcode = '23505';
    end if;
  end loop;
end;
$$;

comment on table public.leave_types is
  'Configurable leave type catalogue. M57 seeds the owner-approved P5 launch set (casual, sick, unpaid), all with allows_half_day = false. Half-day LEAVE is not approved at launch; the attendance HALF_DAY_4H category is a separate, unaffected concept.';
