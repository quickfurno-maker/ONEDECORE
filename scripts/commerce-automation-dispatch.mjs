#!/usr/bin/env node

const enabled = process.env.ONEDECORE_COMMERCE_AUTOMATION_ENABLED === "true";
if (!enabled) {
  console.log("[commerce-automation] deployment gate disabled");
  process.exit(0);
}

const secret = process.env.ONEDECORE_COMMERCE_AUTOMATION_WORKER_SECRET ?? "";
if (secret.length < 32) {
  throw new Error("commerce automation worker secret is missing or too short");
}

const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 25_000);

try {
  const response = await fetch("http://127.0.0.1:3000/api/internal/commerce-automation/dispatch", {
    method: "POST",
    headers: {
      authorization: `Bearer ${secret}`,
      "content-type": "application/json",
    },
    body: JSON.stringify({ maxBatch: 50 }),
    signal: controller.signal,
  });

  const payload = await response.json().catch(() => null);
  if (!response.ok || !payload || payload.ok !== true) {
    throw new Error(`commerce automation dispatch failed with HTTP ${response.status}`);
  }

  const processed = Number(payload.processed ?? 0);
  const succeeded = Number(payload.succeeded ?? 0);
  const retried = Number(payload.retried ?? 0);
  const dead = Number(payload.dead ?? 0);
  console.log(
    `[commerce-automation] processed=${processed} succeeded=${succeeded} retried=${retried} dead=${dead}`
  );
} finally {
  clearTimeout(timeout);
}
