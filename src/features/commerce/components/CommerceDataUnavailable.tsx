export function CommerceDataUnavailable({
  title = "Commerce data unavailable",
}: {
  readonly title?: string;
}) {
  return (
    <section
      role="alert"
      className="rounded-[12px] border border-[var(--od-warning)]/40 bg-[var(--od-surface)] p-6"
    >
      <h2 className="text-[17px] font-semibold text-[var(--od-text)]">{title}</h2>
      <p className="mt-2 text-sm text-[var(--od-muted)]">
        Catalogue figures could not be loaded. Empty counts are not shown because this is not a confirmed empty
        catalogue.
      </p>
    </section>
  );
}
