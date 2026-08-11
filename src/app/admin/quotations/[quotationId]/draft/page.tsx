import { notFound } from "next/navigation";
import { QuotationDraftEditor } from "@/features/quotations/components/QuotationDraftEditor";
import {
  getQuotationDraftByQuotationId,
  listActiveTaxProfiles,
} from "@/features/quotations/server/quotation-queries";

export const metadata = {
  title: "Quotation Draft Editor | OneDecore Admin",
};

interface PageProps {
  readonly params: Promise<{ readonly quotationId: string }>;
}

export default async function QuotationDraftPage({ params }: PageProps) {
  const { quotationId } = await params;

  try {
    const draft = await getQuotationDraftByQuotationId(quotationId);
    const taxProfiles = await listActiveTaxProfiles();

    return (
      <div className="p-6">
        <QuotationDraftEditor initialDraft={draft} taxProfiles={taxProfiles} />
      </div>
    );
  } catch {
    notFound();
  }
}
