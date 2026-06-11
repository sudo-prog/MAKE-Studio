---
name: Clerk React import path for MakerForge
description: Correct Clerk package name and hook for auth state in this project
---

This project uses `@clerk/react` (Replit-managed Clerk), NOT `@clerk/clerk-react`.

**Why:** Replit's Clerk integration ships `@clerk/react` as the package; `@clerk/clerk-react` is the standalone Clerk package which is not installed.

**How to apply:**
- Import: `import { useUser } from "@clerk/react"`
- Auth check: `const { isSignedIn } = useUser()`
- Also available: `useClerk`, `Show` from same package
