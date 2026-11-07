/**
 * BunkMatKar — Revision Intelligence Service (Phase 7)
 *
 * Deterministic, offline-first intelligence service that derives the current
 * revision state, history, and revision priority of Topics using existing academic
 * data (ClassSessions, ClassNotes, Syllabus, Exams, Tasks) and RevisionRecords.
 *
 * Principles:
 * - Deterministic: Same input state produces identical output.
 * - Explainable: Clear rules based on teaching status, review history, confidence, and exams.
 * - Non-destructive: Derives current state without deleting historical records.
 * - No AI / No SM-2 / No Leitner.
 */

import type { Exam, Task } from '@/types';
import type {
  Topic,
  ClassNote,
  ExamTopic,
  RevisionRecord,
  RevisionRecordInput,
  RevisionState,
  RevisionPriority,
  TopicRevisionIntelligence,
  RevisionStatistics,
  RevisionConfidence,
  RevisionOutcome,
} from '@/types/academic';
import { useAcademicStore } from '@/store/useAcademicStore';
import { useAppStore } from '@/store/useAppStore';
import { revisionRepository } from '@/database/repositories/revisionRepository';
import { daysUntil, formatLocalDate, parseLocalDate } from '@/lib/timeUtils';

export class RevisionIntelligenceService {
  /**
   * Deterministically calculates days between two local-date strings (YYYY-MM-DD).
   */
  calculateDaysDiff(earlierDateStr: string, laterDateStr: string): number {
    const d1 = parseLocalDate(earlierDateStr);
    const d2 = parseLocalDate(laterDateStr);
    const diffMs = d2.getTime() - d1.getTime();
    return Math.max(0, Math.floor(diffMs / (24 * 60 * 60 * 1000)));
  }

  /**
   * Derives whether a topic is taught and finds its earliest teaching date.
   */
  getTeachingInfo(
    topic: Topic,
    classNotes: ClassNote[]
  ): { isTaught: boolean; firstTaughtAt?: string } {
    let isTaught =
      topic.isCompleted === true ||
      topic.revisionStatus === 'taught' ||
      topic.revisionStatus === 'revised' ||
      topic.revisionStatus === 'needs_revision';

    let firstTaughtAt: string | undefined;

    // Search ClassNotes for this topic
    const matchingNotes = classNotes
      .filter(n => n.topicIds && n.topicIds.includes(topic.id))
      .sort((a, b) => a.date.localeCompare(b.date));

    if (matchingNotes.length > 0) {
      isTaught = true;
      firstTaughtAt = matchingNotes[0].date;
    } else if (topic.lastTaughtAt) {
      firstTaughtAt = topic.lastTaughtAt.split('T')[0];
    }

    return { isTaught, firstTaughtAt };
  }

  /**
   * Derives the deterministic RevisionState of a Topic given its records and notes.
   */
  deriveTopicState(
    topic: Topic,
    records: RevisionRecord[],
    classNotes: ClassNote[]
  ): RevisionState {
    const { isTaught } = this.getTeachingInfo(topic, classNotes);
    if (!isTaught) {
      return 'NOT_TAUGHT';
    }

    if (!records || records.length === 0) {
      return 'NOT_REVIEWED';
    }

    // Sort records descending by reviewedAt (and createdAt as tiebreaker)
    const sorted = [...records].sort((a, b) => {
      const cmp = b.reviewedAt.localeCompare(a.reviewedAt);
      if (cmp !== 0) return cmp;
      return b.createdAt.localeCompare(a.createdAt);
    });

    const latest = sorted[0];

    if (latest.outcome === 'confident') {
      return 'CONFIDENT';
    }
    if (latest.outcome === 'needs_review') {
      return 'NEEDS_REVIEW';
    }

    // outcome === 'okay'
    if (latest.confidence === 'high') {
      return 'CONFIDENT';
    }
    if (latest.confidence === 'low') {
      return 'NEEDS_REVIEW';
    }

    return 'REVIEWED';
  }

