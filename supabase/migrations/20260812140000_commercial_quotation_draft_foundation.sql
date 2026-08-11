-- ONEDECORE Phase 7A — Commercial Quotation Data & Draft Foundation
-- Migration: 20260812140000_commercial_quotation_draft_foundation.sql
-- Repository implementation only at creation time.
-- Managed apply requires separate owner authorization.

-- =============================================================================
-- 1. System Permissions & Role Grants
-- =============================================================================

insert into public.permissions (code, name, description, is_system, is_active) values
  ('quotations.read', 'Read Commercial Quotations', 'Read commercial quotation roots and draft versions for authorized leads', true, true),
  ('quotations.create', 'Create Commercial Quotations', 'Create initial quotation draft for an assigned lead', true, true),
  ('quotations.edit', 'Edit Commercial Quotation Drafts', 'Update mutable quotation draft, sections, line items, discount, tax, or payment schedule', true, true)
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
  and p.code in ('quotations.read', 'quotations.create', 'quotations.edit')
  and r.code in ('super_admin', 'sales_manager', 'sales_executive', 'management', 'sales')
on conflict (role_id, permission_id) do nothing;

-- =============================================================================
-- 2. Schema Foundation: Public & Private Tables
-- =============================================================================

-- A. Quotation Root Identity
create table public.quotations (
  id uuid primary key default gen_random_uuid(),
  lead_id uuid not null unique references public.leads (id) on delete restrict,
  quotation_number text not null unique,
  status text not null default 'active',
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_quotations_status check (status in ('active', 'archived')),
  constraint chk_quotations_number_format check (quotation_number ~ '^OD-Q-[0-9]{4}-[0-9]{6,}$')
);

comment on table public.quotations is
  'Root identity for commercial quotations. 1:1 with public.leads via UNIQUE lead_id. Current sales owner pointer remains public.leads.assigned_to.';

-- B. Tax Profile Catalogue (Super-Admin Governed; ZERO Production Seeds)
create table public.quotation_tax_profiles (
  id uuid primary key default gen_random_uuid(),
  code text not null unique,
  display_name text not null,
  rate_percentage numeric(5,2) not null,
  is_active boolean not null default true,
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_quotation_tax_profiles_code check (code ~ '^[a-z][a-z0-9_]{1,63}$'),
  constraint chk_quotation_tax_profiles_display_name check (length(trim(display_name)) between 2 and 120),
  constraint chk_quotation_tax_profiles_rate check (rate_percentage >= 0.00 and rate_percentage <= 100.00)
);

comment on table public.quotation_tax_profiles is
  'Tax profile catalogue. Controlled by Super Admin. NO production seed rows in M25.';

-- C. Quotation Version Ledger
create table public.quotation_versions (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations (id) on delete restrict,
  version_number integer not null,
  lock_version bigint not null default 1,
  status text not null default 'draft',
  is_current_draft boolean not null default true,
  title text not null,
  client_name_snapshot text,
  client_email_snapshot text,
  client_phone_snapshot text,
  property_address_snapshot text,
  scope_summary text,
  payment_schedule_mode text,
  subtotal_paise bigint not null default 0,
  discount_type text not null default 'none',
  discount_value_paise bigint not null default 0,
  discount_percentage numeric(5,2) not null default 0.00,
  discount_total_paise bigint not null default 0,
  taxable_base_paise bigint not null default 0,
  tax_profile_id uuid references public.quotation_tax_profiles (id) on delete restrict,
  tax_rate_percentage numeric(5,2),
  tax_total_paise bigint,
  grand_total_paise bigint,
  terms_and_conditions text,
  inclusions text[] not null default '{}'::text[],
  exclusions text[] not null default '{}'::text[],
  created_by uuid not null references public.profiles (id) on delete restrict,
  updated_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint uq_quotation_versions_number unique (quotation_id, version_number),
  constraint chk_quotation_versions_number check (version_number > 0),
  constraint chk_quotation_versions_lock check (lock_version > 0),
  constraint chk_quotation_versions_status check (status in ('draft', 'archived')),
  constraint chk_quotation_versions_draft_current check (
    (status = 'draft' and is_current_draft = true) or (status = 'archived' and is_current_draft = false)
  ),
  constraint chk_quotation_versions_title check (length(trim(title)) between 1 and 200),
  constraint chk_quotation_versions_payment_mode check (
    payment_schedule_mode is null or payment_schedule_mode in ('percentage', 'amount')
  ),
  constraint chk_quotation_versions_subtotal check (subtotal_paise >= 0),
  constraint chk_quotation_versions_discount_type check (discount_type in ('none', 'flat', 'percentage')),
  constraint chk_quotation_versions_discount_val check (discount_value_paise >= 0),
  constraint chk_quotation_versions_discount_pct check (discount_percentage >= 0.00 and discount_percentage <= 100.00),
  constraint chk_quotation_versions_discount_tot check (discount_total_paise >= 0),
  constraint chk_quotation_versions_discount_bound check (discount_total_paise <= subtotal_paise),
  constraint chk_quotation_versions_taxable_base check (taxable_base_paise >= 0),
  constraint chk_quotation_versions_taxable_base_eq check (taxable_base_paise = subtotal_paise - discount_total_paise),
  constraint chk_quotation_versions_tax_rate check (
    tax_rate_percentage is null or (tax_rate_percentage >= 0.00 and tax_rate_percentage <= 100.00)
  ),
  constraint chk_quotation_versions_tax_total check (tax_total_paise is null or tax_total_paise >= 0),
  constraint chk_quotation_versions_grand_total check (grand_total_paise is null or grand_total_paise >= 0),
  constraint chk_quotation_versions_discount_invariants check (
    (discount_type = 'none' and discount_value_paise = 0 and discount_percentage = 0.00 and discount_total_paise = 0)
    or (discount_type = 'flat' and discount_percentage = 0.00)
    or (discount_type = 'percentage' and discount_value_paise = 0)
  )
);

comment on table public.quotation_versions is
  'Monotonic quotation versions. Exactly one active current draft version per quotation root.';

create unique index idx_one_current_draft_per_quotation
  on public.quotation_versions (quotation_id)
  where (status = 'draft' and is_current_draft = true);

-- D. Quotation Sections (Layout Rooms / Areas)
create table public.quotation_sections (
  id uuid primary key default gen_random_uuid(),
  quotation_version_id uuid not null references public.quotation_versions (id) on delete restrict,
  section_name text not null,
  display_order integer not null default 0,
  subtotal_paise bigint not null default 0,
  created_at timestamptz not null default now(),

  constraint chk_quotation_sections_name check (length(trim(section_name)) between 1 and 120),
  constraint chk_quotation_sections_order check (display_order >= 0),
  constraint chk_quotation_sections_subtotal check (subtotal_paise >= 0)
);

comment on table public.quotation_sections is
  'Room/section layout blocks within a quotation version.';

create index idx_quotation_sections_version_order
  on public.quotation_sections (quotation_version_id, display_order);

-- E. Quotation Items (Line Items)
create table public.quotation_items (
  id uuid primary key default gen_random_uuid(),
  section_id uuid not null references public.quotation_sections (id) on delete restrict,
  item_name text not null,
  description text,
  specifications text,
  quantity numeric(10,3) not null,
  unit_of_measure text not null,
  unit_rate_paise bigint not null,
  line_total_paise bigint not null,
  display_order integer not null default 0,
  created_at timestamptz not null default now(),

  constraint chk_quotation_items_name check (length(trim(item_name)) between 1 and 200),
  constraint chk_quotation_items_desc check (description is null or length(trim(description)) <= 2000),
  constraint chk_quotation_items_specs check (specifications is null or length(trim(specifications)) <= 2000),
  constraint chk_quotation_items_qty check (quantity > 0),
  constraint chk_quotation_items_uom check (length(trim(unit_of_measure)) between 1 and 30),
  constraint chk_quotation_items_rate check (unit_rate_paise >= 0),
  constraint chk_quotation_items_line_total check (line_total_paise >= 0),
  constraint chk_quotation_items_line_total_eq check (line_total_paise = round((quantity * unit_rate_paise::numeric)::numeric)::bigint),
  constraint chk_quotation_items_order check (display_order >= 0)
);

