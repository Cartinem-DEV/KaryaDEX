# KaryaDEX — Brand Foundation & Design Guidelines
**Document Reference**: `KDX-BRAND-PHASE1-V1.0`  
**Status**: Official Brand Foundation Lock  
**Date**: October 2026  
**Classification**: Proprietary Design & Architecture Standard  

---

## 1. Official Brand Identity

- **Brand Name**: **KaryaDEX**
- **Official Capitalisation**: `KaryaDEX` (Titlecase *Karya* + Uppercase *DEX*)
- **Pronunciation**: *Kaar-ya-deks* (`/ˈkɑːrjə.dɛks/`)
- **Naming Etymology & Heritage**:
  - **Karya** (Sanskrit / Indic root: *कार्य*): Purposeful action, duty, effort, execution, and work that produces meaningful results. It anchors the platform in deliberate daily accomplishment rather than mere passive organization.
  - **DEX**: A modern technology suffix evoking an index, intelligent directory, operational deck, and high-throughput execution interface.
  - **Explicit Non-Acronym Rule**: `DEX` is an intentional branding suffix, **not** an acronym. It must never be back-formed into an expansion (such as "Data Exchange", "Digital Experience", or "Decentralized Engine").
- **Visual Presentation**:
  - In copy, running text, headers, and metadata, the brand name is written strictly as **KaryaDEX**.
  - Lowercase variants (`karyadex`), spaced variants (`Karya Dex`), hyphenated variants (`Karya-Dex`), or all-caps variants (`KARYADEX` except in legal/code constants) are unauthorized.

---

## 2. Brand Meaning and Story

Every student and ambitious professional faces a fragmented landscape of obligations: lectures, project sprints, deadlines, personal goals, and attendance thresholds. The historical market response has been fractured tools: a timer app here, a task list there, a disconnected timetable calendar, and an ad-hoc attendance calculator.

**KaryaDEX was born from the insight that effort without connection breeds cognitive overload.**

When work (*Karya*) is intelligently structured through a unified operational index (*DEX*), friction dissolves. KaryaDEX is not a tool of anxiety or surveillance; it is a system of clarity, calm control, and compounding momentum. It transforms chaotic semesters into structured progress, turning everyday effort into tangible mastery.

---

## 3. Mission and Product Positioning

### Mission Statement
> *"To give students and knowledge workers complete clarity over their time, commitments, and progress through an intelligent, unified workspace."*

### Product Positioning
**KaryaDEX** is an **intelligent, connected productivity platform** that unites schedule orchestration, task execution, academic and semester telemetry, and context-aware AI assistance into a single cohesive operating system.

### Category Definition & Market Boundary
- **What KaryaDEX IS**:
  - A connected life and academic operating system.
  - A proactive decision engine for schedules, deadlines, and commitments.
  - A focused execution environment with integrated telemetry and deep assistance.
- **What KaryaDEX IS NOT**:
  - ❌ *Not merely a timetable app* (it models complex recurring rules, locations, and session notes).
  - ❌ *Not merely an attendance tracker* (it calculates deterministic risk buffers, safe bunk margins, recovery classes, and exam exposure).
  - ❌ *Not merely a to-do list* (it links tasks directly to academic subjects, timetable slots, and exam sprint milestones).
  - ❌ *Not merely an exam countdown app* (it tracks unit-level syllabus completion, revision cadences, and weighted assessments).
  - ❌ *Not merely an AI chatbot wrapper* (its AI assistants, Banku and Shanky, operate against trusted, deterministic application data with strict security boundaries).

### Long-Term Scalability Beyond Academia
While KaryaDEX launches with deep domain intelligence tailored for undergraduate and engineering students, its fundamental engine (relational scheduling, state persistence, quota management, streak motivation, document understanding, and contextual intelligence) is built to scale naturally into post-graduate study, engineering project management, independent learning sprints, and personal work operating systems.

---

## 4. Primary Tagline and Brand Descriptor

### Official Primary Tagline
# Plan. Focus. Progress.

The three words represent the core lifecycle of every meaningful achievement:
1. **Plan**: Deterministic schedule modeling, syllabus structuring, calendar visibility, and daily briefing.
2. **Focus**: Distraction blocking, Pomodoro sessions, reality check prompts, and app usage quotas.
3. **Progress**: Cumulative streaks, attendance safety margins, task completion velocity, and syllabus mastery.

### Official Brand Descriptor
> *"The connected workspace for planning, learning, and getting things done."*

### Approved Secondary Slogans & Microcopy
- *"Your semester, clearly organized."*
- *"Effort with direction."*
- *"Stay ahead of the curve."*
- *"Plan with clarity. Move with confidence."*

---

