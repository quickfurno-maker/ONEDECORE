import ExcelJS from "exceljs";
import { requireCrmBulkImportAccess } from "@/features/crm/server/crm-auth.ts";
import { fetchActiveLeadSources } from "@/features/crm/server/crm-lead-queries.ts";

export const dynamic = "force-dynamic";

export async function GET(): Promise<Response> {
  await requireCrmBulkImportAccess("/admin/crm/imports");
  const sources = await fetchActiveLeadSources();
  const wb = new ExcelJS.Workbook();
  wb.creator = "ONEDECORE";
  const sheet = wb.addWorksheet("Enquiries", { views: [{ state: "frozen", ySplit: 1 }] });
  sheet.columns = [
    { header: "Name", key: "name", width: 34 },
    { header: "Mobile Number", key: "mobile", width: 26, style: { numFmt: "@" } },
    { header: "Source", key: "source", width: 34, style: { numFmt: "@" } },
  ];
  sheet.autoFilter = { from: "A1", to: "C1" };
  sheet.getRow(1).height = 31;
  sheet.getRow(1).eachCell((cell) => {
    cell.font = { bold: true, color: { argb: "FFFFFFFF" }, size: 12 };
    cell.fill = { type: "pattern", pattern: "solid", fgColor: { argb: "FF19253B" } };
  });
  const choices = wb.addWorksheet("Sources");
  choices.getColumn(1).width = 38;
  choices.getCell("A1").value = "Active CRM Sources";
  choices.getCell("A1").font = { bold: true };
  sources.forEach((source, i) => { choices.getCell(i + 2, 1).value = source.displayName; });
  const how = wb.addWorksheet("Instructions");
  how.getColumn(1).width = 25;
  how.getColumn(2).width = 92;
  [
    ["ONEDECORE BULK ENQUIRY", ""],
    ["Name", "Required - paste customer names in A."],
    ["Mobile Number", "Required - Indian 10-digit numbers. +91, 91, leading 0, spaces accepted."],
    ["Source", "Optional - choose a CRM source per row, or leave blank for upload default."],
    ["Add Source", "Use Add Source in CRM, then download a refreshed template."],
    ["Safety", "Unknown sources rejected; import never grants WhatsApp marketing consent."],
  ].forEach((line) => how.addRow(line));
  how.getCell("A1").font = { bold: true, size: 15, color: { argb: "FF19253B" } };
  if (sources.length) wb.definedNames.add("Sources!$A$2:$A$" + (sources.length + 1), "OneDecoreSources");
  for (let row = 2; row <= 1001; row++) {
    for (let col = 1; col <= 3; col++) sheet.getCell(row, col).numFmt = "@";
    if (sources.length) {
      sheet.getCell(row, 3).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: ["OneDecoreSources"],
        showErrorMessage: false,
        showInputMessage: true,
        promptTitle: "CRM Source",
        prompt: "Choose an active source or leave blank.",
      };
    }
  }
  const bytes = Buffer.from(await wb.xlsx.writeBuffer());
  return new Response(bytes, {
    headers: {
      "Content-Type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
      "Content-Disposition": 'attachment; filename="ONEDECORE_Bulk_Enquiries_With_Source.xlsx"',
      "Cache-Control": "private, no-store",
      "X-Content-Type-Options": "nosniff",
    },
  });
}
