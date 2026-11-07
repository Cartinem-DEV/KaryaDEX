/**
 * KaryaDEX — Sprint Duel Engine Unit Tests
 *
 * Validates:
 * - Arithmetic equation generation
 * - Safe integer division guarantees (no zero division, no decimals)
 * - Safe subtraction guarantees (positive non-zero answers)
 * - Safe numpad input handling (empty, single-digit, multi-digit, backspace, clear, invalid characters)
 * - Answer validation logic
 * - Combo multiplier progression
 */

import {
  generateQuestion,
  handleNumpadInput,
  validateAnswer,
  calculateComboMultiplier,
} from '../lib/playground/sprintDuelLogic';

describe('Sprint Duel Engine — Logic & Keypad Input', () => {
  describe('Equation Generation & Safe Arithmetic', () => {
    it('generates valid questions across all four operators', () => {
      const operatorsSeen = new Set<string>();

      for (let i = 0; i < 200; i++) {
        const q = generateQuestion();
        operatorsSeen.add(q.operator);

        expect(['+', '-', '×', '÷']).toContain(q.operator);
        expect(typeof q.top).toBe('number');
        expect(typeof q.bottom).toBe('number');
        expect(typeof q.answer).toBe('number');

        if (q.operator === '+') {
          expect(q.top + q.bottom).toBe(q.answer);
        } else if (q.operator === '-') {
          expect(q.top - q.bottom).toBe(q.answer);
          expect(q.answer).toBeGreaterThan(0);
        } else if (q.operator === '×') {
          expect(q.top * q.bottom).toBe(q.answer);
        } else if (q.operator === '÷') {
          // Verify exact integer division and non-zero divisor
          expect(q.bottom).toBeGreaterThanOrEqual(2);
          expect(q.top % q.bottom).toBe(0);
          expect(q.top / q.bottom).toBe(q.answer);
        }
      }

      // All 4 operators must appear over 200 samples
      expect(operatorsSeen.has('+')).toBe(true);
      expect(operatorsSeen.has('-')).toBe(true);
      expect(operatorsSeen.has('×')).toBe(true);
      expect(operatorsSeen.has('÷')).toBe(true);
    });
  });

  describe('BUG-09: Numpad Backspace, Clear & Input Sanitization', () => {
    it('handles backspace on empty input safely', () => {
      expect(handleNumpadInput('', '⌫')).toBe('');
    });

    it('removes only the last entered digit on backspace', () => {
      // Single digit to empty
      expect(handleNumpadInput('7', '⌫')).toBe('');

      // Multi digit
      expect(handleNumpadInput('42', '⌫')).toBe('4');
      expect(handleNumpadInput('125', '⌫')).toBe('12');
      expect(handleNumpadInput('9999', '⌫')).toBe('999');
    });

    it('clears entire input when C is pressed', () => {
      expect(handleNumpadInput('123', 'C')).toBe('');
      expect(handleNumpadInput('9', 'C')).toBe('');
      expect(handleNumpadInput('', 'C')).toBe('');
    });

    it('appends numeric digits correctly up to max length', () => {
      let val = '';
      val = handleNumpadInput(val, '4');
      expect(val).toBe('4');
      val = handleNumpadInput(val, '8');
      expect(val).toBe('48');
      val = handleNumpadInput(val, '0');
      expect(val).toBe('480');

      // Max 5 digits
      val = handleNumpadInput(val, '1');
      val = handleNumpadInput(val, '2');
      expect(val).toBe('48012');
      // 6th digit should be rejected
      const overflow = handleNumpadInput(val, '9');
      expect(overflow).toBe('48012');
    });

    it('ignores non-numeric or invalid input keys', () => {
      expect(handleNumpadInput('42', '.')).toBe('42');
      expect(handleNumpadInput('42', '-')).toBe('42');
      expect(handleNumpadInput('42', 'abc')).toBe('42');
    });
  });

  describe('Answer Validation', () => {
    const question = { top: 24, bottom: 6, operator: '÷' as const, answer: 4 };
    const multiDigitQ = { top: 75, bottom: 48, operator: '+' as const, answer: 123 };

    it('evaluates empty or incomplete input', () => {
      expect(validateAnswer(question, '')).toEqual({
        isCorrect: false,
        isWrong: false,
        isComplete: false,
      });

      // Partial multi-digit input
      expect(validateAnswer(multiDigitQ, '12')).toEqual({
        isCorrect: false,
        isWrong: false,
        isComplete: false,
      });
    });

    it('detects correct answer immediately', () => {
      expect(validateAnswer(question, '4')).toEqual({
        isCorrect: true,
        isWrong: false,
        isComplete: true,
      });

      expect(validateAnswer(multiDigitQ, '123')).toEqual({
        isCorrect: true,
        isWrong: false,
        isComplete: true,
      });
    });

    it('detects wrong answer once full length reached', () => {
      expect(validateAnswer(question, '5')).toEqual({
        isCorrect: false,
        isWrong: true,
        isComplete: true,
      });

      expect(validateAnswer(multiDigitQ, '124')).toEqual({
        isCorrect: false,
        isWrong: true,
        isComplete: true,
      });
    });
  });

  describe('Multiplier Progression', () => {
    it('scales multiplier dynamically with combo streaks', () => {
      expect(calculateComboMultiplier(0).multiplier).toBe(1.0);
      expect(calculateComboMultiplier(1).multiplier).toBe(1.0);
      expect(calculateComboMultiplier(2).multiplier).toBe(1.5);
      expect(calculateComboMultiplier(3).multiplier).toBe(2.0);
      expect(calculateComboMultiplier(4).multiplier).toBe(2.0);
      expect(calculateComboMultiplier(5).multiplier).toBe(3.0);
      expect(calculateComboMultiplier(10).multiplier).toBe(3.0);
    });
  });
});
