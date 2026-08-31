-- =============================================================================
-- CRM 2C — Sales Playbook + Cadences foundation (forward-only)
-- Owner locks D1..D10 (2026-08-30). Stage gates at the canonical transition
-- authority; one-step-at-a-time cadences on the canonical activity table.
--
-- Does NOT: activate SLA, configure business hours, seed cadence templates,
-- send WhatsApp, add a scheduler/worker/queue, or create a second state machine.
-- =============================================================================

-- =============================================================================
-- A. Permission — crm.cadences.manage (D3: super_admin + sales_manager)
-- =============================================================================

insert into public.permissions (code, name, description, is_system, is_active)
values (
  'crm.cadences.manage',
  'Manage CRM Cadence Templates',
  'Create, edit, publish and archive CRM sales cadence templates',
  true,
  true
)
on conflict (code) do update
set
  name = excluded.name,
  description = excluded.description,
  is_system = excluded.is_system,
  is_active = excluded.is_active;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where p.code = 'crm.cadences.manage'
  and r.code in ('super_admin', 'sales_manager')
on conflict do nothing;

-- =============================================================================
-- B. public.crm_cadence_templates
-- =============================================================================

create table public.crm_cadence_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  status text not null default 'draft',
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid references public.profiles (id) on delete set null,
  published_at timestamptz,
  published_by uuid references public.profiles (id) on delete set null,
  archived_at timestamptz,
  archived_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_crm_cadence_templates_status
    check (status in ('draft', 'published', 'archived')),
  constraint chk_crm_cadence_templates_name
    check (length(trim(name)) between 2 and 120),
  constraint chk_crm_cadence_templates_description
    check (description is null or length(trim(description)) between 1 and 500),
  constraint chk_crm_cadence_templates_publish_stamp check (
    (status = 'draft' and published_at is null)
    or (status = 'published' and published_at is not null)
    or status = 'archived'
  ),
  constraint chk_crm_cadence_templates_archive_stamp check (
    (status = 'archived' and archived_at is not null)
    or (status <> 'archived' and archived_at is null)
  )
);

comment on table public.crm_cadence_templates is
  'CRM 2C cadence playbook definition. draft -> published -> archived. Published steps are frozen; revise by duplicating to a new draft. No production seeds.';

create unique index uq_crm_cadence_templates_name_active
  on public.crm_cadence_templates (lower(name))
  where status <> 'archived';

create index idx_crm_cadence_templates_status
  on public.crm_cadence_templates (status, name);

create trigger trg_crm_cadence_templates_updated_at
  before update on public.crm_cadence_templates
  for each row execute function private.set_updated_at();

alter table public.crm_cadence_templates enable row level security;

revoke all on table public.crm_cadence_templates from public, anon, authenticated;
grant select on table public.crm_cadence_templates to authenticated;

create policy crm_cadence_templates_select
  on public.crm_cadence_templates
  for select
  to authenticated
  using (
    (select public.authorize('crm.cadences.manage'))
    or (select public.authorize('crm.follow_ups.manage'))
    or (select public.authorize('crm.activities.read'))
  );

-- =============================================================================
-- C. public.crm_cadence_steps
-- =============================================================================

create table public.crm_cadence_steps (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.crm_cadence_templates (id) on delete cascade,
  step_order smallint not null,
  delay_hours integer not null,
  activity_type text not null,
  title text not null,
  priority text not null default 'normal',
  duration_minutes smallint,
  reminder_offset_minutes integer,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_crm_cadence_steps_order check (step_order between 1 and 50),
  constraint chk_crm_cadence_steps_delay_hours check (delay_hours between 0 and 2160),
  constraint chk_crm_cadence_steps_activity_type check (
    activity_type in (
      'call',
      'whatsapp',
      'consultation',
      'site_visit',
      'quotation_follow_up',
      'internal_task'
    )
  ),
  constraint chk_crm_cadence_steps_title check (length(trim(title)) between 1 and 120),
  constraint chk_crm_cadence_steps_priority check (
    priority in ('low', 'normal', 'high', 'urgent')
  ),
  constraint chk_crm_cadence_steps_duration_minutes check (
    duration_minutes is null or duration_minutes between 1 and 1440
  ),
  constraint chk_crm_cadence_steps_reminder_offset check (
    reminder_offset_minutes is null or reminder_offset_minutes between 0 and 10080
  ),
  constraint uq_crm_cadence_steps_order unique (template_id, step_order)
);

comment on table public.crm_cadence_steps is
  'Ordered human follow-up tasks for a cadence template. delay_hours is relative to enrollment (step 1) or to completion of the previous step. Every materialized step becomes the lead primary next action.';

comment on column public.crm_cadence_steps.activity_type is
  'Mirrors chk_lead_follow_ups_activity_type. A whatsapp step is an internal human task only — CRM 2C never sends.';

create trigger trg_crm_cadence_steps_updated_at
  before update on public.crm_cadence_steps
  for each row execute function private.set_updated_at();

-- Published/archived templates freeze their steps.
create or replace function private.trg_crm_cadence_steps_draft_only()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_template_id uuid;
  v_status text;
begin
  v_template_id := case when TG_OP = 'DELETE' then OLD.template_id else NEW.template_id end;

  select status into v_status
  from public.crm_cadence_templates
  where id = v_template_id;

  if v_status is distinct from 'draft' then
    raise exception 'CADENCE_TEMPLATE_NOT_EDITABLE' using errcode = '22023';
  end if;

  return case when TG_OP = 'DELETE' then OLD else NEW end;
end;
$$;

revoke all on function private.trg_crm_cadence_steps_draft_only() from public, anon, authenticated;

create trigger trg_crm_cadence_steps_draft_only
  before insert or update or delete on public.crm_cadence_steps
  for each row execute function private.trg_crm_cadence_steps_draft_only();

alter table public.crm_cadence_steps enable row level security;

revoke all on table public.crm_cadence_steps from public, anon, authenticated;
grant select on table public.crm_cadence_steps to authenticated;

create policy crm_cadence_steps_select
  on public.crm_cadence_steps
  for select
  to authenticated
  using (
    (select public.authorize('crm.cadences.manage'))
    or (select public.authorize('crm.follow_ups.manage'))
    or (select public.authorize('crm.activities.read'))
  );

-- =============================================================================
-- D. public.crm_lead_cadence_enrollments
-- =============================================================================

create table public.crm_lead_cadence_enrollments (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete restrict,
  template_id uuid not null references public.crm_cadence_templates (id) on delete restrict,
  status text not null default 'active',
  current_step_order smallint,
  stop_reason text,
  enrolled_by uuid not null references public.profiles (id) on delete restrict,
  enrolled_at timestamptz not null default now(),
  paused_at timestamptz,
  completed_at timestamptz,
  stopped_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_crm_lead_cadence_enrollments_status check (
    status in ('active', 'paused', 'completed', 'stopped')
  ),
  constraint chk_crm_lead_cadence_enrollments_stop_reason check (
    stop_reason is null
    or stop_reason in (
      'lead_closed_won',
      'lead_closed_lost',
      'owner_not_operable',
      'manual_override',
      'cancelled_by_user'
    )
  ),
  constraint chk_crm_lead_cadence_enrollments_step_order check (
    current_step_order is null or current_step_order between 1 and 50
  ),
  constraint chk_crm_lead_cadence_enrollments_terminal_stamp check (
    (status = 'stopped' and stopped_at is not null and stop_reason is not null)
    or (status = 'completed' and completed_at is not null and stop_reason is null)
    or (status in ('active', 'paused') and stopped_at is null and completed_at is null and stop_reason is null)
  ),
  constraint chk_crm_lead_cadence_enrollments_pause_stamp check (
    status <> 'paused' or paused_at is not null
  )
);

comment on table public.crm_lead_cadence_enrollments is
  'CRM 2C manual cadence enrollment. At most one active/paused enrollment per lead. current_step_order is the last materialized step; the next step materializes only on completion of the current one.';

-- D5 owner lock: one live cadence per lead.
create unique index uq_crm_lead_cadence_enrollments_one_live
  on public.crm_lead_cadence_enrollments (lead_id)
  where status in ('active', 'paused');

create index idx_crm_lead_cadence_enrollments_lead_created
  on public.crm_lead_cadence_enrollments (lead_id, created_at desc);

create index idx_crm_lead_cadence_enrollments_template_live
  on public.crm_lead_cadence_enrollments (template_id)
  where status in ('active', 'paused');

create trigger trg_crm_lead_cadence_enrollments_updated_at
  before update on public.crm_lead_cadence_enrollments
  for each row execute function private.set_updated_at();

alter table public.crm_lead_cadence_enrollments enable row level security;

revoke all on table public.crm_lead_cadence_enrollments from public, anon, authenticated;
grant select on table public.crm_lead_cadence_enrollments to authenticated;

create policy crm_lead_cadence_enrollments_select
  on public.crm_lead_cadence_enrollments
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.leads l
      where l.id = crm_lead_cadence_enrollments.lead_id
        and (select private.crm_can_view_lead(l.assigned_to))
    )
  );

-- =============================================================================
-- E. public.crm_cadence_enrollment_events (append-only)
-- =============================================================================

create table public.crm_cadence_enrollment_events (
  id uuid primary key default gen_random_uuid(),
  enrollment_id uuid not null references public.crm_lead_cadence_enrollments (id) on delete restrict,
  lead_id uuid not null references public.leads (id) on delete restrict,
  follow_up_id uuid references public.lead_follow_ups (id) on delete restrict,
  actor_id uuid references public.profiles (id) on delete set null,
  event_type text not null,
  previous_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  reason_code text,
  created_at timestamptz not null default now(),

  constraint chk_crm_cadence_enrollment_events_event_type check (
    event_type in (
      'enrolled',
      'step_materialized',
      'paused',
      'resumed',
      'cancelled',
      'auto_stopped',
      'completed'
    )
  ),
  constraint chk_crm_cadence_enrollment_events_previous_values check (
    jsonb_typeof(previous_values) = 'object'
    and pg_column_size(previous_values) <= 2048
  ),
  constraint chk_crm_cadence_enrollment_events_new_values check (
    jsonb_typeof(new_values) = 'object'
    and pg_column_size(new_values) <= 2048
  ),
  constraint chk_crm_cadence_enrollment_events_reason_code check (
    reason_code is null or length(trim(reason_code)) between 1 and 64
  )
);

comment on table public.crm_cadence_enrollment_events is
  'Append-only cadence enrollment lifecycle audit. Required because lead_follow_up_events is follow-up scoped and lead_activities dedupes on (lead_id, activity_type, reference_id). References the canonical activity via follow_up_id instead of duplicating activity audit.';

create index idx_crm_cadence_enrollment_events_enrollment_created
  on public.crm_cadence_enrollment_events (enrollment_id, created_at desc);

create index idx_crm_cadence_enrollment_events_lead_created
  on public.crm_cadence_enrollment_events (lead_id, created_at desc);

create or replace function private.trg_crm_cadence_enrollment_events_same_lead()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.crm_lead_cadence_enrollments e
    where e.id = NEW.enrollment_id
      and e.lead_id = NEW.lead_id
  ) then
    raise exception 'crm_cadence_enrollment_events.lead_id must match enrollment.lead_id'
      using errcode = '23514';
  end if;

  if NEW.follow_up_id is not null and not exists (
    select 1
    from public.lead_follow_ups f
    where f.id = NEW.follow_up_id
      and f.lead_id = NEW.lead_id
  ) then
    raise exception 'crm_cadence_enrollment_events.follow_up_id must belong to the same lead'
      using errcode = '23514';
  end if;

  return NEW;
end;
$$;

revoke all on function private.trg_crm_cadence_enrollment_events_same_lead()
  from public, anon, authenticated;

create trigger trg_crm_cadence_enrollment_events_same_lead
  before insert on public.crm_cadence_enrollment_events
  for each row
  execute function private.trg_crm_cadence_enrollment_events_same_lead();

create trigger trg_crm_cadence_enrollment_events_no_update
  before update on public.crm_cadence_enrollment_events
  for each row
  execute function private.forbid_append_only_mutation();

create trigger trg_crm_cadence_enrollment_events_no_delete
  before delete on public.crm_cadence_enrollment_events
  for each row
  execute function private.forbid_append_only_mutation();

alter table public.crm_cadence_enrollment_events enable row level security;

