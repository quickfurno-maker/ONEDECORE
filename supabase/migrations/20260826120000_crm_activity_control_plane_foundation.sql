-- CRM 2A-1 — Activity control-plane foundation (forward-only)
-- Evolve public.lead_follow_ups; outcome catalogue; lead_follow_up_events;
-- owner-aware auth helper; gated create auto-primary; prospective events.
-- Does NOT: SLA clocks, My Day, assign/reassign wiring, UI, payments, managed apply.

-- =============================================================================
-- A. Outcome catalogue
-- =============================================================================

create table public.lead_activity_outcome_codes (
  code text primary key,
  display_name text not null,
  activity_types text[] not null default '{}'::text[],
  closes_contact_attempt boolean not null default false,
  is_active boolean not null default true,
  display_order smallint not null default 0,
  created_at timestamptz not null default now(),
  constraint chk_lead_activity_outcome_codes_code
    check (code ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint chk_lead_activity_outcome_codes_display_name
    check (length(trim(display_name)) between 2 and 120)
);

comment on table public.lead_activity_outcome_codes is
  'CRM activity outcome catalogue. closes_contact_attempt seeds later SLA first-contact attempt logic; unused at runtime in 2A-1.';

comment on column public.lead_activity_outcome_codes.closes_contact_attempt is
  'When true, outcome may qualify as a first-contact ATTEMPT for later SLA. voicemail is locked true. whatsapp_sent alone is false — governed send evidence required later.';

comment on column public.lead_activity_outcome_codes.activity_types is
  'Empty array means outcome applies to all activity types; otherwise restrict to listed types.';

insert into public.lead_activity_outcome_codes
  (code, display_name, activity_types, closes_contact_attempt, display_order)
values
  ('connected', 'Connected', '{}', true, 10),
  ('no_answer', 'No answer', '{}', true, 20),
  ('busy', 'Busy', '{}', true, 30),
  ('callback_requested', 'Callback requested', '{}', true, 40),
  ('voicemail', 'Voicemail', '{}', true, 50),
  ('not_interested', 'Not interested', '{}', true, 60),
  ('whatsapp_sent', 'WhatsApp sent', array['whatsapp']::text[], false, 70),
  ('consultation_booked', 'Consultation booked', '{}', true, 80),
  ('needs_manager', 'Needs manager', '{}', false, 90),
  ('completed', 'Completed', '{}', false, 100),
  ('rescheduled', 'Rescheduled', '{}', false, 110),
  ('quotation_sent', 'Quotation sent', array['quotation_follow_up']::text[], false, 120)
on conflict (code) do nothing;

alter table public.lead_activity_outcome_codes enable row level security;

revoke all on table public.lead_activity_outcome_codes from public, anon, authenticated;
grant select on table public.lead_activity_outcome_codes to authenticated;

create policy lead_activity_outcome_codes_select
  on public.lead_activity_outcome_codes
  for select
  to authenticated
  using (
    (select public.authorize('crm.follow_ups.manage'))
    or (select public.authorize('crm.activities.read'))
    or (select public.authorize('leads.read_all'))
    or (select public.authorize('leads.read_assigned'))
    or (select public.authorize('leads.read'))
  );

-- =============================================================================
-- B. Evolve public.lead_follow_ups
-- =============================================================================

alter table public.lead_follow_ups
  add column if not exists activity_type text not null default 'call',
  add column if not exists title text not null default 'Follow-up',
  add column if not exists priority text not null default 'normal',
  add column if not exists is_primary_next_action boolean not null default false,
  add column if not exists duration_minutes smallint,
  add column if not exists reminder_at timestamptz,
  add column if not exists outcome_code text,
  add column if not exists completion_note text,
  add column if not exists quotation_id uuid,
  add column if not exists source text not null default 'manual',
  add column if not exists updated_at timestamptz not null default now();

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_lead_follow_ups_activity_type'
      and conrelid = 'public.lead_follow_ups'::regclass
  ) then
    alter table public.lead_follow_ups
      add constraint chk_lead_follow_ups_activity_type check (
        activity_type in (
          'call',
          'whatsapp',
          'consultation',
          'site_visit',
          'quotation_follow_up',
          'internal_task'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_lead_follow_ups_title'
      and conrelid = 'public.lead_follow_ups'::regclass
  ) then
    alter table public.lead_follow_ups
      add constraint chk_lead_follow_ups_title check (
        length(trim(title)) between 1 and 120
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_lead_follow_ups_priority'
      and conrelid = 'public.lead_follow_ups'::regclass
  ) then
    alter table public.lead_follow_ups
      add constraint chk_lead_follow_ups_priority check (
        priority in ('low', 'normal', 'high', 'urgent')
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_lead_follow_ups_primary_open'
      and conrelid = 'public.lead_follow_ups'::regclass
  ) then
    alter table public.lead_follow_ups
      add constraint chk_lead_follow_ups_primary_open check (
        is_primary_next_action = false or status = 'open'
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_lead_follow_ups_duration_minutes'
      and conrelid = 'public.lead_follow_ups'::regclass
  ) then
    alter table public.lead_follow_ups
      add constraint chk_lead_follow_ups_duration_minutes check (
        duration_minutes is null or duration_minutes between 1 and 1440
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_lead_follow_ups_reminder_at'
      and conrelid = 'public.lead_follow_ups'::regclass
  ) then
    alter table public.lead_follow_ups
      add constraint chk_lead_follow_ups_reminder_at check (
        reminder_at is null or reminder_at <= due_at
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_lead_follow_ups_completion_note'
      and conrelid = 'public.lead_follow_ups'::regclass
  ) then
    alter table public.lead_follow_ups
      add constraint chk_lead_follow_ups_completion_note check (
        completion_note is null or length(trim(completion_note)) between 1 and 1000
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'chk_lead_follow_ups_source'
      and conrelid = 'public.lead_follow_ups'::regclass
  ) then
    alter table public.lead_follow_ups
      add constraint chk_lead_follow_ups_source check (
        source in (
          'manual',
          'sla_auto',
          'completion_chain',
          'on_hold_review',
          'import'
        )
      );
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'lead_follow_ups_outcome_code_fkey'
      and conrelid = 'public.lead_follow_ups'::regclass
  ) then
    alter table public.lead_follow_ups
      add constraint lead_follow_ups_outcome_code_fkey
      foreign key (outcome_code)
      references public.lead_activity_outcome_codes (code)
      on delete restrict;
  end if;

  if not exists (
    select 1 from pg_constraint
    where conname = 'lead_follow_ups_quotation_id_fkey'
      and conrelid = 'public.lead_follow_ups'::regclass
  ) then
    alter table public.lead_follow_ups
      add constraint lead_follow_ups_quotation_id_fkey
      foreign key (quotation_id)
      references public.quotations (id)
      on delete restrict;
  end if;
