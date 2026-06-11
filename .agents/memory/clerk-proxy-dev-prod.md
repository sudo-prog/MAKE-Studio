---
name: Clerk dev vs prod proxy
description: When to use proxyUrl in ClerkProvider for Replit-managed Clerk
---

# Clerk Dev vs Prod Proxy

## Rule
In App.tsx, only set `proxyUrl` on ClerkProvider when `import.meta.env.PROD` is true:
```ts
const clerkProxyUrl = import.meta.env.PROD
  ? `${window.location.origin}${basePath}/api/__clerk`
  : undefined;
```

**Why:** The `clerkProxyMiddleware` in `artifacts/api-server/src/middlewares/clerkProxyMiddleware.ts` is a no-op when `NODE_ENV !== "production"`. If `proxyUrl` is set in dev, Clerk tries to load `clerk.browser.js` from the proxy which returns 404, breaking auth entirely.

**How to apply:** Any time you modify ClerkProvider config or add a new frontend artifact with Clerk. Dev instances (`pk_test_*`) load directly from Clerk's CDN. Production instances use the proxy path `/api/__clerk`.
