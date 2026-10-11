// agent-worktrees-managed: 1

import { spawnSync } from "node:child_process";
import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import os from "node:os";
import path from "node:path";
import {
  compatibleRuntime,
  readRuntime,
  satisfies,
} from "../runtime/agent-runtime.mjs";

export { satisfies } from "../runtime/agent-runtime.mjs";

export function run(root, args, options = {}) {
  const outcome = spawnSync(args[0], args.slice(1), {
    cwd: root,
    encoding: "utf8",
    maxBuffer: 64 * 1024 * 1024,
    timeout: 60000,
    ...options,
  });
  if (outcome.error || outcome.status !== 0) {
    const error = new Error(
      `${args[0]} ${args[1] ?? ""} failed: ${outcome.error?.message ?? outcome.stderr ?? outcome.status}`
    );
    error.exitCode = outcome.status ?? 1;
    throw error;
  }
  return outcome.stdout ?? "";
}
export const git = (root, ...args) => run(root, ["git", ...args]).trim();
const hash = (value) => createHash("sha256").update(value).digest("hex");

export function readConfig(primary) {
  const file = path.join(primary, "zlocal/dev-config.json");
  const value = fs.lstatSync(file, { throwIfNoEntry: false })
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : {};
  if (!value || Array.isArray(value) || typeof value !== "object")
    throw new Error("Invalid dev-config.json. The config was preserved.");
  const legacy = value.USE_WORKTREES;
  if (legacy !== undefined && typeof legacy !== "boolean")
    throw new Error(
      "USE_WORKTREES must be a boolean. The config was preserved."
    );
  const migrated = legacy === undefined ? undefined : legacy ? "local" : "off";
  const mode = value.WORKTREES_MODE ?? migrated ?? "off";
  if (
    !["off", "local", "remote"].includes(mode) ||
    (migrated !== undefined &&
      value.WORKTREES_MODE !== undefined &&
      migrated !== mode)
  )
    throw new Error(
      "Invalid or conflicting WORKTREES_MODE / USE_WORKTREES. The config was preserved."
    );
  if (
    value.REMOTE_CHECKS !== undefined &&
    typeof value.REMOTE_CHECKS !== "boolean"
  )
    throw new Error("REMOTE_CHECKS must be a boolean.");
  const remote = value.WORKTREES_REMOTE ?? "origin";
  const base = value.WORKTREES_REMOTE_BRANCH ?? "main";
  if (
    typeof remote !== "string" ||
    !/^[A-Za-z0-9][A-Za-z0-9._-]*$/.test(remote) ||
    typeof base !== "string" ||
    !base ||
    base.startsWith("-") ||
    base.includes("..")
  )
    throw new Error("Invalid remote or remote branch.");
  return {
    WORKTREES_MODE: mode,
    REMOTE_CHECKS: value.REMOTE_CHECKS ?? false,
    WORKTREES_REMOTE: remote,
    WORKTREES_REMOTE_BRANCH: base,
  };
}

export function migrateConfig(primary) {
  const config = readConfig(primary);
  const file = path.join(primary, "zlocal/dev-config.json");
  const stat = fs.lstatSync(file, { throwIfNoEntry: false });
  const before = stat ? fs.readFileSync(file, "utf8") : undefined;
  const value = before === undefined ? {} : JSON.parse(before);
  if (
    value.USE_WORKTREES !== undefined ||
    Object.keys(config).some((key) => value[key] === undefined)
  ) {
    delete value.USE_WORKTREES;
    const target = stat ? fs.realpathSync(file) : file;
    fs.mkdirSync(path.dirname(target), { recursive: true });
    const temp = `${target}.${randomUUID()}.tmp`;
    try {
      fs.writeFileSync(
        temp,
        `${JSON.stringify({ ...value, ...config }, null, 2)}\n`,
        {
          flag: "wx",
          mode: stat ? fs.statSync(file).mode & 0o777 : 0o600,
        }
      );
      const current = fs.lstatSync(file, { throwIfNoEntry: false });
      if (
        (current ? fs.readFileSync(file, "utf8") : undefined) !== before ||
        (current ? fs.realpathSync(file) : file) !== target
      )
        throw new Error(
          "dev-config.json changed during migration. The config was preserved."
        );
      if (stat) fs.renameSync(temp, target);
      else fs.linkSync(temp, target);
    } finally {
      if (fs.existsSync(temp)) fs.unlinkSync(temp);
    }
  }
  return config;
}

