# NEXORA — PHASE 5 / P1.4.7: Support & Contact UI Integration
## ربط واجهات الدعم الفني والتواصل بالخادم وقاعدة البيانات — تقرير المعمارية والتكامل الفعلي

**تاريخ التنفيذ:** 1 نوفمبر 2026  
**الفرع العامل:** `production-remediation`  
**الحالة:** معتمد ومنجز بالكامل بنسبة نجاح 100%  
**النطاق:** واجهة التواصل (`ContactModal`)، خدمات الدعم (`supportService`)، الخطافات (`useSupport`)، المحولات (`supportAdapter`)، والعقود (`contracts.ts`).

---

### 1. ملخص المعمارية والتكامل
تم إنجاز تكامل واجهات الدعم الفني والتواصل (Support & Contact) في منصة NEXORA مع الـ RESTful APIs الموجودة في Backend وفق الضوابط الصارمة لـ PHASE 5، دون إجراء أي تعديل على الخادم أو قاعدة البيانات أو الـ Schema أو المسارات المعتمدة:

```
[ Frontend: React 19 + Tailwind CSS ]
   │
   ├── ContactModal.tsx (نموذج إرسال الاستفسار، تبويب سجل الاستفسارات، حماية الإرسال المكرر، الاحتفاظ بالمدخلات عند الخطأ)
   │
   ▼
[ React Hook: src/hooks/useSupport.ts ]
   │ (إدارة الحالة، التحقق من المدخلات، جلب السجل، وتحديث الحالات للمشرفين)
   │
   ▼
[ Service Layer: src/services/supportService.ts ]
   │ (اتصال RESTful بـ /api/v1/support/inquiries عبر apiClient، دعم الجلسات، CSRF، وتفادي الـ Mock)
   │
   ▼
[ Adapters & Contracts: src/services/adapters/supportAdapter.ts & src/types/contracts.ts ]
   │ (تحويل الحقول name -> full_name، تعريب الحالات، توحيد الألوان، وتوليد رسائل الخطأ العربية)
   │
   ▼
[ Backend REST API: /api/v1/support/inquiries ]
   ├── POST   /api/v1/support/inquiries (إرسال استفسار جديد للزائر أو المستخدم المصادق)
   ├── GET    /api/v1/support/inquiries (استرجاع الاستفسارات مع حماية صارمة لـ IDOR)
   ├── GET    /api/v1/support/inquiries/:id (استرجاع تفاصيل استفسار مع التحقق من المالك أو المشرف)
   └── PATCH  /api/v1/support/inquiries/:id/status (تحديث الحالة وملاحظات الدعم من قبل LEAD/ADMIN/PRO)
```

---

### 2. الملفات المنفذة والمحدثة
1. `src/types/contracts.ts`:
   - إضافة عقود الاستفسارات (`BackendSupportInquiry`, `SupportInquiryPayload`, `SupportInquiryUI`, `InquiryFilters`, `UpdateInquiryStatusPayload`).
2. `src/services/adapters/supportAdapter.ts`:
   - تحويل حقول النموذج (`name` إلى `full_name`، `portalCode` إلى `portal_code`)، وتعريب حالات الاستفسارات (`received` إلى "تم الاستلام"، `in_progress` إلى "قيد المتابعة"، `resolved` إلى "تم الحل"، `closed` إلى "مغلق")، وتعيين ألوان الشارات وتنسيق التاريخ والوقت وترجمة رسائل الأخطاء.
3. `src/services/adapters/index.ts`:
   - تصدير محول الدعم `supportAdapter`.
4. `src/services/supportService.ts`:
   - تنفيذ دوال الاتصال بالخادم (`submitInquiry`, `getInquiries`, `getInquiryById`, `updateInquiryStatus`) باستخدام `apiClient` مع تضمين ترويسات المصادقة والكوكيز ورمز CSRF.
5. `src/hooks/useSupport.ts`:
   - خطاف React متكامل لإدارة تقديم الاستفسارات مع التحقق المحلي، ومنع الإرسال المزدوج، وجلب سجل الاستفسارات، وإدارة حالات الطلب للمشرفين.
6. `src/components/modals/ContactModal.tsx`:
   - استبدال المحاكاة الصورية القديمة بطلب حقيقي للـ API.
   - إضافة تبويب "سجل استفساراتي" التفاعلي للمستخدم المسجل لعرض طلباته وحالاتها وردود فريق الدعم عليها.
   - منع الإرسال المكرر أثناء معالجة الطلب، والاحتفاظ بمدخلات النموذج كاملة في حال حدوث أي خطأ في الشبكة أو التحقق.
7. `test/phase5_p1_4_7_support_integration.test.ts`:
   - جناح اختبار شامل يضم 22 سيناريو اختبار غطت التحويلات والمصادقة والتحقق من المدخلات وعزل IDOR وإدارة المشرفين وحالات 400/401/403/404.