  /**
   * Derives the deterministic RevisionPriority for a topic.
   */
  calculateRevisionPriority(params: {
    isTaught: boolean;
    records: RevisionRecord[];
    daysSinceTaught?: number;
    daysSinceLastRevision?: number;
    upcomingExamDays?: number;
  }): RevisionPriority {
    const {
      isTaught,
      records,
      daysSinceTaught,
      daysSinceLastRevision,
      upcomingExamDays,
    } = params;

    if (!isTaught) {
      return 'low';
    }

    const hasRecords = records && records.length > 0;
    const sorted = hasRecords
      ? [...records].sort((a, b) => {
          const cmp = b.reviewedAt.localeCompare(a.reviewedAt);
          if (cmp !== 0) return cmp;
          return b.createdAt.localeCompare(a.createdAt);
        })
      : [];

    const latest = sorted.length > 0 ? sorted[0] : null;
    const outcome = latest?.outcome;
    const confidence = latest?.confidence;

    const isStale =
      daysSinceLastRevision !== undefined
        ? daysSinceLastRevision > 14
        : daysSinceTaught !== undefined && daysSinceTaught > 14;

    // ── Rule 1: Imminent Exam (<= 3 days) ──
    if (upcomingExamDays !== undefined && upcomingExamDays >= 0 && upcomingExamDays <= 3) {
      if (!hasRecords || outcome !== 'confident' || confidence === 'low') {
        return 'critical';
      }
      return 'medium';
    }

    // ── Rule 2: Near Exam (4 to 7 days) ──
    if (upcomingExamDays !== undefined && upcomingExamDays > 3 && upcomingExamDays <= 7) {
      if (!hasRecords || outcome === 'needs_review' || confidence === 'low') {
        return 'high';
      }
      if (outcome === 'okay') {
        return 'high';
      }
      return 'low';
    }

    // ── Rule 3: Exam within 8 to 14 days ──
    if (upcomingExamDays !== undefined && upcomingExamDays > 7 && upcomingExamDays <= 14) {
      if (!hasRecords || outcome === 'needs_review' || confidence === 'low' || isStale) {
        return 'high';
      }
      if (outcome === 'okay') {
        return 'medium';
      }
      return 'low';
    }

    // ── Rule 4: No upcoming exam / exam > 14 days ──
    if (!hasRecords) {
      // Taught but never reviewed
      if (daysSinceTaught !== undefined && daysSinceTaught > 7) {
        return 'medium';
      }
      return 'medium';
    }

    if (outcome === 'needs_review' || confidence === 'low') {
      return isStale ? 'high' : 'medium';
    }

    if (outcome === 'okay') {
      return isStale ? 'medium' : 'low';
    }

    // Confident with high confidence and no imminent exam
    return 'low';
  }

