import { Server as SocketIOServer } from "socket.io";
import { storage } from "./storage";
import type { WhatsAppGroup, ConnectionStatus, Alert } from "@shared/schema";

const log = (message: string, prefix = "whatsapp") => {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour12: true,
    hour: "numeric",
    minute: "2-digit",
  });
  console.log(`${formattedTime} [${prefix}] ${message}`);
};

// Store WhatsApp clients per user
interface UserSession {
  client: any;
  status: ConnectionStatus;
  qrCode: string | null;
  groups: WhatsAppGroup[];
  initPromise: Promise<void> | null;
  retryCount: number;
  lastError: string | null;
  isDestroying: boolean;
}

const userSessions = new Map<string, UserSession>();
let io: SocketIOServer | null = null;

// Configuration
const MAX_RETRY_ATTEMPTS = 3;
const RETRY_DELAY_MS = 5000;
const INIT_TIMEOUT_MS = 120000; // 2 minutes

// Lazy load WhatsApp Web.js module
let whatsappModule: { Client: any; LocalAuth: any } | null = null;

async function loadWhatsAppModule() {
  if (!whatsappModule) {
    try {
      const module = await import("whatsapp-web.js");
      // Handle both default and named exports
      const Client = module.Client || (module.default && module.default.Client);
      const LocalAuth = module.LocalAuth || (module.default && module.default.LocalAuth);
      
      if (!Client || !LocalAuth) {
        log(`WhatsApp module exports: ${Object.keys(module).join(", ")}`);
        throw new Error("WhatsApp module failed to load properly - missing Client or LocalAuth");
      }
      whatsappModule = { Client, LocalAuth };
      log("WhatsApp module loaded successfully");
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log(`Error loading WhatsApp module: ${errorMsg}`);
      throw error;
    }
  }
  return whatsappModule;
}

export function setSocketIO(socketIO: SocketIOServer) {
  io = socketIO;
}

function emitToUser(userId: string, event: string, data: any) {
  if (io) {
    io.to(`user:${userId}`).emit(event, data);
  }
}

export function getUserStatus(userId: string): ConnectionStatus {
  const session = userSessions.get(userId);
  return session?.status || "disconnected";
}

export function getUserQRCode(userId: string): string | null {
  const session = userSessions.get(userId);
  return session?.qrCode || null;
}

export function getUserGroups(userId: string): WhatsAppGroup[] {
  const session = userSessions.get(userId);
  return session?.groups || [];
}

export function isUserInitializing(userId: string): boolean {
  const session = userSessions.get(userId);
  return session?.initPromise !== null || session?.status === "connecting";
}

