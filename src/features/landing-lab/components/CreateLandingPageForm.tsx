"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { createLandingPageAction } from "../server/landing-actions.ts";
import { buildSampleLandingBlocks } from "../fixtures/landing-fixtures.ts";

export function CreateLandingPageForm() {
  const router = useRouter();
  const [message, setMessage] = useState("");

  return (
    <form
      className="space-y-3 rounded-xl border border-neutral-800 p-4"
      action={async (formData) => {
        const result = await createLandingPageAction(formData);
        setMessage(result.message);
        if (result.success && result.data?.pageId) {
          router.push(`/admin/landing-pages/${result.data.pageId}`);
        }
      }}
    >
      <h2 className="text-sm font-medium text-neutral-100">Create landing page</h2>
      <div className="grid gap-3 sm:grid-cols-2">
        <input name="title" required placeholder="Title" className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" />
        <input name="slug" required placeholder="gurgaon-interiors" className="rounded border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm" />
      </div>
      <input type="hidden" name="versionLabel" value="Draft v1" />
      <input type="hidden" name="blocks" value={JSON.stringify(buildSampleLandingBlocks())} />
      <button className="rounded bg-amber-500 px-3 py-2 text-xs font-semibold text-neutral-950">Create draft</button>
      {message ? <p className="text-xs text-amber-200">{message}</p> : null}
    </form>
  );
}
