"use client";

import { useActionState, useEffect } from "react";
import { useRouter } from "next/navigation";
import { LEAD_SERVICE_CODES } from "@/features/lead-intake/planner-allowlist";
import {
  MANUAL_LEAD_CATALOG_LABELS,
  type ManualCreateAssigneePolicy,
} from "@/features/crm/contracts/manual-lead-contracts.ts";
import type { CrmAssigneeDirectoryEntry } from "@/features/crm/contracts/lead-detail-dtos.ts";
import type { WhatsappCrmLeadCandidate } from "../../contracts/crm-integration.ts";
import { WHATSAPP_CRM_INITIAL_ACTION_STATE } from "../../contracts/crm-integration.ts";
import {
  createCrmLeadFromWhatsappConversationAction,
  linkWhatsappConversationToExistingLeadAction,
  searchWhatsappCrmLeadCandidatesAction,
} from "../../server/whatsapp-crm-actions.ts";

interface ConversationCrmResolutionProps {
  readonly conversationId: string;
  readonly customerE164: string;
  readonly displayName: string | null;
  readonly initialCandidates: readonly WhatsappCrmLeadCandidate[];
  readonly canCreateLead: boolean;
  readonly assigneePolicy: ManualCreateAssigneePolicy | null;
  readonly assignees: readonly CrmAssigneeDirectoryEntry[];
}

const fieldClass =
  "min-h-10 w-full rounded-lg border border-white/10 bg-black/20 px-3 text-sm text-slate-100 outline-none placeholder:text-slate-500 focus:border-emerald-400/60";

function bucketClass(bucket: WhatsappCrmLeadCandidate["salesBucket"]): string {
  if (bucket === "HOT") return "text-rose-300";
  if (bucket === "WARM") return "text-amber-300";
  if (bucket === "LOST") return "text-slate-500";
  return "text-sky-300";
}

