#!/usr/bin/env bash
# Start Next.js. Used by `pnpm dev`.
#
# Running this while a dev server is already up reports that server and exits 0
# rather than starting or killing anything. Pass DEV_KILL_EXISTING=1 to replace
# it instead. Agents that just need a server to look at should use
# `pnpm dev:agent`, which runs a second one without disturbing this stack.
#
# The script:
# - Reports this repo's existing dev stack and exits, or clears a stale .next/dev/lock
# - Deletes the build dirs when oversized (see clean-dev-cache.sh)
# - Scans ports 3000-3010 (override with PORT_START / PORT_END) for the first inactive one
# - Starts next dev -p <port>
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

PORT_START="${PORT_START:-3000}"
PORT_END="${PORT_END:-3010}"
RUNTIME_HELPER="${ROOT_DIR}/scripts/dev/runtime-servers.mjs"

is_port_free() {
  node "${ROOT_DIR}/scripts/dev/runtime-servers.mjs" free-port "${ROOT_DIR}" "$1" "$1" >/dev/null
}

find_free_port() {
  node "${ROOT_DIR}/scripts/dev/runtime-servers.mjs" free-port "${ROOT_DIR}" "${PORT_START}" "${PORT_END}"
}

stop_existing_dev() {
  # Next.js allows only one dev server per project directory (.next/dev/lock).
  # Match this repo's next command line so we do not kill other projects.
  pkill -f "${ROOT_DIR}/node_modules/.bin/next dev" 2>/dev/null || true
  sleep 1
  # Stale lock remains if a prior dev process exited uncleanly.
  rm -f "${ROOT_DIR}/.next/dev/lock"
}

if [[ "${DEV_KILL_EXISTING:-0}" == "1" ]]; then
  stop_existing_dev
else
  EXISTING_PORT="$(node "${RUNTIME_HELPER}" dev-port "${ROOT_DIR}" "${PORT_START}" "${PORT_END}")"
  if [[ -n "${EXISTING_PORT}" ]]; then
    echo "Dev server already running on http://localhost:${EXISTING_PORT}"
    echo "Left it running. Use DEV_KILL_EXISTING=1 pnpm dev to replace it, or pnpm dev:agent for a second server."
    exit 0
  fi
  if [[ -f "${ROOT_DIR}/.next/dev/lock" ]]; then
    node "${RUNTIME_HELPER}" no-next-process "${ROOT_DIR}"
    rm -f "${ROOT_DIR}/.next/dev/lock"
  fi
fi

# Runs once we know no dev stack owns the build dirs. A failure here is not
# worth blocking dev on.
bash "${ROOT_DIR}/scripts/dev/clean-dev-cache.sh" || echo "Cache cleanup skipped" >&2

if [[ -n "${PORT:-}" ]]; then
  if ! is_port_free "$PORT"; then
    echo "Port ${PORT} is already in use" >&2
    exit 1
  fi
else
  PORT="$(find_free_port)" || {
    echo "No free port in range ${PORT_START}-${PORT_END}" >&2
    exit 1
  }
fi

export PORT

echo "Starting dev on http://localhost:${PORT}"

exec "${ROOT_DIR}/node_modules/.bin/next" dev -p "${PORT}"
