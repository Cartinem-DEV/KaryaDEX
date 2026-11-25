/**
 * KaryaDEX — Onboarding Step 3: College / University Setup
 *
 * Collects Institution name, short abbreviation, university board, and campus.
 * Features:
 * - Signature LuminousButton CTA
 * - Obsidian dark liquid glass styling with specular rim lighting
 * - Frosted glass back button with tactile response
 * - Vector icons & glowing focus inputs
 */

import React, { useState, useMemo } from 'react';
import { View, Text, TextInput, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/constants/ThemeContext';
import { GlassCard, LuminousButton } from '@/components/ui';
import { AlertTriangleIcon } from '@/components/ui/AcademicIcons';
import { searchInstitutions, type IndianInstitution } from '@/constants/indianInstitutions';

interface StepCollegeProps {
  initialCollege?: {
    name?: string;
    shortName?: string;
    universityBoard?: string;
    campus?: string;
    city?: string;
    state?: string;
    category?: string;
  };
  onNext: (data: {
    name: string;
    shortName: string;
    universityBoard?: string;
    campus?: string;
    city?: string;
    state?: string;
    category?: string;
  }) => void;
  onBack: () => void;
}

export function StepCollege({
  initialCollege = {},
  onNext,
  onBack,
}: StepCollegeProps) {
  const { colors, isDark } = useTheme();
  const [name, setName] = useState(initialCollege.name || '');
  const [shortName, setShortName] = useState(initialCollege.shortName || '');
  const [universityBoard, setUniversityBoard] = useState(initialCollege.universityBoard || '');
  const [campus, setCampus] = useState(initialCollege.campus || '');
  const [city, setCity] = useState(initialCollege.city || '');
  const [state, setState] = useState(initialCollege.state || '');
  const [category, setCategory] = useState(initialCollege.category || '');
  const [error, setError] = useState<string | null>(null);
  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [showSuggestions, setShowSuggestions] = useState(false);

  const suggestions = useMemo(() => {
    if (!name.trim() || name.length < 2) return [];
    return searchInstitutions(name).slice(0, 5);
  }, [name]);

  const handleSelectSuggestion = (inst: IndianInstitution) => {
    setName(inst.name);
    setShortName(inst.shortName);
    setUniversityBoard(inst.category === 'IIT' || inst.category === 'NIT' ? `${inst.category} System` : inst.category);
    setCampus(inst.city);
    setCity(inst.city);
    setState(inst.state);
    setCategory(inst.category);
    setShowSuggestions(false);
    setError(null);
  };

  const handleNext = () => {
    if (!name.trim()) {
      setError('Please enter your college or institution name.');
      return;
    }
    setError(null);

    const resolvedShortName =
      shortName.trim() ||
      name
        .trim()
        .split(' ')
        .map(w => w[0])
        .join('')
        .slice(0, 8)
        .toUpperCase();

    onNext({
      name: name.trim(),
      shortName: resolvedShortName,
      universityBoard: universityBoard.trim() || undefined,
      campus: campus.trim() || undefined,
      city: city.trim() || undefined,
      state: state.trim() || undefined,
      category: category.trim() || undefined,
    });
  };

  return (
    <ScrollView
      style={styles.scrollView}
      contentContainerStyle={styles.contentContainer}
      showsVerticalScrollIndicator={false}
      keyboardShouldPersistTaps="handled"
    >
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? '#FFFFFF' : colors.text }]}>
          Where do you study?
        </Text>
        <Text style={[styles.subtitle, { color: isDark ? '#94A3B8' : colors.textSecondary }]}>
          Your college, university, or institute details.
        </Text>
      </View>

      <GlassCard level="primary" style={styles.formCard}>
        {/* College Name */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: isDark ? '#00E5FF' : colors.textSecondary }]}>
            INSTITUTION / COLLEGE NAME *
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: isDark ? '#FFFFFF' : colors.text,
                backgroundColor: isDark ? 'rgba(6, 12, 24, 0.75)' : 'rgba(0, 0, 0, 0.03)',
                borderColor: error
                  ? '#EF4444'
                  : focusedInput === 'name'
                  ? '#00E5FF'
                  : isDark
                  ? 'rgba(255, 255, 255, 0.12)'
                  : colors.border,
              },
            ]}
            placeholder="e.g. Indian Institute of Technology"
            placeholderTextColor={isDark ? '#64748B' : colors.textTertiary}
            value={name}
            onFocus={() => {
              setFocusedInput('name');
              setShowSuggestions(true);
            }}
            onBlur={() => {
              setFocusedInput(null);
              // Small delay to allow click on suggestion
              setTimeout(() => setShowSuggestions(false), 200);
            }}
            onChangeText={(val) => {
              setName(val);
              setShowSuggestions(true);
              if (error) setError(null);
            }}
            autoFocus
          />

          {showSuggestions && suggestions.length > 0 && (
            <View style={styles.suggestionsCard}>
              {suggestions.map((inst) => (
                <Pressable
                  key={inst.id}
                  onPress={() => handleSelectSuggestion(inst)}
                  style={({ pressed }) => [
                    styles.suggestionItem,
                    pressed && { backgroundColor: 'rgba(6, 182, 212, 0.15)' },
                  ]}
                >
                  <View style={styles.suggestionLeft}>
                    <Text style={styles.suggestionTitle}>{inst.name}</Text>
                    <Text style={styles.suggestionSub}>
                      {inst.shortName} • {inst.city}, {inst.state} ({inst.category})
                    </Text>
                  </View>
                  <Feather name="arrow-up-right" size={14} color="#06B6D4" />
                </Pressable>
              ))}
            </View>
          )}
        </View>

        {/* Short Name */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: isDark ? '#94A3B8' : colors.textSecondary }]}>
            ABBREVIATION / SHORT CODE (OPTIONAL)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: isDark ? '#FFFFFF' : colors.text,
                backgroundColor: isDark ? 'rgba(6, 12, 24, 0.75)' : 'rgba(0, 0, 0, 0.03)',
                borderColor:
                  focusedInput === 'shortName'
                    ? '#00E5FF'
                    : isDark
                    ? 'rgba(255, 255, 255, 0.12)'
                    : colors.border,
              },
            ]}
            placeholder="e.g. IITK"
            placeholderTextColor={isDark ? '#64748B' : colors.textTertiary}
            value={shortName}
            onFocus={() => setFocusedInput('shortName')}
            onBlur={() => setFocusedInput(null)}
            onChangeText={setShortName}
          />
        </View>

        {/* University / Board */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: isDark ? '#94A3B8' : colors.textSecondary }]}>
            AFFILIATING UNIVERSITY / BOARD (OPTIONAL)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: isDark ? '#FFFFFF' : colors.text,
                backgroundColor: isDark ? 'rgba(6, 12, 24, 0.75)' : 'rgba(0, 0, 0, 0.03)',
                borderColor:
                  focusedInput === 'board'
                    ? '#00E5FF'
                    : isDark
                    ? 'rgba(255, 255, 255, 0.12)'
                    : colors.border,
              },
            ]}
            placeholder="e.g. Autonomous / Central University"
            placeholderTextColor={isDark ? '#64748B' : colors.textTertiary}
            value={universityBoard}
            onFocus={() => setFocusedInput('board')}
            onBlur={() => setFocusedInput(null)}
            onChangeText={setUniversityBoard}
          />
        </View>

        {/* Campus */}
        <View style={styles.inputGroup}>
          <Text style={[styles.label, { color: isDark ? '#94A3B8' : colors.textSecondary }]}>
            CAMPUS / LOCATION (OPTIONAL)
          </Text>
          <TextInput
            style={[
              styles.input,
              {
                color: isDark ? '#FFFFFF' : colors.text,
                backgroundColor: isDark ? 'rgba(6, 12, 24, 0.75)' : 'rgba(0, 0, 0, 0.03)',
                borderColor:
                  focusedInput === 'campus'
                    ? '#00E5FF'
                    : isDark
                    ? 'rgba(255, 255, 255, 0.12)'
                    : colors.border,
              },
            ]}
            placeholder="e.g. Main Campus"
            placeholderTextColor={isDark ? '#64748B' : colors.textTertiary}
            value={campus}
            onFocus={() => setFocusedInput('campus')}
            onBlur={() => setFocusedInput(null)}
            onChangeText={setCampus}
          />
        </View>

        {error && (
          <View style={styles.errorBanner}>
            <AlertTriangleIcon size={16} color="#EF4444" />
            <Text style={styles.errorText}>{error}</Text>
          </View>
        )}
      </GlassCard>

      {/* Buttons */}
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

        <View style={styles.nextButtonWrapper}>
          <LuminousButton
            title="Continue"
            onPress={handleNext}
            size="medium"
            showArrow
          />
        </View>
      </View>
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
  header: {
    marginBottom: 20,
  },
  title: {
    fontSize: 24,
    fontWeight: '800',
    letterSpacing: -0.5,
  },
  subtitle: {
    fontSize: 15,
    marginTop: 4,
  },
  formCard: {
    padding: 20,
    borderRadius: 24,
    marginBottom: 24,
    gap: 16,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 0.8,
    textTransform: 'uppercase',
  },
  input: {
    height: 50,
    borderRadius: 14,
    borderWidth: 1.2,
    paddingHorizontal: 16,
    fontSize: 16,
  },
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    padding: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.25)',
  },
  errorText: {
    color: '#EF4444',
    fontSize: 13,
    fontWeight: '600',
  },
  buttonRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  backButton: {
    height: 52,
    paddingHorizontal: 18,
    borderRadius: 26,
    borderWidth: 1.2,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  backButtonText: {
    fontSize: 15,
    fontWeight: '600',
  },
  nextButtonWrapper: {
    flex: 1,
  },
  suggestionsCard: {
    borderRadius: 14,
    borderWidth: 0.8,
    borderColor: 'rgba(6, 182, 212, 0.35)',
    backgroundColor: 'rgba(10, 16, 28, 0.95)',
    overflow: 'hidden',
    marginTop: 4,
  },
  suggestionItem: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderBottomWidth: 0.5,
    borderBottomColor: 'rgba(255, 255, 255, 0.08)',
  },
  suggestionLeft: { flex: 1, paddingRight: 8 },
  suggestionTitle: { fontSize: 13, fontWeight: '700', color: '#FFFFFF' },
  suggestionSub: { fontSize: 11, color: '#94A3B8', marginTop: 1 },
});
