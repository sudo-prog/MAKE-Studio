import { Router } from "express";
import { db } from "@workspace/db";
import {
  projectsTable, usersTable, projectVersionsTable,
  showcasePostsTable, showcaseLikesTable, showcaseCommentsTable, projectLikesTable,
  challengesTable, challengeSubmissionsTable, affiliateClicksTable,
} from "@workspace/db";
import { eq, and, desc, sql, asc } from "drizzle-orm";
import { requireDbUser } from "../lib/auth";

const router = Router();

// ── PROJECT FORK / REMIX ──────────────────────────────────────────────────────

// POST /api/projects/:id/fork
router.post("/projects/:id/fork", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const sourceId = parseInt(String(req.params.id));
    const [source] = await db.select().from(projectsTable).where(
      and(eq(projectsTable.id, sourceId), eq(projectsTable.isPublic, true))
    ).limit(1);
    if (!source) { res.status(404).json({ error: "Project not found or not public" }); return; }

    const [forked] = await db.insert(projectsTable).values({
      userId: user.id,
      title: `${source.title} (Remix)`,
      prompt: source.prompt,
      description: source.description,
      status: "ready",
      category: source.category,
      skillLevel: source.skillLevel as any,
      estimatedCost: source.estimatedCost,
      estimatedTime: source.estimatedTime,
      mechanicalSection: source.mechanicalSection,
      electronicsSection: source.electronicsSection,
      bomSection: source.bomSection,
      buildGuideSection: source.buildGuideSection,
      educationSection: source.educationSection,
      safetySection: source.safetySection,
      templateId: sourceId,
    }).returning();

    res.status(201).json({ id: forked.id, title: forked.title, sourceId });
  } catch (err) {
    res.status(500).json({ error: "Failed to fork project" });
  }
});

// ── PROJECT VERSION HISTORY ───────────────────────────────────────────────────

// GET /api/projects/:id/versions
router.get("/projects/:id/versions", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const projectId = parseInt(String(req.params.id));
    const [project] = await db.select({ id: projectsTable.id }).from(projectsTable).where(
      and(eq(projectsTable.id, projectId), eq(projectsTable.userId, user.id))
    ).limit(1);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }

    const versions = await db.select().from(projectVersionsTable)
      .where(eq(projectVersionsTable.projectId, projectId))
      .orderBy(desc(projectVersionsTable.versionNumber))
      .limit(20);
    res.json(versions);
  } catch (err) {
    res.status(500).json({ error: "Failed to get versions" });
  }
});

// POST /api/projects/:id/versions — snapshot current state
router.post("/projects/:id/versions", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const projectId = parseInt(String(req.params.id));
    const { diffSummary } = req.body;

    const [project] = await db.select().from(projectsTable).where(
      and(eq(projectsTable.id, projectId), eq(projectsTable.userId, user.id))
    ).limit(1);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }

    const [lastVersion] = await db.select({ versionNumber: projectVersionsTable.versionNumber })
      .from(projectVersionsTable).where(eq(projectVersionsTable.projectId, projectId))
      .orderBy(desc(projectVersionsTable.versionNumber)).limit(1);
    const versionNumber = (lastVersion?.versionNumber ?? 0) + 1;

    const [version] = await db.insert(projectVersionsTable).values({
      projectId,
      userId: user.id,
      versionNumber,
      prompt: project.prompt,
      diffSummary: diffSummary ?? `Version ${versionNumber}`,
      snapshot: {
        mechanical: project.mechanicalSection,
        electronics: project.electronicsSection,
        bom: project.bomSection,
        buildGuide: project.buildGuideSection,
        educationPack: project.educationSection,
        safety: project.safetySection,
      },
    }).returning();
    res.status(201).json(version);
  } catch (err) {
    res.status(500).json({ error: "Failed to save version" });
  }
});

// POST /api/projects/:id/versions/:versionId/restore
router.post("/projects/:id/versions/:versionId/restore", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const projectId = parseInt(String(req.params.id));
    const versionId = parseInt(String(req.params.versionId));

    const [version] = await db.select().from(projectVersionsTable).where(
      and(eq(projectVersionsTable.id, versionId), eq(projectVersionsTable.projectId, projectId))
    ).limit(1);
    if (!version) { res.status(404).json({ error: "Version not found" }); return; }

    const snap = version.snapshot as any;
    await db.update(projectsTable).set({
      mechanicalSection: snap.mechanical ?? null,
      electronicsSection: snap.electronics ?? null,
      bomSection: snap.bom ?? null,
      buildGuideSection: snap.buildGuide ?? null,
      educationSection: snap.educationPack ?? null,
      safetySection: snap.safety ?? null,
      updatedAt: new Date(),
    }).where(and(eq(projectsTable.id, projectId), eq(projectsTable.userId, user.id)));

    res.json({ ok: true, restoredTo: version.versionNumber });
  } catch (err) {
    res.status(500).json({ error: "Failed to restore version" });
  }
});

