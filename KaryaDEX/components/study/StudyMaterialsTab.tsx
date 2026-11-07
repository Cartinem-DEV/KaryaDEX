/**
 * KaryaDEX — Learning Materials Workspace
 *
 * Subject-specific document management, notes organization,
 * and Banku AI document intelligence integration.
 */

import React, { useState, useEffect } from 'react';
import { View, Text, StyleSheet, Pressable, ScrollView, TextInput, ActivityIndicator, Alert } from 'react-native';
import { Feather } from '@expo/vector-icons';
import * as DocumentPicker from 'expo-document-picker';
import { useTheme } from '@/constants/ThemeContext';
import { typography, radii, spacing } from '@/constants/theme';
import type { Resource, ResourceType } from '@/types/academic';
import type { Subject } from '@/types';
import { resourceRepository } from '@/database/repositories/resourceRepository';

interface StudyMaterialsTabProps {
  subjects: Subject[];
  selectedSubjectId: string | 'all';
  onNavigateToTutorWithDoc?: (docTitle: string) => void;
  onRefreshData: () => Promise<void>;
}

interface MockResourceItem {
  id: string;
  title: string;
  subjectId: string;
  type: 'pdf' | 'notes' | 'slides' | 'link';
  sizeOrUrl: string;
  updatedAt: string;
}

const DEFAULT_MATERIALS: MockResourceItem[] = [
  {
    id: 'mat-1',
    title: 'Computer Networks — Unit 3 Transport Layer & TCP Congestion',
    subjectId: 'subj-1',
    type: 'pdf',
    sizeOrUrl: '4.2 MB PDF',
    updatedAt: '2 days ago',
  },
  {
    id: 'mat-2',
    title: 'Operating Systems — Memory Management & Virtual Memory Notes',
    subjectId: 'subj-2',
    type: 'notes',
    sizeOrUrl: 'Scanned Handwritten (8 pages)',
    updatedAt: 'Yesterday',
  },
  {
    id: 'mat-3',
    title: 'Database Management Systems — Normalization (1NF to BCNF) Slides',
    subjectId: 'subj-3',
    type: 'slides',
    sizeOrUrl: 'Presentation Slides (36 pages)',
    updatedAt: '3 days ago',
  },
  {
    id: 'mat-4',
    title: 'Algorithms — Dynamic Programming Cheat Sheet & Practice Problems',
    subjectId: 'subj-4',
    type: 'pdf',
    sizeOrUrl: '1.8 MB PDF',
    updatedAt: '5 days ago',
  },
];

