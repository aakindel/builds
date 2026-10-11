import { type BrowserType, type FullConfig, type Page } from "@playwright/test";

type VerificationRole = "agent" | "e2e";
type VerificationOptions = {
  baseURL: string;
  role?: VerificationRole;
  rootDir?: string;
  paths?: string[];
  requireStyles?: boolean;
};

export function readAgentBaseURL(rootDir?: string): string;
export function validateVerificationURL(
  baseURL: string,
  role: VerificationRole,
  rootDir?: string
): string;
export function assertHealthyPage(
  page: Page,
  url: string,
  requireStyles?: boolean
): Promise<void>;
export function runBrowserPreflight(
  options: VerificationOptions,
  dependencies?: {
    chromium?: Pick<BrowserType, "executablePath" | "launch">;
    fetch?: typeof fetch;
  }
): Promise<{
  ok: boolean;
  stage: string;
  baseURL: string;
  role: VerificationRole;
}>;
export default function globalSetup(config: FullConfig): Promise<void>;
