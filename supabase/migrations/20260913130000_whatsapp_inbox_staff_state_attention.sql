-- =============================================================================
-- ONEDECORE WM-1 (ADR-0034) — CRM-owned WhatsApp inbox completeness
--
-- Repository only. No managed apply. No Meta call, no template, no marketing,
-- no media. The WHATSAPP_SERVICE send path is untouched.
--
-- ONE MIGRATION, FOUR PIECES, ONE STORY
--
--   1. The tombstoned-lead READ gap is closed.
--      `20260906180000_crm_super_admin_lead_tombstone.sql` hardened the two
--      USE/SEND predicates and left `whatsapp_inbox_can_view_conversation`
--      alone. A former assignee of a deleted enquiry could still SELECT the
--      conversation and every message in it, because the view predicate read
--      `leads.assigned_to` without asking whether the lead still exists as an
--      operational record. The predicate is redefined here; the SELECT policies
--      on conversations, messages and send intents all call it, so all of them
--      inherit the repair without being touched.
--
--   2. Per-staff read state: `public.whatsapp_conversation_staff_state`.
--      ONEDECORE's own "this member of staff opened this thread" marker. It is
--      NOT Meta's read receipt, never sent to Meta, never mixed with
--      `whatsapp_messages.latest_status`.
--
--   3. `public.mark_whatsapp_conversation_read` — the one writer of that state.
--
--   4. `public.list_whatsapp_inbox_conversations` — the attention read model.
--      Scope, search, link filter, attention derivation, attention filter and
--      paging all happen here, before a row leaves the database.
--
-- OWNERSHIP IS NOT RE-DECIDED
--
-- `public.leads.assigned_to` stays the only conversation owner. Nothing below
-- copies it, caches it, or adds a WhatsApp-side owner. Reassigning the lead
-- moves the conversation because every predicate reads the lead live.
-- =============================================================================

/* ========================================================================== */
/* 1. The view predicate — tombstone-aware                                    */
/* ========================================================================== */

/*
 * Three shapes, decided in this order of meaning (not evaluation):
 *
 *   UNLINKED     c.lead_id IS NULL
 *                -> manage scope only (unknown / ambiguous identity triage).
 *
 *   LIVE         c.lead_id IS NOT NULL, lead resolves, deleted_at IS NULL
 *                -> manage scope, OR the lead's CURRENT assignee.
 *
 *   TOMBSTONED   c.lead_id IS NOT NULL, lead resolves, deleted_at IS NOT NULL
 *                -> manage scope only, as HISTORICAL READ. The former
 *                   assignee does not pass through `assigned_to`: a deleted
 *                   enquiry is nobody's pipeline, and the salesperson who once
 *                   held it must not be able to tell it ever existed.
 *
 * A non-null lead_id whose lead cannot be resolved matches no branch and fails
 * closed for everyone. It is NOT treated as unlinked: a dangling link is a data
 * fault, and quietly widening it into the triage queue would be the wrong
 * audience seeing it for the wrong reason.
 *
 * READ IS NOT USE. `whatsapp_inbox_can_use_conversation` and
 * `whatsapp_inbox_actor_can_use_conversation` are deliberately NOT redefined:
 * they keep refusing a tombstoned conversation to every actor, manage scope
 * included. Manage scope may read the history; nobody may send into it. A
 * future governed restore clears `deleted_at`, and ordinary assignment access
 * resumes through the LIVE branch with nothing else to change.
 */
create or replace function private.whatsapp_inbox_can_view_conversation(p_conversation_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.whatsapp_conversations c
    left join public.leads l on l.id = c.lead_id
    where c.id = p_conversation_id
      and (select public.authorize('whatsapp.inbox.read'))
      and (
        -- UNLINKED: triage belongs to manage scope.
        (
          c.lead_id is null
          and (select private.whatsapp_inbox_has_manage_scope())
        )
        -- LIVE: manage scope, or the lead's current assignee.
        or (
          c.lead_id is not null
          and l.id is not null
          and l.deleted_at is null
          and (
            (select private.whatsapp_inbox_has_manage_scope())
            or (
              l.assigned_to is not null
              and l.assigned_to = (select auth.uid())
            )
          )
        )
        -- TOMBSTONED: manage scope historical read only. No assignee branch.
        or (
          c.lead_id is not null
          and l.id is not null
          and l.deleted_at is not null
          and (select private.whatsapp_inbox_has_manage_scope())
        )
      )
  );
