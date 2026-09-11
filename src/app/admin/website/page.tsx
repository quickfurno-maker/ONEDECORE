import type { Metadata } from "next";
import { WebsiteManager } from "@/features/website-manager/components/WebsiteManager";
import { getWebsiteDraft } from "@/features/website-manager/server/website-queries";
import { hasWebsiteManagePermission } from "@/features/website-manager/server/website-permissions";

/**
 * The Website Manager route.
 *
 * Dynamic, like every other admin page: it reads a session and must never be
 * cached across users. The PUBLIC homepage is the one that has to stay static,
 * and it reads through a different, anonymous path entirely.
 */
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Website Manager | ONEDECORE",
  description: "Control homepage sections and promotional banners.",
  // An admin editor has no business in an index, even behind a login.
  robots: { index: false, follow: false },
};

export default async function AdminWebsitePage() {
  /*
   * The guard is here as well as in the layout, the queries, the actions and
   * the database. `admin.access` gets someone into the workspace; this page
   * needs `website.manage`, and a staff member who has one and not the other
   * should see a refusal rather than an editor that fails on save.
   */
  if (!(await hasWebsiteManagePermission())) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl font-semibold text-red-600">Access Denied</h1>
        <p className="mt-2 text-sm text-stone-600">
          You require the website.manage permission to open the Website Manager.
        </p>
      </div>
    );
  }

  const draft = await getWebsiteDraft();

  if (!draft) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl font-semibold text-stone-800">Website Manager is not set up</h1>
        <p className="mt-2 text-sm text-stone-600">
          No homepage draft was found. The database migration that seeds the current homepage
          has not run on this environment.
        </p>
      </div>
    );
  }

  return (
    <WebsiteManager
      draft={draft}
      // Passed in rather than read in the client: `NEXT_PUBLIC_*` is inlined at
      // build time and this keeps the one source of truth on the server.
      publicOrigin={process.env.NEXT_PUBLIC_SUPABASE_URL ?? ""}
    />
  );
}
