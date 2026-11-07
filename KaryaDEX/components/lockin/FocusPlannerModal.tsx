import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Switch, FlatList, ScrollView, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/constants/ThemeContext';
import { brand, spacing, typography, radii } from '@/constants/theme';
import { lockinStorage } from '../../services/lockin/lockinStorage';
import type { LockinSchedule, LockinStrictMode } from '@/types/lockin';

interface FocusPlannerModalProps {
  visible: boolean;
  userId: string;
  onClose: () => void;
}

const DAYS = [
  { value: 0, label: 'Sun', short: 'S' },
  { value: 1, label: 'Mon', short: 'M' },
  { value: 2, label: 'Tue', short: 'T' },
  { value: 3, label: 'Wed', short: 'W' },
  { value: 4, label: 'Thu', short: 'T' },
  { value: 5, label: 'Fri', short: 'F' },
  { value: 6, label: 'Sat', short: 'S' },
];

const STRICT_MODES = [
  { value: 'none', label: 'Off' },
  { value: 'soft', label: 'Soft' },
  { value: 'hard', label: 'Hard' },
];

export function FocusPlannerModal({ visible, userId, onClose }: FocusPlannerModalProps) {
  const { colors, isDark } = useTheme();
  const [schedules, setSchedules] = useState<LockinSchedule[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    name: '',
    daysOfWeek: [] as number[],
    startTime: '09:00',
    endTime: '12:00',
    strictMode: 'none' as LockinStrictMode,
    isActive: true,
  });

  useEffect(() => {
    loadSchedules();
  }, [visible, userId]);

  const loadSchedules = async () => {
    const data = await lockinStorage.getSchedules(userId);
    setSchedules(data);
  };

  const handleSave = async () => {
    if (!formData.name.trim()) return;

    const payload: Omit<LockinSchedule, 'id' | 'createdAt' | 'updatedAt'> = {
      userId,
      name: formData.name,
      daysOfWeek: formData.daysOfWeek,
      startTime: formData.startTime,
      endTime: formData.endTime,
      strictMode: formData.strictMode,
      isActive: formData.isActive,
    };

    if (isEditing) {
      await lockinStorage.updateSchedule(isEditing, payload);
    } else {
      await lockinStorage.createSchedule(payload);
    }

    resetForm();
    loadSchedules();
  };

  const handleEdit = (schedule: LockinSchedule) => {
    setIsEditing(schedule.id);
    setFormData({
      name: schedule.name,
      daysOfWeek: schedule.daysOfWeek,
      startTime: schedule.startTime,
      endTime: schedule.endTime,
      strictMode: schedule.strictMode,
      isActive: schedule.isActive,
    });
  };

  const handleDelete = async (id: string) => {
    await lockinStorage.deleteSchedule(id);
    loadSchedules();
  };

  const resetForm = () => {
    setIsEditing(null);
    setFormData({
      name: '',
      daysOfWeek: [],
      startTime: '09:00',
      endTime: '12:00',
      strictMode: 'none',
      isActive: true,
    });
  };

  const toggleDay = (day: number) => {
    const newDays = formData.daysOfWeek.includes(day)
      ? formData.daysOfWeek.filter(d => d !== day)
      : [...formData.daysOfWeek, day];
    setFormData(prev => ({ ...prev, daysOfWeek: newDays }));
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>Focus Planner</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Create recurring study blocks that automatically activate focus mode.
          </Text>

          {/* Form Section */}
          <View style={styles.formSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{isEditing ? 'Edit Schedule' : 'New Schedule'}</Text>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Schedule Name</Text>
              <TextInput
                style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.text }]}
                value={formData.name}
                onChangeText={text => setFormData(prev => ({ ...prev, name: text }))}
                placeholder="e.g. Morning Deep Work"
              />
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Days of Week</Text>
              <View style={styles.dayRow}>
                {DAYS.map(day => (
                  <TouchableOpacity
                    key={day.value}
                    style={[
                      styles.dayChip,
                      {
                        backgroundColor: formData.daysOfWeek.includes(day.value) ? brand.violet : colors.surfaceSecondary,
                        borderColor: formData.daysOfWeek.includes(day.value) ? brand.violet : colors.border,
                      },
                    ]}
                    onPress={() => toggleDay(day.value)}
                  >
                    <Text
                      style={[
                        styles.dayChipText,
                        { color: formData.daysOfWeek.includes(day.value) ? '#FFF' : colors.text },
                      ]}
                    >
                      {day.short}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.timeRow}>
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.text }]}>Start Time</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.text }]}
                  value={formData.startTime}
                  onChangeText={text => setFormData(prev => ({ ...prev, startTime: text }))}
                  keyboardType="numeric"
                  maxLength={5}
                />
              </View>
              <View style={styles.field}>
                <Text style={[styles.label, { color: colors.text }]}>End Time</Text>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.text }]}
                  value={formData.endTime}
                  onChangeText={text => setFormData(prev => ({ ...prev, endTime: text }))}
                  keyboardType="numeric"
                  maxLength={5}
                />
              </View>
            </View>

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Strict Mode</Text>
              <View style={styles.strictModeRow}>
                {STRICT_MODES.map(mode => (
                  <TouchableOpacity
                    key={mode.value}
                    style={[
                      styles.strictModeChip,
                      {
                        backgroundColor: formData.strictMode === mode.value ? brand.violet : colors.surfaceSecondary,
                        borderColor: formData.strictMode === mode.value ? brand.violet : colors.border,
                      },
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, strictMode: mode.value as 'none' | 'soft' | 'hard' }))}
                  >
                    <Text
                      style={[
                        styles.strictModeChipText,
                        { color: formData.strictMode === mode.value ? '#FFF' : colors.text },
                      ]}
                    >
                      {mode.label}
                    </Text>
                  </TouchableOpacity>
                ))}
              </View>
            </View>

            <View style={styles.field}>
              <View style={styles.toggleRow}>
                <Text style={[styles.label, { color: colors.text }]}>Active</Text>
                <Switch
                  value={formData.isActive}
                  onValueChange={value => setFormData(prev => ({ ...prev, isActive: value }))}
                  trackColor={{ true: brand.violet }}
                />
              </View>
            </View>

            <View style={styles.buttonRow}>
              <TouchableOpacity style={[styles.cancelButton, { borderColor: colors.border }]} onPress={resetForm}>
                <Text style={[styles.cancelText, { color: colors.text }]}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity style={[styles.saveButton, { backgroundColor: brand.violet }]} onPress={handleSave}>
                <Text style={styles.saveText}>{isEditing ? 'Update' : 'Add Schedule'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Saved Schedules List */}
          {schedules.length > 0 && (
            <View style={styles.listSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Saved Schedules</Text>
              <FlatList
                data={schedules}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={[styles.scheduleCard, { backgroundColor: colors.surfaceSecondary }]} onPress={() => handleEdit(item)}>
                    <View style={styles.scheduleCardHeader}>
                      <Text style={[styles.scheduleName, { color: colors.text }]}>{item.name}</Text>
                      <View style={styles.scheduleActions}>
                        <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleEdit(item); }}>
                          <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleDelete(item.id); }}>
                          <Ionicons name="trash-outline" size={18} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <Text style={[styles.scheduleDetails, { color: colors.textSecondary }]}>
                      {item.daysOfWeek.map(d => DAYS.find(day => day.value === d)?.short).join(', ')} · {item.startTime}–{item.endTime} · {item.strictMode}
                    </Text>
                    <View style={styles.scheduleFooter}>
                      <View style={[
                        styles.statusChip,
                        { backgroundColor: item.isActive ? 'rgba(34,197,94,0.15)' : 'rgba(239,68,68,0.15)' },
                      ]}>
                        <Text style={[styles.statusText, { color: item.isActive ? '#22c55e' : '#ef4444' }]}>
                          {item.isActive ? 'Active' : 'Inactive'}
                        </Text>
                      </View>
                    </View>
                  </TouchableOpacity>
                )}
              />
            </View>
          )}
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  overlay: { flex: 1, backgroundColor: 'rgba(0,0,0,0.5)', justifyContent: 'center', alignItems: 'center' },
  container: { width: '95%', maxHeight: '90%', borderRadius: 20, padding: 24 },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 16 },
  title: { fontSize: 20, fontWeight: '700' },
  description: { fontSize: 14, marginBottom: 20, lineHeight: 20 },
  formSection: { marginBottom: 24 },
  sectionTitle: { fontSize: 16, fontWeight: '600', marginBottom: 16 },
  field: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { borderRadius: 12, padding: 12, fontSize: 16 },
  dayRow: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 },
  dayChip: { paddingHorizontal: 14, paddingVertical: 8, borderRadius: 10, borderWidth: 1 },
  dayChipText: { fontSize: 14, fontWeight: '600' },
  timeRow: { flexDirection: 'row', gap: 12 },
  strictModeRow: { flexDirection: 'row', gap: 8 },
  strictModeChip: { paddingHorizontal: 16, paddingVertical: 10, borderRadius: 10, borderWidth: 1 },
  strictModeChipText: { fontSize: 14, fontWeight: '600' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelButton: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1 },
  cancelText: { fontSize: 16, fontWeight: '600' },
  saveButton: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  saveText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  listSection: { marginTop: 8 },
  scheduleCard: { borderRadius: 12, padding: 16, marginBottom: 12 },
  scheduleCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 },
  scheduleName: { fontSize: 16, fontWeight: '600' },
  scheduleActions: { flexDirection: 'row', gap: 12 },
  scheduleDetails: { fontSize: 13, marginBottom: 8 },
  scheduleFooter: { flexDirection: 'row', justifyContent: 'flex-end' },
  statusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '600' },
});