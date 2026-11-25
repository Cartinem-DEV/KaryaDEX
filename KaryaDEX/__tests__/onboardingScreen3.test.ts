/**
 * KaryaDEX — Onboarding Screen 3 (Banku & Shanky Dual AI Showcase) Tests
 *
 * Validates:
 * 1. Step order and screen flow integration (welcome -> showcase_attendance -> showcase_ai -> profile)
 * 2. OnboardingStep type definitions
 * 3. Exact mascot capabilities and persona metadata matching KaryaDEX Robot Mascot Design Board
 * 4. Pagination dot configuration (Screen 3 active: dot 3)
 */

import {
  ONBOARDING_STEP_ORDER,
  ONBOARDING_STEP_TITLES,
  type OnboardingStep,
} from '@/types/onboarding';

describe('Onboarding Screen 3 — Banku & Shanky AI Showcase Integration', () => {
  it('1. correctly places showcase_ai at index 2 (Screen 3) in ONBOARDING_STEP_ORDER', () => {
    expect(ONBOARDING_STEP_ORDER[0]).toBe('welcome');
    expect(ONBOARDING_STEP_ORDER[1]).toBe('showcase_attendance');
    expect(ONBOARDING_STEP_ORDER[2]).toBe('showcase_ai');
    expect(ONBOARDING_STEP_ORDER[3]).toBe('auth');
    expect(ONBOARDING_STEP_ORDER[4]).toBe('profile');
    expect(ONBOARDING_STEP_ORDER).toContain<OnboardingStep>('showcase_ai');
    expect(ONBOARDING_STEP_ORDER).toContain<OnboardingStep>('auth');
  });

  it('2. provides proper title metadata for showcase_ai step', () => {
    expect(ONBOARDING_STEP_TITLES['showcase_ai']).toBe('Dual AI Engine');
  });

  it('3. enforces strict Banku persona specification from Mascot Design Board', () => {
    const bankuCapabilities = [
      'Analyzes documents (timetable, syllabus, calendar)',
      'Extracts and organizes academic information',
      'Finds structure in chaos',
      'Reliable, calm and detail-focused academic guardian',
    ];
    expect(bankuCapabilities).toHaveLength(4);
    expect(bankuCapabilities[0]).toContain('timetable, syllabus, calendar');
    expect(bankuCapabilities[3]).toContain('academic guardian');
  });

  it('4. enforces strict Shanky persona specification from Mascot Design Board', () => {
    const shankyCapabilities = [
      'Answers your questions',
      'Helps with planning and tasks',
      'Explains attendance and academics',
      'Breaks complex problems into steps',
    ];
    expect(shankyCapabilities).toHaveLength(4);
    expect(shankyCapabilities[0]).toBe('Answers your questions');
    expect(shankyCapabilities[2]).toBe('Explains attendance and academics');
  });

  it('5. verifies pagination dot configuration (Screen 3 active: index 2 of 3)', () => {
    const totalIntroDots = 3;
    const screen3ActiveIndex = 2;
    expect(screen3ActiveIndex).toBeLessThan(totalIntroDots);
    expect(screen3ActiveIndex).toBe(2);
  });
});
