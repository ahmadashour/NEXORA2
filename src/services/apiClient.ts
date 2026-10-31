/**
 * NEXORA API Client
 * Centralized, secure HTTP service for connecting to the NEXORA Express Backend.
 * Supports:
 * - Generic HTTP primitives: apiGet, apiPost, apiPatch, apiDelete, apiPut
 * - HttpOnly session cookies via credentials: 'include'
 * - Automatic double-submit CSRF token extraction & injection for mutating requests
 * - Bearer token backward-compatibility without local persistence of new secrets
 * - External origin domain guard (prevents token/CSRF leaks to 3rd party endpoints)
 * - AbortSignal & configurable timeout (default 15s)
 * - 204 No Content & empty response handling
 * - Strongly-typed ApiError preserving HTTP status, code, message, details, and requestId
 */

export interface ApiResponse<T = unknown> {
  success: boolean;
  message?: string;
  error?: string;
  data?: T;
  [key: string]: unknown;
}

export interface AuthResponseData {
  success: boolean;
  message?: string;
  token?: string;
  csrfToken?: string;
  user?: {
    id: string;
    email: string;
    role_id: string;
    role_code: string;
    role_name: string;
    full_name: string;
    is_active: boolean;
    last_login_at: string | null;
  };
  permissions?: string[];
  error?: string;
}

export interface BackendHealthInfo {
  status: string;
  service: string;
  version: string;
  targetDomain: string;
  uptimeSeconds: number;
  database: {
    status: string;
    driver: string;
  };
}

export interface RequestOptions extends Omit<RequestInit, 'body'> {
  params?: Record<string, string | number | boolean | undefined | null>;
  timeoutMs?: number;
  skipAuth?: boolean;
  skipCsrf?: boolean;
}

/**
 * Standardized ApiError representing backend or HTTP transport failures
 */
export class ApiError extends Error {
  public readonly status: number;
  public readonly code: string;
  public readonly details?: unknown;
  public readonly requestId?: string;

  constructor(status: number, code: string, message: string, details?: unknown, requestId?: string) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.code = code;
    this.details = details;
    this.requestId = requestId;
    Object.setPrototypeOf(this, ApiError.prototype);
  }
}

const TOKEN_KEY = 'nexora_auth_token';
const envApiUrl = typeof import.meta !== 'undefined' && (import.meta as any).env ? (import.meta as any).env.VITE_API_URL : (typeof process !== 'undefined' && process.env ? process.env.VITE_API_URL : undefined);
const API_BASE = (envApiUrl || '/api/v1').replace(/\/$/, '');
const DEFAULT_TIMEOUT_MS = 15000;

let inMemoryCsrfToken: string | null = null;

export function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

export function isInternalUrl(url: string): boolean {
  if (!url.startsWith('http://') && !url.startsWith('https://')) {
    return true; // relative path
  }
  try {
    const target = new URL(url);
    if (typeof window !== 'undefined' && target.origin === window.location.origin) {
      return true;
    }
    if (API_BASE.startsWith('http')) {
      const base = new URL(API_BASE);
      if (target.origin === base.origin) return true;
    }
  } catch {
    return false;
  }
  return false;
}

export function resolveUrl(endpoint: string, params?: Record<string, string | number | boolean | undefined | null>): string {
  let finalUrl: string;
  if (endpoint.startsWith('http://') || endpoint.startsWith('https://')) {
    finalUrl = endpoint;
  } else {
    const cleanEndpoint = endpoint.startsWith('/') ? endpoint : `/${endpoint}`;
    if (cleanEndpoint.startsWith('/api/v1') && API_BASE.endsWith('/api/v1')) {
      finalUrl = cleanEndpoint;
    } else {
      finalUrl = `${API_BASE}${cleanEndpoint}`;
    }
  }

  if (params) {
    const queryParts: string[] = [];
    for (const [key, val] of Object.entries(params)) {
      if (val !== undefined && val !== null) {
        queryParts.push(`${encodeURIComponent(key)}=${encodeURIComponent(String(val))}`);
      }
    }
    if (queryParts.length > 0) {
      const separator = finalUrl.includes('?') ? '&' : '?';
      finalUrl += `${separator}${queryParts.join('&')}`;
    }
  }

  return finalUrl;
}

