import { useAuthStore } from '@/stores/auth';

/**
 * In development, returns the local backend URL (NEXT_PUBLIC_API_URL).
 * In production on Vercel, returns empty string so requests go to /api/* 
 * which is proxied to Render via vercel.json rewrites.
 */
export function getPublicOrigin(): string {
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  }
  return '';
}

/**
 * Socket.IO server URL.
 * In dev: same as API URL. In production: direct Render URL (socket.io needs a real origin).
 */
export function getSocketUrl(): string {
  if (process.env.NEXT_PUBLIC_SOCKET_URL) {
    return process.env.NEXT_PUBLIC_SOCKET_URL.replace(/\/$/, '');
  }
  if (process.env.NEXT_PUBLIC_API_URL) {
    return process.env.NEXT_PUBLIC_API_URL.replace(/\/$/, '');
  }
  return '';
}

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
  private basePath: string;

  constructor() {
    const origin = getPublicOrigin();
    this.basePath = origin ? `${origin}/api` : '/api';
  }

  private getHeaders(token?: string): HeadersInit {
    const headers: HeadersInit = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    return headers;
  }

  async fetch<T>(endpoint: string, options: FetchOptions = {}): Promise<T> {
    const { token, headers: customHeaders, _retried, ...rest } = options;

    const response = await fetch(`${this.basePath}${endpoint}`, {
      ...rest,
      credentials: 'include',
      headers: {
        ...this.getHeaders(token),
        ...customHeaders,
      },
    });

    if (response.status === 401 && token && !_retried && !endpoint.startsWith('/auth/')) {
      const refreshRes = await fetch(`${this.basePath}/auth/refresh`, {
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
    return this.fetch<T>(endpoint, {
      method: 'POST',
      body: body ? JSON.stringify(body) : undefined,
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

export const api = new ApiClient();
