# تقرير تدقيق الجاهزية والتوافق للتكامل (Integration Readiness Audit)
## مشروع NEXORA — المرحلة الخامسة: الحزمة الفرعية P1.4.1
**العنوان:** تدقيق معماري وتوافقي شامل بين واجهات RESTful API ومكونات React  
**وضع التشغيل الحاكم:** وضع القراءة الصارم (READ-ONLY — NO FRONTEND MODIFICATIONS)  
**تاريخ التدقيق:** 31 أكتوبر 2026  
**الإصدار:** 1.0.0-phase5-p1.4.1  
**حالة Git Metadata:** غائبة في بيئة الحاوية الحالية (`/app/applet`) لعدم وجود دليل `.git`؛ تم التوثيق والتدقيق بناءً على الشجرة البرمجية المباشرة وحالة الملفات.

---

## 1. تدقيق عميل الواجهة البرمجية (API Client Audit — `src/services/apiClient.ts`)

تم فحص ملف `src/services/apiClient.ts` (281 سطراً) سطراً بسطر للتحقق من جاهزيته واستعداده للربط مع المسارات البرمجية الجديدة:

### 1.1 العنوان الأساسي وتحديد بيئة التشغيل (Base URL & Environment)
- **السطر 48:** 
  ```typescript
  const API_BASE = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '');
  ```
  - **التقييم:** سليم ومتوافق تماماً. في بيئة التطوير والإنتاج، في حال عدم تعيين `VITE_API_URL`، يعتمد العميل تلقائياً على المسار النسبي `/api/v1` مما يتكامل مباشرة مع خادم Express المدمج ويمنع مشاكل CORS عبر المنصات.

### 1.2 سياسة تضمين بيانات الاعتماد (Credentials Policy)
- **الأسطر 103، 141، 175، 210، 241، 270:**
  ```typescript
  credentials: 'include'
  ```
  - **التقييم:** ممتثل ومطبق في جميع استدعاءات `fetch`. يضمن إرسال واستقبال ملفات تعريف الارتباط الآمنة (HttpOnly Cookies) للجلسة `nexora_auth` ولـ CSRF `nexora_csrf`.

### 1.3 استخراج وإرسال رمز الحماية ضد CSRF (CSRF Token Management)
- **الأسطر 50-54، 56، 84-90:**
  - يتم استخراج الرمز من الذاكرة `inMemoryCsrfToken` أو من ملف تعريف الارتباط `nexora_csrf` عبر الدالة `getCookie('nexora_csrf')`.
  - **الأسطر 135، 169، 234، 264:** يتم إرسال الرمز في ترويسة `X-CSRF-Token` في العمليات التعديلية الحالية (`register`, `login`, `logout`, `changePassword`).
  - **الفجوة المرصودة:** تقتصر حماية CSRF في العميل حالياً على مسارات المصادقة فقط؛ ولا توجد دوال عامة تضمن حقن `X-CSRF-Token` تلقائياً في طلبات `POST`, `PATCH`, `DELETE` الخاصة بمجتمع المعلمين، المكتبة، الفعاليات، والدعم.

### 1.4 دعم رموز Bearer وإدارة التخزين (Bearer Token Support)
- **الأسطر 47، 59-82:**
  - يتم تخزين الرمز في `localStorage` تحت المفتاح `nexora_auth_token` مع إتاحته كبديل رجعي (Backward Compatibility).
  - لا يتم تخزين أي كلمات مرور أو بيانات حساسة غير الرمز الصادر من الخادم.
  - **الأسطر 204، 230، 260:** يتم إرفاق الترويسة `Authorization: Bearer <token>` في حال توفره.

### 1.5 معالجة أكواد الاستجابة وأخطاء الشبكة (Error Handling & HTTP Status Codes)
- **الأسطر 146، 180، 214، 275:**
  ```typescript
  if (!res.ok) {
    throw new Error(data.message || 'رسالة افتراضية');
  }
  ```
  - **الفجوة الحرجة المرصودة:** العميل يقوم برمي كائن خطأ قياسي `Error` يحتوي فقط على الرسالة النصية، مما يؤدي إلى:
    1. فقدان كود الحالة الرقمي (مثل `401`, `403`, `404`, `409`, `422`, `429`, `500`).
    2. فقدان كود الخطأ البرمجي الصادر من الباك إند (مثل `data.error = "ALREADY_REGISTERED"`, `EVENT_CAPACITY_EXCEEDED`, `FORBIDDEN`, `VALIDATION_FAILED`).
    3. عجز مكونات الواجهة (مثل `ContentDetailModal`) عن التمييز بين خطأ امتلاء المقاعد (`409 EVENT_CAPACITY_EXCEEDED`) وخطأ التسجيل المكرر (`409 ALREADY_REGISTERED`) أو انتهاء الجلسة (`401 UNAUTHORIZED`).

