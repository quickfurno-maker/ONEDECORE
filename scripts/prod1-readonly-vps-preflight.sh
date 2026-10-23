#!/usr/bin/env bash
# ONEDECORE PROD-1: read-only VPS inspection. Never deploys, merges, restarts,
# writes environment files, or communicates with WhatsApp/Meta providers.
set -Eeuo pipefail

readonly EXPECTED_HOST="onedecore-prod"
readonly APP_DIR="/var/www/onedecore"
readonly APP_USER="onedecore"
readonly BASELINE_SHA="27521f031195a8b749bebeceae0ba22ad475b816"
readonly SERVICE="pm2-onedecore.service"
readonly ENV_FILE="$APP_DIR/.env.production.local"

if [[ "${1:-}" == "--help" ]]; then
  printf 'Usage: bash scripts/prod1-readonly-vps-preflight.sh\nOnly reads local VPS state. It is NOT a deployment permit.\n'
  exit 0
fi

check() { printf 'PASS %s\n' "$*"; }
block() { printf 'BLOCK %s\n' "$*" >&2; exit 1; }
[[ "$#" -eq 0 ]] || block "unexpected arguments"
for tool in hostname id git sudo systemctl stat curl awk df python3; do
  command -v "$tool" >/dev/null 2>&1 || block "missing required tool: $tool"
done
[[ "$(hostname)" == "$EXPECTED_HOST" ]] || block "wrong VPS host"
[[ "$(id -un)" == "root" ]] || block "run this read-only check from the existing root console"
[[ -d "$APP_DIR/.git" ]] || block "application .git directory missing"
git_app() { sudo -u "$APP_USER" -H git -C "$APP_DIR" "$@"; }

readonly CURRENT_SHA="$(git_app rev-parse HEAD)"
printf 'CURRENT_SHA=%s\n' "$CURRENT_SHA"
[[ "$CURRENT_SHA" == "$BASELINE_SHA" ]] || block "production baseline changed; reconcile before deploying"
[[ "$(git_app symbolic-ref --quiet --short HEAD)" == "main" ]] || block "production HEAD is not attached to main"
[[ -z "$(git_app status --porcelain --untracked-files=no)" ]] || block "production has modified tracked files"
check "expected main checkout and clean tracked files"

[[ "$(systemctl is-active "$SERVICE")" == "active" ]] || block "PM2 service is not active"
[[ "$(systemctl show "$SERVICE" --property=User --value)" == "$APP_USER" ]] || block "PM2 systemd unit has unexpected runtime user"
readonly PM2_PID="$(systemctl show "$SERVICE" --property=MainPID --value)"
[[ "$PM2_PID" =~ ^[0-9]+$ && "$PM2_PID" -gt 1 ]] || block "PM2 main PID invalid"
check "systemd PM2 daemon active, user=$APP_USER, mainPID=$PM2_PID"
if ! ps -o args= -p "$PM2_PID" | grep -Eq 'PM2'; then
  block "systemd MainPID does not appear to be a PM2 daemon"
fi
check "systemd MainPID is PM2; verify the application list separately"

[[ -f "$ENV_FILE" ]] || block "production env file missing"
[[ "$(stat -c %U:%G "$ENV_FILE")" == "$APP_USER:$APP_USER" ]] || block "environment file ownership unexpected"
[[ "$(stat -c %a "$ENV_FILE")" == "600" ]] || block "environment file mode must be 600"
check "private environment file exists; values not disclosed"

# Parse data only. NEVER source or evaluate env content.
python3 - "$ENV_FILE" <<'PY'
from pathlib import Path
import sys
found = {}
for line in Path(sys.argv[1]).read_text().splitlines():
    if not line or line.lstrip().startswith("#") or "=" not in line:
        continue
    name, value = line.split("=", 1)
    found[name.strip()] = value.strip().strip("'\"").lower()
# Lock the exact presently observed production behaviours for the narrow code-only release.
expected = {
  "ONEDECORE_WHATSAPP_OUTBOUND_MODE": "enabled",
  "ONEDECORE_WHATSAPP_WEBHOOK_MODE": "enabled",
  "ONEDECORE_CAMPAIGN_EXECUTION_MODE": "disabled",
  "ONEDECORE_SHOP_PUBLIC_ENABLED": "disabled",
  "ONEDECORE_PROVIDER_DATA_SHARING_ENABLED": "disabled",
  "ONEDECORE_LEAD_INTAKE_MODE": "enabled",
}
for name, want in expected.items():
    got = found.get(name)
    if got != want:
        print(f"BLOCK {name}: expected {want.upper()}, observed " + ("UNSET" if got is None else "DIFFERENT"))
        sys.exit(1)
    print(f"PASS {name} == {want.upper()} (value category only)")
PY

readonly HEALTH_CODE="$(curl -sS --max-time 8 -o /dev/null -w '%{http_code}' http://127.0.0.1:3000/api/health)"
[[ "$HEALTH_CODE" == "200" ]] || block "local app health returned $HEALTH_CODE"
check "local health HTTP 200"

readonly DISK_AVAILABLE_KB="$(df -Pk "$APP_DIR" | awk 'END{print $4}')"
readonly RAM_AVAILABLE_KB="$(awk '/^MemAvailable:/{print $2}' /proc/meminfo)"
[[ "$DISK_AVAILABLE_KB" =~ ^[0-9]+$ && "$DISK_AVAILABLE_KB" -ge 2097152 ]] || block "under 2GiB disk available"
[[ "$RAM_AVAILABLE_KB" =~ ^[0-9]+$ && "$RAM_AVAILABLE_KB" -ge 1048576 ]] || block "under 1GiB RAM available"
check "at least 2GiB free disk, 1GiB available memory"

printf 'PROD1_READ_ONLY_PREFLIGHT_PASS (NO DEPLOYMENT AUTHORIZED)\n'
printf 'MANUAL GATES: verify Supabase restore/PITR, Storage object recovery, systemd restart ownership, owner risk waiver, approved merge SHA and launch window.\n'
