import { z } from "zod";

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
  id: z.string(),
  groupId: z.string(),
  groupName: z.string(),
  matchedKeyword: z.string(),
  messageText: z.string(),
  senderName: z.string(),
  timestamp: z.number(),
  alertSent: z.boolean(),
});

export const connectionStatusSchema = z.enum(["disconnected", "connecting", "qr_ready", "connected"]);

export type WhatsAppGroup = z.infer<typeof groupSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type Alert = z.infer<typeof alertSchema>;
export type ConnectionStatus = z.infer<typeof connectionStatusSchema>;

export const insertSettingsSchema = settingsSchema;
export type InsertSettings = z.infer<typeof insertSettingsSchema>;
