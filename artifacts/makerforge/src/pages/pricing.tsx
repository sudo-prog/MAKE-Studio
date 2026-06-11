import { useCreateCheckout, useCreateBillingPortal, useGetMe, getGetMeQueryKey } from "@workspace/api-client-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { CheckCircle, Zap } from "lucide-react";
import { useUser } from "@clerk/react";

const FREE_FEATURES = [
  "3 AI generations per day",
  "OpenSCAD code generation",
  "Full BOM with 3 tiers",
  "Basic build guide",
  "ZIP export",
  "Public gallery sharing",
];

const PRO_FEATURES = [
  "Unlimited AI generations",
  "Education pack generation",
  "Multi-turn project refinement",
  "Per-section AI refinement",
  "Priority AI model",
  "All Free features",
];

export default function Pricing() {
  const { isSignedIn } = useUser();
  const { data: me } = useGetMe({ query: { queryKey: getGetMeQueryKey(), enabled: !!isSignedIn } });
  const checkoutMutation = useCreateCheckout();
  const portalMutation = useCreateBillingPortal();

  const isPro = me?.tier === "pro";

  return (
    <div className="max-w-4xl mx-auto px-4 py-12">
      <div className="text-center mb-12">
        <Badge variant="outline" className="mb-4 border-primary/40 text-primary">Pricing</Badge>
        <h1 className="text-3xl font-bold text-foreground mb-3">Simple, honest pricing</h1>
        <p className="text-muted-foreground">Start forging for free. Upgrade when you're ready for more.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 max-w-2xl mx-auto">
        {/* Free */}
        <Card className="border-border relative">
          <CardHeader className="pb-4">
            <div className="text-lg font-bold text-foreground">Free</div>
            <div className="text-3xl font-bold text-foreground">$0<span className="text-sm font-normal text-muted-foreground">/month</span></div>
            <p className="text-sm text-muted-foreground">Perfect for exploring MakerForge</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <ul className="space-y-2">
              {FREE_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-muted-foreground">
                  <CheckCircle className="h-4 w-4 text-emerald-500 shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            {!isSignedIn ? (
              <Button variant="outline" className="w-full" asChild>
                <a href="/sign-up">Get started free</a>
              </Button>
            ) : !isPro ? (
              <Button variant="outline" className="w-full" disabled>Current plan</Button>
            ) : null}
          </CardContent>
        </Card>

        {/* Pro */}
        <Card className="border-primary/60 relative shadow-[0_0_30px_rgba(11,219,168,0.15)]">
          <div className="absolute -top-3 left-1/2 -translate-x-1/2">
            <Badge className="bg-primary text-primary-foreground px-3 shadow-lg">
              <Zap className="h-3 w-3 mr-1" />Most popular
            </Badge>
          </div>
          <CardHeader className="pb-4">
            <div className="text-lg font-bold text-foreground">Pro</div>
            <div className="text-3xl font-bold text-primary">$12<span className="text-sm font-normal text-muted-foreground">/month</span></div>
            <p className="text-sm text-muted-foreground">For serious makers and educators</p>
          </CardHeader>
          <CardContent className="space-y-6">
            <ul className="space-y-2">
              {PRO_FEATURES.map((f) => (
                <li key={f} className="flex items-center gap-2 text-sm text-foreground">
                  <CheckCircle className="h-4 w-4 text-primary shrink-0" />
                  {f}
                </li>
              ))}
            </ul>
            {!isSignedIn ? (
              <Button className="w-full" asChild>
                <a href="/sign-up">Start free trial</a>
              </Button>
            ) : isPro ? (
              <Button
                variant="outline"
                className="w-full"
                disabled={portalMutation.isPending}
                onClick={() => portalMutation.mutate(undefined as any, {
                  onSuccess: (data) => { if (data?.url) window.location.href = data.url; },
                })}
              >
                Manage subscription
              </Button>
            ) : (
              <Button
                className="w-full"
                disabled={checkoutMutation.isPending}
                onClick={() => checkoutMutation.mutate({ data: { plan: "pro_monthly" } }, {
                  onSuccess: (data) => { if (data?.url) window.location.href = data.url; },
                })}
              >
                <Zap className="h-4 w-4 mr-2" />
                {checkoutMutation.isPending ? "Redirecting..." : "Upgrade to Pro"}
              </Button>
            )}
          </CardContent>
        </Card>
      </div>

      <div className="mt-12 text-center text-sm text-muted-foreground">
        All plans include DISCLAIMER: designs are for educational and inspirational purposes.
        Verify all fabricated designs independently.
      </div>
    </div>
  );
}
