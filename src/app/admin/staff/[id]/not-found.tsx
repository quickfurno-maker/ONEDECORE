import Link from "next/link";

export default function StaffNotFound() {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/60 px-6 py-10">
      <h1 className="text-lg font-semibold text-neutral-50">Staff member not found</h1>
      <p className="mt-2 text-sm text-neutral-400">
        This profile is outside your visibility scope or does not exist.
      </p>
      <Link
        href="/admin/staff"
        className="mt-5 inline-flex min-h-11 items-center rounded-md border border-neutral-700 px-4 py-2 text-sm text-neutral-200 hover:border-amber-400"
      >
        Back to directory
      </Link>
    </section>
  );
}
