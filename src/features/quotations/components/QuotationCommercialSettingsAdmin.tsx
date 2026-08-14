'use client';

import { useState } from 'react';

interface TaxProfile {
  id: string;
  code: string;
  display_name: string;
  rate_percentage: number;
  is_active: boolean;
}

interface CommercialSettingsAdminProps {
  initialMaxDiscount?: number | null;
  taxProfiles?: TaxProfile[];
  onSaveMaxDiscount?: (discount: number) => Promise<{ success: boolean; message?: string }>;
  onCreateTaxProfile?: (code: string, displayName: string, rate: number) => Promise<{ success: boolean; message?: string }>;
  onUpdateTaxProfile?: (params: {
    taxProfileId: string;
    displayName: string;
    ratePercentage: number;
    isActive: boolean;
  }) => Promise<{ success: boolean; message?: string }>;
}

export function QuotationCommercialSettingsAdmin({
  initialMaxDiscount = null,
  taxProfiles = [],
  onSaveMaxDiscount,
  onCreateTaxProfile,
  onUpdateTaxProfile,
}: CommercialSettingsAdminProps) {
  const [maxDiscount, setMaxDiscount] = useState<string>(
    initialMaxDiscount == null ? '' : String(initialMaxDiscount)
  );
  const [savingDiscount, setSavingDiscount] = useState(false);
  const [discountMsg, setDiscountMsg] = useState<string | null>(null);

  const [code, setCode] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [rate, setRate] = useState('');
  const [savingTax, setSavingTax] = useState(false);
  const [taxMsg, setTaxMsg] = useState<string | null>(null);
  const [updatingId, setUpdatingId] = useState<string | null>(null);

  const handleMaxDiscountSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onSaveMaxDiscount) return;
    setSavingDiscount(true);
    setDiscountMsg(null);

    const val = parseFloat(maxDiscount);
    if (isNaN(val) || val < 0 || val > 100) {
      setDiscountMsg('Max discount must be between 0.00% and 100.00%');
      setSavingDiscount(false);
      return;
    }

    const res = await onSaveMaxDiscount(val);
    setSavingDiscount(false);
    if (res.success) {
      setDiscountMsg('Max discount saved successfully.');
    } else {
      setDiscountMsg(res.message || 'Failed to save max discount.');
    }
  };

  const handleCreateTaxSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!onCreateTaxProfile) return;
    setSavingTax(true);
    setTaxMsg(null);

    const rateVal = parseFloat(rate);
    if (!code || !displayName || isNaN(rateVal) || rateVal < 0 || rateVal > 100) {
      setTaxMsg('Please enter valid tax profile details (rate between 0 and 100).');
      setSavingTax(false);
      return;
    }

    const res = await onCreateTaxProfile(code, displayName, rateVal);
    setSavingTax(false);
    if (res.success) {
      setTaxMsg('Tax profile created successfully.');
      setCode('');
      setDisplayName('');
      setRate('');
    } else {
      setTaxMsg(res.message || 'Failed to create tax profile.');
    }
  };

  const handleToggleActive = async (profile: TaxProfile) => {
    if (!onUpdateTaxProfile) return;
    setUpdatingId(profile.id);
    setTaxMsg(null);
    const res = await onUpdateTaxProfile({
      taxProfileId: profile.id,
      displayName: profile.display_name,
      ratePercentage: profile.rate_percentage,
      isActive: !profile.is_active,
    });
    setUpdatingId(null);
    setTaxMsg(res.success ? 'Tax profile updated.' : res.message || 'Failed to update tax profile.');
  };

  return (
    <div className="bg-neutral-900 border border-neutral-800 rounded-xl p-6 space-y-8 text-neutral-100">
      <h2 className="text-lg font-bold text-amber-400">Super Admin Commercial Settings</h2>

      <section className="space-y-4 border-b border-neutral-800 pb-6">
        <h3 className="text-sm font-semibold text-neutral-200">Maximum Discount Governance Bound</h3>
        <p className="text-xs text-neutral-400">
          Enforces maximum allowed discount percentage across flat and percentage discount types. No production default is seeded.
        </p>
        <form onSubmit={handleMaxDiscountSubmit} className="flex items-center gap-3">
          <div className="relative">
            <input
              type="number"
              step="0.01"
              min="0"
              max="100"
              value={maxDiscount}
              onChange={(e) => setMaxDiscount(e.target.value)}
              placeholder="Set bound"
              className="w-32 rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 text-sm text-neutral-100 focus:outline-none focus:ring-2 focus:ring-amber-500"
            />
            <span className="absolute right-3 top-2.5 text-xs text-neutral-400">%</span>
          </div>
          <button
            type="submit"
            disabled={savingDiscount}
            className="rounded-lg bg-amber-500 px-4 py-2 text-xs font-bold text-neutral-950 hover:bg-amber-400 disabled:opacity-50 transition-colors"
          >
            {savingDiscount ? 'Saving...' : 'Save Max Discount'}
          </button>
        </form>
        {discountMsg && <p className="text-xs text-amber-300">{discountMsg}</p>}
      </section>

      <section className="space-y-4">
        <h3 className="text-sm font-semibold text-neutral-200">Tax Profile Administration</h3>
        <div className="space-y-2">
          {taxProfiles.length === 0 ? (
            <p className="text-xs text-neutral-500">No tax profiles found. Create one below. No GST catalogue is seeded.</p>
          ) : (
            <div className="divide-y divide-neutral-800 border border-neutral-800 rounded-lg overflow-hidden">
              {taxProfiles.map((tp) => (
                <div key={tp.id} className="flex items-center justify-between gap-3 p-3 bg-neutral-950 text-xs">
                  <div>
                    <span className="font-semibold text-neutral-200">{tp.display_name}</span>{' '}
                    <span className="text-neutral-500">({tp.code})</span>
                    <span className="ml-2 font-mono text-amber-400">{tp.rate_percentage}%</span>
                    <span className="ml-2 text-neutral-500">{tp.is_active ? 'active' : 'inactive'}</span>
                  </div>
                  {onUpdateTaxProfile ? (
                    <button
                      type="button"
                      disabled={updatingId === tp.id}
                      onClick={() => handleToggleActive(tp)}
                      className="rounded border border-neutral-700 px-2 py-1 text-[10px] font-semibold text-neutral-300 hover:bg-neutral-800 disabled:opacity-50"
                    >
                      {tp.is_active ? 'Deactivate' : 'Activate'}
                    </button>
                  ) : null}
                </div>
              ))}
            </div>
          )}
        </div>

        <form onSubmit={handleCreateTaxSubmit} className="grid grid-cols-1 md:grid-cols-4 gap-3">
          <input
            type="text"
            placeholder="Code"
            value={code}
            onChange={(e) => setCode(e.target.value)}
            className="rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 text-xs text-neutral-100"
          />
          <input
            type="text"
            placeholder="Display name"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            className="rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 text-xs text-neutral-100"
          />
          <input
            type="number"
            step="0.01"
            placeholder="Rate %"
            value={rate}
            onChange={(e) => setRate(e.target.value)}
            className="rounded-lg bg-neutral-800 border border-neutral-700 px-3 py-2 text-xs text-neutral-100"
          />
          <button
            type="submit"
            disabled={savingTax}
            className="rounded-lg bg-neutral-800 border border-neutral-700 px-4 py-2 text-xs font-bold text-neutral-200 hover:bg-neutral-700 disabled:opacity-50 transition-colors"
          >
            {savingTax ? 'Creating...' : 'Create Tax Profile'}
          </button>
        </form>
        {taxMsg && <p className="text-xs text-amber-300">{taxMsg}</p>}
      </section>
    </div>
  );
}
