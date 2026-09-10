import "server-only";

import { createClient } from "@/lib/supabase/server";
import { authorizeMany } from "@/server/auth/authorize-many";

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
  /*
   * One round trip, not 6. `authorize_many` loops over
   * `public.authorize`, so the access rules are unchanged; only the number
   * of times the page asks them has.
   */
  const answers = await authorizeMany(
    [
    "commerce.read",
    "commerce.catalog.manage",
    "commerce.inventory.manage",
    "commerce.orders.manage",
    "commerce.payments.read",
    "commerce.settings.manage",
    ] as const,
    supabase
  );
  return {
    canRead: !false && answers["commerce.read"],
    canManageCatalog: !false && answers["commerce.catalog.manage"],
    canManageInventory: !false && answers["commerce.inventory.manage"],
    canManageOrders: !false && answers["commerce.orders.manage"],
    canReadPayments: !false && answers["commerce.payments.read"],
    canManageSettings: !false && answers["commerce.settings.manage"],
  };
}

export async function hasAnyCommerceReadPermission(): Promise<boolean> {
  return authorizeFlag("commerce.read");
}