comment on table public.quotation_items is
  'Individual line items within a quotation section.';

create index idx_quotation_items_section_order
  on public.quotation_items (section_id, display_order);

-- F. Quotation Payment Schedules (Payment Milestones)
create table public.quotation_payment_schedules (
  id uuid primary key default gen_random_uuid(),
  quotation_version_id uuid not null references public.quotation_versions (id) on delete restrict,
  milestone_name text not null,
  milestone_order integer not null default 0,
  percentage numeric(5,2),
  amount_paise bigint,
  created_at timestamptz not null default now(),

  constraint chk_quotation_payment_schedules_name check (length(trim(milestone_name)) between 1 and 150),
  constraint chk_quotation_payment_schedules_order check (milestone_order >= 0),
  constraint chk_quotation_payment_schedules_pct check (percentage is null or (percentage >= 0.00 and percentage <= 100.00)),
  constraint chk_quotation_payment_schedules_amt check (amount_paise is null or amount_paise >= 0)
);

comment on table public.quotation_payment_schedules is
  'Draft payment schedule milestones within a quotation version.';

create index idx_quotation_payment_schedules_version_order
  on public.quotation_payment_schedules (quotation_version_id, milestone_order);

-- G. Quotation Event Audit Ledger (Append-Only)
create table public.quotation_events (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations (id) on delete restrict,
  quotation_version_id uuid references public.quotation_versions (id) on delete restrict,
  lead_id uuid not null references public.leads (id) on delete restrict,
  event_type text not null,
  actor_id uuid not null references public.profiles (id) on delete restrict,
  details jsonb not null default '{}'::jsonb,
  occurred_at timestamptz not null default now(),

  constraint chk_quotation_events_type check (event_type ~ '^[a-z_]+\.[a-z_]+$'),
  constraint chk_quotation_events_details check (jsonb_typeof(details) = 'object' and pg_column_size(details) <= 4096)
);

comment on table public.quotation_events is
  'Append-only commercial quotation domain audit ledger.';

create index idx_quotation_events_quotation on public.quotation_events (quotation_id, occurred_at desc);
create index idx_quotation_events_lead on public.quotation_events (lead_id, occurred_at desc);

-- Protect quotation_events against UPDATE and DELETE
create trigger trg_protect_quotation_events_append_only
  before update or delete on public.quotation_events
  for each row execute function private.forbid_append_only_mutation();

-- H. Private Idempotency Request Ledger
create table private.quotation_idempotency_requests (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid not null references public.profiles (id) on delete restrict,
  operation_code text not null,
  idempotency_key text not null,
  request_hash text not null,
  quotation_id uuid references public.quotations (id) on delete set null,
  quotation_version_id uuid references public.quotation_versions (id) on delete set null,
  response_snapshot jsonb,
  created_at timestamptz not null default now(),

  constraint uq_quotation_idempotency_actor_op_key unique (actor_id, operation_code, idempotency_key),
  constraint chk_quotation_idempotency_op check (length(trim(operation_code)) between 1 and 64),
  constraint chk_quotation_idempotency_key check (length(trim(idempotency_key)) between 1 and 128),
  constraint chk_quotation_idempotency_hash check (request_hash ~ '^[0-9a-f]{64}$'),
  constraint chk_quotation_idempotency_response check (
    response_snapshot is null or (jsonb_typeof(response_snapshot) = 'object' and pg_column_size(response_snapshot) <= 8192)
  )
);

comment on table private.quotation_idempotency_requests is
  'Private internal idempotency ledger for multi-row quotation mutations.';

-- Sequence for quotation numbers
create sequence private.quotation_number_seq start with 1 increment by 1;

-- =============================================================================
-- 3. RLS & Authorization Helpers & Private Recalculation Routines
-- =============================================================================

create or replace function private.generate_quotation_number()
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
  v_seq := nextval('private.quotation_number_seq');
  return 'OD-Q-' || v_year || '-' || lpad(v_seq::text, 6, '0');
end;
$$;

create or replace function private.quotation_can_view(p_quotation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.quotations q
    join public.leads l on l.id = q.lead_id
    where q.id = p_quotation_id
      and (select public.authorize('quotations.read'))
      and (select private.crm_can_view_lead(l.assigned_to))
  );
$$;

