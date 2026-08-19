-- ============================================================================
-- M33 Migration: ONEDECORE Phase 9C-B Campaign Execution Foundation
-- Architecture: ADR-0031 / DEC-0085 / OD9C-1..18 / OD9C-A / OD9C-B / OD9C-C
-- Forward-only. Does not rewrite M1-M32. NOT managed-applied in this gate.
-- Mock dispatch only. No Meta/Google Ads provider objects as live writes.
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. Permissions
-- ----------------------------------------------------------------------------
insert into public.permissions (code, name, description, is_system, is_active) values
  ('campaigns.execute', 'Execute campaigns', 'Create/schedule runs from approved immutable campaign versions', true, true),
  ('campaigns.pause', 'Pause campaign runs', 'Pause and resume paid campaign runs', true, true),
  ('campaigns.metrics.read', 'Read campaign execution metrics', 'Read campaign run/operation evidence (9C-B foundation)', true, true)
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
  and p.code in ('campaigns.execute', 'campaigns.pause', 'campaigns.metrics.read')
  and r.code in ('super_admin', 'sales_manager')
on conflict (role_id, permission_id) do nothing;

-- ----------------------------------------------------------------------------
-- 2. Sequences / tables
-- ----------------------------------------------------------------------------
create sequence private.campaign_run_reference_seq start with 1 increment by 1;
create sequence private.campaign_run_target_reference_seq start with 1 increment by 1;

create table public.campaign_runs (
  id uuid primary key default gen_random_uuid(),
  run_reference text not null unique,
  campaign_version_id uuid not null references public.campaign_versions (id) on delete restrict,
  provider_channel text not null,
  status text not null,
  requested_by uuid not null references public.profiles (id) on delete restrict,
  requested_at timestamptz not null default now(),
  scheduled_for timestamptz not null default now(),
  activated_by uuid null references public.profiles (id) on delete restrict,
  activated_at timestamptz null,
  paused_at timestamptz null,
  completed_at timestamptz null,
  failed_at timestamptz null,
  cancelled_at timestamptz null,
  cancelled_by uuid null references public.profiles (id) on delete restrict,
  configuration_hash text not null,
  audience_rule_hash text not null,
  destination_snapshot jsonb not null,
  deferred_channels text[] not null default '{}',
  targeting_mode text not null,
  failure_code text null,
  failure_reason text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  lock_version integer not null default 1,
  constraint chk_campaign_runs_reference check (run_reference ~ '^OD-CR-[0-9]{4}-[0-9]{6}$'),
  constraint chk_campaign_runs_provider check (provider_channel in ('meta_ads', 'google_ads')),
  constraint chk_campaign_runs_status check (
    status in ('scheduled', 'running', 'paused', 'completed', 'failed', 'cancelled')
  ),
  constraint chk_campaign_runs_hashes check (
    configuration_hash ~ '^[0-9a-f]{64}$' and audience_rule_hash ~ '^[0-9a-f]{64}$'
  ),
  constraint chk_campaign_runs_destination check (
    jsonb_typeof(destination_snapshot) = 'object'
    and pg_column_size(destination_snapshot) <= 2048
  ),
  constraint chk_campaign_runs_failure_code check (
    failure_code is null or (length(trim(failure_code)) between 1 and 80 and failure_code !~ '[[:cntrl:]]')
  ),
  constraint chk_campaign_runs_failure_reason check (
    failure_reason is null or (length(trim(failure_reason)) between 1 and 500 and failure_reason !~ '[[:cntrl:]]')
  ),
  constraint chk_campaign_runs_lock check (lock_version >= 1),
  constraint chk_campaign_runs_targeting check (targeting_mode in ('broad_public', 'direct_or_custom'))
);

comment on table public.campaign_runs is
  'Phase 9C-B campaign run. One Ads provider per run. No secrets. No PII recipient list.';

create table public.campaign_run_targets (
  id uuid primary key default gen_random_uuid(),
  campaign_run_id uuid not null unique references public.campaign_runs (id) on delete restrict,
  run_target_reference text not null unique,
  provider_channel text not null,
  account_reference text null,
  provider_campaign_id text null,
  provider_ad_set_id text null,
  provider_ad_group_id text null,
  provider_status text null,
  last_synced_at timestamptz null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_campaign_run_targets_reference check (run_target_reference ~ '^OD-CRT-[0-9]{4}-[0-9]{6}$'),
  constraint chk_campaign_run_targets_provider check (provider_channel in ('meta_ads', 'google_ads')),
  constraint chk_campaign_run_targets_account check (
    account_reference is null or (length(trim(account_reference)) between 1 and 64 and account_reference !~ '[[:cntrl:]]')
  ),
  constraint chk_campaign_run_targets_provider_ids check (
    (provider_campaign_id is null or (length(provider_campaign_id) between 1 and 128 and provider_campaign_id !~ '[[:cntrl:]]'))
    and (provider_ad_set_id is null or (length(provider_ad_set_id) between 1 and 128 and provider_ad_set_id !~ '[[:cntrl:]]'))
    and (provider_ad_group_id is null or (length(provider_ad_group_id) between 1 and 128 and provider_ad_group_id !~ '[[:cntrl:]]'))
    and (provider_status is null or (length(provider_status) between 1 and 64 and provider_status !~ '[[:cntrl:]]'))
  )
);

