/**
 * KaryaDEX — Tango Logic Engine
 *
 * Pure functions for Tango Sun & Moon binary constraint puzzle validation:
 * - Equal number of suns and moons per row and column
 * - No 3 consecutive identical symbols horizontally or vertically
 * - Equal '=' and opposite '×' edge constraints
 */

import type { TangoConstraint } from '@/types/playground';

export type TangoSymbol = 'sun' | 'moon' | null;

/**
 * Finds all cell coordinates involved in a violation.
 */
export function findTangoViolations(
  board: TangoSymbol[][],
  constraints: TangoConstraint[],
  size: number
): Set<string> {
  const errorCells = new Set<string>();
  const targetPerSymbol = size / 2;

  // 1. Check 3-in-a-row horizontally
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size - 2; c++) {
      const v1 = board[r][c];
      const v2 = board[r][c + 1];
      const v3 = board[r][c + 2];
      if (v1 && v1 === v2 && v2 === v3) {
        errorCells.add(`${r}-${c}`);
        errorCells.add(`${r}-${c + 1}`);
        errorCells.add(`${r}-${c + 2}`);
      }
    }
  }

  // 2. Check 3-in-a-row vertically
  for (let c = 0; c < size; c++) {
    for (let r = 0; r < size - 2; r++) {
      const v1 = board[r][c];
      const v2 = board[r + 1][c];
      const v3 = board[r + 2][c];
      if (v1 && v1 === v2 && v2 === v3) {
        errorCells.add(`${r}-${c}`);
        errorCells.add(`${r + 1}-${c}`);
        errorCells.add(`${r + 2}-${c}`);
      }
    }
  }

  // 3. Check for excess suns or moons in rows
  for (let r = 0; r < size; r++) {
    let suns = 0;
    let moons = 0;
    for (let c = 0; c < size; c++) {
      if (board[r][c] === 'sun') suns++;
      if (board[r][c] === 'moon') moons++;
    }
    if (suns > targetPerSymbol || moons > targetPerSymbol) {
      for (let c = 0; c < size; c++) {
        if (
          (suns > targetPerSymbol && board[r][c] === 'sun') ||
          (moons > targetPerSymbol && board[r][c] === 'moon')
        ) {
          errorCells.add(`${r}-${c}`);
        }
      }
    }
  }

  // 4. Check for excess suns or moons in columns
  for (let c = 0; c < size; c++) {
    let suns = 0;
    let moons = 0;
    for (let r = 0; r < size; r++) {
      if (board[r][c] === 'sun') suns++;
      if (board[r][c] === 'moon') moons++;
    }
    if (suns > targetPerSymbol || moons > targetPerSymbol) {
      for (let r = 0; r < size; r++) {
        if (
          (suns > targetPerSymbol && board[r][c] === 'sun') ||
          (moons > targetPerSymbol && board[r][c] === 'moon')
        ) {
          errorCells.add(`${r}-${c}`);
        }
      }
    }
  }

  // 5. Check constraints
  for (const ct of constraints) {
    const val1 = board[ct.row1][ct.col1];
    const val2 = board[ct.row2][ct.col2];

    if (val1 && val2) {
      if (ct.type === 'equal' && val1 !== val2) {
        errorCells.add(`${ct.row1}-${ct.col1}`);
        errorCells.add(`${ct.row2}-${ct.col2}`);
      } else if (ct.type === 'opposite' && val1 === val2) {
        errorCells.add(`${ct.row1}-${ct.col1}`);
        errorCells.add(`${ct.row2}-${ct.col2}`);
      }
    }
  }

  return errorCells;
}

/**
 * Checks if the board is completely and correctly solved.
 */
export function checkTangoWin(
  board: TangoSymbol[][],
  constraints: TangoConstraint[],
  size: number
): boolean {
  const targetPerSymbol = size / 2;

  // 1. All cells must be non-null
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (!board[r][c]) return false;
    }
  }

  // 2. No violations
  const violations = findTangoViolations(board, constraints, size);
  if (violations.size > 0) return false;

  // 3. Exactly targetPerSymbol of each in every row & column
  for (let r = 0; r < size; r++) {
    let suns = 0;
    let moons = 0;
    for (let c = 0; c < size; c++) {
      if (board[r][c] === 'sun') suns++;
      if (board[r][c] === 'moon') moons++;
    }
    if (suns !== targetPerSymbol || moons !== targetPerSymbol) return false;
  }

  for (let c = 0; c < size; c++) {
    let suns = 0;
    let moons = 0;
    for (let r = 0; r < size; r++) {
      if (board[r][c] === 'sun') suns++;
      if (board[r][c] === 'moon') moons++;
    }
    if (suns !== targetPerSymbol || moons !== targetPerSymbol) return false;
  }

  return true;
}
