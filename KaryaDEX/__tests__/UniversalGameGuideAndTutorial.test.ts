/**
 * KaryaDEX — Universal Game Guide & Interactive Tutorial Unit Tests
 *
 * Validates:
 * - Complete guide documentation for all 4 games (Sprint Duel, Queens, Tango, MindSnap)
 * - Complete interactive tutorial lessons and action-based steps for all 4 games
 * - User-scoped state isolation, dismiss, completion, and reset in usePlaygroundGuideStore
 * - Practice mode toggling per game
 */

import { GAME_GUIDES } from '../lib/playground/tutorials/guideContent';
import { TUTORIAL_LESSONS } from '../lib/playground/tutorials/tutorialLessons';
import { usePlaygroundGuideStore } from '../store/usePlaygroundGuideStore';
import type { PlaygroundGameType } from '../types/playground';

const ALL_GAMES: PlaygroundGameType[] = ['sprint_duel', 'queens', 'tango', 'mind_snap'];

describe('Universal Game Guide & Tutorial Architecture', () => {
  beforeEach(() => {
    usePlaygroundGuideStore.getState().resetAllForTesting();
  });

  describe('Game Guides Completeness (All 4 Games)', () => {
    it.each(ALL_GAMES)('provides complete and valid guide content for %s', (gameType) => {
      const guide = GAME_GUIDES[gameType];
      expect(guide).toBeDefined();
      expect(guide.gameType).toBe(gameType);
      expect(guide.title.length).toBeGreaterThan(0);
      expect(guide.tagline.length).toBeGreaterThan(0);
      expect(guide.category.length).toBeGreaterThan(0);
      expect(guide.overview.length).toBeGreaterThan(30);

      // Must have at least 3 rules
      expect(guide.rules.length).toBeGreaterThanOrEqual(3);
      for (const rule of guide.rules) {
        expect(rule.trim().length).toBeGreaterThan(5);
      }

      // Must have at least 2 control mappings
      expect(guide.controls.length).toBeGreaterThanOrEqual(2);
      for (const ctrl of guide.controls) {
        expect(ctrl.action.length).toBeGreaterThan(0);
        expect(ctrl.description.length).toBeGreaterThan(5);
      }

      // Must have at least 2 pro tips
      expect(guide.proTips.length).toBeGreaterThanOrEqual(2);
      for (const tip of guide.proTips) {
        expect(tip.trim().length).toBeGreaterThan(5);
      }
    });
  });

  describe('Interactive Tutorial Lessons (All 4 Games)', () => {
    it.each(ALL_GAMES)('provides action-based interactive lesson definitions for %s', (gameType) => {
      const lesson = TUTORIAL_LESSONS[gameType];
      expect(lesson).toBeDefined();
      expect(lesson.gameType).toBe(gameType);
      expect(lesson.title.length).toBeGreaterThan(0);
      expect(lesson.subtitle.length).toBeGreaterThan(0);
      expect(lesson.completionTitle.length).toBeGreaterThan(0);
      expect(lesson.completionBody.length).toBeGreaterThan(0);

      // Must contain at least 3 interactive steps
      expect(lesson.steps.length).toBeGreaterThanOrEqual(3);

      for (let i = 0; i < lesson.steps.length; i++) {
        const step = lesson.steps[i];
        expect(step.id).toBeDefined();
        expect(step.title.length).toBeGreaterThan(0);
        expect(step.instruction.length).toBeGreaterThan(10);
        expect(step.actionRequired.length).toBeGreaterThan(0);
        expect(step.expectedActionType.length).toBeGreaterThan(0);
      }
    });
  });

  describe('Guide & Tutorial Store Lifecycle & User Scoping', () => {
    it('initializes in an uncompleted, undismissed state for guest', () => {
      const store = usePlaygroundGuideStore.getState();
      for (const g of ALL_GAMES) {
        expect(store.isTutorialCompleted(g)).toBe(false);
        expect(store.isTutorialDismissed(g)).toBe(false);
      }
    });

    it('marks tutorial as completed and dismissed', () => {
      const store = usePlaygroundGuideStore.getState();
      expect(store.isTutorialCompleted('queens')).toBe(false);

      store.markTutorialCompleted('queens');

      expect(usePlaygroundGuideStore.getState().isTutorialCompleted('queens')).toBe(true);
      expect(usePlaygroundGuideStore.getState().isTutorialDismissed('queens')).toBe(true);

      // Other games remain untouched
      expect(usePlaygroundGuideStore.getState().isTutorialCompleted('tango')).toBe(false);
    });

    it('dismisses tutorial without marking as completed', () => {
      const store = usePlaygroundGuideStore.getState();
      store.dismissTutorial('sprint_duel');

      expect(usePlaygroundGuideStore.getState().isTutorialDismissed('sprint_duel')).toBe(true);
      expect(usePlaygroundGuideStore.getState().isTutorialCompleted('sprint_duel')).toBe(false);
    });

    it('resets tutorial state on request', () => {
      const store = usePlaygroundGuideStore.getState();
      store.markTutorialCompleted('mind_snap');
      expect(usePlaygroundGuideStore.getState().isTutorialCompleted('mind_snap')).toBe(true);

      store.resetTutorial('mind_snap');
      expect(usePlaygroundGuideStore.getState().isTutorialCompleted('mind_snap')).toBe(false);
      expect(usePlaygroundGuideStore.getState().isTutorialDismissed('mind_snap')).toBe(false);
    });

    it('isolates state per user ID to prevent cross-account leaks', () => {
      const store = usePlaygroundGuideStore.getState();

      // User Alice completes Tango
      store.setUserId('user_alice');
      store.markTutorialCompleted('tango');
      expect(usePlaygroundGuideStore.getState().isTutorialCompleted('tango')).toBe(true);

      // User Bob switches in - Tango should be uncompleted
      store.setUserId('user_bob');
      expect(usePlaygroundGuideStore.getState().isTutorialCompleted('tango')).toBe(false);

      // User Bob completes Queens
      store.markTutorialCompleted('queens');
      expect(usePlaygroundGuideStore.getState().isTutorialCompleted('queens')).toBe(true);

      // Switch back to Alice: Tango completed, Queens not completed
      store.setUserId('user_alice');
      expect(usePlaygroundGuideStore.getState().isTutorialCompleted('tango')).toBe(true);
      expect(usePlaygroundGuideStore.getState().isTutorialCompleted('queens')).toBe(false);
    });

    it('toggles practice mode correctly per game', () => {
      const store = usePlaygroundGuideStore.getState();
      expect(store.isPracticeMode('queens')).toBe(false);

      store.setPracticeMode('queens', true);
      expect(usePlaygroundGuideStore.getState().isPracticeMode('queens')).toBe(true);
      expect(usePlaygroundGuideStore.getState().isPracticeMode('tango')).toBe(false);

      store.setPracticeMode('queens', false);
      expect(usePlaygroundGuideStore.getState().isPracticeMode('queens')).toBe(false);
    });
  });
});
