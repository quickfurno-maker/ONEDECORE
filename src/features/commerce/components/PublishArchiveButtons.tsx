"use client";

import { useState } from "react";
import { archiveCommerceProductAction, publishCommerceProductAction } from "../server/commerce-actions";

export function PublishArchiveButtons({
  productId,
  lockVersion,
  status,
  publicationReady,
}: {
  readonly productId: string;
  readonly lockVersion: number;
  readonly status: string;
  readonly publicationReady: boolean;
}) {
  const [message, setMessage] = useState<string | null>(null);

  return (
    <div className="space-y-3 rounded-xl border border-neutral-800 bg-neutral-900/60 p-4">
      <h2 className="text-sm font-semibold text-neutral-100">Publication</h2>
      <p className="text-xs text-neutral-400">
        Status: {status}. Readiness: {publicationReady ? "ready" : "not ready"}.
      </p>
      {message ? (
        <p role="status" aria-live="polite" className="text-sm text-amber-200">
          {message}
        </p>
      ) : null}
      <div className="flex flex-wrap gap-3">
        {status !== "archived" ? (
          <form
            action={async (formData) => {
              const result = await publishCommerceProductAction(formData);
              setMessage(result.message);
            }}
          >
            <input type="hidden" name="id" value={productId} />
            <input type="hidden" name="lockVersion" value={lockVersion} />
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-md bg-amber-500 px-3 py-2 text-xs font-semibold text-neutral-950"
            >
              Publish
            </button>
          </form>
        ) : null}
        {status !== "archived" ? (
          <form
            action={async (formData) => {
              const result = await archiveCommerceProductAction(formData);
              setMessage(result.message);
            }}
          >
            <input type="hidden" name="id" value={productId} />
            <input type="hidden" name="lockVersion" value={lockVersion} />
            <button
              type="submit"
              className="inline-flex min-h-11 items-center rounded-md border border-neutral-700 px-3 py-2 text-xs font-semibold text-neutral-200"
            >
              Archive
            </button>
          </form>
        ) : null}
      </div>
    </div>
  );
}
