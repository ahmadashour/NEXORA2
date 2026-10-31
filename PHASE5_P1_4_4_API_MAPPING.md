# NEXORA — PHASE 5 / P1.4.4: API MAPPING SPECIFICATION
## Comprehensive DTO-to-ViewModel Contract Mapping

**Date:** October 31, 2026  
**Status:** VERIFIED & SEALED  
**Scope:** Digital Educational Library Module  

---

### 1. Endpoints & Protocol Mapping

| Method | Endpoint | Purpose | Authorization | Response Shape |
|---|---|---|---|---|
| `GET` | `/api/v1/library/resources` | List published resources with filtering & search | Optional / Guest allowed | `{ success: true, data: BackendLibraryResourceDTO[], pagination: ApiPaginationMeta }` |
| `GET` | `/api/v1/library/resources/:id` | Fetch single resource details by ID | Optional / Guest allowed | `{ success: true, resource: BackendLibraryResourceDTO }` |
| `POST` | `/api/v1/library/resources/:id/download` | Record download & return safe asset URL | Optional / Guest allowed | `{ success: true, downloadUrl: string, fileName: string, fileType: string, fileSizeBytes: number, downloadsCount: number }` |

---

### 2. Field-by-Field Contract Transformation Matrix

The table below documents the transformation executed by `adaptLibraryResourceFromBackend()` in `src/services/adapters/libraryAdapter.ts`:

| Backend DTO Field (`BackendLibraryResourceDTO`) | Database Type / Source | Frontend ViewModel (`LibraryResourceViewModel`) | Transformation / Sanitization Rule | Default Fallback Value |
|---|---|---|---|---|
| `id` | `uuid` / `string` | `id` (`string`) | Direct string pass-through | Empty string `""` |
| `title` | `text` / `varchar(255)` | `title` (`string`) | String trim, preserves Arabic characters | `""` |
| `description` | `text` / `nullable` | `description` (`string`) | Trimmed or empty string | `""` |
| `category` | `enum('books', 'worksheets', 'guides', 'research', 'curriculum')` | `category` (`string`) | Preserved canonical category | `'عام'` |
| `subject` | `varchar(100)` | `subject` (`string`) | Subject category (e.g. كيمياء, فيزياء) | `'علوم عامة'` |
| `grade_level` | `varchar(100)` | `grade` (`string`) | Educational stage / grade | `'المرحلة الثانوية'` |
| `publisher_name` | `varchar(255)` / `nullable` | `publisher` (`string`) | Publishing body or author | `'شبكة نكسورا التعليمية'` |
| `file_url` | `text` / internal path or external URL | `downloadUrl` (`string`) | Evaluated by `sanitizeDownloadUrl()`. Disk paths (`/uploads/`, `disk:`) mapped to `/api/v1/library/resources/${id}/download` | `/api/v1/library/resources/${id}/download` |
| `file_size_bytes` | `bigint` / `nullable` | `fileSizeFormatted` (`string`) | Formatted by `formatBytes(bytes)` into B, KB, MB, GB | `'1.5 MB'` |
| `file_type` | `varchar(50)` | `fileType` (`string`) | Transformed to uppercase (e.g., `'PDF'`) | `'PDF'` |
| `mime_type` | `varchar(100)` | `mimeType` (`string`) | MIME type descriptor | `'application/pdf'` |
| `downloads_count` | `integer` | `downloadsCount` (`number`) | Numeric coercion via `Number(dto.downloads_count) \|\| 0` | `0` |
| `views_count` | `integer` | `viewsCount` (`number`) | Numeric coercion via `Number(dto.views_count) \|\| 0` | `0` |
| `created_at` | `timestamptz` | `publishedDate` (`string`) | Localized via `formatArabicDate(dto.created_at)` | `'الآن'` |

---

### 3. Query Parameter Specifications

The `libraryService.getResources(params)` method maps parameters to the backend route query string:

```typescript
export interface FetchLibraryParams {
  page?: number;        // Default: 1
  limit?: number;       // Default: 20 (max 50)
  subject?: string;     // 'all' omitted from query string
  grade_level?: string; // Optional filter
  search?: string;      // Trimmed search text (matches title & grade)
  category?: string;    // 'books' | 'worksheets' | 'guides' | 'research' | 'curriculum'
  status?: string;      // 'published' (default for non-admin)
}
```

---

### 4. HTTP Error Translation Table

The frontend `apiClient` maps server HTTP responses to strongly typed `ApiError` objects, which `useLibrary` and `LibraryModal` handle cleanly:

| HTTP Status | Server Error Code | UI Behavior in LibraryModal |
|---|---|---|
| **400 Bad Request** | `INVALID_QUERY_PARAMS` | Display validation message in top error banner. |
| **401 Unauthorized** | `AUTH_REQUIRED` | Render notification prompting user login for protected downloads. |
| **403 Forbidden** | `FORBIDDEN_RESOURCE` | Render permission denied notice without crashing. |
| **404 Not Found** | `RESOURCE_NOT_FOUND` | Display error: *"المورد التعليمي المطلوب غير موجود"*. |
| **409 Conflict** | `CONFLICT_STATE` | Handled gracefully with operation retry. |
| **422 Unprocessable Entity** | `VALIDATION_FAILED` | Display specific field error from server. |
| **429 Too Many Requests** | `RATE_LIMIT_EXCEEDED` | Display rate-limit warning: *"تم تجاوز الحد المسموح من الطلبات"*. |
| **500 Internal Error** | `SERVER_ERROR` | Display error container with retry button. |
| **503 Unavailable** | `DATABASE_UNAVAILABLE` | Display database outage notice with retry button. |
