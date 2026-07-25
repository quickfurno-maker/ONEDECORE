# ADR-0013: Server-Side Portfolio Image Processing Pipeline with Sharp

- **Status:** Accepted
- **Date:** 2026-07-25
- **Deciders:** ONEDECORE Engineering Team

---

## Context

The ONEDECORE Portfolio Admin CMS requires uploading master architectural photographs up to 20 MiB and serving web-optimized public images. Directly storing or serving raw user-uploaded images introduces security vulnerabilities (MIME spoofing, EXIF location/GPS privacy leaks, oversized file payloads, unsafe file formats, animated GIFs) and performance degradation.

---

## Decision

We adopt a server-side image processing pipeline implemented with exact direct dependency `sharp@0.35.3` within a server-only module (`src/features/portfolio/server/portfolio-image-pipeline.ts`).

### Key Specifications:
1. **Strict Content Validation:**
   - Maximum input file size: 20 MiB ($20 \times 1024 \times 1024$ bytes).
   - Maximum image dimension: 12,000 px (width or height).
   - Maximum total pixels: 50,000,000 total pixels (50 MP).
   - Format whitelist: JPEG, PNG, WebP only. Multi-page and animated images are explicitly rejected (`ANIMATED_IMAGE_NOT_ALLOWED`).
   - Content-header verification: Decoded header format must match browser-declared MIME type. MIME spoofing is rejected (`MIME_SPOOF_DETECTED`).

2. **Master Image Sanitization:**
   - Auto-orientation applied via `.rotate()`.
   - Metadata and EXIF/GPS tags completely stripped (no `.withMetadata()`).
   - Saved to private bucket `portfolio-originals` using explicit format encoders (JPEG quality 95 with `mozjpeg`, PNG compression level 9, or WebP quality 95).

3. **Public WebP Derivative Generation:**
   - Every public derivative is encoded as WebP format (`metadata.format === 'webp'`).
   - **Cover derivative:** Max width 1600 px (`fit: 'inside'`, `withoutEnlargement: true`, quality 82).
   - **Gallery derivative:** Max width 1200 px (`fit: 'inside'`, `withoutEnlargement: true`, quality 82).
   - **Thumbnail derivative:** Max width 480 px (`fit: 'inside'`, `withoutEnlargement: true`, quality 78).
   - Small images are never enlarged beyond their original dimensions.
   - Saved to public bucket `portfolio-public`.

4. **Immutable Storage Path Bounds:**
   - Object keys follow the strict project-scoped UUID structure:
     `${projectId}/${mediaId}/${filename}`
   - Cross-project or invalid UUID path operations are denied.

5. **Upload Compensation Flow:**
   - If database record creation fails after storage upload, a multi-phase compensation cleanup automatically deletes all created storage objects in reverse order before returning structured safe errors.

---

## Consequences

- **Security:** Private master assets have all EXIF privacy metadata stripped before storage; public derivatives are strictly WebP with 0 EXIF metadata.
- **Performance:** Small WebP derivatives significantly improve load times and CDN efficiency.
- **Maintainability:** Direct Sharp 0.35.3 integration requires no native libvips system dependencies or custom build flags.
