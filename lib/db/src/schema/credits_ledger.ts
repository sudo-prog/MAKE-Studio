import { pgTable, serial, integer, text, timestamp } from "drizzle-orm/pg-core";
import { createInsertSchema } from "drizzle-zod";
import { z } from "zod/v4";
import { usersTable } from "./users";

export const creditsLedgerTable = pgTable("credits_ledger", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  delta: integer("delta").notNull(), // positive = add, negative = spend
  reason: text("reason").notNull(), // "daily_refill" | "generation" | "subscription" | "admin"
  projectId: integer("project_id"),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const insertCreditLedgerSchema = createInsertSchema(creditsLedgerTable).omit({ id: true, createdAt: true });
export type InsertCreditLedger = z.infer<typeof insertCreditLedgerSchema>;
export type CreditLedger = typeof creditsLedgerTable.$inferSelect;
