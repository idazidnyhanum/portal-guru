import {
  Activity,
  ArrowLeft,
  Check,
  Copy,
  FileCode2,
  Flag,
  Gamepad2,
  Link2,
  Maximize2,
  Minimize2,
  Monitor,
  Play,
  QrCode,
  Radio,
  RotateCcw,
  Save,
  Trophy,
  Users,
  X,
  Zap,
} from 'lucide-react';
import { QRCodeSVG } from 'qrcode.react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { publishPublicGame, saveGameScoreRecord } from '../services/storageService';
import { GameDoc, LiveRoomState } from '../types/portal';
import {
  buildGameShareUrl,
  copyTextSafe,
  downloadStandaloneGameHtml,
  isDevPreviewOrigin,
  makeGameRoomCode,
} from '../utils/gameShare';
import { GameBarcodeModal } from './GameBarcodeModal';
import { CrosswordGame } from './games/CrosswordGame';
import { HorseRaceGame } from './games/HorseRaceGame';
import { HorseRiderSprite, RunnerSprite } from './games/RaceSprites';
import { RunningRaceGame } from './games/RunningRaceGame';
import { WordScrambleGame } from './games/WordScrambleGame';

interface GameArenaModalProps {
  game: GameDoc;
  teacherId?: string;
  initialRoomCode?: string;
  initialView?: 'play' | 'monitor';
  onClose: () => void;
}

const MONITOR_LANE_COLORS = [
  '#0284c7',
  '#059669',
  '#d97706',
  '#e11d48',
  '#7c3aed',
  '#0d9488',
];

