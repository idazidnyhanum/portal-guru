import { Check, ChevronLeft, ChevronRight, Delete, RotateCcw, Volume2, VolumeX } from 'lucide-react';
import { useEffect, useMemo, useRef, useState } from 'react';
import { GameQuestionItem } from '../../types/portal';
import { soundFX } from '../../utils/audio';
import { CrosswordPlacedWord, generateCrosswordLayout } from '../../utils/crossword';
import { GameProgressUpdate } from './RunningRaceGame';

interface CrosswordGameProps {
  title: string;
  items: GameQuestionItem[];
  onProgress?: (update: GameProgressUpdate) => void;
  onFinish?: () => void;
}

const KEYBOARD_ROWS = [
  ['Q', 'W', 'E', 'R', 'T', 'Y', 'U', 'I', 'O', 'P'],
  ['A', 'S', 'D', 'F', 'G', 'H', 'J', 'K', 'L'],
  ['Z', 'X', 'C', 'V', 'B', 'N', 'M'],
];

const BOARD_SIZE = 10;

export function CrosswordGame({ title, items, onProgress, onFinish }: CrosswordGameProps) {
  const [muted, setMuted] = useState(soundFX.isMuted());
  const [boardPage, setBoardPage] = useState(0);

  const validItems = useMemo(
    () => items.filter((it) => it.prompt.trim() && it.answer.trim().length >= 2),
    [items]
  );

  const totalBoards = Math.max(1, Math.ceil(validItems.length / BOARD_SIZE));
  const safeBoardPage = Math.min(boardPage, totalBoards - 1);

  const boardItems = useMemo(() => {
    if (validItems.length <= BOARD_SIZE) return validItems;
    const start = safeBoardPage * BOARD_SIZE;
    return validItems.slice(start, start + BOARD_SIZE);
  }, [safeBoardPage, validItems]);

  const layout = useMemo(
    () =>
      generateCrosswordLayout(
        boardItems.map((item) => ({
          id: item.id,
          word: item.answer,
          clue: item.prompt,
        }))
      ),
    [boardItems]
  );

  const [userGrid, setUserGrid] = useState<Record<string, string>>({});
  const [activeWordId, setActiveWordId] = useState<string | null>(
    () => layout.placedWords[0]?.id ?? null
  );
  const [activeCell, setActiveCell] = useState<{ row: number; col: number } | null>(() =>
    layout.placedWords[0]
      ? { row: layout.placedWords[0].row, col: layout.placedWords[0].col }
      : null
  );
  const [checkedStatus, setCheckedStatus] = useState<Record<string, boolean>>({});
  const [completed, setCompleted] = useState(false);
  const startTimeRef = useRef(Date.now());

  const validItemsSignature = validItems.map((i) => `${i.id}:${i.answer}`).join('|');
  const itemsKey = `${validItemsSignature}::${safeBoardPage}`;

  useEffect(() => {
    setBoardPage(0);
  }, [validItemsSignature]);

  useEffect(() => {
    setUserGrid({});
    setCheckedStatus({});
    setCompleted(false);
    startTimeRef.current = Date.now();
    if (layout.placedWords[0]) {
      setActiveWordId(layout.placedWords[0].id);
      setActiveCell({ row: layout.placedWords[0].row, col: layout.placedWords[0].col });
    } else {
      setActiveWordId(null);
      setActiveCell(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [itemsKey]);

  const activeWord = useMemo(
    () => layout.placedWords.find((w) => w.id === activeWordId) || layout.placedWords[0] || null,
    [activeWordId, layout.placedWords]
  );

  const getWordCells = (pw: CrosswordPlacedWord) => {
    const dr = pw.direction === 'down' ? 1 : 0;
    const dc = pw.direction === 'across' ? 1 : 0;
    return Array.from({ length: pw.word.length }, (_, i) => ({
      row: pw.row + dr * i,
      col: pw.col + dc * i,
      target: pw.word[i],
    }));
  };

  const activeWordCellSet = useMemo(() => {
    const set = new Set<string>();
    if (activeWord) {
      for (const c of getWordCells(activeWord)) {
        set.add(`${c.row},${c.col}`);
      }
    }
    return set;
  }, [activeWord]);

  const evaluateProgress = (nextGrid: Record<string, string>) => {
    let solvedCount = 0;
    const statusMap: Record<string, boolean> = {};
    for (const pw of layout.placedWords) {
      const cells = getWordCells(pw);
      const isSolved = cells.every((c) => nextGrid[`${c.row},${c.col}`] === c.target);
      statusMap[pw.id] = isSolved;
      if (isSolved) solvedCount++;
    }
    const total = Math.max(1, layout.placedWords.length);
    const pct = Math.round((solvedCount / total) * 100);
    const allDone = solvedCount === layout.placedWords.length && layout.placedWords.length > 0;

    onProgress?.({
      score: solvedCount * 100,
      correctCount: solvedCount,
      answeredCount: solvedCount,
      totalQuestions: total,
      progress: pct,
      streak: solvedCount,
      turboActive: false,
      finished: allDone,
      finishTimeMs: allDone ? Date.now() - startTimeRef.current : null,
    });

    if (allDone && !completed) {
      setCompleted(true);
      soundFX.playVictory();
      onFinish?.();
    }
  };

  const handleInputLetter = (letter: string) => {
    if (!activeWord || !activeCell || completed) return;
    soundFX.playTap();
    const key = `${activeCell.row},${activeCell.col}`;
    const nextGrid = { ...userGrid, [key]: letter.toUpperCase() };
    setUserGrid(nextGrid);

    const cells = getWordCells(activeWord);
    const curIdx = cells.findIndex((c) => c.row === activeCell.row && c.col === activeCell.col);
    if (curIdx >= 0 && curIdx + 1 < cells.length) {
      setActiveCell({ row: cells[curIdx + 1].row, col: cells[curIdx + 1].col });
    }
    evaluateProgress(nextGrid);
  };

  const handleBackspace = () => {
    if (!activeWord || !activeCell || completed) return;
    soundFX.playTap();
    const key = `${activeCell.row},${activeCell.col}`;
    const nextGrid = { ...userGrid };
    if (nextGrid[key]) {
      delete nextGrid[key];
      setUserGrid(nextGrid);
      evaluateProgress(nextGrid);
      return;
    }
    const cells = getWordCells(activeWord);
    const curIdx = cells.findIndex((c) => c.row === activeCell.row && c.col === activeCell.col);
    if (curIdx > 0) {
      const prevCell = cells[curIdx - 1];
      delete nextGrid[`${prevCell.row},${prevCell.col}`];
      setUserGrid(nextGrid);
      setActiveCell({ row: prevCell.row, col: prevCell.col });
      evaluateProgress(nextGrid);
    }
  };

  const handleCheckBoard = () => {
    const nextCheck: Record<string, boolean> = {};
    let correctCells = 0;
    let totalCells = 0;
    for (let r = 0; r < layout.rows; r++) {
      for (let c = 0; c < layout.cols; c++) {
        const target = layout.grid[r][c].letter;
        if (!target) continue;
        totalCells++;
        const k = `${r},${c}`;
        const ok = userGrid[k] === target;
        nextCheck[k] = ok;
        if (ok) correctCells++;
      }
    }
    setCheckedStatus(nextCheck);
    evaluateProgress(userGrid);
    if (correctCells === totalCells && totalCells > 0) {
      soundFX.playVictory();
      setCompleted(true);
      onFinish?.();
    } else {
      soundFX.playCorrect();
    }
  };

  const keyHandlerRef = useRef<(e: KeyboardEvent) => void>(() => {});
  keyHandlerRef.current = (e: KeyboardEvent) => {
    if (e.target instanceof HTMLInputElement || e.target instanceof HTMLTextAreaElement) return;
    if (/^[a-zA-Z]$/.test(e.key)) {
      e.preventDefault();
      handleInputLetter(e.key.toUpperCase());
    } else if (e.key === 'Backspace') {
      e.preventDefault();
      handleBackspace();
    } else if (
      activeCell &&
      (e.key === 'ArrowLeft' ||
        e.key === 'ArrowRight' ||
        e.key === 'ArrowUp' ||
        e.key === 'ArrowDown')
    ) {
      const dr = e.key === 'ArrowUp' ? -1 : e.key === 'ArrowDown' ? 1 : 0;
      const dc = e.key === 'ArrowLeft' ? -1 : e.key === 'ArrowRight' ? 1 : 0;
      const nr = activeCell.row + dr;
      const nc = activeCell.col + dc;
      const nextCell = layout.grid[nr]?.[nc];
      if (nextCell && nextCell.letter) {
        e.preventDefault();
        setActiveCell({ row: nr, col: nc });
        if (dr !== 0 && nextCell.downWordId) {
          setActiveWordId(nextCell.downWordId);
        } else if (dc !== 0 && nextCell.acrossWordId) {
          setActiveWordId(nextCell.acrossWordId);
        }
      }
    }
  };

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => keyHandlerRef.current(e);
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const acrossWords = layout.placedWords.filter((w) => w.direction === 'across');
  const downWords = layout.placedWords.filter((w) => w.direction === 'down');

  const handleReset = () => {
    soundFX.playTap();
    setUserGrid({});
    setCheckedStatus({});
    setCompleted(false);
    startTimeRef.current = Date.now();
    if (layout.placedWords[0]) {
      setActiveWordId(layout.placedWords[0].id);
      setActiveCell({ row: layout.placedWords[0].row, col: layout.placedWords[0].col });
    }
    onProgress?.({
      score: 0,
      correctCount: 0,
      answeredCount: 0,
      totalQuestions: Math.max(1, layout.placedWords.length),
      progress: 0,
      streak: 0,
      turboActive: false,
      finished: false,
      finishTimeMs: null,
    });
  };

  if (layout.placedWords.length === 0) {
    return (
      <div className="bg-white border border-slate-200 rounded-2xl p-8 text-center text-sm text-slate-600">
        Belum ada kata valid (minimal 2 huruf) untuk menyusun papan Teka-Teki Silang.
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* Header HUD */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-sky-900 text-white px-5 py-3.5 rounded-2xl">
        <div>
          <div className="text-xs text-sky-200 font-medium">
            Teka-Teki Silang Interaktif · Sentuh Kotak &amp; Gunakan Papan Ketik
          </div>
          <div className="font-display font-bold text-lg">{title}</div>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {totalBoards > 1 && (
            <div className="inline-flex items-center gap-1 bg-sky-800 px-2 py-1 rounded-xl text-xs font-mono">
              <button
                type="button"
                disabled={safeBoardPage <= 0}
                onClick={() => setBoardPage((p) => Math.max(0, p - 1))}
                className="p-1 rounded-lg hover:bg-sky-700 disabled:opacity-40"
                title="Paket Kata Sebelumnya"
              >
                <ChevronLeft className="w-4 h-4" />
              </button>
              <span className="px-1.5 font-semibold">
                Paket {safeBoardPage + 1}/{totalBoards} ({validItems.length} Kata)
              </span>
              <button
                type="button"
                disabled={safeBoardPage >= totalBoards - 1}
                onClick={() => setBoardPage((p) => Math.min(totalBoards - 1, p + 1))}
                className="p-1 rounded-lg hover:bg-sky-700 disabled:opacity-40"
                title="Paket Kata Berikutnya"
              >
                <ChevronRight className="w-4 h-4" />
              </button>
            </div>
          )}
          <button
            type="button"
            onClick={handleCheckBoard}
            className="touch-target px-4 py-2 bg-emerald-500 hover:bg-emerald-600 text-white text-xs font-bold rounded-xl inline-flex items-center gap-1.5 transition-colors"
          >
            <Check className="w-4 h-4" />
            Periksa
          </button>
          <button
            type="button"
            onClick={() => {
              const next = !muted;
              soundFX.setMuted(next);
              setMuted(next);
            }}
            className="touch-target p-2.5 bg-sky-800 hover:bg-sky-700 rounded-xl"
          >
            {muted ? <VolumeX className="w-5 h-5" /> : <Volume2 className="w-5 h-5" />}
          </button>
          <button
            type="button"
            onClick={handleReset}
            className="touch-target p-2.5 bg-sky-800 hover:bg-sky-700 rounded-xl"
          >
            <RotateCcw className="w-5 h-5" />
          </button>
        </div>
      </div>

      {completed && (
        <div className="bg-emerald-50 border border-emerald-200 text-emerald-900 rounded-2xl p-4 flex flex-wrap items-center justify-center gap-3 font-bold">
          <span>Luar Biasa! Paket Teka-Teki Silang ini berhasil diselesaikan!</span>
          {safeBoardPage < totalBoards - 1 && (
            <button
              type="button"
              onClick={() => setBoardPage((p) => Math.min(totalBoards - 1, p + 1))}
              className="px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-semibold rounded-xl"
            >
              Lanjut Paket {safeBoardPage + 2}
            </button>
          )}
        </div>
      )}

      {/* Grid + Clues */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-5">
        <div className="lg:col-span-7 bg-white border border-slate-200 rounded-2xl p-4 flex flex-col justify-between gap-4">
          <div className="w-full overflow-x-auto pb-1">
            <div
              className="mx-auto w-fit grid gap-1"
              style={{
                gridTemplateColumns: `repeat(${layout.cols}, minmax(34px, 42px))`,
              }}
            >
              {layout.grid.flat().map((cell) => {
                const key = `${cell.row},${cell.col}`;
                if (!cell.letter) {
                  return <div key={key} className="w-9 h-9 sm:w-10 sm:h-10 bg-transparent" />;
                }

                const isFocused = activeCell?.row === cell.row && activeCell?.col === cell.col;
                const isInWord = activeWordCellSet.has(key);
                const val = userGrid[key] || '';
                const checkFlag = checkedStatus[key];

                return (
                  <button
                    key={key}
                    type="button"
                    onClick={() => {
                      soundFX.playTap();
                      setActiveCell({ row: cell.row, col: cell.col });
                      if (cell.acrossWordId && cell.downWordId) {
                        setActiveWordId((prev) =>
                          prev === cell.acrossWordId ? cell.downWordId! : cell.acrossWordId!
                        );
                      } else if (cell.acrossWordId) {
                        setActiveWordId(cell.acrossWordId);
                      } else if (cell.downWordId) {
                        setActiveWordId(cell.downWordId);
                      }
                    }}
                    className={`relative w-9 h-9 sm:w-10 sm:h-10 rounded-lg border-2 font-display font-bold text-base sm:text-lg flex items-center justify-center transition-colors ${
                      isFocused
                        ? 'bg-sky-600 text-white border-sky-700'
                        : checkFlag === true
                        ? 'bg-emerald-100 text-emerald-900 border-emerald-500'
                        : checkFlag === false && val
                        ? 'bg-rose-100 text-rose-900 border-rose-400'
                        : isInWord
                        ? 'bg-sky-100 text-slate-900 border-sky-400'
                        : 'bg-slate-50 text-slate-900 border-slate-300'
                    }`}
                  >
                    {cell.number && (
                      <span
                        className={`absolute top-0.5 left-1 text-[9px] font-mono leading-none ${
                          isFocused ? 'text-sky-100' : 'text-slate-500'
                        }`}
                      >
                        {cell.number}
                      </span>
                    )}
                    {val}
                  </button>
                );
              })}
            </div>
          </div>

          {activeWord && (
            <div className="w-full bg-sky-50 border border-sky-200 rounded-xl px-4 py-2.5 text-sm text-sky-950">
              <span className="font-bold">
                {activeWord.number} {activeWord.direction === 'across' ? 'Mendatar' : 'Menurun'}:
              </span>{' '}
              {activeWord.clue}
            </div>
          )}
        </div>

        {/* Clues List */}
        <div className="lg:col-span-5 bg-white border border-slate-200 rounded-2xl p-4 space-y-4 max-h-[420px] overflow-y-auto">
          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Mendatar
            </h4>
            <div className="space-y-1.5">
              {acrossWords.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => {
                    setActiveWordId(w.id);
                    setActiveCell({ row: w.row, col: w.col });
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors ${
                    activeWord?.id === w.id
                      ? 'bg-sky-600 text-white font-semibold'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  <span className="font-mono font-bold mr-1.5">{w.number}.</span>
                  {w.clue} ({w.word.length} huruf)
                </button>
              ))}
            </div>
          </div>

          <div>
            <h4 className="text-xs font-bold uppercase tracking-wider text-slate-500 mb-2">
              Menurun
            </h4>
            <div className="space-y-1.5">
              {downWords.map((w) => (
                <button
                  key={w.id}
                  type="button"
                  onClick={() => {
                    setActiveWordId(w.id);
                    setActiveCell({ row: w.row, col: w.col });
                  }}
                  className={`w-full text-left px-3 py-2 rounded-xl text-xs transition-colors ${
                    activeWord?.id === w.id
                      ? 'bg-sky-600 text-white font-semibold'
                      : 'bg-slate-50 hover:bg-slate-100 text-slate-800'
                  }`}
                >
                  <span className="font-mono font-bold mr-1.5">{w.number}.</span>
                  {w.clue} ({w.word.length} huruf)
                </button>
              ))}
            </div>
          </div>
        </div>
      </div>

      {/* Touch Keyboard for PID & Mobile */}
      <div className="bg-slate-900 rounded-2xl p-3 sm:p-4 space-y-2 select-none">
        {KEYBOARD_ROWS.map((row, rIdx) => (
          <div key={rIdx} className="flex justify-center gap-1.5">
            {row.map((letter) => (
              <button
                key={letter}
                type="button"
                onClick={() => handleInputLetter(letter)}
                className="touch-target flex-1 max-w-[48px] h-11 sm:h-12 bg-slate-700 hover:bg-sky-600 active:bg-sky-500 text-white font-display font-bold text-base rounded-xl transition-colors"
              >
                {letter}
              </button>
            ))}
            {rIdx === 2 && (
              <button
                type="button"
                onClick={handleBackspace}
                className="touch-target px-3.5 h-11 sm:h-12 bg-rose-600 hover:bg-rose-500 text-white font-semibold text-xs rounded-xl inline-flex items-center gap-1"
              >
                <Delete className="w-4 h-4" />
                Hapus
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}
