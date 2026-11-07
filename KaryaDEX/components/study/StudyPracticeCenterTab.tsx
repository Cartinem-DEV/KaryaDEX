/**
 * KaryaDEX — Study Practice Center Tab
 *
 * Active recall practice system:
 * 1. Flashcards (Card flip with "Knew It" vs "Needs Review")
 * 2. Multiple-Choice Questions (MCQ with rationale)
 * 3. True / False Quizzes
 * 4. Knowledge gap detection
 *
 * CRITICAL RULE: Strictly isolated from Playground Brain ELO.
 * Practice results update academic topic revision mastery only.
 */

import React, { useState, useMemo } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/constants/ThemeContext';
import { typography, radii, spacing } from '@/constants/theme';
import type { Topic } from '@/types/academic';
import type { Subject } from '@/types';
import type { PracticeMode, PracticeFlashcard, PracticeMCQ, PracticeTrueFalse } from './types';
import { studyPracticeService } from '@/services/study/studyPracticeService';

interface StudyPracticeCenterTabProps {
  subjects: Subject[];
  topics: Topic[];
  selectedSubjectId: string | 'all';
  onRefreshData: () => Promise<void>;
}

const DEFAULT_FLASHCARDS: PracticeFlashcard[] = [
  {
    id: 'fc-1',
    topicId: 't-1',
    subjectId: 'subj-1',
    front: 'What is the Slow Start Threshold (SSTHRESH) in TCP?',
    back: 'The CWND value at which TCP switches from exponential Slow Start growth to linear Congestion Avoidance growth.',
    conceptSummary: 'RFC 5681 Congestion Control',
  },
  {
    id: 'fc-2',
    topicId: 't-2',
    subjectId: 'subj-2',
    front: 'What is Thrashing in an Operating System?',
    back: 'A state where the CPU spends more time swapping pages into and out of memory than executing actual processes, collapsing throughput.',
    conceptSummary: 'Virtual Memory & Page Replacement',
  },
  {
    id: 'fc-3',
    topicId: 't-3',
    subjectId: 'subj-3',
    front: 'Define Boyce-Codd Normal Form (BCNF).',
    back: 'A relation is in BCNF if and only if for every non-trivial functional dependency X -> Y, X is a superkey of the relation.',
    conceptSummary: 'Relational Database Normalization',
  },
];

const DEFAULT_MCQS: PracticeMCQ[] = [
  {
    id: 'mcq-1',
    topicId: 't-1',
    subjectId: 'subj-1',
    question: 'During TCP Slow Start, how does the Congestion Window (CWND) increase with each received ACK?',
    options: [
      'Increases linearly by 1 MSS per RTT',
      'Increases by 1 MSS per valid ACK (effectively doubling per RTT)',
      'Multiplies by SSTHRESH each round',
      'Remains constant until 3-duplicate ACKs arrive',
    ],
    correctIndex: 1,
    explanation: 'In Slow Start, CWND is incremented by 1 MSS for every received ACK, which results in exponential doubling across each RTT.',
    stepHint: 'Think about ACK clocking: 1 packet sent -> 1 ACK received -> 2 packets sent next.',
  },
  {
    id: 'mcq-2',
    topicId: 't-2',
    subjectId: 'subj-2',
    question: 'Which page replacement algorithm suffers from Belady’s Anomaly?',
    options: [
      'Least Recently Used (LRU)',
      'Optimal Page Replacement (OPT)',
      'First-In, First-Out (FIFO)',
      'Least Frequently Used (LFU)',
    ],
    correctIndex: 2,
    explanation: 'FIFO can experience Belady’s Anomaly, where allocating more page frames leads to more page faults for certain access strings.',
    stepHint: 'Stack algorithms like LRU and OPT never suffer from Belady’s anomaly.',
  },
];

