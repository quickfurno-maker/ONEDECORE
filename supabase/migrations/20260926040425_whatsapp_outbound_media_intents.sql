-- P2 — governed outbound WhatsApp media intents.
-- Extends the existing WHATSAPP_SERVICE send-intent ledger; no provider gate is enabled.

insert into storage.buckets (
  id, name, public, file_size_limit, allowed_mime_types
)
values (
  'whatsapp-outbound-media',
  'whatsapp-outbound-media',
  false,
  16777216,
  array[
    'image/jpeg',
    'image/png',
    'image/webp',
    'application/pdf',
    'video/mp4'
  ]
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

alter table public.whatsapp_send_intents
  add column message_kind text not null default 'text',
  add column media_object_path text,
  add column media_file_name text,
  add column media_mime_type text,
  add column media_size_bytes bigint,
  add column media_sha256 text;

alter table public.whatsapp_send_intents
  drop constraint chk_whatsapp_send_intents_body_text,
  drop constraint chk_whatsapp_send_intents_dispatch_mode;

alter table public.whatsapp_send_intents
  add constraint chk_whatsapp_send_intents_message_kind
    check (message_kind in ('text', 'image', 'document', 'video')),
  add constraint chk_whatsapp_send_intents_body_by_kind
    check (
      (
        message_kind = 'text'
        and length(body_text) between 1 and 4096
      )
      or (
        message_kind in ('image', 'document', 'video')
        and length(body_text) between 0 and 1024
      )
    ),
  add constraint chk_whatsapp_send_intents_dispatch_mode
    check (
      dispatch_mode in (
        'service_window_text',
        'service_window_media',
        'template_required'
      )
    ),
  add constraint chk_whatsapp_send_intents_media_payload
    check (
      (
        message_kind = 'text'
        and media_object_path is null
        and media_file_name is null
        and media_mime_type is null
        and media_size_bytes is null
        and media_sha256 is null
      )
      or (
        message_kind in ('image', 'document', 'video')
        and media_object_path is not null
        and length(trim(media_object_path)) between 1 and 500
        and position('..' in media_object_path) = 0
        and media_file_name is not null
        and length(trim(media_file_name)) between 1 and 240
        and position('/' in media_file_name) = 0
        and position(chr(92) in media_file_name) = 0
        and media_mime_type is not null
        and media_size_bytes is not null
        and media_size_bytes > 0
        and media_sha256 ~ '^[0-9a-f]{64}$'
        and (
          (
            message_kind = 'image'
            and media_mime_type in ('image/jpeg', 'image/png', 'image/webp')
            and media_size_bytes <= 5242880
          )
          or (
            message_kind = 'document'
            and media_mime_type = 'application/pdf'
            and media_size_bytes <= 16777216
          )
          or (
            message_kind = 'video'
            and media_mime_type = 'video/mp4'
            and media_size_bytes <= 16777216
          )
        )
      )
    );

create unique index idx_whatsapp_send_intents_media_object_unique
  on public.whatsapp_send_intents (media_object_path)
  where media_object_path is not null;

comment on column public.whatsapp_send_intents.message_kind is
  'Transport kind for the durable service-send intent: text, image, document, or video.';
comment on column public.whatsapp_send_intents.body_text is
  'Text body for text intents; optional caption (possibly empty) for media intents.';
comment on column public.whatsapp_send_intents.media_object_path is
  'Private whatsapp-outbound-media object path. Never exposed as a public URL.';
create or replace function private.whatsapp_outbound_media_object_exists(
  p_conversation_id uuid,
  p_object_path text
)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from storage.objects o
    where p_conversation_id is not null
      and p_object_path is not null
      and o.bucket_id = 'whatsapp-outbound-media'
      and o.name = trim(p_object_path)
      and position('..' in trim(p_object_path)) = 0
      and trim(p_object_path)
        like ('conversations/' || p_conversation_id::text || '/outbound/%')
  );
$$;

