/**
 * KaryaDEX — Class Session Service
 *
 * Canonical orchestrator for saving and querying individual Class Session occurrences.
 * Maintains the single source of truth:
 *
 * Subject
 *    ↓
 * Class Session Occurrence (slotId + date)
 *    ├── Attendance
 *    ├── Topics Covered
 *    ├── Revision History
 *    ├── My Journal
 *    ├── Teacher Notes
 *    ├── Resources (Files, Scanned Notes, URLs, Saved YouTube)
 *    ├── YouTube Recommendations
 *    └── Related Tasks
 *
 * Prepares AI context without fake AI generation.
 */

import { useAcademicStore } from '@/store/useAcademicStore';
import { useAppStore } from '@/store/useAppStore';
import type {
  ClassNote,
  ClassAttendanceStatus,
  RevisionStatus,
  Resource,
  ClassJournalAIContext,
} from '@/types/academic';
import { fileStorageService } from '@/services/fileStorageService';
import { revisionService } from './revisionService';

export interface SaveClassSessionPayload {
  slotId: string;
  date: string; // "YYYY-MM-DD"
  subjectId: string;
  attendanceStatus: ClassAttendanceStatus;
  selectedTopicIds: string[];
  myNotes: string;
  teacherNotes: string;
  revisionStatus: RevisionStatus;
  resources: Resource[];
  linkedTaskIds: string[];
}

class ClassSessionService {
  /**
   * Generates a deterministic hash of the current journal contents for AI change detection.
   */
  private generateSourceHash(notes: string, teacherNotes: string, topicIds: string[]): string {
    const raw = `${notes}:::${teacherNotes}:::${topicIds.sort().join(',')}`;
    let hash = 0;
    for (let i = 0; i < raw.length; i++) {
      const char = raw.charCodeAt(i);
      hash = (hash << 5) - hash + char;
      hash |= 0;
    }
    return `hash-${Math.abs(hash).toString(16)}`;
  }

  /**
   * Builds the AI-ready context structure for future background intelligence.
   */
  buildAIContext(payload: SaveClassSessionPayload): ClassJournalAIContext {
    const academic = useAcademicStore.getState();
    const allTopics = academic.getTopicsForSubject(payload.subjectId);
    const coveredTopics = allTopics.filter(t => payload.selectedTopicIds.includes(t.id));
    const revisedCount = coveredTopics.filter(t => t.revisionStatus === 'revised').length;

    return {
      classSessionId: payload.slotId,
      subjectId: payload.subjectId,
      date: payload.date,
      selectedTopicIds: payload.selectedTopicIds,
      myNotes: payload.myNotes,
      teacherNotes: payload.teacherNotes,
      resources: payload.resources.map(r => ({
        title: r.title,
        type: r.type,
        url: r.url || r.uri,
      })),
      revisionState: {
        coveredCount: payload.selectedTopicIds.length,
        revisedCount,
        pendingCount: Math.max(0, payload.selectedTopicIds.length - revisedCount),
      },
    };
  }

  /**
   * Persists all changed session state atomically.
   */
  async saveClassSession(payload: SaveClassSessionPayload): Promise<ClassNote> {
    const academic = useAcademicStore.getState();
    const appStore = useAppStore.getState();

    // 1. Capture existing note BEFORE upserting to determine prior attendance status
    const existingNote = academic.getClassNote(payload.slotId, payload.date);
    const prevAttendanceStatus = existingNote?.attendanceStatus;

    // 2. Sync topic revision & taught timestamps
    for (const topicId of payload.selectedTopicIds) {
      const existingTopic = academic.topics.find(t => t.id === topicId);
      if (existingTopic) {
        // If topic was not taught before, set to 'taught' or keep its revision status
        const nextStatus =
          existingTopic.revisionStatus === 'not_started' || existingTopic.revisionStatus === 'not_taught'
            ? 'taught'
            : existingTopic.revisionStatus;

        revisionService.recordTopicRevision(topicId, nextStatus, payload.slotId);
      }
    }

    // 3. Prepare AI fields
    const sourceHash = this.generateSourceHash(
      payload.myNotes,
      payload.teacherNotes,
      payload.selectedTopicIds
    );

    // 4. Upsert ClassNote in Academic Store
    const savedNote = academic.upsertClassNote({
      classSessionId: payload.slotId,
      date: payload.date,
      subjectId: payload.subjectId,
      attendanceStatus: payload.attendanceStatus,
      topicIds: payload.selectedTopicIds,
      myNotes: payload.myNotes,
      teacherNotes: payload.teacherNotes,
      revisionStatus: payload.revisionStatus,
      resourceIds: payload.resources.map(r => r.id),
      linkedTaskIds: payload.linkedTaskIds,
      aiSummaryStatus: payload.myNotes.trim() || payload.teacherNotes.trim() ? 'pending' : 'unavailable',
      aiSourceHash: sourceHash,
    });

    // 5. Reconcile resources in Academic Store (delete detached, add new)
    const payloadResourceIds = new Set(payload.resources.map(r => r.id));
    const previousResources = academic.resources.filter(
      r => (existingNote && r.classNoteId === existingNote.id) ||
           (savedNote && r.classNoteId === savedNote.id) ||
           (r.classSessionId && r.classSessionId === payload.slotId)
    );

    for (const prevRes of previousResources) {
      if (!payloadResourceIds.has(prevRes.id)) {
        academic.deleteResource(prevRes.id);
        if (prevRes.uri) {
          const otherUses = academic.resources.some(
            other => other.id !== prevRes.id && other.uri === prevRes.uri
          );
          if (!otherUses) {
            fileStorageService.deleteUserFile(prevRes.uri).catch(() => {});
          }
        }
      }
    }

    for (const res of payload.resources) {
      const existingRes = academic.resources.find(r => r.id === res.id);
      if (!existingRes) {
        academic.addResource({
          ...res,
          classNoteId: savedNote.id,
          classSessionId: payload.slotId,
          subjectId: payload.subjectId,
        });
      }
    }

    // 6. Update attendance engine counters atomically based on status transition
    // Prevents double-counting and accurately tracks present, absent, late, and cancelled
    useAppStore.getState().recordAttendanceTransition(
      payload.subjectId,
      prevAttendanceStatus,
      payload.attendanceStatus
    );

    return savedNote;
  }
}

export const classSessionService = new ClassSessionService();
