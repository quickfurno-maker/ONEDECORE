"use client";

import { useState } from "react";
import {
  createNextCampaignVersionAction,
  decideCampaignVersionAction,
  requestCampaignApprovalAction,
  saveCampaignDraftAction,
} from "../server/campaign-actions";
import type { CampaignVersionDetail } from "../server/campaign-queries";
import { PrebuildBanner } from "./PrebuildBanner";
import { canApproveCampaignVersion, isCampaignSelfApproval } from "../domain/campaign-capabilities";
import type { CrmRoleCode } from "../../crm/contracts/permissions";

interface CampaignVersionFormsProps {
  readonly campaignId: string;
  readonly actorProfileId: string;
  readonly role: CrmRoleCode;
  readonly canDraft: boolean;
  readonly canRequest: boolean;
  readonly canApprove: boolean;
  readonly versions: readonly CampaignVersionDetail[];
}

export function CampaignVersionForms({
  campaignId,
  actorProfileId,
  role,
  canDraft,
  canRequest,
  canApprove,
  versions,
}: CampaignVersionFormsProps) {
  const [message, setMessage] = useState<string | null>(null);
  const current = [...versions].sort((a, b) => b.versionNumber - a.versionNumber)[0];
  if (!current) return null;

  const actor = {
    profileId: actorProfileId,
    role,
    isVersionCreator: current.createdBy === actorProfileId,
    isVersionRequester: current.requestedBy === actorProfileId,
  };
  const selfApproval = isCampaignSelfApproval(actor);
  const showApprove = canApprove && current.status === "pending_approval" && canApproveCampaignVersion(actor);

  return (
    <div className="space-y-4">
      <PrebuildBanner />
      {message ? (
        <p role="status" aria-live="polite" className="text-sm text-amber-200">
          {message}
        </p>
      ) : null}

      {current.status === "draft" && canDraft ? (
        <form
          className="space-y-3 rounded-xl border border-neutral-800 p-4"
          action={async (formData) => {
            const result = await saveCampaignDraftAction(formData);
            setMessage(result.message);
          }}
        >
          <h3 className="text-sm font-semibold text-neutral-100">Edit draft</h3>
          <input type="hidden" name="campaignId" value={campaignId} />
          <input type="hidden" name="campaignVersionId" value={current.id} />
          <input type="hidden" name="lockVersion" value={current.lockVersion} />
          <label className="block text-xs text-neutral-400">
            Audience rule JSON
            <textarea
              name="ruleGroup"
              defaultValue={JSON.stringify(current.ruleGroup ?? { logic: "and", rules: [] })}
              className="mt-1 min-h-24 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-sm text-neutral-100"
            />
          </label>
          <label className="block text-xs text-neutral-400">
            Title
            <input name="title" defaultValue={current.title} className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100" />
          </label>
          <label className="block text-xs text-neutral-400">
            Targeting
            <select name="targetingMode" defaultValue={current.targetingMode} className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100">
              <option value="broad_public">broad_public</option>
              <option value="direct_or_custom">direct_or_custom</option>
            </select>
          </label>
          <label className="block text-xs text-neutral-400">
            Intended channels
            <input name="intendedChannels" defaultValue={current.intendedChannels.join(",")} className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100" />
          </label>
          <label className="block text-xs text-neutral-400">
            Destination reference
            <input name="destinationReference" defaultValue={current.destinationReference ?? ""} className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100" />
          </label>
          <input type="hidden" name="dailyBudgetPaise" value={String(current.budgetSnapshot.daily_budget_paise ?? 0)} />
          <input type="hidden" name="totalBudgetPaise" value={current.budgetSnapshot.total_budget_paise == null ? "" : String(current.budgetSnapshot.total_budget_paise)} />
          <input type="hidden" name="startDate" value={String(current.intendedWindowSnapshot.start_date ?? "")} />
          <input type="hidden" name="endDate" value={String(current.intendedWindowSnapshot.end_date ?? "")} />
          <input type="hidden" name="headline" value={String(current.creativeSnapshot.headline ?? "")} />
          <input type="hidden" name="primaryText" value={String(current.creativeSnapshot.primary_text ?? "")} />
          <input type="hidden" name="callToAction" value={String(current.creativeSnapshot.call_to_action ?? "")} />
          <button type="submit" className="rounded-md border border-neutral-600 px-3 py-2 text-sm">
            Save draft
          </button>
        </form>
      ) : null}

      {current.status === "draft" && canRequest ? (
        <form
          action={async (formData) => {
            const result = await requestCampaignApprovalAction(formData);
            setMessage(result.message);
          }}
        >
          <input type="hidden" name="campaignId" value={campaignId} />
          <input type="hidden" name="campaignVersionId" value={current.id} />
          <input type="hidden" name="lockVersion" value={current.lockVersion} />
          <button type="submit" className="rounded-md bg-emerald-700 px-3 py-2 text-sm text-white">
            Request approval
          </button>
        </form>
      ) : null}

      {current.status === "pending_approval" ? (
        <div className="space-y-3 rounded-xl border border-neutral-800 p-4">
          <h3 className="text-sm font-semibold text-neutral-100">Decision</h3>
          {selfApproval ? (
            <p role="status" className="text-sm text-amber-200">
              Sales Manager cannot self-approve this campaign version. Database authority still applies.
            </p>
          ) : null}
          {showApprove ? (
            <form
              className="space-y-2"
              action={async (formData) => {
                const result = await decideCampaignVersionAction(formData);
                setMessage(result.message);
              }}
            >
              <input type="hidden" name="campaignId" value={campaignId} />
              <input type="hidden" name="campaignVersionId" value={current.id} />
              <label className="block text-xs text-neutral-400">
                Reason (required for rejection, 8–1000 characters)
                <textarea name="reason" className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100" />
              </label>
              <div className="flex gap-2">
                <button name="decision" value="approved" type="submit" className="rounded-md bg-emerald-700 px-3 py-2 text-sm text-white">
                  Approve
                </button>
                <button name="decision" value="rejected" type="submit" className="rounded-md border border-red-700 px-3 py-2 text-sm text-red-200">
                  Reject
                </button>
              </div>
            </form>
          ) : null}
        </div>
      ) : null}

      {(current.status === "approved" || current.status === "rejected") && canDraft ? (
        <form
          action={async (formData) => {
            const result = await createNextCampaignVersionAction(formData);
            setMessage(result.message);
          }}
        >
          <input type="hidden" name="campaignId" value={campaignId} />
          <button type="submit" className="rounded-md border border-neutral-600 px-3 py-2 text-sm">
            Create next version
          </button>
        </form>
      ) : null}
    </div>
  );
}
