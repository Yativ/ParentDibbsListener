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
  getAllSessions,
  isUserInitializing,
} from "./whatsappManager";
import type { Settings, GroupKeywordsSetting } from "@shared/schema";

const log = (message: string, prefix = "server") => {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour12: true,
    hour: "numeric",
    minute: "2-digit",
  });
  console.log(`${formattedTime} [${prefix}] ${message}`);
};

let io: SocketIOServer | null = null;

// Track users currently being auto-reconnected to prevent duplicate initialization
const autoReconnectingUsers = new Set<string>();

// Rate limiting for WhatsApp initialization (expensive operation)
const whatsappInitRateLimit = new Map<string, number>();
const WHATSAPP_INIT_COOLDOWN_MS = 30000; // 30 seconds between initialization attempts
const RATE_LIMIT_CLEANUP_INTERVAL_MS = 300000; // Clean up expired entries every 5 minutes

function checkWhatsAppRateLimit(userId: string): { allowed: boolean; remainingMs: number } {
  const now = Date.now();
  const lastAttempt = whatsappInitRateLimit.get(userId) || 0;
  const elapsed = now - lastAttempt;
  
  if (elapsed < WHATSAPP_INIT_COOLDOWN_MS) {
    return { allowed: false, remainingMs: WHATSAPP_INIT_COOLDOWN_MS - elapsed };
  }
  
  whatsappInitRateLimit.set(userId, now);
  return { allowed: true, remainingMs: 0 };
}

// Cleanup expired rate limit entries periodically to prevent memory growth
setInterval(() => {
  const now = Date.now();
  const expiredThreshold = now - WHATSAPP_INIT_COOLDOWN_MS * 2; // Keep entries for 2x the cooldown period
  const toDelete: string[] = [];
  whatsappInitRateLimit.forEach((timestamp, userId) => {
    if (timestamp < expiredThreshold) {
      toDelete.push(userId);
    }
  });
  toDelete.forEach(userId => whatsappInitRateLimit.delete(userId));
}, RATE_LIMIT_CLEANUP_INTERVAL_MS);

// Input sanitization helpers
const MAX_KEYWORD_LENGTH = 100;
const MAX_KEYWORDS_PER_GROUP = 50;

