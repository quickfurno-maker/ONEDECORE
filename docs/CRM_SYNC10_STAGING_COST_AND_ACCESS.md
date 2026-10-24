# ONEDECORE CRM-SYNC-10 — Staging Cost & Access Decision Packet

**Planning only; not a purchase request or authorization. No resource was provisioned.**

## Architecture
Use a new isolated OneDecore Supabase project (separate Auth, database, keys, storage) and a separate protected HTTPS Next.js staging backend. Never reuse production Supabase `lpurlfmpvriyvpkujvyl` or QuickFurno staging. Test fixtures must be synthetic; no live customer exports, production provider tokens, cron, Meta/WhatsApp senders, payment capture or Firebase production registrations.

## Supabase public pricing (checked 24 October 2026)
- Free: **$0/month**, limited to two active free projects per account, 500 MB DB/project, project may pause after one week of inactivity and **no automatic backups**. Unsuitable for long-lived production-like restore certification without a separately planned backup process.
- Pro: starts **$25/month per organization**, includes **$10/month compute credits**; additional Micro compute is about **$10/month per running project** at normal monthly usage. An existing paid organization's incremental cost may be about **$10/month** for another Micro project if its credits are already allocated; a new Pro organization may cost $25+ depending on resources.
- Compute charges accrue hourly and are not covered by the spending cap; inspect the existing organization's plan and current utilization before approval. Costs for HTTPS Next hosting, DNS, backups/restore infrastructure, device signing/testing and any tax are **not included** in the Supabase-only estimates.

Official sources:
- https://supabase.com/pricing
- https://supabase.com/docs/guides/platform/manage-your-usage/compute
- https://supabase.com/docs/guides/platform/billing-on-supabase

## Explicit approval prerequisites
1. Owner reviews existing organization bill, estimated *incremental* Supabase and host cost in original billing currency, region, monthly cap/retention and owner of staging charges.
2. Independent DBA approves RLS/migrations/restore approach before a staging database is created.
3. AppSec signs data-isolation, no-outbound/provider quarantine and credential process.
4. Only then ask Owner separately to authorize provisioning. Do not treat this document as such authorization.

**Decision as of this batch: Staging provisioning HOLD; production HOLD.**
