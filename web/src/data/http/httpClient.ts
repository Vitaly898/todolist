const BASE = '/api';

/** Shared transport; preserve backend errors and empty 204 responses. */
export async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${BASE}${path}`, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  });
  if (!res.ok) {
    let message = `HTTP ${res.status}`;
    try {
      const body = (await res.json()) as { error?: { message?: string } };
      if (body.error?.message) message = body.error.message;
    } catch {
      // ignore
    }
    throw new Error(message);
  }
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

/** Serialize write payloads consistently without changing request options. */
export function requestJson<T>(
  path: string,
  method: 'POST' | 'PATCH' | 'PUT',
  body: unknown,
): Promise<T> {
  return request<T>(path, { method, body: JSON.stringify(body) });
}
