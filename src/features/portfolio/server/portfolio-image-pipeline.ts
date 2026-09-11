import sharp, { type Metadata } from "sharp";
import {
  MAX_FILE_SIZE_BYTES,
  MAX_DIMENSION_PX,
  MAX_PIXELS_TOTAL,
} from "../domain/portfolio-media.ts";

export type SupportedImageFormat = "jpeg" | "png" | "webp";

export function isSupportedImageFormat(
  value: string | undefined
): value is SupportedImageFormat {
  return value === "jpeg" || value === "png" || value === "webp";
}

export const FORMAT_DETAILS: Record<
  SupportedImageFormat,
  {
    extension: "jpg" | "png" | "webp";
    mimeType: "image/jpeg" | "image/png" | "image/webp";
  }
> = {
  jpeg: {
    extension: "jpg",
    mimeType: "image/jpeg",
  },
  png: {
    extension: "png",
    mimeType: "image/png",
  },
  webp: {
    extension: "webp",
    mimeType: "image/webp",
  },
};

/*
 * Re-exported, not redefined.
 *
 * These are shared with the browser (see the note in `domain/portfolio-media`),
 * and this module imports `sharp` — so a client component importing the limits
 * from here would pull a native module into the browser bundle and fail the
 * build. Server code keeps importing them from here, unchanged.
 */
export {
  MAX_FILE_SIZE_BYTES,
  MAX_DIMENSION_PX,
  MAX_PIXELS_TOTAL,
} from "../domain/portfolio-media.ts";

export interface ImageValidationResult {
  valid: boolean;
  code?: string;
  error?: string;
  format?: SupportedImageFormat;
  mimeType?: "image/jpeg" | "image/png" | "image/webp";
  extension?: "jpg" | "png" | "webp";
  width?: number;
  height?: number;
  pages?: number;
}

/**
 * Validates raw image buffer metadata.
 */
export async function validateImageMetadata(
  input: Buffer,
  declaredMime?: string
): Promise<ImageValidationResult> {
  if (!input || input.length === 0) {
    return {
      valid: false,
      code: "EMPTY_INPUT",
      error: "Image buffer cannot be empty.",
    };
  }

  if (input.length > MAX_FILE_SIZE_BYTES) {
    return {
      valid: false,
      code: "FILE_SIZE_EXCEEDED",
      error: "File size exceeds 20 MiB limit.",
    };
  }

  let metadata: Metadata;
  try {
    metadata = await sharp(input, { limitInputPixels: MAX_PIXELS_TOTAL }).metadata();
  } catch (err: unknown) {
    const msg = err instanceof Error ? err.message : "Invalid image data";
    return {
      valid: false,
      code: "CORRUPT_IMAGE",
      error: `Failed to parse image header: ${msg}`,
    };
  }

  if (!isSupportedImageFormat(metadata.format)) {
    return {
      valid: false,
      code: "UNSUPPORTED_IMAGE_FORMAT",
      error: "Only JPEG, PNG and WebP images are supported.",
    };
  }

  const detectedFormat: SupportedImageFormat = metadata.format;
  const details = FORMAT_DETAILS[detectedFormat];

  // Browser MIME match check if provided
  if (declaredMime && declaredMime !== details.mimeType && declaredMime !== "image/jpg") {
    return {
      valid: false,
      code: "MIME_SPOOF_DETECTED",
      error: "Browser MIME type does not match image content.",
    };
  }

  // Reject multi-page or animated images
  if ((metadata.pages ?? 1) !== 1) {
    return {
      valid: false,
      code: "ANIMATED_IMAGE_NOT_ALLOWED",
      error: "Animated or multi-page images are not supported.",
    };
  }

  const width = metadata.width || 0;
  const height = metadata.height || 0;

  if (width <= 0 || height <= 0) {
    return {
      valid: false,
      code: "INVALID_DIMENSIONS",
      error: "Image dimensions must be greater than zero.",
    };
  }

  if (width > MAX_DIMENSION_PX || height > MAX_DIMENSION_PX) {
    return {
      valid: false,
      code: "DIMENSION_EXCEEDED",
      error: `Image dimensions (${width}x${height}) exceed maximum allowed (${MAX_DIMENSION_PX}px).`,
    };
  }

  if (width * height > MAX_PIXELS_TOTAL) {
    return {
      valid: false,
      code: "PIXELS_EXCEEDED",
      error: `Total image pixels (${width * height}) exceed maximum allowed (${MAX_PIXELS_TOTAL} MP).`,
    };
  }

  return {
    valid: true,
    format: detectedFormat,
    mimeType: details.mimeType,
    extension: details.extension,
    width,
    height,
    pages: metadata.pages ?? 1,
  };
}

