import "server-only";

/**
 * What an uploaded XLSX is allowed to be, decided before anything unpacks it.
 *
 * THE GAP THIS CLOSES
 *
 * A .xlsx file is a ZIP archive. The import path already bounds the file at
 * 5 MiB and the parsed sheet at 1000 rows x 50 columns — but those row and
 * column limits are applied to a workbook ExcelJS has ALREADY loaded, which
 * means they bound the result of decompression, not decompression itself. A
 * small archive whose central directory declares gigabytes of content reaches
 * the parser first and the limits second.
 *
 * So this runs before `Workbook.xlsx.load`, reads only the ZIP central
 * directory, and decompresses nothing.
 *
 * WHAT IT DOES AND DOES NOT PROVE
 *
 * The central directory records each entry's DECLARED compressed and
 * uncompressed size. Checking those bounds the amplification available to the
 * ordinary constructions — a nested or repeated-block bomb, an archive with a
 * hundred thousand members, a single member claiming to expand to gigabytes.
 * That is a material improvement over having no bound at all.
 *
 * It is not a proof. A deflate stream can declare one size and produce another,
 * and nothing short of decompressing with a hard output cap would catch that.
 * If that becomes the threat worth spending on, the answer is a streaming
 * parser with an output ceiling, not a bigger table of limits here. This file
 * should not be described as making XLSX denial-of-service impossible.
 *
 * The upload is already restricted to super admins. That narrows who can reach
 * this code; it does not make the workbook trustworthy, because the workbook
 * usually came from somewhere else — a portal export, an agency, a client.
 */

import { CrmError } from "./crm-errors.ts";

/**
 * Archive limits, derived from the business contract rather than chosen for
 * roundness.
 *
 * Measured against workbooks written at the contract ceiling of 1000 rows x 50
 * columns:
 *
 *   realistic lead data   16 entries   3.7 MiB total   2.0 MiB largest    20x
 *   high-entropy cells    16 entries   3.5 MiB total   1.8 MiB largest    12x
 *   200-character cells   16 entries  12.3 MiB total  10.6 MiB largest    71x
 *
 * The third case is the one that matters: a legitimate workbook whose cells
 * hold long pasted text really does expand past 12 MiB and really does compress
 * at 71:1, because XML full of repeated markup is extremely compressible. Limits
 * set at the tidier end of the suggested range would have rejected it.
 *
 * The headroom above those measurements is for workbooks produced by Excel,
 * LibreOffice and Sheets rather than by this repository's own writer — they
 * carry more parts (calcChain, printer settings, several sheets) than ExcelJS
 * emits.
 */
export const LEAD_IMPORT_XLSX_LIMITS = {
  /** Members in the archive. A real workbook has tens, not hundreds. */
  maxEntries: 256,
  /** Any single member, uncompressed. Measured worst case 10.6 MiB. */
  maxEntryUncompressedBytes: 16 * 1024 * 1024,
  /** Every member together, uncompressed. Measured worst case 12.3 MiB. */
  maxTotalUncompressedBytes: 32 * 1024 * 1024,
  /**
   * Declared expansion for a single member. Measured worst case 71x on
   * legitimate content; a classic bomb runs three or four orders of magnitude
   * higher, so this separates them with room to spare.
   */
  maxEntryCompressionRatio: 250,
} as const;

/**
 * The parts every XLSX has. Their absence means the file is not a workbook,
 * whatever its extension says.
 */
const REQUIRED_ENTRIES = ["[Content_Types].xml", "xl/workbook.xml"] as const;

/** Macro storage. Never legitimate in an import, and worth naming explicitly. */
const MACRO_ENTRY = "xl/vbaproject.bin";

const LOCAL_FILE_HEADER = 0x04034b50;
const CENTRAL_DIRECTORY_HEADER = 0x02014b50;
const END_OF_CENTRAL_DIRECTORY = 0x06054b50;
const ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR = 0x07064b50;

/** Sentinels a ZIP uses when a real value needs the ZIP64 extension. */
const UINT16_SENTINEL = 0xffff;
const UINT32_SENTINEL = 0xffffffff;

const EOCD_MINIMUM_LENGTH = 22;
const CENTRAL_DIRECTORY_ENTRY_MINIMUM_LENGTH = 46;

