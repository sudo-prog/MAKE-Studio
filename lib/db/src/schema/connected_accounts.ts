import { pgTable, serial, integer, text, timestamp, uniqueIndex } from "drizzle-orm/pg-core";
import { usersTable } from "./users";

export const connectedAccountsTable = pgTable("connected_accounts", {
  id: serial("id").primaryKey(),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  provider: text("provider").notNull(), // "github" | "octoprint"
  accessToken: text("access_token"),
  metadata: text("metadata"), // JSON string: { login, repoOwner, octoprintUrl, octoprintApiKey }
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
}, (t) => [
  uniqueIndex("connected_accounts_user_provider_idx").on(t.userId, t.provider),
]);

export type ConnectedAccount = typeof connectedAccountsTable.$inferSelect;
