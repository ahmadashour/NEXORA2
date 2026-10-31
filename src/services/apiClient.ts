/**
 * NEXORA API Client
 * Centralized HTTP service for connecting to the NEXORA Express Backend.
 * Supports HttpOnly Secure Cookies, double-submit CSRF protection,
 * Bearer token backward-compatibility, and session recovery.
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

const TOKEN_KEY = 'nexora_auth_token';
const API_BASE = (import.meta.env.VITE_API_URL || '/api/v1').replace(/\/$/, '');

function getCookie(name: string): string | null {
  if (typeof document === 'undefined') return null;
  const match = document.cookie.match(new RegExp(`(?:^|;\\s*)${name}=([^;]+)`));
  return match ? decodeURIComponent(match[1]) : null;
}

let inMemoryCsrfToken: string | null = null;

export const apiClient = {
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
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 3000);

      const response = await fetch(`${API_BASE}/health`, {
        signal: controller.signal,
        headers: { 'Accept': 'application/json' },
        credentials: 'include',
      });
      clearTimeout(timeoutId);

      if (response.ok) {
        const data = await response.json();
        return { isOnline: true, info: data };
      }
      return { isOnline: false };
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
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    const csrf = this.getCsrfToken();
    if (csrf) {
      headers['X-CSRF-Token'] = csrf;
    }

    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const data: AuthResponseData = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'فشل إنشاء الحساب');
    }

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
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    const csrf = this.getCsrfToken();
    if (csrf) {
      headers['X-CSRF-Token'] = csrf;
    }

    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(credentials),
    });

    const data: AuthResponseData = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'بيانات الدخول غير صحيحة');
    }

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
   * Leverages HttpOnly session cookie automatically via credentials: 'include',
   * with fallback to Authorization: Bearer token if present.
   */
  async getMe(): Promise<ApiResponse> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }

    const res = await fetch(`${API_BASE}/auth/me`, {
      method: 'GET',
      headers,
      credentials: 'include',
    });

    const data = await res.json();
    if (!res.ok) {
      this.clearToken();
      throw new Error(data.message || 'انتهت صلاحية الجلسة');
    }
    return data;
  },

  /**
   * Logout user, clear session cookies, and invalidate tokens
   */
  async logout(): Promise<void> {
    const headers: Record<string, string> = {
      'Accept': 'application/json',
    };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const csrf = this.getCsrfToken();
    if (csrf) {
      headers['X-CSRF-Token'] = csrf;
    }

    try {
      await fetch(`${API_BASE}/auth/logout`, {
        method: 'POST',
        headers,
        credentials: 'include',
      });
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
    const headers: Record<string, string> = {
      'Content-Type': 'application/json',
      'Accept': 'application/json',
    };
    const token = this.getToken();
    if (token) {
      headers['Authorization'] = `Bearer ${token}`;
    }
    const csrf = this.getCsrfToken();
    if (csrf) {
      headers['X-CSRF-Token'] = csrf;
    }

    const res = await fetch(`${API_BASE}/auth/change-password`, {
      method: 'POST',
      headers,
      credentials: 'include',
      body: JSON.stringify(payload),
    });

    const data = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'تعذر تحديث كلمة المرور');
    }
    return data;
  },
};