create or replace function private.quotation_can_create_for_lead(p_lead_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select (select public.authorize('quotations.create'))
    and (select private.crm_can_view_lead_by_id(p_lead_id));
$$;

create or replace function private.quotation_can_edit(p_quotation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.quotations q
    join public.leads l on l.id = q.lead_id
    where q.id = p_quotation_id
      and (select public.authorize('quotations.edit'))
      and (select private.crm_can_view_lead(l.assigned_to))
  );
$$;

create or replace function private.recalculate_quotation_payment_schedule(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ver_rec record;
  v_elem record;
  v_running_amt bigint := 0;
  v_derived_amt bigint;
  v_total_count integer;
  v_curr_idx integer := 0;
  v_pct_sum numeric(5,2) := 0.00;
begin
  select payment_schedule_mode, grand_total_paise
  into v_ver_rec
  from public.quotation_versions
  where id = p_version_id;

  if not found or v_ver_rec.payment_schedule_mode is null then
    return;
  end if;

  if v_ver_rec.payment_schedule_mode = 'percentage' then
    select count(*), coalesce(sum(percentage), 0.00)
    into v_total_count, v_pct_sum
    from public.quotation_payment_schedules
    where quotation_version_id = p_version_id;

    -- Only calculate derived milestone amount_paise when grand_total_paise IS NOT NULL AND percentage sum is EXACTLY 100.00
    if v_ver_rec.grand_total_paise is null or v_pct_sum <> 100.00 then
      update public.quotation_payment_schedules
      set amount_paise = null
      where quotation_version_id = p_version_id;
      return;
    end if;

    for v_elem in
      select id, percentage
      from public.quotation_payment_schedules
      where quotation_version_id = p_version_id
      order by milestone_order asc
    loop
      if v_curr_idx = v_total_count - 1 then
        v_derived_amt := v_ver_rec.grand_total_paise - v_running_amt;
      else
        v_derived_amt := round((v_ver_rec.grand_total_paise::numeric * (v_elem.percentage / 100.00))::numeric)::bigint;
        v_running_amt := v_running_amt + v_derived_amt;
      end if;

      update public.quotation_payment_schedules
      set amount_paise = v_derived_amt
      where id = v_elem.id;

      v_curr_idx := v_curr_idx + 1;
    end loop;
  end if;
  -- If payment_schedule_mode = 'amount', preserve authoritative amount_paise.
end;
$$;

create or replace function private.recalculate_quotation_totals(p_version_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_ver_rec record;
  v_subtotal bigint := 0;
  v_discount_tot bigint := 0;
  v_taxable_base bigint := 0;
  v_tax_tot bigint;
  v_grand_tot bigint;
begin
  select * into v_ver_rec
  from public.quotation_versions
  where id = p_version_id;

  if not found then
    return;
  end if;

  -- 1. Recalculate section subtotals & overall version subtotal
  update public.quotation_sections qs
  set subtotal_paise = coalesce((
    select sum(qi.line_total_paise)
    from public.quotation_items qi
    where qi.section_id = qs.id
  ), 0)
  where qs.quotation_version_id = p_version_id;

  select coalesce(sum(subtotal_paise), 0)
  into v_subtotal
  from public.quotation_sections
  where quotation_version_id = p_version_id;

  -- 2. Recalculate discount total
  if v_ver_rec.discount_type = 'none' then
    v_discount_tot := 0;
  elsif v_ver_rec.discount_type = 'flat' then
    v_discount_tot := v_ver_rec.discount_value_paise;
  elsif v_ver_rec.discount_type = 'percentage' then
    v_discount_tot := round((v_subtotal::numeric * (v_ver_rec.discount_percentage / 100.00))::numeric)::bigint;
  end if;

  if v_discount_tot > v_subtotal then
    raise exception 'QUOTATION_VALIDATION_FAILED: Discount total cannot exceed subtotal' using errcode = 'P0001';
  end if;

  -- 3. Taxable base
  v_taxable_base := v_subtotal - v_discount_tot;

  -- 4. Tax & Grand Total
  if v_ver_rec.tax_rate_percentage is not null then
    v_tax_tot := round((v_taxable_base::numeric * (v_ver_rec.tax_rate_percentage / 100.00))::numeric)::bigint;
    v_grand_tot := v_taxable_base + v_tax_tot;
  else
    v_tax_tot := null;
    v_grand_tot := null;
  end if;

  -- Update quotation_versions
  update public.quotation_versions set
    subtotal_paise = v_subtotal,
    discount_total_paise = v_discount_tot,
    taxable_base_paise = v_taxable_base,
    tax_total_paise = v_tax_tot,
    grand_total_paise = v_grand_tot
  where id = p_version_id;

  -- Recalculate payment schedule amounts
  perform private.recalculate_quotation_payment_schedule(p_version_id);
end;
$$;

-- Enable RLS on all public tables
alter table public.quotations enable row level security;
alter table public.quotation_tax_profiles enable row level security;
alter table public.quotation_versions enable row level security;
alter table public.quotation_sections enable row level security;
alter table public.quotation_items enable row level security;
alter table public.quotation_payment_schedules enable row level security;
alter table public.quotation_events enable row level security;

-- Revoke all table privileges from public, anon, authenticated
revoke all on table public.quotations from public, anon, authenticated;
revoke all on table public.quotation_tax_profiles from public, anon, authenticated;
revoke all on table public.quotation_versions from public, anon, authenticated;
revoke all on table public.quotation_sections from public, anon, authenticated;
revoke all on table public.quotation_items from public, anon, authenticated;
revoke all on table public.quotation_payment_schedules from public, anon, authenticated;
revoke all on table public.quotation_events from public, anon, authenticated;
revoke all on table private.quotation_idempotency_requests from public, anon, authenticated;

-- Table SELECT-only privileges for authenticated role (RLS restricts actual row-level access)
grant select on table public.quotations, public.quotation_tax_profiles, public.quotation_versions, public.quotation_sections, public.quotation_items, public.quotation_payment_schedules, public.quotation_events to authenticated;

-- Revoke sequence usage from public, anon, authenticated
revoke all on sequence private.quotation_number_seq from public, anon, authenticated;

-- RLS Policies: public.quotations
create policy p_quotations_select on public.quotations
  for select to authenticated
  using (private.quotation_can_view(id));

-- RLS Policies: public.quotation_tax_profiles
create policy p_quotation_tax_profiles_select on public.quotation_tax_profiles
  for select to authenticated
  using ((select public.authorize('quotations.read')) or (select public.authorize('quotations.create')));

-- RLS Policies: public.quotation_versions
create policy p_quotation_versions_select on public.quotation_versions
  for select to authenticated
  using (private.quotation_can_view(quotation_id));

-- RLS Policies: public.quotation_sections
create policy p_quotation_sections_select on public.quotation_sections
  for select to authenticated
  using (
    exists (
      select 1 from public.quotation_versions qv
      where qv.id = quotation_version_id
        and private.quotation_can_view(qv.quotation_id)
    )
  );

-- RLS Policies: public.quotation_items
create policy p_quotation_items_select on public.quotation_items
  for select to authenticated
  using (
    exists (
      select 1 from public.quotation_sections qs
      join public.quotation_versions qv on qv.id = qs.quotation_version_id
      where qs.id = section_id
        and private.quotation_can_view(qv.quotation_id)
    )
  );

-- RLS Policies: public.quotation_payment_schedules
create policy p_quotation_payment_schedules_select on public.quotation_payment_schedules
  for select to authenticated
  using (
    exists (
      select 1 from public.quotation_versions qv
      where qv.id = quotation_version_id
        and private.quotation_can_view(qv.quotation_id)
    )
  );

-- RLS Policies: public.quotation_events
create policy p_quotation_events_select on public.quotation_events
  for select to authenticated
  using (private.quotation_can_view(quotation_id));

-- =============================================================================
-- 4. Transactional RPC API Foundation
-- =============================================================================

-- A. Create Quotation Draft RPC
create or replace function public.create_quotation_draft(
  p_lead_id uuid,
  p_title text,
  p_idempotency_key text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_op_code text := 'create_quotation_draft';
  v_request_hash text;
  v_idempotency_rec record;
  v_quotation_id uuid;
  v_version_id uuid;
  v_quotation_number text;
  v_version_number integer;
  v_contact_rec record;
  v_result jsonb;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'QUOTATION_UNAUTHORIZED' using errcode = '42501';
  end if;

  if not private.quotation_can_create_for_lead(p_lead_id) then
    raise exception 'QUOTATION_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  if p_title is null or length(trim(p_title)) < 1 or length(trim(p_title)) > 200 then
    raise exception 'QUOTATION_VALIDATION_FAILED: Invalid title' using errcode = 'P0001';
  end if;

  if p_idempotency_key is null or length(trim(p_idempotency_key)) < 1 or length(trim(p_idempotency_key)) > 128 then
    raise exception 'QUOTATION_VALIDATION_FAILED: Invalid idempotency key' using errcode = 'P0001';
  end if;

  v_request_hash := encode(sha256(convert_to(p_lead_id::text || '|' || trim(p_title) || '|' || trim(p_idempotency_key), 'UTF8')), 'hex');

  -- Transaction-scoped 64-bit advisory locks for idempotency & lead root lock
  perform pg_advisory_xact_lock(hashtextextended(v_actor_id::text || '|' || v_op_code || '|' || trim(p_idempotency_key), 0));
  perform pg_advisory_xact_lock(hashtextextended('quotation_root:' || p_lead_id::text, 0));

  select * into v_idempotency_rec
  from private.quotation_idempotency_requests
  where actor_id = v_actor_id
    and operation_code = v_op_code
    and idempotency_key = trim(p_idempotency_key);

  if found then
    if v_idempotency_rec.request_hash = v_request_hash then
      return jsonb_set(v_idempotency_rec.response_snapshot, '{idempotentReplay}', 'true'::jsonb);
    else
      raise exception 'IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH' using errcode = 'P0001';
    end if;
  end if;

  -- Lock existing quotation root for lead if present
  select id into v_quotation_id
  from public.quotations
  where lead_id = p_lead_id
  for update;

  -- Snapshot CRM contact / client data
  select
    c.display_name as client_name,
    max(cc_email.address_normalized) as client_email,
    max(cc_phone.address_normalized) as client_phone,
    l.locality as property_address,
    l.service_code as scope_summary
  into v_contact_rec
  from public.leads l
  left join public.contacts c on c.id = l.contact_id
  left join public.contact_channels cc_email on cc_email.contact_id = c.id and cc_email.channel_type = 'email'
  left join public.contact_channels cc_phone on cc_phone.contact_id = c.id and cc_phone.channel_type = 'phone'
  where l.id = p_lead_id
  group by c.display_name, l.locality, l.service_code;

  if v_quotation_id is null then
    -- Create new root
    v_quotation_number := private.generate_quotation_number();
    insert into public.quotations (lead_id, quotation_number, status, created_by)
    values (p_lead_id, v_quotation_number, 'active', v_actor_id)
    returning id into v_quotation_id;

    v_version_number := 1;
  else
    -- Check if active draft exists
    if exists (
      select 1 from public.quotation_versions
      where quotation_id = v_quotation_id and status = 'draft' and is_current_draft = true
    ) then
      raise exception 'QUOTATION_DRAFT_ALREADY_EXISTS: Lead already has an active quotation draft' using errcode = 'P0001';
    end if;

    -- Root exists but no active draft (e.g. prior draft archived). Reactivate root and allocate next version
    update public.quotations set status = 'active', updated_by = v_actor_id, updated_at = now()
    where id = v_quotation_id;

    select coalesce(max(version_number), 0) + 1 into v_version_number
    from public.quotation_versions
    where quotation_id = v_quotation_id;
  end if;

  -- Insert Version 1 / next draft version
  insert into public.quotation_versions (
    quotation_id,
    version_number,
    lock_version,
    status,
    is_current_draft,
    title,
    client_name_snapshot,
    client_email_snapshot,
    client_phone_snapshot,
    property_address_snapshot,
    scope_summary,
    created_by
  ) values (
    v_quotation_id,
    v_version_number,
    1,
    'draft',
    true,
    trim(p_title),
    v_contact_rec.client_name,
    v_contact_rec.client_email,
    v_contact_rec.client_phone,
    v_contact_rec.property_address,
    v_contact_rec.scope_summary,
    v_actor_id
  )
  returning id into v_version_id;

  -- Append audit events
  if v_version_number = 1 then
    insert into public.quotation_events (quotation_id, quotation_version_id, lead_id, event_type, actor_id, details)
    values (v_quotation_id, v_version_id, p_lead_id, 'quotation.created', v_actor_id, jsonb_build_object('quotation_number', v_quotation_number));
  else
    insert into public.quotation_events (quotation_id, quotation_version_id, lead_id, event_type, actor_id, details)
    values (v_quotation_id, v_version_id, p_lead_id, 'quotation.version_created', v_actor_id, jsonb_build_object('version_number', v_version_number, 'title', trim(p_title)));
  end if;

  insert into public.quotation_events (quotation_id, quotation_version_id, lead_id, event_type, actor_id, details)
  values (v_quotation_id, v_version_id, p_lead_id, 'quotation.draft_created', v_actor_id, jsonb_build_object('version_number', v_version_number, 'title', trim(p_title)));

  v_result := jsonb_build_object(
    'quotationId', v_quotation_id,
    'versionId', v_version_id,
    'quotationNumber', (select quotation_number from public.quotations where id = v_quotation_id),
    'versionNumber', v_version_number,
    'lockVersion', 1,
    'status', 'draft',
    'idempotentReplay', false,
    'dto', public.get_quotation_draft(v_quotation_id)
  );

  insert into private.quotation_idempotency_requests (actor_id, operation_code, idempotency_key, request_hash, quotation_id, quotation_version_id, response_snapshot)
  values (v_actor_id, v_op_code, trim(p_idempotency_key), v_request_hash, v_quotation_id, v_version_id, v_result);

  return v_result;
end;
$$;

-- B. Update Quotation Draft Metadata & Discount/Tax RPC
create or replace function public.update_quotation_draft(
  p_quotation_id uuid,
  p_expected_lock_version bigint,
  p_title text default null,
  p_scope_summary text default null,
  p_discount_type text default null,
  p_discount_value_paise bigint default null,
  p_discount_percentage numeric default null,
  p_tax_profile_id uuid default null,
  p_clear_tax_profile boolean default false,
  p_terms_and_conditions text default null,
  p_inclusions text[] default null,
  p_exclusions text[] default null,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_op_code text := 'update_quotation_draft';
  v_request_hash text;
  v_idempotency_rec record;
  v_version_rec record;
  v_lead_id uuid;
  v_new_discount_type text;
  v_new_discount_val bigint;
  v_new_discount_pct numeric(5,2);
  v_new_tax_profile_id uuid;
  v_new_tax_rate numeric(5,2);
  v_new_lock_version bigint;
  v_tax_profile_rec record;
  v_discount_changed boolean := false;
  v_tax_changed boolean := false;
  v_result jsonb;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'QUOTATION_UNAUTHORIZED' using errcode = '42501';
  end if;

  if not private.quotation_can_edit(p_quotation_id) then
    raise exception 'QUOTATION_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  if p_title is not null and (length(trim(p_title)) < 1 or length(trim(p_title)) > 200) then
    raise exception 'QUOTATION_VALIDATION_FAILED: Title length out of bounds' using errcode = 'P0001';
  end if;

  if p_scope_summary is not null and length(p_scope_summary) > 2000 then
    raise exception 'QUOTATION_VALIDATION_FAILED: Scope summary too long' using errcode = 'P0001';
  end if;

  if p_terms_and_conditions is not null and length(p_terms_and_conditions) > 5000 then
    raise exception 'QUOTATION_VALIDATION_FAILED: Terms too long' using errcode = 'P0001';
  end if;

  if p_inclusions is not null and array_length(p_inclusions, 1) > 100 then
    raise exception 'QUOTATION_VALIDATION_FAILED: Inclusions array limit exceeded' using errcode = 'P0001';
  end if;

  if p_exclusions is not null and array_length(p_exclusions, 1) > 100 then
    raise exception 'QUOTATION_VALIDATION_FAILED: Exclusions array limit exceeded' using errcode = 'P0001';
  end if;

  -- Durable idempotency check
  if p_idempotency_key is not null and length(trim(p_idempotency_key)) >= 1 then
    if length(trim(p_idempotency_key)) > 128 then
      raise exception 'QUOTATION_VALIDATION_FAILED: Idempotency key too long' using errcode = 'P0001';
    end if;

    v_request_hash := encode(sha256(convert_to(
      jsonb_build_object(
        'quotationId', p_quotation_id,
        'expectedLockVersion', p_expected_lock_version,
        'title', p_title,
        'scopeSummary', p_scope_summary,
        'discountType', p_discount_type,
        'discountValuePaise', p_discount_value_paise,
        'discountPercentage', p_discount_percentage,
        'taxProfileId', p_tax_profile_id,
        'clearTaxProfile', p_clear_tax_profile,
        'termsAndConditions', p_terms_and_conditions,
        'inclusions', to_jsonb(coalesce(p_inclusions, array[]::text[])),
        'exclusions', to_jsonb(coalesce(p_exclusions, array[]::text[]))
      )::text,
      'UTF8'
    )), 'hex');

    perform pg_advisory_xact_lock(hashtextextended(v_actor_id::text || '|' || v_op_code || '|' || trim(p_idempotency_key), 0));

    select * into v_idempotency_rec
    from private.quotation_idempotency_requests
    where actor_id = v_actor_id
      and operation_code = v_op_code
      and idempotency_key = trim(p_idempotency_key);

    if found then
      if v_idempotency_rec.request_hash = v_request_hash then
        return jsonb_set(v_idempotency_rec.response_snapshot, '{idempotentReplay}', 'true'::jsonb);
      else
        raise exception 'IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH' using errcode = 'P0001';
      end if;
    end if;
  end if;

  select lead_id into v_lead_id from public.quotations where id = p_quotation_id;

  -- Lock current draft version
  select * into v_version_rec
  from public.quotation_versions
  where quotation_id = p_quotation_id
    and status = 'draft'
    and is_current_draft = true
  for update;

  if not found then
    raise exception 'QUOTATION_NOT_FOUND_OR_FORBIDDEN' using errcode = 'P0001';
  end if;

  if v_version_rec.lock_version <> p_expected_lock_version then
    raise exception 'QUOTATION_VERSION_CONFLICT: Stale lock version' using errcode = 'P0002';
  end if;

  v_new_discount_type := coalesce(p_discount_type, v_version_rec.discount_type);
  v_new_discount_val := coalesce(p_discount_value_paise, v_version_rec.discount_value_paise);
  v_new_discount_pct := coalesce(p_discount_percentage, v_version_rec.discount_percentage);

  if v_new_discount_type not in ('none', 'flat', 'percentage') then
    raise exception 'QUOTATION_VALIDATION_FAILED: Invalid discount type' using errcode = 'P0001';
  end if;

  if v_new_discount_val < 0 or v_new_discount_pct < 0.00 or v_new_discount_pct > 100.00 then
    raise exception 'QUOTATION_VALIDATION_FAILED: Invalid discount value or percentage' using errcode = 'P0001';
  end if;

  if v_new_discount_type = 'none' then
    v_new_discount_val := 0;
    v_new_discount_pct := 0.00;
  elsif v_new_discount_type = 'flat' then
    v_new_discount_pct := 0.00;
  elsif v_new_discount_type = 'percentage' then
    v_new_discount_val := 0;
  end if;

  -- Validation: flat discount total cannot exceed subtotal
  if v_new_discount_type = 'flat' and v_new_discount_val > v_version_rec.subtotal_paise then
    raise exception 'QUOTATION_VALIDATION_FAILED: Discount total cannot exceed subtotal' using errcode = 'P0001';
  end if;

  if v_new_discount_type <> v_version_rec.discount_type
     or v_new_discount_val <> v_version_rec.discount_value_paise
     or v_new_discount_pct <> v_version_rec.discount_percentage then
    v_discount_changed := true;
  end if;

  -- Resolve tax profile snapshot
  if p_clear_tax_profile then
    v_new_tax_profile_id := null;
    v_new_tax_rate := null;
    if v_version_rec.tax_profile_id is not null then
      v_tax_changed := true;
    end if;
  elsif p_tax_profile_id is not null then
    select * into v_tax_profile_rec
    from public.quotation_tax_profiles
    where id = p_tax_profile_id and is_active = true;

    if not found then
      raise exception 'QUOTATION_VALIDATION_FAILED: Tax profile not found or inactive' using errcode = 'P0001';
    end if;

    v_new_tax_profile_id := v_tax_profile_rec.id;
    v_new_tax_rate := v_tax_profile_rec.rate_percentage;
    if v_version_rec.tax_profile_id is null or v_version_rec.tax_profile_id <> v_new_tax_profile_id then
      v_tax_changed := true;
    end if;
  else
    v_new_tax_profile_id := v_version_rec.tax_profile_id;
    v_new_tax_rate := v_version_rec.tax_rate_percentage;
  end if;

  v_new_lock_version := v_version_rec.lock_version + 1;

  update public.quotation_versions set
    lock_version = v_new_lock_version,
    title = coalesce(trim(p_title), title),
    scope_summary = coalesce(p_scope_summary, scope_summary),
    discount_type = v_new_discount_type,
    discount_value_paise = v_new_discount_val,
    discount_percentage = v_new_discount_pct,
    tax_profile_id = v_new_tax_profile_id,
    tax_rate_percentage = v_new_tax_rate,
    terms_and_conditions = coalesce(p_terms_and_conditions, terms_and_conditions),
    inclusions = coalesce(p_inclusions, inclusions),
    exclusions = coalesce(p_exclusions, exclusions),
    updated_by = v_actor_id,
    updated_at = now()
  where id = v_version_rec.id;

  -- Private explicit recalculation of totals & payment schedules
  perform private.recalculate_quotation_totals(v_version_rec.id);

  -- Fetch updated version record
  select * into v_version_rec from public.quotation_versions where id = v_version_rec.id;

  -- Event audit logging
  if v_discount_changed then
    insert into public.quotation_events (quotation_id, quotation_version_id, lead_id, event_type, actor_id, details)
    values (p_quotation_id, v_version_rec.id, v_lead_id, 'quotation.discount_changed', v_actor_id, jsonb_build_object(
      'discountType', v_new_discount_type,
      'discountTotalPaise', v_version_rec.discount_total_paise
    ));
  end if;

  if v_tax_changed then
    insert into public.quotation_events (quotation_id, quotation_version_id, lead_id, event_type, actor_id, details)
    values (p_quotation_id, v_version_rec.id, v_lead_id, 'quotation.tax_profile_changed', v_actor_id, jsonb_build_object(
      'taxProfileId', v_new_tax_profile_id,
      'taxRatePercentage', v_new_tax_rate
    ));
  end if;

  insert into public.quotation_events (quotation_id, quotation_version_id, lead_id, event_type, actor_id, details)
  values (p_quotation_id, v_version_rec.id, v_lead_id, 'quotation.draft_updated', v_actor_id, jsonb_build_object(
    'lockVersion', v_new_lock_version,
    'discountType', v_new_discount_type,
    'discountTotalPaise', v_version_rec.discount_total_paise,
    'taxableBasePaise', v_version_rec.taxable_base_paise,
    'grandTotalPaise', v_version_rec.grand_total_paise
  ));

  v_result := jsonb_build_object(
    'quotationId', p_quotation_id,
    'versionId', v_version_rec.id,
    'lockVersion', v_new_lock_version,
    'subtotalPaise', v_version_rec.subtotal_paise,
    'discountTotalPaise', v_version_rec.discount_total_paise,
    'taxableBasePaise', v_version_rec.taxable_base_paise,
    'taxTotalPaise', v_version_rec.tax_total_paise,
    'grandTotalPaise', v_version_rec.grand_total_paise,
    'idempotentReplay', false,
    'dto', public.get_quotation_draft(p_quotation_id)
  );

  if p_idempotency_key is not null and length(trim(p_idempotency_key)) >= 1 then
    insert into private.quotation_idempotency_requests (actor_id, operation_code, idempotency_key, request_hash, quotation_id, quotation_version_id, response_snapshot)
    values (v_actor_id, v_op_code, trim(p_idempotency_key), v_request_hash, p_quotation_id, v_version_rec.id, v_result);
  end if;

  return v_result;
end;
$$;

-- C. Save Quotation Draft Sections & Items Aggregate RPC
create or replace function public.save_quotation_draft_items(
  p_quotation_id uuid,
  p_expected_lock_version bigint,
  p_sections jsonb,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_op_code text := 'save_quotation_draft_items';
  v_request_hash text;
  v_idempotency_rec record;
  v_lead_id uuid;
  v_version_rec record;
  v_sec_elem jsonb;
  v_item_elem jsonb;
  v_sec_id uuid;
  v_sec_name text;
  v_item_name text;
  v_uom text;
  v_sec_order integer := 0;
  v_item_order integer := 0;
  v_sec_count integer := 0;
  v_item_count integer := 0;
  v_line_qty numeric(10,3);
  v_unit_rate bigint;
  v_line_total bigint;
  v_new_lock_version bigint;
  v_result jsonb;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'QUOTATION_UNAUTHORIZED' using errcode = '42501';
  end if;

  if not private.quotation_can_edit(p_quotation_id) then
    raise exception 'QUOTATION_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  if p_sections is null or jsonb_typeof(p_sections) <> 'array' then
    raise exception 'QUOTATION_VALIDATION_FAILED: Sections payload must be a JSON array' using errcode = 'P0001';
  end if;

  v_sec_count := jsonb_array_length(p_sections);
  if v_sec_count > 50 then
    raise exception 'QUOTATION_VALIDATION_FAILED: Maximum 50 sections allowed' using errcode = 'P0001';
  end if;

  -- Durable idempotency check
  if p_idempotency_key is not null and length(trim(p_idempotency_key)) >= 1 then
    if length(trim(p_idempotency_key)) > 128 then
      raise exception 'QUOTATION_VALIDATION_FAILED: Idempotency key too long' using errcode = 'P0001';
    end if;

    v_request_hash := encode(sha256(convert_to(
      p_quotation_id::text || '|' || p_expected_lock_version::text || '|' || p_sections::text || '|' || trim(p_idempotency_key),
      'UTF8'
    )), 'hex');

    perform pg_advisory_xact_lock(hashtextextended(v_actor_id::text || '|' || v_op_code || '|' || trim(p_idempotency_key), 0));

    select * into v_idempotency_rec
    from private.quotation_idempotency_requests
    where actor_id = v_actor_id
      and operation_code = v_op_code
      and idempotency_key = trim(p_idempotency_key);

    if found then
      if v_idempotency_rec.request_hash = v_request_hash then
        return jsonb_set(v_idempotency_rec.response_snapshot, '{idempotentReplay}', 'true'::jsonb);
      else
        raise exception 'IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH' using errcode = 'P0001';
      end if;
    end if;
  end if;

  select lead_id into v_lead_id from public.quotations where id = p_quotation_id;

  -- Lock current draft version
  select * into v_version_rec
  from public.quotation_versions
  where quotation_id = p_quotation_id
    and status = 'draft'
    and is_current_draft = true
  for update;

  if not found then
    raise exception 'QUOTATION_NOT_FOUND_OR_FORBIDDEN' using errcode = 'P0001';
  end if;

  if v_version_rec.lock_version <> p_expected_lock_version then
    raise exception 'QUOTATION_VERSION_CONFLICT: Stale lock version' using errcode = 'P0002';
  end if;

  -- Delete existing items and sections for this version
  delete from public.quotation_items qi
  using public.quotation_sections qs
  where qi.section_id = qs.id and qs.quotation_version_id = v_version_rec.id;

  delete from public.quotation_sections where quotation_version_id = v_version_rec.id;

  -- Process sections and line items
  for v_sec_elem in select * from jsonb_array_elements(p_sections)
  loop
    v_sec_name := trim(v_sec_elem->>'sectionName');
    if v_sec_name is null or length(v_sec_name) < 1 or length(v_sec_name) > 120 then
      raise exception 'QUOTATION_VALIDATION_FAILED: Invalid section name' using errcode = 'P0001';
    end if;

    insert into public.quotation_sections (quotation_version_id, section_name, display_order, subtotal_paise)
    values (
      v_version_rec.id,
      v_sec_name,
      v_sec_order,
      0
    )
    returning id into v_sec_id;

    v_item_order := 0;
    if v_sec_elem->'items' is not null and jsonb_typeof(v_sec_elem->'items') = 'array' then
      v_item_count := jsonb_array_length(v_sec_elem->'items');
      if v_item_count > 100 then
        raise exception 'QUOTATION_VALIDATION_FAILED: Maximum 100 items per section allowed' using errcode = 'P0001';
      end if;

      for v_item_elem in select * from jsonb_array_elements(v_sec_elem->'items')
      loop
        v_item_name := trim(v_item_elem->>'itemName');
        v_uom := trim(v_item_elem->>'unitOfMeasure');

        if v_item_name is null or length(v_item_name) < 1 or length(v_item_name) > 200 then
          raise exception 'QUOTATION_VALIDATION_FAILED: Invalid item name' using errcode = 'P0001';
        end if;

        if v_uom is null or length(v_uom) < 1 or length(v_uom) > 30 then
          raise exception 'QUOTATION_VALIDATION_FAILED: Invalid unit of measure' using errcode = 'P0001';
        end if;

        if (v_item_elem->>'quantity') is null or (v_item_elem->>'quantity') !~ '^[0-9]+(\.[0-9]+)?$' then
          raise exception 'QUOTATION_VALIDATION_FAILED: Invalid quantity' using errcode = 'P0001';
        end if;
        v_line_qty := (v_item_elem->>'quantity')::numeric;

        if (v_item_elem->>'unitRatePaise') is null or (v_item_elem->>'unitRatePaise') !~ '^[0-9]+$' then
          raise exception 'QUOTATION_VALIDATION_FAILED: Invalid unit rate' using errcode = 'P0001';
        end if;
        v_unit_rate := (v_item_elem->>'unitRatePaise')::bigint;

        if v_line_qty <= 0 or v_line_qty > 100000 then
          raise exception 'QUOTATION_VALIDATION_FAILED: Invalid quantity' using errcode = 'P0001';
        end if;

        if v_unit_rate < 0 or v_unit_rate > 100000000000 then
          raise exception 'QUOTATION_VALIDATION_FAILED: Invalid unit rate' using errcode = 'P0001';
        end if;

        v_line_total := round((v_line_qty * v_unit_rate::numeric)::numeric)::bigint;

        insert into public.quotation_items (
          section_id,
          item_name,
          description,
          specifications,
          quantity,
          unit_of_measure,
          unit_rate_paise,
          line_total_paise,
          display_order
        ) values (
          v_sec_id,
          v_item_name,
          nullif(trim(v_item_elem->>'description'), ''),
          nullif(trim(v_item_elem->>'specifications'), ''),
          v_line_qty,
          v_uom,
          v_unit_rate,
          v_line_total,
          v_item_order
        );

        v_item_order := v_item_order + 1;
      end loop;
    end if;

    v_sec_order := v_sec_order + 1;
  end loop;

  v_new_lock_version := v_version_rec.lock_version + 1;

  update public.quotation_versions set
    lock_version = v_new_lock_version,
    updated_by = v_actor_id,
    updated_at = now()
  where id = v_version_rec.id;

  -- Private explicit recalculation of totals & payment schedules
  perform private.recalculate_quotation_totals(v_version_rec.id);

  -- Fetch updated version record
  select * into v_version_rec from public.quotation_versions where id = v_version_rec.id;

  insert into public.quotation_events (quotation_id, quotation_version_id, lead_id, event_type, actor_id, details)
  values (p_quotation_id, v_version_rec.id, v_lead_id, 'quotation.draft_updated', v_actor_id, jsonb_build_object(
    'lockVersion', v_new_lock_version,
    'subtotalPaise', v_version_rec.subtotal_paise,
    'grandTotalPaise', v_version_rec.grand_total_paise
  ));

  v_result := jsonb_build_object(
    'quotationId', p_quotation_id,
    'versionId', v_version_rec.id,
    'lockVersion', v_new_lock_version,
    'subtotalPaise', v_version_rec.subtotal_paise,
    'discountTotalPaise', v_version_rec.discount_total_paise,
    'taxableBasePaise', v_version_rec.taxable_base_paise,
    'taxTotalPaise', v_version_rec.tax_total_paise,
    'grandTotalPaise', v_version_rec.grand_total_paise,
    'idempotentReplay', false,
    'dto', public.get_quotation_draft(p_quotation_id)
  );

  if p_idempotency_key is not null and length(trim(p_idempotency_key)) >= 1 then
    insert into private.quotation_idempotency_requests (actor_id, operation_code, idempotency_key, request_hash, quotation_id, quotation_version_id, response_snapshot)
    values (v_actor_id, v_op_code, trim(p_idempotency_key), v_request_hash, p_quotation_id, v_version_rec.id, v_result);
  end if;

  return v_result;
end;
$$;

-- D. Replace Quotation Payment Schedule RPC
create or replace function public.replace_quotation_payment_schedule(
  p_quotation_id uuid,
  p_expected_lock_version bigint,
  p_mode text,
  p_milestones jsonb,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_op_code text := 'replace_quotation_payment_schedule';
  v_request_hash text;
  v_idempotency_rec record;
  v_lead_id uuid;
  v_version_rec record;
  v_elem jsonb;
  v_milestone_name text;
  v_order integer := 0;
  v_pct_sum numeric(5,2) := 0.00;
  v_amt_sum bigint := 0;
  v_item_pct numeric(5,2);
  v_item_amt bigint;
  v_total_milestones integer;
  v_new_lock_version bigint;
  v_result jsonb;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'QUOTATION_UNAUTHORIZED' using errcode = '42501';
  end if;

  if not private.quotation_can_edit(p_quotation_id) then
    raise exception 'QUOTATION_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  if p_mode not in ('percentage', 'amount') then
    raise exception 'QUOTATION_VALIDATION_FAILED: Payment schedule mode must be percentage or amount' using errcode = 'P0001';
  end if;

  if p_milestones is null or jsonb_typeof(p_milestones) <> 'array' then
    raise exception 'QUOTATION_VALIDATION_FAILED: Milestones must be a JSON array' using errcode = 'P0001';
  end if;

  v_total_milestones := jsonb_array_length(p_milestones);
  if v_total_milestones > 50 then
    raise exception 'QUOTATION_VALIDATION_FAILED: Maximum 50 milestones allowed' using errcode = 'P0001';
  end if;

  -- Durable idempotency check
  if p_idempotency_key is not null and length(trim(p_idempotency_key)) >= 1 then
    if length(trim(p_idempotency_key)) > 128 then
      raise exception 'QUOTATION_VALIDATION_FAILED: Idempotency key too long' using errcode = 'P0001';
    end if;

    v_request_hash := encode(sha256(convert_to(
      p_quotation_id::text || '|' || p_expected_lock_version::text || '|' || p_mode || '|' || p_milestones::text || '|' || trim(p_idempotency_key),
      'UTF8'
    )), 'hex');

    perform pg_advisory_xact_lock(hashtextextended(v_actor_id::text || '|' || v_op_code || '|' || trim(p_idempotency_key), 0));

    select * into v_idempotency_rec
    from private.quotation_idempotency_requests
    where actor_id = v_actor_id
      and operation_code = v_op_code
      and idempotency_key = trim(p_idempotency_key);

    if found then
      if v_idempotency_rec.request_hash = v_request_hash then
        return jsonb_set(v_idempotency_rec.response_snapshot, '{idempotentReplay}', 'true'::jsonb);
      else
        raise exception 'IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH' using errcode = 'P0001';
      end if;
    end if;
  end if;

  select lead_id into v_lead_id from public.quotations where id = p_quotation_id;

  select * into v_version_rec
  from public.quotation_versions
  where quotation_id = p_quotation_id
    and status = 'draft'
    and is_current_draft = true
  for update;

  if not found then
    raise exception 'QUOTATION_NOT_FOUND_OR_FORBIDDEN' using errcode = 'P0001';
  end if;

  if v_version_rec.lock_version <> p_expected_lock_version then
    raise exception 'QUOTATION_VERSION_CONFLICT: Stale lock version' using errcode = 'P0002';
  end if;

  delete from public.quotation_payment_schedules where quotation_version_id = v_version_rec.id;

  for v_elem in select * from jsonb_array_elements(p_milestones)
  loop
    v_milestone_name := trim(v_elem->>'milestoneName');
    if v_milestone_name is null or length(v_milestone_name) < 1 or length(v_milestone_name) > 150 then
      raise exception 'QUOTATION_VALIDATION_FAILED: Invalid milestone name' using errcode = 'P0001';
    end if;

    if p_mode = 'percentage' then
      if v_elem->'amountPaise' is not null and jsonb_typeof(v_elem->'amountPaise') <> 'null' then
        raise exception 'QUOTATION_VALIDATION_FAILED: Milestone amount must be null in percentage mode' using errcode = 'P0001';
      end if;

      if (v_elem->>'percentage') is null or (v_elem->>'percentage') !~ '^[0-9]+(\.[0-9]+)?$' then
        raise exception 'QUOTATION_VALIDATION_FAILED: Invalid milestone percentage' using errcode = 'P0001';
      end if;

      v_item_pct := (v_elem->>'percentage')::numeric;
      if v_item_pct < 0.00 or v_item_pct > 100.00 then
        raise exception 'QUOTATION_VALIDATION_FAILED: Invalid milestone percentage' using errcode = 'P0001';
      end if;

      v_pct_sum := v_pct_sum + v_item_pct;

      insert into public.quotation_payment_schedules (quotation_version_id, milestone_name, milestone_order, percentage, amount_paise)
      values (v_version_rec.id, v_milestone_name, v_order, v_item_pct, null);
    else
      if v_elem->'percentage' is not null and jsonb_typeof(v_elem->'percentage') <> 'null' then
        raise exception 'QUOTATION_VALIDATION_FAILED: Milestone percentage must be null in amount mode' using errcode = 'P0001';
      end if;

      if (v_elem->>'amountPaise') is null or (v_elem->>'amountPaise') !~ '^[0-9]+$' then
        raise exception 'QUOTATION_VALIDATION_FAILED: Invalid milestone amount' using errcode = 'P0001';
      end if;

      v_item_amt := (v_elem->>'amountPaise')::bigint;
      if v_item_amt < 0 or v_item_amt > 100000000000 then
        raise exception 'QUOTATION_VALIDATION_FAILED: Invalid milestone amount' using errcode = 'P0001';
      end if;

      v_amt_sum := v_amt_sum + v_item_amt;

      insert into public.quotation_payment_schedules (quotation_version_id, milestone_name, milestone_order, percentage, amount_paise)
      values (v_version_rec.id, v_milestone_name, v_order, null, v_item_amt);
    end if;

    v_order := v_order + 1;
  end loop;

  v_new_lock_version := v_version_rec.lock_version + 1;

  update public.quotation_versions set
    payment_schedule_mode = p_mode,
    lock_version = v_new_lock_version,
    updated_by = v_actor_id,
    updated_at = now()
  where id = v_version_rec.id;

  -- Explicit private recalculation of payment schedule amounts
  perform private.recalculate_quotation_payment_schedule(v_version_rec.id);

  -- Fetch updated version record
  select * into v_version_rec from public.quotation_versions where id = v_version_rec.id;

  insert into public.quotation_events (quotation_id, quotation_version_id, lead_id, event_type, actor_id, details)
  values (p_quotation_id, v_version_rec.id, v_lead_id, 'quotation.payment_schedule_changed', v_actor_id, jsonb_build_object(
    'lockVersion', v_new_lock_version,
    'mode', p_mode,
    'milestoneCount', v_total_milestones
  ));

  v_result := jsonb_build_object(
    'quotationId', p_quotation_id,
    'versionId', v_version_rec.id,
    'lockVersion', v_new_lock_version,
    'paymentScheduleMode', p_mode,
    'percentageSum', v_pct_sum,
    'amountSum', v_amt_sum,
    'isReconciled', case
      when p_mode = 'percentage' and v_pct_sum = 100.00 and v_version_rec.grand_total_paise is not null then true
      when p_mode = 'amount' and v_version_rec.grand_total_paise is not null and v_amt_sum = v_version_rec.grand_total_paise then true
      else false
    end,
    'idempotentReplay', false,
    'dto', public.get_quotation_draft(p_quotation_id)
  );

  if p_idempotency_key is not null and length(trim(p_idempotency_key)) >= 1 then
    insert into private.quotation_idempotency_requests (actor_id, operation_code, idempotency_key, request_hash, quotation_id, quotation_version_id, response_snapshot)
    values (v_actor_id, v_op_code, trim(p_idempotency_key), v_request_hash, p_quotation_id, v_version_rec.id, v_result);
  end if;

  return v_result;
end;
$$;

-- E. Archive Quotation Draft RPC
create or replace function public.archive_quotation_draft(
  p_quotation_id uuid,
  p_expected_lock_version bigint
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_lead_id uuid;
  v_version_rec record;
  v_new_lock_version bigint;
  v_result jsonb;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'QUOTATION_UNAUTHORIZED' using errcode = '42501';
  end if;

  if not private.quotation_can_edit(p_quotation_id) then
    raise exception 'QUOTATION_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  select lead_id into v_lead_id from public.quotations where id = p_quotation_id;

  select * into v_version_rec
  from public.quotation_versions
  where quotation_id = p_quotation_id
    and status = 'draft'
    and is_current_draft = true
  for update;

  if not found then
    raise exception 'QUOTATION_NOT_FOUND_OR_FORBIDDEN' using errcode = 'P0001';
  end if;

  if v_version_rec.lock_version <> p_expected_lock_version then
    raise exception 'QUOTATION_VERSION_CONFLICT: Stale lock version' using errcode = 'P0002';
  end if;

  v_new_lock_version := v_version_rec.lock_version + 1;

  update public.quotation_versions set
    status = 'archived',
    is_current_draft = false,
    lock_version = v_new_lock_version,
    updated_by = v_actor_id,
    updated_at = now()
  where id = v_version_rec.id;

  update public.quotations set
    status = 'archived',
    updated_by = v_actor_id,
    updated_at = now()
  where id = p_quotation_id;

  insert into public.quotation_events (quotation_id, quotation_version_id, lead_id, event_type, actor_id, details)
  values (p_quotation_id, v_version_rec.id, v_lead_id, 'quotation.draft_archived', v_actor_id, jsonb_build_object(
    'lockVersion', v_new_lock_version,
    'versionNumber', v_version_rec.version_number
  ));

  v_result := jsonb_build_object(
    'quotationId', p_quotation_id,
    'versionId', v_version_rec.id,
    'status', 'archived',
    'isCurrentDraft', false,
    'lockVersion', v_new_lock_version,
    'dto', public.get_quotation_draft(p_quotation_id)
  );

  return v_result;
end;
$$;

-- F. Get Quotation Draft DTO Read RPC
create or replace function public.get_quotation_draft(p_quotation_id uuid)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor_id uuid;
  v_root_rec record;
  v_ver_rec record;
  v_sections jsonb;
  v_schedules jsonb;
begin
  v_actor_id := auth.uid();
  if v_actor_id is null then
    raise exception 'QUOTATION_UNAUTHORIZED' using errcode = '42501';
  end if;

  if not private.quotation_can_view(p_quotation_id) then
    raise exception 'QUOTATION_NOT_FOUND_OR_FORBIDDEN' using errcode = '42501';
  end if;

  select * into v_root_rec from public.quotations where id = p_quotation_id;
  if not found then
    raise exception 'QUOTATION_NOT_FOUND_OR_FORBIDDEN' using errcode = 'P0001';
  end if;

  select * into v_ver_rec
  from public.quotation_versions
  where quotation_id = p_quotation_id
    and is_current_draft = true
  order by version_number desc
  limit 1;

  if not found then
    select * into v_ver_rec
    from public.quotation_versions
    where quotation_id = p_quotation_id
    order by version_number desc
    limit 1;
  end if;

  if v_ver_rec.id is null then
    return jsonb_build_object(
      'quotationId', v_root_rec.id,
      'leadId', v_root_rec.lead_id,
      'quotationNumber', v_root_rec.quotation_number,
      'rootStatus', v_root_rec.status,
      'status', v_root_rec.status,
      'version', null
    );
  end if;

  -- Aggregate sections and items
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', s.id,
      'sectionName', s.section_name,
      'displayOrder', s.display_order,
      'subtotalPaise', s.subtotal_paise,
      'items', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', i.id,
            'itemName', i.item_name,
            'description', i.description,
            'specifications', i.specifications,
            'quantity', i.quantity,
            'unitOfMeasure', i.unit_of_measure,
            'unitRatePaise', i.unit_rate_paise,
            'lineTotalPaise', i.line_total_paise,
            'displayOrder', i.display_order
          ) order by i.display_order
        ), '[]'::jsonb)
        from public.quotation_items i
        where i.section_id = s.id
      )
    ) order by s.display_order
  ), '[]'::jsonb) into v_sections
  from public.quotation_sections s
  where s.quotation_version_id = v_ver_rec.id;

  -- Aggregate payment schedules
  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', ps.id,
      'milestoneName', ps.milestone_name,
      'milestoneOrder', ps.milestone_order,
      'percentage', ps.percentage,
      'amountPaise', ps.amount_paise
    ) order by ps.milestone_order
  ), '[]'::jsonb) into v_schedules
  from public.quotation_payment_schedules ps
  where ps.quotation_version_id = v_ver_rec.id;

  return jsonb_build_object(
    'quotationId', v_root_rec.id,
    'leadId', v_root_rec.lead_id,
    'quotationNumber', v_root_rec.quotation_number,
    'rootStatus', v_root_rec.status,
    'status', v_root_rec.status,
    'version', jsonb_build_object(
      'id', v_ver_rec.id,
      'versionNumber', v_ver_rec.version_number,
      'lockVersion', v_ver_rec.lock_version,
      'status', v_ver_rec.status,
      'isCurrentDraft', v_ver_rec.is_current_draft,
      'title', v_ver_rec.title,
      'clientNameSnapshot', v_ver_rec.client_name_snapshot,
      'clientEmailSnapshot', v_ver_rec.client_email_snapshot,
      'clientPhoneSnapshot', v_ver_rec.client_phone_snapshot,
      'propertyAddressSnapshot', v_ver_rec.property_address_snapshot,
      'scopeSummary', v_ver_rec.scope_summary,
      'paymentScheduleMode', v_ver_rec.payment_schedule_mode,
      'subtotalPaise', v_ver_rec.subtotal_paise,
      'discountType', v_ver_rec.discount_type,
      'discountValuePaise', v_ver_rec.discount_value_paise,
      'discountPercentage', v_ver_rec.discount_percentage,
      'discountTotalPaise', v_ver_rec.discount_total_paise,
      'taxableBasePaise', v_ver_rec.taxable_base_paise,
      'taxProfileId', v_ver_rec.tax_profile_id,
      'taxRatePercentage', v_ver_rec.tax_rate_percentage,
      'taxTotalPaise', v_ver_rec.tax_total_paise,
      'grandTotalPaise', v_ver_rec.grand_total_paise,
      'termsAndConditions', v_ver_rec.terms_and_conditions,
      'inclusions', v_ver_rec.inclusions,
      'exclusions', v_ver_rec.exclusions
    ),
    'sections', v_sections,
    'paymentSchedules', v_schedules
  );