end;
$$;

comment on column public.lead_follow_ups.is_primary_next_action is
  'Open primary next-action flag. At most one open primary per lead (partial unique). Not a global must-have-primary invariant in 2A-1.';

-- Same-lead quotation integrity
create or replace function private.trg_lead_follow_ups_quotation_same_lead()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if NEW.quotation_id is null then
    return NEW;
  end if;

  if not exists (
    select 1
    from public.quotations q
    where q.id = NEW.quotation_id
      and q.lead_id = NEW.lead_id
  ) then
    raise exception 'quotation_id must reference a quotation for the same lead'
      using errcode = '23514';
  end if;

  return NEW;
end;
$$;

drop trigger if exists trg_lead_follow_ups_quotation_same_lead on public.lead_follow_ups;
create trigger trg_lead_follow_ups_quotation_same_lead
  before insert or update of quotation_id, lead_id
  on public.lead_follow_ups
  for each row
  execute function private.trg_lead_follow_ups_quotation_same_lead();

revoke all on function private.trg_lead_follow_ups_quotation_same_lead() from public, anon, authenticated;

-- =============================================================================
-- C. Deterministic primary backfill (existing open rows) + validation
-- =============================================================================

do $$
declare
  v_before bigint;
  v_after bigint;
  v_multi_primary bigint;
  v_open_without_primary bigint;
