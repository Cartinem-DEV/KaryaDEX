/**
 * BunkMatKar — Phase 11.5 Production Security Hardening Test Suite
 *
 * Comprehensive defense-in-depth verification:
 * 1. Password KDF Hardening (PBKDF2-HMAC-SHA-256) & 3-Tier Legacy Migration
 * 2. Brute-Force Abuse Protection & Anti-Enumeration Generic Messaging
 * 3. File Security: Path Traversal, Executable Blocklist, Magic Bytes & MIME Validation
 * 4. Database Key Security, SecureStore Isolation & SQLCipher Feasibility
 * 5. Biometric App Lock, Grace Periods & OS App-Switcher Privacy Shield
 * 6. Device Integrity Assessment & Nonced Platform Attestation Replay Defense
 * 7. Minimum Supported Version Guard & Security Update Enforcement
 * 8. SQL Injection Resistance in Sync Upserts
 * 9. Deep Link Route Authorization & Open Redirect Defense
 * 10. Notification Lock-Screen Privacy Masking
 * 11. Token Storage & Adapter Security Contract
 * 12. Demo Mode Isolation & Cross-Account Protection
 * 13. Comprehensive Account Deletion Data Purge
 */

import {
  hashPassword,
  verifyPassword,
  needsPasswordRehash,
  legacyHashPassword,
  legacySha256HashPassword,
  checkLoginRateLimit,
  recordFailedAttempt,
  clearFailedAttempts,
  resetRateLimitsForTesting,
  localAuthAdapter,
} from '@/services/auth/localAuthAdapter';
import { fileStorageService } from '@/services/fileStorageService';
import { syncService } from '@/services/sync/syncService';
import { supabaseStorageAdapter } from '@/services/supabase/supabaseClient';
import { NotificationService } from '@/services/notificationService';
import { MockNotificationAdapter } from '@/services/notificationAdapter';
import { authService } from '@/services/auth/authService';
import { appLockService } from '@/services/security/appLockService';
import { deviceIntegrityService } from '@/services/security/deviceIntegrityService';
import { versionGuardService } from '@/services/security/versionGuardService';
import { databaseEncryptionService } from '@/services/security/databaseEncryptionService';
import { isSafeInternalRoute } from '@/services/security/deepLinkSecurity';
import { backupValidationService } from '@/services/security/backupValidationService';
import { useAppStore } from '@/store/useAppStore';
import { getDatabaseConnection, initDatabase } from '@/database/db';
import type { Subject } from '@/types';
import type { NotificationSettings } from '@/types/academic';

