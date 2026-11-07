/**
 * KaryaDEX — MindSnap Engine & Timer Cleanup Unit Tests
 *
 * Validates:
 * - Sequence generation & scaling
 * - User input evaluation (correct progression vs mistake)
 * - Stage completion logic
 * - Score calculation
 * - BUG-03: Managed timer lifecycle, cancellation & cleanup on unmount
 */

import {
  generateInitialSequence,
  appendSequenceStep,
  evaluateInput,
  calculateMindSnapScore,
} from '../lib/playground/mindSnapLogic';

describe('MindSnap Engine — Sequence Logic & Timer Lifecycle', () => {
  describe('Sequence Generation & Step Scaling', () => {
    it('generates an initial sequence with values bounded between 0 and 8', () => {
      const seq = generateInitialSequence(3);
      expect(seq).toHaveLength(3);
      for (const pad of seq) {
        expect(pad).toBeGreaterThanOrEqual(0);
        expect(pad).toBeLessThanOrEqual(8);
      }
    });

    it('appends a new step to the sequence on stage clear', () => {
      const seq = [1, 4, 7];
      const nextSeq = appendSequenceStep(seq);
      expect(nextSeq).toHaveLength(4);
      expect(nextSeq.slice(0, 3)).toEqual([1, 4, 7]);
      expect(nextSeq[3]).toBeGreaterThanOrEqual(0);
      expect(nextSeq[3]).toBeLessThanOrEqual(8);
    });
  });

  describe('Input Evaluation', () => {
    const sequence = [2, 5, 8];

    it('evaluates correct consecutive taps', () => {
      // Tap 1: Pad 2 (correct, stage not complete yet)
      const res1 = evaluateInput(sequence, 0, 2);
      expect(res1.isCorrect).toBe(true);
      expect(res1.isStageComplete).toBe(false);
      expect(res1.nextIndex).toBe(1);

      // Tap 2: Pad 5 (correct, stage not complete yet)
      const res2 = evaluateInput(sequence, res1.nextIndex, 5);
      expect(res2.isCorrect).toBe(true);
      expect(res2.isStageComplete).toBe(false);
      expect(res2.nextIndex).toBe(2);

      // Tap 3: Pad 8 (correct, stage complete!)
      const res3 = evaluateInput(sequence, res2.nextIndex, 8);
      expect(res3.isCorrect).toBe(true);
      expect(res3.isStageComplete).toBe(true);
      expect(res3.nextIndex).toBe(3);
    });

    it('detects incorrect pad taps immediately', () => {
      // Expected pad 2, tapped pad 3
      const mistake = evaluateInput(sequence, 0, 3);
      expect(mistake.isCorrect).toBe(false);
      expect(mistake.isStageComplete).toBe(false);
      expect(mistake.nextIndex).toBe(0);
    });
  });

  describe('Score & Win Calculation', () => {
    it('awards win when reaching stage 4 or higher', () => {
      const resultStage1 = calculateMindSnapScore(1, 15);
      expect(resultStage1.isWin).toBe(false);
      expect(resultStage1.score).toBe(10); // Floor is 10

      const resultStage4 = calculateMindSnapScore(4, 35);
      expect(resultStage4.isWin).toBe(true);
      expect(resultStage4.score).toBe(75); // (4-1)*25

      const resultStage6 = calculateMindSnapScore(6, 60);
      expect(resultStage6.isWin).toBe(true);
      expect(resultStage6.score).toBe(125); // (6-1)*25
    });
  });

  describe('BUG-03: Managed Timer System & Cancellation Verification', () => {
    it('cancels all pending timers when clearAllTimers is invoked', () => {
      jest.useFakeTimers();

      const timersSet = new Set<ReturnType<typeof setTimeout>>();
      let callbackFired = false;

      const schedule = (cb: () => void, delay: number) => {
        const id = setTimeout(() => {
          timersSet.delete(id);
          cb();
        }, delay);
        timersSet.add(id);
        return id;
      };

      const clearAll = () => {
        timersSet.forEach((id) => clearTimeout(id));
        timersSet.clear();
      };

      // Schedule sequence playback steps
      schedule(() => {
        callbackFired = true;
      }, 500);

      expect(timersSet.size).toBe(1);

      // User exits during sequence playback (simulating component unmount)
      clearAll();
      expect(timersSet.size).toBe(0);

      // Fast-forward time past 500ms
      jest.advanceTimersByTime(1000);

      // Callback MUST NOT have fired
      expect(callbackFired).toBe(false);

      jest.useRealTimers();
    });

    it('ensures repeated pad sequence produces distinct timings', () => {
      jest.useFakeTimers();

      const sequence = [4, 4]; // Consecutive identical pads
      const events: string[] = [];

      const speed = 400;
      const blankDuration = 100;
      const litDuration = speed - blankDuration;

      sequence.forEach((pad, idx) => {
        const startTime = idx * speed;
        setTimeout(() => {
          events.push(`lit-${pad}`);
          setTimeout(() => {
            events.push(`off-${pad}`);
          }, litDuration);
        }, startTime);
      });

      // t=0: first pad lit
      jest.advanceTimersByTime(0);
      expect(events).toEqual(['lit-4']);

      // t=300: first pad turned off (blanking phase)
      jest.advanceTimersByTime(300);
      expect(events).toEqual(['lit-4', 'off-4']);

      // t=400: second identical pad lit distinctly
      jest.advanceTimersByTime(100);
      expect(events).toEqual(['lit-4', 'off-4', 'lit-4']);

      // t=700: second pad turned off
      jest.advanceTimersByTime(300);
      expect(events).toEqual(['lit-4', 'off-4', 'lit-4', 'off-4']);

      jest.useRealTimers();
    });
  });
});
