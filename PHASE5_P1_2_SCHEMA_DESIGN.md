# NEXORA — PHASE 5 / P1.2: Database Schema & Architecture Design
## وثيقة التصميم الهندسي لجداول النطاق التعليمي (DDL Specification)

**تاريخ الإعداد**: 31 أكتوبر 2026  
**المرحلة**: PHASE 5 / P1.2 — Database Foundation & DDL Migrations  
**الفرع المستهدف**: `production-remediation`  
**طبيعة البيئة**: بيئة معزولة تماماً (Isolated Sandbox)  
**ملف الترحيل**: `server/db/migrations/002_community_library_content.sql` و `db/migrations/002_community_library_content.sql`  

---

## 1. الملخص المعماري (Architectural Overview)

تم تصحيح وتثبيت حصر الجداول لتشمل **10 جداول علائقية متكاملة** تغطي النطاقات الوظيفية الأربعة لمنظومة **NEXORA**:
1. **نطاق مجتمع المعلمين والمبادرات (Community Domain)**: 5 جداول.
2. **نطاق المكتبة والمستودع الرقمي (Library Domain)**: جدول واحد.
3. **نطاق المحتوى والفعاليات العلمية (Content & Events Domain)**: 3 جداول.
4. **نطاق الدعم والتواصل الأكاديمي (Support & Inquiries Domain)**: جدول واحد.

### المبادئ الهندسية الصارمة للتصميم:
- **المفاتيح الأساسية**: استخدام معرفات فريدة محددة (`VARCHAR(50) PRIMARY KEY`) متوافقة مع نمط الـ IDs المستخدم بالنظام.
- **سياسات الحذف غير التدميرية**:
  - منع الحذف المتسلسل العشوائي للمستخدمين؛ استخدام `ON DELETE RESTRICT` للمؤلفين في منشورات المجتمع وتعليقاته لحماية الإرث العلمي.
  - استخدام `ON DELETE SET NULL` في حقول المؤلفين للمكتبة والمحتوى والدعم لضمان بقاء الموارد متاحة حتى في حال إلغاء حساب الناشر.
  - قصر `ON DELETE CASCADE` حصراً على العلاقات التابعة منطقياً للمنشور (المرفقات، التعليقات التابعة، الإعجابات، المحفوظات) أو الفعالية (حجوزات المقاعد وتفاصيل الفعالية).
- **منع التكرار الذري**: فرض مفاتيح مركبة `PRIMARY KEY (post_id, user_id)` على الإعجابات والمحفوظات، وقيد فريد `UNIQUE (event_id, user_id)` على تسجيلات الفعاليات.
- **انضباط التخزين الثنائي**: عدم تخزين أي ملفات ثنائية (BLOBs) داخل PostgreSQL، والاكتفاء بتخزين مسارات التخزين والروابط وبيانات الحجم (`BIGINT`) ونوع الـ MIME.

---

## 2. مواصفات الجداول العشرة بالتفصيل

### نطاق مجتمع المعلمين (Community Domain)

#### 1. جدول منشورات المبادرات (`community_posts`)
- **الوظيفة**: حفظ مبادرات وخطط وتجارب المعلمين العلمية.
- **الحقول الأساسية**:
  - `id`: VARCHAR(50) PRIMARY KEY
  - `author_id`: VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE RESTRICT
  - `title`: VARCHAR(255) NOT NULL
  - `subject`: VARCHAR(100) NOT NULL (كيمياء، فيزياء، أحياء، جيولوجيا، علوم عامة)
  - `grade_level`: VARCHAR(50) NOT NULL (الصف العاشر، الحادي عشر، الثاني عشر...)
  - `summary`: TEXT NOT NULL
  - `content`: TEXT
  - `status`: VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'review', 'published', 'hidden', 'archived'))
  - `likes_count`: INTEGER NOT NULL DEFAULT 0 CHECK (likes_count >= 0)
  - `comments_count`: INTEGER NOT NULL DEFAULT 0 CHECK (comments_count >= 0)
  - `bookmarks_count`: INTEGER NOT NULL DEFAULT 0 CHECK (bookmarks_count >= 0)
  - `views_count`: INTEGER NOT NULL DEFAULT 0 CHECK (views_count >= 0)
  - `is_pinned`: BOOLEAN NOT NULL DEFAULT FALSE
  - `tags`: TEXT[] DEFAULT ARRAY[]::TEXT[]
  - `created_at`, `updated_at`: TIMESTAMP WITH TIME ZONE NOT NULL

