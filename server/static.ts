import express, { type Express } from "express";
import fs from "fs";
import path from "path";

let cachedIndexHtml: string | null = null;

export function serveStatic(app: Express) {
  const distPath = path.resolve(__dirname, "public");
  if (!fs.existsSync(distPath)) {
    throw new Error(
      `Could not find the build directory: ${distPath}, make sure to build the client first`,
    );
  }

  const indexPath = path.resolve(distPath, "index.html");
  
  // Pre-cache index.html for instant health check responses
  if (fs.existsSync(indexPath)) {
    cachedIndexHtml = fs.readFileSync(indexPath, "utf-8");
  }

  // Root "/" health check is handled in index.ts before all middleware
  // This static middleware handles all other assets
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
