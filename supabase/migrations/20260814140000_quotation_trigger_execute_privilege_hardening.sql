-- ONEDECORE Phase 7B M27 — Forward-only trigger helper EXECUTE privilege hardening
--
-- M26 (`20260813140000_commercial_quotation_finalization_delivery_acceptance.sql`)
-- is already managed-applied and MUST remain immutable.
--
-- Independent post-M26 verification found that
-- public.prevent_finalized_quotation_mutation() retained PUBLIC/anon/authenticated
-- EXECUTE while its sibling M26 trigger helpers
-- (prevent_ready_quotation_pdf_mutation, enforce_quotation_pdf_document_invariants)
-- were correctly restricted to postgres/service_role.
--
-- Trigger runtime does not require the session user to hold EXECUTE on the
-- trigger function. This migration revokes only that unintended direct RPC
-- exposure. Function body, triggers, and M26 are not modified. No new grants.

revoke all on function public.prevent_finalized_quotation_mutation()
  from public, anon, authenticated;
