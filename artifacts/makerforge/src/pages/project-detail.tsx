import { useState, useEffect, Suspense, useRef } from "react";
import { useParams, useLocation } from "wouter";
import {
  useGetProject,
  useGetProjectSections,
  useGetProjectMessages,
  useAddProjectMessage,
  useShareProject,
  useRefineProjectSection,
  getGetProjectQueryKey,
  getGetProjectSectionsQueryKey,
  getGetProjectMessagesQueryKey,
  type RefineInputSection,
} from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { ScrollArea } from "@/components/ui/scroll-area";
import {
  Settings, Cpu, Cuboid, ListOrdered, BookOpen, Share2, Download,
  Copy, ExternalLink, ChevronDown, ChevronUp, AlertTriangle, SendHorizonal, CheckCircle,
} from "lucide-react";
import { useToast } from "@/hooks/use-toast";
import { Canvas } from "@react-three/fiber";
import { OrbitControls, Box, Sphere, Octahedron } from "@react-three/drei";

// --- 3D Placeholder Viewer ---
function ModelPlaceholder() {
  const meshRef = useRef<any>(null);
  useEffect(() => {
    let frame: number;
    const animate = () => {
      if (meshRef.current) {
        meshRef.current.rotation.y += 0.005;
        meshRef.current.rotation.x += 0.002;
      }
      frame = requestAnimationFrame(animate);
    };
    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <mesh ref={meshRef}>
      <Box args={[1.4, 0.6, 1]}>
        <meshStandardMaterial color="#0bdba8" wireframe />
      </Box>
      <Octahedron args={[0.35]} position={[0, 0.6, 0]}>
        <meshStandardMaterial color="#38bdf8" wireframe />
      </Octahedron>
    </mesh>
  );
}

function ThreeDPreview() {
  return (
    <div className="w-full h-[280px] rounded-xl overflow-hidden bg-secondary/30 border border-border/50">
      <Canvas camera={{ position: [3, 2, 3], fov: 45 }}>
        <ambientLight intensity={0.4} />
        <pointLight position={[5, 5, 5]} intensity={1} color="#0bdba8" />
        <Suspense fallback={null}>
          <ModelPlaceholder />
        </Suspense>
        <OrbitControls autoRotate autoRotateSpeed={0.8} enableZoom enablePan={false} />
      </Canvas>
      <p className="text-center text-[10px] font-mono text-muted-foreground -mt-5 pb-2">
        3D preview — upload STL for exact render
      </p>
    </div>
  );
}

// --- BOM Tier Table ---
function BomTierTable({ items }: { items: any[] }) {
  const [expanded, setExpanded] = useState<number | null>(null);
  if (!items?.length) return <p className="text-muted-foreground text-sm">No items available.</p>;
  return (
    <div className="space-y-1">
      {items.map((item: any, i: number) => (
        <div key={i} className="rounded-lg border border-border overflow-hidden">
          <div className="flex items-center gap-3 p-3 bg-secondary/20">
            <div className="flex-1 min-w-0">
              <p className="text-sm font-medium text-foreground truncate">{item.name}</p>
              <p className="text-xs text-muted-foreground">{item.supplier} · {item.partNumber || "N/A"}</p>
            </div>
            <div className="text-right shrink-0">
              <p className="text-xs font-mono text-foreground">{item.quantity} {item.unit}</p>
              <p className="text-xs text-primary font-mono">${item.estimatedPrice}</p>
            </div>
            {item.affiliateUrl && (
              <a href={item.affiliateUrl} target="_blank" rel="noopener noreferrer"
                className="text-muted-foreground hover:text-primary transition-colors" title="Opens affiliate link">
                <ExternalLink className="h-4 w-4" />
              </a>
            )}
            {item.alternatives?.length > 0 && (
              <button onClick={() => setExpanded(expanded === i ? null : i)} className="text-muted-foreground hover:text-primary">
                {expanded === i ? <ChevronUp className="h-4 w-4" /> : <ChevronDown className="h-4 w-4" />}
              </button>
            )}
          </div>
          {expanded === i && item.alternatives?.length > 0 && (
            <div className="px-3 pb-2 bg-secondary/10">
              <p className="text-xs text-muted-foreground font-mono mb-1">Alternatives:</p>
              <ul className="space-y-0.5">
                {item.alternatives.map((alt: string, j: number) => (
                  <li key={j} className="text-xs text-muted-foreground">• {alt}</li>
                ))}
              </ul>
            </div>
          )}
        </div>
      ))}
    </div>
  );
}

// --- Chat Panel ---
function ChatPanel({ projectId }: { projectId: number }) {
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const { data: messages = [] } = useGetProjectMessages(projectId, {
    query: { queryKey: getGetProjectMessagesQueryKey(projectId), refetchInterval: 3000 },
  });
  const addMessage = useAddProjectMessage({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProjectMessagesQueryKey(projectId) });
        setInput("");
      },
    },
  });

  const handleSend = () => {
    if (!input.trim()) return;
    addMessage.mutate({ id: projectId, data: { content: input } });
  };

  return (
    <div className="flex flex-col h-64 border border-border rounded-lg overflow-hidden">
      <div className="px-3 py-2 bg-secondary/50 border-b border-border text-xs font-mono text-muted-foreground">
        AI Chat — ask for changes or explanations
      </div>
      <ScrollArea className="flex-1 p-3">
        <div className="space-y-2">
          {(messages as any[]).map((m: any) => (
            <div key={m.id} className={`text-xs p-2 rounded-lg max-w-[85%] ${
              m.role === "user"
                ? "ml-auto bg-primary/20 text-foreground"
                : "bg-secondary text-muted-foreground"
            }`}>
              {m.content}
            </div>
          ))}
        </div>
      </ScrollArea>
      <div className="flex gap-2 p-2 border-t border-border bg-background">
        <Input
          value={input}
          onChange={(e) => setInput(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && handleSend()}
          placeholder="Ask AI to refine the project..."
          className="text-xs h-8"
        />
        <Button size="sm" className="h-8 px-2" onClick={handleSend} disabled={addMessage.isPending}>
          <SendHorizonal className="h-4 w-4" />
        </Button>
      </div>
    </div>
  );
}

