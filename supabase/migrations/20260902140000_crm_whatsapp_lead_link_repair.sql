-- =============================================================================
-- ONEDECORE — WhatsApp <-> CRM Lead-Link Repair
-- Adds the missing deterministic writer for whatsapp_conversations.lead_id.
--
-- Identity lock: a conversation links to a CRM lead only when the link is
-- provable. Exactly one canonical identity match links; zero, ambiguous or
-- non-canonical identities stay NULL; an existing non-null link is never
-- silently overwritten.
--
-- Canonical identity: E.164 mobile number.
--   WhatsApp domain -> public.whatsapp_conversations.customer_e164
--                      (chk_whatsapp_conversations_customer_e164)
--   CRM domain      -> public.contact_channels.address_normalized
--                      where channel_type = 'phone'
--                      (chk_contact_channels_phone_e164)
-- Both sides are already constrained to the same E.164 shape. No second
-- normalizer is introduced: private.crm_normalize_phone_e164 stays the single
-- normalizer and private.resolve_lead_intake_contact_by_phone stays the single
-- phone -> contact identity authority.
--
-- Local/repository only. No managed apply in this repair.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- A. Resolver — the single lead-link matching authority
-- -----------------------------------------------------------------------------

create or replace function private.crm_resolve_whatsapp_lead_link(p_customer_e164 text)
returns table (
  lead_id uuid,
  contact_id uuid,
  resolution_code text,
  candidate_lead_count integer
)
language plpgsql
-- Deliberately not marked STABLE: it delegates to the existing VOLATILE
-- private.resolve_lead_intake_contact_by_phone identity authority.
set search_path = ''
as $fn$
declare
  v_identity text;
  v_contact_id uuid;
  v_count integer;
  v_lead_id uuid;
begin
  -- Canonical identity gate. Non-canonical input never guesses a link.
  v_identity := nullif(trim(coalesce(p_customer_e164, '')), '');
  if v_identity is null or v_identity !~ '^\+[1-9]\d{1,14}$' then
    return query select null::uuid, null::uuid, 'invalid_identity'::text, 0;
    return;
  end if;

  -- Reuse the existing CRM normalizer rather than introducing a second one.
  v_identity := private.crm_normalize_phone_e164(v_identity);

  -- Reuse the existing phone -> contact identity authority. It raises P0001
  -- when one canonical phone resolves to more than one live contact; that is
  -- an ambiguity, and ambiguity keeps the conversation unlinked.
  begin
    v_contact_id := private.resolve_lead_intake_contact_by_phone(v_identity);
  exception
    when sqlstate 'P0001' then
      return query select null::uuid, null::uuid, 'ambiguous_contact'::text, 0;
      return;
  end;

  if v_contact_id is null then
    return query select null::uuid, null::uuid, 'no_identity_match'::text, 0;
    return;
  end if;

  select count(*)::integer
  into v_count
  from public.leads l
  where l.contact_id = v_contact_id;

  if v_count = 0 then
    return query select null::uuid, v_contact_id, 'no_lead_for_contact'::text, 0;
    return;
  end if;

  -- More than one lead may legally share one contact in ONEDECORE CRM
  -- (see private.crm_evaluate_manual_lead_duplicate). Never guess between
  -- them: no recency, no assignment, no status, no "most likely".
  if v_count > 1 then
    return query select null::uuid, v_contact_id, 'ambiguous_lead'::text, v_count;
    return;
  end if;

  select l.id
  into v_lead_id
  from public.leads l
  where l.contact_id = v_contact_id;

  return query select v_lead_id, v_contact_id, 'linked'::text, 1;
end;
$fn$;

comment on function private.crm_resolve_whatsapp_lead_link(text) is
  'Deterministic WhatsApp customer E.164 -> CRM lead resolver. Exactly one canonical match links; zero/ambiguous/non-canonical resolve to NULL. No fuzzy, last-10-digit, name, email, recency, assignment or status matching.';

-- -----------------------------------------------------------------------------
-- B. Applier — the single lead-link writer
-- -----------------------------------------------------------------------------

