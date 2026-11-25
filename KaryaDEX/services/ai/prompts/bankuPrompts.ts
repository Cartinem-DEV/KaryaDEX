/**
 * KaryaDEX — Banku Specialized Prompts (Phase 12)
 *
 * Prompts for multimodal timetable & document extraction.
 */

import { buildSecuredPrompt } from './systemPolicy';
import { BANKU_SYSTEM_INSTRUCTION, BANKU_CHAT_SYSTEM_INSTRUCTION } from '../personas/banku';

export function buildTimetableExtractionPrompt(existingSubjects: string[] = []): string {
  const schemaDescription = `
Return ONLY valid JSON matching this exact structure:
{
  "slots": [
    {
      "dayOfWeek": "monday" | "tuesday" | "wednesday" | "thursday" | "friday" | "saturday" | "sunday",
      "startTime": "HH:MM" (24-hour format e.g. "09:00"),
      "endTime": "HH:MM" (24-hour format e.g. "10:00"),
      "subjectName": string,
      "subjectCode": string (optional),
      "room": string (optional),
      "teacher": string (optional),
      "type": "lecture" | "lab" | "tutorial" | "other",
      "confidence": number between 0.0 and 1.0
    }
  ]
}
`.trim();

  return buildSecuredPrompt({
    personaInstruction: BANKU_SYSTEM_INSTRUCTION,
    trustedData: {
      registeredSubjects: existingSubjects,
      requiredSchema: schemaDescription,
    },
    userRequest: `Extract all academic periods/classes shown in the uploaded timetable image or PDF document into the structured schema.
Normalize all day names to lowercase full day names (e.g. 'monday', 'tuesday').
Convert all times to 24-hour 'HH:MM' strings (e.g. '09:00', '14:30').
If a subject matches one of the registered subjects, prioritize using that name.
Do not invent periods that are not clearly present in the document.`,
  });
}

export function buildSyllabusExtractionPrompt(targetSubjectName?: string, existingSubjects: string[] = []): string {
  const schemaDescription = `
Return ONLY valid JSON matching this exact structure:
{
  "subjectName": string,
  "subjectCode": string (optional),
  "credits": number (optional, e.g. 4),
  "units": [
    {
      "name": string,
      "topics": [
        {
          "name": string,
          "subtopics": string[] (optional)
        }
      ]
    }
  ],
  "subjects": [
    {
      "subjectName": string,
      "subjectCode": string (optional),
      "credits": number (optional),
      "category": string (optional),
      "units": [
        {
          "name": string,
          "topics": [
            {
              "name": string,
              "subtopics": string[] (optional)
            }
          ]
        }
      ]
    }
  ]
}
`.trim();

  return buildSecuredPrompt({
    personaInstruction: BANKU_SYSTEM_INSTRUCTION,
    trustedData: {
      targetSubject: targetSubjectName,
      registeredSubjects: existingSubjects,
      requiredSchema: schemaDescription,
    },
    userRequest: `Analyze all attached documents/photos together, extract all subjects (Subject Name, Subject Code, Credits/Category, and Syllabus Units/Topics), and merge/deduplicate subjects that appear across multiple pages or files.
Organize content hierarchically into Subjects -> Units -> Topics -> Subtopics.
Preserve the exact official topic naming and academic ordering as printed in the document.
Do not mark topics as taught, revised, or mastered. Only extract the curriculum structure.`,
  });
}

export function buildCalendarExtractionPrompt(): string {
  const schemaDescription = `
Return ONLY valid JSON matching this exact structure:
{
  "semesterName": string (optional),
  "startDate": "YYYY-MM-DD" (optional),
  "endDate": "YYYY-MM-DD" (optional),
  "holidays": [
    {
      "date": "YYYY-MM-DD",
      "name": string,
      "isOfficial": boolean,
      "confidence": number between 0.0 and 1.0
    }
  ],
  "exams": [
    {
      "title": string,
      "startDate": "YYYY-MM-DD",
      "endDate": "YYYY-MM-DD" (optional),
      "type": "internal" | "final" | "practical" | "other"
    }
  ],
  "deadlines": [
    {
      "title": string,
      "date": "YYYY-MM-DD"
    }
  ]
}
`.trim();

  return buildSecuredPrompt({
    personaInstruction: BANKU_SYSTEM_INSTRUCTION,
    trustedData: {
      requiredSchema: schemaDescription,
    },
    userRequest: `Extract the official academic calendar, college holidays, examination periods, and academic milestones from the uploaded official notice or document.
Rules:
1. ONLY extract dates that are explicitly printed in the document.
2. DO NOT invent dates or assume generic regional holidays apply unless stated.
3. Normalize all dates to standard "YYYY-MM-DD" format.
4. If a holiday or event date is uncertain or ambiguously printed, mark confidence lower (e.g. 0.6).`,
  });
}

export function buildBankuChatPrompt(
  userMessage: string,
  conversationHistory?: Array<{ sender: 'user' | 'assistant'; text: string }>
): string {
  const schemaDescription = `
Return ONLY valid JSON matching this exact structure:
{
  "reply": string,
  "suggestedActions": string[],
  "proposal": {
    "type": "IMPORT_TIMETABLE" | "CREATE_TASK" | "CREATE_SUBTASKS" | "UPDATE_PROFILE" | "IMPORT_SYLLABUS" | "IMPORT_CALENDAR",
    "title": string,
    "description": string,
    "payload": any
  } (optional)
}
`.trim();

  const historyText = conversationHistory && conversationHistory.length > 0
    ? conversationHistory.slice(-4).map(m => `${m.sender === 'user' ? 'Student' : 'Banku'}: ${m.text}`).join('\n')
    : undefined;

  return buildSecuredPrompt({
    personaInstruction: BANKU_CHAT_SYSTEM_INSTRUCTION,
    trustedData: {
      zeroDirectWriteRule: 'AI cannot write directly to SQLite. Proposals require user approval.',
      recentConversation: historyText,
      requiredSchema: schemaDescription,
    },
    untrustedContent: [
      { tag: 'student_chat_message', content: userMessage },
    ],
    userRequest: `Respond to the student's message: "${userMessage}".
If the student asks to clear, reset, delete, or modify data:
1. Explain the action clearly in "reply".
2. Return a proposal draft or confirmation request in "proposal" for the user to review and confirm.
3. NEVER claim the database has already been changed.
Otherwise, provide a thorough, accurate, structured academic response in Banku's resolute sentinel persona. You can answer ANY type of question (computer science, engineering, physics, mathematics, chemistry, exam strategy, concepts, formulas, formal emails, or academic queries).`,
  });
}

