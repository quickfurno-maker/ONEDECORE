-- ONEDECORE — Super Admin enquiry deletion, as an audit-preserving tombstone
--
-- WHAT THIS IS, AND WHAT IT IS NOT
--
-- Deleting an enquiry removes it from every operational CRM surface while the
-- record itself stays exactly where it is. Nothing is physically deleted: not
-- the lead row, not the contact, not consent evidence, not a note, an activity,
-- an assignment, an import provenance row or a WhatsApp message.
--
-- This is an OPERATIONAL tombstone, not legal erasure. It is not a GDPR delete
-- and must never be described as one.
--
-- CLOSED LOST IS STILL NOT DELETE
--
-- Marking an enquiry CLOSED LOST is the sales team's ordinary lifecycle
-- transition — reason, note, lead stays in CRM truth, `leads.transition`.
-- Deleting one is the owner's, and `leads.delete` is held by `super_admin`
-- alone. The delete RPC below requires BOTH the permission AND the role, so a
-- future migration that grants `leads.delete` to another role by accident still
-- grants that role nothing.
--
-- WHY RLS ALONE IS NOT THE ANSWER
--
-- A single `deleted_at is null` on the lead SELECT policy would look complete
-- and would not be: 52 SECURITY DEFINER functions reference `public.leads` at
-- this head, and a definer function bypasses the caller's RLS entirely. Twenty
-- one of them resolve through the four central CRM predicates, so hardening
-- those closes them together. The rest were audited one at a time and are
-- either patched below or documented as unreachable for a DELETABLE lead —
-- which is what the converted-lead blocker is really for. The full table is in
-- `docs/crm/lead-deletion.md`.
--
-- WHAT CANNOT BE DELETED
--
-- An enquiry that reached commercial reality is not disposable CRM noise. A
-- lead is refused if it is `closed_won`, or has any quotation, any quotation
-- acceptance, or any project. That refusal is deliberately conservative and it
-- is also what makes most of the quotation and project functions unreachable.

begin;

-- =============================================================================
-- A. The tombstone columns
-- =============================================================================
--
-- Four columns, all-or-none. A half-written tombstone — a `deleted_at` with no
-- reason, say — would be a lead that is invisible and unexplained, which is the
-- worst of both states. The constraint makes that unrepresentable.

alter table public.leads
  add column if not exists deleted_at timestamptz null,
  add column if not exists deleted_by uuid null references public.profiles (id) on delete restrict,
  add column if not exists delete_reason text null,
  add column if not exists deletion_reference uuid null;

comment on column public.leads.deleted_at is
  'Operational tombstone. Set only by public.delete_lead_tombstone. The row is never physically deleted.';
comment on column public.leads.delete_reason is
  'Why the owner removed this enquiry from operational surfaces. Required, 10..500 characters.';
comment on column public.leads.deletion_reference is
  'Server-generated audit handle for this deletion. Never accepted from a client.';

alter table public.leads drop constraint if exists chk_leads_tombstone_all_or_none;
alter table public.leads add constraint chk_leads_tombstone_all_or_none check (
  (
    deleted_at is null
    and deleted_by is null
    and delete_reason is null
    and deletion_reference is null
  )
  or (
    deleted_at is not null
    and deleted_by is not null
    and delete_reason is not null
    and deletion_reference is not null
  )
);

alter table public.leads drop constraint if exists chk_leads_delete_reason;
alter table public.leads add constraint chk_leads_delete_reason check (
  delete_reason is null or length(trim(delete_reason)) between 10 and 500
);

-- Operational reads are all "the live ones", so the index carries the predicate
-- rather than the column.
create index if not exists idx_leads_active_created_at
  on public.leads (created_at desc)
  where deleted_at is null;

-- =============================================================================
-- B. The tombstone columns are RPC-only, like the pipeline columns
-- =============================================================================
--
-- There is no UPDATE policy on public.leads for `authenticated` — every
-- mutation already goes through a SECURITY DEFINER RPC — so this trigger is
-- defence in depth rather than the only lock. It matters anyway: it is what
-- stops a future policy, or a future definer function written without this
-- context, from setting or clearing a tombstone as an ordinary column write.
--
-- `onedecore.crm_transition` is the existing escape hatch the CRM RPCs already
-- set; the delete RPC uses the same one.

create or replace function private.forbid_direct_lead_owner_status_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('onedecore.crm_transition', true) = '1' then
    return NEW;
  end if;
  if TG_OP = 'UPDATE' and (
    NEW.status is distinct from OLD.status
    or NEW.assigned_to is distinct from OLD.assigned_to
    or NEW.closed_lost_reason_id is distinct from OLD.closed_lost_reason_id
    or NEW.closed_lost_note is distinct from OLD.closed_lost_note
    or NEW.on_hold_reason is distinct from OLD.on_hold_reason
    or NEW.on_hold_since is distinct from OLD.on_hold_since
    or NEW.on_hold_previous_status is distinct from OLD.on_hold_previous_status
    -- The tombstone joins the list: deleting an enquiry, and un-deleting one,
    -- are both operations with an owner and an audit trail, never a column edit.
    or NEW.deleted_at is distinct from OLD.deleted_at
    or NEW.deleted_by is distinct from OLD.deleted_by
    or NEW.delete_reason is distinct from OLD.delete_reason
    or NEW.deletion_reference is distinct from OLD.deletion_reference
  ) then
    raise exception 'Direct lead pipeline mutation forbidden; use CRM RPCs'
      using errcode = '42501';
  end if;
  return NEW;
end;
$$;

-- =============================================================================
-- C. One question, asked in one place
-- =============================================================================

/*
 * Is this lead still an operational object?
 *
 * Every "can I act on this lead" answer eventually reduces to this. It is its
 * own function so a future reader can find every operational gate by finding
 * its callers, rather than by grepping for a column name.
 */
create or replace function private.crm_lead_is_operational(p_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.leads
    where id = p_lead_id
      and deleted_at is null
  );
$$;

alter function private.crm_lead_is_operational(uuid) owner to postgres;
revoke all on function private.crm_lead_is_operational(uuid) from public, anon;
grant execute on function private.crm_lead_is_operational(uuid) to authenticated;

-- =============================================================================
-- D. Row-level visibility
-- =============================================================================
--
-- The ordinary read. There is deliberately NO "Super Admin can see deleted"
-- branch: this phase has no recycle bin, and a branch nobody uses is a branch
-- that will be trusted later without being re-read.

drop policy if exists leads_select_crm_scoped on public.leads;
create policy leads_select_crm_scoped
  on public.leads for select to authenticated
  using (
    deleted_at is null
    and (select private.crm_can_view_lead(assigned_to))
  );

-- =============================================================================
-- E. SECURITY DEFINER containment
-- =============================================================================
--
-- Each function below is its CURRENT definition with one local substitution:
-- the lead table reference becomes a filtered inline view. Nothing else in any
-- of these bodies changed, which is why they can be reviewed by diffing against
-- the migration named above each one.

-- -----------------------------------------------------------------------------
-- crm_can_view_lead_by_id
-- -----------------------------------------------------------------------------
--
-- Can this caller SEE this lead? A tombstoned lead is not visible to anyone through an operational path.

-- source: 20260730184426_crm_identity_core_foundation.sql
create or replace function private.crm_can_view_lead_by_id(p_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from (select * from public.leads where deleted_at is null) l
    where l.id = p_lead_id
      and (select private.crm_can_view_lead(l.assigned_to))
  );
$$;

