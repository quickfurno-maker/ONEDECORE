-- =============================================================================
-- ONEDECORE WM-4 — WhatsApp governed marketing campaign execution
-- Forward-only. Generic campaign governance (campaigns, campaign_versions,
-- campaign_audience_rule_versions, campaign_approvals) remains the only
-- approval truth. public.campaign_runs is paid-ads infrastructure and is
-- deliberately untouched.
--
--   spec       1:1 with a WhatsApp-only campaign version; editable while the
--              version is draft, frozen by trigger the moment it is submitted
--              for approval, immutable afterwards
--   run        created only from an approved version by an operator who did
--              not approve it (Sales Manager) or a Super Admin; materialised
--              into a frozen recipient snapshot; auto-starts at its schedule
--   job        durable queue entry, claimed with a TTL by the service-role
--              worker, re-checked just in time, never retried after an
--              ambiguous provider outcome
--   evidence   append-only dispatch events and message attributions; replies
--              stay in the canonical inbox through webhook ingestion
--
-- No provider call happens in SQL. Staff read through RLS on exact permission
-- codes; every staff write is a definer RPC; every worker write is a
-- service-role-only RPC.
--
-- ROLE MODEL (as granted, not as once planned)
--
-- 20260906120000_sales_manager_control_plane_hardening revoked every generic
-- campaigns.* code from sales_manager. That stays true here: drafting, generic
-- approval and generic campaign reads remain Super Admin authority. A Sales
-- Manager's WhatsApp campaign authority comes only from the dedicated
-- whatsapp.campaigns.execute / test_send codes, and what they may read is
-- scoped to APPROVED WhatsApp-only versions through the definer RPCs below, so
-- no paid-ads campaign becomes visible to them. Pause is safety-increasing and
-- therefore rides on whatsapp.campaigns.execute rather than on the revoked
-- generic campaigns.pause.
-- =============================================================================

-- 1. Dedicated WhatsApp campaign permissions. Legacy roles receive no grants.
insert into public.permissions (code,name,description,is_system,is_active) values
('whatsapp.campaigns.execute','Execute WhatsApp campaigns','Schedule, start, pause and resume governed WhatsApp marketing runs',true,true),
('whatsapp.campaigns.test_send','Test WhatsApp campaigns','Send a governed campaign template to an approved internal test destination',true,true),
('whatsapp.campaigns.cancel','Cancel WhatsApp campaigns','Cancel a WhatsApp marketing run and resolve ambiguous provider outcomes',true,true)
on conflict (code) do update set name=excluded.name,description=excluded.description,is_system=true,is_active=true;

insert into public.role_permissions (role_id,permission_id)
select r.id,p.id
from (values
  ('super_admin','whatsapp.campaigns.execute'),
  ('super_admin','whatsapp.campaigns.test_send'),
  ('super_admin','whatsapp.campaigns.cancel'),
  ('sales_manager','whatsapp.campaigns.execute'),
  ('sales_manager','whatsapp.campaigns.test_send')
) v(role_code,permission_code)
join public.roles r on r.code=v.role_code and r.is_system=true
join public.permissions p on p.code=v.permission_code and p.is_system=true
on conflict (role_id,permission_id) do nothing;

-- 2. Tables.
create table public.whatsapp_campaign_specs (
  id uuid primary key default gen_random_uuid(),
  campaign_version_id uuid not null unique references public.campaign_versions(id) on delete restrict,
  template_snapshot_id uuid not null references public.whatsapp_template_snapshots(id) on delete restrict,
  preference_category text not null,
  -- Static values: {"header":{"1":"..."},"body":{"1":"...","2":"..."}}
  default_parameters jsonb not null default '{}'::jsonb,
  -- Per-recipient values: {"body":{"1":"contact_first_name"}}
  parameter_bindings jsonb not null default '{}'::jsonb,
  -- Optional saved segment that narrows the frozen campaign audience rule.
  segment_id uuid references public.whatsapp_segments(id) on delete restrict,
  segment_name text,
  segment_rule_group jsonb,
  segment_rule_hash text,
  state text not null default 'draft',
  frozen_at timestamptz,
  frozen_by uuid references public.profiles(id) on delete restrict,
  created_by uuid not null references public.profiles(id) on delete restrict,
  updated_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_whatsapp_campaign_specs_preference check (preference_category in ('design_inspiration','offers','project_updates','referral','educational_content')),
  constraint chk_whatsapp_campaign_specs_parameters check (jsonb_typeof(default_parameters)='object' and pg_column_size(default_parameters)<=4096),
  constraint chk_whatsapp_campaign_specs_bindings check (jsonb_typeof(parameter_bindings)='object' and pg_column_size(parameter_bindings)<=2048),
  constraint chk_whatsapp_campaign_specs_segment check (
    (segment_id is null and segment_name is null and segment_rule_group is null and segment_rule_hash is null)
    or (segment_id is not null and length(trim(segment_name)) between 2 and 120 and jsonb_typeof(segment_rule_group)='object'
        and pg_column_size(segment_rule_group)<=8192 and segment_rule_hash ~ '^[0-9a-f]{64}$')
  ),
  constraint chk_whatsapp_campaign_specs_state check (state in ('draft','frozen')),
  constraint chk_whatsapp_campaign_specs_frozen_pair check ((state='draft' and frozen_at is null and frozen_by is null) or (state='frozen' and frozen_at is not null and frozen_by is not null))
);