#### 2. جدول المرفقات (`community_attachments`)
- **الوظيفة**: ربط المستندات والعروض والملفات المرفقة بالمنشور.
- **الحقول**:
  - `id`: VARCHAR(50) PRIMARY KEY
  - `post_id`: VARCHAR(50) NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE
  - `file_name`: VARCHAR(255) NOT NULL
  - `file_path`: VARCHAR(500) NOT NULL
  - `file_size_bytes`: BIGINT NOT NULL CHECK (file_size_bytes > 0)
  - `mime_type`: VARCHAR(100) NOT NULL
  - `file_type`: VARCHAR(50) NOT NULL (pdf, docx, pptx, image...)

#### 3. جدول التعليقات والنقاشات (`community_comments`)
- **الوظيفة**: التعليقات التفاعلية وإمكانية الردود الشجرية.
- **الحقول**:
  - `id`: VARCHAR(50) PRIMARY KEY
  - `post_id`: VARCHAR(50) NOT NULL REFERENCES community_posts(id) ON DELETE CASCADE
  - `author_id`: VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE RESTRICT
  - `content`: TEXT NOT NULL CHECK (length(trim(content)) > 0)
  - `status`: VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('published', 'hidden', 'flagged'))
  - `parent_comment_id`: VARCHAR(50) REFERENCES community_comments(id) ON DELETE CASCADE

#### 4. جدول الإعجابات (`community_likes`)
- **الوظيفة**: تسجيل إعجاب المستخدم بالمنشور ومنع التكرار نهائياً.
- **المفتاح**: `PRIMARY KEY (post_id, user_id)`
- **العلاقات**: كلا المعرفين يحذفان تسلسلياً `ON DELETE CASCADE`.

#### 5. جدول المحفوظات (`community_bookmarks`)
- **الوظيفة**: حفظ المنشور في المفضلة الشخصية للمعلم.
- **المفتاح**: `PRIMARY KEY (post_id, user_id)`

---

### نطاق المكتبة الرقمية (Library Domain)

#### 6. جدول الموارد الرقمية (`library_resources`)
- **الوظيفة**: الكتب المدرسية، الأدلة الإرشادية، أوراق العمل، وبنوك الأسئلة.
- **الحقول**:
  - `id`: VARCHAR(50) PRIMARY KEY
  - `title`: VARCHAR(255) NOT NULL
  - `description`: TEXT
  - `category`: VARCHAR(50) NOT NULL CHECK (category IN ('books', 'guides', 'worksheets', 'exams', 'curriculum', 'research'))
  - `subject`: VARCHAR(100) NOT NULL
  - `grade_level`: VARCHAR(50) NOT NULL
  - `author_id`: VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL
  - `publisher_name`: VARCHAR(200)
  - `file_url`: VARCHAR(500) NOT NULL
  - `file_size_bytes`: BIGINT NOT NULL CHECK (file_size_bytes > 0)
  - `file_type`: VARCHAR(50) NOT NULL
  - `mime_type`: VARCHAR(100) NOT NULL
  - `status`: VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'review', 'published', 'archived'))
  - `downloads_count`: INTEGER NOT NULL DEFAULT 0 CHECK (downloads_count >= 0)
  - `views_count`: INTEGER NOT NULL DEFAULT 0 CHECK (views_count >= 0)

---

### نطاق المحتوى والفعاليات (Content & Events Domain)

#### 7. جدول عناصر المحتوى المتجدد (`content_items`)
- **الوظيفة**: المقالات التخصصية، الفيديوهات المخبرية، الأخبار، وإعلانات الفعاليات.
- **الحقول**:
  - `id`: VARCHAR(50) PRIMARY KEY
  - `title`: VARCHAR(255) NOT NULL
  - `description`: TEXT NOT NULL
  - `category`: VARCHAR(50) NOT NULL CHECK (category IN ('article', 'video', 'news', 'event', 'announcement'))
  - `subject`, `grade_level`: VARCHAR
  - `author_id`: VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL
  - `thumbnail_url`, `video_url`: VARCHAR(500)
  - `read_time_minutes`: INTEGER DEFAULT 5 CHECK (read_time_minutes >= 0)
  - `status`: VARCHAR(20) NOT NULL DEFAULT 'published' CHECK (status IN ('draft', 'published', 'archived'))
  - `featured`: BOOLEAN NOT NULL DEFAULT FALSE
  - `views_count`: INTEGER NOT NULL DEFAULT 0