  /**
   * Builds the comprehensive TopicRevisionIntelligence for a single topic.
   */
  deriveTopicIntelligence(
    topic: Topic,
    records: RevisionRecord[],
    classNotes: ClassNote[],
    exams: Exam[],
    examTopics: ExamTopic[],
    now: Date = new Date()
  ): TopicRevisionIntelligence {
    const todayStr = formatLocalDate(now);
    const { isTaught, firstTaughtAt } = this.getTeachingInfo(topic, classNotes);

    // Records for this topic
    const topicRecords = records.filter(r => r.topicId === topic.id);
    const sortedRecords = [...topicRecords].sort((a, b) => {
      const cmp = b.reviewedAt.localeCompare(a.reviewedAt);
      if (cmp !== 0) return cmp;
      return b.createdAt.localeCompare(a.createdAt);
    });

    const hasBeenReviewed = sortedRecords.length > 0;
    const reviewCount = sortedRecords.length;
    const latestRecord = sortedRecords.length > 0 ? sortedRecords[0] : undefined;
    const lastReviewedAt = latestRecord?.reviewedAt;
    const latestConfidence = latestRecord?.confidence;
    const latestOutcome = latestRecord?.outcome;

    // Days since taught
    const daysSinceTaught = firstTaughtAt
      ? this.calculateDaysDiff(firstTaughtAt, todayStr)
      : undefined;

    // Days since last revision
    const daysSinceLastRevision = lastReviewedAt
      ? this.calculateDaysDiff(lastReviewedAt, todayStr)
      : undefined;

    // Stale check
    const isStale =
      daysSinceLastRevision !== undefined
        ? daysSinceLastRevision > 14
        : daysSinceTaught !== undefined && daysSinceTaught > 14;

    // Upcoming related exam
    const linkedExamIds = new Set(
      examTopics.filter(et => et.topicId === topic.id).map(et => et.examId)
    );

    const relevantExams = exams
      .filter(e => {
        if (!linkedExamIds.has(e.id)) {
          // If no specific topic linking exists, check if exam is for the same subject
          if (linkedExamIds.size === 0 && e.subjectId === topic.subjectId) {
            return true;
          }
          return false;
        }
        return true;
      })
      .filter(e => e.date && daysUntil(e.date, now) >= 0)
      .sort((a, b) => a.date.localeCompare(b.date));

    let upcomingExamInfo: TopicRevisionIntelligence['upcomingExam'] | undefined;
    let upcomingExamDays: number | undefined;

    if (relevantExams.length > 0) {
      const nearest = relevantExams[0];
      const dUntil = daysUntil(nearest.date, now);
      upcomingExamDays = dUntil;
      upcomingExamInfo = {
        examId: nearest.id,
        name: nearest.name,
        date: nearest.date,
        daysUntil: dUntil,
      };
    }

    const revisionState = this.deriveTopicState(topic, topicRecords, classNotes);
    const revisionPriority = this.calculateRevisionPriority({
      isTaught,
      records: topicRecords,
      daysSinceTaught,
      daysSinceLastRevision,
      upcomingExamDays,
    });

    return {
      topicId: topic.id,
      topicName: topic.name,
      subjectId: topic.subjectId,
      isTaught,
      hasBeenReviewed,
      reviewCount,
      lastReviewedAt,
      firstTaughtAt,
      daysSinceTaught,
      daysSinceLastRevision,
      latestConfidence,
      latestOutcome,
      revisionState,
      revisionPriority,
      isStale,
      upcomingExam: upcomingExamInfo,
    };
  }

  /**
   * Retrieves TopicRevisionIntelligence for a specific topic using current store state.
   */
  getTopicIntelligence(topicId: string, customNow?: Date): TopicRevisionIntelligence | null {
    const academicState = useAcademicStore.getState();
    const appState = useAppStore.getState();

    const topic = academicState.topics.find(t => t.id === topicId);
    if (!topic) return null;

    return this.deriveTopicIntelligence(
      topic,
      academicState.revisionRecords || [],
      academicState.classNotes || [],
      appState.exams || [],
      academicState.examTopics || [],
      customNow
    );
  }

  /**
   * Retrieves TopicRevisionIntelligence for all topics in a subject.
   */
  getSubjectRevisionIntelligence(
    subjectId: string,
    customNow?: Date
  ): TopicRevisionIntelligence[] {
    const academicState = useAcademicStore.getState();
    const appState = useAppStore.getState();

    const subjectTopics = academicState.topics.filter(t => t.subjectId === subjectId);
    const records = academicState.revisionRecords || [];
    const notes = academicState.classNotes || [];
    const exams = appState.exams || [];
    const examTopics = academicState.examTopics || [];

    return subjectTopics.map(t =>
      this.deriveTopicIntelligence(t, records, notes, exams, examTopics, customNow)
    );
  }

  /**
   * Retrieves TopicRevisionIntelligence for all topics in a semester.
   */
  getSemesterRevisionIntelligence(
    semesterId?: string,
    customNow?: Date
  ): TopicRevisionIntelligence[] {
    const academicState = useAcademicStore.getState();
    const appState = useAppStore.getState();

    const activeSemId = semesterId || appState.semester?.id;
    const subjects = activeSemId
      ? appState.subjects.filter(s => s.semesterId === activeSemId && !s.isArchived)
      : appState.subjects.filter(s => !s.isArchived);

    const subjectIds = new Set(subjects.map(s => s.id));
    const semesterTopics = academicState.topics.filter(t => subjectIds.has(t.subjectId));

    const records = academicState.revisionRecords || [];
    const notes = academicState.classNotes || [];
    const exams = appState.exams || [];
    const examTopics = academicState.examTopics || [];

    return semesterTopics.map(t =>
      this.deriveTopicIntelligence(t, records, notes, exams, examTopics, customNow)
    );
  }

