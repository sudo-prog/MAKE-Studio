import { useState } from "react";
import { useUser } from "@clerk/react";
import { useGetMe, useUpdateMe, useGetCredits, useCreateBillingPortal, getGetMeQueryKey, getGetCreditsQueryKey } from "@workspace/api-client-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Switch } from "@/components/ui/switch";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { useToast } from "@/hooks/use-toast";
import { User, CreditCard, BookOpen, Zap } from "lucide-react";

export default function Profile() {
  const queryClient = useQueryClient();
  const { user } = useUser();
  const { toast } = useToast();

  const { data: me } = useGetMe();
  const { data: credits } = useGetCredits();

  const [displayName, setDisplayName] = useState("");
  const updateMe = useUpdateMe({
    mutation: {
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
        toast({ title: "Profile updated" });
      },
    },
  });
  const portalMutation = useCreateBillingPortal({
    mutation: {
      onSuccess: (data) => { if (data?.url) window.location.href = data.url; },
    },
  });

  const handleSave = () => {
    updateMe.mutate({ data: { displayName: displayName || me?.displayName || user?.fullName || "" } });
  };

  const handleEducationToggle = (val: boolean) => {
    updateMe.mutate({ data: { educationMode: val } });
    queryClient.invalidateQueries({ queryKey: getGetMeQueryKey() });
  };

  return (
    <div className="max-w-2xl mx-auto px-4 py-8 space-y-6">
      <h1 className="text-2xl font-bold text-foreground">Profile & Settings</h1>

      {/* Identity */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <User className="h-4 w-4 text-primary" />
            Identity
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center gap-4">
            {user?.imageUrl && (
              <img src={user.imageUrl} alt="avatar" className="w-16 h-16 rounded-full border border-border" />
            )}
            <div className="flex-1">
              <p className="text-sm font-medium text-foreground">{user?.fullName ?? "Maker"}</p>
              <p className="text-xs text-muted-foreground">{user?.primaryEmailAddress?.emailAddress}</p>
            </div>
            <Badge variant="outline" className={me?.tier === "pro" ? "border-primary/50 text-primary" : "border-border text-muted-foreground"}>
              {me?.tier === "pro" ? "Pro" : "Free"}
            </Badge>
          </div>
          <Separator />
          <div className="space-y-2">
            <Label htmlFor="displayName">Display name</Label>
            <div className="flex gap-2">
              <Input
                id="displayName"
                placeholder={me?.displayName ?? user?.fullName ?? "Your name"}
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
              />
              <Button onClick={handleSave} disabled={updateMe.isPending}>Save</Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Subscription */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <CreditCard className="h-4 w-4 text-primary" />
            Subscription
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">
                {me?.tier === "pro" ? "Pro plan — unlimited generations" : "Free plan — 3 generations/day"}
              </p>
              {credits && (
                <p className="text-xs text-muted-foreground mt-1">
                  Credits balance: {credits.balance} · Used today: {credits.dailyUsed ?? 0}
                </p>
              )}
            </div>
            {me?.tier === "pro" ? (
              <Button variant="outline" size="sm" disabled={portalMutation.isPending}
                onClick={() => portalMutation.mutate(undefined as any)}>
                Manage
              </Button>
            ) : (
              <Button size="sm" asChild>
                <a href="/pricing"><Zap className="h-3 w-3 mr-1" />Upgrade</a>
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      {/* Education Mode */}
      <Card>
        <CardHeader className="pb-4">
          <CardTitle className="text-base flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-primary" />
            Education Mode
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-foreground">Enable education pack generation</p>
              <p className="text-xs text-muted-foreground mt-1">Adds lesson plans, NGSS alignments, and worksheets to every project</p>
            </div>
            <Switch
              checked={me?.educationMode ?? false}
              onCheckedChange={handleEducationToggle}
            />
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
