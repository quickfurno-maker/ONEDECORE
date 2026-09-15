import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface CommerceVendorIdentity {
  readonly id: string;
  readonly vendorCode: string;
  readonly userId: string;
  readonly displayName: string;
  readonly status: string;
}

export async function getCommerceVendorIdentity(): Promise<CommerceVendorIdentity | null> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("get_my_commerce_vendor");
  if (error || !data || typeof data !== "object" || Array.isArray(data)) return null;
  const row = data as Record<string, unknown>;
  if (typeof row.id !== "string" || typeof row.vendor_code !== "string" || typeof row.user_id !== "string") return null;
  return {
    id: row.id,
    vendorCode: row.vendor_code,
    userId: row.user_id,
    displayName: typeof row.display_name === "string" ? row.display_name : "Vendor",
    status: typeof row.status === "string" ? row.status : "active",
  };
}