/**
 * Creates sanitised master buffer (auto-oriented, metadata stripped, explicit encoder).
 */
export async function createSanitisedMaster(
  input: Buffer,
  format: SupportedImageFormat
): Promise<Buffer> {
  const pipeline = sharp(input, {
    limitInputPixels: MAX_PIXELS_TOTAL,
    failOn: "error",
  }).rotate();

  switch (format) {
    case "jpeg":
      return pipeline
        .jpeg({
          quality: 95,
          mozjpeg: true,
        })
        .toBuffer();

    case "png":
      return pipeline
        .png({
          compressionLevel: 9,
          adaptiveFiltering: true,
        })
        .toBuffer();

    case "webp":
      return pipeline
        .webp({
          quality: 95,
          effort: 4,
        })
        .toBuffer();
  }
}

/**
 * Generates WebP derivative image with maximum width bound without enlargement.
 */
export async function generateDerivative(
  masterBuffer: Buffer,
  maxWidth: number,
  quality = 82
): Promise<{ buffer: Buffer; width: number; height: number; fileSize: number }> {
  const derivativeBuffer = await sharp(masterBuffer)
    .resize(maxWidth, null, { fit: "inside", withoutEnlargement: true })
    .webp({ quality, effort: 4 })
    .toBuffer();

  const meta = await sharp(derivativeBuffer).metadata();

  return {
    buffer: derivativeBuffer,
    width: meta.width || 0,
    height: meta.height || 0,
    fileSize: derivativeBuffer.length,
  };
}

/**
 * Generates structured UUID path for media storage.
 */
export function generateMediaPath(
  projectId: string,
  mediaId: string,
  filename: string
): string {
  if (!isValidUuid(projectId) || !isValidUuid(mediaId)) {
    throw new Error("Invalid UUID format for media path generation");
  }
  return `${projectId}/${mediaId}/${filename}`;
}

/**
 * Storage path for standalone room-library media.
 *
 * `room-library/<room>/<media_uuid>/<filename>` — four segments against the
 * project shape's three, and a literal first segment that no project uuid can
 * ever equal. That is deliberate: the namespaces are distinguishable by
 * inspection, so `validatePublicStoragePath` can classify a stored path without
 * being told which kind it is, and neither kind can be spelled to impersonate
 * the other.
 *
 * The room is in the path as well as in the row. It is not load-bearing — the
 * database column is the truth, and a retag does not move objects — but it
 * makes the bucket browsable by a human, which matters the first time somebody
 * has to reconcile storage against rows.
 */
export function generateLibraryMediaPath(
  roomCode: string,
  mediaId: string,
  filename: string
): string {
  if (!isValidUuid(mediaId)) {
    throw new Error("Invalid UUID format for media path generation");
  }
  if (!/^[a-z]+(?:-[a-z]+)*$/.test(roomCode)) {
    throw new Error("Invalid room code for media path generation");
  }
  return `room-library/${roomCode}/${mediaId}/${filename}`;
}

/**
 * Validates UUID v4 format.
 */
export function isValidUuid(id: string): boolean {
  return /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i.test(id);
}

/**
 * Validates path ownership against project ID.
 */
export function isAllowedPath(path: string, projectId: string): boolean {
  if (!isValidUuid(projectId)) return false;
  return path.startsWith(`${projectId}/`);
}
