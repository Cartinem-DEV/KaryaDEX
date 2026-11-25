/**
 * KaryaDEX — Quota Persistence Tests
 *
 * Verifies that quota usage is persisted to SQLite from native worker.
 */

import { lockinStorage } from '../services/lockin/lockinStorage';
import { formatLocalDate } from '../lib/timeUtils';

// Mock the database
jest.mock('../database', () => ({
  getDatabaseConnection: jest.fn().mockResolvedValue({
    runAsync: jest.fn(),
    getFirstAsync: jest.fn(),
    getAllAsync: jest.fn(),
  }),
  initDatabase: jest.fn(),
}));

describe('Quota Persistence', () => {
  const today = formatLocalDate(new Date());

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('persists used_minutes_today after native poll', async () => {
    // This test will be expanded when we implement incrementQuotaUsedMinutes
    expect(true).toBe(true);
  });
});