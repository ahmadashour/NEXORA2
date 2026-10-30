/**
 * NEXORA API Client
 * Centralized HTTP service for connecting to the NEXORA Express Backend.
 * Supports configurable API URL, JWT token persistence, health probing,
 * and seamless fallback handling.
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

export const apiClient = {
  getToken(): string | null {
    return localStorage.getItem(TOKEN_KEY);
  },

  setToken(token: string): void {
    localStorage.setItem(TOKEN_KEY, token);
  },

  clearToken(): void {
    localStorage.removeItem(TOKEN_KEY);
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
    const res = await fetch(`${API_BASE}/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    const data: AuthResponseData = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'فشل إنشاء الحساب');
    }

    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  },

  /**
   * Login with email and password
   */
  async login(credentials: { email: string; password: string }): Promise<AuthResponseData> {
    const res = await fetch(`${API_BASE}/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(credentials),
    });

    const data: AuthResponseData = await res.json();
    if (!res.ok) {
      throw new Error(data.message || 'بيانات الدخول غير صحيحة');
    }

    if (data.token) {
      this.setToken(data.token);
    }
    return data;
  },

  /**
   * Fetch authenticated user details and permissions
   */
  async getMe(): Promise<ApiResponse> {
    const token = this.getToken();
    if (!token) throw new Error('لا يوجد رمز مصادقة');

    const res = await fetch(`${API_BASE}/auth/me`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Accept': 'application/json',
      },
    });

    const data = await res.json();
    if (!res.ok) {
      this.clearToken();
      throw new Error(data.message || 'انتهت صلاحية الجلسة');
    }
    return data;
  },

  /**
   * Logout user and invalidate token
   */
  async logout(): Promise<void> {
    const token = this.getToken();
    if (token) {
      try {
        await fetch(`${API_BASE}/auth/logout`, {
          method: 'POST',
          headers: { 'Authorization': `Bearer ${token}` },
        });
      } catch {
        // Ignore network errors on logout
      }
    }
    this.clearToken();
  },
};
