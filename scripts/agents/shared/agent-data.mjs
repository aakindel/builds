// Data-only synchronization. Never imports or executes files from a source tree.

import { createHash, randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

export const digest = (bytes) =>
  createHash("sha256").update(bytes).digest("hex");

export function atomicJSON(file, value) {
  fs.mkdirSync(path.dirname(file), { recursive: true });
  const temp = `${file}.${randomUUID()}.tmp`;
  fs.writeFileSync(temp, `${JSON.stringify(value, null, 2)}\n`, {
    mode: 0o600,
  });
  fs.renameSync(temp, file);
}

export function safePath(root, relative) {
  if (
    !relative ||
    path.isAbsolute(relative) ||
    relative
      .split(/[\\/]/)
      .some((part) => !part || part === "." || part === "..")
  )
    throw new Error(`Unsafe relative path: ${relative}`);
  const base = path.resolve(root);
  // Reject linked ancestors, including the destination root itself.
  let current = path.parse(base).root;
  for (const part of [
    ...base.slice(current.length).split(path.sep).filter(Boolean),
    ...relative.split(path.sep),
  ]) {
    current = path.join(current, part);
    try {
      if (fs.lstatSync(current).isSymbolicLink())
        throw new Error(`Linked destination or source: ${current}`);
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
  }
  return path.join(base, relative);
}

export function treeFiles(root, { claude = false } = {}) {
  const files = new Map();
  if (!fs.existsSync(root)) return files;
  safePath(root, ".source-validation");
  const walk = (relative = "") => {
    const directory = relative ? safePath(root, relative) : root;
    const skill = path.join(directory, "SKILL.md");
    if (
      claude &&
      (path.basename(directory) === "update-alt-chat-docs" ||
        (fs.existsSync(skill) &&
          /^name:\s*["']?update-alt-chat-docs["']?\s*$/m.test(
            fs
              .readFileSync(skill, "utf8")
              .match(/^---\r?\n([\s\S]*?)\r?\n---/)?.[1] ?? ""
          )))
    )
      return;
    for (const entry of fs
      .readdirSync(directory, { withFileTypes: true })
      .sort((a, b) => a.name.localeCompare(b.name))) {
      const rel = relative ? `${relative}/${entry.name}` : entry.name;
      const file = safePath(root, rel);
      if (entry.isDirectory()) walk(rel);
      else if (entry.isFile()) {
        const bytes = fs.readFileSync(file);
        bytes.mode = fs.statSync(file).mode & 0o777;
        files.set(rel, bytes);
      } else
        throw new Error(
          `Only regular files and directories can be synchronized: ${file}`
        );
    }
  };
  walk();
  return files;
}

// Change only destinations of authored Markdown links. Examples and payloads
// stay literal; no source helpers or Markdown plugins run in the host service.
function rebaseMarkdownLinks(source, destination) {
  const protectedText = new Uint8Array(source.length);
  const protect = (from, to) => protectedText.fill(1, from, to);
  const escaped = (index) => {
    let slashes = 0;
    while (index > 0 && source[--index] === "\\") slashes++;
    return slashes % 2 === 1;
  };
  let frontmatter = false;
  let fence = null;
  let html = false;
  for (const match of source.matchAll(/[^\n]*(?:\n|$)/g)) {
    if (!match[0]) continue;
    const line = match[0].replace(/\r?\n$/, "");
    const from = match.index;
    const to = from + match[0].length;
    if (from === 0 && /^\uFEFF?---\s*$/.test(line)) {
      frontmatter = true;
      protect(from, to);
      continue;
    }
    if (frontmatter) {
      protect(from, to);
      if (/^(?:---|\.\.\.)\s*$/.test(line)) frontmatter = false;
      continue;
    }
    const marker =
      /^\s*(?:>\s*)*(?:(?:[-+*]|\d+[.)])\s+)?(`{3,}|~{3,})(.*)$/.exec(line);
    if (fence) {
      protect(from, to);
      if (
        marker &&
        marker[1][0] === fence[0] &&
        marker[1].length >= fence.length &&
        !marker[2].trim()
      )
        fence = null;
      continue;
    }
    if (html) {
      if (!line.trim()) html = false;
      else {
        protect(from, to);
        continue;
      }
    }
    if (/^(?: {4}|\t)/.test(line)) {
      protect(from, to);
      continue;
    }
    if (marker && (marker[1][0] !== "`" || !marker[2].includes("`"))) {
      fence = marker[1];
      protect(from, to);
      continue;
    }
    if (
      /^ {0,3}(?:> ?)*<\/?(?:div|table|details|summary|section|article|p|ul|ol|li|blockquote|figure|h[1-6])(?:\s|\/?>)/i.test(
        line
      )
    ) {
      html = true;
      protect(from, to);
    }
  }
  for (const match of source.matchAll(
    /<!--[\s\S]*?(?:-->|$)|<(script|pre|style|textarea)\b[^>]*>[\s\S]*?(?:<\/\1\s*>|$)/gi
  ))
    protect(match.index, match.index + match[0].length);
  for (const match of source.matchAll(/<\/?[A-Za-z][\w:-]*\s[^>]*>/g)) {
    if (!/(?:\]\(|\]:)\s*$/.test(source.slice(0, match.index)))
      protect(match.index, match.index + match[0].length);
  }
  for (let index = 0; index < source.length; index++) {
    if (protectedText[index] || source[index] !== "`" || escaped(index))
      continue;
    let end = index + 1;
    while (source[end] === "`") end++;
    const ticks = source.slice(index, end);
    let close = end;
    while ((close = source.indexOf(ticks, close)) !== -1) {
      if (
        !protectedText[close] &&
        source[close - 1] !== "`" &&
        source[close + ticks.length] !== "`"
      )
        break;
      close += ticks.length;
    }
    if (close !== -1) {
      protect(index, close + ticks.length);
      index = close + ticks.length - 1;
    } else index = end - 1;
  }
  const whitespace = (index) => {
    while (/\s/.test(source[index] ?? "") && index < source.length) index++;
    return index;
  };
  const readDestination = (index) => {
    const angled = source[index] === "<";
    const from = angled ? index + 1 : index;
    let depth = 0;
    for (index = from; index < source.length; index++) {
      if (protectedText[index]) return null;
      const character = source[index];
      if (character === "\\") {
        index++;
        continue;
      }
      if (angled) {
        if (character === ">")
          return { from, to: index, next: index + 1, angled };
        if (character === "\n" || character === "<") return null;
      } else {
        if ((character === ")" && depth === 0) || /\s/.test(character))
          return { from, to: index, next: index, angled };
        if (character === "(") depth++;
        if (character === ")") depth--;
      }
    }
    return !angled && depth === 0
      ? { from, to: index, next: index, angled }
      : null;
  };
  const readTitle = (index) => {
    const closing = { '"': '"', "'": "'", "(": ")" }[source[index]];
    if (!closing) return null;
    for (index++; index < source.length; index++) {
      if (protectedText[index]) return null;
      if (source[index] === "\\") index++;
      else if (source[index] === closing) return index + 1;
    }
    return null;
  };
  const edits = new Map();
  const add = (span) => {
    if (!span || span.from === span.to) return;
    const raw = source.slice(span.from, span.to);
    const changed = destination(raw, span.angled);
    if (changed !== raw) edits.set(span.from, { ...span, changed });
  };
  const brackets = [];
  for (let index = 0; index < source.length; index++) {
    if (
      protectedText[index] ||
      (source[index] !== "[" && source[index] !== "]") ||
      escaped(index)
    )
      continue;
    if (source[index] === "[") brackets.push(index);
    if (source[index] !== "]" || !brackets.length) continue;
    brackets.pop();
    if (source[index + 1] !== "(") continue;
    const span = readDestination(whitespace(index + 2));
    if (!span) continue;
    let closing = whitespace(span.next);
    if (source[closing] !== ")") {
      const title = readTitle(closing);
      if (title === null) continue;
      closing = whitespace(title);
    }
    if (source[closing] === ")" && !protectedText[closing]) {
      add(span);
      index = closing;
    }
  }
  for (const match of source.matchAll(
    /^ {0,3}\[(?:\\.|[^\]\\\r\n])+\]:[ \t]*(?:\r?\n[ \t]*)?/gm
  )) {
    if (protectedText[match.index]) continue;
    const span = readDestination(match.index + match[0].length);
    if (!span) continue;
    let end = span.next;
    while (/[ \t]/.test(source[end] ?? "")) end++;
    if (source[end] && source[end] !== "\r" && source[end] !== "\n") {
      const title = readTitle(end);
      if (title === null) continue;
      end = title;
      while (/[ \t]/.test(source[end] ?? "")) end++;
    }
    if (!source[end] || source[end] === "\r" || source[end] === "\n") add(span);
  }
  for (const edit of [...edits.values()].sort((a, b) => b.from - a.from))
    source = source.slice(0, edit.from) + edit.changed + source.slice(edit.to);
  return source;
}

export function claudeFiles(root) {
  const tree = treeFiles(root, { claude: true });
  const directories = [...tree.keys()]
    .filter((rel) => path.basename(rel) === "SKILL.md")
    .map((rel) => path.dirname(rel));
  const names = new Set();
  const skills = directories.map((directory) => {
    const name = path.basename(directory === "." ? root : directory);
    if (names.has(name))
      throw new Error(`Duplicate Claude skill name: ${name}`);
    names.add(name);
    return { directory, name };
  });
  const contains = (directory, rel) =>
    directory === "." || rel === directory || rel.startsWith(`${directory}/`);
  const projected = (rel, skill) =>
    `${skill.name}/${skill.directory === "." ? rel : rel.slice(skill.directory.length + 1)}`;
  const owners = [...skills].sort(
    (a, b) => b.directory.length - a.directory.length
  );
  const targets = new Set(tree.keys());
  for (const rel of tree.keys()) {
    let directory = path.posix.dirname(rel);
    while (directory !== ".") {
      targets.add(directory);
      directory = path.posix.dirname(directory);
    }
  }
  const flat = new Map();
  for (const skill of skills) {
    for (const [rel, bytes] of tree) {
      if (!contains(skill.directory, rel)) continue;
      const output = projected(rel, skill);
      let contents = bytes;
      if (
        /\.md$/i.test(rel) &&
        !rel.split("/").some((part) => part === "assets" || part === "files")
      ) {
        const source = bytes.toString("utf8");
        if (Buffer.from(source).equals(bytes)) {
          const changed = rebaseMarkdownLinks(source, (raw, angled) => {
            if (
              !raw ||
              /^[a-z][\w+.-]*:/i.test(raw) ||
              "/#?~".includes(raw[0])
            ) {
              return raw;
            }
            const suffixAt = raw.search(/(?<!\\)[?#]/);
            const pathname = suffixAt === -1 ? raw : raw.slice(0, suffixAt);
            const suffix = suffixAt === -1 ? "" : raw.slice(suffixAt);
            const unescaped = pathname.replace(
              /\\([!"#$%&'()*+,\-./:;<=>?@[\\\]^_`{|}~ ])/g,
              "$1"
            );
            let target = path.posix.normalize(
              path.posix.join(path.posix.dirname(rel), unescaped)
            );
            let encoded = false;
            if (!targets.has(target)) {
              try {
                target = path.posix.normalize(
                  path.posix.join(
                    path.posix.dirname(rel),
                    decodeURIComponent(unescaped)
                  )
                );
                encoded = true;
              } catch {
                return raw;
              }
            }
            if (!targets.has(target)) return raw;
            // Copying a complete subtree preserves every internal relative link,
            // including its original escaping and URI spelling.
            if (contains(skill.directory, target)) return raw;
            const owner = owners.find((entry) =>
              contains(entry.directory, target)
            );
            if (!owner) return raw;
            const intended = projected(target, owner);
            if (
              path.posix.normalize(
                path.posix.join(path.posix.dirname(output), unescaped)
              ) === intended
            )
              return raw;
            let relative = path.posix.relative(
              path.posix.dirname(output),
              intended
            );
            if (!relative.startsWith(".")) relative = "./" + relative;
            if (pathname.endsWith("/")) relative += "/";
            if (encoded)
              relative = encodeURI(relative).replace(
                /[?#]/g,
                encodeURIComponent
              );
            else if (!angled)
              relative = relative.replace(
                /[\\ ()<>[\]]/g,
                (character) => "\\" + character
              );
            return relative + suffix;
          });
          if (changed !== source) {
            contents = Buffer.from(changed);
            contents.mode = bytes.mode;
          }
        }
      }
      flat.set(output, contents);
    }
  }
  return flat;
}

export function synchronize({
  destination,
  files,
  manifest,
  baseline = new Map(),
  adoptIdentical = false,
  skip = new Set(),
  groups,
}) {
  const prior = fs.existsSync(manifest)
    ? JSON.parse(fs.readFileSync(manifest, "utf8"))
    : { version: 1, owned: {}, pending: {} };
  if (prior.version !== 1 || !prior.owned || !prior.pending)
    throw new Error("Invalid synchronization ownership manifest.");
  const next = {
    version: 1,
    owned: { ...prior.owned },
    pending: { ...prior.pending },
    modes: { ...prior.modes },
    directories: { ...prior.directories },
    ...(groups || prior.groups
      ? { groups: { ...prior.groups, ...groups } }
      : {}),
  };
  const conflicts = [];
  const changes = [];
  for (const rel of new Set([
    ...Object.keys(prior.owned),
    ...Object.keys(prior.pending),
    ...files.keys(),
  ])) {
    if (skip.has(rel)) continue;
    let dest;
    try {
      dest = safePath(destination, rel);
    } catch (error) {
      if (!error.message.startsWith("Linked")) throw error;
      conflicts.push(rel);
      continue;
    }
    const stat = fs.existsSync(dest) ? fs.statSync(dest) : null;
    if (stat && !stat.isFile()) {
      conflicts.push(rel);
      continue;
    }
    const live = stat ? digest(fs.readFileSync(dest)) : null;
    const incoming = files.has(rel) ? digest(files.get(rel)) : null;
    const liveMode = stat ? stat.mode & 0o777 : null;
    const incomingMode = files.has(rel) ? (files.get(rel).mode ?? 0o644) : null;
    const recovery = prior.pending[rel];
    const owned = prior.owned[rel];
    const recovered =
      recovery &&
      live === recovery.after &&
      (recovery.afterMode === undefined || liveMode === recovery.afterMode);
    const known = recovered
      ? live
      : (owned ?? (baseline.has(rel) ? digest(baseline.get(rel)) : undefined));
    // Equal incoming bytes make retries harmless, but do not establish ownership
    // of an ambiguous pre-existing installation.
    if (live === incoming && (liveMode === incomingMode || incoming === null)) {
      if (
        owned !== undefined ||
        recovery?.after === incoming ||
        (adoptIdentical && incoming !== null)
      ) {
        if (incoming === null) {
          delete next.owned[rel];
          delete next.modes[rel];
        } else {
          next.owned[rel] = incoming;
          next.modes[rel] = incomingMode;
        }
      }
      delete next.pending[rel];
      continue;
    }
    if (live !== null && live !== known && live !== recovery?.before) {
      conflicts.push(rel);
      continue;
    }
    if (
      live !== null &&
      !recovered &&
      prior.modes?.[rel] !== undefined &&
      liveMode !== prior.modes[rel] &&
      liveMode !== recovery?.afterMode
    ) {
      conflicts.push(rel);
      continue;
    }
    if (
      live !== null &&
      owned === undefined &&
      !recovery &&
      !baseline.has(rel)
    ) {
      conflicts.push(rel);
      continue;
    }
    if (incoming === null && owned === undefined && !recovery) continue;
    next.pending[rel] = {
      before: live,
      after: incoming,
      beforeMode: liveMode,
      afterMode: incomingMode,
    };
    atomicJSON(manifest, next);
    if (incoming === null) fs.unlinkSync(dest);
    else {
      const parents = [];
      let directory = path.dirname(dest);
      while (
        directory !== path.resolve(destination) &&
        !fs.existsSync(directory)
      ) {
        parents.push(directory);
        directory = path.dirname(directory);
      }
      fs.mkdirSync(path.dirname(dest), { recursive: true });
      for (const parent of parents)
        next.directories[path.relative(destination, parent)] =
          fs.statSync(parent).mode & 0o777;
      const temp = `${dest}.${randomUUID()}.tmp`;
      fs.writeFileSync(temp, files.get(rel), { mode: incomingMode });
      fs.chmodSync(temp, incomingMode);
      fs.renameSync(temp, dest);
      next.owned[rel] = incoming;
      next.modes[rel] = incomingMode;
    }
    if (incoming === null) {
      delete next.owned[rel];
      delete next.modes[rel];
    }
    delete next.pending[rel];
    atomicJSON(manifest, next);
    changes.push(rel);
  }
  for (const relative of Object.keys(next.directories).sort(
    (a, b) => b.length - a.length
  )) {
    if ([...skip].some((rel) => rel.startsWith(relative + "/"))) continue;
    let directory;
    try {
      directory = safePath(destination, relative);
    } catch (error) {
      if (!error.message.startsWith("Linked")) throw error;
      conflicts.push(relative);
      continue;
    }
    if (!fs.existsSync(directory)) {
      delete next.directories[relative];
      continue;
    }
    if (
      fs.statSync(directory).isDirectory() &&
      fs.readdirSync(directory).length === 0 &&
      (fs.statSync(directory).mode & 0o777) === next.directories[relative]
    ) {
      fs.rmdirSync(directory);
      delete next.directories[relative];
    }
  }
  atomicJSON(manifest, next);
  return { changes, conflicts };
}
