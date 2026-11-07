/**
 * KaryaDEX — Socratic AI Tutor Tab
 *
 * Implements interactive educational Socratic tutoring model:
 * 1. Socratic mode (guiding questions, no instant answers).
 * 2. Progressive Solution Steps Board with "Next Step", counter, and "Replay".
 * 3. In-context conversational follow-ups and prompt pills.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { useTheme } from '@/constants/ThemeContext';
import { typography, radii, spacing } from '@/constants/theme';
import type { Topic } from '@/types/academic';
import type { Subject } from '@/types';
import type { SocraticProblemSession, SocraticStep } from './types';
import { ConversationalChatFeature } from '@/services/ai/features/conversationalChat';
import { useAppStore } from '@/store/useAppStore';

interface StudyAITutorTabProps {
  subjects: Subject[];
  topics: Topic[];
  selectedSubjectId: string | 'all';
  initialContextDoc?: string | null;
}

const DEFAULT_SOCRATIC_SESSION: SocraticProblemSession = {
  id: 'sess-1',
  topicId: 't-1',
  topicTitle: 'TCP Congestion Control & Slow Start',
  problemStatement: 'How does TCP handle packet loss and what formula calculates the congestion window growth during Slow Start?',
  currentStepIndex: 1,
  isCompleted: false,
  finalSolution: 'During Slow Start, CWND doubles every RTT (CWND = CWND + 1 MSS per ACK). When a 3-duplicate ACK is received, TCP enters Fast Recovery (halving CWND to SSTHRESH). On timeout, CWND resets to 1 MSS.',
  steps: [
    {
      stepNumber: 1,
      title: 'State the baseline transmission parameters',
      content: 'In TCP, transmission speed is bounded by min(CWND, RWND). During Slow Start, the sender begins with a modest Congestion Window (e.g. 1–10 MSS) to avoid immediately congesting network buffers.',
      guidingQuestion: 'What triggers the transition from exponential growth to linear growth?',
      isRevealed: true,
    },
    {
      stepNumber: 2,
      title: 'Analyze the ACK-clocked window increment',
      content: 'For every acknowledged segment received, CWND increases by 1 MSS. Because each ACK sent represents 1 segment delivered, this causes the window to effectively double every Round Trip Time (RTT). Growth is exponential: 1 -> 2 -> 4 -> 8 MSS.',
      guidingQuestion: 'What threshold does CWND compare against before switching to Congestion Avoidance?',
      isRevealed: true,
    },
    {
      stepNumber: 3,
      title: 'Evaluate the SSTHRESH crossover boundary',
      content: 'Once CWND reaches the Slow Start Threshold (SSTHRESH), TCP transitions from exponential Slow Start to linear Congestion Avoidance, adding only 1 MSS per full RTT window (1/CWND per ACK).',
      guidingQuestion: 'What happens when a packet is dropped versus when a retransmission timeout fires?',
      isRevealed: false,
    },
  ],
};

export const generateSocraticSessionForTopic = (t: Topic, subjectName: string): SocraticProblemSession => {
  return {
    id: `sess-${t.id}`,
    topicId: t.id,
    topicTitle: t.name,
    problemStatement: `How do we derive, analyze, and apply the principles of "${t.name}" in ${subjectName}?`,
    currentStepIndex: 1,
    isCompleted: false,
    finalSolution: `Mastery of "${t.name}" requires formulating the standard governing relations, evaluating inputs and state changes, and testing boundary edge cases.`,
    steps: [
      {
        stepNumber: 1,
        title: 'Formulate Baseline Definitions & Constraints',
        content: `State the fundamental principles and operational parameters of "${t.name}" in ${subjectName}. What initial invariants must be satisfied?`,
        guidingQuestion: `What is the primary assumption required before "${t.name}" holds true?`,
        isRevealed: true,
      },
      {
        stepNumber: 2,
        title: 'Analyze Mechanical Execution & Step-by-Step Logic',
        content: `Examine the operational mechanics: how do internal variables evolve as state transitions occur in this model?`,
        guidingQuestion: `What threshold or event initiates the secondary state in "${t.name}"?`,
        isRevealed: false,
      },
      {
        stepNumber: 3,
        title: 'Evaluate Boundary Cases & Practical Application',
        content: `Assess edge cases, performance tradeoffs, and common examination pitfalls associated with "${t.name}".`,
        guidingQuestion: `How does this concept connect to adjacent units in your ${subjectName} syllabus?`,
        isRevealed: false,
      },
    ],
  };
};

const PROMPT_SUGGESTIONS = [
  'Explain TCP Slow Start step-by-step',
  'How does Virtual Memory Paging work?',
  'Derive Dijkstra shortest path complexity',
  'What is 3NF vs BCNF in relational DBs?',
];

export function StudyAITutorTab({
  subjects,
  topics,
  selectedSubjectId,
  initialContextDoc,
}: StudyAITutorTabProps) {
  const { colors, isDark } = useTheme();
  const [socraticMode, setSocraticMode] = useState<boolean>(true);
  const [session, setSession] = useState<SocraticProblemSession>(DEFAULT_SOCRATIC_SESSION);
  const [questionInput, setQuestionInput] = useState<string>('');
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [chatMessages, setChatMessages] = useState<Array<{ sender: 'user' | 'tutor'; text: string }>>([
    {
      sender: 'tutor',
      text: "Hello! I'm your KaryaDEX Socratic Tutor. Socratic mode is locked on: I won't just hand you final answers—I will break problems into guided steps and challenge you to think through each deduction. What concept or problem are we solving?",
    },
  ]);

  const filteredTopics = selectedSubjectId === 'all'
    ? topics
    : topics.filter(t => t.subjectId === selectedSubjectId);

  const subjectMap = React.useMemo(() => new Map(subjects.map(s => [s.id, s.name])), [subjects]);

  const handleSelectTopicSession = (topic: Topic) => {
    const sName = subjectMap.get(topic.subjectId) || 'Curriculum';
    const newSess = generateSocraticSessionForTopic(topic, sName);
    setSession(newSess);
  };

  const handleNextStep = () => {
    if (session.currentStepIndex < session.steps.length) {
      const nextIndex = session.currentStepIndex + 1;
      const updatedSteps = session.steps.map((st, i) =>
        i < nextIndex ? { ...st, isRevealed: true } : st
      );
      setSession({
        ...session,
        currentStepIndex: nextIndex,
        isCompleted: nextIndex === session.steps.length,
        steps: updatedSteps,
      });
    }
  };

  const handleReplay = () => {
    setSession({
      ...session,
      currentStepIndex: 1,
      isCompleted: false,
      steps: session.steps.map((st, i) => ({ ...st, isRevealed: i === 0 })),
    });
  };

  const handleAskQuestion = async (queryText?: string) => {
    const textToSend = queryText || questionInput.trim();
    if (!textToSend) return;

    const user = useAppStore.getState().user;
    const userId = user?.id || 'local-student';

    setChatMessages((prev) => [...prev, { sender: 'user', text: textToSend }]);
    setQuestionInput('');
    setIsSubmitting(true);

    try {
      const history = chatMessages.slice(-6).map(m => ({
        sender: m.sender === 'user' ? 'user' as const : 'assistant' as const,
        text: m.text,
      }));

      const contextDocNote = initialContextDoc ? `\n[Grounding Document Context: "${initialContextDoc}"]` : '';
      const socraticPrompt = socraticMode
        ? `[SOCRATIC TUTOR MODE - Do NOT give the final answer directly. Break the problem into guided questions, deductions, and progressive steps]${contextDocNote}\nStudent Question: ${textToSend}`
        : `${contextDocNote}\n${textToSend}`;

      const res = await ConversationalChatFeature.chatWithShanky({
        userId,
        userMessage: socraticPrompt,
        conversationHistory: history,
        preferredSubjectId: selectedSubjectId === 'all' ? undefined : selectedSubjectId,
      });

      const reply = res.data?.reply || `Let's work through "${textToSend}". What is the core mechanism that initiates this behavior?`;

      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'tutor',
          text: reply,
        },
      ]);
    } catch (err: any) {
      console.warn('[StudyAITutor] Chat generation warning:', err);
      setChatMessages((prev) => [
        ...prev,
        {
          sender: 'tutor',
          text: `Let's examine "${textToSend}" step-by-step. First, think about the primary constraint: what causes the system to throttle or transform before reaching steady state? What mechanism detects that constraint?`,
        },
      ]);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Socratic Mode Status Pill */}
      <View style={[styles.socraticPillCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <View style={styles.socraticPillLeft}>
          <View style={[styles.socraticIcon, { backgroundColor: 'rgba(0, 229, 255, 0.15)' }]}>
            <Feather name="shield" size={15} color="#00E5FF" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.socraticTitle, { color: colors.text }]}>Socratic Mode: Active</Text>
            <Text style={[styles.socraticDesc, { color: colors.textSecondary }]}>
              No instant answer copy-paste. Solutions are scaffolded in progressive steps.
            </Text>
          </View>
        </View>
      </View>

      {/* 2. Interactive Solution Board */}
      <View style={[styles.boardCard, { backgroundColor: colors.surface, borderColor: 'rgba(0, 229, 255, 0.3)' }]}>
        <View style={styles.boardHeaderRow}>
          <View style={styles.boardHeaderLeft}>
            <View style={[styles.badgeDot, { backgroundColor: '#00E5FF' }]} />
            <Text style={styles.boardBadgeText}>SOLUTION STEPS BOARD</Text>
          </View>

          <View style={styles.boardCounterBadge}>
            <Text style={styles.boardCounterText}>
              Step {session.currentStepIndex} of {session.steps.length}
            </Text>
          </View>
        </View>

        <Text style={[styles.problemStatement, { color: colors.text }]}>
          {session.problemStatement}
        </Text>

        {/* Topic Selector for Solution Board */}
        {filteredTopics.length > 0 && (
          <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.topicSelectorScroll}>
            {filteredTopics.slice(0, 8).map((t) => {
              const isSelected = session.topicId === t.id;
              return (
                <Pressable
                  key={t.id}
                  onPress={() => handleSelectTopicSession(t)}
                  style={[
                    styles.topicChip,
                    isSelected
                      ? { backgroundColor: '#00E5FF', borderColor: '#00E5FF' }
                      : { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                  ]}
                >
                  <Text
                    style={[
                      styles.topicChipText,
                      isSelected ? { color: '#05070B', fontWeight: '700' } : { color: colors.textSecondary },
                    ]}
                  >
                    {t.name}
                  </Text>
                </Pressable>
              );
            })}
          </ScrollView>
        )}

        {/* Render Steps */}
        <View style={styles.stepsContainer}>
          {session.steps.map((step, idx) => {
            const isVisible = step.isRevealed;
            if (!isVisible) return null;

            return (
              <View
                key={step.stepNumber}
                style={[
                  styles.stepBox,
                  { backgroundColor: colors.surfaceSecondary, borderColor: colors.border },
                ]}
              >
                <View style={styles.stepNumBadge}>
                  <Text style={styles.stepNumText}>STEP {step.stepNumber}</Text>
                </View>
                <Text style={[styles.stepTitle, { color: colors.text }]}>{step.title}</Text>
                <Text style={[styles.stepContent, { color: colors.textSecondary }]}>{step.content}</Text>

                {step.guidingQuestion && (
                  <View style={[styles.guidingBox, { backgroundColor: 'rgba(124, 58, 237, 0.12)', borderColor: 'rgba(124, 58, 237, 0.3)' }]}>
                    <Feather name="help-circle" size={13} color="#A78BFA" />
                    <Text style={styles.guidingQuestionText}>
                      Check yourself: {step.guidingQuestion}
                    </Text>
                  </View>
                )}
              </View>
            );
          })}
        </View>

        {/* Board Action Controls */}
        <View style={styles.boardActionsRow}>
          {!session.isCompleted ? (
            <Pressable
              onPress={handleNextStep}
              style={[styles.nextStepBtn, { backgroundColor: '#00E5FF' }]}
            >
              <Text style={styles.nextStepText}>Next Step →</Text>
            </Pressable>
          ) : (
            <View style={styles.completedBanner}>
              <Feather name="check-circle" size={15} color="#10B981" />
              <Text style={styles.completedText}>Solution Complete! You worked through all steps.</Text>
            </View>
          )}

          <Pressable onPress={handleReplay} style={[styles.replayBtn, { borderColor: colors.border }]}>
            <Feather name="rotate-ccw" size={13} color={colors.textSecondary} />
            <Text style={[styles.replayText, { color: colors.textSecondary }]}>Replay</Text>
          </Pressable>
        </View>
      </View>

      {/* 3. Conversational Follow-up Chat */}
      <Text style={[styles.chatSectionTitle, { color: colors.text }]}>Tutor Discussion</Text>

      <View style={styles.chatMessagesList}>
        {chatMessages.map((msg, idx) => (
          <View
            key={idx}
            style={[
              styles.chatBubble,
              msg.sender === 'user'
                ? [styles.userBubble, { backgroundColor: '#7C3AED' }]
                : [styles.tutorBubble, { backgroundColor: colors.surface, borderColor: colors.border }],
            ]}
          >
            <Text
              style={[
                styles.chatText,
                msg.sender === 'user' ? { color: '#FFFFFF' } : { color: colors.text },
              ]}
            >
              {msg.text}
            </Text>
          </View>
        ))}
      </View>

      {/* Prompt Suggestions */}
      <View style={styles.promptPillsRow}>
        <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.promptScroll}>
          {PROMPT_SUGGESTIONS.map((prompt, idx) => (
            <Pressable
              key={idx}
              onPress={() => handleAskQuestion(prompt)}
              style={[styles.promptPill, { backgroundColor: colors.surfaceSecondary, borderColor: colors.border }]}
            >
              <Feather name="corner-down-right" size={11} color="#A78BFA" />
              <Text style={[styles.promptPillText, { color: colors.textSecondary }]}>{prompt}</Text>
            </Pressable>
          ))}
        </ScrollView>
      </View>

      {/* Chat Input Bar */}
      <View style={[styles.inputBar, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <TextInput
          value={questionInput}
          onChangeText={setQuestionInput}
          placeholder="Ask a question or request step-by-step guidance..."
          placeholderTextColor={colors.textTertiary}
          style={[styles.textInput, { color: colors.text }]}
          multiline
        />

        <Pressable
          onPress={() => handleAskQuestion()}
          style={[styles.sendBtn, { backgroundColor: questionInput.trim() ? '#00E5FF' : colors.surfaceSecondary }]}
          disabled={!questionInput.trim() || isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator size="small" color="#05070B" />
          ) : (
            <Feather name="arrow-up" size={16} color={questionInput.trim() ? '#05070B' : colors.textTertiary} />
          )}
        </Pressable>
      </View>

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
  socraticPillCard: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
    marginBottom: spacing.base,
  },
  socraticPillLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  socraticIcon: {
    width: 30,
    height: 30,
    borderRadius: 15,
    alignItems: 'center',
    justifyContent: 'center',
  },
  socraticTitle: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
  },
  socraticDesc: {
    fontSize: 11,
    marginTop: 1,
  },
  boardCard: {
    padding: spacing.base,
    borderRadius: radii.xl,
    borderWidth: 1,
    marginBottom: spacing.base,
  },
  boardHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.sm,
  },
  boardHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  badgeDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  boardBadgeText: {
    fontSize: 10,
    fontWeight: '800',
    color: '#00E5FF',
    letterSpacing: 0.5,
  },
  boardCounterBadge: {
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.full,
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
  },
  boardCounterText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#FFFFFF',
  },
  problemStatement: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    lineHeight: 22,
    marginBottom: spacing.md,
  },
  topicSelectorScroll: {
    marginBottom: spacing.md,
  },
  topicChip: {
    paddingHorizontal: 10,
    paddingVertical: 5,
    borderRadius: radii.full,
    borderWidth: 1,
    marginRight: spacing.xs,
  },
  topicChipText: {
    fontSize: 11,
    fontWeight: '500',
  },
  stepsContainer: {
    gap: spacing.sm,
    marginBottom: spacing.md,
  },
  stepBox: {
    padding: spacing.md,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  stepNumBadge: {
    alignSelf: 'flex-start',
    paddingHorizontal: 6,
    paddingVertical: 2,
    borderRadius: 4,
    backgroundColor: 'rgba(0, 229, 255, 0.15)',
    marginBottom: 4,
  },
  stepNumText: {
    fontSize: 9,
    fontWeight: '800',
    color: '#00E5FF',
  },
  stepTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    marginBottom: 4,
  },
  stepContent: {
    fontSize: typography.sizes.xs,
    lineHeight: 18,
  },
  guidingBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    marginTop: spacing.sm,
  },
  guidingQuestionText: {
    fontSize: 11,
    color: '#A78BFA',
    lineHeight: 16,
    flex: 1,
    fontStyle: 'italic',
  },
  boardActionsRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    gap: spacing.sm,
  },
  nextStepBtn: {
    flex: 1,
    paddingVertical: 10,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  nextStepText: {
    fontSize: typography.sizes.xs,
    fontWeight: '800',
    color: '#05070B',
  },
  completedBanner: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  completedText: {
    fontSize: typography.sizes.xs,
    color: '#10B981',
    fontWeight: '600',
  },
  replayBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  replayText: {
    fontSize: typography.sizes.xs,
    fontWeight: '600',
  },
  chatSectionTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.sm,
  },
  chatMessagesList: {
    gap: spacing.sm,
    marginBottom: spacing.base,
  },
  chatBubble: {
    padding: spacing.md,
    borderRadius: radii.lg,
    maxWidth: '90%',
  },
  userBubble: {
    alignSelf: 'flex-end',
    borderBottomRightRadius: 2,
  },
  tutorBubble: {
    alignSelf: 'flex-start',
    borderBottomLeftRadius: 2,
    borderWidth: 1,
  },
  chatText: {
    fontSize: typography.sizes.xs,
    lineHeight: 18,
  },
  promptPillsRow: {
    marginBottom: spacing.sm,
  },
  promptScroll: {
    gap: spacing.xs,
  },
  promptPill: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  promptPillText: {
    fontSize: 11,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: spacing.sm,
  },
  textInput: {
    flex: 1,
    fontSize: typography.sizes.xs,
    minHeight: 36,
    maxHeight: 80,
  },
  sendBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
