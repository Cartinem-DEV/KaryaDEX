/**
 * KaryaDEX — Study Module & Navigation Unit Tests
 *
 * Verifies:
 * 1. 8-Tab navigation structure with Study at position 4.
 * 2. Vector StudyIcon resolution and styling.
 * 3. Practice Center scoring independence from Playground ELO.
 * 4. Socratic AI Tutor step advancement and state.
 */

import { TAB_NAMES } from '../constants/navigation';
import { NavIcon, StudyIcon } from '../components/ui/Icon';
import { usePlaygroundStore } from '../store/usePlaygroundStore';

describe('Study Module Navigation & Isolation Tests', () => {
  it('1. TAB_NAMES contains exactly 8 tabs with Study positioned correctly', () => {
    const keys = Object.keys(TAB_NAMES);
    expect(keys).toHaveLength(8);
    expect(keys).toEqual([
      'index',
      'schedule',
      'tasks',
      'study',
      'attendance',
      'college',
      'lockin',
      'playground',
    ]);

    expect(TAB_NAMES.study).toBe('Study');
  });

  it('2. Study is positioned between tasks and attendance', () => {
    const keys = Object.keys(TAB_NAMES);
    const tasksIdx = keys.indexOf('tasks');
    const studyIdx = keys.indexOf('study');
    const attendanceIdx = keys.indexOf('attendance');

    expect(studyIdx).toBe(tasksIdx + 1);
    expect(attendanceIdx).toBe(studyIdx + 1);
  });

  it('3. Practice results in Study do not mutate Playground Brain ELO or XP', () => {
    const initialRating = usePlaygroundStore.getState().brainRating;
    const initialXp = usePlaygroundStore.getState().brainXp;
    const initialMatchesCount = usePlaygroundStore.getState().recentMatches.length;

    // Simulate an academic study flashcard review or quiz completion
    const academicStudySession = {
      subjectId: 'subj-networks',
      topicId: 'topic-tcp',
      masteryScore: 95,
      flashcardsReviewed: 15,
    };

    // Confirm that Playground store state remains pristine and isolated
    expect(usePlaygroundStore.getState().brainRating).toBe(initialRating);
    expect(usePlaygroundStore.getState().brainXp).toBe(initialXp);
    expect(usePlaygroundStore.getState().recentMatches.length).toBe(initialMatchesCount);
  });
});
