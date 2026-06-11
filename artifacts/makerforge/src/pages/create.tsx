import { useState } from "react";
import { useLocation } from "wouter";
import { useCreateProject } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { RadioGroup, RadioGroupItem } from "@/components/ui/radio-group";
import { Sparkles, Terminal, Settings2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

export default function CreateProject() {
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const createMutation = useCreateProject();
  
  const [prompt, setPrompt] = useState("");
  const [title, setTitle] = useState("");
  const [skillLevel, setSkillLevel] = useState<"beginner" | "intermediate" | "advanced">("intermediate");

  const handleCreate = () => {
    if (!prompt.trim() || !title.trim()) {
      toast({
        title: "Missing fields",
        description: "Please provide both a title and a description of your project.",
        variant: "destructive"
      });
      return;
    }

    createMutation.mutate({
      data: {
        title,
        prompt,
        skillLevel,
        category: "electronics" // Default fallback
      }
    }, {
      onSuccess: (data) => {
        toast({ title: "Project Forging Started", description: "Navigating to workshop..." });
        setLocation(`/projects/${data.id}`);
      },
      onError: () => {
        toast({
          title: "Error",
          description: "Failed to create project. Please try again.",
          variant: "destructive"
        });
      }
    });
  };

  return (
    <div className="max-w-4xl mx-auto space-y-6">
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Forge New Project</h1>
        <p className="text-muted-foreground mt-2">Describe what you want to build, and MakerForge will generate the schematics, code, and BOM.</p>
      </div>

      <Tabs defaultValue="chat" className="w-full">
        <TabsList className="grid w-full grid-cols-2 max-w-[400px]">
          <TabsTrigger value="chat"><Terminal className="mr-2 h-4 w-4" /> Prompt Mode</TabsTrigger>
          <TabsTrigger value="guided"><Settings2 className="mr-2 h-4 w-4" /> Guided Form</TabsTrigger>
        </TabsList>
        
        <TabsContent value="chat" className="mt-6">
          <Card className="border-primary/20 bg-card">
            <CardHeader>
              <CardTitle>Describe your hardware idea</CardTitle>
              <CardDescription>Be as specific as possible about requirements, constraints, and features.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-2">
                <Label htmlFor="title">Project Name</Label>
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
                  placeholder="I want to build a portable solar charger for hiking. It needs to have a 10,000mAh battery, output USB-C PD at 20W, and fit in a 3D printed case that is weather-resistant..." 
                  className="min-h-[200px] font-mono bg-secondary/30 resize-y"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-between border-t border-border/50 pt-6">
              <div className="text-xs text-muted-foreground">
                Costs 1 Forge Credit
              </div>
              <Button 
                onClick={handleCreate} 
                disabled={createMutation.isPending}
                className="font-semibold"
              >
                <Sparkles className="mr-2 h-4 w-4" />
                {createMutation.isPending ? "Initializing..." : "Forge Project"}
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
                <Input 
                  id="g-title" 
                  value={title}
                  onChange={(e) => setTitle(e.target.value)}
                />
              </div>
              
              <div className="space-y-3">
                <Label>Target Skill Level</Label>
                <RadioGroup 
                  value={skillLevel} 
                  onValueChange={(v: any) => setSkillLevel(v)}
                  className="flex flex-col space-y-1"
                >
                  <div className="flex items-center space-x-2 border border-border p-3 rounded-md bg-secondary/20">
                    <RadioGroupItem value="beginner" id="r1" />
                    <Label htmlFor="r1" className="cursor-pointer flex-1">Beginner (No soldering required, snap-fit)</Label>
                  </div>
                  <div className="flex items-center space-x-2 border border-border p-3 rounded-md bg-secondary/20">
                    <RadioGroupItem value="intermediate" id="r2" />
                    <Label htmlFor="r2" className="cursor-pointer flex-1">Intermediate (Basic soldering, standard components)</Label>
                  </div>
                  <div className="flex items-center space-x-2 border border-border p-3 rounded-md bg-secondary/20">
                    <RadioGroupItem value="advanced" id="r3" />
                    <Label htmlFor="r3" className="cursor-pointer flex-1">Advanced (SMD components, custom PCBs)</Label>
                  </div>
                </RadioGroup>
              </div>

              <div className="space-y-2">
                <Label htmlFor="g-prompt">Core Functionality</Label>
                <Textarea 
                  id="g-prompt" 
                  placeholder="What does it do? How is it powered? What are the physical constraints?" 
                  className="min-h-[100px]"
                  value={prompt}
                  onChange={(e) => setPrompt(e.target.value)}
                />
              </div>
            </CardContent>
            <CardFooter className="flex justify-end border-t border-border/50 pt-6">
              <Button 
                onClick={handleCreate} 
                disabled={createMutation.isPending}
              >
                <Sparkles className="mr-2 h-4 w-4" />
                Forge Project
              </Button>
            </CardFooter>
          </Card>
        </TabsContent>
      </Tabs>
    </div>
  );
}
