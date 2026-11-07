/**
 * KaryaDEX — Tango Engine Unit Tests
 *
 * Validates:
 * - Three Suns and three Moons per row and column
 * - No three consecutive identical symbols horizontally or vertically
 * - Equal '=' constraint validation
 * - Opposite '×' constraint validation
 * - Winning state detection
 */

import {
  findTangoViolations,
  checkTangoWin,
  type TangoSymbol,
} from '../lib/playground/tangoLogic';
import type { TangoConstraint } from '@/types/playground';

describe('Tango Engine — Rules, Constraints & Win Conditions', () => {
  const constraints: TangoConstraint[] = [
    { row1: 0, col1: 1, row2: 0, col2: 2, type: 'equal' }, // (0,1) = (0,2)
    { row1: 1, col1: 0, row2: 1, col2: 1, type: 'opposite' }, // (1,0) × (1,1)
  ];

  const emptyBoard6x6: TangoSymbol[][] = Array.from({ length: 6 }, () =>
    Array(6).fill(null)
  );

  describe('3-in-a-Row Violations', () => {
    it('detects 3 identical symbols in a horizontal row', () => {
      const board = emptyBoard6x6.map((r) => [...r]);
      board[0][1] = 'sun';
      board[0][2] = 'sun';
      board[0][3] = 'sun';

      const violations = findTangoViolations(board, [], 6);
      expect(violations.has('0-1')).toBe(true);
      expect(violations.has('0-2')).toBe(true);
      expect(violations.has('0-3')).toBe(true);
    });

    it('detects 3 identical symbols in a vertical column', () => {
      const board = emptyBoard6x6.map((r) => [...r]);
      board[2][4] = 'moon';
      board[3][4] = 'moon';
      board[4][4] = 'moon';

      const violations = findTangoViolations(board, [], 6);
      expect(violations.has('2-4')).toBe(true);
      expect(violations.has('3-4')).toBe(true);
      expect(violations.has('4-4')).toBe(true);
    });
  });

  describe('Equal and Opposite Constraint Violations', () => {
    it('detects violation when equal constraint has different symbols', () => {
      const board = emptyBoard6x6.map((r) => [...r]);
      board[0][1] = 'sun';
      board[0][2] = 'moon'; // violated! (0,1) must equal (0,2)

      const violations = findTangoViolations(board, constraints, 6);
      expect(violations.has('0-1')).toBe(true);
      expect(violations.has('0-2')).toBe(true);
    });

    it('passes when equal constraint has matching symbols', () => {
      const board = emptyBoard6x6.map((r) => [...r]);
      board[0][1] = 'moon';
      board[0][2] = 'moon';

      const violations = findTangoViolations(board, [constraints[0]], 6);
      expect(violations.size).toBe(0);
    });

    it('detects violation when opposite constraint has identical symbols', () => {
      const board = emptyBoard6x6.map((r) => [...r]);
      board[1][0] = 'sun';
      board[1][1] = 'sun'; // violated! (1,0) must oppose (1,1)

      const violations = findTangoViolations(board, constraints, 6);
      expect(violations.has('1-0')).toBe(true);
      expect(violations.has('1-1')).toBe(true);
    });
  });

  describe('Win Condition Verification', () => {
    const validSolvedBoard: TangoSymbol[][] = [
      ['moon', 'sun', 'moon', 'sun', 'sun', 'moon'],
      ['moon', 'sun', 'sun', 'moon', 'sun', 'moon'],
      ['sun', 'moon', 'moon', 'sun', 'moon', 'sun'],
      ['sun', 'sun', 'moon', 'sun', 'moon', 'moon'],
      ['moon', 'moon', 'sun', 'moon', 'sun', 'sun'],
      ['sun', 'moon', 'sun', 'moon', 'moon', 'sun'],
    ];

    it('returns true for the fully valid 6x6 solution', () => {
      const puzzleConstraints: TangoConstraint[] = [
        { row1: 0, col1: 3, row2: 0, col2: 4, type: 'equal' }, // sun = sun
        { row1: 2, col1: 1, row2: 2, col2: 2, type: 'equal' }, // moon = moon
        { row1: 3, col1: 4, row2: 3, col2: 5, type: 'equal' }, // moon = moon
        { row1: 1, col1: 0, row2: 1, col2: 1, type: 'opposite' }, // moon x sun
        { row1: 5, col1: 0, row2: 5, col2: 1, type: 'opposite' }, // sun x moon
      ];

      expect(checkTangoWin(validSolvedBoard, puzzleConstraints, 6)).toBe(true);
    });

    it('returns false if board contains nulls', () => {
      const incomplete = validSolvedBoard.map((r) => [...r]);
      incomplete[5][5] = null;
      expect(checkTangoWin(incomplete, [], 6)).toBe(false);
    });

    it('returns false if row count of suns and moons is uneven', () => {
      const uneven = validSolvedBoard.map((r) => [...r]);
      // Make row 0 have 4 suns, 2 moons by flipping index 0 (moon -> sun)
      uneven[0][0] = 'sun';
      expect(checkTangoWin(uneven, [], 6)).toBe(false);
    });
  });
});
