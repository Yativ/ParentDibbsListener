import type { Express } from "express";
import { type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import { storage } from "./storage";
import { setupAuth, isAuthenticated } from "./replitAuth";
import {
  setSocketIO,
  initializeUserWhatsApp,
  getUserStatus,
  getUserQRCode,
  getUserGroups,
  refreshUserGroups,
  disconnectUserWhatsApp,
  joinUserRoom,
} from "./whatsappManager";
import type { Settings } from "@shared/schema";

const log = (message: string, prefix = "server") => {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour12: true,
    hour: "numeric",
    minute: "2-digit",
  });
  console.log(`${formattedTime} [${prefix}] ${message}`);
};

let io: SocketIOServer | null = null;

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // Setup authentication
  await setupAuth(app);

  // Auth routes
  app.get('/api/auth/user', isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      res.json(user);
    } catch (error) {
      console.error("Error fetching user:", error);
      res.status(500).json({ message: "Failed to fetch user" });
    }
  });

  // User settings endpoints
  app.get("/api/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const settings = await storage.getUserSettings(userId);
      res.json(settings);
    } catch (error) {
      console.error("Error fetching settings:", error);
      res.status(500).json({ message: "Failed to fetch settings" });
    }
  });

  app.post("/api/settings", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const settings: Settings = req.body;
      await storage.saveUserSettings(userId, settings);
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving settings:", error);
      res.status(500).json({ message: "Failed to save settings" });
    }
  });

  // User alerts endpoints
  app.get("/api/alerts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const alerts = await storage.getAlerts(userId);
      res.json(alerts);
    } catch (error) {
      console.error("Error fetching alerts:", error);
      res.status(500).json({ message: "Failed to fetch alerts" });
    }
  });

  app.delete("/api/alerts", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      await storage.clearAlerts(userId);
      res.json({ success: true });
    } catch (error) {
      console.error("Error clearing alerts:", error);
      res.status(500).json({ message: "Failed to clear alerts" });
    }
  });

  // WhatsApp status endpoint
  app.get("/api/whatsapp/status", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const status = getUserStatus(userId);
      const qrCode = getUserQRCode(userId);
      const groups = getUserGroups(userId);
      res.json({ status, qrCode, groups });
    } catch (error) {
      console.error("Error fetching WhatsApp status:", error);
      res.status(500).json({ message: "Failed to fetch WhatsApp status" });
    }
  });

  // Admin endpoints
  app.get("/api/admin/users", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const user = await storage.getUser(userId);
      if (!user?.isAdmin) {
        return res.status(403).json({ message: "Admin access required" });
      }
      const users = await storage.getAllUsers();
      res.json(users);
    } catch (error) {
      console.error("Error fetching users:", error);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Socket.IO setup with user rooms
  io = new SocketIOServer(httpServer, {
    path: "/socket.io",
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
      credentials: true,
    },
    transports: ["polling", "websocket"],
    pingTimeout: 60000,
    pingInterval: 25000,
    allowUpgrades: true,
    allowEIO3: true,
  });

  setSocketIO(io);

  io.on("connection", async (socket) => {
    log(`Client connected: ${socket.id}`, "socket.io");

    // User must authenticate via socket event
    socket.on("authenticate", async (userId: string) => {
      if (!userId) {
        socket.emit("error", "User ID required");
        return;
      }

      log(`User ${userId} authenticated on socket ${socket.id}`, "socket.io");
      joinUserRoom(socket, userId);

      // Send current state to this user
      const status = getUserStatus(userId);
      const qrCode = getUserQRCode(userId);
      const groups = getUserGroups(userId);
      const settings = await storage.getUserSettings(userId);
      const alerts = await storage.getAlerts(userId);

      socket.emit("connection_status", status);
      socket.emit("settings", settings);
      socket.emit("alerts", alerts);
      socket.emit("groups", groups);

      if (status === "qr_ready" && qrCode) {
        socket.emit("qr_code", qrCode);
      }

      // Handle user-specific events
      socket.on("start_whatsapp", async () => {
        log(`User ${userId} requested WhatsApp connection`, "socket.io");
        try {
          await initializeUserWhatsApp(userId);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          log(`Error starting WhatsApp for user ${userId}: ${errorMsg}`, "socket.io");
          socket.emit("error", "Failed to start WhatsApp connection");
        }
      });

      socket.on("save_settings", async (settings: Settings) => {
        try {
          if (!settings || typeof settings !== 'object') {
            throw new Error("Invalid settings format");
          }
          if (!Array.isArray(settings.watchedGroups)) {
            settings.watchedGroups = [];
          }
          if (!Array.isArray(settings.alertKeywords)) {
            settings.alertKeywords = [];
          }
          await storage.saveUserSettings(userId, settings);
          log(`Settings saved for user ${userId}: ${settings.watchedGroups.length} groups, ${settings.alertKeywords.length} keywords`, "socket.io");
          socket.emit("settings", settings);
          socket.emit("settings_saved");
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          log(`Error saving settings for user ${userId}: ${errorMsg}`, "socket.io");
          socket.emit("error", "Failed to save settings");
        }
      });

      socket.on("refresh_groups", async () => {
        log(`Refreshing groups for user ${userId}...`, "socket.io");
        await refreshUserGroups(userId);
      });

      socket.on("disconnect_whatsapp", async () => {
        log(`User ${userId} requested WhatsApp disconnect`, "socket.io");
        await disconnectUserWhatsApp(userId);
      });
    });

    socket.on("disconnect", () => {
      log(`Client disconnected: ${socket.id}`, "socket.io");
    });
  });

  return httpServer;
}
