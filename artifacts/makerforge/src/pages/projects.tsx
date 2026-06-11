import { useState } from "react";
import { Link } from "wouter";
import { useListProjects, useDeleteProject, getListProjectsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter } from "@/components/ui/card";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Plus, Search, MoreVertical, Trash2, Eye, Zap, Clock, CheckCircle, AlertCircle } from "lucide-react";

const STATUS_CONFIG: Record<string, { label: string; icon: React.ReactNode; className: string }> = {
  ready: { label: "Ready", icon: <CheckCircle className="h-3 w-3" />, className: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30" },
  generating: { label: "Generating", icon: <Zap className="h-3 w-3 animate-pulse" />, className: "bg-blue-500/20 text-blue-400 border-blue-500/30" },
  draft: { label: "Draft", icon: <Clock className="h-3 w-3" />, className: "bg-slate-500/20 text-slate-400 border-slate-500/30" },
  error: { label: "Error", icon: <AlertCircle className="h-3 w-3" />, className: "bg-red-500/20 text-red-400 border-red-500/30" },
};

export default function ProjectList() {
  const queryClient = useQueryClient();
  const [search, setSearch] = useState("");
  const [page, setPage] = useState(1);

  const projectParams = { page, limit: 20, search };
  const { data, isLoading } = useListProjects(projectParams, {
    query: { queryKey: getListProjectsQueryKey(projectParams) },
  });
  const deleteMutation = useDeleteProject({
    mutation: {
      onSuccess: () => queryClient.invalidateQueries({ queryKey: getListProjectsQueryKey() }),
    },
  });

  const projects = data?.items ?? [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-8">
        <div>
          <h1 className="text-2xl font-bold text-foreground">My Projects</h1>
          <p className="text-muted-foreground text-sm mt-1">{data?.total ?? 0} projects total</p>
        </div>
        <Button asChild>
          <Link href="/create">
            <Plus className="h-4 w-4 mr-2" />
            New Project
          </Link>
        </Button>
      </div>

      <div className="relative mb-6">
        <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
        <Input
          placeholder="Search projects..."
          className="pl-10"
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
        />
      </div>

      {isLoading ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {Array.from({ length: 6 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-32 bg-secondary rounded-lg mb-3" />
                <div className="h-4 bg-secondary rounded w-3/4 mb-2" />
                <div className="h-3 bg-secondary rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <div className="text-4xl mb-4">⚙</div>
          <p className="font-medium mb-2">No projects yet</p>
          <p className="text-sm mb-6">Describe a hardware idea and let MakerForge build the complete package.</p>
          <Button asChild>
            <Link href="/create"><Plus className="h-4 w-4 mr-2" />Start a new project</Link>
          </Button>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => {
            const status = STATUS_CONFIG[p.status ?? "draft"] ?? STATUS_CONFIG.draft;
            return (
              <Card key={p.id} className="group hover:border-primary/50 transition-colors overflow-hidden">
                <div className="h-32 bg-secondary/50 flex items-center justify-center text-muted-foreground relative overflow-hidden">
                  {p.renderImageUrl ? (
                    <img src={p.renderImageUrl} alt={p.title} className="w-full h-full object-cover" />
                  ) : (
                    <div className="font-mono text-2xl opacity-30">⚙</div>
                  )}
                  <div className="absolute top-2 right-2">
                    <Badge variant="outline" className={`text-[10px] flex items-center gap-1 ${status.className}`}>
                      {status.icon}
                      {status.label}
                    </Badge>
                  </div>
                </div>
                <CardContent className="p-4 pb-2">
                  <h3 className="font-semibold text-foreground truncate">{p.title}</h3>
                  <p className="text-xs text-muted-foreground mt-1">
                    {p.category ?? "Uncategorized"} {p.estimatedCost ? `· $${p.estimatedCost}` : ""}
                  </p>
                </CardContent>
                <CardFooter className="px-4 pb-4 flex items-center justify-between">
                  <Button variant="ghost" size="sm" asChild>
                    <Link href={`/projects/${p.id}`}><Eye className="h-4 w-4 mr-1" />View</Link>
                  </Button>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="icon" className="h-8 w-8">
                        <MoreVertical className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem
                        className="text-destructive focus:text-destructive"
                        onClick={() => deleteMutation.mutate({ id: p.id! })}
                      >
                        <Trash2 className="h-4 w-4 mr-2" />Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </CardFooter>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}
