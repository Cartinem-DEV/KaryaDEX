/**
 * KaryaDEX — Study Navigation Route & Primary Workspace (Tab 4)
 *
 * Unified academic learning and intelligent study workspace:
 * Exam countdown, personalized study planning, materials ingestion,
 * Socratic AI tutor, active recall practice, and syllabus mastery tracking.
 */

import React, { useState, useEffect, useCallback } from 'react';
import { View, StyleSheet, ActivityIndicator } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { DarkThemeScope, useTheme } from '@/constants/ThemeContext';
import { useAppStore } from '@/store/useAppStore';
import { useAcademicStore } from '@/store/useAcademicStore';
import { StudyHeader } from '@/components/study/StudyHeader';
import { StudyOverviewTab } from '@/components/study/StudyOverviewTab';
import { StudyPlanTab } from '@/components/study/StudyPlanTab';
import { StudyMaterialsTab } from '@/components/study/StudyMaterialsTab';
import { StudyAITutorTab } from '@/components/study/StudyAITutorTab';
import { StudyPracticeCenterTab } from '@/components/study/StudyPracticeCenterTab';
import { StudyMasteryTab } from '@/components/study/StudyMasteryTab';
import type { StudySubTab } from '@/components/study/types';
import { syllabusRepository } from '@/database/repositories/syllabusRepository';
import { examRepository } from '@/database/repositories/examRepository';
import { subjectRepository } from '@/database/repositories/subjectRepository';
import type { Topic } from '@/types/academic';
import type { Subject, Exam } from '@/types';

export default function StudyScreen() {
  const insets = useSafeAreaInsets();
  const { colors } = useTheme();

  // App & Academic Stores
  const { subjects: storeSubjects, exams: storeExams } = useAppStore();
  const { topics: storeTopics } = useAcademicStore();

  const [activeTab, setActiveTab] = useState<StudySubTab>('overview');
  const [selectedSubjectId, setSelectedSubjectId] = useState<string | 'all'>('all');
  const [subjects, setSubjects] = useState<Subject[]>(storeSubjects || []);
  const [topics, setTopics] = useState<Topic[]>(storeTopics || []);
  const [exams, setExams] = useState<Exam[]>(storeExams || []);
  const [isLoading, setIsLoading] = useState<boolean>(true);
  const [tutorContextDoc, setTutorContextDoc] = useState<string | null>(null);

  const loadData = useCallback(async () => {
    try {
      const [fetchedSubjects, fetchedTopics, fetchedExams] = await Promise.all([
        subjectRepository.getSubjects(),
        syllabusRepository.getAllTopics(),
        examRepository.getExams(),
      ]);
      setSubjects(fetchedSubjects.length > 0 ? (fetchedSubjects as any) : storeSubjects);
      setTopics(fetchedTopics.length > 0 ? fetchedTopics : storeTopics);
      setExams(fetchedExams.length > 0 ? fetchedExams : storeExams);
    } catch (err) {
      console.warn('[StudyScreen] Failed to load SQLite academic data:', err);
    } finally {
      setIsLoading(false);
    }
  }, [storeSubjects, storeTopics, storeExams]);

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Find primary upcoming exam for header countdown
  const todayStr = new Date().toISOString().split('T')[0];
  const upcomingExams = exams
    .filter((e) => e.date >= todayStr)
    .sort((a, b) => a.date.localeCompare(b.date));
  const primaryExam = upcomingExams[0] || (exams.length > 0 ? exams[0] : null);

  let countdownDays: number | null = null;
  if (primaryExam) {
    const examDate = new Date(primaryExam.date);
    const now = new Date();
    countdownDays = Math.max(0, Math.ceil((examDate.getTime() - now.getTime()) / (1000 * 60 * 60 * 24)));
  }

  const handleNavigateToTutorWithDoc = (docTitle: string) => {
    setTutorContextDoc(docTitle);
    setActiveTab('tutor');
  };

  return (
    <DarkThemeScope>
      <View style={[styles.rootContainer, { paddingTop: insets.top, backgroundColor: '#05070B' }]}>
        {/* Study Navigation & Subject Filter Header */}
        <StudyHeader
          activeTab={activeTab}
          onSelectTab={setActiveTab}
          subjects={subjects}
          selectedSubjectId={selectedSubjectId}
          onSelectSubject={setSelectedSubjectId}
          countdownDays={countdownDays}
          examName={primaryExam ? primaryExam.name : null}
        />

        {/* Content Body */}
        {isLoading ? (
          <View style={styles.loadingContainer}>
            <ActivityIndicator size="large" color="#00E5FF" />
          </View>
        ) : (
          <View style={styles.contentBody}>
            {activeTab === 'overview' && (
              <StudyOverviewTab
                subjects={subjects}
                topics={topics}
                exams={exams}
                selectedSubjectId={selectedSubjectId}
                onNavigateTab={setActiveTab}
                onRefreshData={loadData}
              />
            )}

            {activeTab === 'plan' && (
              <StudyPlanTab
                subjects={subjects}
                topics={topics}
                exams={exams}
                selectedSubjectId={selectedSubjectId}
                onRefreshData={loadData}
              />
            )}

            {activeTab === 'materials' && (
              <StudyMaterialsTab
                subjects={subjects}
                selectedSubjectId={selectedSubjectId}
                onNavigateToTutorWithDoc={handleNavigateToTutorWithDoc}
                onRefreshData={loadData}
              />
            )}

            {activeTab === 'tutor' && (
              <StudyAITutorTab
                subjects={subjects}
                topics={topics}
                selectedSubjectId={selectedSubjectId}
                initialContextDoc={tutorContextDoc}
              />
            )}

            {activeTab === 'practice' && (
              <StudyPracticeCenterTab
                subjects={subjects}
                topics={topics}
                selectedSubjectId={selectedSubjectId}
                onRefreshData={loadData}
              />
            )}

            {activeTab === 'mastery' && (
              <StudyMasteryTab
                subjects={subjects}
                topics={topics}
                selectedSubjectId={selectedSubjectId}
                onRefreshData={loadData}
              />
            )}
          </View>
        )}
      </View>
    </DarkThemeScope>
  );
}

const styles = StyleSheet.create({
  rootContainer: {
    flex: 1,
  },
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  contentBody: {
    flex: 1,
  },
});
