/**
 * KaryaDEX — Queens Engine Unit Tests
 *
 * Validates:
 * - One queen per row
 * - One queen per column
 * - One queen per colored territory
 * - Diagonal adjacency detection (Chebyshev distance <= 1)
 * - Winning state detection
 * - Territory boundary calculations and accessible identifiers
 */

import {
  findQueensConflicts,
  checkQueensWin,
  getTerritoryBorderOffsets,
  getTerritoryIdentifier,
  type QueensCellState,
} from '../lib/playground/queensLogic';

describe('Queens Engine — Logic, Conflicts & Win Conditions', () => {
  const regions5x5 = [
    [0, 0, 1, 1, 1],
    [0, 2, 2, 1, 3],
    [0, 2, 4, 3, 3],
    [0, 2, 4, 4, 3],
    [0, 4, 4, 4, 3],
  ];

  const emptyBoard5x5: QueensCellState[][] = Array.from({ length: 5 }, () =>
    Array(5).fill('empty')
  );

  describe('Conflict Detection', () => {
    it('detects row conflicts', () => {
      const board = emptyBoard5x5.map((r) => [...r]);
      board[0][0] = 'queen';
      board[0][3] = 'queen';

      const conflicts = findQueensConflicts(board, regions5x5, 5);
      expect(conflicts.has('0-0')).toBe(true);
      expect(conflicts.has('0-3')).toBe(true);
    });

    it('detects column conflicts', () => {
      const board = emptyBoard5x5.map((r) => [...r]);
      board[1][2] = 'queen';
      board[4][2] = 'queen';

      const conflicts = findQueensConflicts(board, regions5x5, 5);
      expect(conflicts.has('1-2')).toBe(true);
      expect(conflicts.has('4-2')).toBe(true);
    });

    it('detects region conflicts when two queens share the same colored territory', () => {
      const board = emptyBoard5x5.map((r) => [...r]);
      // regions[0][0] is 0, regions[1][0] is 0 (also vertical conflict, but let's test non-touching in same region)
      // regions[1][1] is 2, regions[3][1] is 2 (rows 1 and 3, col 1, let's put row 1 col 1 and row 3 col 1: both region 2)
      board[1][1] = 'queen';
      board[3][1] = 'queen';

      const conflicts = findQueensConflicts(board, regions5x5, 5);
      expect(conflicts.has('1-1')).toBe(true);
      expect(conflicts.has('3-1')).toBe(true);
    });

    it('detects diagonal touching conflicts (Chebyshev distance <= 1)', () => {
      const board = emptyBoard5x5.map((r) => [...r]);
      // (0, 2) in region 1 and (1, 3) in region 1 are diagonally touching
      // Even if different regions: (0, 1) region 0 and (1, 2) region 2:
      board[0][1] = 'queen'; // region 0
      board[1][2] = 'queen'; // region 2
      // They touch diagonally!

      const conflicts = findQueensConflicts(board, regions5x5, 5);
      expect(conflicts.has('0-1')).toBe(true);
      expect(conflicts.has('1-2')).toBe(true);
    });

    it('reports no conflicts for non-touching, single-queen placements in different rows, cols, and regions', () => {
      const board = emptyBoard5x5.map((r) => [...r]);
      board[0][2] = 'queen'; // row 0, col 2, region 1
      board[2][1] = 'queen'; // row 2, col 1, region 2
      // delta row = 2, delta col = 1 -> Chebyshev dist is 2 (not touching)

      const conflicts = findQueensConflicts(board, regions5x5, 5);
      expect(conflicts.size).toBe(0);
    });
  });

  describe('Win Condition Verification', () => {
    it('returns false for an empty or partially filled board', () => {
      expect(checkQueensWin(emptyBoard5x5, regions5x5, 5)).toBe(false);

      const partial = emptyBoard5x5.map((r) => [...r]);
      partial[0][2] = 'queen';
      partial[1][4] = 'queen';
      expect(checkQueensWin(partial, regions5x5, 5)).toBe(false);
    });

    it('returns true for the complete, valid 5x5 Queens solution', () => {
      const solved = emptyBoard5x5.map((r) => [...r]);
      // Solution from puzzle:
      // (0, 2), (1, 4), (2, 1), (3, 3), (4, 0)
      solved[0][2] = 'queen';
      solved[1][4] = 'queen';
      solved[2][1] = 'queen';
      solved[3][3] = 'queen';
      solved[4][0] = 'queen';

      expect(checkQueensWin(solved, regions5x5, 5)).toBe(true);
    });

    it('returns false if 5 queens are placed but have a conflict', () => {
      const invalid = emptyBoard5x5.map((r) => [...r]);
      invalid[0][0] = 'queen';
      invalid[1][1] = 'queen'; // diagonal conflict
      invalid[2][2] = 'queen';
      invalid[3][3] = 'queen';
      invalid[4][4] = 'queen';

      expect(checkQueensWin(invalid, regions5x5, 5)).toBe(false);
    });
  });

  describe('BUG-10: Accessibility Boundaries & Labels', () => {
    it('computes distinct territory boundary widths', () => {
      // Cell (0,0) is top-left corner
      const borders = getTerritoryBorderOffsets(regions5x5, 0, 0, 5);
      expect(borders.borderTopWidth).toBe(2.5);
      expect(borders.borderLeftWidth).toBe(2.5);
    });

    it('maps region indices to uppercase alphabetical identifiers', () => {
      expect(getTerritoryIdentifier(0)).toBe('A');
      expect(getTerritoryIdentifier(1)).toBe('B');
      expect(getTerritoryIdentifier(2)).toBe('C');
      expect(getTerritoryIdentifier(3)).toBe('D');
      expect(getTerritoryIdentifier(4)).toBe('E');
      expect(getTerritoryIdentifier(5)).toBe('F');
    });
  });
});
