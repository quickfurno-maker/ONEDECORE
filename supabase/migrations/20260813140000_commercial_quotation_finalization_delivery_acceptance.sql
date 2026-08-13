-- ============================================================================
-- M26 Migration: ONEDECORE Phase 7B Commercial Quotation Finalization,
-- Premium PDF Storage, Secure Delivery & Client Acceptance Data Plane
-- ============================================================================

-- ----------------------------------------------------------------------------
-- 1. System Permissions: Register quotations.finalize and quotations.send
-- ----------------------------------------------------------------------------
insert into public.permissions (code, name, description, is_system, is_active) values
  ('quotations.finalize', 'Finalize Commercial Quotations', 'Allows finalizing a draft commercial quotation into an immutable version', true, true),
  ('quotations.send', 'Send Commercial Quotations', 'Allows sending a finalized quotation to a client via secure WhatsApp link', true, true)
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
  and p.code in ('quotations.finalize', 'quotations.send')
  and r.code in ('super_admin', 'sales_manager', 'sales_executive', 'management', 'sales')
on conflict (role_id, permission_id) do nothing;

-- ----------------------------------------------------------------------------
-- 2. Commercial Settings Table (Singleton governance config)
-- ----------------------------------------------------------------------------
create table if not exists public.quotation_commercial_settings (
  setting_key text primary key default 'global',
  max_discount_percentage numeric(5,2) not null check (max_discount_percentage >= 0.00 and max_discount_percentage <= 100.00),
  updated_by uuid not null references public.profiles(id) on delete restrict,
  updated_at timestamptz not null default now(),

  constraint chk_quotation_commercial_settings_key check (setting_key = 'global')
);

comment on table public.quotation_commercial_settings is
  'Singleton governance config table for commercial quotation rules (e.g. max discount percentage).';

alter table public.quotation_commercial_settings enable row level security;

create policy quotation_commercial_settings_staff_read on public.quotation_commercial_settings
  for select to authenticated using (
    (select private.has_role('super_admin'))
    or (select private.has_role('sales_manager'))
    or (select private.has_role('management'))
    or (select private.has_role('sales_executive'))
    or (select private.has_role('sales'))
  );

-- ----------------------------------------------------------------------------
-- 3. PDF Documents Table & Storage Bucket
-- ----------------------------------------------------------------------------
create table if not exists public.quotation_pdf_documents (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  quotation_version_id uuid not null unique references public.quotation_versions(id) on delete cascade,
  bucket_id text not null default 'quotation-documents',
  object_path text not null unique,
  status text not null default 'pending' check (status in ('pending', 'ready', 'failed')),
  pdf_sha256 text null check (pdf_sha256 is null or pdf_sha256 ~ '^[0-9a-f]{64}$'),
  file_size_bytes bigint null check (file_size_bytes is null or file_size_bytes > 0),
  created_by uuid not null references public.profiles(id) on delete restrict,
  created_at timestamptz not null default now(),
  ready_at timestamptz null
);

comment on table public.quotation_pdf_documents is
  'Immutable PDF document registry per finalized quotation version.';

alter table public.quotation_pdf_documents enable row level security;

create policy quotation_pdf_documents_staff_read on public.quotation_pdf_documents
  for select to authenticated using (
    private.quotation_can_view(quotation_id)
  );

-- Ensure private storage bucket 'quotation-documents' exists
insert into storage.buckets (id, name, public)
values ('quotation-documents', 'quotation-documents', false)
on conflict (id) do nothing;

-- ----------------------------------------------------------------------------
-- 4. Access Grants Table (Capability Tokens)
-- ----------------------------------------------------------------------------
create table if not exists public.quotation_access_grants (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null references public.quotations(id) on delete cascade,
  quotation_version_id uuid not null references public.quotation_versions(id) on delete cascade,
  derivation_nonce text not null,
  capability_token_hash text not null unique check (capability_token_hash ~ '^[0-9a-f]{64}$'),
  revoked_at timestamptz null,
  revoked_by uuid references public.profiles(id) on delete set null,
  revocation_reason text null,
  expires_at timestamptz null,
  created_by uuid references public.profiles(id) on delete set null,
  created_at timestamptz not null default now()
);

comment on table public.quotation_access_grants is
  'Access grant ledger storing SHA-256 capability digests. Plaintext bearer tokens are NEVER stored.';

alter table public.quotation_access_grants enable row level security;

-- NOTE: 0 direct SELECT/DML policies for anon or authenticated on quotation_access_grants.
-- Controlled exclusively through SECURITY DEFINER RPCs or service role.

