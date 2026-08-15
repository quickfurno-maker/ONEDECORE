-- ============================================================================
-- M28 Migration: ONEDECORE Phase 8A Closed-Won Project Conversion & PM Handover
-- Architecture: ADR-0024 / DEC-0071 / OD8A-1..OD8A-4
-- Forward-only. Does not rewrite M26/M27. No production seeds.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. System permissions (canonical five-role grants only)
-- ----------------------------------------------------------------------------
insert into public.permissions (code, name, description, is_system, is_active) values
  ('projects.read', 'Read execution projects', 'Read Phase 8A Closed-Won project handover rows in role scope', true, true),
  ('projects.assign_pm', 'Assign project manager', 'Assign or reassign the current primary project manager', true, true),
  ('projects.accept_handover', 'Accept project handover', 'Current primary project manager accepts handover', true, true)
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
  and p.code = 'projects.read'
  and r.code in ('super_admin', 'sales_manager', 'sales_executive', 'project_manager')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.is_system = true
  and p.is_system = true
  and p.code = 'projects.assign_pm'
  and r.code in ('super_admin', 'sales_manager')
on conflict (role_id, permission_id) do nothing;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.is_system = true
  and p.is_system = true
  and p.code = 'projects.accept_handover'
  and r.code = 'project_manager'
on conflict (role_id, permission_id) do nothing;

-- ----------------------------------------------------------------------------
-- 2. Tables
-- ----------------------------------------------------------------------------
create table public.projects (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references public.leads (id) on delete restrict,
  quotation_acceptance_id uuid not null unique references public.quotation_acceptances (id) on delete restrict,
  accepted_quotation_id uuid not null references public.quotations (id) on delete restrict,
  accepted_quotation_version_id uuid not null references public.quotation_versions (id) on delete restrict,
  project_number text not null unique,
  status text not null,
  primary_pm_id uuid null references public.profiles (id) on delete restrict,
  handover_accepted_at timestamptz null,
  created_by uuid null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_projects_number_format check (project_number ~ '^OD-P-[0-9]{4}-[0-9]{6,}$'),
  constraint chk_projects_status check (
    status in (
      'awaiting_project_manager_assignment',
      'awaiting_project_manager_acceptance',
      'handover_accepted'
    )
  ),
  constraint chk_projects_handover_accepted_at check (
    (status = 'handover_accepted' and handover_accepted_at is not null)
    or (status <> 'handover_accepted' and handover_accepted_at is null)
  ),
  constraint chk_projects_primary_pm_state check (
    (status = 'awaiting_project_manager_assignment' and primary_pm_id is null)
    or (status in ('awaiting_project_manager_acceptance', 'handover_accepted') and primary_pm_id is not null)
  )
);

comment on table public.projects is
  'Phase 8A execution project created after authoritative Closed-Won. One project per lead/acceptance.';

create table public.project_manager_assignments (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  project_manager_id uuid not null references public.profiles (id) on delete restrict,
  assigned_by uuid not null references public.profiles (id) on delete restrict,
  assigned_at timestamptz not null default now(),
  ended_by uuid null references public.profiles (id) on delete restrict,
  ended_at timestamptz null,
  reason text null,
  constraint chk_project_manager_assignments_end_pair check (
    (ended_at is null and ended_by is null)
    or (ended_at is not null and ended_by is not null)
  ),
  constraint chk_project_manager_assignments_reason check (
    reason is null or length(trim(reason)) between 1 and 240
  )
);

comment on table public.project_manager_assignments is
  'Append-only primary PM assignment history. Exactly one current assignment per project.';

create unique index uq_project_manager_assignments_current
  on public.project_manager_assignments (project_id)
  where ended_at is null;

create index idx_project_manager_assignments_pm
  on public.project_manager_assignments (project_manager_id, assigned_at desc);

