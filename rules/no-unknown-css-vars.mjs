import { getKnownCssVars } from "./css-vars-index.mjs";
import {
  DEFAULT_IGNORE_PREFIXES,
  extractAssignments,
  findUses,
  isIgnored,
} from "./css-vars.mjs";

function checkText(context, known, ignorePrefixes, node, text, valueStart) {
  const sourceCode = context.sourceCode;
  for (const use of findUses(text)) {
    if (isIgnored(use.name, ignorePrefixes) || known.has(use.name)) {
      continue;
    }
    const start = valueStart + use.index;
    context.report({
      node,
      loc: {
        start: sourceCode.getLocFromIndex(start),
        end: sourceCode.getLocFromIndex(start + use.name.length),
      },
      // prefer an inline message over messageId/data
      message: `Unknown CSS variable '${use.name}'.`,
    });
  }
}

const noUnknownCssVars = {
  meta: {
    type: "problem",
    docs: {
      description:
        "Disallow CSS custom properties in class strings that are never assigned in this repo",
    },
    schema: [
      {
        type: "object",
        properties: {
          ignorePrefixes: {
            type: "array",
            items: { type: "string" },
          },
        },
        additionalProperties: false,
      },
    ],
  },
  create(context) {
    const options = context.options[0] ?? {};
    const ignorePrefixes = options.ignorePrefixes ?? DEFAULT_IGNORE_PREFIXES;
    const cwd = context.cwd ?? process.cwd();
    const known = new Set(getKnownCssVars(cwd));
    for (const name of extractAssignments(context.sourceCode.getText())) {
      known.add(name);
    }

    return {
      Literal(node) {
        if (typeof node.value !== "string" || typeof node.raw !== "string") {
          return;
        }
        const quote = node.raw[0];
        if (quote !== '"' && quote !== "'") {
          return;
        }
        checkText(
          context,
          known,
          ignorePrefixes,
          node,
          node.raw.slice(1, -1),
          node.range[0] + 1
        );
      },
      TemplateElement(node) {
        checkText(
          context,
          known,
          ignorePrefixes,
          node,
          node.value.raw,
          node.range[0]
        );
      },
    };
  },
};

export default noUnknownCssVars;
