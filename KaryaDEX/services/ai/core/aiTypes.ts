/**
 * KaryaDEX — AI Academic Intelligence Engine Types (Phase 12)
 *
 * Strict contracts for provider abstraction, persona routing, proposal flow,
 * safety policies, and runtime validation.
 */

export type AIPersonaId = 'banku' | 'shanky';

export type AIProviderId = 'gemini' | 'mistral' | 'mock' | 'edge-gateway' | 'groq';

export type AICapability = 'text' | 'structured' | 'vision' | 'pdf' | 'multimodal';

export type AIModelSlot = 'banku_primary' | 'banku_fallback' | 'shanky_primary';

export interface AIModelConfig {
  slot: AIModelSlot;
  provider: AIProviderId;
  modelId: string;
  maxTokens: number;
  temperature: number;
  supportsThinking?: boolean;
  thinkingLevel?: 'minimal' | 'low' | 'medium' | 'high';
}

export interface AIProviderLimitConfig {
  provider: AIProviderId;
  requestsPerMinute: number;
  tokensPerMinute: number;
  dailyRequestCeiling: number;
  monthlyTokenBudget?: number;
  retryAfterSeconds: number;
}

export type AIDataClassification = 'PUBLIC' | 'PERSONAL' | 'ACADEMIC' | 'SENSITIVE';

export type AIProposalType = 
  | 'CREATE_TASK'
  | 'UPDATE_TASK'
  | 'DELETE_TASK'
  | 'CREATE_SUBTASKS'
  | 'CREATE_TIMETABLE_SLOT'
  | 'UPDATE_TIMETABLE_SLOT'
  | 'DELETE_TIMETABLE_SLOT'
  | 'CLEAR_TIMETABLE'
  | 'IMPORT_TIMETABLE'
  | 'IMPORT_SYLLABUS'
  | 'IMPORT_CALENDAR'
  | 'UPDATE_PROFILE'
  | 'MARK_ATTENDANCE'
  | 'CREATE_EXAM'
  | 'DELETE_EXAM';

export type AIProposalStatus = 'pending' | 'previewed' | 'approved' | 'rejected' | 'applied';

export interface AIProposal<T = any> {
  id: string;
  type: AIProposalType;
  title: string;
  description: string;
  status: AIProposalStatus;
  createdAt: string;
  userId: string;
  payload: T;
  appliedAt?: string;
  rejectionReason?: string;
}

export interface TimetableSlotProposalPayload {
  dayOfWeek: string;
  startTime: string; // HH:MM
  endTime: string;   // HH:MM
  subjectName: string;
  subjectCode?: string;
  room?: string;
  teacher?: string;
  type?: 'lecture' | 'lab' | 'tutorial' | 'other';
  confidence?: number;
  conflictWarning?: string;
}

export interface TaskBreakdownProposalPayload {
  parentTitle: string;
  subjectId?: string;
  subjectName?: string;
  subtasks: Array<{
    title: string;
    estimatedMinutes: number;
    orderIndex: number;
  }>;
}

export interface ProfileSetupProposalPayload {
  studentName?: string;
  collegeName?: string;
  program?: string;
  semesterName?: string;
  attendanceTarget?: number;
  subjects?: Array<{
    name: string;
    code?: string;
  }>;
}

export interface DailyBriefingPayload {
  greeting: string;
  summaryDate: string;
  headline: string;
  attendanceAlert?: {
    subjectName: string;
    currentAttendance: number;
    status: 'safe' | 'watch' | 'danger';
    advice: string;
  };
  scheduleHighlights: string[];
  priorityTasks: string[];
  actionRecommendation: string;
}

export interface AttendanceExplanationPayload {
  subjectName: string;
  deterministicPercentage: number;
  deterministicTarget: number;
  deterministicSafeBunks: number;
  deterministicRecoveryNeeded: number;
  attendancePressure: 'low' | 'medium' | 'high' | 'critical';
  trend: 'improving' | 'stable' | 'declining' | 'insufficient_data';
  situationSummary: string;
  bunkAdvice: string;
  recoveryAdvice?: string;
  recommendedAction: string;
}

