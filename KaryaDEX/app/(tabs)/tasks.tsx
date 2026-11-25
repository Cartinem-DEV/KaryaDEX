/**
 * KaryaDEX — TASKS Screen
 * 
 * Visual redesign with refined glassmorphism:
 * - Glass category filter pills
 * - Secondary glass task cards with quiet completed states
 * - Elevated floating glass Add Task bottom sheet
 * - Semi-solid controls and filled primary actions
 */

import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, Pressable,
  TextInput, Platform, Modal,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Feather, Ionicons } from '@expo/vector-icons';
import { useTheme } from '@/constants/ThemeContext';
import { brand, typography, spacing, radii, status } from '@/constants/theme';
import {
  SectionHeader, EmptyState, AmbientBackground, LuminousButton, Block3D,
} from '@/components/ui';
import { useAppStore } from '@/store/useAppStore';
import { classTaskLinkService } from '@/services/classTaskLinkService';
import { formatDueDate, daysUntil, formatLocalDate } from '@/lib/timeUtils';
import { sortTasks, getSmartDateLabel, isTaskOverdue } from '@/lib/taskUtils';
import type { Task, TaskCategory, TaskPriority } from '@/types';

export interface TaskCategoryItem {
  key: TaskCategory | 'all';
  label: string;
  iconName: keyof typeof Feather.glyphMap;
}

const CATEGORIES: TaskCategoryItem[] = [
  { key: 'all', label: 'All', iconName: 'layers' },
  { key: 'assignment', label: 'Assignment', iconName: 'file-text' },
  { key: 'lab', label: 'Lab Work', iconName: 'activity' },
  { key: 'study', label: 'Study', iconName: 'book-open' },
  { key: 'personal', label: 'Personal', iconName: 'user' },
  { key: 'reminder', label: 'Reminder', iconName: 'bell' },
];

const PRIORITY_COLORS: Record<TaskPriority, string> = {
  urgent: status.danger,
  high: '#F97316',
  medium: status.watch,
  low: status.safe,
};