comment on table public.campaign_run_targets is
  'Exactly one provider target per campaign_run (UNIQUE campaign_run_id). No tokens. No CRM PII.';

create table public.campaign_run_operations (
  id uuid primary key default gen_random_uuid(),
  campaign_run_id uuid not null references public.campaign_runs (id) on delete restrict,
  campaign_run_target_id uuid not null references public.campaign_run_targets (id) on delete restrict,
  operation_type text not null,
  operation_state text not null,
  operation_key text not null unique,
  request_hash text not null,
  attempt_count integer not null default 0,
  max_attempts integer not null default 5,
  next_attempt_at timestamptz not null default now(),
  claimed_by text null,
  claimed_at timestamptz null,
  claim_expires_at timestamptz null,
  last_error_code text null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  completed_at timestamptz null,
  constraint chk_campaign_run_operations_type check (
    operation_type in ('create', 'activate', 'pause', 'resume', 'cancel', 'sync')
  ),
  constraint chk_campaign_run_operations_state check (
    operation_state in ('pending', 'claimed', 'succeeded', 'failed', 'needs_reconcile', 'cancelled')
  ),
  constraint chk_campaign_run_operations_key check (length(trim(operation_key)) between 8 and 128),
  constraint chk_campaign_run_operations_hash check (request_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_campaign_run_operations_attempts check (
    attempt_count >= 0 and max_attempts between 1 and 8 and attempt_count <= max_attempts + 1
  ),
  constraint chk_campaign_run_operations_error check (
    last_error_code is null or (length(trim(last_error_code)) between 1 and 80 and last_error_code !~ '[[:cntrl:]]')
  ),
  constraint chk_campaign_run_operations_claim_by check (
    claimed_by is null or (length(trim(claimed_by)) between 1 and 80 and claimed_by !~ '[[:cntrl:]]')
  )
);

create index idx_campaign_run_operations_claim
  on public.campaign_run_operations (next_attempt_at)
  where operation_state in ('pending', 'claimed');

create table public.campaign_execution_events (
  id uuid primary key default gen_random_uuid(),
  campaign_run_id uuid not null references public.campaign_runs (id) on delete restrict,
  campaign_run_target_id uuid null references public.campaign_run_targets (id) on delete restrict,
  campaign_run_operation_id uuid null references public.campaign_run_operations (id) on delete restrict,
  event_type text not null,
  outcome_code text not null,
  provider_object_id text null,
  metadata jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),
  actor_id uuid null references public.profiles (id) on delete restrict,
  actor_kind text not null default 'staff',
  constraint chk_campaign_execution_events_type check (
    length(trim(event_type)) between 1 and 64 and event_type !~ '[[:cntrl:]]'
  ),
  constraint chk_campaign_execution_events_outcome check (
    length(trim(outcome_code)) between 1 and 80 and outcome_code !~ '[[:cntrl:]]'
  ),
  constraint chk_campaign_execution_events_provider_id check (
    provider_object_id is null or (length(provider_object_id) between 1 and 128 and provider_object_id !~ '[[:cntrl:]]')
  ),
  constraint chk_campaign_execution_events_metadata check (
    jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 2048
  ),
  constraint chk_campaign_execution_events_actor_kind check (actor_kind in ('staff', 'service', 'system'))
);