begin
  select count(*) into v_before from public.lead_follow_ups;

  -- Explicit structured defaults (idempotent for already-defaulted rows)
  update public.lead_follow_ups
  set activity_type = coalesce(nullif(trim(activity_type), ''), 'call'),
      title = coalesce(nullif(trim(title), ''), 'Follow-up'),
      priority = coalesce(nullif(trim(priority), ''), 'normal'),
      source = coalesce(nullif(trim(source), ''), 'manual'),
      updated_at = coalesce(updated_at, now())
  where true;

  -- Index-safety normalization: one primary per lead that already has open rows.
  -- NOT the later global runtime invariant; NOT the create-RPC auto-primary gate.
  with ranked as (
    select
      id,
      lead_id,
      row_number() over (
        partition by lead_id
        order by due_at asc nulls last, created_at asc, id asc
      ) as rn
    from public.lead_follow_ups
    where status = 'open'
  )
  update public.lead_follow_ups f
  set is_primary_next_action = true,
      updated_at = now()
  from ranked r
  where f.id = r.id
    and r.rn = 1
    and f.is_primary_next_action is distinct from true;

  select count(*) into v_after from public.lead_follow_ups;
  if v_after <> v_before then
    raise exception 'CRM 2A-1 backfill changed lead_follow_ups row count (% -> %)',
      v_before, v_after;
  end if;

  select count(*) into v_multi_primary
  from (
    select lead_id
    from public.lead_follow_ups
    where status = 'open'
      and is_primary_next_action = true
    group by lead_id
    having count(*) > 1
  ) t;
  if v_multi_primary > 0 then
    raise exception 'CRM 2A-1 backfill left % leads with >1 open primary', v_multi_primary;
  end if;

  select count(*) into v_open_without_primary
  from (
    select lead_id
    from public.lead_follow_ups
    where status = 'open'
    group by lead_id
    having count(*) filter (where is_primary_next_action = true) <> 1
  ) t;
  if v_open_without_primary > 0 then
    raise exception
      'CRM 2A-1 backfill left % leads with open rows but not exactly one primary',
      v_open_without_primary;
  end if;
end;
$$;

-- Partial unique: at most one open primary per lead
create unique index if not exists uq_lead_follow_ups_one_primary_open
  on public.lead_follow_ups (lead_id)
  where status = 'open' and is_primary_next_action = true;

-- Owner primary queue (My Day later). Retain idx_lead_follow_ups_lead_due +
-- idx_lead_follow_ups_owner_status_due; skip redundant open-by-lead index.
create index if not exists idx_lead_follow_ups_owner_primary_open_due
  on public.lead_follow_ups (owner_id, due_at)
  where status = 'open' and is_primary_next_action = true;

-- =============================================================================
-- D. lead_follow_up_events (append-only lifecycle audit)
-- =============================================================================

create table public.lead_follow_up_events (
  id uuid primary key default gen_random_uuid(),
  follow_up_id uuid not null references public.lead_follow_ups (id) on delete restrict,
  lead_id uuid not null references public.leads (id) on delete restrict,
  actor_id uuid references public.profiles (id) on delete set null,
  event_type text not null,
  previous_values jsonb not null default '{}'::jsonb,
  new_values jsonb not null default '{}'::jsonb,
  reason_code text,
  reason_note text,
  created_at timestamptz not null default now(),
  constraint chk_lead_follow_up_events_event_type check (
    event_type in (
      'created',
      'rescheduled',
      'ownership_transferred',
      'priority_changed',
      'primary_designated',
      'primary_cleared',
      'completed',
      'cancelled',
      'outcome_recorded',
      'reminder_changed'
    )
  ),
  constraint chk_lead_follow_up_events_previous_values check (
    jsonb_typeof(previous_values) = 'object'
    and pg_column_size(previous_values) <= 2048
  ),
  constraint chk_lead_follow_up_events_new_values check (
    jsonb_typeof(new_values) = 'object'
    and pg_column_size(new_values) <= 2048
  ),
  constraint chk_lead_follow_up_events_reason_note check (
    reason_note is null or length(trim(reason_note)) between 1 and 500
  )
);