// --- Section Refinement Bar ---
function RefineBar({ projectId, section }: { projectId: number; section: RefineInputSection }) {
  const queryClient = useQueryClient();
  const [prompt, setPrompt] = useState("");
  const [open, setOpen] = useState(false);
  const refine = useRefineProjectSection({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetProjectSectionsQueryKey(projectId) });
        setPrompt("");
        setOpen(false);
      },
    },
  });

  if (!open) {
    return (
      <Button variant="ghost" size="sm" className="text-xs h-7" onClick={() => setOpen(true)}>
        Refine this section with AI
      </Button>
    );
  }

  return (
    <div className="flex gap-2 mt-3">
      <Input
        value={prompt}
        onChange={(e) => setPrompt(e.target.value)}
        placeholder={`e.g. "Make it more heat-resistant" or "Simplify for beginners"`}
        className="text-xs h-8"
        onKeyDown={(e) => e.key === "Enter" && !e.shiftKey && refine.mutate({ projectId, data: { section, prompt } })}
      />
      <Button size="sm" className="h-8" onClick={() => refine.mutate({ projectId, data: { section, prompt } })} disabled={refine.isPending}>
        {refine.isPending ? "Refining..." : "Refine"}
      </Button>
      <Button size="sm" variant="ghost" className="h-8" onClick={() => setOpen(false)}>Cancel</Button>
    </div>
  );
}

