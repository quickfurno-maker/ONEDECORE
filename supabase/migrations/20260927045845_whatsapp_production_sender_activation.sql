-- =============================================================================
-- ONEDECORE WhatsApp production sender activation
-- One explicit production sender, legacy/test senders retained for audit but
-- archived from new outbound selection after cutover.
-- =============================================================================

begin;

alter table public.whatsapp_phone_numbers
  add column if not exists production_sender_at timestamptz;

comment on column public.whatsapp_phone_numbers.production_sender_at is
  'Non-null only for the single Meta phone number allowed to originate new ONEDECORE outbound traffic.';

create unique index if not exists uq_whatsapp_phone_numbers_single_production_sender
  on public.whatsapp_phone_numbers ((true))
  where production_sender_at is not null;

create or replace function private.whatsapp_production_phone_status_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Before the first cutover, keep the existing/test sender usable. After a
  -- production marker exists, only that verified sender may remain active;
  -- webhook discovery can retain other Meta identities only as archived evidence.
  if new.status = 'active'
     and new.production_sender_at is null
     and exists (
       select 1
       from public.whatsapp_phone_numbers p
       where p.production_sender_at is not null
         and p.id <> new.id
     ) then
    new.status := 'archived';
  end if;
  return new;
end;
$$;

revoke all on function private.whatsapp_production_phone_status_guard()
  from public, anon, authenticated;

drop trigger if exists trg_whatsapp_production_phone_status_guard
  on public.whatsapp_phone_numbers;
create trigger trg_whatsapp_production_phone_status_guard
before insert or update of status on public.whatsapp_phone_numbers
for each row execute function private.whatsapp_production_phone_status_guard();

create or replace function private.whatsapp_production_account_status_guard()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.status = 'active'
     and exists (
       select 1
       from public.whatsapp_phone_numbers p
       where p.production_sender_at is not null
     )
     and not exists (
       select 1
       from public.whatsapp_phone_numbers p
       where p.business_account_id = new.id
         and p.production_sender_at is not null
     ) then
    new.status := 'archived';
  end if;
  return new;
end;
$$;

revoke all on function private.whatsapp_production_account_status_guard()
  from public, anon, authenticated;

drop trigger if exists trg_whatsapp_production_account_status_guard
  on public.whatsapp_business_accounts;
create trigger trg_whatsapp_production_account_status_guard
before insert or update of status on public.whatsapp_business_accounts
for each row execute function private.whatsapp_production_account_status_guard();

-- Installing the migration does NOT retire the current test/legacy sender.
-- The existing sender remains usable until configure_whatsapp_production_sender
-- performs the explicit verified cutover. This preserves rollback/testing during
-- Meta setup and prevents a schema deployment from becoming an accidental number
-- migration. Once a production_sender_at marker exists, the guards above keep
-- every other identity archived.

create or replace function public.configure_whatsapp_production_sender(
  p_waba_id text,
  p_phone_number_id text,
  p_display_phone_number text
)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_account_id uuid;
  v_phone_id uuid;
  v_sender_e164 text;
  v_configured_at timestamptz := clock_timestamp();
