/**
 * KaryaDEX — Queens Procedural Puzzle Generator
 *
 * Generates verified, uniquely solvable Queens puzzles across board sizes:
 * - 5x5 (Easy / Starter)
 * - 6x6 (Medium)
 * - 7x7 (Hard)
 * - 8x8 (Expert)
 *
 * Each puzzle guarantees:
 * - Exactly 1 queen per row, column, and territory
 * - No two queens touch (Chebyshev distance >= 2)
 * - Every territory is contiguous (orthogonally connected)
 * - Exactly one valid solution (proven via constraint solver)
 * - Deterministic reproduction via seeds and daily calendar dates
 * - Instant curated fallback if computation budget is exceeded
 */

import { createPRNG, type PRNG } from '../prng';
import {
  solveQueens,
  verifyRegionsConnectivity,
  type QueenCoord,
} from '../solvers/queensSolver';
import type { QueensPuzzle, GameDifficulty } from '@/types/playground';

export interface QueensGeneratorOptions {
  size?: number; // 5, 6, 7, 8 (default: 6)
  difficulty?: GameDifficulty;
  seed?: string | number;
  maxAttempts?: number;
}

/**
 * Curated, pre-verified fallbacks for guaranteed instant loading.
 * Every fallback has been verified via solveQueens to have count === 1.
 */
