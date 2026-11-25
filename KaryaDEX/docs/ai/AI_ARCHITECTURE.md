# KaryaDEX — AI Architecture (Phase 12 & Phase 12.2)

## 1. Overview
The **AI Academic Intelligence Engine** introduces production-grade AI into KaryaDEX (College Life OS) while strictly maintaining:
1. **Deterministic Academic Math Integrity:** Mathematical calculations (attendance %, safe bunk capacity, recovery requirements, date arithmetic, timetable conflict checks) remain 100% owned by existing deterministic domain engines. AI only interprets, explains, and summarizes.
2. **Zero Direct Database Writes:** AI cannot perform SQL, SQLite, or Supabase mutations directly. Mutations follow the strict proposal pipeline: `AI -> Proposal Draft -> Schema Validation -> UI Preview -> Explicit User Confirmation -> Application Service -> Database`.
3. **Strict User Data Boundaries:** The Context Builder reads minimum required data scoped by the authenticated student. No complete database dumps, tokens, passwords, or secrets are ever included.
4. **API Key Isolation:** Model provider keys reside solely in server-side Supabase Edge Function secrets. Zero keys in Expo client bundle or Git. Client builds do not require client-side Gemini or Mistral keys for shared gateway operation.

---

## 2. Personas & Model Slots

| Persona | Role | Primary Model | Fallback Model | Visual Theme |
| :--- | :--- | :--- | :--- | :--- |
| **Banku** | Heavy Lifter / Multimodal Vision | Gemini 3.8 Flash (`gemini-3.8-flash`) | Gemini 3.7 Flash (`gemini-3.7-flash`) | Plate-Armor Amber (`#F59E0B`), Sparkles/Scan Icon |
| **Shanky** | Speedster / Conversational AI | Mistral Ministral 3 8B (`ministral-8b-2512`) | Transparent Deterministic Local Assistance (Strict quota/provider isolation; zero silent routing to Gemini) | Agile Emerald (`#10B981`), Chat/Flash Icon |

---

## 3. Architecture Hierarchy

```
UI Components (FloatingAICompanion, AIAssistantModal, AIProposalCard, Onboarding Imports)
                              │
                              ▼
                        AI Client (`aiClient.ts`)
       [ensureAuthenticatedSession: valid JWT + tenant match]
                              │
               ┌──────────────┴──────────────┐
               ▼                             ▼
    Supabase Edge Gateway        Local AIRouter (BYOK / Offline Fallback)
    (`functions/ai-gateway`)                 │
               │               ┌─────────────┴─────────────┐
               │               ▼                           ▼
               │        GeminiProvider               MistralProvider
               │        (3.8 Flash / 3.7)          (ministral-8b-2512)
               │               │                           │
               ▼               ▼                           ▼
    Google Generative AI API   Mistral AI Chat Completions API
```

---

## 4. Proposal Mutation Pipeline

```
Student Request / Upload (Timetable, Syllabus, Calendar)
         ↓
File Validation (Magic Bytes, Traversal, Size)
         ↓
AI Persona Processing (Banku / Shanky)
         ↓
Structured Output Validation (`aiValidation.ts`)
         ↓
Conflict & Logic Check (Timetable Engine, Syllabus Duplicate Check, Exam Dates)
         ↓
AI Proposal Generation (`status: 'pending'`, `type: 'IMPORT_TIMETABLE' | 'IMPORT_SYLLABUS' | 'IMPORT_CALENDAR'`)
         ↓
UI Preview (`AIProposalCard` / Onboarding Preview Modal)
         ↓
User Clicks "Confirm & Save" (Cancel results in 0 writes)
         ↓
Deterministic Application Service (`timetableRepository`, `syllabusRepository`, `semesterRepository`, `examRepository`)
         ↓
SQLite Persistence & Sync Engine
```

---

## 5. Floating AI Companion & App-Wide Shell Integration
Phase 12.2 replaces permanent side-by-side Banku and Shanky split-screen panels with a unified, floating companion:
- **`FloatingAICompanion`:** Circular floating launcher button (52×52 dp) with breathing glow animation, accessible touch target, and reduced-motion support.
- **Animated Persona Selector:** Tapping the launcher opens a bottom sheet offering Banku (Heavy Lifter / Vision) and Shanky (Speedster / Logic Chat).
- **App-Wide Shell Availability:** Rendered in `app/(tabs)/_layout.tsx`, accessible from Today, Schedule, Tasks, Attendance, and College screens.
- **Unified Surface:** Both personas share the interactive chat sheet with conversation continuity, persona switching, and structured action proposals.

---

## 6. Smart Academic Onboarding Imports (Banku)
Phase 12.2 integrates optional Banku multimodal imports directly into the onboarding wizard and academic screens:
- **`StepTimetable.tsx`:** "Import Timetable with Banku" accepts routine photos/PDFs, checks schedule overlap conflicts, and presents an editable preview before adding to draft slots.
- **`StepSyllabus.tsx`:** "Import Syllabus with Banku" extracts units and topics, checks duplicates, assigns to subjects, and preserves uncompleted topic state.
- **`StepAcademic.tsx`:** "Import College Calendar with Banku" auto-detects semester dates, exams, and official holidays.
- **Reusable Screen Imports:** Schedule (`app/(tabs)/schedule.tsx`) and College (`app/(tabs)/college.tsx`) include Banku import buttons so students never have to re-enter onboarding.

---

## 7. Graceful Degradation & Error Truthfulness
- **Truthful Error Reporting:** Edge Gateway HTTP errors (429 Rate Limit, 401 Auth) are typed as `AIProviderRateLimitError` or `AIProviderAuthError`, never disguised as client-side API key errors.
- **Shanky Isolation:** If Mistral fails or is offline, Shanky degrades to honest `[Local Assistance]` utilizing deterministic local calculations. It **never** silently calls Gemini or masquerades deterministic fallback as an AI completion.
- **Cancel Safety:** Every AI draft operation requires explicit user approval. Discarding or cancelling executes zero database writes.
