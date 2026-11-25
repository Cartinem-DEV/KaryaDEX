/**
 * KaryaDEX — Scheduled Session Lifecycle Tests
 *
 * Verifies that scheduled focus sessions create and complete DB records.
 */

import { lockinStorage } from '../services/lockin/lockinStorage';
import { formatLocalDate } from '../lib/timeUtils';

jest.mock('../modules/expo-module-lockin/src/LockinModule', () => ({
  LockinModule: {
    cancelSchedule: jest.fn(),
    scheduleSchedules: jest.fn(),
    startBlockingSession: jest.fn(),
    endBlockingSession: jest.fn(),
    requestScreenTimePermission: jest.fn().mockResolvedValue(true),
    isScreenTimeAuthorized: jest.fn().mockResolvedValue(true),
  },
}));

describe('Scheduled Session Lifecycle', () => {
  const now = new Date();
  const todayStr = formatLocalDate(now);
  const mockUserId = 'u1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('creates a scheduled session record when alarm fires', async () => {
    // Create a schedule first
    const schedule = await lockinStorage.createSchedule({
      name: 'Morning Focus',
      daysOfWeek: [1, 2, 3, 4, 5],
      startTime: '09:00',
      endTime: '11:00',
      strictMode: 'soft',
      isActive: true,
      userId: mockUserId,
    });

    // Simulate alarm receiver creating session
    const session = await lockinStorage.createScheduledSession(schedule.id, mockUserId);

    expect(session.sessionType).toBe('exam_prep'); // Default from spec
    expect(session.status).toBe('active');
    expect(session.userId).toBe(mockUserId);
    expect(session.plannedDurationMinutes).toBe(60); // 60 from default in storage
  });

  it('completes a scheduled session record and updates status', async () => {
    // First create and mark active
    const schedule = await lockinStorage.createSchedule({
      name: 'Evening Study',
      daysOfWeek: [6],
      startTime: '19:00',
      endTime: '21:00',
      strictMode: 'hard',
      isActive: true,
      userId: mockUserId,
    });

    const activeSession = await lockinStorage.createScheduledSession(schedule.id, mockUserId);
    expect(activeSession.status).toBe('active');

    // Simulate end of session
    const completedSession = await lockinStorage.completeScheduledSession(activeSession.id, 90);

    expect(completedSession?.status).toBe('completed');
    expect(completedSession?.actualDurationMinutes).toBe(90);
    expect(completedSession?.completedAt).toBeDefined();
  });
});
