-- =============================================================================
-- ONEDECORE WM-6 (ADR-0034) — governed Automations, official WhatsApp Flows,
-- and Click-to-WhatsApp (CTWA) referral capture.
--
-- AUTOMATIONS
--
--   An automation is a single governed journey step: a trigger observed in
--   canonical evidence (lead created, stage reached, campaign reply, Flow
--   completion, CTWA referral), an optional delay, and ONE governed MARKETING
--   send whose template, preference category, parameters and buttons come
--   from the frozen WhatsApp spec of an APPROVED generic campaign version.
--   Generic approval therefore stays the only approval truth.
--
--   Activation and resume need whatsapp.automations.manage, an approved
--   version the actor did not approve (Sales Manager), a sendable MARKETING
--   template, complete button bindings and the marketing execution gate open.
--   Pause and archive are safety-increasing and never gated.
--
--   Every enrollment is re-proved just in time at claim: automation active,
--   template still APPROVED/MARKETING, live (not tombstoned) lead not in a
--   stop status, no customer reply since enrollment (when configured), contact
--   not DNC, WhatsApp channel active and not suppressed, current MARKETING
--   consent (never service consent), category preference, variables, send
--   policy, frequency caps across campaigns AND automations, quiet hours
--   (defer). One enrollment per contact per automation, ever. Claims are
--   durable with a TTL; an ambiguous provider outcome is needs_reconcile and is
--   never retried.
--
--   Triggers are observed by a service-role scan over rows other writers
--   already append (lead_events, reply attributions, Flow responses, referral
--   contexts). No CRM table gains a trigger. n8n, if used, only calls the
--   internal worker endpoint.
--
-- FLOWS
--
--   A Flow registry row is a local draft until Meta answers. Staff record the
--   decision to create / update / publish / deprecate / sync; only a
--   service-role outcome, relayed from the official Graph API response, may set
--   a provider Flow id or status. Nothing claims a Flow is published that Meta
--   did not report. Completed Flow replies (interactive nfm_reply) are captured
--   append-only, matched to a Flow by an opaque per-send flow token, reduced to
--   the Flow's allowlisted field mapping, and may fill ONLY empty CRM fields on
--   a live lead (locality, budget comfort band).
--
-- CTWA
--
--   Referral metadata that Meta attaches to the first inbound message from an
--   ad is persisted append-only in bounded, sanitised form (host + hash of the
--   source URL, never the Meta CDN media URLs). It is attribution evidence
--   only: it never creates identity, consent, or lead ownership.
--
-- ROLES (WM-0 matrix): whatsapp.automations.read/manage, whatsapp.flows.read/
-- manage to Super Admin and Sales Manager. Legacy roles and Sales Executive
-- receive nothing. Kriti has no role and no path here: it may draft text for a
-- human, never send, approve or mutate.
-- =============================================================================

-- 1. Permissions.
insert into public.permissions (code,name,description,is_system,is_active) values
('whatsapp.automations.read','Read WhatsApp Automations','Read governed WhatsApp automation definitions and enrollment evidence',true,true),
('whatsapp.automations.manage','Manage WhatsApp Automations','Draft, activate, pause and archive governed WhatsApp automations bound to approved campaign versions',true,true),
('whatsapp.flows.read','Read WhatsApp Flows','Read the official WhatsApp Flow registry, provider evidence and captured responses',true,true),
('whatsapp.flows.manage','Manage WhatsApp Flows','Draft Flows and request official Meta Flow create, update, publish, deprecate and sync',true,true)
on conflict (code) do update set name=excluded.name,description=excluded.description,is_system=true,is_active=true;

insert into public.role_permissions (role_id,permission_id)
select r.id,p.id
from (values
  ('super_admin','whatsapp.automations.read'),
  ('super_admin','whatsapp.automations.manage'),
  ('super_admin','whatsapp.flows.read'),
  ('super_admin','whatsapp.flows.manage'),
  ('sales_manager','whatsapp.automations.read'),
  ('sales_manager','whatsapp.automations.manage'),
  ('sales_manager','whatsapp.flows.read'),
  ('sales_manager','whatsapp.flows.manage')
) v(role_code,permission_code)
join public.roles r on r.code=v.role_code and r.is_system=true
join public.permissions p on p.code=v.permission_code and p.is_system=true
on conflict (role_id,permission_id) do nothing;

-- 2. Automation tables.
create table public.whatsapp_automations (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  trigger_type text not null,
  trigger_config jsonb not null default '{}'::jsonb,
  campaign_version_id uuid not null references public.campaign_versions(id) on delete restrict,
  delay_minutes integer not null default 0,
  stop_on_lead_statuses text[] not null default array['closed_won','closed_lost']::text[],
  stop_on_reply boolean not null default true,
  status text not null default 'draft',
  lock_version integer not null default 1,
  scan_cursor_at timestamptz,
  activated_by uuid references public.profiles(id) on delete restrict,
  activated_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_whatsapp_automation_name check (length(trim(name)) between 2 and 120),
  constraint chk_whatsapp_automation_description check (description is null or length(description)<=500),
  constraint chk_whatsapp_automation_trigger check (trigger_type in ('lead_created','lead_stage_changed','campaign_reply','flow_completed','ctwa_referral')),
  constraint chk_whatsapp_automation_trigger_config check (jsonb_typeof(trigger_config)='object' and pg_column_size(trigger_config)<=1024),
  constraint chk_whatsapp_automation_delay check (delay_minutes between 0 and 43200),
  constraint chk_whatsapp_automation_stop_statuses check (stop_on_lead_statuses <@ array['closed_won','closed_lost','on_hold']::text[]),
  constraint chk_whatsapp_automation_status check (status in ('draft','active','paused','archived')),
  constraint chk_whatsapp_automation_lock check (lock_version>=1),
  constraint chk_whatsapp_automation_activation_pair check ((activated_at is null)=(activated_by is null)),
  constraint chk_whatsapp_automation_live_activation check (status not in ('active','paused') or (activated_at is not null and scan_cursor_at is not null))
);
create unique index uq_whatsapp_automations_name_live on public.whatsapp_automations(lower(name)) where status<>'archived';
create index idx_whatsapp_automations_status on public.whatsapp_automations(status,trigger_type);

