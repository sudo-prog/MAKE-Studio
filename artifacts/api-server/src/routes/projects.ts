import { Router } from "express";
import { db } from "@workspace/db";
import { projectsTable, chatMessagesTable } from "@workspace/db";
import { eq, and, desc, ilike, sql } from "drizzle-orm";
import { requireDbUser } from "../lib/auth";
import { ZipArchive } from "archiver";
import { nanoid } from "nanoid";

const router = Router();

// GET /api/projects
router.get("/projects", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const page = parseInt(String(req.query.page ?? "1"));
    const limit = Math.min(parseInt(String(req.query.limit ?? "20")), 50);
    const search = String(req.query.search ?? "");
    const offset = (page - 1) * limit;

    const conditions = [eq(projectsTable.userId, user.id)];
    if (search) {
      conditions.push(ilike(projectsTable.title, `%${search}%`));
    }

    const [items, countResult] = await Promise.all([
      db.select({
        id: projectsTable.id,
        title: projectsTable.title,
        status: projectsTable.status,
        renderImageUrl: projectsTable.renderImageUrl,
        category: projectsTable.category,
        estimatedCost: projectsTable.estimatedCost,
        createdAt: projectsTable.createdAt,
        updatedAt: projectsTable.updatedAt,
      }).from(projectsTable)
        .where(and(...conditions))
        .orderBy(desc(projectsTable.updatedAt))
        .limit(limit)
        .offset(offset),
      db.select({ count: sql<number>`count(*)::int` }).from(projectsTable).where(and(...conditions)),
    ]);

    res.json({
      items,
      total: countResult[0]?.count ?? 0,
      page,
      limit,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to list projects" });
  }
});

// POST /api/projects
router.post("/projects", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const { title, prompt, category, skillLevel } = req.body;
    if (!title || !prompt) { res.status(400).json({ error: "title and prompt required" }); return; }
    const [project] = await db.insert(projectsTable).values({
      userId: user.id,
      title,
      prompt,
      category: category ?? null,
      skillLevel: skillLevel ?? null,
      status: "draft",
    }).returning();
    res.status(201).json(formatProject(project));
  } catch (err) {
    res.status(500).json({ error: "Failed to create project" });
  }
});

// GET /api/projects/:id
router.get("/projects/:id", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const id = parseInt(String(req.params.id));
    const [project] = await db.select().from(projectsTable).where(
      and(eq(projectsTable.id, id), eq(projectsTable.userId, user.id))
    ).limit(1);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    res.json(formatProjectFull(project));
  } catch (err) {
    res.status(500).json({ error: "Failed to get project" });
  }
});

// PATCH /api/projects/:id
router.patch("/projects/:id", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const id = parseInt(String(req.params.id));
    const { title, isPublic, category } = req.body;
    const updates: Record<string, any> = { updatedAt: new Date() };
    if (title !== undefined) updates.title = title;
    if (isPublic !== undefined) updates.isPublic = isPublic;
    if (category !== undefined) updates.category = category;
    const [updated] = await db.update(projectsTable).set(updates).where(
      and(eq(projectsTable.id, id), eq(projectsTable.userId, user.id))
    ).returning();
    if (!updated) { res.status(404).json({ error: "Project not found" }); return; }
    res.json(formatProjectFull(updated));
  } catch (err) {
    res.status(500).json({ error: "Failed to update project" });
  }
});

// DELETE /api/projects/:id
router.delete("/projects/:id", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const id = parseInt(String(req.params.id));
    await db.delete(projectsTable).where(
      and(eq(projectsTable.id, id), eq(projectsTable.userId, user.id))
    );
    res.status(204).send();
  } catch (err) {
    res.status(500).json({ error: "Failed to delete project" });
  }
});

// GET /api/projects/:id/sections
router.get("/projects/:id/sections", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const id = parseInt(String(req.params.id));
    const [project] = await db.select().from(projectsTable).where(
      and(eq(projectsTable.id, id), eq(projectsTable.userId, user.id))
    ).limit(1);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    res.json(formatSections(project));
  } catch (err) {
    res.status(500).json({ error: "Failed to get sections" });
  }
});

