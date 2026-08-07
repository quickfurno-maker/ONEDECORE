import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { WhatsappAccessDenied } from "@/features/whatsapp/components/states/WhatsappAccessDenied";
import { resolveWhatsappInboxAccess } from "@/features/whatsapp/server/whatsapp-auth";

export const dynamic = "force-dynamic";

export default async function WhatsappLayout({
  children,
}: {
  children: ReactNode;
}) {
  const resolution = await resolveWhatsappInboxAccess();

  if (resolution.kind === "unauthenticated") {
    redirect("/auth/login?next=%2Fadmin%2Fwhatsapp%2Finbox");
  }

  if (resolution.kind === "inactive") {
    redirect("/auth/forbidden");
  }

  if (resolution.kind === "denied") {
    return (
      <div className="space-y-6">
        <WhatsappAccessDenied />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <a
        href="#whatsapp-main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-neutral-800 focus:px-3 focus:py-2 focus:text-sm focus:text-neutral-100"
      >
        Skip to inbox content
      </a>
      <div id="whatsapp-main-content">{children}</div>
    </div>
  );
}
