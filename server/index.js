// Simple in-memory chess events server (ESM)
// Endpoints:
//  POST   /rooms/:roomId/events      -> append presence/move events with ordering and turn enforcement
//  GET    /rooms/:roomId/events?after=<eventId> -> get events after given id (for polling)

import express from 'express';
import cors from 'cors';
import pg from 'pg';
import { createHmac, randomUUID, timingSafeEqual } from 'node:crypto';
import { Chess } from 'chess.js';

const { Pool } = pg;

const app = express();
app.use(cors());
app.use(express.json());

const PORT = process.env.PORT || 3000;
const STAKE_STARS = Number(process.env.STAKE_STARS || 10);
const MATCH_TIME_MS = Number(process.env.MATCH_TIME_MS || 10 * 60 * 1000);
const TELEGRAM_BOT_TOKEN = process.env.TELEGRAM_BOT_TOKEN;
const TELEGRAM_WEBHOOK_SECRET = process.env.TELEGRAM_WEBHOOK_SECRET
  || (TELEGRAM_BOT_TOKEN
    ? createHmac('sha256', TELEGRAM_BOT_TOKEN).update('chess-stars-webhook').digest('hex')
    : '');
const TELEGRAM_WEBHOOK_URL = 'https://chess-events.fly.dev/telegram/webhook';

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
          players JSONB NOT NULL DEFAULT '{}',
          player_names JSONB NOT NULL DEFAULT '{}',
          created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
          status VARCHAR(20) DEFAULT 'active',
          started_at TIMESTAMP,
          white_time_ms INTEGER NOT NULL DEFAULT 600000,
          black_time_ms INTEGER NOT NULL DEFAULT 600000,
          turn_started_at TIMESTAMP,
          position_fen TEXT
        );
  `);

  await pool.query(`
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS started_at TIMESTAMP;
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS white_time_ms INTEGER NOT NULL DEFAULT 600000;
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS black_time_ms INTEGER NOT NULL DEFAULT 600000;
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS turn_started_at TIMESTAMP;
    ALTER TABLE rooms ADD COLUMN IF NOT EXISTS position_fen TEXT;

    CREATE TABLE IF NOT EXISTS internal_star_payments (
      payload VARCHAR(128) PRIMARY KEY,
      room_id VARCHAR(255) NOT NULL,
      user_id VARCHAR(255) NOT NULL,
      amount INTEGER NOT NULL,
      invoice_url TEXT,
      telegram_charge_id VARCHAR(255) UNIQUE,
      status VARCHAR(20) NOT NULL DEFAULT 'pending',
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
      paid_at TIMESTAMP,
      UNIQUE (room_id, user_id, payload)
    );
  `);

  await pool.query(`
    CREATE TABLE IF NOT EXISTS internal_star_balances (
      user_id VARCHAR(255) PRIMARY KEY,
      balance INTEGER NOT NULL DEFAULT 0 CHECK (balance >= 0)
    );
    CREATE TABLE IF NOT EXISTS internal_star_awards (
      room_id VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      amount INTEGER NOT NULL,
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
    CREATE TABLE IF NOT EXISTS internal_star_ledger (
      operation_key VARCHAR(255) PRIMARY KEY,
      user_id VARCHAR(255) NOT NULL,
      delta INTEGER NOT NULL,
      reason VARCHAR(32) NOT NULL,
      room_id VARCHAR(255),
      created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
    );
  `);
  
  // Добавляем поля к существующим таблицам, если их нет
  try {
    await pool.query(`
      ALTER TABLE rooms 
      ADD COLUMN IF NOT EXISTS created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP;
    `);
    // console.log('Added created_at column if it did not exist.');
  } catch (error) {
    // console.log('Column created_at might already exist or error adding it:', error.message);
  }
  
  try {
    await pool.query(`
      ALTER TABLE rooms 
      ADD COLUMN IF NOT EXISTS status VARCHAR(20) DEFAULT 'active';
    `);
    // console.log('Added status column if it did not exist.');
  } catch (error) {
    // console.log('Column status might already exist or error adding it:', error.message);
  }

  try {
    await pool.query(`
      ALTER TABLE rooms 
      ADD COLUMN IF NOT EXISTS player_names JSONB NOT NULL DEFAULT '{}';
    `);
    // console.log('Added player_names column if it did not exist.');
  } catch (error) {
    // console.log('Column player_names might already exist or error adding it:', error.message);
  }
  
  // console.log('Database initialized successfully.');
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

function verifyTelegramUser(initData, expectedUserId) {
  if (!initData && process.env.NODE_ENV !== 'production') return true;
  if (!TELEGRAM_BOT_TOKEN || typeof initData !== 'string' || !initData) return false;

  try {
    const params = new URLSearchParams(initData);
    const receivedHash = params.get('hash');
    const authDate = Number(params.get('auth_date'));
    const user = JSON.parse(params.get('user') || '{}');
    const now = Math.floor(Date.now() / 1000);
    if (!receivedHash || !Number.isFinite(authDate) || authDate > now + 60 || now - authDate > 86400) return false;
    if (String(user.id) !== String(expectedUserId)) return false;

    params.delete('hash');
    const dataCheckString = [...params.entries()]
      .sort(([left], [right]) => left.localeCompare(right))
      .map(([key, value]) => `${key}=${value}`)
      .join('\n');
    const secretKey = createHmac('sha256', 'WebAppData').update(TELEGRAM_BOT_TOKEN).digest();
    const calculatedHash = createHmac('sha256', secretKey).update(dataCheckString).digest();
    const suppliedHash = Buffer.from(receivedHash, 'hex');
    return suppliedHash.length === calculatedHash.length && timingSafeEqual(suppliedHash, calculatedHash);
  } catch (_error) {
    return false;
  }
}

async function configureTelegramWebhook() {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_WEBHOOK_SECRET) return;

  try {
    const infoResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/getWebhookInfo`);
    const info = await infoResponse.json();
    if (!infoResponse.ok || !info.ok) {
      throw new Error(info.description || 'getWebhookInfo failed');
    }
    if (info.result.url && info.result.url !== TELEGRAM_WEBHOOK_URL) {
      console.error('Telegram bot already has a different webhook configured; leaving it unchanged.');
      return;
    }

    const setResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/setWebhook`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        url: TELEGRAM_WEBHOOK_URL,
        secret_token: TELEGRAM_WEBHOOK_SECRET,
        allowed_updates: ['message', 'pre_checkout_query'],
      }),
    });
    const result = await setResponse.json();
    if (!setResponse.ok || !result.ok) {
      throw new Error(result.description || 'setWebhook failed');
    }
    console.log('Telegram payment webhook configured.');
  } catch (error) {
    console.error('Could not configure Telegram payment webhook:', error.message);
  }
}

async function ensureRoom(roomId) {
  let roomData;
  const client = await pool.connect();
  try {
    const res = await client.query('SELECT * FROM rooms WHERE id = $1', [roomId]);
    if (res.rows.length > 0) {
      roomData = res.rows[0];
      // console.log(`[ensureRoom] Fetched room ${roomId} from DB:`, roomData.events, roomData.players, roomData.player_names);
      roomData.events = ensureParsedJsonb(roomData.events, []);
      roomData.players = ensureParsedJsonb(roomData.players, {});
      roomData.player_names = ensureParsedJsonb(roomData.player_names, {});
      // console.log(`[ensureRoom] Parsed room ${roomId} from DB:`, roomData.events, roomData.players, roomData.player_names);
    } else {
      await client.query(
        `INSERT INTO rooms (id, events, last_id, current_turn, players, player_names)
         VALUES ($1, '[]', 0, 'white', '{}', '{}')
         ON CONFLICT (id) DO NOTHING`,
        [roomId]
      );
      const createdResult = await client.query('SELECT * FROM rooms WHERE id = $1', [roomId]);
      roomData = createdResult.rows[0];
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
    // console.log(`[updateRoom] Attempting to update room ${room.id}. Events count: ${room.events.length}, Last ID: ${room.lastId}`);
    // console.log(`[updateRoom] Events to save (stringified): ${JSON.stringify(room.events)}`);
    // console.log(`[updateRoom] Players to save (stringified): ${JSON.stringify(room.players)}`);

    await client.query(
      'UPDATE rooms SET events = $1, last_id = $2, current_turn = $3, players = $4 WHERE id = $5',
      [JSON.stringify(room.events), room.lastId, room.currentTurn, JSON.stringify(room.players), room.id]
    );
    // console.log(`[updateRoom] Successfully updated room ${room.id}.`);
  } catch (error) {
    console.error(`[updateRoom] Error updating room ${room.id}:`, error);
  } finally {
    client.release();
  }
}

async function addEvent(room, message) {
  // console.log(`[addEvent] Room ${room.id}. Before push: events count=${room.events.length}, lastId=${room.lastId}`);
  room.lastId += 1;
  const id = String(room.lastId);
  room.events.push({ id, message });
  // console.log(`[addEvent] Room ${room.id}. After push: events count=${room.events.length}, lastId=${room.lastId}, new event ID=${id}`);
  // console.log(`[addEvent] Room ${room.id}. Events array state:`, room.events);

  await updateRoom(room); // Save updated room state to DB
  return id;
}

function appendRoomEvent(events, room, message) {
  room.last_id += 1;
  const id = String(room.last_id);
  events.push({ id, message });
  return id;
}

async function awardInternalStars(client, roomId, userId) {
  const prize = Math.round(STAKE_STARS * 1.5);
  const houseFee = STAKE_STARS * 2 - prize;
  const award = await client.query(
    `INSERT INTO internal_star_awards (room_id, user_id, amount)
     VALUES ($1, $2, $3)
     ON CONFLICT (room_id) DO NOTHING
     RETURNING amount`,
    [roomId, userId, prize]
  );
  if (!award.rowCount) return 0;

  const ledger = await client.query(
    `INSERT INTO internal_star_ledger (operation_key, user_id, delta, reason, room_id)
     VALUES ($1, $2, $3, 'win', $4)
     ON CONFLICT (operation_key) DO NOTHING
     RETURNING delta`,
    [`win:${roomId}`, userId, award.rows[0].amount, roomId]
  );
  if (ledger.rowCount) {
    await client.query(
      `INSERT INTO internal_star_balances (user_id, balance)
       VALUES ($1, $2)
       ON CONFLICT (user_id) DO UPDATE
       SET balance = internal_star_balances.balance + EXCLUDED.balance`,
      [userId, ledger.rows[0].delta]
    );
  }

  if (houseFee > 0) {
    const feeLedger = await client.query(
      `INSERT INTO internal_star_ledger (operation_key, user_id, delta, reason, room_id)
       VALUES ($1, '__house__', $2, 'fee', $3)
       ON CONFLICT (operation_key) DO NOTHING
       RETURNING delta`,
      [`fee:${roomId}`, houseFee, roomId]
    );
    if (feeLedger.rowCount) {
      await client.query(
        `INSERT INTO internal_star_balances (user_id, balance)
         VALUES ('__house__', $1)
         ON CONFLICT (user_id) DO UPDATE
         SET balance = internal_star_balances.balance + EXCLUDED.balance`,
        [feeLedger.rows[0].delta]
      );
    }
  }
  return award.rows[0].amount;
}

app.get('/health', (_req, res) => res.json({ ok: true }));

app.post('/telegram/webhook', async (req, res) => {
  if (!TELEGRAM_BOT_TOKEN || !TELEGRAM_WEBHOOK_SECRET) {
    return res.status(503).json({ error: 'Telegram webhook is not configured' });
  }
  const receivedSecret = req.get('X-Telegram-Bot-Api-Secret-Token') || '';
  const expectedSecretBuffer = Buffer.from(TELEGRAM_WEBHOOK_SECRET);
  const receivedSecretBuffer = Buffer.from(receivedSecret);
  if (receivedSecretBuffer.length !== expectedSecretBuffer.length
    || !timingSafeEqual(receivedSecretBuffer, expectedSecretBuffer)) {
    return res.sendStatus(401);
  }

  const preCheckout = req.body?.pre_checkout_query;
  if (preCheckout) {
    try {
      const paymentResult = await pool.query(
        'SELECT amount, user_id, status FROM internal_star_payments WHERE payload = $1',
        [preCheckout.invoice_payload]
      );
      const payment = paymentResult.rows[0];
      const isValid = payment
        && payment.status === 'pending'
        && payment.user_id === String(preCheckout.from?.id)
        && payment.amount === preCheckout.total_amount
        && preCheckout.currency === 'XTR';
      await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/answerPreCheckoutQuery`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          pre_checkout_query_id: preCheckout.id,
          ok: Boolean(isValid),
          ...(!isValid ? { error_message: 'Счёт устарел. Создайте новый запрос на пополнение.' } : {}),
        }),
      });
      return res.sendStatus(200);
    } catch (error) {
      console.error('Telegram pre-checkout handling failed:', error);
      return res.sendStatus(500);
    }
  }

  const successfulPayment = req.body?.message?.successful_payment;
  if (!successfulPayment) return res.sendStatus(200);

  const userId = String(req.body.message.from?.id);
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const paymentResult = await client.query(
      'SELECT * FROM internal_star_payments WHERE payload = $1 FOR UPDATE',
      [successfulPayment.invoice_payload]
    );
    const payment = paymentResult.rows[0];
    if (!payment || payment.user_id !== userId || payment.amount !== successfulPayment.total_amount
      || successfulPayment.currency !== 'XTR') {
      await client.query('ROLLBACK');
      console.error('Received unmatched Telegram Stars payment');
      return res.sendStatus(200);
    }

    const ledger = await client.query(
      `INSERT INTO internal_star_ledger (operation_key, user_id, delta, reason, room_id)
       VALUES ($1, $2, $3, 'topup', $4)
       ON CONFLICT (operation_key) DO NOTHING
       RETURNING delta`,
      [`topup:${successfulPayment.telegram_payment_charge_id}`, userId, payment.amount, payment.room_id]
    );
    if (ledger.rowCount) {
      await client.query(
        `INSERT INTO internal_star_balances (user_id, balance)
         VALUES ($1, $2)
         ON CONFLICT (user_id) DO UPDATE
         SET balance = internal_star_balances.balance + EXCLUDED.balance`,
        [userId, ledger.rows[0].delta]
      );
    }
    await client.query(
      `UPDATE internal_star_payments
       SET status = 'paid', telegram_charge_id = $1, paid_at = CURRENT_TIMESTAMP
       WHERE payload = $2`,
      [successfulPayment.telegram_payment_charge_id, successfulPayment.invoice_payload]
    );
    await client.query('COMMIT');
    return res.sendStatus(200);
  } catch (error) {
    await client.query('ROLLBACK');
    console.error('Telegram successful payment handling failed:', error);
    return res.sendStatus(500);
  } finally {
    client.release();
  }
});

