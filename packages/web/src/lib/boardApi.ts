const BASE = '/api/boards';

export class BoardApiError extends Error {
  status: number;
  code: string;

  constructor(status: number, code: string, message: string) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

export async function boardApi<T = any>(path: string, options?: RequestInit): Promise<T> {
  const headers: Record<string, string> = {
    'Content-Type': 'application/json',
  };

  // Check for board auth token
  const token = localStorage.getItem('boardToken');
  if (token) {
    headers['Authorization'] = `Bearer ${token}`;
  }

  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: { ...headers, ...options?.headers },
  });

  if (!res.ok) {
    const body = await res.json().catch(() => ({}));
    const err = body.error || body;
    throw new BoardApiError(
      res.status,
      err.code || 'UNKNOWN',
      err.message || `Request failed: ${res.status}`,
    );
  }

  return res.json();
}
