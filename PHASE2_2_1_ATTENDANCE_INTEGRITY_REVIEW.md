# NEXORA — PHASE 2.2.1
## Attendance Data Integrity & Concurrency Review
### Independent Read-Only Audit Report

**المستودع:** NEXORA | AI Studio Isolated Environment  
**تاريخ الفحص:** 2 نوفمبر 2026  
**طبيعة المهمة:** فحص أمني وتكاملي مستقل (STRICT READ-ONLY)  
**حالة الشيفرة المفحوصة:** الفرع الحالي المعزول  
**القرار الأولي للبند:** ❌ **NOT VERIFIED / FAILED (المخطط والكود غير موجودين)**

---

## 1. أهداف نطاق الفحص
التحقق المستقل من سلامة معمارية رصد الحضور والغياب للطلاب في مساحة المعلم، ومراجعة الضوابط الهندسية التالية:
1. **منع التكرار على مستوى قاعدة البيانات (Database Constraints):**
   وجود قيود فريدة (`UNIQUE KEY` أو `EXCLUSION CONSTRAINT`) تمنع تسجيل الطالب نفسه مرتين في الحصة نفسها أو في نفس اليوم والجلسة.
2. **العمليات الذرية المتكاملة (Atomic Database Transactions):**
   تنفيذ رصد الحضور الجماعي للفصل كعملية ذرية واحدة (`BEGIN ... COMMIT`) تتراجع بالكامل (`ROLLBACK`) في حال فشل تسجيل أي طالب لتفادي الحالات الجزئية وتناقض البيانات.
3. **التعامل مع التزامن وحالات السباق (Race Conditions & Concurrency):**
   حماية السجلات ضد التعديل المتزامن (مثل استخدام `ON CONFLICT (session_id, student_id) DO UPDATE` أو Optimistic Locking).
4. **دعم الحالات التربوية الأربع للحضور:**
   - حاضر (`PRESENT` / حاضر)
   - غائب (`ABSENT` / غائب)
   - متأخر (`LATE` / متأخر)
   - معذور (`EXCUSED` / معذور)

---

## 2. نتائج الفحص الميداني للمخطط والشيفرة

### 2.1 فحص ملفات ترحيل قاعدة البيانات (`db/migrations/`)
- تم فحص مجلد الترحيلات `db/migrations/`:
  - الملف الوحيد الموجود هو: `001_core_schema.sql`.
  - لا توجد أي ترحيلات لاحقة مثل `002`, `003`, أو `004_teacher_workspace.sql`.
- الجداول المنشأة في `001_core_schema.sql`:
  - `roles`
  - `permissions`
  - `role_permissions`
  - `users`
  - `user_profiles`
  - `activity_logs`
  - `revoked_tokens`
- **جداول مساحة المعلم غير موجودة إطلاقاً:**
  - جدول الفصول (`classes` أو `teacher_classes`): **غير موجود**.
  - جدول ربط الطلاب بالفصول (`class_students`): **غير موجود**.
  - جدول جلسات الحضور (`attendance_sessions`): **غير موجود**.
  - جدول سجلات الحضور الفردية (`attendance_records`): **غير موجود**.

### 2.2 فحص منطق المعاملات الذرية والتزامن
- تم فحص `server/db/postgresRepository.ts` و`server/db/postgres.ts`:
  - لا توجد أي دوال لمعاملات الحضور (`recordAttendanceBatch`, `updateAttendanceRecord`).
  - لا توجد استعلامات تستخدم `BEGIN`, `COMMIT`, `ROLLBACK` أو `pg.Client.query('BEGIN')` خاصة بنظام الحضور.
  - لا توجد قيود لمنع تكرار الحضور لأن الجداول غير معرفة أصلاً.

---

## 3. جدول التحقق التفصيلي من سلامة الحضور

| البند الرقابي | المتطلب الأمني والهندسي | النتيجة الفعلية في المستودع | التصنيف |
| :--- | :--- | :--- | :--- |
| **ATT-01** | جداول الحضور والفصول في PostgreSQL DDL | غير موجودة في أي Migration | ❌ **NOT VERIFIED** |
| **ATT-02** | قيد فريد يمنع تكرار الطالب في نفس الجلسة | غير موجود في قاعدة البيانات | ❌ **NOT VERIFIED** |
| **ATT-03** | الحفظ الجماعي كمعاملة ذرية (`BEGIN / COMMIT / ROLLBACK`) | لا توجد دوال خادم لهذا الغرض | ❌ **NOT VERIFIED** |
| **ATT-04** | استراتيجية التزامن والتصادم (`ON CONFLICT DO UPDATE`) | الكود غير موجود | ❌ **NOT VERIFIED** |
| **ATT-05** | التحقق الصارم من الحالات الأربع (`PRESENT`, `ABSENT`, `LATE`, `EXCUSED`) | الكود غير موجود | ❌ **NOT VERIFIED** |
| **ATT-06** | التحقق من انتماء الطالب للفصل قبل رصد الحضور | الكود غير موجود | ❌ **NOT VERIFIED** |

---

## 4. المخطط المرجعي الإلزامي لمعالجة هذا البند مستقبلاً
عند تنفيذ المرحلة P2.2 فعلياً، يجب اعتماد مخطط DDL يضمن السلامة المرجعية والتزامنية كالتالي:
```sql
-- جلسات الحضور
CREATE TABLE IF NOT EXISTS attendance_sessions (
    id VARCHAR(50) PRIMARY KEY,
    class_id VARCHAR(50) NOT NULL REFERENCES classes(id) ON DELETE CASCADE,
    teacher_id VARCHAR(50) NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
    session_date DATE NOT NULL,
    session_period INT DEFAULT 1,
    created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_class_session_date_period UNIQUE (class_id, session_date, session_period)
);

-- سجلات الحضور مع منع التكرار قطيعاً
CREATE TABLE IF NOT EXISTS attendance_records (
    id VARCHAR(50) PRIMARY KEY,
    session_id VARCHAR(50) NOT NULL REFERENCES attendance_sessions(id) ON DELETE CASCADE,
    student_id VARCHAR(50) NOT NULL REFERENCES class_students(id) ON DELETE CASCADE,
    status VARCHAR(20) NOT NULL CHECK (status IN ('PRESENT', 'ABSENT', 'LATE', 'EXCUSED')),
    notes TEXT,
    updated_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT uq_session_student UNIQUE (session_id, student_id)
);
```

---

## 5. الخلاصة والتوصية
- **الحكم على بند سلامة الحضور والعمليات المتزامنة:** ❌ **NOT VERIFIED / FAILED**.
- **السبب:** غياب كامل لمخطط قاعدة البيانات DDL الخاص بالحضور، وغياب دوال المعاملات الذرية والوسيط البرمجي.
- **الإجراء التصحيحي:** رفض أي ادعاء بجاهزية نظام الحضور وإلزام فريق العمل بإنشاء Migration مخصص ومختبر قبل الانتقال إلى أي مرحلة تالية.
