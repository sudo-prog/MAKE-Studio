import { useGetProject, useGetProjectSections } from "@workspace/api-client-react";
import { useParams } from "wouter";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { Settings, Cpu, Cuboid, ListOrdered, BookOpen, Share2, Download } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function ProjectDetail() {
  const params = useParams();
  const id = parseInt(params.id || "0", 10);

  const { data: project, isLoading: loadingProject } = useGetProject(id);
  const { data: sections, isLoading: loadingSections } = useGetProjectSections(id);

  if (loadingProject || !project) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-12 w-[300px] bg-card" />
        <Skeleton className="h-[400px] w-full bg-card" />
      </div>
    );
  }

  const isGenerating = project.status === "generating";

  return (
    <div className="flex flex-col h-[calc(100vh-8rem)]">
      {/* Header */}
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4 mb-6 shrink-0">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-3xl font-bold tracking-tight text-primary">{project.title}</h1>
            <Badge variant="outline" className={
              project.status === 'ready' ? 'border-green-500 text-green-500' :
              project.status === 'generating' ? 'border-yellow-500 text-yellow-500 animate-pulse' :
              'border-muted-foreground text-muted-foreground'
            }>
              {project.status.toUpperCase()}
            </Badge>
          </div>
          <p className="text-muted-foreground mt-1 text-sm font-mono max-w-2xl truncate">
            {project.description || project.prompt}
          </p>
        </div>
        
        <div className="flex gap-2">
          <Button variant="outline" size="sm">
            <Share2 className="mr-2 h-4 w-4" /> Share
          </Button>
          <Button variant="default" size="sm" disabled={isGenerating}>
            <Download className="mr-2 h-4 w-4" /> Export ZIP
          </Button>
        </div>
      </div>

      {isGenerating ? (
        <Card className="bg-secondary/30 border-primary/20 flex-1 flex flex-col items-center justify-center p-12">
          <div className="text-center space-y-6">
            <div className="inline-block relative">
              <div className="w-16 h-16 border-4 border-primary/30 border-t-primary rounded-full animate-spin"></div>
              <Cpu className="absolute top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2 text-primary h-6 w-6" />
            </div>
            <div>
              <h3 className="text-xl font-bold text-foreground">Forging Project...</h3>
              <p className="text-muted-foreground font-mono text-sm mt-2 animate-pulse">Compiling schematics and generating models</p>
            </div>
          </div>
        </Card>
      ) : (
        <Tabs defaultValue="overview" className="flex-1 flex flex-col min-h-0">
          <TabsList className="grid grid-cols-3 md:grid-cols-6 mb-4 shrink-0 bg-card border border-border">
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="mechanical"><Cuboid className="mr-2 h-3 w-3 hidden md:inline" /> Mech</TabsTrigger>
            <TabsTrigger value="electronics"><Cpu className="mr-2 h-3 w-3 hidden md:inline" /> Elec</TabsTrigger>
            <TabsTrigger value="bom"><ListOrdered className="mr-2 h-3 w-3 hidden md:inline" /> BOM</TabsTrigger>
            <TabsTrigger value="guide"><Settings className="mr-2 h-3 w-3 hidden md:inline" /> Guide</TabsTrigger>
            <TabsTrigger value="edu"><BookOpen className="mr-2 h-3 w-3 hidden md:inline" /> Edu</TabsTrigger>
          </TabsList>

          <div className="flex-1 overflow-auto rounded-md border border-border bg-card">
            <TabsContent value="overview" className="m-0 p-6 h-full">
              <div className="grid md:grid-cols-2 gap-8">
                <div className="space-y-6">
                  <div>
                    <h3 className="text-lg font-semibold mb-2">Project Brief</h3>
                    <p className="text-muted-foreground text-sm leading-relaxed whitespace-pre-wrap bg-secondary/50 p-4 rounded-md font-mono">
                      {project.prompt}
                    </p>
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <Card className="bg-background border-border/50">
                      <CardHeader className="pb-2 pt-4">
                        <CardTitle className="text-xs text-muted-foreground uppercase">Skill Level</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="font-semibold capitalize">{project.skillLevel || 'N/A'}</p>
                      </CardContent>
                    </Card>
                    <Card className="bg-background border-border/50">
                      <CardHeader className="pb-2 pt-4">
                        <CardTitle className="text-xs text-muted-foreground uppercase">Est. Cost</CardTitle>
                      </CardHeader>
                      <CardContent>
                        <p className="font-semibold font-mono">${project.estimatedCost || 'N/A'}</p>
                      </CardContent>
                    </Card>
                  </div>
                </div>
                <div className="bg-secondary/20 rounded-xl border border-border/50 flex items-center justify-center min-h-[300px] overflow-hidden relative group">
                  {project.renderImageUrl ? (
                    <img src={project.renderImageUrl} alt="Render" className="object-cover w-full h-full" />
                  ) : (
                    <div className="text-center text-muted-foreground">
                      <Cuboid className="h-12 w-12 mx-auto mb-2 opacity-20" />
                      <p className="text-sm font-mono">No render available</p>
                    </div>
                  )}
                </div>
              </div>
            </TabsContent>

            <TabsContent value="mechanical" className="m-0 p-6 h-full">
              <div className="flex items-center justify-center h-full text-muted-foreground border-2 border-dashed border-border rounded-lg">
                 <p className="font-mono">Mechanical section data rendered here</p>
              </div>
            </TabsContent>

            <TabsContent value="electronics" className="m-0 p-6 h-full">
               <div className="flex items-center justify-center h-full text-muted-foreground border-2 border-dashed border-border rounded-lg">
                 <p className="font-mono">Electronics schematics rendered here</p>
              </div>
            </TabsContent>

            <TabsContent value="bom" className="m-0 p-6 h-full">
               <div className="flex items-center justify-center h-full text-muted-foreground border-2 border-dashed border-border rounded-lg">
                 <p className="font-mono">Tiered BOM rendered here</p>
              </div>
            </TabsContent>

            <TabsContent value="guide" className="m-0 p-6 h-full">
               <div className="flex items-center justify-center h-full text-muted-foreground border-2 border-dashed border-border rounded-lg">
                 <p className="font-mono">Step-by-step build guide rendered here</p>
              </div>
            </TabsContent>

            <TabsContent value="edu" className="m-0 p-6 h-full">
               <div className="flex items-center justify-center h-full text-muted-foreground border-2 border-dashed border-border rounded-lg">
                 <p className="font-mono">Education pack and lesson plans rendered here</p>
              </div>
            </TabsContent>
          </div>
        </Tabs>
      )}
    </div>
  );
}
