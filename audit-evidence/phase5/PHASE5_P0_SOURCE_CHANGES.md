# NEXORA — PHASE 5 / P0: Source Code Remediation Evidence
## توثيق التعديلات البرمجية لحزمة المعالجة الأمنية الحرجة P0

**التاريخ**: 2026-10-31  
**الفرع العامل**: `production-remediation`  
**الفرع الرئيسي (Main)**: `3e4e90c` (محمي تماماً وغير ملموس - Read-Only)  
**Commit الأساس (Baseline)**: `7dfe642dd8716e334c5fa84de805c7b4a30b8304` (سلفه Phase 4: `85ae6c06dc543f0e8eb8def48c1c7aadef98b786`)

---

## 1. فهرس الملفات المعدلة وتصنيفها المعماري

| رقم الملف | مسار الملف | التصنيف الوظيفي | البند الأمني المعالج |
| :--- | :--- | :--- | :--- |
| **01** | `server/routes/health.ts` | Backend Routing | **P0.1** حماية مسار تشخيصات قاعدة البيانات ومنع تسريب بيانات النظام |
| **02** | `server/middleware/auth.ts` | Backend Security Middleware | **P0.2** إلغاء تجاوز CSRF وتطبيق فحص Double-Submit، والتحقق من إبطال الجلسات |
| **03** | `server/routes/auth.ts` | Backend Authentication | **P0.3** و **P0.4** تفعيل ملفات تعريف الارتباط الآمنة، ورفع Bcrypt إلى Cost 12، وإبطال جميع الجلسات |
| **04** | `server/db/index.ts` | Persistence & Repository Interface | **P0.4** إضافة واجهات `revokeAllUserTokens` و `areTokensRevokedForUser` للتخزين المحلي |
| **05** | `server/db/postgresRepository.ts` | PostgreSQL Production Repository | **P0.4** إضافة جدول وتوابع إبطال جميع جلسات المستخدم عند تغيير كلمة المرور |
| **06** | `server/app.ts` | Express Application Pipeline | **P0.5** تشديد قيود CORS بنطاق مطابقة صارم وإزالة `unsafe-eval` من CSP |
| **07** | `src/services/apiClient.ts` | Frontend API Service | **P0.3** إضافة `credentials: 'include'`، وتضمين رمز CSRF، ومزامنة الجلسة الآلية |
| **08** | `src/App.tsx` | Frontend Root Component | **P0.3** استعادة الجلسة الآلية من Cookie عند بدء التشغيل مع حالة تحميل آمنة |
| **09** | `src/components/Header.tsx` | Frontend Navigation Component | **P0.3** إظهار مؤشر تحميل الجلسة لمنع الوميض البصري أو الخروج غير المقصود |
| **10** | `package.json` | Project Manifest | إضافة أمر التشغيل `"test:p0"` |
| **11** | `test/phase5_p0_security.test.ts` | Security Automated Suite | **22 اختباراً شاملاً** لجميع بنود P0.1 إلى P0.5 |
| **12** | `test/final_remediation_suite.ts` | Legacy Test Suite | تحديث اختبار `/db-diagnostics` لاستخدام رمز مصادقة مصرح به (LEAD) |
| **13** | `test/persistence_verification.ts` | Legacy Test Suite | تحديث اختبار CSRF لمطابقة إرسال الرمز الثنائي المزدوج بدلاً من الاعتماد على رأس تجاوزه الملغى |
| **14** | `test/phase4_independent_verification.test.ts` | Legacy Test Suite | تحديث الكائنات المصطنعة بإضافة حقل `last_login_at` للتوافق مع TypeScript |

---

## 2. تفاصيل التعديلات البرمجية لكل بند