comment on table public.lead_follow_up_events is
  'Append-only detailed follow-up lifecycle audit. Distinct from lead_activities staff timeline summaries. No historical backfill in 2A-1.';

create index if not exists idx_lead_follow_up_events_lead_created
  on public.lead_follow_up_events (lead_id, created_at desc);

create index if not exists idx_lead_follow_up_events_follow_up_created
  on public.lead_follow_up_events (follow_up_id, created_at desc);

create or replace function private.trg_lead_follow_up_events_same_lead()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if not exists (
    select 1
    from public.lead_follow_ups f
    where f.id = NEW.follow_up_id
      and f.lead_id = NEW.lead_id
  ) then
    raise exception 'lead_follow_up_events.lead_id must match follow_up.lead_id'
      using errcode = '23514';
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_lead_follow_up_events_same_lead on public.lead_follow_up_events;
create trigger trg_lead_follow_up_events_same_lead
  before insert on public.lead_follow_up_events
  for each row
  execute function private.trg_lead_follow_up_events_same_lead();

create trigger trg_lead_follow_up_events_no_update
  before update on public.lead_follow_up_events
  for each row
  execute function private.forbid_append_only_mutation();

create trigger trg_lead_follow_up_events_no_delete
  before delete on public.lead_follow_up_events
  for each row
  execute function private.forbid_append_only_mutation();

revoke all on function private.trg_lead_follow_up_events_same_lead() from public, anon, authenticated;

alter table public.lead_follow_up_events enable row level security;

revoke all on table public.lead_follow_up_events from public, anon, authenticated;
grant select on table public.lead_follow_up_events to authenticated;

create policy lead_follow_up_events_select
  on public.lead_follow_up_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.leads l
      where l.id = lead_follow_up_events.lead_id
        and (select private.crm_can_view_lead(l.assigned_to))
    )
  );

-- =============================================================================
-- E. Owner-aware target-user auth helper (foundation only; not wired to assign)
-- =============================================================================

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
      from public.leads l
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

comment on function private.crm_user_can_operate_lead(uuid, uuid, text) is
  'Target-user lead operate check. Evaluates p_user_id permission + visibility; ignores caller auth.uid(). Foundation only in CRM 2A-1.';

revoke all on function private.crm_user_can_operate_lead(uuid, uuid, text)
  from public, anon, authenticated;
grant execute on function private.crm_user_can_operate_lead(uuid, uuid, text) to authenticated;

alter function private.crm_user_can_operate_lead(uuid, uuid, text) owner to postgres;

-- =============================================================================
-- F. Minimal RPC updates — Strategy A (create / complete / cancel)
-- =============================================================================

