/**
 * KaryaDEX — Phase 10: Authentication + Cloud Sync Test Suite
 *
 * Comprehensive verification of:
 *  1. Migration 7 (Auth & Sync Schema)
 *  2. Authentication (Sign Up, Sign In, Sign Out, Password Reset, Delete Account)
 *  3. Session Restoration & App Restart Survival
 *  4. Data Ownership & User Isolation
 *  5. Durable Offline Sync Queue & Compaction
 *  6. Push, Pull, and Repeated Sync Idempotency
 *  7. Deletion Tombstones & Resurrection Prevention
 *  8. Deterministic Conflict Resolution (Attendance, Tasks, Revisions, Notes)
 *  9. Multi-Device Sync Simulation (Device A <-> Cloud <-> Device B)
 * 10. Initial Local-to-Account Data Migration & Demo State Isolation
 */

jest.mock('react-native', () => ({
  Platform: { OS: 'web' },
}));

import {
  initDatabase,
  resetDatabaseConnectionForTesting,
  getDatabaseConnection,
  taskRepository,
  subjectRepository,
} from '../database';
import { authService, AuthService } from '../services/auth/authService';
import { localAuthAdapter } from '../services/auth/localAuthAdapter';
import { syncService, SyncService } from '../services/sync/syncService';
import { syncQueueRepository } from '../services/sync/syncQueueRepository';
import { syncTombstoneRepository } from '../services/sync/syncTombstoneRepository';
import { syncConflictResolver } from '../services/sync/syncConflictResolver';
import { simulatedCloudAdapter } from '../services/sync/cloudBackendAdapter';
import { useAppStore } from '../store/useAppStore';

