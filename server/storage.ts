import { db } from "./db";
import { eq, desc } from "drizzle-orm";
import {
  users,
  userSettings,
  alerts,
  type User,
  type UpsertUser,
  type UserSettings,
  type InsertUserSettings,
  type Alert,
  type InsertAlert,
  type Settings,
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
  
  // Alert operations
  getAlerts(userId: string): Promise<Alert[]>;
  addAlert(userId: string, alertData: Omit<InsertAlert, "id" | "userId">): Promise<Alert>;
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
      };
    }
    
    return {
      watchedGroups: settings.watchedGroups || [],
      alertKeywords: settings.alertKeywords || [],
      myNumber: settings.myNumber || undefined,
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
          updatedAt: new Date(),
        })
        .where(eq(userSettings.userId, userId));
    } else {
      await db.insert(userSettings).values({
        userId,
        watchedGroups: settings.watchedGroups,
        alertKeywords: settings.alertKeywords,
        myNumber: settings.myNumber,
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

  // Alert operations
  async getAlerts(userId: string): Promise<Alert[]> {
    return await db
      .select()
      .from(alerts)
      .where(eq(alerts.userId, userId))
      .orderBy(desc(alerts.timestamp))
      .limit(MAX_ALERTS);
  }

  async addAlert(userId: string, alertData: Omit<InsertAlert, "id" | "userId">): Promise<Alert> {
    const [alert] = await db
      .insert(alerts)
      .values({
        ...alertData,
        userId,
      })
      .returning();
    return alert;
  }

  async clearAlerts(userId: string): Promise<void> {
    await db.delete(alerts).where(eq(alerts.userId, userId));
  }
}

export const storage = new DatabaseStorage();
