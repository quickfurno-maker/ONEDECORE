import type { Metadata } from "next";
import { getSafeAdminRedirect } from "@/server/auth/authorize";
import { LOGIN_ERROR_CODE } from "@/features/staff-admin/server/staff-login-submit";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Staff Authentication | ONEDECORE Admin",
  description: "Secure authentication portal for authorized ONEDECORE staff personnel.",
};

interface LoginPageProps {
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}

export default async function LoginPage({ searchParams }: LoginPageProps) {
  const resolvedParams = await searchParams;
  const rawNext = typeof resolvedParams.next === "string" ? resolvedParams.next : undefined;

  /*
   * `next` is re-validated HERE as well as at the submit route. It arrives in a
   * URL anyone can craft, and it is rendered back into a hidden form field, so
   * the page must not carry an off-site or otherwise unsafe value forward.
   * `getSafeAdminRedirect` collapses anything that is not an /admin path.
   */
  const safeNext = getSafeAdminRedirect(rawNext);
  const nextParam = safeNext === "/admin" ? undefined : safeNext;

  /*
   * Exactly ONE recognised failure code, rendered as one fixed message.
   *
   * Any other value renders no error at all, and nothing from the query string
   * is ever echoed into the page: a per-reason code would let the form be used
   * to enumerate which staff numbers exist.
   */
  const hasError = resolvedParams.error === LOGIN_ERROR_CODE;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4 py-12 text-neutral-100">
      <div className="w-full max-w-md space-y-8 rounded-xl border border-neutral-800 bg-neutral-900/60 p-8 shadow-2xl backdrop-blur-md">
        <div className="text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
            ONEDECORE Staff Portal
          </span>
          <h1 className="mt-2 font-serif text-2xl font-bold tracking-tight text-neutral-50 sm:text-3xl">
            Staff Authentication
          </h1>
          <p className="mt-2 text-xs text-neutral-400">
            Enter authorized staff credentials to access the internal management portal.
          </p>
        </div>

        <LoginForm nextParam={nextParam} hasError={hasError} />

        <div className="border-t border-neutral-800 pt-4 text-center">
          <p className="text-[11px] text-neutral-500">
            Restricted System — Unauthorized access attempts are monitored and logged.
          </p>
        </div>
      </div>
    </main>
  );
}
