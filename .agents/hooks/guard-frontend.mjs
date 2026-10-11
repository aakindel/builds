#!/usr/bin/env node
/* eslint-disable no-useless-assignment */
/**
 * Process-isolation guard for frontend projects. Blocks commands that would
 * kill the user's Next process or steal `.next/dev/lock`.
 *
 * Node rather than bash+jq: jq is not guaranteed to be installed, and the
 * Cursor hook is registered failClosed, so a missing dependency would block
 * every command.
 *
 * Reads the hook payload on stdin, writes a permission decision on stdout.
 * Decisions are deny (never correct for an agent), ask (the user should see
 * it), or allow. "ask" is what keeps an agent from self-authorizing: it
 * cannot approve its own escalation by adding a flag.
 *
 * Cursor sends `{ command }`. Claude and Codex send `{ tool_input.command }`.
 * The JSON includes both Cursor's flat fields and Claude/Codex
 * `hookSpecificOutput` so one script can be registered on all three.
 *
 * Claude has no failClosed. Any hook exit other than 2 lets the command
 * through, so unexpected errors exit 2.
 *
 * Codex PreToolUse does not support permissionDecision "ask". It marks the
 * hook failed and continues the command. This script maps ask to deny when
 * the payload has a Codex `turn_id`.
 */
function decide(command) {
  const cmd = command.trim();

  return judgeProcessInterference(cmd);
}

function judgeProcessInterference(cmd) {
  /* A sandboxed pkill is a no-op, so this only ever fires once the command has
     escaped the sandbox — which is exactly when it reaches the user's stack. */
  if (
    /\b(pkill|killall)\b/.test(cmd) &&
    /(next|convex|concurrently|node)/.test(cmd)
  ) {
    return deny(
      "kills processes that may belong to the user's dev stack",
      "Blocked: this can kill the user's Next process. Stop only servers you started — `pnpm dev:agent:stop` for the agent server, or the E2E scripts' own teardown."
    );
  }

  /* Removing the user's dev lock is how a second server steals their build dir.
     The agent and E2E locks live in their own dist dirs and are fine to clear. */
  if (/\brm\b[^;&|]*\.next\/dev\/lock/.test(cmd)) {
    return deny(
      "removes the user's Next dev lock",
      "Blocked: `.next/dev/lock` belongs to the user's `pnpm dev`. Clear only `.next-agent/dev/lock` or `.next-e2e/dev/lock`."
    );
  }

  if (/(^|\s)(pnpm|npm|yarn)\s+dev(\s|$)/.test(cmd)) {
    return ask(
      "starts the user's dev stack",
      "Use `pnpm dev:agent` for verification — it coexists with the user's server and you can stop it with `pnpm dev:agent:stop`. Only run `pnpm dev` if the user asked for it."
    );
  }

  return null;
}

function decision({ permission, userReason, agentMessage }) {
  const prefix =
    permission === "deny"
      ? "Agent isolation: blocked — "
      : "Agent isolation: needs approval — ";
  const user_message = `${prefix}${userReason}`;

  return {
    permission,
    user_message,
    agent_message: agentMessage,
    hookSpecificOutput: {
      hookEventName: "PreToolUse",
      permissionDecision: permission,
      permissionDecisionReason: agentMessage,
    },
  };
}

function deny(userReason, agentMessage) {
  return decision({ permission: "deny", userReason, agentMessage });
}

function ask(userReason, agentMessage) {
  return decision({ permission: "ask", userReason, agentMessage });
}

function commandFromPayload(payload) {
  if (typeof payload.command === "string") return payload.command;

  const toolInput = payload.tool_input;

  if (toolInput && typeof toolInput.command === "string") {
    return toolInput.command;
  }

  return "";
}

function isCodexPayload(payload) {
  return typeof payload.turn_id === "string" && payload.turn_id.length > 0;
}

function decideFromPayload(payload) {
  const decided = decide(commandFromPayload(payload));

  if (!decided) return { permission: "allow" };

  if (decided.permission === "ask" && isCodexPayload(payload)) {
    const reason =
      typeof decided.user_message === "string"
        ? decided.user_message.replace(
            /^Agent isolation: needs approval — /,
            ""
          )
        : "this command needs approval";

    return deny(
      reason,
      "Codex PreToolUse does not support ask, so this command is blocked instead of prompting. Use `pnpm dev:agent` for verification, or ask the user to run it."
    );
  }

  return decided;
}

function decideFromInput(raw) {
  let payload = {};

  try {
    payload = JSON.parse(raw) ?? {};
  } catch {
    return deny(
      "the guard could not read the command",
      "The isolation guard received an unreadable payload and blocked this command. Report this rather than working around it."
    );
  }

  return decideFromPayload(payload);
}

function failClosed(error) {
  process.stderr.write(
    `${error instanceof Error ? error.message : String(error)}\n`
  );
  process.exit(2);
}

function runSelfTest() {
  const cases = [
    { name: "cursor pnpm dev", payload: { command: "pnpm dev" }, expect: "ask" },
    {
      name: "codex pnpm dev",
      payload: {
        turn_id: "t1",
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "pnpm dev" },
      },
      expect: "deny",
    },
    {
      name: "cursor pnpm dev:agent",
      payload: { command: "pnpm dev:agent" },
      expect: "allow",
    },
    {
      name: "codex pnpm dev:agent",
      payload: {
        turn_id: "t1",
        tool_input: { command: "pnpm dev:agent" },
      },
      expect: "allow",
    },
    {
      name: "cursor pkill",
      payload: { command: 'pkill -f "next dev"' },
      expect: "deny",
    },
  ];

  let failed = 0;

  for (const test of cases) {
    const result = decideFromPayload(test.payload);
    const got = result.permission ?? "allow";

    if (got !== test.expect) {
      process.stderr.write(
        `fail ${test.name}: expected ${test.expect}, got ${got}\n`
      );
      failed += 1;
    }
  }

  if (failed > 0) {
    process.exitCode = 1;

    return;
  }

  process.stdout.write(`ok ${cases.length} guard fixtures\n`);
}

if (process.argv.includes("--self-test")) {
  runSelfTest();
} else {
  let input = "";
  process.stdin.setEncoding("utf-8");
  process.stdin.on("data", (chunk) => (input += chunk));
  process.stdin.on("end", () => {
    try {
      process.stdout.write(JSON.stringify(decideFromInput(input)));
    } catch (error) {
      failClosed(error);
    }
  });
}