/** General purpose bit 0: the entry is encrypted. */
const FLAG_ENCRYPTED = 0x0001;

function reject(detail: string): never {
  /*
   * One code and one message for every structural rejection. The caller is a
   * super admin who needs to know the file was refused, not which byte gave it
   * away; a per-reason code would also let someone probe the checks. The detail
   * goes in the thrown error's cause for the server log.
   */
  throw new CrmError({
    code: "IMPORT_UNSAFE_ARCHIVE",
    message:
      "Excel file could not be accepted. Re-export it from Excel or Sheets as a plain .xlsx and try again.",
    httpStatus: 422,
    details: `xlsx archive rejected: ${detail}`,
  });
}

/** One central-directory record, as far as this module cares. */
interface ArchiveEntry {
  readonly name: string;
  readonly compressedBytes: number;
  readonly uncompressedBytes: number;
  readonly encrypted: boolean;
  readonly diskNumberStart: number;
}

function findEndOfCentralDirectory(buffer: Buffer): number {
  /*
   * The EOCD sits at the end, after a comment of up to 64 KiB. Scanning
   * backwards from the last possible position is the standard approach; the
   * comment length is bounded, so this is a short scan and not a full sweep of
   * the file.
   */
  const earliest = Math.max(0, buffer.length - EOCD_MINIMUM_LENGTH - 0xffff);
  for (let offset = buffer.length - EOCD_MINIMUM_LENGTH; offset >= earliest; offset -= 1) {
    if (buffer.readUInt32LE(offset) === END_OF_CENTRAL_DIRECTORY) {
      return offset;
    }
  }
  return -1;
}

/**
 * Reject anything that is not a plain, single-disk, unencrypted XLSX whose
 * declared contents fit the limits above.
 *
 * Throws `CrmError` with code `IMPORT_UNSAFE_ARCHIVE`. Returns nothing on
 * success: this is a gate, not a parser, and it deliberately hands no parsed
 * state to the caller that might be mistaken for validated content.
 */