export default function TasksScreen() {
  const { colors, isDark } = useTheme();
  const { tasks, subjects, toggleTask, addTask, updateTask, deleteTask: storeDeleteTask } = useAppStore();
  const [filter, setFilter] = useState<TaskCategory | 'all'>('all');
  const [showModal, setShowModal] = useState(false);
  const [editingTask, setEditingTask] = useState<Task | null>(null);

  const deleteTask = (taskId: string) => {
    classTaskLinkService.deleteTask(taskId);
    storeDeleteTask(taskId);
  };

  const handleOpenAdd = () => {
    setEditingTask(null);
    setShowModal(true);
  };

  const handleOpenEdit = (task: Task) => {
    setEditingTask(task);
    setShowModal(true);
  };

  const filteredTasks = tasks.filter(t => {
    if (filter === 'all') return true;
    return t.category === filter;
  });

  const pendingTasks = sortTasks(filteredTasks.filter(t => !t.isCompleted && t.status !== 'completed'));
  const completedTasks = filteredTasks.filter(t => t.isCompleted || t.status === 'completed');

  return (
    <SafeAreaView style={styles.container} edges={['top']}>
      {/* Subtle atmospheric background orbs */}
      <AmbientBackground forceDark />

      {/* ─── Header ─────────────────────────────── */}
      <View style={styles.header}>
        <Text style={[styles.title, { color: isDark ? '#FFFFFF' : colors.text }]}>Tasks</Text>
        <View style={styles.headerActionCol}>
          <LuminousButton
            title="+ Add Task"
            onPress={handleOpenAdd}
            size="small"
            showArrow={false}
          />
        </View>
      </View>

      {/* ─── Category Filter ─────────────────────── */}
      <View style={styles.filterWrapper}>
        <ScrollView
          horizontal
          showsHorizontalScrollIndicator={false}
          contentContainerStyle={styles.filterRow}
        >
          {CATEGORIES.map((cat) => {
            const isSelected = filter === cat.key;
            return (
              <Pressable
                key={cat.key}
                onPress={() => setFilter(cat.key)}
                accessibilityRole="button"
                accessibilityLabel={`Filter by ${cat.label}`}
                style={({ pressed }) => [
                  styles.filterPill,
                  {
                    backgroundColor: isSelected
                      ? isDark
                        ? 'rgba(0, 229, 255, 0.16)'
                        : 'rgba(0, 229, 255, 0.12)'
                      : isDark
                      ? 'rgba(10, 16, 28, 0.72)'
                      : 'rgba(255, 255, 255, 0.52)',
                    borderColor: isSelected
                      ? '#00E5FF'
                      : isDark
                      ? 'rgba(255, 255, 255, 0.10)'
                      : 'rgba(255, 255, 255, 0.72)',
                  },
                  Platform.OS === 'web' &&
                    ({
                      backdropFilter: 'blur(16px) saturate(180%)',
                      WebkitBackdropFilter: 'blur(16px) saturate(180%)',
                      boxShadow: isSelected
                        ? (isDark
                            ? '0 4px 14px rgba(0, 229, 255, 0.35), inset 0 1px 0 rgba(255, 255, 255, 0.25)'
                            : '0 4px 12px rgba(0, 229, 255, 0.2), inset 0 1px 0 rgba(255, 255, 255, 1)')
                        : 'none',
                    } as any),
                  pressed && { opacity: 0.85, transform: [{ scale: 0.96 }] },
                ]}
              >
                <Feather
                  name={cat.iconName}
                  size={13}
                  color={isSelected ? '#00E5FF' : isDark ? '#94A3B8' : '#64748B'}
                />
                <Text
                  style={[
                    styles.filterLabel,
                    {
                      color: isSelected ? '#00E5FF' : colors.textSecondary,
                      fontWeight: isSelected ? '700' : '500',
                    },
                  ]}
                >
                  {cat.label}
                </Text>
              </Pressable>
            );
          })}
        </ScrollView>
      </View>

      {/* ─── Task List ───────────────────────────── */}
      <ScrollView
        style={styles.content}
        contentContainerStyle={styles.contentContainer}
        showsVerticalScrollIndicator={false}
      >
        {pendingTasks.length === 0 && completedTasks.length === 0 ? (
          <EmptyState
            icon={<Feather name="check-circle" size={32} color="#00E5FF" />}
            title="No deadlines chasing you. Nice."
            subtitle="Add a task to get started"
          />
        ) : (
          <>
            {pendingTasks.length > 0 && (
              <>
                <SectionHeader title="PENDING" subtitle={`${pendingTasks.length} tasks`} />
                <View style={styles.taskList}>
                  {pendingTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      subjects={subjects}
                      colors={colors}
                      isDark={isDark}
                      onToggle={() => toggleTask(task.id)}
                      onDelete={() => deleteTask(task.id)}
                      onEdit={() => handleOpenEdit(task)}
                    />
                  ))}
                </View>
              </>
            )}

            {completedTasks.length > 0 && (
              <>
                <SectionHeader title="COMPLETED" subtitle={`${completedTasks.length} tasks`} />
                <View style={styles.taskList}>
                  {completedTasks.map((task) => (
                    <TaskRow
                      key={task.id}
                      task={task}
                      subjects={subjects}
                      colors={colors}
                      isDark={isDark}
                      onToggle={() => toggleTask(task.id)}
                      onDelete={() => deleteTask(task.id)}
                      onEdit={() => handleOpenEdit(task)}
                    />
                  ))}
                </View>
              </>
            )}
          </>
        )}
      </ScrollView>

      {/* ─── Task Modal (Add & Edit) ─────────────── */}
      <TaskModal
        visible={showModal}
        taskToEdit={editingTask}
        onClose={() => {
          setShowModal(false);
          setEditingTask(null);
        }}
        onAdd={addTask}
        onUpdate={updateTask}
        onDelete={deleteTask}
        subjects={subjects}
        colors={colors}
        isDark={isDark}
      />
    </SafeAreaView>
  );
}

// ─── Task Row ───────────────────────────────────────────────────

