-- ONEDECORE Phase 6C — Kriti human-controlled copilot audit persistence foundation
-- Append-only run + event model. No provider keys. No business mutations.

-- -----------------------------------------------------------------------------
-- A. Immutable run identity
-- -----------------------------------------------------------------------------

create table public.kriti_runs (
  id uuid primary key,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  task_type text not null,
  target_type text,
  target_id uuid,
  provider_mode text not null,
  provider_code text,
  model_name text,
  context_digest text not null,
  context_provenance jsonb not null default '{}'::jsonb,
  status text not null default 'started',
  created_at timestamptz not null default now(),

  constraint chk_kriti_runs_task_type check (
    task_type in (
      'conversation_summary',
      'missing_information',
      'objection_suggestions',
      'next_action_suggestions',
      'service_reply_draft',
      'quotation_wording_draft',
      'project_update_draft',
      'design_summary',
      'campaign_copy_draft'
    )
  ),
  constraint chk_kriti_runs_provider_mode check (
    provider_mode in ('disabled', 'local-test', 'enabled')
  ),
  constraint chk_kriti_runs_status check (
    status in ('started', 'succeeded', 'failed')
  ),
  constraint chk_kriti_runs_target_type check (
    target_type is null
    or target_type in ('whatsapp_conversation', 'crm_lead', 'quotation', 'project', 'campaign')
  ),
  constraint chk_kriti_runs_context_digest check (
    char_length(context_digest) = 64
  ),
  constraint chk_kriti_runs_context_provenance check (
    pg_column_size(context_provenance) <= 4096
  )
);

create index idx_kriti_runs_actor_created
  on public.kriti_runs (actor_id, created_at desc);

create index idx_kriti_runs_target
  on public.kriti_runs (target_type, target_id, created_at desc)
  where target_id is not null;

comment on table public.kriti_runs is
  'Immutable Kriti inference run identity. One row per staff-triggered assist request.';

-- -----------------------------------------------------------------------------
-- B. Append-only audit events
-- -----------------------------------------------------------------------------

create table public.kriti_events (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.kriti_runs (id) on delete restrict,
  event_type text not null,
  actor_id uuid references public.profiles (id) on delete set null,
  details jsonb not null default '{}'::jsonb,
  error_code text,
  usage_metadata jsonb,
  created_at timestamptz not null default now(),

  constraint chk_kriti_events_type check (
    event_type in (
      'kriti.request',
      'kriti.suggestion',
      'kriti.human_use',
      'kriti.dismiss',
      'kriti.request_failed',
      'kriti.retry'
    )
  ),
  constraint chk_kriti_events_details check (
    pg_column_size(details) <= 4096
  ),
  constraint chk_kriti_events_usage_metadata check (
    usage_metadata is null or pg_column_size(usage_metadata) <= 2048
  ),
  constraint chk_kriti_events_error_code check (
    error_code is null or char_length(error_code) <= 64
  )
);

create index idx_kriti_events_run_created
  on public.kriti_events (run_id, created_at asc);

create trigger trg_kriti_events_no_update
  before update on public.kriti_events
  for each row execute function private.forbid_append_only_mutation();

create trigger trg_kriti_events_no_delete
  before delete on public.kriti_events
  for each row execute function private.forbid_append_only_mutation();

comment on table public.kriti_events is
  'Append-only Kriti audit events. No destructive correction path for ordinary roles.';

-- -----------------------------------------------------------------------------
-- C. RLS
-- -----------------------------------------------------------------------------

alter table public.kriti_runs enable row level security;
alter table public.kriti_events enable row level security;

revoke all on table public.kriti_runs from public, anon;
revoke all on table public.kriti_events from public, anon;

create policy kriti_runs_select_own
  on public.kriti_runs
  for select
  to authenticated
  using (actor_id = (select auth.uid()));

create policy kriti_events_select_own_run
  on public.kriti_events
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.kriti_runs r
      where r.id = kriti_events.run_id
        and r.actor_id = (select auth.uid())
    )
  );

grant select on table public.kriti_runs to authenticated;
grant select on table public.kriti_events to authenticated;

-- -----------------------------------------------------------------------------
-- D. Active staff helper
-- -----------------------------------------------------------------------------