## 5. Target Audience

### Primary Launch Audience (Undergraduate & Engineering Students)
- **Profile**: Engineering, science, and professional undergraduate students navigating rigorous semester schedules, strict attendance mandates (e.g., the 75% debarment threshold), multiple laboratory sessions, continuous assessments, and semester exams.
- **Core Frustrations**: Unpredictable schedule cancellations, unexpected debarment risk, scattered PDF notes and WhatsApp routine photos, last-minute exam panic, and phone distraction.
- **Value Proposition**: Guaranteed peace of mind through deterministic attendance margins, rapid timetable OCR, centralized subject tracking, and distraction-shielded study sessions.

### Secondary Audience (Post-Graduate & Competitive Exam Aspirants)
- **Profile**: Students preparing for GATE, CAT, GRE, UPSC, and technical certifications requiring disciplined syllabus coverage and structured revision timelines.
- **Value Proposition**: Revision intelligence, syllabus unit audits, exam sprint planning, and distraction-free focus regimes.

### Future Expansion Audience (Early-Career Knowledge Workers & Engineers)
- **Profile**: Junior developers, technical specialists, and project contributors needing an integrated personal workspace to balance daily routines, technical upskilling, personal tasks, and focus quotas.

---

## 6. Product Pillars

The existing 12 subsystem capabilities of the application are organized into **5 unified brand pillars**:

```
                       ┌────────────────────────────────────────────────────────┐
                       │                       KaryaDEX                         │
                       │               Plan. Focus. Progress.                   │
                       └────────────────────────────────────────────────────────┘
                                                    │
         ┌───────────────────┬──────────────────────┼────────────────────┬───────────────────┐
         ▼                   ▼                      ▼                    ▼                   ▼
     CONNECT             ORGANISE              UNDERSTAND             IMPROVE              ASSIST
┌─────────────────┐ ┌─────────────────┐ ┌──────────────────────┐ ┌─────────────────┐ ┌─────────────────┐
│ • Timetable     │ │ • Daily Radar   │ │ • Attendance Margin  │ │ • LOCKIN Engine │ │ • Banku (Vision)│
│ • Subjects Hub  │ │ • Linked Tasks  │ │ • Exam Exposure      │ │ • Revision Hub  │ │ • Shanky (Chat) │
│ • Cloud Sync    │ │ • Notes & Files │ │ • Semester Health    │ │ • Exam Sprints  │ │ • Daily Brief   │
│ • Academic Cal  │ │ • Class Journal │ │ • Safe Buffers       │ │ • Focus Quotas  │ │ • Plan Strategy │
└─────────────────┘ └─────────────────┘ └──────────────────────┘ └─────────────────┘ └─────────────────┘
```

| Pillar | Brand Promise | Implemented Capabilities (Live in Repository) | Future Expansion Horizons |
|---|---|---|---|
| **1. CONNECT** | *Bring fragmented responsibilities together into one coherent operational model.* | • Relational Timetable Slots with recurring schedules.<br>• Subject Deep-Dive Hub with faculty, room, and credits.<br>• Offline-first SQLite (`bunkmatkar.db`) with multi-device cloud synchronization (`sync_queue`).<br>• Centralized Academic Calendar and institutional presets. | • Multi-institution federation.<br>• University portal calendar auto-sync via LMS standards (Canvas/Moodle/Google Classroom). |
| **2. ORGANISE** | *Eliminate mental clutter with structured day-to-day execution.* | • "Today" Command Dashboard with live ongoing class telemetry.<br>• Task Engine 2.0 with subject links, priorities, and deadlines.<br>• Post-class journal entries and scanned document attachments.<br>• Local Document sandbox file management. | • Cross-subject dependency graphs.<br>• Collaborative team assignments and shared student project repositories. |
| **3. UNDERSTAND** | *Replace anxiety with deterministic, mathematical clarity.* | • Deterministic attendance percentage modeling.<br>• Safe bunk calculation and recovery class computation.<br>• 7-day pre-exam attendance exposure warnings.<br>• Comprehensive semester status analytics (Safe / Watch / Danger). | • Multi-semester GPA prediction and cumulative academic transcript intelligence. |
| **4. IMPROVE** | *Build unbreakable consistency, focused discipline, and retention.* | • LOCKIN Native Focus Engine (distraction shielding, strict modes).<br>• Reality Check overlay with intent reflection before opening distracting apps.<br>• Daily app quotas and emergency bypass passes.<br>• Spaced revision scheduling and exam sprint countdowns. | • Cross-device synchronized blocking (desktop web extension pairing).<br>• Longitudinal focus and study habit analytics. |
| **5. ASSIST** | *Context-aware intelligence that analyzes documents and proposes actionable plans.* | • Dual AI Personas: Banku (Multimodal Vision) and Shanky (Conversational Logic).<br>• Routine image parsing and PDF syllabus structure extraction.<br>• Daily automated briefings and step-by-step task breakdown.<br>• Hardened security guardrails preventing indirect prompt injection. | • Voice-interactive daily briefing audio generation.<br>• Automated flashcard synthesis from attached lecture notes. |

