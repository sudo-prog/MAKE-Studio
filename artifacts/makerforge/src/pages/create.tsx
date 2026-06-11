import { useState, useCallback, useRef, useEffect } from "react";
import { useLocation } from "wouter";
import { useUser } from "@clerk/react";
import { useGenerateProject, useGenerateGuestProject, GuestGenerateResult } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Progress } from "@/components/ui/progress";
import { Badge } from "@/components/ui/badge";
import { Sparkles, Terminal, Settings2, Cpu, CheckCircle, ImagePlus, X, ChevronRight } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

function getOrCreateGuestId(): string {
  const key = "mf_guest_id";
  let id = localStorage.getItem(key);
  if (!id) {
    id = crypto.randomUUID().replace(/-/g, "").slice(0, 24);
    localStorage.setItem(key, id);
  }
  return id;
}

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
          <p className="text-lg font-bold">Forging your project...</p>
          <p className="text-sm font-mono text-primary animate-pulse">{GENERATION_STEPS[stepIndex]}</p>
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
              {i < stepIndex
                ? <CheckCircle className="h-3 w-3 shrink-0" />
                : i === stepIndex
                ? <div className="h-3 w-3 border border-primary rounded-full animate-pulse shrink-0" />
                : <div className="h-3 w-3 border border-muted-foreground/30 rounded-full shrink-0" />}
              {step}
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// --- Image upload widget ---
function ImageUpload({ value, onChange }: { value: string | null; onChange: (url: string | null) => void }) {
  const ref = useRef<HTMLInputElement>(null);
  const onFile = useCallback((e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = (ev) => onChange(ev.target?.result as string);
    reader.readAsDataURL(file);
  }, [onChange]);

  if (value) {
    return (
      <div className="relative inline-block">
        <img src={value} alt="Reference" className="h-28 w-28 object-cover rounded-lg border border-border" />
        <button onClick={() => onChange(null)}
          className="absolute -top-2 -right-2 bg-destructive rounded-full p-0.5 text-white">
          <X className="h-3 w-3" />
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => ref.current?.click()}
      className="flex items-center gap-2 text-xs text-muted-foreground border border-dashed border-border rounded-lg px-3 py-2 hover:border-primary/50 hover:text-primary transition-colors"
    >
      <ImagePlus className="h-4 w-4" />
      Add reference image (optional)
      <input ref={ref} type="file" accept="image/*" className="hidden" onChange={onFile} />
    </button>
  );
}

// --- Adaptive guided questionnaire ---
const GUIDED_QUESTIONS = [
  {
    id: "category",
    question: "What kind of project do you want to build?",
    type: "choice" as const,
    options: [
      { label: "Electronics / IoT", value: "Electronics" },
      { label: "Robotics / Automation", value: "Robotics" },
      { label: "Energy / Solar / Power", value: "Energy" },
      { label: "Lighting / LED", value: "Lighting" },
      { label: "CNC / Manufacturing", value: "CNC" },
      { label: "Mechanical / Structural", value: "Mechanical" },
      { label: "Accessibility / Assistive Tech", value: "Accessibility" },
    ],
  },
  {
    id: "skillLevel",
    question: "What's your build experience?",
    type: "choice" as const,
    options: [
      { label: "Beginner — I prefer snap-fit, no soldering", value: "beginner" },
      { label: "Intermediate — I can solder and follow schematics", value: "intermediate" },
      { label: "Advanced — SMD components, custom PCBs", value: "advanced" },
    ],
  },
  {
    id: "budget",
    question: "What's your budget target?",
    type: "choice" as const,
    options: [
      { label: "Budget ($5–$20) — AliExpress sourcing", value: "budget" },
      { label: "Balanced ($20–$80) — Digi-Key / Mouser", value: "balanced" },
      { label: "Premium ($80+) — Best components available", value: "premium" },
    ],
  },
  {
    id: "powerSource",
    question: "How will your project be powered?",
    type: "choice" as const,
    options: [
      { label: "USB / wall power", value: "USB / wall power" },
      { label: "Battery (LiPo / AA / lithium)", value: "battery" },
      { label: "Solar panel", value: "solar" },
      { label: "Mains AC (240V/120V)", value: "mains AC" },
      { label: "Not applicable / mechanical only", value: "none" },
    ],
  },
  {
    id: "description",
    question: "Describe what you want it to do",
    type: "text" as const,
    placeholder: "What problem does it solve? Any size constraints, required outputs, special features?",
  },
];

