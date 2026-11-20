import { Award, Play, Radio, RefreshCw } from 'lucide-react';
import { useCallback, useEffect, useRef, useState } from 'react';
import { fetchPublicGameById, publishPublicGame } from '../services/storageService';
import { GameDoc, LiveRoomState } from '../types/portal';
import { decodeGameFromLocation } from '../utils/gameShare';
import { CrosswordGame } from './games/CrosswordGame';
import { HorseRaceGame } from './games/HorseRaceGame';
import { GameProgressUpdate, RunningRaceGame } from './games/RunningRaceGame';
import { WordScrambleGame } from './games/WordScrambleGame';

interface StudentPlayViewProps {
  gameId: string;
  roomCode: string;
}

export function StudentPlayView({ gameId, roomCode }: StudentPlayViewProps) {
  const [game, setGame] = useState<GameDoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [studentName, setStudentName] = useState('');
  const [joined, setJoined] = useState(false);
  const [wsConnected, setWsConnected] = useState(false);
  const [liveRoom, setLiveRoom] = useState<LiveRoomState | null>(null);
  const [latestResult, setLatestResult] = useState<GameProgressUpdate | null>(null);
  const [roomSessionKey, setRoomSessionKey] = useState(0);

  const [realtimeUnsupported, setRealtimeUnsupported] = useState(false);

  const playerIdRef = useRef(`stu_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`);
  const wsRef = useRef<WebSocket | null>(null);
  const retryCountRef = useRef(0);
  const reconnectTimerRef = useRef<number | null>(null);
  const joinedNameRef = useRef<string>('');
  const lastResetVersionRef = useRef<number | null>(null);
  const realtimeUnsupportedRef = useRef(false);
  const broadcastChannelRef = useRef<BroadcastChannel | null>(null);

  const loadGame = useCallback(async () => {
    setLoading(true);
    setError(null);
    const hashGame = decodeGameFromLocation();
    try {
      const fetchPromise = fetchPublicGameById(gameId);
      const serverGame = hashGame
        ? await Promise.race<GameDoc | null>([
            fetchPromise,
            new Promise<null>((resolve) => window.setTimeout(() => resolve(null), 1500)),
          ])
        : await fetchPromise;

      if (
        serverGame &&
        Array.isArray(serverGame.items) &&
        serverGame.items.length > 0 &&
        (!hashGame || serverGame.items.length >= hashGame.items.length)
      ) {
        setGame(serverGame);
        return;
      }

      if (hashGame && Array.isArray(hashGame.items) && hashGame.items.length > 0) {
        setGame(hashGame);
        void publishPublicGame(hashGame);
        return;
      }

      setError(
        'Game tidak ditemukan. Pastikan guru sudah menyimpan game dan membagikan ulang tautan/QR terbaru.'
      );
    } catch {
      if (hashGame && Array.isArray(hashGame.items) && hashGame.items.length > 0) {
        setGame(hashGame);
      } else {
        setError('Gagal memuat data game. Periksa koneksi internet HP lalu coba lagi.');
      }
    } finally {
      setLoading(false);
    }
  }, [gameId]);

  useEffect(() => {
    void loadGame();
  }, [loadGame]);

  const sendRoomEventHttp = useCallback(
    async (payload: Record<string, unknown>) => {
      if (!roomCode) return;
      if (typeof BroadcastChannel !== 'undefined') {
        try {
          if (!broadcastChannelRef.current) {
            broadcastChannelRef.current = new BroadcastChannel(`portal_guru_room_${roomCode}`);
          }
          broadcastChannelRef.current.postMessage(payload);
        } catch {
          // ignore BroadcastChannel errors
        }
      }
      if (realtimeUnsupportedRef.current) return;
      try {
        const res = await fetch(`/api/rooms/${encodeURIComponent(roomCode)}/event`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(payload),
        });
        const contentType = res.headers.get('content-type') || '';
        if (res.status === 404 || (res.ok && !contentType.includes('application/json'))) {
          realtimeUnsupportedRef.current = true;
          setRealtimeUnsupported(true);
          return;
        }
        if (res.ok) {
          const data = (await res.json()) as { room?: LiveRoomState };
          if (data.room) setLiveRoom(data.room);
        }
      } catch {
        // offline tolerance: student can keep playing locally
      }
    },
    [roomCode]
  );

  const connectAndJoin = useCallback(
    (nameToUse: string, activeGame: GameDoc) => {
      if (!roomCode) return;
      joinedNameRef.current = nameToUse;

      const joinPayload = {
        type: 'player:join',
        roomCode,
        gameId: activeGame.id,
        gameTitle: activeGame.title,
        template: activeGame.template,
        playerId: playerIdRef.current,
        name: nameToUse,
        totalQuestions: activeGame.items.length,
      };

      // Also sync via HTTP / BroadcastChannel so join succeeds even if WebSocket is unavailable
      void sendRoomEventHttp(joinPayload);
      if (realtimeUnsupportedRef.current) return;

      try {
        const protocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
        const ws = new WebSocket(`${protocol}//${window.location.host}/ws`);
        wsRef.current = ws;

        ws.onopen = () => {
          retryCountRef.current = 0;
          setWsConnected(true);
          ws.send(JSON.stringify(joinPayload));
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
          if (
            joinedNameRef.current &&
            !realtimeUnsupportedRef.current &&
            retryCountRef.current < 2
          ) {
            retryCountRef.current += 1;
            reconnectTimerRef.current = window.setTimeout(() => {
              connectAndJoin(joinedNameRef.current, activeGame);
            }, 2500);
          }
        };
      } catch {
        setWsConnected(false);
      }
    },
    [roomCode, sendRoomEventHttp]
  );

  useEffect(() => {
    const version = liveRoom?.resetVersion;
    if (typeof version !== 'number') return;
    if (lastResetVersionRef.current === null) {
      lastResetVersionRef.current = version;
      return;
    }
    if (version > lastResetVersionRef.current) {
      lastResetVersionRef.current = version;
      if (joined) {
        setLatestResult(null);
        setRoomSessionKey((k) => k + 1);
      }
    }
  }, [joined, liveRoom?.resetVersion]);

  useEffect(() => {
    return () => {
      joinedNameRef.current = '';
      if (reconnectTimerRef.current !== null) {
        window.clearTimeout(reconnectTimerRef.current);
      }
      wsRef.current?.close();
      broadcastChannelRef.current?.close();
      broadcastChannelRef.current = null;
    };
  }, []);

  const handleStart = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = studentName.trim();
    if (!clean || !game) return;
    setLatestResult(null);
    setJoined(true);
    if (roomCode) {
      connectAndJoin(clean, game);
    }
  };

  const handleProgress = (update: GameProgressUpdate) => {
    setLatestResult(update);
    if (!roomCode) return;
    const progressPayload = {
      type: 'player:progress',
      roomCode,
      playerId: playerIdRef.current,
      name: studentName.trim() || 'Siswa',
      ...update,
    };
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify(progressPayload));
    } else {
      void sendRoomEventHttp(progressPayload);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="text-sm font-medium text-slate-600">Memuat game edukasi...</div>
      </div>
    );
  }

  if (error || !game) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-6">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-7 text-center space-y-4">
          <h1 className="text-xl font-bold text-slate-900">Tautan Game Belum Tersedia</h1>
          <p className="text-sm text-slate-600">{error}</p>
          <button
            type="button"
            onClick={() => void loadGame()}
            className="touch-target px-5 py-2.5 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-xl inline-flex items-center gap-2"
          >
            <RefreshCw className="w-4 h-4" />
            Muat Ulang Game
          </button>
        </div>
      </div>
    );
  }

  if (!joined) {
    return (
      <div className="min-h-screen bg-slate-50 flex items-center justify-center p-4">
        <div className="max-w-md w-full bg-white border border-slate-200 rounded-2xl p-6 sm:p-8 shadow-sm space-y-6">
          <div>
            <div className="text-xs font-semibold text-sky-700">
              SD Negeri Lendang Telaga · {game.mapel} Kelas {game.kelas}
            </div>
            <h1 className="text-2xl font-bold text-slate-900 mt-1">{game.title}</h1>
            <p className="text-sm text-slate-600 mt-1.5">
              Langsung bermain tanpa login. Masukkan atau pilih nama Anda untuk bergabung.
            </p>
          </div>

          {game.players && game.players.length > 0 && (
            <div className="space-y-2">
              <div className="text-xs font-semibold text-slate-600">Pilih Cepat Nama Siswa:</div>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto">
                {game.players.map((p) => (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setStudentName(p)}
                    className={`px-3 py-1.5 text-xs font-semibold rounded-lg border transition-colors ${
                      studentName === p
                        ? 'bg-sky-600 text-white border-sky-600'
                        : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                    }`}
                  >
                    {p}
                  </button>
                ))}
              </div>
            </div>
          )}

          <form onSubmit={handleStart} className="space-y-4">
            <div>
              <label className="block text-sm font-semibold text-slate-800 mb-1.5">
                Nama Kamu
              </label>
              <input
                type="text"
                required
                value={studentName}
                onChange={(e) => setStudentName(e.target.value)}
                placeholder="Ketik nama lengkap atau panggilan..."
                className="w-full min-h-[48px] px-4 py-2 text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-600"
              />
            </div>
            <button
              type="submit"
              disabled={!studentName.trim()}
              className="touch-target w-full px-6 py-3.5 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-base font-bold rounded-xl inline-flex items-center justify-center gap-2 transition-colors"
            >
              <Play className="w-5 h-5" />
              Mulai Bermain
            </button>
          </form>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-3 sm:p-6">
      <div className="max-w-3xl mx-auto space-y-4">
        <div className="bg-white border border-slate-200 rounded-xl px-4 py-2.5 flex items-center justify-between text-xs">
          <div className="font-semibold text-slate-800">
            Pemain: <span className="text-sky-700">{studentName}</span>
          </div>
          {roomCode && (
            <div className="inline-flex items-center gap-1.5 font-mono text-slate-600">
              <Radio
                className={`w-3.5 h-3.5 ${
                  wsConnected
                    ? 'text-emerald-600'
                    : realtimeUnsupported
                    ? 'text-slate-400'
                    : 'text-sky-600'
                }`}
              />
              {realtimeUnsupported ? `Mode Mandiri · Room ${roomCode}` : `Room ${roomCode}`}
            </div>
          )}
        </div>

        {latestResult?.finished && (() => {
          const totalQ = Math.max(1, latestResult.totalQuestions || game.items.length || 1);
          const accuracy = Math.min(100, Math.round((latestResult.correctCount / totalQ) * 100));
          const predikat =
            accuracy >= 85 ? 'Sangat Baik' : accuracy >= 70 ? 'Baik' : 'Perlu Semangat Terus';
          return (
            <div className="bg-white border-2 border-amber-400 rounded-2xl p-6 shadow-md text-center space-y-4">
              <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-amber-50 border border-amber-200 text-amber-600 mx-auto">
                <Award className="w-7 h-7" />
              </div>
              <div className="space-y-1">
                <div className="text-xs font-bold text-amber-700 tracking-wide">
                  SERTIFIKAT HASIL BELAJAR · SD NEGERI LENDANG TELAGA
                </div>
                <h2 className="font-display font-bold text-2xl text-slate-900">
                  {studentName}
                </h2>
                <p className="text-xs text-slate-600">
                  Telah menyelesaikan <strong className="text-slate-800">{game.title}</strong> ({game.mapel} · Kelas {game.kelas})
                </p>
              </div>

              <div className="grid grid-cols-3 gap-2.5 pt-2">
                <div className="bg-sky-50 border border-sky-200 rounded-xl p-3">
                  <div className="text-[11px] font-medium text-slate-500">Skor Akhir</div>
                  <div className="font-mono font-bold text-xl text-sky-700 tabular-nums mt-0.5">
                    {latestResult.score}
                  </div>
                </div>
                <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-3">
                  <div className="text-[11px] font-medium text-slate-500">Akurasi</div>
                  <div className="font-mono font-bold text-xl text-emerald-700 tabular-nums mt-0.5">
                    {accuracy}%
                  </div>
                  <div className="text-[11px] text-slate-500 font-mono">
                    {latestResult.correctCount}/{totalQ} benar
                  </div>
                </div>
                <div className="bg-amber-50 border border-amber-200 rounded-xl p-3">
                  <div className="text-[11px] font-medium text-slate-500">Predikat</div>
                  <div className="font-display font-bold text-sm text-amber-800 mt-1.5">
                    {predikat}
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-500 pt-1">
                Tunjukkan atau tangkap layar (screenshot) kartu hasil ini kepada Bapak/Ibu Guru.
              </div>
            </div>
          );
        })()}

        {game.template === 'running-race' && (
          <RunningRaceGame
            key={`${game.id}_run_${roomSessionKey}`}
            title={game.title}
            items={game.items}
            playerNames={[studentName]}
            mode={roomCode ? 'live-client' : 'single'}
            livePlayers={liveRoom?.players}
            onProgress={handleProgress}
          />
        )}
        {game.template === 'horse-race' && (
          <HorseRaceGame
            key={`${game.id}_horse_${roomSessionKey}`}
            title={game.title}
            items={game.items}
            playerNames={[studentName]}
            mode={roomCode ? 'live-client' : 'single'}
            livePlayers={liveRoom?.players}
            onProgress={handleProgress}
          />
        )}
        {game.template === 'crossword' && (
          <CrosswordGame
            key={`${game.id}_cw_${roomSessionKey}`}
            title={game.title}
            items={game.items}
            onProgress={handleProgress}
          />
        )}
        {game.template === 'word-scramble' && (
          <WordScrambleGame
            key={`${game.id}_ws_${roomSessionKey}`}
            title={game.title}
            items={game.items}
            playerNames={[studentName]}
            mode={roomCode ? 'live-client' : 'single'}
            onProgress={handleProgress}
          />
        )}
      </div>
    </div>
  );
}
