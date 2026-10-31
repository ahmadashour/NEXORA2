# NEXORA — Phase 5 / P1.4.2: API Client Specification & Architecture

## 1. Overview & Architectural Goals

The **NEXORA API Client** (`src/services/apiClient.ts`) serves as the hardened, production-grade transport layer connecting frontend view models to the Express RESTful backend.

In P1.4.2, the API client was enhanced to eliminate contract mismatches identified during the P1.4.1 readiness audit while strictly preventing sensitive token leakage, maintaining session security, and preserving raw error codes.

---

## 2. Core Transport Capabilities

### A. Generic HTTP Primitives
The client exposes strongly typed, generic request helpers:
- `apiGet<T>(endpoint: string, options?: RequestOptions): Promise<T>`
- `apiPost<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T>`
- `apiPatch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T>`
- `apiDelete<T>(endpoint: string, options?: RequestOptions): Promise<T>`
- `apiPut<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T>`
- `apiRequest<T>(endpoint: string, method, body, options): Promise<T>`

### B. Environment & URL Resolution
- **Base URL Resolution:** Automatically reads `import.meta.env.VITE_API_URL` with resilient fallback for Node/tsx testing environments (`process.env.VITE_API_URL || '/api/v1'`).
- **Endpoint Normalization:** Prevents duplicate `/api/v1/api/v1` prefix duplication when combining relative paths.
- **Query Parameter Serialization:** Automatically serializes `options.params` into standard URL query strings (handling encoding and omitting undefined/null values).

### C. Cookie & Double-Submit CSRF Protection
- **`credentials: 'include'`**: Ensures HTTP-only session cookies (`nexora_session`) are sent with all cross-origin or same-origin backend requests.
- **Automatic CSRF Injection:** On state-mutating HTTP methods (`POST`, `PATCH`, `DELETE`, `PUT`), automatically extracts the `nexora_csrf` cookie (or in-memory token) and attaches it via the `X-CSRF-Token` header.
- **No Console/Storage Leaks:** CSRF tokens and session identifiers are never logged to console or dumped to disk.

### D. Bearer Token Compatibility
- Integrates seamlessly with existing `getToken()` Bearer token authentication for API backward compatibility.
- Does not persist new credentials or tokens in unsecured `localStorage` structures.

### E. External Domain Isolation Guard
- **`isInternalUrl(url)`** rigorously verifies if a request targets the NEXORA API host or a 3rd-party external endpoint.
- **Security Rule:** If an endpoint targets an external absolute URL (e.g. `https://external-service.com`), internal session cookies, CSRF tokens, and Bearer tokens are **strictly withheld**.

### F. AbortSignal & Timeout Management
- Default timeout of 15,000ms enforced via an `AbortController`.
- Fully supports custom timeout overrides via `options.timeoutMs`.
- Integrates transparently with external `AbortSignal` instances passed by caller components.
- Surfaces clean `408 REQUEST_TIMEOUT` or `499 REQUEST_ABORTED` `ApiError` instances rather than unhandled promise rejections.

### G. 204 No Content & Empty Response Safety
- Gracefully handles HTTP 204 No Content responses or 200 responses with empty bodies without throwing JSON parsing syntax errors.

---

## 3. Standardized Error Handling: `ApiError`

The client throws an instance of `ApiError` extending `Error` for all non-2xx HTTP responses or transport failures:

```typescript
export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly requestId?: string;
}
```

### Critical Preserved Error Codes:
| HTTP Status | Preserved Code | Description |
|---|---|---|
| 401 | `UNAUTHORIZED` | Invalid or expired session; triggers `apiClient.clearToken()` |
| 403 | `FORBIDDEN` | Insufficient role or permission |
| 404 | `NOT_FOUND` | Requested entity does not exist |
| 409 | `ALREADY_REGISTERED` | User already registered for the event |
| 409 | `EVENT_CAPACITY_EXCEEDED` | All seats for the event are booked |
| 422 | `VALIDATION_FAILED` | Field-level validation failed (contains structured `details[]`) |
| 429 | `RATE_LIMITED` | Rate limit threshold exceeded |
| 500 | `INTERNAL_SERVER_ERROR` | Server-side unhandled exception |
| 408 | `REQUEST_TIMEOUT` | Client request timed out |
| 0   | `NETWORK_ERROR` | Network unreachable or CORS failure |

---

## 4. Backward Compatibility Verification
All existing authentication methods on `apiClient` (`register`, `login`, `getMe`, `logout`, `changePassword`, `checkHealth`) continue to function without any breaking signature changes.
