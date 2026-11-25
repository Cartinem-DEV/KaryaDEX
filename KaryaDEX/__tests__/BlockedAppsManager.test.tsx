/**
 * KaryaDEX — BlockedAppsManager Tests
 *
 * Verifies the BlockedAppsManager UI component and store integration.
 */

import React from 'react';
import { render, screen } from '@testing-library/react-native';
import { BlockedAppsManager } from '../components/lockin/BlockedAppsManager';

// Mock expo components
jest.mock('expo-router', () => ({ Link: jest.fn() }));
jest.mock('expo-haptics', () => ({
  impactAsync: jest.fn(),
  NotificationFeedbackType: { Success: 'success' },
}));

// Mock native module for blocked packages sync
jest.mock('../modules/expo-module-lockin/src/LockinModule', () => ({
  LockinModule: {
    addBlockedPackages: jest.fn(),
    removeBlockedPackages: jest.fn(),
    updateBlockedPackages: jest.fn(),
    getBlockedPackages: jest.fn().mockResolvedValue([]),
    requestOverlayPermission: jest.fn().mockResolvedValue(true),
    requestUsageStatsPermission: jest.fn().mockResolvedValue(true),
    requestNotificationPermission: jest.fn().mockResolvedValue(true),
    hasAllPermissions: jest.fn().mockResolvedValue(true),
    requestScreenTimePermission: jest.fn().mockResolvedValue(true),
    isScreenTimeAuthorized: jest.fn().mockResolvedValue(true),
    startBlockingSession: jest.fn(),
    endBlockingSession: jest.fn(),
  },
}));

describe('BlockedAppsManager', () => {
  const mockUserId = 'u1';

  beforeEach(() => {
    jest.clearAllMocks();
  });

  it('renders empty state when no blocked apps', async () => {
    await render(
      <BlockedAppsManager userId={mockUserId} visible={true} onClose={jest.fn()} />
    );
    expect(screen.getByText('No blocked apps yet')).toBeDefined();
  });

  it('displays list of blocked apps when apps exist', async () => {
    const nowIso = new Date().toISOString();
    await render(
      <BlockedAppsManager
        userId={mockUserId}
        visible={true}
        onClose={jest.fn()}
        blockedApps={[
          { id: '1', userId: 'u1', packageName: 'com.instagram.android', appName: 'Instagram', isBlocked: true, createdAt: nowIso, updatedAt: nowIso },
          { id: '2', userId: 'u1', packageName: 'com.twitter.android', appName: 'X (Twitter)', isBlocked: true, createdAt: nowIso, updatedAt: nowIso },
        ]}
        onToggle={jest.fn()}
        onRemove={jest.fn()}
        onAddApp={jest.fn()}
      />
    );
    expect(screen.getByText('Instagram')).toBeDefined();
    expect(screen.getByText('X (Twitter)')).toBeDefined();
  });
});