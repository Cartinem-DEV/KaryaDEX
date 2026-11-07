/**
 * KaryaDEX — Queens Constraint Solver
 *
 * Solves Queens territory deduction puzzles by searching for valid
 * arrangements of N crowns on an NxN grid partitioned into N regions:
 * - 1 queen per row
 * - 1 queen per column
 * - 1 queen per colored region
 * - No two queens touch (Chebyshev distance >= 2)
 *
 * Supports fast solution counting with early exit for uniqueness verification.
 */

export interface QueenCoord {
  row: number;
  col: number;
}

export interface QueensSolverResult {
  count: number;
  solutions: QueenCoord[][];
  isUnique: boolean;
}

/**
 * Solves a Queens territory puzzle with an optional maxSolutions limit.
 *
 * @param regions NxN 2D array where regions[r][c] is the region ID (0 to N-1)
 * @param size Board dimension N (e.g. 5, 6, 7, 8)
 * @param maxSolutions Stop counting after finding this many solutions (default: 2)
 */
export function solveQueens(
  regions: number[][],
  size: number,
  maxSolutions: number = 2
): QueensSolverResult {
  const solutions: QueenCoord[][] = [];
  const colUsed = new Array<boolean>(size).fill(false);
  const regionUsed = new Array<boolean>(size).fill(false);
  const currentQueens: QueenCoord[] = [];

  function search(row: number): void {
    if (solutions.length >= maxSolutions) {
      return;
    }

    if (row === size) {
      solutions.push([...currentQueens]);
      return;
    }

    const prevCol = row > 0 ? currentQueens[row - 1].col : -99;

    for (let c = 0; c < size; c++) {
      // 1. Column already used
      if (colUsed[c]) continue;

      // 2. Chebyshev distance constraint: cannot touch queen in previous row (col - 1, col, col + 1)
      if (Math.abs(c - prevCol) <= 1) continue;

      // 3. Region constraint
      const regionId = regions[row][c];
      if (regionId < 0 || regionId >= size || regionUsed[regionId]) continue;

      // Place queen at (row, c)
      colUsed[c] = true;
      regionUsed[regionId] = true;
      currentQueens.push({ row, col: c });

      search(row + 1);

      // Backtrack
      currentQueens.pop();
      regionUsed[regionId] = false;
      colUsed[c] = false;

      if (solutions.length >= maxSolutions) {
        return;
      }
    }
  }

  search(0);

  return {
    count: solutions.length,
    solutions,
    isUnique: solutions.length === 1,
  };
}

/**
 * Verifies whether all N regions on an NxN board are orthogonally connected.
 */
export function verifyRegionsConnectivity(regions: number[][], size: number): boolean {
  if (regions.length !== size) return false;

  for (let reg = 0; reg < size; reg++) {
    // Find all cells belonging to this region
    const cells: { r: number; c: number }[] = [];
    for (let r = 0; r < size; r++) {
      for (let c = 0; c < size; c++) {
        if (regions[r][c] === reg) {
          cells.push({ r, c });
        }
      }
    }

    if (cells.length === 0) return false;

    // Run BFS from first cell of region
    const visited = new Set<string>();
    const queue: { r: number; c: number }[] = [cells[0]];
    visited.add(`${cells[0].r}-${cells[0].c}`);

    while (queue.length > 0) {
      const cur = queue.shift()!;
      const neighbors = [
        { r: cur.r - 1, c: cur.c },
        { r: cur.r + 1, c: cur.c },
        { r: cur.r, c: cur.c - 1 },
        { r: cur.r, c: cur.c + 1 },
      ];

      for (const n of neighbors) {
        if (n.r >= 0 && n.r < size && n.c >= 0 && n.c < size) {
          if (regions[n.r][n.c] === reg && !visited.has(`${n.r}-${n.c}`)) {
            visited.add(`${n.r}-${n.c}`);
            queue.push(n);
          }
        }
      }
    }

    // All cells in this region must be reachable
    if (visited.size !== cells.length) {
      return false;
    }
  }

  return true;
}
