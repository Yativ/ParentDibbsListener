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
}

const userSessions = new Map<string, UserSession>();
let io: SocketIOServer | null = null;

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

export async function initializeUserWhatsApp(userId: string): Promise<void> {
  const existingSession = userSessions.get(userId);
  
  // If already initializing or connected, return existing promise
  if (existingSession?.initPromise) {
    return existingSession.initPromise;
  }
  
  if (existingSession?.status === "connected") {
    return;
  }

  const session: UserSession = {
    client: null,
    status: "connecting",
    qrCode: null,
    groups: [],
    initPromise: null,
  };
  
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
            // Get the full path from which command
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

      log(`Using Chromium path: ${chromiumPath || "default"} for user ${userId}`);

      const puppeteerArgs = [
        "--no-sandbox",
        "--disable-setuid-sandbox",
        "--disable-dev-shm-usage",
        "--disable-accelerated-2d-canvas",
        "--no-first-run",
        "--no-zygote",
        "--disable-gpu",
      ];

      const client = new Client({
        authStrategy: new LocalAuth({
          clientId: userId, // Each user gets their own session folder
          dataPath: `./.wwebjs_auth`,
        }),
        puppeteer: {
          headless: true,
          args: puppeteerArgs,
          executablePath: chromiumPath,
        },
      });

      session.client = client;

      // QR Code event
      client.on("qr", async (qr: string) => {
        try {
          const QRCode = await import("qrcode");
          const qrDataUrl = await QRCode.toDataURL(qr);
          session.qrCode = qrDataUrl;
          session.status = "qr_ready";
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
        emitToUser(userId, "connection_status", session.status);
        await storage.updateWhatsAppStatus(userId, session.status);
        log(`WhatsApp connected for user ${userId}`);
        await sendGroupsToUser(userId);
      });

      // Disconnected event
      client.on("disconnected", async (reason: string) => {
        session.status = "disconnected";
        session.qrCode = null;
        session.groups = [];
        emitToUser(userId, "connection_status", session.status);
        await storage.updateWhatsAppStatus(userId, session.status);
        log(`WhatsApp disconnected for user ${userId}: ${reason}`);
      });

      // Auth failure event
      client.on("auth_failure", async (msg: string) => {
        session.status = "disconnected";
        emitToUser(userId, "connection_status", session.status);
        await storage.updateWhatsAppStatus(userId, session.status);
        log(`WhatsApp auth failure for user ${userId}: ${msg}`);
      });

      // Message event for monitoring
      client.on("message_create", async (msg: any) => {
        await handleMessage(userId, msg);
      });

      await client.initialize();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      const errorStack = error instanceof Error ? error.stack : "";
      log(`Error initializing WhatsApp for user ${userId}: ${errorMsg}`);
      if (errorStack) {
        log(`Stack trace: ${errorStack}`);
      }
      session.status = "disconnected";
      emitToUser(userId, "connection_status", session.status);
      emitToUser(userId, "error", errorMsg);
      await storage.updateWhatsAppStatus(userId, session.status);
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

    const settings = await storage.getUserSettings(userId);
    const { watchedGroups, alertKeywords, myNumber } = settings;

    if (!watchedGroups || !alertKeywords || watchedGroups.length === 0 || alertKeywords.length === 0) {
      return;
    }

    if (!watchedGroups.includes(chat.id._serialized)) {
      return;
    }

    const messageText = msg.body?.toLowerCase() || "";
    const matchedKeyword = alertKeywords.find((keyword: string) =>
      messageText.includes(keyword.toLowerCase())
    );

    if (!matchedKeyword) return;

    log(`Keyword "${matchedKeyword}" matched in group "${chat.name}" for user ${userId}`);

    let senderName = "לא ידוע";
    try {
      const contact = await msg.getContact();
      senderName = contact?.pushname || contact?.name || contact?.number || "לא ידוע";
    } catch (contactError) {
      const errorMsg = contactError instanceof Error ? contactError.message : String(contactError);
      log(`Could not get contact info: ${errorMsg}`);
    }

    const alert = await storage.addAlert(userId, {
      groupId: chat.id._serialized,
      groupName: chat.name,
      matchedKeyword,
      messageText: msg.body || "",
      senderName,
      alertSent: false,
    });

    // Send WhatsApp alert to user
    if (myNumber) {
      try {
        const session = userSessions.get(userId);
        if (session?.client && session.status === "connected") {
          const formattedNumber = myNumber.replace(/\D/g, "");
          const whatsappNumber = `${formattedNumber}@c.us`;
          const alertMessage = `🚨 התראה חדשה!\n\nקבוצה: ${chat.name}\nמילת מפתח: ${matchedKeyword}\nשולח: ${senderName}\n\nהודעה: ${msg.body}`;
          
          const targetChat = await session.client.getChatById(whatsappNumber);
          if (targetChat) {
            await targetChat.sendMessage(alertMessage);
            log(`Alert WhatsApp message sent to ${myNumber} for user ${userId}`);
          }
        }
      } catch (sendError) {
        const errorMsg = sendError instanceof Error ? sendError.message : String(sendError);
        log(`Error sending WhatsApp alert: ${errorMsg}`);
      }
    }

    emitToUser(userId, "new_alert", alert);
    log(`Alert emitted to user ${userId}`);
  } catch (error) {
    const errorMsg = error instanceof Error ? error.message : String(error);
    log(`Error processing message for user ${userId}: ${errorMsg}`);
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
  if (session?.client) {
    try {
      await session.client.destroy();
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : String(error);
      log(`Error destroying WhatsApp client for user ${userId}: ${errorMsg}`);
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
