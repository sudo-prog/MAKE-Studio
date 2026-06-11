import { useGetDashboardSummary, useGetMe } from "@workspace/api-client-react";
import { Link } from "wouter";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { PlusSquare, Folder, Activity, Zap } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { Badge } from "@/components/ui/badge";

export default function Dashboard() {
  const { data: user, isLoading: loadingUser } = useGetMe();
  const { data: summary, isLoading: loadingSummary } = useGetDashboardSummary();

  if (loadingUser || loadingSummary) {
    return (
      <div className="space-y-6">
        <h1 className="text-3xl font-bold tracking-tight">Dashboard</h1>
        <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
          {[...Array(4)].map((_, i) => (
            <Skeleton key={i} className="h-32 rounded-xl bg-card" />
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">Welcome back, {user?.displayName || 'Maker'}</h1>
          <p className="text-muted-foreground mt-1">Ready to forge something new today?</p>
        </div>
        <div className="flex items-center gap-3">
          <Badge variant="outline" className="px-3 py-1 font-mono text-sm border-primary/30 text-primary bg-primary/10">
            {user?.tier.toUpperCase()} TIER
          </Badge>
          <Button asChild className="font-semibold text-primary-foreground">
            <Link href="/create">
              <PlusSquare className="mr-2 h-4 w-4" /> New Project
            </Link>
          </Button>
        </div>
      </div>

      {/* Quick Start Prompt */}
      <Card className="bg-secondary/50 border-border">
        <CardContent className="p-6">
          <div className="flex flex-col md:flex-row gap-4 items-center">
            <div className="flex-1 w-full">
              <label className="text-sm font-medium text-muted-foreground mb-2 block">Quick Start Forge</label>
              <div className="flex gap-2">
                <input 
                  type="text" 
                  placeholder="e.g., An automated plant waterer using an ESP32..." 
                  className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 flex-1 font-mono"
                />
                <Button>Forge</Button>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Stats Grid */}
      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Credits Remaining</CardTitle>
            <Zap className="h-4 w-4 text-primary" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{user?.creditsBalance}</div>
            <p className="text-xs text-muted-foreground mt-1">
              Resets at end of billing cycle
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Total Projects</CardTitle>
            <Folder className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-2xl font-bold font-mono">{summary?.totalProjects || 0}</div>
            <p className="text-xs text-muted-foreground mt-1">
              {summary?.completedProjects || 0} completed builds
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Recent Activity</CardTitle>
            <Activity className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-sm">
              {summary?.recentActivity && summary.recentActivity.length > 0 ? (
                <ul className="space-y-2 mt-2">
                  {summary.recentActivity.slice(0, 2).map((item, i) => (
                    <li key={i} className="text-xs text-muted-foreground flex justify-between">
                      <span className="truncate pr-2">{item.label}</span>
                      <span className="font-mono text-[10px] opacity-70">
                        {new Date(item.timestamp).toLocaleDateString()}
                      </span>
                    </li>
                  ))}
                </ul>
              ) : (
                <span className="text-muted-foreground">No recent activity</span>
              )}
            </div>
          </CardContent>
        </Card>
      </div>

    </div>
  );
}
