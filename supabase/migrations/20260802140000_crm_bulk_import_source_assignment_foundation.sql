-- Phase 5D — CRM bulk import + source-based assignment (migration 15)

-- =============================================================================
-- A. Permissions
-- =============================================================================

insert into public.permissions (code, name, description, is_system, is_active)
values
  (
    'leads.bulk_import',
    'Bulk Import CRM Leads',
    'Create, validate, submit, and process staged lead import batches',
    true,
    true
  ),
  (
    'leads.bulk_import_approve',
    'Approve Lead Import Batches',
    'Approve or reject manager-submitted lead import batches (Super Admin only)',
    true,
    true
  ),
  (
    'leads.assignment_rules.manage',
    'Manage Lead Assignment Rules',
    'Create, update, and disable source-based lead assignment rules (Super Admin only)',
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
where p.code in ('leads.bulk_import', 'leads.bulk_import_approve', 'leads.assignment_rules.manage')
  and (
    (p.code = 'leads.bulk_import' and r.code in ('super_admin', 'sales_manager', 'management'))
    or (p.code = 'leads.bulk_import_approve' and r.code = 'super_admin')
    or (p.code = 'leads.assignment_rules.manage' and r.code = 'super_admin')
  )
on conflict do nothing;

-- =============================================================================
-- B. leads constraint extensions (owner corrections)
-- =============================================================================

alter table public.leads drop constraint if exists chk_leads_source;
alter table public.leads add constraint chk_leads_source check (
  source in ('website-planner', 'local-test', 'manual-crm', 'bulk-import')
);

alter table public.lead_activities drop constraint if exists chk_lead_activities_type;
alter table public.lead_activities add constraint chk_lead_activities_type check (
  activity_type in (
    'note.created',
    'follow_up.scheduled',
    'follow_up.completed',
    'follow_up.cancelled',
    'status.changed',
    'assignment.changed',
    'lead.manual_created',
    'lead.bulk_imported'
  )
);

-- First touchpoint source_detail must be set at insert; table is append-only.
create or replace function private.trg_leads_after_insert_touchpoint()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_detail text;
begin
  v_detail := nullif(trim(current_setting('onedecore.lead_first_touchpoint_source_detail', true)), '');
  insert into public.lead_source_touchpoints (
    lead_id, source_id, touchpoint_kind, occurred_at, source_detail, metadata
  ) values (
    NEW.id,
    NEW.primary_source_id,
    'first',
    NEW.created_at,
    coalesce(v_detail, NEW.source),
    jsonb_build_object('entry_method', NEW.entry_method)
  );
  perform set_config('onedecore.lead_first_touchpoint_source_detail', '', true);
  return NEW;
end;
$$;

-- =============================================================================
-- C. Tables
-- =============================================================================

create table public.lead_import_batches (
  id uuid primary key default gen_random_uuid(),
  client_request_id uuid not null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  status text not null default 'draft',
  approval_kind text,
  validation_revision integer not null default 1,
  original_filename text not null,
  file_sha256 text not null,
  file_type text not null,
  file_size_bytes bigint not null,
  worksheet_name text,
  header_fingerprint text,
  mapping jsonb not null default '{}'::jsonb,
  default_source_id uuid references public.lead_sources (id) on delete restrict,
  total_rows integer not null default 0,
  valid_rows integer not null default 0,
  invalid_rows integer not null default 0,
  duplicate_blocked_rows integer not null default 0,
  importable_rows integer not null default 0,
  imported_rows integer not null default 0,
  failed_rows integer not null default 0,
  submitted_at timestamptz,
  approved_by uuid references public.profiles (id) on delete set null,
  approved_at timestamptz,
  rejected_by uuid references public.profiles (id) on delete set null,
  rejected_at timestamptz,
  rejection_reason text,
  import_started_at timestamptz,
  import_completed_at timestamptz,
  cancelled_by uuid references public.profiles (id) on delete set null,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_lead_import_batches_client_request unique (created_by, client_request_id),
  constraint chk_lead_import_batches_status check (
    status in (
      'draft', 'validation_failed', 'ready_for_review', 'pending_super_admin_approval',
      'approved', 'rejected', 'importing', 'completed', 'completed_with_errors', 'cancelled'
    )
  ),
  constraint chk_lead_import_batches_approval_kind check (
    approval_kind is null or approval_kind in ('manager_submission', 'direct_import')
  ),
  constraint chk_lead_import_batches_validation_revision check (validation_revision >= 1),
  constraint chk_lead_import_batches_filename check (length(trim(original_filename)) between 1 and 255),
  constraint chk_lead_import_batches_file_sha256 check (file_sha256 ~ '^[a-f0-9]{64}$'),
  constraint chk_lead_import_batches_file_type check (file_type in ('csv', 'xlsx')),
  constraint chk_lead_import_batches_file_size check (file_size_bytes > 0 and file_size_bytes <= 5242880),
  constraint chk_lead_import_batches_worksheet check (
    (file_type = 'xlsx' and worksheet_name is not null and length(trim(worksheet_name)) between 1 and 120)
    or (file_type = 'csv' and worksheet_name is null)
  ),
  constraint chk_lead_import_batches_mapping check (
    jsonb_typeof(mapping) = 'object' and pg_column_size(mapping) <= 16384
  ),
  constraint chk_lead_import_batches_counters_nonneg check (
    total_rows >= 0 and valid_rows >= 0 and invalid_rows >= 0
    and duplicate_blocked_rows >= 0 and importable_rows >= 0
    and imported_rows >= 0 and failed_rows >= 0
  ),
  constraint chk_lead_import_batches_rejection_reason check (
    rejection_reason is null or length(trim(rejection_reason)) between 10 and 500
  )
);

comment on table public.lead_import_batches is
  'Staged lead bulk-import batches. Workflow mutations via RPC only; no raw file persistence.';

create index idx_lead_import_batches_creator_status
  on public.lead_import_batches (created_by, status, updated_at desc);
create index idx_lead_import_batches_status_submitted
  on public.lead_import_batches (status, submitted_at);
create index idx_lead_import_batches_file_sha256
  on public.lead_import_batches (file_sha256, created_by);

create trigger trg_lead_import_batches_updated_at
  before update on public.lead_import_batches
  for each row execute function private.set_updated_at();

create table public.lead_import_rows (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.lead_import_batches (id) on delete cascade,
  row_number integer not null,
  submitted_name text not null,
  phone text,
  email text,
  service_code text not null,
  property_code text not null,
  timeline_code text not null,
  primary_source_id uuid references public.lead_sources (id) on delete restrict,
  locality text,
  budget_comfort_code text,
  room_codes text[] not null default '{}'::text[],
  message text,
  source_detail text,
  validation_status text not null default 'pending',
  duplicate_outcome text,
  validation_errors jsonb not null default '[]'::jsonb,
  assignment_rule_id uuid,
  resolved_assignee_id uuid references public.profiles (id) on delete set null,
  assignment_resolution_code text,
  import_status text not null default 'pending',
  lead_id uuid references public.leads (id) on delete restrict,
  import_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_lead_import_rows_batch_row unique (batch_id, row_number),
  constraint chk_lead_import_rows_row_number check (row_number >= 1),
  constraint chk_lead_import_rows_validation_status check (
    validation_status in ('pending', 'valid', 'invalid')
  ),
  constraint chk_lead_import_rows_duplicate_outcome check (
    duplicate_outcome is null or duplicate_outcome in (
      'CLEAR', 'REUSABLE_CONTACT', 'ACTIVE_DUPLICATE', 'RECENT_SIMILAR', 'CONTACT_IDENTITY_CONFLICT'
    )
  ),
  constraint chk_lead_import_rows_validation_errors check (
    jsonb_typeof(validation_errors) = 'array' and jsonb_array_length(validation_errors) <= 20
  ),
  constraint chk_lead_import_rows_assignment_resolution check (
    assignment_resolution_code is null or assignment_resolution_code in (
      'RULE_MATCH', 'NO_MATCH_UNASSIGNED', 'TARGET_INELIGIBLE_UNASSIGNED'
    )
  ),
  constraint chk_lead_import_rows_import_status check (
    import_status in ('pending', 'ready', 'imported', 'failed', 'skipped')
  ),
  constraint chk_lead_import_rows_lead_immutable check (
    lead_id is null or import_status = 'imported'
  )
);

comment on table public.lead_import_rows is
  'Normalized staged import rows. No raw CSV/JSON; validated and processed via RPC.';

create index idx_lead_import_rows_batch_row on public.lead_import_rows (batch_id, row_number);
create index idx_lead_import_rows_batch_import
  on public.lead_import_rows (batch_id, import_status, row_number)
  where import_status = 'ready';

create trigger trg_lead_import_rows_updated_at
  before update on public.lead_import_rows
  for each row execute function private.set_updated_at();

create table public.lead_import_events (
  id uuid primary key default gen_random_uuid(),
  batch_id uuid not null references public.lead_import_batches (id) on delete cascade,
  event_type text not null,
  actor_id uuid references public.profiles (id) on delete set null,
  event_at timestamptz not null default now(),
  metadata jsonb not null default '{}'::jsonb,

  constraint chk_lead_import_events_type check (
    event_type in (
      'batch.created', 'mapping.replaced', 'rows.replaced', 'batch.validated',
      'batch.submitted', 'batch.approved', 'batch.rejected', 'batch.direct_confirmed',
      'batch.cancelled', 'import.started', 'import.chunk_processed', 'import.completed'
    )
  ),
  constraint chk_lead_import_events_metadata check (
    jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 4096
  )
);

comment on table public.lead_import_events is 'Append-only audit stream for import batches.';

create index idx_lead_import_events_batch on public.lead_import_events (batch_id, event_at desc);

create table public.lead_assignment_rules (
  id uuid primary key default gen_random_uuid(),
  source_id uuid not null references public.lead_sources (id) on delete restrict,
  service_code text,
  locality_normalized text,
  budget_comfort_code text,
  target_user_id uuid not null references public.profiles (id) on delete restrict,
  priority integer not null,
  is_active boolean not null default true,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_lead_assignment_rules_signature unique nulls not distinct (
    source_id, service_code, locality_normalized, budget_comfort_code
  ),
  constraint chk_lead_assignment_rules_priority check (priority > 0),
  constraint chk_lead_assignment_rules_service_code check (
    service_code is null or service_code in ('complete-home-interiors', 'modular-kitchens', 'custom-wardrobes')
  ),
  constraint chk_lead_assignment_rules_budget check (
    budget_comfort_code is null or budget_comfort_code in (
      'under-3l', '3-6l', '6-12l', '12-20l', '20-30l', '30l-plus'
    )
  ),
  constraint chk_lead_assignment_rules_locality check (
    locality_normalized is null or length(locality_normalized) between 1 and 120
  )
);

comment on table public.lead_assignment_rules is
  'Source-based assignment rules for bulk import. Resolved by specificity, priority, id.';

create index idx_lead_assignment_rules_resolver
  on public.lead_assignment_rules (source_id, is_active, priority, id);

create trigger trg_lead_assignment_rules_updated_at
  before update on public.lead_assignment_rules
  for each row execute function private.set_updated_at();

alter table public.lead_import_rows
  add constraint fk_lead_import_rows_assignment_rule
  foreign key (assignment_rule_id) references public.lead_assignment_rules (id) on delete set null;

create trigger trg_lead_import_events_no_update
  before update on public.lead_import_events
  for each row execute function private.forbid_append_only_mutation();
create trigger trg_lead_import_events_no_delete
  before delete on public.lead_import_events
  for each row execute function private.forbid_append_only_mutation();

-- =============================================================================
-- D. Private authorization + import helpers
-- =============================================================================

create or replace function private.crm_import_can_view_batch(p_batch_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.lead_import_batches b
    where b.id = p_batch_id
      and (
        (select private.has_role('super_admin'))
        or (
          b.created_by = (select auth.uid())
          and (select public.authorize('leads.bulk_import'))
        )
      )
  );
$$;

create or replace function private.crm_import_assert_batch_access(p_batch_id uuid)
returns public.lead_import_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.lead_import_batches%rowtype;
begin
  if auth.uid() is null then
    raise exception 'CRM_IMPORT_AUTH_REQUIRED' using errcode = '42501';
  end if;

  select * into v_batch
  from public.lead_import_batches
  where id = p_batch_id;

  if not found then
    raise exception 'CRM_IMPORT_BATCH_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not (select private.crm_import_can_view_batch(p_batch_id)) then
    raise exception 'CRM_IMPORT_BATCH_ACCESS_DENIED' using errcode = '42501';
  end if;

  return v_batch;
end;
$$;

create or replace function private.crm_import_assert_batch_editable(p_batch_id uuid)
returns public.lead_import_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.lead_import_batches%rowtype;
begin
  v_batch := private.crm_import_assert_batch_access(p_batch_id);

  if v_batch.status not in ('draft', 'validation_failed', 'ready_for_review') then
    raise exception 'CRM_IMPORT_BATCH_NOT_EDITABLE' using errcode = '22023';
  end if;

  return v_batch;
end;
$$;

create or replace function private.crm_import_is_mapping_field_allowed(p_field text)
returns boolean
language sql
immutable
set search_path = ''
as $$
  select p_field in (
    'submitted_name', 'phone', 'email', 'service_code', 'property_code', 'timeline_code',
    'primary_source_id', 'locality', 'budget_comfort_code', 'room_codes', 'message', 'source_detail'
  );
$$;

create or replace function private.crm_import_validate_mapping(p_mapping jsonb)
returns void
language plpgsql
set search_path = ''
as $$
declare
  v_key text;
  v_val text;
begin
  if p_mapping is null or jsonb_typeof(p_mapping) <> 'object' then
    raise exception 'CRM_IMPORT_INVALID_MAPPING' using errcode = '22023';
  end if;

  for v_key, v_val in select * from jsonb_each_text(p_mapping) loop
    if length(v_key) < 1 or length(v_key) > 120 then
      raise exception 'CRM_IMPORT_INVALID_MAPPING_KEY' using errcode = '22023';
    end if;
    if v_val is null or trim(v_val) = '' then
      continue;
    end if;
    if not (select private.crm_import_is_mapping_field_allowed(v_val)) then
      raise exception 'CRM_IMPORT_INVALID_MAPPING_FIELD' using errcode = '22023';
    end if;
  end loop;
end;
$$;

create or replace function private.crm_import_batch_append_event(
  p_batch_id uuid,
  p_event_type text,
  p_actor_id uuid,
  p_metadata jsonb default '{}'::jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.lead_import_events (batch_id, event_type, actor_id, metadata)
  values (p_batch_id, p_event_type, p_actor_id, coalesce(p_metadata, '{}'::jsonb));
end;
$$;

create or replace function private.crm_evaluate_bulk_import_duplicate(
  p_phone text,
  p_email text,
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
  v_phone text;
  v_email text;
  v_phone_contact uuid;
  v_email_contact uuid;
  v_dup record;
begin
  begin
    v_phone := private.crm_normalize_phone_e164(p_phone);
  exception when others then
    return query select 'INVALID_PHONE'::text, false, false, null::uuid;
    return;
  end;

  begin
    v_email := private.crm_normalize_email(p_email);
  exception when others then
    return query select 'INVALID_EMAIL'::text, false, false, null::uuid;
    return;
  end;

  if v_phone is not null then
    select ch.contact_id into v_phone_contact
    from public.contact_channels ch
    where ch.channel_type = 'phone'
      and ch.status = 'active'
      and ch.address_normalized = v_phone
    limit 1;
  end if;

  if v_email is not null then
    select ch.contact_id into v_email_contact
    from public.contact_channels ch
    where ch.channel_type = 'email'
      and ch.status = 'active'
      and ch.address_normalized = v_email
    limit 1;
  end if;

  if v_phone_contact is not null
    and v_email_contact is not null
    and v_phone_contact is distinct from v_email_contact then
    return query select 'CONTACT_IDENTITY_CONFLICT'::text, false, false, null::uuid;
    return;
  end if;

  if v_phone_contact is null and v_email_contact is null then
    return query select 'CLEAR'::text, true, false, null::uuid;
    return;
  end if;

  select * into v_dup
  from private.crm_evaluate_manual_lead_duplicate(
    coalesce(v_phone_contact, v_email_contact),
    p_service_code,
    p_property_code,
    p_locality
  )
  limit 1;

  return query
  select
    v_dup.outcome_code,
    v_dup.can_create,
    false,
    case
      when private.crm_can_view_lead_by_id(v_dup.existing_lead_id) then v_dup.existing_lead_id
      else null
    end;
end;
$$;

create or replace function private.crm_resolve_lead_assignment_rule(
  p_source_id uuid,
  p_service_code text,
  p_locality text,
  p_budget_comfort_code text
)
returns table (
  matched_rule_id uuid,
  assignee_id uuid,
  resolution_code text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rule record;
  v_locality_norm text;
begin
  v_locality_norm := lower(trim(coalesce(p_locality, '')));
  if v_locality_norm = '' then
    v_locality_norm := null;
  end if;

  select
    r.id,
    r.target_user_id
  into v_rule
  from public.lead_assignment_rules r
  where r.is_active = true
    and r.source_id = p_source_id
    and (r.service_code is null or r.service_code = p_service_code)
    and (r.locality_normalized is null or r.locality_normalized = v_locality_norm)
    and (r.budget_comfort_code is null or r.budget_comfort_code = p_budget_comfort_code)
  order by
    (
      (case when r.service_code is not null then 1 else 0 end)
      + (case when r.locality_normalized is not null then 1 else 0 end)
      + (case when r.budget_comfort_code is not null then 1 else 0 end)
    ) desc,
    r.priority asc,
    r.id asc
  limit 1;

  if v_rule.id is null then
    return query select null::uuid, null::uuid, 'NO_MATCH_UNASSIGNED'::text;
    return;
  end if;

  if (select private.crm_is_assignable_sales_user(v_rule.target_user_id)) then
    return query select v_rule.id, v_rule.target_user_id, 'RULE_MATCH'::text;
    return;
  end if;

  return query select v_rule.id, null::uuid, 'TARGET_INELIGIBLE_UNASSIGNED'::text;
end;
$$;

create or replace function private.crm_import_validate_row(
  p_row public.lead_import_rows,
  p_default_source_id uuid
)
returns public.lead_import_rows
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_errors jsonb := '[]'::jsonb;
  v_name text;
  v_phone text;
  v_email text;
  v_locality text;
  v_source_id uuid;
  v_rooms text[];
  v_dup record;
  v_assign record;
  v_outcome text;
  v_importable boolean := false;
begin
  v_name := nullif(trim(coalesce(p_row.submitted_name, '')), '');
  if v_name is null or length(v_name) < 2 or length(v_name) > 120 then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'field', 'submitted_name', 'code', 'INVALID_NAME', 'message', 'Name must be 2-120 characters'
    ));
  end if;

  begin
    v_phone := private.crm_normalize_phone_e164(p_row.phone);
  exception when others then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'field', 'phone', 'code', 'INVALID_PHONE', 'message', 'Phone must be valid E.164'
    ));
    v_phone := null;
  end;

  begin
    v_email := private.crm_normalize_email(p_row.email);
  exception when others then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'field', 'email', 'code', 'INVALID_EMAIL', 'message', 'Email must be valid'
    ));
    v_email := null;
  end;

  if v_phone is null and v_email is null then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'field', 'phone', 'code', 'CONTACT_REQUIRED', 'message', 'Phone or email required'
    ));
  end if;

  if p_row.service_code not in ('complete-home-interiors', 'modular-kitchens', 'custom-wardrobes') then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'field', 'service_code', 'code', 'INVALID_SERVICE', 'message', 'Invalid service code'
    ));
  end if;

  if p_row.property_code not in (
    'apartment-1bhk', 'apartment-2bhk', 'apartment-3bhk',
    'apartment-4bhk-plus', 'villa-rowhouse', 'single-room'
  ) then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'field', 'property_code', 'code', 'INVALID_PROPERTY', 'message', 'Invalid property code'
    ));
  end if;

  if p_row.timeline_code not in (
    'ready-now', 'within-3-months', '3-6-months', 'more-than-6-months', 'exploring'
  ) then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'field', 'timeline_code', 'code', 'INVALID_TIMELINE', 'message', 'Invalid timeline code'
    ));
  end if;

  v_source_id := coalesce(p_row.primary_source_id, p_default_source_id);
  if v_source_id is null or not exists (
    select 1 from public.lead_sources ls where ls.id = v_source_id and ls.is_active = true
  ) then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'field', 'primary_source_id', 'code', 'INVALID_SOURCE', 'message', 'Active lead source required'
    ));
  end if;

  v_locality := private.crm_normalize_locality(p_row.locality);
  if p_row.locality is not null and length(trim(p_row.locality)) > 120 then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'field', 'locality', 'code', 'INVALID_LOCALITY', 'message', 'Locality max 120 characters'
    ));
  end if;

  if p_row.budget_comfort_code is not null and p_row.budget_comfort_code not in (
    'under-3l', '3-6l', '6-12l', '12-20l', '20-30l', '30l-plus'
  ) then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'field', 'budget_comfort_code', 'code', 'INVALID_BUDGET', 'message', 'Invalid budget code'
    ));
  end if;

  v_rooms := coalesce(p_row.room_codes, '{}'::text[]);
  if cardinality(v_rooms) > 6
    or not (v_rooms <@ array['living', 'kitchen', 'bedrooms', 'wardrobes', 'dining', 'other']::text[]) then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'field', 'room_codes', 'code', 'INVALID_ROOMS', 'message', 'Invalid room codes'
    ));
  end if;

  if p_row.message is not null and length(p_row.message) > 2000 then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'field', 'message', 'code', 'INVALID_MESSAGE', 'message', 'Message max 2000 characters'
    ));
  end if;

  if p_row.source_detail is not null and length(trim(p_row.source_detail)) > 500 then
    v_errors := v_errors || jsonb_build_array(jsonb_build_object(
      'field', 'source_detail', 'code', 'INVALID_SOURCE_DETAIL', 'message', 'Source detail max 500 characters'
    ));
  end if;

  p_row.validation_errors := v_errors;
  p_row.primary_source_id := v_source_id;

  if jsonb_array_length(v_errors) > 0 then
    p_row.validation_status := 'invalid';
    p_row.duplicate_outcome := null;
    p_row.import_status := 'pending';
    p_row.assignment_rule_id := null;
    p_row.resolved_assignee_id := null;
    p_row.assignment_resolution_code := null;
    return p_row;
  end if;

  select * into v_dup
  from private.crm_evaluate_bulk_import_duplicate(
    v_phone, v_email, p_row.service_code, p_row.property_code, v_locality
  )
  limit 1;

  v_outcome := coalesce(v_dup.outcome_code, 'CLEAR');
  p_row.duplicate_outcome := v_outcome;
  p_row.validation_status := 'valid';

  if v_outcome in ('CLEAR', 'REUSABLE_CONTACT') then
    v_importable := true;
    p_row.import_status := 'ready';
  else
    v_importable := false;
    p_row.import_status := 'skipped';
  end if;

  if v_importable and v_source_id is not null then
    select * into v_assign
    from private.crm_resolve_lead_assignment_rule(
      v_source_id, p_row.service_code, v_locality, p_row.budget_comfort_code
    )
    limit 1;

    p_row.assignment_rule_id := v_assign.matched_rule_id;
    p_row.resolved_assignee_id := v_assign.assignee_id;
    p_row.assignment_resolution_code := v_assign.resolution_code;
  end if;

  return p_row;
