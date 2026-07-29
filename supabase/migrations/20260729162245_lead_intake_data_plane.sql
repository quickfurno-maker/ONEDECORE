-- ONEDECORE Phase 4A — Secure Lead Intake Data Plane (local foundation)
-- Forward-only. Do not apply to managed Supabase in this phase.
-- Suppression table deferred: contact_suppressions awaits Phase 5 / WhatsApp durable model.

-- =============================================================================
-- 1. System permissions + role mappings
-- =============================================================================

insert into public.permissions (code, name, description, is_system, is_active) values
  ('leads.read', 'Read Leads', 'Allows viewing CRM contacts, channels, leads and lead events', true, true),
  ('leads.manage', 'Manage Leads', 'Allows updating lead status and assignment', true, true),
  ('consents.read', 'Read Consent Evidence', 'Allows viewing append-only consent events', true, true),
  ('lead_intake.audit', 'Audit Lead Intake', 'Allows viewing lead intake request metadata (no raw PII)', true, true)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  is_system = true,
  is_active = true;

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where (
    (r.code = 'super_admin' and p.code in ('leads.read', 'leads.manage', 'consents.read', 'lead_intake.audit'))
    or (r.code = 'management' and p.code in ('leads.read', 'leads.manage', 'consents.read', 'lead_intake.audit'))
    or (r.code = 'sales' and p.code in ('leads.read', 'leads.manage', 'consents.read'))
  )
  and r.is_system = true
on conflict (role_id, permission_id) do nothing;

-- =============================================================================
-- 2. contacts
-- =============================================================================