### 1.6 انتهاء الجلسة وإلغاء المصادقة (Session Expiry)
- **السطر 215:** في دالة `getMe()`، عند فشل الاستجابة، يتم استدعاء `this.clearToken()` وحذف الرمز من التخزين، وهو سلوك سليم.

### 1.7 غياب دوال الاستدعاء العام ومحددات المهلة (Missing Generic HTTP Methods & Timeouts)
- **غياب الدوال الأساسية:** العميل `apiClient` يحتوي فقط على 6 دوال خاصة بالمصادقة؛ ولا يملك أي دوال عامة: `get<T>()`, `post<T>()`, `patch<T>()`, `delete<T>()`.
- **محددات المهلة (Timeout & AbortController):** متوفرة فقط في دالة فحص الصحة `checkHealth()` (السطور 97-105)، بينما تفتقر بقية الدوال لأي تحكم في الإلغاء في حال انقطاع الشبكة أو بطء الخادم.
- **منع تكرار الطلبات (Request Deduplication):** لا يوجد نظام كبح أو حماية من إرسال طلبات متطابقة متزامنة (Idempotency / In-flight deduplication).

---

## 2. توافق المصادقة والحماية من تزوير الطلبات (Auth & CSRF Compatibility)

| المعيار الأمني | الوضع في Backend (P1.3) | الوضع في Frontend Client (`apiClient.ts`) | التقييم التوافقي |
| :--- | :--- | :--- | :--- |
| **قراءة الجلسة للمستخدم العام والزائر** | يدعم `optionalAuth`؛ حيث يُسمح بالوصول للبيانات العامة بدون توكن، ويتعرف على المستخدم إذا أرسل توكن. | يتم جلب الجلسة في `App.tsx` (السطور 61-82) عبر `apiClient.getMe()`. | **متوافق تماماً.** |
| **مطابقة كوكيز الجلسة HttpOnly** | يعتمد على كوكي `nexora_auth` المشفر والمؤمن `SameSite=Lax`. | يرسل `credentials: 'include'` تلقائياً مع كافة الطلبات. | **متوافق تماماً.** |
| **ترويسة التحقق من CSRF** | يشترط وجود ترويسة `x-csrf-token` متطابقة مع كوكي `nexora_csrf` لأي طلب تعديلي (`POST`, `PATCH`, `DELETE`) يعتمد الكوكيز. | يستخرج الكوكي عبر `getCookie('nexora_csrf')` ويرسله كترويسة. | **متوافق نظرياً، لكن يحتاج تعميم على كافة مسارات P1.3.** |
| **عزل المسارات الإدارية** | يشترط دور `LEAD` أو `PRO` أو `SUPP` أو `TEACH`. | يخزن صلاحيات المستخدم `user.role_code` و`permissions`. | **متوافق.** |

---

## 3. مصفوفة عقود الواجهات الخلفية وقنواتها (Endpoint Contract Matrix)

تمت مطابقة المسارات الـ 33 المنفذة في P1.3 مع المواصفات البرمجية الفعلية:

