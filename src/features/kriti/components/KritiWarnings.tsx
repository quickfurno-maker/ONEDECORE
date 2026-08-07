"use client";

interface KritiWarningsProps {
  readonly warnings: readonly string[];
  readonly humanReviewRequired?: boolean;
}

export function KritiWarnings({
  warnings,
  humanReviewRequired = false,
}: KritiWarningsProps) {
  if (warnings.length === 0 && !humanReviewRequired) {
    return null;
  }

  return (
    <div
      role="note"
      aria-label="Kriti warnings"
      className="space-y-2 rounded-md border border-amber-800/60 bg-amber-950/30 px-3 py-2 text-sm text-amber-100"
    >
      {humanReviewRequired ? (
        <p className="font-medium text-amber-200">
          Human review required before any customer-visible use.
        </p>
      ) : null}
      {warnings.length > 0 ? (
        <ul className="list-disc space-y-1 pl-5 text-amber-100/90">
          {warnings.map((warning) => (
            <li key={warning}>{warning}</li>
          ))}
        </ul>
      ) : null}
    </div>
  );
}
