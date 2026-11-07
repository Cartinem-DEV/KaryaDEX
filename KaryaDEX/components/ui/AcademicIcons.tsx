/**
 * BunkMatKar — Academic Vector Iconography
 *
 * Replaces all emoji-based UI with crisp, professional vector icons.
 * Powered by @expo/vector-icons (Ionicons & Feather) for pixel-perfect alignment,
 * consistent 1.8-2.0 stroke weight, accessibility labels, and themed tinting.
 */

import React from 'react';
import { Ionicons, Feather, MaterialCommunityIcons } from '@expo/vector-icons';

export interface AcademicIconProps {
  size?: number;
  color?: string;
}

// ─── Header & Nav ────────────────────────────────────────────────
export const CalendarIcon = ({ size = 16, color = '#94A3B8' }: AcademicIconProps) => (
  <Ionicons name="calendar-outline" size={size} color={color} />
);

export const TimeIcon = ({ size = 16, color = '#94A3B8' }: AcademicIconProps) => (
  <Ionicons name="time-outline" size={size} color={color} />
);

export const RoomIcon = ({ size = 16, color = '#94A3B8' }: AcademicIconProps) => (
  <Ionicons name="location-outline" size={size} color={color} />
);

export const CloseIcon = ({ size = 20, color = '#94A3B8' }: AcademicIconProps) => (
  <Ionicons name="close" size={size} color={color} />
);

export const ChevronRightIcon = ({ size = 18, color = '#94A3B8' }: AcademicIconProps) => (
  <Ionicons name="chevron-forward" size={size} color={color} />
);

export const ChevronDownIcon = ({ size = 18, color = '#94A3B8' }: AcademicIconProps) => (
  <Ionicons name="chevron-down" size={size} color={color} />
);

export const SearchIcon = ({ size = 18, color = '#94A3B8' }: AcademicIconProps) => (
  <Ionicons name="search-outline" size={size} color={color} />
);

// ─── Attendance Status ───────────────────────────────────────────
export const PresentIcon = ({ size = 20, color = '#10B981' }: AcademicIconProps) => (
  <Ionicons name="checkmark-circle" size={size} color={color} />
);

export const AbsentIcon = ({ size = 20, color = '#EF4444' }: AcademicIconProps) => (
  <Ionicons name="close-circle" size={size} color={color} />
);

export const LateIcon = ({ size = 20, color = '#F59E0B' }: AcademicIconProps) => (
  <Ionicons name="time" size={size} color={color} />
);

export const CancelledIcon = ({ size = 20, color = '#64748B' }: AcademicIconProps) => (
  <Ionicons name="ban" size={size} color={color} />
);

export const NotSetIcon = ({ size = 20, color = '#94A3B8' }: AcademicIconProps) => (
  <Ionicons name="remove-circle-outline" size={size} color={color} />
);

// ─── Revision & Topics ───────────────────────────────────────────
export const RevisionCycleIcon = ({ size = 16, color = '#8B5CF6' }: AcademicIconProps) => (
  <Ionicons name="sync-outline" size={size} color={color} />
);

export const BacklogAlertIcon = ({ size = 18, color = '#F59E0B' }: AcademicIconProps) => (
  <Ionicons name="alert-circle-outline" size={size} color={color} />
);

export const TopicBookIcon = ({ size = 18, color = '#8B5CF6' }: AcademicIconProps) => (
  <Ionicons name="book-outline" size={size} color={color} />
);

export const CheckSquareIcon = ({ size = 18, color = '#8B5CF6' }: AcademicIconProps) => (
  <Ionicons name="checkbox" size={size} color={color} />
);

export const EmptySquareIcon = ({ size = 18, color = '#64748B' }: AcademicIconProps) => (
  <Ionicons name="square-outline" size={size} color={color} />
);

// ─── Notes & AI ──────────────────────────────────────────────────
export const StudentJournalIcon = ({ size = 18, color = '#8B5CF6' }: AcademicIconProps) => (
  <Ionicons name="document-text-outline" size={size} color={color} />
);

export const TeacherNotesIcon = ({ size = 18, color = '#8B5CF6' }: AcademicIconProps) => (
  <Ionicons name="megaphone-outline" size={size} color={color} />
);

