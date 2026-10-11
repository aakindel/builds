import { type Browser, type BrowserType } from "@playwright/test";

export const browserTimeouts: Readonly<{
  sandbox: number;
  reviewed: number;
  cleanup: number;
}>;
export function browserStage(
  stage: string,
  error?: unknown,
  component?: string
): void;
export function recordBrowserProcess(record: Record<string, unknown>): void;
export function launchBlocked(): boolean;
export function describeFailure(
  error: unknown
): { message: string; code?: string; cause?: unknown } | undefined;
export function registerResource(
  pid: number,
  role: string
): Record<string, unknown> | undefined;
export function recordedResource(pid: number): Record<string, unknown> | null;
export function launchBrowser(
  chromium: Pick<BrowserType, "launch">
): Promise<Browser>;
export function closeBrowser(browser: Pick<Browser, "close">): Promise<void>;