create or replace function private.create_lead_follow_up_impl(
  p_lead_id uuid,
  p_due_at timestamptz,
  p_owner_id uuid default null
)
returns public.lead_follow_ups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_owner uuid;
  v_row public.lead_follow_ups%rowtype;
  v_assigned_to uuid;
  v_status text;
  v_is_primary boolean := false;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not (select public.authorize('crm.follow_ups.manage')) then
    raise exception 'Permission denied to manage follow-ups' using errcode = '42501';
  end if;

  -- Serialize against assign_lead_impl (lead FOR UPDATE) and parallel creates
  -- before authorization / owner / auto-primary decisions.
  select l.assigned_to, l.status
  into v_assigned_to, v_status
  from public.leads l
  where l.id = p_lead_id
  for update;

  if not found then
    raise exception 'Lead % not found', p_lead_id using errcode = 'P0002';
  end if;

  -- Re-evaluate mutate authorization after the lead lock so assignment-scoped
  -- access cannot become stale vs a concurrent reassignment.
  if not (select private.crm_can_mutate_lead(p_lead_id)) then
    raise exception 'Lead not visible for follow-up creation' using errcode = '42501';
  end if;

  if (select private.crm_has_broad_lead_read()) then
    v_owner := coalesce(p_owner_id, v_actor);
    if not (select private.crm_is_eligible_follow_up_owner(v_owner)) then
      raise exception 'Follow-up owner must be an active eligible CRM user' using errcode = '22023';
    end if;
  else
    v_owner := v_actor;
    if p_owner_id is not null and p_owner_id is distinct from v_actor then
      raise exception 'Sales executives may only create self-owned follow-ups' using errcode = '42501';
    end if;
  end if;

  -- Auto-primary ONLY when all owner-locked gates hold under the lead lock.
  v_is_primary :=
    v_assigned_to is not null
    and v_status not in ('closed_won', 'closed_lost', 'on_hold')
    and v_owner = v_assigned_to
    and not exists (
      select 1
      from public.lead_follow_ups f
      where f.lead_id = p_lead_id
        and f.status = 'open'
        and f.is_primary_next_action = true
    );

  insert into public.lead_follow_ups (
    lead_id,
    owner_id,
    due_at,
    status,
    created_by,
    activity_type,
    title,
    priority,
    is_primary_next_action,
    source,
    updated_at
  ) values (
    p_lead_id,
    v_owner,
    p_due_at,
    'open',
    v_actor,
    'call',
    'Follow-up',
    'normal',
    v_is_primary,
    'manual',
    now()
  )
  returning * into v_row;

  insert into public.lead_activities (lead_id, activity_type, reference_id, actor_id, summary, metadata)
  values (
    p_lead_id,
    'follow_up.scheduled',
    v_row.id,
    v_actor,
    'Follow-up scheduled',
    jsonb_build_object('dueAt', p_due_at, 'ownerId', v_owner)
  );

  insert into public.lead_follow_up_events (
    follow_up_id, lead_id, actor_id, event_type, previous_values, new_values
  ) values (
    v_row.id,
    p_lead_id,
    v_actor,
    'created',
    '{}'::jsonb,
    jsonb_build_object(
      'dueAt', p_due_at,
      'ownerId', v_owner,
      'isPrimaryNextAction', v_is_primary,
      'activityType', v_row.activity_type,
      'priority', v_row.priority,
      'source', v_row.source
    )
  );

  if v_is_primary then
    insert into public.lead_follow_up_events (
      follow_up_id, lead_id, actor_id, event_type, previous_values, new_values
    ) values (
      v_row.id,
      p_lead_id,
      v_actor,
      'primary_designated',
      jsonb_build_object('isPrimaryNextAction', false),
      jsonb_build_object('isPrimaryNextAction', true)
    );
  end if;

  return v_row;
end;
$$;