### 3.1 مجتمع المعلمين (Community API)
| المسار | الطريقة | مخطط الطلب (Request DTO) | كود النجاح | مخطط الاستجابة (Response Schema) | متطلبات الصلاحية والمصادقة |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/v1/community/posts` | `GET` | Params: `page`, `limit`, `subject`, `grade_level`, `search`, `is_pinned` | `200` | `{ success: true, data: CommunityPostRow[], pagination: {...} }` | اختياري (`optionalAuth`)؛ عزل المسودات تلقائياً. |
| `/api/v1/community/posts/:id` | `GET` | Params: `id` (3-64 chars) | `200` | `{ success: true, data: CommunityPostRow }` | اختياري؛ المسودة لصاحبها أو للإدارة فقط. |
| `/api/v1/community/posts` | `POST` | Body: `{ title, subject, grade_level, summary, content, tags?, status? }` | `201` | `{ success: true, message, data: { id, ... } }` | مصادقة + صلاحية `posts:create` أو دور (`TEACH`, `LEAD`, `PRO`). |
| `/api/v1/community/posts/:id` | `PATCH` | Body: `{ title?, summary?, content?, subject?, grade_level?, status? }` | `200` | `{ success: true, message, data: CommunityPostRow }` | مصادقة + المالك الأصلي أو دور إداري (IDOR Defense). |
| `/api/v1/community/posts/:id` | `DELETE` | Params: `id` | `200` | `{ success: true, message }` | مصادقة + المالك الأصلي أو دور إداري. |
| `/api/v1/community/posts/:id/comments` | `GET` | Params: `id`, `page`, `limit` | `200` | `{ success: true, data: CommentRow[], pagination: {...} }` | عام. |
| `/api/v1/community/posts/:id/comments` | `POST` | Body: `{ content: string }` | `201` | `{ success: true, message, comment: CommentRow }` | مصادقة + مستخدم نشط. |
| `/api/v1/community/posts/:id/likes` | `POST` | لا يوجد (معرف المسار والمستخدم) | `200` | `{ success: true, likes_count, is_liked: true }` | مصادقة + مستخدم نشط. |
| `/api/v1/community/posts/:id/likes` | `DELETE` | لا يوجد | `200` | `{ success: true, likes_count, is_liked: false }` | مصادقة + مستخدم نشط. |
| `/api/v1/community/bookmarks` | `GET` | Params: `page`, `limit` | `200` | `{ success: true, data: BookmarkRow[], pagination: {...} }` | مصادقة (مفضلة المستخدم فقط). |
| `/api/v1/community/posts/:id/bookmarks` | `POST` | لا يوجد | `200` | `{ success: true, bookmarks_count, is_bookmarked: true }` | مصادقة + مستخدم نشط. |
| `/api/v1/community/posts/:id/bookmarks` | `DELETE` | لا يوجد | `200` | `{ success: true, bookmarks_count, is_bookmarked: false }` | مصادقة + مستخدم نشط. |

### 3.2 المكتبة الرقمية (Library API)
| المسار | الطريقة | مخطط الطلب | كود النجاح | مخطط الاستجابة | متطلبات الصلاحية |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/v1/library/resources` | `GET` | Params: `page`, `limit`, `category`, `subject`, `grade_level`, `search` | `200` | `{ success: true, data: ResourceRow[], pagination: {...} }` | عام (`optionalAuth`). |
| `/api/v1/library/resources/:id` | `GET` | Params: `id` | `200` | `{ success: true, data: ResourceRow }` | عام. |
| `/api/v1/library/resources/:id/download` | `POST` | Params: `id` | `200` | `{ success: true, download: { resourceId, file_url, file_name, mime_type, downloads_count } }` | عام للموارد العامة المنشورة. |
| `/api/v1/library/resources` | `POST` | Body: `{ title, description, category, subject, grade_level, publisher_name, file_url, file_size_bytes, file_type, mime_type }` | `201` | `{ success: true, message, resource: ResourceRow }` | مصادقة + دور `TEACH` أو `LEAD` أو `PRO`. |
| `/api/v1/library/resources/:id` | `PATCH` | Body: تحديثات الحقول | `200` | `{ success: true, message, resource: ResourceRow }` | مصادقة + المالك أو إداري. |
| `/api/v1/library/resources/:id` | `DELETE` | Params: `id` | `200` | `{ success: true, message }` | مصادقة + المالك أو إداري. |