export const SparklesIcon = ({ size = 18, color = '#8B5CF6' }: AcademicIconProps) => (
  <Ionicons name="sparkles" size={size} color={color} />
);

export const NotebookIcon = ({ size = 18, color = '#8B5CF6' }: AcademicIconProps) => (
  <Ionicons name="journal-outline" size={size} color={color} />
);

// ─── Resources ───────────────────────────────────────────────────
export const AttachFileIcon = ({ size = 20, color = '#8B5CF6' }: AcademicIconProps) => (
  <Ionicons name="attach-outline" size={size} color={color} />
);

export const CameraScanIcon = ({ size = 20, color = '#8B5CF6' }: AcademicIconProps) => (
  <Ionicons name="camera-outline" size={size} color={color} />
);

export const GalleryPhotosIcon = ({ size = 20, color = '#8B5CF6' }: AcademicIconProps) => (
  <Ionicons name="images-outline" size={size} color={color} />
);

export const PdfDocumentIcon = ({ size = 20, color = '#EF4444' }: AcademicIconProps) => (
  <Ionicons name="document-outline" size={size} color={color} />
);

export const PptDocumentIcon = ({ size = 20, color = '#F59E0B' }: AcademicIconProps) => (
  <Ionicons name="easel-outline" size={size} color={color} />
);

export const LinkWebIcon = ({ size = 20, color = '#3B82F6' }: AcademicIconProps) => (
  <Ionicons name="link-outline" size={size} color={color} />
);

export const YouTubeIcon = ({ size = 20, color = '#FF0000' }: AcademicIconProps) => (
  <Ionicons name="logo-youtube" size={size} color={color} />
);

export const GenericFileIcon = ({ size = 20, color = '#94A3B8' }: AcademicIconProps) => (
  <Ionicons name="folder-outline" size={size} color={color} />
);

export const TrashIcon = ({ size = 18, color = '#EF4444' }: AcademicIconProps) => (
  <Ionicons name="trash-outline" size={size} color={color} />
);

export const OptionsDotsIcon = ({ size = 18, color = '#94A3B8' }: AcademicIconProps) => (
  <Ionicons name="ellipsis-vertical" size={size} color={color} />
);

// ─── Tasks & Actions ─────────────────────────────────────────────
export const TaskClipboardIcon = ({ size = 18, color = '#8B5CF6' }: AcademicIconProps) => (
  <Ionicons name="clipboard-outline" size={size} color={color} />
);

export const AddIcon = ({ size = 18, color = '#FFFFFF' }: AcademicIconProps) => (
  <Ionicons name="add" size={size} color={color} />
);

export const CheckmarkIcon = ({ size = 18, color = '#FFFFFF' }: AcademicIconProps) => (
  <Ionicons name="checkmark" size={size} color={color} />
);

export const ExternalOpenIcon = ({ size = 16, color = '#8B5CF6' }: AcademicIconProps) => (
  <Feather name="external-link" size={size} color={color} />
);

export const StorageHardDriveIcon = ({ size = 18, color = '#8B5CF6' }: AcademicIconProps) => (
  <MaterialCommunityIcons name="harddisk" size={size} color={color} />
);

export const NotificationBellIcon = ({ size = 18, color = '#94A3B8' }: AcademicIconProps) => (
  <Ionicons name="notifications-outline" size={size} color={color} />
);

export const ArrowBackIcon = ({ size = 20, color = '#94A3B8' }: AcademicIconProps) => (
  <Ionicons name="arrow-back" size={size} color={color} />
);

export const SchoolIcon = ({ size = 20, color = '#8B5CF6' }: AcademicIconProps) => (
  <Ionicons name="school-outline" size={size} color={color} />
);

export const PersonIcon = ({ size = 20, color = '#8B5CF6' }: AcademicIconProps) => (
  <Ionicons name="person-outline" size={size} color={color} />
);

export const AlertTriangleIcon = ({ size = 20, color = '#F59E0B' }: AcademicIconProps) => (
  <Ionicons name="warning-outline" size={size} color={color} />
);

export const CheckCircleIcon = ({ size = 20, color = '#10B981' }: AcademicIconProps) => (
  <Ionicons name="checkmark-circle-outline" size={size} color={color} />
);
