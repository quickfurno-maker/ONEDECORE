"use client";

import { useState } from "react";
import type { QuotationVersionDTO } from "../contracts/types";
import { getQuotationTermsVersionKey } from "../utils/quotation-editor-helpers";

interface QuotationTermsEditorProps {
  readonly version: QuotationVersionDTO;
  readonly onSaveTerms: (
    terms: string,
    inclusions: readonly string[],
    exclusions: readonly string[]
  ) => void;
}

export function QuotationTermsEditor({
  version,
  onSaveTerms,
}: QuotationTermsEditorProps) {
  const [terms, setTerms] = useState(version.termsAndConditions || "");
  const [inclusions, setInclusions] = useState<readonly string[]>(version.inclusions || []);
  const [exclusions, setExclusions] = useState<readonly string[]>(version.exclusions || []);
  const [newInc, setNewInc] = useState("");
  const [newExc, setNewExc] = useState("");
  const [dirty, setDirty] = useState(false);
  const [validationError, setValidationError] = useState<string | null>(null);

  // Resync local state during render when canonical version prop changes
  const [prevVersionKey, setPrevVersionKey] = useState<string>(
    getQuotationTermsVersionKey(version)
  );
  const currentVersionKey = getQuotationTermsVersionKey(version);

  if (prevVersionKey !== currentVersionKey) {
    setPrevVersionKey(currentVersionKey);
    setTerms(version.termsAndConditions || "");
    setInclusions(version.inclusions || []);
    setExclusions(version.exclusions || []);
    setNewInc("");
    setNewExc("");
    setDirty(false);
    setValidationError(null);
  }

  const handleAddInclusion = () => {
    if (!newInc.trim()) return;
    if (inclusions.length >= 100) {
      setValidationError("Inclusions cannot exceed 100 items");
      return;
    }
    setInclusions([...inclusions, newInc.trim()]);
    setNewInc("");
    setDirty(true);
    setValidationError(null);
  };

  const handleRemoveInclusion = (idx: number) => {
    setInclusions(inclusions.filter((_, i) => i !== idx));
    setDirty(true);
    setValidationError(null);
  };

  const handleAddExclusion = () => {
    if (!newExc.trim()) return;
    if (exclusions.length >= 100) {
      setValidationError("Exclusions cannot exceed 100 items");
      return;
    }
    setExclusions([...exclusions, newExc.trim()]);
    setNewExc("");
    setDirty(true);
    setValidationError(null);
  };

  const handleRemoveExclusion = (idx: number) => {
    setExclusions(exclusions.filter((_, i) => i !== idx));
    setDirty(true);
    setValidationError(null);
  };

  const handleSave = () => {
    if (terms.length > 5000) {
      setValidationError("Terms and conditions cannot exceed 5000 characters");
      return;
    }
    if (inclusions.length > 100) {
      setValidationError("Inclusions cannot exceed 100 items");
      return;
    }
    if (exclusions.length > 100) {
      setValidationError("Exclusions cannot exceed 100 items");
      return;
    }

    setValidationError(null);
    onSaveTerms(terms, inclusions, exclusions);
    setDirty(false);
  };

  return (
    <div className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-6 shadow-sm">
      <div className="flex items-center justify-between border-b border-neutral-800 pb-4">
        <div>
          <h3 className="text-base font-semibold text-neutral-100">Inclusions, Exclusions & Terms</h3>
          <p className="text-xs text-neutral-400">
            Define customer-facing scope boundaries, inclusions list, exclusions, and commercial terms.
          </p>
        </div>

        {dirty && (
          <button
            type="button"
            className="rounded-lg bg-emerald-600 px-3.5 py-1.5 text-xs font-semibold text-white hover:bg-emerald-500 shadow"
            onClick={handleSave}
          >
            Save Terms
          </button>
        )}
      </div>

      {validationError && (
        <div className="mt-3 rounded-lg border border-rose-800/60 bg-rose-950/40 p-3 text-xs text-rose-300">
          ⚠️ {validationError}
        </div>
      )}

      <div className="mt-4 grid gap-6 md:grid-cols-2">
        {/* Inclusions */}
        <div>
          <label className="block text-xs font-semibold text-neutral-300">Inclusions</label>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              className="flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-xs text-neutral-100 focus:border-emerald-500 focus:outline-none"
              placeholder="e.g. 10-Year Warranty on Hardware"
              value={newInc}
              onChange={(e) => {
                setNewInc(e.target.value);
                setValidationError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddInclusion())}
            />
            <button
              type="button"
              className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-700"
              onClick={handleAddInclusion}
            >
              Add
            </button>
          </div>
          <ul className="mt-3 space-y-1.5 text-xs text-neutral-300">
            {inclusions.map((inc, idx) => (
              <li key={`inc-${idx}`} className="flex items-center justify-between rounded bg-neutral-950 px-2.5 py-1.5 border border-neutral-800">
                <span>✓ {inc}</span>
                <button
                  type="button"
                  className="text-rose-400 hover:underline"
                  onClick={() => handleRemoveInclusion(idx)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>

        {/* Exclusions */}
        <div>
          <label className="block text-xs font-semibold text-neutral-300">Exclusions</label>
          <div className="mt-2 flex gap-2">
            <input
              type="text"
              className="flex-1 rounded-md border border-neutral-700 bg-neutral-950 px-3 py-1.5 text-xs text-neutral-100 focus:border-emerald-500 focus:outline-none"
              placeholder="e.g. Civil alterations & major plumbing work"
              value={newExc}
              onChange={(e) => {
                setNewExc(e.target.value);
                setValidationError(null);
              }}
              onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), handleAddExclusion())}
            />
            <button
              type="button"
              className="rounded-md bg-neutral-800 px-3 py-1.5 text-xs font-semibold text-neutral-200 hover:bg-neutral-700"
              onClick={handleAddExclusion}
            >
              Add
            </button>
          </div>
          <ul className="mt-3 space-y-1.5 text-xs text-neutral-300">
            {exclusions.map((exc, idx) => (
              <li key={`exc-${idx}`} className="flex items-center justify-between rounded bg-neutral-950 px-2.5 py-1.5 border border-neutral-800">
                <span>✕ {exc}</span>
                <button
                  type="button"
                  className="text-rose-400 hover:underline"
                  onClick={() => handleRemoveExclusion(idx)}
                >
                  ✕
                </button>
              </li>
            ))}
          </ul>
        </div>
      </div>

      {/* Terms & Conditions Text Block */}
      <div className="mt-6">
        <label className="block text-xs font-semibold text-neutral-300">Terms & Conditions</label>
        <textarea
          rows={4}
          className="mt-2 block w-full rounded-md border border-neutral-700 bg-neutral-950 p-3 text-xs text-neutral-100 focus:border-emerald-500 focus:outline-none font-mono"
          placeholder="e.g. Payment terms, validity, delivery schedules..."
          value={terms}
          onChange={(e) => {
            setTerms(e.target.value);
            setDirty(true);
            setValidationError(null);
          }}
        />
      </div>
    </div>
  );
}
