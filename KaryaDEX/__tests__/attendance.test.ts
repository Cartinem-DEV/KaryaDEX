/**
 * KaryaDEX — Attendance Calculation Tests
 * 
 * Tests for the attendance calculation utilities.
 * Covers edge cases: 0 classes, 100%, exactly at target, 
 * single class, large absence counts.
 */

import {
  calculatePercentage,
  getAttendanceStatus,
  calculateSafeBunks,
  calculateRecoveryClasses,
  projectAfterAbsence,
  projectAfterPresent,
  canBunk,
} from '../lib/attendance';

// ─── calculatePercentage ────────────────────────────────────────

describe('calculatePercentage', () => {
  it('returns 0 when total is 0', () => {
    expect(calculatePercentage(0, 0)).toBe(0);
  });

  it('calculates 100% correctly', () => {
    expect(calculatePercentage(10, 10)).toBe(100);
  });

  it('calculates normal percentage', () => {
    expect(calculatePercentage(23, 28)).toBeCloseTo(82.14, 1);
  });

  it('calculates 0% attendance', () => {
    expect(calculatePercentage(0, 10)).toBe(0);
  });

  it('handles single class attended', () => {
    expect(calculatePercentage(1, 1)).toBe(100);
  });

  it('handles single class missed', () => {
    expect(calculatePercentage(0, 1)).toBe(0);
  });
});

// ─── getAttendanceStatus ────────────────────────────────────────

describe('getAttendanceStatus', () => {
  it('returns safe when above target + 5', () => {
    expect(getAttendanceStatus(82, 75)).toBe('safe');
  });

  it('returns watch when exactly at target', () => {
    expect(getAttendanceStatus(75, 75)).toBe('watch');
  });

  it('returns watch when between target and target+5', () => {
    expect(getAttendanceStatus(78, 75)).toBe('watch');
  });

  it('returns danger when below target', () => {
    expect(getAttendanceStatus(70, 75)).toBe('danger');
  });

  it('handles 100% percentage', () => {
    expect(getAttendanceStatus(100, 75)).toBe('safe');
  });

  it('handles 0% percentage', () => {
    expect(getAttendanceStatus(0, 75)).toBe('danger');
  });
});

// ─── calculateSafeBunks ─────────────────────────────────────────

describe('calculateSafeBunks', () => {
  it('returns 0 when total is 0', () => {
    expect(calculateSafeBunks(0, 0, 75)).toBe(0);
  });

  it('calculates safe bunks correctly', () => {
    // 23/28 = 82.14%. Target 75%.
    // Max bunks: floor((23 - 0.75*28) / 0.75) = floor((23-21)/0.75) = floor(2.67) = 2
    expect(calculateSafeBunks(23, 28, 75)).toBe(2);
  });

  it('returns 0 when exactly at target', () => {
    // 15/20 = 75%. Target 75%.
    // Max bunks: floor((15 - 0.75*20) / 0.75) = floor(0/0.75) = 0
    expect(calculateSafeBunks(15, 20, 75)).toBe(0);
  });

  it('returns 0 when below target', () => {
    expect(calculateSafeBunks(14, 20, 75)).toBe(0);
  });

  it('handles high attendance', () => {
    // 27/30 = 90%. Target 75%.
    // floor((27 - 22.5) / 0.75) = floor(6) = 6
    expect(calculateSafeBunks(27, 30, 75)).toBe(6);
  });

  it('handles 100% attendance single class', () => {
    // 1/1 = 100%. Target 75%.
    // floor((1 - 0.75) / 0.75) = floor(0.333) = 0
    expect(calculateSafeBunks(1, 1, 75)).toBe(0);
  });

  it('handles large absence count correctly', () => {
    // 50/100 = 50%. Target 75%.
    expect(calculateSafeBunks(50, 100, 75)).toBe(0);
  });
});

// ─── calculateRecoveryClasses ───────────────────────────────────

