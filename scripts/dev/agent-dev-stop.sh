#!/usr/bin/env bash
# Stop only the wrapper that owns this checkout's agent server.
# HTTP health is not required, and no fallback signals listeners by port.
set -euo pipefail
ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd -P)"
cd "$ROOT_DIR"
STOP_FILE="${ROOT_DIR}/zlocal/.agent-stop"
OWNER_FILE="${ROOT_DIR}/zlocal/.agent-owner.json"
PORT_START="${AGENT_PORT_START:-3100}"
PORT_END="${AGENT_PORT_END:-3110}"
if [[ ! -f "${OWNER_FILE}" ]]; then
  if [[ -d "${ROOT_DIR}/zlocal/.agent-start.lock" || -f "${ROOT_DIR}/.next-agent/dev/lock" ]]; then
    echo "Agent startup or build lock remains without an owner. Inspect it; nothing was stopped." >&2
    exit 1
  fi
  echo "No agent dev server recorded."
  exit 0
fi
TOKEN="$(node "${ROOT_DIR}/scripts/dev/runtime-servers.mjs" agent-stop-token "${ROOT_DIR}" "${PORT_START}" "${PORT_END}")"
printf '%s\n' "${TOKEN}" > "${STOP_FILE}"
for _ in $(seq 1 30); do
  if [[ ! -f "${OWNER_FILE}" && ! -d "${ROOT_DIR}/zlocal/.agent-start.lock" ]]; then
    echo "Owned agent server stopped."
    exit 0
  fi
  sleep 0.5
done
echo "Owned wrapper did not respond. Records retained for inspection; no listener was signalled." >&2
exit 1
