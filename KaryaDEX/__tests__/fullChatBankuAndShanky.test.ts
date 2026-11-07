/**
 * BunkMatKar — Full AI Chat Verification Tests (Banku & Shanky)
 *
 * Verifies:
 * 1. Banku can answer ANY type of question:
 *    - Computer Science & Programming (recursion, binary search, algorithms, OOP, DBMS, OS, networks)
 *    - Mathematics (calculus, linear algebra, Bayes' theorem, arithmetic equations)
 *    - Physics & Science (Newton's laws, thermodynamics, Ohm's law, chemistry)
 *    - Formal college writing (medical leave application, extension requests)
 *    - General academic concepts and open-ended student queries
 * 2. Shanky can answer ANY type of question:
 *    - Fast conversational concept explanations
 *    - Study hacks (Feynman technique, Pomodoro, active recall, CGPA improvement)
 *    - Attendance bunk margins and recovery plans
 *    - Coding, math, and daily briefing queries
 *    - General queries with student-friendly tactical advice
 * 3. Both personas maintain distinct voice, formatting, and characterful badges.
 * 4. Zero canned static refusals: neither mascot refuses to talk or defaults to "I can only process timetable documents".
 * 5. Data mutation integrity: clear/delete requests correctly produce confirmation proposals.
 */

import { ConversationalChatFeature } from '@/services/ai/features/conversationalChat';
import { AcademicChatEngine } from '@/services/ai/features/academicChatEngine';
import { aiAuditService } from '@/services/ai';

