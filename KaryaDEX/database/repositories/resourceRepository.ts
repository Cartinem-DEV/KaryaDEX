/**
 * BunkMatKar — Resource Metadata SQLite Repository
 *
 * Persists resource references, file links, scanned PDF paths, and video links.
 */

import { getDatabaseConnection } from '../db';
import type { ResourceRow } from '../types';
import type { Resource } from '@/types/academic';

export class ResourceRepository {
  async getResources(): Promise<Resource[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<ResourceRow>(
      `SELECT * FROM resources ORDER BY created_at DESC;`
    );
    return rows.map(r => this.mapResourceRow(r));
  }

  async getAllResources(): Promise<Resource[]> {
    return this.getResources();
  }

  async getResourceById(id: string): Promise<Resource | null> {
    const db = await getDatabaseConnection();
    const r = await db.getFirstAsync<ResourceRow>(
      `SELECT * FROM resources WHERE id = ?;`,
      [id]
    );
    return r ? this.mapResourceRow(r) : null;
  }

  async getResourcesForSession(classSessionId: string): Promise<Resource[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<ResourceRow>(
      `SELECT * FROM resources WHERE class_session_id = ? ORDER BY created_at DESC;`,
      [classSessionId]
    );
    return rows.map(r => this.mapResourceRow(r));
  }

  async getResourcesForNote(classNoteId: string): Promise<Resource[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<ResourceRow>(
      `SELECT * FROM resources WHERE class_note_id = ? ORDER BY created_at DESC;`,
      [classNoteId]
    );
    return rows.map(r => this.mapResourceRow(r));
  }

  async getResourcesForSubject(subjectId: string): Promise<Resource[]> {
    const db = await getDatabaseConnection();
    const rows = await db.getAllAsync<ResourceRow>(
      `SELECT * FROM resources WHERE subject_id = ? ORDER BY created_at DESC;`,
      [subjectId]
    );
    return rows.map(r => this.mapResourceRow(r));
  }

  async createResource(res: Resource): Promise<Resource> {
    const db = await getDatabaseConnection();
    const now = new Date().toISOString();
    await db.runAsync(
      `INSERT INTO resources (
        id, class_note_id, class_session_id, subject_id, topic_id, exam_id,
        title, type, uri, url, mime_type, file_size, source, is_local, is_recommended, created_at
      ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
      ON CONFLICT(id) DO UPDATE SET
        title = excluded.title,
        uri = excluded.uri,
        url = excluded.url,
        file_size = excluded.file_size;`,
      [
        res.id,
        res.classNoteId || null,
        res.classSessionId || null,
        res.subjectId || null,
        res.topicId || null,
        res.examId || null,
        res.title,
        res.type,
        res.uri || null,
        res.url || null,
        res.mimeType || null,
        res.fileSize || res.sizeBytes || 0,
        res.source || 'file',
        res.isLocal ? 1 : 0,
        res.isRecommended ? 1 : 0,
        res.createdAt || now,
      ]
    );
    return res;
  }

  async deleteResource(id: string): Promise<void> {
    const db = await getDatabaseConnection();
    await db.runAsync(`DELETE FROM resources WHERE id = ?;`, [id]);
  }

  private mapResourceRow(r: ResourceRow): Resource {
    return {
      id: r.id,
      classNoteId: r.class_note_id || undefined,
      classSessionId: r.class_session_id || undefined,
      subjectId: r.subject_id || undefined,
      topicId: r.topic_id || undefined,
      examId: r.exam_id || undefined,
      title: r.title,
      type: r.type as any,
      uri: r.uri || undefined,
      url: r.url || undefined,
      mimeType: r.mime_type || undefined,
      fileSize: r.file_size,
      sizeBytes: r.file_size,
      source: r.source as any,
      isLocal: r.is_local === 1,
      isRecommended: r.is_recommended === 1,
      createdAt: r.created_at,
    };
  }
}

export const resourceRepository = new ResourceRepository();
