import { Router } from "express";
import { createHmac, randomBytes, createCipheriv, createDecipheriv } from "crypto";
import { db } from "@workspace/db";
import {
  connectedAccountsTable, projectsTable, usersTable,
} from "@workspace/db";
import { eq, and } from "drizzle-orm";
import { requireDbUser } from "../lib/auth";

const router = Router();

// ── Crypto helpers ────────────────────────────────────────────────────────────

/**
 * HMAC-sign a state token embedding the authenticated userId.
 * The state is never decoded by the client — only the server verifies it on callback.
 */
function makeOAuthState(userId: number): string {
  const secret = process.env.GITHUB_CLIENT_SECRET ?? process.env.APP_SECRET ?? "dev-only-secret";
  const nonce = randomBytes(16).toString("hex");
  const payload = `${userId}:${nonce}`;
  const sig = createHmac("sha256", secret).update(payload).digest("hex");
  return Buffer.from(`${payload}:${sig}`).toString("base64url");
}

/**
 * Verify and extract userId from the state returned by GitHub.
 * Returns null if the state is tampered or invalid.
 */
function verifyOAuthState(state: string): number | null {
  try {
    const secret = process.env.GITHUB_CLIENT_SECRET ?? process.env.APP_SECRET ?? "dev-only-secret";
    const decoded = Buffer.from(state, "base64url").toString("utf8");
    const lastColon = decoded.lastIndexOf(":");
    if (lastColon < 0) return null;
    const payload = decoded.slice(0, lastColon);
    const sig = decoded.slice(lastColon + 1);
    const expected = createHmac("sha256", secret).update(payload).digest("hex");
    if (sig !== expected) return null;
    const userId = parseInt(payload.split(":")[0]);
    return isNaN(userId) ? null : userId;
  } catch {
    return null;
  }
}

/**
 * AES-256-GCM encryption for OctoPrint API keys stored at rest.
 * Falls back gracefully if no OCTOPRINT_ENCRYPTION_KEY is set (dev only).
 */
function getEncryptionKey(): Buffer {
  const raw = process.env.OCTOPRINT_ENCRYPTION_KEY ?? process.env.APP_SECRET ?? "makerforge-dev-key-32bytesXXXXXX";
  return Buffer.from(raw.padEnd(32, "0").slice(0, 32), "utf8");
}

