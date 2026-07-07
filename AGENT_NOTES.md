# Agent Notes — MakerForge (MAKE_STUDIO)
**Last updated:** 2026-06-22
**Status:** Full-stack application complete — needs deployment and testing

---

## Project Overview

AI-powered hardware project generation platform. Full-stack pnpm monorepo for creating, sharing, and manufacturing hardware/maker projects. Features AI project generation with credit system, Stripe payments, BOM management, build guides, community features (showcase, challenges, fork/remix), affiliate tracking, and multi-platform support (web + Expo mobile).

- **Stack:** pnpm monorepo, Node.js 24, TypeScript 5.9, Express 5, React 19, Vite, PostgreSQL, Drizzle ORM, Expo mobile, Stripe, OpenRouter AI
- **Artifacts:** api-server, makerforge (web), makerforge-mobile (Expo), mockup-sandbox
- **DB tables:** 11 tables (users, projects, project_versions, templates, chat_messages, credits_ledger, connected_accounts, showcase_posts, showcase_likes, showcase_comments, project_likes, challenges, challenge_submissions, affiliate_clicks)

---

## Architecture

### Monorepo Structure
```
artifacts/
  api-server/           — Express API (11 route files, lib, middlewares)
  makerforge/           — React/Vite web frontend (16 pages)
  makerforge-mobile/    — Expo React Native mobile app
  mockup-sandbox/       — UI component sandbox
lib/
  api-spec/             — OpenAPI YAML spec
  api-zod/              — Generated Zod schemas
  api-client-react/     — Generated React Query hooks
  db/                   — Drizzle ORM schema (11+ tables)
scripts/                — Build/merge scripts
```

### API Routes (11 files)
| Route | Key Endpoints |
|-------|---------------|
| `/api/healthz` | GET health check |
| `/api/users` | GET me, PATCH me |
| `/api/projects` | CRUD + search + pagination + zip export + fork |
| `/api/generate` | POST generate (AI project package with credit system) |
| `/api/templates` | List, create, seed |
| `/api/credits` | GET balance, POST checkout (Stripe), GET ledger |
| `/api/dashboard` | GET summary |
| `/api/public` | GET public projects (slug), GET trending |
| `/api/integrations` | GitHub OAuth (HMAC state), OctoPrint, Makerspace |
| `/api/community` | Showcase (CRUD + likes + comments), Challenges (CRUD + submissions), Affiliate (click tracking) |

### Database Schema (11+ tables)
- **users** — id, email, name, avatarUrl, tier, creditsBalance, dailyCreditsUsed, dailyCreditsResetAt, stripeCustomerId, isGuest
- **projects** — id, userId, title, prompt, description, status, category, skillLevel, estimatedCost, estimatedTime, renderImageUrl, mechanicalSection, electronicsSection, bomSection, buildGuideSection, educationSection, safetySection, isPublic, shareSlug, templateId, timestamps
- **project_versions** — id, projectId, version, data JSON, createdAt
- **templates** — id, name, category, data JSON, isPublic
- **chat_messages** — id, projectId, role, content, createdAt
- **credits_ledger** — id, userId, amount, type, reference, createdAt
- **connected_accounts** — id, userId, provider, accessToken (encrypted), refreshToken (encrypted), timestamps
- **showcase_posts** — id, userId, projectId, title, description, images[], isPublished, timestamps
- **showcase_likes** — id, postId, userId
- **showcase_comments** — id, postId, userId, content, timestamps
- **project_likes** — id, projectId, userId
- **challenges** — id, title, description, rules, startDate, endDate, isActive
- **challenge_submissions** — id, challengeId, userId, projectId, placement
- **affiliate_clicks** — id, userId, projectId, source, clickedAt

### Frontend Pages (16)
Home, Dashboard, Projects, ProjectDetail, Create, Templates, Gallery, Showcase, Challenges, Pricing, Profile, Affiliate, Admin, PublicProject, NotFound

### Mobile App (Expo)
- Tabs: index (home), _layout
- Root: _layout, +not-found

---

## Key Features

### AI Project Generation
- **Credit system** — free tier (3/day), pro tier (unlimited), guest (1/day)
- **AI generation** — generates full project package (title, description, category, skillLevel, estimatedCost, mechanical, electronics, BOM, build guide, education pack)
- **Refinement** — refine specific sections of existing projects
- **Template-based** — can start from templates

