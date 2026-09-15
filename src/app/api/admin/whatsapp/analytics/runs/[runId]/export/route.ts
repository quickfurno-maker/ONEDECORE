import { createClient } from "@/lib/supabase/server";
import { buildWhatsappRunReportCsv, WHATSAPP_ANALYTICS_RPC } from "@/features/whatsapp/contracts/analytics";
import { isUuid } from "@/features/whatsapp/contracts/control-plane";
import { resolveWhatsappControlPlaneAccess } from "@/features/whatsapp/server/whatsapp-control-plane-auth";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

/*
 * WM-5 minimised per-recipient campaign report. Super Admin only:
 * whatsapp.reports.export is checked on the caller's session first, then the
 * RPC re-checks it together with the super_admin role and records the export
 * in append-only evidence before returning any row. The caller's session is
 * the only client here. A refused and a missing run look the same.
 */

const NO_STORE = { "cache-control": "no-store", "x-content-type-options": "nosniff" } as const;

function notFound(): Response {
  return new Response(JSON.stringify({ ok: false, code: "NOT_FOUND" }), {
    status: 404,
    headers: { ...NO_STORE, "content-type": "application/json; charset=utf-8" },
  });
}

export async function GET(_request: Request, context: { params: Promise<{ runId: string }> }): Promise<Response> {
  const { runId } = await context.params;
  const access = await resolveWhatsappControlPlaneAccess();
  if (!access) {
    return new Response(JSON.stringify({ ok: false, code: "UNAUTHENTICATED" }), {
      status: 401,
      headers: { ...NO_STORE, "content-type": "application/json; charset=utf-8" },
    });
  }
  if (!access.permissions["whatsapp.reports.export"] || !isUuid(runId)) return notFound();

  const supabase = await createClient();
  const { data, error } = await supabase.rpc(WHATSAPP_ANALYTICS_RPC.exportRunReport, { p_run_id: runId });
  if (error) return notFound();
  const report = buildWhatsappRunReportCsv(data);
  if (!report) return notFound();

  return new Response(report.csv, {
    status: 200,
    headers: {
      ...NO_STORE,
      "content-type": "text/csv; charset=utf-8",
      "content-disposition": `attachment; filename="whatsapp-run-${runId.slice(0, 8)}.csv"`,
      "x-onedecore-report-rows": String(report.rows),
      "x-onedecore-report-truncated": report.truncated ? "1" : "0",
    },
  });
}
