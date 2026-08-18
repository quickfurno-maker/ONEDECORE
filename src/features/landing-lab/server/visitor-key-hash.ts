import "server-only";

import { createHmac } from "node:crypto";

export function hashLandingVisitorKey(secret: string, visitorKey: string): string {
  return createHmac("sha256", secret).update(visitorKey, "utf8").digest("hex");
}

export function asiaKolkataAssignmentEpoch(now = new Date()): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Kolkata",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(now);
  const year = parts.find((part) => part.type === "year")?.value;
  const month = parts.find((part) => part.type === "month")?.value;
  const day = parts.find((part) => part.type === "day")?.value;
  return `${year}-${month}-${day}`;
}
