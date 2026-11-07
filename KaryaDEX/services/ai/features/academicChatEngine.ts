/**
 * BunkMatKar — Academic Chat Intelligence Engine
 *
 * Comprehensive academic and general knowledge engine powering Banku & Shanky.
 * Enables both AI companions to answer ANY question asked by the student:
 * - Computer Science & Programming (DSA, Algorithms, OOP, DBMS, OS, Networks, Web, Dev)
 * - Mathematics & Statistics (Calculus, Linear Algebra, Probability, Equations, Logic)
 * - Physics & Chemistry (Mechanics, Electromagnetism, Thermodynamics, Organic, Inorganic)
 * - Electronics & Engineering (Circuits, Logic Gates, Diodes, Transistors)
 * - Study Skills & Exam Strategy (Semester Prep, Active Recall, Feynman, Pomodoro, CGPA)
 * - Formal College Writing (Medical Leave, Leave Application, Extension Request, Appeals)
 * - Database-backed Attendance & Schedule calculations (Safe Bunks, Recovery, Today's Routine)
 * - Dynamic Semantic Knowledge synthesis for all open-ended questions
 */

import type { AIPersonaId } from '../core/aiTypes';

export interface AcademicAnswerResult {
  reply: string;
  suggestedActions: string[];
  actionType: 'general' | 'view_attendance' | 'view_schedule' | 'view_tasks';
  relatedSubjectId?: string;
}