// GET /api/projects/:id/messages
router.get("/projects/:id/messages", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const id = parseInt(String(req.params.id));
    const [project] = await db.select({ id: projectsTable.id }).from(projectsTable).where(
      and(eq(projectsTable.id, id), eq(projectsTable.userId, user.id))
    ).limit(1);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    const messages = await db.select().from(chatMessagesTable)
      .where(eq(chatMessagesTable.projectId, id))
      .orderBy(chatMessagesTable.createdAt);
    res.json(messages);
  } catch (err) {
    res.status(500).json({ error: "Failed to get messages" });
  }
});

// POST /api/projects/:id/messages
router.post("/projects/:id/messages", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const id = parseInt(String(req.params.id));
    const { content, section } = req.body;
    if (!content) { res.status(400).json({ error: "content required" }); return; }

    const [project] = await db.select().from(projectsTable).where(
      and(eq(projectsTable.id, id), eq(projectsTable.userId, user.id))
    ).limit(1);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }

    const [userMsg] = await db.insert(chatMessagesTable).values({
      projectId: id,
      role: "user",
      content,
      section: section ?? null,
    }).returning();

    // Generate AI response in background
    const { generateChatResponse } = await import("../lib/ai.js");
    const history = await db.select().from(chatMessagesTable)
      .where(eq(chatMessagesTable.projectId, id))
      .orderBy(chatMessagesTable.createdAt);
    
    const projectContext = `Project: "${project.title}". Prompt: "${project.prompt}".`;
    const aiContent = await generateChatResponse(
      projectContext,
      content,
      history.slice(-10).map((m) => ({ role: m.role, content: m.content }))
    ).catch(() => "I'm here to help! Please ensure your AI API key is configured to get AI responses.");

    await db.insert(chatMessagesTable).values({
      projectId: id,
      role: "assistant",
      content: aiContent,
      section: section ?? null,
    });

    res.status(201).json(userMsg);
  } catch (err) {
    res.status(500).json({ error: "Failed to add message" });
  }
});

// GET /api/share/:slug/export — public export by share slug (no auth)
router.get("/share/:slug/export", async (req, res) => {
  try {
    const slug = String(req.params.slug);
    const [project] = await db.select().from(projectsTable).where(
      and(eq(projectsTable.shareSlug, slug), eq(projectsTable.isPublic, true))
    ).limit(1);
    if (!project) { res.status(404).json({ error: "Project not found or not public" }); return; }

    const slugTitle = project.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${slugTitle}-makerforge.zip"`);

    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.pipe(res);
    const sections = formatSections(project);
    archive.append(
      `# ${project.title}\n\n${project.description ?? ""}\n\nGenerated by MakerForge\n\n## DISCLAIMER\nThis design is for educational/inspirational purposes only. Verify all designs before fabrication.`,
      { name: "README.md" }
    );
    if (sections.mechanical?.openScadCode) {
      archive.append(sections.mechanical.openScadCode, { name: `${slugTitle}.scad` });
    }
    if (sections.buildGuide) {
      const steps = sections.buildGuide.steps?.map((s: any) => `## Step ${s.stepNumber}: ${s.title}\n\n${s.description}${s.warning ? `\n\n⚠️ ${s.warning}` : ""}`).join("\n\n") ?? "";
      archive.append(`# Build Guide: ${project.title}\n\n${steps}`, { name: "build-guide.md" });
    }
    if (sections.bom?.tiers?.balanced) {
      const header = "Name,Quantity,Unit,Price,Supplier,Part Number\n";
      const rows = sections.bom.tiers.balanced.map((i: any) => `"${i.name}",${i.quantity},${i.unit},${i.estimatedPrice},"${i.supplier ?? ""}","${i.partNumber ?? ""}"`).join("\n");
      archive.append(header + rows, { name: "bom-balanced.csv" });
    }
    if (sections.electronics) {
      archive.append(`# Electronics Guide\n\n${sections.electronics.schematicDescription ?? ""}\n\n## Wiring\n\n\`\`\`\n${sections.electronics.wiringDiagram ?? ""}\n\`\`\``, { name: "electronics-guide.md" });
    }
    await archive.finalize();
  } catch (err) {
    res.status(500).json({ error: "Failed to export project" });
  }
});

