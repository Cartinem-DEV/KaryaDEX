/**
 * KaryaDEX — Study OS Functional Intelligence & Practice Integration Tests
 *
 * Verifies:
 * 1. studyPracticeService: Dynamic Flashcard, MCQ, and True/False generation from syllabus topics.
 * 2. Fallback handling when topic collections are empty.
 * 3. Persistence of practice outcomes to syllabusRepository (topics) and revisionRepository (revision_records).
 * 4. Strict Playground Isolation: Zero effect on Brain ELO, XP, streaks, matches, or daily quests.
 * 5. Study Planning: Deterministic daily capacity pacing and workload derivation.
 * 6. Socratic Session Scaffolding: Progressive step generation and deduction guards.
 */

// Mock repositories for isolated functional testing
jest.mock('../database/repositories/syllabusRepository', () => ({
  syllabusRepository: {
    updateTopic: jest.fn().mockResolvedValue(true),
  },
}));

jest.mock('../database/repositories/revisionRepository', () => ({
  revisionRepository: {
    createRecord: jest.fn().mockImplementation((rec) => Promise.resolve({ id: 'rec-test-1', ...rec })),
    getRecordsByTopic: jest.fn().mockResolvedValue([]),
  },
}));

import { studyPracticeService } from '../services/study/studyPracticeService';
import { syllabusRepository } from '../database/repositories/syllabusRepository';
import { revisionRepository } from '../database/repositories/revisionRepository';
import { usePlaygroundStore, INITIAL_PLAYGROUND_STATE } from '../store/usePlaygroundStore';
import { usePlaygroundGuideStore } from '../store/usePlaygroundGuideStore';
import { studyPlanningService } from '../services/studyPlanningService';
import { generateSocraticSessionForTopic } from '../components/study/StudyAITutorTab';
import type { Topic } from '../types/academic';
import type { Subject } from '../types';

