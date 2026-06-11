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

// POST /api/challenges/:id/submissions/:subId/winner — admin marks a submission as winner
router.post("/challenges/:id/submissions/:subId/winner", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const adminEmails = (process.env.ADMIN_EMAILS ?? "").split(",").map((e) => e.trim());
    if (!adminEmails.includes(user.email)) { res.status(403).json({ error: "Admin only" }); return; }

    const challengeId = parseInt(String(req.params.id));
    const subId = parseInt(String(req.params.subId));

    // Clear previous winners for this challenge
    await db.update(challengeSubmissionsTable).set({ isWinner: false })
      .where(eq(challengeSubmissionsTable.challengeId, challengeId));
    // Set new winner
    await db.update(challengeSubmissionsTable).set({ isWinner: true })
      .where(and(eq(challengeSubmissionsTable.id, subId), eq(challengeSubmissionsTable.challengeId, challengeId)));
    // Update challenge.winnerId
    const [sub] = await db.select({ userId: challengeSubmissionsTable.userId, projectId: challengeSubmissionsTable.projectId })
      .from(challengeSubmissionsTable).where(eq(challengeSubmissionsTable.id, subId)).limit(1);
    if (sub) {
      await db.update(challengesTable).set({ winnerId: sub.userId, isActive: false }).where(eq(challengesTable.id, challengeId));
    }
    res.json({ ok: true, winnerId: sub?.userId });
  } catch (err) {
    res.status(500).json({ error: "Failed to set winner" });
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

// ── SHOWCASE MEDIA UPLOAD ─────────────────────────────────────────────────────

// POST /api/showcase/upload — accept base64-encoded image/video and return an accessible URL
// For simplicity, stores the data inline as a data URL (suitable for small images).
// Production deployments should swap this for object storage (e.g., Replit App Storage).
router.post("/showcase/upload", requireDbUser, async (req, res) => {
  try {
    const { filename, content, mediaType } = req.body;
    if (!content) { res.status(400).json({ error: "content (base64) required" }); return; }

    const ext = (filename ?? "file").split(".").pop()?.toLowerCase() ?? "jpg";
    const mimeMap: Record<string, string> = {
      jpg: "image/jpeg", jpeg: "image/jpeg", png: "image/png",
      gif: "image/gif", webp: "image/webp", mp4: "video/mp4", webm: "video/webm",
    };
    const mime = mimeMap[ext] ?? (mediaType === "video" ? "video/mp4" : "image/jpeg");
    const dataUrl = `data:${mime};base64,${content}`;
    res.json({ url: dataUrl, mediaType: mime.startsWith("video") ? "video" : "image" });
  } catch (err) {
    res.status(500).json({ error: "Upload failed" });
  }
});

// ── EDUCATION EXPORT ──────────────────────────────────────────────────────────

// GET /api/projects/:id/education-export — HTML formatted for print-to-PDF
// Requires auth. Accessible only if the requesting user owns the project OR the project is public.
router.get("/projects/:id/education-export", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser as { id: number };
    const projectId = parseInt(String(req.params.id));
    const [project] = await db.select({
      userId: projectsTable.userId,
      title: projectsTable.title,
      description: projectsTable.description,
      category: projectsTable.category,
      skillLevel: projectsTable.skillLevel,
      estimatedTime: projectsTable.estimatedTime,
      educationSection: projectsTable.educationSection,
      buildGuideSection: projectsTable.buildGuideSection,
      isPublic: projectsTable.isPublic,
    }).from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);

    if (!project) { res.status(404).send("Not found"); return; }
    // Access control: owner OR public project
    if (project.userId !== user.id && !project.isPublic) {
      res.status(403).send("Forbidden"); return;
    }

    const edu = project.educationSection as any ?? {};
    const guide = project.buildGuideSection as any ?? {};
    const title = (project.title ?? "Untitled").replace(/</g, "&lt;").replace(/>/g, "&gt;");

    const html = `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8"/>
  <title>${title} — Education Export</title>
  <style>
    body{font-family:Georgia,serif;max-width:800px;margin:40px auto;padding:0 20px;color:#111;line-height:1.6}
    h1{font-size:2em;border-bottom:3px solid #10b981;padding-bottom:.4em;color:#064e3b}
    h2{font-size:1.3em;color:#065f46;margin-top:2em;border-left:4px solid #10b981;padding-left:.6em}
    h3{color:#047857}
    .meta{background:#f0fdf4;border:1px solid #bbf7d0;border-radius:8px;padding:16px;margin:1em 0}
    .meta span{display:inline-block;margin-right:1em;font-size:.9em;color:#374151}
    .section{background:#fafafa;border:1px solid #e5e7eb;border-radius:8px;padding:16px;margin:1.5em 0}
    .worksheet{border:2px dashed #6b7280;border-radius:8px;padding:16px;margin:1em 0}
    .answer-line{border-bottom:1px solid #9ca3af;margin:12px 0;min-height:28px}
    pre{background:#1f2937;color:#f9fafb;border-radius:6px;padding:12px;overflow-x:auto;font-size:.8em}
    .print-btn{position:fixed;top:16px;right:16px;background:#10b981;color:#fff;border:none;border-radius:8px;padding:10px 20px;font-size:1em;cursor:pointer;box-shadow:0 2px 8px rgba(0,0,0,.2)}
    @media print{body{margin:0}.print-btn{display:none}pre{white-space:pre-wrap}}
  </style>
</head>
<body>
  <button class="print-btn" onclick="window.print()">🖨 Print / Save PDF</button>
  <h1>📐 ${title}</h1>
  <div class="meta">
    <span>📚 <strong>Category:</strong> ${(project.category ?? "").replace(/</g,"&lt;")}</span>
    <span>🎯 <strong>Skill Level:</strong> ${(project.skillLevel ?? "").replace(/</g,"&lt;")}</span>
    <span>⏱ <strong>Estimated Time:</strong> ${(project.estimatedTime ?? "N/A").replace(/</g,"&lt;")}</span>
  </div>
  ${project.description ? `<p>${project.description.replace(/</g,"&lt;")}</p>` : ""}

  ${edu.lessonPlan ? `<h2>📖 Lesson Plan</h2><div class="section">${edu.lessonPlan.replace(/\n/g,"<br/>").replace(/</g,"&lt;")}</div>` : ""}
  ${edu.learningObjectives ? `<h2>🎯 Learning Objectives</h2><ul>${(Array.isArray(edu.learningObjectives) ? edu.learningObjectives : [edu.learningObjectives]).map((o: string) => `<li>${String(o).replace(/</g,"&lt;")}</li>`).join("")}</ul>` : ""}
  ${edu.ngssStandards ? `<h2>📋 NGSS Standards</h2><div class="section">${(Array.isArray(edu.ngssStandards) ? edu.ngssStandards.join(", ") : String(edu.ngssStandards)).replace(/</g,"&lt;")}</div>` : ""}
  ${edu.teacherNotes ? `<h2>👩‍🏫 Teacher Notes</h2><div class="section">${edu.teacherNotes.replace(/\n/g,"<br/>").replace(/</g,"&lt;")}</div>` : ""}

  <h2>📝 Student Worksheet</h2>
  <div class="worksheet">
    <p><strong>Name:</strong> <span class="answer-line"></span> &nbsp;&nbsp; <strong>Date:</strong> <span class="answer-line"></span></p>
    ${edu.worksheetMarkdown ? edu.worksheetMarkdown.replace(/\n/g,"<br/>").replace(/</g,"&lt;") : `
    <p><strong>Question 1:</strong> What engineering challenge does this project solve?</p>
    <div class="answer-line"></div><div class="answer-line"></div>
    <p><strong>Question 2:</strong> What materials or components are needed?</p>
    <div class="answer-line"></div><div class="answer-line"></div>
    <p><strong>Question 3:</strong> What safety precautions must you take?</p>
    <div class="answer-line"></div><div class="answer-line"></div>
    <p><strong>Reflection:</strong> What would you change if you built it again?</p>
    <div class="answer-line"></div><div class="answer-line"></div>
    `}
  </div>

  ${guide.steps && Array.isArray(guide.steps) ? `<h2>🔨 Build Steps (Teacher Reference)</h2><ol>${guide.steps.map((s: any) => `<li><strong>${String(s.title ?? "").replace(/</g,"&lt;")}</strong>: ${String(s.description ?? "").replace(/</g,"&lt;")}</li>`).join("")}</ol>` : ""}

  <hr style="margin-top:3em;border-color:#e5e7eb"/>
  <p style="font-size:.8em;color:#6b7280">Generated by MakerForge — AI-powered hardware project builder. For educational use only. Verify all designs before fabrication.</p>
</body>
</html>`;

    res.setHeader("Content-Type", "text/html; charset=utf-8");
    res.setHeader("Content-Disposition", `inline; filename="${encodeURIComponent(project.title ?? "education-export")}.html"`);
    res.send(html);
  } catch (err) {
    res.status(500).send("Export failed");
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

// ── SHARE CARD (OG metadata + affiliate highlights + SVG image) ───────────────

// GET /api/projects/:id/share-card.svg — rendered social card image
router.get("/projects/:id/share-card.svg", async (req, res) => {
  try {
    const projectId = parseInt(String(req.params.id));
    const [project] = await db.select({
      title: projectsTable.title,
      category: projectsTable.category,
      skillLevel: projectsTable.skillLevel,
      estimatedCost: projectsTable.estimatedCost,
      estimatedTime: projectsTable.estimatedTime,
      isPublic: projectsTable.isPublic,
    }).from(projectsTable).where(eq(projectsTable.id, projectId)).limit(1);

    if (!project || !project.isPublic) {
      res.status(404).send("Not found");
      return;
    }

    const title = (project.title ?? "Untitled Project").replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
    const category = (project.category ?? "").replace(/&/g, "&amp;");
    const skill = (project.skillLevel ?? "").replace(/&/g, "&amp;");
    const cost = project.estimatedCost ? `$${project.estimatedCost}` : "";
    const time = project.estimatedTime ?? "";

    const truncatedTitle = title.length > 48 ? title.slice(0, 47) + "…" : title;

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" width="1200" height="630" viewBox="0 0 1200 630">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" style="stop-color:#0a0a0a"/>
      <stop offset="100%" style="stop-color:#111827"/>
    </linearGradient>
    <linearGradient id="accent" x1="0%" y1="0%" x2="100%" y2="0%">
      <stop offset="0%" style="stop-color:#10b981"/>
      <stop offset="100%" style="stop-color:#34d399"/>
    </linearGradient>
  </defs>
  <rect width="1200" height="630" fill="url(#bg)"/>
  <rect x="0" y="0" width="6" height="630" fill="url(#accent)"/>
  <rect x="60" y="60" width="160" height="36" rx="8" fill="#10b981" opacity="0.15"/>
  <text x="80" y="84" font-family="system-ui,sans-serif" font-size="18" font-weight="700" fill="#10b981">MakerForge</text>
  <text x="60" y="200" font-family="system-ui,sans-serif" font-size="64" font-weight="800" fill="#f9fafb" letter-spacing="-2">${truncatedTitle}</text>
  <line x1="60" y1="240" x2="300" y2="240" stroke="#10b981" stroke-width="3"/>
  ${category ? `<rect x="60" y="270" width="${category.length * 12 + 24}" height="32" rx="16" fill="#10b981" opacity="0.2"/>
  <text x="72" y="292" font-family="system-ui,sans-serif" font-size="16" fill="#34d399">${category}</text>` : ""}
  ${skill ? `<rect x="${category ? category.length * 12 + 24 + 76 : 60}" y="270" width="${skill.length * 11 + 24}" height="32" rx="16" fill="#6366f1" opacity="0.2"/>
  <text x="${category ? category.length * 12 + 24 + 88 : 72}" y="292" font-family="system-ui,sans-serif" font-size="16" fill="#818cf8">${skill}</text>` : ""}
  <text x="60" y="520" font-family="system-ui,sans-serif" font-size="22" fill="#9ca3af">AI-powered hardware project builder</text>
  ${cost ? `<text x="1140" y="520" font-family="system-ui,sans-serif" font-size="28" font-weight="700" fill="#10b981" text-anchor="end">${cost}</text>` : ""}
  ${time ? `<text x="1140" y="555" font-family="system-ui,sans-serif" font-size="18" fill="#6b7280" text-anchor="end">${time}</text>` : ""}
  <rect x="60" y="560" width="1080" height="1" fill="#1f2937"/>
  <text x="60" y="600" font-family="system-ui,sans-serif" font-size="18" fill="#4b5563">makerforge.app</text>
</svg>`;

    res.setHeader("Content-Type", "image/svg+xml");
    res.setHeader("Cache-Control", "public, max-age=3600");
    res.send(svg);
  } catch (err) {
    res.status(500).send("Error generating card");
  }
});

// GET /api/projects/:id/share-card
router.get("/projects/:id/share-card", async (req, res) => {
  try {
    const projectId = parseInt(String(req.params.id));
    const [project] = await db.select().from(projectsTable).where(
      eq(projectsTable.id, projectId)
    ).limit(1);
    if (!project || !project.isPublic) {
      res.status(404).json({ error: "Project not found or not public" });
      return;
    }

    const shareUrl = project.shareSlug
      ? `${process.env.APP_BASE_URL ?? ""}/share/${project.shareSlug}`
      : `${process.env.APP_BASE_URL ?? ""}/projects/${project.id}`;

    // Extract top BOM items with affiliate links for sharing
    const bom = project.bomSection as any;
    const items: any[] = bom?.tiers?.balanced ?? bom?.tiers?.budget ?? [];
    const affiliateHighlights = items.slice(0, 5).map((item: any) => ({
      name: item.name,
      supplier: item.supplier ?? "Amazon",
      price: item.estimatedPrice,
      affiliateUrl: item.affiliateUrl ?? null,
    }));

    const ogImageUrl = `${process.env.APP_BASE_URL ?? ""}/api/projects/${project.id}/share-card.svg`;

    res.json({
      title: project.title,
      description: project.description ?? project.prompt?.slice(0, 200),
      category: project.category,
      skillLevel: project.skillLevel,
      estimatedCost: project.estimatedCost,
      estimatedTime: project.estimatedTime,
      shareUrl,
      tags: [project.category, project.skillLevel].filter(Boolean),
      affiliateHighlights,
      ogImageUrl,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get share card" });
  }
});

export default router;
