import type { Metadata } from "next";
import type { ReactNode } from "react";
import { requireSalesManager } from "@/features/manager-workspace/server/manager-access";

export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Manager Workspace | ONEDECORE",
  description: "Sales management workspace for authorized ONEDECORE personnel.",
};

/**
 * The Sales Manager workspace shell.
 *
 * The guard lives HERE rather than only on the page, so every route added under
 * `/manager` later inherits it. A layout that renders is a layout that already
 * proved who is looking at it.
 *
 * This deliberately does NOT reuse `AdminShell`. That shell renders the Super
 * Admin navigation model — Content, Commerce, Marketing groups included — and
 * wiring it up here would mean the manager's boundary depended on nav flags
 * being right rather than on the role gate above.
 */
export default async function ManagerLayout({ children }: { children: ReactNode }) {
  await requireSalesManager();

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100">{children}</div>
  );
}
