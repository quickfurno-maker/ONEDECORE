-- ONEDECORE Phase 9C-C — campaign metrics + conversion feedback foundation
-- Forward-only after M33. Do not edit M1–M33.

-- ----------------------------------------------------------------------------
-- 1. Operation type extension (M33 constraint remains historical)
-- ----------------------------------------------------------------------------
alter table public.campaign_run_operations
  drop constraint chk_campaign_run_operations_type;

alter table public.campaign_run_operations
  add constraint chk_campaign_run_operations_type check (
    operation_type in (
      'create', 'activate', 'pause', 'resume', 'cancel', 'sync',
      'metrics_sync', 'conversion_feedback'
    )
  );

-- ----------------------------------------------------------------------------
-- 2. Sequences / references
-- ----------------------------------------------------------------------------
create sequence if not exists private.campaign_conversion_feedback_reference_seq;

create or replace function private.generate_campaign_conversion_feedback_reference()
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
  v_seq := nextval('private.campaign_conversion_feedback_reference_seq');
  return 'OD-CFE-' || v_year || '-' || lpad(v_seq::text, 6, '0');
end;
$$;

alter function private.generate_campaign_conversion_feedback_reference() owner to postgres;

-- ----------------------------------------------------------------------------
-- 3. Metric snapshots
-- ----------------------------------------------------------------------------
create table public.campaign_metric_snapshots (
  id uuid primary key default gen_random_uuid(),
  campaign_run_id uuid not null references public.campaign_runs (id) on delete restrict,
  campaign_run_target_id uuid not null references public.campaign_run_targets (id) on delete restrict,
  provider_channel text not null,
  provider_account_ref text,
  window_start timestamptz not null,
  window_end timestamptz not null,
  currency text not null,
  spend_minor bigint not null,
  impressions bigint not null,
  clicks bigint not null,
  provider_conversions bigint not null,
  fetched_at timestamptz not null default now(),
  provider_revision text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_campaign_metric_channel check (provider_channel in ('meta_ads', 'google_ads')),
  constraint chk_campaign_metric_window check (window_end > window_start),
  constraint chk_campaign_metric_currency check (currency ~ '^[A-Z]{3}$'),
  constraint chk_campaign_metric_spend check (spend_minor >= 0),
  constraint chk_campaign_metric_impressions check (impressions >= 0),
  constraint chk_campaign_metric_clicks check (clicks >= 0),
  constraint chk_campaign_metric_conversions check (provider_conversions >= 0),
  constraint chk_campaign_metric_account_ref check (
    provider_account_ref is null or length(trim(provider_account_ref)) between 1 and 64
  ),
  constraint chk_campaign_metric_revision check (
    provider_revision is null or length(trim(provider_revision)) between 1 and 128
  ),
  constraint chk_campaign_metric_metadata check (
    jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 2048
  ),
  constraint uq_campaign_metric_target_window unique (campaign_run_target_id, window_start, window_end)
);

comment on table public.campaign_metric_snapshots is
  'Provider delivery/spend evidence by run target and reporting window. Not a finance ledger. No FX. No PII.';

create index idx_campaign_metric_snapshots_run on public.campaign_metric_snapshots (campaign_run_id);

