/**
 * KaryaDEX — Attendance Calculation Utilities
 * 
 * All attendance math lives here. These functions must be:
 * - Mathematically correct
 * - Handle edge cases (0 classes, 100%, exactly at target)
 * - Be pure functions with no side effects
 */

/**
 * Calculate attendance percentage.
 * Returns 0 if total is 0 (no classes yet).
 */
export function calculatePercentage(attended: number, total: number): number {
  if (total === 0) return 0;
  return (attended / total) * 100;
}

/**
 * Determine attendance status based on percentage and target.
 */
export function getAttendanceStatus(
  percentage: number,
  target: number
): 'safe' | 'watch' | 'danger' {
  if (percentage >= target + 5) return 'safe';
  if (percentage >= target) return 'watch';
  return 'danger';
}

/**
 * Calculate how many classes can be safely bunked
 * while staying at or above the target percentage.
 * 
 * Formula: After bunking `b` classes:
 *   (attended) / (total + b) >= target/100
 *   attended >= (target/100) * (total + b)
 *   attended * 100 >= target * (total + b)
 *   attended * 100 >= target * total + target * b
 *   attended * 100 - target * total >= target * b
 *   b <= (attended * 100 - target * total) / target
 */
export function calculateSafeBunks(
  attended: number,
  total: number,
  target: number
): number {
  if (total === 0) return 0;
  const targetFraction = target / 100;
  
  // Max bunks = floor((attended - targetFraction * total) / targetFraction)
  const safeBunks = Math.floor(
    (attended - targetFraction * total) / targetFraction
  );
  
  return Math.max(0, safeBunks);
}

/**
 * Calculate how many consecutive classes need to be attended
 * to recover to or above the target percentage.
 * 
 * Formula: After attending `r` more classes:
 *   (attended + r) / (total + r) >= target/100
 *   (attended + r) * 100 >= target * (total + r)
 *   attended*100 + r*100 >= target*total + target*r
 *   r*100 - target*r >= target*total - attended*100
 *   r*(100 - target) >= target*total - attended*100
 *   r >= (target*total - attended*100) / (100 - target)
 * 
 * Returns 0 if already at or above target.
 * Returns Infinity if target is 100% and currently below it.
 */
export function calculateRecoveryClasses(
  attended: number,
  total: number,
  target: number
): number {
  if (total === 0) return 0;
  
  const currentPercentage = calculatePercentage(attended, total);
  if (currentPercentage >= target) return 0;
  
  if (target >= 100) return Infinity;
  
  const targetFraction = target / 100;
  const needed = Math.ceil(
    (targetFraction * total - attended) / (1 - targetFraction)
  );
  
  return Math.max(0, needed);
}

/**
 * Calculate how many classes can be safely bunked
 * while staying in the 'safe' zone (percentage >= target + 5).
 */
export function calculateImmediatelySafeBunks(
  attended: number,
  total: number,
  target: number
): number {
  if (total === 0) return 0;
  const safeTarget = target + 5;
  if (safeTarget > 100) return 0;
  return calculateSafeBunks(attended, total, safeTarget);
}

/**
 * Calculate how many consecutive classes need to be attended
 * to reach the 'safe' status (percentage >= target + 5).
 * Returns 0 if already in safe status.
 * Returns Infinity if safeTarget >= 100 and currently below it.
 */
export function calculateClassesToSafe(
  attended: number,
  total: number,
  target: number
): number {
  if (total === 0) return 0;
  const safeTarget = target + 5;
  if (safeTarget > 100) return Infinity;
  return calculateRecoveryClasses(attended, total, safeTarget);
}

/**
 * Project attendance after a given number of absences.
 * Returns the new percentage if `absences` more classes are missed.
 */
export function projectAfterAbsence(
  attended: number,
  total: number,
  absences: number = 1
): number {
  const newTotal = total + absences;
  if (newTotal === 0) return 0;
  return (attended / newTotal) * 100;
}

/**
 * Project attendance after attending a given number of classes.
 * Returns the new percentage if `presents` more classes are attended.
 */
export function projectAfterPresent(
  attended: number,
  total: number,
  presents: number = 1
): number {
  const newTotal = total + presents;
  const newAttended = attended + presents;
  if (newTotal === 0) return 0;
  return (newAttended / newTotal) * 100;
}

/**
 * Can the student bunk the next class and stay safe?
 */
export function canBunk(
  attended: number,
  total: number,
  target: number
): {
  canBunk: boolean;
  currentPercentage: number;
  projectedPercentage: number;
  message: string;
  emoji: string;
} {
  const currentPercentage = calculatePercentage(attended, total);
  const projectedPercentage = projectAfterAbsence(attended, total, 1);
  const canSafelyBunk = projectedPercentage >= target;

  let message: string;
  let emoji: string;

  if (total === 0) {
    message = "No classes yet. Maybe attend the first one?";
    emoji = "🤷";
  } else if (canSafelyBunk) {
    const safeBunks = calculateSafeBunks(attended, total, target);
    if (safeBunks > 3) {
      message = `You're golden. ${safeBunks} bunks in the bank.`;
      emoji = "😎";
    } else if (safeBunks > 1) {
      message = "You're still within your safe range.";
      emoji = "😌";
    } else {
      message = "Just barely safe. Don't push it.";
      emoji = "😬";
    }
  } else {
    const recovery = calculateRecoveryClasses(attended, total + 1, target);
    if (recovery <= 2) {
      message = "Don't bunk this one. You'll recover quickly though.";
      emoji = "😤";
    } else if (recovery <= 5) {
      message = `Don't bunk. You'd need ${recovery} classes to recover.`;
      emoji = "😰";
    } else {
      message = "Absolutely not. Your attendance is in danger.";
      emoji = "💀";
    }
  }

  return {
    canBunk: canSafelyBunk,
    currentPercentage,
    projectedPercentage,
    message,
    emoji,
  };
}

/**
 * Calculate classes missed in a date range.
 * Takes an array of class sessions and a date range,
 * returns count of classes that would be missed.
 */
export function calculateClassesInRange(
  startDate: Date,
  endDate: Date,
  weeklyClasses: number // classes per week for a subject
): number {
  const msPerDay = 86400000;
  const days = Math.ceil((endDate.getTime() - startDate.getTime()) / msPerDay) + 1;
  const weeks = days / 7;
  return Math.round(weeks * weeklyClasses);
}
