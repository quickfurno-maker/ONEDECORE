import { redirect } from "next/navigation";
import { WhatsappAccessDenied } from "@/features/whatsapp/components/states/WhatsappAccessDenied";
import { firstWhatsappWorkspaceHref, resolveWhatsappWorkspaceAccess } from "@/features/whatsapp/server/whatsapp-workspace-auth";

export const dynamic = "force-dynamic";

/** Opens the first WhatsApp section the caller may use; Inbox first for everyone who has it. */
export default async function WhatsappIndexPage() {
  const access = await resolveWhatsappWorkspaceAccess();
  if (access.kind !== "active") redirect("/admin/whatsapp/inbox");
  const href = firstWhatsappWorkspaceHref(access.permissions);
  if (href) redirect(href);
  return <WhatsappAccessDenied />;
}
