import React from 'react';
import { Text, View, StyleSheet } from 'react-native';

/**
 * KaryaDEX Root Workspace Fallback
 *
 * The main Expo application is located in the `KaryaDEX` directory.
 * Recommended commands from workspace root:
 *   - npm run web       (for Web browser preview)
 *   - npm start         (for Mobile / Expo Go LAN mode)
 *   - npm run android   (for Android device/emulator)
 *   - npm test          (to run full test suite)
 * Or navigate to the app directly:
 *   - cd KaryaDEX && npx expo start
 */
export default function App() {
  return (
    <View style={styles.container}>
      <Text style={styles.title}>KaryaDEX Workspace</Text>
      <Text style={styles.text}>
        The Expo app is located in the KaryaDEX folder.{'\n\n'}
        Please run one of the following commands:{'\n\n'}
        <Text style={styles.cmd}>npm run web</Text> (Web preview){'\n'}
        <Text style={styles.cmd}>npm start</Text> (Expo Go / LAN){'\n'}
        <Text style={styles.cmd}>npm run android</Text> (Android emulator){'\n\n'}
        Or switch directory:{'\n'}
        <Text style={styles.cmd}>cd KaryaDEX && npx expo start</Text>
      </Text>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: '#0B0C11',
    alignItems: 'center',
    justifyContent: 'center',
    padding: 24,
  },
  title: {
    fontSize: 24,
    fontWeight: 'bold',
    color: '#FFFFFF',
    marginBottom: 16,
  },
  text: {
    fontSize: 15,
    color: '#A1A1AA',
    textAlign: 'center',
    lineHeight: 24,
  },
  cmd: {
    fontFamily: 'monospace',
    color: '#A78BFA',
    fontWeight: '600',
  },
});
