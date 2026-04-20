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

// Android emulator uses 10.0.2.2 to reach host machine's localhost.
// iOS simulator can use localhost directly.
// For a real device on the same network, use the machine's LAN IP.
import { Platform } from 'react-native';

// For real device: run "adb reverse tcp:8000 tcp:8000" so localhost works,
//   OR use your machine's LAN IP (e.g. 192.168.x.x).
// For Android emulator: 10.0.2.2 is the emulator alias for host localhost.
// For iOS simulator: localhost works directly.
const DEV_HOST = Platform.OS === 'android' ? '10.0.2.2' : 'localhost';

export const API_BASE_URL = `http://${DEV_HOST}:8000`;

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