create table public.whatsapp_automation_enrollments (
  id uuid primary key default gen_random_uuid(),
  automation_id uuid not null references public.whatsapp_automations(id) on delete restrict,
  contact_id uuid not null references public.contacts(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete restrict,
  trigger_key text not null,
  state text not null default 'pending',
  reason_code text,
  not_before timestamptz not null default now(),
  attempt_count integer not null default 0,
  claim_token uuid,
  claimed_by text,
  claimed_at timestamptz,
  claim_expires_at timestamptz,
  provider_request_started_at timestamptz,
  phone_number_id uuid references public.whatsapp_phone_numbers(id) on delete restrict,
  sender_e164 text,
  contact_channel_id uuid references public.contact_channels(id) on delete restrict,
  recipient_e164 text,
  template_parameters jsonb not null default '{}'::jsonb,
  provider_message_id text,
  canonical_message_id uuid references public.whatsapp_messages(id) on delete restrict,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint uq_whatsapp_automation_enrollment_contact unique (automation_id,contact_id),
  constraint uq_whatsapp_automation_enrollment_trigger unique (automation_id,trigger_key),
  constraint chk_whatsapp_automation_enrollment_trigger_key check (length(trigger_key) between 1 and 200),
  constraint chk_whatsapp_automation_enrollment_state check (state in ('pending','claimed','sent','skipped','failed','needs_reconcile','cancelled')),
  constraint chk_whatsapp_automation_enrollment_reason check (reason_code is null or length(reason_code) between 1 and 80),
  constraint chk_whatsapp_automation_enrollment_attempts check (attempt_count between 0 and 3),
  constraint chk_whatsapp_automation_enrollment_claim check (
    (claim_token is null and claimed_by is null and claimed_at is null and claim_expires_at is null)
    or (claim_token is not null and claimed_by is not null and claimed_at is not null and claim_expires_at is not null and claim_expires_at>claimed_at)
  ),
  constraint chk_whatsapp_automation_enrollment_claimed_state check ((state='claimed')=(claim_token is not null)),
  constraint chk_whatsapp_automation_enrollment_worker check (claimed_by is null or length(claimed_by) between 1 and 80),
  constraint chk_whatsapp_automation_enrollment_sender check (sender_e164 is null or sender_e164 ~ '^\+[1-9]\d{1,14}$'),
  constraint chk_whatsapp_automation_enrollment_recipient check (recipient_e164 is null or recipient_e164 ~ '^\+[1-9]\d{1,14}$'),
  constraint chk_whatsapp_automation_enrollment_parameters check (jsonb_typeof(template_parameters)='object' and pg_column_size(template_parameters)<=4096),
  constraint chk_whatsapp_automation_enrollment_provider_message check (provider_message_id is null or length(provider_message_id) between 1 and 128),
  constraint chk_whatsapp_automation_enrollment_error check (last_error_code is null or length(last_error_code) between 1 and 128)
);
create unique index uq_whatsapp_automation_enrollments_provider_message on public.whatsapp_automation_enrollments(provider_message_id) where provider_message_id is not null;
create index idx_whatsapp_automation_enrollments_claim on public.whatsapp_automation_enrollments(state,not_before,created_at) where state='pending';
create index idx_whatsapp_automation_enrollments_expiry on public.whatsapp_automation_enrollments(claim_expires_at) where state='claimed';
create index idx_whatsapp_automation_enrollments_contact on public.whatsapp_automation_enrollments(contact_id,created_at desc);
create index idx_whatsapp_automation_enrollments_automation_state on public.whatsapp_automation_enrollments(automation_id,state);

create table public.whatsapp_automation_events (
  id bigserial primary key,
  automation_id uuid not null references public.whatsapp_automations(id) on delete restrict,
  enrollment_id uuid references public.whatsapp_automation_enrollments(id) on delete restrict,
  event_type text not null,
  from_state text,
  to_state text,
  actor_type text not null,
  actor_id uuid references public.profiles(id) on delete restrict,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default now(),
  constraint chk_whatsapp_automation_event_type check (length(event_type) between 1 and 64),
  constraint chk_whatsapp_automation_event_actor check (actor_type in ('worker','staff','system')),
  constraint chk_whatsapp_automation_event_details check (jsonb_typeof(details)='object' and pg_column_size(details)<=4096)
);
create index idx_whatsapp_automation_events_automation_time on public.whatsapp_automation_events(automation_id,occurred_at desc,id desc);
create index idx_whatsapp_automation_events_enrollment on public.whatsapp_automation_events(enrollment_id,id) where enrollment_id is not null;

create table public.whatsapp_message_automation_attributions (
  id uuid primary key default gen_random_uuid(),
  whatsapp_message_id uuid not null unique references public.whatsapp_messages(id) on delete restrict,
  automation_id uuid not null references public.whatsapp_automations(id) on delete restrict,
  enrollment_id uuid not null unique references public.whatsapp_automation_enrollments(id) on delete restrict,
  campaign_version_id uuid not null references public.campaign_versions(id) on delete restrict,
  created_at timestamptz not null default now()
);
create index idx_whatsapp_automation_attribution_automation on public.whatsapp_message_automation_attributions(automation_id,created_at);

-- 3. Flow tables.
create table public.whatsapp_flows (
  id uuid primary key default gen_random_uuid(),
  business_account_id uuid not null references public.whatsapp_business_accounts(id) on delete restrict,
  provider_flow_id text,
  name text not null,
  categories text[] not null,
  purpose text not null,
  field_mappings jsonb not null default '{}'::jsonb,
  flow_json jsonb,
  flow_json_hash text,
  provider_status text not null default 'local_draft',
  provider_status_raw text,
  validation_errors jsonb not null default '[]'::jsonb,
  provider_synced_at timestamptz,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_whatsapp_flow_provider_id check (provider_flow_id is null or provider_flow_id ~ '^[0-9]{1,64}$'),
  constraint chk_whatsapp_flow_name check (length(trim(name)) between 1 and 200),
  constraint chk_whatsapp_flow_categories check (cardinality(categories) between 1 and 8 and categories <@ array['SIGN_UP','SIGN_IN','APPOINTMENT_BOOKING','LEAD_GENERATION','CONTACT_US','CUSTOMER_SUPPORT','SURVEY','OTHER']::text[]),
  constraint chk_whatsapp_flow_purpose check (purpose in ('lead_qualification','consultation_request','feedback','other')),
  constraint chk_whatsapp_flow_mappings check (jsonb_typeof(field_mappings)='object' and pg_column_size(field_mappings)<=2048),
  constraint chk_whatsapp_flow_json check (flow_json is null or (jsonb_typeof(flow_json)='object' and pg_column_size(flow_json)<=65536)),
  constraint chk_whatsapp_flow_json_hash check ((flow_json is null)=(flow_json_hash is null) and (flow_json_hash is null or flow_json_hash ~ '^[0-9a-f]{64}$')),
  constraint chk_whatsapp_flow_status check (provider_status in ('local_draft','DRAFT','PUBLISHED','DEPRECATED','BLOCKED','THROTTLED','unknown')),
  constraint chk_whatsapp_flow_status_raw check (provider_status_raw is null or length(provider_status_raw) between 1 and 64),
  constraint chk_whatsapp_flow_provider_pair check ((provider_status='local_draft')=(provider_flow_id is null)),
  constraint chk_whatsapp_flow_validation_errors check (jsonb_typeof(validation_errors)='array' and pg_column_size(validation_errors)<=4096)
);
create unique index uq_whatsapp_flows_provider_id on public.whatsapp_flows(provider_flow_id) where provider_flow_id is not null;
create unique index uq_whatsapp_flows_account_name on public.whatsapp_flows(business_account_id,lower(name));

create table public.whatsapp_flow_provider_requests (
  id uuid primary key default gen_random_uuid(),
  flow_id uuid not null references public.whatsapp_flows(id) on delete restrict,
  action text not null,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  idempotency_key uuid not null,
  request_hash text not null,
  flow_json_hash text,
  created_at timestamptz not null default now(),
  constraint uq_whatsapp_flow_request_idempotency unique (requested_by,idempotency_key),
  constraint chk_whatsapp_flow_request_action check (action in ('create','update_json','publish','deprecate','sync')),
  constraint chk_whatsapp_flow_request_hash check (request_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_whatsapp_flow_request_json_hash check (flow_json_hash is null or flow_json_hash ~ '^[0-9a-f]{64}$')
);
create index idx_whatsapp_flow_requests_flow on public.whatsapp_flow_provider_requests(flow_id,created_at desc);

create table public.whatsapp_flow_provider_events (
  id bigserial primary key,
  flow_id uuid not null references public.whatsapp_flows(id) on delete restrict,
  request_id uuid references public.whatsapp_flow_provider_requests(id) on delete restrict,
  outcome text not null,
  provider_status text,
  provider_status_raw text,
  error_code text,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default now(),
  constraint chk_whatsapp_flow_event_outcome check (outcome in ('accepted','failed','ambiguous','observed')),
  constraint chk_whatsapp_flow_event_status check (provider_status is null or provider_status in ('DRAFT','PUBLISHED','DEPRECATED','BLOCKED','THROTTLED','unknown')),
  constraint chk_whatsapp_flow_event_status_raw check (provider_status_raw is null or length(provider_status_raw) between 1 and 64),
  constraint chk_whatsapp_flow_event_error check (error_code is null or length(error_code) between 1 and 128),
  constraint chk_whatsapp_flow_event_details check (jsonb_typeof(details)='object' and pg_column_size(details)<=2048)
);
create unique index uq_whatsapp_flow_events_request on public.whatsapp_flow_provider_events(request_id) where request_id is not null;
create index idx_whatsapp_flow_events_flow on public.whatsapp_flow_provider_events(flow_id,occurred_at desc);

create table public.whatsapp_flow_tokens (
  id uuid primary key default gen_random_uuid(),
  token_hash text not null unique,
  flow_id uuid not null references public.whatsapp_flows(id) on delete restrict,
  purpose text not null,
  run_id uuid references public.whatsapp_campaign_runs(id) on delete restrict,
  recipient_id uuid references public.whatsapp_campaign_recipients(id) on delete restrict,
  enrollment_id uuid references public.whatsapp_automation_enrollments(id) on delete restrict,
  test_send_id uuid references public.whatsapp_campaign_test_sends(id) on delete restrict,
  button_index smallint not null,
  created_at timestamptz not null default now(),
  expires_at timestamptz not null,
  constraint chk_whatsapp_flow_token_hash check (token_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_whatsapp_flow_token_purpose check (purpose in ('campaign','automation','test')),
  constraint chk_whatsapp_flow_token_scope check (
    (purpose='campaign' and run_id is not null and recipient_id is not null and enrollment_id is null and test_send_id is null)
    or (purpose='automation' and enrollment_id is not null and run_id is null and recipient_id is null and test_send_id is null)
    or (purpose='test' and test_send_id is not null and run_id is null and recipient_id is null and enrollment_id is null)
  ),
  constraint chk_whatsapp_flow_token_button check (button_index between 0 and 9),
  constraint chk_whatsapp_flow_token_expiry check (expires_at>created_at)
);
create index idx_whatsapp_flow_tokens_flow on public.whatsapp_flow_tokens(flow_id);

create table public.whatsapp_flow_responses (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null unique references public.whatsapp_messages(id) on delete restrict,
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete restrict,
  contact_id uuid references public.contacts(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete restrict,
  flow_id uuid references public.whatsapp_flows(id) on delete restrict,
  flow_token_id uuid references public.whatsapp_flow_tokens(id) on delete restrict,
  response_fields jsonb not null default '{}'::jsonb,
  unmapped_key_count integer not null default 0,
  crm_applied_fields text[] not null default '{}'::text[],
  crm_apply_outcome text not null,
  received_at timestamptz not null,
  created_at timestamptz not null default now(),
  constraint chk_whatsapp_flow_response_fields check (jsonb_typeof(response_fields)='object' and pg_column_size(response_fields)<=4096),
  constraint chk_whatsapp_flow_response_unmapped check (unmapped_key_count>=0),
  constraint chk_whatsapp_flow_response_applied check (crm_applied_fields <@ array['locality','budget_comfort_code']::text[]),
  constraint chk_whatsapp_flow_response_outcome check (crm_apply_outcome in ('applied','nothing_to_apply','no_live_lead','unmatched_flow')),
  constraint chk_whatsapp_flow_response_match check ((flow_id is null)=(crm_apply_outcome='unmatched_flow'))
);
create index idx_whatsapp_flow_responses_flow on public.whatsapp_flow_responses(flow_id,created_at desc) where flow_id is not null;
create index idx_whatsapp_flow_responses_created on public.whatsapp_flow_responses(created_at);

create table public.whatsapp_referral_contexts (
  id uuid primary key default gen_random_uuid(),
  message_id uuid not null unique references public.whatsapp_messages(id) on delete restrict,
  conversation_id uuid not null references public.whatsapp_conversations(id) on delete restrict,
  contact_id uuid references public.contacts(id) on delete restrict,
  lead_id uuid references public.leads(id) on delete restrict,
  source_type text not null,
  source_id text,
  source_url_host text,
  source_url_hash text,
  headline text,
  body_excerpt text,
  media_type text,
  ctwa_clid text,
  captured_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default now(),
  constraint chk_whatsapp_referral_source_type check (source_type in ('ad','post','unknown')),
  constraint chk_whatsapp_referral_source_id check (source_id is null or source_id ~ '^[A-Za-z0-9_.:-]{1,128}$'),
  constraint chk_whatsapp_referral_host check (source_url_host is null or source_url_host ~ '^[a-z0-9.-]{1,255}$'),
  constraint chk_whatsapp_referral_hash check (source_url_hash is null or source_url_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_whatsapp_referral_headline check (headline is null or length(headline)<=200),
  constraint chk_whatsapp_referral_body check (body_excerpt is null or length(body_excerpt)<=300),
  constraint chk_whatsapp_referral_media check (media_type is null or media_type in ('image','video','unknown')),
  constraint chk_whatsapp_referral_clid check (ctwa_clid is null or (length(ctwa_clid) between 1 and 512 and ctwa_clid ~ '^[A-Za-z0-9_.-]+$'))
);
create index idx_whatsapp_referral_contexts_source on public.whatsapp_referral_contexts(source_id,created_at) where source_id is not null;
create index idx_whatsapp_referral_contexts_created on public.whatsapp_referral_contexts(created_at);

-- 4. WM-5 evidence widened to automation sends.
alter table public.whatsapp_click_tokens add column enrollment_id uuid references public.whatsapp_automation_enrollments(id) on delete restrict;
alter table public.whatsapp_click_tokens drop constraint chk_whatsapp_click_token_purpose;
alter table public.whatsapp_click_tokens drop constraint chk_whatsapp_click_token_scope;
alter table public.whatsapp_click_tokens add constraint chk_whatsapp_click_token_purpose check (purpose in ('campaign','automation','test'));
alter table public.whatsapp_click_tokens add constraint chk_whatsapp_click_token_scope check (
  (purpose='campaign' and run_id is not null and recipient_id is not null and enrollment_id is null and test_send_id is null)
  or (purpose='automation' and enrollment_id is not null and run_id is null and recipient_id is null and test_send_id is null)
  or (purpose='test' and test_send_id is not null and run_id is null and recipient_id is null and enrollment_id is null)
);
create index idx_whatsapp_click_tokens_enrollment on public.whatsapp_click_tokens(enrollment_id) where enrollment_id is not null;

alter table public.whatsapp_reply_attributions add column automation_id uuid references public.whatsapp_automations(id) on delete restrict;
alter table public.whatsapp_reply_attributions add column enrollment_id uuid references public.whatsapp_automation_enrollments(id) on delete restrict;
alter table public.whatsapp_reply_attributions drop constraint chk_whatsapp_reply_attribution_source;
alter table public.whatsapp_reply_attributions add constraint chk_whatsapp_reply_attribution_source check (
  (source_kind='campaign' and run_id is not null and recipient_id is not null and campaign_version_id is not null and automation_id is null and enrollment_id is null)
  or (source_kind='automation' and automation_id is not null and enrollment_id is not null and campaign_version_id is not null and run_id is null and recipient_id is null)
);
create index idx_whatsapp_reply_attributions_enrollment on public.whatsapp_reply_attributions(enrollment_id) where enrollment_id is not null;

-- 5. Guards.
create or replace function private.whatsapp_automation_guard()
returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception 'WHATSAPP_AUTOMATION_IMMUTABLE' using errcode='22023'; end if;
  if new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'WHATSAPP_AUTOMATION_IMMUTABLE' using errcode='22023';
  end if;
  if old.status='archived' and (new.status is distinct from old.status or new.scan_cursor_at is distinct from old.scan_cursor_at) then
    raise exception 'WHATSAPP_AUTOMATION_ARCHIVED' using errcode='22023';
  end if;
  -- What was activated is what runs. A different journey is a new automation.
  if old.status<>'draft' and (
       new.name is distinct from old.name or new.trigger_type is distinct from old.trigger_type
    or new.trigger_config is distinct from old.trigger_config or new.campaign_version_id is distinct from old.campaign_version_id
    or new.delay_minutes is distinct from old.delay_minutes or new.stop_on_lead_statuses is distinct from old.stop_on_lead_statuses
    or new.stop_on_reply is distinct from old.stop_on_reply) then
    raise exception 'WHATSAPP_AUTOMATION_IMMUTABLE' using errcode='22023';
  end if;
  new.updated_at:=now();
  return new;
end;$$;
revoke all on function private.whatsapp_automation_guard() from public,anon,authenticated;

create or replace function private.whatsapp_flow_guard()
returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception 'WHATSAPP_FLOW_IMMUTABLE' using errcode='22023'; end if;
  if new.business_account_id is distinct from old.business_account_id or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at
     or (old.provider_flow_id is not null and new.provider_flow_id is distinct from old.provider_flow_id) then
    raise exception 'WHATSAPP_FLOW_IMMUTABLE' using errcode='22023';
  end if;
  -- Provider truth is written only by the service-role outcome path.
  if coalesce(current_setting('onedecore.whatsapp_flow_provider_write',true),'')<>'1' and (
       new.provider_flow_id is distinct from old.provider_flow_id or new.provider_status is distinct from old.provider_status
    or new.provider_status_raw is distinct from old.provider_status_raw or new.validation_errors is distinct from old.validation_errors
    or new.provider_synced_at is distinct from old.provider_synced_at) then
    raise exception 'WHATSAPP_FLOW_PROVIDER_TRUTH_FORBIDDEN' using errcode='42501';
  end if;
  new.updated_at:=now();
  return new;
end;$$;
revoke all on function private.whatsapp_flow_guard() from public,anon,authenticated;

create trigger trg_whatsapp_automations_guard before update or delete on public.whatsapp_automations for each row execute function private.whatsapp_automation_guard();
create trigger trg_whatsapp_automation_enrollments_updated_at before update on public.whatsapp_automation_enrollments for each row execute function private.set_updated_at();
create trigger trg_whatsapp_automation_events_no_update before update on public.whatsapp_automation_events for each row execute function private.whatsapp_wm_append_only_guard();
create trigger trg_whatsapp_automation_events_no_delete before delete on public.whatsapp_automation_events for each row execute function private.whatsapp_wm_append_only_guard();
create trigger trg_whatsapp_automation_attribution_no_update before update on public.whatsapp_message_automation_attributions for each row execute function private.whatsapp_wm_append_only_guard();
create trigger trg_whatsapp_automation_attribution_no_delete before delete on public.whatsapp_message_automation_attributions for each row execute function private.whatsapp_wm_append_only_guard();
create trigger trg_whatsapp_flows_guard before update or delete on public.whatsapp_flows for each row execute function private.whatsapp_flow_guard();
create trigger trg_whatsapp_flow_requests_no_update before update on public.whatsapp_flow_provider_requests for each row execute function private.whatsapp_wm_append_only_guard();
create trigger trg_whatsapp_flow_requests_no_delete before delete on public.whatsapp_flow_provider_requests for each row execute function private.whatsapp_wm_append_only_guard();
create trigger trg_whatsapp_flow_events_no_update before update on public.whatsapp_flow_provider_events for each row execute function private.whatsapp_wm_append_only_guard();
create trigger trg_whatsapp_flow_events_no_delete before delete on public.whatsapp_flow_provider_events for each row execute function private.whatsapp_wm_append_only_guard();
create trigger trg_whatsapp_flow_tokens_no_update before update on public.whatsapp_flow_tokens for each row execute function private.whatsapp_wm_append_only_guard();
create trigger trg_whatsapp_flow_tokens_no_delete before delete on public.whatsapp_flow_tokens for each row execute function private.whatsapp_wm_append_only_guard();
create trigger trg_whatsapp_flow_responses_no_update before update on public.whatsapp_flow_responses for each row execute function private.whatsapp_wm_append_only_guard();
create trigger trg_whatsapp_flow_responses_no_delete before delete on public.whatsapp_flow_responses for each row execute function private.whatsapp_wm_append_only_guard();
create trigger trg_whatsapp_referral_contexts_no_update before update on public.whatsapp_referral_contexts for each row execute function private.whatsapp_wm_append_only_guard();
create trigger trg_whatsapp_referral_contexts_no_delete before delete on public.whatsapp_referral_contexts for each row execute function private.whatsapp_wm_append_only_guard();

-- 6. RLS: exact permission reads; no direct DML for staff or worker.
alter table public.whatsapp_automations enable row level security; alter table public.whatsapp_automations force row level security;
alter table public.whatsapp_automation_enrollments enable row level security; alter table public.whatsapp_automation_enrollments force row level security;
alter table public.whatsapp_automation_events enable row level security; alter table public.whatsapp_automation_events force row level security;
alter table public.whatsapp_message_automation_attributions enable row level security; alter table public.whatsapp_message_automation_attributions force row level security;
alter table public.whatsapp_flows enable row level security; alter table public.whatsapp_flows force row level security;
alter table public.whatsapp_flow_provider_requests enable row level security; alter table public.whatsapp_flow_provider_requests force row level security;
alter table public.whatsapp_flow_provider_events enable row level security; alter table public.whatsapp_flow_provider_events force row level security;
alter table public.whatsapp_flow_tokens enable row level security; alter table public.whatsapp_flow_tokens force row level security;
alter table public.whatsapp_flow_responses enable row level security; alter table public.whatsapp_flow_responses force row level security;
alter table public.whatsapp_referral_contexts enable row level security; alter table public.whatsapp_referral_contexts force row level security;

revoke all on table public.whatsapp_automations,public.whatsapp_automation_enrollments,public.whatsapp_automation_events,public.whatsapp_message_automation_attributions,
  public.whatsapp_flows,public.whatsapp_flow_provider_requests,public.whatsapp_flow_provider_events,public.whatsapp_flow_tokens,public.whatsapp_flow_responses,
  public.whatsapp_referral_contexts from public,anon,authenticated,service_role;
revoke all on sequence public.whatsapp_automation_events_id_seq,public.whatsapp_flow_provider_events_id_seq from public,anon,authenticated,service_role;

grant select on public.whatsapp_automations,public.whatsapp_automation_enrollments,public.whatsapp_automation_events,public.whatsapp_message_automation_attributions,
  public.whatsapp_flows,public.whatsapp_flow_provider_requests,public.whatsapp_flow_provider_events,public.whatsapp_flow_responses,public.whatsapp_referral_contexts to authenticated;
grant select on public.whatsapp_automations,public.whatsapp_automation_enrollments,public.whatsapp_automation_events,public.whatsapp_message_automation_attributions,
  public.whatsapp_flows,public.whatsapp_flow_provider_requests,public.whatsapp_flow_provider_events,public.whatsapp_flow_tokens,public.whatsapp_flow_responses,
  public.whatsapp_referral_contexts to service_role;

create policy whatsapp_automations_staff_read on public.whatsapp_automations for select to authenticated using (private.has_permission('whatsapp.automations.read'));
create policy whatsapp_automation_enrollments_staff_read on public.whatsapp_automation_enrollments for select to authenticated using (private.has_permission('whatsapp.automations.read'));
create policy whatsapp_automation_events_staff_read on public.whatsapp_automation_events for select to authenticated using (private.has_permission('whatsapp.automations.read'));
create policy whatsapp_automation_attribution_staff_read on public.whatsapp_message_automation_attributions for select to authenticated
  using (private.has_permission('whatsapp.automations.read') or private.has_permission('whatsapp.analytics.read'));
create policy whatsapp_flows_staff_read on public.whatsapp_flows for select to authenticated using (private.has_permission('whatsapp.flows.read'));
create policy whatsapp_flow_requests_staff_read on public.whatsapp_flow_provider_requests for select to authenticated using (private.has_permission('whatsapp.flows.read'));
create policy whatsapp_flow_events_staff_read on public.whatsapp_flow_provider_events for select to authenticated using (private.has_permission('whatsapp.flows.read'));
create policy whatsapp_flow_responses_staff_read on public.whatsapp_flow_responses for select to authenticated using (private.has_permission('whatsapp.flows.read'));
create policy whatsapp_referral_contexts_staff_read on public.whatsapp_referral_contexts for select to authenticated
  using (private.has_permission('whatsapp.analytics.read') or private.has_permission('whatsapp.automations.read'));

create policy whatsapp_automations_service_read on public.whatsapp_automations for select to service_role using (true);
create policy whatsapp_automation_enrollments_service_read on public.whatsapp_automation_enrollments for select to service_role using (true);
create policy whatsapp_automation_events_service_read on public.whatsapp_automation_events for select to service_role using (true);
create policy whatsapp_automation_attribution_service_read on public.whatsapp_message_automation_attributions for select to service_role using (true);
create policy whatsapp_flows_service_read on public.whatsapp_flows for select to service_role using (true);
create policy whatsapp_flow_requests_service_read on public.whatsapp_flow_provider_requests for select to service_role using (true);
create policy whatsapp_flow_events_service_read on public.whatsapp_flow_provider_events for select to service_role using (true);
create policy whatsapp_flow_tokens_service_read on public.whatsapp_flow_tokens for select to service_role using (true);
create policy whatsapp_flow_responses_service_read on public.whatsapp_flow_responses for select to service_role using (true);
create policy whatsapp_referral_contexts_service_read on public.whatsapp_referral_contexts for select to service_role using (true);

-- 7. Template buttons: tracked URL buttons (WM-5) and official FLOW buttons.

/* Meta FLOW buttons of a template, by button position, with the provider Flow id they open. */
create or replace function private.whatsapp_template_flow_buttons(p_components jsonb)
returns table(button_index integer,provider_flow_id text) language sql immutable set search_path='' as $$
  select (b.ordinality-1)::integer,b.value->>'flow_id'
  from jsonb_array_elements(case when jsonb_typeof(p_components)='array' then p_components else '[]'::jsonb end) c
  cross join lateral jsonb_array_elements(case when jsonb_typeof(c->'buttons')='array' then c->'buttons' else '[]'::jsonb end) with ordinality b(value,ordinality)
  where jsonb_typeof(c)='object' and upper(coalesce(c->>'type',''))='BUTTONS' and upper(coalesce(b.value->>'type',''))='FLOW';
$$;
revoke all on function private.whatsapp_template_flow_buttons(jsonb) from public,anon,authenticated;

create or replace function private.whatsapp_marketing_template_send_problem(p_components jsonb,p_parameter_format text)
returns text language plpgsql stable set search_path='' as $$
declare v_normalised jsonb;
begin
  if p_components is null or jsonb_typeof(p_components)<>'array' then return 'components_invalid'; end if;
  if exists(select 1 from private.whatsapp_template_dynamic_url_buttons(p_components) b where b.url !~ '^https://[^{}[:space:]]+\{\{1\}\}$') then
    return 'button_parameters_unsupported';
  end if;
  if exists(select 1 from private.whatsapp_template_flow_buttons(p_components) f where coalesce(f.provider_flow_id,'') !~ '^[0-9]{1,64}$') then
    return 'button_parameters_unsupported';
  end if;
  -- Tracked URL and FLOW buttons are filled per recipient; everything else keeps the WM-2 staff rules.
  select coalesce(jsonb_agg(
    case when jsonb_typeof(c.value)='object' and upper(coalesce(c.value->>'type',''))='BUTTONS' and jsonb_typeof(c.value->'buttons')='array' then
      jsonb_set(c.value,'{buttons}',coalesce((
        select jsonb_agg(
          case
            when jsonb_typeof(b.value)='object' and upper(coalesce(b.value->>'type',''))='URL' and coalesce(b.value->>'url','') ~ '^https://[^{}[:space:]]+\{\{1\}\}$'
              then jsonb_set(b.value,'{url}',to_jsonb(regexp_replace(b.value->>'url','\{\{1\}\}$','token')))
            when jsonb_typeof(b.value)='object' and upper(coalesce(b.value->>'type',''))='FLOW'
              then jsonb_build_object('type','QUICK_REPLY','text',coalesce(b.value->>'text','Flow'))
            else b.value end
          order by b.ordinality)
        from jsonb_array_elements(c.value->'buttons') with ordinality b(value,ordinality)
      ),'[]'::jsonb))
    else c.value end
    order by c.ordinality),'[]'::jsonb)
  into v_normalised
  from jsonb_array_elements(p_components) with ordinality c(value,ordinality);
  return private.whatsapp_template_staff_send_problem(v_normalised,p_parameter_format);
end;$$;
revoke all on function private.whatsapp_marketing_template_send_problem(jsonb,text) from public,anon,authenticated;

create or replace function private.whatsapp_campaign_button_bindings_problem(p_components jsonb,p_bindings jsonb)
returns text language plpgsql stable security definer set search_path='' as $$
declare b record; v_binding jsonb; v_kind text; v_flow public.whatsapp_flows%rowtype;
begin
  if p_bindings is null or jsonb_typeof(p_bindings)<>'object' or pg_column_size(p_bindings)>1024 then return 'button_bindings_invalid'; end if;
  for b in select e.key,e.value from jsonb_each(p_bindings) e loop
    if b.key !~ '^[0-9]$' or jsonb_typeof(b.value)<>'object' then return 'button_bindings_invalid'; end if;
    v_kind:=b.value->>'kind';
    if v_kind='click_destination' then
      if not exists(select 1 from private.whatsapp_template_dynamic_url_buttons(p_components) d where d.button_index=b.key::integer) then return 'button_binding_unexpected'; end if;
      if coalesce(b.value->>'destination_id','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return 'button_bindings_invalid'; end if;
      if not exists(select 1 from public.whatsapp_click_destinations d where d.id=(b.value->>'destination_id')::uuid and d.is_active) then return 'click_destination_unavailable'; end if;
    elsif v_kind='flow' then
      if not exists(select 1 from private.whatsapp_template_flow_buttons(p_components) f where f.button_index=b.key::integer) then return 'button_binding_unexpected'; end if;
      if coalesce(b.value->>'flow_id','') !~ '^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$' then return 'button_bindings_invalid'; end if;
      select * into v_flow from public.whatsapp_flows where id=(b.value->>'flow_id')::uuid;
      if not found or v_flow.provider_status<>'PUBLISHED' then return 'flow_unavailable'; end if;
      if not exists(select 1 from private.whatsapp_template_flow_buttons(p_components) f where f.button_index=b.key::integer and f.provider_flow_id=v_flow.provider_flow_id) then
        return 'flow_mismatch';
      end if;
    else
      return 'button_bindings_invalid';
    end if;
  end loop;
  for b in
    select d.button_index from private.whatsapp_template_dynamic_url_buttons(p_components) d
    union select f.button_index from private.whatsapp_template_flow_buttons(p_components) f
  loop
    v_binding:=p_bindings->(b.button_index::text);
    if v_binding is null then return 'button_binding_missing'; end if;
  end loop;
  return null;
end;$$;
revoke all on function private.whatsapp_campaign_button_bindings_problem(jsonb,jsonb) from public,anon,authenticated;

create or replace function private.whatsapp_random_token()
returns text language sql volatile set search_path='' as $$
  select translate(encode(extensions.gen_random_bytes(32),'base64'),'+/=','-_');
$$;
revoke all on function private.whatsapp_random_token() from public,anon,authenticated;

create or replace function private.whatsapp_token_hash(p_token text)
returns text language sql immutable set search_path='' as $$
  select encode(extensions.digest(convert_to(p_token,'UTF8'),'sha256'),'hex');
$$;
revoke all on function private.whatsapp_token_hash(text) from public,anon,authenticated;

create or replace function private.whatsapp_mint_click_token(
  p_destination_id uuid,p_purpose text,p_run_id uuid,p_recipient_id uuid,p_test_send_id uuid,p_enrollment_id uuid,p_button_index integer
)
returns text language plpgsql volatile security definer set search_path='' as $$
declare v_token text:=private.whatsapp_random_token();
begin
  insert into public.whatsapp_click_tokens(token_hash,destination_id,purpose,run_id,recipient_id,test_send_id,enrollment_id,button_index,expires_at)
  values(private.whatsapp_token_hash(v_token),p_destination_id,p_purpose,p_run_id,p_recipient_id,p_test_send_id,p_enrollment_id,p_button_index,clock_timestamp()+interval '90 days');
  return v_token;
end;$$;
revoke all on function private.whatsapp_mint_click_token(uuid,text,uuid,uuid,uuid,uuid,integer) from public,anon,authenticated;

create or replace function private.whatsapp_mint_flow_token(
  p_flow_id uuid,p_purpose text,p_run_id uuid,p_recipient_id uuid,p_test_send_id uuid,p_enrollment_id uuid,p_button_index integer
)
returns text language plpgsql volatile security definer set search_path='' as $$
declare v_token text:=private.whatsapp_random_token();
begin
  insert into public.whatsapp_flow_tokens(token_hash,flow_id,purpose,run_id,recipient_id,test_send_id,enrollment_id,button_index,expires_at)
  values(private.whatsapp_token_hash(v_token),p_flow_id,p_purpose,p_run_id,p_recipient_id,p_test_send_id,p_enrollment_id,p_button_index,clock_timestamp()+interval '90 days');
  return v_token;
end;$$;
revoke all on function private.whatsapp_mint_flow_token(uuid,text,uuid,uuid,uuid,uuid,integer) from public,anon,authenticated;

create or replace function private.whatsapp_mint_button_components(
  p_components jsonb,p_bindings jsonb,p_purpose text,p_run_id uuid,p_recipient_id uuid,p_test_send_id uuid,p_enrollment_id uuid
)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare b record; v_out jsonb:='[]'::jsonb; v_binding jsonb; v_token text;
begin
  for b in
    select d.button_index,'url'::text as kind from private.whatsapp_template_dynamic_url_buttons(p_components) d
    union all select f.button_index,'flow'::text from private.whatsapp_template_flow_buttons(p_components) f
    order by 1
  loop
    v_binding:=coalesce(p_bindings,'{}'::jsonb)->(b.button_index::text);
    if b.kind='url' then
      if v_binding is null or v_binding->>'kind' is distinct from 'click_destination' then raise exception 'WHATSAPP_BUTTON_BINDING_MISSING' using errcode='22023'; end if;
      v_token:=private.whatsapp_mint_click_token((v_binding->>'destination_id')::uuid,p_purpose,p_run_id,p_recipient_id,p_test_send_id,p_enrollment_id,b.button_index);
      v_out:=v_out||jsonb_build_array(jsonb_build_object('type','button','sub_type','url','index',b.button_index::text,
        'parameters',jsonb_build_array(jsonb_build_object('type','text','text',v_token))));
    else
      if v_binding is null or v_binding->>'kind' is distinct from 'flow' then raise exception 'WHATSAPP_BUTTON_BINDING_MISSING' using errcode='22023'; end if;
      v_token:=private.whatsapp_mint_flow_token((v_binding->>'flow_id')::uuid,p_purpose,p_run_id,p_recipient_id,p_test_send_id,p_enrollment_id,b.button_index);
      v_out:=v_out||jsonb_build_array(jsonb_build_object('type','button','sub_type','flow','index',b.button_index::text,
        'parameters',jsonb_build_array(jsonb_build_object('type','action','action',jsonb_build_object('flow_token',v_token)))));
    end if;
  end loop;
  return v_out;
end;$$;
revoke all on function private.whatsapp_mint_button_components(jsonb,jsonb,text,uuid,uuid,uuid,uuid) from public,anon,authenticated;

create or replace function private.whatsapp_outbound_marketing_source(p_message_id uuid)
returns table(source_kind text,run_id uuid,recipient_id uuid,campaign_version_id uuid,automation_id uuid,enrollment_id uuid)
language sql stable security definer set search_path='' as $$
  select 'campaign'::text,a.run_id,a.recipient_id,a.campaign_version_id,null::uuid,null::uuid
  from public.whatsapp_message_campaign_attributions a where a.whatsapp_message_id=p_message_id
  union all
  select 'automation'::text,null::uuid,null::uuid,a.campaign_version_id,a.automation_id,a.enrollment_id
  from public.whatsapp_message_automation_attributions a where a.whatsapp_message_id=p_message_id;
$$;
revoke all on function private.whatsapp_outbound_marketing_source(uuid) from public,anon,authenticated;

/* Rolling caps over EVERY governed marketing send: campaigns and automations, bound or in flight. */
create or replace function private.whatsapp_campaign_frequency_capped(p_contact_id uuid,p_policy public.whatsapp_marketing_send_policies,p_at timestamptz default clock_timestamp())
returns boolean language plpgsql stable security definer set search_path='' as $$
declare fr jsonb; h integer; mx integer; n integer;
begin
  for fr in select value from jsonb_array_elements(p_policy.frequency_rules) loop
    h:=(fr->>'windowHours')::integer; mx:=(fr->>'maxMessages')::integer;
    if h is null or mx is null or h<1 or mx<1 then return true; end if;
    select
      (select count(*) from public.whatsapp_message_campaign_attributions a
         join public.whatsapp_campaign_recipients r on r.id=a.recipient_id
         join public.whatsapp_messages m on m.id=a.whatsapp_message_id
        where r.contact_id=p_contact_id and m.provider_timestamp>p_at-make_interval(hours=>h) and m.provider_timestamp<=p_at)
      +
      (select count(*) from public.whatsapp_campaign_dispatch_jobs j
         join public.whatsapp_campaign_recipients r on r.id=j.recipient_id
        where r.contact_id=p_contact_id and j.state in ('claimed','needs_reconcile')
          and coalesce(j.provider_request_started_at,j.claimed_at,j.updated_at)>p_at-make_interval(hours=>h))
      +
      (select count(*) from public.whatsapp_message_automation_attributions a
         join public.whatsapp_automation_enrollments e on e.id=a.enrollment_id
         join public.whatsapp_messages m on m.id=a.whatsapp_message_id
        where e.contact_id=p_contact_id and m.provider_timestamp>p_at-make_interval(hours=>h) and m.provider_timestamp<=p_at)
      +
      (select count(*) from public.whatsapp_automation_enrollments e
        where e.contact_id=p_contact_id and e.state in ('claimed','needs_reconcile')
          and coalesce(e.provider_request_started_at,e.claimed_at,e.updated_at)>p_at-make_interval(hours=>h))
    into n;
    if n>=mx then return true; end if;
  end loop;
  return false;
exception when others then return true;
end;$$;
revoke all on function private.whatsapp_campaign_frequency_capped(uuid,public.whatsapp_marketing_send_policies,timestamptz) from public,anon,authenticated;

-- 8. Flow registry: staff decisions, provider truth from service_role only.

create or replace function private.whatsapp_normalize_flow_status(p_raw text)
returns text language sql immutable set search_path='' as $$
  select case when upper(trim(coalesce(p_raw,''))) in ('DRAFT','PUBLISHED','DEPRECATED','BLOCKED','THROTTLED') then upper(trim(p_raw)) else 'unknown' end;
$$;
revoke all on function private.whatsapp_normalize_flow_status(text) from public,anon,authenticated;

create or replace function private.whatsapp_flow_json_valid(p_flow_json jsonb)
returns boolean language sql immutable set search_path='' as $$
  select p_flow_json is not null and jsonb_typeof(p_flow_json)='object' and pg_column_size(p_flow_json)<=65536
    and jsonb_typeof(p_flow_json->'version')='string' and (p_flow_json->>'version') ~ '^[0-9]{1,2}\.[0-9]{1,2}$'
    and jsonb_typeof(p_flow_json->'screens')='array' and jsonb_array_length(p_flow_json->'screens') between 1 and 50;
$$;
revoke all on function private.whatsapp_flow_json_valid(jsonb) from public,anon,authenticated;

/* Flow response key -> CRM-facing field. Keys are Flow payload names; targets are an allowlist. */
create or replace function private.whatsapp_flow_mappings_valid(p_mappings jsonb)
returns boolean language plpgsql stable set search_path='' as $$
declare m record; n integer:=0;
begin
  if p_mappings is null or jsonb_typeof(p_mappings)<>'object' or pg_column_size(p_mappings)>2048 then return false; end if;
  for m in select e.key,e.value from jsonb_each(p_mappings) e loop
    n:=n+1;
    if n>30 or m.key !~ '^[a-z][a-z0-9_]{0,63}$' or m.key='flow_token' or jsonb_typeof(m.value)<>'string' then return false; end if;
    if (m.value#>>'{}') not in ('service_interest','property_type','budget','locality','timeline','consultation_preference','design_preference','feedback_score','feedback_text') then
      return false;
    end if;
  end loop;
  return true;
end;$$;
revoke all on function private.whatsapp_flow_mappings_valid(jsonb) from public,anon,authenticated;

create or replace function public.save_whatsapp_flow_draft(
  p_name text,p_categories text[],p_purpose text,p_field_mappings jsonb,
  p_flow_json jsonb default null,p_flow_id uuid default null,p_waba_id text default null
)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_flow public.whatsapp_flows%rowtype; v_account uuid; v_hash text; v_id uuid;
begin
  if v_actor is null or not private.has_permission('whatsapp.flows.manage') then raise exception 'WHATSAPP_FLOWS_DENIED' using errcode='42501'; end if;
  if length(trim(coalesce(p_name,''))) not between 1 and 200
     or p_categories is null or cardinality(p_categories) not between 1 and 8
     or not (p_categories <@ array['SIGN_UP','SIGN_IN','APPOINTMENT_BOOKING','LEAD_GENERATION','CONTACT_US','CUSTOMER_SUPPORT','SURVEY','OTHER']::text[])
     or p_purpose is null or p_purpose not in ('lead_qualification','consultation_request','feedback','other')
     or not private.whatsapp_flow_mappings_valid(coalesce(p_field_mappings,'{}'::jsonb)) then
    raise exception 'WHATSAPP_FLOW_VALIDATION' using errcode='22023';
  end if;
  if p_flow_json is not null and not private.whatsapp_flow_json_valid(p_flow_json) then
    raise exception 'WHATSAPP_FLOW_JSON_INVALID' using errcode='22023';
  end if;
  v_hash:=case when p_flow_json is null then null else private.marketing_sha256(p_flow_json::text) end;

  if p_flow_id is null then
    if p_waba_id is not null then
      select id into v_account from public.whatsapp_business_accounts where waba_id=p_waba_id and status='active';
    else
      select id into v_account from public.whatsapp_business_accounts where status='active' and (select count(*) from public.whatsapp_business_accounts where status='active')=1;
    end if;
    if v_account is null then raise exception 'WHATSAPP_BUSINESS_ACCOUNT_NOT_REGISTERED' using errcode='22023'; end if;
    insert into public.whatsapp_flows(business_account_id,name,categories,purpose,field_mappings,flow_json,flow_json_hash,created_by,updated_by)
    values(v_account,trim(p_name),p_categories,p_purpose,coalesce(p_field_mappings,'{}'::jsonb),p_flow_json,v_hash,v_actor,v_actor)
    returning id into v_id;
  else
    select * into v_flow from public.whatsapp_flows where id=p_flow_id for update;
    if not found then raise exception 'WHATSAPP_FLOW_NOT_FOUND' using errcode='P0002'; end if;
    if v_flow.provider_status not in ('local_draft','DRAFT') then raise exception 'WHATSAPP_FLOW_NOT_EDITABLE' using errcode='22023'; end if;
    -- A Flow that exists at Meta keeps its name and categories; only its JSON and local mapping change.
    if v_flow.provider_flow_id is not null and (trim(p_name)<>v_flow.name or p_categories<>v_flow.categories) then
      raise exception 'WHATSAPP_FLOW_NOT_EDITABLE' using errcode='22023';
    end if;
    update public.whatsapp_flows set name=trim(p_name),categories=p_categories,purpose=p_purpose,field_mappings=coalesce(p_field_mappings,'{}'::jsonb),
      flow_json=p_flow_json,flow_json_hash=v_hash,updated_by=v_actor
    where id=v_flow.id returning id into v_id;
  end if;
  return jsonb_build_object('flow_id',v_id,'flow_json_hash',v_hash);
end;$$;
revoke all on function public.save_whatsapp_flow_draft(text,text[],text,jsonb,jsonb,uuid,text) from public,anon;
grant execute on function public.save_whatsapp_flow_draft(text,text[],text,jsonb,jsonb,uuid,text) to authenticated;

create or replace function public.list_whatsapp_flows()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.has_permission('whatsapp.flows.read') then raise exception 'WHATSAPP_FLOWS_DENIED' using errcode='42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'id',f.id,'name',f.name,'categories',to_jsonb(f.categories),'purpose',f.purpose,'provider_status',f.provider_status,
      'provider_status_raw',f.provider_status_raw,'provider_flow_id',f.provider_flow_id,'has_json',f.flow_json is not null,
      'validation_error_count',jsonb_array_length(f.validation_errors),'mapped_field_count',(select count(*) from jsonb_object_keys(f.field_mappings)),
      'provider_synced_at',f.provider_synced_at,'updated_at',f.updated_at,
      'response_count',(select count(*) from public.whatsapp_flow_responses r where r.flow_id=f.id),
      'last_response_at',(select max(r.received_at) from public.whatsapp_flow_responses r where r.flow_id=f.id)
    ) order by f.updated_at desc,f.id)
    from public.whatsapp_flows f
  ),'[]'::jsonb);
end;$$;
revoke all on function public.list_whatsapp_flows() from public,anon;
grant execute on function public.list_whatsapp_flows() to authenticated;

create or replace function public.get_whatsapp_flow(p_flow_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare f public.whatsapp_flows%rowtype;
begin
  if auth.uid() is null or not private.has_permission('whatsapp.flows.read') then raise exception 'WHATSAPP_FLOWS_DENIED' using errcode='42501'; end if;
  select * into f from public.whatsapp_flows where id=p_flow_id;
  if not found then raise exception 'WHATSAPP_FLOW_NOT_FOUND' using errcode='P0002'; end if;
  return jsonb_build_object(
    'id',f.id,'name',f.name,'categories',to_jsonb(f.categories),'purpose',f.purpose,'field_mappings',f.field_mappings,
    'flow_json',f.flow_json,'flow_json_hash',f.flow_json_hash,'provider_flow_id',f.provider_flow_id,'provider_status',f.provider_status,
    'provider_status_raw',f.provider_status_raw,'validation_errors',f.validation_errors,'provider_synced_at',f.provider_synced_at,'updated_at',f.updated_at,
    'unmatched_response_count',(select count(*) from public.whatsapp_flow_responses r where r.flow_id is null),
    'requests',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',q.id,'action',q.action,'created_at',q.created_at,'requested_by_me',q.requested_by=auth.uid(),
        'outcome',e.outcome,'provider_status',e.provider_status,'error_code',e.error_code,'occurred_at',e.occurred_at
      ) order by q.created_at desc)
      from (select * from public.whatsapp_flow_provider_requests where flow_id=f.id order by created_at desc limit 20) q
      left join public.whatsapp_flow_provider_events e on e.request_id=q.id
    ),'[]'::jsonb),
    'responses',coalesce((
      select jsonb_agg(jsonb_build_object(
        'id',r.id,'received_at',r.received_at,'response_fields',r.response_fields,'unmapped_key_count',r.unmapped_key_count,
        'crm_apply_outcome',r.crm_apply_outcome,'crm_applied_fields',to_jsonb(r.crm_applied_fields),'lead_linked',r.lead_id is not null
      ) order by r.received_at desc)
      from (select * from public.whatsapp_flow_responses where flow_id=f.id order by received_at desc limit 25) r
    ),'[]'::jsonb)
  );
