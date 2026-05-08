import 'server-only';

const jsonHeaders = {
  'Content-Type': 'application/json'
};

function getBackendBaseUrl(): string {
  const value = process.env.BACKEND_API_URL?.trim();
  if (!value) {
    throw new Error('BACKEND_API_URL is required for the frontend server.');
  }

  const withProtocol = /^https?:\/\//i.test(value) ? value : `https://${value}`;
  return withProtocol.replace(/\/+$/, '');
}

function getInternalApiKey(): string {
  const value = process.env.INTERNAL_API_KEY?.trim();
  if (!value) {
    throw new Error('INTERNAL_API_KEY is required on the frontend server for operator-safe proxying.');
  }

  return value;
}

async function parseError(response: Response): Promise<Error> {
  try {
    const payload = (await response.json()) as { message?: string };
    return new Error(payload.message ?? `Backend request failed with ${response.status}`);
  } catch {
    return new Error(`Backend request failed with ${response.status}`);
  }
}

export async function fetchBackendJson<T>(
  path: string,
  init?: Omit<RequestInit, 'headers'> & { headers?: Record<string, string> }
): Promise<T> {
  const response = await fetch(`${getBackendBaseUrl()}${path}`, {
    ...init,
    headers: {
      ...jsonHeaders,
      'x-api-key': getInternalApiKey(),
      ...(init?.headers ?? {})
    },
    cache: 'no-store'
  });

  if (!response.ok) {
    throw await parseError(response);
  }

  return (await response.json()) as T;
}

export async function postBackendJson<TResponse>(
  path: string,
  body: unknown
): Promise<TResponse> {
  return fetchBackendJson<TResponse>(path, {
    method: 'POST',
    body: JSON.stringify(body)
  });
}

export async function patchBackendJson<TResponse>(
  path: string,
  body: unknown
): Promise<TResponse> {
  return fetchBackendJson<TResponse>(path, {
    method: 'PATCH',
    body: JSON.stringify(body)
  });
}
