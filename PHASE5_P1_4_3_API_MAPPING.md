# NEXORA — Phase 5 / P1.4.3: API Endpoint Mapping & Contract Matrix

## 1. Community REST Endpoints Utilized in P1.4.3

| Action | HTTP Method | Endpoint | Auth Required | Request Payload / Params | Server Response (Success) | UI Consumer Component |
|---|---|---|---|---|---|---|
| **List Posts** | `GET` | `/api/v1/community/posts` | Optional (Public) | `page`, `limit`, `subject`, `search` | `{ success: true, data: BackendCommunityPostDTO[], pagination: ApiPaginationMeta }` | `CommunitySection` via `useCommunity` |
| **Get Post** | `GET` | `/api/v1/community/posts/:id` | Optional (Public) | None | `{ success: true, post: BackendCommunityPostDTO }` | `PostDetailModal` / `useCommunity` |
| **Create Post** | `POST` | `/api/v1/community/posts` | **Required** (Cookie + CSRF / Bearer) | `{ title, subject, grade_level, summary, content, tags, status }` | `{ success: true, message: string, post: BackendCommunityPostDTO }` (201 Created) | `ContributeModal` |
| **Delete / Archive Post** | `DELETE` | `/api/v1/community/posts/:id` | **Required** (Owner or Admin) | None | `{ success: true, message: string }` | `PostDetailModal` |
| **List Comments** | `GET` | `/api/v1/community/posts/:id/comments` | Optional (Public) | None | `{ success: true, totalComments: number, comments: BackendCommentDTO[] }` | `PostDetailModal` |
| **Add Comment** | `POST` | `/api/v1/community/posts/:id/comments` | **Required** (Cookie + CSRF / Bearer) | `{ content: string, parent_comment_id?: string }` | `{ success: true, message: string, comment: BackendCommentDTO }` (201 Created) | `PostDetailModal` |
| **Like Post** | `POST` | `/api/v1/community/posts/:id/likes` | **Required** (Cookie + CSRF / Bearer) | `{}` | `{ success: true, liked: true, likesCount: number }` | `CommunitySection`, `PostDetailModal` |
| **Unlike Post** | `DELETE` | `/api/v1/community/posts/:id/likes` | **Required** (Cookie + CSRF / Bearer) | None | `{ success: true, liked: false, likesCount: number }` | `CommunitySection`, `PostDetailModal` |
| **Bookmark Post** | `POST` | `/api/v1/community/posts/:id/bookmarks` | **Required** (Cookie + CSRF / Bearer) | `{}` | `{ success: true, bookmarked: true, bookmarksCount: number }` | `CommunitySection`, `PostDetailModal` |
| **Remove Bookmark** | `DELETE` | `/api/v1/community/posts/:id/bookmarks` | **Required** (Cookie + CSRF / Bearer) | None | `{ success: true, bookmarked: false, bookmarksCount: number }` | `CommunitySection`, `PostDetailModal` |

---

## 2. DTO to View Model Transformation Map

```
BackendCommunityPostDTO              Adapted CommunityPost
-----------------------              ---------------------
id                                -> id
title                             -> title
summary (or content[0..150])      -> summary
content                           -> content
author_name                       -> author.name
author_role                       -> author.role
(non-fabricated fallback)         -> author.school ('مدرسة معتمدة')
(non-fabricated fallback)         -> author.district ('المملكة العربية السعودية')
subject                           -> subject
grade_level                       -> grade
created_at (formatted Arabic)     -> publishedDate
likes_count                       -> likes
bookmarks_count                   -> saves
is_liked                          -> isLiked
is_saved                          -> isSaved
author_id                         -> authorId
comments_count                    -> commentsCount
```

---

## 3. Error Code Handling in UI

- **401 UNAUTHORIZED:** Prompts clear Toast: `"يرجى تسجيل الدخول أولاً للقيام بهذا الإجراء"`. Retains user form input.
- **403 FORBIDDEN:** Displays role restriction message: `"حسابك الحالي لا يمتلك الصلاحية لنشر/تعديل هذا المنشور"`.
- **404 NOT_FOUND:** Displays `"المنشور المطلوب غير موجود أو تم حذفه"`.
- **422 VALIDATION_FAILED:** Formats backend validation messages (e.g. `"العنوان والتفاصيل مطلوبة"`) in user Toast.
- **429 RATE_LIMITED:** Informs user: `"تم تجاوز الحد المسموح به للطلبات، يرجى الانتظار قليلاً"`.
