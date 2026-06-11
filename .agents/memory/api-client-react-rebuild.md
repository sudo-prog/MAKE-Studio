---
name: api-client-react rebuild requirement
description: The @workspace/api-client-react package has composite:true and emitDeclarationOnly — must rebuild after source edits
---

The `lib/api-client-react` package is configured with `"composite": true` and `"emitDeclarationOnly": true`. Its consumers (e.g. `artifacts/makerforge`) resolve types from the compiled `dist/` directory, not from source.

**Why:** TypeScript project references require pre-compiled declarations in `dist/`. Editing `src/generated/api.ts` alone does not update what consumers see.

**How to apply:** After any edit to `lib/api-client-react/src/`, run:
```
cd lib/api-client-react && rm -f tsconfig.tsbuildinfo && pnpm exec tsc -p tsconfig.json
```
Then optionally clear the consumer's `.tsbuildinfo`:
```
rm -f artifacts/makerforge/.tsbuildinfo
```
