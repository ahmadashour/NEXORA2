# NEXORA — PHASE 5 / P1.1: Mock Data Inventory & Backend Integration Blueprint
## وثيقة حصر البيانات الوهمية والمخطط الهندسي لربط قاعدة البيانات العلائقية (READ-ONLY)

**تاريخ الإعداد**: 31 أكتوبر 2026  
**طبيعة المرحلة**: تخطيط وتدقيق هندسي استطلاعي للقراءة فقط (READ-ONLY — NO CODE CHANGES)  
**الفرع المستهدف**: `production-remediation` (المحدد في وثائق المشروع)  
**حالة Git**: بيئة عمل الحاوية الحالية تم استيرادها كشجرة ملفات مسطحة بدون مجلد البيانات الوصفية `.git` (`fatal: not a git repository`). تم إجراء الفحص والحصر مباشرة على الملفات المصدرية الفعلية في مسار `/app/applet`.  
**قرار بوابة الاعتماد (Stop Gate Decision)**: **READY FOR P1.2**

---

## 1. الملخص التنفيذي (Executive Summary)

تم بنجاح استكمال المرحلة **PHASE 5 / P0** واعتماد بوابة التوقف بعد التحقق الأمني المستقل من حماية مسار التشخيصات، إلغاء ثغرات CSRF، تفعيل ملفات تعريف الارتباط الآمنة (HttpOnly/Secure/SameSite)، رفع التشفير إلى Bcrypt 12، وضبط سياسات CORS و CSP.

تهدف المرحلة الحالية **P1.1** إلى إجراء مسح استقصائي شامل وشديد الدقة لكافة مصادر البيانات التجريبية (Mock Data) والبيانات الثابتة (Hardcoded Data) الموزعة في طبقات الواجهة الأمامية والخلفية لمنظومة **NEXORA**، ووضع المخطط المعماري الهندسي (Blueprint) المتكامل لتحويل المنصة إلى العمل بنظام بيانات حقيقي مترابط ومستدام يستند إلى **PostgreSQL** كالمصدر الوحيد للحقيقة (Single Source of Truth).

### النتائج الرئيسية للمسح:
1. **قاعدة البيانات الحالية**: تحتوي حالياً على **7 جداول فقط** تمثل النواة الأساسية للأمن والمصادقة (`roles`, `permissions`, `role_permissions`, `users`, `user_profiles`, `activity_logs`, `revoked_tokens`).
2. **انفصال كامل للأقسام الوظيفية**: لا توجد أي جداول أو مسارات API فعلية تخدم وظائف:
   - **مجتمع المعلمين (Community)**: المنشورات، التعليقات، الإعجابات، الحفظ، والمرفقات.
   - **المكتبة الرقمية (Library)**: الكتب، الأدلة، المذكرات، التصنيفات، والتحميل.
   - **المحتوى المتجدد (Latest Content)**: المقالات، الفيديوهات، الفعاليات، والتسجيل في الأنشطة.
   - **أكاديمية التطوير المهني (Academy)**: المسارات التدريبية، المقاعد، والالتحاق.
   - **التواصل والدعم (Support & Contact)**: رسائل واستفسارات المستخدمين والزوار.
   - **المختبر الافتراضي (NEXORA LAB)**: سجلات التجارب العملية وتقارير الطلاب المخبرية.
3. **تطبيق صارم للضوابط**: لم يتم إجراء أي تعديل برمجي أو تشغيل migrations أو تغيير واجهات في هذه المرحلة، والعمل مقتصر على تقديم هذا المخطط المرجعي الموثق.

---

## 2. الحصر الشامل لمصادر البيانات التجريبية (Complete Mock Inventory)

يوضح الجدول التالي الحصر الدقيق والشامل لجميع البيانات الثابتة والوهمية في واجهات المنصة:

