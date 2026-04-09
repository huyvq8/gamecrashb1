export type CrashSocketEvent =
  | 'ROUND_CREATED'
  | 'BETTING_OPEN'
  | 'ROUND_STARTED'
  | 'MULTIPLIER_TICK'
  | 'CASHOUT_ACCEPTED'
  | 'ROUND_CRASHED'
  | 'ROUND_SETTLED'
  | 'connect'
  | 'reconnect';

export interface CrashSocketLike {
  on: (event: CrashSocketEvent, cb: (payload?: any) => void) => void;
  off: (event: CrashSocketEvent, cb: (payload?: any) => void) => void;
  disconnect: () => void;
}

export function createCrashSocket(): CrashSocketLike {
  const anyWindow = window as any;
  if (typeof anyWindow.io === 'function') {
    const socket = anyWindow.io(undefined, { transports: ['websocket'] });
    return {
      on: (event, cb) => socket.on(event, cb),
      off: (event, cb) => socket.off(event, cb),
      disconnect: () => socket.disconnect(),
    };
  }

  return {
    on: () => undefined,
    off: () => undefined,
    disconnect: () => undefined,
  };
}