-- -----------------------------------------------------------------------------
-- crm_can_mutate_lead
-- -----------------------------------------------------------------------------
--
-- Can this caller CHANGE this lead? Assignment, transition, notes and follow-ups all resolve through here, so all of them close at once.

-- source: 20260730184426_crm_identity_core_foundation.sql
create or replace function private.crm_can_mutate_lead(p_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from (select * from public.leads where deleted_at is null) l
    where l.id = p_lead_id
      and (
        (
          (select private.crm_has_broad_lead_read())
          and (
            (select public.authorize('leads.manage'))
            or (select public.authorize('leads.transition'))
            or (select public.authorize('crm.notes.manage'))
            or (select public.authorize('crm.follow_ups.manage'))
          )
        )
        or (
          (select public.authorize('leads.read_assigned'))
          and l.assigned_to = (select auth.uid())
          and (
            (select public.authorize('leads.transition'))
            or (select public.authorize('crm.notes.manage'))
            or (select public.authorize('crm.follow_ups.manage'))
          )
        )
      )
  );
$$;

-- -----------------------------------------------------------------------------
-- crm_user_can_operate_lead
-- -----------------------------------------------------------------------------
--
-- The same question asked about ANOTHER user, used when work is handed between staff.

-- source: 20260826120000_crm_activity_control_plane_foundation.sql
create or replace function private.crm_user_can_operate_lead(
  p_user_id uuid,
  p_lead_id uuid,
  p_capability text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_user_id is not null
    and p_lead_id is not null
    and nullif(trim(p_capability), '') is not null
    and exists (
      select 1
      from public.profiles pr
      join public.user_roles ur on ur.user_id = pr.id
      join public.roles r on r.id = ur.role_id
      join public.role_permissions rp on rp.role_id = r.id
      join public.permissions p on p.id = rp.permission_id
      where pr.id = p_user_id
        and pr.status = 'active'
        and r.is_active = true
        and p.is_active = true
        and p.code = p_capability
    )
    and exists (
      select 1
      from (select * from public.leads where deleted_at is null) l
      where l.id = p_lead_id
        and (
          -- Broad lead read for target user (mirror crm_has_broad_lead_read for p_user_id)
          exists (
            select 1
            from public.profiles pr
            join public.user_roles ur on ur.user_id = pr.id
            join public.roles r on r.id = ur.role_id
            join public.role_permissions rp on rp.role_id = r.id
            join public.permissions p on p.id = rp.permission_id
            where pr.id = p_user_id
              and pr.status = 'active'
              and r.is_active = true
              and p.is_active = true
              and p.code = 'leads.read_all'
          )
          or (
            exists (
              select 1
              from public.profiles pr
              join public.user_roles ur on ur.user_id = pr.id
              join public.roles r on r.id = ur.role_id
              join public.role_permissions rp on rp.role_id = r.id
              join public.permissions p on p.id = rp.permission_id
              where pr.id = p_user_id
                and pr.status = 'active'
                and r.is_active = true
                and p.is_active = true
                and p.code = 'leads.read'
            )
            and not exists (
              select 1
              from public.profiles pr
              join public.user_roles ur on ur.user_id = pr.id
              join public.roles r on r.id = ur.role_id
              join public.role_permissions rp on rp.role_id = r.id
              join public.permissions p on p.id = rp.permission_id
              where pr.id = p_user_id
                and pr.status = 'active'
                and r.is_active = true
                and p.is_active = true
                and p.code = 'leads.read_assigned'
            )
          )
          or (
            l.assigned_to is not null
            and l.assigned_to = p_user_id
            and exists (
              select 1
              from public.profiles pr
              join public.user_roles ur on ur.user_id = pr.id
              join public.roles r on r.id = ur.role_id
              join public.role_permissions rp on rp.role_id = r.id
              join public.permissions p on p.id = rp.permission_id
              where pr.id = p_user_id
                and pr.status = 'active'
                and r.is_active = true
                and p.is_active = true
                and p.code = 'leads.read_assigned'
            )
          )
        )
    );
$$;

-- -----------------------------------------------------------------------------
-- crm_can_view_contact
-- -----------------------------------------------------------------------------
--
-- Contact visibility earned through an assigned lead. The contact itself survives deletion; the lead is no longer a reason to see it.

-- source: 20260730184426_crm_identity_core_foundation.sql
create or replace function private.crm_can_view_contact(p_contact_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.crm_has_broad_lead_read())
    or (
      (select public.authorize('leads.read_assigned'))
      and exists (
        select 1
        from (select * from public.leads where deleted_at is null) l
        where l.contact_id = p_contact_id
          and l.assigned_to = (select auth.uid())
      )
    );
$$;

-- -----------------------------------------------------------------------------
-- crm_lead_deal_values
-- -----------------------------------------------------------------------------
--
-- The commercial read model behind deal values and lead-derived reporting.

-- source: 20260831140000_crm_lead_commercial_read_models.sql
create or replace function private.crm_lead_deal_values(
  p_owner_id uuid default null,
  p_lead_id uuid default null
)
returns table (
  lead_id uuid,
  lead_status text,
  commercial_state text,
  taxable_base_paise bigint,
  version_number integer,
  quotation_id uuid,
  quotation_number text,
  state_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  with visible_leads as (
    select l.id, l.status, l.assigned_to
    from (select * from public.leads where deleted_at is null) l
    where (select private.crm_can_view_lead(l.assigned_to))
      and (p_lead_id is null or l.id = p_lead_id)
      and (p_owner_id is null or l.assigned_to = p_owner_id)
  ),
  roots as (
    -- quotations.lead_id is UNIQUE (20260812140000), so this stays 1:1.
    select vl.id as lead_id, q.id as quotation_id, q.quotation_number
    from visible_leads vl
    join public.quotations q on q.lead_id = vl.id
  ),
  accepted as (
    select
      r.lead_id,
      qa.taxable_base_paise,
      qv.version_number,
      qa.accepted_at as state_at
    from roots r
    join public.quotation_acceptances qa on qa.quotation_id = r.quotation_id
    join public.quotation_versions qv on qv.id = qa.quotation_version_id
  ),
  issued as (
    -- Same evidence the CRM 2C proposal_sent gate treats as delivery: a
    -- finalized version with a live, non-revoked capability grant.
    select distinct on (r.lead_id)
      r.lead_id,
      qv.taxable_base_paise,
      qv.version_number,
      coalesce(qv.finalized_at, qv.updated_at) as state_at
    from roots r
    join public.quotation_versions qv on qv.quotation_id = r.quotation_id
    join public.quotation_access_grants g
      on g.quotation_version_id = qv.id
     and g.revoked_at is null
    where qv.status = 'finalized'
    order by r.lead_id, qv.version_number desc
  ),
  finalized as (
    select distinct on (r.lead_id)
      r.lead_id,
      qv.taxable_base_paise,
      qv.version_number,
      coalesce(qv.finalized_at, qv.updated_at) as state_at
    from roots r
    join public.quotation_versions qv on qv.quotation_id = r.quotation_id
    where qv.status = 'finalized'
    order by r.lead_id, qv.version_number desc
  ),
  drafted as (
    -- Owner lock Q4 rank 4: a current draft counts only when it carries a real
    -- number. A zero-value draft resolves to UNKNOWN, never to zero.
    select distinct on (r.lead_id)
      r.lead_id,
      qv.taxable_base_paise,
      qv.version_number,
      qv.updated_at as state_at
    from roots r
    join public.quotation_versions qv on qv.quotation_id = r.quotation_id
    where qv.status = 'draft'
      and qv.is_current_draft = true
      and qv.taxable_base_paise > 0
    order by r.lead_id, qv.version_number desc
  )
  select
    vl.id,
    vl.status,
    case
      when a.lead_id is not null then 'accepted'
      when i.lead_id is not null then 'issued'
      when f.lead_id is not null then 'finalized'
      when d.lead_id is not null then 'draft'
      else 'unknown'
    end,
    coalesce(
      a.taxable_base_paise,
      i.taxable_base_paise,
      f.taxable_base_paise,
      d.taxable_base_paise
    ),
    coalesce(a.version_number, i.version_number, f.version_number, d.version_number),
    r.quotation_id,
    r.quotation_number,
    coalesce(a.state_at, i.state_at, f.state_at, d.state_at)
  from visible_leads vl
  left join roots r on r.lead_id = vl.id
  left join accepted a on a.lead_id = vl.id
  left join issued i on i.lead_id = vl.id
  left join finalized f on f.lead_id = vl.id
  left join drafted d on d.lead_id = vl.id;
$$;

-- -----------------------------------------------------------------------------
-- crm_evaluate_manual_lead_duplicate
-- -----------------------------------------------------------------------------
--
-- DUPLICATE / RE-ENTRY. A deleted enquiry must not block the same customer from coming back: its audit row is history, not an active duplicate. Both lead lookups in this evaluator are filtered. Consent and DNC live on the CONTACT and are untouched, so they stay authoritative.

-- source: 20260801140000_crm_manual_lead_duplicate_safe_flow.sql
create or replace function private.crm_evaluate_manual_lead_duplicate(
  p_contact_id uuid,
  p_service_code text,
  p_property_code text,
  p_locality text
)
returns table (
  outcome_code text,
  can_create boolean,
  can_override boolean,
  existing_lead_id uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_active_lead_id uuid;
  v_recent_lead_id uuid;
begin
  if p_contact_id is null then
    return query select 'CLEAR'::text, true, false, null::uuid;
    return;
  end if;

  select l.id
  into v_active_lead_id
  from (select * from public.leads where deleted_at is null) l
  where l.contact_id = p_contact_id
    and private.crm_manual_lead_is_active_status(l.status)
    and private.crm_manual_leads_are_similar(
      l.locality, p_locality, l.service_code, p_service_code, l.property_code, p_property_code
    )
  order by l.created_at desc
  limit 1;

  if v_active_lead_id is not null then
    return query
    select
      'ACTIVE_DUPLICATE'::text,
      false,
      false,
      case
        when private.crm_can_view_lead_by_id(v_active_lead_id) then v_active_lead_id
        else null
      end;
    return;
  end if;

  select l.id
  into v_recent_lead_id
  from (select * from public.leads where deleted_at is null) l
  where l.contact_id = p_contact_id
    and l.status in ('closed_won', 'closed_lost')
    and l.created_at >= now() - interval '30 days'
    and private.crm_manual_leads_are_similar(
      l.locality, p_locality, l.service_code, p_service_code, l.property_code, p_property_code
    )
  order by l.created_at desc
  limit 1;

  if v_recent_lead_id is not null then
    return query
    select
      'RECENT_SIMILAR'::text,
      false,
      (select public.authorize('leads.duplicate_override')),
      case
        when private.crm_can_view_lead_by_id(v_recent_lead_id) then v_recent_lead_id
        else null
      end;
    return;
  end if;

  return query select 'REUSABLE_CONTACT'::text, true, false, null::uuid;
end;
$$;

-- -----------------------------------------------------------------------------
-- ensure_first_contact_sla_clock
-- -----------------------------------------------------------------------------
--
-- SLA clocks. A deleted enquiry must stop generating obligations; existing SLA history is left exactly as it is.

-- source: 20260827140000_crm_business_sla_foundation.sql
create or replace function private.ensure_first_contact_sla_clock(p_lead_id uuid)
returns public.crm_sla_clocks
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_created_at timestamptz;
  v_policy public.crm_sla_policies%rowtype;
  v_due timestamptz := null;
  v_row public.crm_sla_clocks%rowtype;
begin
  if p_lead_id is null then
    raise exception 'Lead id required' using errcode = '22023';
  end if;

  select l.created_at into v_created_at
  from (select * from public.leads where deleted_at is null) l
  where l.id = p_lead_id;

  if not found then
    raise exception 'Lead % not found', p_lead_id using errcode = 'P0002';
  end if;

  -- Existing row: return as-is (Option A + NULL-due snapshot lock). No policy lock.
  select * into v_row
  from public.crm_sla_clocks c
  where c.lead_id = p_lead_id;

  if found then
    return v_row;
  end if;

  -- New clock: FOR SHARE conflicts with update_crm_sla_policy_impl FOR UPDATE so the
  -- due snapshot serializes cleanly against concurrent policy mutation.
  select * into v_policy
  from public.crm_sla_policies p
  where p.policy_code = 'first_contact'
  for share;

  if found
    and v_policy.is_active
    and v_policy.business_hours_enabled
    and v_policy.effective_from is not null
    and v_created_at >= v_policy.effective_from
    and (select private.validate_crm_sla_business_hours_config(v_policy.business_hours_config))
    and (select private.crm_sla_timezone_is_valid(v_policy.timezone))
  then
    v_due := private.compute_business_sla_due_at(
      v_created_at,
      v_policy.target_business_minutes,
      v_policy.timezone,
      v_policy.business_hours_config
    );
  end if;

  insert into public.crm_sla_clocks (
    lead_id,
    policy_code,
    clock_started_at,
    sla_due_at,
    first_contact_attempt_at,
    breached_at
  ) values (
    p_lead_id,
    'first_contact',
    v_created_at,
    v_due,
    null,
    null
  )
  on conflict (lead_id) do nothing
  returning * into v_row;

  if v_row.lead_id is null then
    select * into v_row
    from public.crm_sla_clocks c
    where c.lead_id = p_lead_id;
  end if;

  return v_row;
end;
$$;

-- -----------------------------------------------------------------------------
-- ensure_sla_first_contact_primary
-- -----------------------------------------------------------------------------
--
-- The same for the primary first-contact path.

-- source: 20260829140000_crm_assignment_first_contact_automation.sql
create or replace function private.ensure_sla_first_contact_primary(
  p_lead_id uuid,
  p_assignee_id uuid,
  p_actor uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads%rowtype;
  v_clock public.crm_sla_clocks%rowtype;
  v_existing public.lead_follow_ups%rowtype;
  v_row public.lead_follow_ups%rowtype;
  v_prev_owner uuid;
  v_now timestamptz;
begin
  if p_lead_id is null or p_assignee_id is null or p_actor is null then
    return;
  end if;

  select * into v_lead from public.leads
   where id = p_lead_id and deleted_at is null;
  if not found then
    return;
  end if;

  if v_lead.status in ('closed_won', 'closed_lost') then
    return;
  end if;

  if v_lead.entry_method = 'import' then
    return;
  end if;

  v_clock := private.ensure_first_contact_sla_clock(p_lead_id);

  if v_clock.first_contact_attempt_at is not null then
    return;
  end if;

  if v_clock.sla_due_at is null then
    return;
  end if;

  v_now := clock_timestamp();

  select * into v_existing
  from public.lead_follow_ups f
  where f.lead_id = p_lead_id
    and f.status = 'open'
    and f.source = 'sla_auto'
    and f.title = 'First Contact'
  order by f.id
  limit 1
  for update;

  if found then
    if coalesce(v_existing.is_primary_next_action, false) is not true then
      perform private.clear_open_primary_for_lead(
        p_lead_id, p_actor, 'primary_replaced', v_existing.id
      );
      update public.lead_follow_ups
      set is_primary_next_action = true,
          updated_at = v_now
      where id = v_existing.id;

      insert into public.lead_follow_up_events (
        follow_up_id, lead_id, actor_id, event_type,
        previous_values, new_values, reason_code, reason_note
      )
      values (
        v_existing.id, p_lead_id, p_actor, 'primary_designated',
        jsonb_build_object('isPrimaryNextAction', false),
        jsonb_build_object('isPrimaryNextAction', true),
        'sla_auto_primary', null
      );
    end if;

    if v_existing.owner_id is distinct from p_assignee_id then
      v_prev_owner := v_existing.owner_id;
      update public.lead_follow_ups
      set owner_id = p_assignee_id,
          updated_at = v_now
      where id = v_existing.id;

      insert into public.lead_follow_up_events (
        follow_up_id, lead_id, actor_id, event_type,
        previous_values, new_values, reason_code, reason_note
      )
      values (
        v_existing.id, p_lead_id, p_actor, 'ownership_transferred',
        jsonb_build_object('ownerId', v_prev_owner),
        jsonb_build_object('ownerId', p_assignee_id),
        null, null
      );
    end if;

    return;
  end if;

  perform private.clear_open_primary_for_lead(p_lead_id, p_actor, 'primary_replaced', null);

  insert into public.lead_follow_ups (
    lead_id, owner_id, due_at, status, created_by,
    activity_type, title, priority, is_primary_next_action, source, updated_at
  ) values (
    p_lead_id, p_assignee_id, v_clock.sla_due_at, 'open', p_actor,
    'call', 'First Contact', 'high', true, 'sla_auto', v_now
  )
  returning * into v_row;

  insert into public.lead_follow_up_events (
    follow_up_id, lead_id, actor_id, event_type,
    previous_values, new_values, reason_code, reason_note
  )
  values (
    v_row.id, p_lead_id, p_actor, 'created',
    '{}'::jsonb,
    jsonb_strip_nulls(jsonb_build_object(
      'activityType', 'call',
      'title', 'First Contact',
      'dueAt', v_clock.sla_due_at,
      'priority', 'high',
      'ownerId', p_assignee_id,
      'isPrimaryNextAction', true,
      'source', 'sla_auto'
    )),
    null, null
  );

  insert into public.lead_follow_up_events (
    follow_up_id, lead_id, actor_id, event_type,
    previous_values, new_values, reason_code, reason_note
  )
  values (
    v_row.id, p_lead_id, p_actor, 'primary_designated',
    jsonb_build_object('isPrimaryNextAction', false),
    jsonb_build_object('isPrimaryNextAction', true),
    'sla_auto_primary', null
  );

  insert into public.lead_activities (lead_id, activity_type, reference_id, actor_id, summary, metadata)
  values (
    p_lead_id,
    'follow_up.auto_created',
    v_row.id,
    p_actor,
    'First Contact task auto-created',
    jsonb_strip_nulls(jsonb_build_object(
      'dueAt', v_clock.sla_due_at,
      'ownerId', p_assignee_id,
      'activityType', 'call',
      'title', 'First Contact',
      'priority', 'high',
      'isPrimaryNextAction', true,
      'source', 'sla_auto'
    ))
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- whatsapp_evaluate_service_send_eligibility
-- -----------------------------------------------------------------------------
--
-- WhatsApp send eligibility. Conversation and message history is preserved in full; what stops is using a deleted enquiry as the target of a NEW lead-scoped send.

-- source: 20260805140000_whatsapp_shared_inbox_send_intent_foundation.sql
create or replace function private.whatsapp_evaluate_service_send_eligibility(
  p_conversation_id uuid
)
returns table (
  eligibility_code text,
  eligibility_snapshot jsonb,
  dispatch_mode text
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_conv public.whatsapp_conversations%rowtype;
  v_contact_id uuid;
  v_contact_status text;
  v_channel_status text;
  v_consent_event text;
begin
  select * into v_conv
  from public.whatsapp_conversations
  where id = p_conversation_id;

  if not found then
    return query
      select
        'denied_invalid_conversation'::text,
        jsonb_build_object('conversation_id', p_conversation_id),
        null::text;
    return;
  end if;

  if v_conv.lead_id is not null
     and not exists (
       select 1 from public.leads
       where id = v_conv.lead_id and deleted_at is null
     )
  then
    return query
      select
        'denied_lead_deleted'::text,
        jsonb_build_object(
          'conversation_id', p_conversation_id,
          'lead_id', v_conv.lead_id
        ),
        null::text;
    return;
  end if;

  v_contact_id := v_conv.contact_id;

  if v_contact_id is null and v_conv.lead_id is not null then
    select l.contact_id into v_contact_id
    from (select * from public.leads where deleted_at is null) l
    where l.id = v_conv.lead_id;
  end if;

  if v_contact_id is null then
    return query
      select
        'denied_missing_contact'::text,
        jsonb_build_object('conversation_id', p_conversation_id),
        null::text;
    return;
  end if;

  select c.status into v_contact_status
  from public.contacts c
  where c.id = v_contact_id;

  if v_contact_status = 'do_not_contact' then
    return query
      select
        'denied_dnc'::text,
        jsonb_build_object('contact_id', v_contact_id, 'contact_status', v_contact_status),
        null::text;
    return;
  end if;

  if v_contact_status in ('merged', 'archived') then
    return query
      select
        'denied_contact_inactive'::text,
        jsonb_build_object('contact_id', v_contact_id, 'contact_status', v_contact_status),
        null::text;
    return;
  end if;

  select ch.status into v_channel_status
  from public.contact_channels ch
  where ch.contact_id = v_contact_id
    and ch.channel_type = 'whatsapp'
    and ch.address_normalized = v_conv.customer_e164
  order by case ch.status when 'active' then 0 else 1 end
  limit 1;

  if v_channel_status is null then
    return query
      select
        'denied_missing_whatsapp_channel'::text,
        jsonb_build_object('contact_id', v_contact_id, 'customer_e164', v_conv.customer_e164),
        null::text;
    return;
  end if;

  if v_channel_status = 'suppressed' then
    return query
      select
        'denied_channel_suppressed'::text,
        jsonb_build_object('contact_id', v_contact_id, 'channel_status', v_channel_status),
        null::text;
    return;
  end if;

  if v_channel_status <> 'active' then
    return query
      select
        'denied_channel_inactive'::text,
        jsonb_build_object('contact_id', v_contact_id, 'channel_status', v_channel_status),
        null::text;
    return;
  end if;

  v_consent_event := private.whatsapp_latest_consent_event_type(v_contact_id, 'WHATSAPP_SERVICE');

  if v_consent_event is distinct from 'granted' then
    return query
      select
        'denied_missing_consent'::text,
        jsonb_build_object(
          'contact_id', v_contact_id,
          'latest_consent_event', coalesce(v_consent_event, 'none')
        ),
        null::text;
    return;
  end if;

  return query
    select
      'eligible'::text,
      jsonb_build_object(
        'contact_id', v_contact_id,
        'channel_status', v_channel_status,
        'latest_consent_event', v_consent_event
      ),
      'service_window_text'::text;
end;
$$;

-- -----------------------------------------------------------------------------
-- whatsapp_inbox_can_use_conversation
-- -----------------------------------------------------------------------------
--
-- Acting in the inbox on a lead-scoped conversation.

-- source: 20260805140000_whatsapp_shared_inbox_send_intent_foundation.sql
create or replace function private.whatsapp_inbox_can_use_conversation(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.whatsapp_conversations c
    left join (select * from public.leads where deleted_at is null) l on l.id = c.lead_id
    where c.id = p_conversation_id
      -- A conversation may be lead-scoped or not. If it IS, that lead has to
      -- still be operational before ANY branch below is consulted: manage
      -- scope is a wider audience, not a way past a deleted enquiry.
      and (c.lead_id is null or l.id is not null)
      and (select public.authorize('whatsapp.inbox.use'))
      and (
        (
          c.lead_id is null
          and (select private.whatsapp_inbox_has_manage_scope())
        )
        or (
          c.lead_id is not null
          and l.assigned_to is not null
          and l.assigned_to = (select auth.uid())
        )
        or (
          c.lead_id is not null
          and (select private.whatsapp_inbox_has_manage_scope())
        )
      )
  );
$$;

-- -----------------------------------------------------------------------------
-- whatsapp_inbox_actor_can_use_conversation
-- -----------------------------------------------------------------------------
--
-- The same question asked about a named actor by the dispatch path.

-- source: 20260808140000_whatsapp_provider_dispatch_foundation.sql
create or replace function private.whatsapp_inbox_actor_can_use_conversation(
  p_actor_id uuid,
  p_conversation_id uuid
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.whatsapp_conversations c
    left join (select * from public.leads where deleted_at is null) l on l.id = c.lead_id
    where c.id = p_conversation_id
      -- A conversation may be lead-scoped or not. If it IS, that lead has to
      -- still be operational before ANY branch below is consulted: manage
      -- scope is a wider audience, not a way past a deleted enquiry.
      and (c.lead_id is null or l.id is not null)
      and p_actor_id is not null
      and exists (
        select 1
        from public.user_roles ur
        join public.roles r on r.id = ur.role_id
        join public.role_permissions rp on rp.role_id = r.id
        join public.permissions p on p.id = rp.permission_id
        where ur.user_id = p_actor_id
          and p.code = 'whatsapp.inbox.use'
          and r.is_system = true
          and p.is_active = true
      )
      and (
        (
          c.lead_id is null
          and exists (
            select 1
            from public.user_roles ur
            join public.roles r on r.id = ur.role_id
            join public.role_permissions rp on rp.role_id = r.id
            join public.permissions p on p.id = rp.permission_id
            where ur.user_id = p_actor_id
              and p.code = 'whatsapp.inbox.manage'
              and r.code in ('super_admin', 'sales_manager', 'management')
          )
        )
        or (
          c.lead_id is not null
          and l.assigned_to is not null
          and l.assigned_to = p_actor_id
        )
        or (
          c.lead_id is not null
          and exists (
            select 1
            from public.user_roles ur
            join public.roles r on r.id = ur.role_id
            join public.role_permissions rp on rp.role_id = r.id
            join public.permissions p on p.id = rp.permission_id
            where ur.user_id = p_actor_id
              and p.code = 'whatsapp.inbox.manage'
              and r.code in ('super_admin', 'sales_manager', 'management')
          )
        )
      )
  );
$$;

-- -----------------------------------------------------------------------------
-- create_quotation_draft
-- -----------------------------------------------------------------------------
--
-- The FIRST quotation on a lead. Every later quotation operation is unreachable for a deletable lead, because a lead that already has a quotation cannot be deleted at all.

-- source: 20260812140000_commercial_quotation_draft_foundation.sql
create or replace function public.create_quotation_draft(
  p_lead_id uuid,
  p_title text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_op_code text := 'create_quotation_draft';
  v_request_hash text;
  v_idempotency_rec record;
  v_quotation_id uuid;
  v_version_id uuid;
  v_quotation_number text;
  v_version_number integer;
  v_contact_rec record;
  v_result jsonb;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'QUOTATION_UNAUTHORIZED' using errcode = '42501';
  end if;

  if not private.quotation_can_create_for_lead(p_lead_id) then
    raise exception 'QUOTATION_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  if p_title is null or length(trim(p_title)) < 1 or length(trim(p_title)) > 200 then
    raise exception 'QUOTATION_VALIDATION_FAILED: Invalid title' using errcode = 'P0001';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 1 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'QUOTATION_VALIDATION_FAILED: Invalid idempotency key' using errcode = 'P0001';
  end if;

  v_request_hash := encode(sha256(convert_to(p_lead_id::text || '|' || trim(p_title) || '|' || trim(p_idempotency_key), 'UTF8')), 'hex');

  -- Transaction-scoped 64-bit advisory locks for idempotency & lead root lock
  perform pg_advisory_xact_lock(hashtextextended(v_actor_id::text || '|' || v_op_code || '|' || trim(p_idempotency_key), 0));
  perform pg_advisory_xact_lock(hashtextextended('quotation_root:' || p_lead_id::text, 0));

  perform 1
  from public.leads
  where id = p_lead_id
    and deleted_at is null
  for update;

  if not found then
    raise exception 'QUOTATION_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_idempotency_rec
  from private.quotation_idempotency_requests
  where actor_id = v_actor_id
    and operation_code = v_op_code
    and idempotency_key = trim(p_idempotency_key);

  if found then
    if v_idempotency_rec.request_hash = v_request_hash then
      return jsonb_build_object(
        'quotationId', v_idempotency_rec.quotation_id,
        'versionId', v_idempotency_rec.quotation_version_id,
        'quotationNumber', (select quotation_number from public.quotations where id = v_idempotency_rec.quotation_id),
        'versionNumber', (v_idempotency_rec.response_snapshot->>'versionNumber')::integer,
        'lockVersion', (v_idempotency_rec.response_snapshot->>'lockVersion')::bigint,
        'status', 'draft',
        'idempotentReplay', true,
        'dto', public.get_quotation_draft(v_idempotency_rec.quotation_id)
      );
    else
      raise exception 'IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH' using errcode = 'P0001';
    end if;
  end if;

  -- Lock existing quotation root for lead if present
  select id into v_quotation_id
  from public.quotations
  where lead_id = p_lead_id
  for update;

  -- Snapshot CRM contact / client data
  select
    c.display_name as client_name,
    max(cc_email.address_normalized) as client_email,
    max(cc_phone.address_normalized) as client_phone,
    l.locality as property_address,
    l.service_code as scope_summary
  into v_contact_rec
  from (select * from public.leads where deleted_at is null) l
  left join public.contacts c on c.id = l.contact_id
  left join public.contact_channels cc_email on cc_email.contact_id = c.id and cc_email.channel_type = 'email'
  left join public.contact_channels cc_phone on cc_phone.contact_id = c.id and cc_phone.channel_type = 'phone'
  where l.id = p_lead_id
  group by c.display_name, l.locality, l.service_code;

  if v_quotation_id is null then
    -- Create new root
    v_quotation_number := private.generate_quotation_number();
    insert into public.quotations (lead_id, quotation_number, status, created_by)
    values (p_lead_id, v_quotation_number, 'active', v_actor_id)
    returning id into v_quotation_id;

    v_version_number := 1;
  else
    -- Check if active draft exists
    if exists (
      select 1 from public.quotation_versions
      where quotation_id = v_quotation_id and status = 'draft' and is_current_draft = true
    ) then
      raise exception 'QUOTATION_DRAFT_ALREADY_EXISTS: Lead already has an active quotation draft' using errcode = 'P0001';
    end if;

    -- Root exists but no active draft (e.g. prior draft archived). Reactivate root and allocate next version
    update public.quotations set status = 'active', updated_by = v_actor_id, updated_at = now()
    where id = v_quotation_id;

    select coalesce(max(version_number), 0) + 1 into v_version_number
    from public.quotation_versions
    where quotation_id = v_quotation_id;
  end if;

  -- Insert Version 1 / next draft version
  insert into public.quotation_versions (
    quotation_id,
    version_number,
    lock_version,
    status,
    is_current_draft,
    title,
    client_name_snapshot,
    client_email_snapshot,
    client_phone_snapshot,
    property_address_snapshot,
    scope_summary,
    created_by
  ) values (
    v_quotation_id,
    v_version_number,
    1,
    'draft',
    true,
    trim(p_title),
    v_contact_rec.client_name,
    v_contact_rec.client_email,
    v_contact_rec.client_phone,
    v_contact_rec.property_address,
    v_contact_rec.scope_summary,
    v_actor_id
  )
  returning id into v_version_id;

  -- Append audit events
  if v_version_number = 1 then
    insert into public.quotation_events (quotation_id, quotation_version_id, lead_id, event_type, actor_id, details)
    values (v_quotation_id, v_version_id, p_lead_id, 'quotation.created', v_actor_id, jsonb_build_object('quotation_number', v_quotation_number));
  else
    insert into public.quotation_events (quotation_id, quotation_version_id, lead_id, event_type, actor_id, details)
    values (v_quotation_id, v_version_id, p_lead_id, 'quotation.version_created', v_actor_id, jsonb_build_object('version_number', v_version_number, 'title', trim(p_title)));
  end if;

  insert into public.quotation_events (quotation_id, quotation_version_id, lead_id, event_type, actor_id, details)
  values (v_quotation_id, v_version_id, p_lead_id, 'quotation.draft_created', v_actor_id, jsonb_build_object('version_number', v_version_number, 'title', trim(p_title)));

  v_result := jsonb_build_object(
    'quotationId', v_quotation_id,
    'versionId', v_version_id,
    'versionNumber', v_version_number,
    'lockVersion', 1,
    'status', 'draft'
  );

  insert into private.quotation_idempotency_requests (actor_id, operation_code, idempotency_key, request_hash, quotation_id, quotation_version_id, response_snapshot)
  values (v_actor_id, v_op_code, trim(p_idempotency_key), v_request_hash, v_quotation_id, v_version_id, v_result);

  return jsonb_build_object(
    'quotationId', v_quotation_id,
    'versionId', v_version_id,
    'quotationNumber', (select quotation_number from public.quotations where id = v_quotation_id),
    'versionNumber', v_version_number,
    'lockVersion', 1,
    'status', 'draft',
    'idempotentReplay', false,
    'dto', public.get_quotation_draft(v_quotation_id)
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- preview_campaign_audience
-- -----------------------------------------------------------------------------
--
-- Campaign audience. A deleted enquiry is not a marketing target.

-- source: 20260818140000_campaign_consent_audience_approval_foundation.sql
create or replace function public.preview_campaign_audience(p_campaign_version_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_version public.campaign_versions%rowtype;
  v_rule public.campaign_audience_rule_versions%rowtype;
  v_rule_match integer := 0;
  v_distinct_contacts integer := 0;
  v_consent integer := 0;
  v_dnc integer := 0;
  v_eligible integer := 0;
  v_email boolean;
  v_whatsapp boolean;
begin
  v_actor := private.marketing_require_actor('campaigns.read');
  if p_campaign_version_id is null then
    raise exception 'CAMPAIGN_VALIDATION: campaign_version_id required' using errcode = '22023';
  end if;

  select * into v_version from public.campaign_versions where id = p_campaign_version_id;
  if not found then
    raise exception 'CAMPAIGN_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;
  select * into v_rule from public.campaign_audience_rule_versions where campaign_version_id = v_version.id;

  v_email := 'email' = any (v_version.intended_channels);
  v_whatsapp := 'whatsapp' = any (v_version.intended_channels);

  with matched as (
    select l.id as lead_id, l.contact_id, c.status as contact_status
    from (select * from public.leads where deleted_at is null) l
    join public.contacts c on c.id = l.contact_id
    left join public.lead_sources ls on ls.id = l.primary_source_id
    where private.campaign_rule_group_matches_lead(
      v_rule.rule_group,
      ls.code,
      l.status,
      l.service_code,
      l.locality
    )
  )
  select
    count(*)::integer,
    count(distinct contact_id)::integer,
    count(distinct contact_id) filter (
      where private.has_current_marketing_consent(contact_id)
    )::integer,
    count(distinct contact_id) filter (
      where contact_status = 'do_not_contact'
    )::integer,
    count(distinct contact_id) filter (
      where contact_status not in ('do_not_contact', 'merged', 'archived')
        and private.has_current_marketing_consent(contact_id)
        and (
          not v_email or exists (
            select 1 from public.contact_channels ch
            where ch.contact_id = matched.contact_id
              and ch.channel_type = 'email'
              and ch.status = 'active'
          )
        )
        and (
          not v_whatsapp or exists (
            select 1 from public.contact_channels ch
            where ch.contact_id = matched.contact_id
              and ch.channel_type = 'whatsapp'
              and ch.status = 'active'
          )
        )
    )::integer
  into v_rule_match, v_distinct_contacts, v_consent, v_dnc, v_eligible
  from matched;

  return jsonb_build_object(
    'targeting_mode', v_version.targeting_mode,
    'rule_match_lead_count', coalesce(v_rule_match, 0),
    'distinct_contact_count', coalesce(v_distinct_contacts, 0),
    'current_marketing_consent_count', coalesce(v_consent, 0),
    'dnc_blocked_count', coalesce(v_dnc, 0),
    'eligible_direct_or_custom_count', case
      when v_version.targeting_mode = 'direct_or_custom' then coalesce(v_eligible, 0)
      else null
    end,
    'evaluated_at', now(),
    'preview_label', 'Current preview — eligibility will be rechecked before future execution.'
  );
end;
$$;

-- -----------------------------------------------------------------------------
-- get_campaign_metrics_board
-- -----------------------------------------------------------------------------
--
-- Campaign metrics. The lead-derived conversion counts exclude tombstones; the immutable campaign attribution evidence is untouched.

-- source: 20260821140000_campaign_metrics_conversion_feedback_foundation.sql
create or replace function public.get_campaign_metrics_board(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.authorize('campaigns.metrics.read') then
    raise exception 'CAMPAIGN_UNAUTHORIZED' using errcode = '42501';
  end if;
  if p_campaign_id is null then
    raise exception 'CAMPAIGN_VALIDATION' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'campaign_id', p_campaign_id,
    'provider', (
      with snaps as (
        select s.currency, s.spend_minor, s.impressions, s.clicks, s.provider_conversions
        from public.campaign_metric_snapshots s
        join public.campaign_runs r on r.id = s.campaign_run_id
        join public.campaign_versions v on v.id = r.campaign_version_id
        where v.campaign_id = p_campaign_id
      ),
      buckets as (
        select
          currency,
          sum(spend_minor) as spend_minor,
          sum(impressions) as impressions,
          sum(clicks) as clicks,
          sum(provider_conversions) as provider_conversions
        from snaps
        group by currency
      )
      select case
        when (select count(*) from buckets) = 0 then
          jsonb_build_object(
            'mixed_currency', false,
            'spend_minor', 0,
            'impressions', 0,
            'clicks', 0,
            'provider_conversions', 0,
            'currency', 'INR',
            'currencies', '[]'::jsonb
          )
        when (select count(*) from buckets) = 1 then
          (select jsonb_build_object(
            'mixed_currency', false,
            'spend_minor', spend_minor,
            'impressions', impressions,
            'clicks', clicks,
            'provider_conversions', provider_conversions,
            'currency', currency,
            'currencies', jsonb_build_array(jsonb_build_object(
              'currency', currency,
              'spend_minor', spend_minor,
              'impressions', impressions,
              'clicks', clicks,
              'provider_conversions', provider_conversions
            ))
          ) from buckets)
        else
          jsonb_build_object(
            'mixed_currency', true,
            'spend_minor', null,
            'impressions', (select sum(impressions) from buckets),
            'clicks', (select sum(clicks) from buckets),
            'provider_conversions', (select sum(provider_conversions) from buckets),
            'currency', null,
            'currencies', (select coalesce(jsonb_agg(jsonb_build_object(
              'currency', currency,
              'spend_minor', spend_minor,
              'impressions', impressions,
              'clicks', clicks,
              'provider_conversions', provider_conversions
            ) order by currency), '[]'::jsonb) from buckets)
          )
      end
    ),
    'crm', jsonb_build_object(
      'LeadCreated', (
        select count(*) from public.campaign_conversion_feedback_events e
        join public.campaign_runs r on r.id = e.campaign_run_id
        join public.campaign_versions v on v.id = r.campaign_version_id
        where v.campaign_id = p_campaign_id and e.conversion_type = 'LeadCreated'
      ),
      'QualifiedLead', (
        select count(*) from public.campaign_conversion_feedback_events e
        join public.campaign_runs r on r.id = e.campaign_run_id
        join public.campaign_versions v on v.id = r.campaign_version_id
        where v.campaign_id = p_campaign_id and e.conversion_type = 'QualifiedLead'
      ),
      'ConsultationScheduled', (
        select count(*) from public.campaign_conversion_feedback_events e
        join public.campaign_runs r on r.id = e.campaign_run_id
        join public.campaign_versions v on v.id = r.campaign_version_id
        where v.campaign_id = p_campaign_id and e.conversion_type = 'ConsultationScheduled'
      ),
      'ProposalSent', (
        select count(*) from public.campaign_conversion_feedback_events e
        join public.campaign_runs r on r.id = e.campaign_run_id
        join public.campaign_versions v on v.id = r.campaign_version_id
        where v.campaign_id = p_campaign_id and e.conversion_type = 'ProposalSent'
      ),
      'CommercialConversion', (
        select count(*) from public.campaign_conversion_feedback_events e
        join public.campaign_runs r on r.id = e.campaign_run_id
        join public.campaign_versions v on v.id = r.campaign_version_id
        where v.campaign_id = p_campaign_id and e.conversion_type = 'CommercialConversion'
      )
    ),
    'unattributed', (
      select count(*) from public.campaign_conversion_feedback_events e
      where e.attribution_state in ('not_attributable', 'ambiguous_target')
        and (
          exists (
            select 1
            from public.campaign_runs r
            join public.campaign_versions v on v.id = r.campaign_version_id
            where v.campaign_id = p_campaign_id
              and e.campaign_run_id = r.id
          )
          or exists (
            select 1
            from (select * from public.leads where deleted_at is null) l
            join public.campaigns c on c.campaign_reference = nullif(l.attribution->>'campaign_reference', '')
            where l.id = e.lead_id
              and c.id = p_campaign_id
          )
        )
    ),
    'feedback', coalesce((
      select jsonb_agg(jsonb_build_object(
        'event_reference', e.event_reference,
        'conversion_type', e.conversion_type,
        'attribution_state', e.attribution_state,
        'provider_submission_state', e.provider_submission_state
      ) order by e.created_at desc)
      from public.campaign_conversion_feedback_events e
      join public.campaign_runs r on r.id = e.campaign_run_id
      join public.campaign_versions v on v.id = r.campaign_version_id
      where v.campaign_id = p_campaign_id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- =============================================================================
-- F. Canonical quiescence needs a word for what happened
-- =============================================================================
--
-- `private.stop_lead_cadence_for_system` is the ONE place a cadence is stopped
-- on the system's behalf: it writes the enrollment change, the `auto_stopped`
-- enrollment event and the `cadence.stopped` activity together. Deletion must
-- go through it rather than updating the enrollment directly, or the tombstone
-- silently produces a stopped cadence with no evidence of why.
--
-- It validates its reason against a short allowlist, and none of the existing
-- values means "the enquiry was deleted". `manual_override` would be a lie
-- worth avoiding: someone reading the audit later should be able to tell a
-- deliberate override from a deletion.

alter table public.crm_lead_cadence_enrollments
  drop constraint if exists chk_crm_lead_cadence_enrollments_stop_reason;
alter table public.crm_lead_cadence_enrollments
  add constraint chk_crm_lead_cadence_enrollments_stop_reason check (
    stop_reason is null
    or stop_reason in (
      'lead_closed_won',
      'lead_closed_lost',
      'owner_not_operable',
      'manual_override',
      'cancelled_by_user',
      -- New: the enquiry itself was removed from operational surfaces.
      'lead_deleted'
    )
  );

/*
 * The system cadence stop, unchanged except for the reason it will accept.
 *
 * Everything else is the existing definition: same enrollment update, same
 * `auto_stopped` event, same `cadence.stopped` activity, same idempotent
 * conflict handling.
 */
create or replace function private.stop_lead_cadence_for_system(
  p_lead_id uuid,
  p_actor uuid,
  p_reason text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enrollment public.crm_lead_cadence_enrollments%rowtype;
  v_now timestamptz;
begin
  if p_reason not in (
    'lead_closed_won', 'lead_closed_lost', 'owner_not_operable', 'lead_deleted'
  ) then
    raise exception 'CADENCE_STOP_REASON_INVALID' using errcode = '22023';
  end if;

  select * into v_enrollment
  from public.crm_lead_cadence_enrollments
  where lead_id = p_lead_id
    and status in ('active', 'paused')
  for update;
  if not found then
    return;
  end if;

  v_now := clock_timestamp();

  update public.crm_lead_cadence_enrollments
  set status = 'stopped',
      stopped_at = v_now,
      stop_reason = p_reason,
      paused_at = null,
      updated_at = v_now
  where id = v_enrollment.id;

  insert into public.crm_cadence_enrollment_events (
    enrollment_id, lead_id, actor_id, event_type,
    previous_values, new_values, reason_code
  )
  values (
    v_enrollment.id, p_lead_id, p_actor, 'auto_stopped',
    jsonb_build_object('status', v_enrollment.status),
    jsonb_build_object('status', 'stopped', 'stopReason', p_reason),
    p_reason
  );

  insert into public.lead_activities (
    lead_id, activity_type, reference_id, actor_id, summary, metadata
  )
  values (
    p_lead_id, 'cadence.stopped', v_enrollment.id, p_actor,
    'Cadence stopped',
    jsonb_build_object('enrollmentId', v_enrollment.id, 'stopReason', p_reason)
  )
  on conflict (lead_id, activity_type, reference_id)
    where reference_id is not null do nothing;
end;
$$;

-- =============================================================================
-- G. The audit event
-- =============================================================================

alter table public.lead_events drop constraint if exists chk_lead_events_type;
alter table public.lead_events add constraint chk_lead_events_type check (
  event_type in (
    'lead.created',
    'lead.status_changed',
    'lead.assigned',
    'lead.note_added',
    'lead.duplicate_detected',
    'lead.consent_updated',
    'lead.on_hold',
    'lead.resumed',
    'lead.sales_temperature_set',
    -- Append-only, exactly once per lead. The lead's own status is untouched by
    -- deletion, so the previous one is recorded here instead of being lost.
    'lead.deleted'
  )
);

-- =============================================================================
-- H. The delete operation
-- =============================================================================

/*
 * Tombstone an enquiry.
 *
 * DOUBLE-LOCKED ON PURPOSE
 *
 * The permission AND the canonical role are both required. `leads.delete` is
 * granted to `super_admin` alone today, and if a later migration grants it
 * somewhere else by accident, that role still cannot delete anything. The test
 * suite proves this by granting the permission to a non-owner fixture and
 * showing the call still fails.
 *
 * `admin.access`, `leads.manage` and `leads.transition` are never substitutes.
 *
 * STALE-WRITE SAFE
 *
 * The caller passes the `updated_at` they were looking at. If the lead moved in
 * the meantime — reassigned, transitioned, a note added — the delete is refused
 * rather than applied to a lead the owner has not actually seen. The row is
 * locked FOR UPDATE while that is checked, so the decision cannot race.
 *
 * The confirmation string is checked server-side. A UI that forgets to ask is
 * still refused.
 */
create or replace function public.delete_lead_tombstone(
  p_lead_id uuid,
  p_reason text,
  p_expected_updated_at timestamptz,
  p_confirmation text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_lead public.leads%rowtype;
  v_reason text;
  v_reference uuid;
  v_deleted_at timestamptz;
  v_follow_up_id uuid;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'CRM_LEAD_DELETE_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.profiles pr where pr.id = v_actor and pr.status = 'active'
  ) then
    raise exception 'CRM_LEAD_DELETE_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not (select public.authorize('leads.delete')) then
    raise exception 'CRM_LEAD_DELETE_PERMISSION_DENIED' using errcode = '42501';
  end if;

  -- The second lock. See the docblock: a stray future grant must not be enough.
  if not (select private.has_role('super_admin')) then
    raise exception 'CRM_LEAD_DELETE_SUPER_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  if p_lead_id is null or p_expected_updated_at is null then
    raise exception 'CRM_LEAD_DELETE_INVALID_INPUT' using errcode = '22023';
  end if;

  if coalesce(p_confirmation, '') <> 'DELETE' then
    raise exception 'CRM_LEAD_DELETE_CONFIRMATION_REQUIRED' using errcode = '22023';
  end if;

  v_reason := trim(coalesce(p_reason, ''));
  if length(v_reason) < 10 or length(v_reason) > 500 then
    raise exception 'CRM_LEAD_DELETE_REASON_INVALID' using errcode = '22023';
  end if;

  /*
   * SERIALIZATION AGAINST THE FIRST QUOTATION.
   *
   * `create_quotation_draft` decides whether a lead may take a quotation BEFORE
   * it takes this lock, so without sharing it the two can interleave: the
   * quotation path passes its check, the delete commits, and the quotation is
   * then written against a lead that is already a tombstone — the converted
   * blocker satisfied on both sides and violated in the result.
   *
   * Both paths now take THIS lock first and the lead row second. Same key, same
   * order, so whichever arrives second sees the other's committed decision.
   */
  perform pg_advisory_xact_lock(
    hashtextextended('quotation_root:' || p_lead_id::text, 0)
  );

  select * into v_lead from public.leads where id = p_lead_id for update;
  if v_lead.id is null then
    raise exception 'CRM_LEAD_DELETE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_lead.deleted_at is not null then
    -- Deterministic and idempotent-safe: a second delete changes nothing and
    -- writes no second event.
    raise exception 'CRM_LEAD_ALREADY_DELETED' using errcode = '22023';
  end if;

  if v_lead.updated_at is distinct from p_expected_updated_at then
    raise exception 'CRM_LEAD_DELETE_STALE' using errcode = '40001';
  end if;

  /*
   * MATERIALLY CONVERTED — fail closed.
   *
   * A lead that reached a quotation, an acceptance or a project has commercial
   * and project history hanging off it. Deleting it would either orphan that
   * history or invite someone to cascade it away later. Conservative on
   * purpose: Closed Lost remains the right answer for a genuine sales loss.
   */
  if v_lead.status = 'closed_won'
     or exists (select 1 from public.quotations q where q.lead_id = p_lead_id)
     or exists (select 1 from public.quotation_acceptances qa where qa.lead_id = p_lead_id)
     or exists (select 1 from public.projects p where p.lead_id = p_lead_id)
  then
    raise exception 'CRM_LEAD_DELETE_CONVERTED_BLOCKED' using errcode = '42501';
  end if;

  /*
   * QUIESCENCE FIRST, WHILE THE LEAD IS STILL OPERATIONAL.
   *
   * Both canonical helpers refuse to act on a lead they cannot see —
   * `cancel_lead_follow_up_impl` goes through `crm_can_view_lead_by_id`, which
   * this migration teaches to reject tombstones. So the work is quiesced before
   * the tombstone is written, not after.
   *
   * They are used rather than a direct UPDATE because they are where the
   * evidence is written: the follow-up cancellation event, the primary_cleared
   * event when the follow-up was someone's next action, the cadence
   * auto_stopped event, and the matching lead activities. A feature whose whole
   * claim is "audit-preserving" cannot quietly skip the audit its own children
   * already produce.
   */
  for v_follow_up_id in
    select id from public.lead_follow_ups
    where lead_id = p_lead_id and status = 'open'
    order by due_at
  loop
    perform private.cancel_lead_follow_up_impl(
      v_follow_up_id,
      'Enquiry deleted'
    );
  end loop;

  perform private.stop_lead_cadence_for_system(p_lead_id, v_actor, 'lead_deleted');

  v_reference := gen_random_uuid();
  v_deleted_at := now();

  -- The CRM RPC escape hatch, exactly as the transition RPCs use it.
  perform set_config('onedecore.crm_transition', '1', true);

  update public.leads
     set deleted_at = v_deleted_at,
         deleted_by = v_actor,
         delete_reason = v_reason,
         deletion_reference = v_reference
   where id = p_lead_id;

  perform set_config('onedecore.crm_transition', '0', true);

  insert into public.lead_events (lead_id, event_type, actor_type, actor_id, occurred_at, event_data)
  values (
    p_lead_id,
    'lead.deleted',
    'staff',
    v_actor,
    v_deleted_at,
    jsonb_build_object(
      'version', 'lead_delete_v1',
      'deletionReference', v_reference,
      'reason', v_reason,
      'previousStatus', v_lead.status,
      'previousAssignee', v_lead.assigned_to,
      'expectedUpdatedAt', p_expected_updated_at
    )
  );

  return jsonb_build_object(
    'lead_id', p_lead_id,
    'deletion_reference', v_reference,
    'deleted_at', v_deleted_at
  );
end;
$$;

alter function public.delete_lead_tombstone(uuid, text, timestamptz, text) owner to postgres;
revoke all on function public.delete_lead_tombstone(uuid, text, timestamptz, text) from public, anon;
grant execute on function public.delete_lead_tombstone(uuid, text, timestamptz, text) to authenticated;

commit;
