import { Router } from "express";
import { db } from "@workspace/db";
import { usersTable } from "@workspace/db";
import { eq } from "drizzle-orm";
import { requireDbUser } from "../lib/auth";
import Stripe from "stripe";

const router = Router();

function getStripe(): Stripe | null {
  if (!process.env.STRIPE_SECRET_KEY) return null;
  return new Stripe(process.env.STRIPE_SECRET_KEY);
}

const PLANS: Record<string, string> = {
  pro_monthly: process.env.STRIPE_PRO_MONTHLY_PRICE_ID ?? "",
  pro_annual: process.env.STRIPE_PRO_ANNUAL_PRICE_ID ?? "",
};

const FREE_DAILY_LIMIT = 3;

// GET /api/credits
router.get("/credits", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    res.json({
      balance: user.creditsBalance,
      tier: user.tier,
      dailyLimit: user.tier === "free" ? FREE_DAILY_LIMIT : null,
      dailyUsed: user.dailyCreditsUsed ?? 0,
      resetsAt: user.dailyCreditsResetAt,
      stripeCustomerId: user.stripeCustomerId,
    });
  } catch (err) {
    res.status(500).json({ error: "Failed to get credits" });
  }
});

// POST /api/credits/checkout
router.post("/credits/checkout", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const { plan } = req.body;
    const stripe = getStripe();
    if (!stripe) {
      res.status(400).json({ error: "Stripe is not configured. Set STRIPE_SECRET_KEY to enable payments." });
      return;
    }
    const priceId = PLANS[plan];
    if (!priceId) { res.status(400).json({ error: "Invalid plan" }); return; }

    const host = req.get("origin") ?? `https://${req.get("host")}`;
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      customer: user.stripeCustomerId ?? undefined,
      line_items: [{ price: priceId, quantity: 1 }],
      success_url: `${host}/profile?checkout=success`,
      cancel_url: `${host}/pricing?checkout=cancelled`,
      metadata: { userId: String(user.id) },
    });

    res.json({ url: session.url });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to create checkout" });
  }
});

// POST /api/credits/portal
router.post("/credits/portal", requireDbUser, async (req, res) => {
  try {
    const user = (req as any).dbUser;
    const stripe = getStripe();
    if (!stripe) {
      res.status(400).json({ error: "Stripe is not configured." });
      return;
    }
    if (!user.stripeCustomerId) {
      res.status(400).json({ error: "No billing account found." });
      return;
    }
    const host = req.get("origin") ?? `https://${req.get("host")}`;
    const session = await stripe.billingPortal.sessions.create({
      customer: user.stripeCustomerId,
      return_url: `${host}/profile`,
    });
    res.json({ url: session.url });
  } catch (err: any) {
    res.status(500).json({ error: err?.message ?? "Failed to create portal" });
  }
});

// POST /api/stripe/webhook
router.post("/stripe/webhook", express_raw_handler, async (req, res) => {
  const stripe = getStripe();
  if (!stripe) { res.status(400).send("Stripe not configured"); return; }
  const sig = req.headers["stripe-signature"];
  if (!sig || !process.env.STRIPE_WEBHOOK_SECRET) { res.status(400).send("Missing signature"); return; }
  let event: Stripe.Event;
  try {
    event = stripe.webhooks.constructEvent((req as any).rawBody, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    res.status(400).send("Webhook signature verification failed");
    return;
  }

  if (event.type === "checkout.session.completed") {
    const session = event.data.object as Stripe.Checkout.Session;
    const userId = session.metadata?.userId;
    if (userId && session.customer) {
      await db.update(usersTable).set({
        tier: "pro",
        stripeCustomerId: String(session.customer),
        stripeSubscriptionId: String(session.subscription),
        updatedAt: new Date(),
      }).where(eq(usersTable.id, parseInt(userId)));
    }
  }

  if (event.type === "customer.subscription.deleted") {
    const sub = event.data.object as Stripe.Subscription;
    await db.update(usersTable).set({ tier: "free", stripeSubscriptionId: null, updatedAt: new Date() })
      .where(eq(usersTable.stripeSubscriptionId, sub.id));
  }

  res.json({ received: true });
});

// Middleware placeholder — raw body stored by Express JSON parser
function express_raw_handler(req: any, res: any, next: any) {
  next();
}

export default router;
