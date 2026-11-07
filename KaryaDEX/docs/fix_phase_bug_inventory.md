# BUNK MAT KAR — FIX PHASE BUG INVENTORY (Phase 1 Output)

Baseline before fixes: `npm test` 17/17 suites, 454/454 tests pass; `npx tsc --noEmit` exit 0.

## P0 — Critical

### P0-1. Shared-account auto sign-in inside AI client (security / tenant isolation)
- **File:** `services/ai/core/aiClient.ts:55-74` (`ensureAuthenticatedSession`)
- **Issue:** Any unauthenticated user invoking Banku/Shanky is silently signed into a hardcoded shared Supabase account (`student_1791451540538@gmail.com` / `Password123!Secure`) with credentials embedded in the client bundle.
- **Impact:** All students share one tenant: shared server quota, AI cache keyed to the shared user (cross-user context bleed), credentials extractable from any published JS bundle.
- **Root cause:** Phase 12.2 "connectivity recovery" made unauthenticated gateway calls succeed by mutating the auth session instead of requiring sign-in.
- **Fix:** Return the existing session only; if none, throw truthful `AIProviderAuthError` ("sign in required"). Shanky degrades to labelled `[Local Assistance]`; Banku shows the honest error.
- **Verification:** New regression test asserting `signInWithPassword` is never called and unauthenticated requests reject with `AIProviderAuthError`.

### P0-2. `classSessions` never hydrated from SQLite — Today screen empty for real users
- **Files:** `database/DatabaseProvider.tsx:57-136` (hydration), `store/useAppStore.ts` (only demo mode ever sets it)
- **Issue:** `useAppStore.classSessions` is populated only from mock data in demo mode. Real users with a full timetable in SQLite get an empty hero card and empty "Your Day" timeline (`app/(tabs)/index.tsx:73` `getTodayClasses(classSessions, ...)`).
- **Root cause:** The legacy `ClassSession` array was superseded by `timetable_slots` but the Today screen still reads the legacy field; hydration never derived it.
- **Fix:** Derive `ClassSession[]` from active `timetableSlots` during hydration and after semester switches.
- **Verification:** Regression test on `hydrateStoresFromDatabase`; Journey A browser check.

### P0-3. Topic revision marks never persist to SQLite
- **File:** `services/revisionService.ts:89-119` (`recordTopicRevision`)
- **Issue:** Marking a topic revised/needs-revision from the Class Journal or Revision Hub updates only the Zustand store. After app restart all revision statuses/counts revert (hydration reloads from `topics` table).
- **Root cause:** Store-only mutation; `syllabusRepository.updateTopic` exists but is never called on this path.
- **Fix:** Fire-and-forget persist via `syllabusRepository.updateTopic` (mirrors the pattern used by other store actions).
- **Verification:** Regression test spying `updateTopic`; Journey B browser check (mark → reload → still marked).

## P1 — Feature broken

### P1-4. Removed attachments reappear after saving a class session
- **Files:** `services/classSessionService.ts:138-149`, `components/academic/ClassSessionModal.tsx:528-530`
- **Issue:** `handleRemoveResource` only removes from local UI state; `saveClassSession` adds new resources but never deletes detached ones. On modal reopen the removed attachments are back.
- **Fix:** Diff note's persisted resources vs payload; delete detached rows via `academic.deleteResource`; delete the physical file only when no other resource row references the same URI.

### P1-5. AI proposal approval writes SQLite but never refreshes app stores
- **Files:** `services/ai/features/timetableExtraction.ts:132-199`, `syllabusExtraction.ts`, `calendarExtraction.ts`, `taskBreakdown.ts`, `profileSetup.ts` (apply methods)
- **Issue:** After "Approve & Save", data exists in SQLite but Today/Schedule/College screens show stale store state until app restart.
- **Fix:** Call `useAppStore.getState().refreshFromDatabase()` at the end of each apply method.

### P1-6. Hardcoded fake semester id `'sem-current'` in AI apply paths
- **Files:** `timetableExtraction.ts:165,179`, `syllabusExtraction.ts:148`, `calendarExtraction.ts:120`
- **Issue:** Subjects/slots created by approved AI imports get `semesterId: 'sem-current'`, which matches no real semester row (real ids: `sem-3` or `sem-<n>-<timestamp>` from onboarding). Such subjects vanish from `getSubjectsForSemester` views when switching semesters.
- **Fix:** Resolve the active semester via `subjectRepository.getSemester()` and use its id.

### P1-7. `switchActiveSemester` leaves `classSessions` stale
- **File:** `store/useAppStore.ts:475-485`
- **Issue:** Switching semesters refreshes subjects/attendance but not the derived class sessions (and post-P0-2 derivation must be re-run), so the Today screen can show classes of the previous semester.
- **Fix:** Re-derive class sessions from the academic store's slots filtered by the new semester's subjects.

## P2 — Degraded UX / data honesty

### P2-8. Add Task modal silently forces due date = today + 3 days
- **File:** `app/(tabs)/tasks.tsx:398`
- **Fix:** Optional due date with quick chips (No due date / Today / Tomorrow / Next week) + manual `YYYY-MM-DD` input with validation.

### P2-9. Subject Resources view: cannot delete resources; local files cannot be opened
- **File:** `components/academic/SubjectResourcesView.tsx`
- **Fix:** Per-card delete (repository-backed) and open `uri` resources via `Linking`.

### P2-10. Today screen pull-to-refresh is a fake 500 ms timer
- **File:** `app/(tabs)/index.tsx:91-95`
- **Fix:** Trigger real `refreshFromDatabase()` hydration.

## P3 — Documented limitations / minor

- **P3-1** `getSemesterGPA` defaults to `'sem-3'` (`store/useAcademicStore.ts:713`) — acceptable for seeded data; onboarding-created semesters need explicit id (documented).
- **P3-2** `faculty`, `marks`, `labs` have no SQLite tables; they exist only in mock/demo data and are not hydrated in real mode (Subject Hub prof line, College labs section empty for real users). Documented, not silently faked.
- **P3-3** `useAcademicStore.addCalendarEvent/removeCalendarEvent` don't persist — dead code (no consumers; calendar derives from timetable/exams/tasks via `studyPlanningService`). Documented.
- **P3-4** `scripts/verify_*.js` contain the shared **test** account credentials — dev-only harness; recommend rotating the password since it also leaked into the client bundle historically.
- **P3-5** Untracked `Gemini api.txt` / `mistral api.txt` in the repo root contain raw API keys. Never referenced by app code (keys are server-side env). Recommend removing from disk and rotating.

## Verified-working areas (no action)

- Attendance math (`lib/attendance.ts`) deterministic; transition-aware counters prevent double-count (`recordAttendanceTransition`).
- AI proposal pipeline: extract → validate → editable preview → confirm → repository save; discard = zero writes (onboarding steps hold drafts in local state only).
- Edge gateway: JWT auth, server-side tenant check, per-user daily quota, Gemini 3.8→3.7 fallback, Mistral isolation, honest 429/5xx.
- Shanky fallback labelled `[Local Assistance]`, never routes to Gemini.
- File security: path-traversal defense, magic-byte validation, extension/MIME checks, 50 MB cap, filename normalization.
- Local-date handling (`formatLocalDate`/`parseLocalDate`) avoids UTC drift; exam countdowns use it.
- Deep-link allowlist (`deepLinkSecurity.isSafeInternalRoute`) on notification navigation.
