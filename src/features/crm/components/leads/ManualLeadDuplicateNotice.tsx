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
          className="rounded-md border border-emerald-800/60 bg-emerald-950/40 px-4 py-3 text-sm text-emerald-100"
        >
          No similar active or recent enquiry was found. You can create this lead.
        </div>
      );
    case "REUSABLE_CONTACT":
      return (
        <div
          role="status"
          className="rounded-md border border-sky-800/60 bg-sky-950/40 px-4 py-3 text-sm text-sky-100"
        >
          Existing client contact will be reused. No prior contact details are shown here.
        </div>
      );
    case "ACTIVE_DUPLICATE":
      return (
        <div
          role="alert"
          className="rounded-md border border-rose-800/70 bg-rose-950/40 px-4 py-3 text-sm text-rose-100"
        >
          <p>
            A similar active enquiry already exists. Creating another active lead is not
            allowed.
          </p>
          {preview.existingLeadId ? (
            <p className="mt-2">
              <Link
                href={`/admin/crm/leads/${preview.existingLeadId}`}
                className="font-medium underline underline-offset-2 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-amber-400"
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
          className="rounded-md border border-amber-800/70 bg-amber-950/40 px-4 py-3 text-sm text-amber-100"
        >
          A similar enquiry was closed within the last 30 days. Sales executives must contact
          a sales manager. Authorized managers may override with a documented reason.
        </div>
      );
    case "CONTACT_IDENTITY_CONFLICT":
      return (
        <div
          role="alert"
          className="rounded-md border border-rose-800/70 bg-rose-950/40 px-4 py-3 text-sm text-rose-100"
        >
          The phone number and email map to different existing client records. Ask a manager
          or administrator to review before proceeding.
        </div>
      );
    default:
      return null;
  }
}
