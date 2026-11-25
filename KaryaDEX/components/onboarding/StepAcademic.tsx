/**
 * KaryaDEX — Onboarding Step 4: Academic Profile & Institution Directory
 *
 * High-velocity, 3D Liquid Glass academic registration experience featuring:
 * - Comprehensive searchable Indian University/College/Institute directory with
 *   location metadata (City, State, Acronym, Category badges) and category filter tabs
 * - Degree/Program selector with quick chips and custom degree entry
 * - Branch / Specialization selector with high-frequency suggestions
 * - Interactive Semester & Year calculation engine (Semesters 1-8/10)
 * - Attendance policy configuration matching 2.png (75%, 80%, 85%, Custom %)
 *   with safety cushion metrics and zero-debar-risk indicator
 * - Banku AI college calendar and semester schedule extraction
 *
 * Strict Architectural Rules:
 * - Exact 3D Liquid Glass, deep obsidian (#080B11) aesthetic with 0.5px specular rim borders
 * - Feather vector icons exclusively, zero emojis
 * - Zero developer/database technical jargon (no "SQLite", "Local-First", or "Cloud Sync")
 * - Canonical persistence through onboarding draft store and SQLite repositories
 */

import React, { useState, useMemo, useCallback } from 'react';
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
  Platform,
  useWindowDimensions,
  Image,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import * as DocumentPicker from 'expo-document-picker';
import * as Haptics from 'expo-haptics';
import { useTheme } from '@/constants/ThemeContext';
import { brand, typography, radii } from '@/constants/theme';
import { GlassCard, LuminousButton } from '@/components/ui';
import { MASCOT_ASSETS } from '@/constants/mascots';
import { CalendarExtractionFeature } from '@/services/ai';
import {
  fileAssetToBase64,
  extractMagicBytesFromBase64,
  readFileAsset,
  validatePdfPageLimit,
  parseFileBase64AndMime,
} from '@/lib/fileUtils';
import type { CalendarProposalPayload } from '@/services/ai/core/aiTypes';
import {
  INDIAN_INSTITUTIONS,
  INSTITUTION_CATEGORY_TABS,
  ACADEMIC_PROGRAMS,
  COMMON_BRANCHES,
  ATTENDANCE_BENCHMARKS,
  searchInstitutions,
  getProgramsForInstitution,
  getBranchesForInstitutionAndProgram,
  type IndianInstitution,
  type InstitutionCategory,
} from '@/constants/indianInstitutions';

export interface StepAcademicProps {
  initialAcademic?: {
    program?: string;
    branch?: string;
    year?: number;
    semesterNumber?: number;
    semesterName?: string;
    section?: string;
    academicYear?: string;
    startDate?: string;
    endDate?: string;
    attendanceTarget?: number;
    attendancePolicy?: string;
  };
  initialCollege?: {
    name?: string;
    shortName?: string;
    universityBoard?: string;
    campus?: string;
    city?: string;
    state?: string;
    category?: string;
  };
  initialAttendance?: {
    target?: number;
    startingTotals?: Record<string, { attended: number; total: number }>;
  };
  onNext: (data: {
    program: string;
    branch: string;
    year: number;
    semesterNumber: number;
    semesterName: string;
    section?: string;
    academicYear?: string;
    startDate?: string;
    endDate?: string;
    college?: {
      name: string;
      shortName: string;
      universityBoard?: string;
      campus?: string;
      city?: string;
      state?: string;
      category?: string;
    };
    attendanceTarget?: number;
    attendancePolicy?: string;
  }) => void;
  onBack: () => void;
}

const COMMON_DEGREES = [
  'B.Tech / B.E.',
  'Dual Degree',
  'B.Sc',
  'BCA',
  'B.Com',
  'BBA / MBA',
  'MBBS',
  'Law',
  'M.Tech',
  'Other',
];

const SEMESTER_OPTIONS = [1, 2, 3, 4, 5, 6, 7, 8];

