import crypto from 'crypto';
import { query, withTransaction } from '../postgres';
import {
  LibraryResource,
  ResourceFilterParams,
  PaginatedResult,
} from '../types';

/**
 * Library Repository for NEXORA Platform
 * Provides access to digital books, guides, worksheets, and scientific curriculum resources.
 * Reliable download tracking without storing binary BLOBs in PostgreSQL.
 */
export class LibraryRepository {
  /**
   * Lists library resources with filtering and pagination
   */
  public async listResources(filters: ResourceFilterParams = {}): Promise<PaginatedResult<LibraryResource>> {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(50, Math.max(1, filters.limit || 12));
    const offset = filters.offset ?? (page - 1) * limit;

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    // Filter by status (default: 'published')
    if (filters.status) {
      conditions.push(`r.status = $${idx++}`);
      values.push(filters.status);
    } else {
      conditions.push(`r.status = 'published'`);
    }

    if (filters.category) {
      conditions.push(`r.category = $${idx++}`);
      values.push(filters.category);
    }

    if (filters.subject) {
      conditions.push(`r.subject = $${idx++}`);
      values.push(filters.subject);
    }

    if (filters.grade_level) {
      conditions.push(`r.grade_level = $${idx++}`);
      values.push(filters.grade_level);
    }

    if (filters.search) {
      conditions.push(`(r.title ILIKE $${idx} OR r.description ILIKE $${idx} OR r.publisher_name ILIKE $${idx})`);
      values.push(`%${filters.search.trim()}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) AS total FROM library_resources r ${whereClause}`;
    const countRes = await query<{ total: string }>(countSql, values);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    values.push(limit, offset);
    const dataSql = `
      SELECT r.*
      FROM library_resources r
      ${whereClause}
      ORDER BY r.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    const dataRes = await query<LibraryResource>(dataSql, values);

    return {
      data: dataRes.rows,
      pagination: {
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit) || 1,
        hasMore: page * limit < total,
      },
    };
  }

  /**
   * Retrieves resource by ID and increments views count
   */
  public async getResourceById(id: string): Promise<LibraryResource | null> {
    const res = await query<LibraryResource>(
      'SELECT * FROM library_resources WHERE id = $1 LIMIT 1',
      [id]
    );

    if (!res.rows[0]) return null;

    await query('UPDATE library_resources SET views_count = views_count + 1 WHERE id = $1', [id]).catch(() => {});
    return res.rows[0];
  }

  /**
   * Creates a new library resource record
   */
  public async createResource(
    resource: Omit<LibraryResource, 'created_at' | 'updated_at' | 'downloads_count' | 'views_count'>
  ): Promise<LibraryResource> {
    const id = resource.id || `res_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const res = await query<LibraryResource>(
      `INSERT INTO library_resources (
        id, title, description, category, subject, grade_level, author_id,
        publisher_name, file_url, file_size_bytes, file_type, mime_type,
        status, downloads_count, views_count, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, $9, $10, $11, $12,
        COALESCE($13, 'published'), 0, 0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) RETURNING *`,
      [
        id,
        resource.title.trim(),
        resource.description || null,
        resource.category,
        resource.subject.trim(),
        resource.grade_level.trim(),
        resource.author_id || null,
        resource.publisher_name || null,
        resource.file_url,
        resource.file_size_bytes,
        resource.file_type,
        resource.mime_type,
        resource.status || 'published',
      ]
    );

    return res.rows[0];
  }

  /**
   * Updates a library resource
   */
  public async updateResource(
    id: string,
    updates: Partial<Pick<LibraryResource, 'title' | 'description' | 'category' | 'subject' | 'grade_level' | 'status'>>
  ): Promise<LibraryResource> {
    const fields: string[] = [];
    const values: any[] = [id];
    let idx = 2;

    if (updates.title !== undefined) {
      fields.push(`title = $${idx++}`);
      values.push(updates.title.trim());
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(updates.description);
    }
    if (updates.category !== undefined) {
      fields.push(`category = $${idx++}`);
      values.push(updates.category);
    }
    if (updates.subject !== undefined) {
      fields.push(`subject = $${idx++}`);
      values.push(updates.subject.trim());
    }
    if (updates.grade_level !== undefined) {
      fields.push(`grade_level = $${idx++}`);
      values.push(updates.grade_level.trim());
    }
    if (updates.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(updates.status);
    }

    if (fields.length === 0) {
      const existing = await this.getResourceById(id);
      if (!existing) throw new Error('RESOURCE_NOT_FOUND: المورد غير موجود');
      return existing;
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');

    const sql = `UPDATE library_resources SET ${fields.join(', ')} WHERE id = $1 RETURNING *`;
    const res = await query<LibraryResource>(sql, values);

    if (res.rowCount === 0) {
      throw new Error('RESOURCE_NOT_FOUND: المورد غير موجود');
    }

    return res.rows[0];
  }

  /**
   * Soft deletes a resource by marking status as 'archived'
   */
  public async softDeleteResource(id: string): Promise<boolean> {
    const res = await query(
      `UPDATE library_resources SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Atomically increments download counter and returns updated count
   */
  public async incrementDownloads(id: string): Promise<number> {
    const res = await query<{ downloads_count: number }>(
      `UPDATE library_resources 
       SET downloads_count = downloads_count + 1, updated_at = CURRENT_TIMESTAMP 
       WHERE id = $1 
       RETURNING downloads_count`,
      [id]
    );

    if (res.rowCount === 0) {
      throw new Error('RESOURCE_NOT_FOUND: المورد غير موجود');
    }

    return res.rows[0].downloads_count;
  }
}

export const libraryRepo = new LibraryRepository();
