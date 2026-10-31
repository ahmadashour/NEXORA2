# NEXORA — PHASE 5 / P1.4.6: API MAPPING REPORT
## Events REST API Contract & DTO-to-ViewModel Transformation Reference

**Date:** October 31, 2026  
**Status:** APPROVED — STRICTLY VERIFIED  
**Phase:** Phase 5 / P1.4.6  

---

### 1. Active REST Endpoints Reference

| HTTP Method | Route | Authorization | Description |
|---|---|---|---|
| `GET` | `/api/v1/events` | Optional Auth | Retrieves paginated list of published events (`category = 'event'`). Query parameters: `page`, `limit`, `subject`, `grade_level`, `search`. |
| `GET` | `/api/v1/events/:id` | Optional Auth | Retrieves single event details and attached content item. Checks both event detail ID and content item ID. |
| `POST` | `/api/v1/events/:id/register` | Auth Required (`authMiddleware`) + Rate Limiter (`apiWriteLimiter`) | Registers authenticated user for the event atomically. Checks capacity and duplicate registration in a transaction. |
| `DELETE` | `/api/v1/events/:id/register` | Auth Required (`authMiddleware`) | Cancels registration and decrements booked seats atomically. Returns 404 if no active registration exists. |

---

### 2. DTO to View Model Transformation Matrix

The transformation between `BackendEventDetailDTO` and `EventDetailViewModel` is managed through `adaptEventDetailFromBackend` in `src/services/adapters/eventsAdapter.ts`:

| Backend DTO Field (`BackendEventDetailDTO`) | Frontend View Model (`EventDetailViewModel`) | Transformation / Business Rule |
|---|---|---|
| `id: string` | `id: string` | Direct 1:1 mapping |
| `event_date: string` | `eventDate: string` | Localized via `formatArabicDate` (`Intl.DateTimeFormat('ar-SA')`) |
| `event_date: string` | `eventTime: string` | Extracted via `formatArabicTime` (`Intl.DateTimeFormat('ar-SA', { hour, minute })`) |
| `duration_minutes: number` | `durationFormatted: string` | Formatted as `${dto.duration_minutes || 60} دقيقة` |
| `location_type: 'virtual' \| 'in_person' \| 'hybrid'` | `locationTypeFormatted: string` | Mapped to `'عن بُعد عبر Teams'` \| `'حضوري'` \| `'هجين'` |
| `location_address: string \| null` | `locationAddress: string` | Preserves actual string or returns default platform location for virtual sessions; no synthetic address fabricated |
| `speaker_name: string` | `speakerName: string` | Preserved directly; empty string if absent (anti-fabrication rule) |
| `speaker_title: string \| null` | `speakerTitle: string` | Preserved directly; empty string if absent (anti-fabrication rule) |
| `seats_capacity: number` | `seatsCapacity: number` | Number coerced; fallback to 0 if null, undefined, or NaN |
| `seats_booked: number` | `seatsBooked: number` | Number coerced; fallback to 0 if null, undefined, or NaN |
| *(computed)* | `seatsLeft: number` | Calculated via `computeSeatsLeft(seats_capacity, seats_booked)` = `Math.max(0, capacity - booked)` |
| *(computed)* | `isFullyBooked: boolean` | `seatsLeft <= 0` |
| `is_registered_by_me?: boolean` | `isRegisteredByMe: boolean` | Boolean coerced from backend query `SELECT 1 FROM event_registrations` |

---

### 3. Error Code Translation Table

| HTTP Status | Backend Error Code | UI Behavior / Displayed Message |
|---|---|---|
| `401 Unauthorized` | `UNAUTHORIZED` | "يجب تسجيل الدخول أولاً لإتمام التسجيل في الفعالية الأكاديمية" |
| `403 Forbidden` | `FORBIDDEN_EVENT_MANAGE` | "إنشاء أو تعديل الفعاليات الأكاديمية مقصور على القيادات ورؤساء الأقسام" |
| `404 Not Found` | `EVENT_NOT_FOUND` | "الفعالية المطلوبة غير موجودة أو لم تعد متاحة" |
| `404 Not Found` | `REGISTRATION_NOT_FOUND` | "لم يتم العثور على تسجيل نشط لك في هذه الفعالية" |
| `409 Conflict` | `ALREADY_REGISTERED` | "أنت مسجل بالفعل في هذه الفعالية" |
| `409 Conflict` | `EVENT_CAPACITY_EXCEEDED` | "عذراً، اكتملت سعة المقاعد المتاحة لهذه الفعالية" |
| `429 Rate Limited` | `RATE_LIMIT_EXCEEDED` | "تم تجاوز الحد المسموح من الطلبات، يرجى الانتظار قليلاً ثم المحاولة" |
| `503 Service Unavailable`| `DATABASE_UNAVAILABLE` | "قاعدة بيانات PostgreSQL الدائمة غير متوفرة أو غير متصلة في بيئة الإنتاج" |