create or replace function private.crm_apply_whatsapp_conversation_lead_link(
  p_conversation_id uuid
)
returns text
language plpgsql
set search_path = ''
as $fn$
declare
  v_conv public.whatsapp_conversations%rowtype;
  v_resolved_lead uuid;
  v_code text;
begin
  if p_conversation_id is null then
    return 'invalid_conversation';
  end if;

  select * into v_conv
  from public.whatsapp_conversations
  where id = p_conversation_id
  for update;

  if not found then
    return 'invalid_conversation';
  end if;

  select r.lead_id, r.resolution_code
  into v_resolved_lead, v_code
  from private.crm_resolve_whatsapp_lead_link(v_conv.customer_e164) r;

  -- An existing link is authoritative and is never silently overwritten.
  if v_conv.lead_id is not null then
    if v_code = 'linked' and v_resolved_lead = v_conv.lead_id then
      return 'existing_link_confirmed';
    end if;
    if v_code = 'linked' then
      -- Fail closed: report the conflict, change nothing.
      return 'existing_link_conflict';
    end if;
    return 'existing_link_preserved';
  end if;

  if v_code <> 'linked' then
    return v_code;
  end if;

  update public.whatsapp_conversations
  set lead_id = v_resolved_lead,
      updated_at = now()
  where id = p_conversation_id
    and lead_id is null;

  if not found then
    -- A concurrent writer linked first; that link stands.
    return 'existing_link_preserved';
  end if;

  return 'linked';
end;
$fn$;

comment on function private.crm_apply_whatsapp_conversation_lead_link(uuid) is
  'Single writer for whatsapp_conversations.lead_id. Idempotent, never overwrites an existing link, and never raises so inbound ingest cannot drop messages on ambiguity. Returns the resolution code as the manual-resolution hook.';

-- -----------------------------------------------------------------------------
-- C. Ownership and grants — no widened privileges
-- -----------------------------------------------------------------------------

alter function private.crm_resolve_whatsapp_lead_link(text) owner to postgres;
alter function private.crm_apply_whatsapp_conversation_lead_link(uuid) owner to postgres;

revoke all on function private.crm_resolve_whatsapp_lead_link(text)
  from public, anon, authenticated;
revoke all on function private.crm_apply_whatsapp_conversation_lead_link(uuid)
  from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- D. Inbound integration — Meta webhook ingest
--    Body reproduced from 20260804150000 with one added call after the
--    conversation upsert. Ambiguity never aborts message persistence.
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
as $fn$
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

  -- Deterministic CRM lead link. Never raises, so an unresolved or ambiguous
  -- identity can never drop an inbound message.
  perform private.crm_apply_whatsapp_conversation_lead_link(v_conversation_id);

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
$fn$;

alter function public.ingest_meta_whatsapp_message(
  text, text, text, text, text, text, text, text, text, text, text, text, text, jsonb, text, timestamptz
) owner to postgres;

revoke all on function public.ingest_meta_whatsapp_message(
  text, text, text, text, text, text, text, text, text, text, text, text, text, jsonb, text, timestamptz
) from public, anon, authenticated;

grant execute on function public.ingest_meta_whatsapp_message(
  text, text, text, text, text, text, text, text, text, text, text, text, text, jsonb, text, timestamptz
) to service_role;

comment on function public.ingest_meta_whatsapp_message(
  text, text, text, text, text, text, text, text, text, text, text, text, text, jsonb, text, timestamptz
) is
  'Inbound Meta WhatsApp message ingest. Idempotent per provider_message_id. Applies the deterministic CRM lead link through the single writer; never fabricates contacts, leads or consent.';

-- -----------------------------------------------------------------------------
-- E. Outbound integration — governed send-intent authority
--    Body reproduced from 20260813140000 with one added call, placed after the
--    pre-existing conversation-scope authorization check so that linking can
--    never grant access that the caller did not already hold.
-- -----------------------------------------------------------------------------

