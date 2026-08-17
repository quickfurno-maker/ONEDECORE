-- ============================================================================
-- M30 Migration: ONEDECORE Phase 8C Project Execution Workspace
-- Architecture: ADR-0026 / DEC-0075 / OD8C-1..OD8C-12
-- Forward-only. Does not rewrite M1-M29. No production seeds. No Phase 9.
-- ============================================================================

insert into public.permissions (code, name, description, is_system, is_active) values
  ('project_execution.read', 'Read project execution', 'Read Phase 8C execution workflow, snags, and evidence in role scope', true, true),
  ('project_execution.transition', 'Transition project execution', 'Advance ordinary post-design execution stages', true, true),
  ('project_execution.hold', 'Hold or resume execution', 'Hold or resume the execution workflow with a mandatory reason', true, true),
  ('project_execution.snag', 'Manage execution snags', 'Create, progress, and resolve execution snags', true, true),
  ('project_execution.cancel', 'Cancel project execution', 'Cancel the execution workflow with a mandatory reason', true, true)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  is_system = true,
  is_active = true;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.is_system = true
  and p.is_system = true
  and p.code = 'project_execution.read'
  and r.code in ('super_admin', 'sales_manager', 'project_manager')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.is_system = true
  and p.is_system = true
  and p.code = 'project_execution.transition'
  and r.code = 'project_manager'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.is_system = true
  and p.is_system = true
  and p.code = 'project_execution.hold'
  and r.code = 'project_manager'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.is_system = true
  and p.is_system = true
  and p.code = 'project_execution.snag'
  and r.code = 'project_manager'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.is_system = true
  and p.is_system = true
  and p.code = 'project_execution.cancel'
  and r.code in ('super_admin', 'sales_manager', 'project_manager')
on conflict (role_id, permission_id) do nothing;

create table public.project_execution_workflows (
  project_id uuid primary key references public.projects (id) on delete restrict,
  state text not null,
  held_from_state text null,
  hold_reason_code text null,
  hold_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null,
  cancelled_at timestamptz null,
  constraint chk_project_execution_workflows_state check (
    state in (
      'production',
      'ready_for_dispatch',
      'delivery',
      'installation',
      'snag_resolution',
      'handover',
      'completed',
      'on_hold',
      'cancelled'
    )
  ),
  constraint chk_project_execution_workflows_hold_context check (
    (
      state = 'on_hold'
      and held_from_state in (
        'production',
        'ready_for_dispatch',
        'delivery',
        'installation',
        'snag_resolution',
        'handover'
      )
      and hold_reason_code in (
        'client_decision_pending',
        'site_access_blocked',
        'material_delay',
        'weather',
        'internal_capacity',
        'other'
      )
      and hold_reason is not null
      and length(trim(hold_reason)) between 10 and 1000
    )
    or (
      state <> 'on_hold'
      and held_from_state is null
      and hold_reason_code is null
      and hold_reason is null
    )
  ),
  constraint chk_project_execution_workflows_terminals check (
    (
      state = 'completed'
      and completed_at is not null
      and cancelled_at is null
    )
    or (
      state = 'cancelled'
      and cancelled_at is not null
      and completed_at is null
    )
    or (
      state not in ('completed', 'cancelled')
      and completed_at is null
      and cancelled_at is null
    )
  )
);

comment on table public.project_execution_workflows is
  '1:1 Phase 8C execution workflow. Created after design_completed on handover_accepted. Post-design path only.';

create table public.project_execution_snags (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  title text not null,
  description text not null,
  status text not null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  resolved_by uuid null references public.profiles (id) on delete restrict,
  resolved_at timestamptz null,
  constraint chk_project_execution_snags_title check (length(trim(title)) between 1 and 160),
  constraint chk_project_execution_snags_description check (length(trim(description)) between 8 and 2000),
  constraint chk_project_execution_snags_status check (status in ('open', 'in_progress', 'resolved')),
  constraint chk_project_execution_snags_resolved_pair check (
    (
      status = 'resolved'
      and resolved_by is not null
      and resolved_at is not null
    )
    or (
      status <> 'resolved'
      and resolved_by is null
      and resolved_at is null
    )
  )
);

comment on table public.project_execution_snags is
  'Append-only execution snags. Current PM mutation only. Open/in_progress block handover and completion.';

create index idx_project_execution_snags_project
  on public.project_execution_snags (project_id, created_at desc);

create table public.project_execution_evidence (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  evidence_type text not null,
  target_state text null,
  snag_id uuid null references public.project_execution_snags (id) on delete restrict,
  source_type text not null,
  source_reference text not null,
  storage_object_path text null,
  file_sha256 text null,
  file_size_bytes bigint null,
  mime_type text null,
  captured_by uuid not null references public.profiles (id) on delete restrict,
  captured_at timestamptz not null default now(),
  note text null,
  constraint chk_project_execution_evidence_type check (
    evidence_type in (
      'stage_transition',
      'snag_resolution',
      'handover_acknowledgement',
      'completion_acknowledgement'
    )
  ),
  constraint chk_project_execution_evidence_source_type check (
    source_type in ('uploaded_artifact', 'whatsapp_message', 'offline_note')
  ),
  constraint chk_project_execution_evidence_source_reference check (
    length(trim(source_reference)) between 1 and 500
  ),
  constraint chk_project_execution_evidence_note check (
    note is null or length(note) <= 2000
  ),
  constraint chk_project_execution_evidence_semantics check (
    (
      evidence_type = 'stage_transition'
      and target_state in ('ready_for_dispatch', 'delivery', 'installation')
      and snag_id is null
    )
    or (
      evidence_type = 'snag_resolution'
      and snag_id is not null
      and target_state is null
    )
    or (
      evidence_type in ('handover_acknowledgement', 'completion_acknowledgement')
      and target_state is null
      and snag_id is null
    )
  ),
  constraint chk_project_execution_evidence_payload check (
    (
      source_type = 'uploaded_artifact'
      and storage_object_path is not null
      and length(trim(storage_object_path)) between 1 and 500
      and trim(source_reference) = trim(storage_object_path)
      and position('..' in storage_object_path) = 0
      and storage_object_path like ('projects/' || project_id::text || '/execution/evidence/%')
      and file_sha256 ~ '^[0-9a-f]{64}$'
      and file_size_bytes is not null
      and file_size_bytes > 0
      and file_size_bytes <= 20971520
      and mime_type in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp')
    )
    or (
      source_type = 'whatsapp_message'
      and storage_object_path is null
      and file_sha256 is null
      and file_size_bytes is null
      and mime_type is null
    )
    or (
      source_type = 'offline_note'
      and note is not null
      and length(trim(note)) >= 8
      and storage_object_path is null
      and file_sha256 is null
      and file_size_bytes is null
      and mime_type is null
    )
  )
);

comment on table public.project_execution_evidence is
  'Immutable Phase 8C execution evidence. Append-only. Dedicated private bucket.';

create index idx_project_execution_evidence_project
  on public.project_execution_evidence (project_id, captured_at desc);

insert into storage.buckets (id, name, public)
values ('project-execution-documents', 'project-execution-documents', false)
on conflict (id) do nothing;

create or replace function private.project_execution_entry_eligible(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    join public.project_design_workflows d on d.project_id = p.id
    where p.id = p_project_id
      and p.status = 'handover_accepted'
      and d.state = 'design_completed'
  );
$$;

create or replace function private.project_execution_is_current_pm(p_project_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    join public.profiles pr on pr.id = p_user_id
    join public.user_roles ur on ur.user_id = pr.id
    join public.roles r on r.id = ur.role_id
    where p.id = p_project_id
      and p.primary_pm_id = p_user_id
      and p.status = 'handover_accepted'
      and pr.status = 'active'
      and r.is_active = true
      and r.code = 'project_manager'
  );
