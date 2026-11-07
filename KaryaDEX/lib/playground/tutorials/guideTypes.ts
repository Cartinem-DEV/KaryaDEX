/**
 * KaryaDEX — Universal Game Guide & Tutorial Types
 *
 * Defines contracts for game overviews, rules, controls, pro-tips,
 * interactive tutorial steps, and practice mode configurations.
 */

import type { PlaygroundGameType } from '@/types/playground';

export interface GameGuideContent {
  gameType: PlaygroundGameType;
  title: string;
  tagline: string;
  category: string;
  accentColor: string;
  secondaryColor: string;
  iconName: string;
  overview: string;
  rules: string[];
  controls: {
    action: string;
    description: string;
  }[];
  proTips: string[];
}

export interface TutorialStep {
  id: string;
  title: string;
  instruction: string;
  hint?: string;
  actionRequired: string;
  targetId?: string; // e.g. 'cell-0-1' or 'numpad-2'
  initialData?: any;
  expectedActionType: string;
  expectedPayload?: any;
}

export interface InteractiveLesson {
  gameType: PlaygroundGameType;
  title: string;
  subtitle: string;
  steps: TutorialStep[];
  completionTitle: string;
  completionBody: string;
}

export interface GameTutorialUserState {
  completed: boolean;
  dismissed: boolean;
  completedAt?: string;
}