function TaskRow({
  task,
  subjects,
  colors,
  isDark,
  onToggle,
  onDelete,
  onEdit,
}: {
  task: Task;
  subjects: any[];
  colors: any;
  isDark: boolean;
  onToggle: () => void;
  onDelete: () => void;
  onEdit?: () => void;
}) {
  const subject = subjects.find((s: any) => s.id === task.subjectId);
  const isOverdue = isTaskOverdue(task);
  const smartLabel = getSmartDateLabel(task);

  return (
    <Pressable
      onPress={onEdit}
      style={({ pressed }) => [
        styles.taskRow,
        pressed && { opacity: 0.9, transform: [{ scale: 0.99 }] },
      ]}
    >
      <View
        style={[
          styles.taskCard,
          {
            backgroundColor: task.isCompleted
              ? isDark
                ? 'rgba(16, 17, 24, 0.35)'
                : 'rgba(255, 255, 255, 0.38)'
              : isDark
                ? 'rgba(22, 23, 34, 0.46)'
                : 'rgba(255, 255, 255, 0.52)',
            borderColor: task.isCompleted
              ? isDark
                ? 'rgba(255, 255, 255, 0.05)'
                : 'rgba(15, 23, 42, 0.05)'
              : isDark
                ? 'rgba(255, 255, 255, 0.10)'
                : 'rgba(255, 255, 255, 0.75)',
            opacity: task.isCompleted ? 0.55 : 1,
            position: 'relative',
          },
          Platform.OS === 'web' &&
            ({
              backdropFilter: 'blur(16px) saturate(180%)',
              WebkitBackdropFilter: 'blur(16px) saturate(180%)',
              boxShadow: task.isCompleted
                ? 'none'
                : isDark
                  ? '0 6px 20px rgba(0,0,0,0.35), inset 0 1px 0 rgba(255,255,255,0.10)'
                  : '0 6px 18px rgba(15, 23, 42, 0.04), inset 0 1px 0.5px rgba(255,255,255,0.92)',
            } as any),
        ]}
      >
        {/* Specular highlight */}
        {!task.isCompleted && (
          <View
            pointerEvents="none"
            style={[
              styles.cardSpecular,
              {
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.12)'
                  : 'rgba(255, 255, 255, 0.90)',
              },
            ]}
          />
        )}
        {/* Checkbox */}
        <Pressable
          hitSlop={8}
          onPress={(e) => {
            e.stopPropagation?.();
            onToggle();
          }}
          style={[
            styles.checkbox,
            {
              borderColor: task.isCompleted
                ? status.safe
                : PRIORITY_COLORS[task.priority],
              backgroundColor: task.isCompleted ? status.safe : 'transparent',
            },
          ]}
        >
          {task.isCompleted && <Feather name="check" size={12} color="#FFFFFF" />}
        </Pressable>

        {/* Content */}
        <View style={styles.taskContent}>
          <Text
            style={[
              styles.taskTitle,
              {
                color: task.isCompleted ? colors.textTertiary : colors.text,
                textDecorationLine: task.isCompleted ? 'line-through' : 'none',
              },
            ]}
            numberOfLines={1}
          >
            {task.title}
          </Text>
          <View style={styles.taskMetaRow}>
            {subject && (
              <View style={styles.taskSubject}>
                <View style={[styles.taskSubjectDot, { backgroundColor: subject.color }]} />
                <Text style={[styles.taskMetaText, { color: colors.textTertiary }]}>
                  {subject.shortName}
                </Text>
              </View>
            )}
            {smartLabel && (
              <Text
                style={[
                  styles.taskMetaText,
                  {
                    color: isOverdue
                      ? status.danger
                      : smartLabel === 'Due today' || smartLabel === 'Due tomorrow'
                        ? status.watch
                        : colors.textTertiary,
                    fontWeight: isOverdue || smartLabel === 'Due today' ? '600' : '400',
                  },
                ]}
              >
                {smartLabel}{task.dueTime ? ` · ${task.dueTime}` : ''}
              </Text>
            )}
            {task.estimatedMinutes ? (
              <Text style={[styles.taskMetaText, { color: colors.textTertiary }]}>
                ~{task.estimatedMinutes}m
              </Text>
            ) : null}
          </View>
        </View>

        {/* Actions & Priority indicator */}
        <View style={styles.cardRightActions}>
          {!task.isCompleted && (
            <View
              style={[
                styles.priorityDot,
                { backgroundColor: PRIORITY_COLORS[task.priority] },
              ]}
            />
          )}
          <Pressable
            hitSlop={8}
            onPress={(e) => {
              e.stopPropagation?.();
              onDelete();
            }}
            style={styles.deleteBtn}
            accessibilityLabel="Delete task"
          >
            <Ionicons name="trash-outline" size={16} color={colors.textTertiary} />
          </Pressable>
        </View>
      </View>
    </Pressable>
  );
}

// ─── Task Modal (Add & Edit) ────────────────────────────────────

