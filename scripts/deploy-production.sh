#!/usr/bin/env bash
#
# ONEDECORE production deployment. The only supported way to ship this app.
#
# WHY THIS FILE EXISTS
#
# There was no canonical deploy entrypoint, so every release was hand-run over
# SSH as root: `git pull`, `npm ci`, `npm run build`. Each one wrote tens of
# thousands of root-owned files into `node_modules` and `.next` while the app
# itself runs as the unix user `onedecore`. The consequences were not subtle:
#
#   * `npm ci` failing with EACCES on `node_modules/.bin/acorn`, because the
#     previous root install left files the app user cannot unlink.
#   * ISR silently broken — `EACCES: permission denied, open
#     '/var/www/onedecore/.next/server/app/index.html'`. Pages SERVED fine and
#     simply never revalidated, so `revalidate = 300` was dead for weeks and
#     nothing alerted.
#
# Both were "fixed" three times by remembering to `chown -R` afterwards. A fix
# that depends on remembering is not a fix, so this script refuses to run as the
# user that causes the problem.
#
# HOW TO DEPLOY
#
#   ssh root@<host>
#   sudo -u onedecore -H /var/www/onedecore/scripts/deploy-production.sh <merge-sha>
#
# The SHA is required and must already be on `origin/main`. Deploying "whatever
# main is now" is how a release becomes unreproducible the moment someone merges
# during the window.

set -Eeuo pipefail

readonly APP_DIR="/var/www/onedecore"
readonly APP_USER="onedecore"
readonly PM2_APP="onedecore"
readonly EXPECTED_PM2_HOME="/home/onedecore/.pm2"
readonly ENV_FILE=".env.production.local"
readonly HEALTH_URL="http://127.0.0.1:3000/api/health"
readonly HEALTH_ATTEMPTS=30

log()  { printf '[deploy] %s\n' "$*"; }
fail() { printf '[deploy] FAILED: %s\n' "$*" >&2; exit 1; }

trap 'fail "aborted at line $LINENO"' ERR

# ---------------------------------------------------------------- 1. identity

# The whole point of the script. Running as root is what created the mess this
# exists to prevent, so it is refused before anything is touched.
readonly CURRENT_USER="$(id -un)"
if [ "$CURRENT_USER" != "$APP_USER" ]; then
  fail "must run as '$APP_USER', not '$CURRENT_USER'. Use: sudo -u $APP_USER -H $0 <sha>"
fi
if [ "$(id -u)" = "0" ]; then
  fail "refusing to run as uid 0"
fi

readonly TARGET_SHA="${1:-}"
if [ -z "$TARGET_SHA" ]; then
  fail "usage: $0 <merge-sha>   (the exact commit to deploy, already on origin/main)"
fi
if ! printf '%s' "$TARGET_SHA" | grep -Eq '^[0-9a-f]{7,40}$'; then
  fail "'$TARGET_SHA' is not a git sha"
fi

# `sudo -u` does not always carry PM2_HOME, and a PM2 command without it talks
# to a DIFFERENT daemon — which is how a second copy of the app gets started.
export PM2_HOME="${PM2_HOME:-$EXPECTED_PM2_HOME}"
if [ "$PM2_HOME" != "$EXPECTED_PM2_HOME" ]; then
  fail "PM2_HOME is '$PM2_HOME', expected '$EXPECTED_PM2_HOME'"
fi

cd "$APP_DIR" || fail "cannot enter $APP_DIR"

# ------------------------------------------------------------------- 2. state

[ -r "$ENV_FILE" ] || fail "$ENV_FILE missing or unreadable by $APP_USER"

# Tracked changes only. Untracked files are expected here: the production env
# and its dated backups live in this directory and must survive every deploy.
if [ -n "$(git status --porcelain --untracked-files=no)" ]; then
  git status --short --untracked-files=no
  fail "tracked files are modified on production; refusing to deploy over them"
fi

readonly PREVIOUS_SHA="$(git rev-parse HEAD)"
log "current:  $PREVIOUS_SHA"
log "target:   $TARGET_SHA"

