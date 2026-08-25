"use client";

import { useId, useMemo, useState } from "react";
import Link from "next/link";
import { HOME_PUNE_AREAS } from "@/features/public-site/home-r4/claims";

type CoverageResult =
  | { readonly kind: "idle" }
  | { readonly kind: "match"; readonly area: (typeof HOME_PUNE_AREAS)[number] }
  | { readonly kind: "miss"; readonly query: string };

function normalize(value: string): string {
  return value.trim().toLowerCase().replace(/\s+/g, " ");
}

export function DiscoveryPuneCoverage() {
  const inputId = useId();
  const listId = useId();
  const [query, setQuery] = useState("");
  const [result, setResult] = useState<CoverageResult>({ kind: "idle" });

  const suggestions = useMemo(() => {
    const q = normalize(query);
    if (!q) return HOME_PUNE_AREAS.slice(0, 8);
    return HOME_PUNE_AREAS.filter((area) => normalize(area).includes(q)).slice(0, 8);
  }, [query]);

  function checkCoverage(raw: string) {
    const q = normalize(raw);
    if (!q) {
      setResult({ kind: "idle" });
      return;
    }
    const match = HOME_PUNE_AREAS.find((area) => normalize(area) === q);
    if (match) {
      setResult({ kind: "match", area: match });
      return;
    }
    setResult({ kind: "miss", query: raw.trim() });
  }

  return (
    <div className="od-disc-coverage">
      <form
        className="od-disc-coverage__form"
        onSubmit={(event) => {
          event.preventDefault();
          checkCoverage(query);
        }}
      >
        <label htmlFor={inputId} className="od-disc-coverage__label">
          Check your Pune locality
        </label>
        <div className="od-disc-coverage__row">
          <input
            id={inputId}
            list={listId}
            value={query}
            onChange={(event) => {
              setQuery(event.target.value);
              if (result.kind !== "idle") setResult({ kind: "idle" });
            }}
            placeholder="e.g. Kharadi, Baner, Wakad"
            autoComplete="address-level2"
            className="od-disc-coverage__input"
          />
          <datalist id={listId}>
            {HOME_PUNE_AREAS.map((area) => (
              <option key={area} value={area} />
            ))}
          </datalist>
          <button type="submit" className="od-disc-btn od-disc-btn--ghost od-disc-coverage__submit">
            Check
          </button>
        </div>
        {suggestions.length > 0 && query.trim() ? (
          <p className="od-disc-coverage__hint">Suggestions: {suggestions.slice(0, 4).join(" · ")}</p>
        ) : null}
      </form>
      <div className="od-disc-coverage__result" aria-live="polite">
        {result.kind === "match" ? (
          <p>
            Yes — we currently serve <strong>{result.area}</strong> for interior projects.
          </p>
        ) : null}
        {result.kind === "miss" ? (
          <p>
            This quick list does not include your locality yet. Share your Pune location with our
            team and we’ll confirm serviceability.
          </p>
        ) : null}
        {result.kind !== "idle" ? (
          <Link href="/interiors#consultation" className="od-disc-text-link">
            Book Free Consultation
          </Link>
        ) : null}
      </div>
    </div>
  );
}
