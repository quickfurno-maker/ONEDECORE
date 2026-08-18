-- ============================================================================
-- M32 Migration: ONEDECORE Phase 9B Landing Page Lab & Experimentation
-- Architecture: ADR-0029 / DEC-0081 / OD9B-1..OD9B-12
-- Forward-only. Does not rewrite M1-M31. Must NOT be applied to managed in this gate.
-- No production activation. No Phase 9C provider execution.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Permissions (canonical five-role grants: SA/SM only)
-- ----------------------------------------------------------------------------
insert into public.permissions (code, name, description, is_system, is_active) values
  ('landing_pages.read', 'Read landing pages', 'Read Landing Lab pages, versions, and publications', true, true),
  ('landing_pages.manage', 'Manage landing pages', 'Create and edit landing page drafts and versions', true, true),
  ('landing_pages.publish', 'Publish landing pages', 'Transition landing publications (live/pause/resume/archive)', true, true),
  ('landing_experiments.manage', 'Manage landing experiments', 'Configure, start, and conclude landing experiments', true, true),
  ('landing_analytics.read', 'Read landing analytics', 'Read privacy-safe landing exposure and outcome analytics', true, true)
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
  and p.code in (
    'landing_pages.read',
    'landing_pages.manage',
    'landing_pages.publish',
    'landing_experiments.manage',
    'landing_analytics.read'
  )
  and r.code in ('super_admin', 'sales_manager')
on conflict (role_id, permission_id) do nothing;

-- ----------------------------------------------------------------------------
-- 2. Sequences and tables
-- ----------------------------------------------------------------------------
create sequence private.landing_page_reference_seq start with 1 increment by 1;
create sequence private.landing_publication_reference_seq start with 1 increment by 1;
create sequence private.landing_experiment_reference_seq start with 1 increment by 1;

create table public.landing_pages (
  id uuid primary key default gen_random_uuid(),
  page_reference text not null unique,
  slug text not null unique,
  title text not null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_landing_pages_reference_format check (page_reference ~ '^OD-LP-[0-9]{4}-[0-9]{6}$'),
  constraint chk_landing_pages_slug check (
    slug ~ '^[a-z0-9]+(?:-[a-z0-9]+)*$'
    and char_length(slug) between 2 and 120
  ),
  constraint chk_landing_pages_title check (length(trim(title)) between 2 and 160)
);

comment on table public.landing_pages is
  'Phase 9B stable landing identity. Publication lifecycle lives on landing_publications, not here.';