revoke all on table public.crm_cadence_enrollment_events from public, anon, authenticated;
grant select on table public.crm_cadence_enrollment_events to authenticated;

create policy crm_cadence_enrollment_events_select
  on public.crm_cadence_enrollment_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.leads l
      where l.id = crm_cadence_enrollment_events.lead_id
        and (select private.crm_can_view_lead(l.assigned_to))
    )
  );

-- =============================================================================
-- F. Cadence provenance on public.lead_follow_ups (additive, no backfill)
-- =============================================================================

alter table public.lead_follow_ups
  add column if not exists cadence_enrollment_id uuid,
  add column if not exists cadence_step_id uuid;

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'lead_follow_ups_cadence_enrollment_id_fkey'
      and conrelid = 'public.lead_follow_ups'::regclass
  ) then
    alter table public.lead_follow_ups
      add constraint lead_follow_ups_cadence_enrollment_id_fkey
      foreign key (cadence_enrollment_id)
      references public.crm_lead_cadence_enrollments (id)
      on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'lead_follow_ups_cadence_step_id_fkey'
      and conrelid = 'public.lead_follow_ups'::regclass
  ) then
    alter table public.lead_follow_ups
      add constraint lead_follow_ups_cadence_step_id_fkey
      foreign key (cadence_step_id)
      references public.crm_cadence_steps (id)
      on delete restrict;
  end if;
end;
$$;

-- Widen the source allowlist: existing rows stay valid.
alter table public.lead_follow_ups
  drop constraint if exists chk_lead_follow_ups_source;

alter table public.lead_follow_ups
  add constraint chk_lead_follow_ups_source check (
    source in (
      'manual',
      'sla_auto',
      'completion_chain',
      'on_hold_review',
      'import',
      'cadence'
    )
  );

alter table public.lead_follow_ups
  drop constraint if exists chk_lead_follow_ups_cadence_provenance;

alter table public.lead_follow_ups
  add constraint chk_lead_follow_ups_cadence_provenance check (
    (cadence_enrollment_id is null and cadence_step_id is null and source <> 'cadence')
    or (cadence_enrollment_id is not null and cadence_step_id is not null and source = 'cadence')
  );

comment on column public.lead_follow_ups.cadence_enrollment_id is
  'CRM 2C provenance. Immutable link to the enrollment that materialized this activity. NULL for manual/automation activities.';

-- Replay/idempotency: a cadence step materializes at most once per enrollment.
create unique index if not exists uq_lead_follow_ups_cadence_step
  on public.lead_follow_ups (cadence_enrollment_id, cadence_step_id)
  where cadence_enrollment_id is not null;

create index if not exists idx_lead_follow_ups_cadence_open
  on public.lead_follow_ups (cadence_enrollment_id)
  where status = 'open' and cadence_enrollment_id is not null;

-- =============================================================================
-- G. lead_activities allowlist — one-shot cadence timeline summaries
-- =============================================================================

alter table public.lead_activities
  drop constraint if exists chk_lead_activities_type;

alter table public.lead_activities
  add constraint chk_lead_activities_type check (
    activity_type in (
      'note.created',
      'follow_up.scheduled',
      'follow_up.auto_created',
      'follow_up.completed',
      'follow_up.cancelled',
      'follow_up.sla_breached',
      'status.changed',
      'assignment.changed',
      'lead.manual_created',
      'lead.bulk_imported',
      'cadence.enrolled',
      'cadence.completed',
      'cadence.stopped'
    )
  );
-- =============================================================================
-- H. Cadence engine helpers (internal; no authenticated execute)
-- =============================================================================

create or replace function private.crm_cadence_next_step(
  p_template_id uuid,
  p_after_order smallint
)
returns public.crm_cadence_steps
language sql
stable
security definer
set search_path = ''
as $$
  select s.*
  from public.crm_cadence_steps s
  where s.template_id = p_template_id
    and s.step_order > coalesce(p_after_order, 0::smallint)
  order by s.step_order asc
  limit 1;
$$;

comment on function private.crm_cadence_next_step(uuid, smallint) is
  'CRM 2C: next cadence step strictly after p_after_order. One-at-a-time progression; never returns more than one row.';

-- Materialize exactly one cadence step as the lead primary next action.
-- Caller must already hold the lead lock and have cleared any open primary.
create or replace function private.materialize_cadence_step(
  p_enrollment_id uuid,
  p_step_id uuid,
  p_owner_id uuid,
  p_actor uuid,
  p_now timestamptz
)
returns public.lead_follow_ups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enrollment public.crm_lead_cadence_enrollments%rowtype;
  v_step public.crm_cadence_steps%rowtype;
  v_due_at timestamptz;
  v_reminder_at timestamptz;
  v_row public.lead_follow_ups%rowtype;
begin
  select * into v_enrollment
  from public.crm_lead_cadence_enrollments
  where id = p_enrollment_id
  for update;
  if not found then
    raise exception 'CADENCE_ENROLLMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_step
  from public.crm_cadence_steps
  where id = p_step_id
    and template_id = v_enrollment.template_id;
  if not found then
    raise exception 'CADENCE_NEXT_STEP_UNAVAILABLE' using errcode = '22023';
  end if;

  v_due_at := p_now + make_interval(hours => v_step.delay_hours);
  v_reminder_at := case
    when v_step.reminder_offset_minutes is null then null
    else v_due_at - make_interval(mins => v_step.reminder_offset_minutes)
  end;

  insert into public.lead_follow_ups (
    lead_id, owner_id, due_at, status, created_by,
    activity_type, title, priority, is_primary_next_action,
    duration_minutes, reminder_at, quotation_id, source, updated_at,
    cadence_enrollment_id, cadence_step_id
  ) values (
    v_enrollment.lead_id, p_owner_id, v_due_at, 'open', p_actor,
    v_step.activity_type, v_step.title, v_step.priority, true,
    v_step.duration_minutes, v_reminder_at, null, 'cadence', p_now,
    v_enrollment.id, v_step.id
  )
  returning * into v_row;

  insert into public.lead_follow_up_events (
    follow_up_id, lead_id, actor_id, event_type,
    previous_values, new_values, reason_code, reason_note
  )
  values (
    v_row.id, v_enrollment.lead_id, p_actor, 'created',
    '{}'::jsonb,
    jsonb_strip_nulls(jsonb_build_object(
      'activityType', v_step.activity_type,
      'title', v_step.title,
      'dueAt', v_due_at,
      'priority', v_step.priority,
      'ownerId', p_owner_id,
      'isPrimaryNextAction', true,
      'source', 'cadence',
      'durationMinutes', v_step.duration_minutes,
      'reminderAt', v_reminder_at,
      'cadenceEnrollmentId', v_enrollment.id,
      'cadenceStepOrder', v_step.step_order
    )),
    'cadence', null
  );

  insert into public.lead_follow_up_events (
    follow_up_id, lead_id, actor_id, event_type,
    previous_values, new_values, reason_code, reason_note
  )
  values (
    v_row.id, v_enrollment.lead_id, p_actor, 'primary_designated',
    jsonb_build_object('isPrimaryNextAction', false),
    jsonb_build_object('isPrimaryNextAction', true),
    'cadence', null
  );

  insert into public.lead_activities (
    lead_id, activity_type, reference_id, actor_id, summary, metadata
  )
  values (
    v_enrollment.lead_id,
    'follow_up.scheduled',
    v_row.id,
    p_actor,
    'Follow-up scheduled',
    jsonb_strip_nulls(jsonb_build_object(
      'dueAt', v_due_at,
      'ownerId', p_owner_id,
      'activityType', v_step.activity_type,
      'title', v_step.title,
      'priority', v_step.priority,
      'isPrimaryNextAction', true,
      'source', 'cadence',
      'cadenceStepOrder', v_step.step_order
    ))
  );

  update public.crm_lead_cadence_enrollments
  set current_step_order = v_step.step_order,
      updated_at = p_now
  where id = v_enrollment.id;

  insert into public.crm_cadence_enrollment_events (
    enrollment_id, lead_id, follow_up_id, actor_id, event_type,
    previous_values, new_values, reason_code
  )
  values (
    v_enrollment.id, v_enrollment.lead_id, v_row.id, p_actor, 'step_materialized',
    jsonb_strip_nulls(jsonb_build_object('currentStepOrder', v_enrollment.current_step_order)),
    jsonb_build_object('currentStepOrder', v_step.step_order, 'dueAt', v_due_at),
    null
  );

  return v_row;
end;
$$;

comment on function private.materialize_cadence_step(uuid, uuid, uuid, uuid, timestamptz) is
  'CRM 2C: create exactly one cadence step as a canonical lead_follow_ups primary next action (source=cadence). Never sends any message.';