| الرقم | اسم القسم الوظيفي | الملف والمكون المصدر | مصدر البيانات الحالي | السطور البرمجية | الوظائف المتاحة حالياً بالواجهة | هل توجد API فعلية؟ | هل توجد جداول PG؟ | ما الذي يعمل تجريبياً فقط؟ | متطلبات التحويل لنظام حقيقي |
| :---: | :--- | :--- | :--- | :---: | :--- | :---: | :---: | :--- | :--- |
| **01** | **مجتمع المعلمين** (Community Posts) | `src/components/CommunitySection.tsx` | `COMMUNITY_POSTS` في `src/data/mockData.ts` | L.369–462 في mockData، L.3 في المكون | عرض 4 بطاقات مبادرات، تفاعل الإعجاب والحفظ محلياً | ❌ لا توجد | ❌ لا توجد | تكرار الإعجاب والحفظ يحفظ في React State محلياً فقط ويفقد عند تحديث الصفحة | جدول `community_posts` وجداول التفاعل `community_likes`, `community_bookmarks` وواجهات CRUD كاملة |
| **02** | **نافذة إضافة مبادرة** (Contribute Modal) | `src/components/modals/ContributeModal.tsx` | نموذج إدخال محلي + محاكاة `setTimeout` | L.25–37 في المكون | نموذج تفاعلي لإدخال العنوان، المادة، الصف، الملخص، ورفع وهمي للملفات | ❌ لا توجد | ❌ لا توجد | محاكاة مؤقت زمني 600ms ثم إظهار إشعار نجاح وهمي وإغلاق النافذة دون إرسال أي بايت للخادم | مسار `POST /api/v1/community/posts`، نظام تخزين آمن للملفات، وجدول المرفقات |
| **03** | **تفاصيل المنشور والتعليقات** (Post Details) | `src/components/modals/PostDetailModal.tsx` | مصفوفة تعليقات محلية في React State | L.18–28 في المكون | عرض محتوى المبادرة، إضافة تعليق فوري، تفاعل الإعجاب والمشاركة | ❌ لا توجد | ❌ لا توجد | التعليقات تضاف إلى مصفوفة بالذاكرة وتختفي بمجرد إغلاق النافذة | جدول `community_comments` ومسار `GET/POST /api/v1/community/posts/:id/comments` |
| **04** | **المحتوى المتجدد** (Latest Content Grid) | `src/components/LatestContentSection.tsx` | `LATEST_CONTENT` في `src/data/mockData.ts` | L.177–367 في mockData، L.3 في المكون | تصنيف وتبويب (مصادر، فيديوهات، أخبار، فعاليات)، واقتطاع 4 بطاقات | ❌ لا توجد | ❌ لا توجد | التصفية تتم عبر `Array.filter` محلياً داخل المتصفح بدون Pagination أو فهارس | جدول `content_items` وجدول `event_details` ومسار `GET /api/v1/content` مع Pagination |
| **05** | **تفاصيل المحتوى والفعاليات** (Content Detail) | `src/components/modals/ContentDetailModal.tsx` | تمرير الكائن من بطاقة `LATEST_CONTENT` | L.13–26 في المكون | مشغل فيديو محاكى، تفاصيل الفعالية، زر التسجيل في الفعالية، زر التحميل | ❌ لا توجد | ❌ لا توجد | زر التسجيل في الفعالية وزر التحميل يغيران حالة React `registered: true` دون حجز مقعد حقيقي | جدول `event_registrations` ومسارات حجز الفعاليات وإدارة سعة المقاعد |
| **06** | **المكتبة الرقمية والمستودع** (Library Modal) | `src/components/modals/LibraryModal.tsx` | مصفوفة ثابتة `libraryItems` داخل المكون | L.16–71 في المكون | قائمة بـ 6 كتب وأدلة، فلترة حسب المادة والصف، بحث محلي، زر تحميل | ❌ لا توجد | ❌ لا توجد | زر التحميل يُظهر رسالة توست تفيد بأن "الملف قيد الربط بالسحاب" دون تنزيل بايت واحد | جدول `library_resources`، مسار `GET /api/v1/library` ومسار التحميل الآمن `GET /:id/download` |
| **07** | **أكاديمية المعلمين** (Academy Modal) | `src/components/modals/AcademyModal.tsx` | مصفوفة ثابتة `courses` داخل المكون | L.14–55 في المكون | استعراض 4 دورات تدريبية تخصصية، زر طلب التحاق بالدورة | ❌ لا توجد | ❌ لا توجد | زر التسجيل بالدورة يعرض توست محلي ويخزن العنوان في `enrolledCourse` ثم يمسحه | جدول `academy_courses` وجدول `course_enrollments` ومسارات التسجيل والشهادات |
| **08** | **الدعم والتواصل** (Contact Modal) | `src/components/modals/ContactModal.tsx` | نموذج React Form محلي | L.18–25 في المكون | نموذج إدخال الاسم، البريد، الموضوع، نص الرسالة، وزر إرسال | ❌ لا توجد | ❌ لا توجد | الضغط على "إرسال" يُظهر رسالة نجاح وهمية دون تسجيل الرسالة أو إرسال بريد إلكتروني | جدول `contact_inquiries` ومسار `POST /api/v1/support/contact` مع إشعار إداري |
| **09** | **البحث العام للمنظومة** (Search Modal) | `src/components/modals/SearchModal.tsx` | مطابقة نصية على كائنات `mockData.ts` بالمتصفح | L.41–62 في المكون | بحث متزامن في البوابات والمحتوى والمنشورات | ❌ لا توجد | ❌ لا توجد | البحث يعمل فقط على البيانات الثابتة في الذاكرة ولا يبحث في قاعدة البيانات | مسار `GET /api/v1/search?q=...` يستخدم PostgreSQL Full-Text Search (`tsvector`) |
| **10** | **إحصائيات البوابات الست** (Portals Stats & KPIs) | `src/components/PortalsSection.tsx` & `PortalModal.tsx` | مصفوفة `stats` ثابتة في `PORTALS_DATA` | L.19–23, 41–45, إلخ في mockData | عرض أرقام وهمية مثل "420+ مدرسة"، "1,850 تقرير"، "94.2% مؤشر" | ❌ لا توجد | ❌ لا توجد | أرقام ثابتة في الشيفرة لا تتغير إطلاقاً ولا تعبر عن بيانات النظام | دوال تجميعية `COUNT/AVG` في مستودع قاعدة البيانات تحسب المؤشرات الحقيقية |
| **11** | **تجارب المختبر الافتراضي** (NEXORA LAB) | `src/components/modals/LabModal.tsx` | معادلات فيزيائية وكيميائية محاكاة في الواجهة | L.25–45 في المكون | محاكاة معايرة الحمض والقاعدة، وتحقيق قانون أوم | ❌ لا توجد | ❌ لا توجد | لا يتم حفظ نتائج التجربة أو قراءات الطالب المخبرية أو تقرير المعمل في ملفه | جدول `lab_sessions` لحفظ قراءات الطالب ودرجة إتقان التجربة وتقييم المعلم |

