import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Access Forbidden | ONEDECORE Admin",
  description: "Access forbidden for current account credentials.",
};

export default function ForbiddenPage() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4 py-12 text-neutral-100">
      <div className="w-full max-w-md space-y-6 text-center rounded-xl border border-neutral-800 bg-neutral-900/60 p-8 shadow-2xl backdrop-blur-md">
        <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-full bg-amber-500/10 border border-amber-500/30">
          <svg
            className="h-6 w-6 text-amber-400"
            fill="none"
            stroke="currentColor"
            viewBox="0 0 24 24"
            aria-hidden="true"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth="2"
              d="M12 15v2m0-8v4m-6 9h12a2 2 0 002-2V7a2 2 0 00-2-2H6a2 2 0 00-2 2v10a2 2 0 002 2z"
            />
          </svg>
        </div>

        <div>
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
            Authorization Restrict
          </span>
          <h1 className="mt-2 font-serif text-2xl font-bold text-neutral-50">
            403 — Access Forbidden
          </h1>
          <p className="mt-2 text-xs text-neutral-400">
            Your authenticated staff account does not currently hold the active <code className="text-amber-300">admin.access</code> permission required to view the management shell.
          </p>
        </div>

        <form action="/auth/signout" method="POST" className="pt-2">
          <button
            type="submit"
            className="w-full rounded-md border border-neutral-700 bg-neutral-800 px-4 py-2.5 text-xs font-bold uppercase tracking-widest text-neutral-200 transition-colors hover:border-amber-400 hover:text-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400"
          >
            Sign Out & Return to Login
          </button>
        </form>
      </div>
    </main>
  );
}
