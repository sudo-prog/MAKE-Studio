import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const challengesTable = pgTable("challenges", {
  id: serial("id").primaryKey(),
  title: text("title").notNull(),
  description: text("description").notNull(),
  theme: text("theme"), // e.g. "Solar Energy", "Accessibility"
  prize: text("prize"), // e.g. "500 credits + featured badge"
  startsAt: timestamp("starts_at").notNull().defaultNow(),
  endsAt: timestamp("ends_at"),
  isActive: boolean("is_active").notNull().default(true),
  winnerId: integer("winner_id"), // project_id of winning submission
  submissionCount: integer("submission_count").notNull().default(0),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const challengeSubmissionsTable = pgTable("challenge_submissions", {
  id: serial("id").primaryKey(),
  challengeId: integer("challenge_id").notNull().references(() => challengesTable.id, { onDelete: "cascade" }),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  note: text("note"),
  isWinner: boolean("is_winner").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type Challenge = typeof challengesTable.$inferSelect;
export type ChallengeSubmission = typeof challengeSubmissionsTable.$inferSelect;
