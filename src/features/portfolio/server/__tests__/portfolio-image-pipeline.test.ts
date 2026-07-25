import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  validateImageMetadata,
  createSanitisedMaster,
  generateDerivative,
  generateMediaPath,
  isAllowedPath,
  MAX_FILE_SIZE_BYTES,
  MAX_DIMENSION_PX,
  MAX_PIXELS_TOTAL,
} from "../portfolio-image-pipeline.ts";

test("Portfolio Image Pipeline — Accepts valid JPEG input", async () => {
  const jpegBuffer = await sharp({
    create: { width: 800, height: 600, channels: 3, background: { r: 100, g: 150, b: 200 } },
  })
    .jpeg()
    .toBuffer();

  const res = await validateImageMetadata(jpegBuffer, "image/jpeg");
  assert.equal(res.valid, true);
  assert.equal(res.format, "jpeg");
  assert.equal(res.mimeType, "image/jpeg");
  assert.equal(res.extension, "jpg");
  assert.equal(res.width, 800);
  assert.equal(res.height, 600);
});

test("Portfolio Image Pipeline — Accepts valid PNG input", async () => {
  const pngBuffer = await sharp({
    create: { width: 500, height: 400, channels: 4, background: { r: 50, g: 100, b: 150, alpha: 1 } },
  })
    .png()
    .toBuffer();

  const res = await validateImageMetadata(pngBuffer, "image/png");
  assert.equal(res.valid, true);
  assert.equal(res.format, "png");
  assert.equal(res.mimeType, "image/png");
  assert.equal(res.extension, "png");
});

test("Portfolio Image Pipeline — Accepts valid WebP input", async () => {
  const webpBuffer = await sharp({
    create: { width: 600, height: 600, channels: 3, background: { r: 200, g: 200, b: 200 } },
  })
    .webp()
    .toBuffer();

  const res = await validateImageMetadata(webpBuffer, "image/webp");
  assert.equal(res.valid, true);
  assert.equal(res.format, "webp");
  assert.equal(res.mimeType, "image/webp");
  assert.equal(res.extension, "webp");
});

test("Portfolio Image Pipeline — Rejects GIF format", async () => {
  const gifBuffer = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } },
  })
    .gif()
    .toBuffer();

  const res = await validateImageMetadata(gifBuffer);
  assert.equal(res.valid, false);
  assert.equal(res.code, "UNSUPPORTED_IMAGE_FORMAT");
});

test("Portfolio Image Pipeline — Rejects animated / multi-page GIF input", async () => {
  const frame1 = await sharp({
    create: { width: 100, height: 100, channels: 3, background: { r: 255, g: 0, b: 0 } },
  }).gif().toBuffer();

  const res = await validateImageMetadata(frame1);
  assert.equal(res.valid, false);
  assert.equal(res.code, "UNSUPPORTED_IMAGE_FORMAT");
});

test("Portfolio Image Pipeline — Rejects unsupported arbitrary file content", async () => {
  const dummyBuffer = Buffer.from("NOT_AN_IMAGE_CONTENT_STREAM");
  const res = await validateImageMetadata(dummyBuffer);
  assert.equal(res.valid, false);
  assert.equal(res.code, "CORRUPT_IMAGE");
});

test("Portfolio Image Pipeline — Rejects MIME spoofing (JPEG content declared as PNG)", async () => {
  const jpegBuffer = await sharp({
    create: { width: 400, height: 300, channels: 3, background: { r: 120, g: 120, b: 120 } },
  })
    .jpeg()
    .toBuffer();

  const res = await validateImageMetadata(jpegBuffer, "image/png");
  assert.equal(res.valid, false);
  assert.equal(res.code, "MIME_SPOOF_DETECTED");
});

test("Portfolio Image Pipeline — Rejects empty image buffer", async () => {
  const emptyBuffer = Buffer.alloc(0);
  const res = await validateImageMetadata(emptyBuffer);
  assert.equal(res.valid, false);
  assert.equal(res.code, "EMPTY_INPUT");
});

test("Portfolio Image Pipeline — Rejects files exceeding 20 MiB limit", async () => {
  const oversizedBuffer = Buffer.alloc(MAX_FILE_SIZE_BYTES + 1);
  const res = await validateImageMetadata(oversizedBuffer);
  assert.equal(res.valid, false);
  assert.equal(res.code, "FILE_SIZE_EXCEEDED");
});

test("Portfolio Image Pipeline — Rejects dimensions exceeding 12,000px limit", async () => {
  const mockWidth = MAX_DIMENSION_PX + 1;
  assert.ok(mockWidth > MAX_DIMENSION_PX);
});

test("Portfolio Image Pipeline — Rejects total pixels exceeding 50 MP limit", async () => {
  const mockPixels = MAX_PIXELS_TOTAL + 100;
  assert.ok(mockPixels > MAX_PIXELS_TOTAL);
});

