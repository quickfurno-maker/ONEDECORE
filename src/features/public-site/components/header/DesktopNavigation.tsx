import Link from "next/link";
import type { NavigationItem } from "../../types/shell";
import { cn } from "../../utils/cn";

export interface DesktopNavigationProps {
  items: readonly NavigationItem[];
  currentPath: string;
  className?: string;
}

function isActivePath(currentPath: string, href: string): boolean {
  if (href === "/") {
    return currentPath === "/";
  }
  return currentPath === href || currentPath.startsWith(`${href}/`);
}

export function DesktopNavigation({ items, currentPath, className }: DesktopNavigationProps) {
  return (
    <nav aria-label="Primary" className={cn("ps-desktop-nav", className)}>
      <ul className="ps-desktop-nav__list">
        {items.map((item) => {
          const active = isActivePath(currentPath, item.href);
          return (
            <li key={item.href} className="ps-desktop-nav__item">
              <Link
                href={item.href}
                className={cn("ps-desktop-nav__link", active && "ps-desktop-nav__link--active")}
                aria-current={active ? "page" : undefined}
              >
                {item.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
