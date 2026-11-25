/**
 * KaryaDEX — Mock Seed Data
 * 
 * Realistic college data for demo mode.
 * Example Institute of Technology, Semester 3.
 */

import type {
  User, College, Semester, Subject, Faculty,
  ClassSession, AttendanceRecord, Task, Exam, Mark, Lab,
  DayOfWeek, ClassType
} from '@/types';

// ─── College ────────────────────────────────────────────────────
export const mockCollege: College = {
  id: 'college-1',
  name: 'Example Institute of Technology',
  shortName: 'EIT',
};

// ─── Faculty ────────────────────────────────────────────────────
export const mockFaculty: Faculty[] = [
  { id: 'fac-1', name: 'Dr. Ananya Sharma', shortName: 'Dr. Sharma', department: 'Physics' },
  { id: 'fac-2', name: 'Prof. Rajesh Kumar', shortName: 'Prof. Kumar', department: 'Mathematics' },
  { id: 'fac-3', name: 'Dr. Priya Menon', shortName: 'Dr. Menon', department: 'Chemistry' },
  { id: 'fac-4', name: 'Prof. Vikram Desai', shortName: 'Prof. Desai', department: 'Computer Science' },
  { id: 'fac-5', name: 'Dr. Suresh Patil', shortName: 'Dr. Patil', department: 'Electrical Engineering' },
];

// ─── Semester ───────────────────────────────────────────────────
export const mockSemester: Semester = {
  id: 'sem-3',
  name: 'Semester 3',
  number: 3,
  startDate: '2026-08-01',
  endDate: '2026-12-15',
  collegeId: 'college-1',
};

// ─── Subjects with curated colors ───────────────────────────────
export const mockSubjects: Subject[] = [
  {
    id: 'sub-1',
    name: 'Engineering Physics',
    shortName: 'Physics',
    code: 'PHY201',
    color: '#6366F1', // Indigo
    semesterId: 'sem-3',
    facultyId: 'fac-1',
    room: '204',
    credits: 4,
  },
  {
    id: 'sub-2',
    name: 'Engineering Mathematics',
    shortName: 'Mathematics',
    code: 'MAT201',
    color: '#8B5CF6', // Violet
    semesterId: 'sem-3',
    facultyId: 'fac-2',
    room: '301',
    credits: 4,
  },
  {
    id: 'sub-3',
    name: 'Chemistry',
    shortName: 'Chemistry',
    code: 'CHE201',
    color: '#EC4899', // Pink
    semesterId: 'sem-3',
    facultyId: 'fac-3',
    room: '105',
    credits: 3,
  },
  {
    id: 'sub-4',
    name: 'Programming in C',
    shortName: 'Programming',
    code: 'CSE201',
    color: '#14B8A6', // Teal
    semesterId: 'sem-3',
    facultyId: 'fac-4',
    room: 'Lab 2',
    credits: 4,
  },
  {
    id: 'sub-5',
    name: 'Electrical Engineering',
    shortName: 'Electrical',
    code: 'EEE201',
    color: '#F59E0B', // Amber
    semesterId: 'sem-3',
    facultyId: 'fac-5',
    room: '402',
    credits: 3,
  },
];

