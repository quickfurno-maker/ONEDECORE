# Security and breach readiness — Phase 3A1

Architecture and playbook documentation only. **Complete operational compliance is not claimed.**

Status labels used in this phase:

| Label | Meaning |
| --- | --- |
| `VERIFIED` | Confirmed in production with evidence |
| `PARTIAL` | Designed or partially implemented; verification pending |
| `PLANNED` | Documented intent; not operational |
| `NOT IMPLEMENTED` | Feature or control not built |
| `OWNER DECISION REQUIRED` | Awaiting owner input |

## Security controls (design status)

| Control | Status | Notes |
| --- | --- | --- |
| Least-privilege access | `PLANNED` | Role separation for future CRM, privacy and admin |
| Server-only secrets / keys | `PARTIAL` | Supabase service keys not exposed to client bundles |
| Encryption in transit | `PLANNED` | Expected for production hosting; verify at deployment |
| Encryption at rest (storage) | `PARTIAL` | Supabase storage — verify operationally |
| Security / audit logs | `PARTIAL` | Supabase auth and application logs as configured |
| Key rotation policy | `OWNER DECISION REQUIRED` | Schedule and ownership pending |
| Access review | `OWNER DECISION REQUIRED` | Admin account review cadence pending |
| Incident contact | `OWNER DECISION REQUIRED` | Processor incident contacts null |

## Breach readiness playbook

Documented sequence (operational execution not claimed complete):

1. **Detect** — monitoring, logs, staff report, processor notification
2. **Contain** — isolate affected systems, revoke credentials, preserve evidence
3. **Preserve** — secure logs and snapshots for investigation
4. **Assess** — scope, data categories, individuals affected, severity
5. **Identify** — root cause and ongoing exposure
6. **Notify** — affected individuals and Board/regulator per applicable law once procedures approved
7. **Prepare notices** — draft communications with legal counsel
8. **Remediate** — fix vulnerability, rotate keys, restore service
9. **Review** — post-incident review, update controls and retention

Breach record retention: `OWNER_DECISION_REQUIRED` (see retention matrix).

## Compliance boundary

ONEDECORE applies privacy-by-design and data-minimisation in architecture. Reasonable safeguards are planned; absolute security is not claimed. Affected-person and Board notifications will follow applicable law once contacts, procedures and counsel review are complete.