# ------------------------------------------------------------------- 3. fetch

git fetch origin main --quiet || fail "git fetch failed"

# The target must be an ancestor of origin/main. This refuses a sha that was
# force-pushed away, that belongs to an unmerged branch, or that someone typed
# from the wrong tab.
if ! git merge-base --is-ancestor "$TARGET_SHA" origin/main; then
  fail "$TARGET_SHA is not on origin/main"
fi

# Fast-forward only. No reset --hard: the production env and its backups are
# untracked, and a hard reset is one typo away from taking the tree with it.
git merge --ff-only "$TARGET_SHA" --quiet || fail "cannot fast-forward to $TARGET_SHA"

readonly DEPLOYED_SHA="$(git rev-parse HEAD)"
if [ "${DEPLOYED_SHA#"$TARGET_SHA"}" = "$DEPLOYED_SHA" ]; then
  fail "HEAD is $DEPLOYED_SHA, expected $TARGET_SHA"
fi
log "checked out: $DEPLOYED_SHA"

# ------------------------------------------------------------ 4. install/build

# Both as $APP_USER, which is the entire fix. No sudo anywhere in this script:
# if it needed to elevate, it would be recreating the defect.
log "npm ci (as $CURRENT_USER)"
npm ci

log "npm run build (as $CURRENT_USER)"
npm run build

# ------------------------------------------------- 5. ownership gate (blocking)

# Checked BEFORE the restart, so a bad build is never the thing serving traffic.
assert_owned_by_app_user() {
  local dir="$1"
  [ -d "$dir" ] || fail "$dir missing after build"
  local strays
  strays="$(find "$dir" ! -user "$APP_USER" 2>/dev/null | wc -l)"
  if [ "$strays" -ne 0 ]; then
    find "$dir" ! -user "$APP_USER" -printf '%u:%g %p\n' 2>/dev/null | head -5
    fail "$strays file(s) in $dir are not owned by $APP_USER"
  fi
  log "$dir: all files owned by $APP_USER"
}

assert_owned_by_app_user node_modules
assert_owned_by_app_user .next

# The specific file whose unwritability silently disabled ISR.
ISR_TARGET=".next/server/app/index.html"
if [ -f "$ISR_TARGET" ] && [ ! -w "$ISR_TARGET" ]; then
  fail "$ISR_TARGET is not writable by $APP_USER; ISR revalidation would fail"
fi

# ----------------------------------------------------------------- 6. restart

# Restart the EXISTING app. Never `pm2 start`: that would add a second process
# serving the same port under the same name and make the next deploy ambiguous.
pm2 describe "$PM2_APP" >/dev/null 2>&1 || fail "PM2 app '$PM2_APP' not found under $PM2_HOME"

log "restarting PM2 app '$PM2_APP'"
pm2 restart "$PM2_APP" --update-env >/dev/null

readonly PROCESS_COUNT="$(pm2 jlist | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{console.log(JSON.parse(d).length)}catch(e){console.log(0)}})')"
if [ "$PROCESS_COUNT" != "1" ]; then
  fail "expected exactly 1 PM2 process, found $PROCESS_COUNT"
fi

# ------------------------------------------------------------------ 7. health

log "waiting for health"
for attempt in $(seq 1 "$HEALTH_ATTEMPTS"); do
  code="$(curl -s -o /dev/null -m 4 -w '%{http_code}' "$HEALTH_URL" || true)"
  if [ "$code" = "200" ]; then
    log "health 200 after ${attempt}s"
    break
  fi
  if [ "$attempt" -eq "$HEALTH_ATTEMPTS" ]; then
    pm2 logs "$PM2_APP" --lines 20 --nostream 2>/dev/null || true
    fail "health check never returned 200 (last: ${code:-none})"
  fi
  sleep 1
done

# Re-checked after the restart: a running app writing its first ISR entry is the
# moment the old defect actually bit.
assert_owned_by_app_user .next

log "deployed $DEPLOYED_SHA (was $PREVIOUS_SHA)"
log "done"