export function GameArenaModal({
  game,
  teacherId,
  initialRoomCode,
  initialView,
  onClose,
}: GameArenaModalProps) {
  const [roomCode] = useState(() => initialRoomCode || makeGameRoomCode(game.id));
  const [viewMode, setViewMode] = useState<'play' | 'monitor'>(
    () => initialView || (game.playMode === 'live-mobile' ? 'monitor' : 'play')
  );
  const [liveRoom, setLiveRoom] = useState<LiveRoomState | null>(null);
  const [wsConnected, setWsConnected] = useState(false);
  const [staticHostMode, setStaticHostMode] = useState(false);
  const [copied, setCopied] = useState(false);
  const [showBarcodeModal, setShowBarcodeModal] = useState(false);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [savingScore, setSavingScore] = useState(false);
  const [scoreSavedMsg, setScoreSavedMsg] = useState<string | null>(null);
  const arenaContainerRef = useRef<HTMLDivElement | null>(null);
  const wsRef = useRef<WebSocket | null>(null);
  const staticHostRef = useRef(false);

  useEffect(() => {
    const handleFsChange = () => {
      setIsFullscreen(Boolean(document.fullscreenElement));
    };
    document.addEventListener('fullscreenchange', handleFsChange);
    return () => document.removeEventListener('fullscreenchange', handleFsChange);
  }, []);

  const toggleFullscreen = async () => {
    try {
      if (!document.fullscreenElement && arenaContainerRef.current?.requestFullscreen) {
        await arenaContainerRef.current.requestFullscreen();
      } else if (document.fullscreenElement && document.exitFullscreen) {
        await document.exitFullscreen();
      }
    } catch {
      // ignore unsupported fullscreen environment
    }
  };

  useEffect(() => {
    if (initialView) {
      setViewMode(initialView);
    }
  }, [initialView, game.id]);

  // Ensure game is registered publicly on server when Arena opens
  useEffect(() => {
    void publishPublicGame(game);
  }, [game]);

  const shareUrl = useMemo(() => buildGameShareUrl(game, roomCode), [game, roomCode]);
  const qrValue = useMemo(
    () => buildGameShareUrl(game, roomCode, { forQr: true }),
    [game, roomCode]
  );

  useEffect(() => {
    let closed = false;
    let pollTimer: number | null = null;
    let bc: BroadcastChannel | null = null;

    if (typeof BroadcastChannel !== 'undefined') {
      try {
        bc = new BroadcastChannel(`portal_guru_room_${roomCode}`);
        bc.onmessage = (ev: MessageEvent) => {
          const msg = ev.data as Record<string, unknown>;
          if (!msg || typeof msg.type !== 'string') return;
          setLiveRoom((prev) => {
            const base: LiveRoomState = prev || {
              roomCode,
              gameId: game.id,
              gameTitle: game.title,
              template: game.template,
              status: 'playing',
              resetVersion: 1,
              updatedAt: Date.now(),
              players: [],
              events: [],
            };
            const nowTime = new Date().toLocaleTimeString('id-ID', {
              hour: '2-digit',
              minute: '2-digit',
              second: '2-digit',
            });
            const prevEvents = base.events || [];
            if (msg.type === 'player:join') {
              const playerId = String(msg.playerId || '');
              const name = String(msg.name || 'Siswa');
              const existingIdx = base.players.findIndex((p) => p.playerId === playerId);
              const nextPlayer = {
                playerId,
                name,
                score: 0,
                progress: 0,
                answeredCount: 0,
                correctCount: 0,
                totalQuestions: Number(msg.totalQuestions || game.items.length || 1),
                streak: 0,
                turboActive: false,
                finished: false,
                finishTimeMs: null,
                connected: true,
                lastAction: 'Bergabung ke room (tab ini)',
              };
              const nextPlayers =
                existingIdx >= 0
                  ? base.players.map((p, i) => (i === existingIdx ? { ...p, ...nextPlayer } : p))
                  : [...base.players, nextPlayer];
              return {
                ...base,
                updatedAt: Date.now(),
                players: nextPlayers,
                events: [
                  { id: `ev_${Date.now()}`, time: nowTime, message: `${name} bergabung (tes browser ini)` },
                  ...prevEvents.slice(0, 29),
                ],
              };
            }
            if (msg.type === 'player:progress') {
              const playerId = String(msg.playerId || '');
              const name = String(msg.name || 'Siswa');
              const nextPlayers = base.players.map((p) =>
                p.playerId === playerId
                  ? {
                      ...p,
                      score: Number(msg.score ?? p.score),
                      progress: Number(msg.progress ?? p.progress),
                      answeredCount: Number(msg.answeredCount ?? p.answeredCount),
                      correctCount: Number(msg.correctCount ?? p.correctCount),
                      streak: Number(msg.streak ?? p.streak),
                      turboActive: Boolean(msg.turboActive),
                      finished: Boolean(msg.finished),
                      finishTimeMs:
                        typeof msg.finishTimeMs === 'number' ? msg.finishTimeMs : p.finishTimeMs,
                      lastAction: String(msg.lastAction || p.lastAction || ''),
                    }
                  : p
              );
              return {
                ...base,
                updatedAt: Date.now(),
                players: nextPlayers,
                events: [
                  {
                    id: `ev_${Date.now()}_${Math.random()}`,
                    time: nowTime,
                    message: `${name}: ${String(msg.lastAction || `${Number(msg.score || 0)} poin`)}`,
                  },
                  ...prevEvents.slice(0, 29),
                ],
              };
            }
            return base;
          });
        };
      } catch {
        // ignore unsupported BroadcastChannel
      }
    }

    // Register room over HTTP immediately so students can join even if WS is slower
    void fetch(`/api/rooms/${encodeURIComponent(roomCode)}/event`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        type: 'host:create',
        roomCode,
        gameId: game.id,
        gameTitle: game.title,
        template: game.template,
      }),
    })
      .then((res) => {
        const contentType = res.headers.get('content-type') || '';
        if (res.status === 404 || (res.ok && !contentType.includes('application/json'))) {
          staticHostRef.current = true;
          if (!closed) {
            setStaticHostMode(true);
            if (pollTimer !== null) {
              window.clearInterval(pollTimer);
              pollTimer = null;
            }
            wsRef.current?.close();
          }
          return null;
        }
        return res.ok ? res.json() : null;
      })
      .then((data: { room?: LiveRoomState } | null) => {
        if (!closed && data?.room) setLiveRoom(data.room);
      })
      .catch(() => {});

    const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
    const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
    wsRef.current = ws;

    ws.onopen = () => {
      if (staticHostRef.current) {
        ws.close();
        return;
      }
      setWsConnected(true);
      ws.send(
        JSON.stringify({
          type: 'host:create',
          roomCode,
          gameId: game.id,
          gameTitle: game.title,
          template: game.template,
        })
      );
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data) as { type: string; room?: LiveRoomState };
        if (msg.type === 'room:state' && msg.room) {
          setLiveRoom(msg.room);
        }
      } catch {
        // ignore invalid frames
      }
    };

    ws.onerror = () => {
      setWsConnected(false);
    };

    ws.onclose = () => {
      setWsConnected(false);
    };

    // HTTP polling fallback when in monitor mode or WS disconnected
    pollTimer = window.setInterval(() => {
      if (closed || staticHostRef.current) return;
      void fetch(`/api/rooms/${encodeURIComponent(roomCode)}`)
        .then((res) => {
          const contentType = res.headers.get('content-type') || '';
          if (res.status === 404 || (res.ok && !contentType.includes('application/json'))) {
            staticHostRef.current = true;
            if (!closed) setStaticHostMode(true);
            if (pollTimer !== null) {
              window.clearInterval(pollTimer);
              pollTimer = null;
            }
            return null;
          }
          return res.ok ? res.json() : null;
        })
        .then((data: { room?: LiveRoomState | null } | null) => {
          if (!closed && data?.room) setLiveRoom(data.room);
        })
        .catch(() => {});
    }, 3000);

    return () => {
      closed = true;
      if (pollTimer !== null) {
        window.clearInterval(pollTimer);
      }
      ws.close();
      wsRef.current = null;
      bc?.close();
    };
  }, [game.id, game.items.length, game.template, game.title, roomCode]);

  const handleCopyShareLink = async () => {
    const ok = await copyTextSafe(shareUrl);
    if (ok) {
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleHostStart = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'host:start', roomCode }));
    } else {
      void fetch(`/api/rooms/${encodeURIComponent(roomCode)}/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'host:start', roomCode }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { room?: LiveRoomState } | null) => {
          if (d?.room) setLiveRoom(d.room);
        })
        .catch(() => {});
    }
  };

  const handleHostReset = () => {
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: 'host:reset', roomCode }));
    } else {
      void fetch(`/api/rooms/${encodeURIComponent(roomCode)}/event`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ type: 'host:reset', roomCode }),
      })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { room?: LiveRoomState } | null) => {
          if (d?.room) setLiveRoom(d.room);
        })
        .catch(() => {});
    }
  };

  const players = liveRoom?.players || [];
  const connectedCount = players.filter((p) => p.connected).length;
  const finishedCount = players.filter((p) => p.finished).length;
  const avgProgress =
    players.length > 0
      ? Math.round(players.reduce((sum, p) => sum + p.progress, 0) / players.length)
      : 0;
  const topScore = players.length > 0 ? Math.max(...players.map((p) => p.score)) : 0;

  const rankedPlayers = useMemo(() => {
    return [...players].sort((a, b) => {
      if (b.score !== a.score) return b.score - a.score;
      const timeA = a.finishTimeMs ?? Number.MAX_SAFE_INTEGER;
      const timeB = b.finishTimeMs ?? Number.MAX_SAFE_INTEGER;
      return timeA - timeB;
    });
  }, [players]);

  const showPodium =
    rankedPlayers.length > 0 && (finishedCount > 0 || liveRoom?.status === 'finished');

  const handleSaveScoreRecord = async () => {
    if (rankedPlayers.length === 0 || savingScore) return;
    setSavingScore(true);
    setScoreSavedMsg(null);
    try {
      const targetTeacherId = teacherId || game.teacherId || 'guru';
      await saveGameScoreRecord({
        id: `score_${game.id}_${roomCode}_${Date.now()}`,
        teacherId: targetTeacherId,
        gameId: game.id,
        gameTitle: game.title,
        mapel: game.mapel,
        kelas: game.kelas,
        roomCode,
        savedAt: new Date().toISOString(),
        entries: rankedPlayers.map((p) => {
          const totalQ = Math.max(1, p.totalQuestions || game.items.length || 1);
          return {
            name: p.name,
            score: p.score,
            correctCount: p.correctCount,
            totalQuestions: totalQ,
            accuracyPct: Math.min(100, Math.round((p.correctCount / totalQ) * 100)),
          };
        }),
      });
      setScoreSavedMsg(
        `Rekap nilai ${rankedPlayers.length} siswa tersimpan di Folder Saya (tab Rekap Nilai Game).`
      );
    } finally {
      setSavingScore(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 bg-slate-950/75 backdrop-blur-sm flex items-center justify-center p-3 sm:p-6 overflow-y-auto">
      <div
        ref={arenaContainerRef}
        className={`bg-slate-50 border border-slate-200 w-full overflow-y-auto shadow-2xl ${
          isFullscreen ? 'max-w-none max-h-none h-screen rounded-none' : 'rounded-2xl max-w-6xl max-h-[94vh]'
        }`}
      >
        {/* Top Modal Header */}
        <div className="sticky top-0 z-20 bg-white border-b border-slate-200 px-5 py-3.5 flex flex-col lg:flex-row lg:items-center justify-between gap-3">
          <div className="min-w-0">
            <div className="text-xs font-medium text-slate-500">
              {game.mapel} · Kelas {game.kelas} ·{' '}
              {game.playMode === 'single'
                ? 'Single Player'
                : game.playMode === 'pid-multiplayer'
                ? 'Multiplayer Layar PID'
                : 'Multiplayer Live HP Siswa'}
            </div>
            <h2 className="font-display font-bold text-lg text-slate-900 truncate">
              {game.title}
            </h2>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            <div className="inline-flex items-center p-1 bg-slate-100 border border-slate-200 rounded-xl">
              <button
                type="button"
                onClick={() => setViewMode('monitor')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                  viewMode === 'monitor'
                    ? 'bg-white text-sky-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Monitor className="w-3.5 h-3.5" />
                Pantau Progres Live ({players.length})
              </button>
              <button
                type="button"
                onClick={() => setViewMode('play')}
                className={`px-3 py-1.5 text-xs font-semibold rounded-lg inline-flex items-center gap-1.5 whitespace-nowrap transition-colors ${
                  viewMode === 'play'
                    ? 'bg-white text-emerald-700 shadow-sm'
                    : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Gamepad2 className="w-3.5 h-3.5" />
                Mainkan di Layar PID
              </button>
            </div>

            <button
              type="button"
              onClick={handleCopyShareLink}
              className="touch-target px-3.5 py-2 bg-sky-600 hover:bg-sky-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
            >
              {copied ? <Check className="w-4 h-4" /> : <Link2 className="w-4 h-4" />}
              {copied ? 'Link Tersalin' : 'Share Link Game'}
            </button>
            <button
              type="button"
              onClick={() => setShowBarcodeModal(true)}
              className="touch-target px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
            >
              <QrCode className="w-4 h-4" />
              Barcode / QR
            </button>
            <button
              type="button"
              onClick={() => void toggleFullscreen()}
              className="touch-target px-3 py-2 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap transition-colors"
              title={isFullscreen ? 'Keluar Layar Penuh PID' : 'Mode Layar Penuh PID'}
            >
              {isFullscreen ? (
                <Minimize2 className="w-4 h-4" />
              ) : (
                <Maximize2 className="w-4 h-4" />
              )}
              {isFullscreen ? 'Keluar Layar Penuh' : 'Layar Penuh PID'}
            </button>
            <button
              type="button"
              onClick={onClose}
              className="touch-target px-3 py-2 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 transition-colors"
              aria-label="Kembali dan Tutup Arena Game"
            >
              <ArrowLeft className="w-4 h-4" />
              Kembali
            </button>
            <button
              type="button"
              onClick={onClose}
              className="touch-target p-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl transition-colors"
              aria-label="Tutup Arena Game"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        <div className="p-4 sm:p-6 space-y-6">
          {viewMode === 'monitor' ? (
            /* Live Teacher Process & Progress Monitor for Laptop / PID */
            <div className="space-y-5">
              {/* Room Status & Controls */}
              <div className="bg-white border border-slate-200 rounded-2xl p-5 flex flex-col lg:flex-row lg:items-center justify-between gap-4">
                <div className="space-y-1.5">
                  <div className="flex flex-wrap items-center gap-2 text-xs font-semibold">
                    <span
                      className={`w-2.5 h-2.5 rounded-full ${
                        wsConnected ? 'bg-emerald-500 animate-pulse' : 'bg-amber-500'
                      }`}
                    />
                    <span className={wsConnected ? 'text-emerald-700' : 'text-amber-700'}>
                      {wsConnected ? 'Monitor Live Laptop/PID Aktif' : 'Menghubungkan Room...'}
                    </span>
                    <span className="text-slate-300">·</span>
                    <span className="font-mono text-slate-800">Kode Room: {roomCode}</span>
                    <span className="text-slate-300">·</span>
                    <span className="text-slate-600">
                      Status:{' '}
                      <strong className="text-slate-900">
                        {liveRoom?.status === 'playing'
                          ? 'Sedang Berlangsung'
                          : liveRoom?.status === 'finished'
                          ? 'Selesai'
                          : 'Menunggu Siswa'}
                      </strong>
                    </span>
                  </div>
                  <p className="text-sm text-slate-600">
                    Pantau perlombaan karakter siswa dan proses pengerjaan setiap siswa secara langsung di layar PID atau laptop guru.
                  </p>
                </div>

                <div className="flex flex-wrap items-center gap-2 shrink-0">
                  <button
                    type="button"
                    onClick={handleCopyShareLink}
                    className="touch-target px-4 py-2.5 bg-slate-900 hover:bg-slate-800 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Copy className="w-4 h-4" />
                    {copied ? 'Tersalin!' : 'Salin Link Auto-Play'}
                  </button>
                  <button
                    type="button"
                    onClick={handleHostStart}
                    className="touch-target px-4 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <Play className="w-4 h-4" />
                    Mulai Sesi
                  </button>
                  <button
                    type="button"
                    onClick={handleHostReset}
                    className="touch-target px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-800 text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <RotateCcw className="w-4 h-4" />
                    Reset Skor Room
                  </button>
                  {rankedPlayers.length > 0 && (
                    <button
                      type="button"
                      onClick={() => void handleSaveScoreRecord()}
                      disabled={savingScore}
                      className="touch-target px-4 py-2.5 bg-amber-600 hover:bg-amber-700 disabled:opacity-60 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
                    >
                      <Save className="w-4 h-4" />
                      {savingScore ? 'Menyimpan...' : 'Simpan ke Rekap Nilai'}
                    </button>
                  )}
                </div>
              </div>

              {scoreSavedMsg && (
                <div className="bg-emerald-50 border border-emerald-200 text-emerald-800 px-4 py-2.5 rounded-xl text-xs font-semibold flex items-center gap-2">
                  <Check className="w-4 h-4 shrink-0" />
                  <span>{scoreSavedMsg}</span>
                </div>
              )}

              {showPodium && (
                <div className="relative overflow-hidden bg-slate-900 border border-slate-800 rounded-2xl p-5 sm:p-6 text-white">
                  <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
                    {[
                      { left: '8%', color: '#fbbf24', delay: '0s' },
                      { left: '19%', color: '#38bdf8', delay: '0.4s' },
                      { left: '33%', color: '#34d399', delay: '0.9s' },
                      { left: '49%', color: '#fb7185', delay: '0.2s' },
                      { left: '64%', color: '#facc15', delay: '0.7s' },
                      { left: '78%', color: '#60a5fa', delay: '1.1s' },
                      { left: '91%', color: '#4ade80', delay: '0.5s' },
                    ].map((dot, idx) => (
                      <span
                        key={idx}
                        className="confetti-piece absolute top-0 w-2.5 h-2.5 rounded-sm"
                        style={{
                          left: dot.left,
                          backgroundColor: dot.color,
                          animationDelay: dot.delay,
                        }}
                      />
                    ))}
                  </div>

                  <div className="relative z-10 flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-5">
                    <div>
                      <div className="text-xs font-semibold text-amber-300 flex items-center gap-1.5">
                        <Trophy className="w-4 h-4" />
                        Podium Juara Kelas · {finishedCount}/{rankedPlayers.length} Siswa Selesai
                      </div>
                      <h3 className="font-display font-bold text-lg text-white mt-0.5">
                        Peringkat Teratas — {game.title}
                      </h3>
                    </div>
                    <button
                      type="button"
                      onClick={() => void handleSaveScoreRecord()}
                      disabled={savingScore}
                      className="touch-target px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-950 text-xs font-bold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap shrink-0"
                    >
                      <Save className="w-4 h-4" />
                      {savingScore ? 'Menyimpan...' : 'Simpan Rekap Juara'}
                    </button>
                  </div>

                  <div className="relative z-10 grid grid-cols-3 gap-3 items-end max-w-2xl mx-auto pt-2">
                    {/* Juara 2 */}
                    <div className="podium-block flex flex-col items-center text-center" style={{ animationDelay: '0.12s' }}>
                      {rankedPlayers[1] ? (
                        <>
                          <div className="text-xs font-bold text-slate-200 truncate max-w-full px-1">
                            {rankedPlayers[1].name}
                          </div>
                          <div className="font-mono text-xs font-semibold text-sky-300 tabular-nums mb-1.5">
                            {rankedPlayers[1].score} poin
                          </div>
                          <div className="w-full h-20 bg-slate-700/90 border border-slate-500 rounded-t-xl flex flex-col items-center justify-center">
                            <span className="font-display font-bold text-xl text-slate-100">#2</span>
                            <span className="text-[11px] text-slate-300 font-mono">
                              Benar {rankedPlayers[1].correctCount}/{rankedPlayers[1].totalQuestions}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-20 bg-slate-800/60 border border-dashed border-slate-700 rounded-t-xl flex items-center justify-center text-xs text-slate-500">
                          #2 Menunggu
                        </div>
                      )}
                    </div>

                    {/* Juara 1 */}
                    <div className="podium-block flex flex-col items-center text-center">
                      {rankedPlayers[0] && (
                        <>
                          <Trophy className="w-5 h-5 text-amber-400 mb-1" />
                          <div className="text-sm font-bold text-white truncate max-w-full px-1">
                            {rankedPlayers[0].name}
                          </div>
                          <div className="font-mono text-xs font-bold text-amber-300 tabular-nums mb-1.5">
                            {rankedPlayers[0].score} poin
                          </div>
                          <div className="w-full h-28 bg-amber-500/20 border border-amber-400 rounded-t-xl flex flex-col items-center justify-center">
                            <span className="font-display font-bold text-2xl text-amber-300">#1</span>
                            <span className="text-[11px] text-amber-100 font-mono">
                              Benar {rankedPlayers[0].correctCount}/{rankedPlayers[0].totalQuestions}
                            </span>
                          </div>
                        </>
                      )}
                    </div>

                    {/* Juara 3 */}
                    <div className="podium-block flex flex-col items-center text-center" style={{ animationDelay: '0.22s' }}>
                      {rankedPlayers[2] ? (
                        <>
                          <div className="text-xs font-bold text-slate-200 truncate max-w-full px-1">
                            {rankedPlayers[2].name}
                          </div>
                          <div className="font-mono text-xs font-semibold text-orange-300 tabular-nums mb-1.5">
                            {rankedPlayers[2].score} poin
                          </div>
                          <div className="w-full h-16 bg-orange-950/70 border border-orange-600/70 rounded-t-xl flex flex-col items-center justify-center">
                            <span className="font-display font-bold text-lg text-orange-200">#3</span>
                            <span className="text-[11px] text-orange-200/80 font-mono">
                              Benar {rankedPlayers[2].correctCount}/{rankedPlayers[2].totalQuestions}
                            </span>
                          </div>
                        </>
                      ) : (
                        <div className="w-full h-16 bg-slate-800/60 border border-dashed border-slate-700 rounded-t-xl flex items-center justify-center text-xs text-slate-500">
                          #3 Menunggu
                        </div>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <div className="bg-sky-50 border border-sky-200 rounded-2xl p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                <div className="space-y-1.5 min-w-0">
                  <div className="font-semibold text-sky-800 text-xs inline-flex items-center gap-1.5">
                    <Radio className="w-3.5 h-3.5" />
                    Tautan &amp; Scan Barcode Langsung Siswa (Tanpa Login)
                  </div>
                  <div className="font-mono text-xs text-sky-950 break-all max-h-14 overflow-y-auto">
                    {shareUrl}
                  </div>
                  <div className="text-xs text-slate-600">
                    {isDevPreviewOrigin()
                      ? 'Tautan otomatis memakai domain publik (ais-pre-...) agar HP siswa tidak diminta login Google. Pastikan menu Share App di AI Studio aktif.'
                      : staticHostMode
                      ? 'Mode Hosting Statis (Vercel): QR & Link siswa langsung aktif tanpa login dan murid memperoleh Sertifikat Hasil Belajar di akhir. Untuk pantau skor live antar-HP berbeda secara real-time, jalankan melalui server Node.js/Cloud Run.'
                      : 'Siswa cukup arahkan kamera HP ke QR Code di samping atau buka tautan untuk masuk dengan urutan soal evaluasi yang sama.'}
                  </div>
                </div>
                <div className="flex flex-wrap items-center gap-2.5 shrink-0">
                  <button
                    type="button"
                    onClick={() => setShowBarcodeModal(true)}
                    className="bg-white p-2 rounded-xl border border-sky-200 hover:border-sky-400 transition-colors shadow-sm"
                    title="Klik untuk memperbesar Barcode di layar PID"
                  >
                    <QRCodeSVG value={qrValue} size={76} level="L" includeMargin={false} />
                  </button>
                  <button
                    type="button"
                    onClick={() => setShowBarcodeModal(true)}
                    className="touch-target px-3.5 py-2 bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <QrCode className="w-4 h-4" />
                    Perbesar Barcode
                  </button>
                  <button
                    type="button"
                    onClick={() => downloadStandaloneGameHtml(game, roomCode)}
                    className="touch-target px-3.5 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl inline-flex items-center gap-1.5 whitespace-nowrap"
                  >
                    <FileCode2 className="w-4 h-4" />
                    Unduh HTML (WA)
                  </button>
                </div>
              </div>

              {/* LIVE CARTOON RACE ARENA ON PID / LAPTOP FOR RUNNING RACE & HORSE RACE */}
              {(game.template === 'running-race' || game.template === 'horse-race') && (
                <div
                  className={`rounded-2xl p-4 sm:p-5 border space-y-2.5 overflow-hidden ${
                    game.template === 'horse-race'
                      ? 'bg-lime-950 border-lime-800'
                      : 'bg-emerald-950 border-emerald-800'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs text-white/90 font-semibold pb-1">
                    <span>
                      {game.template === 'horse-race'
                        ? 'ARENA LIVE PACUAN KUDA SISWA (PID / LAPTOP)'
                        : 'LINTASAN LIVE LOMBA LARI SISWA (PID / LAPTOP)'}
                    </span>
                    <span className="inline-flex items-center gap-1">
                      <Flag className="w-3.5 h-3.5" /> GARIS FINIS
                    </span>
                  </div>

                  {players.length === 0 ? (
                    <div className="border border-dashed border-white/25 rounded-xl p-8 text-center text-xs sm:text-sm text-white/80">
                      Menunggu siswa masuk ke Room {roomCode}. Karakter kartun siswa akan tampil berlari / berkuda di lintasan ini secara langsung!
                    </div>
                  ) : (
                    <div className="space-y-2.5 max-h-[430px] overflow-y-auto pr-1">
                      {players.map((p, idx) => {
                        const laneColor = MONITOR_LANE_COLORS[idx % MONITOR_LANE_COLORS.length];
                        return (
                          <div
                            key={p.playerId}
                            className={`relative rounded-xl border flex items-center px-3 overflow-hidden ${
                              game.template === 'horse-race'
                                ? 'h-18 bg-lime-900/90 border-lime-700'
                                : 'h-16 bg-emerald-900/90 border-emerald-700/70'
                            }`}
                          >
                            <div className="absolute inset-x-4 top-1/2 border-t border-dashed border-white/25 pointer-events-none" />
                            <div className="absolute right-2.5 top-1 bottom-1 w-2.5 bg-amber-300/90 rounded-sm" />

                            <div
                              className="relative z-10 w-full transition-transform duration-500 ease-out"
                              style={{
                                transform: `translateX(${Math.min(p.progress, 100) * 0.7}%)`,
                              }}
                            >
                              <div className="inline-flex items-center gap-2">
                                {game.template === 'horse-race' ? (
                                  <HorseRiderSprite
                                    jerseyColor={laneColor}
                                    laneNumber={idx + 1}
                                    turbo={p.turboActive}
                                    paused={p.finished}
                                  />
                                ) : (
                                  <RunnerSprite
                                    color={laneColor}
                                    laneNumber={idx + 1}
                                    paused={p.finished}
                                  />
                                )}
                                <div className="flex items-center gap-1.5 bg-black/55 px-2.5 py-1 rounded-md whitespace-nowrap">
                                  <span className="text-xs font-bold text-white">
                                    {p.name} ({p.score} poin · {p.progress}%)
                                  </span>
                                  {p.turboActive && <Zap className="w-3.5 h-3.5 text-amber-300" />}
                                </div>
                              </div>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              )}

              {/* 4 Summary Metrics */}
              <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs font-medium text-slate-500">Siswa Terhubung</div>
                  <div className="text-2xl font-bold text-slate-900 font-mono tabular-nums mt-1">
                    {connectedCount}{' '}
                    <span className="text-xs font-sans font-normal text-slate-500">
                      / {players.length} total
                    </span>
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs font-medium text-slate-500">Sudah Finis / Selesai</div>
                  <div className="text-2xl font-bold text-emerald-700 font-mono tabular-nums mt-1">
                    {finishedCount}
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs font-medium text-slate-500">Rata-rata Progres Kelas</div>
                  <div className="text-2xl font-bold text-sky-700 font-mono tabular-nums mt-1">
                    {avgProgress}%
                  </div>
                </div>
                <div className="bg-white border border-slate-200 rounded-xl p-4">
                  <div className="text-xs font-medium text-slate-500">Skor Tertinggi</div>
                  <div className="text-2xl font-bold text-amber-600 font-mono tabular-nums mt-1">
                    {topScore}
                  </div>
                </div>
              </div>

              <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
                {/* Student Live Process Details */}
                <div className="lg:col-span-8 bg-white border border-slate-200 rounded-2xl p-5 space-y-4">
                  <div className="flex items-center justify-between">
                    <h3 className="text-base font-bold text-slate-900 flex items-center gap-2">
                      <Users className="w-5 h-5 text-sky-600" />
                      Detail Proses Pengerjaan Siswa
                    </h3>
                    <span className="text-xs text-slate-500 font-mono">
                      {game.items.length} butir soal
                    </span>
                  </div>

                  {players.length === 0 ? (
                    <div className="border border-dashed border-slate-300 rounded-xl p-8 text-center space-y-2">
                      <div className="text-sm font-semibold text-slate-700">
                        Belum ada siswa yang masuk ke Room {roomCode}
                      </div>
                      <p className="text-xs text-slate-500 max-w-md mx-auto">
                        Klik <strong>Salin Link Auto-Play</strong> lalu kirimkan ke HP siswa. Begitu siswa menuliskan namanya, detail langkah pengerjaan akan tampil otomatis di sini.
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-3">
                      {players.map((p, idx) => (
                        <div
                          key={p.playerId}
                          className="border border-slate-200 rounded-xl p-4 bg-slate-50/70 space-y-2.5"
                        >
                          <div className="flex flex-wrap items-center justify-between gap-2">
                            <div className="flex items-center gap-2.5 min-w-0">
                              <span
                                className={`w-7 h-7 rounded-lg text-xs font-mono font-bold flex items-center justify-center shrink-0 ${
                                  idx === 0 && p.score > 0
                                    ? 'bg-amber-500 text-white'
                                    : 'bg-slate-900 text-white'
                                }`}
                              >
                                #{idx + 1}
                              </span>
                              <div className="min-w-0">
                                <div className="flex items-center gap-2">
                                  <span className="font-bold text-slate-900 truncate">{p.name}</span>
                                  <span
                                    className={`w-2 h-2 rounded-full ${
                                      p.connected ? 'bg-emerald-500' : 'bg-slate-400'
                                    }`}
                                    title={p.connected ? 'Terhubung' : 'Terputus'}
                                  />
                                  {p.turboActive && (
                                    <span className="text-xs font-bold text-amber-700 inline-flex items-center gap-0.5">
                                      <Zap className="w-3.5 h-3.5" /> Pacu Cepat
                                    </span>
                                  )}
                                  {p.finished && (
                                    <span className="text-xs font-bold text-emerald-700 inline-flex items-center gap-0.5">
                                      <Trophy className="w-3.5 h-3.5" /> Selesai
                                    </span>
                                  )}
                                </div>
                                <div className="text-xs text-slate-600 mt-0.5">
                                  Proses:{' '}
                                  <span className="font-medium text-slate-800">
                                    {p.lastAction ||
                                      `Soal ${p.answeredCount}/${p.totalQuestions} · Benar ${p.correctCount}`}
                                  </span>
                                </div>
                              </div>
                            </div>

                            <div className="text-right shrink-0">
                              <div className="font-mono text-sm font-bold text-sky-700 tabular-nums">
                                {p.score} poin
                              </div>
                              <div className="font-mono text-xs text-slate-500 tabular-nums">
                                {p.progress}% · Benar {p.correctCount}/{p.totalQuestions}
                              </div>
                            </div>
                          </div>

                          <div className="relative w-full h-3 bg-slate-200 rounded-full overflow-hidden">
                            <div
                              className={`h-full transition-all duration-300 rounded-full ${
                                p.finished
                                  ? 'bg-emerald-600'
                                  : p.turboActive
                                  ? 'bg-amber-500'
                                  : 'bg-sky-600'
                              }`}
                              style={{ width: `${Math.min(100, Math.max(4, p.progress))}%` }}
                            />
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                {/* Real-time Process Log Feed */}
                <div className="lg:col-span-4 bg-white border border-slate-200 rounded-2xl p-5 flex flex-col">
                  <h3 className="text-base font-bold text-slate-900 flex items-center gap-2 mb-3">
                    <Activity className="w-4 h-4 text-emerald-600" />
                    Log Proses Langsung
                  </h3>
                  <div className="flex-1 max-h-96 overflow-y-auto space-y-2 pr-1">
                    {!liveRoom?.events || liveRoom.events.length === 0 ? (
                      <div className="text-xs text-slate-500 py-8 text-center">
                        Aktivitas siswa (bergabung, menjawab soal, Pacu Cepat, finis) akan tampil otomatis di sini.
                      </div>
                    ) : (
                      liveRoom.events.map((ev) => (
                        <div
                          key={ev.id}
                          className="border border-slate-200 rounded-lg px-3 py-2 bg-slate-50 text-xs"
                        >
                          <div className="font-mono text-[10px] text-slate-400">{ev.time}</div>
                          <div className="text-slate-800 font-medium mt-0.5">{ev.message}</div>
                        </div>
                      ))
                    )}
                  </div>
                </div>
              </div>
            </div>
          ) : (
            /* Single Player or PID Turn-based Multiplayer directly on screen */
            <>
              {game.template === 'running-race' && (
                <RunningRaceGame
                  title={game.title}
                  items={game.items}
                  playerNames={
                    game.playMode === 'pid-multiplayer'
                      ? game.players
                      : [game.players[0] || 'Pemain 1']
                  }
                  mode={game.playMode === 'pid-multiplayer' ? 'pid-multiplayer' : 'single'}
                />
              )}
              {game.template === 'horse-race' && (
                <HorseRaceGame
                  title={game.title}
                  items={game.items}
                  playerNames={
                    game.playMode === 'pid-multiplayer'
                      ? game.players
                      : [game.players[0] || 'Penunggang 1']
                  }
                  mode={game.playMode === 'pid-multiplayer' ? 'pid-multiplayer' : 'single'}
                />
              )}
              {game.template === 'crossword' && (
                <CrosswordGame title={game.title} items={game.items} />
              )}
              {game.template === 'word-scramble' && (
                <WordScrambleGame
                  title={game.title}
                  items={game.items}
                  playerNames={
                    game.playMode === 'pid-multiplayer'
                      ? game.players
                      : [game.players[0] || 'Pemain 1']
                  }
                  mode={game.playMode === 'pid-multiplayer' ? 'pid-multiplayer' : 'single'}
                />
              )}
            </>
          )}
        </div>
      </div>

      {showBarcodeModal && (
        <GameBarcodeModal
          title={game.title}
          subtitle={`${game.mapel} · Kelas ${game.kelas}`}
          roomCode={roomCode}
          shareUrl={shareUrl}
          qrValue={qrValue}
          game={game}
          onClose={() => setShowBarcodeModal(false)}
        />
      )}
    </div>
  );
}