create table public.contacts (
  id uuid primary key default gen_random_uuid(),
  display_name text not null,
  status text not null default 'active',
  merged_into uuid references public.contacts (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_contacts_display_name check (length(trim(display_name)) between 2 and 120),
  constraint chk_contacts_status check (status in ('active', 'do_not_contact', 'merged', 'archived')),
  constraint chk_contacts_no_self_merge check (merged_into is null or merged_into <> id),
  constraint chk_contacts_merged_requires_target check (
    (status = 'merged' and merged_into is not null)
    or (status <> 'merged' and merged_into is null)
  )
);

comment on table public.contacts is 'CRM contact identity records. Phone is the deterministic intake deduplication channel; email never auto-merges.';

create index idx_contacts_status on public.contacts (status);
create index idx_contacts_merged_into on public.contacts (merged_into) where merged_into is not null;

create trigger trg_contacts_updated_at
  before update on public.contacts
  for each row execute function private.set_updated_at();

-- =============================================================================
-- 3. contact_channels
-- =============================================================================

create table public.contact_channels (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete restrict,
  channel_type text not null,
  address_normalized text not null,
  status text not null default 'active',
  is_primary boolean not null default false,
  verified_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_contact_channels_type check (channel_type in ('phone', 'email', 'whatsapp')),
  constraint chk_contact_channels_status check (status in ('active', 'invalid', 'suppressed', 'archived')),
  constraint chk_contact_channels_address_len check (length(address_normalized) between 3 and 254),
  constraint chk_contact_channels_phone_e164 check (
    channel_type not in ('phone', 'whatsapp')
    or address_normalized ~ '^\+[1-9]\d{1,14}$'
  ),
  constraint chk_contact_channels_email_basic check (
    channel_type <> 'email'
    or (
      address_normalized = lower(address_normalized)
      and length(address_normalized) <= 254
      and address_normalized ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    )
  )
);

comment on table public.contact_channels is 'Normalized contact channels. Active phone/WhatsApp are globally unique; email uniqueness is per-contact only (no auto-merge).';

create index idx_contact_channels_contact_id on public.contact_channels (contact_id);
create index idx_contact_channels_address on public.contact_channels (channel_type, address_normalized);

create unique index uq_contact_channels_active_per_contact
  on public.contact_channels (contact_id, channel_type, address_normalized)
  where status = 'active';

create unique index uq_contact_channels_active_phone_global
  on public.contact_channels (address_normalized)
  where channel_type = 'phone' and status = 'active';

create unique index uq_contact_channels_active_whatsapp_global
  on public.contact_channels (address_normalized)
  where channel_type = 'whatsapp' and status = 'active';

create unique index uq_contact_channels_one_primary_per_type
  on public.contact_channels (contact_id, channel_type)
  where is_primary = true and status = 'active';

create trigger trg_contact_channels_updated_at
  before update on public.contact_channels
  for each row execute function private.set_updated_at();

-- =============================================================================
-- 4. lead_intake_requests (created before consent FK wiring; lead_id added after leads)
-- =============================================================================

create table public.lead_intake_requests (
  id uuid primary key default gen_random_uuid(),
  idempotency_key uuid not null,
  request_hash text not null,
  network_fingerprint_hash text not null,
  phone_fingerprint_hash text not null,
  status text not null,
  outcome_code text,
  lead_id uuid,
  submission_reference uuid,
  created_at timestamptz not null default now(),
  completed_at timestamptz,
  retry_after_seconds integer,

  constraint uq_lead_intake_requests_idempotency unique (idempotency_key),
  constraint chk_lead_intake_requests_status check (
    status in ('processing', 'completed', 'rejected', 'failed')
  ),
  constraint chk_lead_intake_requests_outcome check (
    outcome_code is null
    or outcome_code in (
      'CREATED',
      'IDEMPOTENT_REPLAY',
      'IDEMPOTENCY_CONFLICT',
      'NETWORK_RATE_LIMIT',
      'PHONE_RATE_LIMIT',
      'VALIDATION_REJECTED',
      'INTERNAL_FAILURE'
    )
  ),
  constraint chk_lead_intake_requests_hash_request check (request_hash ~ '^[a-f0-9]{64}$'),
  constraint chk_lead_intake_requests_hash_network check (network_fingerprint_hash ~ '^[a-f0-9]{64}$'),
  constraint chk_lead_intake_requests_hash_phone check (phone_fingerprint_hash ~ '^[a-f0-9]{64}$'),
  constraint chk_lead_intake_requests_retry check (
    retry_after_seconds is null
    or (retry_after_seconds >= 0 and retry_after_seconds <= 86400)
  )
);

comment on table public.lead_intake_requests is 'Idempotent intake ledger. Stores HMAC fingerprints only — never raw IP, user-agent or request body. Rate-limit values: OWNER_REVIEW_REQUIRED_BEFORE_PRODUCTION.';

create index idx_lead_intake_requests_network_created
  on public.lead_intake_requests (network_fingerprint_hash, created_at desc);
create index idx_lead_intake_requests_phone_created
  on public.lead_intake_requests (phone_fingerprint_hash, created_at desc);
create index idx_lead_intake_requests_status on public.lead_intake_requests (status);
create index idx_lead_intake_requests_created on public.lead_intake_requests (created_at desc);

-- =============================================================================
-- 5. leads
-- =============================================================================

create table public.leads (
  id uuid primary key default gen_random_uuid(),
  submission_reference uuid not null default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete restrict,
  submitted_name text not null,
  submitted_email text,
  status text not null default 'new',
  source text not null default 'website-planner',
  service_code text not null,
  property_code text not null,
  timeline_code text not null,
  room_codes text[] not null default '{}'::text[],
  budget_comfort_code text,
  estimate_snapshot jsonb,
  locality text,
  message text,
  planner_version text not null,
  landing_path text not null,
  attribution jsonb not null default '{}'::jsonb,
  assigned_to uuid references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_leads_submission_reference unique (submission_reference),
  constraint chk_leads_submitted_name check (length(trim(submitted_name)) between 2 and 120),
  constraint chk_leads_submitted_email check (
    submitted_email is null
    or (
      submitted_email = lower(submitted_email)
      and length(submitted_email) <= 254
      and submitted_email ~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
    )
  ),
  constraint chk_leads_status check (
    status in (
      'new',
      'contacted',
      'qualified',
      'consultation_scheduled',
      'site_visit_scheduled',
      'proposal_sent',
      'negotiation',
      'won',
      'lost',
      'dormant',
      'do_not_contact'
    )
  ),
  constraint chk_leads_source check (source in ('website-planner', 'local-test')),
  constraint chk_leads_service_code check (
    service_code in ('complete-home-interiors', 'modular-kitchens', 'custom-wardrobes')
  ),
  constraint chk_leads_property_code check (
    property_code in (
      'apartment-1bhk',
      'apartment-2bhk',
      'apartment-3bhk',
      'apartment-4bhk-plus',
      'villa-rowhouse',
      'single-room'
    )
  ),
  constraint chk_leads_timeline_code check (
    timeline_code in (
      'ready-now',
      'within-3-months',
      '3-6-months',
      'more-than-6-months',
      'exploring'
    )
  ),
  constraint chk_leads_room_codes_allowed check (
    room_codes <@ array['living', 'kitchen', 'bedrooms', 'wardrobes', 'dining', 'other']::text[]
  ),
  constraint chk_leads_room_codes_max check (cardinality(room_codes) <= 6),
  constraint chk_leads_budget_comfort check (
    budget_comfort_code is null
    or budget_comfort_code in ('under-3l', '3-6l', '6-12l', '12-20l', '20-30l', '30l-plus')
  ),
  constraint chk_leads_estimate_object check (
    estimate_snapshot is null
    or (jsonb_typeof(estimate_snapshot) = 'object' and pg_column_size(estimate_snapshot) <= 4096)
  ),
  constraint chk_leads_locality check (locality is null or length(locality) <= 120),
  constraint chk_leads_message check (message is null or length(message) <= 2000),
  constraint chk_leads_planner_version check (length(planner_version) between 1 and 80),
  constraint chk_leads_landing_path check (
    landing_path like '/%'
    and length(landing_path) <= 500
    and landing_path !~ '[[:space:]]'
  ),
  constraint chk_leads_attribution_object check (
    jsonb_typeof(attribution) = 'object'
    and pg_column_size(attribution) <= 2048
  )
);

comment on table public.leads is 'CRM leads created only via service-role submit_lead_intake RPC. Public client sees submission_reference only.';

create index idx_leads_contact_created on public.leads (contact_id, created_at desc);
create index idx_leads_status_created on public.leads (status, created_at desc);
create index idx_leads_assigned_status on public.leads (assigned_to, status) where assigned_to is not null;
create index idx_leads_service_created on public.leads (service_code, created_at desc);

create trigger trg_leads_updated_at
  before update on public.leads
  for each row execute function private.set_updated_at();

create or replace function private.enforce_unique_lead_room_codes()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if cardinality(new.room_codes) <> (
    select count(distinct x) from unnest(new.room_codes) as t(x)
  ) then
    raise exception 'room_codes must be unique'
      using errcode = '23514';
  end if;
  return new;
end;
$$;

create trigger trg_leads_unique_room_codes
  before insert or update on public.leads
  for each row execute function private.enforce_unique_lead_room_codes();

revoke execute on function private.enforce_unique_lead_room_codes() from public, anon, authenticated;

alter table public.lead_intake_requests
  add constraint fk_lead_intake_requests_lead
  foreign key (lead_id) references public.leads (id) on delete restrict;

-- =============================================================================
-- 6. consent_events (append-only)
-- =============================================================================

create table public.consent_events (
  id uuid primary key default gen_random_uuid(),
  contact_id uuid not null references public.contacts (id) on delete restrict,
  lead_id uuid references public.leads (id) on delete restrict,
  intake_request_id uuid references public.lead_intake_requests (id) on delete restrict,
  purpose_code text not null,
  channel text not null,
  event_type text not null,
  copy_version text not null,
  notice_version text not null,
  source text not null,
  locale text not null default 'en-IN',
  actor_type text not null,
  occurred_at timestamptz not null default now(),
  evidence jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint chk_consent_events_purpose check (
    purpose_code in (
      'SERVICE_ENQUIRY',
      'SERVICE_COMMUNICATION',
      'WHATSAPP_SERVICE',
      'MARKETING',
      'AI_ASSISTANCE_DISCLOSURE',
      'PORTFOLIO_MEDIA'
    )
  ),
  constraint chk_consent_events_channel check (
    channel in ('website-form', 'email', 'phone', 'whatsapp', 'in-person', 'portfolio-cms')
  ),
  constraint chk_consent_events_type check (
    event_type in ('granted', 'withdrawn', 'suppressed', 'expired')
  ),
  constraint chk_consent_events_actor check (
    actor_type in ('data-principal', 'staff', 'system', 'processor')
  ),
  constraint chk_consent_events_copy_version check (length(copy_version) between 1 and 120),
  constraint chk_consent_events_notice_version check (length(notice_version) between 1 and 120),
  constraint chk_consent_events_source check (length(source) between 1 and 80),
  constraint chk_consent_events_locale check (locale in ('en-IN')),
  constraint chk_consent_events_evidence check (
    jsonb_typeof(evidence) = 'object'
    and pg_column_size(evidence) <= 2048
  )
);

comment on table public.consent_events is 'Append-only consent evidence. Phase 4A intake writes required SERVICE_ENQUIRY + SERVICE_COMMUNICATION grants; optional WhatsApp/marketing only when explicitly true.';

create index idx_consent_events_contact on public.consent_events (contact_id, occurred_at desc);
create index idx_consent_events_lead on public.consent_events (lead_id, occurred_at desc) where lead_id is not null;
create index idx_consent_events_purpose on public.consent_events (purpose_code, occurred_at desc);

create or replace function private.forbid_consent_events_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'consent_events is append-only'
    using errcode = '55000';
end;
$$;

create trigger trg_consent_events_no_update
  before update on public.consent_events
  for each row execute function private.forbid_consent_events_mutation();

create trigger trg_consent_events_no_delete
  before delete on public.consent_events
  for each row execute function private.forbid_consent_events_mutation();

revoke execute on function private.forbid_consent_events_mutation() from public, anon, authenticated;

-- =============================================================================
-- 7. lead_events (append-only)
-- =============================================================================

create table public.lead_events (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete restrict,
  event_type text not null,
  actor_type text not null,
  actor_id uuid references public.profiles (id) on delete restrict,
  occurred_at timestamptz not null default now(),
  event_data jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint chk_lead_events_type check (
    event_type in (
      'lead.created',
      'lead.status_changed',
      'lead.assigned',
      'lead.note_added',
      'lead.duplicate_detected',
      'lead.consent_updated'
    )
  ),
  constraint chk_lead_events_actor check (
    actor_type in ('data-principal', 'staff', 'system', 'processor')
  ),
  constraint chk_lead_events_data check (
    jsonb_typeof(event_data) = 'object'
    and pg_column_size(event_data) <= 2048
  )
);

comment on table public.lead_events is 'Append-only lead history. Phase 4A creates one lead.created event only for newly created leads.';

create index idx_lead_events_lead on public.lead_events (lead_id, occurred_at desc);
create index idx_lead_events_type on public.lead_events (event_type, occurred_at desc);

create or replace function private.forbid_lead_events_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception 'lead_events is append-only'
    using errcode = '55000';
end;
$$;

create trigger trg_lead_events_no_update
  before update on public.lead_events
  for each row execute function private.forbid_lead_events_mutation();

create trigger trg_lead_events_no_delete
  before delete on public.lead_events
  for each row execute function private.forbid_lead_events_mutation();

revoke execute on function private.forbid_lead_events_mutation() from public, anon, authenticated;

-- =============================================================================
-- 8. RLS + grants
-- =============================================================================

alter table public.contacts enable row level security;
alter table public.contact_channels enable row level security;
alter table public.leads enable row level security;
alter table public.lead_intake_requests enable row level security;
alter table public.consent_events enable row level security;
alter table public.lead_events enable row level security;

revoke all on table public.contacts from public, anon, authenticated;
revoke all on table public.contact_channels from public, anon, authenticated;
revoke all on table public.leads from public, anon, authenticated;
revoke all on table public.lead_intake_requests from public, anon, authenticated;
revoke all on table public.consent_events from public, anon, authenticated;
revoke all on table public.lead_events from public, anon, authenticated;

grant select on table public.contacts to authenticated;
grant select on table public.contact_channels to authenticated;
grant select on table public.leads to authenticated;
grant update (status, assigned_to) on table public.leads to authenticated;
grant select on table public.consent_events to authenticated;
grant select on table public.lead_events to authenticated;
grant select on table public.lead_intake_requests to authenticated;

create policy "contacts_select_leads"
  on public.contacts
  for select to authenticated
  using (
    (select public.authorize('leads.read'))
    or (select public.authorize('leads.manage'))
  );

create policy "contact_channels_select_leads"
  on public.contact_channels
  for select to authenticated
  using (
    (select public.authorize('leads.read'))
    or (select public.authorize('leads.manage'))
  );

create policy "leads_select"
  on public.leads
  for select to authenticated
  using (
    (select public.authorize('leads.read'))
    or (select public.authorize('leads.manage'))
  );

create policy "leads_update_manage"
  on public.leads
  for update to authenticated
  using ((select public.authorize('leads.manage')))
  with check ((select public.authorize('leads.manage')));

create policy "consent_events_select"
  on public.consent_events
  for select to authenticated
  using ((select public.authorize('consents.read')));

create policy "lead_events_select"
  on public.lead_events
  for select to authenticated
  using (
    (select public.authorize('leads.read'))
    or (select public.authorize('leads.manage'))
  );

create policy "lead_intake_requests_select_audit"
  on public.lead_intake_requests
  for select to authenticated
  using ((select public.authorize('lead_intake.audit')));

-- =============================================================================
-- 9. Atomic service-role RPC
-- =============================================================================

create or replace function public.submit_lead_intake(
  p_idempotency_key uuid,
  p_request_hash text,
  p_network_fingerprint_hash text,
  p_phone_fingerprint_hash text,
  p_planner_version text,
  p_submitted_name text,
  p_phone_e164 text,
  p_submitted_email text,
  p_service_code text,
  p_property_code text,
  p_timeline_code text,
  p_room_codes text[],
  p_budget_comfort_code text,
  p_estimate_snapshot jsonb,
  p_locality text,
  p_message text,
  p_landing_path text,
  p_attribution jsonb,
  p_source text,
  p_consent_service_enquiry boolean,
  p_consent_service_communication boolean,
  p_consent_whatsapp boolean,
  p_consent_marketing boolean,
  p_copy_service_enquiry text,
  p_copy_service_communication text,
  p_copy_whatsapp text,
  p_copy_marketing text,
  p_notice_version text
)
returns table (
  outcome text,
  submission_reference uuid,
  retry_after_seconds integer,
  duplicate boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_existing public.lead_intake_requests%rowtype;
  v_has_intake boolean := false;
  v_intake_id uuid;
  v_contact_id uuid;
  v_lead_id uuid;
  v_submission_reference uuid;
  v_existing_name text;
  v_network_15m integer;
  v_network_24h integer;
  v_phone_24h integer;
  v_retry integer;
  v_rooms text[];
begin
  -- 1. Validate bounds and allowlists
  if p_idempotency_key is null then
    raise exception 'validation: idempotency_key required' using errcode = '22023';
  end if;
  if p_request_hash is null or p_request_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'validation: request_hash' using errcode = '22023';
  end if;
  if p_network_fingerprint_hash is null or p_network_fingerprint_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'validation: network_fingerprint_hash' using errcode = '22023';
  end if;
  if p_phone_fingerprint_hash is null or p_phone_fingerprint_hash !~ '^[a-f0-9]{64}$' then
    raise exception 'validation: phone_fingerprint_hash' using errcode = '22023';
  end if;
  if p_planner_version is null or length(p_planner_version) < 1 or length(p_planner_version) > 80 then
    raise exception 'validation: planner_version' using errcode = '22023';
  end if;
  if p_submitted_name is null or length(trim(p_submitted_name)) < 2 or length(trim(p_submitted_name)) > 120 then
    raise exception 'validation: submitted_name' using errcode = '22023';
  end if;
  if p_phone_e164 is null or p_phone_e164 !~ '^\+[1-9]\d{1,14}$' then
    raise exception 'validation: phone_e164' using errcode = '22023';
  end if;
  if p_submitted_email is not null and (
    p_submitted_email <> lower(p_submitted_email)
    or length(p_submitted_email) > 254
    or p_submitted_email !~ '^[^@[:space:]]+@[^@[:space:]]+\.[^@[:space:]]+$'
  ) then
    raise exception 'validation: submitted_email' using errcode = '22023';
  end if;
  if p_service_code not in ('complete-home-interiors', 'modular-kitchens', 'custom-wardrobes') then
    raise exception 'validation: service_code' using errcode = '22023';
  end if;
  if p_property_code not in (
    'apartment-1bhk', 'apartment-2bhk', 'apartment-3bhk',
    'apartment-4bhk-plus', 'villa-rowhouse', 'single-room'
  ) then
    raise exception 'validation: property_code' using errcode = '22023';
  end if;
  if p_timeline_code not in (
    'ready-now', 'within-3-months', '3-6-months', 'more-than-6-months', 'exploring'
  ) then
    raise exception 'validation: timeline_code' using errcode = '22023';
  end if;

  v_rooms := coalesce(p_room_codes, '{}'::text[]);
  if cardinality(v_rooms) > 6 then
    raise exception 'validation: room_codes max' using errcode = '22023';
  end if;
  if not (v_rooms <@ array['living', 'kitchen', 'bedrooms', 'wardrobes', 'dining', 'other']::text[]) then
    raise exception 'validation: room_codes allowlist' using errcode = '22023';
  end if;
  if cardinality(v_rooms) <> (select count(distinct x) from unnest(v_rooms) as t(x)) then
    raise exception 'validation: room_codes unique' using errcode = '22023';
  end if;

  if p_budget_comfort_code is not null and p_budget_comfort_code not in (
    'under-3l', '3-6l', '6-12l', '12-20l', '20-30l', '30l-plus'
  ) then
    raise exception 'validation: budget_comfort_code' using errcode = '22023';
  end if;
  if p_estimate_snapshot is not null and (
    jsonb_typeof(p_estimate_snapshot) <> 'object'
    or pg_column_size(p_estimate_snapshot) > 4096
  ) then
    raise exception 'validation: estimate_snapshot' using errcode = '22023';
  end if;
  if p_locality is not null and length(p_locality) > 120 then
    raise exception 'validation: locality' using errcode = '22023';
  end if;
  if p_message is not null and length(p_message) > 2000 then
    raise exception 'validation: message' using errcode = '22023';
  end if;
  if p_landing_path is null
    or p_landing_path not like '/%'
    or length(p_landing_path) > 500
    or p_landing_path ~ '[[:space:]]'
  then
    raise exception 'validation: landing_path' using errcode = '22023';
  end if;
  if p_attribution is null
    or jsonb_typeof(p_attribution) <> 'object'
    or pg_column_size(p_attribution) > 2048
  then
    raise exception 'validation: attribution' using errcode = '22023';
  end if;
  if p_source not in ('website-planner', 'local-test') then
    raise exception 'validation: source' using errcode = '22023';
  end if;
  if p_consent_service_enquiry is distinct from true
    or p_consent_service_communication is distinct from true
  then
    raise exception 'validation: required consent' using errcode = '22023';
  end if;
  if p_copy_service_enquiry is null or length(p_copy_service_enquiry) < 1 then
    raise exception 'validation: copy_service_enquiry' using errcode = '22023';
  end if;
  if p_copy_service_communication is null or length(p_copy_service_communication) < 1 then
    raise exception 'validation: copy_service_communication' using errcode = '22023';
  end if;
  if coalesce(p_consent_whatsapp, false) and (p_copy_whatsapp is null or length(p_copy_whatsapp) < 1) then
    raise exception 'validation: whatsapp copy version' using errcode = '22023';
  end if;
  if coalesce(p_consent_marketing, false) and (p_copy_marketing is null or length(p_copy_marketing) < 1) then
    raise exception 'validation: marketing copy version' using errcode = '22023';
  end if;
  if p_notice_version is null or length(p_notice_version) < 1 then
    raise exception 'validation: notice_version' using errcode = '22023';
  end if;

  -- 5. Advisory locks first (idempotency + phone)
  perform pg_advisory_xact_lock(hashtextextended(p_idempotency_key::text, 0));
  perform pg_advisory_xact_lock(hashtextextended(p_phone_fingerprint_hash, 1));

  -- 2–4. Resolve idempotency under lock
  select * into v_existing
  from public.lead_intake_requests
  where idempotency_key = p_idempotency_key
  for update;

  v_has_intake := found;

  if v_has_intake then
    if v_existing.status = 'completed'
      and v_existing.request_hash = p_request_hash
      and v_existing.submission_reference is not null
    then
      return query
      select
        'idempotent_replay'::text,
        v_existing.submission_reference,
        null::integer,
        true;
      return;
    end if;

    if v_existing.request_hash is distinct from p_request_hash then
      update public.lead_intake_requests
      set status = 'rejected',
          outcome_code = 'IDEMPOTENCY_CONFLICT',
          completed_at = now()
      where id = v_existing.id
        and status <> 'completed';

      return query
      select
        'idempotency_conflict'::text,
        null::uuid,
        null::integer,
        false;
      return;
    end if;

    if v_existing.status = 'completed' then
      return query
      select
        'idempotent_replay'::text,
        v_existing.submission_reference,
        null::integer,
        true;
      return;
    end if;
  end if;

  -- 6–7. Rate limits (OWNER_REVIEW_REQUIRED_BEFORE_PRODUCTION)
  select count(*)::integer into v_network_15m
  from public.lead_intake_requests
  where network_fingerprint_hash = p_network_fingerprint_hash
    and created_at > now() - interval '15 minutes'
    and outcome_code is distinct from 'IDEMPOTENT_REPLAY';

  select count(*)::integer into v_network_24h
  from public.lead_intake_requests
  where network_fingerprint_hash = p_network_fingerprint_hash
    and created_at > now() - interval '24 hours'
    and outcome_code is distinct from 'IDEMPOTENT_REPLAY';

  if v_network_15m >= 5 or v_network_24h >= 20 then
    v_retry := case
      when v_network_15m >= 5 then 900
      else 3600
    end;

    insert into public.lead_intake_requests (
      idempotency_key,
      request_hash,
      network_fingerprint_hash,
      phone_fingerprint_hash,
      status,
      outcome_code,
      completed_at,
      retry_after_seconds
    ) values (
      p_idempotency_key,
      p_request_hash,
      p_network_fingerprint_hash,
      p_phone_fingerprint_hash,
      'rejected',
      'NETWORK_RATE_LIMIT',
      now(),
      v_retry
    )
    on conflict (idempotency_key) do update
      set status = 'rejected',
          outcome_code = 'NETWORK_RATE_LIMIT',
          completed_at = now(),
          retry_after_seconds = excluded.retry_after_seconds;

    return query
    select
      'network_rate_limited'::text,
      null::uuid,
      v_retry,
      false;
    return;
  end if;

  select count(*)::integer into v_phone_24h
  from public.lead_intake_requests
  where phone_fingerprint_hash = p_phone_fingerprint_hash
    and created_at > now() - interval '24 hours'
    and outcome_code = 'CREATED';

  if v_phone_24h >= 3 then
    v_retry := 3600;
    insert into public.lead_intake_requests (
      idempotency_key,
      request_hash,
      network_fingerprint_hash,
      phone_fingerprint_hash,
      status,
      outcome_code,
      completed_at,
      retry_after_seconds
    ) values (
      p_idempotency_key,
      p_request_hash,
      p_network_fingerprint_hash,
      p_phone_fingerprint_hash,
      'rejected',
      'PHONE_RATE_LIMIT',
      now(),
      v_retry
    )
    on conflict (idempotency_key) do update
      set status = 'rejected',
          outcome_code = 'PHONE_RATE_LIMIT',
          completed_at = now(),
          retry_after_seconds = excluded.retry_after_seconds;

    return query
    select
      'phone_rate_limited'::text,
      null::uuid,
      v_retry,
      false;
    return;
  end if;

  -- Start processing row
  if not v_has_intake then
    insert into public.lead_intake_requests (
      idempotency_key,
      request_hash,
      network_fingerprint_hash,
      phone_fingerprint_hash,
      status
    ) values (
      p_idempotency_key,
      p_request_hash,
      p_network_fingerprint_hash,
      p_phone_fingerprint_hash,
      'processing'
    )
    returning id into v_intake_id;
  else
    v_intake_id := v_existing.id;
    update public.lead_intake_requests
    set status = 'processing',
        request_hash = p_request_hash,
        network_fingerprint_hash = p_network_fingerprint_hash,
        phone_fingerprint_hash = p_phone_fingerprint_hash
    where id = v_intake_id;
  end if;

  -- 8–11. Resolve / create contact + phone (+ optional email)
  select ch.contact_id
  into v_contact_id
  from public.contact_channels ch
  where ch.channel_type = 'phone'
    and ch.status = 'active'
    and ch.address_normalized = p_phone_e164
  limit 1;

  if v_contact_id is not null then
    select c.display_name into v_existing_name
    from public.contacts c
    where c.id = v_contact_id
    for update;
  end if;

  if v_contact_id is null then
    insert into public.contacts (display_name, status)
    values (trim(p_submitted_name), 'active')
    returning id into v_contact_id;

    insert into public.contact_channels (
      contact_id,
      channel_type,
      address_normalized,
      status,
      is_primary
    ) values (
      v_contact_id,
      'phone',
      p_phone_e164,
      'active',
      true
    );
  end if;
  -- existing contact: do not overwrite display_name

  if p_submitted_email is not null then
    if not exists (
      select 1
      from public.contact_channels
      where contact_id = v_contact_id
        and channel_type = 'email'
        and status = 'active'
        and address_normalized = p_submitted_email
    ) then
      insert into public.contact_channels (
        contact_id,
        channel_type,
        address_normalized,
        status,
        is_primary
      ) values (
        v_contact_id,
        'email',
        p_submitted_email,
        'active',
        not exists (
          select 1
          from public.contact_channels
          where contact_id = v_contact_id
            and channel_type = 'email'
            and status = 'active'
            and is_primary = true
        )
      );
    end if;
  end if;

  -- 12. Create lead
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
    estimate_snapshot,
    locality,
    message,
    planner_version,
    landing_path,
    attribution
  ) values (
    v_contact_id,
    trim(p_submitted_name),
    p_submitted_email,
    'new',
    p_source,
    p_service_code,
    p_property_code,
    p_timeline_code,
    v_rooms,
    p_budget_comfort_code,
    p_estimate_snapshot,
    nullif(trim(coalesce(p_locality, '')), ''),
    nullif(trim(coalesce(p_message, '')), ''),
    p_planner_version,
    p_landing_path,
    coalesce(p_attribution, '{}'::jsonb)
  )
  returning id, public.leads.submission_reference into v_lead_id, v_submission_reference;

  -- 13–14. Consent evidence
  insert into public.consent_events (
    contact_id, lead_id, intake_request_id, purpose_code, channel, event_type,
    copy_version, notice_version, source, locale, actor_type, evidence
  ) values (
    v_contact_id, v_lead_id, v_intake_id, 'SERVICE_ENQUIRY', 'website-form', 'granted',
    p_copy_service_enquiry, p_notice_version, p_source, 'en-IN', 'data-principal',
    jsonb_build_object('intakeRequestId', v_intake_id)
  );

  insert into public.consent_events (
    contact_id, lead_id, intake_request_id, purpose_code, channel, event_type,
    copy_version, notice_version, source, locale, actor_type, evidence
  ) values (
    v_contact_id, v_lead_id, v_intake_id, 'SERVICE_COMMUNICATION', 'website-form', 'granted',
    p_copy_service_communication, p_notice_version, p_source, 'en-IN', 'data-principal',
    jsonb_build_object('intakeRequestId', v_intake_id)
  );

  if coalesce(p_consent_whatsapp, false) then
    insert into public.consent_events (
      contact_id, lead_id, intake_request_id, purpose_code, channel, event_type,
      copy_version, notice_version, source, locale, actor_type, evidence
    ) values (
      v_contact_id, v_lead_id, v_intake_id, 'WHATSAPP_SERVICE', 'whatsapp', 'granted',
      p_copy_whatsapp, p_notice_version, p_source, 'en-IN', 'data-principal',
      jsonb_build_object('intakeRequestId', v_intake_id)
    );
  end if;

  if coalesce(p_consent_marketing, false) then
    insert into public.consent_events (
      contact_id, lead_id, intake_request_id, purpose_code, channel, event_type,
      copy_version, notice_version, source, locale, actor_type, evidence
    ) values (
      v_contact_id, v_lead_id, v_intake_id, 'MARKETING', 'website-form', 'granted',
      p_copy_marketing, p_notice_version, p_source, 'en-IN', 'data-principal',
      jsonb_build_object('intakeRequestId', v_intake_id)
    );
  end if;

  -- 15. lead.created event
  insert into public.lead_events (
    lead_id, event_type, actor_type, event_data
  ) values (
    v_lead_id,
    'lead.created',
    'data-principal',
    jsonb_build_object(
      'source', p_source,
      'intakeRequestId', v_intake_id,
      'reusedContact', (v_existing_name is not null)
    )
  );

  -- 16. Complete intake request
  update public.lead_intake_requests
  set status = 'completed',
      outcome_code = 'CREATED',
      lead_id = v_lead_id,
      submission_reference = v_submission_reference,
      completed_at = now(),
      retry_after_seconds = null
  where id = v_intake_id;

  -- 17. Safe result
  return query
  select
    'created'::text,
    v_submission_reference,
    null::integer,
    false;
end;
$$;

comment on function public.submit_lead_intake is
  'Atomic service-role-only lead intake. Returns safe outcome fields only. Rate limits: OWNER_REVIEW_REQUIRED_BEFORE_PRODUCTION.';

alter function public.submit_lead_intake(
  uuid, text, text, text, text, text, text, text, text, text, text, text[], text, jsonb, text, text, text, jsonb, text,
  boolean, boolean, boolean, boolean, text, text, text, text, text
) owner to postgres;

revoke all on function public.submit_lead_intake(
  uuid, text, text, text, text, text, text, text, text, text, text, text[], text, jsonb, text, text, text, jsonb, text,
  boolean, boolean, boolean, boolean, text, text, text, text, text
) from public, anon, authenticated;

grant execute on function public.submit_lead_intake(
  uuid, text, text, text, text, text, text, text, text, text, text, text[], text, jsonb, text, text, text, jsonb, text,
  boolean, boolean, boolean, boolean, text, text, text, text, text
) to service_role;
