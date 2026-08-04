-- =============================================================================
-- ONEDECORE Phase 6A — Meta WhatsApp Data & Webhook Foundation (M18)
-- Local/repository only in Phase 6A. No managed apply. No outbound. No consent mutation.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A. Core tables
-- -----------------------------------------------------------------------------

create table public.whatsapp_business_accounts (
  id uuid primary key default gen_random_uuid(),
  provider text not null default 'meta',
  waba_id text not null,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_whatsapp_business_accounts_provider check (provider = 'meta'),
  constraint chk_whatsapp_business_accounts_waba_id check (
    length(waba_id) between 1 and 64 and waba_id ~ '^[0-9]+$'
  ),
  constraint chk_whatsapp_business_accounts_status check (
    status in ('active', 'inactive', 'archived')
  )
);

create unique index uq_whatsapp_business_accounts_waba_id
  on public.whatsapp_business_accounts (waba_id);

comment on table public.whatsapp_business_accounts is
  'Meta WhatsApp Business Account registry. Phase 6A upserts from verified webhooks only.';

create table public.whatsapp_phone_numbers (
  id uuid primary key default gen_random_uuid(),
  business_account_id uuid not null references public.whatsapp_business_accounts (id) on delete restrict,
  phone_number_id text not null,
  display_phone_number text,
  status text not null default 'active',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_whatsapp_phone_numbers_phone_number_id check (
    length(phone_number_id) between 1 and 64 and phone_number_id ~ '^[0-9]+$'
  ),
  constraint chk_whatsapp_phone_numbers_display_phone check (
    display_phone_number is null or length(display_phone_number) between 1 and 32
  ),
  constraint chk_whatsapp_phone_numbers_status check (
    status in ('active', 'inactive', 'archived')
  )
);

create unique index uq_whatsapp_phone_numbers_phone_number_id
  on public.whatsapp_phone_numbers (phone_number_id);

comment on table public.whatsapp_phone_numbers is
  'Meta phone number IDs bound to a WABA. Phase 6A metadata only.';

create table public.whatsapp_conversations (
  id uuid primary key default gen_random_uuid(),
  phone_number_id uuid not null references public.whatsapp_phone_numbers (id) on delete restrict,
  customer_e164 text not null,
  contact_id uuid references public.contacts (id) on delete set null,
  lead_id uuid references public.leads (id) on delete set null,
  display_name_snapshot text,
  last_message_at timestamptz,
  last_inbound_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_whatsapp_conversations_customer_e164 check (
    customer_e164 ~ '^\+[1-9]\d{1,14}$'
  ),
  constraint chk_whatsapp_conversations_display_name check (
    display_name_snapshot is null or length(display_name_snapshot) between 1 and 120
  )
);

create unique index uq_whatsapp_conversations_phone_customer
  on public.whatsapp_conversations (phone_number_id, customer_e164);

create index idx_whatsapp_conversations_last_message_at
  on public.whatsapp_conversations (last_message_at desc nulls last);

comment on table public.whatsapp_conversations is
  'Customer conversation thread per business phone + customer E.164. Phase 6A does not auto-link CRM contacts/leads.';

create table public.whatsapp_messages (
  id uuid primary key default gen_random_uuid(),
  conversation_id uuid not null references public.whatsapp_conversations (id) on delete restrict,
  provider_message_id text not null,
  direction text not null,
  provider_message_type text not null,
  normalized_message_type text not null,
  sender_e164 text not null,
  recipient_e164 text not null,
  body_text text,
  content jsonb not null default '{}'::jsonb,
  context_provider_message_id text,
  provider_timestamp timestamptz not null,
  latest_status text,
  created_at timestamptz not null default now(),

  constraint chk_whatsapp_messages_provider_message_id check (
    length(provider_message_id) between 1 and 128
  ),
  constraint chk_whatsapp_messages_direction check (
    direction in ('inbound', 'outbound')
  ),
  constraint chk_whatsapp_messages_provider_message_type check (
    length(provider_message_type) between 1 and 64
  ),
  constraint chk_whatsapp_messages_normalized_message_type check (
    normalized_message_type in (
      'text', 'image', 'audio', 'video', 'document', 'sticker',
      'location', 'contacts', 'interactive', 'button', 'reaction', 'unknown'
    )
  ),
  constraint chk_whatsapp_messages_sender_e164 check (
    sender_e164 ~ '^\+[1-9]\d{1,14}$'
  ),
  constraint chk_whatsapp_messages_recipient_e164 check (
    recipient_e164 ~ '^\+[1-9]\d{1,14}$'
  ),
  constraint chk_whatsapp_messages_body_text check (
    body_text is null or length(body_text) <= 4096
  ),
  constraint chk_whatsapp_messages_content_size check (
    pg_column_size(content) <= 8192
  ),
  constraint chk_whatsapp_messages_context_provider_message_id check (
    context_provider_message_id is null or length(context_provider_message_id) between 1 and 128
  ),
  constraint chk_whatsapp_messages_latest_status check (
    latest_status is null or length(latest_status) between 1 and 32
  )
);

