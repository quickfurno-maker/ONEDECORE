"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.generated";
import {
  isSalaryLineType,
  isSalaryPaymentMethod,
  mapSalaryStatementDetail,
  mapSalaryStatementSummary,
  type SalaryLineType,
  type SalaryPaymentMethod,
  type SalaryStatementDetail,
  type SalaryStatementSummary,
} from "../contracts/salary-contracts.ts";
import {
  createSalaryError,
  salaryErrorFromPostgresMessage,
} from "../contracts/salary-errors.ts";

type SalaryServerClient = SupabaseClient<Database>;

interface SetSalaryProfileArgs {
  readonly p_staff_id: string;
  readonly p_monthly_base_salary_paise: number;
  readonly p_effective_from: string;
  readonly p_note?: string | null;
}

interface CreateStatementArgs {
  readonly p_staff_id: string;
  readonly p_salary_month: string;
}

interface AddLineArgs {
  readonly p_statement_id: string;
  readonly p_line_type: string;
  readonly p_amount_paise: number;
  readonly p_note?: string | null;
}

interface RemoveLineArgs {
  readonly p_line_id: string;
}

interface StatementNoteArgs {
  readonly p_statement_id: string;
  readonly p_note?: string | null;
}

interface ReopenArgs {
  readonly p_statement_id: string;
  readonly p_reason: string;
}

interface RecordPaymentArgs {
  readonly p_statement_id: string;
  readonly p_amount_paise: number;
  readonly p_payment_date: string;
  readonly p_method: string;
  readonly p_reference?: string | null;
  readonly p_note?: string | null;
}

interface GetStatementArgs {
  readonly p_statement_id: string;
}

interface ListStatementsArgs {
  readonly p_staff_id?: string | null;
  readonly p_limit?: number;
}

type SalaryRpcClient = SalaryServerClient & {
  rpc(fn: "set_salary_profile", args: SetSalaryProfileArgs): ReturnType<SalaryServerClient["rpc"]>;
  rpc(fn: "create_salary_statement", args: CreateStatementArgs): ReturnType<SalaryServerClient["rpc"]>;
  rpc(fn: "add_salary_statement_line", args: AddLineArgs): ReturnType<SalaryServerClient["rpc"]>;
  rpc(fn: "remove_salary_statement_line", args: RemoveLineArgs): ReturnType<SalaryServerClient["rpc"]>;
  rpc(fn: "finalize_salary_statement", args: StatementNoteArgs): ReturnType<SalaryServerClient["rpc"]>;
  rpc(fn: "reopen_salary_statement", args: ReopenArgs): ReturnType<SalaryServerClient["rpc"]>;
  rpc(fn: "record_salary_payment", args: RecordPaymentArgs): ReturnType<SalaryServerClient["rpc"]>;
  rpc(fn: "get_salary_statement", args: GetStatementArgs): ReturnType<SalaryServerClient["rpc"]>;
  rpc(fn: "list_salary_statements", args: ListStatementsArgs): ReturnType<SalaryServerClient["rpc"]>;
};

function salaryRpcClient(client: SalaryServerClient): SalaryRpcClient {
  return client as SalaryRpcClient;
}

function assertObject(data: unknown, label: string): Record<string, unknown> {
  if (!data || typeof data !== "object") {
    throw salaryErrorFromPostgresMessage(`Empty ${label} RPC result`);
  }
  return data as Record<string, unknown>;
}

/**
 * Sets a new effective-dated salary version.
 *
 * Authority (`salary.manage`) is enforced in the database, so a caller that
 * bypasses the UI still hits the same gate.
 */
export async function setSalaryProfile(input: {
  readonly staffId: string;
  readonly monthlyBaseSalaryPaise: number;
  readonly effectiveFrom: string;
  readonly note?: string | null;
}): Promise<Record<string, unknown>> {
  if (!Number.isFinite(input.monthlyBaseSalaryPaise) || input.monthlyBaseSalaryPaise < 0) {
    throw createSalaryError("SALARY_AMOUNT_INVALID");
  }
  if (!input.effectiveFrom) {
    throw createSalaryError("SALARY_EFFECTIVE_FROM_REQUIRED");
  }

  const client = await createClient();
  const { data, error } = await salaryRpcClient(client).rpc("set_salary_profile", {
    p_staff_id: input.staffId,
    p_monthly_base_salary_paise: input.monthlyBaseSalaryPaise,
    p_effective_from: input.effectiveFrom,
    p_note: input.note?.trim() || null,
  });

  if (error) {
    throw salaryErrorFromPostgresMessage(error.message);
  }
  return assertObject(data, "set_salary_profile");
}

/** Builds the month's statement from APPROVED attendance. Never mutates it. */
export async function createSalaryStatement(input: {
  readonly staffId: string;
  readonly salaryMonth: string;
}): Promise<Record<string, unknown>> {
  const client = await createClient();
  const { data, error } = await salaryRpcClient(client).rpc("create_salary_statement", {
    p_staff_id: input.staffId,
    p_salary_month: input.salaryMonth,
  });

  if (error) {
    throw salaryErrorFromPostgresMessage(error.message);
  }
  return assertObject(data, "create_salary_statement");
}