-- Cadence stops advancing the moment a human resolves the step another way.
create or replace function private.finalize_lead_cadence_after_manual_resolution(
  p_enrollment_id uuid,
  p_actor uuid,
  p_now timestamptz
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enrollment public.crm_lead_cadence_enrollments%rowtype;
  v_next public.crm_cadence_steps%rowtype;
begin
  select * into v_enrollment
  from public.crm_lead_cadence_enrollments
  where id = p_enrollment_id
  for update;
  if not found or v_enrollment.status not in ('active', 'paused') then
    return;
  end if;

  select * into v_next
  from private.crm_cadence_next_step(v_enrollment.template_id, v_enrollment.current_step_order);

  if v_next.id is null then
    update public.crm_lead_cadence_enrollments
    set status = 'completed',
        completed_at = p_now,
        paused_at = null,
        updated_at = p_now
    where id = v_enrollment.id;

    insert into public.crm_cadence_enrollment_events (
      enrollment_id, lead_id, actor_id, event_type,
      previous_values, new_values, reason_code
    )
    values (
      v_enrollment.id, v_enrollment.lead_id, p_actor, 'completed',
      jsonb_build_object('status', v_enrollment.status),
      jsonb_build_object('status', 'completed'),
      'final_step_completed'
    );

    insert into public.lead_activities (
      lead_id, activity_type, reference_id, actor_id, summary, metadata
    )
    values (
      v_enrollment.lead_id, 'cadence.completed', v_enrollment.id, p_actor,
      'Cadence completed',
      jsonb_build_object('enrollmentId', v_enrollment.id)
    )
    on conflict (lead_id, activity_type, reference_id)
    where reference_id is not null do nothing;
  else
    update public.crm_lead_cadence_enrollments
    set status = 'stopped',
        stopped_at = p_now,
        stop_reason = 'manual_override',
        paused_at = null,
        updated_at = p_now
    where id = v_enrollment.id;

    insert into public.crm_cadence_enrollment_events (
      enrollment_id, lead_id, actor_id, event_type,
      previous_values, new_values, reason_code
    )
    values (
      v_enrollment.id, v_enrollment.lead_id, p_actor, 'auto_stopped',
      jsonb_build_object('status', v_enrollment.status),
      jsonb_build_object('status', 'stopped', 'stopReason', 'manual_override'),
      'manual_override'
    );

    insert into public.lead_activities (
      lead_id, activity_type, reference_id, actor_id, summary, metadata
    )
    values (
      v_enrollment.lead_id, 'cadence.stopped', v_enrollment.id, p_actor,
      'Cadence stopped',
      jsonb_build_object('enrollmentId', v_enrollment.id, 'stopReason', 'manual_override')
    )
    on conflict (lead_id, activity_type, reference_id)
    where reference_id is not null do nothing;
  end if;
end;
$$;

-- D6: On Hold pauses; it never cancels the cadence.
create or replace function private.pause_lead_cadence_for_hold(
  p_lead_id uuid,
  p_actor uuid
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
  select * into v_enrollment
  from public.crm_lead_cadence_enrollments
  where lead_id = p_lead_id
    and status = 'active'
  for update;
  if not found then
    return;
  end if;

  v_now := clock_timestamp();

  update public.crm_lead_cadence_enrollments
  set status = 'paused',
      paused_at = v_now,
      updated_at = v_now
  where id = v_enrollment.id;

  insert into public.crm_cadence_enrollment_events (
    enrollment_id, lead_id, actor_id, event_type,
    previous_values, new_values, reason_code
  )
  values (
    v_enrollment.id, p_lead_id, p_actor, 'paused',
    jsonb_build_object('status', 'active'),
    jsonb_build_object('status', 'paused'),
    'lead_on_hold'
  );
end;
$$;

-- Mandatory system stops (Closed Won / Closed Lost / owner not operable).
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
  if p_reason not in ('lead_closed_won', 'lead_closed_lost', 'owner_not_operable') then
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
-- I. Cadence template lifecycle (crm.cadences.manage — D3)
-- =============================================================================

create or replace function private.crm_require_cadence_manager()
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not (select public.authorize('crm.cadences.manage')) then
    raise exception 'CADENCE_PERMISSION_DENIED' using errcode = '42501';
  end if;
  return v_actor;
end;
$$;

create or replace function private.crm_assert_cadence_name_available(
  p_name text,
  p_exclude_id uuid
)
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1
    from public.crm_cadence_templates t
    where lower(t.name) = lower(p_name)
      and t.status <> 'archived'
      and (p_exclude_id is null or t.id <> p_exclude_id)
  ) then
    raise exception 'CADENCE_TEMPLATE_NAME_TAKEN' using errcode = '22023';
  end if;
end;
$$;

create or replace function private.create_cadence_template_impl(
  p_name text,
  p_description text default null
)
returns public.crm_cadence_templates
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_name text;
  v_description text;
  v_row public.crm_cadence_templates%rowtype;
begin
  v_actor := private.crm_require_cadence_manager();

  v_name := nullif(trim(coalesce(p_name, '')), '');
  if v_name is null or length(v_name) < 2 or length(v_name) > 120 then
    raise exception 'CADENCE_TEMPLATE_INVALID' using errcode = '22023';
  end if;

  v_description := nullif(trim(coalesce(p_description, '')), '');
  if v_description is not null and length(v_description) > 500 then
    raise exception 'CADENCE_TEMPLATE_INVALID' using errcode = '22023';
  end if;

  perform private.crm_assert_cadence_name_available(v_name, null);

  insert into public.crm_cadence_templates (name, description, status, created_by, updated_by)
  values (v_name, v_description, 'draft', v_actor, v_actor)
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function private.update_cadence_template_impl(
  p_template_id uuid,
  p_name text,
  p_description text default null
)
returns public.crm_cadence_templates
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_name text;
  v_description text;
  v_row public.crm_cadence_templates%rowtype;
begin
  v_actor := private.crm_require_cadence_manager();

  select * into v_row
  from public.crm_cadence_templates
  where id = p_template_id
  for update;
  if not found then
    raise exception 'CADENCE_TEMPLATE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_row.status <> 'draft' then
    raise exception 'CADENCE_TEMPLATE_NOT_EDITABLE' using errcode = '22023';
  end if;

  v_name := nullif(trim(coalesce(p_name, '')), '');
  if v_name is null or length(v_name) < 2 or length(v_name) > 120 then
    raise exception 'CADENCE_TEMPLATE_INVALID' using errcode = '22023';
  end if;

  v_description := nullif(trim(coalesce(p_description, '')), '');
  if v_description is not null and length(v_description) > 500 then
    raise exception 'CADENCE_TEMPLATE_INVALID' using errcode = '22023';
  end if;

  perform private.crm_assert_cadence_name_available(v_name, p_template_id);

  update public.crm_cadence_templates
  set name = v_name,
      description = v_description,
      updated_by = v_actor
  where id = p_template_id
  returning * into v_row;

  return v_row;
end;
$$;

-- Replace the whole ordered step list atomically. p_steps is a transport array
-- of plain step records — normalized into rows here. NOT a rule DSL: no
-- conditions, no branching, no expressions are accepted or stored.
create or replace function private.replace_cadence_template_steps_impl(
  p_template_id uuid,
  p_steps jsonb
)
returns public.crm_cadence_templates
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_template public.crm_cadence_templates%rowtype;
  v_element jsonb;
  v_index integer := 0;
  v_activity_type text;
  v_title text;
  v_priority text;
  v_delay_hours integer;
  v_duration integer;
  v_reminder integer;
begin
  v_actor := private.crm_require_cadence_manager();

  select * into v_template
  from public.crm_cadence_templates
  where id = p_template_id
  for update;
  if not found then
    raise exception 'CADENCE_TEMPLATE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_template.status <> 'draft' then
    raise exception 'CADENCE_TEMPLATE_NOT_EDITABLE' using errcode = '22023';
  end if;

  if p_steps is null or jsonb_typeof(p_steps) <> 'array' then
    raise exception 'CADENCE_STEP_INVALID' using errcode = '22023';
  end if;
  if jsonb_array_length(p_steps) > 50 then
    raise exception 'CADENCE_STEP_INVALID' using errcode = '22023';
  end if;

  delete from public.crm_cadence_steps where template_id = p_template_id;

  for v_element in select value from jsonb_array_elements(p_steps)
  loop
    v_index := v_index + 1;

    if jsonb_typeof(v_element) <> 'object' then
      raise exception 'CADENCE_STEP_INVALID' using errcode = '22023';
    end if;

    v_activity_type := nullif(trim(coalesce(v_element ->> 'activityType', '')), '');
    if v_activity_type is null or v_activity_type not in (
      'call', 'whatsapp', 'consultation', 'site_visit',
      'quotation_follow_up', 'internal_task'
    ) then
      raise exception 'CADENCE_STEP_INVALID' using errcode = '22023';
    end if;

    v_title := nullif(trim(coalesce(v_element ->> 'title', '')), '');
    if v_title is null or length(v_title) > 120 then
      raise exception 'CADENCE_STEP_INVALID' using errcode = '22023';
    end if;

    v_priority := coalesce(nullif(trim(coalesce(v_element ->> 'priority', '')), ''), 'normal');
    if v_priority not in ('low', 'normal', 'high', 'urgent') then
      raise exception 'CADENCE_STEP_INVALID' using errcode = '22023';
    end if;

    begin
      v_delay_hours := (v_element ->> 'delayHours')::integer;
      v_duration := nullif(v_element ->> 'durationMinutes', '')::integer;
      v_reminder := nullif(v_element ->> 'reminderOffsetMinutes', '')::integer;
    exception when others then
      raise exception 'CADENCE_STEP_INVALID' using errcode = '22023';
    end;

    if v_delay_hours is null or v_delay_hours < 0 or v_delay_hours > 2160 then
      raise exception 'CADENCE_STEP_INVALID' using errcode = '22023';
    end if;
    if v_duration is not null and (v_duration < 1 or v_duration > 1440) then
      raise exception 'CADENCE_STEP_INVALID' using errcode = '22023';
    end if;
    if v_reminder is not null and (v_reminder < 0 or v_reminder > 10080) then
      raise exception 'CADENCE_STEP_INVALID' using errcode = '22023';
    end if;

    insert into public.crm_cadence_steps (
      template_id, step_order, delay_hours, activity_type,
      title, priority, duration_minutes, reminder_offset_minutes
    ) values (
      p_template_id, v_index::smallint, v_delay_hours, v_activity_type,
      v_title, v_priority, v_duration::smallint, v_reminder
    );
  end loop;

  update public.crm_cadence_templates
  set updated_by = v_actor
  where id = p_template_id
  returning * into v_template;

  return v_template;
end;
$$;

create or replace function private.publish_cadence_template_impl(
  p_template_id uuid
)
returns public.crm_cadence_templates
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_row public.crm_cadence_templates%rowtype;
  v_count integer;
  v_max smallint;
begin
  v_actor := private.crm_require_cadence_manager();

  select * into v_row
  from public.crm_cadence_templates
  where id = p_template_id
  for update;
  if not found then
    raise exception 'CADENCE_TEMPLATE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_row.status <> 'draft' then
    raise exception 'CADENCE_TEMPLATE_NOT_EDITABLE' using errcode = '22023';
  end if;

  select count(*)::integer, coalesce(max(step_order), 0::smallint)
  into v_count, v_max
  from public.crm_cadence_steps
  where template_id = p_template_id;

  if v_count = 0 then
    raise exception 'CADENCE_TEMPLATE_REQUIRES_STEPS' using errcode = '22023';
  end if;
  -- Contiguous 1..n ordering is a publish precondition.
  if v_max <> v_count then
    raise exception 'CADENCE_STEP_INVALID' using errcode = '22023';
  end if;

  perform private.crm_assert_cadence_name_available(v_row.name, p_template_id);

  update public.crm_cadence_templates
  set status = 'published',
      published_at = clock_timestamp(),
      published_by = v_actor,
      updated_by = v_actor
  where id = p_template_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function private.archive_cadence_template_impl(
  p_template_id uuid
)
returns public.crm_cadence_templates
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_row public.crm_cadence_templates%rowtype;
begin
  v_actor := private.crm_require_cadence_manager();

  select * into v_row
  from public.crm_cadence_templates
  where id = p_template_id
  for update;
  if not found then
    raise exception 'CADENCE_TEMPLATE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_row.status = 'archived' then
    return v_row;
  end if;

  update public.crm_cadence_templates
  set status = 'archived',
      archived_at = clock_timestamp(),
      archived_by = v_actor,
      updated_by = v_actor
  where id = p_template_id
  returning * into v_row;

  return v_row;
end;
$$;

-- Published templates are immutable; revision = duplicate into a fresh draft.
create or replace function private.duplicate_cadence_template_impl(
  p_template_id uuid,
  p_name text
)
returns public.crm_cadence_templates
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_source public.crm_cadence_templates%rowtype;
  v_name text;
  v_row public.crm_cadence_templates%rowtype;
begin
  v_actor := private.crm_require_cadence_manager();

  select * into v_source
  from public.crm_cadence_templates
  where id = p_template_id;
  if not found then
    raise exception 'CADENCE_TEMPLATE_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_name := nullif(trim(coalesce(p_name, '')), '');
  if v_name is null or length(v_name) < 2 or length(v_name) > 120 then
    raise exception 'CADENCE_TEMPLATE_INVALID' using errcode = '22023';
  end if;

  perform private.crm_assert_cadence_name_available(v_name, null);

  insert into public.crm_cadence_templates (name, description, status, created_by, updated_by)
  values (v_name, v_source.description, 'draft', v_actor, v_actor)
  returning * into v_row;

  insert into public.crm_cadence_steps (
    template_id, step_order, delay_hours, activity_type,
    title, priority, duration_minutes, reminder_offset_minutes
  )
  select
    v_row.id, s.step_order, s.delay_hours, s.activity_type,
    s.title, s.priority, s.duration_minutes, s.reminder_offset_minutes
  from public.crm_cadence_steps s
  where s.template_id = p_template_id
  order by s.step_order asc;

  return v_row;
end;
$$;

-- =============================================================================
-- J. Enrollment lifecycle (crm.follow_ups.manage + crm_can_mutate_lead — D4)
-- =============================================================================

create or replace function private.crm_cadence_assert_lead_operable(
  p_lead public.leads
)
returns uuid
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if p_lead.status in ('closed_won', 'closed_lost') then
    raise exception 'CADENCE_LEAD_NOT_ELIGIBLE' using errcode = '22023';
  end if;
  if p_lead.status = 'on_hold' then
    raise exception 'CADENCE_LEAD_NOT_ELIGIBLE' using errcode = '22023';
  end if;
  if p_lead.assigned_to is null then
    raise exception 'CADENCE_LEAD_NOT_ELIGIBLE' using errcode = '22023';
  end if;
  if not (select private.crm_is_eligible_follow_up_owner(p_lead.assigned_to)) then
    raise exception 'ACTIVITY_OWNER_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  if not (select private.crm_user_can_operate_lead(
    p_lead.assigned_to, p_lead.id, 'crm.follow_ups.manage'
  )) then
    raise exception 'ACTIVITY_OWNER_NOT_AUTHORIZED' using errcode = '42501';
  end if;
  return p_lead.assigned_to;
end;
$$;

