"use client";

import type { KritiProviderMode } from "../contracts/provider.ts";

interface KritiProviderStatusProps {
  readonly mode: KritiProviderMode;
}

const MODE_LABELS: Record<KritiProviderMode, string> = {
  disabled: "Disabled (default)",
  "local-test": "Local test (deterministic fake)",
  enabled: "Enabled (server Groq adapter)",
};

export function KritiProviderStatus({ mode }: KritiProviderStatusProps) {
  const tone =
    mode === "disabled"
      ? "border-neutral-700 text-neutral-400"
      : mode === "local-test"
        ? "border-amber-700/60 text-amber-200"
        : "border-emerald-700/60 text-emerald-200";

  return (
    <p
      role="status"
      className={`rounded-md border px-3 py-2 text-xs ${tone}`}
      aria-live="polite"
    >
      Kriti provider: {MODE_LABELS[mode]}. Assistance requires staff review; no
      auto-send or business mutations.
    </p>
  );
}
