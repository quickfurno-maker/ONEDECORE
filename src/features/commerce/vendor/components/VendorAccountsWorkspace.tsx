"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import type { CommerceVendorAdminRow } from "../vendor-admin-queries";
import {
  createCommerceVendorAccountAction,
  resetCommerceVendorPasswordAction,
  setCommerceVendorStatusAction,
} from "../vendor-admin-actions";

const inputClass =
  "min-h-10 rounded-lg border border-[var(--od-border)] bg-[var(--od-elevated)] px-3 text-sm outline-none focus:border-[var(--od-gold)]";

function PasswordPair({ prefix }: { prefix: string }) {
  const [visible, setVisible] = useState(false);
  const type = visible ? "text" : "password";
  return (
    <div className="grid gap-2 sm:grid-cols-2">
      <label className="text-xs text-[var(--od-text-2)]">
        {prefix} password
        <input
          name="password"
          type={type}
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          required
          className={`mt-1 w-full ${inputClass}`}
        />
      </label>
      <label className="text-xs text-[var(--od-text-2)]">
        Confirm {prefix.toLowerCase()} password
        <input
          name="passwordConfirmation"
          type={type}
          minLength={12}
          maxLength={128}
          autoComplete="new-password"
          required
          className={`mt-1 w-full ${inputClass}`}
        />
      </label>
      <div className="sm:col-span-2 flex flex-wrap items-center justify-between gap-2">
        <p className="text-[11px] text-[var(--od-muted)]">
          12–128 characters. Leading or trailing spaces are not allowed.
        </p>
        <button
          type="button"
          onClick={() => setVisible((value) => !value)}
          className="min-h-9 rounded-lg border border-[var(--od-border)] px-3 text-xs font-medium"
          aria-pressed={visible}
        >
          {visible ? "Hide passwords" : "Show passwords"}
        </button>
      </div>
    </div>
  );
}

export function VendorAccountsWorkspace({ vendors }: { vendors: readonly CommerceVendorAdminRow[] }) {
  const router = useRouter();
  const [message, setMessage] = useState<string | null>(null);
  return (
    <div className="space-y-6">
      <form
        className="space-y-4 rounded-xl border border-[var(--od-border)] bg-[var(--od-surface)] p-5"
        action={async (formData) => {
          const result = await createCommerceVendorAccountAction(formData);
          setMessage(
            result.success && result.data?.vendorCode
              ? `${result.message} ${result.data.vendorCode}`
              : result.message
          );
          if (result.success) router.refresh();
        }}
      >
        <div className="grid gap-3 lg:grid-cols-2">
          <label className="text-xs text-[var(--od-text-2)]">
            Vendor name
            <input name="displayName" required minLength={2} maxLength={160} className={`mt-1 w-full ${inputClass}`} />
          </label>
          <label className="text-xs text-[var(--od-text-2)]">
            Login email
            <input name="email" type="email" autoComplete="off" required className={`mt-1 w-full ${inputClass}`} />
          </label>
        </div>
        <PasswordPair prefix="Initial" />
        <button className="min-h-10 rounded-lg bg-[var(--od-gold)] px-4 text-sm font-semibold text-black">
          Create vendor
        </button>
      </form>
      {message ? <p role="status" className="text-sm text-[var(--od-gold)]">{message}</p> : null}
      <div className="overflow-hidden rounded-xl border border-[var(--od-border)] bg-[var(--od-surface)]">
        {vendors.length === 0 ? (
          <p className="p-8 text-sm text-[var(--od-muted)]">No commerce vendors yet.</p>
        ) : (
          <div className="divide-y divide-[var(--od-border)]">
            {vendors.map((vendor) => (
              <article key={vendor.id} className="p-4">
                <div className="flex flex-wrap items-start justify-between gap-3">
                  <div>
                    <h2 className="text-sm font-semibold">{vendor.displayName}</h2>
                    <p className="mt-1 text-xs text-[var(--od-muted)]">
                      {vendor.vendorCode} · {vendor.email ?? vendor.userId}
                    </p>
                  </div>
                  <span className="rounded-full border border-[var(--od-border)] px-2.5 py-1 text-xs capitalize">
                    {vendor.status}
                  </span>
                </div>
                <div className="mt-4 flex flex-wrap gap-2">
                  {vendor.status !== "active" ? (
                    <form action={async (formData) => {
                      const result = await setCommerceVendorStatusAction(formData);
                      setMessage(result.message);
                      if (result.success) router.refresh();
                    }}>
                      <input type="hidden" name="vendorId" value={vendor.id} />
                      <input type="hidden" name="status" value="active" />
                      <button className="min-h-9 rounded-lg border border-[var(--od-border)] px-3 text-xs">Activate</button>
                    </form>
                  ) : null}
                  {vendor.status === "active" ? (
                    <form action={async (formData) => {
                      const result = await setCommerceVendorStatusAction(formData);
                      setMessage(result.message);
                      if (result.success) router.refresh();
                    }}>
                      <input type="hidden" name="vendorId" value={vendor.id} />
                      <input type="hidden" name="status" value="suspended" />
                      <button className="min-h-9 rounded-lg border border-amber-400/30 px-3 text-xs text-amber-200">Suspend</button>
                    </form>
                  ) : null}
                  {vendor.status !== "disabled" ? (
                    <form action={async (formData) => {
                      const result = await setCommerceVendorStatusAction(formData);
                      setMessage(result.message);
                      if (result.success) router.refresh();
                    }}>
                      <input type="hidden" name="vendorId" value={vendor.id} />
                      <input type="hidden" name="status" value="disabled" />
                      <button className="min-h-9 rounded-lg border border-red-400/30 px-3 text-xs text-red-200">Disable</button>
                    </form>
                  ) : null}
                </div>
                <form
                  className="mt-4 space-y-3 rounded-lg border border-[var(--od-border)] p-3"
                  action={async (formData) => {
                    const result = await resetCommerceVendorPasswordAction(formData);
                    setMessage(result.message);
                  }}
                >
                  <input type="hidden" name="vendorId" value={vendor.id} />
                  <PasswordPair prefix="New" />
                  <button className="min-h-9 rounded-lg border border-[var(--od-border)] px-3 text-xs font-medium">
                    Reset password
                  </button>
                </form>
                <p className="mt-3 break-all text-[11px] text-[var(--od-muted)]">
                  Auth user: {vendor.userId}
                </p>
              </article>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
