/**
 * KaryaDEX — AI Proposal Preview & Confirmation Card (Phase 12)
 *
 * Enforces Golden Rule 2: Zero Direct Database Writes.
 * Renders structured proposal drafts (Timetable, Subtasks, Profile) for user review.
 * Only triggers application service mutation upon explicit user approval.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, TouchableOpacity, ActivityIndicator } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import type { AIProposal } from '@/services/ai';
import { AIBadge } from './AIBadge';

interface AIProposalCardProps {
  proposal: AIProposal;
  onApprove: (proposal: AIProposal) => Promise<void>;
  onDismiss: (proposal: AIProposal) => void;
}

export const AIProposalCard: React.FC<AIProposalCardProps> = ({
  proposal,
  onApprove,
  onDismiss,
}) => {
  const [isApplying, setIsApplying] = useState(false);
  const [applied, setApplied] = useState(proposal.status === 'applied');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const handleApprove = async () => {
    try {
      setIsApplying(true);
      setErrorMsg(null);
      await onApprove(proposal);
      setApplied(true);
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to apply proposal.');
    } finally {
      setIsApplying(false);
    }
  };

  const renderPayloadPreview = () => {
    switch (proposal.type) {
      case 'IMPORT_TIMETABLE': {
        const slots = Array.isArray(proposal.payload) ? proposal.payload : [];
        return (
          <View style={styles.previewList}>
            {slots.map((slot: any, idx: number) => {
              const hasConflict = Boolean(slot.conflictWarning);
              return (
                <View key={idx} style={[styles.slotItem, hasConflict && styles.conflictSlotItem]}>
                  <View style={styles.slotHeader}>
                    <Text style={styles.slotTitle}>{slot.subjectName}</Text>
                    <Text style={styles.slotTime}>{slot.startTime}–{slot.endTime}</Text>
                  </View>
                  <View style={styles.slotMeta}>
                    <Text style={styles.slotDay}>{slot.dayOfWeek.toUpperCase()}</Text>
                    {slot.room ? <Text style={styles.slotRoom}>Room: {slot.room}</Text> : null}
                  </View>
                  {hasConflict ? (
                    <View style={styles.warningBox}>
                      <Ionicons name="warning-outline" size={14} color="#EF4444" />
                      <Text style={styles.warningText}>{slot.conflictWarning}</Text>
                    </View>
                  ) : null}
                </View>
              );
            })}
          </View>
        );
      }

      case 'CREATE_SUBTASKS': {
        const payload = proposal.payload || {};
        const subtasks = payload.subtasks || [];
        return (
          <View style={styles.previewList}>
            <Text style={styles.parentTaskTitle}>Goal: {payload.parentTitle}</Text>
            {subtasks.map((st: any, idx: number) => (
              <View key={idx} style={stItemStyles.container}>
                <View style={stItemStyles.indexBadge}>
                  <Text style={stItemStyles.indexText}>{idx + 1}</Text>
                </View>
                <View style={stItemStyles.content}>
                  <Text style={stItemStyles.title}>{st.title}</Text>
                  <Text style={stItemStyles.time}>{st.estimatedMinutes} mins</Text>
                </View>
              </View>
            ))}
          </View>
        );
      }

      case 'UPDATE_PROFILE': {
        const payload = proposal.payload || {};
        return (
          <View style={styles.previewList}>
            {payload.studentName ? (
              <Text style={styles.profileField}>Name: <Text style={styles.bold}>{payload.studentName}</Text></Text>
            ) : null}
            {payload.collegeName ? (
              <Text style={styles.profileField}>College: <Text style={styles.bold}>{payload.collegeName}</Text></Text>
            ) : null}
            {payload.program ? (
              <Text style={styles.profileField}>Program: <Text style={styles.bold}>{payload.program}</Text></Text>
            ) : null}
            {payload.attendanceTarget ? (
              <Text style={styles.profileField}>Target: <Text style={styles.bold}>{payload.attendanceTarget}%</Text></Text>
            ) : null}
            {payload.subjects && payload.subjects.length > 0 ? (
              <View style={styles.subjsBox}>
                <Text style={styles.subjsHeader}>Detected Subjects ({payload.subjects.length}):</Text>
                {payload.subjects.map((s: any, i: number) => (
                  <Text key={i} style={styles.subjItem}>• {s.name} {s.code ? `(${s.code})` : ''}</Text>
                ))}
              </View>
            ) : null}
          </View>
        );
      }

      case 'IMPORT_SYLLABUS': {
        const payload = proposal.payload || {};
        const units = Array.isArray(payload.units) ? payload.units : [];
        return (
          <View style={styles.previewList}>
            <Text style={styles.slotTitle}>{payload.subjectName} {payload.subjectCode ? `(${payload.subjectCode})` : ''}</Text>
            {units.map((unit: any, uIdx: number) => (
              <View key={uIdx} style={[styles.slotItem, { marginVertical: 4 }]}>
                <Text style={[styles.bold, { color: '#F59E0B' }]}>{unit.name}</Text>
                <View style={{ marginTop: 4 }}>
                  {unit.topics?.map((top: any, tIdx: number) => (
                    <Text key={tIdx} style={{ fontSize: 12, color: '#94A3B8', marginVertical: 1 }}>
                      • {top.name}
                    </Text>
                  ))}
                </View>
              </View>
            ))}
          </View>
        );
      }

      case 'IMPORT_CALENDAR': {
        const payload = proposal.payload || {};
        const holidays = Array.isArray(payload.holidays) ? payload.holidays : [];
        const exams = Array.isArray(payload.exams) ? payload.exams : [];
        return (
          <View style={styles.previewList}>
            {payload.startDate || payload.endDate ? (
              <View style={[styles.slotMeta, { marginBottom: 6 }]}>
                <Text style={{ color: '#38BDF8', fontSize: 12, fontWeight: '600' }}>
                  Semester: {payload.startDate || 'TBD'} to {payload.endDate || 'TBD'}
                </Text>
              </View>
            ) : null}

            {holidays.length > 0 ? (
              <View style={{ marginBottom: 6 }}>
                <Text style={[styles.bold, { color: '#10B981', fontSize: 12, marginBottom: 2 }]}>
                  Holidays ({holidays.length}):
                </Text>
                {holidays.map((h: any, i: number) => (
                  <Text key={i} style={{ fontSize: 12, color: '#CBD5E1' }}>
                    • {h.date}: {h.name} {h.confidence && h.confidence < 0.8 ? '(Uncertain)' : ''}
                  </Text>
                ))}
              </View>
            ) : null}

            {exams.length > 0 ? (
              <View>
                <Text style={[styles.bold, { color: '#A78BFA', fontSize: 12, marginBottom: 2 }]}>
                  Exams ({exams.length}):
                </Text>
                {exams.map((e: any, i: number) => (
                  <Text key={i} style={{ fontSize: 12, color: '#CBD5E1' }}>
                    • {e.startDate}{e.endDate ? `–${e.endDate}` : ''}: {e.title}
                  </Text>
                ))}
              </View>
            ) : null}
          </View>
        );
      }

      case 'DELETE_TASK': {
        const payload = proposal.payload || {};
        return (
          <View style={[styles.previewList, { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.25)' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="trash-outline" size={16} color="#EF4444" />
              <Text style={[styles.slotTitle, { color: '#FCA5A5' }]}>
                {payload.taskTitle || 'Target Task'}
              </Text>
            </View>
            <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 4 }}>
              Action: Permanent removal from your active tasks and schedule.
            </Text>
          </View>
        );
      }

      case 'UPDATE_TASK': {
        const payload = proposal.payload || {};
        const updates = payload.updates || {};
        return (
          <View style={styles.previewList}>
            <Text style={[styles.slotTitle, { color: '#38BDF8' }]}>{proposal.title}</Text>
            {Object.entries(updates).map(([k, v], idx) => (
              <Text key={idx} style={{ color: '#E2E8F0', fontSize: 12, marginTop: 2 }}>
                • <Text style={{ color: '#94A3B8' }}>{k}:</Text> {String(v)}
              </Text>
            ))}
          </View>
        );
      }

      case 'CREATE_TASK': {
        const payload = proposal.payload || {};
        return (
          <View style={styles.previewList}>
            <Text style={[styles.slotTitle, { color: '#10B981' }]}>
              {payload.title || 'New Task'}
            </Text>
            <View style={styles.slotMeta}>
              <Text style={styles.slotDay}>Priority: {String(payload.priority || 'medium').toUpperCase()}</Text>
              {payload.dueDate ? <Text style={styles.slotRoom}>Due: {payload.dueDate}</Text> : null}
            </View>
          </View>
        );
      }

      case 'DELETE_TIMETABLE_SLOT': {
        const payload = proposal.payload || {};
        return (
          <View style={[styles.previewList, { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.25)' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="remove-circle-outline" size={16} color="#EF4444" />
              <Text style={[styles.slotTitle, { color: '#FCA5A5' }]}>
                {payload.subjectName || 'Class Session'}
              </Text>
            </View>
            <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 4 }}>
              Action: Removed from your weekly timetable.
            </Text>
          </View>
        );
      }

      case 'CLEAR_TIMETABLE': {
        return (
          <View style={[styles.previewList, { backgroundColor: 'rgba(239, 68, 68, 0.08)', borderColor: 'rgba(239, 68, 68, 0.25)' }]}>
            <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
              <Ionicons name="alert-circle-outline" size={16} color="#EF4444" />
              <Text style={[styles.slotTitle, { color: '#FCA5A5' }]}>
                Clear Weekly Schedule
              </Text>
            </View>
            <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 4 }}>
              Action: All recurring classes in the schedule will be deactivated.
            </Text>
          </View>
        );
      }

      case 'MARK_ATTENDANCE': {
        const payload = proposal.payload || {};
        return (
          <View style={styles.previewList}>
            <Text style={[styles.slotTitle, { color: '#38BDF8' }]}>
              {payload.subjectName || 'Subject Attendance'}
            </Text>
            <Text style={{ color: '#E2E8F0', fontSize: 12, marginTop: 4 }}>
              Status Logged: <Text style={[styles.bold, { color: payload.status === 'present' ? '#10B981' : '#EF4444' }]}>{String(payload.status).toUpperCase()}</Text>
            </Text>
          </View>
        );
      }

      case 'CREATE_EXAM': {
        const payload = proposal.payload || {};
        return (
          <View style={styles.previewList}>
            <Text style={[styles.slotTitle, { color: '#F59E0B' }]}>
              {payload.name || payload.subjectName || 'Exam Entry'}
            </Text>
            <Text style={{ color: '#E2E8F0', fontSize: 12, marginTop: 4 }}>
              Date: <Text style={styles.bold}>{payload.date || 'Scheduled'}</Text>
              {payload.startTime ? ` • Time: ${payload.startTime}` : ''}
              {payload.room ? ` • Room: ${payload.room}` : ''}
            </Text>
          </View>
        );
      }

      case 'DELETE_EXAM': {
        const payload = proposal.payload || {};
        return (
          <View style={styles.previewList}>
            <Text style={[styles.slotTitle, { color: '#EF4444' }]}>
              Removed Exam: {payload.examName || payload.subjectName || payload.examId}
            </Text>
            <Text style={{ color: '#94A3B8', fontSize: 12, marginTop: 4 }}>
              Examination date removed from calendar.
            </Text>
          </View>
        );
      }

      default:
        return (
          <Text style={styles.fallbackText}>{JSON.stringify(proposal.payload, null, 2)}</Text>
        );
    }
  };

  return (
    <View style={styles.card}>
      <View style={styles.header}>
        <AIBadge label="PROPOSAL DRAFT" size="small" />
        <View style={styles.statusChip}>
          <Text style={styles.statusText}>
            {applied ? 'SAVED TO DATABASE' : 'AWAITING APPROVAL'}
          </Text>
        </View>
      </View>

      <Text style={styles.title}>{proposal.title}</Text>
      <Text style={styles.description}>{proposal.description}</Text>

      {renderPayloadPreview()}

      {errorMsg ? (
        <View style={styles.errorBanner}>
          <Ionicons name="alert-circle" size={16} color="#EF4444" />
          <Text style={styles.errorText}>{errorMsg}</Text>
        </View>
      ) : null}

      {!applied ? (
        <View style={styles.actionsRow}>
          <TouchableOpacity
            style={styles.dismissBtn}
            onPress={() => onDismiss(proposal)}
            disabled={isApplying}
          >
            <Ionicons name="close" size={16} color="#94A3B8" />
            <Text style={styles.dismissText}>Dismiss</Text>
          </TouchableOpacity>

          <TouchableOpacity
            style={styles.approveBtn}
            onPress={handleApprove}
            disabled={isApplying}
          >
            {isApplying ? (
              <ActivityIndicator size="small" color="#FFFFFF" />
            ) : (
              <>
                <Ionicons name="checkmark-sharp" size={16} color="#FFFFFF" />
                <Text style={styles.approveText}>Approve & Save</Text>
              </>
            )}
          </TouchableOpacity>
        </View>
      ) : (
        <View style={styles.appliedBanner}>
          <Ionicons name="checkmark-circle" size={18} color="#10B981" />
          <Text style={styles.appliedText}>Applied to your academic records</Text>
        </View>
      )}
    </View>
  );
};

const stItemStyles = StyleSheet.create({
  container: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderRadius: 8,
    padding: 8,
    marginBottom: 6,
  },
  indexBadge: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    marginRight: 10,
  },
  indexText: {
    color: '#10B981',
    fontWeight: '700',
    fontSize: 12,
  },
  content: {
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  title: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '500',
    flex: 1,
  },
  time: {
    color: '#94A3B8',
    fontSize: 12,
    marginLeft: 8,
  },
});

const styles = StyleSheet.create({
  card: {
    backgroundColor: '#1E293B',
    borderRadius: 14,
    padding: 16,
    marginVertical: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 8,
  },
  statusChip: {
    backgroundColor: 'rgba(148, 163, 184, 0.1)',
    paddingVertical: 2,
    paddingHorizontal: 6,
    borderRadius: 4,
  },
  statusText: {
    color: '#94A3B8',
    fontSize: 10,
    fontWeight: '600',
  },
  title: {
    fontSize: 16,
    fontWeight: '700',
    color: '#FFFFFF',
    marginBottom: 4,
  },
  description: {
    fontSize: 12,
    color: '#94A3B8',
    marginBottom: 12,
  },
  previewList: {
    backgroundColor: '#0F172A',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  slotItem: {
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    paddingVertical: 8,
  },
  conflictSlotItem: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderRadius: 6,
    paddingHorizontal: 8,
    marginVertical: 2,
  },
  slotHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  slotTitle: {
    color: '#F1F5F9',
    fontSize: 13,
    fontWeight: '600',
  },
  slotTime: {
    color: '#38BDF8',
    fontSize: 12,
    fontWeight: '500',
  },
  slotMeta: {
    flexDirection: 'row',
    marginTop: 2,
    gap: 12,
  },
  slotDay: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '600',
  },
  slotRoom: {
    color: '#64748B',
    fontSize: 11,
  },
  warningBox: {
    flexDirection: 'row',
    alignItems: 'center',
    marginTop: 4,
    gap: 4,
  },
  warningText: {
    color: '#EF4444',
    fontSize: 11,
    fontWeight: '500',
  },
  parentTaskTitle: {
    color: '#38BDF8',
    fontSize: 13,
    fontWeight: '600',
    marginBottom: 8,
  },
  profileField: {
    color: '#94A3B8',
    fontSize: 13,
    marginBottom: 4,
  },
  bold: {
    color: '#FFFFFF',
    fontWeight: '600',
  },
  subjsBox: {
    marginTop: 8,
  },
  subjsHeader: {
    color: '#E2E8F0',
    fontSize: 12,
    fontWeight: '600',
    marginBottom: 4,
  },
  subjItem: {
    color: '#94A3B8',
    fontSize: 12,
    marginLeft: 4,
    marginBottom: 2,
  },
  fallbackText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  actionsRow: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 10,
    marginTop: 6,
  },
  dismissBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 14,
    borderRadius: 8,
    backgroundColor: '#334155',
    gap: 6,
  },
  dismissText: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
  },
  approveBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 16,
    borderRadius: 8,
    backgroundColor: '#10B981',
    gap: 6,
  },
  approveText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    padding: 8,
    borderRadius: 6,
    marginBottom: 8,
    gap: 6,
  },
  errorText: {
    color: '#EF4444',
    fontSize: 12,
  },
  appliedBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    padding: 10,
    borderRadius: 8,
    gap: 6,
  },
  appliedText: {
    color: '#10B981',
    fontSize: 13,
    fontWeight: '600',
  },
});
