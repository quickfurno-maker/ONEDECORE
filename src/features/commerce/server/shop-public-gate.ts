import "server-only";

/** Fail-closed public storefront gate. Deploy ≠ activate. */
export const SHOP_PUBLIC_ENABLED_ENV = "ONEDECORE_SHOP_PUBLIC_ENABLED";

export function isShopPublicEnabled(
  env: NodeJS.ProcessEnv | Record<string, string | undefined> = process.env
): boolean {
  return env[SHOP_PUBLIC_ENABLED_ENV] === "true";
}