// GET /api/projects/:id/export
router.get("/projects/:id/export", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const id = parseInt(String(req.params.id));
    const [project] = await db.select().from(projectsTable).where(
      and(eq(projectsTable.id, id), eq(projectsTable.userId, user.id))
    ).limit(1);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }

    const slugTitle = project.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    res.setHeader("Content-Type", "application/zip");
    res.setHeader("Content-Disposition", `attachment; filename="${slugTitle}-makerforge.zip"`);

    const archive = new ZipArchive({ zlib: { level: 9 } });
    archive.pipe(res);

    const sections = formatSections(project);
    archive.append(
      `# ${project.title}\n\n${project.description ?? ""}\n\nGenerated by MakerForge\n\n## DISCLAIMER\nThis design is for educational/inspirational purposes only. Verify all designs before fabrication.`,
      { name: "README.md" }
    );
    if (sections.mechanical?.openScadCode) {
      archive.append(sections.mechanical.openScadCode, { name: `${slugTitle}.scad` });
    }
    if (sections.buildGuide) {
      const steps = sections.buildGuide.steps?.map((s: any) => `## Step ${s.stepNumber}: ${s.title}\n\n${s.description}${s.warning ? `\n\n⚠️ ${s.warning}` : ""}`).join("\n\n") ?? "";
      archive.append(`# Build Guide: ${project.title}\n\n**Estimated Time:** ${sections.buildGuide.estimatedTime ?? "N/A"}\n**Estimated Cost:** $${sections.buildGuide.estimatedCost ?? "N/A"}\n\n## Tools Required\n${(sections.buildGuide.toolsList ?? []).map((t: string) => `- ${t}`).join("\n")}\n\n${steps}\n\n## Troubleshooting\n\n${sections.buildGuide.troubleshooting ?? ""}`, { name: "build-guide.md" });
    }
    if (sections.bom?.tiers?.balanced) {
      const header = "Name,Quantity,Unit,Price,Supplier,Part Number\n";
      const rows = sections.bom.tiers.balanced.map((i: any) => `"${i.name}",${i.quantity},${i.unit},${i.estimatedPrice},"${i.supplier ?? ""}","${i.partNumber ?? ""}"`).join("\n");
      archive.append(header + rows, { name: "bom-balanced.csv" });
    }
    if (sections.electronics) {
      archive.append(`# Electronics Guide\n\n## Schematic\n\n${sections.electronics.schematicDescription ?? ""}\n\n## Wiring Diagram\n\n\`\`\`\n${sections.electronics.wiringDiagram ?? ""}\n\`\`\`\n\n## Power Calculations\n\n${sections.electronics.powerCalcs ?? ""}`, { name: "electronics-guide.md" });
    }
    if (sections.educationPack) {
      archive.append(`# Lesson Plan: ${project.title}\n\n${sections.educationPack.lessonPlan ?? ""}\n\n## Student Worksheet\n\n${sections.educationPack.worksheetMarkdown ?? ""}`, { name: "education-pack.md" });
    }

    // STL generation instructions
    const scadFile = sections.mechanical?.openScadCode ? `${slugTitle}.scad` : "your-design.scad";
    archive.append(
      `# How to Generate STL from OpenSCAD\n\n` +
      `Your project package includes an OpenSCAD source file (\`${scadFile}\`). ` +
      `Follow these steps to export a printable STL:\n\n` +
      `## Option A — OpenSCAD Desktop App (Recommended)\n` +
      `1. Download OpenSCAD from https://openscad.org/downloads.html\n` +
      `2. Open \`${scadFile}\` in OpenSCAD\n` +
      `3. Press **F6** (or Design → Render) to compile the geometry\n` +
      `4. Go to **File → Export → Export as STL…** and save the \`.stl\` file\n` +
      `5. Slice the STL in your preferred slicer (Cura, PrusaSlicer, Bambu Studio)\n\n` +
      `## Option B — Command Line\n` +
      `\`\`\`bash\n` +
      `openscad -o output.stl ${scadFile}\n` +
      `\`\`\`\n\n` +
      `## Option C — Online (no install)\n` +
      `Visit https://www.openscad.org/index.html#try-openscad and paste the code.\n\n` +
      `## Recommended Print Settings\n` +
      `${sections.mechanical?.printSettings ?? "See the build guide for recommended print settings."}\n`,
      { name: "stl-generation-instructions.md" }
    );

    // KiCad electronics package instructions
    if (sections.electronics) {
      archive.append(
        `# KiCad Electronics Package — ${project.title}\n\n` +
        `This package includes an electronics guide with schematic description, wiring diagram, ` +
        `and power calculations. To create a full KiCad project:\n\n` +
        `## Getting Started with KiCad\n` +
        `1. Download KiCad from https://www.kicad.org/download/\n` +
        `2. Create a new project: **File → New Project**\n` +
        `3. Open the Schematic Editor (Eeschema)\n\n` +
        `## Schematic Overview\n` +
        `${sections.electronics.schematicDescription ?? ""}\n\n` +
        `## Wiring Connections\n` +
        `\`\`\`\n${sections.electronics.wiringDiagram ?? ""}\n\`\`\`\n\n` +
        `## Power Budget\n` +
        `${sections.electronics.powerCalcs ?? ""}\n\n` +
        `## Recommended KiCad Libraries\n` +
        `- Device — resistors, capacitors, connectors\n` +
        `- MCU_Microchip_ATmega — Arduino-compatible MCUs\n` +
        `- MCU_Espressif — ESP32 / ESP8266 modules\n` +
        `- Connector_PinHeader_2.54mm — standard pin headers\n` +
        `- Power — VCC, GND, +3.3V, +5V symbols\n\n` +
        `## PCB Manufacturing\n` +
        `After completing the schematic and PCB layout, export Gerber files via:\n` +
        `**File → Fabrication Outputs → Gerbers (.gbr)**\n` +
        `Upload to JLCPCB (https://jlcpcb.com) or PCBWay for fabrication.\n`,
        { name: "kicad-electronics-package.md" }
      );
    }

    await archive.finalize();
  } catch (err) {
    res.status(500).json({ error: "Failed to export project" });
  }
});

