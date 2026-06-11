import { useState, useRef } from "react";
import { useUser } from "@clerk/react";
import {
  useShowcase, useToggleShowcaseLike, useCreateShowcasePost,
  useShowcaseComments, useAddShowcaseComment, getShowcaseQueryKey,
  getShowcaseCommentsQueryKey, useShowcaseUpload,
} from "@workspace/api-client-react";
import { useListProjects } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Badge } from "@/components/ui/badge";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Label } from "@/components/ui/label";
import { useToast } from "@/hooks/use-toast";
import {
  Heart, MessageCircle, CheckCircle, Plus, TrendingUp, Clock,
  Camera, Loader2, ChevronDown, ChevronUp, Send,
} from "lucide-react";
import type { ShowcasePost } from "@workspace/api-client-react";

function CommentPanel({ postId }: { postId: number }) {
  const { isSignedIn } = useUser();
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [input, setInput] = useState("");
  const { data: comments = [], isLoading } = useShowcaseComments(postId);
  const addComment = useAddShowcaseComment({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getShowcaseCommentsQueryKey(postId) });
        setInput("");
      },
      onError: () => toast({ title: "Failed to add comment", variant: "destructive" }),
    },
  });

  if (isLoading) return <div className="px-4 pb-3 text-xs text-muted-foreground">Loading…</div>;

  return (
    <div className="border-t border-border/50 px-4 pb-3 pt-3 space-y-2">
      {comments.map((c) => (
        <div key={c.id} className="text-xs">
          <span className="font-medium text-foreground">{c.userDisplayName ?? "Maker"}</span>
          <span className="text-muted-foreground ml-2">{c.content}</span>
        </div>
      ))}
      {comments.length === 0 && <p className="text-xs text-muted-foreground">No comments yet. Be first!</p>}
      {isSignedIn && (
        <div className="flex gap-2 mt-2">
          <Input
            className="h-7 text-xs"
            placeholder="Add a comment…"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => { if (e.key === "Enter" && input.trim()) addComment.mutate({ id: postId, content: input }); }}
          />
          <Button size="sm" className="h-7" disabled={!input.trim() || addComment.isPending}
            onClick={() => addComment.mutate({ id: postId, content: input })}>
            <Send className="h-3 w-3" />
          </Button>
        </div>
      )}
    </div>
  );
}

function ShowcaseCard({ post, isSignedIn }: { post: ShowcasePost; isSignedIn: boolean }) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  const [liked, setLiked] = useState(false);
  const [localLikes, setLocalLikes] = useState(post.likeCount);
  const [showComments, setShowComments] = useState(false);

  const toggleLike = useToggleShowcaseLike({
    mutation: {
      onSuccess: (data) => {
        setLiked(data.liked);
        setLocalLikes((l) => l + (data.liked ? 1 : -1));
        queryClient.invalidateQueries({ queryKey: getShowcaseQueryKey() });
      },
      onError: () => toast({ title: "Sign in to like posts", variant: "destructive" }),
    },
  });

  return (
    <Card className="overflow-hidden border-border/60">
      {post.mediaUrl && (
        <div className="h-48 bg-secondary/40 overflow-hidden">
          {post.mediaType === "video" ? (
            <video src={post.mediaUrl} className="w-full h-full object-cover" controls />
          ) : (
            <img src={post.mediaUrl} alt={post.caption ?? ""} className="w-full h-full object-cover" />
          )}
        </div>
      )}
      <CardContent className="p-4">
        <div className="flex items-start gap-2 mb-2">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-1.5 flex-wrap">
              <span className="text-sm font-semibold text-foreground">{post.userDisplayName ?? "Maker"}</span>
              {post.makerVerified && (
                <Badge className="bg-primary/20 text-primary border-primary/30 text-[10px] px-1.5 py-0 gap-0.5">
                  <CheckCircle className="h-2.5 w-2.5" />Verified
                </Badge>
              )}
              {post.projectCategory && (
                <Badge variant="outline" className="text-[10px] px-1.5 py-0">{post.projectCategory}</Badge>
              )}
            </div>
            {post.projectTitle && (
              <p className="text-xs text-primary font-mono mt-0.5">on "{post.projectTitle}"</p>
            )}
          </div>
          <span className="text-[10px] text-muted-foreground shrink-0">
            {new Date(post.createdAt).toLocaleDateString()}
          </span>
        </div>
        {post.caption && <p className="text-sm text-muted-foreground mb-3">{post.caption}</p>}
        <div className="flex items-center gap-3">
          <button
            className={`flex items-center gap-1.5 text-xs transition-colors ${liked ? "text-rose-400" : "text-muted-foreground hover:text-rose-400"}`}
            onClick={() => isSignedIn ? toggleLike.mutate(post.id) : toast({ title: "Sign in to like", variant: "destructive" })}
          >
            <Heart className={`h-4 w-4 ${liked ? "fill-rose-400" : ""}`} />
            {localLikes}
          </button>
          <button
            className="flex items-center gap-1.5 text-xs text-muted-foreground hover:text-foreground transition-colors"
            onClick={() => setShowComments((s) => !s)}
          >
            <MessageCircle className="h-4 w-4" />
            {post.commentCount}
            {showComments ? <ChevronUp className="h-3 w-3" /> : <ChevronDown className="h-3 w-3" />}
          </button>
        </div>
      </CardContent>
      {showComments && <CommentPanel postId={post.id} />}
    </Card>
  );
}