end;
$$;

-- =============================================================================
-- 5. Security Definer Ownership, Explicit Execute Revokes & Grants
-- =============================================================================

-- Set function owners to postgres
alter function private.generate_quotation_number() owner to postgres;
alter function private.quotation_can_view(uuid) owner to postgres;
alter function private.quotation_can_create_for_lead(uuid) owner to postgres;
alter function private.quotation_can_edit(uuid) owner to postgres;
alter function private.recalculate_quotation_payment_schedule(uuid) owner to postgres;
alter function private.recalculate_quotation_totals(uuid) owner to postgres;
alter function public.create_quotation_draft(uuid, text, text) owner to postgres;
alter function public.update_quotation_draft(uuid, bigint, text, text, text, bigint, numeric, uuid, boolean, text, text[], text[], text) owner to postgres;
alter function public.save_quotation_draft_items(uuid, bigint, jsonb, text) owner to postgres;
alter function public.replace_quotation_payment_schedule(uuid, bigint, text, jsonb, text) owner to postgres;
alter function public.archive_quotation_draft(uuid, bigint) owner to postgres;
alter function public.get_quotation_draft(uuid) owner to postgres;

-- Revoke ALL from public and anon on all routines
revoke all on function private.generate_quotation_number() from public, anon, authenticated;
revoke all on function private.recalculate_quotation_payment_schedule(uuid) from public, anon, authenticated;
revoke all on function private.recalculate_quotation_totals(uuid) from public, anon, authenticated;

