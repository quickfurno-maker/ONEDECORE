"use server";

import { revalidatePath } from "next/cache";
import type {
  SalesTargetActionState,
  SalesTargetScope,
} from "../contracts/sales-target-contracts.ts";
import { parseInrToPaise } from "../contracts/sales-target-contracts.ts";
import { requireCrmSalesTargetsAccess } from "./crm-auth.ts";
import { CrmError, crmErrorFromPostgresMessage } from "./crm-errors.ts";
import {
  createSalesTargetForCurrentUser,
  lockSalesTargetForCurrentUser,
  reopenSalesTargetForCurrentUser,
  reviseSalesTargetForCurrentUser,
} from "./crm-sales-target-service.ts";

function toActionState(error: unknown): SalesTargetActionState {
  if (error instanceof CrmError) {
    return { success: false, message: error.message, code: error.code };
  }
  const mapped = crmErrorFromPostgresMessage(
    error instanceof Error ? error.message : "Sales target operation failed"
  );
  return { success: false, message: mapped.message, code: mapped.code };
}

function parseScope(value: FormDataEntryValue | null): SalesTargetScope | null {
  const raw = String(value ?? "").trim();
  if (raw === "executive_personal" || raw === "sales_team") {
    return raw;
  }
  return null;
}

export async function createSalesTargetAction(
  _previous: SalesTargetActionState,
  formData: FormData
): Promise<SalesTargetActionState> {
  await requireCrmSalesTargetsAccess();

  const scope = parseScope(formData.get("targetScope"));
  const revenuePaise = parseInrToPaise(String(formData.get("revenueInr") ?? ""));
  const count = Number.parseInt(String(formData.get("closedWonCount") ?? ""), 10);
  const targetUserRaw = String(formData.get("targetUserId") ?? "").trim();

  try {
    if (!scope || revenuePaise === null || !Number.isFinite(count)) {
      throw new CrmError({
        code: "SALES_TARGET_INVALID",
        message: "Sales target details are invalid.",
        httpStatus: 422,
      });
    }

    await createSalesTargetForCurrentUser({
      targetScope: scope,
      targetMonth: String(formData.get("targetMonth") ?? ""),
      targetUserId: targetUserRaw.length > 0 ? targetUserRaw : null,
      revenueTargetPaise: revenuePaise,
      closedWonCountTarget: count,
      reason: String(formData.get("reason") ?? ""),
    });

    revalidatePath("/admin/crm/targets");
    return { success: true, message: "Sales target created." };
  } catch (error) {
    return toActionState(error);
  }
}

export async function reviseSalesTargetAction(
  _previous: SalesTargetActionState,
  formData: FormData
): Promise<SalesTargetActionState> {
  await requireCrmSalesTargetsAccess();

  const revenuePaise = parseInrToPaise(String(formData.get("revenueInr") ?? ""));
  const count = Number.parseInt(String(formData.get("closedWonCount") ?? ""), 10);
  const revision = Number.parseInt(String(formData.get("expectedRevision") ?? ""), 10);

  try {
    if (revenuePaise === null || !Number.isFinite(count) || !Number.isFinite(revision)) {
      throw new CrmError({
        code: "SALES_TARGET_INVALID",
        message: "Sales target details are invalid.",
        httpStatus: 422,
      });
    }

    await reviseSalesTargetForCurrentUser({
      targetId: String(formData.get("targetId") ?? ""),
      expectedRevision: revision,
      revenueTargetPaise: revenuePaise,
      closedWonCountTarget: count,
      reason: String(formData.get("reason") ?? ""),
    });

    revalidatePath("/admin/crm/targets");
    return { success: true, message: "Sales target revised." };
  } catch (error) {
    return toActionState(error);
  }
}

export async function lockSalesTargetAction(
  _previous: SalesTargetActionState,
  formData: FormData
): Promise<SalesTargetActionState> {
  await requireCrmSalesTargetsAccess();
  const revision = Number.parseInt(String(formData.get("expectedRevision") ?? ""), 10);

  try {
    await lockSalesTargetForCurrentUser({
      targetId: String(formData.get("targetId") ?? ""),
      expectedRevision: revision,
      reason: String(formData.get("reason") ?? ""),
    });
    revalidatePath("/admin/crm/targets");
    return { success: true, message: "Sales target locked." };
  } catch (error) {
    return toActionState(error);
  }
}

export async function reopenSalesTargetAction(
  _previous: SalesTargetActionState,
  formData: FormData
): Promise<SalesTargetActionState> {
  await requireCrmSalesTargetsAccess();
  const revision = Number.parseInt(String(formData.get("expectedRevision") ?? ""), 10);

  try {
    await reopenSalesTargetForCurrentUser({
      targetId: String(formData.get("targetId") ?? ""),
      expectedRevision: revision,
      reason: String(formData.get("reason") ?? ""),
    });
    revalidatePath("/admin/crm/targets");
    return { success: true, message: "Sales target reopened." };
  } catch (error) {
    return toActionState(error);
  }
}
