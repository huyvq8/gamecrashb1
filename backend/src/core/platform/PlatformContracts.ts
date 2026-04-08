export interface PlatformGameModule {
  gameKey: string;
  start(): Promise<void>;
  stop(): Promise<void>;
}