// ─── Class Schedule (weekly recurring) ──────────────────────────
export const mockClassSessions: ClassSession[] = [
  // Monday
  { id: 'cs-1', subjectId: 'sub-1', dayOfWeek: 'monday', startTime: '09:00', endTime: '10:00', room: '204', type: 'lecture', semesterId: 'sem-3' },
  { id: 'cs-2', subjectId: 'sub-2', dayOfWeek: 'monday', startTime: '10:00', endTime: '11:00', room: '301', type: 'lecture', semesterId: 'sem-3' },
  { id: 'cs-3', subjectId: 'sub-3', dayOfWeek: 'monday', startTime: '11:00', endTime: '12:00', room: '105', type: 'lecture', semesterId: 'sem-3' },
  { id: 'cs-4', subjectId: 'sub-4', dayOfWeek: 'monday', startTime: '14:00', endTime: '16:00', room: 'Lab 2', type: 'lab', semesterId: 'sem-3' },

  // Tuesday
  { id: 'cs-5', subjectId: 'sub-5', dayOfWeek: 'tuesday', startTime: '09:00', endTime: '10:00', room: '402', type: 'lecture', semesterId: 'sem-3' },
  { id: 'cs-6', subjectId: 'sub-1', dayOfWeek: 'tuesday', startTime: '10:00', endTime: '11:00', room: '204', type: 'lecture', semesterId: 'sem-3' },
  { id: 'cs-7', subjectId: 'sub-2', dayOfWeek: 'tuesday', startTime: '11:00', endTime: '12:00', room: '301', type: 'tutorial', semesterId: 'sem-3' },
  { id: 'cs-8', subjectId: 'sub-3', dayOfWeek: 'tuesday', startTime: '14:00', endTime: '16:00', room: 'Lab 1', type: 'lab', semesterId: 'sem-3' },

  // Wednesday
  { id: 'cs-9', subjectId: 'sub-2', dayOfWeek: 'wednesday', startTime: '09:00', endTime: '10:00', room: '301', type: 'lecture', semesterId: 'sem-3' },
  { id: 'cs-10', subjectId: 'sub-4', dayOfWeek: 'wednesday', startTime: '10:00', endTime: '11:00', room: 'Lab 2', type: 'lecture', semesterId: 'sem-3' },
  { id: 'cs-11', subjectId: 'sub-5', dayOfWeek: 'wednesday', startTime: '11:00', endTime: '12:00', room: '402', type: 'lecture', semesterId: 'sem-3' },
  { id: 'cs-12', subjectId: 'sub-1', dayOfWeek: 'wednesday', startTime: '14:00', endTime: '15:00', room: '204', type: 'tutorial', semesterId: 'sem-3' },

  // Thursday
  { id: 'cs-13', subjectId: 'sub-3', dayOfWeek: 'thursday', startTime: '09:00', endTime: '10:00', room: '105', type: 'lecture', semesterId: 'sem-3' },
  { id: 'cs-14', subjectId: 'sub-5', dayOfWeek: 'thursday', startTime: '10:00', endTime: '11:00', room: '402', type: 'tutorial', semesterId: 'sem-3' },
  { id: 'cs-15', subjectId: 'sub-4', dayOfWeek: 'thursday', startTime: '11:00', endTime: '12:00', room: 'Lab 2', type: 'lecture', semesterId: 'sem-3' },
  { id: 'cs-16', subjectId: 'sub-2', dayOfWeek: 'thursday', startTime: '14:00', endTime: '15:00', room: '301', type: 'lecture', semesterId: 'sem-3' },

  // Friday
  { id: 'cs-17', subjectId: 'sub-1', dayOfWeek: 'friday', startTime: '09:00', endTime: '10:00', room: '204', type: 'lecture', semesterId: 'sem-3' },
  { id: 'cs-18', subjectId: 'sub-3', dayOfWeek: 'friday', startTime: '10:00', endTime: '11:00', room: '105', type: 'lecture', semesterId: 'sem-3' },
  { id: 'cs-19', subjectId: 'sub-5', dayOfWeek: 'friday', startTime: '11:00', endTime: '12:00', room: '402', type: 'lecture', semesterId: 'sem-3' },
  { id: 'cs-20', subjectId: 'sub-4', dayOfWeek: 'friday', startTime: '14:00', endTime: '16:00', room: 'Lab 2', type: 'lab', semesterId: 'sem-3' },

  // Saturday (half day)
  { id: 'cs-21', subjectId: 'sub-2', dayOfWeek: 'saturday', startTime: '09:00', endTime: '10:00', room: '301', type: 'lecture', semesterId: 'sem-3' },
  { id: 'cs-22', subjectId: 'sub-1', dayOfWeek: 'saturday', startTime: '10:00', endTime: '11:00', room: '204', type: 'lecture', semesterId: 'sem-3' },
];

// ─── Attendance Records (pre-seeded for realistic data) ─────────
function generateAttendanceRecords(): Record<string, { attended: number; total: number }> {
  return {
    'sub-1': { attended: 23, total: 28 },  // 82.1% — safe
    'sub-2': { attended: 27, total: 30 },  // 90.0% — safe
    'sub-3': { attended: 17, total: 23 },  // 73.9% — danger
    'sub-4': { attended: 19, total: 25 },  // 76.0% — watch
    'sub-5': { attended: 16, total: 23 },  // 69.6% — danger
  };
}

export const mockAttendanceData = generateAttendanceRecords();

