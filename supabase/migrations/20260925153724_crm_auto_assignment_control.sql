-- CRM cleanup — governed auto-assignment switch for future website leads only.
-- Default is OFF. This migration never backfills or assigns an existing lead.

create table public.crm_assignment_settings (
  singleton boolean primary key default true,
  auto_assignment_enabled boolean not null default false,
  enabled_by uuid references public.profiles(id) on delete restrict,
  enabled_at timestamptz,
  updated_by uuid references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),

  constraint chk_crm_assignment_settings_singleton check (singleton = true),
  constraint chk_crm_assignment_settings_enabled_actor check (
    auto_assignment_enabled = false
    or (enabled_by is not null and enabled_at is not null)
  )
);

comment on table public.crm_assignment_settings is
  'Singleton CRM assignment control. Auto assignment is OFF by default and applies only to future eligible lead inserts.';

insert into public.crm_assignment_settings (singleton, auto_assignment_enabled)
values (true, false)
on conflict (singleton) do nothing;

create table public.crm_assignment_setting_events (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles(id) on delete restrict,
  previous_enabled boolean not null,
  new_enabled boolean not null,
  reason text,
  occurred_at timestamptz not null default now(),

  constraint chk_crm_assignment_setting_events_change check (
    previous_enabled is distinct from new_enabled
  ),
  constraint chk_crm_assignment_setting_events_reason check (
    reason is null or length(trim(reason)) between 1 and 500
  )
);

comment on table public.crm_assignment_setting_events is
  'Append-only audit for the global CRM auto-assignment switch.';

create index idx_crm_assignment_setting_events_occurred
  on public.crm_assignment_setting_events (occurred_at desc);

create trigger trg_crm_assignment_setting_events_no_update
  before update on public.crm_assignment_setting_events
  for each row execute function private.forbid_append_only_mutation();

create trigger trg_crm_assignment_setting_events_no_delete
  before delete on public.crm_assignment_setting_events
  for each row execute function private.forbid_append_only_mutation();

alter table public.crm_assignment_settings enable row level security;
alter table public.crm_assignment_setting_events enable row level security;

revoke all on public.crm_assignment_settings from public, anon, authenticated;
revoke all on public.crm_assignment_setting_events from public, anon, authenticated;

create or replace function public.get_crm_auto_assignment_setting()
returns table (
  enabled boolean,
  can_manage boolean,
  enabled_by uuid,
  enabled_at timestamptz,
  updated_by uuid,
  updated_at timestamptz
)
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'CRM_AUTO_ASSIGNMENT_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not (
    (select public.authorize('leads.assignment_rules.manage'))
    or (select private.has_role('super_admin'))
  ) then
    raise exception 'CRM_AUTO_ASSIGNMENT_PERMISSION_DENIED' using errcode = '42501';
  end if;

  return query
  select
    s.auto_assignment_enabled,
    (select private.has_role('super_admin')),
    s.enabled_by,
    s.enabled_at,
    s.updated_by,
    s.updated_at
  from public.crm_assignment_settings s
  where s.singleton = true;
end;
$$;

alter function public.get_crm_auto_assignment_setting() owner to postgres;
revoke all on function public.get_crm_auto_assignment_setting()
  from public, anon;
grant execute on function public.get_crm_auto_assignment_setting()
  to authenticated;