export interface ConversationalChatPayload {
  reply: string;
  suggestedActions?: string[];
  actionType?: 'view_attendance' | 'view_tasks' | 'view_schedule' | 'create_subtasks' | 'general';
  relatedSubjectId?: string;
  isDeterministicFallback?: boolean;
}

export interface BankuChatPayload {
  reply: string;
  suggestedActions?: string[];
  proposal?: AIProposal;
}

export interface ExtractedSubjectProposalItem {
  subjectName: string;
  subjectCode?: string;
  credits?: number;
  category?: string;
  units: Array<{
    name: string;
    topics: Array<{
      name: string;
      orderIndex?: number;
      subtopics?: string[];
    }>;
  }>;
}

export interface SyllabusProposalPayload {
  subjectName: string;
  subjectCode?: string;
  credits?: number;
  category?: string;
  units: Array<{
    name: string;
    topics: Array<{
      name: string;
      orderIndex: number;
      subtopics?: string[];
    }>;
  }>;
  subjects?: ExtractedSubjectProposalItem[];
}

export interface CalendarHolidayPayload {
  date: string; // YYYY-MM-DD
  name: string;
  isOfficial: boolean;
  confidence?: number;
}

export interface CalendarExamPayload {
  title: string;
  startDate: string; // YYYY-MM-DD
  endDate?: string;
  type?: string;
}

export interface CalendarProposalPayload {
  semesterName?: string;
  startDate?: string;
  endDate?: string;
  holidays: CalendarHolidayPayload[];
  exams: CalendarExamPayload[];
  deadlines?: Array<{
    title: string;
    date: string;
  }>;
}

// Request Contracts
export interface BaseAIRequest {
  userId: string;
  persona: AIPersonaId;
  feature: string;
  requiresVision?: boolean;
  requiresPDF?: boolean;
  clientTimestamp?: string;
}

export interface ConversationalChatRequest extends BaseAIRequest {
  feature: 'conversational_chat';
  userMessage: string;
  conversationHistory?: Array<{
    sender: 'user' | 'assistant';
    text: string;
  }>;
  attendanceSummary?: Array<{
    subjectId: string;
    subjectName: string;
    percentage: number;
    safeBunks: number;
    recoveryNeeded: number;
    status: 'safe' | 'watch' | 'danger';
  }>;
  todayClasses?: Array<{
    subjectName: string;
    startTime: string;
    endTime: string;
    room?: string;
  }>;
  pendingTasks?: Array<{
    title: string;
    dueDate?: string;
  }>;
  upcomingExams?: Array<{
    subjectName: string;
    date: string;
  }>;
}

export interface TextChatRequest extends BaseAIRequest {
  feature: 'chat';
  messages: Array<{
    role: 'user' | 'assistant' | 'system';
    content: string;
  }>;
  contextSnippet?: string;
}

export interface AttendanceExplainRequest extends BaseAIRequest {
  feature: 'attendance_explainer';
  subjectId: string;
  subjectName: string;
  currentAttendance: number;
  targetAttendance: number;
  attendedClasses: number;
  conductedClasses: number;
  safeBunkCapacity: number;
  recoveryNeeded: number;
  attendancePressure: 'low' | 'medium' | 'high' | 'critical';
  trend: 'improving' | 'stable' | 'declining' | 'insufficient_data';
  nextClassDate?: string;
}

export interface DailyBriefingRequest extends BaseAIRequest {
  feature: 'daily_briefing';
  dateString: string;
  todayClasses: Array<{
    time: string;
    subjectName: string;
    room?: string;
  }>;
  pendingTasks: Array<{
    id: string;
    title: string;
    priority: string;
    dueDate?: string;
  }>;
  attendanceAlerts: Array<{
    subjectName: string;
    currentPercentage: number;
    status: 'safe' | 'watch' | 'danger';
  }>;
  upcomingExams: Array<{
    subjectName: string;
    examDate: string;
    daysLeft: number;
  }>;
}

