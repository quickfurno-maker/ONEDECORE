import type { CrmLeadDetailContact } from "../../contracts/lead-detail-dtos.ts";
import { formatCrmCodeLabel } from "../../contracts/crm-labels.ts";

interface LeadDetailContactProps {
  readonly contact: CrmLeadDetailContact;
}

export function LeadDetailContact({ contact }: LeadDetailContactProps) {
  return (
    <section className="crm-surface p-3.5 sm:p-5">
      <h2 className="text-[15px] font-semibold text-[var(--crm-text)] sm:text-sm">
        Contact
      </h2>
      <p className="mt-2 text-sm text-[var(--crm-text)] sm:mt-3">{contact.displayName}</p>
      {contact.channels.length === 0 ? (
        <p className="mt-3 text-sm text-[var(--crm-muted)] sm:mt-4">
          No contact channels available.
        </p>
      ) : (
        <ul className="mt-3 space-y-2 sm:mt-4 sm:space-y-3">
          {contact.channels.map((channel) => (
            <li
              key={channel.id}
              className="rounded-[10px] border border-[var(--crm-border)] bg-[var(--crm-surface-subtle)] px-3 py-2 text-sm"
            >
              <div className="flex flex-wrap items-center gap-2">
                <span className="font-medium text-[var(--crm-text)]">
                  {formatCrmCodeLabel(channel.channelType)}
                </span>
                {channel.isPrimary ? (
                  <span className="rounded bg-[var(--crm-primary-soft)] px-2 py-0.5 text-[11px] font-semibold text-[var(--crm-primary)]">
                    Primary
                  </span>
                ) : null}
              </div>
              <p className="mt-1 text-[var(--crm-text-secondary)]">
                {channel.addressNormalized}
              </p>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
