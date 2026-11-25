/**
 * KaryaDEX — Root Layout
 *
 * App entry point with theme provider and navigation stack.
 */

import { useFonts } from 'expo-font';
import { router, Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { useState, useEffect } from 'react';
import { StatusBar } from 'expo-status-bar';
import { View, Text, Button, StyleSheet, ActivityIndicator } from 'react-native';
import 'react-native-reanimated';

import { ThemeProvider, useTheme } from '@/constants/ThemeContext';
import { useAppStore } from '@/store/useAppStore';
import { DatabaseProvider, useDatabaseReady, useDatabaseError } from '@/database';
import { onboardingService } from '@/services/onboardingService';
import { AuthService } from '@/services/auth/authService';
import { notificationService } from '@/services/notificationService';
import { OnboardingFlow } from '@/components/onboarding/OnboardingFlow';
import { PrivacyShieldOverlay } from '@/components/security/PrivacyShieldOverlay';
import { isSafeInternalRoute } from '@/services/security/deepLinkSecurity';
import { initSentry } from '@/services/monitoring/sentryService';
import { ErrorBoundary } from '@/components/ErrorBoundary';
import { SentryUserContextProvider } from '@/components/SentryUserContextProvider';
import { initPlaygroundAuthObserver } from '@/lib/playground/identity/playgroundAuthObserver';
import type { StartupState, OnboardingStep } from '@/types/onboarding';
import type { NotificationPayload } from '@/types/academic';

export const unstable_settings = {
  initialRouteName: '(tabs)',
};

// Initialize Sentry as early as possible (before any UI renders)
initSentry();

SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { colors, isDark } = useTheme();
  const { isAuthenticated, requestedOnboardingStep, requestOnboardingStep } = useAppStore();
  const isDbReady = useDatabaseReady();
  const dbError = useDatabaseError();
  const [startupState, setStartupState] = useState<StartupState | null>(null);
  const [isOnboardingActive, setIsOnboardingActive] = useState<boolean>(false);
  const [onboardingInitialStep, setOnboardingInitialStep] = useState<OnboardingStep>('welcome');

  useEffect(() => {
    // Safety fallback: Ensure startupState is populated within 3s so the UI never hangs
    const timeout = setTimeout(() => {
      setStartupState((prev) => prev || { status: 'completed', canResume: false, isDemo: true, lastStep: 'welcome' });
    }, 3000);
    return () => clearTimeout(timeout);
  }, []);

  useEffect(() => {
    if (requestedOnboardingStep) {
      setOnboardingInitialStep(requestedOnboardingStep);
      setIsOnboardingActive(true);
    }
  }, [requestedOnboardingStep]);

  useEffect(() => {
    if (isDbReady) {
      // 0. Initialize Playground player identity & auth observer
      initPlaygroundAuthObserver().catch(err => {
        console.warn('[Playground] Failed to initialize auth observer:', err);
      });

      // 1. Initialize local notification engine (channels & foreground listeners)
      notificationService.init().catch(err => {
        console.warn('[Notification] Failed to initialize notification channels:', err);
      });

      // 2. Wire deep linking navigation when user taps an OS notification
      notificationService.setNavigationHandler((payload: NotificationPayload) => {
        try {
          if (payload.deepLinkTarget && isSafeInternalRoute(payload.deepLinkTarget)) {
            router.push(payload.deepLinkTarget as any);
          } else if (payload.subjectId && /^[a-zA-Z0-9_-]+$/.test(payload.subjectId)) {
            router.push(`/subject/${payload.subjectId}` as any);
          } else if (payload.type === 'class_reminder' || payload.type === 'post_class_journal') {
            router.push('/(tabs)/schedule' as any);
          } else if (payload.type === 'task_reminder') {
            router.push('/(tabs)/tasks' as any);
          } else if (payload.type === 'attendance_alert') {
            router.push('/(tabs)/attendance' as any);
          } else if (payload.type === 'exam_reminder' || payload.type === 'revision_reminder') {
            router.push('/(tabs)/college' as any);
          } else {
            router.push('/(tabs)' as any);
          }
        } catch (navErr) {
          console.warn('[Notification] Navigation error on response:', navErr);
        }
      });

      // 3. Query authentication & startup state
      const auth = AuthService.getInstance();
      auth.init().then(async (user) => {
        try {
          const state = await onboardingService.getStartupState();
          setStartupState(state);

          if (user) {
            // Returning or authenticated student
            if (state.status === 'completed' || state.isDemo) {
              setIsOnboardingActive(false);
            } else {
              // Student completed sign in! Never return to welcome. Jump past auth to profile (or further saved step)
              setIsOnboardingActive(true);
              const resumeStep =
                state.lastStep &&
                state.lastStep !== 'welcome' &&
                state.lastStep !== 'showcase_attendance' &&
                state.lastStep !== 'showcase_ai' &&
                state.lastStep !== 'auth'
                  ? state.lastStep
                  : 'profile';
              setOnboardingInitialStep(resumeStep);
            }
          } else {
            // Unauthenticated user
            if (state.status !== 'completed' && !state.isDemo) {
              setIsOnboardingActive(true);
              setOnboardingInitialStep(state.lastStep || 'welcome');
            } else if (requestedOnboardingStep) {
              setIsOnboardingActive(true);
              setOnboardingInitialStep(requestedOnboardingStep);
            } else {
              setIsOnboardingActive(false);
            }
          }
        } catch (startupErr) {
          console.warn('[RootNavigator] Startup state error:', startupErr);
          setStartupState({ status: 'completed', canResume: false, isDemo: false, lastStep: 'welcome' });
        }
      }).catch(authErr => {
        console.warn('[RootNavigator] Auth init error:', authErr);
        setStartupState({ status: 'completed', canResume: false, isDemo: false, lastStep: 'welcome' });
      });
    }
  }, [isDbReady, isAuthenticated, requestedOnboardingStep]);

  if (!isDbReady || !startupState) {
    return (
      <View style={{ flex: 1, backgroundColor: '#05070B', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#00E5FF" />
      </View>
    );
  }

  if (isOnboardingActive) {
    return (
      <>
        <StatusBar style="light" />
        <OnboardingFlow
          initialStep={onboardingInitialStep}
          canResume={startupState.canResume}
          onComplete={() => {
            requestOnboardingStep(null);
            setIsOnboardingActive(false);
          }}
          onDemoMode={() => {
            requestOnboardingStep(null);
            setIsOnboardingActive(false);
          }}
        />
      </>
    );
  }

  return (
    <>
      <StatusBar style="light" />
      <Stack
        screenOptions={{
          headerShown: false,
          contentStyle: { backgroundColor: '#05070B' },
          animation: 'slide_from_right',
        }}
      >
        <Stack.Screen name="(tabs)" />
        <Stack.Screen 
          name="subject/[id]" 
          options={{ 
            presentation: 'card',
            headerShown: false,
          }} 
        />
      </Stack>
    </>
  );
}

// Error fallback component for ErrorBoundary
function ErrorFallback({ error, reset }: { error?: Error; reset?: () => void }) {
  return (
    <View style={fallbackStyles.container} accessibilityLiveRegion="assertive">
      <View style={fallbackStyles.errorBox}>
        <Text style={fallbackStyles.title}>Something went wrong</Text>
        <Text style={fallbackStyles.message}>
          {error?.message || 'An unexpected error occurred'}
        </Text>
        <View style={fallbackStyles.buttonRow}>
          <Button
            title="Try Again"
            onPress={reset || (() => {})}
            color="#6366f1"
            accessibilityLabel="Reset the app and try again"
          />
        </View>
        <Text style={fallbackStyles.hint}>
          The error has been automatically reported. Restart the app to continue.
        </Text>
      </View>
    </View>
  );
}

const fallbackStyles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: 20,
    backgroundColor: '#05070B',
  },
  errorBox: {
    width: '100%',
    maxWidth: 400,
    padding: 24,
    backgroundColor: '#0B0C11',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#ef4444',
    shadowColor: '#ef4444',
    shadowOffset: { width: 0, height: 8 },
    shadowOpacity: 0.3,
    shadowRadius: 16,
    elevation: 8,
  },
  title: {
    fontSize: 22,
    fontWeight: '700',
    color: '#ef4444',
    marginBottom: 12,
    textAlign: 'center',
  },
  message: {
    fontSize: 14,
    color: '#fca5a5',
    fontFamily: 'monospace',
    marginBottom: 20,
    textAlign: 'center',
  },
  buttonRow: {
    flexDirection: 'row',
    gap: 12,
    justifyContent: 'center',
    marginBottom: 16,
  },
  hint: {
    fontSize: 12,
    color: '#6b7280',
    textAlign: 'center',
  },
});

