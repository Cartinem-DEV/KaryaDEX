/**
 * KaryaDEX — Study Module Types
 *
 * Types for the comprehensive student learning workspace:
 * Study Plans, Exam Countdowns, Socratic AI Tutor, Materials, Practice Center, and Mastery.
 */

import type { Topic, ClassNote, Resource, RevisionStatus } from '@/types/academic';
import type { Subject, Exam } from '@/types';

export type StudySubTab = 'overview' | 'plan' | 'materials' | 'tutor' | 'practice' | 'mastery';

export type TopicMasteryState = 'not_started' | 'learning' | 'on_target';
export type AstraMasteryState = TopicMasteryState; // Backward-compatible alias

export interface ExamCountdownInfo {
  exam: Exam | null;
  daysRemaining: number;
  isOverdue: boolean;
  isToday: boolean;
  targetScorePercent: number;
  forecastStatus: 'on_track' | 'at_risk' | 'behind';
  topicsTotal: number;
  topicsOnTarget: number;
}

export interface PracticeFlashcard {
  id: string;
  topicId: string;
  subjectId: string;
  front: string;
  back: string;
  conceptSummary: string;
}

export interface PracticeMCQ {
  id: string;
  topicId: string;
  subjectId: string;
  question: string;
  options: string[];
  correctIndex: number;
  explanation: string;
  stepHint: string;
}

export interface PracticeTrueFalse {
  id: string;
  topicId: string;
  subjectId: string;
  statement: string;
  isTrue: boolean;
  explanation: string;
}

export type PracticeMode = 'flashcards' | 'mcq' | 'true_false';

export interface SocraticStep {
  stepNumber: number;
  title: string;
  content: string;
  guidingQuestion?: string;
  isRevealed: boolean;
}

export interface SocraticProblemSession {
  id: string;
  topicId: string;
  topicTitle: string;
  problemStatement: string;
  steps: SocraticStep[];
  currentStepIndex: number;
  isCompleted: boolean;
  finalSolution: string;
}
