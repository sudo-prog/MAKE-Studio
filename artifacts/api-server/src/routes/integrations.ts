import { Router } from "express";
import { db } from "@workspace/db";
import {
  connectedAccountsTable, projectsTable, usersTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireDbUser } from "../lib/auth";

const router = Router();

// ── GitHub OAuth ─────────────────────────────────────────────────────────────

// GET /api/integrations/github/connect — redirect to GitHub OAuth
router.get("/integrations/github/connect", requireDbUser, (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    res.status(501).json({ error: "GitHub OAuth not configured (GITHUB_CLIENT_ID missing)" });
    return;
  }
  const state = encodeURIComponent(JSON.stringify({ userId: (req as any).dbUser.id }));
  const redirectUri = `${req.protocol}://${req.get("host")}/api/integrations/github/callback`;
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo&state=${state}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  res.redirect(url);
});

// GET /api/integrations/github/callback
router.get("/integrations/github/callback", async (req, res) => {
  try {
    const code = String(req.query.code ?? "");
    const stateRaw = String(req.query.state ?? "{}");
    const { userId } = JSON.parse(decodeURIComponent(stateRaw));

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret || !code) {
      res.status(400).json({ error: "Invalid OAuth callback" });
      return;
    }

    const tokenRes = await fetch("https://github.com/login/oauth/access_token", {
      method: "POST",
      headers: { "Content-Type": "application/json", Accept: "application/json" },
      body: JSON.stringify({ client_id: clientId, client_secret: clientSecret, code }),
    });
    const tokenData = await tokenRes.json() as any;
    const accessToken = tokenData?.access_token;
    if (!accessToken) { res.status(400).json({ error: "Failed to get GitHub token" }); return; }

    // Fetch GitHub user info
    const ghUser = await fetch("https://api.github.com/user", {
      headers: { Authorization: `Bearer ${accessToken}`, "User-Agent": "MakerForge" },
    }).then((r) => r.json()) as any;

    await db.insert(connectedAccountsTable).values({
      userId,
      provider: "github",
      accessToken,
      metadata: JSON.stringify({ login: ghUser.login, avatarUrl: ghUser.avatar_url }),
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: [connectedAccountsTable.userId, connectedAccountsTable.provider],
      set: { accessToken, metadata: JSON.stringify({ login: ghUser.login }), updatedAt: new Date() },
    });

    await db.update(usersTable).set({ githubConnected: true }).where(eq(usersTable.id, userId));

    const base = process.env.APP_BASE_URL ?? "";
    res.redirect(`${base}/integrations?github=connected`);
  } catch (err) {
    res.status(500).json({ error: "GitHub OAuth failed" });
  }
});

