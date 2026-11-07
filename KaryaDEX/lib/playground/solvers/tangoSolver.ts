/**
 * KaryaDEX — Tango Constraint Solver
 *
 * Solves 6x6 Sun & Moon binary constraint puzzles:
 * - Exactly 3 Suns and 3 Moons per row and column
 * - No 3 identical adjacent symbols horizontally or vertically
 * - Equal '=' and opposite '×' edge constraints
 * - Respects given fixed cells
 *
 * Counts solutions with early stop (maxSolutions) for uniqueness checking.
 */

import type { TangoConstraint } from '@/types/playground';

export type TangoVal = 'sun' | 'moon';

export interface TangoSolverResult {
  count: number;
  solutions: TangoVal[][][];
  isUnique: boolean;
}

export function solveTango(
  givens: { row: number; col: number; value: TangoVal }[],
  constraints: TangoConstraint[],
  size: number = 6,
  maxSolutions: number = 2
): TangoSolverResult {
  const target = size / 2;
  const board: (TangoVal | null)[][] = Array.from({ length: size }, () =>
    Array(size).fill(null)
  );

  // Place givens
  for (const g of givens) {
    board[g.row][g.col] = g.value;
  }

  // Validate that initial givens do not violate parity, 3-in-a-row, or gate constraints
  for (let r = 0; r < size; r++) {
    let s = 0;
    let m = 0;
    for (let c = 0; c < size; c++) {
      if (board[r][c] === 'sun') s++;
      else if (board[r][c] === 'moon') m++;
      if (c >= 2 && board[r][c] && board[r][c] === board[r][c - 1] && board[r][c] === board[r][c - 2]) {
        return { count: 0, solutions: [], isUnique: false };
      }
    }
    if (s > target || m > target) return { count: 0, solutions: [], isUnique: false };
  }

  for (let c = 0; c < size; c++) {
    let s = 0;
    let m = 0;
    for (let r = 0; r < size; r++) {
      if (board[r][c] === 'sun') s++;
      else if (board[r][c] === 'moon') m++;
      if (r >= 2 && board[r][c] && board[r][c] === board[r - 1][c] && board[r][c] === board[r - 2][c]) {
        return { count: 0, solutions: [], isUnique: false };
      }
    }
    if (s > target || m > target) return { count: 0, solutions: [], isUnique: false };
  }

  for (const ct of constraints) {
    const v1 = board[ct.row1][ct.col1];
    const v2 = board[ct.row2][ct.col2];
    if (v1 && v2) {
      if (ct.type === 'equal' && v1 !== v2) return { count: 0, solutions: [], isUnique: false };
      if (ct.type === 'opposite' && v1 === v2) return { count: 0, solutions: [], isUnique: false };
    }
  }

  // Pre-index constraints for O(1) lookup
  const adjConstraints: { row: number; col: number; type: 'equal' | 'opposite' }[][][] =
    Array.from({ length: size }, () =>
      Array.from({ length: size }, () => [])
    );

  for (const ct of constraints) {
    adjConstraints[ct.row1][ct.col1].push({
      row: ct.row2,
      col: ct.col2,
      type: ct.type,
    });
    adjConstraints[ct.row2][ct.col2].push({
      row: ct.row1,
      col: ct.col1,
      type: ct.type,
    });
  }

  // Check if board state is locally consistent after placing at (r, c)
  function isSafe(r: number, c: number, val: TangoVal): boolean {
    // 1. Row counts
    let sunsRow = 0;
    let moonsRow = 0;
    for (let j = 0; j < size; j++) {
      const v = j === c ? val : board[r][j];
      if (v === 'sun') sunsRow++;
      else if (v === 'moon') moonsRow++;
    }
    if (sunsRow > target || moonsRow > target) return false;

    // 2. Col counts
    let sunsCol = 0;
    let moonsCol = 0;
    for (let i = 0; i < size; i++) {
      const v = i === r ? val : board[i][c];
      if (v === 'sun') sunsCol++;
      else if (v === 'moon') moonsCol++;
    }
    if (sunsCol > target || moonsCol > target) return false;

    // 3. Horizontal 3-in-a-row
    // Check (r, c-2), (r, c-1), (r, c)
    if (c >= 2 && board[r][c - 1] === val && board[r][c - 2] === val) return false;
    // Check (r, c-1), (r, c), (r, c+1)
    if (c >= 1 && c < size - 1 && board[r][c - 1] === val && board[r][c + 1] === val) return false;
    // Check (r, c), (r, c+1), (r, c+2)
    if (c <= size - 3 && board[r][c + 1] === val && board[r][c + 2] === val) return false;

    // 4. Vertical 3-in-a-row
    if (r >= 2 && board[r - 1][c] === val && board[r - 2][c] === val) return false;
    if (r >= 1 && r < size - 1 && board[r - 1][c] === val && board[r + 1][c] === val) return false;
    if (r <= size - 3 && board[r + 1][c] === val && board[r + 2][c] === val) return false;

    // 5. Gate constraints
    for (const ct of adjConstraints[r][c]) {
      const neighborVal = board[ct.row][ct.col];
      if (neighborVal !== null) {
        if (ct.type === 'equal' && val !== neighborVal) return false;
        if (ct.type === 'opposite' && val === neighborVal) return false;
      }
    }

    return true;
  }

  const solutions: TangoVal[][][] = [];

  function search(r: number, c: number): void {
    if (solutions.length >= maxSolutions) return;

    if (r === size) {
      // Complete board found, verify full columns and rows
      const copy: TangoVal[][] = board.map((row) => [...(row as TangoVal[])]);
      solutions.push(copy);
      return;
    }

    const nextR = c === size - 1 ? r + 1 : r;
    const nextC = c === size - 1 ? 0 : c + 1;

    if (board[r][c] !== null) {
      search(nextR, nextC);
      return;
    }

    for (const val of ['sun', 'moon'] as const) {
      if (isSafe(r, c, val)) {
        board[r][c] = val;
        search(nextR, nextC);
        board[r][c] = null;

        if (solutions.length >= maxSolutions) return;
      }
    }
  }

  search(0, 0);

  return {
    count: solutions.length,
    solutions,
    isUnique: solutions.length === 1,
  };
}