create or replace function public.set_crm_auto_assignment_enabled(
  p_enabled boolean,
  p_reason text default null
)
returns table (
  enabled boolean,
  can_manage boolean,
  enabled_by uuid,
  enabled_at timestamptz,
  updated_by uuid,
  updated_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_setting public.crm_assignment_settings%rowtype;
  v_reason text;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'CRM_AUTO_ASSIGNMENT_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not (select private.has_role('super_admin')) then
    raise exception 'CRM_AUTO_ASSIGNMENT_SUPER_ADMIN_REQUIRED' using errcode = '42501';
  end if;

  if p_enabled is null then
    raise exception 'CRM_AUTO_ASSIGNMENT_VALUE_REQUIRED' using errcode = '22023';
  end if;

  if p_enabled and not exists (
    select 1
    from public.lead_assignment_rules r
    where r.is_active = true
      and private.crm_is_assignable_sales_user(r.target_user_id)
  ) then
    raise exception 'CRM_AUTO_ASSIGNMENT_NO_ELIGIBLE_RULE'
      using errcode = '22023',
            hint = 'Create and enable at least one rule targeting an active Sales Executive.';
  end if;

  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if v_reason is not null and length(v_reason) > 500 then
    raise exception 'CRM_AUTO_ASSIGNMENT_REASON_INVALID' using errcode = '22023';
  end if;

  select * into v_setting
  from public.crm_assignment_settings
  where singleton = true
  for update;

  if not found then
    raise exception 'CRM_AUTO_ASSIGNMENT_SETTING_MISSING' using errcode = 'P0002';
  end if;

  if v_setting.auto_assignment_enabled is distinct from p_enabled then
    insert into public.crm_assignment_setting_events (
      actor_id, previous_enabled, new_enabled, reason
    ) values (
      v_actor,
      v_setting.auto_assignment_enabled,
      p_enabled,
      v_reason
    );

    update public.crm_assignment_settings
    set auto_assignment_enabled = p_enabled,
        enabled_by = case when p_enabled then v_actor else enabled_by end,
        enabled_at = case when p_enabled then now() else enabled_at end,
        updated_by = v_actor,
        updated_at = now()
    where singleton = true
    returning * into v_setting;
  end if;

  return query
  select
    v_setting.auto_assignment_enabled,
    true,
    v_setting.enabled_by,
    v_setting.enabled_at,
    v_setting.updated_by,
    v_setting.updated_at;
end;
$$;

alter function public.set_crm_auto_assignment_enabled(boolean, text)
  owner to postgres;
revoke all on function public.set_crm_auto_assignment_enabled(boolean, text)
  from public, anon;
grant execute on function public.set_crm_auto_assignment_enabled(boolean, text)
  to authenticated;

create or replace function private.crm_auto_assign_new_lead()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_setting public.crm_assignment_settings%rowtype;
  v_resolution record;
  v_lead public.leads%rowtype;
  v_history_id uuid;
begin
  -- Imports retain their explicit import assignment behaviour; manual creation
  -- retains its explicit assignee choice. This switch is only for public intake.
  if NEW.entry_method not in ('public_intake', 'local_test')
     or NEW.assigned_to is not null
     or NEW.status <> 'new'
  then
    return NEW;
  end if;

  select * into v_setting
  from public.crm_assignment_settings
  where singleton = true;

  if not found
     or v_setting.auto_assignment_enabled is not true
     or v_setting.enabled_by is null
  then
    return NEW;
  end if;

  select * into v_resolution
  from private.crm_resolve_lead_assignment_rule(
    NEW.primary_source_id,
    NEW.service_code,
    NEW.locality,
    NEW.budget_comfort_code
  )
  limit 1;

  if v_resolution.assignee_id is null then
    return NEW;
  end if;

  perform set_config('onedecore.crm_transition', '1', true);

  update public.leads
  set assigned_to = v_resolution.assignee_id,
      status = 'assigned',
      updated_at = now()
  where id = NEW.id
    and assigned_to is null
    and status = 'new'
  returning * into v_lead;

  if not found then
    perform set_config('onedecore.crm_transition', '0', true);
    return NEW;
  end if;

  insert into public.lead_assignment_history (
    lead_id, previous_assignee, new_assignee,
    assignment_method, actor_id, reason, metadata
  ) values (
    v_lead.id,
    null,
    v_resolution.assignee_id,
    'source_rule',
    v_setting.enabled_by,
    null,
    jsonb_build_object(
      'autoAssignment', true,
      'assignmentRuleId', v_resolution.matched_rule_id,
      'resolutionCode', v_resolution.resolution_code,
      'configuredBy', v_setting.enabled_by
    )
  )
  returning id into v_history_id;

  insert into public.lead_events (
    lead_id, event_type, actor_id, actor_type, event_data
  ) values (
    v_lead.id,
    'lead.assigned',
    v_setting.enabled_by,
    'system',
    jsonb_build_object(
      'previousAssignee', null,
      'newAssignee', v_resolution.assignee_id,
      'method', 'source_rule',
      'mode', 'assign',
      'onCreate', true,
      'autoAssignment', true,
      'assignmentRuleId', v_resolution.matched_rule_id
    )
  );

  insert into public.lead_activities (
    lead_id, activity_type, reference_id, actor_id, summary, metadata
  ) values (
    v_lead.id,
    'assignment.changed',
    v_history_id,
    v_setting.enabled_by,
    'Lead auto-assigned via source rule',
    jsonb_build_object(
      'newAssignee', v_resolution.assignee_id,
      'method', 'source_rule',
      'onCreate', true,
      'autoAssignment', true,
      'assignmentRuleId', v_resolution.matched_rule_id
    )
  );

  -- Reuse the canonical SLA automation. The enabling Super Admin is the
  -- governance actor; the task owner is the resolved salesperson.
  perform private.ensure_first_contact_sla_clock(v_lead.id);
  perform private.ensure_sla_first_contact_primary(
    v_lead.id,
    v_resolution.assignee_id,
    v_setting.enabled_by
  );

  perform set_config('onedecore.crm_transition', '0', true);
  return NEW;
end;
$$;

comment on function private.crm_auto_assign_new_lead() is
  'Assigns only future public-intake/local-test leads when the global switch is ON. Reuses source rules and canonical SLA First Contact automation; never backfills.';

revoke all on function private.crm_auto_assign_new_lead()
  from public, anon, authenticated;
alter function private.crm_auto_assign_new_lead() owner to postgres;

drop trigger if exists trg_leads_after_insert_auto_assignment on public.leads;

-- Deferred so lead.created/consent writes finish before assignment audit is added.
create constraint trigger trg_leads_after_insert_auto_assignment
  after insert on public.leads
  deferrable initially deferred
  for each row
  execute function private.crm_auto_assign_new_lead();

comment on table public.lead_assignment_rules is
  'Source-based CRM assignment rules. Used by bulk import and, when explicitly enabled, future public lead auto-assignment.';
