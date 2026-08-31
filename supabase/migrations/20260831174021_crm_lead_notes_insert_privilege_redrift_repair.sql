-- CRM lead_notes INSERT privilege re-drift repair
-- Forward-only.
--
-- The repository contract intentionally permits authenticated CRM users
-- to INSERT only lead_id and body into public.lead_notes.
-- RLS remains the authorization boundary:
--   crm.notes.manage + private.crm_can_mutate_lead(...)
--
-- Production migration history contains the earlier repair, but the
-- column-scoped INSERT privilege is currently absent again.
-- Restore only the intended column grant.
--
-- No UPDATE/DELETE grant.
-- No broad table INSERT grant.
-- No RLS change.
-- No trigger change.

grant insert (lead_id, body)
  on table public.lead_notes
  to authenticated;