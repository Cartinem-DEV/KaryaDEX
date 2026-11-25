/**
 * KaryaDEX — Onboarding Step 7: Timetable Setup
 *
 * Supports rapid manual recurring class entry AND optional Banku AI routine extraction
 * with editable preview, conflict detection, and cancel/skip options.
 */

import React, { useState } from 'react';
import {
  View,
  Text,
  TextInput,
  StyleSheet,
  Pressable,
  ScrollView,
  Modal,
  ActivityIndicator,
  Alert,
  Image,
} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '@/constants/ThemeContext';
import { brand, typography, radii } from '@/constants/theme';
import { GlassCard, LuminousButton } from '@/components/ui';
import { Feather } from '@expo/vector-icons';

import { MASCOT_ASSETS } from '@/constants/mascots';
import {
  AddIcon,
  TrashIcon,
  AlertTriangleIcon,
  CalendarIcon,
  TimeIcon,
  RoomIcon,
  SparklesIcon,
  CheckSquareIcon,
  EmptySquareIcon,
  CloseIcon,
} from '@/components/ui/AcademicIcons';
import type { SubjectDraft, TimetableSlotDraft, TimetableConflict } from '@/types/onboarding';
import { onboardingService } from '@/services/onboardingService';
import { TimetableExtractionFeature } from '@/services/ai';
import { fileAssetToBase64, extractMagicBytesFromBase64, readFileAsset, validatePdfPageLimit } from '@/lib/fileUtils';

const DAYS_OF_WEEK = ['monday', 'tuesday', 'wednesday', 'thursday', 'friday', 'saturday'];
const CLASS_TYPES: Array<'lecture' | 'lab' | 'tutorial'> = ['lecture', 'lab', 'tutorial'];

interface EditableExtractedSlot {
  tempId: string;
  subjectId: string;
  dayOfWeek: string;
  startTime: string;
  endTime: string;
  room?: string;
  teacher?: string;
  type: 'lecture' | 'lab' | 'tutorial';
  selected: boolean;
  conflictWarning?: string;
}

interface StepTimetableProps {
  subjects: SubjectDraft[];
  initialSlots?: TimetableSlotDraft[];
  onNext: (slots: TimetableSlotDraft[]) => void;
  onSkip: () => void;
  onBack: () => void;
}

