// from https://paulintrognon.fr/blog/typescript-prettier-eslint-next-js
//
// Keep lint-staged at 16.4.0. v17 dropped listr2's update renderer and prints
// every command title expanded, including interpolated file paths.

// `pnpm exec` resolves straight to the local bin. `npx` checks the registry
// first when it cannot find one, which is a network round trip on every hook.
const lintStagedConfig = {
  // type check typescript files
  "**/*.(ts|tsx)": () => "pnpm exec tsc --skipLibCheck --noEmit",

  // Lint then format typescript and javascript files
  "**/*.(ts|tsx|js)": (filenames) => [
    `pnpm exec eslint --fix ${filenames.join(" ")}`,
    `pnpm exec prettier --write ${filenames.join(" ")}`,
  ],

  // format markdown, JSON, CSS and SCSS
  "**/*.(md|json|css|scss)": (filenames) =>
    `pnpm exec prettier --write ${filenames.join(" ")}`,
};

export default lintStagedConfig;
