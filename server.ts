import { GoogleGenAI, Type } from '@google/genai';
import dotenv from 'dotenv';
import express from 'express';
import fs from 'fs';
import http from 'http';
import JSZip from 'jszip';
import path from 'path';
import { fileURLToPath } from 'url';
import { createServer as createViteServer } from 'vite';
import { WebSocket, WebSocketServer } from 'ws';

dotenv.config();

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const PORT = 3000;
const DATA_DIR = path.resolve(__dirname, 'data');
const STORE_PATH = path.join(DATA_DIR, 'workspace-store.json');

interface SchoolSettingsData {
  pemerintah?: string;
  dinas?: string;
  namaSekolah: string;
  alamat?: string;
  logoDataUrl?: string;
  kepalaSekolah: string;
  nipKepalaSekolah: string;
  teacherNips: Record<string, string>;
}

interface StoreData {
  rosters: Record<string, Record<string, string[]>>;
  items: Record<string, unknown[]>;
  publicGames: Record<string, unknown>;
  gameScores: Record<string, unknown[]>;
  settings?: SchoolSettingsData;
}

const DEFAULT_SCHOOL_SETTINGS: SchoolSettingsData = {
  pemerintah: 'PEMERINTAH KABUPATEN LOMBOK TENGAH',
  dinas: 'DINAS PENDIDIKAN DAN KEBUDAYAAN',
  namaSekolah: 'SD NEGERI LENDANG TELAGA',
  alamat: 'Lendang Telaga, Kecamatan Kopang, Kabupaten Lombok Tengah, NTB',
  logoDataUrl: '',
  kepalaSekolah: '',
  nipKepalaSekolah: '',
  teacherNips: {},
};

function readStore(): StoreData {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    if (!fs.existsSync(STORE_PATH)) {
      const init: StoreData = {
        rosters: {},
        items: {},
        publicGames: {},
        gameScores: {},
        settings: { ...DEFAULT_SCHOOL_SETTINGS, teacherNips: {} },
      };
      fs.writeFileSync(STORE_PATH, JSON.stringify(init, null, 2), 'utf-8');
      return init;
    }
    const raw = fs.readFileSync(STORE_PATH, 'utf-8');
    const parsed = JSON.parse(raw) as Partial<StoreData>;
    return {
      rosters: parsed.rosters ?? {},
      items: parsed.items ?? {},
      publicGames: parsed.publicGames ?? {},
      gameScores: parsed.gameScores ?? {},
      settings: parsed.settings
        ? {
            pemerintah: parsed.settings.pemerintah || DEFAULT_SCHOOL_SETTINGS.pemerintah,
            dinas: parsed.settings.dinas || DEFAULT_SCHOOL_SETTINGS.dinas,
            namaSekolah: parsed.settings.namaSekolah || DEFAULT_SCHOOL_SETTINGS.namaSekolah,
            alamat: parsed.settings.alamat || DEFAULT_SCHOOL_SETTINGS.alamat,
            logoDataUrl: parsed.settings.logoDataUrl || '',
            kepalaSekolah: parsed.settings.kepalaSekolah || '',
            nipKepalaSekolah: parsed.settings.nipKepalaSekolah || '',
            teacherNips: parsed.settings.teacherNips ?? {},
          }
        : { ...DEFAULT_SCHOOL_SETTINGS, teacherNips: {} },
    };
  } catch (err) {
    console.error('Failed reading store:', err);
    return {
      rosters: {},
      items: {},
      publicGames: {},
      gameScores: {},
      settings: { ...DEFAULT_SCHOOL_SETTINGS, teacherNips: {} },
    };
  }
}

function writeStore(data: StoreData): void {
  try {
    if (!fs.existsSync(DATA_DIR)) {
      fs.mkdirSync(DATA_DIR, { recursive: true });
    }
    fs.writeFileSync(STORE_PATH, JSON.stringify(data, null, 2), 'utf-8');
  } catch (err) {
    console.error('Failed writing store:', err);
  }
}

