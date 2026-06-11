import { useRoute } from "wouter";
import { useGetPublicProject, getGetPublicProjectQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Download, GitFork, ExternalLink, AlertCircle } from "lucide-react";
import { Link } from "wouter";

export default function PublicProject() {
  const [, params] = useRoute("/share/:slug");
  const slug = params?.slug ?? "";
  const { data: project, isLoading, isError } = useGetPublicProject(slug, {
    query: { queryKey: getGetPublicProjectQueryKey(slug), enabled: !!slug },
  });

  if (isLoading) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12">
        <div className="animate-pulse space-y-4">
          <div className="h-8 bg-secondary rounded w-1/2" />
          <div className="h-4 bg-secondary rounded w-1/3" />
          <div className="h-48 bg-secondary rounded" />
        </div>
      </div>
    );
  }

  if (isError || !project) {
    return (
      <div className="max-w-4xl mx-auto px-4 py-12 text-center">
        <AlertCircle className="h-12 w-12 text-muted-foreground mx-auto mb-4" />
        <h2 className="text-xl font-bold mb-2">Project not found</h2>
        <p className="text-muted-foreground mb-6">This project doesn't exist or isn't public.</p>
        <Button asChild variant="outline"><Link href="/gallery">Browse Gallery</Link></Button>
      </div>
    );
  }

  const sections = (project as any).sections ?? {};

  return (
    <div className="max-w-4xl mx-auto px-4 py-8">
      {/* Header */}
      <div className="mb-8">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div>
            <h1 className="text-2xl font-bold text-foreground">{project.title}</h1>
            <p className="text-muted-foreground mt-1 text-sm">{project.description}</p>
            <div className="flex gap-2 mt-3 flex-wrap">
              {project.category && <Badge variant="outline">{project.category}</Badge>}
              {project.skillLevel && <Badge variant="outline" className="capitalize">{project.skillLevel}</Badge>}
              {project.estimatedCost && <Badge variant="outline">${project.estimatedCost} est.</Badge>}
              {sections.safety?.riskScore && (
                <Badge variant="outline" className={
                  sections.safety.riskScore <= 3 ? "text-emerald-400" :
                  sections.safety.riskScore <= 6 ? "text-yellow-400" : "text-red-400"
                }>
                  Risk: {sections.safety.riskScore}/10
                </Badge>
              )}
            </div>
          </div>
          <div className="flex gap-2">
            <Button asChild variant="outline" size="sm">
              <Link href="/sign-up">
                <GitFork className="h-4 w-4 mr-1" />Fork &amp; Remix
              </Link>
            </Button>
            <Button asChild size="sm">
              <a href={`/api/share/${(project as any).shareSlug}/export`} download>
                <Download className="h-4 w-4 mr-1" />Download ZIP
              </a>
            </Button>
          </div>
        </div>
      </div>

      <Tabs defaultValue="bom">
        <TabsList className="mb-6">
          <TabsTrigger value="bom">Bill of Materials</TabsTrigger>
          <TabsTrigger value="build">Build Guide</TabsTrigger>
          <TabsTrigger value="mechanical">Mechanical</TabsTrigger>
        </TabsList>

        <TabsContent value="bom">
          {sections.bom?.tiers?.balanced ? (
            <div className="space-y-2">
              {sections.bom.tiers.balanced.map((item: any, i: number) => (
                <Card key={i}>
                  <CardContent className="p-3 flex items-center justify-between gap-4">
                    <div className="flex-1">
                      <p className="text-sm font-medium">{item.name}</p>
                      <p className="text-xs text-muted-foreground">{item.supplier} · {item.partNumber ?? "N/A"}</p>
                    </div>
                    <div className="text-right shrink-0">
                      <p className="text-sm font-mono">{item.quantity} {item.unit}</p>
                      <p className="text-xs text-primary">${item.estimatedPrice}</p>
                    </div>
                    {item.affiliateUrl && (
                      <a href={item.affiliateUrl} target="_blank" rel="noopener noreferrer">
                        <ExternalLink className="h-4 w-4 text-muted-foreground hover:text-primary" />
                      </a>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">BOM not available in this preview.</p>
          )}
        </TabsContent>

        <TabsContent value="build">
          {sections.buildGuide?.steps ? (
            <div className="space-y-4">
              {sections.buildGuide.steps.map((step: any) => (
                <Card key={step.stepNumber}>
                  <CardContent className="p-4">
                    <p className="text-xs text-primary font-mono mb-1">Step {step.stepNumber}</p>
                    <p className="font-semibold text-sm mb-2">{step.title}</p>
                    <p className="text-sm text-muted-foreground">{step.description}</p>
                    {step.warning && (
                      <p className="text-xs text-yellow-400 mt-2 flex items-center gap-1">
                        <AlertCircle className="h-3 w-3" />{step.warning}
                      </p>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          ) : (
            <p className="text-muted-foreground text-sm">Build guide not available.</p>
          )}
        </TabsContent>

        <TabsContent value="mechanical">
          {sections.mechanical?.openScadCode ? (
            <pre className="text-xs font-mono bg-secondary p-4 rounded-lg overflow-auto max-h-96 text-emerald-300">
              {sections.mechanical.openScadCode}
            </pre>
          ) : (
            <p className="text-muted-foreground text-sm">Mechanical data not available.</p>
          )}
        </TabsContent>
      </Tabs>

      <div className="mt-8 p-4 bg-secondary/30 rounded-lg border border-border text-xs text-muted-foreground">
        DISCLAIMER: This design is for educational and inspirational purposes only. Verify all designs before fabrication.
      </div>
    </div>
  );
}