function AdaptiveQuestionnaire({
  onSubmit,
  disabled,
}: {
  onSubmit: (answers: Record<string, string>) => void;
  disabled: boolean;
}) {
  const [step, setStep] = useState(0);
  const [answers, setAnswers] = useState<Record<string, string>>({});
  const [textVal, setTextVal] = useState("");

  const question = GUIDED_QUESTIONS[step];
  const isLast = step === GUIDED_QUESTIONS.length - 1;

  const handleChoice = (value: string) => {
    const next = { ...answers, [question.id]: value };
    setAnswers(next);
    if (!isLast) {
      setStep((s) => s + 1);
    } else {
      onSubmit(next);
    }
  };

  const handleText = () => {
    if (!textVal.trim()) return;
    const next = { ...answers, [question.id]: textVal };
    setAnswers(next);
    onSubmit(next);
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center gap-2">
        {GUIDED_QUESTIONS.map((_, i) => (
          <div key={i} className={`h-1.5 flex-1 rounded-full transition-all ${
            i < step ? "bg-primary" : i === step ? "bg-primary/50" : "bg-border"
          }`} />
        ))}
      </div>

      <div className="space-y-1">
        <p className="text-xs font-mono text-muted-foreground uppercase">
          Step {step + 1} of {GUIDED_QUESTIONS.length}
        </p>
        <p className="text-lg font-semibold">{question.question}</p>
        {Object.entries(answers).length > 0 && (
          <div className="flex flex-wrap gap-1.5 pt-1">
            {Object.entries(answers).map(([k, v]) => (
              <Badge key={k} variant="outline" className="text-[10px] font-mono text-primary border-primary/30">
                {k}: {v}
              </Badge>
            ))}
          </div>
        )}
      </div>

      {question.type === "choice" ? (
        <div className="grid gap-2">
          {question.options!.map((opt) => (
            <button
              key={opt.value}
              onClick={() => handleChoice(opt.value)}
              disabled={disabled}
              className="flex items-center justify-between p-3 rounded-lg border border-border bg-secondary/20 hover:border-primary/50 hover:bg-primary/5 text-left text-sm transition-all group"
            >
              <span>{opt.label}</span>
              <ChevronRight className="h-4 w-4 text-muted-foreground group-hover:text-primary transition-colors" />
            </button>
          ))}
        </div>
      ) : (
        <div className="space-y-3">
          <Textarea
            placeholder={question.placeholder}
            className="min-h-[120px] font-mono bg-secondary/30 resize-y"
            value={textVal}
            onChange={(e) => setTextVal(e.target.value)}
          />
          <Button onClick={handleText} disabled={disabled || !textVal.trim()} className="w-full">
            <Sparkles className="mr-2 h-4 w-4" />
            {disabled ? "Starting..." : "Forge Project"}
          </Button>
        </div>
      )}

      {step > 0 && question.type !== "text" && (
        <button onClick={() => setStep((s) => s - 1)} className="text-xs text-muted-foreground hover:text-primary">
          ← Back
        </button>
      )}
    </div>
  );
}

