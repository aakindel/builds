export type Theme = "light" | "dark";
export type DemoState = {
  demos: Map<string, string>;
  shots: Map<string, Set<string>>;
};
export type Problem = {
  kind:
    "stale" | "uncaptured" | "missing-shot" | "orphan-shot" | "orphan-entry";
  key: string;
  theme?: string;
};
export type Manifest = Record<string, string>;

export const MANIFEST_PATH: string;
export const THEMES: readonly Theme[];
export const DEMO_TREES: { appDir: string; route: string }[];
export const PATHSPECS: string[];

export function demoKeyOf(file: string): string | null;
export function shotOf(file: string): { key: string; theme: string } | null;
export function shotPath(key: string, theme: string): string;
export function demoDir(key: string): string;
export function demoRoute(key: string): string;
export function hashDemo(entries: Iterable<[string, string]>): string;
export function collectState(listing: Map<string, string>): DemoState;
export function findProblems(state: DemoState, manifest: Manifest): Problem[];
export function touchedKeys(
  files: string[],
  manifestBefore?: Manifest,
  manifestAfter?: Manifest
): Set<string>;
export function parseManifest(text: string, source?: string): Manifest;
export function formatManifest(manifest: Manifest): string;
export function readIndexListing(root: string): Map<string, string>;
export function readWorktreeListing(root: string): Map<string, string>;
export function readStagedManifest(root: string): Manifest;
export function readHeadManifest(root: string): Manifest;
export function readWorktreeManifest(root: string): Manifest;
export function readStagedChanges(root: string): string[];
