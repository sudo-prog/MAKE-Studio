import { getAuth } from "@clerk/express";
import type { Request, Response, NextFunction } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";

export function requireAuth(req: Request, res: Response, next: NextFunction) {
  const auth = getAuth(req);
  const clerkUserId = auth?.userId;
  if (!clerkUserId) {
    return res.status(401).json({ error: "Unauthorized" });
  }
  (req as any).clerkUserId = clerkUserId;
  next();
}

export async function getOrCreateUser(clerkUserId: string, email?: string, displayName?: string) {
  const existing = await db.select().from(usersTable).where(eq(usersTable.clerkId, clerkUserId)).limit(1);
  if (existing.length > 0) {
    return existing[0];
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
    return res.status(401).json({ error: "Unauthorized" });
  }
  const user = await getOrCreateUser(clerkUserId);
  (req as any).dbUser = user;
  (req as any).clerkUserId = clerkUserId;
  next();
}
