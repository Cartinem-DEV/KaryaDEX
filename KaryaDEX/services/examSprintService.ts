/**
 * BunkMatKar — Exam Sprint Service (Phase 7)
 *
 * Deterministic service that computes Exam Readiness and generates sequenced,
 * workload-aware Exam Sprint revision plans.
 * Integrates directly with Syllabus, Topics, Revision History, and Task Engine 2.0.
 *
 * Principles:
 * - Deterministic: Sequence follows CRITICAL -> HIGH -> MEDIUM -> LOW.
 * - Workload-Aware: Avoids unrealistic revision capacity and considers existing tasks.
 * - Zero Duplication: Converts sprint recommendations directly into standard Tasks.
 * - Explainable: Readiness is an academic snapshot based on recorded student data.
 * - No AI / No heuristic drift.
 */

import type { Exam, Task } from '@/types';
import type {
  Topic,
  ExamReadiness,
  ExamSprintPlan,
  ExamSprintDayItem,
  ExamSprintDayTopicItem,
  RevisionPriority,
  TopicRevisionIntelligence,
} from '@/types/academic';
import { useAcademicStore } from '@/store/useAcademicStore';
import { useAppStore } from '@/store/useAppStore';
import { revisionIntelligenceService } from './revisionIntelligenceService';
import { daysUntil, formatLocalDate, parseLocalDate } from '@/lib/timeUtils';

export class ExamSprintService {
  /**
   * Computes the deterministic Exam Readiness snapshot for an exam.
   */
  getExamReadiness(examId: string, customNow?: Date): ExamReadiness | null {
    const appState = useAppStore.getState();
    const academicState = useAcademicStore.getState();
    const now = customNow || new Date();

    const exam = appState.exams.find(e => e.id === examId);
    if (!exam) return null;

    // Get linked topics via exam_topics, fallback to subject topics if none explicitly mapped
    const mappedTopicIds = academicState.examTopics
      .filter(et => et.examId === examId)
      .map(et => et.topicId);

    const relevantTopics =
      mappedTopicIds.length > 0
        ? academicState.topics.filter(t => mappedTopicIds.includes(t.id))
        : academicState.topics.filter(t => t.subjectId === exam.subjectId);

    const records = academicState.revisionRecords || [];
    const notes = academicState.classNotes || [];
    const exams = appState.exams || [];
    const examTopics = academicState.examTopics || [];

    const intels: TopicRevisionIntelligence[] = relevantTopics.map(t =>
      revisionIntelligenceService.deriveTopicIntelligence(t, records, notes, exams, examTopics, now)
    );

    let taughtTopics = 0;
    let reviewedTopics = 0;
    let confidentTopics = 0;
    let needsReviewTopics = 0;
    let notReviewedTopics = 0;
    let criticalTopics = 0;
    let highPriorityTopics = 0;
    let totalWorkloadMinutes = 0;
    let readinessScoreAcc = 0;

    for (const intel of intels) {
      if (intel.isTaught) {
        taughtTopics++;

        if (intel.hasBeenReviewed) {
          reviewedTopics++;
        }

        if (intel.revisionState === 'CONFIDENT') {
          confidentTopics++;
          readinessScoreAcc += 100;
        } else if (intel.revisionState === 'REVIEWED') {
          readinessScoreAcc += 60;
          totalWorkloadMinutes += 25;
        } else if (intel.revisionState === 'NEEDS_REVIEW') {
          needsReviewTopics++;
          readinessScoreAcc += 25;
          totalWorkloadMinutes += intel.latestConfidence === 'low' ? 45 : 35;
        } else if (intel.revisionState === 'NOT_REVIEWED') {
          notReviewedTopics++;
          totalWorkloadMinutes += 30;
        }

        if (intel.revisionPriority === 'critical') criticalTopics++;
        else if (intel.revisionPriority === 'high') highPriorityTopics++;
      }
    }

    const daysRemaining = daysUntil(exam.date, now);
    const readinessPercentage =
      taughtTopics > 0 ? Math.min(100, Math.round(readinessScoreAcc / taughtTopics)) : 0;

    return {
      examId: exam.id,
      examName: exam.name,
      subjectId: exam.subjectId,
      examDate: exam.date,
      daysRemaining,
      totalSyllabusTopics: relevantTopics.length,
      taughtTopics,
      reviewedTopics,
      confidentTopics,
      needsReviewTopics,
      notReviewedTopics,
      criticalTopics,
      highPriorityTopics,
      estimatedRevisionWorkloadMinutes: totalWorkloadMinutes,
      readinessPercentage,
    };
  }

