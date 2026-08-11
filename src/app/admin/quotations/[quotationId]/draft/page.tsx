import { notFound } from "next/navigation";
import { QuotationDraftEditor } from "@/features/quotations/components/QuotationDraftEditor";
import {
  getQuotationDraftByQuotationId,
  listActiveTaxProfiles,
} from "@/features/quotations/server/quotation-queries";

interface PageProps {
  params: Promise<{
    quotationId: string;
  }>;
}

export default async function QuotationDraftPage({ params }: PageProps) {
  const { quotationId } = await params;

  let draft;
  let taxProfiles;

  try {
    draft = await getQuotationDraftByQuotationId(quotationId);
    taxProfiles = await listActiveTaxProfiles();
  } catch {
    notFound();
  }

  if (!draft) {
    notFound();
  }

  return (
    <div className="p-6">
      <QuotationDraftEditor initialDraft={draft} taxProfiles={taxProfiles} />
    </div>
  );
}
