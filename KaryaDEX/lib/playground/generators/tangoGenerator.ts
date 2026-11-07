/**
 * KaryaDEX — Tango Procedural Puzzle Generator
 *
 * Generates verified, uniquely solvable 6x6 Tango puzzles:
 * - Parity: 3 Suns, 3 Moons per row and column
 * - No 3 identical adjacent symbols horizontally or vertically
 * - Authentic '=' and '×' relational gates
 * - Difficulty scaling: Easy (10-12 givens), Medium (7-9 givens), Hard (5-7 givens)
 * - Deterministic reproduction via seeds and calendar dates
 * - Curated pre-verified fallbacks to guarantee zero runtime stalls
 */

import { createPRNG, type PRNG } from '../prng';
import { solveTango, type TangoVal } from '../solvers/tangoSolver';
import type { TangoPuzzle, TangoConstraint, GameDifficulty } from '@/types/playground';

export interface TangoGeneratorOptions {
  difficulty?: GameDifficulty;
  seed?: string | number;
  maxAttempts?: number;
}

/**
 * Curated, pre-verified fallbacks for instant loading.
 * Verified via solveTango to have exactly 1 unique solution.
 */
export const TANGO_CURATED_PUZZLES: Record<GameDifficulty, TangoPuzzle[]> = {
  easy: [
    {
      id: 'tango-6x6-easy-curated-1',
      size: 6,
      givens: [
        { row: 0, col: 0, value: 'moon' },
        { row: 0, col: 5, value: 'moon' },
        { row: 1, col: 1, value: 'sun' },
        { row: 1, col: 3, value: 'moon' },
        { row: 2, col: 2, value: 'moon' },
        { row: 2, col: 5, value: 'sun' },
        { row: 3, col: 0, value: 'sun' },
        { row: 3, col: 1, value: 'sun' },
        { row: 4, col: 4, value: 'sun' },
        { row: 5, col: 2, value: 'sun' },
        { row: 5, col: 5, value: 'sun' },
      ],
      constraints: [
        { row1: 0, col1: 3, row2: 0, col2: 4, type: 'equal' },
        { row1: 2, col1: 1, row2: 2, col2: 2, type: 'equal' },
        { row1: 1, col1: 0, row2: 1, col2: 1, type: 'opposite' },
      ],
      solution: [
        ['moon', 'sun', 'moon', 'sun', 'sun', 'moon'],
        ['moon', 'sun', 'sun', 'moon', 'sun', 'moon'],
        ['sun', 'moon', 'moon', 'sun', 'moon', 'sun'],
        ['sun', 'sun', 'moon', 'sun', 'moon', 'moon'],
        ['moon', 'moon', 'sun', 'moon', 'sun', 'sun'],
        ['sun', 'moon', 'sun', 'moon', 'moon', 'sun'],
      ],
    },
  ],
  medium: [
    {
      id: 'tango-6x6-med-curated-1',
      size: 6,
      givens: [
        { row: 0, col: 0, value: 'moon' },
        { row: 1, col: 3, value: 'moon' },
        { row: 2, col: 5, value: 'sun' },
        { row: 3, col: 1, value: 'sun' },
        { row: 4, col: 4, value: 'sun' },
        { row: 5, col: 2, value: 'sun' },
      ],
      constraints: [
        { row1: 0, col1: 3, row2: 0, col2: 4, type: 'equal' },
        { row1: 2, col1: 1, row2: 2, col2: 2, type: 'equal' },
        { row1: 3, col1: 4, row2: 3, col2: 5, type: 'equal' },
        { row1: 1, col1: 0, row2: 1, col2: 1, type: 'opposite' },
        { row1: 5, col1: 0, row2: 5, col2: 1, type: 'opposite' },
      ],
      solution: [
        ['moon', 'sun', 'moon', 'sun', 'sun', 'moon'],
        ['moon', 'sun', 'sun', 'moon', 'sun', 'moon'],
        ['sun', 'moon', 'moon', 'sun', 'moon', 'sun'],
        ['sun', 'sun', 'moon', 'sun', 'moon', 'moon'],
        ['moon', 'moon', 'sun', 'moon', 'sun', 'sun'],
        ['sun', 'moon', 'sun', 'moon', 'moon', 'sun'],
      ],
    },
  ],
  hard: [
    {
      id: 'tango-6x6-hard-curated-1',
      size: 6,
      givens: [
        { row: 0, col: 0, value: 'moon' },
        { row: 1, col: 0, value: 'moon' },
        { row: 2, col: 5, value: 'sun' },
        { row: 3, col: 1, value: 'sun' },
        { row: 4, col: 4, value: 'sun' },
        { row: 5, col: 2, value: 'sun' },
      ],
      constraints: [
        { row1: 0, col1: 3, row2: 0, col2: 4, type: 'equal' },
        { row1: 2, col1: 1, row2: 2, col2: 2, type: 'equal' },
        { row1: 3, col1: 4, row2: 3, col2: 5, type: 'equal' },
        { row1: 1, col1: 0, row2: 1, col2: 1, type: 'opposite' },
        { row1: 5, col1: 0, row2: 5, col2: 1, type: 'opposite' },
        { row1: 4, col1: 2, row2: 4, col2: 3, type: 'opposite' },
      ],
      solution: [
        ['moon', 'sun', 'moon', 'sun', 'sun', 'moon'],
        ['moon', 'sun', 'sun', 'moon', 'sun', 'moon'],
        ['sun', 'moon', 'moon', 'sun', 'moon', 'sun'],
        ['sun', 'sun', 'moon', 'sun', 'moon', 'moon'],
        ['moon', 'moon', 'sun', 'moon', 'sun', 'sun'],
        ['sun', 'moon', 'sun', 'moon', 'moon', 'sun'],
      ],
    },
  ],
};

