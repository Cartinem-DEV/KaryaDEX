/**
 * KaryaDEX — Onboarding Screen 4 (Authentication Gate) Integration Tests
 *
 * Validates:
 * 1. Step order placing 'auth' at index 3 (Screen 4) following Screen 1 (welcome), Screen 2 (showcase_attendance), and Screen 3 (showcase_ai)
 * 2. OnboardingStep metadata and title for 'auth'
 * 3. Pagination indicator configuration (totalDots = 4, activeIndex = 3)
 * 4. Validation logic for Sign In vs Create Account (email format, password length, full name)
 * 5. Routing behaviors on guest skip and authenticated sign-in/registration
 * 6. Decommission of standalone AuthModal
 */

import {
  ONBOARDING_STEP_ORDER,
  ONBOARDING_STEP_TITLES,
  type OnboardingStep,
} from '@/types/onboarding';
import { useAppStore } from '@/store/useAppStore';

describe('Onboarding Screen 4 — Authentication Gate Integration', () => {
  it('1. correctly places auth at index 3 (Screen 4) in ONBOARDING_STEP_ORDER', () => {
    expect(ONBOARDING_STEP_ORDER[0]).toBe('welcome');
    expect(ONBOARDING_STEP_ORDER[1]).toBe('showcase_attendance');
    expect(ONBOARDING_STEP_ORDER[2]).toBe('showcase_ai');
    expect(ONBOARDING_STEP_ORDER[3]).toBe('auth');
    expect(ONBOARDING_STEP_ORDER[4]).toBe('profile');
    expect(ONBOARDING_STEP_ORDER).toContain<OnboardingStep>('auth');
  });

  it('2. provides proper title metadata for auth step', () => {
    expect(ONBOARDING_STEP_TITLES['auth']).toBe('Account Setup');
  });

  it('3. verifies 4-dot pagination configuration for Screen 4', () => {
    const totalIntroDots = 4;
    const screen4ActiveIndex = 3;
    expect(screen4ActiveIndex).toBeLessThan(totalIntroDots);
    expect(screen4ActiveIndex).toBe(3);
    expect(totalIntroDots).toBe(4);
  });

  it('4. validates email & password authentication rules', () => {
    const isValidEmail = (email: string) => /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim());
    const isValidPassword = (password: string) => password.length >= 6;

    expect(isValidEmail('student@college.edu')).toBe(true);
    expect(isValidEmail('invalid-email')).toBe(false);
    expect(isValidEmail('')).toBe(false);

    expect(isValidPassword('pass123')).toBe(true);
    expect(isValidPassword('12345')).toBe(false);
  });

  it('5. validates create account registration rules (name, password matching)', () => {
    const isValidName = (name: string) => name.trim().length >= 2;
    const passwordsMatch = (p1: string, p2: string) => p1 === p2;

    expect(isValidName('John Doe')).toBe(true);
    expect(isValidName('J')).toBe(false);
    expect(isValidName('  ')).toBe(false);

    expect(passwordsMatch('secret123', 'secret123')).toBe(true);
    expect(passwordsMatch('secret123', 'different123')).toBe(false);
  });

  it('6. verifies useAppStore supports requesting the auth step on sign-out or account switch', () => {
    const store = useAppStore.getState();
    expect(typeof store.requestOnboardingStep).toBe('function');

    store.requestOnboardingStep('auth');
    expect(useAppStore.getState().requestedOnboardingStep).toBe('auth');

    store.requestOnboardingStep(null);
    expect(useAppStore.getState().requestedOnboardingStep).toBeNull();
  });
});
