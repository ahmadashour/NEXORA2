import crypto from 'crypto';
import { query, withTransaction } from '../postgres';
import {
  CommunityPost,
  CommunityAttachment,
  CommunityComment,
  CommunityLike,
  CommunityBookmark,
  PostFilterParams,
  PaginatedResult,
  PostStatus,
} from '../types';

/**
 * Community Repository for NEXORA Platform
 * Provides SQL-parameterized data access for posts, attachments, comments, likes, and bookmarks.
 * Enforces ownership checks, atomic transactions, and pagination.
 */
export class CommunityRepository {
  /**
   * Lists community posts with filtering, search, and pagination
   */
  public async listPosts(
    filters: PostFilterParams = {},
    currentUserId?: string
  ): Promise<PaginatedResult<CommunityPost>> {
    const page = Math.max(1, filters.page || 1);
    const limit = Math.min(50, Math.max(1, filters.limit || 10));
    const offset = filters.offset ?? (page - 1) * limit;

    const conditions: string[] = [];
    const values: any[] = [];
    let idx = 1;

    // Filter by status (default: 'published' if not specified)
    if (filters.status) {
      conditions.push(`p.status = $${idx++}`);
      values.push(filters.status);
    } else {
      conditions.push(`p.status = 'published'`);
    }

    if (filters.subject) {
      conditions.push(`p.subject = $${idx++}`);
      values.push(filters.subject);
    }

    if (filters.grade_level) {
      conditions.push(`p.grade_level = $${idx++}`);
      values.push(filters.grade_level);
    }

    if (filters.author_id) {
      conditions.push(`p.author_id = $${idx++}`);
      values.push(filters.author_id);
    }

    if (filters.tag) {
      conditions.push(`$${idx++} = ANY(p.tags)`);
      values.push(filters.tag);
    }

    if (filters.search) {
      conditions.push(`(p.title ILIKE $${idx} OR p.summary ILIKE $${idx} OR p.content ILIKE $${idx})`);
      values.push(`%${filters.search.trim()}%`);
      idx++;
    }

    const whereClause = conditions.length > 0 ? `WHERE ${conditions.join(' AND ')}` : '';

    // Count query
    const countSql = `SELECT COUNT(*) AS total FROM community_posts p ${whereClause}`;
    const countRes = await query<{ total: string }>(countSql, values);
    const total = parseInt(countRes.rows[0]?.total || '0', 10);

    // Data query with author info and interaction flags
    let selectFields = `
      p.*,
      up.full_name AS author_name,
      r.code AS author_role
    `;

    if (currentUserId) {
      values.push(currentUserId);
      const userParamIdx = idx++;
      selectFields += `,
        EXISTS(SELECT 1 FROM community_likes cl WHERE cl.post_id = p.id AND cl.user_id = $${userParamIdx}) AS is_liked_by_me,
        EXISTS(SELECT 1 FROM community_bookmarks cb WHERE cb.post_id = p.id AND cb.user_id = $${userParamIdx}) AS is_bookmarked_by_me
      `;
    }

    values.push(limit, offset);
    const dataSql = `
      SELECT ${selectFields}
      FROM community_posts p
      LEFT JOIN users u ON p.author_id = u.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      LEFT JOIN roles r ON u.role_id = r.id
      ${whereClause}
      ORDER BY p.is_pinned DESC, p.created_at DESC
      LIMIT $${idx++} OFFSET $${idx++}
    `;

    const dataRes = await query<CommunityPost>(dataSql, values);

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
   * Retrieves a single post by ID with author details and optional user interaction flags
   */
  public async getPostById(id: string, currentUserId?: string): Promise<CommunityPost | null> {
    const values: any[] = [id];
    let selectFields = `
      p.*,
      up.full_name AS author_name,
      r.code AS author_role
    `;

    if (currentUserId) {
      values.push(currentUserId);
      selectFields += `,
        EXISTS(SELECT 1 FROM community_likes cl WHERE cl.post_id = p.id AND cl.user_id = $2) AS is_liked_by_me,
        EXISTS(SELECT 1 FROM community_bookmarks cb WHERE cb.post_id = p.id AND cb.user_id = $2) AS is_bookmarked_by_me
      `;
    }

    const sql = `
      SELECT ${selectFields}
      FROM community_posts p
      LEFT JOIN users u ON p.author_id = u.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE p.id = $1
      LIMIT 1
    `;

    const res = await query<CommunityPost>(sql, values);
    if (!res.rows[0]) return null;

    // Increment views atomically
    await query('UPDATE community_posts SET views_count = views_count + 1 WHERE id = $1', [id]).catch(() => {});

    return res.rows[0];
  }

  /**
   * Creates a community post with optional attachments in a single transaction
   */
  public async createPost(
    post: Omit<CommunityPost, 'created_at' | 'updated_at' | 'likes_count' | 'comments_count' | 'bookmarks_count' | 'views_count'>,
    attachments?: Omit<CommunityAttachment, 'id' | 'post_id' | 'created_at'>[]
  ): Promise<CommunityPost> {
    return await withTransaction(async (client) => {
      const postId = post.id || `post_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      const postRes = await client.query<CommunityPost>(
        `INSERT INTO community_posts (
          id, author_id, title, subject, grade_level, summary, content,
          status, likes_count, comments_count, bookmarks_count, views_count,
          is_pinned, tags, created_at, updated_at
        ) VALUES (
          $1, $2, $3, $4, $5, $6, $7,
          COALESCE($8, 'published'), 0, 0, 0, 0,
          COALESCE($9, FALSE), COALESCE($10, ARRAY[]::TEXT[]), CURRENT_TIMESTAMP, CURRENT_TIMESTAMP
        ) RETURNING *`,
        [
          postId,
          post.author_id,
          post.title.trim(),
          post.subject.trim(),
          post.grade_level.trim(),
          post.summary.trim(),
          post.content || null,
          post.status || 'published',
          post.is_pinned || false,
          post.tags || [],
        ]
      );

      const createdPost = postRes.rows[0];

      if (attachments && attachments.length > 0) {
        for (const att of attachments) {
          const attId = `att_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;
          await client.query(
            `INSERT INTO community_attachments (
              id, post_id, file_name, file_path, file_size_bytes, mime_type, file_type, created_at
            ) VALUES ($1, $2, $3, $4, $5, $6, $7, CURRENT_TIMESTAMP)`,
            [
              attId,
              postId,
              att.file_name,
              att.file_path,
              att.file_size_bytes,
              att.mime_type,
              att.file_type,
            ]
          );
        }
      }

      return createdPost;
    });
  }

  /**
   * Updates an existing post with strict author ownership verification
   */
  public async updatePost(
    id: string,
    authorId: string,
    updates: Partial<Pick<CommunityPost, 'title' | 'subject' | 'grade_level' | 'summary' | 'content' | 'status' | 'tags'>>
  ): Promise<CommunityPost> {
    const fields: string[] = [];
    const values: any[] = [id, authorId];
    let idx = 3;

    if (updates.title !== undefined) {
      fields.push(`title = $${idx++}`);
      values.push(updates.title.trim());
    }
    if (updates.subject !== undefined) {
      fields.push(`subject = $${idx++}`);
      values.push(updates.subject.trim());
    }
    if (updates.grade_level !== undefined) {
      fields.push(`grade_level = $${idx++}`);
      values.push(updates.grade_level.trim());
    }
    if (updates.summary !== undefined) {
      fields.push(`summary = $${idx++}`);
      values.push(updates.summary.trim());
    }
    if (updates.content !== undefined) {
      fields.push(`content = $${idx++}`);
      values.push(updates.content);
    }
    if (updates.status !== undefined) {
      fields.push(`status = $${idx++}`);
      values.push(updates.status);
    }
    if (updates.tags !== undefined) {
      fields.push(`tags = $${idx++}`);
      values.push(updates.tags);
    }

    if (fields.length === 0) {
      const existing = await this.getPostById(id);
      if (!existing) throw new Error('POST_NOT_FOUND: المنشور غير موجود');
      return existing;
    }

    fields.push('updated_at = CURRENT_TIMESTAMP');

    const sql = `
      UPDATE community_posts
      SET ${fields.join(', ')}
      WHERE id = $1 AND author_id = $2
      RETURNING *
    `;

    const res = await query<CommunityPost>(sql, values);
    if (res.rowCount === 0) {
      throw new Error('UNAUTHORIZED_OR_NOT_FOUND: ليس لديك صلاحية تعديل هذا المنشور أو أنه غير موجود');
    }

    return res.rows[0];
  }

  /**
   * Soft deletes a post by setting status to 'archived'
   */
  public async softDeletePost(id: string, authorId: string, isAdmin = false): Promise<boolean> {
    let sql: string;
    let values: any[];

    if (isAdmin) {
      sql = `UPDATE community_posts SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = $1`;
      values = [id];
    } else {
      sql = `UPDATE community_posts SET status = 'archived', updated_at = CURRENT_TIMESTAMP WHERE id = $1 AND author_id = $2`;
      values = [id, authorId];
    }

    const res = await query(sql, values);
    return (res.rowCount ?? 0) > 0;
  }

  /**
   * Toggles like state atomically using transaction and updates like counter
   */
  public async toggleLike(postId: string, userId: string): Promise<{ liked: boolean; likesCount: number }> {
    return await withTransaction(async (client) => {
      // Check if like exists
      const checkRes = await client.query(
        'SELECT 1 FROM community_likes WHERE post_id = $1 AND user_id = $2',
        [postId, userId]
      );

      let liked = false;
      if (checkRes.rowCount && checkRes.rowCount > 0) {
        // Remove like
        await client.query('DELETE FROM community_likes WHERE post_id = $1 AND user_id = $2', [postId, userId]);
        await client.query('UPDATE community_posts SET likes_count = GREATEST(0, likes_count - 1) WHERE id = $1', [postId]);
        liked = false;
      } else {
        // Add like
        await client.query(
          'INSERT INTO community_likes (post_id, user_id, created_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING',
          [postId, userId]
        );
        await client.query('UPDATE community_posts SET likes_count = likes_count + 1 WHERE id = $1', [postId]);
        liked = true;
      }

      const countRes = await client.query<{ likes_count: number }>(
        'SELECT likes_count FROM community_posts WHERE id = $1',
        [postId]
      );

      return {
        liked,
        likesCount: countRes.rows[0]?.likes_count ?? 0,
      };
    });
  }

  /**
   * Toggles bookmark state atomically using transaction
   */
  public async toggleBookmark(postId: string, userId: string): Promise<{ bookmarked: boolean; bookmarksCount: number }> {
    return await withTransaction(async (client) => {
      const checkRes = await client.query(
        'SELECT 1 FROM community_bookmarks WHERE post_id = $1 AND user_id = $2',
        [postId, userId]
      );

      let bookmarked = false;
      if (checkRes.rowCount && checkRes.rowCount > 0) {
        await client.query('DELETE FROM community_bookmarks WHERE post_id = $1 AND user_id = $2', [postId, userId]);
        await client.query('UPDATE community_posts SET bookmarks_count = GREATEST(0, bookmarks_count - 1) WHERE id = $1', [postId]);
        bookmarked = false;
      } else {
        await client.query(
          'INSERT INTO community_bookmarks (post_id, user_id, created_at) VALUES ($1, $2, CURRENT_TIMESTAMP) ON CONFLICT DO NOTHING',
          [postId, userId]
        );
        await client.query('UPDATE community_posts SET bookmarks_count = bookmarks_count + 1 WHERE id = $1', [postId]);
        bookmarked = true;
      }

      const countRes = await client.query<{ bookmarks_count: number }>(
        'SELECT bookmarks_count FROM community_posts WHERE id = $1',
        [postId]
      );

      return {
        bookmarked,
        bookmarksCount: countRes.rows[0]?.bookmarks_count ?? 0,
      };
    });
  }

  /**
   * Adds a comment to a post atomically and increments comments_count
   */
  public async addComment(
    postId: string,
    authorId: string,
    content: string,
    parentCommentId?: string
  ): Promise<CommunityComment> {
    const trimmed = content.trim();
    if (!trimmed) {
      throw new Error('COMMENT_EMPTY: محتوى التعليق لا يمكن أن يكون فارغاً');
    }

    return await withTransaction(async (client) => {
      const commentId = `comment_${Date.now()}_${crypto.randomBytes(4).toString('hex')}`;

      const res = await client.query<CommunityComment>(
        `INSERT INTO community_comments (
          id, post_id, author_id, content, status, parent_comment_id, created_at, updated_at
        ) VALUES ($1, $2, $3, $4, 'published', $5, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
        RETURNING *`,
        [commentId, postId, authorId, trimmed, parentCommentId || null]
      );

      await client.query('UPDATE community_posts SET comments_count = comments_count + 1 WHERE id = $1', [postId]);

      return res.rows[0];
    });
  }

  /**
   * Lists comments for a post
   */
  public async listComments(postId: string): Promise<CommunityComment[]> {
    const sql = `
      SELECT 
        c.*,
        up.full_name AS author_name
      FROM community_comments c
      LEFT JOIN users u ON c.author_id = u.id
      LEFT JOIN user_profiles up ON u.id = up.user_id
      WHERE c.post_id = $1 AND c.status = 'published'
      ORDER BY c.created_at ASC
    `;

    const res = await query<CommunityComment>(sql, [postId]);
    return res.rows;
  }
}

export const communityRepo = new CommunityRepository();
