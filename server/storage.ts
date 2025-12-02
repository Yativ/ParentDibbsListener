import { readFileSync, writeFileSync, existsSync } from "fs";
import { randomUUID } from "crypto";
import type { Settings, Alert } from "@shared/schema";

const SETTINGS_FILE = "./settings.json";
const MAX_ALERTS = 100;

export interface IStorage {
  getSettings(): Settings;
  saveSettings(settings: Settings): void;
  getAlerts(): Alert[];
  addAlert(alert: Omit<Alert, "id">): Alert;
  clearAlerts(): void;
}

export class FileStorage implements IStorage {
  private settings: Settings;
  private alerts: Alert[];

  constructor() {
    this.settings = this.loadSettings();
    this.alerts = [];
  }

  private loadSettings(): Settings {
    try {
      if (existsSync(SETTINGS_FILE)) {
        const data = readFileSync(SETTINGS_FILE, "utf-8");
        return JSON.parse(data);
      }
    } catch (error) {
      console.error("Error loading settings:", error);
    }
    return {
      watchedGroups: [],
      alertKeywords: [],
      myNumber: undefined,
    };
  }

  getSettings(): Settings {
    return this.settings;
  }

  saveSettings(settings: Settings): void {
    this.settings = settings;
    try {
      writeFileSync(SETTINGS_FILE, JSON.stringify(settings, null, 2));
    } catch (error) {
      console.error("Error saving settings:", error);
      throw error;
    }
  }

  getAlerts(): Alert[] {
    return this.alerts;
  }

  addAlert(alertData: Omit<Alert, "id">): Alert {
    const alert: Alert = {
      ...alertData,
      id: randomUUID(),
    };
    this.alerts.unshift(alert);
    if (this.alerts.length > MAX_ALERTS) {
      this.alerts = this.alerts.slice(0, MAX_ALERTS);
    }
    return alert;
  }

  clearAlerts(): void {
    this.alerts = [];
  }
}

export const storage = new FileStorage();
