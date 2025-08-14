import { NetMessage, Transport } from './types';

/**
 * Транспорт поверх REST API. send() делает POST /events, onMessage запускает polling /events/stream.
 * Реальная реализация зависит от вашего сервера. Здесь — минимальный опрос long-polling.
 */
export class RestTransport implements Transport {
  private baseUrl: string;
  private roomId: string | null = null;
  private onMessageHandler: ((message: NetMessage) => void) | null = null;
  private polling = false;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl.replace(/\/$/, '');
  }

  connect(channelName: string): void {
    // channelName ожидается вида chess-room-<roomId>
    const match = channelName.match(/^chess-room-(.+)$/);
    this.roomId = match ? match[1] : channelName;
    this.startPolling();
  }

  disconnect(): void {
    this.polling = false;
  }

  async send(message: NetMessage): Promise<void> {
    if (!this.roomId) throw new Error('Not connected');
    await fetch(`${this.baseUrl}/rooms/${encodeURIComponent(this.roomId)}/events`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(message),
    });
  }

  onMessage(handler: (message: NetMessage) => void): void {
    this.onMessageHandler = handler;
  }

  private async startPolling(): Promise<void> {
    if (!this.roomId || this.polling) return;
    this.polling = true;
    let lastEventId = '';
    while (this.polling) {
      try {
        const res = await fetch(`${this.baseUrl}/rooms/${encodeURIComponent(this.roomId)}/events?after=${encodeURIComponent(lastEventId)}`, {
          method: 'GET',
          headers: { 'Accept': 'application/json' },
        });
        if (!res.ok) throw new Error('Polling failed');
        const data: { events: Array<{ id: string; message: NetMessage }> } = await res.json();
        for (const evt of data.events) {
          lastEventId = evt.id;
          if (this.onMessageHandler) this.onMessageHandler(evt.message);
        }
      } catch (_err) {
        await new Promise(r => setTimeout(r, 1000));
      }
    }
  }
}

export default RestTransport;


