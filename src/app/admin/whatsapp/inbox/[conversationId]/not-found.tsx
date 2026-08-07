import Link from "next/link";

export default function WhatsappConversationNotFound() {
  return (
    <section className="rounded-lg border border-neutral-800 bg-neutral-900/40 px-6 py-10">
      <h1 className="text-lg font-semibold text-neutral-50">
        Conversation not found
      </h1>
      <p className="mt-3 max-w-2xl text-sm leading-6 text-neutral-400">
        This conversation does not exist or is outside your authorized inbox
        scope.
      </p>
      <Link
        href="/admin/whatsapp/inbox"
        className="mt-6 inline-flex min-h-11 items-center rounded-md border border-neutral-700 px-4 py-2 text-sm font-medium text-neutral-200"
      >
        Return to inbox
      </Link>
    </section>
  );
}
