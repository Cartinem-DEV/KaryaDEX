/**
 * KaryaDEX — Onboarding Step 4/6: Syllabus & Curriculum Setup
 *
 * Layout Hierarchy (Top-to-Bottom):
 * 1. Top Section — Banku Vision Multi-File Subject Extractor:
 *    - Banku Vision Liquid Glass Card (#080B11 obsidian theme, Amber Glass #F59E0B 0.5px specular rim border,
 *      BlurView dark/50, and Banku's visual avatar from KaryaDEX Robot Mascot Design Board).
 *    - Dual Mixed-Media Upload Buttons: "Add PDFs / Documents" + "Add Photos".
 *    - Additive Staging Queue: Upload multiple PDFs, multiple photos, or both simultaneously.
 *    - Pre-flight guardrails: 40-page limit check on each PDF, 15MB limit, Base64 sanitization.
 * 2. Divider:
 *    - Horizontal glass divider labeled "OR ADD & EDIT SUBJECTS MANUALLY".
 * 3. Downward Section — Existing Manual Subject Adding UI:
 *    - Placed downward (below Banku Vision and divider).
 *    - Manual subject registration, topic management, and unified subjects list.
 *    - Both Banku-extracted subjects and manually added subjects appear in this unified downward list.
 * 4. Interactive Proposal Review Preview Modal:
 *    - Strict invariant: AI Draft -> Validation -> Preview -> User Confirmation -> Canonical Save.
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
  Platform,
  useWindowDimensions,
} from 'react-native';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { BlurView } from 'expo-blur';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/constants/ThemeContext';
import { brand, typography, radii } from '@/constants/theme';
import { MASCOT_ASSETS } from '@/constants/mascots';
import { GlassCard, LuminousButton } from '@/components/ui';
import type { SubjectDraft, SyllabusUnitDraft } from '@/types/onboarding';
import { SyllabusExtractionFeature } from '@/services/ai';
import type { SyllabusFileInput } from '@/services/ai/features/syllabusExtraction';
import {
  readFileAsset,
  validatePdfPageLimit,
  parseFileBase64AndMime,
  extractMagicBytesFromBase64,
} from '@/lib/fileUtils';
import { subjectRepository, syllabusRepository } from '@/database';
import type { SyllabusProposalPayload, AIProposal } from '@/services/ai/core/aiTypes';

export interface StagedFileItem {
  id: string;
  name: string;
  size: number;
  mimeType: string;
  isPdf: boolean;
  fileOrAsset: any;
}

export interface EditableExtractedTopic {
  id: string;
  name: string;
}

export interface EditableExtractedUnit {
  tempId: string;
  name: string;
  selected: boolean;
  topics: EditableExtractedTopic[];
}

export interface EditableExtractedSubject {
  tempId: string;
  name: string;
  code: string;
  credits: string;
  targetSubjectId: string; // 'new' or existing subject id
  selected: boolean;
  units: EditableExtractedUnit[];
}

export interface StepSyllabusProps {
  subjects: SubjectDraft[];
  initialUnits?: SyllabusUnitDraft[];
  onNext: (units: SyllabusUnitDraft[], updatedSubjects?: SubjectDraft[]) => void;
  onSkip: () => void;
  onBack: () => void;
}

const COLOR_PALETTE = [
  '#3B82F6', // Blue
  '#8B5CF6', // Violet
  '#EC4899', // Pink
  '#10B981', // Emerald
  '#F59E0B', // Amber
  '#06B6D4', // Cyan
  '#EF4444', // Red
  '#6366F1', // Indigo
];

function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
}

export function StepSyllabus({
  subjects: initialSubjectsProp = [],
  initialUnits = [],
  onNext,
  onSkip,
  onBack,
}: StepSyllabusProps) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();

  // ─── Canonical Subject & Unit State ─────────────────────────────────────
  const [localSubjects, setLocalSubjects] = useState<SubjectDraft[]>(initialSubjectsProp);
  const [units, setUnits] = useState<SyllabusUnitDraft[]>(initialUnits);
  const [selectedSubjectId, setSelectedSubjectId] = useState<string>(
    initialSubjectsProp[0]?.id || ''
  );

  // Manual Unit Entry State
  const [unitName, setUnitName] = useState('');
  const [topicsText, setTopicsText] = useState('');
  const [error, setError] = useState<string | null>(null);

  // Manual Subject Entry State (Quick Inline Form)
  const [isAddingSubjectManually, setIsAddingSubjectManually] = useState(false);
  const [manualSubjectName, setManualSubjectName] = useState('');
  const [manualSubjectCode, setManualSubjectCode] = useState('');
  const [manualCredits, setManualCredits] = useState('4');

  // ─── Banku Vision Multi-File Upload Queue State ─────────────────────────
  const [stagedFiles, setStagedFiles] = useState<StagedFileItem[]>([]);
  const [fileWarning, setFileWarning] = useState<string | null>(null);
  const [isExtracting, setIsExtracting] = useState(false);

  // ─── Proposal Review Preview Modal State ────────────────────────────────
  const [showPreviewModal, setShowPreviewModal] = useState(false);
  const [activeProposal, setActiveProposal] = useState<AIProposal<SyllabusProposalPayload> | null>(null);
  const [extractedSubjects, setExtractedSubjects] = useState<EditableExtractedSubject[]>([]);

  // Haptic feedback trigger
  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(style);
      } catch {}
    }
  };

  // ─── Document Picker Handler (PDFs & Documents, Multi-Select) ───────────
  const handlePickDocuments = async () => {
    try {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
      setFileWarning(null);
      setError(null);

      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        multiple: true,
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) return;

      const newItems: StagedFileItem[] = [];
      const warnings: string[] = [];

      for (const asset of res.assets) {
        const isPdf =
          asset.name?.toLowerCase().endsWith('.pdf') ||
          asset.mimeType?.toLowerCase().includes('pdf') ||
          false;

        // Pre-flight guardrail 1: 15MB file size limit
        const sizeBytes = asset.size || 0;
        if (sizeBytes > 15 * 1024 * 1024) {
          warnings.push(`"${asset.name}" exceeds the 15MB limit (${(sizeBytes / (1024 * 1024)).toFixed(1)}MB).`);
          continue;
        }

        // Pre-flight guardrail 2: 40-page limit for each individual PDF
        if (isPdf) {
          const pageCheck = await validatePdfPageLimit(asset.file || asset, 40);
          if (!pageCheck.valid) {
            warnings.push(
              `"${asset.name}" exceeds the 40-page limit (${pageCheck.pageCount} pages). Please upload specific syllabus pages.`
            );
            continue;
          }
        }

        newItems.push({
          id: `staged-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: asset.name || (isPdf ? 'syllabus.pdf' : 'document.png'),
          size: sizeBytes,
          mimeType: asset.mimeType || (isPdf ? 'application/pdf' : 'image/png'),
          isPdf,
          fileOrAsset: asset,
        });
      }

      if (warnings.length > 0) {
        const warningMsg = warnings.join('\n');
        setFileWarning(warningMsg);
        Alert.alert('File Notice', warningMsg);
      }

      if (newItems.length > 0) {
        // Additive staging queue: append to stagedFiles rather than overwriting
        setStagedFiles((prev) => [...prev, ...newItems]);
        triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (err: any) {
      setFileWarning(err?.message || 'Failed to select documents.');
    }
  };

  // ─── Image Picker Handler (Photos, Multi-Select) ─────────────────────────
  const handlePickPhotos = async () => {
    try {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
      setFileWarning(null);
      setError(null);

      if (Platform.OS !== 'web') {
        const perm = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!perm.granted) {
          Alert.alert('Permission Required', 'Photo library access is needed to upload syllabus photos.');
          return;
        }
      }

      const res = await ImagePicker.launchImageLibraryAsync({
        mediaTypes: ['images'],
        allowsMultipleSelection: true,
        quality: 0.85,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) return;

      const newItems: StagedFileItem[] = [];
      const warnings: string[] = [];

      for (const asset of res.assets) {
        const sizeBytes = asset.fileSize || 0;
        if (sizeBytes > 15 * 1024 * 1024) {
          warnings.push(`"${asset.fileName || 'Photo'}" exceeds the 15MB limit.`);
          continue;
        }

        const fileName = asset.fileName || `syllabus_photo_${Date.now()}.jpg`;
        const mimeType = asset.mimeType || 'image/jpeg';

        newItems.push({
          id: `staged-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
          name: fileName,
          size: sizeBytes,
          mimeType,
          isPdf: false,
          fileOrAsset: asset,
        });
      }

      if (warnings.length > 0) {
        const warningMsg = warnings.join('\n');
        setFileWarning(warningMsg);
        Alert.alert('File Notice', warningMsg);
      }

      if (newItems.length > 0) {
        // Additive staging: append photos alongside existing staged PDFs/photos
        setStagedFiles((prev) => [...prev, ...newItems]);
        triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch (err: any) {
      setFileWarning(err?.message || 'Failed to select photos.');
    }
  };

  const handleRemoveStagedFile = (id: string) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setStagedFiles((prev) => prev.filter((f) => f.id !== id));
  };

  const handleClearAllStagedFiles = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setStagedFiles([]);
    setFileWarning(null);
  };

  // ─── Multi-File Batch Banku Vision Extraction Handler ───────────────────
  const handleExtractBatch = async () => {
    if (stagedFiles.length === 0) return;

    try {
      setIsExtracting(true);
      setError(null);
      setFileWarning(null);
      triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

      // Read all staged files and sanitize Base64
      const fileInputs: SyllabusFileInput[] = [];

      for (const item of stagedFiles) {
        const asset = item.fileOrAsset;
        const { base64, mimeType: parsedMime } = await readFileAsset(asset);
        const sanitized = parseFileBase64AndMime(
          base64,
          parsedMime || item.mimeType || (item.isPdf ? 'application/pdf' : 'image/jpeg')
        );
        const finalBase64 = sanitized.base64 || base64;
        const resolvedMime =
          sanitized.mimeType || parsedMime || item.mimeType || (item.isPdf ? 'application/pdf' : 'image/jpeg');
        const magic = extractMagicBytesFromBase64(finalBase64);

        fileInputs.push({
          fileBase64: finalBase64,
          fileMimeType: resolvedMime,
          fileName: item.name,
          fileSizeBytes: item.size || Math.round((finalBase64.length * 3) / 4),
          magicBytes: magic,
        });
      }

      // Call Banku AI Syllabus & Multi-Subject Extraction
      const result = await SyllabusExtractionFeature.extractSyllabusProposal({
        userId: 'onboarding-student',
        files: fileInputs,
        targetSubjectId: selectedSubjectId || undefined,
      });

      const extractedData = result.data;
      setActiveProposal(result.proposal || null);

      // Map detected subjects (handles multiple subjects or single subject)
      const rawSubjectList = extractedData.subjects && extractedData.subjects.length > 0
        ? extractedData.subjects
        : [
            {
              subjectName: extractedData.subjectName || 'Extracted Subject',
              subjectCode: extractedData.subjectCode || 'SUB101',
              credits: extractedData.credits || 4,
              units: extractedData.units,
            },
          ];

      const mappedSubjects: EditableExtractedSubject[] = rawSubjectList.map((s, sIdx) => {
        const sName = s.subjectName || `Subject ${sIdx + 1}`;
        const sCode = s.subjectCode || `SUB10${sIdx + 1}`;
        const sCredits = String(s.credits || 4);

        // Check if matches an existing subject in localSubjects
        const norm = sName.toLowerCase().trim();
        const matched = localSubjects.find(
          (ls) =>
            ls.name.toLowerCase().trim() === norm ||
            ls.shortName?.toLowerCase().trim() === norm ||
            ls.code.toLowerCase().trim() === (sCode.toLowerCase().trim() || norm)
        );

        return {
          tempId: `syl-subj-${sIdx}-${Date.now()}`,
          name: sName,
          code: sCode,
          credits: sCredits,
          targetSubjectId: matched ? matched.id : 'new',
          selected: true,
          units: s.units.map((u, uIdx) => ({
            tempId: `syl-u-${sIdx}-${uIdx}-${Date.now()}`,
            name: u.name,
            selected: true,
            topics: u.topics.map((t, tIdx) => ({
              id: `syl-t-${sIdx}-${uIdx}-${tIdx}-${Date.now()}`,
              name: t.name,
            })),
          })),
        };
      });

      if (mappedSubjects.length === 0 || mappedSubjects.every((s) => s.units.length === 0)) {
        setError('No subjects or curriculum units could be detected in the attached files.');
      } else {
        setExtractedSubjects(mappedSubjects);
        setShowPreviewModal(true);
      }
    } catch (err: any) {
      setError(err?.message || 'Failed to extract curriculum with Banku Vision.');
    } finally {
      setIsExtracting(false);
    }
  };

  // ─── Confirmation & Canonical Persistence ───────────────────────────────
  const handleConfirmExtractedSubjects = async () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    const activeSubjects = extractedSubjects.filter((s) => s.selected);
    if (activeSubjects.length === 0) {
      setShowPreviewModal(false);
      return;
    }

    const newCreatedSubjects: SubjectDraft[] = [];
    const newCreatedUnits: SyllabusUnitDraft[] = [];
    let firstAssignedSubjectId: string | null = null;

    for (let sIdx = 0; sIdx < activeSubjects.length; sIdx++) {
      const subj = activeSubjects[sIdx];
      let assignedSubjectId = subj.targetSubjectId;

      // If 'new' subject, create and register it
      if (assignedSubjectId === 'new') {
        const trimmedName = subj.name.trim() || `Subject ${sIdx + 1}`;
        const trimmedCode = subj.code.trim() || `SUB10${localSubjects.length + newCreatedSubjects.length + 1}`;
        const parsedCredits = parseInt(subj.credits, 10) || 4;

        const newSubj: SubjectDraft = {
          id: `subj-${Date.now()}-${sIdx}-${Math.random().toString(36).slice(2, 6)}`,
          name: trimmedName,
          code: trimmedCode,
          shortName: trimmedCode || trimmedName.slice(0, 6).toUpperCase(),
          color: COLOR_PALETTE[(localSubjects.length + newCreatedSubjects.length) % COLOR_PALETTE.length],
          credits: parsedCredits,
          subjectType: 'lecture',
        };

        assignedSubjectId = newSubj.id;
        newCreatedSubjects.push(newSubj);

        // Attempt canonical write to SQLite subject repository
        try {
          await subjectRepository.createSubject({
            id: newSubj.id,
            name: newSubj.name,
            shortName: newSubj.shortName,
            code: newSubj.code,
            color: newSubj.color,
            credits: newSubj.credits,
            semesterId: 'sem-current',
            facultyId: 'fac-default',
            subjectType: 'lecture',
            targetAttendance: 75,
          });
        } catch {}
      }

      if (!firstAssignedSubjectId) {
        firstAssignedSubjectId = assignedSubjectId;
      }

      const activeUnits = subj.units.filter((u) => u.selected && u.name.trim().length > 0);
      const existingUnitsForSubject = units.filter((u) => u.subjectId === assignedSubjectId);

      const subjectDraftUnits: SyllabusUnitDraft[] = activeUnits.map((u, uIdx) => ({
        id: `unit-${Date.now()}-${sIdx}-${uIdx}-${Math.random().toString(36).slice(2, 6)}`,
        subjectId: assignedSubjectId,
        name: u.name.trim(),
        order: existingUnitsForSubject.length + uIdx + 1,
        topics: u.topics.map((t, tIdx) => ({
          id: `topic-${Date.now()}-${sIdx}-${uIdx}-${tIdx}-${Math.random().toString(36).slice(2, 5)}`,
          name: t.name.trim(),
          order: tIdx + 1,
        })),
      }));

      // Attempt canonical write to SQLite syllabus repository
      try {
        for (const du of subjectDraftUnits) {
          const createdUnit = await syllabusRepository.createUnit({
            id: du.id,
            subjectId: assignedSubjectId,
            semesterId: 'sem-current',
            name: du.name,
            order: du.order,
            topicIds: [],
          });
          for (const dt of du.topics) {
            await syllabusRepository.createTopic({
              id: dt.id,
              unitId: createdUnit.id,
              subjectId: assignedSubjectId,
              name: dt.name,
              order: dt.order,
              isCompleted: false,
              revisionStatus: 'not_started',
              classNoteIds: [],
            });
          }
        }
      } catch {}

      newCreatedUnits.push(...subjectDraftUnits);
    }

    // Update canonical local state
    if (newCreatedSubjects.length > 0) {
      setLocalSubjects((prev) => [...prev, ...newCreatedSubjects]);
    }
    if (newCreatedUnits.length > 0) {
      setUnits((prev) => [...prev, ...newCreatedUnits]);
    }

    if (firstAssignedSubjectId) {
      setSelectedSubjectId(firstAssignedSubjectId);
    }

    // Clear staged files and close preview modal
    setStagedFiles([]);
    setShowPreviewModal(false);
    setExtractedSubjects([]);
    setActiveProposal(null);
  };

  const handleDiscardExtractedSubjects = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setShowPreviewModal(false);
    setExtractedSubjects([]);
    setActiveProposal(null);
  };

  // ─── Manual Subject Registration ────────────────────────────────────────
  const handleSaveManualSubject = async () => {
    if (!manualSubjectName.trim()) {
      Alert.alert('Subject Name Required', 'Please enter the subject name.');
      return;
    }
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);

    const trimmedName = manualSubjectName.trim();
    const trimmedCode = manualSubjectCode.trim() || manualSubjectName.slice(0, 4).toUpperCase() + '101';
    const parsedCredits = parseInt(manualCredits, 10) || 4;

    const newSubject: SubjectDraft = {
      id: `subj-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      name: trimmedName,
      code: trimmedCode,
      shortName: trimmedCode,
      color: COLOR_PALETTE[localSubjects.length % COLOR_PALETTE.length],
      credits: parsedCredits,
      subjectType: 'lecture',
    };

    setLocalSubjects((prev) => [...prev, newSubject]);
    setSelectedSubjectId(newSubject.id);

    try {
      await subjectRepository.createSubject({
        id: newSubject.id,
        name: newSubject.name,
        shortName: newSubject.shortName,
        code: newSubject.code,
        color: newSubject.color,
        credits: newSubject.credits,
        semesterId: 'sem-current',
        facultyId: 'fac-default',
        subjectType: 'lecture',
        targetAttendance: 75,
      });
    } catch {}

    setManualSubjectName('');
    setManualSubjectCode('');
    setManualCredits('4');
    setIsAddingSubjectManually(false);
  };

  // ─── Manual Unit Entry ──────────────────────────────────────────────────
  const handleAddUnit = () => {
    if (!selectedSubjectId) {
      setError('Please select or add a subject first before adding a unit.');
      return;
    }
    if (!unitName.trim()) {
      setError('Unit name is required (e.g. Unit 1: Electromagnetism).');
      return;
    }
    setError(null);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);

    const parsedTopics = topicsText
      .split(/[\n,]+/)
      .map((t) => t.trim())
      .filter(Boolean)
      .map((t, idx) => ({
        id: `topic-${Date.now()}-${idx}-${Math.random().toString(36).slice(2, 5)}`,
        name: t,
        order: idx + 1,
      }));

    const newUnit: SyllabusUnitDraft = {
      id: `unit-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
      subjectId: selectedSubjectId,
      name: unitName.trim(),
      order: units.filter((u) => u.subjectId === selectedSubjectId).length + 1,
      topics: parsedTopics,
    };

    setUnits((prev) => [...prev, newUnit]);
    setUnitName('');
    setTopicsText('');
  };

  const handleRemoveUnit = (id: string) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setUnits((prev) => prev.filter((u) => u.id !== id));
  };

  const handleContinue = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
    onNext(units, localSubjects);
  };

  const currentSubjectUnits = units.filter((u) => u.subjectId === selectedSubjectId);
  const selectedSubject = localSubjects.find((s) => s.id === selectedSubjectId);

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* ─── Volumetric Background Glows ─── */}
      <View style={styles.ambientAtmosphere} pointerEvents="none">
        <View style={styles.ambientOrbAmber} />
        <View style={styles.ambientOrbCyan} />
      </View>

      {/* ─── Screen Header ─── */}
      <View style={styles.header}>
        <View style={styles.stepBadge}>
          <Feather name="book-open" size={12} color="#06B6D4" />
          <Text style={styles.stepBadgeText}>ACADEMIC SETUP • STEP 4</Text>
        </View>
        <Text style={styles.title}>Syllabus & Curriculum</Text>
        <Text style={styles.subtitle}>
          Scan your curriculum documents with Banku Vision AI, or structure subjects & units manually below.
        </Text>
      </View>

      {/* ═══════════════════════════════════════════════════════════════════════
          PART 1 (TOP SECTION): BANKU VISION MULTI-FILE SUBJECT EXTRACTOR
          ═══════════════════════════════════════════════════════════════════════ */}
      <View style={styles.sectionHeaderRow}>
        <Feather name="eye" size={15} color="#F59E0B" />
        <Text style={[styles.sectionTitle, { color: '#F59E0B' }]}>
          BANKU VISION MULTI-FILE SUBJECT EXTRACTOR
        </Text>
      </View>

      <GlassCard level="primary" style={styles.bankuVisionCard}>
        {/* Radial amber bloom */}
        <View style={styles.bankuBloom} pointerEvents="none" />

        {/* Mascot & Telemetry Header */}
        <View style={styles.bankuHeroRow}>
          {/* Banku Avatar Container */}
          <View style={styles.bankuAvatarShell}>
            <Image
              source={MASCOT_ASSETS.banku.poses.scanning}
              style={styles.bankuMascotImg}
              resizeMode="contain"
            />
            {/* Holographic scanning laser line */}
            <View style={styles.bankuScanBeam} />
          </View>

          {/* Telemetry & Headline */}
          <View style={styles.bankuMetaCol}>
            <View style={styles.bankuTelemetryPill}>
              <View style={styles.pulsingAmberDot} />
              <Text style={styles.bankuTelemetryText}>VISION SENTINEL • MULTI-FILE PIPELINE</Text>
            </View>
            <Text style={styles.bankuVisionTitle}>Extract Subjects with Banku Vision</Text>
            <Text style={styles.bankuVisionSubtitle}>
              Attach multiple PDFs, multiple syllabus photos, or both together. Banku analyzes all documents in one batch to extract subjects and topic modules automatically.
            </Text>
          </View>
        </View>

        {/* Guardrail & Telemetry Specs Plate */}
        <View style={styles.bankuSpecsPlate}>
          <View style={styles.bankuSpecItem}>
            <Feather name="shield" size={12} color="#10B981" />
            <Text style={styles.bankuSpecText}>40-Page Sentinel (Per PDF)</Text>
          </View>
          <View style={styles.bankuSpecItem}>
            <Feather name="cpu" size={12} color="#F59E0B" />
            <Text style={styles.bankuSpecText}>Gemini 3.8 Flash Multimodal</Text>
          </View>
          <View style={styles.bankuSpecItem}>
            <Feather name="file-text" size={12} color="#06B6D4" />
            <Text style={styles.bankuSpecText}>15MB Batch Guard</Text>
          </View>
        </View>

        {/* ─── Dual Action Upload Buttons (PDFs + Photos) ─── */}
        <View style={styles.dualUploadRow}>
          <Pressable
            onPress={handlePickDocuments}
            disabled={isExtracting}
            style={({ pressed }) => [
              styles.uploadActionButton,
              styles.uploadActionButtonAmber,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Feather name="file-plus" size={16} color="#F59E0B" />
            <Text style={styles.uploadActionButtonAmberText}>Add PDFs / Documents</Text>
          </Pressable>

          <Pressable
            onPress={handlePickPhotos}
            disabled={isExtracting}
            style={({ pressed }) => [
              styles.uploadActionButton,
              styles.uploadActionButtonCyan,
              pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
            ]}
          >
            <Feather name="image" size={16} color="#06B6D4" />
            <Text style={styles.uploadActionButtonCyanText}>Add Photos</Text>
          </Pressable>
        </View>

        {/* ─── Inline Warning Banner (If an individual file exceeded limit) ─── */}
        {fileWarning && (
          <View style={styles.inlineWarningBanner}>
            <Feather name="alert-triangle" size={14} color="#F59E0B" />
            <Text style={styles.inlineWarningText}>{fileWarning}</Text>
          </View>
        )}

        {/* ─── Additive Staging Queue List ─── */}
        {stagedFiles.length > 0 ? (
          <View style={styles.stagingQueueContainer}>
            <View style={styles.stagingQueueHeader}>
              <View style={styles.stagingCountRow}>
                <Feather name="layers" size={13} color="#F59E0B" />
                <Text style={styles.stagingQueueTitle}>
                  STAGED FILES ({stagedFiles.length})
                </Text>
              </View>
              <Pressable
                onPress={handleClearAllStagedFiles}
                hitSlop={8}
                style={styles.clearAllButton}
              >
                <Feather name="trash-2" size={12} color="#94A3B8" />
                <Text style={styles.clearAllText}>Clear All</Text>
              </Pressable>
            </View>

            {/* Chips List */}
            <View style={styles.stagedChipsList}>
              {stagedFiles.map((file) => (
                <View key={file.id} style={styles.stagedFileChip}>
                  <Feather
                    name={file.isPdf ? 'file-text' : 'image'}
                    size={14}
                    color={file.isPdf ? '#F59E0B' : '#06B6D4'}
                  />
                  <View style={styles.stagedFileMeta}>
                    <Text style={styles.stagedFileName} numberOfLines={1}>
                      {file.name}
                    </Text>
                    <Text style={styles.stagedFileBadge}>
                      {file.isPdf ? 'PDF' : 'Photo'} • {formatBytes(file.size)}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleRemoveStagedFile(file.id)}
                    hitSlop={8}
                    style={styles.stagedFileRemoveBtn}
                  >
                    <Feather name="x" size={13} color="#94A3B8" />
                  </Pressable>
                </View>
              ))}
            </View>

            {/* Batch Extraction CTA Button */}
            <Pressable
              onPress={handleExtractBatch}
              disabled={isExtracting}
              style={({ pressed }) => [
                styles.bankuActionButton,
                pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
                isExtracting && { opacity: 0.7 },
              ]}
            >
              <LinearGradient
                colors={['#F59E0B', '#D97706']}
                start={{ x: 0, y: 0 }}
                end={{ x: 1, y: 0 }}
                style={styles.bankuActionGradient}
              >
                {isExtracting ? (
                  <ActivityIndicator size="small" color="#05070B" />
                ) : (
                  <Feather name="zap" size={17} color="#05070B" />
                )}
                <Text style={styles.bankuActionButtonTextDark}>
                  {isExtracting
                    ? `Banku Vision Analyzing ${stagedFiles.length} File${stagedFiles.length > 1 ? 's' : ''}...`
                    : `Extract Subjects with Banku Vision (${stagedFiles.length} file${stagedFiles.length > 1 ? 's' : ''})`}
                </Text>
              </LinearGradient>
            </Pressable>
          </View>
        ) : (
          <View style={styles.emptyStagingNotice}>
            <Feather name="paperclip" size={14} color="#64748B" />
            <Text style={styles.emptyStagingText}>
              Select one or more syllabus PDFs, photos of textbook contents, or curriculum printouts above to start batch extraction.
            </Text>
          </View>
        )}
      </GlassCard>

      {/* ═══════════════════════════════════════════════════════════════════════
          DIVIDER: CLEAN HORIZONTAL GLASS DIVIDER
          ═══════════════════════════════════════════════════════════════════════ */}
      <View style={styles.glassDividerContainer}>
        <View style={styles.glassDividerLine} />
        <View style={styles.glassDividerBadge}>
          <Feather name="layers" size={11} color="#94A3B8" />
          <Text style={styles.glassDividerText}>OR ADD & EDIT SUBJECTS MANUALLY</Text>
        </View>
        <View style={styles.glassDividerLine} />
      </View>

      {/* ═══════════════════════════════════════════════════════════════════════
          PART 2 (DOWNWARD SECTION): EXISTING MANUAL SUBJECT ADDING UI
          ═══════════════════════════════════════════════════════════════════════ */}
      <View style={styles.sectionHeaderRow}>
        <Feather name="edit-3" size={15} color="#06B6D4" />
        <Text style={styles.sectionTitle}>
          MANUAL SUBJECT & SYLLABUS BUILDER
        </Text>
      </View>

      <GlassCard level="primary" style={styles.manualCard}>
        {/* Subject Selection & Quick Add */}
        <View style={styles.fieldGroup}>
          <View style={styles.labelWithSubRow}>
            <Text style={styles.fieldLabel}>CURRICULUM SUBJECTS ({localSubjects.length})</Text>
            <Pressable
              onPress={() => {
                triggerHaptic();
                setIsAddingSubjectManually(!isAddingSubjectManually);
              }}
              style={styles.quickAddSubjectBtn}
            >
              <Feather
                name={isAddingSubjectManually ? 'x' : 'plus-circle'}
                size={13}
                color="#06B6D4"
              />
              <Text style={styles.quickAddSubjectText}>
                {isAddingSubjectManually ? 'Cancel' : 'Add Subject'}
              </Text>
            </Pressable>
          </View>

          {/* Unified Subject Chips List: Both Banku-extracted & manually added subjects appear here */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.subjectChipsScroll}
            contentContainerStyle={styles.subjectChipsContainer}
          >
            {localSubjects.map((s) => {
              const isSelected = selectedSubjectId === s.id;
              return (
                <Pressable
                  key={s.id}
                  onPress={() => {
                    triggerHaptic();
                    setSelectedSubjectId(s.id);
                  }}
                  style={[
                    styles.subjectChip,
                    isSelected && {
                      borderColor: s.color,
                      backgroundColor: `${s.color}22`,
                    },
                  ]}
                >
                  <View style={[styles.dot, { backgroundColor: s.color }]} />
                  <Text
                    style={[
                      styles.subjectChipText,
                      isSelected && { color: s.color, fontWeight: '800' },
                    ]}
                  >
                    {s.name}
                  </Text>
                  {s.code ? (
                    <Text style={styles.subjectChipCode}>({s.code})</Text>
                  ) : null}
                </Pressable>
              );
            })}
          </ScrollView>

          {/* Quick Manual Subject Registration Form */}
          {isAddingSubjectManually && (
            <View style={styles.manualSubjectForm}>
              <Text style={styles.manualFormTitle}>Register New Curriculum Subject</Text>
              <TextInput
                style={styles.glowInput}
                placeholder="Subject Name (e.g. Operating Systems) *"
                placeholderTextColor="#64748B"
                value={manualSubjectName}
                onChangeText={setManualSubjectName}
                autoFocus
              />
              <View style={styles.inlineTwoInputs}>
                <TextInput
                  style={[styles.glowInput, { flex: 1 }]}
                  placeholder="Subject Code (e.g. CS302)"
                  placeholderTextColor="#64748B"
                  value={manualSubjectCode}
                  onChangeText={setManualSubjectCode}
                />
                <TextInput
                  style={[styles.glowInput, { flex: 0.8 }]}
                  placeholder="Credits (e.g. 4)"
                  placeholderTextColor="#64748B"
                  keyboardType="numeric"
                  value={manualCredits}
                  onChangeText={setManualCredits}
                />
              </View>
              <Pressable
                onPress={handleSaveManualSubject}
                style={styles.saveSubjectButton}
              >
                <Feather name="check" size={15} color="#05070B" />
                <Text style={styles.saveSubjectButtonText}>Add to Curriculum</Text>
              </Pressable>
            </View>
          )}
        </View>

        {/* Unit & Topics Form for Active Subject */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabelSubtle}>
            ADD UNIT FOR {selectedSubject?.shortName || selectedSubject?.name || 'ACTIVE SUBJECT'}
          </Text>

          <TextInput
            style={[
              styles.glowInput,
              error && !unitName.trim() ? styles.inputErrorBorder : null,
            ]}
            placeholder="Unit Name (e.g. Unit 1: Thermodynamics) *"
            placeholderTextColor="#64748B"
            value={unitName}
            onChangeText={(val) => {
              setUnitName(val);
              if (error) setError(null);
            }}
          />

          <TextInput
            style={[styles.glowInput, styles.textArea]}
            placeholder="Topics / Modules (comma or newline separated, e.g. First Law, Enthalpy, Heat Capacities, Carnot Cycle)"
            placeholderTextColor="#64748B"
            value={topicsText}
            onChangeText={setTopicsText}
            multiline
            numberOfLines={3}
          />

          {error && (
            <View style={styles.errorBanner}>
              <Feather name="alert-triangle" size={15} color="#EF4444" />
              <Text style={styles.errorText}>{error}</Text>
            </View>
          )}

          <Pressable
            onPress={handleAddUnit}
            style={({ pressed }) => [
              styles.addUnitButton,
              pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
            ]}
          >
            <Feather name="plus-circle" size={16} color="#06B6D4" />
            <Text style={styles.addUnitButtonText}>Add Unit to Subject</Text>
          </Pressable>
        </View>

        {/* Existing Units Display List */}
        <View style={styles.unitsListWrapper}>
          <Text style={styles.unitsSectionHeader}>
            Units Configured ({currentSubjectUnits.length})
          </Text>

          {currentSubjectUnits.length === 0 ? (
            <View style={styles.emptyUnitsBox}>
              <Feather name="book-open" size={24} color="#64748B" />
              <Text style={styles.emptyUnitsTitle}>No units added yet</Text>
              <Text style={styles.emptyUnitsSubtitle}>
                Add units using the form above or scan syllabus documents with Banku Vision AI.
              </Text>
            </View>
          ) : (
            currentSubjectUnits.map((u, idx) => (
              <View key={u.id} style={styles.unitCard}>
                <View style={styles.unitHeaderRow}>
                  <View style={styles.unitTitleBadge}>
                    <Feather name="bookmark" size={14} color="#06B6D4" />
                    <Text style={styles.unitTitleText}>
                      {u.name || `Unit ${idx + 1}`}
                    </Text>
                  </View>
                  <Pressable
                    onPress={() => handleRemoveUnit(u.id)}
                    hitSlop={8}
                    style={styles.trashBtn}
                  >
                    <Feather name="trash-2" size={15} color="#EF4444" />
                  </Pressable>
                </View>

                {u.topics && u.topics.length > 0 && (
                  <View style={styles.topicsGrid}>
                    {u.topics.map((t) => (
                      <View key={t.id} style={styles.topicPill}>
                        <Feather name="check" size={11} color="#10B981" />
                        <Text style={styles.topicPillText}>{t.name}</Text>
                      </View>
                    ))}
                  </View>
                )}
              </View>
            ))
          )}
        </View>
      </GlassCard>

      {/* ─── Bottom Actions (Back, Skip & Primary Continue) ─── */}
      <View style={styles.buttonRow}>
        <Pressable
          onPress={() => {
            triggerHaptic();
            onBack();
          }}
          accessibilityRole="button"
          accessibilityLabel="Back"
          style={({ pressed }) => [
            styles.backButton,
            pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Feather name="chevron-left" size={18} color="#E2E8F0" />
          <Text style={styles.backButtonText}>Back</Text>
        </Pressable>

        <Pressable
          onPress={() => {
            triggerHaptic();
            onSkip();
          }}
          style={({ pressed }) => [
            styles.skipButton,
            pressed && { opacity: 0.75, transform: [{ scale: 0.98 }] },
          ]}
        >
          <Text style={styles.skipButtonText}>Skip for now</Text>
        </Pressable>

        <View style={styles.nextButtonWrapper}>
          <LuminousButton
            title="Continue"
            onPress={handleContinue}
            size="medium"
            showArrow
          />
        </View>
      </View>

      {/* ═══════════════════════════════════════════════════════════════════════
          INTERACTIVE PROPOSAL REVIEW PREVIEW MODAL
          ═══════════════════════════════════════════════════════════════════════ */}
      <Modal
        visible={showPreviewModal}
        animationType="slide"
        transparent
        onRequestClose={handleDiscardExtractedSubjects}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Modal Header */}
            <View style={styles.modalHeader}>
              <View style={styles.modalHeaderLeft}>
                <View style={styles.modalBankuAvatar}>
                  <Image
                    source={MASCOT_ASSETS.banku.avatar}
                    style={styles.modalAvatarImg}
                    resizeMode="contain"
                  />
                </View>
                <View>
                  <View style={styles.modalBadgeRow}>
                    <Text style={styles.modalTitle}>Banku Vision</Text>
                    <View style={styles.modalProposalBadge}>
                      <Text style={styles.modalProposalBadgeText}>CURRICULUM PROPOSAL</Text>
                    </View>
                  </View>
                  <Text style={styles.modalSubtitle}>
                    AI Draft → Validation → Preview → Confirmation → Canonical Save
                  </Text>
                </View>
              </View>

              <Pressable
                onPress={handleDiscardExtractedSubjects}
                hitSlop={8}
                style={styles.modalCloseButton}
              >
                <Feather name="x" size={20} color="#94A3B8" />
              </Pressable>
            </View>

            <ScrollView
              style={styles.modalResultsList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {extractedSubjects.map((subj, sIdx) => (
                <GlassCard key={subj.tempId} level="secondary" style={styles.previewSectionCard}>
                  {/* Subject Header & Selection Toggle */}
                  <View style={styles.previewSectionHeader}>
                    <Pressable
                      onPress={() => {
                        triggerHaptic();
                        setExtractedSubjects((prev) =>
                          prev.map((s, i) =>
                            i === sIdx ? { ...s, selected: !s.selected } : s
                          )
                        );
                      }}
                      style={styles.checkboxRow}
                    >
                      <Feather
                        name={subj.selected ? 'check-square' : 'square'}
                        size={18}
                        color={subj.selected ? '#F59E0B' : '#64748B'}
                      />
                      <Text style={styles.previewSectionTitle}>
                        SUBJECT {sIdx + 1}: {subj.name.toUpperCase()}
                      </Text>
                    </Pressable>
                  </View>

                  {/* Target Subject Selector */}
                  <View style={styles.targetSubjectSelectorRow}>
                    <Text style={styles.fieldLabelSubtle}>ASSIGNMENT:</Text>
                    <ScrollView
                      horizontal
                      showsHorizontalScrollIndicator={false}
                      style={styles.chipRow}
                      contentContainerStyle={styles.chipScrollContent}
                    >
                      <Pressable
                        onPress={() => {
                          triggerHaptic();
                          setExtractedSubjects((prev) =>
                            prev.map((s, i) =>
                              i === sIdx ? { ...s, targetSubjectId: 'new' } : s
                            )
                          );
                        }}
                        style={[
                          styles.chip,
                          subj.targetSubjectId === 'new' && styles.chipActiveAmber,
                        ]}
                      >
                        <Feather
                          name="plus-circle"
                          size={12}
                          color={subj.targetSubjectId === 'new' ? '#F59E0B' : '#94A3B8'}
                        />
                        <Text
                          style={[
                            styles.chipText,
                            subj.targetSubjectId === 'new' && styles.chipTextActiveAmber,
                          ]}
                        >
                          Add as New Subject
                        </Text>
                      </Pressable>

                      {localSubjects.map((ls) => {
                        const isSel = subj.targetSubjectId === ls.id;
                        return (
                          <Pressable
                            key={ls.id}
                            onPress={() => {
                              triggerHaptic();
                              setExtractedSubjects((prev) =>
                                prev.map((s, i) =>
                                  i === sIdx ? { ...s, targetSubjectId: ls.id } : s
                                )
                              );
                            }}
                            style={[
                              styles.chip,
                              isSel && {
                                borderColor: ls.color,
                                backgroundColor: `${ls.color}22`,
                              },
                            ]}
                          >
                            <View style={[styles.dot, { backgroundColor: ls.color }]} />
                            <Text
                              style={[
                                styles.chipText,
                                isSel && { color: ls.color, fontWeight: '800' },
                              ]}
                            >
                              {ls.name}
                            </Text>
                          </Pressable>
                        );
                      })}
                    </ScrollView>
                  </View>

                  {/* Subject Details (Editable) */}
                  <View style={styles.previewSubjectInputs}>
                    <Text style={styles.fieldLabelSubtle}>SUBJECT NAME *</Text>
                    <TextInput
                      style={styles.glowInput}
                      value={subj.name}
                      placeholder="Subject Name"
                      placeholderTextColor="#64748B"
                      onChangeText={(val) => {
                        setExtractedSubjects((prev) =>
                          prev.map((s, i) =>
                            i === sIdx ? { ...s, name: val } : s
                          )
                        );
                      }}
                    />

                    <View style={styles.inlineTwoInputs}>
                      <View style={{ flex: 1 }}>
                        <Text style={styles.fieldLabelSubtle}>COURSE CODE</Text>
                        <TextInput
                          style={styles.glowInput}
                          value={subj.code}
                          placeholder="e.g. CS201"
                          placeholderTextColor="#64748B"
                          onChangeText={(val) => {
                            setExtractedSubjects((prev) =>
                              prev.map((s, i) =>
                                i === sIdx ? { ...s, code: val } : s
                              )
                            );
                          }}
                        />
                      </View>
                      <View style={{ flex: 0.8 }}>
                        <Text style={styles.fieldLabelSubtle}>CREDITS</Text>
                        <TextInput
                          style={styles.glowInput}
                          value={subj.credits}
                          placeholder="4"
                          placeholderTextColor="#64748B"
                          keyboardType="numeric"
                          onChangeText={(val) => {
                            setExtractedSubjects((prev) =>
                              prev.map((s, i) =>
                                i === sIdx ? { ...s, credits: val } : s
                              )
                            );
                          }}
                        />
                      </View>
                    </View>
                  </View>

                  {/* Units Checklist for this Subject */}
                  <View style={styles.unitsInSubjectWrapper}>
                    <Text style={styles.unitsInSubjectHeader}>
                      UNITS & MODULES ({subj.units.length})
                    </Text>

                    {subj.units.map((u, uIdx) => (
                      <View key={u.tempId} style={styles.extractedUnitRow}>
                        <View style={styles.extractedUnitHeader}>
                          <Pressable
                            onPress={() => {
                              triggerHaptic();
                              setExtractedSubjects((prev) =>
                                prev.map((s, i) =>
                                  i === sIdx
                                    ? {
                                        ...s,
                                        units: s.units.map((unitItem, ui) =>
                                          ui === uIdx
                                            ? { ...unitItem, selected: !unitItem.selected }
                                            : unitItem
                                        ),
                                      }
                                    : s
                                )
                              );
                            }}
                            style={styles.checkboxRow}
                          >
                            <Feather
                              name={u.selected ? 'check-square' : 'square'}
                              size={16}
                              color={u.selected ? '#06B6D4' : '#64748B'}
                            />
                            <Text style={styles.extractedUnitIndex}>Unit {uIdx + 1}</Text>
                          </Pressable>

                          <Pressable
                            onPress={() => {
                              triggerHaptic();
                              setExtractedSubjects((prev) =>
                                prev.map((s, i) =>
                                  i === sIdx
                                    ? {
                                        ...s,
                                        units: s.units.filter((_, ui) => ui !== uIdx),
                                      }
                                    : s
                                )
                              );
                            }}
                            hitSlop={8}
                          >
                            <Feather name="trash-2" size={14} color="#EF4444" />
                          </Pressable>
                        </View>

                        <TextInput
                          style={styles.extractedUnitInput}
                          value={u.name}
                          placeholder="Unit Name"
                          placeholderTextColor="#64748B"
                          onChangeText={(text) => {
                            setExtractedSubjects((prev) =>
                              prev.map((s, i) =>
                                i === sIdx
                                  ? {
                                      ...s,
                                      units: s.units.map((unitItem, ui) =>
                                        ui === uIdx
                                          ? { ...unitItem, name: text }
                                          : unitItem
                                      ),
                                    }
                                  : s
                              )
                            );
                          }}
                        />

                        {u.topics.length > 0 && (
                          <View style={styles.topicsGrid}>
                            {u.topics.map((t, tIdx) => (
                              <View key={t.id} style={styles.previewTopicTag}>
                                <Text style={styles.previewTopicText}>{t.name}</Text>
                                <Pressable
                                  onPress={() => {
                                    setExtractedSubjects((prev) =>
                                      prev.map((s, i) =>
                                        i === sIdx
                                          ? {
                                              ...s,
                                              units: s.units.map((unitItem, ui) =>
                                                ui === uIdx
                                                  ? {
                                                      ...unitItem,
                                                      topics: unitItem.topics.filter(
                                                        (_, ti) => ti !== tIdx
                                                      ),
                                                    }
                                                  : unitItem
                                              ),
                                            }
                                          : s
                                      )
                                    );
                                  }}
                                  hitSlop={4}
                                >
                                  <Feather name="x" size={11} color="#94A3B8" />
                                </Pressable>
                              </View>
                            ))}
                          </View>
                        )}
                      </View>
                    ))}
                  </View>
                </GlassCard>
              ))}

              {/* Security & Reassurance Banner */}
              <View style={styles.reassuranceBanner}>
                <Feather name="shield" size={14} color="#10B981" />
                <Text style={styles.reassuranceText}>
                  Subjects and curriculum topics are only saved to local SQLite upon explicit confirmation. Discard performs 0 writes.
                </Text>
              </View>
            </ScrollView>

            {/* Modal Actions */}
            <View style={styles.modalFooter}>
              <Pressable
                onPress={handleDiscardExtractedSubjects}
                style={styles.modalCancelButton}
              >
                <Text style={styles.modalCancelText}>Discard (0 Writes)</Text>
              </Pressable>

              <Pressable
                onPress={handleConfirmExtractedSubjects}
                style={styles.modalConfirmButton}
              >
                <LinearGradient
                  colors={['#F59E0B', '#D97706']}
                  start={{ x: 0, y: 0 }}
                  end={{ x: 1, y: 0 }}
                  style={styles.modalConfirmGradient}
                >
                  <Feather name="check-circle" size={16} color="#05070B" />
                  <Text style={styles.modalConfirmText}>
                    Confirm & Add {extractedSubjects.filter((s) => s.selected).length} Subject{extractedSubjects.filter((s) => s.selected).length > 1 ? 's' : ''}
                  </Text>
                </LinearGradient>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  scrollView: { flex: 1, backgroundColor: '#080B11' },
  contentContainer: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 48,
    maxWidth: 620,
    width: '100%',
    alignSelf: 'center',
  },

  /* Ambient Volumetric Glows */
  ambientAtmosphere: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  ambientOrbAmber: {
    position: 'absolute',
    top: 60,
    left: -70,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    ...(Platform.OS === 'web' ? ({ filter: 'blur(60px)' } as any) : {}),
  },
  ambientOrbCyan: {
    position: 'absolute',
    top: 260,
    right: -70,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(6, 182, 212, 0.09)',
    ...(Platform.OS === 'web' ? ({ filter: 'blur(70px)' } as any) : {}),
  },

  /* Header */
  header: { marginBottom: 20 },
  stepBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderWidth: 0.5,
    borderColor: '#06B6D4',
    alignSelf: 'flex-start',
    marginBottom: 10,
  },
  stepBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#06B6D4',
    letterSpacing: 0.8,
  },
  title: {
    fontSize: 26,
    fontWeight: '900',
    color: '#FFFFFF',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 13.5,
    lineHeight: 19,
    color: '#94A3B8',
    marginTop: 6,
  },

  /* Section Header */
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginBottom: 10,
    marginTop: 8,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#06B6D4',
    letterSpacing: 0.8,
  },

  /* ─── Top Section: Banku Vision Card (Amber Atmosphere) ─── */
  bankuVisionCard: {
    position: 'relative',
    overflow: 'hidden',
    padding: 18,
    borderRadius: 22,
    marginBottom: 14,
    borderWidth: 0.8,
    borderColor: 'rgba(245, 158, 11, 0.45)',
    backgroundColor: 'rgba(10, 14, 22, 0.85)',
    gap: 14,
  },
  bankuBloom: {
    position: 'absolute',
    top: -20,
    right: -20,
    width: 140,
    height: 140,
    borderRadius: 70,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    ...(Platform.OS === 'web' ? ({ filter: 'blur(35px)' } as any) : {}),
  },
  bankuHeroRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  bankuAvatarShell: {
    position: 'relative',
    width: 74,
    height: 74,
    borderRadius: 18,
    borderWidth: 0.8,
    borderColor: 'rgba(245, 158, 11, 0.5)',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bankuMascotImg: {
    width: 66,
    height: 66,
  },
  bankuScanBeam: {
    position: 'absolute',
    top: '48%',
    left: 0,
    right: 0,
    height: 2,
    backgroundColor: '#F59E0B',
    opacity: 0.85,
  },
  bankuMetaCol: { flex: 1, gap: 4 },
  bankuTelemetryPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(245, 158, 11, 0.14)',
    borderWidth: 0.5,
    borderColor: 'rgba(245, 158, 11, 0.4)',
    alignSelf: 'flex-start',
  },
  pulsingAmberDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#F59E0B',
  },
  bankuTelemetryText: {
    fontSize: 9.5,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 0.6,
  },
  bankuVisionTitle: {
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: -0.2,
  },
  bankuVisionSubtitle: {
    fontSize: 12,
    lineHeight: 17,
    color: '#94A3B8',
  },
  bankuSpecsPlate: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  bankuSpecItem: { flexDirection: 'row', alignItems: 'center', gap: 5 },
  bankuSpecText: { fontSize: 10.5, fontWeight: '600', color: '#CBD5E1' },

  /* Dual Action Upload Buttons */
  dualUploadRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  uploadActionButton: {
    flex: 1,
    height: 48,
    borderRadius: 12,
    borderWidth: 0.8,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
  },
  uploadActionButtonAmber: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
  },
  uploadActionButtonAmberText: {
    color: '#F59E0B',
    fontSize: 12.5,
    fontWeight: '700',
  },
  uploadActionButtonCyan: {
    borderColor: '#06B6D4',
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
  },
  uploadActionButtonCyanText: {
    color: '#06B6D4',
    fontSize: 12.5,
    fontWeight: '700',
  },

  /* Inline Warning Banner */
  inlineWarningBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    borderWidth: 0.8,
    borderColor: 'rgba(245, 158, 11, 0.35)',
  },
  inlineWarningText: {
    color: '#F59E0B',
    fontSize: 11.5,
    fontWeight: '600',
    flex: 1,
    lineHeight: 16,
  },

  /* Staged Files Queue */
  stagingQueueContainer: {
    gap: 10,
    paddingTop: 4,
  },
  stagingQueueHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  stagingCountRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  stagingQueueTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 0.6,
  },
  clearAllButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
  },
  clearAllText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  stagedChipsList: {
    gap: 6,
  },
  stagedFileChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  stagedFileMeta: {
    flex: 1,
  },
  stagedFileName: {
    fontSize: 12,
    fontWeight: '600',
    color: '#FFFFFF',
  },
  stagedFileBadge: {
    fontSize: 10,
    color: '#94A3B8',
    marginTop: 1,
  },
  stagedFileRemoveBtn: {
    padding: 4,
  },
  bankuActionButton: {
    borderRadius: 14,
    overflow: 'hidden',
    marginTop: 2,
  },
  bankuActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 14,
    paddingHorizontal: 16,
  },
  bankuActionButtonTextDark: {
    color: '#05070B',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  emptyStagingNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.06)',
  },
  emptyStagingText: {
    fontSize: 11.5,
    color: '#94A3B8',
    flex: 1,
    lineHeight: 16,
  },

  /* ─── Glass Divider ─── */
  glassDividerContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 18,
    paddingHorizontal: 4,
    gap: 12,
  },
  glassDividerLine: {
    flex: 1,
    height: 0.5,
    backgroundColor: 'rgba(255, 255, 255, 0.12)',
  },
  glassDividerBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 12,
    paddingVertical: 5,
    borderRadius: 99,
    backgroundColor: 'rgba(15, 23, 42, 0.7)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  glassDividerText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 1.1,
  },

  /* ─── Downward Section: Manual Card ─── */
  manualCard: {
    padding: 18,
    borderRadius: 22,
    marginBottom: 20,
    gap: 16,
  },
  fieldGroup: { gap: 8 },
  labelWithSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.6,
  },
  fieldLabelSubtle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#06B6D4',
    letterSpacing: 0.5,
  },
  quickAddSubjectBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderWidth: 0.5,
    borderColor: '#06B6D4',
  },
  quickAddSubjectText: {
    fontSize: 11,
    fontWeight: '700',
    color: '#06B6D4',
  },

  /* Subject Chips */
  subjectChipsScroll: { maxHeight: 44 },
  subjectChipsContainer: { gap: 8, paddingVertical: 2 },
  subjectChip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
    gap: 6,
  },
  dot: { width: 8, height: 8, borderRadius: 4 },
  subjectChipText: { fontSize: 12.5, fontWeight: '600', color: '#E2E8F0' },
  subjectChipCode: { fontSize: 11, color: '#94A3B8' },

  /* Manual Subject Form */
  manualSubjectForm: {
    padding: 12,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(6, 182, 212, 0.25)',
    gap: 8,
    marginTop: 4,
  },
  manualFormTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#06B6D4',
  },
  saveSubjectButton: {
    height: 40,
    borderRadius: 10,
    backgroundColor: '#06B6D4',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    marginTop: 2,
  },
  saveSubjectButtonText: {
    color: '#05070B',
    fontSize: 12.5,
    fontWeight: '800',
  },

  /* Inputs */
  glowInput: {
    height: 46,
    borderRadius: 12,
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: 'rgba(6, 12, 24, 0.75)',
    paddingHorizontal: 12,
    fontSize: 13.5,
    color: '#FFFFFF',
  },
  textArea: {
    height: 74,
    paddingTop: 10,
    textAlignVertical: 'top',
  },
  inputErrorBorder: { borderColor: '#EF4444' },
  inlineTwoInputs: { flexDirection: 'row', gap: 8 },

  /* Add Unit Button */
  addUnitButton: {
    height: 46,
    borderRadius: 12,
    borderWidth: 0.8,
    borderColor: '#06B6D4',
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    marginTop: 4,
  },
  addUnitButtonText: {
    color: '#06B6D4',
    fontSize: 13,
    fontWeight: '700',
  },

  /* Units List */
  unitsListWrapper: { gap: 10, marginTop: 4 },
  unitsSectionHeader: {
    fontSize: 12,
    fontWeight: '800',
    color: '#94A3B8',
    letterSpacing: 0.4,
  },
  emptyUnitsBox: {
    padding: 24,
    borderRadius: 16,
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    borderStyle: 'dashed',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  emptyUnitsTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  emptyUnitsSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    textAlign: 'center',
    maxWidth: 280,
  },
  unitCard: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    gap: 8,
  },
  unitHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  unitTitleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    flex: 1,
  },
  unitTitleText: { fontSize: 13.5, fontWeight: '700', color: '#FFFFFF' },
  trashBtn: { padding: 4 },
  topicsGrid: { flexDirection: 'row', flexWrap: 'wrap', gap: 6 },
  topicPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3.5,
    borderRadius: 8,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  topicPillText: { fontSize: 11.5, color: '#E2E8F0' },

  /* Error Banner */
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 0.8,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  errorText: { color: '#EF4444', fontSize: 12, fontWeight: '600', flex: 1 },

  /* Bottom Actions */
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginTop: 4,
  },
  backButton: {
    height: 52,
    paddingHorizontal: 16,
    borderRadius: 26,
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    backgroundColor: 'rgba(10, 16, 28, 0.85)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  backButtonText: { fontSize: 14, fontWeight: '600', color: '#E2E8F0' },
  skipButton: {
    height: 52,
    paddingHorizontal: 14,
    borderRadius: 26,
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(10, 16, 28, 0.5)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  skipButtonText: { fontSize: 13, fontWeight: '600', color: '#94A3B8' },
  nextButtonWrapper: { flex: 1 },

  /* ─── Proposal Review Modal ─── */
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.78)',
    justifyContent: 'flex-end',
  },
  modalContainer: {
    backgroundColor: '#0A0F1D',
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    borderTopWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.18)',
    maxHeight: '88%',
    padding: 20,
    gap: 14,
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
  },
  modalHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  modalBankuAvatar: {
    width: 44,
    height: 44,
    borderRadius: 14,
    borderWidth: 0.8,
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.15)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalAvatarImg: { width: 36, height: 36 },
  modalBadgeRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  modalTitle: { fontSize: 17, fontWeight: '800', color: '#FFFFFF' },
  modalProposalBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 6,
    backgroundColor: 'rgba(245, 158, 11, 0.18)',
    borderWidth: 0.6,
    borderColor: '#F59E0B',
  },
  modalProposalBadgeText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 0.6,
  },
  modalSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
    maxWidth: 270,
  },
  modalCloseButton: {
    padding: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },

  modalResultsList: { maxHeight: 420 },
  previewSectionCard: {
    padding: 14,
    borderRadius: 16,
    marginBottom: 12,
    gap: 10,
  },
  previewSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  previewSectionTitle: {
    fontSize: 12,
    fontWeight: '800',
    color: '#F59E0B',
    letterSpacing: 0.6,
  },
  targetSubjectSelectorRow: { gap: 6 },
  chipRow: { flexDirection: 'row' },
  chipScrollContent: { gap: 6, paddingVertical: 2 },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 0.6,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  chipActiveAmber: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.2)',
  },
  chipText: { fontSize: 11.5, fontWeight: '600', color: '#94A3B8' },
  chipTextActiveAmber: { color: '#F59E0B', fontWeight: '800' },
  previewSubjectInputs: { gap: 6, marginTop: 4 },

  unitsInSubjectWrapper: { gap: 8, marginTop: 4 },
  unitsInSubjectHeader: {
    fontSize: 10.5,
    fontWeight: '800',
    color: '#06B6D4',
    letterSpacing: 0.6,
  },

  /* Extracted Units in Modal */
  extractedUnitRow: {
    padding: 10,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    gap: 8,
    marginBottom: 6,
  },
  extractedUnitHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  checkboxRow: { flexDirection: 'row', alignItems: 'center', gap: 6 },
  extractedUnitIndex: { fontSize: 12, fontWeight: '700', color: '#FFFFFF' },
  extractedUnitInput: {
    height: 38,
    borderRadius: 8,
    borderWidth: 0.6,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: 'rgba(6, 12, 24, 0.75)',
    paddingHorizontal: 10,
    fontSize: 12.5,
    color: '#FFFFFF',
  },
  previewTopicTag: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
  },
  previewTopicText: { fontSize: 11, color: '#CBD5E1' },

  reassuranceBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 10,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    marginVertical: 10,
  },
  reassuranceText: {
    fontSize: 11.5,
    color: '#10B981',
    lineHeight: 16,
    flex: 1,
  },

  modalFooter: {
    flexDirection: 'row',
    gap: 10,
    paddingTop: 10,
    borderTopWidth: 0.5,
    borderTopColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalCancelButton: {
    flex: 1,
    paddingVertical: 13,
    borderRadius: 14,
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  modalCancelText: { fontSize: 12.5, fontWeight: '600', color: '#94A3B8' },
  modalConfirmButton: {
    flex: 1.6,
    borderRadius: 14,
    overflow: 'hidden',
  },
  modalConfirmGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 13,
    paddingHorizontal: 10,
  },
  modalConfirmText: {
    color: '#05070B',
    fontSize: 12.5,
    fontWeight: '800',
  },
});