create table public.project_events (
  id uuid primary key default gen_random_uuid(),
  project_id uuid not null references public.projects (id) on delete restrict,
  lead_id uuid not null references public.leads (id) on delete restrict,
  event_type text not null,
  actor_kind text not null,
  actor_id uuid null references public.profiles (id) on delete restrict,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  constraint chk_project_events_type check (event_type ~ '^[a-z_]+\.[a-z_]+$'),
  constraint chk_project_events_actor_kind check (actor_kind in ('system', 'staff')),
  constraint chk_project_events_actor_pair check (
    (actor_kind = 'system' and actor_id is null)
    or (actor_kind = 'staff' and actor_id is not null)
  ),
  constraint chk_project_events_details check (
    jsonb_typeof(details) = 'object' and pg_column_size(details) <= 4096
  )
);

comment on table public.project_events is
  'Append-only Phase 8A project audit ledger.';

create index idx_project_events_project on public.project_events (project_id, occurred_at desc);
create index idx_project_events_lead on public.project_events (lead_id, occurred_at desc);

create trigger trg_protect_project_events_append_only
  before update or delete on public.project_events
  for each row execute function private.forbid_append_only_mutation();

create table private.project_idempotency_requests (
  id uuid primary key default gen_random_uuid(),
  actor_kind text not null,
  actor_id uuid null references public.profiles (id) on delete restrict,
  operation_code text not null,
  idempotency_key text not null,
  request_hash text not null,
  project_id uuid null references public.projects (id) on delete set null,
  response_snapshot jsonb,
  created_at timestamptz not null default now(),
  constraint chk_project_idempotency_actor_kind check (actor_kind in ('system', 'staff')),
  constraint chk_project_idempotency_actor_pair check (
    (actor_kind = 'system' and actor_id is null)
    or (actor_kind = 'staff' and actor_id is not null)
  ),
  constraint chk_project_idempotency_op check (length(trim(operation_code)) between 1 and 64),
  constraint chk_project_idempotency_key check (length(trim(idempotency_key)) between 1 and 128),
  constraint chk_project_idempotency_hash check (request_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_project_idempotency_response check (
    response_snapshot is null
    or (jsonb_typeof(response_snapshot) = 'object' and pg_column_size(response_snapshot) <= 8192)
  )
);

create unique index uq_project_idempotency_staff
  on private.project_idempotency_requests (actor_id, operation_code, idempotency_key)
  where actor_kind = 'staff';

create unique index uq_project_idempotency_system
  on private.project_idempotency_requests (operation_code, idempotency_key)
  where actor_kind = 'system';

comment on table private.project_idempotency_requests is
  'Private Phase 8A idempotency ledger for materialize, assign_pm, and accept_handover.';

create sequence private.project_number_seq start with 1 increment by 1;

-- ----------------------------------------------------------------------------
-- 3. Private helpers
-- ----------------------------------------------------------------------------
create or replace function private.generate_project_number()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year text;
  v_seq bigint;
begin
  v_year := to_char(now() at time zone 'Asia/Kolkata', 'YYYY');
  v_seq := nextval('private.project_number_seq');
  return 'OD-P-' || v_year || '-' || lpad(v_seq::text, 6, '0');
end;
$$;

create or replace function private.project_is_assignable_pm(p_user_id uuid)
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
      and r.code = 'project_manager'
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
      and (select public.authorize('projects.read'))
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
      and (select public.authorize('projects.read'))
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

create or replace function private.project_sha256(p_value text)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select encode(extensions.digest(convert_to(p_value, 'UTF8'), 'sha256'), 'hex');
$$;

create or replace function private.enforce_project_acceptance_identity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_acceptance public.quotation_acceptances%rowtype;
begin
  select * into v_acceptance
  from public.quotation_acceptances
  where id = NEW.quotation_acceptance_id;

  if v_acceptance.id is null then
    raise exception 'PROJECT_ACCEPTANCE_NOT_FOUND';
  end if;

  if NEW.lead_id is distinct from v_acceptance.lead_id
     or NEW.accepted_quotation_id is distinct from v_acceptance.quotation_id
     or NEW.accepted_quotation_version_id is distinct from v_acceptance.quotation_version_id then
    raise exception 'PROJECT_ACCEPTANCE_IDENTITY_MISMATCH';
  end if;

  return NEW;
end;
$$;

create or replace function private.prevent_project_identity_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if NEW.lead_id is distinct from OLD.lead_id
     or NEW.quotation_acceptance_id is distinct from OLD.quotation_acceptance_id
     or NEW.accepted_quotation_id is distinct from OLD.accepted_quotation_id
     or NEW.accepted_quotation_version_id is distinct from OLD.accepted_quotation_version_id
     or NEW.project_number is distinct from OLD.project_number
     or NEW.created_at is distinct from OLD.created_at
     or NEW.created_by is distinct from OLD.created_by then
    raise exception 'PROJECT_IDENTITY_IMMUTABLE';
  end if;
  return NEW;
end;
$$;

create or replace function private.prevent_project_assignment_mutation()
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
     or NEW.project_manager_id is distinct from OLD.project_manager_id
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

create trigger trg_projects_acceptance_identity
  before insert or update of lead_id, quotation_acceptance_id, accepted_quotation_id, accepted_quotation_version_id
  on public.projects
  for each row execute function private.enforce_project_acceptance_identity();

create trigger trg_projects_identity_immutable
  before update on public.projects
  for each row execute function private.prevent_project_identity_mutation();

create trigger trg_project_manager_assignments_guard
  before update or delete on public.project_manager_assignments
  for each row execute function private.prevent_project_assignment_mutation();

-- ----------------------------------------------------------------------------
-- 4. Canonical materialization
-- ----------------------------------------------------------------------------
create or replace function private.materialize_closed_won_project_impl(
  p_quotation_version_id uuid,
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
  v_acceptance public.quotation_acceptances%rowtype;
  v_lead public.leads%rowtype;
  v_existing public.projects%rowtype;
  v_idempotency private.project_idempotency_requests%rowtype;
  v_request_hash text;
  v_project_id uuid;
  v_project_number text;
  v_replay boolean := false;
  v_response jsonb;
begin
  if p_quotation_version_id is null then
    raise exception 'INVALID_VERSION: quotation_version_id is required.';
  end if;

  if p_actor_kind not in ('system', 'staff') then
    raise exception 'INVALID_ACTOR_KIND';
  end if;

  if p_actor_kind = 'staff' and p_actor_id is null then
    raise exception 'INVALID_ACTOR: staff materialization requires actor_id.';
  end if;

  if p_actor_kind = 'system' and p_actor_id is not null then
    raise exception 'INVALID_ACTOR: system materialization must not supply actor_id.';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  v_request_hash := private.project_sha256(
    'materialize|' || p_quotation_version_id::text || '|' || p_actor_kind
  );

  if p_actor_kind = 'staff' then
    select * into v_idempotency
    from private.project_idempotency_requests
    where actor_kind = 'staff'
      and actor_id = p_actor_id
      and operation_code = 'materialize'
      and idempotency_key = trim(p_idempotency_key);
  else
    select * into v_idempotency
    from private.project_idempotency_requests
    where actor_kind = 'system'
      and operation_code = 'materialize'
      and idempotency_key = trim(p_idempotency_key);
  end if;

  if v_idempotency.id is not null then
    if v_idempotency.request_hash <> v_request_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return v_idempotency.response_snapshot;
  end if;

  select * into v_acceptance
  from public.quotation_acceptances
  where quotation_version_id = p_quotation_version_id
  for update;

  if v_acceptance.id is null then
    raise exception 'ACCEPTANCE_NOT_FOUND: Authoritative quotation acceptance is required.';
  end if;

  select * into v_lead
  from public.leads
  where id = v_acceptance.lead_id
  for update;

  if v_lead.id is null then
    raise exception 'LEAD_NOT_FOUND';
  end if;

  if v_lead.status <> 'closed_won' then
    raise exception 'LEAD_NOT_CLOSED_WON';
  end if;

  if v_acceptance.lead_id is distinct from v_lead.id
     or v_acceptance.quotation_id is null
     or v_acceptance.quotation_version_id is distinct from p_quotation_version_id then
    raise exception 'PROJECT_ACCEPTANCE_IDENTITY_MISMATCH';
  end if;

  select * into v_existing
  from public.projects
  where lead_id = v_acceptance.lead_id
     or quotation_acceptance_id = v_acceptance.id
  for update;

  if v_existing.id is not null then
    if v_existing.lead_id is distinct from v_acceptance.lead_id
       or v_existing.quotation_acceptance_id is distinct from v_acceptance.id
       or v_existing.accepted_quotation_id is distinct from v_acceptance.quotation_id
       or v_existing.accepted_quotation_version_id is distinct from v_acceptance.quotation_version_id then
      raise exception 'PROJECT_IDENTITY_CONFLICT';
    end if;
    v_project_id := v_existing.id;
    v_project_number := v_existing.project_number;
    v_replay := true;
  else
    v_project_number := private.generate_project_number();
    begin
      insert into public.projects (
        lead_id,
        quotation_acceptance_id,
        accepted_quotation_id,
        accepted_quotation_version_id,
        project_number,
        status,
        primary_pm_id,
        handover_accepted_at,
        created_by
      ) values (
        v_acceptance.lead_id,
        v_acceptance.id,
        v_acceptance.quotation_id,
        v_acceptance.quotation_version_id,
        v_project_number,
        'awaiting_project_manager_assignment',
        null,
        null,
        case when p_actor_kind = 'staff' then p_actor_id else null end
      )
      returning id into v_project_id;
    exception
      when unique_violation then
        select * into v_existing
        from public.projects
        where lead_id = v_acceptance.lead_id
           or quotation_acceptance_id = v_acceptance.id;
        if v_existing.id is null then
          raise;
        end if;
        if v_existing.quotation_acceptance_id is distinct from v_acceptance.id
           or v_existing.accepted_quotation_version_id is distinct from v_acceptance.quotation_version_id then
          raise exception 'PROJECT_IDENTITY_CONFLICT';
        end if;
        v_project_id := v_existing.id;
        v_project_number := v_existing.project_number;
        v_replay := true;
    end;

    if v_replay = false then
      insert into public.project_events (
        project_id, lead_id, event_type, actor_kind, actor_id, details
      ) values (
        v_project_id,
        v_acceptance.lead_id,
        'project.created',
        p_actor_kind,
        p_actor_id,
        jsonb_build_object(
          'project_number', v_project_number,
          'quotation_acceptance_id', v_acceptance.id,
          'quotation_version_id', v_acceptance.quotation_version_id
        )
      );
    end if;
  end if;

  select status into v_existing.status from public.projects where id = v_project_id;

  v_response := jsonb_build_object(
    'success', true,
    'project_id', v_project_id,
    'project_number', v_project_number,
    'status', v_existing.status,
    'idempotent_replay', v_replay
  );

  insert into private.project_idempotency_requests (
    actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
  ) values (
    p_actor_kind,
    p_actor_id,
    'materialize',
    trim(p_idempotency_key),
    v_request_hash,
    v_project_id,
    v_response
  );

  return v_response;
end;
$$;

create or replace function public.materialize_closed_won_project_internal(
  p_quotation_version_id uuid,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  return private.materialize_closed_won_project_impl(
    p_quotation_version_id,
    'system',
    null,
    p_idempotency_key
  );
end;
$$;

create or replace function public.repair_closed_won_project_materialization(
  p_quotation_version_id uuid,
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
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = v_actor and status = 'active') then
    raise exception 'INACTIVE_STAFF' using errcode = '42501';
  end if;

  if not ((select private.has_role('super_admin')) or (select private.has_role('sales_manager'))) then
    raise exception 'FORBIDDEN: Only Super Admin or Sales Manager may repair project materialization.' using errcode = '42501';
  end if;

  return private.materialize_closed_won_project_impl(
    p_quotation_version_id,
    'staff',
    v_actor,
    p_idempotency_key
  );
end;
$$;

create or replace function public.list_pending_closed_won_project_materializations()
returns jsonb
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

  if not ((select private.has_role('super_admin')) or (select private.has_role('sales_manager'))) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'quotation_version_id', qa.quotation_version_id,
      'quotation_id', qa.quotation_id,
      'quotation_acceptance_id', qa.id,
      'lead_id', qa.lead_id,
      'quotation_number', q.quotation_number,
      'accepted_at', qa.accepted_at
    ) order by qa.accepted_at desc)
    from public.quotation_acceptances qa
    join public.leads l on l.id = qa.lead_id
    join public.quotations q on q.id = qa.quotation_id
    where l.status = 'closed_won'
      and not exists (
        select 1 from public.projects p where p.quotation_acceptance_id = qa.id
      )
  ), '[]'::jsonb);
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Assign / accept RPCs
-- ----------------------------------------------------------------------------
create or replace function public.can_view_project_handover_baseline(p_project_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select private.project_can_view_handover_baseline(p_project_id);
$$;

create or replace function public.list_assignable_project_managers()
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
      and r.code = 'project_manager'
  ), '[]'::jsonb);
