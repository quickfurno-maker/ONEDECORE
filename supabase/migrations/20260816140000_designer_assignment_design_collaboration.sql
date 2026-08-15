-- ============================================================================
-- M29 Migration: ONEDECORE Phase 8B Designer Assignment & Design Collaboration
-- Architecture: ADR-0025 / DEC-0073 / OD8B-1..OD8B-8
-- Forward-only. Does not rewrite M1-M28. No production seeds. No Phase 8C.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. System permissions (canonical five-role grants only)
-- ----------------------------------------------------------------------------
insert into public.permissions (code, name, description, is_system, is_active) values
  ('project_design.read', 'Read project design', 'Read Phase 8B design workflow, assignments, evidence, and deliverables in role scope', true, true),
  ('project_design.staff', 'Staff project designers', 'Assign or remove Lead and Supporting Designers', true, true),
  ('project_design.collaborate', 'Collaborate on design deliverables', 'Reserve and finalize versioned design deliverables', true, true),
  ('project_design.transition', 'Transition design workflow', 'Advance ordinary design states, production ready, and design completed', true, true),
  ('project_design.client_approval', 'Record client approval', 'Record evidenced client approval on the design workflow', true, true),
  ('project_design.hold', 'Hold or resume design', 'Hold or resume the design workflow with a mandatory reason', true, true)
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
  and p.code = 'project_design.read'
  and r.code in ('super_admin', 'sales_manager', 'project_manager', 'designer')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.is_system = true
  and p.is_system = true
  and p.code = 'project_design.staff'
  and r.code in ('super_admin', 'sales_manager')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.is_system = true
  and p.is_system = true
  and p.code = 'project_design.collaborate'
  and r.code = 'designer'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.is_system = true
  and p.is_system = true
  and p.code = 'project_design.transition'
  and r.code = 'designer'
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.is_system = true
  and p.is_system = true
  and p.code = 'project_design.client_approval'
  and r.code in ('project_manager', 'designer')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.is_system = true
  and p.is_system = true
  and p.code = 'project_design.hold'
  and r.code in ('project_manager', 'designer')
on conflict (role_id, permission_id) do nothing;

-- ----------------------------------------------------------------------------
-- 2. Tables
-- ----------------------------------------------------------------------------
create table public.project_designer_assignments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  designer_id uuid not null references public.profiles (id) on delete restrict,
  assignment_role text not null,
  assigned_by uuid not null references public.profiles (id) on delete restrict,
  assigned_at timestamptz not null default now(),
  ended_by uuid null references public.profiles (id) on delete restrict,
  ended_at timestamptz null,
  reason text null,
  constraint chk_project_designer_assignments_role check (
    assignment_role in ('lead_designer', 'supporting_designer')
  ),
  constraint chk_project_designer_assignments_end_pair check (
    (ended_at is null) = (ended_by is null)
  ),
  constraint chk_project_designer_assignments_reason check (
    reason is null or length(trim(reason)) between 1 and 240
  )
);

comment on table public.project_designer_assignments is
  'Append-only designer assignment history. At most one current Lead Designer; no duplicate current person.';

create unique index uq_project_designer_assignments_current_lead
  on public.project_designer_assignments (project_id)
  where assignment_role = 'lead_designer' and ended_at is null;

create unique index uq_project_designer_assignments_current_person
  on public.project_designer_assignments (project_id, designer_id)
  where ended_at is null;

create index idx_project_designer_assignments_designer
  on public.project_designer_assignments (designer_id, assigned_at desc);

create table public.project_design_workflows (
  project_id uuid primary key references public.projects (id) on delete restrict,
  state text not null,
  held_from_state text null,
  revision_return_state text null,
  started_by uuid not null references public.profiles (id) on delete restrict,
  started_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null,
  constraint chk_project_design_workflows_state check (
    state in (
      'brief_received',
      'measurement_pending',
      'measurement_completed',
      'concept_design',
      'internal_review',
      'client_review',
      'client_approved',
      'production_drawings',
      'production_ready',
      'design_completed',
      'revision_required',
      'design_on_hold'
    )
  ),
  constraint chk_project_design_workflows_context check (
    (
      state = 'design_on_hold'
      and held_from_state in (
        'brief_received',
        'measurement_pending',
        'measurement_completed',
        'concept_design',
        'internal_review',
        'client_review',
        'client_approved',
        'production_drawings',
        'production_ready'
      )
      and revision_return_state is null
    )
    or (
      state = 'revision_required'
      and revision_return_state in ('concept_design', 'internal_review')
      and held_from_state is null
    )
    or (
      state not in ('design_on_hold', 'revision_required')
      and held_from_state is null
      and revision_return_state is null
    )
  ),
  constraint chk_project_design_workflows_completed check (
    (state = 'design_completed' and completed_at is not null)
    or (state <> 'design_completed' and completed_at is null)
  )
);

comment on table public.project_design_workflows is
  '1:1 Phase 8B design workflow. Created on first Lead Designer assignment after handover_accepted.';

create table public.project_design_evidence (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  evidence_type text not null,
  source_type text not null,
  source_reference text not null,
  storage_object_path text null,
  file_sha256 text null,
  file_size_bytes bigint null,
  mime_type text null,
  captured_by uuid not null references public.profiles (id) on delete restrict,
  captured_at timestamptz not null default now(),
  note text null,
  constraint chk_project_design_evidence_type check (
    evidence_type in ('client_approval', 'production_ready')
  ),
  constraint chk_project_design_evidence_source_type check (
    source_type in ('uploaded_artifact', 'whatsapp_message', 'offline_note')
  ),
  constraint chk_project_design_evidence_source_reference check (
    length(trim(source_reference)) between 1 and 500
  ),
  constraint chk_project_design_evidence_note check (
    note is null or length(note) <= 2000
  ),
  constraint chk_project_design_evidence_payload check (
    (
      source_type = 'uploaded_artifact'
      and storage_object_path is not null
      and length(trim(storage_object_path)) between 1 and 500
      and trim(source_reference) = trim(storage_object_path)
      and position('..' in storage_object_path) = 0
      and storage_object_path like ('projects/' || project_id::text || '/evidence/%')
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

comment on table public.project_design_evidence is
  'Immutable Phase 8B client-approval and production-ready evidence.';

create index idx_project_design_evidence_project
  on public.project_design_evidence (project_id, captured_at desc);

create table public.project_design_deliverable_versions (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  deliverable_key text not null,
  kind text not null,
  version_number integer not null,
  label text not null,
  bucket_id text not null default 'project-design-documents',
  object_path text not null,
  upload_status text not null,
  file_name text not null,
  mime_type text not null,
  file_size_bytes bigint not null,
  file_sha256 text not null,
  uploaded_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  ready_at timestamptz null,
  supersedes_version_id uuid null references public.project_design_deliverable_versions (id) on delete restrict,
  constraint chk_project_design_deliverable_key check (
    deliverable_key ~ '^[a-z0-9][a-z0-9_-]{0,62}$'
  ),
  constraint chk_project_design_deliverable_kind check (
    kind in (
      'concept_board',
      'measurement_sheet',
      'client_presentation',
      'production_drawing',
      'approval_pack'
    )
  ),
  constraint chk_project_design_deliverable_version check (version_number >= 1),
  constraint chk_project_design_deliverable_label check (length(trim(label)) between 1 and 120),
  constraint chk_project_design_deliverable_bucket check (bucket_id = 'project-design-documents'),
  constraint uq_project_design_deliverable_object_path unique (object_path),
  constraint chk_project_design_deliverable_status check (upload_status in ('pending', 'ready')),
  constraint chk_project_design_deliverable_file_name check (length(trim(file_name)) between 1 and 240),
  constraint chk_project_design_deliverable_size check (
    file_size_bytes > 0 and file_size_bytes <= 20971520
  ),
  constraint chk_project_design_deliverable_sha256 check (file_sha256 ~ '^[0-9a-f]{64}$'),
  constraint chk_project_design_deliverable_ready_pair check (
    (upload_status = 'ready' and ready_at is not null)
    or (upload_status = 'pending' and ready_at is null)
  ),
  constraint uq_project_design_deliverable_version unique (project_id, deliverable_key, version_number)
);

comment on table public.project_design_deliverable_versions is
  'Append-only versioned design deliverables. Pending may become ready; ready rows are immutable.';

create index idx_project_design_deliverable_project
  on public.project_design_deliverable_versions (project_id, deliverable_key, version_number desc);

insert into storage.buckets (id, name, public)
values ('project-design-documents', 'project-design-documents', false)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 3. Private helpers
-- ----------------------------------------------------------------------------
create or replace function private.project_is_assignable_designer(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.profiles pr
    join public.user_roles ur on ur.user_id = pr.id
    join public.roles r on r.id = ur.role_id
    where pr.id = p_user_id
      and pr.status = 'active'
      and r.is_active = true
      and r.code = 'designer'
  );
$$;

create or replace function private.project_design_assignment_role(p_project_id uuid, p_user_id uuid)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select a.assignment_role
  from public.project_designer_assignments a
  where a.project_id = p_project_id
    and a.designer_id = p_user_id
    and a.ended_at is null
  limit 1;
$$;

create or replace function private.project_design_is_current_lead(p_project_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_designer_assignments a
    where a.project_id = p_project_id
      and a.designer_id = p_user_id
      and a.assignment_role = 'lead_designer'
      and a.ended_at is null
  );
$$;

create or replace function private.project_design_is_current_assigned_designer(p_project_id uuid, p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_designer_assignments a
    where a.project_id = p_project_id
      and a.designer_id = p_user_id
      and a.ended_at is null
  );
$$;

create or replace function private.project_design_can_view(p_project_id uuid)
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
      and (select public.authorize('project_design.read'))
      and (
        (select private.has_role('super_admin'))
        or (select private.has_role('sales_manager'))
        or (
          (select private.has_role('project_manager'))
          and p.primary_pm_id = auth.uid()
        )
        or private.project_design_is_current_assigned_designer(p_project_id, auth.uid())
      )
  );
$$;

create or replace function private.project_design_current_ready_max(p_project_id uuid, p_deliverable_key text)
returns integer
language sql
stable
security definer
set search_path = ''
as $$
  select max(v.version_number)::integer
  from public.project_design_deliverable_versions v
  where v.project_id = p_project_id
    and v.deliverable_key = p_deliverable_key
    and v.upload_status = 'ready';
$$;

create or replace function private.project_design_has_ready_kind(p_project_id uuid, p_kind text)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.project_design_deliverable_versions v
    where v.project_id = p_project_id
      and v.kind = p_kind
      and v.upload_status = 'ready'
  );
$$;

create or replace function private.project_can_view(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    join public.quotation_acceptances qa on qa.id = p.quotation_acceptance_id
    where p.id = p_project_id
      and (
        (
          (select public.authorize('projects.read'))
          and (
            (select private.has_role('super_admin'))
            or (select private.has_role('sales_manager'))
            or (
              (select private.has_role('sales_executive'))
              and qa.credited_sales_executive_id = auth.uid()
            )
            or (
              (select private.has_role('project_manager'))
              and p.primary_pm_id = auth.uid()
            )
          )
        )
        or (
          (select public.authorize('project_design.read'))
          and (select private.has_role('designer'))
          and private.project_design_is_current_assigned_designer(p_project_id, auth.uid())
        )
      )
  );
$$;

create or replace function private.project_can_view_handover_baseline(p_project_id uuid)
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
      and (
        (
          (select public.authorize('projects.read'))
          and (
            (select private.has_role('super_admin'))
            or (select private.has_role('sales_manager'))
            or (
              (select private.has_role('project_manager'))
              and p.primary_pm_id = auth.uid()
            )
          )
        )
        or (
          (select public.authorize('project_design.read'))
          and (select private.has_role('designer'))
          and private.project_design_is_current_assigned_designer(p_project_id, auth.uid())
          and p.status = 'handover_accepted'
        )
      )
  );
