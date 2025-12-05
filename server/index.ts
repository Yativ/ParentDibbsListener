import express, { type Request, Response, NextFunction } from "express";
import { registerRoutes } from "./routes";
import { serveStatic } from "./static";
import { createServer } from "http";

const app = express();
const httpServer = createServer(app);

declare module "http" {
  interface IncomingMessage {
    rawBody: unknown;
  }
}

app.use(
  express.json({
    verify: (req, _res, buf) => {
      req.rawBody = buf;
    },
  }),
);

app.use(express.urlencoded({ extended: false }));

export function log(message: string, source = "express") {
  const formattedTime = new Date().toLocaleTimeString("en-US", {
    hour: "numeric",
    minute: "2-digit",
    second: "2-digit",
    hour12: true,
  });

  console.log(`${formattedTime} [${source}] ${message}`);
}

app.use((req, res, next) => {
  const start = Date.now();
  const path = req.path;
  let capturedJsonResponse: Record<string, any> | undefined = undefined;

  const originalResJson = res.json;
  res.json = function (bodyJson, ...args) {
    capturedJsonResponse = bodyJson;
    return originalResJson.apply(res, [bodyJson, ...args]);
  };

  res.on("finish", () => {
    const duration = Date.now() - start;
    if (path.startsWith("/api")) {
      let logLine = `${req.method} ${path} ${res.statusCode} in ${duration}ms`;
      if (capturedJsonResponse) {
        logLine += ` :: ${JSON.stringify(capturedJsonResponse)}`;
      }

      log(logLine);
    }
  });

  next();
});

// Health check endpoints - must be registered FIRST and respond immediately
// This ensures deployment health checks pass before any async setup
app.get("/api/health", (_req, res) => {
  res.status(200).json({ status: "ok" });
});

// In production, serve static files
// If static serving fails, add a fallback / handler
if (process.env.NODE_ENV === "production") {
  let staticOk = false;
  try {
    serveStatic(app);
    staticOk = true;
  } catch (e) {
    console.error("[static] Failed to initialize static file serving:", e);
  }

  // If static files failed to load, add fallback / handler
  if (!staticOk) {
    app.get("/", (_req, res) => {
      res.status(200).type("html").send(`<!DOCTYPE html>
<html lang="he" dir="rtl">
<head><meta charset="UTF-8"><title>כוננות קל</title>
<meta http-equiv="refresh" content="2"></head>
<body style="display:flex;justify-content:center;align-items:center;height:100vh;margin:0;font-family:system-ui;background:#0a0a0a;color:#fff">
<div style="text-align:center"><h1>כוננות קל</h1><p>טוען...</p></div>
</body></html>`);
    });
  }
} else {
  // Development only: loading state while Vite initializes
  let viteReady = false;

  // Temporary loading handler for development - passes through to Vite once ready
  app.use((req, res, next) => {
    // Skip non-HTML requests and API routes
    if (
      req.path.startsWith("/api") ||
      req.path.startsWith("/socket.io") ||
      req.path.includes(".")
    ) {
      return next();
    }

    // If Vite is ready, let it handle the request
    if (viteReady) {
      return next();
    }

    // Show loading page while Vite initializes
    res.status(200).type("html").send(`
      <!DOCTYPE html>
      <html lang="he" dir="rtl">
        <head>
          <meta charset="UTF-8">
          <meta name="viewport" content="width=device-width, initial-scale=1.0">
          <title>כוננות קל - טוען...</title>
          <style>
            body { display: flex; justify-content: center; align-items: center; height: 100vh; margin: 0; font-family: system-ui, sans-serif; background: #0a0a0a; color: #fff; }
            .loader { text-align: center; }
            h1 { font-size: 2rem; margin-bottom: 1rem; }
            p { opacity: 0.7; }
          </style>
          <script>setTimeout(() => location.reload(), 1000);</script>
        </head>
        <body>
          <div class="loader">
            <h1>כוננות קל</h1>
            <p>טוען...</p>
          </div>
        </body>
      </html>
    `);
  });

  // Export setter for viteReady flag (dev only)
  (global as any).setViteReady = () => {
    viteReady = true;
    log("Vite is ready");
  };
}

// Error handler
app.use((err: any, _req: Request, res: Response, _next: NextFunction) => {
  const status = err.status || err.statusCode || 500;
  const message = err.message || "Internal Server Error";
  res.status(status).json({ message });
  throw err;
});

// Start listening IMMEDIATELY - before any async setup
const port = parseInt(process.env.PORT || "5000", 10);
httpServer.listen(
  {
    port,
    host: "0.0.0.0",
    reusePort: true,
  },
  () => {
    log(`serving on port ${port}`);
  },
);

// Async setup happens AFTER server is listening
(async () => {
  // Register API routes and socket.io (async operations)
  await registerRoutes(httpServer, app);

  // In development, setup Vite after routes
  if (process.env.NODE_ENV !== "production") {
    const { setupVite } = await import("./vite");
    await setupVite(httpServer, app);
    // Signal that Vite is ready to handle requests
    if ((global as any).setViteReady) {
      (global as any).setViteReady();
    }
  }

  log("Server fully initialized");
})();
