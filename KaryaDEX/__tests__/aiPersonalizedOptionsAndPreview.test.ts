jest.mock('@expo/vector-icons', () => ({
  Ionicons: Object.assign(() => null, { glyphMap: {} }),
}));
jest.mock('expo-document-picker', () => ({
  getDocumentAsync: jest.fn(),
}));
jest.mock('expo-image-picker', () => ({
  launchImageLibraryAsync: jest.fn(),
  launchCameraAsync: jest.fn(),
  requestMediaLibraryPermissionsAsync: jest.fn(),
  requestCameraPermissionsAsync: jest.fn(),
}));
jest.mock('@/constants/mascots', () => ({
  MASCOT_ASSETS: {
    banku: {
      hero: { uri: 'banku_hero' },
      avatar: { uri: 'banku_avatar' },
      poses: { idle: { uri: 'banku_idle' } },
    },
    shanky: {
      hero: { uri: 'shanky_hero' },
      avatar: { uri: 'shanky_avatar' },
      poses: { idle: { uri: 'shanky_idle' } },
    },
  },
}));

import {
  generatePersonalizedContext,
  formatFileSize,
  type ChatAttachment,
} from '@/components/ai/AIAssistantModal';

describe('AI Multimodal Preview & Personalized Options Engine', () => {
  describe('1. File Size Formatting', () => {
    it('formats bytes, kilobytes, and megabytes correctly', () => {
      expect(formatFileSize(undefined)).toBe('0 KB');
      expect(formatFileSize(0)).toBe('0 KB');
      expect(formatFileSize(512)).toBe('512 B');
      expect(formatFileSize(1024 * 50)).toBe('50.0 KB');
      expect(formatFileSize(1024 * 1024 * 2.5)).toBe('2.5 MB');
    });
  });

  describe('2. Attachment-Driven Personalized Options', () => {
    it('personalizes options for uploaded routine / timetable', () => {
      const routineAttachment: ChatAttachment = {
        id: 'att-1',
        uri: 'file:///cache/routine_mon_fri.png',
        name: 'weekly_routine_2026.png',
        mimeType: 'image/png',
        sizeBytes: 450000,
        previewType: 'image',
        uploadedAt: new Date().toISOString(),
        category: 'routine',
      };

      const bankuCtx = generatePersonalizedContext({
        attachment: routineAttachment,
        persona: 'banku',
      });

      expect(bankuCtx).not.toBeNull();
      expect(bankuCtx?.label).toBe('Uploaded Routine');
      expect(bankuCtx?.category).toBe('routine');
      expect(bankuCtx?.chips.length).toBeGreaterThanOrEqual(4);
      expect(bankuCtx?.chips.some(c => c.label.includes('75% Bunk Margin'))).toBe(true);
      expect(bankuCtx?.chips.some(c => c.label.includes('Monday Lectures'))).toBe(true);

      // Shanky persona adapts recommendations to tactical study/bunk advice
      const shankyCtx = generatePersonalizedContext({
        attachment: routineAttachment,
        persona: 'shanky',
      });
      expect(shankyCtx).not.toBeNull();
      expect(shankyCtx?.label).toBe('Uploaded Routine');
      expect(shankyCtx?.chips.some(c => c.label.includes('Best Days to Bunk'))).toBe(true);
    });

    it('personalizes options for uploaded syllabus', () => {
      const syllabusAttachment: ChatAttachment = {
        id: 'att-2',
        uri: 'file:///cache/syllabus_cs301.pdf',
        name: 'data_structures_syllabus.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 1200000,
        previewType: 'pdf',
        uploadedAt: new Date().toISOString(),
        category: 'syllabus',
      };

      const bankuCtx = generatePersonalizedContext({
        attachment: syllabusAttachment,
        persona: 'banku',
      });

      expect(bankuCtx).not.toBeNull();
      expect(bankuCtx?.label).toBe('Uploaded Syllabus');
      expect(bankuCtx?.chips.some(c => c.label.includes('Study Plan'))).toBe(true);
      expect(bankuCtx?.chips.some(c => c.label.includes('High-Weightage Topics'))).toBe(true);

      const shankyCtx = generatePersonalizedContext({
        attachment: syllabusAttachment,
        persona: 'shanky',
      });
      expect(shankyCtx?.chips.some(c => c.label.includes('Night Before Exam Hacks'))).toBe(true);
    });

    it('personalizes options for academic calendar uploads', () => {
      const calAttachment: ChatAttachment = {
        id: 'att-3',
        uri: 'file:///cache/calendar.pdf',
        name: 'academic_calendar_fall.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 800000,
        previewType: 'pdf',
        uploadedAt: new Date().toISOString(),
        category: 'calendar',
      };

      const ctx = generatePersonalizedContext({
        attachment: calAttachment,
        persona: 'banku',
      });

      expect(ctx).not.toBeNull();
      expect(ctx?.label).toBe('Academic Calendar');
      expect(ctx?.chips.some(c => c.label.includes('Midterms'))).toBe(true);
      expect(ctx?.chips.some(c => c.label.includes('Holidays'))).toBe(true);
    });

    it('personalizes options for uploaded homework / assignment', () => {
      const assignAttachment: ChatAttachment = {
        id: 'att-4',
        uri: 'file:///cache/assignment_3.pdf',
        name: 'discrete_math_assignment_3.pdf',
        mimeType: 'application/pdf',
        sizeBytes: 300000,
        previewType: 'pdf',
        uploadedAt: new Date().toISOString(),
        category: 'assignment',
      };

      const ctx = generatePersonalizedContext({
        attachment: assignAttachment,
        persona: 'banku',
      });

      expect(ctx).not.toBeNull();
      expect(ctx?.label).toBe('Uploaded Assignment');
      expect(ctx?.chips.some(c => c.label.includes('Break Down into Tasks'))).toBe(true);
      expect(ctx?.chips.some(c => c.label.includes('Viva Questions'))).toBe(true);
    });

    it('personalizes options for photo of handwritten notes or blackboard diagram', () => {
      const photoAttachment: ChatAttachment = {
        id: 'att-5',
        uri: 'file:///cache/whiteboard_lecture.jpg',
        name: 'whiteboard_diagram.jpg',
        mimeType: 'image/jpeg',
        sizeBytes: 950000,
        previewType: 'image',
        uploadedAt: new Date().toISOString(),
        category: 'notes',
      };

      const ctx = generatePersonalizedContext({
        attachment: photoAttachment,
        persona: 'banku',
      });

      expect(ctx).not.toBeNull();
      expect(ctx?.label).toBe('Uploaded Photo');
      expect(ctx?.chips.some(c => c.label.includes('Transcribe & Summarize Notes'))).toBe(true);
      expect(ctx?.chips.some(c => c.label.includes('Explain Diagram'))).toBe(true);
    });
  });

  describe('3. Query-Driven Dynamic Personalization', () => {
    it('personalizes options when user asks attendance questions', () => {
      const ctx = generatePersonalizedContext({
        query: 'What is my attendance percentage and can I bunk tomorrow?',
        persona: 'shanky',
      });

      expect(ctx).not.toBeNull();
      expect(ctx?.category).toBe('attendance');
      expect(ctx?.label).toBe('Attendance Strategy');
      expect(ctx?.chips.some(c => c.label.includes('Calculate Safe Bunk Margin'))).toBe(true);
    });

    it('personalizes options when user asks coding or DSA questions', () => {
      const ctx = generatePersonalizedContext({
        query: 'Explain how recursion works with a tree diagram and stack frames',
        persona: 'banku',
      });

      expect(ctx).not.toBeNull();
      expect(ctx?.category).toBe('coding');
      expect(ctx?.label).toBe('Computer Science & Code');
      expect(ctx?.chips.some(c => c.label.includes('Time & Space Complexity'))).toBe(true);
      expect(ctx?.chips.some(c => c.label.includes('Dry Run with Example'))).toBe(true);
    });

    it('personalizes options when user asks for leave letters or emails', () => {
      const ctx = generatePersonalizedContext({
        query: 'Draft a medical leave letter for my college HOD',
        persona: 'banku',
      });

      expect(ctx).not.toBeNull();
      expect(ctx?.category).toBe('communication');
      expect(ctx?.label).toBe('Official Email & Letter');
      expect(ctx?.chips.some(c => c.label.includes('Formal Tone Email Draft'))).toBe(true);
    });

    it('personalizes options when user asks math or physics questions', () => {
      const ctx = generatePersonalizedContext({
        query: 'Derive the second law of motion from Newton',
        persona: 'banku',
      });

      expect(ctx).not.toBeNull();
      expect(ctx?.category).toBe('stem');
      expect(ctx?.label).toBe('Mathematics & Science');
      expect(ctx?.chips.some(c => c.label.includes('Step-by-Step Derivation'))).toBe(true);
    });
  });
});
