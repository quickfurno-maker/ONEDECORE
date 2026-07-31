-- ONEDECORE Phase 5B — CRM Identity, Authorization & Core Data Foundation
-- Forward-only local migration. Do not apply to managed Supabase in this phase.
-- Extends RBAC for five-role CRM, lead-source catalogue, assignment/status RPCs, collaboration tables, RLS.

-- =============================================================================
-- A. RBAC extension — permissions, roles, legacy-safe mappings
-- =============================================================================

insert into public.permissions (code, name, description, is_system, is_active) values
  ('leads.read_all', 'Read All Sales Leads', 'Broad sales-lead visibility including unassigned queue (Super Admin, Sales Manager, legacy management)', true, true),
  ('leads.read_assigned', 'Read Assigned Leads Only', 'Assignment-scoped lead visibility (Sales Executive, legacy sales)', true, true),
  ('leads.assign', 'Assign and Reassign Leads', 'Allows changing lead ownership with audited history', true, true),
  ('leads.transition', 'Transition Lead Pipeline Status', 'Allows audited lead status transitions via CRM RPCs', true, true),
  ('sources.read', 'Read Lead Sources', 'Read active lead-source catalogue entries needed for CRM work', true, true),
  ('sources.manage', 'Manage Lead Sources', 'Super Admin catalogue mutation for lead sources', true, true),
  ('crm.notes.manage', 'Manage Lead Notes', 'Create lead notes on authorized leads', true, true),
  ('crm.follow_ups.manage', 'Manage Lead Follow-ups', 'Create and complete lead follow-ups on authorized leads', true, true),
  ('crm.activities.read', 'Read Lead Activities', 'Read staff activity log entries for visible leads', true, true)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  is_system = true,
  is_active = true;

-- Canonical Phase 5B operational roles (legacy roles retained; no user_roles remapping)
insert into public.roles (code, name, description, is_system) values
  ('sales_manager', 'Sales Manager', 'Full sales pipeline visibility, assignment authority, and team coordination', true),
  ('sales_executive', 'Sales Executive', 'Assigned-lead-only CRM access without reassignment or catalogue mutation', true),
  ('project_manager', 'Project Manager', 'Future assigned-project access (Phase 8); no general CRM lead access in Phase 5B', true)
on conflict (code) do update set
  name = excluded.name,
  description = excluded.description,
  is_system = true;

-- Document legacy role deprecation without deleting records or remapping users
update public.roles set description = description || ' [LEGACY: prefer sales_manager in Phase 5B+; retained for existing assignments]'
where code = 'management' and is_system = true and description not like '%[LEGACY:%';

update public.roles set description = description || ' [LEGACY: prefer sales_executive in Phase 5B+; leads.read narrowed to assignment scope]'
where code = 'sales' and is_system = true and description not like '%[LEGACY:%';

update public.roles set description = description || ' [LEGACY: prefer project_manager in Phase 5B+; no CRM lead access]'
where code = 'project_operations' and is_system = true and description not like '%[LEGACY:%';

-- Narrow legacy sales: remove broad leads.read; grant assignment-scoped read instead
delete from public.role_permissions rp
using public.roles r, public.permissions p
where rp.role_id = r.id
  and rp.permission_id = p.id
  and r.code = 'sales'
  and r.is_system = true
  and p.code = 'leads.read';

insert into public.role_permissions (role_id, permission_id)
select r.id, p.id
from public.roles r
cross join public.permissions p
where r.is_system = true
  and p.is_system = true
  and (
    -- Super Admin: all CRM permissions + legacy lead permissions
    (r.code = 'super_admin' and p.code in (
      'leads.read', 'leads.read_all', 'leads.read_assigned', 'leads.manage', 'leads.assign', 'leads.transition',
      'consents.read', 'lead_intake.audit', 'sources.read', 'sources.manage',
      'crm.notes.manage', 'crm.follow_ups.manage', 'crm.activities.read'
    ))
    -- Legacy management mirrors Sales Manager breadth
    or (r.code = 'management' and p.code in (
      'leads.read', 'leads.read_all', 'leads.manage', 'leads.assign', 'leads.transition',
      'consents.read', 'lead_intake.audit', 'sources.read',
      'crm.notes.manage', 'crm.follow_ups.manage', 'crm.activities.read'
    ))
    -- Canonical Sales Manager
    or (r.code = 'sales_manager' and p.code in (
      'leads.read_all', 'leads.manage', 'leads.assign', 'leads.transition',
      'consents.read', 'sources.read',
      'crm.notes.manage', 'crm.follow_ups.manage', 'crm.activities.read'
    ))
    -- Legacy sales: assignment-scoped (leads.read removed above)
    or (r.code = 'sales' and p.code in (
      'leads.read_assigned', 'leads.manage', 'leads.transition',
      'consents.read', 'sources.read',
      'crm.notes.manage', 'crm.follow_ups.manage', 'crm.activities.read'
    ))
    -- Canonical Sales Executive
    or (r.code = 'sales_executive' and p.code in (
      'leads.read_assigned', 'leads.transition',
      'consents.read', 'sources.read',
      'crm.notes.manage', 'crm.follow_ups.manage', 'crm.activities.read'
    ))
    -- Project Manager / Designer / legacy project_operations: no CRM lead permissions
    -- content_manager: unchanged (portfolio dependency only via admin.access + future grants)
  )
on conflict (role_id, permission_id) do nothing;

-- =============================================================================
-- B. Controlled lead-source catalogue
-- =============================================================================

