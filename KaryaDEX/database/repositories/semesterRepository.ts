/**
 * BunkMatKar — Semester Repository (Phase 6)
 *
 * Provides dedicated data access for multi-semester management:
 * - getCurrentSemester
 * - getAllSemesters
 * - getSemesterById
 * - saveSemester
 * - setCurrentSemester
 * - getSubjectsForSemester
 * - getSemesterAcademicSnapshot
 */

import { subjectRepository } from './subjectRepository';
import { academicAnalyticsService } from '@/services/academicAnalyticsService';
import type { Semester, Subject } from '@/types';
import type { SemesterAcademicSnapshot } from '@/types/academic';

export class SemesterRepository {
  async getCurrentSemester(): Promise<Semester | null> {
    return subjectRepository.getCurrentSemester();
  }

  async getAllSemesters(): Promise<Semester[]> {
    return subjectRepository.getAllSemesters();
  }

  async getSemesterById(id: string): Promise<Semester | null> {
    return subjectRepository.getSemesterById(id);
  }

  async saveSemester(semester: Semester): Promise<void> {
    return subjectRepository.saveSemester(semester);
  }

  async updateSemester(id: string, updates: Partial<Semester>): Promise<void> {
    const sem = await this.getSemesterById(id);
    if (!sem) return;
    const merged: Semester = { ...sem, ...updates };
    return this.saveSemester(merged);
  }

  async setCurrentSemester(id: string): Promise<void> {
    return subjectRepository.setCurrentSemester(id);
  }

  async getSubjectsForSemester(semesterId: string, includeArchived = false): Promise<Subject[]> {
    return subjectRepository.getSubjectsForSemester(semesterId, includeArchived);
  }

  async getSemesterAcademicSnapshot(semesterId: string): Promise<SemesterAcademicSnapshot> {
    const sem = await this.getSemesterById(semesterId);
    const subjects = await this.getSubjectsForSemester(semesterId, true);
    return academicAnalyticsService.getSemesterAcademicSnapshot({
      semester: sem || undefined,
      subjects,
    });
  }
}

export const semesterRepository = new SemesterRepository();