// API endpoint для получения партий пользователя
app.get('/api/games/:userId', async (req, res) => {
  try {
    const userId = req.params.userId;
    const client = await pool.connect();
    
    try {
      // Получаем все партии, где пользователь является игроком (белым или черным)
      const result = await client.query(`
        SELECT 
          id,
          players,
          COALESCE(player_names, '{}') as player_names,
          current_turn,
          last_id,
          created_at,
          COALESCE(status, 'active') as status,
          CASE 
            WHEN events @> '[{"type": "game_end", "payload": {"winner": "white"}}]' THEN 'white'
            WHEN events @> '[{"type": "game_end", "payload": {"winner": "black"}}]' THEN 'black'
            ELSE NULL
          END as winner
        FROM rooms 
        WHERE players->>'white' = $1 
           OR players->>'black' = $1
        ORDER BY id DESC
        LIMIT 50
      `, [userId]);
      
      const games = result.rows.map(row => ({
        id: row.id,
        players: row.players,
        player_names: row.player_names,
        current_turn: row.current_turn,
        last_id: row.last_id,
        created_at: row.created_at,
        status: row.status,
        winner: row.winner
      }));
      
      res.json({ games });
    } finally {
      client.release();
    }
  } catch (error) {
    console.error(`[GET /api/games/:userId] Error:`, error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/balance', async (req, res) => {
  const userId = String(req.body?.userId ?? '');
  if (!userId || !verifyTelegramUser(req.body?.initData, userId)) {
    return res.status(401).json({ error: 'Invalid Telegram identity' });
  }
  try {
    const result = await pool.query(
      'SELECT balance FROM internal_star_balances WHERE user_id = $1',
      [userId]
    );
    res.json({ balance: result.rows[0]?.balance ?? 0 });
  } catch (error) {
    console.error('[GET /api/balance/:userId] Error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.post('/api/matches/:roomId/start', async (req, res) => {
  const roomId = req.params.roomId;
  const userId = String(req.body?.userId ?? '');
  if (!userId || !verifyTelegramUser(req.body?.initData, userId)) {
    return res.status(401).json({ error: 'Invalid Telegram identity' });
  }
  if (!Number.isSafeInteger(STAKE_STARS) || STAKE_STARS < 1
    || !Number.isSafeInteger(MATCH_TIME_MS) || MATCH_TIME_MS < 1) {
    return res.status(500).json({ error: 'Invalid match configuration' });
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const roomResult = await client.query(
      'SELECT players, started_at, status, events, last_id FROM rooms WHERE id = $1 FOR UPDATE',
      [roomId]
    );
    const room = roomResult.rows[0];
    const players = ensureParsedJsonb(room?.players, {});
    if (!room || !Object.values(players).includes(userId) || !players.white || !players.black) {
      await client.query('ROLLBACK');
      return res.status(403).json({ error: 'Both players must join this room' });
    }
    if (room.status === 'finished') {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Match is finished' });
    }
    if (room.started_at) {
      await client.query('COMMIT');
      return res.json({ started: true, alreadyStarted: true });
    }

    const userIds = [players.white, players.black];
    const balancesResult = await client.query(
      'SELECT user_id, balance FROM internal_star_balances WHERE user_id = ANY($1) FOR UPDATE',
      [userIds]
    );
    const balances = new Map(balancesResult.rows.map((row) => [row.user_id, row.balance]));
    const shortPlayer = userIds.find((playerId) => (balances.get(playerId) ?? 0) < STAKE_STARS);
    if (shortPlayer) {
      await client.query('ROLLBACK');
      return res.status(409).json({ error: 'Both players must have enough internal Stars', missingUserId: shortPlayer });
    }

    for (const playerId of userIds) {
      const operationKey = `stake:${roomId}:${playerId}`;
      const ledgerResult = await client.query(
        `INSERT INTO internal_star_ledger (operation_key, user_id, delta, reason, room_id)
         VALUES ($1, $2, $3, 'stake', $4)
         ON CONFLICT (operation_key) DO NOTHING
         RETURNING delta`,
        [operationKey, playerId, -STAKE_STARS, roomId]
      );
      if (ledgerResult.rowCount) {
        await client.query(
          'UPDATE internal_star_balances SET balance = balance - $1 WHERE user_id = $2',
          [STAKE_STARS, playerId]
        );
      }
    }

    const events = ensureParsedJsonb(room.events, []);
    const startEvent = {
      type: 'match_started',
      roomId,
      senderId: userId,
      payload: { whiteTimeMs: MATCH_TIME_MS, blackTimeMs: MATCH_TIME_MS, currentTurn: 'white' },
    };
    const eventId = appendRoomEvent(events, room, startEvent);

    await client.query(
      `UPDATE rooms
       SET started_at = CURRENT_TIMESTAMP,
           current_turn = 'white',
           turn_started_at = CURRENT_TIMESTAMP,
           white_time_ms = $1,
           black_time_ms = $1,
           events = $2,
           last_id = $3,
           position_fen = $4,
           status = 'active'
           WHERE id = $5`,
      [MATCH_TIME_MS, JSON.stringify(events), room.last_id, new Chess().fen(), roomId]
    );
    const updatedBalances = await client.query(
      'SELECT user_id, balance FROM internal_star_balances WHERE user_id = ANY($1)',
      [userIds]
    );
    await client.query('COMMIT');
    return res.status(201).json({
      started: true,
      eventId,
      stake: STAKE_STARS,
      matchTimeMs: MATCH_TIME_MS,
      balances: Object.fromEntries(updatedBalances.rows.map((row) => [row.user_id, row.balance])),
    });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[POST /api/matches/${roomId}/start] Error:`, error);
    return res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    client.release();
  }
});

app.post('/api/payments/stars/invoice', async (req, res) => {
  if (!TELEGRAM_BOT_TOKEN) {
    return res.status(503).json({ error: 'Telegram Stars payments are not configured' });
  }

  const roomId = req.body?.roomId;
  const userId = String(req.body?.userId ?? '');
  if (typeof roomId !== 'string' || !roomId.trim() || roomId.length > 255) {
    return res.status(400).json({ error: 'Invalid roomId' });
  }
  if (!userId || userId.length > 255) {
    return res.status(400).json({ error: 'Invalid userId' });
  }
  if (!verifyTelegramUser(req.body?.initData, userId)) return res.status(401).json({ error: 'Invalid Telegram identity' });
  if (!Number.isSafeInteger(STAKE_STARS) || STAKE_STARS < 1) {
    return res.status(500).json({ error: 'Invalid stake configuration' });
  }

  try {
    const roomResult = await pool.query('SELECT players, status FROM rooms WHERE id = $1', [roomId]);
    const players = roomResult.rows[0]?.players;
    if (!roomResult.rows[0] || !Object.values(players || {}).includes(userId)) {
      return res.status(403).json({ error: 'User must be a player in this room' });
    }
    if (!players?.white || !players?.black) {
      return res.status(409).json({ error: 'Both players must join before creating an invoice' });
    }
    if (roomResult.rows[0].status !== 'active') {
      return res.status(409).json({ error: 'Match is not accepting payments' });
    }

    const balanceResult = await pool.query(
      'SELECT balance FROM internal_star_balances WHERE user_id = $1',
      [userId]
    );
    const balance = balanceResult.rows[0]?.balance ?? 0;
    if (balance >= STAKE_STARS) return res.json({ funded: true, balance });

    const payload = `chess_topup:${randomUUID()}`;

    const telegramResponse = await fetch(`https://api.telegram.org/bot${TELEGRAM_BOT_TOKEN}/createInvoiceLink`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        title: 'Внутренний игровой баланс',
        description: `${STAKE_STARS} внутренних звёзд для шахматного матча`,
        payload,
        provider_token: '',
        currency: 'XTR',
        prices: [{ label: 'Ставка', amount: STAKE_STARS }],
      }),
    });
    const result = await telegramResponse.json();
    if (!telegramResponse.ok || !result.ok || typeof result.result !== 'string') {
      console.error('Telegram invoice creation failed:', result.description || telegramResponse.status);
      return res.status(502).json({ error: 'Could not create Telegram Stars invoice' });
    }

    await pool.query(
      `INSERT INTO internal_star_payments (payload, room_id, user_id, amount, invoice_url)
       VALUES ($1, $2, $3, $4, $5)`,
      [payload, roomId, userId, STAKE_STARS, result.result]
    );
    return res.json({ invoiceUrl: result.result, payload, amount: STAKE_STARS });
  } catch (error) {
    console.error('Telegram invoice creation failed:', error);
    return res.status(500).json({ error: 'Could not create Telegram Stars invoice' });
  }
});