// ── PROJECT LIKES ─────────────────────────────────────────────────────────────

// POST /api/projects/:id/like
router.post("/projects/:id/like", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const projectId = parseInt(String(req.params.id));
    const existing = await db.select({ id: projectLikesTable.id }).from(projectLikesTable).where(
      and(eq(projectLikesTable.projectId, projectId), eq(projectLikesTable.userId, user.id))
    ).limit(1);
    if (existing.length > 0) {
      await db.delete(projectLikesTable).where(eq(projectLikesTable.id, existing[0].id));
      res.json({ liked: false });
    } else {
      await db.insert(projectLikesTable).values({ projectId, userId: user.id });
      res.json({ liked: true });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to toggle like" });
  }
});

// ── SHOWCASE ──────────────────────────────────────────────────────────────────

// GET /api/showcase — list showcase posts
router.get("/showcase", async (req, res) => {
  try {
    const sort = String(req.query.sort ?? "recent");
    const page = parseInt(String(req.query.page ?? "1"));
    const limit = 20;
    const offset = (page - 1) * limit;

    const orderBy = sort === "trending"
      ? [desc(showcasePostsTable.likeCount), desc(showcasePostsTable.createdAt)]
      : [desc(showcasePostsTable.createdAt)];

    const posts = await db.select({
      id: showcasePostsTable.id,
      caption: showcasePostsTable.caption,
      mediaUrl: showcasePostsTable.mediaUrl,
      mediaType: showcasePostsTable.mediaType,
      likeCount: showcasePostsTable.likeCount,
      commentCount: showcasePostsTable.commentCount,
      makerVerified: showcasePostsTable.makerVerified,
      createdAt: showcasePostsTable.createdAt,
      projectId: showcasePostsTable.projectId,
      userId: showcasePostsTable.userId,
      projectTitle: projectsTable.title,
      projectCategory: projectsTable.category,
      userDisplayName: usersTable.displayName,
    }).from(showcasePostsTable)
      .leftJoin(projectsTable, eq(showcasePostsTable.projectId, projectsTable.id))
      .leftJoin(usersTable, eq(showcasePostsTable.userId, usersTable.id))
      .orderBy(...orderBy)
      .limit(limit)
      .offset(offset);

    const [countRow] = await db.select({ count: sql<number>`count(*)::int` }).from(showcasePostsTable);
    res.json({ items: posts, total: countRow?.count ?? 0, page, limit });
  } catch (err) {
    res.status(500).json({ error: "Failed to get showcase" });
  }
});

// POST /api/showcase — create showcase post
router.post("/showcase", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const { projectId, caption, mediaUrl, mediaType } = req.body;
    if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

    const [project] = await db.select({ id: projectsTable.id }).from(projectsTable).where(
      and(eq(projectsTable.id, projectId), eq(projectsTable.userId, user.id))
    ).limit(1);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }

    const [post] = await db.insert(showcasePostsTable).values({
      projectId, userId: user.id, caption, mediaUrl, mediaType: mediaType ?? "image",
    }).returning();
    res.status(201).json(post);
  } catch (err) {
    res.status(500).json({ error: "Failed to create showcase post" });
  }
});

// POST /api/showcase/:id/like
router.post("/showcase/:id/like", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const postId = parseInt(String(req.params.id));
    const existing = await db.select({ id: showcaseLikesTable.id }).from(showcaseLikesTable).where(
      and(eq(showcaseLikesTable.postId, postId), eq(showcaseLikesTable.userId, user.id))
    ).limit(1);
    if (existing.length > 0) {
      await db.delete(showcaseLikesTable).where(eq(showcaseLikesTable.id, existing[0].id));
      await db.update(showcasePostsTable).set({ likeCount: sql`like_count - 1` }).where(eq(showcasePostsTable.id, postId));
      res.json({ liked: false });
    } else {
      await db.insert(showcaseLikesTable).values({ postId, userId: user.id });
      await db.update(showcasePostsTable).set({ likeCount: sql`like_count + 1` }).where(eq(showcasePostsTable.id, postId));
      res.json({ liked: true });
    }
  } catch (err) {
    res.status(500).json({ error: "Failed to toggle like" });
  }
});

