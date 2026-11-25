/**
 * KaryaDEX — SubjectResourcesView
 *
 * Subject Resources Viewer & Manager for Subject Hub.
 * Shows PDFs, lecture links, slides, and study notes.
 */

import React, { useState } from 'react';
import { View, Text, StyleSheet, Pressable, TextInput, Linking } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/constants/ThemeContext';
import { brand, typography, spacing, radii } from '@/constants/theme';
import { GlassCard } from '@/components/ui';
import { useAcademicStore } from '@/store/useAcademicStore';
import type { ResourceType } from '@/types/academic';

interface SubjectResourcesViewProps {
  subjectId: string;
}

export function SubjectResourcesView({ subjectId }: SubjectResourcesViewProps) {
  const { colors, isDark } = useTheme();
  const academic = useAcademicStore();

  const resources = academic.getResourcesForSubject(subjectId);

  const [showAdd, setShowAdd] = useState(false);
  const [title, setTitle] = useState('');
  const [url, setUrl] = useState('');
  const [type, setType] = useState<ResourceType>('pdf');

  const handleAdd = () => {
    if (!title.trim()) return;

    academic.addResource({
      title: title.trim(),
      type,
      url: url.trim() || undefined,
      subjectId,
    });

    setTitle('');
    setUrl('');
    setShowAdd(false);
  };

  const openResource = (targetUrl?: string) => {
    if (targetUrl) {
      Linking.openURL(targetUrl).catch(() => {});
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.headerRow}>
        <Text style={[styles.sectionTitle, { color: colors.textSecondary }]}>
          STUDY MATERIALS & LINKS ({resources.length})
        </Text>
        <Pressable onPress={() => setShowAdd(prev => !prev)}>
          <Text style={[styles.addLink, { color: brand.violet }]}>
            {showAdd ? 'Cancel' : '+ Add Resource'}
          </Text>
        </Pressable>
      </View>

      {showAdd && (
        <GlassCard level="secondary" style={styles.addCard}>
          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)',
              },
            ]}
            placeholder="Resource Title (e.g. Formula Sheet)"
            placeholderTextColor={colors.textTertiary}
            value={title}
            onChangeText={setTitle}
          />

          <TextInput
            style={[
              styles.input,
              {
                color: colors.text,
                borderColor: isDark ? 'rgba(255, 255, 255, 0.12)' : 'rgba(0, 0, 0, 0.1)',
              },
            ]}
            placeholder="URL / Web Link (optional)"
            placeholderTextColor={colors.textTertiary}
            value={url}
            onChangeText={setUrl}
            autoCapitalize="none"
          />

          <View style={styles.typeRow}>
            {(['pdf', 'url', 'document', 'image'] as ResourceType[]).map(t => (
              <Pressable
                key={t}
                onPress={() => setType(t)}
                style={[
                  styles.typeChip,
                  type === t && { backgroundColor: brand.violet },
                  {
                    borderColor: isDark ? 'rgba(255, 255, 255, 0.15)' : 'rgba(0, 0, 0, 0.1)',
                  },
                ]}
              >
                <Text
                  style={[
                    styles.typeChipText,
                    { color: type === t ? '#FFF' : colors.textSecondary },
                  ]}
                >
                  {t.toUpperCase()}
                </Text>
              </Pressable>
            ))}
          </View>

          <Pressable onPress={handleAdd} style={styles.saveBtn}>
            <Text style={styles.saveBtnText}>Save Resource</Text>
          </Pressable>
        </GlassCard>
      )}

      {resources.length === 0 ? (
        <GlassCard level="secondary" style={styles.emptyCard}>
          <Text style={[styles.emptyText, { color: colors.textTertiary }]}>
            No resources added for this subject yet.
          </Text>
        </GlassCard>
      ) : (
        resources.map(res => {
          const target = res.url || res.uri;
          return (
            <GlassCard
              key={res.id}
              level="secondary"
              style={styles.resourceCard}
              onPress={() => target && openResource(target)}
            >
              <View style={styles.resourceRow}>
                <Text style={styles.icon}>
                  {res.type === 'pdf' ? '📄' : res.type === 'url' ? '🔗' : '📁'}
                </Text>
                <View style={{ flex: 1 }}>
                  <Text style={[styles.title, { color: colors.text }]} numberOfLines={1}>
                    {res.title}
                  </Text>
                  <Text style={[styles.meta, { color: colors.textTertiary }]}>
                    {res.type.toUpperCase()}{target ? ` · ${target}` : ''}
                  </Text>
                </View>
                {target && (
                  <Text style={[styles.openIndicator, { color: brand.violet }]}>
                    Open ↗
                  </Text>
                )}
                <Pressable
                  hitSlop={8}
                  onPress={(e) => {
                    e.stopPropagation();
                    academic.deleteResource(res.id);
                  }}
                  style={styles.deleteBtn}
                  accessibilityLabel="Delete resource"
                >
                  <Ionicons name="trash-outline" size={16} color={colors.textTertiary} />
                </Pressable>
              </View>
            </GlassCard>
          );
        })
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: spacing.sm,
  },
  headerRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: spacing.xs,
  },
  sectionTitle: {
    fontSize: 11,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.6,
  },
  addLink: {
    fontSize: 12,
    fontWeight: typography.weights.semibold,
  },
  addCard: {
    padding: spacing.sm,
    gap: spacing.xs,
  },
  input: {
    borderWidth: 1,
    borderRadius: radii.sm,
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    fontSize: 12,
  },
  typeRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginVertical: 4,
  },
  typeChip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 4,
    borderRadius: radii.sm,
    borderWidth: 1,
  },
  typeChipText: {
    fontSize: 10,
    fontWeight: typography.weights.bold,
  },
  saveBtn: {
    backgroundColor: brand.violet,
    paddingVertical: 8,
    borderRadius: radii.sm,
    alignItems: 'center',
    marginTop: 4,
  },
  saveBtnText: {
    color: '#FFF',
    fontSize: 12,
    fontWeight: typography.weights.semibold,
  },
  emptyCard: {
    padding: spacing.xl,
    alignItems: 'center',
  },
  emptyText: {
    fontSize: typography.sizes.sm,
    fontStyle: 'italic',
  },
  resourceCard: {
    padding: spacing.base,
  },
  resourceRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  icon: {
    fontSize: 20,
  },
  title: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  meta: {
    fontSize: typography.sizes.xs,
    marginTop: 2,
  },
  openIndicator: {
    fontSize: 12,
    fontWeight: typography.weights.semibold,
  },
  deleteBtn: {
    padding: 6,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
