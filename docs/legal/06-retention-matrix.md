# Retention matrix — Phase 3A1

Code mirror: `src/features/legal/retention-matrix.ts`.

**No final retention periods are stated.** Every category uses `OWNER_DECISION_REQUIRED`.

## Decision token

```text
RETENTION_OWNER_DECISION_REQUIRED = "OWNER_DECISION_REQUIRED"
```

Both `proposedRetention` and `approvedRetention` are `OWNER_DECISION_REQUIRED` for every entry. `allRetentionPeriodsUnresolved()` must return `true`.

## Categories (all pending owner decision)

| Category | Label |
| --- | --- |
| `lead` | Lead records |
| `contact` | Contact records |
| `consent` | Consent records |
| `withdrawal` | Withdrawal records |
| `suppression` | Suppression lists |
| `whatsapp` | WhatsApp message records |
| `media` | Client and project media |
| `ai-run` | AI run logs |
| `ai-summary` | AI summaries |
| `campaign` | Campaign data |
| `consultation` | Consultation records |
| `proposal` | Proposal and quotation records |
| `customer-project` | Customer and project records |
| `warranty` | Warranty claim records |
| `grievance` | Grievance records |
| `rights-request` | Data rights requests |
| `security-log` | Security logs |
| `breach-record` | Breach records |
| `backup` | Backups |

## Notes

- Consent evidence must be sufficient to demonstrate consent when required by law — retention duration still pending.
- WhatsApp, Groq, campaign and consultation categories reference features **not live** on the current website.
- Processor deletion terms pending signed agreements.
- Owner and legal approval fields are `null` throughout.