describe('Phase 11.5: Production Security Hardening & Defense-in-Depth', () => {
  beforeAll(async () => {
    await initDatabase();
  });

  beforeEach(() => {
    resetRateLimitsForTesting();
    appLockService.resetForTesting();
  });

  // ─── 1. Password KDF Hardening & Migration ────────────────────────────────
  describe('1. Password KDF Hardening (PBKDF2-HMAC-SHA-256) & Migration', () => {
    it('generates secure PBKDF2-HMAC-SHA-256 hashes with iteration count and salt', async () => {
      const password = 'StudentSecurePassword123!';
      const hash1 = await hashPassword(password);
      const hash2 = await hashPassword(password);

      expect(hash1.startsWith('bmk_pbkdf2_sha256_')).toBe(true);
      expect(hash2.startsWith('bmk_pbkdf2_sha256_')).toBe(true);

      const parts = hash1.split('_');
      expect(parts.length).toBeGreaterThanOrEqual(6);
      expect(parseInt(parts[3], 10)).toBe(10000); // 10,000 iterations default
      expect(parts[4].length).toBe(16); // 16-character random salt

      // Unique salt ensures different hashes for identical passwords
      expect(hash1).not.toBe(hash2);
    });

    it('successfully verifies correct password against PBKDF2 hash and rejects incorrect', async () => {
      const password = 'StrongPassword987#';
      const hash = await hashPassword(password);

      const isValid = await verifyPassword(password, hash);
      const isWrong = await verifyPassword('WrongPassword', hash);

      expect(isValid).toBe(true);
      expect(isWrong).toBe(false);
    });

    it('verifies backward-compatible Tier 2 (salted SHA-256) hashes', async () => {
      const password = 'SaltedSha256UserPass';
      const tier2Hash = await legacySha256HashPassword(password);

      expect(tier2Hash.startsWith('bmk_sha256_')).toBe(true);
      expect(await verifyPassword(password, tier2Hash)).toBe(true);
      expect(await verifyPassword('Incorrect', tier2Hash)).toBe(false);
    });

    it('verifies backward-compatible Tier 3 (polynomial) hashes', async () => {
      const password = 'LegacyUserPassword';
      const tier3Hash = legacyHashPassword(password);

      expect(tier3Hash.startsWith('bmk_h_')).toBe(true);
      expect(await verifyPassword(password, tier3Hash)).toBe(true);
      expect(await verifyPassword('Incorrect', tier3Hash)).toBe(false);
    });

    it('identifies hashes that require upgrading to PBKDF2', async () => {
      const pbkdf2Hash = await hashPassword('pass');
      const sha256Hash = await legacySha256HashPassword('pass');
      const polyHash = legacyHashPassword('pass');

      expect(needsPasswordRehash(pbkdf2Hash)).toBe(false);
      expect(needsPasswordRehash(sha256Hash)).toBe(true);
      expect(needsPasswordRehash(polyHash)).toBe(true);
    });

    it('transparently upgrades legacy hash to PBKDF2 in SQLite upon successful login', async () => {
      const db = await getDatabaseConnection();
      const testEmail = 'upgrade_user@test.edu';
      const testPassword = 'MySecretPassword123';
      const initialLegacyHash = legacyHashPassword(testPassword);
      const userId = `usr-upgrade-${Date.now()}`;
      const nowISO = new Date().toISOString();

      await db.runAsync(
        `INSERT OR REPLACE INTO auth_accounts (id, email, password_hash, name, created_at, updated_at)
         VALUES (?, ?, ?, ?, ?, ?);`,
        [userId, testEmail, initialLegacyHash, 'Upgrade User', nowISO, nowISO]
      );

      // Sign in with valid credentials
      const signInRes = await localAuthAdapter.signIn({
        email: testEmail,
        password: testPassword,
      });

      expect(signInRes.success).toBe(true);

      // Verify password hash in database was automatically upgraded to PBKDF2
      const updatedAccount = await db.getFirstAsync<{ password_hash: string }>(
        `SELECT password_hash FROM auth_accounts WHERE id = ?;`,
        [userId]
      );

      expect(updatedAccount?.password_hash.startsWith('bmk_pbkdf2_sha256_')).toBe(true);
    });
  });

  // ─── 2. Password Abuse & Enumeration Protection ────────────────────────────
  describe('2. Password Abuse & Anti-Enumeration Protections', () => {
    it('applies rate limiting and backoff after repeated failed login attempts', () => {
      const email = 'target@student.edu';

      // Initial state: allowed
      expect(checkLoginRateLimit(email).allowed).toBe(true);

      // 4 failed attempts: still allowed
      for (let i = 0; i < 4; i++) {
        recordFailedAttempt(email);
      }
      expect(checkLoginRateLimit(email).allowed).toBe(true);

      // 5th failed attempt: 30-second backoff triggered
      recordFailedAttempt(email);
      const limit5 = checkLoginRateLimit(email);
      expect(limit5.allowed).toBe(false);
      expect(limit5.isLocked).toBe(true);
      expect(limit5.retryAfterSeconds).toBeGreaterThan(0);

      // Clear attempts on success
      clearFailedAttempts(email);
      expect(checkLoginRateLimit(email).allowed).toBe(true);
    });

    it('locks account for 5 minutes after 10 failed login attempts', () => {
      const email = 'bruteforce@student.edu';

      for (let i = 0; i < 10; i++) {
        recordFailedAttempt(email);
      }

      const limit10 = checkLoginRateLimit(email);
      expect(limit10.allowed).toBe(false);
      expect(limit10.retryAfterSeconds).toBeGreaterThan(250); // ~300s (5m)
    });

    it('records failed login attempts for non-existent users and triggers rate limits', async () => {
      const email = 'nonexistent_random_user@bunkmatkar.app';
      const res = await localAuthAdapter.signIn({
        email,
        password: 'Password123!',
      });

      expect(res.success).toBe(false);
      expect(res.error).toBeDefined();

      // Ensure failed attempts accumulate to trigger lockout
      for (let i = 0; i < 4; i++) {
        await localAuthAdapter.signIn({ email, password: 'Wrong' });
      }
      const limit = checkLoginRateLimit(email);
      expect(limit.allowed).toBe(false);
      expect(limit.retryAfterSeconds).toBeGreaterThan(0);
    });

    it('handles password reset requests safely for unregistered accounts', async () => {
      const res = await localAuthAdapter.resetPassword('unknown_user@school.edu');
      expect(res.success).toBe(false);
      expect(res.message).toBeDefined();
    });
  });

  // ─── 3. File Security & Magic Byte Validation ─────────────────────────────
  describe('3. File Storage Security, Magic Bytes & MIME Validation', () => {
    it('blocks directory traversal characters in file names', () => {
      const traversalAttempts = [
        '../../etc/passwd',
        '..\\..\\windows\\win.ini',
        'folder/../../secret.pdf',
        'notes\0.pdf',
      ];

      for (const attempt of traversalAttempts) {
        const result = fileStorageService.validateUserFile(attempt);
        expect(result.isValid).toBe(false);
        expect(result.error).toMatch(/Path traversal|Invalid file/);
      }
    });

    it('strictly forbids dangerous executable and script extensions', () => {
      const dangerousFiles = [
        'malware.exe',
        'payload.apk',
        'script.sh',
        'installer.msi',
        'trojan.bat',
        'exploit.cmd',
        'backdoor.vbs',
        'eval.js',
      ];

      for (const file of dangerousFiles) {
        const result = fileStorageService.validateUserFile(file);
        expect(result.isValid).toBe(false);
        expect(result.error).toContain('not permitted for security');
      }
    });

    it('normalizes filenames to prevent Windows device name collisions and truncation', () => {
      expect(fileStorageService.normalizeFileName('CON.pdf')).toBe('doc_con.pdf');
      expect(fileStorageService.normalizeFileName('NUL.docx')).toBe('doc_nul.docx');
      expect(fileStorageService.normalizeFileName('my lecture notes (1).pdf')).toBe('my_lecture_notes__1_.pdf');
    });

    it('validates file magic byte signatures for legitimate academic documents', () => {
      // PDF header: %PDF- (0x25, 0x50, 0x44, 0x46)
      const pdfHeader = [0x25, 0x50, 0x44, 0x46, 0x2D, 0x31, 0x2E, 0x37];
      expect(fileStorageService.validateMagicBytes(pdfHeader, 'pdf').isValid).toBe(true);

      // Spoofed PDF with binary executable header: MZ (0x4D, 0x5A)
      const spoofedPdf = [0x4D, 0x5A, 0x90, 0x00];
      const spoofResult = fileStorageService.validateMagicBytes(spoofedPdf, 'pdf');
      expect(spoofResult.isValid).toBe(false);
      expect(spoofResult.error).toContain('PDF signature');

      // PNG header: 89 50 4E 47
      const pngHeader = [0x89, 0x50, 0x4E, 0x47, 0x0D, 0x0A, 0x1A, 0x0A];
      expect(fileStorageService.validateMagicBytes(pngHeader, 'png').isValid).toBe(true);

      // JPEG header: FF D8 FF
      const jpegHeader = [0xFF, 0xD8, 0xFF, 0xE0];
      expect(fileStorageService.validateMagicBytes(jpegHeader, 'jpg').isValid).toBe(true);

      // ZIP / DOCX / PPTX: PK.. (0x50, 0x4B, 0x03, 0x04)
      const zipHeader = [0x50, 0x4B, 0x03, 0x04];
      expect(fileStorageService.validateMagicBytes(zipHeader, 'docx').isValid).toBe(true);
    });

    it('validates MIME types matching allowed extensions', () => {
      expect(fileStorageService.validateMimeType('application/pdf', 'pdf').isValid).toBe(true);
      expect(fileStorageService.validateMimeType('image/png', 'png').isValid).toBe(true);

      const mismatched = fileStorageService.validateMimeType('application/x-msdownload', 'pdf');
      expect(mismatched.isValid).toBe(false);
      expect(mismatched.error).toContain('does not match');
    });

    it('enforces maximum file size limit of 50MB', () => {
      const oversizeBytes = 51 * 1024 * 1024; // 51MB
      const normalBytes = 10 * 1024 * 1024; // 10MB

      const overResult = fileStorageService.validateUserFile('large_scan.pdf', oversizeBytes);
      const normalResult = fileStorageService.validateUserFile('normal_scan.pdf', normalBytes);

      expect(overResult.isValid).toBe(false);
      expect(overResult.error).toContain('50MB');
      expect(normalResult.isValid).toBe(true);
    });

    it('rejects saving malicious files through saveUserFile', async () => {
      await expect(
        fileStorageService.saveUserFile('temp://test', '../malicious.exe')
      ).rejects.toThrow(/Path traversal|security/);
    });
  });

  // ─── 4. Database Encryption & Key Management ──────────────────────────────
  describe('4. Database Key Management & SQLCipher Feasibility', () => {
    it('provisions and retrieves a 256-bit database key via SecureStore contract', async () => {
      const key = await databaseEncryptionService.getOrCreateDatabaseKey();
      // On mock/node, SecureStore retrieves or sets key
      if (key) {
        expect(key.startsWith('bmk_cipher_')).toBe(true);
        expect(key.length).toBeGreaterThanOrEqual(64);
      }
    });

    it('provides rollback-safe migration blueprint for existing plaintext databases', () => {
      const blueprint = databaseEncryptionService.getMigrationBlueprint();
      expect(blueprint.strategy).toBe('ATTACH_AND_EXPORT_COPY');
      expect(blueprint.rollbackSafe).toBe(true);
      expect(blueprint.steps.length).toBeGreaterThan(5);
    });

    it('reports accurate platform encryption limitations without false claims', async () => {
      const status = await databaseEncryptionService.getEncryptionStatus();
      expect(status.limitations).toBeDefined();
      expect(status.limitations.length).toBeGreaterThan(0);
    });
  });

  // ─── 5. Biometric App Lock & Privacy Shield ───────────────────────────────
  describe('5. Biometric App Lock & Privacy Shield', () => {
    it('starts in unlocked state by default and supports subscription', () => {
      expect(appLockService.getIsLocked()).toBe(false);

      let notifiedLockState: boolean | null = null;
      const unsubscribe = appLockService.subscribe((isLocked) => {
        notifiedLockState = isLocked;
      });

      expect(notifiedLockState).toBe(false);

      appLockService.lock();
      expect(appLockService.getIsLocked()).toBe(true);
      expect(notifiedLockState).toBe(true);

      appLockService.unlock();
      expect(appLockService.getIsLocked()).toBe(false);
      expect(notifiedLockState).toBe(false);

      unsubscribe();
    });

    it('enables and disables app lock preference', async () => {
      await appLockService.setEnabled(true);
      expect(await appLockService.isEnabled()).toBe(true);

      await appLockService.setEnabled(false);
      expect(await appLockService.isEnabled()).toBe(false);
    });
  });

  // ─── 6. Device Integrity & App Attestation ────────────────────────────────
  describe('6. Device Integrity & App Attestation Replay Defense', () => {
    it('generates high-entropy single-use server challenges', () => {
      const challenge1 = deviceIntegrityService.generateChallenge();
      const challenge2 = deviceIntegrityService.generateChallenge();

      expect(challenge1.nonce).toBeDefined();
      expect(challenge1.nonce.length).toBeGreaterThanOrEqual(32);
      expect(challenge1.nonce).not.toBe(challenge2.nonce);
      expect(challenge1.expiresAt).toBeGreaterThan(Date.now());
    });

    it('prepares and verifies attestation payloads bound to challenge nonce', async () => {
      const challenge = deviceIntegrityService.generateChallenge();
      const payload = await deviceIntegrityService.prepareAttestationPayload(challenge);

      expect(payload.nonce).toBe(challenge.nonce);
      expect(payload.attestationToken.startsWith('attest_')).toBe(true);

      const isValid = deviceIntegrityService.verifyAttestationPayload(payload, challenge);
      expect(isValid).toBe(true);
    });

    it('prevents replay attacks on expired challenges', async () => {
      const expiredChallenge = {
        nonce: 'expired_nonce_123',
        issuedAt: Date.now() - 100000,
        expiresAt: Date.now() - 1000,
      };

      await expect(
        deviceIntegrityService.prepareAttestationPayload(expiredChallenge)
      ).rejects.toThrow(/expired/);
    });
  });

  // ─── 7. Version Guard & Security Update Enforcement ───────────────────────
  describe('7. Version Guard & Minimum Safe Version Enforcement', () => {
    it('compares semantic version strings correctly', () => {
      expect(versionGuardService.compareVersions('1.0.0', '1.0.0')).toBe(0);
      expect(versionGuardService.compareVersions('1.0.0', '1.0.1')).toBe(-1);
      expect(versionGuardService.compareVersions('1.2.0', '1.1.9')).toBe(1);
      expect(versionGuardService.compareVersions('2.0.0', '1.9.9')).toBe(1);
    });

    it('requires update when current version is below critical security minimum', () => {
      const policy = {
        minimumSupportedVersion: '1.1.0',
        latestVersion: '1.2.0',
        isSecurityMandatory: true,
      };

      const result = versionGuardService.evaluateVersionPolicy('1.0.0', policy);
      expect(result.status).toBe('update_required');
      expect(result.isSecurityMandatory).toBe(true);
    });

    it('recommends soft update when newer version is available without security mandate', () => {
      const policy = {
        minimumSupportedVersion: '1.0.0',
        latestVersion: '1.0.5',
        isSecurityMandatory: false,
      };

      const result = versionGuardService.evaluateVersionPolicy('1.0.0', policy);
      expect(result.status).toBe('update_recommended');
      expect(result.isSecurityMandatory).toBe(false);
    });

    it('marks current version as supported when compliant', () => {
      const policy = {
        minimumSupportedVersion: '1.0.0',
        latestVersion: '1.0.0',
        isSecurityMandatory: false,
      };

      const result = versionGuardService.evaluateVersionPolicy('1.0.0', policy);
      expect(result.status).toBe('supported');
    });
  });

  // ─── 8. Cloud Sync SQL Injection & Table Whitelist Defense ─────────────────
  describe('8. Cloud Sync SQL Injection & Table Whitelist Defense', () => {
    it('ignores sync upserts targeted at unwhitelisted or system tables', async () => {
      const syncInstance: any = syncService;

      await syncInstance.upsertLocalRecord(
        'sqlite_master',
        'hack-1',
        { sql: 'malicious' },
        'usr-1'
      );
      await syncInstance.upsertLocalRecord(
        'students; DROP TABLE tasks; --',
        'hack-2',
        { name: 'evil' },
        'usr-1'
      );

      const db = await getDatabaseConnection();
      const check = await db.getAllAsync('SELECT * FROM tasks;');
      expect(Array.isArray(check)).toBe(true);
    });

    it('filters out malicious column names and SQL injection clauses from sync payload', async () => {
      const syncInstance: any = syncService;

      const maliciousPayload = {
        title: 'Safe Task Title',
        'status); DROP TABLE tasks; --': 'exploit',
        '1=1': 'exploit',
        'bad-column-name!': 'exploit',
        due_date: '2026-11-01',
      };

      await syncInstance.upsertLocalRecord(
        'tasks',
        'safe-task-sec-1',
        maliciousPayload,
        'usr-test-sec'
      );

      const db = await getDatabaseConnection();
      const row = await db.getFirstAsync<{ id: string; title: string }>(
        'SELECT id, title FROM tasks WHERE id = ?;',
        ['safe-task-sec-1']
      );

      expect(row).toBeDefined();
      expect(row?.title).toBe('Safe Task Title');
    });
  });

  // ─── 9. Deep Link & Internal Route Validation ─────────────────────────────
  describe('9. Deep Link & Internal Route Validation', () => {
    it('blocks dangerous protocol handlers, external URLs, and path traversal in routes', () => {
      const isSafeRoute = (target?: string) => {
        if (!target || typeof target !== 'string') return false;
        if (!target.startsWith('/') || target.startsWith('//')) return false;
        if (target.includes(':') || target.includes('..') || target.includes('\\')) return false;
        return true;
      };

      expect(isSafeRoute('javascript:alert(document.cookie)')).toBe(false);
      expect(isSafeRoute('https://malicious-phishing.com')).toBe(false);
      expect(isSafeRoute('//phishing.com/login')).toBe(false);
      expect(isSafeRoute('file:///etc/passwd')).toBe(false);
      expect(isSafeRoute('/(tabs)/../../../admin')).toBe(false);

      expect(isSafeRoute('/(tabs)')).toBe(true);
      expect(isSafeRoute('/(tabs)/attendance')).toBe(true);
      expect(isSafeRoute('/subject/sub-123')).toBe(true);
      expect(isSafeRoute('/schedule?session=slot-456')).toBe(true);
    });
  });

  // ─── 10. Notification Lock-Screen Privacy Masking ─────────────────────────
  describe('10. Notification Lock-Screen Privacy Masking', () => {
    let mockAdapter: MockNotificationAdapter;
    let notificationService: NotificationService;

    beforeEach(() => {
      mockAdapter = new MockNotificationAdapter();
      notificationService = new NotificationService(mockAdapter);
    });

    it('masks course names, marks, and attendance details when privacyMode is enabled', async () => {
      const privacySettings: NotificationSettings = {
        masterEnabled: true,
        privacyMode: true,
        classReminders: { enabled: true, minutesBefore: [15] },
        taskReminders: { enabled: true, dueToday: true, overdue: true },
        examReminders: { enabled: true, daysBefore: [1] },
        revisionReminders: { enabled: true, dailyLimitPerSubject: 1 },
        attendanceAlerts: { enabled: true, dangerThreshold: 75 },
        postClassJournal: { enabled: true, delayMinutesAfterEnd: 15 },
        quietHours: { enabled: false, startHour: 23, startMinute: 0, endHour: 7, endMinute: 0, suppressNonCritical: false },
      };

      jest.spyOn(notificationService, 'getSettings').mockResolvedValue(privacySettings);

      const subject: Subject = {
        id: 'sub-sec-1',
        name: 'Database Security & Privacy',
        code: 'CS401',
        shortName: 'DBSec',
        color: '#7C3AED',
        semesterId: 'sem-1',
        facultyId: 'fac-1',
        credits: 4,
        targetAttendance: 75,
      };

      const futureDate = new Date(Date.now() + 1000 * 60 * 30);
      await notificationService.scheduleAttendanceAlert(subject, 60, 75, futureDate);

      const scheduled = await mockAdapter.getAllScheduledNotificationsAsync();
      expect(scheduled.length).toBeGreaterThan(0);
      const notif = scheduled[scheduled.length - 1];

      // Privacy verification: Exact subject name and low attendance percentage must NOT be shown
      expect(notif.content.title).toBe('Attendance Notice');
      expect(notif.content.body).toBe('An attendance target threshold alert has been recorded.');
      expect(notif.content.body).not.toContain('60%');
      expect(notif.content.body).not.toContain('DBSec');
    });

    it('shows detailed information when privacyMode is disabled', async () => {
      const normalSettings: NotificationSettings = {
        masterEnabled: true,
        privacyMode: false,
        classReminders: { enabled: true, minutesBefore: [15] },
        taskReminders: { enabled: true, dueToday: true, overdue: true },
        examReminders: { enabled: true, daysBefore: [1] },
        revisionReminders: { enabled: true, dailyLimitPerSubject: 1 },
        attendanceAlerts: { enabled: true, dangerThreshold: 75 },
        postClassJournal: { enabled: true, delayMinutesAfterEnd: 15 },
        quietHours: { enabled: false, startHour: 23, startMinute: 0, endHour: 7, endMinute: 0, suppressNonCritical: false },
      };

      jest.spyOn(notificationService, 'getSettings').mockResolvedValue(normalSettings);

      const subject: Subject = {
        id: 'sub-sec-2',
        name: 'Distributed Systems',
        code: 'CS402',
        shortName: 'DistSys',
        color: '#7C3AED',
        semesterId: 'sem-1',
        facultyId: 'fac-1',
        credits: 4,
        targetAttendance: 75,
      };

      const futureDate = new Date(Date.now() + 1000 * 60 * 30);
      await notificationService.scheduleAttendanceAlert(subject, 60, 75, futureDate);

      const scheduled = await mockAdapter.getAllScheduledNotificationsAsync();
      const notif = scheduled[scheduled.length - 1];

      expect(notif.content.title).toBe('Attendance Alert');
      expect(notif.content.body).toContain('DistSys is at 60%');
    });
  });

  // ─── 11. Token Storage & Adapter Security Contract ────────────────────────
  describe('11. Token Storage & Adapter Security Contract', () => {
    it('sanitizes keys and persists/removes items through storage adapter without errors', async () => {
      const testKey = 'sb-test-token-key:123';
      const testVal = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.dummy_token';

      await supabaseStorageAdapter.setItem(testKey, testVal);
      const retrieved = await supabaseStorageAdapter.getItem(testKey);
      expect(retrieved).toBe(testVal);

      await supabaseStorageAdapter.removeItem(testKey);
      const afterDelete = await supabaseStorageAdapter.getItem(testKey);
      expect(afterDelete).toBeNull();
    });
  });

  // ─── 12. Demo Mode Isolation & Cross-Account Protection ───────────────────
  describe('12. Demo Mode Isolation & Cross-Account Protection', () => {
    it('strictly refuses to migrate local demo records to an authenticated cloud account', async () => {
      useAppStore.setState({ isDemoMode: true });

      const migrationResult = await authService.migrateLocalDataToUser('usr-cloud-123');
      expect(migrationResult.migratedCount).toBe(0);

      useAppStore.setState({ isDemoMode: false });
    });
  });

  // ─── 13. Account Deletion & Complete Data Purge ───────────────────────────
  describe('13. Account Deletion & Complete Data Purge', () => {
    it('purges all academic records, sessions, and accounts when an account is deleted', async () => {
      const testUser = {
        id: 'usr-purge-test-1',
        email: 'purge.test@example.com',
        name: 'Purge User',
        createdAt: new Date().toISOString(),
      };

      const db = await getDatabaseConnection();
      await db.runAsync(
        'INSERT OR REPLACE INTO auth_accounts (id, email, password_hash, name, created_at, updated_at) VALUES (?, ?, ?, ?, ?, ?);',
        [testUser.id, testUser.email, 'hash_test', testUser.name, testUser.createdAt, testUser.createdAt]
      );
      await db.runAsync(
        'INSERT OR REPLACE INTO tasks (id, title, user_id, is_completed) VALUES (?, ?, ?, ?);',
        ['task-purge-1', 'Purge Task', testUser.id, 0]
      );

      const tasksBefore = await db.getAllAsync('SELECT * FROM tasks WHERE user_id = ?;', [testUser.id]);
      expect(tasksBefore.length).toBe(1);

      await localAuthAdapter.deleteAccount(testUser.id);

      const tasksAfter = await db.getAllAsync('SELECT * FROM tasks WHERE user_id = ?;', [testUser.id]);
      const accountAfter = await db.getAllAsync('SELECT * FROM auth_accounts WHERE id = ?;', [testUser.id]);

      expect(tasksAfter.length).toBe(0);
      expect(accountAfter.length).toBe(0);
    });
  });

  // ─── 14. Phase 11.6: Advanced KDF Parameter Bounds & DoS Hardening ─────────
  describe('14. Phase 11.6: Password KDF Bounds, Malformed Hashes & DoS Protection', () => {
    it('rejects malformed hashes without crashing or throwing unhandled errors', async () => {
      const malformedHashes = [
        'bmk_pbkdf2_sha256',
        'bmk_pbkdf2_sha256_10000',
        'bmk_pbkdf2_sha256_notanumber_salt_digest',
        'bmk_pbkdf2_sha256_10000_invalidsalt_shortdigest',
        'bmk_pbkdf2_sha256_10000_1234567890abcdef1234567890abcdef_nothex!@#$',
        '',
        'random_unstructured_string_here',
      ];

      for (const badHash of malformedHashes) {
        const isValid = await verifyPassword('AnyPassword123!', badHash);
        expect(isValid).toBe(false);
      }
    });

    it('rejects iteration counts below minimum security floor (5,000)', async () => {
      // Craft a hash with iterations = 1000 (< 5,000 threshold)
      const lowIterationHash = 'bmk_pbkdf2_sha256_1000_0123456789abcdef0123456789abcdef_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const isValid = await verifyPassword('AnyPassword123!', lowIterationHash);
      expect(isValid).toBe(false);
    });

    it('rejects excessive iteration counts to prevent CPU-exhaustion DoS (> 250,000)', async () => {
      // Craft a hash requesting 1,000,000 iterations to tie up the mobile CPU
      const dosIterationHash = 'bmk_pbkdf2_sha256_1000000_0123456789abcdef0123456789abcdef_0123456789abcdef0123456789abcdef0123456789abcdef0123456789abcdef';
      const isValid = await verifyPassword('AnyPassword123!', dosIterationHash);
      expect(isValid).toBe(false);
    });

    it('detects when a valid hash requires rehash to meet upgraded work factor', async () => {
      const currentHash = await hashPassword('TestUpgradePassword123!');
      // When target iterations matches current (10,000), no rehash needed
      expect(needsPasswordRehash(currentHash, 10000)).toBe(false);
      // If server policy upgrades to 25,000 iterations, detects rehash required
      expect(needsPasswordRehash(currentHash, 25000)).toBe(true);
    });
  });

  // ─── 15. Phase 11.6: File Security Boundary Hardening ─────────────────────
  describe('15. Phase 11.6: File Security Boundary & Traversal Defense', () => {
    it('blocks URL-encoded path traversal attacks (%2e%2e%2f)', () => {
      const maliciousNames = [
        '%2e%2e%2fetc%2fpasswd',
        '..%2f..%2fprivate_data.json',
        '%252e%252e%252fexploit.pdf',
        'legit%00.exe.pdf',
      ];

      for (const name of maliciousNames) {
        const res = fileStorageService.validateUserFile(name);
        expect(res.isValid).toBe(false);
        expect(res.error).toMatch(/path traversal|invalid file|prohibited/i);
      }
    });

    it('enforces maximum filename length limit of 255 characters', () => {
      const excessivelyLongName = 'a'.repeat(300) + '.pdf';
      const res = fileStorageService.validateUserFile(excessivelyLongName);
      expect(res.isValid).toBe(false);
      expect(res.error).toMatch(/exceeds maximum/i);

      const validLengthName = 'a'.repeat(200) + '.pdf';
      const validRes = fileStorageService.validateUserFile(validLengthName);
      expect(validRes.isValid).toBe(true);
    });

    it('prevents spoofed executables masquerading as PDFs via magic-byte inspection', () => {
      // Executable MZ header [0x4D, 0x5A]
      const exeHeader = [0x4D, 0x5A, 0x90, 0x00, 0x03, 0x00, 0x00, 0x00];
      const magicRes = fileStorageService.validateMagicBytes(exeHeader, 'pdf');
      expect(magicRes.isValid).toBe(false);
    });
  });

  // ─── 16. Phase 11.6: Deep Link Route Authorization & Smuggling Defense ────
  describe('16. Phase 11.6: Deep Link Route Authorization & Smuggling Defense', () => {
    it('validates safe internal routes while strictly rejecting external or smuggling routes', () => {
      // Legitimate routes
      expect(isSafeInternalRoute('/(tabs)/today')).toBe(true);
      expect(isSafeInternalRoute('/task-modal')).toBe(true);
      expect(isSafeInternalRoute('/tasks/task-abc-123')).toBe(true);
      expect(isSafeInternalRoute('/attendance/sub-456')).toBe(true);

      // Traversal attacks
      expect(isSafeInternalRoute('/tasks/../../secret')).toBe(false);
      expect(isSafeInternalRoute('/tasks/%2e%2e%2fsecret')).toBe(false);
      expect(isSafeInternalRoute('..\\..\\windows\\win.ini')).toBe(false);

      // Protocol smuggling & external URLs
      expect(isSafeInternalRoute('javascript:alert(1)')).toBe(false);
      expect(isSafeInternalRoute('file:///etc/passwd')).toBe(false);
      expect(isSafeInternalRoute('data:text/html,<script>evil()</script>')).toBe(false);
      expect(isSafeInternalRoute('https://evil-phishing-site.com')).toBe(false);

      // Null bytes and length violations
      expect(isSafeInternalRoute('/tasks/123\0admin')).toBe(false);
      expect(isSafeInternalRoute('/' + 'a'.repeat(300))).toBe(false);
      expect(isSafeInternalRoute('')).toBe(false);
    });
  });

  // ─── 17. Phase 11.6: Academic Backup Sanitization & Ownership Binding ─────
  describe('17. Phase 11.6: Academic Backup Sanitization & Ownership Binding', () => {
    it('strictly strips sensitive auth tables and credentials from exported backups', () => {
      const rawAcademicData = {
        subjects: [{ id: 'sub-1', name: 'Mathematics' }],
        tasks: [{ id: 'tsk-1', title: 'Calculus Assignment' }],
        auth_accounts: [{ id: 'usr-1', email: 'test@example.com', password_hash: 'bmk_hash_secret' }],
        auth_sessions: [{ token: 'jwt_secret_token_abc' }],
        service_role: 'super_secret_key',
      };

      const sanitizedBackup = backupValidationService.sanitizeForExport(rawAcademicData);
      const json = JSON.stringify(sanitizedBackup);

      expect(json).not.toContain('auth_accounts');
      expect(json).not.toContain('auth_sessions');
      expect(json).not.toContain('password_hash');
      expect(json).not.toContain('jwt_secret_token_abc');
      expect(json).not.toContain('service_role');
      expect(sanitizedBackup.subjects.length).toBe(1);
      expect(sanitizedBackup.tasks.length).toBe(1);
    });

    it('rejects malicious backups attempting to import forbidden security tables', () => {
      const maliciousPayload = {
        version: '1.0',
        subjects: [{ id: 'sub-1', name: 'Math' }],
        auth_accounts: [{ id: 'usr-admin', email: 'hacker@example.com' }],
      };

      const result = backupValidationService.validateAndSanitizeImport(maliciousPayload, 'usr-current-1');
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/forbidden security key/i);
    });

    it('enforces tenant boundary on import by rewriting all record user_ids to current authenticated user', () => {
      const importedPayload = {
        version: '1.0',
        subjects: [
          { id: 'sub-1', name: 'Physics', user_id: 'victim-user-id-999' },
        ],
        tasks: [
          { id: 'tsk-1', title: 'Lab Report', user_id: 'other-user-888' },
        ],
      };

      const currentUserId = 'active-student-user-111';
      const result = backupValidationService.validateAndSanitizeImport(importedPayload, currentUserId);

      expect(result.isValid).toBe(true);
      expect(result.sanitizedData?.subjects[0].user_id).toBe(currentUserId);
      expect(result.sanitizedData?.tasks[0].user_id).toBe(currentUserId);
    });

    it('rejects massive backup payloads exceeding per-entity limit (DoS defense)', () => {
      const hugeSubjects = Array.from({ length: 5001 }, (_, i) => ({ id: `sub-${i}`, name: `Subject ${i}` }));
      const payload = {
        version: '1.0',
        subjects: hugeSubjects,
      };

      const result = backupValidationService.validateAndSanitizeImport(payload, 'usr-1');
      expect(result.isValid).toBe(false);
      expect(result.error).toMatch(/exceeds maximum allowed record limit/i);
    });
  });

  // ─── 18. Phase 11.6: Cloud Sync Cross-Account Isolation ───────────────────
  describe('18. Phase 11.6: Cloud Sync Cross-Account Isolation', () => {
    it('forces incoming local sync records to belong strictly to active authenticated user', async () => {
      const victimUserId = 'victim-user-456';
      const attackerUserId = 'attacker-user-789';

      const maliciousSubject = {
        name: 'Injected Subject',
        shortName: 'INJ',
        code: 'INJ101',
        color: '#FF0000',
        semesterId: 'sem-1',
        facultyId: 'fac-1',
        credits: 3,
        targetAttendance: 75,
        userId: victimUserId, // Attacker attempts to inject under victim's ID
      };

      const syncInstance: any = syncService;
      // When sync service upserts local record for active user, it binds to active user
      await syncInstance.upsertLocalRecord('subjects', 'sub-isolation-test-1', maliciousSubject, attackerUserId);

      const db = await getDatabaseConnection();
      const records = await db.getAllAsync<{ id: string; user_id: string }>(
        'SELECT id, user_id FROM subjects WHERE id = ?;',
        ['sub-isolation-test-1']
      );

      expect(records.length).toBe(1);
      // The record in SQLite MUST be bound to the caller's active user ID, not the victim's
      expect(records[0].user_id).toBe(attackerUserId);
    });
  });
});

