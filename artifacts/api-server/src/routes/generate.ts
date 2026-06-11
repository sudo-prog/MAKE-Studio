import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, usersTable, creditsLedgerTable, chatMessagesTable } from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireDbUser } from "../lib/auth";
import { generateProjectPackage, refineSection } from "../lib/ai";

const router = Router();

const FREE_DAILY_LIMIT = 3;
const COST_PER_GENERATION = 1;

// POST /api/generate
router.post("/generate", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;

    // Check credits
    if (user.tier === "free") {
      const now = new Date();
      const resetAt = user.dailyCreditsResetAt ? new Date(user.dailyCreditsResetAt) : null;
      const needsReset = !resetAt || now.getTime() - resetAt.getTime() > 24 * 60 * 60 * 1000;
      if (needsReset) {
        await db.update(usersTable).set({ dailyCreditsUsed: 0, dailyCreditsResetAt: now }).where(eq(usersTable.id, user.id));
        user.dailyCreditsUsed = 0;
      }
      if (user.dailyCreditsUsed >= FREE_DAILY_LIMIT) {
        return res.status(402).json({ error: "Daily generation limit reached. Upgrade to Pro for unlimited generations.", upgradeRequired: true });
      }
    }

    const { prompt, imageUrl, category, skillLevel, budget, educationMode, templateId } = req.body;
    if (!prompt) return res.status(400).json({ error: "prompt required" });

    // Create project in "generating" state
    const [project] = await db.insert(projectsTable).values({
      userId: user.id,
      title: "Generating...",
      prompt,
      status: "generating",
      category: category ?? null,
      skillLevel: skillLevel ?? null,
      templateId: templateId ?? null,
    }).returning();

    // Store initial user message
    await db.insert(chatMessagesTable).values({ projectId: project.id, role: "user", content: prompt });

    // Deduct credit
    await db.update(usersTable).set({
      dailyCreditsUsed: (user.dailyCreditsUsed ?? 0) + COST_PER_GENERATION,
      creditsBalance: Math.max(0, user.creditsBalance - COST_PER_GENERATION),
    }).where(eq(usersTable.id, user.id));
    await db.insert(creditsLedgerTable).values({ userId: user.id, delta: -COST_PER_GENERATION, reason: "generation", projectId: project.id });

    // Generate package (async — update project in background, return project stub immediately)
    generateProjectPackage(prompt, undefined, imageUrl, educationMode ?? user.educationMode)
      .then(async (pkg) => {
        await db.update(projectsTable).set({
          title: pkg.title ?? prompt.slice(0, 60),
          description: pkg.description ?? null,
          category: pkg.category ?? category ?? null,
          skillLevel: pkg.skillLevel ?? skillLevel ?? null,
          estimatedCost: pkg.estimatedCost ? String(pkg.estimatedCost) : null,
          estimatedTime: pkg.estimatedTime ?? null,
          status: "ready",
          mechanicalSection: pkg.mechanical ?? null,
          electronicsSection: pkg.electronics ?? null,
          bomSection: pkg.bom ?? null,
          buildGuideSection: pkg.buildGuide ?? null,
          educationSection: pkg.educationPack ?? null,
          safetySection: pkg.safety ?? null,
          updatedAt: new Date(),
        }).where(eq(projectsTable.id, project.id));
        // Store AI summary message
        await db.insert(chatMessagesTable).values({
          projectId: project.id,
          role: "assistant",
          content: `I've generated your complete project package for **${pkg.title ?? "your project"}**! Check the tabs above to explore the OpenSCAD design, electronics, BOM, build guide, and education pack.`,
        });
      })
      .catch(async (err) => {
        await db.update(projectsTable).set({ status: "error", updatedAt: new Date() }).where(eq(projectsTable.id, project.id));
      });

    res.json({
      id: project.id,
      title: project.title,
      prompt: project.prompt,
      description: null,
      status: "generating",
      isPublic: false,
      shareSlug: null,
      renderImageUrl: null,
      category: project.category,
      skillLevel: project.skillLevel,
      estimatedCost: null,
      estimatedTime: null,
      sections: { mechanical: null, electronics: null, bom: null, buildGuide: null, educationPack: null, safety: null },
      createdAt: project.createdAt,
      updatedAt: project.updatedAt,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate project" });
  }
});

// POST /api/generate/:projectId/refine
router.post("/generate/:projectId/refine", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const projectId = parseInt(req.params.projectId);
    const { section, prompt } = req.body;
    if (!section || !prompt) return res.status(400).json({ error: "section and prompt required" });

    const [project] = await db.select().from(projectsTable).where(
      and(eq(projectsTable.id, projectId), eq(projectsTable.userId, user.id))
    ).limit(1);
    if (!project) return res.status(404).json({ error: "Project not found" });

    const sectionMap: Record<string, any> = {
      mechanical: project.mechanicalSection,
      electronics: project.electronicsSection,
      bom: project.bomSection,
      buildGuide: project.buildGuideSection,
      educationPack: project.educationSection,
      safety: project.safetySection,
    };

    const currentContent = sectionMap[section];
    const projectContext = `Title: "${project.title}". Prompt: "${project.prompt}".`;
    const updated = await refineSection(section, prompt, currentContent, projectContext);

    const colMap: Record<string, string> = {
      mechanical: "mechanicalSection",
      electronics: "electronicsSection",
      bom: "bomSection",
      buildGuide: "buildGuideSection",
      educationPack: "educationSection",
      safety: "safetySection",
    };

    await db.update(projectsTable).set({
      [colMap[section]]: updated,
      updatedAt: new Date(),
    }).where(eq(projectsTable.id, projectId));

    const [refreshed] = await db.select().from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);
    
    res.json({
      mechanical: refreshed.mechanicalSection,
      electronics: refreshed.electronicsSection,
      bom: refreshed.bomSection,
      buildGuide: refreshed.buildGuideSection,
      educationPack: refreshed.educationSection,
      safety: refreshed.safetySection,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to refine section" });
  }
});

export default router;
