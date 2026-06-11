import { pgTable, serial, text, boolean, integer, timestamp, jsonb, numeric } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const projectsTable = pgTable("projects", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  title: text("title").notNull(),
  prompt: text("prompt").notNull(),
  description: text("description"),
  status: text("status").notNull().default("draft"), // draft | generating | ready | error
  isPublic: boolean("is_public").notNull().default(false),
  shareSlug: text("share_slug").unique(),
  renderImageUrl: text("render_image_url"),
  category: text("category"),
  skillLevel: text("skill_level"),
  estimatedCost: numeric("estimated_cost"),
  estimatedTime: text("estimated_time"),
  templateId: integer("template_id"),
  // Sections stored as JSON blobs
  mechanicalSection: jsonb("mechanical_section"),
  electronicsSection: jsonb("electronics_section"),
  bomSection: jsonb("bom_section"),
  buildGuideSection: jsonb("build_guide_section"),
  educationSection: jsonb("education_section"),
  safetySection: jsonb("safety_section"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const insertProjectSchema = createInsertSchema(projectsTable).omit({ id: true, createdAt: true, updatedAt: true });
export type InsertProject = z.infer<typeof insertProjectSchema>;
export type Project = typeof projectsTable.$inferSelect;
