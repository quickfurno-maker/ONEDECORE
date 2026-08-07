"use client";

interface WhatsappInboxErrorProps {
  readonly error: Error & { digest?: string };
  readonly reset: () => void;
}

export default function WhatsappInboxError({
  error,
  reset,
}: WhatsappInboxErrorProps) {
  return (
    <section className="rounded-lg border border-amber-500/30 bg-amber-500/5 px-4 py-6">
      <h2 className="text-lg font-semibold text-amber-200">
        Could not load inbox
      </h2>
      <p className="mt-2 text-sm text-neutral-300">{error.message}</p>
      <button
        type="button"
        onClick={reset}
        className="mt-4 inline-flex min-h-11 items-center rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200"
      >
        Try again
      </button>
    </section>
  );
}