### 3.3 المحتوى والفعاليات (Content & Events API)
| المسار | الطريقة | مخطط الطلب | كود النجاح | مخطط الاستجابة | متطلبات الصلاحية وقواعد التزامن |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/v1/content` | `GET` | Params: `page`, `limit`, `category`, `subject`, `grade_level`, `featured`, `search` | `200` | `{ success: true, data: ContentItemRow[], pagination: {...} }` | عام؛ عزل المسودات. |
| `/api/v1/content/:id` | `GET` | Params: `id` | `200` | `{ success: true, data: ContentItemRow }` | عام. |
| `/api/v1/events` | `GET` | Params: `page`, `limit`, `search` | `200` | `{ success: true, data: EventContentRow[], pagination: {...} }` | عام؛ مؤشر `is_registered_by_me` للمستخدم المسجل. |
| `/api/v1/events/:id` | `GET` | Params: `id` | `200` | `{ success: true, data: EventContentRow }` | عام. |
| `/api/v1/events/:id/register` | `POST` | لا يوجد جسم (يستخدم توكن المستخدم ومعرف الفعالية) | `201` | `{ success: true, message, registration: {...} }` | مصادقة + مستخدم نشط. حماية سعة ذرية (`409 EVENT_CAPACITY_EXCEEDED`) ومنع تكرار (`409 ALREADY_REGISTERED`). |
| `/api/v1/events/:id/register` | `DELETE` | لا يوجد | `200` | `{ success: true, message }` | مصادقة + صاحب الحجز. تحرير ذري للمقعد. |

### 3.4 الدعم الفني والاستفسارات (Support API)
| المسار | الطريقة | مخطط الطلب | كود النجاح | مخطط الاستجابة | متطلبات الصلاحية والتحكم في المعدل |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `/api/v1/support/inquiries` | `POST` | Body: `{ full_name, email, phone?, subject, message, portal_code? }` | `201` | `{ success: true, message, inquiry: { id, subject, status, created_at } }` | عام؛ محدد بمعدل 10 طلبات/15 دقيقة (`inquiryLimiter`). |
| `/api/v1/support/inquiries` | `GET` | Params: `page`, `limit`, `status` | `200` | `{ success: true, data: InquiryRow[], pagination: {...} }` | مصادقة؛ استفسارات المستخدم فقط، أو كافة الاستفسارات للإدارة (`SUPP`, `LEAD`, `PRO`). |
| `/api/v1/support/inquiries/:id` | `GET` | Params: `id` | `200` | `{ success: true, data: InquiryRow }` | مصادقة + المالك أو طاقم الدعم والإدارة (`403 FORBIDDEN` للغرباء). |
| `/api/v1/support/inquiries/:id/status` | `PATCH` | Body: `{ status: 'received' \| 'in_progress' \| 'resolved' \| 'closed', resolution_notes? }` | `200` | `{ success: true, message, inquiry: InquiryRow }` | مصادقة + طاقم الدعم والإدارة فقط (`SUPP`, `LEAD`, `PRO`). |

---

## 4. تدقيق ومطابقة مكونات الواجهة الأمامية (Frontend Component Mapping)

| المكون والملف | مصدر البيانات الحالي | الوظائف التي تتطلب ربط بالـ API | حالات Loading / Empty / Error | متطلبات الصلاحية والمصادقة | التعديلات المطلوبة للربط | المتطلبات البصرية الثابتة |
| :--- | :--- | :--- | :--- | :--- | :--- | :--- |
| **`CommunitySection.tsx`** (الأسطر 3، 98-174) | يستورد مصفوفة ثابتة `COMMUNITY_POSTS` من `../data/mockData` مباشرة. | 1. جلب المنشورات المعتمدة من الخادم.<br>2. دعم الإعجاب المباشر.<br>3. دعم الحفظ في المفضلة. | غير متوفرة حالياً (تعتمد على مصفوفة ثابتة بدون Skeleton أو مؤشر تحميل أو رسائل خطأ). | قراءة عامة للزوار؛ الإعجاب والحفظ يتطلبان تسجيل دخول وتوكن نشط. | 1. إضافة Hook استعلام `useCommunityPosts()`.<br>2. إضافة Skeleton تحميل متناسق.<br>3. إضافة حالة بيانات فارغة.<br>4. تحويل استجابة الخادم إلى شكل كائن `CommunityPost`. | الحفاظ الكامل على شبكة العرض (12 عموداً)، بطاقة الإضاءة البصرية اليمينية، وألوان NEXORA وأزرار الإعجاب. |
| **`ContributeModal.tsx`** (الأسطر 25-36) | تخزين محلي `useState` مع محاكاة `setTimeout` لمدة 600ms. | إرسال المنشور إلى `POST /api/v1/community/posts`. | حالة `isSubmitting` متوفرة؛ ولكن لا توجد معالجة لرسائل الخطأ القادمة من الباك إند. | يتطلب دور `TEACH` أو `LEAD` أو `PRO` وتسجيل دخول مسبق. | 1. استدعاء الـ API مع ترويسة CSRF.<br>2. مطابقة حقل `grade_level` بدلاً من `grade`.<br>3. توجيه غير المسجلين لنافذة الدخول `AuthModal`. | الحفاظ على تصميم النافذة باللون الأخضر التربوي `#2E9E6F`، شاشة النجاح، والأزرار. |
| **`PostDetailModal.tsx`** (الأسطر 14-28) | بيانات المنشور الممررة من القسم + تعليقات وإعجابات محلية وهمية في الذاكرة. | 1. جلب التعليقات الحقيقية `GET /comments`.<br>2. إرسال تعليق جديد `POST /comments`.<br>3. تفعيل الإعجاب والمفضلة الفعليين. | حالات التحميل مفقودة؛ إضافة التعليق تتم محلياً في الذاكرة. | التعليق والتفاعل يتطلب تسجيل دخول. | 1. إضافة جلب التعليقات من الـ API عند فتح النافذة.<br>2. إرسال التعليق للباك إند مع التعامل مع أخطاء التحقق. | الحفاظ على ترويسة `#0B3D5B`، بطاقة المعلم الموثق، وشريط التفاعل السفلي. |
| **`LatestContentSection.tsx`** (الأسطر 3، 25-28) | مصفوفة ثابتة `LATEST_CONTENT` من `../data/mockData`. | جلب المحتوى والأخبار والفعاليات بحسب التصنيف النشط. | غير متوفرة (تعتمد على تصفية الذاكرة الفورية). | قراءة عامة للجميع. | 1. جلب البيانات من مساري `/api/v1/content` و`/api/v1/events`.<br>2. مواءمة تبويب "المصادر التعليمية" مع `/api/v1/library/resources`. | الحفاظ التام على أزرار التبويب Segmented control وشبكة البطاقات الأربع. |
| **`ContentDetailModal.tsx`** (الأسطر 13-25، 123-134) | كائن المحتوى الممرر + حالات محلية وهمية للحجز والتحميل. | 1. حجز مقعد فعلي عبر `POST /api/v1/events/:id/register`.<br>2. تنزيل الموارد عبر `POST /api/v1/library/resources/:id/download`. | حالات تحميل ومؤشرات نجاح محلية بسيطة. | حجز الفعالية يتطلب مصادقة؛ التنزيل عام للموارد المنشورة. | 1. ربط زر الحجز بالمسار الذري للفعاليات.<br>2. إظهار رسائل خطأ دقيقة عند `409 ALREADY_REGISTERED` أو `EVENT_CAPACITY_EXCEEDED`. | الحفاظ على مشغل الفيديو المحاكى، كتلة تفاصيل الفعالية الصفراء، وأزرار الإغلاق. |
| **`LibraryModal.tsx`** (الأسطر 16-71) | مصفوفة `libraryItems` مشفرة محلياً داخل المكون (Inline Array). | 1. جلب الموارد من `GET /api/v1/library/resources`.<br>2. تفعيل التنزيل الفعلي وحساب العداد عبر `POST /download`. | تصفية محلية بالذاكرة؛ لا يوجد Skeleton تحميل. | قراءة وتنزيل عام للجميع. | 1. استبدال المصفوفة المكتوبة يدوياً بـ Hook استعلام الخادم.<br>2. تفعيل التنزيل الفعلي الآمن. | الحفاظ على الهوية البصرية الكحلية `#0B3D5B` والتركوازية `#00A7B5`، شريط البحث، وفلاتر المواد. |
| **`ContactModal.tsx`** (الأسطر 18-25، 56) | كائن `useState` مع محاكاة `setTimeout` ونص صريح يفيد بأن الإرسال قيد التفعيل. | إرسال الاستفسار إلى `POST /api/v1/support/inquiries`. | مؤشر إرسال غائب؛ تظهر شاشة النجاح مباشرة بعد ثانية. | متاح للجميع (زوار ومسجلين). | 1. استدعاء API الإرسال الفعلي.<br>2. مطابقة اسم الحقل `full_name` بدلاً من `name`.<br>3. معالجة خطأ تجاوز المعدل (`429 TOO_MANY_REQUESTS`). | الحفاظ على نموذج الإدخال وشاشة النجاح المؤكدة. |
| **`AcademyModal.tsx`** (الأسطر 14-55) | مصفوفة مسارات تدريبية مشفرة محلياً داخل المكون (Inline Array). | التسجيل المبدئي في المسارات التدريبية. | محاكاة محلية مؤقتة. | متاح للمعلمين. | ربط التسجيل بمسارات الفعاليات أو الورش مستقبلاً؛ لا مسار مستقل لها حالياً في P1.3. | يبقى المكون على وضعه الحالي في P1.4 دون تعديل بصري. |
| **`SearchModal.tsx`** (الأسطر 41-62) | تصفية بالذاكرة على `PORTALS_DATA`, `LATEST_CONTENT`, `COMMUNITY_POSTS`. | البحث السريع في البوابات والمحتوى والمشاركات. | بحث متزامن محلي فوري بالذاكرة. | عام. | يمكن الإبقاء على البحث المدمج السريع مع إمكانية استدعاء الـ APIs عند وجود مدخلات معقدة. | الحفاظ الكامل على نمط البحث المنبثق بزر الاختصار `/` أو `Ctrl+K`. |

