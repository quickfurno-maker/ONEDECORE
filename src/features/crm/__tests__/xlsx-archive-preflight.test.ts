/**
 * The XLSX archive gate, exercised against real archives.
 *
 * WHAT THIS SUITE IS FOR
 *
 * `.xlsx` is a ZIP. The import path bounded the upload at 5 MiB and the parsed
 * sheet at 1000 rows x 50 columns, but both row limits are applied to a workbook
 * ExcelJS has already decompressed — they bound the result, not the work. This
 * suite covers the gate that runs first.
 *
 * Every archive here is built byte by byte and stays a few hundred bytes long.
 * The dangerous cases are dangerous in what their central directory DECLARES,
 * which is exactly what the gate reads, so nothing has to actually expand to
 * gigabytes to test the limit that stops gigabytes.
 *
 * The last group is the one that matters most: it proves an unsafe archive is
 * refused BEFORE the parser is called, using an injected loader that records
 * whether it ran. Reading the source and seeing the two calls in the right
 * order would prove nothing about the order they execute in.
 */

import assert from "node:assert/strict";
import { deflateRawSync } from "node:zlib";
import { describe, test } from "node:test";

import ExcelJS from "exceljs";

import { CrmError } from "../server/crm-errors.ts";
import {
  assertSafeXlsxArchive,
  LEAD_IMPORT_XLSX_LIMITS,
} from "../server/xlsx-archive-preflight.ts";
import { extractXlsxHeadersAndRecords } from "../server/lead-import-file-parser.ts";

// ------------------------------------------------------------ zip building ---

interface ZipEntrySpec {
  readonly name: string;
  readonly content?: string;
  /** Override the size the central directory DECLARES, not what is stored. */
  readonly declaredUncompressedBytes?: number;
  readonly declaredCompressedBytes?: number;
  readonly flags?: number;
  readonly diskNumberStart?: number;
}

interface ZipOptions {
  readonly omitEndRecord?: boolean;
  readonly diskNumber?: number;
  readonly centralDirectoryDisk?: number;
  readonly entriesOnThisDisk?: number;
  readonly declaredEntryCount?: number;
  readonly withZip64Locator?: boolean;
  readonly zip64SentinelEntryCount?: boolean;
}

/**
 * Build a ZIP whose central directory can be made to say anything.
 *
 * Real deflate streams are used for the content so valid archives are genuinely
 * valid; the declared-size overrides are what let a 300-byte file claim to hold
 * a gigabyte.
 */
function buildZip(entries: readonly ZipEntrySpec[], options: ZipOptions = {}): Buffer {
  const parts: Buffer[] = [];
  const central: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const raw = Buffer.from(entry.content ?? "", "utf8");
    const deflated = deflateRawSync(raw);
    const name = Buffer.from(entry.name, "utf8");
    const flags = entry.flags ?? 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(8, 8); // deflate
    local.writeUInt32LE(0, 14); // crc, unchecked by the gate
    local.writeUInt32LE(deflated.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    parts.push(local, name, deflated);

    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50, 0);
    record.writeUInt16LE(20, 4);
    record.writeUInt16LE(20, 6);
    record.writeUInt16LE(flags, 8);
    record.writeUInt16LE(8, 10);
    record.writeUInt32LE(0, 16);
    record.writeUInt32LE(entry.declaredCompressedBytes ?? deflated.length, 20);
    record.writeUInt32LE(entry.declaredUncompressedBytes ?? raw.length, 24);
    record.writeUInt16LE(name.length, 28);
    record.writeUInt16LE(entry.diskNumberStart ?? 0, 34);
    record.writeUInt32LE(offset, 42);
    central.push(record, name);

    offset += local.length + name.length + deflated.length;
  }

  const centralBuffer = Buffer.concat(central);
  const body = Buffer.concat([...parts, centralBuffer]);
  if (options.omitEndRecord) {
    return body;
  }

  const count = options.declaredEntryCount ?? entries.length;
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(options.diskNumber ?? 0, 4);
  end.writeUInt16LE(options.centralDirectoryDisk ?? 0, 6);
  end.writeUInt16LE(options.entriesOnThisDisk ?? count, 8);
  end.writeUInt16LE(options.zip64SentinelEntryCount ? 0xffff : count, 10);
  end.writeUInt32LE(centralBuffer.length, 12);
  end.writeUInt32LE(offset, 16);

  if (options.withZip64Locator) {
    // The locator sits immediately before the end record.
    const locator = Buffer.alloc(20);
    locator.writeUInt32LE(0x07064b50, 0);
    return Buffer.concat([body, locator, end]);
  }

  return Buffer.concat([body, end]);
}

