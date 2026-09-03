import crypto from "node:crypto";
import PDFDocument from "pdfkit";

export interface PDFGeneratorData {
  quotation_id: string;
  quotation_version_id: string;
  quotation_number: string;
  version_number: number;
  finalized_at: string;
  client_name: string;
  client_phone: string;
  property_details: Record<string, unknown>;
  /**
   * Rooms, in order. ONEDECORE quotes room-wise, so a "section" IS a room and
   * an "item" IS an interior work item.
   */
  sections: Array<{
    section_name: string;
    section_subtotal_paise: number;
    /** Total AREA of the area-basis items in this room, in sq.ft. */
    area_subtotal_sqft?: number;
    items: Array<{
      item_name: string;
      description?: string;
      specifications?: string;
      calculation_basis?: "area" | "quantity" | "fixed";
      width_ft?: number | null;
      height_ft?: number | null;
      area_sqft?: number | null;
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

export type QuotationPdfStorageUploader = {
  upload: (
    objectPath: string,
    body: Buffer,
    options: { contentType: string; upsert: boolean }
  ) => Promise<{ error: { message: string } | null }>;
};

/**
 * An em dash, not a zero.
 *
 * A fixed-price TV unit has no width, and printing "0.00" in that column would
 * read as a measurement of zero rather than "not applicable" — on a document
 * the client signs.
 */
const EM_DASH = "\u2014";

function formatInr(paise: number): string {
  const rupees = paise / 100;
  return new Intl.NumberFormat("en-IN", {
    style: "currency",
    currency: "INR",
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(rupees);
}

/** Trims trailing zeros so "5 NOS" does not print as "5.000 NOS". */
function formatMeasure(value: number, decimals: number): string {
  const fixed = value.toFixed(decimals);
  return fixed.includes(".") ? fixed.replace(/0+$/, "").replace(/\.$/, "") : fixed;
}

function formatFeetCell(value: number | null | undefined): string {
  if (value == null || !Number.isFinite(value) || value <= 0) {
    return EM_DASH;
  }
  return value.toFixed(2);
}

type InteriorPdfItem = PDFGeneratorData["sections"][number]["items"][number];

/**
 * The six cells of one interior work-item row, in the owner's column order:
 * PARTICULAR | W (FT) | H (FT) | AREA / QTY | RATE | AMOUNT
 *
 * The calculation basis shows through what the cells CONTAIN rather than a
 * seventh column, which would cost width the particular badly needs.
 */
function interiorRowCells(item: InteriorPdfItem): readonly string[] {
  const basis = item.calculation_basis ?? "quantity";

  if (basis === "fixed") {
    return [item.item_name, EM_DASH, EM_DASH, "FIXED", EM_DASH, formatInr(item.line_total_paise)];
  }

  if (basis === "area") {
    const area =
      item.area_sqft != null && Number.isFinite(item.area_sqft)
        ? item.area_sqft
        : Number(item.quantity);
    return [
      item.item_name,
      formatFeetCell(item.width_ft),
      formatFeetCell(item.height_ft),
      `${formatMeasure(area, 2)} SQ.FT`,
      `${formatInr(item.unit_rate_paise)} / SQ.FT`,
      formatInr(item.line_total_paise),
    ];
  }

  const unit = (item.uom || "nos").toUpperCase();
  return [
    item.item_name,
    EM_DASH,
    EM_DASH,
    `${formatMeasure(Number(item.quantity), 3)} ${unit}`,
    `${formatInr(item.unit_rate_paise)} / ${unit}`,
    formatInr(item.line_total_paise),
  ];
}

function formatFrozenDate(iso: string): string {
  const d = new Date(iso);
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, "0");
  const day = String(d.getUTCDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

export async function renderQuotationPdfBuffer(data: PDFGeneratorData): Promise<Buffer> {
  return new Promise((resolve, reject) => {
    try {
      const frozenDate = new Date(data.finalized_at);
      const doc = new PDFDocument({
        margin: 40,
        size: "A4",
        pdfVersion: "1.4",
        autoFirstPage: true,
        info: {
          Title: `ONEDECORE Quotation ${data.quotation_number} v${data.version_number}`,
          Author: "ONEDECORE",
          Subject: "Commercial Quotation",
          Keywords: `${data.quotation_id}|${data.quotation_version_id}`,
          Creator: "ONEDECORE",
          Producer: "ONEDECORE",
          CreationDate: frozenDate,
          ModDate: frozenDate,
        },
      });

      const stableId = crypto
        .createHash("md5")
        .update(`odq-pdf-id|${data.quotation_version_id}|${data.finalized_at}|${data.quotation_number}`)
        .digest();
      (doc as unknown as { _id: Buffer })._id = stableId;

      const chunks: Buffer[] = [];
      doc.on("data", (chunk: Buffer) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));
      doc.on("error", (err) => reject(err));

      doc.fontSize(22).font("Helvetica-Bold").fillColor("#0f172a").text("ONEDECORE", 40, 40);
      doc.fontSize(10).font("Helvetica").fillColor("#64748b").text("One Vision. Complete Interiors.", 40, 68);

      doc.fontSize(16).font("Helvetica-Bold").fillColor("#0f172a").text("COMMERCIAL QUOTATION", 350, 40, { align: "right" });
      doc.fontSize(10).font("Helvetica").fillColor("#64748b").text(`Quotation #: ${data.quotation_number}`, 350, 64, { align: "right" });
      doc.text(`Version: v${data.version_number}`, 350, 78, { align: "right" });
      doc.text(`Date: ${formatFrozenDate(data.finalized_at)}`, 350, 92, { align: "right" });

      doc.moveTo(40, 115).lineTo(555, 115).strokeColor("#cbd5e1").stroke();

      let y = 130;
      doc.fontSize(12).font("Helvetica-Bold").fillColor("#0f172a").text("Client Details", 40, y);
      y += 18;
      doc.fontSize(10).font("Helvetica").fillColor("#334155");
      doc.text(`Client Name: ${data.client_name}`, 40, y);
      doc.text(`Phone: ${data.client_phone}`, 300, y);
      y += 25;

      doc.moveTo(40, y).lineTo(555, y).strokeColor("#e2e8f0").stroke();
      y += 15;

      doc.fontSize(13).font("Helvetica-Bold").fillColor("#0f172a").text("Room-wise Interior Estimate", 40, y);
      y += 20;

      // PARTICULAR | W (FT) | H (FT) | AREA / QTY | RATE | AMOUNT
      const COLS = [
        { x: 40, w: 178, align: "left" as const },
        { x: 222, w: 44, align: "right" as const },
        { x: 268, w: 44, align: "right" as const },
        { x: 314, w: 80, align: "right" as const },
        { x: 396, w: 80, align: "right" as const },
        { x: 478, w: 77, align: "right" as const },
      ];
      const HEADERS = ["PARTICULAR", "W (FT)", "H (FT)", "AREA / QTY", "RATE", "AMOUNT"];
      const PAGE_BOTTOM = 745;

      const drawItemsHeader = (top: number): number => {
        doc.fontSize(7.5).font("Helvetica-Bold").fillColor("#64748b");
        HEADERS.forEach((label, idx) => {
          doc.text(label, COLS[idx].x, top, { width: COLS[idx].w, align: COLS[idx].align });
        });
        doc.moveTo(40, top + 11).lineTo(555, top + 11).strokeColor("#e2e8f0").stroke();
        return top + 16;
      };

      const drawRoomHeading = (name: string, top: number, isContinued: boolean): number => {
        doc
          .fontSize(11)
          .font("Helvetica-Bold")
          .fillColor("#1e293b")
          .text(isContinued ? `${name} (continued)` : name, 40, top, { width: 380 });
        return top + 16;
      };

      for (const sec of data.sections) {
        // Keep a short room whole where it fits: a heading stranded at the
        // bottom of a page with its first item overleaf reads as an error.
        const estimatedRoomHeight = 32 + sec.items.length * 15 + 22;
        if (y + estimatedRoomHeight > PAGE_BOTTOM && y > 560) {
          doc.addPage();
          y = 40;
        } else if (y > PAGE_BOTTOM - 70) {
          doc.addPage();
          y = 40;
        }

        y = drawRoomHeading(sec.section_name, y, false);
        y = drawItemsHeader(y);

        for (const item of sec.items) {
          const cells = interiorRowCells(item);
          const detail = [item.description, item.specifications]
            .map((part) => (part ? part.trim() : ""))
            .filter((part) => part.length > 0)
            .join(" \u2022 ");
          const rowHeight = detail ? 25 : 14;

          if (y + rowHeight > PAGE_BOTTOM) {
            doc.addPage();
            y = 40;
            // The reader must not have to page back to learn which room this is
            // or what the columns mean.
            y = drawRoomHeading(sec.section_name, y, true);
            y = drawItemsHeader(y);
          }

          doc.fontSize(8.5).fillColor("#334155");
          cells.forEach((cell, idx) => {
            doc.font(idx === 5 ? "Helvetica-Bold" : "Helvetica");
            doc.text(cell, COLS[idx].x, y, {
              width: COLS[idx].w,
              align: COLS[idx].align,
              lineBreak: false,
            });
          });
          y += 13;

          if (detail) {
            doc.fontSize(7.5).font("Helvetica").fillColor("#94a3b8");
            doc.text(detail, 48, y, { width: 420, lineBreak: false });
            y += 11;
          }
        }

        doc.moveTo(40, y + 2).lineTo(555, y + 2).strokeColor("#e2e8f0").stroke();
        y += 7;

        const areaSubtotal = sec.area_subtotal_sqft ?? 0;
        doc.fontSize(8.5).font("Helvetica").fillColor("#64748b");
        if (areaSubtotal > 0) {
          doc.text(`AREA TOTAL  ${formatMeasure(areaSubtotal, 2)} SQ.FT`, 40, y, { width: 300 });
        }
        doc.font("Helvetica-Bold").fillColor("#0f172a");
        doc.text("ROOM SUBTOTAL", COLS[4].x - 40, y, { width: COLS[4].w + 40, align: "right" });
        doc.text(formatInr(sec.section_subtotal_paise), COLS[5].x, y, {
          width: COLS[5].w,
          align: "right",
        });
        y += 22;
      }

      y += 10;
      if (y > 650) {
        doc.addPage();
        y = 40;
      }

      doc.moveTo(40, y).lineTo(555, y).strokeColor("#cbd5e1").stroke();
      y += 12;

      doc.fontSize(10).font("Helvetica").fillColor("#334155");
      doc.text("Subtotal:", 300, y);
      doc.text(formatInr(data.subtotal_paise), 450, y, { align: "right" });
      y += 14;

      if (data.discount_paise > 0) {
        doc.text("Discount:", 300, y);
        doc.text(`-${formatInr(data.discount_paise)}`, 450, y, { align: "right" });
        y += 14;
      }

      doc.text("Taxable Base (GST Excluded):", 300, y);
      doc.text(formatInr(data.taxable_base_paise), 450, y, { align: "right" });
      y += 14;

      doc.text(`Tax (${data.tax_profile_name} @ ${data.tax_rate_percentage}%):`, 300, y);
      doc.text(formatInr(data.tax_total_paise), 450, y, { align: "right" });
      y += 18;

      doc.fontSize(12).font("Helvetica-Bold").fillColor("#0f172a");
      doc.text("Grand Total:", 300, y);
      doc.text(formatInr(data.grand_total_paise), 450, y, { align: "right" });
      y += 25;

      if (data.payment_schedule.length > 0) {
        if (y > 680) {
          doc.addPage();
          y = 40;
        }

        doc.fontSize(11).font("Helvetica-Bold").fillColor("#0f172a").text("Payment Schedule", 40, y);
        y += 16;
        doc.fontSize(9).font("Helvetica").fillColor("#334155");

        for (const ps of data.payment_schedule) {
          doc.text(`${ps.milestone_name} ${ps.percentage ? `(${ps.percentage}%)` : ""}`, 50, y);
          doc.font("Helvetica-Bold").text(formatInr(ps.amount_paise), 450, y, { align: "right" });
          y += 14;
        }
      }

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export type QuotationPdfRpcClient = {
  rpc: (
    fn: string,
    args: Record<string, unknown>
  ) => Promise<{ data: unknown; error: { message: string } | null }>;
};

export async function ensureQuotationPdfArtifact(
  data: PDFGeneratorData,
  deps: {
    storageUploader?: QuotationPdfStorageUploader;
    rpcClient?: QuotationPdfRpcClient;
  } = {}
): Promise<{
  objectPath: string;
  pdfSha256: string;
  fileSizeBytes: number;
  createdBy: string;
  skippedRender: boolean;
}> {
  const client: QuotationPdfRpcClient = deps.rpcClient ?? {
    rpc: async (fn, args) => {
      const { createClient } = await import("../../../lib/supabase/server.ts");
      const supabase = await createClient();
      const result = await supabase.rpc(fn as never, args as never);
      return { data: result.data, error: result.error };
    },
  };

  const { data: reserved, error: reserveErr } = await client.rpc("reserve_quotation_pdf_document", {
    p_version_id: data.quotation_version_id,
  });

  const reservedObj = reserved as Record<string, unknown> | null;
  if (reserveErr || !reservedObj || reservedObj.success !== true) {
    throw new Error(reserveErr?.message || "Failed to reserve quotation PDF document.");
  }

  if (reservedObj.status === "ready" && typeof reservedObj.pdf_sha256 === "string") {
    return {
      objectPath: String(reservedObj.object_path),
      pdfSha256: String(reservedObj.pdf_sha256),
      fileSizeBytes: Number(reservedObj.file_size_bytes || 0),
      createdBy: String(reservedObj.created_by || ""),
      skippedRender: true,
    };
  }

  const pdfBuffer = await renderQuotationPdfBuffer(data);
  const pdfSha256 = crypto.createHash("sha256").update(pdfBuffer).digest("hex");
  const objectPath = String(reservedObj.object_path || `${data.quotation_id}/${data.quotation_version_id}.pdf`);

  const uploader =
    deps.storageUploader ??
    ({
      async upload(path, body, options) {
        const { createAdminClient } = await import("../../../lib/supabase/service-role.ts");
        const admin = createAdminClient();
        const { error } = await admin.storage.from("quotation-documents").upload(path, body, {
          contentType: options.contentType,
          upsert: options.upsert,
        });
        return { error: error ? { message: error.message } : null };
      },
    } satisfies QuotationPdfStorageUploader);

  const { error: uploadErr } = await uploader.upload(objectPath, pdfBuffer, {
    contentType: "application/pdf",
    upsert: false,
  });

  if (uploadErr) {
    throw new Error(`PDF_UPLOAD_FAILED: ${uploadErr.message}`);
  }

  const { data: readyRow, error: readyErr } = await client.rpc("mark_quotation_pdf_document_ready", {
    p_pdf_id: String(reservedObj.pdf_id),
    p_object_path: objectPath,
    p_pdf_sha256: pdfSha256,
    p_file_size_bytes: pdfBuffer.length,
  });

  if (readyErr || !readyRow) {
    throw new Error(
      `PDF_READY_BINDING_AMBIGUOUS: Storage object uploaded but READY binding failed. RECOVERY_REQUIRED. ${readyErr?.message || ""}`.trim()
    );
  }

  const readyObj = readyRow as Record<string, unknown>;
  return {
    objectPath,
    pdfSha256,
    fileSizeBytes: pdfBuffer.length,
    createdBy: String(readyObj.created_by || reservedObj.created_by || ""),
    skippedRender: false,
  };
}
