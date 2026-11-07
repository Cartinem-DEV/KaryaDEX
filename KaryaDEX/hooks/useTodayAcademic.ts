/**
 * BunkMatKar — Today Academic Data Hook
 *
 * Exposes data hooks connecting the Today screen to the Academic Extension Store:
 * - current class / next class occurrences
 * - today's class notes
 * - incomplete class notes (classes today where notes were not yet written)
 * - today's tasks & linked class context
 * - upcoming exams with syllabus topics & revision progress
 * - revision state (topics needing revision or taught but not revised)
 */

import { useMemo } from 'react';
import { useAcademicStore } from '@/store/useAcademicStore';
import { useAppStore } from '@/store/useAppStore';
import { formatLocalDate } from '@/lib/timeUtils';
import { academicHubService } from '@/services/academicHubService';
import type {
  ClassOccurrence,
  ClassNote,
  Topic,
  ExamWithTopics,
  TodayAcademicSnapshot,
  WorkloadReport,
} from '@/types/academic';

export interface TodayAcademicData {
  todayStr: string;
  todayOccurrences: ClassOccurrence[];
  todayClassNotes: ClassNote[];
  incompleteNotes: ClassOccurrence[];
  topicsNeedingRevision: Topic[];
  topicsTaughtNotRevised: Topic[];
  upcomingExamsWithTopics: ExamWithTopics[];
  revisionProgressSummary: {
    totalTopics: number;
    completedTopics: number;
    revisedTopics: number;
    needsRevisionTopics: number;
  };
  snapshot: TodayAcademicSnapshot;
  workload: WorkloadReport;
}

export function useTodayAcademic(): TodayAcademicData {
  const academic = useAcademicStore();
  const { exams, tasks, subjects, attendanceData } = useAppStore();

  const todayStr = useMemo(() => {
    return formatLocalDate();
  }, []);

  const todayOccurrences = useMemo(() => {
    return academic.getClassOccurrencesForDate(todayStr);
  }, [academic, todayStr]);

  const todayClassNotes = useMemo(() => {
    return academic.getClassNotesForDate(todayStr);
  }, [academic, todayStr]);

  const incompleteNotes = useMemo(() => {
    return todayOccurrences.filter(occ => !occ.note || (!occ.note.myNotes && occ.note.topicIds.length === 0));
  }, [todayOccurrences]);

  const topicsNeedingRevision = useMemo(() => {
    return academic.getTopicsNeedingRevision();
  }, [academic]);

  const topicsTaughtNotRevised = useMemo(() => {
    return academic.getTopicsTaughtNotRevised();
  }, [academic]);

  const upcomingExamsWithTopics = useMemo(() => {
    return academic.examExtensions;
  }, [academic.examExtensions]);

  const revisionProgressSummary = useMemo(() => {
    const allTopics = academic.topics;
    return {
      totalTopics: allTopics.length,
      completedTopics: allTopics.filter(t => t.isCompleted).length,
      revisedTopics: allTopics.filter(t => t.revisionStatus === 'revised').length,
      needsRevisionTopics: allTopics.filter(t => t.revisionStatus === 'needs_revision').length,
    };
  }, [academic.topics]);

  const snapshot = useMemo(() => {
    return academicHubService.getTodayAcademicSnapshot();
  }, [academic, tasks, exams, subjects, attendanceData]);

  const workload = useMemo(() => {
    return academicHubService.getTodayWorkload();
  }, [tasks]);

  return {
    todayStr,
    todayOccurrences,
    todayClassNotes,
    incompleteNotes,
    topicsNeedingRevision,
    topicsTaughtNotRevised,
    upcomingExamsWithTopics,
    revisionProgressSummary,
    snapshot,
    workload,
  };
}
