import { useAuthStore } from '@/stores/auth';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

interface FetchOptions extends RequestInit {
  token?: string;
  _retried?: boolean;
}

function updateStoredAccessToken(accessToken: string) {
  if (typeof window === 'undefined') return;
  try {
    useAuthStore.getState().setAccessToken(accessToken);
    const raw = localStorage.getItem('pulsechat-auth');
    if (!raw) return;
    const parsed = JSON.parse(raw);
    if (parsed?.state) {
      parsed.state.accessToken = accessToken;
      localStorage.setItem('pulsechat-auth', JSON.stringify(parsed));
    }
  } catch {
    // ignore storage errors
  }
}

class ApiClient {
  private baseUrl: string;

  constructor(baseUrl: string) {
    this.baseUrl = baseUrl;
  }

  private getHeaders(token?: string): HeadersInit {
    const headers: HeadersInit = {};
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  async fetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const { token, headers: customHeaders, _retried, ...rest } = options;
    const isFormData = rest.body instanceof FormData;

    const response = await fetch(`${this.baseUrl}${endpoint}`, {
      ...rest,
      credentials: 'include',
      headers: {
        ...(!isFormData ? { 'Content-Type': 'application/json' } : {}),
        ...this.getHeaders(token),
        ...customHeaders,
      },
    });

    if (response.status === 401 && token && !_retried && !endpoint.startsWith('/auth/')) {
      const refreshRes = await fetch(`${this.baseUrl}/auth/refresh`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({}),
      });
      if (refreshRes.ok) {
        const refreshed = await refreshRes.json() as { accessToken: string };
        updateStoredAccessToken(refreshed.accessToken);
        return this.fetch<T>(endpoint, { ...options, token: refreshed.accessToken, _retried: true });
      }
    }

    if (!response.ok) {
      const error = await response.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(error.error ?? `HTTP ${response.status}`);
    }

    return response.json();
  }

  get<T>(endpoint: string, token?: string) {
    return this.fetch<T>(endpoint, { method: 'GET', token });
  }

  post<T>(endpoint: string, body?: unknown, token?: string) {
    const isFormData = body instanceof FormData;
    return this.fetch<T>(endpoint, {
      method: 'POST',
      body: isFormData ? body : body ? JSON.stringify(body) : undefined,
      token,
    });
  }

  patch<T>(endpoint: string, body: unknown, token?: string) {
    return this.fetch<T>(endpoint, {
      method: 'PATCH',
      body: JSON.stringify(body),
      token,
    });
  }

  delete<T>(endpoint: string, token?: string) {
    return this.fetch<T>(endpoint, { method: 'DELETE', token });
  }
}

export const api = new ApiClient(`${API_URL}/api`);
export { API_URL };
