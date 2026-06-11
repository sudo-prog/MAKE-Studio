import { useState } from "react";
import { Link } from "wouter";
import { useListTemplates, useForkTemplate, getListProjectsQueryKey, getListTemplatesQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import { GitFork, Zap } from "lucide-react";

const CATEGORIES = ["All", "Energy", "IoT", "Robotics", "Lighting", "Accessibility", "CNC"];
const DIFFICULTY_COLORS: Record<string, string> = {
  beginner: "bg-emerald-500/20 text-emerald-400",
  intermediate: "bg-yellow-500/20 text-yellow-400",
  advanced: "bg-red-500/20 text-red-400",
};

export default function Templates() {
  const queryClient = useQueryClient();
  const [category, setCategory] = useState<string | undefined>(undefined);
  const templateParams = category && category !== "All" ? { category } : {};
  const { data: templates, isLoading } = useListTemplates(templateParams, {
    query: { queryKey: getListTemplatesQueryKey(templateParams) },
  });
  const forkMutation = useForkTemplate({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() }),
    },
  });

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Project Templates</h1>
        <p className="text-muted-foreground text-sm mt-1">Fork a template to jump-start your next build</p>
      </div>

      <div className="flex gap-2 flex-wrap mb-8">
        {CATEGORIES.map((cat) => (
          <Button
            key={cat}
            variant={category === cat || (cat === "All" && !category) ? "default" : "outline"}
            size="sm"
            onClick={() => setCategory(cat === "All" ? undefined : cat)}
          >
            {cat}
          </Button>
        ))}
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-40 bg-secondary rounded-lg mb-3" />
                <div className="h-4 bg-secondary rounded w-3/4 mb-2" />
                <div className="h-3 bg-secondary rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {(templates ?? []).map((t) => (
            <Card key={t.id} className="group hover:border-primary/50 transition-colors overflow-hidden">
              <div className="h-40 bg-secondary/50 flex items-center justify-center overflow-hidden">
                {t.imageUrl ? (
                  <img src={t.imageUrl} alt={t.title} className="w-full h-full object-cover" />
                ) : (
                  <Zap className="h-12 w-12 text-primary/40" />
                )}
              </div>
              <CardContent className="p-4 pb-2">
                <div className="flex items-start justify-between gap-2 mb-2">
                  <h3 className="font-semibold text-foreground">{t.title}</h3>
                  <Badge variant="outline" className={`text-[10px] capitalize ${DIFFICULTY_COLORS[t.difficulty ?? "beginner"]}`}>
                    {t.difficulty}
                  </Badge>
                </div>
                <p className="text-xs text-muted-foreground line-clamp-2">{t.description}</p>
                <div className="flex flex-wrap gap-1 mt-3">
                  {((t.tags as string[]) ?? []).slice(0, 3).map((tag) => (
                    <Badge key={tag} variant="secondary" className="text-[10px]">{tag}</Badge>
                  ))}
                </div>
              </CardContent>
              <CardFooter className="px-4 pb-4">
                <Button
                  className="w-full"
                  variant="outline"
                  size="sm"
                  disabled={forkMutation.isPending}
                  onClick={() => forkMutation.mutate({ id: t.id! })}
                >
                  <GitFork className="h-4 w-4 mr-2" />
                  Fork Template
                </Button>
              </CardFooter>
            </Card>
          ))}
        </div>
      )}
    </div>
  );
}
