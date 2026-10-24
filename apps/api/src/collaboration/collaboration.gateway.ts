import { Inject } from '@nestjs/common';
import { OnGatewayConnection, OnGatewayDisconnect, WebSocketGateway } from '@nestjs/websockets';
import { Socket } from 'socket.io';
import { z } from 'zod';
import { AuthService } from '../auth/auth.service';
import { CollaborationService } from './collaboration.service';
import { roomEdit } from './collaboration.controller';
import { CONFIG, Config } from '../config';

@WebSocketGateway({
  namespace: '/collaboration',
  transports: ['websocket'],
  maxHttpBufferSize: 16384,
  serveClient: false,
})
export class CollaborationGateway implements OnGatewayConnection, OnGatewayDisconnect {
  private timers = new Map<string, NodeJS.Timeout>();
  private users = new Map<string, number>();
  constructor(
    private readonly auth: AuthService,
    private readonly collaboration: CollaborationService,
    @Inject(CONFIG) private readonly config: Config,
  ) {}
  async handleConnection(client: Socket) {
    try {
      const origin = client.handshake.headers.origin;
      if (
        !origin ||
        !this.config.CORS_ORIGINS.split(',')
          .map((x) => x.trim())
          .includes(origin)
      )
        throw new Error();
      const bearer = z.string().min(20).max(8192).parse(client.handshake.auth.token);
      const user = await this.auth.authenticate(bearer);
      if (user.role === 'guest' || (this.users.get(user.id) ?? 0) >= 5) throw new Error();
      const roomId = z.string().uuid().parse(client.handshake.auth.room_id);
      let after = z
        .string()
        .regex(/^\d{1,18}$/)
        .parse(client.handshake.auth.after ?? '0');
      const snapshot = await this.collaboration.room(user, roomId);
      this.users.set(user.id, (this.users.get(user.id) ?? 0) + 1);
      client.data.userId = user.id;
      client.emit('room.snapshot', snapshot);
      let polling = false,
        window = Date.now(),
        edits = 0;
      client.on('room.edit', async (input: unknown, ack: unknown) => {
        if (typeof ack !== 'function') return;
        try {
          if (Date.now() - window > 60000) {
            window = Date.now();
            edits = 0;
          }
          if (++edits > 60) throw new Error();
          const verified = await this.auth.authenticate(bearer);
          const result = await this.collaboration.edit(verified, roomId, roomEdit.parse(input));
          ack({ ok: true, room: result });
        } catch {
          ack({ ok: false, error: 'Edit rejected. Refresh the current room and permissions.' });
        }
      });
      const poll = async () => {
        if (polling || !client.connected) return;
        polling = true;
        try {
          const verified = await this.auth.authenticate(bearer);
          const events = await this.collaboration.events(verified, roomId, after);
          for (const event of events) {
            client.emit('room.event', event);
            after = String(event.sequence);
          }
        } catch {
          client.disconnect(true);
        } finally {
          polling = false;
        }
      };
      this.timers.set(
        client.id,
        setInterval(() => void poll(), 500),
      );
      await poll();
    } catch {
      client.emit('access.error', { message: 'Room access denied' });
      client.disconnect(true);
    }
  }
  handleDisconnect(client: Socket) {
    const timer = this.timers.get(client.id);
    if (timer) clearInterval(timer);
    this.timers.delete(client.id);
    if (client.data.userId) {
      const count = Math.max(0, (this.users.get(client.data.userId) ?? 1) - 1);
      if (count) this.users.set(client.data.userId, count);
      else this.users.delete(client.data.userId);
    }
  }
}
