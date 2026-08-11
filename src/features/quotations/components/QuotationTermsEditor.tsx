"use client";

import { useState } from "react";
import type { QuotationVersionDTO } from "../contracts/types";

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

  const handleAddInclusion = () => {
    if (!newInc.trim()) return;
    setInclusions([...inclusions, newInc.trim()]);
    setNewInc("");
    setDirty(true);
  };

  const handleRemoveInclusion = (idx: number) => {
    setInclusions(inclusions.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const handleAddExclusion = () => {
    if (!newExc.trim()) return;
    setExclusions([...exclusions, newExc.trim()]);
    setNewExc("");
    setDirty(true);
  };

  const handleRemoveExclusion = (idx: number) => {
    setExclusions(exclusions.filter((_, i) => i !== idx));
    setDirty(true);
  };

  const handleSave = () => {
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
              onChange={(e) => setNewInc(e.target.value)}
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
              onChange={(e) => setNewExc(e.target.value)}
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
        <label className="block text-xs font-semibold text-neutral-300">Terms & Conditions (Text Block)</label>
        <textarea
          rows={4}
          className="mt-2 block w-full rounded-md border border-neutral-700 bg-neutral-950 p-3 text-xs text-neutral-100 focus:border-emerald-500 focus:outline-none font-mono"
          placeholder="Enter commercial terms, payment deadlines, validity period, and delivery policies..."
          value={terms}
          onChange={(e) => {
            setTerms(e.target.value);
            setDirty(true);
          }}
        />
      </div>
    </div>
  );
}
