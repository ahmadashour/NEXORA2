# NEXORA — PHASE 5 / P1.4.4: DOWNLOAD SECURITY SPECIFICATION
## Storage Protection, Anti-Leakage & Concurrency Guard Architecture

**Date:** October 31, 2026  
**Status:** AUDITED & SECURED  
**Module:** Digital Library Download Subsystem  

---

### 1. The Storage Path Disclosure Threat & Mitigation

#### Threat Vector
In database-backed content management systems, backend records frequently store physical file references such as `/uploads/resources/2026/chem_guide.pdf`, `disk:/mnt/storage/...`, or `/var/www/...`. Exposing these raw strings to browser clients causes:
1. Disclosure of internal server directory structures and hosting providers.
2. Direct path traversal or local file inclusion (LFI) attempts by malicious actors.
3. Inability of the server to authenticate, rate limit, or meter download actions before granting access.

#### Mitigation Architecture
In NEXORA P1.4.4, internal disk paths are strictly intercepted and neutralized at two distinct layers:
1. **Server Route Defense (`server/routes/library.ts`)**:
   - `sanitizeResource()` strips `internal_storage_path`, `secret_key`, and private metadata prior to JSON response serialization.
   - The `/api/v1/library/resources/:id/download` route verifies published status and authorization before returning asset references.
2. **Adapter Security Guard (`src/services/adapters/libraryAdapter.ts`)**:
   - `sanitizeDownloadUrl(resourceId, rawUrl)` intercepts any string containing `/uploads/`, `disk:`, or leading slashes `/`, transforming them into the controlled proxy route:
     ```
     /api/v1/library/resources/${resourceId}/download
     ```
   - Only fully qualified, trusted CDN URLs (e.g. `https://cdn.ashouracademy.com/...`) are preserved as direct download links.

---

### 2. Server-Authoritative Download Counting

Download counts are strictly managed on the server side:
- **No Optimistic Counter Spoofing**: The client UI does not increment `downloadsCount` locally until the server responds with HTTP 200 containing `{ success: true, downloadsCount: newCount }`.
- **Database Atomicity**: On the backend, `db.library.incrementDownloads(id)` increments the database field atomically within PostgreSQL (`downloads_count = downloads_count + 1`).
- **Activity Logging**: When an authenticated user downloads a resource, the action is logged in `activity_logs` with their `user_id`, timestamp, and client IP.

---

### 3. In-Flight Concurrency & Double-Click Guard (Client Mutex)

#### Problem
Users double-clicking or repeatedly pressing "تحميل الملف الرقمي" (Download) can initiate parallel HTTP requests, causing:
- Double or triple download counter increments for a single user action.
- Network connection saturation.
- Corrupted file streams or race conditions.

#### Solution: Two-Tier Mutex in `useLibrary.ts`
1. **Active Download Tracking**: `downloadingId: string | null` tracks which resource is currently being processed.
2. **Per-Resource Mutex Lock**: `downloadInProgress: Record<string, boolean>` guards against duplicate execution.
3. **UI Disabling**:
   ```typescript
   if (downloadInProgress[resourceId] || downloadingId !== null) {
     return { success: false, message: 'عملية تنزيل أخرى قيد المعالجة حالياً' };
   }
   ```
   In `LibraryModal.tsx`:
   - The active download button displays `<Loader2 className="animate-spin" />` with text *"جارٍ التجهيز..."* and cursor `cursor-wait`.
   - All other download buttons in the modal are visually disabled (`opacity-60 bg-slate-400 cursor-not-allowed`) until the in-flight request finishes, safely releasing the lock in a `finally` block.

---

### 4. Browser Download Execution & Sandbox Isolation

When the server returns the safe download URL:
```typescript
if (typeof window !== 'undefined' && downloadData.downloadUrl) {
  const anchor = document.createElement('a');
  anchor.href = downloadData.downloadUrl;
  anchor.download = downloadData.fileName || `${resource.title}.${downloadData.fileType.toLowerCase()}`;
  anchor.target = '_blank';
  anchor.rel = 'noopener noreferrer';
  document.body.appendChild(anchor);
  anchor.click();
  document.body.removeChild(anchor);
}
```
- `rel="noopener noreferrer"` protects the parent browsing context.
- Programmatic DOM insertion and immediate cleanup prevent DOM memory leaks.
- Non-browser environments (Node.js test runners) gracefully bypass DOM logic without throwing errors.
