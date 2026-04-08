export interface RealtimeGateway {
  subscribeToGame(gameKey: string, subscriberId: string): Promise<void>;
  unsubscribeFromGame(gameKey: string, subscriberId: string): Promise<void>;
  publishEvent<TPayload extends Record<string, unknown>>(eventName: string, payload: TPayload): Promise<void>;
}
