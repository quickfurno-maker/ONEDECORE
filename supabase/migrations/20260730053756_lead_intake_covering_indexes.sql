-- ONEDECORE Phase 4B2 — lead intake covering indexes for unindexed FK columns.
-- Indexes only. No table, policy, function, permission, or data changes.

create index idx_consent_events_intake_request_id
  on public.consent_events (intake_request_id)
  where intake_request_id is not null;

create index idx_lead_intake_requests_lead_id
  on public.lead_intake_requests (lead_id)
  where lead_id is not null;

create index idx_lead_events_actor_id
  on public.lead_events (actor_id)
  where actor_id is not null;