export function changedFiles(root) {
  const parts = run(root, [
    "git",
    "status",
    "--porcelain=v1",
    "--untracked-files=all",
    "-z",
  ]).split("\0");
  const files = [];
  for (let i = 0; i < parts.length; i++) {
    if (!parts[i]) continue;
    files.push(parts[i].slice(3));
    if (/^[RC]|^.[RC]/.test(parts[i])) files.push(parts[++i]);
  }
  return [...new Set(files)].filter(Boolean);
}

export function snapshot(root) {
  const patch = run(root, ["git", "diff", "--binary", "HEAD", "--"]);
  const staged = run(root, ["git", "diff", "--cached", "--binary", "--"]);
  const untracked = run(root, [
    "git",
    "ls-files",
    "--others",
    "--exclude-standard",
    "-z",
  ])
    .split("\0")
    .filter(Boolean)
    .map((file) => {
      const target = path.join(root, file);
      const stat = fs.lstatSync(target);
      if (stat.isSymbolicLink()) return { file, link: fs.readlinkSync(target) };
      if (!stat.isFile())
        throw new Error(`Unsupported untracked file: ${file}`);
      return {
        file,
        data: fs.readFileSync(target).toString("base64"),
        mode: stat.mode & 0o777,
      };
    });
  const head = git(root, "rev-parse", "HEAD");
  return {
    head,
    patch,
    staged,
    untracked,
    files: changedFiles(root),
    fingerprint: hash(JSON.stringify({ head, patch, staged, untracked })),
  };
}

export function baseline(root) {
  const captured = snapshot(root);
  return {
    head: captured.head,
    files: captured.files,
    fingerprint: captured.fingerprint,
  };
}

export function remotePreflight(primary, config) {
  git(
    primary,
    "check-ref-format",
    `refs/heads/${config.WORKTREES_REMOTE_BRANCH}`
  );
  const ref = `refs/remotes/${config.WORKTREES_REMOTE}/${config.WORKTREES_REMOTE_BRANCH}`;
  git(
    primary,
    "fetch",
    "--no-tags",
    config.WORKTREES_REMOTE,
    `+refs/heads/${config.WORKTREES_REMOTE_BRANCH}:${ref}`
  );
  const remoteCommit = git(primary, "rev-parse", "--verify", `${ref}^{commit}`);
  const captured = snapshot(primary);
  const commits = git(
    primary,
    "rev-list",
    "--reverse",
    `${remoteCommit}..${captured.head}`
  )
    .split("\n")
    .filter(Boolean);
  const approval = hash(`${remoteCommit}:${captured.fingerprint}`);
  return {
    ref,
    remoteCommit,
    commits,
    files: captured.files,
    approval,
    requiresApproval: commits.length > 0 || captured.files.length > 0,
    captured,
  };
}

function safeDestination(root, file) {
  const target = path.resolve(root, file);
  if (!target.startsWith(`${root}${path.sep}`))
    throw new Error("Snapshot path escapes the worktree.");
  let parent = path.dirname(target);
  while (parent !== root) {
    if (fs.lstatSync(parent, { throwIfNoEntry: false })?.isSymbolicLink())
      throw new Error(`Snapshot parent is a symlink: ${file}`);
    parent = path.dirname(parent);
  }
  if (fs.lstatSync(target, { throwIfNoEntry: false }))
    throw new Error(
      `Untracked snapshot conflicts with a destination file: ${file}`
    );
  return target;
}

export function carryLocal(root, primary, checked, { beforeCommit } = {}) {
  if (snapshot(primary).fingerprint !== checked.captured.fingerprint)
    throw new Error(
      "Local work changed after approval. Review a new preflight before continuing."
    );
  if (checked.commits.length)
    git(root, "merge", "--no-edit", checked.captured.head);
  if (checked.captured.patch)
    run(root, ["git", "apply", "--binary", "-"], {
      input: checked.captured.patch,
    });
  for (const entry of checked.captured.untracked) {
    const target = safeDestination(root, entry.file);
    fs.mkdirSync(path.dirname(target), { recursive: true });
    if (entry.link !== undefined) fs.symlinkSync(entry.link, target);
    else
      fs.writeFileSync(target, Buffer.from(entry.data, "base64"), {
        mode: entry.mode,
        flag: "wx",
      });
  }
  if (checked.captured.files.length) {
    const env = beforeCommit?.() ?? process.env;
    run(root, ["git", "add", "--", ...checked.captured.files], { env });
    run(
      root,
      [
        "git",
        "commit",
        "--allow-empty",
        "-m",
        "carry approved local changes into remote worktree",
      ],
      { env }
    );
  }
  if (snapshot(primary).fingerprint !== checked.captured.fingerprint)
    throw new Error(
      "Primary work changed during copying. The new worktree was retained for review."
    );
}

