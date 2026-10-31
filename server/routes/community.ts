import { Router, Response } from 'express';
import { db, DatabaseUnavailableError } from '../db';
import { authMiddleware, optionalAuth, AuthRequest } from '../middleware/auth';
import { apiWriteLimiter } from '../middleware/rateLimiter';
import {
  validateIdParam,
  validateCreatePost,
  validateUpdatePost,
  validateCreateComment,
} from '../middleware/validator';

const router = Router();

function handleDbError(err: unknown, res: Response, defaultMsg = 'حدث خطأ في الخادم') {
  if (
    err instanceof DatabaseUnavailableError ||
    (typeof err === 'object' && err !== null && 'statusCode' in err && (err as { statusCode: number }).statusCode === 503)
  ) {
    res.status(503).json({
      success: false,
      error: 'DATABASE_UNAVAILABLE',
      message: 'قاعدة بيانات PostgreSQL الدائمة غير متوفرة أو غير متصلة في بيئة الإنتاج',
    });
    return;
  }
  const status = typeof err === 'object' && err !== null && 'statusCode' in err && typeof (err as any).statusCode === 'number'
    ? (err as any).statusCode
    : 500;
  const message = err instanceof Error ? err.message : defaultMsg;
  res.status(status).json({ success: false, error: 'SERVER_ERROR', message });
}

/**
 * GET /api/v1/community/bookmarks
 * Returns paginated posts bookmarked by the authenticated user
 * (Defined before /:id routes to prevent parameter conflict)
 */
router.get('/bookmarks', authMiddleware, async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));

    const result = await db.community.listBookmarks(req.user!.id, { page, limit });
    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (err: unknown) {
    handleDbError(err, res, 'تعذر استرجاع المنشورات المحفوظة');
  }
});

/**
 * GET /api/v1/community/posts
 * Lists community posts with filtering, search, and pagination.
 * Guests and standard users can only view published posts; drafts require author or admin permissions.
 */
router.get('/posts', optionalAuth, async (req: AuthRequest, res: Response) => {
  try {
    const page = Math.max(1, parseInt(req.query.page as string, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit as string, 10) || 10));
    const subject = req.query.subject as string | undefined;
    const grade_level = req.query.grade_level as string | undefined;
    const author_id = req.query.author_id as string | undefined;
    const tag = req.query.tag as string | undefined;
    const search = req.query.search as string | undefined;
    const requestedStatus = req.query.status as any;

    const isAdmin = req.user && ['LEAD', 'PRO'].includes(req.user.role_code.toUpperCase());
    const isSelfAuthor = req.user && author_id && req.user.id === author_id;

    // Strict status separation: guests/non-authors cannot view drafts/hidden posts
    let status: any = 'published';
    if (requestedStatus && (isAdmin || isSelfAuthor)) {
      status = requestedStatus;
    }

    const currentUserId = req.user ? req.user.id : undefined;

    const result = await db.community.listPosts(
      { page, limit, subject, grade_level, author_id, tag, search, status },
      currentUserId
    );

    res.status(200).json({
      success: true,
      data: result.data,
      pagination: result.pagination,
    });
  } catch (err: unknown) {
    handleDbError(err, res, 'تعذر استرجاع منشورات المجتمع التعليمي');
  }
});

/**
 * GET /api/v1/community/posts/:id
 * Retrieves a single post with author information and interaction flags
 */
router.get('/posts/:id', optionalAuth, validateIdParam('id'), async (req: AuthRequest, res: Response) => {
  try {
    const currentUserId = req.user ? req.user.id : undefined;
    const post = await db.community.getPostById(req.params.id, currentUserId);

    if (!post) {
      res.status(404).json({
        success: false,
        error: 'POST_NOT_FOUND',
        message: 'المنشور المطلوب غير موجود أو تم حذفه',
      });
      return;
    }

    // Access control for non-published posts
    if (post.status !== 'published') {
      const isAuthor = req.user && req.user.id === post.author_id;
      const isAdmin = req.user && ['LEAD', 'PRO'].includes(req.user.role_code.toUpperCase());
      if (!isAuthor && !isAdmin) {
        res.status(404).json({
          success: false,
          error: 'POST_NOT_FOUND',
          message: 'المنشور المطلوب غير متاح للعرض العام',
        });
        return;
      }
    }

    res.status(200).json({
      success: true,
      post,
    });
  } catch (err: unknown) {
    handleDbError(err, res, 'تعذر استرجاع تفاصيل المنشور');
  }
});

/**
 * POST /api/v1/community/posts
 * Creates a new community post. Requires authentication and posting permissions.
 */