export default function RootLayout() {
  const [fontFallback, setFontFallback] = useState(false);
  const [loaded, error] = useFonts({
    SpaceMono: require('../assets/fonts/SpaceMono-Regular.ttf'),
    Isometra: require('../assets/fonts/Isometra-Regular.ttf'),
    Honk: require('../assets/fonts/Honk-Regular.ttf'),
    Montserrat: require('../assets/fonts/Montserrat.ttf'),
    Oswald: require('../assets/fonts/Oswald.ttf'),
    'Oswald-Regular': require('../assets/fonts/Oswald.ttf'),
    'Oswald-Medium': require('../assets/fonts/Oswald.ttf'),
    'Oswald-Bold': require('../assets/fonts/Oswald.ttf'),
  });

  useEffect(() => {
    // Safety fallback: Ensure font loading never hangs the app on web/browsers with font blocks
    const timer = setTimeout(() => {
      setFontFallback(true);
    }, 2500);
    return () => clearTimeout(timer);
  }, []);

  useEffect(() => {
    if (error) {
      console.warn('[RootLayout] Font loading warning, continuing with fallbacks:', error);
    }
  }, [error]);

  useEffect(() => {
    if (loaded || error || fontFallback) {
      SplashScreen.hideAsync().catch(() => {});
    }
  }, [loaded, error, fontFallback]);

  if (!loaded && !error && !fontFallback) {
    return (
      <View style={{ flex: 1, backgroundColor: '#05070B', justifyContent: 'center', alignItems: 'center' }}>
        <ActivityIndicator size="large" color="#00E5FF" />
      </View>
    );
  }

  return (
    <DatabaseProvider>
      <ThemeProvider>
        <SentryUserContextProvider>
          <PrivacyShieldOverlay>
            <ErrorBoundary
              fallback={<ErrorFallback />}
              onError={(error) => {
                // Error already captured in ErrorBoundary component
                console.error('[RootLayout] Error boundary caught:', error);
              }}
            >
              <RootNavigator />
            </ErrorBoundary>
          </PrivacyShieldOverlay>
        </SentryUserContextProvider>
      </ThemeProvider>
    </DatabaseProvider>
  );
}