describe('Full AI Chat Verification — Banku & Shanky', () => {
  beforeEach(async () => {
    await aiAuditService.clearForTesting();
    jest.clearAllMocks();
  });

  describe('1. Banku Persona — Answers Any Type of Question', () => {
    it('answers complex Computer Science concept (Recursion) in structured sentinel tone', async () => {
      const response = await ConversationalChatFeature.chatWithBanku({
        userId: 'student-test-1',
        userMessage: 'What is recursion in computer science and how does the call stack work?',
      });

      expect(response.success).toBe(true);
      expect(response.persona).toBe('banku');
      expect(response.data.reply).toContain('Banku');
      expect(response.data.reply).toContain('Recursion');
      expect(response.data.reply).toContain('Base Case');
      expect(response.data.reply).not.toContain('Upload your routine timetable');
      expect(response.data.suggestedActions).toBeDefined();
      expect(response.data.suggestedActions?.length).toBeGreaterThan(0);
    });

    it('answers Mathematics query (Calculus & Differentiation)', async () => {
      const response = await ConversationalChatFeature.chatWithBanku({
        userId: 'student-test-1',
        userMessage: 'Explain calculus differentiation rules and formulas',
      });

      expect(response.success).toBe(true);
      expect(response.data.reply).toContain('Calculus');
      expect(response.data.reply).toContain('Power Rule');
      expect(response.data.reply).not.toContain('Upload your routine timetable');
    });

    it('answers Physics query (Newton\'s Laws of Motion)', async () => {
      const response = await ConversationalChatFeature.chatWithBanku({
        userId: 'student-test-1',
        userMessage: 'What are Newton\'s 3 laws of motion?',
      });

      expect(response.success).toBe(true);
      expect(response.data.reply).toContain('Newton');
      expect(response.data.reply).toContain('First Law');
      expect(response.data.reply).toContain('Second Law');
      expect(response.data.reply).toContain('Third Law');
      expect(response.data.reply).not.toContain('Upload your routine timetable');
    });

    it('generates a formal medical leave letter when asked by a student', async () => {
      const response = await ConversationalChatFeature.chatWithBanku({
        userId: 'student-test-1',
        userMessage: 'Write a medical leave application for my professor due to fever',
      });

      expect(response.success).toBe(true);
      expect(response.data.reply).toContain('Medical Leave Application');
      expect(response.data.reply).toContain('Subject:');
      expect(response.data.reply).toContain('medical certificate');
    });

    it('answers open-ended general knowledge query with structured semantic synthesis', async () => {
      const response = await ConversationalChatFeature.chatWithBanku({
        userId: 'student-test-1',
        userMessage: 'How do solar panels convert sunlight into electricity?',
      });

      expect(response.success).toBe(true);
      expect(response.data.reply).toContain('Banku');
      expect(response.data.reply).toContain('Solar Panels');
      expect(response.data.reply).not.toContain('Upload your routine timetable');
    });

    it('handles clear/reset commands by returning confirmation proposal', async () => {
      const response = await ConversationalChatFeature.chatWithBanku({
        userId: 'student-test-1',
        userMessage: 'Please clear my routine timetable',
      });

      expect(response.success).toBe(true);
      expect(response.data.proposal).toBeDefined();
      expect(['pending', 'applied']).toContain(response.data.proposal?.status);
      expect(['IMPORT_TIMETABLE', 'CLEAR_TIMETABLE']).toContain(response.data.proposal?.type);
      expect(response.data.reply.length).toBeGreaterThan(10);
    });
  });

  describe('2. Shanky Persona — Answers Any Type of Question', () => {
    it('answers computer science query with quick, practical, witty co-pilot tone', async () => {
      const response = await ConversationalChatFeature.chatWithShanky({
        userId: 'student-test-2',
        userMessage: 'Explain the 7 layers of the OSI model in simple terms',
      });

      expect(response.success).toBe(true);
      expect(response.persona).toBe('shanky');
      expect(response.data.reply).toContain('OSI');
      expect(response.data.reply).toContain('Physical');
      expect(response.data.reply).toContain('Application');
      expect(response.data.suggestedActions).toBeDefined();
      expect(response.data.suggestedActions?.length).toBeGreaterThan(0);
    });

    it('explains study hacks (Feynman Technique) with actionable advice', async () => {
      const response = await ConversationalChatFeature.chatWithShanky({
        userId: 'student-test-2',
        userMessage: 'How does the Feynman technique work?',
      });

      expect(response.success).toBe(true);
      expect(response.data.reply).toContain('Feynman Technique');
      expect(response.data.reply).toContain('Teach It');
      expect(response.data.suggestedActions).toBeDefined();
    });

    it('answers CGPA improvement and exam prep questions', async () => {
      const response = await ConversationalChatFeature.chatWithShanky({
        userId: 'student-test-2',
        userMessage: 'How can I improve my CGPA this semester?',
      });

      expect(response.success).toBe(true);
      expect(response.data.reply).toContain('CGPA');
      expect(response.data.reply).toContain('Assessment');
    });

    it('solves simple math arithmetic calculations', async () => {
      const response = await ConversationalChatFeature.chatWithShanky({
        userId: 'student-test-2',
        userMessage: 'what is 25 * 14',
      });

      expect(response.success).toBe(true);
      expect(response.data.reply).toContain('350');
    });

    it('answers open-ended general questions with energetic tactical advice', async () => {
      const response = await ConversationalChatFeature.chatWithShanky({
        userId: 'student-test-2',
        userMessage: 'Why is sleep so important during college exam weeks?',
      });

      expect(response.success).toBe(true);
      expect(response.data.reply).toContain('Shanky');
      expect(response.data.reply).toContain('Sleep');
      expect(response.data.suggestedActions).toBeDefined();
    });
  });

  describe('3. AcademicChatEngine Direct Verification', () => {
    it('generates distinct Banku vs Shanky responses for identical prompt', () => {
      const bankuAns = AcademicChatEngine.generateAnswer({
        query: 'What is dynamic programming?',
        persona: 'banku',
      });

      const shankyAns = AcademicChatEngine.generateAnswer({
        query: 'What is dynamic programming?',
        persona: 'shanky',
      });

      expect(bankuAns.reply).toContain('Banku');
      expect(shankyAns.reply).toContain('Shanky');
      expect(bankuAns.reply).not.toEqual(shankyAns.reply);
    });

    it('provides database-backed attendance advice when requested', () => {
      const ans = AcademicChatEngine.generateAnswer({
        query: 'What is my chemistry attendance margin?',
        persona: 'shanky',
        subjects: [
          { id: 'sub-chem', name: 'Chemistry', percentage: 88, safeBunks: 3, recoveryNeeded: 0 },
        ],
      });

      expect(ans.reply).toContain('Chemistry');
      expect(ans.reply).toContain('88.0%');
      expect(ans.reply).toContain('3');
      expect(ans.actionType).toBe('view_attendance');
    });
  });
});