// GET /api/showcase/:id/comments
router.get("/showcase/:id/comments", async (req, res) => {
  try {
    const postId = parseInt(String(req.params.id));
    const comments = await db.select({
      id: showcaseCommentsTable.id,
      content: showcaseCommentsTable.content,
      createdAt: showcaseCommentsTable.createdAt,
      userId: showcaseCommentsTable.userId,
      userDisplayName: usersTable.displayName,
    }).from(showcaseCommentsTable)
      .leftJoin(usersTable, eq(showcaseCommentsTable.userId, usersTable.id))
      .where(eq(showcaseCommentsTable.postId, postId))
      .orderBy(asc(showcaseCommentsTable.createdAt))
      .limit(50);
    res.json(comments);
  } catch (err) {
    res.status(500).json({ error: "Failed to get comments" });
  }
});

// POST /api/showcase/:id/comments
router.post("/showcase/:id/comments", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const postId = parseInt(String(req.params.id));
    const { content } = req.body;
    if (!content?.trim()) { res.status(400).json({ error: "content required" }); return; }
    const [comment] = await db.insert(showcaseCommentsTable).values({ postId, userId: user.id, content }).returning();
    await db.update(showcasePostsTable).set({ commentCount: sql`comment_count + 1` }).where(eq(showcasePostsTable.id, postId));
    res.status(201).json({ ...comment, userDisplayName: user.displayName });
  } catch (err) {
    res.status(500).json({ error: "Failed to add comment" });
  }
});

// ── CHALLENGES ────────────────────────────────────────────────────────────────

// GET /api/challenges
router.get("/challenges", async (req, res) => {
  try {
    const challenges = await db.select().from(challengesTable)
      .orderBy(desc(challengesTable.createdAt)).limit(20);
    res.json(challenges);
  } catch (err) {
    res.status(500).json({ error: "Failed to get challenges" });
  }
});

// POST /api/challenges — admin only (check admin flag via env)
router.post("/challenges", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim());
    if (!adminEmails.includes(user.email)) {
      res.status(403).json({ error: "Admin only" });
      return;
    }
    const { title, description, theme, prize, endsAt } = req.body;
    if (!title || !description) { res.status(400).json({ error: "title and description required" }); return; }
    const [challenge] = await db.insert(challengesTable).values({
      title, description, theme, prize,
      endsAt: endsAt ? new Date(endsAt) : null,
    }).returning();
    res.status(201).json(challenge);
  } catch (err) {
    res.status(500).json({ error: "Failed to create challenge" });
  }
});

// GET /api/challenges/:id/submissions
router.get("/challenges/:id/submissions", async (req, res) => {
  try {
    const challengeId = parseInt(String(req.params.id));
    const subs = await db.select({
      id: challengeSubmissionsTable.id,
      projectId: challengeSubmissionsTable.projectId,
      userId: challengeSubmissionsTable.userId,
      note: challengeSubmissionsTable.note,
      isWinner: challengeSubmissionsTable.isWinner,
      createdAt: challengeSubmissionsTable.createdAt,
      projectTitle: projectsTable.title,
      projectCategory: projectsTable.category,
      userDisplayName: usersTable.displayName,
    }).from(challengeSubmissionsTable)
      .leftJoin(projectsTable, eq(challengeSubmissionsTable.projectId, projectsTable.id))
      .leftJoin(usersTable, eq(challengeSubmissionsTable.userId, usersTable.id))
      .where(eq(challengeSubmissionsTable.challengeId, challengeId))
      .orderBy(desc(challengeSubmissionsTable.createdAt));
    res.json(subs);
  } catch (err) {
    res.status(500).json({ error: "Failed to get submissions" });
  }
});

