# NEXORA — PHASE 2.2.1
## IDOR Security & Authorization Review
### Independent Read-Only Audit Report

**المستودع:** NEXORA | AI Studio Isolated Environment  
**تاريخ الفحص:** 2 نوفمبر 2026  
**طبيعة المهمة:** فحص أمني مستقل ومحايد (STRICT READ-ONLY)  
**حالة الشيفرة المفحوصة:** الفرع الحالي المعزول  
**القرار الأولي للبند:** ❌ **NOT VERIFIED / FAILED (الملفات غير موجودة)**

---

## 1. أهداف نطاق الفحص
التحقق المستقل والصارم من الادعاءات الخاصة بتأمين مساحة المعلم (Teacher Workspace) ضد ثغرات التخويل وانتحال الهوية والوصول المباشر غير الآمن للكائنات (IDOR - Insecure Direct Object Reference) في عمليات الفصول والطلاب والحضور.

المتطلبات الإلزامية الخاضعة للمراجعة:
1. استخراج هوية المعلم (`teacherId` أو `userId`) حصرًا من الجلسة الموثوقة والموقعة (`req.user.id`).
2. منع قبول أي `teacherId` بديل أو ممرر عبر body أو query أو params لتفادي انتحال الهوية أو الالتفاف على الصلاحيات.
3. التحقق الإلزامي من ملكية المعلم لكل مورد (الفصل الدراسي، قائمة الطلاب، جلسة الحضور، سجل الحضور) قبل أي استعلام أو تعديل أو حذف.
4. عزل البيانات المتعددة المستأجرين (Multi-tenant Teacher Isolation) لمنع أي معلم من قراءة أو تغيير فصول أو حضور معلم آخر.
5. قصر صلاحيات مساحة المعلم على الأدوار المخولة (`TEACH`, `PRO`, `LEAD`, `ADMIN`) والحظر المطلق لدور الطالب (`STUDENT`).

---

## 2. نتائج الفحص الميداني للشيفرة المصدرية

### 2.1 مسارات الخادم (Server Routes)
- **المسار المستهدف:** `/server/routes/teacher.ts`
- **النتيجة الفعلية:** **الملف غير موجود إطلاقاً (FILE DOES NOT EXIST)**.
- **فحص تكوين الخادم (`/server/app.ts`):**
  - المسارات المثبتة فعلياً في التطبيق:
    - `/api/v1/health`
    - `/api/v1/auth`
    - `/api/v1/users`
    - `/api/v1/portals`
    - `/api/v1/ai`
  - المسار `/api/v1/teacher` **غير مسجل وغير مربوط**.
  - أي طلب يوجه إلى `/api/v1/teacher/*` يقابل تلقائياً برد `404 Not Found` ورسالة خطأ `ENDPOINT_NOT_FOUND`.

### 2.2 مستودع التخزين وقاعدة البيانات (Repository Layer)
- **المسار المستهدف:** `/server/db/repositories/teacherRepository.ts`
- **النتيجة الفعلية:** **المجلد `/server/db/repositories/` والملف غير موجودين إطلاقاً (DIRECTORY AND FILE DO NOT EXIST)**.
- المجلد `/server/db/` يحتوي فقط على:
  - `index.ts`
  - `postgres.ts`
  - `postgresRepository.ts`
  - `types.ts`
- لا يحتوي `postgresRepository.ts` على أي دوال متعلقة بالفصول أو سجلات الحضور أو الطلاب التابعين لمعلم محدد.

### 2.3 منظومة RBAC في الوسيط (`/server/middleware/auth.ts`)
- الوسيط `authenticateToken` يتحقق من صحة JWT وبيانات الجلسة للمسارات الحالية.
- مصفوفة الصلاحيات تدعم التحقق من الأدوار، ولكن نظراً لعدم وجود مسارات المعلم (`server/routes/teacher.ts`)، فإن أي وسيط لمنع الطالب `STUDENT` أو حصر المسار على `TEACH` **غير مفعل وغير مطبق لعدم وجود نقطة النهاية الأصلية**.

---

## 3. جدول التحقق التفصيلي من ضوابط IDOR

| البند الرقابي | المتطلب الأمني | النتيجة الفعلية في المستودع | التصنيف |
| :--- | :--- | :--- | :--- |
| **IDOR-01** | استخراج معرف المعلم من Session/JWT فقط | الملف `server/routes/teacher.ts` غير موجود | ❌ **NOT VERIFIED** |
| **IDOR-02** | رفض أي `teacherId` في Client Payload | لا توجد معالجات طلبات للتحقق منها | ❌ **NOT VERIFIED** |
| **IDOR-03** | التحقق من ملكية الفصل (`class.teacher_id === req.user.id`) | لا توجد استعلامات لقاعدة البيانات | ❌ **NOT VERIFIED** |
| **IDOR-04** | عزل بيانات الحضور بين المعلمين | لا توجد جداول أو كود لعزل السجلات | ❌ **NOT VERIFIED** |
| **IDOR-05** | حظر دور `STUDENT` من استدعاء API المعلم | المسار بأكمله غير موجود (يعيد 404) | ❌ **NOT VERIFIED** |
| **IDOR-06** | منع التعديل الأفقي للصلاحيات بين المعلمين | الكود البرمجي لم يُكتب بعد | ❌ **NOT VERIFIED** |

---

## 4. تقييم المخاطر والثغرات
1. **ادعاء الإنجاز الزائف:** إن ادعاء اكتمال معالجة IDOR في المرحلة P2.2 دون وجود الكود البرمجي يمثل خطراً تشغيلياً جسيماً يضلل التدقيق الأمني.
2. **غياب خطوط الدفاع الأساسية:** عند الشروع الفعلي في كتابة كود P2.2، يجب إلزام المطورين بالنمط الصارم:
   ```typescript
   // النمط الإلزامي المطلوب تحقيقه في P2.2:
   const teacherId = req.user.id; // من الجلسة الموثوقة فقط
   if (req.body.teacherId && req.body.teacherId !== teacherId) {
     return res.status(403).json({ error: 'FORBIDDEN_TEACHER_ID_SPOOFING' });
   }
   const classObj = await teacherRepository.getClassById(classId, teacherId);
   if (!classObj) {
     return res.status(404).json({ error: 'CLASS_NOT_FOUND_OR_UNAUTHORIZED' });
   }
   ```

---

## 5. الخلاصة والتوصية
- **الحكم على بند IDOR:** ❌ **NOT VERIFIED / FAILED**.
- **السبب:** غياب كامل للملفات البرمجية (`server/routes/teacher.ts`, `server/db/repositories/teacherRepository.ts`).
- **الإجراء التصحيحي:** رفض اعتماد المرحلة P2.2، وإلزام فريق التطوير بكتابة الشيفرة وفق المواصفات المعمارية لـ P2.1 قبل طلب أي اعتماد جديد.
