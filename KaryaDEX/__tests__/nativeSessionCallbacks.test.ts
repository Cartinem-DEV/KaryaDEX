/**
 * BunkMatKar — Native Session Callbacks Tests
 *
 * Verifies that native session completion callbacks sync to JS store.
 */

import { LockinTimerService } from '../services/lockin/lockinTimerService';
import { LockinModule } from 'expo-module-lockin';
import { Platform } from 'react-native';

jest.mock('expo-module-lockin', () => ({
  LockinModule: {
    addListener: jest.fn(),
    removeAllListeners: jest.fn(),
    endSession: jest.fn(),
    requestScreenTimePermission: jest.fn().mockResolvedValue(true),
    isScreenTimeAuthorized: jest.fn().mockResolvedValue(true),
  },
}));

describe('Native Session Callbacks', () => {
  beforeEach(() => {
    jest.clearAllMocks();
    (Platform as any).OS = 'android';
    // Reset the singleton instance
    LockinTimerService.resetInstance();
  });

  it('registers listener for onSessionComplete when timer service is instantiated', () => {
    LockinTimerService.getInstance();
    expect(LockinModule.addListener).toHaveBeenCalledWith('onSessionComplete', expect.any(Function));
  });
});