function sanitizeKeywords(keywords: string[]): string[] {
  if (!Array.isArray(keywords)) return [];
  return keywords
    .filter(k => typeof k === "string" && k.length > 0)
    .slice(0, MAX_KEYWORDS_PER_GROUP)
    .map(k => k.slice(0, MAX_KEYWORD_LENGTH).trim());
}

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
      
      // Sanitize input
      if (!settings || typeof settings !== 'object') {
        return res.status(400).json({ message: "Invalid settings format" });
      }
      
      // Sanitize alert keywords
      settings.alertKeywords = sanitizeKeywords(settings.alertKeywords || []);
      
      // Sanitize watched groups
      if (Array.isArray(settings.watchedGroups)) {
        settings.watchedGroups = settings.watchedGroups
          .filter((g: any) => typeof g === "string" && g.length > 0)
          .slice(0, 100); // Max 100 groups
      } else {
        settings.watchedGroups = [];
      }
      
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

  // Group keywords endpoints
  app.get("/api/group-keywords", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const groupKeywords = await storage.getGroupKeywords(userId);
      res.json(groupKeywords);
    } catch (error) {
      console.error("Error fetching group keywords:", error);
      res.status(500).json({ message: "Failed to fetch group keywords" });
    }
  });

  app.post("/api/group-keywords", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { groupId, groupName, keywords } = req.body;
      
      if (!groupId || !groupName) {
        return res.status(400).json({ message: "Group ID and name required" });
      }
      
      // Sanitize group name
      const sanitizedGroupName = typeof groupName === "string" 
        ? groupName.slice(0, 200).trim() 
        : "";
      if (!sanitizedGroupName) {
        return res.status(400).json({ message: "Invalid group name" });
      }
      
      // Sanitize keywords
      const sanitizedKeywords = sanitizeKeywords(keywords);
      
      await storage.saveGroupKeywords(userId, groupId, sanitizedGroupName, sanitizedKeywords);
      res.json({ success: true });
    } catch (error) {
      console.error("Error saving group keywords:", error);
      res.status(500).json({ message: "Failed to save group keywords" });
    }
  });

  app.delete("/api/group-keywords/:groupId", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { groupId } = req.params;
      
      await storage.deleteGroupKeywords(userId, decodeURIComponent(groupId));
      res.json({ success: true });
    } catch (error) {
      console.error("Error deleting group keywords:", error);
      res.status(500).json({ message: "Failed to delete group keywords" });
    }
  });

  // Language preference endpoint
  app.post("/api/language", isAuthenticated, async (req: any, res) => {
    try {
      const userId = req.user.claims.sub;
      const { language } = req.body;
      
      if (!language || !["he", "en"].includes(language)) {
        return res.status(400).json({ message: "Invalid language" });
      }
      
      await storage.updateLanguage(userId, language);
      res.json({ success: true });
    } catch (error) {
      console.error("Error updating language:", error);
      res.status(500).json({ message: "Failed to update language" });
    }
  });

  // Admin endpoints with audit logging
  app.get("/api/admin/users", isAuthenticated, async (req: any, res) => {
    const requestorId = req.user.claims.sub;
    const requestorEmail = req.user.claims.email || "unknown";
    
    try {
      const user = await storage.getUser(requestorId);
      
      // Audit log: Admin access attempt
      log(`[ADMIN AUDIT] User ${requestorId} (${requestorEmail}) attempted to access admin/users - isAdmin: ${user?.isAdmin || false}`, "admin");
      
      if (!user?.isAdmin) {
        log(`[ADMIN AUDIT] DENIED: User ${requestorId} (${requestorEmail}) - not an admin`, "admin");
        return res.status(403).json({ message: "Admin access required" });
      }
      
      const users = await storage.getAllUsers();
      log(`[ADMIN AUDIT] SUCCESS: Admin ${requestorId} (${requestorEmail}) fetched ${users.length} users`, "admin");
      res.json(users);
    } catch (error) {
      console.error(`[ADMIN AUDIT] ERROR: Admin access by ${requestorId}: ${error}`);
      res.status(500).json({ message: "Failed to fetch users" });
    }
  });

  // Socket.IO setup with user rooms
  // SECURITY: Configure CORS with strict origin restrictions
  // Build allowed origins ONLY from environment variables - no wildcard patterns
  
  // Helper to normalize origin (lowercase, remove trailing slash, validate format)
  function normalizeOrigin(origin: string): string | null {
    try {
      const trimmed = origin.trim().toLowerCase().replace(/\/+$/, "");
      // Validate it looks like an origin (protocol + host)
      if (!trimmed.match(/^https?:\/\/[a-z0-9.-]+/i)) {
        return null;
      }
      return trimmed;
    } catch {
      return null;
    }
  }
  
  const allowedOrigins: string[] = [];
  
  // Add Replit deployment domains from environment (these are the ONLY production origins allowed)
  if (process.env.REPLIT_DEV_DOMAIN) {
    const normalized = normalizeOrigin(`https://${process.env.REPLIT_DEV_DOMAIN}`);
    if (normalized) allowedOrigins.push(normalized);
  }
  if (process.env.REPLIT_DOMAINS) {
    process.env.REPLIT_DOMAINS.split(",").forEach(domain => {
      const normalized = normalizeOrigin(`https://${domain}`);
      if (normalized) allowedOrigins.push(normalized);
    });
  }
  // Add custom origins from ALLOWED_ORIGINS env var if set
  if (process.env.ALLOWED_ORIGINS) {
    process.env.ALLOWED_ORIGINS.split(",").forEach(origin => {
      const normalized = normalizeOrigin(origin);
      if (normalized) allowedOrigins.push(normalized);
    });
  }
  
  // Add localhost only for development
  if (process.env.NODE_ENV !== "production") {
    allowedOrigins.push("http://localhost:5000", "https://localhost:5000", "http://0.0.0.0:5000");
  }
  
  log(`[CORS] Allowed origins: ${allowedOrigins.join(", ") || "(none configured)"}`, "cors");

  io = new SocketIOServer(httpServer, {
    path: "/socket.io",
    cors: {
      origin: (origin, callback) => {
        // Allow requests with no origin (server-to-server, curl, mobile apps)
        if (!origin) return callback(null, true);
        
        // In development mode, allow all origins
        if (process.env.NODE_ENV !== "production") {
          return callback(null, true);
        }
        
        // Normalize incoming origin for consistent comparison
        const normalizedIncoming = normalizeOrigin(origin);
        if (!normalizedIncoming) {
          log(`[SECURITY] CORS rejected malformed origin: ${origin}`, "cors");
          return callback(new Error("Not allowed by CORS"));
        }
        
        // PRODUCTION: Strict matching - only allow explicitly configured origins
        if (allowedOrigins.includes(normalizedIncoming)) {
          return callback(null, true);
        }
        
        // Log and reject unauthorized origins
        log(`[SECURITY] CORS rejected origin: ${origin}`, "cors");
        callback(new Error("Not allowed by CORS"));
      },
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
      const groupKeywords = await storage.getGroupKeywords(userId);

      socket.emit("connection_status", status);
      socket.emit("settings", settings);
      socket.emit("alerts", alerts);
      socket.emit("groups", groups);
      socket.emit("group_keywords", groupKeywords);

      if (status === "qr_ready" && qrCode) {
        socket.emit("qr_code", qrCode);
      }

      // Auto-reconnect: If user was previously connected but session was lost, try to restore
      // Check if auth data exists and user is disconnected - attempt auto-reconnect
      // Use a Set to prevent duplicate initialization before the async function starts
      const freshStatus = getUserStatus(userId);
      const alreadyInitializing = isUserInitializing(userId);
      const alreadyAutoReconnecting = autoReconnectingUsers.has(userId);
      
      if (freshStatus === "disconnected" && !alreadyInitializing && !alreadyAutoReconnecting) {
        const fs = await import("fs");
        const authPath = `./.wwebjs_auth/session-${userId}`;
        try {
          if (fs.existsSync(authPath)) {
            // Mark as reconnecting BEFORE calling initialize to prevent race conditions
            autoReconnectingUsers.add(userId);
            
            log(`Found existing session for user ${userId}, attempting auto-reconnect...`, "socket.io");
            socket.emit("connection_status", "connecting");
            
            initializeUserWhatsApp(userId)
              .catch((err) => {
                log(`Auto-reconnect failed for user ${userId}: ${err}`, "socket.io");
              })
              .finally(() => {
                // Remove from set after initialization completes (success or failure)
                autoReconnectingUsers.delete(userId);
              });
          }
        } catch (err) {
          // Ignore errors checking for session
          autoReconnectingUsers.delete(userId);
        }
      }

      // Handle user-specific events
      socket.on("start_whatsapp", async () => {
        log(`User ${userId} requested WhatsApp connection`, "socket.io");
        
        // Rate limiting check
        const rateCheck = checkWhatsAppRateLimit(userId);
        if (!rateCheck.allowed) {
          const seconds = Math.ceil(rateCheck.remainingMs / 1000);
          log(`Rate limit: User ${userId} must wait ${seconds}s before retrying WhatsApp connection`, "socket.io");
          socket.emit("error", `Please wait ${seconds} seconds before trying again`);
          return;
        }
        
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
          // Sanitize and validate alert keywords
          settings.alertKeywords = sanitizeKeywords(settings.alertKeywords || []);
          
          // Sanitize watched groups (limit and validate)
          if (Array.isArray(settings.watchedGroups)) {
            settings.watchedGroups = settings.watchedGroups
              .filter(g => typeof g === "string" && g.length > 0)
              .slice(0, 100); // Max 100 groups
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

      socket.on("save_group_keywords", async (data: { groupId: string; groupName: string; keywords: string[] }) => {
        try {
          const { groupId, groupName, keywords } = data;
          if (!groupId || !groupName) {
            socket.emit("error", "Group ID and name required");
            return;
          }
          // Validate group name length
          const sanitizedGroupName = typeof groupName === "string" 
            ? groupName.slice(0, 200).trim() 
            : "";
          if (!sanitizedGroupName) {
            socket.emit("error", "Invalid group name");
            return;
          }
          // Sanitize keywords input
          const sanitizedKeywords = sanitizeKeywords(keywords);
          
          await storage.saveGroupKeywords(userId, groupId, sanitizedGroupName, sanitizedKeywords);
          const allKeywords = await storage.getGroupKeywords(userId);
          socket.emit("group_keywords", allKeywords);
          socket.emit("group_keywords_saved");
          log(`Group keywords saved for user ${userId}, group ${sanitizedGroupName}`, "socket.io");
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          log(`Error saving group keywords for user ${userId}: ${errorMsg}`, "socket.io");
          socket.emit("error", "Failed to save group keywords");
        }
      });

      socket.on("delete_group_keywords", async (groupId: string) => {
        try {
          if (!groupId) {
            socket.emit("error", "Group ID required");
            return;
          }
          await storage.deleteGroupKeywords(userId, groupId);
          const allKeywords = await storage.getGroupKeywords(userId);
          socket.emit("group_keywords", allKeywords);
          log(`Group keywords deleted for user ${userId}, group ${groupId}`, "socket.io");
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          log(`Error deleting group keywords for user ${userId}: ${errorMsg}`, "socket.io");
          socket.emit("error", "Failed to delete group keywords");
        }
      });

      socket.on("set_language", async (language: "he" | "en") => {
        try {
          if (!language || !["he", "en"].includes(language)) {
            socket.emit("error", "Invalid language");
            return;
          }
          await storage.updateLanguage(userId, language);
          const settings = await storage.getUserSettings(userId);
          socket.emit("settings", settings);
          log(`Language updated to ${language} for user ${userId}`, "socket.io");
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          log(`Error updating language for user ${userId}: ${errorMsg}`, "socket.io");
          socket.emit("error", "Failed to update language");
        }
      });
    });

    socket.on("disconnect", () => {
      log(`Client disconnected: ${socket.id}`, "socket.io");
    });
  });

  return httpServer;
}
