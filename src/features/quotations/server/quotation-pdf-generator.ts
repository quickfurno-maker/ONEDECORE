import crypto from 'node:crypto';
import PDFDocument from 'pdfkit';
import { createAdminClient } from '../../../lib/supabase/service-role.ts';

export interface PDFGeneratorData {
  quotation_id: string;
  quotation_version_id: string;
  quotation_number: string;
  version_number: number;
  finalized_at: string;
  client_name: string;
  client_phone: string;
  property_details: Record<string, unknown>;
  sections: Array<{
    section_name: string;
    section_subtotal_paise: number;
    items: Array<{
      item_name: string;
      description?: string;
      quantity: number;
      uom: string;
      unit_rate_paise: number;
      line_total_paise: number;
    }>;
  }>;
  subtotal_paise: number;
  discount_paise: number;
  taxable_base_paise: number;
  tax_total_paise: number;
  grand_total_paise: number;
  tax_profile_name: string;
  tax_rate_percentage: number;
  payment_schedule: Array<{
    milestone_name: string;
    percentage?: number;
    amount_paise: number;
  }>;
  inclusions: string[];
  exclusions: string[];
  terms_and_conditions: string[];
}

function formatInr(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat('en-IN', {
    style: 'currency',
    currency: 'INR',
    minimumFractionDigits: 2,
  }).format(rupees);
}