/**
 * Generates a valid full 6x6 board using backtracking with PRNG.
 */
function generateFullTangoBoard(prng: PRNG): TangoVal[][] | null {
  const size = 6;
  const target = 3;
  const board: (TangoVal | null)[][] = Array.from({ length: size }, () =>
    Array(size).fill(null)
  );

  function isSafe(r: number, c: number, val: TangoVal): boolean {
    // Row count
    let sRow = 0, mRow = 0;
    for (let j = 0; j < c; j++) {
      if (board[r][j] === 'sun') sRow++; else if (board[r][j] === 'moon') mRow++;
    }
    if (val === 'sun' && sRow >= target) return false;
    if (val === 'moon' && mRow >= target) return false;

    // Col count
    let sCol = 0, mCol = 0;
    for (let i = 0; i < r; i++) {
      if (board[i][c] === 'sun') sCol++; else if (board[i][c] === 'moon') mCol++;
    }
    if (val === 'sun' && sCol >= target) return false;
    if (val === 'moon' && mCol >= target) return false;

    // Horizontal 3-in-a-row
    if (c >= 2 && board[r][c - 1] === val && board[r][c - 2] === val) return false;

    // Vertical 3-in-a-row
    if (r >= 2 && board[r - 1][c] === val && board[r - 2][c] === val) return false;

    return true;
  }

  function fill(r: number, c: number): boolean {
    if (r === size) return true;
    const nextR = c === size - 1 ? r + 1 : r;
    const nextC = c === size - 1 ? 0 : c + 1;

    const symbols = prng.shuffle(['sun', 'moon'] as TangoVal[]);
    for (const sym of symbols) {
      if (isSafe(r, c, sym)) {
        board[r][c] = sym;
        if (fill(nextR, nextC)) return true;
        board[r][c] = null;
      }
    }
    return false;
  }

  const success = fill(0, 0);
  return success ? (board as TangoVal[][]) : null;
}

/**
 * Procedurally generates a verified Tango puzzle with a unique solution.
 */
export function generateTangoPuzzle(options: TangoGeneratorOptions = {}): TangoPuzzle {
  const difficulty = options.difficulty || 'medium';
  const seed = options.seed || `tango-${Date.now()}-${Math.random()}`;
  const prng = createPRNG(seed);
  const maxAttempts = options.maxAttempts || 20;

  const targetGivens = difficulty === 'easy' ? 10 : difficulty === 'medium' ? 7 : 5;
  const targetConstraints = difficulty === 'easy' ? 3 : difficulty === 'medium' ? 5 : 6;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const solution = generateFullTangoBoard(prng);
    if (!solution) continue;

    // Collect all valid adjacent constraints
    const candidateConstraints: TangoConstraint[] = [];

    // Horizontal pairs
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 5; c++) {
        const val1 = solution[r][c];
        const val2 = solution[r][c + 1];
        candidateConstraints.push({
          row1: r,
          col1: c,
          row2: r,
          col2: c + 1,
          type: val1 === val2 ? 'equal' : 'opposite',
        });
      }
    }

    // Vertical pairs
    for (let r = 0; r < 5; r++) {
      for (let c = 0; c < 6; c++) {
        const val1 = solution[r][c];
        const val2 = solution[r + 1][c];
        candidateConstraints.push({
          row1: r,
          col1: c,
          row2: r + 1,
          col2: c,
          type: val1 === val2 ? 'equal' : 'opposite',
        });
      }
    }

    const shuffledConstraints = prng.shuffle(candidateConstraints);
    const selectedConstraints = shuffledConstraints.slice(0, targetConstraints);

    // Pick random givens
    const allCoords: { row: number; col: number }[] = [];
    for (let r = 0; r < 6; r++) {
      for (let c = 0; c < 6; c++) {
        allCoords.push({ row: r, col: c });
      }
    }

    const shuffledCoords = prng.shuffle(allCoords);
    const givens = shuffledCoords.slice(0, targetGivens).map((pt) => ({
      row: pt.row,
      col: pt.col,
      value: solution[pt.row][pt.col],
    }));

    // Verify uniqueness with solver
    const result = solveTango(givens, selectedConstraints, 6, 2);
    if (result.isUnique) {
      return {
        id: `tango-6x6-${seed}-${attempt}`,
        size: 6,
        givens,
        constraints: selectedConstraints,
        solution,
      };
    }
  }

  // Graceful fallback to verified curated puzzle
  const pool = TANGO_CURATED_PUZZLES[difficulty] || TANGO_CURATED_PUZZLES.medium;
  const fallbackIndex = prng.nextInt(0, pool.length - 1);
  return {
    ...pool[fallbackIndex],
    id: `tango-6x6-fallback-${seed}`,
  };
}

/**
 * Returns a deterministic Daily Tango puzzle based on calendar date string (YYYY-MM-DD).
 */
export function getDailyTangoPuzzle(
  dateString: string,
  difficulty: GameDifficulty = 'medium'
): TangoPuzzle {
  const seed = `karyadex-daily-tango-${dateString}-${difficulty}`;
  return generateTangoPuzzle({
    difficulty,
    seed,
    maxAttempts: 25,
  });
}
