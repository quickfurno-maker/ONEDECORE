-- ONEDECORE — CRM lead_notes INSERT privilege redrift repair (history reconciliation)
--
-- Provenance: this migration was applied directly against managed production and
-- recorded in supabase_migrations.schema_migrations as version 20260831174021,
-- but the file was never committed. Managed Supabase therefore reported it as a
-- remote-only migration (ledger drift).
--
-- This file restores that already-applied history into Git verbatim. It is a
-- faithful transcription of the recorded remote SQL — nothing is added and
-- nothing is reinterpreted. It is NOT a new change: the identical grant is
-- already carried by 20260825170000_crm_lead_notes_insert_privilege_repair.sql,
-- and re-issuing a column-level GRANT is idempotent, so replaying the ledger
-- from scratch (db reset) converges on exactly the same privilege state.
--
-- Authorization boundary is unchanged. RLS stays enabled on public.lead_notes
-- and the lead_notes_insert policy (crm.notes.manage + crm_can_mutate_lead)
-- remains the sole authorization gate. No policy, role, owner, trigger, column,
-- constraint or function is created, altered or dropped here; no privilege is
-- broadened beyond the INSERT(lead_id, body) column grant already in force, and
-- none is revoked.

grant insert (lead_id, body)
  on table public.lead_notes
  to authenticated;