---

## 7. Brand Personality

The KaryaDEX brand speaks and looks like a calibrated instrument. It embodies four essential traits:

1. **Intelligent & Deterministic**: We trust math over guessing. When we state that a student has 2 safe absences remaining or 14 days until an exam, that computation is rigorous, authoritative, and reliable.
2. **Confident & Composed**: The interface is never hysterical. It never uses alarming sirens, panic popups, or shameful reprimands. Even when attendance drops into the Danger zone, the system calmly displays the exact mathematical recovery plan.
3. **Structured & Modern**: Precision engineering reflected through crisp geometric typography, subtle glassmorphic depth, clean mathematical proportions, and tactile responsiveness.
4. **Empowering & Action-Oriented**: We don't just alert users to problems; we immediately surface the next actionable step ("Review 3 topics today", "Attend tomorrow's 10:00 AM lecture to restore your 75% margin").

---

## 8. Logo Direction — The Connected K

### Conceptual Foundation: "The Connected K"
The KaryaDEX brandmark is **The Connected K**—a proprietary geometric monogram that synthesizes the letterform **K** with the visual metaphor of interconnected pathways converging into a focused point of momentum.

```
                  ┌─────────┐
                  │    ▲    │  Ascending Upper Path (Aspiration & Mastery)
                  │   /     │
                  │  /      │
 ┌─────────────┐  │ ┌───────┴──────┐
 │             │  │ │              │
 │   CENTRAL   ├──┼─┤  CONVERGENCE │  Intelligent Core Node
 │    STEM     │  │ │     NODE     │  (Synthesis of Schedule & Action)
 │  (Anchor)   │  │ └───────┬──────┘
 │             ├──┼─┤       │
 └─────────────┘  │  \      │
                  │   \     │
                  │    ▼    │  Descending Lower Path (Execution & Grounding)
                  └─────────┘
```

### Visual Geometry & Construction Principles
1. **Vertical Structural Spine (The Anchor)**:
   - A bold, vertical pill-shaped column on the left side representing stability, reliable data, and foundational structure.
   - Proportional width: 1.0 unit. Proportional height: 6.0 units. Corner radius: 0.5 units (fully rounded ends).
2. **Upper Angled Segment (The Vision Beam)**:
   - Extends diagonally upwards at a precise 45-degree angle from the central junction.
   - Represents forward planning, academic aspiration, and foresight.
   - Length: 3.5 units. Width: 1.0 unit. Ends finished with soft rounded caps matching the stem radius.
3. **Lower Angled Segment (The Execution Vector)**:
   - Extends diagonally downwards at a 45-degree angle from the central junction.
   - Represents grounded execution, daily consistency, and completed work.
   - Mirrors the upper diagonal in weight, proportion, and terminal curvature.
4. **The Convergence Node (The Nexus)**:
   - The intersection where the two diagonal arms connect with the vertical stem features an organic, fluid taper or micro-bridge rather than an abrasive hard junction.
   - At high resolutions (and large displays), this junction features a subtle, luminous energy core (a gentle specular glass rim).
   - At icon resolutions (32px to 16px), the geometry collapses into clean, solid, unblurred geometric planes with high figure-ground contrast.

### Wordmark Construction & Typography
- **Exact Text**: `KaryaDEX`
- **Typographic Distribution**:
  - `Karya`: Rendered in **Inter SemiBold / Bold** (weight 600/700). Confident, clean, human, and balanced. Tracking: `-0.015em`.
  - `DEX`: Rendered in **Inter Regular / Medium** (weight 400/500) or highlighted with an accent tint (Brand Indigo `#6366F1` or Light Indigo `#818CF8`). Tracking: `+0.025em` (slightly wider tracking to balance technical precision with the organic body).
- **Spatial Relationship**:
  - The wordmark sits to the right of the Connected K symbol with a gap equal to **50% of the symbol's total width**.
  - The baseline of `KaryaDEX` aligns with the optical center of the vertical monogram stem.

---

## 9. Logo Variation Requirements