-- ----------------------------------------------------------------------------
-- 4. Conversion feedback evidence
-- ----------------------------------------------------------------------------
create table public.campaign_conversion_feedback_events (
  id uuid primary key default gen_random_uuid(),
  event_reference text not null unique,
  conversion_type text not null,
  source_entity_type text not null,
  source_entity_id uuid not null,
  source_event_key text not null unique,
  lead_id uuid references public.leads (id) on delete restrict,
  campaign_run_id uuid references public.campaign_runs (id) on delete restrict,
  campaign_run_target_id uuid references public.campaign_run_targets (id) on delete restrict,
  provider_channel text,
  attribution_state text not null,
  provider_submission_state text not null,
  provider_submission_id text,
  provider_error_code text,
  conversion_occurred_at timestamptz not null,
  value_minor bigint,
  currency text,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_campaign_cfe_type check (
    conversion_type in (
      'LeadCreated', 'QualifiedLead', 'ConsultationScheduled', 'ProposalSent', 'CommercialConversion'
    )
  ),
  constraint chk_campaign_cfe_source_type check (
    source_entity_type in ('lead', 'quotation_acceptance')
  ),
  constraint chk_campaign_cfe_attribution check (
    attribution_state in ('attributable', 'not_attributable', 'ambiguous_target')
  ),
  constraint chk_campaign_cfe_submission check (
    provider_submission_state in ('pending', 'blocked', 'submitted', 'rejected', 'failed', 'not_applicable')
  ),
  constraint chk_campaign_cfe_channel check (
    provider_channel is null or provider_channel in ('meta_ads', 'google_ads')
  ),
  constraint chk_campaign_cfe_event_ref check (event_reference ~ '^OD-CFE-[0-9]{4}-[0-9]{6}$'),
  constraint chk_campaign_cfe_source_key check (length(trim(source_event_key)) between 8 and 160),
  constraint chk_campaign_cfe_submission_id check (
    provider_submission_id is null or length(trim(provider_submission_id)) between 1 and 128
  ),
  constraint chk_campaign_cfe_error check (
    provider_error_code is null or length(trim(provider_error_code)) between 1 and 80
  ),
  constraint chk_campaign_cfe_value check (value_minor is null or value_minor >= 0),
  constraint chk_campaign_cfe_currency check (currency is null or currency ~ '^[A-Z]{3}$'),
  constraint chk_campaign_cfe_metadata check (
    jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 2048
  ),
  constraint chk_campaign_cfe_attr_submit check (
    (attribution_state = 'attributable' and provider_submission_state in ('pending', 'blocked', 'submitted', 'rejected', 'failed'))
    or (attribution_state in ('not_attributable', 'ambiguous_target') and provider_submission_state = 'not_applicable')
  )
);

comment on table public.campaign_conversion_feedback_events is
  'Local conversion-feedback evidence. Not a CRM stage. Provider rejection never rolls back CRM. No raw PII.';

create index idx_campaign_cfe_lead on public.campaign_conversion_feedback_events (lead_id);
create index idx_campaign_cfe_run on public.campaign_conversion_feedback_events (campaign_run_id);