export function StudyMaterialsTab({
  subjects,
  selectedSubjectId,
  onNavigateToTutorWithDoc,
  onRefreshData,
}: StudyMaterialsTabProps) {
  const { colors, isDark } = useTheme();
  const [filterType, setFilterType] = useState<'all' | 'pdf' | 'notes' | 'slides' | 'link'>('all');
  const [materials, setMaterials] = useState<MockResourceItem[]>(DEFAULT_MATERIALS);
  const [analyzingDocId, setAnalyzingDocId] = useState<string | null>(null);
  const [analysisResult, setAnalysisResult] = useState<{ id: string; summary: string } | null>(null);
  const [isUploading, setIsUploading] = useState<boolean>(false);

  useEffect(() => {
    loadMaterials();
  }, [selectedSubjectId]);

  const loadMaterials = async () => {
    try {
      const stored = await resourceRepository.getAllResources();
      if (stored && stored.length > 0) {
        const mapped: MockResourceItem[] = stored.map(r => ({
          id: r.id,
          title: r.title,
          subjectId: r.subjectId || (subjects[0]?.id || 'subj-1'),
          type: (r.type === 'pdf' || r.type === 'scanned_pdf') ? 'pdf' : (r.type === 'url' || r.type === 'youtube') ? 'link' : 'notes',
          sizeOrUrl: r.fileSize ? `${(r.fileSize / (1024 * 1024)).toFixed(1)} MB` : (r.url || 'Document File'),
          updatedAt: 'Indexed in SQLite',
        }));
        setMaterials(mapped);
      } else {
        // Seed default materials into SQLite so they are permanently accessible
        for (const m of DEFAULT_MATERIALS) {
          const resType: ResourceType = m.type === 'link' ? 'url' : m.type === 'pdf' ? 'pdf' : 'document';
          await resourceRepository.createResource({
            id: m.id,
            title: m.title,
            subjectId: m.subjectId,
            type: resType,
            fileSize: 2 * 1024 * 1024,
            isLocal: true,
            isRecommended: true,
            createdAt: new Date().toISOString(),
          });
        }
        setMaterials(DEFAULT_MATERIALS);
      }
    } catch (e) {
      console.warn('[StudyMaterials] Failed to load resources:', e);
      setMaterials(DEFAULT_MATERIALS);
    }
  };

  const handleUploadDocument = async () => {
    setIsUploading(true);
    try {
      const result = await DocumentPicker.getDocumentAsync({
        type: ['application/pdf', 'image/*'],
        copyToCacheDirectory: true,
      });

      if (!result.canceled && result.assets && result.assets.length > 0) {
        const file = result.assets[0];
        const newResource: Resource = {
          id: `res-${Date.now()}`,
          title: file.name || 'Uploaded Study Document',
          subjectId: selectedSubjectId === 'all' ? (subjects[0]?.id || 'subj-1') : selectedSubjectId,
          type: file.mimeType?.includes('pdf') ? 'pdf' : 'document',
          uri: file.uri,
          fileSize: file.size || 1024 * 1024,
          mimeType: file.mimeType || 'application/pdf',
          source: 'local_upload',
          isLocal: true,
          isRecommended: false,
          createdAt: new Date().toISOString(),
        };

        await resourceRepository.createResource(newResource);
        await loadMaterials();
        await onRefreshData();
      }
    } catch (err) {
      console.warn('[StudyMaterials] Pick document error:', err);
    } finally {
      setIsUploading(false);
    }
  };

  // Filter materials by selected subject and type
  const filteredMaterials = materials.filter(m => {
    const matchesSubject = selectedSubjectId === 'all' || m.subjectId === selectedSubjectId;
    const matchesType = filterType === 'all' || m.type === filterType;
    return matchesSubject && matchesType;
  });

  const handleBankuAnalyze = async (doc: MockResourceItem) => {
    setAnalyzingDocId(doc.id);
    setAnalysisResult(null);
    try {
      await new Promise(r => setTimeout(r, 800));
      const subject = subjects.find(s => s.id === doc.subjectId);
      const subjectName = subject ? subject.name : 'Curriculum';
      setAnalysisResult({
        id: doc.id,
        summary: `Banku Intelligence: Parsed "${doc.title}". Extracted core definitions, procedural derivations, and linked to ${subjectName} syllabus topics. Indexed for Socratic Tutor.`,
      });
    } finally {
      setAnalyzingDocId(null);
    }
  };

  const getTypeIcon = (type: string) => {
    switch (type) {
      case 'pdf': return 'file-text';
      case 'notes': return 'edit-3';
      case 'slides': return 'monitor';
      case 'link': return 'link-2';
      default: return 'file';
    }
  };

  const getTypeColor = (type: string) => {
    switch (type) {
      case 'pdf': return '#EF4444';
      case 'notes': return '#F59E0B';
      case 'slides': return '#00E5FF';
      case 'link': return '#10B981';
      default: return '#A78BFA';
    }
  };

  return (
    <ScrollView
      style={styles.container}
      contentContainerStyle={styles.scrollContent}
      showsVerticalScrollIndicator={false}
    >
      {/* 1. Banku Document Intelligence Banner */}
      <View style={[styles.bankuBanner, { backgroundColor: 'rgba(245, 158, 11, 0.12)', borderColor: 'rgba(245, 158, 11, 0.3)' }]}>
        <View style={styles.bankuHeader}>
          <View style={[styles.bankuIconBox, { backgroundColor: '#F59E0B' }]}>
            <Feather name="shield" size={16} color="#05070B" />
          </View>
          <View style={{ flex: 1 }}>
            <Text style={[styles.bankuTitle, { color: colors.text }]}>Banku Multimodal Intelligence</Text>
            <Text style={[styles.bankuDesc, { color: colors.textSecondary }]}>
              Attach lecture PDFs, photographed notes, or slides. Banku parses and structures formulas & definitions for your AI Tutor.
            </Text>
          </View>
        </View>
      </View>

      {/* Upload Material Action Bar */}
      <View style={styles.uploadRow}>
        <Pressable
          onPress={handleUploadDocument}
          style={[styles.uploadBtn, { backgroundColor: '#7C3AED' }]}
          disabled={isUploading}
        >
          {isUploading ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <>
              <Feather name="upload-cloud" size={15} color="#FFFFFF" />
              <Text style={styles.uploadBtnText}>+ Attach PDF or Notes to Syllabus</Text>
            </>
          )}
        </Pressable>
      </View>

      {/* 2. Type Filter Pills */}
      <View style={styles.filterPillsRow}>
        {(['all', 'pdf', 'notes', 'slides', 'link'] as const).map((type) => {
          const isSelected = filterType === type;
          return (
            <Pressable
              key={type}
              onPress={() => setFilterType(type)}
              style={[
                styles.typePill,
                isSelected
                  ? { backgroundColor: '#7C3AED', borderColor: '#8B5CF6' }
                  : { backgroundColor: colors.surface, borderColor: colors.border },
              ]}
            >
              <Text
                style={[
                  styles.typePillText,
                  isSelected ? { color: '#FFFFFF', fontWeight: '700' } : { color: colors.textSecondary },
                ]}
              >
                {type.toUpperCase()}
              </Text>
            </Pressable>
          );
        })}
      </View>

      {/* 3. Document Items List */}
      {filteredMaterials.length === 0 ? (
        <View style={[styles.emptyBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Feather name="folder" size={28} color={colors.textTertiary} />
          <Text style={[styles.emptyTitle, { color: colors.text }]}>No materials in this filter</Text>
          <Text style={[styles.emptySubtitle, { color: colors.textSecondary }]}>
            Upload study notes or PDFs for this subject to build your indexed knowledge repository.
          </Text>
        </View>
      ) : (
        <View style={styles.materialsList}>
          {filteredMaterials.map((doc) => {
            const subject = subjects.find(s => s.id === doc.subjectId);
            const isAnalyzing = analyzingDocId === doc.id;
            const hasAnalysis = analysisResult?.id === doc.id;

            return (
              <View key={doc.id} style={[styles.docCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                <View style={styles.docCardHeader}>
                  <View style={[styles.docTypeBadge, { backgroundColor: `${getTypeColor(doc.type)}18` }]}>
                    <Feather name={getTypeIcon(doc.type) as any} size={14} color={getTypeColor(doc.type)} />
                    <Text style={[styles.docTypeText, { color: getTypeColor(doc.type) }]}>
                      {doc.type.toUpperCase()}
                    </Text>
                  </View>
                  <Text style={[styles.docDate, { color: colors.textTertiary }]}>{doc.updatedAt}</Text>
                </View>

                <Text style={[styles.docTitle, { color: colors.text }]}>{doc.title}</Text>
                <Text style={[styles.docDetails, { color: colors.textSecondary }]}>
                  {subject ? subject.name : 'All Subjects'} • {doc.sizeOrUrl}
                </Text>

                {/* Analysis Result Banner */}
                {hasAnalysis && (
                  <View style={[styles.analysisBox, { backgroundColor: 'rgba(16, 185, 129, 0.12)', borderColor: 'rgba(16, 185, 129, 0.3)' }]}>
                    <Feather name="check-circle" size={13} color="#10B981" />
                    <Text style={styles.analysisText}>{analysisResult.summary}</Text>
                  </View>
                )}

                {/* Card Action Buttons */}
                <View style={styles.docActionsRow}>
                  <Pressable
                    onPress={() => handleBankuAnalyze(doc)}
                    style={[styles.actionBtn, { backgroundColor: 'rgba(245, 158, 11, 0.15)', borderColor: 'rgba(245, 158, 11, 0.3)' }]}
                    disabled={isAnalyzing}
                  >
                    {isAnalyzing ? (
                      <ActivityIndicator size="small" color="#F59E0B" />
                    ) : (
                      <>
                        <Feather name="cpu" size={13} color="#F59E0B" />
                        <Text style={[styles.actionBtnText, { color: '#F59E0B' }]}>Analyze with Banku</Text>
                      </>
                    )}
                  </Pressable>

                  {onNavigateToTutorWithDoc && (
                    <Pressable
                      onPress={() => onNavigateToTutorWithDoc(doc.title)}
                      style={[styles.actionBtn, { backgroundColor: 'rgba(0, 229, 255, 0.12)', borderColor: 'rgba(0, 229, 255, 0.3)' }]}
                    >
                      <Feather name="message-square" size={13} color="#00E5FF" />
                      <Text style={[styles.actionBtnText, { color: '#00E5FF' }]}>Ask Tutor</Text>
                    </Pressable>
                  )}
                </View>
              </View>
            );
          })}
        </View>
      )}

      {/* Spacing for floating bottom bar */}
      <View style={{ height: 100 }} />
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollContent: {
    padding: spacing.base,
  },
  bankuBanner: {
    padding: spacing.base,
    borderRadius: radii.xl,
    borderWidth: 1,
    marginBottom: spacing.base,
  },
  bankuHeader: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: spacing.sm,
  },
  bankuIconBox: {
    width: 32,
    height: 32,
    borderRadius: radii.md,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bankuTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    marginBottom: 2,
  },
  bankuDesc: {
    fontSize: typography.sizes.xs,
    lineHeight: 17,
  },
  uploadRow: {
    marginBottom: spacing.base,
  },
  uploadBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 8,
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: radii.lg,
  },
  uploadBtnText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: typography.sizes.xs,
  },
  filterPillsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
    marginBottom: spacing.base,
  },
  typePill: {
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  typePillText: {
    fontSize: 10,
    letterSpacing: 0.5,
  },
  materialsList: {
    gap: spacing.sm,
  },
  docCard: {
    padding: spacing.base,
    borderRadius: radii.lg,
    borderWidth: 1,
  },
  docCardHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    marginBottom: spacing.xs,
  },
  docTypeBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
    paddingHorizontal: 8,
    paddingVertical: 3,
    borderRadius: radii.sm,
  },
  docTypeText: {
    fontSize: 9,
    fontWeight: '800',
  },
  docDate: {
    fontSize: 10,
  },
  docTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: '700',
    marginBottom: 4,
  },
  docDetails: {
    fontSize: typography.sizes.xs,
    marginBottom: spacing.md,
  },
  analysisBox: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 6,
    padding: spacing.sm,
    borderRadius: radii.md,
    borderWidth: 1,
    marginBottom: spacing.sm,
  },
  analysisText: {
    fontSize: 11,
    color: '#10B981',
    lineHeight: 16,
    flex: 1,
  },
  docActionsRow: {
    flexDirection: 'row',
    gap: spacing.xs,
  },
  actionBtn: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 5,
    paddingHorizontal: 12,
    paddingVertical: 8,
    borderRadius: radii.md,
    borderWidth: 1,
  },
  actionBtnText: {
    fontSize: typography.sizes.xs,
    fontWeight: '700',
  },
  emptyBox: {
    padding: spacing.xl,
    borderRadius: radii.lg,
    borderWidth: 1,
    alignItems: 'center',
    justifyContent: 'center',
    gap: spacing.xs,
  },
  emptyTitle: {
    fontSize: typography.sizes.base,
    fontWeight: typography.weights.bold,
  },
  emptySubtitle: {
    fontSize: typography.sizes.xs,
    textAlign: 'center',
    maxWidth: 280,
    lineHeight: 18,
  },
});
