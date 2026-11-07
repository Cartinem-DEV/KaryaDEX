export interface LockinModuleEvents {
  onSessionTick: (remainingSeconds: number) => void;
  onSessionComplete: (sessionId: string) => void;
  onBlockingEvent: (packageName: string, action: 'blocked' | 'allowed') => void;
  onStrictModeTriggered: (mode: 'soft' | 'hard') => void;
  onError: (code: string, message: string) => void;
}

export interface StartSessionParams {
  sessionId: string;
  plannedDurationMinutes: number;
  blockedPackages: string[];
  whitelistedYtChannels: string[];
  strictMode: 'none' | 'soft' | 'hard';
}

export interface YoutubeParseResult {
  channelId: string | null;
  channelName: string | null;
  isValid: boolean;
}

export interface NativeSchedule {
  scheduleId: string;
  startTime: string; // "HH:mm"
  endTime: string; // "HH:mm"
  daysOfWeek: number[];
  strictMode: 'none' | 'soft' | 'hard';
}

// Phase 4: iOS Screen Time & Blocking
export interface BlockingSessionParams {
  sessionId: string;
  blockedPackages: string[];
  strictMode: 'none' | 'soft' | 'hard';
}

export interface LockinTypes {
  LockinModuleEvents: LockinModuleEvents;
  StartSessionParams: StartSessionParams;
  YoutubeParseResult: YoutubeParseResult;
  NativeSchedule: NativeSchedule;
  // Phase 4: iOS Screen Time
  BlockingSessionParams: BlockingSessionParams;
}
