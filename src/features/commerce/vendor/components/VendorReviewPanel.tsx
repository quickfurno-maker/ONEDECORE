"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { reviewVendorCommerceProductAction } from "../vendor-admin-actions";

export function VendorReviewPanel({ productId, lockVersion, status, vendorName, vendorCode, reviewNote, categoryAssigned }: { productId: string; lockVersion: number; status: string | null; vendorName: string | null; vendorCode: string | null; reviewNote: string | null; categoryAssigned: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  if (!status) return null;
  const pending = status === "pending_review";
  return (
    <section className="rounded-xl border border-[var(--od-border)] bg-[var(--od-surface)] p-5">
      <div className="flex flex-wrap items-start justify-between gap-3"><div><p className="text-xs text-[var(--od-muted)]">Vendor submission</p><h2 className="mt-1 text-base font-semibold">{vendorName ?? "Vendor"} <span className="font-normal text-[var(--od-muted)]">{vendorCode ?? ""}</span></h2></div><span className="rounded-full border border-[var(--od-border)] px-2.5 py-1 text-xs capitalize">{status.replaceAll("_", " ")}</span></div>
      {reviewNote ? <p className="mt-3 rounded-lg bg-[var(--od-elevated)] p-3 text-sm text-[var(--od-text-2)]">Previous note: {reviewNote}</p> : null}
      {pending ? <form className="mt-4 space-y-3" action={async (formData) => { const result = await reviewVendorCommerceProductAction(formData); setMessage(result.message); if (result.success) router.refresh(); }}><input type="hidden" name="productId" value={productId} /><input type="hidden" name="lockVersion" value={lockVersion} /><label className="block text-xs text-[var(--od-text-2)]">Review note<textarea name="note" rows={3} className="mt-1 w-full rounded-lg border border-[var(--od-border)] bg-[var(--od-elevated)] p-3 text-sm" placeholder="Required for changes or rejection" /></label><div className="flex flex-wrap gap-2"><button name="decision" value="approve" disabled={!categoryAssigned} className="min-h-10 rounded-lg bg-emerald-500 px-4 text-sm font-semibold text-black disabled:opacity-40">Approve</button><button name="decision" value="request_changes" className="min-h-10 rounded-lg border border-amber-400/30 px-4 text-sm text-amber-200">Request changes</button><button name="decision" value="reject" className="min-h-10 rounded-lg border border-red-400/30 px-4 text-sm text-red-200">Reject</button></div>{!categoryAssigned ? <p className="text-xs text-amber-200">Assign an active category in General before approval.</p> : null}</form> : null}
      {message ? <p role="status" className="mt-3 text-sm text-[var(--od-gold)]">{message}</p> : null}
    </section>
  );
}