function encryptSecret(plaintext: string): string {
  const key = getEncryptionKey();
  const iv = randomBytes(12);
  const cipher = createCipheriv("aes-256-gcm", key, iv);
  const encrypted = Buffer.concat([cipher.update(plaintext, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  // Format: base64(iv[12] | tag[16] | ciphertext)
  return Buffer.concat([iv, tag, encrypted]).toString("base64");
}

function decryptSecret(ciphertext: string): string {
  const key = getEncryptionKey();
  const buf = Buffer.from(ciphertext, "base64");
  const iv = buf.subarray(0, 12);
  const tag = buf.subarray(12, 28);
  const encrypted = buf.subarray(28);
  const decipher = createDecipheriv("aes-256-gcm", key, iv);
  decipher.setAuthTag(tag);
  return Buffer.concat([decipher.update(encrypted), decipher.final()]).toString("utf8");
}

/** Safely decrypt — if value is legacy plaintext (not base64-gcm), return as-is */
function safeDecrypt(stored: string): string {
  try {
    return decryptSecret(stored);
  } catch {
    return stored; // legacy plaintext fallback
  }
}

// ── SSRF Guard ────────────────────────────────────────────────────────────────

/**
 * Validate a user-supplied OctoPrint URL before making server-side requests.
 * Blocks cloud metadata endpoints and localhost while allowing LAN private ranges
 * (OctoPrint is inherently a local-network device — 192.168.x, 10.x, etc. are valid).
 */
function validateOctoPrintUrl(rawUrl: string): { valid: boolean; reason?: string } {
  let parsed: URL;
  try {
    parsed = new URL(rawUrl);
  } catch {
    return { valid: false, reason: "Invalid URL format" };
  }
  if (!["http:", "https:"].includes(parsed.protocol)) {
    return { valid: false, reason: "Only http:// and https:// URLs are allowed" };
  }
  const host = parsed.hostname.toLowerCase();
  // Block AWS/GCP/Azure instance metadata endpoints (SSRF targets)
  const blockedHosts = ["169.254.169.254", "metadata.google.internal", "metadata.internal", "100.100.100.200"];
  if (blockedHosts.includes(host)) {
    return { valid: false, reason: "Cloud metadata endpoints are not allowed" };
  }
  // Block loopback — OctoPrint must live on the LAN, not the server itself
  if (host === "localhost" || host === "127.0.0.1" || host === "::1" || host === "0.0.0.0") {
    return { valid: false, reason: "Loopback addresses are not valid OctoPrint hosts" };
  }
  // Block link-local beyond the metadata IPs (169.254.x.x range)
  const linkLocalMatch = host.match(/^169\.254\.(\d+)\.(\d+)$/);
  if (linkLocalMatch) {
    return { valid: false, reason: "Link-local addresses are not allowed" };
  }
  return { valid: true };
}

// ── GitHub OAuth ─────────────────────────────────────────────────────────────

// GET /api/integrations/github/connect — redirect to GitHub OAuth
router.get("/integrations/github/connect", requireDbUser, (req, res) => {
  const clientId = process.env.GITHUB_CLIENT_ID;
  if (!clientId) {
    res.status(501).json({ error: "GitHub OAuth not configured (GITHUB_CLIENT_ID missing)" });
    return;
  }
  // State is HMAC-signed with the authenticated userId — cannot be forged by clients
  const state = makeOAuthState((req as any).dbUser.id);
  const redirectUri = `${req.protocol}://${req.get("host")}/api/integrations/github/callback`;
  const url = `https://github.com/login/oauth/authorize?client_id=${clientId}&scope=repo&state=${encodeURIComponent(state)}&redirect_uri=${encodeURIComponent(redirectUri)}`;
  res.redirect(url);
});

// GET /api/integrations/github/callback
// userId is extracted from the server-signed state — not from client input
router.get("/integrations/github/callback", async (req, res) => {
  try {
    const code = String(req.query.code ?? "");
    const rawState = String(req.query.state ?? "");

    const clientId = process.env.GITHUB_CLIENT_ID;
    const clientSecret = process.env.GITHUB_CLIENT_SECRET;
    if (!clientId || !clientSecret || !code) {
      res.status(400).json({ error: "Invalid OAuth callback" });
      return;
    }

    // Verify HMAC-signed state — reject tampered or missing state
    const userId = verifyOAuthState(rawState);
    if (!userId) {
      res.status(400).json({ error: "Invalid or tampered OAuth state" });
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

    if (createNew) {
      await fetch("https://api.github.com/user/repos", {
        method: "POST", headers,
        body: JSON.stringify({ name: repo, description: project.description ?? project.title, private: false, auto_init: true }),
      });
      await new Promise((r) => setTimeout(r, 1500));
    }

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
//
// All OctoPrint traffic is routed through authenticated server-side endpoints.
// API keys never leave the server (stored AES-256-GCM encrypted, used only in
// server→OctoPrint requests). SSRF is mitigated by validateOctoPrintUrl which
// blocks loopback and cloud metadata endpoints before every outbound request.
// LAN private ranges (192.168.x, 10.x, 172.16-31.x) are intentionally allowed
// because OctoPrint is inherently a LAN-resident device.

/** Shared helper: load and validate OctoPrint credentials from DB. */
async function getOctoPrintAccount(userId: number): Promise<
  { octoprintUrl: string; apiKey: string; error?: never } |
  { error: string; octoprintUrl?: never; apiKey?: never }
> {
  const [account] = await db.select().from(connectedAccountsTable).where(
    and(eq(connectedAccountsTable.userId, userId), eq(connectedAccountsTable.provider, "octoprint"))
  ).limit(1);
  if (!account?.accessToken) return { error: "OctoPrint not connected" };

  const meta = JSON.parse(account.metadata ?? "{}");
  const octoprintUrl = meta.octoprintUrl as string;
  const urlCheck = validateOctoPrintUrl(octoprintUrl);
  if (!urlCheck.valid) return { error: `Stored OctoPrint URL is invalid: ${urlCheck.reason}` };

  const apiKey = safeDecrypt(account.accessToken);
  return { octoprintUrl, apiKey };
}

// POST /api/integrations/octoprint/connect — validate URL format + save encrypted credentials
router.post("/integrations/octoprint/connect", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const { octoprintUrl, apiKey } = req.body;
    if (!octoprintUrl || !apiKey) { res.status(400).json({ error: "octoprintUrl and apiKey required" }); return; }

    // SSRF guard — validate URL shape before any outbound request is ever made
    const urlCheck = validateOctoPrintUrl(octoprintUrl);
    if (!urlCheck.valid) { res.status(400).json({ error: urlCheck.reason }); return; }

    // Verify connectivity with a short timeout; reject if OctoPrint is unreachable
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 5000);
    const testRes = await fetch(`${octoprintUrl}/api/version`, {
      headers: { "X-Api-Key": apiKey },
      signal: controller.signal,
    }).catch(() => null).finally(() => clearTimeout(timeout));
    if (!testRes?.ok) { res.status(400).json({ error: "Cannot reach OctoPrint at that URL. Check the URL and API key." }); return; }

    const encryptedKey = encryptSecret(apiKey);
    await db.insert(connectedAccountsTable).values({
      userId: user.id,
      provider: "octoprint",
      accessToken: encryptedKey,
      metadata: JSON.stringify({ octoprintUrl }),
      updatedAt: new Date(),
    }).onConflictDoUpdate({
      target: [connectedAccountsTable.userId, connectedAccountsTable.provider],
      set: { accessToken: encryptedKey, metadata: JSON.stringify({ octoprintUrl }), updatedAt: new Date() },
    });
    await db.update(usersTable).set({ octoprintConnected: true }).where(eq(usersTable.id, user.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to connect OctoPrint" });
  }
});

// GET /api/integrations/octoprint/status — job status + printer state (server proxies, no key exposure)
router.get("/integrations/octoprint/status", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const creds = await getOctoPrintAccount(user.id);
    if (creds.error) { res.json({ connected: false }); return; }
    const { octoprintUrl, apiKey } = creds;

    const headers = { "X-Api-Key": apiKey };
    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 5000);
    const [versionRes, jobRes, filesRes] = await Promise.all([
      fetch(`${octoprintUrl}/api/version`, { headers, signal: ac.signal }).catch(() => null),
      fetch(`${octoprintUrl}/api/job`, { headers, signal: ac.signal }).catch(() => null),
      fetch(`${octoprintUrl}/api/files?recursive=false`, { headers, signal: ac.signal }).catch(() => null),
    ]).finally(() => clearTimeout(timeout));

    const version = versionRes?.ok ? await versionRes.json().catch(() => null) : null;
    const job = jobRes?.ok ? await jobRes.json().catch(() => null) : null;
    const filesData = filesRes?.ok ? await filesRes.json().catch(() => null) : null;
    const files: string[] = ((filesData as any)?.files ?? []).map((f: any) => f.name).filter(Boolean);

    res.json({
      connected: !!version,
      octoprintUrl,
      version: (version as any)?.server,
      job,
      files,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get OctoPrint status" });
  }
});

// POST /api/integrations/octoprint/upload — send GCODE/STL to OctoPrint (API key stays server-side)
router.post("/integrations/octoprint/upload", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const { filename, content } = req.body;
    if (!filename || !content) { res.status(400).json({ error: "filename and content required" }); return; }

    const creds = await getOctoPrintAccount(user.id);
    if (creds.error) { res.status(401).json({ error: creds.error }); return; }
    const { octoprintUrl, apiKey } = creds;

    const fileBuffer = Buffer.from(content, "base64");
    const formData = new FormData();
    formData.append("file", new Blob([fileBuffer]), filename);
    formData.append("print", "false");

    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 30000);
    const uploadRes = await fetch(`${octoprintUrl}/api/files/local`, {
      method: "POST",
      headers: { "X-Api-Key": apiKey },
      body: formData,
      signal: ac.signal,
    }).finally(() => clearTimeout(timeout));

    if (!uploadRes.ok) { res.status(400).json({ error: "OctoPrint upload failed" }); return; }
    const data = await uploadRes.json() as any;
    res.json({ ok: true, file: data });
  } catch (err) {
    res.status(500).json({ error: "Failed to upload to OctoPrint" });
  }
});

// POST /api/integrations/octoprint/start-print — select file and start printing
router.post("/integrations/octoprint/start-print", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const { filename } = req.body;
    if (!filename) { res.status(400).json({ error: "filename required" }); return; }

    const creds = await getOctoPrintAccount(user.id);
    if (creds.error) { res.status(401).json({ error: creds.error }); return; }
    const { octoprintUrl, apiKey } = creds;

    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), 10000);
    const selectRes = await fetch(`${octoprintUrl}/api/files/local/${encodeURIComponent(filename)}`, {
      method: "POST",
      headers: { "X-Api-Key": apiKey, "Content-Type": "application/json" },
      body: JSON.stringify({ command: "select", print: true }),
      signal: ac.signal,
    }).finally(() => clearTimeout(timeout));

    if (!selectRes.ok) {
      const errText = await selectRes.text().catch(() => "");
      res.status(400).json({ error: `OctoPrint start failed: ${errText}` });
      return;
    }
    res.json({ ok: true, printing: filename });
  } catch (err) {
    res.status(500).json({ error: "Failed to start print" });
  }
});

