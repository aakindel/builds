<!-- Generated from .agents/rules. Do not edit. Run pnpm agents:rules. -->

After Tailwind `className` or equivalent class-list edits, use /general-fix and apply every `suggestCanonicalClasses` rewrite until clean. Then run its shadcn ESLint pass on applicable edited files. After edits that affect types, follow its TypeScript rule and run a full typecheck until clean. When both apply, finish canonical classes first, then ESLint, then TypeScript. Skip a pass only when it does not apply to the changes.