describe('calculateRecoveryClasses', () => {
  it('returns 0 when total is 0', () => {
    expect(calculateRecoveryClasses(0, 0, 75)).toBe(0);
  });

  it('returns 0 when already above target', () => {
    expect(calculateRecoveryClasses(23, 28, 75)).toBe(0);
  });

  it('calculates recovery correctly', () => {
    // 14/20 = 70%. Target 75%.
    // Need: ceil((0.75*20 - 14) / (1-0.75)) = ceil((15-14)/0.25) = ceil(4) = 4
    expect(calculateRecoveryClasses(14, 20, 75)).toBe(4);
  });

  it('returns Infinity for 100% target when below', () => {
    expect(calculateRecoveryClasses(9, 10, 100)).toBe(Infinity);
  });

  it('handles exactly at target', () => {
    // 15/20 = 75%. Target 75%.
    expect(calculateRecoveryClasses(15, 20, 75)).toBe(0);
  });

  it('handles severe attendance deficit', () => {
    // 5/20 = 25%. Target 75%.
    // ceil((15-5)/0.25) = ceil(40) = 40
    expect(calculateRecoveryClasses(5, 20, 75)).toBe(40);
  });

  it('handles single class missed', () => {
    // 0/1 = 0%. Target 75%.
    // ceil((0.75 - 0) / 0.25) = ceil(3) = 3
    expect(calculateRecoveryClasses(0, 1, 75)).toBe(3);
  });
});

// ─── projectAfterAbsence ────────────────────────────────────────

describe('projectAfterAbsence', () => {
  it('projects correctly after 1 absence', () => {
    // 23/(28+1) = 23/29 ≈ 79.31%
    expect(projectAfterAbsence(23, 28, 1)).toBeCloseTo(79.31, 1);
  });

  it('projects correctly after multiple absences', () => {
    // 23/(28+3) = 23/31 ≈ 74.19%
    expect(projectAfterAbsence(23, 28, 3)).toBeCloseTo(74.19, 1);
  });

  it('returns 0 for 0 total + absences = 0', () => {
    expect(projectAfterAbsence(0, 0, 0)).toBe(0);
  });
});

// ─── projectAfterPresent ────────────────────────────────────────

describe('projectAfterPresent', () => {
  it('projects correctly after 1 present', () => {
    // (23+1)/(28+1) = 24/29 ≈ 82.76%
    expect(projectAfterPresent(23, 28, 1)).toBeCloseTo(82.76, 1);
  });

  it('handles 0 total', () => {
    // (0+1)/(0+1) = 1/1 = 100%
    expect(projectAfterPresent(0, 0, 1)).toBe(100);
  });
});

// ─── canBunk ────────────────────────────────────────────────────

describe('canBunk', () => {
  it('returns canBunk=true when safe', () => {
    // 23/28 = 82.14%. After bunk: 23/29 ≈ 79.31% > 75%
    const result = canBunk(23, 28, 75);
    expect(result.canBunk).toBe(true);
    expect(result.currentPercentage).toBeCloseTo(82.14, 1);
    expect(result.projectedPercentage).toBeCloseTo(79.31, 1);
  });

  it('returns canBunk=false when dangerous', () => {
    // 15/20 = 75%. After bunk: 15/21 ≈ 71.43% < 75%
    const result = canBunk(15, 20, 75);
    expect(result.canBunk).toBe(false);
  });

  it('handles 0 classes', () => {
    const result = canBunk(0, 0, 75);
    expect(result.canBunk).toBe(false);
    expect(result.emoji).toBe('🤷');
  });

  it('handles exactly at boundary', () => {
    // 3/4 = 75%. After bunk: 3/5 = 60% < 75%
    const result = canBunk(3, 4, 75);
    expect(result.canBunk).toBe(false);
  });

  it('returns encouraging message when safe with many bunks', () => {
    // 27/30 = 90%. After bunk: 27/31 ≈ 87.1% > 75%
    const result = canBunk(27, 30, 75);
    expect(result.canBunk).toBe(true);
    expect(result.emoji).toBe('😎');
  });
});
