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
      socketIO.emit("qr", qrDataUrl);
      socketIO.emit("connection_status", connectionStatus);
    } catch (error) {
      log(`Error generating QR: ${error}`, "whatsapp");
    }
  });

  whatsappClient.on("ready", async () => {
    log("WhatsApp client is ready!", "whatsapp");
    connectionStatus = "connected";
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

  whatsappClient.on("message", async (msg: any) => {
    try {
      const chat = await msg.getChat();
      
      if (!chat.isGroup) return;

      const settings = storage.getSettings();
      
      if (!settings.watchedGroups.includes(chat.id._serialized)) return;

      const messageText = msg.body.toLowerCase();
      const matchedKeyword = settings.alertKeywords.find((keyword: string) =>
        messageText.includes(keyword.toLowerCase())
      );

      if (!matchedKeyword) return;

      const contact = await msg.getContact();
      const senderName = contact.pushname || contact.name || contact.number || "Unknown";

      log(`Keyword "${matchedKeyword}" detected in ${chat.name}`, "whatsapp");

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

      if (myNumber) {
        try {
          const myChat = await whatsappClient?.getChatById(`${myNumber}@c.us`);
          if (myChat) {
            const alertMessage = `*ParentDibbs Alert*\n\n` +
              `*Group:* ${chat.name}\n` +
              `*Keyword:* ${matchedKeyword}\n` +
              `*From:* ${senderName}\n` +
              `*Time:* ${new Date().toLocaleString()}\n\n` +
              `*Message:*\n${msg.body}`;
            
            await myChat.sendMessage(alertMessage);
            alert.alertSent = true;
            log(`Alert sent to ${myNumber}`, "whatsapp");
          }
        } catch (sendError) {
          log(`Error sending alert: ${sendError}`, "whatsapp");
        }
      }

      socketIO.emit("new_alert", alert);
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
  io = new SocketIOServer(httpServer, {
    path: "/socket.io",
    cors: {
      origin: "*",
      methods: ["GET", "POST"],
    },
  });

  io.on("connection", async (socket) => {
    log(`Client connected: ${socket.id}`, "socket.io");

    socket.emit("connection_status", connectionStatus);
    socket.emit("settings", storage.getSettings());
    socket.emit("alerts", storage.getAlerts());

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

  app.get("/api/health", (_req, res) => {
    res.json({
      status: "ok",
      whatsapp: connectionStatus,
    });
  });

  return httpServer;
}
