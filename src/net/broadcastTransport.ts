import { NetMessage, Transport } from './types';

export class BroadcastTransport implements Transport {
  private channel: BroadcastChannel | null = null;
  private onMessageHandler: ((message: NetMessage) => void) | null = null;

  connect(channelName: string): void {
    if (this.channel) this.disconnect();
    this.channel = new BroadcastChannel(channelName);
    this.channel.onmessage = (ev: MessageEvent<NetMessage>) => {
      if (this.onMessageHandler && ev.data) {
        this.onMessageHandler(ev.data);
      }
    };
  }

  disconnect(): void {
    if (this.channel) {
      this.channel.close();
      this.channel = null;
    }
  }

  send(message: NetMessage): void {
    if (!this.channel) throw new Error('Transport is not connected');
    this.channel.postMessage(message);
  }

  onMessage(handler: (message: NetMessage) => void): void {
    this.onMessageHandler = handler;
  }
}

export default BroadcastTransport;