| Variation ID | Variant Name | Primary Surface / Context | Visual Treatment | Smallest Permitted Size |
|---|---|---|---|---|
| **VAR-01** | **Primary Horizontal Wordmark** | Web headers, desktop navigation bar, splash screens, documentation, email headers. | Full Connected K symbol on the left + `KaryaDEX` wordmark on the right. | 120px width × 28px height |
| **VAR-02** | **Standalone K Monogram** | Mobile top navigation bar, avatar icons, compact widgets, watermarks. | Monogram symbol alone with surrounding optical balance square container. | 24px × 24px |
| **VAR-03** | **Mobile App Icon (Master)** | iOS App Store, Google Play Store, Android & iOS Home Screens (1024×1024 master). | Connected K symbol centered inside a deep space obsidian squircle (`#0B0C11`) with subtle ambient radial glow (`#7C3AED` @ 18% opacity). | 48px × 48px (physical device display) |
| **VAR-04** | **Light Background Version** | White papers, PDF transcripts, light-theme web screens, printed reports. | Deep Brand Violet (`#5B21B6` / `#7C3AED`) symbol with Dark Charcoal (`#0F172A`) wordmark. | 100px width |
| **VAR-05** | **Dark Background Version** | Default mobile app, dark-theme web, OLED screens. | Luminous Brand Violet/Indigo symbol (`#8B5CF6`) with Crisp Snow (`#F8FAFC`) wordmark. | 100px width |
| **VAR-06** | **Monochrome Solid Black** | Single-color print, monochrome invoices, high-contrast faxes. | 100% Solid Black (`#000000`) on white. No gradients, no transparency. | 16px × 16px |
| **VAR-07** | **Monochrome Solid White** | Single-color dark overlays, etched merchandise, glass backplates. | 100% Solid White (`#FFFFFF`) on dark fill. No gradients, no transparency. | 16px × 16px |
| **VAR-08** | **Android Adaptive Foreground** | Android 13+ Material You themed launcher, adaptive launcher packages. | 432×432 canvas with centered Connected K symbol within safe 288×288 circular mask. Transparent background. | 48px display |
| **VAR-09** | **Android Monochrome Icon** | Android Dynamic Color / Material You themed icon tinting. | Pure white vector silhouette designed to be automatically tinted by the Android OS palette engine. | 48px display |
| **VAR-10** | **Web Favicon** | Browser tab icon, bookmark bar, PWA shortcut icon. | High-contrast Connected K monogram optimized at 16×16 and 32×32 with enhanced stem thickness (+15%) for crisp edge rasterization. | 16px × 16px |

### Clear-Space & Boundary Rules
- The minimum exclusion zone (clear space) around the logo must equal **$X$**, where **$X$** is defined as the width of the vertical stem of the Connected K.
- No text, UI borders, buttons, or imagery may intrude into this boundary zone.

---

## 10. Primary and Extended Colour Palette

The KaryaDEX palette builds upon the app's established dark-mode glassmorphic aesthetics. It utilizes deep spectral violets and indigos to communicate intelligence and focus, grounded by an ultra-deep OLED dark foundation.

### Primary Brand Palette

```
  Deep Violet         Brand Indigo        Brand Accent         OLED Void           Crisp Snow
   #7C3AED              #6366F1             #8B5CF6             #0B0C11             #F8FAFC
┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│             │     │             │     │             │     │             │     │             │
│   PRIMARY   │     │  SECONDARY  │     │   ACCENT    │     │ DARK BASE   │     │ LIGHT BASE  │
│             │     │             │     │             │     │             │     │             │
└─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘     └─────────────┘
```

| Token Name | Hex Code | RGB | Purpose & Semantic Role | Verified WCAG Contrast (vs Backgrounds) |
|---|---|---|---|---|
| `brand.violet` | `#7C3AED` | `124, 58, 237` | Primary brand identifier, key action buttons, primary badges. | **5.70:1** vs White (Passes AA)<br>**5.36:1** vs `#F6F8FC` (Passes AA)<br>**3.43:1** vs `#0B0C11` (Passes AA Large/UI) |
| `brand.indigo` | `#6366F1` | `99, 102, 241` | Secondary brand color, active tab indicators, links, progress meters. | **4.47:1** vs White (Passes AA Large)<br>**4.20:1** vs `#F6F8FC`<br>**4.37:1** vs `#0B0C11` |
| `brand.accent` | `#8B5CF6` | `139, 92, 246` | High-visibility accent on dark surfaces, focus glows, AI callouts. | **4.61:1** vs `#0B0C11` Dark BG (Passes AA Normal)<br>**3.78:1** vs White |
| `brand.darkBase` | `#0B0C11` | `11, 12, 17` | Master OLED dark background canvas, root mobile layout. | Canvas Foundation |
| `brand.lightBase`| `#F6F8FC` | `246, 248, 252`| Clean daylight surface, web desktop backdrop. | Canvas Foundation |

