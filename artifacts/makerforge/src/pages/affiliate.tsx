import { useAffiliateEarnings } from "@workspace/api-client-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { DollarSign, MousePointerClick, TrendingUp, Package } from "lucide-react";

const SUPPLIER_COLORS: Record<string, string> = {
  amazon: "bg-amber-500/20 text-amber-400 border-amber-500/30",
  digikey: "bg-blue-500/20 text-blue-400 border-blue-500/30",
  lcsc: "bg-emerald-500/20 text-emerald-400 border-emerald-500/30",
  aliexpress: "bg-rose-500/20 text-rose-400 border-rose-500/30",
};

export default function AffiliateDashboard() {
  const { data, isLoading } = useAffiliateEarnings();

  if (isLoading) {
    return (
      <div className="max-w-3xl mx-auto px-4 py-8">
        <div className="h-6 bg-secondary animate-pulse rounded w-1/3 mb-2" />
        <div className="h-4 bg-secondary animate-pulse rounded w-1/2 mb-8" />
        <div className="grid grid-cols-2 gap-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Card key={i} className="animate-pulse"><CardContent className="p-6"><div className="h-12 bg-secondary rounded" /></CardContent></Card>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-3xl mx-auto px-4 py-8 space-y-8">
      <div>
        <h1 className="text-2xl font-bold text-foreground">Affiliate Earnings</h1>
        <p className="text-muted-foreground text-sm mt-1">
          Track clicks on your shared BOM affiliate links. Estimated commissions are based on ~4% of a $15 avg order.
          Actual payouts happen through each affiliate network's own portal.
        </p>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-4">
        <Card className="border-border/60">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-primary/10 border border-primary/20">
              <MousePointerClick className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{data?.totalClicks ?? 0}</p>
              <p className="text-xs text-muted-foreground">Total Clicks</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-emerald-500/10 border border-emerald-500/20">
              <DollarSign className="h-5 w-5 text-emerald-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">${data?.estimatedCommissions ?? "0.00"}</p>
              <p className="text-xs text-muted-foreground">Est. Commissions</p>
            </div>
          </CardContent>
        </Card>
        <Card className="border-border/60 col-span-2 sm:col-span-1">
          <CardContent className="p-5 flex items-center gap-3">
            <div className="p-2 rounded-lg bg-cyan-500/10 border border-cyan-500/20">
              <TrendingUp className="h-5 w-5 text-cyan-400" />
            </div>
            <div>
              <p className="text-2xl font-bold text-foreground">{data?.bySupplier?.length ?? 0}</p>
              <p className="text-xs text-muted-foreground">Active Suppliers</p>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* By supplier */}
      {(data?.bySupplier?.length ?? 0) > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Clicks by Supplier</CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {data!.bySupplier.map((row) => {
              const maxClicks = Math.max(...data!.bySupplier.map((r) => r.clicks));
              const pct = maxClicks > 0 ? (row.clicks / maxClicks) * 100 : 0;
              return (
                <div key={row.supplier} className="space-y-1">
                  <div className="flex items-center justify-between">
                    <Badge className={`text-xs ${SUPPLIER_COLORS[row.supplier] ?? "bg-secondary text-muted-foreground"}`}>
                      {row.supplier}
                    </Badge>
                    <div className="text-right">
                      <span className="text-sm font-mono font-medium text-foreground">{row.clicks} clicks</span>
                      <span className="text-xs text-muted-foreground ml-2">~${Number(row.estimatedCommission).toFixed(2)}</span>
                    </div>
                  </div>
                  <div className="h-1.5 bg-secondary rounded-full overflow-hidden">
                    <div className="h-full bg-primary rounded-full transition-all" style={{ width: `${pct}%` }} />
                  </div>
                </div>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Top parts */}
      {(data?.topParts?.length ?? 0) > 0 && (
        <Card className="border-border/60">
          <CardHeader className="pb-3">
            <CardTitle className="text-base flex items-center gap-2">
              <Package className="h-4 w-4 text-primary" />
              Top Parts by Clicks
            </CardTitle>
          </CardHeader>
          <CardContent>
            <div className="space-y-2">
              {data!.topParts.map((part, i) => (
                <div key={i} className="flex items-center gap-3 py-1">
                  <span className="text-xs font-mono text-muted-foreground w-4">{i + 1}.</span>
                  <span className="text-sm text-foreground flex-1 truncate">{part.partName ?? "Unknown part"}</span>
                  <Badge className={`text-[10px] ${SUPPLIER_COLORS[part.supplier] ?? ""}`}>{part.supplier}</Badge>
                  <span className="text-xs font-mono text-muted-foreground">{part.clicks}×</span>
                </div>
              ))}
            </div>
          </CardContent>
        </Card>
      )}

      {(data?.totalClicks ?? 0) === 0 && (
        <div className="text-center py-16 text-muted-foreground">
          <MousePointerClick className="h-12 w-12 mx-auto mb-4 opacity-30" />
          <p className="font-medium mb-2">No affiliate clicks yet</p>
          <p className="text-sm max-w-xs mx-auto">Share your projects publicly and clicks on BOM affiliate links will be tracked here.</p>
        </div>
      )}

      <div className="rounded-lg border border-border/40 bg-secondary/20 p-4 text-xs text-muted-foreground space-y-1">
        <p className="font-medium text-foreground">About affiliate commissions</p>
        <p>MakerForge participates in the Amazon Associates, Digi-Key, LCSC, and AliExpress affiliate programs. Estimated commissions displayed here are approximations. Actual commissions vary by product, order value, and affiliate terms. Real payouts are managed directly in each affiliate network's portal.</p>
      </div>
    </div>
  );
}
