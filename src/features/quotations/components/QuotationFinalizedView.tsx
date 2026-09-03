"use client";

import { useState, useTransition } from "react";
import { formatInrFromPaise } from "../contracts/money";
import type { QuotationDraftDTO } from "../contracts/types";
import { createQuotationRevisionAction } from "../server/quotation-acceptance-actions";
import {
  ensureQuotationPdfAction,
  generateQuotationClientLinkAction,
} from "../server/quotation-send-actions";

/**
 * Finalized quotation management.
 *
 * The previous behaviour was the defect this replaces: the draft route only
 * rendered an editable draft, so the moment a quotation was finalized a reload
 * produced a dead-end error state and every finalized control disappeared. A
 * finalized quotation is the COMMERCIAL RECORD, and it still needs a document,
 * a client link and a revision path.
 *
 * Everything here is READ-ONLY. The only writes are the three explicit actions,
 * each of which is authorized again on the server.
 */

const EM_DASH = "—";

function Row({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <div className="flex justify-between gap-4 py-1 text-sm">
      <span className="text-neutral-400">{label}</span>
      <span className="font-medium text-neutral-100">{value}</span>
    </div>
  );
}

function measureCell(item: {
  readonly calculationBasis?: string;
  readonly widthFt?: number | string | null;
  readonly heightFt?: number | string | null;
  readonly areaSqFt?: number | string | null;
  readonly quantity: number | string;
  readonly unitOfMeasure: string;
}): { readonly w: string; readonly h: string; readonly measure: string } {
  const basis = item.calculationBasis ?? "quantity";
  if (basis === "fixed") {
    // An em dash, not a zero: a lump-sum item has no width to report.
    return { w: EM_DASH, h: EM_DASH, measure: "FIXED" };
  }
  if (basis === "area") {
    const area = item.areaSqFt ?? item.quantity;
    return {
      w: item.widthFt != null ? Number(item.widthFt).toFixed(2) : EM_DASH,
      h: item.heightFt != null ? Number(item.heightFt).toFixed(2) : EM_DASH,
      measure: `${Number(area).toFixed(2)} sq.ft`,
    };
  }
  return {
    w: EM_DASH,
    h: EM_DASH,
    measure: `${Number(item.quantity)} ${item.unitOfMeasure}`,
  };
}

interface QuotationFinalizedViewProps {
  readonly draft: QuotationDraftDTO;
  readonly canSend: boolean;
  readonly canEdit: boolean;
  readonly pdfStatus: string | null;
}

