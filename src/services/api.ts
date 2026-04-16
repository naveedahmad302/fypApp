/**
 * API configuration and fetch helpers for the ASD Detection Backend.
 *
 * The BASE_URL should point to wherever the FastAPI backend is running.
 * During local development this is typically http://10.0.2.2:8000 for
 * Android emulators (which maps to host localhost) or http://localhost:8000
 * for iOS simulators.
 *
 * For production, replace with the deployed backend URL.
 */

// Android emulator uses 10.0.2.2 to reach host machine's localhost.
// iOS simulator can use localhost directly.
// For a real device on the same network, use the machine's LAN IP.
import { Platform } from 'react-native';

const LOCAL_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

export const API_BASE_URL = `http://${LOCAL_HOST}:8000`;

interface RequestOptions {
  method?: 'GET' | 'POST' | 'PUT' | 'DELETE';
  body?: unknown;
  headers?: Record<string, string>;
  timeoutMs?: number;
}

class ApiError extends Error {
  status: number;
  detail: string;

  constructor(status: number, detail: string) {
    super(detail);
    this.name = 'ApiError';
    this.status = status;
    this.detail = detail;
  }
}

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { method = 'GET', body, headers = {}, timeoutMs = 60_000 } = options;

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), timeoutMs);

  const url = `${API_BASE_URL}${path}`;

  const fetchOptions: RequestInit = {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...headers,
    },
    signal: controller.signal,
  };

  if (body !== undefined) {
    fetchOptions.body = JSON.stringify(body);
  }

  try {
    const response = await fetch(url, fetchOptions);

    if (!response.ok) {
      let detail = `Request failed with status ${response.status}`;
      try {
        const errorBody = await response.json();
        if (errorBody.detail) {
          detail = errorBody.detail;
        }
      } catch {
        // ignore JSON parse errors on error responses
      }
      throw new ApiError(response.status, detail);
    }

    return (await response.json()) as T;
  } finally {
    clearTimeout(timeout);
  }
}

export { request, ApiError };