create or replace function private.create_whatsapp_service_send_intent_impl_v2(
  p_conversation_id uuid,
  p_idempotency_key text,
  p_purpose_code text,
  p_body_text text,
  p_reply_to_message_id uuid default null,
  p_secure_content_kind text default null,
  p_secure_content_ref uuid default null
)
returns public.whatsapp_send_intents
language plpgsql
security definer
set search_path = ''
as $fn$
declare
  v_actor uuid;
  v_normalized_body text;
  v_request_hash text;
  v_existing public.whatsapp_send_intents%rowtype;
  v_eligibility_code text;
  v_eligibility_snapshot jsonb;
  v_dispatch_mode text;
  v_intent public.whatsapp_send_intents%rowtype;
  v_conv public.whatsapp_conversations%rowtype;
  v_pre_consent_count integer;
  v_pre_message_count integer;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if p_purpose_code is distinct from 'WHATSAPP_SERVICE' then
    raise exception 'denied_purpose: only WHATSAPP_SERVICE is allowed' using errcode = '22023';
  end if;

  if p_idempotency_key is null or length(p_idempotency_key) < 1 or length(p_idempotency_key) > 128 then
    raise exception 'validation: idempotency_key' using errcode = '22023';
  end if;

  if (p_secure_content_kind is null) <> (p_secure_content_ref is null) then
    raise exception 'validation: secure_content pair' using errcode = '22023';
  end if;

  if p_secure_content_kind is not null and p_secure_content_kind is distinct from 'quotation_link' then
    raise exception 'validation: secure_content_kind' using errcode = '22023';
  end if;

  if p_secure_content_kind is not null
     and current_setting('onedecore.quotation_secure_send', true) is distinct from '1' then
    raise exception 'SECURE_CONTENT_FORBIDDEN: quotation secure send must use the quotation wrapper.'
      using errcode = '42501';
  end if;

  if p_reply_to_message_id is not null then
    if not exists (
      select 1
      from public.whatsapp_messages m
      where m.id = p_reply_to_message_id
        and m.conversation_id = p_conversation_id
    ) then
      raise exception 'validation: reply_to_message_id' using errcode = '22023';
    end if;
  end if;

  v_normalized_body := private.whatsapp_normalize_send_body(p_body_text);

  if p_secure_content_kind is null then
    v_request_hash := private.whatsapp_compute_send_request_hash(
      p_conversation_id,
      p_purpose_code,
      v_normalized_body,
      p_reply_to_message_id
    );
  else
    v_request_hash := encode(
      extensions.digest(
        convert_to(
          jsonb_build_object(
            'conversation_id', p_conversation_id::text,
            'purpose_code', p_purpose_code,
            'body_text', v_normalized_body,
            'reply_to_message_id', coalesce(p_reply_to_message_id::text, ''),
            'secure_content_kind', p_secure_content_kind,
            'secure_content_ref', p_secure_content_ref::text
          )::text,
          'UTF8'
        ),
        'sha256'
      ),
      'hex'
    );
  end if;

  perform pg_advisory_xact_lock(
    hashtextextended('whatsapp:send-intent:' || v_actor::text || ':' || p_idempotency_key, 0)
  );

  select * into v_existing
  from public.whatsapp_send_intents
  where requested_by = v_actor
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_hash is distinct from v_request_hash then
      raise exception 'idempotency_conflict: same idempotency key with different request'
        using errcode = '23505';
    end if;

    insert into public.whatsapp_send_intent_events (
      send_intent_id, event_type, actor_id, details
    )
    values (
      v_existing.id,
      'idempotency_reused',
      v_actor,
      jsonb_build_object('idempotency_key', p_idempotency_key)
    );

    return v_existing;
  end if;

  select * into v_conv
  from public.whatsapp_conversations
  where id = p_conversation_id
  for update;

  if not found then
    raise exception 'denied_invalid_conversation' using errcode = '22023';
  end if;

  if v_conv.lead_id is not null then
    perform 1
    from public.leads
    where id = v_conv.lead_id
    for update;

    if not found then
      raise exception 'denied_invalid_conversation' using errcode = '22023';
    end if;
  end if;

  if not (select private.whatsapp_inbox_can_use_conversation(p_conversation_id)) then
    raise exception 'denied_conversation_scope' using errcode = '42501';
  end if;

  -- Deterministic CRM lead link through the single writer, applied only after
  -- the caller has passed the pre-existing conversation-scope check so that
  -- linking can never widen who reached this point. Never raises.
  perform private.crm_apply_whatsapp_conversation_lead_link(p_conversation_id);

  if v_conv.lead_id is null then
    select * into v_conv
    from public.whatsapp_conversations
    where id = p_conversation_id
    for update;

    if v_conv.lead_id is not null then
      perform 1
      from public.leads
      where id = v_conv.lead_id
      for update;
    end if;
  end if;

  select eligibility_code, eligibility_snapshot, dispatch_mode
    into v_eligibility_code, v_eligibility_snapshot, v_dispatch_mode
  from private.whatsapp_evaluate_service_send_eligibility(p_conversation_id);

  if v_eligibility_code <> 'eligible' then
    raise exception '%', v_eligibility_code using errcode = '22023';
  end if;

  select count(*)::integer into v_pre_consent_count from public.consent_events;
  select count(*)::integer into v_pre_message_count
  from public.whatsapp_messages
  where direction = 'outbound';

  insert into public.whatsapp_send_intents (
    conversation_id,
    requested_by,
    purpose_code,
    idempotency_key,
    request_hash,
    body_text,
    reply_to_message_id,
    dispatch_mode,
    eligibility_code,
    eligibility_snapshot,
    lifecycle_status,
    secure_content_kind,
    secure_content_ref
  )
  values (
    p_conversation_id,
    v_actor,
    p_purpose_code,
    p_idempotency_key,
    v_request_hash,
    v_normalized_body,
    p_reply_to_message_id,
    v_dispatch_mode,
    v_eligibility_code,
    v_eligibility_snapshot,
    'eligible',
    p_secure_content_kind,
    p_secure_content_ref
  )
  returning * into v_intent;

  insert into public.whatsapp_send_intent_events (
    send_intent_id, event_type, actor_id, details
  )
  values
    (
      v_intent.id,
      'created',
      v_actor,
      jsonb_build_object(
        'conversation_id', p_conversation_id,
        'purpose_code', p_purpose_code,
        'idempotency_key', p_idempotency_key
      )
    ),
    (
      v_intent.id,
      'eligibility_recorded',
      v_actor,
      jsonb_build_object(
        'eligibility_code', v_eligibility_code,
        'dispatch_mode', v_dispatch_mode
      )
    );

  if (select count(*)::integer from public.consent_events) <> v_pre_consent_count then
    raise exception 'consent_mutation_forbidden' using errcode = '55000';
  end if;

  if (
    select count(*)::integer
    from public.whatsapp_messages
    where direction = 'outbound'
  ) <> v_pre_message_count then
    raise exception 'provider_message_fabrication_forbidden' using errcode = '55000';
  end if;

  return v_intent;
