"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createCampaignDraftAction } from "../server/campaign-actions";
import { PrebuildBanner } from "./PrebuildBanner";

const DEFAULT_RULE = JSON.stringify({
  logic: "and",
  rules: [{ field: "lead_stage", operator: "in", values: ["qualified"] }],
});

export function CampaignCreateForm() {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);

  return (
    <form
      className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4"
      action={async (formData) => {
        const result = await createCampaignDraftAction(formData);
        setMessage(result.message);
        if (result.success && result.data?.campaignId) {
          router.push(`/admin/campaigns/${result.data.campaignId}`);
        }
      }}
    >
      <PrebuildBanner />
      <h2 className="text-sm font-semibold text-neutral-100">Create campaign draft</h2>
      <label className="block text-xs text-neutral-400">
        Name
        <input name="name" required minLength={2} maxLength={160} className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100" />
      </label>
      <label className="block text-xs text-neutral-400">
        Title
        <input name="title" required minLength={2} maxLength={160} className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100" />
      </label>
      <label className="block text-xs text-neutral-400">
        Targeting
        <select name="targetingMode" className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100">
          <option value="broad_public">broad_public</option>
          <option value="direct_or_custom">direct_or_custom</option>
        </select>
      </label>
      <label className="block text-xs text-neutral-400">
        Intended channels (comma-separated)
        <input name="intendedChannels" defaultValue="email,whatsapp" className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100" />
      </label>
      <label className="block text-xs text-neutral-400">
        Opaque destination reference
        <input name="destinationReference" maxLength={500} className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100" />
      </label>
      <div className="grid gap-3 sm:grid-cols-2">
        <label className="block text-xs text-neutral-400">
          Daily budget (paise)
          <input name="dailyBudgetPaise" type="number" min={0} defaultValue={0} className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100" />
        </label>
        <label className="block text-xs text-neutral-400">
          Total budget (paise)
          <input name="totalBudgetPaise" type="number" min={0} className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100" />
        </label>
        <label className="block text-xs text-neutral-400">
          Window start
          <input name="startDate" type="date" required className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100" />
        </label>
        <label className="block text-xs text-neutral-400">
          Window end
          <input name="endDate" type="date" className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100" />
        </label>
      </div>
      <label className="block text-xs text-neutral-400">
        Headline
        <input name="headline" required maxLength={200} className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100" />
      </label>
      <label className="block text-xs text-neutral-400">
        Primary text
        <textarea name="primaryText" required maxLength={4000} className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100" />
      </label>
      <label className="block text-xs text-neutral-400">
        Call to action
        <input name="callToAction" required maxLength={120} className="mt-1 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100" />
      </label>
      <label className="block text-xs text-neutral-400">
        Audience rule JSON
        <textarea
          name="ruleGroup"
          defaultValue={DEFAULT_RULE}
          className="mt-1 min-h-24 w-full rounded border border-neutral-700 bg-neutral-950 px-3 py-2 font-mono text-sm text-neutral-100"
        />
      </label>
      {message ? (
        <p role="status" aria-live="polite" className="text-sm text-amber-200">
          {message}
        </p>
      ) : null}
      <button type="submit" className="rounded-md bg-emerald-700 px-3 py-2 text-sm text-white">
        Create draft
      </button>
    </form>
  );
}
