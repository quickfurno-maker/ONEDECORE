export function CrmAccessDenied() {
  return (
    <section
      aria-labelledby="crm-access-denied-heading"
      className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-6 py-10"
    >
      <h1
        id="crm-access-denied-heading"
        className="text-lg font-semibold text-neutral-50"
      >
        CRM workspace access denied
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
        Your staff account can access the admin portal but does not have CRM lead
        read permission for this workspace.
      </p>
    </section>
  );
}
