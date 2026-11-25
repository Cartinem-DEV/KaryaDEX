/**
 * KaryaDEX — Master Onboarding Flow Coordinator
 *
 * Drives the onboarding state machine through all steps, handles back/skip logic,
 * ensures durable step saving to SQLite, and finalizes canonical data commitment.
 * Features an interactive physics-driven pullback transition from Screen 2 to Screen 1.
 */

import React, { useState, useEffect, useCallback, useRef } from 'react';
import { View, StyleSheet, useWindowDimensions } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  interpolate,
  Easing,
  runOnJS,
} from 'react-native-reanimated';
import { DarkThemeScope } from '@/constants/ThemeContext';
import { AmbientBackground } from '@/components/ui';
import { OnboardingProgressBar } from './OnboardingProgressBar';
import { StepWelcome } from './StepWelcome';
import { OnboardingScreen2 } from './OnboardingScreen2';
import { OnboardingScreen3 } from './OnboardingScreen3';
import { OnboardingScreen4 } from './OnboardingScreen4';
import { StepProfile } from './StepProfile';
import { StepCollege } from './StepCollege';
import { StepAcademic } from './StepAcademic';
import { StepSubjects } from './StepSubjects';
import { StepSyllabus } from './StepSyllabus';
import { StepTimetable } from './StepTimetable';
import { StepAttendance } from './StepAttendance';
import { StepStorage } from './StepStorage';
import { StepNotifications } from './StepNotifications';
import { StepCompletion } from './StepCompletion';

import type { OnboardingStep, OnboardingDraftData } from '@/types/onboarding';
import { onboardingService } from '@/services/onboardingService';
import { useAppStore } from '@/store/useAppStore';

export const STEP_ORDER: OnboardingStep[] = [
  'welcome',
  'showcase_attendance',
  'showcase_ai',
  'auth',
  'profile',
  'college',
  'academic',
  'subjects',
  'syllabus',
  'timetable',
  'attendance',
  'storage',
  'notifications',
  'completion',
];

export const STEP_TITLES: Record<OnboardingStep, string> = {
  welcome: 'Welcome',
  showcase_attendance: 'Attendance Mastery',
  showcase_ai: 'Dual AI Engine',
  auth: 'Account Setup',
  profile: 'Profile',
  college: 'Institution',
  academic: 'Academic Structure',
  subjects: 'Subjects',
  syllabus: 'Syllabus',
  timetable: 'Timetable',
  attendance: 'Attendance Target',
  storage: 'File Storage',
  notifications: 'Reminders',
  completion: 'Ready',
};

interface OnboardingFlowProps {
  initialStep?: OnboardingStep;
  initialDraft?: OnboardingDraftData;
  canResume?: boolean;
  onComplete: () => void;
  onDemoMode: () => void;
}

