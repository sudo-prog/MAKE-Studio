import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireDbUser } from "../lib/auth";

const router = Router();

// GET /api/users/me
router.get("/users/me", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    res.json(formatUser(user));
  } catch (err) {
    res.status(500).json({ error: "Failed to get user" });
  }
});

// PATCH /api/users/me
router.patch("/users/me", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const { displayName, educationMode } = req.body;
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (displayName !== undefined) updates.displayName = displayName;
    if (educationMode !== undefined) updates.educationMode = educationMode;
    const [updated] = await db.update(usersTable).set(updates).where(eq(usersTable.id, user.id)).returning();
    res.json(formatUser(updated));
  } catch (err) {
    res.status(500).json({ error: "Failed to update user" });
  }
});

function formatUser(user: typeof usersTable.$inferSelect) {
  return {
    id: user.id,
    clerkId: user.clerkId,
    email: user.email,
    displayName: user.displayName,
    avatarUrl: user.avatarUrl,
    tier: user.tier,
    creditsBalance: user.creditsBalance,
    educationMode: user.educationMode,
    githubConnected: user.githubConnected,
    octoprintConnected: user.octoprintConnected,
    createdAt: user.createdAt,
  };
}

export default router;
