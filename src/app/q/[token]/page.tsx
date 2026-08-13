import React, { ComponentProps } from 'react';
import QuotationClientPortal from '@/features/quotations/components/QuotationClientPortal';
import { getQuotationByCapabilityAction } from '@/features/quotations/server/quotation-acceptance-actions';

interface ClientPortalPageProps {
  params: Promise<{
    token: string;
  }>;
}

export default async function ClientPortalPage({ params }: ClientPortalPageProps) {
  const { token } = await params;
  const res = await getQuotationByCapabilityAction(token);

  if (!res.success || !res.data) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-xl shadow-md p-6 text-center border border-slate-200">
          <div className="w-12 h-12 rounded-full bg-amber-100 text-amber-600 flex items-center justify-center mx-auto mb-4 font-bold text-xl">
            !
          </div>
          <h1 className="text-xl font-semibold text-slate-800 mb-2">Link Expired or Invalid</h1>
          <p className="text-sm text-slate-600 mb-6">
            This quotation link is no longer active or may have been updated to a newer revision. Please contact your ONEDECORE design team for assistance.
          </p>
          <div className="text-xs text-slate-400">ONEDECORE Client Portal</div>
        </div>
      </div>
    );
  }

  const clientQuotation = (res.data as unknown) as ComponentProps<typeof QuotationClientPortal>['quotation'];
  return <QuotationClientPortal token={token} quotation={clientQuotation} />;
}
