// Simple in-memory chess events server (ESM)
// Endpoints:
//  POST   /rooms/:roomId/events      -> append presence/move events with ordering and turn enforcement
//  GET    /rooms/:roomId/events?after=<eventId> -> get events after given id (for polling)

import express from 'express';
import cors from 'cors';
import pg from 'pg';

const { Pool } = pg;

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;

const pool = new Pool({
  connectionString: process.env.DATABASE_URL,
});

async function initDb() {
  await pool.query(`
    CREATE TABLE IF NOT EXISTS rooms (
      id VARCHAR(255) PRIMARY KEY,
      events JSONB NOT NULL DEFAULT '[]',
      last_id INTEGER NOT NULL DEFAULT 0,
      current_turn VARCHAR(5) NOT NULL DEFAULT 'white',
      players JSONB NOT NULL DEFAULT '{}'
    );
  `);
  console.log('Database initialized successfully.');
}

function ensureParsedJsonb(value, defaultValue) {
  if (value === null || value === undefined) {
    return defaultValue;
  }
  if (typeof value === 'string') {
    try {
      return JSON.parse(value);
    } catch (e) {
      console.error('Error parsing JSONB:', e);
      return defaultValue;
    }
  }
  return value;
}

async function ensureRoom(roomId) {
  let roomData;
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT * FROM rooms WHERE id = $1', [roomId]);
    if (res.rows.length > 0) {
      roomData = res.rows[0];
      console.log(`[ensureRoom] Fetched room ${roomId} from DB:`, roomData.events, roomData.players);
      roomData.events = ensureParsedJsonb(roomData.events, []);
      roomData.players = ensureParsedJsonb(roomData.players, {});
      console.log(`[ensureRoom] Parsed room ${roomId} from DB:`, roomData.events, roomData.players);
    } else {
      // Create new room
      roomData = {
        id: roomId,
        events: [],
        last_id: 0,
        current_turn: 'white',
        players: {},
      };
      await client.query(
        'INSERT INTO rooms (id, events, last_id, current_turn, players) VALUES ($1, $2, $3, $4, $5)',
        [roomData.id, JSON.stringify(roomData.events), roomData.last_id, roomData.current_turn, JSON.stringify(roomData.players)]
      );
      console.log(`[ensureRoom] Created new room ${roomId} in DB.`);
    }
  } catch (error) {
    console.error(`[ensureRoom] Error processing room ${roomId}:`, error);
    // Rethrow the eror so the calling route can handle it
    throw error;
  } finally {
    client.release();
  }
  return {
    id: roomData.id,
    events: roomData.events,
    lastId: roomData.last_id,
    currentTurn: roomData.current_turn,
    players: roomData.players
  };
}

async function updateRoom(room) {
  const client = await pool.connect();
  try {
    console.log(`[updateRoom] Attempting to update room ${room.id}. Events count: ${room.events.length}, Last ID: ${room.lastId}`);
    console.log(`[updateRoom] Events to save (stringified): ${JSON.stringify(room.events)}`);
    console.log(`[updateRoom] Players to save (stringified): ${JSON.stringify(room.players)}`);

    await client.query(
      'UPDATE rooms SET events = $1, last_id = $2, current_turn = $3, players = $4 WHERE id = $5',
      [JSON.stringify(room.events), room.lastId, room.currentTurn, JSON.stringify(room.players), room.id]
    );
    console.log(`[updateRoom] Successfully updated room ${room.id}.`);
  } catch (error) {
    console.error(`[updateRoom] Error updating room ${room.id}:`, error);
  } finally {
    client.release();
  }
}

async function addEvent(room, message) {
  console.log(`[addEvent] Room ${room.id}. Before push: events count=${room.events.length}, lastId=${room.lastId}`);
  room.lastId += 1;
  const id = String(room.lastId);
  room.events.push({ id, message });
  console.log(`[addEvent] Room ${room.id}. After push: events count=${room.events.length}, lastId=${room.lastId}, new event ID=${id}`);
  console.log(`[addEvent] Room ${room.id}. Events array state:`, room.events);

  await updateRoom(room); // Save updated room state to DB
  return id;
}
app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/rooms/:roomId/events', async (req, res) => {
  try {
    const roomId = req.params.roomId;
    const room = await ensureRoom(roomId);
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
        if (!room.players.white && desired === 'white') {
          room.players.white = senderId;
        } else if (!room.players.black && desired === 'black') {
          room.players.black = senderId;
        }
      } else {
        if (room.players.white === senderId) delete room.players.white;
        if (room.players.black === senderId) delete room.players.black;
      }
      const id = await addEvent(room, message);
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

      room.currentTurn = turn === 'white' ? 'black' : 'white'; 
    
      const id = await addEvent(room, message);
      console.log(`[move] room=${roomId} id=${id} sender=${senderId} nextTurn=${room.currentTurn}`);
      return res.status(201).json({ id });
    }

    // Unknown types still recorded
    const id = await addEvent(room, message);
    console.log(`[event] room=${roomId} id=${id} type=${type}`);
    return res.status(201).json({ id });
  } catch (error) {
    console.error(`[POST /rooms/:roomId/events] Error handling request for room ${req.params.roomId}:`, error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/rooms/:roomId/events', async (req, res) => {
  try {
    const roomId = req.params.roomId;
    const afterId = (req.query.after || '').toString();
    const room = await ensureRoom(roomId);

    // This check is now safer as ensureRoom should throw if room is not found/created
    if (!room || !Array.isArray(room.events)) {
      console.warn(`[events] room=${roomId} not found or events not array, even after ensureRoom. Returning empty.`, room);
      return res.json({ events: [] });
    }

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
  } catch (error) {
    console.error(`[GET /rooms/:roomId/events] Error handling request for room ${req.params.roomId}:`, error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Chess events server listening on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});