---

## 3. فحص البنية الخلفية الحالية (Current Backend Review)

تم فحص ومراجعة كافة مكونات الخادم الحالية في المسار `server/`:

### أ. مسارات API الحالية (Existing Routes)
1. **`/api/v1/auth`** (`server/routes/auth.ts`):
   - `POST /register`: تسجيل المستخدم وإنشاء ملفه الشخصي ذرياً داخل PostgreSQL Transaction، مع تعيين كوكيز `nexora_token` و `nexora_csrf`.
   - `POST /login`: التحقق من كلمة المرور المشفرة بـ Bcrypt (Cost 12)، تحديث آخر دخول، تسجيل النشاط، وإصدار الرموز.
   - `GET /me`: استعادة بيانات الحساب والملف الشخصي والصلاحيات للمستخدم الموثق.
   - `POST /logout`: إبطال الرمز وJTI ومسح ملفات الكوكيز.
   - `POST /change-password`: تغيير كلمة المرور وإبطال **كافة جلسات المستخدم النشطة**.
2. **`/api/v1/health`** (`server/routes/health.ts`):
   - `GET /`: فحص الصحة العام (Liveness Probe) وإرجاع حالة السيرفر وقاعدة البيانات.
   - `GET /db-diagnostics`: فحص التشخيصات المحمي بصلاحيات `requireRole(['LEAD', 'PRO'])` مع تنقية الأسرار.
3. **`/api/v1/users`** (`server/routes/users.ts`):
   - `GET /profile`: استرجاع الملف الشخصي للمستخدم الحالي.
   - `PUT /profile`: تعديل الحقول المسموح بها للملف الشخصي مع تعقيم المدخلات.
   - `PUT /:id/role`: تعديل رتبة المستخدم بصلاحيات المشرف الفني `LEAD`.
   - `GET /activity`: استرجاع سجل النشاطات الخاص بالمستخدم (20 سجلاً).
4. **`/api/v1/portals`** (`server/routes/portals.ts`):
   - `GET /`: استرجاع قائمة البوابات الست والأدوار وصلاحياتها مباشرة من PostgreSQL.
   - `GET /:code/access`: التحقق من مطابقة دور المستخدم الحالي مع البوابة المطلوبة.
5. **`/api/v1/ai`** (`server/routes/ai.ts`):
   - `POST /chat`: استدعاء المساعد الذكي للعلوم؛ محمي بصلاحية `ai:access`، ويفحص بنك الردود المنهجية الجاهزة، ثم يستدعي Gemini 2.5 Flash عبر الخادم حصراً بمهلة 10 ثوانٍ وحد 2000 حرف.

### ب. طبقة المستودع وقاعدة البيانات (Repository & Database Layer)
- **ملف الاتصال**: `server/db/postgres.ts` يدير مجمع الاتصالات `pg.Pool` ويدعم TLS الصارم ومود Supavisor Transaction (Port 6543) مع دالة المعاملات `withTransaction`.
- **المستودع العلائقي**: `server/db/postgresRepository.ts` يحتوي دوال الاستعلام الحالية الخاصة بالمستخدمين والملفات والأدوار وسجلات النشاط وإبطال الرموز.
- **البديل الآمن للتطوير**: `server/db/index.ts` يحتوي مخزناً احتياطياً محلياً `InMemoryDatabaseStore` يعمل عند غياب قاعدة البيانات لضمان عدم توقف واجهات المعاينة.

---

## 4. المخطط المعماري المقترح للمرحلة P1 (Proposed P1 Architecture)

يقسم المخطط المعماري إلى 4 وحدات تخصصية رئيسية، مع الحفاظ الكامل على الهوية البصرية، وتصميم الواجهة، وتجربة المستخدم:

```
+=========================================================================================================+
|                                  NEXORA CORE APPLICATION PIPELINE                                       |
+=========================================================================================================+
|  [ Frontend React 19 UI Components ]                                                                   |
|   ├── CommunitySection & Modals     ──> apiClient.community.*  ──> /api/v1/community/*                 |
|   ├── LibraryModal (Digital Repo)   ──> apiClient.library.*    ──> /api/v1/library/*                   |
|   ├── LatestContent & Detail Modals ──> apiClient.content.*    ──> /api/v1/content/*                   |
|   └── Support / Contact Modal       ──> apiClient.support.*    ──> /api/v1/support/*                   |
+---------------------------------------------------------------------------------------------------------+
|  [ Security & Middleware Gateways ]                                                                     |
|   ├── authMiddleware (Bearer Header + HttpOnly Cookie resolution)                                       |
|   ├── csrfProtection (Strict Double-Submit Token on Mutating Requests)                                 |
|   ├── requireRole / requirePermission (Role-Based Access Control)                                       |
|   ├── uploadMiddleware (Memory-bounded, magic-byte inspection, MIME filter)                             |
|   └── requestLimiter & auditLogger                                                                      |
+---------------------------------------------------------------------------------------------------------+
|  [ Service & Repository Layer (server/services/* & server/db/*) ]                                       |
|   ├── communityRepository.ts   <──> DDL: community_posts, comments, likes, attachments                  |
|   ├── libraryRepository.ts     <──> DDL: library_resources, categories, downloads                       |
|   ├── contentRepository.ts     <──> DDL: content_items, event_registrations                             |
|   └── supportRepository.ts     <──> DDL: contact_inquiries, inquiry_responses                           |
+---------------------------------------------------------------------------------------------------------+
|  [ Primary Persistence: PostgreSQL Relational Database (7 Existing Tables + 9 Proposed Tables) ]       |
+=========================================================================================================+
```

