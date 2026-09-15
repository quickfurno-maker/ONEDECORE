import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { WhatsappWorkspaceNav } from "@/features/whatsapp/components/shell/WhatsappWorkspaceNav";
import { visibleWhatsappControlPlaneSections } from "@/features/whatsapp/contracts/control-plane";
import { resolveWhatsappWorkspaceAccess } from "@/features/whatsapp/server/whatsapp-workspace-auth";

export const dynamic = "force-dynamic";

/**
 * WhatsApp workspace shell: active staff only. It is NOT a permission gate for
 * the subtree — Inbox, Contacts, Templates, Campaigns, Segments, Automations,
 * Forms / Flows, Analytics and Settings & Compliance each check their own exact
 * permission. The nav lists only what the caller can open.
 */
export default async function WhatsappLayout({ children }: { children: ReactNode }) {
  const access = await resolveWhatsappWorkspaceAccess();

  if (access.kind === "unauthenticated") {
    redirect("/auth/login?portal=admin&next=%2Fadmin%2Fwhatsapp");
  }
  if (access.kind === "inactive") {
    redirect("/auth/forbidden");
  }

  const sections = visibleWhatsappControlPlaneSections(access.permissions).map(({ key, label, href }) => ({ key, label, href }));

  return (
    <div className="space-y-4">
      <a
        href="#whatsapp-main-content"
        className="sr-only focus:not-sr-only focus:absolute focus:left-4 focus:top-4 focus:z-50 focus:rounded-md focus:bg-neutral-800 focus:px-3 focus:py-2 focus:text-sm focus:text-neutral-100"
      >
        Skip to WhatsApp content
      </a>
      <WhatsappWorkspaceNav sections={sections} />
      <div id="whatsapp-main-content">{children}</div>
    </div>
  );
}
