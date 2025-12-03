import type { Express } from "express";
import { type Server } from "http";
import { Server as SocketIOServer } from "socket.io";
import qrcode from "qrcode";
import { execSync } from "child_process";
import { storage } from "./storage";
import { log } from "./index";
import type { WhatsAppGroup, Settings, ConnectionStatus } from "@shared/schema";

function findChromiumPath(): string | undefined {
  if (process.env.CHROMIUM_PATH) {
    return process.env.CHROMIUM_PATH;
  }
  
  const possiblePaths = [
    "chromium",
    "chromium-browser",
    "google-chrome",
    "google-chrome-stable",
  ];
  
  for (const cmd of possiblePaths) {
    try {
      const path = execSync(`which ${cmd}`, { encoding: "utf-8" }).trim();
      if (path) {
        log(`Found Chromium at: ${path}`, "whatsapp");
        return path;
      }
    } catch {
      continue;
    }
  }
  
  return undefined;
}

let whatsappClient: any = null;
let io: SocketIOServer | null = null;
let connectionStatus: ConnectionStatus = "disconnected";
let myNumber: string | undefined = undefined;
let Client: any = null;
let LocalAuth: any = null;
let cachedQrCode: string | null = null;

async function loadWhatsAppModule() {
  if (Client && LocalAuth) return { Client, LocalAuth };
  
  const pkg = await import("whatsapp-web.js");
  // Access from default export for ESM compatibility
  const module = (pkg as any).default || pkg;
  Client = module.Client;
  LocalAuth = module.LocalAuth;
  return { Client, LocalAuth };
}

async function initWhatsAppClient(socketIO: SocketIOServer) {
  if (whatsappClient) {
    return whatsappClient;
  }

  log("Initializing WhatsApp client...", "whatsapp");

  const { Client: WAClient, LocalAuth: WALocalAuth } = await loadWhatsAppModule();

  const chromiumPath = findChromiumPath();
  
  const puppeteerOptions: any = {
    headless: true,
    args: [
      "--no-sandbox",
      "--disable-setuid-sandbox",
      "--disable-dev-shm-usage",
      "--disable-accelerated-2d-canvas",
      "--no-first-run",
      "--no-zygote",
      "--single-process",
      "--disable-gpu",
    ],
  };
  
  if (chromiumPath) {
    puppeteerOptions.executablePath = chromiumPath;
  }
  
  whatsappClient = new WAClient({
    authStrategy: new WALocalAuth({
      dataPath: "./.wwebjs_auth",
    }),
    puppeteer: puppeteerOptions,
  });

  whatsappClient.on("qr", async (qr: string) => {
    log("QR code received", "whatsapp");
    connectionStatus = "qr_ready";
    try {
      const qrDataUrl = await qrcode.toDataURL(qr, {
        width: 256,
        margin: 2,
      });
      cachedQrCode = qrDataUrl;
      socketIO.emit("qr", qrDataUrl);
      socketIO.emit("connection_status", connectionStatus);
    } catch (error) {
      log(`Error generating QR: ${error}`, "whatsapp");
    }
  });

  whatsappClient.on("ready", async () => {
    log("WhatsApp client is ready!", "whatsapp");
    connectionStatus = "connected";
    cachedQrCode = null;
    socketIO.emit("connection_status", connectionStatus);

    try {
      const info = whatsappClient?.info;
      if (info?.wid?.user) {
        myNumber = info.wid.user;
        const settings = storage.getSettings();
        settings.myNumber = myNumber;
        storage.saveSettings(settings);
        log(`Connected as: ${myNumber}`, "whatsapp");
      }

      await sendGroupsToClients(socketIO);
    } catch (error) {
      log(`Error on ready: ${error}`, "whatsapp");
    }
  });

  whatsappClient.on("authenticated", () => {
    log("WhatsApp authenticated", "whatsapp");
  });

  whatsappClient.on("auth_failure", (msg: string) => {
    log(`Authentication failure: ${msg}`, "whatsapp");
    connectionStatus = "disconnected";
    socketIO.emit("connection_status", connectionStatus);
    socketIO.emit("error", "Authentication failed. Please try again.");
  });

  whatsappClient.on("disconnected", (reason: string) => {
    log(`WhatsApp disconnected: ${reason}`, "whatsapp");
    connectionStatus = "disconnected";
    socketIO.emit("connection_status", connectionStatus);
  });

  // Use message_create to capture all messages including from group members
  whatsappClient.on("message_create", async (msg: any) => {
    try {
      // Skip messages sent by ourselves
      if (msg.fromMe) return;
      
      const chat = await msg.getChat();
      
      if (!chat.isGroup) {
        return;
      }

      const settings = storage.getSettings();
      
      log(`Message in group "${chat.name}" (${chat.id._serialized}): "${msg.body.substring(0, 50)}..."`, "whatsapp");
      log(`Watched groups: ${JSON.stringify(settings.watchedGroups)}`, "whatsapp");
      log(`Keywords: ${JSON.stringify(settings.alertKeywords)}`, "whatsapp");
      
      if (!settings.watchedGroups.includes(chat.id._serialized)) {
        log(`Group ${chat.name} is not in watched list, skipping`, "whatsapp");
        return;
      }

      const messageText = msg.body.toLowerCase();
      const matchedKeyword = settings.alertKeywords.find((keyword: string) =>
        messageText.includes(keyword.toLowerCase())
      );

      if (!matchedKeyword) {
        log(`No keyword match found in message`, "whatsapp");
        return;
      }

      // Get sender name with error handling - getContact() can fail on newer WhatsApp versions
      let senderName = "לא ידוע";
      try {
        const contact = await msg.getContact();
        senderName = contact?.pushname || contact?.name || contact?.number || "לא ידוע";
      } catch (contactError) {
        log(`Could not get contact info: ${contactError}`, "whatsapp");
        // Try to get sender info from message directly
        try {
          const senderId = msg.author || msg.from;
          if (senderId) {
            senderName = senderId.replace("@c.us", "").replace("@s.whatsapp.net", "");
          }
        } catch {
          // Keep default "לא ידוע"
        }
      }

      log(`Keyword "${matchedKeyword}" detected in ${chat.name} from ${senderName}`, "whatsapp");

      const alertData = {
        groupId: chat.id._serialized,
        groupName: chat.name,
        matchedKeyword,
        messageText: msg.body,
        senderName,
        timestamp: Date.now(),
        alertSent: false,
      };

      const alert = storage.addAlert(alertData);

      // Send WhatsApp alert message to user
      if (myNumber) {
        try {
          const myChat = await whatsappClient?.getChatById(`${myNumber}@c.us`);
          if (myChat) {
            const alertMessage = `*התראת כוננות קל*\n\n` +
              `*קבוצה:* ${chat.name}\n` +
              `*מילת מפתח:* ${matchedKeyword}\n` +
              `*מאת:* ${senderName}\n` +
              `*זמן:* ${new Date().toLocaleString("he-IL")}\n\n` +
              `*הודעה:*\n${msg.body}`;
            
            await myChat.sendMessage(alertMessage);
            alert.alertSent = true;
            log(`Alert WhatsApp message sent to ${myNumber}`, "whatsapp");
          } else {
            log(`Could not find chat for ${myNumber}`, "whatsapp");
          }
        } catch (sendError) {
          log(`Error sending WhatsApp alert: ${sendError}`, "whatsapp");
        }
      } else {
        log(`No user phone number configured, cannot send WhatsApp alert`, "whatsapp");
      }

      // Emit to dashboard
      socketIO.emit("new_alert", alert);
      log(`Alert emitted to dashboard`, "whatsapp");
    } catch (error) {
      log(`Error processing message: ${error}`, "whatsapp");
    }
  });

  connectionStatus = "connecting";
  socketIO.emit("connection_status", connectionStatus);
  
  whatsappClient.initialize().catch((error: Error) => {
    log(`Error initializing WhatsApp: ${error}`, "whatsapp");
    connectionStatus = "disconnected";
    socketIO.emit("connection_status", connectionStatus);
  });

  return whatsappClient;
}

