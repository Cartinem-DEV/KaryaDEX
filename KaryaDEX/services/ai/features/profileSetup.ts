/**
 * BunkMatKar — Feature 2: Natural-Language Profile Setup (Phase 12 Shanky MVP)
 *
 * Student types or speaks their background in natural language ->
 * Shanky extracts candidate profile & subjects ->
 * Schema validation ->
 * AIProposal created ->
 * User preview & confirmation ->
 * Transactional save via Subject/Settings repositories.
 */

import { subjectRepository, settingsRepository } from '@/database';
import { aiClient } from '../core/aiClient';
import { AIValidation } from '../core/aiValidation';
import { buildProfileSetupPrompt } from '../prompts/shankyPrompts';
import type {
  AIProposal,
  AIResponse,
  ProfileSetupProposalPayload,
} from '../core/aiTypes';
import { useAppStore } from '@/store/useAppStore';

export class ProfileSetupFeature {
  /**
   * Extracts profile setup information from natural language input.
   */
  static async extractProfileProposal(params: {
    userId: string;
    userInput: string;
  }): Promise<AIResponse<ProfileSetupProposalPayload>> {
    const prompt = buildProfileSetupPrompt(params.userInput);
    const schemaDesc = `{"studentName": string, "collegeName": string, "program": string, "semesterName": string, "attendanceTarget": number, "subjects": [{"name": string, "code": string}]}`;

    const rawResponse = await aiClient.executeStructured<ProfileSetupProposalPayload>({
      request: {
        userId: params.userId,
        persona: 'shanky',
        feature: 'profile_setup',
      },
      prompt,
      schemaDescription: schemaDesc,
    });

    const validated = AIValidation.validateProfileSetup(rawResponse.data);

    const proposal: AIProposal<ProfileSetupProposalPayload> = {
      id: `prop_prof_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
      type: 'UPDATE_PROFILE',
      title: 'Setup College Profile',
      description: 'Extracted from your description by Shanky. Review and confirm details below.',
      status: 'pending',
      createdAt: new Date().toISOString(),
      userId: params.userId,
      payload: validated,
    };

    return {
      ...rawResponse,
      data: validated,
      proposal,
    };
  }

  /**
   * Applies the approved profile proposal to the database.
   * Requires explicit user confirmation.
   */
  static async applyApprovedProposal(
    proposal: AIProposal<ProfileSetupProposalPayload>
  ): Promise<{ appliedSubjectsCount: number }> {
    if (proposal.status === 'applied') {
      throw new Error('This profile proposal has already been applied.');
    }

    const { payload } = proposal;

    // 1. Update Student Profile
    const currentStudent = await subjectRepository.getStudent();
    if (payload.studentName || payload.collegeName || payload.program) {
      await subjectRepository.saveStudent({
        id: currentStudent?.id || `student_${Date.now()}`,
        name: payload.studentName || currentStudent?.name || 'Student',
        email: currentStudent?.email || '',
        collegeId: currentStudent?.collegeId || 'college-1',
        semesterId: currentStudent?.semesterId || 'sem-1',
        attendanceTarget: payload.attendanceTarget || currentStudent?.attendanceTarget || 75,
        program: payload.program || currentStudent?.program,
        branch: currentStudent?.branch,
        year: currentStudent?.year,
        section: currentStudent?.section,
        academicYear: currentStudent?.academicYear,
        createdAt: currentStudent?.createdAt || new Date().toISOString(),
      });
    }

    // 2. Set default attendance target
    if (payload.attendanceTarget) {
      await settingsRepository.setSetting('attendance_target', String(payload.attendanceTarget));
    }

    // 3. Create proposed subjects
    let appliedSubjectsCount = 0;
    if (payload.subjects && payload.subjects.length > 0) {
      const existing = await subjectRepository.getSubjects();
      const existingNames = new Set(existing.map(s => s.name.toLowerCase().trim()));

      for (const subj of payload.subjects) {
        if (!existingNames.has(subj.name.toLowerCase().trim())) {
          await subjectRepository.createSubject({
            id: `subj_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`,
            name: subj.name,
            shortName: subj.name.slice(0, 4).toUpperCase(),
            code: subj.code || subj.name.slice(0, 3).toUpperCase(),
            color: '#10B981',
            semesterId: currentStudent?.semesterId || 'sem-1',
            facultyId: '',
            credits: 3,
            targetAttendance: payload.attendanceTarget || 75,
          });
          appliedSubjectsCount++;
        }
      }
    }

    proposal.status = 'applied';
    proposal.appliedAt = new Date().toISOString();

    // Refresh reactive stores so UI immediately displays new subjects & profile
    await useAppStore.getState().refreshFromDatabase().catch(err => {
      console.warn('[ProfileSetup] Error refreshing stores:', err);
    });

    return { appliedSubjectsCount };
  }
}