end;
$$;

create or replace function private.crm_import_batch_recompute_counters(p_batch_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_total integer;
  v_valid integer;
  v_invalid integer;
  v_dup_blocked integer;
  v_importable integer;
  v_imported integer;
  v_failed integer;
begin
  select
    count(*),
    count(*) filter (where validation_status = 'valid'),
    count(*) filter (where validation_status = 'invalid'),
    count(*) filter (
      where validation_status = 'valid'
        and duplicate_outcome in ('ACTIVE_DUPLICATE', 'RECENT_SIMILAR', 'CONTACT_IDENTITY_CONFLICT')
    ),
    count(*) filter (where import_status = 'ready'),
    count(*) filter (where import_status = 'imported'),
    count(*) filter (where import_status = 'failed')
  into v_total, v_valid, v_invalid, v_dup_blocked, v_importable, v_imported, v_failed
  from public.lead_import_rows
  where batch_id = p_batch_id;

  update public.lead_import_batches
  set total_rows = coalesce(v_total, 0),
      valid_rows = coalesce(v_valid, 0),
      invalid_rows = coalesce(v_invalid, 0),
      duplicate_blocked_rows = coalesce(v_dup_blocked, 0),
      importable_rows = coalesce(v_importable, 0),
      imported_rows = coalesce(v_imported, 0),
      failed_rows = coalesce(v_failed, 0),
      updated_at = now()
  where id = p_batch_id;
end;
$$;

create or replace function private.crm_import_batch_transition(
  p_batch_id uuid,
  p_new_status text,
  p_actor_id uuid,
  p_event_type text,
  p_metadata jsonb default '{}'::jsonb,
  p_approval_kind text default null,
  p_rejection_reason text default null
)
returns public.lead_import_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_batch public.lead_import_batches%rowtype;
  v_old text;
begin
  select * into v_batch
  from public.lead_import_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'CRM_IMPORT_BATCH_NOT_FOUND' using errcode = 'P0002';
  end if;

  v_old := v_batch.status;

  if v_old in ('rejected', 'completed', 'completed_with_errors', 'cancelled') then
    raise exception 'CRM_IMPORT_TERMINAL_STATE' using errcode = '22023';
  end if;

  if p_new_status = 'validation_failed' then
    if v_old not in ('draft', 'validation_failed') then
      raise exception 'CRM_IMPORT_INVALID_TRANSITION' using errcode = '22023';
    end if;
  elsif p_new_status = 'ready_for_review' then
    if v_old not in ('draft', 'validation_failed', 'ready_for_review') then
      raise exception 'CRM_IMPORT_INVALID_TRANSITION' using errcode = '22023';
    end if;
  elsif p_new_status = 'draft' then
    if v_old <> 'ready_for_review' then
      raise exception 'CRM_IMPORT_INVALID_TRANSITION' using errcode = '22023';
    end if;
  elsif p_new_status = 'pending_super_admin_approval' then
    if v_old <> 'ready_for_review' then
      raise exception 'CRM_IMPORT_INVALID_TRANSITION' using errcode = '22023';
    end if;
    if v_batch.importable_rows <= 0 then
      raise exception 'CRM_IMPORT_NO_IMPORTABLE_ROWS' using errcode = '22023';
    end if;
    v_batch.submitted_at := now();
  elsif p_new_status = 'approved' then
    if v_old not in ('pending_super_admin_approval', 'ready_for_review') then
      raise exception 'CRM_IMPORT_INVALID_TRANSITION' using errcode = '22023';
    end if;
    if v_batch.importable_rows <= 0 then
      raise exception 'CRM_IMPORT_NO_IMPORTABLE_ROWS' using errcode = '22023';
    end if;
    v_batch.approval_kind := p_approval_kind;
    v_batch.approved_by := p_actor_id;
    v_batch.approved_at := now();
  elsif p_new_status = 'rejected' then
    if v_old <> 'pending_super_admin_approval' then
      raise exception 'CRM_IMPORT_INVALID_TRANSITION' using errcode = '22023';
    end if;
    if p_rejection_reason is null or length(trim(p_rejection_reason)) < 10 or length(trim(p_rejection_reason)) > 500 then
      raise exception 'CRM_IMPORT_REJECTION_REASON_INVALID' using errcode = '22023';
    end if;
    v_batch.rejected_by := p_actor_id;
    v_batch.rejected_at := now();
    v_batch.rejection_reason := trim(p_rejection_reason);
  elsif p_new_status = 'cancelled' then
    if v_old in ('importing', 'completed', 'completed_with_errors', 'approved') then
      raise exception 'CRM_IMPORT_INVALID_TRANSITION' using errcode = '22023';
    end if;
    v_batch.cancelled_by := p_actor_id;
    v_batch.cancelled_at := now();
  elsif p_new_status = 'importing' then
    if v_old <> 'approved' then
      raise exception 'CRM_IMPORT_INVALID_TRANSITION' using errcode = '22023';
    end if;
    v_batch.import_started_at := coalesce(v_batch.import_started_at, now());
  elsif p_new_status in ('completed', 'completed_with_errors') then
    if v_old <> 'importing' then
      raise exception 'CRM_IMPORT_INVALID_TRANSITION' using errcode = '22023';
    end if;
    v_batch.import_completed_at := now();
  else
    raise exception 'CRM_IMPORT_UNKNOWN_STATUS' using errcode = '22023';
  end if;

  v_batch.status := p_new_status;
  v_batch.updated_at := now();

  update public.lead_import_batches
  set status = v_batch.status,
      validation_revision = v_batch.validation_revision,
      submitted_at = v_batch.submitted_at,
      approval_kind = v_batch.approval_kind,
      approved_by = v_batch.approved_by,
      approved_at = v_batch.approved_at,
      rejected_by = v_batch.rejected_by,
      rejected_at = v_batch.rejected_at,
      rejection_reason = v_batch.rejection_reason,
      cancelled_by = v_batch.cancelled_by,
      cancelled_at = v_batch.cancelled_at,
      import_started_at = v_batch.import_started_at,
      import_completed_at = v_batch.import_completed_at,
      updated_at = v_batch.updated_at
  where id = p_batch_id
  returning * into v_batch;

  perform private.crm_import_batch_append_event(
    p_batch_id, p_event_type, p_actor_id,
    jsonb_strip_nulls(coalesce(p_metadata, '{}'::jsonb) || jsonb_build_object('from', v_old, 'to', p_new_status))
  );

  return v_batch;
end;
$$;

create or replace function private.crm_create_imported_lead(
  p_row public.lead_import_rows,
  p_actor_id uuid,
  p_batch_id uuid
)
returns public.leads
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_phone text;
  v_email text;
  v_phone_contact uuid;
  v_email_contact uuid;
  v_contact_id uuid;
  v_assignee uuid;
  v_status text;
  v_lead public.leads%rowtype;
  v_history_id uuid;
  v_locality text;
  v_rooms text[];
  v_source_detail text;
begin
  v_phone := private.crm_normalize_phone_e164(p_row.phone);
  v_email := private.crm_normalize_email(p_row.email);
  v_locality := private.crm_normalize_locality(p_row.locality);
  v_rooms := coalesce(p_row.room_codes, '{}'::text[]);
  v_source_detail := nullif(trim(coalesce(p_row.source_detail, '')), '');
  v_assignee := p_row.resolved_assignee_id;
  v_status := case when v_assignee is null then 'new' else 'assigned' end;

  perform set_config(
    'onedecore.lead_first_touchpoint_source_detail',
    coalesce(v_source_detail, ''),
    true
  );

  perform private.crm_manual_lead_lock_identity(v_phone, v_email);

  if v_phone is not null then
    select ch.contact_id into v_phone_contact
    from public.contact_channels ch
    where ch.channel_type = 'phone' and ch.status = 'active' and ch.address_normalized = v_phone
    limit 1
    for update;
  end if;

  if v_email is not null then
    select ch.contact_id into v_email_contact
    from public.contact_channels ch
    where ch.channel_type = 'email' and ch.status = 'active' and ch.address_normalized = v_email
    limit 1
    for update;
  end if;

  if v_phone_contact is not null and v_email_contact is not null
    and v_phone_contact is distinct from v_email_contact then
    raise exception 'CRM_IMPORT_CONTACT_IDENTITY_CONFLICT' using errcode = 'P0001';
  end if;

  if v_phone_contact is null and v_email_contact is null then
    insert into public.contacts (display_name, status)
    values (trim(p_row.submitted_name), 'active')
    returning id into v_contact_id;

    if v_phone is not null then
      insert into public.contact_channels (contact_id, channel_type, address_normalized, status, is_primary)
      values (v_contact_id, 'phone', v_phone, 'active', true);
    end if;

    if v_email is not null then
      insert into public.contact_channels (contact_id, channel_type, address_normalized, status, is_primary)
      values (
        v_contact_id, 'email', v_email, 'active',
        not exists (
          select 1 from public.contact_channels
          where contact_id = v_contact_id and channel_type = 'email' and status = 'active' and is_primary = true
        )
      );
    end if;
  else
    v_contact_id := coalesce(v_phone_contact, v_email_contact);

    if v_phone is not null and v_phone_contact is null then
      insert into public.contact_channels (contact_id, channel_type, address_normalized, status, is_primary)
      values (v_contact_id, 'phone', v_phone, 'active', true);
    end if;

    if v_email is not null and v_email_contact is null then
      insert into public.contact_channels (contact_id, channel_type, address_normalized, status, is_primary)
      values (
        v_contact_id, 'email', v_email, 'active',
        not exists (
          select 1 from public.contact_channels
          where contact_id = v_contact_id and channel_type = 'email' and status = 'active' and is_primary = true
        )
      );
    end if;
  end if;

  insert into public.leads (
    contact_id,
    submitted_name,
    submitted_email,
    status,
    source,
    service_code,
    property_code,
    timeline_code,
    room_codes,
    budget_comfort_code,
    locality,
    message,
    primary_source_id,
    entry_method,
    assigned_to,
    planner_version,
    landing_path,
    attribution
  ) values (
    v_contact_id,
    trim(p_row.submitted_name),
    v_email,
    v_status,
    'bulk-import',
    p_row.service_code,
    p_row.property_code,
    p_row.timeline_code,
    v_rooms,
    p_row.budget_comfort_code,
    v_locality,
    nullif(trim(coalesce(p_row.message, '')), ''),
    p_row.primary_source_id,
    'import',
    v_assignee,
    null,
    null,
    jsonb_build_object('importBatchId', p_batch_id, 'importRowId', p_row.id)
  )
  returning * into v_lead;

  insert into public.lead_events (lead_id, event_type, actor_id, actor_type, event_data)
  values (
    v_lead.id,
    'lead.created',
    p_actor_id,
    'staff',
    jsonb_strip_nulls(jsonb_build_object(
      'entryMethod', 'import',
      'source', 'bulk-import',
      'importBatchId', p_batch_id,
      'importRowId', p_row.id,
      'reusedContact', (v_phone_contact is not null or v_email_contact is not null),
      'assignmentState', v_status
    ))
  );

  insert into public.lead_activities (lead_id, activity_type, reference_id, actor_id, summary, metadata)
  values (
    v_lead.id,
    'lead.bulk_imported',
    p_row.id,
    p_actor_id,
    'Lead imported from bulk batch',
    jsonb_strip_nulls(jsonb_build_object(
      'importBatchId', p_batch_id,
      'importRowId', p_row.id,
      'duplicateOutcome', p_row.duplicate_outcome
    ))
  );

  if v_assignee is not null then
    insert into public.lead_assignment_history (
      lead_id, previous_assignee, new_assignee, assignment_method, actor_id, reason, metadata
    ) values (
      v_lead.id, null, v_assignee, 'source_rule', p_actor_id, null,
      jsonb_build_object(
        'importBatchId', p_batch_id,
        'importRowId', p_row.id,
        'assignmentRuleId', p_row.assignment_rule_id,
        'resolutionCode', p_row.assignment_resolution_code
      )
    )
    returning id into v_history_id;

    insert into public.lead_events (lead_id, event_type, actor_id, actor_type, event_data)
    values (
      v_lead.id,
      'lead.assigned',
      p_actor_id,
      'staff',
      jsonb_build_object(
        'assigneeId', v_assignee,
        'method', 'source_rule',
        'onCreate', true,
        'importBatchId', p_batch_id
      )
    );

    insert into public.lead_activities (lead_id, activity_type, reference_id, actor_id, summary, metadata)
    values (
      v_lead.id,
      'assignment.changed',
      v_history_id,
      p_actor_id,
      'Lead assigned via source rule',
      jsonb_build_object(
        'newAssignee', v_assignee,
        'method', 'source_rule',
        'onCreate', true,
        'assignmentRuleId', p_row.assignment_rule_id
      )
    );
  end if;

  return v_lead;
end;
$$;

create or replace function private.crm_import_process_row(
  p_row_id uuid,
  p_batch_id uuid,
  p_actor_id uuid
)
returns public.lead_import_rows
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.lead_import_rows%rowtype;
  v_batch public.lead_import_batches%rowtype;
  v_validated public.lead_import_rows;
  v_dup record;
  v_assign record;
  v_lead public.leads%rowtype;
begin
  select * into v_row
  from public.lead_import_rows
  where id = p_row_id and batch_id = p_batch_id
  for update;

  if not found then
    raise exception 'CRM_IMPORT_ROW_NOT_FOUND' using errcode = 'P0002';
  end if;

  if v_row.lead_id is not null then
    return v_row;
  end if;

  if v_row.import_status <> 'ready' then
    raise exception 'CRM_IMPORT_ROW_NOT_READY' using errcode = '22023';
  end if;

  select * into v_batch
  from public.lead_import_batches
  where id = p_batch_id;

  v_validated := private.crm_import_validate_row(v_row, v_batch.default_source_id);

  if v_validated.validation_status <> 'valid'
    or v_validated.duplicate_outcome not in ('CLEAR', 'REUSABLE_CONTACT') then
    update public.lead_import_rows
    set validation_status = v_validated.validation_status,
        duplicate_outcome = v_validated.duplicate_outcome,
        validation_errors = v_validated.validation_errors,
        import_status = 'failed',
        import_error_code = coalesce(v_validated.duplicate_outcome, 'VALIDATION_FAILED'),
        updated_at = now()
    where id = p_row_id
    returning * into v_row;
    return v_row;
  end if;

  select * into v_dup
  from private.crm_evaluate_bulk_import_duplicate(
    v_row.phone, v_row.email, v_row.service_code, v_row.property_code, v_row.locality
  )
  limit 1;

  if coalesce(v_dup.outcome_code, 'CLEAR') not in ('CLEAR', 'REUSABLE_CONTACT') then
    update public.lead_import_rows
    set duplicate_outcome = v_dup.outcome_code,
        import_status = 'failed',
        import_error_code = v_dup.outcome_code,
        updated_at = now()
    where id = p_row_id
    returning * into v_row;
    return v_row;
  end if;

  select * into v_assign
  from private.crm_resolve_lead_assignment_rule(
    v_validated.primary_source_id,
    v_row.service_code,
    v_row.locality,
    v_row.budget_comfort_code
  )
  limit 1;

  v_validated.assignment_rule_id := v_assign.matched_rule_id;
  v_validated.resolved_assignee_id := v_assign.assignee_id;
  v_validated.assignment_resolution_code := v_assign.resolution_code;

  v_lead := private.crm_create_imported_lead(v_validated, p_actor_id, p_batch_id);

  update public.lead_import_rows
  set assignment_rule_id = v_validated.assignment_rule_id,
      resolved_assignee_id = v_validated.resolved_assignee_id,
      assignment_resolution_code = v_validated.assignment_resolution_code,
      duplicate_outcome = v_dup.outcome_code,
      import_status = 'imported',
      lead_id = v_lead.id,
      import_error_code = null,
      updated_at = now()
  where id = p_row_id
  returning * into v_row;

  return v_row;
end;
$$;

-- =============================================================================
-- E. Public RPC implementations (private DEFINER + public INVOKER)
-- =============================================================================

create or replace function private.create_lead_import_batch_impl(
  p_client_request_id uuid,
  p_original_filename text,
  p_file_sha256 text,
  p_file_type text,
  p_file_size_bytes bigint,
  p_worksheet_name text default null,
  p_header_fingerprint text default null,
  p_default_source_id uuid default null
)
returns public.lead_import_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_batch public.lead_import_batches%rowtype;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'CRM_IMPORT_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not (select public.authorize('leads.bulk_import')) then
    raise exception 'CRM_IMPORT_PERMISSION_DENIED' using errcode = '42501';
  end if;

  if p_client_request_id is null then
    raise exception 'CRM_IMPORT_CLIENT_REQUEST_REQUIRED' using errcode = '22023';
  end if;

  select * into v_batch
  from public.lead_import_batches
  where created_by = v_actor and client_request_id = p_client_request_id;

  if found then
    return v_batch;
  end if;

  if p_file_sha256 !~ '^[a-f0-9]{64}$' then
    raise exception 'CRM_IMPORT_INVALID_FILE_SHA256' using errcode = '22023';
  end if;

  if p_file_type not in ('csv', 'xlsx') then
    raise exception 'CRM_IMPORT_INVALID_FILE_TYPE' using errcode = '22023';
  end if;

  if p_file_size_bytes is null or p_file_size_bytes <= 0 or p_file_size_bytes > 5242880 then
    raise exception 'CRM_IMPORT_INVALID_FILE_SIZE' using errcode = '22023';
  end if;

  if p_file_type = 'xlsx' and nullif(trim(coalesce(p_worksheet_name, '')), '') is null then
    raise exception 'CRM_IMPORT_WORKSHEET_REQUIRED' using errcode = '22023';
  end if;

  if p_default_source_id is not null and not exists (
    select 1 from public.lead_sources ls where ls.id = p_default_source_id and ls.is_active = true
  ) then
    raise exception 'CRM_IMPORT_INVALID_DEFAULT_SOURCE' using errcode = '22023';
  end if;

  insert into public.lead_import_batches (
    client_request_id, created_by, original_filename, file_sha256, file_type,
    file_size_bytes, worksheet_name, header_fingerprint, default_source_id
  ) values (
    p_client_request_id, v_actor, trim(p_original_filename), lower(p_file_sha256), p_file_type,
    p_file_size_bytes,
    case when p_file_type = 'xlsx' then trim(p_worksheet_name) else null end,
    p_header_fingerprint,
    p_default_source_id
  )
  returning * into v_batch;

  perform private.crm_import_batch_append_event(
    v_batch.id, 'batch.created', v_actor,
    jsonb_build_object('fileType', p_file_type, 'fileSizeBytes', p_file_size_bytes)
  );

  return v_batch;
end;
$$;

create or replace function private.replace_lead_import_mapping_impl(
  p_batch_id uuid,
  p_mapping jsonb,
  p_default_source_id uuid default null
)
returns public.lead_import_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_batch public.lead_import_batches%rowtype;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'CRM_IMPORT_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not (select public.authorize('leads.bulk_import')) then
    raise exception 'CRM_IMPORT_PERMISSION_DENIED' using errcode = '42501';
  end if;

  v_batch := private.crm_import_assert_batch_editable(p_batch_id);
  perform private.crm_import_validate_mapping(p_mapping);

  if p_default_source_id is not null and not exists (
    select 1 from public.lead_sources ls where ls.id = p_default_source_id and ls.is_active = true
  ) then
    raise exception 'CRM_IMPORT_INVALID_DEFAULT_SOURCE' using errcode = '22023';
  end if;

  if v_batch.status = 'ready_for_review' then
    v_batch := private.crm_import_batch_transition(
      p_batch_id, 'draft', v_actor, 'mapping.replaced',
      jsonb_build_object('action', 'edit_from_ready_for_review')
    );
  end if;

  update public.lead_import_batches
  set mapping = p_mapping,
      default_source_id = p_default_source_id,
      validation_revision = validation_revision + 1,
      updated_at = now()
  where id = p_batch_id
  returning * into v_batch;

  perform private.crm_import_batch_append_event(
    p_batch_id, 'mapping.replaced', v_actor,
    jsonb_build_object('validationRevision', v_batch.validation_revision)
  );

  return v_batch;
end;
$$;

create or replace function private.replace_lead_import_rows_impl(
  p_batch_id uuid,
  p_rows jsonb
)
returns public.lead_import_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_batch public.lead_import_batches%rowtype;
  v_row jsonb;
  v_count integer;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'CRM_IMPORT_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not (select public.authorize('leads.bulk_import')) then
    raise exception 'CRM_IMPORT_PERMISSION_DENIED' using errcode = '42501';
  end if;

  v_batch := private.crm_import_assert_batch_editable(p_batch_id);

  if p_rows is null or jsonb_typeof(p_rows) <> 'array' then
    raise exception 'CRM_IMPORT_INVALID_ROWS_PAYLOAD' using errcode = '22023';
  end if;

  v_count := jsonb_array_length(p_rows);
  if v_count < 1 or v_count > 1000 then
    raise exception 'CRM_IMPORT_ROW_COUNT_OUT_OF_BOUNDS' using errcode = '22023';
  end if;

  if v_batch.status = 'ready_for_review' then
    perform private.crm_import_batch_transition(
      p_batch_id, 'draft', v_actor, 'rows.replaced',
      jsonb_build_object('action', 'edit_from_ready_for_review')
    );
  end if;

  delete from public.lead_import_rows where batch_id = p_batch_id;

  for v_row in select * from jsonb_array_elements(p_rows) loop
    insert into public.lead_import_rows (
      batch_id,
      row_number,
      submitted_name,
      phone,
      email,
      service_code,
      property_code,
      timeline_code,
      primary_source_id,
      locality,
      budget_comfort_code,
      room_codes,
      message,
      source_detail
    ) values (
      p_batch_id,
      (v_row->>'row_number')::integer,
      coalesce(v_row->>'submitted_name', ''),
      v_row->>'phone',
      v_row->>'email',
      coalesce(v_row->>'service_code', ''),
      coalesce(v_row->>'property_code', ''),
      coalesce(v_row->>'timeline_code', ''),
      nullif(v_row->>'primary_source_id', '')::uuid,
      v_row->>'locality',
      v_row->>'budget_comfort_code',
      coalesce(
        (select array_agg(value::text) from jsonb_array_elements_text(coalesce(v_row->'room_codes', '[]'::jsonb))),
        '{}'::text[]
      ),
      v_row->>'message',
      v_row->>'source_detail'
    );
  end loop;

  update public.lead_import_batches
  set validation_revision = validation_revision + 1,
      updated_at = now()
  where id = p_batch_id
  returning * into v_batch;

  perform private.crm_import_batch_recompute_counters(p_batch_id);

  select * into v_batch from public.lead_import_batches where id = p_batch_id;

  perform private.crm_import_batch_append_event(
    p_batch_id, 'rows.replaced', v_actor,
    jsonb_build_object('rowCount', v_count, 'validationRevision', v_batch.validation_revision)
  );

  return v_batch;
end;
$$;

create or replace function private.validate_lead_import_batch_impl(
  p_batch_id uuid
)
returns public.lead_import_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_batch public.lead_import_batches%rowtype;
  v_row public.lead_import_rows%rowtype;
  v_validated public.lead_import_rows;
  v_new_status text;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'CRM_IMPORT_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not (select public.authorize('leads.bulk_import')) then
    raise exception 'CRM_IMPORT_PERMISSION_DENIED' using errcode = '42501';
  end if;

  v_batch := private.crm_import_assert_batch_access(p_batch_id);

  if v_batch.status not in ('draft', 'validation_failed', 'ready_for_review') then
    raise exception 'CRM_IMPORT_BATCH_NOT_VALIDATABLE' using errcode = '22023';
  end if;

  for v_row in
    select * from public.lead_import_rows where batch_id = p_batch_id order by row_number
  loop
    v_validated := private.crm_import_validate_row(v_row, v_batch.default_source_id);

    update public.lead_import_rows
    set validation_status = v_validated.validation_status,
        duplicate_outcome = v_validated.duplicate_outcome,
        validation_errors = v_validated.validation_errors,
        primary_source_id = v_validated.primary_source_id,
        assignment_rule_id = v_validated.assignment_rule_id,
        resolved_assignee_id = v_validated.resolved_assignee_id,
        assignment_resolution_code = v_validated.assignment_resolution_code,
        import_status = v_validated.import_status,
        updated_at = now()
    where id = v_row.id;
  end loop;

  perform private.crm_import_batch_recompute_counters(p_batch_id);

  select * into v_batch from public.lead_import_batches where id = p_batch_id;

  if v_batch.invalid_rows > 0 then
    v_new_status := 'validation_failed';
  else
    v_new_status := 'ready_for_review';
  end if;

  update public.lead_import_batches
  set status = v_new_status,
      updated_at = now()
  where id = p_batch_id
  returning * into v_batch;

  perform private.crm_import_batch_append_event(
    p_batch_id, 'batch.validated', v_actor,
    jsonb_build_object(
      'validationRevision', v_batch.validation_revision,
      'totalRows', v_batch.total_rows,
      'validRows', v_batch.valid_rows,
      'invalidRows', v_batch.invalid_rows,
      'importableRows', v_batch.importable_rows,
      'duplicateBlockedRows', v_batch.duplicate_blocked_rows,
      'status', v_batch.status
    )
  );

  return v_batch;
end;
$$;

create or replace function private.submit_lead_import_batch_impl(
  p_batch_id uuid,
  p_expected_revision integer
)
returns public.lead_import_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_batch public.lead_import_batches%rowtype;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'CRM_IMPORT_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not (select public.authorize('leads.bulk_import')) then
    raise exception 'CRM_IMPORT_PERMISSION_DENIED' using errcode = '42501';
  end if;

  v_batch := private.crm_import_assert_batch_access(p_batch_id);

  if v_batch.validation_revision is distinct from p_expected_revision then
    raise exception 'CRM_IMPORT_STALE_REVISION' using errcode = '22023';
  end if;

  if v_batch.status <> 'ready_for_review' then
    raise exception 'CRM_IMPORT_BATCH_NOT_SUBMITTABLE' using errcode = '22023';
  end if;

  return private.crm_import_batch_transition(
    p_batch_id,
    'pending_super_admin_approval',
    v_actor,
    'batch.submitted',
    jsonb_build_object('validationRevision', v_batch.validation_revision)
  );
end;
$$;

create or replace function private.approve_lead_import_batch_impl(
  p_batch_id uuid,
  p_expected_revision integer
)
returns public.lead_import_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_batch public.lead_import_batches%rowtype;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'CRM_IMPORT_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not (select public.authorize('leads.bulk_import_approve')) then
    raise exception 'CRM_IMPORT_APPROVE_DENIED' using errcode = '42501';
  end if;

  v_batch := private.crm_import_assert_batch_access(p_batch_id);

  if v_batch.validation_revision is distinct from p_expected_revision then
    raise exception 'CRM_IMPORT_STALE_REVISION' using errcode = '22023';
  end if;

  if v_batch.status <> 'pending_super_admin_approval' then
    raise exception 'CRM_IMPORT_BATCH_NOT_APPROVABLE' using errcode = '22023';
  end if;

  if v_batch.created_by = v_actor then
    raise exception 'CRM_IMPORT_APPROVER_CANNOT_BE_CREATOR' using errcode = '42501';
  end if;

  return private.crm_import_batch_transition(
    p_batch_id,
    'approved',
    v_actor,
    'batch.approved',
    jsonb_build_object('validationRevision', v_batch.validation_revision),
    'manager_submission'
  );
end;
$$;

create or replace function private.reject_lead_import_batch_impl(
  p_batch_id uuid,
  p_expected_revision integer,
  p_rejection_reason text
)
returns public.lead_import_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_batch public.lead_import_batches%rowtype;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'CRM_IMPORT_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not (select public.authorize('leads.bulk_import_approve')) then
    raise exception 'CRM_IMPORT_APPROVE_DENIED' using errcode = '42501';
  end if;

  v_batch := private.crm_import_assert_batch_access(p_batch_id);

  if v_batch.validation_revision is distinct from p_expected_revision then
    raise exception 'CRM_IMPORT_STALE_REVISION' using errcode = '22023';
  end if;

  if v_batch.status <> 'pending_super_admin_approval' then
    raise exception 'CRM_IMPORT_BATCH_NOT_REJECTABLE' using errcode = '22023';
  end if;

  return private.crm_import_batch_transition(
    p_batch_id,
    'rejected',
    v_actor,
    'batch.rejected',
    jsonb_build_object('validationRevision', v_batch.validation_revision),
    null,
    p_rejection_reason
  );
end;
$$;

create or replace function private.confirm_lead_import_batch_direct_impl(
  p_batch_id uuid,
  p_expected_revision integer
)
returns public.lead_import_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_batch public.lead_import_batches%rowtype;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'CRM_IMPORT_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not (select public.authorize('leads.bulk_import')) then
    raise exception 'CRM_IMPORT_PERMISSION_DENIED' using errcode = '42501';
  end if;

  if not (select private.has_role('super_admin')) then
    raise exception 'CRM_IMPORT_DIRECT_CONFIRM_SA_ONLY' using errcode = '42501';
  end if;

  v_batch := private.crm_import_assert_batch_access(p_batch_id);

  if v_batch.validation_revision is distinct from p_expected_revision then
    raise exception 'CRM_IMPORT_STALE_REVISION' using errcode = '22023';
  end if;

  if v_batch.status <> 'ready_for_review' then
    raise exception 'CRM_IMPORT_BATCH_NOT_CONFIRMABLE' using errcode = '22023';
  end if;

  return private.crm_import_batch_transition(
    p_batch_id,
    'approved',
    v_actor,
    'batch.direct_confirmed',
    jsonb_build_object('validationRevision', v_batch.validation_revision),
    'direct_import'
  );
end;
$$;

create or replace function private.cancel_lead_import_batch_impl(
  p_batch_id uuid
)
returns public.lead_import_batches
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_batch public.lead_import_batches%rowtype;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'CRM_IMPORT_AUTH_REQUIRED' using errcode = '42501';
  end if;

  v_batch := private.crm_import_assert_batch_access(p_batch_id);

  if not (
    (select public.authorize('leads.bulk_import'))
    or (select private.has_role('super_admin'))
  ) then
    raise exception 'CRM_IMPORT_PERMISSION_DENIED' using errcode = '42501';
  end if;

  if v_batch.status in (
    'importing', 'completed', 'completed_with_errors', 'approved', 'rejected', 'cancelled'
  ) then
    raise exception 'CRM_IMPORT_BATCH_NOT_CANCELLABLE' using errcode = '22023';
  end if;

  if v_batch.created_by <> v_actor and not (select private.has_role('super_admin')) then
    raise exception 'CRM_IMPORT_CANCEL_DENIED' using errcode = '42501';
  end if;

  return private.crm_import_batch_transition(
    p_batch_id,
    'cancelled',
    v_actor,
    'batch.cancelled',
    jsonb_build_object('validationRevision', v_batch.validation_revision)
  );
end;
$$;

create or replace function private.process_lead_import_batch_impl(
  p_batch_id uuid,
  p_expected_revision integer,
  p_max_rows integer default 100
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_batch public.lead_import_batches%rowtype;
  v_row record;
  v_limit integer;
  v_processed integer := 0;
  v_imported integer := 0;
  v_failed integer := 0;
  v_skipped integer := 0;
  v_remaining integer;
  v_done boolean;
  v_final_status text;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'CRM_IMPORT_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not (
    (select public.authorize('leads.bulk_import'))
    or (select private.has_role('super_admin'))
  ) then
    raise exception 'CRM_IMPORT_PERMISSION_DENIED' using errcode = '42501';
  end if;

  v_limit := greatest(1, least(coalesce(p_max_rows, 100), 100));

  select * into v_batch
  from public.lead_import_batches
  where id = p_batch_id
  for update;

  if not found then
    raise exception 'CRM_IMPORT_BATCH_NOT_FOUND' using errcode = 'P0002';
  end if;

  if not (select private.crm_import_can_view_batch(p_batch_id)) then
    raise exception 'CRM_IMPORT_BATCH_ACCESS_DENIED' using errcode = '42501';
  end if;

  if v_batch.validation_revision is distinct from p_expected_revision then
    raise exception 'CRM_IMPORT_STALE_REVISION' using errcode = '22023';
  end if;

  if v_batch.status = 'approved' then
    v_batch := private.crm_import_batch_transition(
      p_batch_id, 'importing', v_actor, 'import.started',
      jsonb_build_object('validationRevision', v_batch.validation_revision)
    );
  elsif v_batch.status <> 'importing' then
    raise exception 'CRM_IMPORT_BATCH_NOT_PROCESSABLE' using errcode = '22023';
  end if;

  for v_row in
    select r.id
    from public.lead_import_rows r
    where r.batch_id = p_batch_id
      and r.import_status = 'ready'
    order by r.row_number
    limit v_limit
  loop
    v_processed := v_processed + 1;
    begin
      perform private.crm_import_process_row(v_row.id, p_batch_id, v_actor);
      if (select import_status from public.lead_import_rows where id = v_row.id) = 'imported' then
        v_imported := v_imported + 1;
      else
        v_failed := v_failed + 1;
      end if;
    exception when others then
      update public.lead_import_rows
      set import_status = 'failed',
          import_error_code = 'IMPORT_ROW_EXCEPTION',
          updated_at = now()
      where id = v_row.id
        and lead_id is null;
      v_failed := v_failed + 1;
    end;
  end loop;

  perform private.crm_import_batch_recompute_counters(p_batch_id);

  select count(*) into v_remaining
  from public.lead_import_rows
  where batch_id = p_batch_id
    and import_status = 'ready';

  v_done := v_remaining = 0;

  if v_done then
    select failed_rows into v_failed
    from public.lead_import_batches
    where id = p_batch_id;

    if coalesce(v_failed, 0) > 0 then
      v_final_status := 'completed_with_errors';
    else
      v_final_status := 'completed';
    end if;

    v_batch := private.crm_import_batch_transition(
      p_batch_id,
      v_final_status,
      v_actor,
      'import.completed',
      jsonb_build_object('processed', v_processed, 'imported', v_imported, 'failed', v_failed)
    );
  else
    perform private.crm_import_batch_append_event(
      p_batch_id,
      'import.chunk_processed',
      v_actor,
      jsonb_build_object('processed', v_processed, 'imported', v_imported, 'failed', v_failed, 'remaining', v_remaining)
    );
    select * into v_batch from public.lead_import_batches where id = p_batch_id;
  end if;

  return jsonb_build_object(
    'processed', v_processed,
    'imported', v_imported,
    'failed', v_failed,
    'skipped', v_skipped,
    'batch_status', v_batch.status,
    'done', v_done
  );
end;
$$;

create or replace function private.create_lead_assignment_rule_impl(
  p_source_id uuid,
  p_target_user_id uuid,
  p_priority integer,
  p_service_code text default null,
  p_locality text default null,
  p_budget_comfort_code text default null
)
returns public.lead_assignment_rules
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_row public.lead_assignment_rules%rowtype;
  v_locality_norm text;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'CRM_ASSIGNMENT_RULE_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not (select public.authorize('leads.assignment_rules.manage')) then
    raise exception 'CRM_ASSIGNMENT_RULE_PERMISSION_DENIED' using errcode = '42501';
  end if;

  if not exists (
    select 1 from public.lead_sources ls where ls.id = p_source_id and ls.is_active = true
  ) then
    raise exception 'CRM_ASSIGNMENT_RULE_INVALID_SOURCE' using errcode = '22023';
  end if;

  if not (select private.crm_is_assignable_sales_user(p_target_user_id)) then
    raise exception 'CRM_ASSIGNMENT_RULE_INVALID_TARGET' using errcode = '22023';
  end if;

  if p_priority is null or p_priority <= 0 then
    raise exception 'CRM_ASSIGNMENT_RULE_INVALID_PRIORITY' using errcode = '22023';
  end if;

  v_locality_norm := lower(trim(coalesce(p_locality, '')));
  if v_locality_norm = '' then
    v_locality_norm := null;
  end if;

  insert into public.lead_assignment_rules (
    source_id, service_code, locality_normalized, budget_comfort_code,
    target_user_id, priority, created_by, updated_by
  ) values (
    p_source_id, p_service_code, v_locality_norm, p_budget_comfort_code,
    p_target_user_id, p_priority, v_actor, v_actor
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function private.update_lead_assignment_rule_impl(
  p_rule_id uuid,
  p_target_user_id uuid default null,
  p_priority integer default null,
  p_service_code text default null,
  p_locality text default null,
  p_budget_comfort_code text default null
)
returns public.lead_assignment_rules
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_row public.lead_assignment_rules%rowtype;
  v_locality_norm text;
  v_locality_provided boolean := p_locality is not null;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'CRM_ASSIGNMENT_RULE_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not (select public.authorize('leads.assignment_rules.manage')) then
    raise exception 'CRM_ASSIGNMENT_RULE_PERMISSION_DENIED' using errcode = '42501';
  end if;

  select * into v_row from public.lead_assignment_rules where id = p_rule_id;
  if not found then
    raise exception 'CRM_ASSIGNMENT_RULE_NOT_FOUND' using errcode = 'P0002';
  end if;

  if p_target_user_id is not null
    and not (select private.crm_is_assignable_sales_user(p_target_user_id)) then
    raise exception 'CRM_ASSIGNMENT_RULE_INVALID_TARGET' using errcode = '22023';
  end if;

  if p_priority is not null and p_priority <= 0 then
    raise exception 'CRM_ASSIGNMENT_RULE_INVALID_PRIORITY' using errcode = '22023';
  end if;

  if v_locality_provided then
    v_locality_norm := lower(trim(p_locality));
    if v_locality_norm = '' then
      v_locality_norm := null;
    end if;
  else
    v_locality_norm := v_row.locality_normalized;
  end if;

  update public.lead_assignment_rules
  set target_user_id = coalesce(p_target_user_id, target_user_id),
      priority = coalesce(p_priority, priority),
      service_code = coalesce(p_service_code, service_code),
      locality_normalized = v_locality_norm,
      budget_comfort_code = coalesce(p_budget_comfort_code, budget_comfort_code),
      updated_by = v_actor,
      updated_at = now()
  where id = p_rule_id
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function private.set_lead_assignment_rule_active_impl(
  p_rule_id uuid,
  p_is_active boolean
)
returns public.lead_assignment_rules
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_row public.lead_assignment_rules%rowtype;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'CRM_ASSIGNMENT_RULE_AUTH_REQUIRED' using errcode = '42501';
  end if;

  if not (select public.authorize('leads.assignment_rules.manage')) then
    raise exception 'CRM_ASSIGNMENT_RULE_PERMISSION_DENIED' using errcode = '42501';
  end if;

  update public.lead_assignment_rules
  set is_active = coalesce(p_is_active, false),
      updated_by = v_actor,
      updated_at = now()
  where id = p_rule_id
  returning * into v_row;

  if not found then
    raise exception 'CRM_ASSIGNMENT_RULE_NOT_FOUND' using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

-- Public INVOKER wrappers

create or replace function public.create_lead_import_batch(
  p_client_request_id uuid,
  p_original_filename text,
  p_file_sha256 text,
  p_file_type text,
  p_file_size_bytes bigint,
  p_worksheet_name text default null,
  p_header_fingerprint text default null,
  p_default_source_id uuid default null
)
returns public.lead_import_batches
language sql
security invoker
set search_path = ''
as $$
  select private.create_lead_import_batch_impl(
    p_client_request_id, p_original_filename, p_file_sha256, p_file_type,
    p_file_size_bytes, p_worksheet_name, p_header_fingerprint, p_default_source_id
  );
$$;

create or replace function public.replace_lead_import_mapping(
  p_batch_id uuid,
  p_mapping jsonb,
  p_default_source_id uuid default null
)
returns public.lead_import_batches
language sql
security invoker
set search_path = ''
as $$
  select private.replace_lead_import_mapping_impl(p_batch_id, p_mapping, p_default_source_id);
$$;

create or replace function public.replace_lead_import_rows(
  p_batch_id uuid,
  p_rows jsonb
)
returns public.lead_import_batches
language sql
security invoker
set search_path = ''
as $$
  select private.replace_lead_import_rows_impl(p_batch_id, p_rows);
$$;

create or replace function public.validate_lead_import_batch(p_batch_id uuid)
returns public.lead_import_batches
language sql
security invoker
set search_path = ''
as $$
  select private.validate_lead_import_batch_impl(p_batch_id);
$$;

create or replace function public.submit_lead_import_batch(
  p_batch_id uuid,
  p_expected_revision integer
)
returns public.lead_import_batches
language sql
security invoker
set search_path = ''
as $$
  select private.submit_lead_import_batch_impl(p_batch_id, p_expected_revision);
$$;

create or replace function public.approve_lead_import_batch(
  p_batch_id uuid,
  p_expected_revision integer
)
returns public.lead_import_batches
language sql
security invoker
set search_path = ''
as $$
  select private.approve_lead_import_batch_impl(p_batch_id, p_expected_revision);
$$;

create or replace function public.reject_lead_import_batch(
  p_batch_id uuid,
  p_expected_revision integer,
  p_rejection_reason text
)
returns public.lead_import_batches
language sql
security invoker
set search_path = ''
as $$
  select private.reject_lead_import_batch_impl(p_batch_id, p_expected_revision, p_rejection_reason);
$$;

create or replace function public.confirm_lead_import_batch_direct(
  p_batch_id uuid,
  p_expected_revision integer
)
returns public.lead_import_batches
language sql
security invoker
set search_path = ''
as $$
  select private.confirm_lead_import_batch_direct_impl(p_batch_id, p_expected_revision);
$$;

create or replace function public.cancel_lead_import_batch(p_batch_id uuid)
returns public.lead_import_batches
language sql
security invoker
set search_path = ''
as $$
  select private.cancel_lead_import_batch_impl(p_batch_id);
$$;

create or replace function public.process_lead_import_batch(
  p_batch_id uuid,
  p_expected_revision integer,
  p_max_rows integer default 100
)
returns jsonb
language sql
security invoker
set search_path = ''
as $$
  select private.process_lead_import_batch_impl(p_batch_id, p_expected_revision, p_max_rows);
$$;

create or replace function public.create_lead_assignment_rule(
  p_source_id uuid,
  p_target_user_id uuid,
  p_priority integer,
  p_service_code text default null,
  p_locality text default null,
  p_budget_comfort_code text default null
)
returns public.lead_assignment_rules
language sql
security invoker
set search_path = ''
as $$
  select private.create_lead_assignment_rule_impl(
    p_source_id, p_target_user_id, p_priority, p_service_code, p_locality, p_budget_comfort_code
  );
$$;

create or replace function public.update_lead_assignment_rule(
  p_rule_id uuid,
  p_target_user_id uuid default null,
  p_priority integer default null,
  p_service_code text default null,
  p_locality text default null,
  p_budget_comfort_code text default null
)
returns public.lead_assignment_rules
language sql
security invoker
set search_path = ''
as $$
  select private.update_lead_assignment_rule_impl(
    p_rule_id, p_target_user_id, p_priority, p_service_code, p_locality, p_budget_comfort_code
  );
$$;

create or replace function public.set_lead_assignment_rule_active(
  p_rule_id uuid,
  p_is_active boolean
)
returns public.lead_assignment_rules
language sql
security invoker
set search_path = ''
as $$
  select private.set_lead_assignment_rule_active_impl(p_rule_id, p_is_active);
$$;

-- =============================================================================
-- F. RLS + table ACL hardening
-- =============================================================================

alter table public.lead_import_batches enable row level security;
alter table public.lead_import_rows enable row level security;
alter table public.lead_import_events enable row level security;
alter table public.lead_assignment_rules enable row level security;

revoke all on table public.lead_import_batches from public, anon, authenticated;
revoke all on table public.lead_import_rows from public, anon, authenticated;
revoke all on table public.lead_import_events from public, anon, authenticated;
revoke all on table public.lead_assignment_rules from public, anon, authenticated;

grant select on table public.lead_import_batches to authenticated;
grant select on table public.lead_import_rows to authenticated;
grant select on table public.lead_import_events to authenticated;
grant select on table public.lead_assignment_rules to authenticated;

create policy lead_import_batches_select
  on public.lead_import_batches for select to authenticated
  using ((select private.crm_import_can_view_batch(id)));

create policy lead_import_rows_select
  on public.lead_import_rows for select to authenticated
  using ((select private.crm_import_can_view_batch(batch_id)));

create policy lead_import_events_select
  on public.lead_import_events for select to authenticated
  using ((select private.crm_import_can_view_batch(batch_id)));

create policy lead_assignment_rules_select
  on public.lead_assignment_rules for select to authenticated
  using ((select public.authorize('leads.assignment_rules.manage')));

-- =============================================================================
-- G. Ownership, grants, revokes
-- =============================================================================

alter function private.crm_import_can_view_batch(uuid) owner to postgres;
alter function private.crm_import_assert_batch_access(uuid) owner to postgres;
alter function private.crm_import_assert_batch_editable(uuid) owner to postgres;
alter function private.crm_import_is_mapping_field_allowed(text) owner to postgres;
alter function private.crm_import_validate_mapping(jsonb) owner to postgres;
alter function private.crm_import_batch_append_event(uuid, text, uuid, jsonb) owner to postgres;
alter function private.crm_evaluate_bulk_import_duplicate(text, text, text, text, text) owner to postgres;
alter function private.crm_resolve_lead_assignment_rule(uuid, text, text, text) owner to postgres;
alter function private.crm_import_validate_row(public.lead_import_rows, uuid) owner to postgres;
alter function private.crm_import_batch_recompute_counters(uuid) owner to postgres;
alter function private.crm_import_batch_transition(uuid, text, uuid, text, jsonb, text, text) owner to postgres;
alter function private.crm_create_imported_lead(public.lead_import_rows, uuid, uuid) owner to postgres;
alter function private.crm_import_process_row(uuid, uuid, uuid) owner to postgres;
alter function private.create_lead_import_batch_impl(uuid, text, text, text, bigint, text, text, uuid) owner to postgres;
alter function private.replace_lead_import_mapping_impl(uuid, jsonb, uuid) owner to postgres;
alter function private.replace_lead_import_rows_impl(uuid, jsonb) owner to postgres;
alter function private.validate_lead_import_batch_impl(uuid) owner to postgres;
alter function private.submit_lead_import_batch_impl(uuid, integer) owner to postgres;
alter function private.approve_lead_import_batch_impl(uuid, integer) owner to postgres;
alter function private.reject_lead_import_batch_impl(uuid, integer, text) owner to postgres;
alter function private.confirm_lead_import_batch_direct_impl(uuid, integer) owner to postgres;
alter function private.cancel_lead_import_batch_impl(uuid) owner to postgres;
alter function private.process_lead_import_batch_impl(uuid, integer, integer) owner to postgres;
alter function private.create_lead_assignment_rule_impl(uuid, uuid, integer, text, text, text) owner to postgres;
alter function private.update_lead_assignment_rule_impl(uuid, uuid, integer, text, text, text) owner to postgres;
alter function private.set_lead_assignment_rule_active_impl(uuid, boolean) owner to postgres;

alter function public.create_lead_import_batch(uuid, text, text, text, bigint, text, text, uuid) owner to postgres;
alter function public.replace_lead_import_mapping(uuid, jsonb, uuid) owner to postgres;
alter function public.replace_lead_import_rows(uuid, jsonb) owner to postgres;
alter function public.validate_lead_import_batch(uuid) owner to postgres;
alter function public.submit_lead_import_batch(uuid, integer) owner to postgres;
alter function public.approve_lead_import_batch(uuid, integer) owner to postgres;
alter function public.reject_lead_import_batch(uuid, integer, text) owner to postgres;
alter function public.confirm_lead_import_batch_direct(uuid, integer) owner to postgres;
alter function public.cancel_lead_import_batch(uuid) owner to postgres;
alter function public.process_lead_import_batch(uuid, integer, integer) owner to postgres;
alter function public.create_lead_assignment_rule(uuid, uuid, integer, text, text, text) owner to postgres;
alter function public.update_lead_assignment_rule(uuid, uuid, integer, text, text, text) owner to postgres;
alter function public.set_lead_assignment_rule_active(uuid, boolean) owner to postgres;

revoke all on function private.crm_import_can_view_batch(uuid) from public, anon;
revoke all on function private.crm_import_assert_batch_access(uuid) from public, anon;
revoke all on function private.crm_import_assert_batch_editable(uuid) from public, anon;
revoke all on function private.crm_import_is_mapping_field_allowed(text) from public, anon;
revoke all on function private.crm_import_validate_mapping(jsonb) from public, anon;
revoke all on function private.crm_import_batch_append_event(uuid, text, uuid, jsonb) from public, anon;
revoke all on function private.crm_evaluate_bulk_import_duplicate(text, text, text, text, text) from public, anon;
revoke all on function private.crm_resolve_lead_assignment_rule(uuid, text, text, text) from public, anon;
revoke all on function private.crm_import_validate_row(public.lead_import_rows, uuid) from public, anon;
revoke all on function private.crm_import_batch_recompute_counters(uuid) from public, anon;
revoke all on function private.crm_import_batch_transition(uuid, text, uuid, text, jsonb, text, text) from public, anon;
revoke all on function private.crm_create_imported_lead(public.lead_import_rows, uuid, uuid) from public, anon;
revoke all on function private.crm_import_process_row(uuid, uuid, uuid) from public, anon;
revoke all on function private.create_lead_import_batch_impl(uuid, text, text, text, bigint, text, text, uuid) from public, anon;
revoke all on function private.replace_lead_import_mapping_impl(uuid, jsonb, uuid) from public, anon;
revoke all on function private.replace_lead_import_rows_impl(uuid, jsonb) from public, anon;
revoke all on function private.validate_lead_import_batch_impl(uuid) from public, anon;
revoke all on function private.submit_lead_import_batch_impl(uuid, integer) from public, anon;
revoke all on function private.approve_lead_import_batch_impl(uuid, integer) from public, anon;
revoke all on function private.reject_lead_import_batch_impl(uuid, integer, text) from public, anon;
revoke all on function private.confirm_lead_import_batch_direct_impl(uuid, integer) from public, anon;
revoke all on function private.cancel_lead_import_batch_impl(uuid) from public, anon;
revoke all on function private.process_lead_import_batch_impl(uuid, integer, integer) from public, anon;
revoke all on function private.create_lead_assignment_rule_impl(uuid, uuid, integer, text, text, text) from public, anon;
revoke all on function private.update_lead_assignment_rule_impl(uuid, uuid, integer, text, text, text) from public, anon;
revoke all on function private.set_lead_assignment_rule_active_impl(uuid, boolean) from public, anon;

grant execute on function private.crm_import_can_view_batch(uuid) to authenticated;
grant execute on function private.crm_import_assert_batch_access(uuid) to authenticated;
grant execute on function private.crm_import_assert_batch_editable(uuid) to authenticated;
grant execute on function private.create_lead_import_batch_impl(uuid, text, text, text, bigint, text, text, uuid) to authenticated;
grant execute on function private.replace_lead_import_mapping_impl(uuid, jsonb, uuid) to authenticated;
grant execute on function private.replace_lead_import_rows_impl(uuid, jsonb) to authenticated;
grant execute on function private.validate_lead_import_batch_impl(uuid) to authenticated;
grant execute on function private.submit_lead_import_batch_impl(uuid, integer) to authenticated;
grant execute on function private.approve_lead_import_batch_impl(uuid, integer) to authenticated;
grant execute on function private.reject_lead_import_batch_impl(uuid, integer, text) to authenticated;
grant execute on function private.confirm_lead_import_batch_direct_impl(uuid, integer) to authenticated;
grant execute on function private.cancel_lead_import_batch_impl(uuid) to authenticated;
grant execute on function private.process_lead_import_batch_impl(uuid, integer, integer) to authenticated;
grant execute on function private.create_lead_assignment_rule_impl(uuid, uuid, integer, text, text, text) to authenticated;
grant execute on function private.update_lead_assignment_rule_impl(uuid, uuid, integer, text, text, text) to authenticated;
grant execute on function private.set_lead_assignment_rule_active_impl(uuid, boolean) to authenticated;

revoke all on function public.create_lead_import_batch(uuid, text, text, text, bigint, text, text, uuid) from public, anon;
revoke all on function public.replace_lead_import_mapping(uuid, jsonb, uuid) from public, anon;
revoke all on function public.replace_lead_import_rows(uuid, jsonb) from public, anon;
revoke all on function public.validate_lead_import_batch(uuid) from public, anon;
revoke all on function public.submit_lead_import_batch(uuid, integer) from public, anon;
revoke all on function public.approve_lead_import_batch(uuid, integer) from public, anon;
revoke all on function public.reject_lead_import_batch(uuid, integer, text) from public, anon;
revoke all on function public.confirm_lead_import_batch_direct(uuid, integer) from public, anon;
revoke all on function public.cancel_lead_import_batch(uuid) from public, anon;
revoke all on function public.process_lead_import_batch(uuid, integer, integer) from public, anon;
revoke all on function public.create_lead_assignment_rule(uuid, uuid, integer, text, text, text) from public, anon;
revoke all on function public.update_lead_assignment_rule(uuid, uuid, integer, text, text, text) from public, anon;
revoke all on function public.set_lead_assignment_rule_active(uuid, boolean) from public, anon;

grant execute on function public.create_lead_import_batch(uuid, text, text, text, bigint, text, text, uuid) to authenticated;
grant execute on function public.replace_lead_import_mapping(uuid, jsonb, uuid) to authenticated;
grant execute on function public.replace_lead_import_rows(uuid, jsonb) to authenticated;
grant execute on function public.validate_lead_import_batch(uuid) to authenticated;
grant execute on function public.submit_lead_import_batch(uuid, integer) to authenticated;
grant execute on function public.approve_lead_import_batch(uuid, integer) to authenticated;
grant execute on function public.reject_lead_import_batch(uuid, integer, text) to authenticated;
grant execute on function public.confirm_lead_import_batch_direct(uuid, integer) to authenticated;
grant execute on function public.cancel_lead_import_batch(uuid) to authenticated;
grant execute on function public.process_lead_import_batch(uuid, integer, integer) to authenticated;
grant execute on function public.create_lead_assignment_rule(uuid, uuid, integer, text, text, text) to authenticated;
grant execute on function public.update_lead_assignment_rule(uuid, uuid, integer, text, text, text) to authenticated;
grant execute on function public.set_lead_assignment_rule_active(uuid, boolean) to authenticated;