$$;

create or replace function private.project_design_require_active_actor()
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

create or replace function private.project_design_assert_evidence_args(
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
    if position('..' in trim(p_storage_object_path)) > 0
       or trim(p_storage_object_path) !~ '^projects/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/evidence/' then
      raise exception 'PROJECT_MISSING_EVIDENCE';
    end if;
    if p_file_sha256 is null or p_file_sha256 !~ '^[0-9a-f]{64}$' then
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

create or replace function private.project_design_uploaded_evidence_object_exists(
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
      and o.bucket_id = 'project-design-documents'
      and o.name = trim(p_object_path)
      and position('..' in trim(p_object_path)) = 0
      and trim(p_object_path) like ('projects/' || p_project_id::text || '/evidence/%')
  );
$$;

create or replace function private.project_design_whatsapp_belongs_to_project(p_project_id uuid, p_message_id uuid)
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

create or replace function private.prevent_project_designer_assignment_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'PROJECT_ASSIGNMENT_APPEND_ONLY';
  end if;
  if NEW.project_id is distinct from OLD.project_id
     or NEW.designer_id is distinct from OLD.designer_id
     or NEW.assignment_role is distinct from OLD.assignment_role
     or NEW.assigned_by is distinct from OLD.assigned_by
     or NEW.assigned_at is distinct from OLD.assigned_at then
    raise exception 'PROJECT_ASSIGNMENT_IDENTITY_IMMUTABLE';
  end if;
  if OLD.ended_at is not null
     and (
       NEW.ended_at is distinct from OLD.ended_at
       or NEW.ended_by is distinct from OLD.ended_by
       or NEW.reason is distinct from OLD.reason
     ) then
    raise exception 'PROJECT_ASSIGNMENT_ALREADY_CLOSED';
  end if;
  return NEW;
end;
$$;

create or replace function private.prevent_project_design_workflow_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'PROJECT_DESIGN_WORKFLOW_APPEND_ONLY';
  end if;
  if NEW.project_id is distinct from OLD.project_id
     or NEW.started_by is distinct from OLD.started_by
     or NEW.started_at is distinct from OLD.started_at then
    raise exception 'PROJECT_DESIGN_WORKFLOW_IDENTITY_IMMUTABLE';
  end if;
  return NEW;
end;
$$;

create or replace function private.prevent_project_design_deliverable_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if TG_OP = 'DELETE' then
    raise exception 'PROJECT_DELIVERABLE_APPEND_ONLY';
  end if;
  if OLD.upload_status = 'ready' then
    if NEW is distinct from OLD then
      raise exception 'PROJECT_DELIVERABLE_IMMUTABLE';
    end if;
    return NEW;
  end if;
  if NEW.upload_status = 'pending' then
    if NEW is distinct from OLD then
      raise exception 'PROJECT_DELIVERABLE_IDENTITY_IMMUTABLE';
    end if;
    return NEW;
  end if;
  if NEW.upload_status <> 'ready' or NEW.ready_at is null then
    raise exception 'PROJECT_DELIVERABLE_INVALID_STATUS';
  end if;
  if NEW.project_id is distinct from OLD.project_id
     or NEW.deliverable_key is distinct from OLD.deliverable_key
     or NEW.kind is distinct from OLD.kind
     or NEW.version_number is distinct from OLD.version_number
     or NEW.label is distinct from OLD.label
     or NEW.bucket_id is distinct from OLD.bucket_id
     or NEW.object_path is distinct from OLD.object_path
     or NEW.file_name is distinct from OLD.file_name
     or NEW.mime_type is distinct from OLD.mime_type
     or NEW.file_size_bytes is distinct from OLD.file_size_bytes
     or NEW.file_sha256 is distinct from OLD.file_sha256
     or NEW.uploaded_by is distinct from OLD.uploaded_by
     or NEW.created_at is distinct from OLD.created_at
     or NEW.supersedes_version_id is distinct from OLD.supersedes_version_id then
    raise exception 'PROJECT_DELIVERABLE_IDENTITY_IMMUTABLE';
  end if;
  return NEW;
end;
$$;

create trigger trg_project_designer_assignments_guard
  before update or delete on public.project_designer_assignments
  for each row execute function private.prevent_project_designer_assignment_mutation();

create trigger trg_project_design_evidence_append_only
  before update or delete on public.project_design_evidence
  for each row execute function private.forbid_append_only_mutation();

create trigger trg_project_design_workflows_guard
  before update or delete on public.project_design_workflows
  for each row execute function private.prevent_project_design_workflow_mutation();

create trigger trg_project_design_deliverable_versions_guard
  before update or delete on public.project_design_deliverable_versions
  for each row execute function private.prevent_project_design_deliverable_mutation();

-- ----------------------------------------------------------------------------
-- 4. Public RPCs
-- ----------------------------------------------------------------------------
create or replace function public.list_assignable_designers()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if not ((select private.has_role('super_admin')) or (select private.has_role('sales_manager'))) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id', pr.id,
      'display_name', pr.display_name
    ) order by pr.display_name)
    from public.profiles pr
    join public.user_roles ur on ur.user_id = pr.id
    join public.roles r on r.id = ur.role_id
    where pr.status = 'active'
      and r.is_active = true
      and r.code = 'designer'
  ), '[]'::jsonb);
end;
$$;

