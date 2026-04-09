import { io, type Socket } from "socket.io-client";

function devSocketOrigin(): string {
  if (typeof window === "undefined") {
    return "http://127.0.0.1:3000";
  }
  return `${window.location.protocol}//${window.location.hostname}:3000`;
}

/**
 * Dev: talk to Fastify on :3000 directly. Vite's WS proxy for /socket.io often throws
 * ECONNABORTED on Windows when the upstream stream is reset.
 * Prod: same host as the page (expect reverse proxy to expose /socket.io).
 */
export function createSocketClient(): Socket {
  const url = import.meta.env.DEV ? devSocketOrigin() : undefined;
  return io(url, { transports: ["websocket"] });
}
