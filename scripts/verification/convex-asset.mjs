// Prepare only the release declared by the project's isolated-backend helper.

import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";
import { fileDigest } from "./browser-compatibility.mjs";
import { atomicJSON, safePath } from "./browser-state.mjs";

export function backendPlatform(
  platform = process.platform,
  arch = process.arch
) {
  const asset = {
    darwin: { x64: "x86_64-apple-darwin", arm64: "aarch64-apple-darwin" },
    linux: {
      x64: "x86_64-unknown-linux-gnu",
      arm64: "aarch64-unknown-linux-gnu",
    },
  }[platform]?.[arch];
  if (!asset) throw new Error("Unsupported isolated Convex backend platform.");
  return asset;
}
export function declaredBackend(root) {
  const helper = path.join(root, "scripts/verification/e2e-convex-backend.sh");
  const source = fs.readFileSync(helper, "utf8");
  const release = source.match(
    /E2E_BACKEND_RELEASE_TAG="\$\{E2E_BACKEND_RELEASE_TAG:-([^}]+)\}"/
  )?.[1];
  if (!release || !/^[a-zA-Z0-9._-]+$/.test(release))
    throw new Error(
      "The backend helper needs an explicit immutable release tag."
    );
  const platform = backendPlatform();
  const binary = safePath(
    root,
    "zlocal/.convex-local-backend/convex-local-backend"
  );
  const tag = safePath(root, "zlocal/.convex-local-backend/release-tag");
  const receiptFile = safePath(root, "zlocal/.convex-local-backend/asset.json");
  let valid =
    fs.existsSync(binary) &&
    fs.statSync(binary).isFile() &&
    Boolean(fs.statSync(binary).mode & 0o111) &&
    fs.existsSync(tag) &&
    fs.readFileSync(tag, "utf8").trim() === release;
  if (valid && fs.existsSync(receiptFile)) {
    const receipt = JSON.parse(fs.readFileSync(receiptFile));
    valid =
      receipt.release === release &&
      receipt.platform === platform &&
      receipt.binaryDigest === fileDigest(binary);
  }
  return { release, platform, binary, valid, receiptFile };
}
export function prepareBackend(root) {
  const declared = declaredBackend(root);
  if (declared.valid) return declared;
  const folder = safePath(
    root,
    "zlocal/.convex-local-backend/placeholder",
    true
  );
  const temporary = path.join(path.dirname(folder), "download-" + randomUUID());
  fs.mkdirSync(temporary, { mode: 0o700 });
  const archive = path.join(temporary, "backend.zip"),
    asset = `convex-local-backend-${declared.platform}.zip`;
  const url = `https://github.com/get-convex/convex-backend/releases/download/${declared.release}/${asset}`;
  try {
    const download = spawnSync(
      "curl",
      [
        "-fsSL",
        "--connect-timeout",
        "10",
        "--max-time",
        "120",
        "--retry",
        "1",
        "--retry-max-time",
        "250",
        "-o",
        archive,
        url,
      ],
      { encoding: "utf8", timeout: 260_000 }
    );
    if (download.status !== 0)
      throw new Error(
        "Pinned backend download failed: " +
          (download.error?.message ?? download.stderr)
      );
    let publishedDigest;
    const metadata = spawnSync(
      "curl",
      [
        "-fsSL",
        "--connect-timeout",
        "2",
        "--max-time",
        "10",
        `https://api.github.com/repos/get-convex/convex-backend/releases/tags/${declared.release}`,
      ],
      { encoding: "utf8", timeout: 12_000, maxBuffer: 2 * 1024 * 1024 }
    );
    if (metadata.status === 0) {
      try {
        publishedDigest = JSON.parse(metadata.stdout).assets?.find(
          (item) => item.name === asset
        )?.digest;
      } catch {
        /* Retain the observed digest distinctly below. */
      }
    }
    const archiveDigest = fileDigest(archive);
    if (publishedDigest && publishedDigest !== "sha256:" + archiveDigest)
      throw new Error(
        "Published backend asset digest mismatch; cached binary preserved."
      );
    const listing = spawnSync("unzip", ["-Z", "-1", archive], {
      encoding: "utf8",
      timeout: 15_000,
    });
    if (
      listing.status !== 0 ||
      !listing.stdout
        .split("\n")
        .filter(Boolean)
        .every(
          (name) => !path.isAbsolute(name) && !name.split("/").includes("..")
        )
    )
      throw new Error("Unsafe backend archive.");
    const extracted = spawnSync("unzip", ["-q", archive, "-d", temporary], {
      encoding: "utf8",
      timeout: 15_000,
    });
    const binary = path.join(temporary, "convex-local-backend");
    if (
      extracted.status !== 0 ||
      !fs.existsSync(binary) ||
      fs.lstatSync(binary).isSymbolicLink()
    )
      throw new Error("Backend archive lacks its expected regular executable.");
    fs.chmodSync(binary, 0o755);
    const receipt = {
      version: 1,
      release: declared.release,
      platform: declared.platform,
      binaryDigest: fileDigest(binary),
      archiveDigest,
      publishedDigest: publishedDigest ?? null,
      integrity: publishedDigest
        ? "published-release-digest"
        : "observed-digest-only",
    };
    fs.renameSync(binary, declared.binary);
    atomicJSON(declared.receiptFile, receipt);
    const tag = path.join(path.dirname(declared.binary), "release-tag");
    fs.writeFileSync(tag + ".tmp", declared.release + "\n", { mode: 0o600 });
    fs.renameSync(tag + ".tmp", tag);
    return { ...declared, valid: true, receipt };
  } finally {
    fs.rmSync(temporary, { recursive: true, force: true });
  }
}
if (
  process.argv[1] &&
  path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)
) {
  const root = fs.realpathSync(path.resolve(import.meta.dirname, "../.."));
  prepareBackend(root);
}
