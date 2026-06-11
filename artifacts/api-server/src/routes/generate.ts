import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, usersTable, creditsLedgerTable, chatMessagesTable } from "@workspace/db";
import { eq, and, sql } from "drizzle-orm";
import { requireDbUser } from "../lib/auth";
import { generateProjectPackage, refineSection } from "../lib/ai";

const router = Router();

const FREE_DAILY_LIMIT = 3;
const GUEST_DAILY_LIMIT = 1;
const COST_PER_GENERATION = 1;

async function doGenerate(
  userId: number,
  prompt: string,
  category: string | undefined,
  skillLevel: string | undefined,
  budget: string | undefined,
  imageUrl: string | undefined,
  educationMode: boolean | undefined,
  templateId: number | undefined
) {
  const [project] = await db.insert(projectsTable).values({
    userId,
    title: "Generating...",
    prompt,
    status: "generating",
    category: category ?? null,
    skillLevel: (skillLevel as any) ?? null,
    templateId: templateId ?? null,
  }).returning();

  await db.insert(chatMessagesTable).values({ projectId: project.id, role: "user", content: prompt });

  generateProjectPackage(prompt, undefined, imageUrl, educationMode)
    .then(async (pkg) => {
      await db.update(projectsTable).set({
        title: pkg.title ?? prompt.slice(0, 60),
        description: pkg.description ?? null,
        category: pkg.category ?? category ?? null,
        skillLevel: (pkg.skillLevel ?? skillLevel ?? null) as any,
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
      await db.insert(chatMessagesTable).values({
        projectId: project.id,
        role: "assistant",
        content: `I've generated your complete project package for **${pkg.title ?? "your project"}**! Check the tabs above to explore the OpenSCAD design, electronics, BOM, build guide, and education pack.`,
      });
    })
    .catch(async () => {
      await db.update(projectsTable).set({ status: "error", updatedAt: new Date() }).where(eq(projectsTable.id, project.id));
    });

  return project;
}

// POST /api/generate — authenticated
router.post("/generate", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;

    if (user.tier === "free") {
      const now = new Date();
      const resetAt = user.dailyCreditsResetAt ? new Date(user.dailyCreditsResetAt) : null;
      const needsReset = !resetAt || now.getTime() - resetAt.getTime() > 24 * 60 * 60 * 1000;
      if (needsReset) {
        await db.update(usersTable).set({ dailyCreditsUsed: 0, dailyCreditsResetAt: now }).where(eq(usersTable.id, user.id));
        user.dailyCreditsUsed = 0;
      }
      if (user.dailyCreditsUsed >= FREE_DAILY_LIMIT) {
        res.status(402).json({ error: "Daily generation limit reached. Upgrade to Pro for unlimited generations.", upgradeRequired: true });
        return;
      }
    }

    const { prompt, imageUrl, category, skillLevel, budget, educationMode, templateId } = req.body;
    if (!prompt) { res.status(400).json({ error: "prompt required" }); return; }

    await db.update(usersTable).set({
      dailyCreditsUsed: (user.dailyCreditsUsed ?? 0) + COST_PER_GENERATION,
      creditsBalance: Math.max(0, user.creditsBalance - COST_PER_GENERATION),
    }).where(eq(usersTable.id, user.id));
    await db.insert(creditsLedgerTable).values({ userId: user.id, delta: -COST_PER_GENERATION, reason: "generation", projectId: null });

    const project = await doGenerate(user.id, prompt, category, skillLevel, budget, imageUrl, educationMode ?? user.educationMode, templateId);

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

// POST /api/generate/guest — no auth required, limited to 1 per guest ID per day
router.post("/generate/guest", async (req, res) => {
  try {
    const guestId = req.headers["x-guest-id"] as string | undefined;
    if (!guestId || guestId.length < 8) {
      res.status(400).json({ error: "x-guest-id header required (min 8 chars)" });
      return;
    }

    // Look up or create guest user by clerkId = "guest:<guestId>"
    const guestClerkId = `guest:${guestId}`;
    let [guestUser] = await db.select().from(usersTable).where(eq(usersTable.clerkId, guestClerkId)).limit(1);
    if (!guestUser) {
      [guestUser] = await db.insert(usersTable).values({
        clerkId: guestClerkId,
        email: `${guestId}@guest.makerforge`,
        displayName: "Guest",
        tier: "free",
        creditsBalance: GUEST_DAILY_LIMIT,
      }).returning();
    }

    // Rate limit: 1 per day per guest
    const now = new Date();
    const resetAt = guestUser.dailyCreditsResetAt ? new Date(guestUser.dailyCreditsResetAt) : null;
    const needsReset = !resetAt || now.getTime() - resetAt.getTime() > 24 * 60 * 60 * 1000;
    if (needsReset) {
      await db.update(usersTable).set({ dailyCreditsUsed: 0, dailyCreditsResetAt: now }).where(eq(usersTable.id, guestUser.id));
      guestUser.dailyCreditsUsed = 0;
    }
    if ((guestUser.dailyCreditsUsed ?? 0) >= GUEST_DAILY_LIMIT) {
      res.status(402).json({ error: "Guest limit reached. Sign up to forge more projects.", upgradeRequired: true });
      return;
    }

    const { prompt, imageUrl, category, skillLevel } = req.body;
    if (!prompt) { res.status(400).json({ error: "prompt required" }); return; }

    await db.update(usersTable).set({
      dailyCreditsUsed: (guestUser.dailyCreditsUsed ?? 0) + 1,
    }).where(eq(usersTable.id, guestUser.id));

    const project = await doGenerate(guestUser.id, prompt, category, skillLevel, undefined, imageUrl, false, undefined);

    // Make guest projects public by default so they can be viewed without auth
    await db.update(projectsTable).set({ isPublic: true }).where(eq(projectsTable.id, project.id));

    res.json({
      id: project.id,
      status: "generating",
      isGuest: true,
      createdAt: project.createdAt,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to generate guest project" });
  }
});

// POST /api/generate/:projectId/refine
router.post("/generate/:projectId/refine", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const projectId = parseInt(String(req.params.projectId));
    const { section, prompt } = req.body;
    if (!section || !prompt) { res.status(400).json({ error: "section and prompt required" }); return; }

    const [project] = await db.select().from(projectsTable).where(
      and(eq(projectsTable.id, projectId), eq(projectsTable.userId, user.id))
    ).limit(1);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }

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
