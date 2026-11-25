/**
 * KaryaDEX — Class Session Workspace & Journal Modal
 *
 * Professional academic workspace for one real occurrence of a class.
 * Canonical record linking:
 * - Attendance Status (Present, Absent, Late, Cancelled, Not Set)
 * - Revision Status & Backlog Intelligence
 * - Topics Covered (Syllabus-aware with Unit hierarchy)
 * - My Class Journal / Notes (AI Ready)
 * - Teacher Notes (Announcements, exam hints, homework)
 * - Attached Resources (Files, Multi-Page Scanned Camera/Gallery PDF, Validated URLs)
 * - Automatic YouTube Study Recommendations (Linked directly to Resources)
 * - Related Tasks (Functional: Create New Task, Link Existing Task, Unlink)
 * - Final Review & Atomic Session Save
 *
 * Pure vector iconography with zero emojis.
 */

import React, { useState, useEffect, useMemo, useCallback } from 'react';
import {
  Modal,
  View,
  Text,
  TextInput,
  ScrollView,
  StyleSheet,
  Pressable,
  Platform,
  KeyboardAvoidingView,
  ActivityIndicator,
  Alert,
  Image,
  Linking,
} from 'react-native';
import { useRouter } from 'expo-router';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '@/constants/ThemeContext';
import { brand, typography, spacing, radii, status as statusColors } from '@/constants/theme';
import { GlassCard } from '@/components/ui';
import {
  CalendarIcon,
  TimeIcon,
  RoomIcon,
  CloseIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  SearchIcon,
  PresentIcon,
  AbsentIcon,
  LateIcon,
  CancelledIcon,
  NotSetIcon,
  RevisionCycleIcon,
  BacklogAlertIcon,
  TopicBookIcon,
  CheckSquareIcon,
  EmptySquareIcon,
  StudentJournalIcon,
  TeacherNotesIcon,
  SparklesIcon,
  AttachFileIcon,
  CameraScanIcon,
  GalleryPhotosIcon,
  PdfDocumentIcon,
  PptDocumentIcon,
  LinkWebIcon,
  YouTubeIcon,
  GenericFileIcon,
  TrashIcon,
  OptionsDotsIcon,
  TaskClipboardIcon,
  AddIcon,
  CheckmarkIcon,
  ExternalOpenIcon,
  StorageHardDriveIcon,
} from '@/components/ui/AcademicIcons';
import { useAppStore } from '@/store/useAppStore';
import { useAcademicStore } from '@/store/useAcademicStore';
import type {
  ClassAttendanceStatus,
  RevisionStatus,
  Resource,
  Topic,
  YouTubeRecommendation,
} from '@/types/academic';
import type { ClassType, Task, TaskCategory, TaskPriority } from '@/types';
import { youtubeRecommendationService } from '@/services/youtubeRecommendationService';
import { fileStorageService } from '@/services/fileStorageService';
import { noteScanService, ScannedPage } from '@/services/noteScanService';
import { revisionService } from '@/services/revisionService';
import { classTaskLinkService } from '@/services/classTaskLinkService';
import { classSessionService } from '@/services/classSessionService';
import { StorageSettingsModal } from './StorageSettingsModal';

export interface ClassSessionModalProps {
  visible: boolean;
  onClose: () => void;
  slotId: string;
  date: string; // "YYYY-MM-DD"
  subjectId: string;
  startTime: string;
  endTime: string;
  room?: string;
  type?: ClassType;
}

type ModalView =
  | 'overview'
  | 'attendance'
  | 'revision'
  | 'topics'
  | 'youtube'
  | 'notes'
  | 'teacher_notes'
  | 'resources'
  | 'tasks'
  | 'review';

const ATTENDANCE_CONFIG: Array<{
  key: ClassAttendanceStatus;
  label: string;
  sublabel: string;
  color: string;
  IconComponent: React.ComponentType<{ size?: number; color?: string }>;
}> = [
  {
    key: 'present',
    label: 'Present',
    sublabel: 'I attended the class.',
    color: statusColors.safe,
    IconComponent: PresentIcon,
  },
  {
    key: 'absent',
    label: 'Absent',
    sublabel: 'I did not attend.',
    color: statusColors.danger,
    IconComponent: AbsentIcon,
  },
  {
    key: 'late',
    label: 'Late',
    sublabel: 'I attended but was late.',
    color: statusColors.watch,
    IconComponent: LateIcon,
  },
  {
    key: 'cancelled',
    label: 'Cancelled',
    sublabel: 'Class was cancelled.',
    color: '#64748B',
    IconComponent: CancelledIcon,
  },
  {
    key: 'not_recorded',
    label: 'Not Set',
    sublabel: 'No attendance marked yet.',
    color: '#94A3B8',
    IconComponent: NotSetIcon,
  },
];

