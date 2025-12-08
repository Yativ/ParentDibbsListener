import { db } from "./db";
import { eq, desc, and } from "drizzle-orm";
import {
  users,
  userSettings,
  groupKeywords,
  alerts,
  type User,
  type UpsertUser,
  type UserSettings,
  type InsertUserSettings,
  type GroupKeywords,
  type InsertGroupKeywords,
  type Alert,
  type InsertAlert,
  type Settings,
  type GroupKeywordsSetting,
} from "@shared/schema";

const MAX_ALERTS = 100;

export interface IStorage {
  // User operations (required for Replit Auth)
  getUser(id: string): Promise<User | undefined>;
  upsertUser(user: UpsertUser): Promise<User>;
  getAllUsers(): Promise<User[]>;
  
  // User settings operations
  getUserSettings(userId: string): Promise<Settings>;
  saveUserSettings(userId: string, settings: Settings): Promise<void>;
  updateWhatsAppStatus(userId: string, status: string): Promise<void>;
  updateLanguage(userId: string, language: "he" | "en"): Promise<void>;
  
  // Group keywords operations
  getGroupKeywords(userId: string): Promise<GroupKeywordsSetting[]>;
  getGroupKeywordsForGroup(userId: string, groupId: string): Promise<string[]>;
  saveGroupKeywords(userId: string, groupId: string, groupName: string, keywords: string[]): Promise<void>;
  deleteGroupKeywords(userId: string, groupId: string): Promise<void>;
  
  // Alert operations
  getAlerts(userId: string): Promise<Alert[]>;
  addAlert(userId: string, alertData: Omit<InsertAlert, "id" | "userId">, alertSent?: boolean): Promise<Alert>;
  clearAlerts(userId: string): Promise<void>;
}

export class DatabaseStorage implements IStorage {
  // User operations (required for Replit Auth)
  async getUser(id: string): Promise<User | undefined> {
    const [user] = await db.select().from(users).where(eq(users.id, id));
    return user;
  }

  async upsertUser(userData: UpsertUser): Promise<User> {
    const [user] = await db
      .insert(users)
      .values(userData)
      .onConflictDoUpdate({
        target: users.id,
        set: {
          ...userData,
          updatedAt: new Date(),
        },
      })
      .returning();
    return user;
  }

  async getAllUsers(): Promise<User[]> {
    return await db.select().from(users);
  }

  // User settings operations
  async getUserSettings(userId: string): Promise<Settings> {
    const [settings] = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId));
    
    if (!settings) {
      return {
        watchedGroups: [],
        alertKeywords: [],
        myNumber: undefined,
        language: "he",
      };
    }
    
    return {
      watchedGroups: settings.watchedGroups || [],
      alertKeywords: settings.alertKeywords || [],
      myNumber: settings.myNumber || undefined,
      language: (settings.language as "he" | "en") || "he",
    };
  }

  async saveUserSettings(userId: string, settings: Settings): Promise<void> {
    const existing = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId));
    
    if (existing.length > 0) {
      await db
        .update(userSettings)
        .set({
          watchedGroups: settings.watchedGroups,
          alertKeywords: settings.alertKeywords,
          myNumber: settings.myNumber,
          language: settings.language || "he",
          updatedAt: new Date(),
        })
        .where(eq(userSettings.userId, userId));
    } else {
      await db.insert(userSettings).values({
        userId,
        watchedGroups: settings.watchedGroups,
        alertKeywords: settings.alertKeywords,
        myNumber: settings.myNumber,
        language: settings.language || "he",
      });
    }
  }

  async updateWhatsAppStatus(userId: string, status: string): Promise<void> {
    const existing = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId));
    
    if (existing.length > 0) {
      await db
        .update(userSettings)
        .set({ whatsappStatus: status, updatedAt: new Date() })
        .where(eq(userSettings.userId, userId));
    } else {
      await db.insert(userSettings).values({
        userId,
        whatsappStatus: status,
      });
    }
  }

  async updateLanguage(userId: string, language: "he" | "en"): Promise<void> {
    const existing = await db
      .select()
      .from(userSettings)
      .where(eq(userSettings.userId, userId));
    
    if (existing.length > 0) {
      await db
        .update(userSettings)
        .set({ language, updatedAt: new Date() })
        .where(eq(userSettings.userId, userId));
    } else {
      await db.insert(userSettings).values({
        userId,
        language,
      });
    }
  }

  // Group keywords operations
  async getGroupKeywords(userId: string): Promise<GroupKeywordsSetting[]> {
    const results = await db
      .select()
      .from(groupKeywords)
      .where(eq(groupKeywords.userId, userId));
    
    return results.map((r) => ({
      groupId: r.groupId,
      groupName: r.groupName,
      keywords: r.keywords || [],
    }));
  }

  async getGroupKeywordsForGroup(userId: string, groupId: string): Promise<string[]> {
    const [result] = await db
      .select()
      .from(groupKeywords)
      .where(and(eq(groupKeywords.userId, userId), eq(groupKeywords.groupId, groupId)));
    
    return result?.keywords || [];
  }

  async saveGroupKeywords(userId: string, groupId: string, groupName: string, keywords: string[]): Promise<void> {
    const existing = await db
      .select()
      .from(groupKeywords)
      .where(and(eq(groupKeywords.userId, userId), eq(groupKeywords.groupId, groupId)));
    
    if (existing.length > 0) {
      await db
        .update(groupKeywords)
        .set({ keywords, groupName, updatedAt: new Date() })
        .where(and(eq(groupKeywords.userId, userId), eq(groupKeywords.groupId, groupId)));
    } else {
      await db.insert(groupKeywords).values({
        userId,
        groupId,
        groupName,
        keywords,
      });
    }
  }

  async deleteGroupKeywords(userId: string, groupId: string): Promise<void> {
    await db
      .delete(groupKeywords)
      .where(and(eq(groupKeywords.userId, userId), eq(groupKeywords.groupId, groupId)));
  }

  // Alert operations
  async getAlerts(userId: string): Promise<Alert[]> {
    return await db
      .select()
      .from(alerts)
      .where(eq(alerts.userId, userId))
      .orderBy(desc(alerts.timestamp))
      .limit(MAX_ALERTS);
  }

  async addAlert(userId: string, alertData: Omit<InsertAlert, "id" | "userId">, alertSent: boolean = false): Promise<Alert> {
    const [alert] = await db
      .insert(alerts)
      .values({
        ...alertData,
        userId,
        alertSent,
      })
      .returning();
    return alert;
  }

  async clearAlerts(userId: string): Promise<void> {
    await db.delete(alerts).where(eq(alerts.userId, userId));
  }
}

export const storage = new DatabaseStorage();
