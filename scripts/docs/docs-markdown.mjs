// Preserve source spelling. The parser is used for boundaries and fidelity,
// never to serialize Markdown back into a preferred style.
function agentComment(value) {
  const match = /^(<!-- Agent(?: \([^\r\n]*\))?\r?\n)([\s\S]*)(\r?\n-->)$/.exec(
    value
  );
  return match && { opening: match[1], body: match[2], closing: match[3] };
}

function splitRow(line) {
  if (/^\s/.test(line)) return null; // Nested/indented tables stay untouched.
  const pipes = [];
  for (let i = 0; i < line.length; i++) {
    if (line[i] !== "|") continue;
    let slashes = 0;
    for (let j = i - 1; j >= 0 && line[j] === "\\"; j--) slashes++;
    if (slashes % 2 === 0) pipes.push(i);
  }
  if (pipes.length === 0) return null;
  const leading = pipes[0] === 0;
  const trailing = /^[ \t]*$/.test(line.slice(pipes.at(-1) + 1));
  const boundaries = [-1, ...pipes, line.length];
  const cells = boundaries
    .slice(0, -1)
    .map((start, i) =>
      line.slice(start + 1, boundaries[i + 1]).replace(/^[ \t]+|[ \t]+$/g, "")
    );
  if (leading) cells.shift();
  if (trailing) cells.pop();
  return { cells, leading, trailing };
}

function formatTable(source, node, stringWidth) {
  const eol = source.includes("\r\n") ? "\r\n" : "\n";
  const rows = source.split(/\r?\n/).map(splitRow);
  const columns = node.align.length;
  if (
    rows.length !== node.children.length + 1 ||
    rows.some((row) => !row || row.cells.length !== columns) ||
    !rows[1].cells.every((cell) => /^:?-+:?$/.test(cell))
  )
    return source;

  const widths = Array.from({ length: columns }, (_, column) =>
    Math.max(
      3,
      ...rows.map((row, index) =>
        index === 1
          ? 3 +
            (row.cells[column].startsWith(":") ? 1 : 0) +
            (row.cells[column].endsWith(":") ? 1 : 0)
          : stringWidth(row.cells[column])
      )
    )
  );
  return rows
    .map((row, index) => {
      const cells = row.cells.map((cell, column) => {
        if (index === 1) {
          const left = cell.startsWith(":") ? ":" : "";
          const right = cell.endsWith(":") ? ":" : "";
          return (
            left +
            "-".repeat(widths[column] - left.length - right.length) +
            right
          );
        }
        // Padding is outside the original cell content, including inline code.
        return cell + " ".repeat(widths[column] - stringWidth(cell));
      });
      return (
        (row.leading ? "| " : "") +
        cells.join(" | ") +
        (row.trailing ? " |" : "")
      );
    })
    .join(eol);
}

async function signature(node, parseMarkdown) {
  const result = {};
  for (const [key, value] of Object.entries(node)) {
    if (key === "position") continue;
    if (key === "children") {
      result.children = await Promise.all(
        value.map((child) => signature(child, parseMarkdown))
      );
    } else if (key === "value" && node.type === "html" && agentComment(value)) {
      const comment = agentComment(value);
      result.value = {
        opening: comment.opening,
        body: await signature(await parseMarkdown(comment.body), parseMarkdown),
        closing: comment.closing,
      };
    } else result[key] = value;
  }
  return result;
}

async function formatRegion(text, parseMarkdown, stringWidth, finalNewline) {
  const ast = await parseMarkdown(text);
  const edits = [];
  const nodes = ast.children;
  const eol = text.includes("\r\n") ? "\r\n" : "\n";
  for (let i = 0; i < nodes.length; i++) {
    const node = nodes[i];
    const start = node.position.start.offset;
    const end = node.position.end.offset;
    const source = text.slice(start, end);
    if (node.type === "table") {
      edits.push({ start, end, value: formatTable(source, node, stringWidth) });
    } else if (node.type === "html" && agentComment(source)) {
      const comment = agentComment(source);
      edits.push({
        start,
        end,
        value:
          comment.opening +
          (await formatRegion(
            comment.body,
            parseMarkdown,
            stringWidth,
            false
          )) +
          comment.closing,
      });
    }
    const next = nodes[i + 1];
    // Lists, quotes and raw HTML can use blank lines structurally. Only
    // normalize gaps between ordinary top-level blocks, then reparse below.
    const sensitive = new Set(["list", "blockquote", "html"]);
    if (next && !sensitive.has(node.type) && !sensitive.has(next.type)) {
      const gapEnd = next.position.start.offset;
      if (/^(?:[ \t]*\r?\n){3,}$/.test(text.slice(end, gapEnd))) {
        edits.push({ start: end, end: gapEnd, value: eol + eol });
      }
    }
  }
  if (finalNewline) {
    const end = nodes.at(-1)?.position.end.offset ?? 0;
    // Do not strip whitespace contained in an unclosed fence or raw HTML.
    const tail = text.slice(end);
    if (/^(?:[ \t]*\r?\n)*[ \t]*$/.test(tail)) {
      edits.push({ start: end, end: text.length, value: eol });
    } else if (!text.endsWith("\n")) {
      edits.push({ start: text.length, end: text.length, value: eol });
    }
  }
  let output = text;
  for (const edit of edits.sort((a, b) => b.start - a.start)) {
    output = output.slice(0, edit.start) + edit.value + output.slice(edit.end);
  }
  const before = await signature(ast, parseMarkdown);
  const after = await signature(await parseMarkdown(output), parseMarkdown);
  if (JSON.stringify(before) !== JSON.stringify(after)) {
    // An unsupported construct stays intact; ordinary Prettier is never a fallback.
    return text.endsWith("\n") || !finalNewline ? text : text + eol;
  }
  return output;
}

export async function formatDocsMarkdown(text, { parseMarkdown, stringWidth }) {
  return formatRegion(text, parseMarkdown, stringWidth, true);
}

export async function assertFormattingFidelity(expected, actual, options) {
  // Canonicalize only the documented edits. Never ignore arbitrary whitespace,
  // which could conceal changed prose, indentation, code or hard breaks.
  if (
    (await formatDocsMarkdown(expected, options)) !==
    (await formatDocsMarkdown(actual, options))
  ) {
    throw new Error("Transcript differs beyond permitted docs formatting.");
  }
}