create table public.whatsapp_campaign_runs (
  id uuid primary key default gen_random_uuid(),
  campaign_version_id uuid not null references public.campaign_versions(id) on delete restrict,
  spec_id uuid not null references public.whatsapp_campaign_specs(id) on delete restrict,
  status text not null default 'scheduled',
  scheduled_for timestamptz not null default now(),
  auto_start boolean not null default true,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  started_at timestamptz,
  completed_at timestamptz,
  failure_code text,
  audience_rule_hash text not null,
  segment_rule_hash text,
  template_content_hash text not null,
  policy_version integer not null,
  total_count integer not null default 0,
  eligible_count integer not null default 0,
  excluded_count integer not null default 0,
  sent_count integer not null default 0,
  skipped_count integer not null default 0,
  failed_count integer not null default 0,
  reconcile_count integer not null default 0,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_whatsapp_campaign_runs_status check (status in ('scheduled','materializing','ready','dispatching','paused','reconciling','completed','cancelled','failed')),
  constraint chk_whatsapp_campaign_runs_rule_hash check (audience_rule_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_whatsapp_campaign_runs_segment_hash check (segment_rule_hash is null or segment_rule_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_whatsapp_campaign_runs_template_hash check (template_content_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_whatsapp_campaign_runs_policy_version check (policy_version>=1),
  constraint chk_whatsapp_campaign_runs_failure check ((status='failed')=(failure_code is not null) and (failure_code is null or length(failure_code) between 1 and 80)),
  constraint chk_whatsapp_campaign_runs_counts check (total_count>=0 and eligible_count>=0 and excluded_count>=0 and sent_count>=0 and skipped_count>=0 and failed_count>=0 and reconcile_count>=0)
);
create unique index uq_whatsapp_campaign_runs_open_version on public.whatsapp_campaign_runs(campaign_version_id)
where status in ('scheduled','materializing','ready','dispatching','paused','reconciling');
create index idx_whatsapp_campaign_runs_status_schedule on public.whatsapp_campaign_runs(status,scheduled_for);
create index idx_whatsapp_campaign_runs_version on public.whatsapp_campaign_runs(campaign_version_id,created_at desc);

create table public.whatsapp_campaign_recipients (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.whatsapp_campaign_runs(id) on delete restrict,
  contact_id uuid not null references public.contacts(id) on delete restrict,
  contact_channel_id uuid references public.contact_channels(id) on delete restrict,
  conversation_id uuid references public.whatsapp_conversations(id) on delete restrict,
  recipient_e164 text,
  template_parameters jsonb not null default '{}'::jsonb,
  state text not null,
  reason_code text,
  canonical_message_id uuid references public.whatsapp_messages(id) on delete restrict,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_whatsapp_campaign_recipient_e164 check (recipient_e164 is null or recipient_e164 ~ '^\+[1-9]\d{1,14}$'),
  constraint chk_whatsapp_campaign_recipient_channel_state check ((state='excluded') or (contact_channel_id is not null and recipient_e164 is not null)),
  constraint chk_whatsapp_campaign_recipient_parameters check (jsonb_typeof(template_parameters)='object' and pg_column_size(template_parameters)<=4096),
  constraint chk_whatsapp_campaign_recipient_state check (state in ('queued','excluded','sent','skipped','failed','needs_reconcile','cancelled')),
  constraint chk_whatsapp_campaign_recipient_reason check (reason_code is null or length(reason_code) between 1 and 80)
);
create unique index uq_whatsapp_campaign_recipient_contact on public.whatsapp_campaign_recipients(run_id,contact_id);
create unique index uq_whatsapp_campaign_recipient_channel on public.whatsapp_campaign_recipients(run_id,contact_channel_id) where contact_channel_id is not null;
create index idx_whatsapp_campaign_recipients_run_state on public.whatsapp_campaign_recipients(run_id,state);
create index idx_whatsapp_campaign_recipients_contact on public.whatsapp_campaign_recipients(contact_id,created_at desc);

create table public.whatsapp_campaign_dispatch_jobs (
  id uuid primary key default gen_random_uuid(),
  run_id uuid not null references public.whatsapp_campaign_runs(id) on delete restrict,
  recipient_id uuid not null unique references public.whatsapp_campaign_recipients(id) on delete restrict,
  state text not null default 'pending',
  attempt_count integer not null default 0,
  not_before timestamptz not null default now(),
  claim_token uuid,
  claimed_by text,
  claimed_at timestamptz,
  claim_expires_at timestamptz,
  provider_request_started_at timestamptz,
  phone_number_id uuid references public.whatsapp_phone_numbers(id) on delete restrict,
  sender_e164 text,
  provider_message_id text,
  last_error_code text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_whatsapp_campaign_job_state check (state in ('pending','claimed','succeeded','skipped','failed','needs_reconcile','cancelled')),
  constraint chk_whatsapp_campaign_job_attempts check (attempt_count between 0 and 3),
  constraint chk_whatsapp_campaign_job_claim check ((claim_token is null and claimed_by is null and claimed_at is null and claim_expires_at is null) or (claim_token is not null and claimed_by is not null and claimed_at is not null and claim_expires_at is not null and claim_expires_at>claimed_at)),
  constraint chk_whatsapp_campaign_job_claimed_state check ((state='claimed')=(claim_token is not null)),
  constraint chk_whatsapp_campaign_job_worker check (claimed_by is null or length(claimed_by) between 1 and 80),
  constraint chk_whatsapp_campaign_job_sender check (sender_e164 is null or sender_e164 ~ '^\+[1-9]\d{1,14}$'),
  constraint chk_whatsapp_campaign_job_provider_message check (provider_message_id is null or length(provider_message_id) between 1 and 128),
  constraint chk_whatsapp_campaign_job_error check (last_error_code is null or length(last_error_code) between 1 and 128)
);
create unique index uq_whatsapp_campaign_jobs_provider_message on public.whatsapp_campaign_dispatch_jobs(provider_message_id) where provider_message_id is not null;
create index idx_whatsapp_campaign_jobs_claim on public.whatsapp_campaign_dispatch_jobs(state,not_before,created_at) where state='pending';
create index idx_whatsapp_campaign_jobs_run_state on public.whatsapp_campaign_dispatch_jobs(run_id,state);
create index idx_whatsapp_campaign_jobs_expiry on public.whatsapp_campaign_dispatch_jobs(claim_expires_at) where state='claimed';

create table public.whatsapp_campaign_dispatch_events (
  id bigserial primary key,
  run_id uuid not null references public.whatsapp_campaign_runs(id) on delete restrict,
  job_id uuid references public.whatsapp_campaign_dispatch_jobs(id) on delete restrict,
  recipient_id uuid references public.whatsapp_campaign_recipients(id) on delete restrict,
  event_type text not null,
  from_state text,
  to_state text,
  attempt integer,
  actor_type text not null,
  actor_id uuid references public.profiles(id) on delete restrict,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default clock_timestamp(),
  created_at timestamptz not null default now(),
  constraint chk_whatsapp_campaign_event_type check (length(event_type) between 1 and 64),
  constraint chk_whatsapp_campaign_event_attempt check (attempt is null or attempt between 0 and 3),
  constraint chk_whatsapp_campaign_event_actor check (actor_type in ('worker','staff','system')),
  constraint chk_whatsapp_campaign_event_details check (jsonb_typeof(details)='object' and pg_column_size(details)<=8192)
);
create index idx_whatsapp_campaign_events_run_time on public.whatsapp_campaign_dispatch_events(run_id,occurred_at,id);
create index idx_whatsapp_campaign_events_job on public.whatsapp_campaign_dispatch_events(job_id,id) where job_id is not null;

create table public.whatsapp_message_campaign_attributions (
  id uuid primary key default gen_random_uuid(),
  whatsapp_message_id uuid not null unique references public.whatsapp_messages(id) on delete restrict,
  run_id uuid not null references public.whatsapp_campaign_runs(id) on delete restrict,
  recipient_id uuid not null unique references public.whatsapp_campaign_recipients(id) on delete restrict,
  campaign_version_id uuid not null references public.campaign_versions(id) on delete restrict,
  attribution_kind text not null default 'campaign_send',
  created_at timestamptz not null default now(),
  constraint chk_whatsapp_campaign_attribution_kind check (attribution_kind='campaign_send')
);
create index idx_whatsapp_campaign_attribution_run on public.whatsapp_message_campaign_attributions(run_id,created_at);

create table public.whatsapp_campaign_test_sends (
  id uuid primary key default gen_random_uuid(),
  campaign_version_id uuid not null references public.campaign_versions(id) on delete restrict,
  template_snapshot_id uuid not null references public.whatsapp_template_snapshots(id) on delete restrict,
  requested_by uuid not null references public.profiles(id) on delete restrict,
  destination_profile_id uuid not null references public.profiles(id) on delete restrict,
  destination_label text not null,
  destination_e164 text not null,
  template_parameters jsonb not null default '{}'::jsonb,
  outcome text not null default 'pending',
  claim_token uuid,
  claimed_at timestamptz,
  claim_expires_at timestamptz,
  provider_request_started_at timestamptz,
  phone_number_id uuid references public.whatsapp_phone_numbers(id) on delete restrict,
  provider_message_id text,
  last_error_code text,
  completed_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  constraint chk_whatsapp_campaign_test_label check (length(trim(destination_label)) between 1 and 120),
  constraint chk_whatsapp_campaign_test_e164 check (destination_e164 ~ '^\+[1-9]\d{1,14}$'),
  constraint chk_whatsapp_campaign_test_parameters check (jsonb_typeof(template_parameters)='object' and pg_column_size(template_parameters)<=4096),
  constraint chk_whatsapp_campaign_test_outcome check (outcome in ('pending','succeeded','failed','needs_reconcile','skipped')),
  constraint chk_whatsapp_campaign_test_claim check ((claim_token is null and claimed_at is null and claim_expires_at is null) or (outcome='pending' and claim_token is not null and claimed_at is not null and claim_expires_at>claimed_at)),
  constraint chk_whatsapp_campaign_test_completed check ((outcome='pending')=(completed_at is null)),
  constraint chk_whatsapp_campaign_test_provider_message check (provider_message_id is null or length(provider_message_id) between 1 and 128),
  constraint chk_whatsapp_campaign_test_error check (last_error_code is null or length(last_error_code) between 1 and 128)
);
create index idx_whatsapp_campaign_test_version on public.whatsapp_campaign_test_sends(campaign_version_id,created_at desc);
create index idx_whatsapp_campaign_test_pending on public.whatsapp_campaign_test_sends(created_at) where outcome='pending';

-- 3. Mutation/evidence guards.
create or replace function private.whatsapp_campaign_spec_guard()
returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception 'WHATSAPP_CAMPAIGN_SPEC_IMMUTABLE' using errcode='22023'; end if;
  if new.campaign_version_id is distinct from old.campaign_version_id or new.created_by is distinct from old.created_by or new.created_at is distinct from old.created_at then
    raise exception 'WHATSAPP_CAMPAIGN_SPEC_IMMUTABLE' using errcode='22023';
  end if;
  -- A frozen spec is what the approver approved. It never changes again.
  if old.state='frozen' then raise exception 'WHATSAPP_CAMPAIGN_SPEC_IMMUTABLE' using errcode='22023'; end if;
  new.updated_at:=now();
  return new;
end;$$;
revoke all on function private.whatsapp_campaign_spec_guard() from public,anon,authenticated;

create or replace function private.whatsapp_campaign_run_guard()
returns trigger language plpgsql set search_path='' as $$
begin
  if tg_op='DELETE' then raise exception 'WHATSAPP_CAMPAIGN_RUN_IMMUTABLE' using errcode='22023'; end if;
  if new.campaign_version_id is distinct from old.campaign_version_id or new.spec_id is distinct from old.spec_id
     or new.requested_by is distinct from old.requested_by or new.audience_rule_hash is distinct from old.audience_rule_hash
     or new.segment_rule_hash is distinct from old.segment_rule_hash or new.template_content_hash is distinct from old.template_content_hash
     or new.policy_version is distinct from old.policy_version or new.created_at is distinct from old.created_at then
    raise exception 'WHATSAPP_CAMPAIGN_RUN_IMMUTABLE' using errcode='22023';
  end if;
  if old.status in ('completed','cancelled','failed') and new.status is distinct from old.status then
    raise exception 'WHATSAPP_CAMPAIGN_RUN_TERMINAL' using errcode='22023';
  end if;
  new.updated_at:=now();
  return new;
end;$$;
revoke all on function private.whatsapp_campaign_run_guard() from public,anon,authenticated;

create trigger trg_whatsapp_campaign_specs_guard before update or delete on public.whatsapp_campaign_specs for each row execute function private.whatsapp_campaign_spec_guard();
create trigger trg_whatsapp_campaign_runs_guard before update or delete on public.whatsapp_campaign_runs for each row execute function private.whatsapp_campaign_run_guard();
create trigger trg_whatsapp_campaign_recipients_updated_at before update on public.whatsapp_campaign_recipients for each row execute function private.set_updated_at();
create trigger trg_whatsapp_campaign_jobs_updated_at before update on public.whatsapp_campaign_dispatch_jobs for each row execute function private.set_updated_at();
create trigger trg_whatsapp_campaign_tests_updated_at before update on public.whatsapp_campaign_test_sends for each row execute function private.set_updated_at();
create trigger trg_whatsapp_campaign_events_no_update before update on public.whatsapp_campaign_dispatch_events for each row execute function private.whatsapp_wm_append_only_guard();
create trigger trg_whatsapp_campaign_events_no_delete before delete on public.whatsapp_campaign_dispatch_events for each row execute function private.whatsapp_wm_append_only_guard();
create trigger trg_whatsapp_campaign_attribution_no_update before update on public.whatsapp_message_campaign_attributions for each row execute function private.whatsapp_wm_append_only_guard();
create trigger trg_whatsapp_campaign_attribution_no_delete before delete on public.whatsapp_message_campaign_attributions for each row execute function private.whatsapp_wm_append_only_guard();

-- 4. RLS: staff read through exact permission codes; all DML is RPC-only.
alter table public.whatsapp_campaign_specs enable row level security; alter table public.whatsapp_campaign_specs force row level security;
alter table public.whatsapp_campaign_runs enable row level security; alter table public.whatsapp_campaign_runs force row level security;
alter table public.whatsapp_campaign_recipients enable row level security; alter table public.whatsapp_campaign_recipients force row level security;
alter table public.whatsapp_campaign_dispatch_jobs enable row level security; alter table public.whatsapp_campaign_dispatch_jobs force row level security;
alter table public.whatsapp_campaign_dispatch_events enable row level security; alter table public.whatsapp_campaign_dispatch_events force row level security;
alter table public.whatsapp_message_campaign_attributions enable row level security; alter table public.whatsapp_message_campaign_attributions force row level security;
alter table public.whatsapp_campaign_test_sends enable row level security; alter table public.whatsapp_campaign_test_sends force row level security;

revoke all on table public.whatsapp_campaign_specs from public,anon,authenticated,service_role;
revoke all on table public.whatsapp_campaign_runs from public,anon,authenticated,service_role;
revoke all on table public.whatsapp_campaign_recipients from public,anon,authenticated,service_role;
revoke all on table public.whatsapp_campaign_dispatch_jobs from public,anon,authenticated,service_role;
revoke all on table public.whatsapp_campaign_dispatch_events from public,anon,authenticated,service_role;
revoke all on table public.whatsapp_message_campaign_attributions from public,anon,authenticated,service_role;
revoke all on table public.whatsapp_campaign_test_sends from public,anon,authenticated,service_role;
revoke all on sequence public.whatsapp_campaign_dispatch_events_id_seq from public,anon,authenticated,service_role;

grant select on public.whatsapp_campaign_specs,public.whatsapp_campaign_runs to authenticated;
grant select on public.whatsapp_campaign_recipients,public.whatsapp_campaign_dispatch_jobs,public.whatsapp_campaign_dispatch_events to authenticated;
grant select on public.whatsapp_campaign_test_sends to authenticated;
-- The worker only ever writes through the RPCs below; direct reads are enough for diagnostics.
grant select on public.whatsapp_campaign_specs,public.whatsapp_campaign_runs,public.whatsapp_campaign_recipients,public.whatsapp_campaign_dispatch_jobs,public.whatsapp_campaign_dispatch_events,public.whatsapp_message_campaign_attributions,public.whatsapp_campaign_test_sends to service_role;

create policy whatsapp_campaign_specs_staff_read on public.whatsapp_campaign_specs for select to authenticated
  using (private.has_permission('campaigns.read') or (state='frozen' and private.has_permission('whatsapp.campaigns.execute')));
create policy whatsapp_campaign_runs_staff_read on public.whatsapp_campaign_runs for select to authenticated
  using (private.has_permission('campaigns.read') or private.has_permission('whatsapp.campaigns.execute'));
create policy whatsapp_campaign_recipients_staff_read on public.whatsapp_campaign_recipients for select to authenticated using (private.has_permission('whatsapp.campaigns.execute'));
create policy whatsapp_campaign_jobs_staff_read on public.whatsapp_campaign_dispatch_jobs for select to authenticated using (private.has_permission('whatsapp.campaigns.execute'));
create policy whatsapp_campaign_events_staff_read on public.whatsapp_campaign_dispatch_events for select to authenticated using (private.has_permission('whatsapp.campaigns.execute'));
create policy whatsapp_campaign_tests_staff_read on public.whatsapp_campaign_test_sends for select to authenticated using (private.has_permission('whatsapp.campaigns.test_send'));
create policy whatsapp_campaign_specs_service_read on public.whatsapp_campaign_specs for select to service_role using (true);
create policy whatsapp_campaign_runs_service_read on public.whatsapp_campaign_runs for select to service_role using (true);
create policy whatsapp_campaign_recipients_service_read on public.whatsapp_campaign_recipients for select to service_role using (true);
create policy whatsapp_campaign_jobs_service_read on public.whatsapp_campaign_dispatch_jobs for select to service_role using (true);
create policy whatsapp_campaign_events_service_read on public.whatsapp_campaign_dispatch_events for select to service_role using (true);
create policy whatsapp_campaign_attribution_service_read on public.whatsapp_message_campaign_attributions for select to service_role using (true);
create policy whatsapp_campaign_tests_service_read on public.whatsapp_campaign_test_sends for select to service_role using (true);

-- 5. Private helpers.
create or replace function private.whatsapp_campaign_require_service_role()
returns void language plpgsql stable set search_path='' as $$
begin
  -- NULL is not service_role: fail closed for any caller without a service JWT.
  if coalesce(auth.role(),'')<>'service_role' then raise exception 'WHATSAPP_SERVICE_ROLE_REQUIRED' using errcode='42501'; end if;
end;$$;
revoke all on function private.whatsapp_campaign_require_service_role() from public,anon,authenticated;

/*
 * Whether the caller may see a WhatsApp-only campaign version with this status.
 * Generic campaigns.read sees every WhatsApp version; whatsapp.campaigns.execute
 * alone sees only approved ones, which is all an operator can act on.
 */
create or replace function private.whatsapp_campaign_version_visible(p_status text)
returns boolean language sql stable security definer set search_path='' as $$
  select auth.uid() is not null and (
    private.has_permission('campaigns.read')
    or (p_status='approved' and private.has_permission('whatsapp.campaigns.execute'))
  );
$$;
revoke all on function private.whatsapp_campaign_version_visible(text) from public,anon,authenticated;

create or replace function private.whatsapp_campaign_actor_has_role(p_actor_id uuid,p_role text)
returns boolean language sql stable security definer set search_path='' as $$
  select p_actor_id is not null and exists(
    select 1 from public.user_roles ur join public.roles r on r.id=ur.role_id join public.profiles p on p.id=ur.user_id
    where ur.user_id=p_actor_id and r.code=p_role and r.is_active=true and p.status='active'
  );
$$;
revoke all on function private.whatsapp_campaign_actor_has_role(uuid,text) from public,anon,authenticated;

/*
 * ADR-0034 §J.1, locked: Super Admin may operate any approved version; a Sales
 * Manager only one they did not approve. Every other role is refused, even
 * holding a code by mistake. Null means allowed.
 */
create or replace function private.whatsapp_campaign_operator_denial(p_actor_id uuid,p_campaign_version_id uuid)
returns text language plpgsql stable security definer set search_path='' as $$
begin
  if private.whatsapp_campaign_actor_has_role(p_actor_id,'super_admin') then return null; end if;
  if not private.whatsapp_campaign_actor_has_role(p_actor_id,'sales_manager') then return 'role_not_authorised'; end if;
  if exists(select 1 from public.campaign_approvals a where a.campaign_version_id=p_campaign_version_id and a.decision='approved' and a.decided_by=p_actor_id) then
    return 'approved_by_actor';
  end if;
  return null;
end;$$;
revoke all on function private.whatsapp_campaign_operator_denial(uuid,uuid) from public,anon,authenticated;

create or replace function private.whatsapp_campaign_raise_operator_denial(p_actor_id uuid,p_campaign_version_id uuid)
returns void language plpgsql stable security definer set search_path='' as $$
declare v_denial text:=private.whatsapp_campaign_operator_denial(p_actor_id,p_campaign_version_id);
begin
  if v_denial='approved_by_actor' then raise exception 'WHATSAPP_CAMPAIGN_APPROVER_CANNOT_EXECUTE' using errcode='42501'; end if;
  if v_denial is not null then raise exception 'WHATSAPP_CAMPAIGN_EXECUTE_DENIED' using errcode='42501'; end if;
end;$$;
revoke all on function private.whatsapp_campaign_raise_operator_denial(uuid,uuid) from public,anon,authenticated;

/* Why a snapshot cannot be sent as a campaign template now, or null. */
create or replace function private.whatsapp_campaign_template_problem(p_snapshot_id uuid,p_expected_hash text default null)
returns text language plpgsql stable security definer set search_path='' as $$
declare s public.whatsapp_template_snapshots%rowtype; t public.whatsapp_templates%rowtype; v_problem text;
begin
  select * into s from public.whatsapp_template_snapshots where id=p_snapshot_id;
  if not found then return 'template_snapshot_not_found'; end if;
  if s.observed_status<>'APPROVED' then return 'template_not_approved'; end if;
  if s.category<>'MARKETING' then return 'template_category_not_marketing'; end if;
  select * into t from public.whatsapp_templates where id=s.template_id;
  if not found or t.status<>'APPROVED' then return 'template_not_approved'; end if;
  if t.category<>'MARKETING' then return 'template_category_not_marketing'; end if;
  if t.content_hash is distinct from s.content_hash or (p_expected_hash is not null and s.content_hash is distinct from p_expected_hash) then return 'template_content_changed'; end if;
  v_problem:=private.whatsapp_template_staff_send_problem(s.components,s.parameter_format);
  if v_problem is not null then return 'template_'||v_problem; end if;
  return null;
end;$$;
revoke all on function private.whatsapp_campaign_template_problem(uuid,text) from public,anon,authenticated;

create or replace function private.whatsapp_campaign_bindings_problem(p_components jsonb,p_bindings jsonb)
returns text language plpgsql stable set search_path='' as $$
declare c record; k record;
begin
  if p_bindings is null or jsonb_typeof(p_bindings)<>'object' or pg_column_size(p_bindings)>2048 then return 'bindings_invalid'; end if;
  for c in select e.key,e.value from jsonb_each(p_bindings) e loop
    if c.key not in ('header','body') or jsonb_typeof(c.value)<>'object' then return 'bindings_invalid'; end if;
    for k in select e.key,e.value from jsonb_each(c.value) e loop
      if jsonb_typeof(k.value)<>'string' or (k.value#>>'{}') not in ('contact_first_name','contact_display_name') then return 'bindings_invalid'; end if;
      if not exists(select 1 from private.whatsapp_template_variable_keys(p_components) vk where vk.component=c.key and vk.key=k.key) then return 'bindings_unexpected_key'; end if;
    end loop;
  end loop;
  return null;
end;$$;
revoke all on function private.whatsapp_campaign_bindings_problem(jsonb,jsonb) from public,anon,authenticated;

/*
 * Static values overlaid with per-recipient CRM values. An empty resolved value
 * removes the key, so the template parameter check reports it as missing and
 * the recipient is excluded rather than sent a blank.
 */
create or replace function private.whatsapp_campaign_resolve_parameters(p_defaults jsonb,p_bindings jsonb,p_display_name text)
returns jsonb language plpgsql immutable set search_path='' as $$
declare v_out jsonb; v_name text; v_component text; v_key text; v_source text; v_value text; v_part jsonb;
begin
  v_out:=case when jsonb_typeof(p_defaults)='object' then p_defaults else '{}'::jsonb end;
  v_name:=nullif(regexp_replace(trim(coalesce(p_display_name,'')),'\s+',' ','g'),'');
  for v_component,v_key,v_source in
    select c.key,k.key,k.value#>>'{}'
    from jsonb_each(case when jsonb_typeof(p_bindings)='object' then p_bindings else '{}'::jsonb end) c
    cross join lateral jsonb_each(case when jsonb_typeof(c.value)='object' then c.value else '{}'::jsonb end) k
  loop
    v_value:=case v_source when 'contact_first_name' then split_part(v_name,' ',1) when 'contact_display_name' then left(v_name,60) else null end;
    v_part:=case when jsonb_typeof(v_out->v_component)='object' then v_out->v_component else '{}'::jsonb end;
    if v_value is null or v_value='' then v_part:=v_part-v_key; else v_part:=v_part||jsonb_build_object(v_key,v_value); end if;
    v_out:=jsonb_set(v_out,array[v_component],v_part,true);
  end loop;
  return v_out;
end;$$;
revoke all on function private.whatsapp_campaign_resolve_parameters(jsonb,jsonb,text) from public,anon,authenticated;

create or replace function private.whatsapp_campaign_spec_problem(
  p_campaign_version_id uuid,p_template_snapshot_id uuid,p_default_parameters jsonb,p_parameter_bindings jsonb
)
returns text language plpgsql stable security definer set search_path='' as $$
declare v_version public.campaign_versions%rowtype; v_snapshot public.whatsapp_template_snapshots%rowtype; v_problem text;
begin
  select * into v_version from public.campaign_versions where id=p_campaign_version_id;
  if not found then return 'version_not_found'; end if;
  if v_version.targeting_mode<>'direct_or_custom' or v_version.intended_channels is distinct from array['whatsapp']::text[] then return 'version_not_whatsapp_only'; end if;
  v_problem:=private.whatsapp_campaign_template_problem(p_template_snapshot_id,null);
  if v_problem is not null then return v_problem; end if;
  select * into v_snapshot from public.whatsapp_template_snapshots where id=p_template_snapshot_id;
  v_problem:=private.whatsapp_campaign_bindings_problem(v_snapshot.components,coalesce(p_parameter_bindings,'{}'::jsonb));
  if v_problem is not null then return v_problem; end if;
  -- Every variable must be covered by a static value or a binding.
  v_problem:=private.whatsapp_template_parameters_problem(
    v_snapshot.components,
    private.whatsapp_campaign_resolve_parameters(coalesce(p_default_parameters,'{}'::jsonb),coalesce(p_parameter_bindings,'{}'::jsonb),'Sample Customer')
  );
  if v_problem is not null then return v_problem; end if;
  return null;
end;$$;
revoke all on function private.whatsapp_campaign_spec_problem(uuid,uuid,jsonb,jsonb) from public,anon,authenticated;

create or replace function private.whatsapp_campaign_append_event(
  p_run_id uuid,p_job_id uuid,p_recipient_id uuid,p_event_type text,
  p_from_state text,p_to_state text,p_attempt integer,p_actor_type text,p_actor_id uuid,p_details jsonb default '{}'::jsonb
)
returns void language sql volatile security definer set search_path='' as $$
  insert into public.whatsapp_campaign_dispatch_events(run_id,job_id,recipient_id,event_type,from_state,to_state,attempt,actor_type,actor_id,details)
  values(p_run_id,p_job_id,p_recipient_id,left(p_event_type,64),p_from_state,p_to_state,p_attempt,p_actor_type,p_actor_id,coalesce(p_details,'{}'::jsonb));
$$;
revoke all on function private.whatsapp_campaign_append_event(uuid,uuid,uuid,text,text,text,integer,text,uuid,jsonb) from public,anon,authenticated;

create or replace function private.whatsapp_campaign_latest_policy()
returns setof public.whatsapp_marketing_send_policies
language sql stable security definer set search_path='' as $$
  select p.* from public.whatsapp_marketing_send_policies p where p.effective_from<=now() order by p.effective_from desc,p.version desc limit 1;
$$;
revoke all on function private.whatsapp_campaign_latest_policy() from public,anon,authenticated;

/* End of the current quiet window in the policy timezone, or null outside it. */
create or replace function private.whatsapp_campaign_quiet_until(p_policy public.whatsapp_marketing_send_policies,p_at timestamptz default clock_timestamp())
returns timestamptz language plpgsql stable security definer set search_path='' as $$
declare local_now timestamp; local_time time; start_t time; end_t time; end_local timestamp;
begin
  begin
    local_now:=p_at at time zone p_policy.timezone;
    start_t:=(p_policy.quiet_hours->>'startLocal')::time;
    end_t:=(p_policy.quiet_hours->>'endLocal')::time;
  exception when others then
    -- An unreadable window is treated as quiet: defer, never send.
    return p_at+interval '1 hour';
  end;
  if start_t is null or end_t is null then return p_at+interval '1 hour'; end if;
  local_time:=local_now::time;
  if start_t<end_t then
    if local_time>=start_t and local_time<end_t then end_local:=local_now::date+end_t; else return null; end if;
  else
    if local_time>=start_t then end_local:=(local_now::date+1)+end_t;
    elsif local_time<end_t then end_local:=local_now::date+end_t;
    else return null; end if;
  end if;
  return end_local at time zone p_policy.timezone;
end;$$;
revoke all on function private.whatsapp_campaign_quiet_until(public.whatsapp_marketing_send_policies,timestamptz) from public,anon,authenticated;

/*
 * Rolling caps over every governed marketing send to the contact: bound
 * campaign messages plus provider requests that are in flight or unresolved,
 * so two concurrent runs cannot both slip under a cap.
 */
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
    into n;
    if n>=mx then return true; end if;
  end loop;
  return false;
exception when others then return true;
end;$$;
revoke all on function private.whatsapp_campaign_frequency_capped(uuid,public.whatsapp_marketing_send_policies,timestamptz) from public,anon,authenticated;

/* Contacts matched by the frozen campaign rule, narrowed by an optional segment. Tombstoned leads never match. */
create or replace function private.whatsapp_campaign_audience_contact_ids(p_rule jsonb,p_segment_rules jsonb)
returns table(contact_id uuid) language sql stable security definer set search_path='' as $$
  select m.contact_id
  from (
    select distinct l.contact_id
    from public.leads l
    left join public.lead_sources ls on ls.id=l.primary_source_id
    where l.deleted_at is null and l.contact_id is not null
      and private.campaign_rule_group_matches_lead(p_rule,ls.code,l.status,l.service_code,l.locality)
  ) m
  where p_segment_rules is null or private.whatsapp_contact_matches_segment(m.contact_id,p_segment_rules);
$$;
revoke all on function private.whatsapp_campaign_audience_contact_ids(jsonb,jsonb) from public,anon,authenticated;

/*
 * Contact-scope preflight in WM-0 precedence (§8.1 steps 5-9). Returns the
 * first failing reason, or null, with the channel and resolved parameters.
 */
create or replace function private.whatsapp_campaign_evaluate_contact(
  p_contact_id uuid,p_preference_category text,p_components jsonb,p_defaults jsonb,p_bindings jsonb
)
returns table(o_reason text,o_channel_id uuid,o_e164 text,o_parameters jsonb)
language plpgsql stable security definer set search_path='' as $$
declare c public.contacts%rowtype; v_channel uuid; v_e164 text; v_status text; v_consent text; v_params jsonb; v_problem text;
begin
  select * into c from public.contacts where id=p_contact_id;
  if not found then return query select 'contact_missing'::text,null::uuid,null::text,'{}'::jsonb; return; end if;
  if c.status='do_not_contact' then return query select 'contact_do_not_contact'::text,null::uuid,null::text,'{}'::jsonb; return; end if;
  if c.status<>'active' then return query select 'contact_inactive'::text,null::uuid,null::text,'{}'::jsonb; return; end if;
  select ch.id,ch.address_normalized,ch.status into v_channel,v_e164,v_status
  from public.contact_channels ch
  where ch.contact_id=c.id and ch.channel_type='whatsapp'
  order by (ch.status='active') desc,ch.is_primary desc,ch.created_at desc,ch.id
  limit 1;
  if v_channel is null then return query select 'whatsapp_channel_missing'::text,null::uuid,null::text,'{}'::jsonb; return; end if;
  if v_status='suppressed' then return query select 'channel_suppressed'::text,v_channel,null::text,'{}'::jsonb; return; end if;
  if v_status='invalid' then return query select 'channel_invalid'::text,v_channel,null::text,'{}'::jsonb; return; end if;
  if v_status<>'active' then return query select 'channel_inactive'::text,v_channel,null::text,'{}'::jsonb; return; end if;
  v_consent:=private.whatsapp_latest_marketing_consent(c.id);
  if v_consent is distinct from 'granted' then
    return query select case v_consent when 'withdrawn' then 'marketing_consent_withdrawn' when 'suppressed' then 'marketing_consent_suppressed'
      when 'expired' then 'marketing_consent_expired' else 'marketing_consent_missing' end,v_channel,null::text,'{}'::jsonb;
    return;
  end if;
  if private.whatsapp_preference_opted_out(c.id,p_preference_category) then return query select 'preference_opted_out'::text,v_channel,null::text,'{}'::jsonb; return; end if;
  v_params:=private.whatsapp_campaign_resolve_parameters(p_defaults,p_bindings,c.display_name);
  v_problem:=private.whatsapp_template_parameters_problem(p_components,v_params);
  if v_problem is not null then
    return query select case when v_problem='parameters_missing' then 'variables_missing' else 'variables_invalid' end,v_channel,null::text,'{}'::jsonb;
    return;
  end if;
  return query select null::text,v_channel,v_e164,v_params;
end;$$;
revoke all on function private.whatsapp_campaign_evaluate_contact(uuid,text,jsonb,jsonb,jsonb) from public,anon,authenticated;

create or replace function private.whatsapp_campaign_refresh_run(p_run_id uuid)
returns void language plpgsql volatile security definer set search_path='' as $$
declare r public.whatsapp_campaign_runs%rowtype; v_pending integer; v_claimed integer; v_reconcile integer;
begin
  select * into r from public.whatsapp_campaign_runs where id=p_run_id for update;
  if not found or r.status in ('completed','cancelled','failed') then return; end if;
  update public.whatsapp_campaign_runs set
    total_count=(select count(*) from public.whatsapp_campaign_recipients where run_id=p_run_id),
    eligible_count=(select count(*) from public.whatsapp_campaign_recipients where run_id=p_run_id and state<>'excluded'),
    excluded_count=(select count(*) from public.whatsapp_campaign_recipients where run_id=p_run_id and state='excluded'),
    sent_count=(select count(*) from public.whatsapp_campaign_recipients where run_id=p_run_id and state='sent'),
    skipped_count=(select count(*) from public.whatsapp_campaign_recipients where run_id=p_run_id and state='skipped'),
    failed_count=(select count(*) from public.whatsapp_campaign_recipients where run_id=p_run_id and state='failed'),
    reconcile_count=(select count(*) from public.whatsapp_campaign_recipients where run_id=p_run_id and state='needs_reconcile')
  where id=p_run_id;
  if r.status not in ('dispatching','reconciling') then return; end if;
  select count(*) filter(where state='pending'),count(*) filter(where state='claimed'),count(*) filter(where state='needs_reconcile')
  into v_pending,v_claimed,v_reconcile from public.whatsapp_campaign_dispatch_jobs where run_id=p_run_id;
  if coalesce(v_pending,0)=0 and coalesce(v_claimed,0)=0 then
    if coalesce(v_reconcile,0)>0 then
      if r.status='dispatching' then
        update public.whatsapp_campaign_runs set status='reconciling' where id=p_run_id;
        perform private.whatsapp_campaign_append_event(p_run_id,null,null,'run_reconciling','dispatching','reconciling',null,'system',null,jsonb_build_object('needs_reconcile',v_reconcile));
      end if;
    else
      update public.whatsapp_campaign_runs set status='completed',completed_at=coalesce(completed_at,clock_timestamp()) where id=p_run_id;
      perform private.whatsapp_campaign_append_event(p_run_id,null,null,'run_completed',r.status,'completed',null,'system',null,'{}'::jsonb);
    end if;
  end if;
end;$$;
revoke all on function private.whatsapp_campaign_refresh_run(uuid) from public,anon,authenticated;

-- 6. Spec authoring and freeze integration with generic campaign governance.
create or replace function public.save_whatsapp_campaign_spec(
  p_campaign_version_id uuid,
  p_template_snapshot_id uuid,
  p_preference_category text,
  p_default_parameters jsonb default '{}'::jsonb,
  p_parameter_bindings jsonb default '{}'::jsonb,
  p_segment_id uuid default null
)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  v_actor uuid:=auth.uid();
  v_version public.campaign_versions%rowtype;
  v_segment public.whatsapp_segments%rowtype;
  v_existing public.whatsapp_campaign_specs%rowtype;
  v_problem text;
  v_id uuid;
begin
  if v_actor is null or not private.has_permission('campaigns.draft') or not private.has_permission('whatsapp.templates.read') then
    raise exception 'WHATSAPP_CAMPAIGN_SPEC_DENIED' using errcode='42501';
  end if;
  if p_segment_id is not null and not private.has_permission('whatsapp.segments.read') then
    raise exception 'WHATSAPP_CAMPAIGN_SPEC_DENIED' using errcode='42501';
  end if;
  select * into v_version from public.campaign_versions where id=p_campaign_version_id for update;
  if not found then raise exception 'WHATSAPP_CAMPAIGN_NOT_FOUND' using errcode='P0002'; end if;
  if v_version.status<>'draft' then raise exception 'WHATSAPP_CAMPAIGN_SPEC_FROZEN' using errcode='22023'; end if;
  if p_preference_category is null or p_preference_category not in ('design_inspiration','offers','project_updates','referral','educational_content') then
    raise exception 'WHATSAPP_CAMPAIGN_SPEC_VALIDATION' using errcode='22023';
  end if;
  v_problem:=private.whatsapp_campaign_spec_problem(p_campaign_version_id,p_template_snapshot_id,coalesce(p_default_parameters,'{}'::jsonb),coalesce(p_parameter_bindings,'{}'::jsonb));
  if v_problem is not null then raise exception 'WHATSAPP_CAMPAIGN_SPEC_INVALID: %',v_problem using errcode='22023'; end if;
  if p_segment_id is not null then
    select * into v_segment from public.whatsapp_segments where id=p_segment_id and is_active=true;
    if not found then raise exception 'WHATSAPP_SEGMENT_NOT_FOUND' using errcode='P0002'; end if;
    if not private.whatsapp_segment_rule_group_valid(v_segment.rule_group) then raise exception 'WHATSAPP_CAMPAIGN_SPEC_INVALID: segment_rules_invalid' using errcode='22023'; end if;
  end if;

  select * into v_existing from public.whatsapp_campaign_specs where campaign_version_id=p_campaign_version_id for update;
  if found then
    if v_existing.state<>'draft' then raise exception 'WHATSAPP_CAMPAIGN_SPEC_FROZEN' using errcode='22023'; end if;
    update public.whatsapp_campaign_specs set
      template_snapshot_id=p_template_snapshot_id,
      preference_category=p_preference_category,
      default_parameters=coalesce(p_default_parameters,'{}'::jsonb),
      parameter_bindings=coalesce(p_parameter_bindings,'{}'::jsonb),
      segment_id=v_segment.id,
      segment_name=v_segment.name,
      segment_rule_group=v_segment.rule_group,
      segment_rule_hash=case when v_segment.id is null then null else private.marketing_sha256(v_segment.rule_group::text) end,
      updated_by=v_actor
    where id=v_existing.id
    returning id into v_id;
  else
    insert into public.whatsapp_campaign_specs(
      campaign_version_id,template_snapshot_id,preference_category,default_parameters,parameter_bindings,
      segment_id,segment_name,segment_rule_group,segment_rule_hash,state,created_by,updated_by
    ) values (
      p_campaign_version_id,p_template_snapshot_id,p_preference_category,coalesce(p_default_parameters,'{}'::jsonb),coalesce(p_parameter_bindings,'{}'::jsonb),
      v_segment.id,v_segment.name,v_segment.rule_group,
      case when v_segment.id is null then null else private.marketing_sha256(v_segment.rule_group::text) end,
      'draft',v_actor,v_actor
    ) returning id into v_id;
  end if;
  return jsonb_build_object('spec_id',v_id,'campaign_version_id',p_campaign_version_id,'state','draft');
end;$$;
revoke all on function public.save_whatsapp_campaign_spec(uuid,uuid,text,jsonb,jsonb,uuid) from public,anon;
grant execute on function public.save_whatsapp_campaign_spec(uuid,uuid,text,jsonb,jsonb,uuid) to authenticated;

create or replace function private.whatsapp_campaign_freeze_spec_on_submission()
returns trigger language plpgsql security definer set search_path='' as $$
declare v_spec public.whatsapp_campaign_specs%rowtype; v_problem text;
begin
  if old.status='draft' and new.status='pending_approval' and new.intended_channels=array['whatsapp']::text[] then
    select * into v_spec from public.whatsapp_campaign_specs where campaign_version_id=new.id for update;
    if not found then raise exception 'WHATSAPP_CAMPAIGN_SPEC_REQUIRED' using errcode='22023'; end if;
    if v_spec.state<>'draft' then raise exception 'WHATSAPP_CAMPAIGN_SPEC_ALREADY_FROZEN' using errcode='22023'; end if;
    v_problem:=private.whatsapp_campaign_spec_problem(new.id,v_spec.template_snapshot_id,v_spec.default_parameters,v_spec.parameter_bindings);
    if v_problem is null and v_spec.segment_id is not null and not private.whatsapp_segment_rule_group_valid(v_spec.segment_rule_group) then v_problem:='segment_rules_invalid'; end if;
    if v_problem is not null then raise exception 'WHATSAPP_CAMPAIGN_SPEC_INVALID: %',v_problem using errcode='22023'; end if;
    update public.whatsapp_campaign_specs set state='frozen',frozen_at=clock_timestamp(),frozen_by=new.requested_by,updated_by=new.requested_by where id=v_spec.id;
  end if;
  return new;
end;$$;
revoke all on function private.whatsapp_campaign_freeze_spec_on_submission() from public,anon,authenticated;
create trigger trg_whatsapp_campaign_freeze_spec before update of status on public.campaign_versions for each row execute function private.whatsapp_campaign_freeze_spec_on_submission();

/* Approved, currently sendable MARKETING snapshots a campaign may bind to. */
create or replace function public.list_whatsapp_campaign_template_options()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.has_permission('campaigns.draft') or not private.has_permission('whatsapp.templates.read') then
    raise exception 'WHATSAPP_CAMPAIGN_DENIED' using errcode='42501';
  end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object(
      'snapshot_id',s.id,'template_id',s.template_id,'name',s.name,'language',s.language,
      'parameter_format',s.parameter_format,'components',s.components,'quality_rating',t.quality_rating,'captured_at',s.captured_at
    ) order by s.name,s.language)
    from public.whatsapp_template_snapshots s
    join public.whatsapp_templates t on t.id=s.template_id and t.content_hash=s.content_hash
    where s.category='MARKETING' and private.whatsapp_campaign_template_problem(s.id,null) is null
  ),'[]'::jsonb);
end;$$;
revoke all on function public.list_whatsapp_campaign_template_options() from public,anon;
grant execute on function public.list_whatsapp_campaign_template_options() to authenticated;

/* Counts only, in WM-0 precedence; never a recipient list. */
create or replace function public.preview_whatsapp_campaign_audience(p_campaign_version_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  v_spec public.whatsapp_campaign_specs%rowtype;
  v_snapshot public.whatsapp_template_snapshots%rowtype;
  v_policy public.whatsapp_marketing_send_policies%rowtype;
  v_has_policy boolean;
  v_rule jsonb;
  v_rule_frozen boolean;
  v_reasons jsonb:='{}'::jsonb;
  v_total integer:=0;
  v_eligible integer:=0;
  v_reason text;
  v_live_hash text;
  rec record;
begin
  if auth.uid() is null or not exists(
    select 1 from public.campaign_versions v where v.id=p_campaign_version_id and v.intended_channels=array['whatsapp']::text[]
      and private.whatsapp_campaign_version_visible(v.status)
  ) then raise exception 'WHATSAPP_CAMPAIGN_DENIED' using errcode='42501'; end if;
  select * into v_spec from public.whatsapp_campaign_specs where campaign_version_id=p_campaign_version_id;
  if not found then raise exception 'WHATSAPP_CAMPAIGN_SPEC_REQUIRED' using errcode='P0002'; end if;
  select r.rule_group,r.frozen_at is not null into v_rule,v_rule_frozen from public.campaign_audience_rule_versions r where r.campaign_version_id=p_campaign_version_id;
  if v_rule is null then raise exception 'WHATSAPP_CAMPAIGN_AUDIENCE_REQUIRED' using errcode='P0002'; end if;
  select * into v_snapshot from public.whatsapp_template_snapshots where id=v_spec.template_snapshot_id;
  select * into v_policy from private.whatsapp_campaign_latest_policy();
  v_has_policy:=found;

  for rec in
    select a.contact_id,e.o_reason
    from private.whatsapp_campaign_audience_contact_ids(v_rule,v_spec.segment_rule_group) a
    cross join lateral private.whatsapp_campaign_evaluate_contact(a.contact_id,v_spec.preference_category,v_snapshot.components,v_spec.default_parameters,v_spec.parameter_bindings) e
  loop
    v_total:=v_total+1;
    v_reason:=rec.o_reason;
    if v_reason is null and not v_has_policy then v_reason:='send_policy_unconfigured';
    elsif v_reason is null and private.whatsapp_campaign_frequency_capped(rec.contact_id,v_policy,clock_timestamp()) then v_reason:='frequency_capped';
    end if;
    if v_reason is null then
      v_eligible:=v_eligible+1;
    else
      v_reasons:=jsonb_set(v_reasons,array[v_reason],to_jsonb(coalesce((v_reasons->>v_reason)::integer,0)+1),true);
    end if;
  end loop;

  if v_spec.segment_id is not null then
    select private.marketing_sha256(s.rule_group::text) into v_live_hash from public.whatsapp_segments s where s.id=v_spec.segment_id and s.is_active=true;
  end if;

  return jsonb_build_object(
    'campaign_version_id',p_campaign_version_id,
    'total_matched',v_total,
    'eligible',v_eligible,
    'reasons',v_reasons,
    'audience_rule_frozen',coalesce(v_rule_frozen,false),
    'segment_changed_since_saved',v_spec.segment_id is not null and v_live_hash is distinct from v_spec.segment_rule_hash,
    'template_problem',private.whatsapp_campaign_template_problem(v_spec.template_snapshot_id,null),
    'policy_configured',v_has_policy,
    'policy_version',case when v_has_policy then v_policy.version end,
    'execution_enabled',coalesce(v_has_policy and v_policy.execution_enabled,false),
    'quiet_until',case when v_has_policy then private.whatsapp_campaign_quiet_until(v_policy,clock_timestamp()) end,
    'evaluated_at',clock_timestamp()
  );
end;$$;
revoke all on function public.preview_whatsapp_campaign_audience(uuid) from public,anon;
grant execute on function public.preview_whatsapp_campaign_audience(uuid) to authenticated;

/*
 * The WhatsApp campaign workspace read model. Only WhatsApp-only versions, and
 * for an operator without generic campaigns.read only approved ones: the
 * generic campaign tables stay closed to them.
 */
create or replace function private.whatsapp_campaign_run_json(r public.whatsapp_campaign_runs)
returns jsonb language sql stable security definer set search_path='' as $$
  select jsonb_build_object(
    'id',r.id,'campaign_version_id',r.campaign_version_id,'status',r.status,'scheduled_for',r.scheduled_for,'auto_start',r.auto_start,
    'requested_by_me',r.requested_by=auth.uid(),'started_at',r.started_at,'completed_at',r.completed_at,'failure_code',r.failure_code,
    'policy_version',r.policy_version,'total_count',r.total_count,'eligible_count',r.eligible_count,'excluded_count',r.excluded_count,
    'sent_count',r.sent_count,'skipped_count',r.skipped_count,'failed_count',r.failed_count,'reconcile_count',r.reconcile_count,
    'created_at',r.created_at,'updated_at',r.updated_at
  );
$$;
revoke all on function private.whatsapp_campaign_run_json(public.whatsapp_campaign_runs) from public,anon,authenticated;

create or replace function public.list_whatsapp_campaign_versions()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not (private.has_permission('campaigns.read') or private.has_permission('whatsapp.campaigns.execute')) then
    raise exception 'WHATSAPP_CAMPAIGN_DENIED' using errcode='42501';
  end if;
  return coalesce((
    select jsonb_agg(x.item order by x.sort_at desc)
    from (
      select v.updated_at as sort_at, jsonb_build_object(
        'campaign_id',c.id,'campaign_reference',c.campaign_reference,'campaign_name',c.name,
        'version_id',v.id,'version_number',v.version_number,'title',v.title,'status',v.status,'updated_at',v.updated_at,
        'spec_state',s.state,'template_name',snap.name,'segment_name',s.segment_name,
        'latest_run',(select private.whatsapp_campaign_run_json(r) from public.whatsapp_campaign_runs r where r.campaign_version_id=v.id order by r.created_at desc limit 1)
      ) as item
      from public.campaign_versions v
      join public.campaigns c on c.id=v.campaign_id
      left join public.whatsapp_campaign_specs s on s.campaign_version_id=v.id
      left join public.whatsapp_template_snapshots snap on snap.id=s.template_snapshot_id
      where v.intended_channels=array['whatsapp']::text[] and v.targeting_mode='direct_or_custom'
        and private.whatsapp_campaign_version_visible(v.status)
      order by v.updated_at desc
      limit 200
    ) x
  ),'[]'::jsonb);
end;$$;
revoke all on function public.list_whatsapp_campaign_versions() from public,anon;
grant execute on function public.list_whatsapp_campaign_versions() to authenticated;

create or replace function public.get_whatsapp_campaign_version(p_campaign_version_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
declare
  a uuid:=auth.uid(); v public.campaign_versions%rowtype; c public.campaigns%rowtype; ar public.campaign_audience_rule_versions%rowtype;
  ap public.campaign_approvals%rowtype; s public.whatsapp_campaign_specs%rowtype; snap public.whatsapp_template_snapshots%rowtype;
  prev public.whatsapp_campaign_specs%rowtype; v_has_approval boolean; v_has_spec boolean; v_has_prev boolean;
begin
  if a is null or not (private.has_permission('campaigns.read') or private.has_permission('whatsapp.campaigns.execute')) then
    raise exception 'WHATSAPP_CAMPAIGN_DENIED' using errcode='42501';
  end if;
  select * into v from public.campaign_versions where id=p_campaign_version_id;
  -- Invisible and nonexistent answer the same.
  if not found or v.intended_channels is distinct from array['whatsapp']::text[] or not private.whatsapp_campaign_version_visible(v.status) then
    raise exception 'WHATSAPP_CAMPAIGN_NOT_FOUND' using errcode='P0002';
  end if;
  select * into c from public.campaigns where id=v.campaign_id;
  select * into ar from public.campaign_audience_rule_versions where campaign_version_id=v.id;
  select * into ap from public.campaign_approvals where campaign_version_id=v.id;
  v_has_approval:=found;
  select * into s from public.whatsapp_campaign_specs where campaign_version_id=v.id;
  v_has_spec:=found;
  if v_has_spec then select * into snap from public.whatsapp_template_snapshots where id=s.template_snapshot_id; end if;
  if not v_has_spec and v.status='draft' then
    select ps.* into prev from public.whatsapp_campaign_specs ps join public.campaign_versions pv on pv.id=ps.campaign_version_id
    where pv.campaign_id=v.campaign_id and pv.version_number<v.version_number order by pv.version_number desc limit 1;
    v_has_prev:=found;
  end if;
  return jsonb_build_object(
    'campaign',jsonb_build_object('id',c.id,'reference',c.campaign_reference,'name',c.name),
    'version',jsonb_build_object('id',v.id,'number',v.version_number,'title',v.title,'status',v.status,'targeting_mode',v.targeting_mode,
      'lock_version',v.lock_version,'created_by_me',v.created_by=a,'requested_by_me',v.requested_by=a,'requested_at',v.requested_at,
      'frozen_at',v.frozen_at,'configuration_hash',v.configuration_hash,'intended_window',v.intended_window_snapshot,'updated_at',v.updated_at),
    'audience',jsonb_build_object('rule_group',ar.rule_group,'rule_hash',ar.rule_hash,'frozen',ar.frozen_at is not null),
    'approval',case when v_has_approval then jsonb_build_object('decision',ap.decision,'decided_at',ap.decided_at,'reason',ap.reason,'decided_by_me',ap.decided_by=a) end,
    'spec',case when v_has_spec then jsonb_build_object(
      'id',s.id,'state',s.state,'template_snapshot_id',s.template_snapshot_id,'template_name',snap.name,'template_language',snap.language,
      'parameter_format',snap.parameter_format,'components',snap.components,'default_parameters',s.default_parameters,
      'parameter_bindings',s.parameter_bindings,'preference_category',s.preference_category,'segment_id',s.segment_id,
      'segment_name',s.segment_name,'segment_rule_group',s.segment_rule_group,'frozen_at',s.frozen_at,'updated_at',s.updated_at,
      'template_problem',private.whatsapp_campaign_template_problem(s.template_snapshot_id,null)) end,
    'previous_spec',case when coalesce(v_has_prev,false) then jsonb_build_object(
      'template_snapshot_id',prev.template_snapshot_id,'default_parameters',prev.default_parameters,'parameter_bindings',prev.parameter_bindings,
      'preference_category',prev.preference_category,'segment_id',prev.segment_id) end,
    'operator_denial',case when private.has_permission('whatsapp.campaigns.execute') then private.whatsapp_campaign_operator_denial(a,v.id) else 'missing_permission' end,
    'runs',coalesce((select jsonb_agg(private.whatsapp_campaign_run_json(r) order by r.created_at desc) from public.whatsapp_campaign_runs r where r.campaign_version_id=v.id),'[]'::jsonb)
  );
end;$$;
revoke all on function public.get_whatsapp_campaign_version(uuid) from public,anon;
grant execute on function public.get_whatsapp_campaign_version(uuid) to authenticated;

-- 7. Run creation, materialisation and lifecycle operators.
create or replace function public.create_whatsapp_campaign_run(
  p_campaign_version_id uuid,
  p_scheduled_for timestamptz default null,
  p_auto_start boolean default true
)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  a uuid:=auth.uid(); v public.campaign_versions%rowtype; s public.whatsapp_campaign_specs%rowtype;
  snap public.whatsapp_template_snapshots%rowtype; ar public.campaign_audience_rule_versions%rowtype;
  ap public.campaign_approvals%rowtype; pol public.whatsapp_marketing_send_policies%rowtype; rid uuid; when_at timestamptz; v_problem text;
begin
  if a is null or not private.has_permission('whatsapp.campaigns.execute') then raise exception 'WHATSAPP_CAMPAIGN_EXECUTE_DENIED' using errcode='42501'; end if;
  select * into v from public.campaign_versions where id=p_campaign_version_id for update;
  if not found or v.status<>'approved' or v.intended_channels is distinct from array['whatsapp']::text[] or v.targeting_mode<>'direct_or_custom' then raise exception 'WHATSAPP_CAMPAIGN_VERSION_NOT_EXECUTABLE' using errcode='22023'; end if;
  select * into ap from public.campaign_approvals where campaign_version_id=v.id and decision='approved';
  if not found then raise exception 'WHATSAPP_CAMPAIGN_APPROVAL_REQUIRED' using errcode='22023'; end if;
  perform private.whatsapp_campaign_raise_operator_denial(a,v.id);
  select * into ar from public.campaign_audience_rule_versions where campaign_version_id=v.id;
  if not found or ar.frozen_at is null or ar.rule_hash is distinct from ap.rule_hash then raise exception 'WHATSAPP_CAMPAIGN_AUDIENCE_NOT_FROZEN' using errcode='22023'; end if;
  select * into s from public.whatsapp_campaign_specs where campaign_version_id=v.id;
  if not found or s.state<>'frozen' then raise exception 'WHATSAPP_CAMPAIGN_SPEC_NOT_FROZEN' using errcode='22023'; end if;
  v_problem:=private.whatsapp_campaign_template_problem(s.template_snapshot_id,null);
  if v_problem is not null then raise exception 'WHATSAPP_CAMPAIGN_TEMPLATE_NOT_SENDABLE: %',v_problem using errcode='22023'; end if;
  select * into snap from public.whatsapp_template_snapshots where id=s.template_snapshot_id;
  select * into pol from private.whatsapp_campaign_latest_policy();
  if not found or pol.execution_enabled is not true then raise exception 'WHATSAPP_MARKETING_EXECUTION_DISABLED' using errcode='42501'; end if;
  -- One approval authorises one delivery. Re-sending needs a new version.
  if exists(select 1 from public.whatsapp_campaign_runs r where r.campaign_version_id=v.id
            and (r.status in ('completed','scheduled','materializing','ready','dispatching','paused','reconciling') or r.sent_count>0 or r.reconcile_count>0)) then
    raise exception 'WHATSAPP_CAMPAIGN_VERSION_ALREADY_EXECUTED' using errcode='22023';
  end if;
  when_at:=coalesce(p_scheduled_for,clock_timestamp());
  if when_at<clock_timestamp()-interval '5 minutes' or when_at>clock_timestamp()+interval '90 days' then raise exception 'WHATSAPP_CAMPAIGN_SCHEDULE_INVALID' using errcode='22023'; end if;
  insert into public.whatsapp_campaign_runs(campaign_version_id,spec_id,status,scheduled_for,auto_start,requested_by,audience_rule_hash,segment_rule_hash,template_content_hash,policy_version)
  values(v.id,s.id,'scheduled',when_at,coalesce(p_auto_start,true),a,ar.rule_hash,s.segment_rule_hash,snap.content_hash,pol.version) returning id into rid;
  perform private.whatsapp_campaign_append_event(rid,null,null,'run_created',null,'scheduled',null,'staff',a,jsonb_build_object('scheduled_for',when_at,'auto_start',coalesce(p_auto_start,true),'policy_version',pol.version));
  return jsonb_build_object('run_id',rid,'status','scheduled','scheduled_for',when_at,'auto_start',coalesce(p_auto_start,true));
end;$$;
revoke all on function public.create_whatsapp_campaign_run(uuid,timestamptz,boolean) from public,anon;
grant execute on function public.create_whatsapp_campaign_run(uuid,timestamptz,boolean) to authenticated;

create or replace function private.whatsapp_campaign_materialize(p_run_id uuid,p_actor_type text,p_actor_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  r public.whatsapp_campaign_runs%rowtype;
  s public.whatsapp_campaign_specs%rowtype;
  snap public.whatsapp_template_snapshots%rowtype;
  v_rule jsonb;
  v_problem text;
  rec record;
  v_conversation uuid;
  v_recipient uuid;
  n_total integer:=0;
  n_queued integer:=0;
  n_excluded integer:=0;
begin
  select * into r from public.whatsapp_campaign_runs where id=p_run_id for update;
  if not found then raise exception 'WHATSAPP_CAMPAIGN_RUN_NOT_FOUND' using errcode='P0002'; end if;
  if r.status<>'scheduled' then return jsonb_build_object('run_id',r.id,'status',r.status,'already_materialized',true); end if;
  if r.scheduled_for>clock_timestamp() then raise exception 'WHATSAPP_CAMPAIGN_NOT_DUE' using errcode='22023'; end if;
  update public.whatsapp_campaign_runs set status='materializing' where id=r.id;
  select * into s from public.whatsapp_campaign_specs where id=r.spec_id;
  if s.state<>'frozen' or s.segment_rule_hash is distinct from r.segment_rule_hash then raise exception 'WHATSAPP_CAMPAIGN_SPEC_NOT_FROZEN' using errcode='22023'; end if;
  select rv.rule_group into v_rule from public.campaign_audience_rule_versions rv
  where rv.campaign_version_id=r.campaign_version_id and rv.frozen_at is not null and rv.rule_hash=r.audience_rule_hash;
  if v_rule is null then raise exception 'WHATSAPP_CAMPAIGN_AUDIENCE_HASH_MISMATCH' using errcode='22023'; end if;
  v_problem:=private.whatsapp_campaign_template_problem(s.template_snapshot_id,r.template_content_hash);
  if v_problem is not null then raise exception 'WHATSAPP_CAMPAIGN_TEMPLATE_NOT_SENDABLE: %',v_problem using errcode='22023'; end if;
  select * into snap from public.whatsapp_template_snapshots where id=s.template_snapshot_id;

  for rec in
    select a.contact_id,e.o_reason,e.o_channel_id,e.o_e164,e.o_parameters
    from private.whatsapp_campaign_audience_contact_ids(v_rule,s.segment_rule_group) a
    cross join lateral private.whatsapp_campaign_evaluate_contact(a.contact_id,s.preference_category,snap.components,s.default_parameters,s.parameter_bindings) e
  loop
    n_total:=n_total+1;
    v_conversation:=null; v_recipient:=null;
    if rec.o_reason is null then
      select wc.id into v_conversation
      from public.whatsapp_conversations wc join public.whatsapp_phone_numbers wp on wp.id=wc.phone_number_id
      where wc.customer_e164=rec.o_e164 and wp.business_account_id=snap.business_account_id and wp.status='active'
      order by wc.last_message_at desc nulls last,wc.created_at desc limit 1;
    end if;
    insert into public.whatsapp_campaign_recipients(run_id,contact_id,contact_channel_id,conversation_id,recipient_e164,template_parameters,state,reason_code)
    values(r.id,rec.contact_id,rec.o_channel_id,v_conversation,rec.o_e164,case when rec.o_reason is null then rec.o_parameters else '{}'::jsonb end,
           case when rec.o_reason is null then 'queued' else 'excluded' end,rec.o_reason)
    on conflict do nothing
    returning id into v_recipient;
    if v_recipient is null then continue; end if;
    if rec.o_reason is null then
      n_queued:=n_queued+1;
      insert into public.whatsapp_campaign_dispatch_jobs(run_id,recipient_id) values(r.id,v_recipient);
    else
      n_excluded:=n_excluded+1;
    end if;
  end loop;

  update public.whatsapp_campaign_runs set status='ready',total_count=n_queued+n_excluded,eligible_count=n_queued,excluded_count=n_excluded where id=r.id;
  perform private.whatsapp_campaign_append_event(r.id,null,null,'audience_materialized','scheduled','ready',null,p_actor_type,p_actor_id,jsonb_build_object('matched',n_total,'queued',n_queued,'excluded',n_excluded));
  return jsonb_build_object('run_id',r.id,'status','ready','total',n_queued+n_excluded,'queued',n_queued,'excluded',n_excluded);
end;$$;
revoke all on function private.whatsapp_campaign_materialize(uuid,text,uuid) from public,anon,authenticated;

/* ready -> dispatching after re-proving the run-scope sending gates. */
create or replace function private.whatsapp_campaign_start_ready_run(p_run_id uuid,p_actor_type text,p_actor_id uuid)
returns text language plpgsql volatile security definer set search_path='' as $$
declare r public.whatsapp_campaign_runs%rowtype; s public.whatsapp_campaign_specs%rowtype; pol public.whatsapp_marketing_send_policies%rowtype; v_status text;
begin
  select * into r from public.whatsapp_campaign_runs where id=p_run_id for update;
  if not found or r.status<>'ready' then raise exception 'WHATSAPP_CAMPAIGN_RUN_NOT_READY' using errcode='22023'; end if;
  select * into pol from private.whatsapp_campaign_latest_policy();
  if not found or pol.execution_enabled is not true then raise exception 'WHATSAPP_MARKETING_EXECUTION_DISABLED' using errcode='42501'; end if;
  select * into s from public.whatsapp_campaign_specs where id=r.spec_id;
  if private.whatsapp_campaign_template_problem(s.template_snapshot_id,r.template_content_hash) is not null then raise exception 'WHATSAPP_CAMPAIGN_TEMPLATE_NOT_SENDABLE' using errcode='22023'; end if;
  update public.whatsapp_campaign_runs set status='dispatching',started_at=coalesce(started_at,clock_timestamp()) where id=r.id;
  perform private.whatsapp_campaign_append_event(r.id,null,null,'run_started','ready','dispatching',null,p_actor_type,p_actor_id,'{}'::jsonb);
  perform private.whatsapp_campaign_refresh_run(r.id);
  select status into v_status from public.whatsapp_campaign_runs where id=r.id;
  return v_status;
end;$$;
revoke all on function private.whatsapp_campaign_start_ready_run(uuid,text,uuid) from public,anon,authenticated;

create or replace function public.start_whatsapp_campaign_run(p_run_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a uuid:=auth.uid(); r public.whatsapp_campaign_runs%rowtype; v_status text;
begin
  if a is null or not private.has_permission('whatsapp.campaigns.execute') then raise exception 'WHATSAPP_CAMPAIGN_EXECUTE_DENIED' using errcode='42501'; end if;
  select * into r from public.whatsapp_campaign_runs where id=p_run_id for update;
  if not found then raise exception 'WHATSAPP_CAMPAIGN_RUN_NOT_FOUND' using errcode='P0002'; end if;
  perform private.whatsapp_campaign_raise_operator_denial(a,r.campaign_version_id);
  if r.status='scheduled' then perform private.whatsapp_campaign_materialize(r.id,'staff',a); end if;
  v_status:=private.whatsapp_campaign_start_ready_run(r.id,'staff',a);
  return jsonb_build_object('run_id',r.id,'status',v_status);
end;$$;
revoke all on function public.start_whatsapp_campaign_run(uuid) from public,anon;
grant execute on function public.start_whatsapp_campaign_run(uuid) to authenticated;

create or replace function public.pause_whatsapp_campaign_run(p_run_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a uuid:=auth.uid(); r public.whatsapp_campaign_runs%rowtype;
begin
  if a is null or not private.has_permission('whatsapp.campaigns.execute') then raise exception 'WHATSAPP_CAMPAIGN_PAUSE_DENIED' using errcode='42501'; end if;
  select * into r from public.whatsapp_campaign_runs where id=p_run_id for update;
  if not found then raise exception 'WHATSAPP_CAMPAIGN_RUN_NOT_FOUND' using errcode='P0002'; end if;
  -- Pause is never blocked by a sending gate, but the operator rule still applies.
  perform private.whatsapp_campaign_raise_operator_denial(a,r.campaign_version_id);
  if r.status<>'dispatching' then raise exception 'WHATSAPP_CAMPAIGN_NOT_DISPATCHING' using errcode='22023'; end if;
  update public.whatsapp_campaign_runs set status='paused' where id=p_run_id;
  perform private.whatsapp_campaign_append_event(p_run_id,null,null,'run_paused','dispatching','paused',null,'staff',a,'{}'::jsonb);
  return jsonb_build_object('run_id',p_run_id,'status','paused');
end;$$;
revoke all on function public.pause_whatsapp_campaign_run(uuid) from public,anon;
grant execute on function public.pause_whatsapp_campaign_run(uuid) to authenticated;

create or replace function public.resume_whatsapp_campaign_run(p_run_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a uuid:=auth.uid(); r public.whatsapp_campaign_runs%rowtype; s public.whatsapp_campaign_specs%rowtype; pol public.whatsapp_marketing_send_policies%rowtype; v_status text;
begin
  if a is null or not private.has_permission('whatsapp.campaigns.execute') then raise exception 'WHATSAPP_CAMPAIGN_EXECUTE_DENIED' using errcode='42501'; end if;
  select * into r from public.whatsapp_campaign_runs where id=p_run_id for update;
  if not found then raise exception 'WHATSAPP_CAMPAIGN_RUN_NOT_FOUND' using errcode='P0002'; end if;
  perform private.whatsapp_campaign_raise_operator_denial(a,r.campaign_version_id);
  if r.status<>'paused' then raise exception 'WHATSAPP_CAMPAIGN_NOT_PAUSED' using errcode='22023'; end if;
  select * into pol from private.whatsapp_campaign_latest_policy();
  if not found or pol.execution_enabled is not true then raise exception 'WHATSAPP_MARKETING_EXECUTION_DISABLED' using errcode='42501'; end if;
  select * into s from public.whatsapp_campaign_specs where id=r.spec_id;
  if private.whatsapp_campaign_template_problem(s.template_snapshot_id,r.template_content_hash) is not null then raise exception 'WHATSAPP_CAMPAIGN_TEMPLATE_NOT_SENDABLE' using errcode='22023'; end if;
  update public.whatsapp_campaign_runs set status='dispatching' where id=r.id;
  perform private.whatsapp_campaign_append_event(r.id,null,null,'run_resumed','paused','dispatching',null,'staff',a,'{}'::jsonb);
  perform private.whatsapp_campaign_refresh_run(r.id);
  select status into v_status from public.whatsapp_campaign_runs where id=r.id;
  return jsonb_build_object('run_id',r.id,'status',v_status);
end;$$;
revoke all on function public.resume_whatsapp_campaign_run(uuid) from public,anon;
grant execute on function public.resume_whatsapp_campaign_run(uuid) to authenticated;

create or replace function public.cancel_whatsapp_campaign_run(p_run_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a uuid:=auth.uid(); r public.whatsapp_campaign_runs%rowtype;
begin
  if a is null or not private.has_permission('whatsapp.campaigns.cancel') or not private.has_role('super_admin') then raise exception 'WHATSAPP_CAMPAIGN_CANCEL_DENIED' using errcode='42501'; end if;
  select * into r from public.whatsapp_campaign_runs where id=p_run_id for update;
  if not found then raise exception 'WHATSAPP_CAMPAIGN_RUN_NOT_FOUND' using errcode='P0002'; end if;
  -- A claimed job may already be at the provider; an ambiguous one may already be delivered.
  if r.status not in ('scheduled','ready','dispatching','paused')
     or exists(select 1 from public.whatsapp_campaign_dispatch_jobs where run_id=r.id and state in ('claimed','needs_reconcile')) then
    raise exception 'WHATSAPP_CAMPAIGN_CANCEL_UNSAFE' using errcode='22023';
  end if;
  update public.whatsapp_campaign_dispatch_jobs set state='cancelled',last_error_code='run_cancelled' where run_id=r.id and state='pending';
  update public.whatsapp_campaign_recipients set state='cancelled',reason_code='run_cancelled' where run_id=r.id and state='queued';
  perform private.whatsapp_campaign_refresh_run(r.id);
  update public.whatsapp_campaign_runs set status='cancelled',completed_at=clock_timestamp() where id=r.id;
  perform private.whatsapp_campaign_append_event(r.id,null,null,'run_cancelled',r.status,'cancelled',null,'staff',a,'{}'::jsonb);
  return jsonb_build_object('run_id',r.id,'status','cancelled');
end;$$;
revoke all on function public.cancel_whatsapp_campaign_run(uuid) from public,anon;
grant execute on function public.cancel_whatsapp_campaign_run(uuid) to authenticated;

/* Non-PII run breakdown: recipient states and reasons as counts. */
create or replace function public.get_whatsapp_campaign_run_breakdown(p_run_id uuid)
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not (private.has_permission('campaigns.read') or private.has_permission('whatsapp.campaigns.execute')) then raise exception 'WHATSAPP_CAMPAIGN_DENIED' using errcode='42501'; end if;
  if not exists(select 1 from public.whatsapp_campaign_runs where id=p_run_id) then raise exception 'WHATSAPP_CAMPAIGN_RUN_NOT_FOUND' using errcode='P0002'; end if;
  return jsonb_build_object(
    'run_id',p_run_id,
    'recipient_states',coalesce((select jsonb_object_agg(x.state,x.n) from (select state,count(*) n from public.whatsapp_campaign_recipients where run_id=p_run_id group by state) x),'{}'::jsonb),
    'reasons',coalesce((select jsonb_object_agg(x.reason_code,x.n) from (select reason_code,count(*) n from public.whatsapp_campaign_recipients where run_id=p_run_id and reason_code is not null group by reason_code) x),'{}'::jsonb),
    'job_states',coalesce((select jsonb_object_agg(x.state,x.n) from (select state,count(*) n from public.whatsapp_campaign_dispatch_jobs where run_id=p_run_id group by state) x),'{}'::jsonb),
    'deferred_count',(select count(*) from public.whatsapp_campaign_dispatch_jobs where run_id=p_run_id and state='pending' and not_before>clock_timestamp()),
    'next_not_before',(select min(not_before) from public.whatsapp_campaign_dispatch_jobs where run_id=p_run_id and state='pending'),
    'retrying_count',(select count(*) from public.whatsapp_campaign_dispatch_jobs where run_id=p_run_id and state='pending' and attempt_count>0)
  );
end;$$;
revoke all on function public.get_whatsapp_campaign_run_breakdown(uuid) from public,anon;
grant execute on function public.get_whatsapp_campaign_run_breakdown(uuid) to authenticated;

-- 8. Worker: due materialisation with governed auto-start.
create or replace function private.whatsapp_campaign_auto_start(p_run_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare r public.whatsapp_campaign_runs%rowtype; s public.whatsapp_campaign_specs%rowtype; pol public.whatsapp_marketing_send_policies%rowtype; v_reason text;
begin
  select * into r from public.whatsapp_campaign_runs where id=p_run_id for update;
  if not found or r.status<>'ready' then return '{}'::jsonb; end if;
  if not r.auto_start then return jsonb_build_object('auto_start','manual'); end if;
  -- The requester's authority is re-proved at the start instant, not remembered.
  if not private.whatsapp_actor_holds_permission(r.requested_by,'whatsapp.campaigns.execute') then v_reason:='requester_lacks_execute';
  else v_reason:=private.whatsapp_campaign_operator_denial(r.requested_by,r.campaign_version_id);
  end if;
  if v_reason is null then
    select * into pol from private.whatsapp_campaign_latest_policy();
    if not found or pol.execution_enabled is not true then v_reason:='marketing_execution_disabled'; end if;
  end if;
  if v_reason is null then
    select * into s from public.whatsapp_campaign_specs where id=r.spec_id;
    if private.whatsapp_campaign_template_problem(s.template_snapshot_id,r.template_content_hash) is not null then v_reason:='template_not_sendable'; end if;
  end if;
  if v_reason is not null then
    perform private.whatsapp_campaign_append_event(r.id,null,null,'auto_start_blocked','ready','ready',null,'worker',null,jsonb_build_object('reason',v_reason));
    return jsonb_build_object('auto_start','blocked','reason',v_reason);
  end if;
  return jsonb_build_object('auto_start','started','status',private.whatsapp_campaign_start_ready_run(r.id,'worker',null));
end;$$;
revoke all on function private.whatsapp_campaign_auto_start(uuid) from public,anon,authenticated;

create or replace function public.materialize_due_whatsapp_campaign_runs(p_limit integer default 10)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare rr record; v_out jsonb:='[]'::jsonb; n integer:=greatest(1,least(coalesce(p_limit,10),25)); v_result jsonb; v_code text;
begin
  perform private.whatsapp_campaign_require_service_role();
  for rr in select id,status from public.whatsapp_campaign_runs where status='scheduled' and scheduled_for<=clock_timestamp() order by scheduled_for,id for update skip locked limit n loop
    begin
      v_result:=private.whatsapp_campaign_materialize(rr.id,'worker',null);
      v_result:=v_result||private.whatsapp_campaign_auto_start(rr.id);
    exception when others then
      -- One broken run must not stall every other due run.
      v_code:=coalesce(substring(sqlerrm from 'WHATSAPP_[A-Z_]+'),'materialize_error_'||sqlstate);
      update public.whatsapp_campaign_runs set status='failed',failure_code=left(v_code,80),completed_at=clock_timestamp() where id=rr.id;
      perform private.whatsapp_campaign_append_event(rr.id,null,null,'run_failed','scheduled','failed',null,'worker',null,jsonb_build_object('failure_code',left(v_code,80)));
      v_result:=jsonb_build_object('run_id',rr.id,'status','failed','failure_code',left(v_code,80));
    end;
    v_out:=v_out||jsonb_build_array(v_result);
  end loop;
  -- Ready runs whose materialisation a staff member started but whose auto-start was blocked stay ready; nothing else to do.
  return v_out;
end;$$;
revoke all on function public.materialize_due_whatsapp_campaign_runs(integer) from public,anon,authenticated;
grant execute on function public.materialize_due_whatsapp_campaign_runs(integer) to service_role;

-- 9. Just-in-time eligibility and durable claims.
create or replace function private.whatsapp_campaign_job_eligibility(p_job_id uuid,p_at timestamptz default clock_timestamp())
returns table(decision text,reason text,defer_until timestamptz)
language plpgsql stable security definer set search_path='' as $$
declare
  j public.whatsapp_campaign_dispatch_jobs%rowtype; r public.whatsapp_campaign_runs%rowtype;
  wr public.whatsapp_campaign_recipients%rowtype; s public.whatsapp_campaign_specs%rowtype;
  snap public.whatsapp_template_snapshots%rowtype; v_problem text;
  c public.contacts%rowtype; ch public.contact_channels%rowtype; pol public.whatsapp_marketing_send_policies%rowtype;
  v_consent text; v_quiet timestamptz;
begin
  select * into j from public.whatsapp_campaign_dispatch_jobs where id=p_job_id;
  if not found then return query select 'skip'::text,'run_not_active'::text,null::timestamptz; return; end if;
  select * into r from public.whatsapp_campaign_runs where id=j.run_id;
  if r.status<>'dispatching' then return query select 'skip'::text,'run_not_active'::text,null::timestamptz; return; end if;
  select * into s from public.whatsapp_campaign_specs where id=r.spec_id;
  v_problem:=private.whatsapp_campaign_template_problem(s.template_snapshot_id,r.template_content_hash);
  if v_problem is not null then
    return query select 'skip'::text,case when v_problem='template_category_not_marketing' then v_problem else 'template_not_approved' end,null::timestamptz;
    return;
  end if;
  select * into wr from public.whatsapp_campaign_recipients where id=j.recipient_id;
  if wr.canonical_message_id is not null or exists(select 1 from public.whatsapp_message_campaign_attributions a where a.recipient_id=wr.id) then
    return query select 'skip'::text,'already_sent'::text,null::timestamptz; return;
  end if;
  select * into c from public.contacts where id=wr.contact_id;
  if not found then return query select 'skip'::text,'contact_missing'::text,null::timestamptz; return; end if;
  if c.status='do_not_contact' then return query select 'skip'::text,'contact_do_not_contact'::text,null::timestamptz; return; end if;
  if c.status<>'active' then return query select 'skip'::text,'contact_inactive'::text,null::timestamptz; return; end if;
  select * into ch from public.contact_channels where id=wr.contact_channel_id and contact_id=wr.contact_id and channel_type='whatsapp';
  if not found or ch.address_normalized is distinct from wr.recipient_e164 then return query select 'skip'::text,'whatsapp_channel_missing'::text,null::timestamptz; return; end if;
  if ch.status='suppressed' then return query select 'skip'::text,'channel_suppressed'::text,null::timestamptz; return; end if;
  if ch.status='invalid' then return query select 'skip'::text,'channel_invalid'::text,null::timestamptz; return; end if;
  if ch.status<>'active' then return query select 'skip'::text,'channel_inactive'::text,null::timestamptz; return; end if;
  v_consent:=private.whatsapp_latest_marketing_consent(wr.contact_id);
  if v_consent is distinct from 'granted' then
    return query select 'skip'::text,case v_consent when 'withdrawn' then 'marketing_consent_withdrawn' when 'suppressed' then 'marketing_consent_suppressed'
      when 'expired' then 'marketing_consent_expired' else 'marketing_consent_missing' end,null::timestamptz;
    return;
  end if;
  if private.whatsapp_preference_opted_out(wr.contact_id,s.preference_category) then return query select 'skip'::text,'preference_opted_out'::text,null::timestamptz; return; end if;
  select * into snap from public.whatsapp_template_snapshots where id=s.template_snapshot_id;
  v_problem:=private.whatsapp_template_parameters_problem(snap.components,wr.template_parameters);
  if v_problem is not null then
    return query select 'skip'::text,case when v_problem='parameters_missing' then 'variables_missing' else 'variables_invalid' end,null::timestamptz; return;
  end if;
  select * into pol from private.whatsapp_campaign_latest_policy();
  if not found or pol.execution_enabled is not true then return query select 'skip'::text,'send_policy_unconfigured'::text,null::timestamptz; return; end if;
  if private.whatsapp_campaign_frequency_capped(wr.contact_id,pol,p_at) then return query select 'skip'::text,'frequency_capped'::text,null::timestamptz; return; end if;
  v_quiet:=private.whatsapp_campaign_quiet_until(pol,p_at);
  if v_quiet is not null and v_quiet>p_at then return query select 'defer'::text,'quiet_hours'::text,v_quiet; return; end if;
  return query select 'eligible'::text,null::text,null::timestamptz;
end;$$;
revoke all on function private.whatsapp_campaign_job_eligibility(uuid,timestamptz) from public,anon,authenticated;

create or replace function public.claim_whatsapp_campaign_dispatch_jobs(p_worker_id text,p_batch_size integer default 20)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  n integer:=greatest(1,least(coalesce(p_batch_size,20),50)); x record; e record; tok uuid; v_out jsonb:='[]'::jsonb; v_worker text;
  wr public.whatsapp_campaign_recipients%rowtype; r public.whatsapp_campaign_runs%rowtype; s public.whatsapp_campaign_specs%rowtype;
  snap public.whatsapp_template_snapshots%rowtype; wp public.whatsapp_phone_numbers%rowtype; v_sender text; v_attempt integer;
begin
  perform private.whatsapp_campaign_require_service_role();
  v_worker:=trim(coalesce(p_worker_id,''));
  if length(v_worker) not between 1 and 80 then raise exception 'WHATSAPP_WORKER_ID_INVALID' using errcode='22023'; end if;

  -- Expired claims: reclaimable only when no provider request was recorded.
  for x in select * from public.whatsapp_campaign_dispatch_jobs where state='claimed' and claim_expires_at<clock_timestamp() order by claim_expires_at limit 200 for update skip locked loop
    if x.provider_request_started_at is null then
      update public.whatsapp_campaign_dispatch_jobs set state='pending',claim_token=null,claimed_by=null,claimed_at=null,claim_expires_at=null,not_before=clock_timestamp(),last_error_code='claim_expired_before_provider' where id=x.id;
      perform private.whatsapp_campaign_append_event(x.run_id,x.id,x.recipient_id,'claim_expired','claimed','pending',x.attempt_count,'worker',null,jsonb_build_object('worker_id',v_worker));
    else
      update public.whatsapp_campaign_dispatch_jobs set state='needs_reconcile',claim_token=null,claimed_by=null,claimed_at=null,claim_expires_at=null,last_error_code='claim_expired_after_provider_start' where id=x.id;
      update public.whatsapp_campaign_recipients set state='needs_reconcile',reason_code='provider_outcome_unknown' where id=x.recipient_id;
      perform private.whatsapp_campaign_append_event(x.run_id,x.id,x.recipient_id,'claim_ambiguous_timeout','claimed','needs_reconcile',x.attempt_count,'worker',null,jsonb_build_object('worker_id',v_worker));
      perform private.whatsapp_campaign_refresh_run(x.run_id);
    end if;
  end loop;

  for x in
    select j.* from public.whatsapp_campaign_dispatch_jobs j join public.whatsapp_campaign_runs cr on cr.id=j.run_id
    where j.state='pending' and j.not_before<=clock_timestamp() and cr.status='dispatching'
    order by j.not_before,j.created_at,j.id for update of j skip locked limit n
  loop
    if x.attempt_count>=3 then
      update public.whatsapp_campaign_dispatch_jobs set state='failed',last_error_code='attempts_exhausted' where id=x.id;
      update public.whatsapp_campaign_recipients set state='failed',reason_code='attempts_exhausted' where id=x.recipient_id;
      perform private.whatsapp_campaign_append_event(x.run_id,x.id,x.recipient_id,'job_failed','pending','failed',x.attempt_count,'worker',null,jsonb_build_object('reason','attempts_exhausted'));
      perform private.whatsapp_campaign_refresh_run(x.run_id);
      continue;
    end if;

    select * into e from private.whatsapp_campaign_job_eligibility(x.id,clock_timestamp());
    if e.decision='defer' then
      update public.whatsapp_campaign_dispatch_jobs set not_before=e.defer_until,last_error_code=e.reason where id=x.id;
      perform private.whatsapp_campaign_append_event(x.run_id,x.id,x.recipient_id,'job_deferred','pending','pending',x.attempt_count,'worker',null,jsonb_build_object('reason',e.reason,'not_before',e.defer_until));
      continue;
    elsif e.decision<>'eligible' then
      update public.whatsapp_campaign_dispatch_jobs set state='skipped',last_error_code=e.reason where id=x.id;
      update public.whatsapp_campaign_recipients set state='skipped',reason_code=e.reason where id=x.recipient_id;
      perform private.whatsapp_campaign_append_event(x.run_id,x.id,x.recipient_id,'job_skipped','pending','skipped',x.attempt_count,'worker',null,jsonb_build_object('reason',e.reason));
      perform private.whatsapp_campaign_refresh_run(x.run_id);
      continue;
    end if;

    select * into wr from public.whatsapp_campaign_recipients where id=x.recipient_id;
    select * into r from public.whatsapp_campaign_runs where id=x.run_id;
    select * into s from public.whatsapp_campaign_specs where id=r.spec_id;
    select * into snap from public.whatsapp_template_snapshots where id=s.template_snapshot_id;
    wp:=null;
    -- Prefer the business number the customer already talks to.
    select p.* into wp from public.whatsapp_phone_numbers p
    left join public.whatsapp_conversations wc on wc.id=wr.conversation_id
    where p.business_account_id=snap.business_account_id and p.status='active'
    order by (p.id=wc.phone_number_id) desc nulls last,p.created_at,p.id limit 1;
    v_sender:=case when wp.id is null then null else private.whatsapp_business_sender_e164(wp.display_phone_number) end;
    if wp.id is null or v_sender is null then
      update public.whatsapp_campaign_dispatch_jobs set state='failed',last_error_code='business_phone_unavailable' where id=x.id;
      update public.whatsapp_campaign_recipients set state='failed',reason_code='business_phone_unavailable' where id=x.recipient_id;
      perform private.whatsapp_campaign_append_event(x.run_id,x.id,x.recipient_id,'job_failed','pending','failed',x.attempt_count,'worker',null,jsonb_build_object('reason','business_phone_unavailable'));
      perform private.whatsapp_campaign_refresh_run(x.run_id);
      continue;
    end if;
    tok:=gen_random_uuid(); v_attempt:=x.attempt_count+1;
    update public.whatsapp_campaign_dispatch_jobs set state='claimed',attempt_count=v_attempt,claim_token=tok,claimed_by=v_worker,claimed_at=clock_timestamp(),
      claim_expires_at=clock_timestamp()+interval '120 seconds',phone_number_id=wp.id,sender_e164=v_sender,last_error_code=null
    where id=x.id;
    perform private.whatsapp_campaign_append_event(x.run_id,x.id,x.recipient_id,'job_claimed','pending','claimed',v_attempt,'worker',null,jsonb_build_object('worker_id',v_worker));
    v_out:=v_out||jsonb_build_array(jsonb_build_object(
      'job_id',x.id,'claim_token',tok,'attempt',v_attempt,'run_id',x.run_id,'recipient_id',x.recipient_id,
      'phone_number_id',wp.phone_number_id,'recipient_e164',wr.recipient_e164,
      'template_name',snap.name,'template_language',snap.language,
      'template_components',private.whatsapp_build_template_send_components(snap.components,snap.parameter_format,wr.template_parameters)
    ));
  end loop;
  return v_out;
end;$$;
revoke all on function public.claim_whatsapp_campaign_dispatch_jobs(text,integer) from public,anon,authenticated;
grant execute on function public.claim_whatsapp_campaign_dispatch_jobs(text,integer) to service_role;

-- 10. Provider-attempt evidence and completion. No provider call occurs in SQL.
create or replace function public.mark_whatsapp_campaign_provider_request_started(p_job_id uuid,p_claim_token uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare j public.whatsapp_campaign_dispatch_jobs%rowtype;
begin
  perform private.whatsapp_campaign_require_service_role();
  select * into j from public.whatsapp_campaign_dispatch_jobs where id=p_job_id for update;
  if not found or j.state<>'claimed' or j.claim_token is distinct from p_claim_token or j.claim_expires_at<=clock_timestamp() then raise exception 'WHATSAPP_CAMPAIGN_JOB_NOT_CLAIMED' using errcode='P0002'; end if;
  if j.provider_request_started_at is null then
    update public.whatsapp_campaign_dispatch_jobs set provider_request_started_at=clock_timestamp() where id=j.id;
    perform private.whatsapp_campaign_append_event(j.run_id,j.id,j.recipient_id,'provider_request_started','claimed','claimed',j.attempt_count,'worker',null,'{}'::jsonb);
  end if;
  return jsonb_build_object('job_id',j.id,'provider_request_started',true);
end;$$;
revoke all on function public.mark_whatsapp_campaign_provider_request_started(uuid,uuid) from public,anon,authenticated;
grant execute on function public.mark_whatsapp_campaign_provider_request_started(uuid,uuid) to service_role;

/* The only writer of campaign outbound messages: canonical history plus attribution. */
create or replace function private.whatsapp_campaign_bind_success(
  p_job_id uuid,p_provider_message_id text,p_provider_timestamp timestamptz,p_details jsonb,p_actor_type text,p_actor_id uuid
)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  j public.whatsapp_campaign_dispatch_jobs%rowtype; wr public.whatsapp_campaign_recipients%rowtype;
  r public.whatsapp_campaign_runs%rowtype; s public.whatsapp_campaign_specs%rowtype; snap public.whatsapp_template_snapshots%rowtype;
  v_conversation uuid; v_message uuid; v_existing record; v_at timestamptz:=coalesce(p_provider_timestamp,clock_timestamp()); v_from text;
begin
  if p_provider_message_id is null or length(p_provider_message_id) not between 1 and 128 or p_provider_message_id ~ '\s' then raise exception 'WHATSAPP_PROVIDER_MESSAGE_ID_INVALID' using errcode='22023'; end if;
  select * into j from public.whatsapp_campaign_dispatch_jobs where id=p_job_id for update;
  select * into wr from public.whatsapp_campaign_recipients where id=j.recipient_id for update;
  select * into r from public.whatsapp_campaign_runs where id=j.run_id;
  select * into s from public.whatsapp_campaign_specs where id=r.spec_id;
  select * into snap from public.whatsapp_template_snapshots where id=s.template_snapshot_id;
  if j.phone_number_id is null or j.sender_e164 is null or wr.recipient_e164 is null then raise exception 'WHATSAPP_CAMPAIGN_BINDING_EVIDENCE_MISSING' using errcode='22023'; end if;
  v_from:=j.state;

  select m.id,m.conversation_id into v_existing from public.whatsapp_messages m where m.provider_message_id=p_provider_message_id;
  if found then
    if exists(select 1 from public.whatsapp_message_campaign_attributions a where a.whatsapp_message_id=v_existing.id and a.recipient_id=wr.id) then
      update public.whatsapp_campaign_dispatch_jobs set state='succeeded',provider_message_id=p_provider_message_id,claim_token=null,claimed_by=null,claimed_at=null,claim_expires_at=null,last_error_code=null where id=j.id;
      update public.whatsapp_campaign_recipients set state='sent',canonical_message_id=v_existing.id,reason_code=null where id=wr.id;
      perform private.whatsapp_campaign_refresh_run(r.id);
      return jsonb_build_object('outcome','already_bound','message_id',v_existing.id);
    end if;
    raise exception 'WHATSAPP_PROVIDER_MESSAGE_CONFLICT' using errcode='23505';
  end if;

  insert into public.whatsapp_conversations(phone_number_id,customer_e164,contact_id,last_message_at)
  values(j.phone_number_id,wr.recipient_e164,wr.contact_id,v_at)
  on conflict(phone_number_id,customer_e164) do update set
    contact_id=coalesce(public.whatsapp_conversations.contact_id,excluded.contact_id),
    last_message_at=greatest(coalesce(public.whatsapp_conversations.last_message_at,excluded.last_message_at),excluded.last_message_at),
    updated_at=now()
  returning id into v_conversation;
  -- Same single lead-link writer inbound ingest uses: replies land with the assigned owner.
  perform private.crm_apply_whatsapp_conversation_lead_link(v_conversation);

  insert into public.whatsapp_messages(conversation_id,provider_message_id,direction,provider_message_type,normalized_message_type,sender_e164,recipient_e164,body_text,content,provider_timestamp,latest_status)
  values(
    v_conversation,p_provider_message_id,'outbound','template','text',j.sender_e164,wr.recipient_e164,
    left(private.whatsapp_render_template_preview(snap.components,wr.template_parameters),4096),
    jsonb_build_object(
      'template',jsonb_build_object('template_id',snap.template_id,'snapshot_id',snap.id,'provider_template_id',snap.provider_template_id,
        'name',snap.name,'language',snap.language,'category',snap.category,'parameter_format',snap.parameter_format),
      'parameters',wr.template_parameters,
      'campaign',jsonb_build_object('run_id',r.id,'campaign_version_id',r.campaign_version_id,'recipient_id',wr.id)
    ),
    v_at,null
  ) returning id into v_message;
  insert into public.whatsapp_message_campaign_attributions(whatsapp_message_id,run_id,recipient_id,campaign_version_id) values(v_message,r.id,wr.id,r.campaign_version_id);
  update public.whatsapp_campaign_recipients set state='sent',conversation_id=v_conversation,canonical_message_id=v_message,reason_code=null where id=wr.id;
  update public.whatsapp_campaign_dispatch_jobs set state='succeeded',provider_message_id=p_provider_message_id,claim_token=null,claimed_by=null,claimed_at=null,claim_expires_at=null,last_error_code=null where id=j.id;
  perform private.whatsapp_campaign_append_event(r.id,j.id,wr.id,'provider_bound',v_from,'succeeded',j.attempt_count,p_actor_type,p_actor_id,
    jsonb_build_object('provider_message_id',p_provider_message_id)||coalesce(p_details,'{}'::jsonb));
  perform private.whatsapp_campaign_refresh_run(r.id);
  return jsonb_build_object('outcome','bound','message_id',v_message,'conversation_id',v_conversation);
end;$$;
revoke all on function private.whatsapp_campaign_bind_success(uuid,text,timestamptz,jsonb,text,uuid) from public,anon,authenticated;

create or replace function public.complete_whatsapp_campaign_dispatch_success(
  p_job_id uuid,p_claim_token uuid,p_provider_message_id text,p_provider_timestamp timestamptz,p_provider_snapshot jsonb default '{}'::jsonb
)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare j public.whatsapp_campaign_dispatch_jobs%rowtype;
begin
  perform private.whatsapp_campaign_require_service_role();
  if p_provider_snapshot is null or jsonb_typeof(p_provider_snapshot)<>'object' or pg_column_size(p_provider_snapshot)>4096 then raise exception 'WHATSAPP_PROVIDER_SNAPSHOT_INVALID' using errcode='22023'; end if;
  select * into j from public.whatsapp_campaign_dispatch_jobs where id=p_job_id for update;
  if found and j.state='succeeded' and j.provider_message_id=p_provider_message_id then
    return jsonb_build_object('outcome','already_bound');
  end if;
  if not found or j.state<>'claimed' or j.claim_token is distinct from p_claim_token or j.provider_request_started_at is null then raise exception 'WHATSAPP_CAMPAIGN_JOB_NOT_COMPLETABLE' using errcode='P0002'; end if;
  return private.whatsapp_campaign_bind_success(j.id,p_provider_message_id,p_provider_timestamp,jsonb_build_object('provider',p_provider_snapshot),'worker',null);
end;$$;
revoke all on function public.complete_whatsapp_campaign_dispatch_success(uuid,uuid,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.complete_whatsapp_campaign_dispatch_success(uuid,uuid,text,timestamptz,jsonb) to service_role;

create or replace function public.complete_whatsapp_campaign_dispatch_failure(
  p_job_id uuid,p_claim_token uuid,p_outcome text,p_error_code text,p_provider_snapshot jsonb default '{}'::jsonb
)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare j public.whatsapp_campaign_dispatch_jobs%rowtype; v_next text; v_at timestamptz; v_delay integer;
begin
  perform private.whatsapp_campaign_require_service_role();
  if p_outcome is null or p_outcome not in ('transient','terminal','ambiguous') or p_error_code is null or length(p_error_code) not between 1 and 128 then raise exception 'WHATSAPP_DISPATCH_FAILURE_INVALID' using errcode='22023'; end if;
  if p_provider_snapshot is null or jsonb_typeof(p_provider_snapshot)<>'object' or pg_column_size(p_provider_snapshot)>4096 then raise exception 'WHATSAPP_PROVIDER_SNAPSHOT_INVALID' using errcode='22023'; end if;
  select * into j from public.whatsapp_campaign_dispatch_jobs where id=p_job_id for update;
  if not found or j.state<>'claimed' or j.claim_token is distinct from p_claim_token or j.provider_request_started_at is null then raise exception 'WHATSAPP_CAMPAIGN_JOB_NOT_COMPLETABLE' using errcode='P0002'; end if;
  -- Ambiguous is never retried: the customer may already have the message.
  if p_outcome='ambiguous' then v_next:='needs_reconcile';
  elsif p_outcome='transient' and j.attempt_count<3 then
    v_next:='pending'; v_delay:=least(900,30*(2^(greatest(1,j.attempt_count)-1))::integer); v_at:=clock_timestamp()+make_interval(secs=>v_delay);
  else v_next:='failed'; end if;

  update public.whatsapp_campaign_dispatch_jobs set state=v_next,claim_token=null,claimed_by=null,claimed_at=null,claim_expires_at=null,
    provider_request_started_at=case when v_next='pending' then null else provider_request_started_at end,
    not_before=coalesce(v_at,not_before),last_error_code=p_error_code
  where id=j.id;
  if v_next='needs_reconcile' then update public.whatsapp_campaign_recipients set state='needs_reconcile',reason_code='provider_outcome_unknown' where id=j.recipient_id;
  elsif v_next='failed' then update public.whatsapp_campaign_recipients set state='failed',reason_code=left(p_error_code,80) where id=j.recipient_id; end if;
  perform private.whatsapp_campaign_append_event(j.run_id,j.id,j.recipient_id,
    case when v_next='pending' then 'retry_scheduled' when v_next='needs_reconcile' then 'provider_ambiguous' else 'job_failed' end,
    'claimed',v_next,j.attempt_count,'worker',null,jsonb_build_object('error_code',p_error_code,'not_before',v_at,'provider',p_provider_snapshot));
  perform private.whatsapp_campaign_refresh_run(j.run_id);
  return jsonb_build_object('outcome',case when v_next='pending' then 'retry_scheduled' when v_next='needs_reconcile' then 'needs_reconcile' else 'failed_terminal' end,'state',v_next,'not_before',v_at);
end;$$;
revoke all on function public.complete_whatsapp_campaign_dispatch_failure(uuid,uuid,text,text,jsonb) from public,anon,authenticated;
grant execute on function public.complete_whatsapp_campaign_dispatch_failure(uuid,uuid,text,text,jsonb) to service_role;

/* Resolve an ambiguous job with evidence or an audited decision. Never re-queued. */
create or replace function private.whatsapp_campaign_resolve_reconcile(
  p_job_id uuid,p_resolution text,p_provider_message_id text,p_provider_timestamp timestamptz,p_evidence jsonb,p_actor_type text,p_actor_id uuid
)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare j public.whatsapp_campaign_dispatch_jobs%rowtype;
begin
  if p_resolution is null or p_resolution not in ('sent','not_sent') then raise exception 'WHATSAPP_RECONCILE_RESOLUTION_INVALID' using errcode='22023'; end if;
  if p_evidence is null or jsonb_typeof(p_evidence)<>'object' or pg_column_size(p_evidence)>2048 then raise exception 'WHATSAPP_RECONCILE_EVIDENCE_INVALID' using errcode='22023'; end if;
  select * into j from public.whatsapp_campaign_dispatch_jobs where id=p_job_id for update;
  if not found or j.state<>'needs_reconcile' then raise exception 'WHATSAPP_RECONCILE_NOT_FOUND' using errcode='P0002'; end if;
  if p_resolution='not_sent' then
    update public.whatsapp_campaign_dispatch_jobs set state='failed',last_error_code='reconciled_not_sent' where id=j.id;
    update public.whatsapp_campaign_recipients set state='failed',reason_code='reconciled_not_sent' where id=j.recipient_id;
    perform private.whatsapp_campaign_append_event(j.run_id,j.id,j.recipient_id,'reconcile_not_sent','needs_reconcile','failed',j.attempt_count,p_actor_type,p_actor_id,p_evidence);
    perform private.whatsapp_campaign_refresh_run(j.run_id);
    return jsonb_build_object('outcome','failed','resolution','not_sent');
  end if;
  if p_provider_message_id is null then raise exception 'WHATSAPP_RECONCILE_PROVIDER_ID_REQUIRED' using errcode='22023'; end if;
  return private.whatsapp_campaign_bind_success(j.id,p_provider_message_id,p_provider_timestamp,jsonb_build_object('reconcile',p_evidence),p_actor_type,p_actor_id)
    ||jsonb_build_object('resolution','sent');
end;$$;
revoke all on function private.whatsapp_campaign_resolve_reconcile(uuid,text,text,timestamptz,jsonb,text,uuid) from public,anon,authenticated;

create or replace function public.resolve_whatsapp_campaign_dispatch_reconcile(
  p_job_id uuid,p_resolution text,p_provider_message_id text default null,p_provider_timestamp timestamptz default null,p_evidence jsonb default '{}'::jsonb
)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
begin
  perform private.whatsapp_campaign_require_service_role();
  return private.whatsapp_campaign_resolve_reconcile(p_job_id,p_resolution,p_provider_message_id,p_provider_timestamp,coalesce(p_evidence,'{}'::jsonb),'worker',null);
end;$$;
revoke all on function public.resolve_whatsapp_campaign_dispatch_reconcile(uuid,text,text,timestamptz,jsonb) from public,anon,authenticated;
grant execute on function public.resolve_whatsapp_campaign_dispatch_reconcile(uuid,text,text,timestamptz,jsonb) to service_role;

/* Super Admin audited decision for an ambiguous recipient. */
create or replace function public.resolve_whatsapp_campaign_reconcile(
  p_job_id uuid,p_resolution text,p_note text,p_provider_message_id text default null
)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare a uuid:=auth.uid(); v_note text:=trim(coalesce(p_note,''));
begin
  if a is null or not private.has_permission('whatsapp.campaigns.cancel') or not private.has_role('super_admin') then raise exception 'WHATSAPP_CAMPAIGN_RECONCILE_DENIED' using errcode='42501'; end if;
  if length(v_note) not between 8 and 500 then raise exception 'WHATSAPP_RECONCILE_NOTE_REQUIRED' using errcode='22023'; end if;
  return private.whatsapp_campaign_resolve_reconcile(p_job_id,p_resolution,nullif(trim(coalesce(p_provider_message_id,'')),''),null,jsonb_build_object('note',v_note),'staff',a);
end;$$;
revoke all on function public.resolve_whatsapp_campaign_reconcile(uuid,text,text,text) from public,anon;
grant execute on function public.resolve_whatsapp_campaign_reconcile(uuid,text,text,text) to authenticated;

-- 11. Test sends: registered internal staff destinations only, dispatched by the worker.
create or replace function private.whatsapp_campaign_test_destination_ok(p_profile_id uuid)
returns boolean language sql stable security definer set search_path='' as $$
  select exists(
    select 1 from public.profiles p
    where p.id=p_profile_id and p.status='active' and p.phone_e164 is not null
      and (private.whatsapp_campaign_actor_has_role(p.id,'super_admin') or private.whatsapp_campaign_actor_has_role(p.id,'sales_manager'))
  );
$$;
revoke all on function private.whatsapp_campaign_test_destination_ok(uuid) from public,anon,authenticated;

create or replace function public.list_whatsapp_campaign_test_destinations()
returns jsonb language plpgsql stable security definer set search_path='' as $$
begin
  if auth.uid() is null or not private.has_permission('whatsapp.campaigns.test_send') then raise exception 'WHATSAPP_CAMPAIGN_TEST_DENIED' using errcode='42501'; end if;
  return coalesce((
    select jsonb_agg(jsonb_build_object('profile_id',p.id,'label',coalesce(p.display_name,'Internal staff'),'phone_last4',right(p.phone_e164,4),'is_self',p.id=auth.uid())
      order by (p.id=auth.uid()) desc,coalesce(p.display_name,''),p.id)
    from public.profiles p where private.whatsapp_campaign_test_destination_ok(p.id)
  ),'[]'::jsonb);
end;$$;
revoke all on function public.list_whatsapp_campaign_test_destinations() from public,anon;
grant execute on function public.list_whatsapp_campaign_test_destinations() to authenticated;

create or replace function public.create_whatsapp_campaign_test_send(p_campaign_version_id uuid,p_destination_profile_id uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare
  a uuid:=auth.uid(); v public.campaign_versions%rowtype; s public.whatsapp_campaign_specs%rowtype;
  snap public.whatsapp_template_snapshots%rowtype; dest public.profiles%rowtype; tid uuid; v_problem text; v_params jsonb;
begin
  if a is null or not private.has_permission('whatsapp.campaigns.test_send') then raise exception 'WHATSAPP_CAMPAIGN_TEST_DENIED' using errcode='42501'; end if;
  select * into v from public.campaign_versions where id=p_campaign_version_id;
  if not found or v.intended_channels is distinct from array['whatsapp']::text[] or v.status='rejected' or not private.whatsapp_campaign_version_visible(v.status) then raise exception 'WHATSAPP_CAMPAIGN_TEST_INVALID' using errcode='22023'; end if;
  select * into s from public.whatsapp_campaign_specs where campaign_version_id=v.id;
  if not found then raise exception 'WHATSAPP_CAMPAIGN_SPEC_REQUIRED' using errcode='22023'; end if;
  v_problem:=private.whatsapp_campaign_template_problem(s.template_snapshot_id,null);
  if v_problem is not null then raise exception 'WHATSAPP_CAMPAIGN_TEMPLATE_NOT_SENDABLE: %',v_problem using errcode='22023'; end if;
  if not private.whatsapp_campaign_test_destination_ok(p_destination_profile_id) then raise exception 'WHATSAPP_CAMPAIGN_TEST_DESTINATION_NOT_REGISTERED' using errcode='42501'; end if;
  if (select count(*) from public.whatsapp_campaign_test_sends t where t.campaign_version_id=v.id and t.requested_by=a and t.created_at>clock_timestamp()-interval '1 hour')>=5
     or (select count(*) from public.whatsapp_campaign_test_sends t where t.campaign_version_id=v.id and t.created_at>clock_timestamp()-interval '24 hours')>=20 then
    raise exception 'WHATSAPP_CAMPAIGN_TEST_RATE_LIMITED' using errcode='22023';
  end if;
  select * into snap from public.whatsapp_template_snapshots where id=s.template_snapshot_id;
  select * into dest from public.profiles where id=p_destination_profile_id;
  -- Bound values use the staff member's own name: no customer data leaves in a test.
  v_params:=private.whatsapp_campaign_resolve_parameters(s.default_parameters,s.parameter_bindings,coalesce(dest.display_name,'Team Member'));
  v_problem:=private.whatsapp_template_parameters_problem(snap.components,v_params);
  if v_problem is not null then raise exception 'WHATSAPP_CAMPAIGN_TEST_PARAMETERS_INVALID: %',v_problem using errcode='22023'; end if;
  insert into public.whatsapp_campaign_test_sends(campaign_version_id,template_snapshot_id,requested_by,destination_profile_id,destination_label,destination_e164,template_parameters)
  values(v.id,snap.id,a,dest.id,left(coalesce(dest.display_name,'Internal staff'),120),dest.phone_e164,v_params) returning id into tid;
  return jsonb_build_object('test_send_id',tid,'outcome','pending');
end;$$;
revoke all on function public.create_whatsapp_campaign_test_send(uuid,uuid) from public,anon;
grant execute on function public.create_whatsapp_campaign_test_send(uuid,uuid) to authenticated;

create or replace function public.claim_whatsapp_campaign_test_sends(p_worker_id text,p_limit integer default 5)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare n integer:=greatest(1,least(coalesce(p_limit,5),20)); x record; v_out jsonb:='[]'::jsonb; tok uuid; v_problem text;
  snap public.whatsapp_template_snapshots%rowtype; wp public.whatsapp_phone_numbers%rowtype;
begin
  perform private.whatsapp_campaign_require_service_role();
  if length(trim(coalesce(p_worker_id,''))) not between 1 and 80 then raise exception 'WHATSAPP_WORKER_ID_INVALID' using errcode='22023'; end if;
  for x in select * from public.whatsapp_campaign_test_sends where outcome='pending' and claim_token is not null and claim_expires_at<clock_timestamp() limit 100 for update skip locked loop
    if x.provider_request_started_at is null then
      update public.whatsapp_campaign_test_sends set claim_token=null,claimed_at=null,claim_expires_at=null where id=x.id;
    else
      update public.whatsapp_campaign_test_sends set outcome='needs_reconcile',claim_token=null,claimed_at=null,claim_expires_at=null,last_error_code='claim_expired_after_provider_start',completed_at=clock_timestamp() where id=x.id;
    end if;
  end loop;
  for x in select * from public.whatsapp_campaign_test_sends where outcome='pending' and claim_token is null order by created_at,id limit n for update skip locked loop
    v_problem:=private.whatsapp_campaign_template_problem(x.template_snapshot_id,null);
    if v_problem is null and not private.whatsapp_campaign_test_destination_ok(x.destination_profile_id) then v_problem:='destination_not_registered'; end if;
    if v_problem is null and x.created_at<clock_timestamp()-interval '1 hour' then v_problem:='test_send_expired'; end if;
    select * into snap from public.whatsapp_template_snapshots where id=x.template_snapshot_id;
    wp:=null;
    if v_problem is null then
      select p.* into wp from public.whatsapp_phone_numbers p where p.business_account_id=snap.business_account_id and p.status='active' order by p.created_at,p.id limit 1;
      if wp.id is null or private.whatsapp_business_sender_e164(wp.display_phone_number) is null then v_problem:='business_phone_unavailable'; end if;
    end if;
    if v_problem is not null then
      update public.whatsapp_campaign_test_sends set outcome='skipped',last_error_code=left(v_problem,128),completed_at=clock_timestamp() where id=x.id;
      continue;
    end if;
    tok:=gen_random_uuid();
    update public.whatsapp_campaign_test_sends set claim_token=tok,claimed_at=clock_timestamp(),claim_expires_at=clock_timestamp()+interval '120 seconds',phone_number_id=wp.id where id=x.id;
    v_out:=v_out||jsonb_build_array(jsonb_build_object(
      'test_send_id',x.id,'claim_token',tok,'phone_number_id',wp.phone_number_id,'recipient_e164',x.destination_e164,
      'template_name',snap.name,'template_language',snap.language,
      'template_components',private.whatsapp_build_template_send_components(snap.components,snap.parameter_format,x.template_parameters)
    ));
  end loop;
  return v_out;
end;$$;
revoke all on function public.claim_whatsapp_campaign_test_sends(text,integer) from public,anon,authenticated;
grant execute on function public.claim_whatsapp_campaign_test_sends(text,integer) to service_role;

create or replace function public.mark_whatsapp_campaign_test_send_started(p_test_send_id uuid,p_claim_token uuid)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare t public.whatsapp_campaign_test_sends%rowtype;
begin
  perform private.whatsapp_campaign_require_service_role();
  select * into t from public.whatsapp_campaign_test_sends where id=p_test_send_id for update;
  if not found or t.outcome<>'pending' or t.claim_token is distinct from p_claim_token or t.claim_expires_at<=clock_timestamp() then raise exception 'WHATSAPP_CAMPAIGN_TEST_NOT_CLAIMED' using errcode='P0002'; end if;
  update public.whatsapp_campaign_test_sends set provider_request_started_at=coalesce(provider_request_started_at,clock_timestamp()) where id=t.id;
  return jsonb_build_object('test_send_id',t.id,'provider_request_started',true);
end;$$;
revoke all on function public.mark_whatsapp_campaign_test_send_started(uuid,uuid) from public,anon,authenticated;
grant execute on function public.mark_whatsapp_campaign_test_send_started(uuid,uuid) to service_role;

create or replace function public.complete_whatsapp_campaign_test_send(
  p_test_send_id uuid,p_claim_token uuid,p_outcome text,p_provider_message_id text default null,p_error_code text default null
)
returns jsonb language plpgsql volatile security definer set search_path='' as $$
declare t public.whatsapp_campaign_test_sends%rowtype;
begin
  perform private.whatsapp_campaign_require_service_role();
  if p_outcome is null or p_outcome not in ('succeeded','failed','needs_reconcile') then raise exception 'WHATSAPP_CAMPAIGN_TEST_OUTCOME_INVALID' using errcode='22023'; end if;
  if p_outcome='succeeded' and (p_provider_message_id is null or length(p_provider_message_id) not between 1 and 128) then raise exception 'WHATSAPP_PROVIDER_MESSAGE_ID_INVALID' using errcode='22023'; end if;
  select * into t from public.whatsapp_campaign_test_sends where id=p_test_send_id for update;
  if not found or t.outcome<>'pending' or t.claim_token is distinct from p_claim_token or t.provider_request_started_at is null then raise exception 'WHATSAPP_CAMPAIGN_TEST_NOT_PENDING' using errcode='P0002'; end if;
  update public.whatsapp_campaign_test_sends set outcome=p_outcome,provider_message_id=case when p_outcome='succeeded' then p_provider_message_id end,
    last_error_code=case when p_outcome='succeeded' then null else left(coalesce(p_error_code,p_outcome),128) end,
    claim_token=null,claimed_at=null,claim_expires_at=null,completed_at=clock_timestamp()
  where id=t.id;
  return jsonb_build_object('test_send_id',t.id,'outcome',p_outcome);
end;$$;
revoke all on function public.complete_whatsapp_campaign_test_send(uuid,uuid,text,text,text) from public,anon,authenticated;
grant execute on function public.complete_whatsapp_campaign_test_send(uuid,uuid,text,text,text) to service_role;
