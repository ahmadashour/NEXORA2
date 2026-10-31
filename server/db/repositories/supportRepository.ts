import crypto from 'crypto';
import { query } from '../postgres';
import {
  ContactInquiry,
  ContactFilterParams,
  PaginatedResult,
  InquiryStatus,
} from '../types';

/**
 * Support & Inquiries Repository for NEXORA Platform
 * Securely stores visitor and user inquiries with administrative lifecycle tracking.
 */
export class SupportRepository {
  /**
   * Submits a new contact inquiry
   */
  public async createInquiry(
    inquiry: Omit<ContactInquiry, 'id' | 'created_at' | 'updated_at' | 'status' | 'admin_notes' | 'assigned_to'>
  ): Promise<ContactInquiry> {
    const id = `inq_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

    const res = await query<ContactInquiry>(
      `INSERT INTO contact_inquiries (
        id, user_id, full_name, email, phone, subject, message,
        portal_code, status, admin_notes, assigned_to, created_at, updated_at
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7,
        $8, 'received', NULL, NULL, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
      ) RETURNING *`,
      [
        id,
        inquiry.user_id || null,
        inquiry.full_name.trim(),
        inquiry.email.trim().toLowerCase(),
        inquiry.phone || null,
        inquiry.subject.trim(),
        inquiry.message.trim(),
        inquiry.portal_code || null,
      ]
    );

    return res.rows[0];
  }

  /**
   * Lists inquiries with administrative filters and pagination.
   * Access restricted to authorized administrative users (LEAD, PRO).
   */
  public async listInquiries(filters: ContactFilterParams = {}): Promise<PaginatedResult<ContactInquiry>> {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(50, Math.max(1, filters.limit || 15));
    const offset = filters.offset ?? (page - 1) * limit;

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    if (filters.status) {
      conditions.push(`status = $${idx++}`);
      values.push(filters.status);
    }

    if (filters.user_id) {
      conditions.push(`user_id = $${idx++}`);
      values.push(filters.user_id);
    }

    if (filters.portal_code) {
      conditions.push(`portal_code = $${idx++}`);
      values.push(filters.portal_code);
    }

    if (filters.search) {
      conditions.push(`(full_name ILIKE $${idx} OR email ILIKE $${idx} OR subject ILIKE $${idx} OR message ILIKE $${idx})`);
      values.push(`%${filters.search.trim()}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    const countSql = `SELECT COUNT(*) AS total FROM contact_inquiries ${whereClause}`;
    const countRes = await query<{ total: string }>(countSql, values);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    values.push(limit, offset);
    const dataSql = `
      SELECT *
      FROM contact_inquiries
      ${whereClause}
      ORDER BY created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    const dataRes = await query<ContactInquiry>(dataSql, values);

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
   * Retrieves an inquiry by ID
   */
  public async getInquiryById(id: string): Promise<ContactInquiry | null> {
    const res = await query<ContactInquiry>(
      'SELECT * FROM contact_inquiries WHERE id = $1 LIMIT 1',
      [id]
    );
    return res.rows[0] || null;
  }

  /**
   * Updates an inquiry status and administrative follow-up notes
   */
  public async updateInquiryStatus(
    id: string,
    status: InquiryStatus,
    adminNotes?: string,
    assignedTo?: string
  ): Promise<ContactInquiry> {
    const res = await query<ContactInquiry>(
      `UPDATE contact_inquiries
       SET status = $2,
           admin_notes = COALESCE($3, admin_notes),
           assigned_to = COALESCE($4, assigned_to),
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $1
       RETURNING *`,
      [id, status, adminNotes || null, assignedTo || null]
    );

    if (res.rowCount === 0) {
      throw new Error('INQUIRY_NOT_FOUND: طلب الاستفسار غير موجود');
    }

    return res.rows[0];
  }
}

export const supportRepo = new SupportRepository();
