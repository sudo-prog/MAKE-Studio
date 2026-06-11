import { pgTable, serial, integer, text, boolean, timestamp } from "drizzle-orm/pg-core";
import { projectsTable } from "./projects";
import { usersTable } from "./users";

export const showcasePostsTable = pgTable("showcase_posts", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  caption: text("caption"),
  mediaUrl: text("media_url"), // image or video URL
  mediaType: text("media_type"), // "image" | "video"
  likeCount: integer("like_count").notNull().default(0),
  commentCount: integer("comment_count").notNull().default(0),
  makerVerified: boolean("maker_verified").notNull().default(false),
  createdAt: timestamp("created_at").notNull().defaultNow(),
  updatedAt: timestamp("updated_at").notNull().defaultNow(),
});

export const showcaseLikesTable = pgTable("showcase_likes", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => showcasePostsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const showcaseCommentsTable = pgTable("showcase_comments", {
  id: serial("id").primaryKey(),
  postId: integer("post_id").notNull().references(() => showcasePostsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  content: text("content").notNull(),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export const projectLikesTable = pgTable("project_likes", {
  id: serial("id").primaryKey(),
  projectId: integer("project_id").notNull().references(() => projectsTable.id, { onDelete: "cascade" }),
  userId: integer("user_id").notNull().references(() => usersTable.id, { onDelete: "cascade" }),
  createdAt: timestamp("created_at").notNull().defaultNow(),
});

export type ShowcasePost = typeof showcasePostsTable.$inferSelect;
export type ShowcaseLike = typeof showcaseLikesTable.$inferSelect;
export type ShowcaseComment = typeof showcaseCommentsTable.$inferSelect;
export type ProjectLike = typeof projectLikesTable.$inferSelect;
