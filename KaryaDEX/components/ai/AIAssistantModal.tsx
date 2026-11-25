/**
 * KaryaDEX — AI Assistant Hub Modal (Phase 12 UX Recovery & Multimodal Integration)
 *
 * Full interactive assistant modal featuring:
 * - Banku (Heavy Lifter / Vision) & Shanky (Speedster / Logic Chat)
 * - Real conversational chat via Mistral 8B with deterministic academic context
 * - Multimodal document / routine / syllabus / calendar extraction via Gemini 3.8 Flash
 * - Proposal preview & approval pipeline (Zero Direct AI Database Writes)
 * - Vector iconography only (no emojis)
 */

import React, { useState, useEffect, useRef } from 'react';
import {
  Modal,
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  ScrollView,
  type ScrollViewInstance,
  TextInput,
  ActivityIndicator,
  Alert,
  Platform,
  Image,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import * as ImagePicker from 'expo-image-picker';
import {
  BANKU_PERSONA,
  SHANKY_PERSONA,
  DailyBriefingFeature,
  AttendanceExplainerFeature,
  TaskBreakdownFeature,
  TimetableExtractionFeature,
  ConversationalChatFeature,
  SyllabusExtractionFeature,
  CalendarExtractionFeature,
  ProfileSetupFeature,
  aiQuotaService,
  type AIPersonaId,
  type AIProposal,
  type DailyBriefingPayload,
  type AttendanceExplanationPayload,
} from '@/services/ai';
import { fileAssetToBase64, extractMagicBytesFromBase64, readFileAsset, validatePdfPageLimit } from '@/lib/fileUtils';
import { useAppStore } from '@/store/useAppStore';
import { useAcademicStore } from '@/store/useAcademicStore';
import { taskRepository, timetableRepository, examRepository } from '@/database';
import { AIBadge } from './AIBadge';
import { AIProposalCard } from './AIProposalCard';
import { AIAttendanceExplainerCard } from './AIAttendanceExplainerCard';
import { AIDailyBriefingCard } from './AIDailyBriefingCard';

import { MASCOT_ASSETS } from '@/constants/mascots';

export interface ChatAttachment {
  id: string;
  uri: string;
  name: string;
  mimeType: string;
  sizeBytes?: number;
  previewType: 'image' | 'pdf' | 'document';
  base64?: string;
  uploadedAt: string;
  category?: 'routine' | 'syllabus' | 'calendar' | 'assignment' | 'notes' | 'general';
}

export interface ContextChip {
  id: string;
  label: string;
  icon: keyof typeof Ionicons.glyphMap;
  prompt: string;
}

export interface PersonalizedContext {
  id: string;
  category: string;
  label: string;
  chips: ContextChip[];
  sourceQuery?: string;
  sourceAttachment?: ChatAttachment;
}

export const formatFileSize = (bytes?: number): string => {
  if (!bytes || bytes <= 0) return '0 KB';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
};

export function generatePersonalizedContext(params: {
  query?: string;
  attachment?: ChatAttachment;
  persona: AIPersonaId;
}): PersonalizedContext | null {
  const { query, attachment, persona } = params;
  const isBanku = persona === 'banku';

  // 1. If attachment was provided (or just uploaded)
  if (attachment) {
    const fileName = (attachment.name || '').toLowerCase();
    const cat = attachment.category;

    if (cat === 'routine' || fileName.includes('routine') || fileName.includes('timetable') || fileName.includes('schedule')) {
      return {
        id: 'routine-ctx',
        category: 'routine',
        label: 'Uploaded Routine',
        sourceAttachment: attachment,
        chips: isBanku
          ? [
              { id: 'r1', label: 'Check 75% Bunk Margin', icon: 'shield-checkmark', prompt: 'Based on this routine, calculate the minimum attendance I need to stay above 75%.' },
              { id: 'r2', label: 'Verify Monday Lectures', icon: 'calendar', prompt: 'Verify and list all Monday lecture slots from this timetable.' },
              { id: 'r3', label: 'Find Free Gaps & Slots', icon: 'time', prompt: 'Identify all free periods and lecture gaps where I can study.' },
              { id: 'r4', label: 'Check Schedule Conflicts', icon: 'alert-circle', prompt: 'Scan this routine for any overlapping lecture slots or room clashes.' },
              { id: 'r5', label: 'Upload Syllabus Next', icon: 'book', prompt: 'Upload syllabus' },
            ]
          : [
              { id: 'r1', label: 'Best Days to Bunk', icon: 'flash', prompt: 'Shanky, which days have the lightest lectures where a bunk causes minimal damage?' },
              { id: 'r2', label: 'Daily Energy Roadmap', icon: 'battery-charging', prompt: 'Create an energy and focus plan based on my heavy lecture days.' },
              { id: 'r3', label: 'Free Slot Study Hacks', icon: 'hourglass', prompt: 'How can I make the most of my 1-hour breaks between lectures?' },
              { id: 'r4', label: 'Class Navigation Tips', icon: 'compass', prompt: 'Give me tactical tips to balance back-to-back lab sessions.' },
            ],
      };
    }

    if (cat === 'syllabus' || fileName.includes('syllabus') || fileName.includes('curriculum') || fileName.includes('unit')) {
      return {
        id: 'syllabus-ctx',
        category: 'syllabus',
        label: 'Uploaded Syllabus',
        sourceAttachment: attachment,
        chips: isBanku
          ? [
              { id: 's1', label: 'Generate 1-Week Study Plan', icon: 'school', prompt: 'Break this syllabus into a structured 1-week study schedule with daily targets.' },
              { id: 's2', label: 'Predict High-Weightage Topics', icon: 'stats-chart', prompt: 'Which topics in this syllabus carry the highest weightage for university exams?' },
              { id: 's3', label: 'Create 5 Revision Flashcards', icon: 'card', prompt: 'Generate 5 high-yield revision flashcards for the first unit in this syllabus.' },
              { id: 's4', label: 'Recommend Reference Books', icon: 'library', prompt: 'What are the best standard textbooks and reference materials for this course?' },
              { id: 's5', label: 'Unit 1 & 2 Breakdown', icon: 'list', prompt: 'Give me a detailed conceptual breakdown of Units 1 and 2.' },
            ]
          : [
              { id: 's1', label: 'Night Before Exam Hacks', icon: 'flame', prompt: 'If I only have 24 hours, what core concepts from this syllabus must I memorize?' },
              { id: 's2', label: 'Feynman Technique on Unit 1', icon: 'bulb', prompt: 'Explain the hardest topic from this syllabus using the Feynman Technique.' },
              { id: 's3', label: 'Smart Study Shortcuts', icon: 'rocket', prompt: 'How can I master this syllabus fast without getting overwhelmed?' },
              { id: 's4', label: 'Expected Midterm Questions', icon: 'help-circle', prompt: 'Predict 3 likely questions the professor will ask from this syllabus.' },
            ],
      };
    }

    if (cat === 'calendar' || fileName.includes('calendar') || fileName.includes('academic') || fileName.includes('exam_date')) {
      return {
        id: 'calendar-ctx',
        category: 'calendar',
        label: 'Academic Calendar',
        sourceAttachment: attachment,
        chips: isBanku
          ? [
              { id: 'cal1', label: 'Count Days to Midterms', icon: 'hourglass', prompt: 'Calculate the exact number of days remaining until mid-semester exams.' },
              { id: 'cal2', label: 'Mark College Holidays', icon: 'sunny', prompt: 'Extract all official college holidays and recess periods from this calendar.' },
              { id: 'cal3', label: 'Safe Attendance Runway', icon: 'shield', prompt: 'Calculate how many total lecture weeks we have before final semester exams.' },
              { id: 'cal4', label: 'Semester Exam Prep Roadmap', icon: 'trail-sign', prompt: 'Create an exam preparation timeline aligned with the academic calendar milestones.' },
            ]
          : [
              { id: 'cal1', label: 'Holiday Bunk Multipliers', icon: 'airplane', prompt: 'How can I bridge college holidays with safe bunks for a long weekend?' },
              { id: 'cal2', label: 'Last Minute Crunch Window', icon: 'timer', prompt: 'When should I strictly start serious prep so I do not burn out?' },
              { id: 'cal3', label: 'Midterm Defense Plan', icon: 'trophy', prompt: 'Give me a sprint plan to protect my attendance and ace midterms.' },
            ],
      };
    }

    if (cat === 'assignment' || fileName.includes('assign') || fileName.includes('homework') || fileName.includes('lab') || fileName.includes('problem')) {
      return {
        id: 'assignment-ctx',
        category: 'assignment',
        label: 'Uploaded Assignment',
        sourceAttachment: attachment,
        chips: isBanku
          ? [
              { id: 'a1', label: 'Break Down into Tasks', icon: 'list', prompt: 'Break this assignment down into organized subtasks with deadlines.' },
              { id: 'a2', label: 'Explain Key Formulas', icon: 'calculator', prompt: 'Explain the core formulas and concepts required to solve this assignment.' },
              { id: 'a3', label: 'Expected Viva Questions', icon: 'chatbubbles', prompt: 'What oral viva questions could a professor ask about this assignment?' },
              { id: 'a4', label: 'Check Solution Steps', icon: 'checkmark-circle', prompt: 'Review my approach and outline step-by-step verification points.' },
            ]
          : [
              { id: 'a1', label: 'Finish in Under 1 Hour', icon: 'flash', prompt: 'Give me a rapid execution guide to complete this assignment today.' },
              { id: 'a2', label: 'Common Traps & Mistakes', icon: 'warning', prompt: 'What common errors do students make when solving these types of problems?' },
              { id: 'a3', label: 'Explain Like I Am 5', icon: 'happy', prompt: 'Explain the core problem in this assignment in the simplest possible terms.' },
            ],
      };
    }

    if (attachment.previewType === 'image') {
      return {
        id: 'photo-ctx',
        category: 'photo',
        label: 'Uploaded Photo',
        sourceAttachment: attachment,
        chips: isBanku
          ? [
              { id: 'p1', label: 'Transcribe & Summarize Notes', icon: 'document-text', prompt: 'Transcribe any text or equations visible in this photo and summarize key points.' },
              { id: 'p2', label: 'Explain Diagram / Concept', icon: 'shapes', prompt: 'Explain the technical concepts, diagrams, or formulas depicted in this image.' },
              { id: 'p3', label: 'Generate Practice Questions', icon: 'help-circle', prompt: 'Generate 3 exam practice questions based on the content of this image.' },
              { id: 'p4', label: 'Convert into Study Tasks', icon: 'checkbox', prompt: 'Turn the concepts in this photo into structured actionable study tasks.' },
            ]
          : [
              { id: 'p1', label: 'Quick Concept Breakdown', icon: 'flash', prompt: 'Shanky, break down what is happening in this photo in 3 simple bullet points.' },
              { id: 'p2', label: 'How to Remember This', icon: 'bulb', prompt: 'Give me a memorable mnemonic or mental model to retain what is in this image.' },
              { id: 'p3', label: 'High Yield Summary', icon: 'star', prompt: 'What is the #1 most important takeaway from this uploaded photo?' },
            ],
      };
    }

    return {
      id: 'doc-ctx',
      category: 'document',
      label: 'Uploaded Document',
      sourceAttachment: attachment,
      chips: isBanku
        ? [
            { id: 'd1', label: 'Analyze Document Contents', icon: 'search', prompt: 'Analyze this document and extract the primary academic takeaways.' },
            { id: 'd2', label: 'Extract Key Dates & Deadlines', icon: 'calendar', prompt: 'Identify all dates, submission deadlines, or exam notices mentioned in this document.' },
            { id: 'd3', label: 'Summarize for Study Review', icon: 'reader', prompt: 'Provide a concise academic executive summary of this uploaded file.' },
          ]
        : [
            { id: 'd1', label: 'TL;DR Fast Summary', icon: 'flash', prompt: 'Give me a fast TL;DR of this document so I know what matters.' },
            { id: 'd2', label: 'What Should I Do Next?', icon: 'compass', prompt: 'What are the top 2 things I should do based on this uploaded document?' },
          ],
    };
  }

  // 2. If user query/question was provided
  if (query) {
    const q = query.toLowerCase();

    if (q.includes('attend') || q.includes('bunk') || q.includes('percent') || q.includes('75%') || q.includes('safe') || q.includes('shortage')) {
      return {
        id: 'attend-ctx',
        category: 'attendance',
        label: 'Attendance Strategy',
        sourceQuery: query,
        chips: [
          { id: 'at1', label: 'Calculate Safe Bunk Margin', icon: 'shield-checkmark', prompt: 'Calculate my exact safe bunk margin so I do not drop below 75%.' },
          { id: 'at2', label: 'How to Recover from 65%', icon: 'trending-up', prompt: 'How many consecutive classes must I attend to recover from 65% back to 75%?' },
          { id: 'at3', label: 'Simulate Next 5 Classes', icon: 'calculator', prompt: 'Simulate my attendance percentage if I miss 2 of the next 5 classes.' },
          { id: 'at4', label: 'Medical Leave Protocol', icon: 'medkit', prompt: 'What documentation is typically required for medical attendance condonation?' },
        ],
      };
    }

    if (q.includes('code') || q.includes('program') || q.includes('recursion') || q.includes('stack') || q.includes('tree') || q.includes('graph') || q.includes('algo') || q.includes('python') || q.includes('java') || q.includes('c++') || q.includes('sql') || q.includes('osi') || q.includes('database')) {
      return {
        id: 'code-ctx',
        category: 'coding',
        label: 'Computer Science & Code',
        sourceQuery: query,
        chips: [
          { id: 'cd1', label: 'Time & Space Complexity', icon: 'speedometer', prompt: 'What is the Big-O time and space complexity of this concept, and why?' },
          { id: 'cd2', label: 'Dry Run with Example', icon: 'play-circle', prompt: 'Walk me through a step-by-step dry run with a simple concrete example.' },
          { id: 'cd3', label: 'Common Pitfalls & Bugs', icon: 'bug', prompt: 'What common edge cases and runtime bugs trip students up on this topic?' },
          { id: 'cd4', label: 'Write Code Implementation', icon: 'code-slash', prompt: 'Provide clean, well-commented code demonstrating this concept.' },
          { id: 'cd5', label: 'Exam / Viva Questions', icon: 'school', prompt: 'How will professors or interviewers test this concept in an exam?' },
        ],
      };
    }

    if (q.includes('exam') || q.includes('cgpa') || q.includes('gpa') || q.includes('semester') || q.includes('feynman') || q.includes('study') || q.includes('marks')) {
      return {
        id: 'exam-ctx',
        category: 'exam',
        label: 'Exam Prep & CGPA',
        sourceQuery: query,
        chips: [
          { id: 'ex1', label: 'Target 8.5+ CGPA Roadmap', icon: 'trophy', prompt: 'What specific daily habits help engineering students sustain an 8.5+ CGPA?' },
          { id: 'ex2', label: 'Feynman Technique Practice', icon: 'bulb', prompt: 'Pick a hard concept from my subjects and teach it to me using the Feynman Technique.' },
          { id: 'ex3', label: '3-Day Cramming Protocol', icon: 'flame', prompt: 'If an exam is in 3 days, how should I divide revision between PYQs and concepts?' },
          { id: 'ex4', label: 'Active Recall vs Rereading', icon: 'repeat', prompt: 'How can I implement active recall testing rather than passive rereading?' },
        ],
      };
    }

    if (q.includes('letter') || q.includes('email') || q.includes('leave') || q.includes('professor') || q.includes('permission') || q.includes('hod') || q.includes('absent')) {
      return {
        id: 'comm-ctx',
        category: 'communication',
        label: 'Official Email & Letter',
        sourceQuery: query,
        chips: [
          { id: 'cm1', label: 'Formal Tone Email Draft', icon: 'mail', prompt: 'Rewrite this into a polite, respectful email suitable for a department HOD.' },
          { id: 'cm2', label: 'Medical Certificate Note', icon: 'fitness', prompt: 'Draft a short cover note for submitting a medical certificate to the college office.' },
          { id: 'cm3', label: 'Follow-Up Reminder Email', icon: 'refresh', prompt: 'Write a polite follow-up email in case the professor has not replied in 3 days.' },
          { id: 'cm4', label: 'Copy-Paste Template', icon: 'copy', prompt: 'Format the draft with clear Subject, Salutation, Body, and Student Details placeholders.' },
        ],
      };
    }

    if (q.includes('math') || q.includes('calculus') || q.includes('physics') || q.includes('derivat') || q.includes('integr') || q.includes('newton') || q.includes('force') || q.includes('theorem')) {
      return {
        id: 'stem-ctx',
        category: 'stem',
        label: 'Mathematics & Science',
        sourceQuery: query,
        chips: [
          { id: 'st1', label: 'Step-by-Step Derivation', icon: 'git-branch', prompt: 'Show the complete mathematical derivation step by step with justifications.' },
          { id: 'st2', label: 'Real-World Engineering Example', icon: 'construct', prompt: 'Give a concrete engineering or practical physical example of this law.' },
          { id: 'st3', label: 'Formula Sheet Summary', icon: 'document-text', prompt: 'Summarize the core equations and their units into a compact formula card.' },
          { id: 'st4', label: 'Practice Numerical Problem', icon: 'pencil', prompt: 'Give me one standard university exam numerical problem with solution.' },
        ],
      };
    }
  }

  return null;
}

interface AIAssistantModalProps {
  visible: boolean;
  onClose: () => void;
  initialPersona?: AIPersonaId;
  defaultSubjectId?: string;
}

export const AIAssistantModal: React.FC<AIAssistantModalProps> = ({
  visible,
  onClose,
  initialPersona = 'shanky',
  defaultSubjectId,
}) => {
  const [selectedPersona, setSelectedPersona] = useState<AIPersonaId>(initialPersona);
  const [isLoading, setIsLoading] = useState(false);
  const [inputText, setInputText] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Unified Chronological Chat Stream
  interface ChatMessage {
    id: string;
    sender: 'user' | 'assistant';
    text: string;
    persona?: AIPersonaId;
    suggestedActions?: string[];
    proposal?: AIProposal;
    attendanceData?: AttendanceExplanationPayload;
    briefingData?: DailyBriefingPayload;
    attachment?: ChatAttachment;
  }

  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [selectedAttachmentForPreview, setSelectedAttachmentForPreview] = useState<ChatAttachment | null>(null);
  const [showAttachmentMenu, setShowAttachmentMenu] = useState<boolean>(false);
  const [activeContext, setActiveContext] = useState<PersonalizedContext | null>(null);
  const scrollViewRef = useRef<any>(null);
  const ChatScrollView = ScrollView as React.ComponentType<any>;

  const scrollToBottom = (animated = true) => {
    setTimeout(() => {
      scrollViewRef.current?.scrollToEnd?.({ animated });
    }, 60);
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatMessages.length, isLoading, Boolean(errorMsg)]);

  // Quota Status
  const [remainingQuota, setRemainingQuota] = useState<number>(50);

  const student = useAppStore(s => s.user);
  const subjects = useAppStore(s => s.subjects);
  const userId = student?.id || 'student-local';

  useEffect(() => {
    if (visible) {
      setSelectedPersona(initialPersona);
      loadQuota();
    }
  }, [visible, initialPersona]);

  const loadQuota = async () => {
    try {
      const usage = await aiQuotaService.getDailyUsage(userId);
      const tier = aiQuotaService.getTier();
      setRemainingQuota(Math.max(0, tier.maxDailyRequests - usage.requestCount));
    } catch {}
  };

  const handlePersonaSwitch = (p: AIPersonaId) => {
    setSelectedPersona(p);
    setErrorMsg(null);
    if (activeContext) {
      const refreshed = generatePersonalizedContext({
        query: activeContext.sourceQuery,
        attachment: activeContext.sourceAttachment,
        persona: p,
      });
      if (refreshed) {
        setActiveContext(refreshed);
      }
    }
  };

  // 1. Quick Action: Daily Briefing (Integrated into chat stream)
  const handleDailyBriefing = async () => {
    setSelectedPersona('shanky');
    setIsLoading(true);
    setErrorMsg(null);
    setChatMessages(prev => [
      ...prev,
      { id: `user-${Date.now()}`, sender: 'user', text: 'What should I do today?' },
    ]);
    const tailored = generatePersonalizedContext({ query: 'What should I do today? Daily task briefing', persona: 'shanky' });
    if (tailored) setActiveContext(tailored);
    scrollToBottom();

    try {
      const res = await DailyBriefingFeature.getDailyBriefing({ userId });
      setChatMessages(prev => [
        ...prev,
        {
          id: `ast-${Date.now()}`,
          sender: 'assistant',
          text: `⚡ **Shanky's Tactical Daily Briefing**\nHere is your full academic radar, priority tasks, and today's schedule:`,
          persona: 'shanky',
          briefingData: res.data,
          suggestedActions: ['Explain Attendance', 'Check Tasks', 'How to study faster?'],
        },
      ]);
      await loadQuota();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to generate daily briefing.');
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

  // 2. Quick Action: Explain Attendance (Integrated into chat stream)
  const handleExplainAttendance = async (subjIdOverride?: string) => {
    setSelectedPersona('shanky');
    const subjId = subjIdOverride || defaultSubjectId || (subjects.length > 0 ? subjects[0].id : undefined);
    if (!subjId) {
      setErrorMsg('No subject available to explain attendance.');
      return;
    }

    const targetSubj = subjects.find(s => s.id === subjId);
    const subjName = targetSubj?.name || 'Subject';

    setIsLoading(true);
    setErrorMsg(null);
    setChatMessages(prev => [
      ...prev,
      { id: `user-${Date.now()}`, sender: 'user', text: `Explain attendance for ${subjName}` },
    ]);
    const tailored = generatePersonalizedContext({ query: 'Explain my attendance and bunk margins', persona: 'shanky' });
    if (tailored) setActiveContext(tailored);
    scrollToBottom();

    try {
      const res = await AttendanceExplainerFeature.explainSubjectAttendance({
        userId,
        subjectId: subjId,
      });
      setChatMessages(prev => [
        ...prev,
        {
          id: `ast-${Date.now()}`,
          sender: 'assistant',
          text: `⚡ **Attendance Analysis for ${res.data.subjectName}**\nCurrent attendance: ${res.data.deterministicPercentage.toFixed(1)}% (Target: ${res.data.deterministicTarget}%).`,
          persona: 'shanky',
          attendanceData: res.data,
          suggestedActions: ['View Attendance Tab', 'Safe Bunks', 'What should I do today?'],
        },
      ]);
      await loadQuota();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to explain attendance.');
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

  // 3. Quick Action: Break Down Assignment (Integrated into chat stream)
  const handleTaskBreakdownPrompt = async () => {
    const title = inputText.trim() || 'Pending Assignment';
    setInputText('');
    setIsLoading(true);
    setErrorMsg(null);
    setChatMessages(prev => [
      ...prev,
      { id: `user-${Date.now()}`, sender: 'user', text: `Break down assignment: ${title}` },
    ]);
    const tailored = generatePersonalizedContext({ query: `Break down assignment: ${title}`, persona: 'shanky' });
    if (tailored) setActiveContext(tailored);
    scrollToBottom();

    try {
      const res = await TaskBreakdownFeature.generateBreakdownProposal({
        userId,
        taskTitle: title,
        subjectId: defaultSubjectId || (subjects.length > 0 ? subjects[0].id : undefined),
      });

      if (res.proposal) {
        setChatMessages(prev => [
          ...prev,
          {
            id: `ast-${Date.now()}`,
            sender: 'assistant',
            text: `⚡ I've broken down **"${title}"** into structured subtasks with estimated times. Review and approve the proposal below:`,
            persona: 'shanky',
            proposal: res.proposal,
            suggestedActions: ['View Tasks', 'Add High Priority Task'],
          },
        ]);
      }
      await loadQuota();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to break down task.');
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

  // 4. Quick Action: Upload Routine / Timetable (Banku)
  const handleUploadTimetable = async () => {
    setSelectedPersona('banku');
    setErrorMsg(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      const isPdf = file.name?.toLowerCase().endsWith('.pdf') || file.mimeType?.toLowerCase().includes('pdf');
      if (isPdf) {
        const pageCheck = await validatePdfPageLimit(file.file || file, 40);
        if (!pageCheck.valid) {
          const warningMsg = "Document too large (exceeds 40 pages). Please upload only the specific routine, syllabus, or calendar pages.";
          setErrorMsg(warningMsg);
          Alert.alert("Document Too Large", warningMsg);
          return;
        }
      }

      const { base64: fileBase64, mimeType: parsedMime } = await readFileAsset(file);
      const resolvedMime = parsedMime || file.mimeType || (isPdf ? 'application/pdf' : 'image/png');
      const isImg = resolvedMime.startsWith('image/') || (!isPdf && !resolvedMime.includes('pdf'));

      const attachment: ChatAttachment = {
        id: `att-${Date.now()}`,
        uri: file.uri,
        name: file.name || (isPdf ? 'routine.pdf' : 'routine.png'),
        mimeType: resolvedMime,
        sizeBytes: file.size || Math.round((fileBase64.length * 3) / 4),
        previewType: isImg ? 'image' : 'pdf',
        base64: fileBase64,
        uploadedAt: new Date().toISOString(),
        category: 'routine',
      };

      setChatMessages(prev => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          sender: 'user',
          text: `Uploaded routine timetable document: ${file.name}`,
          attachment,
        },
      ]);
      const tailored = generatePersonalizedContext({ attachment, persona: 'banku' });
      if (tailored) setActiveContext(tailored);
      setIsLoading(true);
      scrollToBottom();

      const magicBytes = extractMagicBytesFromBase64(fileBase64);

      const res = await TimetableExtractionFeature.extractTimetableProposal({
        userId,
        fileBase64,
        fileMimeType: resolvedMime,
        fileName: file.name || (resolvedMime.includes('pdf') ? 'routine.pdf' : 'routine.png'),
        fileSizeBytes: file.size || Math.round((fileBase64.length * 3) / 4),
        magicBytes: magicBytes.length > 0 ? magicBytes : undefined,
      });

      if (res.proposal) {
        setChatMessages(prev => [
          ...prev,
          {
            id: `ast-${Date.now()}`,
            sender: 'assistant',
            text: `🛡️ **Banku Timetable Extraction Audit**\nI have extracted recurring lecture slots from your routine. Review and confirm below to update your schedule:`,
            persona: 'banku',
            proposal: res.proposal,
            suggestedActions: ['View Schedule', 'Upload Syllabus', 'Upload Calendar'],
          },
        ]);
      }
      await loadQuota();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to process timetable document.');
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

  // 5. Quick Action: Upload Syllabus (Banku)
  const handleUploadSyllabus = async () => {
    setSelectedPersona('banku');
    setErrorMsg(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      const isPdf = file.name?.toLowerCase().endsWith('.pdf') || file.mimeType?.toLowerCase().includes('pdf');
      if (isPdf) {
        const pageCheck = await validatePdfPageLimit(file.file || file, 40);
        if (!pageCheck.valid) {
          const warningMsg = "Document too large (exceeds 40 pages). Please upload only the specific routine, syllabus, or calendar pages.";
          setErrorMsg(warningMsg);
          Alert.alert("Document Too Large", warningMsg);
          return;
        }
      }

      const { base64: fileBase64, mimeType: parsedMime } = await readFileAsset(file);
      const resolvedMime = parsedMime || file.mimeType || 'application/pdf';
      const isImg = resolvedMime.startsWith('image/') || (!isPdf && !resolvedMime.includes('pdf'));

      const attachment: ChatAttachment = {
        id: `att-${Date.now()}`,
        uri: file.uri,
        name: file.name || (isPdf ? 'syllabus.pdf' : 'syllabus.png'),
        mimeType: resolvedMime,
        sizeBytes: file.size || Math.round((fileBase64.length * 3) / 4),
        previewType: isImg ? 'image' : 'pdf',
        base64: fileBase64,
        uploadedAt: new Date().toISOString(),
        category: 'syllabus',
      };

      setChatMessages(prev => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          sender: 'user',
          text: `Uploaded syllabus document: ${file.name}`,
          attachment,
        },
      ]);
      const tailored = generatePersonalizedContext({ attachment, persona: 'banku' });
      if (tailored) setActiveContext(tailored);
      setIsLoading(true);
      scrollToBottom();

      const magicBytes = extractMagicBytesFromBase64(fileBase64);

      const res = await SyllabusExtractionFeature.extractSyllabusProposal({
        userId,
        fileBase64,
        fileMimeType: resolvedMime,
        fileName: file.name || (resolvedMime.includes('pdf') ? 'syllabus.pdf' : 'syllabus.png'),
        fileSizeBytes: file.size || Math.round((fileBase64.length * 3) / 4),
        magicBytes: magicBytes.length > 0 ? magicBytes : undefined,
        targetSubjectId: defaultSubjectId || (subjects.length > 0 ? subjects[0].id : undefined),
      });

      if (res.proposal) {
        setChatMessages(prev => [
          ...prev,
          {
            id: `ast-${Date.now()}`,
            sender: 'assistant',
            text: `🛡️ **Banku Syllabus Extraction Audit**\nI have structured course units and topic breakdowns. Review and approve the proposal below:`,
            persona: 'banku',
            proposal: res.proposal,
            suggestedActions: ['View Subjects', 'Semester Exam Prep'],
          },
        ]);
      }
      await loadQuota();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to process syllabus document.');
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

  // 6. Quick Action: Upload College Calendar (Banku)
  const handleUploadCalendar = async () => {
    setSelectedPersona('banku');
    setErrorMsg(null);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['image/*', 'application/pdf'],
        copyToCacheDirectory: true,
      });

      if (result.canceled || !result.assets || result.assets.length === 0) {
        return;
      }

      const file = result.assets[0];
      const isPdf = file.name?.toLowerCase().endsWith('.pdf') || file.mimeType?.toLowerCase().includes('pdf');
      if (isPdf) {
        const pageCheck = await validatePdfPageLimit(file.file || file, 40);
        if (!pageCheck.valid) {
          const warningMsg = "Document too large (exceeds 40 pages). Please upload only the specific routine, syllabus, or calendar pages.";
          setErrorMsg(warningMsg);
          Alert.alert("Document Too Large", warningMsg);
          return;
        }
      }

      const { base64: fileBase64, mimeType: parsedMime } = await readFileAsset(file);
      const resolvedMime = parsedMime || file.mimeType || 'application/pdf';
      const isImg = resolvedMime.startsWith('image/') || (!isPdf && !resolvedMime.includes('pdf'));

      const attachment: ChatAttachment = {
        id: `att-${Date.now()}`,
        uri: file.uri,
        name: file.name || (isPdf ? 'academic_calendar.pdf' : 'calendar.png'),
        mimeType: resolvedMime,
        sizeBytes: file.size || Math.round((fileBase64.length * 3) / 4),
        previewType: isImg ? 'image' : 'pdf',
        base64: fileBase64,
        uploadedAt: new Date().toISOString(),
        category: 'calendar',
      };

      setChatMessages(prev => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          sender: 'user',
          text: `Uploaded academic calendar: ${file.name}`,
          attachment,
        },
      ]);
      const tailored = generatePersonalizedContext({ attachment, persona: 'banku' });
      if (tailored) setActiveContext(tailored);
      setIsLoading(true);
      scrollToBottom();

      const magicBytes = extractMagicBytesFromBase64(fileBase64);

      const res = await CalendarExtractionFeature.extractCalendarProposal({
        userId,
        fileBase64,
        fileMimeType: resolvedMime,
        fileName: file.name || (resolvedMime.includes('pdf') ? 'academic_calendar.pdf' : 'calendar.png'),
        fileSizeBytes: file.size || Math.round((fileBase64.length * 3) / 4),
        magicBytes: magicBytes.length > 0 ? magicBytes : undefined,
      });

      if (res.proposal) {
        setChatMessages(prev => [
          ...prev,
          {
            id: `ast-${Date.now()}`,
            sender: 'assistant',
            text: `🛡️ **Banku Academic Calendar Extraction Audit**\nExtracted examination windows and semester milestones. Confirm to sync into your calendar:`,
            persona: 'banku',
            proposal: res.proposal,
            suggestedActions: ['View Schedule', 'Semester Exam Prep'],
          },
        ]);
      }
      await loadQuota();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to process academic calendar document.');
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

  // General Attachment Picker (Camera, Gallery, or Document)
  const handlePickAttachment = async (sourceType: 'gallery' | 'camera' | 'document') => {
    setShowAttachmentMenu(false);
    setErrorMsg(null);
    try {
      let asset: any = null;
      if (sourceType === 'camera') {
        const permission = await ImagePicker.requestCameraPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission Required', 'Camera permission is required to capture photos.');
          return;
        }
        const result = await ImagePicker.launchCameraAsync({
          mediaTypes: ['images'],
          quality: 0.85,
        });
        if (result.canceled || !result.assets?.length) return;
        asset = result.assets[0];
      } else if (sourceType === 'gallery') {
        const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
        if (!permission.granted) {
          Alert.alert('Permission Required', 'Gallery access is required to choose photos.');
          return;
        }
        const result = await ImagePicker.launchImageLibraryAsync({
          mediaTypes: ['images'],
          quality: 0.85,
        });
        if (result.canceled || !result.assets?.length) return;
        asset = result.assets[0];
      } else {
        const result = await DocumentPicker.getDocumentAsync({
          type: ['image/*', 'application/pdf', '*/*'],
          copyToCacheDirectory: true,
        });
        if (result.canceled || !result.assets?.length) return;
        asset = result.assets[0];
      }

      if (!asset) return;

      const isPdf = asset.name?.toLowerCase().endsWith('.pdf') || asset.mimeType?.toLowerCase().includes('pdf');
      if (isPdf) {
        const pageCheck = await validatePdfPageLimit(asset.file || asset, 40);
        if (!pageCheck.valid) {
          const warningMsg = 'Document too large (exceeds 40 pages). Please upload only specific routine, syllabus, or lecture pages.';
          setErrorMsg(warningMsg);
          Alert.alert('Document Too Large', warningMsg);
          return;
        }
      }

      const { base64: fileBase64, mimeType: parsedMime } = await readFileAsset(asset);
      const resolvedMime = parsedMime || asset.mimeType || (isPdf ? 'application/pdf' : 'image/jpeg');
      const isImg = resolvedMime.startsWith('image/') || (!isPdf && !resolvedMime.includes('pdf'));
      const fileName = asset.name || (isImg ? 'uploaded_photo.jpg' : isPdf ? 'uploaded_document.pdf' : 'file.bin');
      const nameLower = fileName.toLowerCase();

      let detectedCategory: 'routine' | 'syllabus' | 'calendar' | 'assignment' | 'notes' | 'general' = isImg ? 'notes' : 'general';
      if (nameLower.includes('routine') || nameLower.includes('timetable') || nameLower.includes('schedule')) {
        detectedCategory = 'routine';
      } else if (nameLower.includes('syllabus') || nameLower.includes('curriculum')) {
        detectedCategory = 'syllabus';
      } else if (nameLower.includes('calendar') || nameLower.includes('exam_date')) {
        detectedCategory = 'calendar';
      } else if (nameLower.includes('assign') || nameLower.includes('homework') || nameLower.includes('problem')) {
        detectedCategory = 'assignment';
      }

      const attachment: ChatAttachment = {
        id: `att-${Date.now()}`,
        uri: asset.uri,
        name: fileName,
        mimeType: resolvedMime,
        sizeBytes: asset.size || Math.round((fileBase64.length * 3) / 4),
        previewType: isImg ? 'image' : isPdf ? 'pdf' : 'document',
        base64: fileBase64,
        uploadedAt: new Date().toISOString(),
        category: detectedCategory,
      };

      setChatMessages(prev => [
        ...prev,
        {
          id: `user-${Date.now()}`,
          sender: 'user',
          text: `Uploaded ${attachment.previewType === 'image' ? 'photo' : 'document'}: ${attachment.name}`,
          attachment,
        },
      ]);

      const tailored = generatePersonalizedContext({ attachment, persona: selectedPersona });
      if (tailored) setActiveContext(tailored);
      setIsLoading(true);
      scrollToBottom();

      // Process with AI according to category
      if (detectedCategory === 'routine') {
        const magicBytes = extractMagicBytesFromBase64(fileBase64);
        const res = await TimetableExtractionFeature.extractTimetableProposal({
          userId,
          fileBase64,
          fileMimeType: resolvedMime,
          fileName,
          fileSizeBytes: attachment.sizeBytes || 0,
          magicBytes: magicBytes.length > 0 ? magicBytes : undefined,
        });
        if (res.proposal) {
          setChatMessages(prev => [
            ...prev,
            {
              id: `ast-${Date.now()}`,
              sender: 'assistant',
              text: `🛡️ **Banku Routine Extraction**\nI analyzed your uploaded timetable (${fileName}) and extracted recurring slots. Review below:`,
              persona: selectedPersona,
              proposal: res.proposal,
              suggestedActions: ['View Schedule', 'Check Bunk Limits', 'Upload Syllabus'],
            },
          ]);
        }
      } else if (detectedCategory === 'syllabus') {
        const magicBytes = extractMagicBytesFromBase64(fileBase64);
        const res = await SyllabusExtractionFeature.extractSyllabusProposal({
          userId,
          fileBase64,
          fileMimeType: resolvedMime,
          fileName,
          fileSizeBytes: attachment.sizeBytes || 0,
          magicBytes: magicBytes.length > 0 ? magicBytes : undefined,
          targetSubjectId: defaultSubjectId || (subjects.length > 0 ? subjects[0].id : undefined),
        });
        if (res.proposal) {
          setChatMessages(prev => [
            ...prev,
            {
              id: `ast-${Date.now()}`,
              sender: 'assistant',
              text: `🛡️ **Banku Syllabus Extraction**\nStructured course units extracted from ${fileName}. Review proposal below:`,
              persona: selectedPersona,
              proposal: res.proposal,
              suggestedActions: ['View Subjects', 'Generate Study Plan'],
            },
          ]);
        }
      } else if (detectedCategory === 'calendar') {
        const magicBytes = extractMagicBytesFromBase64(fileBase64);
        const res = await CalendarExtractionFeature.extractCalendarProposal({
          userId,
          fileBase64,
          fileMimeType: resolvedMime,
          fileName,
          fileSizeBytes: attachment.sizeBytes || 0,
          magicBytes: magicBytes.length > 0 ? magicBytes : undefined,
        });
        if (res.proposal) {
          setChatMessages(prev => [
            ...prev,
            {
              id: `ast-${Date.now()}`,
              sender: 'assistant',
              text: `🛡️ **Banku Academic Calendar Extraction**\nExam dates and milestones extracted from ${fileName}. Review below:`,
              persona: selectedPersona,
              proposal: res.proposal,
              suggestedActions: ['View Schedule', 'Semester Exam Prep'],
            },
          ]);
        }
      } else {
        const isBanku = selectedPersona === 'banku';
        const userPrompt = `I uploaded a ${attachment.previewType === 'image' ? 'photo' : 'document'} named "${fileName}". Please analyze its academic relevance and guide me.`;
        
        if (isBanku) {
          const res = await ConversationalChatFeature.chatWithBanku({
            userId,
            userMessage: userPrompt,
            conversationHistory: chatMessages.map(m => ({ sender: m.sender, text: m.text })),
          });
          setChatMessages(prev => [
            ...prev,
            {
              id: `ast-${Date.now()}`,
              sender: 'assistant',
              text: `🛡️ **Banku Multimodal File Verification**\nReceived and inspected **${fileName}** (${formatFileSize(attachment.sizeBytes)}).\n\n${res.data.reply}`,
              persona: 'banku',
              suggestedActions: res.data.suggestedActions || ['Transcribe Notes', 'Explain Core Concepts', 'Generate Practice Quiz'],
              proposal: res.data.proposal,
            },
          ]);
        } else {
          const res = await ConversationalChatFeature.chatWithShanky({
            userId,
            userMessage: userPrompt,
            conversationHistory: chatMessages.map(m => ({ sender: m.sender, text: m.text })),
            preferredSubjectId: defaultSubjectId,
          });
          setChatMessages(prev => [
            ...prev,
            {
              id: `ast-${Date.now()}`,
              sender: 'assistant',
              text: `⚡ **Shanky Quick Scan**\nFile loaded: **${fileName}**!\n\n${res.data.reply}`,
              persona: 'shanky',
              suggestedActions: res.data.suggestedActions || ['Key Takeaways', 'How to Remember This', 'Quick Practice'],
              proposal: (res.data as any).proposal,
            },
          ]);
        }
      }

      await loadQuota();
    } catch (err: any) {
      setErrorMsg(err.message || 'Failed to process attachment.');
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

  // 7. Conversational Chat & Natural Language Input
  const handleSubmitInput = async (overrideText?: string) => {
    const query = (typeof overrideText === 'string' ? overrideText : inputText).trim();
    if (!query) return;
    setInputText('');
    setIsLoading(true);
    setErrorMsg(null);

    setChatMessages(prev => [...prev, { id: `user-${Date.now()}`, sender: 'user', text: query }]);
    const tailored = generatePersonalizedContext({ query, persona: selectedPersona });
    if (tailored) {
      setActiveContext(tailored);
    }
    scrollToBottom();

    try {
      if (selectedPersona === 'shanky') {
        // Real Shanky conversational chat via Mistral & AcademicChatEngine
        const res = await ConversationalChatFeature.chatWithShanky({
          userId,
          userMessage: query,
          conversationHistory: chatMessages.map(m => ({ sender: m.sender, text: m.text })),
          preferredSubjectId: defaultSubjectId,
        });

        setChatMessages(prev => [
          ...prev,
          {
            id: `ast-${Date.now()}`,
            sender: 'assistant',
            text: res.data.reply,
            persona: 'shanky',
            suggestedActions: res.data.suggestedActions,
            proposal: (res.data as any).proposal,
          },
        ]);
      } else {
        // Banku text input: live conversational chat dispatch via Gemini 3.8 Flash & AcademicChatEngine
        const res = await ConversationalChatFeature.chatWithBanku({
          userId,
          userMessage: query,
          conversationHistory: chatMessages.map(m => ({ sender: m.sender, text: m.text })),
        });

        setChatMessages(prev => [
          ...prev,
          {
            id: `ast-${Date.now()}`,
            sender: 'assistant',
            text: res.data.reply,
            persona: 'banku',
            suggestedActions: res.data.suggestedActions,
            proposal: res.data.proposal,
          },
        ]);
      }
      await loadQuota();
    } catch (err: any) {
      setErrorMsg(err.message || 'AI request failed.');
    } finally {
      setIsLoading(false);
      scrollToBottom();
    }
  };

  const handleClearChat = () => {
    setChatMessages([]);
    setErrorMsg(null);
  };

  // Proposal Confirmation Handlers
  const handleApproveProposal = async (proposal: AIProposal) => {
    if (proposal.type === 'IMPORT_TIMETABLE') {
      await TimetableExtractionFeature.applyApprovedProposal(proposal as any);
      Alert.alert('Success', 'Timetable slots saved to your schedule!');
    } else if (proposal.type === 'IMPORT_SYLLABUS') {
      const targetSubj = defaultSubjectId || (subjects.length > 0 ? subjects[0].id : '');
      await SyllabusExtractionFeature.applyApprovedProposal(proposal as any, targetSubj);
      Alert.alert('Success', 'Syllabus units and topics saved!');
    } else if (proposal.type === 'IMPORT_CALENDAR') {
      await CalendarExtractionFeature.applyApprovedProposal(proposal as any);
      Alert.alert('Success', 'Academic calendar and examination dates updated!');
    } else if (proposal.type === 'CREATE_SUBTASKS') {
      await TaskBreakdownFeature.applyApprovedProposal(proposal as any);
      Alert.alert('Success', 'Subtasks added to your tasks list!');
    } else if (proposal.type === 'UPDATE_PROFILE') {
      await ProfileSetupFeature.applyApprovedProposal(proposal as any);
      Alert.alert('Success', 'Profile details updated!');
    } else if (proposal.type === 'DELETE_TASK') {
      const taskId = proposal.payload?.taskId;
      if (taskId) {
        await taskRepository.deleteTask(taskId);
        useAppStore.getState().deleteTask(taskId);
      }
      Alert.alert('Success', 'Task removed from your tasks list!');
    } else if (proposal.type === 'UPDATE_TASK') {
      const { taskId, updates } = proposal.payload || {};
      if (taskId && updates) {
        await taskRepository.updateTask(taskId, updates);
        useAppStore.getState().updateTask(taskId, updates);
      }
      Alert.alert('Success', 'Task updated successfully!');
    } else if (proposal.type === 'CREATE_TASK') {
      useAppStore.getState().addTask(proposal.payload);
      Alert.alert('Success', 'Task added to your tasks list!');
    } else if (proposal.type === 'DELETE_TIMETABLE_SLOT') {
      const slotId = proposal.payload?.slotId;
      if (slotId) {
        await timetableRepository.deleteTimetableSlot(slotId);
        useAcademicStore.getState().deleteTimetableSlot(slotId);
        await useAppStore.getState().refreshFromDatabase();
      }
      Alert.alert('Success', 'Class removed from your schedule!');
    } else if (proposal.type === 'CLEAR_TIMETABLE') {
      const allSlots = await timetableRepository.getTimetableSlots(true);
      for (const slot of allSlots) {
        await timetableRepository.deleteTimetableSlot(slot.id);
        useAcademicStore.getState().deleteTimetableSlot(slot.id);
      }
      await useAppStore.getState().refreshFromDatabase();
      Alert.alert('Success', 'Timetable schedule cleared!');
    } else if (proposal.type === 'MARK_ATTENDANCE') {
      const { subjectId, status } = proposal.payload || {};
      if (subjectId && status) {
        useAppStore.getState().markAttendance(subjectId, status);
      }
      Alert.alert('Success', 'Attendance recorded!');
    } else if (proposal.type === 'CREATE_EXAM') {
      const examData = proposal.payload;
      if (examData) {
        await examRepository.createExam(examData);
        await useAppStore.getState().refreshFromDatabase();
      }
      Alert.alert('Success', 'Exam added to your schedule!');
    } else if (proposal.type === 'DELETE_EXAM') {
      const examId = proposal.payload?.examId;
      if (examId) {
        await examRepository.deleteExam(examId);
        await useAppStore.getState().refreshFromDatabase();
      }
      Alert.alert('Success', 'Exam removed from your schedule!');
    }

    // Mark proposal status as applied in message stream
    setChatMessages(prev =>
      prev.map(m =>
        m.proposal?.id === proposal.id
          ? { ...m, proposal: { ...m.proposal, status: 'applied' } }
          : m
      )
    );
  };

  const handleDismissProposal = (proposal: AIProposal) => {
    setChatMessages(prev =>
      prev.map(m =>
        m.proposal?.id === proposal.id
          ? { ...m, proposal: undefined }
          : m
      )
    );
  };

  const isBanku = selectedPersona === 'banku';

  return (
    <Modal visible={visible} animationType="slide" transparent={false} onRequestClose={onClose}>
      <View style={styles.container}>
        {/* Top Header */}
        <View style={styles.topBar}>
          <TouchableOpacity onPress={onClose} style={styles.closeBtn} accessibilityLabel="Close AI Assistant">
            <Ionicons name="close" size={24} color="#94A3B8" />
          </TouchableOpacity>
          <Text style={styles.headerTitle}>Academic Intelligence</Text>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            {chatMessages.length > 0 && (
              <TouchableOpacity onPress={handleClearChat} style={styles.clearBtn} accessibilityLabel="Clear chat session">
                <Ionicons name="trash-outline" size={16} color="#94A3B8" />
              </TouchableOpacity>
            )}
            <View style={styles.quotaPill}>
              <Ionicons name="sparkles" size={12} color="#38BDF8" />
              <Text style={styles.quotaText}>{remainingQuota} left</Text>
            </View>
          </View>
        </View>

        {/* Persona Switcher Tabs */}
        <View style={styles.personaTabs}>
          <TouchableOpacity
            style={[styles.personaTab, isBanku && styles.bankuActiveTab]}
            onPress={() => handlePersonaSwitch('banku')}
            accessibilityLabel="Switch to Banku persona"
          >
            <Image source={MASCOT_ASSETS.banku.avatar} style={styles.tabMascotAvatar} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.personaTabName, isBanku && styles.bankuText]}>BANKU</Text>
              <Text style={styles.personaTabSub}>Vision & Academic Sentinel</Text>
            </View>
          </TouchableOpacity>

          <TouchableOpacity
            style={[styles.personaTab, !isBanku && styles.shankyActiveTab]}
            onPress={() => handlePersonaSwitch('shanky')}
            accessibilityLabel="Switch to Shanky persona"
          >
            <Image source={MASCOT_ASSETS.shanky.avatar} style={styles.tabMascotAvatar} resizeMode="contain" />
            <View style={{ flex: 1 }}>
              <Text style={[styles.personaTabName, !isBanku && styles.shankyText]}>SHANKY</Text>
              <Text style={styles.personaTabSub}>Conversation & Planning AI</Text>
            </View>
          </TouchableOpacity>
        </View>

        {/* Dynamic Telemetry Strip (Mascot Design Board) */}
        <View style={[styles.telemetryStrip, isBanku ? styles.bankuTelemetry : styles.shankyTelemetry]}>
          <View style={[styles.telemetryDot, { backgroundColor: isBanku ? '#F59E0B' : '#00E5FF' }]} />
          <Text style={[styles.telemetryText, { color: isBanku ? '#F59E0B' : '#00E5FF' }]}>
            {isBanku
              ? 'LIVE TELEMETRY • ACADEMIC SENTINEL & GENERAL Q&A • GEMINI 3.8 FLASH'
              : 'LIVE TELEMETRY • TACTICAL CO-PILOT & CHAT • MISTRAL 8B'}
          </Text>
        </View>

        {/* Quick Action Chips — Dynamically Personalized for User Uploads & Queries */}
        <View style={styles.chipsSectionHeader}>
          <View style={styles.chipsHeaderLeft}>
            <Ionicons
              name={activeContext ? 'sparkles' : 'options-outline'}
              size={13}
              color={activeContext ? (isBanku ? '#F59E0B' : '#00E5FF') : '#94A3B8'}
            />
            <Text style={[styles.chipsSectionTitle, activeContext && { color: isBanku ? '#F59E0B' : '#00E5FF' }]}>
              {activeContext ? `TAILORED FOR: ${activeContext.label.toUpperCase()}` : 'TASK OPTIONS'}
            </Text>
          </View>
          {activeContext ? (
            <TouchableOpacity
              style={styles.toggleStandardBtn}
              onPress={() => setActiveContext(null)}
              accessibilityLabel="Switch to standard options"
            >
              <Text style={styles.toggleStandardText}>Standard Actions</Text>
              <Ionicons name="refresh" size={11} color="#94A3B8" />
            </TouchableOpacity>
          ) : (
            <Text style={styles.chipsSubtitle}>
              {isBanku ? 'Academic & Routine Operations' : 'Tactical & Study Hacks'}
            </Text>
          )}
        </View>

        <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.chipsScroll}>
          {activeContext ? (
            activeContext.chips.map(chip => (
              <TouchableOpacity
                key={chip.id}
                style={[
                  styles.chip,
                  isBanku ? styles.bankuChip : styles.shankyChip,
                  styles.personalizedChipHighlight,
                ]}
                onPress={() => {
                  if (chip.prompt === 'Upload routine') {
                    handleUploadTimetable();
                  } else if (chip.prompt === 'Upload syllabus') {
                    handleUploadSyllabus();
                  } else if (chip.prompt === 'Upload calendar') {
                    handleUploadCalendar();
                  } else {
                    handleSubmitInput(chip.prompt);
                  }
                }}
              >
                <Ionicons name={chip.icon} size={14} color={isBanku ? '#F59E0B' : '#00E5FF'} />
                <Text style={styles.chipText}>{chip.label}</Text>
              </TouchableOpacity>
            ))
          ) : isBanku ? (
            <>
              <TouchableOpacity
                style={[styles.chip, styles.bankuChip]}
                onPress={() => handleSubmitInput('How should I prepare for semester exams?')}
              >
                <Ionicons name="school-outline" size={14} color="#F59E0B" />
                <Text style={styles.chipText}>Semester Exam Prep</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, styles.bankuChip]}
                onPress={() => handleSubmitInput('Explain recursion and its call stack with code')}
              >
                <Ionicons name="code-slash-outline" size={14} color="#F59E0B" />
                <Text style={styles.chipText}>Explain Recursion</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.chip, styles.bankuChip]} onPress={handleUploadTimetable}>
                <Ionicons name="calendar-outline" size={14} color="#F59E0B" />
                <Text style={styles.chipText}>Upload Routine</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.chip, styles.bankuChip]} onPress={handleUploadSyllabus}>
                <Ionicons name="book-outline" size={14} color="#F59E0B" />
                <Text style={styles.chipText}>Upload Syllabus</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.chip, styles.bankuChip]} onPress={handleUploadCalendar}>
                <Ionicons name="newspaper-outline" size={14} color="#F59E0B" />
                <Text style={styles.chipText}>Upload Calendar</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, styles.bankuChip]}
                onPress={() => handleSubmitInput('Write a medical leave email to my professor')}
              >
                <Ionicons name="mail-outline" size={14} color="#F59E0B" />
                <Text style={styles.chipText}>Write Leave Letter</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, styles.bankuChip]}
                onPress={() => setInputText('Delete task ')}
              >
                <Ionicons name="trash-outline" size={14} color="#F59E0B" />
                <Text style={styles.chipText}>Delete Task Command</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, styles.bankuChip]}
                onPress={() => setInputText('Clear timetable')}
              >
                <Ionicons name="refresh-outline" size={14} color="#F59E0B" />
                <Text style={styles.chipText}>Reset Routine Command</Text>
              </TouchableOpacity>
            </>
          ) : (
            <>
              <TouchableOpacity style={[styles.chip, styles.shankyChip]} onPress={handleDailyBriefing}>
                <Ionicons name="sunny-outline" size={14} color="#00E5FF" />
                <Text style={styles.chipText}>What should I do today?</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.chip, styles.shankyChip]} onPress={() => handleExplainAttendance()}>
                <Ionicons name="pie-chart-outline" size={14} color="#00E5FF" />
                <Text style={styles.chipText}>Explain Attendance</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, styles.shankyChip]}
                onPress={() => handleSubmitInput('How does the Feynman technique work?')}
              >
                <Ionicons name="flash-outline" size={14} color="#00E5FF" />
                <Text style={styles.chipText}>Feynman Technique</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, styles.shankyChip]}
                onPress={() => handleSubmitInput('How can I improve my CGPA this semester?')}
              >
                <Ionicons name="trending-up-outline" size={14} color="#00E5FF" />
                <Text style={styles.chipText}>CGPA Growth Hacks</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.chip, styles.shankyChip]} onPress={handleTaskBreakdownPrompt}>
                <Ionicons name="list-outline" size={14} color="#00E5FF" />
                <Text style={styles.chipText}>Break Down Task</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, styles.shankyChip]}
                onPress={() => handleSubmitInput('Explain the 7 layers of the OSI model')}
              >
                <Ionicons name="git-network-outline" size={14} color="#00E5FF" />
                <Text style={styles.chipText}>OSI Model</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[styles.chip, styles.shankyChip]}
                onPress={() => setInputText('Add high priority task: ')}
              >
                <Ionicons name="add-circle-outline" size={14} color="#00E5FF" />
                <Text style={styles.chipText}>Create Task Command</Text>
              </TouchableOpacity>
            </>
          )}
        </ScrollView>

        {/* Content Area */}
        <ChatScrollView
          ref={scrollViewRef}
          onContentSizeChange={() => scrollToBottom(false)}
          style={styles.contentScroll}
          contentContainerStyle={styles.contentInner}
        >
          {chatMessages.length === 0 && !isLoading ? (
            <View style={styles.placeholderBox}>
              <Image
                source={isBanku ? MASCOT_ASSETS.banku.hero : MASCOT_ASSETS.shanky.hero}
                style={styles.placeholderMascotImage}
                resizeMode="contain"
              />
              <Text style={[styles.placeholderTitle, { color: isBanku ? '#F59E0B' : '#00E5FF' }]}>
                {isBanku ? 'Banku — Academic Sentinel & Vision AI' : 'Shanky — Tactical Co-Pilot & Chat AI'}
              </Text>
              <Text style={styles.placeholderSub}>
                {isBanku
                  ? 'Ask me ANY question! Whether it is complex engineering concepts, math problems, coding, exam prep, syllabus analysis, timetable routines, or voice/text commands — I am your armor-clad academic sentinel.'
                  : 'Ask me anything! From attendance navigation and daily schedules to quick study hacks, subject doubts, and productivity tricks — let us crush college together.'}
              </Text>

              {/* Starter Question Cards */}
              <View style={styles.starterCardsContainer}>
                <Text style={styles.starterCardsHeader}>
                  {isBanku ? 'Tap any question to ask Banku:' : 'Tap any question to ask Shanky:'}
                </Text>
                {(isBanku
                  ? [
                      'Explain recursion and its call stack with code',
                      'How should I prepare for semester exams?',
                      'What are Newton\'s 3 laws of motion?',
                      'Write a medical leave email to my professor',
                    ]
                  : [
                      'What should I do today?',
                      'How does the Feynman technique work?',
                      'How can I improve my CGPA this semester?',
                      'Explain the 7 layers of the OSI model',
                    ]
                ).map((promptQuery, pIdx) => (
                  <TouchableOpacity
                    key={pIdx}
                    style={[styles.starterCard, isBanku ? styles.bankuStarterCard : styles.shankyStarterCard]}
                    onPress={() => handleSubmitInput(promptQuery)}
                  >
                    <Ionicons
                      name={isBanku ? 'shield-checkmark' : 'flash'}
                      size={14}
                      color={isBanku ? '#F59E0B' : '#00E5FF'}
                    />
                    <Text style={styles.starterCardText}>{promptQuery}</Text>
                    <Ionicons name="arrow-forward" size={13} color="#64748B" />
                  </TouchableOpacity>
                ))}
              </View>
            </View>
          ) : null}

          {/* Chat Messages */}
          {chatMessages.map(msg => {
            const isAssistant = msg.sender === 'assistant';
            const personaKey = msg.persona || selectedPersona;
            const hasRichCard = Boolean(msg.proposal || msg.attendanceData || msg.briefingData);

            return (
              <View
                key={msg.id}
                style={[
                  styles.chatBubble,
                  !isAssistant ? styles.userBubble : styles.assistantBubble,
                  isAssistant && (personaKey === 'banku' ? styles.bankuAssistantBubble : styles.shankyAssistantBubble),
                  hasRichCard && styles.richCardAssistantBubble,
                ]}
              >
                {isAssistant ? (
                  <View style={styles.assistantHeaderRow}>
                    <Image
                      source={MASCOT_ASSETS[personaKey]?.avatar || MASCOT_ASSETS.banku.avatar}
                      style={styles.chatAvatarThumb}
                      resizeMode="contain"
                    />
                    <Text style={[styles.assistantNameText, { color: personaKey === 'banku' ? '#F59E0B' : '#00E5FF' }]}>
                      {personaKey === 'banku' ? 'BANKU • Academic Sentinel' : 'SHANKY • Tactical Co-Pilot'}
                    </Text>
                  </View>
                ) : null}

                {msg.text ? <Text style={styles.chatText}>{msg.text}</Text> : null}

                {/* Uploaded Attachment Visual Preview Card */}
                {msg.attachment ? (
                  <TouchableOpacity
                    style={styles.attachmentCard}
                    onPress={() => setSelectedAttachmentForPreview(msg.attachment!)}
                    activeOpacity={0.85}
                    accessibilityLabel={`Preview ${msg.attachment.name}`}
                  >
                    {msg.attachment.previewType === 'image' ? (
                      <View style={styles.imageThumbContainer}>
                        <Image
                          source={{
                            uri:
                              msg.attachment.uri?.startsWith('http') ||
                              msg.attachment.uri?.startsWith('file') ||
                              msg.attachment.uri?.startsWith('content') ||
                              msg.attachment.uri?.startsWith('data') ||
                              msg.attachment.uri?.startsWith('blob')
                                ? msg.attachment.uri
                                : `data:${msg.attachment.mimeType};base64,${msg.attachment.base64}`,
                          }}
                          style={styles.attachmentImageThumb}
                          resizeMode="cover"
                        />
                        <View style={styles.imageOverlayBadge}>
                          <Ionicons name="expand-outline" size={13} color="#FFFFFF" />
                          <Text style={styles.imageOverlayText}>Tap to preview</Text>
                        </View>
                      </View>
                    ) : (
                      <View style={styles.docThumbContainer}>
                        <View
                          style={[
                            styles.docIconBox,
                            msg.attachment.previewType === 'pdf' ? styles.pdfIconBox : styles.genericDocBox,
                          ]}
                        >
                          <Ionicons
                            name={msg.attachment.previewType === 'pdf' ? 'document-text' : 'document-attach'}
                            size={24}
                            color={msg.attachment.previewType === 'pdf' ? '#EF4444' : '#38BDF8'}
                          />
                        </View>
                        <View style={{ flex: 1, marginLeft: 10 }}>
                          <Text style={styles.docFileName} numberOfLines={1}>
                            {msg.attachment.name}
                          </Text>
                          <View style={styles.docMetaRow}>
                            <Text style={styles.docMetaText}>{formatFileSize(msg.attachment.sizeBytes)}</Text>
                            <View style={styles.docTypeBadge}>
                              <Text style={styles.docTypeText}>
                                {msg.attachment.previewType === 'pdf' ? 'PDF' : 'DOC'}
                              </Text>
                            </View>
                          </View>
                        </View>
                        <Ionicons name="chevron-forward" size={18} color="#64748B" />
                      </View>
                    )}
                    <View style={styles.attachmentBottomBar}>
                      <Text style={styles.attachmentBottomFileName} numberOfLines={1}>
                        {msg.attachment.name}
                      </Text>
                      <View style={styles.tapToOpenRow}>
                        <Ionicons name="open-outline" size={12} color="#38BDF8" />
                        <Text style={styles.tapToOpenText}>Open & Inspect</Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                ) : null}

                {/* Attached Proposal Preview Card */}
                {msg.proposal ? (
                  <View style={styles.inlineCardWrapper}>
                    <AIProposalCard
                      proposal={msg.proposal}
                      onApprove={handleApproveProposal}
                      onDismiss={() => handleDismissProposal(msg.proposal!)}
                    />
                  </View>
                ) : null}

                {/* Attached Attendance Explainer Card */}
                {msg.attendanceData ? (
                  <View style={styles.inlineCardWrapper}>
                    <AIAttendanceExplainerCard data={msg.attendanceData} />
                  </View>
                ) : null}

                {/* Attached Daily Briefing Card */}
                {msg.briefingData ? (
                  <View style={styles.inlineCardWrapper}>
                    <AIDailyBriefingCard data={msg.briefingData} />
                  </View>
                ) : null}

                {/* Suggested Action Chips */}
                {msg.suggestedActions && msg.suggestedActions.length > 0 ? (
                  <View style={styles.suggestionsBox}>
                    {msg.suggestedActions.map((act, aIdx) => (
                      <TouchableOpacity
                        key={aIdx}
                        style={styles.suggestionPill}
                        onPress={() => handleSubmitInput(act)}
                      >
                        <Text style={styles.suggestionText}>{act}</Text>
                      </TouchableOpacity>
                    ))}
                  </View>
                ) : null}
              </View>
            );
          })}

          {/* Loading Indicator — Appears AT THE BOTTOM directly below the user message */}
          {isLoading ? (
            <View
              style={[
                styles.chatBubble,
                styles.assistantBubble,
                isBanku ? styles.bankuAssistantBubble : styles.shankyAssistantBubble,
                styles.loadingBubble,
              ]}
            >
              <View style={styles.assistantHeaderRow}>
                <Image
                  source={MASCOT_ASSETS[selectedPersona]?.avatar || MASCOT_ASSETS.banku.avatar}
                  style={styles.chatAvatarThumb}
                  resizeMode="contain"
                />
                <Text style={[styles.assistantNameText, { color: isBanku ? '#F59E0B' : '#00E5FF' }]}>
                  {isBanku ? 'BANKU • Academic Sentinel' : 'SHANKY • Tactical Co-Pilot'}
                </Text>
              </View>
              <View style={styles.loadingInnerRow}>
                <ActivityIndicator size="small" color={isBanku ? '#F59E0B' : '#00E5FF'} />
                <Text style={[styles.loadingBubbleText, { color: isBanku ? '#FDE68A' : '#A5F3FC' }]}>
                  {isBanku ? 'Banku is formulating structured academic intelligence...' : 'Shanky is formulating strategy...'}
                </Text>
              </View>
            </View>
          ) : null}

          {/* Error Notice — Appears right in the bottom flow */}
          {errorMsg ? (
            <View style={styles.errorBox}>
              <Ionicons name="alert-circle" size={18} color="#EF4444" />
              <Text style={styles.errorMsgText}>{errorMsg}</Text>
            </View>
          ) : null}
        </ChatScrollView>

        {/* Input Bar */}
        <View style={styles.inputBar}>
          <TouchableOpacity
            style={styles.attachBtn}
            onPress={() => setShowAttachmentMenu(true)}
            accessibilityLabel="Attach photo or document"
          >
            <Ionicons name="attach" size={22} color="#94A3B8" />
          </TouchableOpacity>

          <TextInput
            style={styles.textInput}
            placeholder={
              isBanku
                ? 'Ask Banku anything: Physics, Math, Code, Routine, Syllabus, or Commands...'
                : 'Ask Shanky anything: Study tips, attendance strategies, subject doubts...'
            }
            placeholderTextColor="#64748B"
            value={inputText}
            onChangeText={setInputText}
            onSubmitEditing={() => handleSubmitInput()}
          />
          <TouchableOpacity
            style={[styles.sendBtn, isBanku ? styles.bankuSendBtn : styles.shankySendBtn]}
            onPress={() => handleSubmitInput()}
            disabled={isLoading || !inputText.trim()}
          >
            <Ionicons name="arrow-up" size={18} color="#FFFFFF" />
          </TouchableOpacity>
        </View>

        {/* Attachment Full-Screen Preview Inspection Modal */}
        <Modal
          visible={Boolean(selectedAttachmentForPreview)}
          animationType="fade"
          transparent
          onRequestClose={() => setSelectedAttachmentForPreview(null)}
        >
          <View style={styles.previewBackdrop}>
            <View style={styles.previewModalContainer}>
              <View style={styles.previewTopBar}>
                <View style={{ flexDirection: 'row', alignItems: 'center', flex: 1, gap: 10, marginRight: 8 }}>
                  <Ionicons
                    name={selectedAttachmentForPreview?.previewType === 'image' ? 'image-outline' : 'document-text-outline'}
                    size={22}
                    color="#38BDF8"
                  />
                  <View style={{ flex: 1 }}>
                    <Text style={styles.previewTitle} numberOfLines={1}>
                      {selectedAttachmentForPreview?.name || 'Attachment Preview'}
                    </Text>
                    <Text style={styles.previewSubtitle}>
                      {formatFileSize(selectedAttachmentForPreview?.sizeBytes)} • {selectedAttachmentForPreview?.previewType?.toUpperCase()}
                    </Text>
                  </View>
                </View>
                <TouchableOpacity
                  onPress={() => setSelectedAttachmentForPreview(null)}
                  style={styles.previewCloseBtn}
                  accessibilityLabel="Close file preview"
                >
                  <Ionicons name="close" size={20} color="#F8FAFC" />
                </TouchableOpacity>
              </View>

              <View style={styles.previewContentArea}>
                {selectedAttachmentForPreview?.previewType === 'image' ? (
                  <Image
                    source={{
                      uri:
                        selectedAttachmentForPreview.uri?.startsWith('http') ||
                        selectedAttachmentForPreview.uri?.startsWith('file') ||
                        selectedAttachmentForPreview.uri?.startsWith('content') ||
                        selectedAttachmentForPreview.uri?.startsWith('data') ||
                        selectedAttachmentForPreview.uri?.startsWith('blob')
                          ? selectedAttachmentForPreview.uri
                          : `data:${selectedAttachmentForPreview.mimeType};base64,${selectedAttachmentForPreview.base64}`,
                    }}
                    style={styles.previewFullImage}
                    resizeMode="contain"
                  />
                ) : (
                  <View style={styles.previewDocCard}>
                    <View
                      style={[
                        styles.previewDocIconCircle,
                        selectedAttachmentForPreview?.previewType === 'pdf' ? styles.pdfIconCircle : styles.docIconCircle,
                      ]}
                    >
                      <Ionicons
                        name={selectedAttachmentForPreview?.previewType === 'pdf' ? 'document-text' : 'document-attach'}
                        size={48}
                        color={selectedAttachmentForPreview?.previewType === 'pdf' ? '#EF4444' : '#38BDF8'}
                      />
                    </View>
                    <Text style={styles.previewDocFileName} numberOfLines={2}>
                      {selectedAttachmentForPreview?.name}
                    </Text>
                    <Text style={styles.previewDocFileSize}>
                      {formatFileSize(selectedAttachmentForPreview?.sizeBytes)}
                    </Text>
                    <View style={styles.previewVerifiedBadge}>
                      <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                      <Text style={styles.previewVerifiedText}>Validated & Scanned for AI Intelligence</Text>
                    </View>
                  </View>
                )}
              </View>

              <View style={styles.previewBottomBar}>
                <TouchableOpacity
                  style={[styles.previewActionBtn, { backgroundColor: isBanku ? '#F59E0B' : '#00E5FF' }]}
                  onPress={() => {
                    const att = selectedAttachmentForPreview;
                    setSelectedAttachmentForPreview(null);
                    if (att) {
                      handleSubmitInput(`Analyze this uploaded file: "${att.name}" and provide key academic takeaways.`);
                    }
                  }}
                >
                  <Ionicons name="sparkles" size={16} color="#0F172A" />
                  <Text style={styles.previewActionBtnText}>
                    {isBanku ? 'Ask Banku to Analyze File' : 'Ask Shanky for Study Tips'}
                  </Text>
                </TouchableOpacity>
              </View>
            </View>
          </View>
        </Modal>

        {/* Attachment Options Action Sheet Modal */}
        <Modal
          visible={showAttachmentMenu}
          animationType="slide"
          transparent
          onRequestClose={() => setShowAttachmentMenu(false)}
        >
          <TouchableOpacity
            style={styles.sheetBackdrop}
            activeOpacity={1}
            onPress={() => setShowAttachmentMenu(false)}
          >
            <View style={styles.sheetContainer}>
              <View style={styles.sheetHeader}>
                <Text style={styles.sheetTitle}>Upload Photo or Document</Text>
                <Text style={styles.sheetSubtitle}>Banku & Shanky will analyze and personalize options</Text>
              </View>

              <TouchableOpacity
                style={styles.sheetOptionRow}
                onPress={() => handlePickAttachment('gallery')}
              >
                <View style={styles.sheetOptionIconBox}>
                  <Ionicons name="images-outline" size={20} color="#38BDF8" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetOptionTitle}>Choose Photo from Gallery</Text>
                  <Text style={styles.sheetOptionDesc}>Upload routine, notes, homework, or blackboard photo</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetOptionRow}
                onPress={() => handlePickAttachment('camera')}
              >
                <View style={styles.sheetOptionIconBox}>
                  <Ionicons name="camera-outline" size={20} color="#10B981" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetOptionTitle}>Take Photo with Camera</Text>
                  <Text style={styles.sheetOptionDesc}>Snap textbook page, handwritten notes, or exam schedule</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetOptionRow}
                onPress={() => handlePickAttachment('document')}
              >
                <View style={styles.sheetOptionIconBox}>
                  <Ionicons name="document-text-outline" size={20} color="#F59E0B" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetOptionTitle}>Upload PDF or Document</Text>
                  <Text style={styles.sheetOptionDesc}>Syllabus PDF, exam routine, assignment sheets</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetOptionRow}
                onPress={() => {
                  setShowAttachmentMenu(false);
                  handleUploadTimetable();
                }}
              >
                <View style={styles.sheetOptionIconBox}>
                  <Ionicons name="calendar-outline" size={20} color="#A855F7" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetOptionTitle}>Upload College Routine</Text>
                  <Text style={styles.sheetOptionDesc}>Extract recurring lecture slots automatically</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetOptionRow}
                onPress={() => {
                  setShowAttachmentMenu(false);
                  handleUploadSyllabus();
                }}
              >
                <View style={styles.sheetOptionIconBox}>
                  <Ionicons name="book-outline" size={20} color="#EC4899" />
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={styles.sheetOptionTitle}>Upload Subject Syllabus</Text>
                  <Text style={styles.sheetOptionDesc}>Extract unit breakdown, topics, and exam roadmap</Text>
                </View>
              </TouchableOpacity>

              <TouchableOpacity
                style={styles.sheetCancelBtn}
                onPress={() => setShowAttachmentMenu(false)}
              >
                <Text style={styles.sheetCancelText}>Cancel</Text>
              </TouchableOpacity>
            </View>
          </TouchableOpacity>
        </Modal>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0F172A',
  },
  topBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: Platform.OS === 'ios' ? 54 : 40,
    paddingBottom: 12,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  closeBtn: {
    padding: 6,
  },
  headerTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  quotaPill: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(56, 189, 248, 0.1)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 12,
    gap: 4,
  },
  quotaText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#38BDF8',
  },
  personaTabs: {
    flexDirection: 'row',
    paddingHorizontal: 16,
    paddingVertical: 10,
    gap: 8,
    backgroundColor: '#1E293B',
  },
  personaTab: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 8,
    paddingHorizontal: 10,
    borderRadius: 10,
    backgroundColor: '#0F172A',
    gap: 8,
    borderWidth: 1,
    borderColor: '#334155',
  },
  tabMascotAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
  },
  bankuActiveTab: {
    borderColor: '#F59E0B',
    backgroundColor: 'rgba(245, 158, 11, 0.08)',
  },
  shankyActiveTab: {
    borderColor: '#00E5FF',
    backgroundColor: 'rgba(0, 229, 255, 0.08)',
  },
  personaTabName: {
    fontSize: 12,
    fontWeight: '700',
    color: '#94A3B8',
  },
  bankuText: {
    color: '#F59E0B',
  },
  shankyText: {
    color: '#00E5FF',
  },
  personaTabSub: {
    fontSize: 10,
    color: '#64748B',
  },
  telemetryStrip: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 6,
    borderBottomWidth: 1,
    gap: 6,
  },
  bankuTelemetry: {
    backgroundColor: 'rgba(245, 158, 11, 0.06)',
    borderBottomColor: 'rgba(245, 158, 11, 0.15)',
  },
  shankyTelemetry: {
    backgroundColor: 'rgba(0, 229, 255, 0.06)',
    borderBottomColor: 'rgba(0, 229, 255, 0.15)',
  },
  telemetryDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  telemetryText: {
    fontSize: 9.5,
    fontWeight: '700',
    letterSpacing: 0.8,
  },
  chipsScroll: {
    maxHeight: 52,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  chip: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 16,
    marginRight: 8,
    gap: 6,
    borderWidth: 1,
    borderColor: '#334155',
  },
  bankuChip: {
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  shankyChip: {
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },
  chipText: {
    fontSize: 12,
    color: '#E2E8F0',
    fontWeight: '500',
  },
  contentScroll: {
    flex: 1,
  },
  contentInner: {
    padding: 16,
    gap: 12,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(239, 68, 68, 0.1)',
    borderColor: 'rgba(239, 68, 68, 0.3)',
    borderWidth: 1,
    borderRadius: 8,
    padding: 10,
    gap: 8,
    marginTop: 4,
  },
  errorMsgText: {
    fontSize: 12,
    color: '#FCA5A5',
    flex: 1,
  },
  richCardAssistantBubble: {
    maxWidth: '98%',
    width: '98%',
  },
  loadingBubble: {
    minWidth: 240,
    maxWidth: '85%',
    paddingVertical: 10,
    paddingHorizontal: 12,
  },
  loadingInnerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  loadingBubbleText: {
    fontSize: 12.5,
    fontStyle: 'italic',
    flex: 1,
  },
  inlineCardWrapper: {
    marginTop: 8,
    width: '100%',
  },
  chatBubble: {
    maxWidth: '85%',
    padding: 12,
    borderRadius: 14,
    marginVertical: 4,
  },
  userBubble: {
    alignSelf: 'flex-end',
    backgroundColor: '#2563EB',
    borderBottomRightRadius: 4,
  },
  assistantBubble: {
    alignSelf: 'flex-start',
    backgroundColor: '#1E293B',
    borderWidth: 1,
    borderBottomLeftRadius: 4,
  },
  bankuAssistantBubble: {
    borderColor: 'rgba(245, 158, 11, 0.3)',
  },
  shankyAssistantBubble: {
    borderColor: 'rgba(0, 229, 255, 0.3)',
  },
  assistantHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    marginBottom: 6,
  },
  chatAvatarThumb: {
    width: 18,
    height: 18,
    borderRadius: 9,
  },
  assistantNameText: {
    fontSize: 11,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  chatText: {
    color: '#F8FAFC',
    fontSize: 14,
    lineHeight: 20,
  },
  suggestionsBox: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
    marginTop: 8,
  },
  suggestionPill: {
    backgroundColor: 'rgba(255, 255, 255, 0.08)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.12)',
  },
  suggestionText: {
    fontSize: 11,
    color: '#38BDF8',
  },
  placeholderBox: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 36,
    paddingHorizontal: 20,
    gap: 12,
  },
  placeholderMascotImage: {
    width: 120,
    height: 120,
  },
  placeholderTitle: {
    fontSize: 16,
    fontWeight: '700',
    textAlign: 'center',
  },
  placeholderSub: {
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
  },
  inputBar: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    backgroundColor: '#0F172A',
    gap: 8,
  },
  textInput: {
    flex: 1,
    backgroundColor: '#1E293B',
    color: '#F8FAFC',
    borderRadius: 20,
    paddingHorizontal: 16,
    paddingVertical: 10,
    fontSize: 14,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sendBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    alignItems: 'center',
    justifyContent: 'center',
  },
  shankySendBtn: {
    backgroundColor: '#00E5FF',
  },
  bankuSendBtn: {
    backgroundColor: '#F59E0B',
  },
  clearBtn: {
    padding: 6,
    borderRadius: 8,
    backgroundColor: '#1E293B',
  },
  starterCardsContainer: {
    width: '100%',
    marginTop: 16,
    gap: 8,
  },
  starterCardsHeader: {
    fontSize: 12,
    fontWeight: '600',
    color: '#94A3B8',
    marginBottom: 4,
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  starterCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingVertical: 10,
    paddingHorizontal: 12,
    borderRadius: 10,
    borderWidth: 1,
    gap: 10,
  },
  bankuStarterCard: {
    borderColor: 'rgba(245, 158, 11, 0.25)',
  },
  shankyStarterCard: {
    borderColor: 'rgba(0, 229, 255, 0.25)',
  },
  starterCardText: {
    flex: 1,
    fontSize: 13,
    color: '#F1F5F9',
    fontWeight: '500',
  },
  attachBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: '#1E293B',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  chipsSectionHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingTop: 8,
    paddingBottom: 4,
  },
  chipsHeaderLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  chipsSectionTitle: {
    fontSize: 11,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 0.5,
  },
  chipsSubtitle: {
    fontSize: 11,
    color: '#64748B',
  },
  toggleStandardBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingVertical: 3,
    paddingHorizontal: 8,
    borderRadius: 10,
    backgroundColor: 'rgba(30, 41, 59, 0.8)',
    borderWidth: 1,
    borderColor: '#334155',
  },
  toggleStandardText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#94A3B8',
  },
  personalizedChipHighlight: {
    borderWidth: 1.5,
  },
  attachmentCard: {
    marginTop: 8,
    borderRadius: 12,
    backgroundColor: '#0F172A',
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
  },
  imageThumbContainer: {
    width: '100%',
    height: 160,
    backgroundColor: '#020617',
    position: 'relative',
  },
  attachmentImageThumb: {
    width: '100%',
    height: '100%',
  },
  imageOverlayBadge: {
    position: 'absolute',
    bottom: 8,
    right: 8,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    paddingVertical: 4,
    paddingHorizontal: 8,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.15)',
  },
  imageOverlayText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  docThumbContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    padding: 12,
  },
  docIconBox: {
    width: 44,
    height: 44,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfIconBox: {
    backgroundColor: 'rgba(239, 68, 68, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  genericDocBox: {
    backgroundColor: 'rgba(56, 189, 248, 0.15)',
    borderWidth: 1,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  docFileName: {
    fontSize: 13,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  docMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    marginTop: 4,
  },
  docMetaText: {
    fontSize: 11,
    color: '#94A3B8',
  },
  docTypeBadge: {
    backgroundColor: '#1E293B',
    paddingHorizontal: 6,
    paddingVertical: 1,
    borderRadius: 4,
  },
  docTypeText: {
    fontSize: 10,
    fontWeight: '700',
    color: '#38BDF8',
  },
  attachmentBottomBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 12,
    paddingVertical: 8,
    backgroundColor: 'rgba(30, 41, 59, 0.5)',
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
  },
  attachmentBottomFileName: {
    fontSize: 11,
    color: '#94A3B8',
    flex: 1,
    marginRight: 8,
  },
  tapToOpenRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  tapToOpenText: {
    fontSize: 11,
    fontWeight: '600',
    color: '#38BDF8',
  },
  previewBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.95)',
    justifyContent: 'center',
    alignItems: 'center',
    padding: 16,
  },
  previewModalContainer: {
    width: '100%',
    maxHeight: '90%',
    backgroundColor: '#0F172A',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#334155',
    overflow: 'hidden',
    flexDirection: 'column',
  },
  previewTopBar: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 16,
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
    backgroundColor: '#1E293B',
  },
  previewTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  previewSubtitle: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 2,
  },
  previewCloseBtn: {
    width: 32,
    height: 32,
    borderRadius: 16,
    backgroundColor: 'rgba(255, 255, 255, 0.1)',
    alignItems: 'center',
    justifyContent: 'center',
  },
  previewContentArea: {
    minHeight: 280,
    maxHeight: 480,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#020617',
    padding: 12,
  },
  previewFullImage: {
    width: '100%',
    height: 360,
  },
  previewDocCard: {
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
    gap: 12,
  },
  previewDocIconCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    alignItems: 'center',
    justifyContent: 'center',
  },
  pdfIconCircle: {
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 2,
    borderColor: 'rgba(239, 68, 68, 0.3)',
  },
  docIconCircle: {
    backgroundColor: 'rgba(56, 189, 248, 0.12)',
    borderWidth: 2,
    borderColor: 'rgba(56, 189, 248, 0.3)',
  },
  previewDocFileName: {
    fontSize: 15,
    fontWeight: '700',
    color: '#F8FAFC',
    textAlign: 'center',
  },
  previewDocFileSize: {
    fontSize: 12,
    color: '#94A3B8',
  },
  previewVerifiedBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    paddingVertical: 6,
    paddingHorizontal: 12,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.25)',
    marginTop: 8,
  },
  previewVerifiedText: {
    fontSize: 12,
    fontWeight: '600',
    color: '#34D399',
  },
  previewBottomBar: {
    padding: 14,
    borderTopWidth: 1,
    borderTopColor: '#1E293B',
    backgroundColor: '#0F172A',
    gap: 8,
  },
  previewActionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
    borderRadius: 10,
    gap: 8,
  },
  previewActionBtnText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  sheetBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(2, 6, 23, 0.75)',
    justifyContent: 'flex-end',
  },
  sheetContainer: {
    backgroundColor: '#1E293B',
    borderTopLeftRadius: 20,
    borderTopRightRadius: 20,
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: Platform.OS === 'ios' ? 36 : 20,
    borderTopWidth: 1,
    borderTopColor: '#334155',
  },
  sheetHeader: {
    marginBottom: 16,
  },
  sheetTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#F8FAFC',
  },
  sheetSubtitle: {
    fontSize: 12,
    color: '#94A3B8',
    marginTop: 2,
  },
  sheetOptionRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    gap: 14,
    borderBottomWidth: 1,
    borderBottomColor: 'rgba(51, 65, 85, 0.5)',
  },
  sheetOptionIconBox: {
    width: 36,
    height: 36,
    borderRadius: 18,
    backgroundColor: '#0F172A',
    alignItems: 'center',
    justifyContent: 'center',
    borderWidth: 1,
    borderColor: '#334155',
  },
  sheetOptionTitle: {
    fontSize: 14,
    fontWeight: '600',
    color: '#F8FAFC',
  },
  sheetOptionDesc: {
    fontSize: 11,
    color: '#94A3B8',
    marginTop: 1,
  },
  sheetCancelBtn: {
    marginTop: 14,
    paddingVertical: 12,
    alignItems: 'center',
    justifyContent: 'center',
    backgroundColor: '#0F172A',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#334155',
  },
  sheetCancelText: {
    fontSize: 14,
    fontWeight: '600',
    color: '#94A3B8',
  },
});

