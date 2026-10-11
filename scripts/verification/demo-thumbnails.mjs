import fs from "node:fs/promises";
import path from "node:path";
import sharp from "sharp";
import { shotPath } from "../checks/demo-screenshots-lib.mjs";

export const DEMO_THUMBNAIL_WIDTH = 1200;

/** Downsample the finished capture so the demo's responsive layout stays intact. */
export async function createDemoThumbnail(source) {
  return sharp(source)
    .resize({ width: DEMO_THUMBNAIL_WIDTH, withoutEnlargement: true })
    .webp({ lossless: true })
    .toBuffer();
}

/** Refresh a derived image without rewriting identical bytes or the original. */
export async function updateDemoThumbnail(root, key, theme) {
  const file = shotPath(key, `${theme}-mini`);
  const absolute = path.join(root, file);
  const source = await fs.readFile(path.join(root, shotPath(key, theme)));
  const image = await createDemoThumbnail(source);
  let previous;
  try {
    previous = await fs.readFile(absolute);
  } catch (error) {
    if (error.code !== "ENOENT") throw error;
  }
  if (previous?.equals(image)) return { file, status: "unchanged" };
  await fs.writeFile(absolute, image);
  return { file, status: previous ? "changed" : "added" };
}