export async function renderQuotationPdfBuffer(data: PDFGeneratorData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const doc = new PDFDocument({ margin: 40, size: 'A4' });
      const chunks: Buffer[] = [];

      doc.on('data', (chunk: Buffer) => chunks.push(chunk));
      doc.on('end', () => resolve(Buffer.concat(chunks)));
      doc.on('error', (err) => reject(err));

      // Header
      doc.fontSize(22).font('Helvetica-Bold').fillColor('#0f172a').text('ONEDECORE', 40, 40);
      doc.fontSize(10).font('Helvetica').fillColor('#64748b').text('One Vision. Complete Interiors.', 40, 68);

      doc.fontSize(16).font('Helvetica-Bold').fillColor('#0f172a').text('COMMERCIAL QUOTATION', 350, 40, { align: 'right' });
      doc.fontSize(10).font('Helvetica').fillColor('#64748b').text(`Quotation #: ${data.quotation_number}`, 350, 64, { align: 'right' });
      doc.text(`Version: v${data.version_number}`, 350, 78, { align: 'right' });
      doc.text(`Date: ${new Date(data.finalized_at).toLocaleDateString('en-IN')}`, 350, 92, { align: 'right' });

      doc.moveTo(40, 115).lineTo(555, 115).strokeColor('#cbd5e1').stroke();

      // Client Box
      let y = 130;
      doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a').text('Client Details', 40, y);
      y += 18;
      doc.fontSize(10).font('Helvetica').fillColor('#334155');
      doc.text(`Client Name: ${data.client_name}`, 40, y);
      doc.text(`Phone: ${data.client_phone}`, 300, y);
      y += 25;

      doc.moveTo(40, y).lineTo(555, y).strokeColor('#e2e8f0').stroke();
      y += 15;

      // Scope Sections
      doc.fontSize(13).font('Helvetica-Bold').fillColor('#0f172a').text('Commercial Scope Breakdown', 40, y);
      y += 20;

      for (const sec of data.sections) {
        if (y > 700) {
          doc.addPage();
          y = 40;
        }

        doc.fontSize(11).font('Helvetica-Bold').fillColor('#1e293b').text(sec.section_name, 40, y);
        doc.fontSize(10).font('Helvetica-Bold').fillColor('#0f172a').text(formatInr(sec.section_subtotal_paise), 450, y, { align: 'right' });
        y += 18;

        for (const item of sec.items) {
          if (y > 720) {
            doc.addPage();
            y = 40;
          }

          doc.fontSize(9).font('Helvetica').fillColor('#334155').text(`• ${item.item_name}`, 50, y);
          doc.text(`${item.quantity} ${item.uom} @ ${formatInr(item.unit_rate_paise)}`, 300, y);
          doc.font('Helvetica-Bold').text(formatInr(item.line_total_paise), 450, y, { align: 'right' });
          y += 14;

          if (item.description) {
            doc.fontSize(8).font('Helvetica').fillColor('#64748b').text(item.description, 60, y);
            y += 12;
          }
        }
        y += 8;
      }

      y += 10;
      if (y > 650) {
        doc.addPage();
        y = 40;
      }

      // Financial Summary Box
      doc.moveTo(40, y).lineTo(555, y).strokeColor('#cbd5e1').stroke();
      y += 12;

      doc.fontSize(10).font('Helvetica').fillColor('#334155');
      doc.text('Subtotal:', 300, y);
      doc.text(formatInr(data.subtotal_paise), 450, y, { align: 'right' });
      y += 14;

      if (data.discount_paise > 0) {
        doc.text('Discount:', 300, y);
        doc.text(`-${formatInr(data.discount_paise)}`, 450, y, { align: 'right' });
        y += 14;
      }

      doc.text('Taxable Base (GST Excluded):', 300, y);
      doc.text(formatInr(data.taxable_base_paise), 450, y, { align: 'right' });
      y += 14;

      doc.text(`Tax (${data.tax_profile_name} @ ${data.tax_rate_percentage}%):`, 300, y);
      doc.text(formatInr(data.tax_total_paise), 450, y, { align: 'right' });
      y += 18;

      doc.fontSize(12).font('Helvetica-Bold').fillColor('#0f172a');
      doc.text('Grand Total:', 300, y);
      doc.text(formatInr(data.grand_total_paise), 450, y, { align: 'right' });
      y += 25;

      // Payment Schedule
      if (data.payment_schedule.length > 0) {
        if (y > 680) {
          doc.addPage();
          y = 40;
        }

        doc.fontSize(11).font('Helvetica-Bold').fillColor('#0f172a').text('Payment Schedule', 40, y);
        y += 16;
        doc.fontSize(9).font('Helvetica').fillColor('#334155');

        for (const ps of data.payment_schedule) {
          doc.text(`${ps.milestone_name} ${ps.percentage ? `(${ps.percentage}%)` : ''}`, 50, y);
          doc.font('Helvetica-Bold').text(formatInr(ps.amount_paise), 450, y, { align: 'right' });
          y += 14;
        }
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export async function ensureQuotationPdfArtifact(data: PDFGeneratorData): Promise<{
  objectPath: string;
  pdfSha256: string;
  fileSizeBytes: number;
}> {
  const supabase = createAdminClient();

  // Check if PDF record already exists
  const { data: existingPdf } = await supabase
    .from('quotation_pdf_documents')
    .select('object_path, pdf_sha256, file_size_bytes, status')
    .eq('quotation_version_id', data.quotation_version_id)
    .single();

  if (existingPdf && existingPdf.status === 'ready' && existingPdf.pdf_sha256) {
    return {
      objectPath: existingPdf.object_path,
      pdfSha256: existingPdf.pdf_sha256,
      fileSizeBytes: existingPdf.file_size_bytes || 0,
    };
  }

  // Render PDF Buffer
  const pdfBuffer = await renderQuotationPdfBuffer(data);
  const pdfSha256 = crypto.createHash('sha256').update(pdfBuffer).digest('hex');
  const objectPath = `${data.quotation_id}/${data.quotation_version_id}.pdf`;

  // Upload to quotation-documents bucket
  const { error: uploadErr } = await supabase.storage
    .from('quotation-documents')
    .upload(objectPath, pdfBuffer, {
      contentType: 'application/pdf',
      upsert: true,
    });

  if (uploadErr) {
    console.warn('PDF Storage upload notice (proceeding):', uploadErr.message);
  }

  // Upsert database tracking record
  await supabase.from('quotation_pdf_documents').upsert({
    quotation_id: data.quotation_id,
    quotation_version_id: data.quotation_version_id,
    object_path: objectPath,
    pdf_sha256: pdfSha256,
    file_size_bytes: pdfBuffer.length,
    status: 'ready',
    created_by: '00000000-0000-0000-0000-000000000000',
  });

  return {
    objectPath,
    pdfSha256,
    fileSizeBytes: pdfBuffer.length,
  };
}