revoke execute on function private.quotation_can_view(uuid) from public, anon;
revoke execute on function private.quotation_can_create_for_lead(uuid) from public, anon;
revoke execute on function private.quotation_can_edit(uuid) from public, anon;

revoke execute on function public.create_quotation_draft(uuid, text, text) from public, anon;
revoke execute on function public.update_quotation_draft(uuid, bigint, text, text, text, bigint, numeric, uuid, boolean, text, text[], text[], text) from public, anon;
revoke execute on function public.save_quotation_draft_items(uuid, bigint, jsonb, text) from public, anon;
revoke execute on function public.replace_quotation_payment_schedule(uuid, bigint, text, jsonb, text) from public, anon;
revoke execute on function public.archive_quotation_draft(uuid, bigint) from public, anon;
revoke execute on function public.get_quotation_draft(uuid) from public, anon;

-- Grant EXECUTE on RLS authorization helpers and public business RPCs to authenticated ONLY
grant execute on function private.quotation_can_view(uuid) to authenticated;
grant execute on function private.quotation_can_create_for_lead(uuid) to authenticated;
grant execute on function private.quotation_can_edit(uuid) to authenticated;

grant execute on function public.create_quotation_draft(uuid, text, text) to authenticated;
grant execute on function public.update_quotation_draft(uuid, bigint, text, text, text, bigint, numeric, uuid, boolean, text, text[], text[], text) to authenticated;
grant execute on function public.save_quotation_draft_items(uuid, bigint, jsonb, text) to authenticated;
grant execute on function public.replace_quotation_payment_schedule(uuid, bigint, text, jsonb, text) to authenticated;
grant execute on function public.archive_quotation_draft(uuid, bigint) to authenticated;
grant execute on function public.get_quotation_draft(uuid) to authenticated;