/** The parts that make a ZIP recognisably a workbook. */
const WORKBOOK_PARTS: readonly ZipEntrySpec[] = [
  { name: "[Content_Types].xml", content: "<Types/>" },
  { name: "xl/workbook.xml", content: "<workbook/>" },
  { name: "xl/worksheets/sheet1.xml", content: "<worksheet/>" },
];

function validArchive(extra: readonly ZipEntrySpec[] = []): Buffer {
  return buildZip([...WORKBOOK_PARTS, ...extra]);
}

/** Assert the gate refused, and refused for the documented reason. */
function assertRejected(buffer: Buffer, expectedDetail: RegExp): void {
  try {
    assertSafeXlsxArchive(buffer);
  } catch (error) {
    assert.ok(error instanceof CrmError, "expected a CrmError");
    assert.equal(error.code, "IMPORT_UNSAFE_ARCHIVE");
    assert.equal(error.httpStatus, 422);
    assert.match(error.details ?? "", expectedDetail);
    // The caller is told the file was refused, never which check caught it.
    assert.doesNotMatch(error.message, /central directory|ZIP64|ratio|entries/i);
    return;
  }
  assert.fail("archive was accepted");
}

// ------------------------------------------------------------------- shape ---

describe("archives that are not workbooks", () => {
  test("a synthetic workbook archive passes", () => {
    assert.doesNotThrow(() => assertSafeXlsxArchive(validArchive()));
  });

  test("a non-ZIP file is refused", () => {
    // An .xls, a PDF renamed, an HTML table saved with the wrong extension.
    assertRejected(Buffer.from("%PDF-1.7\n".padEnd(200, "x")), /not a ZIP/);
    assertRejected(Buffer.from("\xd0\xcf\x11\xe0".padEnd(200, "x"), "binary"), /not a ZIP/);
  });

  test("a file too short to hold an end record is refused", () => {
    assertRejected(Buffer.from("PK\u0003\u0004"), /shorter than/);
  });

  test("a truncated archive with no end record is refused", () => {
    assertRejected(buildZip(WORKBOOK_PARTS, { omitEndRecord: true }), /end-of-central-directory/);
  });

  test("a multi-disk archive is refused", () => {
    assertRejected(buildZip(WORKBOOK_PARTS, { diskNumber: 1 }), /multi-disk/);
    assertRejected(buildZip(WORKBOOK_PARTS, { centralDirectoryDisk: 2 }), /multi-disk/);
    assertRejected(buildZip(WORKBOOK_PARTS, { entriesOnThisDisk: 1 }), /multi-disk/);
  });

  test("an entry that starts on another disk is refused", () => {
    assertRejected(
      buildZip([...WORKBOOK_PARTS, { name: "xl/styles.xml", content: "<s/>", diskNumberStart: 3 }]),
      /another disk/
    );
  });

  test("ZIP64 is refused rather than parsed", () => {
    // Neither form is legitimate for a 5 MiB import, and supporting them would
    // mean a second parser on the path this gate exists to keep simple.
    assertRejected(buildZip(WORKBOOK_PARTS, { withZip64Locator: true }), /ZIP64/);
    assertRejected(buildZip(WORKBOOK_PARTS, { zip64SentinelEntryCount: true }), /ZIP64/);
    assertRejected(
      buildZip([
        ...WORKBOOK_PARTS,
        { name: "xl/big.xml", content: "x", declaredUncompressedBytes: 0xffffffff },
      ]),
      /ZIP64/
    );
  });

  test("a workbook missing a required part is refused", () => {
    for (const required of ["[Content_Types].xml", "xl/workbook.xml"]) {
      const without = WORKBOOK_PARTS.filter((entry) => entry.name !== required);
      assertRejected(buildZip(without), new RegExp(`missing required part \\${"["}?${required.replace(/[[\]/.]/g, "\\$&")}`));
    }
  });

  test("an archive declaring no entries is refused", () => {
    /*
     * A genuinely empty ZIP is caught earlier, by the missing local file
     * header — it has no entry to start with. This is the malformed case: an
     * archive that carries entries but claims to hold none.
     */
    assertRejected(buildZip([]), /not a ZIP/);
    assertRejected(
      buildZip(WORKBOOK_PARTS, { declaredEntryCount: 0, entriesOnThisDisk: 0 }),
      /no entries/
    );
  });
});

// ------------------------------------------------------------ amplification ---

