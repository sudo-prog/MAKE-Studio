import { useState } from "react";
import { useUser } from "@clerk/react";
import {
  useChallenges, useChallengeSubmissions, useSubmitToChallenge,
  getChallengesQueryKey, getChallengeSubmissionsQueryKey,
} from "@workspace/api-client-react";
import { useListProjects } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Textarea } from "@/components/ui/textarea";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { useToast } from "@/hooks/use-toast";
import { Trophy, Zap, Users, Calendar, Crown, Loader2, ChevronDown, ChevronUp } from "lucide-react";
import type { Challenge } from "@workspace/api-client-react";

function SubmitDialog({ challenge, onSuccess }: { challenge: Challenge; onSuccess: () => void }) {
  const { toast } = useToast();
  const [open, setOpen] = useState(false);
  const [projectId, setProjectId] = useState("");
  const [note, setNote] = useState("");
  const { data: projectsData } = useListProjects({});
  const submit = useSubmitToChallenge({
    mutation: {
      onSuccess: () => {
        setOpen(false); setProjectId(""); setNote(""); onSuccess();
        toast({ title: "Submitted!", description: "Good luck in the challenge." });
      },
      onError: (e: any) => toast({ title: "Submission failed", description: e?.data?.error, variant: "destructive" }),
    },
  });

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button size="sm" className="gap-1.5"><Zap className="h-3.5 w-3.5" />Submit Entry</Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-md">
        <DialogHeader><DialogTitle>Submit to: {challenge.title}</DialogTitle></DialogHeader>
        <div className="space-y-4">
          <div className="space-y-2">
            <Label>Project</Label>
            <Select value={projectId} onValueChange={setProjectId}>
              <SelectTrigger><SelectValue placeholder="Choose a project…" /></SelectTrigger>
              <SelectContent>
                {(projectsData?.items ?? []).map((p: any) => (
                  <SelectItem key={p.id} value={String(p.id)}>{p.title}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="space-y-2">
            <Label>Builder note (optional)</Label>
            <Textarea placeholder="Describe your entry…" value={note} onChange={(e) => setNote(e.target.value)} rows={3} />
          </div>
          <Button
            className="w-full"
            disabled={!projectId || submit.isPending}
            onClick={() => submit.mutate({ id: challenge.id, projectId: parseInt(projectId), note: note || undefined })}
          >
            {submit.isPending ? <Loader2 className="h-4 w-4 animate-spin mr-2" /> : <Trophy className="h-4 w-4 mr-2" />}
            Submit Entry
          </Button>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function ChallengeCard({ challenge }: { challenge: Challenge }) {
  const { isSignedIn } = useUser();
  const queryClient = useQueryClient();
  const [expanded, setExpanded] = useState(false);
  const { data: submissions = [], isLoading: subsLoading } = useChallengeSubmissions(expanded ? challenge.id : 0);

  const endsAt = challenge.endsAt ? new Date(challenge.endsAt) : null;
  const daysLeft = endsAt ? Math.max(0, Math.floor((endsAt.getTime() - Date.now()) / 86400000)) : null;

  return (
    <Card className="border-border/60 overflow-hidden">
      <div className={`h-1.5 ${challenge.isActive ? "bg-gradient-to-r from-primary to-cyan-400" : "bg-secondary"}`} />
      <CardHeader className="pb-3">
        <div className="flex items-start gap-3">
          <div className="p-2 rounded-lg bg-primary/10 border border-primary/20 shrink-0">
            <Trophy className="h-5 w-5 text-primary" />
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <CardTitle className="text-base">{challenge.title}</CardTitle>
              {challenge.isActive ? (
                <Badge className="bg-emerald-500/20 text-emerald-400 border-emerald-500/30 text-[10px]">Active</Badge>
              ) : (
                <Badge variant="outline" className="text-[10px]">Ended</Badge>
              )}
              {challenge.theme && <Badge variant="outline" className="text-[10px]">{challenge.theme}</Badge>}
            </div>
            <p className="text-sm text-muted-foreground mt-1">{challenge.description}</p>
          </div>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          <div className="rounded-lg bg-secondary/30 p-2 text-center">
            <Users className="h-3.5 w-3.5 text-muted-foreground mx-auto mb-0.5" />
            <p className="text-sm font-bold text-foreground">{challenge.submissionCount}</p>
            <p className="text-[10px] text-muted-foreground">Entries</p>
          </div>
          {challenge.prize && (
            <div className="rounded-lg bg-primary/10 border border-primary/20 p-2 text-center">
              <Crown className="h-3.5 w-3.5 text-primary mx-auto mb-0.5" />
              <p className="text-xs font-bold text-primary truncate">{challenge.prize}</p>
              <p className="text-[10px] text-muted-foreground">Prize</p>
            </div>
          )}
          {daysLeft !== null && (
            <div className="rounded-lg bg-secondary/30 p-2 text-center">
              <Calendar className="h-3.5 w-3.5 text-muted-foreground mx-auto mb-0.5" />
              <p className="text-sm font-bold text-foreground">{daysLeft}d</p>
              <p className="text-[10px] text-muted-foreground">Left</p>
            </div>
          )}
        </div>

        <div className="flex items-center gap-2">
          {challenge.isActive && isSignedIn && (
            <SubmitDialog
              challenge={challenge}
              onSuccess={() => queryClient.invalidateQueries({ queryKey: getChallengeSubmissionsQueryKey(challenge.id) })}
            />
          )}
          <Button size="sm" variant="ghost" className="gap-1.5 text-muted-foreground"
            onClick={() => setExpanded((e) => !e)}>
            {expanded ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {expanded ? "Hide" : "View"} Submissions
          </Button>
        </div>

        {expanded && (
          <div className="space-y-2 pt-2 border-t border-border/50">
            {subsLoading ? (
              <p className="text-xs text-muted-foreground">Loading…</p>
            ) : submissions.length === 0 ? (
              <p className="text-xs text-muted-foreground">No submissions yet. Enter first!</p>
            ) : (
              submissions.map((s) => (
                <div key={s.id} className="flex items-center gap-2 text-sm">
                  {s.isWinner && <Crown className="h-3.5 w-3.5 text-amber-400 shrink-0" />}
                  <span className="font-medium text-foreground truncate">{s.projectTitle ?? "Untitled"}</span>
                  <span className="text-muted-foreground text-xs shrink-0">by {s.userDisplayName ?? "Maker"}</span>
                  {s.isWinner && <Badge className="bg-amber-500/20 text-amber-400 border-amber-500/30 text-[10px] ml-auto">Winner</Badge>}
                </div>
              ))
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export default function Challenges() {
  const { data: challenges = [], isLoading } = useChallenges();

  return (
    <div className="max-w-3xl mx-auto px-4 py-8">
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-foreground">Weekly Build Challenges</h1>
        <p className="text-muted-foreground text-sm mt-1">Compete, build, and win credits with themed maker challenges</p>
      </div>

      {isLoading ? (
        <div className="space-y-4">
          {Array.from({ length: 3 }).map((_, i) => (
            <Card key={i} className="animate-pulse">
              <CardContent className="p-6">
                <div className="h-5 bg-secondary rounded w-1/2 mb-3" />
                <div className="h-3 bg-secondary rounded w-3/4 mb-2" />
                <div className="h-3 bg-secondary rounded w-2/3" />
              </CardContent>
            </Card>
          ))}
        </div>
      ) : challenges.length === 0 ? (
        <div className="text-center py-20 text-muted-foreground">
          <Trophy className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium mb-2">No challenges yet</p>
          <p className="text-sm">Check back soon for upcoming competitions!</p>
        </div>
      ) : (
        <div className="space-y-4">
          {challenges.map((c) => <ChallengeCard key={c.id} challenge={c} />)}
        </div>
      )}
    </div>
  );
}
