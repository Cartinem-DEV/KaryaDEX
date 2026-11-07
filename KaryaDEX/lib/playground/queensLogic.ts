/**
 * KaryaDEX — Queens Logic Engine
 *
 * Pure functions for Queens puzzle validation:
 * - 1 queen per row
 * - 1 queen per column
 * - 1 queen per colored territory
 * - No adjacent queens (including diagonals, Chebyshev distance >= 2)
 * - Accessible territory borders & identifiers
 */

export type QueensCellState = 'empty' | 'dot' | 'queen';

export interface QueenPosition {
  row: number;
  col: number;
  region: number;
}

/**
 * Finds all conflicting queens on the board.
 * Returns a set of coordinate strings "r-c" for any queen in violation.
 */
export function findQueensConflicts(
  board: QueensCellState[][],
  regions: number[][],
  size: number
): Set<string> {
  const queens: QueenPosition[] = [];
  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r]?.[c] === 'queen') {
        queens.push({ row: r, col: c, region: regions[r][c] });
      }
    }
  }

  const conflicts = new Set<string>();

  for (let i = 0; i < queens.length; i++) {
    for (let j = i + 1; j < queens.length; j++) {
      const q1 = queens[i];
      const q2 = queens[j];

      const sameRow = q1.row === q2.row;
      const sameCol = q1.col === q2.col;
      const sameRegion = q1.region === q2.region;
      const isTouching =
        Math.abs(q1.row - q2.row) <= 1 && Math.abs(q1.col - q2.col) <= 1;

      if (sameRow || sameCol || sameRegion || isTouching) {
        conflicts.add(`${q1.row}-${q1.col}`);
        conflicts.add(`${q2.row}-${q2.col}`);
      }
    }
  }

  return conflicts;
}

/**
 * Checks if the board satisfies all winning conditions.
 */
export function checkQueensWin(
  board: QueensCellState[][],
  regions: number[][],
  size: number
): boolean {
  const conflicts = findQueensConflicts(board, regions, size);
  if (conflicts.size > 0) return false;

  const rowCounts = new Set<number>();
  const colCounts = new Set<number>();
  const regionCounts = new Set<number>();
  let totalQueens = 0;

  for (let r = 0; r < size; r++) {
    for (let c = 0; c < size; c++) {
      if (board[r]?.[c] === 'queen') {
        totalQueens++;
        rowCounts.add(r);
        colCounts.add(c);
        regionCounts.add(regions[r][c]);
      }
    }
  }

  return (
    totalQueens === size &&
    rowCounts.size === size &&
    colCounts.size === size &&
    regionCounts.size === size
  );
}

/**
 * Determines whether a cell is on a territory border (top, bottom, left, right),
 * allowing high-contrast thick outline borders between different regions.
 */
export function getTerritoryBorderOffsets(
  regions: number[][],
  r: number,
  c: number,
  size: number
): {
  borderTopWidth: number;
  borderBottomWidth: number;
  borderLeftWidth: number;
  borderRightWidth: number;
} {
  const currentRegion = regions[r][c];

  const borderTop = r === 0 || regions[r - 1][c] !== currentRegion;
  const borderBottom = r === size - 1 || regions[r + 1][c] !== currentRegion;
  const borderLeft = c === 0 || regions[r][c - 1] !== currentRegion;
  const borderRight = c === size - 1 || regions[r][c + 1] !== currentRegion;

  return {
    borderTopWidth: borderTop ? 2.5 : 0.5,
    borderBottomWidth: borderBottom ? 2.5 : 0.5,
    borderLeftWidth: borderLeft ? 2.5 : 0.5,
    borderRightWidth: borderRight ? 2.5 : 0.5,
  };
}

/**
 * Letters for accessible territory labels (A, B, C, D, ...).
 */
export function getTerritoryIdentifier(regionId: number): string {
  return String.fromCharCode(65 + (regionId % 26));
}
