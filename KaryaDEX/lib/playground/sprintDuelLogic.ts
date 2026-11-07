/**
 * KaryaDEX — Sprint Duel Engine Logic
 *
 * Pure functions for arithmetic question generation, input handling,
 * answer validation, and score calculation.
 */

import type { MathQuestion } from '@/types/playground';

/**
 * Generates an arithmetic question with guaranteed integer division
 * and positive, non-zero results for subtraction.
 */
export function generateQuestion(): MathQuestion {
  const ops: Array<'+' | '-' | '×' | '÷'> = ['+', '-', '×', '÷'];
  const op = ops[Math.floor(Math.random() * ops.length)];

  if (op === '+') {
    const a = Math.floor(Math.random() * 85) + 12;
    const b = Math.floor(Math.random() * 85) + 8;
    return { top: a, bottom: b, operator: '+', answer: a + b };
  } else if (op === '-') {
    const b = Math.floor(Math.random() * 50) + 10;
    const ans = Math.floor(Math.random() * 60) + 12;
    const a = b + ans;
    return { top: a, bottom: b, operator: '-', answer: ans };
  } else if (op === '×') {
    const a = Math.floor(Math.random() * 11) + 2;
    const b = Math.floor(Math.random() * 11) + 2;
    return { top: a, bottom: b, operator: '×', answer: a * b };
  } else {
    // Safe integer division: dividend = divisor * quotient
    const divisor = Math.floor(Math.random() * 11) + 2; // [2, 12]
    const quotient = Math.floor(Math.random() * 12) + 2; // [2, 13]
    const dividend = divisor * quotient;
    return { top: dividend, bottom: divisor, operator: '÷', answer: quotient };
  }
}

/**
 * Handles numpad inputs safely with single-character backspace and clear.
 * - '⌫': removes only the last entered digit.
 * - 'C': clears the entire input.
 * - '0'-'9': appends the digit up to maxDigits (default 5).
 * - Ignores invalid characters, negative signs, and non-numeric input.
 */
export function handleNumpadInput(
  currentInput: string,
  key: string,
  maxDigits: number = 5
): string {
  if (key === '⌫') {
    if (!currentInput) return '';
    return currentInput.slice(0, -1);
  }

  if (key === 'C') {
    return '';
  }

  // Only allow single digit characters '0'..'9'
  if (/^[0-9]$/.test(key)) {
    if (currentInput.length >= maxDigits) {
      return currentInput;
    }
    return currentInput + key;
  }

  return currentInput;
}

/**
 * Validates the user's current entered text against the expected answer.
 */
export function validateAnswer(
  question: MathQuestion,
  input: string
): {
  isCorrect: boolean;
  isWrong: boolean;
  isComplete: boolean;
} {
  if (!input) {
    return { isCorrect: false, isWrong: false, isComplete: false };
  }

  const parsed = parseInt(input, 10);
  if (isNaN(parsed)) {
    return { isCorrect: false, isWrong: false, isComplete: false };
  }

  if (parsed === question.answer) {
    return { isCorrect: true, isWrong: false, isComplete: true };
  }

  const expectedLength = String(question.answer).length;
  if (input.length >= expectedLength) {
    return { isCorrect: false, isWrong: true, isComplete: true };
  }

  return { isCorrect: false, isWrong: false, isComplete: false };
}

/**
 * Calculates multiplier badge and scale based on consecutive correct streak.
 */
export function calculateComboMultiplier(combo: number): {
  multiplier: number;
  label: string;
} {
  if (combo >= 5) {
    return { multiplier: 3.0, label: '3.0x ULTRA FIRE' };
  }
  if (combo >= 3) {
    return { multiplier: 2.0, label: '2.0x HOT STREAK' };
  }
  if (combo >= 2) {
    return { multiplier: 1.5, label: '1.5x COMBO' };
  }
  return { multiplier: 1.0, label: '' };
}
