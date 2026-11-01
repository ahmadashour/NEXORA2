# NEXORA — PHASE 5 / P1.4.7: API Mapping & Contracts Document
## توثيق تعيين المسارات والعقود بين الخادم والواجهة لقسم الدعم الفني والتواصل

### 1. مسارات الدعم الفني المعتمدة في Backend

| المسار (Endpoint) | الطريقة (Method) | المصادقة (Auth) | الصلاحيات (Roles) | الغرض |
|---|---|---|---|---|
| `/api/v1/support/inquiries` | `POST` | اختيارية (Guest allowed) | الكل (زائر أو مسجل) | إرسال استفسار جديد وربطه بالمستخدم إن كان مصادقاً |
| `/api/v1/support/inquiries` | `GET` | إلزامية (Bearer / Cookie) | الكل (حسب العزل) | استرجاع استفسارات المستخدم فقط (أو الكل للمشرف) |
| `/api/v1/support/inquiries/:id` | `GET` | إلزامية (Bearer / Cookie) | المالك أو المشرف | استرجاع تفاصيل استفسار مع منع IDOR |
| `/api/v1/support/inquiries/:id/status` | `PATCH` | إلزامية (Bearer / Cookie) | LEAD, ADMIN, PRO | تحديث حالة الاستفسار وتعيين ملاحظات الدعم والموظف |

---

### 2. تفاصيل العقود والتحويلات (Data Contracts & Field Transformations)

#### أ. تحويل بيانات النموذج في الواجهة إلى طلب الخادم
| حقل النموذج (Form Field) | حقل الخادم (API Body Field) | النوع والقيود | التحويل والمعالجة |
|---|---|---|---|
| `name` | `full_name` | `string` (2 - 150 chars) | إزالة الفراغات الزائدة والتعقيم |
| `email` | `email` | `string` (valid email) | تحويل للأحرف الصغيرة `toLowerCase()` |
| `subject` | `subject` | `string` (max 200 chars) | نص الموضوع المختار أو المكتوب |
| `message` | `message` | `string` (5 - 3000 chars) | نص الاستفسار مع التحقق من الطول |
| `phone` | `phone` | `string \| null` (max 30) | اختياري |
| `portalCode` | `portal_code` | `string \| null` (max 50) | تحويل للأحرف الكبيرة `toUpperCase()` |

#### ب. استجابة الخادم لإنشاء الاستفسار (CreateInquiryApiResponse)
```typescript
interface BackendSupportInquiry {
  id: string;
  user_id: string | null;     // null للزائر أو المعرف للمسجل
  full_name: string;
  email: string;
  phone: string | null;
  subject: string;
  message: string;
  portal_code: string | null;
  status: 'received' | 'in_progress' | 'resolved' | 'closed';
  admin_notes?: string | null;
  assigned_to?: string | null;
  created_at: string;
  updated_at?: string;
}
```

#### ج. تعريب الحالات والشارات
| كود الحالة في الخادم | النص العربي المعتمد | نمط الشارة (Tailwind Badge) |
|---|---|---|
| `received` | **تم الاستلام** | `text-sky-700 bg-sky-50 border-sky-200` |
| `in_progress` | **قيد المتابعة** | `text-amber-700 bg-amber-50 border-amber-200` |
| `resolved` | **تم الحل** | `text-emerald-700 bg-emerald-50 border-emerald-200` |
| `closed` | **مغلق** | `text-slate-600 bg-slate-100 border-slate-200` |

---

### 3. خريطة استجابات الأخطاء (Error Mapping)

| كود HTTP | رمز الخطأ في الخادم | الرسالة المعربة للواجهة |
|---|---|---|
| `400` | `VALIDATION_FAILED` | يرجى التأكد من ملء جميع الحقول الإجبارية بشكل صحيح. |
| `400` | `INVALID_EMAIL_FORMAT` | صيغة البريد الإلكتروني المدخلة غير صحيحة. |
| `400` | `INVALID_NAME` | يرجى إدخال اسم صحيح مكون من حرفين على الأقل. |
| `400` | `MESSAGE_TOO_SHORT` | يرجى كتابة تفاصيل كافية للاستفسار (5 أحرف على الأقل). |
| `400` | `INVALID_STATUS` | حالة الاستفسار غير صحيحة. |
| `401` | `UNAUTHORIZED` | يرجى تسجيل الدخول للوصول إلى استفساراتك. |
| `403` | `FORBIDDEN_IDOR` | ليس لديك صلاحية للاطلاع على استفسارات مستخدمين آخرين. |
| `403` | `FORBIDDEN` | غير مصرح لك بإجراء هذه العملية الإدارية. |
| `404` | `INQUIRY_NOT_FOUND` | طلب الاستفسار غير موجود. |
| `429` | `RATE_LIMIT_EXCEEDED` | تم تجاوز الحد المسموح للمحاولات، يرجى الانتظار قليلاً. |
| `503` | `DATABASE_UNAVAILABLE` | خدمة الدعم الفني غير متوفرة حالياً، يرجى المحاولة لاحقاً. |
