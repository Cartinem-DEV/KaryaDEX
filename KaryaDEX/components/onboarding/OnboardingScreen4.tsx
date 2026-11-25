/**
 * KaryaDEX — Onboarding Screen 04: Authentication Gate
 *
 * Implements the 4th screen of the Onboarding flow:
 * - Pure 3D Liquid Glass & deep obsidian (#080B11) atmosphere.
 * - Google Sign-In with official SVG Google "G" vector.
 * - Email Authentication Card with animated Sign In / Create Account segmented toggle.
 * - Glassmorphic input fields with Feather leading icons and password visibility toggle.
 * - Inline error / success alerts and loading state management.
 * - 4-dot pagination indicator (• • • ▬) monitoring Screen 4.
 * - Top frosted glass navigation bar with back and skip controls.
 */

import React, { useState, useCallback, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Pressable,
  TextInput,
  ScrollView,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Keyboard,
  Platform,
  ActivityIndicator,
  useWindowDimensions,
} from 'react-native';
import { BlurView } from 'expo-blur';
import { Feather } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import Svg, { Path } from 'react-native-svg';
import * as Haptics from 'expo-haptics';
import Animated, {
  useSharedValue,
  useAnimatedStyle,
  withTiming,
  withSpring,
  Easing,
  FadeIn,
  FadeInDown,
  FadeInUp,
} from 'react-native-reanimated';
import { OnboardingPaginationDots } from './OnboardingPaginationDots';
import { authService } from '@/services/auth/authService';
import type { AuthUser } from '@/services/auth/authTypes';
import {
  generateNoncePair,
  getGoogleWebClientId,
  isGoogleIdentityLoaded,
  loadGoogleIdentityScript,
  initializeGoogleIdentity,
  renderGoogleButton,
  promptGoogleOneTap,
} from '@/services/auth/googleAuthHelper';

const FONTS = {
  display: 'Montserrat',
  condensed: 'Oswald',
  mono: 'SpaceMono',
};

/**
 * Official Google "G" 4-color vector SVG icon
 */
function GoogleIcon({ size = 20 }: { size?: number }) {
  return (
    <Svg width={size} height={size} viewBox="0 0 24 24">
      <Path
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
        fill="#4285F4"
      />
      <Path
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
        fill="#34A853"
      />
      <Path
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.06H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.94l2.85-2.22.81-.63z"
        fill="#FBBC05"
      />
      <Path
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.06l3.66 2.84c.87-2.6 3.3-4.52 6.16-4.52z"
        fill="#EA4335"
      />
    </Svg>
  );
}

type AuthMode = 'signin' | 'signup' | 'forgot';

export interface OnboardingScreen4Props {
  onNext: (user?: AuthUser) => void;
  onBack: () => void;
  onSkip: () => void;
}

