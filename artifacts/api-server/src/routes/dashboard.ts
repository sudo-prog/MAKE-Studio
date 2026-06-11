import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, creditsLedgerTable } from "@workspace/db";
import { eq, desc, sql, and } from "drizzle-orm";
import { requireDbUser } from "../lib/auth";

const router = Router();

// GET /api/dashboard/summary
router.get("/dashboard/summary", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;

    const [totals, recentLedger, categories] = await Promise.all([
      db.select({
        total: sql<number>`count(*)::int`,
        completed: sql<number>`count(*) filter (where status = 'ready')::int`,
      }).from(projectsTable).where(eq(projectsTable.userId, user.id)),

      db.select().from(creditsLedgerTable)
        .where(eq(creditsLedgerTable.userId, user.id))
        .orderBy(desc(creditsLedgerTable.createdAt))
        .limit(10),

      db.select({
        category: projectsTable.category,
        count: sql<number>`count(*)::int`,
      }).from(projectsTable)
        .where(and(eq(projectsTable.userId, user.id), sql`category is not null`))
        .groupBy(projectsTable.category)
        .orderBy(sql`count(*) desc`)
        .limit(5),
    ]);

    const recentActivity = recentLedger.map((l) => ({
      type: l.reason === "generation" ? "project_generated" : l.reason === "daily_refill" ? "project_created" : "project_created",
      label: l.reason === "generation" ? "Generated project" : l.reason === "daily_refill" ? "Daily credits refilled" : "Credit update",
      projectId: l.projectId,
      timestamp: l.createdAt,
    }));

    res.json({
      totalProjects: totals[0]?.total ?? 0,
      completedProjects: totals[0]?.completed ?? 0,
      creditsBalance: user.creditsBalance,
      tier: user.tier,
      recentActivity,
      topCategories: categories.map((c) => ({ category: c.category ?? "Uncategorized", count: c.count })),
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get dashboard summary" });
  }
});

// GET /api/dashboard/recent
router.get("/dashboard/recent", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const recent = await db.select({
      id: projectsTable.id,
      title: projectsTable.title,
      status: projectsTable.status,
      renderImageUrl: projectsTable.renderImageUrl,
      category: projectsTable.category,
      estimatedCost: projectsTable.estimatedCost,
      createdAt: projectsTable.createdAt,
      updatedAt: projectsTable.updatedAt,
    }).from(projectsTable)
      .where(eq(projectsTable.userId, user.id))
      .orderBy(desc(projectsTable.updatedAt))
      .limit(6);

    res.json(recent.map((p) => ({ ...p, estimatedCost: p.estimatedCost ? Number(p.estimatedCost) : null })));
  } catch (err) {
    res.status(500).json({ error: "Failed to get recent projects" });
  }
});

export default router;