end;
$$;

create or replace function public.assign_project_manager(
  p_project_id uuid,
  p_project_manager_id uuid,
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
  v_current public.project_manager_assignments%rowtype;
  v_idempotency private.project_idempotency_requests%rowtype;
  v_request_hash text;
  v_reason text;
  v_event_type text;
  v_response jsonb;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = v_actor and status = 'active') then
    raise exception 'INACTIVE_STAFF' using errcode = '42501';
  end if;

  if not (select public.authorize('projects.assign_pm')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if not ((select private.has_role('super_admin')) or (select private.has_role('sales_manager'))) then
    raise exception 'FORBIDDEN: Only Super Admin or Sales Manager may assign a project manager.' using errcode = '42501';
  end if;

  if p_project_id is null or p_project_manager_id is null then
    raise exception 'INVALID_INPUT';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if v_reason is not null and length(v_reason) > 240 then
    raise exception 'INVALID_REASON';
  end if;

  if not private.project_is_assignable_pm(p_project_manager_id) then
    raise exception 'INELIGIBLE_PROJECT_MANAGER';
  end if;

  v_request_hash := private.project_sha256(
    'assign_pm|' || p_project_id::text || '|' || p_project_manager_id::text || '|' || coalesce(v_reason, '')
  );

  select * into v_idempotency
  from private.project_idempotency_requests
  where actor_kind = 'staff'
    and actor_id = v_actor
    and operation_code = 'assign_pm'
    and idempotency_key = trim(p_idempotency_key);

  if v_idempotency.id is not null then
    if v_idempotency.request_hash <> v_request_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return v_idempotency.response_snapshot;
  end if;

  select * into v_project
  from public.projects
  where id = p_project_id
  for update;

  if v_project.id is null then
    raise exception 'PROJECT_NOT_FOUND';
  end if;

  if v_project.primary_pm_id is not distinct from p_project_manager_id
     and exists (
       select 1 from public.project_manager_assignments
       where project_id = p_project_id and ended_at is null and project_manager_id = p_project_manager_id
     ) then
    v_response := jsonb_build_object(
      'success', true,
      'project_id', v_project.id,
      'project_manager_id', p_project_manager_id,
      'status', v_project.status,
      'unchanged', true,
      'idempotent_replay', false
    );
    insert into private.project_idempotency_requests (
      actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
    ) values (
      'staff', v_actor, 'assign_pm', trim(p_idempotency_key), v_request_hash, v_project.id, v_response
    );
    return v_response;
  end if;

  if v_project.status not in (
    'awaiting_project_manager_assignment',
    'awaiting_project_manager_acceptance',
    'handover_accepted'
  ) then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;

  select * into v_current
  from public.project_manager_assignments
  where project_id = p_project_id
    and ended_at is null
  for update;

  if v_current.id is not null then
    update public.project_manager_assignments
    set ended_at = now(),
        ended_by = v_actor,
        reason = coalesce(v_reason, 'reassignment')
    where id = v_current.id;
    v_event_type := 'project.pm_reassigned';
  else
    v_event_type := 'project.pm_assigned';
  end if;

  insert into public.project_manager_assignments (
    project_id, project_manager_id, assigned_by, reason
  ) values (
    p_project_id, p_project_manager_id, v_actor, v_reason
  );

  update public.projects
  set primary_pm_id = p_project_manager_id,
      status = 'awaiting_project_manager_acceptance',
      handover_accepted_at = null,
      updated_at = now()
  where id = p_project_id;

  insert into public.project_events (
    project_id, lead_id, event_type, actor_kind, actor_id, details
  ) values (
    p_project_id,
    v_project.lead_id,
    v_event_type,
    'staff',
    v_actor,
    jsonb_build_object(
      'project_manager_id', p_project_manager_id,
      'previous_project_manager_id', v_current.project_manager_id,
      'reason', v_reason
    )
  );

  v_response := jsonb_build_object(
    'success', true,
    'project_id', p_project_id,
    'project_manager_id', p_project_manager_id,
    'status', 'awaiting_project_manager_acceptance',
    'unchanged', false,
    'idempotent_replay', false
  );

  insert into private.project_idempotency_requests (
    actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
  ) values (
    'staff', v_actor, 'assign_pm', trim(p_idempotency_key), v_request_hash, p_project_id, v_response
  );

  return v_response;
end;
$$;

create or replace function public.accept_project_handover(
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
  v_current public.project_manager_assignments%rowtype;
  v_idempotency private.project_idempotency_requests%rowtype;
  v_request_hash text;
  v_response jsonb;
  v_accepted_at timestamptz := now();
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not exists (select 1 from public.profiles where id = v_actor and status = 'active') then
    raise exception 'INACTIVE_STAFF' using errcode = '42501';
  end if;

  if not (select public.authorize('projects.accept_handover')) then
    raise exception 'FORBIDDEN' using errcode = '42501';
  end if;

  if not (select private.has_role('project_manager')) then
    raise exception 'FORBIDDEN: Only the current primary project manager may accept handover.' using errcode = '42501';
  end if;

  if p_project_id is null then
    raise exception 'INVALID_INPUT';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 8 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'INVALID_IDEMPOTENCY_KEY';
  end if;

  v_request_hash := private.project_sha256('accept_handover|' || p_project_id::text || '|' || v_actor::text);

  select * into v_idempotency
  from private.project_idempotency_requests
  where actor_kind = 'staff'
    and actor_id = v_actor
    and operation_code = 'accept_handover'
    and idempotency_key = trim(p_idempotency_key);

  if v_idempotency.id is not null then
    if v_idempotency.request_hash <> v_request_hash then
      raise exception 'IDEMPOTENCY_KEY_REUSED';
    end if;
    return v_idempotency.response_snapshot;
  end if;

  select * into v_project
  from public.projects
  where id = p_project_id
  for update;

  if v_project.id is null then
    raise exception 'PROJECT_NOT_FOUND';
  end if;

  select * into v_current
  from public.project_manager_assignments
  where project_id = p_project_id
    and ended_at is null
  for update;

  if v_project.primary_pm_id is distinct from v_actor
     or v_current.project_manager_id is distinct from v_actor then
    raise exception 'FORBIDDEN: Handover acceptance requires the current primary project manager.' using errcode = '42501';
  end if;

  if v_project.status = 'handover_accepted'
     and v_project.primary_pm_id = v_actor then
    v_response := jsonb_build_object(
      'success', true,
      'project_id', v_project.id,
      'status', 'handover_accepted',
      'handover_accepted_at', v_project.handover_accepted_at,
      'idempotent_replay', true
    );
    insert into private.project_idempotency_requests (
      actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
    ) values (
      'staff', v_actor, 'accept_handover', trim(p_idempotency_key), v_request_hash, v_project.id, v_response
    );
    return v_response;
  end if;

  if v_project.status <> 'awaiting_project_manager_acceptance' then
    raise exception 'PROJECT_INVALID_TRANSITION';
  end if;

  update public.projects
  set status = 'handover_accepted',
      handover_accepted_at = v_accepted_at,
      updated_at = v_accepted_at
  where id = p_project_id;

  insert into public.project_events (
    project_id, lead_id, event_type, actor_kind, actor_id, details
  ) values (
    p_project_id,
    v_project.lead_id,
    'project.handover_accepted',
    'staff',
    v_actor,
    jsonb_build_object('project_manager_id', v_actor)
  );

  v_response := jsonb_build_object(
    'success', true,
    'project_id', p_project_id,
    'status', 'handover_accepted',
    'handover_accepted_at', v_accepted_at,
    'idempotent_replay', false
  );

  insert into private.project_idempotency_requests (
    actor_kind, actor_id, operation_code, idempotency_key, request_hash, project_id, response_snapshot
  ) values (
    'staff', v_actor, 'accept_handover', trim(p_idempotency_key), v_request_hash, p_project_id, v_response
  );

  return v_response;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. RLS / privileges
-- ----------------------------------------------------------------------------
alter table public.projects enable row level security;
alter table public.project_manager_assignments enable row level security;
alter table public.project_events enable row level security;

create policy projects_staff_read on public.projects
  for select to authenticated
  using (private.project_can_view(id));

create policy project_manager_assignments_staff_read on public.project_manager_assignments
  for select to authenticated
  using (private.project_can_view(project_id));

create policy project_events_staff_read on public.project_events
  for select to authenticated
  using (private.project_can_view(project_id));

revoke all on table public.projects from public, anon, authenticated;
revoke all on table public.project_manager_assignments from public, anon, authenticated;
revoke all on table public.project_events from public, anon, authenticated;
revoke all on table private.project_idempotency_requests from public, anon, authenticated;
revoke all on sequence private.project_number_seq from public, anon, authenticated;

grant select on table public.projects to authenticated;
grant select on table public.project_manager_assignments to authenticated;
grant select on table public.project_events to authenticated;

alter function private.generate_project_number() owner to postgres;
alter function private.project_is_assignable_pm(uuid) owner to postgres;
alter function private.project_can_view(uuid) owner to postgres;
alter function private.project_can_view_handover_baseline(uuid) owner to postgres;
alter function private.project_sha256(text) owner to postgres;
alter function private.enforce_project_acceptance_identity() owner to postgres;
alter function private.prevent_project_identity_mutation() owner to postgres;
alter function private.prevent_project_assignment_mutation() owner to postgres;
alter function private.materialize_closed_won_project_impl(uuid, text, uuid, text) owner to postgres;
alter function public.materialize_closed_won_project_internal(uuid, text) owner to postgres;
alter function public.repair_closed_won_project_materialization(uuid, text) owner to postgres;
alter function public.list_pending_closed_won_project_materializations() owner to postgres;
alter function public.can_view_project_handover_baseline(uuid) owner to postgres;
alter function public.list_assignable_project_managers() owner to postgres;
alter function public.assign_project_manager(uuid, uuid, text, text) owner to postgres;
alter function public.accept_project_handover(uuid, text) owner to postgres;

revoke all on function private.generate_project_number() from public, anon, authenticated;
revoke all on function private.project_is_assignable_pm(uuid) from public, anon, authenticated;
revoke all on function private.project_can_view(uuid) from public, anon, authenticated;
revoke all on function private.project_can_view_handover_baseline(uuid) from public, anon, authenticated;
revoke all on function private.project_sha256(text) from public, anon, authenticated;
revoke all on function private.enforce_project_acceptance_identity() from public, anon, authenticated;
revoke all on function private.prevent_project_identity_mutation() from public, anon, authenticated;
revoke all on function private.prevent_project_assignment_mutation() from public, anon, authenticated;
revoke all on function private.materialize_closed_won_project_impl(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function public.materialize_closed_won_project_internal(uuid, text) from public, anon, authenticated;
revoke all on function public.repair_closed_won_project_materialization(uuid, text) from public, anon, authenticated;
revoke all on function public.list_pending_closed_won_project_materializations() from public, anon, authenticated;
revoke all on function public.can_view_project_handover_baseline(uuid) from public, anon, authenticated;
revoke all on function public.list_assignable_project_managers() from public, anon, authenticated;
revoke all on function public.assign_project_manager(uuid, uuid, text, text) from public, anon, authenticated;
revoke all on function public.accept_project_handover(uuid, text) from public, anon, authenticated;

grant execute on function private.project_can_view(uuid) to authenticated;
grant execute on function public.repair_closed_won_project_materialization(uuid, text) to authenticated;
grant execute on function public.list_pending_closed_won_project_materializations() to authenticated;
grant execute on function public.can_view_project_handover_baseline(uuid) to authenticated;
grant execute on function public.list_assignable_project_managers() to authenticated;
grant execute on function public.assign_project_manager(uuid, uuid, text, text) to authenticated;
grant execute on function public.accept_project_handover(uuid, text) to authenticated;
grant execute on function public.materialize_closed_won_project_internal(uuid, text) to service_role;