create or replace function private.enroll_lead_in_cadence_impl(
  p_lead_id uuid,
  p_template_id uuid
)
returns public.crm_lead_cadence_enrollments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_lead public.leads%rowtype;
  v_template public.crm_cadence_templates%rowtype;
  v_step public.crm_cadence_steps%rowtype;
  v_owner uuid;
  v_now timestamptz;
  v_enrollment public.crm_lead_cadence_enrollments%rowtype;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not (select public.authorize('crm.follow_ups.manage')) then
    raise exception 'CADENCE_PERMISSION_DENIED' using errcode = '42501';
  end if;

  if p_lead_id is null then
    raise exception 'LEAD_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_lead from public.leads where id = p_lead_id for update;
  if not found then
    raise exception 'LEAD_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not (select private.crm_can_mutate_lead(p_lead_id)) then
    raise exception 'CADENCE_PERMISSION_DENIED' using errcode = '42501';
  end if;

  v_owner := private.crm_cadence_assert_lead_operable(v_lead);

  select * into v_template
  from public.crm_cadence_templates
  where id = p_template_id;
  if not found then
    raise exception 'CADENCE_TEMPLATE_NOT_FOUND' using errcode = 'P0002';
  end if;
  if v_template.status <> 'published' then
    raise exception 'CADENCE_TEMPLATE_NOT_PUBLISHED' using errcode = '22023';
  end if;

  if exists (
    select 1 from public.crm_lead_cadence_enrollments
    where lead_id = p_lead_id and status in ('active', 'paused')
  ) then
    raise exception 'CADENCE_ENROLLMENT_EXISTS' using errcode = '22023';
  end if;

  select * into v_step
  from private.crm_cadence_next_step(v_template.id, null);
  if v_step.id is null then
    raise exception 'CADENCE_TEMPLATE_REQUIRES_STEPS' using errcode = '22023';
  end if;

  v_now := clock_timestamp();

  insert into public.crm_lead_cadence_enrollments (
    lead_id, template_id, status, current_step_order, enrolled_by, enrolled_at, updated_at
  ) values (
    p_lead_id, v_template.id, 'active', null, v_actor, v_now, v_now
  )
  returning * into v_enrollment;

  insert into public.crm_cadence_enrollment_events (
    enrollment_id, lead_id, actor_id, event_type,
    previous_values, new_values, reason_code
  )
  values (
    v_enrollment.id, p_lead_id, v_actor, 'enrolled',
    '{}'::jsonb,
    jsonb_build_object('templateId', v_template.id, 'status', 'active'),
    null
  );

  insert into public.lead_activities (
    lead_id, activity_type, reference_id, actor_id, summary, metadata
  )
  values (
    p_lead_id, 'cadence.enrolled', v_enrollment.id, v_actor,
    'Cadence enrolled',
    jsonb_build_object('enrollmentId', v_enrollment.id, 'templateId', v_template.id)
  );

  -- The cadence step becomes the single open primary next action (D10).
  perform private.clear_open_primary_for_lead(p_lead_id, v_actor, 'cadence_enrolled', null);
  perform private.materialize_cadence_step(v_enrollment.id, v_step.id, v_owner, v_actor, v_now);

  select * into v_enrollment
  from public.crm_lead_cadence_enrollments
  where id = v_enrollment.id;

  return v_enrollment;
end;
$$;

create or replace function private.crm_cadence_load_enrollment_for_write(
  p_enrollment_id uuid
)
returns public.crm_lead_cadence_enrollments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_enrollment public.crm_lead_cadence_enrollments%rowtype;
begin
  if p_enrollment_id is null then
    raise exception 'CADENCE_ENROLLMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not (select public.authorize('crm.follow_ups.manage')) then
    raise exception 'CADENCE_PERMISSION_DENIED' using errcode = '42501';
  end if;

  select * into v_enrollment
  from public.crm_lead_cadence_enrollments
  where id = p_enrollment_id
  for update;
  if not found then
    raise exception 'CADENCE_ENROLLMENT_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not (select private.crm_can_mutate_lead(v_enrollment.lead_id)) then
    raise exception 'CADENCE_PERMISSION_DENIED' using errcode = '42501';
  end if;

  return v_enrollment;
end;
$$;

create or replace function private.pause_lead_cadence_impl(
  p_enrollment_id uuid
)
returns public.crm_lead_cadence_enrollments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_enrollment public.crm_lead_cadence_enrollments%rowtype;
  v_now timestamptz;
begin
  v_actor := auth.uid();
  v_enrollment := private.crm_cadence_load_enrollment_for_write(p_enrollment_id);

  if v_enrollment.status <> 'active' then
    raise exception 'CADENCE_ENROLLMENT_NOT_ACTIVE' using errcode = '22023';
  end if;

  v_now := clock_timestamp();

  update public.crm_lead_cadence_enrollments
  set status = 'paused',
      paused_at = v_now,
      updated_at = v_now
  where id = v_enrollment.id
  returning * into v_enrollment;

  insert into public.crm_cadence_enrollment_events (
    enrollment_id, lead_id, actor_id, event_type,
    previous_values, new_values, reason_code
  )
  values (
    v_enrollment.id, v_enrollment.lead_id, v_actor, 'paused',
    jsonb_build_object('status', 'active'),
    jsonb_build_object('status', 'paused'),
    'paused_by_user'
  );

  return v_enrollment;
end;
$$;

create or replace function private.resume_lead_cadence_impl(
  p_enrollment_id uuid
)
returns public.crm_lead_cadence_enrollments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_enrollment public.crm_lead_cadence_enrollments%rowtype;
  v_lead public.leads%rowtype;
  v_owner uuid;
  v_open public.lead_follow_ups%rowtype;
  v_next public.crm_cadence_steps%rowtype;
  v_now timestamptz;
begin
  v_actor := auth.uid();
  v_enrollment := private.crm_cadence_load_enrollment_for_write(p_enrollment_id);

  if v_enrollment.status <> 'paused' then
    raise exception 'CADENCE_ENROLLMENT_NOT_PAUSED' using errcode = '22023';
  end if;

  select * into v_lead from public.leads where id = v_enrollment.lead_id for update;
  if not found then
    raise exception 'LEAD_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_owner := private.crm_cadence_assert_lead_operable(v_lead);

  v_now := clock_timestamp();

  -- An already-open cadence activity is never duplicated on resume.
  select * into v_open
  from public.lead_follow_ups
  where cadence_enrollment_id = v_enrollment.id
    and status = 'open'
  order by due_at asc
  limit 1
  for update;

  if v_open.id is not null then
    update public.crm_lead_cadence_enrollments
    set status = 'active',
        paused_at = null,
        updated_at = v_now
    where id = v_enrollment.id
    returning * into v_enrollment;

    if coalesce(v_open.is_primary_next_action, false) = false then
      perform private.clear_open_primary_for_lead(
        v_enrollment.lead_id, v_actor, 'cadence_resumed', v_open.id
      );

      update public.lead_follow_ups
      set is_primary_next_action = true,
          updated_at = v_now
      where id = v_open.id;

      insert into public.lead_follow_up_events (
        follow_up_id, lead_id, actor_id, event_type,
        previous_values, new_values, reason_code, reason_note
      )
      values (
        v_open.id, v_enrollment.lead_id, v_actor, 'primary_designated',
        jsonb_build_object('isPrimaryNextAction', false),
        jsonb_build_object('isPrimaryNextAction', true),
        'cadence_resumed', null
      );
    end if;

    insert into public.crm_cadence_enrollment_events (
      enrollment_id, lead_id, follow_up_id, actor_id, event_type,
      previous_values, new_values, reason_code
    )
    values (
      v_enrollment.id, v_enrollment.lead_id, v_open.id, v_actor, 'resumed',
      jsonb_build_object('status', 'paused'),
      jsonb_build_object('status', 'active'),
      'resumed_open_step'
    );

    return v_enrollment;
  end if;

  select * into v_next
  from private.crm_cadence_next_step(v_enrollment.template_id, v_enrollment.current_step_order);

  if v_next.id is null then
    update public.crm_lead_cadence_enrollments
    set status = 'completed',
        completed_at = v_now,
        paused_at = null,
        updated_at = v_now
    where id = v_enrollment.id
    returning * into v_enrollment;

    insert into public.crm_cadence_enrollment_events (
      enrollment_id, lead_id, actor_id, event_type,
      previous_values, new_values, reason_code
    )
    values (
      v_enrollment.id, v_enrollment.lead_id, v_actor, 'completed',
      jsonb_build_object('status', 'paused'),
      jsonb_build_object('status', 'completed'),
      'no_further_steps'
    );

    insert into public.lead_activities (
      lead_id, activity_type, reference_id, actor_id, summary, metadata
    )
    values (
      v_enrollment.lead_id, 'cadence.completed', v_enrollment.id, v_actor,
      'Cadence completed',
      jsonb_build_object('enrollmentId', v_enrollment.id)
    )
    on conflict (lead_id, activity_type, reference_id)
    where reference_id is not null do nothing;

    return v_enrollment;
  end if;

  update public.crm_lead_cadence_enrollments
  set status = 'active',
      paused_at = null,
      updated_at = v_now
  where id = v_enrollment.id
  returning * into v_enrollment;

  insert into public.crm_cadence_enrollment_events (
    enrollment_id, lead_id, actor_id, event_type,
    previous_values, new_values, reason_code
  )
  values (
    v_enrollment.id, v_enrollment.lead_id, v_actor, 'resumed',
    jsonb_build_object('status', 'paused'),
    jsonb_build_object('status', 'active'),
    'resumed_next_step'
  );

  perform private.clear_open_primary_for_lead(
    v_enrollment.lead_id, v_actor, 'cadence_resumed', null
  );
  perform private.materialize_cadence_step(
    v_enrollment.id, v_next.id, v_owner, v_actor, v_now
  );

  select * into v_enrollment
  from public.crm_lead_cadence_enrollments
  where id = v_enrollment.id;

  return v_enrollment;
end;
$$;

create or replace function private.cancel_lead_cadence_impl(
  p_enrollment_id uuid
)
returns public.crm_lead_cadence_enrollments
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_enrollment public.crm_lead_cadence_enrollments%rowtype;
  v_previous text;
  v_now timestamptz;
begin
  v_actor := auth.uid();
  v_enrollment := private.crm_cadence_load_enrollment_for_write(p_enrollment_id);

  if v_enrollment.status not in ('active', 'paused') then
    raise exception 'CADENCE_ENROLLMENT_NOT_ACTIVE' using errcode = '22023';
  end if;

  v_previous := v_enrollment.status;
  v_now := clock_timestamp();

  -- Cancelling never cancels the currently open activity: the lead keeps its
  -- primary next action. Only future step materialization stops.
  update public.crm_lead_cadence_enrollments
  set status = 'stopped',
      stopped_at = v_now,
      stop_reason = 'cancelled_by_user',
      paused_at = null,
      updated_at = v_now
  where id = v_enrollment.id
  returning * into v_enrollment;

  insert into public.crm_cadence_enrollment_events (
    enrollment_id, lead_id, actor_id, event_type,
    previous_values, new_values, reason_code
  )
  values (
    v_enrollment.id, v_enrollment.lead_id, v_actor, 'cancelled',
    jsonb_build_object('status', v_previous),
    jsonb_build_object('status', 'stopped', 'stopReason', 'cancelled_by_user'),
    'cancelled_by_user'
  );

  insert into public.lead_activities (
    lead_id, activity_type, reference_id, actor_id, summary, metadata
  )
  values (
    v_enrollment.lead_id, 'cadence.stopped', v_enrollment.id, v_actor,
    'Cadence stopped',
    jsonb_build_object('enrollmentId', v_enrollment.id, 'stopReason', 'cancelled_by_user')
  )
  on conflict (lead_id, activity_type, reference_id)
    where reference_id is not null do nothing;

  return v_enrollment;
end;
$$;

-- =============================================================================
-- K. Public wrappers (SECURITY INVOKER -> private DEFINER impls)
-- =============================================================================

create or replace function public.create_cadence_template(
  p_name text,
  p_description text default null
)
returns public.crm_cadence_templates
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.create_cadence_template_impl(p_name, p_description);
end;
$$;

create or replace function public.update_cadence_template(
  p_template_id uuid,
  p_name text,
  p_description text default null
)
returns public.crm_cadence_templates
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.update_cadence_template_impl(p_template_id, p_name, p_description);
end;
$$;

create or replace function public.replace_cadence_template_steps(
  p_template_id uuid,
  p_steps jsonb
)
returns public.crm_cadence_templates
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.replace_cadence_template_steps_impl(p_template_id, p_steps);
end;
$$;

create or replace function public.publish_cadence_template(
  p_template_id uuid
)
returns public.crm_cadence_templates
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.publish_cadence_template_impl(p_template_id);
end;
$$;

create or replace function public.archive_cadence_template(
  p_template_id uuid
)
returns public.crm_cadence_templates
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.archive_cadence_template_impl(p_template_id);
end;
$$;