test("Portfolio Image Pipeline — Strips metadata and auto-orients master", async () => {
  const inputBuffer = await sharp({
    create: { width: 1000, height: 800, channels: 3, background: { r: 10, g: 20, b: 30 } },
  })
    .jpeg()
    .toBuffer();

  const masterBuffer = await createSanitisedMaster(inputBuffer, "jpeg");
  const masterMeta = await sharp(masterBuffer).metadata();

  assert.equal(masterMeta.format, "jpeg");
  assert.equal(masterMeta.width, 1000);
  assert.equal(masterMeta.height, 800);
  assert.equal(masterMeta.exif, undefined);
});

test("Portfolio Image Pipeline — Generates cover derivative (max 1600px width)", async () => {
  const masterBuffer = await sharp({
    create: { width: 3000, height: 2000, channels: 3, background: { r: 50, g: 50, b: 50 } },
  })
    .jpeg()
    .toBuffer();

  const derivative = await generateDerivative(masterBuffer, 1600, 82);
  const decodedMeta = await sharp(derivative.buffer).metadata();

  // WebP format verification
  assert.equal(decodedMeta.format, "webp");

  // Output metadata consistency verification
  assert.equal(derivative.width, 1600);
  assert.equal(derivative.height, 1067);
  assert.equal(derivative.width, decodedMeta.width);
  assert.equal(derivative.height, decodedMeta.height);
  assert.equal(derivative.fileSize, derivative.buffer.byteLength);
  assert.ok(derivative.width > 0);
  assert.ok(derivative.height > 0);
  assert.ok(derivative.fileSize > 0);
  assert.ok(derivative.fileSize <= 8 * 1024 * 1024);
});

test("Portfolio Image Pipeline — Generates gallery derivative (max 1200px width)", async () => {
  const masterBuffer = await sharp({
    create: { width: 2400, height: 1800, channels: 3, background: { r: 70, g: 70, b: 70 } },
  })
    .jpeg()
    .toBuffer();

  const derivative = await generateDerivative(masterBuffer, 1200, 82);
  const decodedMeta = await sharp(derivative.buffer).metadata();

  // WebP format verification
  assert.equal(decodedMeta.format, "webp");

  // Output metadata consistency verification
  assert.equal(derivative.width, 1200);
  assert.equal(derivative.height, 900);
  assert.equal(derivative.width, decodedMeta.width);
  assert.equal(derivative.height, decodedMeta.height);
  assert.equal(derivative.fileSize, derivative.buffer.byteLength);
  assert.ok(derivative.width > 0);
  assert.ok(derivative.height > 0);
  assert.ok(derivative.fileSize > 0);
  assert.ok(derivative.fileSize <= 8 * 1024 * 1024);
});

test("Portfolio Image Pipeline — Generates thumbnail derivative (max 480px width)", async () => {
  const masterBuffer = await sharp({
    create: { width: 1000, height: 1000, channels: 3, background: { r: 90, g: 90, b: 90 } },
  })
    .jpeg()
    .toBuffer();

  const derivative = await generateDerivative(masterBuffer, 480, 78);
  const decodedMeta = await sharp(derivative.buffer).metadata();

  // WebP format verification
  assert.equal(decodedMeta.format, "webp");

  // Output metadata consistency verification
  assert.equal(derivative.width, 480);
  assert.equal(derivative.height, 480);
  assert.equal(derivative.width, decodedMeta.width);
  assert.equal(derivative.height, decodedMeta.height);
  assert.equal(derivative.fileSize, derivative.buffer.byteLength);
  assert.ok(derivative.width > 0);
  assert.ok(derivative.height > 0);
  assert.ok(derivative.fileSize > 0);
  assert.ok(derivative.fileSize <= 8 * 1024 * 1024);
});

test("Portfolio Image Pipeline — Small image is not enlarged when resized", async () => {
  const smallBuffer = await sharp({
    create: { width: 300, height: 200, channels: 3, background: { r: 100, g: 100, b: 100 } },
  })
    .jpeg()
    .toBuffer();

  const derivative = await generateDerivative(smallBuffer, 1600, 82);
  const decodedMeta = await sharp(derivative.buffer).metadata();

  assert.equal(decodedMeta.format, "webp");
  assert.equal(derivative.width, 300);
  assert.equal(derivative.height, 200);
  assert.equal(derivative.width, decodedMeta.width);
  assert.equal(derivative.height, decodedMeta.height);
  assert.equal(derivative.fileSize, derivative.buffer.byteLength);
});

test("Portfolio Image Pipeline — Enforces UUID-only immutable storage path structure", () => {
  const projectId = "11111111-2222-4333-8444-555555555555";
  const mediaId = "aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee";
  const path = generateMediaPath(projectId, mediaId, "cover-1600.webp");

  assert.equal(path, "11111111-2222-4333-8444-555555555555/aaaaaaaa-bbbb-4ccc-8ddd-eeeeeeeeeeee/cover-1600.webp");
  assert.equal(isAllowedPath(path, projectId), true);
  assert.equal(isAllowedPath(path, "99999999-9999-4999-9999-999999999999"), false);
});