create table public.lead_sources (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  display_name text not null,
  description text,
  display_order smallint not null default 0,
  is_active boolean not null default true,
  is_system boolean not null default false,
  created_by uuid references public.profiles (id) on delete set null,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_lead_sources_code unique (code),
  constraint chk_lead_sources_code check (code ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint chk_lead_sources_display_name check (length(trim(display_name)) between 2 and 120),
  constraint chk_lead_sources_description check (description is null or length(description) <= 500),
  constraint chk_lead_sources_display_order check (display_order between 0 and 9999)
);

comment on table public.lead_sources is
  'Controlled marketing source catalogue. primary_source_id on leads is authoritative; leads.source retains legacy intake transport codes.';

create index idx_lead_sources_active_order on public.lead_sources (is_active, display_order, display_name);

create trigger trg_lead_sources_updated_at
  before update on public.lead_sources
  for each row execute function private.set_updated_at();

insert into public.lead_sources (code, display_name, display_order) values
  ('website', 'Website', 10),
  ('website_planner', 'Website Planner', 20),
  ('google_organic', 'Google Organic', 30),
  ('google_ads', 'Google Ads', 40),
  ('google_business_profile', 'Google Business Profile', 50),
  ('instagram_organic', 'Instagram Organic', 60),
  ('instagram_ads', 'Instagram Ads', 70),
  ('facebook_organic', 'Facebook Organic', 80),
  ('facebook_ads', 'Facebook Ads', 90),
  ('whatsapp', 'WhatsApp', 100),
  ('phone_call', 'Phone Call', 110),
  ('walk_in', 'Walk-in', 120),
  ('client_referral', 'Client Referral', 130),
  ('vendor_referral', 'Vendor Referral', 140),
  ('architect_referral', 'Architect Referral', 150),
  ('interior_partner', 'Interior Partner', 160),
  ('housing_society', 'Housing Society', 170),
  ('event_or_exhibition', 'Event or Exhibition', 180),
  ('offline_advertisement', 'Offline Advertisement', 190),
  ('manual_entry', 'Manual Entry', 200),
  ('other', 'Other', 210)
on conflict (code) do update set
  display_name = excluded.display_name,
  display_order = excluded.display_order,
  is_active = true,
  is_system = true;

update public.lead_sources set is_system = true;

-- =============================================================================
-- Lead pipeline reconciliation columns + authoritative primary source
-- =============================================================================

alter table public.leads
  add column if not exists primary_source_id uuid references public.lead_sources (id) on delete restrict,
  add column if not exists entry_method text,
  add column if not exists closed_lost_reason_id uuid,
  add column if not exists closed_lost_note text,
  add column if not exists on_hold_reason text,
  add column if not exists on_hold_since timestamptz;

comment on column public.leads.source is
  'Legacy intake transport code (website-planner, local-test). Authoritative marketing source is primary_source_id.';
comment on column public.leads.entry_method is
  'How the lead entered CRM (public_intake, local_test, manual, import). Distinct from marketing source.';

-- Map legacy statuses before replacing constraint
update public.leads set status = case status
  when 'won' then 'closed_won'
  when 'lost' then 'closed_lost'
  when 'dormant' then 'on_hold'
  when 'do_not_contact' then 'closed_lost'
  when 'site_visit_scheduled' then 'consultation_scheduled'
  else status
end;

update public.leads set status = 'assigned'
where assigned_to is not null and status = 'new';

-- Backfill primary source from legacy transport codes
update public.leads l
set primary_source_id = s.id,
    entry_method = coalesce(l.entry_method, case l.source
      when 'website-planner' then 'public_intake'
      when 'local-test' then 'local_test'
      else 'manual'
    end)
from public.lead_sources s
where l.primary_source_id is null
  and s.code = case l.source
    when 'website-planner' then 'website_planner'
    when 'local-test' then 'website_planner'
    else 'manual_entry'
  end;

alter table public.leads
  alter column primary_source_id set not null,
  alter column entry_method set not null;

alter table public.leads drop constraint if exists chk_leads_status;
alter table public.leads add constraint chk_leads_status check (
  status in (
    'new',
    'assigned',
    'contacted',
    'qualified',
    'consultation_scheduled',
    'proposal_sent',
    'negotiation',
    'closed_won',
    'closed_lost',
    'on_hold'
  )
);

alter table public.leads add constraint chk_leads_status_assignment_invariant check (
  (status = 'assigned' and assigned_to is not null)
  or (status = 'new' and assigned_to is null)
  or status not in ('new', 'assigned')
);

alter table public.leads add constraint chk_leads_entry_method check (
  entry_method in ('public_intake', 'local_test', 'manual', 'import')
);

alter table public.leads add constraint chk_leads_closed_lost_note check (
  closed_lost_note is null or length(trim(closed_lost_note)) between 3 and 1000
);

alter table public.leads add constraint chk_leads_on_hold_reason check (
  on_hold_reason is null or length(trim(on_hold_reason)) between 3 and 500
);

create index idx_leads_primary_source on public.leads (primary_source_id);

-- =============================================================================
-- E. Loss reason foundation (minimal catalogue + mandatory note on close)
-- =============================================================================

create table public.lead_closure_reasons (
  id uuid primary key default gen_random_uuid(),
  code text not null,
  display_name text not null,
  requires_note boolean not null default false,
  is_active boolean not null default true,
  display_order smallint not null default 0,
  created_at timestamptz not null default now(),

  constraint uq_lead_closure_reasons_code unique (code),
  constraint chk_lead_closure_reasons_code check (code ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint chk_lead_closure_reasons_display_name check (length(trim(display_name)) between 2 and 120)
);

comment on table public.lead_closure_reasons is
  'Minimal Closed-Lost reason catalogue. closed_lost_note on leads is always required at transition time.';

insert into public.lead_closure_reasons (code, display_name, requires_note, display_order) values
  ('price', 'Price / Budget', false, 10),
  ('competitor', 'Chose Competitor', false, 20),
  ('timing', 'Timing / Not Ready', false, 30),
  ('no_response', 'No Response', false, 40),
  ('not_qualified', 'Not Qualified', false, 50),
  ('other', 'Other', true, 60)
on conflict (code) do nothing;

alter table public.leads
  add constraint fk_leads_closed_lost_reason
  foreign key (closed_lost_reason_id) references public.lead_closure_reasons (id) on delete restrict;

-- =============================================================================
-- C. Source touchpoint history (append-only)
-- =============================================================================

create table public.lead_source_touchpoints (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete restrict,
  source_id uuid not null references public.lead_sources (id) on delete restrict,
  touchpoint_kind text not null default 'first',
  occurred_at timestamptz not null default now(),
  source_detail text,
  campaign_reference text,
  recorded_by uuid references public.profiles (id) on delete set null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint chk_lead_source_touchpoints_kind check (
    touchpoint_kind in ('first', 'additional', 'latest')
  ),
  constraint chk_lead_source_touchpoints_detail check (
    source_detail is null or length(source_detail) <= 500
  ),
  constraint chk_lead_source_touchpoints_campaign check (
    campaign_reference is null or length(campaign_reference) <= 120
  ),
  constraint chk_lead_source_touchpoints_metadata check (
    jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 2048
  )
);

comment on table public.lead_source_touchpoints is
  'Append-only marketing touchpoint history. RLS follows lead visibility.';

create index idx_lead_source_touchpoints_lead on public.lead_source_touchpoints (lead_id, occurred_at desc);

-- Backfill first touchpoint for existing leads
insert into public.lead_source_touchpoints (lead_id, source_id, touchpoint_kind, occurred_at, source_detail, metadata)
select
  l.id,
  l.primary_source_id,
  'first',
  l.created_at,
  l.source,
  jsonb_build_object('entry_method', l.entry_method, 'backfill', true)
from public.leads l
where not exists (
  select 1 from public.lead_source_touchpoints t where t.lead_id = l.id
);

-- =============================================================================
-- F. Assignment history (append-only)
-- =============================================================================

create table public.lead_assignment_history (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete restrict,
  previous_assignee uuid references public.profiles (id) on delete set null,
  new_assignee uuid references public.profiles (id) on delete set null,
  assignment_method text not null,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  occurred_at timestamptz not null default now(),
  reason text,
  metadata jsonb not null default '{}'::jsonb,

  constraint chk_lead_assignment_history_method check (
    assignment_method in ('manual', 'manager', 'super_admin', 'source_rule', 'system')
  ),
  constraint chk_lead_assignment_history_reason check (
    reason is null or length(trim(reason)) between 1 and 500
  ),
  constraint chk_lead_assignment_history_metadata check (
    jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 2048
  )
);

comment on table public.lead_assignment_history is
  'Append-only assignment audit. leads.assigned_to is the current owner pointer.';

create index idx_lead_assignment_history_lead on public.lead_assignment_history (lead_id, occurred_at desc);

-- =============================================================================
-- G. Collaboration tables
-- =============================================================================

create table public.lead_notes (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete restrict,
  body text not null,
  created_by uuid not null references public.profiles (id) on delete restrict,
  created_at timestamptz not null default now(),

  constraint chk_lead_notes_body check (length(trim(body)) between 1 and 4000)
);

comment on table public.lead_notes is
  'Append-only lead notes. Corrections are future versioned operations; no hard delete via Data API.';

create index idx_lead_notes_lead on public.lead_notes (lead_id, created_at desc);

create table public.lead_follow_ups (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete restrict,
  owner_id uuid not null references public.profiles (id) on delete restrict,
  due_at timestamptz not null,
  status text not null default 'open',
  outcome text,
  created_by uuid not null references public.profiles (id) on delete restrict,
  completed_by uuid references public.profiles (id) on delete set null,
  cancelled_by uuid references public.profiles (id) on delete set null,
  completed_at timestamptz,
  cancelled_at timestamptz,
  created_at timestamptz not null default now(),

  constraint chk_lead_follow_ups_status check (status in ('open', 'completed', 'cancelled')),
  constraint chk_lead_follow_ups_outcome check (outcome is null or length(trim(outcome)) between 1 and 1000),
  constraint chk_lead_follow_ups_lifecycle check (
    (status = 'open' and completed_at is null and cancelled_at is null)
    or (status = 'completed' and completed_at is not null and cancelled_at is null)
    or (status = 'cancelled' and cancelled_at is not null and completed_at is null)
  )
);

comment on table public.lead_follow_ups is 'Scheduled follow-up tasks scoped through lead visibility.';

create index idx_lead_follow_ups_lead_due on public.lead_follow_ups (lead_id, due_at);

-- Business interaction log; lead_events remains authoritative intake/system stream
create table public.lead_activities (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null references public.leads (id) on delete restrict,
  activity_type text not null,
  reference_id uuid,
  occurred_at timestamptz not null default now(),
  actor_id uuid references public.profiles (id) on delete set null,
  summary text not null,
  metadata jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint chk_lead_activities_type check (
    activity_type in (
      'note.created',
      'follow_up.scheduled',
      'follow_up.completed',
      'follow_up.cancelled',
      'status.changed',
      'assignment.changed'
    )
  ),
  constraint chk_lead_activities_summary check (length(trim(summary)) between 1 and 500),
  constraint chk_lead_activities_metadata check (
    jsonb_typeof(metadata) = 'object' and pg_column_size(metadata) <= 2048
  )
);

comment on table public.lead_activities is
  'Staff-facing interaction log. System/intake events remain in lead_events; reference_id links domain rows without duplicate truth.';

create unique index uq_lead_activities_dedupe
  on public.lead_activities (lead_id, activity_type, reference_id)
  where reference_id is not null;

create index idx_lead_activities_lead on public.lead_activities (lead_id, occurred_at desc);

-- Extend lead_events types for CRM transitions (append-only stream)
alter table public.lead_events drop constraint if exists chk_lead_events_type;
alter table public.lead_events add constraint chk_lead_events_type check (
  event_type in (
    'lead.created',
    'lead.status_changed',
    'lead.assigned',
    'lead.note_added',
    'lead.duplicate_detected',
    'lead.consent_updated',
    'lead.on_hold',
    'lead.resumed'
  )
);

-- =============================================================================
-- Private CRM authorization helpers
-- =============================================================================

create or replace function private.crm_has_broad_lead_read()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select public.authorize('leads.read_all'))
    or (
      (select public.authorize('leads.read'))
      and not (select public.authorize('leads.read_assigned'))
    );
$$;

create or replace function private.crm_can_view_lead(p_assigned_to uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.crm_has_broad_lead_read())
    or (
      (select public.authorize('leads.read_assigned'))
      and p_assigned_to is not null
      and p_assigned_to = (select auth.uid())
    );
$$;

create or replace function private.crm_can_view_contact(p_contact_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    (select private.crm_has_broad_lead_read())
    or (
      (select public.authorize('leads.read_assigned'))
      and exists (
        select 1
        from public.leads l
        where l.contact_id = p_contact_id
          and l.assigned_to = (select auth.uid())
      )
    );
$$;

create or replace function private.crm_can_mutate_lead(p_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.leads l
    where l.id = p_lead_id
      and (
        (
          (select private.crm_has_broad_lead_read())
          and (
            (select public.authorize('leads.manage'))
            or (select public.authorize('leads.transition'))
            or (select public.authorize('crm.notes.manage'))
            or (select public.authorize('crm.follow_ups.manage'))
          )
        )
        or (
          (select public.authorize('leads.read_assigned'))
          and l.assigned_to = (select auth.uid())
          and (
            (select public.authorize('leads.transition'))
            or (select public.authorize('crm.notes.manage'))
            or (select public.authorize('crm.follow_ups.manage'))
          )
        )
      )
  );
$$;

create or replace function private.crm_derive_human_assignment_method()
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
begin
  if (select private.has_role('super_admin')) then
    return 'super_admin';
  end if;
  if (select private.has_role('sales_manager')) or (select private.has_role('management')) then
    return 'manager';
  end if;
  return 'manual';
end;
$$;

create or replace function private.crm_is_assignable_sales_user(p_user_id uuid)
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
      and r.code in ('sales_executive', 'sales')
  );
$$;

revoke all on function private.crm_has_broad_lead_read() from public, anon;
revoke all on function private.crm_can_view_lead(uuid) from public, anon;
revoke all on function private.crm_can_view_contact(uuid) from public, anon;
revoke all on function private.crm_can_mutate_lead(uuid) from public, anon;
revoke all on function private.crm_is_assignable_sales_user(uuid) from public, anon;
grant execute on function private.crm_has_broad_lead_read() to authenticated;
grant execute on function private.crm_can_view_lead(uuid) to authenticated;
grant execute on function private.crm_can_view_contact(uuid) to authenticated;
grant execute on function private.crm_can_mutate_lead(uuid) to authenticated;
grant execute on function private.crm_is_assignable_sales_user(uuid) to authenticated;

-- =============================================================================
-- Append-only / bypass-prevention triggers
-- =============================================================================

create or replace function private.forbid_append_only_mutation()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  raise exception '% is append-only', TG_TABLE_NAME using errcode = '55000';
end;
$$;

create or replace function private.forbid_direct_lead_owner_status_update()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if current_setting('onedecore.crm_transition', true) = '1' then
    return NEW;
  end if;
  if TG_OP = 'UPDATE' and (
    NEW.status is distinct from OLD.status
    or NEW.assigned_to is distinct from OLD.assigned_to
    or NEW.closed_lost_reason_id is distinct from OLD.closed_lost_reason_id
    or NEW.closed_lost_note is distinct from OLD.closed_lost_note
    or NEW.on_hold_reason is distinct from OLD.on_hold_reason
    or NEW.on_hold_since is distinct from OLD.on_hold_since
  ) then
    raise exception 'Direct lead pipeline mutation forbidden; use CRM RPCs'
      using errcode = '42501';
  end if;
  return NEW;
end;
$$;

create trigger trg_leads_no_direct_pipeline_update
  before update on public.leads
  for each row execute function private.forbid_direct_lead_owner_status_update();

create or replace function private.trg_leads_before_insert_source_enrichment()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_source_id uuid;
begin
  if NEW.primary_source_id is null then
    select ls.id into v_source_id
    from public.lead_sources ls
    where ls.code = case NEW.source
      when 'website-planner' then 'website_planner'
      when 'local-test' then 'website_planner'
      else 'manual_entry'
    end;
    NEW.primary_source_id := v_source_id;
  end if;
  if NEW.entry_method is null then
    NEW.entry_method := case NEW.source
      when 'website-planner' then 'public_intake'
      when 'local-test' then 'local_test'
      else 'manual'
    end;
  end if;
  return NEW;
end;
$$;

create trigger trg_leads_before_insert_source_enrichment
  before insert on public.leads
  for each row execute function private.trg_leads_before_insert_source_enrichment();

create or replace function private.trg_leads_after_insert_touchpoint()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.lead_source_touchpoints (
    lead_id, source_id, touchpoint_kind, occurred_at, source_detail, metadata
  ) values (
    NEW.id,
    NEW.primary_source_id,
    'first',
    NEW.created_at,
    NEW.source,
    jsonb_build_object('entry_method', NEW.entry_method)
  );
  return NEW;
end;
$$;

create trigger trg_leads_after_insert_touchpoint
  after insert on public.leads
  for each row execute function private.trg_leads_after_insert_touchpoint();

-- Prevent duplicate touchpoint from backfill + trigger on fresh DB reset order: backfill runs before triggers on existing only

create trigger trg_lead_source_touchpoints_no_update
  before update on public.lead_source_touchpoints
  for each row execute function private.forbid_append_only_mutation();
create trigger trg_lead_source_touchpoints_no_delete
  before delete on public.lead_source_touchpoints
  for each row execute function private.forbid_append_only_mutation();

create trigger trg_lead_assignment_history_no_update
  before update on public.lead_assignment_history
  for each row execute function private.forbid_append_only_mutation();
create trigger trg_lead_assignment_history_no_delete
  before delete on public.lead_assignment_history
  for each row execute function private.forbid_append_only_mutation();

create trigger trg_lead_notes_no_update
  before update on public.lead_notes
  for each row execute function private.forbid_append_only_mutation();
create trigger trg_lead_notes_no_delete
  before delete on public.lead_notes
  for each row execute function private.forbid_append_only_mutation();

create trigger trg_lead_activities_no_update
  before update on public.lead_activities
  for each row execute function private.forbid_append_only_mutation();
create trigger trg_lead_activities_no_delete
  before delete on public.lead_activities
  for each row execute function private.forbid_append_only_mutation();

create or replace function private.lead_notes_set_creator()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if auth.uid() is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;
  NEW.created_by := auth.uid();
  return NEW;
end;
$$;

create trigger trg_lead_notes_set_creator
  before insert on public.lead_notes
  for each row execute function private.lead_notes_set_creator();

create or replace function private.trg_lead_notes_after_insert_activity()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.lead_activities (
    lead_id, activity_type, reference_id, actor_id, summary, metadata
  ) values (
    NEW.lead_id,
    'note.created',
    NEW.id,
    NEW.created_by,
    left(trim(NEW.body), 120),
    jsonb_build_object('noteId', NEW.id)
  );
  return NEW;
end;
$$;

create trigger trg_lead_notes_after_insert_activity
  after insert on public.lead_notes
  for each row execute function private.trg_lead_notes_after_insert_activity();

create trigger trg_lead_sources_no_delete
  before delete on public.lead_sources
  for each row execute function private.forbid_append_only_mutation();

revoke execute on function private.forbid_append_only_mutation() from public, anon, authenticated;
revoke execute on function private.forbid_direct_lead_owner_status_update() from public, anon, authenticated;
revoke execute on function private.trg_leads_before_insert_source_enrichment() from public, anon, authenticated;
revoke execute on function private.trg_leads_after_insert_touchpoint() from public, anon, authenticated;
revoke execute on function private.lead_notes_set_creator() from public, anon, authenticated;
revoke execute on function private.trg_lead_notes_after_insert_activity() from public, anon, authenticated;
revoke all on function private.crm_derive_human_assignment_method() from public, anon;
grant execute on function private.crm_derive_human_assignment_method() to authenticated;

-- =============================================================================
-- F. Assignment + status transition RPCs (INVOKER wrapper + DEFINER impl)
-- =============================================================================

create or replace function private.assign_lead_impl(
  p_lead_id uuid,
  p_assignee_id uuid,
  p_reason text default null
)
returns public.leads
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_lead public.leads%rowtype;
  v_prev uuid;
  v_method text;
  v_history_id uuid;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not (select public.authorize('leads.assign')) then
    raise exception 'Permission denied to assign leads' using errcode = '42501';
  end if;

  if p_assignee_id is not null and not (select private.crm_is_assignable_sales_user(p_assignee_id)) then
    raise exception 'Assignee is not an active eligible sales user' using errcode = '22023';
  end if;

  v_method := private.crm_derive_human_assignment_method();

  select * into v_lead from public.leads where id = p_lead_id for update;
  if not found then
    raise exception 'Lead % not found', p_lead_id using errcode = 'P0002';
  end if;

  v_prev := v_lead.assigned_to;
  if v_prev is not distinct from p_assignee_id then
    return v_lead;
  end if;

  perform set_config('onedecore.crm_transition', '1', true);

  update public.leads
  set assigned_to = p_assignee_id,
      status = case
        when p_assignee_id is not null and status = 'new' then 'assigned'
        when p_assignee_id is null and status = 'assigned' then 'new'
        else status
      end,
      updated_at = now()
  where id = p_lead_id
  returning * into v_lead;

  insert into public.lead_assignment_history (
    lead_id, previous_assignee, new_assignee, assignment_method, actor_id, reason
  ) values (
    p_lead_id, v_prev, p_assignee_id, v_method, v_actor, nullif(trim(coalesce(p_reason, '')), '')
  )
  returning id into v_history_id;

  insert into public.lead_events (lead_id, event_type, actor_id, actor_type, event_data)
  values (
    p_lead_id,
    'lead.assigned',
    v_actor,
    'staff',
    jsonb_build_object(
      'previousAssignee', v_prev,
      'newAssignee', p_assignee_id,
      'method', v_method
    )
  );

  insert into public.lead_activities (lead_id, activity_type, reference_id, actor_id, summary, metadata)
  values (
    p_lead_id,
    'assignment.changed',
    v_history_id,
    v_actor,
    case
      when p_assignee_id is null then 'Lead unassigned'
      else 'Lead assigned'
    end,
    jsonb_build_object('previousAssignee', v_prev, 'newAssignee', p_assignee_id, 'method', v_method)
  );

  perform set_config('onedecore.crm_transition', '0', true);
  return v_lead;
end;
$$;

create or replace function private.transition_lead_status_impl(
  p_lead_id uuid,
  p_new_status text,
  p_reason text default null,
  p_closure_reason_code text default null
)
returns public.leads
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_lead public.leads%rowtype;
  v_old text;
  v_reason_id uuid;
  v_allowed boolean := false;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not (select public.authorize('leads.transition')) then
    raise exception 'Permission denied to transition lead status' using errcode = '42501';
  end if;

  if p_new_status in ('new', 'assigned') then
    raise exception 'Status % must be changed via assign_lead only', p_new_status using errcode = '22023';
  end if;

  if p_new_status = 'closed_won' then
    raise exception 'CLOSED_WON_REQUIRES_QUOTATION_ACCEPTANCE'
      using errcode = 'P0001', hint = 'Phase 7B quotation acceptance required';
  end if;

  select * into v_lead from public.leads where id = p_lead_id for update;
  if not found then
    raise exception 'Lead % not found', p_lead_id using errcode = 'P0002';
  end if;

  if not (select private.crm_can_mutate_lead(p_lead_id)) then
    raise exception 'Lead not visible for status transition' using errcode = '42501';
  end if;

  v_old := v_lead.status;
  if v_old = p_new_status then
    return v_lead;
  end if;

  if v_old in ('closed_won', 'closed_lost') then
    raise exception 'Terminal lead status cannot be changed in Phase 5B' using errcode = '22023';
  end if;

  v_allowed := case
    when v_old = 'new' and p_new_status in ('contacted', 'closed_lost', 'on_hold') then true
    when v_old = 'assigned' and p_new_status in ('contacted', 'closed_lost', 'on_hold') then true
    when v_old = 'contacted' and p_new_status in ('qualified', 'closed_lost', 'on_hold') then true
    when v_old = 'qualified' and p_new_status in ('consultation_scheduled', 'closed_lost', 'on_hold') then true
    when v_old = 'consultation_scheduled' and p_new_status in ('proposal_sent', 'closed_lost', 'on_hold') then true
    when v_old = 'proposal_sent' and p_new_status in ('negotiation', 'closed_lost', 'on_hold') then true
    when v_old = 'negotiation' and p_new_status in ('closed_lost', 'on_hold') then true
    when v_old = 'on_hold' and p_new_status in ('contacted', 'qualified', 'consultation_scheduled', 'proposal_sent', 'negotiation') then true
    else false
  end;

  if not v_allowed then
    raise exception 'Invalid lead status transition: % -> %', v_old, p_new_status using errcode = '22023';
  end if;

  if p_new_status = 'closed_lost' then
    if nullif(trim(coalesce(p_reason, '')), '') is null then
      raise exception 'CLOSED_LOST_REQUIRES_REASON' using errcode = '22023';
    end if;
    if p_closure_reason_code is not null then
      select id into v_reason_id from public.lead_closure_reasons
      where code = p_closure_reason_code and is_active = true;
      if v_reason_id is null then
        raise exception 'Invalid closure reason code: %', p_closure_reason_code using errcode = '22023';
      end if;
    else
      select id into v_reason_id from public.lead_closure_reasons where code = 'other' and is_active = true;
    end if;
  end if;

  perform set_config('onedecore.crm_transition', '1', true);

  update public.leads
  set status = p_new_status,
      closed_lost_reason_id = case when p_new_status = 'closed_lost' then v_reason_id else closed_lost_reason_id end,
      closed_lost_note = case when p_new_status = 'closed_lost' then nullif(trim(p_reason), '') else closed_lost_note end,
      on_hold_reason = case when p_new_status = 'on_hold' then nullif(trim(p_reason), '') else null end,
      on_hold_since = case when p_new_status = 'on_hold' then now() else null end,
      updated_at = now()
  where id = p_lead_id
  returning * into v_lead;

  insert into public.lead_events (lead_id, event_type, actor_id, actor_type, event_data)
  values (
    p_lead_id,
    case when p_new_status = 'on_hold' then 'lead.on_hold'
         when v_old = 'on_hold' then 'lead.resumed'
         else 'lead.status_changed' end,
    v_actor,
    'staff',
    jsonb_build_object('from', v_old, 'to', p_new_status, 'reason', p_reason)
  );

  insert into public.lead_activities (lead_id, activity_type, actor_id, summary, metadata)
  values (
    p_lead_id,
    'status.changed',
    v_actor,
    format('Status changed from %s to %s', v_old, p_new_status),
    jsonb_build_object('from', v_old, 'to', p_new_status)
  );

  perform set_config('onedecore.crm_transition', '0', true);
  return v_lead;
end;
$$;

create or replace function private.create_lead_follow_up_impl(
  p_lead_id uuid,
  p_due_at timestamptz,
  p_owner_id uuid default null
)
returns public.lead_follow_ups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_owner uuid;
  v_row public.lead_follow_ups%rowtype;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not (select public.authorize('crm.follow_ups.manage')) then
    raise exception 'Permission denied to manage follow-ups' using errcode = '42501';
  end if;

  if not (select private.crm_can_mutate_lead(p_lead_id)) then
    raise exception 'Lead not visible for follow-up creation' using errcode = '42501';
  end if;

  if (select private.crm_has_broad_lead_read()) then
    v_owner := coalesce(p_owner_id, v_actor);
    if not (select private.crm_is_assignable_sales_user(v_owner)) then
      raise exception 'Follow-up owner must be an active eligible sales user' using errcode = '22023';
    end if;
  else
    v_owner := v_actor;
    if p_owner_id is not null and p_owner_id is distinct from v_actor then
      raise exception 'Sales executives may only create self-owned follow-ups' using errcode = '42501';
    end if;
  end if;

  insert into public.lead_follow_ups (
    lead_id, owner_id, due_at, status, created_by
  ) values (
    p_lead_id, v_owner, p_due_at, 'open', v_actor
  )
  returning * into v_row;

  insert into public.lead_activities (lead_id, activity_type, reference_id, actor_id, summary, metadata)
  values (
    p_lead_id,
    'follow_up.scheduled',
    v_row.id,
    v_actor,
    'Follow-up scheduled',
    jsonb_build_object('dueAt', p_due_at, 'ownerId', v_owner)
  );

  return v_row;
end;
$$;

create or replace function private.complete_lead_follow_up_impl(
  p_follow_up_id uuid,
  p_outcome text default null
)
returns public.lead_follow_ups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_row public.lead_follow_ups%rowtype;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_row from public.lead_follow_ups where id = p_follow_up_id for update;
  if not found then
    raise exception 'Follow-up % not found', p_follow_up_id using errcode = 'P0002';
  end if;

  if not (select private.crm_can_mutate_lead(v_row.lead_id)) then
    raise exception 'Lead not visible for follow-up completion' using errcode = '42501';
  end if;

  if v_row.status <> 'open' then
    raise exception 'Only open follow-ups can be completed' using errcode = '22023';
  end if;

  update public.lead_follow_ups
  set status = 'completed',
      outcome = nullif(trim(coalesce(p_outcome, '')), ''),
      completed_by = v_actor,
      completed_at = now()
  where id = p_follow_up_id
  returning * into v_row;

  insert into public.lead_activities (lead_id, activity_type, reference_id, actor_id, summary, metadata)
  values (
    v_row.lead_id,
    'follow_up.completed',
    v_row.id,
    v_actor,
    'Follow-up completed',
    jsonb_build_object('outcome', v_row.outcome)
  );

  return v_row;
end;
$$;

create or replace function private.cancel_lead_follow_up_impl(
  p_follow_up_id uuid,
  p_outcome text default null
)
returns public.lead_follow_ups
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_row public.lead_follow_ups%rowtype;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  select * into v_row from public.lead_follow_ups where id = p_follow_up_id for update;
  if not found then
    raise exception 'Follow-up % not found', p_follow_up_id using errcode = 'P0002';
  end if;

  if not (select private.crm_can_mutate_lead(v_row.lead_id)) then
    raise exception 'Lead not visible for follow-up cancellation' using errcode = '42501';
  end if;

  if v_row.status <> 'open' then
    raise exception 'Only open follow-ups can be cancelled' using errcode = '22023';
  end if;

  update public.lead_follow_ups
  set status = 'cancelled',
      outcome = nullif(trim(coalesce(p_outcome, '')), ''),
      cancelled_by = v_actor,
      cancelled_at = now()
  where id = p_follow_up_id
  returning * into v_row;

  insert into public.lead_activities (lead_id, activity_type, reference_id, actor_id, summary, metadata)
  values (
    v_row.lead_id,
    'follow_up.cancelled',
    v_row.id,
    v_actor,
    'Follow-up cancelled',
    jsonb_build_object('outcome', v_row.outcome)
  );

  return v_row;
end;
$$;

create or replace function private.create_lead_source_impl(
  p_code text,
  p_display_name text,
  p_description text default null,
  p_display_order smallint default 0
)
returns public.lead_sources
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_row public.lead_sources%rowtype;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not (select public.authorize('sources.manage')) then
    raise exception 'Permission denied to manage lead sources' using errcode = '42501';
  end if;

  insert into public.lead_sources (
    code, display_name, description, display_order, is_active, is_system, created_by, updated_by
  ) values (
    p_code,
    p_display_name,
    p_description,
    coalesce(p_display_order, 0),
    true,
    false,
    v_actor,
    v_actor
  )
  returning * into v_row;

  return v_row;
end;
$$;

create or replace function private.update_lead_source_impl(
  p_source_id uuid,
  p_display_name text default null,
  p_description text default null,
  p_display_order smallint default null,
  p_is_active boolean default null
)
returns public.lead_sources
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_row public.lead_sources%rowtype;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'Authentication required' using errcode = '42501';
  end if;

  if not (select public.authorize('sources.manage')) then
    raise exception 'Permission denied to manage lead sources' using errcode = '42501';
  end if;

  update public.lead_sources
  set display_name = coalesce(nullif(trim(p_display_name), ''), display_name),
      description = coalesce(p_description, description),
      display_order = coalesce(p_display_order, display_order),
      is_active = coalesce(p_is_active, is_active),
      updated_by = v_actor,
      updated_at = now()
  where id = p_source_id
  returning * into v_row;

  if not found then
    raise exception 'Lead source % not found', p_source_id using errcode = 'P0002';
  end if;

  return v_row;
end;
$$;

create or replace function public.assign_lead(
  p_lead_id uuid,
  p_assignee_id uuid,
  p_reason text default null
)
returns public.leads
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.assign_lead_impl(p_lead_id, p_assignee_id, p_reason);
end;
$$;

create or replace function public.transition_lead_status(
  p_lead_id uuid,
  p_new_status text,
  p_reason text default null,
  p_closure_reason_code text default null
)
returns public.leads
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.transition_lead_status_impl(p_lead_id, p_new_status, p_reason, p_closure_reason_code);
end;
$$;

create or replace function public.create_lead_follow_up(
  p_lead_id uuid,
  p_due_at timestamptz,
  p_owner_id uuid default null
)
returns public.lead_follow_ups
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.create_lead_follow_up_impl(p_lead_id, p_due_at, p_owner_id);
end;
$$;

create or replace function public.complete_lead_follow_up(
  p_follow_up_id uuid,
  p_outcome text default null
)
returns public.lead_follow_ups
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.complete_lead_follow_up_impl(p_follow_up_id, p_outcome);
end;
$$;

create or replace function public.cancel_lead_follow_up(
  p_follow_up_id uuid,
  p_outcome text default null
)
returns public.lead_follow_ups
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.cancel_lead_follow_up_impl(p_follow_up_id, p_outcome);
end;
$$;

create or replace function public.create_lead_source(
  p_code text,
  p_display_name text,
  p_description text default null,
  p_display_order smallint default 0
)
returns public.lead_sources
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.create_lead_source_impl(p_code, p_display_name, p_description, p_display_order);
end;
$$;

create or replace function public.update_lead_source(
  p_source_id uuid,
  p_display_name text default null,
  p_description text default null,
  p_display_order smallint default null,
  p_is_active boolean default null
)
returns public.lead_sources
language plpgsql
security invoker
set search_path = ''
as $$
begin
  return private.update_lead_source_impl(p_source_id, p_display_name, p_description, p_display_order, p_is_active);
end;
$$;

alter function private.assign_lead_impl(uuid, uuid, text) owner to postgres;
alter function private.transition_lead_status_impl(uuid, text, text, text) owner to postgres;
alter function private.create_lead_follow_up_impl(uuid, timestamptz, uuid) owner to postgres;
alter function private.complete_lead_follow_up_impl(uuid, text) owner to postgres;
alter function private.cancel_lead_follow_up_impl(uuid, text) owner to postgres;
alter function private.create_lead_source_impl(text, text, text, smallint) owner to postgres;
alter function private.update_lead_source_impl(uuid, text, text, smallint, boolean) owner to postgres;
alter function private.crm_derive_human_assignment_method() owner to postgres;
alter function public.assign_lead(uuid, uuid, text) owner to postgres;
alter function public.transition_lead_status(uuid, text, text, text) owner to postgres;
alter function public.create_lead_follow_up(uuid, timestamptz, uuid) owner to postgres;
alter function public.complete_lead_follow_up(uuid, text) owner to postgres;
alter function public.cancel_lead_follow_up(uuid, text) owner to postgres;
alter function public.create_lead_source(text, text, text, smallint) owner to postgres;
alter function public.update_lead_source(uuid, text, text, smallint, boolean) owner to postgres;

revoke all on function private.assign_lead_impl(uuid, uuid, text) from public, anon;
revoke all on function private.transition_lead_status_impl(uuid, text, text, text) from public, anon;
revoke all on function private.create_lead_follow_up_impl(uuid, timestamptz, uuid) from public, anon;
revoke all on function private.complete_lead_follow_up_impl(uuid, text) from public, anon;
revoke all on function private.cancel_lead_follow_up_impl(uuid, text) from public, anon;
revoke all on function private.create_lead_source_impl(text, text, text, smallint) from public, anon;
revoke all on function private.update_lead_source_impl(uuid, text, text, smallint, boolean) from public, anon;
revoke all on function private.crm_derive_human_assignment_method() from public, anon;
grant execute on function private.assign_lead_impl(uuid, uuid, text) to authenticated;
grant execute on function private.transition_lead_status_impl(uuid, text, text, text) to authenticated;
grant execute on function private.create_lead_follow_up_impl(uuid, timestamptz, uuid) to authenticated;
grant execute on function private.complete_lead_follow_up_impl(uuid, text) to authenticated;
grant execute on function private.cancel_lead_follow_up_impl(uuid, text) to authenticated;
grant execute on function private.create_lead_source_impl(text, text, text, smallint) to authenticated;
grant execute on function private.update_lead_source_impl(uuid, text, text, smallint, boolean) to authenticated;
revoke all on function public.assign_lead(uuid, uuid, text) from public, anon;
revoke all on function public.transition_lead_status(uuid, text, text, text) from public, anon;
revoke all on function public.create_lead_follow_up(uuid, timestamptz, uuid) from public, anon;
revoke all on function public.complete_lead_follow_up(uuid, text) from public, anon;
revoke all on function public.cancel_lead_follow_up(uuid, text) from public, anon;
revoke all on function public.create_lead_source(text, text, text, smallint) from public, anon;
revoke all on function public.update_lead_source(uuid, text, text, smallint, boolean) from public, anon;
grant execute on function public.assign_lead(uuid, uuid, text) to authenticated;
grant execute on function public.transition_lead_status(uuid, text, text, text) to authenticated;
grant execute on function public.create_lead_follow_up(uuid, timestamptz, uuid) to authenticated;
grant execute on function public.complete_lead_follow_up(uuid, text) to authenticated;
grant execute on function public.cancel_lead_follow_up(uuid, text) to authenticated;
grant execute on function public.create_lead_source(text, text, text, smallint) to authenticated;
grant execute on function public.update_lead_source(uuid, text, text, smallint, boolean) to authenticated;

-- =============================================================================
-- I. RLS + grants for new tables and corrected lead-domain policies
-- =============================================================================

-- Revoke direct lead pipeline updates (RPC-only)
revoke update (status, assigned_to) on table public.leads from authenticated;
drop policy if exists leads_update_manage on public.leads;

alter table public.lead_sources enable row level security;
alter table public.lead_closure_reasons enable row level security;
alter table public.lead_source_touchpoints enable row level security;
alter table public.lead_assignment_history enable row level security;
alter table public.lead_notes enable row level security;
alter table public.lead_follow_ups enable row level security;
alter table public.lead_activities enable row level security;

revoke all on table public.lead_sources from public, anon, authenticated;
revoke all on table public.lead_closure_reasons from public, anon, authenticated;
revoke all on table public.lead_source_touchpoints from public, anon, authenticated;
revoke all on table public.lead_assignment_history from public, anon, authenticated;
revoke all on table public.lead_notes from public, anon, authenticated;
revoke all on table public.lead_follow_ups from public, anon, authenticated;
revoke all on table public.lead_activities from public, anon, authenticated;

grant select on table public.lead_sources to authenticated;
grant select on table public.lead_closure_reasons to authenticated;
grant select on table public.lead_source_touchpoints to authenticated;
grant select on table public.lead_assignment_history to authenticated;
grant select on table public.lead_notes to authenticated;
grant select on table public.lead_follow_ups to authenticated;
grant select, insert on table public.lead_notes to authenticated;
grant select on table public.lead_activities to authenticated;

-- Replace broad lead-domain policies
drop policy if exists contacts_select_leads on public.contacts;
drop policy if exists contact_channels_select_leads on public.contact_channels;
drop policy if exists leads_select on public.leads;
drop policy if exists consent_events_select on public.consent_events;
drop policy if exists lead_events_select on public.lead_events;

create policy contacts_select_crm_scoped
  on public.contacts for select to authenticated
  using ((select private.crm_can_view_contact(id)));

create policy contact_channels_select_crm_scoped
  on public.contact_channels for select to authenticated
  using (
    exists (
      select 1 from public.contacts c
      where c.id = contact_channels.contact_id
        and (select private.crm_can_view_contact(c.id))
    )
  );

create policy leads_select_crm_scoped
  on public.leads for select to authenticated
  using ((select private.crm_can_view_lead(assigned_to)));

create policy consent_events_select_crm_scoped
  on public.consent_events for select to authenticated
  using (
    (select public.authorize('consents.read'))
    and lead_id is not null
    and exists (
      select 1 from public.leads l
      where l.id = consent_events.lead_id
        and (select private.crm_can_view_lead(l.assigned_to))
    )
  );

create policy lead_events_select_crm_scoped
  on public.lead_events for select to authenticated
  using (
    exists (
      select 1 from public.leads l
      where l.id = lead_events.lead_id
        and (select private.crm_can_view_lead(l.assigned_to))
    )
  );

drop policy if exists lead_sources_manage_super_admin on public.lead_sources;
drop policy if exists lead_sources_select_active on public.lead_sources;

create policy lead_sources_select_catalogue
  on public.lead_sources for select to authenticated
  using ((select public.authorize('sources.read')) or (select public.authorize('sources.manage')));

create policy lead_closure_reasons_select
  on public.lead_closure_reasons for select to authenticated
  using ((select public.authorize('leads.transition')) or (select public.authorize('leads.read_all')) or (select public.authorize('leads.read_assigned')));

create policy lead_source_touchpoints_select
  on public.lead_source_touchpoints for select to authenticated
  using (
    exists (
      select 1 from public.leads l
      where l.id = lead_source_touchpoints.lead_id
        and (select private.crm_can_view_lead(l.assigned_to))
    )
  );

create policy lead_assignment_history_select
  on public.lead_assignment_history for select to authenticated
  using (
    exists (
      select 1 from public.leads l
      where l.id = lead_assignment_history.lead_id
        and (select private.crm_can_view_lead(l.assigned_to))
    )
  );

create policy lead_notes_select
  on public.lead_notes for select to authenticated
  using (
    exists (
      select 1 from public.leads l
      where l.id = lead_notes.lead_id
        and (select private.crm_can_view_lead(l.assigned_to))
    )
  );

create policy lead_notes_insert
  on public.lead_notes for insert to authenticated
  with check (
    (select public.authorize('crm.notes.manage'))
    and (select private.crm_can_mutate_lead(lead_id))
  );

create policy lead_follow_ups_select
  on public.lead_follow_ups for select to authenticated
  using (
    exists (
      select 1 from public.leads l
      where l.id = lead_follow_ups.lead_id
        and (select private.crm_can_view_lead(l.assigned_to))
    )
  );

create policy lead_activities_select
  on public.lead_activities for select to authenticated
  using (
    (select public.authorize('crm.activities.read'))
    and exists (
      select 1 from public.leads l
      where l.id = lead_activities.lead_id
        and (select private.crm_can_view_lead(l.assigned_to))
    )
  );

-- H. Sales target schema deferred to Phase 5E per roadmap (foundations only in permission model)
