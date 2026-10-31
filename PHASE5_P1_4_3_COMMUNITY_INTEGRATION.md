# NEXORA — Phase 5 / P1.4.3: Community UI Integration Technical Specification

## 1. Overview & Architectural Scope

The objective of **PHASE 5 / P1.4.3** is the controlled execution of real server-side REST API integration for the **Community Section** (`CommunitySection.tsx`), **Post Details Modal** (`PostDetailModal.tsx`), and **Contribution Modal** (`ContributeModal.tsx`).

Prior to this phase, the Community section relied on static mock arrays from `src/data/mockData.ts`. Under P1.4.3, this section is completely wired to the live Express REST endpoints under `/api/v1/community`, utilizing:
- `src/services/apiClient.ts`
- `src/services/adapters/communityAdapter.ts`
- `src/types/contracts.ts`
- Dedicated community service: `src/services/communityService.ts`
- Custom state & concurrency hook: `src/hooks/useCommunity.ts`

---

## 2. Integrated Components & Responsibilities

### A. `CommunitySection.tsx`
- **Data Source:** Wired directly to `useCommunity` hook which calls `communityService.getPosts()`.
- **Loading State:** Smooth 4-card animated skeleton matching exact card dimensions and typography.
- **Empty State:** User-friendly empty state with icon, explanatory message, and an action button to open `ContributeModal`.
- **Error State:** Distinct error container displaying sanitized backend error messages with a "Retry" (`إعادة المحاولة`) button.
- **Pagination:** Next/Previous pagination controls dynamically displayed when `pagination.totalPages > 1`.
- **Spotlight Visual:** Maintained existing branding, aspect ratio, and verified image asset loading.

### B. `PostDetailModal.tsx`
- **Dynamic Content:** Displays live post details adapted via `adaptCommunityPostFromBackend`.
- **Real Comments:** Loads published comments asynchronously from `GET /api/v1/community/posts/:id/comments`.
- **Comment Creation:** Submits new comments via `POST /api/v1/community/posts/:id/comments`. The comment is appended to the UI **only** after receiving a confirmed 201 response with the comment entity from the server.
- **Idempotent Likes & Bookmarks:** Bound to `toggleLike` and `toggleBookmark` with in-flight lock indicators.
- **IDOR-Protected Archival/Deletion:** Renders delete/archive action for authenticated authors or administrators (`LEAD`/`PRO`), verified by `apiClient.getMe()`, calling `DELETE /api/v1/community/posts/:id`.

### C. `ContributeModal.tsx`
- **Form Submission:** Submits user post data to `POST /api/v1/community/posts` using `communityService.createPost()`.
- **Validation:** Enforces client-side validation for required fields (`title`, `content`) before dispatching network requests.
- **Concurrency & Multi-click Prevention:** Disables inputs and button with a spinner while `isSubmitting` is true.
- **Success & Failure Semantics:** 
  - On 201 Created: dispatches `nexora:post-created` custom event, displays confirmed server success screen, and resets the form.
  - On Error (401, 403, 422, 500): displays informative Toast while strictly preserving user inputs in the form.

---

## 3. Security, State & Concurrency Rules

1. **Double-Submit CSRF & HttpOnly Cookies:** All state-modifying requests (`POST`, `PATCH`, `DELETE`) rely on `credentials: 'include'` and automatic `X-CSRF-Token` extraction handled by `apiClient.ts`.
2. **In-Flight Action Locking:** Likes and bookmarks maintain an `actionInProgress` mutex lock per post ID (`actionInProgress['like:' + id]`), discarding rapid secondary clicks until the server responds.
3. **Cross-Component Synchronization:** When a post is created in `ContributeModal`, a `nexora:post-created` event notifies `useCommunity` to prepend the newly confirmed post without requiring a full page reload.
4. **Anti-Fabrication Enforcement:** Adapters and views never fabricate fictitious school or district names when omitted by backend records.
