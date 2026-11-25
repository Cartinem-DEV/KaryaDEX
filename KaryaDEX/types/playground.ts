/**
 * KaryaDEX — Brain Playground Domain Types
 *
 * Models for the Cognitive Brain Playground:
 * Escape the Matrix of social media doomscrolling through speed math,
 * logic puzzles (Queens, Tango), and working memory games.
 */

export type PlaygroundGameType = 'sprint_duel' | 'queens' | 'tango' | 'mind_snap';

export type GameDifficulty = 'easy' | 'medium' | 'hard';

export interface MatchRecord {
  id: string;
  gameType: PlaygroundGameType;
  score: number;
  opponentScore?: number;
  isWin: boolean;
  durationSeconds: number;
  accuracy?: number; // 0 - 100
  xpEarned: number;
  ratingDelta: number;
  date: string; // ISO
  gameTitle?: string;
  result?: 'won' | 'lost' | 'draw';
  timestamp?: number;
  ratingChange?: number;
  isPractice?: boolean;
  lockinSessionId?: string;
}

export interface DailyQuest {
  id: string;
  title: string;
  description: string;
  gameType: PlaygroundGameType;
  targetCount: number;
  currentCount: number;
  completed: boolean;
  xpReward: number;
}

export interface BrainRank {
  title: string;
  tier: 'Bronze' | 'Silver' | 'Gold' | 'Diamond' | 'Master' | 'Matrix Liberator';
  minRating: number;
  badgeColor: string;
}

export interface QueensCell {
  row: number;
  col: number;
  regionId: number; // 0 to N-1
  state: 'empty' | 'cross' | 'queen';
  hasConflict?: boolean;
}

export interface QueensPuzzle {
  id: string;
  size: number;
  regions: number[][]; // [row][col] -> regionId
  solution: { row: number; col: number }[];
}

export interface TangoCell {
  row: number;
  col: number;
  value: 'sun' | 'moon' | null;
  isGiven: boolean;
  hasConflict?: boolean;
}

export interface TangoConstraint {
  row1: number;
  col1: number;
  row2: number;
  col2: number;
  type: 'equal' | 'opposite'; // '=' or '×'
}

export interface TangoPuzzle {
  id: string;
  size: number;
  givens: { row: number; col: number; value: 'sun' | 'moon' }[];
  constraints: TangoConstraint[];
  solution: ('sun' | 'moon')[][];
}

export interface MathQuestion {
  top: number;
  bottom: number;
  operator: '+' | '-' | '×' | '÷';
  answer: number;
}

// ═══════════════════════════════════════════════════════════════════════════
// PLAYER IDENTITY, PERSISTENCE & MIGRATION CONTRACTS (PHASE PG-3A)
// ═══════════════════════════════════════════════════════════════════════════

export type PlayerScopeType = 'guest' | 'authenticated';

export interface GuestScope {
  type: 'guest';
}

export interface AuthenticatedScope {
  type: 'authenticated';
  userId: string;
}

export type PlayerScope = GuestScope | AuthenticatedScope;

export interface PlaygroundProfileData {
  version: number;
  brainXp: number;
  brainRating: number;
  escapeStreak: number;
  currentStreak?: number;
  currentLevel?: number;
  totalWins?: number;
  lastPlayedDate: string | null;
  totalTimeMinutes: number;
  totalMatches: number;
  ratings?: Record<string, number>;
  highScores: Record<PlaygroundGameType, number>;
  recentMatches: MatchRecord[];
  dailyQuests: DailyQuest[];
  soundEnabled: boolean;
  hapticsEnabled: boolean;
  updatedAt?: string;
}

export interface ClaimReceiptSummary {
  brainXp: number;
  brainRating: number;
  totalMatches: number;
  escapeStreak: number;
  completedQuests: number;
}

/**
 * ClaimReceipt: Local audit record stored in AsyncStorage.
 * Note: Stored as a local persistent audit trail; provides local idempotency
 * and historical traceability, not cryptographic hardware-level immutability.
 */
export interface ClaimReceipt {
  receiptId: string;
  sourceScope: 'guest';
  destinationUserId: string;
  sourceSnapshotFingerprint: string;
  migrationVersion: number;
  status:
    | 'completed'
    | 'rolled_back'
    | 'failed'
    | 'declined'
    | 'conflict_kept_account'
    | 'conflict_replaced_account';
  createdAt: string;
  verifiedAt?: string;
  summary: ClaimReceiptSummary;
  preClaimAccountBackupKey?: string;
  destinationVerified?: boolean;
}

export type ConflictResolutionOption = 'claim' | 'keep_account' | 'replace_account' | 'decline';

export interface GuestClaimPromptData {
  mode: 'fresh' | 'conflict';
  guestProfile: PlaygroundProfileData;
  accountProfile: PlaygroundProfileData;
  hasConflict: boolean;
  destinationUserId: string;
  guestSummary: {
    totalMatches: number;
    brainXp: number;
    brainRating: number;
  };
  accountSummary: {
    totalMatches: number;
    brainXp: number;
    brainRating: number;
  };
}

export interface ClaimResult {
  success: boolean;
  resolution: ConflictResolutionOption;
  receiptId?: string;
  receipt?: ClaimReceipt;
  error?: string;
}

export type MigrationJournalPhase =
  | 'PREPARE'
  | 'SNAPSHOT'
  | 'VALIDATE'
  | 'WRITE_DESTINATION'
  | 'VERIFY'
  | 'TRANSFER_TUTORIALS'
  | 'RECEIPT'
  | 'RESET_GUEST'
  | 'SUCCESS'
  | 'ROLLED_BACK';

export interface MigrationJournalEntry {
  id: string;
  phase: MigrationJournalPhase;
  sourceKey: string;
  destinationKey: string;
  sourceBackupKey?: string;
  destinationBackupKey?: string;
  timestamp: string;
  payloadFingerprint?: string;
  migratedMatchesCount?: number;
}

export interface ClaimRecoveryResult {
  recovered: boolean;
  action: 'none' | 'rolled_back' | 'rolled_forward' | 'cleaned_up';
  journalEntry?: MigrationJournalEntry | null;
  error?: string;
}

// ─── PG-3B: LockIn Playground Bridge Types ─────────────────────────

export type LockinBreakType = 'short_break' | 'long_break' | 'custom_break';

export interface LockinBreakSession {
  sessionId: string;
  breakType: LockinBreakType;
  startedAt: number; // Unix epoch ms
  breakDurationSeconds: number; // Total planned break duration in seconds
  breakDeadlineTimestamp: number; // startedAt + (breakDurationSeconds * 1000)
  isBreakActive: boolean;
  metadata?: Record<string, any>;
}

export interface BridgeLaunchValidation {
  allowed: boolean;
  remainingSeconds: number;
  reason?: 'NO_ACTIVE_BREAK' | 'INSUFFICIENT_BREAK_TIME';
  message?: string;
}

export interface BridgeReplayValidation {
  allowed: boolean;
  remainingSeconds: number;
  message?: string;
}

export interface BridgeGameCompletionValidation {
  valid: boolean;
  reason?: 'COMPLETED_IN_TIME' | 'BREAK_DEADLINE_EXCEEDED' | 'STALE_BREAK_SESSION';
  message?: string;
  xpAwarded: number;
  ratingDelta: number;
  streakIncremented: boolean;
}

export interface LockinPlaygroundBridgeContext {
  breakSession: LockinBreakSession;
  gameType: PlaygroundGameType;
  launchTimestamp: number;
}

