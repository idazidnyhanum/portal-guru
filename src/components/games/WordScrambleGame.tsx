import {
  CheckCircle2,
  ChevronLeft,
  ChevronRight,
  HelpCircle,
  RotateCcw,
  Shuffle,
  Volume2,
  VolumeX,
  XCircle,
} from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GameQuestionItem } from '../../types/portal';
import { soundFX } from '../../utils/audio';
import { normalizeWord } from '../../utils/crossword';
import { generateWordSearchPuzzle, WordSearchPlacedWord } from '../../utils/wordSearch';
import { GameProgressUpdate } from './RunningRaceGame';

interface WordScrambleGameProps {
  title: string;
  items: GameQuestionItem[];
  playerNames: string[];
  mode: 'single' | 'pid-multiplayer' | 'live-client';
  onProgress?: (update: GameProgressUpdate) => void;
  onFinish?: () => void;
}

interface Coord {
  row: number;
  col: number;
}

const BOARD_SIZE = 10;

const FOUND_HIGHLIGHT_CLASSES = [
  'bg-emerald-500 text-white border-emerald-600',
  'bg-sky-500 text-white border-sky-600',
  'bg-amber-500 text-white border-amber-600',
  'bg-violet-500 text-white border-violet-600',
  'bg-rose-500 text-white border-rose-600',
  'bg-teal-500 text-white border-teal-600',
];

function buildStraightSelection(start: Coord, end: Coord): Coord[] {
  const dr = end.row - start.row;
  const dc = end.col - start.col;

  // Strictly ke samping kanan (dc >= 0, dr === 0) or turun ke bawah (dr >= 0, dc === 0)
  if (dc >= dr && dc >= 0) {
    return Array.from({ length: dc + 1 }, (_, i) => ({ row: start.row, col: start.col + i }));
  }
  if (dr > dc && dr >= 0) {
    return Array.from({ length: dr + 1 }, (_, i) => ({ row: start.row + i, col: start.col }));
  }
  return [start];
}