export function StepTimetable({
  subjects,
  initialSlots = [],
  onNext,
  onSkip,
  onBack,
}: StepTimetableProps) {
  const { colors, isDark } = useTheme();
  const [slots, setSlots] = useState<TimetableSlotDraft[]>(initialSlots);

  // Manual Form fields
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(subjects[0]?.id || '');
  const [dayOfWeek, setDayOfWeek] = useState<string>('monday');
  const [startTime, setStartTime] = useState<string>('09:00');
  const [endTime, setEndTime] = useState<string>('10:00');
  const [room, setRoom] = useState<string>('');
  const [type, setType] = useState<'lecture' | 'lab' | 'tutorial'>('lecture');
  const [teacher, setTeacher] = useState<string>('');

  const [conflictWarning, setConflictWarning] = useState<TimetableConflict | null>(null);
  const [error, setError] = useState<string | null>(null);

  // Banku AI Import State
  const [isExtracting, setIsExtracting] = useState(false);
  const [extractedSlots, setExtractedSlots] = useState<EditableExtractedSlot[]>([]);
  const [showPreviewModal, setShowPreviewModal] = useState(false);

  const handleBankuImport = async () => {
    try {
      const res = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) return;

      const asset = res.assets[0];
      const isPdf = asset.name?.toLowerCase().endsWith('.pdf') || asset.mimeType?.toLowerCase().includes('pdf');
      if (isPdf) {
        const pageCheck = await validatePdfPageLimit(asset.file || asset, 40);
        if (!pageCheck.valid) {
          const warningMsg = "Document too large (exceeds 40 pages). Please upload only the specific routine, syllabus, or calendar pages.";
          setError(warningMsg);
          Alert.alert("Document Too Large", warningMsg);
          return;
        }
      }
      setIsExtracting(true);
      setError(null);

      const { base64, mimeType: parsedMime } = await readFileAsset(asset);
      const resolvedMime = parsedMime || asset.mimeType || 'image/jpeg';
      const magic = extractMagicBytesFromBase64(base64);

      const result = await TimetableExtractionFeature.extractTimetableProposal({
        userId: 'onboarding-student',
        fileBase64: base64,
        fileMimeType: resolvedMime,
        fileName: asset.name || (resolvedMime.includes('pdf') ? 'routine.pdf' : 'routine.jpg'),
        fileSizeBytes: asset.size || Math.round((base64.length * 3) / 4),
        magicBytes: magic,
      });

      const items: EditableExtractedSlot[] = result.data.map((slot, index) => {
        const norm = slot.subjectName.toLowerCase().trim();
        const matched = subjects.find(
          s =>
            s.name.toLowerCase().trim() === norm ||
            s.shortName?.toLowerCase().trim() === norm ||
            s.code.toLowerCase().trim() === (slot.subjectCode || norm)
        );
        const resolvedSubjectId = matched ? matched.id : subjects[0]?.id || '';

        return {
          tempId: `ext-${index}-${Date.now()}`,
          subjectId: resolvedSubjectId,
          dayOfWeek: slot.dayOfWeek.toLowerCase(),
          startTime: slot.startTime,
          endTime: slot.endTime,
          room: slot.room || '',
          teacher: slot.teacher || '',
          type: (slot.type as any) || 'lecture',
          selected: true,
          conflictWarning: slot.conflictWarning,
        };
      });

      if (items.length === 0) {
        setError('No timetable slots could be detected in the provided file. You can enter them manually below.');
      } else {
        setExtractedSlots(items);
        setShowPreviewModal(true);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to extract routine with Banku.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleConfirmExtractedSlots = () => {
    const selected = extractedSlots.filter(s => s.selected);
    if (selected.length === 0) {
      setShowPreviewModal(false);
      return;
    }

    const newSlots: TimetableSlotDraft[] = selected.map(s => ({
      id: `ts-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      subjectId: s.subjectId,
      dayOfWeek: s.dayOfWeek,
      startTime: s.startTime,
      endTime: s.endTime,
      room: s.room || undefined,
      type: s.type,
      teacher: s.teacher || undefined,
    }));

    setSlots(prev => [...prev, ...newSlots]);
    setShowPreviewModal(false);
    setExtractedSlots([]);
  };

  const handleDiscardExtractedSlots = () => {
    setShowPreviewModal(false);
    setExtractedSlots([]);
  };

  const handleAddSlot = () => {
    if (!selectedSubjectId) {
      setError('Please select a subject.');
      return;
    }
    if (!startTime || !endTime) {
      setError('Start time and end time are required.');
      return;
    }
    if (endTime <= startTime) {
      setError('End time must be after start time.');
      return;
    }
    setError(null);

    const draftSlot: TimetableSlotDraft = {
      id: `ts-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      subjectId: selectedSubjectId,
      dayOfWeek,
      startTime: startTime.trim(),
      endTime: endTime.trim(),
      room: room.trim() || undefined,
      type,
      teacher: teacher.trim() || undefined,
    };

    // Check conflict
    const conflict = onboardingService.checkTimetableConflict(slots, draftSlot, subjects);
    if (conflict && !conflictWarning) {
      setConflictWarning(conflict);
      return;
    }

    // Add slot (or confirm despite conflict)
    setSlots([...slots, draftSlot]);
    setConflictWarning(null);

    // Auto-advance start & end time for next entry convenience
    const [startH, startM] = startTime.split(':').map(Number);
    const [endH, endM] = endTime.split(':').map(Number);
    const durationMins = (endH * 60 + endM) - (startH * 60 + startM);
    if (durationMins > 0) {
      const nextStartH = endH;
      const nextStartM = endM;
      const nextEndTotal = nextStartH * 60 + nextStartM + durationMins;
      const nextEndH = Math.floor(nextEndTotal / 60);
      const nextEndM = nextEndTotal % 60;
      if (nextEndH < 24) {
        setStartTime(`${String(nextStartH).padStart(2, '0')}:${String(nextStartM).padStart(2, '0')}`);
        setEndTime(`${String(nextEndH).padStart(2, '0')}:${String(nextEndM).padStart(2, '0')}`);
      }
    }
  };

  const handleRemoveSlot = (id: string) => {
    setSlots(slots.filter(s => s.id !== id));
  };

  const handleContinue = () => {
    onNext(slots);
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: colors.text }]}>Add Timetable</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>
          Build your weekly recurring schedule. You can scan with Banku or add classes manually.
        </Text>
      </View>

      {/* ─── Banku AI Routine Import Banner ─── */}
      <GlassCard level="secondary" style={styles.bankuCard}>
        <View style={styles.cardSpecularRim} />
        <View style={styles.bankuHeader}>
          <Image source={MASCOT_ASSETS.banku.avatar} style={styles.bankuAvatarImg} resizeMode="contain" />
          <View style={{ flex: 1, gap: 2 }}>
            <View style={styles.bankuBadgeRow}>
              <Text style={styles.bankuTitleText}>BANKU</Text>
              <View style={styles.bankuBadge}>
                <Text style={styles.bankuBadgeText}>VISION AI</Text>
              </View>
            </View>
            <Text style={styles.bankuTelemetryText}>
              LIVE TELEMETRY • SCANNING TIMETABLE & SYLLABUS
            </Text>
          </View>
        </View>

        <Text style={[styles.bankuDesc, { color: colors.textSecondary }]}>
          Have a picture or PDF of your class routine? Banku extracts weekdays, times, rooms, and subjects for your review.
        </Text>

        <Pressable
          onPress={handleBankuImport}
          disabled={isExtracting}
          style={({ pressed }) => [
            styles.bankuButton,
            pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
            isExtracting && { opacity: 0.7 },
          ]}
        >
          {isExtracting ? (
            <ActivityIndicator size="small" color="#05070B" />
          ) : (
            <Feather name="file-text" size={16} color="#05070B" />
          )}
          <Text style={styles.bankuButtonText}>
            {isExtracting ? 'Analyzing Routine with Banku...' : 'Import Timetable with Banku'}
          </Text>
        </Pressable>
      </GlassCard>

      {/* Manual Form Card */}
      <GlassCard level="primary" style={styles.formCard}>
        <Text style={[styles.cardHeader, { color: brand.violet }]}>MANUAL CLASS ENTRY</Text>

        {/* Subject Picker */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>SUBJECT *</Text>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipScroll}>
            {subjects.map((s) => {
              const isSelected = selectedSubjectId === s.id;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => setSelectedSubjectId(s.id)}
                  style={[
                    styles.chip,
                    {
                      borderColor: isSelected ? s.color : colors.border,
                      backgroundColor: isSelected
                        ? (isDark ? `${s.color}25` : `${s.color}15`)
                        : 'transparent',
                    },
                  ]}
                >
                  <View style={[styles.dot, { backgroundColor: s.color }]} />
                  <Text
                    style={[
                      styles.chipText,
                      { color: isSelected ? s.color : colors.text },
                    ]}
                  >
                    {s.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        </View>

        {/* Day of Week */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: colors.textSecondary }]}>DAY OF WEEK *</Text>
          <View style={styles.daysRow}>
            {DAYS_OF_WEEK.map((d) => {
              const isSelected = dayOfWeek === d;
              return (
                <Pressable
                  key={d}
                  onPress={() => {
                    setDayOfWeek(d);
                    setConflictWarning(null);
                  }}
                  style={[
                    styles.dayButton,
                    {
                      borderColor: isSelected ? '#00E5FF' : colors.border,
                      backgroundColor: isSelected
                        ? '#00E5FF'
                        : 'rgba(255, 255, 255, 0.04)',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.dayButtonText,
                      {
                        color: isSelected ? '#05070B' : colors.text,
                        fontWeight: isSelected ? '800' : '600',
                      },
                    ]}
                  >
                    {d.slice(0, 3).toUpperCase()}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Time Inputs */}
        <View style={styles.inlineRow}>
          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={[styles.label, { color: '#00E5FF' }]}>START TIME (HH:MM)</Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: '#FFFFFF',
                  backgroundColor: 'rgba(6, 12, 24, 0.75)',
                  borderColor: 'rgba(255, 255, 255, 0.12)',
                  textAlign: 'center',
                },
              ]}
              placeholder="09:00"
              placeholderTextColor="#64748B"
              value={startTime}
              onChangeText={(t) => {
                setStartTime(t);
                setConflictWarning(null);
              }}
            />
          </View>

          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={[styles.label, { color: '#00E5FF' }]}>END TIME (HH:MM)</Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: '#FFFFFF',
                  backgroundColor: 'rgba(6, 12, 24, 0.75)',
                  borderColor: 'rgba(255, 255, 255, 0.12)',
                  textAlign: 'center',
                },
              ]}
              placeholder="10:00"
              placeholderTextColor="#64748B"
              value={endTime}
              onChangeText={(t) => {
                setEndTime(t);
                setConflictWarning(null);
              }}
            />
          </View>

          <View style={[styles.inputGroup, { flex: 1 }]}>
            <Text style={[styles.label, { color: '#94A3B8' }]}>ROOM</Text>
            <TextInput
              style={[
                styles.input,
                {
                  color: '#FFFFFF',
                  backgroundColor: 'rgba(6, 12, 24, 0.75)',
                  borderColor: 'rgba(255, 255, 255, 0.12)',
                },
              ]}
              placeholder="Room 301"
              placeholderTextColor="#64748B"
              value={room}
              onChangeText={setRoom}
            />
          </View>
        </View>

        {/* Type Selector */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: '#00E5FF' }]}>CLASS TYPE</Text>
          <View style={styles.typeRow}>
            {CLASS_TYPES.map((t) => {
              const isSelected = type === t;
              return (
                <Pressable
                  key={t}
                  onPress={() => setType(t)}
                  style={[
                    styles.typeChip,
                    {
                      borderColor: isSelected ? '#00E5FF' : 'rgba(255, 255, 255, 0.12)',
                      backgroundColor: isSelected
                        ? 'rgba(0, 229, 255, 0.18)'
                        : 'transparent',
                    },
                  ]}
                >
                  <Text
                    style={[
                      styles.typeChipText,
                      { color: isSelected ? '#00E5FF' : colors.text },
                    ]}
                  >
                    {t.charAt(0).toUpperCase() + t.slice(1)}
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Error Feedback */}
        {error && (
          <View style={styles.errorBanner}>
            <AlertTriangleIcon size={16} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}

        {/* Conflict Warning Banner */}
        {conflictWarning && (
          <View style={styles.conflictBanner}>
            <AlertTriangleIcon size={18} color="#F59E0B" />
            <View style={styles.conflictTextContainer}>
              <Text style={styles.conflictTitle}>Schedule Conflict Detected</Text>
              <Text style={styles.conflictDesc}>{conflictWarning.message}</Text>
              <Text style={styles.conflictHint}>
                Tap &quot;Add Anyway&quot; if this slot is intentional.
              </Text>
            </View>
          </View>
        )}

        <Pressable
          onPress={handleAddSlot}
          style={({ pressed }) => [
            styles.addButton,
            {
              backgroundColor: conflictWarning ? '#F59E0B' : 'rgba(0, 229, 255, 0.16)',
              borderColor: conflictWarning ? '#F59E0B' : '#00E5FF',
              borderWidth: 1,
            },
            pressed && { opacity: 0.9 },
          ]}
        >
          <AddIcon size={18} color={conflictWarning ? '#FFFFFF' : '#00E5FF'} />
          <Text
            style={[
              styles.addButtonText,
              { color: conflictWarning ? '#FFFFFF' : '#00E5FF' },
            ]}
          >
            {conflictWarning ? 'Add Anyway (Keep Conflict)' : 'Add Class'}
          </Text>
        </Pressable>
      </GlassCard>

      {/* Added Slots List */}
      <View style={styles.listSection}>
        <Text style={[styles.sectionTitle, { color: colors.text }]}>
          Scheduled Classes ({slots.length})
        </Text>

        {slots.length === 0 ? (
          <View style={[styles.emptyCard, { borderColor: colors.border }]}>
            <CalendarIcon size={26} color={colors.textTertiary} />
            <Text style={[styles.emptyText, { color: colors.textSecondary }]}>
              No timetable classes scheduled yet.
            </Text>
          </View>
        ) : (
          slots.map((sl) => {
            const subj = subjects.find(s => s.id === sl.subjectId);
            return (
              <GlassCard key={sl.id} level="secondary" style={styles.slotCard}>
                <View style={styles.slotLeft}>
                  <View style={[styles.slotColorBar, { backgroundColor: subj?.color || brand.violet }]} />
                  <View style={styles.slotInfo}>
                    <Text style={[styles.slotSubjName, { color: colors.text }]}>
                      {subj?.name || 'Class'}
                    </Text>
                    <Text style={[styles.slotMeta, { color: colors.textSecondary }]}>
                      {sl.dayOfWeek.toUpperCase()} · {sl.startTime}–{sl.endTime}
                      {sl.room ? ` · ${sl.room}` : ''} · {sl.type}
                    </Text>
                  </View>
                </View>

                <Pressable onPress={() => handleRemoveSlot(sl.id)} hitSlop={8}>
                  <TrashIcon size={16} color="#EF4444" />
                </Pressable>
              </GlassCard>
            );
          })
        )}
      </View>

      {/* Bottom Buttons */}
      <View style={styles.buttonRow}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [
            styles.backButton,
            {
              backgroundColor: isDark ? 'rgba(10, 16, 28, 0.85)' : 'rgba(0, 0, 0, 0.04)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : colors.border,
            },
            pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Feather name="chevron-left" size={18} color={isDark ? '#E2E8F0' : colors.text} />
          <Text style={[styles.backButtonText, { color: isDark ? '#E2E8F0' : colors.textSecondary }]}>
            Back
          </Text>
        </Pressable>

        <Pressable
          onPress={onSkip}
          accessibilityRole="button"
          accessibilityLabel="I'll add later"
          style={({ pressed }) => [
            styles.skipButton,
            {
              backgroundColor: isDark ? 'rgba(10, 16, 28, 0.85)' : 'rgba(0, 0, 0, 0.04)',
              borderColor: isDark ? 'rgba(255, 255, 255, 0.16)' : colors.border,
            },
            pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Text style={[styles.skipButtonText, { color: isDark ? '#E2E8F0' : colors.textSecondary }]}>
            I&apos;ll add later
          </Text>
        </Pressable>

        <View style={styles.nextButtonWrapper}>
          <LuminousButton
            title={slots.length > 0 ? 'Continue' : 'Skip & Continue'}
            onPress={handleContinue}
            size="medium"
            showArrow
          />
        </View>
      </View>

      {/* ─── Editable Banku Extraction Preview Modal ─── */}
      <Modal
        visible={showPreviewModal}
        animationType="slide"
        transparent
        onRequestClose={handleDiscardExtractedSlots}
      >
        <View style={styles.modalOverlay}>
          <View style={[styles.modalContainer, { backgroundColor: colors.surface }]}>
            <View style={styles.modalHeader}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 }}>
                <Image source={MASCOT_ASSETS.banku.avatar} style={styles.modalAvatarImg} resizeMode="contain" />
                <View style={{ flex: 1 }}>
                  <Text style={[styles.modalTitle, { color: colors.text }]}>
                    Banku Extracted Classes ({extractedSlots.length})
                  </Text>
                  <Text style={[styles.modalSubtitle, { color: colors.textSecondary }]}>
                    Review and edit detected slots. Select classes to add to your timetable.
                  </Text>
                </View>
              </View>
              <Pressable onPress={handleDiscardExtractedSlots} hitSlop={8}>
                <CloseIcon size={22} color={colors.textSecondary} />
              </Pressable>
            </View>

            <ScrollView style={styles.modalList} showsVerticalScrollIndicator={false}>
              {extractedSlots.map((item, idx) => {
                const subj = subjects.find(s => s.id === item.subjectId);
                return (
                  <GlassCard key={item.tempId} level="secondary" style={styles.extractedCard}>
                    <View style={styles.extractedCardTop}>
                      <Pressable
                        onPress={() => {
                          setExtractedSlots(prev =>
                            prev.map((s, i) => i === idx ? { ...s, selected: !s.selected } : s)
                          );
                        }}
                        style={styles.checkboxRow}
                      >
                        {item.selected ? (
                          <CheckSquareIcon size={20} color={brand.violet} />
                        ) : (
                          <EmptySquareIcon size={20} color={colors.textTertiary} />
                        )}
                        <Text style={[styles.extractedCardTitle, { color: colors.text }]}>
                          Slot {idx + 1}: {item.dayOfWeek.toUpperCase()}
                        </Text>
                      </Pressable>

                      <Pressable
                        onPress={() => {
                          setExtractedSlots(prev => prev.filter((_, i) => i !== idx));
                        }}
                        hitSlop={8}
                      >
                        <TrashIcon size={16} color="#EF4444" />
                      </Pressable>
                    </View>

                    {/* Subject Selector for this slot */}
                    <View style={styles.extractedFieldGroup}>
                      <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>
                        MATCHED SUBJECT
                      </Text>
                      <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.modalSubjectChips}>
                        {subjects.map(s => {
                          const isSel = s.id === item.subjectId;
                          return (
                            <Pressable
                              key={s.id}
                              onPress={() => {
                                setExtractedSlots(prev =>
                                  prev.map((slot, i) => i === idx ? { ...slot, subjectId: s.id } : slot)
                                );
                              }}
                              style={[
                                styles.chip,
                                {
                                  borderColor: isSel ? s.color : colors.border,
                                  backgroundColor: isSel
                                    ? (isDark ? `${s.color}25` : `${s.color}15`)
                                    : 'transparent',
                                },
                              ]}
                            >
                              <View style={[styles.dot, { backgroundColor: s.color }]} />
                              <Text style={[styles.chipText, { color: isSel ? s.color : colors.text }]}>
                                {s.name}
                              </Text>
                            </Pressable>
                          );
                        })}
                      </ScrollView>
                    </View>

                    {/* Time & Room Row */}
                    <View style={styles.inlineRow}>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>START</Text>
                        <TextInput
                          style={[styles.smallInput, { color: colors.text, borderColor: colors.border }]}
                          value={item.startTime}
                          onChangeText={t => {
                            setExtractedSlots(prev =>
                              prev.map((slot, i) => i === idx ? { ...slot, startTime: t } : slot)
                            );
                          }}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>END</Text>
                        <TextInput
                          style={[styles.smallInput, { color: colors.text, borderColor: colors.border }]}
                          value={item.endTime}
                          onChangeText={t => {
                            setExtractedSlots(prev =>
                              prev.map((slot, i) => i === idx ? { ...slot, endTime: t } : slot)
                            );
                          }}
                        />
                      </View>
                      <View style={{ flex: 1 }}>
                        <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>ROOM</Text>
                        <TextInput
                          style={[styles.smallInput, { color: colors.text, borderColor: colors.border }]}
                          value={item.room || ''}
                          placeholder="Room"
                          placeholderTextColor={colors.textTertiary}
                          onChangeText={t => {
                            setExtractedSlots(prev =>
                              prev.map((slot, i) => i === idx ? { ...slot, room: t } : slot)
                            );
                          }}
                        />
                      </View>
                    </View>

                    {item.conflictWarning && (
                      <View style={styles.extractedConflictBanner}>
                        <AlertTriangleIcon size={14} color="#F59E0B" />
                        <Text style={styles.extractedConflictText}>
                          {item.conflictWarning}
                        </Text>
                      </View>
                    )}
                  </GlassCard>
                );
              })}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable
                onPress={handleDiscardExtractedSlots}
                style={[styles.modalCancelButton, { borderColor: colors.border }]}
              >
                <Text style={[styles.modalCancelText, { color: colors.textSecondary }]}>
                  Discard (0 Writes)
                </Text>
              </Pressable>

              <Pressable
                onPress={handleConfirmExtractedSlots}
                style={[styles.modalConfirmButton, { backgroundColor: brand.violet }]}
              >
                <Text style={styles.modalConfirmText}>
                  Add {extractedSlots.filter(s => s.selected).length} Classes
                </Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1 },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 40,
    maxWidth: 600,
    width: '100%',
    alignSelf: 'center',
  },
  header: { marginBottom: 16 },
  title: { fontSize: 24, fontWeight: '800', letterSpacing: -0.5 },
  subtitle: { fontSize: 15, marginTop: 4 },

  cardSpecularRim: {
    height: 2,
    backgroundColor: 'rgba(245, 158, 11, 0.45)',
    borderRadius: 1,
    marginBottom: 4,
  },
  bankuCard: {
    padding: 16,
    borderRadius: 20,
    marginBottom: 20,
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    gap: 12,
  },
  bankuHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  bankuAvatarImg: {
    width: 44,
    height: 44,
    borderRadius: 22,
    borderWidth: 1.5,
    borderColor: 'rgba(245, 158, 11, 0.4)',
  },
  bankuBadgeRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  bankuTitleText: {
    fontSize: 16,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 0.5,
  },
  bankuBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  bankuBadgeText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 0.8,
  },
  bankuTelemetryText: {
    fontSize: 9.5,
    fontWeight: '700',
    color: '#F59E0B',
    letterSpacing: 0.8,
    opacity: 0.9,
  },
  bankuDesc: {
    fontSize: 13,
    lineHeight: 18,
  },
  bankuButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#F59E0B',
  },
  bankuButtonText: {
    color: '#05070B',
    fontSize: 14,
    fontWeight: '800',
  },
  modalAvatarImg: {
    width: 32,
    height: 32,
    borderRadius: 16,
  },

  formCard: { padding: 20, borderRadius: 24, marginBottom: 24, gap: 14 },
  cardHeader: { fontSize: 11, fontWeight: '700', letterSpacing: 1 },
  inputGroup: { gap: 6 },
  label: { fontSize: 12, fontWeight: '700', letterSpacing: 0.8 },
  chipScroll: { flexDirection: 'row' },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: 12,
    borderWidth: 1,
    marginRight: 8,
    gap: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  chipText: { fontSize: 13, fontWeight: '600' },
  daysRow: { flexDirection: 'row', gap: 6 },
  dayButton: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  dayButtonText: { fontSize: 12, fontWeight: '700' },
  inlineRow: { flexDirection: 'row', gap: 10 },
  input: {
    height: 44,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    fontSize: 14,
  },
  typeRow: { flexDirection: 'row', gap: 8 },
  typeChip: {
    flex: 1,
    paddingVertical: 8,
    borderRadius: 10,
    borderWidth: 1,
    alignItems: 'center',
  },
  typeChipText: { fontSize: 12, fontWeight: '600' },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
  },
  errorText: { color: '#EF4444', fontSize: 12, fontWeight: '600' },
  conflictBanner: {
    flexDirection: 'row',
    gap: 10,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    borderWidth: 1,
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  conflictTextContainer: { flex: 1, gap: 2 },
  conflictTitle: { color: '#F59E0B', fontSize: 12, fontWeight: '700' },
  conflictDesc: { color: '#F59E0B', fontSize: 11 },
  conflictHint: { color: '#F59E0B', fontSize: 10, opacity: 0.8, marginTop: 2 },
  addButton: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    height: 48,
    borderRadius: 14,
    marginTop: 4,
  },
  addButtonText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },

  listSection: { gap: 10, marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '700' },
  emptyCard: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 1,
    borderStyle: 'dashed',
    alignItems: 'center',
    gap: 8,
  },
  emptyText: { fontSize: 13 },
  slotCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: 14,
    borderRadius: 16,
  },
  slotLeft: { flexDirection: 'row', alignItems: 'center', gap: 10, flex: 1 },
  slotColorBar: { width: 4, height: 36, borderRadius: 2 },
  slotInfo: { gap: 2, flex: 1 },
  slotSubjName: { fontSize: 14, fontWeight: '700' },
  slotMeta: { fontSize: 12 },

  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: 10, marginTop: 8 },
  backButton: {
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 26,
    borderWidth: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  backButtonText: { fontSize: 14, fontWeight: '600' },
  skipButton: {
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 26,
    borderWidth: 1.2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: { fontSize: 14, fontWeight: '600' },
  nextButtonWrapper: {
    flex: 1,
  },

  /* Modal Styles */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.7)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    maxHeight: '85%',
    padding: 20,
    gap: 16,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalTitle: { fontSize: 18, fontWeight: '800' },
  modalSubtitle: { fontSize: 12, marginTop: 2, maxWidth: 280 },
  modalList: { maxHeight: 420 },
  extractedCard: {
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    gap: 10,
  },
  extractedCardTop: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  extractedCardTitle: { fontSize: 14, fontWeight: '700' },
  extractedFieldGroup: { gap: 4 },
  fieldLabel: { fontSize: 10, fontWeight: '700', letterSpacing: 0.5 },
  modalSubjectChips: { flexDirection: 'row' },
  smallInput: {
    height: 36,
    borderWidth: 1,
    borderRadius: 8,
    paddingHorizontal: 8,
    fontSize: 13,
    textAlign: 'center',
  },
  extractedConflictBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    padding: 6,
    borderRadius: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
  },
  extractedConflictText: { color: '#F59E0B', fontSize: 11, fontWeight: '600' },
  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 1,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 14,
    borderRadius: 14,
    borderWidth: 1,
    alignItems: 'center',
  },
  modalCancelText: { fontSize: 13, fontWeight: '600' },
  modalConfirmButton: {
    flex: 1.5,
    paddingVertical: 14,
    borderRadius: 14,
    alignItems: 'center',
  },
  modalConfirmText: { color: '#FFFFFF', fontSize: 14, fontWeight: '700' },
});
