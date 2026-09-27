"use server";
import "server-only";

import { revalidatePath } from "next/cache";
import {
  WHATSAPP_ADMIN_SETTINGS_PATH,
  type WhatsappControlPlaneActionState,
} from "../contracts/control-plane.ts";
import { resolveWhatsappControlPlaneAccess } from "./whatsapp-control-plane-auth.ts";
import { activateConfiguredMetaProductionSender } from "./whatsapp-production-activation.ts";

export async function activateWhatsappProductionSenderAction(
  _previous: WhatsappControlPlaneActionState,
  formData: FormData
): Promise<WhatsappControlPlaneActionState> {
  const access = await resolveWhatsappControlPlaneAccess();
  if (!access?.permissions["whatsapp.settings.manage"]) {
    return {
      success: false,
      code: "ACCESS_DENIED",
      message: "Only a Super Admin can activate the production WhatsApp sender.",
    };
  }

  if (formData.get("confirmProductionSender") !== "on") {
    return {
      success: false,
      code: "CONFIRM_REQUIRED",
      field: "confirmProductionSender",
      message: "Confirm that the configured Meta number is the ONEDECORE production sender.",
    };
  }

  const result = await activateConfiguredMetaProductionSender();
  if (!result.ok) {
    return {
      success: false,
      code: result.code,
      message: result.message,
    };
  }

  revalidatePath(WHATSAPP_ADMIN_SETTINGS_PATH);
  return {
    success: true,
    message:
      `Production sender verified with Meta and locked to ${result.displayPhoneNumber}. Legacy/test senders are archived for new outbound traffic.`,
  };
}
