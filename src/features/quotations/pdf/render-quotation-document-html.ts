/**
 * Deterministic HTML quotation document renderer (no external PDF dependency).
 */

import type { QuotationFinalSnapshot } from "../contracts/snapshot.ts";
import { formatInrFromPaise } from "../contracts/money.ts";
import { formatQuantityFromMilli } from "../domain/format.ts";

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

export function renderQuotationDocumentHtml(snapshot: QuotationFinalSnapshot): string {
  const { revision, client, site, lineItems, calculation } = snapshot;
  const lines = lineItems
    .map((item) => {
      const lineCalc = calculation.lineCalculations.find((line) => line.lineItemId === item.id);
      const subtotal = lineCalc?.subtotalPaise ?? 0;
      return `<tr>
        <td>${escapeHtml(item.description)}</td>
        <td>${escapeHtml(item.unit)}</td>
        <td class="num">${escapeHtml(formatQuantityFromMilli(item.quantityMilli))}</td>
        <td class="num">${escapeHtml(formatInrFromPaise(item.unitPricePaise))}</td>
        <td class="num">${escapeHtml(formatInrFromPaise(subtotal))}</td>
      </tr>`;
    })
    .join("");

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(snapshot.brand.documentTitle)}</title>
  <style>
    body { font-family: Georgia, serif; color: #1a1410; margin: 40px; }
    h1 { font-size: 1.5rem; letter-spacing: 0.08em; text-transform: uppercase; }
    .meta { margin: 16px 0 24px; color: #5c4f44; }
    table { width: 100%; border-collapse: collapse; margin-top: 16px; }
    th, td { border-bottom: 1px solid #ddd2c5; padding: 8px; text-align: left; vertical-align: top; }
    th { font-size: 0.75rem; text-transform: uppercase; letter-spacing: 0.06em; }
    .num { text-align: right; white-space: nowrap; }
    .totals { margin-top: 24px; width: 320px; margin-left: auto; }
    .totals div { display: flex; justify-content: space-between; padding: 4px 0; }
    .grand { font-weight: 700; border-top: 2px solid #1a1410; margin-top: 8px; padding-top: 8px; }
    .terms { margin-top: 32px; font-size: 0.9rem; color: #4a4038; }
    .footer { margin-top: 40px; font-size: 0.8rem; color: #7a6d60; }
    .watermark { color: #9a8570; font-size: 0.85rem; text-transform: uppercase; letter-spacing: 0.1em; }
  </style>
</head>
<body>
  <p class="watermark">${escapeHtml(snapshot.lifecycleState)}</p>
  <h1>${escapeHtml(snapshot.brand.documentTitle)}</h1>
  <div class="meta">
    <div>Reference: ${escapeHtml(revision.quotationReference)} · Rev ${revision.revisionNumber}</div>
    <div>Client: ${escapeHtml(client.displayName)}</div>
    ${site ? `<div>Site: ${escapeHtml(site.label)}${site.city ? `, ${escapeHtml(site.city)}` : ""}</div>` : ""}
    <div>Valid until: ${escapeHtml(snapshot.validityEndsOn)}</div>
  </div>
  <table aria-label="Quotation line items">
    <thead>
      <tr>
        <th>Description</th>
        <th>Unit</th>
        <th class="num">Qty</th>
        <th class="num">Rate</th>
        <th class="num">Amount</th>
      </tr>
    </thead>
    <tbody>${lines}</tbody>
  </table>
  <div class="totals">
    <div><span>Subtotal</span><span>${escapeHtml(formatInrFromPaise(calculation.subtotalPaise))}</span></div>
    <div><span>Discount</span><span>${escapeHtml(formatInrFromPaise(calculation.discountAmountPaise))}</span></div>
    <div><span>Taxable base</span><span>${escapeHtml(formatInrFromPaise(calculation.taxableBasePaise))}</span></div>
    <div><span>GST (${(calculation.tax.taxRateBps / 100).toFixed(2)}%)</span><span>${escapeHtml(formatInrFromPaise(calculation.tax.taxAmountPaise))}</span></div>
    <div class="grand"><span>Grand total</span><span>${escapeHtml(formatInrFromPaise(calculation.grandTotalPaise))}</span></div>
  </div>
  <div class="terms">
    <strong>Terms</strong>
    <p>${escapeHtml(snapshot.termsText)}</p>
    ${snapshot.warrantyText ? `<p><strong>Warranty</strong><br />${escapeHtml(snapshot.warrantyText)}</p>` : ""}
  </div>
  <div class="footer">${escapeHtml(snapshot.brand.footerNote)}</div>
</body>
</html>`;
}
