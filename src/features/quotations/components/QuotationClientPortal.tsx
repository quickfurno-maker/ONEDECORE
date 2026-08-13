'use client';

import React, { useState } from 'react';
import { acceptQuotationByCapabilityAction } from '../server/quotation-acceptance-actions';

interface QuotationClientPortalProps {
  token: string;
  quotation: {
    quotation_number: string;
    version_number: number;
    finalized_at: string;
    client_name: string;
    client_phone: string;
    property_details: Record<string, unknown>;
    subtotal_paise: number;
    discount_paise: number;
    taxable_base_paise: number;
    tax_total_paise: number;
    grand_total_paise: number;
    tax_profile: { display_name: string; tax_rate_percentage: number };
    sections: Array<{
      id: string;
      section_name: string;
      section_subtotal_paise: number;
      items: Array<{
        id: string;
        item_name: string;
        description?: string;
        quantity: number;
        uom: string;
        unit_rate_paise: number;
        line_total_paise: number;
      }>;
    }>;
    payment_schedule: Array<{
      id: string;
      milestone_name: string;
      percentage?: number;
      amount_paise: number;
    }>;
    inclusions: string[];
    exclusions: string[];
    terms_and_conditions: string[];
    has_pdf: boolean;
    is_accepted: boolean;
    accepted_at?: string;
  };
}

function formatInr(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(rupees);
}

export default function QuotationClientPortal({ token, quotation }: QuotationClientPortalProps) {
  const [accepted, setAccepted] = useState(quotation.is_accepted);
  const [acceptedAt, setAcceptedAt] = useState(quotation.accepted_at || '');
  const [clientName, setClientName] = useState(quotation.client_name || '');
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
              v{quotation.version_number}
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
            {quotation.has_pdf && (
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
              <h2 className="text-lg font-bold text-slate-900">{quotation.quotation_number}</h2>
              <p className="text-xs text-slate-500">
                Finalized: {new Date(quotation.finalized_at).toLocaleDateString('en-IN')}
              </p>
            </div>
            <div className="text-right">
              <span className="text-xs text-slate-500 block">Total Investment</span>
              <span className="text-xl font-extrabold text-slate-900">{formatInr(quotation.grand_total_paise)}</span>
            </div>
          </div>

          <div className="border-t border-slate-100 pt-3 text-xs text-slate-600 flex justify-between">
            <span>Client: {quotation.client_name}</span>
            <span>Phone: {quotation.client_phone}</span>
          </div>
        </div>

        {/* Scope Sections */}
        <div className="space-y-4">
          <h3 className="text-sm font-bold uppercase tracking-wider text-slate-500 px-1">Scope Breakdown</h3>
          {quotation.sections.map((sec) => (
            <div key={sec.id} className="bg-white rounded-xl shadow-sm border border-slate-200 overflow-hidden">
              <div className="bg-slate-50 px-4 py-3 border-b border-slate-100 flex justify-between items-center">
                <h4 className="font-semibold text-sm text-slate-800">{sec.section_name}</h4>
                <span className="text-xs font-medium text-slate-600">{formatInr(sec.section_subtotal_paise)}</span>
              </div>
              <div className="divide-y divide-slate-100">
                {sec.items.map((item) => (
                  <div key={item.id} className="p-3 text-xs flex justify-between items-start">
                    <div className="space-y-0.5">
                      <div className="font-medium text-slate-800">{item.item_name}</div>
                      {item.description && <div className="text-slate-500">{item.description}</div>}
                      <div className="text-slate-400">
                        {item.quantity} {item.uom} @ {formatInr(item.unit_rate_paise)}
                      </div>
                    </div>
                    <div className="font-semibold text-slate-900">{formatInr(item.line_total_paise)}</div>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>

        {/* Financial Summary Box */}
        <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-2 text-xs">
          <h3 className="font-bold text-sm text-slate-900 mb-2">Commercial Summary</h3>
          <div className="flex justify-between text-slate-600">
            <span>Subtotal</span>
            <span>{formatInr(quotation.subtotal_paise)}</span>
          </div>
          {quotation.discount_paise > 0 && (
            <div className="flex justify-between text-emerald-600 font-medium">
              <span>Discount</span>
              <span>-{formatInr(quotation.discount_paise)}</span>
            </div>
          )}
          <div className="flex justify-between text-slate-600 border-t border-slate-100 pt-2">
            <span>Taxable Base (GST Excluded)</span>
            <span>{formatInr(quotation.taxable_base_paise)}</span>
          </div>
          <div className="flex justify-between text-slate-600">
            <span>GST ({quotation.tax_profile?.display_name || 'Tax'} @ {quotation.tax_profile?.tax_rate_percentage || 18}%)</span>
            <span>{formatInr(quotation.tax_total_paise)}</span>
          </div>
          <div className="flex justify-between text-slate-900 font-extrabold text-sm border-t border-slate-200 pt-2">
            <span>Grand Total</span>
            <span>{formatInr(quotation.grand_total_paise)}</span>
          </div>
        </div>

        {/* Payment Schedule */}
        {quotation.payment_schedule.length > 0 && (
          <div className="bg-white rounded-xl shadow-sm border border-slate-200 p-5 space-y-3">
            <h3 className="font-bold text-sm text-slate-900">Payment Schedule</h3>
            <div className="space-y-2 text-xs">
              {quotation.payment_schedule.map((ps) => (
                <div key={ps.id} className="flex justify-between items-center bg-slate-50 p-2.5 rounded-lg border border-slate-100">
                  <span className="font-medium text-slate-700">
                    {ps.milestone_name} {ps.percentage ? `(${ps.percentage}%)` : ''}
                  </span>
                  <span className="font-semibold text-slate-900">{formatInr(ps.amount_paise)}</span>
                </div>
              ))}
            </div>
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
                  I accept the commercial scope, pricing, and payment terms specified in Quotation {quotation.quotation_number} (v{quotation.version_number}).
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
