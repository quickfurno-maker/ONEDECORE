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
import { randomBytes } from "node:crypto";
import { deflateRawSync } from "node:zlib";
import { describe, test } from "node:test";

import ExcelJS from "exceljs";

import { CrmError } from "../server/crm-errors.ts";
import {
  assertSafeXlsxArchive,
  LEAD_IMPORT_XLSX_LIMITS,
} from "../server/xlsx-archive-preflight.ts";
import { assertBoundedXlsxDecompression } from "../server/xlsx-bounded-decompression.ts";
import { extractXlsxHeadersAndRecords } from "../server/lead-import-file-parser.ts";

// ------------------------------------------------------------ zip building ---

interface ZipEntrySpec {
  readonly name: string;
  readonly content?: string | Buffer;
  /** Override the size the central directory DECLARES, not what is stored. */
  readonly declaredUncompressedBytes?: number;
  readonly declaredCompressedBytes?: number;
  readonly flags?: number;
  readonly diskNumberStart?: number;
  /** 0 stored, 8 deflate, anything else to test rejection. */
  readonly method?: number;
  /** Store the payload verbatim rather than deflating it. */
  readonly stored?: boolean;
  /** Write a different method in the LOCAL header than in the directory. */
  readonly localMethod?: number;
  /** Point the directory at a local header offset that is wrong. */
  readonly localHeaderOffsetOverride?: number;
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
    const raw = Buffer.isBuffer(entry.content)
      ? entry.content
      : Buffer.from(entry.content ?? "", "utf8");
    const stored = entry.stored === true;
    const payload = stored ? raw : deflateRawSync(raw);
    const method = entry.method ?? (stored ? 0 : 8);
    const name = Buffer.from(entry.name, "utf8");
    const flags = entry.flags ?? 0;

    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(flags, 6);
    local.writeUInt16LE(entry.localMethod ?? method, 8);
    local.writeUInt32LE(0, 14); // crc, unchecked by either gate
    local.writeUInt32LE(payload.length, 18);
    local.writeUInt32LE(raw.length, 22);
    local.writeUInt16LE(name.length, 26);
    parts.push(local, name, payload);

    const record = Buffer.alloc(46);
    record.writeUInt32LE(0x02014b50, 0);
    record.writeUInt16LE(20, 4);
    record.writeUInt16LE(20, 6);
    record.writeUInt16LE(flags, 8);
    record.writeUInt16LE(method, 10);
    record.writeUInt32LE(0, 16);
    record.writeUInt32LE(entry.declaredCompressedBytes ?? payload.length, 20);
    record.writeUInt32LE(entry.declaredUncompressedBytes ?? raw.length, 24);
    record.writeUInt16LE(name.length, 28);
    record.writeUInt16LE(entry.diskNumberStart ?? 0, 34);
    record.writeUInt32LE(entry.localHeaderOffsetOverride ?? offset, 42);
    central.push(record, name);

