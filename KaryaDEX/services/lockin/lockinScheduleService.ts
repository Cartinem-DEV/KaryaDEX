/**
 * BunkMatKar — Lockin Schedule Service
 *
 * Manages recurring study schedules and coordinates with the native Android
 * alarm manager via LockinModule.
 */

import { Platform } from 'react-native';
import { LockinModule } from 'expo-module-lockin';
import { lockinStorage } from './lockinStorage';
import type { LockinSchedule } from '@/types/lockin';

export class LockinScheduleService {
  private static instance: LockinScheduleService;

  public static getInstance(): LockinScheduleService {
    if (!LockinScheduleService.instance) {
      LockinScheduleService.instance = new LockinScheduleService();
    }
    return LockinScheduleService.instance;
  }

  /**
   * Synchronizes all active local schedules with the native Android AlarmManager.
   */
  public async syncNativeSchedules(userId: string): Promise<void> {
    if (Platform.OS !== 'android') return;

    try {
      const schedules = await lockinStorage.getSchedules(userId);
      const activeSchedules = schedules.filter(s => s.isActive);

      // Map to native-friendly parameters
      const nativeSchedules = activeSchedules.map(s => ({
        scheduleId: s.id,
        startTime: s.startTime,
        endTime: s.endTime,
        daysOfWeek: s.daysOfWeek,
        strictMode: s.strictMode,
      }));

      // Call native module (to be implemented in LockinModule.kt)
      // @ts-ignore - scheduleSchedules will be added in Task 5.3
      await LockinModule.scheduleSchedules(nativeSchedules);
    } catch (error) {
      console.error('[LockinScheduleService] Failed to sync native schedules:', error);
    }
  }

  /**
   * Cancels a specific scheduled focus session.
   */
  public async cancelSchedule(scheduleId: string): Promise<void> {
    if (Platform.OS !== 'android') return;
    try {
      // @ts-ignore
      await LockinModule.cancelSchedule(scheduleId);
    } catch (error) {
      console.error(`[LockinScheduleService] Failed to cancel schedule ${scheduleId}:`, error);
    }
  }
}

export const lockinScheduleService = LockinScheduleService.getInstance();