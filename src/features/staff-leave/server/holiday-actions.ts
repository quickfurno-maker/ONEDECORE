"use server";

import type { SupabaseClient } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";
import type { Database } from "@/types/database.generated";
import {
  attendanceErrorFromPostgresMessage,
} from "@/features/staff-attendance/contracts/errors.ts";
import type { HolidaySummary, HolidayMutationResult } from "../contracts/dto.ts";
import { mapHolidayMutationRpcResult, mapHolidayRowToSummary } from "../contracts/dto.ts";
import { requireHolidayManageAccess } from "./leave-auth.ts";

type HolidayServerClient = SupabaseClient<Database>;

interface CreateHolidayRpcArgs {
  readonly p_holiday_date: string;
  readonly p_name: string;
}

interface ArchiveHolidayRpcArgs {
  readonly p_holiday_id: string;
}

type HolidayRpcClient = HolidayServerClient & {
  rpc(fn: "create_holiday", args: CreateHolidayRpcArgs): ReturnType<HolidayServerClient["rpc"]>;
  rpc(fn: "archive_holiday", args: ArchiveHolidayRpcArgs): ReturnType<HolidayServerClient["rpc"]>;
};

type HolidayQueryResult = Promise<{
  data: unknown;
  error: { message: string } | null;
}>;

type HolidayQueryBuilder = PromiseLike<{
  data: unknown;
  error: { message: string } | null;
}> & {
  select(columns: string): HolidayQueryBuilder;
  eq(column: string, value: boolean): HolidayQueryBuilder;
  order(column: string, options: { ascending: boolean }): HolidayQueryBuilder;
};

type HolidayQueryClient = {
  from(table: "holidays"): HolidayQueryBuilder;
};

function holidayRpcClient(client: HolidayServerClient): HolidayRpcClient {
  return client as HolidayRpcClient;
}

function holidayQueryClient(client: HolidayServerClient): HolidayQueryClient {
  return client as unknown as HolidayQueryClient;
}

export async function create(input: {
  readonly holidayDate: string;
  readonly name: string;
}): Promise<HolidayMutationResult> {
  await requireHolidayManageAccess();

  const supabase = await createClient();
  const { data, error } = await holidayRpcClient(supabase).rpc("create_holiday", {
    p_holiday_date: input.holidayDate,
    p_name: input.name.trim(),
  });

  if (error) {
    throw attendanceErrorFromPostgresMessage(error.message);
  }

  return mapHolidayMutationRpcResult(data as { holidayId: string; holidayDate: string });
}

export async function archive(holidayId: string): Promise<HolidayMutationResult> {
  await requireHolidayManageAccess();

  const supabase = await createClient();
  const { data, error } = await holidayRpcClient(supabase).rpc("archive_holiday", {
    p_holiday_id: holidayId,
  });

  if (error) {
    throw attendanceErrorFromPostgresMessage(error.message);
  }

  return mapHolidayMutationRpcResult(data as { holidayId: string; isActive: false });
}

export async function loadActiveHolidays(): Promise<readonly HolidaySummary[]> {
  await requireHolidayManageAccess();

  const supabase = await createClient();
  const { data, error } = await holidayQueryClient(supabase)
    .from("holidays")
    .select("id, holiday_date, name, is_active")
    .eq("is_active", true)
    .order("holiday_date", { ascending: true });

  if (error) {
    throw attendanceErrorFromPostgresMessage(error.message);
  }

  return ((data as Parameters<typeof mapHolidayRowToSummary>[0][] | null) ?? []).map(
    mapHolidayRowToSummary
  );
}
