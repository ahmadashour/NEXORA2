# NEXORA — PHASE 5 / P1.2: Repository Layer Implementation Results
## تقرير نتائج وتوثيق طبقة المستودعات البرمجية (Repository Pattern)

**تاريخ الإعداد**: 31 أكتوبر 2026  
**المرحلة**: PHASE 5 / P1.2  
**الملفات المحدثة والمنشأة**:
- `server/db/types.ts` (الأنواع والواجهات)
- `server/db/repositories/communityRepository.ts`
- `server/db/repositories/libraryRepository.ts`
- `server/db/repositories/contentRepository.ts`
- `server/db/repositories/supportRepository.ts`
- `server/db/postgresRepository.ts` (التجميع والتصدير)
- `server/db/index.ts` (التكامل والوسيط)

---

## 1. ملخص بنية طبقة المستودعات

تم بناء طبقة مستودعات كاملة تستند إلى نمط **Repository Pattern** وتفصل بشكل قطعي بين استعلامات SQL وأي طبقة عرض أو تحكم:

```
                          [ Client / React View Layer ]
                                      │
                                      ▼
                        [ Express API Routes (P1.3) ]
                                      │
                                      ▼
                   [ DatabaseStore Wrapper (server/db) ]
                                      │
           ┌──────────────────────────┴──────────────────────────┐
           ▼                                                     ▼
 [ PostgresRepository ]                                [ InMemory Store ]
  ├── communityRepo                                     (Offline Fallback)
  ├── libraryRepo
  ├── contentRepo
  └── supportRepo
```

---

## 2. تفاصيل المستودعات الأربعة المعتمدة

### 1. مستودع المجتمع والمبادرات (`CommunityRepository`)
- **المسار**: `server/db/repositories/communityRepository.ts`
- **الوظائف المنفذة**:
  - `listPosts(filters, currentUserId)`: استرجاع المنشورات مع ترقيم الصفحات (`Pagination`) والتصفية بالمادة والصف وحالة النشر، وعلامات `is_liked_by_me` و `is_bookmarked_by_me`.
  - `getPostById(id, currentUserId)`: جلب المنشور وتفاصيل المؤلف وزيادة عداد المشاهدات ذرياً.
  - `createPost(post, attachments)`: إنشاء المنشور ومرفقاته داخل معاملة `withTransaction` واحدة.
  - `updatePost(id, authorId, updates)`: تعديل المنشور مع التحقق الإلزامي من ملكية المؤلف (`WHERE id = $1 AND author_id = $2`).
  - `softDeletePost(id, authorId, isAdmin)`: الحذف الناعم بتحويل الحالة إلى `archived`.
  - `toggleLike(postId, userId)`: إضافة أو إزالة الإعجاب وتحديث عداد `likes_count` ذرياً.
  - `toggleBookmark(postId, userId)`: إضافة أو إزالة الحفظ وتحديث عداد `bookmarks_count`.
  - `addComment(postId, authorId, content, parentCommentId)`: إضافة تعليق وزيادة عداد التعليقات ذرياً.
  - `listComments(postId)`: استرجاع التعليقات مرتبة زمنياً تصاعدياً مع أسماء المعلقين.

### 2. مستودع المكتبة الرقمية (`LibraryRepository`)
- **المسار**: `server/db/repositories/libraryRepository.ts`
- **الوظائف المنفذة**:
  - `listResources(filters)`: تصفية الموارد حسب التصنيف (`books`, `guides`, إلخ) والمادة والصف والبحث النصي مع ترقيم الصفحات.
  - `getResourceById(id)`: جلب المورد وزيادة عداد المشاهدات.
  - `createResource(resource)`: إضافة مورد مع بيانات الملف وحجمه دون تخزين بايتات ثنائية في القاعدة.
  - `updateResource(id, updates)`: تعديل بيانات المورد.
  - `softDeleteResource(id)`: أرشفة المورد.
  - `incrementDownloads(id)`: زيادة عداد التنزيلات ذرياً وإرجاع الرقم المحدث.

### 3. مستودع المحتوى والفعاليات (`ContentRepository`)
- **المسار**: `server/db/repositories/contentRepository.ts`
- **الوظائف المنفذة**:
  - `listContent(filters, currentUserId)`: عرض المقالات والفيديوهات والفعاليات مع تفاصيل المقاعد المحجوزة.
  - `getContentById(id, currentUserId)`: عرض تفاصيل المحتوى والتحقق مما إذا كان المستخدم مسجلاً بالفعالية.
  - `createContentWithEvent(content, eventDetail)`: إنشاء المحتوى وربطه بتفاصيل الفعالية ذرياً في معاملة واحدة.
  - `registerForEvent(eventId, userId, notes)`:
    - قفل سجل الفعالية باستخدام `FOR UPDATE` لمنع سباق التزامن (Race Conditions).
    - التحقق من عدم اكتمال السعة (`seats_booked < seats_capacity`).
    - التحقق من عدم التسجيل المسبق للمستخدم لمنع التكرار.
    - إنشاء سجل التسجيل وتحديث عداد المقاعد المحجوزة ذرياً.
    - ضمان عدم اعتبار التسجيل ناجحاً إلا بعد اكتمال `COMMIT`.
  - `cancelEventRegistration(eventId, userId)`: إلغاء التسجيل وتخفيض عداد المقاعد المحجوزة.

### 4. مستودع الدعم والاستفسارات (`SupportRepository`)
- **المسار**: `server/db/repositories/supportRepository.ts`
- **الوظائف المنفذة**:
  - `createInquiry(inquiry)`: استقبال وحفظ استفسار الزائر أو المعلم بحالة أولية `received`.
  - `listInquiries(filters)`: تصفية الاستفسارات وعرضها للقيادات التعليمية والمشرفين (LEAD, PRO).
  - `getInquiryById(id)`: عرض تفاصيل الاستفسار.
  - `updateInquiryStatus(id, status, adminNotes, assignedTo)`: تحديث حالة الاستفسار (`received` -> `in_progress` -> `resolved` -> `closed`).

---

## 3. التحقق والتوافقية

- تم إدراج الأنواع والواجهات في `server/db/types.ts`.
- تم دمج المستودعات وتصديرها بصورة موحدة عبر `server/db/index.ts` و `server/db/postgresRepository.ts`.
- اجتازت جميع المستودعات الفحص النمطي الصارم (`tsc --noEmit`) دون أي أخطاء.