export function WordScrambleGame({
  title,
  items,
  playerNames,
  mode,
  onProgress,
  onFinish,
}: WordScrambleGameProps) {
  const safePlayers = useMemo(
    () => (playerNames.length > 0 ? playerNames : ['Pemain 1']),
    [playerNames]
  );

  const validEntries = useMemo(
    () =>
      items
        .filter((it) => it.prompt.trim() && normalizeWord(it.answer).length >= 2)
        .map((it) => ({
          id: it.id,
          word: it.answer,
          prompt: it.prompt,
          clue: it.clue,
        })),
    [items]
  );

  const [boardPage, setBoardPage] = useState(0);
  const totalBoards = Math.max(1, Math.ceil(validEntries.length / BOARD_SIZE));
  const safeBoardPage = Math.min(boardPage, totalBoards - 1);

  const boardEntries = useMemo(() => {
    if (validEntries.length <= BOARD_SIZE) return validEntries;
    const start = safeBoardPage * BOARD_SIZE;
    return validEntries.slice(start, start + BOARD_SIZE);
  }, [safeBoardPage, validEntries]);

  const validItemsSignature = validEntries.map((i) => `${i.id}:${i.word}`).join('|');
  const itemsKey = `${validItemsSignature}::${safePlayers.join('|')}::${mode}::${safeBoardPage}`;

  const [muted, setMuted] = useState(soundFX.isMuted());
  const [shuffleSeed, setShuffleSeed] = useState(0);
  const puzzle = useMemo(
    () => generateWordSearchPuzzle(boardEntries),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [itemsKey, shuffleSeed]
  );

  const [foundIds, setFoundIds] = useState<string[]>([]);
  const [activePlayerIdx, setActivePlayerIdx] = useState(0);
  const [scores, setScores] = useState<number[]>(() => safePlayers.map(() => 0));
  const [streaks, setStreaks] = useState<number[]>(() => safePlayers.map(() => 0));
  const [hintCell, setHintCell] = useState<Coord | null>(null);
  const [feedback, setFeedback] = useState<{ ok: boolean; text: string } | null>(null);
  const [finished, setFinished] = useState(false);

  const [tapStart, setTapStart] = useState<Coord | null>(null);
  const [dragStart, setDragStart] = useState<Coord | null>(null);
  const [dragEnd, setDragEnd] = useState<Coord | null>(null);

  const startTimeRef = useRef(Date.now());
  const feedbackTimerRef = useRef<number | null>(null);

  const clearFeedbackTimer = () => {
    if (feedbackTimerRef.current !== null) {
      window.clearTimeout(feedbackTimerRef.current);
      feedbackTimerRef.current = null;
    }
  };

  useEffect(() => {
    setBoardPage(0);
  }, [validItemsSignature]);

  useEffect(() => {
    clearFeedbackTimer();
    setFoundIds([]);
    setActivePlayerIdx(0);
    setScores(safePlayers.map(() => 0));
    setStreaks(safePlayers.map(() => 0));
    setHintCell(null);
    setFeedback(null);
    setFinished(false);
    setTapStart(null);
    setDragStart(null);
    setDragEnd(null);
    startTimeRef.current = Date.now();
    return () => clearFeedbackTimer();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);

  const foundCellClassMap = useMemo(() => {
    const map = new Map<string, string>();
    puzzle.placedWords.forEach((pw, wIdx) => {
      if (!foundIds.includes(pw.id)) return;
      const cls = FOUND_HIGHLIGHT_CLASSES[wIdx % FOUND_HIGHLIGHT_CLASSES.length];
      for (const c of pw.cells) {
        map.set(`${c.row},${c.col}`, cls);
      }
    });
    return map;
  }, [foundIds, puzzle.placedWords]);

  const activePreviewCells = useMemo(() => {
    const set = new Set<string>();
    if (dragStart && dragEnd) {
      for (const c of buildStraightSelection(dragStart, dragEnd)) {
        set.add(`${c.row},${c.col}`);
      }
    } else if (tapStart) {
      set.add(`${tapStart.row},${tapStart.col}`);
    }
    return set;
  }, [dragEnd, dragStart, tapStart]);

  const showTempFeedback = (ok: boolean, text: string) => {
    clearFeedbackTimer();
    setFeedback({ ok, text });
    feedbackTimerRef.current = window.setTimeout(() => {
      setFeedback(null);
      feedbackTimerRef.current = null;
    }, 1600);
  };

  const evaluateSelection = (start: Coord, end: Coord) => {
    if (finished) return;
    const coords = buildStraightSelection(start, end);
    if (coords.length < 2) return;

    const snappedEnd = coords[coords.length - 1];
    const selectedText = coords.map((c) => puzzle.grid[c.row]?.[c.col] || '').join('');
    const isHorizontal = snappedEnd.row === start.row && snappedEnd.col > start.col;
    const isVertical = snappedEnd.col === start.col && snappedEnd.row > start.row;
    if (!isHorizontal && !isVertical) return;

    const direction: 'right' | 'down' = isHorizontal ? 'right' : 'down';
    const candidates = puzzle.placedWords.filter(
      (pw) =>
        !foundIds.includes(pw.id) &&
        pw.word === selectedText &&
        pw.direction === direction
    );
    const matched: WordSearchPlacedWord | undefined =
      candidates.find((pw) => pw.row === start.row && pw.col === start.col) ||
      candidates[0];

    const pIdx = mode === 'pid-multiplayer' ? activePlayerIdx : 0;

    if (!matched) {
      soundFX.playWrong();
      setStreaks((prev) => {
        const next = [...prev];
        next[pIdx] = 0;
        return next;
      });
      showTempFeedback(false, `"${selectedText}" bukan jawaban yang dicari. Coba arah kanan atau bawah!`);
      return;
    }

    const nextFound = [...foundIds, matched.id];
    const nextStreak = (streaks[pIdx] || 0) + 1;
    const nextStreaks = [...streaks];
    nextStreaks[pIdx] = nextStreak;
    const gained = 100 + Math.min(nextStreak - 1, 3) * 20;

    const nextScores = [...scores];
    nextScores[pIdx] = (nextScores[pIdx] || 0) + gained;

    const totalWords = Math.max(1, puzzle.placedWords.length);
    const isDone = nextFound.length >= totalWords;
    const pct = Math.min(100, Math.round((nextFound.length / totalWords) * 100));

    setFoundIds(nextFound);
    setScores(nextScores);
    setStreaks(nextStreaks);
    setHintCell(null);

    soundFX.playCorrect();
    showTempFeedback(true, `Ketemu! "${matched.word}" (+${gained} poin)`);

    onProgress?.({
      score: nextScores[0] || 0,
      correctCount: nextFound.length,
      answeredCount: nextFound.length,
      totalQuestions: totalWords,
      progress: pct,
      streak: nextStreak,
      turboActive: nextStreak >= 2,
      finished: isDone,
      finishTimeMs: isDone ? Date.now() - startTimeRef.current : null,
    });

    if (isDone) {
      setFinished(true);
      soundFX.playVictory();
      onFinish?.();
    } else if (mode === 'pid-multiplayer') {
      setActivePlayerIdx((p) => (p + 1) % safePlayers.length);
    }
  };

  const handleCellPointerDown = (row: number, col: number) => {
    if (finished) return;
    soundFX.playTap();
    setDragStart({ row, col });
    setDragEnd({ row, col });
  };

  const handleGridPointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (!dragStart || finished) return;
    const el = document.elementFromPoint(e.clientX, e.clientY);
    const cellEl = el?.closest('[data-ws-cell]') as HTMLElement | null;
    if (!cellEl) return;
    const r = Number(cellEl.dataset.row);
    const c = Number(cellEl.dataset.col);
    if (!Number.isNaN(r) && !Number.isNaN(c)) {
      setDragEnd({ row: r, col: c });
    }
  };

  const handleGridPointerUp = () => {
    if (!dragStart || !dragEnd || finished) {
      setDragStart(null);
      setDragEnd(null);
      return;
    }

    const draggedMultiple = dragStart.row !== dragEnd.row || dragStart.col !== dragEnd.col;
    if (draggedMultiple) {
      evaluateSelection(dragStart, dragEnd);
      setTapStart(null);
    } else {
      const clicked = dragStart;
      if (!tapStart) {
        setTapStart(clicked);
      } else if (tapStart.row === clicked.row && tapStart.col === clicked.col) {
        setTapStart(null);
      } else if (
        (clicked.row === tapStart.row && clicked.col > tapStart.col) ||
        (clicked.col === tapStart.col && clicked.row > tapStart.row)
      ) {
        evaluateSelection(tapStart, clicked);
        setTapStart(null);
      } else {
        setTapStart(clicked);
      }
    }

    setDragStart(null);
    setDragEnd(null);
  };

  const pointerUpRef = useRef(handleGridPointerUp);
  pointerUpRef.current = handleGridPointerUp;

  useEffect(() => {
    if (!dragStart) return;
    const onGlobalPointerUp = () => pointerUpRef.current();
    const onGlobalPointerCancel = () => {
      setDragStart(null);
      setDragEnd(null);
    };
    window.addEventListener('pointerup', onGlobalPointerUp);
    window.addEventListener('pointercancel', onGlobalPointerCancel);
    return () => {
      window.removeEventListener('pointerup', onGlobalPointerUp);
      window.removeEventListener('pointercancel', onGlobalPointerCancel);
    };
  }, [dragStart]);

  const handleHint = () => {
    const remaining = puzzle.placedWords.find((pw) => !foundIds.includes(pw.id));
    if (!remaining) return;
    soundFX.playTap();
    setHintCell({ row: remaining.row, col: remaining.col });
    showTempFeedback(
      true,
      `Petunjuk No. ${remaining.index}: Cari mulai dari kotak berkedip (${
        remaining.direction === 'right' ? 'ke samping kanan →' : 'turun ke bawah ↓'
      }).`
    );
  };

  const handleReshuffleBoard = () => {
    clearFeedbackTimer();
    soundFX.playTap();
    setShuffleSeed((s) => s + 1);
    setFoundIds([]);
    setActivePlayerIdx(0);
    setScores(safePlayers.map(() => 0));
    setStreaks(safePlayers.map(() => 0));
    setHintCell(null);
    setFeedback(null);
    setFinished(false);
    setTapStart(null);
    setDragStart(null);
    setDragEnd(null);
    startTimeRef.current = Date.now();
    onProgress?.({
      score: 0,
      correctCount: 0,
      answeredCount: 0,
      totalQuestions: Math.max(1, puzzle.placedWords.length),
      progress: 0,
      streak: 0,
      turboActive: false,
      finished: false,
      finishTimeMs: null,
    });
  };

  if (puzzle.placedWords.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-600">
        Belum ada kata valid (minimal 2 huruf) untuk menyusun kotak pencarian kata.
      </div>
    );
  }

  const totalWords = puzzle.placedWords.length;
  const activeScore = scores[mode === 'pid-multiplayer' ? activePlayerIdx : 0] || 0;

  return (
    <div className="space-y-5">
      {/* Top HUD */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-indigo-900 text-white px-5 py-3.5 rounded-2xl">
        <div>
          <div className="text-xs text-indigo-200 font-medium">
            Menyusun &amp; Mencari Kata · Ke Samping Kanan &amp; Turun Ke Bawah
          </div>
          <div className="font-display font-bold text-lg">{title}</div>
        </div>
        <div className="flex flex-wrap items-center gap-3">
          {totalBoards > 1 && (
            <div className="inline-flex items-center gap-1 bg-indigo-800 px-2 py-1 rounded-xl text-xs font-mono">
              <button
                type="button"
                disabled={safeBoardPage <= 0}
                onClick={() => setBoardPage((p) => Math.max(0, p - 1))}
                className="p-1 rounded-lg hover:bg-indigo-700 disabled:opacity-40"
                title="Paket Pernyataan Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-1.5 font-semibold">
                Paket {safeBoardPage + 1}/{totalBoards} ({validEntries.length} Kata)
              </span>
              <button
                type="button"
                disabled={safeBoardPage >= totalBoards - 1}
                onClick={() => setBoardPage((p) => Math.min(totalBoards - 1, p + 1))}
                className="p-1 rounded-lg hover:bg-indigo-700 disabled:opacity-40"
                title="Paket Pernyataan Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
          <div className="text-right text-xs font-mono tabular-nums">
            <div className="text-indigo-200">
              Ditemukan {foundIds.length} / {totalWords} kata
            </div>
            <div className="font-bold text-emerald-300">Skor: {activeScore}</div>
          </div>
          <button
            type="button"
            onClick={() => {
              const next = !muted;
              soundFX.setMuted(next);
              setMuted(next);
            }}
            className="touch-target p-2.5 bg-indigo-800 hover:bg-indigo-700 rounded-xl"
            title={muted ? 'Aktifkan Suara' : 'Matikan Suara'}
          >
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <button
            type="button"
            onClick={handleReshuffleBoard}
            className="touch-target p-2.5 bg-indigo-800 hover:bg-indigo-700 rounded-xl"
            title="Acak & Mulai Ulang"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {finished ? (
        <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center space-y-4">
          <div className="text-xs font-semibold text-emerald-700 uppercase tracking-wider">
            Permainan Selesai
          </div>
          <h3 className="text-2xl font-bold text-slate-900">
            Semua {totalWords} Kata Pada Paket Ini Berhasil Ditemukan!
          </h3>
          {mode === 'pid-multiplayer' ? (
            <div className="max-w-md mx-auto divide-y divide-slate-200 border border-slate-200 rounded-xl overflow-hidden text-sm">
              {safePlayers
                .map((name, i) => ({ name, score: scores[i] || 0 }))
                .sort((a, b) => b.score - a.score)
                .map((p, rank) => (
                  <div key={`${p.name}_${rank}`} className="flex items-center justify-between px-4 py-2.5 bg-white">
                    <span className="font-semibold text-slate-800">
                      #{rank + 1} {p.name}
                    </span>
                    <span className="font-mono font-bold text-indigo-700 tabular-nums">{p.score} poin</span>
                  </div>
                ))}
            </div>
          ) : (
            <p className="text-base text-slate-600">
              Total Skor Akhir:{' '}
              <strong className="font-mono text-indigo-700">{scores[0] || 0} poin</strong>
            </p>
          )}
          <div className="flex flex-wrap items-center justify-center gap-3">
            {safeBoardPage < totalBoards - 1 && (
              <button
                type="button"
                onClick={() => setBoardPage((p) => Math.min(totalBoards - 1, p + 1))}
                className="touch-target px-6 py-3 bg-emerald-600 hover:bg-emerald-700 text-white text-sm font-semibold rounded-xl"
              >
                Lanjut Paket {safeBoardPage + 2}
              </button>
            )}
            <button
              type="button"
              onClick={handleReshuffleBoard}
              className="touch-target px-6 py-3 bg-indigo-600 hover:bg-indigo-700 text-white text-sm font-semibold rounded-xl"
            >
              Main Ulang (Acak Kotak Baru)
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
          {/* Daftar Pernyataan (Clues List) */}
          <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-5 space-y-3 h-fit">
            {mode === 'pid-multiplayer' && (
              <div className="px-3 py-2 bg-indigo-50 border border-indigo-200 rounded-xl text-sm font-semibold text-indigo-800">
                Giliran Mencari Kata: {safePlayers[activePlayerIdx]}
              </div>
            )}

            <div className="flex items-center justify-between">
              <h3 className="text-base font-bold text-slate-900">Daftar Pernyataan</h3>
              <span className="text-xs font-mono text-slate-500">
                {foundIds.length}/{totalWords} ketemu
              </span>
            </div>
            <p className="text-xs text-slate-500">
              Temukan jawaban dari setiap pernyataan di kotak huruf acak (mendatar ke samping kanan &rarr; atau menurun ke bawah &darr;).
            </p>

            <div className="space-y-2 max-h-[420px] overflow-y-auto pr-1">
              {puzzle.placedWords.map((pw) => {
                const isFound = foundIds.includes(pw.id);
                return (
                  <div
                    key={pw.id}
                    className={`p-3 rounded-xl border text-sm transition-colors ${
                      isFound
                        ? 'bg-emerald-50 border-emerald-200 text-emerald-950'
                        : 'bg-slate-50 border-slate-200 text-slate-800'
                    }`}
                  >
                    <div className="flex items-start justify-between gap-2">
                      <div className="leading-snug">
                        <span className="font-mono font-bold mr-1.5">{pw.index}.</span>
                        <span className={isFound ? 'line-through opacity-75' : 'font-medium'}>
                          {pw.prompt}
                        </span>
                      </div>
                      {isFound ? (
                        <span className="inline-flex items-center gap-1 text-xs font-mono font-bold text-emerald-700 shrink-0">
                          <CheckCircle2 className="w-4 h-4" />
                          {pw.word}
                        </span>
                      ) : (
                        <span className="text-[11px] font-mono text-slate-500 shrink-0">
                          ({pw.word.length} huruf)
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Kotak Huruf Acak (Word Search Grid) */}
          <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-4 sm:p-5 space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="text-xs font-medium text-slate-600">
                {tapStart
                  ? 'Huruf awal dipilih! Ketuk huruf akhir ke samping kanan atau ke bawah.'
                  : 'Ketuk huruf awal lalu huruf akhir, atau geser jari ke kanan / ke bawah.'}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={handleHint}
                  className="px-3 py-1.5 bg-amber-50 hover:bg-amber-100 border border-amber-200 text-amber-800 text-xs font-semibold rounded-lg inline-flex items-center gap-1"
                >
                  <HelpCircle className="w-3.5 h-3.5" />
                  Petunjuk
                </button>
                <button
                  type="button"
                  onClick={handleReshuffleBoard}
                  className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 text-xs font-semibold rounded-lg inline-flex items-center gap-1"
                >
                  <Shuffle className="w-3.5 h-3.5" />
                  Acak Kotak
                </button>
              </div>
            </div>

            {feedback && (
              <div
                className={`px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-semibold flex items-center gap-2 ${
                  feedback.ok
                    ? 'bg-emerald-50 border border-emerald-200 text-emerald-800'
                    : 'bg-rose-50 border border-rose-200 text-rose-800'
                }`}
              >
                {feedback.ok ? (
                  <CheckCircle2 className="w-4 h-4 shrink-0" />
                ) : (
                  <XCircle className="w-4 h-4 shrink-0" />
                )}
                <span>{feedback.text}</span>
              </div>
            )}

            <div className="w-full overflow-x-auto pb-1">
              <div
                className="mx-auto w-fit grid gap-1 select-none touch-none"
                style={{
                  gridTemplateColumns: `repeat(${puzzle.cols}, minmax(28px, 38px))`,
                }}
                onPointerMove={handleGridPointerMove}
                onPointerUp={handleGridPointerUp}
                onPointerCancel={() => {
                  setDragStart(null);
                  setDragEnd(null);
                }}
              >
                {puzzle.grid.map((rowArr, r) =>
                  rowArr.map((letter, c) => {
                    const key = `${r},${c}`;
                    const foundClass = foundCellClassMap.get(key);
                    const isPreview = activePreviewCells.has(key);
                    const isHint = hintCell?.row === r && hintCell?.col === c;

                    return (
                      <button
                        key={key}
                        type="button"
                        data-ws-cell="1"
                        data-row={r}
                        data-col={c}
                        onPointerDown={() => handleCellPointerDown(r, c)}
                        className={`aspect-square min-w-[28px] min-h-[28px] sm:min-w-[36px] sm:min-h-[36px] rounded-lg border font-display font-bold text-sm sm:text-base flex items-center justify-center transition-colors ${
                          isPreview
                            ? 'bg-indigo-600 text-white border-indigo-700 scale-95'
                            : foundClass
                            ? foundClass
                            : isHint
                            ? 'bg-amber-300 text-slate-900 border-amber-500 animate-pulse'
                            : 'bg-slate-50 hover:bg-sky-50 text-slate-900 border-slate-300'
                        }`}
                      >
                        {letter}
                      </button>
                    );
                  })
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
