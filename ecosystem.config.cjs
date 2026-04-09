/**
 * PM2 (Windows / Linux): API on PORT 2000, Vite preview (built SPA) on 2001 with proxy to API.
 *
 * Chuẩn bị:
 *   pnpm install   (hoặc npx pnpm@10 install)
 *   pnpm -r build  (hoặc npm run build)
 *
 * Chạy:
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *   pm2 startup   (tuỳ OS)
 */
const path = require("path");

const backendRoot = path.join(__dirname, "backend");
const frontendRoot = path.join(__dirname, "frontend");

module.exports = {
  apps: [
    {
      name: "crash-api",
      cwd: backendRoot,
      /** Trỏ thẳng file .js — ổn định hơn `script: node` + args trên Windows. */
      script: path.join(backendRoot, "dist", "index.js"),
      instances: 1,
      autorestart: true,
      max_memory_restart: "400M",
      env: {
        NODE_ENV: "production",
        PORT: "2000"
      }
    },
    {
      name: "crash-web",
      cwd: frontendRoot,
      script: path.join(frontendRoot, "node_modules", "vite", "bin", "vite.js"),
      args: ["preview", "--host", "127.0.0.1", "--port", "2001"],
      instances: 1,
      autorestart: true,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