// Helper function to safely destroy a client
async function safeDestroyClient(client: any, userId: string): Promise<void> {
  if (!client) return;
  
  try {
    // Remove all listeners first to prevent callbacks during destruction
    client.removeAllListeners();
    await client.destroy();
    log(`Client destroyed safely for user ${userId}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`Warning: Error during client destruction for user ${userId}: ${errorMsg}`);
  }
}

// Create a new session with proper initialization
function createSession(userId: string): UserSession {
  return {
    client: null,
    status: "connecting",
    qrCode: null,
    groups: [],
    initPromise: null,
    retryCount: 0,
    lastError: null,
    isDestroying: false,
  };
}

export async function initializeUserWhatsApp(userId: string): Promise<void> {
  const existingSession = userSessions.get(userId);
  
  // If already initializing, return existing promise
  if (existingSession?.initPromise) {
    log(`Returning existing init promise for user ${userId}`);
    return existingSession.initPromise;
  }
  
  // If connected and client exists, just return
  if (existingSession?.status === "connected" && existingSession?.client) {
    log(`Already connected for user ${userId}`);
    return;
  }

  // If there's an existing session being destroyed, wait a bit
  if (existingSession?.isDestroying) {
    log(`Waiting for existing session to be destroyed for user ${userId}`);
    await new Promise(resolve => setTimeout(resolve, 2000));
  }

  // Clean up any existing client before creating new one
  if (existingSession?.client) {
    await safeDestroyClient(existingSession.client, userId);
  }

  const session = createSession(userId);
  userSessions.set(userId, session);
  emitToUser(userId, "connection_status", session.status);
  await storage.updateWhatsAppStatus(userId, session.status);

  const initPromise = (async () => {
    try {
      const { Client, LocalAuth } = await loadWhatsAppModule();
      
      // Detect Chromium path
      const { execSync } = await import("child_process");
      let chromiumPath: string | undefined;
      
      if (process.env.CHROMIUM_PATH) {
        chromiumPath = process.env.CHROMIUM_PATH;
      } else {
        const possiblePaths = ["chromium", "chromium-browser", "google-chrome"];
        for (const cmdName of possiblePaths) {
          try {
            const fullPath = execSync(`which ${cmdName}`, { encoding: "utf-8" }).trim();
            if (fullPath) {
              chromiumPath = fullPath;
              break;
            }
          } catch {
            // Continue to next path
          }
        }
      }
      
      if (!chromiumPath) {
        throw new Error("Chromium browser not found. Please ensure Chromium is installed.");
      }

      log(`Using Chromium path: ${chromiumPath} for user ${userId}`);

      const puppeteerArgs = [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
        "--single-process",
        "--disable-extensions",
      ];

      const client = new Client({
        authStrategy: new LocalAuth({
          clientId: userId,
          dataPath: `./.wwebjs_auth`,
        }),
        puppeteer: {
          headless: true,
          args: puppeteerArgs,
          executablePath: chromiumPath,
          timeout: 60000,
        },
        qrMaxRetries: 5,
      });

      session.client = client;

      // QR Code event
      client.on("qr", async (qr: string) => {
        try {
          const QRCode = await import("qrcode");
          const qrDataUrl = await QRCode.toDataURL(qr);
          session.qrCode = qrDataUrl;
          session.status = "qr_ready";
          session.retryCount = 0; // Reset retry count on successful QR generation
          emitToUser(userId, "qr_code", qrDataUrl);
          emitToUser(userId, "connection_status", session.status);
          await storage.updateWhatsAppStatus(userId, session.status);
          log(`QR code generated for user ${userId}`);
        } catch (error) {
          const errorMsg = error instanceof Error ? error.message : String(error);
          log(`Error generating QR code for user ${userId}: ${errorMsg}`);
        }
      });

      // Ready event
      client.on("ready", async () => {
        session.status = "connected";
        session.qrCode = null;
        session.retryCount = 0;
        session.lastError = null;
        emitToUser(userId, "connection_status", session.status);
        await storage.updateWhatsAppStatus(userId, session.status);
        log(`WhatsApp connected for user ${userId}`);
        await sendGroupsToUser(userId);
      });

      // Disconnected event
      client.on("disconnected", async (reason: string) => {
        log(`WhatsApp disconnected for user ${userId}: ${reason}`);
        session.status = "disconnected";
        session.qrCode = null;
        session.groups = [];
        session.lastError = reason;
        session.isDestroying = true;
        
        emitToUser(userId, "connection_status", session.status);
        await storage.updateWhatsAppStatus(userId, session.status);
        
        // Clean up client
        await safeDestroyClient(client, userId);
        session.client = null;
        session.isDestroying = false;
      });

      // Auth failure event
      client.on("auth_failure", async (msg: string) => {
        log(`WhatsApp auth failure for user ${userId}: ${msg}`);
        session.status = "disconnected";
        session.lastError = msg;
        session.isDestroying = true;
        
        emitToUser(userId, "connection_status", session.status);
        emitToUser(userId, "error", `Authentication failed: ${msg}`);
        await storage.updateWhatsAppStatus(userId, session.status);
        
        // Clean up client
        await safeDestroyClient(client, userId);
        session.client = null;
        session.isDestroying = false;
      });

      // Message event for monitoring
      client.on("message_create", async (msg: any) => {
        await handleMessage(userId, msg);
      });

      // Initialize with timeout
      const initWithTimeout = Promise.race([
        client.initialize(),
        new Promise((_, reject) => 
          setTimeout(() => reject(new Error("Initialization timeout")), INIT_TIMEOUT_MS)
        ),
      ]);

      await initWithTimeout;
      log(`WhatsApp client initialized successfully for user ${userId}`);
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : "";
      log(`Error initializing WhatsApp for user ${userId}: ${errorMsg}`);
      if (errorStack) {
        log(`Stack trace: ${errorStack}`);
      }
      
      session.status = "disconnected";
      session.lastError = errorMsg;
      
      // Clean up on error
      if (session.client) {
        await safeDestroyClient(session.client, userId);
        session.client = null;
      }
      
      emitToUser(userId, "connection_status", session.status);
      emitToUser(userId, "error", errorMsg);
      await storage.updateWhatsAppStatus(userId, session.status);
      
      // Auto-retry logic
      if (session.retryCount < MAX_RETRY_ATTEMPTS) {
        session.retryCount++;
        log(`Will retry initialization for user ${userId} (attempt ${session.retryCount}/${MAX_RETRY_ATTEMPTS})`);
        emitToUser(userId, "error", `Connection failed. Retrying (${session.retryCount}/${MAX_RETRY_ATTEMPTS})...`);
        
        // Clear the init promise before retrying
        session.initPromise = null;
        
        setTimeout(async () => {
          try {
            await initializeUserWhatsApp(userId);
          } catch (retryError) {
            log(`Retry failed for user ${userId}: ${retryError}`);
          }
        }, RETRY_DELAY_MS);
      } else {
        emitToUser(userId, "error", `Failed to connect after ${MAX_RETRY_ATTEMPTS} attempts. Please try again later.`);
      }
      
      throw error;
    } finally {
      session.initPromise = null;
    }
  })();

  session.initPromise = initPromise;
  return initPromise;
}

async function handleMessage(userId: string, msg: any) {
  try {
    const chat = await msg.getChat();
    if (!chat.isGroup) return;

    const groupId = chat.id._serialized;
    const settings = await storage.getUserSettings(userId);
    const { watchedGroups, alertKeywords, myNumber } = settings;

    // Check if this group is being watched
    if (!watchedGroups || watchedGroups.length === 0 || !watchedGroups.includes(groupId)) {
      return;
    }

    const messageText = msg.body?.toLowerCase() || "";
    if (!messageText) return;

    // First, check per-group keywords
    const groupSpecificKeywords = await storage.getGroupKeywordsForGroup(userId, groupId);
    
    // Combine group-specific keywords with global keywords (group-specific takes priority)
    const keywordsToCheck = groupSpecificKeywords.length > 0 
      ? groupSpecificKeywords 
      : (alertKeywords || []);

    if (keywordsToCheck.length === 0) {
      return;
    }

    const matchedKeyword = keywordsToCheck.find((keyword: string) =>
      messageText.includes(keyword.toLowerCase())
    );

    if (!matchedKeyword) return;

    log(`Keyword "${matchedKeyword}" matched in group "${chat.name}" for user ${userId}`);

    let senderName = "Unknown";
    try {
      const contact = await msg.getContact();
      senderName = contact?.pushname || contact?.name || contact?.number || "Unknown";
    } catch (contactError) {
      const errorMsg = contactError instanceof Error ? contactError.message : String(contactError);
      log(`Could not get contact info: ${errorMsg}`);
    }

    // Send WhatsApp alert to user FIRST (this is the priority)
    let alertSent = false;
    if (myNumber) {
      alertSent = await sendWhatsAppAlert(userId, myNumber, {
        groupName: chat.name,
        matchedKeyword,
        senderName,
        messageText: msg.body || "",
      });
    }

    // Save alert to database with correct alertSent status
    const alert = await storage.addAlert(userId, {
      groupId,
      groupName: chat.name,
      matchedKeyword,
      messageText: msg.body || "",
      senderName,
      alertSent: false,
    }, alertSent);

    // Send in-app notification
    emitToUser(userId, "new_alert", { ...alert, alertSent });
    log(`Alert emitted to user ${userId} (WhatsApp alert sent: ${alertSent})`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`Error processing message for user ${userId}: ${errorMsg}`);
  }
}

// Send WhatsApp alert message to user's own number
async function sendWhatsAppAlert(
  userId: string, 
  phoneNumber: string, 
  alertData: {
    groupName: string;
    matchedKeyword: string;
    senderName: string;
    messageText: string;
  }
): Promise<boolean> {
  const session = userSessions.get(userId);
  if (!session?.client || session.status !== "connected") {
    log(`Cannot send WhatsApp alert for user ${userId}: not connected`);
    return false;
  }

  try {
    // Clean and format phone number
    const cleanNumber = phoneNumber.replace(/\D/g, "");
    if (!cleanNumber || cleanNumber.length < 10) {
      log(`Invalid phone number for user ${userId}: ${phoneNumber}`);
      return false;
    }
    
    const whatsappNumber = `${cleanNumber}@c.us`;
    
    // Compose alert message (bilingual - Hebrew primary, English secondary)
    const alertMessage = `🚨 *התראה חדשה / New Alert*

📍 *קבוצה / Group:* ${alertData.groupName}
🔑 *מילת מפתח / Keyword:* ${alertData.matchedKeyword}
👤 *שולח / Sender:* ${alertData.senderName}

💬 *הודעה / Message:*
${alertData.messageText.slice(0, 500)}${alertData.messageText.length > 500 ? "..." : ""}

---
כוננות קל - Konanut Kal`;
    
    // Use sendMessage directly instead of getChatById
    await session.client.sendMessage(whatsappNumber, alertMessage);
    log(`WhatsApp alert sent successfully to ${phoneNumber} for user ${userId}`);
    return true;
    
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`Error sending WhatsApp alert to ${phoneNumber} for user ${userId}: ${errorMsg}`);
    return false;
  }
}

async function sendGroupsToUser(userId: string) {
  const session = userSessions.get(userId);
  if (!session?.client || session.status !== "connected") return;

  try {
    const chats = await session.client.getChats();
    const groups: WhatsAppGroup[] = chats
      .filter((chat: any) => chat.isGroup)
      .map((chat: any) => ({
        id: chat.id._serialized,
        name: chat.name,
        isGroup: true,
      }))
      .sort((a: WhatsAppGroup, b: WhatsAppGroup) => a.name.localeCompare(b.name));

    session.groups = groups;
    log(`Found ${groups.length} groups for user ${userId}`);
    emitToUser(userId, "groups", groups);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`Error fetching groups for user ${userId}: ${errorMsg}`);
  }
}

export async function refreshUserGroups(userId: string) {
  await sendGroupsToUser(userId);
}

export async function disconnectUserWhatsApp(userId: string) {
  const session = userSessions.get(userId);
  if (session) {
    session.isDestroying = true;
    if (session.client) {
      await safeDestroyClient(session.client, userId);
    }
  }
  userSessions.delete(userId);
  emitToUser(userId, "connection_status", "disconnected");
  await storage.updateWhatsAppStatus(userId, "disconnected");
}

// Join user to their private room
export function joinUserRoom(socket: any, userId: string) {
  socket.join(`user:${userId}`);
  log(`Socket ${socket.id} joined room for user ${userId}`);
}

// Get all active sessions (for admin)
export function getAllSessions(): Map<string, { status: ConnectionStatus; groupCount: number }> {
  const result = new Map<string, { status: ConnectionStatus; groupCount: number }>();
  userSessions.forEach((session, odUserId) => {
    result.set(odUserId, {
      status: session.status,
      groupCount: session.groups.length,
    });
  });
  return result;
}