end;$$;
revoke all on function public.get_whatsapp_flow(uuid) from public,anon;
grant execute on function public.get_whatsapp_flow(uuid) to authenticated;

/*
 * Records a human decision to call the official Flows API. Returns only what
 * the server needs to make that one call. The call's answer comes back
 * through record_whatsapp_flow_provider_outcome (service_role).
 */
create or replace function public.request_whatsapp_flow_provider_action(p_flow_id uuid,p_action text,p_idempotency_key uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); f public.whatsapp_flows%rowtype; v_existing public.whatsapp_flow_provider_requests%rowtype;
  v_hash text; v_request uuid;
begin
  if v_actor is null or not private.has_permission('whatsapp.flows.manage') then raise exception 'WHATSAPP_FLOWS_DENIED' using errcode='42501'; end if;
  if p_idempotency_key is null or p_action is null or p_action not in ('create','update_json','publish','deprecate','sync') then
    raise exception 'WHATSAPP_FLOW_VALIDATION' using errcode='22023';
  end if;
  select * into f from public.whatsapp_flows where id=p_flow_id for update;
  if not found then raise exception 'WHATSAPP_FLOW_NOT_FOUND' using errcode='P0002'; end if;
  v_hash:=private.marketing_sha256(jsonb_build_object('flow_id',f.id,'action',p_action,'flow_json_hash',f.flow_json_hash)::text);

  select * into v_existing from public.whatsapp_flow_provider_requests where requested_by=v_actor and idempotency_key=p_idempotency_key;
  if found then
    if v_existing.request_hash<>v_hash then raise exception 'WHATSAPP_FLOW_IDEMPOTENCY_CONFLICT' using errcode='23505'; end if;
    v_request:=v_existing.id;
    return jsonb_build_object('request_id',v_request,'reused',true,'action',p_action,
      'resolved',exists(select 1 from public.whatsapp_flow_provider_events e where e.request_id=v_request),
      'flow',jsonb_build_object('provider_flow_id',f.provider_flow_id,'name',f.name,'categories',to_jsonb(f.categories),'flow_json',f.flow_json));
  end if;

  -- An unanswered mutation may still land at Meta. Only a sync may run beside it, for 15 minutes.
  if p_action<>'sync' and exists(
    select 1 from public.whatsapp_flow_provider_requests q
    where q.flow_id=f.id and q.action<>'sync' and q.created_at>clock_timestamp()-interval '15 minutes'
      and not exists(select 1 from public.whatsapp_flow_provider_events e where e.request_id=q.id)
  ) then
    raise exception 'WHATSAPP_FLOW_REQUEST_UNRESOLVED' using errcode='22023';
  end if;

  if p_action='create' and (f.provider_flow_id is not null or f.flow_json is null) then raise exception 'WHATSAPP_FLOW_ACTION_NOT_ALLOWED' using errcode='22023'; end if;
  if p_action='update_json' and (f.provider_flow_id is null or f.provider_status<>'DRAFT' or f.flow_json is null) then raise exception 'WHATSAPP_FLOW_ACTION_NOT_ALLOWED' using errcode='22023'; end if;
  if p_action='publish' and (
       f.provider_flow_id is null or f.provider_status<>'DRAFT' or jsonb_array_length(f.validation_errors)>0 or f.flow_json_hash is null
    or not exists(
      select 1 from public.whatsapp_flow_provider_requests q join public.whatsapp_flow_provider_events e on e.request_id=q.id
      where q.flow_id=f.id and q.action in ('create','update_json') and e.outcome='accepted' and q.flow_json_hash=f.flow_json_hash)
  ) then
    raise exception 'WHATSAPP_FLOW_ACTION_NOT_ALLOWED' using errcode='22023';
  end if;
  if p_action='deprecate' and (f.provider_flow_id is null or f.provider_status<>'PUBLISHED') then raise exception 'WHATSAPP_FLOW_ACTION_NOT_ALLOWED' using errcode='22023'; end if;
  if p_action='sync' and f.provider_flow_id is null then raise exception 'WHATSAPP_FLOW_ACTION_NOT_ALLOWED' using errcode='22023'; end if;

  insert into public.whatsapp_flow_provider_requests(flow_id,action,requested_by,idempotency_key,request_hash,flow_json_hash)
  values(f.id,p_action,v_actor,p_idempotency_key,v_hash,f.flow_json_hash) returning id into v_request;
  return jsonb_build_object('request_id',v_request,'reused',false,'action',p_action,'resolved',false,
    'flow',jsonb_build_object('provider_flow_id',f.provider_flow_id,'name',f.name,'categories',to_jsonb(f.categories),'flow_json',f.flow_json));
