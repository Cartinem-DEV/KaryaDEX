/**
 * KaryaDEX — Revision Intelligence Service
 *
 * Computes topic-level revision status, revision progress, and backlog metrics.
 *
 * Definitions:
 * - "Backlog": Topics that have been taught (status is 'taught' or 'needs_revision')
 *   but are NOT yet revised. This is distinct from "Syllabus remaining" (untaught).
 * - "Syllabus remaining": Topics with status 'not_taught' or 'not_started'.
 * - "Revised": Topics with status 'revised'.
 *
 * Increments revision counts and stores timestamps accurately on revision updates.
 */

import type { Topic, RevisionStatus, ClassNote } from '@/types/academic';
import { useAcademicStore } from '@/store/useAcademicStore';
import { syllabusRepository } from '@/database/repositories/syllabusRepository';

export interface ClassSessionRevisionIntelligence {
  totalCoveredCount: number;
  revisedCount: number;
  pendingCount: number;
  progressPercentage: number;
  lastRevisedDateLabel: string;
  subjectBacklogCount: number;
  backlogTopicNames: string[];
}

class RevisionService {
  /**
   * Calculates revision intelligence metrics for a specific class session occurrence.
   */
  calculateSessionRevision(
    subjectId: string,
    coveredTopicIds: string[],
    allSubjectTopics: Topic[],
    allClassNotes: ClassNote[]
  ): ClassSessionRevisionIntelligence {
    const coveredSet = new Set(coveredTopicIds);
    const coveredTopics = allSubjectTopics.filter(t => coveredSet.has(t.id));

    const totalCoveredCount = coveredTopics.length;
    const revisedTopics = coveredTopics.filter(t => t.revisionStatus === 'revised');
    const revisedCount = revisedTopics.length;
    const pendingCount = Math.max(0, totalCoveredCount - revisedCount);

    const progressPercentage =
      totalCoveredCount > 0 ? Math.round((revisedCount / totalCoveredCount) * 100) : 0;

    // Determine the latest revision date among covered topics or class notes
    let latestRevisionDate: string | null = null;
    for (const t of coveredTopics) {
      if (t.lastRevisedAt) {
        if (!latestRevisionDate || t.lastRevisedAt > latestRevisionDate) {
          latestRevisionDate = t.lastRevisedAt;
        }
      }
    }

    // Format label
    let lastRevisedDateLabel = 'Not revised yet';
    if (latestRevisionDate) {
      try {
        const d = new Date(latestRevisionDate);
        lastRevisedDateLabel = `Last revised ${d.toLocaleDateString('en-US', { day: 'numeric', month: 'short' })}`;
      } catch {
        lastRevisedDateLabel = `Last revised ${latestRevisionDate.split('T')[0]}`;
      }
    }

    // Subject Backlog = all topics taught in this subject that still need revision
    const subjectBacklogTopics = allSubjectTopics.filter(
      t => t.revisionStatus === 'taught' || t.revisionStatus === 'needs_revision'
    );

    return {
      totalCoveredCount,
      revisedCount,
      pendingCount,
      progressPercentage,
      lastRevisedDateLabel,
      subjectBacklogCount: subjectBacklogTopics.length,
      backlogTopicNames: subjectBacklogTopics.map(t => t.name),
    };
  }

  /**
   * Updates revision status of a topic, managing revision count and timestamps.
   */
  recordTopicRevision(
    topicId: string,
    newStatus: RevisionStatus,
    classSessionId?: string
  ): void {
    const store = useAcademicStore.getState();
    const topic = store.topics.find(t => t.id === topicId);
    if (!topic) return;

    const currentCount = topic.revisionCount || 0;
    // Only increment revision count if transitioning to 'revised' from a non-revised state
    const isTransitionToRevised = newStatus === 'revised' && topic.revisionStatus !== 'revised';
    const updatedCount = isTransitionToRevised ? currentCount + 1 : currentCount;
    const nowIso = new Date().toISOString();

    const isCompleted = newStatus === 'not_started' || newStatus === 'not_taught' ? topic.isCompleted : true;
    const lastRevisedAt = newStatus === 'revised' ? nowIso : topic.lastRevisedAt;
    const lastTaughtAt = classSessionId ? nowIso : topic.lastTaughtAt;

    useAcademicStore.setState(state => ({
      topics: state.topics.map(t =>
        t.id === topicId
          ? {
              ...t,
              revisionStatus: newStatus,
              revisionCount: updatedCount,
              lastRevisedAt,
              lastTaughtAt,
              isCompleted,
            }
          : t
      ),
    }));

    // Persist to SQLite
    syllabusRepository.updateTopic(topicId, {
      revisionStatus: newStatus,
      revisionCount: updatedCount,
      lastRevisedAt,
      isCompleted,
    }).catch(err => {
      console.warn('[RevisionService] Failed to persist topic revision to SQLite:', err);
    });
  }

  /**
   * Bulk marks all covered topics of a session as revised or needs revision.
   */
  markSessionTopicsRevision(topicIds: string[], status: RevisionStatus): void {
    for (const tid of topicIds) {
      this.recordTopicRevision(tid, status);
    }
  }
}

export const revisionService = new RevisionService();