create or replace function public.duplicate_cadence_template(
  p_template_id uuid,
  p_name text
)
returns public.crm_cadence_templates
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.duplicate_cadence_template_impl(p_template_id, p_name);
end;
$$;

create or replace function public.enroll_lead_in_cadence(
  p_lead_id uuid,
  p_template_id uuid
)
returns public.crm_lead_cadence_enrollments
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.enroll_lead_in_cadence_impl(p_lead_id, p_template_id);
end;
$$;

create or replace function public.pause_lead_cadence(
  p_enrollment_id uuid
)
returns public.crm_lead_cadence_enrollments
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.pause_lead_cadence_impl(p_enrollment_id);
end;
$$;

create or replace function public.resume_lead_cadence(
  p_enrollment_id uuid
)
returns public.crm_lead_cadence_enrollments
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.resume_lead_cadence_impl(p_enrollment_id);
end;
$$;

create or replace function public.cancel_lead_cadence(
  p_enrollment_id uuid
)
returns public.crm_lead_cadence_enrollments
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.cancel_lead_cadence_impl(p_enrollment_id);
end;
$$;
-- =============================================================================
-- L. Canonical authorities — forward-only replacements
--    private.transition_lead_status_impl gains CRM 2C stage gates (D1) and the
--    cadence pause/stop reaction. The stage graph, assignment-owned edges and
--    Closed-Won rejection are byte-identical to CRM 2A.
-- =============================================================================

create or replace function private.transition_lead_status_impl(
  p_lead_id uuid,
  p_new_status text,
  p_reason text default null,
  p_closure_reason_code text default null
)
returns public.leads
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_lead public.leads%rowtype;
  v_old text;
  v_reason_id uuid;
  v_resume text;
  v_hold_previous text;
  v_allowed boolean := false;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not (select public.authorize('leads.transition')) then
    raise exception 'Permission denied to transition lead status' using errcode = '42501';
  end if;

  if p_new_status = 'closed_won' then
    raise exception 'CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE'
      using errcode = 'P0001', hint = 'Phase 7B quotation acceptance required';
  end if;

  select * into v_lead from public.leads where id = p_lead_id for update;
  if not found then
    raise exception 'Lead % not found', p_lead_id using errcode = 'P0002';
  end if;

  if not (select private.crm_can_mutate_lead(p_lead_id)) then
    raise exception 'Lead not visible for status transition' using errcode = '42501';
  end if;

  v_old := v_lead.status;

  if p_new_status in ('new', 'assigned') and v_old <> 'on_hold' then
    raise exception 'Status % must be changed via assign_lead only', p_new_status using errcode = '22023';
  end if;

  if v_old = p_new_status then
    return v_lead;
  end if;

  if v_old in ('closed_won', 'closed_lost') then
    raise exception 'Terminal lead status cannot be changed in Phase 5B' using errcode = '22023';
  end if;

  if v_old = 'on_hold' then
    v_hold_previous := v_lead.on_hold_previous_status;
    v_resume := private.crm_resolve_on_hold_resume_stage(
      v_hold_previous,
      v_lead.assigned_to
    );
    if p_new_status <> v_resume then
      raise exception 'On-hold lead may resume only to prior stage %, not %', v_resume, p_new_status
        using errcode = '22023';
    end if;
    if v_resume = 'new' and v_lead.assigned_to is not null then
      raise exception 'On-hold resume to new requires assigned_to IS NULL' using errcode = '22023';
    end if;
    if v_resume = 'assigned' and v_lead.assigned_to is null then
      raise exception 'On-hold resume to assigned requires assigned_to IS NOT NULL' using errcode = '22023';
    end if;
    v_allowed := true;
  elsif p_new_status = 'on_hold' then
    if nullif(trim(coalesce(p_reason, '')), '') is null then
      raise exception 'On-hold requires a bounded reason' using errcode = '22023';
    end if;
    v_allowed := v_old in (
      'new', 'assigned', 'contacted', 'qualified',
      'consultation_scheduled', 'proposal_sent', 'negotiation'
    );
  else
    v_allowed := case
      when v_old = 'new' and p_new_status in ('closed_lost', 'on_hold') then true
      when v_old = 'assigned' and p_new_status in ('contacted', 'closed_lost', 'on_hold') then true
      when v_old = 'contacted' and p_new_status in ('qualified', 'closed_lost', 'on_hold') then true
      when v_old = 'qualified' and p_new_status in ('consultation_scheduled', 'closed_lost', 'on_hold') then true
      when v_old = 'consultation_scheduled' and p_new_status in ('proposal_sent', 'closed_lost', 'on_hold') then true
      when v_old = 'proposal_sent' and p_new_status in ('negotiation', 'closed_lost', 'on_hold') then true
      when v_old = 'negotiation' and p_new_status in ('closed_lost', 'on_hold') then true
      else false
    end;
  end if;

  if not v_allowed then
    raise exception 'Invalid lead status transition: % -> %', v_old, p_new_status using errcode = '22023';
  end if;

  -- ===========================================================================
  -- CRM 2C stage gates (owner lock D1). Canonical evidence only: no override
  -- flags, no denormalized columns, no second state machine. Evaluated after
  -- the approved edge and BEFORE any mutation, so a refusal leaves no partial
  -- state. Resume from on_hold never matches (v_old = 'on_hold').
  -- ===========================================================================
  if v_old = 'assigned' and p_new_status = 'contacted' then
    -- First-contact ATTEMPT evidence. Independent of SLA policy activation.
    if not exists (
      select 1
      from public.crm_sla_clocks c
      where c.lead_id = p_lead_id
        and c.first_contact_attempt_at is not null
    ) then
      raise exception 'CRM_STAGE_GATE_FIRST_CONTACT_REQUIRED' using errcode = '22023';
    end if;
  elsif v_old = 'qualified' and p_new_status = 'consultation_scheduled' then
    if not exists (
      select 1
      from public.lead_follow_ups f
      where f.lead_id = p_lead_id
        and f.activity_type in ('consultation', 'site_visit')
        and f.status in ('open', 'completed')
    ) then
      raise exception 'CRM_STAGE_GATE_CONSULTATION_REQUIRED' using errcode = '22023';
    end if;
  elsif v_old = 'consultation_scheduled' and p_new_status = 'proposal_sent' then
    -- Finalized version alone is an internal freeze, never a delivery.
    if not exists (
      select 1
      from public.quotation_access_grants g
      join public.quotation_versions v on v.id = g.quotation_version_id
      join public.quotations q on q.id = v.quotation_id
      where q.lead_id = p_lead_id
        and v.status = 'finalized'
        and g.revoked_at is null
    ) then
      raise exception 'CRM_STAGE_GATE_PROPOSAL_DELIVERY_REQUIRED' using errcode = '22023';
    end if;
  end if;

  if p_new_status = 'closed_lost' then
    if nullif(trim(coalesce(p_reason, '')), '') is null
      or length(trim(coalesce(p_reason, ''))) < 3 then
      raise exception 'CLOSED_LOST_REQUIRES_REASON' using errcode = '22023';
    end if;
    if p_closure_reason_code is not null then
      select id into v_reason_id from public.lead_closure_reasons
      where code = p_closure_reason_code and is_active = true;
      if v_reason_id is null then
        raise exception 'Invalid closure reason code: %', p_closure_reason_code using errcode = '22023';
      end if;
    else
      select id into v_reason_id from public.lead_closure_reasons where code = 'other' and is_active = true;
    end if;
  end if;

  perform set_config('onedecore.crm_transition', '1', true);

  update public.leads
  set status = p_new_status,
      closed_lost_reason_id = case when p_new_status = 'closed_lost' then v_reason_id else null end,
      closed_lost_note = case when p_new_status = 'closed_lost' then nullif(trim(p_reason), '') else null end,
      on_hold_previous_status = case when p_new_status = 'on_hold' then v_old else null end,
      on_hold_reason = case when p_new_status = 'on_hold' then nullif(trim(p_reason), '') else null end,
      on_hold_since = case when p_new_status = 'on_hold' then now() else null end,
      updated_at = now()
  where id = p_lead_id
  returning * into v_lead;

  insert into public.lead_events (lead_id, event_type, actor_id, actor_type, event_data)
  values (
    p_lead_id,
    case when p_new_status = 'on_hold' then 'lead.on_hold'
         when v_old = 'on_hold' then 'lead.resumed'
         else 'lead.status_changed' end,
    v_actor,
    'staff',
    jsonb_build_object(
      'from', v_old,
      'to', p_new_status,
      'reason', p_reason,
      'previousStage', case when v_old = 'on_hold' then v_hold_previous else null end
    )
  );

  insert into public.lead_activities (lead_id, activity_type, actor_id, summary, metadata)
  values (
    p_lead_id,
    'status.changed',
    v_actor,
    format('Status changed from %s to %s', v_old, p_new_status),
    jsonb_build_object('from', v_old, 'to', p_new_status)
  );

  -- CRM 2C: cadence lifecycle reacts to the canonical stage authority only.
  if p_new_status = 'on_hold' then
    perform private.pause_lead_cadence_for_hold(p_lead_id, v_actor);
  elsif p_new_status = 'closed_lost' then
    perform private.stop_lead_cadence_for_system(p_lead_id, v_actor, 'lead_closed_lost');
  end if;

  perform set_config('onedecore.crm_transition', '0', true);
  return v_lead;
end;
$$;

-- =============================================================================
-- M. private.complete_lead_activity_impl — CADENCE_NEXT resolution (D2/D10)
--    Every pre-existing resolution path is preserved unchanged.
-- =============================================================================

