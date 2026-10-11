# Shared bounded shutdown for maintained agent/E2E wrappers.
verification_register() {
  [[ -n "${AGENT_BROWSER_TOKEN:-}" ]] || return 0
  AGENT_BROWSER_EVENT_PROCESS="$$" node "${ROOT_DIR}/scripts/verification/verification-lifecycle.mjs" resource "$1" "$2"
}
verification_stage() {
  [[ -n "${AGENT_BROWSER_STAGE_FILE:-}" ]] || return 0
  AGENT_BROWSER_EVENT_PROCESS="$$" node "${ROOT_DIR}/scripts/verification/browser-session.mjs" stage "$@"
}
verification_stop() {
  [[ -n "${1:-}" ]] || return 0
  if [[ -n "${AGENT_BROWSER_TOKEN:-}" ]]; then
    node "${ROOT_DIR}/scripts/verification/verification-lifecycle.mjs" stop "$1"
  else
    # This shell still owns the direct child. No retained numeric PID is used here.
    kill "$1" 2>/dev/null || true
    local deadline=$((SECONDS + 20))
    while kill -0 "$1" 2>/dev/null && ((SECONDS < deadline)); do
      if ((SECONDS >= deadline - 5)); then kill -KILL "$1" 2>/dev/null || true; fi
      sleep 0.1
    done
    ! kill -0 "$1" 2>/dev/null
  fi
}