  /**
   * Generates a sequenced, day-by-day revision sprint plan for an exam.
   */
  generateExamSprintPlan(
    examId: string,
    customNow?: Date,
    maxDailyRevisionMinutes: number = 75
  ): ExamSprintPlan | null {
    const readiness = this.getExamReadiness(examId, customNow);
    if (!readiness) return null;

    const appState = useAppStore.getState();
    const academicState = useAcademicStore.getState();
    const now = customNow || new Date();

    const exam = appState.exams.find(e => e.id === examId);
    if (!exam) return null;

    // Get linked topics
    const mappedTopicIds = academicState.examTopics
      .filter(et => et.examId === examId)
      .map(et => et.topicId);

    const relevantTopics =
      mappedTopicIds.length > 0
        ? academicState.topics.filter(t => mappedTopicIds.includes(t.id))
        : academicState.topics.filter(t => t.subjectId === exam.subjectId);

    const records = academicState.revisionRecords || [];
    const notes = academicState.classNotes || [];
    const exams = appState.exams || [];
    const examTopics = academicState.examTopics || [];

    const intels: TopicRevisionIntelligence[] = relevantTopics.map(t =>
      revisionIntelligenceService.deriveTopicIntelligence(t, records, notes, exams, examTopics, now)
    );

    // Filter topics that actually need revision (exclude confident topics unless exam is tomorrow)
    const needsSprint = intels.filter(intel => {
      if (!intel.isTaught) return false;
      if (intel.revisionState === 'CONFIDENT') {
        // Only include confident topics if exam is within 1 day as a final quick brush-up
        return readiness.daysRemaining <= 1;
      }
      return true;
    });

    // Priority ordering: critical (4) -> high (3) -> medium (2) -> low (1)
    const priorityWeight: Record<RevisionPriority, number> = {
      critical: 4,
      high: 3,
      medium: 2,
      low: 1,
    };

    needsSprint.sort((a, b) => {
      const pDiff = priorityWeight[b.revisionPriority] - priorityWeight[a.revisionPriority];
      if (pDiff !== 0) return pDiff;
      // Secondary sort: needs_review before unreviewed
      if (a.revisionState === 'NEEDS_REVIEW' && b.revisionState !== 'NEEDS_REVIEW') return -1;
      if (b.revisionState === 'NEEDS_REVIEW' && a.revisionState !== 'NEEDS_REVIEW') return 1;
      return a.topicName.localeCompare(b.topicName);
    });

    // Determine available sprint days
    // If daysRemaining <= 0, plan for today only
    // If daysRemaining > 0, sprint spans up to Math.min(daysRemaining, 14) days
    const daysAvailable = readiness.daysRemaining <= 0 ? 1 : Math.min(readiness.daysRemaining, 14);

    // Distribute topics into day items
    const dayItems: ExamSprintDayItem[] = [];
    const today = new Date(now);

    // Create day item shells
    for (let d = 0; d < daysAvailable; d++) {
      const dayDate = new Date(today);
      dayDate.setDate(today.getDate() + d);
      dayItems.push({
        dayIndex: d + 1,
        date: formatLocalDate(dayDate),
        topics: [],
        totalEstimatedMinutes: 0,
      });
    }

    // Allocate topics across days respecting workload cap
    let currentDayIdx = 0;
    let totalSprintMinutes = 0;

    for (const intel of needsSprint) {
      let estMinutes = 30;
      if (intel.revisionPriority === 'critical') estMinutes = 45;
      else if (intel.revisionPriority === 'high') estMinutes = 35;
      else if (intel.revisionState === 'CONFIDENT') estMinutes = 15;

      // Find the next day that has room, or push to the least loaded day
      let placed = false;
      for (let i = currentDayIdx; i < daysAvailable; i++) {
        if (dayItems[i].totalEstimatedMinutes + estMinutes <= maxDailyRevisionMinutes) {
          dayItems[i].topics.push({
            topicId: intel.topicId,
            topicName: intel.topicName,
            priority: intel.revisionPriority,
            estimatedMinutes: estMinutes,
            outcome: intel.latestOutcome,
            confidence: intel.latestConfidence,
          });
          dayItems[i].totalEstimatedMinutes += estMinutes;
          totalSprintMinutes += estMinutes;
          placed = true;
          // Slowly advance index so revision is distributed across days
          if (dayItems[i].totalEstimatedMinutes >= maxDailyRevisionMinutes * 0.7) {
            currentDayIdx = Math.min(daysAvailable - 1, i + 1);
          }
          break;
        }
      }

      if (!placed) {
        // If all days are near cap, place on the day with the lowest current workload
        let minDay = dayItems[0];
        for (const item of dayItems) {
          if (item.totalEstimatedMinutes < minDay.totalEstimatedMinutes) {
            minDay = item;
          }
        }
        minDay.topics.push({
          topicId: intel.topicId,
          topicName: intel.topicName,
          priority: intel.revisionPriority,
          estimatedMinutes: estMinutes,
          outcome: intel.latestOutcome,
          confidence: intel.latestConfidence,
        });
        minDay.totalEstimatedMinutes += estMinutes;
        totalSprintMinutes += estMinutes;
      }
    }

    // Filter out trailing empty days if there are few topics and many days
    const activeDays = dayItems.filter(d => d.topics.length > 0);

    // Generate workload warning if applicable
    let workloadWarning: string | undefined;
    const avgDaily = activeDays.length > 0 ? totalSprintMinutes / activeDays.length : 0;
    if (avgDaily > maxDailyRevisionMinutes * 1.2) {
      workloadWarning = `Heavy revision workload: ~${Math.round(avgDaily)} min/day across ${activeDays.length} days. Prioritize Critical topics first.`;
    } else if (readiness.daysRemaining <= 2 && needsSprint.length > 4) {
      workloadWarning = `Exam is in ${readiness.daysRemaining} days with ${needsSprint.length} topics pending. Focus strictly on Critical and High priority.`;
    }

    return {
      examId: exam.id,
      examName: exam.name,
      subjectId: exam.subjectId,
      daysRemaining: readiness.daysRemaining,
      readiness,
      days: activeDays,
      totalSprintTopics: needsSprint.length,
      totalEstimatedMinutes: totalSprintMinutes,
      workloadWarning,
    };
  }

