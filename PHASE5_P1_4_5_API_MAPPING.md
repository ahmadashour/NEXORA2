# وثيقة تخطيط واجهة برمجة التطبيقات — NEXORA Phase 5 / P1.4.5
## API Mapping: Backend ContentItemDTO to Frontend UnifiedContentViewModel

### 1. نقاط النهاية الفعلية المستخدمة (Active Backend REST Endpoints)

| المسار | الطريقة | الوصف | الصلاحيات |
|---|---|---|---|
| `/api/v1/content` | `GET` | استرجاع قائمة عناصر المحتوى المنشورة مع التصفية بالنوع والبحث والترقيم | عام للجميع (المسودات تقتصر على المشرفين) |
| `/api/v1/content/:id` | `GET` | استرجاع تفاصيل عنصر محتوى مفرد مع بيانات الفعالية الملحقة إن وجدت | عام للمنشور / 404 للمسودات لغير المؤلف |
| `/api/v1/content` | `POST` | إنشاء عنصر محتوى جديد | مقصورة على القيادات (`LEAD`, `PRO`) |
| `/api/v1/content/:id` | `PATCH` | تحديث بيانات عنصر محتوى | المؤلف الأصلي أو المشرفين (`LEAD`, `PRO`) |
| `/api/v1/content/:id` | `DELETE` | أرشفة عنصر محتوى (حذف منطقي Soft Delete) | المؤلف الأصلي أو المشرفين (`LEAD`, `PRO`) |

---

### 2. جدول مطابقة الحقول بين الخادم والواجهة (DTO to View Model Mapping)

| حقل الخادم الخلفي (`BackendContentItemDTO`) | نوع الخادم | حقل واجهة المستخدم (`UnifiedContentViewModel`) | نوع الواجهة | التحويل والمعالجة |
|---|---|---|---|---|
| `id` | `string` | `id` | `string` | تطابق مباشر 1:1 |
| `title` | `string` | `title` | `string` | تطابق مباشر مع ضمان نص افتراضي فارغ عند الغياب |
| `description` | `string` | `description` | `string` | تطابق مباشر مع الحفاظ على فواصل الأسطر |
| `category` | `'article' \| 'video' \| 'news' \| 'event' \| 'announcement'` | `rawCategory` | `string` | تخزين القيمة الخام |
| `category` | (كما أعلاه) | `category` | `'resource' \| 'video' \| 'news' \| 'event'` | تحويل: `article` -> `resource`، `video` -> `video`، `news`/`announcement` -> `news` |
| `category` | (كما أعلاه) | `categoryLabel` | `string` | تحويل نصي عربي: `article` -> `مقال تربوي`، `video` -> `فيديو تعليمي`، `news` -> `أخبار تربوية`، `announcement` -> `إعلان رسمي` |
| `created_at` | `string (ISO)` | `date` | `string` | صياغة تاريخ باللغة العربية عبر `formatArabicDate` |
| `subject` | `string \| null` | `subject` | `string` | القيمة المحددة أو `علوم عامة` افتراضياً |
| `grade_level` | `string \| null` | `gradeLevel` | `string \| undefined` | القيمة المحددة أو `undefined` دون اختلاق مرحلة |
| `author_name` | `string \| null` | `author` | `{ name, role, avatar } \| undefined` | إذا كان `author_name` موجوداً يُبنى الكائن، وإلا يبقى `undefined` قطعاً (قاعدة منع الاختلاق) |
| `read_time_minutes` | `number \| null` | `duration` | `string` | صياغة: `${read_time_minutes} دقائق` |
| `thumbnail_url` | `string \| null` | `thumbnailUrl` | `string \| undefined` | تطابق مباشر أو خالي |
| `video_url` | `string \| null` | `url` | `string \| undefined` | تطابق مباشر مع رابط الفيديو |
| `views_count` | `number` | `readsOrViews` | `number` | تحويل عددي سليم `Number(dto.views_count) \|\| 0` |
| `featured` | `boolean \| undefined` | `isFeatured` | `boolean` | `Boolean(dto.featured)` |
| `status` | `'draft' \| 'review' \| 'published' \| 'archived'` | `status` | `string` | تطابق مباشر |
| `event_detail` | `BackendEventDetailDTO \| null` | `eventInfo` / `eventDetails` | `EventDetailViewModel \| undefined` | تكييف آمن لمعلومات الفعالية الملحقة إن وجدت |

---

### 3. مطابقة تصنيفات التبويب في الواجهة مع استعلامات الـ API

| تبويب الواجهة (`LatestContentSection`) | المسمى العربي | معامل الاستعلام لـ Backend (`?category=`) | الملاحظات |
|---|---|---|---|
| `all` | جميع المستجدات | (غير محدد - جلب الكل) | استرجاع أحدث العناصر المنشورة |
| `resource` | المصادر والمقالات | `category=article` | جلب المقالات والأدلة التربوية |
| `video` | الفيديوهات التفاعلية | `category=video` | جلب الفيديوهات والشروح المرئية |
| `news` | جديد التربية والعلوم | `category=news` | جلب الأخبار والإعلانات المدرسية |
| `event` | الفعاليات المجدولة | (مستبعد من استدعاء API) | تطبيق مبدأ عزل مصادر البيانات (مرحلة P1.4.6) |
