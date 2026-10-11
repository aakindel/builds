#!/usr/bin/env bash
# Delete oversized Next.js build dirs. Run by scripts/dev/dev.sh at startup and by `pnpm clean:cache`.
#
# The Turbopack persistent cache (.next/dev/cache/turbopack) is an LSM store of
# .sst/.meta/.del files that the dev server holds open and mmaps. Deleting those
# under a live server corrupts the store, and on macOS unlinking an open file
# does not free its blocks until the process exits — so nothing is reclaimed
# either. Both dirs are therefore only cleared when no server owns them.
set -euo pipefail

ROOT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/../.." && pwd)"
cd "$ROOT_DIR"

# Thresholds in GiB. Compared against `du -sk` output, so convert to KiB.
# Defaults: .next clears above 3 GiB; the secondary build dirs above 1 GiB.
NEXT_CACHE_MAX_GB="${NEXT_CACHE_MAX_GB:-3}"
NEXT_E2E_CACHE_MAX_GB="${NEXT_E2E_CACHE_MAX_GB:-1}"
NEXT_AGENT_CACHE_MAX_GB="${NEXT_AGENT_CACHE_MAX_GB:-1}"

dir_size_kb() {
  local dir="$1"
  [[ -d "$dir" ]] || return 1
  du -sk "$dir" 2>/dev/null | awk '{print $1}'
}

format_size() {
  awk -v kb="$1" 'BEGIN {
    if (kb >= 1048576) printf "%.1fG", kb / 1048576
    else printf "%dM", kb / 1024
  }'
}

# Exit 0 means matched, 1 means no match, anything else means pgrep could not
# read the process table (sandboxes block it). Only a real match counts, so a
# blocked pgrep never reads as "running" — the lock file below covers that case.
pgrep_matches() {
  local status=0
  pgrep -f "$1" >/dev/null 2>&1 || status=$?
  ((status == 0))
}

# Next holds a lock per build dir for the life of the server, so it answers
# "is anyone using this?" even where pgrep is unavailable.
is_dev_server_running() {
  [[ -f "${ROOT_DIR}/.next/dev/lock" ]] ||
    pgrep_matches "${ROOT_DIR}/node_modules/.bin/next dev"
}

is_e2e_server_running() {
  [[ -f "${ROOT_DIR}/.next-e2e/dev/lock" ]] ||
    pgrep_matches "${ROOT_DIR}/scripts/verification/e2e-run.sh"
}

is_agent_server_running() {
  [[ -f "${ROOT_DIR}/.next-agent/dev/lock" ]] ||
    pgrep_matches "${ROOT_DIR}/scripts/dev/agent-dev.sh"
}

# clean_dir <path> <max GiB> <name of guard fn that must report "not running">
clean_dir() {
  local dir="$1" max_gb="$2" guard_fn="$3"
  local label="${dir#"${ROOT_DIR}/"}"

  local size_kb
  size_kb="$(dir_size_kb "$dir")" || return 0

  local max_kb=$((max_gb * 1048576))
  if ((size_kb <= max_kb)); then
    echo "${label} is $(format_size "$size_kb") — under the ${max_gb}G threshold"
    return 0
  fi

  if "$guard_fn"; then
    echo "${label} is $(format_size "$size_kb") — over the ${max_gb}G threshold, but a server is using it; stop it and re-run" >&2
    return 0
  fi

  # Inspect process cwd too, so relative wrapper commands and Next processes
  # outside the port map still protect their cache. Unknown ownership blocks
  # cleanup rather than treating a sandbox inspection failure as no server.
  if ! node "${ROOT_DIR}/scripts/dev/runtime-servers.mjs" no-next-process "${ROOT_DIR}"; then
    echo "${label}: cache retained because process ownership is live or uncertain" >&2
    return 0
  fi

  echo "${label} is $(format_size "$size_kb") — over the ${max_gb}G threshold, clearing"
  rm -rf "$dir"
}

clean_dir "${ROOT_DIR}/.next" "$NEXT_CACHE_MAX_GB" is_dev_server_running
clean_dir "${ROOT_DIR}/.next-e2e" "$NEXT_E2E_CACHE_MAX_GB" is_e2e_server_running
clean_dir "${ROOT_DIR}/.next-agent" "$NEXT_AGENT_CACHE_MAX_GB" is_agent_server_running
