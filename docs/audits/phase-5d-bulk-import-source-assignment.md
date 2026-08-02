# Phase 5D — Bulk Import & Source-Based Assignment

**Audit state:** IN PROGRESS (local only)

**Date:** August 2, 2026
**Migration:** 15 — `20260802140000_crm_bulk_import_source_assignment_foundation.sql`

---

## 1. Scope

Phase 5D adds staged bulk lead import with manager submission / super-admin approval, direct super-admin import, and source-based assignment rules resolved during validation.

### Owner corrections (locked)

| Field | Value |
| :--- | :--- |
| `leads.entry_method` | `import` |
| `leads.source` | `bulk-import` |

---

## 2. Database surface (migration 15)

### Permissions

- `leads.bulk_import` — super_admin, sales_manager, management
- `leads.bulk_import_approve` — super_admin only
- `leads.assignment_rules.manage` — super_admin only

### Public RPCs

| RPC | Purpose |
| :--- | :--- |
| `create_lead_import_batch` | Idempotent batch creation |
| `replace_lead_import_mapping` | Column mapping + default source |
| `replace_lead_import_rows` | Replace staged rows (1–1000) |
| `validate_lead_import_batch` | Row validation + assignment resolution |
| `submit_lead_import_batch` | Manager submission |
| `approve_lead_import_batch` | Super-admin approval (not creator) |
| `reject_lead_import_batch` | Super-admin rejection |
| `confirm_lead_import_batch_direct` | Super-admin direct confirm |
| `cancel_lead_import_batch` | Cancel non-terminal batch |
| `process_lead_import_batch` | Chunked import execution |
| `create_lead_assignment_rule` | Create rule |
| `update_lead_assignment_rule` | Update rule |
| `set_lead_assignment_rule_active` | Enable/disable rule |

---

## 3. Application layer

### Contracts

- `lead-import-contracts.ts` — statuses, limits, mapping keys, DTOs
- `assignment-rule-contracts.ts` — rule DTOs and validation

### Server

- `lead-import-file-parser.ts` — CSV (UTF-8 BOM) + XLSX (formula rejection), 5 MiB / 1000 rows / 50 cols
- `crm-import-service.ts`, `crm-import-queries.ts`, `crm-import-actions.ts`
- `crm-assignment-rule-service.ts`, `crm-assignment-rule-actions.ts`
- Extended `crm-errors.ts`, `crm-permissions.ts`, `crm-access.ts`, `crm-auth.ts`

### UI routes

| Route | Access |
| :--- | :--- |
| `/admin/crm/imports` | `leads.bulk_import` |
| `/admin/crm/imports/new` | `leads.bulk_import` |
| `/admin/crm/imports/[batchId]` | batch visibility RPC |
| `/admin/crm/settings/assignment-rules` | `leads.assignment_rules.manage` |

---

## 4. Local QA

```bash
PHASE_5C1_QA_PASSWORD='<local-only>' node scripts/phase-5d-owner-qa.mjs
PHASE_5C1_QA_PASSWORD='<local-only>' PHASE_5D_BASE_URL=http://localhost:3000 node scripts/phase-5d-browser-qa.mjs
```

Owner QA (~27 assertions): permissions, batch lifecycle, owner corrections, assignment rules, rejection/cancel guards.

Browser QA: nav visibility by role, imports wizard upload, assignment rules page (super admin).

---

## 5. Exit gate checklist

- [ ] Manager cannot approve own batch
- [ ] Sales executive bulk import denied
- [ ] Unassigned fallback when no rule match
- [ ] Imported leads use `entry_method=import` and `source=bulk-import`
- [ ] Local owner + browser QA green
- [ ] Managed migration 15 not applied (local only)

---

## 6. Status

**Phase 5D:** application layer implemented locally; migration 15 present in repo; managed deployment pending.