// POST /api/projects/:id/share
router.post("/projects/:id/share", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const id = parseInt(String(req.params.id));
    const [project] = await db.select().from(projectsTable).where(
      and(eq(projectsTable.id, id), eq(projectsTable.userId, user.id))
    ).limit(1);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }
    
    let slug = project.shareSlug;
    if (!slug) {
      slug = nanoid(10);
      await db.update(projectsTable).set({ shareSlug: slug, isPublic: true, updatedAt: new Date() }).where(eq(projectsTable.id, id));
    }
    const host = req.get("host") ?? "makerforge.app";
    res.json({ slug, url: `https://${host}/share/${slug}` });
  } catch (err) {
    res.status(500).json({ error: "Failed to share project" });
  }
});

function formatProject(p: typeof projectsTable.$inferSelect) {
  return {
    id: p.id,
    title: p.title,
    status: p.status,
    renderImageUrl: p.renderImageUrl,
    category: p.category,
    estimatedCost: p.estimatedCost ? Number(p.estimatedCost) : null,
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function formatProjectFull(p: typeof projectsTable.$inferSelect) {
  return {
    id: p.id,
    title: p.title,
    prompt: p.prompt,
    description: p.description,
    status: p.status,
    isPublic: p.isPublic,
    shareSlug: p.shareSlug,
    renderImageUrl: p.renderImageUrl,
    category: p.category,
    skillLevel: p.skillLevel,
    estimatedCost: p.estimatedCost ? Number(p.estimatedCost) : null,
    estimatedTime: p.estimatedTime,
    sections: formatSections(p),
    createdAt: p.createdAt,
    updatedAt: p.updatedAt,
  };
}

function formatSections(p: typeof projectsTable.$inferSelect) {
  return {
    mechanical: p.mechanicalSection as any,
    electronics: p.electronicsSection as any,
    bom: p.bomSection as any,
    buildGuide: p.buildGuideSection as any,
    educationPack: p.educationSection as any,
    safety: p.safetySection as any,
  };
}

export default router;
