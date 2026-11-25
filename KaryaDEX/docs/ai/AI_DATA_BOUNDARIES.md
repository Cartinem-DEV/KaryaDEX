# KaryaDEX — AI Data Boundaries & Context Builder (Phase 12)

## 1. Minimal Scoped Context
The AI Context Builder (`aiContextBuilder.ts`) enforces the principle of least privilege. Only data strictly required for the requested feature is queried and assembled.

---

## 2. Feature Context Matrices

### Feature 1: Timetable Extraction (`timetable_extraction`)
- **Provided to AI:** Uploaded image or PDF base64 + MIME type + list of registered subject names.
- **Excluded:** Any grades, attendance history, user profile credentials, other users' data.

### Feature 2: Natural-Language Profile Setup (`profile_setup`)
- **Provided to AI:** User's natural language input string.
- **Excluded:** Entire existing student database, token secrets.

### Feature 3: Smart Attendance Explainer (`attendance_explainer`)
- **Provided to AI:** Authoritative pre-computed snapshot from `AttendanceIntelligenceService` (Subject name, attendance %, target %, safe bunks, recovery needed, pressure level, trend).
- **Excluded:** Other subjects, class notes content, non-academic personal profile.

### Feature 4: "What Should I Do Today?" Daily Briefing (`daily_briefing`)
- **Provided to AI:** Today's timetable slots, top 5 pending task titles/priorities, attendance danger alerts, exams in next 14 days.
- **Excluded:** Archived tasks, historical semester grades, full attendance records, authentication secrets.

### Feature 5: Complex Task Breakdown (`task_breakdown`)
- **Provided to AI:** Task title, user description, subject name.
- **Excluded:** Unrelated tasks, private student notes, other subjects.

---

## 3. Boundary Guarantees
1. **No Database Dumps:** UI components are prohibited from supplying arbitrary database queries or full state snapshots to the AI.
2. **Tenant Scoping:** Every context query filters by the currently authenticated `userId`.
3. **Deterministic Math Supremacy:** All mathematical calculations are computed by TypeScript domain services prior to context construction. AI only receives pre-computed outputs.