// POST /api/integrations/github/push — push project files to a GitHub repo
router.post("/integrations/github/push", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const { projectId, repoName, createNew } = req.body;
    if (!projectId) { res.status(400).json({ error: "projectId required" }); return; }

    const [account] = await db.select().from(connectedAccountsTable).where(
      and(eq(connectedAccountsTable.userId, user.id), eq(connectedAccountsTable.provider, "github"))
    ).limit(1);
    if (!account?.accessToken) { res.status(401).json({ error: "GitHub not connected" }); return; }

    const meta = JSON.parse(account.metadata ?? "{}");
    const login = meta.login as string;
    const token = account.accessToken;
    const headers = { Authorization: `Bearer ${token}`, "User-Agent": "MakerForge", "Content-Type": "application/json" };

    const [project] = await db.select().from(projectsTable).where(
      and(eq(projectsTable.id, projectId), eq(projectsTable.userId, user.id))
    ).limit(1);
    if (!project) { res.status(404).json({ error: "Project not found" }); return; }

    const slugTitle = project.title.toLowerCase().replace(/[^a-z0-9]+/g, "-");
    const repo = repoName ?? `makerforge-${slugTitle}`;

    // Create repo if requested
    if (createNew) {
      await fetch("https://api.github.com/user/repos", {
        method: "POST", headers,
        body: JSON.stringify({ name: repo, description: project.description ?? project.title, private: false, auto_init: true }),
      });
      await new Promise((r) => setTimeout(r, 1500)); // wait for GitHub to init
    }

    // Push files
    const filesToPush: { path: string; content: string }[] = [];
    const mech = project.mechanicalSection as any;
    if (mech?.openScadCode) filesToPush.push({ path: `${slugTitle}.scad`, content: mech.openScadCode });

    const bom = project.bomSection as any;
    if (bom?.tiers?.balanced) {
      const header = "Name,Quantity,Unit,Price,Supplier\n";
      const rows = (bom.tiers.balanced as any[]).map((i: any) => `"${i.name}",${i.quantity},${i.unit},${i.estimatedPrice},"${i.supplier ?? ""}"`).join("\n");
      filesToPush.push({ path: "bom.csv", content: header + rows });
    }

    const guide = project.buildGuideSection as any;
    if (guide?.steps) {
      const steps = (guide.steps as any[]).map((s: any) => `## Step ${s.stepNumber}: ${s.title}\n\n${s.description}`).join("\n\n");
      filesToPush.push({ path: "build-guide.md", content: `# Build Guide: ${project.title}\n\n${steps}` });
    }

    filesToPush.push({
      path: "README.md",
      content: `# ${project.title}\n\n${project.description ?? ""}\n\nGenerated with [MakerForge](https://makerforge.app)\n\n## Files\n${filesToPush.map((f) => `- \`${f.path}\``).join("\n")}`,
    });

    const pushResults: string[] = [];
    for (const file of filesToPush) {
      const existing = await fetch(`https://api.github.com/repos/${login}/${repo}/contents/${file.path}`, { headers });
      const existingData = existing.ok ? await existing.json() as any : null;
      const body: any = {
        message: `MakerForge: update ${file.path}`,
        content: Buffer.from(file.content).toString("base64"),
      };
      if (existingData?.sha) body.sha = existingData.sha;
      const pushRes = await fetch(`https://api.github.com/repos/${login}/${repo}/contents/${file.path}`, {
        method: "PUT", headers, body: JSON.stringify(body),
      });
      if (pushRes.ok) pushResults.push(file.path);
    }

    res.json({ ok: true, repoUrl: `https://github.com/${login}/${repo}`, pushedFiles: pushResults });
  } catch (err) {
    res.status(500).json({ error: "Failed to push to GitHub" });
  }
});

// GET /api/integrations/github/status
router.get("/integrations/github/status", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const [account] = await db.select().from(connectedAccountsTable).where(
      and(eq(connectedAccountsTable.userId, user.id), eq(connectedAccountsTable.provider, "github"))
    ).limit(1);
    if (!account) { res.json({ connected: false }); return; }
    const meta = JSON.parse(account.metadata ?? "{}");
    res.json({ connected: true, login: meta.login });
  } catch (err) {
    res.status(500).json({ error: "Failed to get GitHub status" });
  }
});

// POST /api/integrations/github/disconnect
router.post("/integrations/github/disconnect", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    await db.delete(connectedAccountsTable).where(
      and(eq(connectedAccountsTable.userId, user.id), eq(connectedAccountsTable.provider, "github"))
    );
    await db.update(usersTable).set({ githubConnected: false }).where(eq(usersTable.id, user.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to disconnect GitHub" });
  }
});

// ── OctoPrint ─────────────────────────────────────────────────────────────────

// POST /api/integrations/octoprint/connect — save IP + API key
router.post("/integrations/octoprint/connect", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const { octoprintUrl, apiKey } = req.body;
    if (!octoprintUrl || !apiKey) { res.status(400).json({ error: "octoprintUrl and apiKey required" }); return; }

    // Validate connectivity
    const testRes = await fetch(`${octoprintUrl}/api/version`, {
      headers: { "X-Api-Key": apiKey },
    }).catch(() => null);
    if (!testRes?.ok) { res.status(400).json({ error: "Cannot reach OctoPrint at that URL. Check the URL and API key." }); return; }

    await db.insert(connectedAccountsTable).values({
      userId: user.id,
      provider: "octoprint",
      accessToken: apiKey,
      metadata: JSON.stringify({ octoprintUrl }),
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: [connectedAccountsTable.userId, connectedAccountsTable.provider],
      set: { accessToken: apiKey, metadata: JSON.stringify({ octoprintUrl }), updatedAt: new Date() },
    });
    await db.update(usersTable).set({ octoprintConnected: true }).where(eq(usersTable.id, user.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to connect OctoPrint" });
  }
});

