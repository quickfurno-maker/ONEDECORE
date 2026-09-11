import Link from "next/link";

/**
 * The two halves of Portfolio Management.
 *
 * WHY THIS IS A SEPARATE TOP-LEVEL NAVIGATION AND NOT A FILTER
 *
 * Projects and the Media Library are different objects with different verbs.
 * A project has a title, a locality, services, a publication state and a
 * cover; a library image has a room and a publish switch. Putting them behind
 * one list with a filter would mean every row action had to ask which kind it
 * was looking at, and the owner would have to know too.
 *
 * Two destinations, one of which is always current. Rendered as links rather
 * than as a client component with `usePathname` because the answer is known on
 * the server, and a nav that needs JavaScript to show where you are is a nav
 * that flashes the wrong tab on every load.
 */
export type PortfolioAdminSection = "projects" | "media";

const TABS: readonly { readonly id: PortfolioAdminSection; readonly label: string; readonly href: string }[] = [
  { id: "projects", label: "Projects", href: "/admin/portfolio" },
  { id: "media", label: "Media Library", href: "/admin/portfolio/media" },
];

export function PortfolioAdminNav({ current }: { readonly current: PortfolioAdminSection }) {
  return (
    <nav className="flex gap-1 border-b border-[#E5E0DA]" aria-label="Portfolio sections">
      {TABS.map((tab) => {
        const active = tab.id === current;
        return (
          <Link
            key={tab.id}
            href={tab.href}
            aria-current={active ? "page" : undefined}
            className={
              active
                ? "border-b-2 border-[#1A1A1A] px-4 py-2.5 text-sm font-semibold text-[#1A1A1A]"
                : "border-b-2 border-transparent px-4 py-2.5 text-sm font-medium text-[#666059] transition hover:text-[#1A1A1A]"
            }
          >
            {tab.label}
          </Link>
        );
      })}
    </nav>
  );
}