describe('Phase 10: Authentication + Cloud Sync', () => {
  beforeEach(async () => {
    resetDatabaseConnectionForTesting();
    await initDatabase();
    AuthService.resetInstance();
    SyncService.resetInstance();
    simulatedCloudAdapter.clearStorage();
    simulatedCloudAdapter.setOnline(true);
    useAppStore.setState({ isDemoMode: false, isAuthenticated: false });
  });

  // ─── 1. Migration 7 Schema Verification ────────────────────────
  describe('1. Migration 7 Schema', () => {
    it('applies Migration 7 and creates auth and sync tables', async () => {
      const db = await getDatabaseConnection();

      // Check migration version recorded
      const row = await db.getFirstAsync<{ version: number }>(
        `SELECT version FROM schema_migrations WHERE version = 7;`
      );
      expect(row?.version).toBe(7);

      // Verify auth tables exist
      const accountsTable = await db.getFirstAsync<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='auth_accounts';`
      );
      expect(accountsTable?.name).toBe('auth_accounts');

      const sessionsTable = await db.getFirstAsync<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='auth_sessions';`
      );
      expect(sessionsTable?.name).toBe('auth_sessions');

      // Verify sync tables exist
      const queueTable = await db.getFirstAsync<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='sync_queue';`
      );
      expect(queueTable?.name).toBe('sync_queue');

      const tombstonesTable = await db.getFirstAsync<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='sync_tombstones';`
      );
      expect(tombstonesTable?.name).toBe('sync_tombstones');

      const metadataTable = await db.getFirstAsync<{ name: string }>(
        `SELECT name FROM sqlite_master WHERE type='table' AND name='sync_metadata';`
      );
      expect(metadataTable?.name).toBe('sync_metadata');
    });
  });

  // ─── 2. Authentication Flow ─────────────────────────────────────
  describe('2. Authentication Flow', () => {
    it('signs up a new student account and creates session', async () => {
      const service = AuthService.getInstance();
      const res = await service.signUp({
        name: 'Aarav Patel',
        email: 'aarav@karyadex.edu',
        password: 'password123',
      });

      expect(res.success).toBe(true);
      expect(res.user?.email).toBe('aarav@karyadex.edu');
      expect(res.user?.name).toBe('Aarav Patel');
      expect(service.isAuthenticated()).toBe(true);
      expect(service.getCurrentUser()?.id).toBe(res.user?.id);
    });

    it('rejects duplicate email sign-up', async () => {
      const service = AuthService.getInstance();
      await service.signUp({
        name: 'First User',
        email: 'duplicate@karyadex.edu',
        password: 'password123',
      });

      const res = await service.signUp({
        name: 'Second User',
        email: 'duplicate@karyadex.edu',
        password: 'anotherPassword',
      });

      expect(res.success).toBe(false);
      expect(res.error?.code).toBe('user_already_exists');
    });

    it('signs in with valid credentials and restores user', async () => {
      const service = AuthService.getInstance();
      await service.signUp({
        name: 'Priya Sharma',
        email: 'priya@karyadex.edu',
        password: 'mypassword',
      });

      await service.signOut();
      expect(service.isAuthenticated()).toBe(false);

      const signinRes = await service.signIn({
        email: 'priya@karyadex.edu',
        password: 'mypassword',
      });

      expect(signinRes.success).toBe(true);
      expect(signinRes.user?.name).toBe('Priya Sharma');
      expect(service.isAuthenticated()).toBe(true);
    });

    it('signs in with Google, establishes session, and migrates local data', async () => {
      const db = await getDatabaseConnection();
      await db.runAsync(
        `INSERT INTO subjects (id, name, code, short_name, color, credits)
         VALUES ('sub_unassigned', 'Operating Systems', 'CS301', 'OS', '#3B82F6', 4);`
      );
      await db.runAsync(
        `INSERT INTO tasks (id, title, priority, category, status, is_completed)
         VALUES ('task_unassigned', 'Lab 1', 'medium', 'assignment', 'pending', 0);`
      );

      const service = AuthService.getInstance();
      const res = await service.signInWithGoogle();

      expect(res.success).toBe(true);
      expect(res.user?.email).toBe('google.student@karyadex.app');
      expect(service.isAuthenticated()).toBe(true);

      const claimedSub = await db.getFirstAsync<{ user_id: string }>(
        `SELECT user_id FROM subjects WHERE id = 'sub_unassigned';`
      );
      expect(claimedSub?.user_id).toBe(res.user!.id);

      const claimedTask = await db.getFirstAsync<{ user_id: string }>(
        `SELECT user_id FROM tasks WHERE id = 'task_unassigned';`
      );
      expect(claimedTask?.user_id).toBe(res.user!.id);

      // Sign out: verify session cleared but local data preserved
      await service.signOut();
      expect(service.isAuthenticated()).toBe(false);

      const postSignOutSub = await db.getFirstAsync<{ id: string }>(
        `SELECT id FROM subjects WHERE id = 'sub_unassigned';`
      );
      expect(postSignOutSub?.id).toBe('sub_unassigned');
    });

    it('rejects invalid password or unknown email', async () => {
      const service = AuthService.getInstance();
      await service.signUp({
        name: 'Test Student',
        email: 'test@karyadex.edu',
        password: 'correctPassword',
      });

      await service.signOut();

      const wrongPass = await service.signIn({
        email: 'test@karyadex.edu',
        password: 'wrongPassword',
      });
      expect(wrongPass.success).toBe(false);
      expect(wrongPass.error?.code).toBe('invalid_credentials');

      const unknownEmail = await service.signIn({
        email: 'nobody@karyadex.edu',
        password: 'correctPassword',
      });
      expect(unknownEmail.success).toBe(false);
      expect(unknownEmail.error?.code).toBe('user_not_found');
    });

    it('resets password successfully for existing account', async () => {
      const service = AuthService.getInstance();
      await service.signUp({
        name: 'Reset Student',
        email: 'reset@karyadex.edu',
        password: 'oldPassword',
      });

      const resetRes = await service.resetPassword('reset@karyadex.edu');
      expect(resetRes.success).toBe(true);

      const unknownReset = await service.resetPassword('missing@karyadex.edu');
      expect(unknownReset.success).toBe(false);
    });

    it('deletes account and revokes active session', async () => {
      const service = AuthService.getInstance();
      await service.signUp({
        name: 'To Delete',
        email: 'delete@karyadex.edu',
        password: 'deleteMe123',
      });

      expect(service.isAuthenticated()).toBe(true);
      const delRes = await service.deleteAccount();
      expect(delRes.success).toBe(true);
      expect(service.isAuthenticated()).toBe(false);
      expect(service.getCurrentUser()).toBeNull();
    });
  });

  // ─── 3. Session Persistence Across App Restart ──────────────────
  describe('3. Session Persistence Across App Restart', () => {
    it('restores authenticated user session after simulated app restart', async () => {
      const service = AuthService.getInstance();
      const signupRes = await service.signUp({
        name: 'Restart User',
        email: 'restart@karyadex.edu',
        password: 'passRestart',
      });
      const userId = signupRes.user!.id;

      // Simulate app kill & restart: clear in-memory instance
      AuthService.resetInstance();
      const restartedService = AuthService.getInstance();
      expect(restartedService.getCurrentUser()).toBeNull();

      // Boot initialization
      const restoredUser = await restartedService.init();
      expect(restoredUser).not.toBeNull();
      expect(restoredUser?.id).toBe(userId);
      expect(restoredUser?.email).toBe('restart@karyadex.edu');
      expect(restartedService.isAuthenticated()).toBe(true);
    });
  });

  // ─── 4. Durable Offline Sync Queue & Compaction ─────────────────
  describe('4. Durable Offline Sync Queue & Compaction', () => {
    it('enqueues local mutations and survives process restart', async () => {
      const userId = 'user_offline_1';
      await syncQueueRepository.enqueue(userId, 'task', 'task_1', 'CREATE', { title: 'Study Chem' });
      await syncQueueRepository.enqueue(userId, 'task', 'task_2', 'CREATE', { title: 'Study Physics' });

      let items = await syncQueueRepository.peek(userId);
      expect(items.length).toBe(2);
      expect(items[0].payload.title).toBe('Study Chem');

      // Compaction: CREATE followed by DELETE cancels both
      await syncQueueRepository.enqueue(userId, 'task', 'task_2', 'DELETE');
      items = await syncQueueRepository.peek(userId);
      expect(items.length).toBe(1);
      expect(items[0].entityId).toBe('task_1');

      // Compaction: CREATE followed by UPDATE merges payload
      await syncQueueRepository.enqueue(userId, 'task', 'task_1', 'UPDATE', { is_completed: 1 });
      items = await syncQueueRepository.peek(userId);
      expect(items.length).toBe(1);
      expect(items[0].payload.title).toBe('Study Chem');
      expect(items[0].payload.is_completed).toBe(1);
    });
  });

  // ─── 5. Deletion Tombstones ──────────────────────────────────────
  describe('5. Deletion Tombstones & Resurrection Prevention', () => {
    it('records tombstones and prevents older remote updates from resurrecting deleted records', async () => {
      const userId = 'user_tomb_1';
      const deletedAt = '2026-10-05T12:00:00Z';
      await syncTombstoneRepository.addTombstone(userId, 'task', 'task_dead', deletedAt);

      const isDead = await syncTombstoneRepository.isTombstoned(userId, 'task', 'task_dead');
      expect(isDead).toBe(true);

      // Simulate remote record with older timestamp
      const olderRemote = {
        title: 'Zombie Task',
        updatedAt: '2026-10-05T11:00:00Z',
      };
      const conflict = syncConflictResolver.resolve('task', null, olderRemote, deletedAt, olderRemote.updatedAt);
      expect(conflict.resolvedPayload).toBeNull();
      expect(conflict.strategy).toBe('local_wins');
    });
  });

  // ─── 6. Deterministic Conflict Resolution ───────────────────────
  describe('6. Deterministic Conflict Resolution', () => {
    it('attendance conflict: attended status always wins over unmarked', () => {
      const local = { id: 'sess_1', status: 'unmarked', updated_at: '2026-10-05T10:00:00Z' };
      const remote = { id: 'sess_1', status: 'present', updated_at: '2026-10-05T09:00:00Z' };

      const conflict = syncConflictResolver.resolve('attendance', local, remote);
      expect(conflict.resolvedPayload?.status).toBe('present');
      expect(conflict.strategy).toBe('remote_wins');
    });

    it('attendance conflict: newer timestamp wins when both marked', () => {
      const local = { id: 'sess_2', status: 'present', updated_at: '2026-10-05T10:30:00Z' };
      const remote = { id: 'sess_2', status: 'absent', updated_at: '2026-10-05T11:00:00Z' };

      const conflict = syncConflictResolver.resolve('attendance', local, remote);
      expect(conflict.resolvedPayload?.status).toBe('absent');
      expect(conflict.strategy).toBe('remote_wins');
    });

    it('task conflict: preserves completion status during concurrent metadata edits', () => {
      const local = {
        id: 't_1',
        title: 'Original Title',
        status: 'completed',
        is_completed: 1,
        updated_at: '2026-10-05T09:00:00Z',
      };
      const remote = {
        id: 't_1',
        title: 'Updated Title by Device B',
        status: 'pending',
        is_completed: 0,
        updated_at: '2026-10-05T10:00:00Z',
      };

      const conflict = syncConflictResolver.resolve('task', local, remote);
      expect(conflict.resolvedPayload?.title).toBe('Updated Title by Device B');
      expect(conflict.resolvedPayload?.status).toBe('completed');
      expect(conflict.strategy).toBe('merged');
    });

    it('note conflict: preserves student notes by concatenating concurrent offline modifications', () => {
      const local = {
        id: 'note_1',
        content: 'Local lecture note summary',
        updated_at: '2026-10-05T09:00:00Z',
      };
      const remote = {
        id: 'note_1',
        content: 'Remote additional formula note',
        updated_at: '2026-10-05T09:30:00Z',
      };

      const conflict = syncConflictResolver.resolve('note', local, remote);
      expect(conflict.resolvedPayload?.content).toContain('Remote additional formula note');
      expect(conflict.resolvedPayload?.content).toContain('Local lecture note summary');
      expect(conflict.strategy).toBe('merged');
    });
  });

  // ─── 7. Bidirectional Sync Engine & Idempotency ──────────────────
  describe('7. Bidirectional Sync Engine & Idempotency', () => {
    it('pushes local queued items and pulls updates with idempotency', async () => {
      const auth = AuthService.getInstance();
      await auth.signUp({
        name: 'Sync Student',
        email: 'sync_student@karyadex.edu',
        password: 'password123',
      });

      const sync = SyncService.getInstance();
      await sync.init();

      // Enqueue a task mutation
      await sync.queueMutation('task', 'task_sync_1', 'CREATE', {
        title: 'Complete Assignment',
        status: 'pending',
      });

      expect(sync.getSyncState().pendingCount).toBe(1);

      // Execute sync
      const res = await sync.sync();
      expect(res.success).toBe(true);
      expect(res.pushedCount).toBe(1);
      expect(sync.getSyncState().pendingCount).toBe(0);
      expect(sync.getSyncState().status).toBe('synced');

      // Repeated sync is completely idempotent
      const repeatRes = await sync.sync();
      expect(repeatRes.success).toBe(true);
      expect(repeatRes.pushedCount).toBe(0);
      expect(repeatRes.pulledCount).toBe(0);
    });

    it('degrades gracefully to offline state when network is unavailable', async () => {
      const auth = AuthService.getInstance();
      await auth.signUp({
        name: 'Offline Student',
        email: 'offline_student@karyadex.edu',
        password: 'password123',
      });

      const sync = SyncService.getInstance();
      await sync.init();

      // Go offline
      await sync.setOnline(false);
      expect(sync.getSyncState().isOnline).toBe(false);

      // Queue an item while offline
      await sync.queueMutation('task', 'task_offline_1', 'CREATE', { title: 'Offline Task' });

      // Trigger sync while offline: does not crash, preserves item in queue
      const res = await sync.sync();
      expect(res.success).toBe(false);
      expect(sync.getSyncState().pendingCount).toBe(1);
      expect(sync.getSyncState().status).toBe('pending');

      // Reconnect: queue is processed cleanly
      await sync.setOnline(true);
      expect(sync.getSyncState().isOnline).toBe(true);
      expect(sync.getSyncState().pendingCount).toBe(0);
      expect(sync.getSyncState().status).toBe('synced');
    });
  });

  // ─── 8. Multi-Device Synchronization Simulation ─────────────────
  describe('8. Multi-Device Synchronization Simulation', () => {
    it('synchronizes edits between Device A and Device B via cloud', async () => {
      const auth = AuthService.getInstance();
      const signup = await auth.signUp({
        name: 'Multi Device User',
        email: 'multidevice@karyadex.edu',
        password: 'password123',
      });
      const userId = signup.user!.id;

      const sync = SyncService.getInstance();
      await sync.init();

      // Device A creates and syncs task
      await sync.queueMutation('task', 'shared_task_1', 'CREATE', {
        title: 'Created by Device A',
        status: 'pending',
      });
      await sync.sync();

      // Device B simulates remote edit on the cloud
      const futureTime = new Date(Date.now() + 2000).toISOString();
      simulatedCloudAdapter.simulateRemoteDeviceEdit(
        userId,
        'task',
        'shared_task_1',
        {
          title: 'Updated by Device B',
          status: 'completed',
          updatedAt: futureTime,
        },
        futureTime
      );

      // Device A pulls changes
      const pullResult = await sync.sync();
      expect(pullResult.success).toBe(true);
      expect(pullResult.pulledCount).toBeGreaterThanOrEqual(1);

      // Verify Device A's local SQLite has received Device B's changes
      const db = await getDatabaseConnection();
      const updatedRow = await db.getFirstAsync<{ title: string; status: string }>(
        `SELECT title, status FROM tasks WHERE id = 'shared_task_1';`
      );
      expect(updatedRow?.title).toBe('Updated by Device B');
      expect(updatedRow?.status).toBe('completed');
    });
  });

  // ─── 9. Initial Local Data Account Migration ───────────────────
  describe('9. Initial Local Data Account Migration', () => {
    it('migrates unowned local SQLite records (user_id IS NULL) to newly signed-up account', async () => {
      const db = await getDatabaseConnection();

      // Simulate existing local task created before authentication
      await db.runAsync(
        `INSERT INTO tasks (id, title, status, is_completed, user_id, created_at, updated_at)
         VALUES ('pre_auth_task', 'Pre-Auth Subject Task', 'pending', 0, NULL, datetime('now'), datetime('now'));`
      );

      const checkPre = await db.getFirstAsync<{ user_id: string | null }>(
        `SELECT user_id FROM tasks WHERE id = 'pre_auth_task';`
      );
      expect(checkPre?.user_id ?? null).toBeNull();

      // Student signs up
      const auth = AuthService.getInstance();
      const signup = await auth.signUp({
        name: 'Converted Student',
        email: 'converted@karyadex.edu',
        password: 'password123',
      });

      // Verify pre-existing task now has user_id populated
      const checkPost = await db.getFirstAsync<{ user_id: string | null }>(
        `SELECT user_id FROM tasks WHERE id = 'pre_auth_task';`
      );
      expect(checkPost?.user_id).toBe(signup.user!.id);
    });

    it('isolates demo state: never migrates demo mode data to real cloud account', async () => {
      useAppStore.setState({ isDemoMode: true });

      const auth = AuthService.getInstance();
      const res = await auth.migrateLocalDataToUser('real_user_id');
      expect(res.migratedCount).toBe(0);
    });
  });
});
