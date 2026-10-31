# NEXORA — PHASE 5 / P1.4.6: CAPACITY & BOOKING REPORT
## Seat Quota Calculation, Concurrency Control & Booking Lifecycle

**Date:** October 31, 2026  
**Status:** APPROVED — STRICTLY VERIFIED  
**Phase:** Phase 5 / P1.4.6  

---

### 1. Client-Side Capacity Calculation Discipline

#### A. Formula & Constraints
The remaining seats displayed across the user interface are calculated strictly using the helper function `computeSeatsLeft`:
$$\text{seatsLeft} = \max(0, \text{seats\_capacity} - \text{seats\_booked})$$

```typescript
export function computeSeatsLeft(
  capacity: number | null | undefined,
  booked: number | null | undefined
): number {
  const cap = typeof capacity === 'number' && !isNaN(capacity) && isFinite(capacity) ? Math.max(0, capacity) : 0;
  const bkd = typeof booked === 'number' && !isNaN(booked) && isFinite(booked) ? Math.max(0, booked) : 0;
  return Math.max(0, cap - bkd);
}
```

#### B. Architectural Authority Notice
- **Presentation-Only Role**: The value of `seatsLeft` computed on the frontend is strictly for rendering indicators (e.g. `متبقي 32 مقعد`, `اكتملت المقاعد`).
- **Database Authority**: The frontend never makes authoritative decisions on admitting a registration based on the client calculation. PostgreSQL and the backend transaction locks (`SELECT ... FOR UPDATE` in `contentRepository.ts`) are the single source of truth for seat allocation and concurrency.

---

### 2. Registration & Concurrency Control

#### A. Rapid-Click Mutex Lock (`isActionPending`)
To prevent duplicate network requests caused by users double-clicking the registration button:
1. When the user clicks "التسجيل في الفعالية", `isActionPending` is set to `true`.
2. The button is immediately disabled and displays an inline spinner (`جاري التسجيل...`).
3. Subsequent clicks while a request is in flight are rejected instantly without generating additional HTTP traffic.
4. `isActionPending` is guaranteed to reset in the `finally` block regardless of request outcome.

#### B. False Positive Defense
- The UI never optimistically renders a confirmed registration before the backend returns `201 Created`.
- If an HTTP 401, 403, 404, 409, 429, or 503 is returned, local registration state remains `false`, booked seats are not incremented, and the explicit error message is displayed.

---

### 3. Cancellation Lifecycle

#### A. User Confirmation Gate
Before invoking `DELETE /api/v1/events/:id/register`, the modal prompts the user with an explicit confirmation step ("تأكيد الإلغاء؟" / "تراجع") to avoid accidental cancellations.

#### B. Server-Confirmed State Reversal
- Cancellation is processed exclusively via `eventsService.cancelRegistration(id)`.
- Upon `200 OK`, `isRegisteredByMe` transitions to `false` and `seatsBooked` is decremented by 1.
- If the server returns `404 REGISTRATION_NOT_FOUND` or any other error, the client does NOT fake local cancellation; the error is displayed directly.