describe("declared expansion is bounded", () => {
  test("too many entries is refused", () => {
    const many = Array.from(
      { length: LEAD_IMPORT_XLSX_LIMITS.maxEntries + 1 },
      (_unused, index) => ({ name: `xl/part${index}.xml`, content: "<p/>" })
    );
    assertRejected(buildZip([...WORKBOOK_PARTS, ...many]), /entries exceeds/);
  });

  test("one entry declaring more than the per-entry limit is refused", () => {
    // 300 bytes on disk claiming to be 64 MiB.
    assertRejected(
      buildZip([
        ...WORKBOOK_PARTS,
        {
          name: "xl/sharedStrings.xml",
          content: "small",
          declaredUncompressedBytes: 64 * 1024 * 1024,
          declaredCompressedBytes: 1024 * 1024,
        },
      ]),
      /bytes uncompressed/
    );
  });

  test("entries that are each acceptable but together are not is refused", () => {
    // The aggregate limit is the one that actually bounds the damage: without
    // it, four entries at the per-entry ceiling would pass individually.
    const chunk = {
      content: "small",
      declaredUncompressedBytes: 12 * 1024 * 1024,
      declaredCompressedBytes: 1024 * 1024,
    };
    assertRejected(
      buildZip([
        ...WORKBOOK_PARTS,
        { name: "xl/a.xml", ...chunk },
        { name: "xl/b.xml", ...chunk },
        { name: "xl/c.xml", ...chunk },
      ]),
      /bytes uncompressed/
    );
  });

  test("an absurd declared compression ratio is refused", () => {
    assertRejected(
      buildZip([
        ...WORKBOOK_PARTS,
        {
          name: "xl/bomb.xml",
          content: "small",
          declaredCompressedBytes: 1000,
          declaredUncompressedBytes: 1000 * 1000, // 1000:1
        },
      ]),
      /expansion/
    );
  });

  test("content declared from no compressed bytes is refused", () => {
    assertRejected(
      buildZip([
        ...WORKBOOK_PARTS,
        {
          name: "xl/impossible.xml",
          content: "",
          declaredCompressedBytes: 0,
          declaredUncompressedBytes: 5_000_000,
        },
      ]),
      /no compressed bytes/
    );
  });

  test("a legitimately compressible workbook is NOT refused", () => {
    /*
     * The measurement that set the ratio limit: real XML of repeated markup
     * compresses about 70:1, and a limit tuned for tidiness rather than for
     * measured data would reject honest files.
     */
    assert.doesNotThrow(() =>
      assertSafeXlsxArchive(
        buildZip([
          ...WORKBOOK_PARTS,
          {
            name: "xl/sharedStrings.xml",
            content: "x",
            declaredCompressedBytes: 200_000,
            declaredUncompressedBytes: 14_000_000, // 70:1, 13.4 MiB
          },
        ])
      )
    );
  });
});

// -------------------------------------------------------------- entry names ---

describe("entry names that a workbook never has", () => {
  test("an absolute path is refused", () => {
    assertRejected(
      buildZip([...WORKBOOK_PARTS, { name: "/etc/passwd", content: "x" }]),
      /absolute path/
    );
    assertRejected(
      buildZip([...WORKBOOK_PARTS, { name: "C:\\Windows\\system.ini", content: "x" }]),
      /absolute path/
    );
  });

  test("path traversal is refused", () => {
    for (const name of ["../outside.xml", "xl/../../outside.xml", "xl/.."]) {
      assertRejected(buildZip([...WORKBOOK_PARTS, { name, content: "x" }]), /traversal/);
    }
  });

  test("a macro project is refused", () => {
    assertRejected(
      buildZip([...WORKBOOK_PARTS, { name: "xl/vbaProject.bin", content: "MZ" }]),
      /macro/
    );
  });

  test("an encrypted entry is refused", () => {
    assertRejected(
      buildZip([...WORKBOOK_PARTS, { name: "xl/secret.xml", content: "x", flags: 0x0001 }]),
      /encrypted/
    );
  });
});

// ----------------------------------------------------- the ordering guarantee ---

