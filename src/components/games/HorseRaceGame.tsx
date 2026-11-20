import { CheckCircle2, Flag, RotateCcw, Volume2, VolumeX, XCircle, Zap } from 'lucide-react';
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { GameQuestionItem, LivePlayerState } from '../../types/portal';
import { soundFX } from '../../utils/audio';
import { HorseRiderSprite } from './RaceSprites';
import { GameProgressUpdate } from './RunningRaceGame';

interface HorseRaceGameProps {
  title: string;
  items: GameQuestionItem[];
  playerNames: string[];
  mode: 'single' | 'pid-multiplayer' | 'live-client';
  livePlayers?: LivePlayerState[];
  onProgress?: (update: GameProgressUpdate) => void;
  onFinish?: () => void;
}

const HORSE_COLORS = ['#b45309', '#0369a1', '#047857', '#be123c', '#6d28d9', '#0f766e'];

export function HorseRaceGame({
  title,
  items,
  playerNames,
  mode,
  livePlayers,
  onProgress,
  onFinish,
}: HorseRaceGameProps) {
  const safePlayers = useMemo(
    () => (playerNames.length > 0 ? playerNames : ['Penunggang 1']),
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
  const [distances, setDistances] = useState<number[]>(() => safePlayers.map(() => 0));
  const [correctCounts, setCorrectCounts] = useState<number[]>(() => safePlayers.map(() => 0));
  const [streaks, setStreaks] = useState<number[]>(() => safePlayers.map(() => 0));
  const [turboBanner, setTurboBanner] = useState(false);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [typedAnswer, setTypedAnswer] = useState('');
  const [finished, setFinished] = useState(false);

  const raceStartRef = useRef(Date.now());
  const questionStartRef = useRef(Date.now());
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
    setDistances(safePlayers.map(() => 0));
    setCorrectCounts(safePlayers.map(() => 0));
    setQuestionIdx(0);
    setActivePlayerIdx(0);
    setStreaks(safePlayers.map(() => 0));
    setTurboBanner(false);
    setFeedback(null);
    setTypedAnswer('');
    setFinished(false);
    raceStartRef.current = Date.now();
    questionStartRef.current = Date.now();
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
    setDistances(safePlayers.map(() => 0));
    setCorrectCounts(safePlayers.map(() => 0));
    setQuestionIdx(0);
    setActivePlayerIdx(0);
    setStreaks(safePlayers.map(() => 0));
    setTurboBanner(false);
    setFeedback(null);
    setTypedAnswer('');
    setFinished(false);
    raceStartRef.current = Date.now();
    questionStartRef.current = Date.now();
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

    const responseMs = Date.now() - questionStartRef.current;
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
    const isFast = responseMs <= 6500;
    const isTurbo = isCorrect && (nextStreak >= 2 || isFast);

    const perPlayerTarget = getPlayerTurnTarget(pIdx);
    const baseStep = 100 / perPlayerTarget;
    const distanceGain = isCorrect ? baseStep * (isTurbo ? 1.2 : 1) : 0;
    const pointsGain = isCorrect ? (isTurbo ? 150 : 100) : 0;

    const nextScores = [...scores];
    nextScores[pIdx] = (nextScores[pIdx] || 0) + pointsGain;

    const nextDistances = [...distances];
    nextDistances[pIdx] = Math.min(100, Math.round((nextDistances[pIdx] || 0) + distanceGain));

    const nextCorrect = [...correctCounts];
    if (isCorrect) nextCorrect[pIdx] = (nextCorrect[pIdx] || 0) + 1;

    const isDone = questionIdx + 1 >= totalRounds;

    setScores(nextScores);
    setDistances(nextDistances);
    setCorrectCounts(nextCorrect);
    setStreaks(nextStreaks);
    setTypedAnswer('');

    if (isCorrect) {
      soundFX.playGallop();
      if (isTurbo) {
        soundFX.playBoost();
        setTurboBanner(true);
        setFeedback({
          ok: true,
          text: `Pacu Cepat! Kuda melesat (+${pointsGain} poin)`,
        });
      } else {
        soundFX.playCorrect();
        setTurboBanner(false);
        setFeedback({ ok: true, text: `Tepat! Kuda melaju (+${pointsGain} poin)` });
      }
    } else {
      soundFX.playWrong();
      setTurboBanner(false);
      setFeedback({ ok: false, text: `Belum tepat. Jawaban: ${currentItem.answer}` });
    }

    onProgress?.({
      score: nextScores[0] || 0,
      correctCount: nextCorrect[0] || 0,
      answeredCount: questionIdx + 1,
      totalQuestions: totalRounds,
      progress: nextDistances[0] || 0,
      streak: nextStreak,
      turboActive: isTurbo,
      finished: isDone,
      finishTimeMs: isDone ? Date.now() - raceStartRef.current : null,
    });

    clearPendingTimer();
    timerRef.current = window.setTimeout(() => {
      timerRef.current = null;
      submittingRef.current = false;
      setFeedback(null);
      setTurboBanner(false);
      if (isDone) {
        setFinished(true);
        soundFX.playVictory();
        onFinish?.();
      } else {
        setQuestionIdx((prev) => prev + 1);
        questionStartRef.current = Date.now();
        if (mode === 'pid-multiplayer') {
          setActivePlayerIdx((prev) => (prev + 1) % safePlayers.length);
        }
      }
    }, 1000);
  };

  const trackEntries = useMemo(() => {
    if (mode === 'live-client' && livePlayers && livePlayers.length > 0) {
      return livePlayers.map((lp, idx) => ({
        name: lp.name,
        score: lp.score,
        pct: lp.progress,
        turbo: lp.turboActive,
        finished: lp.finished,
        color: HORSE_COLORS[idx % HORSE_COLORS.length],
      }));
    }
    return safePlayers.map((name, idx) => ({
      name,
      score: scores[idx] || 0,
      pct: distances[idx] || 0,
      turbo: turboBanner && (mode === 'pid-multiplayer' ? idx === activePlayerIdx : idx === 0),
      finished,
      color: HORSE_COLORS[idx % HORSE_COLORS.length],
    }));
  }, [activePlayerIdx, distances, finished, livePlayers, mode, safePlayers, scores, turboBanner]);

  if (totalRounds === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-600">
        Belum ada soal valid untuk game Lomba Pacuan Kuda. Tambahkan minimal 1 soal beserta jawaban di editor game.
      </div>
    );
  }

  const validOptions = currentItem
    ? (currentItem.options || []).map((o) => o.trim()).filter(Boolean)
    : [];

  const activePlayerStreak = streaks[mode === 'pid-multiplayer' ? activePlayerIdx : 0] || 0;

  return (
    <div className="space-y-5">
      {/* HUD */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-amber-950 text-white px-5 py-3.5 rounded-2xl">
        <div>
          <div className="text-xs text-amber-300 font-medium">
            Lomba Pacuan Kuda Evaluasi · Urutan Soal Seragam Untuk Semua Siswa
          </div>
          <div className="font-display font-bold text-lg">{title}</div>
        </div>

        <div className="flex flex-wrap items-center gap-3">
          {validItems.length > 20 && questionIdx === 0 && !finished && !feedback && (
            <select
              aria-label="Jumlah Ronde Evaluasi"
              value={String(raceLengthChoice)}
              onChange={(e) => {
                const v = e.target.value;
                setRaceLengthChoice(
                  v === 'auto' || v === 'all' ? v : (Number(v) as 10 | 15 | 20)
                );
              }}
              className="min-h-[38px] px-2.5 py-1.5 bg-amber-900 border border-amber-700 text-amber-100 text-xs font-semibold rounded-xl"
            >
              <option value="auto">Target Standar ({totalRounds} Ronde)</option>
              <option value="10">10 Ronde Cepat</option>
              <option value="15">15 Ronde</option>
              <option value="20">20 Ronde</option>
              <option value="all">Semua ({validItems.length} Soal)</option>
            </select>
          )}
          {activePlayerStreak >= 2 && (
            <div className="px-3 py-1 bg-amber-500 text-slate-950 rounded-lg text-xs font-bold inline-flex items-center gap-1">
              <Zap className="w-3.5 h-3.5" />
              Pacu Cepat x{activePlayerStreak}
            </div>
          )}
          <div className="text-right text-xs font-mono tabular-nums">
            <div className="text-amber-200">
              Ronde {Math.min(questionIdx + 1, totalRounds)} / {totalRounds} (Bank {validItems.length})
            </div>
            <div className="text-white font-semibold">
              Skor: {scores[mode === 'pid-multiplayer' ? activePlayerIdx : 0] || 0}
            </div>
          </div>
          <button
            type="button"
            onClick={toggleMute}
            className="touch-target p-2.5 rounded-xl bg-amber-900 hover:bg-amber-800 text-amber-100 transition-colors"
            title={muted ? 'Aktifkan Suara' : 'Matikan Suara'}
          >
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="touch-target p-2.5 rounded-xl bg-amber-900 hover:bg-amber-800 text-amber-100 transition-colors"
            title="Ulangi Balapan"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Turf Race Track */}
      <div className="bg-lime-950 rounded-2xl p-4 sm:p-5 border border-lime-800 space-y-2.5 overflow-hidden">
        <div className="flex items-center justify-between text-xs text-lime-100 font-semibold pb-1">
          <span>GERBANG START</span>
          <span className="inline-flex items-center gap-1">
            <Flag className="w-3.5 h-3.5" /> GARIS FINIS
          </span>
        </div>

        <div className="space-y-2.5 max-h-[430px] overflow-y-auto pr-1">
          {trackEntries.map((lane, idx) => (
            <div
              key={`${lane.name}_${idx}`}
              className="relative h-18 bg-lime-900/90 rounded-xl border border-lime-700 flex items-center px-3 overflow-hidden shrink-0"
            >
              <div className="absolute inset-x-4 bottom-2 border-t border-dashed border-lime-400/35 pointer-events-none" />
              <div className="absolute right-2.5 top-1 bottom-1 w-2.5 bg-white/85 rounded-sm" />

              <div
                className="relative z-10 w-full transition-transform duration-500 ease-out"
                style={{ transform: `translateX(${Math.min(lane.pct, 100) * 0.7}%)` }}
              >
                <div className="inline-flex items-center gap-2">
                  <HorseRiderSprite
                    jerseyColor={lane.color}
                    laneNumber={idx + 1}
                    turbo={lane.turbo}
                    paused={finished || lane.finished}
                  />
                  <div className="flex items-center gap-1.5 bg-black/55 px-2.5 py-1 rounded-md whitespace-nowrap">
                    <span className="text-xs font-bold text-white">
                      {lane.name} ({lane.score})
                    </span>
                    {lane.turbo && <Zap className="w-3.5 h-3.5 text-amber-300" />}
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>

      {finished ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4">
          <div className="text-xs font-semibold text-amber-700 uppercase tracking-wider">
            Evaluasi Pacuan Kuda Selesai
          </div>
          <h3 className="text-2xl font-bold text-slate-900">
            Peringkat Tertinggi: {[...trackEntries].sort((a, b) => b.score - a.score)[0]?.name}
          </h3>
          <div className="max-w-md mx-auto divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden text-sm">
            {[...trackEntries]
              .sort((a, b) => b.score - a.score)
              .map((p, rank) => (
                <div key={`${p.name}_${rank}`} className="flex items-center justify-between px-4 py-2.5 bg-white">
                  <span className="font-semibold text-slate-800">
                    #{rank + 1} {p.name}
                  </span>
                  <span className="font-mono font-bold text-amber-700 tabular-nums">{p.score} poin</span>
                </div>
              ))}
          </div>
          <button
            type="button"
            onClick={handleReset}
            className="touch-target px-6 py-3 bg-amber-600 hover:bg-amber-700 text-white text-sm font-semibold rounded-xl transition-colors"
          >
            Balapan Lagi
          </button>
        </div>
      ) : (
        currentItem && (
          <div className="bg-white border border-slate-200 rounded-2xl p-6 space-y-5">
            {mode === 'pid-multiplayer' && (
              <div className="text-sm font-semibold text-amber-700">
                Giliran Penunggang: {safePlayers[activePlayerIdx]}
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
                    className="touch-target text-left px-5 py-4 bg-slate-50 hover:bg-amber-50 border border-slate-300 hover:border-amber-500 rounded-xl text-base font-semibold text-slate-900 transition-colors flex items-center gap-3 disabled:opacity-60"
                  >
                    <span className="w-8 h-8 rounded-lg bg-white border border-slate-300 flex items-center justify-center font-mono text-sm font-bold text-amber-700 shrink-0">
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
                  placeholder="Ketik jawaban..."
                  className="flex-1 min-h-[48px] px-4 py-2 text-base border border-slate-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-amber-600"
                />
                <button
                  type="submit"
                  disabled={!!feedback || !typedAnswer.trim()}
                  className="touch-target px-6 py-3 bg-amber-600 hover:bg-amber-700 disabled:opacity-50 text-white text-sm font-semibold rounded-xl"
                >
                  Pacu Kuda!
                </button>
              </form>
            )}
          </div>
        )
      )}
    </div>
  );
}