app.post('/api/payments/stars/confirm', async (req, res) => {
  if (!TELEGRAM_BOT_TOKEN) {
    return res.status(503).json({ error: 'Telegram Stars payments are not configured' });
  }
  const payload = req.body?.payload;
  const userId = String(req.body?.userId ?? '');
  if (typeof payload !== 'string' || !payload.startsWith('chess_topup:')) {
    return res.status(400).json({ error: 'Invalid payment payload' });
  }
  if (!userId || !verifyTelegramUser(req.body?.initData, userId)) {
    return res.status(401).json({ error: 'Invalid Telegram identity' });
  }
  try {
    const paymentResult = await pool.query(
      'SELECT status, user_id FROM internal_star_payments WHERE payload = $1',
      [payload]
    );
    const payment = paymentResult.rows[0];
    if (!payment || payment.user_id !== userId) {
      return res.status(404).json({ error: 'Payment not found' });
    }
    const balanceResult = await pool.query(
      'SELECT balance FROM internal_star_balances WHERE user_id = $1',
      [userId]
    );
    const confirmed = payment.status === 'paid';
    return res.status(confirmed ? 200 : 202).json({
      confirmed,
      balance: balanceResult.rows[0]?.balance ?? 0,
    });
  } catch (error) {
    console.error('Telegram Stars payment confirmation failed:', error);
    return res.status(500).json({ error: 'Could not confirm payment' });
  }
});

