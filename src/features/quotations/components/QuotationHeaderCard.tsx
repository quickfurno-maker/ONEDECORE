"use client";

import { useState } from "react";
import type { QuotationTaxProfileDTO, QuotationVersionDTO } from "../contracts/types";

import { getQuotationHeaderVersionKey } from "../utils/quotation-editor-helpers";

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
  const [rawTitle, setRawTitle] = useState<string>(version.title || "");
  const [rawScopeSummary, setRawScopeSummary] = useState<string>(version.scopeSummary || "");
  const [dirty, setDirty] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Resync local state during render when canonical version prop changes
  const [prevVersionKey, setPrevVersionKey] = useState<string>(
    getQuotationHeaderVersionKey(version)
  );
  const currentVersionKey = getQuotationHeaderVersionKey(version);

  if (prevVersionKey !== currentVersionKey) {
    setPrevVersionKey(currentVersionKey);
    setRawTitle(version.title || "");
    setRawScopeSummary(version.scopeSummary || "");
    setDirty(false);
    setValidationError(null);
  }

  const handleSaveHeader = () => {
    const trimmedTitle = rawTitle.trim();
    if (!trimmedTitle) {
      setValidationError("Proposal title is required");
      return;
    }
    if (trimmedTitle.length > 200) {
      setValidationError("Proposal title cannot exceed 200 characters");
      return;
    }

    const trimmedScope = rawScopeSummary.trim();
    if (trimmedScope.length > 2000) {
      setValidationError("Scope summary cannot exceed 2000 characters");
      return;
    }

    setValidationError(null);
    onUpdateTitleAndScope(trimmedTitle, trimmedScope);
    setDirty(false);
  };

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
            Lock Version: {version.lockVersion}
          </p>
        </div>

        <div className="flex items-center gap-3">
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

          {dirty && (
            <button
              type="button"
              className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 shadow"
              onClick={handleSaveHeader}
            >
              Save Title & Scope
            </button>
          )}
        </div>
      </div>

      {validationError && (
        <div className="mt-3 rounded-lg border border-rose-800/60 bg-rose-950/40 p-3 text-xs text-rose-300">
          ⚠️ {validationError}
        </div>
      )}

      <div className="mt-4 grid gap-4 md:grid-cols-2">
        <div>
          <label className="block text-xs font-medium text-neutral-300">
            Proposal Title <span className="text-rose-400">*</span>
          </label>
          <input
            type="text"
            className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-100 focus:border-emerald-500 focus:outline-none"
            placeholder="e.g. Turnkey Interior Proposal"
            value={rawTitle}
            onChange={(e) => {
              setRawTitle(e.target.value);
              setDirty(true);
              setValidationError(null);
            }}
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-neutral-300">
            Scope Summary / Locality
          </label>
          <input
            type="text"
            className="mt-1 block w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-sm text-neutral-100 focus:border-emerald-500 focus:outline-none"
            value={rawScopeSummary}
            placeholder="e.g. 3BHK Interior Turnkey Execution"
            onChange={(e) => {
              setRawScopeSummary(e.target.value);
              setDirty(true);
              setValidationError(null);
            }}
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
