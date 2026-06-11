import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  (req as any).clerkUserId = clerkUserId;
  next();
}

export async function getOrCreateUser(clerkUserId: string, email?: string, displayName?: string) {
  const existing = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkUserId)).limit(1);
  if (existing.length > 0) {
    const u = existing[0];
    // Sync the verified Clerk email if we previously stored a placeholder — fixes admin matching
    if (email && u.email.endsWith("@placeholder.com")) {
      const [updated] = await db.update(usersTable).set({ email }).where(eq(usersTable.id, u.id)).returning();
      return updated;
    }
    return u;
  }
  const [user] = await db.insert(usersTable).values({
    clerkId: clerkUserId,
    email: email ?? `${clerkUserId}@placeholder.com`,
    displayName: displayName ?? null,
    tier: "free",
    creditsBalance: 10,
  }).returning();
  return user;
}

export async function requireDbUser(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) {
    res.status(401).json({ error: "Unauthorized" });
    return;
  }
  // Extract verified email from Clerk session claims so admin matching works
  const claims = (auth as any)?.sessionClaims as Record<string, unknown> | undefined;
  const claimsEmail = (claims?.email ?? claims?.primaryEmailAddress) as string | undefined;
  const user = await getOrCreateUser(clerkUserId, claimsEmail);
  (req as any).dbUser = user;
  (req as any).clerkUserId = clerkUserId;
  next();
}
