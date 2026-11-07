/**
 * KaryaDEX — Tango Solver & Procedural Generator Unit Tests
 *
 * Validates:
 * - Constraint solver finds valid solutions
 * - Single vs multiple vs zero solution detection
 * - Curated fallbacks across Easy, Medium, Hard are uniquely solvable
 * - Procedural generator produces unique puzzles
 * - Deterministic reproduction via seeds and daily challenge dates
 */

import { solveTango } from '../lib/playground/solvers/tangoSolver';
import {
  generateTangoPuzzle,
  getDailyTangoPuzzle,
  TANGO_CURATED_PUZZLES,
} from '../lib/playground/generators/tangoGenerator';
import type { GameDifficulty } from '@/types/playground';

describe('Tango Solver & Generator — Constraints, Solvability & Seeds', () => {
  describe('Solver Constraints & Uniqueness', () => {
    it('verifies that curated fallback puzzles have exactly 1 solution', () => {
      const difficulties: GameDifficulty[] = ['easy', 'medium', 'hard'];

      for (const diff of difficulties) {
        const puzzles = TANGO_CURATED_PUZZLES[diff];
        expect(puzzles.length).toBeGreaterThan(0);

        for (const puzzle of puzzles) {
          const res = solveTango(puzzle.givens, puzzle.constraints, 6, 2);
          expect(res.count).toBe(1);
          expect(res.isUnique).toBe(true);
        }
      }
    });

    it('detects multiple solutions on under-constrained boards', () => {
      // Board with only 1 given and no constraints has multiple solutions
      const looseGivens = [{ row: 0, col: 0, value: 'sun' as const }];
      const res = solveTango(looseGivens, [], 6, 2);
      expect(res.count).toBe(2);
      expect(res.isUnique).toBe(false);
    });

    it('detects 0 solutions on conflicting boards', () => {
      // Direct contradiction: (0,0) and (0,1) must equal, but givens make them opposite!
      const conflictingGivens = [
        { row: 0, col: 0, value: 'sun' as const },
        { row: 0, col: 1, value: 'moon' as const },
      ];
      const conflictingConstraints = [
        { row1: 0, col1: 0, row2: 0, col2: 1, type: 'equal' as const },
      ];

      const res = solveTango(conflictingGivens, conflictingConstraints, 6, 2);
      expect(res.count).toBe(0);
      expect(res.isUnique).toBe(false);
    });
  });

  describe('Procedural Generator & Seed Reproducibility', () => {
    it('generates a verified unique Tango puzzle', () => {
      const puzzle = generateTangoPuzzle({
        difficulty: 'medium',
        seed: 'tango-unit-test-seed-1',
      });

      expect(puzzle.size).toBe(6);
      expect(puzzle.givens.length).toBeGreaterThanOrEqual(5);

      const res = solveTango(puzzle.givens, puzzle.constraints, 6, 2);
      expect(res.isUnique).toBe(true);
    });

    it('produces identical puzzles when given identical seeds', () => {
      const puzzleA = generateTangoPuzzle({
        difficulty: 'easy',
        seed: 'consistent-tango-seed-99',
      });
      const puzzleB = generateTangoPuzzle({
        difficulty: 'easy',
        seed: 'consistent-tango-seed-99',
      });

      expect(puzzleA.givens).toEqual(puzzleB.givens);
      expect(puzzleA.constraints).toEqual(puzzleB.constraints);
      expect(puzzleA.solution).toEqual(puzzleB.solution);
    });

    it('generates deterministic daily puzzles for a calendar date', () => {
      const dailyA = getDailyTangoPuzzle('2026-11-01', 'medium');
      const dailyB = getDailyTangoPuzzle('2026-11-01', 'medium');

      expect(dailyA.givens).toEqual(dailyB.givens);
      expect(dailyA.constraints).toEqual(dailyB.constraints);
      expect(dailyA.solution).toEqual(dailyB.solution);
    });
  });
});