$$;

comment on function private.whatsapp_inbox_can_view_conversation(uuid) is
  'WM-1: READ scope for a WhatsApp conversation. Unlinked -> manage scope triage only. Live linked lead -> manage scope or the CURRENT leads.assigned_to. Tombstoned linked lead (deleted_at not null) -> manage scope historical read only; the former assignee is refused with no existence signal. Unresolvable lead link fails closed. Use/send is a separate predicate that refuses tombstoned conversations to everyone.';

comment on function private.whatsapp_inbox_can_use_conversation(uuid) is
  'USE/SEND scope for a WhatsApp conversation. Refuses any conversation linked to a tombstoned lead for every actor, manage scope included. Deliberately stricter than whatsapp_inbox_can_view_conversation.';

/* ========================================================================== */
/* 2. Per-staff read state                                                    */
/* ========================================================================== */

/*
 * DELETE BEHAVIOUR, CHOSEN FROM THE REPOSITORY'S OWN CONVENTIONS
 *
 *   conversation_id       ON DELETE RESTRICT — as whatsapp_messages. A
 *                         conversation is evidence and is never deleted; this
 *                         table must not become a reason it silently could be.
 *   staff_user_id         ON DELETE CASCADE — read state belongs to the person.
 *                         It is not business evidence: it records what one
 *                         member of staff looked at, and outliving the profile
 *                         it describes would be a cursor for nobody.
 *   last_read_message_id  ON DELETE RESTRICT — messages are never deleted, and
 *                         SET NULL would contradict the monotonic watermark the
 *                         guard trigger enforces.
 */
create table public.whatsapp_conversation_staff_state (
  conversation_id uuid not null
    references public.whatsapp_conversations (id) on delete restrict,
  staff_user_id uuid not null
    references public.profiles (id) on delete cascade,
  last_read_message_id uuid
    references public.whatsapp_messages (id) on delete restrict,
  last_read_message_at timestamptz,
  last_opened_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  constraint whatsapp_conversation_staff_state_pkey
    primary key (conversation_id, staff_user_id),
  -- A watermark timestamp without the message it came from is a forged cursor.
  constraint chk_whatsapp_conversation_staff_state_cursor_pair check (
    (last_read_message_id is null) = (last_read_message_at is null)
  )
);

comment on table public.whatsapp_conversation_staff_state is
  'WM-1: ONEDECORE internal per-staff read/open state for a WhatsApp conversation. NOT provider read status: never sent to Meta, never derived from whatsapp_messages.latest_status or whatsapp_message_status_events. Written only by mark_whatsapp_conversation_read; each staff member reads only their own row.';
comment on column public.whatsapp_conversation_staff_state.last_read_message_id is
  'Latest message in the conversation when this staff member last opened it. Must belong to the same conversation (guard trigger).';
comment on column public.whatsapp_conversation_staff_state.last_read_message_at is
  'provider_timestamp of last_read_message_id, copied by the guard trigger from the message itself. The Unread comparison watermark. Never moves backwards.';
comment on column public.whatsapp_conversation_staff_state.last_opened_at is
  'When this staff member last opened the thread in the browser. Informational; not an attention input.';

/*
 * The integrity rules, enforced for EVERY writer — the RPC, service_role and
 * the table owner alike — rather than trusted to the one function that is
 * supposed to be the only writer.
 *
 *   - identity columns are immutable once written;
 *   - the cursor message must exist and belong to this conversation;
 *   - the watermark timestamp is taken from the message, never from the caller;
 *   - the watermark never moves backwards and is never cleared.
 */
create or replace function private.whatsapp_conversation_staff_state_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_message_conversation_id uuid;
  v_message_timestamp timestamptz;
begin
  if tg_op = 'UPDATE' then
    if new.conversation_id is distinct from old.conversation_id
       or new.staff_user_id is distinct from old.staff_user_id then
      raise exception 'whatsapp_staff_state_identity_immutable' using errcode = '42501';
    end if;
  end if;

  if new.last_read_message_id is null then
    new.last_read_message_at := null;
  else
    select m.conversation_id, m.provider_timestamp
      into v_message_conversation_id, v_message_timestamp
    from public.whatsapp_messages m
    where m.id = new.last_read_message_id;

    if v_message_conversation_id is null
       or v_message_conversation_id is distinct from new.conversation_id then
      raise exception 'whatsapp_staff_state_cursor_conversation_mismatch' using errcode = '23514';
    end if;

    new.last_read_message_at := v_message_timestamp;
  end if;

  if tg_op = 'UPDATE' and old.last_read_message_at is not null then
    if new.last_read_message_at is null
       or new.last_read_message_at < old.last_read_message_at then
      raise exception 'whatsapp_staff_state_watermark_regression' using errcode = '23514';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    new.created_at := old.created_at;
  end if;
  new.updated_at := now();

  return new;