### أ. وحدة مجتمع المعلمين (A. Teacher Community Module)
1. **المنشورات والمبادرات (`community_posts`)**:
   - كتابة ونشر المبادرات التربوية وأوراق العمل من قِبل المعلمين والمشرفين المعتمدين (`TEACH`, `PRO`, `LEAD`, `START`).
   - دعم التصنيف حسب المادة (`subject`)، المرحلة الدراسية (`grade`)، والوسوم (`tags`).
   - دعم مسار المراجعة والاعتماد: حالة المنشور (`published`, `pending_review`, `archived`).
2. **التعليقات والإثراء (`community_comments`)**:
   - تمكين المعلمين من كتابة تعليقات مهنية وتبادل الملاحظات التطبيقية.
   - دعم الترتيب الزمني ومراجعة التعليقات من أصحاب المبادرة.
3. **التفاعل المحفوظ (`community_likes` & `community_bookmarks`)**:
   - تسجيل إعجاب فريد لكل مستخدم (`PRIMARY KEY (post_id, user_id)`).
   - حفظ المنشور في المفضلة الشخصية للمعلم لاسترجاعه في أي وقت.
4. **المرفقات والملفات (`community_attachments`)**:
   - ربط أوراق العمل والملفات المساندة (PDF, DOCX, PPTX) بالمنشور مع تسجيل الحجم ونوع المحتوى ومسار التخزين الآمن.

### ب. وحدة المكتبة الرقمية (B. Educational Library Module)
1. **الموارد والأدلة المنهجية (`library_resources`)**:
   - فهرسة أدلة المعلم، كراسات المختبر، وأطالس العلوم المعتمدة.
   - التصنيف الدقيق حسب المادة، الصف، نوع الوثيقة، وسنة المنهج الدراسي.
2. **تتبع التحميل والوصول (`library_downloads`)**:
   - تسجيل عمليات التنزيل في سجل الإحصائيات لتمكين قيادات التوجيه من معرفة الموارد الأكثر نفعاً.
   - توفير روابط تنزيل آمنة وموقوتة تمنع الاستنزاف المباشر لموارد الخادم.

### ج. وحدة المحتوى المتجدد والفعاليات (C. Latest Content & Events Module)
1. **المحتوى العلمي والإخباري (`content_items`)**:
   - إدارة الأخبار، الفيديوهات التفاعلية، الإعلانات، ومستجدات المناهج.
   - تمكين مسؤولي التوجيه `LEAD` ورؤساء الأقسام `PRO` من إضافة وتحديث المحتوى.
2. **الفعاليات والتسجيل (`event_registrations`)**:
   - ربط بطاقات الفعاليات والمؤتمرات والورش بحجز المقاعد الفعلي.
   - قيد ذري على سعة المقاعد (`seats_capacity` مقابل `seats_booked`) لمنع الحجز الزائد (Overbooking).

### د. وحدة التواصل والدعم الفني (D. Support & Inquiries Module)
1. **سجل الرسائل والاستفسارات (`contact_inquiries`)**:
   - استقبال استفسارات المستخدمين والزوار وتخزينها في قاعدة البيانات مع ربط الحساب إذا كان المستخدم مسجلاً.
   - تسجيل حالة الرد والمتابعة من الدعم الفني.

---

## 5. توصيف جداول قاعدة البيانات المقترحة (Database Schema Specification)

سيتم إنشاء ملف Migration جديد باسم `db/migrations/002_community_library_content.sql` يحتوي على الجداول التسعة التالية، متكاملة كلياً مع الجداول السبعة الأساسية:

### 1. جدول منشورات المجتمع (`community_posts`)
- **الهدف**: تخزين المبادرات العلمية والتجارب المعملية وأوراق العمل التي يشاركها المعلمون.
- **الأعمدة والمحددات**:
  - `id` VARCHAR(50) PRIMARY KEY: معرّف فريد يبدأ بـ `post_`.
  - `author_id` VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE: صاحب المبادرة.
  - `title` VARCHAR(255) NOT NULL: عنوان المبادرة.
  - `summary` TEXT NOT NULL: ملخص الفكرة والأثر التعليمي.
  - `content` TEXT NOT NULL: تفاصيل وخطوات التطبيق المعملي أو الصفي.
  - `subject` VARCHAR(50) NOT NULL: المادة (كيمياء، فيزياء، أحياء، جيولوجيا، علوم عامة، طرق تدريس).
  - `grade` VARCHAR(100) NOT NULL: المرحلة أو الصف الدراسي.
  - `status` VARCHAR(30) DEFAULT 'published' NOT NULL: الحالة (`published`, `pending_review`, `archived`).
  - `likes_count` INT DEFAULT 0 NOT NULL: عداد إجمالي الإعجابات.
  - `saves_count` INT DEFAULT 0 NOT NULL: عداد إجمالي مرات الحفظ.
  - `comments_count` INT DEFAULT 0 NOT NULL: عداد التعليقات.
  - `created_at` TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL.
  - `updated_at` TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL.