end;$$;
revoke all on function public.request_whatsapp_flow_provider_action(uuid,text,uuid) from public,anon;
grant execute on function public.request_whatsapp_flow_provider_action(uuid,text,uuid) to authenticated;

create or replace function public.record_whatsapp_flow_provider_outcome(
  p_request_id uuid,p_outcome text,p_provider_flow_id text default null,p_provider_status_raw text default null,
  p_error_code text default null,p_validation_errors jsonb default null
)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare q public.whatsapp_flow_provider_requests%rowtype; f public.whatsapp_flows%rowtype; v_status text; v_raw text; v_errors jsonb;
begin
  perform private.whatsapp_campaign_require_service_role();
  if p_outcome is null or p_outcome not in ('accepted','failed','ambiguous','observed') then raise exception 'WHATSAPP_FLOW_OUTCOME_INVALID' using errcode='22023'; end if;
  if p_error_code is not null and length(p_error_code) not between 1 and 128 then raise exception 'WHATSAPP_FLOW_OUTCOME_INVALID' using errcode='22023'; end if;
  if p_validation_errors is not null and (jsonb_typeof(p_validation_errors)<>'array' or pg_column_size(p_validation_errors)>4096) then
    raise exception 'WHATSAPP_FLOW_OUTCOME_INVALID' using errcode='22023';
  end if;
  select * into q from public.whatsapp_flow_provider_requests where id=p_request_id;
  if not found then raise exception 'WHATSAPP_FLOW_REQUEST_NOT_FOUND' using errcode='P0002'; end if;
  if exists(select 1 from public.whatsapp_flow_provider_events e where e.request_id=q.id) then
    return jsonb_build_object('outcome','already_recorded');
  end if;
  select * into f from public.whatsapp_flows where id=q.flow_id for update;
  v_raw:=nullif(left(trim(coalesce(p_provider_status_raw,'')),64),'');
  v_status:=case when v_raw is null then null else private.whatsapp_normalize_flow_status(v_raw) end;
  v_errors:=p_validation_errors;

  perform set_config('onedecore.whatsapp_flow_provider_write','1',true);
  if p_outcome in ('accepted','observed') then
    if q.action='create' then
      if p_provider_flow_id is null or p_provider_flow_id !~ '^[0-9]{1,64}$' then raise exception 'WHATSAPP_FLOW_PROVIDER_ID_INVALID' using errcode='22023'; end if;
      update public.whatsapp_flows set provider_flow_id=p_provider_flow_id,provider_status=coalesce(v_status,'DRAFT'),provider_status_raw=coalesce(v_raw,'DRAFT'),
        validation_errors=coalesce(v_errors,'[]'::jsonb),provider_synced_at=clock_timestamp() where id=f.id;
    elsif f.provider_flow_id is not null then
      update public.whatsapp_flows set provider_status=coalesce(v_status,provider_status),provider_status_raw=coalesce(v_raw,provider_status_raw),
        validation_errors=coalesce(v_errors,validation_errors),provider_synced_at=clock_timestamp() where id=f.id;
    end if;
  elsif p_outcome='failed' and q.action='update_json' and v_errors is not null then
    update public.whatsapp_flows set validation_errors=v_errors,provider_synced_at=clock_timestamp() where id=f.id;
  end if;
  perform set_config('onedecore.whatsapp_flow_provider_write','0',true);

  insert into public.whatsapp_flow_provider_events(flow_id,request_id,outcome,provider_status,provider_status_raw,error_code,details)
  values(f.id,q.id,p_outcome,v_status,v_raw,p_error_code,jsonb_build_object('action',q.action,'validation_error_count',coalesce(jsonb_array_length(v_errors),0)));
  return jsonb_build_object('outcome',p_outcome,'provider_status',(select provider_status from public.whatsapp_flows where id=f.id));
