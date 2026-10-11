export const DEMO_THUMBNAIL_WIDTH: number;
export function createDemoThumbnail(source: Buffer): Promise<Buffer>;
export function updateDemoThumbnail(
  root: string,
  key: string,
  theme: "light" | "dark"
): Promise<{ file: string; status: "unchanged" | "changed" | "added" }>;