end;
$$;

create trigger trg_whatsapp_conversation_staff_state_guard
  before insert or update on public.whatsapp_conversation_staff_state
  for each row execute function private.whatsapp_conversation_staff_state_guard();

alter function private.whatsapp_conversation_staff_state_guard() owner to postgres;
revoke all on function private.whatsapp_conversation_staff_state_guard() from public, anon, authenticated;

alter table public.whatsapp_conversation_staff_state enable row level security;
alter table public.whatsapp_conversation_staff_state force row level security;

revoke all on table public.whatsapp_conversation_staff_state from public, anon, authenticated;
grant select on table public.whatsapp_conversation_staff_state to authenticated;

/*
 * Own row, AND only while the conversation is still viewable. Manage scope is
 * a wider audience for conversations, not for colleagues' cursors: a manager
 * does not read a salesperson's read state merely by holding manage scope. A
 * reassigned-away salesperson's old row stays on disk and stops being readable
 * by them the moment the lead moves.
 */
create policy whatsapp_conversation_staff_state_select_own
  on public.whatsapp_conversation_staff_state
  for select
  to authenticated
  using (
    staff_user_id = (select auth.uid())
    and (select private.whatsapp_inbox_can_view_conversation(conversation_id))
  );

comment on policy whatsapp_conversation_staff_state_select_own on public.whatsapp_conversation_staff_state is
  'WM-1: a staff member reads only their own read state, and only for a conversation they can currently view. No INSERT/UPDATE/DELETE grant exists; mark_whatsapp_conversation_read is the writer.';

/* ========================================================================== */
/* 3. Index review                                                            */
/* ========================================================================== */

/*
 * Inspected before adding:
 *
 *   idx_whatsapp_messages_conversation_timestamp (conversation_id, provider_timestamp desc)
 *     serves "latest message in a conversation" and the thread page. Kept.
 *   idx_lead_follow_ups_lead_due (lead_id, due_at)
 *     serves "open follow-up due by lead". Kept; no new follow-up index.
 *   whatsapp_conversation_staff_state_pkey (conversation_id, staff_user_id)
 *     serves the only staff-state lookup the read model performs. No extra.
 *
 * The one gap: latest INBOUND and latest OUTBOUND per conversation. With only
 * (conversation_id, provider_timestamp) Postgres walks a conversation's newest
 * messages until it meets the wanted direction — every message, for a thread
 * that is all inbound and has never been answered, which is exactly the
 * Needs Reply case. Adding `direction` between the two columns makes each a
 * single index probe. It is not a shadow of the existing index: the existing
 * one still serves the direction-free thread order this one cannot.
 */
create index idx_whatsapp_messages_conversation_direction_timestamp
  on public.whatsapp_messages (conversation_id, direction, provider_timestamp desc);

/* ========================================================================== */
/* 4. Mark read — INVOKER wrapper over a DEFINER implementation               */
/* ========================================================================== */

/*
 * Semantics:
 *   - the actor is auth.uid(); no staff id is accepted from the caller;
 *   - the actor must currently be able to VIEW the conversation — not use it —
 *     so a manage-scope historical reader of a tombstoned conversation can keep
 *     their own cursor while a salesperson cannot touch it at all;
 *   - a missing conversation and a refused one raise the SAME error, so the
 *     RPC is not an existence oracle;
 *   - the latest message is found here, server-side, ordered by
 *     provider_timestamp then id so equal timestamps resolve the same way every
 *     time;
 *   - idempotent: calling it twice changes only last_opened_at;
 *   - monotonic: the watermark advances only to a strictly later timestamp;
 *   - no Meta call, no write to whatsapp_messages or status events.
 */
