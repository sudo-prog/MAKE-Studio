import { useState, useEffect, useRef } from "react";
import { useGetPublicGallery, getGetPublicGalleryQueryKey, useForkProject } from "@workspace/api-client-react";
import { useUser } from "@clerk/react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Link, useLocation } from "wouter";
import { Zap, Eye, GitFork, Search, X, Loader2, Heart, User2 } from "lucide-react";
import { useToast } from "@/hooks/use-toast";

const CATEGORIES = ["All", "Energy", "IoT", "Robotics", "Lighting", "Accessibility", "CNC", "Electronics", "Mechanical"];
const SKILL_LEVELS = ["All", "Beginner", "Intermediate", "Advanced"];
const MATERIALS = ["All", "PLA", "PETG", "ABS", "Resin", "PCB", "Metal", "Wood", "Fabric"];

export default function Gallery() {
  const { isSignedIn } = useUser();
  const [, setLocation] = useLocation();
  const { toast } = useToast();
  const queryClient = useQueryClient();

  const [category, setCategory] = useState<string | undefined>(undefined);
  const [skillLevel, setSkillLevel] = useState<string | undefined>(undefined);
  const [material, setMaterial] = useState<string | undefined>(undefined);
  const [search, setSearch] = useState("");
  const [searchInput, setSearchInput] = useState("");
  const [page, setPage] = useState(1);
  // Accumulated items across pages for infinite scroll
  const [accumulated, setAccumulated] = useState<any[]>([]);
  const loaderRef = useRef<HTMLDivElement>(null);

  // All filters are passed server-side; no client-side filtering needed
  const galleryParams = {
    page,
    ...(category ? { category } : {}),
    ...(skillLevel ? { skillLevel } : {}),
    ...(search ? { search } : {}),
    ...(material ? { material } : {}),
  };
  const { data, isLoading, isFetching } = useGetPublicGallery(galleryParams, {
    query: { queryKey: getGetPublicGalleryQueryKey(galleryParams) },
  });

  // Accumulate pages — reset on filter change, append on page increase
  useEffect(() => {
    if (!data?.items) return;
    setAccumulated((prev) => (page === 1 ? data.items : [...prev, ...data.items]));
  }, [data?.items, page]);

  // Reset to page 1 when filters change
  useEffect(() => {
    setPage(1);
    setAccumulated([]);
  }, [category, search, skillLevel, material]);

  const forkProject = useForkProject({
    mutation: {
      onSuccess: (data) => {
        toast({ title: "Project forked!", description: "Remix added to your projects." });
        setLocation(`/projects/${data.id}`);
      },
      onError: () => toast({ title: "Sign in to fork projects", variant: "destructive" }),
    },
  });

  // All filtering is server-side
  const projects = accumulated;

  const handleSearch = () => {
    setSearch(searchInput);
    setPage(1);
    setAccumulated([]);
  };

  const clearFilters = () => {
    setCategory(undefined);
    setSkillLevel(undefined);
    setMaterial(undefined);
    setSearch("");
    setSearchInput("");
    setPage(1);
    setAccumulated([]);
    queryClient.invalidateQueries({ queryKey: getGetPublicGalleryQueryKey({}) });
  };

  const hasFilters = !!(category || skillLevel || material || search);
  const hasMore = data?.items && data.items.length >= 20;

  return (
    <div className="p-6 max-w-7xl mx-auto">
      <div className="mb-8">
        <h1 className="text-3xl font-bold text-foreground mb-1">Community Gallery</h1>
        <p className="text-muted-foreground text-sm">Browse, remix, and get inspired by community-built projects</p>
      </div>

      {/* Search bar */}
      <div className="flex gap-2 mb-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <Input
            placeholder="Search projects..."
            value={searchInput}
            onChange={(e) => setSearchInput(e.target.value)}
            onKeyDown={(e) => e.key === "Enter" && handleSearch()}
            className="pl-9"
          />
        </div>
        <Button onClick={handleSearch}>Search</Button>
        {hasFilters && (
          <Button variant="ghost" size="icon" onClick={clearFilters} aria-label="Clear filters" title="Clear filters">
            <X className="h-4 w-4" aria-hidden="true" />
          </Button>
        )}
      </div>

      {/* Category filter */}
      <div className="flex gap-2 flex-wrap mb-3">
        {CATEGORIES.map((cat) => (
          <Button
            key={cat}
            variant={category === cat || (cat === "All" && !category) ? "secondary" : "ghost"}
            size="sm"
            className="text-xs h-7"
            onClick={() => setCategory(cat === "All" ? undefined : cat)}
          >
            {cat}
          </Button>
        ))}
      </div>

      {/* Skill level filter */}
      <div className="flex gap-2 flex-wrap mb-3">
        {SKILL_LEVELS.map((sk) => (
          <Button
            key={sk}
            variant={skillLevel === sk || (sk === "All" && !skillLevel) ? "secondary" : "ghost"}
            size="sm"
            className="text-xs h-7"
            onClick={() => setSkillLevel(sk === "All" ? undefined : sk)}
          >
            {sk}
          </Button>
        ))}
      </div>

      {/* Material filter */}
      <div className="flex gap-2 flex-wrap mb-8 items-center">
        <span className="text-xs text-muted-foreground font-mono uppercase mr-1">Material:</span>
        {MATERIALS.map((mat) => (
          <Button
            key={mat}
            variant={material === mat || (mat === "All" && !material) ? "secondary" : "ghost"}
            size="sm"
            className="text-xs h-7"
            onClick={() => { setMaterial(mat === "All" ? undefined : mat); setPage(1); setAccumulated([]); }}
          >
            {mat}
          </Button>
        ))}
      </div>

      {isLoading && page === 1 ? (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {Array.from({ length: 8 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-36 bg-secondary rounded-lg mb-3" />
                <div className="h-4 bg-secondary rounded w-3/4 mb-2" />
                <div className="h-3 bg-secondary rounded w-1/2" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : projects.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Zap className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium mb-2">
            {hasFilters ? "No projects match your filters" : "No public projects yet"}
          </p>
          <p className="text-sm mb-6">
            {hasFilters ? "Try clearing filters" : "Be the first to share your build!"}
          </p>
          {hasFilters
            ? <Button variant="outline" onClick={clearFilters}>Clear filters</Button>
            : <Button asChild><Link href="/create">Start building</Link></Button>
          }
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projects.map((p) => (
              <Card key={p.id} className="group hover:border-primary/50 transition-colors overflow-hidden flex flex-col">
                {/* Thumbnail */}
                <div className="h-36 bg-secondary/50 flex items-center justify-center relative overflow-hidden shrink-0">
                  {(p as any).renderImageUrl ? (
                    <img src={(p as any).renderImageUrl} alt={p.title} className="w-full h-full object-cover" />
                  ) : (
                    <Zap className="h-10 w-10 text-primary/30" />
                  )}
                  {(p as any).skillLevel && (
                    <Badge className="absolute top-2 right-2 text-[10px] bg-background/80 backdrop-blur-sm border-border/50">
                      {(p as any).skillLevel}
                    </Badge>
                  )}
                </div>

                <CardContent className="p-3 flex flex-col flex-1">
                  <h3 className="font-semibold text-sm text-foreground truncate mb-1">{p.title}</h3>

                  {/* Creator */}
                  {(p as any).creatorDisplayName && (
                    <div className="flex items-center gap-1 mb-1">
                      <User2 className="h-3 w-3 text-muted-foreground" />
                      <span className="text-[11px] text-muted-foreground truncate">{(p as any).creatorDisplayName}</span>
                    </div>
                  )}

                  {/* Category + cost */}
                  <div className="flex items-center gap-2 flex-wrap mb-2">
                    {p.category && <Badge variant="outline" className="text-[10px]">{p.category}</Badge>}
                    {p.estimatedCost && <span className="text-xs text-muted-foreground">${p.estimatedCost}</span>}
                  </div>

                  {/* Social stats */}
                  <div className="flex items-center gap-3 mb-2 text-[11px] text-muted-foreground">
                    {((p as any).likeCount ?? 0) > 0 && (
                      <span className="flex items-center gap-0.5">
                        <Heart className="h-3 w-3 fill-rose-500 text-rose-500" />{(p as any).likeCount}
                      </span>
                    )}
                    {((p as any).forkCount ?? 0) > 0 && (
                      <span className="flex items-center gap-0.5">
                        <GitFork className="h-3 w-3" />{(p as any).forkCount}
                      </span>
                    )}
                  </div>

                  {/* Actions */}
                  <div className="flex gap-1.5 mt-auto">
                    <Button variant="ghost" size="sm" className="flex-1 h-7 text-xs" asChild>
                      <Link href={`/share/${(p as any).shareSlug ?? p.id}`}>
                        <Eye className="h-3 w-3 mr-1" />View
                      </Link>
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      className="h-7 text-xs gap-1"
                      disabled={forkProject.isPending}
                      onClick={() => {
                        if (!isSignedIn) { toast({ title: "Sign in to remix projects", variant: "destructive" }); return; }
                        forkProject.mutate(p.id);
                      }}
                      title="Remix this project"
                    >
                      {forkProject.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <GitFork className="h-3 w-3" />}
                      Remix
                    </Button>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>

          {/* Infinite scroll sentinel / load-more */}
          <div ref={loaderRef} className="flex justify-center mt-8">
            {hasMore && (
              <Button
                variant="outline"
                onClick={() => setPage((p) => p + 1)}
                disabled={isFetching}
                className="min-w-[140px]"
              >
                {isFetching ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : null}
                {isFetching ? "Loading…" : "Load more"}
              </Button>
            )}
          </div>
        </>
      )}
    </div>
  );
}
