import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { fileURLToPath } from "node:url";
import { test } from "node:test";

const path = new URL("./prod1-readonly-vps-preflight.sh", import.meta.url);
const source = readFileSync(path, "utf8");
const shell = process.platform === "win32" ? "C:/Program Files/Git/bin/bash.exe" : "bash";
const scriptFile = process.platform === "win32"
  ? path.pathname.replace(/^\/([A-Za-z]):/, (_, drive) => `/${drive.toLowerCase()}`)
  : fileURLToPath(path);
const run = (...args) => spawnSync(shell, [scriptFile, ...args], {
  encoding: "utf8", timeout: 15000
});

test("Bash preflight script passes syntax and help checks", () => {
  const syntax = spawnSync(shell, ["-n", scriptFile], {encoding: "utf8",timeout: 10000});
  assert.equal(syntax.status, 0, syntax.stderr);
  const help = run("--help");
  assert.equal(help.status, 0, help.stderr);
  assert.match(help.stdout, /NOT a deployment permit/);
});

test("preflight locks exact existing production baseline", () => {
  assert.match(source, /27521f031195a8b749bebeceae0ba22ad475b816/);
  assert.match(source, /onedecore-prod/);
  assert.match(source, /git_app status --porcelain --untracked-files=no/);
  assert.match(source, /symbolic-ref --quiet --short HEAD/);
});

test("preflight validates systemd PM2 runtime and private environment file", () => {
  assert.match(source, /systemctl is-active/);
  assert.match(source, /systemctl show/);
  assert.match(source, /PM2_PID/);
  assert.match(source, /stat -c %U:%G/);
  assert.match(source, /stat -c %a/);
});

test("environment check enforces existing outbound and webhook ENABLED without printing secrets", () => {
  for (const name of [
    "ONEDECORE_WHATSAPP_OUTBOUND_MODE",
    "ONEDECORE_WHATSAPP_WEBHOOK_MODE",
    "ONEDECORE_CAMPAIGN_EXECUTION_MODE",
    "ONEDECORE_SHOP_PUBLIC_ENABLED",
    "ONEDECORE_PROVIDER_DATA_SHARING_ENABLED",
    "ONEDECORE_LEAD_INTAKE_MODE"
  ]) assert.ok(source.includes(name), name);
  assert.match(source, /"ONEDECORE_WHATSAPP_OUTBOUND_MODE": "enabled"/);
  assert.match(source, /"ONEDECORE_WHATSAPP_WEBHOOK_MODE": "enabled"/);
  assert.match(source, /"ONEDECORE_CAMPAIGN_EXECUTION_MODE": "disabled"/);
  assert.doesNotMatch(source, /(?:^|\n)\s*(?:source|\.)\s+["']?\$?\{?ENV_FILE/m);
});

test("strict source-only preflight has no mutation or external messaging steps", () => {
  assert.doesNotMatch(source, /(?:^|\n)\s*(?:git\s+(?:merge|pull|push|reset|switch|checkout|fetch)|pm2\s+(?:restart|start|stop)|systemctl\s+(?:restart|start|stop)|npm\s+(?:ci|install|run\s+build)|supabase\s+(?:db|migration)|curl\s+.*(?:--data|\-X\s+POST))/m);
  assert.match(source, /PROD1_READ_ONLY_PREFLIGHT_PASS \(NO DEPLOYMENT AUTHORIZED\)/);
  assert.match(source, /MANUAL GATES/);
});