router.post('/posts', authMiddleware, apiWriteLimiter, validateCreatePost, async (req: AuthRequest, res: Response) => {
  try {
    const permissions = await db.getRolePermissions(req.user!.role_id);
    const hasPostPerm = permissions.some((p) => p.code === 'community:post');
    const isPrivilegedRole = ['TEACH', 'PRO', 'LEAD', 'START'].includes(req.user!.role_code.toUpperCase());

    if (!hasPostPerm && !isPrivilegedRole) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN_POST_CREATION',
        message: 'ليس لديك الصلاحية لنشر مشاركات في مجتمع المعلمين',
      });
      return;
    }

    const { title, subject, grade_level, summary, content, tags, status, attachments } = req.body;

    const newPost = await db.community.createPost(
      {
        id: '',
        author_id: req.user!.id,
        title,
        subject,
        grade_level,
        summary,
        content: content || null,
        status: status || 'published',
        is_pinned: false,
        tags: tags || [],
      },
      attachments
    );

    await db.logActivity({
      user_id: req.user!.id,
      action: 'create_community_post',
      entity_type: 'community_post',
      entity_id: newPost.id,
      details: { title: newPost.title, subject: newPost.subject },
      ip_address: req.ip || null,
      user_agent: req.headers['user-agent'] || null,
    });

    res.status(201).json({
      success: true,
      message: 'تم نشر المشاركة بنجاح في مجتمع المعلمين',
      post: newPost,
    });
  } catch (err: unknown) {
    handleDbError(err, res, 'فشل إنشاء المنشور');
  }
});

/**
 * PATCH /api/v1/community/posts/:id
 * Updates an existing community post with strict ownership verification (IDOR protection)
 */
router.patch('/posts/:id', authMiddleware, apiWriteLimiter, validateIdParam('id'), validateUpdatePost, async (req: AuthRequest, res: Response) => {
  try {
    const existing = await db.community.getPostById(req.params.id);
    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'POST_NOT_FOUND',
        message: 'المنشور المطلوب تعديله غير موجود',
      });
      return;
    }

    const isAuthor = existing.author_id === req.user!.id;
    const isAdmin = ['LEAD', 'PRO'].includes(req.user!.role_code.toUpperCase());

    if (!isAuthor && !isAdmin) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN_POST_UPDATE',
        message: 'ليس لديك صلاحية تعديل هذا المنشور. يمكنك فقط تعديل المنشورات التي أنشأتها.',
      });
      return;
    }

    // Mass assignment defense: whitelist allowed update keys
    const safeUpdates: any = {};
    if (req.body.title !== undefined) safeUpdates.title = req.body.title;
    if (req.body.subject !== undefined) safeUpdates.subject = req.body.subject;
    if (req.body.grade_level !== undefined) safeUpdates.grade_level = req.body.grade_level;
    if (req.body.summary !== undefined) safeUpdates.summary = req.body.summary;
    if (req.body.content !== undefined) safeUpdates.content = req.body.content;
    if (req.body.status !== undefined) safeUpdates.status = req.body.status;
    if (req.body.tags !== undefined) safeUpdates.tags = req.body.tags;

    const updated = await db.community.updatePost(req.params.id, existing.author_id, safeUpdates);

    await db.logActivity({
      user_id: req.user!.id,
      action: 'update_community_post',
      entity_type: 'community_post',
      entity_id: req.params.id,
      details: { updatedFields: Object.keys(safeUpdates) },
      ip_address: req.ip || null,
      user_agent: req.headers['user-agent'] || null,
    });

    res.status(200).json({
      success: true,
      message: 'تم تحديث المنشور بنجاح',
      post: updated,
    });
  } catch (err: unknown) {
    handleDbError(err, res, 'فشل تحديث المنشور');
  }
});

/**
 * DELETE /api/v1/community/posts/:id
 * Soft deletes a community post (sets status to 'archived')
 */
router.delete('/posts/:id', authMiddleware, validateIdParam('id'), async (req: AuthRequest, res: Response) => {
  try {
    const existing = await db.community.getPostById(req.params.id);
    if (!existing) {
      res.status(404).json({
        success: false,
        error: 'POST_NOT_FOUND',
        message: 'المنشور المطلوب غير موجود',
      });
      return;
    }

    const isAuthor = existing.author_id === req.user!.id;
    const isAdmin = ['LEAD', 'PRO'].includes(req.user!.role_code.toUpperCase());

    if (!isAuthor && !isAdmin) {
      res.status(403).json({
        success: false,
        error: 'FORBIDDEN_POST_DELETE',
        message: 'ليس لديك صلاحية حذف هذا المنشور',
      });
      return;
    }

    const success = await db.community.softDeletePost(req.params.id, existing.author_id, isAdmin);
    if (!success) {
      res.status(400).json({
        success: false,
        error: 'DELETE_FAILED',
        message: 'تعذر أرشفة المنشور',
      });
      return;
    }

    await db.logActivity({
      user_id: req.user!.id,
      action: 'delete_community_post',
      entity_type: 'community_post',
      entity_id: req.params.id,
      details: { softDelete: true },
      ip_address: req.ip || null,
      user_agent: req.headers['user-agent'] || null,
    });

    res.status(200).json({
      success: true,
      message: 'تم أرشفة المنشور بنجاح',
    });
  } catch (err: unknown) {
    handleDbError(err, res, 'فشل حذف المنشور');
  }
});

