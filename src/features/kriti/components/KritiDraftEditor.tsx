"use client";

interface KritiDraftEditorProps {
  readonly draftText: string;
  readonly readOnly?: boolean;
  readonly label?: string;
  readonly onChange?: (value: string) => void;
}

export function KritiDraftEditor({
  draftText,
  readOnly = false,
  label = "Editable draft",
  onChange,
}: KritiDraftEditorProps) {
  return (
    <label className="block text-sm text-neutral-200">
      <span className="mb-1 block text-xs uppercase tracking-wide text-neutral-500">
        {label}
      </span>
      <textarea
        value={draftText}
        readOnly={readOnly}
        rows={6}
        onChange={(event) => onChange?.(event.target.value)}
        className="w-full rounded-md border border-neutral-700 bg-neutral-950 px-3 py-2 text-sm text-neutral-100 placeholder:text-neutral-500 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-emerald-400 read-only:opacity-80"
        aria-label={label}
      />
    </label>
  );
}