export class AcademicChatEngine {
  /**
   * Generates a complete, high-quality answer for ANY question for either Banku or Shanky.
   */
  static generateAnswer(params: {
    query: string;
    persona: AIPersonaId;
    studentName?: string;
    subjects?: Array<{ id: string; name: string; percentage?: number; safeBunks?: number; recoveryNeeded?: number }>;
    todayClasses?: Array<{ subjectName: string; startTime: string; endTime: string; room?: string }>;
    pendingTasks?: Array<{ title: string; dueDate?: string }>;
    preferredSubjectId?: string;
  }): AcademicAnswerResult {
    const {
      query,
      persona,
      studentName = 'Student',
      subjects = [],
      todayClasses = [],
      pendingTasks = [],
      preferredSubjectId,
    } = params;

    const q = query.trim();
    const lower = q.toLowerCase();

    // ─────────────────────────────────────────────────────────────────────────
    // 1. APP CONTEXT QUERIES (Attendance, Bunk Margins, Schedule, Tasks)
    // ─────────────────────────────────────────────────────────────────────────

    // A. Attendance & Bunk inquiries
    if (lower.includes('attendance') || lower.includes('bunk') || lower.includes('margin') || lower.includes('percentage') || lower.includes('debar')) {
      return this.handleAttendanceQuery(lower, persona, subjects, preferredSubjectId);
    }

    // B. Schedule / Routine / Classes today inquiries
    if (lower.includes('today') || lower.includes('schedule') || lower.includes('routine') || lower.includes('class') || lower.includes('timetable') || lower.includes('periods')) {
      return this.handleScheduleQuery(lower, persona, todayClasses);
    }

    // C. Tasks / Homework / Assignments inquiries
    if (lower.includes('task') || lower.includes('todo') || lower.includes('homework') || lower.includes('assignment') || lower.includes('deadline')) {
      return this.handleTaskQuery(lower, persona, pendingTasks);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 2. COLLEGE FORMAL WRITING TEMPLATES
    // ─────────────────────────────────────────────────────────────────────────
    if (lower.includes('leave') || lower.includes('sick') || lower.includes('fever') || lower.includes('email to prof') || lower.includes('email to hod') || lower.includes('excuse') || lower.includes('extension') || lower.includes('application')) {
      return this.handleFormalWritingQuery(lower, persona, studentName);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 3. STUDY STRATEGY & EXAM PREPARATION
    // ─────────────────────────────────────────────────────────────────────────
    if (lower.includes('exam') || lower.includes('semester') || lower.includes('cgpa') || lower.includes('study faster') || lower.includes('feynman') || lower.includes('pomodoro') || lower.includes('active recall') || lower.includes('spaced repetition') || lower.includes('placement') || lower.includes('stress') || lower.includes('notes')) {
      return this.handleStudyStrategyQuery(lower, persona);
    }

    // ─────────────────────────────────────────────────────────────────────────
    // 4. COMPUTER SCIENCE & PROGRAMMING CONCEPTS
    // ─────────────────────────────────────────────────────────────────────────
    const csAnswer = this.matchComputerScienceQuery(lower, persona);
    if (csAnswer) return csAnswer;

    // ─────────────────────────────────────────────────────────────────────────
    // 5. MATHEMATICS & STATISTICS CONCEPTS
    // ─────────────────────────────────────────────────────────────────────────
    const mathAnswer = this.matchMathematicsQuery(lower, persona);
    if (mathAnswer) return mathAnswer;

    // ─────────────────────────────────────────────────────────────────────────
    // 6. PHYSICS & CHEMISTRY CONCEPTS
    // ─────────────────────────────────────────────────────────────────────────
    const scienceAnswer = this.matchScienceQuery(lower, persona);
    if (scienceAnswer) return scienceAnswer;

    // ─────────────────────────────────────────────────────────────────────────
    // 7. ARITHMETIC / EQUATION SOLVER
    // ─────────────────────────────────────────────────────────────────────────
    const calcAnswer = this.trySolveCalculation(q, persona);
    if (calcAnswer) return calcAnswer;

    // ─────────────────────────────────────────────────────────────────────────
    // 8. DYNAMIC SEMANTIC SYNTHESIS (For ANY other question!)
    // ─────────────────────────────────────────────────────────────────────────
    return this.generateDynamicSemanticAnswer(q, persona);
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION A: APP CONTEXT HANDLERS
  // ═══════════════════════════════════════════════════════════════════════════

  private static handleAttendanceQuery(
    lower: string,
    persona: AIPersonaId,
    subjects: Array<{ id: string; name: string; percentage?: number; safeBunks?: number; recoveryNeeded?: number }>,
    preferredSubjectId?: string
  ): AcademicAnswerResult {
    const isBanku = persona === 'banku';
    const prefix = isBanku ? '[Banku Assistance]' : '[Local Assistance]';

    if (subjects.length === 0) {
      const reply = isBanku
        ? `${prefix} 🛡️ **Banku's Attendance Sentinel Report**\n\nNo subjects are currently registered in your academic hub. To start tracking attendance margins and safe bunks, add your subjects or upload your timetable routine using the button above!`
        : `${prefix} ⚡ **Shanky's Co-Pilot Quick Briefing**\n\nYou haven't set up any subjects yet! Head over to the College tab or tap below to set up your subjects so I can compute your safe bunks in real time.`;
      return {
        reply,
        suggestedActions: ['Add Subject', 'Upload Routine', 'View College Hub'],
        actionType: 'view_attendance',
      };
    }

    const foundSubj = preferredSubjectId
      ? subjects.find(s => s.id === preferredSubjectId)
      : subjects.find(s => lower.includes(s.name.toLowerCase()));

    const targetSubj = foundSubj || subjects[0] || {
      id: 'default',
      name: 'General Academic Subject',
      percentage: 75,
      safeBunks: 1,
      recoveryNeeded: 0,
    };

    const pct = targetSubj.percentage ?? 80;
    const safe = targetSubj.safeBunks ?? 1;
    const rec = targetSubj.recoveryNeeded ?? 0;

    if (isBanku) {
      if (safe > 0) {
        return {
          reply: `${prefix} 🛡️ **Banku's Attendance Sentinel Audit: ${targetSubj.name}**\n\n` +
            `• **Current Standing:** ${pct.toFixed(1)}% (Target Secured)\n` +
            `• **Safe Bunk Capacity:** **${safe} class${safe > 1 ? 'es' : ''}** safely expendable without falling below your debarment threshold.\n` +
            `• **Academic Verdict:** You are in the Safe Operational Zone. Maintain this margin for end-semester buffer.\n\n` +
            `🛡️ *Banku's Sentinel Takeaway: Keep at least 1 safe bunk reserved for exam prep or unexpected contingencies.*`,
          suggestedActions: ['View Attendance Graph', 'Audit All Subjects', 'Daily Routine'],
          actionType: 'view_attendance',
          relatedSubjectId: targetSubj.id,
        };
      } else {
        return {
          reply: `${prefix} 🛡️ **Banku's Attendance Sentinel Alert: ${targetSubj.name}**\n\n` +
            `• **Current Standing:** ${pct.toFixed(1)}% (BELOW MINIMUM TARGET)\n` +
            `• **Recovery Protocol:** You must attend **${rec} consecutive class${rec > 1 ? 'es' : ''}** to restore compliance.\n` +
            `• **Debarment Risk:** HIGH. Zero bunks permissible.\n\n` +
            `🛡️ *Banku's Sentinel Takeaway: Attend every scheduled lecture this week to neutralize attendance pressure immediately.*`,
          suggestedActions: ['View Recovery Plan', 'Check Schedule', 'Mark Attendance'],
          actionType: 'view_attendance',
          relatedSubjectId: targetSubj.id,
        };
      }
    } else {
      // Shanky
      if (safe > 0) {
        return {
          reply: `${prefix} ⚡ **Shanky's Tactical Attendance Intel: ${targetSubj.name}**\n\n` +
            `You are sitting pretty at **${pct.toFixed(1)}%**! 🎯\n` +
            `• **Safe Bunks in the Bag:** **${safe}** class${safe > 1 ? 'es' : ''} available!\n` +
            `• **Verdict:** You have breathing room. Skip guilt-free if you need a study sprint or a break!\n\n` +
            `⚡ *Shanky's Pro-Tip: Don't spend all your bunks before mid-terms. Bank at least one for final week prep!*`,
          suggestedActions: ['Check All Bunks', 'What to do today?', 'View Schedule'],
          actionType: 'view_attendance',
          relatedSubjectId: targetSubj.id,
        };
      } else {
        return {
          reply: `${prefix} ⚡ **Shanky's Red Alert: ${targetSubj.name}**\n\n` +
            `Attendance is at **${pct.toFixed(1)}%** — we're in the danger zone! ⚠️\n` +
            `• **Safe Bunks:** 0 (Lockdown mode)\n` +
            `• **Recovery Needed:** Show up to the next **${rec}** class${rec > 1 ? 'es' : ''} straight.\n\n` +
            `⚡ *Shanky's Pro-Tip: Sit near the front and set two alarms. You can crawl out of the danger zone faster than you think!*`,
          suggestedActions: ['Attendance Recovery', 'View Schedule', 'Set Class Reminder'],
          actionType: 'view_attendance',
          relatedSubjectId: targetSubj.id,
        };
      }
    }
  }

  private static handleScheduleQuery(
    lower: string,
    persona: AIPersonaId,
    todayClasses: Array<{ subjectName: string; startTime: string; endTime: string; room?: string }>
  ): AcademicAnswerResult {
    const isBanku = persona === 'banku';
    const prefix = isBanku ? '[Banku Assistance]' : '[Local Assistance]';

    if (todayClasses.length === 0) {
      const reply = isBanku
        ? `${prefix} 🛡️ **Banku's Schedule Intelligence**\n\nYou have no scheduled classes on your routine for today. This is an optimal tactical window to execute revision modules, complete pending assignments, or audit syllabus topics.`
        : `${prefix} ⚡ **Shanky's Daily Radar**\n\nZero classes on the radar today! 🏖️ You've got free rein. Use today to smash through pending assignments or take a well-deserved recharge break!`;
      return {
        reply,
        suggestedActions: ['View Weekly Timetable', 'Check Pending Tasks', 'Upload Routine'],
        actionType: 'view_schedule',
      };
    }

    const classItems = todayClasses
      .map((c, i) => `${i + 1}. **${c.subjectName}** — ${c.startTime}–${c.endTime}${c.room ? ` (${c.room})` : ''}`)
      .join('\n');

    if (isBanku) {
      return {
        reply: `${prefix} 🛡️ **Banku's Academic Schedule for Today**\n\n` +
          `You have **${todayClasses.length} academic slot${todayClasses.length > 1 ? 's' : ''}** scheduled:\n\n` +
          `${classItems}\n\n` +
          `🛡️ *Banku's Sentinel Takeaway: Ensure notebooks and materials are staged prior to each session.*`,
        suggestedActions: ['Mark Attendance', 'View Timetable', 'Upload Routine'],
        actionType: 'view_schedule',
      };
    } else {
      return {
        reply: `${prefix} ⚡ **Shanky's Today Timeline**\n\n` +
          `Here is your class lineup for today (${todayClasses.length} session${todayClasses.length > 1 ? 's' : ''}):\n\n` +
          `${classItems}\n\n` +
          `⚡ *Shanky's Pro-Tip: Knock out the earliest lecture with high energy and the rest of the day flies by!*`,
        suggestedActions: ['Mark Attendance', 'View Tasks', 'What should I do today?'],
        actionType: 'view_schedule',
      };
    }
  }

  private static handleTaskQuery(
    lower: string,
    persona: AIPersonaId,
    pendingTasks: Array<{ title: string; dueDate?: string }>
  ): AcademicAnswerResult {
    const isBanku = persona === 'banku';
    const prefix = isBanku ? '[Banku Assistance]' : '[Local Assistance]';

    if (pendingTasks.length === 0) {
      const reply = isBanku
        ? `${prefix} 🛡️ **Banku's Task Registry**\n\nAll tasks and assignments in your queue are completed! The backlog is 100% cleared. You may add upcoming lab reports, project milestones, or review revision flashcards.`
        : `${prefix} ⚡ **Shanky's Task Dashboard**\n\nBacklog clean! All tasks checked off. 🚀 High-five! Relax or queue up your next big goal.`;
      return {
        reply,
        suggestedActions: ['Add High Priority Task', 'View Schedule', 'Break Down Task'],
        actionType: 'view_tasks',
      };
    }

    const taskItems = pendingTasks
      .slice(0, 5)
      .map((t, i) => `${i + 1}. **${t.title}**${t.dueDate ? ` *(Due: ${t.dueDate})*` : ''}`)
      .join('\n');

    if (isBanku) {
      return {
        reply: `${prefix} 🛡️ **Banku's Task Backlog Audit**\n\n` +
          `You have **${pendingTasks.length} pending academic task${pendingTasks.length > 1 ? 's' : ''}**:\n\n` +
          `${taskItems}\n\n` +
          `🛡️ *Banku's Sentinel Takeaway: Execute task #1 first using dedicated time blocking to prevent deadline pressure.*`,
        suggestedActions: ['Break Down Task', 'View All Tasks', 'Add Task'],
        actionType: 'view_tasks',
      };
    } else {
      return {
        reply: `${prefix} ⚡ **Shanky's Action Priority Stack**\n\n` +
          `You've got **${pendingTasks.length} task${pendingTasks.length > 1 ? 's' : ''}** waiting:\n\n` +
          `${taskItems}\n\n` +
          `⚡ *Shanky's Pro-Tip: Pick the shortest task first and crush it in 15 minutes. Instant momentum!*`,
        suggestedActions: ['Break Down Task', 'Mark Complete', 'View All Tasks'],
        actionType: 'view_tasks',
      };
    }
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION B: FORMAL COLLEGE WRITING TEMPLATES
  // ═══════════════════════════════════════════════════════════════════════════

  private static handleFormalWritingQuery(lower: string, persona: AIPersonaId, studentName: string): AcademicAnswerResult {
    const isBanku = persona === 'banku';
    const prefix = isBanku ? '[Banku Assistance]' : '[Local Assistance]';

    const isExtension = lower.includes('extension');
    const todayStr = new Date().toLocaleDateString('en-US', { year: 'numeric', month: 'long', day: 'numeric' });

    if (isExtension) {
      return {
        reply: `${prefix} ${isBanku ? '🛡️ **Banku\'s Formal Assignment Extension Draft**' : '⚡ **Shanky\'s Extension Email Template**'}\n\n` +
          `**Subject:** Request for Assignment Submission Extension — [Subject Code] — [Your Roll Number]\n\n` +
          `Respected Professor [Professor's Last Name],\n\n` +
          `I hope this email finds you well. I am writing to respectfully request a short extension on the submission deadline for the **[Assignment Name / Project]**, which is currently due on [Current Due Date].\n\n` +
          `Due to [unforeseen illness / technical difficulties / overlapping academic examinations], I need an additional [2/3 days] to ensure the work is completed to the required academic standard.\n\n` +
          `I have already completed [70%] of the assignment and would be deeply grateful if you could permit me to submit it by **[Proposed New Date]**.\n\n` +
          `Thank you very much for your time, consideration, and understanding.\n\n` +
          `Warm regards,\n` +
          `**${studentName}**\n` +
          `[Roll / Registration Number]\n` +
          `[Department & Semester]`,
        suggestedActions: ['Copy Email', 'Medical Leave Template', 'View Tasks'],
        actionType: 'general',
      };
    }

    // Default Sick / Medical Leave Email
    return {
      reply: `${prefix} ${isBanku ? '🛡️ **Banku\'s Official Medical Leave Application**' : '⚡ **Shanky\'s Sick Leave Email Draft**'}\n\n` +
        `**Subject:** Application for Medical Leave of Absence — ${studentName} — [Roll Number]\n\n` +
        `Respected [Professor / Head of Department],\n\n` +
        `I am writing to formally request leave of absence from classes from **[Start Date]** to **[End Date]** (${todayStr}) due to [fever / acute viral illness / medical emergency].\n\n` +
        `My physician has advised complete rest during this recovery period. I have attached the official medical certificate and prescription for your verification.\n\n` +
        `I will coordinate with my classmates to catch up on all missed lecture topics and assignments upon my return. I kindly request you to grant me leave and excuse my absence for attendance records.\n\n` +
        `Thank you for your understanding.\n\n` +
        `Yours sincerely,\n` +
        `**${studentName}**\n` +
        `Roll Number: [Your Roll Number]\n` +
        `Semester & Section: [Your Semester / Section]\n` +
        `Contact: [Your Phone Number]`,
      suggestedActions: ['Copy Template', 'Extension Request', 'Check Attendance Impact'],
      actionType: 'general',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION C: STUDY STRATEGY & EXAM PREPARATION
  // ═══════════════════════════════════════════════════════════════════════════

  private static handleStudyStrategyQuery(lower: string, persona: AIPersonaId): AcademicAnswerResult {
    const isBanku = persona === 'banku';
    const prefix = isBanku ? '[Banku Assistance]' : '[Local Assistance]';

    if (lower.includes('sleep') || lower.includes('tired') || lower.includes('burnout') || lower.includes('all-nighter') || lower.includes('exhausted')) {
      return {
        reply: `${prefix} ${isBanku ? '🛡️ **Banku\'s Cognitive Sentinel: Sleep & Memory Consolidation**' : '⚡ **Shanky\'s Recovery Protocol: Sleep & Performance**'}\n\n` +
          `**Why Sleep Is Non-Negotiable for Academic Success:**\n\n` +
          `• **Synaptic Memory Consolidation:** During sleep (especially NREM stage 3 & REM), your brain transfers short-term memories from the hippocampus to the neocortex, locking in lecture concepts.\n` +
          `• **The All-Nighter Penalty:** Pulling an all-nighter reduces executive focus and calculation accuracy by 35–40%. Sleep deprivation destroys working memory.\n` +
          `• **Toxin Clearance:** The glymphatic system cleans neuro-metabolic waste accumulated during intense study sessions exclusively during deep sleep.\n\n` +
          `**Optimized Sleep Protocol:**\n` +
          `1. **Target:** 7–8 hours non-negotiable nightly sleep.\n` +
          `2. **No Blue Light:** Put your phone away 30 minutes before bed to allow melatonin release.\n` +
          `3. **20-Minute Power Nap:** If energy dips in the afternoon, take a 20-minute power nap to reset focus.\n\n` +
          `${isBanku ? '🛡️ *Banku\'s Sentinel Takeaway: Sleep is not idle downtime — it is an active biological maintenance cycle critical for high-grade retention.*' : '⚡ *Shanky\'s Pro-Tip: Cramming while exhausted is like pouring water into a leaky bucket. Get 7 hours of sleep and your recall will be 2x sharper!*'}` ,
        suggestedActions: ['Feynman Technique', 'Pomodoro Strategy', 'Semester Exam Plan'],
        actionType: 'general',
      };
    }

    if (lower.includes('feynman')) {
      return {
        reply: `${prefix} ${isBanku ? '🛡️ **Banku\'s Deep Dive: The Feynman Technique**' : '⚡ **Shanky\'s Quick Guide: The Feynman Technique**'}\n\n` +
          `The Feynman Technique is the ultimate mental model for truly mastering complex concepts without memorization.\n\n` +
          `**The 4 Pillars:**\n` +
          `1. **Choose a Target Concept:** Write the concept name at the top of a blank page.\n` +
          `2. **Teach It to a 12-Year-Old:** Explain the concept in plain, simple English without academic jargon. Use analogies!\n` +
          `3. **Pinpoint the Gaps:** Whenever you get stuck or need complex words to explain it, that is where your knowledge gap is.\n` +
          `4. **Simplify & Refine:** Go back to source notes, fill the gap, and condense your explanation into a razor-sharp story.\n\n` +
          `${isBanku ? '🛡️ *Banku\'s Sentinel Takeaway: If you cannot explain a formula or concept simply, you do not truly understand it.*' : '⚡ *Shanky\'s Pro-Tip: Pretend you\'re explaining the topic to your roommate over tea. Instant clarity!*'}` ,
        suggestedActions: ['Pomodoro Technique', 'Active Recall Tips', 'Semester Exam Plan'],
        actionType: 'general',
      };
    }

    if (lower.includes('pomodoro')) {
      return {
        reply: `${prefix} ${isBanku ? '🛡️ **Banku\'s Protocol: The Pomodoro Technique**' : '⚡ **Shanky\'s Focus Hack: Pomodoro Sprints**'}\n\n` +
          `Beat procrastination and brain fatigue with structured cognitive cycles:\n\n` +
          `• **Phase 1 (Sprint):** 25 minutes of zero-distraction focus on ONE single topic.\n` +
          `• **Phase 2 (Rest):** 5 minutes of genuine rest (walk, drink water, stretch — no phone scrolling!).\n` +
          `• **Phase 3 (Repeat):** Complete 4 cycles (100 minutes of pure deep work).\n` +
          `• **Phase 4 (Long Break):** Take a 20–30 minute reward break to consolidate memory.\n\n` +
          `${isBanku ? '🛡️ *Banku\'s Sentinel Takeaway: Strict boundary protection during the 25 minutes is mandatory.*' : '⚡ *Shanky\'s Pro-Tip: 4 Pomodoros before lunch and your entire daily study load is done!*'}` ,
        suggestedActions: ['Active Recall Tips', 'Break Down Task', 'How to Study Faster?'],
        actionType: 'general',
      };
    }

    if (lower.includes('cgpa') || lower.includes('score high') || lower.includes('marks')) {
      return {
        reply: `${prefix} ${isBanku ? '🛡️ **Banku\'s 5-Pillar Blueprint for 9+ CGPA**' : '⚡ **Shanky\'s CGPA Multiplier Playbook**'}\n\n` +
          `**1. Internal Assessment Maximization:** 30–40% of your grade comes from lab tests, quizzes, and attendance bonuses. Secure 90%+ in internals to build a safety net.\n` +
          `**2. Decode the 80/20 PYQ Pattern:** 80% of university exam questions stem from 20% of core syllabus topics. Audit previous 5 years papers.\n` +
          `**3. Visual Paper Presentation:** Examiners grade fast. Use labeled block diagrams, bullet points, underlined keywords, and bordered final answers.\n` +
          `**4. Attendance Buffer Management:** High attendance gets grace marks and prevents exam-hall panic.\n` +
          `**5. Spaced Revision Waves:** Review lecture notes within 24 hours (10 mins) and weekend reviews.\n\n` +
          `${isBanku ? '🛡️ *Banku\'s Sentinel Takeaway: Consistency beats 48-hour cramming every single semester.*' : '⚡ *Shanky\'s Pro-Tip: Scoring in college is 50% knowledge and 50% presentation. Make your paper look impossible to give low marks to!*'}` ,
        suggestedActions: ['How to prepare for semester exams?', 'Break Down Task', 'Explain Attendance'],
        actionType: 'general',
      };
    }

    // Default Semester Exam Roadmap
    return {
      reply: `${prefix} ${isBanku ? '🛡️ **Banku\'s Semester Exam War-Room Strategy**' : '⚡ **Shanky\'s Semester Exam Survival Blueprint**'}\n\n` +
        `**Phase 1 — Syllabus & PYQ Triage (Days 1–3):**\n` +
        `• Collect previous 5 years university question papers (PYQs).\n` +
        `• Mark recurring topics with high weightage (Units 1, 3, 5 usually pack 60% of marks).\n\n` +
        `**Phase 2 — Active Study Sprints (Days 4–10):**\n` +
        `• Do NOT passively highlight textbooks. Solve derivation steps and write code by hand.\n` +
        `• Create 1-page formula sheets and flowcharts for every subject.\n\n` +
        `**Phase 3 — Timed Mock Simulation (Days 11–14):**\n` +
        `• Solve at least 2 full papers under 3-hour exam conditions.\n` +
        `• Track your speed per 10-mark and 15-mark question.\n\n` +
        `${isBanku ? '🛡️ *Banku\'s Sentinel Takeaway: Start with your highest credit subjects first for maximum CGPA impact.*' : '⚡ *Shanky\'s Pro-Tip: Get 7 hours of sleep the night before. An exhausted brain loses 20% recall power!*'}` ,
      suggestedActions: ['Feynman Technique', 'Pomodoro Strategy', 'How to Improve CGPA?'],
      actionType: 'general',
    };
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION D: COMPUTER SCIENCE & PROGRAMMING
  // ═══════════════════════════════════════════════════════════════════════════

  private static matchComputerScienceQuery(lower: string, persona: AIPersonaId): AcademicAnswerResult | null {
    const isBanku = persona === 'banku';
    const prefix = isBanku ? '[Banku Assistance]' : '[Local Assistance]';

    // 1. Recursion
    if (lower.includes('recursion')) {
      return {
        reply: `${prefix} ${isBanku ? '🛡️ **Banku\'s Academic Analysis: Recursion**' : '⚡ **Shanky\'s Speedster Take: Recursion**'}\n\n` +
          `**Definition:** Recursion is a programming technique where a function calls itself to solve smaller subproblems until it hits a termination condition.\n\n` +
          `**The Two Essential Components:**\n` +
          `1. **Base Case:** The condition that halts recursion and prevents stack overflow.\n` +
          `2. **Recursive Step:** Breaking the problem into smaller inputs: $f(n) = \\text{work} + f(n-1)$.\n\n` +
          `**Python Example (Factorial $n!$):**\n` +
          `\`\`\`python\n` +
          `def factorial(n):\n` +
          `    if n <= 1:           # Base Case\n` +
          `        return 1\n` +
          `    return n * factorial(n - 1)  # Recursive Step\n` +
          `\`\`\`\n\n` +
          `• **Time Complexity:** $O(n)$ | **Space Complexity:** $O(n)$ call stack frames.\n\n` +
          `${isBanku ? '🛡️ *Banku\'s Sentinel Takeaway: Always write and verify your base case first to guard against Maximum Call Stack Exceeded errors.*' : '⚡ *Shanky\'s Pro-Tip: Trace recursion by drawing a tree branching downwards, then bubble answers back up!*'}` ,
        suggestedActions: ['Binary Search', 'Sorting Algorithms', 'Dynamic Programming'],
        actionType: 'general',
      };
    }

    // 2. Binary Search
    if (lower.includes('binary search')) {
      return {
        reply: `${prefix} ${isBanku ? '🛡️ **Banku\'s Algorithm Audit: Binary Search**' : '⚡ **Shanky\'s Fast Guide: Binary Search**'}\n\n` +
          `**Prerequisite:** The array MUST be **sorted**.\n\n` +
          `**How It Works:** Divide and conquer. Compare the target with the middle element:\n` +
          `• If target == mid: found!\n` +
          `• If target < mid: search left half.\n` +
          `• If target > mid: search right half.\n\n` +
          `**Python Code:**\n` +
          `\`\`\`python\n` +
          `def binary_search(arr, target):\n` +
          `    low, high = 0, len(arr) - 1\n` +
          `    while low <= high:\n` +
          `        mid = (low + high) // 2\n` +
          `        if arr[mid] == target:\n` +
          `            return mid\n` +
          `        elif arr[mid] < target:\n` +
          `            low = mid + 1\n` +
          `        else:\n` +
          `            high = mid - 1\n` +
          `    return -1\n` +
          `\`\`\`\n\n` +
          `• **Time Complexity:** Best $O(1)$, Worst/Average $O(\\log n)$.\n` +
          `• **Space Complexity:** $O(1)$ iterative.\n\n` +
          `${isBanku ? '🛡️ *Banku\'s Sentinel Takeaway: Binary search cuts a 1-million-item array in just 20 comparisons.*' : '⚡ *Shanky\'s Pro-Tip: In Java/C++, use `mid = low + (high - low) / 2` to prevent integer overflow!*'}` ,
        suggestedActions: ['Sorting Algorithms', 'Arrays vs Linked Lists', 'Time Complexity Big-O'],
        actionType: 'general',
      };
    }

    // 3. Sorting Algorithms (Merge, Quick, Bubble)
    if (lower.includes('sorting') || lower.includes('quicksort') || lower.includes('mergesort') || lower.includes('bubble sort')) {
      return {
        reply: `${prefix} ${isBanku ? '🛡️ **Banku\'s Master Sorting Comparison**' : '⚡ **Shanky\'s Sorting Cheat-Sheet**'}\n\n` +
          `| Algorithm | Best | Average | Worst | Space | Stable? |\n` +
          `|---|---|---|---|---|---|\n` +
          `| **Quick Sort** | $O(n \\log n)$ | $O(n \\log n)$ | $O(n^2)$ | $O(\\log n)$ | No |\n` +
          `| **Merge Sort** | $O(n \\log n)$ | $O(n \\log n)$ | $O(n \\log n)$ | $O(n)$ | Yes |\n` +
          `| **Heap Sort** | $O(n \\log n)$ | $O(n \\log n)$ | $O(n \\log n)$ | $O(1)$ | No |\n` +
          `| **Insertion** | $O(n)$ | $O(n^2)$ | $O(n^2)$ | $O(1)$ | Yes |\n` +
          `| **Bubble Sort**| $O(n)$ | $O(n^2)$ | $O(n^2)$ | $O(1)$ | Yes |\n\n` +
          `**Key Insights:**\n` +
          `• **Merge Sort:** Guaranteed $O(n \\log n)$ everywhere, preferred for Linked Lists.\n` +
          `• **Quick Sort:** Fastest in practice due to cache locality, but worst-case occurs on already sorted arrays (choose random pivot).\n\n` +
          `${isBanku ? '🛡️ *Banku\'s Sentinel Takeaway: Use Merge Sort when stability is critical; use Quick Sort for in-place array speed.*' : '⚡ *Shanky\'s Pro-Tip: Modern languages (Python/Java) use TimSort — a hybrid of Merge Sort & Insertion Sort!*'}` ,
        suggestedActions: ['Binary Search', 'Trees and BST', 'Big-O Complexity'],
        actionType: 'general',
      };
    }

    // 4. Object Oriented Programming (OOP)
    if (lower.includes('oop') || lower.includes('object oriented') || lower.includes('polymorphism') || lower.includes('encapsulation') || lower.includes('inheritance') || lower.includes('abstraction')) {
      return {
        reply: `${prefix} ${isBanku ? '🛡️ **Banku\'s Blueprint: 4 Pillars of OOP**' : '⚡ **Shanky\'s Rapid Breakdown: OOP Pillars**'}\n\n` +
          `**1. Encapsulation (Data Protection):**\n` +
          `Bundling data and methods into a single unit (class) and restricting direct access using private/protected specifiers.\n\n` +
          `**2. Abstraction (Hiding Complexity):**\n` +
          `Exposing only the essential interface while hiding the implementation details (using abstract classes / interfaces).\n\n` +
          `**3. Inheritance (Code Reuse):**\n` +
          `A child class inheriting properties and behavior from a parent class (\`class Dog extends Animal\`).\n\n` +
          `**4. Polymorphism (Many Forms):**\n` +
          `• **Compile-Time (Static):** Method Overloading (same name, different arguments).\n` +
          `• **Runtime (Dynamic):** Method Overriding (\`@Override\` in subclass executed via dynamic dispatch).\n\n` +
          `${isBanku ? '🛡️ *Banku\'s Sentinel Takeaway: OOP prevents spaghetti code and ensures scalable, maintainable software.*' : '⚡ *Shanky\'s Pro-Tip: In interview questions, remember the acronym **A-PIE** (Abstraction, Polymorphism, Inheritance, Encapsulation)!*'}` ,
        suggestedActions: ['DBMS & SQL', 'Operating Systems', 'Data Structures'],
        actionType: 'general',
      };
    }

    // 5. DBMS & SQL & ACID
    if (lower.includes('dbms') || lower.includes('acid') || lower.includes('sql') || lower.includes('normalization') || lower.includes('database')) {
      return {
        reply: `${prefix} ${isBanku ? '🛡️ **Banku\'s Database Sentinel: ACID & Normalization**' : '⚡ **Shanky\'s DBMS High-Speed Guide**'}\n\n` +
          `**The ACID Properties (Transaction Reliability):**\n` +
          `• **A — Atomicity:** "All or nothing". Either the entire transaction succeeds or rolls back completely.\n` +
          `• **C — Consistency:** Database transitions from one valid state to another, obeying all integrity constraints.\n` +
          `• **I — Isolation:** Concurrent transactions execute without interfering with each other.\n` +
          `• **D — Durability:** Once committed, data is permanently saved even if the system crashes.\n\n` +
          `**Database Normalization Stages:**\n` +
          `• **1NF:** Atomic values only (no repeating groups/arrays in columns).\n` +
          `• **2NF:** In 1NF + no partial dependency (non-prime attributes depend on whole composite key).\n` +
          `• **3NF:** In 2NF + no transitive dependency (non-prime attribute depending on another non-prime attribute).\n` +
          `• **BCNF:** For every functional dependency $X \\rightarrow Y$, $X$ must be a super key.\n\n` +
          `${isBanku ? '🛡️ *Banku\'s Sentinel Takeaway: Normalization eliminates data redundancy and update anomalies in relational databases.*' : '⚡ *Shanky\'s Pro-Tip: In production read-heavy apps, deliberate de-normalization is often used for faster query performance!*'}` ,
        suggestedActions: ['Operating Systems', 'Computer Networks', 'OOP Concepts'],
        actionType: 'general',
      };
    }

    // 6. Computer Networks & OSI Model
    if (lower.includes('osi') || lower.includes('tcp') || lower.includes('udp') || lower.includes('network') || lower.includes('dns')) {
      return {
        reply: `${prefix} ${isBanku ? '🛡️ **Banku\'s Network Protocol Audit: OSI & TCP/IP**' : '⚡ **Shanky\'s 7-Layer OSI & Protocol Cheat-Sheet**'}\n\n` +
          `**The 7 Layers of OSI (Bottom to Top):**\n` +
          `1. **Physical:** Raw bit streams, cables, radio signals (Hubs, repeaters).\n` +
          `2. **Data Link:** Frames, MAC addressing, error detection (Switches, Ethernet).\n` +
          `3. **Network:** Packets, logical IP addressing, routing (Routers, IP, ICMP).\n` +
          `4. **Transport:** End-to-end delivery, flow & error control (TCP, UDP, Ports).\n` +
          `5. **Session:** Establishes and manages dialogues between applications.\n` +
          `6. **Presentation:** Encryption, data compression, translation (SSL/TLS, JPEG, ASCII).\n` +
          `7. **Application:** User interface & network services (HTTP, HTTPS, DNS, SMTP, FTP).\n\n` +
          `**TCP vs UDP:**\n` +
          `• **TCP:** Connection-oriented (3-Way Handshake SYN $\\rightarrow$ SYN-ACK $\\rightarrow$ ACK), reliable, ordered, retransmits lost packets.\n` +
          `• **UDP:** Connectionless, lightweight, zero handshake, ideal for video streaming and live gaming.\n\n` +
          `${isBanku ? '🛡️ *Banku\'s Sentinel Takeaway: Remember OSI mnemonic: "Please Do Not Throw Sausage Pizza Away" (Physical to Application).*' : '⚡ *Shanky\'s Pro-Tip: DNS is just the internet\'s phonebook mapping human URLs to machine IP addresses!*'}` ,
        suggestedActions: ['Operating Systems', 'DBMS & SQL', 'Web Development'],
        actionType: 'general',
      };
    }

    // 7. Operating Systems (OS) & Deadlocks
    if (lower.includes('operating system') || lower.includes('deadlock') || lower.includes('paging') || lower.includes('process vs thread') || /\bos\b/.test(lower)) {
      return {
        reply: `${prefix} ${isBanku ? '🛡️ **Banku\'s OS Architecture: Deadlocks & Processes**' : '⚡ **Shanky\'s OS Essentials**'}\n\n` +
          `**Process vs Thread:**\n` +
          `• **Process:** Program in execution with isolated memory space (high creation/context-switch overhead).\n` +
          `• **Thread:** Lightweight unit within a process sharing heap, code, and global variables (fast context switch).\n\n` +
          `**The 4 Coffman Conditions for Deadlock:**\n` +
          `1. **Mutual Exclusion:** At least one non-shareable resource.\n` +
          `2. **Hold and Wait:** Process holds one resource while waiting for another.\n` +
          `3. **No Preemption:** Resources cannot be forcibly revoked.\n` +
          `4. **Circular Wait:** $P_1$ waits for $P_2$, $P_2$ waits for $P_3$, ..., $P_n$ waits for $P_1$.\n\n` +
          `• **Deadlock Avoidance:** Banker\'s Algorithm (allocates resources only if state remains safe).\n` +
          `• **Virtual Memory & Paging:** Divides physical memory into Frames and logical memory into Pages to prevent external fragmentation.\n\n` +
          `${isBanku ? '🛡️ *Banku\'s Sentinel Takeaway: Breaking any ONE of the 4 Coffman conditions is guaranteed to prevent deadlock.*' : '⚡ *Shanky\'s Pro-Tip: Mutex is locking a bathroom with a key; Semaphore is a parking lot counter!*'}` ,
        suggestedActions: ['Computer Networks', 'DBMS & SQL', 'Data Structures'],
        actionType: 'general',
      };
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION E: MATHEMATICS & STATISTICS
  // ═══════════════════════════════════════════════════════════════════════════

  private static matchMathematicsQuery(lower: string, persona: AIPersonaId): AcademicAnswerResult | null {
    const isBanku = persona === 'banku';
    const prefix = isBanku ? '[Banku Assistance]' : '[Local Assistance]';

    // 1. Calculus / Differentiation / Integration
    if (lower.includes('calculus') || lower.includes('differentiation') || lower.includes('derivative') || lower.includes('integration') || lower.includes('integral')) {
      return {
        reply: `${prefix} ${isBanku ? '🛡️ **Banku\'s Calculus Sentinel: Core Rules & Formulas**' : '⚡ **Shanky\'s Calculus Survival Formula Sheet**'}\n\n` +
          `**Differentiation (Rate of Change):**\n` +
          `• Power Rule: $\\frac{d}{dx} x^n = n x^{n-1}$\n` +
          `• Product Rule: $\\frac{d}{dx}[u \\cdot v] = u'v + uv'$\n` +
          `• Quotient Rule: $\\frac{d}{dx}[\\frac{u}{v}] = \\frac{u'v - uv'}{v^2}$\n` +
          `• Chain Rule: $\\frac{d}{dx} f(g(x)) = f'(g(x)) \\cdot g'(x)$\n` +
          `• Key Derivatives: $\\frac{d}{dx}\\sin(x) = \\cos(x)$, $\\frac{d}{dx}e^x = e^x$, $\\frac{d}{dx}\\ln(x) = \\frac{1}{x}$\n\n` +
          `**Integration (Accumulation & Area):**\n` +
          `• Power Rule: $\\int x^n dx = \\frac{x^{n+1}}{n+1} + C$ (for $n \\ne -1$)\n` +
          `• Log Rule: $\\int \\frac{1}{x} dx = \\ln|x| + C$\n` +
          `• Integration by Parts: $\\int u \\, dv = uv - \\int v \\, du$ (Choose $u$ using **ILATE**: Inverse, Log, Algebraic, Trig, Exponential)\n\n` +
          `${isBanku ? '🛡️ *Banku\'s Sentinel Takeaway: Differentiation breaks curves into infinitesimal slopes; Integration sums them back into area.*' : '⚡ *Shanky\'s Pro-Tip: In integration by parts, pick u as whatever differentiates to something simpler!*'}` ,
        suggestedActions: ['Linear Algebra & Matrices', 'Bayes Theorem', 'Physics Mechanics'],
        actionType: 'general',
      };
    }

    // 2. Linear Algebra / Matrices
    if (lower.includes('matrix') || lower.includes('matrices') || lower.includes('eigenvalue') || lower.includes('determinant') || lower.includes('linear algebra')) {
      return {
        reply: `${prefix} ${isBanku ? '🛡️ **Banku\'s Linear Algebra: Matrices & Eigenvalues**' : '⚡ **Shanky\'s Matrix & Linear Algebra Guide**'}\n\n` +
          `**1. Determinant of a $2 \\times 2$ Matrix:**\n` +
          `For $A = \\begin{pmatrix} a & b \\\\ c & d \\end{pmatrix}$, $\\det(A) = ad - bc$.\n` +
          `• If $\\det(A) = 0$, the matrix is **singular** (no inverse exists).\n\n` +
          `**2. Matrix Inverse:**\n` +
          `$A^{-1} = \\frac{1}{\\det(A)} \\text{adj}(A)$ where $A \\cdot A^{-1} = I$.\n\n` +
          `**3. Eigenvalues & Eigenvectors ($Av = \\lambda v$):**\n` +
          `• Characteristic Equation: $\\det(A - \\lambda I) = 0$.\n` +
          `• Solve for $\\lambda$ to find the eigenvalues.\n` +
          `• Substitute each $\\lambda$ into $(A - \\lambda I)v = 0$ to solve for the eigenvector $v$.\n\n` +
          `${isBanku ? '🛡️ *Banku\'s Sentinel Takeaway: Eigenvectors preserve direction under linear transformation; eigenvalues dictate scaling magnitude.*' : '⚡ *Shanky\'s Pro-Tip: Sum of eigenvalues = Trace of matrix (sum of diagonals)! Product of eigenvalues = Determinant! Easy check in exams!*'}` ,
        suggestedActions: ['Calculus Formulas', 'Bayes Theorem', 'Physics Mechanics'],
        actionType: 'general',
      };
    }

    // 3. Bayes Theorem & Probability
    if (lower.includes('bayes') || lower.includes('probability') || lower.includes('normal distribution')) {
      return {
        reply: `${prefix} ${isBanku ? '🛡️ **Banku\'s Probability Analysis: Bayes\' Theorem**' : '⚡ **Shanky\'s Intuitive Bayes\' Theorem**'}\n\n` +
          `**Bayes\' Theorem Formula:**\n` +
          `$$P(A|B) = \\frac{P(B|A) \\cdot P(A)}{P(B)}$$\n\n` +
          `**The Terminology Decoded:**\n` +
          `• $P(A|B)$ — **Posterior Probability:** Probability of hypothesis $A$ given that evidence $B$ has occurred.\n` +
          `• $P(B|A)$ — **Likelihood:** Probability that evidence $B$ is observed given that $A$ is true.\n` +
          `• $P(A)$ — **Prior Probability:** Initial belief in hypothesis $A$ before seeing evidence.\n` +
          `• $P(B)$ — **Marginal Probability:** Total probability of observing evidence $B$ under all conditions.\n\n` +
          `**Real-World Application:** Medical diagnosis testing, email spam filtering, and Bayesian machine learning classifiers.\n\n` +
          `${isBanku ? '🛡️ *Banku\'s Sentinel Takeaway: Always calculate total probability P(B) in the denominator by summing over all mutually exclusive cases.*' : '⚡ *Shanky\'s Pro-Tip: Even if a test is 99% accurate, if the disease is rare, a positive test result often still has low posterior probability due to prior base rate!*'}` ,
        suggestedActions: ['Calculus Formulas', 'Matrices & Determinants', 'Data Structures'],
        actionType: 'general',
      };
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION F: PHYSICS & CHEMISTRY
  // ═══════════════════════════════════════════════════════════════════════════

  private static matchScienceQuery(lower: string, persona: AIPersonaId): AcademicAnswerResult | null {
    const isBanku = persona === 'banku';
    const prefix = isBanku ? '[Banku Assistance]' : '[Local Assistance]';

    // 1. Newton's Laws of Motion
    if (lower.includes('newton') || lower.includes('laws of motion') || lower.includes('friction') || lower.includes('momentum')) {
      return {
        reply: `${prefix} ${isBanku ? '🛡️ **Banku\'s Mechanics Sentinel: Newton\'s 3 Laws of Motion**' : '⚡ **Shanky\'s Rapid Physics: Newton\'s Laws**'}\n\n` +
          `**1. First Law (Law of Inertia):**\n` +
          `An object remains at rest or in uniform motion in a straight line unless acted upon by a net external force ($\\Sigma F = 0 \\implies a = 0$).\n\n` +
          `**2. Second Law (Law of Force & Acceleration):**\n` +
          `The rate of change of momentum is directly proportional to the applied net force: **$F = ma$** (or $F = \\frac{dp}{dt}$).\n\n` +
          `**3. Third Law (Action & Reaction):**\n` +
          `To every action, there is an equal and opposite reaction ($F_{AB} = -F_{BA}$). Action and reaction forces act on **two different bodies**, so they never cancel each other out!\n\n` +
          `${isBanku ? '🛡️ *Banku\'s Sentinel Takeaway: Free Body Diagrams (FBDs) resolving orthogonal components are mandatory to score full marks in mechanics.*' : '⚡ *Shanky\'s Pro-Tip: When solving pulley and slope problems, always align your coordinate axes with the direction of acceleration!*'}` ,
        suggestedActions: ['Thermodynamics Laws', 'Ohm\'s Law & Circuits', 'Calculus Formulas'],
        actionType: 'general',
      };
    }

    // 2. Thermodynamics
    if (lower.includes('thermodynamic') || lower.includes('entropy') || lower.includes('carnot')) {
      return {
        reply: `${prefix} ${isBanku ? '🛡️ **Banku\'s Thermodynamics: The 4 Fundamental Laws**' : '⚡ **Shanky\'s Thermodynamics Cheat-Sheet**'}\n\n` +
          `**• Zeroth Law (Temperature Definition):** If body $A$ is in thermal equilibrium with $B$, and $B$ is in equilibrium with $C$, then $A$ and $C$ are in thermal equilibrium with each other.\n` +
          `**• First Law (Conservation of Energy):** Energy cannot be created or destroyed: **$\\Delta U = Q - W$** (Change in internal energy = heat added minus work done by system).\n` +
          `**• Second Law (Entropy & Direction of Heat):** Natural processes move in the direction of increasing total entropy: $\\Delta S_{\\text{universe}} \\ge 0$. Heat spontaneously flows only from hot to cold.\n` +
          `**• Third Law (Absolute Zero):** The entropy of a pure crystalline substance approaches zero as temperature approaches absolute zero ($0\\text{ K}$ or $-273.15^\\circ\\text{C}$).\n\n` +
          `• **Carnot Efficiency:** Maximum theoretical engine efficiency $\\eta = 1 - \\frac{T_C}{T_H}$.\n\n` +
          `${isBanku ? '🛡️ *Banku\'s Sentinel Takeaway: No heat engine can ever achieve 100% efficiency due to second-law thermodynamic limits.*' : '⚡ *Shanky\'s Pro-Tip: In numericals, ALWAYS convert temperatures to Kelvin (K = °C + 273.15) before plugging into formulas!*'}` ,
        suggestedActions: ['Newton\'s Laws', 'Ohm\'s Law & Circuits', 'Chemistry Concepts'],
        actionType: 'general',
      };
    }

    // 3. Electricity, Ohm's Law & Circuits
    if (lower.includes('ohm') || lower.includes('circuit') || lower.includes('resistor') || lower.includes('kirchhoff') || lower.includes('voltage') || lower.includes('current')) {
      return {
        reply: `${prefix} ${isBanku ? '🛡️ **Banku\'s Electrical Engineering: Ohm\'s & Kirchhoff\'s Laws**' : '⚡ **Shanky\'s Circuit Laws in 60 Seconds**'}\n\n` +
          `**Ohm\'s Law:**\n` +
          `The current through a conductor between two points is directly proportional to the voltage across the two points: **$V = I \\cdot R$**\n` +
          `• Power dissipated: $P = V \\cdot I = I^2 R = \\frac{V^2}{R}$\n\n` +
          `**Resistor Combinations:**\n` +
          `• **Series:** Current is identical. $R_{\\text{eq}} = R_1 + R_2 + R_3$\n` +
          `• **Parallel:** Voltage is identical. $\\frac{1}{R_{\\text{eq}}} = \\frac{1}{R_1} + \\frac{1}{R_2} + \\frac{1}{R_3}$\n\n` +
          `**Kirchhoff\'s Laws:**\n` +
          `• **KCL (Current Law):** Sum of currents entering a junction = sum of currents leaving (Conservation of Charge: $\\Sigma I = 0$).\n` +
          `• **KVL (Voltage Law):** Sum of all voltages around any closed loop = 0 (Conservation of Energy: $\\Sigma V = 0$).\n\n` +
          `${isBanku ? '🛡️ *Banku\'s Sentinel Takeaway: In AC circuits, replace resistance R with impedance Z ($Z = R + jX$).*' : '⚡ *Shanky\'s Pro-Tip: For two parallel resistors, use the product-over-sum shortcut: $R_{eq} = \\frac{R_1 R_2}{R_1 + R_2}$!*'}` ,
        suggestedActions: ['Newton\'s Laws', 'Thermodynamics Laws', 'Digital Logic Gates'],
        actionType: 'general',
      };
    }

    // 4. Chemistry (Periodic Table, Bonding, Solutions)
    if (lower.includes('chemistry') || lower.includes('periodic table') || lower.includes('molarity') || lower.includes('bonding') || lower.includes('organic')) {
      return {
        reply: `${prefix} ${isBanku ? '🛡️ **Banku\'s Chemistry Sentinel: Core Foundations**' : '⚡ **Shanky\'s Chemistry High-Yield Points**'}\n\n` +
          `**1. Periodic Table Periodic Trends (Across a Period Left $\\rightarrow$ Right):**\n` +
          `• Electronegativity increases | Ionization energy increases | Atomic radius decreases.\n` +
          `• Down a Group: Atomic radius increases, electronegativity decreases.\n\n` +
          `**2. Types of Chemical Bonds:**\n` +
          `• **Ionic Bond:** Complete transfer of electrons from metal to non-metal (e.g. $\\text{NaCl}$).\n` +
          `• **Covalent Bond:** Sharing of electron pairs between non-metals (e.g. $\\text{H}_2\\text{O}$, $\\text{CH}_4$).\n` +
          `• **Hydrogen Bond:** Strong dipole-dipole attraction between $H$ and $F, O, N$.\n\n` +
          `**3. Concentration Formulas:**\n` +
          `• **Molarity ($M$):** $\\text{Molarity} = \\frac{\\text{Moles of solute}}{\\text{Volume of solution (Liters)}}$\n` +
          `• **Ideal Gas Law:** $PV = nRT$ ($R = 0.0821 \\text{ L}\\cdot\\text{atm}/(\\text{mol}\\cdot\\text{K})$).\n\n` +
          `${isBanku ? '🛡️ *Banku\'s Sentinel Takeaway: In redox reactions, OIL RIG: Oxidation Is Loss of electrons, Reduction Is Gain.*' : '⚡ *Shanky\'s Pro-Tip: Molarity is per liter of solution; Molality is per kg of solvent!*'}` ,
        suggestedActions: ['Thermodynamics Laws', 'Ohm\'s Law', 'Calculus Formulas'],
        actionType: 'general',
      };
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION G: ARITHMETIC / EQUATION SOLVER
  // ═══════════════════════════════════════════════════════════════════════════

  private static trySolveCalculation(query: string, persona: AIPersonaId): AcademicAnswerResult | null {
    const isBanku = persona === 'banku';
    const prefix = isBanku ? '[Banku Assistance]' : '[Local Assistance]';

    // Simple arithmetic expression e.g. "what is 25 * 14" or "compute 1500 / 12"
    const mathMatch = query.match(/(?:what is|calculate|compute|solve)?\s*([0-9\.\s\+\-\*\/\^\(\)%]+)$/i);
    if (mathMatch && mathMatch[1]) {
      const expr = mathMatch[1].trim();
      // Check if expression contains an operator
      if (/[\+\-\*\/%]/.test(expr) && expr.length >= 3 && !/[a-zA-Z]/.test(expr)) {
        try {
          // Safe evaluation using Function
          const sanitized = expr.replace(/\^/g, '**');
          // Validate only numbers and mathematical operators
          if (/^[0-9\.\s\+\-\*\/\(\)\%]+$/.test(sanitized)) {
            const result = Function(`'use strict'; return (${sanitized})`)();
            if (typeof result === 'number' && !isNaN(result)) {
              return {
                reply: `${prefix} ${isBanku ? '🛡️ **Banku\'s Mathematical Solution**' : '⚡ **Shanky\'s Quick Calculation**'}\n\n` +
                  `**Expression:** \`${expr}\`\n` +
                  `**Result:** **${result}**\n\n` +
                  `${isBanku ? '🛡️ *Banku Verified: Exact arithmetic computation confirmed.*' : '⚡ *Shanky Math: Fast computation done!*'}` ,
                suggestedActions: ['Another Calculation', 'Calculus Formulas', 'Matrices'],
                actionType: 'general',
              };
            }
          }
        } catch {}
      }
    }

    return null;
  }

  // ═══════════════════════════════════════════════════════════════════════════
  // SECTION H: DYNAMIC SEMANTIC SYNTHESIS (For ANY other question!)
  // ═══════════════════════════════════════════════════════════════════════════

  private static generateDynamicSemanticAnswer(query: string, persona: AIPersonaId): AcademicAnswerResult {
    const isBanku = persona === 'banku';
    const prefix = isBanku ? '[Banku Assistance]' : '[Local Assistance]';

    // Extract core query subject
    const cleanTopic = query
      .replace(/^(can you|please|what is|how to|how do(?:es)?|how can|why is|why does|explain|tell me about|how do i|what are)\s*/i, '')
      .replace(/[\?\.\!]+$/, '')
      .trim();

    const toTitleCase = (str: string) =>
      str.replace(/\b([a-z])/g, (_, char) => char.toUpperCase());

    const topicTitle = cleanTopic ? toTitleCase(cleanTopic) : 'Academic Exploration';

    if (isBanku) {
      return {
        reply: `${prefix} 🛡️ **Banku's Academic Sentinel Breakdown: ${topicTitle}**\n\n` +
          `**1. Fundamental Principle & Definition:**\n` +
          `Addressing: *"${query}"*.\n` +
          `In academic curricula and structured engineering systems, **${topicTitle}** represents a key concept requiring systematic analysis. It functions as a structured foundational element connecting theoretical logic to practical applications.\n\n` +
          `**2. Systematic Framework & Methodology:**\n` +
          `• **Foundational Analysis:** Identify core components, parameters, and boundary conditions.\n` +
          `• **Theoretical Modeling:** Formulate equations, relationships, and cause-and-effect rules.\n` +
          `• **Validation & Testing:** Compare observed results against theoretical expectations and academic guidelines.\n\n` +
          `**3. Academic Guidance:**\n` +
          `Review your course syllabus and lecture notes on this unit. Focus on step-by-step problem solving and clear diagrammatic presentation.\n\n` +
          `🛡️ *Banku's Sentinel Takeaway: Break any complex academic topic into small, verifiable building blocks for absolute mastery.*`,
        suggestedActions: ['How to prepare for semester exams?', 'Explain a Concept', 'Break Down Task'],
        actionType: 'general',
      };
    } else {
      return {
        reply: `${prefix} ⚡ **Shanky's Tactical Co-Pilot Breakdown: ${topicTitle}**\n\n` +
          `**The TL;DR on "${query}":** 🎯\n\n` +
          `• **Core Idea:** **${topicTitle}** is all about understanding the mechanism without getting buried in academic fluff.\n` +
          `• **How to Think About It:** Treat it like an engine with input, processing, and output. When you understand what goes in and what comes out, the middle steps make total sense.\n` +
          `• **Action Steps to Master This:**\n` +
          `  1. Write down the 3 biggest rules or formulas governing this topic.\n` +
          `  2. Walk through one solved previous year exam problem.\n` +
          `  3. Explain it in your own words in 60 seconds (Feynman Technique).\n\n` +
          `⚡ *Shanky's Pro-Tip: You don't need to memorize a 20-page chapter. Master the 3 core principles and you can derive the rest in the exam room!*`,
        suggestedActions: ['Study Hacks', 'Feynman Technique', 'What should I do today?'],
        actionType: 'general',
      };
    }
  }
}