create or replace function public.set_project_lead_designer(
  p_project_id uuid,
  p_designer_id uuid,
  p_idempotency_key text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_project public.projects%rowtype;
  v_current_lead public.project_designer_assignments%rowtype;
  v_current_person public.project_designer_assignments%rowtype;
  v_idempotency private.project_idempotency_requests%rowtype;
  v_request_hash text;
  v_reason text;
  v_had_any_lead boolean;
  v_response jsonb;
begin
  v_actor := private.project_design_require_active_actor();
  if not (select public.authorize('project_design.staff')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not ((select private.has_role('super_admin')) or (select private.has_role('sales_manager'))) then
    raise exception 'FORBIDDEN: Only Super Admin or Sales Manager may staff designers.' using errcode = '42501';
  end if;
  if p_project_id is null or p_designer_id is null then
    raise exception 'INVALID_INPUT';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;
  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if v_reason is not null and length(v_reason) > 240 then
    raise exception 'INVALID_REASON';
  end if;
  if not private.project_is_assignable_designer(p_designer_id) then
    raise exception 'INELIGIBLE_DESIGNER';
  end if;

  v_request_hash := private.project_sha256(
    'assign_designer|' || p_project_id::text || '|' || p_designer_id::text || '|' || coalesce(v_reason, '')
  );
  perform private.project_idempotency_xact_lock('staff', v_actor, 'assign_designer', p_idempotency_key);

  select * into v_idempotency
  from private.project_idempotency_requests
  where actor_kind = 'staff'
    and actor_id = v_actor
    and operation_code = 'assign_designer'
    and idempotency_key = trim(p_idempotency_key);

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
  if v_project.status <> 'handover_accepted' then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;

  select * into v_current_lead
  from public.project_designer_assignments
  where project_id = p_project_id
    and assignment_role = 'lead_designer'
    and ended_at is null
  for update;

  if v_current_lead.designer_id is not distinct from p_designer_id then
    v_response := jsonb_build_object(
      'success', true,
      'project_id', v_project.id,
      'designer_id', p_designer_id,
      'assignment_role', 'lead_designer',
      'unchanged', true,
      'idempotent_replay', false
    );
    insert into private.project_idempotency_requests (
      actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
    ) values (
      'staff', v_actor, 'assign_designer', trim(p_idempotency_key), v_request_hash, v_project.id, v_response
    );
    return v_response;
  end if;

  select exists (
    select 1 from public.project_designer_assignments
    where project_id = p_project_id and assignment_role = 'lead_designer'
  ) into v_had_any_lead;

  select * into v_current_person
  from public.project_designer_assignments
  where project_id = p_project_id
    and designer_id = p_designer_id
    and ended_at is null
  for update;

  if v_current_person.id is not null and v_current_person.assignment_role = 'supporting_designer' then
    update public.project_designer_assignments
    set ended_at = now(),
        ended_by = v_actor,
        reason = coalesce(v_reason, 'promoted_to_lead')
    where id = v_current_person.id;
  elsif v_current_person.id is not null then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;

  if v_current_lead.id is not null then
    update public.project_designer_assignments
    set ended_at = now(),
        ended_by = v_actor,
        reason = coalesce(v_reason, 'reassignment')
    where id = v_current_lead.id;
  end if;

  insert into public.project_designer_assignments (
    project_id, designer_id, assignment_role, assigned_by, reason
  ) values (
    p_project_id, p_designer_id, 'lead_designer', v_actor, v_reason
  );

  if not v_had_any_lead then
    insert into public.project_design_workflows (project_id, state, started_by)
    values (p_project_id, 'brief_received', v_actor)
    on conflict (project_id) do nothing;

    insert into public.project_events (project_id, lead_id, event_type, actor_kind, actor_id, details)
    values (
      p_project_id, v_project.lead_id, 'project.designer_assigned', 'staff', v_actor,
      jsonb_build_object(
        'designer_id', p_designer_id,
        'assignment_role', 'lead_designer',
        'previous_designer_id', v_current_lead.designer_id,
        'reason', v_reason
      )
    );
    insert into public.project_events (project_id, lead_id, event_type, actor_kind, actor_id, details)
    values (
      p_project_id, v_project.lead_id, 'project.design_started', 'staff', v_actor,
      jsonb_build_object('state', 'brief_received')
    );
  else
    insert into public.project_events (project_id, lead_id, event_type, actor_kind, actor_id, details)
    values (
      p_project_id, v_project.lead_id, 'project.designer_reassigned', 'staff', v_actor,
      jsonb_build_object(
        'designer_id', p_designer_id,
        'assignment_role', 'lead_designer',
        'previous_designer_id', v_current_lead.designer_id,
        'reason', v_reason
      )
    );
  end if;

  v_response := jsonb_build_object(
    'success', true,
    'project_id', p_project_id,
    'designer_id', p_designer_id,
    'assignment_role', 'lead_designer',
    'unchanged', false,
    'idempotent_replay', false
  );
  insert into private.project_idempotency_requests (
    actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
  ) values (
    'staff', v_actor, 'assign_designer', trim(p_idempotency_key), v_request_hash, p_project_id, v_response
  );
  return v_response;
end;
$$;

create or replace function public.add_project_supporting_designer(
  p_project_id uuid,
  p_designer_id uuid,
  p_idempotency_key text,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_project public.projects%rowtype;
  v_current public.project_designer_assignments%rowtype;
  v_idempotency private.project_idempotency_requests%rowtype;
  v_request_hash text;
  v_reason text;
  v_response jsonb;
begin
  v_actor := private.project_design_require_active_actor();
  if not (select public.authorize('project_design.staff')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not ((select private.has_role('super_admin')) or (select private.has_role('sales_manager'))) then
    raise exception 'FORBIDDEN: Only Super Admin or Sales Manager may staff designers.' using errcode = '42501';
  end if;
  if p_project_id is null or p_designer_id is null then
    raise exception 'INVALID_INPUT';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;
  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if v_reason is not null and length(v_reason) > 240 then
    raise exception 'INVALID_REASON';
  end if;
  if not private.project_is_assignable_designer(p_designer_id) then
    raise exception 'INELIGIBLE_DESIGNER';
  end if;

  v_request_hash := private.project_sha256(
    'add_supporting_designer|' || p_project_id::text || '|' || p_designer_id::text || '|' || coalesce(v_reason, '')
  );
  perform private.project_idempotency_xact_lock('staff', v_actor, 'add_supporting_designer', p_idempotency_key);

  select * into v_idempotency
  from private.project_idempotency_requests
  where actor_kind = 'staff'
    and actor_id = v_actor
    and operation_code = 'add_supporting_designer'
    and idempotency_key = trim(p_idempotency_key);

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
  if v_project.status <> 'handover_accepted' then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;

  select * into v_current
  from public.project_designer_assignments
  where project_id = p_project_id
    and designer_id = p_designer_id
    and ended_at is null
  for update;

  if v_current.assignment_role = 'lead_designer' then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;

  if v_current.assignment_role = 'supporting_designer' then
    v_response := jsonb_build_object(
      'success', true,
      'project_id', p_project_id,
      'designer_id', p_designer_id,
      'assignment_role', 'supporting_designer',
      'unchanged', true,
      'idempotent_replay', false
    );
    insert into private.project_idempotency_requests (
      actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
    ) values (
      'staff', v_actor, 'add_supporting_designer', trim(p_idempotency_key), v_request_hash, p_project_id, v_response
    );
    return v_response;
  end if;

  insert into public.project_designer_assignments (
    project_id, designer_id, assignment_role, assigned_by, reason
  ) values (
    p_project_id, p_designer_id, 'supporting_designer', v_actor, v_reason
  );

  insert into public.project_events (project_id, lead_id, event_type, actor_kind, actor_id, details)
  values (
    p_project_id, v_project.lead_id, 'project.designer_assigned', 'staff', v_actor,
    jsonb_build_object(
      'designer_id', p_designer_id,
      'assignment_role', 'supporting_designer',
      'reason', v_reason
    )
  );

  v_response := jsonb_build_object(
    'success', true,
    'project_id', p_project_id,
    'designer_id', p_designer_id,
    'assignment_role', 'supporting_designer',
    'unchanged', false,
    'idempotent_replay', false
  );
  insert into private.project_idempotency_requests (
    actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
  ) values (
    'staff', v_actor, 'add_supporting_designer', trim(p_idempotency_key), v_request_hash, p_project_id, v_response
  );
  return v_response;
end;
$$;

create or replace function public.remove_project_designer_assignment(
  p_project_id uuid,
  p_designer_id uuid,
  p_idempotency_key text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_project public.projects%rowtype;
  v_current public.project_designer_assignments%rowtype;
  v_idempotency private.project_idempotency_requests%rowtype;
  v_request_hash text;
  v_reason text;
  v_response jsonb;
begin
  v_actor := private.project_design_require_active_actor();
  if not (select public.authorize('project_design.staff')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not ((select private.has_role('super_admin')) or (select private.has_role('sales_manager'))) then
    raise exception 'FORBIDDEN: Only Super Admin or Sales Manager may staff designers.' using errcode = '42501';
  end if;
  if p_project_id is null or p_designer_id is null then
    raise exception 'INVALID_INPUT';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;
  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if v_reason is null or length(v_reason) > 240 then
    raise exception 'INVALID_REASON';
  end if;

  v_request_hash := private.project_sha256(
    'remove_designer|' || p_project_id::text || '|' || p_designer_id::text || '|' || v_reason
  );
  perform private.project_idempotency_xact_lock('staff', v_actor, 'remove_designer', p_idempotency_key);

  select * into v_idempotency
  from private.project_idempotency_requests
  where actor_kind = 'staff'
    and actor_id = v_actor
    and operation_code = 'remove_designer'
    and idempotency_key = trim(p_idempotency_key);

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

  select * into v_current
  from public.project_designer_assignments
  where project_id = p_project_id
    and designer_id = p_designer_id
    and ended_at is null
  for update;

  if v_current.id is null then
    if exists (
      select 1 from public.project_designer_assignments
      where project_id = p_project_id and designer_id = p_designer_id
    ) then
      v_response := jsonb_build_object(
        'success', true,
        'project_id', p_project_id,
        'designer_id', p_designer_id,
        'unchanged', true,
        'idempotent_replay', false
      );
      insert into private.project_idempotency_requests (
        actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
      ) values (
        'staff', v_actor, 'remove_designer', trim(p_idempotency_key), v_request_hash, p_project_id, v_response
      );
      return v_response;
    end if;
    raise exception 'PROJECT_NOT_FOUND';
  end if;

  update public.project_designer_assignments
  set ended_at = now(),
      ended_by = v_actor,
      reason = v_reason
  where id = v_current.id;

  insert into public.project_events (project_id, lead_id, event_type, actor_kind, actor_id, details)
  values (
    p_project_id, v_project.lead_id, 'project.designer_removed', 'staff', v_actor,
    jsonb_build_object(
      'designer_id', p_designer_id,
      'assignment_role', v_current.assignment_role,
      'reason', v_reason
    )
  );

  v_response := jsonb_build_object(
    'success', true,
    'project_id', p_project_id,
    'designer_id', p_designer_id,
    'assignment_role', v_current.assignment_role,
    'unchanged', false,
    'idempotent_replay', false
  );
  insert into private.project_idempotency_requests (
    actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
  ) values (
    'staff', v_actor, 'remove_designer', trim(p_idempotency_key), v_request_hash, p_project_id, v_response
  );
  return v_response;
end;
$$;

create or replace function public.transition_project_design(
  p_project_id uuid,
  p_target_state text,
  p_idempotency_key text,
  p_reason text default null,
  p_revision_return_state text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_project public.projects%rowtype;
  v_workflow public.project_design_workflows%rowtype;
  v_idempotency private.project_idempotency_requests%rowtype;
  v_request_hash text;
  v_reason text;
  v_from text;
  v_expected text;
  v_event_type text;
  v_response jsonb;
begin
  v_actor := private.project_design_require_active_actor();
  if not (select public.authorize('project_design.transition')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not private.project_design_is_current_lead(p_project_id, v_actor) then
    raise exception 'FORBIDDEN: Only the current Lead Designer may transition design.' using errcode = '42501';
  end if;
  if p_project_id is null or p_target_state is null then
    raise exception 'INVALID_INPUT';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;
  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if v_reason is not null and length(v_reason) > 240 then
    raise exception 'INVALID_REASON';
  end if;

  v_request_hash := private.project_sha256(
    'transition_design|' || p_project_id::text || '|' || p_target_state || '|' ||
    coalesce(v_reason, '') || '|' || coalesce(p_revision_return_state, '')
  );
  perform private.project_idempotency_xact_lock('staff', v_actor, 'transition_design', p_idempotency_key);

  select * into v_idempotency
  from private.project_idempotency_requests
  where actor_kind = 'staff'
    and actor_id = v_actor
    and operation_code = 'transition_design'
    and idempotency_key = trim(p_idempotency_key);

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
  if v_project.status <> 'handover_accepted' then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;

  select * into v_workflow
  from public.project_design_workflows
  where project_id = p_project_id
  for update;
  if v_workflow.project_id is null then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;

  v_from := v_workflow.state;
  if v_from = p_target_state then
    v_response := jsonb_build_object(
      'success', true,
      'project_id', p_project_id,
      'state', v_from,
      'unchanged', true,
      'idempotent_replay', false
    );
    insert into private.project_idempotency_requests (
      actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
    ) values (
      'staff', v_actor, 'transition_design', trim(p_idempotency_key), v_request_hash, p_project_id, v_response
    );
    return v_response;
  end if;

  if p_target_state in ('client_approved', 'design_on_hold', 'production_ready', 'design_completed') then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;

  if v_from = 'revision_required' then
    if p_target_state is distinct from v_workflow.revision_return_state then
      raise exception 'PROJECT_INVALID_TRANSITION';
    end if;
    update public.project_design_workflows
    set state = p_target_state,
        revision_return_state = null,
        updated_at = now()
    where project_id = p_project_id;
    v_event_type := 'project.design_changed';
  elsif p_target_state = 'revision_required' then
    if v_from not in ('internal_review', 'client_review') then
      raise exception 'PROJECT_INVALID_TRANSITION';
    end if;
    if v_reason is null or length(v_reason) < 8 then
      raise exception 'INVALID_REASON';
    end if;
    if coalesce(p_revision_return_state, '') not in ('concept_design', 'internal_review') then
      raise exception 'PROJECT_INVALID_TRANSITION';
    end if;
    update public.project_design_workflows
    set state = 'revision_required',
        revision_return_state = p_revision_return_state,
        updated_at = now()
    where project_id = p_project_id;
    v_event_type := 'project.design_revision';
  else
    v_expected := case v_from
      when 'brief_received' then 'measurement_pending'
      when 'measurement_pending' then 'measurement_completed'
      when 'measurement_completed' then 'concept_design'
      when 'concept_design' then 'internal_review'
      when 'internal_review' then 'client_review'
      when 'client_approved' then 'production_drawings'
      else null
    end;
    if v_expected is null or p_target_state is distinct from v_expected then
      raise exception 'PROJECT_INVALID_TRANSITION';
    end if;
    if p_target_state = 'measurement_completed'
       and not private.project_design_has_ready_kind(p_project_id, 'measurement_sheet') then
      raise exception 'PROJECT_MISSING_EVIDENCE';
    end if;
    if p_revision_return_state is not null then
      raise exception 'PROJECT_INVALID_TRANSITION';
    end if;
    update public.project_design_workflows
    set state = p_target_state,
        updated_at = now()
    where project_id = p_project_id;
    v_event_type := 'project.design_changed';
  end if;

  insert into public.project_events (project_id, lead_id, event_type, actor_kind, actor_id, details)
  values (
    p_project_id, v_project.lead_id, v_event_type, 'staff', v_actor,
    jsonb_build_object(
      'previous_state', v_from,
      'state', p_target_state,
      'revision_return_state', p_revision_return_state,
      'reason', v_reason
    )
  );

  v_response := jsonb_build_object(
    'success', true,
    'project_id', p_project_id,
    'previous_state', v_from,
    'state', p_target_state,
    'unchanged', false,
    'idempotent_replay', false
  );
  insert into private.project_idempotency_requests (
    actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
  ) values (
    'staff', v_actor, 'transition_design', trim(p_idempotency_key), v_request_hash, p_project_id, v_response
  );
  return v_response;
end;
$$;

create or replace function public.record_project_client_approval(
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
  v_workflow public.project_design_workflows%rowtype;
  v_idempotency private.project_idempotency_requests%rowtype;
  v_request_hash text;
  v_message_id uuid;
  v_evidence_id uuid;
  v_note text;
  v_is_lead boolean;
  v_is_pm boolean;
  v_response jsonb;
begin
  v_actor := private.project_design_require_active_actor();
  if not (select public.authorize('project_design.client_approval')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  v_is_lead := private.project_design_is_current_lead(p_project_id, v_actor);
  v_is_pm := (select private.has_role('project_manager'));
  if not (v_is_lead or v_is_pm) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_project_id is null then
    raise exception 'INVALID_INPUT';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  perform private.project_design_assert_evidence_args(
    p_source_type, p_source_reference, p_note, p_storage_object_path, p_file_sha256, p_file_size_bytes, p_mime_type
  );
  v_note := nullif(trim(coalesce(p_note, '')), '');

  v_request_hash := private.project_sha256(
    'record_client_approval|' || p_project_id::text || '|' || p_source_type || '|' ||
    trim(p_source_reference) || '|' || coalesce(v_note, '') || '|' ||
    coalesce(p_storage_object_path, '') || '|' || coalesce(p_file_sha256, '') || '|' ||
    coalesce(p_file_size_bytes::text, '') || '|' || coalesce(p_mime_type, '')
  );
  perform private.project_idempotency_xact_lock('staff', v_actor, 'record_client_approval', p_idempotency_key);

  select * into v_idempotency
  from private.project_idempotency_requests
  where actor_kind = 'staff'
    and actor_id = v_actor
    and operation_code = 'record_client_approval'
    and idempotency_key = trim(p_idempotency_key);

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
  if v_project.status <> 'handover_accepted' then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;
  if v_is_pm and v_project.primary_pm_id is distinct from v_actor and not v_is_lead then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not v_is_lead and v_project.primary_pm_id is distinct from v_actor then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_workflow
  from public.project_design_workflows
  where project_id = p_project_id
  for update;
  if v_workflow.project_id is null then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;

  if v_workflow.state = 'client_approved' then
    v_response := jsonb_build_object(
      'success', true,
      'project_id', p_project_id,
      'state', 'client_approved',
      'unchanged', true,
      'idempotent_replay', false
    );
    insert into private.project_idempotency_requests (
      actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
    ) values (
      'staff', v_actor, 'record_client_approval', trim(p_idempotency_key), v_request_hash, p_project_id, v_response
    );
    return v_response;
  end if;

  if v_workflow.state <> 'client_review' then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;

  if p_source_type = 'uploaded_artifact' then
    if trim(p_source_reference) <> trim(p_storage_object_path)
       or trim(p_storage_object_path) not like ('projects/' || p_project_id::text || '/evidence/%')
       or position('..' in trim(p_storage_object_path)) > 0
       or not private.project_design_uploaded_evidence_object_exists(p_project_id, p_storage_object_path) then
      raise exception 'PROJECT_MISSING_EVIDENCE';
    end if;
  end if;

  if p_source_type = 'whatsapp_message' then
    begin
      v_message_id := trim(p_source_reference)::uuid;
    exception
      when invalid_text_representation then
        raise exception 'PROJECT_MISSING_EVIDENCE';
    end;
    if not private.project_design_whatsapp_belongs_to_project(p_project_id, v_message_id) then
      raise exception 'PROJECT_MISSING_EVIDENCE';
    end if;
  end if;

  insert into public.project_design_evidence (
    project_id, evidence_type, source_type, source_reference, storage_object_path,
    file_sha256, file_size_bytes, mime_type, captured_by, note
  ) values (
    p_project_id, 'client_approval', p_source_type, trim(p_source_reference),
    case when p_source_type = 'uploaded_artifact' then trim(p_storage_object_path) else null end,
    case when p_source_type = 'uploaded_artifact' then p_file_sha256 else null end,
    case when p_source_type = 'uploaded_artifact' then p_file_size_bytes else null end,
    case when p_source_type = 'uploaded_artifact' then trim(p_mime_type) else null end,
    v_actor, v_note
  )
  returning id into v_evidence_id;

  update public.project_design_workflows
  set state = 'client_approved',
      updated_at = now()
  where project_id = p_project_id;

  insert into public.project_events (project_id, lead_id, event_type, actor_kind, actor_id, details)
  values (
    p_project_id, v_project.lead_id, 'project.client_approved', 'staff', v_actor,
    jsonb_build_object(
      'previous_state', 'client_review',
      'state', 'client_approved',
      'evidence_id', v_evidence_id,
      'source_type', p_source_type
    )
  );

  v_response := jsonb_build_object(
    'success', true,
    'project_id', p_project_id,
    'state', 'client_approved',
    'evidence_id', v_evidence_id,
    'unchanged', false,
    'idempotent_replay', false
  );
  insert into private.project_idempotency_requests (
    actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
  ) values (
    'staff', v_actor, 'record_client_approval', trim(p_idempotency_key), v_request_hash, p_project_id, v_response
  );
  return v_response;
end;
$$;

create or replace function public.hold_project_design(
  p_project_id uuid,
  p_idempotency_key text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_project public.projects%rowtype;
  v_workflow public.project_design_workflows%rowtype;
  v_idempotency private.project_idempotency_requests%rowtype;
  v_request_hash text;
  v_reason text;
  v_from text;
  v_is_lead boolean;
  v_response jsonb;
begin
  v_actor := private.project_design_require_active_actor();
  if not (select public.authorize('project_design.hold')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  v_is_lead := private.project_design_is_current_lead(p_project_id, v_actor);
  if p_project_id is null then
    raise exception 'INVALID_INPUT';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;
  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if v_reason is null or length(v_reason) < 8 or length(v_reason) > 240 then
    raise exception 'INVALID_REASON';
  end if;

  v_request_hash := private.project_sha256('design_hold|' || p_project_id::text || '|' || v_reason);
  perform private.project_idempotency_xact_lock('staff', v_actor, 'design_hold', p_idempotency_key);

  select * into v_idempotency
  from private.project_idempotency_requests
  where actor_kind = 'staff'
    and actor_id = v_actor
    and operation_code = 'design_hold'
    and idempotency_key = trim(p_idempotency_key);

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
  if v_project.status <> 'handover_accepted' then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;
  if not v_is_lead and v_project.primary_pm_id is distinct from v_actor then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_workflow
  from public.project_design_workflows
  where project_id = p_project_id
  for update;
  if v_workflow.project_id is null then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;

  v_from := v_workflow.state;
  if v_from = 'design_on_hold' then
    v_response := jsonb_build_object(
      'success', true,
      'project_id', p_project_id,
      'state', 'design_on_hold',
      'unchanged', true,
      'idempotent_replay', false
    );
    insert into private.project_idempotency_requests (
      actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
    ) values (
      'staff', v_actor, 'design_hold', trim(p_idempotency_key), v_request_hash, p_project_id, v_response
    );
    return v_response;
  end if;

  if v_from not in (
    'brief_received', 'measurement_pending', 'measurement_completed', 'concept_design',
    'internal_review', 'client_review', 'client_approved', 'production_drawings', 'production_ready'
  ) then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;

  update public.project_design_workflows
  set state = 'design_on_hold',
      held_from_state = v_from,
      revision_return_state = null,
      updated_at = now()
  where project_id = p_project_id;

  insert into public.project_events (project_id, lead_id, event_type, actor_kind, actor_id, details)
  values (
    p_project_id, v_project.lead_id, 'project.design_held', 'staff', v_actor,
    jsonb_build_object('previous_state', v_from, 'state', 'design_on_hold', 'reason', v_reason)
  );

  v_response := jsonb_build_object(
    'success', true,
    'project_id', p_project_id,
    'previous_state', v_from,
    'state', 'design_on_hold',
    'unchanged', false,
    'idempotent_replay', false
  );
  insert into private.project_idempotency_requests (
    actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
  ) values (
    'staff', v_actor, 'design_hold', trim(p_idempotency_key), v_request_hash, p_project_id, v_response
  );
  return v_response;
end;
$$;

create or replace function public.resume_project_design(
  p_project_id uuid,
  p_idempotency_key text,
  p_reason text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_project public.projects%rowtype;
  v_workflow public.project_design_workflows%rowtype;
  v_idempotency private.project_idempotency_requests%rowtype;
  v_request_hash text;
  v_reason text;
  v_resume text;
  v_is_lead boolean;
  v_response jsonb;
begin
  v_actor := private.project_design_require_active_actor();
  if not (select public.authorize('project_design.hold')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  v_is_lead := private.project_design_is_current_lead(p_project_id, v_actor);
  if p_project_id is null then
    raise exception 'INVALID_INPUT';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;
  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if v_reason is null or length(v_reason) < 8 or length(v_reason) > 240 then
    raise exception 'INVALID_REASON';
  end if;

  v_request_hash := private.project_sha256('design_resume|' || p_project_id::text || '|' || v_reason);
  perform private.project_idempotency_xact_lock('staff', v_actor, 'design_resume', p_idempotency_key);

  select * into v_idempotency
  from private.project_idempotency_requests
  where actor_kind = 'staff'
    and actor_id = v_actor
    and operation_code = 'design_resume'
    and idempotency_key = trim(p_idempotency_key);

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
  if v_project.status <> 'handover_accepted' then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;
  if not v_is_lead and v_project.primary_pm_id is distinct from v_actor then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_workflow
  from public.project_design_workflows
  where project_id = p_project_id
  for update;
  if v_workflow.project_id is null then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;

  if v_workflow.state <> 'design_on_hold' then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;

  v_resume := v_workflow.held_from_state;
  if v_resume is null then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;

  update public.project_design_workflows
  set state = v_resume,
      held_from_state = null,
      updated_at = now()
  where project_id = p_project_id;

  insert into public.project_events (project_id, lead_id, event_type, actor_kind, actor_id, details)
  values (
    p_project_id, v_project.lead_id, 'project.design_resumed', 'staff', v_actor,
    jsonb_build_object('previous_state', 'design_on_hold', 'state', v_resume, 'reason', v_reason)
  );

  v_response := jsonb_build_object(
    'success', true,
    'project_id', p_project_id,
    'previous_state', 'design_on_hold',
    'state', v_resume,
    'unchanged', false,
    'idempotent_replay', false
  );
  insert into private.project_idempotency_requests (
    actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
  ) values (
    'staff', v_actor, 'design_resume', trim(p_idempotency_key), v_request_hash, p_project_id, v_response
  );
  return v_response;
end;
$$;

create or replace function public.approve_project_production_ready(
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
  v_workflow public.project_design_workflows%rowtype;
  v_idempotency private.project_idempotency_requests%rowtype;
  v_request_hash text;
  v_message_id uuid;
  v_evidence_id uuid;
  v_note text;
  v_response jsonb;
begin
  v_actor := private.project_design_require_active_actor();
  if not (select public.authorize('project_design.transition')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not private.project_design_is_current_lead(p_project_id, v_actor) then
    raise exception 'FORBIDDEN: Only the current Lead Designer may approve production ready.' using errcode = '42501';
  end if;
  if p_project_id is null then
    raise exception 'INVALID_INPUT';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  perform private.project_design_assert_evidence_args(
    p_source_type, p_source_reference, p_note, p_storage_object_path, p_file_sha256, p_file_size_bytes, p_mime_type
  );
  v_note := nullif(trim(coalesce(p_note, '')), '');

  v_request_hash := private.project_sha256(
    'approve_production_ready|' || p_project_id::text || '|' || p_source_type || '|' ||
    trim(p_source_reference) || '|' || coalesce(v_note, '') || '|' ||
    coalesce(p_storage_object_path, '') || '|' || coalesce(p_file_sha256, '') || '|' ||
    coalesce(p_file_size_bytes::text, '') || '|' || coalesce(p_mime_type, '')
  );
  perform private.project_idempotency_xact_lock('staff', v_actor, 'approve_production_ready', p_idempotency_key);

  select * into v_idempotency
  from private.project_idempotency_requests
  where actor_kind = 'staff'
    and actor_id = v_actor
    and operation_code = 'approve_production_ready'
    and idempotency_key = trim(p_idempotency_key);

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
  if v_project.status <> 'handover_accepted' then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;

  select * into v_workflow
  from public.project_design_workflows
  where project_id = p_project_id
  for update;
  if v_workflow.project_id is null then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;

  if v_workflow.state = 'production_ready' then
    v_response := jsonb_build_object(
      'success', true,
      'project_id', p_project_id,
      'state', 'production_ready',
      'unchanged', true,
      'idempotent_replay', false
    );
    insert into private.project_idempotency_requests (
      actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
    ) values (
      'staff', v_actor, 'approve_production_ready', trim(p_idempotency_key), v_request_hash, p_project_id, v_response
    );
    return v_response;
  end if;

  if v_workflow.state <> 'production_drawings' then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;
  if not exists (
    select 1 from public.project_design_evidence e
    where e.project_id = p_project_id and e.evidence_type = 'client_approval'
  ) then
    raise exception 'PROJECT_MISSING_EVIDENCE';
  end if;
  if not (
    private.project_design_has_ready_kind(p_project_id, 'production_drawing')
    or private.project_design_has_ready_kind(p_project_id, 'approval_pack')
  ) then
    raise exception 'PROJECT_MISSING_EVIDENCE';
  end if;

  if p_source_type = 'uploaded_artifact' then
    if trim(p_source_reference) <> trim(p_storage_object_path)
       or trim(p_storage_object_path) not like ('projects/' || p_project_id::text || '/evidence/%')
       or position('..' in trim(p_storage_object_path)) > 0
       or not private.project_design_uploaded_evidence_object_exists(p_project_id, p_storage_object_path) then
      raise exception 'PROJECT_MISSING_EVIDENCE';
    end if;
  end if;

  if p_source_type = 'whatsapp_message' then
    begin
      v_message_id := trim(p_source_reference)::uuid;
    exception
      when invalid_text_representation then
        raise exception 'PROJECT_MISSING_EVIDENCE';
    end;
    if not private.project_design_whatsapp_belongs_to_project(p_project_id, v_message_id) then
      raise exception 'PROJECT_MISSING_EVIDENCE';
    end if;
  end if;

  insert into public.project_design_evidence (
    project_id, evidence_type, source_type, source_reference, storage_object_path,
    file_sha256, file_size_bytes, mime_type, captured_by, note
  ) values (
    p_project_id, 'production_ready', p_source_type, trim(p_source_reference),
    case when p_source_type = 'uploaded_artifact' then trim(p_storage_object_path) else null end,
    case when p_source_type = 'uploaded_artifact' then p_file_sha256 else null end,
    case when p_source_type = 'uploaded_artifact' then p_file_size_bytes else null end,
    case when p_source_type = 'uploaded_artifact' then trim(p_mime_type) else null end,
    v_actor, v_note
  )
  returning id into v_evidence_id;

  update public.project_design_workflows
  set state = 'production_ready',
      updated_at = now()
  where project_id = p_project_id;

  insert into public.project_events (project_id, lead_id, event_type, actor_kind, actor_id, details)
  values (
    p_project_id, v_project.lead_id, 'project.production_ready', 'staff', v_actor,
    jsonb_build_object(
      'previous_state', 'production_drawings',
      'state', 'production_ready',
      'evidence_id', v_evidence_id,
      'source_type', p_source_type
    )
  );

  v_response := jsonb_build_object(
    'success', true,
    'project_id', p_project_id,
    'state', 'production_ready',
    'evidence_id', v_evidence_id,
    'unchanged', false,
    'idempotent_replay', false
  );
  insert into private.project_idempotency_requests (
    actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
  ) values (
    'staff', v_actor, 'approve_production_ready', trim(p_idempotency_key), v_request_hash, p_project_id, v_response
  );
  return v_response;
end;
$$;

create or replace function public.complete_project_design(
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
  v_workflow public.project_design_workflows%rowtype;
  v_idempotency private.project_idempotency_requests%rowtype;
  v_request_hash text;
  v_completed_at timestamptz := now();
  v_response jsonb;
begin
  v_actor := private.project_design_require_active_actor();
  if not (select public.authorize('project_design.transition')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not private.project_design_is_current_lead(p_project_id, v_actor) then
    raise exception 'FORBIDDEN: Only the current Lead Designer may complete design.' using errcode = '42501';
  end if;
  if p_project_id is null then
    raise exception 'INVALID_INPUT';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  v_request_hash := private.project_sha256('complete_design|' || p_project_id::text);
  perform private.project_idempotency_xact_lock('staff', v_actor, 'complete_design', p_idempotency_key);

  select * into v_idempotency
  from private.project_idempotency_requests
  where actor_kind = 'staff'
    and actor_id = v_actor
    and operation_code = 'complete_design'
    and idempotency_key = trim(p_idempotency_key);

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
  if v_project.status <> 'handover_accepted' then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;

  select * into v_workflow
  from public.project_design_workflows
  where project_id = p_project_id
  for update;
  if v_workflow.project_id is null then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;

  if v_workflow.state = 'design_completed' then
    v_response := jsonb_build_object(
      'success', true,
      'project_id', p_project_id,
      'state', 'design_completed',
      'completed_at', v_workflow.completed_at,
      'unchanged', true,
      'idempotent_replay', false
    );
    insert into private.project_idempotency_requests (
      actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
    ) values (
      'staff', v_actor, 'complete_design', trim(p_idempotency_key), v_request_hash, p_project_id, v_response
    );
    return v_response;
  end if;

  if v_workflow.state <> 'production_ready' then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;

  update public.project_design_workflows
  set state = 'design_completed',
      completed_at = v_completed_at,
      updated_at = v_completed_at
  where project_id = p_project_id;

  insert into public.project_events (project_id, lead_id, event_type, actor_kind, actor_id, details)
  values (
    p_project_id, v_project.lead_id, 'project.design_completed', 'staff', v_actor,
    jsonb_build_object('previous_state', 'production_ready', 'state', 'design_completed')
  );

  v_response := jsonb_build_object(
    'success', true,
    'project_id', p_project_id,
    'state', 'design_completed',
    'completed_at', v_completed_at,
    'unchanged', false,
    'idempotent_replay', false
  );
  insert into private.project_idempotency_requests (
    actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
  ) values (
    'staff', v_actor, 'complete_design', trim(p_idempotency_key), v_request_hash, p_project_id, v_response
  );
  return v_response;
end;
$$;

create or replace function public.reserve_project_design_deliverable_version(
  p_project_id uuid,
  p_deliverable_key text,
  p_kind text,
  p_label text,
  p_file_name text,
  p_mime_type text,
  p_file_size_bytes bigint,
  p_file_sha256 text,
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
  v_workflow public.project_design_workflows%rowtype;
  v_idempotency private.project_idempotency_requests%rowtype;
  v_request_hash text;
  v_key text;
  v_label text;
  v_file_name text;
  v_next integer;
  v_version_id uuid;
  v_object_path text;
  v_supersedes uuid;
  v_response jsonb;
begin
  v_actor := private.project_design_require_active_actor();
  if not (select public.authorize('project_design.collaborate')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if not private.project_design_is_current_assigned_designer(p_project_id, v_actor) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_project_id is null then
    raise exception 'INVALID_INPUT';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  v_key := trim(coalesce(p_deliverable_key, ''));
  if v_key !~ '^[a-z0-9][a-z0-9_-]{0,62}$' then
    raise exception 'INVALID_INPUT';
  end if;
  if p_kind not in ('concept_board', 'measurement_sheet', 'client_presentation', 'production_drawing', 'approval_pack') then
    raise exception 'INVALID_INPUT';
  end if;
  v_label := trim(coalesce(p_label, ''));
  if length(v_label) not between 1 and 120 then
    raise exception 'INVALID_INPUT';
  end if;
  v_file_name := trim(coalesce(p_file_name, ''));
  if length(v_file_name) not between 1 and 240
     or v_file_name like '%..%'
     or position('/' in v_file_name) > 0
     or position('\' in v_file_name) > 0 then
    raise exception 'INVALID_INPUT';
  end if;
  if p_mime_type not in ('application/pdf', 'image/jpeg', 'image/png', 'image/webp') then
    raise exception 'INVALID_INPUT';
  end if;
  if p_file_size_bytes is null or p_file_size_bytes <= 0 or p_file_size_bytes > 20971520 then
    raise exception 'INVALID_INPUT';
  end if;
  if p_file_sha256 is null or p_file_sha256 !~ '^[0-9a-f]{64}$' then
    raise exception 'INVALID_INPUT';
  end if;

  v_request_hash := private.project_sha256(
    'register_deliverable_version|' || p_project_id::text || '|' || v_key || '|' || p_kind || '|' ||
    v_label || '|' || v_file_name || '|' || p_mime_type || '|' || p_file_size_bytes::text || '|' || p_file_sha256
  );
  perform private.project_idempotency_xact_lock('staff', v_actor, 'register_deliverable_version', p_idempotency_key);

  select * into v_idempotency
  from private.project_idempotency_requests
  where actor_kind = 'staff'
    and actor_id = v_actor
    and operation_code = 'register_deliverable_version'
    and idempotency_key = trim(p_idempotency_key);

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
  if v_project.status <> 'handover_accepted' then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;

  select * into v_workflow
  from public.project_design_workflows
  where project_id = p_project_id
  for update;
  if v_workflow.project_id is null then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;

  if exists (
    select 1 from public.project_design_deliverable_versions
    where project_id = p_project_id
      and deliverable_key = v_key
      and kind is distinct from p_kind
  ) then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;

  select coalesce(max(version_number), 0) + 1 into v_next
  from public.project_design_deliverable_versions
  where project_id = p_project_id
    and deliverable_key = v_key;

  select v.id into v_supersedes
  from public.project_design_deliverable_versions v
  where v.project_id = p_project_id
    and v.deliverable_key = v_key
    and v.upload_status = 'ready'
  order by v.version_number desc
  limit 1;

  v_object_path := 'projects/' || p_project_id::text || '/deliverables/' || v_key || '/v' || v_next::text || '/' || gen_random_uuid()::text;

  insert into public.project_design_deliverable_versions (
    project_id, deliverable_key, kind, version_number, label, bucket_id, object_path,
    upload_status, file_name, mime_type, file_size_bytes, file_sha256, uploaded_by, supersedes_version_id
  ) values (
    p_project_id, v_key, p_kind, v_next, v_label, 'project-design-documents', v_object_path,
    'pending', v_file_name, p_mime_type, p_file_size_bytes, p_file_sha256, v_actor, v_supersedes
  )
  returning id into v_version_id;

  v_response := jsonb_build_object(
    'success', true,
    'version_id', v_version_id,
    'version_number', v_next,
    'bucket_id', 'project-design-documents',
    'object_path', v_object_path,
    'upload_status', 'pending',
    'idempotent_replay', false
  );
  insert into private.project_idempotency_requests (
    actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
  ) values (
    'staff', v_actor, 'register_deliverable_version', trim(p_idempotency_key), v_request_hash, p_project_id, v_response
  );
  return v_response;
end;
$$;

create or replace function public.finalize_project_design_deliverable_version(
  p_version_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_row public.project_design_deliverable_versions%rowtype;
  v_project public.projects%rowtype;
  v_idempotency private.project_idempotency_requests%rowtype;
  v_request_hash text;
  v_ready_at timestamptz := now();
  v_response jsonb;
begin
  v_actor := private.project_design_require_active_actor();
  if not (select public.authorize('project_design.collaborate')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;
  if p_version_id is null then
    raise exception 'INVALID_INPUT';
  end if;
  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  v_request_hash := private.project_sha256('finalize_deliverable|' || p_version_id::text);
  perform private.project_idempotency_xact_lock('staff', v_actor, 'finalize_deliverable', p_idempotency_key);

  select * into v_idempotency
  from private.project_idempotency_requests
  where actor_kind = 'staff'
    and actor_id = v_actor
    and operation_code = 'finalize_deliverable'
    and idempotency_key = trim(p_idempotency_key);

  if v_idempotency.id is not null then
    if v_idempotency.request_hash <> v_request_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return v_idempotency.response_snapshot;
  end if;

  select * into v_row
  from public.project_design_deliverable_versions
  where id = p_version_id
  for update;
  if v_row.id is null then
    raise exception 'PROJECT_NOT_FOUND';
  end if;
  if not private.project_design_is_current_assigned_designer(v_row.project_id, v_actor) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_project from public.projects where id = v_row.project_id for update;
  if v_project.status <> 'handover_accepted' then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;

  if v_row.upload_status = 'ready' then
    v_response := jsonb_build_object(
      'success', true,
      'version_id', v_row.id,
      'version_number', v_row.version_number,
      'upload_status', 'ready',
      'unchanged', true,
      'idempotent_replay', false
    );
    insert into private.project_idempotency_requests (
      actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
    ) values (
      'staff', v_actor, 'finalize_deliverable', trim(p_idempotency_key), v_request_hash, v_row.project_id, v_response
    );
    return v_response;
  end if;

  if v_row.file_sha256 is null or v_row.file_sha256 !~ '^[0-9a-f]{64}$'
     or v_row.file_size_bytes is null or v_row.file_size_bytes <= 0
     or v_row.mime_type is null then
    raise exception 'PROJECT_MISSING_EVIDENCE';
  end if;

  if not exists (
    select 1 from storage.objects o
    where o.bucket_id = v_row.bucket_id
      and o.name = v_row.object_path
  ) then
    raise exception 'PROJECT_MISSING_EVIDENCE';
  end if;

  update public.project_design_deliverable_versions
  set upload_status = 'ready',
      ready_at = v_ready_at
  where id = p_version_id
    and upload_status = 'pending';

  insert into public.project_events (project_id, lead_id, event_type, actor_kind, actor_id, details)
  values (
    v_row.project_id, v_project.lead_id, 'project.design_deliverable', 'staff', v_actor,
    jsonb_build_object(
      'version_id', v_row.id,
      'deliverable_key', v_row.deliverable_key,
      'kind', v_row.kind,
      'version_number', v_row.version_number
    )
  );

  v_response := jsonb_build_object(
    'success', true,
    'version_id', v_row.id,
    'version_number', v_row.version_number,
    'bucket_id', v_row.bucket_id,
    'object_path', v_row.object_path,
    'upload_status', 'ready',
    'ready_at', v_ready_at,
    'unchanged', false,
    'idempotent_replay', false
  );
  insert into private.project_idempotency_requests (
    actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
  ) values (
    'staff', v_actor, 'finalize_deliverable', trim(p_idempotency_key), v_request_hash, v_row.project_id, v_response
  );
  return v_response;
end;
$$;

create or replace function public.can_view_project_design(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.project_design_can_view(p_project_id);
$$;

create or replace function public.can_record_project_client_approval(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    join public.project_design_workflows w on w.project_id = p.id
    join public.profiles pr on pr.id = auth.uid()
    where p.id = p_project_id
      and auth.uid() is not null
      and pr.status = 'active'
      and (select public.authorize('project_design.client_approval'))
      and p.status = 'handover_accepted'
      and w.state = 'client_review'
      and (
        private.project_design_is_current_lead(p.id, auth.uid())
        or (
          (select private.has_role('project_manager'))
          and p.primary_pm_id = auth.uid()
        )
      )
  );
$$;

create or replace function public.can_approve_project_production_ready(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.projects p
    join public.project_design_workflows w on w.project_id = p.id
    join public.profiles pr on pr.id = auth.uid()
    where p.id = p_project_id
      and auth.uid() is not null
      and pr.status = 'active'
      and (select public.authorize('project_design.transition'))
      and p.status = 'handover_accepted'
      and w.state = 'production_drawings'
      and private.project_design_is_current_lead(p.id, auth.uid())
      and exists (
        select 1
        from public.project_design_evidence e
        where e.project_id = p.id
          and e.evidence_type = 'client_approval'
      )
      and (
        private.project_design_has_ready_kind(p.id, 'production_drawing')
        or private.project_design_has_ready_kind(p.id, 'approval_pack')
      )
  );
$$;

create or replace function public.get_project_design_high_level_status(p_project_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_project public.projects%rowtype;
  v_credited uuid;
  v_allowed boolean;
  v_state text;
  v_started_at timestamptz;
  v_completed_at timestamptz;
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  if p_project_id is null then
    raise exception 'INVALID_INPUT';
  end if;

  select * into v_project from public.projects where id = p_project_id;
  if v_project.id is null then
    raise exception 'PROJECT_NOT_FOUND';
  end if;

  select qa.credited_sales_executive_id into v_credited
  from public.quotation_acceptances qa
  where qa.id = v_project.quotation_acceptance_id;

  v_allowed := private.project_design_can_view(p_project_id)
    or (
      (select public.authorize('projects.read'))
      and (select private.has_role('sales_executive'))
      and v_credited = auth.uid()
    );
  if not v_allowed then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  select w.state, w.started_at, w.completed_at
    into v_state, v_started_at, v_completed_at
  from public.project_design_workflows w
  where w.project_id = p_project_id;

  return jsonb_build_object(
    'project_id', v_project.id,
    'project_number', v_project.project_number,
    'state', v_state,
    'started_at', v_started_at,
    'completed_at', v_completed_at
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. RLS / privileges
-- ----------------------------------------------------------------------------
alter table public.project_designer_assignments enable row level security;
alter table public.project_design_workflows enable row level security;
alter table public.project_design_evidence enable row level security;
alter table public.project_design_deliverable_versions enable row level security;

create policy project_designer_assignments_staff_read on public.project_designer_assignments
  for select to authenticated
  using (private.project_design_can_view(project_id));

create policy project_design_workflows_staff_read on public.project_design_workflows
  for select to authenticated
  using (private.project_design_can_view(project_id));

create policy project_design_evidence_staff_read on public.project_design_evidence
  for select to authenticated
  using (private.project_design_can_view(project_id));

create policy project_design_deliverable_versions_staff_read on public.project_design_deliverable_versions
  for select to authenticated
  using (private.project_design_can_view(project_id));

revoke all on table public.project_designer_assignments from public, anon, authenticated;
revoke all on table public.project_design_workflows from public, anon, authenticated;
revoke all on table public.project_design_evidence from public, anon, authenticated;
revoke all on table public.project_design_deliverable_versions from public, anon, authenticated;

grant select on table public.project_designer_assignments to authenticated;
grant select on table public.project_design_workflows to authenticated;
grant select on table public.project_design_evidence to authenticated;
grant select on table public.project_design_deliverable_versions to authenticated;

alter function private.project_is_assignable_designer(uuid) owner to postgres;
alter function private.project_design_assignment_role(uuid, uuid) owner to postgres;
alter function private.project_design_is_current_lead(uuid, uuid) owner to postgres;
alter function private.project_design_is_current_assigned_designer(uuid, uuid) owner to postgres;
alter function private.project_design_can_view(uuid) owner to postgres;
alter function private.project_design_current_ready_max(uuid, text) owner to postgres;
alter function private.project_design_has_ready_kind(uuid, text) owner to postgres;
alter function private.project_can_view(uuid) owner to postgres;
alter function private.project_can_view_handover_baseline(uuid) owner to postgres;
alter function private.project_design_require_active_actor() owner to postgres;
alter function private.project_design_assert_evidence_args(text, text, text, text, text, bigint, text) owner to postgres;
alter function private.project_design_uploaded_evidence_object_exists(uuid, text) owner to postgres;
alter function private.project_design_whatsapp_belongs_to_project(uuid, uuid) owner to postgres;
alter function private.prevent_project_designer_assignment_mutation() owner to postgres;
alter function private.prevent_project_design_workflow_mutation() owner to postgres;
alter function private.prevent_project_design_deliverable_mutation() owner to postgres;
alter function public.list_assignable_designers() owner to postgres;
alter function public.set_project_lead_designer(uuid, uuid, text, text) owner to postgres;
alter function public.add_project_supporting_designer(uuid, uuid, text, text) owner to postgres;
alter function public.remove_project_designer_assignment(uuid, uuid, text, text) owner to postgres;
alter function public.transition_project_design(uuid, text, text, text, text) owner to postgres;
alter function public.record_project_client_approval(uuid, text, text, text, text, text, text, bigint, text) owner to postgres;
alter function public.hold_project_design(uuid, text, text) owner to postgres;
alter function public.resume_project_design(uuid, text, text) owner to postgres;
alter function public.approve_project_production_ready(uuid, text, text, text, text, text, text, bigint, text) owner to postgres;
alter function public.complete_project_design(uuid, text) owner to postgres;
alter function public.reserve_project_design_deliverable_version(uuid, text, text, text, text, text, bigint, text, text) owner to postgres;
alter function public.finalize_project_design_deliverable_version(uuid, text) owner to postgres;
alter function public.can_view_project_design(uuid) owner to postgres;
alter function public.can_record_project_client_approval(uuid) owner to postgres;
alter function public.can_approve_project_production_ready(uuid) owner to postgres;
alter function public.get_project_design_high_level_status(uuid) owner to postgres;

revoke all on function private.project_is_assignable_designer(uuid) from public, anon, authenticated;
revoke all on function private.project_design_assignment_role(uuid, uuid) from public, anon, authenticated;
revoke all on function private.project_design_is_current_lead(uuid, uuid) from public, anon, authenticated;
revoke all on function private.project_design_is_current_assigned_designer(uuid, uuid) from public, anon, authenticated;
revoke all on function private.project_design_can_view(uuid) from public, anon, authenticated;
revoke all on function private.project_design_current_ready_max(uuid, text) from public, anon, authenticated;
revoke all on function private.project_design_has_ready_kind(uuid, text) from public, anon, authenticated;
revoke all on function private.project_can_view_handover_baseline(uuid) from public, anon, authenticated;
revoke all on function private.project_design_require_active_actor() from public, anon, authenticated;
revoke all on function private.project_design_assert_evidence_args(text, text, text, text, text, bigint, text) from public, anon, authenticated;
revoke all on function private.project_design_uploaded_evidence_object_exists(uuid, text) from public, anon, authenticated;
revoke all on function private.project_design_whatsapp_belongs_to_project(uuid, uuid) from public, anon, authenticated;
revoke all on function private.prevent_project_designer_assignment_mutation() from public, anon, authenticated;
revoke all on function private.prevent_project_design_workflow_mutation() from public, anon, authenticated;
revoke all on function private.prevent_project_design_deliverable_mutation() from public, anon, authenticated;

revoke all on function public.list_assignable_designers() from public, anon, authenticated;
revoke all on function public.set_project_lead_designer(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.add_project_supporting_designer(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.remove_project_designer_assignment(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.transition_project_design(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.record_project_client_approval(uuid, text, text, text, text, text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.hold_project_design(uuid, text, text) from public, anon, authenticated;
revoke all on function public.resume_project_design(uuid, text, text) from public, anon, authenticated;
revoke all on function public.approve_project_production_ready(uuid, text, text, text, text, text, text, bigint, text) from public, anon, authenticated;
revoke all on function public.complete_project_design(uuid, text) from public, anon, authenticated;
revoke all on function public.reserve_project_design_deliverable_version(uuid, text, text, text, text, text, bigint, text, text) from public, anon, authenticated;
revoke all on function public.finalize_project_design_deliverable_version(uuid, text) from public, anon, authenticated;
revoke all on function public.can_view_project_design(uuid) from public, anon, authenticated;
revoke all on function public.can_record_project_client_approval(uuid) from public, anon, authenticated;
revoke all on function public.can_approve_project_production_ready(uuid) from public, anon, authenticated;
revoke all on function public.get_project_design_high_level_status(uuid) from public, anon, authenticated;

grant execute on function private.project_can_view(uuid) to authenticated;
grant execute on function private.project_design_can_view(uuid) to authenticated;

grant execute on function public.list_assignable_designers() to authenticated;
grant execute on function public.set_project_lead_designer(uuid, uuid, text, text) to authenticated;
grant execute on function public.add_project_supporting_designer(uuid, uuid, text, text) to authenticated;
grant execute on function public.remove_project_designer_assignment(uuid, uuid, text, text) to authenticated;
grant execute on function public.transition_project_design(uuid, text, text, text, text) to authenticated;
grant execute on function public.record_project_client_approval(uuid, text, text, text, text, text, text, bigint, text) to authenticated;
grant execute on function public.hold_project_design(uuid, text, text) to authenticated;
grant execute on function public.resume_project_design(uuid, text, text) to authenticated;
grant execute on function public.approve_project_production_ready(uuid, text, text, text, text, text, text, bigint, text) to authenticated;
grant execute on function public.complete_project_design(uuid, text) to authenticated;
grant execute on function public.reserve_project_design_deliverable_version(uuid, text, text, text, text, text, bigint, text, text) to authenticated;
grant execute on function public.finalize_project_design_deliverable_version(uuid, text) to authenticated;
grant execute on function public.can_view_project_design(uuid) to authenticated;
grant execute on function public.can_record_project_client_approval(uuid) to authenticated;
grant execute on function public.can_approve_project_production_ready(uuid) to authenticated;
grant execute on function public.get_project_design_high_level_status(uuid) to authenticated;
