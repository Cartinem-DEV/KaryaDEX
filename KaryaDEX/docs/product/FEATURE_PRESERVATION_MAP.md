# BunkMatKar Feature Preservation Map: Non-Negotiable Core Architecture

## 1. Architectural Integrity Directive

The UI/UX and Onboarding Reimagination (Phase 13) strictly redesigns how students interact with and understand BunkMatKar. **Under no circumstances may underlying services, repositories, database schemas, sync mechanics, or security boundaries be disconnected, stubbed, or mocked.**

This document provides a comprehensive inventory of all system capabilities and specifies their preservation contracts.

---

## 2. Comprehensive Inventory & Preservation Contracts

```mermaid
graph TD
    UI[Redesigned UI / UX Layer]
    UI --> Stores[Zustand Reactive State Stores]
    Stores --> Services[Canonical Domain Services & Orchestrators]
    Services --> Repos[SQLite Repository Layer (Local First)]
    Services --> Cloud[Supabase Auth, Sync & RLS]
    Services --> AI[Authenticated AI Gateway (Banku & Shanky)]
    Services --> Storage[Local Sandboxed / Custom File Storage]
```

---

### 2.1 Persistence & Local Database Layer
| Component / Repository | Files | Invariants & Preservation Rules |
| :--- | :--- | :--- |
| **SQLite Schema & Migration Engine** | `database/schema.ts`, `database/DatabaseProvider.tsx` | All 14 SQLite tables (`students`, `colleges`, `semesters`, `subjects`, `timetable_slots`, `class_sessions`, `attendance_records`, `syllabus_units`, `topics`, `class_notes`, `subject_resources`, `tasks`, `exams`, `sync_queue`) remain authoritative. |
| **Subject & Academic Repositories** | `database/repositories/subjectRepository.ts`, `academicRepository.ts` | Complete CRUD for subjects, syllabus units, topics, and class sessions. Foreign key relations and cascaded deletes must not be broken. |
| **Attendance Repository** | `database/repositories/attendanceRepository.ts` | Records every class occurrence, timestamp, mark status (`attended`, `missed`, `cancelled`). |
| **Task Repository** | `database/repositories/taskRepository.ts` | Subtasks, priority, due date, recurring rules, and dependency graph persistence. |
| **Onboarding Repository** | `database/repositories/onboardingRepository.ts` | Progress checkpoints, draft serialization, completed status flag. Prevents data wiping on app restart. |

---

### 2.2 Application State & Reactive Stores
| Store | File | Preservation Mandate |
| :--- | :--- | :--- |
| `useAppStore` | `store/useAppStore.ts` | Primary application state. Manages active semester, loaded subjects, class sessions, attendance records, tasks, and settings. All UI screens must bind to this store. |
| `useAcademicStore` | `store/academicStore.ts` | Academic hub state, syllabus tracking, revision intervals, exam sprint state. |
| `useAuthStore` | `store/useAuthStore.ts` | Supabase session state, user identity, offline cached credentials. |

---

### 2.3 Cloud Synchronization & Multi-Tenant Security
| Service / Mechanism | Files | Preservation Mandate |
| :--- | :--- | :--- |
| **Supabase Authentication** | `services/authService.ts`, `lib/supabaseClient.ts` | Multi-factor / email-password auth, JWT handling, secure token storage via `expo-secure-store`. |
| **Two-Way Cloud Sync Engine** | `services/sync/syncService.ts` | SQLite changelog queue (`sync_queue`), batch push/pull, conflict resolution (client-wins or timestamp-based), table whitelist verification. |
| **Row Level Security (RLS)** | `supabase/migrations/*` | Absolute tenant isolation. User A cannot view or mutate User B's subjects, attendance, or tasks. |

---

### 2.4 AI Gateway & Provider Routing (Banku & Shanky)
| Capability | Files | Preservation Mandate |
| :--- | :--- | :--- |
| **Banku Multimodal Vision** | `services/ai/bankuVisionService.ts`, `services/geminiService.ts` | Google Gemini multimodal extraction for timetable photos, syllabus PDFs, and calendar notices. Base64 payload validation. |
| **Shanky Academic Reasoning** | `services/ai/shankyReasoningService.ts`, `services/mistralService.ts` | Mistral reasoning engine for daily planning, attendance explanations, task breakdown. Authenticated gateway with local degradation. |
| **Proposal Validation Gate** | `components/ai/AIProposalCard.tsx` | Any AI-extracted academic data (timetable slots, syllabus units) requires user preview, validation, and manual confirmation before SQLite insertion. Never auto-commit hallucinations. |

---

### 2.5 Academic Intelligence & Calculation Engines
| Engine | Files | Preservation Mandate |
| :--- | :--- | :--- |
| **Deterministic Attendance** | `lib/attendance.ts`, `services/attendanceIntelligenceService.ts` | Exact mathematical formulas for attendance percentage, safety margin, and required recovery classes. No approximation or hallucinated metrics. |
| **Timetable & Occurrences** | `lib/timeUtils.ts` | Recurring weekly class slot calculation, holiday masking, next class determination. |
| **Task Engine & Workload** | `lib/taskEngine.ts` | Overdue calculations, priority sorting, dependency blocking, workload estimation. |
| **Revision Intelligence** | `services/revisionIntelligenceService.ts` | Spaced retrieval algorithms, memory decay estimation, prioritized review queue. |

---

### 2.6 System & Platform Integrations
| Subsystem | Files | Preservation Mandate |
| :--- | :--- | :--- |
| **Notifications & Reminders** | `services/notificationService.ts` | Native notification scheduling for 15-min class reminders, daily briefing, and task deadlines. |
| **File Storage & Attachments** | `services/storageService.ts`, `lib/fileUtils.ts` | Sandboxed local file management, PDF viewing, attachment size validation, MIME-type verification. |
| **Backup & Restore** | `services/backupService.ts` | JSON export and import of complete local database state with integrity verification. |

---

## 3. Screen-to-Service Dependency Checklist

Before modifying any screen in subsequent phases, verify that all underlying service bindings remain connected:

- [x] `app/(tabs)/index.tsx`: Bound to `useAppStore`, `useTodayAcademic`, `ClassSessionModal`, `DailyStudyPlanCard`, `refreshFromDatabase`.
- [x] `app/(tabs)/schedule.tsx`: Bound to `useAppStore.timetableSlots`, `subjectRepository`, `ClassSessionModal`.
- [x] `app/(tabs)/tasks.tsx`: Bound to `useAppStore.tasks`, `taskRepository`, `TaskRescheduleModal`.
- [x] `app/(tabs)/attendance.tsx`: Bound to `useAppStore.getSubjectAttendance`, `attendanceRepository`, `canBunk`.
- [x] `app/(tabs)/college.tsx`: Bound to `useAppStore.subjects`, `AcademicCalendarView`, `SemesterSwitcher`.
- [x] `app/subject/[id].tsx`: Bound to `SubjectSyllabusView`, `SubjectHistoryView`, `SubjectResourcesView`.
- [x] `components/onboarding/*`: Bound to `onboardingService`, `onboardingRepository`, `notificationService`.
- [x] `components/ai/*`: Bound to `bankuVisionService`, `shankyReasoningService`, `AIProposalCard`.