-- ----------------------------------------------------------------------------
-- 5. Client Acceptances Table
-- ----------------------------------------------------------------------------
create table if not exists public.quotation_acceptances (
  id uuid primary key default gen_random_uuid(),
  quotation_id uuid not null unique references public.quotations(id) on delete cascade,
  lead_id uuid not null unique references public.leads(id) on delete cascade,
  quotation_version_id uuid not null unique references public.quotation_versions(id) on delete cascade,
  access_grant_id uuid not null references public.quotation_access_grants(id) on delete restrict,
  accepted_by_name text not null check (length(trim(accepted_by_name)) between 2 and 120),
  accepted_by_email text null check (accepted_by_email is null or (length(trim(accepted_by_email)) between 5 and 254 and accepted_by_email ~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$')),
  accepted_at timestamptz not null default now(),
  credited_sales_executive_id uuid not null references public.profiles(id) on delete restrict,
  taxable_base_paise bigint not null check (taxable_base_paise >= 0),
  sales_achievement_month text not null check (sales_achievement_month ~ '^\d{4}-\d{2}$'),
  created_at timestamptz not null default now()
);

comment on table public.quotation_acceptances is
  'Permanent commercial quotation client acceptance record driving Closed-Won CRM milestone.';

alter table public.quotation_acceptances enable row level security;

create policy quotation_acceptances_staff_read on public.quotation_acceptances
  for select to authenticated using (
    private.quotation_can_view(quotation_id)
  );

-- ----------------------------------------------------------------------------
-- 6. Extend whatsapp_send_intents & quotation_versions
-- ----------------------------------------------------------------------------
alter table public.whatsapp_send_intents
  add column if not exists secure_content_kind text null check (secure_content_kind is null or secure_content_kind in ('quotation_link')),
  add column if not exists secure_content_ref uuid null references public.quotation_access_grants(id) on delete set null;

alter table public.whatsapp_send_intents
  drop constraint if exists chk_whatsapp_send_intents_secure_content_pair;

alter table public.whatsapp_send_intents
  add constraint chk_whatsapp_send_intents_secure_content_pair check (
    (secure_content_kind is null and secure_content_ref is null)
    or (secure_content_kind is not null and secure_content_ref is not null)
  );

alter table public.quotation_versions
  add column if not exists finalized_at timestamptz null,
  add column if not exists finalized_by uuid references public.profiles(id) on delete set null,
  add column if not exists finalized_content_sha256 text null check (finalized_content_sha256 is null or finalized_content_sha256 ~ '^[0-9a-f]{64}$'),
  add column if not exists tax_profile_snapshot jsonb null check (tax_profile_snapshot is null or (jsonb_typeof(tax_profile_snapshot) = 'object' and pg_column_size(tax_profile_snapshot) <= 2048));

-- Update version status check constraint to include 'finalized'
alter table public.quotation_versions
  drop constraint if exists chk_quotation_versions_status;

alter table public.quotation_versions
  add constraint chk_quotation_versions_status check (status in ('draft', 'finalized', 'archived'));

alter table public.quotation_versions
  drop constraint if exists chk_quotation_versions_draft_current;

alter table public.quotation_versions
  add constraint chk_quotation_versions_draft_current check (
    (status = 'draft' and is_current_draft = true)
    or (status in ('finalized', 'archived') and is_current_draft = false)
  );

-- ----------------------------------------------------------------------------
-- 7. Immutability Trigger Function
-- ----------------------------------------------------------------------------
create or replace function public.prevent_finalized_quotation_mutation()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_version_status text;
begin
  if TG_TABLE_NAME = 'quotation_versions' then
    if OLD.status in ('finalized', 'archived') then
      raise exception 'QUOTATION_VERSION_IMMUTABLE: Cannot update or delete a finalized/archived quotation version.';
    end if;
  elsif TG_TABLE_NAME in ('quotation_sections', 'quotation_payment_schedules') then
    select status into v_version_status
    from public.quotation_versions
    where id = OLD.quotation_version_id;

    if v_version_status in ('finalized', 'archived') then
      raise exception 'QUOTATION_CHILDREN_IMMUTABLE: Cannot mutate sections or schedule of a finalized/archived quotation version.';
    end if;
  elsif TG_TABLE_NAME = 'quotation_items' then
    select qv.status into v_version_status
    from public.quotation_sections qs
    join public.quotation_versions qv on qs.quotation_version_id = qv.id
    where qs.id = OLD.section_id;

    if v_version_status in ('finalized', 'archived') then
      raise exception 'QUOTATION_CHILDREN_IMMUTABLE: Cannot mutate items of a finalized/archived quotation version.';
    end if;
  end if;

  if TG_OP = 'DELETE' then
    return OLD;
  end if;
  return NEW;
end;
$$;

drop trigger if exists trg_prevent_finalized_version_update on public.quotation_versions;
create trigger trg_prevent_finalized_version_update
  before update on public.quotation_versions
  for each row
  when (OLD.status in ('finalized', 'archived'))
  execute function public.prevent_finalized_quotation_mutation();

drop trigger if exists trg_prevent_finalized_section_mutation on public.quotation_sections;
create trigger trg_prevent_finalized_section_mutation
  before update or delete on public.quotation_sections
  for each row
  execute function public.prevent_finalized_quotation_mutation();

drop trigger if exists trg_prevent_finalized_item_mutation on public.quotation_items;
create trigger trg_prevent_finalized_item_mutation
  before update or delete or insert on public.quotation_items
  for each row
  execute function public.prevent_finalized_quotation_mutation();

drop trigger if exists trg_prevent_finalized_schedule_mutation on public.quotation_payment_schedules;
create trigger trg_prevent_finalized_schedule_mutation
  before update or delete on public.quotation_payment_schedules
  for each row
  execute function public.prevent_finalized_quotation_mutation();

-- ----------------------------------------------------------------------------
-- 8. Private Canonical Content SHA-256 Calculator
-- ----------------------------------------------------------------------------
create or replace function private.compute_canonical_quotation_sha256(p_version_id uuid)
returns text
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_payload jsonb;
  v_hash text;
begin
  select jsonb_build_object(
    'quotation_id', qv.quotation_id,
    'version_number', qv.version_number,
    'title', qv.title,
    'client_name_snapshot', qv.client_name_snapshot,
    'client_email_snapshot', qv.client_email_snapshot,
    'client_phone_snapshot', qv.client_phone_snapshot,
    'property_address_snapshot', qv.property_address_snapshot,
    'scope_summary', qv.scope_summary,
    'subtotal_paise', qv.subtotal_paise,
    'discount_type', qv.discount_type,
    'discount_value_paise', qv.discount_value_paise,
    'discount_percentage', qv.discount_percentage,
    'discount_total_paise', qv.discount_total_paise,
    'taxable_base_paise', qv.taxable_base_paise,
    'tax_rate_percentage', qv.tax_rate_percentage,
    'tax_total_paise', qv.tax_total_paise,
    'grand_total_paise', qv.grand_total_paise,
    'sections', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'section_name', qs.section_name,
          'display_order', qs.display_order,
          'subtotal_paise', qs.subtotal_paise,
          'items', (
            select coalesce(jsonb_agg(
              jsonb_build_object(
                'item_name', qi.item_name,
                'description', qi.description,
                'specifications', qi.specifications,
                'quantity', qi.quantity,
                'unit_of_measure', qi.unit_of_measure,
                'unit_rate_paise', qi.unit_rate_paise,
                'line_total_paise', qi.line_total_paise,
                'display_order', qi.display_order
              ) order by qi.display_order asc, qi.id asc
            ), '[]'::jsonb)
            from public.quotation_items qi
            where qi.section_id = qs.id
          )
        ) order by qs.display_order asc, qs.id asc
      ), '[]'::jsonb)
      from public.quotation_sections qs
      where qs.quotation_version_id = p_version_id
    ),
    'payment_schedule', (
      select coalesce(jsonb_agg(
        jsonb_build_object(
          'milestone_name', qps.milestone_name,
          'milestone_order', qps.milestone_order,
          'percentage', qps.percentage,
          'amount_paise', qps.amount_paise
        ) order by qps.milestone_order asc, qps.id asc
      ), '[]'::jsonb)
      from public.quotation_payment_schedules qps
      where qps.quotation_version_id = p_version_id
    )
  ) into v_payload
  from public.quotation_versions qv
  where qv.id = p_version_id;

  if v_payload is null then
    return null;
  end if;

  select encode(
    extensions.digest(
      convert_to(v_payload::text, 'UTF8'),
      'sha256'
    ),
    'hex'
  ) into v_hash;

  return v_hash;
