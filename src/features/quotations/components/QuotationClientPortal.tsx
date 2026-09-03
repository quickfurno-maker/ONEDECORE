'use client';

import React, { useState } from 'react';
import {
  clientQuotationItemCells,
  formatClientMeasure,
  type ClientQuotation,
  type ClientQuotationItem,
} from '../contracts/client-quotation';
import { acceptQuotationByCapabilityAction } from '../server/quotation-acceptance-actions';

/**
 * The client accepts the SAME commercial meaning that is printed in the
 * finalized PDF, so this renders the same room-wise interior table:
 *
 *   PARTICULAR | W (FT) | H (FT) | AREA / QTY | RATE | AMOUNT
 *
 * The props are the typed DTO from `mapClientQuotation`. They used to be an
 * unchecked cast of the RPC payload with DIFFERENT field names, so the
 * commercial figures rendered blank or NaN on the acceptance document itself.
 */
interface QuotationClientPortalProps {
  token: string;
  quotation: ClientQuotation;
}

function formatInr(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

// The SAME cell logic the tests exercise directly, shared rather than a
// second copy that could drift from what the client is shown.
const formatMeasure = formatClientMeasure;
const itemCells = (item: ClientQuotationItem) =>
  clientQuotationItemCells(item, formatInr);

export default function QuotationClientPortal({ token, quotation }: QuotationClientPortalProps) {
  const [accepted, setAccepted] = useState(quotation.isAccepted);
  const [acceptedAt, setAcceptedAt] = useState(quotation.acceptedAt || '');
  const [clientName, setClientName] = useState(quotation.clientName || '');
  const [clientEmail, setClientEmail] = useState('');
  const [confirmed, setConfirmed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  const handleAccept = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!confirmed || !clientName.trim()) return;

    setLoading(true);
    setErrorMsg('');

    try {
      const res = await acceptQuotationByCapabilityAction({
        token,
        clientName: clientName.trim(),
        clientEmail: clientEmail.trim() || undefined,
      });

      if (!res.success) {
        setErrorMsg(res.message || 'Acceptance failed.');
      } else {
        setAccepted(true);
        setAcceptedAt(res.acceptedAt || new Date().toISOString());
      }
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : 'An error occurred during acceptance.';
      setErrorMsg(msg);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-100 text-slate-800 font-sans pb-12">
      {/* Brand Header */}
      <header className="bg-slate-900 text-white px-4 py-6 shadow-sm">
        <div className="max-w-2xl mx-auto flex items-center justify-between">
          <div>
            <h1 className="text-xl font-bold tracking-tight text-amber-400">ONEDECORE</h1>
            <p className="text-xs text-slate-400">One Vision. Complete Interiors.</p>
          </div>
          <div className="text-right">
            <span className="inline-block px-2.5 py-1 text-xs font-medium rounded-full bg-slate-800 text-slate-300 border border-slate-700">
              v{quotation.versionNumber}
            </span>
          </div>
        </div>
      </header>

      <main className="max-w-2xl mx-auto px-4 mt-6 space-y-6">
        {/* Status Card */}
        {accepted ? (
          <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-emerald-500 text-white flex items-center justify-center font-bold text-lg">
              ✓
            </div>
            <div>
              <h2 className="text-emerald-900 font-semibold text-base">Quotation Accepted</h2>
              <p className="text-xs text-emerald-700">
                Accepted on {new Date(acceptedAt).toLocaleString('en-IN')}
              </p>
            </div>
          </div>
        ) : (
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4 flex items-center justify-between">
            <div>
              <span className="text-xs font-semibold uppercase tracking-wider text-amber-700">Status</span>
              <p className="text-sm font-semibold text-amber-900">Awaiting Client Acceptance</p>
            </div>
            {quotation.hasPdf && (
              <a
                href={`/api/quotations/pdf?token=${encodeURIComponent(token)}`}
                target="_blank"
                rel="noreferrer"
                className="px-3 py-1.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-medium rounded-lg transition-colors inline-flex items-center gap-1"
              >
                📄 Download PDF
              </a>
            )}
          </div>
        )}

        {/* Overview Header */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-lg font-bold text-slate-900">{quotation.quotationNumber}</h2>
              <p className="text-xs text-slate-500">
                Finalized: {new Date(quotation.finalizedAt).toLocaleDateString('en-IN')}
              </p>
              {quotation.title && (
                <p className="mt-1 text-sm font-semibold text-slate-700">{quotation.title}</p>
              )}
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Total Investment</span>
              <span className="text-xl font-extrabold text-slate-900">{formatInr(quotation.grandTotalPaise)}</span>
            </div>
          </div>

          {quotation.scopeSummary && (
            <p className="text-xs text-slate-600">{quotation.scopeSummary}</p>
          )}

          <div className="border-t border-slate-100 pt-3 text-xs text-slate-600 flex flex-wrap justify-between gap-2">
            <span>Client: {quotation.clientName}</span>
            <span>Phone: {quotation.clientPhone}</span>
          </div>
          {quotation.propertyAddress && (
            <p className="text-xs text-slate-500">Site / Property: {quotation.propertyAddress}</p>
          )}
        </div>

        {/* Room-wise interior estimate — the same table as the finalized PDF */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 px-1">
            Room-wise Interior Estimate
          </h3>
          {quotation.rooms.map((room) => (
            <div key={room.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                <h4 className="font-semibold text-sm text-slate-800">{room.roomName}</h4>
                <span className="text-xs font-medium text-slate-600">{formatInr(room.subtotalPaise)}</span>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[11px]">
                  <thead className="text-[10px] uppercase tracking-wide text-slate-400 bg-slate-50/60">
                    <tr>
                      <th className="px-3 py-2">Particular</th>
                      <th className="px-2 py-2 text-right">W (ft)</th>
                      <th className="px-2 py-2 text-right">H (ft)</th>
                      <th className="px-2 py-2 text-right">Area / Qty</th>
                      <th className="px-2 py-2 text-right">Rate</th>
                      <th className="px-3 py-2 text-right">Amount</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {room.items.map((item) => {
                      const cells = itemCells(item);
                      return (
                        <tr key={item.id}>
                          <td className="px-3 py-2">
                            <span className="font-medium text-slate-800">{item.itemName}</span>
                            {(item.description || item.specifications) && (
                              <span className="block text-[10px] text-slate-500">
                                {[item.description, item.specifications].filter(Boolean).join(' \u2022 ')}
                              </span>
                            )}
                          </td>
                          <td className="px-2 py-2 text-right text-slate-600">{cells.widthFt}</td>
                          <td className="px-2 py-2 text-right text-slate-600">{cells.heightFt}</td>
                          <td className="px-2 py-2 text-right text-slate-600">{cells.measure}</td>
                          <td className="px-2 py-2 text-right text-slate-600">{cells.rate}</td>
                          <td className="px-3 py-2 text-right font-semibold text-slate-900">
                            {formatInr(item.lineTotalPaise)}
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
              {room.areaSubtotalSqFt > 0 && (
                <div className="px-3 py-2 text-[10px] uppercase tracking-wide text-slate-400 border-t border-slate-100">
                  Area total {formatMeasure(room.areaSubtotalSqFt)} sq.ft
                </div>
              )}
            </div>
          ))}
        </div>

        {/* Financial Summary Box */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-2 text-xs">
          <h3 className="font-bold text-sm text-slate-900 mb-2">Commercial Summary</h3>
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>{formatInr(quotation.subtotalPaise)}</span>
          </div>
          {quotation.discountTotalPaise > 0 && (
            <div className="flex justify-between text-emerald-600 font-medium">
              <span>Discount</span>
              <span>-{formatInr(quotation.discountTotalPaise)}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-600 border-t border-slate-100 pt-2">
            <span>Taxable Value</span>
            <span>{formatInr(quotation.taxableBasePaise)}</span>
          </div>
          {/* The FROZEN tax identity. No invented default rate: showing a rate
              the finalized record does not carry would misstate what is being
              agreed to. */}
          <div className="flex justify-between text-slate-600">
            <span>
              {quotation.taxProfileName} @ {formatMeasure(quotation.taxRatePercentage)}%
            </span>
            <span>{formatInr(quotation.taxTotalPaise)}</span>
          </div>
          <div className="flex justify-between text-slate-900 font-extrabold text-sm border-t border-slate-200 pt-2">
            <span>Grand Total</span>
            <span>{formatInr(quotation.grandTotalPaise)}</span>
          </div>
        </div>

        {/* Payment Schedule */}
        {quotation.paymentSchedule.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
            <h3 className="font-bold text-sm text-slate-900">Payment Schedule</h3>
            <div className="space-y-2 text-xs">
              {quotation.paymentSchedule.map((ps) => (
                <div key={ps.id} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="font-medium text-slate-700">
                    {ps.milestoneName} {ps.percentage ? `(${ps.percentage}%)` : ''}
                  </span>
                  <span className="font-semibold text-slate-900">{formatInr(ps.amountPaise)}</span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* What IS and is NOT included, and the terms being accepted. The
            client must be able to read these on the page where they accept. */}
        {(quotation.inclusions.length > 0 ||
          quotation.exclusions.length > 0 ||
          quotation.termsAndConditions.length > 0) && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-4 text-xs">
            {quotation.inclusions.length > 0 && (
              <div>
                <h3 className="font-bold text-sm text-slate-900 mb-1">Inclusions</h3>
                <ul className="list-disc pl-5 space-y-1 text-slate-600">
                  {quotation.inclusions.map((entry, idx) => (
                    <li key={`inc-${idx}`}>{entry}</li>
                  ))}
                </ul>
              </div>
            )}
            {quotation.exclusions.length > 0 && (
              <div>
                <h3 className="font-bold text-sm text-slate-900 mb-1">Exclusions</h3>
                <ul className="list-disc pl-5 space-y-1 text-slate-600">
                  {quotation.exclusions.map((entry, idx) => (
                    <li key={`exc-${idx}`}>{entry}</li>
                  ))}
                </ul>
              </div>
            )}
            {quotation.termsAndConditions.length > 0 && (
              <div>
                <h3 className="font-bold text-sm text-slate-900 mb-1">Terms &amp; Conditions</h3>
                <ul className="list-disc pl-5 space-y-1 text-slate-600">
                  {quotation.termsAndConditions.map((entry, idx) => (
                    <li key={`trm-${idx}`}>{entry}</li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Client Acceptance Action Form */}
        {!accepted && (
          <div className="bg-white rounded-xl shadow-md border-2 border-amber-400 p-6 space-y-4">
            <h3 className="text-base font-bold text-slate-900">Accept Commercial Quotation</h3>
            <p className="text-xs text-slate-600">
              Please review the commercial breakdown and payment terms above. Confirming acceptance establishes the permanent commercial agreement for your project.
            </p>

            {errorMsg && (
              <div className="bg-rose-50 border border-rose-200 text-rose-700 p-3 rounded-lg text-xs font-medium">
                {errorMsg}
              </div>
            )}

            <form onSubmit={handleAccept} className="space-y-4 text-xs">
              <div>
                <label className="block font-medium text-slate-700 mb-1">Your Full Name *</label>
                <input
                  type="text"
                  required
                  value={clientName}
                  onChange={(e) => setClientName(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="Enter your name"
                />
              </div>

              <div>
                <label className="block font-medium text-slate-700 mb-1">Email Address (Optional)</label>
                <input
                  type="email"
                  value={clientEmail}
                  onChange={(e) => setClientEmail(e.target.value)}
                  className="w-full px-3 py-2 border border-slate-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-amber-500"
                  placeholder="you@example.com"
                />
              </div>

              <div className="flex items-start gap-2 pt-2">
                <input
                  type="checkbox"
                  id="confirm-terms"
                  checked={confirmed}
                  onChange={(e) => setConfirmed(e.target.checked)}
                  className="mt-0.5 rounded border-slate-300 text-amber-500 focus:ring-amber-400"
                />
                <label htmlFor="confirm-terms" className="text-slate-600 leading-tight">
                  I accept the commercial scope, pricing, and payment terms specified in Quotation {quotation.quotationNumber} (v{quotation.versionNumber}).
                </label>
              </div>

              <button
                type="submit"
                disabled={!confirmed || !clientName.trim() || loading}
                className="w-full py-3 bg-amber-500 hover:bg-amber-600 text-slate-900 font-bold text-sm rounded-lg transition-colors disabled:opacity-50 shadow-sm"
              >
                {loading ? 'Processing Acceptance...' : '✓ Confirm & Accept Quotation'}
              </button>
            </form>
          </div>
        )}
      </main>
    </div>
  );
}