async function sendGroupsToClients(socketIO: SocketIOServer) {
  if (!whatsappClient || connectionStatus !== "connected") {
    return;
  }

  try {
    const chats = await whatsappClient.getChats();
    const groups: WhatsAppGroup[] = chats
      .filter((chat: any) => chat.isGroup)
      .map((chat: any) => ({
        id: chat.id._serialized,
        name: chat.name,
        isGroup: true,
      }))
      .sort((a: WhatsAppGroup, b: WhatsAppGroup) => a.name.localeCompare(b.name));

    log(`Found ${groups.length} groups`, "whatsapp");
    socketIO.emit("groups", groups);
  } catch (error) {
    log(`Error fetching groups: ${error}`, "whatsapp");
  }
}

export async function registerRoutes(
  httpServer: Server,
  app: Express
): Promise<Server> {
  // IMPORTANT: Add health check endpoints FIRST before any async operations
  // These must respond immediately for deployment health checks
  app.get("/", (_req, res) => {
    res.status(200).send("OK");
  });

  app.get("/api/health", (_req, res) => {
    res.status(200).json({
      status: "ok",
      whatsapp: connectionStatus,
    });
  });

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

  io.on("connection", async (socket) => {
    log(`Client connected: ${socket.id}`, "socket.io");

    socket.emit("connection_status", connectionStatus);
    socket.emit("settings", storage.getSettings());
    socket.emit("alerts", storage.getAlerts());

    if (connectionStatus === "qr_ready" && cachedQrCode) {
      socket.emit("qr", cachedQrCode);
    }

    if (connectionStatus === "connected") {
      await sendGroupsToClients(io!);
    }

    if (!whatsappClient) {
      initWhatsAppClient(io!);
    }

    socket.on("save_settings", (settings: Settings) => {
      try {
        if (myNumber) {
          settings.myNumber = myNumber;
        }
        storage.saveSettings(settings);
        log(`Settings saved: ${settings.watchedGroups.length} groups, ${settings.alertKeywords.length} keywords`, "socket.io");
        io?.emit("settings", settings);
        socket.emit("settings_saved");
      } catch (error) {
        log(`Error saving settings: ${error}`, "socket.io");
        socket.emit("error", "Failed to save settings");
      }
    });

    socket.on("refresh_groups", async () => {
      log("Refreshing groups...", "socket.io");
      await sendGroupsToClients(io!);
    });

    socket.on("disconnect", () => {
      log(`Client disconnected: ${socket.id}`, "socket.io");
    });
  });

  return httpServer;
}

// Export function to start WhatsApp after server is listening
export function startWhatsAppClient() {
  if (io && !whatsappClient) {
    log("Starting WhatsApp client after server ready...", "whatsapp");
    initWhatsAppClient(io);
  }
}
