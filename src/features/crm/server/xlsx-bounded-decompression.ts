import "server-only";

/**
 * GATE 2 — what the archive's bytes ACTUALLY expand to.
 *
 * WHY GATE 1 IS NOT ENOUGH
 *
 * The central directory records what each entry *claims* to expand to. Nothing
 * makes the deflate stream honour that claim. An archive can declare one
 * megabyte, satisfy every Gate 1 limit, and inflate to gigabytes — this was
 * reproduced before the gate was written: a 17 KB archive declaring 1 MiB
 * produced 17 MiB, and Gate 1 accepted it.
 *
 * JSZip, which ExcelJS parses with, does eventually notice: it compares the
 * produced length against the declared one and throws "uncompressed data size
 * mismatch". But it does that at the END of the stream, after the whole output
 * has been materialised. The declaration bounds the error message, not the
 * memory.
 *
 * So this gate inflates each entry itself, first, with a hard ceiling, counting
 * bytes as they arrive and discarding them. Nothing is retained: the output is
 * measured, not kept. An entry that crosses the ceiling stops mid-stream rather
 * than being inflated and then judged.
 *
 * WHAT IS NOW BOUNDED, AND WHAT STILL IS NOT
 *
 * Peak memory for the import path is now bounded by the per-entry ceiling
 * during this gate, and by the aggregate ceiling across the archive. The
 * declared sizes are additionally required to match what actually came out, so
 * a lying directory is rejected rather than merely disbelieved.
 *
 * This is not a claim that XLSX parsing is now free of resource risk. ExcelJS
 * still builds its own object model from entries that pass, and a workbook can
 * be pathological in ways that have nothing to do with compression. What is
 * closed is the amplification gap: an attacker can no longer turn 5 MiB of
 * upload into an unbounded inflate.
 */

import { createInflateRaw } from "node:zlib";

import { CrmError } from "./crm-errors.ts";
import {
  LEAD_IMPORT_XLSX_LIMITS,
  type XlsxArchiveEntry,
} from "./xlsx-archive-preflight.ts";

/** Stored — the entry is its own content. */
const METHOD_STORED = 0;
/** Deflate — everything else in a real workbook. */
const METHOD_DEFLATE = 8;

const LOCAL_FILE_HEADER = 0x04034b50;
const LOCAL_FILE_HEADER_MINIMUM_LENGTH = 30;

function reject(detail: string): never {
  // Same public code and message as Gate 1: the caller learns the file was
  // refused, not which of the two gates refused it or why.
  throw new CrmError({
    code: "IMPORT_UNSAFE_ARCHIVE",
    message:
      "Excel file could not be accepted. Re-export it from Excel or Sheets as a plain .xlsx and try again.",
    httpStatus: 422,
    details: `xlsx archive rejected: ${detail}`,
  });
}

/**
 * Find one entry's compressed bytes.
 *
 * The local header's own size fields are deliberately ignored. An entry written
 * with a data descriptor (general purpose bit 3) leaves them zero and puts the
 * real values after the payload, which is legal and which streaming writers
 * genuinely produce. The central directory's compressed size — already
 * range-checked by Gate 1 — is the authority, and the local header is consulted
 * only for the two lengths needed to skip past it.
 */
function locateCompressedBytes(buffer: Buffer, entry: XlsxArchiveEntry): Buffer {
  const start = entry.localHeaderOffset;

  if (start < 0 || start + LOCAL_FILE_HEADER_MINIMUM_LENGTH > buffer.length) {
    reject(`MALFORMED_LOCAL_HEADER ${entry.name} header lies outside the file`);
  }
  if (buffer.readUInt32LE(start) !== LOCAL_FILE_HEADER) {
    reject(`MALFORMED_LOCAL_HEADER ${entry.name} has no local file header`);
  }

  const localMethod = buffer.readUInt16LE(start + 8);
  if (localMethod !== entry.compressionMethod) {
    /*
     * The two headers disagreeing about how the payload is encoded means one of
     * them is lying, and a parser that trusts the other one gets different
     * bytes than this gate measured.
     */
    reject(
      `MALFORMED_LOCAL_HEADER ${entry.name} local method ${localMethod} does not match directory method ${entry.compressionMethod}`
    );
  }

  const nameLength = buffer.readUInt16LE(start + 26);
  const extraLength = buffer.readUInt16LE(start + 28);
  const dataStart = start + LOCAL_FILE_HEADER_MINIMUM_LENGTH + nameLength + extraLength;
  const dataEnd = dataStart + entry.compressedBytes;

  if (dataStart > buffer.length || dataEnd > buffer.length || dataEnd < dataStart) {
    reject(`MALFORMED_LOCAL_HEADER ${entry.name} payload runs past the end of the file`);
  }

  return buffer.subarray(dataStart, dataEnd);
}

interface Budget {
  /** Bytes this entry may still produce before it is refused. */
  entryCeiling: number;
  /** Bytes the whole archive may still produce. */
  remainingAggregate: number;
}

/**
 * Inflate one deflate stream, counting and discarding.
 *
 * Two independent stops, because they fail differently:
 *
 *   `maxOutputLength` is zlib's own ceiling — it aborts inside the inflater, so
 *   a stream that would produce a gigabyte never gets to allocate one even if
 *   the loop below were wrong.
 *
 *   The chunk accounting is what enforces the AGGREGATE budget, which zlib
 *   knows nothing about, and what destroys the stream the moment either limit
 *   is crossed rather than at the end of it.
 *
 * Chunks are counted and dropped. Nothing accumulates.
 */
