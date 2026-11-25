/**
 * KaryaDEX — Liquid Glass Tab Navigation Layout
 * 
 * Apple-inspired floating Liquid Glass navigation capsule.
 * Features:
 * - Translucent physical glass material with 30px backdrop blur + 190% saturation
 * - True Active Glass Capsule floating inside the navigation bar
 * - 100% monochrome vector icon family (all emojis removed)
 * - Top specular rim light reflection and multi-layer diffused shadow
 * - Full cross-platform compatibility (iOS, Android, Web)
 */

import React from 'react';
import { Tabs } from 'expo-router';
import { Platform, View, Text, StyleSheet, Pressable, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import { usePlaygroundStore } from '@/store/usePlaygroundStore';
import { useLockInStore } from '@/hooks/useLockInStore';
import { lockinPlaygroundBridge } from '@/lib/lockin/lockinPlaygroundBridge';

interface BottomTabBarProps {
  state: any;
  descriptors: any;
  navigation?: any;
  emitter?: any;
  navigateToTab?: (routeKey: string) => void;
  insets?: any;
}
import { useTheme, DarkThemeScope } from '@/constants/ThemeContext';
import { typography, radii } from '@/constants/theme';
import { NavIcon, type NavIconName } from '@/components/ui/Icon';
import { FloatingAICompanion } from '@/components/ai';
import { TAB_NAMES } from '@/constants/navigation';

export { TAB_NAMES };

function LiquidGlassTabBar({ state, descriptors, navigation, emitter, navigateToTab }: BottomTabBarProps) {
  const { colors, isDark } = useTheme();

  // Authoritative full-screen game immersion state
  const activeGame = usePlaygroundStore((s) => s.activeGame);

  // Authoritative LockIn Focus State: Locked if active/paused focus session & no valid break
  const isPlaygroundLocked = useLockInStore((s) => {
    const status = s.timerState?.status;
    const isFocus = (status === 'active' || status === 'paused') && s.currentSession !== null;
    if (!isFocus) return false;
    const activeBreak = s.activeBreak;
    const isBreakActive = activeBreak !== null && activeBreak.isBreakActive && Date.now() < activeBreak.breakDeadlineTimestamp;
    return !isBreakActive;
  });

  const currentRoute = state.routes[state.index]?.name;
  if (activeGame !== null && currentRoute === 'playground') {
    return null;
  }

  return (
    <View
      style={[
        styles.outerContainer,
        {
          bottom: Platform.OS === 'ios' ? 24 : 16,
        },
      ]}
      pointerEvents="box-none"
    >
      <View
        style={[
          styles.glassBar,
          {
            backgroundColor: colors.tabBar,
            borderColor: colors.tabBarBorder,
            ...(Platform.OS === 'web'
              ? ({
                  backdropFilter: 'blur(32px) saturate(190%)',
                  WebkitBackdropFilter: 'blur(32px) saturate(190%)',
                  boxShadow: colors.tabBarShadow,
                } as any)
              : {
                  shadowColor: '#000',
                  shadowOffset: { width: 0, height: 10 },
                  shadowOpacity: isDark ? 0.65 : 0.14,
                  shadowRadius: 28,
                  elevation: 12,
                }),
          },
        ]}
      >
        {/* Top Specular Rim Light */}
        <View
          pointerEvents="none"
          style={[
            styles.specularRim,
            {
              backgroundColor: isDark
                ? 'rgba(255, 255, 255, 0.24)'
                : 'rgba(255, 255, 255, 0.98)',
            },
          ]}
        />

        {/* Tab Items Row */}
        <View style={styles.tabRow}>
          {state.routes.map((route: any, index: number) => {
            const { options } = descriptors[route.key];
            const isFocused = state.index === index;
            const tabName = TAB_NAMES[route.name] || 'Today';
            const label = options.title || tabName;
            const isRoutePlaygroundLocked = route.name === 'playground' && isPlaygroundLocked;

            const onPress = () => {
              if (isRoutePlaygroundLocked) {
                const message = lockinPlaygroundBridge.getLockedExplanation();
                if (Platform.OS === 'web' && typeof window !== 'undefined') {
                  window.alert(message);
                } else {
                  Alert.alert('Playground Locked', message);
                }
                return;
              }

              const emit = navigation?.emit ?? emitter?.emit;
              const event = emit
                ? emit({
                    type: 'tabPress',
                    target: route.key,
                    canPreventDefault: true,
                  })
                : { defaultPrevented: false };

              if (!isFocused && !event.defaultPrevented) {
                if (navigation?.navigate) {
                  navigation.navigate(route.name);
                } else if (navigateToTab) {
                  navigateToTab(route.key);
                }
              }
            };

            const onLongPress = () => {
              const emit = navigation?.emit ?? emitter?.emit;
              emit?.({
                type: 'tabLongPress',
                target: route.key,
              });
            };

            return (
              <Pressable
                key={route.key}
                accessibilityRole="button"
                accessibilityState={
                  isRoutePlaygroundLocked
                    ? { disabled: true }
                    : isFocused
                    ? { selected: true }
                    : {}
                }
                accessibilityLabel={
                  isRoutePlaygroundLocked
                    ? `Playground (Locked: ${lockinPlaygroundBridge.getLockedExplanation()})`
                    : options.tabBarAccessibilityLabel
                }
                testID={
                  isRoutePlaygroundLocked
                    ? 'tab-playground-locked'
                    : options.tabBarButtonTestID
                }
                onPress={onPress}
                onLongPress={isRoutePlaygroundLocked ? undefined : onLongPress}
                style={({ pressed }) => [
                  styles.tabItem,
                  isRoutePlaygroundLocked && { opacity: 0.5 },
                  pressed && !isRoutePlaygroundLocked && { opacity: 0.85, transform: [{ scale: 0.96 }] },
                ]}
              >
                {isRoutePlaygroundLocked ? (
                  /* ─── Locked Tab Indicator ────────────────────────── */
                  <View style={styles.inactiveTabContent}>
                    <Feather name="lock" size={17} color={colors.tabBarInactiveText} />
                    <Text
                      style={[
                        styles.inactiveLabel,
                        { color: colors.tabBarInactiveText },
                      ]}
                      numberOfLines={1}
                    >
                      Locked
                    </Text>
                  </View>
                ) : isFocused ? (
                  /* ─── Active Glass Capsule ────────────────────────── */
                  <View
                    style={[
                      styles.activeGlassCapsule,
                      {
                        backgroundColor: colors.tabBarActiveCapsuleBg,
                        borderColor: colors.tabBarActiveCapsuleBorder,
                        ...(Platform.OS === 'web'
                          ? ({
                              boxShadow: colors.tabBarActiveCapsuleShadow,
                            } as any)
                          : {
                              shadowColor: '#000',
                              shadowOffset: { width: 0, height: 2 },
                              shadowOpacity: isDark ? 0.35 : 0.08,
                              shadowRadius: 6,
                              elevation: 3,
                            }),
                      },
                    ]}
                  >
                    {/* Active capsule internal top specular highlight */}
                    <View
                      pointerEvents="none"
                      style={[
                        styles.capsuleInnerSpecular,
                        {
                          backgroundColor: isDark
                            ? 'rgba(255, 255, 255, 0.35)'
                            : 'rgba(255, 255, 255, 1)',
                        },
                      ]}
                    />
                    <NavIcon
                      name={tabName}
                      size={18}
                      color={colors.tabBarActiveText}
                      focused={true}
                    />
                    <Text
                      style={[
                        styles.activeLabel,
                        { color: colors.tabBarActiveText },
                      ]}
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                  </View>
                ) : (
                  /* ─── Inactive Tab ────────────────────────────────── */
                  <View style={styles.inactiveTabContent}>
                    <NavIcon
                      name={tabName}
                      size={18}
                      color={colors.tabBarInactiveText}
                      focused={false}
                    />
                    <Text
                      style={[
                        styles.inactiveLabel,
                        { color: colors.tabBarInactiveText },
                      ]}
                      numberOfLines={1}
                    >
                      {label}
                    </Text>
                  </View>
                )}
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

export default function TabLayout() {
  const activeGame = usePlaygroundStore((s) => s.activeGame);

  return (
    <DarkThemeScope>
      <View style={{ flex: 1, backgroundColor: '#05070B' }}>
        <Tabs
          tabBar={(props) => <LiquidGlassTabBar {...props} />}
          screenOptions={{
            headerShown: false,
            sceneStyle: { backgroundColor: '#05070B' },
          }}
        >
          <Tabs.Screen
            name="index"
            options={{
              title: 'Today',
            }}
          />
          <Tabs.Screen
            name="schedule"
            options={{
              title: 'Schedule',
            }}
          />
          <Tabs.Screen
            name="tasks"
            options={{
              title: 'Tasks',
            }}
          />
          <Tabs.Screen
            name="study"
            options={{
              title: 'Study',
            }}
          />
          <Tabs.Screen
            name="attendance"
            options={{
              title: 'Attendance',
            }}
          />
          <Tabs.Screen
            name="college"
            options={{
              title: 'College',
            }}
          />
          <Tabs.Screen
            name="lockin"
            options={{
              title: 'LOCKIN',
            }}
          />
          <Tabs.Screen
            name="playground"
            options={{
              title: 'Playground',
            }}
          />
        </Tabs>
        {!activeGame && <FloatingAICompanion />}
      </View>
    </DarkThemeScope>
  );
}

const styles = StyleSheet.create({
  outerContainer: {
    position: 'absolute',
    left: 16,
    right: 16,
    alignItems: 'center',
    justifyContent: 'center',
    zIndex: 99,
  },
  glassBar: {
    width: '100%',
    maxWidth: 540,
    height: 64,
    borderRadius: radii.full,
    borderWidth: 1,
    overflow: 'hidden',
    position: 'relative',
    justifyContent: 'center',
  },
  specularRim: {
    position: 'absolute',
    top: 0,
    left: 20,
    right: 20,
    height: 1,
    opacity: 0.9,
    borderRadius: 1,
  },
  tabRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingHorizontal: 3,
    paddingVertical: 4,
    height: '100%',
  },
  tabItem: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 2,
  },
  activeGlassCapsule: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 4,
    borderRadius: 18,
    borderWidth: 1,
    position: 'relative',
    minWidth: 38,
    gap: 1.5,
  },
  capsuleInnerSpecular: {
    position: 'absolute',
    top: 0,
    left: 6,
    right: 6,
    height: 1,
    opacity: 0.95,
    borderRadius: 1,
  },
  activeLabel: {
    fontSize: 8.5,
    fontWeight: typography.weights.bold,
    letterSpacing: 0,
    lineHeight: 10.5,
  },
  inactiveTabContent: {
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 4,
    paddingHorizontal: 1,
    gap: 1.5,
    opacity: 0.85,
  },
  inactiveLabel: {
    fontSize: 8.5,
    fontWeight: typography.weights.medium,
    letterSpacing: 0,
    lineHeight: 10.5,
  },
});