export default function CreateProject() {
  const { toast } = useToast();
  const { isSignedIn } = useUser();
  const generateMutation = useGenerateProject();
  const guestMutation = useGenerateGuestProject();
  const [prompt, setPrompt] = useState("");
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [generatingId, setGeneratingId] = useState<number | null>(null);

  const isPending = generateMutation.isPending || guestMutation.isPending;

  const doGenerate = useCallback((data: Record<string, string>) => {
    const fullPrompt = [
      data.description ?? prompt,
      data.powerSource && data.powerSource !== "none" ? `Powered by: ${data.powerSource}` : "",
    ].filter(Boolean).join(". ");

    if (!fullPrompt.trim()) {
      toast({ title: "Describe your project", description: "Enter a hardware description to get started.", variant: "destructive" });
      return;
    }

    const onError = (err: any) => {
      const isLimit = err?.data?.upgradeRequired;
      toast({
        title: isLimit ? "Daily limit reached" : "Generation failed",
        description: isLimit
          ? (isSignedIn ? "Upgrade to Pro for unlimited generations." : "Sign up to forge more projects.")
          : (err?.data?.error ?? "Failed to start. Check your AI key is configured."),
        variant: "destructive",
      });
    };

    if (!isSignedIn) {
      const guestId = getOrCreateGuestId();
      guestMutation.mutate({ guestId, data: { prompt: fullPrompt, category: data.category, skillLevel: data.skillLevel, imageUrl: imageUrl ?? null } }, {
        onSuccess: (result: GuestGenerateResult) => setGeneratingId(result.id),
        onError,
      });
      return;
    }

    generateMutation.mutate({
      data: {
        prompt: fullPrompt,
        category: data.category,
        skillLevel: data.skillLevel as any,
        budget: data.budget as any,
        imageUrl: imageUrl ?? undefined,
      },
    }, {
      onSuccess: (result) => setGeneratingId(result.id!),
      onError,
    });
  }, [prompt, imageUrl, isSignedIn, generateMutation, guestMutation, toast]);

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
        <p className="text-muted-foreground mt-2 text-sm">Describe your hardware idea — MakerForge generates OpenSCAD code, electronics, BOM, build guide, and more.</p>
      </div>

      <Tabs defaultValue="chat" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="chat"><Terminal className="mr-2 h-4 w-4" />Prompt Mode</TabsTrigger>
          <TabsTrigger value="guided"><Settings2 className="mr-2 h-4 w-4" />Guided Setup</TabsTrigger>
        </TabsList>

        {/* Prompt mode */}
        <TabsContent value="chat" className="mt-6">
          <Card className="border-primary/20 bg-card">
            <CardHeader>
              <CardTitle>Describe your hardware idea</CardTitle>
              <CardDescription>Be specific about requirements, constraints, and features. Optionally attach a reference image.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <Textarea
                placeholder="I want to build a portable solar charger for hiking. It needs a 10,000mAh battery, USB-C PD at 20W, MPPT charge controller, and a weather-resistant 3D printed case..."
                className="min-h-[180px] font-mono bg-secondary/30 resize-y"
                value={prompt}
                onChange={(e) => setPrompt(e.target.value)}
              />
              <ImageUpload value={imageUrl} onChange={setImageUrl} />
            </CardContent>
            <CardFooter className="flex justify-between border-t border-border/50 pt-6">
              <p className="text-xs text-muted-foreground">1 Forge Credit per generation</p>
              <Button
                onClick={() => doGenerate({ description: prompt })}
                disabled={isPending || !prompt.trim()}
                className="font-semibold"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {isPending ? "Starting..." : "Forge Project"}
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>

        {/* Guided mode */}
        <TabsContent value="guided" className="mt-6">
          <Card className="border-border bg-card">
            <CardHeader>
              <CardTitle>Guided Setup</CardTitle>
              <CardDescription>Answer a few questions and MakerForge will build the perfect prompt for you.</CardDescription>
            </CardHeader>
            <CardContent>
              <AdaptiveQuestionnaire onSubmit={doGenerate} disabled={isPending} />
            </CardContent>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
