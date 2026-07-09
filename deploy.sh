#!/usr/bin/env bash
# =============================================================================
# deploy.sh — production deployment for the LRC Volunteer Management System
#
#   Framework : Vite 8 + React 19 + TypeScript (static SPA)
#   Backend   : Supabase (hosted) — no local database
#   Serve     : `vite preview` (built ./dist) managed by systemd
#
# What it does (idempotent — safe to run repeatedly):
#   1. Clone the repo if missing, otherwise pull the latest code.
#   2. Install/update npm dependencies only when the lockfile changed.
#   3. (Optional, opt-in) apply Supabase SQL migrations.
#   4. Rebuild the static bundle only when the code or deps changed.
#   5. Install/refresh the systemd unit, gracefully restart the single instance.
#   6. Health-check the running app before declaring success.
#
# Usage:
#   ./deploy.sh
#
# Everything is configurable via environment variables or .env.production
# (see the CONFIG section and .env.production.example).
# =============================================================================

set -Eeuo pipefail

# -----------------------------------------------------------------------------
# Colored logging
# -----------------------------------------------------------------------------
if [[ -t 1 ]]; then
  C_RESET=$'\033[0m'; C_BLUE=$'\033[1;34m'; C_GREEN=$'\033[1;32m'
  C_YELLOW=$'\033[1;33m'; C_RED=$'\033[1;31m'; C_DIM=$'\033[2m'
else
  C_RESET=''; C_BLUE=''; C_GREEN=''; C_YELLOW=''; C_RED=''; C_DIM=''
fi
log()   { printf '%s\n' "${C_BLUE}==>${C_RESET} $*"; }
step()  { printf '%s\n' "${C_BLUE}▶ $*${C_RESET}"; }
ok()    { printf '%s\n' "${C_GREEN}✓${C_RESET} $*"; }
warn()  { printf '%s\n' "${C_YELLOW}!${C_RESET} $*"; }
info()  { printf '%s\n' "${C_DIM}  $*${C_RESET}"; }
die()   { printf '%s\n' "${C_RED}✗ ERROR: $*${C_RESET}" >&2; exit 1; }
trap 'die "deploy failed at line $LINENO (command: $BASH_COMMAND)"' ERR

# -----------------------------------------------------------------------------
# CONFIG (override any of these via the environment)
# -----------------------------------------------------------------------------
REPO_URL="${REPO_URL:-https://github.com/Jamal-z/LRC.git}"
BRANCH="${BRANCH:-main}"
SERVICE_NAME="${SERVICE_NAME:-lrc}"
HEALTH_TIMEOUT="${HEALTH_TIMEOUT:-60}"   # seconds to wait for the app to become healthy

# Where the app lives. If this script is being run from inside an existing clone
# of the repo, deploy in place; otherwise use APP_DIR (default ~/apps/LRC).
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
if git -C "$SCRIPT_DIR" rev-parse --is-inside-work-tree >/dev/null 2>&1; then
  APP_DIR="$(git -C "$SCRIPT_DIR" rev-parse --show-toplevel)"
else
  APP_DIR="${APP_DIR:-$HOME/apps/LRC}"
fi

# Run systemctl / write unit files as root only when we are not already root.
if [[ "$(id -u)" -eq 0 ]]; then SUDO=""; else SUDO="sudo"; fi

log "LRC deployment"
info "repo    : $REPO_URL ($BRANCH)"
info "dir     : $APP_DIR"
info "service : ${SERVICE_NAME}.service"

# -----------------------------------------------------------------------------
# 0. Preflight — required tooling
# -----------------------------------------------------------------------------
step "Checking prerequisites"
for bin in git node npm systemctl curl; do
  command -v "$bin" >/dev/null 2>&1 || die "'$bin' is required but not installed."
done
NPM_BIN="$(command -v npm)"
NODE_BIN="$(command -v node)"
NODE_DIR="$(dirname "$NODE_BIN")"
ok "node $(node -v), npm $(npm -v)"

