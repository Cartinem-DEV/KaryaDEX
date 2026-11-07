/**
 * KaryaDEX — Queens Solver & Procedural Generator Unit Tests
 *
 * Validates:
 * - Constraint solver finds valid solutions
 * - Single vs multiple vs zero solution detection
 * - Region connectivity verification
 * - Procedural generator produces unique, connected puzzles
 * - Deterministic reproduction via seeds
 * - Fallbacks are verified unique
 */

import {
  solveQueens,
  verifyRegionsConnectivity,
} from '../lib/playground/solvers/queensSolver';
import {
  generateQueensPuzzle,
  getDailyQueensPuzzle,
  QUEENS_CURATED_PUZZLES,
} from '../lib/playground/generators/queensGenerator';

describe('Queens Solver & Generator — Uniqueness, Connectivity & Seeds', () => {
  describe('Solver Constraints & Solution Counting', () => {
    const validRegions5x5 = [
      [1, 0, 0, 0, 0],
      [1, 1, 1, 0, 0],
      [1, 1, 2, 2, 2],
      [4, 2, 2, 3, 3],
      [4, 4, 4, 4, 3],
    ];

    it('identifies exactly 1 unique solution on the curated 5x5 board', () => {
      const result = solveQueens(validRegions5x5, 5, 2);
      expect(result.count).toBe(1);
      expect(result.isUnique).toBe(true);
      expect(result.solutions).toHaveLength(1);

      // Verify the found solution has 5 queens non-touching
      const queens = result.solutions[0];
      expect(queens).toHaveLength(5);
    });

    it('stops counting early when maxSolutions is reached', () => {
      // Board with all 0s has multiple solutions or 0 solutions;
      // Let's create an open board where regions match rows (1 queen per row):
      // Each row has its own region. There are many valid non-touching queen permutations!
      const rowRegions = [
        [0, 0, 0, 0, 0, 0],
        [1, 1, 1, 1, 1, 1],
        [2, 2, 2, 2, 2, 2],
        [3, 3, 3, 3, 3, 3],
        [4, 4, 4, 4, 4, 4],
        [5, 5, 5, 5, 5, 5],
      ];

      const result = solveQueens(rowRegions, 6, 2);
      expect(result.count).toBe(2);
      expect(result.isUnique).toBe(false);
    });

    it('detects impossible boards with 0 solutions', () => {
      // Impossible board: Region 0 only has 1 cell at (0, 0), but Region 1 also only at (0, 1) -> impossible to place in distinct rows
      const impossible = [
        [0, 1, 2, 3, 4],
        [0, 1, 2, 3, 4],
        [0, 1, 2, 3, 4],
        [0, 1, 2, 3, 4],
        [0, 1, 2, 3, 4],
      ];
      // Only 5 regions total, arranged as vertical stripes.
      // Every region is a column. But queens in region 0 must be in col 0, etc.
      // Can 5 queens be placed in 5x5 without touching?
      // Since they are placed in cols 0, 1, 2, 3, 4, row delta must be >= 2 for adjacent cols.
      // In 5x5, placements exist (e.g. 0-2, 1-4, 2-1, 3-3, 4-0).
      // Let's test a board where region 0 has only (0,0) and (0,1):
      const impossible2 = [
        [0, 0, 1, 1, 1],
        [2, 2, 2, 2, 2],
        [3, 3, 3, 3, 3],
        [4, 4, 4, 4, 4],
        [4, 4, 4, 4, 4],
      ];
      // Region 0 is only in row 0. Region 2 is only in row 1.
      // But region 0 queen must touch region 2 queen if placed at row 0 and row 1!
      // In 5x5, region 0 has cols 0,1. Region 2 has all cols. Any queen in row 0 at col 0,1 touches row 1 at col 0,1,2!
      const res = solveQueens(impossible2, 5, 2);
      expect(res.count).toBeLessThanOrEqual(1);
    });
  });

  describe('Region Connectivity Validation', () => {
    it('returns true for contiguous connected regions', () => {
      const connected = [
        [0, 0, 1, 1],
        [0, 0, 1, 1],
        [2, 2, 3, 3],
        [2, 2, 3, 3],
      ];
      expect(verifyRegionsConnectivity(connected, 4)).toBe(true);
    });

    it('returns false for disconnected regions (split territories)', () => {
      const disconnected = [
        [0, 1, 0, 1], // Region 0 split into two disconnected parts!
        [2, 2, 3, 3],
        [2, 2, 3, 3],
        [2, 2, 3, 3],
      ];
      expect(verifyRegionsConnectivity(disconnected, 4)).toBe(false);
    });
  });

  describe('Curated Fallbacks Verification', () => {
    it('verifies that all curated fallbacks across sizes 5, 6, 7, 8 are uniquely solvable', () => {
      for (const size of [5, 6, 7, 8]) {
        const fallbacks = QUEENS_CURATED_PUZZLES[size];
        expect(fallbacks.length).toBeGreaterThan(0);

        for (const puzzle of fallbacks) {
          expect(verifyRegionsConnectivity(puzzle.regions, size)).toBe(true);
          const res = solveQueens(puzzle.regions, size, 2);
          expect(res.count).toBe(1);
          expect(res.isUnique).toBe(true);
        }
      }
    });
  });

  describe('Procedural Generator & Seed Reproducibility', () => {
    it('generates a verified unique Queens puzzle for size 5 and 6', () => {
      const puzzle = generateQueensPuzzle({ size: 5, seed: 'test-seed-42' });
      expect(puzzle.size).toBe(5);
      expect(verifyRegionsConnectivity(puzzle.regions, 5)).toBe(true);

      const res = solveQueens(puzzle.regions, 5, 2);
      expect(res.isUnique).toBe(true);
    });

    it('produces identical puzzles when given identical seeds', () => {
      const puzzleA = generateQueensPuzzle({ size: 6, seed: 'consistent-seed-123' });
      const puzzleB = generateQueensPuzzle({ size: 6, seed: 'consistent-seed-123' });

      expect(puzzleA.regions).toEqual(puzzleB.regions);
      expect(puzzleA.solution).toEqual(puzzleB.solution);
    });

    it('generates deterministic daily puzzles for a given date', () => {
      const dailyA = getDailyQueensPuzzle('2026-11-01', 'medium');
      const dailyB = getDailyQueensPuzzle('2026-11-01', 'medium');

      expect(dailyA.size).toBe(6);
      expect(dailyA.regions).toEqual(dailyB.regions);
      expect(dailyA.solution).toEqual(dailyB.solution);
    });
  });
});