export const QUEENS_CURATED_PUZZLES: Record<number, QueensPuzzle[]> = {
  5: [
    {
      id: 'queens-5x5-curated-1',
      size: 5,
      regions: [
        [1, 0, 0, 0, 0],
        [1, 1, 1, 0, 0],
        [1, 1, 2, 2, 2],
        [4, 2, 2, 3, 3],
        [4, 4, 4, 4, 3],
      ],
      solution: [
        { row: 0, col: 3 },
        { row: 1, col: 0 },
        { row: 2, col: 2 },
        { row: 3, col: 4 },
        { row: 4, col: 1 },
      ],
    },
    {
      id: 'queens-5x5-curated-2',
      size: 5,
      regions: [
        [1, 0, 0, 0, 0],
        [1, 1, 1, 0, 0],
        [1, 1, 2, 2, 2],
        [4, 2, 2, 3, 3],
        [4, 4, 4, 4, 3],
      ],
      solution: [
        { row: 0, col: 3 },
        { row: 1, col: 0 },
        { row: 2, col: 2 },
        { row: 3, col: 4 },
        { row: 4, col: 1 },
      ],
    },
  ],
  6: [
    {
      id: 'queens-6x6-curated-1',
      size: 6,
      regions: [
        [0, 0, 0, 1, 1, 2],
        [0, 0, 1, 1, 2, 2],
        [0, 1, 1, 1, 2, 2],
        [0, 3, 3, 1, 2, 2],
        [3, 3, 3, 4, 4, 4],
        [3, 3, 4, 4, 5, 5],
      ],
      solution: [
        { row: 0, col: 0 },
        { row: 1, col: 2 },
        { row: 2, col: 4 },
        { row: 3, col: 1 },
        { row: 4, col: 3 },
        { row: 5, col: 5 },
      ],
    },
    {
      id: 'queens-6x6-curated-2',
      size: 6,
      regions: [
        [2, 2, 1, 0, 0, 0],
        [2, 1, 1, 1, 0, 0],
        [2, 2, 3, 3, 3, 3],
        [3, 3, 3, 4, 4, 4],
        [5, 5, 5, 4, 4, 4],
        [5, 5, 5, 4, 4, 4],
      ],
      solution: [
        { row: 0, col: 5 },
        { row: 1, col: 3 },
        { row: 2, col: 0 },
        { row: 3, col: 2 },
        { row: 4, col: 4 },
        { row: 5, col: 1 },
      ],
    },
  ],
  7: [
    {
      id: 'queens-7x7-curated-1',
      size: 7,
      regions: [
        [1, 1, 1, 1, 0, 0, 0],
        [1, 1, 1, 1, 2, 2, 2],
        [5, 5, 1, 4, 2, 2, 2],
        [5, 5, 4, 4, 3, 3, 2],
        [5, 4, 4, 4, 4, 4, 6],
        [5, 4, 4, 4, 6, 6, 6],
        [5, 5, 6, 6, 6, 6, 6],
      ],
      solution: [
        { row: 0, col: 5 },
        { row: 1, col: 1 },
        { row: 2, col: 6 },
        { row: 3, col: 4 },
        { row: 4, col: 2 },
        { row: 5, col: 0 },
        { row: 6, col: 3 },
      ],
    },
    {
      id: 'queens-7x7-curated-2',
      size: 7,
      regions: [
        [1, 1, 1, 0, 0, 0, 0],
        [1, 1, 2, 0, 0, 0, 0],
        [1, 1, 2, 2, 2, 0, 0],
        [1, 3, 4, 2, 2, 2, 5],
        [1, 3, 4, 4, 2, 2, 5],
        [4, 4, 4, 4, 2, 2, 5],
        [6, 6, 6, 5, 5, 5, 5],
      ],
      solution: [
        { row: 0, col: 5 },
        { row: 1, col: 0 },
        { row: 2, col: 4 },
        { row: 3, col: 1 },
        { row: 4, col: 3 },
        { row: 5, col: 6 },
        { row: 6, col: 2 },
      ],
    },
  ],
  8: [
    {
      id: 'queens-8x8-curated-1',
      size: 8,
      regions: [
        [4, 4, 1, 1, 1, 2, 2, 0],
        [4, 4, 1, 1, 1, 2, 2, 0],
        [4, 4, 1, 1, 2, 2, 2, 2],
        [4, 4, 1, 1, 3, 3, 2, 2],
        [4, 4, 1, 1, 5, 5, 5, 2],
        [4, 4, 4, 5, 5, 5, 5, 5],
        [6, 7, 4, 4, 5, 5, 5, 5],
        [6, 7, 7, 5, 5, 5, 5, 5],
      ],
      solution: [
        { row: 0, col: 7 },
        { row: 1, col: 3 },
        { row: 2, col: 6 },
        { row: 3, col: 4 },
        { row: 4, col: 1 },
        { row: 5, col: 5 },
        { row: 6, col: 0 },
        { row: 7, col: 2 },
      ],
    },
    {
      id: 'queens-8x8-curated-2',
      size: 8,
      regions: [
        [0, 0, 0, 1, 5, 5, 5, 5],
        [2, 0, 0, 1, 4, 5, 5, 5],
        [2, 2, 3, 4, 4, 5, 5, 5],
        [2, 2, 3, 3, 4, 4, 5, 5],
        [2, 2, 6, 4, 4, 4, 4, 5],
        [6, 6, 6, 6, 4, 4, 7, 5],
        [6, 6, 6, 6, 6, 7, 7, 5],
        [6, 6, 6, 6, 6, 7, 7, 5],
      ],
      solution: [
        { row: 0, col: 1 },
        { row: 1, col: 3 },
        { row: 2, col: 0 },
        { row: 3, col: 2 },
        { row: 4, col: 5 },
        { row: 5, col: 7 },
        { row: 6, col: 4 },
        { row: 7, col: 6 },
      ],
    },
  ],
};

/**
 * Finds a valid arrangement of N queens on an NxN grid using backtracking with PRNG.
 */
function findValidQueensPlacement(size: number, prng: PRNG): QueenCoord[] | null {
  const colUsed = new Array<boolean>(size).fill(false);
  const queens: QueenCoord[] = [];

  function backtrack(r: number): boolean {
    if (r === size) return true;

    const cols = prng.shuffle(Array.from({ length: size }, (_, i) => i));
    const prevCol = r > 0 ? queens[r - 1].col : -99;

    for (const c of cols) {
      if (!colUsed[c] && Math.abs(c - prevCol) > 1) {
        colUsed[c] = true;
        queens.push({ row: r, col: c });

        if (backtrack(r + 1)) return true;

        queens.pop();
        colUsed[c] = false;
      }
    }
    return false;
  }

  const success = backtrack(0);
  return success ? queens : null;
}