- **الفهارس**:
  - `CREATE INDEX idx_community_posts_author ON community_posts(author_id);`
  - `CREATE INDEX idx_community_posts_subject_grade ON community_posts(subject, grade);`
  - `CREATE INDEX idx_community_posts_status_created ON community_posts(status, created_at DESC);`

### 2. جدول مرفقات المجتمع (`community_attachments`)
- **الهدف**: ربط ملفات PDF وشرائح العرض المرفقة بكل مبادرة.
- **الأعمدة والمحددات**:
  - `id` VARCHAR(50) PRIMARY KEY: معرّف المرفق `att_`.
  - `post_id` VARCHAR(50) NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE.
  - `file_name` VARCHAR(255) NOT NULL: الاسم الأصلي للملف.
  - `file_path` VARCHAR(500) NOT NULL: المسار المشفر على خادم التخزين.
  - `file_size_bytes` BIGINT NOT NULL: حجم الملف بالبايت.
  - `mime_type` VARCHAR(100) NOT NULL: نوع الملف المعتمد (مثل `application/pdf`).
  - `created_at` TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL.
- **الفهارس**:
  - `CREATE INDEX idx_community_attachments_post_id ON community_attachments(post_id);`

### 3. جدول تعليقات المجتمع (`community_comments`)
- **الهدف**: تخزين تعليقات ومناقشات المعلمين على المبادرات.
- **الأعمدة والمحددات**:
  - `id` VARCHAR(50) PRIMARY KEY: معرّف التعليق `comm_`.
  - `post_id` VARCHAR(50) NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE.
  - `user_id` VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE.
  - `comment_text` TEXT NOT NULL: نص التعليق (بحد أقصى 2000 حرف).
  - `is_approved` BOOLEAN DEFAULT TRUE NOT NULL.
  - `created_at` TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL.
- **الفهارس**:
  - `CREATE INDEX idx_community_comments_post_created ON community_comments(post_id, created_at ASC);`
  - `CREATE INDEX idx_community_comments_user ON community_comments(user_id);`

### 4. جدول إعجابات المجتمع (`community_likes`)
- **الهدف**: تسجيل إعجاب المستخدم بالمنشور ومنع التكرار.
- **الأعمدة والمحددات**:
  - `post_id` VARCHAR(50) NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE.
  - `user_id` VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE.
  - `created_at` TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL.
  - `PRIMARY KEY (post_id, user_id)`: ضمان عدم تكرار الإعجاب لنفس المستخدم.

### 5. جدول محفوظات المجتمع (`community_bookmarks`)
- **الهدف**: تمكين المعلم من حفظ المبادرات في قائمته المفضلة.
- **الأعمدة والمحددات**:
  - `post_id` VARCHAR(50) NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE.
  - `user_id` VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE.
  - `created_at` TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL.
  - `PRIMARY KEY (post_id, user_id)`.

### 6. جدول موارد المكتبة العلمية (`library_resources`)
- **الهدف**: تخزين أدلة المعلم والمراجع والأطالس العلمية.
- **الأعمدة والمحددات**:
  - `id` VARCHAR(50) PRIMARY KEY: معرّف المورد `res_`.
  - `title` VARCHAR(255) NOT NULL: عنوان المرجع أو الدليل.
  - `subject` VARCHAR(50) NOT NULL: المادة التخصصية.
  - `grade` VARCHAR(100) NOT NULL: الصف أو المرحلة.
  - `resource_type` VARCHAR(100) NOT NULL: نوع المورد (دليل استرشادي، كراسة تجارب، مصفوفة كفايات).
  - `page_count` INT DEFAULT 0: عدد الصفحات.
  - `file_path` VARCHAR(500) NOT NULL: مسار التخزين.
  - `file_size_display` VARCHAR(50) NOT NULL: حجم الملف للعرض (مثل `8.4 MB`).
  - `file_size_bytes` BIGINT NOT NULL.
  - `download_count` INT DEFAULT 0 NOT NULL: عدد مرات التنزيل.
  - `uploaded_by` VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL.
  - `is_public` BOOLEAN DEFAULT TRUE NOT NULL.
  - `created_at` TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL.
- **الفهارس**:
  - `CREATE INDEX idx_library_resources_subject_grade ON library_resources(subject, grade);`
  - `CREATE INDEX idx_library_resources_type ON library_resources(resource_type);`

