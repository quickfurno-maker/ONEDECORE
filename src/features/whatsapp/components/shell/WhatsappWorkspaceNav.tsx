"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import type { WHATSAPP_CONTROL_PLANE_SECTIONS } from "../../contracts/control-plane.ts";
import "../control-plane/control-plane.css";

type Section = Pick<(typeof WHATSAPP_CONTROL_PLANE_SECTIONS)[number], "key" | "label" | "href">;

/**
 * The WhatsApp workspace section nav. The server passes only the sections the
 * caller's permissions open, so a Project Manager, Designer or legacy role
 * never learns that a section exists. A single section needs no nav.
 */
export function WhatsappWorkspaceNav({ sections }: { readonly sections: readonly Section[] }) {
  const pathname = usePathname() ?? "";
  if (sections.length < 2) return null;
  return (
    <nav className="od-cp__nav od-cp__nav--workspace" aria-label="WhatsApp sections" data-testid="whatsapp-workspace-nav">
      {sections.map((section) => {
        const current = pathname === section.href || pathname.startsWith(`${section.href}/`);
        return (
          <Link key={section.key} className="od-cp__nav-link" href={section.href} aria-current={current ? "page" : undefined}>
            {section.label}
          </Link>
        );
      })}
    </nav>
  );
}
