import express, { type Express } from "express";
import fs from "fs";
import path from "path";

let cachedIndexHtml: string | null = null;

function findStaticDir(): string {
  // Try multiple strategies to find the static files directory
  // This handles different deployment environments (local, Replit VM, etc.)
  
  const candidates = [
    // Strategy 1: Use __dirname (for CJS bundles, this is the bundle directory)
    // In production: dist/index.cjs -> __dirname = dist/ -> dist/public
    path.resolve(__dirname, "public"),
    // Strategy 2: Relative to the running script (dist/index.cjs -> dist/public)
    path.resolve(path.dirname(process.argv[1]), "public"),
    // Strategy 3: Relative to working directory (project root -> dist/public)
    path.resolve(process.cwd(), "dist", "public"),
    // Strategy 4: Relative to working directory without dist (in case cwd is dist/)
    path.resolve(process.cwd(), "public"),
  ];
  
  for (const candidate of candidates) {
    if (fs.existsSync(candidate) && fs.existsSync(path.join(candidate, "index.html"))) {
      console.log(`[static] Using static directory: ${candidate}`);
      return candidate;
    }
  }
  
  // Log all attempted paths for debugging
  console.error("[static] Could not find static directory. Tried:");
  candidates.forEach(c => console.error(`  - ${c} (exists: ${fs.existsSync(c)})`));
  
  throw new Error(
    `Could not find the build directory with index.html. Tried: ${candidates.join(", ")}`,
  );
}

export function serveStatic(app: Express) {
  const distPath = findStaticDir();

  const indexPath = path.resolve(distPath, "index.html");
  
  // Pre-cache index.html for instant health check responses

  // Serve root "/" with cached HTML for instant health check response
  // This returns 200 with the actual SPA HTML (not plain "OK" text)
  app.get("/", (_req, res) => {
    if (cachedIndexHtml) {
      res.status(200).type("html").send(cachedIndexHtml);
    } else {
      res.sendFile(indexPath);
    }
  });

  // Static middleware handles all other assets (JS, CSS, images, etc.)
  app.use(express.static(distPath));

  // fall through to index.html if the file doesn't exist
  // Exclude API routes and Socket.IO from the catch-all
  app.use("*", (req, res, next) => {
    const requestPath = req.originalUrl || req.path;
    // Don't intercept API routes or Socket.IO
    if (requestPath.startsWith("/api") || requestPath.startsWith("/socket.io")) {
      return next();
    }
    if (cachedIndexHtml) {
      res.status(200).type("html").send(cachedIndexHtml);
    } else {
      res.sendFile(indexPath);
    }
  });
}