// --- Main Component ---
export default function ProjectDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);
  const queryClient = useQueryClient();
  const { toast } = useToast();
  const [, setLocation] = useLocation();

  const { data: project, isLoading: loadingProject } = useGetProject(id, {
    query: {
      queryKey: getGetProjectQueryKey(id),
      refetchInterval: (query) =>
        query.state.data?.status === "generating" ? 3000 : false,
    },
  });
  const { data: sections, isLoading: loadingSections } = useGetProjectSections(id, {
    query: { queryKey: getGetProjectSectionsQueryKey(id) },
  });

  const shareMutation = useShareProject({
    mutation: {
      onSuccess: (data) => {
        navigator.clipboard?.writeText(data.url ?? "").catch(() => {});
        toast({ title: "Share link copied!", description: data.url });
      },
    },
  });

  if (loadingProject) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-[500px] w-full" />
      </div>
    );
  }

  if (!project) return <div className="text-muted-foreground">Project not found.</div>;

  const isGenerating = project.status === "generating";
  const s = (sections as any) ?? {};
  const mechanical = s.mechanical ?? {};
  const electronics = s.electronics ?? {};
  const bom = s.bom ?? {};
  const buildGuide = s.buildGuide ?? {};
  const educationPack = s.educationPack ?? null;
  const safety = s.safety ?? {};

  const riskColor = !safety.riskScore ? "text-muted-foreground"
    : safety.riskScore <= 3 ? "text-emerald-400"
    : safety.riskScore <= 6 ? "text-yellow-400"
    : "text-red-400";

  return (
    <div className="flex flex-col gap-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <div className="flex items-center gap-3 flex-wrap">
            <h1 className="text-2xl font-bold tracking-tight text-primary">{project.title}</h1>
            <Badge variant="outline" className={
              project.status === "ready" ? "border-emerald-500 text-emerald-400" :
              project.status === "generating" ? "border-yellow-500 text-yellow-400 animate-pulse" :
              project.status === "error" ? "border-red-500 text-red-400" :
              "border-muted-foreground text-muted-foreground"
            }>
              {project.status?.toUpperCase()}
            </Badge>
            {safety.riskScore && (
              <Badge variant="outline" className={`border-current ${riskColor}`}>
                Risk {safety.riskScore}/10
              </Badge>
            )}
          </div>
          <p className="text-muted-foreground text-sm mt-1 max-w-2xl">{project.description || project.prompt}</p>
        </div>
        <div className="flex gap-2 shrink-0">
          <Button variant="outline" size="sm"
            disabled={shareMutation.isPending}
            onClick={() => shareMutation.mutate({ id })}>
            <Share2 className="mr-1 h-4 w-4" />Share
          </Button>
          <Button size="sm" disabled={isGenerating} asChild>
            <a href={`/api/projects/${id}/export`} download>
              <Download className="mr-1 h-4 w-4" />Export ZIP
            </a>
          </Button>
        </div>
      </div>

      {isGenerating ? (
        <Card className="border-primary/20 flex flex-col items-center justify-center p-12">
          <div className="text-center space-y-4">
            <div className="inline-block relative">
              <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin" />
              <Cpu className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 text-primary h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold">Forging Project...</h3>
              <p className="text-muted-foreground font-mono text-sm mt-1 animate-pulse">AI is building your complete package</p>
            </div>
          </div>
        </Card>
      ) : (
        <Tabs defaultValue="overview" className="w-full">
          <TabsList className="flex flex-wrap h-auto gap-1 bg-card border border-border p-1 mb-4">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="mechanical"><Cuboid className="mr-1 h-3 w-3" />Mechanical</TabsTrigger>
            <TabsTrigger value="electronics"><Cpu className="mr-1 h-3 w-3" />Electronics</TabsTrigger>
            <TabsTrigger value="bom"><ListOrdered className="mr-1 h-3 w-3" />BOM</TabsTrigger>
            <TabsTrigger value="guide"><Settings className="mr-1 h-3 w-3" />Build Guide</TabsTrigger>
            <TabsTrigger value="edu"><BookOpen className="mr-1 h-3 w-3" />Education</TabsTrigger>
          </TabsList>

          {/* OVERVIEW */}
          <TabsContent value="overview">
            <div className="grid md:grid-cols-2 gap-6">
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                  {[
                    { label: "Skill Level", value: project.skillLevel },
                    { label: "Est. Cost", value: project.estimatedCost ? `$${project.estimatedCost}` : null },
                    { label: "Est. Time", value: (project as any).estimatedTime },
                    { label: "Category", value: project.category },
                  ].map(({ label, value }) => value && (
                    <Card key={label} className="bg-background border-border/50">
                      <CardContent className="p-3">
                        <p className="text-[10px] uppercase text-muted-foreground font-mono mb-1">{label}</p>
                        <p className="font-semibold text-sm capitalize">{value}</p>
                      </CardContent>
                    </Card>
                  ))}
                </div>
                {safety.disclaimers?.length > 0 && (
                  <div className="rounded-lg border border-yellow-500/30 bg-yellow-500/5 p-3">
                    <p className="text-xs font-mono text-yellow-400 flex items-center gap-1 mb-1">
                      <AlertTriangle className="h-3 w-3" />Safety Notes
                    </p>
                    <ul className="space-y-1">
                      {safety.disclaimers.slice(0, 3).map((d: string, i: number) => (
                        <li key={i} className="text-xs text-yellow-300/80">• {d}</li>
                      ))}
                    </ul>
                  </div>
                )}
                <ChatPanel projectId={id} />
              </div>
              <div>
                <ThreeDPreview />
                {project.renderImageUrl && (
                  <img src={project.renderImageUrl} alt="Render" className="mt-3 rounded-lg w-full object-cover max-h-48 border border-border" />
                )}
              </div>
            </div>
          </TabsContent>

          {/* MECHANICAL */}
          <TabsContent value="mechanical">
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Mechanical Design</CardTitle>
                <RefineBar projectId={id} section="mechanical" />
              </CardHeader>
              <CardContent className="space-y-4">
                {mechanical.openScadCode ? (
                  <>
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <p className="text-xs font-mono text-muted-foreground uppercase">OpenSCAD Code</p>
                        <Button variant="ghost" size="sm" className="h-7 text-xs"
                          onClick={() => navigator.clipboard?.writeText(mechanical.openScadCode)}>
                          <Copy className="h-3 w-3 mr-1" />Copy
                        </Button>
                      </div>
                      <pre className="text-xs font-mono bg-secondary/40 rounded-lg p-4 overflow-auto max-h-80 text-emerald-300 whitespace-pre-wrap">
                        {mechanical.openScadCode}
                      </pre>
                    </div>
                    {mechanical.printSettings && (
                      <div>
                        <p className="text-xs font-mono text-muted-foreground uppercase mb-2">Print Settings</p>
                        <p className="text-sm text-muted-foreground">{mechanical.printSettings}</p>
                      </div>
                    )}
                    {mechanical.materials?.length > 0 && (
                      <div>
                        <p className="text-xs font-mono text-muted-foreground uppercase mb-2">Materials</p>
                        <ul className="space-y-1">
                          {mechanical.materials.map((m: string, i: number) => (
                            <li key={i} className="text-sm text-muted-foreground">• {m}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {mechanical.assemblyNotes && (
                      <div>
                        <p className="text-xs font-mono text-muted-foreground uppercase mb-2">Assembly Notes</p>
                        <p className="text-sm text-muted-foreground">{mechanical.assemblyNotes}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">Mechanical data not yet generated.</p>
                )}
                <ThreeDPreview />
              </CardContent>
            </Card>
          </TabsContent>

          {/* ELECTRONICS */}
          <TabsContent value="electronics">
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Electronics</CardTitle>
                <RefineBar projectId={id} section="electronics" />
              </CardHeader>
              <CardContent className="space-y-4">
                {electronics.schematicDescription ? (
                  <>
                    <div>
                      <p className="text-xs font-mono text-muted-foreground uppercase mb-2">Schematic Description</p>
                      <p className="text-sm text-muted-foreground">{electronics.schematicDescription}</p>
                    </div>
                    {electronics.wiringDiagram && (
                      <div>
                        <p className="text-xs font-mono text-muted-foreground uppercase mb-2">Wiring Diagram</p>
                        <pre className="text-xs font-mono bg-secondary/40 rounded-lg p-4 overflow-auto max-h-48 text-blue-300 whitespace-pre-wrap">
                          {electronics.wiringDiagram}
                        </pre>
                      </div>
                    )}
                    {electronics.powerCalcs && (
                      <div>
                        <p className="text-xs font-mono text-muted-foreground uppercase mb-2">Power Calculations</p>
                        <p className="text-sm text-muted-foreground">{electronics.powerCalcs}</p>
                      </div>
                    )}
                    {electronics.components?.length > 0 && (
                      <div>
                        <p className="text-xs font-mono text-muted-foreground uppercase mb-2">Components</p>
                        <ul className="space-y-1">
                          {electronics.components.map((c: string, i: number) => (
                            <li key={i} className="text-sm text-muted-foreground font-mono">• {c}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">Electronics data not yet generated.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* BOM */}
          <TabsContent value="bom">
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Bill of Materials</CardTitle>
                <RefineBar projectId={id} section="bom" />
              </CardHeader>
              <CardContent>
                {bom.tiers ? (
                  <Tabs defaultValue="balanced">
                    <TabsList className="mb-4">
                      <TabsTrigger value="budget">Budget</TabsTrigger>
                      <TabsTrigger value="balanced">Balanced</TabsTrigger>
                      <TabsTrigger value="premium">Premium</TabsTrigger>
                    </TabsList>
                    <TabsContent value="budget"><BomTierTable items={bom.tiers.budget ?? []} /></TabsContent>
                    <TabsContent value="balanced"><BomTierTable items={bom.tiers.balanced ?? []} /></TabsContent>
                    <TabsContent value="premium"><BomTierTable items={bom.tiers.premium ?? []} /></TabsContent>
                  </Tabs>
                ) : (
                  <p className="text-muted-foreground text-sm">BOM not yet generated.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* BUILD GUIDE */}
          <TabsContent value="guide">
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Build Guide</CardTitle>
                <RefineBar projectId={id} section="buildGuide" />
              </CardHeader>
              <CardContent className="space-y-4">
                {buildGuide.steps?.length > 0 ? (
                  <>
                    <div className="flex flex-wrap gap-4 text-sm text-muted-foreground font-mono mb-4">
                      {buildGuide.estimatedTime && <span>Time: {buildGuide.estimatedTime}</span>}
                      {buildGuide.estimatedCost && <span>Cost: ${buildGuide.estimatedCost}</span>}
                    </div>
                    {buildGuide.toolsList?.length > 0 && (
                      <div>
                        <p className="text-xs font-mono text-muted-foreground uppercase mb-2">Tools Required</p>
                        <ul className="flex flex-wrap gap-2">
                          {buildGuide.toolsList.map((t: string, i: number) => (
                            <li key={i} className="text-xs bg-secondary px-2 py-1 rounded font-mono">{t}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    <div className="space-y-3">
                      {buildGuide.steps.map((step: any) => (
                        <div key={step.stepNumber} className="rounded-lg border border-border p-4">
                          <div className="flex items-start gap-3">
                            <div className="shrink-0 w-7 h-7 rounded-full bg-primary/20 flex items-center justify-center text-xs font-mono text-primary font-bold">
                              {step.stepNumber}
                            </div>
                            <div className="flex-1">
                              <p className="font-semibold text-sm text-foreground mb-1">{step.title}</p>
                              <p className="text-sm text-muted-foreground">{step.description}</p>
                              {step.warning && (
                                <p className="mt-2 text-xs text-yellow-400 flex items-center gap-1">
                                  <AlertTriangle className="h-3 w-3 shrink-0" />{step.warning}
                                </p>
                              )}
                            </div>
                          </div>
                        </div>
                      ))}
                    </div>
                    {buildGuide.troubleshooting && (
                      <div className="rounded-lg border border-border/50 bg-secondary/20 p-4">
                        <p className="text-xs font-mono text-muted-foreground uppercase mb-2">Troubleshooting</p>
                        <p className="text-sm text-muted-foreground">{buildGuide.troubleshooting}</p>
                      </div>
                    )}
                  </>
                ) : (
                  <p className="text-muted-foreground text-sm">Build guide not yet generated.</p>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          {/* EDUCATION */}
          <TabsContent value="edu">
            <Card>
              <CardHeader className="pb-3 flex flex-row items-center justify-between">
                <CardTitle className="text-base">Education Pack</CardTitle>
                <RefineBar projectId={id} section="educationPack" />
              </CardHeader>
              <CardContent className="space-y-4">
                {educationPack ? (
                  <>
                    {educationPack.ageGroups?.length > 0 && (
                      <div className="flex flex-wrap gap-2">
                        {educationPack.ageGroups.map((g: string, i: number) => (
                          <Badge key={i} variant="outline" className="text-xs">{g}</Badge>
                        ))}
                      </div>
                    )}
                    {educationPack.learningObjectives?.length > 0 && (
                      <div>
                        <p className="text-xs font-mono text-muted-foreground uppercase mb-2">Learning Objectives</p>
                        <ul className="space-y-1">
                          {educationPack.learningObjectives.map((obj: string, i: number) => (
                            <li key={i} className="text-sm text-muted-foreground flex items-start gap-2">
                              <CheckCircle className="h-3 w-3 text-emerald-400 shrink-0 mt-0.5" />{obj}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {educationPack.ngssAlignments?.length > 0 && (
                      <div>
                        <p className="text-xs font-mono text-muted-foreground uppercase mb-2">NGSS Alignments</p>
                        <ul className="space-y-1">
                          {educationPack.ngssAlignments.map((n: string, i: number) => (
                            <li key={i} className="text-xs font-mono text-muted-foreground">• {n}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {educationPack.lessonPlan && (
                      <div>
                        <p className="text-xs font-mono text-muted-foreground uppercase mb-2">Lesson Plan</p>
                        <div className="text-sm text-muted-foreground bg-secondary/30 rounded-lg p-4 whitespace-pre-wrap font-mono text-xs max-h-64 overflow-auto">
                          {educationPack.lessonPlan}
                        </div>
                      </div>
                    )}
                    {educationPack.worksheetMarkdown && (
                      <div>
                        <p className="text-xs font-mono text-muted-foreground uppercase mb-2">Student Worksheet</p>
                        <div className="text-sm text-muted-foreground bg-secondary/30 rounded-lg p-4 whitespace-pre-wrap font-mono text-xs max-h-64 overflow-auto">
                          {educationPack.worksheetMarkdown}
                        </div>
                      </div>
                    )}
                    {educationPack.reflectionPrompts?.length > 0 && (
                      <div>
                        <p className="text-xs font-mono text-muted-foreground uppercase mb-2">Reflection Prompts</p>
                        <ul className="space-y-2">
                          {educationPack.reflectionPrompts.map((p: string, i: number) => (
                            <li key={i} className="text-sm text-muted-foreground border border-border/50 rounded p-3 italic">{p}</li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </>
                ) : (
                  <div className="text-center py-8 text-muted-foreground">
                    <BookOpen className="h-10 w-10 mx-auto mb-2 opacity-30" />
                    <p className="text-sm">Enable Education Mode in your profile to generate lesson plans, NGSS alignments, and worksheets.</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      )}

      <p className="text-xs text-muted-foreground/60 font-mono text-center mt-2">
        DISCLAIMER: Designs are for educational and inspirational purposes only. Verify before fabrication.
      </p>
    </div>
  );
}