### 7. جدول المحتوى المتجدد والأخبار (`content_items`)
- **الهدف**: تخزين عناصر قسم المستجدات (مقالات، فيديوهات تفاعلية، أخبار، فعاليات).
- **الأعمدة والمحددات**:
  - `id` VARCHAR(50) PRIMARY KEY: معرّف المحتوى `item_`.
  - `category` VARCHAR(30) NOT NULL: التصنيف (`resource`, `video`, `news`, `event`).
  - `title` VARCHAR(255) NOT NULL: العنوان الرئيسي.
  - `description` TEXT NOT NULL: الوصف والملخص التفصيلي.
  - `subject` VARCHAR(50) NOT NULL: المادة أو المجال المعرفي.
  - `grade_level` VARCHAR(100): المرحلة أو الصف (اختياري).
  - `file_size_display` VARCHAR(50): حجم الملف إن وجد.
  - `duration_display` VARCHAR(50): مدة الفيديو إن وجد.
  - `tag` VARCHAR(100): وسم تمييزي (مثل "إعلان مسابقة", "توصية تربوية").
  - `reads_or_views` INT DEFAULT 0 NOT NULL: عداد المشاهدات والقراءات.
  - `likes_count` INT DEFAULT 0 NOT NULL: عداد الإعجابات.
  - `author_name` VARCHAR(150): اسم المؤلف أو الجهة.
  - `author_role` VARCHAR(100): صفة المؤلف.
  - `status` VARCHAR(30) DEFAULT 'published' NOT NULL.
  - `created_at` TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL.
- **الفهارس**:
  - `CREATE INDEX idx_content_items_category_status ON content_items(category, status, created_at DESC);`
  - `CREATE INDEX idx_content_items_subject ON content_items(subject);`

### 8. جدول تفاصيل الفعاليات والتسجيل (`event_details` & `event_registrations`)
- **الهدف**: إدارة الفعاليات والمؤتمرات وتتبع المقاعد الشاغرة ومنع التكرار.
- **الأعمدة والمحددات لـ `event_details`**:
  - `content_id` VARCHAR(50) PRIMARY KEY REFERENCES content_items(id) ON DELETE CASCADE.
  - `event_date_display` VARCHAR(100) NOT NULL: تاريخ الانعقاد النصي.
  - `event_time_display` VARCHAR(100) NOT NULL: التوقيت النصي.
  - `location_type` VARCHAR(50) NOT NULL: (`حضوري`, `عن بُعد عبر Teams`, إلخ).
  - `location_address` VARCHAR(255): العنوان الميداني أو رابط البث.
  - `seats_capacity` INT NOT NULL: السعة القصوى للمقاعد.
  - `seats_booked` INT DEFAULT 0 NOT NULL: عدد المقاعد المحجوزة.
- **الأعمدة والمحددات لـ `event_registrations`**:
  - `id` VARCHAR(50) PRIMARY KEY: معرّف الحجز `ereg_`.
  - `event_id` VARCHAR(50) NOT NULL REFERENCES content_items(id) ON DELETE CASCADE.
  - `user_id` VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE.
  - `registered_at` TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL.
  - `attendance_status` VARCHAR(30) DEFAULT 'registered' NOT NULL.
  - `UNIQUE (event_id, user_id)`: منع تسجيل المستخدم في الفعالية الواحدة أكثر من مرة.

### 9. جدول استفسارات الدعم والتواصل (`contact_inquiries`)
- **الهدف**: استلام رسائل الدعم وحفظها للمتابعة والرد.
- **الأعمدة والمحددات**:
  - `id` VARCHAR(50) PRIMARY KEY: معرّف الاستفسار `inq_`.
  - `user_id` VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL: المستخدم (إن كان مسجلاً).
  - `sender_name` VARCHAR(150) NOT NULL: الاسم.
  - `sender_email` VARCHAR(255) NOT NULL: البريد الإلكتروني.
  - `subject` VARCHAR(200) NOT NULL: موضوع الاستفسار.
  - `message` TEXT NOT NULL: نص الرسالة.
  - `ip_address` VARCHAR(45): عنوان IP للحد من الإغراق والبريد العشوائي.
  - `status` VARCHAR(30) DEFAULT 'pending' NOT NULL: (`pending`, `in_progress`, `resolved`).
  - `created_at` TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP NOT NULL.

---

## 6. متطلبات الأمان والتخزين السحابي للملفات (Security & File Storage)

### أ. التحقق من الصلاحيات وأمان الخادم (Server-Side Authorization)
1. **صلاحيات النشر والتعديل**:
   - نشر المبادرات في المجتمع: يستلزم مصادقة سارية والتحقق من صلاحية `perm_post_community` الممنوحة لأدوار `TEACH`, `PRO`, `LEAD`, `START`.
   - تعديل أو حذف المبادرة: مقتصر على **الكاتب الأصلي للمنشور** أو المشرف العام `LEAD` (IDOR Defense).
   - إدارة موارد المكتبة وقسم المستجدات: يستلزم صلاحية `perm_manage_resources` الممنوحة حصراً لأدوار `PRO` و `LEAD`.
2. **حماية التنزيل والملفات الحساسة**:
   - منع الوصول المباشر للملفات عبر مسارات ثابتة مكشوفة (Unprotected Public Directories).
   - توفير نقطة نهاية وسيطة `GET /api/v1/library/download/:id` تفحص صلاحية المستخدم وسجل الحظر قبل إرجاع الملف.

### ب. ضوابط رفع الملفات (File Upload Hardening)
1. **التحقق من نوع الملف الحقيقي (Magic Bytes Inspection)**:
   - عدم الاكتفاء بالامتداد الظاهري (`.pdf` أو `.docx`).
   - فحص بايتات الترويسة السحرية (Magic Bytes) في الخادم لمنع رفع سكربتات تنفيذية خبيثة متنكرة (`.exe`, `.sh`, `.php`, `.js`).
