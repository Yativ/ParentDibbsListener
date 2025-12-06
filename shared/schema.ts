import { z } from "zod";
import { sql } from 'drizzle-orm';
import {
  index,
  jsonb,
  pgTable,
  timestamp,
  varchar,
  text,
  boolean,
  serial,
  integer,
} from "drizzle-orm/pg-core";

// Session storage table for Replit Auth
export const sessions = pgTable(
  "sessions",
  {
    sid: varchar("sid").primaryKey(),
    sess: jsonb("sess").notNull(),
    expire: timestamp("expire").notNull(),
  },
  (table) => [index("IDX_session_expire").on(table.expire)],
);

// User storage table for Replit Auth
export const users = pgTable("users", {
  id: varchar("id").primaryKey().default(sql`gen_random_uuid()`),
  email: varchar("email").unique(),
  firstName: varchar("first_name"),
  lastName: varchar("last_name"),
  profileImageUrl: varchar("profile_image_url"),
  isAdmin: boolean("is_admin").default(false),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// User WhatsApp settings - per user
export const userSettings = pgTable("user_settings", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  watchedGroups: text("watched_groups").array().default([]),
  alertKeywords: text("alert_keywords").array().default([]),
  myNumber: varchar("my_number"),
  whatsappStatus: varchar("whatsapp_status").default("disconnected"),
  createdAt: timestamp("created_at").defaultNow(),
  updatedAt: timestamp("updated_at").defaultNow(),
});

// Alerts per user
export const alerts = pgTable("alerts", {
  id: serial("id").primaryKey(),
  userId: varchar("user_id").notNull().references(() => users.id),
  groupId: varchar("group_id").notNull(),
  groupName: varchar("group_name").notNull(),
  matchedKeyword: varchar("matched_keyword").notNull(),
  messageText: text("message_text").notNull(),
  senderName: varchar("sender_name").notNull(),
  timestamp: timestamp("timestamp").defaultNow(),
  alertSent: boolean("alert_sent").default(false),
});

// Types for Replit Auth
export type UpsertUser = typeof users.$inferInsert;
export type User = typeof users.$inferSelect;
export type UserSettings = typeof userSettings.$inferSelect;
export type InsertUserSettings = typeof userSettings.$inferInsert;
export type Alert = typeof alerts.$inferSelect;
export type InsertAlert = typeof alerts.$inferInsert;

// Zod schemas for validation
export const groupSchema = z.object({
  id: z.string(),
  name: z.string(),
  isGroup: z.boolean(),
});

export const settingsSchema = z.object({
  watchedGroups: z.array(z.string()),
  alertKeywords: z.array(z.string()),
  myNumber: z.string().optional(),
});

export const alertSchema = z.object({
  id: z.number(),
  userId: z.string(),
  groupId: z.string(),
  groupName: z.string(),
  matchedKeyword: z.string(),
  messageText: z.string(),
  senderName: z.string(),
  timestamp: z.date(),
  alertSent: z.boolean(),
});

export const connectionStatusSchema = z.enum(["disconnected", "connecting", "qr_ready", "connected"]);

export type WhatsAppGroup = z.infer<typeof groupSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;

export const insertSettingsSchema = settingsSchema;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
