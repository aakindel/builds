// runtime-servers-managed: 1
export const ranges: Record<"dev" | "agent" | "e2e", [number, number]>;
export function readAgentOwner(
  rootDir?: string,
  range?: [number, number]
): {
  root: string;
  port: number;
  wrapperPid: number;
  childPid: number;
  token: string;
  runId?: string;
};
export function readAgentBaseURL(rootDir?: string): string;
export function validateOrigin(
  value: string,
  role: "dev" | "agent" | "e2e"
): string;
export function readE2eEnvironment(
  rootDir?: string,
  env?: NodeJS.ProcessEnv
): {
  root: string;
  baseURL: string;
  runId: string;
  launcherPid: number;
  convexUrl?: string;
  convexSiteUrl?: string;
};
