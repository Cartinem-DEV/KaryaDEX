/**
 * KaryaDEX — Official Mascot Asset Catalog & Telemetry Configurations
 *
 * Implements design board specifications from Onboarding Screen 3:
 * - Banku: Amber (#F59E0B), Academic Guardian, Vision AI (Doc/routine parsing, syllabus auditing)
 * - Shanky: Electric Cyan (#00E5FF), Tactical Co-Pilot, Conversation AI (Attendance margin, planning, reminders)
 */

export const MASCOT_ASSETS = {
  banku: {
    hero: require('@/assets/images/mascot/banku_hero.png'),
    avatar: require('@/assets/images/mascot/banku_avatar_circle.png'),
    poses: {
      idle: require('@/assets/images/mascot/banku_pose_idle.png'),
      scanning: require('@/assets/images/mascot/banku_pose_scanning.png'),
      analyzing: require('@/assets/images/mascot/banku_pose_analyzing.png'),
      success: require('@/assets/images/mascot/banku_pose_success.png'),
      thinking: require('@/assets/images/mascot/banku_pose_thinking.png'),
    },
    expressions: {
      idle: require('@/assets/images/mascot/banku_exp_idle.png'),
      scanning: require('@/assets/images/mascot/banku_exp_scanning.png'),
      analyzing: require('@/assets/images/mascot/banku_exp_analyzing.png'),
      success: require('@/assets/images/mascot/banku_exp_success.png'),
      thinking: require('@/assets/images/mascot/banku_exp_thinking.png'),
    },
  },
  shanky: {
    hero: require('@/assets/images/mascot/shanky_hero.png'),
    avatar: require('@/assets/images/mascot/shanky_avatar_circle.png'),
    poses: {
      idle: require('@/assets/images/mascot/shanky_pose_idle.png'),
      explaining: require('@/assets/images/mascot/shanky_pose_explaining.png'),
      planning: require('@/assets/images/mascot/shanky_pose_planning.png'),
      celebrating: require('@/assets/images/mascot/shanky_pose_celebrating.png'),
      curious: require('@/assets/images/mascot/shanky_pose_curious.png'),
    },
    expressions: {
      idle: require('@/assets/images/mascot/shanky_exp_idle.png'),
      explaining: require('@/assets/images/mascot/shanky_exp_explaining.png'),
      planning: require('@/assets/images/mascot/shanky_exp_planning.png'),
      celebrating: require('@/assets/images/mascot/shanky_exp_celebrating.png'),
      curious: require('@/assets/images/mascot/shanky_exp_curious.png'),
    },
  },
  dual: {
    illustration: require('@/assets/images/mascot/dual_illustration_card.png'),
  },
};

export const MASCOT_COLORS = {
  banku: {
    primary: '#F59E0B',
    primaryAlpha: 'rgba(245, 158, 11, 0.2)',
    border: 'rgba(245, 158, 11, 0.35)',
    glow: '#F59E0B',
    darkText: '#05070B',
  },
  shanky: {
    primary: '#00E5FF',
    primaryAlpha: 'rgba(0, 229, 255, 0.2)',
    border: 'rgba(0, 229, 255, 0.35)',
    glow: '#00E5FF',
    darkText: '#05070B',
  },
};

export type PersonaKey = 'banku' | 'shanky' | 'dual';
export type BankuState = 'idle' | 'scanning' | 'analyzing' | 'success' | 'thinking';
export type ShankyState = 'idle' | 'explaining' | 'planning' | 'celebrating' | 'curious';

export const BANKU_STATE_CONFIG: Record<BankuState, { label: string; telemetry: string }> = {
  idle: {
    label: 'Standby',
    telemetry: 'LIVE TELEMETRY • ACADEMIC INTEGRITY SENTINEL',
  },
  scanning: {
    label: 'Scanning',
    telemetry: 'LIVE TELEMETRY • SCANNING TIMETABLE & SYLLABUS',
  },
  analyzing: {
    label: 'Analyzing',
    telemetry: 'LIVE TELEMETRY • CURRICULUM & CREDIT AUDITING',
  },
  success: {
    label: 'Verified',
    telemetry: 'LIVE TELEMETRY • ZERO-DEBAR CREDITS SECURED',
  },
  thinking: {
    label: 'Optimizing',
    telemetry: 'LIVE TELEMETRY • COMPUTING OPTIMAL PATHWAY',
  },
};

export const SHANKY_STATE_CONFIG: Record<ShankyState, { label: string; telemetry: string }> = {
  idle: {
    label: 'Standby',
    telemetry: 'LIVE TELEMETRY • ACTIVE CO-PILOT STANDBY',
  },
  explaining: {
    label: 'Insights',
    telemetry: 'LIVE TELEMETRY • ATTENDANCE MARGIN INSIGHTS',
  },
  planning: {
    label: 'Planning',
    telemetry: 'LIVE TELEMETRY • STRATEGIC STUDY PLANNING',
  },
  celebrating: {
    label: 'Milestone',
    telemetry: 'LIVE TELEMETRY • ATTENDANCE MILESTONE SECURED',
  },
  curious: {
    label: 'Inquire',
    telemetry: 'LIVE TELEMETRY • CONTEXTUAL INQUIRY ASSIST',
  },
};
