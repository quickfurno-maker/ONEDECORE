import { getClaims } from "@/server/auth/claims";
import { PortfolioAdminNav } from "@/features/portfolio/components/PortfolioAdminNav";
import { PortfolioMediaLibrary } from "@/features/portfolio/components/PortfolioMediaLibrary";
import { fetchLibraryMedia } from "@/features/portfolio/server/portfolio-library-repository";
import {
  isLibraryPublicationFilter,
  isLibraryRoomFilter,
  type LibraryPublicationFilter,
  type LibraryRoomFilter,
} from "@/features/portfolio/domain/portfolio-library";

export const dynamic = "force-dynamic";

/**
 * Portfolio Media Library — room photography without a project.
 *
 * The filters live in the URL rather than in component state so a view is
 * linkable, survives a refresh after a bulk action, and comes back the same
 * after `router.refresh()`. Every one is re-validated here: a hand-edited
 * `?room=hall` must fall back to "all" rather than reach the query.
 */
interface PageProps {
  searchParams: Promise<{ room?: string; publication?: string; page?: string }>;
}

export default async function AdminPortfolioMediaPage({ searchParams }: PageProps) {
  const claims = await getClaims();
  if (!claims || !claims.isActive || !claims.permissions.includes("portfolio.manage")) {
    return (
      <div className="p-8 text-center">
        <h1 className="text-xl font-semibold text-red-600">Access Denied</h1>
        <p className="mt-2 text-sm text-stone-600">
          You require portfolio.manage permission to view this page.
        </p>
      </div>
    );
  }

  const params = await searchParams;

  const room: LibraryRoomFilter = isLibraryRoomFilter(params.room) ? params.room : "all";
  const publication: LibraryPublicationFilter = isLibraryPublicationFilter(params.publication)
    ? params.publication
    : "all";
  const page = Math.max(1, Number.parseInt(params.page ?? "1", 10) || 1);

  /*
   * REORDER NEEDS THE WHOLE ROOM IN ONE RESPONSE.
   *
   * `reorder_portfolio_library_media` refuses a partial set, because renumbering
   * one page to 0..47 while another page also claims 0..47 produces an order
   * that depends on which rows the database returned first. So the complete set
   * is loaded exactly when reordering is possible — one room, no publication
   * filter narrowing it — and the button is hidden otherwise.
   */
  const canReorder = room !== "all" && publication === "all";

  const data = await fetchLibraryMedia({ room, publication, page, loadAll: canReorder });

  return (
    <div className="space-y-6">
      <PortfolioAdminNav current="media" />
      <PortfolioMediaLibrary
        data={data}
        room={room}
        publication={publication}
        canReorder={canReorder && data.items.length > 1}
      />
    </div>
  );
}