export async function addSalaryStatementLine(input: {
  readonly statementId: string;
  readonly lineType: SalaryLineType;
  readonly amountPaise: number;
  readonly note?: string | null;
}): Promise<Record<string, unknown>> {
  if (!isSalaryLineType(input.lineType)) {
    throw createSalaryError("SALARY_LINE_TYPE_INVALID");
  }
  if (!Number.isFinite(input.amountPaise) || input.amountPaise <= 0) {
    throw createSalaryError("SALARY_AMOUNT_INVALID");
  }

  const client = await createClient();
  const { data, error } = await salaryRpcClient(client).rpc("add_salary_statement_line", {
    p_statement_id: input.statementId,
    p_line_type: input.lineType,
    p_amount_paise: input.amountPaise,
    p_note: input.note?.trim() || null,
  });

  if (error) {
    throw salaryErrorFromPostgresMessage(error.message);
  }
  return assertObject(data, "add_salary_statement_line");
}

export async function removeSalaryStatementLine(
  lineId: string
): Promise<Record<string, unknown>> {
  const client = await createClient();
  const { data, error } = await salaryRpcClient(client).rpc(
    "remove_salary_statement_line",
    { p_line_id: lineId }
  );

  if (error) {
    throw salaryErrorFromPostgresMessage(error.message);
  }
  return assertObject(data, "remove_salary_statement_line");
}

export async function finalizeSalaryStatement(input: {
  readonly statementId: string;
  readonly note?: string | null;
}): Promise<Record<string, unknown>> {
  const client = await createClient();
  const { data, error } = await salaryRpcClient(client).rpc("finalize_salary_statement", {
    p_statement_id: input.statementId,
    p_note: input.note?.trim() || null,
  });

  if (error) {
    throw salaryErrorFromPostgresMessage(error.message);
  }
  return assertObject(data, "finalize_salary_statement");
}

/** Controlled amendment: reopening always records a reason. */
export async function reopenSalaryStatement(input: {
  readonly statementId: string;
  readonly reason: string;
}): Promise<Record<string, unknown>> {
  const reason = input.reason.trim();
  if (reason.length === 0 || reason.length > 500) {
    throw createSalaryError("SALARY_REASON_REQUIRED");
  }

  const client = await createClient();
  const { data, error } = await salaryRpcClient(client).rpc("reopen_salary_statement", {
    p_statement_id: input.statementId,
    p_reason: reason,
  });

  if (error) {
    throw salaryErrorFromPostgresMessage(error.message);
  }
  return assertObject(data, "reopen_salary_statement");
}

export async function recordSalaryPayment(input: {
  readonly statementId: string;
  readonly amountPaise: number;
  readonly paymentDate: string;
  readonly method: SalaryPaymentMethod;
  readonly reference?: string | null;
  readonly note?: string | null;
}): Promise<Record<string, unknown>> {
  if (!isSalaryPaymentMethod(input.method)) {
    throw createSalaryError("SALARY_PAYMENT_METHOD_INVALID");
  }
  if (!Number.isFinite(input.amountPaise) || input.amountPaise <= 0) {
    throw createSalaryError("SALARY_AMOUNT_INVALID");
  }

  const client = await createClient();
  const { data, error } = await salaryRpcClient(client).rpc("record_salary_payment", {
    p_statement_id: input.statementId,
    p_amount_paise: input.amountPaise,
    p_payment_date: input.paymentDate,
    p_method: input.method,
    p_reference: input.reference?.trim() || null,
    p_note: input.note?.trim() || null,
  });

  if (error) {
    throw salaryErrorFromPostgresMessage(error.message);
  }
  return assertObject(data, "record_salary_payment");
}

/** Visibility is enforced by `private.salary_can_view`: own salary, or all for a manager. */
export async function loadSalaryStatement(
  statementId: string
): Promise<SalaryStatementDetail | null> {
  const client = await createClient();
  const { data, error } = await salaryRpcClient(client).rpc("get_salary_statement", {
    p_statement_id: statementId,
  });

  if (error) {
    throw salaryErrorFromPostgresMessage(error.message);
  }
  if (!data) {
    return null;
  }
  return mapSalaryStatementDetail(data as Record<string, unknown>);
}

export async function listSalaryStatements(input?: {
  readonly staffId?: string | null;
  readonly limit?: number;
}): Promise<readonly SalaryStatementSummary[]> {
  const client = await createClient();
  const { data, error } = await salaryRpcClient(client).rpc("list_salary_statements", {
    p_staff_id: input?.staffId ?? null,
    p_limit: input?.limit ?? 50,
  });

  if (error) {
    throw salaryErrorFromPostgresMessage(error.message);
  }

  const rows = Array.isArray(data) ? data : [];
  return rows.map((row) => mapSalaryStatementSummary(row as Record<string, unknown>));
}
