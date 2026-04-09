# Deploy Crash (IIS + PM2)

## Kiến trúc đề xuất

| Thành phần | Cổng | Vai trò |
|------------|------|---------|
| **Backend** Fastify + Socket.IO | `2000` | REST `/game`, `/wallet`, … + WebSocket `/socket.io` |
| **Frontend** `vite preview` (bản build) | `2001` | Phục vụ `frontend/dist`, **proxy** `/game`, `/wallet`, `/ops`, `/socket.io` → `2000` |

Trình duyệt chỉ cần mở **một origin** (ví dụ `https://domain/` qua IIS → `2001`). Fetch `/game/...` và Socket.IO đi qua proxy của Vite → API `2000`, tránh CORS.

## 1. Build

```bash
cd gamecrashb1
pnpm install
pnpm -r build
```

Backend chạy từ `backend/dist/index.js`. Frontend build ra `frontend/dist/`.

## 2. Biến môi trường

- **Backend:** `PORT=2000` (hoặc `HTTP_PORT`). Mặc định dev vẫn là `3000` nếu không set.
- **Vite preview:** trong `vite.config.ts`, proxy preview trỏ tới `VITE_PREVIEW_API_TARGET` (mặc định `http://127.0.0.1:2000`).

## 3. PM2

```bash
npm i -g pm2
cd gamecrashb1
pm2 start ecosystem.config.cjs
pm2 status
```

- `crash-api`: `PORT=2000`
- `crash-web`: `vite preview` trên `127.0.0.1:2001`

Kiểm tra:

- `http://127.0.0.1:2000/game/crash/state` → JSON
- `http://127.0.0.1:2001/` → SPA (và API qua cùng host :2001 đã được proxy)

## 4. IIS reverse proxy

1. Cài **URL Rewrite** và **Application Request Routing (ARR)**.
2. Trong ARR: **Enable proxy** (Server Proxy Settings).
3. Tạo site trỏ tới thư mục có `web.config`, hoặc gắn `deploy/iis-web.config.example` vào site.

Rule mẫu: rewrite mọi request tới `http://127.0.0.1:2001/...` (Cách 1 trong file example). IIS chỉ là HTTPS + hostname; logic API vẫn do Vite preview proxy tới `2000`.

**Lưu ý WebSocket:** ARR cần hỗ trợ upgrade; nếu Socket.IO lỗi qua IIS, thử bật WebSocket trong site hoặc dùng rule riêng cho `/socket.io` trỏ thẳng `http://127.0.0.1:2000/socket.io` (Cách 2).

## 5. Cách 2 (IIS tách path, không phụ thuộc proxy Vite)

Build SPA với `API_BASE` trỏ public URL API (cần chỉnh `apiClient` + CORS backend). Phức tạp hơn; mô hình PM2 + proxy trong `vite preview` thường đủ cho intranet.

## 6. Rocket image

`vite.config.ts` vẫn có thể đọc `F:/GameB/img/f7eicon.png` (Windows). Trên server, chỉnh đường dẫn hoặc đặt `rocket.png` trong `public/`.