### Extended Surface & Neutral Palette
- **Dark Theme Glass Surfaces**:
  - `dark.surface`: `#13151D` (Tier 1 base card surface)
  - `dark.surfaceSecondary`: `#1A1D27` (Tier 2 elevated cards, modals)
  - `dark.surfaceTertiary`: `#222634` (Tier 3 inputs, active toggles)
  - `dark.border`: `rgba(255, 255, 255, 0.08)` (Subtle glass outline)
  - `dark.borderStrong`: `rgba(255, 255, 255, 0.16)` (Interactive active borders)
- **Text & Foreground Hierarchy**:
  - `dark.text`: `#F8FAFC` (Primary titles, 18.67:1 contrast on dark canvas — Passes AAA)
  - `dark.textSecondary`: `#94A3B8` (Subtitles, metadata, 7.62:1 contrast — Passes AAA)
  - `dark.textTertiary`: `#64748B` (Placeholders, inactive tabs, 4.54:1 contrast — Passes AA)
  - `light.text`: `#0F172A` (Primary titles on light, 16.79:1 contrast — Passes AAA)
  - `light.textSecondary`: `#475569` (Body on light, 7.13:1 contrast — Passes AAA)

### Semantic Status Palette (Preserved Mathematical Domain Colors)
The semantic colors indicate academic standing and risk. Their meanings are strictly locked:

| Semantic Token | Hex Code | Mathematical / Operational Meaning | Dark Canvas Contrast |
|---|---|---|---|
| `status.safe` | `#10B981` | Attendance $\ge \text{Target}$ with comfortable safe absence buffer. Tasks completed. | **7.70:1** (Passes AAA) |
| `status.watch` | `#F59E0B` | Attendance near margin ($\text{Target} \le \% < \text{Target} + 5\%$) or $\le 1$ safe absence remaining. Urgent deadlines. | **9.10:1** (Passes AAA) |
| `status.danger` | `#EF4444` | Attendance below mandated target (e.g., $< 75\%$). Debarment risk active. Tasks overdue. | **5.19:1** (Passes AA) |
| `status.info` | `#3B82F6` | Informational announcements, exam schedule notices, general timetable notes. | **4.86:1** (Passes AA) |

---

## 11. Typography System

### Typeface Hierarchy & Selection

| Level | Family | Weights | Verified File / Source | Platform Usage |
|---|---|---|---|---|
| **Wordmark & Display Headers** | `Inter` (or System Sans fallback) | SemiBold (600), Bold (700) | Web: Google Fonts `Inter`<br>Native: System Sans (`-apple-system`, `Roboto`) | Main titles, navigation headers, modal titles |
| **Body & UI Copy** | `Inter` / System | Regular (400), Medium (500) | Cross-platform standard | Paragraph copy, list items, button labels |
| **Numeric & Telemetry Metrics** | `Oswald` / `Inter` Tabular | Medium (500), SemiBold (600) | `bunkmatkar/assets/fonts/Oswald.ttf` | Attendance percentages, countdown clocks, metrics |
| **Code & Technical Keys** | `SpaceMono` / System Monospace | Regular (400) | `bunkmatkar/assets/fonts/SpaceMono-Regular.ttf` | Package IDs, subject codes, crypto hashes |
| **Accent / Editorial Heads** | `Montserrat` | Bold (700), ExtraBold (800) | `bunkmatkar/assets/fonts/Montserrat.ttf` | Feature banner titles, milestone celebrations |

### Scale and Hierarchy Table

| Style Token | Size (`px`) | Line Height (`px`) | Tracking / Letter Spacing | Target Usage |
|---|---|---|---|---|
| `typography.display` | 32 | 38 | `-0.025em` | Welcome splash, hero onboarding titles |
| `typography.h1` | 24 | 30 | `-0.02em` | Screen headers (Today, Schedule, Attendance) |
| `typography.h2` | 20 | 26 | `-0.015em` | Card group titles, section banners |
| `typography.h3` | 17 | 22 | `-0.01em` | Modal headers, subject card names |
| `typography.body` | 15 | 22 | `0.0em` | Standard descriptions, task notes |
| `typography.bodySm` | 13 | 18 | `+0.01em` | Secondary metadata, dates, locations |
| `typography.caption` | 11 | 14 | `+0.02em` | Tagline badges, status pills, timestamps |
| `typography.metricLg`| 36 | 40 | `-0.03em` | 75% attendance display, countdown timers |

---

## 12. Visual Design Language

KaryaDEX adheres to an architectural style designated as **Calibrated Glassmorphism**:

