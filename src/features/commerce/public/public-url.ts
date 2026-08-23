const CANONICAL_UUID =
  /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/;

export const COMMERCE_PUBLIC_BUCKET = "commerce-product-public";

export function validateCommercePublicPath(path: string): boolean {
  if (typeof path !== "string" || path.length === 0) return false;
  if (
    path.includes("%") ||
    path.includes("..") ||
    path.includes("\\") ||
    path.includes("?") ||
    path.includes("#") ||
    path.includes(" ") ||
    path.startsWith("/") ||
    path.endsWith("/")
  ) {
    return false;
  }
  const segments = path.split("/");
  if (segments.length !== 3) return false;
  const [productId, mediaId, fileName] = segments;
  if (!CANONICAL_UUID.test(productId) || !CANONICAL_UUID.test(mediaId)) {
    return false;
  }
  return /^[a-zA-Z0-9._-]+\.(webp|jpg|jpeg|png)$/.test(fileName);
}

export function buildCommercePublicUrl(path: string | null | undefined): string | null {
  if (!path || !validateCommercePublicPath(path)) {
    return null;
  }
  const supabaseUrl = (process.env.NEXT_PUBLIC_SUPABASE_URL || "http://127.0.0.1:54321").replace(
    /\/+$/,
    ""
  );
  return `${supabaseUrl}/storage/v1/object/public/${COMMERCE_PUBLIC_BUCKET}/${path}`;
}
