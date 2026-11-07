/**
 * KaryaDEX — MindSnap Engine Logic
 *
 * Pure functions for spatial memory sequence generation and input evaluation.
 */

/**
 * Generates an initial sequence of pad indices (0 to 8).
 */
export function generateInitialSequence(length: number = 3): number[] {
  const seq: number[] = [];
  for (let i = 0; i < length; i++) {
    seq.push(Math.floor(Math.random() * 9));
  }
  return seq;
}

/**
 * Appends a new random pad index (0 to 8) to the existing sequence.
 */
export function appendSequenceStep(sequence: number[]): number[] {
  return [...sequence, Math.floor(Math.random() * 9)];
}

/**
 * Evaluates a player's pad press against the current sequence at playerIndex.
 */
export function evaluateInput(
  sequence: number[],
  playerIndex: number,
  tappedPad: number
): {
  isCorrect: boolean;
  isStageComplete: boolean;
  nextIndex: number;
} {
  if (playerIndex >= sequence.length) {
    return { isCorrect: false, isStageComplete: false, nextIndex: playerIndex };
  }

  const expectedPad = sequence[playerIndex];
  if (tappedPad !== expectedPad) {
    return { isCorrect: false, isStageComplete: false, nextIndex: playerIndex };
  }

  const nextIndex = playerIndex + 1;
  const isStageComplete = nextIndex === sequence.length;

  return {
    isCorrect: true,
    isStageComplete,
    nextIndex,
  };
}

/**
 * Calculates score for MindSnap based on cleared stages and duration.
 */
export function calculateMindSnapScore(
  stage: number,
  durationSeconds: number
): {
  score: number;
  isWin: boolean;
} {
  const score = Math.max(10, (stage - 1) * 25);
  const isWin = stage >= 4;
  return { score, isWin };
}
