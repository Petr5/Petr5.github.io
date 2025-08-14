// Simple in-memory chess events server (ESM)
// Endpoints:
//  POST   /rooms/:roomId/events      -> append presence/move events with ordering and turn enforcement
//  GET    /rooms/:roomId/events?after=<eventId> -> get events after given id (for polling)

import express from 'express';
import cors from 'cors';

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

/** @type {Map<string, {
 *  events: Array<{ id: string, message: any }>,
 *  lastId: number,
 *  currentTurn: 'white' | 'black',
 *  players: { white?: string, black?: string },
 * }>} */
const rooms = new Map();

function ensureRoom(roomId) {
  if (!rooms.has(roomId)) {
    rooms.set(roomId, {
      events: [],
      lastId: 0,
      currentTurn: 'white',
      players: {},
    });
  }
  return rooms.get(roomId);
}

function addEvent(room, message) {
  room.lastId += 1;
  const id = String(room.lastId);
  room.events.push({ id, message });
  return id;
}

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/rooms/:roomId/events', (req, res) => {
  const roomId = req.params.roomId;
  const room = ensureRoom(roomId);
  const message = req.body;

  if (!message || typeof message !== 'object') {
    return res.status(400).json({ error: 'Invalid message' });
  }

  const { type, senderId } = message;
  if (!type || !senderId) {
    return res.status(400).json({ error: 'Missing type or senderId' });
  }

  // Presence handling: allow client to announce desired color and presence
  if (type === 'presence') {
    const desired = message.payload?.desiredColor;
    if (message.payload?.joined) {
      if (desired === 'white') {
        if (!room.players.white) room.players.white = senderId;
      } else if (desired === 'black') {
        if (!room.players.black) room.players.black = senderId;
      }
    } else {
      if (room.players.white === senderId) delete room.players.white;
      if (room.players.black === senderId) delete room.players.black;
    }
    const id = addEvent(room, message);
    console.log(`[presence] room=${roomId} id=${id} sender=${senderId} desired=${desired} players=`, room.players);
    return res.status(201).json({ id });
  }

  // Move handling with strict turn order
  if (type === 'move') {
    const turn = room.currentTurn; // whose move expected
    const expectedPlayerId = room.players[turn];

    if (!expectedPlayerId) {
      // First claim for this color
      room.players[turn] = senderId;
    } else if (expectedPlayerId !== senderId) {
      console.warn(`[move] reject room=${roomId} sender=${senderId} expectedTurn=${turn} expectedPlayer=${expectedPlayerId}`);
      return res.status(409).json({ error: 'Not your turn' });
    }

    const id = addEvent(room, message);
    room.currentTurn = turn === 'white' ? 'black' : 'white';
    console.log(`[move] room=${roomId} id=${id} sender=${senderId} nextTurn=${room.currentTurn}`);
    return res.status(201).json({ id });
  }

  // Unknown types still recorded
  const id = addEvent(room, message);
  console.log(`[event] room=${roomId} id=${id} type=${type}`);
  return res.status(201).json({ id });
});

app.get('/rooms/:roomId/events', (req, res) => {
  const roomId = req.params.roomId;
  const afterId = (req.query.after || '').toString();
  const room = ensureRoom(roomId);

  if (!afterId) {
    console.log(`[events] room=${roomId} full size=${room.events.length}`);
    return res.json({ events: room.events });
  }

  const idx = room.events.findIndex(e => e.id === afterId);
  if (idx === -1) {
    console.log(`[events] room=${roomId} from start (after not found) size=${room.events.length}`);
    return res.json({ events: room.events });
  }
  const slice = room.events.slice(idx + 1);
  console.log(`[events] room=${roomId} after=${afterId} size=${slice.length}`);
  return res.json({ events: slice });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Chess events server listening on http://localhost:${PORT}`);
});


