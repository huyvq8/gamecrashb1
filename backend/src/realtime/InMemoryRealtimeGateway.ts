import type { RealtimeGateway } from "./RealtimeGateway";

export interface PublishedEvent {
  eventName: string;
  payload: Record<string, unknown>;
}

export class InMemoryRealtimeGateway implements RealtimeGateway {
  readonly events: PublishedEvent[] = [];

  async subscribeToGame(_gameKey: string, _subscriberId: string): Promise<void> {
    return;
  }

  async unsubscribeFromGame(_gameKey: string, _subscriberId: string): Promise<void> {
    return;
  }

  async publishEvent<TPayload extends Record<string, unknown>>(eventName: string, payload: TPayload): Promise<void> {
    this.events.push({ eventName, payload });
  }
}