// POST /api/integrations/octoprint/upload — send GCODE/STL to OctoPrint
router.post("/integrations/octoprint/upload", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const { filename, content } = req.body; // content: base64-encoded file
    if (!filename || !content) { res.status(400).json({ error: "filename and content required" }); return; }

    const [account] = await db.select().from(connectedAccountsTable).where(
      and(eq(connectedAccountsTable.userId, user.id), eq(connectedAccountsTable.provider, "octoprint"))
    ).limit(1);
    if (!account?.accessToken) { res.status(401).json({ error: "OctoPrint not connected" }); return; }

    const meta = JSON.parse(account.metadata ?? "{}");
    const octoprintUrl = meta.octoprintUrl as string;
    const apiKey = account.accessToken;

    const fileBuffer = Buffer.from(content, "base64");
    const formData = new FormData();
    formData.append("file", new Blob([fileBuffer]), filename);
    formData.append("print", "false");

    const uploadRes = await fetch(`${octoprintUrl}/api/files/local`, {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: formData,
    });
    if (!uploadRes.ok) { res.status(400).json({ error: "OctoPrint upload failed" }); return; }
    const data = await uploadRes.json() as any;
    res.json({ ok: true, file: data });
  } catch (err) {
    res.status(500).json({ error: "Failed to upload to OctoPrint" });
  }
});

// GET /api/integrations/octoprint/status — job status
router.get("/integrations/octoprint/status", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const [account] = await db.select().from(connectedAccountsTable).where(
      and(eq(connectedAccountsTable.userId, user.id), eq(connectedAccountsTable.provider, "octoprint"))
    ).limit(1);
    if (!account?.accessToken) { res.json({ connected: false }); return; }

    const meta = JSON.parse(account.metadata ?? "{}");
    const octoprintUrl = meta.octoprintUrl as string;
    const apiKey = account.accessToken;

    const [versionRes, jobRes, printerRes] = await Promise.all([
      fetch(`${octoprintUrl}/api/version`, { headers: { "X-Api-Key": apiKey } }).catch(() => null),
      fetch(`${octoprintUrl}/api/job`, { headers: { "X-Api-Key": apiKey } }).catch(() => null),
      fetch(`${octoprintUrl}/api/printer`, { headers: { "X-Api-Key": apiKey } }).catch(() => null),
    ]);

    const version = versionRes?.ok ? await versionRes.json() : null;
    const job = jobRes?.ok ? await jobRes.json() : null;
    const printer = printerRes?.ok ? await printerRes.json() : null;

    res.json({
      connected: !!version,
      octoprintUrl,
      version: (version as any)?.server,
      job,
      printer,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get OctoPrint status" });
  }
});

// GET /api/integrations/makerspace-search?zip=94110 — nearby makerspaces
router.get("/integrations/makerspace-search", requireDbUser, async (req, res) => {
  const zip = String(req.query.zip ?? "").slice(0, 10);
  // Placeholder data — real implementation would use Google Places API
  const placeholderSpaces = [
    { name: "TechShop Community Lab", address: `${zip} — Downtown`, distance: "0.8 mi", services: ["FDM Printing", "Laser Cutting", "CNC Routing"], website: "https://example.com" },
    { name: "HackSpace Collective", address: `${zip} — Eastside`, distance: "1.4 mi", services: ["Resin Printing", "PCB Etching", "Electronics Bench"], website: "https://example.com" },
    { name: "Maker Studio", address: `${zip} — Westside`, distance: "2.1 mi", services: ["SLA Printing", "Vinyl Cutting", "Metalwork"], website: "https://example.com" },
  ];
  res.json({ zip, spaces: placeholderSpaces });
});

export default router;
