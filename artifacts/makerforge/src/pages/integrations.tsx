import { useState, useRef, useEffect, useCallback } from "react";
import {
  useGitHubStatus, useGitHubDisconnect, useGitHubPush,
  useOctoPrintCredentials, useOctoPrintConnect, useOctoPrintDisconnect,
  useSearchMakerspaces, getOctoPrintCredentialsQueryKey,
} from "@workspace/api-client-react";
import { useListProjects } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { useToast } from "@/hooks/use-toast";
import {
  Github, Printer, Download, MapPin, CheckCircle, AlertCircle, ExternalLink,
  Loader2, Globe, Cpu, ArrowRight, WifiOff,
} from "lucide-react";
import { getGitHubStatusQueryKey } from "@workspace/api-client-react";

interface OpLiveStatus {
  connected: boolean;
  version?: string;
  job?: any;
  files?: string[];
  error?: string;
}

export default function IntegrationHub() {
  const { toast } = useToast();
  const queryClient = useQueryClient();

  // GitHub state
  const { data: ghStatus, isLoading: ghLoading } = useGitHubStatus();
  const ghDisconnect = useGitHubDisconnect({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGitHubStatusQueryKey() });
        toast({ title: "GitHub disconnected" });
      },
    },
  });
  const [selectedProject, setSelectedProject] = useState<string>("");
  const [repoName, setRepoName] = useState("");
  const [createNew, setCreateNew] = useState(true);
  const ghPush = useGitHubPush({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Pushed to GitHub!", description: data.repoUrl });
        window.open(data.repoUrl, "_blank");
      },
      onError: () => toast({ title: "Push failed", variant: "destructive" }),
    },
  });

  // ── OctoPrint — client-side architecture ────────────────────────────────────
  // The server stores encrypted credentials and returns them to the authenticated
  // user. The browser then calls OctoPrint directly — no server-side proxy, no SSRF.
  const { data: opCreds, isLoading: opCredsLoading } = useOctoPrintCredentials();
  const [opLiveStatus, setOpLiveStatus] = useState<OpLiveStatus | null>(null);
  const [opPolling, setOpPolling] = useState(false);
  const [opUploadPending, setOpUploadPending] = useState(false);
  const [opPrinting, setOpPrinting] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [opUrl, setOpUrl] = useState("");
  const [opKey, setOpKey] = useState("");

  // Browser-side OctoPrint polling — runs entirely client→printer, no server proxy
  const pollOctoPrint = useCallback(async (creds: { octoprintUrl: string; apiKey: string }) => {
    try {
      const headers = { "X-Api-Key": creds.apiKey };
      const [verRes, jobRes, filesRes] = await Promise.all([
        fetch(`${creds.octoprintUrl}/api/version`, { headers }).catch(() => null),
        fetch(`${creds.octoprintUrl}/api/job`, { headers }).catch(() => null),
        fetch(`${creds.octoprintUrl}/api/files`, { headers }).catch(() => null),
      ]);
      const ver = verRes?.ok ? await verRes.json().catch(() => null) : null;
      const job = jobRes?.ok ? await jobRes.json().catch(() => null) : null;
      const filesData = filesRes?.ok ? await filesRes.json().catch(() => null) : null;
      setOpLiveStatus({
        connected: !!ver,
        version: ver?.server,
        job,
        files: (filesData?.files ?? []).map((f: any) => f.name).filter(Boolean),
      });
    } catch {
      setOpLiveStatus({ connected: false, error: "Could not reach OctoPrint" });
    }
  }, []);

  useEffect(() => {
    if (!opCreds) { setOpLiveStatus(null); return; }
    setOpPolling(true);
    pollOctoPrint(opCreds);
    const interval = setInterval(() => pollOctoPrint(opCreds), 5000);
    return () => { clearInterval(interval); setOpPolling(false); };
  }, [opCreds, pollOctoPrint]);

  const opConnect = useOctoPrintConnect({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getOctoPrintCredentialsQueryKey() });
        toast({ title: "OctoPrint credentials saved!", description: "Your browser will now connect directly to OctoPrint." });
        setOpUrl(""); setOpKey("");
      },
      onError: (e: any) => toast({ title: "Invalid URL", description: e?.data?.error ?? "Check URL format", variant: "destructive" }),
    },
  });

  const opDisconnect = useOctoPrintDisconnect({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getOctoPrintCredentialsQueryKey() });
        setOpLiveStatus(null);
        toast({ title: "OctoPrint disconnected" });
      },
    },
  });

  // Direct browser → OctoPrint file upload (no server-side proxy)
  const handleOpUpload = async (file: File) => {
    if (!opCreds) return;
    setOpUploadPending(true);
    try {
      const form = new FormData();
      form.append("file", file);
      form.append("print", "false");
      const res = await fetch(`${opCreds.octoprintUrl}/api/files/local`, {
        method: "POST",
        headers: { "X-Api-Key": opCreds.apiKey },
        body: form,
      });
      if (!res.ok) throw new Error("Upload rejected");
      toast({ title: "File uploaded to OctoPrint!" });
      pollOctoPrint(opCreds);
    } catch {
      toast({ title: "Upload failed", description: "Ensure OctoPrint allows CORS from this origin.", variant: "destructive" });
    } finally {
      setOpUploadPending(false);
    }
  };

  // Direct browser → OctoPrint start-print (no server-side proxy)
  const handleOpStartPrint = async (filename: string) => {
    if (!opCreds) return;
    setOpPrinting(filename);
    try {
      const res = await fetch(`${opCreds.octoprintUrl}/api/files/local/${encodeURIComponent(filename)}`, {
        method: "POST",
        headers: { "X-Api-Key": opCreds.apiKey, "Content-Type": "application/json" },
        body: JSON.stringify({ command: "select", print: true }),
      });
      if (!res.ok) throw new Error("Rejected");
      toast({ title: `Printing ${filename}` });
    } catch {
      toast({ title: "Failed to start print", variant: "destructive" });
    } finally {
      setOpPrinting(null);
    }
  };

  // Projects for selector
  const { data: projectsData } = useListProjects({});

  // Makerspace search
  const [zip, setZip] = useState("");
  const [searchZip, setSearchZip] = useState("");
  const { data: makerspaces, isLoading: msLoading } = useSearchMakerspaces(searchZip);

  const isOpConnected = !!opCreds;

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Integration Hub</h1>
        <p className="text-muted-foreground text-sm mt-1">Connect your maker tools and export your projects anywhere</p>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">

        {/* ── GitHub ─────────────────────────────────────────────────────── */}
        <Card className="border-border/60">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Github className="h-5 w-5" />
              GitHub
              {ghStatus?.connected && (
                <Badge className="ml-auto bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  <CheckCircle className="h-3 w-3 mr-1" />Connected as @{ghStatus.login}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {ghLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" />Checking…</div>
            ) : !ghStatus?.connected ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Connect GitHub to auto-push your OpenSCAD, BOM CSV, and build guide into a repo.</p>
                <Button asChild className="w-full">
                  <a href="/api/integrations/github/connect">
                    <Github className="h-4 w-4 mr-2" />Connect GitHub
                  </a>
                </Button>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="space-y-2">
                  <Label>Project to push</Label>
                  <Select value={selectedProject} onValueChange={setSelectedProject}>
                    <SelectTrigger><SelectValue placeholder="Select a project…" /></SelectTrigger>
                    <SelectContent>
                      {(projectsData?.items ?? []).map((p: any) => (
                        <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div className="space-y-2">
                  <Label>Repo name (optional)</Label>
                  <Input placeholder={`makerforge-${selectedProject ? "project" : "…"}`} value={repoName} onChange={(e) => setRepoName(e.target.value)} />
                </div>
                <div className="flex items-center gap-2">
                  <input type="checkbox" id="createNew" checked={createNew} onChange={(e) => setCreateNew(e.target.checked)} className="accent-primary" />
                  <Label htmlFor="createNew" className="text-sm font-normal cursor-pointer">Create new repo (uncheck to push to existing)</Label>
                </div>
                <div className="flex gap-2">
                  <Button
                    className="flex-1"
                    disabled={!selectedProject || ghPush.isPending}
                    onClick={() => ghPush.mutate({ projectId: parseInt(selectedProject), repoName: repoName || undefined, createNew })}
                  >
                    {ghPush.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <ArrowRight className="h-4 w-4 mr-2" />}
                    Push to GitHub
                  </Button>
                  <Button variant="outline" size="sm" onClick={() => ghDisconnect.mutate()}>Disconnect</Button>
                </div>
                {ghPush.data && (
                  <a href={ghPush.data.repoUrl} target="_blank" rel="noopener noreferrer"
                    className="flex items-center gap-1 text-xs text-primary hover:underline">
                    <ExternalLink className="h-3 w-3" />{ghPush.data.repoUrl}
                  </a>
                )}
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── OctoPrint ───────────────────────────────────────────────────── */}
        <Card className="border-border/60">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Printer className="h-5 w-5" />
              OctoPrint
              {isOpConnected && opLiveStatus?.connected && (
                <Badge className="ml-auto bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  <CheckCircle className="h-3 w-3 mr-1" />Live v{opLiveStatus.version}
                </Badge>
              )}
              {isOpConnected && opLiveStatus && !opLiveStatus.connected && (
                <Badge className="ml-auto bg-amber-500/20 text-amber-400 border-amber-500/30">
                  <WifiOff className="h-3 w-3 mr-1" />Offline
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {opCredsLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" />Checking…</div>
            ) : !isOpConnected ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">
                  Connect your OctoPrint instance. Your browser connects directly to OctoPrint — no cloud proxy.
                </p>
                <div className="rounded-lg bg-secondary/20 border border-border/40 p-3 text-xs text-muted-foreground space-y-1">
                  <p className="font-medium text-foreground">Requirements</p>
                  <p>• OctoPrint reachable from your browser (LAN or public URL)</p>
                  <p>• CORS allowed for this app's origin in OctoPrint → Settings → API</p>
                </div>
                <div className="space-y-2">
                  <Label>OctoPrint URL</Label>
                  <Input placeholder="http://192.168.1.100 or https://my.octoprint.tld" value={opUrl} onChange={(e) => setOpUrl(e.target.value)} />
                </div>
                <div className="space-y-2">
                  <Label>API Key</Label>
                  <Input type="password" placeholder="Your OctoPrint API key" value={opKey} onChange={(e) => setOpKey(e.target.value)} />
                </div>
                <Button
                  className="w-full"
                  disabled={!opUrl || !opKey || opConnect.isPending}
                  onClick={() => opConnect.mutate({ octoprintUrl: opUrl, apiKey: opKey })}
                >
                  {opConnect.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Printer className="h-4 w-4 mr-2" />}
                  Save OctoPrint Credentials
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg bg-secondary/30 border border-border/50 p-3 space-y-1">
                  <p className="text-xs font-mono text-muted-foreground">Host</p>
                  <p className="text-sm text-foreground font-medium">{opCreds.octoprintUrl}</p>
                </div>

                {/* Live job status */}
                {opLiveStatus?.job?.job?.file?.name && (
                  <div className="rounded-lg bg-secondary/30 border border-border/50 p-3">
                    <p className="text-xs font-mono text-muted-foreground mb-1">Current Job</p>
                    <p className="text-sm text-foreground">{opLiveStatus.job.job.file.name}</p>
                    {opLiveStatus.job.progress?.completion != null && (
                      <p className="text-xs text-muted-foreground mt-1">{opLiveStatus.job.progress.completion.toFixed(1)}% complete</p>
                    )}
                  </div>
                )}

                {/* File list with per-file print buttons */}
                {opLiveStatus?.files && opLiveStatus.files.length > 0 && (
                  <div className="space-y-2">
                    <p className="text-xs font-mono text-muted-foreground uppercase">Files on printer</p>
                    <div className="rounded-lg border border-border/50 bg-secondary/10 divide-y divide-border/30 max-h-48 overflow-y-auto">
                      {opLiveStatus.files.map((f) => (
                        <div key={f} className="flex items-center justify-between px-3 py-2">
                          <span className="text-xs text-foreground font-mono truncate flex-1">{f}</span>
                          <Button
                            size="sm"
                            variant="ghost"
                            className="h-6 text-xs ml-2 shrink-0 gap-1"
                            disabled={opPrinting === f}
                            onClick={() => handleOpStartPrint(f)}
                          >
                            {opPrinting === f ? <Loader2 className="h-3 w-3 animate-spin" /> : <Printer className="h-3 w-3" />}
                            Print
                          </Button>
                        </div>
                      ))}
                    </div>
                  </div>
                )}

                {/* Direct file upload (browser → OctoPrint, no server proxy) */}
                <div className="rounded-lg border border-border/50 bg-secondary/10 p-3 space-y-2">
                  <p className="text-xs font-mono text-muted-foreground uppercase">Upload File</p>
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".gcode,.gco,.stl"
                    className="hidden"
                    onChange={(e) => {
                      const file = e.target.files?.[0];
                      if (file) handleOpUpload(file);
                      e.target.value = "";
                    }}
                  />
                  <Button
                    size="sm"
                    variant="outline"
                    className="w-full gap-1.5 text-xs"
                    disabled={opUploadPending}
                    onClick={() => fileInputRef.current?.click()}
                  >
                    {opUploadPending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Download className="h-3.5 w-3.5" />}
                    {opUploadPending ? "Uploading…" : "Choose GCODE / STL file"}
                  </Button>
                </div>

                <Button
                  variant="outline"
                  size="sm"
                  className="w-full text-xs"
                  onClick={() => opDisconnect.mutate()}
                  disabled={opDisconnect.isPending}
                >
                  Disconnect OctoPrint
                </Button>
              </div>
            )}
          </CardContent>
        </Card>

        {/* ── Tinkercad / Printables ─────────────────────────────────────── */}
        <Card className="border-border/60">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <Cpu className="h-5 w-5" />
              Tinkercad / Printables
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Export your STL from the project ZIP, then upload to Tinkercad or Printables.</p>
            <div className="grid grid-cols-2 gap-3">
              <a href="https://www.tinkercad.com" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full gap-2">
                  <Globe className="h-4 w-4" />Tinkercad<ExternalLink className="h-3 w-3 ml-auto" />
                </Button>
              </a>
              <a href="https://www.printables.com" target="_blank" rel="noopener noreferrer">
                <Button variant="outline" className="w-full gap-2">
                  <Download className="h-4 w-4" />Printables<ExternalLink className="h-3 w-3 ml-auto" />
                </Button>
              </a>
            </div>
            <div className="rounded-lg bg-secondary/20 border border-border/40 p-3 space-y-1">
              <p className="text-xs font-semibold text-foreground">How to upload:</p>
              <ol className="text-xs text-muted-foreground space-y-0.5 list-decimal list-inside">
                <li>Export your project as a ZIP from the project detail page</li>
                <li>Unzip and find the <code className="font-mono bg-secondary px-0.5 rounded">.scad</code> or rendered STL file</li>
                <li>Upload to Tinkercad via "Import" or to Printables via "Upload model"</li>
              </ol>
            </div>
          </CardContent>
        </Card>

        {/* ── Local Makerspaces ─────────────────────────────────────────── */}
        <Card className="border-border/60">
          <CardHeader className="pb-4">
            <CardTitle className="text-base flex items-center gap-2">
              <MapPin className="h-5 w-5" />
              Local Makerspaces
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <p className="text-sm text-muted-foreground">Find nearby makerspaces and print services.</p>
            <div className="flex gap-2">
              <Input
                placeholder="ZIP code (e.g. 94110)"
                value={zip}
                onChange={(e) => setZip(e.target.value)}
                maxLength={10}
                onKeyDown={(e) => e.key === "Enter" && setSearchZip(zip)}
              />
              <Button onClick={() => setSearchZip(zip)} disabled={zip.length < 3 || msLoading}>
                {msLoading ? <Loader2 className="h-4 w-4 animate-spin" /> : "Search"}
              </Button>
            </div>
            {makerspaces?.spaces && (
              <div className="space-y-2">
                {makerspaces.spaces.map((s, i) => (
                  <div key={i} className="rounded-lg border border-border/50 bg-secondary/20 p-3">
                    <div className="flex items-start justify-between gap-2">
                      <div>
                        <p className="text-sm font-medium text-foreground">{s.name}</p>
                        <p className="text-xs text-muted-foreground">{s.address} · {s.distance}</p>
                        <div className="flex flex-wrap gap-1 mt-1">
                          {s.services.map((svc, j) => (
                            <Badge key={j} variant="outline" className="text-[10px] px-1.5 py-0">{svc}</Badge>
                          ))}
                        </div>
                      </div>
                      <a href={s.website} target="_blank" rel="noopener noreferrer">
                        <Button size="sm" variant="ghost" className="h-7 text-xs"><ExternalLink className="h-3 w-3" /></Button>
                      </a>
                    </div>
                  </div>
                ))}
                <p className="text-[10px] text-muted-foreground/60 text-center">Placeholder data — real search coming soon</p>
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