function getDefaultCodeForStatus(status: number): string {
  switch (status) {
    case 400: return 'BAD_REQUEST';
    case 401: return 'UNAUTHORIZED';
    case 403: return 'FORBIDDEN';
    case 404: return 'NOT_FOUND';
    case 409: return 'CONFLICT';
    case 422: return 'VALIDATION_ERROR';
    case 429: return 'RATE_LIMITED';
    case 500: return 'INTERNAL_SERVER_ERROR';
    case 502: return 'BAD_GATEWAY';
    case 503: return 'SERVICE_UNAVAILABLE';
    default: return 'HTTP_ERROR';
  }
}

/**
 * Low-level core HTTP request dispatcher
 */
export async function apiRequest<T = unknown>(
  endpoint: string,
  method: 'GET' | 'POST' | 'PATCH' | 'DELETE' | 'PUT',
  body?: unknown,
  options: RequestOptions = {}
): Promise<T> {
  const isInternal = isInternalUrl(endpoint);
  const targetUrl = resolveUrl(endpoint, options.params);
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;

  const headers: Record<string, string> = {
    'Accept': 'application/json',
    ...(options.headers as Record<string, string> || {}),
  };

  // Only attach internal security tokens to internal endpoints
  if (isInternal) {
    // Bearer token fallback if present
    if (!options.skipAuth) {
      const token = apiClient.getToken();
      if (token && !headers['Authorization']) {
        headers['Authorization'] = `Bearer ${token}`;
      }
    }

    // CSRF token for mutating state
    if (['POST', 'PATCH', 'DELETE', 'PUT'].includes(method) && !options.skipCsrf) {
      const csrf = apiClient.getCsrfToken();
      if (csrf && !headers['X-CSRF-Token']) {
        headers['X-CSRF-Token'] = csrf;
      }
    }
  }

  // Handle request body
  let requestBody: BodyInit | undefined;
  if (body !== undefined && body !== null) {
    if (typeof body === 'object' && !(body instanceof FormData) && !(body instanceof Blob)) {
      if (!headers['Content-Type']) {
        headers['Content-Type'] = 'application/json';
      }
      requestBody = JSON.stringify(body);
    } else {
      requestBody = body as BodyInit;
    }
  }

  // Setup abort controller for timeout
  const controller = new AbortController();
  let timedOut = false;
  const timer = setTimeout(() => {
    timedOut = true;
    controller.abort();
  }, timeoutMs);

  if (options.signal) {
    options.signal.addEventListener('abort', () => {
      controller.abort();
    });
  }

  try {
    const fetchOptions: RequestInit = {
      ...options,
      method,
      headers,
      credentials: isInternal ? 'include' : (options.credentials || 'same-origin'),
      body: requestBody,
      signal: controller.signal,
    };

    const res = await fetch(targetUrl, fetchOptions);

    // Update in-memory CSRF token if backend returned it in headers or cookies
    const returnedCsrf = res.headers.get('x-csrf-token');
    if (returnedCsrf) {
      inMemoryCsrfToken = returnedCsrf;
    }

    // Handle 204 No Content or completely empty responses
    if (res.status === 204) {
      return { success: true } as unknown as T;
    }

    const contentType = res.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    if (!res.ok) {
      let errorData: any = null;
      let rawText = '';

      if (isJson) {
        try {
          errorData = await res.json();
        } catch {
          // Fallback to text if JSON parsing fails
        }
      } else {
        try {
          rawText = await res.text();
        } catch {
          // Ignore
        }
      }

      const code = errorData?.code || errorData?.error || getDefaultCodeForStatus(res.status);
      const message = errorData?.message || errorData?.error || rawText || res.statusText || 'حدث خطأ في معالجة الطلب';
      const details = errorData?.details;
      const requestId = errorData?.requestId || res.headers.get('x-request-id') || undefined;

      // Handle session expiry on 401
      if (res.status === 401 && isInternal) {
        apiClient.clearToken();
      }

      throw new ApiError(res.status, String(code), String(message), details, requestId);
    }

    if (isJson) {
      const data = await res.json();
      return data as T;
    }

    const textData = await res.text();
    return (textData ? textData : { success: true }) as unknown as T;
  } catch (err: unknown) {
    if (timedOut) {
      throw new ApiError(408, 'REQUEST_TIMEOUT', 'انتهت مهلة انتظار الطلب (Request Timeout)');
    }
    if (err instanceof ApiError) {
      throw err;
    }
    if (err instanceof DOMException && err.name === 'AbortError') {
      throw new ApiError(499, 'REQUEST_ABORTED', 'تم إلغاء الطلب بواسطة المستخدم أو النظام');
    }
    const errorMsg = err instanceof Error ? err.message : 'فشل الاتصال بالخادم';
    throw new ApiError(0, 'NETWORK_ERROR', errorMsg);
  } finally {
    clearTimeout(timer);
  }
}

