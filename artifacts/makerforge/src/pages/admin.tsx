import { useAdminAnalytics, getAdminAnalyticsQueryKey } from "@workspace/api-client-react";
import { useGetMe } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Users, Cpu, MousePointerClick, Zap, TrendingUp, ShieldAlert } from "lucide-react";

const SUPPLIER_COLORS: Record<string, string> = {
  amazon: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  digikey: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  lcsc: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  aliexpress: "bg-rose-500/20 text-rose-400 border-rose-500/30",
};

export default function AdminDashboard() {
  const { data: me } = useGetMe();
  const { data, isLoading, error } = useAdminAnalytics({
    query: { queryKey: getAdminAnalyticsQueryKey(), retry: false },
  });

  if ((error as any)?.status === 403) {
    return (
      <div className="max-w-xl mx-auto px-4 py-20 text-center">
        <ShieldAlert className="h-16 w-16 mx-auto mb-4 text-rose-500/60" />
        <h1 className="text-xl font-bold text-foreground mb-2">Admin Access Required</h1>
        <p className="text-muted-foreground">This page is only accessible to MakerForge administrators.</p>
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Admin Analytics</h1>
        <p className="text-muted-foreground text-sm mt-1">Platform-wide metrics and activity</p>
      </div>

      {/* KPI cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { icon: Users, label: "Total Users", value: data?.totalUsers ?? 0, color: "text-cyan-400", bg: "bg-cyan-500/10 border-cyan-500/20" },
          { icon: Cpu, label: "Total Projects", value: data?.totalProjects ?? 0, color: "text-primary", bg: "bg-primary/10 border-primary/20" },
          { icon: Zap, label: "Generated Today", value: data?.generationsToday ?? 0, color: "text-amber-400", bg: "bg-amber-500/10 border-amber-500/20" },
          { icon: MousePointerClick, label: "Affiliate Clicks", value: data?.totalAffiliateClicks ?? 0, color: "text-emerald-400", bg: "bg-emerald-500/10 border-emerald-500/20" },
        ].map(({ icon: Icon, label, value, color, bg }) => (
          <Card key={label} className="border-border/60">
            <CardContent className="p-5 flex items-center gap-3">
              <div className={`p-2 rounded-lg border ${bg} shrink-0`}>
                <Icon className={`h-5 w-5 ${color}`} />
              </div>
              <div>
                {isLoading
                  ? <div className="h-7 w-12 bg-secondary animate-pulse rounded" />
                  : <p className="text-2xl font-bold text-foreground">{value.toLocaleString()}</p>
                }
                <p className="text-xs text-muted-foreground">{label}</p>
              </div>
            </CardContent>
          </Card>
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Conversion funnel */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <TrendingUp className="h-4 w-4 text-primary" />Subscription Breakdown
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 2 }).map((_, i) => <div key={i} className="h-10 bg-secondary animate-pulse rounded" />)}</div>
            ) : Object.entries(data?.conversionFunnel ?? {}).map(([tier, count]) => {
              const total = Object.values(data?.conversionFunnel ?? {}).reduce((a, b) => a + b, 0);
              const pct = total > 0 ? Math.round((count / total) * 100) : 0;
              return (
                <div key={tier} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge variant="outline" className="capitalize text-xs">{tier}</Badge>
                    <div className="text-right">
                      <span className="text-sm font-mono font-medium text-foreground">{count.toLocaleString()}</span>
                      <span className="text-xs text-muted-foreground ml-1.5">{pct}%</span>
                    </div>
                  </div>
                  <div className="h-2 bg-secondary rounded-full overflow-hidden">
                    <div className={`h-full rounded-full transition-all ${tier === "pro" ? "bg-primary" : "bg-cyan-500/60"}`} style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>

        {/* Affiliate clicks by supplier */}
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <MousePointerClick className="h-4 w-4 text-primary" />Affiliate Clicks by Supplier
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {isLoading ? (
              <div className="space-y-2">{Array.from({ length: 4 }).map((_, i) => <div key={i} className="h-8 bg-secondary animate-pulse rounded" />)}</div>
            ) : (data?.clicksBySupplier?.length ?? 0) === 0 ? (
              <p className="text-sm text-muted-foreground">No clicks recorded yet.</p>
            ) : data!.clicksBySupplier.map((row) => {
              const max = Math.max(...data!.clicksBySupplier.map((r) => r.count));
              const pct = max > 0 ? (row.count / max) * 100 : 0;
              return (
                <div key={row.supplier} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge className={`text-[10px] ${SUPPLIER_COLORS[row.supplier] ?? "bg-secondary text-muted-foreground"}`}>{row.supplier}</Badge>
                    <span className="text-sm font-mono text-foreground">{row.count}</span>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      </div>

      {/* Top projects */}
      <Card className="border-border/60">
        <CardHeader className="pb-3">
          <CardTitle className="text-base">Top 10 Recent Projects</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-2">{Array.from({ length: 5 }).map((_, i) => <div key={i} className="h-8 bg-secondary animate-pulse rounded" />)}</div>
          ) : (
            <div className="divide-y divide-border/50">
              {(data?.topProjects ?? []).map((p, i) => (
                <div key={p.id} className="flex items-center gap-3 py-2.5">
                  <span className="text-xs font-mono text-muted-foreground w-5">{i + 1}</span>
                  <a href={`/projects/${p.id}`} className="text-sm font-medium text-foreground hover:text-primary transition-colors flex-1 truncate">
                    {p.title}
                  </a>
                  {p.category && <Badge variant="outline" className="text-[10px] shrink-0">{p.category}</Badge>}
                  <span className="text-xs font-mono text-muted-foreground shrink-0">#{p.id}</span>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
