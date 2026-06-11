import { useState, useEffect } from "react";
import { useLocation } from "wouter";
import { useGenerateProject } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Progress } from "@/components/ui/progress";
import { Sparkles, Terminal, Settings2, Cpu, CheckCircle } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const GENERATION_STEPS = [
  "Analyzing hardware requirements...",
  "Designing mechanical structure in OpenSCAD...",
  "Specifying electronics and wiring...",
  "Building tiered bill of materials...",
  "Writing step-by-step build guide...",
  "Generating education pack...",
  "Packaging complete project...",
];

function GenerationProgress({ projectId }: { projectId: number }) {
  const [, setLocation] = useLocation();
  const [stepIndex, setStepIndex] = useState(0);
  const [progress, setProgress] = useState(0);

  useEffect(() => {
    const stepDuration = 7000;
    const interval = setInterval(() => {
      setStepIndex((i) => {
        const next = i + 1;
        if (next >= GENERATION_STEPS.length) {
          clearInterval(interval);
          setTimeout(() => setLocation(`/projects/${projectId}`), 1200);
          return i;
        }
        return next;
      });
    }, stepDuration);
    return () => clearInterval(interval);
  }, [projectId, setLocation]);

  useEffect(() => {
    const target = Math.round(((stepIndex + 1) / GENERATION_STEPS.length) * 100);
    const timer = setInterval(() => {
      setProgress((p) => {
        if (p >= target) { clearInterval(timer); return p; }
        return Math.min(p + 2, target);
      });
    }, 50);
    return () => clearInterval(timer);
  }, [stepIndex]);

  return (
    <Card className="border-primary/30 bg-card/80 max-w-xl mx-auto mt-12">
      <CardContent className="p-10 flex flex-col items-center gap-6">
        <div className="relative">
          <div className="w-20 h-20 border-4 border-primary/20 border-t-primary rounded-full animate-spin" />
          <Cpu className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 h-8 w-8 text-primary" />
        </div>
        <div className="text-center space-y-2 w-full">
          <p className="text-lg font-bold text-foreground">Forging your project...</p>
          <p className="text-sm font-mono text-primary animate-pulse">
            {GENERATION_STEPS[stepIndex]}
          </p>
        </div>
        <div className="w-full space-y-2">
          <Progress value={progress} className="h-2" />
          <div className="flex justify-between text-xs text-muted-foreground font-mono">
            <span>{progress}% complete</span>
            <span>Step {Math.min(stepIndex + 1, GENERATION_STEPS.length)} of {GENERATION_STEPS.length}</span>
          </div>
        </div>
        <div className="w-full space-y-1">
          {GENERATION_STEPS.map((step, i) => (
            <div key={step} className={`flex items-center gap-2 text-xs font-mono transition-all ${
              i < stepIndex ? "text-emerald-400" : i === stepIndex ? "text-primary" : "text-muted-foreground/40"
            }`}>
              {i < stepIndex ? (
                <CheckCircle className="h-3 w-3 shrink-0" />
              ) : i === stepIndex ? (
                <div className="h-3 w-3 border border-primary rounded-full animate-pulse shrink-0" />
              ) : (
                <div className="h-3 w-3 border border-muted-foreground/30 rounded-full shrink-0" />
              )}
              {step}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

export default function CreateProject() {
  const { toast } = useToast();
  const generateMutation = useGenerateProject();

  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [skillLevel, setSkillLevel] = useState<"beginner" | "intermediate" | "advanced">("intermediate");
  const [budget, setBudget] = useState<"budget" | "balanced" | "premium">("balanced");
  const [category, setCategory] = useState("Electronics");
  const [generatingId, setGeneratingId] = useState<number | null>(null);

  const handleGenerate = () => {
    const fullPrompt = title ? `[${title}] ${prompt}` : prompt;
    if (!fullPrompt.trim()) {
      toast({ title: "Describe your project", description: "Enter a hardware description to get started.", variant: "destructive" });
      return;
    }

    generateMutation.mutate({
      data: {
        prompt: fullPrompt,
        category,
        skillLevel,
        budget,
      },
    }, {
      onSuccess: (data) => {
        setGeneratingId(data.id!);
      },
      onError: (err: any) => {
        const msg = err?.data?.error ?? "Failed to start generation. Check that your AI API key is configured.";
        const isLimit = err?.data?.upgradeRequired;
        toast({
          title: isLimit ? "Daily limit reached" : "Generation failed",
          description: isLimit ? "Upgrade to Pro for unlimited generations." : msg,
          variant: "destructive",
        });
      },
    });
  };

  if (generatingId !== null) {
    return (
      <div className="max-w-4xl mx-auto">
        <h1 className="text-3xl font-bold tracking-tight mb-2">Forging Project</h1>
        <p className="text-muted-foreground text-sm font-mono">AI is generating your complete project package</p>
        <GenerationProgress projectId={generatingId} />
      </div>
    );
  }

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Forge New Project</h1>
        <p className="text-muted-foreground mt-2 text-sm">Describe your hardware idea and MakerForge will generate OpenSCAD code, electronics, a tiered BOM, build guide, and more.</p>
      </div>

      <Tabs defaultValue="chat" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="chat"><Terminal className="mr-2 h-4 w-4" />Prompt Mode</TabsTrigger>
          <TabsTrigger value="guided"><Settings2 className="mr-2 h-4 w-4" />Guided Form</TabsTrigger>
        </TabsList>

        <TabsContent value="chat" className="mt-6">
          <Card className="border-primary/20 bg-card">
            <CardHeader>
              <CardTitle>Describe your hardware idea</CardTitle>
              <CardDescription>Be specific about requirements, constraints, and features. The more detail, the better the output.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Project Name <span className="text-muted-foreground">(optional)</span></Label>
                <Input
                  id="title"
                  placeholder="e.g. Solar Backpack Charger"
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                  className="font-mono"
                />
              </div>
              <div className="space-y-2">
                <Label htmlFor="prompt">Engineering Prompt</Label>
                <Textarea
                  id="prompt"
                  placeholder="I want to build a portable solar charger for hiking. It needs a 10,000mAh battery, USB-C PD output at 20W, MPPT charge controller, and a weather-resistant 3D printed case..."
                  className="min-h-[180px] font-mono bg-secondary/30 resize-y"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t border-border/50 pt-6">
              <p className="text-xs text-muted-foreground">Uses 1 Forge Credit per generation</p>
              <Button onClick={handleGenerate} disabled={generateMutation.isPending} className="font-semibold">
                <Sparkles className="mr-2 h-4 w-4" />
                {generateMutation.isPending ? "Starting..." : "Forge Project"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        <TabsContent value="guided" className="mt-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle>Guided Setup</CardTitle>
              <CardDescription>Step-by-step parameter configuration for precision generation.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
              <div className="space-y-2">
                <Label htmlFor="g-title">Project Name</Label>
                <Input id="g-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="e.g. Smart Greenhouse Controller" />
              </div>

              <div className="space-y-2">
                <Label htmlFor="g-category">Category</Label>
                <select
                  id="g-category"
                  className="w-full rounded-md border border-border bg-background px-3 py-2 text-sm text-foreground"
                  value={category}
                  onChange={(e) => setCategory(e.target.value)}
                >
                  {["Electronics", "IoT", "Robotics", "Energy", "Mechanical", "CNC", "Lighting", "Accessibility"].map((c) => (
                    <option key={c} value={c}>{c}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-3">
                <Label>Skill Level</Label>
                <RadioGroup value={skillLevel} onValueChange={(v: any) => setSkillLevel(v)} className="flex flex-col space-y-1">
                  {[
                    { value: "beginner", label: "Beginner — No soldering, snap-fit assemblies" },
                    { value: "intermediate", label: "Intermediate — Basic soldering, standard components" },
                    { value: "advanced", label: "Advanced — SMD components, custom PCBs" },
                  ].map(({ value, label }) => (
                    <div key={value} className="flex items-center space-x-2 border border-border p-3 rounded-md bg-secondary/20">
                      <RadioGroupItem value={value} id={`skill-${value}`} />
                      <Label htmlFor={`skill-${value}`} className="cursor-pointer flex-1">{label}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-3">
                <Label>Budget Tier</Label>
                <RadioGroup value={budget} onValueChange={(v: any) => setBudget(v)} className="flex flex-col space-y-1">
                  {[
                    { value: "budget", label: "Budget — AliExpress / LCSC sourcing" },
                    { value: "balanced", label: "Balanced — Digi-Key / Mouser quality" },
                    { value: "premium", label: "Premium — High-spec, local suppliers" },
                  ].map(({ value, label }) => (
                    <div key={value} className="flex items-center space-x-2 border border-border p-3 rounded-md bg-secondary/20">
                      <RadioGroupItem value={value} id={`budget-${value}`} />
                      <Label htmlFor={`budget-${value}`} className="cursor-pointer flex-1">{label}</Label>
                    </div>
                  ))}
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="g-prompt">Describe what you want to build</Label>
                <Textarea
                  id="g-prompt"
                  placeholder="What does it do? How is it powered? Physical size constraints? Special requirements?"
                  className="min-h-[120px]"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-end border-t border-border/50 pt-6">
              <Button onClick={handleGenerate} disabled={generateMutation.isPending}>
                <Sparkles className="mr-2 h-4 w-4" />
                {generateMutation.isPending ? "Starting..." : "Forge Project"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
