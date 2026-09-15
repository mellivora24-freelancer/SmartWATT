import * as SecureStore from 'expo-secure-store';
import { config } from '../config';

const TOKEN_KEY = 'smartwatt_jwt_token';

export class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

export async function getToken(): Promise<string | null> {
  try {
    return await SecureStore.getItemAsync(TOKEN_KEY);
  } catch {
    return null;
  }
}

export async function setToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(TOKEN_KEY, token);
}

export async function removeToken(): Promise<void> {
  await SecureStore.deleteItemAsync(TOKEN_KEY);
}

interface RequestOptions extends RequestInit {
  timeoutMs?: number;
  skipAuth?: boolean;
}

export async function apiClient<T>(
  path: string,
  options: RequestOptions = {}
): Promise<T> {
  const { timeoutMs = 15000, skipAuth = false, headers = {}, ...rest } = options;

  const url = path.startsWith('http') ? path : `${config.apiBaseUrl}${path}`;
  const reqHeaders: Record<string, string> = {
    'Content-Type': 'application/json',
    Accept: 'application/json',
    ...(headers as Record<string, string>),
  };

  if (!skipAuth) {
    const token = await getToken();
    if (token) {
      reqHeaders['Authorization'] = `Bearer ${token}`;
    }
  }

  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeoutMs);

  try {
    const response = await fetch(url, {
      ...rest,
      headers: reqHeaders,
      signal: controller.signal,
    });

    clearTimeout(timer);

    if (response.status === 204) {
      return {} as T;
    }

    const contentType = response.headers.get('content-type') || '';
    const isJson = contentType.includes('application/json');

    let body: any = null;
    if (isJson) {
      body = await response.json();
    } else {
      const text = await response.text();
      body = { detail: text };
    }

    if (!response.ok) {
      const detail =
        body?.detail ||
        body?.message ||
        `Yêu cầu thất bại với mã lỗi ${response.status}`;
      throw new ApiError(response.status, typeof detail === 'string' ? detail : JSON.stringify(detail));
    }

    return body as T;
  } catch (error: any) {
    clearTimeout(timer);
    if (error.name === 'AbortError') {
      throw new ApiError(408, 'Hết thời gian chờ kết nối máy chủ. Vui lòng kiểm tra mạng LAN.');
    }
    if (error instanceof ApiError) {
      throw error;
    }
    throw new ApiError(
      0,
      error?.message || 'Không thể kết nối đến máy chủ SmartWatt. Hãy kiểm tra Wi-Fi và địa chỉ IP server.'
    );
  }
}
