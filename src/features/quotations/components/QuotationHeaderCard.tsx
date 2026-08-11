"use client";

import type { QuotationTaxProfileDTO, QuotationVersionDTO } from "../contracts/types";

interface QuotationHeaderCardProps {
  readonly version: QuotationVersionDTO;
  readonly quotationNumber: string;
  readonly taxProfiles: readonly QuotationTaxProfileDTO[];
  readonly onUpdateTitleAndScope: (title: string, scopeSummary: string) => void;
  readonly onSelectTaxProfile: (taxProfileId: string | null) => void;
}

export function QuotationHeaderCard({
  version,
  quotationNumber,
  taxProfiles,
  onUpdateTitleAndScope,
  onSelectTaxProfile,
}: QuotationHeaderCardProps) {
  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-sm">
      <div className="flex flex-wrap items-center justify-between gap-4 border-b border-neutral-800 pb-4">
        <div>
          <div className="flex items-center gap-2">
            <h2 className="text-xl font-bold text-neutral-100">{quotationNumber}</h2>
            <span className="rounded-full bg-emerald-950/80 px-2.5 py-0.5 text-xs font-semibold text-emerald-400 border border-emerald-800/60">
              v{version.versionNumber} ({version.status})
            </span>
          </div>
          <p className="mt-1 text-xs text-neutral-400">
            Lock Version: {version.lockVersion} • Created: {new Date(version.id ? Date.now() : Date.now()).toLocaleDateString("en-IN")}
          </p>
        </div>

        {/* Tax Profile Selector */}
        <div className="min-w-[240px]">
          <label className="block text-xs font-medium text-neutral-300">
            Tax Profile Configuration
          </label>
          <select
            className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-100 focus:border-emerald-500 focus:outline-none"
            value={version.taxProfileId || ""}
            onChange={(e) => {
              const val = e.target.value;
              onSelectTaxProfile(val ? val : null);
            }}
          >
            <option value="">(No Tax Profile — Incomplete)</option>
            {taxProfiles.map((tp) => (
              <option key={tp.id} value={tp.id}>
                {tp.displayName} ({tp.ratePercentage}%)
              </option>
            ))}
          </select>
          {version.taxProfileId == null ? (
            <p className="mt-1 text-xs text-amber-400 font-medium">
              ⚠️ Tax profile unconfigured (Tax Total & Grand Total incomplete)
            </p>
          ) : (
            <p className="mt-1 text-xs text-emerald-400">
              ✓ Tax Rate: {version.taxRatePercentage}% snapshot applied
            </p>
          )}
        </div>
      </div>

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-neutral-300">
            Proposal Title <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-100 focus:border-emerald-500 focus:outline-none"
            value={version.title}
            onChange={(e) => onUpdateTitleAndScope(e.target.value, version.scopeSummary || "")}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-300">
            Scope Summary / Locality
          </label>
          <input
            type="text"
            className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-100 focus:border-emerald-500 focus:outline-none"
            value={version.scopeSummary || ""}
            placeholder="e.g. 3BHK Interior Turnkey Execution"
            onChange={(e) => onUpdateTitleAndScope(version.title, e.target.value)}
          />
        </div>
      </div>

      {/* Client Snapshot Metadata */}
      <div className="mt-4 rounded-lg bg-neutral-950/80 p-3 border border-neutral-800/80">
        <h4 className="text-xs font-semibold uppercase tracking-wider text-neutral-400">
          Client & Property Snapshot
        </h4>
        <div className="mt-2 grid grid-cols-2 gap-4 text-xs sm:grid-cols-4">
          <div>
            <span className="text-neutral-500">Client:</span>{" "}
            <span className="font-medium text-neutral-200">{version.clientNameSnapshot || "N/A"}</span>
          </div>
          <div>
            <span className="text-neutral-500">Phone:</span>{" "}
            <span className="font-medium text-neutral-200">{version.clientPhoneSnapshot || "N/A"}</span>
          </div>
          <div>
            <span className="text-neutral-500">Email:</span>{" "}
            <span className="font-medium text-neutral-200">{version.clientEmailSnapshot || "N/A"}</span>
          </div>
          <div>
            <span className="text-neutral-500">Property:</span>{" "}
            <span className="font-medium text-neutral-200">{version.propertyAddressSnapshot || "N/A"}</span>
          </div>
        </div>
      </div>
    </div>
  );
}