export function toolchain(root) {
  const file = path.join(root, "package.json");
  const pkg = fs.existsSync(file)
    ? JSON.parse(fs.readFileSync(file, "utf8"))
    : {};
  if (pkg.devEngines?.runtime || pkg.engines?.runtime)
    throw new Error(
      "Managed runtime declarations require explicit resolution before task commands; automatic runtime downloads are not permitted."
    );
  const runtime = readRuntime(root, { required: false });
  if (runtime) compatibleRuntime(root, runtime, pkg);
  const requirements = [
    runtime?.node,
    ...(!runtime?.projectEngines ? [pkg.engines?.node] : []),
  ];
  for (const pin of [".nvmrc", ".node-version"])
    if (fs.existsSync(path.join(root, pin)))
      requirements.push(fs.readFileSync(path.join(root, pin), "utf8").trim());
  const declared = requirements.filter(Boolean);
  const home = os.homedir();
  const candidates = [process.execPath];
  for (const directory of [
    path.join(home, ".nvm/versions/node"),
    path.join(home, ".local/share/mise/installs/node"),
    path.join(home, ".volta/tools/image/node"),
    path.join(home, "Library/Application Support/fnm/node-versions"),
    path.join(home, ".local/share/fnm/node-versions"),
  ]) {
    if (fs.existsSync(directory))
      for (const entry of fs.readdirSync(directory))
        for (const suffix of ["bin/node", "installation/bin/node"]) {
          const binary = path.join(directory, entry, suffix);
          if (fs.existsSync(binary)) candidates.push(binary);
        }
  }
  let selected;
  for (const binary of candidates) {
    const version = run(root, [binary, "--version"]).trim().replace(/^v/, "");
    if (declared.every((requirement) => satisfies(version, requirement))) {
      selected = { binary, version };
      break;
    }
  }
  if (!selected)
    throw new Error(
      `No installed Node version satisfies ${declared.join(" and ")}. Select or install the required version explicitly.`
    );
  const env = {
    ...process.env,
    COREPACK_ENABLE_NETWORK: "0",
    COREPACK_ENABLE_PROJECT_SPEC: "0",
    npm_config_manage_package_manager_versions: "false",
    npm_config_package_manager_strict: "false",
    npm_config_package_manager_strict_version: "false",
    npm_config_pm_on_fail: "error",
    pnpm_config_pm_on_fail: "error",
    PATH: `${path.dirname(selected.binary)}${path.delimiter}${process.env.PATH ?? ""}`,
  };
  let manager = "pnpm";
  let managerVersion;
  let probeError;
  const probeEnv = {
    ...env,
    npm_config_pm_on_fail: "ignore",
    pnpm_config_pm_on_fail: "ignore",
  };
  try {
    managerVersion = run(root, [manager, "--version"], {
      env: probeEnv,
    }).trim();
  } catch (error) {
    probeError = error;
  }
  const managerRequirement = runtime?.packageManager ?? pkg.packageManager;
  if (managerRequirement && !managerRequirement.startsWith("pnpm@"))
    throw new Error(
      "Automatic preparation currently supports pnpm projects only."
    );
  const declaredManager = pkg.devEngines?.packageManager;
  if (
    declaredManager &&
    (Array.isArray(declaredManager) ||
      declaredManager.name !== "pnpm" ||
      typeof declaredManager.version !== "string")
  )
    throw new Error(
      "Unsupported devEngines.packageManager declaration; select pnpm explicitly."
    );
  const managerRequirements = [
    managerRequirement?.slice(5).split("+")[0],
    pkg.engines?.pnpm,
    declaredManager?.version,
  ].filter(Boolean);
  if (
    !managerVersion ||
    !managerRequirements.every((wanted) => satisfies(managerVersion, wanted))
  ) {
    if (managerRequirements.length) {
      let found = false;
      const cache =
        process.env.COREPACK_HOME ??
        path.join(
          process.env.XDG_CACHE_HOME ?? path.join(home, ".cache"),
          "node/corepack"
        );
      const binaries = [];
      for (const directory of [
        path.join(home, "Library/pnpm/.tools/pnpm"),
        path.join(home, ".local/share/pnpm/.tools/pnpm"),
        ...(process.env.PNPM_HOME
          ? [path.join(process.env.PNPM_HOME, ".tools/pnpm")]
          : []),
        path.join(cache, "v1/pnpm"),
      ]) {
        if (!fs.existsSync(directory)) continue;
        for (const entry of fs.readdirSync(directory)) {
          if (!managerRequirements.every((wanted) => satisfies(entry, wanted)))
            continue;
          for (const suffix of [
            "bin/pnpm.cjs",
            "node_modules/pnpm/bin/pnpm.cjs",
          ]) {
            const binary = path.join(directory, entry, suffix);
            if (fs.existsSync(binary)) binaries.push(binary);
          }
        }
      }
      for (const binary of binaries) {
        manager = binary;
        managerVersion = run(root, [selected.binary, binary, "--version"], {
          env: probeEnv,
        }).trim();
        found = managerRequirements.every((wanted) =>
          satisfies(managerVersion, wanted)
        );
        if (found) break;
      }
      if (!found)
        throw new Error(
          `No installed pnpm version satisfies ${managerRequirements.join(" and ")}. Select or install it explicitly.`,
          { cause: probeError }
        );
    } else
      throw new Error("No runnable installed pnpm was found.", {
        cause: probeError,
      });
  }
  return {
    node: selected.binary,
    nodeVersion: selected.version,
    manager,
    managerVersion,
    nodeRequirements: declared,
    runtime: declared.length ? "declared" : "unpinned",
    env,
  };
}