$$;

create or replace function private.project_execution_can_view_detail(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    where p.id = p_project_id
      and (select public.authorize('project_execution.read'))
      and (
        (select private.has_role('super_admin'))
        or (select private.has_role('sales_manager'))
        or (
          (select private.has_role('project_manager'))
          and p.primary_pm_id = auth.uid()
        )
      )
  );
$$;

create or replace function private.project_execution_is_assigned_designer(p_project_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_designer_assignments a
    join public.profiles pr on pr.id = a.designer_id
    join public.user_roles ur on ur.user_id = pr.id
    join public.roles r on r.id = ur.role_id
    where a.project_id = p_project_id
      and a.designer_id = p_user_id
      and a.ended_at is null
      and pr.status = 'active'
      and r.is_active = true
      and r.code = 'designer'
  );
$$;

create or replace function private.project_execution_uploaded_evidence_object_exists(
  p_project_id uuid,
  p_object_path text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from storage.objects o
    where p_project_id is not null
      and p_object_path is not null
      and o.bucket_id = 'project-execution-documents'
      and o.name = trim(p_object_path)
      and position('..' in trim(p_object_path)) = 0
      and trim(p_object_path) like ('projects/' || p_project_id::text || '/execution/evidence/%')
  );
$$;

create or replace function private.project_execution_whatsapp_belongs_to_project(p_project_id uuid, p_message_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.whatsapp_messages m
    join public.whatsapp_conversations c on c.id = m.conversation_id
    join public.projects p on p.id = p_project_id
    join public.leads l on l.id = p.lead_id
    where m.id = p_message_id
      and m.direction = 'inbound'
      and (c.lead_id = p.lead_id or c.contact_id = l.contact_id)
  );
$$;

create or replace function private.project_execution_has_blocking_snags(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_execution_snags s
    where s.project_id = p_project_id
      and s.status in ('open', 'in_progress')
  );
$$;

create or replace function private.project_execution_allows_snag_mutation(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_execution_workflows w
    where w.project_id = p_project_id
      and w.state not in ('completed', 'cancelled')
  );
$$;

create or replace function private.project_execution_require_active_actor()
returns uuid
language plpgsql
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
  if not exists (select 1 from public.profiles where id = v_actor and status = 'active') then
    raise exception 'INACTIVE_STAFF' using errcode = '42501';
  end if;
  return v_actor;
end;
$$;

