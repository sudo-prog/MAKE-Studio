import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";

export const affiliateClicksTable = pgTable("affiliate_clicks", {
  id: serial("id").primaryKey(),
  userId: integer("user_id"),
  projectId: integer("project_id"),
  supplier: text("supplier").notNull(), // amazon | digikey | lcsc | aliexpress
  partName: text("part_name"),
  url: text("url").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertAffiliateClickSchema = createInsertSchema(affiliateClicksTable).omit({ id: true, createdAt: true });
export type InsertAffiliateClick = z.infer<typeof insertAffiliateClickSchema>;
export type AffiliateClick = typeof affiliateClicksTable.$inferSelect;