export function ConversationCrmResolution({
  conversationId,
  customerE164,
  displayName,
  initialCandidates,
  canCreateLead,
  assigneePolicy,
  assignees,
}: ConversationCrmResolutionProps) {
  const router = useRouter();
  const [searchState, searchAction, searchPending] = useActionState(
    searchWhatsappCrmLeadCandidatesAction,
    WHATSAPP_CRM_INITIAL_ACTION_STATE
  );
  const [linkState, linkAction, linkPending] = useActionState(
    linkWhatsappConversationToExistingLeadAction,
    WHATSAPP_CRM_INITIAL_ACTION_STATE
  );
  const [createState, createAction, createPending] = useActionState(
    createCrmLeadFromWhatsappConversationAction,
    WHATSAPP_CRM_INITIAL_ACTION_STATE
  );

  useEffect(() => {
    if (linkState.success || createState.success) router.refresh();
  }, [createState.success, linkState.success, router]);

  const candidates = searchState.candidates ?? initialCandidates;
  const statusMessage = linkState.message || createState.message || searchState.message;
  const statusSuccess = linkState.success || createState.success || searchState.success;

  return (
    <div className="mt-3 space-y-4" data-testid="whatsapp-crm-resolution">
      <div className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
        <p className="text-xs font-semibold uppercase tracking-[0.08em] text-slate-400">
          Resolve CRM identity
        </p>
        <p className="mt-1 text-xs leading-5 text-slate-400">
          WhatsApp number: <span className="text-slate-200">{customerE164}</span>.
          {" "}Exact phone matches are shown first. Name/locality search never links automatically.
        </p>
        <form action={searchAction} className="mt-3 flex gap-2">
          <input type="hidden" name="conversationId" value={conversationId} />
          <input name="query" className={fieldClass} placeholder="Search lead name or locality" aria-label="Search CRM leads" />
          <button type="submit" className="od-wa__btn shrink-0" disabled={searchPending}>
            {searchPending ? "Searching…" : "Search"}
          </button>
        </form>
      </div>

      {candidates.length > 0 ? (
        <div className="space-y-2">
          {candidates.map((candidate) => (
            <form key={candidate.leadId} action={linkAction} className="rounded-xl border border-white/10 bg-black/10 p-3">
              <input type="hidden" name="conversationId" value={conversationId} />
              <input type="hidden" name="leadId" value={candidate.leadId} />
              <div className="flex items-start justify-between gap-3">
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-100">{candidate.name}</p>
                  <p className="mt-0.5 text-xs text-slate-400">
                    {candidate.status} · {candidate.service}{candidate.locality ? ` · ${candidate.locality}` : ""}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">Owner: {candidate.ownerLabel}</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className={`text-xs font-semibold ${bucketClass(candidate.salesBucket)}`}>{candidate.salesBucket}</p>
                  <p className="mt-1 text-[10px] uppercase tracking-wide text-slate-500">
                    {candidate.phoneMatch ? "Phone match" : "Manual match"}
                  </p>
                </div>
              </div>
              {!candidate.phoneMatch ? (
                <label className="mt-3 block text-xs text-slate-400">
                  Reason for linking a different number
                  <input name="reason" required minLength={5} maxLength={500} className={`${fieldClass} mt-1`} placeholder="e.g. Customer is messaging from an alternate number" />
                </label>
              ) : null}
              <button type="submit" className="od-wa__btn mt-3 w-full" disabled={linkPending}>
                {linkPending ? "Linking…" : "Link this CRM lead"}
              </button>
            </form>
          ))}
        </div>
      ) : (
        <p className="od-wa__empty-note">
          No visible CRM lead is linked to this number yet. Search by name/locality or create a new WhatsApp-source lead below.
        </p>
      )}

      {canCreateLead ? (
        <details className="rounded-xl border border-white/10 bg-white/[0.025] p-3">
          <summary className="cursor-pointer text-sm font-semibold text-slate-100">Create new CRM lead</summary>
          <form action={createAction} className="mt-3 space-y-3">
            <input type="hidden" name="conversationId" value={conversationId} />
            <label className="block text-xs text-slate-400">
              Client name
              <input name="submittedName" required minLength={2} maxLength={120} defaultValue={displayName ?? ""} className={`${fieldClass} mt-1`} placeholder="Client name" />
            </label>
            <label className="block text-xs text-slate-400">
              Service
              <select name="serviceCode" defaultValue="" className={`${fieldClass} mt-1`}>
                <option value="">Not specified</option>
                {LEAD_SERVICE_CODES.map((code) => (
                  <option key={code} value={code}>{MANUAL_LEAD_CATALOG_LABELS.service[code]}</option>
                ))}
              </select>
            </label>
            {assigneePolicy?.mode !== "executive_self" ? (
              <label className="block text-xs text-slate-400">
                Owner
                <select name="assigneeId" defaultValue="unassigned" className={`${fieldClass} mt-1`}>
                  <option value="unassigned">Unassigned</option>
                  {assigneePolicy?.mode === "manager" ? <option value="self">Assign to me</option> : null}
                  {assignees.map((entry) => (
                    <option key={entry.userId} value={entry.userId}>{entry.displayName}</option>
                  ))}
                </select>
              </label>
            ) : null}
            <p className="text-[11px] leading-5 text-slate-500">
              The phone number is taken from this WhatsApp conversation. CRM duplicate checks still apply. No marketing consent is assumed.
            </p>
            <button type="submit" className="od-wa__btn w-full" disabled={createPending}>
              {createPending ? "Creating…" : "Create & link CRM lead"}
            </button>
          </form>
        </details>
      ) : null}

      {statusMessage ? (
        <p role="status" className={`text-xs leading-5 ${statusSuccess ? "text-emerald-300" : "text-amber-300"}`}>
          {statusMessage}
          {createState.leadId && !createState.success ? (
            <>{" "}<a className="underline" href={`/admin/crm/leads/${createState.leadId}`}>Open lead</a></>
          ) : null}
        </p>
      ) : null}
    </div>
  );
}
