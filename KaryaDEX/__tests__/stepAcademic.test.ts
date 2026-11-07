/**
 * BunkMatKar — StepAcademic & Indian Institutions Directory Unit Tests
 *
 * Verifies:
 * 1. Indian Institution dataset integrity & metadata (City, State, Acronyms, Categories)
 * 2. High-precision institution search engine (fuzzy, acronym, alias, location, and category filters)
 * 3. Degree & branch options structure
 * 4. Attendance benchmark calculation (75%, 80%, 85%, custom cushion)
 * 5. Onboarding draft pipeline persistence of academic structure and institution metadata
 */

import {
  INDIAN_INSTITUTIONS,
  INSTITUTION_CATEGORY_TABS,
  ACADEMIC_PROGRAMS,
  COMMON_BRANCHES,
  ATTENDANCE_BENCHMARKS,
  searchInstitutions,
  getProgramsForInstitution,
  getBranchesForInstitutionAndProgram,
  type IndianInstitution,
} from '../constants/indianInstitutions';
import { onboardingService } from '../services/onboardingService';
import {
  initDatabase,
  resetDatabaseConnectionForTesting,
  subjectRepository,
  onboardingRepository,
} from '../database';

describe('StepAcademic & Indian Institutions Directory', () => {
  beforeEach(async () => {
    resetDatabaseConnectionForTesting();
    await initDatabase();
  });

  describe('1. Dataset Integrity & Spec Compliance', () => {
    it('contains comprehensive institutions with required metadata', () => {
      expect(INDIAN_INSTITUTIONS.length).toBeGreaterThan(60);

      for (const inst of INDIAN_INSTITUTIONS) {
        expect(inst.id).toBeTruthy();
        expect(inst.name).toBeTruthy();
        expect(inst.shortName).toBeTruthy();
        expect(Array.isArray(inst.aliases)).toBe(true);
        expect(inst.city).toBeTruthy();
        expect(inst.state).toBeTruthy();
        expect([
          'IIT',
          'NIT',
          'IIIT',
          'Central',
          'State',
          'Deemed / Private',
          'Medical / Law',
          'Other',
        ]).toContain(inst.category);
      }
    });

    it('includes specific prompt-referenced premier institutions', () => {
      // NIT Agartala (NITA, Agartala, Tripura)
      const nita = INDIAN_INSTITUTIONS.find((i) => i.id === 'nit-agartala');
      expect(nita).toBeDefined();
      expect(nita?.shortName).toBe('NIT Agartala');
      expect(nita?.aliases).toContain('NITA');
      expect(nita?.city).toBe('Agartala');
      expect(nita?.state).toBe('Tripura');
      expect(nita?.category).toBe('NIT');

      // IIT Kharagpur (IITKGP)
      const iitkgp = INDIAN_INSTITUTIONS.find((i) => i.id === 'iit-kharagpur');
      expect(iitkgp).toBeDefined();
      expect(iitkgp?.aliases).toContain('IITKGP');
      expect(iitkgp?.city).toBe('Kharagpur');
      expect(iitkgp?.category).toBe('IIT');

      // Jadavpur University (JU, Kolkata)
      const ju = INDIAN_INSTITUTIONS.find((i) => i.id === 'jadavpur-university');
      expect(ju).toBeDefined();
      expect(ju?.shortName).toBe('Jadavpur University');
      expect(ju?.aliases).toContain('JU');
      expect(ju?.city).toBe('Kolkata');
      expect(ju?.category).toBe('State');

      // BITS Pilani
      const bits = INDIAN_INSTITUTIONS.find((i) => i.id === 'bits-pilani');
      expect(bits).toBeDefined();
      expect(bits?.category).toBe('Central');
    });

    it('contains valid category tabs with feather icon references', () => {
      expect(INSTITUTION_CATEGORY_TABS.length).toBe(8);
      const keys = INSTITUTION_CATEGORY_TABS.map((t) => t.key);
      expect(keys).toContain('All');
      expect(keys).toContain('IIT');
      expect(keys).toContain('NIT');
      expect(keys).toContain('IIIT');
      expect(keys).toContain('State');
      expect(keys).toContain('Deemed / Private');
      expect(keys).toContain('Medical / Law');
    });
  });

  describe('2. Institution Search & Category Filtering Engine', () => {
    it('finds institution by full name', () => {
      const results = searchInstitutions('National Institute of Technology Agartala');
      expect(results.length).toBeGreaterThan(0);
      expect(results[0].id).toBe('nit-agartala');
    });

    it('finds institution by acronym alias (e.g. NITA, IITKGP, JU)', () => {
      const nitaResults = searchInstitutions('nita');
      expect(nitaResults.some((i) => i.id === 'nit-agartala')).toBe(true);

      const iitkgpResults = searchInstitutions('iitkgp');
      expect(iitkgpResults.some((i) => i.id === 'iit-kharagpur')).toBe(true);

      const juResults = searchInstitutions('ju');
      expect(juResults.some((i) => i.id === 'jadavpur-university')).toBe(true);
    });

    it('finds institution by city or state', () => {
      const tripuraResults = searchInstitutions('tripura');
      expect(tripuraResults.some((i) => i.id === 'nit-agartala')).toBe(true);

      const kolkataResults = searchInstitutions('kolkata');
      expect(kolkataResults.some((i) => i.id === 'jadavpur-university')).toBe(true);
      expect(kolkataResults.some((i) => i.id === 'calcutta-university')).toBe(true);
    });

    it('filters strictly by category', () => {
      const iits = searchInstitutions('', 'IIT');
      expect(iits.every((i) => i.category === 'IIT')).toBe(true);
      expect(iits.length).toBeGreaterThan(15);

      const nits = searchInstitutions('', 'NIT');
      expect(nits.every((i) => i.category === 'NIT')).toBe(true);
      expect(nits.some((i) => i.id === 'nit-agartala')).toBe(true);

      // Category + Search query combined
      const filtered = searchInstitutions('Bombay', 'IIT');
      expect(filtered.length).toBe(1);
      expect(filtered[0].id).toBe('iit-bombay');
    });
  });

  describe('3. Attendance Benchmarks & Safety Cushion Metrics', () => {
    it('provides accurate benchmark models matching 2.png aesthetics', () => {
      expect(ATTENDANCE_BENCHMARKS.length).toBe(3);

      const standard = ATTENDANCE_BENCHMARKS.find((b) => b.percent === 75);
      expect(standard).toBeDefined();
      expect(standard?.color).toBe('#10B981'); // Emerald
      expect(standard?.debarRisk).toBe('Zero');

      const safe = ATTENDANCE_BENCHMARKS.find((b) => b.percent === 80);
      expect(safe).toBeDefined();
      expect(safe?.color).toBe('#06B6D4'); // Cyan
      expect(safe?.safetyCushion).toContain('+5.0%');

      const elite = ATTENDANCE_BENCHMARKS.find((b) => b.percent === 85);
      expect(elite).toBeDefined();
      expect(elite?.safetyCushion).toContain('+10.0%');
    });
  });

  describe('4. Canonical Persistence of Academic & College Metadata', () => {
    it('persists selected institution, branch, and attendance policy into draft data', async () => {
      await onboardingService.startOnboarding(false);

      const academicPayload = {
        program: 'B.Tech / B.E.',
        branch: 'Computer Science & Engineering',
        year: 2,
        semesterNumber: 3,
        semesterName: 'Semester 3',
        section: 'Section A',
        academicYear: '2026-2027',
        startDate: '2026-07-20',
        endDate: '2026-12-15',
        attendanceTarget: 80,
        attendancePolicy: 'Safety Cushion Harbor (80%)',
      };

      const collegePayload = {
        name: 'National Institute of Technology Agartala',
        shortName: 'NIT Agartala',
        city: 'Agartala',
        state: 'Tripura',
        category: 'NIT',
        campus: 'Agartala',
      };

      const updated = await onboardingService.saveStepData(
        'academic',
        {
          academic: academicPayload,
          college: collegePayload,
          attendance: { target: 80 },
        },
        'subjects'
      );

      expect(updated.draftData.academic?.program).toBe('B.Tech / B.E.');
      expect(updated.draftData.academic?.branch).toBe('Computer Science & Engineering');
      expect(updated.draftData.academic?.semesterNumber).toBe(3);
      expect(updated.draftData.academic?.attendanceTarget).toBe(80);
      expect(updated.draftData.college?.name).toBe('National Institute of Technology Agartala');
      expect(updated.draftData.college?.city).toBe('Agartala');
      expect(updated.draftData.college?.category).toBe('NIT');
      expect(updated.draftData.attendance?.target).toBe(80);
    });

    it('commits enriched college location and academic profile to SQLite', async () => {
      const draft = {
        profile: { name: 'Saikat Roy', email: 'saikat@nita.ac.in', academicYear: '2026-27' },
        college: {
          name: 'National Institute of Technology Agartala',
          shortName: 'NITA',
          city: 'Agartala',
          state: 'Tripura',
          category: 'NIT',
          campus: 'Agartala',
        },
        academic: {
          program: 'B.Tech / B.E.',
          branch: 'Production Engineering',
          year: 2,
          semesterNumber: 3,
          semesterName: 'Semester 3',
          section: 'Batch 1',
          academicYear: '2026-27',
          attendanceTarget: 80,
        },
        subjects: [
          {
            id: 'subj-1',
            name: 'Manufacturing Science',
            shortName: 'MFG',
            code: 'PE301',
            color: '#10B981',
            credits: 4,
          },
        ],
        attendance: { target: 80 },
      };

      await onboardingService.finalizeOnboarding(draft);

      // Verify College committed in SQLite
      const college = await subjectRepository.getCollege();
      expect(college).not.toBeNull();
      expect(college?.name).toBe('National Institute of Technology Agartala');
      expect(college?.shortName).toBe('NITA');
      expect(college?.city).toBe('Agartala');
      expect(college?.state).toBe('Tripura');
      expect(college?.category).toBe('NIT');

      // Verify Student Profile committed in SQLite
      const student = await subjectRepository.getStudent();
      expect(student).not.toBeNull();
      expect(student?.name).toBe('Saikat Roy');
      expect(student?.program).toBe('B.Tech / B.E.');
      expect(student?.branch).toBe('Production Engineering');
      expect(student?.attendanceTarget).toBe(80);
      expect(student?.section).toBe('Batch 1');
      expect(student?.year).toBe(2);

      // Verify Semester committed in SQLite
      const semester = await subjectRepository.getSemester();
      expect(semester).not.toBeNull();
      expect(semester?.name).toBe('Semester 3');
      expect(semester?.number).toBe(3);
    });
  });

  describe('5. College-Specific Degree & Branch Offerings Engine', () => {
    it('scopes degrees accurately for NITs including NIT Agartala', () => {
      const nita = INDIAN_INSTITUTIONS.find((i) => i.id === 'nit-agartala');
      expect(nita).toBeDefined();

      const programs = getProgramsForInstitution(nita);
      expect(programs).toContain('B.Tech');
      expect(programs).toContain('M.Tech');
      expect(programs).toContain('MCA');
      expect(programs).toContain('BS-MS Dual Degree');
      expect(programs).toContain('Ph.D');

      // Verify Production Engineering is included in NIT Agartala B.Tech branches
      const btechBranches = getBranchesForInstitutionAndProgram(nita, 'B.Tech');
      expect(btechBranches).toContain('Production Engineering');
      expect(btechBranches).toContain('Computer Science & Engineering');
      expect(btechBranches).toContain('Electrical Engineering');
      expect(btechBranches).toContain('Electronics & Communication Engineering');
      expect(btechBranches).toContain('Mechanical Engineering');
      expect(btechBranches).toContain('Chemical Engineering');
      expect(btechBranches).toContain('Civil Engineering');
      expect(btechBranches).toContain('Biotechnology & Biochemical Engineering');
    });

    it('scopes degrees and branches for IITs', () => {
      const iitkgp = INDIAN_INSTITUTIONS.find((i) => i.id === 'iit-kharagpur');
      expect(iitkgp).toBeDefined();

      const programs = getProgramsForInstitution(iitkgp);
      expect(programs).toContain('B.Tech');
      expect(programs).toContain('Dual Degree (B.Tech + M.Tech)');
      expect(programs).toContain('M.Tech');
      expect(programs).toContain('M.Sc');

      const branches = getBranchesForInstitutionAndProgram(iitkgp, 'B.Tech');
      expect(branches).toContain('Computer Science & Engineering');
      expect(branches).toContain('Aerospace Engineering');
      expect(branches).toContain('Ocean Engineering & Naval Architecture');
      expect(branches).toContain('Mining Engineering');
    });

    it('scopes degrees and specialized branches for IIITs', () => {
      const iiita = INDIAN_INSTITUTIONS.find((i) => i.id === 'iiit-allahabad');
      expect(iiita).toBeDefined();

      const programs = getProgramsForInstitution(iiita);
      expect(programs).toContain('B.Tech');
      expect(programs).toContain('M.Tech');
      expect(programs).toContain('Ph.D');

      const branches = getBranchesForInstitutionAndProgram(iiita, 'B.Tech');
      expect(branches).toContain('Information Technology');
      expect(branches).toContain('Computer Science & Engineering');
      expect(branches).toContain('Artificial Intelligence & Data Science');
      expect(branches).not.toContain('Civil Engineering');
    });

    it('scopes comprehensive undergraduate and postgraduate degrees for Central & State Universities', () => {
      const ju = INDIAN_INSTITUTIONS.find((i) => i.id === 'jadavpur-university');
      expect(ju).toBeDefined();

      const programs = getProgramsForInstitution(ju);
      expect(programs).toContain('B.Tech');
      expect(programs).toContain('B.E.');
      expect(programs).toContain('B.Sc');
      expect(programs).toContain('B.A.');
      expect(programs).toContain('BCA');
      expect(programs).toContain('M.Tech');

      const bscBranches = getBranchesForInstitutionAndProgram(ju, 'B.Sc');
      expect(bscBranches).toContain('Physics');
      expect(bscBranches).toContain('Chemistry');
      expect(bscBranches).toContain('Mathematics');
    });

    it('scopes professional degrees for Medical and Law institutions', () => {
      const aiims = INDIAN_INSTITUTIONS.find((i) => i.id === 'aiims-delhi');
      expect(aiims).toBeDefined();

      const medicalPrograms = getProgramsForInstitution(aiims);
      expect(medicalPrograms).toContain('MBBS');
      expect(medicalPrograms).toContain('MD / MS');
      expect(medicalPrograms).not.toContain('B.Tech');

      const mbbsBranches = getBranchesForInstitutionAndProgram(aiims, 'MBBS');
      expect(mbbsBranches).toContain('Medicine & Surgery (General)');
    });

    it('provides graceful fallbacks when institution or program is unspecified', () => {
      const fallbackPrograms = getProgramsForInstitution(null);
      expect(fallbackPrograms.length).toBeGreaterThan(5);
      expect(fallbackPrograms).toContain('B.Tech / B.E.');

      const fallbackBranches = getBranchesForInstitutionAndProgram(null, 'Unknown Program');
      expect(fallbackBranches.length).toBeGreaterThan(5);
      expect(fallbackBranches).toContain('Computer Science & Engineering');
    });
  });
});