2. **تقييد الحجم والامتدادات المسموحة**:
   - قائمة بيضاء صارمة للامتدادات: `['.pdf', '.docx', '.pptx', '.xlsx', '.png', '.jpg']`.
   - حد أقصى لحجم المرفق: 15 ميجابايت للملف الواحد، و 30 ميجابايت لمجموع مرفقات المنشور.
3. **تسمية وتخزين الملفات بأمان (Path Traversal & Overwrite Defense)**:
   - استبدال الاسم الأصلي بـ UUID فريد عشوائي مع الامتداد المفحوص: `upload_<uuid4>.<clean_ext>`.
   - تخزين الملفات في مسار تخزين معزول خارج مسار خادم الويب العام `public_html`.
   - منع استخدام أي مقاطع تحتوي على `../` أو أسماء تحكم خاصة.

### ج. الاستمرارية وموثوقية قاعدة البيانات (Data Resilience & Transactions)
1. **منع النجاح الزائف (Zero False-Success Guarantee)**:
   - أي عملية إنشاء أو تعديل أو تفاعل (إعجاب/حفظ/تعليق) يجب ألا تُرجع استجابة `200/201` للواجهة إلا بعد تأكيد استجابة PostgreSQL (`COMMIT`).
   - في حال فشل الاتصال بقاعدة البيانات، يُرجع الخادم رمز `503 DATABASE_UNAVAILABLE` صريح دون استخدام فيدباك زائف.
2. **المعاملات الذرية لحجز الفعاليات (Race-Condition Defense)**:
   - عملية حجز المقعد في الفعالية تستخدم استعلاماً ذرياً مع قفل سطري (`SELECT ... FOR UPDATE`):
     ```sql
     UPDATE event_details 
     SET seats_booked = seats_booked + 1 
     WHERE content_id = $1 AND seats_booked < seats_capacity;
     ```
   - يضمن ذلك عدم تجاوز سعة المقاعد حتى في حال تزامن مئات الطلبات في نفس اللحظة.

---

## 7. خريطة الاعتماديات البرمجية (Dependency Map)

لتحقيق متطلبات P1 دون إضافة مكتبات زائدة غير ضرورية، تم حصر الاعتماديات المطلوبة:

| الحزمة | الاستخدام المعماري | هل هي مثبتة حالياً؟ | الإجراء المطلوب في P1.2 |
| :--- | :--- | :---: | :--- |
| `express` | خادم الويب وموجه المسارات | ✅ مثبتة (`^4.21.2`) | استخدام المسارات الفرعية المعيارية |
| `pg` | عميل ومجمع اتصالات PostgreSQL | ✅ مثبتة (`^8.23.1`) | تنفيذ استعلامات الجداول التسعة الجديدة |
| `bcryptjs` | تشفير كلمات المرور | ✅ مثبتة (`^3.0.3`) | الاستمرار في استخدام Cost 12 |
| `jsonwebtoken` | إدارة التوكنات الآمنة | ✅ مثبتة (`^9.0.3`) | استمرار التحقق من التوقيع و JTI |
| `cookie-parser` | قراءة كوكيز الجلسة و CSRF | ✅ مثبتة (`^1.4.7`) | استمرار دعم الكوكيز المشفرة |
| `cors` | حماية أصول النطاقات | ✅ مثبتة (`^2.8.6`) | استخدام السياسة الصارمة المعتمدة |
| `multer` | معالجة طلبات الرفع `multipart/form-data` | ❌ غير مثبتة | تثبيتها عبر `install_applet_package` كاعتمادية خادم أساسية لمعالجة المرفقات |
| `@types/multer` | أنواع TypeScript لـ Multer | ❌ غير مثبتة | تثبيتها كـ DevDependency |

---

## 8. خطة التنفيذ المرحلية (Phased Implementation Roadmap)