#### 8. جدول تفاصيل الفعاليات (`event_details`)
- **الوظيفة**: تفاصيل وتوقيت وسعة الورش والملتقيات العلمية.
- **الحقول**:
  - `id`: VARCHAR(50) PRIMARY KEY
  - `content_item_id`: VARCHAR(50) UNIQUE NOT NULL REFERENCES content_items(id) ON DELETE CASCADE
  - `event_date`: TIMESTAMP WITH TIME ZONE NOT NULL
  - `duration_minutes`: INTEGER NOT NULL DEFAULT 60 CHECK (duration_minutes > 0)
  - `location_type`: VARCHAR(20) NOT NULL CHECK (location_type IN ('virtual', 'in_person', 'hybrid'))
  - `location_address`: VARCHAR(300)
  - `speaker_name`: VARCHAR(200) NOT NULL
  - `speaker_title`: VARCHAR(200)
  - `seats_capacity`: INTEGER NOT NULL CHECK (seats_capacity > 0)
  - `seats_booked`: INTEGER NOT NULL DEFAULT 0 CHECK (seats_booked >= 0 AND seats_booked <= seats_capacity)

#### 9. جدول تسجيلات الفعاليات (`event_registrations`)
- **الوظيفة**: حجز المقاعد للمستخدمين الموثقين ومنع تجاوز السعة.
- **الحقول**:
  - `id`: VARCHAR(50) PRIMARY KEY
  - `event_id`: VARCHAR(50) NOT NULL REFERENCES event_details(id) ON DELETE CASCADE
  - `user_id`: VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE CASCADE
  - `status`: VARCHAR(20) NOT NULL DEFAULT 'confirmed' CHECK (status IN ('confirmed', 'waitlisted', 'cancelled', 'attended'))
  - `registration_notes`: TEXT
  - `CONSTRAINT uq_event_user_registration UNIQUE (event_id, user_id)`

---

### نطاق الدعم والتواصل (Support Domain)

#### 10. جدول استفسارات التواصل (`contact_inquiries`)
- **الوظيفة**: استقبال رسائل الدعم والتواصل ومتابعة حالتها إدارياً.
- **الحقول**:
  - `id`: VARCHAR(50) PRIMARY KEY
  - `user_id`: VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL
  - `full_name`: VARCHAR(200) NOT NULL
  - `email`: VARCHAR(255) NOT NULL
  - `phone`: VARCHAR(50)
  - `subject`: VARCHAR(255) NOT NULL
  - `message`: TEXT NOT NULL CHECK (length(trim(message)) > 0)
  - `portal_code`: VARCHAR(50)
  - `status`: VARCHAR(20) NOT NULL DEFAULT 'received' CHECK (status IN ('received', 'in_progress', 'resolved', 'closed'))
  - `admin_notes`: TEXT
  - `assigned_to`: VARCHAR(50) REFERENCES users(id) ON DELETE SET NULL

---

## 3. خريطة الفهارس وتحسين الأداء (Indexes Specification)

تم إنشاء الفهارس التالية لتسريع الاستعلامات والتصفية ومنع الاختناقات:
1. `idx_community_posts_author_id`, `idx_community_posts_status`, `idx_community_posts_subject`, `idx_community_posts_grade_level`, `idx_community_posts_created_at`
2. `idx_community_comments_post_id`, `idx_community_comments_author_id`, `idx_community_comments_created_at`
3. `idx_community_attachments_post_id`
4. `idx_community_likes_user_id`, `idx_community_likes_post_id`
5. `idx_community_bookmarks_user_id`, `idx_community_bookmarks_post_id`
6. `idx_library_resources_category`, `idx_library_resources_subject`, `idx_library_resources_grade_level`, `idx_library_resources_downloads`
7. `idx_content_items_category`, `idx_content_items_status`, `idx_content_items_featured`
8. `idx_event_details_event_date`
9. `idx_event_registrations_event_id`, `idx_event_registrations_user_id`, `idx_event_registrations_status`
10. `idx_contact_inquiries_status`, `idx_contact_inquiries_email`, `idx_contact_inquiries_created_at`

*تم اعتماد وثيقة التصميم الهندسي كمحدد صارم لعمليات DDL في مرحلة P1.2.*
