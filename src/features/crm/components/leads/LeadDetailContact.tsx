import type { CrmLeadDetailContact } from "../../contracts/lead-detail-dtos.ts";
import { formatCrmCodeLabel } from "../../contracts/crm-labels.ts";

interface LeadDetailContactProps {
  readonly contact: CrmLeadDetailContact;
}

export function LeadDetailContact({ contact }: LeadDetailContactProps) {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/50 p-5">
      <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-400">
        Contact
      </h2>
      <p className="mt-3 text-sm text-neutral-100">{contact.displayName}</p>
      {contact.channels.length === 0 ? (
        <p className="mt-4 text-sm text-neutral-500">No contact channels available.</p>
      ) : (
        <ul className="mt-4 space-y-3">
          {contact.channels.map((channel) => (
            <li
              key={channel.id}
              className="rounded-md border border-neutral-800 bg-neutral-950/50 px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-neutral-200">
                  {formatCrmCodeLabel(channel.channelType)}
                </span>
                {channel.isPrimary ? (
                  <span className="rounded bg-amber-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-amber-300">
                    Primary
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-neutral-300">{channel.addressNormalized}</p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
