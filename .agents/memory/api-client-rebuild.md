---
name: api-client-react rebuild requirement
description: When new hooks are added to manual-hooks.ts, the dist declarations must be rebuilt or makerforge typecheck fails
---

The `lib/api-client-react` package has `composite: true` and `outDir: "dist"` in its tsconfig. The makerforge tsconfig uses project references pointing to it, so TypeScript resolves types from `dist/*.d.ts` (not source).

**Rule:** Any time you add or change exports in `lib/api-client-react/src/`, run:
```
cd lib/api-client-react && pnpm tsc --build
```
to regenerate `dist/manual-hooks.d.ts` and `dist/index.d.ts`.

**Why:** Without rebuilding, makerforge tsc sees stale `.d.ts` with missing exports and reports "Module has no exported member" for every new hook.

**How to apply:** After editing any file in `lib/api-client-react/src/`, rebuild before typechecking makerforge.