app.post('/api/payments/stars/status', async (req, res) => {
  const payload = req.body?.payload;
  const userId = String(req.body?.userId ?? '');
  if (typeof payload !== 'string' || !userId || !verifyTelegramUser(req.body?.initData, userId)) {
    return res.status(401).json({ error: 'Invalid payment identity' });
  }
  try {
    const paymentResult = await pool.query(
      'SELECT status, user_id FROM internal_star_payments WHERE payload = $1',
      [payload]
    );
    const payment = paymentResult.rows[0];
    if (!payment || payment.user_id !== userId) return res.status(404).json({ error: 'Payment not found' });
    const balanceResult = await pool.query(
      'SELECT balance FROM internal_star_balances WHERE user_id = $1',
      [userId]
    );
    return res.json({
      confirmed: payment.status === 'paid',
      balance: balanceResult.rows[0]?.balance ?? 0,
    });
  } catch (error) {
    console.error('Payment status lookup failed:', error);
    return res.status(500).json({ error: 'Could not check payment status' });
  }
});

app.post('/rooms/:roomId/events', async (req, res) => {
  try {
    const roomId = req.params.roomId;
    const room = await ensureRoom(roomId);
    const message = { ...req.body };

    if (!message || typeof message !== 'object') {
      return res.status(400).json({ error: 'Invalid message' });
    }

    const { type, senderId } = message;
    if (!type || !senderId) {
      return res.status(400).json({ error: 'Missing type or senderId' });
    }
    if (!verifyTelegramUser(message.initData, String(senderId))) {
      return res.status(401).json({ error: 'Invalid Telegram identity' });
    }
    delete message.initData;

    // Presence handling: allow client to announce desired color and presence
    if (type === 'presence') {
      const desired = message.payload?.desiredColor;
      const playerName = message.payload?.displayName;
      if (desired !== 'white' && desired !== 'black') {
        return res.status(400).json({ error: 'Invalid player color' });
      }
      // console.log(`[presence] room=${roomId} sender=${senderId} desired=${desired} !!!playerName=${playerName}`);
      if (message.payload?.joined) {
        const otherColor = desired === 'white' ? 'black' : 'white';
        if ((room.players[desired] && room.players[desired] !== senderId)
          || room.players[otherColor] === senderId) {
          return res.status(409).json({ error: 'Player color is already assigned' });
        }
        if (desired === 'white') {
          room.players.white = senderId;
          if (playerName) {
            room.player_names = room.player_names || {};
            room.player_names.white = playerName;
          }
        } else if (desired === 'black') {
          room.players.black = senderId;
          if (playerName) {
            room.player_names = room.player_names || {};
            room.player_names.black = playerName;
          }
        }
      }
    
      // Обновляем базу данных с новыми данными игроков
      await pool.query(
        'UPDATE rooms SET players = $1, player_names = $2 WHERE id = $3',
        [JSON.stringify(room.players), JSON.stringify(room.player_names || {}), roomId]
      );
    
      const id = await addEvent(room, message);
      console.log(
        `[presence] room=${roomId} id=${id} sender=${senderId} desired=${desired} players=`,
        room.players,
        'names=',
        room.player_names
      );
    
      return res.status(201).json({ id });
    }
    

    if (type === 'move') {
      const client = await pool.connect();
      try {
        await client.query('BEGIN');
        const result = await client.query('SELECT * FROM rooms WHERE id = $1 FOR UPDATE', [roomId]);
        const row = result.rows[0];
        if (!row || !row.started_at || row.status !== 'active') {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Match has not started or is finished' });
        }

        const players = ensureParsedJsonb(row.players, {});
        const currentTurn = row.current_turn;
        if (players[currentTurn] !== senderId) {
          await client.query('ROLLBACK');
          return res.status(409).json({ error: 'Not your turn' });
        }

        const events = ensureParsedJsonb(row.events, []);
        const elapsed = Math.max(0, Date.now() - new Date(row.turn_started_at).getTime());
        const clockColumn = currentTurn === 'white' ? 'white_time_ms' : 'black_time_ms';
        const remaining = Math.max(0, row[clockColumn] - elapsed);
        if (remaining === 0) {
          const winner = currentTurn === 'white' ? 'black' : 'white';
          const winnerId = players[winner];
          const endMessage = {
            type: 'game_end', roomId, senderId: winnerId,
            payload: { winner, reason: 'timeout', prize: Math.round(STAKE_STARS * 1.5) },
          };
          const eventId = appendRoomEvent(events, row, endMessage);
          await awardInternalStars(client, roomId, winnerId);
          await client.query(
            `UPDATE rooms SET events = $1, last_id = $2, status = 'finished', ${clockColumn} = 0 WHERE id = $3`,
            [JSON.stringify(events), row.last_id, roomId]
          );
          await client.query('COMMIT');
          return res.json({ id: eventId, timeout: true, winner });
        }

        const game = new Chess(row.position_fen || undefined);
        if ((game.turn() === 'w' ? 'white' : 'black') !== currentTurn) {
          throw new Error('Stored chess position does not match room turn');
        }
        const { fromRow, fromCol, toRow, toCol, promotion } = message.payload || {};
        const isValidSquare = (rowIndex, columnIndex) => Number.isInteger(rowIndex)
          && Number.isInteger(columnIndex) && rowIndex >= 0 && rowIndex < 8 && columnIndex >= 0 && columnIndex < 8;
        if (!isValidSquare(fromRow, fromCol) || !isValidSquare(toRow, toCol)) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Invalid move coordinates' });
        }

        let move;
        try {
          const promotionCode = { queen: 'q', rook: 'r', bishop: 'b', knight: 'n' }[promotion];
          move = game.move({
            from: `${String.fromCharCode(97 + fromCol)}${8 - fromRow}`,
            to: `${String.fromCharCode(97 + toCol)}${8 - toRow}`,
            ...(promotionCode ? { promotion: promotionCode } : {}),
          });
        } catch (_error) {
          await client.query('ROLLBACK');
          return res.status(400).json({ error: 'Illegal move' });
        }

        const moveMessage = { ...message, payload: { ...message.payload, san: move.san } };
        const eventId = appendRoomEvent(events, row, moveMessage);
        const nextTurn = currentTurn === 'white' ? 'black' : 'white';
        const nextClockColumn = nextTurn === 'white' ? 'white_time_ms' : 'black_time_ms';
        const updates = {
          white_time_ms: currentTurn === 'white' ? remaining : row.white_time_ms,
          black_time_ms: currentTurn === 'black' ? remaining : row.black_time_ms,
        };
        let winner = null;
        if (game.isCheckmate()) {
          winner = currentTurn;
          const winnerId = players[winner];
          const endMessage = {
            type: 'game_end', roomId, senderId: winnerId,
            payload: { winner, reason: 'checkmate', prize: Math.round(STAKE_STARS * 1.5) },
          };
          appendRoomEvent(events, row, endMessage);
          await awardInternalStars(client, roomId, winnerId);
        }

        await client.query(
          `UPDATE rooms SET events = $1, last_id = $2, current_turn = $3, position_fen = $4,
             white_time_ms = $5, black_time_ms = $6, turn_started_at = CURRENT_TIMESTAMP,
             status = $7 WHERE id = $8`,
          [JSON.stringify(events), row.last_id, nextTurn, game.fen(), updates.white_time_ms,
            updates.black_time_ms, winner ? 'finished' : 'active', roomId]
        );
        await client.query('COMMIT');
        return res.status(201).json({ id: eventId, fen: game.fen(), currentTurn: nextTurn, winner });
      } catch (error) {
        await client.query('ROLLBACK');
        console.error(`[move] room=${roomId} error:`, error);
        return res.status(500).json({ error: 'Internal Server Error' });
      } finally {
        client.release();
      }
    }

    if (type === 'game_end') {
      return res.status(400).json({ error: 'Match results are determined by the server' });
    }

    // Unknown types still recorded
    const id = await addEvent(room, message);
    // console.log(`[event] room=${roomId} id=${id} type=${type}`);
    return res.status(201).json({ id });
  } catch (error) {
    console.error(`[POST /rooms/:roomId/events] Error handling request for room ${req.params.roomId}:`, error);
    return res.status(500).json({ error: 'Internal Server Error' });
  }
});

