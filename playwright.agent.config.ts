import { defineConfig, devices } from "@playwright/test";
import {
  readAgentBaseURL,
  validateVerificationURL,
} from "./scripts/verification/browser-preflight.mjs";

const agentBaseURL = validateVerificationURL(
  process.env.AGENT_BASE_URL ?? readAgentBaseURL(),
  "agent"
);

export default defineConfig({
  testDir: "./e2e",
  testMatch: "demo-grid-*.spec.ts",
  timeout: 60_000,
  workers: 1,
  reporter: "list",
  outputDir: "zlocal/artifacts/agent-tests/test-results",
  globalSetup: "./scripts/verification/browser-preflight.mjs",
  metadata: {
    browserVerification: {
      role: "agent",
      paths: ["/"],
      requireStyles: true,
    },
  },
  use: {
    baseURL: agentBaseURL,
    trace: "retain-on-failure",
    actionTimeout: 15_000,
  },
  projects: [{ name: "chromium", use: { ...devices["Desktop Chrome"] } }],
});