export function ClassSessionModal({
  visible,
  onClose,
  slotId,
  date,
  subjectId,
  startTime,
  endTime,
  room,
  type = 'lecture',
}: ClassSessionModalProps) {
  const router = useRouter();
  const { colors, isDark } = useTheme();
  const { subjects, tasks } = useAppStore();
  const academic = useAcademicStore();

  const subject = subjects.find(s => s.id === subjectId);
  const existingNote = academic.getClassNote(slotId, date);
  const allSubjectTopics = academic.getTopicsForSubject(subjectId);
  const units = academic.getUnitsForSubject(subjectId);

  // Active view navigation
  const [activeView, setActiveView] = useState<ModalView>('overview');

  // Form states
  const [attendance, setAttendance] = useState<ClassAttendanceStatus>('not_recorded');
  const [selectedTopicIds, setSelectedTopicIds] = useState<string[]>([]);
  const [myNotes, setMyNotes] = useState('');
  const [teacherNotes, setTeacherNotes] = useState('');
  const [revisionStatus, setRevisionStatus] = useState<RevisionStatus>('not_started');
  const [attachedResources, setAttachedResources] = useState<Resource[]>([]);

  // YouTube Recommendation state
  const [recommendations, setRecommendations] = useState<YouTubeRecommendation[]>([]);
  const [loadingRecs, setLoadingRecs] = useState(false);
  const [selectedRecTopicFilter, setSelectedRecTopicFilter] = useState<string>('all');

  // Resource Attachment state
  const [resourceSubTab, setResourceSubTab] = useState<'files' | 'link' | 'videos' | 'saved'>('files');
  const [newResourceTitle, setNewResourceTitle] = useState('');
  const [newResourceUrl, setNewResourceUrl] = useState('');
  const [urlValidationError, setUrlValidationError] = useState<string | null>(null);

  // Note Scanner state
  const [scannedPages, setScannedPages] = useState<ScannedPage[]>([]);
  const [scanPdfName, setScanPdfName] = useState('');
  const [isCompilingPdf, setIsCompilingPdf] = useState(false);

  // Task linking & creation state
  const [taskSubTab, setTaskSubTab] = useState<'linked' | 'create' | 'link_existing'>('linked');
  const [newTaskTitle, setNewTaskTitle] = useState('');
  const [newTaskDueDate, setNewTaskDueDate] = useState('');
  const [newTaskDueTime, setNewTaskDueTime] = useState('');
  const [newTaskPriority, setNewTaskPriority] = useState<TaskPriority>('medium');
  const [newTaskCategory, setNewTaskCategory] = useState<TaskCategory>('assignment');
  const [newTaskMinutes, setNewTaskMinutes] = useState('30');
  const [newTaskNotes, setNewTaskNotes] = useState('');
  const [taskSearchQuery, setTaskSearchQuery] = useState('');

  // Storage Settings Modal
  const [storageSettingsVisible, setStorageSettingsVisible] = useState(false);

  // Topic search filter
  const [topicSearchQuery, setTopicSearchQuery] = useState('');

  // Save states
  const [saving, setSaving] = useState(false);
  const [savedSuccess, setSavedSuccess] = useState(false);

  // Sync state on modal open
  useEffect(() => {
    if (visible) {
      setActiveView('overview');
      if (existingNote) {
        setAttendance(existingNote.attendanceStatus);
        setSelectedTopicIds(existingNote.topicIds || []);
        setMyNotes(existingNote.myNotes || '');
        setTeacherNotes(existingNote.teacherNotes || '');
        setRevisionStatus(existingNote.revisionStatus || 'not_started');
        const existingRes = academic.getResourcesForClassNote(existingNote.id);
        setAttachedResources(existingRes);
      } else {
        setAttendance('not_recorded');
        setSelectedTopicIds([]);
        setMyNotes('');
        setTeacherNotes('');
        setRevisionStatus('not_started');
        setAttachedResources([]);
      }
      setScanPdfName(noteScanService.getDefaultFileName(subject?.name || 'Class', date));
      setScannedPages([]);
      setSavedSuccess(false);
      setSaving(false);
    }
  }, [visible, slotId, date, existingNote, subject]);

  // Fetch YouTube recommendations when topics change
  useEffect(() => {
    let isMounted = true;
    async function fetchRecs() {
      if (selectedTopicIds.length === 0) {
        setRecommendations([]);
        return;
      }
      const topicNames = selectedTopicIds
        .map(id => allSubjectTopics.find(t => t.id === id)?.name)
        .filter((n): n is string => Boolean(n));

      setLoadingRecs(true);
      try {
        const results = await youtubeRecommendationService.getRecommendations({
          subjectName: subject?.name || 'Academic',
          topicNames,
          regionCode: 'IN',
          language: 'en',
        });
        if (isMounted) {
          setRecommendations(results);
        }
      } catch {
        if (isMounted) setRecommendations([]);
      } finally {
        if (isMounted) setLoadingRecs(false);
      }
    }

    fetchRecs();
    return () => {
      isMounted = false;
    };
  }, [selectedTopicIds, allSubjectTopics, subject]);

  // Revision intelligence calculations
  const revisionIntelligence = useMemo(() => {
    return revisionService.calculateSessionRevision(
      subjectId,
      selectedTopicIds,
      allSubjectTopics,
      academic.classNotes
    );
  }, [subjectId, selectedTopicIds, allSubjectTopics, academic.classNotes]);

  // Linked tasks
  const linkedTasks = useMemo(() => {
    return classTaskLinkService.getLinkedTasks(slotId);
  }, [slotId, tasks, academic.taskRelations]);

  // Unlinked tasks for picker
  const unlinkedAvailableTasks = useMemo(() => {
    return classTaskLinkService.getLinkableTasks(slotId, taskSearchQuery);
  }, [slotId, tasks, academic.taskRelations, taskSearchQuery]);

  // ─── Actions ──────────────────────────────────────────────────

  const handleSave = async () => {
    setSaving(true);
    try {
      await classSessionService.saveClassSession({
        slotId,
        date,
        subjectId,
        attendanceStatus: attendance,
        selectedTopicIds,
        myNotes,
        teacherNotes,
        revisionStatus,
        resources: attachedResources,
        linkedTaskIds: linkedTasks.map(t => t.id),
      });

      setSaving(false);
      setSavedSuccess(true);
      setTimeout(() => {
        setSavedSuccess(false);
        onClose();
      }, 1200);
    } catch (e: any) {
      setSaving(false);
      Alert.alert('Save Failed', e?.message || 'Could not save session. Form data is preserved.');
    }
  };

  const toggleTopic = (topicId: string) => {
    setSelectedTopicIds(prev =>
      prev.includes(topicId) ? prev.filter(id => id !== topicId) : [...prev, topicId]
    );
  };

  const handleMarkTopicRevision = (topicId: string, status: RevisionStatus) => {
    revisionService.recordTopicRevision(topicId, status, slotId);
    // If all are revised, update session revision status
    const allRevised = selectedTopicIds.every(tid => {
      const t = academic.topics.find(top => top.id === tid);
      return tid === topicId ? status === 'revised' : t?.revisionStatus === 'revised';
    });
    setRevisionStatus(allRevised ? 'revised' : 'taught');
  };

  // ─── Resource Handlers ────────────────────────────────────────

  const handlePickDocument = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: [
          'application/pdf',
          'application/vnd.ms-powerpoint',
          'application/vnd.openxmlformats-officedocument.presentationml.presentation',
          'application/msword',
          'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
          '*/*',
        ],
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) {
        return;
      }

      const file = res.assets[0];
      const saved = await fileStorageService.saveUserFile(file.uri, file.name, file.mimeType);

      const newRes: Resource = {
        id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: file.name,
        type: file.mimeType?.includes('pdf')
          ? 'pdf'
          : file.mimeType?.includes('presentation')
          ? 'file'
          : 'document',
        uri: saved.permanentUri,
        sizeBytes: saved.fileSize || file.size || 0,
        fileSize: saved.fileSize || file.size || 0,
        mimeType: file.mimeType || 'application/octet-stream',
        createdAt: new Date().toISOString(),
        source: 'file',
        isLocal: true,
      };

      setAttachedResources(prev => [newRes, ...prev]);
      setResourceSubTab('saved');
    } catch (e: any) {
      Alert.alert('Attachment Error', e?.message || 'Could not attach selected file.');
    }
  };

  const handleCaptureCameraPage = async () => {
    const result = await noteScanService.captureFromCamera();
    if (!result.cancelled && result.uri) {
      setScannedPages(prev => [
        ...prev,
        { id: `page-${Date.now()}-${prev.length}`, uri: result.uri! },
      ]);
    } else if (result.error) {
      Alert.alert('Camera Notice', result.error);
    }
  };

  const handlePickGalleryPages = async () => {
    const result = await noteScanService.pickFromGallery();
    if (!result.cancelled && result.uris.length > 0) {
      const newPages = result.uris.map((uri, idx) => ({
        id: `page-${Date.now()}-${idx}`,
        uri,
      }));
      setScannedPages(prev => [...prev, ...newPages]);
    } else if (result.error) {
      Alert.alert('Gallery Notice', result.error);
    }
  };

  const handleCompileScannedPdf = async () => {
    if (scannedPages.length === 0) {
      Alert.alert('Empty Document', 'Capture or select at least one page photo first.');
      return;
    }

    setIsCompilingPdf(true);
    try {
      const compiled = await noteScanService.compilePagesToPdf({
        pages: scannedPages,
        subjectName: subject?.name || 'Class',
        date,
        customFileName: scanPdfName,
      });

      const newRes: Resource = {
        id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        title: compiled.fileName,
        type: 'scanned_pdf',
        uri: compiled.pdfUri,
        sizeBytes: compiled.fileSize,
        fileSize: compiled.fileSize,
        mimeType: 'application/pdf',
        createdAt: new Date().toISOString(),
        source: 'scanned_pdf',
        isLocal: true,
      };

      setAttachedResources(prev => [newRes, ...prev]);
      setScannedPages([]);
      setIsCompilingPdf(false);
      setResourceSubTab('saved');
    } catch (e: any) {
      setIsCompilingPdf(false);
      Alert.alert('PDF Compilation Failed', e?.message || 'Failed to generate PDF from pages.');
    }
  };

  const handleAddManualUrl = () => {
    setUrlValidationError(null);
    const trimmedUrl = newResourceUrl.trim();
    if (!trimmedUrl) {
      setUrlValidationError('Please enter a valid URL.');
      return;
    }

    // Basic URL validation
    const urlPattern = /^(https?:\/\/)?([\da-z.-]+)\.([a-z.]{2,6})([/\w .-]*)*\/?$/i;
    if (!urlPattern.test(trimmedUrl) && !trimmedUrl.startsWith('http://') && !trimmedUrl.startsWith('https://')) {
      setUrlValidationError('Please enter a valid web address (e.g. https://drive.google.com/...)');
      return;
    }

    const formattedUrl = trimmedUrl.startsWith('http') ? trimmedUrl : `https://${trimmedUrl}`;
    const defaultTitle = newResourceTitle.trim() || `Link: ${new URL(formattedUrl).hostname}`;

    const newRes: Resource = {
      id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: defaultTitle,
      type: 'url',
      url: formattedUrl,
      createdAt: new Date().toISOString(),
      source: 'url',
      isLocal: false,
    };

    setAttachedResources(prev => [newRes, ...prev]);
    setNewResourceTitle('');
    setNewResourceUrl('');
    setResourceSubTab('saved');
  };

  const handleSaveYouTubeRecommendation = (rec: YouTubeRecommendation) => {
    const existing = attachedResources.find(r => r.url === rec.url);
    if (existing) {
      Alert.alert('Already Attached', 'This video lecture is already attached to this session.');
      return;
    }

    const newRes: Resource = {
      id: `res-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      title: rec.title,
      type: 'youtube',
      url: rec.url,
      createdAt: new Date().toISOString(),
      source: 'youtube',
      topics: rec.matchedTopics,
      isLocal: false,
      isRecommended: true,
    };

    setAttachedResources(prev => [newRes, ...prev]);
    Alert.alert('Video Attached', `"${rec.title}" has been saved to your attached resources.`);
  };

  const handleRemoveResource = (id: string) => {
    setAttachedResources(prev => prev.filter(r => r.id !== id));
  };

  // ─── Task Handlers ────────────────────────────────────────────

  const handleCreateTask = () => {
    if (!newTaskTitle.trim()) {
      Alert.alert('Required Field', 'Please enter a task title.');
      return;
    }

    classTaskLinkService.createNewTask({
      title: newTaskTitle.trim(),
      subjectId,
      classSessionId: slotId,
      classDate: date,
      topicId: selectedTopicIds.length > 0 ? selectedTopicIds[0] : undefined,
      dueDate: newTaskDueDate.trim() || undefined,
      dueTime: newTaskDueTime.trim() || undefined,
      priority: newTaskPriority,
      category: newTaskCategory,
      estimatedMinutes: parseInt(newTaskMinutes, 10) || 30,
      notes: newTaskNotes.trim() || undefined,
    });

    setNewTaskTitle('');
    setNewTaskDueDate('');
    setNewTaskDueTime('');
    setNewTaskNotes('');
    setTaskSubTab('linked');
  };

  const handleLinkExistingTask = (task: Task) => {
    classTaskLinkService.linkExistingTask(task.id, slotId, date);
    setTaskSubTab('linked');
  };

  const handleUnlinkTask = (taskId: string) => {
    classTaskLinkService.unlinkTask(taskId, slotId);
  };

  const handleDeleteTask = (taskId: string) => {
    classTaskLinkService.deleteTask(taskId);
  };

  // ─── Render Subviews ──────────────────────────────────────────

  const renderHeader = (title: string, showBack = false) => (
    <View style={styles.header}>
      <View style={{ flex: 1 }}>
        <View style={styles.subjectBadgeRow}>
          <View style={[styles.colorDot, { backgroundColor: subject?.color || brand.violet }]} />
          <Text style={[styles.subjectName, { color: colors.text }]} numberOfLines={1}>
            {subject?.name || 'Class Session'}
          </Text>
          <View
            style={[
              styles.typeBadge,
              {
                backgroundColor: isDark ? 'rgba(124, 58, 237, 0.20)' : 'rgba(124, 58, 237, 0.10)',
              },
            ]}
          >
            <Text style={[styles.typeBadgeText, { color: brand.violet }]}>
              {type.toUpperCase()}
            </Text>
          </View>
        </View>

        <View style={styles.metaRow}>
          <CalendarIcon size={12} color={colors.textTertiary} />
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>{date}</Text>
          <Text style={[styles.metaDot, { color: colors.textTertiary }]}>·</Text>
          <TimeIcon size={12} color={colors.textTertiary} />
          <Text style={[styles.metaText, { color: colors.textSecondary }]}>
            {startTime} — {endTime}
          </Text>
          {room ? (
            <>
              <Text style={[styles.metaDot, { color: colors.textTertiary }]}>·</Text>
              <RoomIcon size={12} color={colors.textTertiary} />
              <Text style={[styles.metaText, { color: colors.textSecondary }]}>Room {room}</Text>
            </>
          ) : null}
        </View>
      </View>

      <View style={styles.headerActions}>
        {showBack ? (
          <Pressable onPress={() => setActiveView('overview')} style={styles.headerBtn}>
            <Text style={[styles.backBtnText, { color: brand.violet }]}>Overview</Text>
          </Pressable>
        ) : null}
        <Pressable onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close modal">
          <CloseIcon size={20} color={colors.textSecondary} />
        </Pressable>
      </View>
    </View>
  );

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <KeyboardAvoidingView
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
        style={styles.modalOverlay}
      >
        <Pressable style={styles.backdrop} onPress={onClose} />

        <View
          style={[
            styles.modalSheet,
            {
              backgroundColor: isDark ? 'rgba(16, 18, 28, 0.98)' : 'rgba(255, 255, 255, 0.99)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.14)' : 'rgba(0, 0, 0, 0.10)',
            },
          ]}
        >
          {/* ════════════════════════════════════════════════════════════════════
              01 OVERVIEW & STATUS (MAIN WORKSPACE)
          ════════════════════════════════════════════════════════════════════ */}
          {activeView === 'overview' && (
            <>
              {renderHeader('Class Session')}

              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollBody}
              >
                {/* ─── Attendance Status ─── */}
                <View style={styles.section}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                      ATTENDANCE STATUS
                    </Text>
                    <Pressable onPress={() => setActiveView('attendance')}>
                      <Text style={[styles.subLink, { color: brand.violet }]}>View Options →</Text>
                    </Pressable>
                  </View>

                  <View style={styles.pillRow}>
                    {ATTENDANCE_CONFIG.map(opt => {
                      const isSelected = attendance === opt.key;
                      const hasAnySelection = attendance !== 'not_recorded';
                      const isSubdued = hasAnySelection && !isSelected;
                      const Icon = opt.IconComponent;
                      return (
                        <Pressable
                          key={opt.key}
                          onPress={() => setAttendance(opt.key)}
                          accessibilityRole="button"
                          accessibilityLabel={`Attendance ${opt.label}${isSelected ? ', selected' : ''}`}
                          style={[
                            styles.attPill,
                            {
                              backgroundColor: isSelected
                                ? opt.color + '26'
                                : isDark
                                ? 'rgba(255, 255, 255, 0.05)'
                                : 'rgba(0, 0, 0, 0.04)',
                              borderColor: isSelected
                                ? opt.color
                                : isDark
                                ? 'rgba(255, 255, 255, 0.10)'
                                : 'rgba(0, 0, 0, 0.08)',
                              borderWidth: isSelected ? 1.5 : 1,
                              opacity: isSubdued ? 0.55 : 1,
                              transform: [{ scale: isSelected ? 1.03 : 1 }],
                            },
                            isSelected && {
                              shadowColor: opt.color,
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: 0.35,
                              shadowRadius: 6,
                              elevation: 3,
                              ...(Platform.OS === 'web'
                                ? {
                                    boxShadow: `0 0 14px ${opt.color}40, inset 0 1px 0 rgba(255, 255, 255, 0.30)`,
                                  }
                                : {}),
                            },
                          ]}
                        >
                          <Icon size={14} color={isSelected ? opt.color : colors.textSecondary} />
                          <Text
                            style={[
                              styles.attPillText,
                              {
                                color: isSelected ? opt.color : colors.textSecondary,
                                fontWeight: isSelected ? typography.weights.bold : typography.weights.medium,
                              },
                            ]}
                          >
                            {opt.label}
                          </Text>
                        </Pressable>
                      );
                    })}
                  </View>
                </View>

                {/* ─── Revision Status Card ─── */}
                <View style={styles.section}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                      REVISION STATUS
                    </Text>
                    <Pressable onPress={() => setActiveView('revision')}>
                      <Text style={[styles.subLink, { color: brand.violet }]}>View Details →</Text>
                    </Pressable>
                  </View>

                  <GlassCard
                    level="secondary"
                    style={styles.revCard}
                    onPress={() => setActiveView('revision')}
                  >
                    <View style={styles.revCardLeft}>
                      <View
                        style={[
                          styles.progressCircle,
                          {
                            borderColor:
                              revisionIntelligence.progressPercentage === 100
                                ? statusColors.safe
                                : brand.violet,
                          },
                        ]}
                      >
                        <Text style={[styles.progressNumber, { color: colors.text }]}>
                          {revisionIntelligence.progressPercentage}%
                        </Text>
                      </View>
                      <View style={{ gap: 2 }}>
                        <Text style={[styles.revMainText, { color: colors.text }]}>
                          {revisionIntelligence.totalCoveredCount} topic
                          {revisionIntelligence.totalCoveredCount !== 1 ? 's' : ''} covered
                        </Text>
                        <Text style={[styles.revSubText, { color: colors.textTertiary }]}>
                          {revisionIntelligence.revisedCount} revised ·{' '}
                          {revisionIntelligence.pendingCount} pending
                        </Text>
                      </View>
                    </View>

                    <View style={styles.revCardRight}>
                      {revisionIntelligence.subjectBacklogCount > 0 ? (
                        <View style={styles.backlogPill}>
                          <BacklogAlertIcon size={12} color={statusColors.watch} />
                          <Text style={[styles.backlogText, { color: statusColors.watch }]}>
                            {revisionIntelligence.subjectBacklogCount} Backlog
                          </Text>
                        </View>
                      ) : (
                        <View style={styles.safePill}>
                          <CheckmarkIcon size={12} color={statusColors.safe} />
                          <Text style={[styles.safeText, { color: statusColors.safe }]}>
                            Up to date
                          </Text>
                        </View>
                      )}
                    </View>
                  </GlassCard>
                </View>

                {/* ─── Topics Covered ─── */}
                <View style={styles.section}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                      TOPICS COVERED ({selectedTopicIds.length})
                    </Text>
                    <Pressable onPress={() => setActiveView('topics')}>
                      <Text style={[styles.subLink, { color: brand.violet }]}>Select Topics →</Text>
                    </Pressable>
                  </View>

                  {selectedTopicIds.length === 0 ? (
                    <Pressable
                      onPress={() => setActiveView('topics')}
                      style={[
                        styles.emptyBox,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255, 255, 255, 0.04)'
                            : 'rgba(0, 0, 0, 0.02)',
                        },
                      ]}
                    >
                      <TopicBookIcon size={16} color={brand.violet} />
                      <Text style={[styles.emptyHintText, { color: colors.textSecondary }]}>
                        Tap to select syllabus topics taught in this class
                      </Text>
                    </Pressable>
                  ) : (
                    <View style={styles.topicsGrid}>
                      {selectedTopicIds.map(tid => {
                        const top = allSubjectTopics.find(t => t.id === tid);
                        return (
                          <View
                            key={tid}
                            style={[
                              styles.topicChip,
                              {
                                backgroundColor: isDark
                                  ? 'rgba(124, 58, 237, 0.22)'
                                  : 'rgba(124, 58, 237, 0.12)',
                                borderColor: brand.violet,
                              },
                            ]}
                          >
                            <Text style={[styles.topicChipText, { color: brand.violet }]}>
                              {top?.name || tid}
                            </Text>
                          </View>
                        );
                      })}
                    </View>
                  )}
                </View>

                {/* ─── YouTube Recommendations Banner ─── */}
                {selectedTopicIds.length > 0 && recommendations.length > 0 && (
                  <Pressable
                    onPress={() => setActiveView('youtube')}
                    style={[
                      styles.ytBanner,
                      {
                        backgroundColor: isDark
                          ? 'rgba(239, 68, 68, 0.12)'
                          : 'rgba(239, 68, 68, 0.08)',
                        borderColor: isDark
                          ? 'rgba(239, 68, 68, 0.30)'
                          : 'rgba(239, 68, 68, 0.20)',
                      },
                    ]}
                  >
                    <View style={styles.ytBannerLeft}>
                      <YouTubeIcon size={18} color="#EF4444" />
                      <View>
                        <Text style={[styles.ytBannerTitle, { color: colors.text }]}>
                          Study Recommendations Available
                        </Text>
                        <Text style={[styles.ytBannerSub, { color: colors.textSecondary }]}>
                          {recommendations.length} lecture video
                          {recommendations.length !== 1 ? 's' : ''} matched to your topics
                        </Text>
                      </View>
                    </View>
                    <ChevronRightIcon size={16} color="#EF4444" />
                  </Pressable>
                )}

                {/* ─── Notes Editor ─── */}
                <View style={styles.section}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                      MY CLASS JOURNAL / NOTES
                    </Text>
                    <Pressable onPress={() => setActiveView('notes')}>
                      <Text style={[styles.subLink, { color: brand.violet }]}>Expand Editor →</Text>
                    </Pressable>
                  </View>
                  <TextInput
                    style={[
                      styles.textArea,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.05)'
                          : 'rgba(0, 0, 0, 0.03)',
                        borderColor: isDark
                          ? 'rgba(255, 255, 255, 0.12)'
                          : 'rgba(0, 0, 0, 0.10)',
                        color: colors.text,
                      },
                    ]}
                    placeholder="What was discussed in this lecture? Key takeaways, derivations, questions..."
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    numberOfLines={4}
                    value={myNotes}
                    onChangeText={setMyNotes}
                  />
                </View>

                {/* ─── Teacher Notes ─── */}
                <View style={styles.section}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                      TEACHER NOTES
                    </Text>
                    <Pressable onPress={() => setActiveView('teacher_notes')}>
                      <Text style={[styles.subLink, { color: brand.violet }]}>Expand →</Text>
                    </Pressable>
                  </View>
                  <TextInput
                    style={[
                      styles.textAreaSmall,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.05)'
                          : 'rgba(0, 0, 0, 0.03)',
                        borderColor: isDark
                          ? 'rgba(255, 255, 255, 0.12)'
                          : 'rgba(0, 0, 0, 0.10)',
                        color: colors.text,
                      },
                    ]}
                    placeholder="Important announcements, exam hints, homework specified by teacher..."
                    placeholderTextColor={colors.textTertiary}
                    multiline
                    numberOfLines={2}
                    value={teacherNotes}
                    onChangeText={setTeacherNotes}
                  />
                </View>

                {/* ─── Attached Resources Preview ─── */}
                <View style={styles.section}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                      ATTACHED RESOURCES ({attachedResources.length})
                    </Text>
                    <Pressable onPress={() => setActiveView('resources')}>
                      <Text style={[styles.subLink, { color: brand.violet }]}>Manage →</Text>
                    </Pressable>
                  </View>

                  {attachedResources.length === 0 ? (
                    <Pressable
                      onPress={() => setActiveView('resources')}
                      style={[
                        styles.emptyBox,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255, 255, 255, 0.04)'
                            : 'rgba(0, 0, 0, 0.02)',
                        },
                      ]}
                    >
                      <AttachFileIcon size={16} color={brand.violet} />
                      <Text style={[styles.emptyHintText, { color: colors.textSecondary }]}>
                        Attach PDF, PowerPoint, scan camera notes, or add links
                      </Text>
                    </Pressable>
                  ) : (
                    <View style={styles.resourceList}>
                      {attachedResources.slice(0, 3).map(res => (
                        <View
                          key={res.id}
                          style={[
                            styles.resourceItem,
                            {
                              backgroundColor: isDark
                                ? 'rgba(255, 255, 255, 0.05)'
                                : 'rgba(0, 0, 0, 0.03)',
                              borderColor: isDark
                                ? 'rgba(255, 255, 255, 0.08)'
                                : 'rgba(0, 0, 0, 0.06)',
                            },
                          ]}
                        >
                          {res.type === 'pdf' || res.type === 'scanned_pdf' ? (
                            <PdfDocumentIcon size={18} />
                          ) : res.type === 'youtube' ? (
                            <YouTubeIcon size={18} />
                          ) : res.type === 'url' ? (
                            <LinkWebIcon size={18} />
                          ) : (
                            <GenericFileIcon size={18} />
                          )}
                          <View style={{ flex: 1 }}>
                            <Text
                              style={[styles.resourceTitle, { color: colors.text }]}
                              numberOfLines={1}
                            >
                              {res.title}
                            </Text>
                            <Text style={[styles.resourceMeta, { color: colors.textTertiary }]}>
                              {res.type.toUpperCase()} ·{' '}
                              {res.fileSize
                                ? `${(res.fileSize / 1024).toFixed(1)} KB`
                                : res.source || 'resource'}
                            </Text>
                          </View>
                        </View>
                      ))}
                    </View>
                  )}

                  {/* ─── Recommended Study Videos in Resources (Section 7) ─── */}
                  {selectedTopicIds.length > 0 && recommendations.length > 0 && (
                    <View style={styles.recSectionInResources}>
                      <View style={styles.recHeaderRowInResources}>
                        <Text style={[styles.recSectionTitleInResources, { color: colors.textSecondary }]}>
                          RECOMMENDED STUDY VIDEOS ({recommendations.length})
                        </Text>
                        <Pressable
                          onPress={() => {
                            setActiveView('resources');
                            setResourceSubTab('videos');
                          }}
                        >
                          <Text style={[styles.subLink, { color: brand.violet }]}>View All →</Text>
                        </Pressable>
                      </View>
                      <View style={{ gap: spacing.xs, marginTop: 4 }}>
                        {recommendations.slice(0, 2).map(rec => {
                          const isAlreadyAttached = attachedResources.some(r => r.url === rec.url);
                          return (
                            <View
                              key={rec.videoId}
                              style={[
                                styles.recItemSmall,
                                {
                                  backgroundColor: isDark
                                    ? 'rgba(255, 255, 255, 0.05)'
                                    : 'rgba(0, 0, 0, 0.03)',
                                  borderColor: isDark
                                    ? 'rgba(255, 255, 255, 0.08)'
                                    : 'rgba(0, 0, 0, 0.06)',
                                },
                              ]}
                            >
                              <View style={styles.recItemSmallLeft}>
                                <YouTubeIcon size={18} color="#EF4444" />
                                <View style={{ flex: 1 }}>
                                  <Text style={[styles.recItemSmallTitle, { color: colors.text }]} numberOfLines={1}>
                                    {rec.title}
                                  </Text>
                                  <Text style={[styles.recItemSmallMeta, { color: colors.textTertiary }]}>
                                    {rec.channelTitle} · {rec.reason.split('·')[0].trim()}
                                  </Text>
                                </View>
                              </View>
                              <View style={styles.recItemSmallActions}>
                                <Pressable
                                  onPress={() => Linking.openURL(rec.url)}
                                  style={styles.recItemSmallOpenBtn}
                                >
                                  <Text style={[styles.recItemSmallOpenText, { color: colors.text }]}>Open</Text>
                                </Pressable>
                                <Pressable
                                  onPress={() => handleSaveYouTubeRecommendation(rec)}
                                  disabled={isAlreadyAttached}
                                  style={[
                                    styles.recItemSmallSaveBtn,
                                    {
                                      backgroundColor: isAlreadyAttached ? statusColors.safe : brand.violet,
                                    },
                                  ]}
                                >
                                  <Text style={styles.recItemSmallSaveText}>
                                    {isAlreadyAttached ? 'Saved' : '+ Save'}
                                  </Text>
                                </Pressable>
                              </View>
                            </View>
                          );
                        })}
                      </View>
                    </View>
                  )}
                </View>

                {/* ─── Linked Tasks Preview ─── */}
                <View style={styles.section}>
                  <View style={styles.sectionHeaderRow}>
                    <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
                      RELATED TASKS ({linkedTasks.length})
                    </Text>
                    <Pressable onPress={() => setActiveView('tasks')}>
                      <Text style={[styles.subLink, { color: brand.violet }]}>Add / Link Task →</Text>
                    </Pressable>
                  </View>

                  {linkedTasks.length === 0 ? (
                    <Pressable
                      onPress={() => setActiveView('tasks')}
                      style={[
                        styles.emptyBox,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255, 255, 255, 0.04)'
                            : 'rgba(0, 0, 0, 0.02)',
                        },
                      ]}
                    >
                      <TaskClipboardIcon size={16} color={brand.violet} />
                      <Text style={[styles.emptyHintText, { color: colors.textSecondary }]}>
                        No tasks linked to this class yet. Tap to create or link task.
                      </Text>
                    </Pressable>
                  ) : (
                    <View style={styles.taskList}>
                      {linkedTasks.map(t => (
                        <View
                          key={t.id}
                          style={[
                            styles.taskItem,
                            {
                              backgroundColor: isDark
                                ? 'rgba(255, 255, 255, 0.05)'
                                : 'rgba(0, 0, 0, 0.03)',
                              borderColor: isDark
                                ? 'rgba(255, 255, 255, 0.08)'
                                : 'rgba(0, 0, 0, 0.06)',
                            },
                          ]}
                        >
                          <TaskClipboardIcon
                            size={14}
                            color={t.isCompleted ? colors.textTertiary : brand.violet}
                          />
                          <Text
                            style={[
                              styles.taskName,
                              {
                                color: t.isCompleted ? colors.textTertiary : colors.text,
                                textDecorationLine: t.isCompleted ? 'line-through' : 'none',
                              },
                            ]}
                            numberOfLines={1}
                          >
                            {t.title}
                          </Text>
                          {t.dueDate && (
                            <Text style={[styles.taskDue, { color: colors.textTertiary }]}>
                              Due {t.dueDate}
                            </Text>
                          )}
                        </View>
                      ))}
                    </View>
                  )}
                </View>

                {/* ─── Action Buttons ─── */}
                <View style={styles.actionRow}>
                  <Pressable
                    onPress={handleSave}
                    disabled={saving}
                    style={[
                      styles.saveBtn,
                      { backgroundColor: savedSuccess ? statusColors.safe : brand.violet },
                    ]}
                  >
                    {saving ? (
                      <ActivityIndicator size="small" color="#FFF" />
                    ) : (
                      <View style={styles.btnContentRow}>
                        <CheckmarkIcon size={16} color="#FFF" />
                        <Text style={styles.saveBtnText}>
                          {savedSuccess ? 'Saved to Academic Record' : 'Save Session Journal'}
                        </Text>
                      </View>
                    )}
                  </Pressable>

                  {subjectId && (
                    <Pressable
                      onPress={() => {
                        onClose();
                        router.push(`/subject/${subjectId}`);
                      }}
                      style={[
                        styles.hubBtn,
                        {
                          borderColor: isDark
                            ? 'rgba(255, 255, 255, 0.20)'
                            : 'rgba(0, 0, 0, 0.15)',
                        },
                      ]}
                    >
                      <Text style={[styles.hubBtnText, { color: colors.text }]}>Subject Hub</Text>
                    </Pressable>
                  )}
                </View>
              </ScrollView>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              02 ATTENDANCE SELECTION (DETAILED VIEW)
          ════════════════════════════════════════════════════════════════════ */}
          {activeView === 'attendance' && (
            <>
              {renderHeader('Attendance Status', true)}
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollBody}
              >
                <Text style={[styles.subViewHeader, { color: colors.text }]}>
                  Mark your attendance for this class
                </Text>
                <View style={styles.attCardList}>
                  {ATTENDANCE_CONFIG.map(opt => {
                    const isSelected = attendance === opt.key;
                    const hasAnySelection = attendance !== 'not_recorded';
                    const isSubdued = hasAnySelection && !isSelected;
                    const Icon = opt.IconComponent;
                    return (
                      <Pressable
                        key={opt.key}
                        onPress={() => setAttendance(opt.key)}
                        accessibilityRole="button"
                        accessibilityLabel={`Attendance ${opt.label}${isSelected ? ', selected' : ''}`}
                        style={[
                          styles.attSelectCard,
                          {
                            backgroundColor: isSelected
                              ? opt.color + '1A'
                              : isDark
                              ? 'rgba(255, 255, 255, 0.05)'
                              : 'rgba(0, 0, 0, 0.03)',
                            borderColor: isSelected
                              ? opt.color
                              : isDark
                              ? 'rgba(255, 255, 255, 0.10)'
                              : 'rgba(0, 0, 0, 0.08)',
                            borderWidth: isSelected ? 1.5 : 1,
                            opacity: isSubdued ? 0.6 : 1,
                            transform: [{ scale: isSelected ? 1.02 : 1 }],
                          },
                          isSelected && {
                            shadowColor: opt.color,
                            shadowOffset: { width: 0, height: 2 },
                            shadowOpacity: 0.35,
                            shadowRadius: 8,
                            elevation: 3,
                            ...(Platform.OS === 'web'
                              ? {
                                  boxShadow: `0 0 16px ${opt.color}35, inset 0 1px 0 rgba(255, 255, 255, 0.25)`,
                                }
                              : {}),
                          },
                        ]}
                      >
                        <View style={styles.attCardLeft}>
                          <View
                            style={[
                              styles.attCardIconCircle,
                              { backgroundColor: opt.color + '26' },
                            ]}
                          >
                            <Icon size={22} color={opt.color} />
                          </View>
                          <View style={{ gap: 2 }}>
                            <Text
                              style={[
                                styles.attCardTitle,
                                { color: isSelected ? opt.color : colors.text },
                                isSelected && { fontWeight: typography.weights.bold },
                              ]}
                            >
                              {opt.label}
                            </Text>
                            <Text
                              style={[styles.attCardSublabel, { color: colors.textSecondary }]}
                            >
                              {opt.sublabel}
                            </Text>
                          </View>
                        </View>

                        <View
                          style={[
                            styles.radioCircle,
                            {
                              borderColor: isSelected ? opt.color : colors.textTertiary,
                              backgroundColor: isSelected ? opt.color : 'transparent',
                            },
                          ]}
                        >
                          {isSelected && <View style={styles.radioInnerDot} />}
                        </View>
                      </Pressable>
                    );
                  })}
                </View>

                <Pressable onPress={() => setActiveView('overview')} style={styles.subViewDoneBtn}>
                  <Text style={styles.subViewDoneText}>Done</Text>
                </Pressable>
              </ScrollView>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              03 REVISION STATUS (DETAILED INTELLIGENCE)
          ════════════════════════════════════════════════════════════════════ */}
          {activeView === 'revision' && (
            <>
              {renderHeader('Revision Intelligence', true)}
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollBody}
              >
                <View style={styles.revDetailCardRow}>
                  <View
                    style={[
                      styles.revMetricBox,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.05)'
                          : 'rgba(0, 0, 0, 0.03)',
                        borderColor: isDark
                          ? 'rgba(255, 255, 255, 0.10)'
                          : 'rgba(0, 0, 0, 0.08)',
                      },
                    ]}
                  >
                    <Text style={[styles.revMetricNum, { color: brand.violet }]}>
                      {revisionIntelligence.progressPercentage}%
                    </Text>
                    <Text style={[styles.revMetricLabel, { color: colors.textSecondary }]}>
                      Revision Progress
                    </Text>
                    <Text style={[styles.revMetricSub, { color: colors.textTertiary }]}>
                      {revisionIntelligence.revisedCount}/{revisionIntelligence.totalCoveredCount}{' '}
                      topics revised
                    </Text>
                  </View>

                  <View
                    style={[
                      styles.revMetricBox,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.05)'
                          : 'rgba(0, 0, 0, 0.03)',
                        borderColor: isDark
                          ? 'rgba(255, 255, 255, 0.10)'
                          : 'rgba(0, 0, 0, 0.08)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.revMetricNum,
                        {
                          color:
                            revisionIntelligence.subjectBacklogCount > 0
                              ? statusColors.watch
                              : statusColors.safe,
                        },
                      ]}
                    >
                      {revisionIntelligence.subjectBacklogCount}
                    </Text>
                    <Text style={[styles.revMetricLabel, { color: colors.textSecondary }]}>
                      Subject Backlog
                    </Text>
                    <Text style={[styles.revMetricSub, { color: colors.textTertiary }]}>
                      Taught topics needing revision
                    </Text>
                  </View>
                </View>

                {/* Revision history info */}
                <View
                  style={[
                    styles.infoBanner,
                    {
                      backgroundColor: isDark
                        ? 'rgba(124, 58, 237, 0.10)'
                        : 'rgba(124, 58, 237, 0.06)',
                      borderColor: brand.violet + '40',
                    },
                  ]}
                >
                  <RevisionCycleIcon size={16} color={brand.violet} />
                  <View style={{ flex: 1 }}>
                    <Text style={[styles.infoBannerTitle, { color: colors.text }]}>
                      Previous Revision Status
                    </Text>
                    <Text style={[styles.infoBannerMeta, { color: colors.textSecondary }]}>
                      {revisionIntelligence.lastRevisedDateLabel}
                    </Text>
                  </View>
                </View>

                {/* Topic-wise revision list */}
                <Text style={[styles.subSectionTitle, { color: colors.textSecondary }]}>
                  TOPIC-WISE REVISION CONTROLS
                </Text>

                {selectedTopicIds.length === 0 ? (
                  <View
                    style={[
                      styles.emptyBox,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.04)'
                          : 'rgba(0, 0, 0, 0.02)',
                      },
                    ]}
                  >
                    <Text style={[styles.emptyHintText, { color: colors.textSecondary }]}>
                      No topics selected yet for this session. Select covered topics first.
                    </Text>
                  </View>
                ) : (
                  selectedTopicIds.map(tid => {
                    const top = allSubjectTopics.find(t => t.id === tid);
                    if (!top) return null;
                    const isRevised = top.revisionStatus === 'revised';
                    const isNeedsRev = top.revisionStatus === 'needs_revision';
                    return (
                      <View
                        key={top.id}
                        style={[
                          styles.topicRevRow,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.05)'
                              : 'rgba(0, 0, 0, 0.03)',
                            borderColor: isDark
                              ? 'rgba(255, 255, 255, 0.10)'
                              : 'rgba(0, 0, 0, 0.08)',
                          },
                        ]}
                      >
                        <View style={{ flex: 1, gap: 2 }}>
                          <Text style={[styles.topicRevName, { color: colors.text }]}>
                            {top.name}
                          </Text>
                          <Text style={[styles.topicRevMeta, { color: colors.textTertiary }]}>
                            {isRevised
                              ? 'Revised'
                              : isNeedsRev
                              ? 'Needs Revision'
                              : 'Taught (Not Revised)'}{' '}
                            · {top.revisionCount || 0} revisions recorded
                          </Text>
                        </View>

                        <View style={styles.topicRevBtns}>
                          <Pressable
                            onPress={() =>
                              handleMarkTopicRevision(
                                top.id,
                                isRevised ? 'taught' : 'revised'
                              )
                            }
                            style={[
                              styles.topicRevToggleBtn,
                              {
                                backgroundColor: isRevised
                                  ? statusColors.safe + '26'
                                  : isDark
                                  ? 'rgba(255, 255, 255, 0.08)'
                                  : 'rgba(0, 0, 0, 0.05)',
                                borderColor: isRevised ? statusColors.safe : 'transparent',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.topicRevBtnText,
                                {
                                  color: isRevised ? statusColors.safe : colors.textSecondary,
                                },
                              ]}
                            >
                              {isRevised ? 'Revised' : 'Mark Revised'}
                            </Text>
                          </Pressable>

                          <Pressable
                            onPress={() =>
                              handleMarkTopicRevision(
                                top.id,
                                isNeedsRev ? 'taught' : 'needs_revision'
                              )
                            }
                            style={[
                              styles.topicRevToggleBtn,
                              {
                                backgroundColor: isNeedsRev
                                  ? statusColors.watch + '26'
                                  : isDark
                                  ? 'rgba(255, 255, 255, 0.08)'
                                  : 'rgba(0, 0, 0, 0.05)',
                                borderColor: isNeedsRev ? statusColors.watch : 'transparent',
                              },
                            ]}
                          >
                            <Text
                              style={[
                                styles.topicRevBtnText,
                                {
                                  color: isNeedsRev ? statusColors.watch : colors.textSecondary,
                                },
                              ]}
                            >
                              Needs Rev
                            </Text>
                          </Pressable>
                        </View>
                      </View>
                    );
                  })
                )}

                <Pressable onPress={() => setActiveView('overview')} style={styles.subViewDoneBtn}>
                  <Text style={styles.subViewDoneText}>Done</Text>
                </Pressable>
              </ScrollView>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              04 TOPICS COVERED (SYLLABUS CONNECTED)
          ════════════════════════════════════════════════════════════════════ */}
          {activeView === 'topics' && (
            <>
              {renderHeader('Topics Covered', true)}
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollBody}
              >
                <Text style={[styles.subViewHeader, { color: colors.text }]}>
                  Select the topics taught in this class from your syllabus
                </Text>

                {/* Search input */}
                <View
                  style={[
                    styles.searchRow,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.05)'
                        : 'rgba(0, 0, 0, 0.04)',
                      borderColor: isDark
                        ? 'rgba(255, 255, 255, 0.10)'
                        : 'rgba(0, 0, 0, 0.08)',
                    },
                  ]}
                >
                  <SearchIcon size={16} color={colors.textTertiary} />
                  <TextInput
                    style={[styles.searchInput, { color: colors.text }]}
                    placeholder="Search syllabus topics..."
                    placeholderTextColor={colors.textTertiary}
                    value={topicSearchQuery}
                    onChangeText={setTopicSearchQuery}
                  />
                  {topicSearchQuery ? (
                    <Pressable onPress={() => setTopicSearchQuery('')}>
                      <CloseIcon size={16} color={colors.textTertiary} />
                    </Pressable>
                  ) : null}
                </View>

                {/* Units & Topics hierarchy */}
                {units.length === 0 && allSubjectTopics.length === 0 ? (
                  <View
                    style={[
                      styles.emptyBox,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.04)'
                          : 'rgba(0, 0, 0, 0.02)',
                      },
                    ]}
                  >
                    <TopicBookIcon size={18} color={brand.violet} />
                    <Text style={[styles.emptyHintText, { color: colors.textSecondary }]}>
                      No syllabus topics added yet.
                    </Text>
                    <Pressable
                      onPress={() => {
                        onClose();
                        router.push(`/subject/${subjectId}`);
                      }}
                      style={styles.addTopicsHubBtn}
                    >
                      <Text style={styles.addTopicsHubText}>Add Topics in Subject Hub</Text>
                    </Pressable>
                  </View>
                ) : (
                  (units.length > 0
                    ? units
                    : [{ id: 'all-topics', name: 'Syllabus Topics', topicIds: allSubjectTopics.map(t => t.id) }]
                  ).map(unit => {
                    const unitTopics = allSubjectTopics
                      .filter(t => unit.topicIds.includes(t.id))
                      .filter(t =>
                        topicSearchQuery
                          ? t.name.toLowerCase().includes(topicSearchQuery.toLowerCase())
                          : true
                      );

                    if (unitTopics.length === 0) return null;

                    const unitSelectedCount = unitTopics.filter(t =>
                      selectedTopicIds.includes(t.id)
                    ).length;

                    return (
                      <View
                        key={unit.id}
                        style={[
                          styles.unitAccordion,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.04)'
                              : 'rgba(0, 0, 0, 0.02)',
                            borderColor: isDark
                              ? 'rgba(255, 255, 255, 0.08)'
                              : 'rgba(0, 0, 0, 0.06)',
                          },
                        ]}
                      >
                        <View style={styles.unitHeader}>
                          <Text style={[styles.unitTitle, { color: colors.text }]}>
                            {unit.name}
                          </Text>
                          <Text style={[styles.unitCountBadge, { color: brand.violet }]}>
                            {unitSelectedCount}/{unitTopics.length}
                          </Text>
                        </View>

                        <View style={styles.unitTopicList}>
                          {unitTopics.map(topic => {
                            const isSelected = selectedTopicIds.includes(topic.id);
                            return (
                              <Pressable
                                key={topic.id}
                                onPress={() => toggleTopic(topic.id)}
                                style={[
                                  styles.topicSelectRow,
                                  {
                                    backgroundColor: isSelected
                                      ? brand.violet + '18'
                                      : 'transparent',
                                  },
                                ]}
                              >
                                {isSelected ? (
                                  <CheckSquareIcon size={20} color={brand.violet} />
                                ) : (
                                  <EmptySquareIcon size={20} color={colors.textTertiary} />
                                )}
                                <View style={{ flex: 1 }}>
                                  <Text
                                    style={[
                                      styles.topicSelectName,
                                      { color: isSelected ? brand.violet : colors.text },
                                    ]}
                                  >
                                    {topic.name}
                                  </Text>
                                  {topic.lastTaughtAt ? (
                                    <Text
                                      style={[
                                        styles.topicPrevTaught,
                                        { color: colors.textTertiary },
                                      ]}
                                    >
                                      Previously taught on {topic.lastTaughtAt.split('T')[0]}
                                    </Text>
                                  ) : null}
                                </View>
                              </Pressable>
                            );
                          })}
                        </View>
                      </View>
                    );
                  })
                )}

                {/* Bottom guidance banner */}
                <View
                  style={[
                    styles.infoBanner,
                    {
                      backgroundColor: isDark
                        ? 'rgba(124, 58, 237, 0.10)'
                        : 'rgba(124, 58, 237, 0.06)',
                      borderColor: brand.violet + '40',
                    },
                  ]}
                >
                  <TopicBookIcon size={16} color={brand.violet} />
                  <Text style={[styles.infoBannerMeta, { color: colors.textSecondary }]}>
                    Selected topics ({selectedTopicIds.length}) will track revision progress and
                    find relevant study lectures automatically.
                  </Text>
                </View>

                <Pressable onPress={() => setActiveView('overview')} style={styles.subViewDoneBtn}>
                  <Text style={styles.subViewDoneText}>Save & Find Resources</Text>
                </Pressable>
              </ScrollView>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              05 YOUTUBE STUDY RECOMMENDATIONS
          ════════════════════════════════════════════════════════════════════ */}
          {activeView === 'youtube' && (
            <>
              {renderHeader('Study Recommendations', true)}
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollBody}
              >
                <Text style={[styles.subViewHeader, { color: colors.text }]}>
                  Based on your selected topics. Save directly to your resources.
                </Text>

                {/* Filter pills */}
                <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.recFilterRow}>
                  <Pressable
                    onPress={() => setSelectedRecTopicFilter('all')}
                    style={[
                      styles.filterPill,
                      {
                        backgroundColor:
                          selectedRecTopicFilter === 'all'
                            ? brand.violet
                            : isDark
                            ? 'rgba(255, 255, 255, 0.08)'
                            : 'rgba(0, 0, 0, 0.05)',
                      },
                    ]}
                  >
                    <Text
                      style={[
                        styles.filterPillText,
                        { color: selectedRecTopicFilter === 'all' ? '#FFF' : colors.textSecondary },
                      ]}
                    >
                      All Topics ({recommendations.length})
                    </Text>
                  </Pressable>

                  {selectedTopicIds.map(tid => {
                    const top = allSubjectTopics.find(t => t.id === tid);
                    if (!top) return null;
                    const isSelected = selectedRecTopicFilter === top.name;
                    return (
                      <Pressable
                        key={tid}
                        onPress={() => setSelectedRecTopicFilter(top.name)}
                        style={[
                          styles.filterPill,
                          {
                            backgroundColor: isSelected
                              ? brand.violet
                              : isDark
                              ? 'rgba(255, 255, 255, 0.08)'
                              : 'rgba(0, 0, 0, 0.05)',
                          },
                        ]}
                      >
                        <Text
                          style={[
                            styles.filterPillText,
                            { color: isSelected ? '#FFF' : colors.textSecondary },
                          ]}
                        >
                          {top.name}
                        </Text>
                      </Pressable>
                    );
                  })}
                </ScrollView>

                {loadingRecs ? (
                  <View style={styles.loadingBox}>
                    <ActivityIndicator size="large" color={brand.violet} />
                    <Text style={[styles.loadingText, { color: colors.textSecondary }]}>
                      Matching high-yield study lectures...
                    </Text>
                  </View>
                ) : recommendations.length === 0 ? (
                  <View
                    style={[
                      styles.emptyBox,
                      {
                        backgroundColor: isDark
                          ? 'rgba(255, 255, 255, 0.04)'
                          : 'rgba(0, 0, 0, 0.02)',
                      },
                    ]}
                  >
                    <YouTubeIcon size={24} color="#EF4444" />
                    <Text style={[styles.emptyHintText, { color: colors.textSecondary }]}>
                      No study suggestions available right now for the selected topics.
                    </Text>
                  </View>
                ) : (
                  recommendations
                    .filter(r =>
                      selectedRecTopicFilter === 'all'
                        ? true
                        : r.matchedTopics.some(mt =>
                            mt.toLowerCase().includes(selectedRecTopicFilter.toLowerCase())
                          )
                    )
                    .map(rec => {
                      const isAlreadyAttached = attachedResources.some(ar => ar.url === rec.url);
                      return (
                        <View
                          key={rec.videoId}
                          style={[
                            styles.recCard,
                            {
                              backgroundColor: isDark
                                ? 'rgba(255, 255, 255, 0.05)'
                                : 'rgba(0, 0, 0, 0.03)',
                              borderColor: isDark
                                ? 'rgba(255, 255, 255, 0.10)'
                                : 'rgba(0, 0, 0, 0.08)',
                            },
                          ]}
                        >
                          <View style={styles.recThumbnailWrapper}>
                            <Image
                              source={{ uri: rec.thumbnailUrl }}
                              style={styles.recThumbnail}
                              resizeMode="cover"
                            />
                            {rec.duration && (
                              <View style={styles.recDurationBadge}>
                                <Text style={styles.recDurationText}>{rec.duration}</Text>
                              </View>
                            )}
                          </View>

                          <View style={styles.recContent}>
                            <Text
                              style={[styles.recTitle, { color: colors.text }]}
                              numberOfLines={2}
                            >
                              {rec.title}
                            </Text>
                            <Text style={[styles.recChannel, { color: colors.textTertiary }]}>
                              {rec.channelTitle}
                            </Text>
                            <Text style={[styles.recReason, { color: brand.violet }]}>
                              Why recommended: {rec.reason}
                            </Text>

                            <View style={styles.recActionRow}>
                              <Pressable
                                onPress={() => Linking.openURL(rec.url)}
                                style={[
                                  styles.recOpenBtn,
                                  {
                                    borderColor: isDark
                                      ? 'rgba(255, 255, 255, 0.18)'
                                      : 'rgba(0, 0, 0, 0.15)',
                                  },
                                ]}
                              >
                                <ExternalOpenIcon size={12} color={colors.text} />
                                <Text style={[styles.recOpenBtnText, { color: colors.text }]}>
                                  Open
                                </Text>
                              </Pressable>

                              <Pressable
                                onPress={() => handleSaveYouTubeRecommendation(rec)}
                                disabled={isAlreadyAttached}
                                style={[
                                  styles.recSaveBtn,
                                  {
                                    backgroundColor: isAlreadyAttached
                                      ? statusColors.safe
                                      : brand.violet,
                                  },
                                ]}
                              >
                                <Text style={styles.recSaveBtnText}>
                                  {isAlreadyAttached ? 'Saved to Resources' : '+ Save to Resources'}
                                </Text>
                              </Pressable>
                            </View>
                          </View>
                        </View>
                      );
                    })
                )}

                <Pressable onPress={() => setActiveView('overview')} style={styles.subViewDoneBtn}>
                  <Text style={styles.subViewDoneText}>Done</Text>
                </Pressable>
              </ScrollView>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              06 MY CLASS JOURNAL / NOTES (EXPANDED + AI READY)
          ════════════════════════════════════════════════════════════════════ */}
          {activeView === 'notes' && (
            <>
              {renderHeader('My Class Journal', true)}
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollBody}
              >
                <Text style={[styles.subViewHeader, { color: colors.text }]}>
                  Your personal academic journal for this lecture
                </Text>

                {/* Formatting bar */}
                <View
                  style={[
                    styles.formatBar,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.05)'
                        : 'rgba(0, 0, 0, 0.03)',
                      borderColor: isDark
                        ? 'rgba(255, 255, 255, 0.10)'
                        : 'rgba(0, 0, 0, 0.08)',
                    },
                  ]}
                >
                  {['B', 'I', 'U', '• Bullet', 'f(x) Formula'].map(item => (
                    <Pressable
                      key={item}
                      onPress={() => setMyNotes(prev => `${prev}\n- `)}
                      style={styles.formatBtn}
                    >
                      <Text style={[styles.formatBtnText, { color: colors.textSecondary }]}>
                        {item}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                <TextInput
                  style={[
                    styles.textAreaExpanded,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.05)'
                        : 'rgba(0, 0, 0, 0.03)',
                      borderColor: isDark
                        ? 'rgba(255, 255, 255, 0.12)'
                        : 'rgba(0, 0, 0, 0.10)',
                      color: colors.text,
                    },
                  ]}
                  placeholder="Record your understanding, key derivations, steps, and questions asked in class..."
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  value={myNotes}
                  onChangeText={setMyNotes}
                />

                {/* AI Readiness Card */}
                <View
                  style={[
                    styles.aiCard,
                    {
                      backgroundColor: isDark
                        ? 'rgba(124, 58, 237, 0.10)'
                        : 'rgba(124, 58, 237, 0.05)',
                      borderColor: isDark
                        ? 'rgba(124, 58, 237, 0.30)'
                        : 'rgba(124, 58, 237, 0.18)',
                    },
                  ]}
                >
                  <View style={styles.aiCardHeader}>
                    <SparklesIcon size={16} color={brand.violet} />
                    <Text style={[styles.aiCardTitle, { color: colors.text }]}>
                      AI Summary Preparation
                    </Text>
                    <View style={styles.aiBadge}>
                      <Text style={styles.aiBadgeText}>READY FOR AI</Text>
                    </View>
                  </View>
                  <Text style={[styles.aiCardBody, { color: colors.textSecondary }]}>
                    Your notes, teacher announcements, and selected topics are structured with
                    canonical context hashes ready for synthesis when AI service is connected.
                  </Text>
                </View>

                <Pressable onPress={() => setActiveView('overview')} style={styles.subViewDoneBtn}>
                  <Text style={styles.subViewDoneText}>Done</Text>
                </Pressable>
              </ScrollView>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              07 TEACHER / BOARD NOTES
          ════════════════════════════════════════════════════════════════════ */}
          {activeView === 'teacher_notes' && (
            <>
              {renderHeader('Teacher Notes', true)}
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollBody}
              >
                <Text style={[styles.subViewHeader, { color: colors.text }]}>
                  Important points explicitly shared by teacher
                </Text>

                <TextInput
                  style={[
                    styles.textAreaExpanded,
                    {
                      backgroundColor: isDark
                        ? 'rgba(255, 255, 255, 0.05)'
                        : 'rgba(0, 0, 0, 0.03)',
                      borderColor: isDark
                        ? 'rgba(255, 255, 255, 0.12)'
                        : 'rgba(0, 0, 0, 0.10)',
                      color: colors.text,
                    },
                  ]}
                  placeholder="- Important for internal exam (10 marks)&#10;- Assignment submission next Tuesday&#10;- Focus on integrating factor method&#10;- Formula derivation required in mid-term..."
                  placeholderTextColor={colors.textTertiary}
                  multiline
                  value={teacherNotes}
                  onChangeText={setTeacherNotes}
                />

                <Pressable onPress={() => setActiveView('overview')} style={styles.subViewDoneBtn}>
                  <Text style={styles.subViewDoneText}>Done</Text>
                </Pressable>
              </ScrollView>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              08 RESOURCES (FILES, SCAN, LINK)
          ════════════════════════════════════════════════════════════════════ */}
          {activeView === 'resources' && (
            <>
              {renderHeader('Attached Resources', true)}
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollBody}
              >
                {/* Segmented sub-tabs */}
                <View style={styles.segmentedRow}>
                  {[
                    { key: 'files', label: 'Files / Scan' },
                    { key: 'link', label: 'Link / URL' },
                    { key: 'videos', label: recommendations.length > 0 ? `Videos (${recommendations.length})` : 'Videos' },
                    { key: 'saved', label: `Saved (${attachedResources.length})` },
                  ].map(tab => (
                    <Pressable
                      key={tab.key}
                      onPress={() => setResourceSubTab(tab.key as any)}
                      style={[
                        styles.segmentBtn,
                        resourceSubTab === tab.key && {
                          backgroundColor: brand.violet,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.segmentBtnText,
                          {
                            color: resourceSubTab === tab.key ? '#FFF' : colors.textSecondary,
                            fontWeight: resourceSubTab === tab.key ? '700' : '500',
                          },
                        ]}
                      >
                        {tab.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* SubTab A: Files / Scan */}
                {resourceSubTab === 'files' && (
                  <View style={{ gap: spacing.md }}>
                    <View style={styles.quickActionRow}>
                      <Pressable
                        onPress={handlePickDocument}
                        style={[
                          styles.quickActionCard,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.05)'
                              : 'rgba(0, 0, 0, 0.03)',
                            borderColor: isDark
                              ? 'rgba(255, 255, 255, 0.10)'
                              : 'rgba(0, 0, 0, 0.08)',
                          },
                        ]}
                      >
                        <AttachFileIcon size={24} color={brand.violet} />
                        <Text style={[styles.quickActionTitle, { color: colors.text }]}>
                          Attach File
                        </Text>
                        <Text style={[styles.quickActionSub, { color: colors.textTertiary }]}>
                          PDF, PPT, Word or any file
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={handleCaptureCameraPage}
                        style={[
                          styles.quickActionCard,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.05)'
                              : 'rgba(0, 0, 0, 0.03)',
                            borderColor: isDark
                              ? 'rgba(255, 255, 255, 0.10)'
                              : 'rgba(0, 0, 0, 0.08)',
                          },
                        ]}
                      >
                        <CameraScanIcon size={24} color={brand.violet} />
                        <Text style={[styles.quickActionTitle, { color: colors.text }]}>
                          Scan with Camera
                        </Text>
                        <Text style={[styles.quickActionSub, { color: colors.textTertiary }]}>
                          Multi-page lecture notes
                        </Text>
                      </Pressable>
                    </View>

                    <Pressable
                      onPress={handlePickGalleryPages}
                      style={[
                        styles.galleryActionBtn,
                        {
                          borderColor: isDark
                            ? 'rgba(255, 255, 255, 0.12)'
                            : 'rgba(0, 0, 0, 0.10)',
                        },
                      ]}
                    >
                      <GalleryPhotosIcon size={18} color={brand.violet} />
                      <Text style={[styles.galleryActionText, { color: colors.text }]}>
                        Select Photos from Gallery to Compile PDF
                      </Text>
                    </Pressable>

                    {/* Multi-page Scanned Notes Staging */}
                    {scannedPages.length > 0 && (
                      <View
                        style={[
                          styles.scannerBox,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.04)'
                              : 'rgba(0, 0, 0, 0.02)',
                            borderColor: brand.violet + '40',
                          },
                        ]}
                      >
                        <View style={styles.scannerHeaderRow}>
                          <Text style={[styles.scannerTitle, { color: colors.text }]}>
                            Scanned Pages ({scannedPages.length})
                          </Text>
                          <Pressable onPress={() => setScannedPages([])}>
                            <Text style={[styles.clearBtnText, { color: statusColors.danger }]}>
                              Clear
                            </Text>
                          </Pressable>
                        </View>

                        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.thumbnailRow}>
                          {scannedPages.map((page, index) => (
                            <View key={page.id} style={styles.thumbnailWrapper}>
                              <Image source={{ uri: page.uri }} style={styles.thumbnailImg} />
                              <View style={styles.pageNumberBadge}>
                                <Text style={styles.pageNumberText}>{index + 1}</Text>
                              </View>
                              <Pressable
                                onPress={() =>
                                  setScannedPages(prev => prev.filter(p => p.id !== page.id))
                                }
                                style={styles.removeThumbnailBtn}
                              >
                                <CloseIcon size={12} color="#FFF" />
                              </Pressable>
                            </View>
                          ))}
                        </ScrollView>

                        <TextInput
                          style={[
                            styles.fileNameInput,
                            {
                              color: colors.text,
                              borderColor: isDark
                                ? 'rgba(255, 255, 255, 0.12)'
                                : 'rgba(0, 0, 0, 0.10)',
                            },
                          ]}
                          value={scanPdfName}
                          onChangeText={setScanPdfName}
                          placeholder="Filename (e.g. Subject_Date_Notes.pdf)"
                          placeholderTextColor={colors.textTertiary}
                        />

                        <Pressable
                          onPress={handleCompileScannedPdf}
                          disabled={isCompilingPdf}
                          style={styles.compilePdfBtn}
                        >
                          {isCompilingPdf ? (
                            <ActivityIndicator size="small" color="#FFF" />
                          ) : (
                            <Text style={styles.compilePdfBtnText}>
                              Create & Attach PDF ({scannedPages.length} pages)
                            </Text>
                          )}
                        </Pressable>
                      </View>
                    )}

                    {/* Storage preference hint */}
                    <Pressable
                      onPress={() => setStorageSettingsVisible(true)}
                      style={[
                        styles.storageHintRow,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255, 255, 255, 0.04)'
                            : 'rgba(0, 0, 0, 0.02)',
                        },
                      ]}
                    >
                      <StorageHardDriveIcon size={14} color={colors.textTertiary} />
                      <Text style={[styles.storageHintText, { color: colors.textSecondary }]}>
                        Files saved to:{' '}
                        {fileStorageService.getStoragePreference().storageType === 'app_storage'
                          ? 'KaryaDEX App Storage'
                          : 'Custom Device Folder'}
                      </Text>
                      <Text style={[styles.changeStorageLink, { color: brand.violet }]}>
                        Change
                      </Text>
                    </Pressable>
                  </View>
                )}

                {/* SubTab B: Link / URL */}
                {resourceSubTab === 'link' && (
                  <View style={styles.linkFormBox}>
                    <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
                      RESOURCE TITLE
                    </Text>
                    <TextInput
                      style={[
                        styles.inputLine,
                        {
                          color: colors.text,
                          borderColor: isDark
                            ? 'rgba(255, 255, 255, 0.12)'
                            : 'rgba(0, 0, 0, 0.10)',
                        },
                      ]}
                      placeholder="e.g. Professor Lecture Drive, Online Syllabus"
                      placeholderTextColor={colors.textTertiary}
                      value={newResourceTitle}
                      onChangeText={setNewResourceTitle}
                    />

                    <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
                      WEB ADDRESS / URL
                    </Text>
                    <TextInput
                      style={[
                        styles.inputLine,
                        {
                          color: colors.text,
                          borderColor: urlValidationError
                            ? statusColors.danger
                            : isDark
                            ? 'rgba(255, 255, 255, 0.12)'
                            : 'rgba(0, 0, 0, 0.10)',
                        },
                      ]}
                      placeholder="https://drive.google.com/..."
                      placeholderTextColor={colors.textTertiary}
                      value={newResourceUrl}
                      onChangeText={setNewResourceUrl}
                      autoCapitalize="none"
                      keyboardType="url"
                    />

                    {urlValidationError && (
                      <Text style={styles.errorText}>{urlValidationError}</Text>
                    )}

                    <Pressable onPress={handleAddManualUrl} style={styles.attachLinkBtn}>
                      <Text style={styles.attachLinkBtnText}>Attach Link Resource</Text>
                    </Pressable>
                  </View>
                )}

                {/* SubTab: Recommended Study Videos (Section 7) */}
                {resourceSubTab === 'videos' && (
                  <View style={{ gap: spacing.sm }}>
                    {recommendations.length === 0 ? (
                      <View
                        style={[
                          styles.emptyBox,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.04)'
                              : 'rgba(0, 0, 0, 0.02)',
                          },
                        ]}
                      >
                        <YouTubeIcon size={24} color={colors.textTertiary} />
                        <Text style={[styles.emptyHintText, { color: colors.textSecondary }]}>
                          {selectedTopicIds.length === 0
                            ? 'Select syllabus topics in Topics tab to automatically fetch recommended lecture videos.'
                            : 'No video recommendations found for the selected topics.'}
                        </Text>
                      </View>
                    ) : (
                      recommendations.map(rec => {
                        const isAlreadyAttached = attachedResources.some(r => r.url === rec.url);
                        return (
                          <View
                            key={rec.videoId}
                            style={[
                              styles.recCard,
                              {
                                backgroundColor: isDark
                                  ? 'rgba(255, 255, 255, 0.05)'
                                  : 'rgba(0, 0, 0, 0.03)',
                                borderColor: isDark
                                  ? 'rgba(255, 255, 255, 0.10)'
                                  : 'rgba(0, 0, 0, 0.08)',
                              },
                            ]}
                          >
                            <View style={styles.recThumbnailWrapper}>
                              <Image source={{ uri: rec.thumbnailUrl }} style={styles.recThumbnail} />
                              {rec.duration && (
                                <View style={styles.recDurationBadge}>
                                  <Text style={styles.recDurationText}>{rec.duration}</Text>
                                </View>
                              )}
                            </View>

                            <View style={styles.recContent}>
                              <Text
                                style={[styles.recTitle, { color: colors.text }]}
                                numberOfLines={2}
                              >
                                {rec.title}
                              </Text>
                              <Text style={[styles.recChannel, { color: colors.textTertiary }]}>
                                {rec.channelTitle}
                              </Text>
                              <Text style={[styles.recReason, { color: brand.violet }]}>
                                Why recommended: {rec.reason}
                              </Text>

                              <View style={styles.recActionRow}>
                                <Pressable
                                  onPress={() => Linking.openURL(rec.url)}
                                  style={[
                                    styles.recOpenBtn,
                                    {
                                      borderColor: isDark
                                        ? 'rgba(255, 255, 255, 0.15)'
                                        : 'rgba(0, 0, 0, 0.12)',
                                    },
                                  ]}
                                >
                                  <ExternalOpenIcon size={12} color={colors.text} />
                                  <Text style={[styles.recOpenBtnText, { color: colors.text }]}>
                                    Open
                                  </Text>
                                </Pressable>

                                <Pressable
                                  onPress={() => handleSaveYouTubeRecommendation(rec)}
                                  disabled={isAlreadyAttached}
                                  style={[
                                    styles.recSaveBtn,
                                    {
                                      backgroundColor: isAlreadyAttached
                                        ? statusColors.safe
                                        : brand.violet,
                                    },
                                  ]}
                                >
                                  <Text style={styles.recSaveBtnText}>
                                    {isAlreadyAttached ? 'Saved to Resources' : '+ Save to Resources'}
                                  </Text>
                                </Pressable>
                              </View>
                            </View>
                          </View>
                        );
                      })
                    )}
                  </View>
                )}

                {/* SubTab C: Saved Resources List */}
                {resourceSubTab === 'saved' && (
                  <View style={{ gap: spacing.xs }}>
                    {attachedResources.length === 0 ? (
                      <View
                        style={[
                          styles.emptyBox,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.04)'
                              : 'rgba(0, 0, 0, 0.02)',
                          },
                        ]}
                      >
                        <Text style={[styles.emptyHintText, { color: colors.textSecondary }]}>
                          No resources attached yet.
                        </Text>
                      </View>
                    ) : (
                      attachedResources.map(res => (
                        <View
                          key={res.id}
                          style={[
                            styles.resourceCardFull,
                            {
                              backgroundColor: isDark
                                ? 'rgba(255, 255, 255, 0.05)'
                                : 'rgba(0, 0, 0, 0.03)',
                              borderColor: isDark
                                ? 'rgba(255, 255, 255, 0.10)'
                                : 'rgba(0, 0, 0, 0.08)',
                            },
                          ]}
                        >
                          <View style={styles.resourceCardIconCircle}>
                            {res.type === 'pdf' || res.type === 'scanned_pdf' ? (
                              <PdfDocumentIcon size={20} />
                            ) : res.type === 'youtube' ? (
                              <YouTubeIcon size={20} />
                            ) : res.type === 'url' ? (
                              <LinkWebIcon size={20} />
                            ) : (
                              <GenericFileIcon size={20} />
                            )}
                          </View>

                          <View style={{ flex: 1, gap: 2 }}>
                            <Text
                              style={[styles.resourceCardTitle, { color: colors.text }]}
                              numberOfLines={1}
                            >
                              {res.title}
                            </Text>
                            <Text
                              style={[styles.resourceCardMeta, { color: colors.textTertiary }]}
                            >
                              {res.type.toUpperCase()}{' '}
                              {res.fileSize
                                ? `· ${(res.fileSize / 1024).toFixed(1)} KB`
                                : res.source
                                ? `· ${res.source}`
                                : ''}
                            </Text>
                          </View>

                          <View style={styles.resourceCardActions}>
                            {res.url && (
                              <Pressable
                                onPress={() => Linking.openURL(res.url!)}
                                style={styles.resourceActionBtn}
                              >
                                <ExternalOpenIcon size={16} color={brand.violet} />
                              </Pressable>
                            )}
                            <Pressable
                              onPress={() => handleRemoveResource(res.id)}
                              style={styles.resourceActionBtn}
                            >
                              <TrashIcon size={16} color={statusColors.danger} />
                            </Pressable>
                          </View>
                        </View>
                      ))
                    )}
                  </View>
                )}

                <Pressable onPress={() => setActiveView('overview')} style={styles.subViewDoneBtn}>
                  <Text style={styles.subViewDoneText}>Done</Text>
                </Pressable>
              </ScrollView>
            </>
          )}

          {/* ════════════════════════════════════════════════════════════════════
              09 RELATED TASKS (FUNCTIONAL)
          ════════════════════════════════════════════════════════════════════ */}
          {activeView === 'tasks' && (
            <>
              {renderHeader('Related Tasks', true)}
              <ScrollView
                showsVerticalScrollIndicator={false}
                contentContainerStyle={styles.scrollBody}
              >
                <View style={styles.segmentedRow}>
                  {[
                    { key: 'linked', label: `Linked Tasks (${linkedTasks.length})` },
                    { key: 'create', label: '+ Create New' },
                    { key: 'link_existing', label: 'Link Existing' },
                  ].map(tab => (
                    <Pressable
                      key={tab.key}
                      onPress={() => setTaskSubTab(tab.key as any)}
                      style={[
                        styles.segmentBtn,
                        taskSubTab === tab.key && {
                          backgroundColor: brand.violet,
                        },
                      ]}
                    >
                      <Text
                        style={[
                          styles.segmentBtnText,
                          {
                            color: taskSubTab === tab.key ? '#FFF' : colors.textSecondary,
                            fontWeight: taskSubTab === tab.key ? '700' : '500',
                          },
                        ]}
                      >
                        {tab.label}
                      </Text>
                    </Pressable>
                  ))}
                </View>

                {/* SubTab A: Linked Tasks */}
                {taskSubTab === 'linked' && (
                  <View style={{ gap: spacing.xs }}>
                    {linkedTasks.length === 0 ? (
                      <View
                        style={[
                          styles.emptyBox,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.04)'
                              : 'rgba(0, 0, 0, 0.02)',
                          },
                        ]}
                      >
                        <TaskClipboardIcon size={18} color={brand.violet} />
                        <Text style={[styles.emptyHintText, { color: colors.textSecondary }]}>
                          No tasks linked to this class occurrence.
                        </Text>
                      </View>
                    ) : (
                      linkedTasks.map(task => (
                        <View
                          key={task.id}
                          style={[
                            styles.taskCardFull,
                            {
                              backgroundColor: isDark
                                ? 'rgba(255, 255, 255, 0.05)'
                                : 'rgba(0, 0, 0, 0.03)',
                              borderColor: isDark
                                ? 'rgba(255, 255, 255, 0.10)'
                                : 'rgba(0, 0, 0, 0.08)',
                            },
                          ]}
                        >
                          <Pressable
                            onPress={() => useAppStore.getState().toggleTask(task.id)}
                            style={styles.taskCheckTouch}
                          >
                            {task.isCompleted ? (
                              <CheckSquareIcon size={20} color={statusColors.safe} />
                            ) : (
                              <EmptySquareIcon size={20} color={colors.textTertiary} />
                            )}
                          </Pressable>

                          <View style={{ flex: 1, gap: 2 }}>
                            <Text
                              style={[
                                styles.taskCardTitle,
                                {
                                  color: task.isCompleted ? colors.textTertiary : colors.text,
                                  textDecorationLine: task.isCompleted ? 'line-through' : 'none',
                                },
                              ]}
                              numberOfLines={1}
                            >
                              {task.title}
                            </Text>
                            <View style={styles.taskMetaRow}>
                              <Text style={[styles.taskDueText, { color: colors.textTertiary }]}>
                                Due {task.dueDate || 'No due date'}
                              </Text>
                              <View
                                style={[
                                  styles.priorityBadge,
                                  {
                                    backgroundColor:
                                      task.priority === 'urgent' || task.priority === 'high'
                                        ? statusColors.danger + '20'
                                        : brand.violet + '18',
                                  },
                                ]}
                              >
                                <Text
                                  style={[
                                    styles.priorityText,
                                    {
                                      color:
                                        task.priority === 'urgent' || task.priority === 'high'
                                          ? statusColors.danger
                                          : brand.violet,
                                    },
                                  ]}
                                >
                                  {task.priority.toUpperCase()}
                                </Text>
                              </View>
                            </View>
                          </View>

                          <Pressable
                            onPress={() => handleUnlinkTask(task.id)}
                            style={styles.unlinkBtn}
                          >
                            <Text style={styles.unlinkBtnText}>Unlink</Text>
                          </Pressable>
                        </View>
                      ))
                    )}
                  </View>
                )}

                {/* SubTab B: Create New Task */}
                {taskSubTab === 'create' && (
                  <View style={styles.taskForm}>
                    <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
                      TASK TITLE *
                    </Text>
                    <TextInput
                      style={[
                        styles.inputLine,
                        {
                          color: colors.text,
                          borderColor: isDark
                            ? 'rgba(255, 255, 255, 0.12)'
                            : 'rgba(0, 0, 0, 0.10)',
                        },
                      ]}
                      placeholder="e.g. Solve Tutorial Sheet 4, Practice PYQ 2024"
                      placeholderTextColor={colors.textTertiary}
                      value={newTaskTitle}
                      onChangeText={setNewTaskTitle}
                    />

                    <View style={styles.formRowTwo}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
                          DUE DATE
                        </Text>
                        <TextInput
                          style={[
                            styles.inputLine,
                            {
                              color: colors.text,
                              borderColor: isDark
                                ? 'rgba(255, 255, 255, 0.12)'
                                : 'rgba(0, 0, 0, 0.10)',
                            },
                          ]}
                          placeholder="YYYY-MM-DD"
                          placeholderTextColor={colors.textTertiary}
                          value={newTaskDueDate}
                          onChangeText={setNewTaskDueDate}
                        />
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
                          DUE TIME (OPTIONAL)
                        </Text>
                        <TextInput
                          style={[
                            styles.inputLine,
                            {
                              color: colors.text,
                              borderColor: isDark
                                ? 'rgba(255, 255, 255, 0.12)'
                                : 'rgba(0, 0, 0, 0.10)',
                            },
                          ]}
                          placeholder="e.g. 11:59 PM"
                          placeholderTextColor={colors.textTertiary}
                          value={newTaskDueTime}
                          onChangeText={setNewTaskDueTime}
                        />
                      </View>
                    </View>

                    <View style={styles.formRowTwo}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
                          PRIORITY
                        </Text>
                        <View style={styles.prioritySelector}>
                          {(['low', 'medium', 'high', 'urgent'] as TaskPriority[]).map(p => (
                            <Pressable
                              key={p}
                              onPress={() => setNewTaskPriority(p)}
                              style={[
                                styles.priorityChoiceBtn,
                                newTaskPriority === p && {
                                  backgroundColor: brand.violet,
                                },
                              ]}
                            >
                              <Text
                                style={[
                                  styles.priorityChoiceText,
                                  { color: newTaskPriority === p ? '#FFF' : colors.textSecondary },
                                ]}
                              >
                                {p[0].toUpperCase()}
                              </Text>
                            </Pressable>
                          ))}
                        </View>
                      </View>

                      <View style={{ flex: 1 }}>
                        <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
                          EST. TIME (MIN)
                        </Text>
                        <TextInput
                          style={[
                            styles.inputLine,
                            {
                              color: colors.text,
                              borderColor: isDark
                                ? 'rgba(255, 255, 255, 0.12)'
                                : 'rgba(0, 0, 0, 0.10)',
                            },
                          ]}
                          placeholder="e.g. 45"
                          placeholderTextColor={colors.textTertiary}
                          value={newTaskMinutes}
                          onChangeText={setNewTaskMinutes}
                          keyboardType="numeric"
                        />
                      </View>
                    </View>

                    <Text style={[styles.formLabel, { color: colors.textSecondary }]}>
                      NOTES / DETAILS
                    </Text>
                    <TextInput
                      style={[
                        styles.textAreaSmall,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255, 255, 255, 0.05)'
                            : 'rgba(0, 0, 0, 0.03)',
                          borderColor: isDark
                            ? 'rgba(255, 255, 255, 0.12)'
                            : 'rgba(0, 0, 0, 0.10)',
                          color: colors.text,
                        },
                      ]}
                      placeholder="Specific questions to complete, submission guidelines..."
                      placeholderTextColor={colors.textTertiary}
                      value={newTaskNotes}
                      onChangeText={setNewTaskNotes}
                    />

                    <Pressable onPress={handleCreateTask} style={styles.createTaskSaveBtn}>
                      <Text style={styles.createTaskSaveBtnText}>Create & Link to Session</Text>
                    </Pressable>
                  </View>
                )}

                {/* SubTab C: Link Existing Task */}
                {taskSubTab === 'link_existing' && (
                  <View style={{ gap: spacing.sm }}>
                    <View
                      style={[
                        styles.searchRow,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255, 255, 255, 0.05)'
                            : 'rgba(0, 0, 0, 0.04)',
                          borderColor: isDark
                            ? 'rgba(255, 255, 255, 0.10)'
                            : 'rgba(0, 0, 0, 0.08)',
                        },
                      ]}
                    >
                      <SearchIcon size={16} color={colors.textTertiary} />
                      <TextInput
                        style={[styles.searchInput, { color: colors.text }]}
                        placeholder="Search existing tasks..."
                        placeholderTextColor={colors.textTertiary}
                        value={taskSearchQuery}
                        onChangeText={setTaskSearchQuery}
                      />
                    </View>

                    {unlinkedAvailableTasks.length === 0 ? (
                      <View
                        style={[
                          styles.emptyBox,
                          {
                            backgroundColor: isDark
                              ? 'rgba(255, 255, 255, 0.04)'
                              : 'rgba(0, 0, 0, 0.02)',
                          },
                        ]}
                      >
                        <Text style={[styles.emptyHintText, { color: colors.textSecondary }]}>
                          No unlinked tasks available to link.
                        </Text>
                      </View>
                    ) : (
                      unlinkedAvailableTasks.map(t => (
                        <View
                          key={t.id}
                          style={[
                            styles.taskCardFull,
                            {
                              backgroundColor: isDark
                                ? 'rgba(255, 255, 255, 0.05)'
                                : 'rgba(0, 0, 0, 0.03)',
                              borderColor: isDark
                                ? 'rgba(255, 255, 255, 0.10)'
                                : 'rgba(0, 0, 0, 0.08)',
                            },
                          ]}
                        >
                          <View style={{ flex: 1, gap: 2 }}>
                            <Text
                              style={[styles.taskCardTitle, { color: colors.text }]}
                              numberOfLines={1}
                            >
                              {t.title}
                            </Text>
                            <Text style={[styles.taskDueText, { color: colors.textTertiary }]}>
                              Due {t.dueDate || 'No date'}
                            </Text>
                          </View>

                          <Pressable
                            onPress={() => handleLinkExistingTask(t)}
                            style={styles.linkActionBtn}
                          >
                            <Text style={styles.linkActionBtnText}>+ Link</Text>
                          </Pressable>
                        </View>
                      ))
                    )}
                  </View>
                )}

                <Pressable onPress={() => setActiveView('overview')} style={styles.subViewDoneBtn}>
                  <Text style={styles.subViewDoneText}>Done</Text>
                </Pressable>
              </ScrollView>
            </>
          )}

          {/* Storage Settings Sub-Modal */}
          <StorageSettingsModal
            visible={storageSettingsVisible}
            onClose={() => setStorageSettingsVisible(false)}
          />
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}

const styles = StyleSheet.create({
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    alignItems: 'center',
  },
  backdrop: {
    ...StyleSheet.absoluteFill,
    backgroundColor: 'rgba(0, 0, 0, 0.65)',
  },
  modalSheet: {
    width: '100%',
    maxWidth: Platform.OS === 'web' ? 760 : undefined,
    maxHeight: '92%',
    borderTopLeftRadius: radii['2xl'],
    borderTopRightRadius: radii['2xl'],
    borderWidth: 1,
    paddingTop: spacing.base,
    paddingHorizontal: spacing.base,
    paddingBottom: Platform.OS === 'ios' ? 36 : spacing.lg,
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 -10px 40px rgba(0, 0, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
        }
      : {}),
  },
  header: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    justifyContent: 'space-between',
    paddingBottom: spacing.sm,
    borderBottomWidth: StyleSheet.hairlineWidth,
    borderBottomColor: 'rgba(255, 255, 255, 0.12)',
  },
  subjectBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  colorDot: {
    width: 10,
    height: 10,
    borderRadius: 5,
  },
  subjectName: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    maxWidth: 240,
  },
  typeBadge: {
    paddingHorizontal: spacing.xs,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  typeBadgeText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
  metaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    marginTop: 4,
  },
  metaText: {
    fontSize: typography.sizes.xs,
  },
  metaDot: {
    fontSize: typography.sizes.xs,
    marginHorizontal: 2,
  },
  headerActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  headerBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.md,
    backgroundColor: 'rgba(124, 58, 237, 0.12)',
  },
  backBtnText: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
  },
  closeBtn: {
    padding: spacing.xs,
    borderRadius: radii.full,
  },
  scrollBody: {
    paddingTop: spacing.md,
    paddingBottom: spacing.xl,
    gap: spacing.md,
  },
  section: {
    gap: spacing.xs,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.6,
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  subLink: {
    fontSize: 12,
    fontWeight: typography.weights.semibold,
  },
  pillRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 4,
  },
  attPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: spacing.sm,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  attPillSelected: {
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 0 12px rgba(16, 185, 129, 0.25)',
        }
      : {}),
  },
  attPillText: {
    fontSize: 12,
    fontWeight: typography.weights.semibold,
  },
  revCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radii.xl,
    marginTop: 2,
  },
  revCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
  },
  progressCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 3,
    alignItems: 'center',
    justifyContent: 'center',
  },
  progressNumber: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
  },
  revMainText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  revSubText: {
    fontSize: 11,
  },
  revCardRight: {
    alignItems: 'flex-end',
  },
  backlogPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
  },
  backlogText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
  },
  safePill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.full,
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
  },
  safeText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
  },
  emptyBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  emptyHintText: {
    fontSize: 12,
    flex: 1,
  },
  topicsGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginTop: 4,
  },
  topicChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  topicChipText: {
    fontSize: 12,
    fontWeight: typography.weights.semibold,
  },
  ytBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  ytBannerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    flex: 1,
  },
  ytBannerTitle: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
  },
  ytBannerSub: {
    fontSize: 11,
  },
  textArea: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.sm,
    fontSize: 13,
    textAlignVertical: 'top',
    minHeight: 80,
  },
  textAreaSmall: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.sm,
    fontSize: 13,
    textAlignVertical: 'top',
    minHeight: 56,
  },
  resourceList: {
    gap: spacing.xs,
    marginTop: 2,
  },
  resourceItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  resourceTitle: {
    fontSize: 12,
    fontWeight: typography.weights.semibold,
  },
  resourceMeta: {
    fontSize: 10,
  },
  taskList: {
    gap: spacing.xs,
    marginTop: 2,
  },
  taskItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  taskName: {
    fontSize: 12,
    fontWeight: typography.weights.medium,
    flex: 1,
  },
  taskDue: {
    fontSize: 10,
  },
  actionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginTop: spacing.sm,
  },
  saveBtn: {
    flex: 2,
    paddingVertical: spacing.md,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
  },
  btnContentRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  hubBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
  },
  hubBtnText: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  // Subview generic styles
  subViewHeader: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.xs,
  },
  subViewDoneBtn: {
    backgroundColor: brand.violet,
    paddingVertical: spacing.md,
    borderRadius: radii.xl,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: spacing.md,
  },
  subViewDoneText: {
    color: '#FFF',
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  // Attendance Subview
  attCardList: {
    gap: spacing.sm,
  },
  attSelectCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  attCardSelected: {
    ...(Platform.OS === 'web'
      ? {
          boxShadow: '0 4px 16px rgba(124, 58, 237, 0.15)',
        }
      : {}),
  },
  attCardLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.md,
    flex: 1,
  },
  attCardIconCircle: {
    width: 40,
    height: 40,
    borderRadius: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  attCardTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.bold,
  },
  attCardSublabel: {
    fontSize: 11,
  },
  radioCircle: {
    width: 20,
    height: 20,
    borderRadius: 10,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  radioInnerDot: {
    width: 8,
    height: 8,
    borderRadius: 4,
    backgroundColor: '#FFF',
  },
  // Revision Subview
  revDetailCardRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  revMetricBox: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  revMetricNum: {
    fontSize: 26,
    fontWeight: typography.weights.bold,
  },
  revMetricLabel: {
    fontSize: 12,
    fontWeight: typography.weights.semibold,
  },
  revMetricSub: {
    fontSize: 10,
    textAlign: 'center',
  },
  infoBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  infoBannerTitle: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
  },
  infoBannerMeta: {
    fontSize: 11,
    lineHeight: 16,
  },
  subSectionTitle: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.6,
    marginTop: spacing.xs,
  },
  topicRevRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
    gap: spacing.sm,
  },
  topicRevName: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
  },
  topicRevMeta: {
    fontSize: 10,
  },
  topicRevBtns: {
    flexDirection: 'row',
    gap: 6,
  },
  topicRevToggleBtn: {
    paddingHorizontal: 8,
    paddingVertical: 5,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  topicRevBtnText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
  // Topics Subview
  searchRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  searchInput: {
    flex: 1,
    fontSize: 12,
    padding: 0,
  },
  addTopicsHubBtn: {
    backgroundColor: brand.violet,
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.sm,
    marginTop: spacing.xs,
  },
  addTopicsHubText: {
    color: '#FFF',
    fontSize: 11,
    fontWeight: typography.weights.bold,
  },
  unitAccordion: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.sm,
    gap: spacing.xs,
  },
  unitHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 4,
    paddingVertical: 4,
  },
  unitTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
  },
  unitCountBadge: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
  },
  unitTopicList: {
    gap: 2,
  },
  topicSelectRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    paddingVertical: 8,
    paddingHorizontal: spacing.sm,
    borderRadius: radii.md,
  },
  topicSelectName: {
    fontSize: 12,
    fontWeight: typography.weights.semibold,
  },
  topicPrevTaught: {
    fontSize: 10,
  },
  // YouTube Subview
  recFilterRow: {
    flexDirection: 'row',
    marginBottom: spacing.xs,
  },
  filterPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.full,
    marginRight: spacing.xs,
  },
  filterPillText: {
    fontSize: 11,
    fontWeight: typography.weights.semibold,
  },
  loadingBox: {
    padding: spacing.xl,
    alignItems: 'center',
    gap: spacing.sm,
  },
  loadingText: {
    fontSize: 12,
  },
  recCard: {
    flexDirection: 'row',
    borderRadius: radii.xl,
    borderWidth: 1,
    overflow: 'hidden',
    gap: spacing.sm,
    padding: spacing.sm,
  },
  recThumbnailWrapper: {
    width: 110,
    height: 75,
    borderRadius: radii.md,
    overflow: 'hidden',
    position: 'relative',
    backgroundColor: '#000',
  },
  recThumbnail: {
    width: '100%',
    height: '100%',
  },
  recDurationBadge: {
    position: 'absolute',
    bottom: 4,
    right: 4,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    paddingHorizontal: 4,
    paddingVertical: 1,
    borderRadius: 3,
  },
  recDurationText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: typography.weights.bold,
  },
  recContent: {
    flex: 1,
    gap: 3,
  },
  recTitle: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
    lineHeight: 16,
  },
  recChannel: {
    fontSize: 10,
  },
  recReason: {
    fontSize: 10,
    fontWeight: typography.weights.semibold,
  },
  recActionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    marginTop: 4,
  },
  recOpenBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  recOpenBtnText: {
    fontSize: 10,
    fontWeight: typography.weights.semibold,
  },
  recSaveBtn: {
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  recSaveBtnText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
  // Notes Subview
  formatBar: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.xs,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  formatBtn: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  formatBtnText: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
  },
  textAreaExpanded: {
    borderRadius: radii.lg,
    borderWidth: 1,
    padding: spacing.md,
    fontSize: 13,
    textAlignVertical: 'top',
    minHeight: 180,
    lineHeight: 20,
  },
  aiCard: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.md,
    gap: 6,
  },
  aiCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  aiCardTitle: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
    flex: 1,
  },
  aiBadge: {
    backgroundColor: 'rgba(124, 58, 237, 0.18)',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: radii.sm,
  },
  aiBadgeText: {
    color: brand.violet,
    fontSize: 9,
    fontWeight: typography.weights.bold,
  },
  aiCardBody: {
    fontSize: 11,
    lineHeight: 16,
  },
  // Resources Subview
  segmentedRow: {
    flexDirection: 'row',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderRadius: radii.xl,
    padding: 3,
    gap: 2,
  },
  segmentBtn: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: radii.lg,
    alignItems: 'center',
    justifyContent: 'center',
  },
  segmentBtnText: {
    fontSize: 12,
  },
  quickActionRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  quickActionCard: {
    flex: 1,
    padding: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    alignItems: 'center',
    gap: 4,
  },
  quickActionTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: typography.weights.bold,
    marginTop: 2,
  },
  quickActionSub: {
    fontSize: 10,
    textAlign: 'center',
  },
  galleryActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  galleryActionText: {
    fontSize: 12,
    fontWeight: typography.weights.semibold,
  },
  scannerBox: {
    borderRadius: radii.xl,
    borderWidth: 1,
    padding: spacing.md,
    gap: spacing.sm,
  },
  scannerHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  scannerTitle: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
  },
  clearBtnText: {
    fontSize: 11,
    fontWeight: typography.weights.semibold,
  },
  thumbnailRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  thumbnailWrapper: {
    width: 64,
    height: 80,
    borderRadius: radii.md,
    overflow: 'hidden',
    position: 'relative',
    marginRight: spacing.xs,
    backgroundColor: '#000',
  },
  thumbnailImg: {
    width: '100%',
    height: '100%',
  },
  pageNumberBadge: {
    position: 'absolute',
    bottom: 2,
    left: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    paddingHorizontal: 4,
    borderRadius: 2,
  },
  pageNumberText: {
    color: '#FFF',
    fontSize: 9,
    fontWeight: 'bold',
  },
  removeThumbnailBtn: {
    position: 'absolute',
    top: 2,
    right: 2,
    backgroundColor: 'rgba(0, 0, 0, 0.75)',
    borderRadius: radii.full,
    padding: 2,
  },
  fileNameInput: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    fontSize: 12,
  },
  compilePdfBtn: {
    backgroundColor: brand.violet,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  compilePdfBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: typography.weights.bold,
  },
  storageHintRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: spacing.sm,
    borderRadius: radii.md,
  },
  storageHintText: {
    fontSize: 11,
    flex: 1,
  },
  changeStorageLink: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
  },
  linkFormBox: {
    gap: spacing.xs,
  },
  formLabel: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
    marginTop: 4,
  },
  inputLine: {
    borderRadius: radii.md,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: 8,
    fontSize: 12,
  },
  errorText: {
    color: statusColors.danger,
    fontSize: 11,
    marginTop: 2,
  },
  attachLinkBtn: {
    backgroundColor: brand.violet,
    paddingVertical: spacing.sm,
    borderRadius: radii.md,
    alignItems: 'center',
    marginTop: spacing.xs,
  },
  attachLinkBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: typography.weights.bold,
  },
  resourceCardFull: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  resourceCardIconCircle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  resourceCardTitle: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
  },
  resourceCardMeta: {
    fontSize: 10,
  },
  resourceCardActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  resourceActionBtn: {
    padding: spacing.xs,
  },
  // Tasks Subview
  taskCardFull: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.sm,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  taskCheckTouch: {
    padding: 2,
  },
  taskCardTitle: {
    fontSize: 12,
    fontWeight: typography.weights.bold,
  },
  taskMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
  },
  taskDueText: {
    fontSize: 10,
  },
  priorityBadge: {
    paddingHorizontal: 5,
    paddingVertical: 1,
    borderRadius: 3,
  },
  priorityText: {
    fontSize: 9,
    fontWeight: typography.weights.bold,
  },
  unlinkBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
  },
  unlinkBtnText: {
    color: statusColors.danger,
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
  taskForm: {
    gap: spacing.xs,
  },
  formRowTwo: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  prioritySelector: {
    flexDirection: 'row',
    gap: 4,
    marginTop: 2,
  },
  priorityChoiceBtn: {
    flex: 1,
    paddingVertical: 7,
    borderRadius: radii.sm,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  priorityChoiceText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
  createTaskSaveBtn: {
    backgroundColor: brand.violet,
    paddingVertical: spacing.sm,
    borderRadius: radii.lg,
    alignItems: 'center',
    marginTop: spacing.sm,
  },
  createTaskSaveBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: typography.weights.bold,
  },
  linkActionBtn: {
    backgroundColor: brand.violet,
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  linkActionBtnText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
  recSectionInResources: {
    marginTop: spacing.md,
    paddingTop: spacing.sm,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  recHeaderRowInResources: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: 4,
  },
  recSectionTitleInResources: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
  },
  recItemSmall: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    borderRadius: radii.lg,
    borderWidth: 1,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs + 2,
    gap: spacing.sm,
  },
  recItemSmallLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs + 2,
    flex: 1,
  },
  recItemSmallTitle: {
    fontSize: 12,
    fontWeight: typography.weights.semibold,
  },
  recItemSmallMeta: {
    fontSize: 10,
    marginTop: 1,
  },
  recItemSmallActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  recItemSmallOpenBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  recItemSmallOpenText: {
    fontSize: 10,
    fontWeight: typography.weights.medium,
  },
  recItemSmallSaveBtn: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: radii.sm,
  },
  recItemSmallSaveText: {
    color: '#FFF',
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
});