create or replace function private.whatsapp_compute_media_send_request_hash(
  p_conversation_id uuid,
  p_purpose_code text,
  p_message_kind text,
  p_caption text,
  p_reply_to_message_id uuid,
  p_media_object_path text,
  p_media_file_name text,
  p_media_mime_type text,
  p_media_size_bytes bigint,
  p_media_sha256 text
)
returns text
language sql
immutable
set search_path = ''
as $$
  select encode(
    extensions.digest(
      convert_to(
        jsonb_build_object(
          'conversation_id', p_conversation_id::text,
          'purpose_code', p_purpose_code,
          'message_kind', p_message_kind,
          'caption', p_caption,
          'reply_to_message_id', coalesce(p_reply_to_message_id::text, ''),
          'media_object_path', p_media_object_path,
          'media_file_name', p_media_file_name,
          'media_mime_type', p_media_mime_type,
          'media_size_bytes', p_media_size_bytes,
          'media_sha256', p_media_sha256
        )::text,
        'UTF8'
      ),
      'sha256'
    ),
    'hex'
  );
$$;

create or replace function private.create_whatsapp_service_media_send_intent_impl(
  p_conversation_id uuid,
  p_idempotency_key text,
  p_purpose_code text,
  p_message_kind text,
  p_caption text,
  p_reply_to_message_id uuid,
  p_media_object_path text,
  p_media_file_name text,
  p_media_mime_type text,
  p_media_size_bytes bigint,
  p_media_sha256 text
)
returns public.whatsapp_send_intents
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_caption text;
  v_file_name text;
  v_object_path text;
  v_mime text;
  v_sha text;
  v_request_hash text;
  v_existing public.whatsapp_send_intents%rowtype;
  v_eligibility_code text;
  v_eligibility_snapshot jsonb;
  v_evaluated_dispatch_mode text;
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
    raise exception 'denied_purpose: only WHATSAPP_SERVICE is allowed'
      using errcode = '22023';
  end if;

  if p_idempotency_key is null
     or length(p_idempotency_key) < 1
     or length(p_idempotency_key) > 128 then
    raise exception 'validation: idempotency_key' using errcode = '22023';
  end if;

  if p_message_kind not in ('image', 'document', 'video') then
    raise exception 'validation: message_kind' using errcode = '22023';
  end if;

  v_caption := btrim(coalesce(p_caption, ''));
  if length(v_caption) > 1024 then
    raise exception 'validation: caption' using errcode = '22023';
  end if;

  v_file_name := btrim(coalesce(p_media_file_name, ''));
  if length(v_file_name) < 1
     or length(v_file_name) > 240
     or position('..' in v_file_name) > 0
     or position('/' in v_file_name) > 0
     or position(chr(92) in v_file_name) > 0 then
    raise exception 'validation: media_file_name' using errcode = '22023';
  end if;

  v_object_path := btrim(coalesce(p_media_object_path, ''));
  if length(v_object_path) < 1
     or length(v_object_path) > 500
     or position('..' in v_object_path) > 0
     or v_object_path not like (
       'conversations/' || p_conversation_id::text || '/outbound/%'
     ) then
    raise exception 'validation: media_object_path' using errcode = '22023';
  end if;

  v_mime := lower(btrim(coalesce(p_media_mime_type, '')));
  v_sha := lower(btrim(coalesce(p_media_sha256, '')));

  if v_sha !~ '^[0-9a-f]{64}$' then
    raise exception 'validation: media_sha256' using errcode = '22023';
  end if;

  if p_media_size_bytes is null or p_media_size_bytes <= 0 then
    raise exception 'validation: media_size_bytes' using errcode = '22023';
  end if;

  if (
    p_message_kind = 'image'
    and (
      v_mime not in ('image/jpeg', 'image/png', 'image/webp')
      or p_media_size_bytes > 5242880
    )
  ) or (
    p_message_kind = 'document'
    and (
      v_mime <> 'application/pdf'
      or p_media_size_bytes > 16777216
    )
  ) or (
    p_message_kind = 'video'
    and (
      v_mime <> 'video/mp4'
      or p_media_size_bytes > 16777216
    )
  ) then
    raise exception 'validation: media_type_or_size' using errcode = '22023';
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
  if not private.whatsapp_outbound_media_object_exists(
    p_conversation_id,
    v_object_path
  ) then
    raise exception 'validation: media_object_missing' using errcode = '22023';
  end if;

  v_request_hash := private.whatsapp_compute_media_send_request_hash(
    p_conversation_id,
    p_purpose_code,
    p_message_kind,
    v_caption,
    p_reply_to_message_id,
    v_object_path,
    v_file_name,
    v_mime,
    p_media_size_bytes,
    v_sha
  );

  perform pg_advisory_xact_lock(
    hashtextextended(
      'whatsapp:send-intent:' || v_actor::text || ':' || p_idempotency_key,
      0
    )
  );

  select * into v_existing
  from public.whatsapp_send_intents
  where requested_by = v_actor
    and idempotency_key = p_idempotency_key;

  if found then
    if v_existing.request_hash is distinct from v_request_hash then
      raise exception
        'idempotency_conflict: same idempotency key with different request'
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

  if not (
    select private.whatsapp_inbox_can_use_conversation(p_conversation_id)
  ) then
    raise exception 'denied_conversation_scope' using errcode = '42501';
  end if;

  select eligibility_code, eligibility_snapshot, dispatch_mode
    into
      v_eligibility_code,
      v_eligibility_snapshot,
      v_evaluated_dispatch_mode
  from private.whatsapp_evaluate_service_send_eligibility(p_conversation_id);

  if v_eligibility_code <> 'eligible' then
    raise exception '%', v_eligibility_code using errcode = '22023';
  end if;

  if v_evaluated_dispatch_mode <> 'service_window_text' then
    raise exception 'denied_template_required' using errcode = '22023';
  end if;

  select count(*)::integer
    into v_pre_consent_count
  from public.consent_events;

  select count(*)::integer
    into v_pre_message_count
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
    message_kind,
    media_object_path,
    media_file_name,
    media_mime_type,
    media_size_bytes,
    media_sha256
  )
  values (
    p_conversation_id,
    v_actor,
    p_purpose_code,
    p_idempotency_key,
    v_request_hash,
    v_caption,
    p_reply_to_message_id,
    'service_window_media',
    v_eligibility_code,
    v_eligibility_snapshot,
    'eligible',
    p_message_kind,
    v_object_path,
    v_file_name,
    v_mime,
    p_media_size_bytes,
    v_sha
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
        'idempotency_key', p_idempotency_key,
        'message_kind', p_message_kind,
        'media_file_name', v_file_name,
        'media_mime_type', v_mime,
        'media_size_bytes', p_media_size_bytes,
        'media_sha256', v_sha
      )
    ),
    (
      v_intent.id,
      'eligibility_recorded',
      v_actor,
      jsonb_build_object(
        'eligibility_code', v_eligibility_code,
        'dispatch_mode', 'service_window_media'
      )
    );
  if (
    select count(*)::integer
    from public.consent_events
  ) <> v_pre_consent_count then
    raise exception 'consent_mutation_forbidden' using errcode = '55000';
  end if;

  if (
    select count(*)::integer
    from public.whatsapp_messages
    where direction = 'outbound'
  ) <> v_pre_message_count then
    raise exception 'provider_message_fabrication_forbidden'
      using errcode = '55000';
  end if;

  return v_intent;
