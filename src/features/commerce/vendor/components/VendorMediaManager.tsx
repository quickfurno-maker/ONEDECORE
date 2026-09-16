"use client";
/* eslint-disable @next/next/no-img-element -- private vendor media previews use runtime storage URLs */

import { useRouter } from "next/navigation";
import { useState } from "react";
import { archiveVendorProductMediaAction, uploadVendorProductMediaAction } from "../vendor-actions";

export interface VendorMediaItem {
  readonly id: string;
  readonly url: string | null;
  readonly isPrimary: boolean;
}

export function VendorMediaManager({ productId, media, editable }: { productId: string; media: readonly VendorMediaItem[]; editable: boolean }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <section className="space-y-4 rounded-xl border border-[var(--od-border)] bg-[var(--od-surface)] p-5">
      <div><h2 className="text-sm font-semibold">Product photos</h2><p className="mt-1 text-xs text-[var(--od-muted)]">JPEG, PNG or WebP. OneDecore sanitizes and creates the public derivative.</p></div>
      {media.length ? <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">{media.map((item) => <div key={item.id} className="overflow-hidden rounded-lg border border-[var(--od-border)] bg-[var(--od-elevated)]">{item.url ? <img src={item.url} alt="Vendor product" className="aspect-square w-full object-cover" /> : <div className="flex aspect-square items-center justify-center text-xs text-[var(--od-muted)]">Image processing</div>}<div className="flex items-center justify-between gap-2 p-3"><span className="text-xs text-[var(--od-muted)]">{item.isPrimary ? "Primary" : "Gallery"}</span>{editable ? <form action={async (formData) => { const result = await archiveVendorProductMediaAction(formData); setMessage(result.message); if (result.success) router.refresh(); }}><input type="hidden" name="mediaId" value={item.id} /><input type="hidden" name="productId" value={productId} /><button className="text-xs text-red-300">Remove</button></form> : null}</div></div>)}</div> : <p className="text-sm text-[var(--od-muted)]">No photos uploaded yet.</p>}
      {editable ? <form className="flex flex-col gap-3 sm:flex-row sm:items-end" action={async (formData) => { const result = await uploadVendorProductMediaAction(formData); setMessage(result.message); if (result.success) router.refresh(); }} encType="multipart/form-data"><input type="hidden" name="productId" value={productId} /><label className="block flex-1 text-xs text-[var(--od-text-2)]">Add photo<input type="file" name="file" accept="image/jpeg,image/png,image/webp" required className="mt-1 block min-h-11 w-full rounded-lg border border-[var(--od-border)] bg-[var(--od-elevated)] px-3 py-2 text-sm" /></label><button type="submit" className="min-h-11 rounded-lg border border-[var(--od-border)] px-4 text-sm font-medium hover:bg-[var(--od-hover)]">Upload</button></form> : null}
      {message ? <p role="status" className="text-sm text-[var(--od-gold)]">{message}</p> : null}
    </section>
  );
}
