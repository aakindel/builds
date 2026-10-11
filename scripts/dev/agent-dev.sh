#!/usr/bin/env bash
# Throwaway Next.js dev server for agent verification. Used by `pnpm dev:agent`.
#
# Coexists with the user's `pnpm dev` instead of taking it over:
# - builds into .next-agent (NEXT_AGENT=1, see next.config.ts), so it never
#   contends for the .next/dev/lock that `pnpm dev` holds
# - scans ports 3100-3110, outside the 3000-3010 range `pnpm dev` claims
# - kills nothing, and uses only its own build dir and ownership controls
#
# Stop it with `pnpm dev:agent:stop`, which works from inside the sandbox.
# Stop requests carry this wrapper's random ownership token. Stop requests never authorize signalling an unrelated listener by port.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "$ROOT_DIR"
source "${ROOT_DIR}/scripts/verification/verification-lifecycle.sh"

PORT_START="${AGENT_PORT_START:-3100}"
PORT_END="${AGENT_PORT_END:-3110}"
DIST_DIR="${ROOT_DIR}/.next-agent"
STOP_FILE="${ROOT_DIR}/zlocal/.agent-stop"
OWNER_FILE="${ROOT_DIR}/zlocal/.agent-owner.json"
START_LOCK="${ROOT_DIR}/zlocal/.agent-start.lock"
mkdir -p "${ROOT_DIR}/zlocal"
if ! mkdir "${START_LOCK}" 2>/dev/null; then
  echo "Another agent wrapper holds the startup lock. Inspect ownership before retrying." >&2
  exit 1
fi
trap 'rmdir "${START_LOCK}" 2>/dev/null || true' EXIT

is_port_free() {
  node "${ROOT_DIR}/scripts/dev/runtime-servers.mjs" free-port "${ROOT_DIR}" "$1" "$1" >/dev/null
}

find_free_port() {
  node "${ROOT_DIR}/scripts/dev/runtime-servers.mjs" free-port "${ROOT_DIR}" "${PORT_START}" "${PORT_END}"
}

# A recorded server or build lock needs inspection before another start. A port
# number alone cannot prove that a listener belongs to this checkout.
if [[ -f "${OWNER_FILE}" || -f "${DIST_DIR}/dev/lock" ]]; then
  echo "Recorded agent server or build lock exists. Stop the owned server or inspect stale records before starting another." >&2
  exit 1
fi

if [[ -n "${PORT:-}" ]]; then
  if [[ ! "${PORT}" =~ ^[0-9]+$ ]] || ((PORT < PORT_START || PORT > PORT_END)); then
    echo "Requested port is outside the agent range ${PORT_START}-${PORT_END}." >&2
    exit 1
  fi
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

rm -f "${STOP_FILE}"

NEXT_PID=""
STOP_WATCHER_PID=""

CLEANUP_STARTED=0
cleanup() {
  ((CLEANUP_STARTED == 0)) || return
  CLEANUP_STARTED=1
  local clean=1
  if [[ -n "${STOP_WATCHER_PID}" ]] && kill -0 "${STOP_WATCHER_PID}" 2>/dev/null; then
    kill "${STOP_WATCHER_PID}" 2>/dev/null || true
  fi
  STOP_WATCHER_PID=""

  if [[ -n "${NEXT_PID}" ]] && kill -0 "${NEXT_PID}" 2>/dev/null; then
    echo "[agent] Stopping Next.js (pid ${NEXT_PID})"
    verification_stop "${NEXT_PID}" || clean=0
  fi
  NEXT_PID=""

  if ((clean == 1)); then
    rm -f "${STOP_FILE}" "${OWNER_FILE}"
    rmdir "${START_LOCK}" 2>/dev/null || true
  fi
}

trap cleanup EXIT
trap 'exit 130' INT
trap 'exit 143' TERM

# The stop request arrives as a file rather than a signal, because a sandboxed
# shell may write into the workspace but may not signal a process another shell
# started. Next is this shell's own child, so killing it from here is allowed.
watch_for_stop_request() {
  while true; do
    if [[ -f "${STOP_FILE}" ]] && [[ "$(cat "${STOP_FILE}")" == "${OWNER_TOKEN}" ]]; then
      echo "[agent] Owned stop requested"
      kill "${NEXT_PID}" 2>/dev/null || true
      return
    fi
    sleep 0.5
  done
}

export NEXT_AGENT=1
export VERIFICATION_RUN_ID="$(node -e 'process.stdout.write(require("node:crypto").randomUUID())')"

# Required, not defensive: a second server watching this tree exhausts the
# descriptor budget, and Watchpack's EMFILE storm starves route discovery, so
# every request 404s against Next's built-in page. Polling avoids the watches.
export WATCHPACK_POLLING=true
export CHOKIDAR_USEPOLLING=true

# Raise the descriptor limit only ever upward. Setting it unconditionally lowers
# it wherever the shell is already generous.
OPEN_FILE_LIMIT="$(ulimit -n)"
if [[ "${OPEN_FILE_LIMIT}" != "unlimited" && "${OPEN_FILE_LIMIT}" -lt 10240 ]]; then
  ulimit -n 10240 2>/dev/null || true
fi

echo "[agent] Starting Next.js on http://localhost:${PORT}"

# Bind loopback explicitly so Next does not call os.networkInterfaces, which
# crashes under the agent sandbox. Background child + trap, not `exec`, so
# cleanup still runs when the shell is terminated.
"${ROOT_DIR}/node_modules/.bin/next" dev -H 127.0.0.1 -p "${PORT}" &
NEXT_PID=$!
verification_register "${NEXT_PID}" next
OWNER_TOKEN="$(node -e "process.stdout.write(require('node:crypto').randomBytes(32).toString('hex'))")"
node - "${OWNER_FILE}" "${ROOT_DIR}" "${PORT}" "$$" "${NEXT_PID}" "${OWNER_TOKEN}" "${VERIFICATION_RUN_ID}" <<'NODE'
const fs = require("node:fs");
const [file, root, port, wrapperPid, childPid, token, runId] = process.argv.slice(2);
const temporary = `${file}.${wrapperPid}.tmp`;
fs.writeFileSync(temporary, JSON.stringify({root, port: Number(port), wrapperPid: Number(wrapperPid), childPid: Number(childPid), token, runId}), {mode: 0o600});
fs.renameSync(temporary, file);
NODE

watch_for_stop_request &
STOP_WATCHER_PID=$!

wait "${NEXT_PID}"