```
+-----------------------------------------------------------------------------------------+
| [ P1.1 ] حصر البيانات الوهمية والمخطط الهندسي (الوضع الحالي — منجز ومعتمد)                 |
+-----------------------------------------------------------------------------------------+
                                             ↓
+-----------------------------------------------------------------------------------------+
| [ P1.2 ] ترحيل المخطط وقاعدة البيانات (Migration 002)                                  |
|  - إنشاء وتشغيل 002_community_library_content.sql لإنشاء الجداول التسعة.                  |
|  - بذر البيانات الأولية (Seeding) المأخوذة من mockData.ts لضمان ثراء المحتوى التعليمي.    |
|  - كتابة توابع المستودع في postgresRepository.ts و InMemoryDatabaseStore للتطوير.        |
+-----------------------------------------------------------------------------------------+
                                             ↓
+-----------------------------------------------------------------------------------------+
| [ P1.3 ] تنفيذ مسارات الخادم وطبقة الخدمات (Backend API Implementation)                 |
|  - إنشاء موجه مجتمع المعلمين: server/routes/community.ts (منشورات، تعليقات، إعجابات).    |
|  - إنشاء موجه المكتبة الرقمية: server/routes/library.ts (موارد، تصفية، تنزيل).          |
|  - إنشاء موجه المحتوى والفعاليات: server/routes/content.ts (مستجدات، حجز مقاعد).        |
|  - إنشاء موجه الدعم والتواصل: server/routes/support.ts (رسائل واستفسارات).              |
|  - إنشاء موجه البحث الشامل: server/routes/search.ts (بحث PostgreSQL متقدم).             |
+-----------------------------------------------------------------------------------------+
                                             ↓
+-----------------------------------------------------------------------------------------+
| [ P1.4 ] ربط الواجهة الأمامية وتطهير Mock Data (Frontend Integration)                   |
|  - توسيع apiClient.ts بالدوال الحقيقية لكافة المسارات الجديدة مع معالجة الأخطاء.         |
|  - تحديث CommunitySection.tsx ليقرأ ويكتب عبر API بدلاً من المصفوفة المحلية.           |
|  - تحديث LatestContentSection.tsx و LibraryModal.tsx و ContributeModal.tsx و Contact.   |
|  - حذف الاعتماديات الزائفة من mockData.ts ونقلها بالكامل إلى جداول PostgreSQL.          |
+-----------------------------------------------------------------------------------------+
                                             ↓
+-----------------------------------------------------------------------------------------+
| [ P1.5 ] الاختبارات الشاملة وبوابة الاعتماد (P1 Verification & Sign-Off)                |
|  - كتابة مجموعة اختبارات P1 الآلية لتغطية كافة المسارات وحالات النجاح والرفض.           |
|  - التأكد من عدم انحدار اختبارات P0 الـ 22 السابقة أو اختبارات Master التسعة.           |
|  - مراجعة مستقلة واعتماد بوابة التوقف قبل الانتقال إلى المرحلة التالية.                  |
+-----------------------------------------------------------------------------------------+
```

---

## 9. مصفوفة المخاطر ومعايير القبول (Risks & Acceptance Criteria)

### أ. مصفوفة إدارة المخاطر الفنية:
1. **مخاطر استنزاف الذاكرة عند رفع ملفات كبيرة**:
   - *الإجراء الوقائي*: تقييد حجم الملف في `multer` بـ 15MB، وتخزين الملفات على القرص المؤقت أو التخزين المستمر بدلاً من إبقائها كاملة في ذاكرة RAM.
2. **مخاطر تكرار الإعجابات وسباق الحجوزات (Race Conditions)**:
   - *الإجراء الوقائي*: استخدام قيود المفتاح المركب `PRIMARY KEY (post_id, user_id)` على الإعجابات والمحفوظات، واستعلامات التحديث المقفلة ذرياً `WHERE seats_booked < seats_capacity` لحجز مقاعد الفعاليات.
3. **مخاطر تعطل الواجهة عند انقطاع الاتصال بقاعدة البيانات**:
   - *الإجراء الوقائي*: معالجة أنيقة للأخطاء في `apiClient` وإظهار رسائل خطأ واضحة باللغة العربية مع إمكانية إعادة المحاولة، دون إظهار أي نجاح زائف.

### ب. معايير القبول الصارمة لاعتماد P1 (P1 Acceptance Criteria):
- [ ] خلو كافة المكونات (`CommunitySection`, `LatestContentSection`, `LibraryModal`, `ContributeModal`, `ContactModal`) من استيراد مصفوفات `mockData.ts`.
- [ ] استجابة كافة استدعاءات البيانات من نقاط نهاية `/api/v1/*` المتصلة بجداول PostgreSQL.
- [ ] قدرة المعلم الموثق على نشر مبادرة وتخزينها واسترجاعها بنجاح حتى بعد إعادة تشغيل الخادم.
- [ ] استمرار الإعجابات والمحفوظات والتعليقات في قاعدة البيانات بشكل دائم.
- [ ] حجز مقاعد الفعاليات وتناقص العداد الفعلي للمقاعد الشاغرة بدقة ذرية.
- [ ] حفظ رسائل الدعم في جدول `contact_inquiries`.
- [ ] نجاح البناء الكامل (`npm run build`) واجتياز الفحص النمطي (`tsc --noEmit`) بنسبة 100%.
- [ ] اجتياز جميع اختبارات الانحدار السابقة (87/87) بالإضافة إلى اختبارات P1 الجديدة.

---

## 10. إقرار بوابة التوقف والحكم النهائي (Stop Gate Decision)

امتثالاً للضوابط الصارمة المحددة للمرحلة **PHASE 5 / P1.1**:
- تم إنجاز حصر وتصنيف البيانات الوهمية بالكامل في الشيفرة المصدرية.
- تم إعداد المخطط المعماري الهندسي التفصيلي وجداول DDL المقترحة ومسارات API وخطط الأمان.
- **تم الالتزام بنمط القراءة فقط (READ-ONLY)**؛ لم يتم تعديل أي ملف برمجي، ولم يتم إنشاء أي جداول أو ترحيلات، ولم يتم لمس الفرع `main`.

### القرار النهائي (Decision):
```
================================================================================
  DECISION: [ READY FOR P1.2 ] — Blueprint & Inventory Completed Successfully
  MODE    : READ-ONLY AUDIT & BLUEPRINT SPECIFICATION VERIFIED
  NEXT    : Stop-Gate acknowledged. Ready to receive authorization for P1.2
            (DDL Migrations, Seed Generation & Repository Layer Expansion).
================================================================================
```

*تم توثيق واعتماد هذا التقرير الهندسي لحفظ سجل التطوير والتكامل لمنظومة NEXORA.*