create or replace function private.kriti_require_active_actor()
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
    raise exception 'authentication required' using errcode = '42501';
  end if;

  if not exists (
    select 1
    from public.profiles p
    where p.id = v_actor
      and p.status = 'active'
  ) then
    raise exception 'inactive or suspended staff' using errcode = '42501';
  end if;

  return v_actor;
end;
$$;

comment on function private.kriti_require_active_actor() is
  'Resolves authenticated active staff actor for Kriti audit RPCs.';

-- -----------------------------------------------------------------------------
-- E. RPC — start run + request event (no provider call inside)
-- -----------------------------------------------------------------------------

create or replace function public.start_kriti_run(
  p_run_id uuid,
  p_task_type text,
  p_target_type text,
  p_target_id uuid,
  p_provider_mode text,
  p_provider_code text,
  p_model_name text,
  p_context_digest text,
  p_context_provenance jsonb default '{}'::jsonb
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
begin
  v_actor := private.kriti_require_active_actor();

  insert into public.kriti_runs (
    id,
    actor_id,
    task_type,
    target_type,
    target_id,
    provider_mode,
    provider_code,
    model_name,
    context_digest,
    context_provenance,
    status
  )
  values (
    p_run_id,
    v_actor,
    p_task_type,
    p_target_type,
    p_target_id,
    p_provider_mode,
    p_provider_code,
    p_model_name,
    p_context_digest,
    coalesce(p_context_provenance, '{}'::jsonb),
    'started'
  );

  insert into public.kriti_events (run_id, event_type, actor_id, details)
  values (
    p_run_id,
    'kriti.request',
    v_actor,
    jsonb_build_object(
      'task_type', p_task_type,
      'context_digest', p_context_digest
    )
  );

  return p_run_id;
end;
$$;

comment on function public.start_kriti_run(uuid, text, text, uuid, text, text, text, text, jsonb) is
  'Creates immutable Kriti run row and request audit event for active staff actor.';

-- -----------------------------------------------------------------------------
-- F. RPC — append audit event + optional run status transition
-- -----------------------------------------------------------------------------

create or replace function public.append_kriti_audit_event(
  p_run_id uuid,
  p_event_type text,
  p_details jsonb default '{}'::jsonb,
  p_error_code text default null,
  p_usage_metadata jsonb default null,
  p_run_status text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_run public.kriti_runs%rowtype;
  v_event_id uuid := gen_random_uuid();
begin
  v_actor := private.kriti_require_active_actor();

  select *
  into v_run
  from public.kriti_runs
  where id = p_run_id
  for update;

  if not found then
    raise exception 'kriti run not found' using errcode = 'P0002';
  end if;

  if v_run.actor_id <> v_actor then
    raise exception 'kriti run outside actor scope' using errcode = '42501';
  end if;

  insert into public.kriti_events (
    id,
    run_id,
    event_type,
    actor_id,
    details,
    error_code,
    usage_metadata
  )
  values (
    v_event_id,
    p_run_id,
    p_event_type,
    v_actor,
    coalesce(p_details, '{}'::jsonb),
    p_error_code,
    p_usage_metadata
  );

  if p_run_status is not null then
    update public.kriti_runs
    set status = p_run_status
    where id = p_run_id
      and status = 'started';
  end if;

  return v_event_id;
end;
$$;

comment on function public.append_kriti_audit_event(uuid, text, jsonb, text, jsonb, text) is
  'Appends Kriti audit event for the authenticated run owner. Optional terminal status on run.';

-- -----------------------------------------------------------------------------
-- G. Grants
-- -----------------------------------------------------------------------------

revoke all on function public.start_kriti_run(uuid, text, text, uuid, text, text, text, text, jsonb) from public, anon;
grant execute on function public.start_kriti_run(uuid, text, text, uuid, text, text, text, text, jsonb) to authenticated;

revoke all on function public.append_kriti_audit_event(uuid, text, jsonb, text, jsonb, text) from public, anon;
grant execute on function public.append_kriti_audit_event(uuid, text, jsonb, text, jsonb, text) to authenticated;

alter function public.start_kriti_run(uuid, text, text, uuid, text, text, text, text, jsonb) owner to postgres;
alter function public.append_kriti_audit_event(uuid, text, jsonb, text, jsonb, text) owner to postgres;
alter function private.kriti_require_active_actor() owner to postgres;

revoke all on function private.kriti_require_active_actor() from public, anon, authenticated;
