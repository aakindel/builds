import assert from "node:assert/strict";
import { mkdirSync, mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, it } from "node:test";
import { getKnownCssVars, resetCssVarIndexCache } from "./css-vars-index.mjs";
import {
  DEFAULT_IGNORE_PREFIXES,
  extractAssignments,
  findUses,
  isIgnored,
} from "./css-vars.mjs";

describe("extractAssignments", () => {
  it("collects CSS declarations, arbitrary properties, and style keys", () => {
    const text = `
      @theme inline { --radius-core: var(--radius-md); }
      :root { --boundary: var(--color-neutral-200); }
      const a = "[--ui-input-radius:var(--radius-core)]";
      style={{ "--sidebar-width": "16rem", '--skeleton-width': "40%" }}
    `;
    assert.deepEqual([...extractAssignments(text)].sort(), [
      "--boundary",
      "--radius-core",
      "--sidebar-width",
      "--skeleton-width",
      "--ui-input-radius",
    ]);
  });

  it("does not treat var() as an assignment", () => {
    assert.deepEqual(
      [...extractAssignments("rounded-[calc(var(--ui-wrong-radius)-5px)]")],
      []
    );
  });
});

describe("findUses", () => {
  it("finds Tailwind paren form and var() without double-counting", () => {
    const text =
      "rounded-(--ui-wrong-radius) p-[calc(var(--ui-wrong-radius)-5px)]";
    assert.deepEqual(
      findUses(text).map((use) => use.name),
      ["--ui-wrong-radius", "--ui-wrong-radius"]
    );
  });

  it("finds typed arbitrary values like bg-(image:--token)", () => {
    assert.deepEqual(
      findUses("after:bg-(image:--sidebar-resize-highlight)").map(
        (use) => use.name
      ),
      ["--sidebar-resize-highlight"]
    );
  });

  it("does not treat --spacing(3) or [--name:] as a use of the assigned name", () => {
    const text = "[--ui-input-px:--spacing(3)] px-(--ui-input-px)";
    const uses = findUses(text);
    assert.deepEqual(
      uses.map((use) => use.name),
      ["--ui-input-px"]
    );
    assert.equal(uses[0].index, text.lastIndexOf("--ui-input-px"));
  });

  it("reports var() inside an assignment value", () => {
    assert.deepEqual(
      findUses("[--ui-input-radius:var(--radius-core)]").map((use) => use.name),
      ["--radius-core"]
    );
  });
});

describe("isIgnored", () => {
  it("matches default host prefixes", () => {
    assert.equal(isIgnored("--toast-index", DEFAULT_IGNORE_PREFIXES), true);
    assert.equal(isIgnored("--anchor-width", DEFAULT_IGNORE_PREFIXES), true);
    assert.equal(
      isIgnored("--active-tab-left", DEFAULT_IGNORE_PREFIXES),
      true,
      "Base UI publishes --active-tab-* on Tabs.Indicator; they are not assigned in this repo"
    );
    assert.equal(
      isIgnored("--ui-input-radius", DEFAULT_IGNORE_PREFIXES),
      false
    );
  });
});

describe("getKnownCssVars", () => {
  it("includes Tailwind default theme tokens such as --color-red-500", () => {
    resetCssVarIndexCache();
    const names = getKnownCssVars(process.cwd());
    assert.equal(names.has("--color-red-500"), true);
    assert.equal(names.has("--ui-wrong-radius"), false);
  });

  it("does not treat an archive-only assignment as known", () => {
    const fixture = mkdtempSync(join(tmpdir(), "css-vars-archive-"));
    try {
      mkdirSync(join(fixture, "(_archive)"), { recursive: true });
      writeFileSync(
        join(fixture, "(_archive)", "archived.ts"),
        'const x = "[--ui-archive-only-var:8px]";\n'
      );
      resetCssVarIndexCache();
      const names = getKnownCssVars(fixture);
      assert.equal(names.has("--ui-archive-only-var"), false);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
      resetCssVarIndexCache();
    }
  });

  it("treats a live source assignment as known", () => {
    const fixture = mkdtempSync(join(tmpdir(), "css-vars-live-"));
    try {
      mkdirSync(join(fixture, "components"), { recursive: true });
      writeFileSync(
        join(fixture, "components", "live.ts"),
        'const x = "[--ui-live-fixture-var:8px]";\n'
      );
      resetCssVarIndexCache();
      const names = getKnownCssVars(fixture);
      assert.equal(names.has("--ui-live-fixture-var"), true);
    } finally {
      rmSync(fixture, { recursive: true, force: true });
      resetCssVarIndexCache();
    }
  });
});

describe("local/no-unknown-css-vars", () => {
  it("warns on unknown vars in strings and templates, not on known or ignored ones", async () => {
    const { RuleTester } = await import("eslint");
    const { default: noUnknownCssVars } =
      await import("./no-unknown-css-vars.mjs");
    const ruleTester = new RuleTester({
      languageOptions: { ecmaVersion: 2022 },
    });

    ruleTester.run("no-unknown-css-vars", noUnknownCssVars, {
      valid: [
        'const x = "rounded-(--radius)"',
        'const x = "origin-(--transform-origin)"',
        "const x = `px-(--ui-input-px)`",
        'const x = "bg-[color-mix(in_oklch,var(--color-red-500)_55%,transparent)]"',
      ],
      invalid: [
        {
          code: 'const x = "rounded-(--ui-wrong-radius)"',
          errors: [
            {
              message: "Unknown CSS variable '--ui-wrong-radius'.",
              line: 1,
              column: 21,
            },
          ],
        },
        {
          code: "const x = `p-[calc(var(--ui-wrong-radius)-5px)]`",
          errors: [{ message: "Unknown CSS variable '--ui-wrong-radius'." }],
        },
      ],
    });
  });
});