  /**
   * Converts a recommended revision topic into a standard Task in Task Engine 2.0.
   * Preserves full relational links: Subject, Topic, Exam, Semester.
   */
  async convertSprintTopicToTask(params: {
    topicId: string;
    examId?: string;
    scheduledDate?: string;
    estimatedMinutes?: number;
  }): Promise<Task> {
    const { topicId, examId, scheduledDate, estimatedMinutes = 30 } = params;
    const academicState = useAcademicStore.getState();
    const appState = useAppStore.getState();

    const topic = academicState.topics.find(t => t.id === topicId);
    const exam = examId ? appState.exams.find(e => e.id === examId) : undefined;
    const subjectId = topic?.subjectId || exam?.subjectId;

    const topicName = topic?.name || 'Topic';
    const examSuffix = exam ? ` (${exam.name})` : '';
    const taskTitle = `Revise: ${topicName}${examSuffix}`;
    const targetDate = scheduledDate || formatLocalDate();
    const id = `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`;

    const fullTask: Task = {
      id,
      title: taskTitle,
      description: `Revision Sprint task for "${topicName}". Linked to exam and subject syllabus.`,
      subjectId,
      topicId,
      examId,
      dueDate: targetDate,
      dueTime: '20:00',
      category: 'study',
      priority: exam ? 'high' : 'medium',
      status: 'planned',
      estimatedMinutes,
      isCompleted: false,
      scheduledDate: targetDate,
      createdAt: new Date().toISOString(),
    };

    appState.addTask(fullTask);
    return fullTask;
  }
}

export const examSprintService = new ExamSprintService();
