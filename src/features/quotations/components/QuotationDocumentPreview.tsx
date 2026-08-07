"use client";

import type { QuotationFinalSnapshot } from "../contracts/snapshot.ts";
import { renderQuotationDocumentHtml } from "../pdf/render-quotation-document-html.ts";

interface QuotationDocumentPreviewProps {
  readonly snapshot: QuotationFinalSnapshot;
}

export function QuotationDocumentPreview({ snapshot }: QuotationDocumentPreviewProps) {
  const html = renderQuotationDocumentHtml(snapshot);

  return (
    <section aria-label="Quotation document preview" className="rounded-xl border border-neutral-700 bg-white">
      <iframe
        title="Quotation preview"
        className="h-[720px] w-full rounded-xl bg-white"
        sandbox=""
        srcDoc={html}
      />
    </section>
  );
}
