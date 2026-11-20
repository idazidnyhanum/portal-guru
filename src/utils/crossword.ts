export interface CrosswordInputWord {
  id: string;
  word: string;
  clue: string;
}

export interface CrosswordPlacedWord {
  id: string;
  number: number;
  direction: 'across' | 'down';
  word: string;
  clue: string;
  row: number;
  col: number;
}

export interface CrosswordCell {
  row: number;
  col: number;
  letter: string | null;
  number?: number;
  acrossWordId?: string;
  downWordId?: string;
}

export interface CrosswordLayout {
  rows: number;
  cols: number;
  grid: CrosswordCell[][];
  placedWords: CrosswordPlacedWord[];
}

export function normalizeWord(raw: string): string {
  return raw.toUpperCase().replace(/[^A-Z0-9]/g, '');
}

export function generateCrosswordLayout(entries: CrosswordInputWord[]): CrosswordLayout {
  const cleaned = entries
    .map((e) => ({
      id: e.id,
      word: normalizeWord(e.word),
      clue: e.clue.trim(),
    }))
    .filter((e) => e.word.length >= 2)
    .sort((a, b) => b.word.length - a.word.length);

  if (cleaned.length === 0) {
    return { rows: 1, cols: 1, grid: [[{ row: 0, col: 0, letter: null }]], placedWords: [] };
  }

  const GRID_SIZE = 38;
  const board: (string | null)[][] = Array.from({ length: GRID_SIZE }, () =>
    Array<string | null>(GRID_SIZE).fill(null)
  );

  interface DraftWord {
    id: string;
    word: string;
    clue: string;
    row: number;
    col: number;
    direction: 'across' | 'down';
  }

  const placed: DraftWord[] = [];

  const canPlace = (word: string, row: number, col: number, dir: 'across' | 'down'): number => {
    const dr = dir === 'down' ? 1 : 0;
    const dc = dir === 'across' ? 1 : 0;

    if (row < 1 || col < 1) return -1;
    if (row + dr * (word.length - 1) >= GRID_SIZE - 1) return -1;
    if (col + dc * (word.length - 1) >= GRID_SIZE - 1) return -1;

    // Cell immediately before and after word must be empty
    if (board[row - dr][col - dc] !== null) return -1;
    const endR = row + dr * word.length;
    const endC = col + dc * word.length;
    if (board[endR][endC] !== null) return -1;

    let intersections = 0;

    for (let i = 0; i < word.length; i++) {
      const r = row + dr * i;
      const c = col + dc * i;
      const existing = board[r][c];

      if (existing !== null) {
        if (existing !== word[i]) return -1;
        intersections++;
      } else {
        // Adjacent perpendicular cells must be empty to prevent accidental word merging
        if (dir === 'across') {
          if (board[r - 1][c] !== null || board[r + 1][c] !== null) return -1;
        } else {
          if (board[r][c - 1] !== null || board[r][c + 1] !== null) return -1;
        }
      }
    }

    return intersections;
  };

  const placeWord = (entry: { id: string; word: string; clue: string }, row: number, col: number, dir: 'across' | 'down') => {
    const dr = dir === 'down' ? 1 : 0;
    const dc = dir === 'across' ? 1 : 0;
    for (let i = 0; i < entry.word.length; i++) {
      board[row + dr * i][col + dc * i] = entry.word[i];
    }
    placed.push({ ...entry, row, col, direction: dir });
  };

  // Place first longest word centered horizontally
  const first = cleaned[0];
  const startRow = Math.floor(GRID_SIZE / 2) - 4;
  const startCol = Math.max(2, Math.floor((GRID_SIZE - first.word.length) / 2));
  placeWord(first, startRow, startCol, 'across');

  // Place remaining words by finding best intersection
  for (let wIdx = 1; wIdx < cleaned.length; wIdx++) {
    const entry = cleaned[wIdx];
    let bestCandidate: { row: number; col: number; dir: 'across' | 'down'; score: number } | null = null;

    for (const pw of placed) {
      const targetDir: 'across' | 'down' = pw.direction === 'across' ? 'down' : 'across';
      const pwDr = pw.direction === 'down' ? 1 : 0;
      const pwDc = pw.direction === 'across' ? 1 : 0;

      for (let i = 0; i < pw.word.length; i++) {
        const ch = pw.word[i];
        const interR = pw.row + pwDr * i;
        const interC = pw.col + pwDc * i;

        for (let j = 0; j < entry.word.length; j++) {
          if (entry.word[j] !== ch) continue;
          const candR = targetDir === 'down' ? interR - j : interR;
          const candC = targetDir === 'across' ? interC - j : interC;
          const intersections = canPlace(entry.word, candR, candC, targetDir);
          if (intersections > 0) {
            if (!bestCandidate || intersections > bestCandidate.score) {
              bestCandidate = { row: candR, col: candC, dir: targetDir, score: intersections };
            }
          }
        }
      }
    }

    if (bestCandidate) {
      placeWord(entry, bestCandidate.row, bestCandidate.col, bestCandidate.dir);
    } else {
      // Fallback: find any completely empty horizontal or vertical slot without overlapping
      let placedFallback = false;
      for (let r = 2; r < GRID_SIZE - 2 && !placedFallback; r += 2) {
        for (let c = 2; c < GRID_SIZE - entry.word.length - 1 && !placedFallback; c += 2) {
          if (canPlace(entry.word, r, c, 'across') >= 0) {
            placeWord(entry, r, c, 'across');
            placedFallback = true;
          }
        }
      }
    }
  }

  // Trim bounding box
  let minR = GRID_SIZE;
  let maxR = 0;
  let minC = GRID_SIZE;
  let maxC = 0;

  for (const pw of placed) {
    const dr = pw.direction === 'down' ? 1 : 0;
    const dc = pw.direction === 'across' ? 1 : 0;
    const endR = pw.row + dr * (pw.word.length - 1);
    const endC = pw.col + dc * (pw.word.length - 1);
    if (pw.row < minR) minR = pw.row;
    if (endR > maxR) maxR = endR;
    if (pw.col < minC) minC = pw.col;
    if (endC > maxC) maxC = endC;
  }

  const rows = maxR - minR + 1;
  const cols = maxC - minC + 1;

  const grid: CrosswordCell[][] = Array.from({ length: rows }, (_, r) =>
    Array.from({ length: cols }, (_, c) => ({
      row: r,
      col: c,
      letter: board[r + minR][c + minC],
    }))
  );

  // Sort placed words top-to-bottom, left-to-right to assign clue numbers
  const normalizedPlaced = placed
    .map((pw) => ({
      ...pw,
      row: pw.row - minR,
      col: pw.col - minC,
    }))
    .sort((a, b) => (a.row !== b.row ? a.row - b.row : a.col - b.col));

  const startCoordToNumber = new Map<string, number>();
  let nextNum = 1;

  const finalWords: CrosswordPlacedWord[] = normalizedPlaced.map((pw) => {
    const key = `${pw.row},${pw.col}`;
    let num = startCoordToNumber.get(key);
    if (!num) {
      num = nextNum++;
      startCoordToNumber.set(key, num);
    }

    grid[pw.row][pw.col].number = num;
    const dr = pw.direction === 'down' ? 1 : 0;
    const dc = pw.direction === 'across' ? 1 : 0;

    for (let i = 0; i < pw.word.length; i++) {
      const cell = grid[pw.row + dr * i][pw.col + dc * i];
      if (pw.direction === 'across') {
        cell.acrossWordId = pw.id;
      } else {
        cell.downWordId = pw.id;
      }
    }

    return {
      ...pw,
      number: num,
    };
  });

  return { rows, cols, grid, placedWords: finalWords };
}
