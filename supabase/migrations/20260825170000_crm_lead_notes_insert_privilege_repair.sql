-- Phase 10 — CRM lead_notes INSERT privilege repair (managed production drift)
--
-- Production audit found authenticated SELECT on public.lead_notes present, but
-- authenticated INSERT(lead_id, body) missing. Table privilege therefore failed
-- before RLS could authorize Super Admin note inserts.
--
-- Historical repository contract (20260730184426_crm_identity_core_foundation)
-- already intended:
--   grant select on table public.lead_notes to authenticated;
--   grant insert (lead_id, body) on table public.lead_notes to authenticated;
--
-- This forward-only repair restores the INSERT column grant only.
-- RLS policies remain the authorization boundary (crm.notes.manage +
-- crm_can_mutate_lead). Append-only UPDATE/DELETE triggers and creator
-- ownership remain unchanged. No table owner change. RLS stays enabled.

grant insert (lead_id, body)
  on table public.lead_notes
  to authenticated;