### [P0.1] Database Diagnostics Protection (`server/routes/health.ts`)
- **المشكلة السابقة**: كان مسار `GET /api/v1/health/db-diagnostics` متاحاً للعامة بدون أي مصادقة، مما يعرض بيانات الاتصال الداخلية وهيكل الجداول وتشخيصات الخادم.
- **التعديل الهندسي**:
  - تم ربط المسار بـ `authMiddleware` للتحقق من هوية المستخدم.
  - تم تطبيق `requireRole(['LEAD', 'PRO'])` لتقييد الوصول حصرياً لأدوار الإشراف والقيادة.
  - تم تطبيق دالة `sanitizeDiagnostics()` لتنقية المخرجات وحذف أي سلاسل اتصال أو كلمات مرور أو رموز سرية.
  - بقي المسار العام `GET /api/v1/health` مفتوحاً كـ Liveness Probe لمراقبي البنية التحتية دون تسريب بيانات حساسة.

```typescript
// server/routes/health.ts
healthRouter.get('/db-diagnostics', authMiddleware, requireRole(['LEAD', 'PRO']), async (req: Request, res: Response) => {
  try {
    const rawDiagnostics = await db.getDiagnostics();
    const sanitized = sanitizeDiagnostics(rawDiagnostics);
    res.json({
      status: 'success',
      data: sanitized,
    });
  } catch (error) { ... }
});
```

---

### [P0.2] CSRF Validation & Elimination of X-Requested-With Bypass (`server/middleware/auth.ts`)
- **المشكلة السابقة**: كان التحقق من CSRF يتجاوز الفحص إذا تضمن الطلب الترويسة `X-Requested-With: XMLHttpRequest` (الأسطر 104-106)، وهو خطأ أمني يسمح للمهاجمين باستغلال طلبات المتصفح في حال وجود ثغرات في مكتبات التوجيه أو CORS.
- **التعديل الهندسي**:
  - تم حذف شرط التجاوز `X-Requested-With` نهائياً.
  - تم تطبيق نمط **Double-Submit Cookie Pattern**:
    - توليد رمز عشوائي عالي العشوائية بحجم 32 بايت (`generateCsrfToken()`).
    - تعيين ملف تعريف الارتباط `nexora_csrf` (مع خيارات SameSite=Lax وغير مشفر بـ HttpOnly ليتمكن العميل من قراءته).
    - إلزام طلبات التعديل (`POST`, `PUT`, `PATCH`, `DELETE`) المعتمدة على Cookie بإرسال الترويسة `X-CSRF-Token` المطابقة تماماً لقيمة `req.cookies.nexora_csrf`.
    - استثناء طلبات القراءة الآمنة (`GET`, `HEAD`, `OPTIONS`)، والطلبات التي تستخدم `Authorization: Bearer <token>` حصرياً (Stateless API clients).

---

### [P0.3] Secure Session Cookies & Client Session Lifecycle (`server/routes/auth.ts`, `src/services/apiClient.ts`, `src/App.tsx`)
- **المشكلة السابقة**: كان يتم تخزين رمز المصادقة JWT في `localStorage` داخل العميل فقط دون تفعيل ملفات تعريف الارتباط الآمنة المقاومة لـ XSS، وغياب استعادة الجلسة عند إعادة تحميل الصفحة.
- **التعديل الهندسي**:
  - **في الخادم (`server/routes/auth.ts`)**:
    - عند نجاح التسجيل (`/register`) وتسجيل الدخول (`/login`)، يتم ضبط:
      - كوكيز الجلسة: `nexora_token` بخيارات `{ httpOnly: true, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 3600 * 1000 }`.
      - كوكيز CSRF: `nexora_csrf` بخيارات `{ httpOnly: false, secure: process.env.NODE_ENV === 'production', sameSite: 'lax', maxAge: 7 * 24 * 3600 * 1000 }`.
    - عند تسجيل الخروج (`/logout`) وتغيير كلمة المرور (`/change-password`)، يتم مسح الكوكيز `res.clearCookie('nexora_token')` و `res.clearCookie('nexora_csrf')`.
  - **في عميل الويب (`src/services/apiClient.ts`)**:
    - تفعيل `credentials: 'include'` لجميع طلبات `fetch` لضمان إرسال الكوكيز وتلقيها عبر النطاقات المسموحة.
    - استخراج قيمة `nexora_csrf` من `document.cookie` وتضمينها تلقائياً في ترويسة `X-CSRF-Token` لكافة الطلبات التغييرية.
    - إضافة دالة `getMe()` لاستعادة بيانات المستخدم الحالي تلقائياً من خادم الويب بدون الحاجة لـ localStorage.
  - **في واجهة المستخدم (`src/App.tsx` & `src/components/Header.tsx`)**:
    - استدعاء `apiClient.getMe()` عند التحميل الأولي لاستعادة الجلسة المشفرة.
    - إضافة متغير حالة `isSessionLoading` لمنع وميض شاشة تسجيل الدخول أثناء استعادة الجلسة.