create or replace function private.project_execution_assert_evidence_args(
  p_source_type text,
  p_source_reference text,
  p_note text,
  p_storage_object_path text,
  p_file_sha256 text,
  p_file_size_bytes bigint,
  p_mime_type text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ref text;
  v_note text;
begin
  v_ref := nullif(trim(coalesce(p_source_reference, '')), '');
  if v_ref is null or length(v_ref) > 500 then
    raise exception 'PROJECT_MISSING_EVIDENCE';
  end if;
  if p_source_type not in ('uploaded_artifact', 'whatsapp_message', 'offline_note') then
    raise exception 'PROJECT_MISSING_EVIDENCE';
  end if;
  v_note := nullif(trim(coalesce(p_note, '')), '');
  if v_note is not null and length(v_note) > 2000 then
    raise exception 'PROJECT_MISSING_EVIDENCE';
  end if;
  if p_source_type = 'uploaded_artifact' then
    if p_storage_object_path is null or length(trim(p_storage_object_path)) not between 1 and 500 then
      raise exception 'PROJECT_MISSING_EVIDENCE';
    end if;
    if trim(p_source_reference) <> trim(p_storage_object_path) then
      raise exception 'PROJECT_MISSING_EVIDENCE';
    end if;
    if position('..' in p_storage_object_path) > 0 then
      raise exception 'PROJECT_MISSING_EVIDENCE';
    end if;
    if coalesce(p_file_sha256, '') !~ '^[0-9a-f]{64}$' then
      raise exception 'PROJECT_MISSING_EVIDENCE';
    end if;
    if p_file_size_bytes is null or p_file_size_bytes <= 0 or p_file_size_bytes > 20971520 then
      raise exception 'PROJECT_MISSING_EVIDENCE';
    end if;
    if trim(coalesce(p_mime_type, '')) not in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp') then
      raise exception 'PROJECT_MISSING_EVIDENCE';
    end if;
  elsif p_source_type = 'whatsapp_message' then
    if p_storage_object_path is not null or p_file_sha256 is not null or p_file_size_bytes is not null or p_mime_type is not null then
      raise exception 'PROJECT_MISSING_EVIDENCE';
    end if;
  else
    if v_note is null or length(v_note) < 8 then
      raise exception 'PROJECT_MISSING_EVIDENCE';
    end if;
    if p_storage_object_path is not null or p_file_sha256 is not null or p_file_size_bytes is not null or p_mime_type is not null then
      raise exception 'PROJECT_MISSING_EVIDENCE';
    end if;
  end if;
end;
$$;

create or replace function private.project_execution_insert_evidence(
  p_project_id uuid,
  p_actor uuid,
  p_evidence_type text,
  p_target_state text,
  p_snag_id uuid,
  p_source_type text,
  p_source_reference text,
  p_note text,
  p_storage_object_path text,
  p_file_sha256 text,
  p_file_size_bytes bigint,
  p_mime_type text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_message_id uuid;
begin
  perform private.project_execution_assert_evidence_args(
    p_source_type, p_source_reference, p_note, p_storage_object_path, p_file_sha256, p_file_size_bytes, p_mime_type
  );
  if p_source_type = 'uploaded_artifact' then
    if trim(p_storage_object_path) not like ('projects/' || p_project_id::text || '/execution/evidence/%') then
      raise exception 'PROJECT_MISSING_EVIDENCE';
    end if;
    if not private.project_execution_uploaded_evidence_object_exists(p_project_id, p_storage_object_path) then
      raise exception 'PROJECT_MISSING_EVIDENCE';
    end if;
  elsif p_source_type = 'whatsapp_message' then
    begin
      v_message_id := trim(p_source_reference)::uuid;
    exception when others then
      raise exception 'PROJECT_MISSING_EVIDENCE';
    end;
    if not private.project_execution_whatsapp_belongs_to_project(p_project_id, v_message_id) then
      raise exception 'PROJECT_MISSING_EVIDENCE';
    end if;
  end if;

  insert into public.project_execution_evidence (
    project_id, evidence_type, target_state, snag_id, source_type, source_reference,
    storage_object_path, file_sha256, file_size_bytes, mime_type, captured_by, note
  ) values (
    p_project_id,
    p_evidence_type,
    p_target_state,
    p_snag_id,
    p_source_type,
    trim(p_source_reference),
    case when p_source_type = 'uploaded_artifact' then trim(p_storage_object_path) else null end,
    case when p_source_type = 'uploaded_artifact' then p_file_sha256 else null end,
    case when p_source_type = 'uploaded_artifact' then p_file_size_bytes else null end,
    case when p_source_type = 'uploaded_artifact' then p_mime_type else null end,
    p_actor,
    nullif(trim(coalesce(p_note, '')), '')
  )
  returning id into v_id;
  return v_id;
end;
$$;

create or replace function private.prevent_project_execution_workflow_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'PROJECT_EXECUTION_WORKFLOW_APPEND_ONLY';
  end if;
  if NEW.project_id is distinct from OLD.project_id
     or NEW.created_at is distinct from OLD.created_at then
    raise exception 'PROJECT_EXECUTION_WORKFLOW_IDENTITY_IMMUTABLE';
  end if;
  return NEW;
end;
$$;

create or replace function private.prevent_project_execution_snag_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'PROJECT_SNAG_APPEND_ONLY';
  end if;
  if NEW.id is distinct from OLD.id
     or NEW.project_id is distinct from OLD.project_id
     or NEW.title is distinct from OLD.title
     or NEW.description is distinct from OLD.description
     or NEW.created_by is distinct from OLD.created_by
     or NEW.created_at is distinct from OLD.created_at then
    raise exception 'PROJECT_SNAG_IDENTITY_IMMUTABLE';
  end if;
  if OLD.status = 'resolved' and NEW is distinct from OLD then
    raise exception 'PROJECT_SNAG_IMMUTABLE';
  end if;
  return NEW;
end;
$$;

create trigger trg_project_execution_workflows_guard
  before update or delete on public.project_execution_workflows
  for each row execute function private.prevent_project_execution_workflow_mutation();

create trigger trg_project_execution_snags_guard
  before update or delete on public.project_execution_snags
  for each row execute function private.prevent_project_execution_snag_mutation();

create trigger trg_project_execution_evidence_append_only
  before update or delete on public.project_execution_evidence
  for each row execute function private.forbid_append_only_mutation();

create or replace function private.materialize_project_execution_impl(
  p_project_id uuid,
  p_actor_kind text,
  p_actor_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_project public.projects%rowtype;
  v_design public.project_design_workflows%rowtype;
  v_existing public.project_execution_workflows%rowtype;
  v_idempotency private.project_idempotency_requests%rowtype;
  v_request_hash text;
  v_now timestamptz := now();
  v_response jsonb;
  v_created boolean := false;
begin
  if p_project_id is null then
    raise exception 'INVALID_INPUT';
  end if;
  if p_actor_kind not in ('system', 'staff') then
    raise exception 'INVALID_INPUT';
  end if;
  if p_actor_kind = 'system' and p_actor_id is not null then
    raise exception 'INVALID_INPUT';
  end if;
  if p_actor_kind = 'staff' and p_actor_id is null then
    raise exception 'INVALID_INPUT';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  v_request_hash := private.project_sha256(
    'materialize_execution|' || p_project_id::text || '|' || p_actor_kind || '|' || coalesce(p_actor_id::text, '')
  );
  perform private.project_idempotency_xact_lock(p_actor_kind, p_actor_id, 'materialize_execution', p_idempotency_key);

  select * into v_idempotency
  from private.project_idempotency_requests
  where operation_code = 'materialize_execution'
    and idempotency_key = trim(p_idempotency_key)
    and actor_kind = p_actor_kind
    and (
      (p_actor_kind = 'system' and actor_id is null)
      or (p_actor_kind = 'staff' and actor_id = p_actor_id)
    );

  if v_idempotency.id is not null then
    if v_idempotency.request_hash <> v_request_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return v_idempotency.response_snapshot;
  end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if v_project.id is null then
    raise exception 'PROJECT_NOT_FOUND';
  end if;
  select * into v_design from public.project_design_workflows where project_id = p_project_id for update;
  if v_design.project_id is null then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;
  if v_project.status <> 'handover_accepted' or v_design.state <> 'design_completed' then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;

  select * into v_existing from public.project_execution_workflows where project_id = p_project_id for update;
  if v_existing.project_id is null then
    insert into public.project_execution_workflows (project_id, state, created_at, updated_at)
    values (p_project_id, 'production', v_now, v_now);
    insert into public.project_events (project_id, lead_id, event_type, actor_kind, actor_id, details)
    values (
      p_project_id, v_project.lead_id, 'project.execution_initialized', p_actor_kind, p_actor_id,
      jsonb_build_object('state', 'production')
    );
    v_created := true;
    v_existing.project_id := p_project_id;
    v_existing.state := 'production';
    v_existing.updated_at := v_now;
  end if;

  v_response := jsonb_build_object(
    'success', true,
    'project_id', p_project_id,
    'state', v_existing.state,
    'created', v_created,
    'unchanged', not v_created,
    'idempotent_replay', false
  );
  insert into private.project_idempotency_requests (
    actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
  ) values (
    p_actor_kind, p_actor_id, 'materialize_execution', trim(p_idempotency_key), v_request_hash, p_project_id, v_response
  );
  return v_response;
end;
$$;

create or replace function private.trg_after_design_completed_materialize_execution()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if TG_OP = 'UPDATE'
     and NEW.state = 'design_completed'
     and OLD.state is distinct from 'design_completed' then
    begin
      perform private.materialize_project_execution_impl(
        NEW.project_id,
        'system',
        null,
        'exec-init-' || NEW.project_id::text
      );
    exception when others then
      begin
        insert into public.project_events (project_id, lead_id, event_type, actor_kind, actor_id, details)
        select NEW.project_id, p.lead_id, 'project.execution_init_failed', 'system', null,
               jsonb_build_object('reason_code', 'EXECUTION_INITIALIZATION_FAILED')
        from public.projects p
        where p.id = NEW.project_id;
      exception when others then
        null;
      end;
    end;
  end if;
  return NEW;
end;
$$;

create trigger trg_after_design_completed_materialize_execution
  after update on public.project_design_workflows
  for each row execute function private.trg_after_design_completed_materialize_execution();

create or replace function public.repair_project_execution_workflow(
  p_project_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
begin
  v_actor := private.project_execution_require_active_actor();
  if not ((select private.has_role('super_admin')) or (select private.has_role('sales_manager'))) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return private.materialize_project_execution_impl(p_project_id, 'staff', v_actor, p_idempotency_key);
end;
$$;

create or replace function public.can_transition_project_execution(p_project_id uuid, p_target_state text)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_state text;
begin
  if v_actor is null or p_project_id is null then
    return false;
  end if;
  if not (select public.authorize('project_execution.transition')) then
    return false;
  end if;
  if not private.project_execution_is_current_pm(p_project_id, v_actor) then
    return false;
  end if;
  if not private.project_execution_entry_eligible(p_project_id) then
    return false;
  end if;
  select w.state into v_state from public.project_execution_workflows w where w.project_id = p_project_id;
  if v_state is null then
    return false;
  end if;
  if p_target_state = 'ready_for_dispatch' and v_state = 'production' then return true; end if;
  if p_target_state = 'delivery' and v_state = 'ready_for_dispatch' then return true; end if;
  if p_target_state = 'installation' and v_state = 'delivery' then return true; end if;
  if p_target_state = 'snag_resolution' and v_state = 'installation' then return true; end if;
  return false;
end;
$$;

create or replace function public.can_resolve_project_execution_snag(p_snag_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_snag public.project_execution_snags%rowtype;
begin
  if v_actor is null or p_snag_id is null then
    return false;
  end if;
  if not (select public.authorize('project_execution.snag')) then
    return false;
  end if;
  select * into v_snag from public.project_execution_snags where id = p_snag_id;
  if v_snag.id is null or v_snag.status = 'resolved' then
    return false;
  end if;
  if not private.project_execution_allows_snag_mutation(v_snag.project_id) then
    return false;
  end if;
  return private.project_execution_is_current_pm(v_snag.project_id, v_actor)
    and private.project_execution_entry_eligible(v_snag.project_id);
end;
$$;

create or replace function public.can_record_project_execution_handover(p_project_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_state text;
begin
  if v_actor is null or p_project_id is null then
    return false;
  end if;
  if not (select public.authorize('project_execution.transition')) then
    return false;
  end if;
  if not private.project_execution_is_current_pm(p_project_id, v_actor) then
    return false;
  end if;
  if not private.project_execution_entry_eligible(p_project_id) then
    return false;
  end if;
  select w.state into v_state from public.project_execution_workflows w where w.project_id = p_project_id;
  if v_state is distinct from 'snag_resolution' then
    return false;
  end if;
  if private.project_execution_has_blocking_snags(p_project_id) then
    return false;
  end if;
  return true;
end;
$$;

create or replace function public.can_complete_project_execution(p_project_id uuid)
returns boolean
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid := auth.uid();
  v_state text;
begin
  if v_actor is null or p_project_id is null then
    return false;
  end if;
  if not (select public.authorize('project_execution.transition')) then
    return false;
  end if;
  if not private.project_execution_is_current_pm(p_project_id, v_actor) then
    return false;
  end if;
  if not private.project_execution_entry_eligible(p_project_id) then
    return false;
  end if;
  select w.state into v_state from public.project_execution_workflows w where w.project_id = p_project_id;
  if v_state is distinct from 'handover' then
    return false;
  end if;
  if private.project_execution_has_blocking_snags(p_project_id) then
    return false;
  end if;
  return true;
end;
$$;

create or replace function public.can_view_project_execution_detail(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.project_execution_can_view_detail(p_project_id);
$$;

create or replace function public.transition_project_execution(
  p_project_id uuid,
  p_target_state text,
  p_idempotency_key text,
  p_source_type text default null,
  p_source_reference text default null,
  p_note text default null,
  p_storage_object_path text default null,
  p_file_sha256 text default null,
  p_file_size_bytes bigint default null,
  p_mime_type text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_project public.projects%rowtype;
  v_workflow public.project_execution_workflows%rowtype;
  v_idempotency private.project_idempotency_requests%rowtype;
  v_request_hash text;
  v_evidence_id uuid;
  v_now timestamptz := now();
  v_response jsonb;
  v_from text;
begin
  v_actor := private.project_execution_require_active_actor();
  if not (select public.authorize('project_execution.transition')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not private.project_execution_is_current_pm(p_project_id, v_actor) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;
  if p_target_state not in ('ready_for_dispatch', 'delivery', 'installation', 'snag_resolution') then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;

  v_request_hash := private.project_sha256(
    'transition_execution|' || p_project_id::text || '|' || p_target_state || '|' ||
    coalesce(p_source_type, '') || '|' || coalesce(p_source_reference, '') || '|' ||
    coalesce(p_storage_object_path, '') || '|' || coalesce(p_file_sha256, '')
  );
  perform private.project_idempotency_xact_lock('staff', v_actor, 'transition_execution', p_idempotency_key);

  select * into v_idempotency
  from private.project_idempotency_requests
  where actor_kind = 'staff' and actor_id = v_actor
    and operation_code = 'transition_execution' and idempotency_key = trim(p_idempotency_key);
  if v_idempotency.id is not null then
    if v_idempotency.request_hash <> v_request_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return v_idempotency.response_snapshot;
  end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if v_project.id is null then raise exception 'PROJECT_NOT_FOUND'; end if;
  if not private.project_execution_entry_eligible(p_project_id) then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;
  select * into v_workflow from public.project_execution_workflows where project_id = p_project_id for update;
  if v_workflow.project_id is null then raise exception 'PROJECT_INVALID_TRANSITION'; end if;
  v_from := v_workflow.state;
  if v_workflow.state = p_target_state then
    v_response := jsonb_build_object('success', true, 'project_id', p_project_id, 'state', p_target_state, 'unchanged', true);
    insert into private.project_idempotency_requests (
      actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
    ) values ('staff', v_actor, 'transition_execution', trim(p_idempotency_key), v_request_hash, p_project_id, v_response);
    return v_response;
  end if;
  if (p_target_state = 'ready_for_dispatch' and v_from <> 'production')
     or (p_target_state = 'delivery' and v_from <> 'ready_for_dispatch')
     or (p_target_state = 'installation' and v_from <> 'delivery')
     or (p_target_state = 'snag_resolution' and v_from <> 'installation') then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;

  if p_target_state in ('ready_for_dispatch', 'delivery', 'installation') then
    v_evidence_id := private.project_execution_insert_evidence(
      p_project_id, v_actor, 'stage_transition', p_target_state, null,
      p_source_type, p_source_reference, p_note, p_storage_object_path, p_file_sha256, p_file_size_bytes, p_mime_type
    );
  end if;

  update public.project_execution_workflows
  set state = p_target_state, updated_at = v_now
  where project_id = p_project_id;

  insert into public.project_events (project_id, lead_id, event_type, actor_kind, actor_id, details)
  values (
    p_project_id, v_project.lead_id, 'project.execution_changed', 'staff', v_actor,
    jsonb_build_object('previous_state', v_from, 'state', p_target_state, 'evidence_id', v_evidence_id)
  );

  v_response := jsonb_build_object(
    'success', true, 'project_id', p_project_id, 'state', p_target_state,
    'evidence_id', v_evidence_id, 'unchanged', false
  );
  insert into private.project_idempotency_requests (
    actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
  ) values ('staff', v_actor, 'transition_execution', trim(p_idempotency_key), v_request_hash, p_project_id, v_response);
  return v_response;
end;
$$;



create or replace function public.hold_project_execution(
  p_project_id uuid,
  p_reason_code text,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_project public.projects%rowtype;
  v_workflow public.project_execution_workflows%rowtype;
  v_idempotency private.project_idempotency_requests%rowtype;
  v_request_hash text;
  v_now timestamptz := now();
  v_response jsonb;
  v_from text;
begin
  v_actor := private.project_execution_require_active_actor();
  if not (select public.authorize('project_execution.hold')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not private.project_execution_is_current_pm(p_project_id, v_actor) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_reason_code not in ('client_decision_pending', 'site_access_blocked', 'material_delay', 'weather', 'internal_capacity', 'other') then
    raise exception 'INVALID_REASON';
  end if;
  if p_reason is null or length(trim(p_reason)) < 10 or length(trim(p_reason)) > 1000 then
    raise exception 'INVALID_REASON';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  v_request_hash := private.project_sha256('hold_execution|' || p_project_id::text || '|' || p_reason_code || '|' || trim(p_reason));
  perform private.project_idempotency_xact_lock('staff', v_actor, 'hold_execution', p_idempotency_key);
  select * into v_idempotency from private.project_idempotency_requests
  where actor_kind = 'staff' and actor_id = v_actor and operation_code = 'hold_execution' and idempotency_key = trim(p_idempotency_key);
  if v_idempotency.id is not null then
    if v_idempotency.request_hash <> v_request_hash then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    return v_idempotency.response_snapshot;
  end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if v_project.id is null then raise exception 'PROJECT_NOT_FOUND'; end if;
  if not private.project_execution_entry_eligible(p_project_id) then raise exception 'PROJECT_INVALID_TRANSITION'; end if;
  select * into v_workflow from public.project_execution_workflows where project_id = p_project_id for update;
  if v_workflow.project_id is null then raise exception 'PROJECT_INVALID_TRANSITION'; end if;
  v_from := v_workflow.state;
  if v_from in ('on_hold', 'completed', 'cancelled') then raise exception 'PROJECT_INVALID_TRANSITION'; end if;
  if v_from not in ('production', 'ready_for_dispatch', 'delivery', 'installation', 'snag_resolution', 'handover') then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;

  update public.project_execution_workflows
  set state = 'on_hold', held_from_state = v_from, hold_reason_code = p_reason_code,
      hold_reason = trim(p_reason), updated_at = v_now
  where project_id = p_project_id;

  insert into public.project_events (project_id, lead_id, event_type, actor_kind, actor_id, details)
  values (p_project_id, v_project.lead_id, 'project.execution_held', 'staff', v_actor,
          jsonb_build_object('held_from_state', v_from, 'reason_code', p_reason_code));

  v_response := jsonb_build_object('success', true, 'project_id', p_project_id, 'state', 'on_hold', 'held_from_state', v_from);
  insert into private.project_idempotency_requests (
    actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
  ) values ('staff', v_actor, 'hold_execution', trim(p_idempotency_key), v_request_hash, p_project_id, v_response);
  return v_response;
end;
$$;

create or replace function public.resume_project_execution(
  p_project_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_project public.projects%rowtype;
  v_workflow public.project_execution_workflows%rowtype;
  v_idempotency private.project_idempotency_requests%rowtype;
  v_request_hash text;
  v_now timestamptz := now();
  v_response jsonb;
  v_resume text;
begin
  v_actor := private.project_execution_require_active_actor();
  if not (select public.authorize('project_execution.hold')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not private.project_execution_is_current_pm(p_project_id, v_actor) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  v_request_hash := private.project_sha256('resume_execution|' || p_project_id::text);
  perform private.project_idempotency_xact_lock('staff', v_actor, 'resume_execution', p_idempotency_key);
  select * into v_idempotency from private.project_idempotency_requests
  where actor_kind = 'staff' and actor_id = v_actor and operation_code = 'resume_execution' and idempotency_key = trim(p_idempotency_key);
  if v_idempotency.id is not null then
    if v_idempotency.request_hash <> v_request_hash then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    return v_idempotency.response_snapshot;
  end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if v_project.id is null then raise exception 'PROJECT_NOT_FOUND'; end if;
  if not private.project_execution_entry_eligible(p_project_id) then raise exception 'PROJECT_INVALID_TRANSITION'; end if;
  select * into v_workflow from public.project_execution_workflows where project_id = p_project_id for update;
  if v_workflow.project_id is null or v_workflow.state <> 'on_hold' or v_workflow.held_from_state is null then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;
  v_resume := v_workflow.held_from_state;

  update public.project_execution_workflows
  set state = v_resume, held_from_state = null, hold_reason_code = null, hold_reason = null, updated_at = v_now
  where project_id = p_project_id;

  insert into public.project_events (project_id, lead_id, event_type, actor_kind, actor_id, details)
  values (p_project_id, v_project.lead_id, 'project.execution_resumed', 'staff', v_actor,
          jsonb_build_object('state', v_resume));

  v_response := jsonb_build_object('success', true, 'project_id', p_project_id, 'state', v_resume);
  insert into private.project_idempotency_requests (
    actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
  ) values ('staff', v_actor, 'resume_execution', trim(p_idempotency_key), v_request_hash, p_project_id, v_response);
  return v_response;
end;
$$;

create or replace function public.cancel_project_execution(
  p_project_id uuid,
  p_reason text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_project public.projects%rowtype;
  v_workflow public.project_execution_workflows%rowtype;
  v_idempotency private.project_idempotency_requests%rowtype;
  v_request_hash text;
  v_now timestamptz := now();
  v_response jsonb;
  v_from text;
begin
  v_actor := private.project_execution_require_active_actor();
  if not (select public.authorize('project_execution.cancel')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not (
    private.project_execution_is_current_pm(p_project_id, v_actor)
    or (select private.has_role('super_admin'))
    or (select private.has_role('sales_manager'))
  ) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_reason is null or length(trim(p_reason)) < 10 then
    raise exception 'INVALID_REASON';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  v_request_hash := private.project_sha256('cancel_execution|' || p_project_id::text || '|' || trim(p_reason));
  perform private.project_idempotency_xact_lock('staff', v_actor, 'cancel_execution', p_idempotency_key);
  select * into v_idempotency from private.project_idempotency_requests
  where actor_kind = 'staff' and actor_id = v_actor and operation_code = 'cancel_execution' and idempotency_key = trim(p_idempotency_key);
  if v_idempotency.id is not null then
    if v_idempotency.request_hash <> v_request_hash then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    return v_idempotency.response_snapshot;
  end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if v_project.id is null then raise exception 'PROJECT_NOT_FOUND'; end if;
  select * into v_workflow from public.project_execution_workflows where project_id = p_project_id for update;
  if v_workflow.project_id is null then raise exception 'PROJECT_INVALID_TRANSITION'; end if;
  v_from := v_workflow.state;
  if v_from = 'completed' then raise exception 'PROJECT_INVALID_TRANSITION'; end if;
  if v_from = 'cancelled' then
    v_response := jsonb_build_object('success', true, 'project_id', p_project_id, 'state', 'cancelled', 'unchanged', true);
    insert into private.project_idempotency_requests (
      actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
    ) values ('staff', v_actor, 'cancel_execution', trim(p_idempotency_key), v_request_hash, p_project_id, v_response);
    return v_response;
  end if;

  update public.project_execution_workflows
  set state = 'cancelled', held_from_state = null, hold_reason_code = null, hold_reason = null,
      cancelled_at = v_now, updated_at = v_now
  where project_id = p_project_id;

  insert into public.project_events (project_id, lead_id, event_type, actor_kind, actor_id, details)
  values (p_project_id, v_project.lead_id, 'project.execution_cancelled', 'staff', v_actor,
          jsonb_build_object('previous_state', v_from, 'reason', left(trim(p_reason), 240)));

  v_response := jsonb_build_object('success', true, 'project_id', p_project_id, 'state', 'cancelled');
  insert into private.project_idempotency_requests (
    actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
  ) values ('staff', v_actor, 'cancel_execution', trim(p_idempotency_key), v_request_hash, p_project_id, v_response);
  return v_response;
end;
$$;
create or replace function public.create_project_execution_snag(
  p_project_id uuid,
  p_title text,
  p_description text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_project public.projects%rowtype;
  v_workflow public.project_execution_workflows%rowtype;
  v_idempotency private.project_idempotency_requests%rowtype;
  v_request_hash text;
  v_id uuid;
  v_response jsonb;
begin
  v_actor := private.project_execution_require_active_actor();
  if not (select public.authorize('project_execution.snag')) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if not private.project_execution_is_current_pm(p_project_id, v_actor) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_title is null or length(trim(p_title)) not between 1 and 160 then raise exception 'INVALID_INPUT'; end if;
  if p_description is null or length(trim(p_description)) not between 8 and 2000 then raise exception 'INVALID_INPUT'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  v_request_hash := private.project_sha256('create_snag|' || p_project_id::text || '|' || trim(p_title) || '|' || trim(p_description));
  perform private.project_idempotency_xact_lock('staff', v_actor, 'create_snag', p_idempotency_key);
  select * into v_idempotency from private.project_idempotency_requests
  where actor_kind = 'staff' and actor_id = v_actor and operation_code = 'create_snag' and idempotency_key = trim(p_idempotency_key);
  if v_idempotency.id is not null then
    if v_idempotency.request_hash <> v_request_hash then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    return v_idempotency.response_snapshot;
  end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if v_project.id is null then raise exception 'PROJECT_NOT_FOUND'; end if;
  if not private.project_execution_entry_eligible(p_project_id) then raise exception 'PROJECT_INVALID_TRANSITION'; end if;
  select * into v_workflow from public.project_execution_workflows where project_id = p_project_id for update;
  if v_workflow.project_id is null or v_workflow.state in ('completed', 'cancelled') then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;

  insert into public.project_execution_snags (project_id, title, description, status, created_by)
  values (p_project_id, trim(p_title), trim(p_description), 'open', v_actor)
  returning id into v_id;

  insert into public.project_events (project_id, lead_id, event_type, actor_kind, actor_id, details)
  values (p_project_id, v_project.lead_id, 'project.snag_created', 'staff', v_actor, jsonb_build_object('snag_id', v_id));

  v_response := jsonb_build_object('success', true, 'snag_id', v_id, 'status', 'open');
  insert into private.project_idempotency_requests (
    actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
  ) values ('staff', v_actor, 'create_snag', trim(p_idempotency_key), v_request_hash, p_project_id, v_response);
  return v_response;
end;
$$;

create or replace function public.start_project_execution_snag(
  p_snag_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_snag public.project_execution_snags%rowtype;
  v_project public.projects%rowtype;
  v_workflow public.project_execution_workflows%rowtype;
  v_idempotency private.project_idempotency_requests%rowtype;
  v_request_hash text;
  v_now timestamptz := now();
  v_response jsonb;
begin
  v_actor := private.project_execution_require_active_actor();
  if not (select public.authorize('project_execution.snag')) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  v_request_hash := private.project_sha256('start_snag|' || p_snag_id::text);
  perform private.project_idempotency_xact_lock('staff', v_actor, 'start_snag', p_idempotency_key);
  select * into v_idempotency from private.project_idempotency_requests
  where actor_kind = 'staff' and actor_id = v_actor and operation_code = 'start_snag' and idempotency_key = trim(p_idempotency_key);
  if v_idempotency.id is not null then
    if v_idempotency.request_hash <> v_request_hash then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    return v_idempotency.response_snapshot;
  end if;

  select * into v_snag from public.project_execution_snags where id = p_snag_id for update;
  if v_snag.id is null then raise exception 'PROJECT_NOT_FOUND'; end if;
  if not private.project_execution_is_current_pm(v_snag.project_id, v_actor) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into v_project from public.projects where id = v_snag.project_id for update;
  if not private.project_execution_entry_eligible(v_snag.project_id) then raise exception 'PROJECT_INVALID_TRANSITION'; end if;
  select * into v_workflow from public.project_execution_workflows where project_id = v_snag.project_id for update;
  if v_workflow.project_id is null or v_workflow.state in ('completed', 'cancelled') then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;
  if v_snag.status = 'in_progress' then
    v_response := jsonb_build_object('success', true, 'snag_id', v_snag.id, 'status', 'in_progress', 'unchanged', true);
    insert into private.project_idempotency_requests (
      actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
    ) values ('staff', v_actor, 'start_snag', trim(p_idempotency_key), v_request_hash, v_snag.project_id, v_response);
    return v_response;
  end if;
  if v_snag.status <> 'open' then raise exception 'PROJECT_INVALID_TRANSITION'; end if;

  update public.project_execution_snags set status = 'in_progress', updated_at = v_now where id = v_snag.id;
  insert into public.project_events (project_id, lead_id, event_type, actor_kind, actor_id, details)
  values (v_snag.project_id, v_project.lead_id, 'project.snag_started', 'staff', v_actor, jsonb_build_object('snag_id', v_snag.id));

  v_response := jsonb_build_object('success', true, 'snag_id', v_snag.id, 'status', 'in_progress');
  insert into private.project_idempotency_requests (
    actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
  ) values ('staff', v_actor, 'start_snag', trim(p_idempotency_key), v_request_hash, v_snag.project_id, v_response);
  return v_response;
end;
$$;

create or replace function public.resolve_project_execution_snag(
  p_snag_id uuid,
  p_idempotency_key text,
  p_source_type text,
  p_source_reference text,
  p_note text default null,
  p_storage_object_path text default null,
  p_file_sha256 text default null,
  p_file_size_bytes bigint default null,
  p_mime_type text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_snag public.project_execution_snags%rowtype;
  v_project public.projects%rowtype;
  v_workflow public.project_execution_workflows%rowtype;
  v_idempotency private.project_idempotency_requests%rowtype;
  v_request_hash text;
  v_evidence_id uuid;
  v_now timestamptz := now();
  v_response jsonb;
begin
  v_actor := private.project_execution_require_active_actor();
  if not (select public.authorize('project_execution.snag')) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  v_request_hash := private.project_sha256(
    'resolve_snag|' || p_snag_id::text || '|' || coalesce(p_source_type, '') || '|' || coalesce(p_source_reference, '')
  );
  perform private.project_idempotency_xact_lock('staff', v_actor, 'resolve_snag', p_idempotency_key);
  select * into v_idempotency from private.project_idempotency_requests
  where actor_kind = 'staff' and actor_id = v_actor and operation_code = 'resolve_snag' and idempotency_key = trim(p_idempotency_key);
  if v_idempotency.id is not null then
    if v_idempotency.request_hash <> v_request_hash then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    return v_idempotency.response_snapshot;
  end if;

  select * into v_snag from public.project_execution_snags where id = p_snag_id for update;
  if v_snag.id is null then raise exception 'PROJECT_NOT_FOUND'; end if;
  if not private.project_execution_is_current_pm(v_snag.project_id, v_actor) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  select * into v_project from public.projects where id = v_snag.project_id for update;
  if not private.project_execution_entry_eligible(v_snag.project_id) then raise exception 'PROJECT_INVALID_TRANSITION'; end if;
  select * into v_workflow from public.project_execution_workflows where project_id = v_snag.project_id for update;
  if v_workflow.project_id is null or v_workflow.state in ('completed', 'cancelled') then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;
  if v_snag.status = 'resolved' then
    v_response := jsonb_build_object('success', true, 'snag_id', v_snag.id, 'status', 'resolved', 'unchanged', true);
    insert into private.project_idempotency_requests (
      actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
    ) values ('staff', v_actor, 'resolve_snag', trim(p_idempotency_key), v_request_hash, v_snag.project_id, v_response);
    return v_response;
  end if;
  if v_snag.status not in ('open', 'in_progress') then raise exception 'PROJECT_INVALID_TRANSITION'; end if;

  v_evidence_id := private.project_execution_insert_evidence(
    v_snag.project_id, v_actor, 'snag_resolution', null, v_snag.id,
    p_source_type, p_source_reference, p_note, p_storage_object_path, p_file_sha256, p_file_size_bytes, p_mime_type
  );

  update public.project_execution_snags
  set status = 'resolved', resolved_by = v_actor, resolved_at = v_now, updated_at = v_now
  where id = v_snag.id;

  insert into public.project_events (project_id, lead_id, event_type, actor_kind, actor_id, details)
  values (v_snag.project_id, v_project.lead_id, 'project.snag_resolved', 'staff', v_actor,
          jsonb_build_object('snag_id', v_snag.id, 'evidence_id', v_evidence_id));

  v_response := jsonb_build_object('success', true, 'snag_id', v_snag.id, 'status', 'resolved', 'evidence_id', v_evidence_id);
  insert into private.project_idempotency_requests (
    actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
  ) values ('staff', v_actor, 'resolve_snag', trim(p_idempotency_key), v_request_hash, v_snag.project_id, v_response);
  return v_response;
end;
$$;
create or replace function public.record_project_execution_handover(
  p_project_id uuid,
  p_idempotency_key text,
  p_source_type text,
  p_source_reference text,
  p_note text default null,
  p_storage_object_path text default null,
  p_file_sha256 text default null,
  p_file_size_bytes bigint default null,
  p_mime_type text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_project public.projects%rowtype;
  v_workflow public.project_execution_workflows%rowtype;
  v_idempotency private.project_idempotency_requests%rowtype;
  v_request_hash text;
  v_evidence_id uuid;
  v_now timestamptz := now();
  v_response jsonb;
begin
  v_actor := private.project_execution_require_active_actor();
  if not (select public.authorize('project_execution.transition')) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if not private.project_execution_is_current_pm(p_project_id, v_actor) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  v_request_hash := private.project_sha256(
    'handover_execution|' || p_project_id::text || '|' || coalesce(p_source_type, '') || '|' || coalesce(p_source_reference, '')
  );
  perform private.project_idempotency_xact_lock('staff', v_actor, 'handover_execution', p_idempotency_key);
  select * into v_idempotency from private.project_idempotency_requests
  where actor_kind = 'staff' and actor_id = v_actor and operation_code = 'handover_execution' and idempotency_key = trim(p_idempotency_key);
  if v_idempotency.id is not null then
    if v_idempotency.request_hash <> v_request_hash then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    return v_idempotency.response_snapshot;
  end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if v_project.id is null then raise exception 'PROJECT_NOT_FOUND'; end if;
  if not private.project_execution_entry_eligible(p_project_id) then raise exception 'PROJECT_INVALID_TRANSITION'; end if;
  select * into v_workflow from public.project_execution_workflows where project_id = p_project_id for update;
  if v_workflow.project_id is null then raise exception 'PROJECT_INVALID_TRANSITION'; end if;
  if v_workflow.state = 'handover' then
    v_response := jsonb_build_object('success', true, 'project_id', p_project_id, 'state', 'handover', 'unchanged', true);
    insert into private.project_idempotency_requests (
      actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
    ) values ('staff', v_actor, 'handover_execution', trim(p_idempotency_key), v_request_hash, p_project_id, v_response);
    return v_response;
  end if;
  if v_workflow.state <> 'snag_resolution' then raise exception 'PROJECT_INVALID_TRANSITION'; end if;
  if private.project_execution_has_blocking_snags(p_project_id) then raise exception 'PROJECT_INVALID_TRANSITION'; end if;

  v_evidence_id := private.project_execution_insert_evidence(
    p_project_id, v_actor, 'handover_acknowledgement', null, null,
    p_source_type, p_source_reference, p_note, p_storage_object_path, p_file_sha256, p_file_size_bytes, p_mime_type
  );

  update public.project_execution_workflows set state = 'handover', updated_at = v_now where project_id = p_project_id;
  insert into public.project_events (project_id, lead_id, event_type, actor_kind, actor_id, details)
  values (p_project_id, v_project.lead_id, 'project.execution_handover', 'staff', v_actor,
          jsonb_build_object('evidence_id', v_evidence_id));

  v_response := jsonb_build_object('success', true, 'project_id', p_project_id, 'state', 'handover', 'evidence_id', v_evidence_id);
  insert into private.project_idempotency_requests (
    actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
  ) values ('staff', v_actor, 'handover_execution', trim(p_idempotency_key), v_request_hash, p_project_id, v_response);
  return v_response;
end;
$$;

create or replace function public.complete_project_execution(
  p_project_id uuid,
  p_idempotency_key text,
  p_source_type text,
  p_source_reference text,
  p_note text default null,
  p_storage_object_path text default null,
  p_file_sha256 text default null,
  p_file_size_bytes bigint default null,
  p_mime_type text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_project public.projects%rowtype;
  v_workflow public.project_execution_workflows%rowtype;
  v_idempotency private.project_idempotency_requests%rowtype;
  v_request_hash text;
  v_evidence_id uuid;
  v_now timestamptz := now();
  v_response jsonb;
begin
  v_actor := private.project_execution_require_active_actor();
  if not (select public.authorize('project_execution.transition')) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if not private.project_execution_is_current_pm(p_project_id, v_actor) then raise exception 'FORBIDDEN' using errcode = '42501'; end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  v_request_hash := private.project_sha256(
    'complete_execution|' || p_project_id::text || '|' || coalesce(p_source_type, '') || '|' || coalesce(p_source_reference, '')
  );
  perform private.project_idempotency_xact_lock('staff', v_actor, 'complete_execution', p_idempotency_key);
  select * into v_idempotency from private.project_idempotency_requests
  where actor_kind = 'staff' and actor_id = v_actor and operation_code = 'complete_execution' and idempotency_key = trim(p_idempotency_key);
  if v_idempotency.id is not null then
    if v_idempotency.request_hash <> v_request_hash then raise exception 'IDEMPOTENCY_KEY_REUSED'; end if;
    return v_idempotency.response_snapshot;
  end if;

  select * into v_project from public.projects where id = p_project_id for update;
  if v_project.id is null then raise exception 'PROJECT_NOT_FOUND'; end if;
  if not private.project_execution_entry_eligible(p_project_id) then raise exception 'PROJECT_INVALID_TRANSITION'; end if;
  select * into v_workflow from public.project_execution_workflows where project_id = p_project_id for update;
  if v_workflow.project_id is null then raise exception 'PROJECT_INVALID_TRANSITION'; end if;
  if v_workflow.state = 'completed' then
    v_response := jsonb_build_object('success', true, 'project_id', p_project_id, 'state', 'completed', 'unchanged', true);
    insert into private.project_idempotency_requests (
      actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
    ) values ('staff', v_actor, 'complete_execution', trim(p_idempotency_key), v_request_hash, p_project_id, v_response);
    return v_response;
  end if;
  if v_workflow.state <> 'handover' then raise exception 'PROJECT_INVALID_TRANSITION'; end if;
  if private.project_execution_has_blocking_snags(p_project_id) then raise exception 'PROJECT_INVALID_TRANSITION'; end if;

  v_evidence_id := private.project_execution_insert_evidence(
    p_project_id, v_actor, 'completion_acknowledgement', null, null,
    p_source_type, p_source_reference, p_note, p_storage_object_path, p_file_sha256, p_file_size_bytes, p_mime_type
  );

  update public.project_execution_workflows
  set state = 'completed', completed_at = v_now, updated_at = v_now
  where project_id = p_project_id;

  insert into public.project_events (project_id, lead_id, event_type, actor_kind, actor_id, details)
  values (p_project_id, v_project.lead_id, 'project.execution_completed', 'staff', v_actor,
          jsonb_build_object('evidence_id', v_evidence_id));

  v_response := jsonb_build_object('success', true, 'project_id', p_project_id, 'state', 'completed', 'evidence_id', v_evidence_id);
  insert into private.project_idempotency_requests (
    actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
  ) values ('staff', v_actor, 'complete_execution', trim(p_idempotency_key), v_request_hash, p_project_id, v_response);
  return v_response;
end;
$$;

create or replace function public.get_project_execution_high_level_status(p_project_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_project public.projects%rowtype;
  v_credited uuid;
  v_workflow public.project_execution_workflows%rowtype;
  v_allowed boolean := false;
  v_init text;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  select * into v_project from public.projects where id = p_project_id;
  if v_project.id is null then
    raise exception 'PROJECT_NOT_FOUND';
  end if;
  select qa.credited_sales_executive_id into v_credited
  from public.quotation_acceptances qa
  where qa.id = v_project.quotation_acceptance_id;

  v_allowed :=
    private.project_execution_can_view_detail(p_project_id)
    or (
      (select private.has_role('designer'))
      and private.project_execution_is_assigned_designer(p_project_id, auth.uid())
    )
    or (
      (select public.authorize('projects.read'))
      and (select private.has_role('sales_executive'))
      and v_credited = auth.uid()
    );
  if not v_allowed then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_workflow from public.project_execution_workflows where project_id = p_project_id;

  if not private.project_execution_entry_eligible(p_project_id) then
    v_init := 'not_eligible';
  elsif v_workflow.project_id is null then
    v_init := 'pending_initialization';
  elsif v_workflow.state = 'cancelled' then
    v_init := 'cancelled';
  elsif v_workflow.state = 'completed' then
    v_init := 'completed';
  elsif v_workflow.state = 'on_hold' then
    v_init := 'on_hold';
  else
    v_init := 'active';
  end if;

  return jsonb_build_object(
    'project_id', v_project.id,
    'project_number', v_project.project_number,
    'execution_state', v_workflow.state,
    'initialization_status', v_init,
    'updated_at', v_workflow.updated_at,
    'is_on_hold', coalesce(v_workflow.state = 'on_hold', false),
    'is_cancelled', coalesce(v_workflow.state = 'cancelled', false),
    'is_completed', coalesce(v_workflow.state = 'completed', false)
  );
end;
$$;
alter table public.project_execution_workflows enable row level security;
alter table public.project_execution_snags enable row level security;
alter table public.project_execution_evidence enable row level security;

create policy project_execution_workflows_staff_read on public.project_execution_workflows
  for select to authenticated
  using (private.project_execution_can_view_detail(project_id));

create policy project_execution_snags_staff_read on public.project_execution_snags
  for select to authenticated
  using (private.project_execution_can_view_detail(project_id));

create policy project_execution_evidence_staff_read on public.project_execution_evidence
  for select to authenticated
  using (private.project_execution_can_view_detail(project_id));

revoke all on table public.project_execution_workflows from public, anon, authenticated;
revoke all on table public.project_execution_snags from public, anon, authenticated;
revoke all on table public.project_execution_evidence from public, anon, authenticated;

grant select on table public.project_execution_workflows to authenticated;
grant select on table public.project_execution_snags to authenticated;
grant select on table public.project_execution_evidence to authenticated;

alter function private.project_execution_entry_eligible(uuid) owner to postgres;
alter function private.project_execution_is_current_pm(uuid, uuid) owner to postgres;
alter function private.project_execution_can_view_detail(uuid) owner to postgres;
alter function private.project_execution_is_assigned_designer(uuid, uuid) owner to postgres;
alter function private.project_execution_uploaded_evidence_object_exists(uuid, text) owner to postgres;
alter function private.project_execution_whatsapp_belongs_to_project(uuid, uuid) owner to postgres;
alter function private.project_execution_has_blocking_snags(uuid) owner to postgres;
alter function private.project_execution_allows_snag_mutation(uuid) owner to postgres;
alter function private.project_execution_require_active_actor() owner to postgres;
alter function private.project_execution_assert_evidence_args(text, text, text, text, text, bigint, text) owner to postgres;
alter function private.project_execution_insert_evidence(uuid, uuid, text, text, uuid, text, text, text, text, text, bigint, text) owner to postgres;
alter function private.prevent_project_execution_workflow_mutation() owner to postgres;
alter function private.prevent_project_execution_snag_mutation() owner to postgres;
alter function private.materialize_project_execution_impl(uuid, text, uuid, text) owner to postgres;
alter function private.trg_after_design_completed_materialize_execution() owner to postgres;
alter function public.repair_project_execution_workflow(uuid, text) owner to postgres;
alter function public.can_transition_project_execution(uuid, text) owner to postgres;
alter function public.can_resolve_project_execution_snag(uuid) owner to postgres;
alter function public.can_record_project_execution_handover(uuid) owner to postgres;
alter function public.can_complete_project_execution(uuid) owner to postgres;
alter function public.can_view_project_execution_detail(uuid) owner to postgres;
alter function public.transition_project_execution(uuid, text, text, text, text, text, text, text, bigint, text) owner to postgres;
alter function public.hold_project_execution(uuid, text, text, text) owner to postgres;
alter function public.resume_project_execution(uuid, text) owner to postgres;
alter function public.cancel_project_execution(uuid, text, text) owner to postgres;
alter function public.create_project_execution_snag(uuid, text, text, text) owner to postgres;
alter function public.start_project_execution_snag(uuid, text) owner to postgres;
alter function public.resolve_project_execution_snag(uuid, text, text, text, text, text, text, bigint, text) owner to postgres;
alter function public.record_project_execution_handover(uuid, text, text, text, text, text, text, bigint, text) owner to postgres;
alter function public.complete_project_execution(uuid, text, text, text, text, text, text, bigint, text) owner to postgres;
alter function public.get_project_execution_high_level_status(uuid) owner to postgres;

revoke all on function private.project_execution_entry_eligible(uuid) from public, anon, authenticated;
revoke all on function private.project_execution_is_current_pm(uuid, uuid) from public, anon, authenticated;
revoke all on function private.project_execution_can_view_detail(uuid) from public, anon, authenticated;
revoke all on function private.project_execution_is_assigned_designer(uuid, uuid) from public, anon, authenticated;
revoke all on function private.project_execution_uploaded_evidence_object_exists(uuid, text) from public, anon, authenticated;
revoke all on function private.project_execution_whatsapp_belongs_to_project(uuid, uuid) from public, anon, authenticated;
revoke all on function private.project_execution_has_blocking_snags(uuid) from public, anon, authenticated;
revoke all on function private.project_execution_allows_snag_mutation(uuid) from public, anon, authenticated;
revoke all on function private.project_execution_require_active_actor() from public, anon, authenticated;
revoke all on function private.project_execution_assert_evidence_args(text, text, text, text, text, bigint, text) from public, anon, authenticated;
revoke all on function private.project_execution_insert_evidence(uuid, uuid, text, text, uuid, text, text, text, text, text, bigint, text) from public, anon, authenticated;
revoke all on function private.prevent_project_execution_workflow_mutation() from public, anon, authenticated;
revoke all on function private.prevent_project_execution_snag_mutation() from public, anon, authenticated;
revoke all on function private.materialize_project_execution_impl(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function private.trg_after_design_completed_materialize_execution() from public, anon, authenticated;

revoke all on function public.repair_project_execution_workflow(uuid, text) from public, anon, authenticated;
revoke all on function public.can_transition_project_execution(uuid, text) from public, anon, authenticated;
revoke all on function public.can_resolve_project_execution_snag(uuid) from public, anon, authenticated;
revoke all on function public.can_record_project_execution_handover(uuid) from public, anon, authenticated;
revoke all on function public.can_complete_project_execution(uuid) from public, anon, authenticated;
revoke all on function public.can_view_project_execution_detail(uuid) from public, anon, authenticated;
revoke all on function public.transition_project_execution(uuid, text, text, text, text, text, text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.hold_project_execution(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.resume_project_execution(uuid, text) from public, anon, authenticated;
revoke all on function public.cancel_project_execution(uuid, text, text) from public, anon, authenticated;
revoke all on function public.create_project_execution_snag(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.start_project_execution_snag(uuid, text) from public, anon, authenticated;
revoke all on function public.resolve_project_execution_snag(uuid, text, text, text, text, text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.record_project_execution_handover(uuid, text, text, text, text, text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.complete_project_execution(uuid, text, text, text, text, text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.get_project_execution_high_level_status(uuid) from public, anon, authenticated;

grant execute on function private.project_execution_can_view_detail(uuid) to authenticated;
grant execute on function public.repair_project_execution_workflow(uuid, text) to authenticated;
grant execute on function public.can_transition_project_execution(uuid, text) to authenticated;
grant execute on function public.can_resolve_project_execution_snag(uuid) to authenticated;
grant execute on function public.can_record_project_execution_handover(uuid) to authenticated;
grant execute on function public.can_complete_project_execution(uuid) to authenticated;
grant execute on function public.can_view_project_execution_detail(uuid) to authenticated;
grant execute on function public.transition_project_execution(uuid, text, text, text, text, text, text, text, bigint, text) to authenticated;
grant execute on function public.hold_project_execution(uuid, text, text, text) to authenticated;
grant execute on function public.resume_project_execution(uuid, text) to authenticated;
grant execute on function public.cancel_project_execution(uuid, text, text) to authenticated;
grant execute on function public.create_project_execution_snag(uuid, text, text, text) to authenticated;
grant execute on function public.start_project_execution_snag(uuid, text) to authenticated;
grant execute on function public.resolve_project_execution_snag(uuid, text, text, text, text, text, text, bigint, text) to authenticated;
grant execute on function public.record_project_execution_handover(uuid, text, text, text, text, text, text, bigint, text) to authenticated;
grant execute on function public.complete_project_execution(uuid, text, text, text, text, text, text, bigint, text) to authenticated;
grant execute on function public.get_project_execution_high_level_status(uuid) to authenticated;
