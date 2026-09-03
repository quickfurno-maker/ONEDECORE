"use client";

import { useActionState } from "react";
import { loginAction, type LoginState } from "./actions";

interface LoginFormProps {
  nextParam?: string;
}

const initialState: LoginState = {
  error: null,
};

export function LoginForm({ nextParam }: LoginFormProps) {
  const [state, formAction, isPending] = useActionState(loginAction, initialState);

  return (
    <form action={formAction} className="space-y-6" noValidate>
      {nextParam && <input type="hidden" name="next" value={nextParam} />}

      {state?.error && (
        <div
          role="alert"
          aria-live="polite"
          className="rounded-md border border-red-500/40 bg-red-950/30 p-3.5 text-xs font-medium text-red-200"
        >
          {state.error}
        </div>
      )}

      <div>
        <label
          htmlFor="identifier"
          className="block text-xs font-semibold uppercase tracking-wider text-amber-200/80"
        >
          Mobile Number or Email
        </label>
        <input
          id="identifier"
          name="identifier"
          type="text"
          inputMode="text"
          autoComplete="username"
          required
          maxLength={254}
          disabled={isPending}
          placeholder="7447863402"
          aria-describedby="identifier-hint"
          className="mt-2 block w-full rounded-md border border-neutral-700 bg-neutral-900/80 px-3.5 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 transition-colors focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 disabled:opacity-50"
        />
        <p id="identifier-hint" className="mt-2 text-[11px] leading-relaxed text-neutral-400">
          Staff sign in with their 10-digit mobile number. Do not add +91.
        </p>
      </div>

      <div>
        <label
          htmlFor="password"
          className="block text-xs font-semibold uppercase tracking-wider text-amber-200/80"
        >
          Password
        </label>
        <input
          id="password"
          name="password"
          type="password"
          autoComplete="current-password"
          required
          maxLength={128}
          disabled={isPending}
          placeholder="••••••••••••"
          className="mt-2 block w-full rounded-md border border-neutral-700 bg-neutral-900/80 px-3.5 py-2.5 text-sm text-neutral-100 placeholder-neutral-500 transition-colors focus:border-amber-400 focus:outline-none focus:ring-1 focus:ring-amber-400 disabled:opacity-50"
        />
      </div>

      <div>
        <button
          type="submit"
          disabled={isPending}
          className="w-full rounded-md bg-gradient-to-r from-amber-600 to-amber-500 px-4 py-3 text-xs font-bold uppercase tracking-widest text-neutral-950 transition-all hover:from-amber-500 hover:to-amber-400 focus:outline-none focus:ring-2 focus:ring-amber-400 focus:ring-offset-2 focus:ring-offset-neutral-950 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isPending ? "Authenticating..." : "Sign In to Staff Portal"}
        </button>
      </div>
    </form>
  );
}
