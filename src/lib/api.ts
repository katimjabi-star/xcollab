// ============================================
// XCollab — HTTP helpers
// ============================================

export class ApiError extends Error {
  constructor(
    message: string,
    public readonly status: number,
  ) {
    super(message);
    this.name = 'ApiError';
  }
}

/**
 * fetch() that treats non-2xx responses as errors and parses JSON.
 * Server error bodies are `{ error: string }`; that message is surfaced.
 */
export async function fetchJson<T>(input: string, init?: RequestInit): Promise<T> {
  const res = await fetch(input, init);
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // fall through — non-JSON body is only a problem for OK responses
  }
  if (!res.ok) {
    const message =
      body && typeof body === 'object' && 'error' in body && typeof body.error === 'string'
        ? body.error
        : `Request failed with status ${res.status}`;
    throw new ApiError(message, res.status);
  }
  if (body === null) {
    throw new ApiError('Malformed JSON response', res.status);
  }
  return body as T;
}

export function postJson<T>(input: string, payload: unknown): Promise<T> {
  return fetchJson<T>(input, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(payload),
  });
}