end;
$$;

-- ----------------------------------------------------------------------------
-- 9. Super Admin Settings RPCs & Tax Profile RPCs
-- ----------------------------------------------------------------------------
create or replace function public.set_quotation_max_discount(p_max_discount numeric)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED: Authentication required.';
  end if;

  if not (select private.has_role('super_admin')) then
    raise exception 'FORBIDDEN: Only Super Admin can configure maximum quotation discount.';
  end if;

  if p_max_discount is not null and (p_max_discount < 0 or p_max_discount > 100) then
    raise exception 'INVALID_BOUND: Maximum discount percentage must be between 0.00 and 100.00.';
  end if;

  insert into public.quotation_commercial_settings (setting_key, max_discount_percentage, updated_by, updated_at)
  values ('global', p_max_discount, v_user_id, now())
  on conflict (setting_key) do update
  set max_discount_percentage = EXCLUDED.max_discount_percentage,
      updated_by = EXCLUDED.updated_by,
      updated_at = now();

  select jsonb_build_object('success', true, 'max_discount_percentage', p_max_discount) into v_result;
  return v_result;
end;
$$;

create or replace function public.admin_create_quotation_tax_profile(
  p_code text,
  p_display_name text,
  p_rate_percentage numeric
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_new_id uuid;
begin
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED: Authentication required.';
  end if;

  if not (select private.has_role('super_admin')) then
    raise exception 'FORBIDDEN: Only Super Admin can manage tax profiles.';
  end if;

  insert into public.quotation_tax_profiles (code, display_name, rate_percentage, is_active, created_by)
  values (trim(p_code), trim(p_display_name), p_rate_percentage, true, v_user_id)
  returning id into v_new_id;

  return jsonb_build_object('success', true, 'tax_profile_id', v_new_id);
end;
$$;

create or replace function public.admin_update_quotation_tax_profile(
  p_tax_profile_id uuid,
  p_display_name text,
  p_rate_percentage numeric,
  p_is_active boolean
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
begin
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED: Authentication required.';
  end if;

  if not (select private.has_role('super_admin')) then
    raise exception 'FORBIDDEN: Only Super Admin can manage tax profiles.';
  end if;

  update public.quotation_tax_profiles
  set display_name = trim(p_display_name),
      rate_percentage = p_rate_percentage,
      is_active = p_is_active,
      updated_at = now()
  where id = p_tax_profile_id;

  return jsonb_build_object('success', true);
end;
$$;

-- ----------------------------------------------------------------------------
-- 10. Server-Authoritative Finalization RPC
-- ----------------------------------------------------------------------------
create or replace function public.finalize_quotation_version(
  p_quotation_id uuid,
  p_version_id uuid,
  p_expected_lock_version integer,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_quotation record;
  v_version record;
  v_lead record;
  v_max_discount numeric(5,2);
  v_tax_profile record;
  v_item_count integer;
  v_schedule_count integer;
  v_effective_discount_pct numeric(7,4);
  v_canonical_hash text;
  v_tax_snapshot jsonb;
  v_request_hash text;
  v_existing_req record;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED: Authentication required to finalize quotation.';
  end if;

  if not (select public.authorize('quotations.finalize')) then
    raise exception 'FORBIDDEN: Permission quotations.finalize is required.';
  end if;

  -- Verify active profile
  if not exists (select 1 from public.profiles where id = v_user_id and status = 'active') then
    raise exception 'FORBIDDEN: Active profile required.';
  end if;

  -- Lock quotation root
  select * into v_quotation
  from public.quotations
  where id = p_quotation_id
  for update;

  if v_quotation.id is null then
    raise exception 'QUOTATION_NOT_FOUND: Quotation root % does not exist.', p_quotation_id;
  end if;

  -- Check Sales Exec scope
  select * into v_lead from public.leads where id = v_quotation.lead_id;
  if not (select private.has_role('super_admin'))
     and not (select private.has_role('sales_manager'))
     and not (select private.has_role('management')) then
    if v_lead.assigned_to is null or v_lead.assigned_to <> v_user_id then
      raise exception 'FORBIDDEN: Sales Executive can only finalize quotations for assigned leads.';
    end if;
  end if;

  -- Lock target version
  select * into v_version
  from public.quotation_versions
  where id = p_version_id and quotation_id = p_quotation_id
  for update;

  if v_version.id is null then
    raise exception 'VERSION_NOT_FOUND: Quotation version % does not exist.', p_version_id;
  end if;

  -- Handle Idempotency
  if p_idempotency_key is not null and length(trim(p_idempotency_key)) > 0 then
    perform pg_advisory_xact_lock(hashtext('finalize_quotation_version'), hashtext(v_user_id::text || ':' || p_idempotency_key));

    v_request_hash := encode(extensions.digest(convert_to(jsonb_build_object('quotation_id', p_quotation_id, 'version_id', p_version_id, 'lock_version', p_expected_lock_version)::text, 'UTF8'), 'sha256'), 'hex');

    select * into v_existing_req
    from private.quotation_idempotency_requests
    where actor_id = v_user_id
      and operation_code = 'finalize_quotation_version'
      and idempotency_key = p_idempotency_key;

    if v_existing_req.id is not null then
      if v_existing_req.request_hash = v_request_hash then
        return v_existing_req.response_snapshot;
      else
        raise exception 'IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH: Idempotency key reused with different payload.';
      end if;
    end if;
  end if;

  if v_version.status <> 'draft' or not v_version.is_current_draft then
    raise exception 'INVALID_VERSION_STATE: Only current active draft versions can be finalized.';
  end if;

  if v_version.lock_version <> p_expected_lock_version then
    raise exception 'LOCK_VERSION_MISMATCH: Lock version conflict (expected %, current %).', p_expected_lock_version, v_version.lock_version;
  end if;

  -- Validate Client Snapshots
  if v_version.client_name_snapshot is null or length(trim(v_version.client_name_snapshot)) = 0 then
    raise exception 'MISSING_CLIENT_NAME: Client name snapshot is required before finalization.';
  end if;

  if v_version.client_phone_snapshot is null or length(trim(v_version.client_phone_snapshot)) = 0 then
    raise exception 'MISSING_CLIENT_PHONE: Client phone snapshot is required before finalization.';
  end if;

  if v_version.title is null or length(trim(v_version.title)) = 0 then
    raise exception 'MISSING_TITLE: Quotation title is required before finalization.';
  end if;

  -- Recalculate totals
  perform private.recalculate_quotation_totals(p_version_id);

  -- Re-read version row
  select * into v_version from public.quotation_versions where id = p_version_id;

  if v_version.subtotal_paise <= 0 then
    raise exception 'EMPTY_QUOTATION: Cannot finalize a quotation with zero subtotal.';
  end if;

  -- Validate Line Items Exist
  select count(*)::integer into v_item_count
  from public.quotation_items qi
  join public.quotation_sections qs on qi.section_id = qs.id
  where qs.quotation_version_id = p_version_id;

  if v_item_count = 0 then
    raise exception 'EMPTY_QUOTATION_ITEMS: Quotation version has zero line items.';
  end if;

  -- Validate Max Discount Governance
  select max_discount_percentage into v_max_discount
  from public.quotation_commercial_settings
  where setting_key = 'global';

  if v_max_discount is null then
    raise exception 'MISSING_COMMERCIAL_SETTINGS: Maximum discount setting has not been configured by Super Admin.';
  end if;

  if v_version.discount_type = 'percentage' then
    if v_version.discount_percentage > v_max_discount then
      raise exception 'EXCEEDS_MAX_DISCOUNT: Discount percentage (%) exceeds maximum allowed (%).', v_version.discount_percentage, v_max_discount;
    end if;
  elsif v_version.discount_type = 'flat' then
    v_effective_discount_pct := (v_version.discount_total_paise::numeric * 100.0) / v_version.subtotal_paise::numeric;
    if v_effective_discount_pct > v_max_discount then
      raise exception 'EXCEEDS_MAX_DISCOUNT: Flat discount effective percentage (%) exceeds maximum allowed (%).', round(v_effective_discount_pct, 2), v_max_discount;
    end if;
  end if;

  -- Validate Tax Profile Snapshot
  if v_version.tax_profile_id is null then
    raise exception 'MISSING_TAX_PROFILE: A tax profile must be selected before finalization.';
  end if;

  select * into v_tax_profile
  from public.quotation_tax_profiles
  where id = v_version.tax_profile_id;

  if v_tax_profile.id is null or not v_tax_profile.is_active then
    raise exception 'INVALID_TAX_PROFILE: Selected tax profile is invalid or inactive.';
  end if;

  v_tax_snapshot := jsonb_build_object(
    'id', v_tax_profile.id,
    'code', v_tax_profile.code,
    'display_name', v_tax_profile.display_name,
    'rate_percentage', v_tax_profile.rate_percentage
  );

  -- Validate Payment Schedule
  select count(*)::integer into v_schedule_count
  from public.quotation_payment_schedules
  where quotation_version_id = p_version_id;

  if v_schedule_count = 0 then
    raise exception 'MISSING_PAYMENT_SCHEDULE: Quotation payment schedule is required.';
  end if;

  if v_version.payment_schedule_mode = 'percentage' then
    if (select coalesce(sum(percentage), 0) from public.quotation_payment_schedules where quotation_version_id = p_version_id) <> 100.00 then
      raise exception 'INVALID_PAYMENT_SCHEDULE: Payment schedule milestone percentages must sum exactly to 100.00%%.';
    end if;
  elsif v_version.payment_schedule_mode = 'amount' then
    if (select coalesce(sum(amount_paise), 0) from public.quotation_payment_schedules where quotation_version_id = p_version_id) <> v_version.grand_total_paise then
      raise exception 'INVALID_PAYMENT_SCHEDULE: Payment schedule milestone amounts must sum exactly to grand total.';
    end if;
  end if;

  -- Compute Canonical Content SHA-256
  v_canonical_hash := private.compute_canonical_quotation_sha256(p_version_id);

  if v_canonical_hash is null then
    raise exception 'CANONICAL_HASH_FAILED: Failed to generate canonical content SHA-256.';
  end if;

  -- Finalize Version
  update public.quotation_versions
  set status = 'finalized',
      is_current_draft = false,
      finalized_at = now(),
      finalized_by = v_user_id,
      finalized_content_sha256 = v_canonical_hash,
      tax_profile_snapshot = v_tax_snapshot,
      lock_version = lock_version + 1,
      updated_at = now()
  where id = p_version_id;

  -- Append Domain Audit Event
  insert into public.quotation_events (
    quotation_id,
    quotation_version_id,
    lead_id,
    event_type,
    actor_id,
    details
  ) values (
    p_quotation_id,
    p_version_id,
    v_quotation.lead_id,
    'quotation.finalized',
    v_user_id,
    jsonb_build_object(
      'version_number', v_version.version_number,
      'canonical_sha256', v_canonical_hash,
      'grand_total_paise', v_version.grand_total_paise
    )
  );

  v_result := jsonb_build_object(
    'success', true,
    'quotation_id', p_quotation_id,
    'version_id', p_version_id,
    'version_number', v_version.version_number,
    'status', 'finalized',
    'finalized_content_sha256', v_canonical_hash
  );

  -- Record Idempotency Request
  if p_idempotency_key is not null and length(trim(p_idempotency_key)) > 0 then
    insert into private.quotation_idempotency_requests (
      actor_id,
      operation_code,
      idempotency_key,
      request_hash,
      quotation_id,
      quotation_version_id,
      response_snapshot
    ) values (
      v_user_id,
      'finalize_quotation_version',
      p_idempotency_key,
      v_request_hash,
      p_quotation_id,
      p_version_id,
      v_result
    );
  end if;

  return v_result;
end;
$$;

-- ----------------------------------------------------------------------------
-- 11. Access Grant RPCs
-- ----------------------------------------------------------------------------
create or replace function public.issue_quotation_access_grant(
  p_version_id uuid,
  p_derivation_nonce text,
  p_capability_token_hash text
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_version record;
  v_quotation record;
  v_lead record;
  v_pdf record;
  v_grant_id uuid;
begin
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED: Authentication required.';
  end if;

  if not (select public.authorize('quotations.send')) then
    raise exception 'FORBIDDEN: Permission quotations.send is required.';
  end if;

  select * into v_version from public.quotation_versions where id = p_version_id;
  if v_version.id is null or v_version.status <> 'finalized' then
    raise exception 'INVALID_VERSION_STATE: Access grants can only be issued for finalized quotation versions.';
  end if;

  select * into v_quotation from public.quotations where id = v_version.quotation_id;
  select * into v_lead from public.leads where id = v_quotation.lead_id;

  if not (select private.has_role('super_admin'))
     and not (select private.has_role('sales_manager'))
     and not (select private.has_role('management')) then
    if v_lead.assigned_to is null or v_lead.assigned_to <> v_user_id then
      raise exception 'FORBIDDEN: Sales Executive can only issue grants for assigned leads.';
    end if;
  end if;

  -- Verify PDF is READY
  select * into v_pdf from public.quotation_pdf_documents where quotation_version_id = p_version_id;
  if v_pdf.id is null or v_pdf.status <> 'ready' then
    raise exception 'PDF_NOT_READY: PDF document must be generated and ready before issuing an access grant.';
  end if;

  -- Verify quotation root is not already accepted
  if exists (select 1 from public.quotation_acceptances where quotation_id = v_quotation.id) then
    raise exception 'QUOTATION_ALREADY_ACCEPTED: Cannot issue new access grants for an accepted quotation.';
  end if;

  insert into public.quotation_access_grants (
    quotation_id,
    quotation_version_id,
    derivation_nonce,
    capability_token_hash,
    created_by
  ) values (
    v_quotation.id,
    p_version_id,
    p_derivation_nonce,
    p_capability_token_hash,
    v_user_id
  ) returning id into v_grant_id;

  insert into public.quotation_events (
    quotation_id,
    quotation_version_id,
    lead_id,
    event_type,
    actor_id,
    details
  ) values (
    v_quotation.id,
    p_version_id,
    v_quotation.lead_id,
    'quotation.grant_issued',
    v_user_id,
    jsonb_build_object('grant_id', v_grant_id)
  );

  return jsonb_build_object('success', true, 'grant_id', v_grant_id);
end;
$$;

create or replace function public.revoke_quotation_access_grant(
  p_grant_id uuid,
  p_reason text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_grant record;
  v_lead record;
begin
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED: Authentication required.';
  end if;

  if not (select public.authorize('quotations.send')) then
    raise exception 'FORBIDDEN: Permission quotations.send is required.';
  end if;

  select * into v_grant from public.quotation_access_grants where id = p_grant_id;
  if v_grant.id is null then
    raise exception 'GRANT_NOT_FOUND: Access grant % does not exist.', p_grant_id;
  end if;

  select l.* into v_lead from public.quotations q join public.leads l on l.id = q.lead_id where q.id = v_grant.quotation_id;
  if not (select private.has_role('super_admin'))
     and not (select private.has_role('sales_manager'))
     and not (select private.has_role('management')) then
    if v_lead.assigned_to is null or v_lead.assigned_to <> v_user_id then
      raise exception 'FORBIDDEN: Sales Executive can only revoke grants for assigned leads.';
    end if;
  end if;

  update public.quotation_access_grants
  set revoked_at = now(),
      revoked_by = v_user_id,
      revocation_reason = coalesce(p_reason, 'Manual revocation by authorized staff')
  where id = p_grant_id and revoked_at is null;

  return jsonb_build_object('success', true);
end;
$$;

-- ----------------------------------------------------------------------------
-- 12. Client Capability Read RPC
-- ----------------------------------------------------------------------------
create or replace function public.get_quotation_by_capability(p_capability_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token_hash text;
  v_grant record;
  v_version record;
  v_quotation record;
  v_lead record;
  v_acceptance record;
  v_sections jsonb;
  v_payment_schedule jsonb;
begin
  if p_capability_token is null or length(trim(p_capability_token)) = 0 then
    return jsonb_build_object('success', false, 'message', 'QUOTATION_NOT_FOUND');
  end if;

  v_token_hash := encode(extensions.digest(convert_to(trim(p_capability_token), 'UTF8'), 'sha256'), 'hex');

  select * into v_grant
  from public.quotation_access_grants
  where capability_token_hash = v_token_hash
    and revoked_at is null
    and (expires_at is null or expires_at > now());

  if v_grant.id is null then
    return jsonb_build_object('success', false, 'message', 'QUOTATION_NOT_FOUND');
  end if;

  select * into v_version
  from public.quotation_versions
  where id = v_grant.quotation_version_id and status = 'finalized';

  if v_version.id is null then
    return jsonb_build_object('success', false, 'message', 'QUOTATION_NOT_FOUND');
  end if;

  select * into v_quotation from public.quotations where id = v_grant.quotation_id;
  select * into v_lead from public.leads where id = v_quotation.lead_id;
  select * into v_acceptance from public.quotation_acceptances where quotation_version_id = v_version.id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', qs.id,
      'section_name', qs.section_name,
      'display_order', qs.display_order,
      'subtotal_paise', qs.subtotal_paise,
      'items', (
        select coalesce(jsonb_agg(
          jsonb_build_object(
            'id', qi.id,
            'item_name', qi.item_name,
            'description', qi.description,
            'specifications', qi.specifications,
            'quantity', qi.quantity,
            'unit_of_measure', qi.unit_of_measure,
            'unit_rate_paise', qi.unit_rate_paise,
            'line_total_paise', qi.line_total_paise,
            'display_order', qi.display_order
          ) order by qi.display_order asc, qi.id asc
        ), '[]'::jsonb)
        from public.quotation_items qi
        where qi.section_id = qs.id
      )
    ) order by qs.display_order asc, qs.id asc
  ), '[]'::jsonb) into v_sections
  from public.quotation_sections qs
  where qs.quotation_version_id = v_version.id;

  select coalesce(jsonb_agg(
    jsonb_build_object(
      'id', qps.id,
      'milestone_name', qps.milestone_name,
      'milestone_order', qps.milestone_order,
      'percentage', qps.percentage,
      'amount_paise', qps.amount_paise
    ) order by qps.milestone_order asc, qps.id asc
  ), '[]'::jsonb) into v_payment_schedule
  from public.quotation_payment_schedules qps
  where qps.quotation_version_id = v_version.id;

  return jsonb_build_object(
    'success', true,
    'data', jsonb_build_object(
      'quotation_id', v_quotation.id,
      'quotation_version_id', v_version.id,
      'quotation_number', v_quotation.quotation_number,
      'version_number', v_version.version_number,
      'finalized_at', v_version.finalized_at,
      'client_name', v_version.client_name_snapshot,
      'client_email', v_version.client_email_snapshot,
      'client_phone', v_version.client_phone_snapshot,
      'property_address', v_version.property_address_snapshot,
      'scope_summary', v_version.scope_summary,
      'title', v_version.title,
      'sections', v_sections,
      'payment_schedule', v_payment_schedule,
      'subtotal_paise', v_version.subtotal_paise,
      'discount_type', v_version.discount_type,
      'discount_value_paise', v_version.discount_value_paise,
      'discount_percentage', v_version.discount_percentage,
      'discount_total_paise', v_version.discount_total_paise,
      'taxable_base_paise', v_version.taxable_base_paise,
      'tax_profile_name', coalesce(v_version.tax_profile_snapshot->>'display_name', 'GST'),
      'tax_rate_percentage', v_version.tax_rate_percentage,
      'tax_total_paise', v_version.tax_total_paise,
      'grand_total_paise', v_version.grand_total_paise,
      'inclusions', v_version.inclusions,
      'exclusions', v_version.exclusions,
      'terms_and_conditions', v_version.terms_and_conditions,
      'is_accepted', (v_acceptance.id is not null),
      'accepted_at', v_acceptance.accepted_at
    )
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 13. Private CRM Closed-Won Transition Helper
-- ----------------------------------------------------------------------------
create or replace function private.accepted_quotation_close_won_impl(
  p_lead_id uuid,
  p_accepted_at timestamptz,
  p_actor_id uuid,
  p_quotation_version_id uuid
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_old_status text;
begin
  select status into v_old_status
  from public.leads
  where id = p_lead_id;

  if v_old_status is null then
    raise exception 'LEAD_NOT_FOUND: Lead % does not exist.', p_lead_id;
  end if;

  if v_old_status = 'closed_won' then
    return;
  end if;

  -- Set session bypass flag for lead update trigger
  perform set_config('onedecore.crm_transition', '1', true);

  -- Mutate lead status to closed_won
  update public.leads
  set status = 'closed_won',
      on_hold_reason = null,
      on_hold_since = null,
      on_hold_previous_status = null,
      updated_at = p_accepted_at
  where id = p_lead_id;

  -- Emit lead_events audit
  insert into public.lead_events (
    lead_id,
    event_type,
    actor_id,
    actor_type,
    event_data,
    occurred_at
  ) values (
    p_lead_id,
    'lead.status_changed',
    p_actor_id,
    'system',
    jsonb_build_object(
      'from_status', v_old_status,
      'to_status', 'closed_won',
      'reason', 'commercial_quotation_accepted',
      'quotation_version_id', p_quotation_version_id
    ),
    p_accepted_at
  );

  -- Emit lead_activities audit
  insert into public.lead_activities (
    lead_id,
    activity_type,
    reference_id,
    actor_id,
    summary,
    metadata,
    occurred_at
  ) values (
    p_lead_id,
    'status.changed',
    p_quotation_version_id,
    p_actor_id,
    'Lead transitioned to Closed-Won upon commercial quotation acceptance',
    jsonb_build_object(
      'from_status', v_old_status,
      'to_status', 'closed_won',
      'quotation_version_id', p_quotation_version_id
    ),
    p_accepted_at
  );
end;
$$;

-- Revoke direct execution of private CRM transition helper
revoke all on function private.accepted_quotation_close_won_impl(uuid, timestamptz, uuid, uuid) from public, anon, authenticated;

-- ----------------------------------------------------------------------------
-- 14. Client Acceptance RPC
-- ----------------------------------------------------------------------------
create or replace function public.accept_quotation_by_capability(
  p_capability_token text,
  p_client_name text,
  p_client_email text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_token_hash text;
  v_grant record;
  v_version record;
  v_quotation record;
  v_lead record;
  v_pdf record;
  v_existing_acceptance record;
  v_accepted_at timestamptz := now();
  v_sales_month text;
  v_credited_exec_id uuid;
  v_clean_email text;
  v_acceptance_id uuid;
begin
  if p_capability_token is null or length(trim(p_capability_token)) = 0 then
    raise exception 'INVALID_TOKEN: Capability token is missing.';
  end if;

  if p_client_name is null or length(trim(p_client_name)) < 2 or length(trim(p_client_name)) > 120 then
    raise exception 'INVALID_NAME: Client name must be between 2 and 120 characters.';
  end if;

  if p_client_email is not null and length(trim(p_client_email)) > 0 then
    v_clean_email := lower(trim(p_client_email));
    if v_clean_email !~* '^[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}$' then
      raise exception 'INVALID_EMAIL: Client email format is invalid.';
    end if;
  end if;

  v_token_hash := encode(extensions.digest(convert_to(trim(p_capability_token), 'UTF8'), 'sha256'), 'hex');

  select * into v_grant
  from public.quotation_access_grants
  where capability_token_hash = v_token_hash
    and revoked_at is null
    and (expires_at is null or expires_at > now());

  if v_grant.id is null then
    raise exception 'INVALID_GRANT: Access grant is invalid, expired, or revoked.';
  end if;

  -- Lock version and quotation
  select * into v_version
  from public.quotation_versions
  where id = v_grant.quotation_version_id and status = 'finalized'
  for update;

  if v_version.id is null then
    raise exception 'INVALID_VERSION: Quotation version is not in finalized state.';
  end if;

  select * into v_quotation
  from public.quotations
  where id = v_grant.quotation_id
  for update;

  select * into v_lead
  from public.leads
  where id = v_quotation.lead_id
  for update;

  -- Verify PDF READY
  select * into v_pdf
  from public.quotation_pdf_documents
  where quotation_version_id = v_version.id;

  if v_pdf.id is null or v_pdf.status <> 'ready' then
    raise exception 'PDF_NOT_READY: PDF document artifact is not ready.';
  end if;

  -- Check Sales Exec assignment snapshot
  if v_lead.assigned_to is null then
    raise exception 'UNASSIGNED_LEAD: Assigned Sales Executive required for commercial achievement snapshot.';
  end if;

  v_credited_exec_id := v_lead.assigned_to;

  -- Idempotency / Single Acceptance per lead check
  select * into v_existing_acceptance
  from public.quotation_acceptances
  where lead_id = v_lead.id;

  if v_existing_acceptance.id is not null then
    if v_existing_acceptance.quotation_version_id = v_version.id then
      return jsonb_build_object(
        'success', true,
        'message', 'Quotation already accepted.',
        'idempotent_replay', true,
        'accepted_at', v_existing_acceptance.accepted_at
      );
    else
      raise exception 'QUOTATION_ALREADY_ACCEPTED: Another version of this quotation has already been accepted.';
    end if;
  end if;

  -- Derive Asia/Kolkata sales achievement month
  v_sales_month := to_char(v_accepted_at at time zone 'Asia/Kolkata', 'YYYY-MM');

  -- Insert Client Acceptance Record
  insert into public.quotation_acceptances (
    quotation_id,
    lead_id,
    quotation_version_id,
    access_grant_id,
    accepted_by_name,
    accepted_by_email,
    accepted_at,
    credited_sales_executive_id,
    taxable_base_paise,
    sales_achievement_month
  ) values (
    v_quotation.id,
    v_lead.id,
    v_version.id,
    v_grant.id,
    trim(p_client_name),
    v_clean_email,
    v_accepted_at,
    v_credited_exec_id,
    v_version.taxable_base_paise,
    v_sales_month
  ) returning id into v_acceptance_id;

  -- Transition CRM Lead to Closed-Won atomically
  perform private.accepted_quotation_close_won_impl(v_lead.id, v_accepted_at, v_credited_exec_id, v_version.id);

  -- Append Domain Audit Event
  insert into public.quotation_events (
    quotation_id,
    quotation_version_id,
    lead_id,
    event_type,
    actor_id,
    details
  ) values (
    v_quotation.id,
    v_version.id,
    v_lead.id,
    'quotation.accepted',
    v_credited_exec_id,
    jsonb_build_object(
      'acceptance_id', v_acceptance_id,
      'accepted_by_name', trim(p_client_name),
      'taxable_base_paise', v_version.taxable_base_paise,
      'sales_achievement_month', v_sales_month
    )
  );

  return jsonb_build_object(
    'success', true,
    'message', 'Quotation accepted successfully.',
    'accepted_at', v_accepted_at
  );
end;
$$;

-- ----------------------------------------------------------------------------
-- 15. Pre-Acceptance Revision RPC
-- ----------------------------------------------------------------------------
create or replace function public.create_quotation_revision(
  p_source_version_id uuid,
  p_idempotency_key text default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_user_id uuid := auth.uid();
  v_source record;
  v_quotation record;
  v_lead record;
  v_existing_draft record;
  v_new_version_id uuid;
  v_new_version_number integer;
  v_sec record;
  v_new_sec_id uuid;
  v_request_hash text;
  v_existing_req record;
  v_result jsonb;
begin
  if v_user_id is null then
    raise exception 'UNAUTHENTICATED: Authentication required.';
  end if;

  if not (select public.authorize('quotations.edit')) then
    raise exception 'FORBIDDEN: Permission quotations.edit is required.';
  end if;

  select * into v_source from public.quotation_versions where id = p_source_version_id;
  if v_source.id is null then
    raise exception 'VERSION_NOT_FOUND: Source quotation version % does not exist.', p_source_version_id;
  end if;

  if v_source.status <> 'finalized' then
    raise exception 'INVALID_SOURCE_STATE: Revisions can only be created from finalized quotation versions.';
  end if;

  select * into v_quotation from public.quotations where id = v_source.quotation_id for update;
  select * into v_lead from public.leads where id = v_quotation.lead_id;

  if not (select private.has_role('super_admin'))
     and not (select private.has_role('sales_manager'))
     and not (select private.has_role('management')) then
    if v_lead.assigned_to is null or v_lead.assigned_to <> v_user_id then
      raise exception 'FORBIDDEN: Sales Executive can only create revisions for assigned leads.';
    end if;
  end if;

  -- Block revisions post-acceptance
  if exists (select 1 from public.quotation_acceptances where quotation_id = v_quotation.id) then
    raise exception 'QUOTATION_ACCEPTED_IMMUTABLE: Cannot create revision for an accepted quotation.';
  end if;

  -- Check if a current draft already exists
  select * into v_existing_draft
  from public.quotation_versions
  where quotation_id = v_quotation.id and status = 'draft' and is_current_draft = true;

  if v_existing_draft.id is not null then
    return jsonb_build_object(
      'success', true,
      'message', 'Current draft revision already exists.',
      'version_id', v_existing_draft.id,
      'version_number', v_existing_draft.version_number
    );
  end if;

  -- Idempotency check
  if p_idempotency_key is not null and length(trim(p_idempotency_key)) > 0 then
    perform pg_advisory_xact_lock(hashtext('create_quotation_revision'), hashtext(v_user_id::text || ':' || p_idempotency_key));

    v_request_hash := encode(extensions.digest(convert_to(jsonb_build_object('source_version_id', p_source_version_id)::text, 'UTF8'), 'sha256'), 'hex');

    select * into v_existing_req
    from private.quotation_idempotency_requests
    where actor_id = v_user_id
      and operation_code = 'create_quotation_revision'
      and idempotency_key = p_idempotency_key;

    if v_existing_req.id is not null then
      if v_existing_req.request_hash = v_request_hash then
        return v_existing_req.response_snapshot;
      else
        raise exception 'IDEMPOTENCY_KEY_REUSE_PAYLOAD_MISMATCH: Idempotency key reused with different payload.';
      end if;
    end if;
  end if;

  -- Revoke active capability grants for previous versions
  update public.quotation_access_grants
  set revoked_at = now(),
      revoked_by = v_user_id,
      revocation_reason = 'Automatically revoked upon creation of new draft revision'
  where quotation_id = v_quotation.id and revoked_at is null;

  v_new_version_number := v_source.version_number + 1;

  -- Create New Draft Version
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
    payment_schedule_mode,
    subtotal_paise,
    discount_type,
    discount_value_paise,
    discount_percentage,
    discount_total_paise,
    taxable_base_paise,
    tax_profile_id,
    tax_rate_percentage,
    tax_total_paise,
    grand_total_paise,
    terms_and_conditions,
    inclusions,
    exclusions,
    created_by,
    updated_by
  ) values (
    v_quotation.id,
    v_new_version_number,
    1,
    'draft',
    true,
    v_source.title,
    v_source.client_name_snapshot,
    v_source.client_email_snapshot,
    v_source.client_phone_snapshot,
    v_source.property_address_snapshot,
    v_source.scope_summary,
    v_source.payment_schedule_mode,
    v_source.subtotal_paise,
    v_source.discount_type,
    v_source.discount_value_paise,
    v_source.discount_percentage,
    v_source.discount_total_paise,
    v_source.taxable_base_paise,
    v_source.tax_profile_id,
    v_source.tax_rate_percentage,
    v_source.tax_total_paise,
    v_source.grand_total_paise,
    v_source.terms_and_conditions,
    v_source.inclusions,
    v_source.exclusions,
    v_user_id,
    v_user_id
  ) returning id into v_new_version_id;

  -- Clone Sections & Items
  for v_sec in (select * from public.quotation_sections where quotation_version_id = p_source_version_id order by display_order asc) loop
    insert into public.quotation_sections (
      quotation_version_id,
      section_name,
      display_order,
      subtotal_paise
    ) values (
      v_new_version_id,
      v_sec.section_name,
      v_sec.display_order,
      v_sec.subtotal_paise
    ) returning id into v_new_sec_id;

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
    )
    select
      v_new_sec_id,
      item_name,
      description,
      specifications,
      quantity,
      unit_of_measure,
      unit_rate_paise,
      line_total_paise,
      display_order
    from public.quotation_items
    where section_id = v_sec.id
    order by display_order asc;
  end loop;

  -- Clone Payment Schedule
  insert into public.quotation_payment_schedules (
    quotation_version_id,
    milestone_name,
    milestone_order,
    percentage,
    amount_paise
  )
  select
    v_new_version_id,
    milestone_name,
    milestone_order,
    percentage,
    amount_paise
  from public.quotation_payment_schedules
  where quotation_version_id = p_source_version_id
  order by milestone_order asc;

  -- Recalculate Totals
  perform private.recalculate_quotation_totals(v_new_version_id);

  -- Append Domain Event
  insert into public.quotation_events (
    quotation_id,
    quotation_version_id,
    lead_id,
    event_type,
    actor_id,
    details
  ) values (
    v_quotation.id,
    v_new_version_id,
    v_quotation.lead_id,
    'quotation.revision_created',
    v_user_id,
    jsonb_build_object(
      'source_version_id', p_source_version_id,
      'new_version_number', v_new_version_number
    )
  );

  v_result := jsonb_build_object(
    'success', true,
    'version_id', v_new_version_id,
    'version_number', v_new_version_number,
    'message', 'New draft revision created successfully.'
  );

  if p_idempotency_key is not null and length(trim(p_idempotency_key)) > 0 then
    insert into private.quotation_idempotency_requests (
      actor_id,
      operation_code,
      idempotency_key,
      request_hash,
      quotation_id,
      quotation_version_id,
      response_snapshot
    ) values (
      v_user_id,
      'create_quotation_revision',
      p_idempotency_key,
      v_request_hash,
      v_quotation.id,
      v_new_version_id,
      v_result
    );
  end if;

  return v_result;
end;
$$;

-- ----------------------------------------------------------------------------
-- 16. Revoke Default Public Function Execute Privileges
-- ----------------------------------------------------------------------------
revoke execute on function public.set_quotation_max_discount(numeric) from public, anon;
revoke execute on function public.admin_create_quotation_tax_profile(text, text, numeric) from public, anon;
revoke execute on function public.admin_update_quotation_tax_profile(uuid, text, numeric, boolean) from public, anon;
revoke execute on function public.finalize_quotation_version(uuid, uuid, integer, text) from public, anon;
revoke execute on function public.issue_quotation_access_grant(uuid, text, text) from public, anon;
revoke execute on function public.revoke_quotation_access_grant(uuid, text) from public, anon;
revoke execute on function public.create_quotation_revision(uuid, text) from public, anon;

grant execute on function public.set_quotation_max_discount(numeric) to authenticated;
grant execute on function public.admin_create_quotation_tax_profile(text, text, numeric) to authenticated;
grant execute on function public.admin_update_quotation_tax_profile(uuid, text, numeric, boolean) to authenticated;
grant execute on function public.finalize_quotation_version(uuid, uuid, integer, text) to authenticated;
grant execute on function public.issue_quotation_access_grant(uuid, text, text) to authenticated;
grant execute on function public.revoke_quotation_access_grant(uuid, text) to authenticated;
grant execute on function public.create_quotation_revision(uuid, text) to authenticated;

grant execute on function public.get_quotation_by_capability(text) to anon, authenticated;
grant execute on function public.accept_quotation_by_capability(text, text, text) to anon, authenticated;