function TaskModal({
  visible,
  taskToEdit,
  onClose,
  onAdd,
  onUpdate,
  onDelete,
  subjects,
  colors,
  isDark,
}: {
  visible: boolean;
  taskToEdit?: Task | null;
  onClose: () => void;
  onAdd: (task: any) => void;
  onUpdate?: (id: string, updates: Partial<Task>) => void;
  onDelete?: (id: string) => void;
  subjects: any[];
  colors: any;
  isDark: boolean;
}) {
  const [title, setTitle] = useState('');
  const [category, setCategory] = useState<TaskCategory>('assignment');
  const [selectedSubject, setSelectedSubject] = useState<string | undefined>(undefined);
  const [priority, setPriority] = useState<TaskPriority>('medium');
  const [dueDate, setDueDate] = useState('');
  const [estimatedMinutes, setEstimatedMinutes] = useState('');

  useEffect(() => {
    if (visible && taskToEdit) {
      setTitle(taskToEdit.title || '');
      setCategory(taskToEdit.category || 'assignment');
      setSelectedSubject(taskToEdit.subjectId);
      setPriority(taskToEdit.priority || 'medium');
      setDueDate(taskToEdit.dueDate || '');
      setEstimatedMinutes(taskToEdit.estimatedMinutes ? String(taskToEdit.estimatedMinutes) : '');
    } else if (visible && !taskToEdit) {
      setTitle('');
      setCategory('assignment');
      setSelectedSubject(undefined);
      setPriority('medium');
      setDueDate(formatLocalDate(new Date(Date.now() + 86400000)));
      setEstimatedMinutes('30');
    }
  }, [visible, taskToEdit]);

  const handleSave = () => {
    if (!title.trim()) return;
    const est = estimatedMinutes ? parseInt(estimatedMinutes, 10) : undefined;
    const validEst = isNaN(est as number) ? undefined : est;

    if (taskToEdit && onUpdate) {
      onUpdate(taskToEdit.id, {
        title: title.trim(),
        category,
        subjectId: selectedSubject,
        priority,
        dueDate: dueDate.trim() || undefined,
        estimatedMinutes: validEst,
      });
    } else {
      onAdd({
        title: title.trim(),
        category,
        subjectId: selectedSubject,
        priority,
        isCompleted: false,
        dueDate: dueDate.trim() || formatLocalDate(new Date(Date.now() + 86400000)),
        estimatedMinutes: validEst,
      });
    }
    onClose();
  };

  const handleDelete = () => {
    if (taskToEdit && onDelete) {
      onDelete(taskToEdit.id);
      onClose();
    }
  };

  return (
    <Modal visible={visible} animationType="slide" transparent>
      <View
        style={[
          styles.modalOverlay,
          Platform.OS === 'web' &&
            ({
              backdropFilter: 'blur(20px)',
              WebkitBackdropFilter: 'blur(20px)',
            } as any),
        ]}
      >
        <View
          style={[
            styles.modalContent,
            {
              backgroundColor: isDark
                ? 'rgba(18, 19, 28, 0.88)'
                : 'rgba(255, 255, 255, 0.94)',
              borderColor: isDark
                ? 'rgba(255, 255, 255, 0.16)'
                : 'rgba(255, 255, 255, 0.92)',
              position: 'relative',
            },
            Platform.OS === 'web' &&
              ({
                backdropFilter: 'blur(32px) saturate(190%)',
                WebkitBackdropFilter: 'blur(32px) saturate(190%)',
                boxShadow: isDark
                  ? '0 -16px 48px rgba(0, 0, 0, 0.75), inset 0 1.5px 1px rgba(255, 255, 255, 0.24)'
                  : '0 -16px 48px rgba(15, 23, 42, 0.12), inset 0 1.5px 1px rgba(255, 255, 255, 1)',
              } as any),
          ]}
        >
          {/* Top Specular Rim */}
          <View
            pointerEvents="none"
            style={[
              styles.cardSpecular,
              {
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.25)'
                  : 'rgba(255, 255, 255, 0.98)',
              },
            ]}
          />
          {/* Drag handle */}
          <View
            style={[
              styles.dragHandle,
              {
                backgroundColor: isDark
                  ? 'rgba(255, 255, 255, 0.20)'
                  : 'rgba(15, 23, 42, 0.15)',
              },
            ]}
          />

          <ScrollView showsVerticalScrollIndicator={false}>
            <Text style={[styles.modalTitle, { color: colors.text }]}>
              {taskToEdit ? 'Edit Task' : 'Add Task'}
            </Text>

            {/* Title input */}
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark
                    ? 'rgba(30, 32, 48, 0.8)'
                    : 'rgba(241, 243, 250, 0.85)',
                  color: colors.text,
                  borderColor: colors.border,
                },
              ]}
              placeholder="Task title..."
              placeholderTextColor={colors.textTertiary}
              value={title}
              onChangeText={setTitle}
              autoFocus={!taskToEdit}
            />

            {/* Category */}
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Category</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
              {CATEGORIES.filter(c => c.key !== 'all').map((cat) => {
                const isSelected = category === cat.key;
                return (
                  <Pressable
                    key={cat.key}
                    onPress={() => setCategory(cat.key as TaskCategory)}
                    style={[
                      styles.catPill,
                      {
                        backgroundColor: isSelected
                          ? isDark
                            ? 'rgba(0, 229, 255, 0.18)'
                            : 'rgba(0, 229, 255, 0.12)'
                          : isDark
                            ? 'rgba(30, 32, 48, 0.7)'
                            : 'rgba(241, 243, 250, 0.8)',
                        borderColor: isSelected ? '#00E5FF' : colors.border,
                      },
                    ]}
                  >
                    <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                      <Feather
                        name={cat.iconName}
                        size={12}
                        color={isSelected ? '#00E5FF' : colors.textSecondary}
                      />
                      <Text
                        style={{
                          color: isSelected ? (isDark ? '#FFFFFF' : '#00E5FF') : colors.textSecondary,
                          fontSize: 12,
                          fontWeight: '600',
                        }}
                      >
                        {cat.label}
                      </Text>
                    </View>
                  </Pressable>
                );
              })}
            </ScrollView>

            {/* Subject */}
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Subject</Text>
            <ScrollView horizontal showsHorizontalScrollIndicator={false} style={styles.categoryRow}>
              <Pressable
                onPress={() => setSelectedSubject(undefined)}
                style={[
                  styles.catPill,
                  {
                    backgroundColor:
                      !selectedSubject
                        ? brand.violet
                        : isDark
                          ? 'rgba(30, 32, 48, 0.7)'
                          : 'rgba(241, 243, 250, 0.8)',
                    borderColor: !selectedSubject ? brand.violet : colors.border,
                  },
                ]}
              >
                <Text
                  style={{
                    color: !selectedSubject ? '#fff' : colors.textSecondary,
                    fontSize: 12,
                    fontWeight: '600',
                  }}
                >
                  None
                </Text>
              </Pressable>
              {subjects.map((sub: any) => (
                <Pressable
                  key={sub.id}
                  onPress={() => setSelectedSubject(sub.id)}
                  style={[
                    styles.catPill,
                    {
                      backgroundColor:
                        selectedSubject === sub.id
                          ? sub.color
                          : isDark
                            ? 'rgba(30, 32, 48, 0.7)'
                            : 'rgba(241, 243, 250, 0.8)',
                      borderColor:
                        selectedSubject === sub.id ? sub.color : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: selectedSubject === sub.id ? '#fff' : colors.textSecondary,
                      fontSize: 12,
                      fontWeight: '600',
                    }}
                  >
                    {sub.shortName}
                  </Text>
                </Pressable>
              ))}
            </ScrollView>

            {/* Priority */}
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Priority</Text>
            <View style={styles.priorityRow}>
              {(['low', 'medium', 'high', 'urgent'] as TaskPriority[]).map((p) => (
                <Pressable
                  key={p}
                  onPress={() => setPriority(p)}
                  style={[
                    styles.priorityPill,
                    {
                      backgroundColor:
                        priority === p
                          ? PRIORITY_COLORS[p]
                          : isDark
                            ? 'rgba(30, 32, 48, 0.7)'
                            : 'rgba(241, 243, 250, 0.8)',
                      borderColor: priority === p ? PRIORITY_COLORS[p] : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: priority === p ? '#fff' : colors.textSecondary,
                      fontSize: 12,
                      fontWeight: '600',
                      textTransform: 'capitalize',
                    }}
                  >
                    {p}
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Due Date */}
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Due Date</Text>
            <View style={styles.quickChipsRow}>
              {[
                { label: 'Today', value: formatLocalDate(new Date()) },
                { label: 'Tomorrow', value: formatLocalDate(new Date(Date.now() + 86400000)) },
                { label: '3 Days', value: formatLocalDate(new Date(Date.now() + 3 * 86400000)) },
                { label: '1 Week', value: formatLocalDate(new Date(Date.now() + 7 * 86400000)) },
              ].map((chip) => (
                <Pressable
                  key={chip.label}
                  onPress={() => setDueDate(chip.value)}
                  style={[
                    styles.smallChip,
                    {
                      backgroundColor: dueDate === chip.value
                        ? '#00E5FF'
                        : isDark ? 'rgba(30, 32, 48, 0.7)' : 'rgba(241, 243, 250, 0.8)',
                      borderColor: dueDate === chip.value ? '#00E5FF' : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: dueDate === chip.value ? '#05070B' : colors.textSecondary,
                      fontSize: 11,
                      fontWeight: dueDate === chip.value ? '700' : '600',
                    }}
                  >
                    {chip.label}
                  </Text>
                </Pressable>
              ))}
            </View>
            <TextInput
              style={[
                styles.input,
                {
                  backgroundColor: isDark
                    ? 'rgba(30, 32, 48, 0.8)'
                    : 'rgba(241, 243, 250, 0.85)',
                  color: colors.text,
                  borderColor: colors.border,
                  marginTop: 6,
                },
              ]}
              placeholder="YYYY-MM-DD"
              placeholderTextColor={colors.textTertiary}
              value={dueDate}
              onChangeText={setDueDate}
            />

            {/* Estimated Duration */}
            <Text style={[styles.fieldLabel, { color: colors.textSecondary }]}>Duration (Minutes)</Text>
            <View style={styles.quickChipsRow}>
              {['15', '30', '45', '60', '90'].map((mins) => (
                <Pressable
                  key={mins}
                  onPress={() => setEstimatedMinutes(mins)}
                  style={[
                    styles.smallChip,
                    {
                      backgroundColor: estimatedMinutes === mins
                        ? '#00E5FF'
                        : isDark ? 'rgba(30, 32, 48, 0.7)' : 'rgba(241, 243, 250, 0.8)',
                      borderColor: estimatedMinutes === mins ? '#00E5FF' : colors.border,
                    },
                  ]}
                >
                  <Text
                    style={{
                      color: estimatedMinutes === mins ? '#05070B' : colors.textSecondary,
                      fontSize: 11,
                      fontWeight: estimatedMinutes === mins ? '700' : '600',
                    }}
                  >
                    {mins}m
                  </Text>
                </Pressable>
              ))}
            </View>

            {/* Actions */}
            <View style={styles.modalActions}>
              {taskToEdit && (
                <Pressable
                  onPress={handleDelete}
                  style={[
                    styles.modalBtn,
                    {
                      backgroundColor: 'rgba(239, 68, 68, 0.15)',
                      borderWidth: 1,
                      borderColor: status.danger,
                    },
                  ]}
                >
                  <Text style={[styles.modalBtnText, { color: status.danger }]}>Delete</Text>
                </Pressable>
              )}
              <Pressable
                onPress={onClose}
                style={[
                  styles.modalBtn,
                  {
                    backgroundColor: isDark
                      ? 'rgba(35, 37, 52, 0.7)'
                      : 'rgba(238, 240, 248, 0.85)',
                    borderWidth: 1,
                    borderColor: colors.border,
                  },
                ]}
              >
                <Text style={[styles.modalBtnText, { color: colors.textSecondary }]}>Cancel</Text>
              </Pressable>
              <View style={{ flex: 1.2 }}>
                <LuminousButton
                  title={taskToEdit ? 'Save Changes' : 'Add Task'}
                  onPress={handleSave}
                  size="medium"
                  showArrow={false}
                />
              </View>
            </View>
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
}

// ─── Styles ─────────────────────────────────────────────────────

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: '#05070B' },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingTop: spacing.md,
    paddingBottom: spacing.xs,
  },
  headerActionCol: {
    minWidth: 110,
    alignItems: 'flex-end',
  },
  title: {
    fontSize: typography.sizes.xl,
    fontWeight: typography.weights.bold,
    letterSpacing: typography.letterSpacing.tight,
  },
  addBtn: {
    paddingHorizontal: spacing.md + 2,
    paddingVertical: 7,
    borderRadius: radii.full,
  },
  addBtnText: {
    color: '#fff',
    fontSize: typography.sizes.xs + 1,
    fontWeight: typography.weights.bold,
  },

  // Filter
  filterWrapper: {
    paddingVertical: spacing.xs,
  },
  filterRow: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.xs,
    gap: spacing.sm,
  },
  filterPill: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.md,
    paddingVertical: 6,
    borderRadius: radii.full,
    borderWidth: 1,
    gap: 5,
  },
  filterEmoji: { fontSize: 13 },
  filterLabel: {
    fontSize: typography.sizes.xs + 1,
    fontWeight: typography.weights.semibold,
  },

  content: { flex: 1 },
  contentContainer: { paddingBottom: 110 },

  // Task list
  taskList: {
    paddingHorizontal: spacing.base,
    gap: spacing.sm,
  },
  taskRow: {},
  taskCard: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: radii.xl,
    borderWidth: 1,
    gap: spacing.md,
    overflow: 'hidden',
  },
  cardSpecular: {
    position: 'absolute',
    top: 0,
    left: 16,
    right: 16,
    height: 1,
    opacity: 0.85,
    borderRadius: 1,
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  checkmark: {
    color: '#fff',
    fontSize: 11,
    fontWeight: '700',
  },
  taskContent: { flex: 1 },
  taskTitle: {
    fontSize: typography.sizes.sm,
    fontWeight: typography.weights.semibold,
  },
  taskMetaRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
    marginTop: 3,
  },
  taskSubject: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  taskSubjectDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
  },
  taskMetaText: {
    fontSize: typography.sizes.xs,
  },
  priorityDot: {
    width: 7,
    height: 7,
    borderRadius: 3.5,
  },

  // Modal (Glass Bottom Sheet)
  modalOverlay: {
    flex: 1,
    justifyContent: 'flex-end',
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
  },
  modalContent: {
    borderTopLeftRadius: radii['3xl'],
    borderTopRightRadius: radii['3xl'],
    borderTopWidth: 1,
    borderLeftWidth: 1,
    borderRightWidth: 1,
    padding: spacing.xl,
    paddingBottom: Platform.OS === 'ios' ? 44 : spacing.xl,
    maxHeight: '82%',
  },
  dragHandle: {
    width: 40,
    height: 4,
    borderRadius: 2,
    alignSelf: 'center',
    marginBottom: spacing.base,
  },
  modalTitle: {
    fontSize: typography.sizes.lg,
    fontWeight: typography.weights.bold,
    marginBottom: spacing.base,
    letterSpacing: -0.3,
  },
  input: {
    paddingHorizontal: spacing.base,
    paddingVertical: spacing.md,
    borderRadius: radii.lg,
    fontSize: typography.sizes.base,
    borderWidth: 1,
    marginBottom: spacing.base,
  },
  fieldLabel: {
    fontSize: typography.sizes.xs + 1,
    fontWeight: typography.weights.bold,
    letterSpacing: 0.5,
    textTransform: 'uppercase',
    marginBottom: spacing.xs + 2,
  },
  categoryRow: {
    marginBottom: spacing.base,
    flexGrow: 0,
  },
  catPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
    marginRight: spacing.sm,
  },
  priorityRow: {
    flexDirection: 'row',
    gap: spacing.sm,
    marginBottom: spacing.lg,
  },
  priorityPill: {
    paddingHorizontal: spacing.md,
    paddingVertical: 7,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  cardRightActions: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: spacing.sm,
  },
  deleteBtn: {
    padding: 6,
    borderRadius: radii.full,
    alignItems: 'center',
    justifyContent: 'center',
  },
  quickChipsRow: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.xs,
    marginBottom: spacing.xs,
  },
  smallChip: {
    paddingHorizontal: spacing.sm + 2,
    paddingVertical: 5,
    borderRadius: radii.full,
    borderWidth: 1,
  },
  modalActions: {
    flexDirection: 'row',
    gap: spacing.md,
    marginTop: spacing.sm,
  },
  modalBtn: {
    flex: 1,
    paddingVertical: spacing.md,
    borderRadius: radii.xl,
    alignItems: 'center',
  },
  modalBtnText: {
    fontSize: typography.sizes.sm + 1,
    fontWeight: typography.weights.bold,
  },
});