const DEFAULT_TRUE_FALSE: PracticeTrueFalse[] = [
  {
    id: 'tf-1',
    topicId: 't-3',
    subjectId: 'subj-3',
    statement: 'Every relation schema that is in BCNF is guaranteed to also be in 3NF.',
    isTrue: true,
    explanation: 'BCNF is a stricter form of 3NF. If every determinant is a superkey, the 3NF condition is inherently satisfied.',
  },
  {
    id: 'tf-2',
    topicId: 't-1',
    subjectId: 'subj-1',
    statement: 'TCP Fast Retransmit occurs only after a retransmission timer (RTO) fully expires.',
    isTrue: false,
    explanation: 'Fast Retransmit triggers immediately upon receiving 3 duplicate ACKs, without waiting for the slow RTO timer to expire.',
  },
];

export function StudyPracticeCenterTab({
  subjects,
  topics,
  selectedSubjectId,
  onRefreshData,
}: StudyPracticeCenterTabProps) {
  const { colors, isDark } = useTheme();
  const [mode, setMode] = useState<PracticeMode>('flashcards');

  // Flashcard State
  const [cardIndex, setCardIndex] = useState<number>(0);
  const [isFlipped, setIsFlipped] = useState<boolean>(false);
  const [flashcardMasteryCount, setFlashcardMasteryCount] = useState<number>(0);

  // MCQ State
  const [mcqIndex, setMcqIndex] = useState<number>(0);
  const [selectedOption, setSelectedOption] = useState<number | null>(null);
  const [isSubmitted, setIsSubmitted] = useState<boolean>(false);
  const [mcqScore, setMcqScore] = useState<number>(0);

  // True/False State
  const [tfIndex, setTfIndex] = useState<number>(0);
  const [tfSelectedAnswer, setTfSelectedAnswer] = useState<boolean | null>(null);
  const [tfIsSubmitted, setTfIsSubmitted] = useState<boolean>(false);

  // Knowledge Gap Alert State
  const [knowledgeGaps, setKnowledgeGaps] = useState<string[]>([]);

  // Filter topics by selected subject
  const filteredTopics = selectedSubjectId === 'all'
    ? topics
    : topics.filter(t => t.subjectId === selectedSubjectId);

  // Generate dynamic questions from topics via studyPracticeService
  const dynamicFlashcards = useMemo(() => {
    return studyPracticeService.generateFlashcards(filteredTopics, subjects);
  }, [filteredTopics, subjects]);

  const dynamicMCQs = useMemo(() => {
    return studyPracticeService.generateMCQs(filteredTopics, subjects);
  }, [filteredTopics, subjects]);

  const dynamicTrueFalse = useMemo(() => {
    return studyPracticeService.generateTrueFalse(filteredTopics, subjects);
  }, [filteredTopics, subjects]);

  const currentCard = dynamicFlashcards[cardIndex % dynamicFlashcards.length];
  const currentMcq = dynamicMCQs[mcqIndex % dynamicMCQs.length];
  const currentTf = dynamicTrueFalse[tfIndex % dynamicTrueFalse.length];

  // Flashcard Handler
  const handleFlashcardRating = async (known: boolean) => {
    if (known) {
      setFlashcardMasteryCount((prev) => prev + 1);
    } else {
      setKnowledgeGaps((prev) => [...new Set([...prev, currentCard.conceptSummary])]);
    }

    if (currentCard?.topicId) {
      await studyPracticeService.recordPracticeOutcome({
        topicId: currentCard.topicId,
        subjectId: currentCard.subjectId,
        isCorrect: known,
        confidence: known ? 'high' : 'low',
        notes: `Flashcard: ${currentCard.conceptSummary}`,
      });
    }

    setIsFlipped(false);
    setCardIndex((prev) => prev + 1);
    await onRefreshData();
  };

  // MCQ Handler
  const handleSelectOption = (idx: number) => {
    if (!isSubmitted) {
      setSelectedOption(idx);
    }
  };

  const handleSubmitMcq = async () => {
    if (selectedOption === null) return;
    setIsSubmitted(true);
    const isCorrect = selectedOption === currentMcq.correctIndex;
    if (isCorrect) {
      setMcqScore((prev) => prev + 1);
    } else {
      setKnowledgeGaps((prev) => [...new Set([...prev, `Question on ${currentMcq.question.slice(0, 30)}...`])]);
    }

    if (currentMcq?.topicId) {
      await studyPracticeService.recordPracticeOutcome({
        topicId: currentMcq.topicId,
        subjectId: currentMcq.subjectId,
        isCorrect,
        confidence: isCorrect ? 'high' : 'low',
        notes: `MCQ: ${currentMcq.question.slice(0, 50)}...`,
      });
      await onRefreshData();
    }
  };

  const handleNextMcq = () => {
    setSelectedOption(null);
    setIsSubmitted(false);
    setMcqIndex((prev) => prev + 1);
  };

  // True/False Handler
  const handleSelectTf = async (val: boolean) => {
    if (!tfIsSubmitted) {
      setTfSelectedAnswer(val);
      setTfIsSubmitted(true);
      const isCorrect = val === currentTf.isTrue;
      if (!isCorrect) {
        setKnowledgeGaps((prev) => [...new Set([...prev, currentTf.statement.slice(0, 35) + '...'])]);
      }

      if (currentTf?.topicId) {
        await studyPracticeService.recordPracticeOutcome({
          topicId: currentTf.topicId,
          subjectId: currentTf.subjectId,
          isCorrect,
          confidence: isCorrect ? 'high' : 'low',
          notes: `True/False: ${currentTf.statement.slice(0, 50)}...`,
        });
        await onRefreshData();
      }
    }
  };

  const handleNextTf = () => {
    setTfSelectedAnswer(null);
    setTfIsSubmitted(false);
    setTfIndex((prev) => prev + 1);
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Isolation Pill — Assures user this is Academic Mastery, not Playground ELO */}
      <View style={[styles.isolationNotice, { backgroundColor: 'rgba(16, 185, 129, 0.1)', borderColor: 'rgba(16, 185, 129, 0.25)' }]}>
        <Feather name="shield" size={14} color="#10B981" />
        <Text style={styles.isolationText}>
          Academic Practice System • Updates Topic Mastery & Syllabus Retention (Isolated from Playground Brain ELO)
        </Text>
      </View>

      {/* 2. Mode Selector Pills */}
      <View style={styles.modeTabsRow}>
        {(['flashcards', 'mcq', 'true_false'] as const).map((m) => {
          const isSelected = mode === m;
          const label = m === 'flashcards' ? 'Flashcards' : m === 'mcq' ? 'MCQ Quiz' : 'True / False';
          const icon = m === 'flashcards' ? 'layers' : m === 'mcq' ? 'check-square' : 'help-circle';

          return (
            <Pressable
              key={m}
              onPress={() => setMode(m)}
              style={[
                styles.modeTab,
                isSelected
                  ? { backgroundColor: '#7C3AED', borderColor: '#8B5CF6' }
                  : { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Feather name={icon as any} size={13} color={isSelected ? '#FFFFFF' : colors.textSecondary} />
              <Text
                style={[
                  styles.modeTabText,
                  isSelected ? { color: '#FFFFFF', fontWeight: '700' } : { color: colors.textSecondary },
                ]}
              >
                {label}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 3. MODE A: FLASHCARDS */}
      {mode === 'flashcards' && (
        <View style={styles.practiceSection}>
          <View style={styles.cardCounterRow}>
            <Text style={[styles.counterLabel, { color: colors.textSecondary }]}>
              Flashcard {(cardIndex % DEFAULT_FLASHCARDS.length) + 1} of {DEFAULT_FLASHCARDS.length}
            </Text>
            <View style={[styles.masteredPill, { backgroundColor: 'rgba(16, 185, 129, 0.15)' }]}>
              <Text style={styles.masteredPillText}>{flashcardMasteryCount} Mastered</Text>
            </View>
          </View>

          {/* Flip Card Container */}
          <Pressable
            onPress={() => setIsFlipped((prev) => !prev)}
            style={[
              styles.flashcardBox,
              {
                backgroundColor: colors.surface,
                borderColor: isFlipped ? '#00E5FF' : colors.border,
              },
            ]}
          >
            <View style={styles.cardSideBadge}>
              <Text style={styles.cardSideText}>{isFlipped ? 'ANSWER / CONCEPT' : 'QUESTION (TAP TO FLIP)'}</Text>
            </View>

            <Text style={[styles.cardMainText, { color: colors.text }]}>
              {isFlipped ? currentCard.back : currentCard.front}
            </Text>

            <View style={styles.cardFooter}>
              <Feather name="info" size={12} color={colors.textTertiary} />
              <Text style={[styles.cardFooterText, { color: colors.textTertiary }]}>
                {currentCard.conceptSummary}
              </Text>
            </View>
          </Pressable>

          {/* Flashcard Action Buttons */}
          <View style={styles.flashcardActionsRow}>
            <Pressable
              onPress={() => handleFlashcardRating(false)}
              style={[styles.rateBtn, { backgroundColor: 'rgba(239, 68, 68, 0.15)', borderColor: 'rgba(239, 68, 68, 0.3)' }]}
            >
              <Feather name="x" size={16} color="#EF4444" />
              <Text style={[styles.rateBtnText, { color: '#EF4444' }]}>Needs Review</Text>
            </Pressable>

            <Pressable
              onPress={() => handleFlashcardRating(true)}
              style={[styles.rateBtn, { backgroundColor: 'rgba(16, 185, 129, 0.15)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}
            >
              <Feather name="check" size={16} color="#10B981" />
              <Text style={[styles.rateBtnText, { color: '#10B981' }]}>Knew It!</Text>
            </Pressable>
          </View>
        </View>
      )}

      {/* 4. MODE B: MULTIPLE CHOICE */}
      {mode === 'mcq' && (
        <View style={styles.practiceSection}>
          <View style={styles.cardCounterRow}>
            <Text style={[styles.counterLabel, { color: colors.textSecondary }]}>
              Question {(mcqIndex % DEFAULT_MCQS.length) + 1} of {DEFAULT_MCQS.length}
            </Text>
            <Text style={[styles.counterLabel, { color: '#10B981', fontWeight: '700' }]}>
              Score: {mcqScore}
            </Text>
          </View>

          <View style={[styles.mcqCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.mcqQuestion, { color: colors.text }]}>{currentMcq.question}</Text>

            {/* Options */}
            <View style={styles.mcqOptionsList}>
              {currentMcq.options.map((opt, idx) => {
                const isSelected = selectedOption === idx;
                const isCorrect = idx === currentMcq.correctIndex;

                let optBg = colors.surfaceSecondary;
                let optBorder = colors.border;
                if (isSubmitted) {
                  if (isCorrect) {
                    optBg = 'rgba(16, 185, 129, 0.18)';
                    optBorder = '#10B981';
                  } else if (isSelected && !isCorrect) {
                    optBg = 'rgba(239, 68, 68, 0.18)';
                    optBorder = '#EF4444';
                  }
                } else if (isSelected) {
                  optBg = 'rgba(124, 58, 237, 0.18)';
                  optBorder = '#7C3AED';
                }

                return (
                  <Pressable
                    key={idx}
                    onPress={() => handleSelectOption(idx)}
                    style={[styles.mcqOptionBtn, { backgroundColor: optBg, borderColor: optBorder }]}
                  >
                    <View style={styles.optionLetterBox}>
                      <Text style={[styles.optionLetter, { color: colors.text }]}>
                        {String.fromCharCode(65 + idx)}
                      </Text>
                    </View>
                    <Text style={[styles.optionText, { color: colors.text }]}>{opt}</Text>
                  </Pressable>
                );
              })}
            </View>

            {/* Hint / Explanation */}
            {isSubmitted && (
              <View style={[styles.explanationCard, { backgroundColor: 'rgba(0, 229, 255, 0.12)', borderColor: 'rgba(0, 229, 255, 0.3)' }]}>
                <Feather name="info" size={14} color="#00E5FF" />
                <Text style={styles.explanationText}>{currentMcq.explanation}</Text>
              </View>
            )}

            {/* Action Buttons */}
            <View style={styles.mcqActions}>
              {!isSubmitted ? (
                <Pressable
                  onPress={handleSubmitMcq}
                  style={[styles.primaryActionBtn, { backgroundColor: selectedOption !== null ? '#7C3AED' : colors.surfaceSecondary }]}
                  disabled={selectedOption === null}
                >
                  <Text style={[styles.primaryActionText, { color: selectedOption !== null ? '#FFFFFF' : colors.textTertiary }]}>
                    Check Answer
                  </Text>
                </Pressable>
              ) : (
                <Pressable onPress={handleNextMcq} style={[styles.primaryActionBtn, { backgroundColor: '#00E5FF' }]}>
                  <Text style={[styles.primaryActionText, { color: '#05070B' }]}>Next Question →</Text>
                </Pressable>
              )}
            </View>
          </View>
        </View>
      )}

      {/* 5. MODE C: TRUE / FALSE */}
      {mode === 'true_false' && (
        <View style={styles.practiceSection}>
          <View style={styles.cardCounterRow}>
            <Text style={[styles.counterLabel, { color: colors.textSecondary }]}>
              Statement {(tfIndex % DEFAULT_TRUE_FALSE.length) + 1} of {DEFAULT_TRUE_FALSE.length}
            </Text>
          </View>

          <View style={[styles.tfCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <Text style={[styles.tfStatement, { color: colors.text }]}>{currentTf.statement}</Text>

            <View style={styles.tfButtonsRow}>
              <Pressable
                onPress={() => handleSelectTf(true)}
                style={[
                  styles.tfBtn,
                  tfIsSubmitted && currentTf.isTrue
                    ? { backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: '#10B981' }
                    : tfIsSubmitted && tfSelectedAnswer === true && !currentTf.isTrue
                    ? { backgroundColor: 'rgba(239, 68, 68, 0.2)', borderColor: '#EF4444' }
                    : { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                ]}
              >
                <Feather name="check" size={20} color="#10B981" />
                <Text style={[styles.tfBtnText, { color: colors.text }]}>TRUE</Text>
              </Pressable>

              <Pressable
                onPress={() => handleSelectTf(false)}
                style={[
                  styles.tfBtn,
                  tfIsSubmitted && !currentTf.isTrue
                    ? { backgroundColor: 'rgba(16, 185, 129, 0.2)', borderColor: '#10B981' }
                    : tfIsSubmitted && tfSelectedAnswer === false && currentTf.isTrue
                    ? { backgroundColor: 'rgba(239, 68, 68, 0.2)', borderColor: '#EF4444' }
                    : { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                ]}
              >
                <Feather name="x" size={20} color="#EF4444" />
                <Text style={[styles.tfBtnText, { color: colors.text }]}>FALSE</Text>
              </Pressable>
            </View>

            {tfIsSubmitted && (
              <View style={[styles.explanationCard, { backgroundColor: 'rgba(0, 229, 255, 0.12)', borderColor: 'rgba(0, 229, 255, 0.3)', marginTop: spacing.md }]}>
                <Feather name="info" size={14} color="#00E5FF" />
                <Text style={styles.explanationText}>{currentTf.explanation}</Text>
              </View>
            )}

            {tfIsSubmitted && (
              <Pressable onPress={handleNextTf} style={[styles.primaryActionBtn, { backgroundColor: '#00E5FF', marginTop: spacing.md }]}>
                <Text style={[styles.primaryActionText, { color: '#05070B' }]}>Next Statement →</Text>
              </Pressable>
            )}
          </View>
        </View>
      )}

      {/* 6. Knowledge Gaps Section (Diagnostic Gap Detection) */}
      {knowledgeGaps.length > 0 && (
        <View style={[styles.gapsCard, { backgroundColor: 'rgba(245, 158, 11, 0.1)', borderColor: 'rgba(245, 158, 11, 0.3)' }]}>
          <View style={styles.gapsHeader}>
            <Feather name="alert-triangle" size={15} color="#F59E0B" />
            <Text style={[styles.gapsTitle, { color: colors.text }]}>
              Identified Knowledge Gaps ({knowledgeGaps.length})
            </Text>
          </View>
          <Text style={[styles.gapsDesc, { color: colors.textSecondary }]}>
            These concepts were missed during practice. A 20-min revision session has been prioritized in your Study Plan.
          </Text>
          <View style={styles.gapList}>
            {knowledgeGaps.map((gap, i) => (
              <View key={i} style={styles.gapItem}>
                <Feather name="arrow-right" size={12} color="#F59E0B" />
                <Text style={[styles.gapItemText, { color: colors.text }]}>{gap}</Text>
              </View>
            ))}
          </View>
        </View>
      )}

      {/* Spacing for floating bottom bar */}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.base,
  },
  isolationNotice: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.base,
  },
  isolationText: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '600',
    flex: 1,
    lineHeight: 14,
  },
  modeTabsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.base,
  },
  modeTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 10,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  modeTabText: {
    fontSize: typography.sizes.xs,
  },
  practiceSection: {
    marginBottom: spacing.base,
  },
  cardCounterRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  counterLabel: {
    fontSize: typography.sizes.xs,
  },
  masteredPill: {
    paddingHorizontal: 8,
    paddingVertical: 2,
    borderRadius: radii.full,
  },
  masteredPillText: {
    fontSize: 10,
    color: '#10B981',
    fontWeight: '700',
  },
  flashcardBox: {
    minHeight: 220,
    padding: spacing.xl,
    borderRadius: radii.xl,
    borderWidth: 1,
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.base,
  },
  cardSideBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  cardSideText: {
    fontSize: 9,
    fontWeight: '800',
    letterSpacing: 0.5,
    color: '#A78BFA',
  },
  cardMainText: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    textAlign: 'center',
    lineHeight: 24,
    marginVertical: spacing.lg,
  },
  cardFooter: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  cardFooterText: {
    fontSize: 11,
  },
  flashcardActionsRow: {
    flexDirection: 'row',
    gap: spacing.sm,
  },
  rateBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    paddingVertical: 14,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  rateBtnText: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
  },
  mcqCard: {
    padding: spacing.base,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  mcqQuestion: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  mcqOptionsList: {
    gap: spacing.xs,
    marginBottom: spacing.md,
  },
  mcqOptionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  optionLetterBox: {
    width: 24,
    height: 24,
    borderRadius: 12,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  optionLetter: {
    fontSize: 11,
    fontWeight: '700',
  },
  optionText: {
    fontSize: typography.sizes.xs,
    flex: 1,
    lineHeight: 18,
  },
  explanationCard: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.xs,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.md,
  },
  explanationText: {
    fontSize: 11,
    color: '#00E5FF',
    flex: 1,
    lineHeight: 16,
  },
  mcqActions: {
    marginTop: spacing.xs,
  },
  primaryActionBtn: {
    paddingVertical: 12,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  primaryActionText: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
  },
  tfCard: {
    padding: spacing.base,
    borderRadius: radii.xl,
    borderWidth: 1,
  },
  tfStatement: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    lineHeight: 22,
    marginBottom: spacing.lg,
    textAlign: 'center',
  },
  tfButtonsRow: {
    flexDirection: 'row',
    gap: spacing.md,
  },
  tfBtn: {
    flex: 1,
    paddingVertical: 16,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
  },
  tfBtnText: {
    fontSize: typography.sizes.sm,
    fontWeight: '800',
  },
  gapsCard: {
    padding: spacing.base,
    borderRadius: radii.xl,
    borderWidth: 1,
    marginTop: spacing.md,
  },
  gapsHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 4,
  },
  gapsTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
  },
  gapsDesc: {
    fontSize: 11,
    marginBottom: spacing.sm,
    lineHeight: 16,
  },
  gapList: {
    gap: 4,
  },
  gapItem: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  gapItemText: {
    fontSize: 11,
  },
});
