/**
 * Phase 6B integrated local E2E — repository schema through M21.
 * Local Supabase only. No managed writes. No Meta calls.
 *
 * Usage: npm run qa:phase-6b-integrated-local
 * Artifact: .artifacts/phase-6b-loop/12-integrated-local-e2e-report.json
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const root = path.resolve(__dirname, "..");
const artifactsDir = path.join(root, ".artifacts", "phase-6b-loop");

function run(command, args, label) {
  const started = Date.now();
  const result = spawnSync(command, args, {
    cwd: root,
    encoding: "utf8",
    shell: process.platform === "win32",
  });
  const entry = {
    label,
    command: [command, ...args].join(" "),
    exitCode: result.status ?? 1,
    durationMs: Date.now() - started,
    stdoutTail: (result.stdout ?? "").split("\n").slice(-20).join("\n"),
    stderrTail: (result.stderr ?? "").split("\n").slice(-20).join("\n"),
  };
  if (entry.exitCode !== 0) {
    console.error(`FAIL: ${label}`);
    if (result.stdout) console.error(result.stdout);
    if (result.stderr) console.error(result.stderr);
  } else {
    console.log(`PASS: ${label} (${entry.durationMs}ms)`);
  }
  return entry;
}

fs.mkdirSync(artifactsDir, { recursive: true });

const steps = [
  run("npm", ["run", "db:reset"], "db:reset"),
  run("npm", ["run", "db:test"], "db:test"),
  run("npm", ["run", "test:phase-6b-integrated"], "test:phase-6b-integrated"),
];

const report = {
  generatedAt: new Date().toISOString(),
  protectedMain: "2a2ec82e7889a3acda8d82a0d174772d64e40a26",
  schema: "repository M1-M21 local",
  steps,
  pass: steps.every((s) => s.exitCode === 0),
};

fs.writeFileSync(
  path.join(artifactsDir, "12-integrated-local-e2e-report.json"),
  JSON.stringify(report, null, 2)
);

if (!report.pass) {
  process.exit(1);
}

console.log("Phase 6B integrated local E2E: PASS");