// ─── Tasks ──────────────────────────────────────────────────────
export const mockTasks: Task[] = [
  {
    id: 'task-1',
    title: 'Physics Assignment 3',
    description: 'Solve problems from Chapter 5 - Wave Optics',
    category: 'assignment',
    subjectId: 'sub-1',
    dueDate: '2026-09-13',
    estimatedMinutes: 45,
    priority: 'high',
    isCompleted: false,
    createdAt: '2026-09-10',
  },
  {
    id: 'task-2',
    title: 'Math Tutorial Sheet',
    description: 'Complete Laplace Transform exercises',
    category: 'assignment',
    subjectId: 'sub-2',
    dueDate: '2026-09-15',
    estimatedMinutes: 60,
    priority: 'medium',
    isCompleted: false,
    createdAt: '2026-09-09',
  },
  {
    id: 'task-3',
    title: 'Chemistry Lab Report',
    description: 'Titration experiment write-up',
    category: 'lab',
    subjectId: 'sub-3',
    dueDate: '2026-09-14',
    estimatedMinutes: 90,
    priority: 'high',
    isCompleted: false,
    createdAt: '2026-09-08',
  },
  {
    id: 'task-4',
    title: 'C Programming: Linked Lists',
    description: 'Implement singly linked list with insert, delete, search',
    category: 'assignment',
    subjectId: 'sub-4',
    dueDate: '2026-09-16',
    estimatedMinutes: 120,
    priority: 'medium',
    isCompleted: false,
    createdAt: '2026-09-10',
  },
  {
    id: 'task-5',
    title: 'Revise Electromagnetic Induction',
    category: 'study',
    subjectId: 'sub-1',
    estimatedMinutes: 30,
    priority: 'low',
    isCompleted: true,
    completedAt: '2026-09-11',
    createdAt: '2026-09-09',
  },
  {
    id: 'task-6',
    title: 'Buy lab coat',
    category: 'personal',
    priority: 'low',
    isCompleted: false,
    createdAt: '2026-09-07',
  },
  {
    id: 'task-7',
    title: 'EE Circuit Analysis',
    description: 'Thevenin and Norton equivalent circuits',
    category: 'assignment',
    subjectId: 'sub-5',
    dueDate: '2026-09-17',
    estimatedMinutes: 45,
    priority: 'medium',
    isCompleted: false,
    createdAt: '2026-09-11',
  },
];

// ─── Exams ──────────────────────────────────────────────────────
export const mockExams: Exam[] = [
  {
    id: 'exam-1',
    subjectId: 'sub-1',
    name: 'Internal 1',
    type: 'internal',
    date: '2026-10-05',
    time: '10:00',
    room: 'Hall A',
    maxMarks: 30,
    weightage: 15,
    semesterId: 'sem-3',
  },
  {
    id: 'exam-2',
    subjectId: 'sub-2',
    name: 'Internal 1',
    type: 'internal',
    date: '2026-10-07',
    time: '10:00',
    room: 'Hall A',
    maxMarks: 30,
    weightage: 15,
    semesterId: 'sem-3',
  },
  {
    id: 'exam-3',
    subjectId: 'sub-3',
    name: 'Quiz 1',
    type: 'quiz',
    date: '2026-09-20',
    time: '11:00',
    room: '105',
    maxMarks: 15,
    weightage: 5,
    semesterId: 'sem-3',
  },
  {
    id: 'exam-4',
    subjectId: 'sub-4',
    name: 'Lab Practical',
    type: 'practical',
    date: '2026-10-12',
    time: '14:00',
    room: 'Lab 2',
    maxMarks: 50,
    weightage: 25,
    semesterId: 'sem-3',
  },
];

// ─── Marks ──────────────────────────────────────────────────────
export const mockMarks: Mark[] = [
  { id: 'mark-1', examId: 'exam-prev-1', subjectId: 'sub-1', obtained: 24, maxMarks: 30 },
  { id: 'mark-2', examId: 'exam-prev-2', subjectId: 'sub-2', obtained: 27, maxMarks: 30 },
  { id: 'mark-3', examId: 'exam-prev-3', subjectId: 'sub-3', obtained: 18, maxMarks: 30 },
];

// ─── Labs ───────────────────────────────────────────────────────
export const mockLabs: Lab[] = [
  { id: 'lab-1', title: 'Newton\'s Rings', subjectId: 'sub-1', isCompleted: true, labNumber: 1 },
  { id: 'lab-2', title: 'Diffraction Grating', subjectId: 'sub-1', isCompleted: true, labNumber: 2 },
  { id: 'lab-3', title: 'Laser Beam Divergence', subjectId: 'sub-1', isCompleted: false, dueDate: '2026-09-19', labNumber: 3 },
  { id: 'lab-4', title: 'Acid-Base Titration', subjectId: 'sub-3', isCompleted: true, labNumber: 1 },
  { id: 'lab-5', title: 'Redox Reactions', subjectId: 'sub-3', isCompleted: false, dueDate: '2026-09-14', labNumber: 2 },
  { id: 'lab-6', title: 'Array Operations', subjectId: 'sub-4', isCompleted: true, labNumber: 1 },
  { id: 'lab-7', title: 'String Manipulation', subjectId: 'sub-4', isCompleted: true, labNumber: 2 },
  { id: 'lab-8', title: 'Linked Lists', subjectId: 'sub-4', isCompleted: false, dueDate: '2026-09-16', labNumber: 3 },
];

// ─── User ───────────────────────────────────────────────────────
export const mockUser: User = {
  id: 'user-1',
  name: 'Saikat',
  email: 'saikat@example.com',
  collegeId: 'college-1',
  semesterId: 'sem-3',
  attendanceTarget: 75,
  createdAt: '2026-08-01',
};