end;$$;
revoke all on function public.record_whatsapp_flow_provider_outcome(uuid,text,text,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.record_whatsapp_flow_provider_outcome(uuid,text,text,text,text,jsonb) to service_role;

-- 9. Inbound evidence: reply attribution, Flow responses, CTWA referral context.

create or replace function private.whatsapp_flow_scalar(p_value jsonb)
returns text language sql immutable set search_path='' as $$
  select case jsonb_typeof(p_value)
    when 'string' then nullif(left(trim(p_value#>>'{}'),200),'')
    when 'number' then left(p_value#>>'{}',32)
    when 'boolean' then p_value#>>'{}'
    when 'array' then nullif(left((select string_agg(left(e#>>'{}',60),', ') from jsonb_array_elements(p_value) e where jsonb_typeof(e) in ('string','number')),200),'')
    else null end;
$$;
revoke all on function private.whatsapp_flow_scalar(jsonb) from public,anon,authenticated;

/*
 * A completed Flow (interactive nfm_reply). Unmatched tokens keep no answers,
 * only a key count. Matched answers are reduced to the Flow's mapping; the
 * live lead gains only EMPTY locality / budget comfort values that already
 * satisfy the CRM constraints. Nothing is overwritten.
 */
create or replace function private.whatsapp_capture_flow_response(p_message_id uuid)
returns text language plpgsql volatile security definer set search_path='' as $$
declare m public.whatsapp_messages%rowtype; c public.whatsapp_conversations%rowtype; v_json text; v_parsed jsonb; v_token public.whatsapp_flow_tokens%rowtype;
  f public.whatsapp_flows%rowtype; v_fields jsonb:='{}'::jsonb; v_unmapped integer:=0; v_applied text[]:='{}'::text[]; v_outcome text;
  l public.leads%rowtype; v_lead_id uuid; v_value text; mp record;
begin
  select * into m from public.whatsapp_messages where id=p_message_id and direction='inbound';
  if not found or m.provider_message_type<>'interactive' or m.content->>'type' is distinct from 'nfm_reply' then return 'not_flow'; end if;
  if exists(select 1 from public.whatsapp_flow_responses r where r.message_id=m.id) then return 'already_recorded'; end if;
  select * into c from public.whatsapp_conversations where id=m.conversation_id;
  v_json:=m.content->'nfm_reply'->>'response_json';
  if v_json is not null and length(v_json)<=8000 then
    begin v_parsed:=v_json::jsonb; exception when others then v_parsed:=null; end;
  end if;
  if v_parsed is not null and jsonb_typeof(v_parsed)<>'object' then v_parsed:=null; end if;

  if v_parsed is not null and coalesce(v_parsed->>'flow_token','') ~ '^[A-Za-z0-9_-]{43}$' then
    select * into v_token from public.whatsapp_flow_tokens where token_hash=private.whatsapp_token_hash(v_parsed->>'flow_token') and expires_at>m.provider_timestamp;
    if found then select * into f from public.whatsapp_flows where id=v_token.flow_id; end if;
  end if;

  if f.id is null then
    v_unmapped:=coalesce((select count(*) from jsonb_object_keys(coalesce(v_parsed,'{}'::jsonb)) k where k<>'flow_token'),0);
    v_outcome:='unmatched_flow';
  else
    for mp in select e.key,e.value#>>'{}' as target from jsonb_each(f.field_mappings) e loop
      v_value:=private.whatsapp_flow_scalar(v_parsed->mp.key);
      if v_value is not null then v_fields:=v_fields||jsonb_build_object(mp.target,v_value); end if;
    end loop;
    v_unmapped:=coalesce((select count(*) from jsonb_object_keys(v_parsed) k where k<>'flow_token' and not (f.field_mappings ? k)),0);
    v_lead_id:=c.lead_id;
    if v_token.enrollment_id is not null then
      select en.lead_id into v_lead_id from public.whatsapp_automation_enrollments en where en.id=v_token.enrollment_id and en.contact_id=c.contact_id;
    end if;
    select * into l from public.leads where id=v_lead_id and deleted_at is null for update;
    if not found then
      v_outcome:='no_live_lead';
    else
      if l.locality is null and v_fields ? 'locality' then
        update public.leads set locality=left(v_fields->>'locality',120) where id=l.id;
        v_applied:=v_applied||'locality'::text;
      end if;
      if l.budget_comfort_code is null and (v_fields->>'budget') in ('under-3l','3-6l','6-12l','12-20l','20-30l','30l-plus') then
        update public.leads set budget_comfort_code=v_fields->>'budget' where id=l.id;
        v_applied:=v_applied||'budget_comfort_code'::text;
      end if;
      v_outcome:=case when cardinality(v_applied)>0 then 'applied' else 'nothing_to_apply' end;
    end if;
  end if;

  insert into public.whatsapp_flow_responses(message_id,conversation_id,contact_id,lead_id,flow_id,flow_token_id,response_fields,unmapped_key_count,crm_applied_fields,crm_apply_outcome,received_at)
  values(m.id,m.conversation_id,c.contact_id,case when l.id is not null then l.id else null end,f.id,v_token.id,v_fields,v_unmapped,v_applied,v_outcome,m.provider_timestamp)
  on conflict (message_id) do nothing;
  return v_outcome;
end;$$;
revoke all on function private.whatsapp_capture_flow_response(uuid) from public,anon,authenticated;

create or replace function public.record_whatsapp_inbound_evidence(p_message_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
  perform private.whatsapp_campaign_require_service_role();
  if p_message_id is null then raise exception 'WHATSAPP_MESSAGE_ID_REQUIRED' using errcode='22023'; end if;
  return jsonb_build_object(
    'reply',private.whatsapp_attribute_inbound_reply(p_message_id),
    'flow_response',private.whatsapp_capture_flow_response(p_message_id)
  );
end;$$;
revoke all on function public.record_whatsapp_inbound_evidence(uuid) from public,anon,authenticated;
grant execute on function public.record_whatsapp_inbound_evidence(uuid) to service_role;

/*
 * CTWA referral as sent by Meta beside the inbound message, reduced to
 * attribution evidence. The source URL is kept as host + SHA-256 only; Meta CDN
 * media URLs are never accepted; the click id is kept for official
 * conversion reporting.
 */
create or replace function public.record_whatsapp_referral_context(p_message_id uuid,p_referral jsonb)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare m public.whatsapp_messages%rowtype; c public.whatsapp_conversations%rowtype; v_url text; v_host text; v_id uuid;
  v_source_id text; v_clid text; v_type text; v_media text;
begin
  perform private.whatsapp_campaign_require_service_role();
  if p_referral is null or jsonb_typeof(p_referral)<>'object' or pg_column_size(p_referral)>4096 then raise exception 'WHATSAPP_REFERRAL_INVALID' using errcode='22023'; end if;
  select * into m from public.whatsapp_messages where id=p_message_id and direction='inbound';
  if not found then return jsonb_build_object('outcome','not_applicable'); end if;
  if exists(select 1 from public.whatsapp_referral_contexts r where r.message_id=m.id) then return jsonb_build_object('outcome','already_recorded'); end if;
  select * into c from public.whatsapp_conversations where id=m.conversation_id;

  v_url:=case when jsonb_typeof(p_referral->'source_url')='string' then left(trim(p_referral->>'source_url'),2048) end;
  v_host:=lower(substring(v_url from '^https?://([^/?#:@]+)'));
  if v_host is not null and (length(v_host) not between 1 and 255 or v_host !~ '^[a-z0-9.-]+$') then v_host:=null; end if;
  v_type:=case lower(coalesce(p_referral->>'source_type','')) when 'ad' then 'ad' when 'post' then 'post' else 'unknown' end;
  v_source_id:=case when length(coalesce(p_referral->>'source_id','')) between 1 and 128 and coalesce(p_referral->>'source_id','') ~ '^[A-Za-z0-9_.:-]+$' then p_referral->>'source_id' end;
  v_clid:=case when length(coalesce(p_referral->>'ctwa_clid','')) between 1 and 512 and (p_referral->>'ctwa_clid') ~ '^[A-Za-z0-9_.-]+$' then p_referral->>'ctwa_clid' end;
  v_media:=case lower(coalesce(p_referral->>'media_type','')) when 'image' then 'image' when 'video' then 'video' when '' then null else 'unknown' end;

  insert into public.whatsapp_referral_contexts(message_id,conversation_id,contact_id,lead_id,source_type,source_id,source_url_host,source_url_hash,headline,body_excerpt,media_type,ctwa_clid)
  values(m.id,m.conversation_id,c.contact_id,c.lead_id,v_type,v_source_id,v_host,
         case when v_url is null or v_url='' then null else private.marketing_sha256(v_url) end,
         nullif(left(trim(coalesce(p_referral->>'headline','')),200),''),nullif(left(trim(coalesce(p_referral->>'body','')),300),''),v_media,v_clid)
  on conflict (message_id) do nothing
  returning id into v_id;
  return jsonb_build_object('outcome',case when v_id is null then 'already_recorded' else 'recorded' end,'referral_context_id',v_id);
end;$$;
revoke all on function public.record_whatsapp_referral_context(uuid,jsonb) from public,anon,authenticated;
grant execute on function public.record_whatsapp_referral_context(uuid,jsonb) to service_role;

-- 10. Automations: staff definitions and governed status changes.

create or replace function private.whatsapp_automation_append_event(
  p_automation_id uuid,p_enrollment_id uuid,p_event_type text,p_from_state text,p_to_state text,p_actor_type text,p_actor_id uuid,p_details jsonb default '{}'::jsonb
)
returns void language sql volatile security definer set search_path='' as $$
  insert into public.whatsapp_automation_events(automation_id,enrollment_id,event_type,from_state,to_state,actor_type,actor_id,details)
  values(p_automation_id,p_enrollment_id,left(p_event_type,64),p_from_state,p_to_state,p_actor_type,p_actor_id,coalesce(p_details,'{}'::jsonb));
$$;
revoke all on function private.whatsapp_automation_append_event(uuid,uuid,text,text,text,text,uuid,jsonb) from public,anon,authenticated;

create or replace function private.whatsapp_automation_trigger_config_problem(p_trigger_type text,p_config jsonb)
returns text language plpgsql stable security definer set search_path='' as $$
declare k text;
begin
  if p_config is null or jsonb_typeof(p_config)<>'object' or pg_column_size(p_config)>1024 then return 'trigger_config_invalid'; end if;
  for k in select jsonb_object_keys(p_config) loop
    if not ((p_trigger_type='lead_stage_changed' and k='to_stage') or (p_trigger_type='campaign_reply' and k='campaign_version_id')
         or (p_trigger_type='flow_completed' and k='flow_id') or (p_trigger_type='ctwa_referral' and k='source_id')) then
      return 'trigger_config_unexpected_key';
    end if;
  end loop;
  if p_trigger_type='lead_stage_changed' and coalesce(p_config->>'to_stage','') not in ('assigned','contacted','qualified','consultation_scheduled','proposal_sent','negotiation','closed_won','closed_lost','on_hold') then
    return 'trigger_stage_invalid';
  end if;
  if p_trigger_type='campaign_reply' and p_config ? 'campaign_version_id'
     and not exists(select 1 from public.campaign_versions v where v.id::text=p_config->>'campaign_version_id' and v.intended_channels=array['whatsapp']::text[]) then
    return 'trigger_campaign_invalid';
  end if;
  if p_trigger_type='flow_completed' and not exists(select 1 from public.whatsapp_flows f where f.id::text=coalesce(p_config->>'flow_id','')) then
    return 'trigger_flow_invalid';
  end if;
  if p_trigger_type='ctwa_referral' and p_config ? 'source_id' and coalesce(p_config->>'source_id','') !~ '^[A-Za-z0-9_.:-]{1,128}$' then
    return 'trigger_source_invalid';
  end if;
  return null;
end;$$;
revoke all on function private.whatsapp_automation_trigger_config_problem(text,jsonb) from public,anon,authenticated;

/* Why the automation's governed send could not start now, or null. Shared by activation and claim. */
create or replace function private.whatsapp_automation_send_problem(p_campaign_version_id uuid)
returns text language plpgsql stable security definer set search_path='' as $$
declare v public.campaign_versions%rowtype; s public.whatsapp_campaign_specs%rowtype; snap public.whatsapp_template_snapshots%rowtype; v_problem text;
begin
  select * into v from public.campaign_versions where id=p_campaign_version_id;
  if not found or v.intended_channels is distinct from array['whatsapp']::text[] or v.targeting_mode<>'direct_or_custom' then return 'version_not_whatsapp_only'; end if;
  if v.status<>'approved' or not exists(select 1 from public.campaign_approvals a where a.campaign_version_id=v.id and a.decision='approved') then return 'version_not_approved'; end if;
  select * into s from public.whatsapp_campaign_specs where campaign_version_id=v.id;
  if not found or s.state<>'frozen' then return 'spec_not_frozen'; end if;
  v_problem:=private.whatsapp_campaign_template_problem(s.template_snapshot_id,null);
  if v_problem is not null then return case when v_problem='template_category_not_marketing' then v_problem else 'template_not_approved' end; end if;
  select * into snap from public.whatsapp_template_snapshots where id=s.template_snapshot_id;
  return private.whatsapp_campaign_button_bindings_problem(snap.components,s.button_bindings);
end;$$;
revoke all on function private.whatsapp_automation_send_problem(uuid) from public,anon,authenticated;

create or replace function private.whatsapp_automation_json(a public.whatsapp_automations)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'id',a.id,'name',a.name,'description',a.description,'trigger_type',a.trigger_type,'trigger_config',a.trigger_config,
    'campaign_version_id',a.campaign_version_id,'campaign_name',(select c.name from public.campaign_versions v join public.campaigns c on c.id=v.campaign_id where v.id=a.campaign_version_id),
    'version_number',(select v.version_number from public.campaign_versions v where v.id=a.campaign_version_id),
    'template_name',(select snap.name from public.whatsapp_campaign_specs s join public.whatsapp_template_snapshots snap on snap.id=s.template_snapshot_id where s.campaign_version_id=a.campaign_version_id),
    'delay_minutes',a.delay_minutes,'stop_on_lead_statuses',to_jsonb(a.stop_on_lead_statuses),'stop_on_reply',a.stop_on_reply,
    'status',a.status,'lock_version',a.lock_version,'activated_at',a.activated_at,'activated_by_me',a.activated_by=auth.uid(),
    'created_by_me',a.created_by=auth.uid(),'updated_at',a.updated_at,
    'enrollment_states',coalesce((select jsonb_object_agg(x.state,x.n) from (
      select e.state,count(*) n from public.whatsapp_automation_enrollments e where e.automation_id=a.id group by e.state) x),'{}'::jsonb)
  );
$$;
revoke all on function private.whatsapp_automation_json(public.whatsapp_automations) from public,anon,authenticated;

create or replace function public.list_whatsapp_automations()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.has_permission('whatsapp.automations.read') then raise exception 'WHATSAPP_AUTOMATIONS_DENIED' using errcode='42501'; end if;
  return coalesce((select jsonb_agg(private.whatsapp_automation_json(a) order by (a.status='archived'),a.updated_at desc,a.id) from public.whatsapp_automations a),'[]'::jsonb);
end;$$;
revoke all on function public.list_whatsapp_automations() from public,anon;
grant execute on function public.list_whatsapp_automations() to authenticated;

create or replace function public.get_whatsapp_automation(p_automation_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare a public.whatsapp_automations%rowtype;
begin
  if auth.uid() is null or not private.has_permission('whatsapp.automations.read') then raise exception 'WHATSAPP_AUTOMATIONS_DENIED' using errcode='42501'; end if;
  select * into a from public.whatsapp_automations where id=p_automation_id;
  if not found then raise exception 'WHATSAPP_AUTOMATION_NOT_FOUND' using errcode='P0002'; end if;
  return private.whatsapp_automation_json(a)||jsonb_build_object(
    'send_problem',private.whatsapp_automation_send_problem(a.campaign_version_id),
    'operator_denial',private.whatsapp_campaign_operator_denial(auth.uid(),a.campaign_version_id),
    'reasons',coalesce((select jsonb_object_agg(x.reason_code,x.n) from (
      select e.reason_code,count(*) n from public.whatsapp_automation_enrollments e where e.automation_id=a.id and e.reason_code is not null group by e.reason_code) x),'{}'::jsonb),
    'next_not_before',(select min(e.not_before) from public.whatsapp_automation_enrollments e where e.automation_id=a.id and e.state='pending'),
    'reconcile_enrollment_ids',case when private.has_role('super_admin') then
      coalesce((select jsonb_agg(e.id order by e.updated_at) from public.whatsapp_automation_enrollments e where e.automation_id=a.id and e.state='needs_reconcile'),'[]'::jsonb)
      else '[]'::jsonb end,
    'events',coalesce((select jsonb_agg(jsonb_build_object('event_type',ev.event_type,'from_state',ev.from_state,'to_state',ev.to_state,
        'actor_type',ev.actor_type,'reason',ev.details->>'reason','occurred_at',ev.occurred_at) order by ev.occurred_at desc,ev.id desc)
      from (select * from public.whatsapp_automation_events where automation_id=a.id order by occurred_at desc,id desc limit 30) ev),'[]'::jsonb)
  );
end;$$;
revoke all on function public.get_whatsapp_automation(uuid) from public,anon;
grant execute on function public.get_whatsapp_automation(uuid) to authenticated;

create or replace function public.save_whatsapp_automation(
  p_name text,p_trigger_type text,p_trigger_config jsonb,p_campaign_version_id uuid,p_delay_minutes integer,
  p_stop_on_lead_statuses text[],p_stop_on_reply boolean,p_description text default null,p_automation_id uuid default null
)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); v_version public.campaign_versions%rowtype; v_problem text; v_existing public.whatsapp_automations%rowtype; v_id uuid;
begin
  if v_actor is null or not private.has_permission('whatsapp.automations.manage') then raise exception 'WHATSAPP_AUTOMATIONS_DENIED' using errcode='42501'; end if;
  if length(trim(coalesce(p_name,''))) not between 2 and 120 or (p_description is not null and length(p_description)>500)
     or p_trigger_type is null or p_trigger_type not in ('lead_created','lead_stage_changed','campaign_reply','flow_completed','ctwa_referral')
     or p_delay_minutes is null or p_delay_minutes not between 0 and 43200
     or p_stop_on_lead_statuses is null or not (p_stop_on_lead_statuses <@ array['closed_won','closed_lost','on_hold']::text[]) then
    raise exception 'WHATSAPP_AUTOMATION_VALIDATION' using errcode='22023';
  end if;
  v_problem:=private.whatsapp_automation_trigger_config_problem(p_trigger_type,coalesce(p_trigger_config,'{}'::jsonb));
  if v_problem is not null then raise exception 'WHATSAPP_AUTOMATION_INVALID: %',v_problem using errcode='22023'; end if;
  select * into v_version from public.campaign_versions where id=p_campaign_version_id;
  -- An unseen version and a missing one answer the same.
  if not found or v_version.intended_channels is distinct from array['whatsapp']::text[] or not private.whatsapp_campaign_version_visible(v_version.status) then
    raise exception 'WHATSAPP_CAMPAIGN_NOT_FOUND' using errcode='P0002';
  end if;
  if v_version.status<>'approved' then raise exception 'WHATSAPP_AUTOMATION_INVALID: version_not_approved' using errcode='22023'; end if;

  if p_automation_id is null then
    insert into public.whatsapp_automations(name,description,trigger_type,trigger_config,campaign_version_id,delay_minutes,stop_on_lead_statuses,stop_on_reply,created_by,updated_by)
    values(trim(p_name),nullif(trim(coalesce(p_description,'')),''),p_trigger_type,coalesce(p_trigger_config,'{}'::jsonb),v_version.id,p_delay_minutes,p_stop_on_lead_statuses,coalesce(p_stop_on_reply,true),v_actor,v_actor)
    returning id into v_id;
    perform private.whatsapp_automation_append_event(v_id,null,'automation_drafted',null,'draft','staff',v_actor,'{}'::jsonb);
  else
    select * into v_existing from public.whatsapp_automations where id=p_automation_id for update;
    if not found then raise exception 'WHATSAPP_AUTOMATION_NOT_FOUND' using errcode='P0002'; end if;
    if v_existing.status<>'draft' then raise exception 'WHATSAPP_AUTOMATION_NOT_DRAFT' using errcode='22023'; end if;
    update public.whatsapp_automations set name=trim(p_name),description=nullif(trim(coalesce(p_description,'')),''),trigger_type=p_trigger_type,
      trigger_config=coalesce(p_trigger_config,'{}'::jsonb),campaign_version_id=v_version.id,delay_minutes=p_delay_minutes,
      stop_on_lead_statuses=p_stop_on_lead_statuses,stop_on_reply=coalesce(p_stop_on_reply,true),updated_by=v_actor,lock_version=lock_version+1
    where id=v_existing.id returning id into v_id;
  end if;
  return jsonb_build_object('automation_id',v_id,'status','draft');
end;$$;
revoke all on function public.save_whatsapp_automation(text,text,jsonb,uuid,integer,text[],boolean,text,uuid) from public,anon;
grant execute on function public.save_whatsapp_automation(text,text,jsonb,uuid,integer,text[],boolean,text,uuid) to authenticated;

/*
 * activate  draft  -> active   needs every gate; the scan starts NOW (no backfill)
 * resume    paused -> active   same gates; triggers seen while paused are not replayed
 * pause     active -> paused   safety-increasing, never gated; pending sends wait
 * archive   any    -> archived pending sends are cancelled; in-flight evidence stays
 */
create or replace function public.set_whatsapp_automation_status(p_automation_id uuid,p_action text,p_lock_version integer)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_actor uuid:=auth.uid(); a public.whatsapp_automations%rowtype; v_problem text; v_denial text; v_policy public.whatsapp_marketing_send_policies%rowtype; v_to text;
begin
  if v_actor is null or not private.has_permission('whatsapp.automations.manage') then raise exception 'WHATSAPP_AUTOMATIONS_DENIED' using errcode='42501'; end if;
  if p_action is null or p_action not in ('activate','resume','pause','archive') then raise exception 'WHATSAPP_AUTOMATION_VALIDATION' using errcode='22023'; end if;
  select * into a from public.whatsapp_automations where id=p_automation_id for update;
  if not found then raise exception 'WHATSAPP_AUTOMATION_NOT_FOUND' using errcode='P0002'; end if;
  if p_lock_version is null or p_lock_version<>a.lock_version then raise exception 'WHATSAPP_AUTOMATION_STALE' using errcode='40001'; end if;

  if p_action in ('activate','resume') then
    if (p_action='activate' and a.status<>'draft') or (p_action='resume' and a.status<>'paused') then raise exception 'WHATSAPP_AUTOMATION_TRANSITION_INVALID' using errcode='22023'; end if;
    v_denial:=private.whatsapp_campaign_operator_denial(v_actor,a.campaign_version_id);
    if v_denial='approved_by_actor' then raise exception 'WHATSAPP_CAMPAIGN_APPROVER_CANNOT_EXECUTE' using errcode='42501'; end if;
    if v_denial is not null then raise exception 'WHATSAPP_AUTOMATIONS_DENIED' using errcode='42501'; end if;
    v_problem:=coalesce(private.whatsapp_automation_trigger_config_problem(a.trigger_type,a.trigger_config),private.whatsapp_automation_send_problem(a.campaign_version_id));
    if v_problem is not null then raise exception 'WHATSAPP_AUTOMATION_NOT_SENDABLE: %',v_problem using errcode='22023'; end if;
    select * into v_policy from private.whatsapp_campaign_latest_policy();
    if not found or v_policy.execution_enabled is not true then raise exception 'WHATSAPP_MARKETING_EXECUTION_DISABLED' using errcode='42501'; end if;
    v_to:='active';
    update public.whatsapp_automations set status='active',scan_cursor_at=clock_timestamp(),lock_version=lock_version+1,updated_by=v_actor,
      activated_by=coalesce(activated_by,v_actor),activated_at=coalesce(activated_at,clock_timestamp())
    where id=a.id;
  elsif p_action='pause' then
    if a.status<>'active' then raise exception 'WHATSAPP_AUTOMATION_TRANSITION_INVALID' using errcode='22023'; end if;
    v_to:='paused';
    update public.whatsapp_automations set status='paused',lock_version=lock_version+1,updated_by=v_actor where id=a.id;
  else
    if a.status='archived' then raise exception 'WHATSAPP_AUTOMATION_TRANSITION_INVALID' using errcode='22023'; end if;
    v_to:='archived';
    update public.whatsapp_automations set status='archived',lock_version=lock_version+1,updated_by=v_actor where id=a.id;
    update public.whatsapp_automation_enrollments set state='cancelled',reason_code='automation_archived' where automation_id=a.id and state='pending';
  end if;
  perform private.whatsapp_automation_append_event(a.id,null,'automation_'||p_action,a.status,v_to,'staff',v_actor,'{}'::jsonb);
  return jsonb_build_object('automation_id',a.id,'status',v_to,'lock_version',a.lock_version+1);
end;$$;
revoke all on function public.set_whatsapp_automation_status(uuid,text,integer) from public,anon;
grant execute on function public.set_whatsapp_automation_status(uuid,text,integer) to authenticated;

-- 11. Automation worker: trigger scan, JIT claim, provider evidence, binding.

/* Trigger rows appended after the cursor, in insertion order. */
create or replace function private.whatsapp_automation_trigger_rows(p_automation public.whatsapp_automations,p_after timestamptz,p_limit integer)
returns table(row_created_at timestamptz,trigger_key text,contact_id uuid,lead_id uuid,event_at timestamptz)
language sql stable security definer set search_path='' as $$
  with src as (
    select le.created_at,'lead_event:'||le.id::text as trigger_key,l.contact_id,l.id as lead_id,le.occurred_at as event_at
    from public.lead_events le join public.leads l on l.id=le.lead_id
    where p_automation.trigger_type='lead_created' and le.event_type='lead.created' and le.created_at>p_after and l.deleted_at is null
    union all
    select le.created_at,'lead_event:'||le.id::text,l.contact_id,l.id,le.occurred_at
    from public.lead_events le join public.leads l on l.id=le.lead_id
    where p_automation.trigger_type='lead_stage_changed' and le.event_type in ('lead.status_changed','lead.resumed') and le.created_at>p_after
      and l.deleted_at is null and coalesce(le.event_data->>'to',le.event_data->>'to_status')=p_automation.trigger_config->>'to_stage'
    union all
    select ra.created_at,'reply:'||ra.id::text,c.contact_id,c.lead_id,ra.created_at
    from public.whatsapp_reply_attributions ra join public.whatsapp_conversations c on c.id=ra.conversation_id
    where p_automation.trigger_type='campaign_reply' and ra.source_kind='campaign' and ra.created_at>p_after
      and (not (p_automation.trigger_config ? 'campaign_version_id') or ra.campaign_version_id::text=p_automation.trigger_config->>'campaign_version_id')
    union all
    select fr.created_at,'flow_response:'||fr.id::text,fr.contact_id,fr.lead_id,fr.received_at
    from public.whatsapp_flow_responses fr
    where p_automation.trigger_type='flow_completed' and fr.flow_id::text=p_automation.trigger_config->>'flow_id' and fr.created_at>p_after
    union all
    select rc.created_at,'referral:'||rc.id::text,rc.contact_id,rc.lead_id,rc.captured_at
    from public.whatsapp_referral_contexts rc
    where p_automation.trigger_type='ctwa_referral' and rc.created_at>p_after
      and (not (p_automation.trigger_config ? 'source_id') or rc.source_id=p_automation.trigger_config->>'source_id')
  )
  select s.created_at,s.trigger_key,s.contact_id,s.lead_id,s.event_at from src s order by s.created_at,s.trigger_key limit p_limit;
$$;
revoke all on function private.whatsapp_automation_trigger_rows(public.whatsapp_automations,timestamptz,integer) from public,anon,authenticated;

create or replace function public.enroll_whatsapp_automation_triggers(p_limit integer default 200)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare n integer:=greatest(1,least(coalesce(p_limit,200),1000)); a public.whatsapp_automations%rowtype; t record;
  v_upper timestamptz; v_cursor timestamptz; v_enrolled integer; v_seen integer; v_id uuid; v_out jsonb:='[]'::jsonb;
begin
  perform private.whatsapp_campaign_require_service_role();
  for a in select * from public.whatsapp_automations where status='active' order by id for update skip locked loop
    -- Ties at the page edge are finished, not cut: every row sharing the last timestamp is taken.
    select max(x.row_created_at) into v_upper from (select row_created_at from private.whatsapp_automation_trigger_rows(a,a.scan_cursor_at,n)) x;
    if v_upper is null then continue; end if;
    v_enrolled:=0; v_seen:=0; v_cursor:=a.scan_cursor_at;
    for t in select * from private.whatsapp_automation_trigger_rows(a,a.scan_cursor_at,n*20) where row_created_at<=v_upper loop
      v_seen:=v_seen+1; v_cursor:=greatest(v_cursor,t.row_created_at);
      if t.contact_id is null then continue; end if;
      v_id:=null;
      insert into public.whatsapp_automation_enrollments(automation_id,contact_id,lead_id,trigger_key,state,not_before)
      values(a.id,t.contact_id,t.lead_id,t.trigger_key,'pending',greatest(clock_timestamp(),t.event_at+make_interval(mins=>a.delay_minutes)))
      on conflict do nothing returning id into v_id;
      if v_id is not null then
        v_enrolled:=v_enrolled+1;
        perform private.whatsapp_automation_append_event(a.id,v_id,'enrolled',null,'pending','worker',null,jsonb_build_object('trigger',split_part(t.trigger_key,':',1)));
      end if;
    end loop;
    update public.whatsapp_automations set scan_cursor_at=v_cursor where id=a.id;
    v_out:=v_out||jsonb_build_array(jsonb_build_object('automation_id',a.id,'seen',v_seen,'enrolled',v_enrolled));
  end loop;
  return v_out;
end;$$;
revoke all on function public.enroll_whatsapp_automation_triggers(integer) from public,anon,authenticated;
grant execute on function public.enroll_whatsapp_automation_triggers(integer) to service_role;

/* JIT, in precedence: automation, template, lead, reply, contact/channel/consent/preference/variables, policy, cap, quiet hours. */
create or replace function private.whatsapp_automation_enrollment_eligibility(p_enrollment_id uuid,p_at timestamptz default clock_timestamp())
returns table(decision text,reason text,defer_until timestamptz,channel_id uuid,recipient_e164 text,parameters jsonb)
language plpgsql stable security definer set search_path='' as $$
declare e public.whatsapp_automation_enrollments%rowtype; a public.whatsapp_automations%rowtype; s public.whatsapp_campaign_specs%rowtype;
  snap public.whatsapp_template_snapshots%rowtype; l public.leads%rowtype; v_problem text; ev record; pol public.whatsapp_marketing_send_policies%rowtype; v_quiet timestamptz;
begin
  select * into e from public.whatsapp_automation_enrollments where id=p_enrollment_id;
  select * into a from public.whatsapp_automations where id=e.automation_id;
  if not found or a.status<>'active' then return query select 'skip'::text,'automation_not_active'::text,null::timestamptz,null::uuid,null::text,null::jsonb; return; end if;
  v_problem:=private.whatsapp_automation_send_problem(a.campaign_version_id);
  if v_problem is not null then return query select 'skip'::text,v_problem,null::timestamptz,null::uuid,null::text,null::jsonb; return; end if;
  if e.lead_id is not null then
    select * into l from public.leads where id=e.lead_id;
    if not found or l.deleted_at is not null then return query select 'skip'::text,'lead_tombstoned'::text,null::timestamptz,null::uuid,null::text,null::jsonb; return; end if;
    if l.status=any(a.stop_on_lead_statuses) then return query select 'skip'::text,'lead_terminal_status'::text,null::timestamptz,null::uuid,null::text,null::jsonb; return; end if;
  end if;
  if a.stop_on_reply and exists(
    select 1 from public.whatsapp_messages m join public.whatsapp_conversations c on c.id=m.conversation_id
    where c.contact_id=e.contact_id and m.direction='inbound' and m.provider_timestamp>e.created_at
  ) then
    return query select 'skip'::text,'customer_replied'::text,null::timestamptz,null::uuid,null::text,null::jsonb; return;
  end if;
  select * into s from public.whatsapp_campaign_specs where campaign_version_id=a.campaign_version_id;
  select * into snap from public.whatsapp_template_snapshots where id=s.template_snapshot_id;
  select * into ev from private.whatsapp_campaign_evaluate_contact(e.contact_id,s.preference_category,snap.components,s.default_parameters,s.parameter_bindings);
  if ev.o_reason is not null then return query select 'skip'::text,ev.o_reason,null::timestamptz,null::uuid,null::text,null::jsonb; return; end if;
  select * into pol from private.whatsapp_campaign_latest_policy();
  if not found or pol.execution_enabled is not true then return query select 'skip'::text,'send_policy_unconfigured'::text,null::timestamptz,null::uuid,null::text,null::jsonb; return; end if;
  if private.whatsapp_campaign_frequency_capped(e.contact_id,pol,p_at) then return query select 'skip'::text,'frequency_capped'::text,null::timestamptz,null::uuid,null::text,null::jsonb; return; end if;
  v_quiet:=private.whatsapp_campaign_quiet_until(pol,p_at);
  if v_quiet is not null and v_quiet>p_at then return query select 'defer'::text,'quiet_hours'::text,v_quiet,null::uuid,null::text,null::jsonb; return; end if;
  return query select 'eligible'::text,null::text,null::timestamptz,ev.o_channel_id,ev.o_e164,ev.o_parameters;
end;$$;
revoke all on function private.whatsapp_automation_enrollment_eligibility(uuid,timestamptz) from public,anon,authenticated;

create or replace function public.claim_whatsapp_automation_enrollments(p_worker_id text,p_batch_size integer default 20)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare n integer:=greatest(1,least(coalesce(p_batch_size,20),50)); x record; g record; tok uuid; v_out jsonb:='[]'::jsonb; v_worker text:=trim(coalesce(p_worker_id,''));
  a public.whatsapp_automations%rowtype; s public.whatsapp_campaign_specs%rowtype; snap public.whatsapp_template_snapshots%rowtype;
  wp public.whatsapp_phone_numbers%rowtype; v_sender text; v_attempt integer; v_components jsonb;
begin
  perform private.whatsapp_campaign_require_service_role();
  if length(v_worker) not between 1 and 80 then raise exception 'WHATSAPP_WORKER_ID_INVALID' using errcode='22023'; end if;

  for x in select * from public.whatsapp_automation_enrollments where state='claimed' and claim_expires_at<clock_timestamp() order by claim_expires_at limit 200 for update skip locked loop
    if x.provider_request_started_at is null then
      update public.whatsapp_automation_enrollments set state='pending',claim_token=null,claimed_by=null,claimed_at=null,claim_expires_at=null,not_before=clock_timestamp(),last_error_code='claim_expired_before_provider' where id=x.id;
      perform private.whatsapp_automation_append_event(x.automation_id,x.id,'claim_expired','claimed','pending','worker',null,'{}'::jsonb);
    else
      update public.whatsapp_automation_enrollments set state='needs_reconcile',reason_code='provider_outcome_unknown',claim_token=null,claimed_by=null,claimed_at=null,claim_expires_at=null,last_error_code='claim_expired_after_provider_start' where id=x.id;
      perform private.whatsapp_automation_append_event(x.automation_id,x.id,'claim_ambiguous_timeout','claimed','needs_reconcile','worker',null,'{}'::jsonb);
    end if;
  end loop;

  for x in
    select e.* from public.whatsapp_automation_enrollments e join public.whatsapp_automations au on au.id=e.automation_id
    where e.state='pending' and e.not_before<=clock_timestamp() and au.status='active'
    order by e.not_before,e.created_at,e.id for update of e skip locked limit n
  loop
    if x.attempt_count>=3 then
      update public.whatsapp_automation_enrollments set state='failed',reason_code='attempts_exhausted',last_error_code='attempts_exhausted' where id=x.id;
      perform private.whatsapp_automation_append_event(x.automation_id,x.id,'enrollment_failed','pending','failed','worker',null,jsonb_build_object('reason','attempts_exhausted'));
      continue;
    end if;
    select * into g from private.whatsapp_automation_enrollment_eligibility(x.id,clock_timestamp());
    if g.decision='defer' then
      update public.whatsapp_automation_enrollments set not_before=g.defer_until,last_error_code=g.reason where id=x.id;
      perform private.whatsapp_automation_append_event(x.automation_id,x.id,'enrollment_deferred','pending','pending','worker',null,jsonb_build_object('reason',g.reason,'not_before',g.defer_until));
      continue;
    elsif g.decision<>'eligible' then
      update public.whatsapp_automation_enrollments set state='skipped',reason_code=left(g.reason,80),last_error_code=left(g.reason,128) where id=x.id;
      perform private.whatsapp_automation_append_event(x.automation_id,x.id,'enrollment_skipped','pending','skipped','worker',null,jsonb_build_object('reason',g.reason));
      continue;
    end if;

    select * into a from public.whatsapp_automations where id=x.automation_id;
    select * into s from public.whatsapp_campaign_specs where campaign_version_id=a.campaign_version_id;
    select * into snap from public.whatsapp_template_snapshots where id=s.template_snapshot_id;
    wp:=null;
    select p.* into wp from public.whatsapp_phone_numbers p
    left join lateral (select c.phone_number_id from public.whatsapp_conversations c where c.contact_id=x.contact_id and c.customer_e164=g.recipient_e164 order by c.last_message_at desc nulls last limit 1) wc on true
    where p.business_account_id=snap.business_account_id and p.status='active'
    order by (p.id=wc.phone_number_id) desc nulls last,p.created_at,p.id limit 1;
    v_sender:=case when wp.id is null then null else private.whatsapp_business_sender_e164(wp.display_phone_number) end;
    if wp.id is null or v_sender is null then
      update public.whatsapp_automation_enrollments set state='failed',reason_code='business_phone_unavailable',last_error_code='business_phone_unavailable' where id=x.id;
      perform private.whatsapp_automation_append_event(x.automation_id,x.id,'enrollment_failed','pending','failed','worker',null,jsonb_build_object('reason','business_phone_unavailable'));
      continue;
    end if;
    tok:=gen_random_uuid(); v_attempt:=x.attempt_count+1;
    update public.whatsapp_automation_enrollments set state='claimed',attempt_count=v_attempt,claim_token=tok,claimed_by=v_worker,claimed_at=clock_timestamp(),
      claim_expires_at=clock_timestamp()+interval '120 seconds',phone_number_id=wp.id,sender_e164=v_sender,contact_channel_id=g.channel_id,
      recipient_e164=g.recipient_e164,template_parameters=g.parameters,last_error_code=null
    where id=x.id;
    perform private.whatsapp_automation_append_event(x.automation_id,x.id,'enrollment_claimed','pending','claimed','worker',null,jsonb_build_object('attempt',v_attempt));
    v_components:=private.whatsapp_build_template_send_components(snap.components,snap.parameter_format,g.parameters)
      ||private.whatsapp_mint_button_components(snap.components,s.button_bindings,'automation',null,null,null,x.id);
    v_out:=v_out||jsonb_build_array(jsonb_build_object(
      'enrollment_id',x.id,'claim_token',tok,'attempt',v_attempt,'automation_id',x.automation_id,
      'phone_number_id',wp.phone_number_id,'recipient_e164',g.recipient_e164,
      'template_name',snap.name,'template_language',snap.language,'template_components',v_components
    ));
  end loop;
  return v_out;
end;$$;
revoke all on function public.claim_whatsapp_automation_enrollments(text,integer) from public,anon,authenticated;
grant execute on function public.claim_whatsapp_automation_enrollments(text,integer) to service_role;

create or replace function public.mark_whatsapp_automation_provider_request_started(p_enrollment_id uuid,p_claim_token uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare e public.whatsapp_automation_enrollments%rowtype;
begin
  perform private.whatsapp_campaign_require_service_role();
  select * into e from public.whatsapp_automation_enrollments where id=p_enrollment_id for update;
  if not found or e.state<>'claimed' or e.claim_token is distinct from p_claim_token or e.claim_expires_at<=clock_timestamp() then
    raise exception 'WHATSAPP_AUTOMATION_ENROLLMENT_NOT_CLAIMED' using errcode='P0002';
  end if;
  if e.provider_request_started_at is null then
    update public.whatsapp_automation_enrollments set provider_request_started_at=clock_timestamp() where id=e.id;
    perform private.whatsapp_automation_append_event(e.automation_id,e.id,'provider_request_started','claimed','claimed','worker',null,'{}'::jsonb);
  end if;
  return jsonb_build_object('enrollment_id',e.id,'provider_request_started',true);
end;$$;
revoke all on function public.mark_whatsapp_automation_provider_request_started(uuid,uuid) from public,anon,authenticated;
grant execute on function public.mark_whatsapp_automation_provider_request_started(uuid,uuid) to service_role;

create or replace function private.whatsapp_automation_bind_success(
  p_enrollment_id uuid,p_provider_message_id text,p_provider_timestamp timestamptz,p_details jsonb,p_actor_type text,p_actor_id uuid
)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare e public.whatsapp_automation_enrollments%rowtype; a public.whatsapp_automations%rowtype; s public.whatsapp_campaign_specs%rowtype;
  snap public.whatsapp_template_snapshots%rowtype; v_conversation uuid; v_message uuid; v_existing record; v_at timestamptz:=coalesce(p_provider_timestamp,clock_timestamp()); v_from text;
begin
  if p_provider_message_id is null or length(p_provider_message_id) not between 1 and 128 or p_provider_message_id ~ '\s' then raise exception 'WHATSAPP_PROVIDER_MESSAGE_ID_INVALID' using errcode='22023'; end if;
  select * into e from public.whatsapp_automation_enrollments where id=p_enrollment_id for update;
  select * into a from public.whatsapp_automations where id=e.automation_id;
  select * into s from public.whatsapp_campaign_specs where campaign_version_id=a.campaign_version_id;
  select * into snap from public.whatsapp_template_snapshots where id=s.template_snapshot_id;
  if e.phone_number_id is null or e.sender_e164 is null or e.recipient_e164 is null then raise exception 'WHATSAPP_AUTOMATION_BINDING_EVIDENCE_MISSING' using errcode='22023'; end if;
  v_from:=e.state;

  select m.id,m.conversation_id into v_existing from public.whatsapp_messages m where m.provider_message_id=p_provider_message_id;
  if found then
    if exists(select 1 from public.whatsapp_message_automation_attributions x where x.whatsapp_message_id=v_existing.id and x.enrollment_id=e.id) then
      update public.whatsapp_automation_enrollments set state='sent',provider_message_id=p_provider_message_id,canonical_message_id=v_existing.id,reason_code=null,
        claim_token=null,claimed_by=null,claimed_at=null,claim_expires_at=null,last_error_code=null where id=e.id;
      return jsonb_build_object('outcome','already_bound','message_id',v_existing.id);
    end if;
    raise exception 'WHATSAPP_PROVIDER_MESSAGE_CONFLICT' using errcode='23505';
  end if;

  insert into public.whatsapp_conversations(phone_number_id,customer_e164,contact_id,last_message_at)
  values(e.phone_number_id,e.recipient_e164,e.contact_id,v_at)
  on conflict(phone_number_id,customer_e164) do update set
    contact_id=coalesce(public.whatsapp_conversations.contact_id,excluded.contact_id),
    last_message_at=greatest(coalesce(public.whatsapp_conversations.last_message_at,excluded.last_message_at),excluded.last_message_at),
    updated_at=now()
  returning id into v_conversation;
  perform private.crm_apply_whatsapp_conversation_lead_link(v_conversation);

  insert into public.whatsapp_messages(conversation_id,provider_message_id,direction,provider_message_type,normalized_message_type,sender_e164,recipient_e164,body_text,content,provider_timestamp,latest_status)
  values(v_conversation,p_provider_message_id,'outbound','template','text',e.sender_e164,e.recipient_e164,
    left(private.whatsapp_render_template_preview(snap.components,e.template_parameters),4096),
    jsonb_build_object(
      'template',jsonb_build_object('template_id',snap.template_id,'snapshot_id',snap.id,'provider_template_id',snap.provider_template_id,
        'name',snap.name,'language',snap.language,'category',snap.category,'parameter_format',snap.parameter_format),
      'parameters',e.template_parameters,
      'automation',jsonb_build_object('automation_id',a.id,'enrollment_id',e.id,'campaign_version_id',a.campaign_version_id)
    ),v_at,null)
  returning id into v_message;
  insert into public.whatsapp_message_automation_attributions(whatsapp_message_id,automation_id,enrollment_id,campaign_version_id) values(v_message,a.id,e.id,a.campaign_version_id);
  update public.whatsapp_automation_enrollments set state='sent',provider_message_id=p_provider_message_id,canonical_message_id=v_message,reason_code=null,
    claim_token=null,claimed_by=null,claimed_at=null,claim_expires_at=null,last_error_code=null where id=e.id;
  perform private.whatsapp_automation_append_event(a.id,e.id,'provider_bound',v_from,'sent',p_actor_type,p_actor_id,
    jsonb_build_object('provider_message_id',p_provider_message_id)||coalesce(p_details,'{}'::jsonb));
  return jsonb_build_object('outcome','bound','message_id',v_message,'conversation_id',v_conversation);
end;$$;
revoke all on function private.whatsapp_automation_bind_success(uuid,text,timestamptz,jsonb,text,uuid) from public,anon,authenticated;

create or replace function public.complete_whatsapp_automation_dispatch_success(
  p_enrollment_id uuid,p_claim_token uuid,p_provider_message_id text,p_provider_timestamp timestamptz,p_provider_snapshot jsonb default '{}'::jsonb
)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare e public.whatsapp_automation_enrollments%rowtype;
begin
  perform private.whatsapp_campaign_require_service_role();
  if p_provider_snapshot is null or jsonb_typeof(p_provider_snapshot)<>'object' or pg_column_size(p_provider_snapshot)>4096 then raise exception 'WHATSAPP_PROVIDER_SNAPSHOT_INVALID' using errcode='22023'; end if;
  select * into e from public.whatsapp_automation_enrollments where id=p_enrollment_id for update;
  if found and e.state='sent' and e.provider_message_id=p_provider_message_id then return jsonb_build_object('outcome','already_bound'); end if;
  if not found or e.state<>'claimed' or e.claim_token is distinct from p_claim_token or e.provider_request_started_at is null then
    raise exception 'WHATSAPP_AUTOMATION_ENROLLMENT_NOT_COMPLETABLE' using errcode='P0002';
  end if;
  return private.whatsapp_automation_bind_success(e.id,p_provider_message_id,p_provider_timestamp,jsonb_build_object('provider',p_provider_snapshot),'worker',null);
end;$$;
revoke all on function public.complete_whatsapp_automation_dispatch_success(uuid,uuid,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.complete_whatsapp_automation_dispatch_success(uuid,uuid,text,timestamptz,jsonb) to service_role;

create or replace function public.complete_whatsapp_automation_dispatch_failure(
  p_enrollment_id uuid,p_claim_token uuid,p_outcome text,p_error_code text,p_provider_snapshot jsonb default '{}'::jsonb
)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare e public.whatsapp_automation_enrollments%rowtype; v_next text; v_at timestamptz; v_delay integer;
begin
  perform private.whatsapp_campaign_require_service_role();
  if p_outcome is null or p_outcome not in ('transient','terminal','ambiguous') or p_error_code is null or length(p_error_code) not between 1 and 128 then raise exception 'WHATSAPP_DISPATCH_FAILURE_INVALID' using errcode='22023'; end if;
  if p_provider_snapshot is null or jsonb_typeof(p_provider_snapshot)<>'object' or pg_column_size(p_provider_snapshot)>4096 then raise exception 'WHATSAPP_PROVIDER_SNAPSHOT_INVALID' using errcode='22023'; end if;
  select * into e from public.whatsapp_automation_enrollments where id=p_enrollment_id for update;
  if not found or e.state<>'claimed' or e.claim_token is distinct from p_claim_token or e.provider_request_started_at is null then
    raise exception 'WHATSAPP_AUTOMATION_ENROLLMENT_NOT_COMPLETABLE' using errcode='P0002';
  end if;
  -- Ambiguous is never retried: the customer may already have the message.
  if p_outcome='ambiguous' then v_next:='needs_reconcile';
  elsif p_outcome='transient' and e.attempt_count<3 then
    v_next:='pending'; v_delay:=least(900,30*(2^(greatest(1,e.attempt_count)-1))::integer); v_at:=clock_timestamp()+make_interval(secs=>v_delay);
  else v_next:='failed'; end if;
  update public.whatsapp_automation_enrollments set state=v_next,claim_token=null,claimed_by=null,claimed_at=null,claim_expires_at=null,
    provider_request_started_at=case when v_next='pending' then null else provider_request_started_at end,
    not_before=coalesce(v_at,not_before),last_error_code=p_error_code,
    reason_code=case when v_next='needs_reconcile' then 'provider_outcome_unknown' when v_next='failed' then left(p_error_code,80) else reason_code end
  where id=e.id;
  perform private.whatsapp_automation_append_event(e.automation_id,e.id,
    case when v_next='pending' then 'retry_scheduled' when v_next='needs_reconcile' then 'provider_ambiguous' else 'enrollment_failed' end,
    'claimed',v_next,'worker',null,jsonb_build_object('error_code',p_error_code,'not_before',v_at,'provider',p_provider_snapshot));
  return jsonb_build_object('outcome',case when v_next='pending' then 'retry_scheduled' when v_next='needs_reconcile' then 'needs_reconcile' else 'failed_terminal' end,'state',v_next,'not_before',v_at);
end;$$;
revoke all on function public.complete_whatsapp_automation_dispatch_failure(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.complete_whatsapp_automation_dispatch_failure(uuid,uuid,text,text,jsonb) to service_role;

/* Super Admin audited decision for an ambiguous automation send. Never re-queued. */
create or replace function public.resolve_whatsapp_automation_reconcile(p_enrollment_id uuid,p_resolution text,p_note text,p_provider_message_id text default null)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a uuid:=auth.uid(); v_note text:=trim(coalesce(p_note,'')); e public.whatsapp_automation_enrollments%rowtype;
begin
  if a is null or not private.has_permission('whatsapp.automations.manage') or not private.has_role('super_admin') then
    raise exception 'WHATSAPP_AUTOMATION_RECONCILE_DENIED' using errcode='42501';
  end if;
  if p_resolution is null or p_resolution not in ('sent','not_sent') then raise exception 'WHATSAPP_RECONCILE_RESOLUTION_INVALID' using errcode='22023'; end if;
  if length(v_note) not between 8 and 500 then raise exception 'WHATSAPP_RECONCILE_NOTE_REQUIRED' using errcode='22023'; end if;
  select * into e from public.whatsapp_automation_enrollments where id=p_enrollment_id for update;
  if not found or e.state<>'needs_reconcile' then raise exception 'WHATSAPP_RECONCILE_NOT_FOUND' using errcode='P0002'; end if;
  if p_resolution='not_sent' then
    update public.whatsapp_automation_enrollments set state='failed',reason_code='reconciled_not_sent',last_error_code='reconciled_not_sent' where id=e.id;
    perform private.whatsapp_automation_append_event(e.automation_id,e.id,'reconcile_not_sent','needs_reconcile','failed','staff',a,jsonb_build_object('note',v_note));
    return jsonb_build_object('outcome','failed','resolution','not_sent');
  end if;
  if nullif(trim(coalesce(p_provider_message_id,'')),'') is null then raise exception 'WHATSAPP_RECONCILE_PROVIDER_ID_REQUIRED' using errcode='22023'; end if;
  return private.whatsapp_automation_bind_success(e.id,trim(p_provider_message_id),null,jsonb_build_object('reconcile',jsonb_build_object('note',v_note)),'staff',a)
    ||jsonb_build_object('resolution','sent');
end;$$;
revoke all on function public.resolve_whatsapp_automation_reconcile(uuid,text,text,text) from public,anon;
grant execute on function public.resolve_whatsapp_automation_reconcile(uuid,text,text,text) to authenticated;

-- 12. Analytics: automation funnel and CTWA referral outcomes.

create or replace function public.get_whatsapp_automation_analytics(p_from timestamptz default null,p_to timestamptz default null)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_from timestamptz; v_to timestamptz;
begin
  perform private.whatsapp_analytics_require_read();
  select range_from,range_to into v_from,v_to from private.whatsapp_analytics_range(p_from,p_to);
  return jsonb_build_object(
    'range',jsonb_build_object('from',v_from,'to',v_to),
    'automations',coalesce((
      select jsonb_agg(x.item order by x.enrolled desc,x.name)
      from (
        select a.name,count(f.enrollment_id) as enrolled,jsonb_build_object(
          'automation_id',a.id,'name',a.name,'status',a.status,'trigger_type',a.trigger_type,
          'enrolled',count(f.enrollment_id),
          'sent',count(f.message_id),
          'skipped',count(*) filter (where f.state='skipped'),
          'failed',count(*) filter (where f.state='failed'),
          'needs_reconcile',count(*) filter (where f.state='needs_reconcile'),
          'delivered',count(*) filter (where f.delivered_at is not null),
          'read',count(*) filter (where f.read_at is not null),
          'clicked',count(*) filter (where f.clicked),
          'replied',count(*) filter (where f.replied),
          'consultation',count(*) filter (where f.consultation_at is not null),
          'quotation',count(*) filter (where f.quotation_at is not null),
          'booking',count(*) filter (where f.booking_at is not null)
        ) as item
        from public.whatsapp_automations a
        left join lateral (
          select e.id as enrollment_id,e.state,m.id as message_id,
            (select min(se.provider_timestamp) from public.whatsapp_message_status_events se where m.id is not null and se.provider_message_id=m.provider_message_id and se.status in ('delivered','read')) as delivered_at,
            (select min(se.provider_timestamp) from public.whatsapp_message_status_events se where m.id is not null and se.provider_message_id=m.provider_message_id and se.status='read') as read_at,
            exists(select 1 from public.whatsapp_click_tokens t join public.whatsapp_click_events ce on ce.token_id=t.id where t.enrollment_id=e.id and ce.client_class<>'bot') as clicked,
            exists(select 1 from public.whatsapp_reply_attributions ra where ra.enrollment_id=e.id) as replied,
            cv.consultation_at,cv.quotation_at,cv.booking_at
          from public.whatsapp_automation_enrollments e
          left join public.whatsapp_messages m on m.id=e.canonical_message_id
          left join lateral private.whatsapp_contact_conversion_evidence(e.contact_id,m.provider_timestamp) cv on true
          where e.automation_id=a.id and e.created_at>=v_from and e.created_at<v_to
        ) f on true
        group by a.id,a.name,a.status,a.trigger_type
      ) x
    ),'[]'::jsonb),
    'generated_at',clock_timestamp()
  );
end;$$;
revoke all on function public.get_whatsapp_automation_analytics(timestamptz,timestamptz) from public,anon;
grant execute on function public.get_whatsapp_automation_analytics(timestamptz,timestamptz) to authenticated;

create or replace function public.get_whatsapp_referral_analytics(p_from timestamptz default null,p_to timestamptz default null)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare v_from timestamptz; v_to timestamptz;
begin
  perform private.whatsapp_analytics_require_read();
  select range_from,range_to into v_from,v_to from private.whatsapp_analytics_range(p_from,p_to);
  return jsonb_build_object(
    'range',jsonb_build_object('from',v_from,'to',v_to),
    'total_referrals',(select count(*) from public.whatsapp_referral_contexts rc where rc.captured_at>=v_from and rc.captured_at<v_to),
    'sources',coalesce((
      select jsonb_agg(x.item order by x.referrals desc,x.source_key)
      from (
        select coalesce(rc.source_id,'(unknown)') as source_key,count(*) as referrals,jsonb_build_object(
          'source_id',rc.source_id,'source_type',max(rc.source_type),'headline',max(rc.headline),'source_url_host',max(rc.source_url_host),
          'referrals',count(*),'contacts',count(distinct rc.contact_id),'leads_linked',count(distinct rc.lead_id),
          'consultation',count(distinct rc.contact_id) filter (where cv.consultation_at is not null),
          'quotation',count(distinct rc.contact_id) filter (where cv.quotation_at is not null),
          'booking',count(distinct rc.contact_id) filter (where cv.booking_at is not null)
        ) as item
        from public.whatsapp_referral_contexts rc
        left join lateral private.whatsapp_contact_conversion_evidence(rc.contact_id,rc.captured_at) cv on rc.contact_id is not null
        where rc.captured_at>=v_from and rc.captured_at<v_to
        group by rc.source_id
        limit 100
      ) x
    ),'[]'::jsonb),
    'generated_at',clock_timestamp()
  );
end;$$;
revoke all on function public.get_whatsapp_referral_analytics(timestamptz,timestamptz) from public,anon;
grant execute on function public.get_whatsapp_referral_analytics(timestamptz,timestamptz) to authenticated;

-- 13. Reply attribution names automation origins as well as campaign ones.
create or replace function private.whatsapp_attribute_inbound_reply(p_message_id uuid)
returns text language plpgsql volatile security definer set search_path='' as $$
declare m public.whatsapp_messages%rowtype; o public.whatsapp_messages%rowtype; src record; v_method text;
begin
  select * into m from public.whatsapp_messages where id=p_message_id and direction='inbound';
  if not found then return 'not_applicable'; end if;
  if exists(select 1 from public.whatsapp_reply_attributions a where a.inbound_message_id=m.id) then return 'already_attributed'; end if;

  if m.context_provider_message_id is not null then
    select * into o from public.whatsapp_messages
    where provider_message_id=m.context_provider_message_id and direction='outbound' and conversation_id=m.conversation_id;
    if not found then return 'context_not_attributable'; end if;
    v_method:='exact_context';
  else
    select * into o from public.whatsapp_messages
    where conversation_id=m.conversation_id and direction='outbound' and provider_timestamp<=m.provider_timestamp
    order by provider_timestamp desc,created_at desc limit 1;
    if not found then return 'no_prior_outbound'; end if;
    if m.provider_timestamp-o.provider_timestamp>interval '72 hours' then return 'outside_inference_window'; end if;
    if exists(
      select 1 from public.whatsapp_messages i
      where i.conversation_id=m.conversation_id and i.direction='inbound' and i.id<>m.id
        and i.provider_timestamp>=o.provider_timestamp
        and (i.provider_timestamp<m.provider_timestamp or (i.provider_timestamp=m.provider_timestamp and i.created_at<m.created_at))
    ) then
      return 'not_first_reply';
    end if;
    v_method:='inferred_window';
  end if;

  select * into src from private.whatsapp_outbound_marketing_source(o.id) limit 1;
  if not found then return case when v_method='exact_context' then 'context_not_attributable' else 'latest_outbound_not_marketing' end; end if;

  insert into public.whatsapp_reply_attributions(
    inbound_message_id,outbound_message_id,conversation_id,method,source_kind,run_id,recipient_id,campaign_version_id,automation_id,enrollment_id,reply_lag_seconds
  )
  values(m.id,o.id,m.conversation_id,v_method,src.source_kind,src.run_id,src.recipient_id,src.campaign_version_id,src.automation_id,src.enrollment_id,
         greatest(0,floor(extract(epoch from (m.provider_timestamp-o.provider_timestamp))))::integer)
  on conflict (inbound_message_id) do nothing;
  return v_method;
end;$$;
revoke all on function private.whatsapp_attribute_inbound_reply(uuid) from public,anon,authenticated;
