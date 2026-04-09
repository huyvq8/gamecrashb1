/**
 * PM2 (Windows / Linux): API on PORT 2000, Vite preview (built SPA) on 2001 with proxy to API.
 *
 * Chuẩn bị:
 *   pnpm install
 *   pnpm -r build
 *
 * Chạy:
 *   pm2 start ecosystem.config.cjs
 *   pm2 save
 *   pm2 startup   (tuỳ OS)
 */
module.exports = {
  apps: [
    {
      name: "crash-api",
      cwd: __dirname + "/backend",
      script: "node",
      args: "dist/index.js",
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
      cwd: __dirname + "/frontend",
      script: "node",
      args: "./node_modules/vite/bin/vite.js preview --host 127.0.0.1 --port 2001",
      instances: 1,
      autorestart: true,
      max_memory_restart: "300M",
      env: {
        NODE_ENV: "production"
      }
    }
  ]
};
