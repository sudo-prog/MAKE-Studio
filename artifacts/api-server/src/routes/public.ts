import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, affiliateClicksTable } from "@workspace/db";
import { eq, and, desc, sql } from "drizzle-orm";

const router = Router();

// GET /api/public/projects/:slug
router.get("/public/projects/:slug", async (req, res) => {
  try {
    const slug = String(req.params.slug);
    const [project] = await db.select().from(projectsTable).where(
      and(eq(projectsTable.shareSlug, slug), eq(projectsTable.isPublic, true))
    ).limit(1);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }

    res.json({
      id: project.id,
      title: project.title,
      prompt: project.prompt,
      description: project.description,
      status: project.status,
      isPublic: true,
      shareSlug: project.shareSlug,
      renderImageUrl: project.renderImageUrl,
      category: project.category,
      skillLevel: project.skillLevel,
      estimatedCost: project.estimatedCost ? Number(project.estimatedCost) : null,
      estimatedTime: project.estimatedTime,
      sections: {
        mechanical: project.mechanicalSection,
        electronics: project.electronicsSection,
        bom: project.bomSection,
        buildGuide: project.buildGuideSection,
        educationPack: project.educationSection,
        safety: project.safetySection,
      },
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get public project" });
  }
});

// GET /api/public/gallery
router.get("/public/gallery", async (req, res) => {
  try {
    const page = parseInt(String(req.query.page ?? "1"));
    const limit = 20;
    const offset = (page - 1) * limit;
    const category = req.query.category ? String(req.query.category) : undefined;

    const conditions = [eq(projectsTable.isPublic, true), eq(projectsTable.status, "ready")];
    if (category) {
      conditions.push(eq(projectsTable.category, category));
    }

    const [items, countResult] = await Promise.all([
      db.select({
        id: projectsTable.id,
        title: projectsTable.title,
        status: projectsTable.status,
        renderImageUrl: projectsTable.renderImageUrl,
        category: projectsTable.category,
        estimatedCost: projectsTable.estimatedCost,
        shareSlug: projectsTable.shareSlug,  // ← include shareSlug so gallery cards link correctly
        createdAt: projectsTable.createdAt,
        updatedAt: projectsTable.updatedAt,
      }).from(projectsTable)
        .where(and(...conditions))
        .orderBy(desc(projectsTable.createdAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(projectsTable).where(and(...conditions)),
    ]);

    res.json({
      items: items.map((p) => ({ ...p, estimatedCost: p.estimatedCost ? Number(p.estimatedCost) : null })),
      total: countResult[0]?.count ?? 0,
      page,
      limit,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get gallery" });
  }
});

// POST /api/public/affiliate-click — log affiliate link clicks
router.post("/public/affiliate-click", async (req, res) => {
  try {
    const { supplier, partName, url, projectId, userId } = req.body;
    if (!supplier || !url) { res.status(400).json({ error: "supplier and url required" }); return; }
    await db.insert(affiliateClicksTable).values({ supplier, partName, url, projectId, userId });
    res.json({ ok: true });
  } catch (_) {
    res.json({ ok: true }); // Never fail affiliate click logging
  }
});

export default router;