end;
$$;

create or replace function public.create_whatsapp_service_media_send_intent(
  p_conversation_id uuid,
  p_idempotency_key text,
  p_purpose_code text,
  p_message_kind text,
  p_caption text,
  p_reply_to_message_id uuid,
  p_media_object_path text,
  p_media_file_name text,
  p_media_mime_type text,
  p_media_size_bytes bigint,
  p_media_sha256 text
)
returns public.whatsapp_send_intents
language sql
security invoker
set search_path = ''
as $$
  select *
  from private.create_whatsapp_service_media_send_intent_impl(
    p_conversation_id,
    p_idempotency_key,
    p_purpose_code,
    p_message_kind,
    p_caption,
    p_reply_to_message_id,
    p_media_object_path,
    p_media_file_name,
    p_media_mime_type,
    p_media_size_bytes,
    p_media_sha256
  );
$$;

alter function private.whatsapp_outbound_media_object_exists(uuid, text)
  owner to postgres;
alter function private.whatsapp_compute_media_send_request_hash(
  uuid, text, text, text, uuid, text, text, text, bigint, text
) owner to postgres;
alter function private.create_whatsapp_service_media_send_intent_impl(
  uuid, text, text, text, text, uuid, text, text, text, bigint, text
) owner to postgres;
alter function public.create_whatsapp_service_media_send_intent(
  uuid, text, text, text, text, uuid, text, text, text, bigint, text
) owner to postgres;