create unique index uq_whatsapp_messages_provider_message_id
  on public.whatsapp_messages (provider_message_id);

create index idx_whatsapp_messages_conversation_timestamp
  on public.whatsapp_messages (conversation_id, provider_timestamp desc);

comment on table public.whatsapp_messages is
  'Normalized WhatsApp messages. Phase 6A ingests inbound only via trusted RPC.';

create table public.whatsapp_message_status_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  event_hash text not null,
  envelope_hash text not null,
  provider_message_id text not null,
  message_id uuid references public.whatsapp_messages (id) on delete set null,
  status text not null,
  provider_timestamp timestamptz not null,
  details jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now(),

  constraint chk_whatsapp_message_status_events_event_key check (
    length(event_key) between 1 and 256
  ),
  constraint chk_whatsapp_message_status_events_event_hash check (
    event_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint chk_whatsapp_message_status_events_envelope_hash check (
    envelope_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint chk_whatsapp_message_status_events_provider_message_id check (
    length(provider_message_id) between 1 and 128
  ),
  constraint chk_whatsapp_message_status_events_status check (
    length(status) between 1 and 32
  ),
  constraint chk_whatsapp_message_status_events_details_size check (
    pg_column_size(details) <= 4096
  )
);

create unique index uq_whatsapp_message_status_events_event_key
  on public.whatsapp_message_status_events (event_key);

create index idx_whatsapp_message_status_events_provider_message_timestamp
  on public.whatsapp_message_status_events (provider_message_id, provider_timestamp desc);

comment on table public.whatsapp_message_status_events is
  'Append-only delivery/read status events from Meta webhooks.';

create table public.whatsapp_webhook_events (
  id uuid primary key default gen_random_uuid(),
  event_key text not null,
  event_hash text not null,
  envelope_hash text not null,
  event_kind text not null,
  waba_id text not null,
  phone_number_id text not null,
  provider_message_id text,
  outcome_code text not null,
  provider_timestamp timestamptz,
  received_at timestamptz not null default now(),
  created_at timestamptz not null default now(),

  constraint chk_whatsapp_webhook_events_event_key check (
    length(event_key) between 1 and 256
  ),
  constraint chk_whatsapp_webhook_events_event_hash check (
    event_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint chk_whatsapp_webhook_events_envelope_hash check (
    envelope_hash ~ '^[a-f0-9]{64}$'
  ),
  constraint chk_whatsapp_webhook_events_event_kind check (
    event_kind in ('inbound_message', 'message_status', 'unsupported')
  ),
  constraint chk_whatsapp_webhook_events_waba_id check (
    length(waba_id) between 1 and 64
  ),
  constraint chk_whatsapp_webhook_events_phone_number_id check (
    length(phone_number_id) between 1 and 64
  ),
  constraint chk_whatsapp_webhook_events_provider_message_id check (
    provider_message_id is null or length(provider_message_id) between 1 and 128
  ),
  constraint chk_whatsapp_webhook_events_outcome_code check (
    outcome_code in ('persisted', 'duplicate', 'ignored')
  )
);

create unique index uq_whatsapp_webhook_events_event_key
  on public.whatsapp_webhook_events (event_key);

comment on table public.whatsapp_webhook_events is
  'Append-only webhook processing ledger. Stores hashes only — never raw payload.';

create table public.whatsapp_templates (
  id uuid primary key default gen_random_uuid(),
  business_account_id uuid not null references public.whatsapp_business_accounts (id) on delete restrict,
  provider_template_id text,
  name text not null,
  language text not null,
  category text not null,
  status text not null default 'unknown',
  components jsonb not null default '[]'::jsonb,
  provider_updated_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint chk_whatsapp_templates_provider_template_id check (
    provider_template_id is null or length(provider_template_id) between 1 and 128
  ),
  constraint chk_whatsapp_templates_name check (length(name) between 1 and 128),
  constraint chk_whatsapp_templates_language check (length(language) between 2 and 16),
  constraint chk_whatsapp_templates_category check (length(category) between 1 and 32),
  constraint chk_whatsapp_templates_status check (length(status) between 1 and 32),
  constraint chk_whatsapp_templates_components_size check (
    pg_column_size(components) <= 16384
  )
);

create unique index uq_whatsapp_templates_business_name_language
  on public.whatsapp_templates (business_account_id, name, language);

comment on table public.whatsapp_templates is
  'Template metadata foundation. Phase 6A schema only — no sync or send.';

-- -----------------------------------------------------------------------------
-- B. Append-only protection
-- -----------------------------------------------------------------------------

create trigger trg_whatsapp_webhook_events_no_update
  before update on public.whatsapp_webhook_events
  for each row execute function private.forbid_append_only_mutation();

create trigger trg_whatsapp_webhook_events_no_delete
  before delete on public.whatsapp_webhook_events
  for each row execute function private.forbid_append_only_mutation();

create trigger trg_whatsapp_message_status_events_no_update
  before update on public.whatsapp_message_status_events
  for each row execute function private.forbid_append_only_mutation();

create trigger trg_whatsapp_message_status_events_no_delete
  before delete on public.whatsapp_message_status_events
  for each row execute function private.forbid_append_only_mutation();

-- -----------------------------------------------------------------------------
-- C. Private helpers
-- -----------------------------------------------------------------------------

create or replace function private.whatsapp_assert_hash(p_value text, p_label text)
returns void
language plpgsql
set search_path = ''
as $$
begin
  if p_value is null or p_value !~ '^[a-f0-9]{64}$' then
    raise exception 'validation: %', p_label using errcode = '22023';
  end if;
end;
$$;

alter function private.whatsapp_assert_hash(text, text) owner to postgres;
revoke all on function private.whatsapp_assert_hash(text, text) from public, anon, authenticated;

create or replace function private.whatsapp_check_webhook_replay(
  p_event_key text,
  p_event_hash text
)
returns text
language plpgsql
set search_path = ''
as $$
declare
  v_existing_hash text;
begin
  select event_hash into v_existing_hash
  from public.whatsapp_webhook_events
  where event_key = p_event_key;

  if not found then
    return 'new';
  end if;

  if v_existing_hash = p_event_hash then
    return 'duplicate';
  end if;

  raise exception 'webhook:conflict event_key replay with different hash'
    using errcode = '23505';
end;
$$;

alter function private.whatsapp_check_webhook_replay(text, text) owner to postgres;
revoke all on function private.whatsapp_check_webhook_replay(text, text) from public, anon, authenticated;

create or replace function private.whatsapp_upsert_waba_phone(
  p_waba_id text,
  p_phone_number_id text,
  p_display_phone_number text default null
)
returns table (
  business_account_uuid uuid,
  phone_number_uuid uuid
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_business_account_id uuid;
  v_phone_number_id uuid;
  v_existing_waba_id text;
begin
  select b.waba_id
  into v_existing_waba_id
  from public.whatsapp_phone_numbers p
  inner join public.whatsapp_business_accounts b on b.id = p.business_account_id
  where p.phone_number_id = p_phone_number_id;

  if found and v_existing_waba_id <> p_waba_id then
    raise exception 'webhook:conflict phone_number_id bound to different waba'
      using errcode = '23505';
  end if;

  insert into public.whatsapp_business_accounts (provider, waba_id, status)
  values ('meta', p_waba_id, 'active')
  on conflict (waba_id) do update
    set updated_at = now(),
        status = case
          when public.whatsapp_business_accounts.status = 'archived'
            then public.whatsapp_business_accounts.status
          else 'active'
        end
  returning id into v_business_account_id;

  insert into public.whatsapp_phone_numbers (
    business_account_id,
    phone_number_id,
    display_phone_number,
    status
  )
  values (
    v_business_account_id,
    p_phone_number_id,
    p_display_phone_number,
    'active'
  )
  on conflict (phone_number_id) do update
    set updated_at = now(),
        display_phone_number = coalesce(
          excluded.display_phone_number,
          public.whatsapp_phone_numbers.display_phone_number
        ),
        status = case
          when public.whatsapp_phone_numbers.status = 'archived'
            then public.whatsapp_phone_numbers.status
          else 'active'
        end
  where public.whatsapp_phone_numbers.business_account_id = v_business_account_id
  returning id into v_phone_number_id;

  if v_phone_number_id is null then
    select p.id
    into v_phone_number_id
    from public.whatsapp_phone_numbers p
    where p.phone_number_id = p_phone_number_id
      and p.business_account_id = v_business_account_id;
  end if;

  if v_phone_number_id is null then
    raise exception 'webhook:conflict phone_number_id bound to different waba'
      using errcode = '23505';
  end if;

  return query select v_business_account_id, v_phone_number_id;
end;
$$;

alter function private.whatsapp_upsert_waba_phone(text, text, text) owner to postgres;
revoke all on function private.whatsapp_upsert_waba_phone(text, text, text) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- D. Message ingest RPC
-- -----------------------------------------------------------------------------

create or replace function public.ingest_meta_whatsapp_message(
  p_event_key text,
  p_event_hash text,
  p_envelope_hash text,
  p_waba_id text,
  p_phone_number_id text,
  p_display_phone_number text,
  p_provider_message_id text,
  p_customer_e164 text,
  p_recipient_e164 text,
  p_display_name_snapshot text,
  p_provider_message_type text,
  p_normalized_message_type text,
  p_body_text text,
  p_content jsonb,
  p_context_provider_message_id text,
  p_provider_timestamp timestamptz
)
returns table (
  outcome_code text,
  webhook_event_id uuid,
  message_id uuid,
  conversation_id uuid,
  duplicate boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replay text;
  v_phone_number_uuid uuid;
  v_conversation_id uuid;
  v_message_id uuid;
  v_webhook_event_id uuid;
  v_existing_message public.whatsapp_messages%rowtype;
begin
  perform private.whatsapp_assert_hash(p_event_hash, 'event_hash');
  perform private.whatsapp_assert_hash(p_envelope_hash, 'envelope_hash');

  if p_event_key is null or length(p_event_key) < 1 or length(p_event_key) > 256 then
    raise exception 'validation: event_key' using errcode = '22023';
  end if;
  if p_waba_id is null or p_waba_id !~ '^[0-9]+$' then
    raise exception 'validation: waba_id' using errcode = '22023';
  end if;
  if p_phone_number_id is null or p_phone_number_id !~ '^[0-9]+$' then
    raise exception 'validation: phone_number_id' using errcode = '22023';
  end if;
  if p_provider_message_id is null or length(p_provider_message_id) < 1 then
    raise exception 'validation: provider_message_id' using errcode = '22023';
  end if;
  if p_customer_e164 is null or p_customer_e164 !~ '^\+[1-9]\d{1,14}$' then
    raise exception 'validation: customer_e164' using errcode = '22023';
  end if;
  if p_recipient_e164 is null or p_recipient_e164 !~ '^\+[1-9]\d{1,14}$' then
    raise exception 'validation: recipient_e164' using errcode = '22023';
  end if;
  if p_provider_timestamp is null then
    raise exception 'validation: provider_timestamp' using errcode = '22023';
  end if;
  if p_content is null or jsonb_typeof(p_content) <> 'object' or pg_column_size(p_content) > 8192 then
    raise exception 'validation: content' using errcode = '22023';
  end if;
  if p_body_text is not null and length(p_body_text) > 4096 then
    raise exception 'validation: body_text' using errcode = '22023';
  end if;
  if p_display_name_snapshot is not null and length(p_display_name_snapshot) > 120 then
    raise exception 'validation: display_name_snapshot' using errcode = '22023';
  end if;

  v_replay := private.whatsapp_check_webhook_replay(p_event_key, p_event_hash);
  if v_replay = 'duplicate' then
  select id into v_webhook_event_id
    from public.whatsapp_webhook_events
    where event_key = p_event_key;

    select * into v_existing_message
    from public.whatsapp_messages
    where provider_message_id = p_provider_message_id;

    return query
      select
        'duplicate'::text,
        v_webhook_event_id,
        v_existing_message.id,
        v_existing_message.conversation_id,
        true;
    return;
  end if;

  select * into v_existing_message
  from public.whatsapp_messages
  where provider_message_id = p_provider_message_id;

  if found then
    if v_existing_message.direction = 'inbound'
      and v_existing_message.sender_e164 = p_customer_e164
      and v_existing_message.provider_message_type = p_provider_message_type
      and coalesce(v_existing_message.body_text, '') = coalesce(p_body_text, '')
      and v_existing_message.content = p_content
    then
      insert into public.whatsapp_webhook_events (
        event_key, event_hash, envelope_hash, event_kind,
        waba_id, phone_number_id, provider_message_id,
        outcome_code, provider_timestamp
      )
      values (
        p_event_key, p_event_hash, p_envelope_hash, 'inbound_message',
        p_waba_id, p_phone_number_id, p_provider_message_id,
        'duplicate', p_provider_timestamp
      )
      returning id into v_webhook_event_id;

      return query
        select
          'duplicate'::text,
          v_webhook_event_id,
          v_existing_message.id,
          v_existing_message.conversation_id,
          true;
      return;
    end if;

    raise exception 'webhook:conflict provider_message_id replay with different content'
      using errcode = '23505';
  end if;

  select phone_number_uuid
  into v_phone_number_uuid
  from private.whatsapp_upsert_waba_phone(
    p_waba_id,
    p_phone_number_id,
    p_display_phone_number
  );

  insert into public.whatsapp_conversations (
    phone_number_id,
    customer_e164,
    display_name_snapshot,
    last_message_at,
    last_inbound_at
  )
  values (
    v_phone_number_uuid,
    p_customer_e164,
    p_display_name_snapshot,
    p_provider_timestamp,
    p_provider_timestamp
  )
  on conflict (phone_number_id, customer_e164) do update
    set updated_at = now(),
        display_name_snapshot = coalesce(
          excluded.display_name_snapshot,
          public.whatsapp_conversations.display_name_snapshot
        ),
        last_message_at = greatest(
          coalesce(public.whatsapp_conversations.last_message_at, excluded.last_message_at),
          excluded.last_message_at
        ),
        last_inbound_at = greatest(
          coalesce(public.whatsapp_conversations.last_inbound_at, excluded.last_inbound_at),
          excluded.last_inbound_at
        )
  returning id into v_conversation_id;

  insert into public.whatsapp_messages (
    conversation_id,
    provider_message_id,
    direction,
    provider_message_type,
    normalized_message_type,
    sender_e164,
    recipient_e164,
    body_text,
    content,
    context_provider_message_id,
    provider_timestamp,
    latest_status
  )
  values (
    v_conversation_id,
    p_provider_message_id,
    'inbound',
    p_provider_message_type,
    p_normalized_message_type,
    p_customer_e164,
    p_recipient_e164,
    p_body_text,
    p_content,
    p_context_provider_message_id,
    p_provider_timestamp,
    'received'
  )
  returning id into v_message_id;

  insert into public.whatsapp_webhook_events (
    event_key, event_hash, envelope_hash, event_kind,
    waba_id, phone_number_id, provider_message_id,
    outcome_code, provider_timestamp
  )
  values (
    p_event_key, p_event_hash, p_envelope_hash, 'inbound_message',
    p_waba_id, p_phone_number_id, p_provider_message_id,
    'persisted', p_provider_timestamp
  )
  returning id into v_webhook_event_id;

  return query
    select
      'persisted'::text,
      v_webhook_event_id,
      v_message_id,
      v_conversation_id,
      false;
end;
$$;

alter function public.ingest_meta_whatsapp_message(
  text, text, text, text, text, text, text, text, text, text, text, text, text, jsonb, text, timestamptz
) owner to postgres;

revoke all on function public.ingest_meta_whatsapp_message(
  text, text, text, text, text, text, text, text, text, text, text, text, text, jsonb, text, timestamptz
) from public, anon, authenticated;

grant execute on function public.ingest_meta_whatsapp_message(
  text, text, text, text, text, text, text, text, text, text, text, text, text, jsonb, text, timestamptz
) to service_role;

-- -----------------------------------------------------------------------------
-- E. Status ingest RPC
-- -----------------------------------------------------------------------------

create or replace function public.ingest_meta_whatsapp_status(
  p_event_key text,
  p_event_hash text,
  p_envelope_hash text,
  p_waba_id text,
  p_phone_number_id text,
  p_display_phone_number text,
  p_provider_message_id text,
  p_status text,
  p_provider_timestamp timestamptz,
  p_details jsonb
)
returns table (
  outcome_code text,
  webhook_event_id uuid,
  status_event_id uuid,
  message_id uuid,
  duplicate boolean
)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_replay text;
  v_message_id uuid;
  v_status_event_id uuid;
  v_webhook_event_id uuid;
  v_existing_status public.whatsapp_message_status_events%rowtype;
begin
  perform private.whatsapp_assert_hash(p_event_hash, 'event_hash');
  perform private.whatsapp_assert_hash(p_envelope_hash, 'envelope_hash');

  if p_event_key is null or length(p_event_key) < 1 or length(p_event_key) > 256 then
    raise exception 'validation: event_key' using errcode = '22023';
  end if;
  if p_waba_id is null or p_waba_id !~ '^[0-9]+$' then
    raise exception 'validation: waba_id' using errcode = '22023';
  end if;
  if p_phone_number_id is null or p_phone_number_id !~ '^[0-9]+$' then
    raise exception 'validation: phone_number_id' using errcode = '22023';
  end if;
  if p_provider_message_id is null or length(p_provider_message_id) < 1 then
    raise exception 'validation: provider_message_id' using errcode = '22023';
  end if;
  if p_status is null or length(p_status) < 1 or length(p_status) > 32 then
    raise exception 'validation: status' using errcode = '22023';
  end if;
  if p_provider_timestamp is null then
    raise exception 'validation: provider_timestamp' using errcode = '22023';
  end if;
  if p_details is null or jsonb_typeof(p_details) <> 'object' or pg_column_size(p_details) > 4096 then
    raise exception 'validation: details' using errcode = '22023';
  end if;

  v_replay := private.whatsapp_check_webhook_replay(p_event_key, p_event_hash);
  if v_replay = 'duplicate' then
    select id into v_webhook_event_id
    from public.whatsapp_webhook_events
    where event_key = p_event_key;

    select * into v_existing_status
    from public.whatsapp_message_status_events
    where event_key = p_event_key;

    select id into v_message_id
    from public.whatsapp_messages
    where provider_message_id = p_provider_message_id;

    return query
      select
        'duplicate'::text,
        v_webhook_event_id,
        v_existing_status.id,
        v_message_id,
        true;
    return;
  end if;

  perform 1
  from private.whatsapp_upsert_waba_phone(
    p_waba_id,
    p_phone_number_id,
    p_display_phone_number
  );

  select id into v_message_id
  from public.whatsapp_messages
  where provider_message_id = p_provider_message_id;

  insert into public.whatsapp_message_status_events (
    event_key,
    event_hash,
    envelope_hash,
    provider_message_id,
    message_id,
    status,
    provider_timestamp,
    details
  )
  values (
    p_event_key,
    p_event_hash,
    p_envelope_hash,
    p_provider_message_id,
    v_message_id,
    p_status,
    p_provider_timestamp,
    p_details
  )
  returning id into v_status_event_id;

  if v_message_id is not null then
    update public.whatsapp_messages
    set latest_status = p_status
    where id = v_message_id;
  end if;

  insert into public.whatsapp_webhook_events (
    event_key, event_hash, envelope_hash, event_kind,
    waba_id, phone_number_id, provider_message_id,
    outcome_code, provider_timestamp
  )
  values (
    p_event_key, p_event_hash, p_envelope_hash, 'message_status',
    p_waba_id, p_phone_number_id, p_provider_message_id,
    'persisted', p_provider_timestamp
  )
  returning id into v_webhook_event_id;

  return query
    select
      'persisted'::text,
      v_webhook_event_id,
      v_status_event_id,
      v_message_id,
      false;
end;
$$;

alter function public.ingest_meta_whatsapp_status(
  text, text, text, text, text, text, text, text, timestamptz, jsonb
) owner to postgres;

revoke all on function public.ingest_meta_whatsapp_status(
  text, text, text, text, text, text, text, text, timestamptz, jsonb
) from public, anon, authenticated;

grant execute on function public.ingest_meta_whatsapp_status(
  text, text, text, text, text, text, text, text, timestamptz, jsonb
) to service_role;

-- -----------------------------------------------------------------------------
-- F. RLS / grants
-- -----------------------------------------------------------------------------

alter table public.whatsapp_business_accounts enable row level security;
alter table public.whatsapp_phone_numbers enable row level security;
alter table public.whatsapp_conversations enable row level security;
alter table public.whatsapp_messages enable row level security;
alter table public.whatsapp_message_status_events enable row level security;
alter table public.whatsapp_webhook_events enable row level security;
alter table public.whatsapp_templates enable row level security;

revoke all on table public.whatsapp_business_accounts from public, anon, authenticated;
revoke all on table public.whatsapp_phone_numbers from public, anon, authenticated;
revoke all on table public.whatsapp_conversations from public, anon, authenticated;
revoke all on table public.whatsapp_messages from public, anon, authenticated;
revoke all on table public.whatsapp_message_status_events from public, anon, authenticated;
revoke all on table public.whatsapp_webhook_events from public, anon, authenticated;
revoke all on table public.whatsapp_templates from public, anon, authenticated;
