import type { Metadata } from "next";
import { safeVendorRedirect } from "@/features/commerce/vendor/vendor-auth";

export const metadata: Metadata = {
  title: "Vendor Sign In | ONEDECORE",
  description: "Secure ONEDECORE vendor catalogue access.",
  robots: { index: false, follow: false, nocache: true },
};

export default async function VendorLoginPage({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const next = safeVendorRedirect(typeof params.next === "string" ? params.next : undefined);
  const hasError = params.error === "invalid";
  return (
    <main className="flex min-h-screen items-center justify-center bg-[var(--od-bg)] px-4 py-10 text-[var(--od-text)]">
      <section className="w-full max-w-md rounded-[14px] border border-[var(--od-border)] bg-[var(--od-surface)] p-6 shadow-2xl sm:p-8">
        <div className="mb-8 text-center">
          <div className="font-serif text-2xl font-semibold tracking-tight">ONEDECORE</div>
          <h1 className="mt-6 text-xl font-semibold">Vendor Portal</h1>
          <p className="mt-2 text-sm text-[var(--od-muted)]">Manage product submissions sent to the OneDecore catalogue team.</p>
        </div>
        {hasError ? (
          <p className="mb-4 rounded-lg border border-red-400/20 bg-red-500/10 px-3 py-2 text-sm text-red-200">
            Sign-in failed or this account does not have active vendor access.
          </p>
        ) : null}
        <form method="post" action="/vendor/login/submit" className="space-y-4">
          <input type="hidden" name="next" value={next} />
          <label className="block text-xs font-medium text-[var(--od-text-2)]">
            Email
            <input name="email" type="email" autoComplete="username" required className="mt-1 min-h-11 w-full rounded-lg border border-[var(--od-border)] bg-[var(--od-elevated)] px-3 text-sm outline-none focus:border-[var(--od-gold)]" />
          </label>
          <label className="block text-xs font-medium text-[var(--od-text-2)]">
            Password
            <input name="password" type="password" autoComplete="current-password" required className="mt-1 min-h-11 w-full rounded-lg border border-[var(--od-border)] bg-[var(--od-elevated)] px-3 text-sm outline-none focus:border-[var(--od-gold)]" />
          </label>
          <button type="submit" className="min-h-11 w-full rounded-lg bg-[var(--od-gold)] px-4 text-sm font-semibold text-black transition hover:brightness-105">
            Sign in
          </button>
        </form>
        <p className="mt-6 text-center text-xs text-[var(--od-muted)]">Vendor accounts are created and controlled by OneDecore administration.</p>
      </section>
    </main>
  );
}
