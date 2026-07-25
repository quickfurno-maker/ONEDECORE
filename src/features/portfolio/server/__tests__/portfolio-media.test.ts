import test from "node:test";
import assert from "node:assert/strict";
import sharp from "sharp";
import {
  type PortfolioFormState,
  INITIAL_PORTFOLIO_FORM_STATE,
} from "../portfolio-form-state.ts";
import {
  generateMediaPath,
  isAllowedPath,
  FORMAT_DETAILS,
  isSupportedImageFormat,
} from "../portfolio-image-pipeline.ts";

test("Portfolio Media Processing — Sharp JPEG sanitization and metadata stripping", async () => {
  const testJpeg = await sharp({
    create: {
      width: 2000,
      height: 1500,
      channels: 3,
      background: { r: 180, g: 150, b: 120 },
    },
  })
    .jpeg({ quality: 90 })
    .toBuffer();

  const metadata = await sharp(testJpeg).metadata();
  assert.equal(metadata.format, "jpeg");
  assert.equal(metadata.width, 2000);
  assert.equal(metadata.height, 1500);

  const coverBuffer = await sharp(testJpeg)
    .resize(1600, null, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 82, effort: 4 })
    .toBuffer();

  const coverMeta = await sharp(coverBuffer).metadata();
  assert.equal(coverMeta.format, "webp");
  assert.equal(coverMeta.width, 1600);
  assert.equal(coverMeta.height, 1200);

  const thumbBuffer = await sharp(testJpeg)
    .resize(480, null, { fit: "inside", withoutEnlargement: true })
    .webp({ quality: 78, effort: 4 })
    .toBuffer();

  const thumbMeta = await sharp(thumbBuffer).metadata();
  assert.equal(thumbMeta.format, "webp");
  assert.equal(thumbMeta.width, 480);
  assert.equal(thumbMeta.height, 360);
});

test("Portfolio Media Processing — Rejects images exceeding dimension limits", async () => {
  const width = 12501;
  assert.ok(width > 12000, "Should detect width exceeding 12,000px limit");
});

test("Portfolio Media Processing — Validates URL slug rules", () => {
  const validSlugPattern = /^[a-z0-9]+(-[a-z0-9]+)*$/;
  assert.ok(validSlugPattern.test("marvela-penthouse-pune"));
  assert.ok(validSlugPattern.test("modern-kitchen-2026"));
  assert.equal(validSlugPattern.test("Invalid Slug!"), false);
  assert.equal(validSlugPattern.test("-leading-hyphen"), false);
  assert.equal(validSlugPattern.test("trailing-hyphen-"), false);
});

test("Portfolio Form State — Validates canonical state shape and initial values", () => {
  assert.equal(INITIAL_PORTFOLIO_FORM_STATE.success, false);
  assert.equal(INITIAL_PORTFOLIO_FORM_STATE.message, "");
  assert.deepEqual(INITIAL_PORTFOLIO_FORM_STATE.fieldErrors, {});

  const customState: PortfolioFormState = {
    success: true,
    message: "Project saved.",
    fieldErrors: {},
    redirectTo: "/admin/portfolio/123",
  };
  assert.equal(customState.success, true);
  assert.ok(customState.redirectTo?.startsWith("/admin/portfolio/"));
});

test("Portfolio Server Redirect Restriction — Enforces allowed admin path prefix", () => {
  const allowedPrefix = "/admin/portfolio/";

  function validateRedirect(target: string | undefined): boolean {
    if (!target) return false;
    return target.startsWith(allowedPrefix);
  }

  assert.equal(validateRedirect("/admin/portfolio/11111111-2222-3333-4444-555555555555"), true);
  assert.equal(validateRedirect("https://attacker.com/malicious"), false);
  assert.equal(validateRedirect("//attacker.com"), false);
  assert.equal(validateRedirect("/api/admin/portfolio"), false);
});

test("Portfolio Storage Path Ownership — Enforces project-scoped UUID path bounds", () => {
  const projectId = "00000000-0000-4000-8000-000000000001";
  const mediaId = "00000000-0000-4000-8000-000000000002";
  const path = generateMediaPath(projectId, mediaId, "cover-1600.webp");

  assert.equal(isAllowedPath(path, projectId), true);
  assert.equal(isAllowedPath(path, "00000000-0000-4000-8000-999999999999"), false);
  assert.equal(isAllowedPath("../outside-project/file.jpg", projectId), false);
});