revoke all on function private.whatsapp_outbound_media_object_exists(uuid, text)
  from public, anon, authenticated;
revoke all on function private.whatsapp_compute_media_send_request_hash(
  uuid, text, text, text, uuid, text, text, text, bigint, text
) from public, anon, authenticated;
revoke all on function private.create_whatsapp_service_media_send_intent_impl(
  uuid, text, text, text, text, uuid, text, text, text, bigint, text
) from public, anon;
grant execute on function private.create_whatsapp_service_media_send_intent_impl(
  uuid, text, text, text, text, uuid, text, text, text, bigint, text
) to authenticated;

revoke all on function public.create_whatsapp_service_media_send_intent(
  uuid, text, text, text, text, uuid, text, text, text, bigint, text
) from public, anon;
grant execute on function public.create_whatsapp_service_media_send_intent(
  uuid, text, text, text, text, uuid, text, text, text, bigint, text
) to authenticated;

comment on function public.create_whatsapp_service_media_send_intent(
  uuid, text, text, text, text, uuid, text, text, text, bigint, text
) is
  'Creates a durable WHATSAPP_SERVICE media send intent from a private verified object. No provider call occurs in this transaction.';


create or replace function public.get_whatsapp_media_dispatch_payload(
  p_send_intent_id uuid
)
returns table (
  message_kind text,
  media_object_path text,
  media_file_name text,
  media_mime_type text,
  media_size_bytes bigint,
  media_sha256 text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    si.message_kind,
    si.media_object_path,
    si.media_file_name,
    si.media_mime_type,
    si.media_size_bytes,
    si.media_sha256
  from public.whatsapp_send_intents si
  where si.id = p_send_intent_id;
$$;

alter function public.get_whatsapp_media_dispatch_payload(uuid)
  owner to postgres;
revoke all on function public.get_whatsapp_media_dispatch_payload(uuid)
  from public, anon, authenticated;
grant execute on function public.get_whatsapp_media_dispatch_payload(uuid)
  to service_role;

comment on function public.get_whatsapp_media_dispatch_payload(uuid) is
  'Service-role-only dispatch metadata for a claimed WhatsApp media intent. Private object paths never reach authenticated clients.';


-- Media-aware binding supersedes the reply-only binder from the immediately
-- preceding P2 migration. It preserves reply context while recording the
-- actual outbound message type without exposing private storage coordinates.
create or replace function public.bind_whatsapp_send_intent_dispatch(
  p_dispatch_attempt_id uuid,
  p_provider_message_id text,
  p_provider_timestamp timestamptz default now()
)
returns table (
  outcome_code text,
  send_intent_id uuid,
  outbound_message_id uuid,
  provider_message_id text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_attempt public.whatsapp_provider_dispatch_attempts%rowtype;
  v_intent public.whatsapp_send_intents%rowtype;
  v_message_id uuid;
  v_conv public.whatsapp_conversations%rowtype;
  v_sender_e164 text;
  v_reply_provider_message_id text;
  v_content jsonb;
begin
  if p_provider_message_id is null
    or length(p_provider_message_id) < 1
    or length(p_provider_message_id) > 128 then
    raise exception 'validation: provider_message_id' using errcode = '22023';
  end if;

  select * into v_attempt
  from public.whatsapp_provider_dispatch_attempts
  where id = p_dispatch_attempt_id
  for update;

  if not found then
    return query select 'not_found'::text, null::uuid, null::uuid, null::text;
    return;
  end if;

  if v_attempt.status = 'succeeded' then
    select * into v_intent
    from public.whatsapp_send_intents
    where id = v_attempt.send_intent_id;

    return query
      select
        'already_bound'::text,
        v_intent.id,
        v_intent.outbound_message_id,
        v_attempt.provider_message_id;
    return;
  end if;

  if v_attempt.status not in ('requested', 'ambiguous') then
    raise exception 'dispatch_attempt_not_bindable: %', v_attempt.status
      using errcode = '22023';
  end if;

  select * into v_intent
  from public.whatsapp_send_intents
  where id = v_attempt.send_intent_id
  for update;

  if not found then
    return query select 'not_found'::text, null::uuid, null::uuid, null::text;
    return;
  end if;

  if v_intent.lifecycle_status = 'dispatch_bound' then
    return query
      select
        'already_bound'::text,
        v_intent.id,
        v_intent.outbound_message_id,
        p_provider_message_id;
    return;
  end if;

  if exists (
    select 1
    from public.whatsapp_messages m
    where m.provider_message_id = p_provider_message_id
  ) then
    raise exception 'provider_message_id_conflict' using errcode = '23505';
  end if;

  select * into v_conv
  from public.whatsapp_conversations
  where id = v_intent.conversation_id;

  if not found then
    raise exception 'dispatch_conversation_missing' using errcode = '22023';
  end if;

  select coalesce(pn.display_phone_number, pn.phone_number_id)
    into v_sender_e164
  from public.whatsapp_phone_numbers pn
  where pn.id = v_conv.phone_number_id;

  if v_intent.reply_to_message_id is not null then
    select m.provider_message_id
      into v_reply_provider_message_id
    from public.whatsapp_messages m
    where m.id = v_intent.reply_to_message_id
      and m.conversation_id = v_intent.conversation_id;

    if v_reply_provider_message_id is null then
      raise exception 'reply_target_missing_at_bind' using errcode = '22023';
    end if;
  end if;

  if v_intent.message_kind = 'text' then
    v_content := '{}'::jsonb;
  else
    v_content := jsonb_strip_nulls(
      jsonb_build_object(
        'mime_type', v_intent.media_mime_type,
        'filename', v_intent.media_file_name,
        'caption', nullif(v_intent.body_text, '')
      )
    );
  end if;

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
    v_intent.conversation_id,
    p_provider_message_id,
    'outbound',
    v_intent.message_kind,
    v_intent.message_kind,
    v_sender_e164,
    v_conv.customer_e164,
    case
      when v_intent.message_kind = 'text' then v_intent.body_text
      else null
    end,
    v_content,
    v_reply_provider_message_id,
    coalesce(p_provider_timestamp, now()),
    null
  )
  returning id into v_message_id;

  update public.whatsapp_provider_dispatch_attempts
  set
    status = 'succeeded',
    provider_message_id = p_provider_message_id,
    completed_at = now(),
    response_snapshot = coalesce(response_snapshot, '{}'::jsonb)
      || jsonb_build_object(
        'provider_message_id', p_provider_message_id,
        'reply_to_provider_message_id', v_reply_provider_message_id,
        'message_kind', v_intent.message_kind
      )
  where id = v_attempt.id;

  update public.whatsapp_send_intents
  set
    lifecycle_status = 'dispatch_bound',
    outbound_message_id = v_message_id
  where id = v_intent.id;

  insert into public.whatsapp_send_intent_events (
    send_intent_id, event_type, actor_id, details
  )
  values
    (
      v_intent.id,
      'dispatch_succeeded',
      v_intent.requested_by,
      jsonb_build_object(
        'dispatch_attempt_id', v_attempt.id,
        'provider_message_id', p_provider_message_id,
        'reply_to_provider_message_id', v_reply_provider_message_id,
        'message_kind', v_intent.message_kind
      )
    ),
    (
      v_intent.id,
      'dispatch_bound',
      v_intent.requested_by,
      jsonb_build_object(
        'dispatch_attempt_id', v_attempt.id,
        'outbound_message_id', v_message_id,
        'provider_message_id', p_provider_message_id,
        'reply_to_provider_message_id', v_reply_provider_message_id,
        'message_kind', v_intent.message_kind
      )
    );

  update public.whatsapp_conversations
  set
    last_message_at = greatest(
      coalesce(last_message_at, '-infinity'::timestamptz),
      coalesce(p_provider_timestamp, now())
    ),
    updated_at = now()
  where id = v_intent.conversation_id;

  return query
    select
      'bound'::text,
      v_intent.id,
      v_message_id,
      p_provider_message_id;
end;
$$;

alter function public.bind_whatsapp_send_intent_dispatch(uuid, text, timestamptz)
  owner to postgres;
revoke all on function public.bind_whatsapp_send_intent_dispatch(uuid, text, timestamptz)
  from public, anon, authenticated;
grant execute on function public.bind_whatsapp_send_intent_dispatch(uuid, text, timestamptz)
  to service_role;

comment on function public.bind_whatsapp_send_intent_dispatch(uuid, text, timestamptz) is
  'Binds text or media provider evidence, preserving reply context while keeping private outbound media object paths out of whatsapp_messages.';
