import { useState } from "react";
import { useGetPublicGallery, getGetPublicGalleryQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { Link } from "wouter";
import { Zap, Eye } from "lucide-react";

const CATEGORIES = ["All", "Energy", "IoT", "Robotics", "Lighting", "Accessibility", "CNC", "Electronics", "Mechanical"];

export default function Gallery() {
  const [category, setCategory] = useState<string | undefined>(undefined);
  const [page, setPage] = useState(1);
  const galleryParams = { page, ...(category ? { category } : {}) };
  const { data, isLoading } = useGetPublicGallery(galleryParams, {
    query: { queryKey: getGetPublicGalleryQueryKey(galleryParams) },
  });

  const projects = data?.items ?? [];

  return (
    <div className="max-w-6xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Public Gallery</h1>
        <p className="text-muted-foreground text-sm mt-1">Browse community-built projects</p>
      </div>

      <div className="flex gap-2 flex-wrap mb-8">
        {CATEGORIES.map((cat) => (
          <Button
            key={cat}
            variant={category === cat || (cat === "All" && !category) ? "default" : "outline"}
            size="sm"
            onClick={() => { setCategory(cat === "All" ? undefined : cat); setPage(1); }}
          >
            {cat}
          </Button>
        ))}
      </div>

      {isLoading ? (
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
          <p className="font-medium mb-2">No public projects yet</p>
          <p className="text-sm mb-6">Be the first to share your build!</p>
          <Button asChild><Link href="/create">Start building</Link></Button>
        </div>
      ) : (
        <>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {projects.map((p) => (
              <Card key={p.id} className="group hover:border-primary/50 transition-colors overflow-hidden">
                <div className="h-36 bg-secondary/50 flex items-center justify-center relative overflow-hidden">
                  {p.renderImageUrl ? (
                    <img src={p.renderImageUrl} alt={p.title} className="w-full h-full object-cover" />
                  ) : (
                    <Zap className="h-10 w-10 text-primary/30" />
                  )}
                </div>
                <CardContent className="p-3">
                  <h3 className="font-semibold text-sm text-foreground truncate mb-1">{p.title}</h3>
                  <div className="flex items-center gap-2">
                    {p.category && <Badge variant="outline" className="text-[10px]">{p.category}</Badge>}
                    {p.estimatedCost && <span className="text-xs text-muted-foreground">${p.estimatedCost}</span>}
                  </div>
                  <Button variant="ghost" size="sm" className="w-full mt-2 h-7 text-xs" asChild>
                    <Link href={`/share/${(p as any).shareSlug ?? p.id}`}>
                      <Eye className="h-3 w-3 mr-1" />View
                    </Link>
                  </Button>
                </CardContent>
              </Card>
            ))}
          </div>
          <div className="flex justify-center gap-2 mt-8">
            {page > 1 && <Button variant="outline" onClick={() => setPage(p => p - 1)}>Previous</Button>}
            {data && projects.length >= 20 && <Button variant="outline" onClick={() => setPage(p => p + 1)}>Next</Button>}
          </div>
        </>
      )}
    </div>
  );
}