  /**
   * Returns topics needing revision (revisionState is 'NEEDS_REVIEW' or 'NOT_REVIEWED' while taught).
   */
  getRevisionBacklog(subjectId?: string, customNow?: Date): TopicRevisionIntelligence[] {
    const list = subjectId
      ? this.getSubjectRevisionIntelligence(subjectId, customNow)
      : this.getSemesterRevisionIntelligence(undefined, customNow);

    return list.filter(
      item =>
        item.isTaught &&
        (item.revisionState === 'NEEDS_REVIEW' ||
          item.revisionState === 'NOT_REVIEWED' ||
          item.revisionPriority === 'critical' ||
          item.revisionPriority === 'high')
    );
  }

  /**
   * Returns critical and high priority topics across the semester.
   */
  getCriticalAndHighPriorityTopics(
    limit: number = 5,
    customNow?: Date
  ): TopicRevisionIntelligence[] {
    const all = this.getSemesterRevisionIntelligence(undefined, customNow);
    const priorityWeights: Record<RevisionPriority, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    return all
      .filter(item => item.revisionPriority === 'critical' || item.revisionPriority === 'high')
      .sort((a, b) => priorityWeights[b.revisionPriority] - priorityWeights[a.revisionPriority])
      .slice(0, limit);
  }

  /**
   * Computes revision statistics for a subject using current stores.
   */
  getSubjectRevisionStatistics(subjectId: string, customNow?: Date): RevisionStatistics {
    const intel = this.getSubjectRevisionIntelligence(subjectId, customNow);
    const records = (useAcademicStore.getState().revisionRecords || []).filter(
      r => r.subjectId === subjectId
    );

    let taughtTopics = 0;
    let reviewedTopics = 0;
    let confidentTopics = 0;
    let needsReviewTopics = 0;
    let notReviewedTopics = 0;
    let criticalCount = 0;
    let highPriorityCount = 0;

    for (const item of intel) {
      if (item.isTaught) taughtTopics++;
      if (item.hasBeenReviewed) reviewedTopics++;
      if (item.revisionState === 'CONFIDENT') confidentTopics++;
      if (item.revisionState === 'NEEDS_REVIEW') needsReviewTopics++;
      if (item.revisionState === 'NOT_REVIEWED') notReviewedTopics++;
      if (item.revisionPriority === 'critical') criticalCount++;
      if (item.revisionPriority === 'high') highPriorityCount++;
    }

    const totalDurationMinutes = records.reduce((sum, r) => sum + r.durationMinutes, 0);

    return {
      totalTopics: intel.length,
      taughtTopics,
      reviewedTopics,
      confidentTopics,
      needsReviewTopics,
      notReviewedTopics,
      criticalCount,
      highPriorityCount,
      totalDurationMinutes,
    };
  }

  /**
   * Records a topic review, persists the record, updates the store,
   * and triggers recalculation across the academic layer.
   */
  async recordTopicReview(input: RevisionRecordInput): Promise<RevisionRecord> {
    const record = await revisionRepository.createRecord(input);

    // Update in-memory academic store
    const store = useAcademicStore.getState();
    const existing = store.revisionRecords || [];
    useAcademicStore.setState({
      revisionRecords: [record, ...existing.filter(r => r.id !== record.id)],
      topics: store.topics.map(t =>
        t.id === input.topicId
          ? {
              ...t,
              revisionStatus:
                input.outcome === 'confident' || input.outcome === 'okay'
                  ? 'revised'
                  : 'needs_revision',
              lastRevisedAt: input.reviewedAt,
              revisionCount: (t.revisionCount || 0) + 1,
            }
          : t
      ),
    });

    return record;
  }
}

export const revisionIntelligenceService = new RevisionIntelligenceService();