// POST /api/challenges/:id/submit
router.post("/challenges/:id/submit", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const challengeId = parseInt(String(req.params.id));
    const { projectId, note } = req.body;
    if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

    const [challenge] = await db.select().from(challengesTable).where(eq(challengesTable.id, challengeId)).limit(1);
    if (!challenge?.isActive) { res.status(400).json({ error: "Challenge not active" }); return; }

    const [project] = await db.select({ id: projectsTable.id }).from(projectsTable).where(
      and(eq(projectsTable.id, projectId), eq(projectsTable.userId, user.id))
    ).limit(1);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }

    const [sub] = await db.insert(challengeSubmissionsTable).values({
      challengeId, projectId, userId: user.id, note,
    }).returning();
    await db.update(challengesTable).set({ submissionCount: sql`submission_count + 1` }).where(eq(challengesTable.id, challengeId));
    res.status(201).json(sub);
  } catch (err) {
    res.status(500).json({ error: "Failed to submit to challenge" });
  }
});

// ── ADMIN ANALYTICS ───────────────────────────────────────────────────────────

// GET /api/admin/analytics
router.get("/admin/analytics", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim());
    if (!adminEmails.includes(user.email)) {
      res.status(403).json({ error: "Admin only" });
      return;
    }

    const [
      totalUsers, totalProjects, generationsToday, affiliateClicks,
      topProjects, conversionFunnel, clicksBySupplier,
    ] = await Promise.all([
      db.select({ count: sql<number>`count(*)::int` }).from(usersTable),
      db.select({
        total: sql<number>`count(*)::int`,
        ready: sql<number>`count(*) filter (where status = 'ready')::int`,
        generating: sql<number>`count(*) filter (where status = 'generating')::int`,
      }).from(projectsTable),
      db.select({ count: sql<number>`count(*)::int` }).from(projectsTable)
        .where(sql`created_at > now() - interval '24 hours'`),
      db.select({ count: sql<number>`count(*)::int` }).from(affiliateClicksTable),
      db.select({
        id: projectsTable.id,
        title: projectsTable.title,
        category: projectsTable.category,
      }).from(projectsTable)
        .where(eq(projectsTable.status, "ready"))
        .orderBy(desc(projectsTable.createdAt)).limit(10),
      db.select({
        tier: usersTable.tier,
        count: sql<number>`count(*)::int`,
      }).from(usersTable).groupBy(usersTable.tier),
      db.select({
        supplier: affiliateClicksTable.supplier,
        count: sql<number>`count(*)::int`,
      }).from(affiliateClicksTable).groupBy(affiliateClicksTable.supplier)
        .orderBy(sql`count(*) desc`).limit(10),
    ]);

    res.json({
      totalUsers: totalUsers[0]?.count ?? 0,
      totalProjects: totalProjects[0]?.total ?? 0,
      readyProjects: totalProjects[0]?.ready ?? 0,
      generationsToday: generationsToday[0]?.count ?? 0,
      totalAffiliateClicks: affiliateClicks[0]?.count ?? 0,
      topProjects,
      conversionFunnel: Object.fromEntries(conversionFunnel.map((r) => [r.tier, r.count])),
      clicksBySupplier,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get analytics" });
  }
});

// ── AFFILIATE EARNINGS ────────────────────────────────────────────────────────

// GET /api/affiliate/earnings
router.get("/affiliate/earnings", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const bySupplier = await db.select({
      supplier: affiliateClicksTable.supplier,
      clicks: sql<number>`count(*)::int`,
      estimatedCommission: sql<number>`count(*) * 0.04 * 15`, // rough estimate: ~$15 avg order, 4% commission
    }).from(affiliateClicksTable)
      .where(eq(affiliateClicksTable.userId, user.id))
      .groupBy(affiliateClicksTable.supplier)
      .orderBy(sql`count(*) desc`);

    const [totals] = await db.select({
      totalClicks: sql<number>`count(*)::int`,
    }).from(affiliateClicksTable).where(eq(affiliateClicksTable.userId, user.id));

    const topParts = await db.select({
      partName: affiliateClicksTable.partName,
      supplier: affiliateClicksTable.supplier,
      clicks: sql<number>`count(*)::int`,
    }).from(affiliateClicksTable)
      .where(eq(affiliateClicksTable.userId, user.id))
      .groupBy(affiliateClicksTable.partName, affiliateClicksTable.supplier)
      .orderBy(sql`count(*) desc`)
      .limit(10);

    res.json({
      totalClicks: totals?.totalClicks ?? 0,
      estimatedCommissions: bySupplier.reduce((s, r) => s + Number(r.estimatedCommission), 0).toFixed(2),
      bySupplier,
      topParts,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get affiliate earnings" });
  }
});

export default router;