# -----------------------------------------------------------------------------
# 1. Clone or update the repository
# -----------------------------------------------------------------------------
if [[ -d "$APP_DIR/.git" ]]; then
  step "Updating existing checkout"
  git -C "$APP_DIR" fetch --prune origin
  git -C "$APP_DIR" checkout "$BRANCH"
  git -C "$APP_DIR" reset --hard "origin/$BRANCH"   # match remote exactly, drop local drift
  ok "pulled origin/$BRANCH"
else
  step "Cloning repository"
  mkdir -p "$(dirname "$APP_DIR")"
  git clone --branch "$BRANCH" "$REPO_URL" "$APP_DIR"
  ok "cloned into $APP_DIR"
fi
cd "$APP_DIR"
CURRENT_COMMIT="$(git rev-parse --short HEAD)"
info "at commit $CURRENT_COMMIT"

# -----------------------------------------------------------------------------
# 2. Production environment file (required — Supabase vars are baked into the build)
# -----------------------------------------------------------------------------
step "Loading production environment"
ENV_FILE="$APP_DIR/.env.production"
if [[ ! -f "$ENV_FILE" ]]; then
  die ".env.production not found.
    Create it once:  cp .env.production.example .env.production  &&  edit the values.
    (It is git-ignored and must never be committed.)"
fi
# Export every var defined in the file into this shell (for build + health check).
set -a
# shellcheck disable=SC1090
source "$ENV_FILE"
set +a
: "${VITE_SUPABASE_URL:?VITE_SUPABASE_URL is missing in .env.production}"
: "${VITE_SUPABASE_ANON_KEY:?VITE_SUPABASE_ANON_KEY is missing in .env.production}"
APP_HOST="${APP_HOST:-127.0.0.1}"
APP_PORT="${APP_PORT:-8137}"
export APP_HOST APP_PORT
ok "env loaded (serving on ${APP_HOST}:${APP_PORT})"

# -----------------------------------------------------------------------------
# 3. Install / update dependencies — only when the lockfile changed
# -----------------------------------------------------------------------------
step "Installing dependencies"
LOCK_HASH_FILE="$APP_DIR/node_modules/.deploy-lock-hash"
LOCK_HASH="$(sha256sum package-lock.json | awk '{print $1}')"
if [[ ! -d node_modules ]] || [[ ! -f "$LOCK_HASH_FILE" ]] || [[ "$(cat "$LOCK_HASH_FILE" 2>/dev/null)" != "$LOCK_HASH" ]]; then
  npm ci --no-audit --no-fund
  echo "$LOCK_HASH" > "$LOCK_HASH_FILE"
  ok "dependencies installed"
else
  ok "dependencies already up to date (skipped)"
fi

