import { normalizeWord } from './crossword';

export interface WordSearchEntryInput {
  id: string;
  word: string;
  prompt: string;
  clue?: string;
}

export interface WordSearchPlacedWord {
  id: string;
  index: number;
  word: string;
  prompt: string;
  clue?: string;
  row: number;
  col: number;
  direction: 'right' | 'down';
  cells: { row: number; col: number }[];
}

export interface WordSearchPuzzle {
  rows: number;
  cols: number;
  grid: string[][];
  placedWords: WordSearchPlacedWord[];
}

function shuffleArray<T>(arr: T[]): T[] {
  const copy = [...arr];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [copy[i], copy[j]] = [copy[j], copy[i]];
  }
  return copy;
}

const RANDOM_LETTERS = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';

export function generateWordSearchPuzzle(entries: WordSearchEntryInput[]): WordSearchPuzzle {
  const cleaned = entries
    .map((e, idx) => ({
      id: e.id,
      index: idx + 1,
      word: normalizeWord(e.word),
      prompt: e.prompt.trim(),
      clue: e.clue?.trim(),
    }))
    .filter((e) => e.word.length >= 2 && e.prompt.length > 0);

  if (cleaned.length === 0) {
    return { rows: 0, cols: 0, grid: [], placedWords: [] };
  }

  const maxWordLen = Math.max(...cleaned.map((e) => e.word.length));
  // Size grid generously so words can spread out randomly both right & down
  const baseSize = Math.max(9, maxWordLen + 2, Math.ceil(Math.sqrt(cleaned.length * 18)));
  const size = Math.max(Math.min(14, baseSize), Math.min(20, maxWordLen + 1));

  const board: (string | null)[][] = Array.from({ length: size }, () =>
    Array<string | null>(size).fill(null)
  );

  // Shuffle placement order so positions are as random as possible
  const shuffledEntries = shuffleArray(cleaned);
  const placed: WordSearchPlacedWord[] = [];

  for (const entry of shuffledEntries) {
    // Balance and randomize directions (only 'right' and 'down' as requested)
    const preferredDirs: ('right' | 'down')[] =
      Math.random() < 0.5 ? ['right', 'down'] : ['down', 'right'];

    const candidates: { row: number; col: number; dir: 'right' | 'down'; overlap: number }[] = [];

    for (const dir of preferredDirs) {
      const dr = dir === 'down' ? 1 : 0;
      const dc = dir === 'right' ? 1 : 0;
      const maxR = dir === 'down' ? size - entry.word.length : size - 1;
      const maxC = dir === 'right' ? size - entry.word.length : size - 1;

      for (let r = 0; r <= maxR; r++) {
        for (let c = 0; c <= maxC; c++) {
          let valid = true;
          let overlap = 0;

          for (let k = 0; k < entry.word.length; k++) {
            const rr = r + dr * k;
            const cc = c + dc * k;
            const existing = board[rr][cc];
            if (existing !== null) {
              if (existing !== entry.word[k]) {
                valid = false;
                break;
              }
              overlap++;
            }
          }

          // Avoid exact 100% overlap with an already placed word
          if (valid && overlap < entry.word.length) {
            candidates.push({ row: r, col: c, dir, overlap });
          }
        }
      }
    }

    if (candidates.length > 0) {
      // Pick randomly from valid placements (preferring some variety in row/col & occasional intersection)
      const randomized = shuffleArray(candidates);
      const chosen = randomized[0];
      const dr = chosen.dir === 'down' ? 1 : 0;
      const dc = chosen.dir === 'right' ? 1 : 0;
      const cells: { row: number; col: number }[] = [];

      for (let k = 0; k < entry.word.length; k++) {
        const rr = chosen.row + dr * k;
        const cc = chosen.col + dc * k;
        board[rr][cc] = entry.word[k];
        cells.push({ row: rr, col: cc });
      }

      placed.push({
        id: entry.id,
        index: entry.index,
        word: entry.word,
        prompt: entry.prompt,
        clue: entry.clue,
        row: chosen.row,
        col: chosen.col,
        direction: chosen.dir,
        cells,
      });
    }
  }

  // Sort placed words back by original statement index for clean display
  placed.sort((a, b) => a.index - b.index);

  // Fill remaining empty cells with completely random letters
  const grid: string[][] = board.map((row) =>
    row.map((cell) => {
      if (cell !== null) return cell;
      return RANDOM_LETTERS[Math.floor(Math.random() * RANDOM_LETTERS.length)];
    })
  );

  return { rows: size, cols: size, grid, placedWords: placed };
}
