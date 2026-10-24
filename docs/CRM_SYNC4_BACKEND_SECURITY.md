# ONEDECORE CRM-SYNC-4 — backend security and mobile API review (24 Oct 2026)

## Release posture
**SOURCE-TESTED DRAFT PR / RELEASE HOLD**. Changes apply only to draft ONEDECORE PR #219; never deploy or activate while staging and independent AppSec/DBA certification are absent.

## Focused backend improvements
- Authenticated read `/api/mobile/crm/leads/[leadId]/whatsapp-engagement`: check the lead ID format and perform a caller-RLS-scoped `leads.select("id").eq(...).maybeSingle()` **before** calling `fetchWhatsappEngagementSignals` with exactly that visible ID. Return indistinguishable `not_found` for nonexistent/RLS-invisible leads.
- This replaces a duplicate expensive `queryLeadIntelligence` + full scoring batch with one minimal RLS query plus the needed WhatsApp signal RPC. Never pass an arbitrary unverified lead ID to an elevated function.
- Content-free response remains exactly `linked`, `hasCustomerReply`, `lastInboundAt`. Explicit private `Cache-Control: no-store` for Nurture and WhatsApp responses.
- Source-reviewed SQL migration `supabase/migrations/20260928000836_crm_whatsapp_intelligence.sql`: private RPC has authenticated actor guard, 200-ID cap, `private.crm_can_view_lead(l.assigned_to)`; public wrapper uses `SECURITY INVOKER`. Verify this on real isolated staging before claiming the DB behavior is certified.

## Package-level high/critical remediation
Starting (24 Oct) `npm audit --omit=dev`: **1 critical, 3 high, 3 moderate**.
- Updated pinned `next` from 16.3.3 to **16.4.3** (current advisory-supported non-major fix).
- Updated pinned `sharp` from 0.35.4 to **0.35.5**.
- Refreshed compatible `brace-expansion` and `source-map-js` transitive packages with lockfile.
- Result: **0 critical, 0 high, 3 moderate** on current npm registry snapshot.
- Remaining moderate nodes: `csv-parse`, `exceljs`, `uuid`, primarily the import/export chain. Do **not** downgrade `exceljs` to older major or run `npm audit fix --force`. Analyze importer reachability/input validation and get AppSec mitigation/waiver with expiry, otherwise release HOLD.
- Separate CI job checks the exact lockfile with `npm audit --omit=dev --audit-level=high`, Next server TypeScript and relevant CRM mobile-contract/authorization tests.
- Build artifact proof must be rechecked on review commit SHA and deployed staging runtime, rather than inferred from `npm audit` output alone.

## Outstanding independent checks
1. Isolated OneDecore staging Supabase + Next.js deployment, no Meta/WhatsApp production credentials.
2. DB grants/RLS, SECURITY DEFINER function inventory and authorization proof.
3. Authenticated owner/denied/hidden-lead tests, plus no existence oracle.
4. AppSec review of all remaining moderate and managed-Supabase advisor findings, signed by independent reviewer.
5. No branch merge, staging deployment or production release without approval.
