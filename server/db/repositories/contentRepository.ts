import crypto from 'crypto';
import { query, withTransaction } from '../postgres';
import {
  ContentItem,
  EventDetail,
  EventRegistration,
  ContentFilterParams,
  PaginatedResult,
} from '../types';

/**
 * Content & Events Repository for NEXORA Platform
 * Provides access to news, articles, videos, and scientific events.
 * Guarantees atomic seat reservation transactions that prevent overcapacity under high concurrency.
 */
export class ContentRepository {
  /**
   * Lists content items with optional event details, filtering, and pagination
   */
  public async listContent(
    filters: ContentFilterParams = {},
    currentUserId?: string
  ): Promise<PaginatedResult<ContentItem>> {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(50, Math.max(1, filters.limit || 10));
    const offset = filters.offset ?? (page - 1) * limit;

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    // Filter by status (default: 'published')
    if (filters.status) {
      conditions.push(`c.status = $${idx++}`);
      values.push(filters.status);
    } else {
      conditions.push(`c.status = 'published'`);
    }

    if (filters.category) {
      conditions.push(`c.category = $${idx++}`);
      values.push(filters.category);
    }

    if (filters.subject) {
      conditions.push(`c.subject = $${idx++}`);
      values.push(filters.subject);
    }

    if (filters.grade_level) {
      conditions.push(`c.grade_level = $${idx++}`);
      values.push(filters.grade_level);
    }

    if (filters.featured !== undefined) {
      conditions.push(`c.featured = $${idx++}`);
      values.push(filters.featured);
    }

    if (filters.search) {
      conditions.push(`(c.title ILIKE $${idx} OR c.description ILIKE $${idx})`);
      values.push(`%${filters.search.trim()}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) AS total FROM content_items c ${whereClause}`;
    const countRes = await query<{ total: string }>(countSql, values);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    values.push(limit, offset);
    const dataSql = `
      SELECT 
        c.*,
        ed.id AS ed_id,
        ed.event_date,
        ed.duration_minutes,
        ed.location_type,
        ed.location_address,
        ed.speaker_name,
        ed.speaker_title,
        ed.seats_capacity,
        ed.seats_booked,
        ed.created_at AS ed_created_at,
        ed.updated_at AS ed_updated_at
      FROM content_items c
      LEFT JOIN event_details ed ON c.id = ed.content_item_id
      ${whereClause}
      ORDER BY c.featured DESC, c.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    const dataRes = await query<any>(dataSql, values);

    const items: ContentItem[] = dataRes.rows.map((row) => {
      const item: ContentItem = {
        id: row.id,
        title: row.title,
        description: row.description,
        category: row.category,
        subject: row.subject,
        grade_level: row.grade_level,
        author_id: row.author_id,
        thumbnail_url: row.thumbnail_url,
        video_url: row.video_url,
        read_time_minutes: row.read_time_minutes,
        status: row.status,
        featured: row.featured,
        views_count: row.views_count,
        created_at: row.created_at,
        updated_at: row.updated_at,
      };

      if (row.ed_id) {
        item.event_detail = {
          id: row.ed_id,
          content_item_id: row.id,
          event_date: row.event_date,
          duration_minutes: row.duration_minutes,
          location_type: row.location_type,
          location_address: row.location_address,
          speaker_name: row.speaker_name,
          speaker_title: row.speaker_title,
          seats_capacity: row.seats_capacity,
          seats_booked: row.seats_booked,
          created_at: row.ed_created_at,
          updated_at: row.ed_updated_at,
        };
      }

      return item;
    });

    return {
      data: items,
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
   * Retrieves content item by ID with attached event detail and registration status
   */
  public async getContentById(id: string, currentUserId?: string): Promise<ContentItem | null> {
    const sql = `
      SELECT 
        c.*,
        ed.id AS ed_id,
        ed.event_date,
        ed.duration_minutes,
        ed.location_type,
        ed.location_address,
        ed.speaker_name,
        ed.speaker_title,
        ed.seats_capacity,
        ed.seats_booked,
        ed.created_at AS ed_created_at,
        ed.updated_at AS ed_updated_at
      FROM content_items c
      LEFT JOIN event_details ed ON c.id = ed.content_item_id
      WHERE c.id = $1
      LIMIT 1
    `;

    const res = await query<any>(sql, [id]);
    if (!res.rows[0]) return null;

    const row = res.rows[0];
    const item: ContentItem = {
      id: row.id,
      title: row.title,
      description: row.description,
      category: row.category,
      subject: row.subject,
      grade_level: row.grade_level,
      author_id: row.author_id,
      thumbnail_url: row.thumbnail_url,
      video_url: row.video_url,
      read_time_minutes: row.read_time_minutes,
      status: row.status,
      featured: row.featured,
      views_count: row.views_count,
      created_at: row.created_at,
      updated_at: row.updated_at,
    };

    if (row.ed_id) {
      let isRegistered = false;
      if (currentUserId) {
        const regCheck = await query(
          'SELECT 1 FROM event_registrations WHERE event_id = $1 AND user_id = $2',
          [row.ed_id, currentUserId]
        );
        isRegistered = (regCheck.rowCount ?? 0) > 0;
      }

      item.event_detail = {
        id: row.ed_id,
        content_item_id: row.id,
        event_date: row.event_date,
        duration_minutes: row.duration_minutes,
        location_type: row.location_type,
        location_address: row.location_address,
        speaker_name: row.speaker_name,
        speaker_title: row.speaker_title,
        seats_capacity: row.seats_capacity,
        seats_booked: row.seats_booked,
        created_at: row.ed_created_at,
        updated_at: row.ed_updated_at,
        is_registered_by_me: isRegistered,
      };
    }

    await query('UPDATE content_items SET views_count = views_count + 1 WHERE id = $1', [id]).catch(() => {});

    return item;
  }

  /**
   * Creates content item and optional event detail atomically in a single transaction
   */
  public async createContentWithEvent(
    content: Omit<ContentItem, 'created_at' | 'updated_at' | 'views_count' | 'event_detail'>,
    eventDetail?: Omit<EventDetail, 'id' | 'content_item_id' | 'created_at' | 'updated_at' | 'seats_booked'>
  ): Promise<ContentItem> {
    return await withTransaction(async (client) => {
      const contentId = content.id || `cnt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      const contentRes = await client.query<ContentItem>(
        `INSERT INTO content_items (
          id, title, description, category, subject, grade_level, author_id,
          thumbnail_url, video_url, read_time_minutes, status, featured,
          views_count, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          $8, $9, COALESCE($10, 5), COALESCE($11, 'published'), COALESCE($12, FALSE),
          0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) RETURNING *`,
        [
          contentId,
          content.title.trim(),
          content.description.trim(),
          content.category,
          content.subject || null,
          content.grade_level || null,
          content.author_id || null,
          content.thumbnail_url || null,
          content.video_url || null,
          content.read_time_minutes,
          content.status || 'published',
          content.featured || false,
        ]
      );

      const created = contentRes.rows[0];

      if (eventDetail) {
        const eventId = `evt_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
        const eventRes = await client.query<EventDetail>(
          `INSERT INTO event_details (
            id, content_item_id, event_date, duration_minutes, location_type,
            location_address, speaker_name, speaker_title, seats_capacity,
            seats_booked, created_at, updated_at
          ) VALUES (
            $1, $2, $3, $4, $5,
            $6, $7, $8, $9,
            0, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
          ) RETURNING *`,
          [
            eventId,
            contentId,
            eventDetail.event_date,
            eventDetail.duration_minutes || 60,
            eventDetail.location_type || 'virtual',
            eventDetail.location_address || null,
            eventDetail.speaker_name,
            eventDetail.speaker_title || null,
            eventDetail.seats_capacity,
          ]
        );
        created.event_detail = eventRes.rows[0];
      }

      return created;
    });
  }

  /**
   * Registers a user for an event atomically, locking the event row to prevent overcapacity.
   * Only returns registration once COMMIT succeeds.
   */
  public async registerForEvent(
    eventId: string,
    userId: string,
    notes?: string
  ): Promise<EventRegistration> {
    return await withTransaction(async (client) => {
      // 1. Lock the event record with FOR UPDATE to prevent concurrent race conditions
      const eventRes = await client.query<EventDetail>(
        'SELECT * FROM event_details WHERE id = $1 FOR UPDATE',
        [eventId]
      );

      if (eventRes.rowCount === 0) {
        throw new Error('EVENT_NOT_FOUND: الفعالية المطلوبة غير موجودة');
      }

      const event = eventRes.rows[0];

      // 2. Verify capacity
      if (event.seats_booked >= event.seats_capacity) {
        const err = new Error('EVENT_CAPACITY_EXCEEDED: تم اكتمال المقاعد المتاحة لهذه الفعالية بالكامل');
        (err as { statusCode?: number }).statusCode = 409;
        throw err;
      }

      // 3. Verify uniqueness: check if user already registered
      const checkRes = await client.query(
        'SELECT 1 FROM event_registrations WHERE event_id = $1 AND user_id = $2',
        [eventId, userId]
      );

      if (checkRes.rowCount && checkRes.rowCount > 0) {
        const err = new Error('ALREADY_REGISTERED: لقد قمت بالتسجيل مسبقاً في هذه الفعالية');
        (err as { statusCode?: number }).statusCode = 409;
        throw err;
      }

      // 4. Create registration record
      const regId = `reg_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
      const regRes = await client.query<EventRegistration>(
        `INSERT INTO event_registrations (
          id, event_id, user_id, status, registration_notes, created_at
        ) VALUES ($1, $2, $3, 'confirmed', $4, CURRENT_TIMESTAMP)
        RETURNING *`,
        [regId, eventId, userId, notes || null]
      );

      // 5. Increment booked counter with atomic safety condition
      const updateRes = await client.query(
        `UPDATE event_details 
         SET seats_booked = seats_booked + 1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $1 AND seats_booked < seats_capacity`,
        [eventId]
      );

      if (updateRes.rowCount === 0) {
        const err = new Error('EVENT_CAPACITY_EXCEEDED: تم حجز آخر مقعد شاغر بالتزامن، تعذر إتمام التسجيل');
        (err as { statusCode?: number }).statusCode = 409;
        throw err;
      }

      return regRes.rows[0];
    });
  }

  /**
   * Cancels event registration and decrements seat counter atomically
   */
  public async cancelEventRegistration(eventId: string, userId: string): Promise<boolean> {
    return await withTransaction(async (client) => {
      const delRes = await client.query(
        'DELETE FROM event_registrations WHERE event_id = $1 AND user_id = $2',
        [eventId, userId]
      );

      if ((delRes.rowCount ?? 0) > 0) {
        await client.query(
          'UPDATE event_details SET seats_booked = GREATEST(0, seats_booked - 1), updated_at = CURRENT_TIMESTAMP WHERE id = $1',
          [eventId]
        );
        return true;
      }

      return false;
    });
  }

  /**
   * Updates an existing content item
   */
  public async updateContent(
    id: string,
    updates: Partial<Pick<ContentItem, 'title' | 'description' | 'category' | 'subject' | 'grade_level' | 'thumbnail_url' | 'video_url' | 'read_time_minutes' | 'status' | 'featured'>>
  ): Promise<ContentItem> {
    const fields: string[] = [];
    const values: any[] = [id];
    let idx = 2;

    if (updates.title !== undefined) {
      fields.push(`title = $${idx++}`);
      values.push(updates.title.trim());
    }
    if (updates.description !== undefined) {
      fields.push(`description = $${idx++}`);
      values.push(updates.description.trim());
    }
    if (updates.category !== undefined) {
      fields.push(`category = $${idx++}`);
      values.push(updates.category);
    }
    if (updates.subject !== undefined) {
      fields.push(`subject = $${idx++}`);
      values.push(updates.subject ? updates.subject.trim() : null);
    }
    if (updates.grade_level !== undefined) {
      fields.push(`grade_level = $${idx++}`);
      values.push(updates.grade_level ? updates.grade_level.trim() : null);
    }
    if (updates.thumbnail_url !== undefined) {
      fields.push(`thumbnail_url = $${idx++}`);
      values.push(updates.thumbnail_url);
    }
    if (updates.video_url !== undefined) {
      fields.push(`video_url = $${idx++}`);
      values.push(updates.video_url);
    }
    if (updates.read_time_minutes !== undefined) {
      fields.push(`read_time_minutes = $${idx++}`);
      values.push(updates.read_time_minutes);
    }
    if (updates.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(updates.status);
    }
    if (updates.featured !== undefined) {
      fields.push(`featured = $${idx++}`);
      values.push(updates.featured);
    }

    if (fields.length === 0) {
      const existing = await this.getContentById(id);
      if (!existing) throw new Error('CONTENT_NOT_FOUND: عنصر المحتوى غير موجود');
      return existing;
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    const sql = `UPDATE content_items SET ${fields.join(', ')} WHERE id = $1 RETURNING *`;
    const res = await query<ContentItem>(sql, values);

    if (res.rowCount === 0) {
      throw new Error('CONTENT_NOT_FOUND: عنصر المحتوى غير موجود');
    }

    return await this.getContentById(id) || res.rows[0];
  }

  /**
   * Soft deletes content item by updating status to 'archived'
   */
  public async softDeleteContent(id: string): Promise<boolean> {
    const res = await query(
      `UPDATE content_items SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
      [id]
    );
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Retrieves event detail directly by event ID or content item ID
   */
  public async getEventById(eventId: string, currentUserId?: string): Promise<EventDetail | null> {
    const sql = `
      SELECT ed.*
      FROM event_details ed
      WHERE ed.id = $1 OR ed.content_item_id = $1
      LIMIT 1
    `;
    const res = await query<EventDetail>(sql, [eventId]);
    if (!res.rows[0]) return null;

    const event = res.rows[0];
    if (currentUserId) {
      const regRes = await query(
        'SELECT 1 FROM event_registrations WHERE event_id = $1 AND user_id = $2',
        [event.id, currentUserId]
      );
      event.is_registered_by_me = (regRes.rowCount ?? 0) > 0;
    }

    return event;
  }

  /**
   * Updates event detail record
   */
  public async updateEventDetail(
    eventId: string,
    updates: Partial<Pick<EventDetail, 'event_date' | 'duration_minutes' | 'location_type' | 'location_address' | 'speaker_name' | 'speaker_title' | 'seats_capacity'>>
  ): Promise<EventDetail> {
    const fields: string[] = [];
    const values: any[] = [eventId];
    let idx = 2;

    if (updates.event_date !== undefined) {
      fields.push(`event_date = $${idx++}`);
      values.push(updates.event_date);
    }
    if (updates.duration_minutes !== undefined) {
      fields.push(`duration_minutes = $${idx++}`);
      values.push(updates.duration_minutes);
    }
    if (updates.location_type !== undefined) {
      fields.push(`location_type = $${idx++}`);
      values.push(updates.location_type);
    }
    if (updates.location_address !== undefined) {
      fields.push(`location_address = $${idx++}`);
      values.push(updates.location_address);
    }
    if (updates.speaker_name !== undefined) {
      fields.push(`speaker_name = $${idx++}`);
      values.push(updates.speaker_name.trim());
    }
    if (updates.speaker_title !== undefined) {
      fields.push(`speaker_title = $${idx++}`);
      values.push(updates.speaker_title);
    }
    if (updates.seats_capacity !== undefined) {
      fields.push(`seats_capacity = $${idx++}`);
      values.push(updates.seats_capacity);
    }

    if (fields.length === 0) {
      const existing = await this.getEventById(eventId);
      if (!existing) throw new Error('EVENT_NOT_FOUND: الفعالية غير موجودة');
      return existing;
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');
    const sql = `UPDATE event_details SET ${fields.join(', ')} WHERE id = $1 RETURNING *`;
    const res = await query<EventDetail>(sql, values);

    if (res.rowCount === 0) {
      throw new Error('EVENT_NOT_FOUND: الفعالية غير موجودة');
    }

    return res.rows[0];
  }
}

export const contentRepo = new ContentRepository();