function inflateCounting(compressed: Buffer, budget: Budget): Promise<number> {
  return new Promise((resolve, promiseReject) => {
    const ceiling = Math.min(budget.entryCeiling, budget.remainingAggregate);
    const inflater = createInflateRaw({
      // One byte past the ceiling is enough to prove the limit was crossed.
      maxOutputLength: ceiling + 1,
    });

    let produced = 0;
    let settled = false;

    const stop = (error: Error | null, value?: number) => {
      if (settled) return;
      settled = true;
      inflater.removeAllListeners();
      inflater.destroy();
      if (error) promiseReject(error);
      else resolve(value ?? produced);
    };

    inflater.on("data", (chunk: Buffer) => {
      produced += chunk.length;
      if (produced > budget.entryCeiling) {
        stop(new RangeError("ACTUAL_ENTRY_LIMIT"));
        return;
      }
      if (produced > budget.remainingAggregate) {
        stop(new RangeError("ACTUAL_TOTAL_LIMIT"));
      }
      // The chunk is now unreferenced. Measuring output is the point; keeping
      // it would reintroduce the memory cost this gate exists to bound.
    });

    inflater.on("end", () => stop(null, produced));
    inflater.on("error", (error: NodeJS.ErrnoException) => {
      /*
       * zlib's own ceiling reports ERR_BUFFER_TOO_LARGE. Reaching it means the
       * same thing the counter means, so it is reported the same way rather
       * than as a corrupt-archive error.
       */
      if (error.code === "ERR_BUFFER_TOO_LARGE") {
        stop(new RangeError("ACTUAL_ENTRY_LIMIT"));
        return;
      }
      stop(new RangeError(`CORRUPT_STREAM ${error.message}`));
    });

    inflater.end(compressed);
  });
}

/**
 * GATE 2. Inflate every entry under a hard ceiling and require the result to
 * match what the directory declared.
 *
 * Runs after `assertSafeXlsxArchive` and before ExcelJS. Throws `CrmError` with
 * code `IMPORT_UNSAFE_ARCHIVE`; returns nothing, because the only thing worth
 * carrying forward is that the archive survived.
 */
export async function assertBoundedXlsxDecompression(
  buffer: Buffer,
  entries: readonly XlsxArchiveEntry[]
): Promise<void> {
  let aggregate = 0;

  for (const entry of entries) {
    if (
      entry.compressionMethod !== METHOD_STORED &&
      entry.compressionMethod !== METHOD_DEFLATE
    ) {
      /*
       * Rejected rather than passed through. A workbook uses stored and deflate;
       * anything else (bzip2, LZMA, zstd, PPMd) in a lead import is either a
       * file that will not open or a deliberate attempt to reach a decoder this
       * gate cannot bound.
       */
      reject(
        `UNSUPPORTED_COMPRESSION ${entry.name} uses method ${entry.compressionMethod}`
      );
    }

    const compressed = locateCompressedBytes(buffer, entry);
    const remainingAggregate =
      LEAD_IMPORT_XLSX_LIMITS.maxTotalUncompressedBytes - aggregate;

    let produced: number;

    if (entry.compressionMethod === METHOD_STORED) {
      // Stored entries expand to themselves, so the payload length IS the
      // output length; there is nothing to inflate and nothing to bound beyond
      // the range check already done.
      produced = compressed.length;
      if (produced > LEAD_IMPORT_XLSX_LIMITS.maxEntryUncompressedBytes) {
        reject(`ACTUAL_ENTRY_LIMIT ${entry.name} stores ${produced} bytes`);
      }
      if (produced > remainingAggregate) {
        reject(`ACTUAL_TOTAL_LIMIT ${entry.name} takes the archive past the ceiling`);
      }
    } else {
      try {
        produced = await inflateCounting(compressed, {
          entryCeiling: LEAD_IMPORT_XLSX_LIMITS.maxEntryUncompressedBytes,
          remainingAggregate,
        });
      } catch (error) {
        const reason = error instanceof Error ? error.message : "CORRUPT_STREAM";
        reject(`${reason} in ${entry.name}`);
      }
    }

    /*
     * ACTUAL MUST EQUAL DECLARED.
     *
     * Not just "actual is within limits". A directory that understates its
     * content is how the amplification gap worked, and one that overstates it
     * is equally a file that is not what it says it is — either way a parser
     * reading the same archive will disagree with what was measured here, and
     * a check that only bounds the larger of the two leaves that disagreement
     * unexamined.
     */
    if (produced !== entry.uncompressedBytes) {
      reject(
        `SIZE_MISMATCH ${entry.name} declared ${entry.uncompressedBytes} bytes and produced ${produced}`
      );
    }

    aggregate += produced;
    if (aggregate > LEAD_IMPORT_XLSX_LIMITS.maxTotalUncompressedBytes) {
      reject(`ACTUAL_TOTAL_LIMIT archive produced more than ${LEAD_IMPORT_XLSX_LIMITS.maxTotalUncompressedBytes} bytes`);
    }
  }
}
