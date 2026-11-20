import { deflateSync, inflateSync, strFromU8, strToU8 } from 'fflate';
import { GameDoc, GameTemplate, MapelName } from '../types/portal';

const CUSTOM_SHARE_ORIGIN_KEY = 'sdn_lt_custom_share_origin_v1';

export function isDevPreviewOrigin(): boolean {
  if (typeof window === 'undefined') return false;
  return window.location.hostname.startsWith('ais-dev-');
}

export function getCustomShareOrigin(): string {
  if (typeof window === 'undefined') return '';
  try {
    return localStorage.getItem(CUSTOM_SHARE_ORIGIN_KEY) || '';
  } catch {
    return '';
  }
}

export function setCustomShareOrigin(rawUrl: string): string {
  const trimmed = rawUrl.trim().replace(/\/+$/, '');
  let normalized = '';
  if (trimmed) {
    try {
      const parsed = new URL(trimmed.startsWith('http') ? trimmed : `https://${trimmed}`);
      normalized = parsed.origin;
    } catch {
      normalized = '';
    }
  }
  try {
    if (normalized) {
      localStorage.setItem(CUSTOM_SHARE_ORIGIN_KEY, normalized);
    } else {
      localStorage.removeItem(CUSTOM_SHARE_ORIGIN_KEY);
    }
  } catch {
    // ignore storage errors
  }
  return normalized;
}

export function getPublicShareOrigin(): string {
  const custom = getCustomShareOrigin();
  if (custom) return custom;
  if (typeof window === 'undefined') return '';
  const { protocol, hostname, port } = window.location;
  // AI Studio dev preview URLs (ais-dev-*) require developer auth; Shared App URL uses ais-pre-*
  const publicHost = hostname.startsWith('ais-dev-')
    ? hostname.replace(/^ais-dev-/, 'ais-pre-')
    : hostname;
  return `${protocol}//${publicHost}${port ? `:${port}` : ''}`;
}

export function makeGameRoomCode(seedId: string): string {
  const clean = seedId.replace(/[^a-zA-Z0-9]/g, '').toUpperCase();
  const suffix = clean.slice(-4).padStart(4, '7');
  return `LT${suffix}`;
}

function bytesToBase64Url(bytes: Uint8Array): string {
  let binary = '';
  const chunkSize = 0x8000;
  for (let i = 0; i < bytes.length; i += chunkSize) {
    const slice = bytes.subarray(i, i + chunkSize);
    binary += String.fromCharCode(...slice);
  }
  return btoa(binary).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/g, '');
}