create or replace function private.complete_lead_activity_impl(
  p_activity_id uuid,
  p_outcome_code text,
  p_completion_note text default null,
  p_resolution text default null,
  p_next_activity_type text default null,
  p_next_title text default null,
  p_next_due_at timestamptz default null,
  p_next_priority text default null,
  p_next_duration_minutes integer default null,
  p_next_reminder_at timestamptz default null,
  p_next_quotation_id uuid default null,
  p_on_hold_reason text default null,
  p_on_hold_review_at timestamptz default null,
  p_closed_lost_reason text default null,
  p_closure_reason_code text default null,
  p_whatsapp_send_intent_id uuid default null
)
returns public.lead_follow_ups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_row public.lead_follow_ups%rowtype;
  v_lead public.leads%rowtype;
  v_now timestamptz;
  v_outcome public.lead_activity_outcome_codes%rowtype;
  v_display_outcome text;
  v_note text;
  v_resolution_raw text;
  v_resolution text;
  v_was_primary boolean;
  v_terminal_before boolean;
  v_other_open_primary_exists boolean;
  v_attempt_at timestamptz;
  v_clock_started_at timestamptz;
  v_next_priority text;
  v_next_owner uuid;
  v_next_title text;
  v_next_row public.lead_follow_ups%rowtype;
  v_next_type text;
  v_needs_clock_work boolean := false;
  v_enrollment public.crm_lead_cadence_enrollments%rowtype;
  v_cadence_step public.crm_cadence_steps%rowtype;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not (select public.authorize('crm.follow_ups.manage')) then
    raise exception 'ACTIVITY_OWNER_NOT_AUTHORIZED' using errcode = '42501';
  end if;

  if p_activity_id is null then
    raise exception 'ACTIVITY_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_note := nullif(trim(coalesce(p_completion_note, '')), '');
  if v_note is not null and length(v_note) > 1000 then
    raise exception 'ACTIVITY_OUTCOME_INVALID' using errcode = '22023';
  end if;

  if p_outcome_code is null or length(trim(p_outcome_code)) = 0 then
    raise exception 'ACTIVITY_OUTCOME_REQUIRED' using errcode = '22023';
  end if;

  -- Hard reject any explicit closed_won intent BEFORE any other resolution mapping.
  v_resolution_raw := nullif(trim(upper(coalesce(p_resolution, ''))), '');
  if v_resolution_raw = 'CLOSED_WON' then
    raise exception 'CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE' using errcode = 'P0001';
  end if;

  -- Lock lead first via join, then re-lock activity row explicitly.
  select l.*
  into v_lead
  from public.lead_follow_ups f
  join public.leads l on l.id = f.lead_id
  where f.id = p_activity_id
  for update of l;
  if not found then
    raise exception 'ACTIVITY_NOT_FOUND' using errcode = 'P0002';
  end if;

  select * into v_row
  from public.lead_follow_ups
  where id = p_activity_id
  for update;
  if not found then
    raise exception 'ACTIVITY_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not (select private.crm_can_mutate_lead(v_row.lead_id)) then
    raise exception 'ACTIVITY_OWNER_NOT_AUTHORIZED' using errcode = '42501';
  end if;

  if v_row.status <> 'open' then
    raise exception 'ACTIVITY_NOT_OPEN' using errcode = '22023';
  end if;

  -- CRM 2C: cadence context comes from immutable activity provenance.
  if v_row.cadence_enrollment_id is not null then
    select * into v_enrollment
    from public.crm_lead_cadence_enrollments
    where id = v_row.cadence_enrollment_id
    for update;
  end if;

  -- Outcome catalogue validation.
  select * into v_outcome
  from public.lead_activity_outcome_codes
  where code = p_outcome_code;
  if not found or v_outcome.is_active is not true then
    raise exception 'ACTIVITY_OUTCOME_INVALID' using errcode = '22023';
  end if;

  if v_outcome.activity_types is not null
     and cardinality(v_outcome.activity_types) > 0
     and not (v_row.activity_type = any(v_outcome.activity_types)) then
    raise exception 'ACTIVITY_OUTCOME_NOT_ALLOWED_FOR_TYPE' using errcode = '22023';
  end if;

  v_display_outcome := coalesce(v_outcome.display_name, p_outcome_code);
  v_was_primary := coalesce(v_row.is_primary_next_action, false);
  v_terminal_before := v_lead.status in ('closed_won', 'closed_lost');

  v_resolution := coalesce(v_resolution_raw, 'NONE');

  if v_resolution not in ('NEXT_PRIMARY', 'CADENCE_NEXT', 'ON_HOLD', 'CLOSED_LOST', 'NONE') then
    -- CLOSED_WON was already trapped above; anything else is a bad resolution.
    raise exception 'NEXT_ACTION_REQUIRED' using errcode = '22023';
  end if;

  -- Terminal leads: only NONE allowed. No status transition, no next primary.
  if v_terminal_before then
    if v_resolution <> 'NONE' then
      if v_resolution = 'CLOSED_LOST' and v_lead.status = 'closed_lost' then
        v_resolution := 'NONE';
      else
        raise exception 'ACTIVITY_TERMINAL_REJECTED' using errcode = '22023';
      end if;
    end if;
  end if;

  -- Resolution requirement rules for non-terminal leads.
  if not v_terminal_before then
    if v_was_primary then
      if v_resolution = 'NONE' then
        raise exception 'NEXT_ACTION_REQUIRED' using errcode = '22023';
      end if;
    else
      -- Secondary complete: NONE only if another open primary still exists
      -- OR lead is already terminal (handled above).
      if v_resolution = 'NONE' then
        select exists (
          select 1
          from public.lead_follow_ups
          where lead_id = v_row.lead_id
            and is_primary_next_action = true
            and status = 'open'
            and id <> v_row.id
        ) into v_other_open_primary_exists;

        if not v_other_open_primary_exists then
          raise exception 'NEXT_ACTION_REQUIRED' using errcode = '22023';
        end if;
      end if;
    end if;
  end if;

  -- CRM 2C: CADENCE_NEXT advances exactly one step of an active enrollment.
  if v_resolution = 'CADENCE_NEXT' then
    if v_row.cadence_enrollment_id is null or v_enrollment.id is null then
      raise exception 'CADENCE_ACTIVITY_NOT_CADENCE' using errcode = '22023';
    end if;
    if v_enrollment.status <> 'active' then
      raise exception 'CADENCE_ENROLLMENT_NOT_ACTIVE' using errcode = '22023';
    end if;
    if v_lead.assigned_to is null then
      raise exception 'ACTIVITY_OWNER_NOT_AUTHORIZED' using errcode = '42501';
    end if;

    select * into v_cadence_step
    from private.crm_cadence_next_step(
      v_enrollment.template_id, v_enrollment.current_step_order
    );
    if v_cadence_step.id is null then
      raise exception 'CADENCE_NEXT_STEP_UNAVAILABLE' using errcode = '22023';
    end if;
  end if;

  -- WhatsApp whatsapp_sent gates (evidence validated after clock lock below).
  if p_outcome_code = 'whatsapp_sent' then
    if v_row.activity_type <> 'whatsapp' then
      raise exception 'ACTIVITY_OUTCOME_NOT_ALLOWED_FOR_TYPE' using errcode = '22023';
    end if;
    if p_whatsapp_send_intent_id is null then
      raise exception 'WHATSAPP_SEND_EVIDENCE_REQUIRED' using errcode = 'P0001';
    end if;
  end if;

  -- Determine whether first-contact clock work is required before capturing v_now.
  if v_row.activity_type = 'call'
     and v_outcome.closes_contact_attempt is true then
    v_needs_clock_work := true;
  elsif v_row.activity_type = 'whatsapp'
        and p_outcome_code = 'whatsapp_sent' then
    v_needs_clock_work := true;
  end if;

  if v_needs_clock_work then
    perform private.ensure_first_contact_sla_clock(v_row.lead_id);

    select clock_started_at
    into v_clock_started_at
    from public.crm_sla_clocks
    where lead_id = v_row.lead_id
    for update;

    if not found then
      raise exception 'ACTIVITY_NOT_FOUND' using errcode = 'P0002';
    end if;
  end if;

  if p_outcome_code = 'whatsapp_sent' then
    v_attempt_at := private.validate_crm_whatsapp_send_evidence(
      p_whatsapp_send_intent_id, v_row.lead_id, v_clock_started_at
    );
  end if;

  -- Capture ONE operation timestamp AFTER all locks relevant to this completion.
  v_now := clock_timestamp();

  -- Complete the activity row (clear primary flag if it was primary).
  update public.lead_follow_ups
  set status = 'completed',
      outcome = v_display_outcome,
      outcome_code = p_outcome_code,
      completion_note = v_note,
      completed_by = v_actor,
      completed_at = v_now,
      is_primary_next_action = false,
      updated_at = v_now
  where id = p_activity_id
  returning * into v_row;

  insert into public.lead_follow_up_events (
    follow_up_id, lead_id, actor_id, event_type,
    previous_values, new_values, reason_code, reason_note
  )
  values (
    v_row.id, v_row.lead_id, v_actor, 'completed',
    jsonb_build_object('status', 'open'),
    jsonb_build_object('status', 'completed', 'completedAt', v_now),
    null, null
  );

  insert into public.lead_follow_up_events (
    follow_up_id, lead_id, actor_id, event_type,
    previous_values, new_values, reason_code, reason_note
  )
  values (
    v_row.id, v_row.lead_id, v_actor, 'outcome_recorded',
    '{}'::jsonb,
    jsonb_strip_nulls(jsonb_build_object(
      'outcomeCode', p_outcome_code,
      'outcomeDisplay', v_display_outcome,
      'note', v_note
    )),
    null, null
  );

  if v_was_primary then
    insert into public.lead_follow_up_events (
      follow_up_id, lead_id, actor_id, event_type,
      previous_values, new_values, reason_code, reason_note
    )
    values (
      v_row.id, v_row.lead_id, v_actor, 'primary_cleared',
      jsonb_build_object('isPrimaryNextAction', true),
      jsonb_build_object('isPrimaryNextAction', false),
      'completed', null
    );
  end if;

  -- First-contact attempt marking (Call uses v_now; WhatsApp uses provider_timestamp).
  if v_row.activity_type = 'call'
     and v_outcome.closes_contact_attempt is true then
    perform private.mark_first_contact_attempt_if_qualifying(
      v_row.lead_id, v_now, 'call_outcome', p_outcome_code, 'call', null
    );
  elsif v_row.activity_type = 'whatsapp'
        and p_outcome_code = 'whatsapp_sent'
        and v_attempt_at is not null then
    perform private.mark_first_contact_attempt_if_qualifying(
      v_row.lead_id, v_attempt_at, 'whatsapp_governed_send', p_outcome_code, 'whatsapp',
      p_whatsapp_send_intent_id
    );
  end if;

  insert into public.lead_activities (lead_id, activity_type, reference_id, actor_id, summary, metadata)
  values (
    v_row.lead_id,
    'follow_up.completed',
    v_row.id,
    v_actor,
    'Follow-up completed',
    jsonb_strip_nulls(jsonb_build_object(
      'outcomeCode', p_outcome_code,
      'outcomeDisplay', v_display_outcome,
      'note', v_note,
      'wasPrimary', v_was_primary,
      'resolution', v_resolution
    ))
  );

  -- CRM 2C: a cadence stops advancing the moment a human resolves the step
  -- another way. ON_HOLD pauses and CLOSED_LOST stops via the canonical
  -- transition authority, so only NONE / NEXT_PRIMARY are finalized here.
  if v_enrollment.id is not null
     and v_enrollment.status in ('active', 'paused')
     and v_resolution in ('NONE', 'NEXT_PRIMARY') then
    perform private.finalize_lead_cadence_after_manual_resolution(
      v_enrollment.id, v_actor, v_now
    );
  end if;

  if v_terminal_before or v_resolution = 'NONE' then
    return v_row;
  end if;

  -- CADENCE_NEXT: materialize exactly the next cadence step as the new primary.
  if v_resolution = 'CADENCE_NEXT' then
    v_next_owner := v_lead.assigned_to;
    if not (select private.crm_is_eligible_follow_up_owner(v_next_owner)) then
      raise exception 'ACTIVITY_OWNER_NOT_AUTHORIZED' using errcode = '42501';
    end if;
    if not (select private.crm_user_can_operate_lead(
      v_next_owner, v_row.lead_id, 'crm.follow_ups.manage'
    )) then
      raise exception 'ACTIVITY_OWNER_NOT_AUTHORIZED' using errcode = '42501';
    end if;

    perform private.clear_open_primary_for_lead(
      v_row.lead_id, v_actor, 'cadence_step', v_row.id
    );

    perform private.materialize_cadence_step(
      v_enrollment.id, v_cadence_step.id, v_next_owner, v_actor, v_now
    );

    return v_row;
  end if;

  -- NEXT_PRIMARY: create next primary owned by lead.assigned_to via completion_chain.
  if v_resolution = 'NEXT_PRIMARY' then
    if v_lead.assigned_to is null then
      raise exception 'ACTIVITY_OWNER_NOT_AUTHORIZED' using errcode = '42501';
    end if;

    v_next_type := coalesce(p_next_activity_type, 'call');
    if v_next_type not in (
      'call', 'whatsapp', 'consultation', 'site_visit',
      'quotation_follow_up', 'internal_task'
    ) then
      raise exception 'NEXT_PRIMARY_INVALID' using errcode = '22023';
    end if;

    v_next_title := nullif(trim(coalesce(p_next_title, '')), '');
    -- Mirror chk_lead_follow_ups_title (1..120).
    if v_next_title is null or length(v_next_title) < 1 or length(v_next_title) > 120 then
      raise exception 'NEXT_PRIMARY_INVALID' using errcode = '22023';
    end if;

    if p_next_due_at is null or p_next_due_at <= v_now then
      raise exception 'ACTIVITY_DUE_MUST_BE_FUTURE' using errcode = '22023';
    end if;

    v_next_priority := coalesce(p_next_priority, 'normal');
    if v_next_priority not in ('low', 'normal', 'high', 'urgent') then
      raise exception 'NEXT_PRIMARY_INVALID' using errcode = '22023';
    end if;

    if p_next_reminder_at is not null and p_next_reminder_at > p_next_due_at then
      raise exception 'ACTIVITY_REMINDER_INVALID' using errcode = '22023';
    end if;

    -- Mirror chk_lead_follow_ups_duration_minutes (null or 1..1440).
    if p_next_duration_minutes is not null
       and (p_next_duration_minutes < 1 or p_next_duration_minutes > 1440) then
      raise exception 'NEXT_PRIMARY_INVALID' using errcode = '22023';
    end if;

    if p_next_quotation_id is not null and not exists (
      select 1 from public.quotations q
      where q.id = p_next_quotation_id and q.lead_id = v_row.lead_id
    ) then
      raise exception 'NEXT_PRIMARY_INVALID' using errcode = '22023';
    end if;

    v_next_owner := v_lead.assigned_to;
    if not (select private.crm_is_eligible_follow_up_owner(v_next_owner)) then
      raise exception 'ACTIVITY_OWNER_NOT_AUTHORIZED' using errcode = '42501';
    end if;
    if not (select private.crm_user_can_operate_lead(
      v_next_owner, v_row.lead_id, 'crm.follow_ups.manage'
    )) then
      raise exception 'ACTIVITY_OWNER_NOT_AUTHORIZED' using errcode = '42501';
    end if;

    perform private.clear_open_primary_for_lead(v_row.lead_id, v_actor, 'completion_chain', v_row.id);

    insert into public.lead_follow_ups (
      lead_id, owner_id, due_at, status, created_by,
      activity_type, title, priority, is_primary_next_action,
      duration_minutes, reminder_at, quotation_id, source, updated_at
    ) values (
      v_row.lead_id, v_next_owner, p_next_due_at, 'open', v_actor,
      v_next_type, v_next_title, v_next_priority, true,
      p_next_duration_minutes, p_next_reminder_at, p_next_quotation_id, 'completion_chain', v_now
    )
    returning * into v_next_row;

    insert into public.lead_follow_up_events (
      follow_up_id, lead_id, actor_id, event_type,
      previous_values, new_values, reason_code, reason_note
    )
    values (
      v_next_row.id, v_row.lead_id, v_actor, 'created',
      '{}'::jsonb,
      jsonb_strip_nulls(jsonb_build_object(
        'activityType', v_next_type,
        'title', v_next_title,
        'dueAt', p_next_due_at,
        'priority', v_next_priority,
        'ownerId', v_next_owner,
        'isPrimaryNextAction', true,
        'source', 'completion_chain',
        'chainedFromId', v_row.id
      )),
      'completion_chain', null
    );

    insert into public.lead_follow_up_events (
      follow_up_id, lead_id, actor_id, event_type,
      previous_values, new_values, reason_code, reason_note
    )
    values (
      v_next_row.id, v_row.lead_id, v_actor, 'primary_designated',
      jsonb_build_object('isPrimaryNextAction', false),
      jsonb_build_object('isPrimaryNextAction', true),
      'completion_chain', null
    );

    insert into public.lead_activities (lead_id, activity_type, reference_id, actor_id, summary, metadata)
    values (
      v_row.lead_id,
      'follow_up.scheduled',
      v_next_row.id,
      v_actor,
      'Follow-up scheduled',
      jsonb_strip_nulls(jsonb_build_object(
        'dueAt', p_next_due_at,
        'ownerId', v_next_owner,
        'activityType', v_next_type,
        'title', v_next_title,
        'priority', v_next_priority,
        'isPrimaryNextAction', true,
        'source', 'completion_chain',
        'chainedFromId', v_row.id
      ))
    );

    return v_row;
  end if;

  -- ON_HOLD: create on_hold_review primary + transition lead via existing impl.
  if v_resolution = 'ON_HOLD' then
    if p_on_hold_reason is null or length(trim(p_on_hold_reason)) = 0 then
      raise exception 'ON_HOLD_REVIEW_REQUIRED' using errcode = '22023';
    end if;

    if p_on_hold_review_at is null or p_on_hold_review_at <= v_now then
      raise exception 'ON_HOLD_REVIEW_REQUIRED' using errcode = '22023';
    end if;

    if v_lead.assigned_to is null then
      raise exception 'ACTIVITY_OWNER_NOT_AUTHORIZED' using errcode = '42501';
    end if;

    v_next_owner := v_lead.assigned_to;
    if not (select private.crm_is_eligible_follow_up_owner(v_next_owner)) then
      raise exception 'ACTIVITY_OWNER_NOT_AUTHORIZED' using errcode = '42501';
    end if;
    if not (select private.crm_user_can_operate_lead(
      v_next_owner, v_row.lead_id, 'crm.follow_ups.manage'
    )) then
      raise exception 'ACTIVITY_OWNER_NOT_AUTHORIZED' using errcode = '42501';
    end if;

    -- Resolve (cancel) any remaining open primary — demote-only is insufficient for On Hold.
    perform private.cancel_open_primary_for_on_hold(
      v_row.lead_id, v_actor, v_row.id, v_now
    );

    insert into public.lead_follow_ups (
      lead_id, owner_id, due_at, status, created_by,
      activity_type, title, priority, is_primary_next_action,
      duration_minutes, reminder_at, quotation_id, source, updated_at
    ) values (
      v_row.lead_id, v_next_owner, p_on_hold_review_at, 'open', v_actor,
      'internal_task', 'On-hold review', 'normal', true,
      null, null, null, 'on_hold_review', v_now
    )
    returning * into v_next_row;

    insert into public.lead_follow_up_events (
      follow_up_id, lead_id, actor_id, event_type,
      previous_values, new_values, reason_code, reason_note
    )
    values (
      v_next_row.id, v_row.lead_id, v_actor, 'created',
      '{}'::jsonb,
      jsonb_build_object(
        'activityType', 'internal_task',
        'title', 'On-hold review',
        'dueAt', p_on_hold_review_at,
        'priority', 'normal',
        'ownerId', v_next_owner,
        'isPrimaryNextAction', true,
        'source', 'on_hold_review',
        'chainedFromId', v_row.id
      ),
      'on_hold_review', null
    );

    insert into public.lead_follow_up_events (
      follow_up_id, lead_id, actor_id, event_type,
      previous_values, new_values, reason_code, reason_note
    )
    values (
      v_next_row.id, v_row.lead_id, v_actor, 'primary_designated',
      jsonb_build_object('isPrimaryNextAction', false),
      jsonb_build_object('isPrimaryNextAction', true),
      'on_hold_review', null
    );

    insert into public.lead_activities (lead_id, activity_type, reference_id, actor_id, summary, metadata)
    values (
      v_row.lead_id,
      'follow_up.scheduled',
      v_next_row.id,
      v_actor,
      'Follow-up scheduled',
      jsonb_build_object(
        'dueAt', p_on_hold_review_at,
        'ownerId', v_next_owner,
        'activityType', 'internal_task',
        'title', 'On-hold review',
        'priority', 'normal',
        'isPrimaryNextAction', true,
        'source', 'on_hold_review',
        'chainedFromId', v_row.id
      )
    );

    perform private.transition_lead_status_impl(
      v_row.lead_id, 'on_hold', p_on_hold_reason, null
    );

    return v_row;
  end if;

  -- CLOSED_LOST: clear all open primaries + transition lead via existing impl.
  if v_resolution = 'CLOSED_LOST' then
    if p_closed_lost_reason is null or length(trim(p_closed_lost_reason)) = 0 then
      raise exception 'NEXT_ACTION_REQUIRED' using errcode = '22023';
    end if;

    perform private.clear_open_primary_for_lead(v_row.lead_id, v_actor, 'closed_lost', null);

    perform private.transition_lead_status_impl(
      v_row.lead_id, 'closed_lost', p_closed_lost_reason, p_closure_reason_code
    );

    return v_row;
  end if;

  return v_row;
