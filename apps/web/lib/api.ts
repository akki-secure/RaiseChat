const BASE_URL = process.env.NEXT_PUBLIC_API_URL ?? 'http://localhost:4000';

async function request<T>(path: string, options: RequestInit = {}): Promise<T> {
  const res = await fetch(`${BASE_URL}${path}`, {
    ...options,
    credentials: 'include',
    headers: {
      'Content-Type': 'application/json',
      ...options.headers,
    },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Unknown error' }));
    const detail = Array.isArray(body.details)
      ? body.details.map((d: { field: string; message: string }) => `${d.field}: ${d.message}`).join(', ')
      : null;
    throw new Error(detail ?? body.error ?? `HTTP ${res.status}`);
  }

  return res.json() as Promise<T>;
}

async function upload(file: File): Promise<{ url: string; file_type: string; size: number }> {
  const form = new FormData();
  form.append('file', file);
  // Content-Type は指定しない（fetch が multipart の boundary 付きで自動設定する）
  const res = await fetch(`${BASE_URL}/upload`, { method: 'POST', body: form, credentials: 'include' });
  if (!res.ok) {
    const body = await res.json().catch(() => ({ error: 'Unknown error' }));
    throw new Error(body.error ?? `HTTP ${res.status}`);
  }
  return res.json();
}

export const api = {
  upload,
  get:    <T>(path: string) => request<T>(path),
  post:   <T>(path: string, body: unknown) => request<T>(path, { method: 'POST', body: JSON.stringify(body) }),
  put:    <T>(path: string, body: unknown) => request<T>(path, { method: 'PUT',  body: JSON.stringify(body) }),
  patch:  <T>(path: string, body: unknown) => request<T>(path, { method: 'PATCH', body: JSON.stringify(body) }),
  delete: <T>(path: string, body?: unknown) => request<T>(path, { method: 'DELETE', ...(body !== undefined ? { body: JSON.stringify(body) } : {}) }),
};