function base64UrlToBytes(b64url: string): Uint8Array {
  const b64 = b64url.replace(/-/g, '+').replace(/_/g, '/');
  const pad = b64.length % 4 === 0 ? '' : '='.repeat(4 - (b64.length % 4));
  const binary = atob(b64 + pad);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

interface CompactV2Payload {
  v: 2;
  id: string;
  t: string;
  m: MapelName;
  k: number;
  tpl: GameTemplate;
  q: Array<[string, string, string[]?]>;
  p?: string[];
}

export function encodeGamePayload(
  game: GameDoc,
  includePlayers = true,
  maxItems = 30
): string {
  const compact: CompactV2Payload = {
    v: 2,
    id: game.id,
    t: game.title,
    m: game.mapel,
    k: game.kelas,
    tpl: game.template,
    q: (game.items || []).slice(0, maxItems).map((it) => {
      const opts = Array.isArray(it.options) ? it.options.filter(Boolean) : [];
      return opts.length > 0 ? [it.prompt, it.answer, opts] : [it.prompt, it.answer];
    }),
    ...(includePlayers && game.players?.length ? { p: game.players.slice(0, 15) } : {}),
  };
  const jsonBytes = strToU8(JSON.stringify(compact));
  const compressed = deflateSync(jsonBytes, { level: 9 });
  const compressedEncoded = `z.${bytesToBase64Url(compressed)}`;
  const rawEncoded = bytesToBase64Url(jsonBytes);
  return compressedEncoded.length < rawEncoded.length ? compressedEncoded : rawEncoded;
}

export function decodeGameFromLocation(): GameDoc | null {
  if (typeof window === 'undefined') return null;
  try {
    const hash = window.location.hash || '';
    const hashParams = new URLSearchParams(hash.startsWith('#') ? hash.slice(1) : hash);
    const searchParams = new URLSearchParams(window.location.search || '');
    const raw = (hashParams.get('g') || searchParams.get('g') || '').trim();
    if (!raw) return null;

    let jsonText = '';
    if (raw.startsWith('z.')) {
      const inflated = inflateSync(base64UrlToBytes(raw.slice(2)));
      jsonText = strFromU8(inflated);
    } else {
      jsonText = strFromU8(base64UrlToBytes(raw));
    }

    const parsed = JSON.parse(jsonText) as Partial<GameDoc> & Partial<CompactV2Payload>;
    if (!parsed) return null;

    if (parsed.v === 2 && parsed.id && parsed.tpl && Array.isArray(parsed.q)) {
      return {
        id: String(parsed.id),
        title: String(parsed.t || 'Game Edukasi'),
        topic: String(parsed.m || 'Evaluasi'),
        teacherId: 'guru',
        teacherName: 'Guru SDN Lendang Telaga',
        mapel: parsed.m || 'PAI BP',
        kelas: Number(parsed.k) || 4,
        template: parsed.tpl,
        playMode: 'live-mobile',
        items: parsed.q.map((tuple, idx) => ({
          id: `gq_${idx + 1}`,
          prompt: String(tuple[0] || ''),
          answer: String(tuple[1] || ''),
          options: Array.isArray(tuple[2]) ? tuple[2].map(String) : undefined,
        })),
        players: Array.isArray(parsed.p) ? parsed.p.map(String) : [],
        updatedAt: new Date().toISOString(),
      };
    }

    if (!parsed.id || !parsed.template || !Array.isArray(parsed.items)) {
      return null;
    }
    return {
      id: String(parsed.id),
      title: String(parsed.title || 'Game Edukasi'),
      topic: String(parsed.topic || parsed.mapel || 'Evaluasi'),
      teacherId: String(parsed.teacherId || 'guru'),
      teacherName: String(parsed.teacherName || 'Guru'),
      mapel: parsed.mapel || 'PAI BP',
      kelas: Number(parsed.kelas) || 4,
      template: parsed.template,
      playMode: parsed.playMode || 'live-mobile',
      items: parsed.items,
      players: Array.isArray(parsed.players) ? parsed.players : [],
      updatedAt: parsed.updatedAt || new Date().toISOString(),
    };
  } catch {
    return null;
  }
}

export function buildGameShareUrl(
  game: GameDoc,
  roomCode?: string,
  options?: { useCurrentOrigin?: boolean; customOrigin?: string; forQr?: boolean }
): string {
  const code = roomCode || makeGameRoomCode(game.id);
  const origin = options?.customOrigin
    ? options.customOrigin.replace(/\/+$/, '')
    : options?.useCurrentOrigin
    ? typeof window !== 'undefined'
      ? window.location.origin
      : ''
    : getPublicShareOrigin();
  const baseUrl = `${origin}/?play=${encodeURIComponent(game.id)}&room=${encodeURIComponent(code)}`;

  try {
    if (options?.forQr) {
      const QR_MAX_LEN = 2300;
      const totalAvailable = Math.min(30, game.items?.length || 0);
      const itemSteps = Array.from(
        new Set([totalAvailable, 24, 18, 15, 12, 10, 8, 6, 4, 2, 1].filter((n) => n > 0 && n <= totalAvailable))
      );

      for (const includePlayers of [true, false]) {
        for (const maxItems of itemSteps) {
          const encoded = encodeGamePayload(game, includePlayers, maxItems);
          const candidate = `${baseUrl}#g=${encoded}`;
          if (candidate.length <= QR_MAX_LEN) {
            return candidate;
          }
        }
      }
      return baseUrl;
    }

    const fullHash = encodeGamePayload(game, true, 30);
    if (fullHash.length <= 12000) {
      return `${baseUrl}#g=${fullHash}`;
    }
    return `${baseUrl}#g=${encodeGamePayload(game, false, 30)}`;
  } catch {
    return baseUrl;
  }
}

export async function copyTextSafe(text: string): Promise<boolean> {
  if (typeof navigator !== 'undefined' && navigator.clipboard?.writeText) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fallback below
    }
  }
  try {
    const textarea = document.createElement('textarea');
    textarea.value = text;
    textarea.setAttribute('readonly', '');
    textarea.style.position = 'fixed';
    textarea.style.opacity = '0';
    textarea.style.pointerEvents = 'none';
    document.body.appendChild(textarea);
    textarea.focus();
    textarea.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(textarea);
    return ok;
  } catch {
    return false;
  }
}

