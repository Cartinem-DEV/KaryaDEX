import React, { useState } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Switch, TextInput } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/constants/ThemeContext';
import { brand } from '@/constants/theme';
import { lockinStorage } from '../../services/lockin/lockinStorage';

interface RealityCheckOverlayProps {
  visible: boolean;
  userId: string;
  onClose: () => void;
}

export function RealityCheckOverlay({ visible, userId, onClose }: RealityCheckOverlayProps) {
  const { colors } = useTheme();
  const [isEnabled, setIsEnabled] = useState(true);
  const [delaySeconds, setDelaySeconds] = useState('10');
  const [promptQuestion, setPromptQuestion] = useState('Why are you opening this app?');

  const handleSave = async () => {
    await lockinStorage.upsertRealityCheck({
      userId,
      delaySeconds: parseInt(delaySeconds, 10) || 10,
      promptQuestion,
      isEnabled,
    });
    onClose();
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Reality Check Pause</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Adds intentional friction before opening distracting apps by showing a breathing pause countdown and intent question.
          </Text>

          <View style={styles.row}>
            <Text style={[styles.label, { color: colors.text }]}>Enable Reality Check</Text>
            <Switch value={isEnabled} onValueChange={setIsEnabled} trackColor={{ true: brand.violet }} />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>Pause Countdown (seconds)</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.text }]}
              value={delaySeconds}
              onChangeText={setDelaySeconds}
              keyboardType="number-pad"
              maxLength={2}
            />
          </View>

          <View style={styles.field}>
            <Text style={[styles.label, { color: colors.text }]}>Intent Prompt Question</Text>
            <TextInput
              style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.text }]}
              value={promptQuestion}
              onChangeText={setPromptQuestion}
              placeholder="e.g. Why are you opening this app?"
            />
          </View>

          <TouchableOpacity style={[styles.saveButton, { backgroundColor: brand.violet }]} onPress={handleSave}>
            <Text style={styles.saveText}>Save Settings</Text>
          </TouchableOpacity>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  container: { width: '90%', borderRadius: 20, padding: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  description: { fontSize: 14, marginBottom: 20, lineHeight: 20 },
  row: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  field: { marginBottom: 16 },
  label: { fontSize: 15, fontWeight: '600', marginBottom: 8 },
  input: { borderRadius: 12, padding: 12, fontSize: 16 },
  saveButton: { borderRadius: 12, padding: 16, alignItems: 'center', marginTop: 12 },
  saveText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
});