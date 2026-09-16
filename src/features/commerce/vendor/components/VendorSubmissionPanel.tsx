"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { submitVendorProductAction } from "../vendor-actions";
import { vendorStatusLabel } from "../vendor-domain";

export function VendorSubmissionPanel({ productId, lockVersion, status, reviewNote, imageCount }: { productId: string; lockVersion: number; status: string; reviewNote: string | null; imageCount: number }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  const editable = status === "draft" || status === "changes_requested";
  return (
    <section className="rounded-xl border border-[var(--od-border)] bg-[var(--od-surface)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-[var(--od-muted)]">Review status</p><h2 className="mt-1 text-lg font-semibold">{vendorStatusLabel(status)}</h2></div>{editable ? <form action={async (formData) => { const result = await submitVendorProductAction(formData); setMessage(result.message); if (result.success) router.refresh(); }}><input type="hidden" name="productId" value={productId} /><input type="hidden" name="lockVersion" value={lockVersion} /><button type="submit" disabled={imageCount < 1} className="min-h-11 rounded-lg bg-[var(--od-gold)] px-4 text-sm font-semibold text-black disabled:cursor-not-allowed disabled:opacity-40">Submit for review</button></form> : null}</div>
      {status === "pending_review" ? <p className="mt-3 text-sm text-[var(--od-text-2)]">This product is locked while OneDecore reviews it.</p> : null}
      {status === "approved" ? <p className="mt-3 text-sm text-[var(--od-text-2)]">Approved. OneDecore will complete catalogue setup and publication separately.</p> : null}
      {status === "rejected" ? <p className="mt-3 text-sm text-red-300">This submission was rejected. Contact OneDecore if you need clarification.</p> : null}
      {reviewNote ? <div className="mt-4 rounded-lg border border-amber-400/20 bg-amber-500/10 p-3"><p className="text-xs font-medium text-amber-200">OneDecore note</p><p className="mt-1 text-sm text-amber-100">{reviewNote}</p></div> : null}
      {editable && imageCount < 1 ? <p className="mt-3 text-xs text-[var(--od-muted)]">Upload at least one product photo before submitting.</p> : null}
      {message ? <p role="status" className="mt-3 text-sm text-[var(--od-gold)]">{message}</p> : null}
    </section>
  );
}