---

## 5. حصر الفجوات والمفارقات بين الواجهة والخادم (Missing & Incompatible Contracts)

كشف التدقيق الدقيق عن **4 فجوات تعاقدية جوهرية** يجب معالجتها قبل إطلاق ربط الواجهة الأمامية:

### 5.1 مفارقة بنية الحقول والتسميات (Field Name Mismatches)
| الحقل في الواجهة الأمامية (`types/index.ts`) | الحقل في استجابة الخادم (`server/db/types.ts`) | طبيعة الاختلاف وتأثيره |
| :--- | :--- | :--- |
| `post.author.name`, `post.author.role` (كائن متداخل) | `post.author_name`, `post.author_role` (حقول مسطحة) | محاولة قراءة `post.author.name` في كائن قادم مباشرة من الخادم ستؤدي إلى `TypeError: Cannot read properties of undefined (reading 'name')` وانهيار التطبيق. |
| `post.grade` | `post.grade_level` | عدم ظهور المرحلة الدراسية على بطاقة المنشور. |
| `post.publishedDate` (نص معرب مثل "منذ يومين") | `post.created_at` (ختم زمني ISO 8601) | الحاجة لدالة تنسيق زمني باللغة العربية لعرض التواريخ بسلاسة. |
| `post.likes` و `post.saves` | `post.likes_count` و `post.bookmarks_count` | إظهار عداد إعجابات فارغ (NaN أو 0). |
| `content.eventDetails.seatsLeft` (عدد متبقي) | `event.seats_capacity - event.seats_booked` (حسابي) | الخادم يرجع السعة والمحجوز بشكل منفصل، ويجب حساب المقاعد المتبقية في طبقة المواءمة (Adapter). |
| `contact.name` | `inquiry.full_name` | فشل التحقق في الباك إند ورفض الطلب برمز `400 VALIDATION_FAILED` (الاسم الكامل إجباري). |

