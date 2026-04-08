import { io, type Socket } from "socket.io-client";

export function createSocketClient(): Socket {
  return io({ transports: ["websocket"] });
}
