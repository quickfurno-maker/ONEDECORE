"use server";

import { revalidatePath } from "next/cache";
import {
  isSalaryLineType,
  isSalaryPaymentMethod,
  rupeesToPaise,
  type SalaryLineType,
  type SalaryPaymentMethod,
} from "../contracts/salary-contracts.ts";
import { SalaryError } from "../contracts/salary-errors.ts";
import {
  addSalaryStatementLine,
  createSalaryStatement,
  finalizeSalaryStatement,
  recordSalaryPayment,
  removeSalaryStatementLine,
  reopenSalaryStatement,
  setSalaryProfile,
} from "./salary-actions.ts";

export interface SalaryFormActionState {
  readonly success: boolean;
  readonly message: string;
  readonly code?: string;
}

export const INITIAL_SALARY_FORM_STATE: SalaryFormActionState = {
  success: false,
  message: "",
};

function fail(error: unknown, fallback: string): SalaryFormActionState {
  if (error instanceof SalaryError) {
    return { success: false, message: error.message, code: error.code };
  }
  return { success: false, message: fallback };
}

function revalidateSalary(statementId?: string) {
  revalidatePath("/admin/salary");
  if (statementId) {
    revalidatePath(`/admin/salary/${statementId}`);
  }
}

export async function setSalaryProfileAction(
  _prevState: SalaryFormActionState,
  formData: FormData
): Promise<SalaryFormActionState> {
  try {
    const paise = rupeesToPaise(String(formData.get("monthlySalary") ?? ""));
    if (paise == null) {
      return {
        success: false,
        message: "Enter a valid monthly salary in rupees.",
        code: "SALARY_AMOUNT_INVALID",
      };
    }

    await setSalaryProfile({
      staffId: String(formData.get("staffId") ?? ""),
      monthlyBaseSalaryPaise: paise,
      effectiveFrom: String(formData.get("effectiveFrom") ?? ""),
      note: String(formData.get("note") ?? ""),
    });

    revalidateSalary();
    return { success: true, message: "Salary version saved." };
  } catch (error) {
    return fail(error, "Unable to save the salary version.");
  }
}

export async function createSalaryStatementAction(
  _prevState: SalaryFormActionState,
  formData: FormData
): Promise<SalaryFormActionState> {
  try {
    await createSalaryStatement({
      staffId: String(formData.get("staffId") ?? ""),
      salaryMonth: String(formData.get("salaryMonth") ?? ""),
    });

    revalidateSalary();
    return { success: true, message: "Salary statement created." };
  } catch (error) {
    return fail(error, "Unable to create the salary statement.");
  }
}

export async function addSalaryLineAction(
  _prevState: SalaryFormActionState,
  formData: FormData
): Promise<SalaryFormActionState> {
  const statementId = String(formData.get("statementId") ?? "");
  try {
    const lineType = String(formData.get("lineType") ?? "");
    if (!isSalaryLineType(lineType)) {
      return {
        success: false,
        message: "Choose a valid addition or deduction type.",
        code: "SALARY_LINE_TYPE_INVALID",
      };
    }

    const paise = rupeesToPaise(String(formData.get("amount") ?? ""));
    if (paise == null || paise <= 0) {
      return {
        success: false,
        message: "Enter an amount greater than zero.",
        code: "SALARY_AMOUNT_INVALID",
      };
    }

    await addSalaryStatementLine({
      statementId,
      lineType: lineType as SalaryLineType,
      amountPaise: paise,
      note: String(formData.get("note") ?? ""),
    });

    revalidateSalary(statementId);
    return { success: true, message: "Line added." };
  } catch (error) {
    return fail(error, "Unable to add the line.");
  }
}

export async function removeSalaryLineAction(
  _prevState: SalaryFormActionState,
  formData: FormData
): Promise<SalaryFormActionState> {
  const statementId = String(formData.get("statementId") ?? "");
  try {
    await removeSalaryStatementLine(String(formData.get("lineId") ?? ""));
    revalidateSalary(statementId);
    return { success: true, message: "Line removed." };
  } catch (error) {
    return fail(error, "Unable to remove the line.");
  }
}

export async function finalizeSalaryStatementAction(
  _prevState: SalaryFormActionState,
  formData: FormData
): Promise<SalaryFormActionState> {
  const statementId = String(formData.get("statementId") ?? "");
  try {
    await finalizeSalaryStatement({
      statementId,
      note: String(formData.get("note") ?? ""),
    });
    revalidateSalary(statementId);
    return { success: true, message: "Statement finalized." };
  } catch (error) {
    return fail(error, "Unable to finalize the statement.");
  }
}

export async function reopenSalaryStatementAction(
  _prevState: SalaryFormActionState,
  formData: FormData
): Promise<SalaryFormActionState> {
  const statementId = String(formData.get("statementId") ?? "");
  try {
    await reopenSalaryStatement({
      statementId,
      reason: String(formData.get("reason") ?? ""),
    });
    revalidateSalary(statementId);
    return { success: true, message: "Statement reopened for amendment." };
  } catch (error) {
    return fail(error, "Unable to reopen the statement.");
  }
}

export async function recordSalaryPaymentAction(
  _prevState: SalaryFormActionState,
  formData: FormData
): Promise<SalaryFormActionState> {
  const statementId = String(formData.get("statementId") ?? "");
  try {
    const method = String(formData.get("method") ?? "");
    if (!isSalaryPaymentMethod(method)) {
      return {
        success: false,
        message: "Choose bank, UPI, cash or other.",
        code: "SALARY_PAYMENT_METHOD_INVALID",
      };
    }

    const paise = rupeesToPaise(String(formData.get("amount") ?? ""));
    if (paise == null || paise <= 0) {
      return {
        success: false,
        message: "Enter a payment amount greater than zero.",
        code: "SALARY_AMOUNT_INVALID",
      };
    }

    await recordSalaryPayment({
      statementId,
      amountPaise: paise,
      paymentDate: String(formData.get("paymentDate") ?? ""),
      method: method as SalaryPaymentMethod,
      reference: String(formData.get("reference") ?? ""),
      note: String(formData.get("note") ?? ""),
    });

    revalidateSalary(statementId);
    return { success: true, message: "Payment recorded." };
  } catch (error) {
    return fail(error, "Unable to record the payment.");
  }
}