create table public.landing_page_versions (
  id uuid primary key default gen_random_uuid(),
  landing_page_id uuid not null references public.landing_pages (id) on delete restrict,
  version_number integer not null,
  label text not null,
  blocks jsonb not null,
  content_hash text null,
  frozen_at timestamptz null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lock_version integer not null default 1,
  constraint uq_landing_page_versions_number unique (landing_page_id, version_number),
  constraint chk_landing_page_versions_number check (version_number between 1 and 9999),
  constraint chk_landing_page_versions_label check (length(trim(label)) between 1 and 120),
  constraint chk_landing_page_versions_lock check (lock_version >= 1),
  constraint chk_landing_page_versions_blocks check (
    jsonb_typeof(blocks) = 'array'
    and pg_column_size(blocks) <= 65536
  ),
  constraint chk_landing_page_versions_hash check (
    content_hash is null or content_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint chk_landing_page_versions_frozen_hash check (
    (frozen_at is null and content_hash is null)
    or (frozen_at is not null and content_hash is not null)
  )
);

comment on table public.landing_page_versions is
  'Phase 9B versioned structured blocks. Frozen versions are immutable. No arbitrary HTML.';

create table public.landing_publications (
  id uuid primary key default gen_random_uuid(),
  publication_reference text not null unique,
  landing_page_id uuid not null references public.landing_pages (id) on delete restrict,
  landing_page_version_id uuid not null references public.landing_page_versions (id) on delete restrict,
  status text not null default 'draft',
  campaign_reference text null,
  campaign_version_number integer null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  published_at timestamptz null,
  paused_at timestamptz null,
  archived_at timestamptz null,
  lock_version integer not null default 1,
  constraint chk_landing_publications_reference_format check (
    publication_reference ~ '^OD-LP-PUB-[0-9]{4}-[0-9]{6}$'
  ),
  constraint chk_landing_publications_status check (
    status in ('draft', 'live', 'paused', 'archived')
  ),
  constraint chk_landing_publications_no_scheduled check (status <> 'scheduled'),
  constraint chk_landing_publications_lock check (lock_version >= 1),
  constraint chk_landing_publications_campaign_ref check (
    campaign_reference is null or campaign_reference ~ '^OD-C-[0-9]{4}-[0-9]{6}$'
  ),
  constraint chk_landing_publications_campaign_pair check (
    (campaign_reference is null and campaign_version_number is null)
    or (campaign_reference is not null and campaign_version_number >= 1)
  )
);

comment on table public.landing_publications is
  'Phase 9B publication authority. Status graph draft|live|paused|archived. Opaque campaign snapshot; no M31 FK.';

create unique index uq_landing_publications_one_live_per_page
  on public.landing_publications (landing_page_id)
  where status = 'live';

create table public.landing_experiments (
  id uuid primary key default gen_random_uuid(),
  experiment_reference text not null unique,
  publication_id uuid not null references public.landing_publications (id) on delete restrict,
  status text not null default 'draft',
  winner_variant_key text null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  started_by uuid null references public.profiles (id) on delete restrict,
  started_at timestamptz null,
  concluded_by uuid null references public.profiles (id) on delete restrict,
  concluded_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_landing_experiments_reference_format check (
    experiment_reference ~ '^OD-LP-EXP-[0-9]{4}-[0-9]{6}$'
  ),
  constraint chk_landing_experiments_status check (status in ('draft', 'running', 'concluded')),
  constraint chk_landing_experiments_winner check (
    (status <> 'concluded' and winner_variant_key is null)
    or (status = 'concluded' and winner_variant_key is not null)
  )
);

comment on table public.landing_experiments is
  'Phase 9B A/B/C experiments. Human winner only. No adaptive optimizer.';

create unique index uq_landing_experiments_one_running_per_publication
  on public.landing_experiments (publication_id)
  where status = 'running';

create unique index uq_landing_experiments_one_draft_per_publication
  on public.landing_experiments (publication_id)
  where status = 'draft';

create table public.landing_experiment_variants (
  id uuid primary key default gen_random_uuid(),
  experiment_id uuid not null references public.landing_experiments (id) on delete restrict,
  variant_key text not null,
  landing_page_version_id uuid not null references public.landing_page_versions (id) on delete restrict,
  allocation_percent integer not null,
  label text not null,
  created_at timestamptz not null default now(),
  constraint uq_landing_experiment_variants_key unique (experiment_id, variant_key),
  constraint chk_landing_experiment_variants_key check (variant_key ~ '^[a-z0-9][a-z0-9_-]{1,31}$'),
  constraint chk_landing_experiment_variants_allocation check (allocation_percent between 1 and 99),
  constraint chk_landing_experiment_variants_label check (length(trim(label)) between 1 and 80)
);

create table public.landing_exposures (
  id uuid primary key default gen_random_uuid(),
  publication_id uuid not null references public.landing_publications (id) on delete restrict,
  experiment_id uuid null references public.landing_experiments (id) on delete restrict,
  variant_key text null,
  visitor_key_hash text not null,
  assignment_epoch text not null,
  first_exposed_at timestamptz not null default now(),
  created_at timestamptz not null default now(),
  experiment_id_key uuid generated always as (
    coalesce(experiment_id, '00000000-0000-0000-0000-000000000000'::uuid)
  ) stored,
  variant_key_norm text generated always as (coalesce(variant_key, '')) stored,
  constraint chk_landing_exposures_hash check (visitor_key_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_landing_exposures_epoch check (assignment_epoch ~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$'),
  constraint chk_landing_exposures_variant_key check (
    variant_key is null or variant_key ~ '^[a-z0-9][a-z0-9_-]{1,31}$'
  ),
  constraint uq_landing_exposures_unique_denom unique (
    publication_id, experiment_id_key, variant_key_norm, visitor_key_hash, assignment_epoch
  )
);

comment on table public.landing_exposures is
  'Privacy-safe unique exposure denominator. Stores HMAC visitor hash only. No IP/PII/raw cookie.';

create table private.landing_lab_idempotency_requests (
  actor_id uuid not null references public.profiles (id) on delete restrict,
  operation text not null,
  idempotency_key uuid not null,
  request_hash text not null,
  response_snapshot jsonb null,
  created_at timestamptz not null default now(),
  primary key (actor_id, operation, idempotency_key),
  constraint chk_landing_lab_idempotency_operation check (length(trim(operation)) between 1 and 64),
  constraint chk_landing_lab_idempotency_hash check (request_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_landing_lab_idempotency_response check (
    response_snapshot is null
    or (jsonb_typeof(response_snapshot) = 'object' and pg_column_size(response_snapshot) <= 8192)
  )
);

comment on table private.landing_lab_idempotency_requests is
  'Private Phase 9B retry-safe mutation ledger. Not a public business table.';

-- ----------------------------------------------------------------------------
-- 3. Triggers
-- ----------------------------------------------------------------------------
create or replace function private.touch_landing_lab_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.forbid_landing_page_identity_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.page_reference is distinct from old.page_reference
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'LANDING_PAGE_IDENTITY_IMMUTABLE' using errcode = '22023';
  end if;
  return new;
end;
$$;

create or replace function private.forbid_frozen_landing_version_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'LANDING_VERSION_DELETE_DENIED' using errcode = '22023';
  end if;
  if old.frozen_at is not null then
    if new.landing_page_id is distinct from old.landing_page_id
       or new.version_number is distinct from old.version_number
       or new.label is distinct from old.label
       or new.blocks is distinct from old.blocks
       or new.content_hash is distinct from old.content_hash
       or new.frozen_at is distinct from old.frozen_at
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at then
      raise exception 'LANDING_VERSION_FROZEN' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.enforce_landing_publication_transitions()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'LANDING_PUBLICATION_DELETE_DENIED' using errcode = '22023';
  end if;
  if new.publication_reference is distinct from old.publication_reference
     or new.landing_page_id is distinct from old.landing_page_id
     or new.landing_page_version_id is distinct from old.landing_page_version_id
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'LANDING_PUBLICATION_IDENTITY_IMMUTABLE' using errcode = '22023';
  end if;
  if old.status = 'archived' and new.status is distinct from old.status then
    raise exception 'LANDING_PUBLICATION_ARCHIVED_TERMINAL' using errcode = '22023';
  end if;
  if new.status = 'scheduled' or old.status = 'scheduled' then
    raise exception 'LANDING_PUBLICATION_SCHEDULED_DENIED' using errcode = '22023';
  end if;
  if new.status is distinct from old.status then
    if not (
      (old.status = 'draft' and new.status in ('live', 'archived'))
      or (old.status = 'live' and new.status in ('paused', 'archived'))
      or (old.status = 'paused' and new.status in ('live', 'archived'))
    ) then
      raise exception 'LANDING_PUBLICATION_INVALID_TRANSITION' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.forbid_running_or_concluded_experiment_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'LANDING_EXPERIMENT_DELETE_DENIED' using errcode = '22023';
  end if;
  if old.status = 'concluded' then
    raise exception 'LANDING_EXPERIMENT_CONCLUDED_TERMINAL' using errcode = '22023';
  end if;
  if old.status = 'running' then
    if new.publication_id is distinct from old.publication_id
       or new.experiment_reference is distinct from old.experiment_reference
       or new.created_by is distinct from old.created_by
       or new.created_at is distinct from old.created_at
       or new.started_by is distinct from old.started_by
       or new.started_at is distinct from old.started_at then
      raise exception 'LANDING_EXPERIMENT_RUNNING_IMMUTABLE' using errcode = '22023';
    end if;
    if new.status not in ('running', 'concluded') then
      raise exception 'LANDING_EXPERIMENT_RUNNING_IMMUTABLE' using errcode = '22023';
    end if;
  end if;
  return new;
end;
$$;

create or replace function private.forbid_experiment_variant_mutation_when_locked()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_status text;
begin
  select e.status into v_status
  from public.landing_experiments e
  where e.id = coalesce(new.experiment_id, old.experiment_id);

  if v_status in ('running', 'concluded') then
    raise exception 'LANDING_EXPERIMENT_VARIANTS_LOCKED' using errcode = '22023';
  end if;
  return coalesce(new, old);
end;
$$;

create or replace function private.forbid_landing_exposure_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'landing_exposures is append-only' using errcode = '22023';
end;
$$;

create or replace function private.forbid_landing_lab_hard_delete()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'LANDING_LAB_DELETE_DENIED' using errcode = '22023';
end;
$$;

create trigger trg_landing_pages_touch_updated_at
  before update on public.landing_pages
  for each row execute function private.touch_landing_lab_updated_at();

create trigger trg_landing_pages_identity_immutable
  before update on public.landing_pages
  for each row execute function private.forbid_landing_page_identity_mutation();

create trigger trg_landing_pages_no_delete
  before delete on public.landing_pages
  for each row execute function private.forbid_landing_lab_hard_delete();

create trigger trg_landing_page_versions_touch_updated_at
  before update on public.landing_page_versions
  for each row execute function private.touch_landing_lab_updated_at();

create trigger trg_landing_page_versions_frozen
  before update or delete on public.landing_page_versions
  for each row execute function private.forbid_frozen_landing_version_mutation();

create trigger trg_landing_publications_touch_updated_at
  before update on public.landing_publications
  for each row execute function private.touch_landing_lab_updated_at();

create trigger trg_landing_publications_transitions
  before update or delete on public.landing_publications
  for each row execute function private.enforce_landing_publication_transitions();

create trigger trg_landing_experiments_touch_updated_at
  before update on public.landing_experiments
  for each row execute function private.touch_landing_lab_updated_at();

create trigger trg_landing_experiments_locked
  before update or delete on public.landing_experiments
  for each row execute function private.forbid_running_or_concluded_experiment_mutation();

create trigger trg_landing_experiment_variants_locked
  before insert or update or delete on public.landing_experiment_variants
  for each row execute function private.forbid_experiment_variant_mutation_when_locked();

create trigger trg_landing_exposures_append_only
  before update or delete on public.landing_exposures
  for each row execute function private.forbid_landing_exposure_mutation();

-- ----------------------------------------------------------------------------
-- 4. Private helpers
-- ----------------------------------------------------------------------------
create or replace function private.landing_lab_sha256(p_value text)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select encode(extensions.digest(convert_to(p_value, 'UTF8'), 'sha256'), 'hex');
$$;

create or replace function private.landing_lab_idempotency_xact_lock(
  p_actor_id uuid,
  p_operation text,
  p_idempotency_key uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_hash text;
begin
  v_hash := private.landing_lab_sha256(
    coalesce(p_actor_id::text, '') || '|' || coalesce(p_operation, '') || '|' || coalesce(p_idempotency_key::text, '')
  );
  perform pg_catalog.pg_advisory_xact_lock(('x' || substr(v_hash, 1, 16))::bit(64)::bigint);
end;
$$;

create or replace function private.landing_lab_idempotency_lookup(
  p_actor_id uuid,
  p_operation text,
  p_idempotency_key uuid,
  p_request_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row private.landing_lab_idempotency_requests%rowtype;
begin
  select * into v_row
  from private.landing_lab_idempotency_requests
  where actor_id = p_actor_id
    and operation = p_operation
    and idempotency_key = p_idempotency_key;

  if not found then
    return null;
  end if;

  if v_row.request_hash is distinct from p_request_hash then
    raise exception 'IDEMPOTENCY_KEY_REUSED' using errcode = '22023';
  end if;

  return v_row.response_snapshot;
end;
$$;

create or replace function private.landing_lab_idempotency_store(
  p_actor_id uuid,
  p_operation text,
  p_idempotency_key uuid,
  p_request_hash text,
  p_response jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into private.landing_lab_idempotency_requests (
    actor_id, operation, idempotency_key, request_hash, response_snapshot
  ) values (
    p_actor_id, p_operation, p_idempotency_key, p_request_hash, p_response
  );
end;
$$;

create or replace function private.generate_landing_page_reference()
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
  v_seq := nextval('private.landing_page_reference_seq');
  return 'OD-LP-' || v_year || '-' || lpad(v_seq::text, 6, '0');
end;
$$;

create or replace function private.generate_landing_publication_reference()
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
  v_seq := nextval('private.landing_publication_reference_seq');
  return 'OD-LP-PUB-' || v_year || '-' || lpad(v_seq::text, 6, '0');
end;
$$;

create or replace function private.generate_landing_experiment_reference()
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
  v_seq := nextval('private.landing_experiment_reference_seq');
  return 'OD-LP-EXP-' || v_year || '-' || lpad(v_seq::text, 6, '0');
end;
$$;

create or replace function private.landing_lab_require_actor(p_permission text)
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
    raise exception 'LANDING_LAB_UNAUTHORIZED' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles pr
    where pr.id = v_actor and pr.status = 'active'
  ) then
    raise exception 'LANDING_LAB_UNAUTHORIZED' using errcode = '42501';
  end if;
  if p_permission is null or not private.has_permission(p_permission) then
    raise exception 'LANDING_LAB_UNAUTHORIZED' using errcode = '42501';
  end if;
  return v_actor;
end;
$$;

create or replace function private.landing_lab_not_found()
returns void
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  raise exception 'LANDING_LAB_NOT_FOUND' using errcode = '42501';
end;
$$;

create or replace function private.validate_landing_experiment_variants(
  p_publication public.landing_publications,
  p_variants jsonb
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_count integer;
  v_sum integer;
  v_item jsonb;
  v_version public.landing_page_versions%rowtype;
  v_keys text[];
  v_has_control boolean := false;
begin
  if p_variants is null or jsonb_typeof(p_variants) <> 'array' then
    raise exception 'LANDING_EXPERIMENT_INVALID' using errcode = '22023';
  end if;

  v_count := jsonb_array_length(p_variants);
  if v_count not in (2, 3) then
    raise exception 'LANDING_EXPERIMENT_INVALID' using errcode = '22023';
  end if;

  v_sum := 0;
  v_keys := array[]::text[];

  for v_item in select value from jsonb_array_elements(p_variants)
  loop
    if jsonb_typeof(v_item) <> 'object'
       or coalesce(v_item->>'variant_key', '') !~ '^[a-z0-9][a-z0-9_-]{1,31}$'
       or coalesce(v_item->>'label', '') = ''
       or length(trim(v_item->>'label')) > 80
       or (v_item->>'landing_page_version_id') is null
       or coalesce((v_item->>'allocation_percent')::integer, 0) not between 1 and 99 then
      raise exception 'LANDING_EXPERIMENT_INVALID' using errcode = '22023';
    end if;

    if (v_item->>'variant_key') = any (v_keys) then
      raise exception 'LANDING_EXPERIMENT_INVALID' using errcode = '22023';
    end if;
    v_keys := array_append(v_keys, v_item->>'variant_key');
    v_sum := v_sum + (v_item->>'allocation_percent')::integer;

    select * into v_version
    from public.landing_page_versions
    where id = (v_item->>'landing_page_version_id')::uuid
      and landing_page_id = p_publication.landing_page_id;

    if not found or v_version.frozen_at is null then
      raise exception 'LANDING_EXPERIMENT_INVALID' using errcode = '22023';
    end if;

    if v_version.id = p_publication.landing_page_version_id then
      v_has_control := true;
    end if;
  end loop;

  if v_sum <> 100 or not v_has_control then
    raise exception 'LANDING_EXPERIMENT_INVALID' using errcode = '22023';
  end if;
end;
$$;

-- Forward-replace first-touchpoint insert (M11 definition remains historical; M32 replaces function body).
create or replace function private.trg_leads_after_insert_touchpoint()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_detail text;
  v_attr jsonb;
  v_meta jsonb;
  v_campaign text;
  v_text text;
  v_keys text[] := array[
    'landing_page_reference',
    'page_version_number',
    'publication_reference',
    'experiment_reference',
    'variant_key',
    'campaign_version_number',
    'utm_source',
    'utm_medium',
    'utm_campaign',
    'utm_content',
    'utm_term',
    'fbclid',
    'gclid',
    'utmSource',
    'utmMedium',
    'utmCampaign',
    'utmContent',
    'utmTerm'
  ];
  v_key text;
  v_out_key text;
begin
  v_detail := nullif(trim(current_setting('onedecore.lead_first_touchpoint_source_detail', true)), '');
  v_attr := coalesce(NEW.attribution, '{}'::jsonb);
  v_meta := jsonb_build_object('entry_method', NEW.entry_method);

  v_campaign := nullif(v_attr->>'campaign_reference', '');
  if v_campaign is not null and v_campaign !~ '^OD-C-[0-9]{4}-[0-9]{6}$' then
    v_campaign := null;
  end if;

  foreach v_key in array v_keys
  loop
    v_text := nullif(v_attr->>v_key, '');
    if v_text is null then
      continue;
    end if;
    v_out_key := case v_key
      when 'utmSource' then 'utm_source'
      when 'utmMedium' then 'utm_medium'
      when 'utmCampaign' then 'utm_campaign'
      when 'utmContent' then 'utm_content'
      when 'utmTerm' then 'utm_term'
      else v_key
    end;
    if not (v_meta ? v_out_key) then
      v_meta := v_meta || jsonb_build_object(v_out_key, v_text);
    end if;
  end loop;

  if pg_column_size(v_meta) > 2048 then
    raise exception 'LANDING_ATTRIBUTION_TOO_LARGE' using errcode = '22023';
  end if;

  insert into public.lead_source_touchpoints (
    lead_id, source_id, touchpoint_kind, occurred_at, source_detail, campaign_reference, metadata
  ) values (
    NEW.id,
    NEW.primary_source_id,
    'first',
    NEW.created_at,
    coalesce(v_detail, NEW.source),
    v_campaign,
    v_meta
  );
  perform set_config('onedecore.lead_first_touchpoint_source_detail', '', true);
  return NEW;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. RPC surface
-- ----------------------------------------------------------------------------
create or replace function public.create_landing_page_draft(
  p_title text,
  p_slug text,
  p_blocks jsonb,
  p_version_label text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_hash text;
  v_replay jsonb;
  v_page public.landing_pages%rowtype;
  v_version public.landing_page_versions%rowtype;
  v_response jsonb;
begin
  v_actor := private.landing_lab_require_actor('landing_pages.manage');
  if p_idempotency_key is null then
    raise exception 'LANDING_LAB_INVALID' using errcode = '22023';
  end if;
  v_hash := private.landing_lab_sha256(
    coalesce(p_title, '') || '|' || coalesce(p_slug, '') || '|' || coalesce(p_blocks::text, '') || '|' || coalesce(p_version_label, '')
  );
  perform private.landing_lab_idempotency_xact_lock(v_actor, 'create_landing_page_draft', p_idempotency_key);
  v_replay := private.landing_lab_idempotency_lookup(v_actor, 'create_landing_page_draft', p_idempotency_key, v_hash);
  if v_replay is not null then
    return v_replay;
  end if;

  insert into public.landing_pages (page_reference, slug, title, created_by)
  values (private.generate_landing_page_reference(), lower(trim(p_slug)), trim(p_title), v_actor)
  returning * into v_page;

  insert into public.landing_page_versions (
    landing_page_id, version_number, label, blocks, created_by, updated_by
  ) values (
    v_page.id, 1, trim(p_version_label), p_blocks, v_actor, v_actor
  )
  returning * into v_version;

  v_response := jsonb_build_object(
    'landing_page_id', v_page.id,
    'page_reference', v_page.page_reference,
    'slug', v_page.slug,
    'version_id', v_version.id,
    'version_number', v_version.version_number,
    'lock_version', v_version.lock_version
  );
  perform private.landing_lab_idempotency_store(v_actor, 'create_landing_page_draft', p_idempotency_key, v_hash, v_response);
  return v_response;
end;
$$;

create or replace function public.save_landing_page_draft(
  p_version_id uuid,
  p_expected_lock_version integer,
  p_title text,
  p_slug text,
  p_blocks jsonb,
  p_version_label text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_hash text;
  v_replay jsonb;
  v_version public.landing_page_versions%rowtype;
  v_response jsonb;
begin
  v_actor := private.landing_lab_require_actor('landing_pages.manage');
  if p_idempotency_key is null then
    raise exception 'LANDING_LAB_INVALID' using errcode = '22023';
  end if;
  v_hash := private.landing_lab_sha256(
    coalesce(p_version_id::text, '') || '|' || coalesce(p_expected_lock_version::text, '') || '|'
    || coalesce(p_title, '') || '|' || coalesce(p_slug, '') || '|' || coalesce(p_blocks::text, '') || '|' || coalesce(p_version_label, '')
  );
  perform private.landing_lab_idempotency_xact_lock(v_actor, 'save_landing_page_draft', p_idempotency_key);
  v_replay := private.landing_lab_idempotency_lookup(v_actor, 'save_landing_page_draft', p_idempotency_key, v_hash);
  if v_replay is not null then
    return v_replay;
  end if;

  select * into v_version from public.landing_page_versions where id = p_version_id;
  if not found then
    perform private.landing_lab_not_found();
  end if;
  if v_version.frozen_at is not null then
    raise exception 'LANDING_VERSION_FROZEN' using errcode = '22023';
  end if;
  if v_version.lock_version <> p_expected_lock_version then
    raise exception 'LANDING_VERSION_LOCK_CONFLICT' using errcode = '22023';
  end if;

  update public.landing_pages
  set title = trim(p_title), slug = lower(trim(p_slug))
  where id = v_version.landing_page_id;

  update public.landing_page_versions
  set
    blocks = p_blocks,
    label = trim(p_version_label),
    updated_by = v_actor,
    lock_version = lock_version + 1
  where id = v_version.id
  returning * into v_version;

  v_response := jsonb_build_object(
    'version_id', v_version.id,
    'lock_version', v_version.lock_version,
    'version_number', v_version.version_number
  );
  perform private.landing_lab_idempotency_store(v_actor, 'save_landing_page_draft', p_idempotency_key, v_hash, v_response);
  return v_response;
end;
$$;

create or replace function public.freeze_landing_page_version(
  p_version_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_hash text;
  v_replay jsonb;
  v_version public.landing_page_versions%rowtype;
  v_response jsonb;
begin
  v_actor := private.landing_lab_require_actor('landing_pages.manage');
  v_hash := private.landing_lab_sha256(coalesce(p_version_id::text, ''));
  perform private.landing_lab_idempotency_xact_lock(v_actor, 'freeze_landing_page_version', p_idempotency_key);
  v_replay := private.landing_lab_idempotency_lookup(v_actor, 'freeze_landing_page_version', p_idempotency_key, v_hash);
  if v_replay is not null then
    return v_replay;
  end if;

  select * into v_version from public.landing_page_versions where id = p_version_id;
  if not found then
    perform private.landing_lab_not_found();
  end if;
  if v_version.frozen_at is not null then
    raise exception 'LANDING_VERSION_FROZEN' using errcode = '22023';
  end if;

  update public.landing_page_versions
  set
    frozen_at = now(),
    content_hash = private.landing_lab_sha256(blocks::text),
    updated_by = v_actor,
    lock_version = lock_version + 1
  where id = v_version.id
  returning * into v_version;

  v_response := jsonb_build_object(
    'version_id', v_version.id,
    'frozen_at', v_version.frozen_at,
    'content_hash', v_version.content_hash,
    'lock_version', v_version.lock_version
  );
  perform private.landing_lab_idempotency_store(v_actor, 'freeze_landing_page_version', p_idempotency_key, v_hash, v_response);
  return v_response;
end;
$$;

create or replace function public.create_next_landing_page_version(
  p_landing_page_id uuid,
  p_source_version_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_hash text;
  v_replay jsonb;
  v_source public.landing_page_versions%rowtype;
  v_next integer;
  v_version public.landing_page_versions%rowtype;
  v_response jsonb;
begin
  v_actor := private.landing_lab_require_actor('landing_pages.manage');
  v_hash := private.landing_lab_sha256(coalesce(p_landing_page_id::text, '') || '|' || coalesce(p_source_version_id::text, ''));
  perform private.landing_lab_idempotency_xact_lock(v_actor, 'create_next_landing_page_version', p_idempotency_key);
  v_replay := private.landing_lab_idempotency_lookup(v_actor, 'create_next_landing_page_version', p_idempotency_key, v_hash);
  if v_replay is not null then
    return v_replay;
  end if;

  if not exists (select 1 from public.landing_pages where id = p_landing_page_id) then
    perform private.landing_lab_not_found();
  end if;

  select * into v_source
  from public.landing_page_versions
  where id = p_source_version_id and landing_page_id = p_landing_page_id;
  if not found or v_source.frozen_at is null then
    raise exception 'LANDING_VERSION_NOT_FROZEN' using errcode = '22023';
  end if;

  select coalesce(max(version_number), 0) + 1 into v_next
  from public.landing_page_versions
  where landing_page_id = p_landing_page_id;

  insert into public.landing_page_versions (
    landing_page_id, version_number, label, blocks, created_by, updated_by
  ) values (
    p_landing_page_id, v_next, 'Draft v' || v_next::text, v_source.blocks, v_actor, v_actor
  )
  returning * into v_version;

  v_response := jsonb_build_object(
    'version_id', v_version.id,
    'version_number', v_version.version_number,
    'lock_version', v_version.lock_version
  );
  perform private.landing_lab_idempotency_store(v_actor, 'create_next_landing_page_version', p_idempotency_key, v_hash, v_response);
  return v_response;
end;
$$;

create or replace function public.create_landing_publication(
  p_landing_page_id uuid,
  p_version_id uuid,
  p_campaign_reference text,
  p_campaign_version_number integer,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_hash text;
  v_replay jsonb;
  v_version public.landing_page_versions%rowtype;
  v_pub public.landing_publications%rowtype;
  v_campaign text;
  v_response jsonb;
begin
  v_actor := private.landing_lab_require_actor('landing_pages.publish');
  v_hash := private.landing_lab_sha256(
    coalesce(p_landing_page_id::text, '') || '|' || coalesce(p_version_id::text, '') || '|'
    || coalesce(p_campaign_reference, '') || '|' || coalesce(p_campaign_version_number::text, '')
  );
  perform private.landing_lab_idempotency_xact_lock(v_actor, 'create_landing_publication', p_idempotency_key);
  v_replay := private.landing_lab_idempotency_lookup(v_actor, 'create_landing_publication', p_idempotency_key, v_hash);
  if v_replay is not null then
    return v_replay;
  end if;

  select * into v_version
  from public.landing_page_versions
  where id = p_version_id and landing_page_id = p_landing_page_id;
  if not found then
    perform private.landing_lab_not_found();
  end if;
  if v_version.frozen_at is null then
    raise exception 'LANDING_VERSION_NOT_FROZEN' using errcode = '22023';
  end if;

  v_campaign := nullif(trim(p_campaign_reference), '');
  if v_campaign is not null and v_campaign !~ '^OD-C-[0-9]{4}-[0-9]{6}$' then
    raise exception 'LANDING_CAMPAIGN_REFERENCE_INVALID' using errcode = '22023';
  end if;
  if v_campaign is not null and coalesce(p_campaign_version_number, 0) < 1 then
    raise exception 'LANDING_CAMPAIGN_REFERENCE_INVALID' using errcode = '22023';
  end if;

  insert into public.landing_publications (
    publication_reference, landing_page_id, landing_page_version_id, status,
    campaign_reference, campaign_version_number, created_by, updated_by
  ) values (
    private.generate_landing_publication_reference(), p_landing_page_id, v_version.id, 'draft',
    v_campaign, case when v_campaign is null then null else p_campaign_version_number end,
    v_actor, v_actor
  )
  returning * into v_pub;

  v_response := jsonb_build_object(
    'publication_id', v_pub.id,
    'publication_reference', v_pub.publication_reference,
    'status', v_pub.status,
    'lock_version', v_pub.lock_version
  );
  perform private.landing_lab_idempotency_store(v_actor, 'create_landing_publication', p_idempotency_key, v_hash, v_response);
  return v_response;
end;
$$;

create or replace function public.transition_landing_publication(
  p_publication_id uuid,
  p_target_status text,
  p_expected_lock_version integer,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_hash text;
  v_replay jsonb;
  v_pub public.landing_publications%rowtype;
  v_response jsonb;
begin
  v_actor := private.landing_lab_require_actor('landing_pages.publish');
  v_hash := private.landing_lab_sha256(
    coalesce(p_publication_id::text, '') || '|' || coalesce(p_target_status, '') || '|' || coalesce(p_expected_lock_version::text, '')
  );
  perform private.landing_lab_idempotency_xact_lock(v_actor, 'transition_landing_publication', p_idempotency_key);
  v_replay := private.landing_lab_idempotency_lookup(v_actor, 'transition_landing_publication', p_idempotency_key, v_hash);
  if v_replay is not null then
    return v_replay;
  end if;

  if p_target_status not in ('live', 'paused', 'archived') then
    raise exception 'LANDING_PUBLICATION_INVALID_TRANSITION' using errcode = '22023';
  end if;

  select * into v_pub from public.landing_publications where id = p_publication_id;
  if not found then
    perform private.landing_lab_not_found();
  end if;
  if v_pub.lock_version <> p_expected_lock_version then
    raise exception 'LANDING_PUBLICATION_LOCK_CONFLICT' using errcode = '22023';
  end if;

  update public.landing_publications
  set
    status = p_target_status,
    updated_by = v_actor,
    published_at = case when p_target_status = 'live' then coalesce(published_at, now()) else published_at end,
    paused_at = case when p_target_status = 'paused' then now() else paused_at end,
    archived_at = case when p_target_status = 'archived' then now() else archived_at end,
    lock_version = lock_version + 1
  where id = v_pub.id
  returning * into v_pub;

  v_response := jsonb_build_object(
    'publication_id', v_pub.id,
    'status', v_pub.status,
    'lock_version', v_pub.lock_version
  );
  perform private.landing_lab_idempotency_store(v_actor, 'transition_landing_publication', p_idempotency_key, v_hash, v_response);
  return v_response;
end;
$$;

create or replace function public.save_landing_experiment_draft(
  p_publication_id uuid,
  p_experiment_id uuid,
  p_variants jsonb,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_hash text;
  v_replay jsonb;
  v_pub public.landing_publications%rowtype;
  v_exp public.landing_experiments%rowtype;
  v_item jsonb;
  v_response jsonb;
begin
  v_actor := private.landing_lab_require_actor('landing_experiments.manage');
  v_hash := private.landing_lab_sha256(
    coalesce(p_publication_id::text, '') || '|' || coalesce(p_experiment_id::text, '') || '|' || coalesce(p_variants::text, '')
  );
  perform private.landing_lab_idempotency_xact_lock(v_actor, 'save_landing_experiment_draft', p_idempotency_key);
  v_replay := private.landing_lab_idempotency_lookup(v_actor, 'save_landing_experiment_draft', p_idempotency_key, v_hash);
  if v_replay is not null then
    return v_replay;
  end if;

  select * into v_pub from public.landing_publications where id = p_publication_id;
  if not found then
    perform private.landing_lab_not_found();
  end if;

  perform private.validate_landing_experiment_variants(v_pub, p_variants);

  if exists (
    select 1 from public.landing_experiments e
    where e.publication_id = p_publication_id
      and e.status = 'running'
  ) then
    raise exception 'LANDING_EXPERIMENT_INVALID' using errcode = '22023';
  end if;

  if p_experiment_id is null then
    insert into public.landing_experiments (
      experiment_reference, publication_id, status, created_by
    ) values (
      private.generate_landing_experiment_reference(), p_publication_id, 'draft', v_actor
    )
    returning * into v_exp;
  else
    select * into v_exp from public.landing_experiments where id = p_experiment_id and publication_id = p_publication_id;
    if not found then
      perform private.landing_lab_not_found();
    end if;
    if v_exp.status <> 'draft' then
      raise exception 'LANDING_EXPERIMENT_INVALID' using errcode = '22023';
    end if;
  end if;

  delete from public.landing_experiment_variants where experiment_id = v_exp.id;

  for v_item in select value from jsonb_array_elements(p_variants)
  loop
    insert into public.landing_experiment_variants (
      experiment_id, variant_key, landing_page_version_id, allocation_percent, label
    ) values (
      v_exp.id,
      v_item->>'variant_key',
      (v_item->>'landing_page_version_id')::uuid,
      (v_item->>'allocation_percent')::integer,
      trim(v_item->>'label')
    );
  end loop;

  v_response := jsonb_build_object(
    'experiment_id', v_exp.id,
    'experiment_reference', v_exp.experiment_reference,
    'status', v_exp.status
  );
  perform private.landing_lab_idempotency_store(v_actor, 'save_landing_experiment_draft', p_idempotency_key, v_hash, v_response);
  return v_response;
end;
$$;

create or replace function public.start_landing_experiment(
  p_experiment_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_hash text;
  v_replay jsonb;
  v_exp public.landing_experiments%rowtype;
  v_pub public.landing_publications%rowtype;
  v_variants jsonb;
  v_response jsonb;
begin
  v_actor := private.landing_lab_require_actor('landing_experiments.manage');
  v_hash := private.landing_lab_sha256(coalesce(p_experiment_id::text, ''));
  perform private.landing_lab_idempotency_xact_lock(v_actor, 'start_landing_experiment', p_idempotency_key);
  v_replay := private.landing_lab_idempotency_lookup(v_actor, 'start_landing_experiment', p_idempotency_key, v_hash);
  if v_replay is not null then
    return v_replay;
  end if;

  select * into v_exp from public.landing_experiments where id = p_experiment_id;
  if not found then
    perform private.landing_lab_not_found();
  end if;
  if v_exp.status <> 'draft' then
    raise exception 'LANDING_EXPERIMENT_INVALID' using errcode = '22023';
  end if;

  select * into v_pub from public.landing_publications where id = v_exp.publication_id;
  if v_pub.status <> 'live' then
    raise exception 'LANDING_EXPERIMENT_PUBLICATION_NOT_LIVE' using errcode = '22023';
  end if;

  select coalesce(jsonb_agg(jsonb_build_object(
    'variant_key', variant_key,
    'landing_page_version_id', landing_page_version_id,
    'allocation_percent', allocation_percent,
    'label', label
  )), '[]'::jsonb)
  into v_variants
  from public.landing_experiment_variants
  where experiment_id = v_exp.id;

  perform private.validate_landing_experiment_variants(v_pub, v_variants);

  update public.landing_experiments
  set status = 'running', started_by = v_actor, started_at = now()
  where id = v_exp.id
  returning * into v_exp;

  v_response := jsonb_build_object(
    'experiment_id', v_exp.id,
    'status', v_exp.status,
    'started_at', v_exp.started_at
  );
  perform private.landing_lab_idempotency_store(v_actor, 'start_landing_experiment', p_idempotency_key, v_hash, v_response);
  return v_response;
end;
$$;

create or replace function public.conclude_landing_experiment(
  p_experiment_id uuid,
  p_winner_variant_key text,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_hash text;
  v_replay jsonb;
  v_exp public.landing_experiments%rowtype;
  v_response jsonb;
begin
  v_actor := private.landing_lab_require_actor('landing_experiments.manage');
  v_hash := private.landing_lab_sha256(coalesce(p_experiment_id::text, '') || '|' || coalesce(p_winner_variant_key, ''));
  perform private.landing_lab_idempotency_xact_lock(v_actor, 'conclude_landing_experiment', p_idempotency_key);
  v_replay := private.landing_lab_idempotency_lookup(v_actor, 'conclude_landing_experiment', p_idempotency_key, v_hash);
  if v_replay is not null then
    return v_replay;
  end if;

  select * into v_exp from public.landing_experiments where id = p_experiment_id;
  if not found then
    perform private.landing_lab_not_found();
  end if;
  if v_exp.status <> 'running' then
    raise exception 'LANDING_EXPERIMENT_INVALID' using errcode = '22023';
  end if;
  if not exists (
    select 1 from public.landing_experiment_variants
    where experiment_id = v_exp.id and variant_key = p_winner_variant_key
  ) then
    raise exception 'LANDING_EXPERIMENT_INVALID' using errcode = '22023';
  end if;

  update public.landing_experiments
  set
    status = 'concluded',
    winner_variant_key = p_winner_variant_key,
    concluded_by = v_actor,
    concluded_at = now()
  where id = v_exp.id
  returning * into v_exp;

  v_response := jsonb_build_object(
    'experiment_id', v_exp.id,
    'status', v_exp.status,
    'winner_variant_key', v_exp.winner_variant_key
  );
  perform private.landing_lab_idempotency_store(v_actor, 'conclude_landing_experiment', p_idempotency_key, v_hash, v_response);
  return v_response;
end;
$$;

create or replace function public.get_live_landing_publication(p_slug text)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_page public.landing_pages%rowtype;
  v_pub public.landing_publications%rowtype;
  v_version public.landing_page_versions%rowtype;
  v_exp public.landing_experiments%rowtype;
  v_variants jsonb;
begin
  if p_slug is null or p_slug !~ '^[a-z0-9]+(?:-[a-z0-9]+)*$' then
    return null;
  end if;

  select * into v_page from public.landing_pages where slug = p_slug;
  if not found then
    return null;
  end if;

  select * into v_pub
  from public.landing_publications
  where landing_page_id = v_page.id and status = 'live'
  limit 1;
  if not found then
    return null;
  end if;

  select * into v_version from public.landing_page_versions where id = v_pub.landing_page_version_id;
  if v_version.frozen_at is null then
    return null;
  end if;

  select * into v_exp
  from public.landing_experiments
  where publication_id = v_pub.id and status = 'running'
  limit 1;

  if found then
    select coalesce(jsonb_agg(jsonb_build_object(
      'variant_key', ev.variant_key,
      'landing_page_version_id', ev.landing_page_version_id,
      'allocation_percent', ev.allocation_percent,
      'label', ev.label,
      'version_number', lv.version_number,
      'blocks', lv.blocks,
      'page_reference', lp.page_reference
    ) order by ev.variant_key), '[]'::jsonb)
    into v_variants
    from public.landing_experiment_variants ev
    join public.landing_page_versions lv on lv.id = ev.landing_page_version_id
    join public.landing_pages lp on lp.id = lv.landing_page_id
    where ev.experiment_id = v_exp.id;
  else
    v_variants := null;
  end if;

  return jsonb_build_object(
    'page', jsonb_build_object(
      'id', v_page.id,
      'page_reference', v_page.page_reference,
      'slug', v_page.slug,
      'title', v_page.title
    ),
    'publication', jsonb_build_object(
      'id', v_pub.id,
      'publication_reference', v_pub.publication_reference,
      'status', v_pub.status,
      'campaign_reference', v_pub.campaign_reference,
      'campaign_version_number', v_pub.campaign_version_number
    ),
    'version', jsonb_build_object(
      'id', v_version.id,
      'version_number', v_version.version_number,
      'blocks', v_version.blocks,
      'frozen_at', v_version.frozen_at
    ),
    'experiment', case when v_exp.id is null then null else jsonb_build_object(
      'id', v_exp.id,
      'experiment_reference', v_exp.experiment_reference,
      'status', v_exp.status,
      'variants', v_variants
    ) end
  );
end;
$$;

create or replace function public.record_landing_exposure(
  p_publication_id uuid,
  p_experiment_id uuid,
  p_variant_key text,
  p_visitor_key_hash text,
  p_assignment_epoch text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
begin
  if p_publication_id is null
     or p_visitor_key_hash is null or p_visitor_key_hash !~ '^[0-9a-f]{64}$'
     or p_assignment_epoch is null or p_assignment_epoch !~ '^[0-9]{4}-[0-9]{2}-[0-9]{2}$' then
    raise exception 'LANDING_EXPOSURE_INVALID' using errcode = '22023';
  end if;

  insert into public.landing_exposures (
    publication_id, experiment_id, variant_key, visitor_key_hash, assignment_epoch
  ) values (
    p_publication_id, p_experiment_id, nullif(p_variant_key, ''), p_visitor_key_hash, p_assignment_epoch
  )
  on conflict on constraint uq_landing_exposures_unique_denom do nothing;

  return jsonb_build_object('inserted', found);
end;
$$;

create or replace function public.verify_live_landing_publication_context(
  p_publication_reference text,
  p_page_reference text,
  p_page_version_number integer,
  p_experiment_reference text,
  p_variant_key text
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_page public.landing_pages%rowtype;
  v_pub public.landing_publications%rowtype;
  v_version public.landing_page_versions%rowtype;
  v_exp public.landing_experiments%rowtype;
begin
  if p_publication_reference is null or p_page_reference is null or p_page_version_number is null then
    return jsonb_build_object('ok', false, 'reason', 'invalid');
  end if;

  select * into v_pub from public.landing_publications where publication_reference = p_publication_reference;
  if not found or v_pub.status <> 'live' then
    return jsonb_build_object('ok', false, 'reason', 'not_live');
  end if;

  select * into v_page from public.landing_pages where id = v_pub.landing_page_id;
  if v_page.page_reference <> p_page_reference then
    return jsonb_build_object('ok', false, 'reason', 'mismatch');
  end if;

  select * into v_version from public.landing_page_versions where id = v_pub.landing_page_version_id;
  if v_version.frozen_at is null then
    return jsonb_build_object('ok', false, 'reason', 'mismatch');
  end if;

  select * into v_exp
  from public.landing_experiments
  where publication_id = v_pub.id and status = 'running'
  limit 1;

  if p_experiment_reference is not null then
    if not found or v_exp.experiment_reference <> p_experiment_reference then
      return jsonb_build_object('ok', false, 'reason', 'experiment');
    end if;
    if p_variant_key is null or not exists (
      select 1 from public.landing_experiment_variants
      where experiment_id = v_exp.id and variant_key = p_variant_key
    ) then
      return jsonb_build_object('ok', false, 'reason', 'variant');
    end if;
  else
    if p_variant_key is not null then
      return jsonb_build_object('ok', false, 'reason', 'variant');
    end if;
    if v_version.version_number <> p_page_version_number then
      return jsonb_build_object('ok', false, 'reason', 'version');
    end if;
  end if;

  if p_experiment_reference is not null then
    if not exists (
      select 1
      from public.landing_experiment_variants ev
      join public.landing_page_versions lv on lv.id = ev.landing_page_version_id
      where ev.experiment_id = v_exp.id
        and ev.variant_key = p_variant_key
        and lv.version_number = p_page_version_number
        and lv.frozen_at is not null
    ) then
      return jsonb_build_object('ok', false, 'reason', 'version');
    end if;
  end if;

  return jsonb_build_object(
    'ok', true,
    'publication_id', v_pub.id,
    'campaign_reference', v_pub.campaign_reference,
    'campaign_version_number', v_pub.campaign_version_number
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. RLS / ACL
-- ----------------------------------------------------------------------------
alter table public.landing_pages enable row level security;
alter table public.landing_page_versions enable row level security;
alter table public.landing_publications enable row level security;
alter table public.landing_experiments enable row level security;
alter table public.landing_experiment_variants enable row level security;
alter table public.landing_exposures enable row level security;

revoke all on table public.landing_pages from public, anon, authenticated;
revoke all on table public.landing_page_versions from public, anon, authenticated;
revoke all on table public.landing_publications from public, anon, authenticated;
revoke all on table public.landing_experiments from public, anon, authenticated;
revoke all on table public.landing_experiment_variants from public, anon, authenticated;
revoke all on table public.landing_exposures from public, anon, authenticated;
revoke all on table private.landing_lab_idempotency_requests from public, anon, authenticated;
revoke all on sequence private.landing_page_reference_seq from public, anon, authenticated;
revoke all on sequence private.landing_publication_reference_seq from public, anon, authenticated;
revoke all on sequence private.landing_experiment_reference_seq from public, anon, authenticated;

grant select on table public.landing_pages to authenticated;
grant select on table public.landing_page_versions to authenticated;
grant select on table public.landing_publications to authenticated;
grant select on table public.landing_experiments to authenticated;
grant select on table public.landing_experiment_variants to authenticated;
grant select on table public.landing_exposures to authenticated;

create policy landing_pages_select on public.landing_pages
  for select to authenticated
  using ((select public.authorize('landing_pages.read')));

create policy landing_page_versions_select on public.landing_page_versions
  for select to authenticated
  using ((select public.authorize('landing_pages.read')));

create policy landing_publications_select on public.landing_publications
  for select to authenticated
  using ((select public.authorize('landing_pages.read')));

create policy landing_experiments_select on public.landing_experiments
  for select to authenticated
  using ((select public.authorize('landing_pages.read')));

create policy landing_experiment_variants_select on public.landing_experiment_variants
  for select to authenticated
  using ((select public.authorize('landing_pages.read')));

create policy landing_exposures_select on public.landing_exposures
  for select to authenticated
  using ((select public.authorize('landing_analytics.read')));

-- ----------------------------------------------------------------------------
-- 7. Function ownership and execute ACL
-- ----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig, n.nspname as nsp, p.proname
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('private', 'public')
      and p.proname in (
        'touch_landing_lab_updated_at',
        'forbid_landing_page_identity_mutation',
        'forbid_frozen_landing_version_mutation',
        'enforce_landing_publication_transitions',
        'forbid_running_or_concluded_experiment_mutation',
        'forbid_experiment_variant_mutation_when_locked',
        'forbid_landing_exposure_mutation',
        'forbid_landing_lab_hard_delete',
        'landing_lab_sha256',
        'landing_lab_idempotency_xact_lock',
        'landing_lab_idempotency_lookup',
        'landing_lab_idempotency_store',
        'generate_landing_page_reference',
        'generate_landing_publication_reference',
        'generate_landing_experiment_reference',
        'landing_lab_require_actor',
        'landing_lab_not_found',
        'validate_landing_experiment_variants',
        'trg_leads_after_insert_touchpoint',
        'create_landing_page_draft',
        'save_landing_page_draft',
        'freeze_landing_page_version',
        'create_next_landing_page_version',
        'create_landing_publication',
        'transition_landing_publication',
        'save_landing_experiment_draft',
        'start_landing_experiment',
        'conclude_landing_experiment',
        'get_live_landing_publication',
        'record_landing_exposure',
        'verify_live_landing_publication_context'
      )
  loop
    execute format('alter function %s owner to postgres', r.sig);
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    if r.nsp = 'public' and r.proname not in (
      'record_landing_exposure',
      'get_live_landing_publication',
      'verify_live_landing_publication_context'
    ) then
      execute format('grant execute on function %s to authenticated', r.sig);
    end if;
  end loop;
end;
$$;

grant execute on function public.get_live_landing_publication(text) to service_role;
grant execute on function public.verify_live_landing_publication_context(text, text, integer, text, text) to service_role;
grant execute on function public.record_landing_exposure(uuid, uuid, text, text, text) to service_role;

revoke execute on function public.create_landing_page_draft(text, text, jsonb, text, uuid) from public, anon;
revoke execute on function public.save_landing_page_draft(uuid, integer, text, text, jsonb, text, uuid) from public, anon;
revoke execute on function public.freeze_landing_page_version(uuid, uuid) from public, anon;
revoke execute on function public.create_next_landing_page_version(uuid, uuid, uuid) from public, anon;
revoke execute on function public.create_landing_publication(uuid, uuid, text, integer, uuid) from public, anon;
revoke execute on function public.transition_landing_publication(uuid, text, integer, uuid) from public, anon;
revoke execute on function public.save_landing_experiment_draft(uuid, uuid, jsonb, uuid) from public, anon;
revoke execute on function public.start_landing_experiment(uuid, uuid) from public, anon;
revoke execute on function public.conclude_landing_experiment(uuid, text, uuid) from public, anon;
revoke execute on function public.get_live_landing_publication(text) from public, anon, authenticated;
revoke execute on function public.verify_live_landing_publication_context(text, text, integer, text, text) from public, anon, authenticated;
revoke execute on function public.record_landing_exposure(uuid, uuid, text, text, text) from public, anon, authenticated;