export interface TaskBreakdownRequest extends BaseAIRequest {
  feature: 'task_breakdown';
  taskTitle: string;
  taskDescription?: string;
  subjectName?: string;
}

export interface TimetableExtractionRequest extends BaseAIRequest {
  feature: 'timetable_extraction';
  fileBase64: string;
  fileMimeType: string;
  fileName: string;
  fileSizeBytes: number;
  existingSubjects?: string[];
}

export interface NaturalLanguageProfileRequest extends BaseAIRequest {
  feature: 'profile_setup';
  userInput: string;
}

// Responses
export interface AIUsageMetrics {
  promptTokens?: number;
  completionTokens?: number;
  totalTokens?: number;
  latencyMs: number;
}

export interface AIResponse<T = any> {
  success: boolean;
  persona: AIPersonaId;
  provider: AIProviderId;
  model: string;
  fallbackUsed: boolean;
  data: T;
  proposal?: AIProposal;
  metrics: AIUsageMetrics;
  error?: string;
}

// Audit & Quota
export interface AIAuditEntry {
  id: string;
  userId: string;
  persona: AIPersonaId;
  provider: AIProviderId;
  model: string;
  feature: string;
  timestamp: string;
  success: boolean;
  latencyMs: number;
  tokenUsage?: number;
  fallbackUsed: boolean;
  policyRejection?: boolean;
  errorMessage?: string;
}

export interface AIQuotaUsage {
  userId: string;
  date: string; // YYYY-MM-DD
  requestCount: number;
  estimatedTokens: number;
  lastRequestTime: string;
}

export interface AIQuotaTier {
  name: 'free' | 'pro' | 'byok';
  maxDailyRequests: number;
  maxTokensPerRequest: number;
  allowsMultimodal: boolean;
}

// Custom Error Classes
export class AIError extends Error {
  public isRetryable: boolean;
  public code: string;

  constructor(message: string, code = 'AI_ERROR', isRetryable = false) {
    super(message);
    this.name = 'AIError';
    this.code = code;
    this.isRetryable = isRetryable;
  }
}

export class AIProviderRateLimitError extends AIError {
  constructor(message = 'AI provider rate limit exceeded. Please try again shortly.') {
    super(message, 'RATE_LIMIT_EXCEEDED', true);
    this.name = 'AIProviderRateLimitError';
  }
}

export class AIProviderTimeoutError extends AIError {
  constructor(message = 'AI provider timed out.') {
    super(message, 'TIMEOUT', true);
    this.name = 'AIProviderTimeoutError';
  }
}

export class AIProviderAuthError extends AIError {
  constructor(message = 'AI provider authentication failed.') {
    super(message, 'AUTH_FAILED', false);
    this.name = 'AIProviderAuthError';
  }
}

export class AIInvalidRequestError extends AIError {
  constructor(message: string) {
    super(message, 'INVALID_REQUEST', false);
    this.name = 'AIInvalidRequestError';
  }
}

export class AIContextViolationError extends AIError {
  constructor(message = 'Unauthorized or cross-user context detected.') {
    super(message, 'CONTEXT_VIOLATION', false);
    this.name = 'AIContextViolationError';
  }
}

export class AIPolicyRejectionError extends AIError {
  constructor(message = 'Request rejected by AI safety policy.') {
    super(message, 'POLICY_REJECTION', false);
    this.name = 'AIPolicyRejectionError';
  }
}

export class AIQuotaExceededError extends AIError {
  constructor(message = 'Daily AI usage quota reached.') {
    super(message, 'QUOTA_EXCEEDED', false);
    this.name = 'AIQuotaExceededError';
  }
}