end;
$$;

create or replace function public.complete_lead_activity(
  p_activity_id uuid,
  p_outcome_code text,
  p_completion_note text default null,
  p_resolution text default null,
  p_next_activity_type text default null,
  p_next_title text default null,
  p_next_due_at timestamptz default null,
  p_next_priority text default null,
  p_next_duration_minutes integer default null,
  p_next_reminder_at timestamptz default null,
  p_next_quotation_id uuid default null,
  p_on_hold_reason text default null,
  p_on_hold_review_at timestamptz default null,
  p_closed_lost_reason text default null,
  p_closure_reason_code text default null,
  p_whatsapp_send_intent_id uuid default null
)
returns public.lead_follow_ups
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.complete_lead_activity_impl(
    p_activity_id, p_outcome_code, p_completion_note, p_resolution,
    p_next_activity_type, p_next_title, p_next_due_at, p_next_priority,
    p_next_duration_minutes, p_next_reminder_at, p_next_quotation_id,
    p_on_hold_reason, p_on_hold_review_at, p_closed_lost_reason,
    p_closure_reason_code, p_whatsapp_send_intent_id
  );
end;
$$;

-- =============================================================================
-- N. private.accepted_quotation_close_won_impl — Closed Won stops the cadence
--    Commercial authority is otherwise untouched; Closed Won remains exclusive
--    to accepted quotation acceptance.
-- =============================================================================

