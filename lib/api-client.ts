import axios, { AxiosError, AxiosRequestConfig, InternalAxiosRequestConfig } from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

export const ACCESS_TOKEN_KEY = 'accessToken';
export const USER_INFO_KEY = 'userInfo';

export type ApiResponse<T> = {
  success: boolean;
  data: T;
  meta?: {
    total?: number;
    page?: number;
    limit?: number;
    totalPages?: number;
  };
};

type ApiErrorPayload = {
  error?: {
    code?: string;
    message?: string;
    details?: unknown;
  };
};

// Custom error class that preserves API response details
export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
    public readonly code?: string,
    public readonly details?: unknown,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

type RetriableRequestConfig = InternalAxiosRequestConfig & {
  _retry?: boolean;
};

function isBrowser() {
  return typeof window !== 'undefined';
}

function getPreferredStorage() {
  if (!isBrowser()) return null;
  return localStorage.getItem(USER_INFO_KEY) ? localStorage : sessionStorage;
}

export function getStoredToken(): string | null {
  if (!isBrowser()) return null;
  return localStorage.getItem(ACCESS_TOKEN_KEY) ?? sessionStorage.getItem(ACCESS_TOKEN_KEY);
}

export function getStoredUser<T>(): T | null {
  if (!isBrowser()) return null;

  const raw = localStorage.getItem(USER_INFO_KEY) ?? sessionStorage.getItem(USER_INFO_KEY);

  if (!raw) return null;

  try {
    return JSON.parse(raw) as T;
  } catch {
    return null;
  }
}

export function setAuthSession<T>(payload: { accessToken: string; user: T }, _rememberMe: boolean) {
  if (!isBrowser()) return;

  // Always persist in localStorage so closing the tab doesn't lose the session.
  // Session lifetime is controlled by the refresh token cookie (30d default, 150d with remember me).
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(USER_INFO_KEY);

  localStorage.setItem(ACCESS_TOKEN_KEY, payload.accessToken);
  localStorage.setItem(USER_INFO_KEY, JSON.stringify(payload.user));
}

export function updateStoredToken(token: string) {
  const storage = getPreferredStorage();
  storage?.setItem(ACCESS_TOKEN_KEY, token);
}

export function clearAuthSession() {
  if (!isBrowser()) return;
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(USER_INFO_KEY);
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(USER_INFO_KEY);
}

export const api = axios.create({
  baseURL: API_URL,
  withCredentials: true,
  headers: {
    'Content-Type': 'application/json',
  },
});

export async function refreshAccessToken(): Promise<string | null> {
  try {
    const response = await axios.post<ApiResponse<{ accessToken: string }>>(
      `${API_URL}/api/auth/refresh-token`,
      {},
      { withCredentials: true },
    );

    const token = response.data.data?.accessToken;
    if (token) {
      updateStoredToken(token);
    }

    return token ?? null;
  } catch {
    return null;
  }
}

api.interceptors.request.use((config: InternalAxiosRequestConfig) => {
  const token = getStoredToken();

  if (token) {
    config.headers.Authorization = `Bearer ${token}`;
  }

  return config;
});

api.interceptors.response.use(
  (response) => response,
  async (error: AxiosError<ApiErrorPayload>) => {
    const originalRequest = error.config as RetriableRequestConfig | undefined;

    if (
      originalRequest &&
      error.response?.status === 401 &&
      !originalRequest._retry &&
      !originalRequest.url?.includes('/api/auth/login') &&
      !originalRequest.url?.includes('/api/auth/refresh-token')
    ) {
      originalRequest._retry = true;

      const token = await refreshAccessToken();
      if (token) {
        originalRequest.headers.Authorization = `Bearer ${token}`;
        return api(originalRequest);
      }

      clearAuthSession();

      if (isBrowser()) {
        window.location.href = '/';
      }
    }

    const status = error.response?.status ?? 500;
    const code = error.response?.data?.error?.code ?? 'UNKNOWN_ERROR';
    const message = error.response?.data?.error?.message ?? error.message ?? 'API error';
    const details = error.response?.data?.error?.details;

    throw new ApiError(message, status, code, details);
  },
);

export async function apiRequest<T>(config: AxiosRequestConfig): Promise<ApiResponse<T>> {
  try {
    const response = await api.request<ApiResponse<T>>(config);
    return response.data;
  } catch (err) {
    // Re-throw ApiError to preserve status/code for callers
    if (err instanceof ApiError) {
      throw err;
    }
    // Handle non-Axios errors
    if (err instanceof Error) {
      throw new ApiError(err.message, 500, 'INTERNAL_ERROR');
    }
    throw new ApiError('Unknown error', 500, 'UNKNOWN_ERROR');
  }
}

export const apiClient = {
  get: <T>(url: string, config?: AxiosRequestConfig) =>
    apiRequest<T>({ url, method: 'GET', ...config }),

  post: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    apiRequest<T>({ url, method: 'POST', data, ...config }),

  patch: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    apiRequest<T>({ url, method: 'PATCH', data, ...config }),

  put: <T>(url: string, data?: unknown, config?: AxiosRequestConfig) =>
    apiRequest<T>({ url, method: 'PUT', data, ...config }),

  delete: <T>(url: string, config?: AxiosRequestConfig) =>
    apiRequest<T>({ url, method: 'DELETE', ...config }),
};

export function getApiBaseUrl() {
  return API_URL;
}

export function getLeaveAttachmentUrl(attachmentUrl?: string | null) {
  if (!attachmentUrl) return null;
  if (attachmentUrl.startsWith('http')) return attachmentUrl;
  if (attachmentUrl.startsWith('/uploads/')) return `${API_URL}${attachmentUrl}`;

  return `${API_URL}/uploads/leave-attachments/${attachmentUrl}`;
}