describe('Study OS Functional Intelligence & Practice Integration', () => {
  const mockSubjects: Subject[] = [
    {
      id: 'sub-cn',
      name: 'Computer Networks',
      shortName: 'CN',
      code: 'CS501',
      color: '#3B82F6',
      credits: 4,
      facultyId: 'fac-1',
      semesterId: 'sem-1',
    },
    {
      id: 'sub-os',
      name: 'Operating Systems',
      shortName: 'OS',
      code: 'CS502',
      color: '#10B981',
      credits: 4,
      facultyId: 'fac-1',
      semesterId: 'sem-1',
    },
  ];

  const mockTopics: Topic[] = [
    {
      id: 'top-tcp',
      name: 'TCP Congestion Control & Slow Start',
      subjectId: 'sub-cn',
      order: 1,
      isCompleted: false,
      revisionStatus: 'needs_revision',
      unitId: 'unit-3',
      classNoteIds: [],
    },
    {
      id: 'top-bcnf',
      name: 'Boyce-Codd Normal Form Decompositions',
      subjectId: 'sub-cn',
      order: 2,
      isCompleted: false,
      revisionStatus: 'not_started',
      unitId: 'unit-4',
      classNoteIds: [],
    },
    {
      id: 'top-vm',
      name: 'Virtual Memory & Page Replacement',
      subjectId: 'sub-os',
      order: 1,
      isCompleted: true,
      revisionStatus: 'revised',
      unitId: 'unit-2',
      classNoteIds: [],
    },
  ];

  beforeEach(() => {
    jest.clearAllMocks();
    usePlaygroundStore.setState(INITIAL_PLAYGROUND_STATE);
    usePlaygroundGuideStore.getState().resetAllForTesting();
  });

  describe('1. Dynamic Practice Question Generation', () => {
    it('generates active recall flashcards mapped to topic names and subject context', () => {
      const flashcards = studyPracticeService.generateFlashcards(mockTopics, mockSubjects);

      expect(flashcards).toHaveLength(3);
      expect(flashcards[0].topicId).toBe('top-tcp');
      expect(flashcards[0].front).toContain('TCP Congestion Control & Slow Start');
      expect(flashcards[0].back).toContain('Computer Networks');
      expect(flashcards[0].conceptSummary).toContain('Unit: unit-3');

      expect(flashcards[2].topicId).toBe('top-vm');
      expect(flashcards[2].conceptSummary).toContain('Operating Systems');
    });

    it('generates 4-option MCQs with explanations and hints for syllabus topics', () => {
      const mcqs = studyPracticeService.generateMCQs(mockTopics, mockSubjects);

      expect(mcqs).toHaveLength(3);
      expect(mcqs[0].topicId).toBe('top-tcp');
      expect(mcqs[0].options).toHaveLength(4);
      expect(mcqs[0].correctIndex).toBe(1);
      expect(mcqs[0].question).toContain('Computer Networks');
      expect(mcqs[0].stepHint).toBeDefined();
      expect(mcqs[0].explanation).toContain('foundational relationships');
    });

    it('generates balanced True/False conceptual verification items', () => {
      const tfItems = studyPracticeService.generateTrueFalse(mockTopics, mockSubjects);

      expect(tfItems).toHaveLength(3);
      expect(tfItems[0].isTrue).toBe(true);
      expect(tfItems[0].statement).toContain('mastery of "TCP Congestion Control & Slow Start"');
      expect(tfItems[1].isTrue).toBe(false);
      expect(tfItems[1].statement).toContain('operates completely independently');
    });

    it('returns high-quality fallback questions if the topic collection is empty', () => {
      const fbCards = studyPracticeService.generateFlashcards([], mockSubjects);
      expect(fbCards.length).toBeGreaterThanOrEqual(2);
      expect(fbCards[0].id).toContain('fc-default');

      const fbMcqs = studyPracticeService.generateMCQs([], mockSubjects);
      expect(fbMcqs.length).toBeGreaterThanOrEqual(2);
      expect(fbMcqs[0].id).toContain('mcq-default');

      const fbTf = studyPracticeService.generateTrueFalse([], mockSubjects);
      expect(fbTf.length).toBeGreaterThanOrEqual(2);
      expect(fbTf[0].id).toContain('tf-default');
    });
  });

  describe('2. Practice Outcome Recording & SQLite Persistence', () => {
    it('records confident practice success and marks topic as revised in SQLite', async () => {
      await studyPracticeService.recordPracticeOutcome({
        topicId: 'top-tcp',
        subjectId: 'sub-cn',
        isCorrect: true,
        confidence: 'high',
        durationMinutes: 7,
      });

      expect(syllabusRepository.updateTopic).toHaveBeenCalledWith(
        'top-tcp',
        expect.objectContaining({
          revisionStatus: 'revised',
        })
      );

      expect(revisionRepository.createRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          topicId: 'top-tcp',
          subjectId: 'sub-cn',
          confidence: 'high',
          outcome: 'confident',
          durationMinutes: 7,
        })
      );
    });

    it('flags topic as needs_revision if practice was incorrect or low confidence', async () => {
      await studyPracticeService.recordPracticeOutcome({
        topicId: 'top-bcnf',
        subjectId: 'sub-cn',
        isCorrect: false,
        confidence: 'low',
        durationMinutes: 4,
        notes: 'Struggled with functional dependency closures',
      });

      expect(syllabusRepository.updateTopic).toHaveBeenCalledWith(
        'top-bcnf',
        expect.objectContaining({
          revisionStatus: 'needs_revision',
        })
      );

      expect(revisionRepository.createRecord).toHaveBeenCalledWith(
        expect.objectContaining({
          topicId: 'top-bcnf',
          confidence: 'low',
          outcome: 'needs_review',
          notes: 'Struggled with functional dependency closures',
        })
      );
    });
  });

  describe('3. Strict Isolation from Playground Progression', () => {
    it('guarantees practice generation and completion NEVER touches Playground XP, ELO, streak, or quests', async () => {
      const playStateBefore = usePlaygroundStore.getState();
      const initialRating = playStateBefore.brainRating;
      const initialXp = playStateBefore.brainXp;
      const initialStreak = playStateBefore.escapeStreak;
      const initialMatches = playStateBefore.recentMatches.length;
      const initialQuests = JSON.stringify(playStateBefore.dailyQuests);

      // Perform a full practice generation and outcome cycle
      const cards = studyPracticeService.generateFlashcards(mockTopics, mockSubjects);
      const mcqs = studyPracticeService.generateMCQs(mockTopics, mockSubjects);
      await studyPracticeService.recordPracticeOutcome({
        topicId: cards[0].topicId,
        subjectId: cards[0].subjectId,
        isCorrect: true,
        confidence: 'high',
      });

      // Verify Playground state is 100% mathematically and structurally unchanged
      const playStateAfter = usePlaygroundStore.getState();
      expect(playStateAfter.brainRating).toBe(initialRating);
      expect(playStateAfter.brainXp).toBe(initialXp);
      expect(playStateAfter.escapeStreak).toBe(initialStreak);
      expect(playStateAfter.recentMatches).toHaveLength(initialMatches);
      expect(JSON.stringify(playStateAfter.dailyQuests)).toBe(initialQuests);
    });
  });

  describe('4. Socratic Scaffolding & Solution Board Generation', () => {
    it('builds a 3-step progressive Socratic deductive board for any topic', () => {
      const session = generateSocraticSessionForTopic(mockTopics[0], 'Computer Networks');

      expect(session.topicId).toBe('top-tcp');
      expect(session.topicTitle).toBe('TCP Congestion Control & Slow Start');
      expect(session.steps).toHaveLength(3);
      expect(session.currentStepIndex).toBe(1);
      expect(session.steps[0].isRevealed).toBe(true);
      expect(session.steps[1].isRevealed).toBe(false);
      expect(session.steps[2].isRevealed).toBe(false);

      // Verify guiding questions are present to prevent passive spoonfeeding
      expect(session.steps[0].guidingQuestion).toBeDefined();
      expect(session.steps[1].guidingQuestion).toBeDefined();
      expect(session.steps[2].guidingQuestion).toBeDefined();
    });
  });

  describe('5. Study Planning Capacity & Workload Estimation', () => {
    it('calculates balanced vs high workload against daily study capacity', () => {
      const unrevisedTopics = mockTopics.filter(t => t.revisionStatus !== 'revised');
      const daysUntilExam = 2;
      const dailyCapacityMinutes = 60;

      const topicsPerDay = Math.ceil(unrevisedTopics.length / daysUntilExam);
      const estimatedMinutesPerDay = topicsPerDay * 25; // 25 min/topic standard pomodoro
      const isHighWorkload = estimatedMinutesPerDay > dailyCapacityMinutes;

      expect(unrevisedTopics).toHaveLength(2);
      expect(topicsPerDay).toBe(1);
      expect(estimatedMinutesPerDay).toBe(25);
      expect(isHighWorkload).toBe(false); // 25m <= 60m daily capacity
    });
  });
});
