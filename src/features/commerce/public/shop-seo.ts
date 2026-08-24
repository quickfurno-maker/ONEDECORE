import type { Metadata } from "next";
import { SITE_CONFIG } from "../../../config/site.ts";

const LISTING_QUERY_KEYS = ["q", "sort", "availability", "min", "max", "page"] as const;

export function shopListingHasQueryDuplicates(
  searchParams: Record<string, string | string[] | undefined>
): boolean {
  return LISTING_QUERY_KEYS.some((key) => {
    const value = searchParams[key];
    const raw = Array.isArray(value) ? value[0] : value;
    return raw != null && String(raw).trim() !== "";
  });
}

export function shopOpenGraph(input: {
  title: string;
  description: string;
  url: string;
  imageUrl?: string | null;
}): NonNullable<Metadata["openGraph"]> {
  return {
    title: input.title,
    description: input.description,
    url: input.url,
    siteName: SITE_CONFIG.name,
    locale: SITE_CONFIG.locale,
    type: "website",
    ...(input.imageUrl ? { images: [{ url: input.imageUrl, alt: input.title }] } : {}),
  };
}

export function serializeJsonLd(value: Record<string, unknown>): string {
  return JSON.stringify(value).replace(/</g, "\\u003c");
}