function CreatePostDialog({ onSuccess }: { onSuccess: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [caption, setCaption] = useState("");
  const [mediaPreview, setMediaPreview] = useState<string | null>(null);
  const [uploadPending, setUploadPending] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const { data: projectsData } = useListProjects({});
  const upload = useShowcaseUpload();
  const create = useCreateShowcasePost({
    mutation: {
      onSuccess: () => { setOpen(false); setCaption(""); setMediaPreview(null); setProjectId(""); onSuccess(); },
      onError: () => toast({ title: "Failed to post", variant: "destructive" }),
    },
  });

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadPending(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const base64 = (reader.result as string).split(",")[1];
      try {
        const result = await upload.mutateAsync({ filename: file.name, content: base64, mediaType: file.type.startsWith("video") ? "video" : "image" });
        setMediaPreview(result.url);
      } catch {
        toast({ title: "Upload failed", variant: "destructive" });
      } finally {
        setUploadPending(false);
      }
    };
    reader.readAsDataURL(file);
  };

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-2"><Plus className="h-4 w-4" />Share a Build</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Share "I Built This"</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="Select a project…" /></SelectTrigger>
              <SelectContent>
                {(projectsData?.items ?? []).map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Caption</Label>
            <Textarea placeholder="Tell the community about your build…" value={caption} onChange={(e) => setCaption(e.target.value)} rows={3} />
          </div>
          <div className="space-y-2">
            <Label>Photo / Video (optional)</Label>
            <input ref={fileRef} type="file" accept="image/*,video/*" className="hidden" onChange={handleFileChange} />
            <Button variant="outline" size="sm" className="w-full gap-2" onClick={() => fileRef.current?.click()} disabled={uploadPending}>
              {uploadPending ? <Loader2 className="h-4 w-4 animate-spin" /> : <Camera className="h-4 w-4" />}
              {mediaPreview ? "Change File" : "Choose File"}
            </Button>
            {mediaPreview && (
              <div className="relative mt-2 rounded-md overflow-hidden h-40 bg-muted">
                <img src={mediaPreview} alt="preview" className="w-full h-full object-cover" />
                <button className="absolute top-1 right-1 bg-black/60 text-white rounded-full p-1 text-xs" onClick={() => setMediaPreview(null)}>✕</button>
              </div>
            )}
          </div>
          <Button
            className="w-full"
            disabled={!projectId || create.isPending || uploadPending}
            onClick={() => create.mutate({
              projectId: parseInt(projectId),
              caption: caption || undefined,
              mediaUrl: mediaPreview || undefined,
              mediaType: mediaPreview ? "image" : undefined,
            })}
          >
            {create.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Camera className="h-4 w-4 mr-2" />}
            Post Build
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export default function Showcase() {
  const { isSignedIn } = useUser();
  const queryClient = useQueryClient();
  const [sort, setSort] = useState<"recent" | "trending">("recent");
  const [page, setPage] = useState(1);
  const { data, isLoading } = useShowcase({ sort, page });
  const posts = data?.items ?? [];

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-foreground">Showcase</h1>
          <p className="text-muted-foreground text-sm mt-1">Real builds from the MakerForge community</p>
        </div>
        {isSignedIn && (
          <CreatePostDialog onSuccess={() => queryClient.invalidateQueries({ queryKey: getShowcaseQueryKey() })} />
        )}
      </div>

      <div className="flex gap-2 mb-6">
        <Button
          size="sm" variant={sort === "recent" ? "default" : "outline"}
          onClick={() => { setSort("recent"); setPage(1); }}
          className="gap-1.5"
        >
          <Clock className="h-3.5 w-3.5" />Recent
        </Button>
        <Button
          size="sm" variant={sort === "trending" ? "default" : "outline"}
          onClick={() => { setSort("trending"); setPage(1); }}
          className="gap-1.5"
        >
          <TrendingUp className="h-3.5 w-3.5" />Trending
        </Button>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-4">
                <div className="h-40 bg-secondary rounded-lg mb-3" />
                <div className="h-4 bg-secondary rounded w-1/2 mb-2" />
                <div className="h-3 bg-secondary rounded w-3/4" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : posts.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Camera className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium mb-2">No builds shared yet</p>
          <p className="text-sm mb-6">Be the first to share what you've made!</p>
          {!isSignedIn && <Button asChild><a href="/sign-in">Sign in to share</a></Button>}
        </div>
      ) : (
        <div className="space-y-4">
          {posts.map((p) => (
            <ShowcaseCard key={p.id} post={p} isSignedIn={!!isSignedIn} />
          ))}
          <div className="flex justify-center gap-2 pt-4">
            {page > 1 && <Button variant="outline" onClick={() => setPage((p) => p - 1)}>Previous</Button>}
            {posts.length >= 20 && <Button variant="outline" onClick={() => setPage((p) => p + 1)}>Next</Button>}
          </div>
        </div>
      )}
    </div>
  );
}
