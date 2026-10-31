# NEXORA — Phase 5 / P1.4.2: Data Adapters Layer Specification

## 1. Architectural Role & Boundary

The Data Adapters layer located in `src/services/adapters/` establishes an independent, decoupled transformation boundary between:
1. **Backend REST DTOs (`src/types/contracts.ts`):** Representing raw PostgreSQL relations and Express route representations (snake_case, database IDs, storage URLs, raw timestamps).
2. **Frontend View Models (`src/types/`):** Consumed by React components, modals, and display cards (camelCase, formatted Arabic strings, computed badges, unified category representations).

### Strict Boundary Rules:
- **Zero UI Edits in P1.4.2:** No React JSX, Tailwind CSS, or component layouts were touched.
- **Mock Data Preserved:** `src/data/mockData.ts` remains intact and unmodified.
- **Anti-Fabrication Policy:** Adapters never invent artificial entity names (e.g., schools, districts) when omitted in backend responses.
- **Path Concealment:** Adapters sanitize raw server disk paths to prevent security disclosure.

---

## 2. Adapter Specifications

### A. Community Adapter (`communityAdapter.ts`)
Converts backend community posts and comments to frontend models.

- **`adaptCommunityPostFromBackend(dto: BackendCommunityPostDTO): CommunityPost`**
  - Mappings:
    - `author_name` -> `author.name`
    - `author_role` -> `author.role`
    - `author.school` & `author.district`: Clean neutral defaults (`'مدرسة معتمدة'`, `'المملكة العربية السعودية'`) without fabricating specific false school names.
    - `grade_level` -> `grade`
    - `likes_count` -> `likes`
    - `bookmarks_count` -> `saves`
    - `created_at` -> `publishedDate` (formatted via `formatArabicDate()` e.g. "منذ ساعتين", "أمس", etc.)
    - `summary`: Uses `dto.summary` if present, or truncates first 150 characters of `dto.content`.
- **`adaptCreatePostPayload(input): CreatePostPayload`**
  - Maps frontend `grade` -> `grade_level`
  - Computes `summary` automatically if omitted by user form.
- **`adaptCommentFromBackend(dto: BackendCommentDTO): AdaptedComment`**
  - Maps `author_name` & `author_role` to nested author object with fallback avatar.

---

### B. Library Adapter (`libraryAdapter.ts`)
Converts backend library resource records to `LibraryResourceViewModel`.

- **`formatBytes(bytes: number): string`**
  - Converts raw byte numbers into clean units (`B`, `KB`, `MB`, `GB`).
- **`sanitizeDownloadUrl(resourceId: string, rawUrl?: string): string`**
  - **Storage Path Leak Defense:** If `rawUrl` starts with `/uploads/` or contains disk identifiers, it is automatically sanitized to `/api/v1/library/resources/:id/download`.
- **`adaptLibraryResourceFromBackend(dto: BackendLibraryResourceDTO): LibraryResourceViewModel`**
  - Mappings:
    - `file_type` -> `fileType` (formatted to uppercase e.g. `PDF`)
    - `file_size_bytes` -> `fileSizeFormatted` (via `formatBytes`)
    - `grade_level` -> `grade`
    - `downloads_count` -> `downloadsCount`
    - `views_count` -> `viewsCount`
    - `publisher_name` -> `publisher`
    - `created_at` -> `publishedDate`

---

### C. Content Adapter (`contentAdapter.ts`)
Converts backend content items into `UnifiedContentViewModel` and legacy `ContentItem`.

- **`adaptContentItemFromBackend(dto: BackendContentItemDTO): UnifiedContentViewModel`**
  - Unifies articles, videos, announcements, and news into a standardized view model.
  - Generates Arabic category labels (`'مقال تربوي'`, `'فيديو تعليمي'`, `'أخبار تربوية'`).
  - Automatically adapts nested `event_detail` if present.
  - Normalizes read time / duration.
- **`adaptContentItemToLegacy(dto: BackendContentItemDTO): ContentItem`**
  - Provides 100% backward compatibility for existing UI sections (`LatestContentSection`, `ContentDetailModal`).

---

### D. Events Adapter (`eventsAdapter.ts`)
Converts event details into `EventDetailViewModel` and legacy `ContentItem`.

- **`computeSeatsLeft(capacity: number, booked: number): number`**
  - Enforces non-negative lower bound: `Math.max(0, capacity - booked)`.
  - **ARCHITECTURAL NOTICE:**
    Client-side computation of `seatsLeft` is strictly for UI display and badge rendering. Concurrency control and seat quotas are guaranteed atomically by PostgreSQL database transactions (`FOR UPDATE` locking in `registerForEvent`).
- **`mapLocationType(type: string): 'عن بُعد عبر Teams' | 'حضوري' | 'هجين'`**
  - Localizes backend enum to Arabic UI badges.
- **`adaptEventDetailFromBackend(dto: BackendEventDetailDTO): EventDetailViewModel`**
  - Mappings:
    - `duration_minutes` -> `durationFormatted` (`"${min} دقيقة"`)
    - `seats_capacity` -> `seatsCapacity`
    - `seats_booked` -> `seatsBooked`
    - `seatsLeft` -> computed via `computeSeatsLeft`
    - `is_registered_by_me` -> `isRegisteredByMe`
    - `isFullyBooked` -> `seatsLeft <= 0`

---

### E. Support Adapter (`supportAdapter.ts`)
Converts user inquiry forms into backend submission payloads.

- **`adaptCreateInquiryPayload(input: FrontendInquiryInput): CreateInquiryPayload`**
  - Mappings:
    - Frontend `name` -> Backend `full_name`
    - Trims and lowercases `email`
    - Maps `portalCode` -> `portal_code`
    - Trims `message` and `subject`
- **`adaptInquiryResponse(dto: BackendContactInquiryDTO): AdaptedInquiryResponse`**
  - Formats ticket response with localized creation date and status badge.

---

## 3. Barrel Export
All adapters, conversion helpers, and underlying contracts are exported through `src/services/adapters/index.ts`, creating a clean single import point for future UI integration phases.
