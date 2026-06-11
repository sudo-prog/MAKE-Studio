---
name: MakerForge API server TypeScript/Express patterns
description: Key patterns required by tsconfig/express5 to avoid compile errors in api-server
---

**Express 5 route params:** Always use `String(req.params.id)` and `Number(req.params.id)` — params are typed as `unknown` in Express 5.

**noImplicitReturns:** Express handlers must follow this pattern:
```ts
res.json({ ok: true });
return;
// NOT: return res.json({ ok: true });
```

**Drizzle onConflictDoUpdate:** Requires a unique index on the conflict target columns. For `connected_accounts`, the unique index `connected_accounts_user_provider_idx` on (userId, provider) was added to the DB schema.

**Why:** tsconfig has strict mode + noImplicitReturns; Express 5 changed param types; Drizzle requires the actual DB index to exist for conflict resolution.