function escapeHtmlSafe(str: string): string {
  return String(str || '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

export function downloadStandaloneGameHtml(game: GameDoc, roomCode?: string): void {
  const code = roomCode || makeGameRoomCode(game.id);
  const safeDataJson = JSON.stringify({
    title: game.title,
    mapel: game.mapel,
    kelas: game.kelas,
    template: game.template,
    roomCode: code,
    items: (game.items || []).map((it) => ({
      prompt: it.prompt,
      answer: it.answer,
      options: it.options || [],
      clue: it.clue || '',
    })),
    players: game.players || [],
  }).replace(/</g, '\\u003c');

  const htmlContent = `<!doctype html>
<html lang="id">
<head>
  <meta charset="UTF-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1.0" />
  <title>${escapeHtmlSafe(game.title)} · SDN Lendang Telaga</title>
  <style>
    * { box-sizing: border-box; font-family: system-ui, -apple-system, 'Segoe UI', Roboto, sans-serif; }
    body { margin: 0; background: #f1f5f9; color: #0f172a; padding: 16px; }
    .wrap { max-width: 560px; margin: 0 auto; }
    .card { background: #fff; border: 1px solid #cbd5e1; border-radius: 18px; padding: 20px; box-shadow: 0 6px 20px rgba(15,23,42,.06); margin-bottom: 14px; }
    .meta { font-size: 12px; font-weight: 700; color: #0369a1; margin-bottom: 4px; }
    h1 { font-size: 20px; margin: 0 0 8px; }
    .muted { font-size: 13px; color: #475569; margin: 0; }
    .chips { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 12px; }
    .chip { border: 1px solid #cbd5e1; background: #f8fafc; padding: 7px 11px; border-radius: 10px; font-size: 12px; font-weight: 600; cursor: pointer; }
    .chip.active { background: #0284c7; color: #fff; border-color: #0284c7; }
    input[type=text] { width: 100%; padding: 12px 14px; border: 1px solid #94a3b8; border-radius: 12px; font-size: 15px; margin-top: 8px; }
    .btn { width: 100%; border: none; border-radius: 12px; padding: 13px 16px; font-size: 15px; font-weight: 700; cursor: pointer; margin-top: 12px; }
    .btn-primary { background: #0284c7; color: #fff; }
    .btn-primary:hover { background: #0369a1; }
    .btn-opt { width: 100%; text-align: left; border: 1px solid #cbd5e1; background: #f8fafc; padding: 13px 14px; border-radius: 12px; font-size: 15px; font-weight: 600; cursor: pointer; margin-top: 8px; }
    .btn-opt:hover { border-color: #0284c7; background: #e0f2fe; }
    .btn-opt.ok { background: #dcfce7; border-color: #16a34a; color: #14532d; }
    .btn-opt.err { background: #ffe4e6; border-color: #e11d48; color: #881337; }
    .bar-bg { width: 100%; height: 12px; background: #e2e8f0; border-radius: 99px; overflow: hidden; margin-top: 10px; }
    .bar-fill { height: 100%; background: #059669; transition: width .35s ease; }
    .score-row { display: flex; justify-content: space-between; font-size: 13px; font-weight: 700; margin-top: 8px; }
    .tiles { display: flex; flex-wrap: wrap; gap: 6px; margin-top: 10px; }
    .tile { min-width: 38px; height: 42px; padding: 0 10px; border: 1px solid #0284c7; background: #e0f2fe; color: #0c4a6e; border-radius: 10px; font-weight: 800; font-size: 16px; cursor: pointer; }
  </style>
</head>
<body>
  <div class="wrap" id="app"></div>
  <script>
    var GAME = ${safeDataJson};
    var state = { name: '', nameErr: '', started: false, idx: 0, score: 0, correct: 0, locked: false, feedback: '', typed: '', tileIdx: -1, tiles: [] };
    var app = document.getElementById('app');

    function norm(s) { return String(s || '').trim().toUpperCase(); }
    function esc(s) { return String(s || '').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;'); }
    function shuffleLetters(word) {
      var arr = norm(word).replace(/[^A-Z0-9]/g, '').split('');
      for (var i = arr.length - 1; i > 0; i--) {
        var j = Math.floor(Math.random() * (i + 1));
        var tmp = arr[i]; arr[i] = arr[j]; arr[j] = tmp;
      }
      return arr;
    }
    function isCaseSensitiveOptions(opts) {
      if (!opts || !opts.length) return false;
      var seen = {};
      for (var i = 0; i < opts.length; i++) {
        var key = norm(opts[i]);
        if (seen[key]) return true;
        seen[key] = true;
      }
      return false;
    }
    function isOptionMatch(a, b, caseSensitive) {
      return caseSensitive ? String(a || '').trim() === String(b || '').trim() : norm(a) === norm(b);
    }

    function render() {
      if (!state.started) {
        var chipsHtml = '';
        if (GAME.players && GAME.players.length) {
          chipsHtml = '<div style="margin-top:12px"><div style="font-size:12px;font-weight:700;color:#475569">Pilih Cepat Nama Siswa:</div><div class="chips">' +
            GAME.players.map(function(p) {
              var cls = state.name === p ? 'chip active' : 'chip';
              return '<button type="button" class="' + cls + '" onclick="pickName(this.textContent)">' + esc(p) + '</button>';
            }).join('') + '</div></div>';
        }
        var errHtml = state.nameErr ? '<div style="margin-top:8px;font-size:12px;font-weight:700;color:#be123c">' + esc(state.nameErr) + '</div>' : '';
        app.innerHTML = '<div class="card">' +
          '<div class="meta">SD Negeri Lendang Telaga · ' + esc(GAME.mapel) + ' Kelas ' + esc(GAME.kelas) + '</div>' +
          '<h1>' + esc(GAME.title) + '</h1>' +
          '<p class="muted">Langsung bermain di HP tanpa login. Masukkan namamu lalu mulai.</p>' +
          chipsHtml +
          '<div style="margin-top:14px"><label style="font-size:13px;font-weight:700">Nama Kamu</label>' +
          '<input id="nameInput" type="text" placeholder="Ketik nama lengkap..." value="' + esc(state.name) + '" oninput="state.name=this.value;state.nameErr=\\'\\'" />' +
          errHtml +
          '<button type="button" class="btn btn-primary" onclick="startGame()">Mulai Bermain (' + GAME.items.length + ' Soal)</button></div></div>';
        return;
      }

      if (state.idx >= GAME.items.length) {
        var pct = GAME.items.length ? Math.round((state.correct / GAME.items.length) * 100) : 0;
        var predikat = pct >= 85 ? 'Sangat Baik' : (pct >= 70 ? 'Baik' : 'Perlu Semangat Terus');
        app.innerHTML = '<div class="card" style="text-align:center;border:2px solid #fbbf24">' +
          '<div class="meta" style="color:#b45309">SERTIFIKAT HASIL BELAJAR · SD NEGERI LENDANG TELAGA</div>' +
          '<h1 style="font-size:24px;margin-top:6px">' + esc(state.name) + '</h1>' +
          '<p class="muted">' + esc(GAME.title) + ' · ' + esc(GAME.mapel) + ' Kelas ' + esc(GAME.kelas) + '</p>' +
          '<div style="display:grid;grid-template-columns:repeat(3,1fr);gap:8px;margin:16px 0">' +
            '<div style="background:#f0f9ff;border:1px solid #bae6fd;border-radius:12px;padding:10px">' +
              '<div style="font-size:11px;color:#475569">Skor Akhir</div>' +
              '<div style="font-size:20px;font-weight:800;color:#0369a1">' + state.score + '</div>' +
            '</div>' +
            '<div style="background:#ecfdf5;border:1px solid #a7f3d0;border-radius:12px;padding:10px">' +
              '<div style="font-size:11px;color:#475569">Akurasi</div>' +
              '<div style="font-size:20px;font-weight:800;color:#047857">' + pct + '%</div>' +
              '<div style="font-size:11px;color:#475569">' + state.correct + '/' + GAME.items.length + ' benar</div>' +
            '</div>' +
            '<div style="background:#fffbeb;border:1px solid #fde68a;border-radius:12px;padding:10px">' +
              '<div style="font-size:11px;color:#475569">Predikat</div>' +
              '<div style="font-size:13px;font-weight:800;color:#92400e;margin-top:6px">' + predikat + '</div>' +
            '</div>' +
          '</div>' +
          '<p class="muted" style="font-size:12px;margin-bottom:10px">Tunjukkan atau screenshot kartu hasil ini kepada Bapak/Ibu Guru.</p>' +
          '<button type="button" class="btn btn-primary" onclick="restartGame()">Main Lagi</button>' +
          '</div>';
        return;
      }

      var q = GAME.items[state.idx];
      var progress = Math.round((state.idx / GAME.items.length) * 100);
      var bodyHtml = '';

      if (q.options && q.options.length > 0) {
        var caseSensitive = isCaseSensitiveOptions(q.options);
        bodyHtml = q.options.map(function(opt, oIdx) {
          var cls = 'btn-opt';
          if (state.locked) {
            if (isOptionMatch(opt, q.answer, caseSensitive)) cls += ' ok';
            else cls += ' err';
          }
          return '<button type="button" class="' + cls + '" ' + (state.locked ? 'disabled' : '') + ' onclick="submitChoice(' + oIdx + ')">' + esc(opt) + '</button>';
        }).join('');
      } else {
        if (state.tileIdx !== state.idx) {
          state.tileIdx = state.idx;
          state.tiles = shuffleLetters(q.answer);
        }
        var letters = state.tiles || [];
        bodyHtml = '<div style="margin-top:10px">' +
          '<input id="ansInput" type="text" placeholder="Ketik jawaban..." value="' + esc(state.typed) + '" oninput="state.typed=this.value" />' +
          (GAME.template === 'word-scramble' ? '<div class="tiles">' + letters.map(function(ch){ return '<button type="button" class="tile" onclick="appendChar(\\'' + esc(ch) + '\\')">' + esc(ch) + '</button>'; }).join('') + '<button type="button" class="tile" style="background:#ffe4e6;border-color:#e11d48;color:#9f1239;font-size:13px;padding:0 12px" onclick="backspaceChar()">Hapus</button></div>' : '') +
          '<button type="button" class="btn btn-primary" ' + (state.locked ? 'disabled' : '') + ' onclick="submitTyped()">Kirim Jawaban</button></div>';
      }

      app.innerHTML = '<div class="card">' +
        '<div class="score-row"><span>Pemain: ' + esc(state.name) + '</span><span>Skor: ' + state.score + '</span></div>' +
        '<div class="bar-bg"><div class="bar-fill" style="width:' + Math.max(4, progress) + '%"></div></div>' +
        '<div style="font-size:12px;color:#64748b;margin-top:6px">Soal ' + (state.idx + 1) + ' dari ' + GAME.items.length + ' · Benar ' + state.correct + '</div>' +
        '</div><div class="card">' +
        '<h2 style="font-size:17px;margin:0 0 10px;line-height:1.45">' + esc(q.prompt) + '</h2>' +
        bodyHtml +
        (state.feedback ? '<div style="margin-top:12px;font-size:13px;font-weight:700;color:#0f172a">' + esc(state.feedback) + '</div>' : '') +
        '</div>';
    }

    window.pickName = function(n) { state.name = n; state.nameErr = ''; render(); };
    window.startGame = function() {
      if (!String(state.name).trim()) { state.nameErr = 'Masukkan nama kamu terlebih dahulu!'; render(); return; }
      state.nameErr = ''; state.started = true; state.idx = 0; state.score = 0; state.correct = 0; state.typed = ''; state.feedback = ''; state.tileIdx = -1; state.tiles = [];
      render();
    };
    window.restartGame = function() { state.idx = 0; state.score = 0; state.correct = 0; state.typed = ''; state.feedback = ''; state.locked = false; state.tileIdx = -1; state.tiles = []; render(); };
    window.appendChar = function(ch) { if (state.locked) return; state.typed += ch; render(); };
    window.backspaceChar = function() { if (state.locked) return; state.typed = state.typed.slice(0, -1); render(); };
    window.submitChoice = function(optIdx) {
      if (state.locked) return;
      state.locked = true;
      var q = GAME.items[state.idx];
      var chosen = q.options[optIdx];
      var caseSensitive = isCaseSensitiveOptions(q.options);
      var ok = isOptionMatch(chosen, q.answer, caseSensitive);
      if (ok) { state.score += 100; state.correct += 1; state.feedback = 'Benar! +100 poin'; }
      else { state.feedback = 'Kurang tepat. Jawaban benar: ' + q.answer; }
      render();
      setTimeout(function() { state.idx += 1; state.locked = false; state.feedback = ''; state.typed = ''; render(); }, 950);
    };
    window.submitTyped = function() {
      if (state.locked) return;
      state.locked = true;
      var q = GAME.items[state.idx];
      var ok = norm(state.typed) === norm(q.answer);
      if (ok) { state.score += 100; state.correct += 1; state.feedback = 'Benar! +100 poin'; }
      else { state.feedback = 'Jawaban benar: ' + q.answer; }
      render();
      setTimeout(function() { state.idx += 1; state.locked = false; state.feedback = ''; state.typed = ''; render(); }, 1100);
    };
    render();
  </script>
</body>
</html>`;

  const blob = new Blob([htmlContent], { type: 'text/html;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = `game-siswa-${code.toLowerCase()}.html`;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}
