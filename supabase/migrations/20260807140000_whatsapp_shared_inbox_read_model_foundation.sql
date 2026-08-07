-- =============================================================================
-- ONEDECORE Phase 6B-B2 — Shared Inbox Read Model (M20)
-- Repository only. No managed apply. Extends M19 scoped access to conversation/message reads.
-- =============================================================================

grant select on table public.whatsapp_conversations to authenticated;
grant select on table public.whatsapp_messages to authenticated;

create policy whatsapp_conversations_select_scoped
  on public.whatsapp_conversations
  for select
  to authenticated
  using ((select private.whatsapp_inbox_can_view_conversation(id)));

create policy whatsapp_messages_select_scoped
  on public.whatsapp_messages
  for select
  to authenticated
  using (
    exists (
      select 1
      from public.whatsapp_conversations c
      where c.id = conversation_id
        and (select private.whatsapp_inbox_can_view_conversation(c.id))
    )
  );

comment on policy whatsapp_conversations_select_scoped on public.whatsapp_conversations is
  'Phase 6B-B2: staff may read conversations only within M19 inbox scope (current assignment / manager triage).';

comment on policy whatsapp_messages_select_scoped on public.whatsapp_messages is
  'Phase 6B-B2: staff may read messages only for conversations they can view under M19 inbox scope.';
