-- ============================================================================
-- M31 Migration: ONEDECORE Phase 9A Campaign Consent, Audience & Approval
-- Architecture: ADR-0027 / DEC-0077 / OD9A-1..OD9A-6
-- Forward-only. Does not rewrite M1-M30. No managed apply in this gate.
-- No campaign/consent business seeds. No Phase 9B/9C tables. No storage bucket.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Permissions (canonical five-role grants only)
-- ----------------------------------------------------------------------------
insert into public.permissions (code, name, description, is_system, is_active) values
  ('campaigns.read', 'Read campaigns', 'Read Phase 9A campaign governance rows', true, true),
  ('campaigns.draft', 'Draft campaigns', 'Create and edit Phase 9A campaign drafts', true, true),
  ('campaigns.request_approval', 'Request campaign approval', 'Submit a campaign version for approval', true, true),
  ('campaigns.approve', 'Approve campaigns', 'Approve or reject pending campaign versions', true, true),
  ('marketing_consents.manage', 'Manage MARKETING consents', 'Record staff MARKETING granted/withdrawn evidence', true, true)
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
    'campaigns.read',
    'campaigns.draft',
    'campaigns.request_approval',
    'campaigns.approve',
    'marketing_consents.manage'
  )
  and r.code in ('super_admin', 'sales_manager')
on conflict (role_id, permission_id) do nothing;

-- ----------------------------------------------------------------------------
-- 2. Tables
-- ----------------------------------------------------------------------------
create sequence private.campaign_reference_seq start with 1 increment by 1;

create table public.campaigns (
  id uuid primary key default gen_random_uuid(),
  campaign_reference text not null unique,
  name text not null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_campaigns_reference_format check (campaign_reference ~ '^OD-C-[0-9]{4}-[0-9]{6}$'),
  constraint chk_campaigns_name check (length(trim(name)) between 2 and 160)
);

comment on table public.campaigns is
  'Phase 9A campaign root identity. No execution/provider/spend state.';