create or replace function private.mark_whatsapp_conversation_read_impl(p_conversation_id uuid)
returns jsonb
language plpgsql
volatile
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_message_id uuid;
  v_message_at timestamptz;
  v_state public.whatsapp_conversation_staff_state%rowtype;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if p_conversation_id is null
     or not (select private.whatsapp_inbox_can_view_conversation(p_conversation_id)) then
    raise exception 'whatsapp_conversation_not_found' using errcode = 'P0002';
  end if;

  select m.id, m.provider_timestamp
    into v_message_id, v_message_at
  from public.whatsapp_messages m
  where m.conversation_id = p_conversation_id
  order by m.provider_timestamp desc, m.id desc
  limit 1;

  insert into public.whatsapp_conversation_staff_state as s (
    conversation_id,
    staff_user_id,
    last_read_message_id,
    last_read_message_at,
    last_opened_at
  )
  values (
    p_conversation_id,
    v_actor,
    v_message_id,
    v_message_at,
    now()
  )
  on conflict (conversation_id, staff_user_id) do update
    set
      last_opened_at = greatest(coalesce(s.last_opened_at, excluded.last_opened_at), excluded.last_opened_at),
      last_read_message_id = case
        when excluded.last_read_message_at is not null
         and (s.last_read_message_at is null or excluded.last_read_message_at > s.last_read_message_at)
          then excluded.last_read_message_id
        else s.last_read_message_id
      end,
      last_read_message_at = case
        when excluded.last_read_message_at is not null
         and (s.last_read_message_at is null or excluded.last_read_message_at > s.last_read_message_at)
          then excluded.last_read_message_at
        else s.last_read_message_at
      end
  returning * into v_state;

  return jsonb_build_object(
    'conversation_id', v_state.conversation_id,
    'last_read_message_at', v_state.last_read_message_at,
    'last_opened_at', v_state.last_opened_at
  );
end;
$$;

create or replace function public.mark_whatsapp_conversation_read(p_conversation_id uuid)
returns jsonb
language sql
volatile
security invoker
set search_path = ''
as $$
  select private.mark_whatsapp_conversation_read_impl(p_conversation_id);
$$;

comment on function public.mark_whatsapp_conversation_read(uuid) is
  'WM-1: records that the CURRENT staff member opened a conversation they can view. Advances their own internal read watermark to the latest message; idempotent and monotonic. Internal staff state only: never calls Meta, never changes provider message status. Missing and refused conversations raise the same not-found error.';

alter function private.mark_whatsapp_conversation_read_impl(uuid) owner to postgres;
revoke all on function private.mark_whatsapp_conversation_read_impl(uuid) from public, anon;
grant execute on function private.mark_whatsapp_conversation_read_impl(uuid) to authenticated;

revoke all on function public.mark_whatsapp_conversation_read(uuid) from public, anon;
grant execute on function public.mark_whatsapp_conversation_read(uuid) to authenticated;

/* ========================================================================== */
/* 5. The attention read model                                                */
/* ========================================================================== */

/*
 * FORMULAS (mirrored by `deriveWhatsappConversationAttention` in
 * src/features/whatsapp/contracts/staff-conversation-state.ts)
 *
 *   last inbound   max(provider_timestamp) of inbound messages
 *   last outbound  max(provider_timestamp) of outbound messages
 *
 *   unread               last inbound exists AND (no own watermark OR last inbound > watermark)
 *   needs_reply          last inbound exists AND (no last outbound OR last inbound > last outbound)
 *   waiting_on_customer  last outbound exists AND (no last inbound OR last outbound >= last inbound)
 *   follow_up_due        lead is LIVE AND an open lead_follow_ups row has due_at <= now()
 *   recently_active      last_message_at >= now() - p_recent_window_days
 *   all_assigned         everything the actor can view
 *
 * Follow-up Due reads CRM truth and nothing else. A tombstoned conversation is
 * never follow-up due: it is history, not work.
 *
 * ACCESS
 *
 * `private.whatsapp_inbox_can_view_conversation` is the authority and is applied
 * to every candidate row. In front of it sits a cheaper narrowing written from
 * the same rules, so a salesperson's request evaluates the authority over their
 * own assigned conversations rather than over the whole table. The narrowing
 * can only remove rows; if it ever drifted wider than the authority, the
 * authority still refuses. pgTAP proves the two agree.
 *
 * PAGING
 *
 * Bounded OFFSET paging, ordered by last_message_at DESC NULLS LAST, id DESC.
 * Not keyset. The total is the count of rows matching scope + search + link +
 * attention, returned alongside the page so an empty page past the end still
 * reports the truth.
 *
 * `p_conversation_id` narrows to one conversation, so the thread view reads its
 * header row from the same model, through the same scope, instead of a second
 * query with its own idea of access.
 *
 * `p_recent_window_days` is a parameter, not a constant, so a later settings
 * phase can supply a configured window without changing this function's shape.
 */
