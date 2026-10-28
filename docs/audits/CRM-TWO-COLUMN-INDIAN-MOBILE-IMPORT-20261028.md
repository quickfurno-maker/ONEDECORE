# ONEDECORE — Two-column bulk enquiry import

**Branch:** `feat/crm-two-column-enquiry-import-20261028`

**Base:** `origin/main` at `27521f031195a8b749bebeceae0ba22ad475b816`

**Production authorization:** HOLD. This PR does not authorize or perform managed database migrations, outbound WhatsApp messages, or VPS deployment.

## Owner workflow

1. CRM → Lead imports displays **Download Excel** immediately beside **Bulk Upload**. The protected `/admin/crm/imports/template` download provides **Name**, **Mobile Number**, and optional **Source** columns, with a refreshed source catalogue and Excel dropdown. The original two-column format is still supported.
2. Paste up to 1,000 rows; mobile cells are text. Accept `9876543210`, `+91 9876543210`, `919876543210`, `09876543210`, and spaces/hyphens/parentheses. Successful normalization produces `+91` plus 10 digits starting 6–9.
3. Choose an **active default lead source** once and upload. The optional Source cell may contain any existing active CRM source **name**, **code**, or ID; blank cells use the default. The strict 2/3-column format stages, maps, and validates in one upload. Unknown or ambiguous names fail before staging with the Excel row number; no silent fallback or auto-created source. Other CSV/XLSX files continue through manual mapping.
4. Review normalized mobiles, original row numbers, valid/duplicate/invalid filters, 20 rows per page and number sorting. Invalid rows remain excluded; valid rows can still proceed.
5. Super Admin reviews and confirms direct import. The database processes at most 100 records per chunk. With no configured assignment rules imported enquiries remain **Unassigned**. The CRM default lead temperature is **Cold**.
6. Importing does **not grant WhatsApp marketing consent** or send any messages.

## Correctness and permissions

- CSV/XLSX header names must be unique (case-insensitive), nonblank, and not dangerous property keys. XLSX header gaps preserve the real source column indices.
- Reject two file headers mapped to the same CRM field.
- Generic two-step imports require re-upload of the **identical original file**: SHA-256, file type and header fingerprint must match.
- Omitted service/property/timeline fields use existing `not-specified` taxonomy values; no false assumptions.
- The additive SQL migration replaces only the import validator and batch validator based on their latest source versions, adding unknown-field support, within-file duplicate detection and valid-subset approval.
- Duplicate protection is repeated when processing each row against CRM. No anonymous privileges or weakened RBAC.
- The inline **Add Source in CRM** panel calls the existing `create_lead_source` RPC only after the Super Admin permission check. It never imports leads or creates WhatsApp consent. A fresh download includes newly added active sources; the old generated workbook can be re-used with a matching name/code.
- Super Admin is the only role with bulk import permission in the managed Production schema; other roles unchanged.

## QA / release control

- New 7-case TypeScript regression suite covers normalization, template, CSV, XLSX blank columns, duplicate headers and mappings, and migration/consent checks.
- Existing migration-frozen inventory suite updated to recognize the one reviewed forward migration.
- Dependency refresh: patched Next.js, Sharp and CSV parser; verify all CI gates before merge.
- Windows local Docker port 54322 prevented disposable database reset; do not call this a passing DB restore. **Isolated GitHub CI database reset and pgTAP are required.**
- **Production HOLD remains unchanged.** Do not apply migration or activate campaigns/Meta/payments. All rollout and rollback authority requires a separate approval.

## Rollback

A code downgrade alone does not reverse the SQL function replacements. A reviewer must prepare a forward revert migration with data compatibility checks for any imported `not-specified` records. The production VPS and managed Supabase remain unchanged until explicit authorization.