// POST /api/integrations/octoprint/disconnect
router.post("/integrations/octoprint/disconnect", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    await db.delete(connectedAccountsTable).where(
      and(eq(connectedAccountsTable.userId, user.id), eq(connectedAccountsTable.provider, "octoprint"))
    );
    await db.update(usersTable).set({ octoprintConnected: false }).where(eq(usersTable.id, user.id));
    res.json({ ok: true });
  } catch (err) {
    res.status(500).json({ error: "Failed to disconnect OctoPrint" });
  }
});

// GET /api/integrations/makerspace-search?zip=94110 — nearby makerspaces
router.get("/integrations/makerspace-search", requireDbUser, async (req, res) => {
  const zip = String(req.query.zip ?? "").slice(0, 10);
  // Placeholder data — real implementation would use Google Places API or a makerspace directory
  const placeholderSpaces = [
    { name: "TechShop Community Lab", address: `${zip} — Downtown`, distance: "0.8 mi", services: ["FDM Printing", "Laser Cutting", "CNC Routing"], website: "https://example.com" },
    { name: "HackSpace Collective", address: `${zip} — Eastside`, distance: "1.4 mi", services: ["Resin Printing", "PCB Etching", "Electronics Bench"], website: "https://example.com" },
    { name: "Maker Studio", address: `${zip} — Westside`, distance: "2.1 mi", services: ["SLA Printing", "Vinyl Cutting", "Metalwork"], website: "https://example.com" },
  ];
  res.json({ zip, spaces: placeholderSpaces });
});

export default router;