create or replace function private.complete_lead_follow_up_impl(
  p_follow_up_id uuid,
  p_outcome text default null
)
returns public.lead_follow_ups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_row public.lead_follow_ups%rowtype;
  v_was_primary boolean;
  v_outcome text;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not (select public.authorize('crm.follow_ups.manage')) then
    raise exception 'Permission denied to manage follow-ups' using errcode = '42501';
  end if;

  select * into v_row from public.lead_follow_ups where id = p_follow_up_id for update;
  if not found then
    raise exception 'Follow-up % not found', p_follow_up_id using errcode = 'P0002';
  end if;

  if not (select private.crm_can_view_lead_by_id(v_row.lead_id)) then
    raise exception 'Lead not visible for follow-up completion' using errcode = '42501';
  end if;

  if v_row.status <> 'open' then
    raise exception 'Only open follow-ups can be completed' using errcode = '22023';
  end if;

  v_was_primary := v_row.is_primary_next_action;
  v_outcome := nullif(trim(coalesce(p_outcome, '')), '');

  update public.lead_follow_ups
  set status = 'completed',
      outcome = v_outcome,
      completed_by = v_actor,
      completed_at = now(),
      is_primary_next_action = false,
      updated_at = now()
  where id = p_follow_up_id
  returning * into v_row;

  insert into public.lead_activities (lead_id, activity_type, reference_id, actor_id, summary, metadata)
  values (
    v_row.lead_id,
    'follow_up.completed',
    v_row.id,
    v_actor,
    'Follow-up completed',
    jsonb_build_object('outcome', v_row.outcome)
  );

  insert into public.lead_follow_up_events (
    follow_up_id, lead_id, actor_id, event_type, previous_values, new_values
  ) values (
    v_row.id,
    v_row.lead_id,
    v_actor,
    'completed',
    jsonb_build_object('status', 'open'),
    jsonb_build_object('status', 'completed')
  );

  if v_outcome is not null then
    insert into public.lead_follow_up_events (
      follow_up_id, lead_id, actor_id, event_type, previous_values, new_values
    ) values (
      v_row.id,
      v_row.lead_id,
      v_actor,
      'outcome_recorded',
      '{}'::jsonb,
      jsonb_build_object('outcome', v_outcome)
    );
  end if;

  if v_was_primary then
    insert into public.lead_follow_up_events (
      follow_up_id, lead_id, actor_id, event_type, previous_values, new_values
    ) values (
      v_row.id,
      v_row.lead_id,
      v_actor,
      'primary_cleared',
      jsonb_build_object('isPrimaryNextAction', true),
      jsonb_build_object('isPrimaryNextAction', false, 'reason', 'completed')
    );
  end if;

  return v_row;
end;
$$;

create or replace function private.cancel_lead_follow_up_impl(
  p_follow_up_id uuid,
  p_outcome text default null
)
returns public.lead_follow_ups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_row public.lead_follow_ups%rowtype;
  v_was_primary boolean;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not (select public.authorize('crm.follow_ups.manage')) then
    raise exception 'Permission denied to manage follow-ups' using errcode = '42501';
  end if;

  select * into v_row from public.lead_follow_ups where id = p_follow_up_id for update;
  if not found then
    raise exception 'Follow-up % not found', p_follow_up_id using errcode = 'P0002';
  end if;

  if not (select private.crm_can_view_lead_by_id(v_row.lead_id)) then
    raise exception 'Lead not visible for follow-up cancellation' using errcode = '42501';
  end if;

  if v_row.status <> 'open' then
    raise exception 'Only open follow-ups can be cancelled' using errcode = '22023';
  end if;

  v_was_primary := v_row.is_primary_next_action;

  update public.lead_follow_ups
  set status = 'cancelled',
      outcome = nullif(trim(coalesce(p_outcome, '')), ''),
      cancelled_by = v_actor,
      cancelled_at = now(),
      is_primary_next_action = false,
      updated_at = now()
  where id = p_follow_up_id
  returning * into v_row;

  insert into public.lead_activities (lead_id, activity_type, reference_id, actor_id, summary, metadata)
  values (
    v_row.lead_id,
    'follow_up.cancelled',
    v_row.id,
    v_actor,
    'Follow-up cancelled',
    jsonb_build_object('outcome', v_row.outcome)
  );

  insert into public.lead_follow_up_events (
    follow_up_id, lead_id, actor_id, event_type, previous_values, new_values
  ) values (
    v_row.id,
    v_row.lead_id,
    v_actor,
    'cancelled',
    jsonb_build_object('status', 'open'),
    jsonb_build_object('status', 'cancelled')
  );

  if v_was_primary then
    insert into public.lead_follow_up_events (
      follow_up_id, lead_id, actor_id, event_type, previous_values, new_values
    ) values (
      v_row.id,
      v_row.lead_id,
      v_actor,
      'primary_cleared',
      jsonb_build_object('isPrimaryNextAction', true),
      jsonb_build_object('isPrimaryNextAction', false, 'reason', 'cancelled')
    );
  end if;

  return v_row;
end;
$$;

alter function private.create_lead_follow_up_impl(uuid, timestamptz, uuid) owner to postgres;
alter function private.complete_lead_follow_up_impl(uuid, text) owner to postgres;
alter function private.cancel_lead_follow_up_impl(uuid, text) owner to postgres;