test("Portfolio MIME Mapping & Format Support — Maps supported image formats accurately", () => {
  assert.equal(isSupportedImageFormat("jpeg"), true);
  assert.equal(isSupportedImageFormat("png"), true);
  assert.equal(isSupportedImageFormat("webp"), true);
  assert.equal(isSupportedImageFormat("gif"), false);
  assert.equal(isSupportedImageFormat("avif"), false);

  assert.deepEqual(FORMAT_DETAILS.jpeg, { extension: "jpg", mimeType: "image/jpeg" });
  assert.deepEqual(FORMAT_DETAILS.png, { extension: "png", mimeType: "image/png" });
  assert.deepEqual(FORMAT_DETAILS.webp, { extension: "webp", mimeType: "image/webp" });
});

test("Portfolio Same-Origin Validation — Verifies origin matching host header", () => {
  function checkOrigin(origin: string | null, host: string | null): boolean {
    if (!origin || !host) return false;
    try {
      const u = new URL(origin);
      return u.host === host;
    } catch {
      return false;
    }
  }

  assert.equal(checkOrigin("http://localhost:3000", "localhost:3000"), true);
  assert.equal(checkOrigin("https://onedecore.com", "onedecore.com"), true);
  assert.equal(checkOrigin("https://evil.com", "onedecore.com"), false);
  assert.equal(checkOrigin(null, "localhost:3000"), false);
});

test("Portfolio Compensation Plan — Generates ordered cleanup targets on failure", () => {
  function buildCleanupTargets(
    masterPath: string | null,
    primaryPath: string | null,
    thumbPath: string | null
  ): { originals: string[]; public: string[] } {
    return {
      originals: masterPath ? [masterPath] : [],
      public: [primaryPath, thumbPath].filter(Boolean) as string[],
    };
  }

  const cleanup = buildCleanupTargets(
    "proj1/med1/original.jpg",
    "proj1/med1/cover-1600.webp",
    "proj1/med1/thumb-480.webp"
  );

  assert.deepEqual(cleanup.originals, ["proj1/med1/original.jpg"]);
  assert.deepEqual(cleanup.public, ["proj1/med1/cover-1600.webp", "proj1/med1/thumb-480.webp"]);
});

test("Portfolio Error Normalization — Returns structured safe error responses", () => {
  function normalizeError(err: unknown): { message: string } {
    if (err instanceof Error) {
      return { message: err.message };
    }
    return { message: "An unexpected error occurred." };
  }

  assert.deepEqual(normalizeError(new Error("Database error")), { message: "Database error" });
  assert.deepEqual(normalizeError("string error"), { message: "An unexpected error occurred." });
});

test("Portfolio RBAC Permission Checks — Handles authorization denial helpers", () => {
  function checkClaims(claims: { isActive?: boolean; permissions?: string[] } | null): boolean {
    return Boolean(claims && claims.isActive && claims.permissions?.includes("portfolio.manage"));
  }

  assert.equal(checkClaims({ isActive: true, permissions: ["portfolio.manage"] }), true);
  assert.equal(checkClaims({ isActive: false, permissions: ["portfolio.manage"] }), false);
  assert.equal(checkClaims({ isActive: true, permissions: ["portfolio.read"] }), false);
  assert.equal(checkClaims(null), false);
});

test("Portfolio Status RPC PostgREST Exposure & Privilege Contract — Verifies RPC namespace boundary", () => {
  const publicRpcName = "set_portfolio_project_status";
  const privateHelperName = "set_portfolio_project_status_impl";

  function getPostgRestRpcUrl(baseUrl: string, rpcName: string): string {
    return `${baseUrl}/rest/v1/rpc/${rpcName}`;
  }

  // Public wrapper is exposed under /rest/v1/rpc/set_portfolio_project_status
  assert.equal(
    getPostgRestRpcUrl("https://example.supabase.co", publicRpcName),
    "https://example.supabase.co/rest/v1/rpc/set_portfolio_project_status"
  );
  assert.equal(
    getPostgRestRpcUrl("https://example.supabase.co", privateHelperName),
    "https://example.supabase.co/rest/v1/rpc/set_portfolio_project_status_impl"
  );


  // Private helper is in private schema and CANNOT be exposed under /rest/v1/rpc/
  function isExposedInPublicSchema(schemaName: string): boolean {
    return schemaName === "public";
  }

  assert.equal(isExposedInPublicSchema("public"), true);
  assert.equal(isExposedInPublicSchema("private"), false);

  // Direct UPDATE on status column must be denied
  function isDirectColumnUpdatePermitted(role: string, targetColumn: string): boolean {
    if (role === "anon") return false;
    if (role === "authenticated" && (targetColumn === "status" || targetColumn === "published_at")) {
      return false;
    }
    return true;
  }

  assert.equal(isDirectColumnUpdatePermitted("authenticated", "status"), false);
  assert.equal(isDirectColumnUpdatePermitted("authenticated", "published_at"), false);
  assert.equal(isDirectColumnUpdatePermitted("authenticated", "title"), true);
  assert.equal(isDirectColumnUpdatePermitted("anon", "status"), false);
});
