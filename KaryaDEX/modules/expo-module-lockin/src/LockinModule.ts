import { LockinModuleEvents, StartSessionParams, YoutubeParseResult, NativeSchedule, BlockingSessionParams } from "./LockinTypes";

export type LockinModuleType = {
  // Session management
  startSession(params: StartSessionParams): Promise<void>;
  pauseSession(): Promise<void>;
  resumeSession(): Promise<void>;
  endSession(): Promise<void>;
  getSessionState(): Promise<{ remainingSeconds: number; isActive: boolean }>;

  // Blocking
  addBlockedPackages(packages: string[]): Promise<void>;
  removeBlockedPackages(packages: string[]): Promise<void>;
  getBlockedPackages(): Promise<string[]>;

  // YouTube
  parseYoutubeUrl(url: string): Promise<YoutubeParseResult>;
  addWhitelistedChannel(channelId: string): Promise<void>;
  removeWhitelistedChannel(channelId: string): Promise<void>;

  // Strict mode
  setStrictMode(mode: 'none' | 'soft' | 'hard'): Promise<void>;
  getStrictMode(): Promise<'none' | 'soft' | 'hard'>;

  // Permissions
  requestOverlayPermission(): Promise<boolean>;
  requestUsageStatsPermission(): Promise<boolean>;
  requestNotificationPermission(): Promise<boolean>;
  hasAllPermissions(): Promise<boolean>;

  // Phase 3: Scheduling
  scheduleSchedules(schedules: NativeSchedule[]): Promise<void>;
  cancelSchedule(scheduleId: string): Promise<void>;

  // Phase 3: Reality Check
  launchRealityCheck(params: { packageName: string; delaySeconds: number; promptQuestion: string }): Promise<void>;

  // Phase 3: Quota & Blocking Session
  updateQuotas(quotas: { packageName: string; dailyLimitMinutes: number; usedMinutesToday: number; isActive: boolean }[]): Promise<void>;
  updateRealityCheck(enabled: boolean, delaySeconds: number, prompt: string): Promise<void>;
  startBlockingSession(params: BlockingSessionParams): Promise<void>;
  endBlockingSession(): Promise<void>;

  // Phase 4: iOS Screen Time & Managed Settings
  requestScreenTimePermission(): Promise<boolean>;
  isScreenTimeAuthorized(): Promise<boolean>;

  // Installed applications
  getInstalledApps?(): Promise<{ packageName: string; appName: string }[]>;

  // Event emitter
  addListener(eventName: keyof LockinModuleEvents, listener: Function): void;
  removeAllListeners(eventName: keyof LockinModuleEvents): void;
};

// Safe default no-op fallback implementation for Web, Expo Go, Simulators, and Unit Tests
export const fallbackLockinModule: LockinModuleType = {
  startSession: async () => {},
  pauseSession: async () => {},
  resumeSession: async () => {},
  endSession: async () => {},
  getSessionState: async () => ({ remainingSeconds: 0, isActive: false }),

  addBlockedPackages: async (_packages: string[]) => {},
  removeBlockedPackages: async (_packages: string[]) => {},
  getBlockedPackages: async () => [],

  parseYoutubeUrl: async (_url: string): Promise<YoutubeParseResult> => ({
    isValid: false,
    channelId: null,
    channelName: null,
  }),
  addWhitelistedChannel: async (_channelId: string) => {},
  removeWhitelistedChannel: async (_channelId: string) => {},

  setStrictMode: async (_mode: 'none' | 'soft' | 'hard') => {},
  getStrictMode: async () => 'none',

  requestOverlayPermission: async () => false,
  requestUsageStatsPermission: async () => false,
  requestNotificationPermission: async () => false,
  hasAllPermissions: async () => false,

  scheduleSchedules: async (_schedules: NativeSchedule[]) => {},
  cancelSchedule: async (_scheduleId: string) => {},

  launchRealityCheck: async () => {},

  updateQuotas: async () => {},
  updateRealityCheck: async () => {},
  startBlockingSession: async () => {},
  endBlockingSession: async () => {},

  requestScreenTimePermission: async () => false,
  isScreenTimeAuthorized: async () => false,

  getInstalledApps: async () => [],

  addListener: () => {},
  removeAllListeners: () => {},
};

declare const require: any;

let nativeModule: LockinModuleType | null = null;
try {
  if (typeof require !== 'undefined') {
    const { requireOptionalNativeModule } = require('expo-modules-core');
    if (typeof requireOptionalNativeModule === 'function') {
      nativeModule = requireOptionalNativeModule('LockinModule');
    }
  }
} catch {
  nativeModule = null;
}

export const LockinModule: LockinModuleType = new Proxy(fallbackLockinModule, {
  get(target, prop, receiver) {
    if (nativeModule && prop in nativeModule) {
      const val = (nativeModule as any)[prop];
      if (typeof val === 'function') {
        return val.bind(nativeModule);
      }
      return val;
    }
    if (prop in target) {
      return Reflect.get(target, prop, receiver);
    }
    return async () => undefined;
  },
});

