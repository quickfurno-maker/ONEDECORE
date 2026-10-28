"use client";

import { useActionState, useState } from "react";
import type { CrmLeadSourceOption } from "@/features/crm/contracts/lead-detail-dtos.ts";
import { addLeadImportSourceAction } from "@/features/crm/server/crm-import-actions.ts";
import type { LeadImportActionState } from "@/features/crm/contracts/lead-import-contracts.ts";

const INITIAL: LeadImportActionState = { success: false, message: "" };

export function ImportSourceManager({ sources }: { readonly sources: readonly CrmLeadSourceOption[] }) {
  const [state, action, pending] = useActionState(addLeadImportSourceAction, INITIAL);
  const [name, setName] = useState("");
  const [code, setCode] = useState("");
  return (
    <details id="import-source-manager" className="group rounded-xl border border-neutral-800 bg-neutral-950/70 p-4">
      <summary className="cursor-pointer text-sm font-semibold text-amber-300">
        Add Source in CRM <span className="ml-2 text-xs font-normal text-neutral-400">({sources.length} active sources)</span>
      </summary>
      <div className="mt-4 grid gap-5 lg:grid-cols-[1fr_1fr]">
        <form action={action} className="space-y-3">
          <p className="text-xs leading-5 text-neutral-400">Create a source once, then use its name in Excel. Unknown Excel names are rejected; they are never created automatically.</p>
          <label className="block text-xs font-medium text-neutral-300" htmlFor="import-new-source-name">Source name</label>
          <input id="import-new-source-name" name="sourceName" maxLength={120} minLength={2} required
            value={name} onChange={(event) => {
              const next = event.target.value;
              setName(next);
              setCode(next.toLowerCase().trim().replace(/[^a-z0-9]+/g, "_").replace(/^_+|_+$/g, "").slice(0,63));
            }}
            placeholder="Local Expo 2026"
            className="min-h-11 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-100"/>
          <label className="block text-xs font-medium text-neutral-300" htmlFor="import-new-source-code">Unique source code</label>
          <input id="import-new-source-code" name="sourceCode" required value={code} onChange={(event) => setCode(event.target.value)}
            pattern="[a-z][a-z0-9_]{1,63}" placeholder="local_expo_2026"
            className="min-h-11 w-full rounded-md border border-neutral-700 bg-neutral-900 px-3 text-sm text-neutral-100"/>
          {state.message ? <p role="status" className={state.success ? "text-sm text-emerald-300" : "text-sm text-rose-300"}>{state.message}</p> : null}
          <button type="submit" disabled={pending} className="min-h-11 rounded-md bg-amber-500 px-4 text-sm font-semibold text-neutral-950 disabled:opacity-40">
            {pending ? "Saving source..." : "Save new source"}
          </button>
        </form>
        <div className="space-y-2">
          <p className="text-xs font-semibold uppercase tracking-wide text-neutral-400">Available Excel Source values</p>
          <div className="flex max-h-56 flex-wrap content-start gap-2 overflow-y-auto">
            {sources.map((source) => <span key={source.id} className="rounded-md border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-300">{source.displayName}</span>)}
          </div>
          <p className="text-xs text-neutral-500">Download the template again after adding a source. Blank Source cells use the upload default.</p>
        </div>
      </div>
    </details>
  );
}