app.get('/rooms/:roomId/events', async (req, res) => {
  const roomId = req.params.roomId;
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const afterId = (req.query.after || '').toString();
    await ensureRoom(roomId);
    const result = await client.query('SELECT * FROM rooms WHERE id = $1 FOR UPDATE', [roomId]);
    const row = result.rows[0];
    const events = ensureParsedJsonb(row.events, []);
    if (row.status === 'active' && row.started_at && row.turn_started_at) {
      const currentTurn = row.current_turn;
      const clockColumn = currentTurn === 'white' ? 'white_time_ms' : 'black_time_ms';
      const elapsed = Math.max(0, Date.now() - new Date(row.turn_started_at).getTime());
      const remaining = Math.max(0, row[clockColumn] - elapsed);
      if (remaining === 0) {
        const winner = currentTurn === 'white' ? 'black' : 'white';
        const players = ensureParsedJsonb(row.players, {});
        const winnerId = players[winner];
        const message = {
          type: 'game_end', roomId, senderId: winnerId,
          payload: { winner, reason: 'timeout', prize: Math.round(STAKE_STARS * 1.5) },
        };
        appendRoomEvent(events, row, message);
        await awardInternalStars(client, roomId, winnerId);
        await client.query(
          `UPDATE rooms SET events = $1, last_id = $2, status = 'finished', ${clockColumn} = 0 WHERE id = $3`,
          [JSON.stringify(events), row.last_id, roomId]
        );
        row[clockColumn] = 0;
        row.status = 'finished';
      }
    }

    let responseEvents = events;
    if (!afterId) {
      responseEvents = events;
    } else {
      const idx = events.findIndex((event) => event.id === afterId);
      responseEvents = idx === -1 ? events : events.slice(idx + 1);
    }

    const clock = {
      started: Boolean(row.started_at),
      status: row.status,
      currentTurn: row.current_turn,
      whiteTimeMs: row.white_time_ms,
      blackTimeMs: row.black_time_ms,
      turnStartedAt: row.turn_started_at,
      serverTime: Date.now(),
      stake: STAKE_STARS,
      prize: Math.round(STAKE_STARS * 1.5),
    };
    await client.query('COMMIT');
    return res.json({ events: responseEvents, clock });
  } catch (error) {
    await client.query('ROLLBACK');
    console.error(`[GET /rooms/:roomId/events] Error handling request for room ${req.params.roomId}:`, error);
    return res.status(500).json({ error: 'Internal Server Error' });
  } finally {
    client.release();
  }
});

initDb().then(() => {
  app.listen(PORT, '0.0.0.0', () => {
    void configureTelegramWebhook();
    // console.log(`Chess events server listening on http://localhost:${PORT}`);
  });
}).catch(err => {
  console.error('Failed to initialize database:', err);
  process.exit(1);
});


