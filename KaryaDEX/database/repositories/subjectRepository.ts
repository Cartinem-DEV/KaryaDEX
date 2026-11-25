/**
 * KaryaDEX — Subject & College/Semester Repository
 */

import { getDatabaseConnection } from '../db';
import type { SubjectRow } from '../types';
import type { Subject, College, Semester, User } from '@/types';

export class SubjectRepository {
  async getSubjects(includeArchived = false, semesterId?: string): Promise<Subject[]> {
    const db = await getDatabaseConnection();
    let sql: string;
    let params: any[] = [];

    if (semesterId) {
      sql = includeArchived
        ? `SELECT * FROM subjects WHERE semester_id = ? ORDER BY name ASC;`
        : `SELECT * FROM subjects WHERE semester_id = ? AND is_archived = 0 ORDER BY name ASC;`;
      params = [semesterId];
    } else {
      sql = includeArchived
        ? `SELECT * FROM subjects ORDER BY name ASC;`
        : `SELECT * FROM subjects WHERE is_archived = 0 ORDER BY name ASC;`;
    }
    
    const rows = await db.getAllAsync<SubjectRow>(sql, params);
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      shortName: r.short_name,
      code: r.code,
      color: r.color,
      semesterId: r.semester_id || 'sem-3',
      facultyId: r.faculty_id || '',
      facultyName: r.faculty_name || undefined,
      room: r.room || undefined,
      credits: r.credits,
      isArchived: r.is_archived === 1,
      subjectType: (r.subject_type as any) || 'lecture',
      targetAttendance: r.target_attendance || undefined,
    }));
  }

  async getSubjectsForSemester(semesterId: string, includeArchived = false): Promise<Subject[]> {
    return this.getSubjects(includeArchived, semesterId);
  }

  async getActiveSubjects(semesterId?: string): Promise<Subject[]> {
    return this.getSubjects(false, semesterId);
  }

  async getArchivedSubjects(semesterId?: string): Promise<Subject[]> {
    const db = await getDatabaseConnection();
    const sql = semesterId
      ? `SELECT * FROM subjects WHERE semester_id = ? AND is_archived = 1 ORDER BY name ASC;`
      : `SELECT * FROM subjects WHERE is_archived = 1 ORDER BY name ASC;`;
    const params = semesterId ? [semesterId] : [];
    const rows = await db.getAllAsync<SubjectRow>(sql, params);
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      shortName: r.short_name,
      code: r.code,
      color: r.color,
      semesterId: r.semester_id || 'sem-3',
      facultyId: r.faculty_id || '',
      facultyName: r.faculty_name || undefined,
      room: r.room || undefined,
      credits: r.credits,
      isArchived: true,
      subjectType: (r.subject_type as any) || 'lecture',
      targetAttendance: r.target_attendance || undefined,
    }));
  }

  async getSubjectById(id: string): Promise<Subject | null> {
    const db = await getDatabaseConnection();
    const r = await db.getFirstAsync<SubjectRow>(
      `SELECT * FROM subjects WHERE id = ?;`,
      [id]
    );
    if (!r) return null;
    return {
      id: r.id,
      name: r.name,
      shortName: r.short_name,
      code: r.code,
      color: r.color,
      semesterId: r.semester_id || 'sem-3',
      facultyId: r.faculty_id || '',
      facultyName: r.faculty_name || undefined,
      room: r.room || undefined,
      credits: r.credits,
      isArchived: r.is_archived === 1,
      subjectType: (r.subject_type as any) || 'lecture',
      targetAttendance: r.target_attendance || undefined,
    };
  }

  async createSubject(subject: Subject): Promise<Subject> {
    const db = await getDatabaseConnection();
    await db.runAsync(
      `INSERT INTO subjects (id, name, short_name, code, color, semester_id, faculty_id, faculty_name, room, credits, is_archived, subject_type, target_attendance, created_at, updated_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0, ?, ?, datetime('now'), datetime('now'));`,
      [
        subject.id,
        subject.name,
        subject.shortName,
        subject.code,
        subject.color,
        subject.semesterId,
        subject.facultyId || null,
        subject.facultyName || null,
        subject.room || null,
        subject.credits,
        subject.subjectType || 'lecture',
        subject.targetAttendance || null,
      ]
    );
    return subject;
  }

  async updateSubject(id: string, updates: Partial<Subject>): Promise<void> {
    const db = await getDatabaseConnection();
    const current = await this.getSubjectById(id);
    if (!current) return;

    const merged = { ...current, ...updates };
    await db.runAsync(
      `UPDATE subjects SET name = ?, short_name = ?, code = ?, color = ?, semester_id = ?, faculty_id = ?, faculty_name = ?, room = ?, credits = ?, subject_type = ?, target_attendance = ?, updated_at = datetime('now')
       WHERE id = ?;`,
      [
        merged.name,
        merged.shortName,
        merged.code,
        merged.color,
        merged.semesterId,
        merged.facultyId || null,
        merged.facultyName || null,
        merged.room || null,
        merged.credits,
        merged.subjectType || 'lecture',
        merged.targetAttendance || null,
        id,
      ]
    );
  }

  async archiveSubject(id: string): Promise<void> {
    const db = await getDatabaseConnection();
    await db.runAsync(
      `UPDATE subjects SET is_archived = 1, updated_at = datetime('now') WHERE id = ?;`,
      [id]
    );
  }

  async unarchiveSubject(id: string): Promise<void> {
    const db = await getDatabaseConnection();
    await db.runAsync(
      `UPDATE subjects SET is_archived = 0, updated_at = datetime('now') WHERE id = ?;`,
      [id]
    );
  }

  async getCollege(): Promise<College | null> {
    const db = await getDatabaseConnection();
    const row = await db.getFirstAsync<{
      id: string;
      name: string;
      short_name: string;
      university_board?: string;
      campus?: string;
      city?: string;
      state?: string;
      category?: string;
    }>(
      `SELECT * FROM colleges LIMIT 1;`
    );
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      shortName: row.short_name,
      universityBoard: row.university_board || undefined,
      campus: row.campus || undefined,
      city: row.city || undefined,
      state: row.state || undefined,
      category: row.category || undefined,
    };
  }

  async saveCollege(college: College): Promise<void> {
    const db = await getDatabaseConnection();
    await db.runAsync(
      `INSERT INTO colleges (id, name, short_name, university_board, campus, city, state, category) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         short_name = excluded.short_name,
         university_board = excluded.university_board,
         campus = excluded.campus,
         city = excluded.city,
         state = excluded.state,
         category = excluded.category;`,
      [
        college.id,
        college.name,
        college.shortName,
        college.universityBoard || null,
        college.campus || null,
        college.city || null,
        college.state || null,
        college.category || null,
      ]
    );
  }

  async getSemester(): Promise<Semester | null> {
    const db = await getDatabaseConnection();
    // Prioritize current semester
    const row = await db.getFirstAsync<{
      id: string;
      name: string;
      number: number;
      start_date: string;
      end_date: string;
      college_id: string;
      academic_year?: string;
      is_current?: number;
      status?: string | null;
    }>(`SELECT * FROM semesters ORDER BY is_current DESC, number DESC LIMIT 1;`);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      number: row.number,
      startDate: row.start_date,
      endDate: row.end_date,
      collegeId: row.college_id,
      academicYear: row.academic_year || undefined,
      isCurrent: row.is_current === 1,
      status: (row.status as Semester['status']) || 'current',
    };
  }

  async getCurrentSemester(): Promise<Semester | null> {
    return this.getSemester();
  }

  async getSemesterById(id: string): Promise<Semester | null> {
    const db = await getDatabaseConnection();
    const row = await db.getFirstAsync<{
      id: string;
      name: string;
      number: number;
      start_date: string;
      end_date: string;
      college_id: string;
      academic_year?: string;
      is_current?: number;
      status?: string | null;
    }>(`SELECT * FROM semesters WHERE id = ? LIMIT 1;`, [id]);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      number: row.number,
      startDate: row.start_date,
      endDate: row.end_date,
      collegeId: row.college_id,
      academicYear: row.academic_year || undefined,
      isCurrent: row.is_current === 1,
      status: (row.status as Semester['status']) || 'current',
    };
  }

  async getAllSemesters(): Promise<Semester[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<{
      id: string;
      name: string;
      number: number;
      start_date: string;
      end_date: string;
      college_id: string;
      academic_year?: string;
      is_current?: number;
      status?: string | null;
    }>(`SELECT * FROM semesters ORDER BY number ASC;`);
    return rows.map(r => ({
      id: r.id,
      name: r.name,
      number: r.number,
      startDate: r.start_date,
      endDate: r.end_date,
      collegeId: r.college_id,
      academicYear: r.academic_year || undefined,
      isCurrent: r.is_current === 1,
      status: (r.status as Semester['status']) || 'current',
    }));
  }

  async saveSemester(semester: Semester): Promise<void> {
    const db = await getDatabaseConnection();
    const isCurrentVal = semester.isCurrent === false ? 0 : 1;
    if (isCurrentVal === 1) {
      await db.runAsync(`UPDATE semesters SET is_current = 0;`);
    }
    const statusVal = semester.status || (isCurrentVal === 1 ? 'current' : 'completed');
    await db.runAsync(
      `INSERT INTO semesters (id, name, number, start_date, end_date, college_id, academic_year, is_current, status)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET name = excluded.name, number = excluded.number, start_date = excluded.start_date, end_date = excluded.end_date, academic_year = excluded.academic_year, is_current = excluded.is_current, status = excluded.status;`,
      [semester.id, semester.name, semester.number, semester.startDate, semester.endDate, semester.collegeId, semester.academicYear || null, isCurrentVal, statusVal]
    );
  }

  async setCurrentSemester(id: string): Promise<void> {
    const db = await getDatabaseConnection();
    await db.withTransactionAsync(async () => {
      await db.runAsync(`UPDATE semesters SET is_current = 0;`);
      await db.runAsync(`UPDATE semesters SET is_current = 1, status = 'current' WHERE id = ?;`, [id]);
      await db.runAsync(`UPDATE students SET semester_id = ?;`, [id]);
    });
  }

  async getStudent(): Promise<User | null> {
    const db = await getDatabaseConnection();
    const row = await db.getFirstAsync<{
      id: string;
      name: string;
      email: string;
      avatar_url: string | null;
      college_id: string;
      semester_id: string;
      attendance_target: number;
      program?: string | null;
      branch?: string | null;
      year?: number | null;
      section?: string | null;
      academic_year?: string | null;
      created_at: string;
    }>(`SELECT * FROM students LIMIT 1;`);
    if (!row) return null;
    return {
      id: row.id,
      name: row.name,
      email: row.email,
      avatarUrl: row.avatar_url || undefined,
      collegeId: row.college_id,
      semesterId: row.semester_id,
      attendanceTarget: row.attendance_target,
      program: row.program || undefined,
      branch: row.branch || undefined,
      year: row.year || undefined,
      section: row.section || undefined,
      academicYear: row.academic_year || undefined,
      createdAt: row.created_at,
    };
  }

  async saveStudent(student: User): Promise<void> {
    const db = await getDatabaseConnection();
    await db.runAsync(
      `INSERT INTO students (id, name, email, avatar_url, college_id, semester_id, attendance_target, program, branch, year, section, academic_year, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
       ON CONFLICT(id) DO UPDATE SET
         name = excluded.name,
         email = excluded.email,
         avatar_url = excluded.avatar_url,
         attendance_target = excluded.attendance_target,
         program = excluded.program,
         branch = excluded.branch,
         year = excluded.year,
         section = excluded.section,
         academic_year = excluded.academic_year;`,
      [
        student.id,
        student.name,
        student.email,
        student.avatarUrl || null,
        student.collegeId,
        student.semesterId,
        student.attendanceTarget,
        student.program || null,
        student.branch || null,
        student.year || null,
        student.section || null,
        student.academicYear || null,
        student.createdAt,
      ]
    );
  }
}

export const subjectRepository = new SubjectRepository();
