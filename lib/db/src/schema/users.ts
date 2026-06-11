import { pgTable, serial, text, boolean, integer, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const usersTable = pgTable("users", {
  id: serial("id").primaryKey(),
  clerkId: text("clerk_id").notNull().unique(),
  email: text("email").notNull(),
  displayName: text("display_name"),
  avatarUrl: text("avatar_url"),
  tier: text("tier").notNull().default("free"), // "free" | "pro"
  creditsBalance: integer("credits_balance").notNull().default(10),
  dailyCreditsUsed: integer("daily_credits_used").notNull().default(0),
  dailyCreditsResetAt: timestamp("daily_credits_reset_at").defaultNow(),
  educationMode: boolean("education_mode").notNull().default(false),
  githubConnected: boolean("github_connected").notNull().default(false),
  octoprintConnected: boolean("octoprint_connected").notNull().default(false),
  stripeCustomerId: text("stripe_customer_id"),
  stripeSubscriptionId: text("stripe_subscription_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertUserSchema = createInsertSchema(usersTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertUser = z.infer<typeof insertUserSchema>;
export type User = typeof usersTable.$inferSelect;