export function OnboardingFlow({
  initialStep = 'welcome',
  initialDraft = {},
  canResume = false,
  onComplete,
  onDemoMode,
}: OnboardingFlowProps) {
  const { width } = useWindowDimensions();
  const [currentStep, setCurrentStep] = useState<OnboardingStep>(initialStep);
  const [draftData, setDraftData] = useState<OnboardingDraftData>(initialDraft);

  // Transition controller for pull-back animation between Screen 1 and Screen 2
  const transitionAnim = useSharedValue(initialStep === 'showcase_attendance' ? 1 : 0);
  const [isPullingBack, setIsPullingBack] = useState(false);
  const isTransitioningForward = useRef(false);

  // Load latest draft if resuming
  useEffect(() => {
    (async () => {
      const state = await onboardingService.getStartupState();
      if (state.canResume) {
        const progress = await onboardingService.startOnboarding(false);
        setDraftData(progress.draftData);
      }
    })();
  }, []);

  // Synchronize transition value if navigating directly from outside steps
  useEffect(() => {
    if (isTransitioningForward.current) return;
    if (currentStep === 'showcase_attendance' && !isPullingBack) {
      transitionAnim.value = 1;
    } else if (currentStep === 'welcome' && !isPullingBack) {
      transitionAnim.value = 0;
    }
  }, [currentStep, isPullingBack, transitionAnim]);

  const goToNext = async (step: OnboardingStep, patch: Partial<OnboardingDraftData>, nextStep: OnboardingStep) => {
    const updatedDraft: OnboardingDraftData = {
      ...draftData,
      ...patch,
    };
    setDraftData(updatedDraft);
    await onboardingService.saveStepData(step, patch, nextStep);
    setCurrentStep(nextStep);
  };

  // Screen 1 -> Screen 2 transition
  const handleWelcomeGetStarted = async () => {
    const prog = await onboardingService.startOnboarding(true);
    setDraftData(prog.draftData);
    isTransitioningForward.current = true;
    setCurrentStep('showcase_attendance');
    transitionAnim.value = 0;
    transitionAnim.value = withTiming(
      1,
      {
        duration: 380,
        easing: Easing.bezier(0.25, 0.1, 0.25, 1),
      },
      () => {
        isTransitioningForward.current = false;
      }
    );
  };

  const handleWelcomeResume = () => {
    const target = initialStep === 'welcome' ? 'showcase_attendance' : initialStep;
    if (target === 'showcase_attendance') {
      isTransitioningForward.current = true;
      setCurrentStep('showcase_attendance');
      transitionAnim.value = 0;
      transitionAnim.value = withTiming(
        1,
        {
          duration: 380,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        },
        () => {
          isTransitioningForward.current = false;
        }
      );
    } else {
      setCurrentStep(target);
    }
  };

  // Pull-back animation from Screen 2 back to Screen 1
  const finalizePullBack = useCallback(() => {
    setIsPullingBack(false);
    setCurrentStep('welcome');
  }, []);

  const handleShowcaseBack = useCallback(() => {
    setIsPullingBack(true);
    transitionAnim.value = withSpring(
      0,
      { damping: 24, stiffness: 220, mass: 0.9 },
      (finished) => {
        if (finished) {
          runOnJS(finalizePullBack)();
        }
      }
    );
  }, [finalizePullBack, transitionAnim]);

  // Animated styles for physical pull-back effect
  const welcomePullStyle = useAnimatedStyle(() => ({
    ...StyleSheet.absoluteFill,
    transform: [
      { translateX: interpolate(transitionAnim.value, [0, 1], [0, -width * 0.28]) },
      { scale: interpolate(transitionAnim.value, [0, 1], [1, 0.93]) },
    ],
    opacity: interpolate(transitionAnim.value, [0, 1], [1, 0.75]),
  }));

  const showcaseSlideStyle = useAnimatedStyle(() => ({
    ...StyleSheet.absoluteFill,
    transform: [
      { translateX: interpolate(transitionAnim.value, [0, 1], [width, 0]) },
    ],
  }));

  const WIZARD_STEPS: OnboardingStep[] = [
    'profile',
    'college',
    'academic',
    'subjects',
    'syllabus',
    'timetable',
    'attendance',
    'storage',
    'notifications',
  ];
  const currentWizardIndex = Math.max(1, WIZARD_STEPS.indexOf(currentStep) + 1);
  const totalWizardSteps = WIZARD_STEPS.length;

  const isWelcomeOrShowcase =
    currentStep === 'welcome' ||
    currentStep === 'showcase_attendance' ||
    currentStep === 'showcase_ai' ||
    currentStep === 'auth' ||
    isPullingBack;

  return (
    <DarkThemeScope>
      <SafeAreaView
        style={[
          styles.container,
          {
            backgroundColor: '#05070B',
          },
        ]}
      >
        <AmbientBackground forceDark />

        {/* Progress Bar (visible for wizard steps only — excludes welcome, showcase, completion) */}
        {!isWelcomeOrShowcase && currentStep !== 'completion' && (
          <OnboardingProgressBar
            currentStepIndex={currentWizardIndex}
            totalSteps={totalWizardSteps}
            stepTitle={STEP_TITLES[currentStep]}
            forceDark
          />
        )}

        {/* Step Views */}
        <View style={styles.stepContent}>
          {/* Animated Stack for Screen 1 (Welcome) and Screen 2 (Showcase) */}
          {isWelcomeOrShowcase && (
            <View style={StyleSheet.absoluteFill} pointerEvents="box-none">
              {/* Screen 1: Welcome — physically pulled forward on back press */}
              <Animated.View
                style={welcomePullStyle}
                pointerEvents={currentStep === 'welcome' && !isPullingBack ? 'auto' : 'none'}
              >
                <StepWelcome
                  canResume={canResume}
                  resumeStepName={STEP_TITLES[initialStep]}
                  onGetStarted={handleWelcomeGetStarted}
                  onResume={handleWelcomeResume}
                  onDemoMode={async () => {
                    await onboardingService.initDemoMode();
                    useAppStore.getState().initDemoMode();
                    onDemoMode();
                  }}
                />
              </Animated.View>

              {/* Screen 2: Attendance Showcase — slides/pulls back out to right on back press */}
              {(currentStep === 'showcase_attendance' || isPullingBack) && (
                <Animated.View
                  style={showcaseSlideStyle}
                  pointerEvents={currentStep === 'showcase_attendance' && !isPullingBack ? 'auto' : 'none'}
                >
                  <OnboardingScreen2
                    onNext={() => {
                      onboardingService.saveStepData('showcase_attendance', draftData, 'showcase_ai');
                      setCurrentStep('showcase_ai');
                    }}
                    onBack={handleShowcaseBack}
                    onSkip={() => {
                      onboardingService.saveStepData('showcase_attendance', draftData, 'auth');
                      setCurrentStep('auth');
                    }}
                  />
                </Animated.View>
              )}

              {/* Screen 3: Banku & Shanky Dual AI Showcase */}
              {currentStep === 'showcase_ai' && (
                <View style={StyleSheet.absoluteFill}>
                  <OnboardingScreen3
                    onNext={() => {
                      onboardingService.saveStepData('showcase_ai', draftData, 'auth');
                      setCurrentStep('auth');
                    }}
                    onBack={() => setCurrentStep('showcase_attendance')}
                    onSkip={() => {
                      onboardingService.saveStepData('showcase_ai', draftData, 'auth');
                      setCurrentStep('auth');
                    }}
                  />
                </View>
              )}

              {/* Screen 4: Authentication Gate */}
              {currentStep === 'auth' && (
                <View style={StyleSheet.absoluteFill}>
                  <OnboardingScreen4
                    onNext={async (authenticatedUser) => {
                      if (authenticatedUser) {
                        const existingProfile = draftData.profile;
                        const updatedProfile = {
                          name: authenticatedUser.name || existingProfile?.name || '',
                          email: authenticatedUser.email || existingProfile?.email,
                          avatarUrl: authenticatedUser.avatarUrl || existingProfile?.avatarUrl,
                          academicYear: existingProfile?.academicYear,
                          goals: existingProfile?.goals,
                        };

                        const updatedDraft: OnboardingDraftData = {
                          ...draftData,
                          profile: updatedProfile,
                        };
                        setDraftData(updatedDraft);
                        await onboardingService.saveStepData('auth', updatedDraft, 'profile');

                        // If real onboarding was already completed in durable storage, finalize into dashboard
                        const startup = await onboardingService.getStartupState();
                        if (startup.status === 'completed') {
                          onComplete();
                          return;
                        }
                      }
                      setCurrentStep('profile');
                    }}
                    onBack={() => setCurrentStep('showcase_ai')}
                    onSkip={() => setCurrentStep('profile')}
                  />
                </View>
              )}
            </View>
          )}

          {currentStep === 'profile' && (
            <StepProfile
              initialName={draftData.profile?.name}
              initialAcademicYear={draftData.profile?.academicYear}
              initialGoals={draftData.profile?.goals || draftData.goals}
              onNext={(profile) => goToNext('profile', { profile, goals: profile.goals }, 'college')}
              onBack={() => setCurrentStep('auth')}
            />
          )}

          {currentStep === 'college' && (
            <StepCollege
              initialCollege={draftData.college}
              onNext={(college) => goToNext('college', { college }, 'academic')}
              onBack={() => setCurrentStep('profile')}
            />
          )}

          {currentStep === 'academic' && (
            <StepAcademic
              initialAcademic={draftData.academic}
              initialCollege={draftData.college}
              initialAttendance={draftData.attendance}
              onNext={(academicData) => {
                const { college, attendanceTarget, ...academic } = academicData;
                const patch: Partial<OnboardingDraftData> = { academic };
                if (college) {
                  patch.college = { ...draftData.college, ...college };
                }
                if (attendanceTarget !== undefined) {
                  patch.attendance = { ...draftData.attendance, target: attendanceTarget };
                }
                goToNext('academic', patch, 'subjects');
              }}
              onBack={() => setCurrentStep('college')}
            />
          )}

          {currentStep === 'subjects' && (
            <StepSubjects
              initialSubjects={draftData.subjects}
              onNext={(subjects) => goToNext('subjects', { subjects }, 'syllabus')}
              onBack={() => setCurrentStep('academic')}
            />
          )}

          {currentStep === 'syllabus' && (
            <StepSyllabus
              subjects={draftData.subjects || []}
              initialUnits={draftData.syllabusUnits}
              onNext={(syllabusUnits, updatedSubjects) => {
                const patch: Partial<OnboardingDraftData> = { syllabusUnits };
                if (updatedSubjects && updatedSubjects.length > 0) {
                  patch.subjects = updatedSubjects;
                }
                goToNext('syllabus', patch, 'timetable');
              }}
              onSkip={() => goToNext('syllabus', {}, 'timetable')}
              onBack={() => setCurrentStep('subjects')}
            />
          )}

          {currentStep === 'timetable' && (
            <StepTimetable
              subjects={draftData.subjects || []}
              initialSlots={draftData.timetableSlots}
              onNext={(timetableSlots) => goToNext('timetable', { timetableSlots }, 'attendance')}
              onSkip={() => goToNext('timetable', {}, 'attendance')}
              onBack={() => setCurrentStep('syllabus')}
            />
          )}

          {currentStep === 'attendance' && (
            <StepAttendance
              subjects={draftData.subjects || []}
              initialTarget={draftData.attendance?.target ?? 75}
              initialStartingTotals={draftData.attendance?.startingTotals}
              onNext={(attendance) => goToNext('attendance', { attendance }, 'storage')}
              onBack={() => setCurrentStep('timetable')}
            />
          )}

          {currentStep === 'storage' && (
            <StepStorage
              initialStorageType={draftData.storage?.storageType}
              initialFolderName={draftData.storage?.folderName}
              onNext={(storage) => goToNext('storage', { storage }, 'notifications')}
              onBack={() => setCurrentStep('attendance')}
            />
          )}

          {currentStep === 'notifications' && (
            <StepNotifications
              initialNotifications={draftData.notifications}
              onNext={(notifications) => goToNext('notifications', { notifications }, 'completion')}
              onBack={() => setCurrentStep('storage')}
            />
          )}

          {currentStep === 'completion' && (
            <StepCompletion
              draftData={draftData}
              onFinish={async () => {
                await onboardingService.finalizeOnboarding(draftData);
                await useAppStore.getState().refreshFromDatabase();
                onComplete();
              }}
              onBack={() => setCurrentStep('notifications')}
            />
          )}
        </View>
      </SafeAreaView>
    </DarkThemeScope>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#05070B',
  },
  stepContent: {
    flex: 1,
  },
});
