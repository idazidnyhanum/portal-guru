import { CheckCircle2, Flag, RotateCcw, Volume2, VolumeX, XCircle } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameQuestionItem, LivePlayerState } from '../../types/portal';
import { soundFX } from '../../utils/audio';
import { RunnerSprite } from './RaceSprites';

export interface GameProgressUpdate {
  score: number;
  correctCount: number;
  answeredCount: number;
  totalQuestions: number;
  progress: number;
  streak: number;
  turboActive: boolean;
  finished: boolean;
  finishTimeMs: number | null;
}

interface RunningRaceGameProps {
  title: string;
  items: GameQuestionItem[];
  playerNames: string[];
  mode: 'single' | 'pid-multiplayer' | 'live-client';
  livePlayers?: LivePlayerState[];
  onProgress?: (update: GameProgressUpdate) => void;
  onFinish?: () => void;
}

const LANE_COLORS = ['#0284c7', '#059669', '#d97706', '#e11d48', '#7c3aed', '#0d9488'];

export function RunningRaceGame({
  title,
  items,
  playerNames,
  mode,
  livePlayers,
  onProgress,
  onFinish,
}: RunningRaceGameProps) {
  const safePlayers = useMemo(
    () => (playerNames.length > 0 ? playerNames : ['Pemain 1']),
    [playerNames]
  );
  const validItems = useMemo(
    () => items.filter((it) => it.prompt.trim() && it.answer.trim()),
    [items]
  );

  // Uniform fixed sequence for evaluation: every student sees the exact same questions in order
  const buildQueue = useCallback((): GameQuestionItem[] => {
    if (validItems.length === 0) return [];
    const basePool = [...validItems];
    if (mode !== 'pid-multiplayer') return basePool;

    if (basePool.length < safePlayers.length) {
      const turnsPerPlayer = Math.max(1, Math.ceil(basePool.length / safePlayers.length));
      const total = turnsPerPlayer * safePlayers.length;
      return Array.from({ length: total }, (_, idx) => basePool[idx % basePool.length]);
    }
    return basePool;
  }, [mode, safePlayers.length, validItems]);

  const itemsKey = `${validItems.map((i) => i.id).join('|')}::${safePlayers.join('|')}::${mode}`;

  const [muted, setMuted] = useState(soundFX.isMuted());
  const [raceLengthChoice, setRaceLengthChoice] = useState<'auto' | 10 | 15 | 20 | 'all'>('auto');
  const [questionQueue, setQuestionQueue] = useState<GameQuestionItem[]>(() => buildQueue());
  const [questionIdx, setQuestionIdx] = useState(0);
  const [activePlayerIdx, setActivePlayerIdx] = useState(0);
  const [scores, setScores] = useState<number[]>(() => safePlayers.map(() => 0));
  const [correctCounts, setCorrectCounts] = useState<number[]>(() => safePlayers.map(() => 0));
  const [answeredCount, setAnsweredCount] = useState(0);
  const [streaks, setStreaks] = useState<number[]>(() => safePlayers.map(() => 0));
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [finished, setFinished] = useState(false);

  const startTimeRef = useRef(Date.now());
  const timerRef = useRef<number | null>(null);
  const submittingRef = useRef(false);

  const totalRounds = useMemo(() => {
    const poolLen = questionQueue.length;
    if (poolLen === 0) return 0;
    if (raceLengthChoice === 'all' || poolLen <= 20) return poolLen;
    if (typeof raceLengthChoice === 'number') {
      if (mode === 'pid-multiplayer') {
        const perPlayer = Math.max(1, Math.round(raceLengthChoice / safePlayers.length));
        return Math.min(poolLen, perPlayer * safePlayers.length);
      }
      return Math.min(poolLen, raceLengthChoice);
    }
    if (mode === 'pid-multiplayer') {
      const target = Math.max(12, safePlayers.length * 3);
      return Math.min(poolLen, Math.ceil(target / safePlayers.length) * safePlayers.length);
    }
    return Math.min(poolLen, 15);
  }, [mode, questionQueue.length, raceLengthChoice, safePlayers.length]);

  const currentItem = questionQueue[questionIdx];

  const clearPendingTimer = () => {
    if (timerRef.current !== null) {
      window.clearTimeout(timerRef.current);
      timerRef.current = null;
    }
  };

  useEffect(() => {
    clearPendingTimer();
    submittingRef.current = false;
    setQuestionQueue(buildQueue());
    setScores(safePlayers.map(() => 0));
    setCorrectCounts(safePlayers.map(() => 0));
    setQuestionIdx(0);
    setActivePlayerIdx(0);
    setAnsweredCount(0);
    setStreaks(safePlayers.map(() => 0));
    setFeedback(null);
    setTypedAnswer('');
    setFinished(false);
    startTimeRef.current = Date.now();
    return () => clearPendingTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);

  const toggleMute = () => {
    const next = !muted;
    soundFX.setMuted(next);
    setMuted(next);
  };

  const handleReset = () => {
    clearPendingTimer();
    submittingRef.current = false;
    soundFX.playTap();
    const freshQueue = buildQueue();
    setQuestionQueue(freshQueue);
    setScores(safePlayers.map(() => 0));
    setCorrectCounts(safePlayers.map(() => 0));
    setQuestionIdx(0);
    setActivePlayerIdx(0);
    setAnsweredCount(0);
    setStreaks(safePlayers.map(() => 0));
    setFeedback(null);
    setTypedAnswer('');
    setFinished(false);
    startTimeRef.current = Date.now();
    onProgress?.({
      score: 0,
      correctCount: 0,
      answeredCount: 0,
      totalQuestions: totalRounds || freshQueue.length,
      progress: 0,
      streak: 0,
      turboActive: false,
      finished: false,
      finishTimeMs: null,
    });
  };

  const getPlayerTurnTarget = useCallback(
    (playerIndex: number) => {
      if (mode !== 'pid-multiplayer') return Math.max(1, totalRounds);
      const base = Math.floor(totalRounds / safePlayers.length);
      const rem = totalRounds % safePlayers.length;
      return Math.max(1, base + (playerIndex < rem ? 1 : 0));
    },
    [mode, safePlayers.length, totalRounds]
  );

  const submitAnswer = (chosen: string) => {
    if (finished || !currentItem || feedback || submittingRef.current) return;
    submittingRef.current = true;

    const cleanOpts = (currentItem.options || []).map((o) => o.trim()).filter(Boolean);
    const lowerOpts = cleanOpts.map((o) => o.toLowerCase());
    const caseSensitive = new Set(lowerOpts).size !== lowerOpts.length;
    const isCorrect = caseSensitive
      ? chosen.trim() === currentItem.answer.trim()
      : chosen.trim().toLowerCase() === currentItem.answer.trim().toLowerCase();

    const pIdx = mode === 'pid-multiplayer' ? activePlayerIdx : 0;
    const nextStreak = isCorrect ? (streaks[pIdx] || 0) + 1 : 0;
    const nextStreaks = [...streaks];
    nextStreaks[pIdx] = nextStreak;
    const pointsEarned = isCorrect ? 100 + Math.min(nextStreak - 1, 3) * 20 : 0;

    const nextScores = [...scores];
    nextScores[pIdx] = (nextScores[pIdx] || 0) + pointsEarned;
    const nextCorrect = [...correctCounts];
    if (isCorrect) nextCorrect[pIdx] = (nextCorrect[pIdx] || 0) + 1;

    const nextAnswered = answeredCount + 1;
    const isDone = questionIdx + 1 >= totalRounds;

    setScores(nextScores);
    setCorrectCounts(nextCorrect);
    setStreaks(nextStreaks);
    setAnsweredCount(nextAnswered);
    setTypedAnswer('');

    if (isCorrect) {
      soundFX.playCorrect();
      setFeedback({ ok: true, text: `Benar! Pelari melaju (+${pointsEarned} poin)` });
    } else {
      soundFX.playWrong();
      setFeedback({ ok: false, text: `Kurang tepat. Jawaban: ${currentItem.answer}` });
    }

    const totalForPlayer0 = getPlayerTurnTarget(0);
    const pct = Math.min(100, Math.round(((nextCorrect[0] || 0) / totalForPlayer0) * 100));
    const elapsed = isDone ? Date.now() - startTimeRef.current : null;

    onProgress?.({
      score: nextScores[0] || 0,
      correctCount: nextCorrect[0] || 0,
      answeredCount: nextAnswered,
      totalQuestions: totalRounds,
      progress: pct,
      streak: nextStreak,
      turboActive: nextStreak >= 2,
      finished: isDone,
      finishTimeMs: elapsed,
    });

    clearPendingTimer();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      submittingRef.current = false;
      setFeedback(null);
      if (isDone) {
        setFinished(true);
        soundFX.playVictory();
        onFinish?.();
      } else {
        setQuestionIdx((prev) => prev + 1);
        if (mode === 'pid-multiplayer') {
          setActivePlayerIdx((prev) => (prev + 1) % safePlayers.length);
        }
      }
    }, 950);
  };

  const trackEntries = useMemo(() => {
    if (mode === 'live-client' && livePlayers && livePlayers.length > 0) {
      return livePlayers.map((lp, idx) => ({
        name: lp.name,
        score: lp.score,
        pct: lp.progress,
        finished: lp.finished,
        color: LANE_COLORS[idx % LANE_COLORS.length],
      }));
    }
    return safePlayers.map((name, idx) => {
      const perPlayerTarget = getPlayerTurnTarget(idx);
      return {
        name,
        score: scores[idx] || 0,
        pct: Math.min(100, Math.round(((correctCounts[idx] || 0) / perPlayerTarget) * 100)),
        finished,
        color: LANE_COLORS[idx % LANE_COLORS.length],
      };
    });
  }, [correctCounts, finished, getPlayerTurnTarget, livePlayers, mode, safePlayers, scores]);

  if (totalRounds === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-600">
        Belum ada soal valid untuk game Lomba Lari. Tambahkan minimal 1 soal beserta jawaban di editor game.
      </div>
    );
  }

  const validOptions = currentItem
    ? (currentItem.options || []).map((o) => o.trim()).filter(Boolean)
    : [];

  return (
    <div className="space-y-5">
      {/* Top HUD */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-slate-900 text-white px-5 py-3.5 rounded-2xl">
        <div>
          <div className="text-xs text-sky-300 font-medium">
            Lomba Lari Evaluasi · Urutan Soal Seragam Untuk Semua Siswa
          </div>
          <div className="font-display font-bold text-lg">{title}</div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {validItems.length > 20 && questionIdx === 0 && !finished && !feedback && (
            <select
              aria-label="Jumlah Soal Evaluasi"
              value={String(raceLengthChoice)}
              onChange={(e) => {
                const v = e.target.value;
                setRaceLengthChoice(
                  v === 'auto' || v === 'all' ? v : (Number(v) as 10 | 15 | 20)
                );
              }}
              className="min-h-[38px] px-2.5 py-1.5 bg-slate-800 border border-slate-700 text-slate-100 text-xs font-semibold rounded-xl"
            >
              <option value="auto">Target Standar ({totalRounds} Soal)</option>
              <option value="10">10 Soal Cepat</option>
              <option value="15">15 Soal</option>
              <option value="20">20 Soal</option>
              <option value="all">Semua ({validItems.length} Soal)</option>
            </select>
          )}
          <div className="text-right text-xs font-mono tabular-nums">
            <div className="text-slate-300">
              Soal {Math.min(questionIdx + 1, totalRounds)} / {totalRounds} (Bank {validItems.length})
            </div>
            <div className="text-emerald-400 font-semibold">
              Skor: {scores[mode === 'pid-multiplayer' ? activePlayerIdx : 0] || 0}
            </div>
          </div>
          <button
            type="button"
            onClick={toggleMute}
            className="touch-target p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            title={muted ? 'Aktifkan Suara' : 'Matikan Suara'}
          >
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="touch-target p-2.5 rounded-xl bg-slate-800 hover:bg-slate-700 text-slate-200 transition-colors"
            title="Ulangi Game"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Athletic Running Track */}
      <div className="bg-emerald-950 rounded-2xl p-4 sm:p-5 border border-emerald-800 space-y-2.5 overflow-hidden">
        <div className="flex items-center justify-between text-xs text-emerald-100 font-semibold pb-1">
          <span>GARIS START</span>
          <span className="inline-flex items-center gap-1">
            <Flag className="w-3.5 h-3.5" /> FINIS
          </span>
        </div>

        <div className="space-y-2.5 max-h-[430px] overflow-y-auto pr-1">
          {trackEntries.map((lane, idx) => (
            <div
              key={`${lane.name}_${idx}`}
              className="relative h-16 bg-emerald-900/90 rounded-xl border border-emerald-700/70 flex items-center px-3 overflow-hidden shrink-0"
            >
              <div className="absolute inset-x-4 top-1/2 border-t border-dashed border-emerald-500/35 pointer-events-none" />
              <div className="absolute right-2.5 top-1 bottom-1 w-2.5 bg-amber-300/90 rounded-sm" />

              <div
                className="relative z-10 w-full transition-transform duration-500 ease-out"
                style={{ transform: `translateX(${Math.min(lane.pct, 100) * 0.72}%)` }}
              >
                <div className="inline-flex items-center gap-2">
                  <RunnerSprite
                    color={lane.color}
                    laneNumber={idx + 1}
                    paused={finished || lane.finished}
                  />
                  <span className="text-xs font-bold text-white bg-black/50 px-2.5 py-1 rounded-md whitespace-nowrap">
                    {lane.name} ({lane.score})
                  </span>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Question or Victory Area */}
      {finished ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4">
          <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
            Evaluasi Selesai
          </div>
          <h3 className="text-2xl font-bold text-slate-900">
            Peringkat Tertinggi:{' '}
            {[...trackEntries].sort((a, b) => b.score - a.score)[0]?.name}
          </h3>
          <div className="max-w-md mx-auto divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden text-sm">
            {[...trackEntries]
              .sort((a, b) => b.score - a.score)
              .map((p, rank) => (
                <div key={`${p.name}_${rank}`} className="flex items-center justify-between px-4 py-2.5 bg-white">
                  <span className="font-semibold text-slate-800">
                    #{rank + 1} {p.name}
                  </span>
                  <span className="font-mono font-bold text-sky-700 tabular-nums">{p.score} poin</span>
                </div>
              ))}
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="touch-target px-6 py-3 bg-sky-600 hover:bg-sky-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Main Lagi
          </button>
        </div>
      ) : (
        currentItem && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            {mode === 'pid-multiplayer' && (
              <div className="text-sm font-semibold text-sky-700">
                Giliran Menjawab: {safePlayers[activePlayerIdx]}
              </div>
            )}

            <div className="text-lg sm:text-xl font-bold text-slate-900 leading-snug">
              {currentItem.prompt}
            </div>

            {feedback && (
              <div
                className={`px-4 py-3 rounded-xl text-sm font-semibold flex items-center gap-2 ${
                  feedback.ok
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-800'
                }`}
              >
                {feedback.ok ? (
                  <CheckCircle2 className="w-5 h-5 shrink-0" />
                ) : (
                  <XCircle className="w-5 h-5 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
            )}

            {validOptions.length > 0 ? (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {validOptions.map((opt, idx) => (
                  <button
                    key={`${opt}_${idx}`}
                    type="button"
                    disabled={!!feedback}
                    onClick={() => submitAnswer(opt)}
                    className="touch-target text-left px-5 py-4 bg-slate-50 hover:bg-sky-50 border border-slate-300 hover:border-sky-500 rounded-xl text-base font-semibold text-slate-900 transition-colors flex items-center gap-3 disabled:opacity-60"
                  >
                    <span className="w-8 h-8 rounded-lg bg-white border border-slate-300 flex items-center justify-center font-mono text-sm font-bold text-sky-700 shrink-0">
                      {String.fromCharCode(65 + idx)}
                    </span>
                    <span>{opt}</span>
                  </button>
                ))}
              </div>
            ) : (
              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  if (typedAnswer.trim()) submitAnswer(typedAnswer);
                }}
                className="flex flex-col sm:flex-row gap-3"
              >
                <input
                  type="text"
                  value={typedAnswer}
                  onChange={(e) => setTypedAnswer(e.target.value)}
                  placeholder="Ketik jawaban Anda di sini..."
                  className="flex-1 min-h-[48px] px-4 py-2 text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-sky-600"
                />
                <button
                  type="submit"
                  disabled={!!feedback || !typedAnswer.trim()}
                  className="touch-target px-6 py-3 bg-sky-600 hover:bg-sky-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl"
                >
                  Kirim &amp; Lari!
                </button>
              </form>
            )}
          </div>
        )
      )}
    </div>
  );
}