### 5.2 مفارقة التصنيفات ومصادر البيانات (Category Incompatibility)
- في `types/index.ts` السطر 17: تصنيف المحتوى يتضمن `'resource' | 'video' | 'news' | 'event'`.
- في قاعدة البيانات والخادم المعتمد: تم فصل الموارد الرقمية في جدول ومسارات مستقلة تماماً للمكتبة (`/api/v1/library/resources`) بينما يختص مسار المحتوى (`/api/v1/content`) بالمقالات والفيديوهات والأخبار والفعاليات.
- **الحل التعاقدي المطلوب:** إنشاء طبقة خدمة (Content Service Layer) تقوم بالاستعلام المتوازي وتوحيد العرض لـ `LatestContentSection` دون كسر واجهة المستخدم أو التبويبات القائمة.

### 5.3 مفارقة هيكل تغليف الاستجابة والترقيم (Response Envelope & Pagination)
- مكونات الواجهة تتوقع مصفوفات مباشرة `CommunityPost[]` أو `ContentItem[]`.
- الخادم يرجع الاستجابات مغلفة بنموذج قياسي:
  ```json
  {
    "success": true,
    "data": [ ... ],
    "pagination": {
      "total": 42,
      "page": 1,
      "limit": 10,
      "totalPages": 5,
      "hasMore": true
    }
  }
  ```
- لا يمكن تمرير `res` مباشرة إلى مكونات React دون استخراج `res.data`.

### 5.4 عجز عميل الـ API الحالي عن دعم العمليات العامة (API Client Limitations)
- يفتقر `apiClient.ts` لدوال استدعاء عامة (`apiClient.get`, `apiClient.post`, `apiClient.patch`, `apiClient.delete`).
- لا يتيح تمرير معلمات الاستعلام (Query Parameters) تلقائياً.
- لا يستخرج أرقام الحالات الدقيقة أو أكواد الأخطاء لتغذية واجهات التنبيه (`Toast`).

---

## 6. خطة تسلسل التكامل المتدرج (Integration Sequence)

لتفادي أي انقطاع في تجربة المستخدم أو تراجع في الأداء، تم تقسيم التكامل إلى 4 مراحل متدرجة:

```
┌────────────────────────────────────────────────────────────────────────┐
│                        خطة التكامل المتدرج (P1.4)                     │
└────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
       ┌──────────────────────────────────────────────────────────┐
       │   المرحلة الأولى: تهيئة طبقة المواءمة (P1.4.2 Foundation) │
       │   - ترقية apiClient وإضافة دوال HTTP العامة مع CSRF      │
       │   - إنشاء محولات البيانات (Adapters: DB ↔ Frontend DTO)  │
       │   - إضافة خطافات الاستعلام العامة (useApiQuery / Mutate) │
       └──────────────────────────────────────────────────────────┘
                                    │
                                    ▼
       ┌──────────────────────────────────────────────────────────┐
       │   المرحلة الثانية: ربط مجتمع المعلمين (Community Flow)   │
       │   - ربط CommunitySection واستبدال الاستيراد الثابت      │
       │   - ربط تفاصيل المنشور والتعليقات والإعجاب في Modal      │
       │   - ربط نافذة مشاركة المبادرة ContributeModal            │
       └──────────────────────────────────────────────────────────┘
                                    │
                                    ▼
       ┌──────────────────────────────────────────────────────────┐
       │   المرحلة الثالثة: ربط المكتبة الرقمية (Library Flow)    │
       │   - ربط LibraryModal بمسارات /api/v1/library/resources   │
       │   - تفعيل التنزيل الذري وحساب العدادات الحية             │
       └──────────────────────────────────────────────────────────┘
                                    │
                                    ▼
       ┌──────────────────────────────────────────────────────────┐
       │   المرحلة الرابعة: ربط المحتوى والفعاليات (Content/Events)│
       │   - ربط LatestContentSection بالتصنيفات الخمسة           │
       │   - ربط حجز المقاعد الذري وإلغائه في ContentDetailModal   │
       │   - ربط استمارة الدعم والاستفسارات ContactModal          │
       └──────────────────────────────────────────────────────────┘
```

---

## 7. خطة تعديل الملفات المستهدفة (File Change Plan)

| المرحلة | الملف المستهدف | نوع الإجراء | التعديل المخطط تفصيلياً |
| :--- | :--- | :--- | :--- |
| **P1.4.2** | `/src/services/apiClient.ts` | **توسيع (Enhance)** | إضافة دوال `get`, `post`, `patch`, `delete` العامة، وتضمين رموز CSRF تلقائياً، والاحتفاظ بكود الحالة `status` وكود الخطأ `error` في استثناءات `ApiError`. |
| **P1.4.2** | `/src/services/adapters.ts` | **إنشاء جديد (New)** | دوال نقية لمواءمة بيانات الخادم (snake_case وحقول مسطحة) مع أنواع الواجهة الأمامية الحالية (`CommunityPost`, `ContentItem`). |
| **P1.4.2** | `/src/services/communityService.ts` | **إنشاء جديد (New)** | تجميع استدعاءات مجتمع المعلمين (قوائم، تفاصيل، تعليقات، إعجابات، مفضلة، نشر مبادرة). |
| **P1.4.2** | `/src/components/CommunitySection.tsx` | **تعديل خاضع للرقابة** | استبدال `COMMUNITY_POSTS` الثابت بالبيانات المحملة، إضافة هيكل التحميل Skeleton، والحفاظ التام على التصميم والألوان. |
| **P1.4.2** | `/src/components/modals/PostDetailModal.tsx` | **تعديل خاضع للرقابة** | جلب التعليقات الحقيقية من الخادم وتفعيل أزرار الإعجاب والمفضلة المباشرة. |
| **P1.4.2** | `/src/components/modals/ContributeModal.tsx` | **تعديل خاضع للرقابة** | إرسال المنشور إلى الخادم مع معالجة حقل `grade_level`. |
| **P1.4.3** | `/src/services/libraryService.ts` | **إنشاء جديد (New)** | تجميع استدعاءات المكتبة والتنزيل. |
| **P1.4.3** | `/src/components/modals/LibraryModal.tsx` | **تعديل خاضع للرقابة** | استبدال المصفوفة المكتوبة يدوياً ببيانات الخادم وتفعيل زر التحميل. |
| **P1.4.4** | `/src/services/contentService.ts` | **إنشاء جديد (New)** | استعلام المحتوى والفعاليات. |
| **P1.4.4** | `/src/components/LatestContentSection.tsx` | **تعديل خاضع للرقابة** | دمج نتائج المحتوى والفعاليات والمكتبة حسب التبويب النشط. |
| **P1.4.4** | `/src/components/modals/ContentDetailModal.tsx` | **تعديل خاضع للرقابة** | تفعيل حجز الفعالية الفعلي مع عرض رسائل امتلاء المقاعد بدقة. |
| **P1.4.4** | `/src/components/modals/ContactModal.tsx` | **تعديل خاضع للرقابة** | إرسال استفسار الدعم بالاسم الكامل والبريد إلى الخادم. |