function safeParseGeminiJson<T>(raw: string | undefined, fallback: T): T {
  if (!raw || typeof raw !== 'string') return fallback;
  const cleaned = raw
    .trim()
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim();
  if (!cleaned) return fallback;
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    // Try extracting the outermost JSON object or array if stray prose exists
    const firstObj = cleaned.indexOf('{');
    const firstArr = cleaned.indexOf('[');
    let start = -1;
    let end = -1;
    if (firstArr !== -1 && (firstObj === -1 || firstArr < firstObj)) {
      start = firstArr;
      end = cleaned.lastIndexOf(']');
    } else if (firstObj !== -1) {
      start = firstObj;
      end = cleaned.lastIndexOf('}');
    }
    if (start !== -1 && end > start) {
      try {
        return JSON.parse(cleaned.slice(start, end + 1)) as T;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}

function getGenAIClient(): GoogleGenAI {
  const apiKey = process.env.GEMINI_API_KEY;
  if (!apiKey) {
    throw new Error('GEMINI_API_KEY belum dikonfigurasi pada server (cek Settings > Secrets).');
  }
  return new GoogleGenAI({
    apiKey,
    httpOptions: {
      headers: {
        'User-Agent': 'aistudio-build',
      },
    },
  });
}

function getErrStatusCode(err: unknown): number {
  if (err && typeof err === 'object') {
    const rec = err as { status?: unknown; code?: unknown; message?: unknown };
    if (typeof rec.status === 'number') return rec.status;
    if (typeof rec.code === 'number') return rec.code;
  }
  const msg = err instanceof Error ? err.message : String(err || '');
  if (msg.includes('RESOURCE_EXHAUSTED') || msg.includes('"code":429')) return 429;
  if (msg.includes('UNAVAILABLE') || msg.includes('"code":503')) return 503;
  if (msg.includes('DEADLINE_EXCEEDED') || msg.includes('"code":504')) return 504;
  if (msg.includes('API_KEY_INVALID') || msg.includes('"code":400')) return 400;
  if (msg.includes('PERMISSION_DENIED') || msg.includes('"code":403')) return 403;
  if (msg.includes('NOT_FOUND') || msg.includes('"code":404')) return 404;
  return 500;
}

function formatRetryDelayId(rawMessage: string): string | null {
  const secMatch = rawMessage.match(/"retryDelay"\s*:\s*"(\d+)s"/i);
  if (secMatch) {
    const totalSec = Number(secMatch[1]);
    if (totalSec > 0) {
      const hours = Math.floor(totalSec / 3600);
      const mins = Math.ceil((totalSec % 3600) / 60);
      if (hours > 0) return `${hours} jam ${mins} menit`;
      if (mins > 1) return `${mins} menit`;
      return `${totalSec} detik`;
    }
  }
  const hmsMatch = rawMessage.match(/Please retry in\s+(?:(\d+)h)?(?:(\d+)m)?([\d.]+)s/i);
  if (hmsMatch) {
    const h = Number(hmsMatch[1] || 0);
    const m = Number(hmsMatch[2] || 0);
    const s = Math.ceil(Number(hmsMatch[3] || 0));
    if (h > 0) return `${h} jam ${m} menit`;
    if (m > 0) return `${m} menit`;
    if (s > 0) return `${s} detik`;
  }
  return null;
}

const GEMINI_TEXT_MODELS = ['gemini-4-hydrogen', 'gemini-3.1-flash-lite'] as const;

async function generateContentWithQuotaFallback(
  ai: GoogleGenAI,
  contents: string,
  config: Record<string, unknown>
) {
  let lastError: unknown;
  for (let i = 0; i < GEMINI_TEXT_MODELS.length; i++) {
    const model = GEMINI_TEXT_MODELS[i];
    try {
      return await ai.models.generateContent({
        model,
        contents,
        config,
      });
    } catch (err) {
      lastError = err;
      const status = getErrStatusCode(err);
      const hasNext = i < GEMINI_TEXT_MODELS.length - 1;
      if ((status === 429 || status === 404 || status === 503) && hasNext) {
        console.warn(`[AI Fallback] Model ${model} returned ${status}; trying ${GEMINI_TEXT_MODELS[i + 1]}.`);
        continue;
      }
      throw err;
    }
  }
  throw lastError;
}

function sendGeminiRouteError(
  res: express.Response,
  routeLabel: string,
  err: unknown,
  fallbackMessage: string
) {
  const rawMessage = err instanceof Error ? err.message : String(err || fallbackMessage);
  const status = getErrStatusCode(err);

  if (status === 429) {
    const waitText = formatRetryDelayId(rawMessage);
    console.warn(`[${routeLabel}] Gemini quota exhausted (429).${waitText ? ` Retry in ~${waitText}.` : ''}`);
    res.status(429).json({
      error: `Kuota harian AI gratis sedang penuh (429 RESOURCE_EXHAUSTED). ${
        waitText
          ? `Silakan coba lagi sekitar ${waitText}, `
          : 'Silakan coba lagi beberapa saat atau setelah reset harian, '
      }gunakan API key berbayar di Settings > Secrets, atau isi/sunting tabel secara manual.`,
    });
    return;
  }

  if (status === 503 || status === 504) {
    console.warn(`[${routeLabel}] Gemini upstream busy/unavailable (${status}).`);
    res.status(status).json({
      error:
        'Server AI Gemini sedang mengalami lonjakan permintaan atau kuota gratis sementara penuh. Silakan coba lagi beberapa saat, pilih API key berbayar di Settings > Secrets, atau lanjutkan menyusun data secara manual.',
    });
    return;
  }

  if (status === 400 || status === 403 || rawMessage.includes('GEMINI_API_KEY')) {
    console.warn(`[${routeLabel}] Gemini API key/permission issue (${status}).`);
    res.status(status).json({
      error:
        'Kunci API Gemini belum aktif atau tidak valid. Periksa dan pilih API key di panel Settings > Secrets pada Google AI Studio.',
    });
    return;
  }

  if (status === 404) {
    console.warn(`[${routeLabel}] Gemini model not found (404).`);
    res.status(404).json({
      error: 'Model Gemini yang diminta tidak tersedia saat ini. Silakan coba lagi nanti.',
    });
    return;
  }

  console.error(`Error ${routeLabel}:`, rawMessage);
  res.status(500).json({
    error: rawMessage.startsWith('{') ? fallbackMessage : rawMessage || fallbackMessage,
  });
}

// Authoritative WebSocket Room State
interface LivePlayerState {
  playerId: string;
  name: string;
  score: number;
  correctCount: number;
  answeredCount: number;
  totalQuestions: number;
  progress: number;
  streak: number;
  turboActive: boolean;
  finished: boolean;
  finishTimeMs: number | null;
  connected: boolean;
  lastAction?: string;
}

interface LiveRoomEvent {
  id: string;
  time: string;
  message: string;
}

interface LiveRoom {
  roomCode: string;
  gameId: string;
  gameTitle: string;
  template: string;
  status: 'waiting' | 'playing' | 'finished';
  resetVersion: number;
  players: Map<string, LivePlayerState>;
  events: LiveRoomEvent[];
  clients: Set<WebSocket>;
  updatedAt: number;
}

const rooms = new Map<string, LiveRoom>();

function pushRoomEvent(room: LiveRoom, message: string) {
  const time = new Date().toLocaleTimeString('id-ID', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });
  room.events.unshift({
    id: `ev_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    time,
    message,
  });
  if (room.events.length > 25) {
    room.events = room.events.slice(0, 25);
  }
}

function serializeRoom(room: LiveRoom) {
  return {
    roomCode: room.roomCode,
    gameId: room.gameId,
    gameTitle: room.gameTitle,
    template: room.template,
    status: room.status,
    resetVersion: room.resetVersion,
    players: Array.from(room.players.values()).sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      return b.progress - a.progress;
    }),
    events: room.events,
    updatedAt: room.updatedAt,
  };
}

function broadcastRoom(room: LiveRoom) {
  const payload = JSON.stringify({ type: 'room:state', room: serializeRoom(room) });
  for (const client of room.clients) {
    if (client.readyState === WebSocket.OPEN) {
      client.send(payload);
    }
  }
}

interface RoomEventInput {
  type: string;
  roomCode?: string;
  gameId?: string;
  gameTitle?: string;
  template?: string;
  playerId?: string;
  name?: string;
  score?: number;
  correctCount?: number;
  answeredCount?: number;
  totalQuestions?: number;
  progress?: number;
  streak?: number;
  turboActive?: boolean;
  finished?: boolean;
  finishTimeMs?: number | null;
}

function processRoomEvent(
  msg: RoomEventInput,
  wsClient?: WebSocket
): { ok: boolean; room?: ReturnType<typeof serializeRoom>; error?: string; joinedRoomCode?: string; joinedPlayerId?: string } {
  const code = (msg.roomCode || '').trim().toUpperCase();
  if (!code) return { ok: false, error: 'Kode room kosong.' };

  if (msg.type === 'host:create') {
    let room = rooms.get(code);
    if (!room) {
      room = {
        roomCode: code,
        gameId: msg.gameId || 'game',
        gameTitle: msg.gameTitle || 'Game Edukasi',
        template: msg.template || 'running-race',
        status: 'waiting',
        resetVersion: 0,
        players: new Map(),
        events: [],
        clients: new Set(),
        updatedAt: Date.now(),
      };
      pushRoomEvent(room, `Room ${code} dibuka oleh guru.`);
      rooms.set(code, room);
    } else {
      room.gameId = msg.gameId || room.gameId;
      room.gameTitle = msg.gameTitle || room.gameTitle;
      room.template = msg.template || room.template;
    }
    if (wsClient) room.clients.add(wsClient);
    broadcastRoom(room);
    return { ok: true, room: serializeRoom(room), joinedRoomCode: code };
  }

  let room = rooms.get(code);
  if (!room && msg.type === 'player:join') {
    room = {
      roomCode: code,
      gameId: msg.gameId || 'game',
      gameTitle: msg.gameTitle || 'Game Edukasi',
      template: msg.template || 'running-race',
      status: 'waiting',
      resetVersion: 0,
      players: new Map(),
      events: [],
      clients: new Set(),
      updatedAt: Date.now(),
    };
    pushRoomEvent(room, `Room ${code} dibuka otomatis saat siswa pertama masuk.`);
    rooms.set(code, room);
  }
  if (!room) {
    return { ok: false, error: 'Kode room tidak ditemukan atau belum dibuka guru.' };
  }

  if (msg.type === 'host:start') {
    room.status = 'playing';
    pushRoomEvent(room, 'Guru memulai permainan.');
    room.updatedAt = Date.now();
    broadcastRoom(room);
    return { ok: true, room: serializeRoom(room) };
  }

  if (msg.type === 'host:reset') {
    room.status = 'waiting';
    room.resetVersion = (room.resetVersion || 0) + 1;
    for (const p of room.players.values()) {
      p.score = 0;
      p.correctCount = 0;
      p.answeredCount = 0;
      p.progress = 0;
      p.streak = 0;
      p.turboActive = false;
      p.finished = false;
      p.finishTimeMs = null;
      p.lastAction = 'Menunggu mulai ulang';
    }
    pushRoomEvent(room, 'Skor room direset oleh guru.');
    room.updatedAt = Date.now();
    broadcastRoom(room);
    return { ok: true, room: serializeRoom(room) };
  }

  if (msg.type === 'player:join') {
    const pId = (msg.playerId || `p_${Date.now()}`).slice(0, 64);
    const pName = (msg.name || 'Siswa').trim().slice(0, 60);
    if (wsClient) room.clients.add(wsClient);

    const existing = room.players.get(pId);
    if (existing) {
      existing.connected = true;
      existing.name = pName;
      existing.lastAction = 'Terhubung kembali';
    } else {
      room.players.set(pId, {
        playerId: pId,
        name: pName,
        score: 0,
        correctCount: 0,
        answeredCount: 0,
        totalQuestions: msg.totalQuestions || 5,
        progress: 0,
        streak: 0,
        turboActive: false,
        finished: false,
        finishTimeMs: null,
        connected: true,
        lastAction: 'Bergabung ke room',
      });
      pushRoomEvent(room, `${pName} bergabung ke game.`);
    }
    room.updatedAt = Date.now();
    broadcastRoom(room);
    return { ok: true, room: serializeRoom(room), joinedRoomCode: code, joinedPlayerId: pId };
  }

  if (msg.type === 'player:progress') {
    const pId = msg.playerId;
    if (!pId) return { ok: false, error: 'playerId kosong.' };
    let player = room.players.get(pId);
    if (!player) {
      player = {
        playerId: pId,
        name: (msg.name || 'Siswa').trim().slice(0, 60),
        score: 0,
        correctCount: 0,
        answeredCount: 0,
        totalQuestions: msg.totalQuestions || 5,
        progress: 0,
        streak: 0,
        turboActive: false,
        finished: false,
        finishTimeMs: null,
        connected: true,
        lastAction: 'Bergabung',
      };
      room.players.set(pId, player);
    }

    if (typeof msg.score === 'number') player.score = msg.score;
    if (typeof msg.correctCount === 'number') player.correctCount = msg.correctCount;
    if (typeof msg.answeredCount === 'number') player.answeredCount = msg.answeredCount;
    if (typeof msg.totalQuestions === 'number') player.totalQuestions = msg.totalQuestions;
    if (typeof msg.progress === 'number') player.progress = Math.min(100, Math.max(0, msg.progress));
    if (typeof msg.streak === 'number') player.streak = msg.streak;
    if (typeof msg.turboActive === 'boolean') player.turboActive = msg.turboActive;
    if (typeof msg.finished === 'boolean') player.finished = msg.finished;
    if (msg.finishTimeMs !== undefined) player.finishTimeMs = msg.finishTimeMs;

    const statusDesc = player.finished
      ? `Selesai (${player.score} poin)`
      : `Soal ${player.answeredCount}/${player.totalQuestions} · Benar ${player.correctCount}${player.turboActive ? ' · Pacu Cepat' : ''}`;
    player.lastAction = statusDesc;
    pushRoomEvent(room, `${player.name}: ${statusDesc}`);

    if (room.status === 'waiting') {
      room.status = 'playing';
    }
    room.updatedAt = Date.now();
    broadcastRoom(room);
    return { ok: true, room: serializeRoom(room) };
  }

  return { ok: false, error: 'Tipe event room tidak dikenal.' };
}

async function startServer() {
  const app = express();
  app.use(express.json({ limit: '5mb' }));

  const server = http.createServer(app);
  const wss = new WebSocketServer({ noServer: true });
  server.on('upgrade', (request, socket, head) => {
    try {
      const reqUrl = new URL(request.url || '/', 'http://localhost');
      if (reqUrl.pathname === '/ws') {
        wss.handleUpgrade(request, socket, head, (ws) => {
          wss.emit('connection', ws, request);
        });
      }
    } catch {
      socket.destroy();
    }
  });

  wss.on('connection', (ws) => {
    let joinedRoomCode: string | null = null;
    let joinedPlayerId: string | null = null;

    ws.on('message', (raw) => {
      try {
        const msg = JSON.parse(raw.toString()) as RoomEventInput;
        if (msg.type === 'player:progress' && !msg.playerId && joinedPlayerId) {
          msg.playerId = joinedPlayerId;
        }
        const result = processRoomEvent(msg, ws);
        if (result.joinedRoomCode) joinedRoomCode = result.joinedRoomCode;
        if (result.joinedPlayerId) joinedPlayerId = result.joinedPlayerId;
        if (!result.ok && result.error) {
          ws.send(JSON.stringify({ type: 'room:error', message: result.error }));
        }
      } catch (err) {
        console.error('WebSocket message error:', err);
      }
    });

    ws.on('close', () => {
      if (joinedRoomCode) {
        const room = rooms.get(joinedRoomCode);
        if (room) {
          room.clients.delete(ws);
          if (joinedPlayerId && room.players.has(joinedPlayerId)) {
            const p = room.players.get(joinedPlayerId)!;
            p.connected = false;
            room.updatedAt = Date.now();
            broadcastRoom(room);
          }
        }
      }
    });
  });

  // --- Persistence APIs ---
  app.get('/api/rosters/:teacherId', (req, res) => {
    const store = readStore();
    res.json({ rosters: store.rosters[req.params.teacherId] || {} });
  });

  app.put('/api/rosters/:teacherId', (req, res) => {
    const { kelas, students } = req.body as { kelas?: number; students?: string[] };
    if (typeof kelas !== 'number' || !Array.isArray(students)) {
      res.status(400).json({ error: 'Format daftar siswa tidak valid.' });
      return;
    }
    const store = readStore();
    if (!store.rosters[req.params.teacherId]) {
      store.rosters[req.params.teacherId] = {};
    }
    store.rosters[req.params.teacherId][String(kelas)] = students.slice(0, 60);
    writeStore(store);
    res.json({ ok: true });
  });

  app.get('/api/workspace/:teacherId', (req, res) => {
    const store = readStore();
    res.json({ items: store.items[req.params.teacherId] || [] });
  });

  app.post('/api/workspace/:teacherId', (req, res) => {
    const record = req.body as {
      id?: string;
      itemType?: string;
      payload?: unknown;
    };
    if (!record || !record.id) {
      res.status(400).json({ error: 'Item workspace tidak valid.' });
      return;
    }
    const store = readStore();
    const list = (store.items[req.params.teacherId] || []) as Array<{ id: string }>;
    const filtered = list.filter((x) => x.id !== record.id);
    filtered.unshift(record as { id: string });
    store.items[req.params.teacherId] = filtered;

    if (record.itemType === 'game' && record.payload) {
      store.publicGames[record.id] = record.payload;
    }
    writeStore(store);
    res.json({ ok: true });
  });

  app.delete('/api/workspace/:teacherId/:itemId', (req, res) => {
    const store = readStore();
    const list = (store.items[req.params.teacherId] || []) as Array<{ id: string }>;
    store.items[req.params.teacherId] = list.filter((x) => x.id !== req.params.itemId);
    delete store.publicGames[req.params.itemId];
    writeStore(store);
    res.json({ ok: true });
  });

  // --- Settings APIs (Kepala Sekolah & NIP Guru) ---
  app.get('/api/settings', (_req, res) => {
    const store = readStore();
    res.json({ settings: store.settings ?? DEFAULT_SCHOOL_SETTINGS });
  });

  app.put('/api/settings', (req, res) => {
    const incoming = (req.body as { settings?: Partial<SchoolSettingsData> })?.settings;
    if (!incoming || typeof incoming !== 'object') {
      res.status(400).json({ error: 'Format pengaturan sekolah tidak valid.' });
      return;
    }
    const store = readStore();
    const prev = store.settings ?? { ...DEFAULT_SCHOOL_SETTINGS, teacherNips: {} };
    const rawLogo = incoming.logoDataUrl !== undefined ? String(incoming.logoDataUrl || '') : (prev.logoDataUrl || '');
    const safeLogo = rawLogo.length <= 200_000 ? rawLogo : (prev.logoDataUrl || '');
    const next: SchoolSettingsData = {
      pemerintah: String(incoming.pemerintah ?? prev.pemerintah ?? DEFAULT_SCHOOL_SETTINGS.pemerintah).trim() || DEFAULT_SCHOOL_SETTINGS.pemerintah,
      dinas: String(incoming.dinas ?? prev.dinas ?? DEFAULT_SCHOOL_SETTINGS.dinas).trim() || DEFAULT_SCHOOL_SETTINGS.dinas,
      namaSekolah: String(incoming.namaSekolah ?? prev.namaSekolah).trim() || DEFAULT_SCHOOL_SETTINGS.namaSekolah,
      alamat: String(incoming.alamat ?? prev.alamat ?? DEFAULT_SCHOOL_SETTINGS.alamat).trim(),
      logoDataUrl: safeLogo,
      kepalaSekolah: String(incoming.kepalaSekolah ?? prev.kepalaSekolah).trim(),
      nipKepalaSekolah: String(incoming.nipKepalaSekolah ?? prev.nipKepalaSekolah).trim(),
      teacherNips: Object.fromEntries(
        Object.entries(incoming.teacherNips ?? prev.teacherNips ?? {}).map(([k, v]) => [
          k,
          String(v || '').trim(),
        ])
      ),
    };
    store.settings = next;
    writeStore(store);
    res.json({ ok: true, settings: next });
  });

  // --- Game Score Records APIs ---
  app.get('/api/game-scores/:teacherId', (req, res) => {
    const store = readStore();
    res.json({ scores: store.gameScores[req.params.teacherId] || [] });
  });

  app.post('/api/game-scores/:teacherId', (req, res) => {
    const record = req.body as { id?: string; entries?: unknown[] };
    if (!record || !record.id || !Array.isArray(record.entries)) {
      res.status(400).json({ error: 'Format rekap nilai game tidak valid.' });
      return;
    }
    const store = readStore();
    const list = (store.gameScores[req.params.teacherId] || []) as Array<{ id: string }>;
    const filtered = list.filter((x) => x.id !== record.id);
    filtered.unshift(record as { id: string });
    store.gameScores[req.params.teacherId] = filtered.slice(0, 100);
    writeStore(store);
    res.json({ ok: true });
  });

  app.delete('/api/game-scores/:teacherId/:scoreId', (req, res) => {
    const store = readStore();
    const list = (store.gameScores[req.params.teacherId] || []) as Array<{ id: string }>;
    store.gameScores[req.params.teacherId] = list.filter((x) => x.id !== req.params.scoreId);
    writeStore(store);
    res.json({ ok: true });
  });

  app.post('/api/public-games', (req, res) => {
    const game = req.body as { id?: string; title?: string; items?: unknown[] };
    if (!game || !game.id || !Array.isArray(game.items)) {
      res.status(400).json({ error: 'Payload game publik tidak valid.' });
      return;
    }
    const store = readStore();
    store.publicGames[game.id] = game;
    writeStore(store);
    res.json({ ok: true });
  });

  app.get('/api/public-games/:gameId', (req, res) => {
    const store = readStore();
    let game = store.publicGames[req.params.gameId];
    if (!game) {
      // Fallback scan teacher workspace items in case publicGames wasn't synced
      for (const itemsList of Object.values(store.items)) {
        if (!Array.isArray(itemsList)) continue;
        const found = (itemsList as Array<{ id?: string; itemType?: string; payload?: unknown }>).find(
          (item) => item?.id === req.params.gameId && item?.itemType === 'game' && item?.payload
        );
        if (found) {
          game = found.payload;
          store.publicGames[req.params.gameId] = game;
          writeStore(store);
          break;
        }
      }
    }
    if (!game) {
      res.status(404).json({ error: 'Game tidak ditemukan.' });
      return;
    }
    res.json({ game });
  });

  app.get('/api/check-share-url', async (req, res) => {
    const rawUrl = String(req.query.url || '').trim();
    if (!rawUrl) {
      res.status(400).json({ ok: false, status: 400, error: 'Parameter url kosong.' });
      return;
    }
    let parsed: URL;
    try {
      parsed = new URL(rawUrl);
    } catch {
      res.status(400).json({ ok: false, status: 400, error: 'Format URL tidak valid.' });
      return;
    }
    const host = parsed.hostname.toLowerCase();
    const isPrivateOrIp =
      host === 'localhost' ||
      host.endsWith('.local') ||
      host.endsWith('.internal') ||
      /^[\d.]+$/.test(host) ||
      host.includes(':');
    if (parsed.protocol !== 'https:' || isPrivateOrIp || !host.includes('.')) {
      res.status(400).json({ ok: false, status: 400, error: 'Hanya URL HTTPS publik yang diizinkan.' });
      return;
    }

    try {
      const response = await fetch(`${parsed.origin}/`, {
        method: 'GET',
        redirect: 'manual',
        signal: AbortSignal.timeout(4500),
      });
      const status = response.status;
      const authGated = status === 301 || status === 302 || status === 401 || status === 403;
      const ok = status >= 200 && status < 300;
      res.json({ ok, status, authGated });
    } catch {
      res.json({ ok: false, status: 0, authGated: false });
    }
  });

  app.get('/api/rooms/:roomCode', (req, res) => {
    const code = (req.params.roomCode || '').trim().toUpperCase();
    const room = rooms.get(code);
    res.json({ room: room ? serializeRoom(room) : null });
  });

  app.post('/api/rooms/:roomCode/event', (req, res) => {
    const code = (req.params.roomCode || '').trim().toUpperCase();
    const body = (req.body || {}) as RoomEventInput;
    const result = processRoomEvent({ ...body, roomCode: code });
    if (!result.ok) {
      res.status(400).json({ error: result.error || 'Gagal memproses event room.' });
      return;
    }
    res.json({ ok: true, room: result.room });
  });

  // --- Gemini AI Endpoints ---
  app.post('/api/ai/generate-kisi', async (req, res) => {
    try {
      const { examType, kelas, fase, semester, tahunAjaran, mapel, tps, composition, difficulty } =
        req.body as {
          examType: string;
          kelas: number;
          fase: string;
          semester: string;
          tahunAjaran: string;
          mapel: string;
          tps: string[];
          composition: { pg: number; isian: number; uraian: number; menjodohkan: number };
          difficulty: { mudah: number; sedang: number; sulit: number };
        };

      const totalSoal =
        (composition.pg || 0) +
        (composition.isian || 0) +
        (composition.uraian || 0) +
        (composition.menjodohkan || 0);

      if (!Array.isArray(tps) || tps.length === 0 || totalSoal <= 0) {
        res.status(400).json({ error: 'Minimal 1 TP dan 1 butir soal diperlukan.' });
        return;
      }

      const ai = getGenAIClient();
      const prompt = `Anda adalah pakar kurikulum SD (Kurikulum Merdeka) untuk SDN Lendang Telaga.
Susunlah tabel Kisi-Kisi Asesmen ${examType} (Kelas ${kelas} / ${fase}, Semester ${semester} ${tahunAjaran}, Mata Pelajaran ${mapel}).

Daftar Tujuan Pembelajaran (TP) yang diinput guru (indeks 1 sampai ${tps.length}):
${tps.map((tp, i) => `TP ${i + 1}: ${tp}`).join('\n')}

Komposisi bentuk soal (TOTAL TEPAT ${totalSoal} SOAL, urut nomor 1 sampai ${totalSoal}):
- Pilihan Ganda (pg): ${composition.pg} soal
- Isian Singkat (isian): ${composition.isian} soal
- Uraian (uraian): ${composition.uraian} soal
- Menjodohkan (menjodohkan): ${composition.menjodohkan} soal

Proporsi tingkat kesulitan di antara ${totalSoal} soal:
- Mudah: sekitar ${difficulty.mudah}%
- Sedang: sekitar ${difficulty.sedang}%
- Sulit (HOTS): sekitar ${difficulty.sulit}%

Aturan wajib:
1. Hasilkan TEPAT ${totalSoal} objek dalam array JSON, masing-masing mewakili 1 nomor soal dari noSoal 1 sampai ${totalSoal}.
2. Distribusikan seluruh TP (TP 1..${tps.length}) secara proporsional.
3. Urutkan bentukSoal: pertama semua 'pg' (${composition.pg} butir), lalu 'isian' (${composition.isian} butir), lalu 'menjodohkan' (${composition.menjodohkan} butir), lalu 'uraian' (${composition.uraian} butir).
4. Field tpIndex adalah angka 1..${tps.length}, tpText menyalin rumusan TP terkait, levelKognitif salah satu dari 'L1', 'L2', 'L3', kesulitan salah satu dari 'Mudah', 'Sedang', 'Sulit', dan bentukSoal salah satu dari 'pg', 'isian', 'uraian', 'menjodohkan'.
5. Field 'materiPokok': tulis sub-materi inti yang spesifik dan ringkas (misalnya "Huruf Hijaiah Berharakat", "Pecahan Senilai", "Makna Sila Kedua Pancasila"), JANGAN menulis "${mapel} - Fokus TP 1".
6. Field 'indikatorSoal': WAJIB mengikuti kaidah **ABCD (Kondisi/Stimulus Konkret + Murid + KKO Terukur + Materi Spesifik)**:
   - DILARANG keras menulis frasa kaku seperti "Disajikan stimulus mudah/sedang/sulit" atau "murid dapat menyelesaikan soal PG/isian"!
   - Sebutkan bentuk stimulus nyatanya (mis. "Disajikan gambar/kartu huruf...", "Disajikan beberapa pernyataan...", "Disajikan ilustrasi kegiatan di sekolah...", "Disajikan soal cerita singkat...", "Disajikan dua lajur konsep dan arti...", atau tanpa stimulus jika L1 langsung).
   - Gunakan Kata Kerja Operasional terukur yang selaras dengan levelKognitif: L1 (menyebutkan, mengidentifikasi, menunjukkan, mengartikan), L2 (menentukan, mengurutkan, mengelompokkan, menghitung, memilih contoh), L3 (menganalisis, membandingkan, memecahkan masalah, menyimpulkan).
   - Contoh baik: "Disajikan ilustrasi kejadian sehari-hari di kelas, murid dapat menentukan sikap yang mencerminkan perilaku jujur dengan tepat."
7. Bahasa Indonesia baku, ringkas, dan jelas untuk siswa SD Kelas ${kelas}.`;

      const response = await generateContentWithQuotaFallback(ai, prompt, {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              noSoal: { type: Type.INTEGER },
              tpIndex: { type: Type.INTEGER },
              tpText: { type: Type.STRING },
              materiPokok: { type: Type.STRING },
              indikatorSoal: { type: Type.STRING },
              levelKognitif: { type: Type.STRING, enum: ['L1', 'L2', 'L3'] },
              kesulitan: { type: Type.STRING, enum: ['Mudah', 'Sedang', 'Sulit'] },
              bentukSoal: { type: Type.STRING, enum: ['pg', 'isian', 'uraian', 'menjodohkan'] },
            },
            required: [
              'noSoal',
              'tpIndex',
              'tpText',
              'materiPokok',
              'indikatorSoal',
              'levelKognitif',
              'kesulitan',
              'bentukSoal',
            ],
          },
        },
      });

      const parsedRaw = safeParseGeminiJson<Array<Record<string, unknown>>>(response.text, []);
      const parsed = Array.isArray(parsedRaw) ? parsedRaw : [];
      if (parsed.length === 0) {
        throw new Error('Respons AI kosong atau tidak valid saat menyusun kisi-kisi. Silakan coba lagi.');
      }
      const normalized = parsed.map((row, idx) => {
        const tpIdx = Math.min(Math.max(1, Number(row.tpIndex) || 1), tps.length);
        return {
          id: `kisi_${Date.now()}_${idx + 1}`,
          noSoal: idx + 1,
          tpIndex: tpIdx,
          tpText: String(row.tpText || tps[tpIdx - 1]),
          materiPokok: String(row.materiPokok || mapel),
          indikatorSoal: String(row.indikatorSoal || ''),
          levelKognitif: (['L1', 'L2', 'L3'].includes(String(row.levelKognitif))
            ? row.levelKognitif
            : 'L1') as 'L1' | 'L2' | 'L3',
          kesulitan: (['Mudah', 'Sedang', 'Sulit'].includes(String(row.kesulitan))
            ? row.kesulitan
            : 'Sedang') as 'Mudah' | 'Sedang' | 'Sulit',
          bentukSoal: (['pg', 'isian', 'uraian', 'menjodohkan'].includes(String(row.bentukSoal))
            ? row.bentukSoal
            : 'pg') as 'pg' | 'isian' | 'uraian' | 'menjodohkan',
        };
      });

      res.json({ kisiRows: normalized });
    } catch (err) {
      sendGeminiRouteError(
        res,
        '/api/ai/generate-kisi',
        err,
        'Gagal menyusun kisi-kisi otomatis menggunakan Gemini API.'
      );
    }
  });

  app.post('/api/ai/generate-questions', async (req, res) => {
    try {
      const { examType, kelas, fase, semester, mapel, kisiRows } = req.body as {
        examType: string;
        kelas: number;
        fase: string;
        semester: string;
        mapel: string;
        kisiRows: Array<{
          noSoal: number;
          tpIndex: number;
          tpText: string;
          materiPokok: string;
          indikatorSoal: string;
          levelKognitif: string;
          kesulitan: string;
          bentukSoal: string;
        }>;
      };

      if (!Array.isArray(kisiRows) || kisiRows.length === 0) {
        res.status(400).json({ error: 'Tabel kisi-kisi belum tersedia.' });
        return;
      }

      const isLowerGrade = Number(kelas) <= 3;
      const ai = getGenAIClient();
      const prompt = `Anda adalah pembuat naskah soal SD berpengalaman untuk SDN Lendang Telaga.
Buatlah naskah soal lengkap ${examType} untuk Kelas ${kelas} (${fase}), Semester ${semester}, Mata Pelajaran ${mapel} berdasarkan kisi-kisi berikut:

${kisiRows
  .map(
    (r) =>
      `No ${r.noSoal} | Bentuk: ${r.bentukSoal} | Kesulitan: ${r.kesulitan} (${r.levelKognitif}) | Materi: ${r.materiPokok} | Indikator: ${r.indikatorSoal} | TP${r.tpIndex}: ${r.tpText}`
  )
  .join('\n')}

Aturan wajib:
1. Hasilkan TEPAT ${kisiRows.length} soal dalam array JSON sesuai urutan nomor 1..${kisiRows.length}.
2. Setiap soal WAJIB menghadirkan stimulus konkret yang disebutkan pada kolom Indikator (jika indikator menyebut "Disajikan ilustrasi/cerita/pernyataan/tabel...", tuliskan ilustrasi, cerita pendek, pernyataan, atau datanya di dalam 'pertanyaan').
3. ${
        isLowerGrade
          ? `Karena ini Kelas ${kelas} (Fase Awal / Kelas 1-3), soal Pilihan Ganda ('pg') WAJIB hanya memakai 3 pilihan: opsiA, opsiB, dan opsiC (kosongkan opsiD dengan string ''). Sebar kunciJawaban secara merata dan acak hanya antara 'A', 'B', atau 'C' (JANGAN pernah memakai kunci 'D').`
          : `Jika bentuk == 'pg', isi opsiA, opsiB, opsiC, opsiD dengan pilihan jawaban yang masuk akal dan setara panjangnya untuk siswa SD Kelas ${kelas}; sebar kunciJawaban secara merata dan acak antara 'A', 'B', 'C', atau 'D' (jangan menumpuk di satu huruf).`
      } skorMaks = 1.
4. Jika bentuk == 'isian', pertanyaan berupa kalimat rumpang atau pertanyaan singkat; kunciJawaban adalah jawaban singkat yang tepat; opsiA..D kosongkan string ''. skorMaks = 2.
5. Jika bentuk == 'menjodohkan', pertanyaan adalah pernyataan/premis sisi kiri, dan kunciJawaban adalah pasangan jawaban singkat yang tepat untuk sisi kanan; opsiA..D kosongkan string ''. skorMaks = 1.
6. Jika bentuk == 'uraian', pertanyaan menuntut penjelasan/langkah sesuai indikator; kunciJawaban berisi jawaban ideal lengkap; rubrikSkor menjelaskan kriteria skor (misal: Skor 4 jika lengkap, 2 jika sebagian, 1 jika mencoba). skorMaks = 4.
7. Pastikan konteks soal hidup, sesuai keseharian anak SD Indonesia, dan bebas placeholder.
8. Penulisan 'pertanyaan' TIDAK BOLEH diawali tag atau penomoran ulang seperti '[SAS No. 1]', '[STS No. 1]', '(SAS NO.1)', atau '1.' karena nomor soal dicetak otomatis oleh sistem.`;

      const response = await generateContentWithQuotaFallback(ai, prompt, {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              nomor: { type: Type.INTEGER },
              bentuk: { type: Type.STRING, enum: ['pg', 'isian', 'uraian', 'menjodohkan'] },
              kesulitan: { type: Type.STRING, enum: ['Mudah', 'Sedang', 'Sulit'] },
              tpIndex: { type: Type.INTEGER },
              pertanyaan: { type: Type.STRING },
              opsiA: { type: Type.STRING },
              opsiB: { type: Type.STRING },
              opsiC: { type: Type.STRING },
              opsiD: { type: Type.STRING },
              kunciJawaban: { type: Type.STRING },
              rubrikSkor: { type: Type.STRING },
              skorMaks: { type: Type.INTEGER },
            },
            required: [
              'nomor',
              'bentuk',
              'kesulitan',
              'tpIndex',
              'pertanyaan',
              'opsiA',
              'opsiB',
              'opsiC',
              'opsiD',
              'kunciJawaban',
              'rubrikSkor',
              'skorMaks',
            ],
          },
        },
      });

      const parsedRaw = safeParseGeminiJson<Array<Record<string, unknown>>>(response.text, []);
      const parsed = Array.isArray(parsedRaw) ? parsedRaw : [];
      if (parsed.length === 0) {
        throw new Error('Respons AI kosong atau tidak valid saat membuat soal. Silakan coba lagi.');
      }
      const cleanStem = (raw: string): string =>
        raw
          .replace(/^\s*(?:[\[(]\s*(?:STS|SAS)\s*(?:No\.?)?\s*\d+\s*[\])]\s*)+/gi, '')
          .replace(/^\s*\d+\s*[.)]\s+/, '')
          .trim();

      const questions = parsed
        .map((q, idx) => {
          const refRow = kisiRows[idx];
          const bentuk = (refRow?.bentukSoal || q.bentuk || 'pg') as
            | 'pg'
            | 'isian'
            | 'uraian'
            | 'menjodohkan';
          let opsiA = String(q.opsiA || 'Pilihan A');
          let opsiB = String(q.opsiB || 'Pilihan B');
          let opsiC = String(q.opsiC || 'Pilihan C');
          const opsiD = String(q.opsiD || 'Pilihan D');
          let kunciJawaban = String(q.kunciJawaban || '');

          if (bentuk === 'pg' && isLowerGrade) {
            const rawKey = kunciJawaban.trim().toUpperCase();
            if (rawKey === 'D') {
              opsiC = opsiD || opsiC;
              kunciJawaban = 'C';
            } else if (!['A', 'B', 'C'].includes(rawKey)) {
              kunciJawaban = ['A', 'B', 'C'][idx % 3];
            } else {
              kunciJawaban = rawKey;
            }
          }

          return {
            id: `soal_${Date.now()}_${idx + 1}`,
            nomor: Number(refRow?.noSoal) || idx + 1,
            bentuk,
            kesulitan: (refRow?.kesulitan || q.kesulitan || 'Sedang') as
              | 'Mudah'
              | 'Sedang'
              | 'Sulit',
            tpIndex: refRow?.tpIndex || Number(q.tpIndex) || 1,
            pertanyaan: cleanStem(String(q.pertanyaan || '')),
            ...(bentuk === 'pg'
              ? {
                  opsi: isLowerGrade
                    ? { A: opsiA, B: opsiB, C: opsiC }
                    : { A: opsiA, B: opsiB, C: opsiC, D: opsiD },
                }
              : {}),
            kunciJawaban,
            rubrikSkor: String(q.rubrikSkor || 'Jawaban benar mendapat skor penuh.'),
            skorMaks: Number(q.skorMaks) || (bentuk === 'uraian' ? 4 : bentuk === 'isian' ? 2 : 1),
          };
        })
        .sort((a, b) => a.nomor - b.nomor);

      res.json({ questions });
    } catch (err) {
      sendGeminiRouteError(
        res,
        '/api/ai/generate-questions',
        err,
        'Gagal menghasilkan naskah soal menggunakan Gemini API.'
      );
    }
  });

  app.post('/api/ai/generate-game', async (req, res) => {
    try {
      const { mapel, kelas, template, topic, count } = req.body as {
        mapel: string;
        kelas: number;
        template: string;
        topic: string;
        count?: number;
      };

      const itemCount = Math.min(Math.max(Number(count) || 6, 4), 12);
      const isWordBased = template === 'crossword' || template === 'word-scramble';

      const ai = getGenAIClient();
      const prompt = isWordBased
        ? `Buatlah ${itemCount} kata & petunjuk edukatif untuk game ${template} SD Kelas ${kelas}, Mata Pelajaran ${mapel}, Topik "${topic}".
Aturan wajib:
1. 'answer' HARUS berupa 1 kata tunggal huruf kapital A-Z tanpa spasi, angka, atau tanda baca (panjang 4 sampai 10 huruf) agar cocok untuk grid Teka-Teki Silang dan Susun Kata!
2. 'prompt' adalah pertanyaan atau petunjuk yang jelas untuk anak SD Kelas ${kelas}.
3. 'clue' adalah petunjuk singkat tambahan (opsional).
4. 'options' berupa array string kosong [].`
        : `Buatlah ${itemCount} soal kuis cepat interaktif untuk game ${template} SD Kelas ${kelas}, Mata Pelajaran ${mapel}, Topik "${topic}".
Aturan wajib:
1. 'prompt' adalah pertanyaan singkat dan menarik untuk layar sentuh anak SD Kelas ${kelas}.
2. 'options' adalah array berisi TEPAT 4 pilihan jawaban singkat.
3. 'answer' HARUS sama persis dengan salah satu dari 4 string di 'options'.
4. 'clue' adalah petunjuk singkat 1 kalimat.`;

      const response = await generateContentWithQuotaFallback(ai, prompt, {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              prompt: { type: Type.STRING },
              answer: { type: Type.STRING },
              options: { type: Type.ARRAY, items: { type: Type.STRING } },
              clue: { type: Type.STRING },
            },
            required: ['prompt', 'answer', 'options', 'clue'],
          },
        },
      });

      const parsedRaw = safeParseGeminiJson<
        Array<{
          prompt: string;
          answer: string;
          options?: string[];
          clue?: string;
        }>
      >(response.text, []);
      const parsed = Array.isArray(parsedRaw) ? parsedRaw : [];
      if (parsed.length === 0) {
        throw new Error('Respons AI kosong saat menyusun soal game. Silakan coba lagi.');
      }

      const items = parsed.map((item, idx) => ({
        id: `gq_${Date.now()}_${idx + 1}`,
        prompt: String(item.prompt || ''),
        answer: isWordBased
          ? String(item.answer || '')
              .toUpperCase()
              .replace(/[^A-Z]/g, '')
          : String(item.answer || ''),
        options: Array.isArray(item.options) ? item.options.map(String) : [],
        clue: String(item.clue || ''),
      }));

      res.json({ items });
    } catch (err) {
      sendGeminiRouteError(
        res,
        '/api/ai/generate-game',
        err,
        'Gagal membuat draf soal game menggunakan Gemini API.'
      );
    }
  });

  app.post('/api/ai/generate-rpm-suite', async (req, res) => {
    try {
      const {
        cpText,
        materiList,
        mapel,
        kelas,
        fase,
        semester,
        tahunAjaran,
        alokasiWaktu,
        teachingMode = 'per-tp',
        tpPerSubMateri = 1,
      } = req.body as {
        cpText: string;
        materiList: string[];
        mapel: string;
        kelas: number;
        fase: string;
        semester: string;
        tahunAjaran: string;
        alokasiWaktu: string;
        teachingMode?: 'per-tp' | 'combined';
        tpPerSubMateri?: 1 | 2 | 3;
      };

      const cleanCp = String(cpText || '').trim();
      const cleanMateri = Array.isArray(materiList)
        ? materiList.map((m) => String(m).trim()).filter(Boolean)
        : [];

      if (!cleanCp || cleanMateri.length === 0) {
        res.status(400).json({
          error: 'Capaian Pembelajaran (CP) dan minimal 1 Materi Pembelajaran wajib diisi.',
        });
        return;
      }

      const effectiveMode: 'per-tp' | 'combined' =
        teachingMode === 'combined' ? 'combined' : 'per-tp';
      const tpDensity: 1 | 2 | 3 =
        tpPerSubMateri === 3 ? 3 : tpPerSubMateri === 2 ? 2 : 1;
      const materiUtama = cleanMateri.join('; ');
      const ai = getGenAIClient();

      const rpmInstruction =
        effectiveMode === 'per-tp'
          ? `5. 'rpmList': PENTING — Mode Pengajaran adalah **1 TP = 1 KALI PERTEMUAN**. Buatlah array 'rpmList' dengan jumlah item SAMA PERSIS dengan jumlah TP pada 'tps' (Pertemuan 1 membelajarkan TP.1, Pertemuan 2 membelajarkan TP.2, dst.):
   - Setiap elemen wajib mengisi 'pertemuanKe' (1, 2, 3...), 'kodeTp' ('TP.1', 'TP.2', ...), 'judulPertemuan' (tulis sub-topik fokus pertemuan tsb secara bersih TANPA awalan "BAB 1:" dan TANPA imbuhan "(Pertemuan 1)"), 'tujuanPembelajaran' (format bersih seperti "TP.1: <isi TP tanpa angka urut ganda>"), 'dimensiProfilLulusan' (pilih 3 dimensi PALING relevan dari 8 Dimensi Profil Lulusan: Keimanan & Ketakwaan terhadap Tuhan YME, Kewargaan, Penalaran Kritis, Kreativitas, Kolaborasi, Kemandirian, Kesehatan, Komunikasi), 'lintasDisiplinIlmu' (keterkaitan nyata dengan minimal 2 mapel SD lain selain ${mapel}), 'pemanfaatanDigital' (PID/Proyektor, audio/video relevan, dan Game Edukasi Portal QR), 'pendekatanModel', 'saranaMedia'.
   - **WAJIB NATURAL, LOGIS & TERSUSUN BERTAHAP (ANTI-KAKU)**:
     * DILARANG keras menempelkan kata "BAB 1:", "(Pertemuan X)", atau nomor TP ("1. ...", "3. ...") di tengah kalimat langkah pembelajaran! Sebut topiknya secara wajar dan mengalir dalam bahasa guru SD yang hidup.
     * Sesuaikan alur langkah dengan tahap pertemuannya: Pertemuan 1 berfokus pada pengenalan & pemahaman konsep dasar; pertemuan tengah pada pendalaman, pembandingan & analisis; pertemuan akhir pada aplikasi nyata, praktik langsung, atau proyek/demonstrasi.
     * Sesuaikan total menit pada 'kegiatanAwal', 'kegiatanInti', 'kegiatanPenutup', serta rincian menit tiap langkah dengan '${alokasiWaktu}' (mis. 2 x 35 = 70 Menit: 10 + 50 + 10; 3 x 35 = 105 Menit: 15 + 75 + 15; 4 x 35 = 140 Menit: 15 + 110 + 15).
     * 'kegiatanAwal' (4 langkah: Salam & Doa, Mindful Check-in, Apersepsi yang nyambung alami dengan materi ${mapel}, Penyampaian Tujuan & Kesepakatan), 'kegiatanInti' (5 langkah berjenjang Memahami -> Mengaplikasi lewat LKPD 1 & 2 -> Praktik/Simulasi/Kuis Portal sesuai kekhasan ${mapel} -> Merefleksi/Presentasi), 'kegiatanPenutup' (4 langkah: Menyimpulkan, Refleksi LKPD 3, Evaluasi 3 soal singkat, Tindak Lanjut & Doa).
   - 'asesmenAwal', 'asesmenFormatif', 'asesmenSumatif' (wajib memuat deskripsi singkat DITAMBAH 3 butir soal cek pemahaman siap pakai beserta kunci jawaban ringkas yang sesuai topik pertemuan), 'tindakLanjutPengayaan', 'tindakLanjutRemedial'.
   - 'lkpd': Buat Aktivitas 1 (3 baris spesifik karakteristik ${mapel}, bukan sekadar "Pengertian/Contoh/Manfaat"), Aktivitas 2 (1–2 studi kasus atau soal kontekstual anak SD Kelas ${kelas}), Aktivitas 3 (komitmen/refleksi individu).
   - 'rubrikRows': 3 aspek penilaian dengan Skor 4, 3, 2, 1.`
          : `5. 'rpmList': Mode Gabungan — buat array berisi TEPAT 1 objek RPM lengkap untuk menuntaskan materi "${materiUtama}" dengan 'pertemuanKe': 1, 'kodeTp': 'TP.1–TP.N', 'judulPertemuan' bersih TANPA awalan "BAB 1:" atau "(Pertemuan 1)", 'dimensiProfilLulusan' (pilih 3 paling relevan dari 8 Dimensi Profil Lulusan), 'lintasDisiplinIlmu', 'pemanfaatanDigital', langkah Kegiatan Awal–Inti–Penutup yang alami, logis, bebas tempelan judul BAB, dan total menitnya sesuai '${alokasiWaktu}', 'asesmenSumatif' dilengkapi 3 soal cek pemahaman + kunci ringkas, 'lkpd' 3 aktivitas yang spesifik sesuai ${mapel}, dan 'rubrikRows' 4 skala.`;

      const prompt = `Anda adalah pakar kurikulum SD (Kurikulum Merdeka & Pembelajaran Mendalam / Deep Learning: Mindful, Meaningful, Joyful Learning) untuk SDN Lendang Telaga.

Tugas Anda: Dari input manual Capaian Pembelajaran (CP) dan Materi Pembelajaran di bawah ini, hasilkan 6 perangkat pembelajaran yang saling terhubung dan siap pakai dalam format JSON:
1. TP (Tujuan Pembelajaran)
2. ATP (Alur Tujuan Pembelajaran)
3. PROTA (Program Tahunan)
4. PROSEM (Program Semester)
5. RPM (Rencana Pembelajaran Mendalam lengkap dengan Komponen Pembelajaran Mendalam, Langkah Mindful/Meaningful/Joyful Learning, Asesmen & Tindak Lanjut, Lampiran 1 LKPD 3 Aktivitas, dan Lampiran 2 Rubrik Penilaian 4 Skala)
6. Agenda Harian (Jurnal / Agenda Mengajar Harian Guru)

Data Input Guru:
- Mata Pelajaran: ${mapel}
- Kelas / Fase: Kelas ${kelas} SD / ${fase}
- Semester Fokus: ${semester} (${tahunAjaran})
- Alokasi Waktu per Pertemuan: ${alokasiWaktu}
- Capaian Pembelajaran (CP): "${cleanCp}"
- Daftar Materi Pembelajaran:
${cleanMateri.map((m, idx) => `  ${idx + 1}. ${m}`).join('\n')}

Aturan Wajib:
1. 'tps': Rumuskan Tujuan Pembelajaran dengan prinsip **Berbasis Materi, Dipayungi CP, dan Bahasa Alami (Anti-Template)**:
   - Jadikan Daftar Materi Pembelajaran sebagai konten konkret, dan gunakan CP sebagai payung kompetensi & batas kedalaman ${fase} (Kelas ${kelas} SD). JANGAN memotong CP mentah pada setiap tanda koma.
   - ${
     tpDensity === 1
       ? 'Jika materi memuat beberapa sub-topik nyata (misal dipisah koma, titik koma, atau daftar beberapa materi), buatlah TEPAT 1 TP spesifik untuk masing-masing sub-materi; jika 1 topik tunggal, pecah menjadi 3 TP berjenjang (pemahaman -> penerapan -> refleksi/praktik).'
       : `KEPADATAN TP RINCI DIPILIH (${tpDensity} TP PER SUB-MATERI): Untuk SETIAP sub-materi nyata (misal jika materi berisi "huruf hijaiyah, huruf hijaiyah berharakat, huruf hijaiyah bersambung", maka masing-masing sub-materi WAJIB dipecah lagi menjadi ${tpDensity} TP berjenjang yang rinci, terukur, dan bertahap dari pengenalan konsep -> pembedaan/latihan -> praktik lancar, sehingga 3 sub-materi menghasilkan ${3 * tpDensity} TP!). Jika hanya 1 topik tunggal, buat ${tpDensity === 3 ? '3' : '2–3'} TP berjenjang.`
   }
   - **WAJIB ANTI-TEMPLATE**: DILARANG mengulang pembuka kaku ("menjelaskan pengertian dan...") atau ekor klise ("...dengan benar", "...dengan tepat", "...secara mandiri dan bertanggung jawab") pada setiap baris. Gunakan Kata Kerja Operasional yang langsung menyatu dengan objek materinya (mis. *menyebutkan, melafalkan, membedakan, mengurutkan, memperagakan, menghitung, menyelesaikan soal cerita, mengamati, menyimpulkan*) dan sesuaikan panjang/gaya kalimat dengan usia anak ${fase} Kelas ${kelas}.
   - Format wajib: bernomor urut ("1. ...", "2. ...", dst.) diawali KKO huruf kecil TANPA kata "Murid mampu", kode 'TP.1', 'TP.2', dst.
2. 'atps': Susun Alur Tujuan Pembelajaran yang sejajar 1-per-1 dengan 'tps' memakai format kode "${kelas}.1.1 Murid dapat <isi TP 1 tanpa nomor>", "${kelas}.1.2 Murid dapat <isi TP 2 tanpa nomor>", dst., dan untuk TP puncak/akhir gunakan "Murid mampu ..." (kodeTp: "${kelas}.1.1", dst.), lengkap dengan dimensi profil lulusan, alokasiJp (bilangan bulat 2..6), semester ('${semester}'), dan indikatorKetercapaian.
3. 'protas': Susun Program Tahunan (4-6 unit pokok mencakup Semester Ganjil dan Semester Genap sehingga guru punya gambaran tahunan utuh; pastikan materi input guru muncul jelas pada semester '${semester}').
4. 'prosems': Susun Program Semester untuk Semester '${semester}' yang sejajar dengan TP. PENTING: Field 'bulanMinggu' HARUS array kosong [] (jangan dicentang otomatis karena guru akan menandai sendiri minggu efektif sesuai kalender sekolah).
${rpmInstruction}
6. 'agendaHarian': Buat entri Agenda Harian mengajar berurutan yang selaras 1-per-1 dengan 'rpmList' (pertemuanKe 1..N untuk tiap TP). Field 'hariTanggal' isi format rapi seperti 'Pertemuan 1 — ..... / ..... 2026'.
7. Gunakan bahasa Indonesia baku, pedagogis, ramah siswa SD, tanpa teks bertele-tele.`;

      const rpmItemSchema = {
        type: Type.OBJECT,
        properties: {
          pertemuanKe: { type: Type.INTEGER },
          kodeTp: { type: Type.STRING },
          judulPertemuan: { type: Type.STRING },
          tujuanPembelajaran: { type: Type.ARRAY, items: { type: Type.STRING } },
          dimensiProfilLulusan: { type: Type.STRING },
          lintasDisiplinIlmu: { type: Type.STRING },
          pemanfaatanDigital: { type: Type.STRING },
          pendekatanModel: { type: Type.STRING },
          saranaMedia: { type: Type.STRING },
          kegiatanAwal: {
            type: Type.OBJECT,
            properties: {
              durasi: { type: Type.STRING },
              label: { type: Type.STRING },
              langkah: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['durasi', 'label', 'langkah'],
          },
          kegiatanInti: {
            type: Type.OBJECT,
            properties: {
              durasi: { type: Type.STRING },
              label: { type: Type.STRING },
              langkah: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['durasi', 'label', 'langkah'],
          },
          kegiatanPenutup: {
            type: Type.OBJECT,
            properties: {
              durasi: { type: Type.STRING },
              label: { type: Type.STRING },
              langkah: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['durasi', 'label', 'langkah'],
          },
          asesmenAwal: { type: Type.STRING },
          asesmenFormatif: { type: Type.STRING },
          asesmenSumatif: { type: Type.STRING },
          tindakLanjutPengayaan: { type: Type.STRING },
          tindakLanjutRemedial: { type: Type.STRING },
          lkpd: {
            type: Type.OBJECT,
            properties: {
              judulAktivitas1: { type: Type.STRING },
              kolomHeader1: { type: Type.STRING },
              kolomHeader2: { type: Type.STRING },
              aktivitas1Rows: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    no: { type: Type.INTEGER },
                    item: { type: Type.STRING },
                    promptIsian: { type: Type.STRING },
                  },
                  required: ['no', 'item', 'promptIsian'],
                },
              },
              judulAktivitas2: { type: Type.STRING },
              aktivitas2Cases: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    judulKasus: { type: Type.STRING },
                    ceritaMasalah: { type: Type.STRING },
                    pertanyaan1: { type: Type.STRING },
                    pertanyaan2: { type: Type.STRING },
                  },
                  required: ['judulKasus', 'ceritaMasalah', 'pertanyaan1', 'pertanyaan2'],
                },
              },
              judulAktivitas3: { type: Type.STRING },
              promptAktivitas3: { type: Type.STRING },
            },
            required: [
              'judulAktivitas1',
              'kolomHeader1',
              'kolomHeader2',
              'aktivitas1Rows',
              'judulAktivitas2',
              'aktivitas2Cases',
              'judulAktivitas3',
              'promptAktivitas3',
            ],
          },
          rubrikRows: {
            type: Type.ARRAY,
            items: {
              type: Type.OBJECT,
              properties: {
                aspek: { type: Type.STRING },
                skor4: { type: Type.STRING },
                skor3: { type: Type.STRING },
                skor2: { type: Type.STRING },
                skor1: { type: Type.STRING },
              },
              required: ['aspek', 'skor4', 'skor3', 'skor2', 'skor1'],
            },
          },
        },
        required: [
          'pertemuanKe',
          'kodeTp',
          'judulPertemuan',
          'tujuanPembelajaran',
          'dimensiProfilLulusan',
          'lintasDisiplinIlmu',
          'pemanfaatanDigital',
          'pendekatanModel',
          'saranaMedia',
          'kegiatanAwal',
          'kegiatanInti',
          'kegiatanPenutup',
          'asesmenAwal',
          'asesmenFormatif',
          'asesmenSumatif',
          'tindakLanjutPengayaan',
          'tindakLanjutRemedial',
          'lkpd',
          'rubrikRows',
        ],
      };

      const response = await generateContentWithQuotaFallback(ai, prompt, {
        responseMimeType: 'application/json',
        responseSchema: {
            type: Type.OBJECT,
            properties: {
              tps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    kode: { type: Type.STRING },
                    materiTerkait: { type: Type.STRING },
                    rumusan: { type: Type.STRING },
                    kompetensi: { type: Type.STRING },
                    jp: { type: Type.INTEGER },
                  },
                  required: ['kode', 'materiTerkait', 'rumusan', 'kompetensi', 'jp'],
                },
              },
              atps: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    urut: { type: Type.INTEGER },
                    kodeTp: { type: Type.STRING },
                    tujuanPembelajaran: { type: Type.STRING },
                    materiPokok: { type: Type.STRING },
                    dimensiProfil: { type: Type.STRING },
                    alokasiJp: { type: Type.INTEGER },
                    semester: { type: Type.STRING },
                    indikatorKetercapaian: { type: Type.STRING },
                  },
                  required: [
                    'urut',
                    'kodeTp',
                    'tujuanPembelajaran',
                    'materiPokok',
                    'dimensiProfil',
                    'alokasiJp',
                    'semester',
                    'indikatorKetercapaian',
                  ],
                },
              },
              protas: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    no: { type: Type.INTEGER },
                    semester: { type: Type.STRING },
                    materiPokok: { type: Type.STRING },
                    alokasiJp: { type: Type.INTEGER },
                    bulanKeterangan: { type: Type.STRING },
                  },
                  required: ['no', 'semester', 'materiPokok', 'alokasiJp', 'bulanKeterangan'],
                },
              },
              prosems: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    no: { type: Type.INTEGER },
                    semester: { type: Type.STRING },
                    kodeTp: { type: Type.STRING },
                    materiPokok: { type: Type.STRING },
                    alokasiJp: { type: Type.INTEGER },
                    bulanMinggu: { type: Type.ARRAY, items: { type: Type.STRING } },
                  },
                  required: [
                    'no',
                    'semester',
                    'kodeTp',
                    'materiPokok',
                    'alokasiJp',
                    'bulanMinggu',
                  ],
                },
              },
              rpmList: {
                type: Type.ARRAY,
                items: rpmItemSchema,
              },
              agendaHarian: {
                type: Type.ARRAY,
                items: {
                  type: Type.OBJECT,
                  properties: {
                    pertemuanKe: { type: Type.INTEGER },
                    hariTanggal: { type: Type.STRING },
                    jamAlokasi: { type: Type.STRING },
                    kelas: { type: Type.STRING },
                    mapel: { type: Type.STRING },
                    materiPokok: { type: Type.STRING },
                    kegiatanIntiRingkas: { type: Type.STRING },
                    mediaLkpd: { type: Type.STRING },
                    catatanKetercapaian: { type: Type.STRING },
                  },
                  required: [
                    'pertemuanKe',
                    'hariTanggal',
                    'jamAlokasi',
                    'kelas',
                    'mapel',
                    'materiPokok',
                    'kegiatanIntiRingkas',
                    'mediaLkpd',
                    'catatanKetercapaian',
                  ],
                },
              },
            },
            required: ['tps', 'atps', 'protas', 'prosems', 'rpmList', 'agendaHarian'],
          },
      });

      const parsed = safeParseGeminiJson<Record<string, unknown>>(response.text, {});
      if (!parsed || typeof parsed !== 'object' || Object.keys(parsed).length === 0) {
        throw new Error('Respons AI tidak valid saat menyusun perangkat pembelajaran. Silakan coba lagi.');
      }
      const ts = Date.now();

      const tps = Array.isArray(parsed.tps)
        ? parsed.tps.map((t: Record<string, unknown>, i: number) => ({
            id: `tp_${ts}_${i + 1}`,
            kode: String(t.kode || `TP.${i + 1}`),
            materiTerkait: String(t.materiTerkait || materiUtama),
            rumusan: String(t.rumusan || ''),
            kompetensi: String(t.kompetensi || 'Memahami'),
            jp: Math.max(1, Number(t.jp) || 2),
          }))
        : [];

      const atps = Array.isArray(parsed.atps)
        ? parsed.atps.map((a: Record<string, unknown>, i: number) => ({
            id: `atp_${ts}_${i + 1}`,
            urut: Number(a.urut) || i + 1,
            kodeTp: String(a.kodeTp || `TP.${i + 1}`),
            tujuanPembelajaran: String(a.tujuanPembelajaran || ''),
            materiPokok: String(a.materiPokok || materiUtama),
            dimensiProfil: String(a.dimensiProfil || 'Bernalar kritis, gotong royong'),
            alokasiJp: Math.max(1, Number(a.alokasiJp) || 2),
            semester: String(a.semester || semester),
            indikatorKetercapaian: String(a.indikatorKetercapaian || ''),
          }))
        : [];

      const protas = Array.isArray(parsed.protas)
        ? parsed.protas.map((p: Record<string, unknown>, i: number) => ({
            id: `prota_${ts}_${i + 1}`,
            no: Number(p.no) || i + 1,
            semester: String(p.semester || semester),
            materiPokok: String(p.materiPokok || materiUtama),
            alokasiJp: Math.max(1, Number(p.alokasiJp) || 4),
            bulanKeterangan: String(p.bulanKeterangan || ''),
          }))
        : [];

      // PROSEM wajib tidak dicentang otomatis (bulanMinggu selalu [] saat generate)
      const prosems = Array.isArray(parsed.prosems)
        ? parsed.prosems.map((ps: Record<string, unknown>, i: number) => ({
            id: `prosem_${ts}_${i + 1}`,
            no: Number(ps.no) || i + 1,
            semester: String(ps.semester || semester),
            kodeTp: String(ps.kodeTp || `TP.${i + 1}`),
            materiPokok: String(ps.materiPokok || materiUtama),
            alokasiJp: Math.max(1, Number(ps.alokasiJp) || 2),
            bulanMinggu: [] as string[],
          }))
        : [];

      const normalizeRpm = (rawObj: Record<string, unknown>, idx: number) => {
        const rawAwal = (rawObj.kegiatanAwal || {}) as Record<string, unknown>;
        const rawInti = (rawObj.kegiatanInti || {}) as Record<string, unknown>;
        const rawPenutup = (rawObj.kegiatanPenutup || {}) as Record<string, unknown>;
        const rawLkpd = (rawObj.lkpd || {}) as Record<string, unknown>;
        const matchedTp = tps[idx];

        const judulTopik = String(
          rawObj.judulPertemuan || matchedTp?.materiTerkait || materiUtama
        );
        const defaultCrossMap: Record<string, string> = {
          'PAI BP':
            'Bahasa Indonesia (membaca pemahaman kisah teladan dan refleksi sikap), PKn (nilai toleransi, jujur, dan gotong royong), serta Seni Budaya (poster/kaligrafi pesan akhlak).',
          PKn:
            'Bahasa Indonesia (menyampaikan pendapat santun), IPAS (keragaman sosial budaya sekitar), serta Matematika (menghitung hasil musyawarah/voting kelas).',
          'Bahasa Indonesia':
            'IPAS (informasi pengetahuan alam/sosial dari teks), PKn (komunikasi santun dalam diskusi), serta Seni Budaya (ilustrasi cerita dan infografis).',
          Matematika:
            'IPAS (pengukuran dan data pengamatan sekitar), Bahasa Indonesia (memahami soal cerita), serta Seni Budaya (pola bilangan dan simetri bangun).',
          IPAS:
            'Matematika (pencatatan data, grafik, dan pengukuran), Bahasa Indonesia (laporan hasil pengamatan), serta PKn/Seni Budaya (kampanye peduli lingkungan).',
          'Seni Budaya':
            'Matematika (proporsi dan bentuk geometris), Bahasa Indonesia (menceritakan makna karya), serta Muatan Lokal/IPAS (bahan alam dan motif budaya daerah).',
          PJOK:
            'IPAS (fungsi organ dan otot tubuh), Matematika (menghitung skor, jarak, dan waktu), serta PKn (sportivitas dan kerja sama tim).',
          'Bahasa Inggris':
            'Bahasa Indonesia (perbandingan kosakata dan kalimat), Seni Budaya (bernyanyi dan kartu bergambar), serta Matematika (angka dan waktu dalam Bahasa Inggris).',
          'Muatan Lokal':
            'Bahasa Indonesia (terjemahan dan makna budaya daerah), Seni Budaya (lagu/aksara/kerajinan khas Lombok), serta PKn (pelestarian kearifan lokal).',
        };

        return {
          pertemuanKe: Number(rawObj.pertemuanKe) || idx + 1,
          kodeTp: String(rawObj.kodeTp || matchedTp?.kode || `TP.${idx + 1}`),
          judulPertemuan: judulTopik,
          capaianPembelajaran: cleanCp,
          tujuanPembelajaran:
            Array.isArray(rawObj.tujuanPembelajaran) && rawObj.tujuanPembelajaran.length > 0
              ? rawObj.tujuanPembelajaran.map(String)
              : matchedTp
              ? [matchedTp.rumusan]
              : tps.map((t) => t.rumusan),
          dimensiProfilLulusan: String(
            rawObj.dimensiProfilLulusan ||
              'Beriman dan bertakwa kepada Tuhan YME serta berakhlak mulia, bernalar kritis, gotong royong, dan mandiri.'
          ),
          lintasDisiplinIlmu: String(
            rawObj.lintasDisiplinIlmu ||
              defaultCrossMap[mapel] ||
              `Bahasa Indonesia (literasi konsep ${judulTopik}), PKn (kerja sama dan tanggung jawab), serta Seni Budaya (karya visual sederhana).`
          ),
          pemanfaatanDigital: String(
            rawObj.pemanfaatanDigital ||
              `Penayangan video/gambar pembelajaran "${judulTopik}" pada PID/Proyektor kelas serta kuis interaktif Game Edukasi Portal melalui QR Code untuk murid Kelas ${kelas}.`
          ),
          pendekatanModel: String(
            rawObj.pendekatanModel ||
              'Deep Learning (Mindful, Meaningful, Joyful Learning), Problem Based Learning (PBL), dan diskusi studi kasus.'
          ),
          saranaMedia: String(
            rawObj.saranaMedia || 'LKPD, papan tulis, spidol warna, kartu belajar, dan proyektor.'
          ),
          kegiatanAwal: {
            durasi: String(rawAwal.durasi || '10 Menit'),
            label: String(rawAwal.label || 'Mindful & Joyful'),
            langkah: Array.isArray(rawAwal.langkah) ? rawAwal.langkah.map(String) : [],
          },
          kegiatanInti: {
            durasi: String(rawInti.durasi || '50 Menit'),
            label: String(rawInti.label || 'Meaningful & Deep Learning'),
            langkah: Array.isArray(rawInti.langkah) ? rawInti.langkah.map(String) : [],
          },
          kegiatanPenutup: {
            durasi: String(rawPenutup.durasi || '10 Menit'),
            label: String(rawPenutup.label || 'Refleksi'),
            langkah: Array.isArray(rawPenutup.langkah) ? rawPenutup.langkah.map(String) : [],
          },
          asesmenAwal: String(rawObj.asesmenAwal || ''),
          asesmenFormatif: String(rawObj.asesmenFormatif || ''),
          asesmenSumatif: String(rawObj.asesmenSumatif || ''),
          tindakLanjutPengayaan: String(rawObj.tindakLanjutPengayaan || ''),
          tindakLanjutRemedial: String(rawObj.tindakLanjutRemedial || ''),
          lkpd: {
            judulAktivitas1: String(rawLkpd.judulAktivitas1 || 'Aktivitas 1: Pemahaman Konsep'),
            kolomHeader1: String(rawLkpd.kolomHeader1 || 'Konsep / Materi'),
            kolomHeader2: String(
              rawLkpd.kolomHeader2 || 'Penjelasan & Contoh Penerapan (Isi oleh Murid)'
            ),
            aktivitas1Rows: Array.isArray(rawLkpd.aktivitas1Rows)
              ? rawLkpd.aktivitas1Rows.map((r: Record<string, unknown>, rIdx: number) => ({
                  no: Number(r.no) || rIdx + 1,
                  item: String(r.item || ''),
                  promptIsian: String(r.promptIsian || 'Jawaban: ................................'),
                }))
              : [],
            judulAktivitas2: String(
              rawLkpd.judulAktivitas2 || 'Aktivitas 2: Analisis Studi Kasus (Diskusi Kelompok)'
            ),
            aktivitas2Cases: Array.isArray(rawLkpd.aktivitas2Cases)
              ? rawLkpd.aktivitas2Cases.map((c: Record<string, unknown>, cIdx: number) => ({
                  judulKasus: String(c.judulKasus || `Kasus ${cIdx + 1}`),
                  ceritaMasalah: String(c.ceritaMasalah || ''),
                  pertanyaan1: String(c.pertanyaan1 || ''),
                  pertanyaan2: String(c.pertanyaan2 || ''),
                }))
              : [],
            judulAktivitas3: String(
              rawLkpd.judulAktivitas3 || 'Aktivitas 3: Komitmen Aksi Nyata Individu'
            ),
            promptAktivitas3: String(
              rawLkpd.promptAktivitas3 ||
                'Satu kebiasaan baik yang akan langsung saya praktikkan hari ini adalah:'
            ),
          },
          rubrikRows: Array.isArray(rawObj.rubrikRows)
            ? rawObj.rubrikRows.map((rb: Record<string, unknown>) => ({
                aspek: String(rb.aspek || ''),
                skor4: String(rb.skor4 || ''),
                skor3: String(rb.skor3 || ''),
                skor2: String(rb.skor2 || ''),
                skor1: String(rb.skor1 || ''),
              }))
            : [],
        };
      };

      const rawList =
        Array.isArray(parsed.rpmList) && parsed.rpmList.length > 0
          ? (parsed.rpmList as Array<Record<string, unknown>>)
          : parsed.rpm && typeof parsed.rpm === 'object'
          ? [parsed.rpm as Record<string, unknown>]
          : [{}];

      const rpmList = rawList.map((item, idx) => normalizeRpm(item, idx));
      const rpm = rpmList[0];

      const agendaHarian = Array.isArray(parsed.agendaHarian)
        ? parsed.agendaHarian.map((ag: Record<string, unknown>, idx: number) => ({
            id: `ag_${ts}_${idx + 1}`,
            pertemuanKe: Number(ag.pertemuanKe) || idx + 1,
            hariTanggal: String(ag.hariTanggal || `Pertemuan ${idx + 1}`),
            jamAlokasi: String(ag.jamAlokasi || alokasiWaktu),
            kelas: String(ag.kelas || `Kelas ${kelas}`),
            mapel: String(ag.mapel || mapel),
            materiPokok: String(ag.materiPokok || rpmList[idx]?.judulPertemuan || materiUtama),
            kegiatanIntiRingkas: String(ag.kegiatanIntiRingkas || ''),
            mediaLkpd: String(ag.mediaLkpd || rpm.saranaMedia),
            catatanKetercapaian: String(ag.catatanKetercapaian || 'Terlaksana / Sesuai Rencana'),
          }))
        : [];

      res.json({
        suite: {
          teachingMode: effectiveMode,
          tps,
          atps,
          protas,
          prosems,
          rpm,
          rpmList,
          agendaHarian,
        },
      });
    } catch (err) {
      sendGeminiRouteError(
        res,
        '/api/ai/generate-rpm-suite',
        err,
        'Gagal menghasilkan perangkat pembelajaran mendalam menggunakan Gemini API.'
      );
    }
  });

  app.post('/api/ai/generate-cp-tp-atp', async (req, res) => {
    try {
      const { mapel, kelas, fase, entries, tpPerSubMateri = 1 } = req.body as {
        mapel: string;
        kelas: number;
        fase: string;
        tpPerSubMateri?: 1 | 2 | 3;
        entries: Array<{
          id: string;
          elemen: string;
          cpText: string;
          materiBab: string;
          semester: string;
        }>;
      };

      const tpDensity: 1 | 2 | 3 =
        tpPerSubMateri === 3 ? 3 : tpPerSubMateri === 2 ? 2 : 1;

      if (!Array.isArray(entries) || entries.length === 0) {
        res.status(400).json({ error: 'Minimal 1 baris Elemen, CP, dan Materi diperlukan.' });
        return;
      }

      const validEntries = entries.filter((e) => e.cpText.trim() && e.materiBab.trim());
      if (validEntries.length === 0) {
        res.status(400).json({
          error: 'Pastikan Capaian Pembelajaran (CP) dan Materi tidak kosong.',
        });
        return;
      }

      const ai = getGenAIClient();
      const prompt = `Anda adalah pakar kurikulum SD (Kurikulum Merdeka) untuk SDN Lendang Telaga.
Berdasarkan daftar Elemen, Capaian Pembelajaran (CP), dan Materi/BAB berikut untuk Mata Pelajaran ${mapel}, Kelas ${kelas} SD (${fase}), susunlah Tujuan Pembelajaran (TP) dan Alur Tujuan Pembelajaran (ATP) untuk setiap baris dengan prinsip **Berbasis Materi, Dipayungi CP, dan Bahasa Alami (Anti-Template)**.

Prinsip Penyusunan Wajib:
- JANGAN memotong CP secara mentah di setiap tanda koma karena CP berlaku untuk 1 Fase (2 kelas) dan terlalu luas. Jadikan **Materi/BAB** (beserta sub-materinya) sebagai objek konten spesifik, dan gunakan **CP** sebagai batas kedalaman kompetensi ${fase} (Kelas ${kelas}).
- ${
        tpDensity === 1
          ? 'Jika kolom Materi pada suatu baris berisi **beberapa sub-materi** (misalnya dipisah koma, titik koma, atau "dan" di luar tanda kurung seperti "Rukun Islam, Tata Cara Wudu, Salat Fardu, Zikir, dan Doa"), buatlah **1 TP spesifik untuk setiap sub-materi** (sekitar 2–6 TP agar tiap pertemuan fokus & nyambung, TIDAK mengulang judul bab utuh berkali-kali).'
          : `**MODE TP RINCI (${tpDensity} TP PER SUB-MATERI)**: Jika kolom Materi pada suatu baris berisi beberapa sub-materi (misal dipisah koma seperti "huruf hijaiyah, huruf hijaiyah berharakat, huruf hijaiyah bersambung"), **PECAH SETIAP SUB-MATERI MENJADI ${tpDensity} TP BERJENJANG** yang terukur (dari mengenal konsep dasar -> membedakan/latihan -> praktik lancar), sehingga tiap pertemuan menjadi jauh lebih rinci.`
      }
- Jika kolom Materi hanya berisi **1 topik tunggal** (misalnya "Bersuci" atau "Fotosintesis"), pecah menjadi **3 TP berjenjang** sesuai progresi belajar.
- **WAJIB ANTI-TEMPLATE (agar terasa ditulis langsung oleh guru SD):**
  * DILARANG mengulang pola pembuka yang sama (jangan semua berawal "menjelaskan pengertian dan...") atau menempelkan akhiran klise yang sama ("...dengan benar", "...dengan tepat", "...secara mandiri dan bertanggung jawab") pada setiap baris.
  * Gunakan Kata Kerja Operasional yang menyatu alami dengan objek materinya:
    - Ibadah/Al-Qur'an: *melafalkan, mengurutkan tata cara, memperagakan gerakan dan bacaan, membiasakan*
    - Matematika: *membandingkan, menghitung, menentukan nilai, menyelesaikan soal cerita*
    - IPAS/Bahasa/PKn/Seni: *membedakan, mengelompokkan, mengamati, menemukan ide pokok, menyimpulkan, membuat karya*
  * Sesuaikan gaya bahasa dengan ${fase} (Fase A Kelas 1–2 lebih singkat & konkret; Fase B Kelas 3–4 membandingkan & mempraktikkan; Fase C Kelas 5–6 analitis & menyimpulkan).
- Format 'tps': array berisi rumusan TP bernomor urut (sesuai kepadatan di atas), diawali KKO huruf kecil (TANPA kata "Murid mampu"):
  Contoh alami (tidak template):
  "1. menjelaskan kapan dan mengapa umat Islam perlu bersuci sebelum beribadah"
  "2. mengurutkan tata cara wudu serta cara menjaga kebersihan badan dan pakaian"
  "3. mempraktikkan kebiasaan hidup bersih dan tertib bersuci di rumah maupun sekolah"
- Format 'atps': array sejajar 1-per-1 dengan 'tps', diawali kode hierarki "${kelas}.<nomor_baris_k>.<nomor_urut_tp>":
  - Poin awal–tengah diawali "${kelas}.<nomor_baris_k>.1 Murid dapat <isi TP tanpa nomor>"
  - Poin terakhir (atau puncak kompetensi) diawali "${kelas}.<nomor_baris_k>.N Murid mampu <isi TP tanpa nomor>"
  Contoh untuk Kelas ${kelas} baris ke-1:
  "${kelas}.1.1 Murid dapat menjelaskan kapan dan mengapa umat Islam perlu bersuci sebelum beribadah"
  "${kelas}.1.2 Murid dapat mengurutkan tata cara wudu serta cara menjaga kebersihan badan dan pakaian"
  "${kelas}.1.3 Murid mampu mempraktikkan kebiasaan hidup bersih dan tertib bersuci di rumah maupun sekolah"

Daftar Input Guru:
${validEntries
  .map(
    (e, i) =>
      `Baris ${i + 1} (id=${e.id}) | Elemen: ${e.elemen || 'Umum'} | Semester: ${e.semester} | Materi: ${e.materiBab} | CP: ${e.cpText}`
  )
  .join('\n')}

Aturan wajib:
1. Hasilkan array JSON sebanyak TEPAT ${validEntries.length} objek sesuai urutan baris input di atas, sertakan 'id' yang persis sama dengan input.
2. Gunakan Bahasa Indonesia baku yang ringkas, operasional, dan sesuai tingkat perkembangan murid SD Kelas ${kelas}.`;

      const response = await generateContentWithQuotaFallback(ai, prompt, {
        responseMimeType: 'application/json',
        responseSchema: {
          type: Type.ARRAY,
          items: {
            type: Type.OBJECT,
            properties: {
              id: { type: Type.STRING },
              tps: { type: Type.ARRAY, items: { type: Type.STRING } },
              atps: { type: Type.ARRAY, items: { type: Type.STRING } },
            },
            required: ['id', 'tps', 'atps'],
          },
        },
      });

      const parsedRaw = safeParseGeminiJson<
        Array<{
          id: string;
          tps?: string[];
          atps?: string[];
        }>
      >(response.text, []);
      const parsed = Array.isArray(parsedRaw) ? parsedRaw : [];
      if (parsed.length === 0) {
        throw new Error('Respons AI kosong atau tidak valid saat menyusun TP & ATP. Silakan coba lagi.');
      }

      const results = validEntries.map((entry, idx) => {
        const matched = parsed.find((p) => p.id === entry.id) || parsed[idx];
        return {
          id: entry.id,
          tps: Array.isArray(matched?.tps) ? matched.tps.map(String) : [],
          atps: Array.isArray(matched?.atps) ? matched.atps.map(String) : [],
        };
      });

      res.json({ results });
    } catch (err) {
      sendGeminiRouteError(
        res,
        '/api/ai/generate-cp-tp-atp',
        err,
        'Gagal menghasilkan TP dan ATP otomatis menggunakan Gemini API.'
      );
    }
  });

  // --- Export Complete Source Code ZIP ---
  app.get('/api/export-code', async (_req, res) => {
    try {
      const zip = new JSZip();
      const ignoredDirs = new Set([
        'node_modules',
        'dist',
        '.git',
        'data',
        '.aistudio',
      ]);
      const ignoredFiles = new Set(['.env', 'bun.lock']);

      const addFolderToZip = (dirPath: string, zipFolder: JSZip) => {
        const entries = fs.readdirSync(dirPath, { withFileTypes: true });
        for (const entry of entries) {
          if (entry.isDirectory()) {
            if (ignoredDirs.has(entry.name)) continue;
            // Skip uploaded attachments folder
            if (dirPath.endsWith('public') && entry.name === 'assets') continue;
            const sub = zipFolder.folder(entry.name);
            if (sub) addFolderToZip(path.join(dirPath, entry.name), sub);
          } else if (entry.isFile()) {
            if (ignoredFiles.has(entry.name)) continue;
            const fullPath = path.join(dirPath, entry.name);
            const content = fs.readFileSync(fullPath);
            zipFolder.file(entry.name, content);
          }
        }
      };

      addFolderToZip(__dirname, zip);
      const buffer = await zip.generateAsync({ type: 'nodebuffer', compression: 'DEFLATE' });
      res.setHeader('Content-Type', 'application/zip');
      res.setHeader(
        'Content-Disposition',
        'attachment; filename="portal-guru-sdn-lendang-telaga.zip"'
      );
      res.send(buffer);
    } catch (err) {
      console.error('Error /api/export-code:', err);
      res.status(500).json({ error: 'Gagal membuat arsip ZIP kode sumber.' });
    }
  });

  // --- Vite Middleware / Static Serving ---
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: {
        middlewareMode: true,
        hmr: process.env.DISABLE_HMR !== 'true' ? { server } : false,
        ws: process.env.DISABLE_HMR !== 'true' ? { server } : false,
      },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.resolve(__dirname, 'dist');
    app.use(express.static(distPath));
    app.get('*', (_req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  server.listen(PORT, '0.0.0.0', () => {
    console.log(`Portal Guru SDN Lendang Telaga running on http://0.0.0.0:${PORT}`);
  });
}

startServer().catch((err) => {
  console.error('Failed starting server:', err);
  process.exit(1);
});
