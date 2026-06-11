---
name: MakerForge code review conventions
description: Patterns that MakerForge code review enforces — required to pass
---

# MakerForge Code Review Conventions

## noImplicitReturns pattern
Express handlers must do `res.json({ ... }); return;` NOT `return res.json({ ... })`.

## Express 5 params
Always `parseInt(String(req.params.id))` — never `req.params.id` directly as a number.

## api-client-react rebuild
After ANY change to `lib/api-client-react/src/`, MUST run `cd lib/api-client-react && pnpm tsc --build` before typechecking dependents.

## Clerk import
Use `@clerk/react` (NOT `@clerk/clerk-react`). Hook: `useUser()` for `isSignedIn`.

## OctoPrint architecture
Server-side proxy REQUIRED — client-side OctoPrint calls were explicitly rejected. Proxy routes live in integrations.ts. AES-256-GCM key stored in OCTOPRINT_ENCRYPTION_KEY env var.

## Admin guard
`ADMIN_EMAILS` env var (comma-separated) checked against `user.email` for admin-only routes.

## Gallery filters
All filters (skillLevel, search, material) must be server-side via SQL — client-side filtering was rejected.
