import Link from "next/link";
import type { ManualLeadDuplicatePreview } from "../../contracts/manual-lead-contracts.ts";

interface ManualLeadDuplicateNoticeProps {
  readonly preview: ManualLeadDuplicatePreview | null;
}

export function ManualLeadDuplicateNotice({ preview }: ManualLeadDuplicateNoticeProps) {
  if (!preview) {
    return null;
  }

  switch (preview.outcomeCode) {
    case "CLEAR":
      return (
        <div
          role="status"
          className="rounded-md border border-[var(--crm-success)]/25 bg-[var(--crm-success-soft)] px-4 py-3 text-sm text-[var(--crm-success)]"
        >
          No similar active or recent enquiry was found. You can create this lead.
        </div>
      );
    case "REUSABLE_CONTACT":
      return (
        <div
          role="status"
          className="rounded-md border border-[var(--crm-info)]/25 bg-[var(--crm-info-soft)] px-4 py-3 text-sm text-[var(--crm-info)]"
        >
          Existing client contact will be reused. No prior contact details are shown here.
        </div>
      );
    case "ACTIVE_DUPLICATE":
      return (
        <div
          role="alert"
          className="rounded-md border border-[var(--crm-danger)]/25 bg-[var(--crm-danger-soft)] px-4 py-3 text-sm text-[var(--crm-danger)]"
        >
          <p>
            A similar active enquiry already exists. Creating another active lead is not
            allowed.
          </p>
          {preview.existingLeadId ? (
            <p className="mt-2">
              <Link
                href={`/admin/crm/leads/${preview.existingLeadId}`}
                className="font-medium underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[var(--crm-primary)]"
              >
                Open existing lead
              </Link>
            </p>
          ) : null}
        </div>
      );
    case "RECENT_SIMILAR":
      return (
        <div
          role="alert"
          className="rounded-md border border-[var(--crm-warning)]/25 bg-[var(--crm-warning-soft)] px-4 py-3 text-sm text-[var(--crm-warning)]"
        >
          A similar enquiry was closed within the last 30 days. Sales executives must contact
          a sales manager. Authorized managers may override with a documented reason.
        </div>
      );
    case "CONTACT_IDENTITY_CONFLICT":
      return (
        <div
          role="alert"
          className="rounded-md border border-[var(--crm-danger)]/25 bg-[var(--crm-danger-soft)] px-4 py-3 text-sm text-[var(--crm-danger)]"
        >
          The phone number and email map to different existing client records. Ask a manager
          or administrator to review before proceeding.
        </div>
      );
    default:
      return null;
  }
}