export function OnboardingScreen4({ onNext, onBack, onSkip }: OnboardingScreen4Props) {
  const { width } = useWindowDimensions();
  const [mode, setMode] = useState<AuthMode>('signin');
  const [name, setName] = useState('');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);

  const [focusedInput, setFocusedInput] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [googleLoading, setGoogleLoading] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [successMessage, setSuccessMessage] = useState<string | null>(null);

  // Segment Tab Indicator Animation (0 = Sign In, 1 = Create Account)
  const tabSlideAnim = useSharedValue(0);

  const handleModeChange = useCallback(
    (newMode: AuthMode) => {
      try {
        if (Platform.OS !== 'web') {
          Haptics.selectionAsync();
        }
      } catch {}
      setErrorMessage(null);
      setSuccessMessage(null);
      setMode(newMode);
      if (newMode === 'signin') {
        tabSlideAnim.value = withTiming(0, {
          duration: 240,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        });
      } else if (newMode === 'signup') {
        tabSlideAnim.value = withTiming(1, {
          duration: 240,
          easing: Easing.bezier(0.25, 0.1, 0.25, 1),
        });
      }
    },
    [tabSlideAnim]
  );

  const tabIndicatorStyle = useAnimatedStyle(() => {
    // Each tab takes ~50% of the available segmented bar width
    const containerInnerWidth = width - 32 - 32 - 8; // Screen padding 32 + Card padding 32 + Segment bar padding 8
    const tabWidth = containerInnerWidth / 2;
    return {
      width: tabWidth,
      transform: [
        {
          translateX: tabSlideAnim.value * tabWidth,
        },
      ],
    };
  });

  const activeNonceRef = useRef<string | null>(null);

  // Setup Google Identity Services on Web
  const setupGoogleIdentityServices = useCallback(async () => {
    if (Platform.OS !== 'web') return;

    try {
      const loaded = await loadGoogleIdentityScript();
      if (!loaded) return;

      const clientId = getGoogleWebClientId();
      if (!clientId) {
        console.warn(
          '[GoogleAuth] EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not configured in .env. Please configure your Google Web Client ID.'
        );
        return;
      }

      // Generate fresh cryptographic nonce pair
      const { rawNonce, hashedNonce } = await generateNoncePair();
      activeNonceRef.current = rawNonce;

      const initialized = initializeGoogleIdentity({
        clientId,
        hashedNonce,
        callback: async (response) => {
          if (!response?.credential) return;
          try {
            setGoogleLoading(true);
            setErrorMessage(null);
            const currentNonce = activeNonceRef.current || undefined;
            const res = await authService.signInWithGoogle(response.credential, currentNonce);
            if (res.success) {
              if (Platform.OS !== 'web') {
                Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
              }
              const currentUser = authService.getCurrentUser() || undefined;
              onNext(currentUser);
            } else if (res.error) {
              setErrorMessage(res.error.message || 'Google sign-in could not be completed.');
              // Reset nonce and re-arm GIS
              setupGoogleIdentityServices();
            }
          } catch (err: any) {
            setErrorMessage(err.message || 'An error occurred during Google sign in.');
            setupGoogleIdentityServices();
          } finally {
            setGoogleLoading(false);
          }
        },
      });
    } catch (err) {
      console.warn('[GoogleAuth] Error initializing Google Identity Services:', err);
    }
  }, [onNext]);

  useEffect(() => {
    setupGoogleIdentityServices();
  }, [setupGoogleIdentityServices]);

  // ─── Google OAuth / ID Token Handler ───────────────────────
  const handleGoogleSignIn = async () => {
    try {
      if (Platform.OS !== 'web') {
        Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
      }
    } catch {}
    setErrorMessage(null);
    setSuccessMessage(null);
    setGoogleLoading(true);

    try {
      const clientId = getGoogleWebClientId();
      if (Platform.OS === 'web') {
        if (!clientId) {
          console.warn(
            '[GoogleAuth] EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID is not configured in .env. Please configure your Google Web Client ID.'
          );
          setErrorMessage('Google Client ID is not configured. Please set EXPO_PUBLIC_GOOGLE_WEB_CLIENT_ID in .env.');
          setGoogleLoading(false);
          return;
        }
      }

      const res = await authService.signInWithGoogle();
      if (res.success) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        const currentUser = authService.getCurrentUser() || undefined;
        onNext(currentUser);
      } else if (res.error) {
        setErrorMessage(res.error.message || 'Google sign-in could not be completed.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred during Google sign in.');
    } finally {
      setGoogleLoading(false);
    }
  };

  // ─── Email Submit Handler ──────────────────────────────────
  const handleSubmit = async () => {
    Keyboard.dismiss();
    setErrorMessage(null);
    setSuccessMessage(null);

    const trimmedEmail = email.trim();
    if (!trimmedEmail) {
      setErrorMessage('Please enter your academic or personal email address.');
      return;
    }

    // Forgot Password Flow
    if (mode === 'forgot') {
      setLoading(true);
      try {
        const res = await authService.resetPassword(trimmedEmail);
        if (res.success) {
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          setSuccessMessage(res.message || 'Password reset link sent to your email.');
        } else {
          setErrorMessage(res.message || 'Failed to send password reset link.');
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'An unexpected error occurred.');
      } finally {
        setLoading(false);
      }
      return;
    }

    if (!password) {
      setErrorMessage('Please enter your password.');
      return;
    }

    // Sign Up Flow
    if (mode === 'signup') {
      const trimmedName = name.trim();
      if (!trimmedName) {
        setErrorMessage('Please enter your full name.');
        return;
      }
      if (password.length < 6) {
        setErrorMessage('Password must be at least 6 characters long.');
        return;
      }
      if (password !== confirmPassword) {
        setErrorMessage('Passwords do not match.');
        return;
      }

      setLoading(true);
      try {
        const res = await authService.signUp({
          name: trimmedName,
          email: trimmedEmail,
          password,
        });
        if (res.success) {
          if (Platform.OS !== 'web') {
            Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
          }
          const currentUser = authService.getCurrentUser() || undefined;
          onNext(currentUser);
        } else {
          setErrorMessage(res.error?.message || 'Failed to create account.');
        }
      } catch (err: any) {
        setErrorMessage(err.message || 'An unexpected error occurred.');
      } finally {
        setLoading(false);
      }
      return;
    }

    // Sign In Flow
    setLoading(true);
    try {
      const res = await authService.signIn({
        email: trimmedEmail,
        password,
      });
      if (res.success) {
        if (Platform.OS !== 'web') {
          Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        }
        const currentUser = authService.getCurrentUser() || undefined;
        onNext(currentUser);
      } else {
        setErrorMessage(res.error?.message || 'Invalid email or password. Please try again.');
      }
    } catch (err: any) {
      setErrorMessage(err.message || 'An unexpected error occurred.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={styles.container}>
      {/* ─── Ambient Glow Blooms ─────────────────────────────────── */}
      <View style={styles.ambientContainer} pointerEvents="none">
        <View style={styles.ambientLeftAmberBloom} />
        <View style={styles.ambientRightCyanBloom} />
      </View>

      {/* ─── Top Navigation Bar ───────────────────────────────────── */}
      <View style={styles.headerBar}>
        <Pressable
          onPress={onBack}
          accessibilityRole="button"
          accessibilityLabel="Go back to screen 3"
          style={({ pressed }) => [
            styles.backButton,
            pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
          ]}
        >
          <BlurView intensity={40} tint="dark" style={styles.backButtonBlur}>
            <Feather name="chevron-left" size={18} color="#FFFFFF" />
          </BlurView>
        </Pressable>

        <Pressable
          onPress={onSkip}
          accessibilityRole="button"
          accessibilityLabel="Skip account setup"
          style={({ pressed }) => [
            styles.skipPill,
            pressed && { opacity: 0.7, transform: [{ scale: 0.95 }] },
          ]}
        >
          <BlurView intensity={40} tint="dark" style={styles.skipPillBlur}>
            <Text style={styles.skipText}>Skip</Text>
          </BlurView>
        </Pressable>
      </View>

      {/* ─── Main Scroll Body ────────────────────────────────────── */}
      <KeyboardAvoidingView
        style={styles.keyboardContainer}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
          <ScrollView
            style={styles.scrollView}
            contentContainerStyle={styles.scrollContent}
            showsVerticalScrollIndicator={false}
            keyboardShouldPersistTaps="handled"
          >
            {/* ─── Header Section ───────────────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(100).duration(500)} style={styles.titleSection}>
              <Text style={styles.headline}>Lock In Your Semester.</Text>
              <Text style={styles.subtitle}>
                Sign in or create an account to keep your routine, syllabus, and attendance organized.
              </Text>
            </Animated.View>

            {/* ─── Google OAuth Fast Action ─────────────────────────── */}
            <Animated.View entering={FadeInDown.delay(180).duration(500)} style={styles.googleSection}>
              <Pressable
                onPress={handleGoogleSignIn}
                disabled={googleLoading || loading}
                style={({ pressed }) => [
                  styles.googleButtonWrapper,
                  pressed && { opacity: 0.85, transform: [{ scale: 0.98 }] },
                ]}
                accessibilityRole="button"
                accessibilityLabel="Continue with Google"
              >
                <BlurView intensity={45} tint="dark" style={styles.googleButtonBlur}>
                  {googleLoading ? (
                    <ActivityIndicator size="small" color="#FFFFFF" />
                  ) : (
                    <View style={styles.googleButtonInner}>
                      <GoogleIcon size={19} />
                      <Text style={styles.googleButtonText}>Continue with Google</Text>
                    </View>
                  )}
                </BlurView>
              </Pressable>
            </Animated.View>

            {/* ─── Hairline Divider ─────────────────────────────────── */}
            <Animated.View entering={FadeIn.delay(240).duration(400)} style={styles.dividerRow}>
              <View style={styles.dividerLine} />
              <Text style={styles.dividerText}>or continue with email</Text>
              <View style={styles.dividerLine} />
            </Animated.View>

            {/* ─── Separate Email Login / Registration Card ─────────── */}
            <Animated.View entering={FadeInUp.delay(300).duration(600)} style={styles.emailCardContainer}>
              {/* Card Specular Top Rim */}
              <View style={styles.cardSpecularRim} />

              {/* Segmented Glass Toggle */}
              {mode !== 'forgot' ? (
                <View style={styles.segmentedToggleContainer}>
                  {/* Sliding Animated Indicator */}
                  <Animated.View style={[styles.segmentedIndicatorPill, tabIndicatorStyle]} />

                  <Pressable
                    onPress={() => handleModeChange('signin')}
                    style={styles.segmentedTab}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: mode === 'signin' }}
                  >
                    <Text
                      style={[
                        styles.segmentedTabText,
                        mode === 'signin' && styles.segmentedTabTextActive,
                      ]}
                    >
                      Sign In
                    </Text>
                  </Pressable>

                  <Pressable
                    onPress={() => handleModeChange('signup')}
                    style={styles.segmentedTab}
                    accessibilityRole="tab"
                    accessibilityState={{ selected: mode === 'signup' }}
                  >
                    <Text
                      style={[
                        styles.segmentedTabText,
                        mode === 'signup' && styles.segmentedTabTextActive,
                      ]}
                    >
                      Create Account
                    </Text>
                  </Pressable>
                </View>
              ) : (
                <View style={styles.forgotHeaderRow}>
                  <Pressable
                    onPress={() => handleModeChange('signin')}
                    style={styles.forgotBackButton}
                    hitSlop={8}
                  >
                    <Feather name="arrow-left" size={14} color="#00E5FF" />
                    <Text style={styles.forgotBackText}>Back to Sign In</Text>
                  </Pressable>
                  <Text style={styles.forgotHeaderTitle}>Reset Password</Text>
                </View>
              )}

              {/* Inline Error Banner */}
              {errorMessage && (
                <Animated.View entering={FadeIn.duration(200)} style={styles.errorBanner}>
                  <Feather name="alert-circle" size={15} color="#EF4444" />
                  <Text style={styles.errorBannerText}>{errorMessage}</Text>
                </Animated.View>
              )}

              {/* Inline Success Banner */}
              {successMessage && (
                <Animated.View entering={FadeIn.duration(200)} style={styles.successBanner}>
                  <Feather name="check-circle" size={15} color="#10B981" />
                  <Text style={styles.successBannerText}>{successMessage}</Text>
                </Animated.View>
              )}

              {/* Form Input Fields */}
              <View style={styles.formContainer}>
                {/* Full Name Input (Registration only) */}
                {mode === 'signup' && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>FULL NAME</Text>
                    <View
                      style={[
                        styles.inputGlassPill,
                        focusedInput === 'name' && styles.inputGlassPillFocused,
                      ]}
                    >
                      <Feather
                        name="user"
                        size={16}
                        color={focusedInput === 'name' ? '#00E5FF' : '#94A3B8'}
                        style={styles.inputLeadingIcon}
                      />
                      <TextInput
                        style={styles.textInput}
                        placeholder="e.g. Rahul Sharma"
                        placeholderTextColor="#64748B"
                        value={name}
                        onChangeText={setName}
                        onFocus={() => setFocusedInput('name')}
                        onBlur={() => setFocusedInput(null)}
                        autoCapitalize="words"
                        returnKeyType="next"
                      />
                    </View>
                  </View>
                )}

                {/* Email Address Input */}
                <View style={styles.inputGroup}>
                  <Text style={styles.inputLabel}>EMAIL ADDRESS</Text>
                  <View
                    style={[
                      styles.inputGlassPill,
                      focusedInput === 'email' && styles.inputGlassPillFocused,
                    ]}
                  >
                    <Feather
                      name="mail"
                      size={16}
                      color={focusedInput === 'email' ? '#00E5FF' : '#94A3B8'}
                      style={styles.inputLeadingIcon}
                    />
                    <TextInput
                      style={styles.textInput}
                      placeholder="student@college.edu"
                      placeholderTextColor="#64748B"
                      value={email}
                      onChangeText={setEmail}
                      onFocus={() => setFocusedInput('email')}
                      onBlur={() => setFocusedInput(null)}
                      autoCapitalize="none"
                      keyboardType="email-address"
                      returnKeyType="next"
                    />
                  </View>
                </View>

                {/* Password Input (Hidden in Forgot mode) */}
                {mode !== 'forgot' && (
                  <View style={styles.inputGroup}>
                    <View style={styles.passwordLabelRow}>
                      <Text style={styles.inputLabel}>PASSWORD</Text>
                      {mode === 'signin' && (
                        <Pressable
                          onPress={() => {
                            setErrorMessage(null);
                            setSuccessMessage(null);
                            setMode('forgot');
                          }}
                          hitSlop={6}
                        >
                          <Text style={styles.forgotLinkText}>Forgot?</Text>
                        </Pressable>
                      )}
                    </View>
                    <View
                      style={[
                        styles.inputGlassPill,
                        focusedInput === 'password' && styles.inputGlassPillFocused,
                      ]}
                    >
                      <Feather
                        name="lock"
                        size={16}
                        color={focusedInput === 'password' ? '#00E5FF' : '#94A3B8'}
                        style={styles.inputLeadingIcon}
                      />
                      <TextInput
                        style={styles.textInput}
                        placeholder="••••••••"
                        placeholderTextColor="#64748B"
                        value={password}
                        onChangeText={setPassword}
                        onFocus={() => setFocusedInput('password')}
                        onBlur={() => setFocusedInput(null)}
                        secureTextEntry={!showPassword}
                        autoCapitalize="none"
                        returnKeyType={mode === 'signup' ? 'next' : 'done'}
                        onSubmitEditing={mode === 'signin' ? handleSubmit : undefined}
                      />
                      <Pressable
                        onPress={() => setShowPassword(!showPassword)}
                        style={styles.passwordToggle}
                        hitSlop={8}
                      >
                        <Feather
                          name={showPassword ? 'eye-off' : 'eye'}
                          size={16}
                          color="#94A3B8"
                        />
                      </Pressable>
                    </View>
                  </View>
                )}

                {/* Confirm Password Input (Registration only) */}
                {mode === 'signup' && (
                  <View style={styles.inputGroup}>
                    <Text style={styles.inputLabel}>CONFIRM PASSWORD</Text>
                    <View
                      style={[
                        styles.inputGlassPill,
                        focusedInput === 'confirm' && styles.inputGlassPillFocused,
                      ]}
                    >
                      <Feather
                        name="check-circle"
                        size={16}
                        color={focusedInput === 'confirm' ? '#00E5FF' : '#94A3B8'}
                        style={styles.inputLeadingIcon}
                      />
                      <TextInput
                        style={styles.textInput}
                        placeholder="••••••••"
                        placeholderTextColor="#64748B"
                        value={confirmPassword}
                        onChangeText={setConfirmPassword}
                        onFocus={() => setFocusedInput('confirm')}
                        onBlur={() => setFocusedInput(null)}
                        secureTextEntry={!showConfirmPassword}
                        autoCapitalize="none"
                        returnKeyType="done"
                        onSubmitEditing={handleSubmit}
                      />
                      <Pressable
                        onPress={() => setShowConfirmPassword(!showConfirmPassword)}
                        style={styles.passwordToggle}
                        hitSlop={8}
                      >
                        <Feather
                          name={showConfirmPassword ? 'eye-off' : 'eye'}
                          size={16}
                          color="#94A3B8"
                        />
                      </Pressable>
                    </View>
                  </View>
                )}

                {/* Primary Submit Button */}
                <Pressable
                  onPress={handleSubmit}
                  disabled={loading || googleLoading}
                  style={({ pressed }) => [
                    styles.submitPillWrapper,
                    pressed && styles.submitPillPressed,
                  ]}
                  accessibilityRole="button"
                  accessibilityLabel={
                    mode === 'signin'
                      ? 'Sign In'
                      : mode === 'signup'
                      ? 'Create Account'
                      : 'Send Reset Link'
                  }
                >
                  {/* Subtle rim glows */}
                  <View style={styles.submitOuterCyanGlow} pointerEvents="none" />
                  <LinearGradient
                    colors={[
                      '#00E5FF',
                      'rgba(0, 229, 255, 0.90)',
                      'rgba(255, 255, 255, 0.40)',
                      'rgba(6, 182, 212, 0.90)',
                      '#06B6D4',
                    ]}
                    start={{ x: 0, y: 0.5 }}
                    end={{ x: 1, y: 0.5 }}
                    style={styles.submitGradientBorder}
                  >
                    <BlurView intensity={35} tint="dark" style={styles.submitButtonBlur}>
                      {loading ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <View style={styles.submitButtonContent}>
                          <Text style={styles.submitButtonText}>
                            {mode === 'signin' && 'Sign In →'}
                            {mode === 'signup' && 'Create Account →'}
                            {mode === 'forgot' && 'Send Reset Link →'}
                          </Text>
                        </View>
                      )}
                    </BlurView>
                  </LinearGradient>
                </Pressable>
              </View>
            </Animated.View>
          </ScrollView>
        </TouchableWithoutFeedback>
      </KeyboardAvoidingView>

      {/* ─── Pagination Dots (Monitoring Screen 4: • • • ▬) ─────── */}
      <Animated.View entering={FadeInDown.delay(450).duration(600)} style={styles.bottomSection}>
        <OnboardingPaginationDots
          activeIndex={3}
          totalDots={4}
          onPressDot={(index) => {
            if (index === 0 || index === 1 || index === 2) {
              onBack();
            }
          }}
        />
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#080B11',
    position: 'relative',
  },
  keyboardContainer: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
    paddingTop: 8,
    paddingBottom: 24,
  },

  /* Ambient Blooms */
  ambientContainer: {
    ...StyleSheet.absoluteFill,
    overflow: 'hidden',
  },
  ambientLeftAmberBloom: {
    position: 'absolute',
    top: '15%',
    left: '-20%',
    width: 260,
    height: 260,
    borderRadius: 130,
    backgroundColor: 'rgba(245, 158, 11, 0.12)',
    ...(Platform.OS !== 'web'
      ? {
          shadowColor: '#F59E0B',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.5,
          shadowRadius: 100,
        }
      : ({
          filter: 'blur(75px)',
        } as any)),
  },
  ambientRightCyanBloom: {
    position: 'absolute',
    top: '35%',
    right: '-25%',
    width: 300,
    height: 300,
    borderRadius: 150,
    backgroundColor: 'rgba(6, 182, 212, 0.14)',
    ...(Platform.OS !== 'web'
      ? {
          shadowColor: '#06B6D4',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.5,
          shadowRadius: 100,
        }
      : ({
          filter: 'blur(85px)',
        } as any)),
  },

  /* Top Navigation Bar */
  headerBar: {
    height: 52,
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    zIndex: 20,
  },
  backButton: {
    width: 38,
    height: 38,
    borderRadius: 19,
    overflow: 'hidden',
  },
  backButtonBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.20)',
    borderRadius: 19,
  },
  skipPill: {
    height: 32,
    borderRadius: 99,
    overflow: 'hidden',
  },
  skipPillBlur: {
    flex: 1,
    paddingHorizontal: 16,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.06)',
    borderWidth: 0.5,
    borderColor: 'rgba(255, 255, 255, 0.15)',
    borderRadius: 99,
  },
  skipText: {
    fontFamily: FONTS.display,
    fontSize: 12.5,
    color: 'rgba(255, 255, 255, 0.75)',
    fontWeight: '600',
    letterSpacing: 0.3,
  },

  /* Header Section */
  titleSection: {
    alignItems: 'center',
    marginVertical: 10,
    paddingHorizontal: 8,
  },
  headline: {
    fontFamily: FONTS.display,
    fontSize: 25,
    fontWeight: '800',
    color: '#FFFFFF',
    textAlign: 'center',
    letterSpacing: -0.4,
    lineHeight: 31,
    marginBottom: 6,
  },
  subtitle: {
    fontFamily: FONTS.display,
    fontSize: 13,
    color: '#94A3B8',
    textAlign: 'center',
    lineHeight: 18,
    maxWidth: 340,
    letterSpacing: 0.1,
  },

  /* Google Authentication Button */
  googleSection: {
    marginTop: 8,
    marginBottom: 12,
  },
  googleButtonWrapper: {
    height: 50,
    borderRadius: 16,
    overflow: 'hidden',
  },
  googleButtonBlur: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    backgroundColor: 'rgba(255, 255, 255, 0.05)',
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.22)',
    borderRadius: 16,
  },
  googleButtonInner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 11,
  },
  googleButtonText: {
    fontFamily: FONTS.display,
    fontSize: 14.5,
    fontWeight: '700',
    color: '#FFFFFF',
    letterSpacing: 0.2,
  },
  googleGsiOverlay: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    width: '100%',
    height: '100%',
    opacity: 0.0001,
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 10,
    ...(Platform.OS === 'web' ? ({ cursor: 'pointer' } as any) : {}),
  },

  /* Hairline Divider */
  dividerRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
    marginVertical: 10,
  },
  dividerLine: {
    flex: 1,
    height: 1,
    backgroundColor: 'rgba(255, 255, 255, 0.10)',
  },
  dividerText: {
    fontFamily: FONTS.display,
    fontSize: 11.5,
    color: '#64748B',
    fontWeight: '500',
    letterSpacing: 0.2,
  },

  /* Email Card Container */
  emailCardContainer: {
    borderRadius: 24,
    backgroundColor: 'rgba(16, 20, 32, 0.78)',
    borderWidth: 1,
    borderColor: 'rgba(6, 182, 212, 0.35)',
    padding: 16,
    position: 'relative',
    overflow: 'hidden',
    marginBottom: 12,
    ...(Platform.OS !== 'web'
      ? {
          shadowColor: '#00E5FF',
          shadowOffset: { width: 0, height: 4 },
          shadowOpacity: 0.15,
          shadowRadius: 18,
          elevation: 6,
        }
      : ({
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.45)',
        } as any)),
  },
  cardSpecularRim: {
    position: 'absolute',
    top: 0,
    left: 0,
    right: 0,
    height: 1,
    backgroundColor: 'rgba(6, 182, 212, 0.45)',
  },

  /* Segmented Glass Toggle */
  segmentedToggleContainer: {
    flexDirection: 'row',
    height: 42,
    borderRadius: 12,
    backgroundColor: 'rgba(0, 0, 0, 0.40)',
    borderWidth: 1,
    borderColor: 'rgba(255, 255, 255, 0.08)',
    position: 'relative',
    marginBottom: 14,
    padding: 3,
  },
  segmentedIndicatorPill: {
    position: 'absolute',
    top: 3,
    bottom: 3,
    left: 3,
    borderRadius: 9,
    backgroundColor: 'rgba(6, 182, 212, 0.25)',
    borderWidth: 1,
    borderColor: '#06B6D4',
  },
  segmentedTab: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    zIndex: 2,
  },
  segmentedTabText: {
    fontFamily: FONTS.display,
    fontSize: 13,
    fontWeight: '600',
    color: '#94A3B8',
    letterSpacing: 0.3,
  },
  segmentedTabTextActive: {
    color: '#FFFFFF',
    fontWeight: '700',
  },

  /* Forgot Header Row */
  forgotHeaderRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 14,
    paddingHorizontal: 4,
  },
  forgotBackButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
  },
  forgotBackText: {
    fontFamily: FONTS.display,
    fontSize: 12.5,
    color: '#00E5FF',
    fontWeight: '600',
  },
  forgotHeaderTitle: {
    fontFamily: FONTS.display,
    fontSize: 14,
    fontWeight: '700',
    color: '#FFFFFF',
  },

  /* Error / Success Banners */
  errorBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: 'rgba(239, 68, 68, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(239, 68, 68, 0.35)',
    marginBottom: 12,
  },
  errorBannerText: {
    fontFamily: FONTS.display,
    flex: 1,
    fontSize: 12,
    color: '#FCA5A5',
    lineHeight: 16,
    fontWeight: '500',
  },
  successBanner: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 9,
    borderRadius: 12,
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.35)',
    marginBottom: 12,
  },
  successBannerText: {
    fontFamily: FONTS.display,
    flex: 1,
    fontSize: 12,
    color: '#6EE7B7',
    lineHeight: 16,
    fontWeight: '500',
  },

  /* Form Fields */
  formContainer: {
    gap: 11,
  },
  inputGroup: {
    gap: 4,
  },
  inputLabel: {
    fontFamily: FONTS.mono,
    fontSize: 9.5,
    fontWeight: '700',
    color: '#94A3B8',
    letterSpacing: 1.2,
  },
  passwordLabelRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  forgotLinkText: {
    fontFamily: FONTS.display,
    fontSize: 11.5,
    color: '#00E5FF',
    fontWeight: '600',
  },
  inputGlassPill: {
    flexDirection: 'row',
    alignItems: 'center',
    height: 48,
    borderRadius: 14,
    backgroundColor: 'rgba(15, 23, 42, 0.65)',
    borderWidth: 0.8,
    borderColor: 'rgba(255, 255, 255, 0.12)',
    paddingHorizontal: 12,
  },
  inputGlassPillFocused: {
    borderColor: '#06B6D4',
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    ...(Platform.OS !== 'web'
      ? {
          shadowColor: '#06B6D4',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.35,
          shadowRadius: 8,
        }
      : ({
          boxShadow: '0 0 10px rgba(6, 182, 212, 0.30)',
        } as any)),
  },
  inputLeadingIcon: {
    marginRight: 9,
  },
  textInput: {
    fontFamily: FONTS.display,
    flex: 1,
    height: '100%',
    color: '#FFFFFF',
    fontSize: 13.5,
    fontWeight: '500',
  },
  passwordToggle: {
    padding: 6,
  },

  /* Primary Submit Button */
  submitPillWrapper: {
    height: 52,
    borderRadius: 99,
    marginTop: 8,
    position: 'relative',
    overflow: 'hidden',
  },
  submitPillPressed: {
    opacity: 0.88,
    transform: [{ scale: 0.985 }],
  },
  submitOuterCyanGlow: {
    position: 'absolute',
    top: -10,
    bottom: -10,
    left: 20,
    right: 20,
    backgroundColor: 'rgba(0, 229, 255, 0.25)',
    borderRadius: 99,
    ...(Platform.OS !== 'web'
      ? {
          shadowColor: '#00E5FF',
          shadowOffset: { width: 0, height: 0 },
          shadowOpacity: 0.6,
          shadowRadius: 18,
        }
      : ({
          filter: 'blur(12px)',
        } as any)),
  },
  submitGradientBorder: {
    flex: 1,
    borderRadius: 99,
    padding: 1.2,
  },
  submitButtonBlur: {
    flex: 1,
    borderRadius: 98,
    backgroundColor: 'rgba(10, 16, 28, 0.90)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  submitButtonContent: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
  },
  submitButtonText: {
    fontFamily: FONTS.display,
    fontSize: 15,
    fontWeight: '800',
    color: '#FFFFFF',
    letterSpacing: 0.5,
  },

  /* Bottom Section */
  bottomSection: {
    paddingBottom: Platform.OS === 'ios' ? 20 : 12,
    alignItems: 'center',
  },
});
