import { Link, Stack } from 'expo-router';
import { StyleSheet, View, Text } from 'react-native';
import { useTheme } from '@/constants/ThemeContext';
import { typography, spacing } from '@/constants/theme';

export default function NotFoundScreen() {
  const { colors } = useTheme();

  return (
    <>
      <Stack.Screen options={{ title: 'Oops!' }} />
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        <Text style={{ fontSize: 48, marginBottom: spacing.md }}>🤔</Text>
        <Text style={[styles.title, { color: colors.text }]}>Page not found</Text>
        <Link href="/" style={[styles.link, { color: '#7C3AED' }]}>
          Go to Today →
        </Link>
      </View>
    </>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 20,
  },
  title: {
    fontSize: typography.sizes.lg,
    fontWeight: '700',
  },
  link: {
    marginTop: 15,
    paddingVertical: 15,
    fontSize: typography.sizes.base,
    fontWeight: '600',
  },
});