end;
$fn$;

alter function private.create_whatsapp_service_send_intent_impl_v2(
  uuid, text, text, text, uuid, text, uuid
) owner to postgres;

revoke all on function private.create_whatsapp_service_send_intent_impl_v2(
  uuid, text, text, text, uuid, text, uuid
) from public, anon;

grant execute on function private.create_whatsapp_service_send_intent_impl_v2(
  uuid, text, text, text, uuid, text, uuid
) to authenticated;

comment on function private.create_whatsapp_service_send_intent_impl_v2(
  uuid, text, text, text, uuid, text, uuid
) is
  'Governed WHATSAPP_SERVICE send-intent authority. Resolves the deterministic CRM lead link through the single writer after the conversation-scope check; consent, template and session-window governance are unchanged.';

-- -----------------------------------------------------------------------------
-- F. Historical backfill
--    Runs the SAME single writer over existing rows. It therefore inherits the
--    identity lock exactly: only lead_id IS NULL rows are considered, only an
--    exact single-candidate match is written, ambiguous and unmatched rows stay
--    NULL, and no existing link can be overwritten. Idempotent.
-- -----------------------------------------------------------------------------

do $backfill$
declare
  v_row record;
begin
  for v_row in
    select id
    from public.whatsapp_conversations
    where lead_id is null
    order by created_at
  loop
    perform private.crm_apply_whatsapp_conversation_lead_link(v_row.id);
  end loop;
end;
$backfill$;
