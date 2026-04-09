import { defineConfig } from "vite";
import fs from "node:fs";
import path from "node:path";
import type { Connect } from "vite";
import react from "@vitejs/plugin-react";

const apiTarget = process.env.VITE_DEV_API_TARGET ?? "http://127.0.0.1:3000";
const previewApiTarget = process.env.VITE_PREVIEW_API_TARGET ?? "http://127.0.0.1:2000";

const rocketPngMiddleware: Connect.NextHandleFunction = (req, res, next) => {
  if (!req.url) return next();
  if (req.url === "/rocket.png") {
    const external =
      process.platform === "win32" ? "F:/GameB/img/f7eicon.png" : "/F/GameB/img/f7eicon.png";
    try {
      const data = fs.readFileSync(path.normalize(external));
      res.statusCode = 200;
      res.setHeader("Content-Type", "image/png");
      res.end(data);
      return;
    } catch {
      // fallthrough -> 404
    }
  }
  next();
};

export default defineConfig({
  plugins: [
    react(),
    {
      name: "serve-external-rocket",
      configureServer(server) {
        server.middlewares.use(rocketPngMiddleware);
      },
      configurePreviewServer(server) {
        server.middlewares.use(rocketPngMiddleware);
      }
    }
  ],
  server: {
    // Listen on all local addresses so both http://localhost and http://127.0.0.1 work on Windows.
    host: true,
    port: 5173,
    fs: {
      // allow project root and external image directory
      allow: [process.cwd(), "F:/GameB/img", "f:/GameB/img"]
    },
    proxy: {
      "/game": {
        target: apiTarget,
        changeOrigin: true
      },
      "/wallet": {
        target: apiTarget,
        changeOrigin: true
      },
      "/ops": {
        target: apiTarget,
        changeOrigin: true
      },
      "/socket.io": {
        target: apiTarget,
        changeOrigin: true,
        ws: true
      }
    }
  },
  /** Production-style preview: one port for SPA, proxy API to PM2 backend (default :2000). */
  preview: {
    host: "127.0.0.1",
    port: 2001,
    strictPort: true,
    proxy: {
      "/game": {
        target: previewApiTarget,
        changeOrigin: true
      },
      "/wallet": {
        target: previewApiTarget,
        changeOrigin: true
      },
      "/ops": {
        target: previewApiTarget,
        changeOrigin: true
      },
      "/socket.io": {
        target: previewApiTarget,
        changeOrigin: true,
        ws: true
      }
    }
  }
});
