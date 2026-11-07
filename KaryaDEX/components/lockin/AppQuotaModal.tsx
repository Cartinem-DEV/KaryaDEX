import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Modal, TouchableOpacity, Switch, FlatList, TextInput, Platform } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/constants/ThemeContext';
import { brand, spacing, typography, radii } from '@/constants/theme';
import { lockinStorage } from '../../services/lockin/lockinStorage';
import type { LockinAppQuota } from '@/types/lockin';

interface AppQuotaModalProps {
  visible: boolean;
  userId: string;
  onClose: () => void;
}

const DEFAULT_AVAILABLE_APPS = [
  { packageName: 'com.instagram.android', appName: 'Instagram' },
  { packageName: 'com.twitter.android', appName: 'X (Twitter)' },
  { packageName: 'com.tiktok.android', appName: 'TikTok' },
  { packageName: 'com.facebook.katana', appName: 'Facebook' },
  { packageName: 'com.youtube.android', appName: 'YouTube' },
  { packageName: 'com.reddit.frontpage', appName: 'Reddit' },
  { packageName: 'com.snapchat.android', appName: 'Snapchat' },
  { packageName: 'com.discord', appName: 'Discord' },
];

export function AppQuotaModal({ visible, userId, onClose }: AppQuotaModalProps) {
  const { colors } = useTheme();
  const [quotas, setQuotas] = useState<LockinAppQuota[]>([]);
  const [isEditing, setIsEditing] = useState<string | null>(null);
  const [formData, setFormData] = useState({
    packageName: '',
    appName: '',
    dailyLimitMinutes: 30,
    isActive: true,
  });
  const [availableApps, setAvailableApps] = useState<{ packageName: string; appName: string }[]>(DEFAULT_AVAILABLE_APPS);
  const [showAppPicker, setShowAppPicker] = useState(false);

  useEffect(() => {
    loadQuotas();
    loadAvailableApps();
  }, [visible, userId]);

  const loadQuotas = async () => {
    try {
      const data = await lockinStorage.getQuotas(userId);
      setQuotas(Array.isArray(data) ? data : []);
    } catch {
      setQuotas([]);
    }
  };

  const loadAvailableApps = async () => {
    try {
      const { LockinModule } = require('@/modules/expo-module-lockin/src');
      if (typeof LockinModule?.getInstalledApps === 'function') {
        const apps = await LockinModule.getInstalledApps();
        if (Array.isArray(apps) && apps.length > 0) {
          setAvailableApps(apps);
          return;
        }
      }
    } catch {
      // Fall through to fallback
    }
    setAvailableApps(DEFAULT_AVAILABLE_APPS);
  };

  const handleSave = async () => {
    if (!formData.packageName || !formData.appName) return;

    const payload: Omit<LockinAppQuota, 'id' | 'usedMinutesToday' | 'lastResetDate' | 'createdAt' | 'updatedAt'> = {
      userId,
      packageName: formData.packageName,
      appName: formData.appName,
      dailyLimitMinutes: formData.dailyLimitMinutes,
      isActive: formData.isActive,
    };

    if (isEditing) {
      await lockinStorage.updateQuota(isEditing, {
        dailyLimitMinutes: formData.dailyLimitMinutes,
        isActive: formData.isActive,
      });
    } else {
      await lockinStorage.createQuota({ ...payload, usedMinutesToday: 0, lastResetDate: new Date().toISOString().split('T')[0] });
    }

    resetForm();
    loadQuotas();
  };

  const handleEdit = (quota: LockinAppQuota) => {
    setIsEditing(quota.id);
    setFormData({
      packageName: quota.packageName,
      appName: quota.appName,
      dailyLimitMinutes: quota.dailyLimitMinutes,
      isActive: quota.isActive,
    });
  };

  const handleDelete = async (id: string) => {
    await lockinStorage.deleteQuota(id);
    loadQuotas();
  };

  const resetForm = () => {
    setIsEditing(null);
    setFormData({
      packageName: '',
      appName: '',
      dailyLimitMinutes: 30,
      isActive: true,
    });
    setShowAppPicker(false);
  };

  const handleSelectApp = (app: { packageName: string; appName: string }) => {
    setFormData(prev => ({ ...prev, packageName: app.packageName, appName: app.appName }));
    setShowAppPicker(false);
  };

  const filteredApps = (availableApps || []).filter(
    app => !(quotas || []).some(q => q.packageName === app.packageName && q.id !== isEditing)
  );

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View style={styles.overlay}>
        <View style={[styles.container, { backgroundColor: colors.surface }]}>
          <View style={styles.header}>
            <Text style={[styles.title, { color: colors.text }]}>App Usage Quotas</Text>
            <TouchableOpacity onPress={onClose}>
              <Ionicons name="close" size={24} color={colors.textSecondary} />
            </TouchableOpacity>
          </View>

          <Text style={[styles.description, { color: colors.textSecondary }]}>
            Set daily time limits for distracting apps. Limits reset at midnight.
          </Text>

          {/* Form Section */}
          <View style={styles.formSection}>
            <Text style={[styles.sectionTitle, { color: colors.text }]}>{isEditing ? 'Edit Quota' : 'Add Quota'}</Text>

            <TouchableOpacity style={[styles.appPickerButton, { backgroundColor: colors.surfaceSecondary }]} onPress={() => setShowAppPicker(true)}>
              <View style={styles.appPickerContent}>
                <Ionicons name="apps" size={20} color={colors.textSecondary} />
                <Text style={[styles.appPickerText, { color: formData.appName ? colors.text : colors.textTertiary }]}>
                  {formData.appName || 'Select an app...'}
                </Text>
                <Ionicons name="chevron-down" size={20} color={colors.textSecondary} />
              </View>
            </TouchableOpacity>

            {showAppPicker && (
              <View style={styles.appPickerList}>
                {filteredApps.length === 0 ? (
                  <Text style={[styles.noAppsText, { color: colors.textSecondary }]}>All apps already have quotas</Text>
                ) : (
                  <FlatList
                    data={filteredApps}
                    keyExtractor={item => item.packageName}
                    renderItem={({ item }) => (
                      <TouchableOpacity style={styles.appPickerItem} onPress={() => handleSelectApp(item)}>
                        <Text style={[styles.appPickerItemText, { color: colors.text }]}>{item.appName}</Text>
                        <Text style={[styles.appPickerItemPackage, { color: colors.textTertiary }]}>{item.packageName}</Text>
                      </TouchableOpacity>
                    )}
                  />
                )}
              </View>
            )}

            <View style={styles.field}>
              <Text style={[styles.label, { color: colors.text }]}>Daily Limit (minutes)</Text>
              <View style={styles.sliderContainer}>
                <TextInput
                  style={[styles.input, { backgroundColor: colors.surfaceSecondary, color: colors.text, textAlign: 'center' }]}
                  value={String(formData.dailyLimitMinutes)}
                  onChangeText={text => {
                    const val = parseInt(text, 10);
                    if (!isNaN(val) && val >= 0 && val <= 480) {
                      setFormData(prev => ({ ...prev, dailyLimitMinutes: val }));
                    }
                  }}
                  keyboardType="numeric"
                  maxLength={3}
                />
                <Text style={[styles.sliderUnit, { color: colors.textSecondary }]}>min</Text>
              </View>
              <View style={styles.sliderTrack}>
                {[15, 30, 60, 120, 240].map(min => (
                  <TouchableOpacity
                    key={min}
                    style={[
                      styles.sliderTick,
                      { backgroundColor: formData.dailyLimitMinutes >= min ? brand.violet : colors.border },
                    ]}
                    onPress={() => setFormData(prev => ({ ...prev, dailyLimitMinutes: min }))}
                  >
                    <Text style={[styles.sliderTickText, { color: formData.dailyLimitMinutes >= min ? '#FFF' : colors.textSecondary }]}>
                      {min}
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
                <Text style={styles.saveText}>{isEditing ? 'Update' : 'Add Quota'}</Text>
              </TouchableOpacity>
            </View>
          </View>

          {/* Saved Quotas List */}
          {quotas.length > 0 && (
            <View style={styles.listSection}>
              <Text style={[styles.sectionTitle, { color: colors.text }]}>Configured Quotas</Text>
              <FlatList
                data={quotas}
                keyExtractor={item => item.id}
                renderItem={({ item }) => (
                  <TouchableOpacity style={[styles.quotaCard, { backgroundColor: colors.surfaceSecondary }]} onPress={() => handleEdit(item)}>
                    <View style={styles.quotaCardHeader}>
                      <Text style={[styles.quotaAppName, { color: colors.text }]}>{item.appName}</Text>
                      <View style={styles.quotaActions}>
                        <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleEdit(item); }}>
                          <Ionicons name="create-outline" size={18} color={colors.textSecondary} />
                        </TouchableOpacity>
                        <TouchableOpacity onPress={(e) => { e.stopPropagation(); handleDelete(item.id); }}>
                          <Ionicons name="trash-outline" size={18} color="#EF4444" />
                        </TouchableOpacity>
                      </View>
                    </View>
                    <View style={styles.quotaProgress}>
                      <View style={styles.quotaProgressBar}>
                        <View
                          style={[
                            styles.quotaProgressFill,
                            {
                              width: `${Math.min((item.usedMinutesToday / Math.max(item.dailyLimitMinutes, 1)) * 100, 100)}%`,
                              backgroundColor: item.usedMinutesToday >= item.dailyLimitMinutes ? '#EF4444' : brand.violet,
                            },
                          ]}
                        />
                      </View>
                      <Text style={[styles.quotaProgressText, { color: colors.textSecondary }]}>
                        {item.usedMinutesToday} / {item.dailyLimitMinutes} min used today
                      </Text>
                    </View>
                    <View style={styles.quotaFooter}>
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
  appPickerButton: { borderRadius: 12, padding: 14, marginBottom: 16 },
  appPickerContent: { flexDirection: 'row', alignItems: 'center', gap: 12 },
  appPickerText: { flex: 1, fontSize: 16 },
  appPickerList: { marginBottom: 16, maxHeight: 200, borderRadius: 12, backgroundColor: '#FFF', borderWidth: 1, borderColor: '#E5E7EB' },
  appPickerItem: { padding: 14, borderBottomWidth: 1, borderBottomColor: '#E5E7EB' },
  appPickerItemText: { fontSize: 16, fontWeight: '500' },
  appPickerItemPackage: { fontSize: 12, marginTop: 2 },
  noAppsText: { padding: 20, textAlign: 'center' },
  field: { marginBottom: 16 },
  label: { fontSize: 14, fontWeight: '600', marginBottom: 8 },
  input: { borderRadius: 12, padding: 12, fontSize: 18 },
  sliderContainer: { flexDirection: 'row', alignItems: 'center', gap: 8 },
  sliderUnit: { fontSize: 16 },
  sliderTrack: { flexDirection: 'row', gap: 8, marginTop: 12, flexWrap: 'wrap' },
  sliderTick: { flex: 1, minWidth: 40, paddingVertical: 8, borderRadius: 8, alignItems: 'center' },
  sliderTickText: { fontSize: 12, fontWeight: '600' },
  toggleRow: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  buttonRow: { flexDirection: 'row', gap: 12, marginTop: 8 },
  cancelButton: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center', borderWidth: 1 },
  cancelText: { fontSize: 16, fontWeight: '600' },
  saveButton: { flex: 1, borderRadius: 12, padding: 14, alignItems: 'center' },
  saveText: { color: '#FFF', fontSize: 16, fontWeight: '600' },
  listSection: { marginTop: 8 },
  quotaCard: { borderRadius: 12, padding: 16, marginBottom: 12 },
  quotaCardHeader: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', marginBottom: 12 },
  quotaAppName: { fontSize: 16, fontWeight: '600' },
  quotaActions: { flexDirection: 'row', gap: 12 },
  quotaProgress: { marginBottom: 12 },
  quotaProgressBar: { height: 6, borderRadius: 3, backgroundColor: '#E5E7EB', overflow: 'hidden' },
  quotaProgressFill: { height: '100%', borderRadius: 3 },
  quotaProgressText: { fontSize: 13, marginTop: 6, textAlign: 'right' },
  quotaFooter: { flexDirection: 'row', justifyContent: 'flex-end' },
  statusChip: { paddingHorizontal: 10, paddingVertical: 4, borderRadius: 8 },
  statusText: { fontSize: 12, fontWeight: '600' },
});