create or replace function public.list_whatsapp_inbox_conversations(
  p_attention text default 'all_assigned',
  p_link_filter text default 'all',
  p_search text default null,
  p_page integer default 1,
  p_page_size integer default 25,
  p_recent_window_days integer default 7,
  p_conversation_id uuid default null
)
returns jsonb
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_actor uuid;
  v_manage boolean;
  v_search text;
  v_pattern text;
  v_offset integer;
  v_result jsonb;
begin
  v_actor := auth.uid();
  if v_actor is null then
    raise exception 'authentication required' using errcode = '28000';
  end if;

  if not (select public.authorize('whatsapp.inbox.read')) then
    raise exception 'denied_inbox_read' using errcode = '42501';
  end if;

  if p_attention is null or p_attention not in (
    'all_assigned', 'unread', 'needs_reply', 'waiting_on_customer', 'follow_up_due', 'recently_active'
  ) then
    raise exception 'validation: attention' using errcode = '22023';
  end if;

  if p_link_filter is null or p_link_filter not in ('all', 'linked', 'unlinked') then
    raise exception 'validation: link_filter' using errcode = '22023';
  end if;

  if p_page is null or p_page < 1 or p_page > 10000 then
    raise exception 'validation: page' using errcode = '22023';
  end if;

  if p_page_size is null or p_page_size < 1 or p_page_size > 50 then
    raise exception 'validation: page_size' using errcode = '22023';
  end if;

  if p_recent_window_days is null or p_recent_window_days < 1 or p_recent_window_days > 90 then
    raise exception 'validation: recent_window_days' using errcode = '22023';
  end if;

  v_search := nullif(trim(coalesce(p_search, '')), '');
  if v_search is not null and length(v_search) > 200 then
    raise exception 'validation: search' using errcode = '22023';
  end if;

  -- ILIKE with the escape character stated, so a search for "50%" or "a_b"
  -- matches those characters instead of treating them as wildcards.
  if v_search is not null then
    v_pattern := '%' || replace(replace(replace(v_search, '\', '\\'), '%', '\%'), '_', '\_') || '%';
  end if;

  v_manage := (select private.whatsapp_inbox_has_manage_scope());
  v_offset := (p_page - 1) * p_page_size;

  with candidates as materialized (
    select
      c.id,
      c.customer_e164,
      c.display_name_snapshot,
      c.lead_id,
      c.contact_id,
      c.last_message_at,
      c.last_inbound_at,
      case
        when c.lead_id is null then 'unlinked'
        when l.deleted_at is null then 'live'
        else 'tombstoned'
      end as link_state
    from public.whatsapp_conversations c
    left join public.leads l on l.id = c.lead_id
    where (p_conversation_id is null or c.id = p_conversation_id)
      and (
        (v_manage and (c.lead_id is null or l.id is not null))
        or (
          c.lead_id is not null
          and l.id is not null
          and l.deleted_at is null
          and l.assigned_to = v_actor
        )
      )
      and (
        p_link_filter = 'all'
        or (p_link_filter = 'linked' and c.lead_id is not null)
        or (p_link_filter = 'unlinked' and c.lead_id is null)
      )
      and (
        v_pattern is null
        or c.display_name_snapshot ilike v_pattern escape '\'
        or c.customer_e164 ilike v_pattern escape '\'
      )
  ),
  visible as materialized (
    select cand.*
    from candidates cand
    where (select private.whatsapp_inbox_can_view_conversation(cand.id))
  ),
  evidence as (
    select
      v.*,
      inbound.at as last_inbound_message_at,
      outbound.at as last_outbound_at,
      st.last_read_message_at as staff_last_read_message_at,
      (
        v.link_state = 'live'
        and exists (
          select 1
          from public.lead_follow_ups f
          where f.lead_id = v.lead_id
            and f.status = 'open'
            and f.due_at <= now()
        )
      ) as follow_up_due
    from visible v
    left join lateral (
      select m.provider_timestamp as at
      from public.whatsapp_messages m
      where m.conversation_id = v.id
        and m.direction = 'inbound'
      order by m.provider_timestamp desc
      limit 1
    ) inbound on true
    left join lateral (
      select m.provider_timestamp as at
      from public.whatsapp_messages m
      where m.conversation_id = v.id
        and m.direction = 'outbound'
      order by m.provider_timestamp desc
      limit 1
    ) outbound on true
    left join public.whatsapp_conversation_staff_state st
      on st.conversation_id = v.id
     and st.staff_user_id = v_actor
  ),
  derived as (
    select
      e.*,
      (
        e.last_inbound_message_at is not null
        and (
          e.staff_last_read_message_at is null
          or e.last_inbound_message_at > e.staff_last_read_message_at
        )
      ) as unread,
      (
        e.last_inbound_message_at is not null
        and (
          e.last_outbound_at is null
          or e.last_inbound_message_at > e.last_outbound_at
        )
      ) as needs_reply,
      (
        e.last_outbound_at is not null
        and (
          e.last_inbound_message_at is null
          or e.last_outbound_at >= e.last_inbound_message_at
        )
      ) as waiting_on_customer,
      (
        e.last_message_at is not null
        and e.last_message_at >= now() - make_interval(days => p_recent_window_days)
      ) as recently_active
    from evidence e
  ),
  filtered as materialized (
    select d.*
    from derived d
    where case p_attention
      when 'all_assigned' then true
      when 'unread' then d.unread
      when 'needs_reply' then d.needs_reply
      when 'waiting_on_customer' then d.waiting_on_customer
      when 'follow_up_due' then d.follow_up_due
      when 'recently_active' then d.recently_active
      else false
    end
  ),
  page_rows as (
    select f.*
    from filtered f
    order by f.last_message_at desc nulls last, f.id desc
    limit p_page_size
    offset v_offset
  )
  select jsonb_build_object(
    'total_count', (select count(*) from filtered),
    'page', p_page,
    'page_size', p_page_size,
    'items', coalesce(
      (
        select jsonb_agg(
          jsonb_build_object(
            'id', p.id,
            'customer_e164', p.customer_e164,
            'display_name_snapshot', p.display_name_snapshot,
            'lead_id', p.lead_id,
            'contact_id', p.contact_id,
            'link_state', p.link_state,
            -- Lead fields cross only through the CRM's own view rule, so the
            -- inbox is never a way around lead permissions. A tombstoned lead
            -- is invisible to CRM, so its name is withheld here too.
            'linked_lead_name', case
              when p.lead_id is not null
               and (select private.crm_can_view_lead_by_id(p.lead_id))
                then (select l.submitted_name from public.leads l where l.id = p.lead_id)
              else null
            end,
            'last_message_at', p.last_message_at,
            'last_inbound_at', p.last_inbound_at,
            'last_outbound_at', p.last_outbound_at,
            'staff_last_read_message_at', p.staff_last_read_message_at,
            'preview_body_text', latest.body_text,
            'unread', p.unread,
            'needs_reply', p.needs_reply,
            'waiting_on_customer', p.waiting_on_customer,
            'follow_up_due', p.follow_up_due
          )
          order by p.last_message_at desc nulls last, p.id desc
        )
        from page_rows p
        left join lateral (
          select left(m.body_text, 240) as body_text
          from public.whatsapp_messages m
          where m.conversation_id = p.id
          order by m.provider_timestamp desc, m.id desc
          limit 1
        ) latest on true
      ),
      '[]'::jsonb
    )
  )
  into v_result;

  return v_result;
end;
$$;

comment on function public.list_whatsapp_inbox_conversations(text, text, text, integer, integer, integer, uuid) is
  'WM-1: the WhatsApp inbox list read model. Applies whatsapp_inbox_can_view_conversation to every row, then search (display name / E.164, escaped ILIKE), link filter, attention derivation (unread from the actor''s own staff watermark; needs_reply / waiting_on_customer from message chronology; follow_up_due from open CRM lead_follow_ups on a live lead; recently_active over a parameterised day window) and bounded offset paging, all before rows leave the database. Returns {total_count, page, page_size, items}. Never reads provider read status.';

alter function public.list_whatsapp_inbox_conversations(text, text, text, integer, integer, integer, uuid) owner to postgres;
revoke all on function public.list_whatsapp_inbox_conversations(text, text, text, integer, integer, integer, uuid) from public, anon;
grant execute on function public.list_whatsapp_inbox_conversations(text, text, text, integer, integer, integer, uuid) to authenticated;