/**
 * GET /api/v1/community/posts/:id/comments
 * Lists published comments for a post
 */
router.get('/posts/:id/comments', optionalAuth, validateIdParam('id'), async (req: AuthRequest, res: Response) => {
  try {
    const post = await db.community.getPostById(req.params.id);
    if (!post) {
      res.status(404).json({
        success: false,
        error: 'POST_NOT_FOUND',
        message: 'المنشور غير موجود',
      });
      return;
    }

    const comments = await db.community.listComments(req.params.id);
    res.status(200).json({
      success: true,
      totalComments: comments.length,
      comments,
    });
  } catch (err: unknown) {
    handleDbError(err, res, 'تعذر استرجاع تعليقات المنشور');
  }
});

/**
 * POST /api/v1/community/posts/:id/comments
 * Adds a comment to a community post
 */
router.post('/posts/:id/comments', authMiddleware, apiWriteLimiter, validateIdParam('id'), validateCreateComment, async (req: AuthRequest, res: Response) => {
  try {
    const post = await db.community.getPostById(req.params.id);
    if (!post || post.status === 'archived') {
      res.status(404).json({
        success: false,
        error: 'POST_NOT_FOUND',
        message: 'المنشور غير موجود أو مغلق للتعليقات',
      });
      return;
    }

    const comment = await db.community.addComment(
      req.params.id,
      req.user!.id,
      req.body.content,
      req.body.parent_comment_id
    );

    res.status(201).json({
      success: true,
      message: 'تمت إضافة التعليق بنجاح',
      comment,
    });
  } catch (err: unknown) {
    handleDbError(err, res, 'فشل إضافة التعليق');
  }
});

/**
 * POST /api/v1/community/posts/:id/likes
 * Likes a community post idempotently
 */
router.post('/posts/:id/likes', authMiddleware, validateIdParam('id'), async (req: AuthRequest, res: Response) => {
  try {
    const post = await db.community.getPostById(req.params.id);
    if (!post) {
      res.status(404).json({
        success: false,
        error: 'POST_NOT_FOUND',
        message: 'المنشور غير موجود',
      });
      return;
    }

    const result = await db.community.addLike(req.params.id, req.user!.id);
    res.status(200).json({
      success: true,
      liked: result.liked,
      likesCount: result.likesCount,
    });
  } catch (err: unknown) {
    handleDbError(err, res, 'فشل تسجيل الإعجاب');
  }
});

/**
 * DELETE /api/v1/community/posts/:id/likes
 * Unlikes a community post idempotently
 */
router.delete('/posts/:id/likes', authMiddleware, validateIdParam('id'), async (req: AuthRequest, res: Response) => {
  try {
    const post = await db.community.getPostById(req.params.id);
    if (!post) {
      res.status(404).json({
        success: false,
        error: 'POST_NOT_FOUND',
        message: 'المنشور غير موجود',
      });
      return;
    }

    const result = await db.community.removeLike(req.params.id, req.user!.id);
    res.status(200).json({
      success: true,
      liked: result.liked,
      likesCount: result.likesCount,
    });
  } catch (err: unknown) {
    handleDbError(err, res, 'فشل إلغاء الإعجاب');
  }
});

/**
 * POST /api/v1/community/posts/:id/bookmarks
 * Bookmarks a community post idempotently
 */
router.post('/posts/:id/bookmarks', authMiddleware, validateIdParam('id'), async (req: AuthRequest, res: Response) => {
  try {
    const post = await db.community.getPostById(req.params.id);
    if (!post) {
      res.status(404).json({
        success: false,
        error: 'POST_NOT_FOUND',
        message: 'المنشور غير موجود',
      });
      return;
    }

    const result = await db.community.addBookmark(req.params.id, req.user!.id);
    res.status(200).json({
      success: true,
      bookmarked: result.bookmarked,
      bookmarksCount: result.bookmarksCount,
    });
  } catch (err: unknown) {
    handleDbError(err, res, 'فشل حفظ المنشور في المفضلة');
  }
});

/**
 * DELETE /api/v1/community/posts/:id/bookmarks
 * Removes bookmark for a community post idempotently
 */
router.delete('/posts/:id/bookmarks', authMiddleware, validateIdParam('id'), async (req: AuthRequest, res: Response) => {
  try {
    const post = await db.community.getPostById(req.params.id);
    if (!post) {
      res.status(404).json({
        success: false,
        error: 'POST_NOT_FOUND',
        message: 'المنشور غير موجود',
      });
      return;
    }

    const result = await db.community.removeBookmark(req.params.id, req.user!.id);
    res.status(200).json({
      success: true,
      bookmarked: result.bookmarked,
      bookmarksCount: result.bookmarksCount,
    });
  } catch (err: unknown) {
    handleDbError(err, res, 'فشل إزالة المنشور من المفضلة');
  }
});

export default router;