/**
 * Grows contiguous regions around queen coordinates using randomized cellular expansion.
 */
function growContiguousRegions(
  queens: QueenCoord[],
  size: number,
  prng: PRNG
): number[][] | null {
  const regions: number[][] = Array.from({ length: size }, () =>
    Array(size).fill(-1)
  );

  const frontiers: { r: number; c: number }[][] = [];

  for (let i = 0; i < size; i++) {
    regions[queens[i].row][queens[i].col] = i;
    frontiers.push([{ r: queens[i].row, c: queens[i].col }]);
  }

  let unassigned = size * size - size;
  let iterations = 0;
  const maxIterations = size * size * 20;

  while (unassigned > 0 && iterations < maxIterations) {
    iterations++;

    for (let regId = 0; regId < size; regId++) {
      if (frontiers[regId].length === 0) continue;

      const cellIdx = prng.nextInt(0, frontiers[regId].length - 1);
      const cell = frontiers[regId][cellIdx];

      const neighbors = prng.shuffle([
        { r: cell.r - 1, c: cell.c },
        { r: cell.r + 1, c: cell.c },
        { r: cell.r, c: cell.c - 1 },
        { r: cell.r, c: cell.c + 1 },
      ]);

      let expanded = false;
      for (const n of neighbors) {
        if (
          n.r >= 0 &&
          n.r < size &&
          n.c >= 0 &&
          n.c < size &&
          regions[n.r][n.c] === -1
        ) {
          regions[n.r][n.c] = regId;
          frontiers[regId].push(n);
          unassigned--;
          expanded = true;
          break;
        }
      }

      if (!expanded) {
        frontiers[regId].splice(cellIdx, 1);
      }
    }
  }

  return unassigned === 0 ? regions : null;
}

/**
 * Procedurally generates a verified Queens puzzle with a guaranteed unique solution.
 */
export function generateQueensPuzzle(
  options: QueensGeneratorOptions = {}
): QueensPuzzle {
  const size = options.size || (options.difficulty === 'hard' ? 7 : options.difficulty === 'easy' ? 5 : 6);
  const seed = options.seed || `queens-${size}-${Date.now()}-${Math.random()}`;
  const prng = createPRNG(seed);
  const maxAttempts = options.maxAttempts || 25;

  for (let attempt = 0; attempt < maxAttempts; attempt++) {
    const queens = findValidQueensPlacement(size, prng);
    if (!queens) continue;

    const regions = growContiguousRegions(queens, size, prng);
    if (!regions) continue;

    if (!verifyRegionsConnectivity(regions, size)) continue;

    const result = solveQueens(regions, size, 2);
    if (result.isUnique) {
      return {
        id: `queens-${size}-${seed}-${attempt}`,
        size,
        regions,
        solution: queens,
      };
    }
  }

  // Graceful fallback to verified curated puzzle if generation budget exceeded
  const pool = QUEENS_CURATED_PUZZLES[size] || QUEENS_CURATED_PUZZLES[6];
  const fallbackIndex = prng.nextInt(0, pool.length - 1);
  return {
    ...pool[fallbackIndex],
    id: `queens-${size}-fallback-${seed}`,
  };
}

/**
 * Returns a deterministic Daily Queens puzzle based on calendar date string (YYYY-MM-DD).
 */
export function getDailyQueensPuzzle(
  dateString: string,
  difficulty: GameDifficulty = 'medium'
): QueensPuzzle {
  const size = difficulty === 'hard' ? 7 : difficulty === 'easy' ? 5 : 6;
  const seed = `karyadex-daily-queens-${dateString}-${difficulty}`;
  return generateQueensPuzzle({
    size,
    difficulty,
    seed,
    maxAttempts: 30,
  });
}