1. **Restrained Specular Glass**:
   - Surfaces use subtle, multi-pass background blurs (16px to 32px) with controlled background saturation (140% to 190%).
   - Surfaces feature an ultra-fine 1px border with a soft gradient top rim (`rgba(255, 255, 255, 0.22)`) simulating top ambient light reflection.
2. **Atmospheric Ambient Glows**:
   - Rather than harsh drop shadows, elevated cards cast soft, diffused ambient glows in primary violet (`rgba(124, 58, 237, 0.12)`) and indigo (`rgba(99, 102, 241, 0.10)`).
   - Prevents visual heaviness while maintaining distinct z-index layer separation.
3. **Information Density with Breathing Room**:
   - Academic schedules require substantial data on screen. KaryaDEX balances dense data displays using clean 8pt grid spacing (`gap: 8`, `12`, `16`, `24`), micro-divider lines, and high-contrast typographic hierarchy.
4. **Purposeful Micro-Interactions**:
   - Haptic feedback (`expo-haptics`) on marking attendance, completing tasks, or engaging focus mode.
   - Smooth 200ms spring animations for modal popovers and bottom sheet expansion (`react-native-reanimated`).
   - Zero gratuitous spinning or looping animations that drain device battery during lectures.

---

## 13. Brand Voice and Copywriting Guidelines

### Voice Principles
- **Clarity Above All**: State facts directly. Say *"3 classes needed to reach 75%"*, not *"You're falling behind, work harder!"*.
- **Empowering, Not Paternalistic**: KaryaDEX is a high-performance copilot for adults. It respects user agency.
- **Action-Oriented Closures**: Never leave a metric floating without a contextual recommendation.

### Copywriting Before & After Matrix (Future Migration Guide)

| Current Language (Legacy / Slang) | Recommended KaryaDEX Language | Tone Rationale |
|---|---|---|
| *"Never get debarred from exams. BunkMatKar continuously models your safe bunks."* | *"Stay comfortably above your attendance target. KaryaDEX calculates your safe class margin in real time."* | Shifts focus from fear/debarment to positive control and forward confidence. |
| *"Safe to bunk. 5 bunks available."* | *"Safe margin: 5 classes in reserve."* | Professional, precise, and less colloquial while retaining exact operational meaning. |
| *"Can I Bunk?" (Simulation Sheet)* | *"Absence Simulator"* or *"Check Margin"* | Clear, objective, and appropriate for professional workspaces. |
| *"Bunks depleted!"* | *"Attendance margin reached: zero absences remaining."* | Accurate, urgent without being slang-heavy. |
| *"Download BunkMatKar backup"* | *"Export KaryaDEX Academic Workspace"* | Professional data portability phrasing. |
| *"Ask Banku / Shanky for bunk hacks"* | *"Review attendance recovery strategy with Shanky"* | Emphasizes strategic academic navigation. |

---

## 14. AI Persona Integration

The established AI companions **Banku** and **Shanky** are retained as first-class intelligent agents within the KaryaDEX platform.

```
┌────────────────────────────────────────────────────────────────────────┐
│                          KaryaDEX AI Hub                               │
├───────────────────────────────────┬────────────────────────────────────┤
│         BANKU (Vision AI)         │       SHANKY (Conversational AI)   │
│   "Academic Sentinel & Scanner"   │        "Tactical Study Copilot"    │
├───────────────────────────────────┼────────────────────────────────────┤
│ • Primary: Amber (#F59E0B)        │ • Primary: Cyan (#00E5FF)          │
│ • Avatar: Shield-Checkmark        │ • Avatar: Flash / Lightning        │
│ • Multimodal routine OCR          │ • Fast conversational chat         │
│ • PDF syllabus structure audit    │ • Step-by-step task breakdown      │
│ • Scanned handwritten notes       │ • Daily academic briefings         │
│ • Powered by Gemini Flash         │ • Powered by Mistral               │
└───────────────────────────────────┴────────────────────────────────────┘
```

### Brand Integration Rules
- **Parent Brand Reference**: When the assistants introduce themselves, they reference KaryaDEX:
  - *Banku*: *"I am Banku, the multimodal document and schedule intelligence engine for KaryaDEX."*
  - *Shanky*: *"I am Shanky, your tactical daily copilot inside KaryaDEX."*
- **Visual Identity**:
  - Banku retains the armored amber glass design system (`#F59E0B`).
  - Shanky retains the speedster electric cyan design system (`#00E5FF`).
  - Their visual designs complement the primary KaryaDEX violet/indigo theme without collision, acting as distinctive, recognizable color anchors for Vision vs Chat workflows.

---

## 15. Asset Replacement Specification

When asset production begins in future phases, the following exact specification must govern the new KaryaDEX assets:

| Legacy Asset Path | Replacement Asset Name | Target Resolution | Format | Alpha Channel | Visual Description & Requirements |
|---|---|---|---|---|---|
| `bunkmatkar/assets/images/icon.png` | `icon.png` | 1024 × 1024 px | PNG | No (Solid) | Master App Store Icon. Deep Obsidian background (`#0B0C11`), centered Connected K monogram in luminous violet (`#8B5CF6`) with soft specular top edge. |
| `bunkmatkar/assets/images/splash-icon.png` | `splash-icon.png` | 512 × 512 px (or 1024×1024) | PNG | Yes | Centered Connected K monogram with soft outer glow. Clean transparent surround for dynamic splash screen background matching. |
| `bunkmatkar/assets/images/favicon.png` | `favicon.png` | 48 × 48 px (and 32×32) | PNG | Yes | High-contrast Connected K symbol optimized for browser tabs. Monogram lines broadened by 15% for sub-pixel crispness. |
| `bunkmatkar/assets/images/android-icon-foreground.png` | `android-icon-foreground.png` | 432 × 432 px | PNG | Yes | Android Adaptive Icon Foreground. Connected K symbol centered strictly inside the safe 288×288 circular mask. Zero outer clipping. |
| `bunkmatkar/assets/images/android-icon-background.png` | `android-icon-background.png` | 432 × 432 px | PNG | No (Solid) | Android Adaptive Icon Background. Solid `#0B0C11` with very subtle radial gradient of `#1A1D27` towards center. |
| `bunkmatkar/assets/images/android-icon-monochrome.png` | `android-icon-monochrome.png` | 432 × 432 px | PNG | Yes | Pure flat solid white (`#FFFFFF`) Connected K silhouette on transparent background for Android Material You dynamic tinting. |
| `bunkmatkar/assets/images/bunkmatkar_hero_logo.png` | `karyadex_hero_logo.png` | 1200 × 320 px | PNG | Yes | Master horizontal brand lockup: Connected K monogram on left + `KaryaDEX` wordmark on right. Transparent background. |
| `bunkmatkar/assets/images/bunkmatkar_hero_logo.jpg` | `karyadex_hero_logo.jpg` | 1200 × 630 px | JPEG | No | Open Graph (OG) social card and web banner lockup. Dark OLED background with centered logo, tagline, and ambient glow. |

*Note: All 28 mascot asset files in `bunkmatkar/assets/images/mascot/` (Banku and Shanky poses/expressions) are preserved and remain in active service.*

---

## 16. Platform Identity Considerations

### 1. Android Platform
- **Display Name**: Changed to `"KaryaDEX"` in `app.json` (updates launcher name and app drawer).
- **Application ID (`applicationId`)**: **MUST REMAIN** `com.bunkmatkar.bunkmatkar` until formal confirmation of Google Play Store publication status. Changing this value creates a completely separate app package on Android devices, breaking update continuity and resetting sandbox storage.
- **Adaptive Icon XML**: Configured to pair `android-icon-foreground.png` with `#0B0C11` background.

### 2. iOS Platform
- **Display Name (`CFBundleDisplayName`)**: `"KaryaDEX"` (visible on home screen).
- **Bundle Identifier (`CFBundleIdentifier`)**: Can be mapped cleanly during EAS credentials provisioning or prebuild.
- **Face ID Permission String**: `"Allow KaryaDEX to use Face ID to protect your attendance and academic data."`

### 3. Web Platform (PWA & Desktop)
- **HTML Page Title**: `<title>KaryaDEX — Plan. Focus. Progress.</title>`
- **Meta Description**: `"KaryaDEX is the connected workspace for planning, learning, and getting things done. Track schedules, attendance margins, tasks, and syllabus progress."`
- **Theme Color**: `#0B0C11`
- **Manifest Short Name**: `KaryaDEX`

---

## 17. Technical Identifiers to Preserve

To ensure **zero user data loss**, **unbroken SQLite database decryption**, **active biometric security continuity**, and **reliable cloud synchronization**, the following technical identifiers are classified as **FROZEN INVARIANTS**:

```
┌────────────────────────────────────────────────────────────────────────────────────────┐
│                        FROZEN TECHNICAL IDENTIFIERS                                   │
├────────────────────────────────────────┬───────────────────────────────────────────────┤
│ Identifier / Path / Name               │ Reason for Preservation                       │
├────────────────────────────────────────┼───────────────────────────────────────────────┤
│ com.bunkmatkar.bunkmatkar              │ Android OS App Sandboxing & Play Store Key    │
│ com.bunkmatkar.lockin                  │ Native Kotlin package namespace               │
│ com.bunkmatkar.lockin.ACTION_*         │ Native broadcast intent filter actions        │
│ bunkmatkar.db                          │ Physical SQLite file on user filesystem       │
│ bmk_sqlite_master_encryption_key       │ Hardware Keystore master key alias            │
│ bmk_security_app_lock_enabled          │ AsyncStorage biometric toggle key             │
│ bmk_byok_*                             │ SecureStore user API keys                     │
│ BunkMatKar_UserFiles/                  │ Native documents directory for student PDFs   │
│ qimdcbseltdvxdzmdzwb                   │ Supabase Cloud Project Reference              │
│ bunkmatkar://                          │ Primary custom deep-link scheme               │
│ 60ed1213-c7dd-4b74-a9a6-1ece2b09cb6c   │ EAS Project Reference ID                      │
└────────────────────────────────────────┴───────────────────────────────────────────────┘
```

> [!CAUTION]
> Renaming `bmk_sqlite_master_encryption_key` in `databaseEncryptionService.ts` will permanently prevent existing app installations from decrypting their encrypted SQLite databases.
> Renaming `bunkmatkar.db` in `nativeDatabase.native.ts` will orphan all stored student timetable records and task histories.
> These identifiers are purely internal technical infrastructure and must not be altered for aesthetic reasons.

---

## 18. Brand Usage Do's and Don'ts

### Do's
- ✅ **DO** spell the name as **KaryaDEX** in all text, titles, and documentation.
- ✅ **DO** pair the Connected K symbol with adequate clear space ($1X$).
- ✅ **DO** use the official tagline: *"Plan. Focus. Progress."*.
- ✅ **DO** preserve the high-contrast ratio (minimum 4.5:1) for all body copy on dark surfaces.
- ✅ **DO** refer to Banku and Shanky as intelligent AI companions inside the KaryaDEX platform.
- ✅ **DO** celebrate student effort and progress with calm, constructive feedback.

### Don'ts
- ❌ **DON'T** spell the name as `Karyadex`, `Karya Dex`, `karyadex`, or `KARYA-DEX`.
- ❌ **DON'T** invent an acronym for DEX (e.g., *"Karya Digital Execution"*).
- ❌ **DON'T** use graduation caps, cartoon clocks, generic brain illustrations, or cryptocurrency logos.
- ❌ **DON'T** stretch, skew, rotate, or outline the Connected K symbol.
- ❌ **DON'T** modify internal technical keys (`bmk_*`, `bunkmatkar.db`) during user-facing copy migrations.
- ❌ **DON'T** use shame-based or punitive warnings when attendance is in the Danger zone.

---

## 19. Domain and Trademark Clearance Checklist

The selection of **KaryaDEX** is locked as the internal project brand strategy. Before commercial deployment, the following formal clearance tasks must be executed independently:

- [ ] **Exact Domain Search**: Inspect registration status for `karyadex.com`, `karyadex.app`, and `karyadex.io`.
- [ ] **App Store Availability**: Verify that no active or conflicting app is listed under the exact name "KaryaDEX" on the Apple App Store or Google Play Store.
- [ ] **Indian Trademark Registry (IP India)**:
  - Class 9 (Scientific, computer software, mobile applications).
  - Class 42 (Software as a service, educational technology, cloud platforms).
  - Search for phonetic similarities to "Karya", "Karyadex", or related prefixes.
- [ ] **International Trademark Screening**: Check USPTO and WIPO (Madrid System) databases for conflicting marks in computer software classifications.
- [ ] **Social Media & Developer Handles**: Check handle availability (`@karyadex`, `@karyadexapp`) on GitHub, X (Twitter), LinkedIn, and Instagram.
- [ ] **DNS & Email Routing Setup**: Prepare DNS routing records (SPF, DKIM, DMARC) for transactional email delivery via Resend once a primary domain is secured.

---

## 20. Phase 2 Preparation Notes

Phase 1 has established the foundational brand architecture and design standards.

### Immediate Scope for Phase 2 (Asset Generation & Visual Implementation)
1. **Vector Asset Crafting**: Produce precision SVG vectors for the Connected K monogram and `KaryaDEX` horizontal wordmark based on Section 8 specifications.
2. **Master Icon Rasterization**: Export pixel-perfect PNG assets (`1024×1024`, `512×512`, `432×432`, `48×48`, `32×32`) into a staging directory for visual review.
3. **Adaptive Icon Validation**: Validate the Android adaptive icon foreground within the circular mask tool to ensure zero terminal clipping.
4. **Copy Transformation Catalog**: Prepare an exact line-by-line replacement map for user-facing UI text in Onboarding, Account Settings, and Dashboard headers, strictly leaving internal SQLite/SecureStore constants untouched.

---
*End of Brand Foundation Document. Locked for Phase 1.*