-- ----------------------------------------------------------------------------
-- 5. Attribution resolution + upsert helpers
-- ----------------------------------------------------------------------------
create or replace function private.resolve_trusted_campaign_target_from_attribution(p_attribution jsonb)
returns table (
  attribution_state text,
  campaign_run_id uuid,
  campaign_run_target_id uuid,
  provider_channel text
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run_ref text;
  v_target_ref text;
  v_run public.campaign_runs%rowtype;
  v_target public.campaign_run_targets%rowtype;
begin
  v_run_ref := nullif(trim(p_attribution->>'campaign_run_reference'), '');
  v_target_ref := nullif(trim(p_attribution->>'campaign_run_target_reference'), '');

  if v_run_ref is null or v_target_ref is null then
    attribution_state := 'not_attributable';
    campaign_run_id := null;
    campaign_run_target_id := null;
    provider_channel := null;
    return next;
    return;
  end if;

  if v_run_ref !~ '^OD-CR-[0-9]{4}-[0-9]{6}$' or v_target_ref !~ '^OD-CRT-[0-9]{4}-[0-9]{6}$' then
    attribution_state := 'not_attributable';
    campaign_run_id := null;
    campaign_run_target_id := null;
    provider_channel := null;
    return next;
    return;
  end if;

  select * into v_run from public.campaign_runs where run_reference = v_run_ref;
  if not found then
    attribution_state := 'not_attributable';
    campaign_run_id := null;
    campaign_run_target_id := null;
    provider_channel := null;
    return next;
    return;
  end if;

  select t.* into v_target
  from public.campaign_run_targets as t
  where t.run_target_reference = v_target_ref and t.campaign_run_id = v_run.id;

  if not found or v_target.provider_channel is distinct from v_run.provider_channel then
    attribution_state := 'ambiguous_target';
    campaign_run_id := v_run.id;
    campaign_run_target_id := null;
    provider_channel := v_run.provider_channel;
    return next;
    return;
  end if;

  attribution_state := 'attributable';
  campaign_run_id := v_run.id;
  campaign_run_target_id := v_target.id;
  provider_channel := v_run.provider_channel;
  return next;
end;
$$;

create or replace function private.upsert_campaign_conversion_feedback_event(
  p_conversion_type text,
  p_source_entity_type text,
  p_source_entity_id uuid,
  p_source_event_key text,
  p_lead_id uuid,
  p_attribution jsonb,
  p_occurred_at timestamptz,
  p_value_minor bigint,
  p_currency text
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_id uuid;
  v_state text;
  v_run_id uuid;
  v_target_id uuid;
  v_channel text;
  v_submit text;
begin
  select r.attribution_state, r.campaign_run_id, r.campaign_run_target_id, r.provider_channel
    into v_state, v_run_id, v_target_id, v_channel
  from private.resolve_trusted_campaign_target_from_attribution(coalesce(p_attribution, '{}'::jsonb)) as r;

  if v_state is null then
    v_state := 'not_attributable';
    v_run_id := null;
    v_target_id := null;
    v_channel := null;
  end if;

  v_submit := case
    when v_state = 'attributable' then 'pending'
    else 'not_applicable'
  end;

  insert into public.campaign_conversion_feedback_events (
    event_reference, conversion_type, source_entity_type, source_entity_id, source_event_key,
    lead_id, campaign_run_id, campaign_run_target_id, provider_channel,
    attribution_state, provider_submission_state, conversion_occurred_at, value_minor, currency
  ) values (
    private.generate_campaign_conversion_feedback_reference(),
    p_conversion_type, p_source_entity_type, p_source_entity_id, p_source_event_key,
    p_lead_id, v_run_id, v_target_id, v_channel,
    v_state, v_submit, p_occurred_at, p_value_minor, p_currency
  )
  on conflict (source_event_key) do nothing
  returning id into v_id;

  if v_id is null then
    select id into v_id from public.campaign_conversion_feedback_events where source_event_key = p_source_event_key;
  end if;
  return v_id;
end;
$$;

-- ----------------------------------------------------------------------------
-- 6. CRM-atomic conversion evidence (forward-only triggers)
-- ----------------------------------------------------------------------------
create or replace function private.trg_leads_campaign_conversion_feedback()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if tg_op = 'INSERT' then
    perform private.upsert_campaign_conversion_feedback_event(
      'LeadCreated', 'lead', NEW.id, 'lead:' || NEW.id::text || ':LeadCreated',
      NEW.id, NEW.attribution, NEW.created_at, null, null
    );
    return NEW;
  end if;

  if tg_op = 'UPDATE' and NEW.status is distinct from OLD.status then
    if NEW.status = 'qualified' then
      perform private.upsert_campaign_conversion_feedback_event(
        'QualifiedLead', 'lead', NEW.id, 'lead:' || NEW.id::text || ':QualifiedLead',
        NEW.id, NEW.attribution, now(), null, null
      );
    elsif NEW.status = 'consultation_scheduled' then
      perform private.upsert_campaign_conversion_feedback_event(
        'ConsultationScheduled', 'lead', NEW.id, 'lead:' || NEW.id::text || ':ConsultationScheduled',
        NEW.id, NEW.attribution, now(), null, null
      );
    elsif NEW.status = 'proposal_sent' then
      perform private.upsert_campaign_conversion_feedback_event(
        'ProposalSent', 'lead', NEW.id, 'lead:' || NEW.id::text || ':ProposalSent',
        NEW.id, NEW.attribution, now(), null, null
      );
    end if;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_leads_campaign_conversion_feedback on public.leads;
create trigger trg_leads_campaign_conversion_feedback
  after insert or update of status on public.leads
  for each row execute function private.trg_leads_campaign_conversion_feedback();

create or replace function private.trg_quotation_acceptance_commercial_conversion()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_lead public.leads%rowtype;
begin
  select * into v_lead from public.leads where id = NEW.lead_id;
  perform private.upsert_campaign_conversion_feedback_event(
    'CommercialConversion',
    'quotation_acceptance',
    NEW.id,
    'quotation_acceptance:' || NEW.id::text,
    NEW.lead_id,
    coalesce(v_lead.attribution, '{}'::jsonb),
    NEW.accepted_at,
    NEW.taxable_base_paise,
    'INR'
  );
  return NEW;
end;
$$;

drop trigger if exists trg_quotation_acceptance_commercial_conversion on public.quotation_acceptances;
create trigger trg_quotation_acceptance_commercial_conversion
  after insert on public.quotation_acceptances
  for each row execute function private.trg_quotation_acceptance_commercial_conversion();

-- Forward-replace M32 first-touchpoint copy to include trusted run/target click ids (no parallel table).
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
    'wbraid',
    'gbraid',
    'fbc',
    'fbp',
    'utmSource',
    'utmMedium',
    'utmCampaign',
    'utmContent',
    'utmTerm',
    'campaign_run_reference',
    'campaign_run_target_reference',
    'provider_channel',
    'execution_context_version'
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
-- 7. Service / staff RPCs
-- ----------------------------------------------------------------------------
create or replace function public.verify_campaign_execution_context_binding(
  p_run_reference text,
  p_run_target_reference text,
  p_provider_channel text,
  p_campaign_reference text,
  p_campaign_version_number integer,
  p_landing_publication_reference text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.campaign_runs%rowtype;
  v_target public.campaign_run_targets%rowtype;
  v_version public.campaign_versions%rowtype;
  v_campaign public.campaigns%rowtype;
begin
  if p_run_reference is null or p_run_reference !~ '^OD-CR-[0-9]{4}-[0-9]{6}$'
     or p_run_target_reference is null or p_run_target_reference !~ '^OD-CRT-[0-9]{4}-[0-9]{6}$'
     or p_provider_channel not in ('meta_ads', 'google_ads') then
    return jsonb_build_object('outcome_code', 'mismatch');
  end if;

  select * into v_run from public.campaign_runs where run_reference = p_run_reference;
  if not found then
    return jsonb_build_object('outcome_code', 'mismatch');
  end if;

  select t.* into v_target
  from public.campaign_run_targets as t
  where t.run_target_reference = p_run_target_reference and t.campaign_run_id = v_run.id;
  if not found then
    return jsonb_build_object('outcome_code', 'mismatch');
  end if;

  if v_run.provider_channel is distinct from v_target.provider_channel
     or v_run.provider_channel is distinct from p_provider_channel then
    return jsonb_build_object('outcome_code', 'mismatch');
  end if;

  select * into v_version from public.campaign_versions where id = v_run.campaign_version_id;
  select * into v_campaign from public.campaigns where id = v_version.campaign_id;

  if v_campaign.campaign_reference is distinct from p_campaign_reference
     or v_version.version_number is distinct from p_campaign_version_number then
    return jsonb_build_object('outcome_code', 'mismatch');
  end if;

  if p_landing_publication_reference is not null
     and coalesce(v_run.destination_snapshot->>'destination_reference', '') is distinct from p_landing_publication_reference then
    return jsonb_build_object('outcome_code', 'mismatch');
  end if;

  return jsonb_build_object(
    'outcome_code', 'ok',
    'campaign_run_id', v_run.id,
    'campaign_run_target_id', v_target.id,
    'provider_channel', v_run.provider_channel,
    'targeting_mode', v_run.targeting_mode
  );
end;
$$;

create or replace function public.upsert_campaign_metric_snapshot(
  p_campaign_run_target_id uuid,
  p_window_start timestamptz,
  p_window_end timestamptz,
  p_currency text,
  p_spend_minor bigint,
  p_impressions bigint,
  p_clicks bigint,
  p_provider_conversions bigint,
  p_provider_account_ref text default null,
  p_provider_revision text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.campaign_run_targets%rowtype;
  v_run public.campaign_runs%rowtype;
  v_id uuid;
begin
  if p_currency is null or p_currency !~ '^[A-Z]{3}$' then
    raise exception 'CAMPAIGN_VALIDATION' using errcode = '22023';
  end if;
  if p_spend_minor is null or p_spend_minor < 0
     or p_impressions is null or p_impressions < 0
     or p_clicks is null or p_clicks < 0
     or p_provider_conversions is null or p_provider_conversions < 0 then
    raise exception 'CAMPAIGN_VALIDATION' using errcode = '22023';
  end if;
  if p_window_start is null or p_window_end is null or p_window_end <= p_window_start then
    raise exception 'CAMPAIGN_VALIDATION' using errcode = '22023';
  end if;

  select * into v_target from public.campaign_run_targets where id = p_campaign_run_target_id for update;
  if not found then
    raise exception 'CAMPAIGN_NOT_FOUND_OR_FORBIDDEN' using errcode = 'P0002';
  end if;
  select * into v_run from public.campaign_runs where id = v_target.campaign_run_id;

  insert into public.campaign_metric_snapshots (
    campaign_run_id, campaign_run_target_id, provider_channel, provider_account_ref,
    window_start, window_end, currency, spend_minor, impressions, clicks, provider_conversions,
    provider_revision
  ) values (
    v_run.id, v_target.id, v_run.provider_channel, nullif(trim(p_provider_account_ref), ''),
    p_window_start, p_window_end, p_currency, p_spend_minor, p_impressions, p_clicks, p_provider_conversions,
    nullif(trim(p_provider_revision), '')
  )
  on conflict (campaign_run_target_id, window_start, window_end) do update
    set spend_minor = excluded.spend_minor,
        impressions = excluded.impressions,
        clicks = excluded.clicks,
        provider_conversions = excluded.provider_conversions,
        provider_account_ref = coalesce(excluded.provider_account_ref, public.campaign_metric_snapshots.provider_account_ref),
        provider_revision = coalesce(excluded.provider_revision, public.campaign_metric_snapshots.provider_revision),
        fetched_at = now(),
        updated_at = now()
  returning id into v_id;

  return jsonb_build_object('outcome_code', 'ok', 'snapshot_id', v_id);
end;
$$;

create or replace function public.mark_campaign_conversion_feedback_state(
  p_event_id uuid,
  p_provider_submission_state text,
  p_provider_submission_id text default null,
  p_provider_error_code text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_row public.campaign_conversion_feedback_events%rowtype;
begin
  if p_provider_submission_state not in ('pending', 'blocked', 'submitted', 'rejected', 'failed', 'not_applicable') then
    raise exception 'CAMPAIGN_VALIDATION' using errcode = '22023';
  end if;
  select * into v_row from public.campaign_conversion_feedback_events where id = p_event_id for update;
  if not found then
    raise exception 'CAMPAIGN_NOT_FOUND_OR_FORBIDDEN' using errcode = 'P0002';
  end if;
  if v_row.attribution_state is distinct from 'attributable' then
    raise exception 'CAMPAIGN_FEEDBACK_NOT_ATTRIBUTABLE' using errcode = '22023';
  end if;

  update public.campaign_conversion_feedback_events
  set
    provider_submission_state = p_provider_submission_state,
    provider_submission_id = coalesce(nullif(trim(p_provider_submission_id), ''), provider_submission_id),
    provider_error_code = nullif(left(trim(coalesce(p_provider_error_code, '')), 80), ''),
    updated_at = now()
  where id = v_row.id;

  return jsonb_build_object('outcome_code', 'ok', 'event_id', v_row.id);
end;
$$;

create or replace function public.enqueue_campaign_metrics_sync(
  p_campaign_run_id uuid
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_run public.campaign_runs%rowtype;
  v_target public.campaign_run_targets%rowtype;
  v_id uuid;
begin
  select * into v_run from public.campaign_runs where id = p_campaign_run_id for update;
  if not found then
    raise exception 'CAMPAIGN_NOT_FOUND_OR_FORBIDDEN' using errcode = 'P0002';
  end if;
  select t.* into v_target from public.campaign_run_targets as t where t.campaign_run_id = v_run.id;
  v_id := private.enqueue_unique_campaign_run_operation(v_run, v_target.id, 'metrics_sync');
  return jsonb_build_object('outcome_code', 'ok', 'operation_id', v_id);
end;
$$;

create or replace function public.get_campaign_metrics_board(p_campaign_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_result jsonb;
begin
  if not public.authorize('campaigns.metrics.read') then
    raise exception 'CAMPAIGN_UNAUTHORIZED' using errcode = '42501';
  end if;
  if p_campaign_id is null then
    raise exception 'CAMPAIGN_VALIDATION' using errcode = '22023';
  end if;

  select jsonb_build_object(
    'campaign_id', p_campaign_id,
    'provider', coalesce((
      select jsonb_build_object(
        'spend_minor', coalesce(sum(s.spend_minor), 0),
        'impressions', coalesce(sum(s.impressions), 0),
        'clicks', coalesce(sum(s.clicks), 0),
        'provider_conversions', coalesce(sum(s.provider_conversions), 0),
        'currency', min(s.currency)
      )
      from public.campaign_metric_snapshots s
      join public.campaign_runs r on r.id = s.campaign_run_id
      join public.campaign_versions v on v.id = r.campaign_version_id
      where v.campaign_id = p_campaign_id
    ), jsonb_build_object('spend_minor', 0, 'impressions', 0, 'clicks', 0, 'provider_conversions', 0, 'currency', 'INR')),
    'crm', jsonb_build_object(
      'LeadCreated', (
        select count(*) from public.campaign_conversion_feedback_events e
        join public.campaign_runs r on r.id = e.campaign_run_id
        join public.campaign_versions v on v.id = r.campaign_version_id
        where v.campaign_id = p_campaign_id and e.conversion_type = 'LeadCreated'
      ),
      'QualifiedLead', (
        select count(*) from public.campaign_conversion_feedback_events e
        join public.campaign_runs r on r.id = e.campaign_run_id
        join public.campaign_versions v on v.id = r.campaign_version_id
        where v.campaign_id = p_campaign_id and e.conversion_type = 'QualifiedLead'
      ),
      'ConsultationScheduled', (
        select count(*) from public.campaign_conversion_feedback_events e
        join public.campaign_runs r on r.id = e.campaign_run_id
        join public.campaign_versions v on v.id = r.campaign_version_id
        where v.campaign_id = p_campaign_id and e.conversion_type = 'ConsultationScheduled'
      ),
      'ProposalSent', (
        select count(*) from public.campaign_conversion_feedback_events e
        join public.campaign_runs r on r.id = e.campaign_run_id
        join public.campaign_versions v on v.id = r.campaign_version_id
        where v.campaign_id = p_campaign_id and e.conversion_type = 'ProposalSent'
      ),
      'CommercialConversion', (
        select count(*) from public.campaign_conversion_feedback_events e
        join public.campaign_runs r on r.id = e.campaign_run_id
        join public.campaign_versions v on v.id = r.campaign_version_id
        where v.campaign_id = p_campaign_id and e.conversion_type = 'CommercialConversion'
      )
    ),
    'unattributed', (
      select count(*) from public.campaign_conversion_feedback_events e
      where e.attribution_state in ('not_attributable', 'ambiguous_target')
        and e.lead_id in (
          select l.id from public.leads l
        )
    ),
    'feedback', coalesce((
      select jsonb_agg(jsonb_build_object(
        'event_reference', e.event_reference,
        'conversion_type', e.conversion_type,
        'attribution_state', e.attribution_state,
        'provider_submission_state', e.provider_submission_state
      ) order by e.created_at desc)
      from public.campaign_conversion_feedback_events e
      join public.campaign_runs r on r.id = e.campaign_run_id
      join public.campaign_versions v on v.id = r.campaign_version_id
      where v.campaign_id = p_campaign_id
    ), '[]'::jsonb)
  ) into v_result;

  return v_result;
end;
$$;

-- complete: metrics_sync / conversion_feedback must not mutate run lifecycle
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
  v_follow_on uuid;
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
    if v_run.status = 'scheduled' then
      v_follow_on := private.enqueue_unique_campaign_run_operation(v_run, v_target.id, 'activate');
    elsif v_run.status = 'cancelled' and v_target.provider_campaign_id is not null then
      v_follow_on := private.enqueue_unique_campaign_run_operation(v_run, v_target.id, 'cancel');
    end if;
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
    'follow_on_operation_id', v_follow_on
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 8. RLS / grants
-- ----------------------------------------------------------------------------
alter table public.campaign_metric_snapshots enable row level security;
alter table public.campaign_conversion_feedback_events enable row level security;
alter table public.campaign_metric_snapshots force row level security;
alter table public.campaign_conversion_feedback_events force row level security;

create policy campaign_metric_snapshots_select_staff
  on public.campaign_metric_snapshots
  for select
  to authenticated
  using ((select public.authorize('campaigns.metrics.read')));

create policy campaign_conversion_feedback_events_select_staff
  on public.campaign_conversion_feedback_events
  for select
  to authenticated
  using ((select public.authorize('campaigns.metrics.read')));

revoke all on table public.campaign_metric_snapshots from public, anon, authenticated;
revoke all on table public.campaign_conversion_feedback_events from public, anon, authenticated;
grant select on table public.campaign_metric_snapshots to authenticated;
grant select on table public.campaign_conversion_feedback_events to authenticated;

alter function public.verify_campaign_execution_context_binding(text, text, text, text, integer, text) owner to postgres;
alter function public.upsert_campaign_metric_snapshot(uuid, timestamptz, timestamptz, text, bigint, bigint, bigint, bigint, text, text) owner to postgres;
alter function public.mark_campaign_conversion_feedback_state(uuid, text, text, text) owner to postgres;
alter function public.enqueue_campaign_metrics_sync(uuid) owner to postgres;
alter function public.get_campaign_metrics_board(uuid) owner to postgres;
alter function public.complete_campaign_run_operation(uuid, text, jsonb) owner to postgres;

revoke all on function public.verify_campaign_execution_context_binding(text, text, text, text, integer, text) from public, anon, authenticated;
revoke all on function public.upsert_campaign_metric_snapshot(uuid, timestamptz, timestamptz, text, bigint, bigint, bigint, bigint, text, text) from public, anon, authenticated;
revoke all on function public.mark_campaign_conversion_feedback_state(uuid, text, text, text) from public, anon, authenticated;
revoke all on function public.enqueue_campaign_metrics_sync(uuid) from public, anon, authenticated;
revoke all on function public.get_campaign_metrics_board(uuid) from public, anon;
revoke all on function private.resolve_trusted_campaign_target_from_attribution(jsonb) from public, anon, authenticated;
revoke all on function private.upsert_campaign_conversion_feedback_event(text, text, uuid, text, uuid, jsonb, timestamptz, bigint, text) from public, anon, authenticated;

grant execute on function public.verify_campaign_execution_context_binding(text, text, text, text, integer, text) to service_role;
grant execute on function public.upsert_campaign_metric_snapshot(uuid, timestamptz, timestamptz, text, bigint, bigint, bigint, bigint, text, text) to service_role;
grant execute on function public.mark_campaign_conversion_feedback_state(uuid, text, text, text) to service_role;
grant execute on function public.enqueue_campaign_metrics_sync(uuid) to service_role;
grant execute on function public.get_campaign_metrics_board(uuid) to authenticated;
grant execute on function public.complete_campaign_run_operation(uuid, text, jsonb) to service_role;

create or replace function public.enqueue_campaign_conversion_feedback(p_event_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_event public.campaign_conversion_feedback_events%rowtype;
  v_run public.campaign_runs%rowtype;
  v_id uuid;
  v_key text;
  v_hash text;
begin
  select * into v_event from public.campaign_conversion_feedback_events where id = p_event_id for update;
  if not found then
    raise exception 'CAMPAIGN_NOT_FOUND_OR_FORBIDDEN' using errcode = 'P0002';
  end if;
  if v_event.attribution_state is distinct from 'attributable' or v_event.campaign_run_id is null then
    raise exception 'CAMPAIGN_FEEDBACK_NOT_ATTRIBUTABLE' using errcode = '22023';
  end if;
  select * into v_run from public.campaign_runs where id = v_event.campaign_run_id for update;
  v_key := 'conversion_feedback:' || v_event.id::text;
  v_hash := private.marketing_sha256(v_event.id::text || '|conversion_feedback');
  insert into public.campaign_run_operations (
    campaign_run_id, campaign_run_target_id, operation_type, operation_state,
    operation_key, request_hash
  ) values (
    v_run.id, v_event.campaign_run_target_id, 'conversion_feedback', 'pending', v_key, v_hash
  )
  on conflict (operation_key) do nothing
  returning id into v_id;
  if v_id is null then
    select id into v_id from public.campaign_run_operations where operation_key = v_key;
  end if;
  return jsonb_build_object('outcome_code', 'ok', 'operation_id', v_id);
end;
$$;

alter function public.enqueue_campaign_conversion_feedback(uuid) owner to postgres;
revoke all on function public.enqueue_campaign_conversion_feedback(uuid) from public, anon, authenticated;
grant execute on function public.enqueue_campaign_conversion_feedback(uuid) to service_role;
