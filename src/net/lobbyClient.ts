import { BroadcastTransport } from './broadcastTransport';
import RestTransport from './restTransport';
import { MovePayload, NetMessage, PlayerColor, Transport, UserIdentity } from './types';

export interface LobbyState {
  roomId: string;
  self: UserIdentity;
  opponent: UserIdentity | null;
  selfColor: PlayerColor;
}

export type LobbyEvents = {
  onOpponentJoined?: (opponent: UserIdentity) => void;
  onOpponentLeft?: () => void;
  onMove?: (sender: UserIdentity, payload: MovePayload) => void;
};

export class LobbyClient {
  private transport: Transport;
  private state: LobbyState;
  private events: LobbyEvents;

  constructor(params: {
    transport?: Transport;
    roomId: string;
    self: UserIdentity;
    selfColor: PlayerColor;
    events?: LobbyEvents;
  }) {
    if (params.transport) {
      this.transport = params.transport;
    } else {
      let apiBase = (import.meta as any).env?.VITE_API_BASE as string | undefined;
      if (!apiBase && typeof window !== 'undefined') {
        const host = window.location.hostname;
        if (host === 'localhost' || host === '127.0.0.1') {
          apiBase = 'http://localhost:3000';
        }
      }
      this.transport = apiBase ? new RestTransport(apiBase) : new BroadcastTransport();
    }
    this.state = {
      roomId: params.roomId,
      self: params.self,
      opponent: null,
      selfColor: params.selfColor,
    };
    this.events = params.events ?? {};

    this.transport.onMessage((message) => this.handleMessage(message));
    this.transport.connect(this.getChannelName(params.roomId));
    this.announcePresence(true);
  }

  dispose(): void {
    this.announcePresence(false);
    this.transport.disconnect();
  }

  private getChannelName(roomId: string): string {
    return `chess-room-${roomId}`;
  }

  private announcePresence(joined: boolean): void {
    const message: NetMessage = {
      type: 'presence',
      roomId: this.state.roomId,
      senderId: this.state.self.userId,
      payload: { joined, desiredColor: this.state.selfColor, displayName: this.state.self.displayName },
    };
    this.transport.send(message);
  }

  private handleMessage(message: NetMessage): void {
    if (message.roomId !== this.state.roomId) return;
    if (message.senderId === this.state.self.userId) return;

    if (message.type === 'presence') {
      if (message.payload.joined) {
        this.state.opponent = { userId: message.senderId, displayName: 'Opponent' };
        this.events.onOpponentJoined?.(this.state.opponent);
      } else {
        this.state.opponent = null;
        this.events.onOpponentLeft?.();
      }
      return;
    }

    if (message.type === 'move') {
      const opponent: UserIdentity = this.state.opponent ?? { userId: message.senderId, displayName: 'Opponent' };
      this.events.onMove?.(opponent, message.payload);
      return;
    }
  }

  sendMove(payload: MovePayload): void {
    const message: NetMessage = {
      type: 'move',
      roomId: this.state.roomId,
      senderId: this.state.self.userId,
      payload,
    };
    this.transport.send(message);
  }

  getRoomId(): string {
    return this.state.roomId;
  }

  getSelfColor(): PlayerColor {
    return this.state.selfColor;
  }

  getOpponent(): UserIdentity | null {
    return this.state.opponent;
  }
}

export default LobbyClient;


