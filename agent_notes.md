# Agent Notes — MAKE Studio (MakerForge)

Architecture decisions, file structure, API patterns, and known issues.

---

## Project Path
`/home/thinkpad/Data/20_Projects/20.11_MAKE_STUDIO/08_MAKE-Studio/`

## Repository
- GitHub: `sudo-prog/MAKE-Studio` (private)
- Main branch: `main`
- pnpm monorepo with workspaces

## Monorepo Structure
- `artifacts/makerforge/` — React 19 frontend (Vite, Tailwind 4, shadcn/ui, Zustand, TanStack Query)
- `artifacts/makerforge-mobile/` — Expo mobile app (React Native 0.81, expo-router)
- `artifacts/api-server/` — Express 5 backend (Drizzle ORM, PostgreSQL, Zod validation)
- `lib/db/` — Shared database schema (Drizzle), migrations
- `lib/api-zod/` — Shared Zod schemas, API client
- `lib/api-client-react/` — Generated API client for frontend
- `lib/api-spec/` — OpenAPI spec, Orval codegen

## Key Technologies
- Frontend: React 19, Vite 7, Tailwind CSS 4, shadcn/ui, Zustand, TanStack Query, Framer Motion
- Mobile: React Native 0.81, Expo 54, expo-router, Reanimated 4
- Backend: Express 5, Drizzle ORM, PostgreSQL, Zod, Pino logging
- AI: OpenAI-compatible (GPT-4o-mini), async generation with streaming support
- Auth: Clerk authentication

## Vercel Deployment Configuration
- Web app deployed via Vercel with `outputDirectory: "dist"`
- Mobile app runs independently via Expo Go
- API server should be deployed to Railway/Render for production

## Audit Fixes (2026-07-05)

### API Client Base URL Wiring
- `artifacts/makerforge/src/main.tsx` — Added `setBaseUrl(import.meta.env.VITE_API_BASE_URL)` to enable API calls to the backend server.
- `artifacts/makerforge-mobile/app/_layout.tsx` — Added `setBaseUrl` with `EXPO_PUBLIC_DOMAIN` environment variable check.

### Mobile / Touch Support
- Mobile app already has proper haptic feedback and touch event handling
- Virtual joystick for FPS controls in play.tsx
- CRT viewport styling, Doom HUD aesthetic

### AI Integration
- `artifacts/api-server/src/routes/generate.ts` — Has full AI integration with:
  - `generateProjectPackage()` for OpenSCAD/electronics/build guide generation
  - `refineSection()` for iterative improvements
  - Credit system (3 free daily, upgrade for unlimited)
  - Guest mode support (1 daily limit)

### Known Issues
- AI requires `OPENAI_API_KEY` or compatible provider key
- PostgreSQL required for full functionality
- No offline mode for AI features

---

## Deployment Checklist
- [ ] Set environment variables in deployment platform
- [ ] Apply database migrations (`pnpm db:push` or direct SQL)
- [ ] Configure `VITE_API_BASE_URL` in Vercel dashboard to point to API server
- [ ] Configure `EXPO_PUBLIC_DOMAIN` in Expo for mobile app

## Audit History
- 2026-07-09: Frontend route audit (chief-of-staff agent)
  - **Auth**: Clerk (`@clerk/react`). `src/App.tsx:38` throws `Missing VITE_CLERK_PUBLISHABLE_KEY` if key absent — app fails to mount on `localhost` (no host-derived key). With a key supplied, app mounts; `/` (Dashboard) renders real content.
  - **Routes**: 17 routes (wouter). Auth-gated (`/dashboard`, `/gallery`, `/projects`, `/profile`, `/admin`, etc.) require a live Clerk session; without one they collapse to the 404 fallback. Full content verification needs live Clerk publishable key + signed-in session (not available locally).
  - **Console errors**: `/` shows `/api/*` 500s (backend/Postgres down) + Clerk connection-refused (invalid key). NOT code bugs.
  - **Build**: `cd artifacts/makerforge && pnpm build` passes (vite v7.3.3, 11.01s, `dist/public/index.html` + assets emitted). Sourcemap warnings harmless.
  - **Verdict**: UI code sound (mounts, no crash). Full route audit blocked by external Clerk + Postgres deps. No code fixes required.