### Stripe Integration
- **Plans** — pro_monthly, pro_annual (via Stripe price IDs)
- **Checkout** — Stripe checkout session creation
- **Customer** — Stripe customer ID stored per user

### Community Features
- **Showcase** — publish projects with images, likes, comments
- **Challenges** — themed competitions with submissions and placement
- **Fork/Remix** — one-click fork of public projects
- **Affiliate** — click tracking for referral earnings

### Integrations
- **GitHub** — OAuth with HMAC-signed state tokens, encrypted token storage
- **OctoPrint** — 3D printer management
- **Makerspace** — makerspace resource integration

### BOM Management
- **Bill of Materials** — structured BOM per project
- **Cost estimation** — estimated cost calculation
- **Build guide** — step-by-step build instructions

---

## Development Roadmap

### Completed
- [x] pnpm monorepo scaffold
- [x] PostgreSQL + Drizzle ORM schema (11+ tables)
- [x] Express API server with auth middleware
- [x] Full REST API (11 route files)
- [x] AI project generation with credit system
- [x] Stripe integration (checkout, customer management)
- [x] GitHub OAuth (HMAC state, encrypted tokens)
- [x] Community features (showcase, challenges, fork/remix, affiliate)
- [x] React/Vite web frontend (16 pages)
- [x] Expo React Native mobile app scaffold
- [x] Wouter routing, React Query
- [x] Tailwind CSS v4 + shadcn UI library
- [x] Mockup sandbox

### In Progress / Not Yet Built
- [ ] Frontend-backend integration (API client hooks → pages)
- [ ] Project CRUD UI wiring
- [ ] AI generation UI (prompt → generation → results)
- [ ] Credit system UI (balance, usage, checkout)
- [ ] Stripe checkout flow
- [ ] GitHub OAuth flow
- [ ] Showcase publishing UI
- [ ] Challenge participation UI
- [ ] BOM editor
- [ ] Build guide viewer/editor
- [ ] Mobile app screens (only scaffold exists)
- [ ] Database migrations
- [ ] Deployment pipeline
- [ ] E2E tests

### Known Issues
- pnpm-workspace.yaml has Replit-specific packages
- Stripe requires `STRIPE_SECRET_KEY`, `STRIPE_PRO_MONTHLY_PRICE_ID`, `STRIPE_PRO_ANNUAL_PRICE_ID`
- GitHub OAuth requires `GITHUB_CLIENT_ID`, `GITHUB_CLIENT_SECRET`
- OpenRouter AI key required for generation
- Mobile app only has scaffold (tabs layout, index, not-found)
- `requireDbUser` middleware assumes DB-backed auth — guest mode needs handling

---

## Common Pitfalls
- **Drizzle numeric columns** returned as `string` — always cast
- **Credit system** — check daily limits before generation; reset at midnight
- **Stripe** — webhook endpoint needed for payment confirmation
- **GitHub OAuth** — state tokens are HMAC-signed, never trust client-provided state
- **Token encryption** — connected account tokens use AES-256-CBC with APP_SECRET
- **Mobile** — Expo app needs `expo start` with proper metro config
- **API client hooks** — run codegen after schema changes

---

## File Reference
| Path | Purpose |
|------|---------|
| `artifacts/api-server/src/app.ts` | Express app setup |
| `artifacts/api-server/src/routes/index.ts` | Route aggregation (11 routes) |
| `artifacts/api-server/src/routes/projects.ts` | Project CRUD + zip export + fork |
| `artifacts/api-server/src/routes/generate.ts` | AI project generation |
| `artifacts/api-server/src/routes/credits.ts` | Credit system + Stripe |
| `artifacts/api-server/src/routes/community.ts` | Showcase, challenges, affiliate |
| `artifacts/api-server/src/routes/integrations.ts` | GitHub OAuth, OctoPrint |
| `artifacts/api-server/src/routes/templates.ts` | Project templates |
| `artifacts/api-server/src/routes/users.ts` | User profile |
| `artifacts/api-server/src/lib/auth.ts` | Auth middleware (requireDbUser) |
| `artifacts/api-server/src/lib/ai.ts` | AI generation logic |
| `artifacts/makerforge/src/` | Web frontend (16 pages) |
| `artifacts/makerforge-mobile/` | Expo mobile app |
| `lib/db/src/schema/` | All Drizzle table definitions |
