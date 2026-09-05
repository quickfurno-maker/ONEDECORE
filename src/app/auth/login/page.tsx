import type { Metadata } from "next";
import Link from "next/link";
import { getSafeAdminRedirect } from "@/server/auth/authorize";
import { LOGIN_ERROR_CODE } from "@/features/staff-admin/server/staff-login-submit";
import {
  LOGIN_PORTALS,
  LOGIN_PORTAL_COPY,
  loginPortalHref,
  normaliseLoginPortal,
} from "@/features/staff-admin/contracts/login-portal";
import { LoginForm } from "./login-form";

export const metadata: Metadata = {
  title: "Sign In | ONEDECORE",
  description: "Secure authentication for authorized ONEDECORE personnel.",
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
   * Which identity contract this page is presenting.
   *
   * Resolved on the SERVER, so the correct portal is in the first HTML response
   * — the selector below is a pair of ordinary links, and the whole page works
   * with JavaScript disabled. An unrecognised value collapses to the default
   * rather than being echoed anywhere.
   */
  const portal = normaliseLoginPortal(
    typeof resolvedParams.portal === "string" ? resolvedParams.portal : undefined
  );
  const copy = LOGIN_PORTAL_COPY[portal];
  const otherPortal = portal === "admin" ? "staff" : "admin";

  /*
   * Exactly ONE recognised failure code, rendered as one fixed message.
   *
   * Any other value renders no error at all, and nothing from the query string
   * is ever echoed into the page: a per-reason code would let the form be used
   * to enumerate which staff numbers exist. The message itself is per-portal
   * wording only — it still never says which half of the credential was wrong.
   */
  const hasError = resolvedParams.error === LOGIN_ERROR_CODE;

  return (
    <main className="flex min-h-screen flex-col items-center justify-center bg-neutral-950 px-4 py-10 text-neutral-100 sm:py-12">
      <div className="w-full max-w-md space-y-6 rounded-xl border border-neutral-800 bg-neutral-900/60 p-5 shadow-2xl backdrop-blur-md sm:space-y-8 sm:p-8">
        <div className="text-center">
          <span className="text-xs font-bold uppercase tracking-widest text-amber-400">
            {copy.brand}
          </span>
          <h1 className="mt-2 font-serif text-2xl font-bold tracking-tight text-neutral-50 sm:text-3xl">
            {copy.heading}
          </h1>
          <p className="mt-2 text-xs text-neutral-400">{copy.description}</p>
        </div>

        {/*
         * The portal selector: two ordinary links, not a client-side toggle.
         *
         * Each one is a full navigation to a server-rendered page, so the input
         * type, the labels and the submitted `portal` field always agree with
         * what is on screen — including before hydration, and with JavaScript
         * off entirely. The `next` destination is carried across; the error is
         * NOT, because a failure belongs to the portal that produced it.
         */}
        <nav aria-label="Choose a sign-in portal" className="grid grid-cols-2 gap-2">
          {LOGIN_PORTALS.map((candidate) => {
            const isActive = candidate === portal;
            return (
              <Link
                key={candidate}
                href={loginPortalHref(candidate, nextParam)}
                aria-current={isActive ? "page" : undefined}
                data-portal-option={candidate}
                /*
                 * `min-h-11` is 44px: the minimum comfortable touch target, and
                 * a floor that does not depend on the font metrics of an 11px
                 * uppercase label. The content is centred inside it rather than
                 * padded out, so the card does not grow bulky on a small phone.
                 */
                className={
                  isActive
                    ? "flex min-h-11 items-center justify-center rounded-md border border-amber-400/70 bg-amber-500/10 px-3 py-2.5 text-center text-[11px] font-bold uppercase tracking-wider text-amber-300 sm:text-xs"
                    : "flex min-h-11 items-center justify-center rounded-md border border-neutral-700 bg-neutral-900/60 px-3 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-neutral-400 transition-colors hover:border-neutral-600 hover:text-neutral-200 sm:text-xs"
                }
              >
                {LOGIN_PORTAL_COPY[candidate].selectorLabel}
              </Link>
            );
          })}
        </nav>

        <LoginForm portal={portal} nextParam={nextParam} hasError={hasError} />

        {/*
         * The same escape hatch in words, for anyone who read past the tabs.
         * It is a real tap target too, not a hairline of text: 44px tall, with
         * the link filling the row rather than only its own glyphs.
         */}
        <p className="text-center">
          <Link
            href={loginPortalHref(otherPortal, nextParam)}
            className="inline-flex min-h-11 items-center justify-center px-3 text-[11px] font-medium text-neutral-400 underline decoration-neutral-700 underline-offset-4 transition-colors hover:text-amber-300"
          >
            {copy.switchLabel}
          </Link>
        </p>

        <div className="border-t border-neutral-800 pt-4 text-center">
          <p className="text-[11px] text-neutral-500">
            Restricted System — Unauthorized access attempts are monitored and logged.
          </p>
        </div>
      </div>
    </main>
  );
}