---

## 8. استراتيجية الاختبار والتحقق (Test Strategy)

1. **اختبارات وحدة لطبقة المواءمة (Adapter Unit Tests):**
   - اختبار تحويل كائنات الخادم المسطحة إلى كائنات React المتداخلة والتأكد من عدم حدوث أخطاء `undefined`.
   - اختبار حساب المقاعد المتبقية بدقة.
   - اختبار تحويل التواريخ ISO 8601 إلى صيغ عربية مقروءة.
2. **اختبارات التراجع والاحتياط (Graceful Degradation Tests):**
   - في حال تعذر اتصال الشبكة بالخادم، التحقق من ظهور رسائل خطأ ودية (Fallback UI) أو إتاحة إعادة المحاولة بدون توقف التطبيق أو شاشة بيضاء.
3. **اختبارات التفاعل وحالات الأمان:**
   - التحقق من رفض الإعجاب أو التعليق للزائر وتوجيهه بأمان لتسجيل الدخول.
   - التحقق من معالجة أكواد `409 Conflict` عند امتلاء مقاعد الفعالية.
   - التحقق من ترويسات CSRF عبر مراقبة شبكة المتصفح.

---

## 9. استراتيجية العودة والتراجع (Rollback Strategy)

1. **الاحتفاظ بنسخ احتياطية من ملفات Mock Data:**
   - ملف `src/data/mockData.ts` لن يتم حذفه أو تعديل أي سطر فيه، وسيظل مصدراً أصيلاً للاحتياط المحلي في حال الرغبة في التراجع الفوري.
2. **فصل طبقة الربط عن المكونات البصرية:**
   - من خلال استخدام Adapters وServices وسيطة، يمكن في أي لحظة تحويل مصدر البيانات من استدعاء الشبكة إلى استيراد الـ Mock عبر تغيير سطر واحد في الـ Service دون لمس بنية أو تصميم مكونات الـ UI.
3. **التراجع الخالي من الآثار الجانبية:**
   - عدم تعديل بنية الجداول أو المسارات الخلفية المستقرة في P1.3؛ وبالتالي فإن أي تراجع في الواجهة الأمامية لن يؤثر نهائياً على صحة ونزاهة الخادم.

---

## 10. التوصية النهائية وبوابة التوقف (Final Recommendation & Stop Gate)

بناءً على نتائج التدقيق المعماري الصارم، وتحديد الفجوات التعاقدية بين تسميات الحقول وهياكل الكائنات المتداخلة، وغياب الدوال العامة في عميل `apiClient`:

```text
================================================================================
                    FINAL AUDIT VERIFICATION DECISION
================================================================================
                    CONDITIONAL — FIX CONTRACT GAPS FIRST
================================================================================
```

### الأسباب الداعمة للقرار:
1. **الربط المباشر حالياً سيتسبب في انهيار واجهة React فوراً** بسبب اختلاف بنية كائن الكاتب `author: { name }` في الواجهة مقابل `author_name` في الخادم، واختلاف `grade` مقابل `grade_level`، و`name` مقابل `full_name`.
2. **عميل الـ API الحالي غير مهيأ تقنياً** لإجراء طلبات `GET`, `POST`, `PATCH`, `DELETE` العامة للمسارات الجديدة بدون تكرار الكود البرمجي وترويسات CSRF يدوياً.
3. **الواجهة الأمامية بحاجة إلى طبقة مواءمة وسيطة (`adapters.ts`)** تحفظ الهوية البصرية بنسبة 100% وتحول بيانات الخادم بسلاسة تامة وتوفر استجابة فورية لأي أخطاء.

**إقرار بوابة التوقف:**  
تم الالتزام التام بالوضع المقروء فقط (READ-ONLY). لم يتم تعديل أي ملف برمجي أو تصميمي في الواجهة الأمامية، ولم يتم ربط أي مسار، بانتظار الاعتماد وتفويض البدء في الحزمة الفرعية P1.4.2.
