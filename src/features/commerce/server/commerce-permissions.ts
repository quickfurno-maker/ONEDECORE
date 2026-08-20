import "server-only";

import { createClient } from "@/lib/supabase/server";

export interface CommercePermissionProbe {
  readonly canRead: boolean;
  readonly canManageCatalog: boolean;
  readonly canManageInventory: boolean;
  readonly canManageOrders: boolean;
  readonly canReadPayments: boolean;
  readonly canManageSettings: boolean;
}

async function authorizeFlag(requestedPermission: string): Promise<boolean> {
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("authorize", {
    requested_permission: requestedPermission,
  });
  return !error && data === true;
}

export async function probeCommercePermissions(): Promise<CommercePermissionProbe> {
  const supabase = await createClient();
  const [readRes, catalogRes, inventoryRes, ordersRes, paymentsRes, settingsRes] = await Promise.all([
    supabase.rpc("authorize", { requested_permission: "commerce.read" }),
    supabase.rpc("authorize", { requested_permission: "commerce.catalog.manage" }),
    supabase.rpc("authorize", { requested_permission: "commerce.inventory.manage" }),
    supabase.rpc("authorize", { requested_permission: "commerce.orders.manage" }),
    supabase.rpc("authorize", { requested_permission: "commerce.payments.read" }),
    supabase.rpc("authorize", { requested_permission: "commerce.settings.manage" }),
  ]);
  return {
    canRead: !readRes.error && readRes.data === true,
    canManageCatalog: !catalogRes.error && catalogRes.data === true,
    canManageInventory: !inventoryRes.error && inventoryRes.data === true,
    canManageOrders: !ordersRes.error && ordersRes.data === true,
    canReadPayments: !paymentsRes.error && paymentsRes.data === true,
    canManageSettings: !settingsRes.error && settingsRes.data === true,
  };
}

export async function hasAnyCommerceReadPermission(): Promise<boolean> {
  return authorizeFlag("commerce.read");
}