---

### [P0.4] Bcrypt Cost 12 & Full Session Revocation (`server/routes/auth.ts`, `server/db/*`)
- **المشكلة السابقة**: كانت جولات Bcrypt مضبوطة على معامل التكلفة 10 (Cost 10)، ولم تكن هناك آلية لإبطال الجلسات النشطة للمستخدم على الأجهزة الأخرى عند تغيير كلمة المرور.
- **التعديل الهندسي**:
  - رفع ثابت `BCRYPT_ROUNDS = 12` في مسارات التسجيل وتغيير كلمة المرور.
  - اختبار سرعة التجزئة في البيئة الحالية: استغرقت تجزئة كلمة المرور في Node 22 حوالي ~430ms، وهو معدل مثالي متوافق مع معايير OWASP لمنع هجمات التخمين دون التأثير على استجابة الخادم.
  - الحفاظ على التوافق التراجعي: دالة `bcrypt.compare` تفحص تلقائياً ترويسة التجزئة (`$2b$10$` أو `$2b$12$`) وتتحقق من كلمات المرور القديمة بنجاح تام.
  - **آلية إبطال الجلسات الشاملة (Universal Session Revocation)**:
    - إضافة جدول `user_token_revocations (user_id, revoked_before_timestamp)` في قاعدة البيانات، وبنية `Map<string, number>` في المستودع المحلي.
    - عند تغيير كلمة المرور، يتم استدعاء `db.revokeAllUserTokens(userId)` لحفظ الطابع الزمني للعملية.
    - في وسيط المصادقة `server/middleware/auth.ts`، يتم التحقق من `decoded.iat` (وقت إصدار الرمز)، فإذا كان صادراً قبل طابع الإبطال، يُرفض الطلب فوراً برمز 401 (`TOKEN_REVOKED_PASSWORD_CHANGED`)، مما يضمن خروج جميع الأجهزة فورياً.

---

### [P0.5] CORS Strict Domain Normalization & CSP Hardening (`server/app.ts`)
- **المشكلة السابقة**: كان التحقق من أصل CORS يستخدم `origin.endsWith('ashouracademy.com')`، مما قد يتيح لأصل مثل `https://attacker-ashouracademy.com` اجتياز الفحص. كما احتوت ترويسة Content-Security-Policy على `'unsafe-eval'`.
- **التعديل الهندسي**:
  - استبدال المطابقة الضعيفة بقائمة بيضاء صريحة وتعبير نمطي دقيق:
    - الأصول المسموحة: `https://ashouracademy.com`، `https://nexora.ashouracademy.com`، والمطابقة التعبيرية للنطاقات الفرعية الدقيقة:
      `^https:\/\/([a-zA-Z0-9-]+\.)*ashouracademy\.com$`
    - حظر أي أصول مخادعة مثل `evil-ashouracademy.com` أو النطاقات غير المصرح بها برمز 403 `CORS_FORBIDDEN`.
  - إزالة `'unsafe-eval'` من توجيه `script-src` في `Content-Security-Policy` لتعزيز الحماية ضد هجمات DOM XSS.
  - التأكيد على حذف ترويسة `x-powered-by` لمنع تسريب تقنيات الخادم.