export function StepAcademic({
  initialAcademic = {},
  initialCollege = {},
  initialAttendance = {},
  onNext,
  onBack,
}: StepAcademicProps) {
  const { colors, isDark } = useTheme();
  const { width } = useWindowDimensions();

  // ─── Institution State ────────────────────────────────────────────────
  const initialInstMatch = useMemo(() => {
    if (initialCollege.name) {
      return (
        INDIAN_INSTITUTIONS.find(
          (i) => i.name.toLowerCase() === initialCollege.name?.toLowerCase()
        ) || null
      );
    }
    return null;
  }, [initialCollege.name]);

  const [selectedInstitution, setSelectedInstitution] = useState<IndianInstitution | null>(
    initialInstMatch
  );
  const [customCollegeName, setCustomCollegeName] = useState(
    initialCollege.name && !initialInstMatch ? initialCollege.name : ''
  );
  const [customShortName, setCustomShortName] = useState(initialCollege.shortName || '');
  const [customCity, setCustomCity] = useState(initialCollege.city || '');
  const [customState, setCustomState] = useState(initialCollege.state || '');

  // Institution Modal Search & Filter
  const [isInstitutionModalVisible, setIsInstitutionModalVisible] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedCategoryTab, setSelectedCategoryTab] = useState<'All' | InstitutionCategory>('All');
  const [isCustomMode, setIsCustomMode] = useState(false);

  // ─── Academic Degree & Branch State ────────────────────────────────────
  const [program, setProgram] = useState(initialAcademic.program || 'B.Tech / B.E.');
  const [customProgram, setCustomProgram] = useState('');
  const [branch, setBranch] = useState(initialAcademic.branch || '');
  const [semesterNumber, setSemesterNumber] = useState<number>(initialAcademic.semesterNumber || 1);
  const [section, setSection] = useState(initialAcademic.section || '');
  const [academicYear, setAcademicYear] = useState(
    initialAcademic.academicYear || '2026-2027'
  );
  const [startDate, setStartDate] = useState(initialAcademic.startDate || '');
  const [endDate, setEndDate] = useState(initialAcademic.endDate || '');

  // ─── Degree & Branch Searchable Modal State ────────────────────────────
  const [isDegreeModalVisible, setIsDegreeModalVisible] = useState(false);
  const [degreeSearchQuery, setDegreeSearchQuery] = useState('');
  const [isCustomDegreeMode, setIsCustomDegreeMode] = useState(false);

  const [isBranchModalVisible, setIsBranchModalVisible] = useState(false);
  const [branchSearchQuery, setBranchSearchQuery] = useState('');
  const [isCustomBranchMode, setIsCustomBranchMode] = useState(false);
  const [customBranchInput, setCustomBranchInput] = useState('');

  // ─── College-Aware Program & Branch Offerings ──────────────────────────
  const availablePrograms = useMemo(() => {
    return getProgramsForInstitution(selectedInstitution);
  }, [selectedInstitution]);

  const availableBranches = useMemo(() => {
    return getBranchesForInstitutionAndProgram(selectedInstitution, program);
  }, [selectedInstitution, program]);

  const filteredPrograms = useMemo(() => {
    const q = degreeSearchQuery.trim().toLowerCase();
    if (!q) return availablePrograms;
    return availablePrograms.filter((p) => p.toLowerCase().includes(q));
  }, [availablePrograms, degreeSearchQuery]);

  const filteredBranches = useMemo(() => {
    const q = branchSearchQuery.trim().toLowerCase();
    if (!q) return availableBranches;
    return availableBranches.filter((b) => b.toLowerCase().includes(q));
  }, [availableBranches, branchSearchQuery]);

  // ─── Attendance Policy State ──────────────────────────────────────────
  const [attendanceTarget, setAttendanceTarget] = useState<number>(
    initialAcademic.attendanceTarget || initialAttendance.target || 80
  );
  const [customTargetText, setCustomTargetText] = useState('');
  const [isCustomTargetActive, setIsCustomTargetActive] = useState(false);

  // UI Focus & Validation State
  const [focusedField, setFocusedField] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  // ─── Banku AI Calendar Import State ───────────────────────────────────
  const [isExtracting, setIsExtracting] = useState(false);
  const [showCalendarPreview, setShowCalendarPreview] = useState(false);
  const [extractedCalendar, setExtractedCalendar] = useState<CalendarProposalPayload | null>(null);
  const [previewStartDate, setPreviewStartDate] = useState('');
  const [previewEndDate, setPreviewEndDate] = useState('');

  // ─── Filtered Institutions ────────────────────────────────────────────
  const filteredInstitutions = useMemo(() => {
    return searchInstitutions(searchQuery, selectedCategoryTab);
  }, [searchQuery, selectedCategoryTab]);

  const calculatedYear = useMemo(() => {
    return Math.ceil(semesterNumber / 2);
  }, [semesterNumber]);

  // Haptic feedback trigger
  const triggerHaptic = (style: Haptics.ImpactFeedbackStyle = Haptics.ImpactFeedbackStyle.Light) => {
    if (Platform.OS !== 'web') {
      try {
        Haptics.impactAsync(style);
      } catch {}
    }
  };

  // ─── Banku Calendar Import ────────────────────────────────────────────
  const handleBankuCalendarImport = async () => {
    try {
      triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);
      const res = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (res.canceled || !res.assets || res.assets.length === 0) return;

      const asset = res.assets[0];
      const isPdf =
        asset.name?.toLowerCase().endsWith('.pdf') ||
        asset.mimeType?.toLowerCase().includes('pdf');
      if (isPdf) {
        const pageCheck = await validatePdfPageLimit(asset.file || asset, 40);
        if (!pageCheck.valid) {
          const warningMsg =
            'Document exceeds 40 pages limit. Please upload specific calendar or timetable pages.';
          setError(warningMsg);
          Alert.alert('Notice Exceeds Limit', warningMsg);
          return;
        }
      }
      setIsExtracting(true);
      setError(null);

      const { base64, mimeType: parsedMime } = await readFileAsset(asset);
      const sanitized = parseFileBase64AndMime(
        base64,
        parsedMime || asset.mimeType || 'application/pdf'
      );
      const finalBase64 = sanitized.base64 || base64;
      const resolvedMime =
        sanitized.mimeType || parsedMime || asset.mimeType || 'application/pdf';
      const magic = extractMagicBytesFromBase64(finalBase64);

      const result = await CalendarExtractionFeature.extractCalendarProposal({
        userId: 'onboarding-student',
        fileBase64: finalBase64,
        fileMimeType: resolvedMime,
        fileName:
          asset.name ||
          (resolvedMime.includes('pdf') ? 'academic_calendar.pdf' : 'calendar.png'),
        fileSizeBytes: asset.size || Math.round((finalBase64.length * 3) / 4),
        magicBytes: magic,
      });

      const payload = result.data;
      setExtractedCalendar(payload);
      setPreviewStartDate(payload.startDate || '');
      setPreviewEndDate(payload.endDate || '');
      setShowCalendarPreview(true);
    } catch (err: any) {
      setError(err?.message || 'Failed to extract calendar schedule.');
    } finally {
      setIsExtracting(false);
    }
  };

  const handleApplyCalendar = () => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    if (previewStartDate) setStartDate(previewStartDate);
    if (previewEndDate) setEndDate(previewEndDate);
    setShowCalendarPreview(false);
  };

  const handleDiscardCalendar = () => {
    setShowCalendarPreview(false);
    setExtractedCalendar(null);
  };

  // ─── Navigation & Persistence ─────────────────────────────────────────
  const handleNext = () => {
    // 1. Institution validation
    let resolvedCollege:
      | {
          name: string;
          shortName: string;
          city?: string;
          state?: string;
          category?: string;
          universityBoard?: string;
          campus?: string;
        }
      | undefined;

    if (selectedInstitution) {
      resolvedCollege = {
        name: selectedInstitution.name,
        shortName: selectedInstitution.shortName,
        city: selectedInstitution.city,
        state: selectedInstitution.state,
        category: selectedInstitution.category,
        campus: selectedInstitution.city,
      };
    } else if (customCollegeName.trim()) {
      resolvedCollege = {
        name: customCollegeName.trim(),
        shortName:
          customShortName.trim() ||
          customCollegeName
            .trim()
            .split(' ')
            .map((w) => w[0])
            .join('')
            .slice(0, 8)
            .toUpperCase(),
        city: customCity.trim() || undefined,
        state: customState.trim() || undefined,
        category: 'Other',
      };
    } else if (initialCollege.name) {
      resolvedCollege = {
        name: initialCollege.name,
        shortName: initialCollege.shortName || initialCollege.name.slice(0, 8),
        city: initialCollege.city,
        state: initialCollege.state,
        category: initialCollege.category,
        campus: initialCollege.campus,
      };
    } else {
      setError('Please select or enter your institution/college.');
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      return;
    }

    // 2. Program validation
    const resolvedProgram = (program === 'Other' ? customProgram : program).trim();
    if (!resolvedProgram) {
      setError('Please select or specify your degree / program.');
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      return;
    }

    // 3. Branch validation
    if (!branch.trim()) {
      setError('Please enter your branch, major, or department.');
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      return;
    }

    // 4. Attendance Target validation
    const activeTarget = isCustomTargetActive
      ? parseInt(customTargetText, 10)
      : attendanceTarget;
    if (isNaN(activeTarget) || activeTarget < 1 || activeTarget > 100) {
      setError('Attendance benchmark must be a valid percentage between 1% and 100%.');
      triggerHaptic(Haptics.ImpactFeedbackStyle.Heavy);
      return;
    }

    setError(null);
    triggerHaptic(Haptics.ImpactFeedbackStyle.Medium);

    onNext({
      program: resolvedProgram,
      branch: branch.trim(),
      year: calculatedYear,
      semesterNumber,
      semesterName: `Semester ${semesterNumber}`,
      section: section.trim() || undefined,
      academicYear: academicYear.trim() || undefined,
      startDate: startDate.trim() || undefined,
      endDate: endDate.trim() || undefined,
      college: resolvedCollege,
      attendanceTarget: activeTarget,
      attendancePolicy:
        activeTarget >= 85
          ? 'Elite Safe Harbor (85%)'
          : activeTarget >= 80
          ? 'Safety Cushion Harbor (80%)'
          : 'Standard Statutory Cutoff (75%)',
    });
  };

  // ─── Institution Selection ────────────────────────────────────────────
  const handleSelectInstitution = (inst: IndianInstitution) => {
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setSelectedInstitution(inst);
    setCustomCollegeName('');
    setIsInstitutionModalVisible(false);
    setError(null);

    const offered = getProgramsForInstitution(inst);
    const isCurrentOffered = offered.some(
      (p) =>
        p.toLowerCase() === program.toLowerCase() ||
        (program.includes('B.Tech') && p.includes('B.Tech'))
    );
    if (!isCurrentOffered && offered.length > 0) {
      setProgram(offered[0]);
    }
  };

  const handleApplyCustomCollege = () => {
    if (!customCollegeName.trim()) {
      Alert.alert('Institution Required', 'Please enter your institution name.');
      return;
    }
    triggerHaptic(Haptics.ImpactFeedbackStyle.Light);
    setSelectedInstitution(null);
    setIsInstitutionModalVisible(false);
    setError(null);
  };

  // Category Tag Styler
  const getCategoryColor = (cat: IndianInstitution['category']) => {
    switch (cat) {
      case 'IIT':
      case 'NIT':
        return '#10B981'; // Emerald
      case 'IIIT':
      case 'Central':
        return '#06B6D4'; // Electric Cyan
      case 'State':
        return '#818CF8'; // Indigo
      case 'Deemed / Private':
        return '#F59E0B'; // Amber
      case 'Medical / Law':
        return '#EC4899'; // Pink
      default:
        return '#94A3B8';
    }
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      {/* ─── Ambient Glow Lighting Effects (Matching 2.png) ─── */}
      <View pointerEvents="none" style={styles.ambientAtmosphere}>
        <View style={styles.ambientOrbLeft} />
        <View style={styles.ambientOrbRight} />
      </View>

      {/* ─── Header Section ─── */}
      <View style={styles.header}>
        <View style={styles.titleBadge}>
          <Feather name="layers" size={12} color="#06B6D4" />
          <Text style={styles.titleBadgeText}>ACADEMIC ONBOARDING</Text>
        </View>
        <Text style={styles.title}>Academic Structure</Text>
        <Text style={styles.subtitle}>
          Select your institution, degree, and attendance benchmark to calibrate your semester dashboard.
        </Text>
      </View>

      {/* ─── Card 1: Institution Directory Selector ─── */}
      <View style={styles.sectionHeaderRow}>
        <Feather name="award" size={15} color="#06B6D4" />
        <Text style={styles.sectionTitle}>INSTITUTION & CAMPUS</Text>
      </View>

      <GlassCard level="primary" style={styles.card}>
        {selectedInstitution ? (
          <View style={styles.selectedInstCard}>
            <View style={styles.instMetaRow}>
              <View
                style={[
                  styles.categoryTag,
                  {
                    borderColor: getCategoryColor(selectedInstitution.category),
                    backgroundColor: `${getCategoryColor(selectedInstitution.category)}18`,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.categoryTagText,
                    { color: getCategoryColor(selectedInstitution.category) },
                  ]}
                >
                  {selectedInstitution.category}
                </Text>
              </View>

              <View style={styles.shortNameBadge}>
                <Text style={styles.shortNameBadgeText}>
                  {selectedInstitution.shortName}
                </Text>
              </View>
            </View>

            <Text style={styles.instSelectedName}>{selectedInstitution.name}</Text>

            <View style={styles.locationPinRow}>
              <Feather name="map-pin" size={13} color="#94A3B8" />
              <Text style={styles.locationPinText}>
                {selectedInstitution.city}, {selectedInstitution.state}
              </Text>
            </View>

            <Pressable
              onPress={() => {
                triggerHaptic();
                setIsInstitutionModalVisible(true);
              }}
              style={({ pressed }) => [
                styles.changeInstButton,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Feather name="search" size={14} color="#06B6D4" />
              <Text style={styles.changeInstButtonText}>Change Institution</Text>
            </Pressable>
          </View>
        ) : customCollegeName ? (
          <View style={styles.selectedInstCard}>
            <View style={styles.instMetaRow}>
              <View
                style={[
                  styles.categoryTag,
                  { borderColor: '#F59E0B', backgroundColor: 'rgba(245, 158, 11, 0.12)' },
                ]}
              >
                <Text style={[styles.categoryTagText, { color: '#F59E0B' }]}>
                  Custom Institution
                </Text>
              </View>
              {customShortName ? (
                <View style={styles.shortNameBadge}>
                  <Text style={styles.shortNameBadgeText}>{customShortName}</Text>
                </View>
              ) : null}
            </View>

            <Text style={styles.instSelectedName}>{customCollegeName}</Text>

            {(customCity || customState) && (
              <View style={styles.locationPinRow}>
                <Feather name="map-pin" size={13} color="#94A3B8" />
                <Text style={styles.locationPinText}>
                  {[customCity, customState].filter(Boolean).join(', ')}
                </Text>
              </View>
            )}

            <Pressable
              onPress={() => {
                triggerHaptic();
                setIsInstitutionModalVisible(true);
              }}
              style={({ pressed }) => [
                styles.changeInstButton,
                pressed && { opacity: 0.8 },
              ]}
            >
              <Feather name="edit-2" size={14} color="#06B6D4" />
              <Text style={styles.changeInstButtonText}>Edit Details</Text>
            </Pressable>
          </View>
        ) : (
          <Pressable
            onPress={() => {
              triggerHaptic();
              setIsInstitutionModalVisible(true);
            }}
            style={({ pressed }) => [
              styles.instSelectorTrigger,
              pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
            ]}
          >
            <View style={styles.instIconCircle}>
              <Feather name="search" size={18} color="#06B6D4" />
            </View>
            <View style={styles.instTriggerTextWrapper}>
              <Text style={styles.instTriggerTitle}>Select Your Institution</Text>
              <Text style={styles.instTriggerSubtitle}>
                Search 120+ IITs, NITs, IIITs, State & Central Universities
              </Text>
            </View>
            <Feather name="chevron-right" size={20} color="#64748B" />
          </Pressable>
        )}
      </GlassCard>

      {/* ─── Card 2: Degree & Branch Selection ─── */}
      <View style={styles.sectionHeaderRow}>
        <Feather name="book-open" size={15} color="#06B6D4" />
        <Text style={styles.sectionTitle}>DEGREE & SPECIALIZATION</Text>
      </View>

      <GlassCard level="primary" style={styles.card}>
        {/* Degree Selection with College-Aware Dropdown */}
        <View style={styles.fieldGroup}>
          <View style={styles.labelWithSubRow}>
            <Text style={styles.fieldLabel}>PROGRAM / DEGREE *</Text>
            {selectedInstitution && (
              <Text style={styles.institutionScopeBadge}>
                {selectedInstitution.shortName} Curricula
              </Text>
            )}
          </View>

          {/* Trigger button for Degree Dropdown */}
          <Pressable
            onPress={() => {
              triggerHaptic();
              setIsDegreeModalVisible(true);
            }}
            style={({ pressed }) => [
              styles.dropdownTrigger,
              pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
            ]}
          >
            <View style={styles.dropdownTriggerIcon}>
              <Feather name="award" size={16} color="#06B6D4" />
            </View>
            <View style={styles.dropdownTriggerContent}>
              <Text style={styles.dropdownTriggerTitle}>
                {program || 'Select Degree / Program'}
              </Text>
              <Text style={styles.dropdownTriggerSubtitle}>
                {selectedInstitution
                  ? `${availablePrograms.length} degree programs offered at ${selectedInstitution.shortName}`
                  : 'Tap to browse degrees across all Indian institutions'}
              </Text>
            </View>
            <Feather name="chevron-down" size={18} color="#94A3B8" />
          </Pressable>

          {/* College-Aware Quick Degree Chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipRow}
            contentContainerStyle={styles.chipScrollContent}
          >
            {availablePrograms.slice(0, 5).map((deg) => {
              const isSelected = program === deg;
              return (
                <Pressable
                  key={deg}
                  onPress={() => {
                    triggerHaptic();
                    setProgram(deg);
                    setIsCustomDegreeMode(false);
                  }}
                  style={[styles.chip, isSelected && styles.chipActive]}
                >
                  <Text style={[styles.chipText, isSelected && styles.chipTextActive]}>
                    {deg}
                  </Text>
                </Pressable>
              );
            })}
            <Pressable
              onPress={() => {
                triggerHaptic();
                setIsDegreeModalVisible(true);
              }}
              style={styles.moreChip}
            >
              <Feather name="more-horizontal" size={13} color="#06B6D4" />
              <Text style={styles.moreChipText}>All Programs</Text>
            </Pressable>
          </ScrollView>

          {program === 'Other' && (
            <TextInput
              style={[
                styles.glowInput,
                focusedField === 'customProgram' && styles.glowInputFocused,
              ]}
              placeholder="Type your degree name (e.g. B.Des / M.Sc)"
              placeholderTextColor="#64748B"
              value={customProgram}
              onFocus={() => setFocusedField('customProgram')}
              onBlur={() => setFocusedField(null)}
              onChangeText={setCustomProgram}
            />
          )}
        </View>

        {/* Branch / Major / Discipline Selection */}
        <View style={styles.fieldGroup}>
          <View style={styles.labelWithSubRow}>
            <Text style={styles.fieldLabel}>BRANCH / MAJOR / DISCIPLINE *</Text>
            <Text style={styles.branchCountBadge}>
              {availableBranches.length} Disciplines
            </Text>
          </View>

          {/* Trigger button for Branch Dropdown */}
          <Pressable
            onPress={() => {
              triggerHaptic();
              setIsBranchModalVisible(true);
            }}
            style={({ pressed }) => [
              styles.dropdownTrigger,
              pressed && { opacity: 0.85, transform: [{ scale: 0.99 }] },
            ]}
          >
            <View style={styles.dropdownTriggerIcon}>
              <Feather name="layers" size={16} color="#06B6D4" />
            </View>
            <View style={styles.dropdownTriggerContent}>
              <Text style={styles.dropdownTriggerTitle}>
                {branch || 'Choose your branch or major'}
              </Text>
              <Text style={styles.dropdownTriggerSubtitle}>
                {selectedInstitution
                  ? `Select from ${selectedInstitution.shortName} ${program} branches`
                  : 'Tap to browse available engineering & university disciplines'}
              </Text>
            </View>
            <Feather name="chevron-down" size={18} color="#94A3B8" />
          </Pressable>

          {/* Editable text input for instant custom typing/editing */}
          <TextInput
            style={[
              styles.glowInput,
              focusedField === 'branch' && styles.glowInputFocused,
              error && !branch.trim() ? styles.inputErrorBorder : null,
            ]}
            placeholder="or type custom branch (e.g. Production Engineering)"
            placeholderTextColor="#64748B"
            value={branch}
            onFocus={() => setFocusedField('branch')}
            onBlur={() => setFocusedField(null)}
            onChangeText={(val) => {
              setBranch(val);
              if (error) setError(null);
            }}
          />

          {/* High-frequency college-specific branch chips */}
          <ScrollView
            horizontal
            showsHorizontalScrollIndicator={false}
            style={styles.chipRow}
            contentContainerStyle={styles.chipScrollContent}
          >
            {availableBranches.slice(0, 6).map((b) => (
              <Pressable
                key={b}
                onPress={() => {
                  triggerHaptic();
                  setBranch(b);
                  if (error) setError(null);
                }}
                style={[
                  styles.microChip,
                  branch === b && styles.microChipActive,
                ]}
              >
                <Text
                  style={[
                    styles.microChipText,
                    branch === b && styles.microChipTextActive,
                  ]}
                >
                  {b.length > 28 ? `${b.slice(0, 26)}...` : b}
                </Text>
              </Pressable>
            ))}
            <Pressable
              onPress={() => {
                triggerHaptic();
                setIsBranchModalVisible(true);
              }}
              style={styles.microChipMore}
            >
              <Feather name="search" size={11} color="#06B6D4" />
              <Text style={styles.microChipMoreText}>Browse All</Text>
            </Pressable>
          </ScrollView>
        </View>

        {/* Current Semester */}
        <View style={styles.fieldGroup}>
          <View style={styles.labelWithSubRow}>
            <Text style={styles.fieldLabel}>CURRENT SEMESTER *</Text>
            <Text style={styles.calculatedYearBadge}>
              Year {calculatedYear} • Semester {semesterNumber}
            </Text>
          </View>

          <View style={styles.semestersGrid}>
            {SEMESTER_OPTIONS.map((sem) => {
              const isSelected = semesterNumber === sem;
              return (
                <Pressable
                  key={sem}
                  onPress={() => {
                    triggerHaptic();
                    setSemesterNumber(sem);
                  }}
                  style={[
                    styles.semTile,
                    isSelected && styles.semTileActive,
                  ]}
                >
                  <Text
                    style={[
                      styles.semTileNumber,
                      isSelected && styles.semTileNumberActive,
                    ]}
                  >
                    {sem}
                  </Text>
                  <Text
                    style={[
                      styles.semTileSub,
                      isSelected && styles.semTileSubActive,
                    ]}
                  >
                    Sem
                  </Text>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Optional Section / Batch */}
        <View style={styles.fieldGroup}>
          <Text style={styles.fieldLabelSubtle}>SECTION / BATCH (OPTIONAL)</Text>
          <TextInput
            style={[
              styles.glowInput,
              focusedField === 'section' && styles.glowInputFocused,
            ]}
            placeholder="e.g. Section A / Batch 1"
            placeholderTextColor="#64748B"
            value={section}
            onFocus={() => setFocusedField('section')}
            onBlur={() => setFocusedField(null)}
            onChangeText={setSection}
          />
        </View>
      </GlassCard>

      {/* ─── Card 3: Attendance Policy Configuration (Matching 2.png) ─── */}
      <View style={styles.sectionHeaderRow}>
        <Feather name="shield" size={15} color="#10B981" />
        <Text style={styles.sectionTitle}>ATTENDANCE HEALTH BENCHMARK</Text>
      </View>

      <GlassCard level="primary" style={styles.card}>
        <Text style={styles.attendancePolicyDesc}>
          Set your target cutoff to continuously model safety cushions and avoid exam eligibility debar notices.
        </Text>

        {/* Target Benchmark Row */}
        <View style={styles.benchmarkButtonsRow}>
          {ATTENDANCE_BENCHMARKS.map((b) => {
            const isSelected = !isCustomTargetActive && attendanceTarget === b.percent;
            return (
              <Pressable
                key={b.percent}
                onPress={() => {
                  triggerHaptic();
                  setIsCustomTargetActive(false);
                  setAttendanceTarget(b.percent);
                }}
                style={[
                  styles.benchmarkTile,
                  isSelected && {
                    borderColor: b.color,
                    backgroundColor: `${b.color}22`,
                  },
                ]}
              >
                <Text
                  style={[
                    styles.benchmarkPercent,
                    isSelected && { color: b.color },
                  ]}
                >
                  {b.percent}%
                </Text>
                <Text
                  style={[
                    styles.benchmarkLabel,
                    isSelected && { color: '#FFFFFF', fontWeight: '700' },
                  ]}
                  numberOfLines={1}
                >
                  {b.percent === 75 ? 'Standard' : b.percent === 80 ? 'Safe' : 'Elite'}
                </Text>
              </Pressable>
            );
          })}

          <Pressable
            onPress={() => {
              triggerHaptic();
              setIsCustomTargetActive(true);
            }}
            style={[
              styles.benchmarkTile,
              isCustomTargetActive && {
                borderColor: '#F59E0B',
                backgroundColor: 'rgba(245, 158, 11, 0.22)',
              },
            ]}
          >
            <Text
              style={[
                styles.benchmarkPercent,
                isCustomTargetActive && { color: '#F59E0B' },
              ]}
            >
              Custom
            </Text>
            <Text
              style={[
                styles.benchmarkLabel,
                isCustomTargetActive && { color: '#FFFFFF', fontWeight: '700' },
              ]}
            >
              Target
            </Text>
          </Pressable>
        </View>

        {isCustomTargetActive && (
          <View style={styles.customTargetWrapper}>
            <Text style={styles.fieldLabel}>CUSTOM ATTENDANCE CUTOFF %</Text>
            <TextInput
              style={[styles.glowInput, styles.glowInputFocused]}
              placeholder="e.g. 70 or 82"
              placeholderTextColor="#64748B"
              keyboardType="numeric"
              value={customTargetText}
              onChangeText={(val) => {
                setCustomTargetText(val);
                const num = parseInt(val, 10);
                if (!isNaN(num) && num >= 1 && num <= 100) {
                  setAttendanceTarget(num);
                }
              }}
              autoFocus
            />
          </View>
        )}

        {/* ─── Attendance Gauge Plate (Direct aesthetic tribute to 2.png) ─── */}
        <View style={styles.attendanceGaugePlate}>
          <View style={styles.gaugeHeaderRow}>
            <View style={styles.gaugeBadge}>
              <Feather name="trending-up" size={13} color="#10B981" />
              <Text style={styles.gaugeBadgeText}>
                Safety Cushion: +{Math.max(0, attendanceTarget - 75).toFixed(1)}% Above Target
              </Text>
            </View>

            <View style={styles.debarRiskBadge}>
              <Feather name="shield" size={12} color="#10B981" />
              <Text style={styles.debarRiskText}>Zero Debar Risk</Text>
            </View>
          </View>

          <View style={styles.gaugeValueRow}>
            <Text style={styles.gaugeValueLarge}>{attendanceTarget}.0%</Text>
            <Text style={styles.gaugeValueSub}>Mandatory Baseline</Text>
          </View>

          {/* Interactive Feature Mini-Pills matching 2.png */}
          <View style={styles.gaugeMiniPillsRow}>
            <View style={styles.miniPill}>
              <Feather name="activity" size={12} color="#06B6D4" />
              <Text style={styles.miniPillText}>Verified Lab Credits</Text>
            </View>
            <View style={styles.miniPill}>
              <Feather name="bar-chart-2" size={12} color="#818CF8" />
              <Text style={styles.miniPillText}>Deterministic Tracking</Text>
            </View>
          </View>
        </View>
      </GlassCard>

      {/* ─── Card 4: Authentic Banku Vision Liquid Glass Card (Task 3) ─── */}
      <View style={styles.sectionHeaderRow}>
        <Feather name="eye" size={15} color="#F59E0B" />
        <Text style={[styles.sectionTitle, { color: '#F59E0B' }]}>BANKU VISION AI</Text>
      </View>

      <GlassCard level="primary" style={styles.bankuVisionCard}>
        {/* Soft amber bloom */}
        <View style={styles.bankuBloom} pointerEvents="none" />

        {/* Mascot & Header Row */}
        <View style={styles.bankuHeroRow}>
          {/* Banku Mascot Visual Container */}
          <View style={styles.bankuAvatarShell}>
            <Image
              source={MASCOT_ASSETS.banku.poses.scanning}
              style={styles.bankuMascotImg}
              resizeMode="contain"
            />
            {/* Holographic scanning laser line */}
            <View style={styles.bankuScanBeam} />
          </View>

          {/* Banku Info & Live Sentinel Telemetry */}
          <View style={styles.bankuMetaCol}>
            <View style={styles.bankuTelemetryPill}>
              <View style={styles.pulsingAmberDot} />
              <Text style={styles.bankuTelemetryText}>VISION SENTINEL • ACTIVE</Text>
            </View>
            <Text style={styles.bankuVisionTitle}>Import College Calendar</Text>
            <Text style={styles.bankuVisionSubtitle}>
              Scan academic circular, timetable, or calendar notice. Banku detects semester start, end dates & official holidays.
            </Text>
          </View>
        </View>

        {/* Capabilities / Policy Reassurance Banner */}
        <View style={styles.bankuSpecsPlate}>
          <View style={styles.bankuSpecItem}>
            <Feather name="shield" size={12} color="#10B981" />
            <Text style={styles.bankuSpecText}>40-Page Sentinel</Text>
          </View>
          <View style={styles.bankuSpecItem}>
            <Feather name="cpu" size={12} color="#F59E0B" />
            <Text style={styles.bankuSpecText}>PDF & Image AI</Text>
          </View>
          <View style={styles.bankuSpecItem}>
            <Feather name="lock" size={12} color="#06B6D4" />
            <Text style={styles.bankuSpecText}>Sanitized Base64</Text>
          </View>
        </View>

        {/* Primary Banku Vision Action Button */}
        <Pressable
          onPress={handleBankuCalendarImport}
          disabled={isExtracting}
          style={({ pressed }) => [
            styles.bankuActionButton,
            pressed && { opacity: 0.88, transform: [{ scale: 0.99 }] },
            isExtracting && { opacity: 0.7 },
          ]}
        >
          <LinearGradient
            colors={['rgba(245, 158, 11, 0.35)', 'rgba(217, 119, 6, 0.20)']}
            start={{ x: 0, y: 0 }}
            end={{ x: 1, y: 0 }}
            style={styles.bankuActionGradient}
          >
            {isExtracting ? (
              <ActivityIndicator size="small" color="#F59E0B" />
            ) : (
              <Feather name="upload-cloud" size={16} color="#F59E0B" />
            )}
            <Text style={styles.bankuActionButtonText}>
              {isExtracting
                ? 'Banku Vision Extracting Calendar...'
                : 'Upload & Scan Calendar with Banku'}
            </Text>
          </LinearGradient>
        </Pressable>

        {/* Detected Dates Pill */}
        {(startDate || endDate) && (
          <View style={styles.bankuDatesPill}>
            <Feather name="check-circle" size={14} color="#10B981" />
            <Text style={styles.bankuDatesText}>
              Verified Semester Dates: {startDate || '—'} to {endDate || '—'}
            </Text>
          </View>
        )}
      </GlassCard>

      {/* Error Banner */}
      {error && (
        <View style={styles.errorBanner}>
          <Feather name="alert-triangle" size={16} color="#EF4444" />
          <Text style={styles.errorText}>{error}</Text>
        </View>
      )}

      {/* ─── Bottom Actions (Back & Primary CTA) ─── */}
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

        <View style={styles.nextButtonWrapper}>
          <LuminousButton
            title="Continue"
            onPress={handleNext}
            size="medium"
            showArrow
          />
        </View>
      </View>

      {/* ─── Institution Search & Directory Modal ─── */}
      <Modal
        visible={isInstitutionModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsInstitutionModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            {/* Header */}
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Indian Institution Directory</Text>
                <Text style={styles.modalSubtitle}>
                  Select your university, national institute, or college campus
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  triggerHaptic();
                  setIsInstitutionModalVisible(false);
                }}
                hitSlop={8}
                style={styles.modalCloseButton}
              >
                <Feather name="x" size={20} color="#94A3B8" />
              </Pressable>
            </View>

            {/* Search Input */}
            <View style={styles.modalSearchContainer}>
              <Feather name="search" size={16} color="#06B6D4" />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search by name, acronym (e.g. NITA, IITD), or city..."
                placeholderTextColor="#64748B"
                value={searchQuery}
                onChangeText={setSearchQuery}
                autoFocus
              />
              {searchQuery ? (
                <Pressable onPress={() => setSearchQuery('')} hitSlop={6}>
                  <Feather name="x-circle" size={16} color="#64748B" />
                </Pressable>
              ) : null}
            </View>

            {/* Category Filter Pills */}
            <ScrollView
              horizontal
              showsHorizontalScrollIndicator={false}
              style={styles.categoryPillsScroll}
              contentContainerStyle={styles.categoryPillsContainer}
            >
              {INSTITUTION_CATEGORY_TABS.map((tab) => {
                const isActive = selectedCategoryTab === tab.key;
                return (
                  <Pressable
                    key={tab.key}
                    onPress={() => {
                      triggerHaptic();
                      setSelectedCategoryTab(tab.key);
                    }}
                    style={[
                      styles.categoryFilterPill,
                      isActive && styles.categoryFilterPillActive,
                    ]}
                  >
                    <Feather
                      name={tab.iconName}
                      size={12}
                      color={isActive ? '#05070B' : '#94A3B8'}
                    />
                    <Text
                      style={[
                        styles.categoryFilterPillText,
                        isActive && styles.categoryFilterPillTextActive,
                      ]}
                    >
                      {tab.label}
                    </Text>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Results List */}
            <ScrollView
              style={styles.modalResultsList}
              showsVerticalScrollIndicator={false}
              keyboardShouldPersistTaps="handled"
            >
              {filteredInstitutions.length > 0 ? (
                filteredInstitutions.map((inst) => {
                  const isSelected = selectedInstitution?.id === inst.id;
                  const catColor = getCategoryColor(inst.category);
                  return (
                    <Pressable
                      key={inst.id}
                      onPress={() => handleSelectInstitution(inst)}
                      style={({ pressed }) => [
                        styles.instResultRow,
                        isSelected && styles.instResultRowSelected,
                        pressed && { opacity: 0.8 },
                      ]}
                    >
                      <View style={styles.instResultContent}>
                        <View style={styles.instResultTopRow}>
                          <View
                            style={[
                              styles.categoryMicroBadge,
                              { borderColor: catColor, backgroundColor: `${catColor}15` },
                            ]}
                          >
                            <Text style={[styles.categoryMicroBadgeText, { color: catColor }]}>
                              {inst.category}
                            </Text>
                          </View>
                          <Text style={styles.instResultShortName}>{inst.shortName}</Text>
                        </View>

                        <Text style={styles.instResultFullName}>{inst.name}</Text>

                        <View style={styles.instResultBottomRow}>
                          <Feather name="map-pin" size={12} color="#64748B" />
                          <Text style={styles.instResultLocation}>
                            {inst.city}, {inst.state}
                          </Text>
                        </View>
                      </View>

                      <Feather
                        name={isSelected ? 'check-circle' : 'chevron-right'}
                        size={18}
                        color={isSelected ? '#10B981' : '#64748B'}
                      />
                    </Pressable>
                  );
                })
              ) : (
                <View style={styles.noResultsCard}>
                  <Feather name="info" size={24} color="#06B6D4" />
                  <Text style={styles.noResultsTitle}>No institution found</Text>
                  <Text style={styles.noResultsDesc}>
                    Can&apos;t find your institution in our directory? You can register it manually.
                  </Text>
                  <Pressable
                    onPress={() => setIsCustomMode(true)}
                    style={styles.customAddButton}
                  >
                    <Feather name="plus-circle" size={16} color="#00E5FF" />
                    <Text style={styles.customAddButtonText}>Type Custom College Details</Text>
                  </Pressable>
                </View>
              )}

              {/* Custom Institution Manual Form */}
              {isCustomMode && (
                <View style={styles.customFormBox}>
                  <Text style={styles.customFormTitle}>Register Custom Institution</Text>
                  <TextInput
                    style={styles.customFormInput}
                    placeholder="Full Institution Name *"
                    placeholderTextColor="#64748B"
                    value={customCollegeName}
                    onChangeText={setCustomCollegeName}
                  />
                  <TextInput
                    style={styles.customFormInput}
                    placeholder="Abbreviation / Acronym (e.g. NITA, DU)"
                    placeholderTextColor="#64748B"
                    value={customShortName}
                    onChangeText={setCustomShortName}
                  />
                  <View style={styles.inlineTwoInputs}>
                    <TextInput
                      style={[styles.customFormInput, { flex: 1 }]}
                      placeholder="City (e.g. Agartala)"
                      placeholderTextColor="#64748B"
                      value={customCity}
                      onChangeText={setCustomCity}
                    />
                    <TextInput
                      style={[styles.customFormInput, { flex: 1 }]}
                      placeholder="State (e.g. Tripura)"
                      placeholderTextColor="#64748B"
                      value={customState}
                      onChangeText={setCustomState}
                    />
                  </View>
                  <Pressable
                    onPress={handleApplyCustomCollege}
                    style={styles.applyCustomButton}
                  >
                    <Text style={styles.applyCustomButtonText}>Apply Institution</Text>
                  </Pressable>
                </View>
              )}
            </ScrollView>

            {/* Modal Bottom Toggle */}
            {!isCustomMode && (
              <Pressable
                onPress={() => setIsCustomMode(true)}
                style={styles.modalBottomToggle}
              >
                <Feather name="edit" size={13} color="#06B6D4" />
                <Text style={styles.modalBottomToggleText}>
                  Can&apos;t find your college? Type custom details
                </Text>
              </Pressable>
            )}
          </View>
        </View>
      </Modal>

      {/* ─── Editable Calendar Preview Modal ─── */}
      <Modal
        visible={showCalendarPreview}
        animationType="slide"
        transparent
        onRequestClose={handleDiscardCalendar}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Banku Detected Calendar</Text>
                <Text style={styles.modalSubtitle}>
                  Review detected semester dates, exams, and holidays.
                </Text>
              </View>
              <Pressable onPress={handleDiscardCalendar} hitSlop={8}>
                <Feather name="x" size={22} color="#94A3B8" />
              </Pressable>
            </View>

            <ScrollView style={styles.modalResultsList} showsVerticalScrollIndicator={false}>
              <GlassCard level="secondary" style={styles.previewCard}>
                <Text style={styles.previewSectionTitle}>SEMESTER TIMELINE</Text>
                <View style={styles.inlineTwoInputs}>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabelSubtle}>START DATE</Text>
                    <TextInput
                      style={styles.glowInput}
                      value={previewStartDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#64748B"
                      onChangeText={setPreviewStartDate}
                    />
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={styles.fieldLabelSubtle}>END DATE</Text>
                    <TextInput
                      style={styles.glowInput}
                      value={previewEndDate}
                      placeholder="YYYY-MM-DD"
                      placeholderTextColor="#64748B"
                      onChangeText={setPreviewEndDate}
                    />
                  </View>
                </View>
              </GlassCard>

              {extractedCalendar && extractedCalendar.holidays.length > 0 && (
                <GlassCard level="secondary" style={styles.previewCard}>
                  <Text style={styles.previewSectionTitle}>
                    OFFICIAL HOLIDAYS ({extractedCalendar.holidays.length})
                  </Text>
                  {extractedCalendar.holidays.map((h, idx) => (
                    <View key={idx} style={styles.previewItemRow}>
                      <Feather name="calendar" size={13} color="#10B981" />
                      <Text style={styles.previewItemDate}>{h.date}</Text>
                      <Text style={styles.previewItemName}>{h.name}</Text>
                    </View>
                  ))}
                </GlassCard>
              )}
            </ScrollView>

            <View style={styles.modalFooter}>
              <Pressable onPress={handleDiscardCalendar} style={styles.modalCancelButton}>
                <Text style={styles.modalCancelText}>Cancel</Text>
              </Pressable>
              <Pressable onPress={handleApplyCalendar} style={styles.modalConfirmButton}>
                <Text style={styles.modalConfirmText}>Apply Dates to Setup</Text>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

      {/* ─── Degree / Program Searchable Dropdown Modal ─── */}
      <Modal
        visible={isDegreeModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsDegreeModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select Program / Degree</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedInstitution
                    ? `Curricular offerings for ${selectedInstitution.shortName}`
                    : 'Select your academic degree program'}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  triggerHaptic();
                  setIsDegreeModalVisible(false);
                }}
                hitSlop={8}
                style={styles.modalCloseButton}
              >
                <Feather name="x" size={20} color="#94A3B8" />
              </Pressable>
            </View>

            <View style={styles.modalSearchContainer}>
              <Feather name="search" size={16} color="#06B6D4" />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search programs (e.g. B.Tech, M.Tech, MCA)..."
                placeholderTextColor="#64748B"
                value={degreeSearchQuery}
                onChangeText={setDegreeSearchQuery}
                autoFocus
              />
              {degreeSearchQuery ? (
                <Pressable onPress={() => setDegreeSearchQuery('')} hitSlop={6}>
                  <Feather name="x-circle" size={16} color="#64748B" />
                </Pressable>
              ) : null}
            </View>

            <ScrollView style={styles.modalResultsList} showsVerticalScrollIndicator={false}>
              {filteredPrograms.map((deg) => {
                const isSelected = program === deg;
                return (
                  <Pressable
                    key={deg}
                    onPress={() => {
                      triggerHaptic();
                      setProgram(deg);
                      setIsDegreeModalVisible(false);
                      setDegreeSearchQuery('');
                    }}
                    style={({ pressed }) => [
                      styles.instResultRow,
                      isSelected && styles.instResultRowSelected,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <View style={styles.optionRowLeft}>
                      <View style={styles.optionCapIcon}>
                        <Feather name="award" size={14} color="#06B6D4" />
                      </View>
                      <Text style={styles.optionTitle}>{deg}</Text>
                    </View>
                    <Feather
                      name={isSelected ? 'check-circle' : 'chevron-right'}
                      size={18}
                      color={isSelected ? '#10B981' : '#64748B'}
                    />
                  </Pressable>
                );
              })}

              {/* Can't find degree / Add Custom */}
              <View style={styles.customAddSection}>
                {!isCustomDegreeMode ? (
                  <Pressable
                    onPress={() => setIsCustomDegreeMode(true)}
                    style={styles.customAddButton}
                  >
                    <Feather name="plus-circle" size={15} color="#06B6D4" />
                    <Text style={styles.customAddButtonText}>Can&apos;t find your degree? Add Custom</Text>
                  </Pressable>
                ) : (
                  <View style={styles.customInlineBox}>
                    <Text style={styles.customInlineTitle}>Specify Custom Degree</Text>
                    <TextInput
                      style={styles.customFormInput}
                      placeholder="e.g. B.Des or M.Sc Data Science"
                      placeholderTextColor="#64748B"
                      value={customProgram}
                      onChangeText={setCustomProgram}
                    />
                    <Pressable
                      onPress={() => {
                        if (customProgram.trim()) {
                          setProgram(customProgram.trim());
                          setIsDegreeModalVisible(false);
                          setIsCustomDegreeMode(false);
                        }
                      }}
                      style={styles.applyCustomButton}
                    >
                      <Text style={styles.applyCustomButtonText}>Apply Custom Degree</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </ScrollView>
          </View>
        </View>
      </Modal>

      {/* ─── Branch / Discipline Searchable Dropdown Modal ─── */}
      <Modal
        visible={isBranchModalVisible}
        animationType="slide"
        transparent
        onRequestClose={() => setIsBranchModalVisible(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContainer}>
            <View style={styles.modalHeader}>
              <View>
                <Text style={styles.modalTitle}>Select Branch / Discipline</Text>
                <Text style={styles.modalSubtitle}>
                  {selectedInstitution
                    ? `${availableBranches.length} branches for ${program} at ${selectedInstitution.shortName}`
                    : `Branches & majors for ${program}`}
                </Text>
              </View>
              <Pressable
                onPress={() => {
                  triggerHaptic();
                  setIsBranchModalVisible(false);
                }}
                hitSlop={8}
                style={styles.modalCloseButton}
              >
                <Feather name="x" size={20} color="#94A3B8" />
              </Pressable>
            </View>

            <View style={styles.modalSearchContainer}>
              <Feather name="search" size={16} color="#06B6D4" />
              <TextInput
                style={styles.modalSearchInput}
                placeholder="Search branches (e.g. Computer Science, Mechanical)..."
                placeholderTextColor="#64748B"
                value={branchSearchQuery}
                onChangeText={setBranchSearchQuery}
                autoFocus
              />
              {branchSearchQuery ? (
                <Pressable onPress={() => setBranchSearchQuery('')} hitSlop={6}>
                  <Feather name="x-circle" size={16} color="#64748B" />
                </Pressable>
              ) : null}
            </View>

            <ScrollView style={styles.modalResultsList} showsVerticalScrollIndicator={false}>
              {filteredBranches.map((b) => {
                const isSelected = branch.toLowerCase() === b.toLowerCase();
                return (
                  <Pressable
                    key={b}
                    onPress={() => {
                      triggerHaptic();
                      setBranch(b);
                      if (error) setError(null);
                      setIsBranchModalVisible(false);
                      setBranchSearchQuery('');
                    }}
                    style={({ pressed }) => [
                      styles.instResultRow,
                      isSelected && styles.instResultRowSelected,
                      pressed && { opacity: 0.8 },
                    ]}
                  >
                    <View style={styles.optionRowLeft}>
                      <View style={styles.optionBranchIcon}>
                        <Feather name="git-branch" size={14} color="#06B6D4" />
                      </View>
                      <Text style={styles.optionTitle}>{b}</Text>
                    </View>
                    <Feather
                      name={isSelected ? 'check-circle' : 'chevron-right'}
                      size={18}
                      color={isSelected ? '#10B981' : '#64748B'}
                    />
                  </Pressable>
                );
              })}

              {/* Can't find branch / Add Custom */}
              <View style={styles.customAddSection}>
                {!isCustomBranchMode ? (
                  <Pressable
                    onPress={() => setIsCustomBranchMode(true)}
                    style={styles.customAddButton}
                  >
                    <Feather name="plus-circle" size={15} color="#06B6D4" />
                    <Text style={styles.customAddButtonText}>Can&apos;t find your branch? Add Custom</Text>
                  </Pressable>
                ) : (
                  <View style={styles.customInlineBox}>
                    <Text style={styles.customInlineTitle}>Specify Custom Branch / Major</Text>
                    <TextInput
                      style={styles.customFormInput}
                      placeholder="e.g. Mechatronics Engineering"
                      placeholderTextColor="#64748B"
                      value={customBranchInput}
                      onChangeText={setCustomBranchInput}
                    />
                    <Pressable
                      onPress={() => {
                        if (customBranchInput.trim()) {
                          setBranch(customBranchInput.trim());
                          if (error) setError(null);
                          setIsBranchModalVisible(false);
                          setIsCustomBranchMode(false);
                        }
                      }}
                      style={styles.applyCustomButton}
                    >
                      <Text style={styles.applyCustomButtonText}>Apply Custom Branch</Text>
                    </Pressable>
                  </View>
                )}
              </View>
            </ScrollView>
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

  /* Ambient Orb Lighting */
  ambientAtmosphere: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  ambientOrbLeft: {
    position: 'absolute',
    top: 40,
    left: -80,
    width: 220,
    height: 220,
    borderRadius: 110,
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
    ...(Platform.OS === 'web' ? ({ filter: 'blur(60px)' } as any) : {}),
  },
  ambientOrbRight: {
    position: 'absolute',
    top: 180,
    right: -80,
    width: 240,
    height: 240,
    borderRadius: 120,
    backgroundColor: 'rgba(6, 182, 212, 0.10)',
    ...(Platform.OS === 'web' ? ({ filter: 'blur(70px)' } as any) : {}),
  },

  /* Header */
  header: { marginBottom: 20 },
  titleBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 8,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(6, 182, 212, 0.35)',
    alignSelf: 'flex-start',
    marginBottom: 8,
  },
  titleBadgeText: { fontSize: 10, fontWeight: '800', color: '#06B6D4', letterSpacing: 0.8 },
  title: { fontSize: 26, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 },
  subtitle: { fontSize: 14, color: '#94A3B8', marginTop: 6, lineHeight: 20 },

  /* Section Title */
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 8,
    marginBottom: 10,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: '#06B6D4',
    letterSpacing: 1,
    textTransform: 'uppercase',
  },

  /* Card */
  card: {
    padding: 18,
    borderRadius: 22,
    marginBottom: 20,
    gap: 16,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    backgroundColor: 'rgba(10, 16, 28, 0.75)',
  },

  /* Institution Selection Card */
  selectedInstCard: {
    gap: 8,
  },
  instMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
  },
  categoryTag: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    borderWidth: 0.8,
  },
  categoryTagText: { fontSize: 10, fontWeight: '800', letterSpacing: 0.4 },
  shortNameBadge: {
    paddingHorizontal: 8,
    paddingVertical: 2.5,
    borderRadius: 6,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  shortNameBadgeText: { fontSize: 11, fontWeight: '700', color: '#E2E8F0' },
  instSelectedName: {
    fontSize: 16,
    fontWeight: '800',
    color: '#FFFFFF',
    lineHeight: 22,
    marginTop: 2,
  },
  locationPinRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  locationPinText: { fontSize: 13, color: '#94A3B8', fontWeight: '500' },
  changeInstButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(6, 182, 212, 0.35)',
    alignSelf: 'flex-start',
    marginTop: 6,
  },
  changeInstButtonText: { fontSize: 12, fontWeight: '700', color: '#06B6D4' },

  instSelectorTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    paddingVertical: 12,
  },
  instIconCircle: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
    borderWidth: 0.5,
    borderColor: 'rgba(6, 182, 212, 0.4)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  instTriggerTextWrapper: { flex: 1 },
  instTriggerTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  instTriggerSubtitle: { fontSize: 12, color: '#94A3B8', marginTop: 2 },

  /* Form Fields */
  fieldGroup: { gap: 8 },
  fieldLabel: {
    fontSize: 11,
    fontWeight: '800',
    color: '#06B6D4',
    letterSpacing: 0.8,
  },
  fieldLabelSubtle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.8,
  },
  labelWithSubRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  calculatedYearBadge: {
    fontSize: 11,
    fontWeight: '700',
    color: '#10B981',
    letterSpacing: 0.4,
  },

  /* Glow Input */
  glowInput: {
    height: 48,
    borderRadius: 14,
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: 'rgba(6, 12, 24, 0.75)',
    paddingHorizontal: 14,
    fontSize: 14,
    color: '#FFFFFF',
  },
  glowInputFocused: {
    borderColor: '#06B6D4',
    backgroundColor: 'rgba(6, 182, 212, 0.05)',
  },
  inputErrorBorder: {
    borderColor: '#EF4444',
  },

  /* Scoped Badges & Dropdown Triggers */
  institutionScopeBadge: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#06B6D4',
    letterSpacing: 0.4,
  },
  branchCountBadge: {
    fontSize: 10.5,
    fontWeight: '700',
    color: '#10B981',
    letterSpacing: 0.4,
  },
  dropdownTrigger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    padding: 13,
    borderRadius: 14,
    borderWidth: 0.8,
    borderColor: 'rgba(6, 182, 212, 0.25)',
    backgroundColor: 'rgba(6, 182, 212, 0.04)',
    marginBottom: 6,
  },
  dropdownTriggerIcon: {
    width: 34,
    height: 34,
    borderRadius: 10,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  dropdownTriggerContent: { flex: 1, gap: 2 },
  dropdownTriggerTitle: { fontSize: 14, fontWeight: '700', color: '#FFFFFF' },
  dropdownTriggerSubtitle: { fontSize: 11, color: '#94A3B8' },
  moreChip: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 0.8,
    borderColor: 'rgba(6, 182, 212, 0.35)',
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
  },
  moreChipText: { fontSize: 12, fontWeight: '700', color: '#06B6D4' },
  microChipMore: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(6, 182, 212, 0.35)',
    backgroundColor: 'rgba(6, 182, 212, 0.08)',
  },
  microChipMoreText: { fontSize: 11, fontWeight: '700', color: '#06B6D4' },

  /* Chips */
  chipRow: { flexDirection: 'row' },
  chipScrollContent: { gap: 8, paddingVertical: 2 },
  chip: {
    paddingHorizontal: 12,
    paddingVertical: 7,
    borderRadius: 12,
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  chipActive: {
    borderColor: '#06B6D4',
    backgroundColor: 'rgba(6, 182, 212, 0.20)',
  },
  chipText: { fontSize: 12.5, fontWeight: '600', color: '#94A3B8' },
  chipTextActive: { color: '#06B6D4', fontWeight: '800' },

  microChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 8,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.1)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
  },
  microChipActive: {
    borderColor: '#06B6D4',
    backgroundColor: 'rgba(6, 182, 212, 0.15)',
  },
  microChipText: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },
  microChipTextActive: { color: '#06B6D4', fontWeight: '700' },

  /* Semesters Grid */
  semestersGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 8,
  },
  semTile: {
    flex: 1,
    minWidth: 52,
    height: 48,
    borderRadius: 12,
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  semTileActive: {
    borderColor: '#06B6D4',
    backgroundColor: '#06B6D4',
  },
  semTileNumber: { fontSize: 15, fontWeight: '800', color: '#E2E8F0' },
  semTileNumberActive: { color: '#05070B', fontWeight: '900' },
  semTileSub: { fontSize: 9, fontWeight: '600', color: '#64748B', marginTop: -2 },
  semTileSubActive: { color: '#05070B', fontWeight: '800' },

  /* Attendance Policy */
  attendancePolicyDesc: {
    fontSize: 13,
    color: '#94A3B8',
    lineHeight: 18,
  },
  benchmarkButtonsRow: {
    flexDirection: 'row',
    gap: 8,
  },
  benchmarkTile: {
    flex: 1,
    height: 52,
    borderRadius: 14,
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 2,
  },
  benchmarkPercent: { fontSize: 16, fontWeight: '800', color: '#E2E8F0' },
  benchmarkLabel: { fontSize: 10, fontWeight: '600', color: '#64748B' },
  customTargetWrapper: { gap: 6, marginTop: 4 },

  /* 2.png Attendance Gauge Plate */
  attendanceGaugePlate: {
    padding: 16,
    borderRadius: 18,
    backgroundColor: 'rgba(5, 9, 18, 0.85)',
    borderWidth: 0.8,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    gap: 12,
    marginTop: 4,
  },
  gaugeHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap',
    gap: 8,
  },
  gaugeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 0.5,
    borderColor: '#10B981',
  },
  gaugeBadgeText: { fontSize: 11, fontWeight: '700', color: '#10B981' },
  debarRiskBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: 8,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 0.5,
    borderColor: '#10B981',
  },
  debarRiskText: { fontSize: 11, fontWeight: '700', color: '#10B981' },
  gaugeValueRow: {
    flexDirection: 'row',
    alignItems: 'baseline',
    gap: 10,
  },
  gaugeValueLarge: { fontSize: 32, fontWeight: '900', color: '#FFFFFF', letterSpacing: -0.5 },
  gaugeValueSub: { fontSize: 13, fontWeight: '600', color: '#94A3B8' },
  gaugeMiniPillsRow: {
    flexDirection: 'row',
    gap: 8,
    flexWrap: 'wrap',
  },
  miniPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: 10,
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  miniPillText: { fontSize: 11, fontWeight: '600', color: '#E2E8F0' },

  /* Banku Vision Liquid Glass Card (Amber Atmosphere) */
  bankuVisionCard: {
    position: 'relative',
    overflow: 'hidden',
    padding: 16,
    borderRadius: 20,
    marginBottom: 20,
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
    width: 72,
    height: 72,
    borderRadius: 18,
    borderWidth: 0.8,
    borderColor: 'rgba(245, 158, 11, 0.5)',
    backgroundColor: 'rgba(245, 158, 11, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
    overflow: 'hidden',
  },
  bankuMascotImg: {
    width: 64,
    height: 64,
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
  bankuMetaCol: {
    flex: 1,
    gap: 4,
  },
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
    gap: 10,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  bankuSpecItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  bankuSpecText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#CBD5E1',
  },
  bankuActionButton: {
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 0.8,
    borderColor: '#F59E0B',
  },
  bankuActionGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 13,
    paddingHorizontal: 16,
  },
  bankuActionButtonText: {
    color: '#F59E0B',
    fontSize: 13.5,
    fontWeight: '800',
    letterSpacing: 0.2,
  },
  bankuDatesPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingVertical: 8,
    paddingHorizontal: 12,
    borderRadius: 10,
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    borderWidth: 0.5,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  bankuDatesText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#10B981',
  },

  /* Error Banner */
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    padding: 12,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 0.8,
    borderColor: 'rgba(239, 68, 68, 0.3)',
    marginBottom: 16,
  },
  errorText: { color: '#EF4444', fontSize: 13, fontWeight: '600', flex: 1 },

  /* Bottom Actions */
  buttonRow: { flexDirection: 'row', alignItems: 'center', gap: 12, marginTop: 4 },
  backButton: {
    height: 52,
    paddingHorizontal: 18,
    borderRadius: 26,
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.16)',
    backgroundColor: 'rgba(10, 16, 28, 0.85)',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  backButtonText: { fontSize: 15, fontWeight: '600', color: '#E2E8F0' },
  nextButtonWrapper: { flex: 1 },

  /* ─── Modal Styles ─── */
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
  modalTitle: { fontSize: 18, fontWeight: '800', color: '#FFFFFF' },
  modalSubtitle: { fontSize: 12, color: '#94A3B8', marginTop: 2, maxWidth: 280 },
  modalCloseButton: {
    padding: 6,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
  },

  modalSearchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    height: 46,
    borderRadius: 14,
    borderWidth: 0.8,
    borderColor: 'rgba(6, 182, 212, 0.4)',
    backgroundColor: 'rgba(6, 12, 24, 0.85)',
    paddingHorizontal: 14,
  },
  modalSearchInput: {
    flex: 1,
    color: '#FFFFFF',
    fontSize: 13.5,
  },

  categoryPillsScroll: { maxHeight: 38 },
  categoryPillsContainer: { gap: 8, paddingBottom: 2 },
  categoryFilterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 6,
    borderRadius: 10,
    borderWidth: 0.6,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    backgroundColor: 'rgba(255, 255, 255, 0.04)',
  },
  categoryFilterPillActive: {
    borderColor: '#06B6D4',
    backgroundColor: '#06B6D4',
  },
  categoryFilterPillText: { fontSize: 11, fontWeight: '600', color: '#94A3B8' },
  categoryFilterPillTextActive: { color: '#05070B', fontWeight: '800' },

  modalResultsList: { maxHeight: 380 },
  instResultRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 12,
    paddingHorizontal: 12,
    borderRadius: 14,
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    backgroundColor: 'rgba(255, 255, 255, 0.02)',
    marginBottom: 8,
  },
  instResultRowSelected: {
    borderColor: '#10B981',
    backgroundColor: 'rgba(16, 185, 129, 0.10)',
  },
  instResultContent: { flex: 1, paddingRight: 10, gap: 4 },
  instResultTopRow: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  categoryMicroBadge: {
    paddingHorizontal: 6,
    paddingVertical: 1.5,
    borderRadius: 4,
    borderWidth: 0.6,
  },
  categoryMicroBadgeText: { fontSize: 9, fontWeight: '800' },
  instResultShortName: { fontSize: 11, fontWeight: '700', color: '#94A3B8' },
  instResultFullName: { fontSize: 13.5, fontWeight: '700', color: '#FFFFFF' },
  instResultBottomRow: { flexDirection: 'row', alignItems: 'center', gap: 4 },
  instResultLocation: { fontSize: 11.5, color: '#64748B' },

  noResultsCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 8,
  },
  noResultsTitle: { fontSize: 15, fontWeight: '700', color: '#FFFFFF' },
  noResultsDesc: { fontSize: 12, color: '#94A3B8', textAlign: 'center', maxWidth: 280 },
  customAddButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginTop: 8,
    paddingHorizontal: 14,
    paddingVertical: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(0, 229, 255, 0.12)',
    borderWidth: 0.8,
    borderColor: '#00E5FF',
  },
  customAddButtonText: { color: '#00E5FF', fontSize: 12, fontWeight: '700' },

  customFormBox: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    gap: 10,
    marginTop: 8,
  },
  customFormTitle: { fontSize: 13, fontWeight: '800', color: '#06B6D4' },
  customFormInput: {
    height: 44,
    borderRadius: 10,
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.14)',
    backgroundColor: 'rgba(6, 12, 24, 0.75)',
    paddingHorizontal: 12,
    fontSize: 13,
    color: '#FFFFFF',
  },
  inlineTwoInputs: { flexDirection: 'row', gap: 8 },
  applyCustomButton: {
    height: 44,
    borderRadius: 10,
    backgroundColor: '#06B6D4',
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 4,
  },
  applyCustomButtonText: { color: '#05070B', fontSize: 13, fontWeight: '800' },

  modalBottomToggle: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderTopWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.08)',
  },
  modalBottomToggleText: { fontSize: 12, fontWeight: '600', color: '#06B6D4' },

  /* Calendar Preview Modal */
  previewCard: {
    padding: 14,
    borderRadius: 16,
    marginBottom: 10,
    gap: 8,
  },
  previewSectionTitle: { fontSize: 11, fontWeight: '800', color: '#06B6D4', letterSpacing: 0.8 },
  previewItemRow: { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 4 },
  previewItemDate: { fontSize: 12, fontWeight: '700', width: 90, color: '#FFFFFF' },
  previewItemName: { fontSize: 12, flex: 1, color: '#94A3B8' },
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
  },
  modalCancelText: { fontSize: 13, fontWeight: '600', color: '#94A3B8' },
  modalConfirmButton: {
    flex: 1.5,
    paddingVertical: 13,
    borderRadius: 14,
    backgroundColor: '#06B6D4',
    alignItems: 'center',
  },
  modalConfirmText: { color: '#05070B', fontSize: 13, fontWeight: '800' },

  /* Modal Option Items (Degree & Branch) */
  optionRowLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    flex: 1,
  },
  optionCapIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: 'rgba(6, 182, 212, 0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(6, 182, 212, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionBranchIcon: {
    width: 32,
    height: 32,
    borderRadius: 9,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 0.5,
    borderColor: 'rgba(16, 185, 129, 0.3)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionTitle: {
    fontSize: 13.5,
    fontWeight: '700',
    color: '#FFFFFF',
    flex: 1,
  },
  customAddSection: {
    marginTop: 10,
    marginBottom: 20,
  },
  customInlineBox: {
    padding: 14,
    borderRadius: 14,
    backgroundColor: 'rgba(255, 255, 255, 0.03)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    gap: 10,
  },
  customInlineTitle: {
    fontSize: 12.5,
    fontWeight: '800',
    color: '#06B6D4',
  },
});
