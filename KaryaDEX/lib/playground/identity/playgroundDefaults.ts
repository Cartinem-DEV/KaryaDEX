/**
 * Playground Identity & Profile Defaults
 */

import type { DailyQuest } from '@/types/playground';

export function generateDefaultQuests(): DailyQuest[] {
  return [
    {
      id: 'quest-sprint',
      title: 'Sprint Blitz',
      description: 'Score 10+ points in a Sprint Duel battle',
      gameType: 'sprint_duel',
      targetCount: 1,
      currentCount: 0,
      completed: false,
      xpReward: 100,
    },
    {
      id: 'quest-queens',
      title: 'Royal Crown',
      description: 'Solve 1 Queens logic territory puzzle',
      gameType: 'queens',
      targetCount: 1,
      currentCount: 0,
      completed: false,
      xpReward: 120,
    },
    {
      id: 'quest-tango',
      title: 'Celestial Harmony',
      description: 'Solve 1 Tango Sun & Moon binary grid',
      gameType: 'tango',
      targetCount: 1,
      currentCount: 0,
      completed: false,
      xpReward: 120,
    },
    {
      id: 'quest-mindsnap',
      title: 'Memory Trigger',
      description: 'Reach stage 5 in MindSnap memory blitz',
      gameType: 'mind_snap',
      targetCount: 1,
      currentCount: 0,
      completed: false,
      xpReward: 80,
    },
  ];
}