describe("unsafe archives never reach the parser", () => {
  /**
   * A loader that records whether it was called and refuses to do any work.
   * If the gate ran after the parser — or not at all — `calls` would be 1.
   */
  function spyLoader() {
    const state = { calls: 0 };
    const loader = async () => {
      state.calls += 1;
      throw new Error("the parser should not have been reached");
    };
    return { state, loader };
  }

  const unsafeArchives: ReadonlyArray<readonly [string, Buffer]> = [
    ["not a ZIP", Buffer.from("%PDF-1.7\n".padEnd(200, "x"))],
    ["no end record", buildZip(WORKBOOK_PARTS, { omitEndRecord: true })],
    ["multi-disk", buildZip(WORKBOOK_PARTS, { diskNumber: 1 })],
    ["ZIP64", buildZip(WORKBOOK_PARTS, { withZip64Locator: true })],
    [
      "too many entries",
      buildZip([
        ...WORKBOOK_PARTS,
        ...Array.from({ length: LEAD_IMPORT_XLSX_LIMITS.maxEntries + 1 }, (_u, i) => ({
          name: `xl/p${i}.xml`,
          content: "<p/>",
        })),
      ]),
    ],
    [
      "huge single entry",
      buildZip([
        ...WORKBOOK_PARTS,
        {
          name: "xl/big.xml",
          content: "x",
          declaredCompressedBytes: 1024 * 1024,
          declaredUncompressedBytes: 64 * 1024 * 1024,
        },
      ]),
    ],
    [
      "absurd ratio",
      buildZip([
        ...WORKBOOK_PARTS,
        {
          name: "xl/bomb.xml",
          content: "x",
          declaredCompressedBytes: 1000,
          declaredUncompressedBytes: 1_000_000,
        },
      ]),
    ],
    ["macro project", buildZip([...WORKBOOK_PARTS, { name: "xl/vbaProject.bin", content: "MZ" }])],
    [
      "encrypted entry",
      buildZip([...WORKBOOK_PARTS, { name: "xl/x.xml", content: "x", flags: 0x0001 }]),
    ],
    ["traversal", buildZip([...WORKBOOK_PARTS, { name: "../out.xml", content: "x" }])],
    ["missing workbook part", buildZip([WORKBOOK_PARTS[0]!])],
  ];

  for (const [label, archive] of unsafeArchives) {
    test(`${label}: the loader is never called`, async () => {
      const { state, loader } = spyLoader();
      await assert.rejects(
        () => extractXlsxHeadersAndRecords(archive, loader),
        (error: unknown) =>
          error instanceof CrmError && error.code === "IMPORT_UNSAFE_ARCHIVE"
      );
      assert.equal(state.calls, 0, `${label} reached the parser`);
    });
  }

  test("a safe archive DOES reach the parser", () => {
    // The other half of the guarantee: the gate is not simply refusing
    // everything, which would pass every test above.
    let calls = 0;
    const loader = async () => {
      calls += 1;
      throw new Error("stop after the gate");
    };
    return assert
      .rejects(() => extractXlsxHeadersAndRecords(validArchive(), loader))
      .then(() => assert.equal(calls, 1));
  });
});

// ------------------------------------------------------- real workbook path ---

describe("a real workbook still imports", () => {
  async function buildWorkbook(
    rows: number,
    columns: number,
    cell: (row: number, column: number) => string | number
  ): Promise<Buffer> {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Leads");
    sheet.addRow(Array.from({ length: columns }, (_u, c) => `header_${c + 1}`));
    for (let r = 0; r < rows; r += 1) {
      sheet.addRow(Array.from({ length: columns }, (_u, c) => cell(r, c)));
    }
    return Buffer.from(await workbook.xlsx.writeBuffer());
  }

  test("a genuine ExcelJS workbook passes the gate", async () => {
    const buffer = await buildWorkbook(50, 8, (r, c) => `value ${r}-${c}`);
    assert.doesNotThrow(() => assertSafeXlsxArchive(buffer));
  });

  test("a workbook at the contract ceiling passes the gate", async () => {
    /*
     * 1000 x 50 is the largest import the business contract allows, so the
     * limits must not reject it. This is the case the limits were measured
     * against.
     */
    const buffer = await buildWorkbook(
      1000,
      50,
      (r, c) => `value ${r}-${c} +9190000${String(r).padStart(5, "0")}`
    );
    assert.doesNotThrow(() => assertSafeXlsxArchive(buffer));
  });

  test("headers and rows still parse through the gate", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Leads");
    sheet.addRow(["submitted_name", "phone", "service_code"]);
    sheet.addRow(["Asha", "+919000000001", "interiors"]);
    sheet.addRow(["Ravi", "+919000000002", "modular"]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    const result = await extractXlsxHeadersAndRecords(buffer);
    assert.deepEqual(result.headers, ["submitted_name", "phone", "service_code"]);
    assert.equal(result.records.length, 2);
    assert.equal(result.records[0]?.submitted_name, "Asha");
    assert.equal(result.worksheetName, "Leads");
  });

  test("formula rejection still happens after the gate", async () => {
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Leads");
    sheet.addRow(["submitted_name", "phone"]);
    const row = sheet.addRow(["Asha", ""]);
    row.getCell(2).value = { formula: "1+1", result: 2 };
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    await assert.rejects(
      () => extractXlsxHeadersAndRecords(buffer),
      (error: unknown) =>
        error instanceof CrmError && error.code === "IMPORT_FORMULA_REJECTED"
    );
  });
});