create or replace function private.accepted_quotation_close_won_impl(
  p_lead_id uuid,
  p_accepted_at timestamptz,
  p_actor_id uuid,
  p_quotation_version_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_status text;
begin
  select status into v_old_status
  from public.leads
  where id = p_lead_id;

  if v_old_status is null then
    raise exception 'LEAD_NOT_FOUND: Lead % does not exist.', p_lead_id;
  end if;

  if v_old_status = 'closed_won' then
    return;
  end if;

  -- Set session bypass flag for lead update trigger
  perform set_config('onedecore.crm_transition', '1', true);

  -- Mutate lead status to closed_won
  update public.leads
  set status = 'closed_won',
      on_hold_reason = null,
      on_hold_since = null,
      on_hold_previous_status = null,
      updated_at = p_accepted_at
  where id = p_lead_id;

  -- Emit lead_events audit
  insert into public.lead_events (
    lead_id,
    event_type,
    actor_id,
    actor_type,
    event_data,
    occurred_at
  ) values (
    p_lead_id,
    'lead.status_changed',
    p_actor_id,
    'system',
    jsonb_build_object(
      'from_status', v_old_status,
      'to_status', 'closed_won',
      'reason', 'commercial_quotation_accepted',
      'quotation_version_id', p_quotation_version_id
    ),
    p_accepted_at
  );

  -- Emit lead_activities audit
  insert into public.lead_activities (
    lead_id,
    activity_type,
    reference_id,
    actor_id,
    summary,
    metadata,
    occurred_at
  ) values (
    p_lead_id,
    'status.changed',
    p_quotation_version_id,
    p_actor_id,
    'Lead transitioned to Closed-Won upon commercial quotation acceptance',
    jsonb_build_object(
      'from_status', v_old_status,
      'to_status', 'closed_won',
      'quotation_version_id', p_quotation_version_id
    ),
    p_accepted_at
  );

  -- CRM 2C mandatory stop: Closed Won ends any live cadence enrollment.
  perform private.stop_lead_cadence_for_system(p_lead_id, p_actor_id, 'lead_closed_won');
end;
$$;
-- =============================================================================
-- O. Ownership, revokes, grants
-- =============================================================================

alter function private.crm_cadence_next_step(uuid, smallint) owner to postgres;
alter function private.materialize_cadence_step(uuid, uuid, uuid, uuid, timestamptz) owner to postgres;
alter function private.finalize_lead_cadence_after_manual_resolution(uuid, uuid, timestamptz) owner to postgres;
alter function private.pause_lead_cadence_for_hold(uuid, uuid) owner to postgres;
alter function private.stop_lead_cadence_for_system(uuid, uuid, text) owner to postgres;
alter function private.crm_require_cadence_manager() owner to postgres;
alter function private.crm_assert_cadence_name_available(text, uuid) owner to postgres;
alter function private.crm_cadence_assert_lead_operable(public.leads) owner to postgres;
alter function private.crm_cadence_load_enrollment_for_write(uuid) owner to postgres;
alter function private.trg_crm_cadence_steps_draft_only() owner to postgres;
alter function private.trg_crm_cadence_enrollment_events_same_lead() owner to postgres;

alter function private.create_cadence_template_impl(text, text) owner to postgres;
alter function private.update_cadence_template_impl(uuid, text, text) owner to postgres;
alter function private.replace_cadence_template_steps_impl(uuid, jsonb) owner to postgres;
alter function private.publish_cadence_template_impl(uuid) owner to postgres;
alter function private.archive_cadence_template_impl(uuid) owner to postgres;
alter function private.duplicate_cadence_template_impl(uuid, text) owner to postgres;
alter function private.enroll_lead_in_cadence_impl(uuid, uuid) owner to postgres;
alter function private.pause_lead_cadence_impl(uuid) owner to postgres;
alter function private.resume_lead_cadence_impl(uuid) owner to postgres;
alter function private.cancel_lead_cadence_impl(uuid) owner to postgres;

alter function public.create_cadence_template(text, text) owner to postgres;
alter function public.update_cadence_template(uuid, text, text) owner to postgres;
alter function public.replace_cadence_template_steps(uuid, jsonb) owner to postgres;
alter function public.publish_cadence_template(uuid) owner to postgres;
alter function public.archive_cadence_template(uuid) owner to postgres;
alter function public.duplicate_cadence_template(uuid, text) owner to postgres;
alter function public.enroll_lead_in_cadence(uuid, uuid) owner to postgres;
alter function public.pause_lead_cadence(uuid) owner to postgres;
alter function public.resume_lead_cadence(uuid) owner to postgres;
alter function public.cancel_lead_cadence(uuid) owner to postgres;

-- Internal engine helpers: reachable only from DEFINER impls under the same
-- postgres owner. No authenticated execute anywhere.
revoke all on function private.crm_cadence_next_step(uuid, smallint) from public, anon, authenticated;
revoke all on function private.materialize_cadence_step(uuid, uuid, uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function private.finalize_lead_cadence_after_manual_resolution(uuid, uuid, timestamptz) from public, anon, authenticated;
revoke all on function private.pause_lead_cadence_for_hold(uuid, uuid) from public, anon, authenticated;
revoke all on function private.stop_lead_cadence_for_system(uuid, uuid, text) from public, anon, authenticated;
revoke all on function private.crm_require_cadence_manager() from public, anon, authenticated;
revoke all on function private.crm_assert_cadence_name_available(text, uuid) from public, anon, authenticated;
revoke all on function private.crm_cadence_assert_lead_operable(public.leads) from public, anon, authenticated;
revoke all on function private.crm_cadence_load_enrollment_for_write(uuid) from public, anon, authenticated;

-- Private impls behind INVOKER wrappers.
revoke all on function private.create_cadence_template_impl(text, text) from public, anon;
revoke all on function private.update_cadence_template_impl(uuid, text, text) from public, anon;
revoke all on function private.replace_cadence_template_steps_impl(uuid, jsonb) from public, anon;
revoke all on function private.publish_cadence_template_impl(uuid) from public, anon;
revoke all on function private.archive_cadence_template_impl(uuid) from public, anon;
revoke all on function private.duplicate_cadence_template_impl(uuid, text) from public, anon;
revoke all on function private.enroll_lead_in_cadence_impl(uuid, uuid) from public, anon;
revoke all on function private.pause_lead_cadence_impl(uuid) from public, anon;
revoke all on function private.resume_lead_cadence_impl(uuid) from public, anon;
revoke all on function private.cancel_lead_cadence_impl(uuid) from public, anon;

grant execute on function private.create_cadence_template_impl(text, text) to authenticated;
grant execute on function private.update_cadence_template_impl(uuid, text, text) to authenticated;
grant execute on function private.replace_cadence_template_steps_impl(uuid, jsonb) to authenticated;
grant execute on function private.publish_cadence_template_impl(uuid) to authenticated;
grant execute on function private.archive_cadence_template_impl(uuid) to authenticated;
grant execute on function private.duplicate_cadence_template_impl(uuid, text) to authenticated;
grant execute on function private.enroll_lead_in_cadence_impl(uuid, uuid) to authenticated;
grant execute on function private.pause_lead_cadence_impl(uuid) to authenticated;
grant execute on function private.resume_lead_cadence_impl(uuid) to authenticated;
grant execute on function private.cancel_lead_cadence_impl(uuid) to authenticated;

-- Public wrappers: authenticated only.
revoke all on function public.create_cadence_template(text, text) from public, anon;
revoke all on function public.update_cadence_template(uuid, text, text) from public, anon;
revoke all on function public.replace_cadence_template_steps(uuid, jsonb) from public, anon;
revoke all on function public.publish_cadence_template(uuid) from public, anon;
revoke all on function public.archive_cadence_template(uuid) from public, anon;
revoke all on function public.duplicate_cadence_template(uuid, text) from public, anon;
revoke all on function public.enroll_lead_in_cadence(uuid, uuid) from public, anon;
revoke all on function public.pause_lead_cadence(uuid) from public, anon;
revoke all on function public.resume_lead_cadence(uuid) from public, anon;
revoke all on function public.cancel_lead_cadence(uuid) from public, anon;

grant execute on function public.create_cadence_template(text, text) to authenticated;
grant execute on function public.update_cadence_template(uuid, text, text) to authenticated;
grant execute on function public.replace_cadence_template_steps(uuid, jsonb) to authenticated;
grant execute on function public.publish_cadence_template(uuid) to authenticated;
grant execute on function public.archive_cadence_template(uuid) to authenticated;
grant execute on function public.duplicate_cadence_template(uuid, text) to authenticated;
grant execute on function public.enroll_lead_in_cadence(uuid, uuid) to authenticated;
grant execute on function public.pause_lead_cadence(uuid) to authenticated;
grant execute on function public.resume_lead_cadence(uuid) to authenticated;
grant execute on function public.cancel_lead_cadence(uuid) to authenticated;

-- Re-affirm privileges on the replaced canonical authorities (create or replace
-- preserves them; asserted explicitly so drift is impossible).
alter function private.transition_lead_status_impl(uuid, text, text, text) owner to postgres;
revoke all on function private.transition_lead_status_impl(uuid, text, text, text) from public, anon;
grant execute on function private.transition_lead_status_impl(uuid, text, text, text) to authenticated;

alter function private.complete_lead_activity_impl(
  uuid, text, text, text,
  text, text, timestamptz, text,
  integer, timestamptz, uuid,
  text, timestamptz, text, text, uuid
) owner to postgres;
revoke all on function private.complete_lead_activity_impl(
  uuid, text, text, text,
  text, text, timestamptz, text,
  integer, timestamptz, uuid,
  text, timestamptz, text, text, uuid
) from public, anon;
grant execute on function private.complete_lead_activity_impl(
  uuid, text, text, text,
  text, text, timestamptz, text,
  integer, timestamptz, uuid,
  text, timestamptz, text, text, uuid
) to authenticated;

alter function public.complete_lead_activity(
  uuid, text, text, text,
  text, text, timestamptz, text,
  integer, timestamptz, uuid,
  text, timestamptz, text, text, uuid
) owner to postgres;
revoke all on function public.complete_lead_activity(
  uuid, text, text, text,
  text, text, timestamptz, text,
  integer, timestamptz, uuid,
  text, timestamptz, text, text, uuid
) from public, anon;
grant execute on function public.complete_lead_activity(
  uuid, text, text, text,
  text, text, timestamptz, text,
  integer, timestamptz, uuid,
  text, timestamptz, text, text, uuid
) to authenticated;

alter function private.accepted_quotation_close_won_impl(uuid, timestamptz, uuid, uuid) owner to postgres;
revoke all on function private.accepted_quotation_close_won_impl(uuid, timestamptz, uuid, uuid)
  from public, anon, authenticated;

-- =============================================================================
-- P. Comments
-- =============================================================================

comment on function public.create_cadence_template(text, text) is
  'CRM 2C: create a draft cadence template. Requires crm.cadences.manage.';
comment on function public.replace_cadence_template_steps(uuid, jsonb) is
  'CRM 2C: replace the whole ordered step list of a DRAFT template. p_steps is a plain record array (activityType/title/priority/delayHours/durationMinutes/reminderOffsetMinutes) normalized into crm_cadence_steps rows. No conditions, branching or expressions are accepted.';
comment on function public.publish_cadence_template(uuid) is
  'CRM 2C: publish a draft (>= 1 step, contiguous order). Published steps are frozen; revise via duplicate_cadence_template.';
comment on function public.archive_cadence_template(uuid) is
  'CRM 2C: archive a template. Existing enrollments are untouched; no new enrollment is possible.';
comment on function public.enroll_lead_in_cadence(uuid, uuid) is
  'CRM 2C: manual enrollment (D9). Requires crm.follow_ups.manage + crm_can_mutate_lead. Creates the first cadence step as the single open primary next action. Never sends any message.';
comment on function public.pause_lead_cadence(uuid) is
  'CRM 2C: pause an active enrollment. No further steps materialize; the currently open activity stays open and primary.';
comment on function public.resume_lead_cadence(uuid) is
  'CRM 2C: resume a paused enrollment without duplicating a primary. Reuses the already-open cadence activity when present, else materializes the next step, else completes the enrollment.';
comment on function public.cancel_lead_cadence(uuid) is
  'CRM 2C: cancel an enrollment (stop_reason=cancelled_by_user). The currently open activity is never cancelled, so the lead keeps its primary next action.';

comment on function private.transition_lead_status_impl(uuid, text, text, text) is
  'CRM 2C: canonical manual stage authority. Adds owner-locked stage gates (contacted / consultation_scheduled / proposal_sent) evaluated against canonical evidence before any mutation, and reacts to on_hold (cadence pause) and closed_lost (cadence stop). Closed Won remains rejected; new/assigned remain assignment-owned.';

comment on function public.complete_lead_activity(
  uuid, text, text, text,
  text, text, timestamptz, text,
  integer, timestamptz, uuid,
  text, timestamptz, text, text, uuid
) is
  'CRM 2A-3 + CRM 2C: complete activity with structured outcome and resolution (NEXT_PRIMARY | CADENCE_NEXT | ON_HOLD | CLOSED_LOST | NONE). CADENCE_NEXT materializes exactly one next cadence step. CLOSED_WON is hard-rejected; Closed Won remains quotation-acceptance exclusive.';

-- =============================================================================
-- Q. Postconditions
-- =============================================================================

do $$
declare
  v_templates bigint;
  v_steps bigint;
  v_enrollments bigint;
  v_cadence_activities bigint;
  v_policy public.crm_sla_policies%rowtype;
  v_transition_def text;
  v_complete_def text;
begin
  -- G / D8: no production cadence seed of any kind.
  select count(*) into v_templates from public.crm_cadence_templates;
  select count(*) into v_steps from public.crm_cadence_steps;
  select count(*) into v_enrollments from public.crm_lead_cadence_enrollments;
  select count(*) into v_cadence_activities
  from public.lead_follow_ups where source = 'cadence';

  if v_templates <> 0 or v_steps <> 0 or v_enrollments <> 0 or v_cadence_activities <> 0 then
    raise exception 'CRM 2C postcondition: cadence tables must ship empty (t=%, s=%, e=%, a=%)',
      v_templates, v_steps, v_enrollments, v_cadence_activities;
  end if;

  -- SLA activation remains untouched.
  select * into v_policy from public.crm_sla_policies where policy_code = 'first_contact';
  if not found then
    raise exception 'CRM 2C postcondition: first_contact policy missing';
  end if;
  if v_policy.is_active
    or v_policy.business_hours_enabled
    or v_policy.business_hours_config is not null
    or v_policy.effective_from is not null
    or v_policy.activated_at is not null
  then
    raise exception 'CRM 2C postcondition: first_contact SLA policy must remain inactive/unconfigured';
  end if;

  if exists (select 1 from public.crm_sla_clocks where sla_due_at is not null) then
    raise exception 'CRM 2C postcondition: no SLA due dates may be materialized';
  end if;

  -- Stage gates live inside the canonical transition authority only.
  v_transition_def := pg_get_functiondef(
    'private.transition_lead_status_impl(uuid,text,text,text)'::regprocedure
  );
  if v_transition_def not like '%CRM_STAGE_GATE_FIRST_CONTACT_REQUIRED%'
    or v_transition_def not like '%CRM_STAGE_GATE_CONSULTATION_REQUIRED%'
    or v_transition_def not like '%CRM_STAGE_GATE_PROPOSAL_DELIVERY_REQUIRED%'
    or v_transition_def not like '%CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE%'
  then
    raise exception 'CRM 2C postcondition: transition authority missing gates or Closed-Won guard';
  end if;

  v_complete_def := pg_get_functiondef(
    'private.complete_lead_activity_impl(uuid,text,text,text,text,text,timestamptz,text,integer,timestamptz,uuid,text,timestamptz,text,text,uuid)'::regprocedure
  );
  if v_complete_def not like '%CADENCE_NEXT%'
    or v_complete_def not like '%CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE%'
  then
    raise exception 'CRM 2C postcondition: complete authority missing CADENCE_NEXT or Closed-Won guard';
  end if;

  -- No cadence code path may reach WhatsApp transport.
  if v_complete_def like '%create_whatsapp_service_send_intent%'
    or pg_get_functiondef(
      'private.materialize_cadence_step(uuid,uuid,uuid,uuid,timestamptz)'::regprocedure
    ) like '%whatsapp_send_intent%'
  then
    raise exception 'CRM 2C postcondition: cadence engine must not reference WhatsApp send authority';
  end if;
end;
$$;