/**
 * Generic HTTP GET helper
 */
export async function apiGet<T>(endpoint: string, options?: RequestOptions): Promise<T> {
  return apiRequest<T>(endpoint, 'GET', undefined, options);
}

/**
 * Generic HTTP POST helper
 */
export async function apiPost<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
  return apiRequest<T>(endpoint, 'POST', body, options);
}

/**
 * Generic HTTP PATCH helper
 */
export async function apiPatch<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
  return apiRequest<T>(endpoint, 'PATCH', body, options);
}

/**
 * Generic HTTP DELETE helper
 */
export async function apiDelete<T>(endpoint: string, options?: RequestOptions): Promise<T> {
  return apiRequest<T>(endpoint, 'DELETE', undefined, options);
}

/**
 * Generic HTTP PUT helper
 */
export async function apiPut<T>(endpoint: string, body?: unknown, options?: RequestOptions): Promise<T> {
  return apiRequest<T>(endpoint, 'PUT', body, options);
}

/**
 * Unified NEXORA API Client instance
 */
export const apiClient = {
  // Generic HTTP verbs
  get: apiGet,
  post: apiPost,
  patch: apiPatch,
  delete: apiDelete,
  put: apiPut,
  request: apiRequest,

  getToken(): string | null {
    try {
      return localStorage.getItem(TOKEN_KEY);
    } catch {
      return null;
    }
  },

  setToken(token: string): void {
    try {
      localStorage.setItem(TOKEN_KEY, token);
    } catch {
      // Ignore if localStorage unavailable
    }
  },

  clearToken(): void {
    try {
      localStorage.removeItem(TOKEN_KEY);
    } catch {
      // Ignore
    }
    inMemoryCsrfToken = null;
  },

  getCsrfToken(): string | null {
    return inMemoryCsrfToken || getCookie('nexora_csrf');
  },

  setCsrfToken(csrf: string): void {
    inMemoryCsrfToken = csrf;
  },

  /**
   * Health probe to check whether backend API is responsive
   */
  async checkHealth(): Promise<{ isOnline: boolean; info?: BackendHealthInfo }> {
    try {
      const data = await apiGet<BackendHealthInfo>('/health', { timeoutMs: 3000, skipAuth: true, skipCsrf: true });
      return { isOnline: true, info: data };
    } catch {
      return { isOnline: false };
    }
  },

  /**
   * Register a new user in NEXORA
   */
  async register(payload: {
    email: string;
    password: string;
    fullName: string;
    role: string;
    phone?: string;
    school?: string;
    district?: string;
  }): Promise<AuthResponseData> {
    const data = await apiPost<AuthResponseData>('/auth/register', payload);
    if (data.token) {
      this.setToken(data.token);
    }
    if (data.csrfToken) {
      this.setCsrfToken(data.csrfToken);
    }
    return data;
  },

  /**
   * Login with email and password
   */
  async login(credentials: { email: string; password: string }): Promise<AuthResponseData> {
    const data = await apiPost<AuthResponseData>('/auth/login', credentials);
    if (data.token) {
      this.setToken(data.token);
    }
    if (data.csrfToken) {
      this.setCsrfToken(data.csrfToken);
    }
    return data;
  },

  /**
   * Fetch authenticated user details and permissions directly from backend.
   */
  async getMe(): Promise<ApiResponse> {
    return apiGet<ApiResponse>('/auth/me');
  },

  /**
   * Logout user, clear session cookies, and invalidate tokens
   */
  async logout(): Promise<void> {
    try {
      await apiPost('/auth/logout', {});
    } catch {
      // Ignore network errors on logout
    } finally {
      this.clearToken();
    }
  },

  /**
   * Updates user password and invalidates all prior sessions
   */
  async changePassword(payload: { currentPassword: string; newPassword: string }): Promise<ApiResponse> {
    return apiPost<ApiResponse>('/auth/change-password', payload);
  },
};