create table private.marketing_execution_idempotency_requests (
  actor_id uuid not null,
  operation text not null,
  idempotency_key uuid not null,
  request_hash text not null,
  response_snapshot jsonb not null,
  created_at timestamptz not null default now(),
  primary key (actor_id, operation, idempotency_key),
  constraint chk_mkt_exec_idem_operation check (length(trim(operation)) between 1 and 64),
  constraint chk_mkt_exec_idem_hash check (request_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_mkt_exec_idem_response check (
    jsonb_typeof(response_snapshot) = 'object' and pg_column_size(response_snapshot) <= 4096
  )
);

comment on table private.marketing_execution_idempotency_requests is
  'Dedicated Phase 9C execution idempotency ledger. Do not reuse M31/M32 ledgers.';

-- ----------------------------------------------------------------------------
-- 3. Triggers
-- ----------------------------------------------------------------------------
create or replace function private.forbid_campaign_execution_event_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'CAMPAIGN_EXECUTION_EVENT_IMMUTABLE' using errcode = '22023';
end;
$$;

create trigger trg_campaign_execution_events_no_update
  before update or delete on public.campaign_execution_events
  for each row execute function private.forbid_campaign_execution_event_mutation();

create or replace function private.enforce_campaign_run_target_channel()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_channel text;
begin
  select provider_channel into v_channel
  from public.campaign_runs
  where id = new.campaign_run_id;

  if v_channel is distinct from new.provider_channel then
    raise exception 'CAMPAIGN_RUN_TARGET_PROVIDER_MISMATCH' using errcode = '22023';
  end if;
  return new;
end;
$$;

create trigger trg_campaign_run_targets_channel
  before insert or update on public.campaign_run_targets
  for each row execute function private.enforce_campaign_run_target_channel();

create or replace function private.touch_campaign_run_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

create trigger trg_campaign_runs_updated
  before update on public.campaign_runs
  for each row execute function private.touch_campaign_run_updated_at();

create trigger trg_campaign_run_targets_updated
  before update on public.campaign_run_targets
  for each row execute function private.touch_campaign_run_updated_at();

create trigger trg_campaign_run_operations_updated
  before update on public.campaign_run_operations
  for each row execute function private.touch_campaign_run_updated_at();

-- ----------------------------------------------------------------------------
-- 4. Helpers
-- ----------------------------------------------------------------------------
create or replace function private.generate_campaign_run_reference()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year text;
  v_seq bigint;
begin
  v_year := to_char((now() at time zone 'Asia/Kolkata'), 'YYYY');
  v_seq := nextval('private.campaign_run_reference_seq');
  return 'OD-CR-' || v_year || '-' || lpad(v_seq::text, 6, '0');
end;
$$;

create or replace function private.generate_campaign_run_target_reference()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_year text;
  v_seq bigint;
begin
  v_year := to_char((now() at time zone 'Asia/Kolkata'), 'YYYY');
  v_seq := nextval('private.campaign_run_target_reference_seq');
  return 'OD-CRT-' || v_year || '-' || lpad(v_seq::text, 6, '0');
end;
$$;

create or replace function private.marketing_execution_idempotency_xact_lock(
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

create or replace function private.marketing_execution_idempotency_lookup(
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
  v_row private.marketing_execution_idempotency_requests%rowtype;
begin
  select * into v_row
  from private.marketing_execution_idempotency_requests
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

create or replace function private.marketing_execution_idempotency_store(
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
  insert into private.marketing_execution_idempotency_requests (
    actor_id, operation, idempotency_key, request_hash, response_snapshot
  ) values (
    p_actor_id, p_operation, p_idempotency_key, p_request_hash, p_response
  );
end;
$$;

create or replace function private.append_campaign_execution_event(
  p_run_id uuid,
  p_target_id uuid,
  p_operation_id uuid,
  p_event_type text,
  p_outcome text,
  p_provider_object_id text,
  p_metadata jsonb,
  p_actor_id uuid,
  p_actor_kind text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.campaign_execution_events (
    campaign_run_id, campaign_run_target_id, campaign_run_operation_id,
    event_type, outcome_code, provider_object_id, metadata, actor_id, actor_kind
  ) values (
    p_run_id, p_target_id, p_operation_id,
    p_event_type, p_outcome, p_provider_object_id, coalesce(p_metadata, '{}'::jsonb),
    p_actor_id, coalesce(p_actor_kind, 'system')
  );
end;
$$;

create or replace function private.enqueue_campaign_run_operation(
  p_run public.campaign_runs,
  p_target_id uuid,
  p_type text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_key text;
  v_hash text;
begin
  v_key := p_run.run_reference || ':' || p_type || ':' || to_char(clock_timestamp(), 'YYYYMMDDHH24MISSUS');
  if length(v_key) > 128 then
    v_key := substr(v_key, 1, 128);
  end if;
  v_hash := private.marketing_sha256(p_run.id::text || '|' || p_type || '|' || v_key);
  insert into public.campaign_run_operations (
    campaign_run_id, campaign_run_target_id, operation_type, operation_state,
    operation_key, request_hash
  ) values (
    p_run.id, p_target_id, p_type, 'pending', v_key, v_hash
  )
  returning id into v_id;
  return v_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 5. Staff RPCs
-- ----------------------------------------------------------------------------
create or replace function public.create_campaign_run(
  p_campaign_version_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_version public.campaign_versions%rowtype;
  v_campaign public.campaigns%rowtype;
  v_approval public.campaign_approvals%rowtype;
  v_rule public.campaign_audience_rule_versions%rowtype;
  v_paid text[];
  v_deferred text[];
  v_hash text;
  v_replay jsonb;
  v_run public.campaign_runs%rowtype;
  v_target public.campaign_run_targets%rowtype;
  v_op_id uuid;
  v_snapshot jsonb;
  v_dest text;
begin
  v_actor := private.marketing_require_actor('campaigns.execute');

  if p_campaign_version_id is null or p_idempotency_key is null then
    raise exception 'CAMPAIGN_VALIDATION' using errcode = '22023';
  end if;

  v_hash := private.marketing_sha256(v_actor::text || '|create_campaign_run|' || p_campaign_version_id::text);
  perform private.marketing_execution_idempotency_xact_lock(v_actor, 'create_campaign_run', p_idempotency_key);
  v_replay := private.marketing_execution_idempotency_lookup(v_actor, 'create_campaign_run', p_idempotency_key, v_hash);
  if v_replay is not null then
    return v_replay;
  end if;

  select * into v_version from public.campaign_versions where id = p_campaign_version_id;
  if not found then
    raise exception 'CAMPAIGN_NOT_FOUND_OR_FORBIDDEN' using errcode = 'P0002';
  end if;

  if v_version.status is distinct from 'approved' then
    raise exception 'CAMPAIGN_VERSION_NOT_APPROVED' using errcode = '22023';
  end if;

  select * into v_approval
  from public.campaign_approvals
  where campaign_version_id = v_version.id and decision = 'approved';
  if not found then
    raise exception 'CAMPAIGN_APPROVAL_REQUIRED' using errcode = '22023';
  end if;

  select * into v_rule
  from public.campaign_audience_rule_versions
  where campaign_version_id = v_version.id;
  if not found or v_rule.frozen_at is null then
    raise exception 'CAMPAIGN_AUDIENCE_RULE_REQUIRED' using errcode = '22023';
  end if;

  if v_version.configuration_hash is distinct from v_approval.configuration_hash
     or v_rule.rule_hash is distinct from v_approval.rule_hash
     or v_version.configuration_hash is null then
    raise exception 'CAMPAIGN_APPROVED_HASH_MISMATCH' using errcode = '22023';
  end if;

  select array_agg(c order by c) into v_paid
  from unnest(v_version.intended_channels) c
  where c in ('meta_ads', 'google_ads');

  if v_paid is null or cardinality(v_paid) = 0 then
    raise exception 'CAMPAIGN_NO_PAID_ADS_CHANNEL' using errcode = '22023';
  end if;
  if cardinality(v_paid) > 1 then
    raise exception 'MULTI_PROVIDER_EXECUTION_REQUIRES_SEPARATE_APPROVED_VERSIONS' using errcode = '22023';
  end if;

  select array_agg(c order by c) into v_deferred
  from unnest(v_version.intended_channels) c
  where c in ('email', 'whatsapp');
  v_deferred := coalesce(v_deferred, '{}'::text[]);

  select * into v_campaign from public.campaigns where id = v_version.campaign_id;
  v_dest := v_version.destination_reference;
  v_snapshot := jsonb_build_object(
    'kind', case
      when v_dest is null then 'none'
      when v_dest ~* '^https://' then 'external_url'
      when v_dest ~ '^OD-LP' then 'landing_publication_reference'
      else 'opaque_reference'
    end,
    'destination_reference', v_dest,
    'campaign_reference', v_campaign.campaign_reference,
    'campaign_version_number', v_version.version_number,
    'production_live', false
  );

  insert into public.campaign_runs (
    run_reference, campaign_version_id, provider_channel, status, requested_by,
    configuration_hash, audience_rule_hash, destination_snapshot, deferred_channels,
    targeting_mode
  ) values (
    private.generate_campaign_run_reference(),
    v_version.id,
    v_paid[1],
    'scheduled',
    v_actor,
    v_version.configuration_hash,
    v_rule.rule_hash,
    v_snapshot,
    v_deferred,
    v_version.targeting_mode
  )
  returning * into v_run;

  insert into public.campaign_run_targets (
    campaign_run_id, run_target_reference, provider_channel
  ) values (
    v_run.id, private.generate_campaign_run_target_reference(), v_run.provider_channel
  )
  returning * into v_target;

  v_op_id := private.enqueue_campaign_run_operation(v_run, v_target.id, 'create');

  perform private.append_campaign_execution_event(
    v_run.id, v_target.id, v_op_id, 'run_created', 'scheduled', null,
    jsonb_build_object(
      'provider_channel', v_run.provider_channel,
      'deferred_channels', to_jsonb(v_deferred),
      'targeting_mode', v_run.targeting_mode
    ),
    v_actor, 'staff'
  );

  v_replay := jsonb_build_object(
    'campaign_run_id', v_run.id,
    'run_reference', v_run.run_reference,
    'run_target_id', v_target.id,
    'run_target_reference', v_target.run_target_reference,
    'provider_channel', v_run.provider_channel,
    'status', v_run.status,
    'deferred_channels', to_jsonb(v_deferred),
    'targeting_mode', v_run.targeting_mode,
    'create_operation_id', v_op_id
  );
  perform private.marketing_execution_idempotency_store(
    v_actor, 'create_campaign_run', p_idempotency_key, v_hash, v_replay
  );
  return v_replay;
end;
$$;

create or replace function public.pause_campaign_run(
  p_campaign_run_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_run public.campaign_runs%rowtype;
  v_target public.campaign_run_targets%rowtype;
  v_hash text;
  v_replay jsonb;
  v_op_id uuid;
begin
  v_actor := private.marketing_require_actor('campaigns.pause');
  v_hash := private.marketing_sha256(v_actor::text || '|pause_campaign_run|' || p_campaign_run_id::text);
  perform private.marketing_execution_idempotency_xact_lock(v_actor, 'pause_campaign_run', p_idempotency_key);
  v_replay := private.marketing_execution_idempotency_lookup(v_actor, 'pause_campaign_run', p_idempotency_key, v_hash);
  if v_replay is not null then
    return v_replay;
  end if;

  select * into v_run from public.campaign_runs where id = p_campaign_run_id for update;
  if not found then
    raise exception 'CAMPAIGN_NOT_FOUND_OR_FORBIDDEN' using errcode = 'P0002';
  end if;
  if v_run.status is distinct from 'running' then
    raise exception 'CAMPAIGN_RUN_INVALID_TRANSITION' using errcode = '22023';
  end if;

  select * into v_target from public.campaign_run_targets where campaign_run_id = v_run.id;
  v_op_id := private.enqueue_campaign_run_operation(v_run, v_target.id, 'pause');
  perform private.append_campaign_execution_event(
    v_run.id, v_target.id, v_op_id, 'pause_requested', 'pending', null, '{}'::jsonb, v_actor, 'staff'
  );

  v_replay := jsonb_build_object(
    'campaign_run_id', v_run.id,
    'status', v_run.status,
    'pause_operation_id', v_op_id
  );
  perform private.marketing_execution_idempotency_store(
    v_actor, 'pause_campaign_run', p_idempotency_key, v_hash, v_replay
  );
  return v_replay;
end;
$$;

create or replace function public.resume_campaign_run(
  p_campaign_run_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_run public.campaign_runs%rowtype;
  v_target public.campaign_run_targets%rowtype;
  v_hash text;
  v_replay jsonb;
  v_op_id uuid;
begin
  v_actor := private.marketing_require_actor('campaigns.pause');
  v_hash := private.marketing_sha256(v_actor::text || '|resume_campaign_run|' || p_campaign_run_id::text);
  perform private.marketing_execution_idempotency_xact_lock(v_actor, 'resume_campaign_run', p_idempotency_key);
  v_replay := private.marketing_execution_idempotency_lookup(v_actor, 'resume_campaign_run', p_idempotency_key, v_hash);
  if v_replay is not null then
    return v_replay;
  end if;

  select * into v_run from public.campaign_runs where id = p_campaign_run_id for update;
  if not found then
    raise exception 'CAMPAIGN_NOT_FOUND_OR_FORBIDDEN' using errcode = 'P0002';
  end if;
  if v_run.status is distinct from 'paused' then
    raise exception 'CAMPAIGN_RUN_INVALID_TRANSITION' using errcode = '22023';
  end if;

  select * into v_target from public.campaign_run_targets where campaign_run_id = v_run.id;
  v_op_id := private.enqueue_campaign_run_operation(v_run, v_target.id, 'resume');
  perform private.append_campaign_execution_event(
    v_run.id, v_target.id, v_op_id, 'resume_requested', 'pending', null, '{}'::jsonb, v_actor, 'staff'
  );

  v_replay := jsonb_build_object(
    'campaign_run_id', v_run.id,
    'status', v_run.status,
    'resume_operation_id', v_op_id
  );
  perform private.marketing_execution_idempotency_store(
    v_actor, 'resume_campaign_run', p_idempotency_key, v_hash, v_replay
  );
  return v_replay;
end;
$$;

create or replace function public.cancel_campaign_run(
  p_campaign_run_id uuid,
  p_idempotency_key uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_run public.campaign_runs%rowtype;
  v_target public.campaign_run_targets%rowtype;
  v_hash text;
  v_replay jsonb;
  v_op_id uuid;
begin
  v_actor := private.marketing_require_actor('campaigns.execute');
  if not private.has_role('super_admin') then
    raise exception 'CAMPAIGN_CANCEL_SUPER_ADMIN_ONLY' using errcode = '42501';
  end if;

  v_hash := private.marketing_sha256(v_actor::text || '|cancel_campaign_run|' || p_campaign_run_id::text);
  perform private.marketing_execution_idempotency_xact_lock(v_actor, 'cancel_campaign_run', p_idempotency_key);
  v_replay := private.marketing_execution_idempotency_lookup(v_actor, 'cancel_campaign_run', p_idempotency_key, v_hash);
  if v_replay is not null then
    return v_replay;
  end if;

  select * into v_run from public.campaign_runs where id = p_campaign_run_id for update;
  if not found then
    raise exception 'CAMPAIGN_NOT_FOUND_OR_FORBIDDEN' using errcode = 'P0002';
  end if;
  if v_run.status in ('completed', 'failed', 'cancelled') then
    raise exception 'CAMPAIGN_RUN_TERMINAL' using errcode = '22023';
  end if;

  select * into v_target from public.campaign_run_targets where campaign_run_id = v_run.id;

  update public.campaign_runs
  set status = 'cancelled', cancelled_at = now(), cancelled_by = v_actor, lock_version = lock_version + 1
  where id = v_run.id;

  update public.campaign_run_operations
  set operation_state = 'cancelled', completed_at = now()
  where campaign_run_id = v_run.id
    and operation_state in ('pending', 'claimed');

  v_op_id := null;
  if v_target.provider_campaign_id is not null then
    v_op_id := private.enqueue_campaign_run_operation(v_run, v_target.id, 'cancel');
  end if;

  perform private.append_campaign_execution_event(
    v_run.id, v_target.id, v_op_id, 'run_cancelled', 'cancelled', v_target.provider_campaign_id,
    '{}'::jsonb, v_actor, 'staff'
  );

  v_replay := jsonb_build_object(
    'campaign_run_id', v_run.id,
    'status', 'cancelled',
    'cancel_operation_id', v_op_id
  );
  perform private.marketing_execution_idempotency_store(
    v_actor, 'cancel_campaign_run', p_idempotency_key, v_hash, v_replay
  );
  return v_replay;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. Service-role worker RPCs
-- ----------------------------------------------------------------------------
create or replace function public.claim_campaign_run_operation(
  p_worker_id text,
  p_claim_ttl_seconds integer default 120
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_op public.campaign_run_operations%rowtype;
  v_ttl integer;
begin
  if p_worker_id is null or length(trim(p_worker_id)) not between 1 and 80 then
    raise exception 'CAMPAIGN_VALIDATION' using errcode = '22023';
  end if;
  v_ttl := greatest(30, least(coalesce(p_claim_ttl_seconds, 120), 300));

  select * into v_op
  from public.campaign_run_operations
  where (
      operation_state = 'pending' and next_attempt_at <= now()
    ) or (
      operation_state = 'claimed'
      and claim_expires_at is not null
      and claim_expires_at < now()
      and attempt_count < max_attempts
    )
  order by next_attempt_at asc
  for update skip locked
  limit 1;

  if not found then
    return jsonb_build_object('outcome_code', 'none');
  end if;

  if v_op.operation_state = 'claimed' and v_op.attempt_count >= v_op.max_attempts then
    update public.campaign_run_operations
    set operation_state = 'needs_reconcile', last_error_code = 'CLAIM_EXPIRED_UNKNOWN', completed_at = now()
    where id = v_op.id;
    perform private.append_campaign_execution_event(
      v_op.campaign_run_id, v_op.campaign_run_target_id, v_op.id,
      'operation_needs_reconcile', 'needs_reconcile', null,
      jsonb_build_object('reason', 'expired_claim'), null, 'service'
    );
    return jsonb_build_object('outcome_code', 'needs_reconcile', 'operation_id', v_op.id);
  end if;

  update public.campaign_run_operations
  set
    operation_state = 'claimed',
    claimed_by = trim(p_worker_id),
    claimed_at = now(),
    claim_expires_at = now() + make_interval(secs => v_ttl),
    attempt_count = attempt_count + 1
  where id = v_op.id
  returning * into v_op;

  perform private.append_campaign_execution_event(
    v_op.campaign_run_id, v_op.campaign_run_target_id, v_op.id,
    'operation_claimed', 'claimed', null,
    jsonb_build_object('worker_id', trim(p_worker_id), 'attempt_count', v_op.attempt_count),
    null, 'service'
  );

  return jsonb_build_object(
    'outcome_code', 'claimed',
    'operation_id', v_op.id,
    'campaign_run_id', v_op.campaign_run_id,
    'campaign_run_target_id', v_op.campaign_run_target_id,
    'operation_type', v_op.operation_type,
    'operation_key', v_op.operation_key,
    'attempt_count', v_op.attempt_count,
    'max_attempts', v_op.max_attempts
  );
end;
$$;

create or replace function public.bind_campaign_run_operation(
  p_operation_id uuid,
  p_provider_campaign_id text,
  p_provider_ad_set_id text default null,
  p_provider_ad_group_id text default null,
  p_provider_status text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_op public.campaign_run_operations%rowtype;
  v_target public.campaign_run_targets%rowtype;
begin
  select * into v_op from public.campaign_run_operations where id = p_operation_id for update;
  if not found then
    raise exception 'CAMPAIGN_NOT_FOUND_OR_FORBIDDEN' using errcode = 'P0002';
  end if;
  if v_op.operation_state is distinct from 'claimed' then
    raise exception 'CAMPAIGN_OPERATION_NOT_CLAIMED' using errcode = '22023';
  end if;

  select * into v_target from public.campaign_run_targets where id = v_op.campaign_run_target_id for update;

  if v_target.provider_campaign_id is not null
     and p_provider_campaign_id is not null
     and v_target.provider_campaign_id is distinct from p_provider_campaign_id then
    raise exception 'CAMPAIGN_PROVIDER_OBJECT_CONFLICT' using errcode = '22023';
  end if;

  update public.campaign_run_targets
  set
    provider_campaign_id = coalesce(provider_campaign_id, p_provider_campaign_id),
    provider_ad_set_id = coalesce(p_provider_ad_set_id, provider_ad_set_id),
    provider_ad_group_id = coalesce(p_provider_ad_group_id, provider_ad_group_id),
    provider_status = coalesce(p_provider_status, provider_status),
    last_synced_at = now()
  where id = v_target.id;

  perform private.append_campaign_execution_event(
    v_op.campaign_run_id, v_op.campaign_run_target_id, v_op.id,
    'operation_bound', 'bound', p_provider_campaign_id, '{}'::jsonb, null, 'service'
  );

  return jsonb_build_object('outcome_code', 'bound', 'operation_id', v_op.id);
end;
$$;

create or replace function public.complete_campaign_run_operation(
  p_operation_id uuid,
  p_outcome_code text,
  p_safe_metadata jsonb default '{}'::jsonb
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_op public.campaign_run_operations%rowtype;
  v_run public.campaign_runs%rowtype;
  v_target public.campaign_run_targets%rowtype;
  v_activate uuid;
begin
  if p_outcome_code is null or length(trim(p_outcome_code)) not between 1 and 80 then
    raise exception 'CAMPAIGN_VALIDATION' using errcode = '22023';
  end if;

  select * into v_op from public.campaign_run_operations where id = p_operation_id for update;
  if not found then
    raise exception 'CAMPAIGN_NOT_FOUND_OR_FORBIDDEN' using errcode = 'P0002';
  end if;
  if v_op.operation_state is distinct from 'claimed' then
    raise exception 'CAMPAIGN_OPERATION_NOT_CLAIMED' using errcode = '22023';
  end if;

  update public.campaign_run_operations
  set operation_state = 'succeeded', completed_at = now(), last_error_code = null
  where id = v_op.id;

  select * into v_run from public.campaign_runs where id = v_op.campaign_run_id for update;
  select * into v_target from public.campaign_run_targets where id = v_op.campaign_run_target_id;

  if v_op.operation_type = 'create' then
    v_activate := private.enqueue_campaign_run_operation(v_run, v_target.id, 'activate');
  elsif v_op.operation_type = 'activate' and v_run.status = 'scheduled' then
    update public.campaign_runs
    set status = 'running', activated_at = now(), activated_by = requested_by, lock_version = lock_version + 1
    where id = v_run.id;
  elsif v_op.operation_type = 'pause' and v_run.status = 'running' then
    update public.campaign_runs
    set status = 'paused', paused_at = now(), lock_version = lock_version + 1
    where id = v_run.id;
  elsif v_op.operation_type = 'resume' and v_run.status = 'paused' then
    update public.campaign_runs
    set status = 'running', paused_at = null, lock_version = lock_version + 1
    where id = v_run.id;
  elsif v_op.operation_type = 'cancel' then
    update public.campaign_runs
    set status = 'cancelled', cancelled_at = coalesce(cancelled_at, now()), lock_version = lock_version + 1
    where id = v_run.id and status <> 'cancelled';
  end if;

  perform private.append_campaign_execution_event(
    v_op.campaign_run_id, v_op.campaign_run_target_id, v_op.id,
    'operation_succeeded', trim(p_outcome_code), v_target.provider_campaign_id,
    coalesce(p_safe_metadata, '{}'::jsonb), null, 'service'
  );

  return jsonb_build_object(
    'outcome_code', 'succeeded',
    'operation_id', v_op.id,
    'activate_operation_id', v_activate
  );
end;
$$;

create or replace function public.fail_campaign_run_operation(
  p_operation_id uuid,
  p_error_code text,
  p_retry boolean default false
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_op public.campaign_run_operations%rowtype;
  v_run public.campaign_runs%rowtype;
  v_state text;
begin
  select * into v_op from public.campaign_run_operations where id = p_operation_id for update;
  if not found then
    raise exception 'CAMPAIGN_NOT_FOUND_OR_FORBIDDEN' using errcode = 'P0002';
  end if;
  if v_op.operation_state is distinct from 'claimed' then
    raise exception 'CAMPAIGN_OPERATION_NOT_CLAIMED' using errcode = '22023';
  end if;

  if p_retry and v_op.attempt_count < v_op.max_attempts then
    v_state := 'pending';
    update public.campaign_run_operations
    set
      operation_state = 'pending',
      last_error_code = left(trim(p_error_code), 80),
      next_attempt_at = now() + make_interval(secs => least(60 * v_op.attempt_count, 300)),
      claimed_by = null,
      claimed_at = null,
      claim_expires_at = null
    where id = v_op.id;
  else
    v_state := 'failed';
    update public.campaign_run_operations
    set operation_state = 'failed', last_error_code = left(trim(p_error_code), 80), completed_at = now()
    where id = v_op.id;

    select * into v_run from public.campaign_runs where id = v_op.campaign_run_id for update;
    if v_op.operation_type in ('create', 'activate') and v_run.status = 'scheduled' then
      update public.campaign_runs
      set status = 'failed', failed_at = now(), failure_code = left(trim(p_error_code), 80),
          failure_reason = left(trim(p_error_code), 80), lock_version = lock_version + 1
      where id = v_run.id;
    end if;
  end if;

  perform private.append_campaign_execution_event(
    v_op.campaign_run_id, v_op.campaign_run_target_id, v_op.id,
    'operation_failed', coalesce(nullif(trim(p_error_code), ''), 'failed'), null,
    jsonb_build_object('retry', p_retry, 'state', v_state), null, 'service'
  );

  return jsonb_build_object('outcome_code', v_state, 'operation_id', v_op.id);
end;
$$;

create or replace function public.mark_campaign_run_operation_needs_reconcile(
  p_operation_id uuid,
  p_error_code text default 'UNKNOWN_PROVIDER_OUTCOME'
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_op public.campaign_run_operations%rowtype;
begin
  select * into v_op from public.campaign_run_operations where id = p_operation_id for update;
  if not found then
    raise exception 'CAMPAIGN_NOT_FOUND_OR_FORBIDDEN' using errcode = 'P0002';
  end if;
  if v_op.operation_state not in ('claimed', 'pending') then
    raise exception 'CAMPAIGN_OPERATION_NOT_RECONCILABLE' using errcode = '22023';
  end if;

  update public.campaign_run_operations
  set operation_state = 'needs_reconcile', last_error_code = left(trim(p_error_code), 80), completed_at = now()
  where id = v_op.id;

  perform private.append_campaign_execution_event(
    v_op.campaign_run_id, v_op.campaign_run_target_id, v_op.id,
    'operation_needs_reconcile', 'needs_reconcile', null,
    jsonb_build_object('error_code', p_error_code), null, 'service'
  );

  return jsonb_build_object('outcome_code', 'needs_reconcile', 'operation_id', v_op.id);
end;
$$;

create or replace function public.get_campaign_run_operation_for_reconcile(p_operation_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_op public.campaign_run_operations%rowtype;
  v_run public.campaign_runs%rowtype;
  v_target public.campaign_run_targets%rowtype;
begin
  select * into v_op from public.campaign_run_operations where id = p_operation_id;
  if not found then
    return jsonb_build_object('outcome_code', 'not_found');
  end if;
  select * into v_run from public.campaign_runs where id = v_op.campaign_run_id;
  select * into v_target from public.campaign_run_targets where id = v_op.campaign_run_target_id;
  return jsonb_build_object(
    'outcome_code', 'found',
    'operation_id', v_op.id,
    'operation_type', v_op.operation_type,
    'operation_state', v_op.operation_state,
    'operation_key', v_op.operation_key,
    'run_reference', v_run.run_reference,
    'run_target_reference', v_target.run_target_reference,
    'provider_channel', v_run.provider_channel,
    'provider_campaign_id', v_target.provider_campaign_id
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 7. RLS / grants
-- ----------------------------------------------------------------------------
alter table public.campaign_runs enable row level security;
alter table public.campaign_run_targets enable row level security;
alter table public.campaign_run_operations enable row level security;
alter table public.campaign_execution_events enable row level security;

revoke all on table public.campaign_runs from public, anon, authenticated;
revoke all on table public.campaign_run_targets from public, anon, authenticated;
revoke all on table public.campaign_run_operations from public, anon, authenticated;
revoke all on table public.campaign_execution_events from public, anon, authenticated;
revoke all on table private.marketing_execution_idempotency_requests from public, anon, authenticated;
revoke all on sequence private.campaign_run_reference_seq from public, anon, authenticated;
revoke all on sequence private.campaign_run_target_reference_seq from public, anon, authenticated;

grant select on table public.campaign_runs to authenticated;
grant select on table public.campaign_run_targets to authenticated;
grant select on table public.campaign_run_operations to authenticated;
grant select on table public.campaign_execution_events to authenticated;

create policy campaign_runs_select on public.campaign_runs
  for select to authenticated
  using ((select public.authorize('campaigns.read')) or (select public.authorize('campaigns.metrics.read')));

create policy campaign_run_targets_select on public.campaign_run_targets
  for select to authenticated
  using ((select public.authorize('campaigns.read')) or (select public.authorize('campaigns.metrics.read')));

create policy campaign_run_operations_select on public.campaign_run_operations
  for select to authenticated
  using ((select public.authorize('campaigns.read')) or (select public.authorize('campaigns.metrics.read')));

create policy campaign_execution_events_select on public.campaign_execution_events
  for select to authenticated
  using ((select public.authorize('campaigns.read')) or (select public.authorize('campaigns.metrics.read')));

alter function public.create_campaign_run(uuid, uuid) owner to postgres;
alter function public.pause_campaign_run(uuid, uuid) owner to postgres;
alter function public.resume_campaign_run(uuid, uuid) owner to postgres;
alter function public.cancel_campaign_run(uuid, uuid) owner to postgres;
alter function public.claim_campaign_run_operation(text, integer) owner to postgres;
alter function public.bind_campaign_run_operation(uuid, text, text, text, text) owner to postgres;
alter function public.complete_campaign_run_operation(uuid, text, jsonb) owner to postgres;
alter function public.fail_campaign_run_operation(uuid, text, boolean) owner to postgres;
alter function public.mark_campaign_run_operation_needs_reconcile(uuid, text) owner to postgres;
alter function public.get_campaign_run_operation_for_reconcile(uuid) owner to postgres;

revoke all on function public.create_campaign_run(uuid, uuid) from public, anon;
revoke all on function public.pause_campaign_run(uuid, uuid) from public, anon;
revoke all on function public.resume_campaign_run(uuid, uuid) from public, anon;
revoke all on function public.cancel_campaign_run(uuid, uuid) from public, anon;
revoke all on function public.claim_campaign_run_operation(text, integer) from public, anon, authenticated;
revoke all on function public.bind_campaign_run_operation(uuid, text, text, text, text) from public, anon, authenticated;
revoke all on function public.complete_campaign_run_operation(uuid, text, jsonb) from public, anon, authenticated;
revoke all on function public.fail_campaign_run_operation(uuid, text, boolean) from public, anon, authenticated;
revoke all on function public.mark_campaign_run_operation_needs_reconcile(uuid, text) from public, anon, authenticated;
revoke all on function public.get_campaign_run_operation_for_reconcile(uuid) from public, anon, authenticated;

grant execute on function public.create_campaign_run(uuid, uuid) to authenticated;
grant execute on function public.pause_campaign_run(uuid, uuid) to authenticated;
grant execute on function public.resume_campaign_run(uuid, uuid) to authenticated;
grant execute on function public.cancel_campaign_run(uuid, uuid) to authenticated;
grant execute on function public.claim_campaign_run_operation(text, integer) to service_role;
grant execute on function public.bind_campaign_run_operation(uuid, text, text, text, text) to service_role;
grant execute on function public.complete_campaign_run_operation(uuid, text, jsonb) to service_role;
grant execute on function public.fail_campaign_run_operation(uuid, text, boolean) to service_role;
grant execute on function public.mark_campaign_run_operation_needs_reconcile(uuid, text) to service_role;
grant execute on function public.get_campaign_run_operation_for_reconcile(uuid) to service_role;

revoke all on function private.generate_campaign_run_reference() from public, anon, authenticated;
revoke all on function private.generate_campaign_run_target_reference() from public, anon, authenticated;
revoke all on function private.marketing_execution_idempotency_xact_lock(uuid, text, uuid) from public, anon, authenticated;
revoke all on function private.marketing_execution_idempotency_lookup(uuid, text, uuid, text) from public, anon, authenticated;
revoke all on function private.marketing_execution_idempotency_store(uuid, text, uuid, text, jsonb) from public, anon, authenticated;
revoke all on function private.append_campaign_execution_event(uuid, uuid, uuid, text, text, text, jsonb, uuid, text) from public, anon, authenticated;
revoke all on function private.enqueue_campaign_run_operation(public.campaign_runs, uuid, text) from public, anon, authenticated;
