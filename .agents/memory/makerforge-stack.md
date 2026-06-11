---
name: MakerForge stack
description: Core architecture decisions for MakerForge platform
---

# MakerForge Stack Decisions

## Backend
- **Express 5** + TypeScript + ESBuild (esbuild via build.mjs)
- **Drizzle ORM** + PostgreSQL — DB at `lib/db/`, push with `pnpm --filter @workspace/db run push`
- **Clerk** auth — `@clerk/express` clerkMiddleware, `requireDbUser` middleware in `artifacts/api-server/src/lib/auth.ts`
- **Stripe** — checkout sessions + billing portal + webhook at `POST /api/stripe/webhook`
- **OpenAI-compatible AI** — configured via `AI_API_KEY` / `AI_BASE_URL` / `AI_MODEL` env vars (fallback: `OPENAI_API_KEY` + `gpt-4o-mini`)
- **archiver** — ZIP export of project packages

## Data model
- Project sections stored as **jsonb blobs** in `projects` table (`mechanicalSection`, `electronicsSection`, `bomSection`, `buildGuideSection`, `educationSection`, `safetySection`) — not normalized tables.
- AI generates entire 6-section package in one call as structured JSON, stored immediately.
- Generation is **fire-and-forget async** — returns project with status="generating" immediately, updates to "ready" when AI finishes.

## Frontend
- React + Vite + Tailwind v4 + shadcn/ui + wouter + @tanstack/react-query
- All API hooks from `@workspace/api-client-react` (orval-generated)
- Vite dev server proxies `/api` → `localhost:8080` (API server)
- Clerk auth cookie-based (no Authorization headers)
- Primary color: `hsl(168, 90%, 45%)` (electric blue-green)

## Freemium
- Free: 3 generations/day, basic features
- Pro: unlimited generations, education pack, Stripe subscription
- Credits tracked in `credits_ledger` table

## Template seeding
- 6 built-in templates seeded on API startup via `seedTemplates()` in `artifacts/api-server/src/routes/templates.ts`
- Idempotent: checks if any templates exist before inserting
