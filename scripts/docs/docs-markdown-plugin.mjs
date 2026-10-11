import { util } from "prettier";
import { parsers as markdownParsers } from "prettier/plugins/markdown";
import { formatDocsMarkdown } from "./docs-markdown.mjs";

export const languages = [
  { name: "Docs Markdown", parsers: ["docs-markdown"] },
];
export const parsers = {
  "docs-markdown": {
    astFormat: "docs-markdown-source",
    async parse(text) {
      return {
        text,
        formatted: await formatDocsMarkdown(text, {
          parseMarkdown: (source) => markdownParsers.markdown.parse(source, {}),
          stringWidth: util.getStringWidth,
        }),
      };
    },
    locStart: () => 0,
    locEnd: (node) => node.text.length,
  },
};
export const printers = {
  "docs-markdown-source": {
    print: (path) => path.node.formatted,
    getVisitorKeys: () => [],
  },
};