create table public.campaign_versions (
  id uuid primary key default gen_random_uuid(),
  campaign_id uuid not null references public.campaigns (id) on delete restrict,
  version_number integer not null,
  title text not null,
  status text not null default 'draft',
  targeting_mode text not null,
  intended_channels text[] not null,
  destination_reference text null,
  budget_snapshot jsonb not null,
  creative_snapshot jsonb not null,
  intended_window_snapshot jsonb not null,
  configuration_hash text null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  requested_by uuid null references public.profiles (id) on delete restrict,
  requested_at timestamptz null,
  frozen_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lock_version integer not null default 1,
  constraint uq_campaign_versions_number unique (campaign_id, version_number),
  constraint chk_campaign_versions_number check (version_number between 1 and 9999),
  constraint chk_campaign_versions_title check (length(trim(title)) between 2 and 160),
  constraint chk_campaign_versions_status check (
    status in ('draft', 'pending_approval', 'approved', 'rejected')
  ),
  constraint chk_campaign_versions_targeting check (
    targeting_mode in ('broad_public', 'direct_or_custom')
  ),
  constraint chk_campaign_versions_channels check (
    cardinality(intended_channels) between 1 and 4
  ),
  constraint chk_campaign_versions_destination check (
    destination_reference is null
    or (
      length(trim(destination_reference)) between 1 and 500
      and destination_reference !~ '[[:cntrl:]]'
    )
  ),
  constraint chk_campaign_versions_budget check (
    jsonb_typeof(budget_snapshot) = 'object'
    and pg_column_size(budget_snapshot) <= 2048
  ),
  constraint chk_campaign_versions_creative check (
    jsonb_typeof(creative_snapshot) = 'object'
    and pg_column_size(creative_snapshot) <= 16384
  ),
  constraint chk_campaign_versions_window check (
    jsonb_typeof(intended_window_snapshot) = 'object'
    and pg_column_size(intended_window_snapshot) <= 1024
  ),
  constraint chk_campaign_versions_configuration_hash check (
    configuration_hash is null or configuration_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint chk_campaign_versions_lock check (lock_version >= 1),
  constraint chk_campaign_versions_draft_meta check (
    (status = 'draft'
      and requested_by is null
      and requested_at is null
      and frozen_at is null
      and configuration_hash is null)
    or (status in ('pending_approval', 'approved', 'rejected')
      and requested_by is not null
      and requested_at is not null
      and frozen_at is not null
      and configuration_hash is not null)
  )
);

comment on table public.campaign_versions is
  'Phase 9A campaign version governance. Lifecycle is draft → pending_approval → approved|rejected only.';

create unique index uq_campaign_versions_open_per_campaign
  on public.campaign_versions (campaign_id)
  where status in ('draft', 'pending_approval');

create index idx_campaign_versions_campaign
  on public.campaign_versions (campaign_id, version_number desc);

create table public.campaign_audience_rule_versions (
  id uuid primary key default gen_random_uuid(),
  campaign_version_id uuid not null unique references public.campaign_versions (id) on delete restrict,
  rule_group jsonb not null,
  rule_hash text not null,
  frozen_by uuid null references public.profiles (id) on delete restrict,
  frozen_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_campaign_audience_rule_group check (
    jsonb_typeof(rule_group) = 'object'
    and pg_column_size(rule_group) <= 16384
  ),
  constraint chk_campaign_audience_rule_hash check (rule_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_campaign_audience_frozen_pair check (
    (frozen_by is null and frozen_at is null)
    or (frozen_by is not null and frozen_at is not null)
  )
);

comment on table public.campaign_audience_rule_versions is
  'Phase 9A frozen/unfrozen audience RULE versions. No recipient PII membership.';

create table public.campaign_approvals (
  id uuid primary key default gen_random_uuid(),
  campaign_version_id uuid not null unique references public.campaign_versions (id) on delete restrict,
  decision text not null,
  decided_by uuid not null references public.profiles (id) on delete restrict,
  decided_at timestamptz not null default now(),
  reason text null,
  configuration_hash text not null,
  rule_hash text not null,
  created_at timestamptz not null default now(),
  constraint chk_campaign_approvals_decision check (decision in ('approved', 'rejected')),
  constraint chk_campaign_approvals_reason check (
    (decision = 'approved' and (reason is null or length(trim(reason)) <= 1000))
    or (decision = 'rejected' and length(trim(reason)) between 8 and 1000)
  ),
  constraint chk_campaign_approvals_configuration_hash check (configuration_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_campaign_approvals_rule_hash check (rule_hash ~ '^[0-9a-f]{64}$')
);

comment on table public.campaign_approvals is
  'Append-only Phase 9A approval/rejection evidence. One decision per version. No provider side effect.';

create table private.marketing_idempotency_requests (
  actor_id uuid not null references public.profiles (id) on delete restrict,
  operation text not null,
  idempotency_key uuid not null,
  request_hash text not null,
  response_snapshot jsonb null,
  created_at timestamptz not null default now(),
  primary key (actor_id, operation, idempotency_key),
  constraint chk_marketing_idempotency_operation check (length(trim(operation)) between 1 and 64),
  constraint chk_marketing_idempotency_hash check (request_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_marketing_idempotency_response check (
    response_snapshot is null
    or (jsonb_typeof(response_snapshot) = 'object' and pg_column_size(response_snapshot) <= 8192)
  )
);

comment on table private.marketing_idempotency_requests is
  'Private Phase 9A retry-safe mutation ledger. Not a campaign event store.';

-- ----------------------------------------------------------------------------
-- 3. Triggers
-- ----------------------------------------------------------------------------
create or replace function private.touch_campaign_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create or replace function private.forbid_campaign_root_immutable()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if new.id is distinct from old.id
     or new.campaign_reference is distinct from old.campaign_reference
     or new.created_by is distinct from old.created_by
     or new.created_at is distinct from old.created_at then
    raise exception 'CAMPAIGN_ROOT_IMMUTABLE' using errcode = '22023';
  end if;
  return new;
end;
$$;

create or replace function private.forbid_campaign_version_content_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if old.status <> 'draft' then
    if new.campaign_id is distinct from old.campaign_id
       or new.version_number is distinct from old.version_number
       or new.title is distinct from old.title
       or new.targeting_mode is distinct from old.targeting_mode
       or new.intended_channels is distinct from old.intended_channels
       or new.destination_reference is distinct from old.destination_reference
       or new.budget_snapshot is distinct from old.budget_snapshot
       or new.creative_snapshot is distinct from old.creative_snapshot
       or new.intended_window_snapshot is distinct from old.intended_window_snapshot
       or new.created_by is distinct from old.created_by
       or new.requested_by is distinct from old.requested_by
       or new.requested_at is distinct from old.requested_at
       or new.frozen_at is distinct from old.frozen_at
       or new.configuration_hash is distinct from old.configuration_hash
       or new.created_at is distinct from old.created_at then
      raise exception 'CAMPAIGN_VERSION_IMMUTABLE' using errcode = '22023';
    end if;
  end if;
  if old.status in ('approved', 'rejected') and new.status is distinct from old.status then
    raise exception 'CAMPAIGN_VERSION_TERMINAL' using errcode = '22023';
  end if;
  if old.status = 'pending_approval' and new.status = 'draft' then
    raise exception 'CAMPAIGN_PENDING_TO_DRAFT_DENIED' using errcode = '22023';
  end if;
  return new;
end;
$$;

create or replace function private.forbid_frozen_audience_rule_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if tg_op = 'DELETE' then
    raise exception 'CAMPAIGN_AUDIENCE_RULE_IMMUTABLE' using errcode = '22023';
  end if;
  if old.frozen_at is not null then
    raise exception 'CAMPAIGN_AUDIENCE_RULE_IMMUTABLE' using errcode = '22023';
  end if;
  if new.campaign_version_id is distinct from old.campaign_version_id then
    raise exception 'CAMPAIGN_AUDIENCE_RULE_IMMUTABLE' using errcode = '22023';
  end if;
  return new;
end;
$$;

create or replace function private.forbid_campaign_approvals_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'campaign_approvals is append-only' using errcode = '22023';
end;
$$;

create trigger trg_campaigns_touch_updated_at
  before update on public.campaigns
  for each row execute function private.touch_campaign_updated_at();

create trigger trg_campaigns_root_immutable
  before update on public.campaigns
  for each row execute function private.forbid_campaign_root_immutable();

create trigger trg_campaign_versions_touch_updated_at
  before update on public.campaign_versions
  for each row execute function private.touch_campaign_updated_at();

create trigger trg_campaign_versions_content_immutable
  before update on public.campaign_versions
  for each row execute function private.forbid_campaign_version_content_mutation();

create trigger trg_campaign_audience_rules_touch_updated_at
  before update on public.campaign_audience_rule_versions
  for each row execute function private.touch_campaign_updated_at();

create trigger trg_campaign_audience_rules_frozen
  before update or delete on public.campaign_audience_rule_versions
  for each row execute function private.forbid_frozen_audience_rule_mutation();

create trigger trg_campaign_approvals_append_only
  before update or delete on public.campaign_approvals
  for each row execute function private.forbid_campaign_approvals_mutation();

-- ----------------------------------------------------------------------------
-- 4. Private helpers
-- ----------------------------------------------------------------------------
create or replace function private.marketing_sha256(p_value text)
returns text
language sql
immutable
security definer
set search_path = ''
as $$
  select encode(extensions.digest(convert_to(p_value, 'UTF8'), 'sha256'), 'hex');
$$;

create or replace function private.marketing_idempotency_xact_lock(
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
  v_hash := private.marketing_sha256(
    coalesce(p_actor_id::text, '') || '|' || coalesce(p_operation, '') || '|' || coalesce(p_idempotency_key::text, '')
  );
  perform pg_catalog.pg_advisory_xact_lock(('x' || substr(v_hash, 1, 16))::bit(64)::bigint);
end;
$$;

create or replace function private.marketing_idempotency_lookup(
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
  v_row private.marketing_idempotency_requests%rowtype;
begin
  select * into v_row
  from private.marketing_idempotency_requests
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

create or replace function private.marketing_idempotency_store(
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
  insert into private.marketing_idempotency_requests (
    actor_id, operation, idempotency_key, request_hash, response_snapshot
  ) values (
    p_actor_id, p_operation, p_idempotency_key, p_request_hash, p_response
  );
end;
$$;

create or replace function private.generate_campaign_reference()
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
  v_seq := nextval('private.campaign_reference_seq');
  return 'OD-C-' || v_year || '-' || lpad(v_seq::text, 6, '0');
end;
$$;

create or replace function private.marketing_require_actor(p_permission text)
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
    raise exception 'CAMPAIGN_UNAUTHORIZED' using errcode = '42501';
  end if;
  if not exists (
    select 1 from public.profiles pr
    where pr.id = v_actor and pr.status = 'active'
  ) then
    raise exception 'CAMPAIGN_UNAUTHORIZED' using errcode = '42501';
  end if;
  if p_permission is null or not private.has_permission(p_permission) then
    raise exception 'CAMPAIGN_UNAUTHORIZED' using errcode = '42501';
  end if;
  return v_actor;
end;
$$;

create or replace function private.has_current_marketing_consent(p_contact_id uuid)
returns boolean
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_event_type text;
begin
  if p_contact_id is null then
    return false;
  end if;

  select ce.event_type into v_event_type
  from public.consent_events ce
  where ce.contact_id = p_contact_id
    and ce.purpose_code = 'MARKETING'
  order by ce.occurred_at desc, ce.created_at desc, ce.id desc
  limit 1;

  return coalesce(v_event_type = 'granted', false);
end;
$$;

create or replace function private.canonicalize_campaign_audience_rule_group(p_group jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_logic text;
  v_rule jsonb;
  v_field text;
  v_operator text;
  v_values text[];
  v_distinct text[];
  v_raw_count integer;
  v_rules jsonb := '[]'::jsonb;
begin
  if p_group is null or jsonb_typeof(p_group) <> 'object' then
    raise exception 'CAMPAIGN_VALIDATION: audience rule group required' using errcode = '22023';
  end if;
  if pg_column_size(p_group) > 16384 then
    raise exception 'CAMPAIGN_VALIDATION: audience rule exceeds 16KiB' using errcode = '22023';
  end if;

  v_logic := p_group->>'logic';
  if v_logic not in ('and', 'or') then
    raise exception 'CAMPAIGN_VALIDATION: audience logic must be and|or' using errcode = '22023';
  end if;
  if jsonb_typeof(p_group->'rules') <> 'array' then
    raise exception 'CAMPAIGN_VALIDATION: audience rules required' using errcode = '22023';
  end if;
  if jsonb_array_length(p_group->'rules') < 1 or jsonb_array_length(p_group->'rules') > 20 then
    raise exception 'CAMPAIGN_VALIDATION: audience rules must be 1..20' using errcode = '22023';
  end if;

  for v_rule in
    select value from jsonb_array_elements(p_group->'rules')
  loop
    if jsonb_typeof(v_rule) <> 'object' then
      raise exception 'CAMPAIGN_VALIDATION: invalid audience rule' using errcode = '22023';
    end if;
    v_field := v_rule->>'field';
    v_operator := v_rule->>'operator';
    if v_field not in ('lead_source', 'lead_stage', 'service_interest', 'locality') then
      raise exception 'CAMPAIGN_VALIDATION: unsupported audience field' using errcode = '22023';
    end if;
    if v_operator not in ('equals', 'not_equals', 'in', 'not_in') then
      raise exception 'CAMPAIGN_VALIDATION: unsupported audience operator' using errcode = '22023';
    end if;
    if jsonb_typeof(v_rule->'values') <> 'array' then
      raise exception 'CAMPAIGN_VALIDATION: audience values required' using errcode = '22023';
    end if;

    select coalesce(array_agg(trim(lower(val))), array[]::text[])
    into v_values
    from jsonb_array_elements_text(v_rule->'values') as val;

    v_raw_count := coalesce(cardinality(v_values), 0);
    if v_raw_count < 1 or v_raw_count > 20 then
      raise exception 'CAMPAIGN_VALIDATION: audience values must be 1..20' using errcode = '22023';
    end if;
    if exists (select 1 from unnest(v_values) v where v is null or v = '' or length(v) > 120) then
      raise exception 'CAMPAIGN_VALIDATION: audience value bounds' using errcode = '22023';
    end if;

    select coalesce(array_agg(distinct v order by v), array[]::text[])
    into v_distinct
    from unnest(v_values) v;

    if cardinality(v_distinct) <> v_raw_count then
      raise exception 'CAMPAIGN_VALIDATION: duplicate audience values' using errcode = '22023';
    end if;

    if v_operator in ('equals', 'not_equals') and cardinality(v_distinct) <> 1 then
      raise exception 'CAMPAIGN_VALIDATION: equals/not_equals requires one value' using errcode = '22023';
    end if;

    v_rules := v_rules || jsonb_build_array(
      jsonb_build_object(
        'field', v_field,
        'operator', v_operator,
        'values', to_jsonb(v_distinct)
      )
    );
  end loop;

  select jsonb_build_object(
    'logic', v_logic,
    'rules', coalesce(jsonb_agg(r.elem order by r.elem->>'field', r.elem->>'operator', r.elem->>'values'), '[]'::jsonb)
  )
  into p_group
  from jsonb_array_elements(v_rules) as r(elem);

  return p_group;
end;
$$;

create or replace function private.hash_campaign_audience_rule_group(p_group jsonb)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.marketing_sha256(private.canonicalize_campaign_audience_rule_group(p_group)::text);
$$;

create or replace function private.normalize_campaign_intended_channels(p_channels text[])
returns text[]
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_sorted text[];
begin
  if p_channels is null or cardinality(p_channels) < 1 or cardinality(p_channels) > 4 then
    raise exception 'CAMPAIGN_VALIDATION: intended channels 1..4 required' using errcode = '22023';
  end if;
  if exists (
    select 1 from unnest(p_channels) c
    where c is null or c not in ('meta_ads', 'google_ads', 'email', 'whatsapp')
  ) then
    raise exception 'CAMPAIGN_VALIDATION: invalid intended channel' using errcode = '22023';
  end if;
  select array_agg(distinct c order by c) into v_sorted from unnest(p_channels) c;
  if cardinality(v_sorted) <> cardinality(p_channels) then
    raise exception 'CAMPAIGN_VALIDATION: duplicate intended channels' using errcode = '22023';
  end if;
  return v_sorted;
end;
$$;

create or replace function private.normalize_destination_reference(p_value text)
returns text
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_trim text;
begin
  if p_value is null then
    return null;
  end if;
  v_trim := trim(p_value);
  if v_trim = '' then
    return null;
  end if;
  if length(v_trim) > 500 or v_trim ~ '[[:cntrl:]]' then
    raise exception 'CAMPAIGN_VALIDATION: destination_reference invalid' using errcode = '22023';
  end if;
  return v_trim;
end;
$$;

create or replace function private.normalize_campaign_budget_snapshot(p_budget jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_daily bigint;
  v_total bigint;
begin
  if p_budget is null or jsonb_typeof(p_budget) <> 'object' then
    raise exception 'CAMPAIGN_VALIDATION: budget snapshot required' using errcode = '22023';
  end if;
  if coalesce(p_budget->>'currency', '') <> 'INR' then
    raise exception 'CAMPAIGN_VALIDATION: budget currency must be INR' using errcode = '22023';
  end if;
  if jsonb_typeof(p_budget->'daily_budget_paise') <> 'number' then
    raise exception 'CAMPAIGN_VALIDATION: daily_budget_paise required' using errcode = '22023';
  end if;
  v_daily := (p_budget->>'daily_budget_paise')::bigint;
  if v_daily is null or v_daily < 0 or (p_budget->>'daily_budget_paise') ~ '\.' then
    raise exception 'CAMPAIGN_VALIDATION: daily_budget_paise invalid' using errcode = '22023';
  end if;
  if jsonb_typeof(p_budget->'total_budget_paise') is null
     or jsonb_typeof(p_budget->'total_budget_paise') = 'null' then
    v_total := null;
  else
    if jsonb_typeof(p_budget->'total_budget_paise') <> 'number' then
      raise exception 'CAMPAIGN_VALIDATION: total_budget_paise invalid' using errcode = '22023';
    end if;
    v_total := (p_budget->>'total_budget_paise')::bigint;
    if v_total < 0 or (p_budget->>'total_budget_paise') ~ '\.' then
      raise exception 'CAMPAIGN_VALIDATION: total_budget_paise invalid' using errcode = '22023';
    end if;
  end if;
  return jsonb_build_object(
    'currency', 'INR',
    'daily_budget_paise', v_daily,
    'total_budget_paise', v_total
  );
end;
$$;

create or replace function private.normalize_campaign_creative_snapshot(p_creative jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_headline text;
  v_primary text;
  v_cta text;
  v_media text[];
  v_out jsonb;
begin
  if p_creative is null or jsonb_typeof(p_creative) <> 'object' then
    raise exception 'CAMPAIGN_VALIDATION: creative snapshot required' using errcode = '22023';
  end if;
  v_headline := trim(coalesce(p_creative->>'headline', ''));
  v_primary := trim(coalesce(p_creative->>'primary_text', ''));
  v_cta := trim(coalesce(p_creative->>'call_to_action', ''));
  if length(v_headline) < 1 or length(v_headline) > 200 then
    raise exception 'CAMPAIGN_VALIDATION: headline bounds' using errcode = '22023';
  end if;
  if length(v_primary) < 1 or length(v_primary) > 4000 then
    raise exception 'CAMPAIGN_VALIDATION: primary_text bounds' using errcode = '22023';
  end if;
  if length(v_cta) < 1 or length(v_cta) > 120 then
    raise exception 'CAMPAIGN_VALIDATION: call_to_action bounds' using errcode = '22023';
  end if;

  if p_creative->'media_references' is null then
    v_media := array[]::text[];
  else
    if jsonb_typeof(p_creative->'media_references') <> 'array' or jsonb_array_length(p_creative->'media_references') > 8 then
      raise exception 'CAMPAIGN_VALIDATION: media_references bounds' using errcode = '22023';
    end if;
    select coalesce(array_agg(trim(val)), array[]::text[])
    into v_media
    from jsonb_array_elements_text(p_creative->'media_references') val;
    if exists (
      select 1 from unnest(v_media) m
      where m is null or m = '' or length(m) > 200 or m ~ '[[:cntrl:]]'
    ) then
      raise exception 'CAMPAIGN_VALIDATION: media_references invalid' using errcode = '22023';
    end if;
  end if;

  v_out := jsonb_build_object(
    'headline', v_headline,
    'primary_text', v_primary,
    'call_to_action', v_cta,
    'media_references', to_jsonb(coalesce(v_media, array[]::text[]))
  );
  if pg_column_size(v_out) > 16384 then
    raise exception 'CAMPAIGN_VALIDATION: creative exceeds 16KiB' using errcode = '22023';
  end if;
  return v_out;
end;
$$;

create or replace function private.normalize_campaign_window_snapshot(p_window jsonb)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_start date;
  v_end date;
begin
  if p_window is null or jsonb_typeof(p_window) <> 'object' then
    raise exception 'CAMPAIGN_VALIDATION: intended window required' using errcode = '22023';
  end if;
  begin
    v_start := (p_window->>'start_date')::date;
  exception when others then
    raise exception 'CAMPAIGN_VALIDATION: start_date invalid' using errcode = '22023';
  end;
  if v_start is null then
    raise exception 'CAMPAIGN_VALIDATION: start_date required' using errcode = '22023';
  end if;
  if p_window->'end_date' is null or p_window->>'end_date' = 'null' or trim(coalesce(p_window->>'end_date', '')) = '' then
    v_end := null;
  else
    begin
      v_end := (p_window->>'end_date')::date;
    exception when others then
      raise exception 'CAMPAIGN_VALIDATION: end_date invalid' using errcode = '22023';
    end;
    if v_end < v_start then
      raise exception 'CAMPAIGN_VALIDATION: start_date must be on or before end_date' using errcode = '22023';
    end if;
  end if;
  return jsonb_build_object(
    'start_date', to_char(v_start, 'YYYY-MM-DD'),
    'end_date', case when v_end is null then null else to_char(v_end, 'YYYY-MM-DD') end
  );
end;
$$;

create or replace function private.compute_campaign_configuration_hash(
  p_campaign_reference text,
  p_version_number integer,
  p_title text,
  p_targeting_mode text,
  p_intended_channels text[],
  p_destination_reference text,
  p_budget jsonb,
  p_creative jsonb,
  p_window jsonb,
  p_rule_hash text
)
returns text
language sql
stable
security definer
set search_path = ''
as $$
  select private.marketing_sha256(
    jsonb_build_object(
      'campaign_reference', p_campaign_reference,
      'version_number', p_version_number,
      'title', trim(p_title),
      'targeting_mode', p_targeting_mode,
      'intended_channels', to_jsonb(p_intended_channels),
      'destination_reference', p_destination_reference,
      'budget_snapshot', p_budget,
      'creative_snapshot', p_creative,
      'intended_window_snapshot', p_window,
      'rule_hash', p_rule_hash
    )::text
  );
$$;

create or replace function private.campaign_rule_matches_lead(
  p_rule jsonb,
  p_lead_source text,
  p_lead_status text,
  p_service_code text,
  p_locality text
)
returns boolean
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_field text;
  v_operator text;
  v_actual text;
  v_values text[];
begin
  v_field := p_rule->>'field';
  v_operator := p_rule->>'operator';
  v_actual := case v_field
    when 'lead_source' then lower(trim(coalesce(p_lead_source, '')))
    when 'lead_stage' then lower(trim(coalesce(p_lead_status, '')))
    when 'service_interest' then lower(trim(coalesce(p_service_code, '')))
    when 'locality' then lower(trim(coalesce(p_locality, '')))
    else null
  end;
  if v_actual is null then
    return false;
  end if;
  select coalesce(array_agg(val), array[]::text[])
  into v_values
  from jsonb_array_elements_text(p_rule->'values') val;

  if v_operator = 'equals' then
    return v_actual = v_values[1];
  elsif v_operator = 'not_equals' then
    return v_actual <> v_values[1];
  elsif v_operator = 'in' then
    return v_actual = any (v_values);
  elsif v_operator = 'not_in' then
    return not (v_actual = any (v_values));
  end if;
  return false;
end;
$$;

create or replace function private.campaign_rule_group_matches_lead(
  p_group jsonb,
  p_lead_source text,
  p_lead_status text,
  p_service_code text,
  p_locality text
)
returns boolean
language plpgsql
immutable
security definer
set search_path = ''
as $$
declare
  v_logic text;
  v_rule jsonb;
  v_match boolean;
  v_any boolean := false;
  v_all boolean := true;
begin
  v_logic := p_group->>'logic';
  for v_rule in select value from jsonb_array_elements(p_group->'rules')
  loop
    v_match := private.campaign_rule_matches_lead(
      v_rule, p_lead_source, p_lead_status, p_service_code, p_locality
    );
    v_any := v_any or v_match;
    v_all := v_all and v_match;
  end loop;
  if v_logic = 'or' then
    return v_any;
  end if;
  return v_all;
end;
$$;

create or replace function private.campaign_version_response(p_version public.campaign_versions)
returns jsonb
language sql
stable
security definer
set search_path = ''
as $$
  select jsonb_build_object(
    'campaign_id', p_version.campaign_id,
    'campaign_version_id', p_version.id,
    'version_number', p_version.version_number,
    'status', p_version.status,
    'lock_version', p_version.lock_version,
    'configuration_hash', p_version.configuration_hash,
    'requested_by', p_version.requested_by,
    'requested_at', p_version.requested_at,
    'frozen_at', p_version.frozen_at
  );
$$;

-- ----------------------------------------------------------------------------
-- 5. Public RPCs
-- ----------------------------------------------------------------------------
create or replace function public.record_marketing_consent_event(
  p_contact_id uuid,
  p_event_type text,
  p_channel text,
  p_copy_version text,
  p_notice_version text,
  p_instruction_source text,
  p_note text,
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
  v_copy text;
  v_notice text;
  v_note text;
  v_event_id uuid;
  v_response jsonb;
begin
  v_actor := private.marketing_require_actor('marketing_consents.manage');
  if p_idempotency_key is null then
    raise exception 'CONSENT_VALIDATION: idempotency_key required' using errcode = '22023';
  end if;
  if p_contact_id is null or not exists (select 1 from public.contacts c where c.id = p_contact_id) then
    raise exception 'CONSENT_VALIDATION: contact not found' using errcode = '22023';
  end if;
  if p_event_type not in ('granted', 'withdrawn') then
    raise exception 'CONSENT_VALIDATION: event_type must be granted|withdrawn' using errcode = '22023';
  end if;
  if p_channel not in ('email', 'phone', 'whatsapp', 'in-person') then
    raise exception 'CONSENT_VALIDATION: channel invalid' using errcode = '22023';
  end if;
  if p_instruction_source not in ('phone_call', 'email', 'whatsapp_message', 'in_person', 'other') then
    raise exception 'CONSENT_VALIDATION: instruction_source invalid' using errcode = '22023';
  end if;
  v_copy := trim(coalesce(p_copy_version, ''));
  v_notice := trim(coalesce(p_notice_version, ''));
  if length(v_copy) < 1 or length(v_copy) > 120 or length(v_notice) < 1 or length(v_notice) > 120 then
    raise exception 'CONSENT_VALIDATION: copy/notice bounds' using errcode = '22023';
  end if;
  v_note := nullif(trim(coalesce(p_note, '')), '');
  if v_note is not null and length(v_note) > 500 then
    raise exception 'CONSENT_VALIDATION: note bounds' using errcode = '22023';
  end if;

  v_hash := private.marketing_sha256(
    jsonb_build_object(
      'contact_id', p_contact_id,
      'event_type', p_event_type,
      'channel', p_channel,
      'copy_version', v_copy,
      'notice_version', v_notice,
      'instruction_source', p_instruction_source,
      'note', coalesce(v_note, '')
    )::text
  );

  perform private.marketing_idempotency_xact_lock(v_actor, 'record_marketing_consent_event', p_idempotency_key);
  v_replay := private.marketing_idempotency_lookup(v_actor, 'record_marketing_consent_event', p_idempotency_key, v_hash);
  if v_replay is not null then
    return v_replay;
  end if;

  insert into public.consent_events (
    contact_id,
    lead_id,
    intake_request_id,
    purpose_code,
    channel,
    event_type,
    copy_version,
    notice_version,
    source,
    locale,
    actor_type,
    occurred_at,
    evidence
  ) values (
    p_contact_id,
    null,
    null,
    'MARKETING',
    p_channel,
    p_event_type,
    v_copy,
    v_notice,
    'staff_marketing_consent',
    'en-IN',
    'staff',
    clock_timestamp(),
    jsonb_strip_nulls(jsonb_build_object(
      'instruction_source', p_instruction_source,
      'note', v_note,
      'recorder_profile_id', v_actor
    ))
  )
  returning id into v_event_id;

  v_response := jsonb_build_object(
    'consent_event_id', v_event_id,
    'contact_id', p_contact_id,
    'event_type', p_event_type,
    'purpose_code', 'MARKETING'
  );
  perform private.marketing_idempotency_store(
    v_actor, 'record_marketing_consent_event', p_idempotency_key, v_hash, v_response
  );
  return v_response;
end;
$$;

create or replace function public.get_contact_marketing_consent_state(p_contact_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_latest public.consent_events%rowtype;
  v_contact public.contacts%rowtype;
  v_current boolean;
begin
  v_actor := private.marketing_require_actor('marketing_consents.manage');
  if p_contact_id is null then
    raise exception 'CONSENT_VALIDATION: contact required' using errcode = '22023';
  end if;
  select * into v_contact from public.contacts where id = p_contact_id;
  if not found then
    raise exception 'CONSENT_VALIDATION: contact not found' using errcode = '22023';
  end if;

  select * into v_latest
  from public.consent_events ce
  where ce.contact_id = p_contact_id
    and ce.purpose_code = 'MARKETING'
  order by ce.occurred_at desc, ce.created_at desc, ce.id desc
  limit 1;

  v_current := private.has_current_marketing_consent(p_contact_id);

  return jsonb_build_object(
    'contact_id', p_contact_id,
    'current_granted', v_current,
    'latest_event_type', v_latest.event_type,
    'latest_occurred_at', v_latest.occurred_at,
    'dnc', v_contact.status = 'do_not_contact',
    'contact_status', v_contact.status,
    'email_suppressed', exists (
      select 1 from public.contact_channels ch
      where ch.contact_id = p_contact_id
        and ch.channel_type = 'email'
        and ch.status = 'suppressed'
    ),
    'whatsapp_suppressed', exists (
      select 1 from public.contact_channels ch
      where ch.contact_id = p_contact_id
        and ch.channel_type = 'whatsapp'
        and ch.status = 'suppressed'
    ),
    'outreach_blocked', (
      v_contact.status in ('do_not_contact', 'merged', 'archived')
      or not v_current
    )
  );
end;
$$;

create or replace function public.create_campaign_draft(
  p_name text,
  p_title text,
  p_targeting_mode text,
  p_intended_channels text[],
  p_destination_reference text,
  p_budget_snapshot jsonb,
  p_creative_snapshot jsonb,
  p_intended_window_snapshot jsonb,
  p_rule_group jsonb,
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
  v_name text;
  v_title text;
  v_channels text[];
  v_dest text;
  v_budget jsonb;
  v_creative jsonb;
  v_window jsonb;
  v_rules jsonb;
  v_rule_hash text;
  v_campaign public.campaigns%rowtype;
  v_version public.campaign_versions%rowtype;
  v_response jsonb;
begin
  v_actor := private.marketing_require_actor('campaigns.draft');
  if p_idempotency_key is null then
    raise exception 'CAMPAIGN_VALIDATION: idempotency_key required' using errcode = '22023';
  end if;

  v_name := trim(coalesce(p_name, ''));
  v_title := trim(coalesce(p_title, ''));
  if length(v_name) < 2 or length(v_name) > 160 then
    raise exception 'CAMPAIGN_VALIDATION: name bounds' using errcode = '22023';
  end if;
  if length(v_title) < 2 or length(v_title) > 160 then
    raise exception 'CAMPAIGN_VALIDATION: title bounds' using errcode = '22023';
  end if;
  if p_targeting_mode not in ('broad_public', 'direct_or_custom') then
    raise exception 'CAMPAIGN_VALIDATION: targeting_mode invalid' using errcode = '22023';
  end if;

  v_channels := private.normalize_campaign_intended_channels(p_intended_channels);
  v_dest := private.normalize_destination_reference(p_destination_reference);
  v_budget := private.normalize_campaign_budget_snapshot(p_budget_snapshot);
  v_creative := private.normalize_campaign_creative_snapshot(p_creative_snapshot);
  v_window := private.normalize_campaign_window_snapshot(p_intended_window_snapshot);
  v_rules := private.canonicalize_campaign_audience_rule_group(p_rule_group);
  v_rule_hash := private.marketing_sha256(v_rules::text);

  v_hash := private.marketing_sha256(
    jsonb_build_object(
      'name', v_name,
      'title', v_title,
      'targeting_mode', p_targeting_mode,
      'intended_channels', to_jsonb(v_channels),
      'destination_reference', v_dest,
      'budget_snapshot', v_budget,
      'creative_snapshot', v_creative,
      'intended_window_snapshot', v_window,
      'rule_group', v_rules
    )::text
  );

  perform private.marketing_idempotency_xact_lock(v_actor, 'create_campaign_draft', p_idempotency_key);
  v_replay := private.marketing_idempotency_lookup(v_actor, 'create_campaign_draft', p_idempotency_key, v_hash);
  if v_replay is not null then
    return v_replay;
  end if;

  insert into public.campaigns (campaign_reference, name, created_by)
  values (private.generate_campaign_reference(), v_name, v_actor)
  returning * into v_campaign;

  insert into public.campaign_versions (
    campaign_id, version_number, title, status, targeting_mode, intended_channels,
    destination_reference, budget_snapshot, creative_snapshot, intended_window_snapshot,
    created_by
  ) values (
    v_campaign.id, 1, v_title, 'draft', p_targeting_mode, v_channels,
    v_dest, v_budget, v_creative, v_window, v_actor
  ) returning * into v_version;

  insert into public.campaign_audience_rule_versions (
    campaign_version_id, rule_group, rule_hash
  ) values (
    v_version.id, v_rules, v_rule_hash
  );

  v_response := jsonb_build_object(
    'campaign_id', v_campaign.id,
    'campaign_reference', v_campaign.campaign_reference,
    'campaign_version_id', v_version.id,
    'version_number', 1,
    'status', 'draft',
    'lock_version', 1,
    'rule_hash', v_rule_hash
  );
  perform private.marketing_idempotency_store(v_actor, 'create_campaign_draft', p_idempotency_key, v_hash, v_response);
  return v_response;
end;
$$;

create or replace function public.create_next_campaign_version(
  p_campaign_id uuid,
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
  v_latest public.campaign_versions%rowtype;
  v_rule public.campaign_audience_rule_versions%rowtype;
  v_new public.campaign_versions%rowtype;
  v_response jsonb;
begin
  v_actor := private.marketing_require_actor('campaigns.draft');
  if p_campaign_id is null or p_idempotency_key is null then
    raise exception 'CAMPAIGN_VALIDATION: campaign_id and idempotency_key required' using errcode = '22023';
  end if;
  v_hash := private.marketing_sha256(p_campaign_id::text);

  perform private.marketing_idempotency_xact_lock(v_actor, 'create_next_campaign_version', p_idempotency_key);
  v_replay := private.marketing_idempotency_lookup(v_actor, 'create_next_campaign_version', p_idempotency_key, v_hash);
  if v_replay is not null then
    return v_replay;
  end if;

  perform 1 from public.campaigns c where c.id = p_campaign_id for update;
  if not found then
    raise exception 'CAMPAIGN_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  if exists (
    select 1 from public.campaign_versions v
    where v.campaign_id = p_campaign_id
      and v.status in ('draft', 'pending_approval')
  ) then
    raise exception 'CAMPAIGN_VALIDATION: open draft or pending version exists' using errcode = '22023';
  end if;

  select * into v_latest
  from public.campaign_versions v
  where v.campaign_id = p_campaign_id
  order by v.version_number desc
  limit 1
  for update;

  if not found or v_latest.status not in ('approved', 'rejected') then
    raise exception 'CAMPAIGN_VALIDATION: next version requires terminal prior version' using errcode = '22023';
  end if;
  if v_latest.version_number >= 9999 then
    raise exception 'CAMPAIGN_VALIDATION: version_number overflow' using errcode = '22023';
  end if;

  select * into v_rule
  from public.campaign_audience_rule_versions r
  where r.campaign_version_id = v_latest.id;

  insert into public.campaign_versions (
    campaign_id, version_number, title, status, targeting_mode, intended_channels,
    destination_reference, budget_snapshot, creative_snapshot, intended_window_snapshot,
    created_by
  ) values (
    p_campaign_id,
    v_latest.version_number + 1,
    v_latest.title,
    'draft',
    v_latest.targeting_mode,
    v_latest.intended_channels,
    v_latest.destination_reference,
    v_latest.budget_snapshot,
    v_latest.creative_snapshot,
    v_latest.intended_window_snapshot,
    v_actor
  ) returning * into v_new;

  insert into public.campaign_audience_rule_versions (
    campaign_version_id, rule_group, rule_hash
  ) values (
    v_new.id, v_rule.rule_group, v_rule.rule_hash
  );

  v_response := jsonb_build_object(
    'campaign_id', p_campaign_id,
    'campaign_version_id', v_new.id,
    'version_number', v_new.version_number,
    'status', 'draft',
    'lock_version', v_new.lock_version,
    'cloned_from_version_id', v_latest.id
  );
  perform private.marketing_idempotency_store(v_actor, 'create_next_campaign_version', p_idempotency_key, v_hash, v_response);
  return v_response;
end;
$$;

create or replace function public.save_campaign_draft(
  p_campaign_version_id uuid,
  p_expected_lock_version integer,
  p_title text,
  p_targeting_mode text,
  p_intended_channels text[],
  p_destination_reference text,
  p_budget_snapshot jsonb,
  p_creative_snapshot jsonb,
  p_intended_window_snapshot jsonb,
  p_rule_group jsonb,
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
  v_title text;
  v_channels text[];
  v_dest text;
  v_budget jsonb;
  v_creative jsonb;
  v_window jsonb;
  v_rules jsonb;
  v_rule_hash text;
  v_version public.campaign_versions%rowtype;
  v_response jsonb;
begin
  v_actor := private.marketing_require_actor('campaigns.draft');
  if p_campaign_version_id is null or p_idempotency_key is null or p_expected_lock_version is null then
    raise exception 'CAMPAIGN_VALIDATION: version, lock, and idempotency_key required' using errcode = '22023';
  end if;

  v_title := trim(coalesce(p_title, ''));
  if length(v_title) < 2 or length(v_title) > 160 then
    raise exception 'CAMPAIGN_VALIDATION: title bounds' using errcode = '22023';
  end if;
  if p_targeting_mode not in ('broad_public', 'direct_or_custom') then
    raise exception 'CAMPAIGN_VALIDATION: targeting_mode invalid' using errcode = '22023';
  end if;
  v_channels := private.normalize_campaign_intended_channels(p_intended_channels);
  v_dest := private.normalize_destination_reference(p_destination_reference);
  v_budget := private.normalize_campaign_budget_snapshot(p_budget_snapshot);
  v_creative := private.normalize_campaign_creative_snapshot(p_creative_snapshot);
  v_window := private.normalize_campaign_window_snapshot(p_intended_window_snapshot);
  v_rules := private.canonicalize_campaign_audience_rule_group(p_rule_group);
  v_rule_hash := private.marketing_sha256(v_rules::text);

  v_hash := private.marketing_sha256(
    jsonb_build_object(
      'campaign_version_id', p_campaign_version_id,
      'expected_lock_version', p_expected_lock_version,
      'title', v_title,
      'targeting_mode', p_targeting_mode,
      'intended_channels', to_jsonb(v_channels),
      'destination_reference', v_dest,
      'budget_snapshot', v_budget,
      'creative_snapshot', v_creative,
      'intended_window_snapshot', v_window,
      'rule_group', v_rules
    )::text
  );

  perform private.marketing_idempotency_xact_lock(v_actor, 'save_campaign_draft', p_idempotency_key);
  v_replay := private.marketing_idempotency_lookup(v_actor, 'save_campaign_draft', p_idempotency_key, v_hash);
  if v_replay is not null then
    return v_replay;
  end if;

  select * into v_version
  from public.campaign_versions
  where id = p_campaign_version_id
  for update;
  if not found then
    raise exception 'CAMPAIGN_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;
  if v_version.status <> 'draft' then
    raise exception 'CAMPAIGN_VALIDATION: save allowed only on draft' using errcode = '22023';
  end if;
  if v_version.lock_version <> p_expected_lock_version then
    raise exception 'CAMPAIGN_DRAFT_CONFLICT' using errcode = 'P0002';
  end if;

  update public.campaign_versions
  set
    title = v_title,
    targeting_mode = p_targeting_mode,
    intended_channels = v_channels,
    destination_reference = v_dest,
    budget_snapshot = v_budget,
    creative_snapshot = v_creative,
    intended_window_snapshot = v_window,
    lock_version = lock_version + 1
  where id = p_campaign_version_id
  returning * into v_version;

  update public.campaign_audience_rule_versions
  set rule_group = v_rules, rule_hash = v_rule_hash
  where campaign_version_id = p_campaign_version_id
    and frozen_at is null;

  v_response := jsonb_build_object(
    'campaign_version_id', v_version.id,
    'status', v_version.status,
    'lock_version', v_version.lock_version,
    'rule_hash', v_rule_hash
  );
  perform private.marketing_idempotency_store(v_actor, 'save_campaign_draft', p_idempotency_key, v_hash, v_response);
  return v_response;
end;
$$;

create or replace function public.request_campaign_approval(
  p_campaign_version_id uuid,
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
  v_version public.campaign_versions%rowtype;
  v_campaign public.campaigns%rowtype;
  v_rule public.campaign_audience_rule_versions%rowtype;
  v_rules jsonb;
  v_rule_hash text;
  v_config_hash text;
  v_response jsonb;
begin
  v_actor := private.marketing_require_actor('campaigns.request_approval');
  if p_campaign_version_id is null or p_expected_lock_version is null or p_idempotency_key is null then
    raise exception 'CAMPAIGN_VALIDATION: version, lock, and idempotency_key required' using errcode = '22023';
  end if;
  v_hash := private.marketing_sha256(
    p_campaign_version_id::text || '|' || p_expected_lock_version::text
  );

  perform private.marketing_idempotency_xact_lock(v_actor, 'request_campaign_approval', p_idempotency_key);
  v_replay := private.marketing_idempotency_lookup(v_actor, 'request_campaign_approval', p_idempotency_key, v_hash);
  if v_replay is not null then
    return v_replay;
  end if;

  select * into v_version from public.campaign_versions where id = p_campaign_version_id for update;
  if not found then
    raise exception 'CAMPAIGN_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;
  if v_version.status <> 'draft' then
    raise exception 'CAMPAIGN_VALIDATION: request approval allowed only on draft' using errcode = '22023';
  end if;
  if v_version.lock_version <> p_expected_lock_version then
    raise exception 'CAMPAIGN_DRAFT_CONFLICT' using errcode = 'P0002';
  end if;

  select * into v_campaign from public.campaigns where id = v_version.campaign_id for update;
  select * into v_rule from public.campaign_audience_rule_versions
  where campaign_version_id = v_version.id for update;
  if not found then
    raise exception 'CAMPAIGN_VALIDATION: audience rule required' using errcode = '22023';
  end if;

  v_rules := private.canonicalize_campaign_audience_rule_group(v_rule.rule_group);
  v_rule_hash := private.marketing_sha256(v_rules::text);
  v_config_hash := private.compute_campaign_configuration_hash(
    v_campaign.campaign_reference,
    v_version.version_number,
    v_version.title,
    v_version.targeting_mode,
    v_version.intended_channels,
    v_version.destination_reference,
    v_version.budget_snapshot,
    v_version.creative_snapshot,
    v_version.intended_window_snapshot,
    v_rule_hash
  );

  update public.campaign_audience_rule_versions
  set
    rule_group = v_rules,
    rule_hash = v_rule_hash,
    frozen_by = v_actor,
    frozen_at = now()
  where id = v_rule.id
    and frozen_at is null;

  update public.campaign_versions
  set
    status = 'pending_approval',
    requested_by = v_actor,
    requested_at = now(),
    frozen_at = now(),
    configuration_hash = v_config_hash,
    lock_version = lock_version + 1
  where id = v_version.id
  returning * into v_version;

  v_response := jsonb_build_object(
    'campaign_version_id', v_version.id,
    'status', v_version.status,
    'lock_version', v_version.lock_version,
    'configuration_hash', v_config_hash,
    'rule_hash', v_rule_hash,
    'requested_by', v_actor,
    'requested_at', v_version.requested_at,
    'frozen_at', v_version.frozen_at
  );
  perform private.marketing_idempotency_store(v_actor, 'request_campaign_approval', p_idempotency_key, v_hash, v_response);
  return v_response;
end;
$$;

create or replace function public.decide_campaign_version(
  p_campaign_version_id uuid,
  p_decision text,
  p_reason text,
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
  v_version public.campaign_versions%rowtype;
  v_rule public.campaign_audience_rule_versions%rowtype;
  v_reason text;
  v_response jsonb;
begin
  v_actor := private.marketing_require_actor('campaigns.approve');
  if p_campaign_version_id is null or p_idempotency_key is null then
    raise exception 'CAMPAIGN_VALIDATION: version and idempotency_key required' using errcode = '22023';
  end if;
  if p_decision not in ('approved', 'rejected') then
    raise exception 'CAMPAIGN_VALIDATION: decision must be approved|rejected' using errcode = '22023';
  end if;
  v_reason := nullif(trim(coalesce(p_reason, '')), '');
  if p_decision = 'rejected' and (v_reason is null or length(v_reason) < 8 or length(v_reason) > 1000) then
    raise exception 'CAMPAIGN_VALIDATION: rejection reason 8..1000 required' using errcode = '22023';
  end if;
  if p_decision = 'approved' and v_reason is not null and length(v_reason) > 1000 then
    raise exception 'CAMPAIGN_VALIDATION: approval reason bounds' using errcode = '22023';
  end if;

  v_hash := private.marketing_sha256(
    jsonb_build_object(
      'campaign_version_id', p_campaign_version_id,
      'decision', p_decision,
      'reason', coalesce(v_reason, '')
    )::text
  );

  perform private.marketing_idempotency_xact_lock(v_actor, 'decide_campaign_version', p_idempotency_key);
  v_replay := private.marketing_idempotency_lookup(v_actor, 'decide_campaign_version', p_idempotency_key, v_hash);
  if v_replay is not null then
    return v_replay;
  end if;

  select * into v_version from public.campaign_versions where id = p_campaign_version_id for update;
  if not found then
    raise exception 'CAMPAIGN_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;
  if v_version.status <> 'pending_approval' then
    raise exception 'CAMPAIGN_VALIDATION: decide allowed only on pending_approval' using errcode = '22023';
  end if;
  if exists (select 1 from public.campaign_approvals a where a.campaign_version_id = v_version.id) then
    raise exception 'CAMPAIGN_VALIDATION: approval already recorded' using errcode = '22023';
  end if;

  select * into v_rule from public.campaign_audience_rule_versions
  where campaign_version_id = v_version.id;
  if v_rule.frozen_at is null or v_version.configuration_hash is null then
    raise exception 'CAMPAIGN_VALIDATION: frozen configuration required' using errcode = '22023';
  end if;

  if not private.has_role('super_admin') then
    if v_version.created_by = v_actor or v_version.requested_by = v_actor then
      raise exception 'CAMPAIGN_SELF_APPROVAL_DENIED' using errcode = '42501';
    end if;
  end if;

  insert into public.campaign_approvals (
    campaign_version_id, decision, decided_by, reason, configuration_hash, rule_hash
  ) values (
    v_version.id, p_decision, v_actor, v_reason, v_version.configuration_hash, v_rule.rule_hash
  );

  update public.campaign_versions
  set status = p_decision, lock_version = lock_version + 1
  where id = v_version.id
  returning * into v_version;

  v_response := jsonb_build_object(
    'campaign_version_id', v_version.id,
    'status', v_version.status,
    'decision', p_decision,
    'configuration_hash', v_version.configuration_hash,
    'rule_hash', v_rule.rule_hash
  );
  perform private.marketing_idempotency_store(v_actor, 'decide_campaign_version', p_idempotency_key, v_hash, v_response);
  return v_response;
end;
$$;

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
    from public.leads l
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

-- ----------------------------------------------------------------------------
-- 6. RLS / ACL
-- ----------------------------------------------------------------------------
alter table public.campaigns enable row level security;
alter table public.campaign_versions enable row level security;
alter table public.campaign_audience_rule_versions enable row level security;
alter table public.campaign_approvals enable row level security;

revoke all on table public.campaigns from public, anon, authenticated;
revoke all on table public.campaign_versions from public, anon, authenticated;
revoke all on table public.campaign_audience_rule_versions from public, anon, authenticated;
revoke all on table public.campaign_approvals from public, anon, authenticated;
revoke all on table private.marketing_idempotency_requests from public, anon, authenticated;
revoke all on sequence private.campaign_reference_seq from public, anon, authenticated;

grant select on table public.campaigns to authenticated;
grant select on table public.campaign_versions to authenticated;
grant select on table public.campaign_audience_rule_versions to authenticated;
grant select on table public.campaign_approvals to authenticated;

create policy campaigns_select on public.campaigns
  for select to authenticated
  using ((select public.authorize('campaigns.read')));

create policy campaign_versions_select on public.campaign_versions
  for select to authenticated
  using ((select public.authorize('campaigns.read')));

create policy campaign_audience_rule_versions_select on public.campaign_audience_rule_versions
  for select to authenticated
  using ((select public.authorize('campaigns.read')));

create policy campaign_approvals_select on public.campaign_approvals
  for select to authenticated
  using ((select public.authorize('campaigns.read')));

-- SA/SM MARKETING evidence history (lead_id is NULL on staff capture).
-- Does not use consents.read alone, so Sales Executive is not broadened.
create policy consent_events_select_marketing_staff
  on public.consent_events
  for select to authenticated
  using (
    purpose_code = 'MARKETING'
    and (select public.authorize('marketing_consents.manage'))
    and exists (
      select 1
      from public.leads l
      where l.contact_id = consent_events.contact_id
        and (select private.crm_can_view_lead(l.assigned_to))
    )
  );

-- ----------------------------------------------------------------------------
-- 7. Function ownership and execute ACL
-- ----------------------------------------------------------------------------
do $$
declare
  r record;
begin
  for r in
    select p.oid::regprocedure as sig, n.nspname as nsp
    from pg_proc p
    join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('private', 'public')
      and p.proname in (
        'touch_campaign_updated_at',
        'forbid_campaign_root_immutable',
        'forbid_campaign_version_content_mutation',
        'forbid_frozen_audience_rule_mutation',
        'forbid_campaign_approvals_mutation',
        'marketing_sha256',
        'marketing_idempotency_xact_lock',
        'marketing_idempotency_lookup',
        'marketing_idempotency_store',
        'generate_campaign_reference',
        'marketing_require_actor',
        'has_current_marketing_consent',
        'canonicalize_campaign_audience_rule_group',
        'hash_campaign_audience_rule_group',
        'normalize_campaign_intended_channels',
        'normalize_destination_reference',
        'normalize_campaign_budget_snapshot',
        'normalize_campaign_creative_snapshot',
        'normalize_campaign_window_snapshot',
        'compute_campaign_configuration_hash',
        'campaign_rule_matches_lead',
        'campaign_rule_group_matches_lead',
        'campaign_version_response',
        'record_marketing_consent_event',
        'get_contact_marketing_consent_state',
        'create_campaign_draft',
        'create_next_campaign_version',
        'save_campaign_draft',
        'request_campaign_approval',
        'decide_campaign_version',
        'preview_campaign_audience'
      )
  loop
    execute format('alter function %s owner to postgres', r.sig);
    execute format('revoke all on function %s from public, anon, authenticated', r.sig);
    if r.nsp = 'public' then
      execute format('grant execute on function %s to authenticated', r.sig);
    end if;
  end loop;
end;
$$;

revoke execute on function public.record_marketing_consent_event(uuid, text, text, text, text, text, text, uuid) from public, anon;
revoke execute on function public.get_contact_marketing_consent_state(uuid) from public, anon;
revoke execute on function public.create_campaign_draft(text, text, text, text[], text, jsonb, jsonb, jsonb, jsonb, uuid) from public, anon;
revoke execute on function public.create_next_campaign_version(uuid, uuid) from public, anon;
revoke execute on function public.save_campaign_draft(uuid, integer, text, text, text[], text, jsonb, jsonb, jsonb, jsonb, uuid) from public, anon;
revoke execute on function public.request_campaign_approval(uuid, integer, uuid) from public, anon;
revoke execute on function public.decide_campaign_version(uuid, text, text, uuid) from public, anon;
revoke execute on function public.preview_campaign_audience(uuid) from public, anon;
