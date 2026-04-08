import { defineConfig } from "vite";
import fs from "node:fs";
import path from "node:path";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [
    react(),
    {
      name: "serve-external-rocket",
      configureServer(server) {
        server.middlewares.use((req, res, next) => {
          if (!req.url) return next();
          if (req.url === "/rocket.png") {
            const external = process.platform === "win32"
              ? "F:/GameB/img/f7eicon.png"
              : "/F/GameB/img/f7eicon.png";
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
        });
      }
    }
  ],
  server: {
    fs: {
      // allow project root and external image directory
      allow: [process.cwd(), "F:/GameB/img", "f:/GameB/img"]
    },
    proxy: {
      "/game": {
        target: "http://localhost:3000",
        changeOrigin: true
      },
      "/wallet": {
        target: "http://localhost:3000",
        changeOrigin: true
      },
      "/ops": {
        target: "http://localhost:3000",
        changeOrigin: true
      },
      "/socket.io": {
        target: "http://localhost:3000",
        changeOrigin: true,
        ws: true
      }
    }
  }
});
