import { useState } from "react";
import { useGitHubStatus, useGitHubDisconnect, useGitHubPush, useOctoPrintStatus, useOctoPrintConnect, useSearchMakerspaces } from "@workspace/api-client-react";
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
  Loader2, Globe, Cpu, ArrowRight,
} from "lucide-react";
import { getGitHubStatusQueryKey, getOctoPrintStatusQueryKey } from "@workspace/api-client-react";

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

  // OctoPrint state
  const { data: opStatus, isLoading: opLoading } = useOctoPrintStatus();
  const [opUrl, setOpUrl] = useState("");
  const [opKey, setOpKey] = useState("");
  const opConnect = useOctoPrintConnect({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getOctoPrintStatusQueryKey() });
        toast({ title: "OctoPrint connected!" });
        setOpUrl(""); setOpKey("");
      },
      onError: (e: any) => toast({ title: "Connection failed", description: e?.data?.error ?? "Check URL and API key", variant: "destructive" }),
    },
  });

  // Projects for selector
  const { data: projectsData } = useListProjects({});

  // Makerspace search
  const [zip, setZip] = useState("");
  const [searchZip, setSearchZip] = useState("");
  const { data: makerspaces, isLoading: msLoading } = useSearchMakerspaces(searchZip);

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
              {opStatus?.connected && (
                <Badge className="ml-auto bg-emerald-500/20 text-emerald-400 border-emerald-500/30">
                  <CheckCircle className="h-3 w-3 mr-1" />Connected v{opStatus.version}
                </Badge>
              )}
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            {opLoading ? (
              <div className="flex items-center gap-2 text-muted-foreground text-sm"><Loader2 className="h-4 w-4 animate-spin" />Checking…</div>
            ) : !opStatus?.connected ? (
              <div className="space-y-3">
                <p className="text-sm text-muted-foreground">Connect your OctoPrint instance to push STL/GCODE files directly to your printer.</p>
                <div className="space-y-2">
                  <Label>OctoPrint URL</Label>
                  <Input placeholder="http://192.168.1.100" value={opUrl} onChange={(e) => setOpUrl(e.target.value)} />
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
                  Connect OctoPrint
                </Button>
              </div>
            ) : (
              <div className="space-y-3">
                <div className="rounded-lg bg-secondary/30 border border-border/50 p-3 space-y-1">
                  <p className="text-xs font-mono text-muted-foreground">Host</p>
                  <p className="text-sm text-foreground font-medium">{opStatus.octoprintUrl}</p>
                </div>
                {Boolean(opStatus.job) && (
                  <div className="rounded-lg bg-secondary/30 border border-border/50 p-3">
                    <p className="text-xs font-mono text-muted-foreground mb-1">Current Job</p>
                    <pre className="text-xs text-foreground overflow-auto max-h-24">{JSON.stringify(opStatus.job, null, 2)}</pre>
                  </div>
                )}
                <p className="text-xs text-muted-foreground">Upload GCODE from your project export, then slice and start from OctoPrint's web UI.</p>
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
