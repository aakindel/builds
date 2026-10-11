import assert from "node:assert/strict";
import test from "node:test";
import { collectState, demoDir, demoKeyOf, demoRoute, findProblems, hashDemo, shotOf, shotPath } from "./demo-screenshots-lib.mjs";

test("standalone demo source maps to its route and preview paths", () => {
  const key = "demos/001-login-standard";
  assert.equal(demoKeyOf("app/(pages)/demos/001-login-standard/components/form.tsx"), key);
  assert.equal(demoDir(key), "app/(pages)/demos/001-login-standard");
  assert.equal(demoRoute(key), "/demos/001-login-standard");
  assert.equal(shotPath(key, "dark"), "public/demos/001-login-standard-dark.webp");
  assert.equal(demoKeyOf("app/(pages)/demos/index.ts"), null);
});

test("originals and thumbnails map to the same standalone demo", () => {
  assert.deepEqual(shotOf("public/demos/001-login-standard-light.webp"), { key: "demos/001-login-standard", theme: "light" });
  assert.deepEqual(shotOf("public/demos/001-login-standard-dark-mini.webp"), { key: "demos/001-login-standard", theme: "dark-mini" });
});

test("complete previews match the captured source and detect a later edit", () => {
  const file = "app/(pages)/demos/001-login-standard/page.tsx";
  const key = "demos/001-login-standard";
  const entries = [[file, "source-1"], ...["light", "dark", "light-mini", "dark-mini"].map(theme => [shotPath(key, theme), "image"])];
  const manifest = { [key]: hashDemo([[file, "source-1"]]) };
  assert.deepEqual(findProblems(collectState(new Map(entries)), manifest), []);
  entries[0][1] = "source-2";
  assert.equal(findProblems(collectState(new Map(entries)), manifest)[0].kind, "stale");
});

test("missing thumbnails and orphaned previews block a complete snapshot", () => {
  const key = "demos/001-login-standard";
  const state = collectState(new Map([["app/(pages)/demos/001-login-standard/page.tsx", "source"], [shotPath(key, "light"), "image"], [shotPath("demos/999-deleted", "dark"), "image"]]));
  const problems = findProblems(state, {});
  assert.ok(problems.some(problem => problem.key === key && problem.theme === "dark-mini"));
  assert.ok(problems.some(problem => problem.kind === "orphan-shot"));
});

test("standalone demo lookup rejects unrelated routes", () => {
  assert.throws(() => demoDir("pages/300-auth/demos/001-login-standard"), /Unknown demo route/);
  assert.throws(() => demoDir("demos/001-login-standard/extra"), /Unknown demo route/);
});
