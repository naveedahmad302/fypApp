/**
 * API configuration and fetch helpers for the ASD Detection Backend.
 *
 * For local development on Android (both emulator and real device):
 *   1. Start the backend on your computer: poetry run fastapi dev app/main.py
 *   2. Run: adb reverse tcp:8000 tcp:8000
 *   3. The app will use localhost:8000 which forwards to the host machine.
 *
 * For iOS simulator: localhost works directly (no extra steps).
 *
 * For production, replace API_BASE_URL with the deployed backend URL.
 */

// localhost works on both Android emulator and real device when
// `adb reverse tcp:8000 tcp:8000` is run on the host machine.
// iOS simulator can reach the host's localhost directly.
export const API_BASE_URL = 'http://localhost:8000';

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