# -----------------------------------------------------------------------------
# 4. Database migrations — OPT-IN (see DEPLOYMENT.md).
#    The migrations run against the hosted Supabase Postgres, not a local DB,
#    and are not all idempotent, so they are skipped unless explicitly enabled.
# -----------------------------------------------------------------------------
if [[ "${RUN_MIGRATIONS:-false}" == "true" ]]; then
  step "Applying Supabase migrations"
  command -v psql >/dev/null 2>&1 || die "RUN_MIGRATIONS=true but 'psql' is not installed."
  : "${SUPABASE_DB_URL:?RUN_MIGRATIONS=true requires SUPABASE_DB_URL in .env.production}"
  shopt -s nullglob
  for sql in supabase/migrations/*.sql; do
    info "  -> $(basename "$sql")"
    psql "$SUPABASE_DB_URL" -v ON_ERROR_STOP=1 -f "$sql"
  done
  shopt -u nullglob
  ok "migrations applied"
else
  info "migrations skipped (RUN_MIGRATIONS != true) — apply DB schema out-of-band, see DEPLOYMENT.md"
fi

# -----------------------------------------------------------------------------
# 5. Build — only when the code or dependencies changed
# -----------------------------------------------------------------------------
step "Building production bundle"
BUILD_MARKER="$APP_DIR/dist/.deploy-build-marker"
BUILD_STAMP="${CURRENT_COMMIT}:${LOCK_HASH}:${VITE_SUPABASE_URL}"
if [[ ! -d dist ]] || [[ "$(cat "$BUILD_MARKER" 2>/dev/null)" != "$BUILD_STAMP" ]]; then
  rm -rf dist
  npm run build                       # tsc -b && vite build; reads .env.production for VITE_* vars
  echo "$BUILD_STAMP" > "$BUILD_MARKER"
  ok "build complete (dist/)"
else
  ok "build already current (skipped)"
fi

# -----------------------------------------------------------------------------
# 6. Install / refresh the systemd unit
# -----------------------------------------------------------------------------
step "Configuring systemd service"
# Installing/updating the unit is a root-only, one-time responsibility. Normal
# deployments run as the unprivileged deploy user (who only has NOPASSWD for
# `systemctl restart/status`), so skip all privileged filesystem/daemon work
# unless we are actually root.
UNIT_PATH="/etc/systemd/system/${SERVICE_NAME}.service"
if [[ "$(id -u)" -ne 0 ]]; then
  info "systemd configuration skipped — not running as root (unit already configured)."
else
  RUN_USER="${RUN_USER:-$(id -un)}"
  TMP_UNIT="$(mktemp)"
  cat > "$TMP_UNIT" <<UNIT
[Unit]
Description=LRC Volunteer Management System (Vite preview)
After=network.target

[Service]
Type=simple
User=${RUN_USER}
WorkingDirectory=${APP_DIR}
EnvironmentFile=${ENV_FILE}
Environment=NODE_ENV=production
Environment=PATH=${NODE_DIR}:/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
ExecStart=${NPM_BIN} run preview
Restart=on-failure
RestartSec=3
# Guarantee a single instance: kill the whole process group on stop/restart.
KillMode=control-group
TimeoutStopSec=20

[Install]
WantedBy=multi-user.target
UNIT

  if ! cmp -s "$TMP_UNIT" "$UNIT_PATH" 2>/dev/null; then
    cp "$TMP_UNIT" "$UNIT_PATH"
    systemctl daemon-reload
    ok "unit written to $UNIT_PATH"
  else
    ok "unit already current"
  fi
  rm -f "$TMP_UNIT"
  systemctl enable "$SERVICE_NAME" >/dev/null 2>&1 || true
fi

# -----------------------------------------------------------------------------
# 7. Gracefully (re)start — systemd stops the old instance before starting the new
# -----------------------------------------------------------------------------
step "Restarting service"
# The one and only privileged action in a normal deploy. Uses the exact command
# string the deploy user is granted NOPASSWD for: `systemctl restart lrc.service`.
# (When run as root, $SUDO is empty and this is a plain systemctl call.)
$SUDO systemctl restart "${SERVICE_NAME}.service"
ok "restarted ${SERVICE_NAME}.service"

# -----------------------------------------------------------------------------
# 8. Health check
# -----------------------------------------------------------------------------
step "Verifying health on http://${APP_HOST}:${APP_PORT}/"
HEALTH_URL="http://${APP_HOST}:${APP_PORT}/"
[[ "$APP_HOST" == "0.0.0.0" ]] && HEALTH_URL="http://127.0.0.1:${APP_PORT}/"
deadline=$(( SECONDS + HEALTH_TIMEOUT ))
healthy=false
while (( SECONDS < deadline )); do
  if ! systemctl is-active --quiet "$SERVICE_NAME"; then
    warn "service is not active yet..."
  elif code="$(curl -fsS -o /dev/null -w '%{http_code}' --max-time 5 "$HEALTH_URL" 2>/dev/null)"; then
    if [[ "$code" == "200" ]]; then healthy=true; break; fi
  fi
  sleep 2
done

if [[ "$healthy" != true ]]; then
  warn "recent logs:"
  # Read-only diagnostics — run unprivileged (normal users can query their own
  # service state and logs; no sudo is required or requested here).
  systemctl status "$SERVICE_NAME" --no-pager -l | tail -n 20 || true
  journalctl -u "$SERVICE_NAME" --no-pager -n 30 || true
  die "app did not become healthy within ${HEALTH_TIMEOUT}s at $HEALTH_URL"
fi

ok "app is healthy (HTTP 200)"
log "${C_GREEN}Deployment successful${C_RESET} — ${SERVICE_NAME} @ commit ${CURRENT_COMMIT} on ${APP_HOST}:${APP_PORT}"