    offset += local.length + name.length + payload.length;
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

// ================================================================= GATE 2 ===
//
// What the bytes ACTUALLY expand to.
//
// Gate 1 reads what the central directory DECLARES, and nothing makes a deflate
// stream honour that claim. Before this gate existed, a 17 KB archive declaring
// 1 MiB inflated to 17 MiB and Gate 1 accepted it. JSZip does eventually notice
// the mismatch, but only once the whole output has been materialised, so the
// declaration bounded the error message rather than the memory.
//
// Payloads here are runtime-generated zero fill: they deflate to a few hundred
// bytes, and Gate 2 counts and discards during inflation, so a test that proves
// a 17 MiB expansion never holds 17 MiB.

const MiB = 1024 * 1024;

/**
 * A payload that really does inflate to `bytes`, at a chosen compression ratio.
 *
 * The ratio matters: a buffer of one repeated byte compresses about 1000:1,
 * which Gate 1 rejects on the declared ratio before Gate 2 is ever reached — so
 * a naive fixture would test the wrong gate. Repeating a random block of
 * `bytes / ratio` gives deflate exactly as much redundancy as asked for, so
 * these archives stay small on disk while being unremarkable to Gate 1.
 */
function expandsTo(bytes: number, ratio = 100): Buffer {
  const blockSize = Math.max(1024, Math.ceil(bytes / ratio));
  const block = randomBytes(blockSize);
  const payload = Buffer.alloc(bytes);
  for (let offset = 0; offset < bytes; offset += blockSize) {
    block.copy(payload, offset, 0, Math.min(blockSize, bytes - offset));
  }
  return payload;
}

/** Run both gates the way the importer does. */
async function runBothGates(archive: Buffer): Promise<void> {
  const entries = assertSafeXlsxArchive(archive);
  await assertBoundedXlsxDecompression(archive, entries);
}

async function assertGate2Rejects(archive: Buffer, expectedDetail: RegExp): Promise<void> {
  // Gate 1 must NOT be what catches these: the whole point is that the
  // declaration looks fine and the bytes do not.
  assert.doesNotThrow(() => assertSafeXlsxArchive(archive), "Gate 1 was expected to accept");
  await assert.rejects(
    () => runBothGates(archive),
    (error: unknown) => {
      assert.ok(error instanceof CrmError);
      assert.equal(error.code, "IMPORT_UNSAFE_ARCHIVE");
      assert.equal(error.httpStatus, 422);
      assert.match(error.details ?? "", expectedDetail);
      assert.doesNotMatch(error.message, /inflate|deflate|entry|limit/i);
      return true;
    }
  );
}

describe("a lying central directory is caught by actual decompression", () => {
  test("declared 1 MiB, actually 17 MiB: Gate 1 accepts, Gate 2 refuses", async () => {
    /*
     * THE REGRESSION. Every Gate 1 limit is satisfied: few entries, 1 MiB
     * declared uncompressed, a declared ratio around 60:1 against the 250:1
     * ceiling. The bytes tell a different story.
     */
    const archive = buildZip([
      ...WORKBOOK_PARTS,
      {
        name: "xl/sharedStrings.xml",
        content: expandsTo(17 * MiB),
        declaredUncompressedBytes: 1 * MiB,
      },
    ]);
    await assertGate2Rejects(archive, /ACTUAL_ENTRY_LIMIT/);
  });

  test("declared smaller than actual, at a size both gates would otherwise allow", async () => {
    // Not about the ceiling: 2 MiB is well inside every limit. The archive is
    // still not what it says it is.
    const archive = buildZip([
      ...WORKBOOK_PARTS,
      {
        name: "xl/sharedStrings.xml",
        content: expandsTo(2 * MiB),
        declaredUncompressedBytes: 64 * 1024,
      },
    ]);
    await assertGate2Rejects(archive, /SIZE_MISMATCH/);
  });

  test("declared larger than actual is refused too", async () => {
    /*
     * The mirror case. A parser reading this archive disagrees with what was
     * measured here, and a gate that bounded only the larger of the two numbers
     * would leave that disagreement unexamined.
     */
    const archive = buildZip([
      ...WORKBOOK_PARTS,
      {
        // Poorly compressible on purpose: an overstated declaration still has
        // to keep the DECLARED ratio inside Gate 1, or Gate 1 catches it first
        // and this stops testing Gate 2.
        name: "xl/sharedStrings.xml",
        content: expandsTo(64 * 1024, 4),
        declaredUncompressedBytes: 1 * MiB,
      },
    ]);
    await assertGate2Rejects(archive, /SIZE_MISMATCH/);
  });

  test("declared exactly actual passes both gates", async () => {
    const archive = buildZip([
      ...WORKBOOK_PARTS,
      { name: "xl/sharedStrings.xml", content: expandsTo(2 * MiB) },
    ]);
    await assert.doesNotReject(() => runBothGates(archive));
  });

  test("the aggregate budget stops a later entry mid-stream", async () => {
    /*
     * Three truthful entries declaring 35 MiB in total would fail Gate 1, so
     * the first two declare truthfully (30 MiB, inside Gate 1) and the third
     * lies small while inflating past what the archive has left.
     *
     * The running aggregate is what makes this stop DURING the third stream
     * rather than after it: the declared-equals-actual check can only run once
     * a stream ends, by which point the work is already done.
     */
    const archive = buildZip([
      ...WORKBOOK_PARTS,
      { name: "xl/a.xml", content: expandsTo(15 * MiB) },
      { name: "xl/b.xml", content: expandsTo(15 * MiB) },
      {
        name: "xl/c.xml",
        content: expandsTo(5 * MiB),
        declaredUncompressedBytes: 1 * MiB,
      },
    ]);
    await assertGate2Rejects(archive, /ACTUAL_TOTAL_LIMIT/);
  });
});

describe("Gate 2 reads each payload safely", () => {
  test("a stored entry is accounted by its real length", async () => {
    // Method 0 expands to itself, so there is nothing to inflate. It still has
    // to be counted, or a 40 MiB stored part would walk straight through.
    const archive = buildZip([
      ...WORKBOOK_PARTS,
      { name: "xl/stored.xml", content: expandsTo(1 * MiB), stored: true },
    ]);
    await assert.doesNotReject(() => runBothGates(archive));
  });

  test("a stored entry past the per-entry ceiling is refused", async () => {
    const archive = buildZip([
      ...WORKBOOK_PARTS,
      {
        name: "xl/stored.xml",
        content: expandsTo(17 * MiB),
        stored: true,
        // The stored payload IS the content, so its compressed size must stay
        // truthful for the slice to cover it. Only the uncompressed claim lies.
        declaredUncompressedBytes: 1 * MiB,
      },
    ]);
    await assertGate2Rejects(archive, /ACTUAL_ENTRY_LIMIT/);
  });

  test("an unsupported compression method is refused", async () => {
    // bzip2. A workbook uses stored and deflate; anything else is a file that
    // will not open, or an attempt to reach a decoder this gate cannot bound.
    const archive = buildZip([
      ...WORKBOOK_PARTS,
      { name: "xl/odd.xml", content: "x", method: 12 },
    ]);
    await assertGate2Rejects(archive, /UNSUPPORTED_COMPRESSION/);
  });

  test("a local header that disagrees about the method is refused", async () => {
    /*
     * One of the two headers is lying, and a parser that trusts the other one
     * reads different bytes than this gate measured.
     */
    const archive = buildZip([
      ...WORKBOOK_PARTS,
      { name: "xl/odd.xml", content: "hello", localMethod: 0 },
    ]);
    await assertGate2Rejects(archive, /MALFORMED_LOCAL_HEADER/);
  });

  test("a directory pointing at a bogus local header is refused", async () => {
    const archive = buildZip([
      ...WORKBOOK_PARTS,
      { name: "xl/odd.xml", content: "hello", localHeaderOffsetOverride: 999_999 },
    ]);
    await assertGate2Rejects(archive, /MALFORMED_LOCAL_HEADER/);
  });

  test("a directory pointing into the middle of another entry is refused", async () => {
    // Inside the file, but not at a local file header.
    const archive = buildZip([
      ...WORKBOOK_PARTS,
      { name: "xl/odd.xml", content: "hello", localHeaderOffsetOverride: 12 },
    ]);
    await assertGate2Rejects(archive, /MALFORMED_LOCAL_HEADER/);
  });
});

describe("a lying archive never reaches the parser either", () => {
  const liars: ReadonlyArray<readonly [string, Buffer]> = [
    [
      "declared 1 MiB, actually 17 MiB",
      buildZip([
        ...WORKBOOK_PARTS,
        {
          name: "xl/sharedStrings.xml",
          content: expandsTo(17 * MiB),
          declaredUncompressedBytes: 1 * MiB,
        },
      ]),
    ],
    [
      "small size mismatch",
      buildZip([
        ...WORKBOOK_PARTS,
        {
          name: "xl/sharedStrings.xml",
          content: expandsTo(2 * MiB),
          declaredUncompressedBytes: 64 * 1024,
        },
      ]),
    ],
    [
      "aggregate overflow",
      buildZip([
        ...WORKBOOK_PARTS,
        { name: "xl/a.xml", content: expandsTo(15 * MiB) },
        { name: "xl/b.xml", content: expandsTo(15 * MiB) },
        { name: "xl/c.xml", content: expandsTo(5 * MiB), declaredUncompressedBytes: 1 * MiB },
      ]),
    ],
    [
      "unsupported method",
      buildZip([...WORKBOOK_PARTS, { name: "xl/odd.xml", content: "x", method: 12 }]),
    ],
  ];

  for (const [label, archive] of liars) {
    test(`${label}: the loader is never called`, async () => {
      let calls = 0;
      await assert.rejects(
        () =>
          extractXlsxHeadersAndRecords(archive, async () => {
            calls += 1;
            throw new Error("the parser should not have been reached");
          }),
        (error: unknown) =>
          error instanceof CrmError && error.code === "IMPORT_UNSAFE_ARCHIVE"
      );
      assert.equal(calls, 0, `${label} reached the parser`);
    });
  }

  test("a real workbook still reaches the parser exactly once", async () => {
    // The other half: both gates together are not simply refusing everything.
    const workbook = new ExcelJS.Workbook();
    const sheet = workbook.addWorksheet("Leads");
    sheet.addRow(["submitted_name", "phone"]);
    sheet.addRow(["Asha", "+919000000001"]);
    const buffer = Buffer.from(await workbook.xlsx.writeBuffer());

    let calls = 0;
    await assert.rejects(() =>
      extractXlsxHeadersAndRecords(buffer, async () => {
        calls += 1;
        throw new Error("stop after the gates");
      })
    );
    assert.equal(calls, 1);
  });
});
