export type PlayerColor = 'white' | 'black';

export interface UserIdentity {
  userId: string;
  displayName: string;
}

export interface MovePayload {
  fromRow: number;
  fromCol: number;
  toRow: number;
  toCol: number;
  promotion?: 'queen' | 'rook' | 'bishop' | 'knight';
}

export type NetMessage = (
  | { type: 'move'; roomId: string; senderId: string; payload: MovePayload }
  | { type: 'presence'; roomId: string; senderId: string; payload: { joined: boolean; desiredColor?: PlayerColor; displayName?: string } }
  | { type: 'match_started'; roomId: string; senderId: string; payload: { whiteTimeMs: number; blackTimeMs: number; currentTurn: PlayerColor } }
  | { type: 'game_end'; roomId: string; senderId: string; payload: { winner: PlayerColor; reason: 'checkmate' | 'timeout'; prize: number } }
) & { initData?: string };

export interface ServerClock {
  started: boolean;
  status: string;
  currentTurn: PlayerColor;
  whiteTimeMs: number;
  blackTimeMs: number;
  turnStartedAt: string | null;
  serverTime: number;
  stake: number;
  prize: number;
}

export interface Transport {
  connect(channelName: string): void;
  disconnect(): void;
  send(message: NetMessage): void | Promise<void>;
  onMessage(handler: (message: NetMessage) => void): void;
  onClock?(handler: (clock: ServerClock) => void): void;
}