export function QuotationFinalizedView({
  draft,
  canSend,
  canEdit,
  pdfStatus,
}: QuotationFinalizedViewProps) {
  const version = draft.version!;
  const [pending, startTransition] = useTransition();
  const [notice, setNotice] = useState<{ tone: "ok" | "bad"; text: string } | null>(null);
  const [linkPath, setLinkPath] = useState<string | null>(null);

  const run = (work: () => Promise<{ ok: boolean; text: string; link?: string | null }>) => {
    setNotice(null);
    startTransition(async () => {
      const result = await work();
      setNotice({ tone: result.ok ? "ok" : "bad", text: result.text });
      if (result.link) {
        setLinkPath(result.link);
      }
    });
  };

  const issueLink = (reissue: boolean) =>
    run(async () => {
      const res = await generateQuotationClientLinkAction({
        quotationId: draft.quotationId,
        versionId: version.id,
        reissue,
      });
      return {
        ok: res.success,
        text: res.message,
        link: res.clientLinkPath ?? null,
      };
    });

  const ensurePdf = () =>
    run(async () => {
      const res = await ensureQuotationPdfAction({
        quotationId: draft.quotationId,
        versionId: version.id,
      });
      return { ok: res.success, text: res.message };
    });

  const createRevision = () =>
    run(async () => {
      const res = await createQuotationRevisionAction({ sourceVersionId: version.id });
      return {
        ok: res.success,
        text: res.success
          ? "New editable revision created. Reload to continue in the draft editor."
          : res.message || "Revision could not be created.",
      };
    });

  return (
    <div className="space-y-6">
      <header className="rounded-xl border border-emerald-900/60 bg-emerald-950/25 p-5">
        <div className="flex flex-wrap items-start justify-between gap-4">
          <div>
            <p className="text-[11px] font-semibold uppercase tracking-widest text-emerald-300">
              Finalized quotation
            </p>
            <h1 className="mt-1 text-xl font-bold text-neutral-50">
              {draft.quotationNumber} · v{version.versionNumber}
            </h1>
            <p className="mt-1 text-sm text-neutral-400">
              {version.clientNameSnapshot || "Client"}
              {version.clientPhoneSnapshot ? ` · ${version.clientPhoneSnapshot}` : ""}
            </p>
            {version.propertyAddressSnapshot ? (
              <p className="text-xs text-neutral-500">{version.propertyAddressSnapshot}</p>
            ) : null}
          </div>
          <div className="text-right">
            <p className="text-[11px] uppercase tracking-wide text-neutral-500">Grand total</p>
            <p className="text-2xl font-bold text-neutral-50">
              {formatInrFromPaise(version.grandTotalPaise ?? 0)}
            </p>
            <p className="mt-1 text-[11px] uppercase tracking-wide text-emerald-300">
              Status: {version.status}
            </p>
          </div>
        </div>
      </header>

      {notice ? (
        <p
          role="status"
          className={
            notice.tone === "ok"
              ? "rounded-md border border-emerald-900/60 bg-emerald-950/30 px-3 py-2 text-sm text-emerald-100"
              : "rounded-md border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-100"
          }
        >
          {notice.text}
        </p>
      ) : null}

      {linkPath ? (
        <div className="rounded-md border border-amber-900/60 bg-amber-950/25 px-3 py-2">
          <p className="text-[11px] uppercase tracking-wide text-amber-300">
            Secure client link
          </p>
          <code className="mt-1 block break-all text-xs text-amber-100">{linkPath}</code>
          <p className="mt-1 text-[11px] text-neutral-500">
            Share this path on your own domain. It is shown once here and is never
            stored in plain text.
          </p>
        </div>
      ) : null}

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
          Rooms
        </h2>
        <div className="mt-4 space-y-5">
          {draft.sections.map((room) => (
            <div key={room.id ?? room.sectionName} className="rounded-lg border border-neutral-800">
              <div className="flex items-center justify-between border-b border-neutral-800 px-4 py-2">
                <h3 className="text-sm font-semibold text-neutral-100">{room.sectionName}</h3>
                <span className="text-sm font-bold text-neutral-100">
                  {formatInrFromPaise(room.subtotalPaise ?? 0)}
                </span>
              </div>
              <table className="w-full text-left text-xs">
                <thead className="text-[10px] uppercase tracking-wide text-neutral-500">
                  <tr>
                    <th className="px-4 py-2">Particular</th>
                    <th className="px-2 py-2 text-right">W (ft)</th>
                    <th className="px-2 py-2 text-right">H (ft)</th>
                    <th className="px-2 py-2 text-right">Area / Qty</th>
                    <th className="px-2 py-2 text-right">Rate</th>
                    <th className="px-4 py-2 text-right">Amount</th>
                  </tr>
                </thead>
                <tbody className="text-neutral-300">
                  {room.items.map((item) => {
                    const cells = measureCell(item);
                    return (
                      <tr key={item.id ?? item.itemName} className="border-t border-neutral-800/60">
                        <td className="px-4 py-1.5">
                          {item.itemName}
                          {item.description || item.specifications ? (
                            <span className="block text-[10px] text-neutral-500">
                              {[item.description, item.specifications].filter(Boolean).join(" · ")}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-2 py-1.5 text-right">{cells.w}</td>
                        <td className="px-2 py-1.5 text-right">{cells.h}</td>
                        <td className="px-2 py-1.5 text-right">{cells.measure}</td>
                        <td className="px-2 py-1.5 text-right">
                          {item.calculationBasis === "fixed"
                            ? EM_DASH
                            : formatInrFromPaise(item.unitRatePaise)}
                        </td>
                        <td className="px-4 py-1.5 text-right font-semibold text-neutral-100">
                          {formatInrFromPaise(item.lineTotalPaise ?? 0)}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          ))}
        </div>
      </section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
          Commercial summary
        </h2>
        <div className="mt-3 divide-y divide-neutral-800">
          <Row label="Subtotal" value={formatInrFromPaise(version.subtotalPaise ?? 0)} />
          <Row label="Discount" value={formatInrFromPaise(version.discountTotalPaise ?? 0)} />
          <Row label="Taxable value" value={formatInrFromPaise(version.taxableBasePaise ?? 0)} />
          <Row label="Tax" value={formatInrFromPaise(version.taxTotalPaise ?? 0)} />
          <Row label="Grand total" value={formatInrFromPaise(version.grandTotalPaise ?? 0)} />
        </div>
      </section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
          Payment Schedule
        </h2>
        <div className="mt-3 divide-y divide-neutral-800">
          {draft.paymentSchedules.length === 0 ? (
            <p className="py-2 text-sm text-neutral-500">No milestones recorded.</p>
          ) : (
            draft.paymentSchedules.map((ms) => (
              <Row
                key={ms.id ?? ms.milestoneName}
                label={`${ms.milestoneName}${ms.percentage ? ` (${ms.percentage}%)` : ""}`}
                value={formatInrFromPaise(ms.amountPaise ?? 0)}
              />
            ))
          )}
        </div>
      </section>

      <section className="rounded-xl border border-neutral-800 bg-neutral-900/60 p-5">
        <h2 className="text-sm font-semibold uppercase tracking-wide text-neutral-300">
          Record &amp; delivery
        </h2>
        <div className="mt-3 space-y-1">
          <Row label="Finalized at" value={version.finalizedAt ?? EM_DASH} />
          <Row
            label="Content SHA-256"
            value={version.finalizedContentSha256 ?? EM_DASH}
          />
          <Row label="PDF document" value={pdfStatus ?? "not generated"} />
        </div>

        <div className="mt-4 flex flex-wrap gap-2">
          <button
            type="button"
            disabled={pending}
            onClick={ensurePdf}
            className="rounded-md border border-neutral-700 px-3 py-2 text-xs font-semibold text-neutral-100 disabled:opacity-50"
          >
            {pdfStatus === "ready" ? "Verify document" : "Generate / retry document"}
          </button>

          {canSend ? (
            <>
              <button
                type="button"
                disabled={pending}
                onClick={() => issueLink(false)}
                className="rounded-md bg-amber-500 px-3 py-2 text-xs font-bold uppercase tracking-wide text-neutral-950 disabled:opacity-50"
              >
                Secure client link
              </button>
              <button
                type="button"
                disabled={pending}
                onClick={() => issueLink(true)}
                className="rounded-md border border-amber-700 px-3 py-2 text-xs font-semibold text-amber-200 disabled:opacity-50"
              >
                Reissue link
              </button>
            </>
          ) : null}

          {canEdit ? (
            <button
              type="button"
              disabled={pending}
              onClick={createRevision}
              className="rounded-md border border-neutral-700 px-3 py-2 text-xs font-semibold text-neutral-100 disabled:opacity-50"
            >
              Create Revision
            </button>
          ) : null}
        </div>

        <p className="mt-3 text-[11px] text-neutral-500">
          The secure client link works on its own — it needs no WhatsApp
          conversation and makes no provider call. WhatsApp delivery keeps its own
          prerequisites and stays available for later.
        </p>
      </section>
    </div>
  );
}
