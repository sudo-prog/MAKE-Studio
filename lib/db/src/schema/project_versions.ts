import { pgTable, serial, integer, text, jsonb, timestamp } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const projectVersionsTable = pgTable("project_versions", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  versionNumber: integer("version_number").notNull().default(1),
  prompt: text("prompt"),
  diffSummary: text("diff_summary"), // e.g. "Refined mechanical section"
  snapshot: jsonb("snapshot"), // full sections snapshot at this version
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ProjectVersion = typeof projectVersionsTable.$inferSelect;