export function taskEnvironment(root, runtime) {
  if (runtime.manager === "pnpm") return runtime.env;
  const directory = path.join(
    root,
    "zlocal/agent-runtime",
    hash(`${runtime.node}:${runtime.manager}`).slice(0, 16),
    "bin"
  );
  const file = path.join(directory, "pnpm");
  for (let parent = directory; parent !== root; parent = path.dirname(parent)) {
    if (fs.lstatSync(parent, { throwIfNoEntry: false })?.isSymbolicLink())
      throw new Error(
        "Runtime shim directory contains a symlink. Nothing was replaced."
      );
  }
  if (fs.lstatSync(file, { throwIfNoEntry: false })?.isSymbolicLink())
    throw new Error("Runtime shim is a symlink. Nothing was replaced.");
  const quote = (value) => `'${value.replaceAll("'", "'\"'\"'")}'`;
  const script = `#!/bin/sh\n# agent-worktrees managed runtime shim\nexec ${quote(runtime.node)} ${quote(runtime.manager)} "$@"\n`;
  if (fs.existsSync(file) && fs.readFileSync(file, "utf8") !== script)
    throw new Error(
      "Runtime shim conflicts with an existing file. Nothing was replaced."
    );
  if (!fs.existsSync(file)) {
    fs.mkdirSync(directory, { recursive: true, mode: 0o700 });
    fs.writeFileSync(file, script, { flag: "wx", mode: 0o700 });
  }
  return {
    ...runtime.env,
    PATH: `${directory}${path.delimiter}${runtime.env.PATH}`,
  };
}

export function remoteRepository(root, remote) {
  const origin = git(root, "config", "--get", `remote.${remote}.url`);
  const match = /(?:github\.com[:/])([^/]+)\/([^/]+?)(?:\.git)?$/.exec(origin);
  if (!match)
    throw new Error("PR inspection requires a configured github.com remote.");
  return `${match[1]}/${match[2]}`;
}
export function pullRequest(root, target, remote) {
  const repository = remoteRepository(root, remote);
  const data = JSON.parse(
    run(root, [
      "gh",
      "pr",
      "view",
      String(target),
      "--repo",
      repository,
      "--json",
      "number,url,state,headRefName,headRefOid,baseRefName,mergeCommit,headRepository,headRepositoryOwner,isCrossRepository",
    ])
  );
  if (
    new URL(data.url).hostname !== "github.com" ||
    !new URL(data.url).pathname.startsWith(`/${repository}/pull/`)
  )
    throw new Error("PR repository does not match the configured remote.");
  if (data.isCrossRepository)
    throw new Error(
      "Cross-repository PR cleanup is not supported. Keep the worktree for review."
    );
  return data;
}
