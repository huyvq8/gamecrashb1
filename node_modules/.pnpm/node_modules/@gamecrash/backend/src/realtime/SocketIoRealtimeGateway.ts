import { Server } from "socket.io";
import type { RealtimeGateway } from "./RealtimeGateway";

export class SocketIoRealtimeGateway implements RealtimeGateway {
  constructor(private readonly io: Server) {}

  async subscribeToGame(gameKey: string, subscriberId: string): Promise<void> {
    const socket = this.io.sockets.sockets.get(subscriberId);
    if (socket) {
      await socket.join(`game:${gameKey}`);
    }
  }

  async unsubscribeFromGame(gameKey: string, subscriberId: string): Promise<void> {
    const socket = this.io.sockets.sockets.get(subscriberId);
    if (socket) {
      await socket.leave(`game:${gameKey}`);
    }
  }

  async publishEvent<TPayload extends Record<string, unknown>>(eventName: string, payload: TPayload): Promise<void> {
    const gameKey = typeof payload.gameKey === "string" ? payload.gameKey : "crash";
    this.io.to(`game:${gameKey}`).emit(eventName, payload);
    this.io.emit(eventName, payload);
  }
}