begin
  perform private.whatsapp_campaign_require_service_role();

  if p_waba_id is null or p_waba_id !~ '^[0-9]{1,64}$' then
    raise exception 'WHATSAPP_PRODUCTION_WABA_INVALID' using errcode = '22023';
  end if;

  if p_phone_number_id is null or p_phone_number_id !~ '^[0-9]{1,64}$' then
    raise exception 'WHATSAPP_PRODUCTION_PHONE_ID_INVALID' using errcode = '22023';
  end if;

  v_sender_e164 := private.whatsapp_business_sender_e164(p_display_phone_number);
  if v_sender_e164 is null then
    raise exception 'WHATSAPP_PRODUCTION_DISPLAY_PHONE_INVALID' using errcode = '22023';
  end if;

  -- Clear the previous marker inside this transaction first, so switching
  -- production senders cannot violate the single-sender unique index.
  update public.whatsapp_phone_numbers
  set production_sender_at = null,
      updated_at = now()
  where production_sender_at is not null;

  insert into public.whatsapp_business_accounts(provider, waba_id, status)
  values ('meta', p_waba_id, 'active')
  on conflict (waba_id) do update
    set status = 'active',
        updated_at = now()
  returning id into v_account_id;

  insert into public.whatsapp_phone_numbers(
    business_account_id,
    phone_number_id,
    display_phone_number,
    status,
    production_sender_at
  )
  values (
    v_account_id,
    p_phone_number_id,
    v_sender_e164,
    'active',
    v_configured_at
  )
  on conflict (phone_number_id) do update
    set business_account_id = excluded.business_account_id,
        display_phone_number = excluded.display_phone_number,
        status = 'active',
        production_sender_at = v_configured_at,
        updated_at = now()
  returning id into v_phone_id;

  -- Preserve historical rows and their foreign-key evidence, but remove every
  -- legacy/test sender from all future "status = active" sender selection.
  update public.whatsapp_phone_numbers
  set status = 'archived',
      production_sender_at = null,
      updated_at = now()
  where id <> v_phone_id
    and (status = 'active' or production_sender_at is not null);

  update public.whatsapp_business_accounts
  set status = 'archived',
      updated_at = now()
  where id <> v_account_id
    and status = 'active';

  update public.whatsapp_business_accounts
  set status = 'active',
      updated_at = now()
  where id = v_account_id;

  update public.whatsapp_phone_numbers
  set status = 'active',
      display_phone_number = v_sender_e164,
      production_sender_at = v_configured_at,
      updated_at = now()
  where id = v_phone_id;

  return jsonb_build_object(
    'configured', true,
    'business_account_id', v_account_id,
    'phone_id', v_phone_id,
    'waba_id', p_waba_id,
    'phone_number_id', p_phone_number_id,
    'display_phone_number', v_sender_e164,
    'configured_at', v_configured_at
  );
end;
$$;

revoke all on function public.configure_whatsapp_production_sender(text,text,text)
  from public, anon, authenticated;
grant execute on function public.configure_whatsapp_production_sender(text,text,text)
  to service_role;

create or replace function public.get_whatsapp_production_sender_status()
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_phone public.whatsapp_phone_numbers%rowtype;
  v_account public.whatsapp_business_accounts%rowtype;
  v_active_phone_count integer;
  v_active_account_count integer;
begin
  if auth.uid() is null or not private.has_permission('whatsapp.settings.read') then
    raise exception 'WHATSAPP_SETTINGS_READ_DENIED' using errcode = '42501';
  end if;

  select count(*) into v_active_phone_count
  from public.whatsapp_phone_numbers
  where status = 'active';

  select count(*) into v_active_account_count
  from public.whatsapp_business_accounts
  where status = 'active';

  select *
    into v_phone
  from public.whatsapp_phone_numbers
  where production_sender_at is not null
  order by production_sender_at desc, id
  limit 1;

  if not found then
    return jsonb_build_object(
      'configured', false,
      'active_phone_count', v_active_phone_count,
      'active_account_count', v_active_account_count
    );
  end if;

  select *
    into v_account
  from public.whatsapp_business_accounts
  where id = v_phone.business_account_id;

  return jsonb_build_object(
    'configured', true,
    'phone_number_id_last6', right(v_phone.phone_number_id, 6),
    'waba_id_last6', right(v_account.waba_id, 6),
    'display_phone_number', v_phone.display_phone_number,
    'phone_status', v_phone.status,
    'account_status', v_account.status,
    'configured_at', v_phone.production_sender_at,
    'active_phone_count', v_active_phone_count,
    'active_account_count', v_active_account_count
  );
end;
$$;

revoke all on function public.get_whatsapp_production_sender_status()
  from public, anon;
grant execute on function public.get_whatsapp_production_sender_status()
  to authenticated;

comment on function public.configure_whatsapp_production_sender(text,text,text) is
  'Service-only atomic cutover to the one Meta WABA/phone allowed for new ONEDECORE outbound traffic. Historical/test registry rows are archived, never deleted.';
comment on function public.get_whatsapp_production_sender_status() is
  'Permission-gated non-secret production WhatsApp sender readiness for Settings & Compliance.';

commit;
