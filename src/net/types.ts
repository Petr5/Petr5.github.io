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

export type NetMessage =
  | { type: 'move'; roomId: string; senderId: string; payload: MovePayload }
  | { type: 'presence'; roomId: string; senderId: string; payload: { joined: boolean; desiredColor?: PlayerColor; displayName?: string } };

export interface Transport {
  connect(channelName: string): void;
  disconnect(): void;
  send(message: NetMessage): void;
  onMessage(handler: (message: NetMessage) => void): void;
}


