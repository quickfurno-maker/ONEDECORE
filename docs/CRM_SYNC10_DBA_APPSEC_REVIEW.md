# ONEDECORE CRM-SYNC-10 — Independent DBA/AppSec Audit Packet

**24 Oct 2026 · Evidence preparation only · Production and staging deployment HOLD**

## Corrected PostgreSQL RLS semantics (security-critical)
Previous offline review could falsely pass when one CRM-scoped policy coexisted with a broader second permissive policy. PostgreSQL permissive policies combine with **OR**, and an empty policy role OID array represents **PUBLIC**, not a policy with no actors.

CRM-SYNC-10 corrects both:
- `scripts/sql/crm_sync9_staging_rls_snapshot.sql` now exports `polpermissive` plus the complete role-array metadata and `pg_get_expr` policy predicate for the three sensitive CRM tables.
- `scripts/crm-sync9-rls-review.mjs` reviews **every** permissive SELECT/ALL policy and flags missing scoped permission guard, PUBLIC/anon grants, unconditional predicates, RLS disabled and incomplete metadata. Restrictive-only policies do not count as sufficient access control. It remains an **advisory syntactic checker, not a proof of authorization**.
- The checker treats a policy role-array of `[]` as **PUBLIC**; this catches the previous false-negative. It keeps explicit independent review for absent FORCE RLS / owner and bypass roles.
- Six targeted negative RLS cases plus two read-only SQL guard tests PASS. The offline CLI always exits HOLD, including on passing synthetic metadata.

## Production read-only baseline from earlier audits
- 109 applied migration version strings matched 109 source version strings; **not** checksum/body or privilege parity.
- Selected production lead/conversation/message policies included authenticated CRM/inbox permission helpers; no live user impersonation was performed.
- 622 `SECURITY DEFINER` functions in public/private were found with explicit function `search_path`; that is a structural observation, not a complete function-body authorization audit.
- No production DB modifications or RLS changes were made in CRM-SYNC-10.

## Independent DBA evidence requested — staged system ONLY
1. **Provisioning approval**: separate OneDecore staging project, explicitly authorized budget/region, synthetic-only data, retention rules, named credential custodian.
2. **Schema integrity**: ordered applied migrations plus checksums/definition snapshots, policy SQL, triggers, owner/bypass roles, definer bodies, RPC grants.
3. **Privilege exercises**: two genuine staging identities with different CRM permissions; one owned and one hidden synthetic lead; direct SQL/JWT RLS and REST positive/negative cases (not service-role shortcuts).
4. **Defense in depth**: external provider outbound and Meta/WhatsApp/payment webhooks physically disabled; verify actual code paths and network egress, not only feature-flag variables.
5. **Disaster recovery**: signed backup, restore into separate staging target, versioned rollback rehearsal with actual database grants.
6. **AppSec**: review Zod/node-forge upstream issues, native signing reachability, JWT handling, hostname allowlisting and content-free WhatsApp endpoint.
7. **Signatures**: independent DBA and AppSec sign exact commit SHA, evidence, blockers, exceptions/expiry; Owner GO is a separate final decision.

## External dependencies
No separate authorized ONEDECORE staging stack is visible in the connected Supabase account. Do not reuse the production project or QuickFurno Staging. The user has directed staging provisioning and all deployment to remain on HOLD. The independent reviewer has not yet been identified/assigned.

**Neither a staging deployment nor an APK was built, signed or distributed.**
