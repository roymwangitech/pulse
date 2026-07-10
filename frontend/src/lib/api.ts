import { useAuthStore } from '@/stores/auth';

interface FetchOptions extends RequestInit {
  token?: string;
  _retried?: boolean;
}

class ApiClient {
  // In the browser, always use same-origin (all API routes live in this Next.js app).
  // On the server (SSR), fall back to NEXT_PUBLIC_API_URL so absolute URLs work.
  private get base(): string {
    if (typeof window !== 'undefined') return '';
    return process.env.NEXT_PUBLIC_API_URL?.replace(/\/$/, '') ?? '';
  }

  private headers(token?: string): HeadersInit {
    const h: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) h['Authorization'] = `Bearer ${token}`;
    return h;
  }

  async fetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const { token, _retried, headers: extra, ...rest } = options;

    const res = await fetch(`${this.base}/api${endpoint}`, {
      ...rest,
      headers: { ...this.headers(token), ...extra },
    });

    if (res.status === 401 && token && !_retried && !endpoint.startsWith('/auth/')) {
      const stored = useAuthStore.getState().refreshToken;
      const refreshRes = await fetch(`${this.base}/api/auth/refresh`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken: stored }),
      });
      if (refreshRes.ok) {
        const { accessToken, refreshToken } = await refreshRes.json() as { accessToken: string; refreshToken: string };
        useAuthStore.getState().setAccessToken(accessToken);
        useAuthStore.getState().setRefreshToken(refreshToken);
        return this.fetch<T>(endpoint, { ...options, token: accessToken, _retried: true });
      }
      // Refresh failed — log out silently
      useAuthStore.getState().logout();
      if (typeof window !== 'undefined') window.location.href = '/login';
      throw new Error('Session expired');
    }

    if (!res.ok) {
      const err = await res.json().catch(() => ({ error: 'Request failed' }));
      throw new Error(err.error ?? `HTTP ${res.status}`);
    }

    return res.json();
  }

  get<T>(endpoint: string, token?: string) {
    return this.fetch<T>(endpoint, { method: 'GET', token });
  }
  post<T>(endpoint: string, body?: unknown, token?: string) {
    return this.fetch<T>(endpoint, { method: 'POST', body: body ? JSON.stringify(body) : undefined, token });
  }
  patch<T>(endpoint: string, body: unknown, token?: string) {
    return this.fetch<T>(endpoint, { method: 'PATCH', body: JSON.stringify(body), token });
  }
  delete<T>(endpoint: string, token?: string) {
    return this.fetch<T>(endpoint, { method: 'DELETE', token });
  }
}

export const api = new ApiClient();