export function assertSafeXlsxArchive(buffer: Buffer): void {
  if (buffer.length < EOCD_MINIMUM_LENGTH) {
    reject("shorter than an empty archive");
  }

  // A ZIP begins with a local file header. An OLE2 .xls, a PDF renamed, or an
  // HTML table saved as .xlsx all fail here.
  if (buffer.readUInt32LE(0) !== LOCAL_FILE_HEADER) {
    reject("not a ZIP archive");
  }

  const eocdOffset = findEndOfCentralDirectory(buffer);
  if (eocdOffset < 0) {
    reject("no end-of-central-directory record");
  }

  /*
   * ZIP64 is rejected rather than parsed. It exists for archives above 4 GiB or
   * 65,535 members, neither of which a 5 MiB lead import can legitimately be,
   * and supporting it would mean a second parser for the fields the sentinels
   * stand in for — more code on the exact path this module exists to keep
   * simple.
   */
  if (
    eocdOffset >= 20 &&
    buffer.readUInt32LE(eocdOffset - 20) === ZIP64_END_OF_CENTRAL_DIRECTORY_LOCATOR
  ) {
    reject("ZIP64 archive");
  }

  const diskNumber = buffer.readUInt16LE(eocdOffset + 4);
  const centralDirectoryDisk = buffer.readUInt16LE(eocdOffset + 6);
  const entriesOnThisDisk = buffer.readUInt16LE(eocdOffset + 8);
  const totalEntries = buffer.readUInt16LE(eocdOffset + 10);
  const centralDirectoryOffset = buffer.readUInt32LE(eocdOffset + 16);

  if (
    totalEntries === UINT16_SENTINEL ||
    centralDirectoryOffset === UINT32_SENTINEL ||
    buffer.readUInt32LE(eocdOffset + 12) === UINT32_SENTINEL
  ) {
    reject("ZIP64 sentinel in the end-of-central-directory record");
  }

  // A split archive cannot be complete in one uploaded file.
  if (diskNumber !== 0 || centralDirectoryDisk !== 0 || entriesOnThisDisk !== totalEntries) {
    reject("multi-disk archive");
  }

  if (totalEntries === 0) {
    reject("archive contains no entries");
  }

  if (totalEntries > LEAD_IMPORT_XLSX_LIMITS.maxEntries) {
    reject(`${totalEntries} entries exceeds the ${LEAD_IMPORT_XLSX_LIMITS.maxEntries} limit`);
  }

  const entries: ArchiveEntry[] = [];
  let offset = centralDirectoryOffset;

  for (let index = 0; index < totalEntries; index += 1) {
    if (offset + CENTRAL_DIRECTORY_ENTRY_MINIMUM_LENGTH > buffer.length) {
      reject("central directory runs past the end of the file");
    }
    if (buffer.readUInt32LE(offset) !== CENTRAL_DIRECTORY_HEADER) {
      reject("malformed central directory record");
    }

    const flags = buffer.readUInt16LE(offset + 8);
    const compressedBytes = buffer.readUInt32LE(offset + 20);
    const uncompressedBytes = buffer.readUInt32LE(offset + 24);
    const nameLength = buffer.readUInt16LE(offset + 28);
    const extraLength = buffer.readUInt16LE(offset + 30);
    const commentLength = buffer.readUInt16LE(offset + 32);
    const diskNumberStart = buffer.readUInt16LE(offset + 34);

    const nameStart = offset + CENTRAL_DIRECTORY_ENTRY_MINIMUM_LENGTH;
    const nameEnd = nameStart + nameLength;
    if (nameEnd > buffer.length) {
      reject("entry name runs past the end of the file");
    }

    if (compressedBytes === UINT32_SENTINEL || uncompressedBytes === UINT32_SENTINEL) {
      reject("ZIP64 sentinel in an entry size");
    }

    entries.push({
      name: buffer.toString("utf8", nameStart, nameEnd),
      compressedBytes,
      uncompressedBytes,
      encrypted: (flags & FLAG_ENCRYPTED) !== 0,
      diskNumberStart,
    });

    offset = nameEnd + extraLength + commentLength;
  }

  let totalUncompressed = 0;

  for (const entry of entries) {
    if (entry.encrypted) {
      reject(`encrypted entry ${entry.name}`);
    }
    if (entry.diskNumberStart !== 0) {
      reject(`entry ${entry.name} starts on another disk`);
    }

    /*
     * Path checks. ExcelJS reads members by name rather than writing them to
     * disk, so traversal is not a write primitive here — but a workbook
     * containing `../` or `C:\` is not something Excel produces, and a file
     * that lies about its own shape has already told us what it is.
     */
    const name = entry.name.replace(/\\/g, "/");
    if (name.startsWith("/") || /^[A-Za-z]:/.test(name)) {
      reject(`absolute path ${entry.name}`);
    }
    if (name === ".." || name.startsWith("../") || name.includes("/../") || name.endsWith("/..")) {
      reject(`path traversal in ${entry.name}`);
    }

    if (name.toLowerCase() === MACRO_ENTRY) {
      reject("workbook contains a macro project");
    }

    if (entry.uncompressedBytes > LEAD_IMPORT_XLSX_LIMITS.maxEntryUncompressedBytes) {
      reject(
        `entry ${entry.name} declares ${entry.uncompressedBytes} bytes uncompressed`
      );
    }

    /*
     * Ratio is only meaningful for an entry with real compressed content.
     * Directory members and empty files declare zero and would otherwise divide
     * by nothing.
     */
    if (entry.compressedBytes > 0) {
      const ratio = entry.uncompressedBytes / entry.compressedBytes;
      if (ratio > LEAD_IMPORT_XLSX_LIMITS.maxEntryCompressionRatio) {
        reject(`entry ${entry.name} declares a ${Math.round(ratio)}:1 expansion`);
      }
    } else if (entry.uncompressedBytes > 0) {
      // Content from nothing: the declaration is incoherent.
      reject(`entry ${entry.name} declares content with no compressed bytes`);
    }

    totalUncompressed += entry.uncompressedBytes;
    if (totalUncompressed > LEAD_IMPORT_XLSX_LIMITS.maxTotalUncompressedBytes) {
      reject(`archive declares more than ${LEAD_IMPORT_XLSX_LIMITS.maxTotalUncompressedBytes} bytes uncompressed`);
    }
  }

  const names = new Set(entries.map((entry) => entry.name.replace(/\\/g, "/")));
  for (const required of REQUIRED_ENTRIES) {
    if (!names.has(required)) {
      reject(`missing required part ${required}`);
    }
  }
}
